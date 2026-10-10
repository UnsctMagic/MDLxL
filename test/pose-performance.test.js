import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {PerspectiveCamera,Vector3} from 'three';
import {sampleTrack,allNodes} from '../src/animation.js';
import {createPoseSample,poseNodeRole,samplePoseChain,solvePoseNode,solvePoseLimb,suggestPoseRig,poseNodeControl,poseNodeConstraints} from '../src/pose-ik.js';
import {projectPoseHandles} from '../app/pose-overlay.js';
import {applyMovementPose} from '../src/movement.js';
import {openDocument} from '../src/editor-document.js';
import {assertModelEquivalent} from '../src/save-equivalence.js';

test('dense clip lookup retains boundaries, interpolation, gaps and globals',()=>{
 const track={LineType:1,Keys:Array.from({length:10000},(_,i)=>({Frame:i*10,Vector:[i,i*2,i*3]}))};
 for(const offset of [0,140,4800,9950])for(const frame of [offset*10-1,offset*10,offset*10+15,offset*10+305]){
  const interval=[offset*10,offset*10+300],expected=Math.max(offset,Math.min(offset+30,frame/10));
  assert.deepEqual(sampleTrack(track,frame,{interval,fallback:[0,0,0]}),[expected,expected*2,expected*3]);
 }
 assert.deepEqual(sampleTrack(track,999999,{interval:[100001,100005],fallback:[7,8,9]}),[7,8,9]);
 assert.deepEqual(sampleTrack(track,3,{interval:[11,19],fallback:[7,8,9]}),[7,8,9]);
 assert.deepEqual(sampleTrack({...track,GlobalSeqId:0},9,{globalTime:1025,globalSequences:[1000],interval:[50000,50100],fallback:[0,0,0]}),[2.5,5,7.5]);
 const rotation={LineType:1,Keys:[{Frame:0,Vector:[0,0,0,1]},{Frame:100,Vector:[0,0,1,0]},{Frame:1000,Vector:[1,0,0,0]}]};
 const q=sampleTrack(rotation,50,{interval:[0,100],quaternion:true,fallback:[0,0,0,1]});assert.ok(Math.abs(q[2]-Math.SQRT1_2)<1e-12);assert.ok(Math.abs(q[3]-Math.SQRT1_2)<1e-12);
});

test('abbreviated left and right arm hands take precedence over weapon children',()=>{for(const Name of ['RiderLAH','RiderRAH','Arm_LAH','Arm_RAH'])assert.equal(poseNodeRole({Name}),'Hand');assert.notEqual(poseNodeRole({Name:'RiderWeapon'}),'Hand');});

