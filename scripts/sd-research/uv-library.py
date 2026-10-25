from research_scope import is_active_sd
"""Searchable measured UV regions. Raster features are 64x64 approximations;
the saved UV triangles, not a bounding box, define every region. No image pixels
are placed in Git. Appearance tags come only from explicit reviewed annotations.
"""
import json,gzip,sqlite3,math,hashlib,sys
from pathlib import Path
from collections import defaultdict
from PIL import Image,ImageDraw,ImageStat
ROOT=Path('D:/Codex/sd-research');DEST=ROOT/'repo/docs/SD-RESEARCH/data';DEST.mkdir(parents=True,exist_ok=True)
N=64
norm=lambda s:str(s).replace('/','\\').lower().split(':')[-1]
stem=lambda s:norm(s).rsplit('.',1)[0]
def read(p):return json.loads(Path(p).read_text('utf-8-sig'))
annotations={}
for p in (ROOT/'data/annotations').glob('*.json'):
 for a in read(p):
  key=a.get('partId',a.get('componentId'));annotations[key]=a
# The complete corrected owner review overrides its earlier Graveguard seed.
for p in [DEST/'lpw-semantic-graveguard.json',DEST/'lpw-selective-parts.json',DEST/'lpw-semantic-owner-parts.json']:
 if p.exists():
  for a in read(p):annotations[a.get('partId',a.get('componentId'))]=a
colourFile=DEST/'lpw-authored-colours.json'
authoredColours={(x['modelId'],x['geoset1']):x for x in read(colourFile)}if colourFile.exists()else {}
native=read(ROOT/'data/native-textures.json');lookup=defaultdict(list)
for t in native:
 if t.get('tier')!='sd':continue
 for a in t.get('aliases',[t['path']]):lookup[stem(a)].append(t)
for k in lookup:lookup[k].sort(key=lambda t:(t['path'].count('.w3mod:'),t['path']))
owner=read(DEST/'lpw-owner-material-sheets.json');ownerStems={stem(x['texturePath'])for x in owner}
# Explicit same-paint aliases established by the LPW decoded RGBA review.
ownerAlias=defaultdict(set)
for t in owner:ownerAlias[t['decodedRgbaSha256']].add(stem(t['texturePath']))
canonical={s:sorted(v)[0]for v in ownerAlias.values()for s in v}
canon=lambda s:canonical.get(stem(s),stem(s))
ownerCanonical={canon(x) for x in ownerStems}
ownerModels={x for o in owner for x in o['sourceModels']}
texCache={}
def image_for(tid):
 if tid in texCache:return texCache[tid]
 f=ROOT/'captures/textures'/f'{tid}.webp';j=Path(str(f)+'.json')
 if not f.exists() and j.exists():
  meta=read(j);f=ROOT/'captures/textures'/meta.get('previewFile',f.name)
 if not f.exists():return None
 im=Image.open(f).convert('RGBA').resize((N,N),Image.Resampling.BOX)
 if len(texCache)>250:texCache.pop(next(iter(texCache)))
 texCache[tid]=im;return im

def mask_uv(tris,flags):
 im=Image.new('1',(N,N));draw=ImageDraw.Draw(im);limited=False
 for tri in tris:
  if len(tri)!=6:continue
  xs=tri[0::2];ys=tri[1::2]
  if any(not math.isfinite(v)for v in tri):continue
  if abs((xs[1]-xs[0])*(ys[2]-ys[0])-(ys[1]-ys[0])*(xs[2]-xs[0]))<1e-10:continue
  # Translating a wrapped triangle intersects only its real repeated paint,
  # never a guessed safe rectangle. PIL clips polygons to the sheet edge.
  rx=range(math.floor(min(xs)),math.floor(max(xs))+1)if flags&1 else [0]
  ry=range(math.floor(min(ys)),math.floor(max(ys))+1)if flags&2 else [0]
  if len(rx)*len(ry)>256:limited=True;continue
  for dx in rx:
   for dy in ry:draw.polygon([((xs[i]-dx)*(N-1),(ys[i]-dy)*(N-1))for i in range(3)],fill=1)
 b=im.tobytes();return im,int.from_bytes(b,'big'),limited

