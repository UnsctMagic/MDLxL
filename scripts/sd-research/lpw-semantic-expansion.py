"""Conservative additional semantic candidates, separated from direct visual labels."""
import json,hashlib,ast
from pathlib import Path
from collections import defaultdict,Counter
R=Path('D:/Codex/sd-research');D=R/'repo/docs/SD-RESEARCH/data';cache={}
source=(Path(__file__).parent/'lpw-owner-semantics.py').read_text('utf-8');node=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef)and n.name=='family');exec(compile(ast.Module(body=[node],type_ignores=[]),'<family>','exec'))
def model(mid):
 if mid not in cache:cache[mid]=json.loads((R/f'data/parts/{mid}.json').read_text('utf-8'))
 return cache[mid]
def sig(p):
 uv=sorted(sorted([(t[0],t[1]),(t[2],t[3]),(t[4],t[5])])for t in p['uv']['triangles'])
 return hashlib.sha256(json.dumps([p['orientedShapeFingerprint'],p['triangles'],p['vertices'],uv],separators=(',',':')).encode()).hexdigest()
owner=json.loads((D/'lpw-semantic-owner-parts.json').read_text('utf-8'));extra=json.loads((D/'custom-painting-parts.json').read_text('utf-8'))+json.loads((D/'lpw-selective-parts.json').read_text('utf-8'));native=json.loads((D/'native-reviewed-parts.json').read_text('utf-8'));idx=defaultdict(list)
for s in owner+extra+native:
 pid=s.get('componentId',s.get('partId'));p=next(x for x in model(s['modelId'])['parts']if x['id']==pid);idx[sig(p)].append(s)
known={s.get('componentId',s.get('partId'))for s in owner+extra};result=[];coverage=[]
for m in json.loads((R/'data/lpw-manifest.json').read_text('utf-8')):
 d=model(m['id']);n=0
 for p in d['parts']:
  if p['id']in known:continue
  ss=idx[sig(p)]
  if not ss or len({x['label']for x in ss})!=1:continue
  s=ss[0];g=d['geosets'][p['geoset1']-1];label=s['label'];n+=1
  result.append({'modelId':m['id'],'componentId':p['id'],'geoset1':p['geoset1'],'component1':p['component1'],'label':label,'family':family(label),'method':'normalized point-set and exact UV footprint signature transfer','certainty':'inferred role; assembly context not directly re-reviewed','sourceReviewedComponent':s.get('componentId',s.get('partId')),'sourceReviewedModel':s['modelId'],'sourceLabel':s['label'],'triangles':p['triangles'],'vertices':p['vertices'],'visibleAtSample':p['visible'],'sample':d['sample'],'sourceTexturePaths':sorted({t['path']for l in g['layers']for t in l['textureSlots']if t['path']}),'materialTags':[],'notes':'Shape matches the measured normalized point-set fingerprint, face/vertex counts and canonical exact UV triangles. This is a semantic candidate, not proof of historical provenance; source material colours are not transferred. Source and destination are preserved for review.'})
 coverage.append({'modelId':m['id'],'name':m['name'],'components':len(d['parts']),'directlyReviewed':sum(x['modelId']==m['id']for x in owner+extra),'signatureInferred':n,'unreviewed':len(d['parts'])-sum(x['modelId']==m['id']for x in owner+extra)-n})
(D/'lpw-semantic-signature-candidates.json').write_text(json.dumps(result,indent=2),'utf-8');(D/'lpw-all-semantic-coverage.json').write_text(json.dumps(coverage,indent=2),'utf-8')
print(json.dumps({'models':len(coverage),'components':sum(x['components']for x in coverage),'direct':sum(x['directlyReviewed']for x in coverage),'inferred':len(result),'unreviewed':sum(x['unreviewed']for x in coverage)}))
