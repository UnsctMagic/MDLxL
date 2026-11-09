import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { allNodes, NODE_COLLECTION_KEYS } from '../../src/animation.js';
import { openDocument } from '../../src/editor-document.js';
const { testModel } = createRequire(import.meta.url)('./fixtures.cjs');

// Ground truth belongs to the tests, never the runtime recognizer. These joints
// are the anatomical endpoints in the supplied rig, independent of its spelling.
// Necrarch 95 has only child 8 and exactly the same skinned head subtree (area
// 1825.09170149); its pivot is the skull/neck base, whereas 8 is inside the skull.
// Both are legitimate head joints, but their native transforms are not equivalent.
// The 95 handle stays within 0.509 model units of the skinned head center across
// every clip start/middle/end. One head only is required, and child 8's authored
// local animation must remain intact when controlling 95.
const limb = (kind, middle, ...ends) => ({ kind, middle, ends });
export const realAnatomyCases = [
  // Distinct authored corpse/flying-death dragon: the wing wrist is before its
  // finger fan; distal fingers alone cannot replace the complete wing chain.
  { key:'corpse-vampire-dragon', file:'corpse-fixtures/VampireDragon_Corpse_FlyingDeath.mdx', limbs:[limb('wing',7,8),limb('wing',21,22),limb('leg',52,53),limb('leg',55,56),limb('arm',61,62),limb('arm',65,66),limb('leg',39,40,41),limb('leg',43,44,45)], heads:[36,70], exactHeadCount:true, exactBody:0, forbiddenControlIds:[67,68,69,75,77,78,79,80,81,82,...Array.from({length:84},(_,i)=>i+83)], forbiddenChains:[67,68,69,75,77,78,79,80,81,82,...Array.from({length:84},(_,i)=>i+83)] },
  // Four independently skinned arms: the lower pair is not a leg pair.
  { key:'naga-siren-four-arms', file:'corpus-sd/naga__nagasiren.mdx', limbs:[limb('arm',44,45),limb('arm',49,50),limb('arm',58,59),limb('arm',62,63)], heads:[53], exactHeadCount:true, requiredRoles:{Tail:[37]}, exactRoleCounts:{Tail:1}, forbiddenControlIds:[54,55,56,64,65,66,67], forbiddenChains:[54,55,56,64,65,66,67] },
  { key:'great-uco', file:'pose-complex-fixtures/WH_DOC_GreatUCO4.mdx', limbs:[limb('leg',63,64),limb('leg',66,67),limb('arm',70,71),limb('arm',73,74)], heads:[75], exactHeadCount:true, forbiddenChains:[22,24], forbidden:[22,24,27] },
  { key:'dense-twin-rider', file:'pose-performance/GnomeLindormrRider_TwinHeads_FaceAlphaWrap.mdx', limbs:[limb('leg',54,56),limb('leg',55,57),limb('arm',64,67),limb('arm',65,66),limb('leg',152,154),limb('leg',156,158),limb('wing',120,121),limb('wing',134,135)], heads:[72,103,109], exactHeadCount:true, forbiddenChains:[68,69,70,87,88,89,90,91], forbidden:[68,69,70,87,88,89,90,91,147,148,149,150] },
  { key: 'lahmian', file: 'pose-anatomy/Lahmian_Vampire_Death_Fix5.mdx', limbs: [limb('arm',12,13),limb('arm',11,14),limb('leg',7,5),limb('leg',8,6)], heads:[0], exactHeadCount:true, forbidden:[47], central:[18] },
  { key: 'footman', file: 'pose/Footman.mdx', limbs: [limb('arm',37,38),limb('arm',35,42),limb('leg',28,29),limb('leg',31,32)], heads:[39], exactHeadCount:true },
  { key: 'horse', file: 'corpus-sd/critters__packhorse.mdx', limbs:[limb('leg',34,36),limb('leg',38,40),limb('leg',45,47),limb('leg',49,51)], heads:[42], exactHeadCount:true },
  { key: 'rider', file: 'pose/Knight.mdx', limbs:[limb('arm',175,176),limb('arm',178,179),limb('arm',142,143),limb('arm',145,146),limb('leg',120,122),limb('leg',124,126),limb('leg',131,133),limb('leg',135,137),limb('leg',153,155),limb('leg',157,159),limb('leg',164,166),limb('leg',168,170),limb('leg',148,68),limb('leg',149,70),limb('leg',181,110),limb('leg',182,112)], heads:[128,147,161,180], exactHeadCount:true },
  { key: 'vampire-dragon', file: 'pose-complex-fixtures/Current_VampireDragon.mdx', limbs:[limb('arm',61,62),limb('arm',65,66),limb('leg',52,53),limb('leg',55,56),limb('leg',219,221),limb('leg',223,225),limb('wing',187,188),limb('wing',201,202)], heads:[75,216], exactHeadCount:true },
  { key: 'hydra', file:'corpus-sd/creeps__hydra.mdx', limbs:[limb('leg',39,40,41),limb('leg',44,45,46)], heads:[52,59,66], exactHeadCount:true },
  { key: 'ogre', file:'corpus-sd/creeps__ogre.mdx', limbs:[limb('leg',31,32),limb('leg',34,35),limb('arm',38,39),limb('arm',41,42)], heads:[43,44], exactHeadCount:true },
  { key: 'chimaera', file:'corpus-sd/nightelf__chimaera.mdx', limbs:[limb('leg',44,45,46),limb('leg',48,49,50),limb('wing',53,54,55),limb('wing',57,58,59)], heads:[62,67], exactHeadCount:true },
  { key: 'red-dragon', file:'corpus-sd/creeps__reddragon.mdx', limbs:[limb('leg',48,49),limb('leg',51,52),limb('leg',55,56),limb('leg',58,59),limb('wing',39,40),limb('wing',42,43)], heads:[46], exactHeadCount:true },
  { key: 'flail', file:'pose-flail/Fx_original.mdx', limbs:[limb('arm',7,8),limb('arm',10,11),limb('leg',3,15),limb('leg',5,16)], heads:[12], exactHeadCount:true, forbidden:[21,23] },
  { key: 'necrarch', file:'pose-complex-fixtures/WH_VC_NecrarchLord3.mdx', limbs:[limb('arm',3,4),limb('arm',6,7)], heads:[8], headAlternatives:{8:[95]}, exactHeadCount:true },
  { key: 'kurgan', file:'pose-complex-fixtures/WH_WOC_KurganWarlord02.mdx', limbs:[limb('arm',5,6),limb('arm',9,10),limb('leg',15,16),limb('leg',18,19)], heads:[12], exactHeadCount:true },
];
// Native proximal joints, checked against authored pivots and limb hierarchy.
// A matching wrist alone must not permit borrowing clavicle, armor or trunk joints.
const establishedRoots={'corpse-vampire-dragon':[6,20,51,54,60,64,38,42],'naga-siren-four-arms':[43,48,57,61],'lahmian':[15,16,9,10],'footman':[36,34,27,30],'kurgan':[4,8,14,17],'dense-twin-rider':[52,53,62,63,151,155,119,133],'great-uco':[62,65,69,72]};
for(const spec of realAnatomyCases)if(establishedRoots[spec.key])spec.limbs.forEach((limb,i)=>limb.roots=[establishedRoots[spec.key][i]]);
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function loadAnatomyCase(spec) {
  const file=testModel(spec.file); assert.ok(fs.existsSync(file),`Required supplied fixture is missing: ${file}`);
  const bytes=fs.readFileSync(file),model=openDocument(bytes).model;
  return {model,file,sha256:hash(bytes)};
}
function shuffled(values,seed=37){const out=[...values];let s=seed>>>0;for(let i=out.length-1;i>0;i--){s=(1664525*s+1013904223)>>>0;const j=s%(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;}
export const nameVariants = ['original','anonymous','scrambled','misleading','remapped'];
export function challengeNames(input,mode,seed=37){
  const model=structuredClone(input),nodes=allNodes(model),names=shuffled(nodes.map(n=>n.Name),seed);
  const deceptive=['Hair_Rear_Root','Weapon_Head','Pelvis','Hand','Foot','Wing','Chest','Hip_R'];
  nodes.forEach((node,i)=>{if(mode==='anonymous')node.Name='';else if(mode==='remapped')node.Name='item_'+((i*7919+seed)%100003);else if(mode==='scrambled')node.Name=names[i];else if(mode==='misleading')node.Name=deceptive[(i+seed)%deceptive.length]+'_'+i;});
  if(mode!=='original'){
    if(model.Info)model.Info.Name=mode==='anonymous'?'':'unrelated_'+seed;
    model.Sequences?.forEach((seq,i)=>seq.Name=mode==='anonymous'?'':'clip_'+i);
    for(const collection of NODE_COLLECTION_KEYS)if(collection!=='Nodes'&&model[collection])model[collection]=shuffled(model[collection],seed+collection.length);
    // Nodes is a derived ObjectId-indexed cache, not an ordered native collection.
    // Keep it valid while permuting the authoritative collections and, separately, IDs.
    model.Nodes=[];for(const node of nodes)model.Nodes[node.ObjectId]=node;
  }
  return model;
}

export function challengeCase(input,spec,mode,seed=37){
 const model=challengeNames(input,mode,seed),expected=structuredClone(spec);expected.exactLimbCount=true;
 if(spec.key==='lahmian'){const accessories=allNodes(input).filter(n=>/^(?:Cloth|Hair|VampBat|Spear|Vampire_Bat)/.test(n.Name)).map(n=>n.ObjectId);expected.forbiddenChains=accessories;expected.forbiddenControlIds=accessories;}
 if(mode==='remapped'){
  const nodes=allNodes(model),ids=nodes.map(n=>n.ObjectId),mapping=new Map();
  // Keep HD's byte-sized IDs representable while permuting all native IDs.
  for(const group of [ids.filter(id=>id<256),ids.filter(id=>id>=256)]){const shuffledIds=shuffled(group,seed+group.length);group.forEach((id,i)=>mapping.set(id,shuffledIds[i]));}
  const mapped=id=>mapping.get(id)??id,points=[];
  for(const node of nodes){const oldId=node.ObjectId;node.ObjectId=mapped(oldId);if(node.Parent!=null&&node.Parent>=0)node.Parent=mapped(node.Parent);points[node.ObjectId]=node.PivotPoint||model.PivotPoints?.[oldId];}
  model.PivotPoints=points;model.Nodes=[];for(const node of nodes)model.Nodes[node.ObjectId]=node;
  for(const geo of model.Geosets||[]){geo.Groups=geo.Groups?.map(group=>Array.from(group,mapped));if(geo.SkinWeights?.length===geo.Vertices.length/3*8)for(let at=0;at<geo.SkinWeights.length;at+=8)for(let slot=0;slot<4;slot++)if(geo.SkinWeights[at+4+slot])geo.SkinWeights[at+slot]=mapped(geo.SkinWeights[at+slot]);}
  for(const bind of model.BindPoses||[]){const matrices=[];bind.Matrices?.forEach((matrix,id)=>matrices[mapped(id)]=matrix);bind.Matrices=matrices;}
  expected.limbs=expected.limbs.map(l=>({...l,middle:mapped(l.middle),ends:l.ends.map(mapped),...(l.roots?{roots:l.roots.map(mapped)}:{})}));
  for(const field of ['heads','forbidden','forbiddenChains','forbiddenControlIds','central'])if(expected[field])expected[field]=expected[field].map(mapped);
  if(expected.requiredRoles)expected.requiredRoles=Object.fromEntries(Object.entries(expected.requiredRoles).map(([role,ids])=>[role,ids.map(mapped)]));
  if(expected.appendages)expected.appendages=expected.appendages.map(a=>({...a,nodes:a.nodes.map(mapped),chainIds:a.chainIds.map(mapped)}));
  if(expected.exactBody!=null)expected.exactBody=mapped(expected.exactBody);
  if(expected.semanticRoles)expected.semanticRoles=Object.fromEntries(Object.entries(expected.semanticRoles).map(([id,roles])=>[mapped(Number(id)),roles]));
  if(expected.headAlternatives)expected.headAlternatives=Object.fromEntries(Object.entries(expected.headAlternatives).map(([id,alternatives])=>[mapped(Number(id)),alternatives.map(mapped)]));
 }
 return {model,expected};
}

export function anatomicalMapping(model,rig,pose){
 const nodes=allNodes(model),byId=new Map(nodes.map(n=>[n.ObjectId,n]));
 return {body:rig.body,chains:rig.chains.map(c=>({ids:pose.poseChainIds(c),kind:c.label==='Wing'||pose.poseRole(model,rig,c.end)==='Wing'?'wing':c.label==='Chain'?'chain':c.kind,end:c.end,label:c.label})),heads:rig.nodes.filter(id=>pose.poseRole(model,rig,id)==='Head'),controls:rig.nodes.map(id=>({id,role:pose.poseRole(model,rig,id),name:byId.get(id)?.Name}))};
}
export function anatomyProblems(model,rig,spec,pose){
 const map=anatomicalMapping(model,rig,pose),problems=[];
 const appendageChains=new Set();for(const part of spec.appendages||[]){const matched=map.chains.filter(c=>c.kind===part.role.toLowerCase()&&c.ids.every(id=>part.chainIds.includes(id)));matched.forEach(c=>appendageChains.add(c));const direct=map.controls.filter(c=>c.role===part.role&&part.nodes.includes(c.id));if(!matched.length&&!direct.length)problems.push(`missing ${part.role} region ${part.chainIds.join('/')}`);if(matched.length>1)problems.push(`duplicate ${part.role} chains in region ${part.chainIds.join('/')}`);}
 if(spec.exactLimbCount && map.chains.filter(c=>c.label!=='Tail'&&!appendageChains.has(c)).length!==spec.limbs.length)problems.push(`limb count ${map.chains.length}, expected ${spec.limbs.length}`);
 for(const id of spec.forbiddenControlIds||[])if(map.controls.some(c=>c.id===id)||rig.body===id)problems.push(`accessory joint ${id} has an anatomical control`);
 if(spec.noPartControls&&rig.nodes.length)problems.push(`non-anatomical object exposes ${rig.nodes.length} body-part controls`);
 for(const [role,ids] of Object.entries(spec.requiredRoles||{}))for(const id of ids)if(!map.controls.some(c=>c.id===id&&c.role===role)&&!map.chains.some(c=>c.end===id&&pose.poseRole(model,rig,id)===role))problems.push(`missing ${role} control ${id}`);
 for(const [role,count] of Object.entries(spec.exactRoleCounts||{})){const ids=new Set([...map.controls.filter(c=>c.role===role).map(c=>c.id),...map.chains.filter(c=>pose.poseRole(model,rig,c.end)===role).map(c=>c.end)]);if(ids.size!==count)problems.push(`${role} control count ${ids.size}, expected ${count}`);}
 for(const id of spec.forbiddenChains||[])if(map.chains.some(c=>c.ids.includes(id)))problems.push(`accessory joint ${id} included in anatomical limb`);
 for(const limb of spec.limbs){const c=map.chains.find(c=>c.kind===limb.kind&&limb.ends.includes(c.end)&&c.ids.includes(limb.middle)&&(!limb.roots||limb.roots.includes(c.ids[0])));if(!c)problems.push(`missing ${limb.kind}${limb.roots?' from '+limb.roots.join('/'):''} through ${limb.middle} to ${limb.ends.join('/')}`);}
 for(const id of spec.heads){const candidates=[id,...(spec.headAlternatives?.[id]||[])];if(!candidates.some(candidate=>map.heads.includes(candidate)))problems.push(`missing head ${candidates.join('/')}`);}
 if(spec.exactHeadCount&&map.heads.length!==spec.heads.length)problems.push(`head count ${map.heads.length}, expected ${spec.heads.length}`);
 for(const id of spec.forbidden||[])if(map.controls.some(c=>c.id===id&&['Head','Body','Chest','Pelvis'].includes(c.role))||rig.body===id)problems.push(`accessory ${id} classified as body part`);
 for(const id of spec.central||[])if(!map.controls.some(c=>c.id===id&&['Body','Pelvis'].includes(c.role))&&rig.body!==id)problems.push(`missing central waist/pelvis ${id}`);
 if(spec.exactBody!=null&&rig.body!==spec.exactBody)problems.push(`body ${rig.body}, expected ${spec.exactBody}`);
 for(const [id,allowed] of Object.entries(spec.semanticRoles||{})){const role=pose.poseRole(model,rig,Number(id));if(!allowed.includes(role))problems.push(`joint ${id} has role ${role}, expected ${allowed.join('/')}`);}
 const byId=new Map(allNodes(model).map(n=>[n.ObjectId,n]));
 for(const c of rig.chains){const ids=pose.poseChainIds(c);if(ids.some(id=>!byId.has(id)))problems.push(`chain uses missing joint: ${ids}`);}
 return problems;
}

// Fully skinned analytical fixtures complement (never replace) the real models.
// Surfaces are closed, three-dimensional and bound along actual limb joints.
export function analyticalRig({arms=2,heads=1,armScale=1,legScale=1,animated=true,wings=false,asymmetric=false}={}){
 const model={Info:{Name:'Analytical rig'},Version:800,Bones:[],Helpers:[],Attachments:[],PivotPoints:[],Sequences:[{Name:'Clip',Interval:[0,100]}],GlobalSequences:[],Geosets:[],GeosetAnims:[]},expected={limbs:[],heads:[],exactHeadCount:true,exactLimbCount:true};
 const add=(name,parent,pivot)=>{const id=model.Bones.length,n={ObjectId:id,Name:name,Parent:parent,PivotPoint:Float32Array.from(pivot),Flags:256};if(animated)n.Rotation={LineType:1,GlobalSeqId:null,Keys:[0,50,100].map((Frame,i)=>({Frame,Vector:Float32Array.from([0,Math.sin(i===1?.12:0),0,Math.cos(i===1?.12:0)])}))};model.Bones.push(n);model.PivotPoints[id]=n.PivotPoint;return id;};
 const solid=(center,radii,bone)=>{const vertices=[],faces=[],steps=8,rings=5;for(let j=0;j<=rings;j++){const p=Math.PI*j/rings;for(let i=0;i<steps;i++){const a=2*Math.PI*i/steps;vertices.push(center[0]+radii[0]*Math.sin(p)*Math.cos(a),center[1]+radii[1]*Math.sin(p)*Math.sin(a),center[2]+radii[2]*Math.cos(p));}}for(let j=0;j<rings;j++)for(let i=0;i<steps;i++){const a=j*steps+i,b=j*steps+(i+1)%steps,c=a+steps,d=b+steps;faces.push(a,b,c,b,d,c);}model.Geosets.push({Vertices:Float32Array.from(vertices),Faces:Uint16Array.from(faces),VertexGroup:new Uint8Array(vertices.length/3),Groups:[[bone]],MaterialID:0});};
 const tube=(a,b,radius,root,end)=>{const av=model.Bones[a].PivotPoint,bv=model.Bones[b].PivotPoint,axis=bv.map((v,i)=>v-av[i]),len=Math.hypot(...axis);for(let i=0;i<3;i++)axis[i]/=len;let u=[axis[1],-axis[0],0];if(Math.hypot(...u)<.001)u=[1,0,0];const ul=Math.hypot(...u);u=u.map(v=>v/ul);const v=[axis[1]*u[2]-axis[2]*u[1],axis[2]*u[0]-axis[0]*u[2],axis[0]*u[1]-axis[1]*u[0]];const vertices=[],faces=[],groups=[];for(let j=0;j<=3;j++)for(let i=0;i<8;i++){const angle=i*Math.PI/4;vertices.push(...[0,1,2].map(k=>av[k]+(bv[k]-av[k])*j/3+radius*(u[k]*Math.cos(angle)+v[k]*Math.sin(angle))));groups.push(j<2?0:1);}for(let j=0;j<3;j++)for(let i=0;i<8;i++){const n=j*8+i,q=j*8+(i+1)%8;faces.push(n,q,n+8,q,q+8,n+8);}model.Geosets.push({Vertices:Float32Array.from(vertices),Faces:Uint16Array.from(faces),VertexGroup:Uint8Array.from(groups),Groups:[[root],[end]],MaterialID:0});};
 const pelvisZ=4+40*legScale,body=add('Root',null,[0,0,pelvisZ+5]),pelvis=add('Pelvis',body,[0,0,pelvisZ]),chest=add('Chest',body,[0,0,pelvisZ+24]);
 solid([0,0,pelvisZ+14],[7,12,17],chest);solid([0,0,pelvisZ],[7,9,8],pelvis);
 for(let h=0;h<heads;h++){const y=(h-(heads-1)/2)*13,neck=add('Neck'+h,chest,[0,y,pelvisZ+41]),head=add('Head'+h,neck,[1,y,pelvisZ+49]);tube(neck,head,2,neck,head);solid([3,y,pelvisZ+55],[6,5,7],head);expected.heads.push(head);}
 for(let pair=0;pair<arms/2;pair++)for(const side of [-1,1]){const scale=armScale*(asymmetric&&side===1?1.2:1),z=pelvisZ+30-pair*11,x=pair*3,upper=add('Arm'+pair+side,chest,[x,side*12,z]),middle=add('Elbow'+pair+side,upper,[x+1,side*(12+14*scale),z-11*scale]),end=add('Hand'+pair+side,middle,[x+3,side*(12+28*scale),z-24*scale]);tube(upper,middle,3,upper,middle);tube(middle,end,2.4,middle,end);solid(Array.from(model.Bones[end].PivotPoint),[2.5,4,2],end);expected.limbs.push({...limb(wings?'wing':'arm',middle,end),roots:[upper]});if(wings){const digit=add('Tip'+pair+side,end,[x-20,side*(12+45*scale),z-12*scale]);expected.limbs.at(-1).ends.push(digit);tube(end,digit,1,end,digit);const vertices=[...model.Bones[upper].PivotPoint,...model.Bones[middle].PivotPoint,...model.Bones[end].PivotPoint,...model.Bones[digit].PivotPoint,x-26,side*15,z-8,x-20,side*30,z-15];model.Geosets.push({Vertices:Float32Array.from(vertices),Faces:Uint16Array.from([0,1,4,1,2,4,2,5,4,2,3,5]),VertexGroup:Uint8Array.from([0,1,2,3,0,2]),Groups:[[upper],[middle],[end],[digit]],MaterialID:0});}}
 for(const side of [-1,1]){const upper=add('Hip'+side,pelvis,[0,side*6,pelvisZ]),middle=add('Knee'+side,upper,[3,side*6,4+20*legScale]),end=add('Foot'+side,middle,[6,side*6,4]);tube(upper,middle,3,upper,middle);tube(middle,end,2.5,middle,end);solid([9,side*6,3],[6,3,2.5],end);expected.limbs.push({...limb('leg',middle,end),roots:[upper]});}
 expected.exactBody=body;expected.central=[pelvis];
 expected.semanticRoles=Object.fromEntries(model.Bones.map(n=>{const name=n.Name;return [n.ObjectId,name==='Root'?['Body']:name==='Pelvis'?['Pelvis']:name==='Chest'?['Chest']:name.startsWith('Head')?['Head']:name.startsWith('Neck')?['Neck','Object']:name.startsWith('Hand')?[wings?'Wing':'Hand']:name.startsWith('Foot')?['Foot']:wings&&/^(Arm|Elbow|Tip)/.test(name)?['Wing','Object']:['Object']];}));
 return {model,expected};
}
export const analyticalCases=[
 {key:'four-arms',options:{arms:4}}, {key:'six-arms',options:{arms:6}},
 {key:'long-arms-short-legs',options:{armScale:1.8,legScale:.45}},
 {key:'short-arms-long-legs',options:{armScale:.55,legScale:1.8}},
 {key:'three-heads',options:{heads:3}}, {key:'asymmetric-arms',options:{arms:4,asymmetric:true}},
 {key:'static-humanoid',options:{animated:false}}, {key:'static-six-arms',options:{arms:6,animated:false}},
 {key:'membrane-wings',options:{wings:true}},
];
