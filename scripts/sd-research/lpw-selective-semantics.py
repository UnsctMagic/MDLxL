"""Selective additional LPW component review; no assertion of full non-owner coverage."""
import json,ast
from pathlib import Path
R=Path('D:/Codex/sd-research');DOC=R/'repo/docs/SD-RESEARCH/data'
source=(Path(__file__).parent/'lpw-owner-semantics.py').read_text('utf-8');node=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef)and n.name=='family');exec(compile(ast.Module(body=[node],type_ignores=[]),'<family>','exec'))
manual={
'lpw-gluma-134398':{1:['connected head and neck','right foot and painted claws','lower tooth strip','left foot and painted claws','mouth lining','upper right tooth card','upper left tooth card','upper front tooth strip','left front fang','right front fang'],2:['connected torso legs and long tail','left arm and hand','right arm and hand','left eyeball','right eyeball','head crest membrane','back spine 1','back spine 2','back spine 3'],3:['corpse skull','corpse rib card','corpse right hand card','corpse left hand card','corpse limb card 1','corpse limb card 2','corpse limb card 3','corpse limb card 4','corpse hand card 3','corpse hand card 4','corpse flesh card 1','corpse flesh card 2','corpse flesh card 3','corpse flesh card 4','corpse flesh card 5'],4:['complete spear with shaft grip and head'],5:['elongating tongue assembly'],6:['animation effect card'],7:['portrait backdrop plane'],8:['left closed eyelid','right closed eyelid']},
'lpw-gluma-145021':{1:['muzzle glow card'],2:['ammunition shell'],3:['ammunition casing'],4:['shockwave effect card'],5:['rear carriage ring card','front left carriage ring card','front right carriage ring card','left adjustment wheel card','rear gold housing','left carriage frame','lower curved carriage block','rear axle','front axle','right carriage frame','left barrel support','right barrel support','large side gear card','complete cannon barrel','breech locking fitting','rear lever card','rear lever knob','breech end cap','small side gear card','front right wheel','front left wheel','rear right wheel','rear left wheel'],6:['left front heraldic plaque','left rear heraldic plaque','right front heraldic plaque','right rear heraldic plaque'],7:['muzzle flash card 1','muzzle flash card 2','muzzle flash card 3'],8:['hidden ground effect card','portrait backdrop plane']}}
rows=[]
for mid,groups in manual.items():
 d=json.loads((R/f'data/parts/{mid}.json').read_text('utf-8'));cap=json.loads((R/f'captures/models/{mid}/capture.json').read_text('utf-8'))
 for p in d['parts']:
  g,c=p['geoset1'],p['component1'];label=groups[g][c-1];geo=d['geosets'][g-1];pic=next(x for x in cap['components']if x['id']==p['id']);paths=sorted({s['path']for l in geo['layers']for s in l['textureSlots']if s['path']});tags=[];certainty='high'
  if mid.endswith('134398'):
   tags=['blue scales']if g in (1,2,8) else ['pale bone','red flesh']if g==3 else ['brown wood','gold spearhead','red wrapped grip']if g==4 else ['red flesh']if g==5 else ['effect']
   if g==1 and c in (3,6,7,8,9,10):tags=['pale teeth','red gums']
   if g==1 and c==5:tags=['red mouth','blue lip edge']
   if g==2 and c in (4,5):tags=['gold yellow eye']
   if g==2 and c>=6:tags=['red membrane','blue rim']
   if g==6:certainty='low: flat geometry visible only as negligible sample; precise animation purpose unreviewed'
  else:
   tags=['dark iron','silver edge','gold trim']if g==5 else ['gold metal']if g in (2,3)else ['red heraldry','gold trim']if g==6 else ['effect']
   if g==5 and c in (5,15,16,17,18):tags=['gold metal','bright painted highlight']
   if g==5 and c in (5,7,15,17):certainty='medium: component geometry and location clear; mechanical sub-part name probable'
  rows.append({'modelId':mid,'componentId':p['id'],'geoset1':g,'component1':c,'label':label,'family':family(label),'materialTags':tags,'method':'direct visual review','certainty':certainty,'triangles':p['triangles'],'vertices':p['vertices'],'visibleAtSample':p['visible'],'sample':d['sample'],'sourceTexturePaths':paths,'uvBounds':p['uv']['bounds'],'uvTriangles':p['uv']['triangles'],'posedBounds':p['posedBounds'],'boneNamesSupportingLocation':[b['name']for b in p['bones']],'visualEvidence':[f'captures/models/{mid}/{pic[k]}'for k in ('file','sideFile','contextFile')],'reviewNote':'Complete connected components reviewed at two fitted angles; hidden animation pieces retained, compound assemblies not artificially split.'})
(DOC/'lpw-selective-parts.json').write_text(json.dumps(rows,indent=2),'utf-8')
print('direct additional components',len(rows))