def feature(im,mask):
 if im is None:return None
 count=mask.histogram()[255]
 if not count:return None
 st=ImageStat.Stat(im,mask.convert('L'));rgb=im.convert('RGB').quantize(colors=8,method=Image.Quantize.MEDIANCUT)
 hist=rgb.histogram(mask.convert('L'));palette=rgb.getpalette();top=sorted(enumerate(hist),key=lambda z:z[1],reverse=True)[:5]
 return {'sampleResolution':[N,N],'sampledPixels':count,'meanRGBA':[round(v,2)for v in st.mean],'palette':[{'rgb':palette[i*3:i*3+3],'share':round(n/count,5)}for i,n in top if n]}

db=sqlite3.connect(ROOT/'data/uv-library.sqlite');db.executescript('DROP TABLE IF EXISTS regions;CREATE TABLE regions(id TEXT PRIMARY KEY, model TEXT, part TEXT, sheet TEXT, label TEXT, material TEXT, triangles INTEGER, coverage REAL, payload TEXT);CREATE INDEX region_sheet ON regions(sheet);CREATE INDEX region_label ON regions(label);')
origins=defaultdict(list);targets=[];counts=defaultdict(int);missing=set();out=gzip.open(DEST/'uv-regions-sd.jsonl.gz','wt',encoding='utf-8',compresslevel=6)
files=sorted((ROOT/'data/parts').glob('*.json'))
for fi,f in enumerate(files):
 d=read(f)
 if not is_active_sd(d):continue
 capf=ROOT/'captures/models'/d['id']/'capture.json';cap=read(capf)if capf.exists()else {};sheetMap={stem(s['name']):s for s in cap.get('sheets',[])}
 for p in d['parts']:
  uv=p.get('uv');a=annotations.get(p['id'],{});seen=set();uvBySet={u['set']:u for u in p.get('uvSets',[]) if u}
  if uv:uvBySet[uv['set']]=uv
  if not uv:continue
  for layer in d['geosets'][p['geoset1']-1]['layers']:
   for slot in layer['textureSlots']:
    if slot['slot']!='TextureID':continue
    tids=[slot['texture0']] if isinstance(slot['texture0'],(int,float)) else list(slot['texture0'].values()) if isinstance(slot['texture0'],dict) else slot['texture0']
    if slot.get('animated'):
     for key in (slot.get('track')or{}).get('Keys',[]):
      val=key.get('Vector',[]);tids.extend(val if isinstance(val,list) else list(val.values()) if isinstance(val,dict) else [val])
    for ti in dict.fromkeys(tids):
     if not isinstance(ti,(int,float))or not 0<=int(ti)<len(d['textures']):continue
     t=d['textures'][int(ti)];name=t['path']
     if not name:continue
     key=(name,t.get('flags',0),layer.get('coordId',0))
     if key in seen:continue
     seen.add(key)
     uv=uvBySet.get(layer.get('coordId',0))
     if uv is None:
      counts['unmeasuredAlternateUvSet']+=1;continue
     sm=sheetMap.get(stem(name));nt=(lookup.get(stem(name))or[None])[0];tid=sm.get('id')if sm else nt['id']if nt else None
     im=image_for(tid)if tid else None
     if im is None:missing.add((d['id'],name))
     mask,bits,limited=mask_uv(uv['triangles'],int(t.get('flags') or 0));pixels=bits.bit_count();cov=pixels/(N*N)
     label=a.get('label');material=a.get('materialTags',a.get('material',[]));material=[material]if isinstance(material,str)else material
     rid=p['id']+':texture'+str(ti)+':uv'+str(uv['set'])
     r={'id':rid,'modelId':d['id'],'modelPath':d.get('logicalPath',d.get('originalFile',d.get('path'))),'source':d['source'],'partId':p['id'],'geoset1':p['geoset1'],'component1':p['component1'],'texturePath':name,'resolvedTextureId':tid,'textureIdentityEvidence':'capture resolver'if sm else 'native logical stem'if nt else 'unresolved','textureContentHash':sm.get('contentHash')if sm else nt.get('sha256')if nt else None,'textureFlags':t.get('flags',0),'uvSet':uv['set'],'uvTriangles':uv['triangles'],'uvBounds':uv['bounds'],'outsideUnitSquare':uv['outsideUnitSquare'],'sampledCoverage64':round(cov,6),'samplingLimited':limited,'clampedEdgeFootprintOmitted':any((not int(t.get('flags')or 0)&(1<<axis))and (uv['bounds'][axis]<0 or uv['bounds'][axis+2]>1)for axis in range(2)),'label':label,'semanticStatus':'reviewed annotation'if label else 'not yet visually named','materialTags':material,'tagScope':'rendered part appearance'if material else None,'authoredColour':a.get('authoredColour',authoredColours.get((d['id'],p['geoset1']))),'visibleAtSample':p.get('visible'),'sample':d.get('sample'),'materialLayers':d['geosets'][p['geoset1']-1]['layers'],'geosetAlphaAtSample':d['geosets'][p['geoset1']-1].get('alpha'),'appearanceMeaning':'appearance64 samples source texture pixels; materialTags describe the reviewed rendered part. Tint, team colour, material layers and lighting can change its final appearance.','annotationEvidence':a.get('evidence',a.get('method')),'appearance64':feature(im,mask),'meshTriangles':p['triangles'],'image':f'captures/textures/{tid}.webp'if tid else None}
     out.write(json.dumps(r,separators=(',',':'))+'\n');db.execute('INSERT OR REPLACE INTO regions VALUES(?,?,?,?,?,?,?,?,?)',(rid,d['id'],p['id'],canon(name),label,json.dumps(material),p['triangles'],cov,json.dumps(r,separators=(',',':'))));counts['regions']+=1;counts['namedRegions']+=bool(label)
     if canon(name)in ownerCanonical and pixels:
      ref={'modelId':d['id'],'modelPath':r['modelPath'],'partId':p['id'],'geoset1':p['geoset1'],'component1':p['component1'],'label':label,'triangles':p['triangles'],'bits':bits,'pixels':pixels,'texturePath':name,'textureContentHash':r['textureContentHash'],'textureIdentityEvidence':r['textureIdentityEvidence'],'clampedEdgeFootprintOmitted':r['clampedEdgeFootprintOmitted']}
      if d['source']=='blizzard':origins[canon(name)].append(ref)
      elif d['source']=='lowpolyworks'and d['id']in ownerModels:targets.append(ref)
 counts['models']+=1
 if(fi+1)%100==0:db.commit();print(json.dumps({'models':fi+1,'regions':counts['regions'],'named':counts['namedRegions']}),flush=True)
