import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Vector3} from 'three';
import {openDocument} from '../src/editor-document.js';
import {allNodes,sampleNodeMatrices,skinGeoset} from '../src/animation.js';
import {applyMovementPose} from '../src/movement.js';
import {assertModelEquivalent} from '../src/save-equivalence.js';
import {suggestPoseRig,poseRole,poseNodeControl,poseNodeConstraints,poseTrackScope,poseChainIds,samplePoseChain,solvePoseNode,solvePoseLimb} from '../src/pose-ik.js';
const dir=process.env.MDLXL_POSE_COMPLEX || 'out/pose-complex-fixtures';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const position=(node,matrices)=>new Vector3(...node.PivotPoint).applyMatrix4(matrices.get(node.ObjectId));
function solve(model,config,target,values,frame,sequence,mode='move'){
 const id=target.kind==='body'?config.body:target.id;
 return solvePoseNode(model,id,poseNodeConstraints(model,config,id,mode,target),frame,sequence,{mode,space:'world',values,control:poseNodeControl(model,config,target,mode)});
}
function connected(before,after,config,frame,sequence){
 const a=sampleNodeMatrices(before,frame,sequence,frame),b=sampleNodeMatrices(after,frame,sequence,frame),nodes=allNodes(before),byId=new Map(nodes.map(n=>[n.ObjectId,n]));
 const drivers=new Set([config.body,...Object.keys(config.carriers||{}).map(Number),...Object.values(config.followers||{}).flat()]);
 for(const node of nodes){const parent=byId.get(node.Parent);if(!parent||drivers.has(node.ObjectId))continue;
  const old=position(node,a).distanceTo(position(parent,a)),now=position(node,b).distanceTo(position(parent,b));
  assert.ok(Math.abs(old-now)<Math.max(.65,old*.02),`${node.Name}: ${old} became ${now}`);
 }
 for(const [id,anchor] of Object.entries(config.carriers||{})){
  const node=byId.get(Number(id)),delta=b.get(anchor).clone().multiply(a.get(anchor).clone().invert());
  assert.ok(position(node,a).applyMatrix4(delta).distanceTo(position(node,b))<.001,'independent rider/accessory follows its actual seat');
 }
}
function stripPose(model){const copy=structuredClone(model);for(const key of ['Nodes','Bones','Helpers','Attachments'])for(const node of copy[key]||[])for(const property of ['Translation','Rotation','Scaling'])delete node[property];return copy;}
const fixtures=[
 ['WH_VC_NecrarchLord3.mdx',92,2],['Current_VampireDragon.mdx',182,8],
 ['WH_DOC_GreatUncleanOneNewV2.mdx',53,4],['WH_WOC_KurganWarlord3.mdx',0,4]
];
for(const [name,body,count] of fixtures)test(`${name}: connected controls, native keys, undo and unmodified asset roundtrip`,{skip:!fs.existsSync(path.join(dir,name))},()=>{
 const file=path.join(dir,name),bytes=fs.readFileSync(file),hash=digest(bytes),doc=openDocument(bytes),original=structuredClone(doc.model),sequence=doc.model.Sequences.findIndex(s=>/^stand(?:\s|$)/i.test(s.Name)),interval=doc.model.Sequences[sequence].Interval,frame=interval[0],config={...suggestPoseRig(doc.model,frame,sequence),pins:[]};
 assert.equal(config.body,body);assert.equal(config.chains.length,count);assert.deepEqual(doc.model,original);
 if(name.includes('Necrarch')){assert.deepEqual(config.chains.map(c=>c.end),[4,7]);assert.equal(poseRole(doc.model,config,1),'Chest');}
 if(name.includes('VampireDragon')){assert.equal(config.chains.filter(c=>c.label==='Wing').length,2);assert.equal(config.carriers[82],230);assert.ok(config.chains.filter(c=>c.kind==='leg'&&c.root>180).every(c=>poseChainIds(c).length===4));assert.equal(poseRole(doc.model,config,216),'Head');assert.equal(poseRole(doc.model,config,229),'Tail');assert.ok(!config.nodes.includes(67)&&!config.nodes.includes(68)&&!config.nodes.includes(91));}
 if(name.includes('Unclean')){assert.deepEqual(config.nodes.filter(id=>poseRole(doc.model,config,id)==='Head'),[68]);}
 if(name.includes('Kurgan'))assert.ok(config.chains.filter(c=>c.kind==='arm').every(c=>poseChainIds(c).length===4));
 for(const t of [interval[0],Math.round((interval[0]+interval[1])/2),interval[1]]){
  for(const target of [{kind:'body'},...config.nodes.map(id=>({kind:'node',id}))]){
   const before=structuredClone(doc.model),result=solve(doc.model,config,target,[6,0,7],t,sequence),scope=poseTrackScope(config,target,'move',doc.model);
   assert.ok(result.changes.length,'control responds');assert.ok(result.changes.every(c=>scope.some(s=>s.id===c.id&&s.property===c.property)),'all channels captured for cancellation');
   assert.deepEqual(doc.model,before,'solving is isolated');doc.apply('Pose connected part',['Nodes'],m=>applyMovementPose(m,result.changes,t,sequence));connected(before,doc.model,config,t,sequence);
   const after=structuredClone(doc.model);assert.ok(doc.undo());assert.deepEqual(doc.model,before);assert.ok(doc.redo());assert.deepEqual(doc.model,after);
  }
  for(const chain of config.chains){const before=structuredClone(doc.model),pose=samplePoseChain(doc.model,chain,t,sequence),result=solvePoseLimb(doc.model,chain,t,sequence,pose.end.clone().add(new Vector3(3,0,3)));assert.ok(result.changes.length);doc.apply('Pose limb',['Nodes'],m=>applyMovementPose(m,result.changes,t,sequence));connected(before,doc.model,config,t,sequence);}
 }
 assertModelEquivalent(stripPose(original),stripPose(doc.model));assertModelEquivalent(doc.model,openDocument(doc.serialize('mdx')).model);assert.equal(digest(fs.readFileSync(file)),hash);
});

