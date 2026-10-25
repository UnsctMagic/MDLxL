"""Exact UV pixel-centre measurements; alpha fractions are not composited team-colour share."""
import json,math,hashlib
from pathlib import Path
import numpy as np
from PIL import Image
R=Path('D:/Codex/sd-research');DOC=R/'repo/docs/SD-RESEARCH/data'
def mask_for(tris,w,h,flags):
 mask=np.zeros((h,w),dtype=bool)
 for tri in tris:
  p=np.array(tri).reshape(3,2)
  if not np.isfinite(p).all():continue
  xs=range(-math.floor(float(p[:,0].max())),-math.floor(float(p[:,0].min()))+1) if flags&1 else [0]
  ys=range(-math.floor(float(p[:,1].max())),-math.floor(float(p[:,1].min()))+1) if flags&2 else [0]
  for ox in xs:
   for oy in ys:
    q=(p+[ox,oy])*[w,h];lo=np.maximum(np.floor(q.min(axis=0)).astype(int),[0,0]);hi=np.minimum(np.ceil(q.max(axis=0)).astype(int),[w,h])
    if (hi<=lo).any():continue
    yy,xx=np.mgrid[lo[1]:hi[1],lo[0]:hi[0]];xx=xx+.5;yy=yy+.5
    sign=[]
    for j in range(3):
     x1,y1=q[j];x2,y2=q[(j+1)%3];sign.append((xx-x1)*(y2-y1)-(yy-y1)*(x2-x1))
    ab=q[1]-q[0];ac=q[2]-q[0];area=ab[0]*ac[1]-ab[1]*ac[0]
    if abs(float(area))<1e-8:continue
    inside=(np.minimum.reduce(sign)>=-1e-8)|(np.maximum.reduce(sign)<=1e-8);mask[lo[1]:hi[1],lo[0]:hi[0]]|=inside
 return mask

custom=json.loads((R/'data/lpw-custom-decode.json').read_text('utf-8'));custommap={(mid,t['path'].lower()):t for t in custom for mid in t['modelIds']}
owner={x['modelId']for x in json.loads((DOC/'lpw-semantic-review-coverage.json').read_text('utf-8'))}
allids=owner|{x[0]for x in custommap};cache={};out=[]
for mid in sorted(allids):
 d=json.loads((R/f'data/parts/{mid}.json').read_text('utf-8'));cm={}
 for p in d['parts']:
  g=d['geosets'][p['geoset1']-1]
  for path in sorted({s['path']for l in g['layers']for s in l['textureSlots']if s['path']}):
   lower=path.lower();customrow=custommap.get((mid,lower));png=R/customrow['png']if customrow else R/('pictures/owner-textures/'+hashlib.sha256(lower.encode()).hexdigest()[:16]+'.png')
   if not png.exists():continue
   if str(png)not in cache:cache[str(png)]=np.array(Image.open(png).convert('RGBA'))
   arr=cache[str(png)];h,w=arr.shape[:2];flags=next(t['flags']for t in d['textures']if t['path'].lower()==lower);mask=mask_for(p['uv']['triangles'],w,h,flags);pix=arr[mask];hist=np.bincount(pix[:,3],minlength=256)if len(pix)else np.zeros(256,dtype=int)
   out.append({'modelId':mid,'componentId':p['id'],'texturePath':path,'sourceKind':'model-specific override'if customrow else 'native reference','dimensions':[w,h],'textureFlags':flags,'mappedPixelCentres':int(mask.sum()),'atlasPixelFraction':round(float(mask.mean()),8),'mappedRgbMean':[round(float(x),2)for x in pix[:,:3].mean(axis=0)]if len(pix)else None,'alphaHistogram':hist.tolist(),'alphaBelow128Fraction':round(float((pix[:,3]<128).mean()),8)if len(pix)else None,'alphaBelow255Fraction':round(float((pix[:,3]<255).mean()),8)if len(pix)else None,'alphaCoverageWeight':round(float((1-pix[:,3]/255).mean()),8)if len(pix)else None,'materialLayers':g['layers'],'visibleAtSample':p['visible'],'sample':d['sample'],'clampedEdgeFootprintOmitted':bool(p['uv']['outsideUnitSquare']and flags!=3),'measurement':'Exact UV triangle union at native pixel centres; repeat only on authored flags. Clamped outside footprints omitted. Histogram and 1-alpha average describe source pixels; actual team-colour contribution depends on layer order, filter/alphaTest, tint, interpolation, lighting and output visibility.'})
 print(mid,len(out),flush=True)
(DOC/'lpw-region-pixel-measurements.json').write_text(json.dumps(out,indent=2),'utf-8')
print('TOTAL',len(out))
