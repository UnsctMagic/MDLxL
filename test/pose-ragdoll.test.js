import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Vector3 } from 'three';
import { openDocument } from '../src/editor-document.js';
import { allNodes, sampleNodeMatrices } from '../src/animation.js';
import { applyMovementPose } from '../src/movement.js';
import { assertModelEquivalent } from '../src/save-equivalence.js';
import { poseChainIds, poseRole, withPoseResult, suggestPoseRig, samplePoseChain, solvePoseLimb, solvePoseNode, poseNodeControl, poseNodeConstraints, poseTrackScope } from '../src/pose-ik.js';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const points = (model,frame,sequence) => { const matrices=sampleNodeMatrices(model,frame,sequence,frame); return new Map(allNodes(model).map(node=>[node.ObjectId,new Vector3(...node.PivotPoint).applyMatrix4(matrices.get(node.ObjectId))])); };
const move = (model,config,target,values,frame,sequence,mode='move') => {const id=target.kind==='body'?config.body:target.id;return solvePoseNode(model,id,poseNodeConstraints(model,config,id,mode,target),frame,sequence,{mode,space:'world',values,control:poseNodeControl(model,config,target,mode)});};
function attached(before,after,frame,sequence,tolerance){const a=points(before,frame,sequence),b=points(after,frame,sequence);for(const node of allNodes(before))if(a.has(node.Parent))assert.ok(Math.abs(a.get(node.ObjectId).distanceTo(a.get(node.Parent))-b.get(node.ObjectId).distanceTo(b.get(node.Parent)))<tolerance,`joint ${node.ObjectId} detached`);}
const footman='out/pose/Footman.mdx';
test('Footman pelvis carries its sibling chest through the shared body, while native bone selection retains FK', {skip:!fs.existsSync(footman)},()=>{
 const doc=openDocument(fs.readFileSync(footman)),original=structuredClone(doc.model),config={...suggestPoseRig(doc.model,167,0),pins:[]};
 for(const [mode,values] of [['move',[25,-15,0]],['move',[0,0,60]],['rotate',[0,20,0]]]){
  const model=structuredClone(original),target={kind:'node',id:26},result=move(model,config,target,values,167,0,mode),scope=poseTrackScope(config,target,mode,model);
  assert.ok(result.changes.every(change=>scope.some(item=>item.id===change.id&&item.property===change.property)),'preview snapshots cover every written channel');
  applyMovementPose(model,result.changes,167,0);attached(original,model,167,0,.006);
  assert.deepEqual(allNodes(model).find(n=>n.ObjectId===26).Translation,allNodes(original).find(n=>n.ObjectId===26).Translation);
  assert.ok(result.changes.some(c=>c.id===25));
 }
 const raw=move(doc.model,config,{kind:'node',id:26,marker:true},[5,0,0],167,0);assert.ok(raw.changes.some(c=>c.id===26&&c.property==='Translation'));
 assert.deepEqual(doc.model,original);
 const scaled=structuredClone(original);allNodes(scaled).find(n=>n.ObjectId===25).Scaling={LineType:1,GlobalSeqId:null,Keys:[{Frame:167,Vector:[1.01,1,1]}]};assert.throws(()=>move(scaled,config,{kind:'node',id:39},[2,0,0],167,0),/uniform scale/);
});
const knightDirectory=process.env.MDLXL_POSE_KNIGHTS || 'out/pose-ragdoll-knights';
const knights=fs.existsSync(knightDirectory)?fs.readdirSync(knightDirectory).filter(name=>/^WH_WOC_Knight.*\.mdx$/.test(name)):[];
for(const file of knights)test(`${file}: native horse and rider stay connected, every mapped limb is usable, save is lossless`,()=>{
 const filename=path.join(knightDirectory,file),bytes=fs.readFileSync(filename),hash=digest(bytes),doc=openDocument(bytes),original=structuredClone(doc.model),config={...suggestPoseRig(doc.model,1667,1),pins:[]};
 assert.equal(config.chains.length,8);assert.equal(config.chains.filter(c=>c.label==='Hoof').length,4);assert.equal(config.chains.filter(c=>c.kind==='arm').length,2);assert.equal(config.chains.filter(c=>c.kind==='leg'&&!c.label).length,2);
 assert.equal(config.nodes.filter(id=>poseRole(doc.model,config,id)==='Head').length,2);
 assert.equal(new Set(config.chains.flatMap(poseChainIds)).size,config.chains.flatMap(poseChainIds).length);
 assert.ok(config.followers[config.body]?.length===1);
 const pelvis=config.nodes.find(id=>poseRole(doc.model,config,id)==='Pelvis');
 const jumping=structuredClone(original);let jumpingConfig={...config};const starts=config.chains.filter(c=>c.label==='Hoof').map(c=>[c,samplePoseChain(jumping,c,1667,1).end]);
 for(const displacement of [80,-20,-60]){const result=move(jumping,jumpingConfig,{kind:'body'},[0,0,displacement],1667,1);applyMovementPose(jumping,result.changes,1667,1);jumpingConfig=withPoseResult(jumpingConfig,result);}
 for(const [chain,ground] of starts) assert.ok(samplePoseChain(jumping,chain,1667,1).end.distanceTo(ground)<.4,'hoof returns to its ground target after re-grabbing');

 for(const [frame,values] of [[1667,[0,0,-10]],[2000,[0,0,40]],[2400,[7,0,0]]]){
  const before=structuredClone(doc.model),result=move(doc.model,config,{kind:'node',id:pelvis},values,frame,1),scope=poseTrackScope(config,{kind:'node',id:pelvis},'move',doc.model);
  assert.ok(result.changes.every(c=>scope.some(s=>c.id===s.id&&c.property===s.property)));
  doc.apply('Move connected mount',['Nodes'],model=>applyMovementPose(model,result.changes,frame,1));attached(before,doc.model,frame,1,.4);
  const a=points(before,frame,1),b=points(doc.model,frame,1),follower=config.followers[config.body][0];assert.ok(b.get(follower).clone().sub(a.get(follower)).distanceTo(b.get(config.body).clone().sub(a.get(config.body)))<.01);
 }
 for(const chain of config.chains){const before=structuredClone(doc.model),pose=samplePoseChain(doc.model,chain,2000,1),target=pose.end.clone().add(new Vector3(2,1,3)),result=solvePoseLimb(doc.model,chain,2000,1,target);doc.apply('Move limb',['Nodes'],model=>applyMovementPose(model,result.changes,2000,1));attached(before,doc.model,2000,1,.4);assert.ok(samplePoseChain(doc.model,chain,2000,1).end.distanceTo(target)<.4);}
 for(const frame of [1667,2000])for(const id of config.nodes.filter(id=>['Head','Chest','Body'].includes(poseRole(doc.model,config,id)))){const before=structuredClone(doc.model),result=move(doc.model,config,{kind:'node',id},[5,0,1.5],frame,1);doc.apply('Bend body part',['Nodes'],model=>applyMovementPose(model,result.changes,frame,1));attached(before,doc.model,frame,1,.4);}
 const edited=structuredClone(doc.model);assert.ok(doc.undo());assert.ok(doc.redo());assert.deepEqual(doc.model,edited);
 const reopened=openDocument(doc.serialize('mdx'));assertModelEquivalent(edited,reopened.model);
 const strip=model=>{const copy=structuredClone(model);for(const collection of ['Nodes','Bones','Helpers','Attachments'])for(const node of copy[collection]||[])for(const property of ['Translation','Rotation','Scaling'])delete node[property];return copy;};assertModelEquivalent(strip(original),strip(reopened.model));assert.equal(digest(fs.readFileSync(filename)),hash);
});