out.close();db.commit();db.close()
# UV overlap locates common paint. It does not assert copied geometry or meaning.
reuses=[]
for t in targets:
 ranked=[]
 for s in origins[canon(t['texturePath'])]:
  intersection=(t['bits']&s['bits']).bit_count()
  if intersection/t['pixels']<.3:continue
  ranked.append((intersection/t['pixels'],intersection/s['pixels'],s))
 ranked.sort(key=lambda x:(-x[0],-x[1],x[2]['triangles']))
 candidates=[]
 for shared,sourceShare,s in ranked[:12]:candidates.append({k:v for k,v in s.items()if k not in ('bits','pixels')}|{'targetPaintCovered':round(shared,5),'sourcePaintUsed':round(sourceShare,5),'paintIdentityStatus':'same resolved source bytes'if t.get('textureContentHash')and t['textureContentHash']==s.get('textureContentHash')and t['textureIdentityEvidence']==s['textureIdentityEvidence']=='capture resolver'else 'logical path or reviewed LPW alias only; native/target pixel equivalence not yet verified'})
 reuses.append({k:v for k,v in t.items()if k not in ('bits','pixels')}|{'originalRegionCandidates':candidates,'method':'64x64 raster union of real UV triangles, wrap flags respected; same logical sheet/explicit decoded-paint aliases','caution':'64x64 overlap is approximate candidate ranking, not full-resolution area or geometry provenance. Original meaning requires source component vision. Only same resolved source bytes proves cross-corpus texture identity here; logical .blp/.dds or module stems may differ in paint. Repeated or mirrored parts can overlap the same pixels. Clamped outside footprints are omitted and flagged.'})
with gzip.open(DEST/'uv-repurposing-candidates.jsonl.gz','wt',encoding='utf-8')as z:
 for r in reuses:z.write(json.dumps(r,separators=(',',':'))+'\n')
counts['ownerReuseRegions']=len(reuses);counts['nativePaintCandidates']=sum(map(len,origins.values()));counts['missingRegionImages']=len(missing)
(DEST/'uv-library-coverage.json').write_text(json.dumps(dict(counts),indent=2));(ROOT/'data/uv-library-missing-images.json').write_text(json.dumps(sorted(missing),indent=2));print(json.dumps(dict(counts)),flush=True)