test('anonymous arm references find wrists while body motion carries a blended robe',()=>{
 const model={Bones:[],Helpers:[],Attachments:[],Geosets:[],GlobalSequences:[],Sequences:[{Name:'Stand',Interval:[0,1000]}],PivotPoints:[]};let id=10;
 const add=(Name,Parent,PivotPoint,attachment=false)=>{const ObjectId=id++;model[attachment?'Attachments':'Bones'].push({ObjectId,Name,Parent,PivotPoint,Flags:attachment?2048:256});model.PivotPoints[ObjectId]=PivotPoint;return ObjectId;};
 const body=add('Bone_Root',null,[0,0,4]),robe=add('MeshA',body,[0,0,1]),spine=add('Bone_Spine',body,[0,0,5]),chest=add('Any_55',spine,[0,0,8]);add('Bone_Head',chest,[0,0,10]);
 for(const side of [-1,1]){const upper=add('Any_10',chest,[0,side*2,8]),elbow=add('Any_20',upper,[0,side*3,6]),wrist=add('Any_30',elbow,[0,side*4,4]);add('Hand Ref '+side,wrist,[0,side*4,3.5],true);}
 model.Geosets=[{Vertices:new Float32Array([0,0,1,0,0,5,1,0,7]),VertexGroup:[0,1,2],Groups:[[robe],[robe,spine],[spine,chest]]}];
 const config={...suggestPoseRig(model,500,0),pins:[]};assert.equal(config.body,body);assert.equal(poseRole(model,config,chest),'Chest');assert.equal(config.chains.length,2);
 const before=skinGeoset(model.Geosets[0],sampleNodeMatrices(model,500,0,500)),result=solve(model,config,{kind:'body'},[13,4,20],500,0);applyMovementPose(model,result.changes,500,0);const after=skinGeoset(model.Geosets[0],sampleNodeMatrices(model,500,0,500));for(let i=0;i<after.length;i++)assert.ok(Math.abs(after[i]-before[i]-[13,4,20][i%3])<1e-5,'blended robe translates without stretching');
});

test('seat carriers are included in bending snapshots, while accessories and mesh heads are not anatomical controls',()=>{
 const model={Bones:[],Helpers:[],Attachments:[],Geosets:[],GlobalSequences:[],Sequences:[{Name:'Stand',Interval:[0,1000]}],PivotPoints:[]};
 const add=(Name,Parent,PivotPoint)=>{const ObjectId=model.Bones.length;model.Bones.push({ObjectId,Name,Parent,PivotPoint,Flags:256});model.PivotPoints.push(PivotPoint);return ObjectId;};
 const body=add('Body',null,[0,0,4]),chest=add('Chest',body,[0,0,8]),seat=add('SaddleAnchor',chest,[1,0,10]),rider=add('RiderBody',null,[1,0,12]);
 const head=add('Head',chest,[0,0,12]);add('Head',head,[0,0,0]);add('Hipguard',chest,[0,2,7]);add('Chain_Neck',null,[0,0,11]);
 const config={body,nodes:[chest,head,rider],chains:[],pins:[],carriers:{[rider]:seat}};const result=solve(model,config,{kind:'node',id:chest},[3,0,1],500,0),scope=poseTrackScope(config,{kind:'node',id:chest},'move',model),copy=structuredClone(model);assert.ok(result.changes.filter(c=>c.id===rider).length===2);assert.ok(result.changes.every(c=>scope.some(s=>s.id===c.id&&s.property===c.property)));applyMovementPose(copy,result.changes,500,0);connected(model,copy,config,500,0);
 const inferred=suggestPoseRig(model,500,0);assert.deepEqual(inferred.nodes.filter(id=>poseRole(model,inferred,id)==='Head'),[head]);assert.ok(!inferred.nodes.some(id=>/Hipguard|Chain/.test(allNodes(model).find(n=>n.ObjectId===id).Name)));
});