// Portable coverage runs even without the user's local Warcraft fixtures.
test('structural mounted mapping, native carrier motion and multi-link landing work without model-specific IDs',()=>{
 const model={Bones:[],Helpers:[],Attachments:[],Geosets:[],GlobalSequences:[],PivotPoints:[],Sequences:[{Name:'Pose',Interval:[0,1000]}]};
 const add=(Name,Parent,PivotPoint)=>{const ObjectId=model.Bones.length;model.Bones.push({ObjectId,Name,Parent,PivotPoint,Flags:256});model.PivotPoints.push(PivotPoint);return ObjectId;};
 const mount=add('Horse_Abdomen',null,[0,0,10]),chest=add('Horse_Chest',mount,[6,0,10]),pelvis=add('Horse_Pelvis',mount,[-6,0,10]);add('Horse_Head',chest,[10,0,14]);
 const carrier=add('Horse_Abdomen_Death',null,[0,0,10]),rider=add('Bone_Root',carrier,[0,0,15]),riderChest=add('Bone_Chest',rider,[0,0,18]);add('Bone_Head',riderChest,[0,0,22]);
 for(const [index,parent] of [chest,chest,pelvis,pelvis].entries()){const x=index<2?6:-6,y=index%2?2:-2;let joint=add(`Horse_Leg1_${index}`,parent,[x,y,10]);joint=add(`Horse_Leg2_${index}`,joint,[x+1,y,7]);joint=add(`Horse_Leg3_${index}`,joint,[x-1,y,4]);add(`Horse_Hoof_${index}`,joint,[x,y,1]);}
 for(const side of [-1,1]){let joint=add(`Arm1_${side}`,riderChest,[0,side*3,18]);joint=add(`Arm2_${side}`,joint,[2,side*5,17]);add(`Hand_${side}`,joint,[3,side*6,15]);joint=add(`Leg1_${side}`,rider,[0,side*2,14]);joint=add(`Leg2_${side}`,joint,[1,side*3,11]);add(`Foot_${side}`,joint,[2,side*3,9]);}
 add('1KnightHand',riderChest,[0,0,17]);
 const original=structuredClone(model);let config={...suggestPoseRig(model,500,0),pins:[]};assert.deepEqual(model,original);assert.equal(config.body,mount);assert.deepEqual(config.followers[mount],[carrier]);assert.equal(config.chains.length,8);
 const ground=config.chains.filter(c=>c.label==='Hoof').map(c=>[c,samplePoseChain(model,c,500,0).end]);
 for(const delta of [30,-12,-18]){const before=structuredClone(model),result=move(model,config,{kind:'node',id:pelvis},[0,0,delta],500,0);applyMovementPose(model,result.changes,500,0);config=withPoseResult(config,result);attached(before,model,500,0,.001);}
 for(const [chain,target] of ground)assert.ok(samplePoseChain(model,chain,500,0).end.distanceTo(target)<.01);
 assert.ok(points(model,500,0).get(rider).distanceTo(points(original,500,0).get(rider))<.001);
});
