from research_scope import is_active_sd
import json,gzip,sqlite3,math
from pathlib import Path
from collections import Counter,defaultdict
R=Path('D:/Codex/sd-research');D=R/'repo/docs/SD-RESEARCH/data';D.mkdir(parents=True,exist_ok=True)
def read(p):return json.loads(Path(p).read_text('utf-8-sig'))
annotations={}
for p in (R/'data/annotations').glob('*.json'):
 try:rows=read(p)
 except Exception:continue
 if not isinstance(rows,list):continue
 for a in rows:
  k=a.get('partId',a.get('componentId'))
  if k:annotations[k]=a
for name in ['native-reviewed-parts.json','native-transferred-parts.json','custom-painting-parts.json','lpw-selective-parts.json','lpw-semantic-owner-parts.json']:
 p=D/name
 if not p.exists():continue
 rows=read(p)
 if not isinstance(rows,list):continue
 for a in rows:
  k=a.get('partId',a.get('componentId'))
  if k:annotations[k]=a
candidates={a['componentId']:a for a in read(D/'lpw-semantic-signature-candidates.json')}
cats={a['id']:a for a in read(D/'category-models.json')if a.get('tier')not in ['hd','de']}
lpw={a['id']:a for a in read(R/'data/lpw-manifest.json')};db=sqlite3.connect(R/'data/research.sqlite');db.executescript('DROP TABLE IF EXISTS models;DROP TABLE IF EXISTS parts;CREATE TABLE models(id TEXT PRIMARY KEY,name TEXT,source TEXT,category TEXT,path TEXT,payload TEXT);CREATE TABLE parts(id TEXT PRIMARY KEY,model TEXT,label TEXT,family TEXT,material TEXT,triangles INTEGER,semantic_status TEXT,payload TEXT);CREATE INDEX part_family ON parts(family);CREATE INDEX part_model ON parts(model);CREATE INDEX part_label ON parts(label);')
modelsOut=gzip.open(D/'models-sd.jsonl.gz','wt',encoding='utf-8');partsOut=gzip.open(D/'parts-sd.jsonl.gz','wt',encoding='utf-8');counts=defaultdict(Counter);families=defaultdict(list)
for i,p in enumerate(sorted((R/'data/parts').glob('*.json'))):
 m=read(p)
 if not is_active_sd(m):continue
 cat=cats.get(m['id'],{});src=m['source'];name=lpw.get(m['id'],{}).get('name')or cat.get('name')or m.get('modelName')or m.get('logicalPath')or m.get('originalFile');a={k:v for k,v in m.items()if k not in ['parts','geosets','file']};a['displayName']=name;a['categoryRecord']=cat;a['dataFile']=f"data/parts/{m['id']}.json";a['capture']=f"captures/models/{m['id']}/index.html";a['semanticCoverage']={'totalComponents':len(m['parts']),'namedComponents':sum(bool(annotations.get(p['id'],{}).get('label'))for p in m['parts'])}
 text=json.dumps(a,separators=(',',':'));modelsOut.write(text+'\n');db.execute('INSERT INTO models VALUES(?,?,?,?,?,?)',(m['id'],name,src,cat.get('category',m['category']),m.get('logicalPath',m.get('originalFile',m.get('path'))),text));counts[src]['models']+=1
 for pi,p in enumerate(m['parts']):
  an=annotations.get(p['id'],{});label=an.get('label');method=an.get('method',an.get('evidence',an.get('certainty','')));transferred=bool(an.get('sourcePartId'))or 'transfer' in str(method).lower();status='matched transfer; target context not independently reviewed'if label and transferred else 'direct visual annotation'if label else 'measured; semantic interpretation pending'
  x={k:v for k,v in p.items()if k not in ['faces0','uv','uvSets','surfacePatches','label','labelStatus']};material=an.get('materialTags',an.get('material'));material=[material]if isinstance(material,str)else material or []
  candidate=candidates.get(p['id'])if not label else None
  x.update(semanticCandidate=candidate,modelId=m['id'],modelName=name,source=src,category=cat.get('category',m['category']),label=label,family=an.get('family'),materials=material,semanticStatus=status,annotationEvidence=an.get('evidence',an.get('certainty',an.get('method'))),annotationConfidence=an.get('confidence',an.get('certainty')),annotationNotes=an.get('notes',an.get('reviewNote')),location=an.get('location'),sourcePartId=an.get('sourcePartId'),textures=sorted(set(t['path']for l in m['geosets'][p['geoset1']-1]['layers']for t in l['textureSlots']if t.get('path'))),uvSummary={k:v for k,v in (p.get('uv')or{}).items()if k!='triangles'},visualEvidence=an.get('visualEvidence')or [f"captures/models/{m['id']}/index.html"])
  text=json.dumps(x,separators=(',',':'));partsOut.write(text+'\n');db.execute('INSERT INTO parts VALUES(?,?,?,?,?,?,?,?)',(p['id'],m['id'],label,an.get('family'),json.dumps(material),p['triangles'],status,text));counts[src]['components']+=1;counts[src]['namedComponents']+=bool(label);counts[src]['directComponents']+=bool(label and not transferred);counts[src]['transferredComponents']+=bool(label and transferred);counts[src]['candidateComponents']+=bool(candidate);counts[src]['unreviewedWithoutCandidate']+=not label and not candidate
  if label and an.get('family'):families[an['family']].append({k:x.get(k)for k in ['id','modelId','modelName','source','label','triangles','vertices','distinctPositions','shapeClass','crossSections','semanticStatus','textures','materials']})
 if(i+1)%250==0:db.commit();print(json.dumps({'models':i+1,'components':sum(c['components']for c in counts.values())}),flush=True)
modelsOut.close();partsOut.close();db.commit();db.close()
familyOut=[]
for key,members in sorted(families.items()):
 vals=sorted(m['triangles']for m in members);familyOut.append({'family':key,'definition':'A semantic family of named connected pieces, not a universal construction rule. Compound assemblies remain explicit in member labels; planar and volumetric forms must be compared separately.','members':members,'componentCount':len(members),'modelCount':len(set(m['modelId']for m in members)),'observedTriangles':{'min':vals[0],'median':vals[len(vals)//2],'max':vals[-1]},'rangeMeaning':'Observed named components, including repetitions and variants; not a recommended budget.'})
(D/'part-families.json').write_text(json.dumps(familyOut,separators=(',',':')),'utf-8')
coverage={'scope':'Active SD study including SD models stored in version1800. Prior Reforged/DE work preserved separately, excluded here.','sources':dict(counts),'families':len(familyOut),'semanticCaution':'Measured coverage is not semantic completion. Direct labels, strict transfers and pending interpretation are counted separately. A physical component may contain several semantic parts or only one piece of an assembly.','geometryPolicy':'Committed exports omit vertex positions, mesh face indices and game texture pixels. UV coordinates, measurements, labels and provenance are derived research outputs.'}
(D/'checkpoint-coverage.json').write_text(json.dumps(coverage,indent=2),'utf-8');print(json.dumps(coverage),flush=True)
