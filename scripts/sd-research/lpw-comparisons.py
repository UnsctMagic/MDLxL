"""Derive controlled LPW comparisons; claims use actual parsed MDX and named catalogue rows."""
import json, statistics, hashlib
from pathlib import Path
from collections import Counter
root=Path('D:/Codex/sd-research');repo=root/'repo';data=repo/'docs/SD-RESEARCH/data';subjects=repo/'docs/SD-RESEARCH/subjects';subjects.mkdir(parents=True,exist_ok=True)
catalogue=json.loads((root/'lowpolyworks/catalogue.json').read_text('utf-8'));parsed={m['id']:json.loads((root/('data/parts/lpw-'+m['id']+'.json')).read_text('utf-8'))for m in catalogue}
def summary(m):
 d=parsed[m['id']];refs={t['path'].lower()for t in d['textures']if t['path']};eye={t for t in refs if 'bnetworkingexp' in t};return {'id':d['id'],'name':m['name'],'triangles':d['triangles'],'sampleVisibleTriangles':d['visibleTriangles'],'sample':d['sample'],'geosets':len(d['geosets']),'textureReferences':len(refs),'eyeAnimationFrameSheets':len(eye),'bytes':d['bytes'],'sequences':len(d['sequences'])}
models=[summary(m)for m in catalogue];(data/'lpw-measured-models.json').write_text(json.dumps(models,indent=2),'utf-8')
pairs=[]
for a,b in [('gluma-135399','gluma-135400'),('gluma-135401','gluma-135402'),('gluma-134840','gluma-134841'),('gluma-134399','gluma-134404'),('gluma-134400','gluma-134402'),('gluma-137328','gluma-137329'),('gluma-140895','gluma-140896'),('gluma-160458','gluma-160459')]:
 x,y=parsed[a],parsed[b];finger=lambda d:Counter((p['triangles'],p['shapeFingerprint'])for p in d['parts']);sx={s['name']for s in x['sequences']};sy={s['name']for s in y['sequences']}
 pairs.append({'a':summary(next(m for m in catalogue if m['id']==a)),'b':summary(next(m for m in catalogue if m['id']==b)),'sameUnorientedComponentGeometryMultiset':finger(x)==finger(y),'onlyASequences':sorted(sx-sy),'onlyBSequences':sorted(sy-sx),'componentFingerprintCaution':'Shape fingerprint ignores material, rig and animation; equality is evidence for shape reuse, not runtime identity.'})
(data/'lpw-controlled-comparisons.json').write_text(json.dumps(pairs,indent=2),'utf-8')
print(json.dumps(pairs,indent=2))