const rigFixture=()=>{const pivots=[[0,0,10],[0,-2,10],[2,-2,5],[0,-2,0],[0,2,10],[2,2,5],[0,2,0]],parents=[null,0,1,2,0,4,5];return {Bones:pivots.map((PivotPoint,ObjectId)=>({ObjectId,Parent:parents[ObjectId],PivotPoint,Flags:256,Name:'Bone '+ObjectId})),Helpers:[],Geosets:[],Sequences:[{Interval:[0,1000]}],GlobalSequences:[],PivotPoints:pivots};};
const legs=[{root:1,middle:2,end:3,key:'l',kind:'leg'},{root:4,middle:5,end:6,key:'r',kind:'leg'}];
test('one sampled overlay validates shared ancestor keys once and later edits are checked afresh',()=>{
 const model=rigFixture();let reads=0;const vectors=Array.from({length:1000},()=>new Float32Array([0,0,0,1]));
 model.Bones[0].Rotation={LineType:1,Keys:vectors.map((vector,Frame)=>({Frame,get Vector(){reads++;return vector;}}))};
 const sample=createPoseSample(model,50,0);samplePoseChain(model,legs[0],50,0,50,sample);const first=reads;samplePoseChain(model,legs[1],50,0,50,sample);assert.equal(reads,first,'shared ancestors are not revisited for the next handle');
 vectors[999][0]=NaN;assert.throws(()=>samplePoseChain(model,legs[1],50,0),/invalid transform key/,'in-place edits outside the sampled frame must invalidate the next operation');
 vectors[999][0]=0;model.Bones[0].Scaling={LineType:0,Keys:[{Frame:0,Vector:[1,1,1]},{Frame:100,Vector:[1,2,1]}]};assert.doesNotThrow(()=>samplePoseChain(model,legs[0],50,0));assert.throws(()=>samplePoseChain(model,legs[0],100,0),/uniform scale/);
});
test('a failed chain does not bless shared descendants of its malformed ancestor',()=>{
 const model=rigFixture();model.Bones[4].Parent=1;
 model.Bones[0].Rotation={LineType:1,Keys:[{Frame:0,Vector:[0,0,0,1]},{Frame:900,Vector:[0,0,0,1]},{Frame:999,Vector:[NaN,0,0,1]}]};
 const sample=createPoseSample(model,0,0);
 for(const chain of legs)assert.throws(()=>samplePoseChain(model,chain,0,0,0,sample),/invalid transform key/);
});
test('invalid animation interval hides unavailable limbs without breaking direct handles',()=>{
 const model=rigFixture(),camera=new PerspectiveCamera(45,1,.1,1000);camera.position.set(20,20,20);camera.lookAt(0,0,5);camera.updateMatrixWorld();
 const handles=projectPoseHandles(model,{enabled:true,body:0,nodes:[],chains:legs,pins:[],target:{kind:'body'}},0,-1,camera,800,800);
 assert.ok(handles.some(h=>h.kind==='body'));assert.ok(!handles.some(h=>h.kind==='endpoint'));
});

const fixture=process.env.MDLXL_POSE_PERFORMANCE_MODEL;
test('dense twin-head rider: mapped parts, pins, native save and exact undo survive optimization',{skip:!fixture},()=>{
 const bytes=fs.readFileSync(fixture),hash=createHash('sha256').update(bytes).digest('hex'),doc=openDocument(bytes),model=doc.model,before=structuredClone(model),sequence=model.Sequences.findIndex(s=>s.Name==='Stand Ready'),frame=model.Sequences[sequence].Interval[0];
 const rig={...suggestPoseRig(model,frame,sequence),pins:[]};assert.equal(allNodes(model).length,229);assert.equal(rig.chains.length,8);assert.ok(rig.chains.some(c=>c.end===66&&c.root===63),'left hand uses its arm, not the child weapon');assert.ok(rig.nodes.includes(103)&&rig.nodes.includes(109),'both dragon heads mapped');assert.equal(rig.chains.filter(c=>c.label==='Wing').length,2);
 const record=result=>{assert.deepEqual(doc.model,before);doc.apply('Pose',['Nodes'],m=>applyMovementPose(m,result.changes,frame,sequence));assertModelEquivalent(doc.model,openDocument(doc.serialize('mdx')).model);if(result.changes.length){assert.ok(doc.undo());assert.deepEqual(doc.model,before);}};
 for(const c of rig.chains){const pose=samplePoseChain(model,c,frame,sequence);record(solvePoseLimb(model,c,frame,sequence,pose.end.clone().add(new Vector3(.5,0,.5))));}
 for(const id of [rig.body,...rig.nodes]){const target=id===rig.body?{kind:'body'}:{kind:'node',id};record(solvePoseNode(model,id,poseNodeConstraints(model,rig,id,'move',target),frame,sequence,{mode:'move',space:'world',values:[.5,0,.5],control:poseNodeControl(model,rig,target,'move')}));}
 rig.pins=rig.chains.filter(c=>c.kind==='leg').map(c=>c.key);const target={kind:'body'};record(solvePoseNode(model,rig.body,poseNodeConstraints(model,rig,rig.body,'move',target),frame,sequence,{mode:'move',space:'world',values:[0,0,.1],control:poseNodeControl(model,rig,target,'move')}));
 assert.equal(createHash('sha256').update(fs.readFileSync(fixture)).digest('hex'),hash);
});
