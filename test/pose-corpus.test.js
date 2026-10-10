import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Vector3,Quaternion} from 'three';
import {openDocument} from '../src/editor-document.js';
import {allNodes} from '../src/animation.js';
import {applyMovementPose} from '../src/movement.js';
import {assertModelEquivalent} from '../src/save-equivalence.js';
import {suggestPoseRig,poseRole,poseChainIds,poseNodeControl,poseNodeConstraints,samplePoseChain,solvePoseLimb,solvePoseNode,turnPoseEndpoint,poseTrackScope} from '../src/pose-ik.js';
const manifestPath=process.env.MDLXL_POSE_CORPUS || 'out/pose-corpus-fixtures/manifest.json';
const manifest=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath)):null;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const find=leaf=>manifest.models.find(item=>path.basename(item.path)===leaf);
const mapping=rig=>({body:rig.body,chains:rig.chains.map(c=>[c.kind,c.label,poseChainIds(c),c.grip]),nodes:rig.nodes,roles:rig.roles});
const strip=model=>{const copy=structuredClone(model);for(const node of allNodes(copy))for(const property of ['Translation','Rotation','Scaling'])delete node[property];return copy;};
const report=[];
for(const item of manifest?.models || []) test(`corpus: ${item.entry}`,()=>{
 const bytes=fs.readFileSync(item.path),doc=openDocument(bytes),model=doc.model,before=structuredClone(model),sequence=Math.max(0,model.Sequences.findIndex(s=>/^stand(?:\s|$)/i.test(s.Name))),frame=model.Sequences[sequence]?.Interval[0]||0;
 const rig={...suggestPoseRig(model,frame,sequence),pins:[]},entry={name:item.entry,chains:rig.chains.length,parts:rig.nodes.length,body:rig.body,probes:0};
 assert.equal(hash(bytes),item.sha256);assert.deepEqual(model,before);
 // Recognition remains stable at every clip boundary; sampled scale keys may
 // affect solvability but never remove a structurally identified limb.
 for(const [si,seq] of model.Sequences.entries()) for(const t of [seq.Interval[0],seq.Interval[1]]) assert.deepEqual(mapping(suggestPoseRig(model,t,si)),mapping(rig));
 const used=new Set();for(const chain of rig.chains)for(const id of poseChainIds(chain)){assert.ok(!used.has(id),'independent chain ownership');used.add(id);}
 const record=result=>{assert.deepEqual(doc.model,before,'solver is isolated');doc.apply('Corpus pose',['Nodes'],m=>applyMovementPose(m,result.changes,frame,sequence));assertModelEquivalent(strip(before),strip(doc.model));assertModelEquivalent(doc.model,openDocument(doc.serialize('mdx')).model);if(result.changes.length){assert.ok(doc.undo());assert.deepEqual(doc.model,before);}entry.probes++;};
 for(const chain of rig.chains){const pose=samplePoseChain(model,chain,frame,sequence),delta=Math.min(...pose.lengths)*.03;record(solvePoseLimb(model,chain,frame,sequence,pose.end.clone().add(new Vector3(delta,0,delta))));}
 for(const id of [rig.body,...rig.nodes].filter(id=>id!=null)){const target=id===rig.body?{kind:'body'}:{kind:'node',id};record(solvePoseNode(model,id,poseNodeConstraints(model,rig,id,'move',target),frame,sequence,{mode:'move',space:'world',values:[1,0,1],control:poseNodeControl(model,rig,target,'move')}));}
 assert.equal(hash(fs.readFileSync(item.path)),item.sha256);report.push(entry);
});
test('corpus expected anatomical corrections and false-positive exclusions',{skip:!manifest},()=>{
 const rigFor=leaf=>{const model=openDocument(fs.readFileSync(find(leaf).path)).model;return {model,rig:suggestPoseRig(model,model.Sequences[0].Interval[0],0)};};
 let {model,rig}=rigFor('WAG.mdx');assert.equal(rig.body,0);assert.deepEqual(rig.chains.filter(c=>c.kind==='leg').map(c=>poseChainIds(c)),[[35,42,21,27],[36,14,22,28],[37,43,23,29],[38,44,24,30]]);assert.ok(!rig.chains.some(c=>c.end===46),'unused second rider arm has no skin and must not become a fake hand');assert.ok(rig.nodes.includes(31));assert.ok(!rig.nodes.includes(34),'unused second rider chest must not create a floating handle');
 ({model,rig}=rigFor('Mindflayer.mdx'));assert.equal(rig.chains.filter(c=>c.label==='Chain').length,8);assert.deepEqual(rig.chains.filter(c=>!c.label).map(c=>c.end).sort((a,b)=>a-b),[79,80]);
 ({model,rig}=rigFor('AnetheronV2.mdx'));assert.deepEqual(rig.nodes.filter(id=>poseRole(model,rig,id)==='Wing'),[28,29]);
 ({model,rig}=rigFor('FelOrcSalamanderRiderV2.mdx'));assert.ok(rig.chains.some(c=>c.end===92));assert.ok(!rig.chains.some(c=>c.root===89));assert.ok(!rig.nodes.includes(44));
 ({model,rig}=rigFor('NazgrelV2.mdx'));assert.equal(rig.chains.length,8);assert.ok(rig.chains.some(c=>c.end===12&&c.grip));assert.ok(rig.chains.some(c=>c.end===75));
 ({model,rig}=rigFor('ScourgeBattleship.mdx'));assert.equal(rig.chains.length,0);assert.equal(rig.nodes.length,0);assert.equal(rig.body,8);
 ({model,rig}=rigFor('FelOrcSalamanderRiderAxeMissileV2.mdx'));assert.equal(rig.chains.length,0);
 ({model,rig}=rigFor('tiefling_of_darkfang2.mdx'));assert.ok(!rig.nodes.some(id=>/^Geo_Tail/.test(allNodes(model).find(n=>n.ObjectId===id).Name)));assert.deepEqual(rig.nodes.filter(id=>poseRole(model,rig,id)==='Tail'),[57]);
});
test('anonymous paired articulation uses motion and skin without names or source IDs',()=>{
 const make=shift=>{const model={Bones:[],Helpers:[],Geosets:[],Attachments:[],PivotPoints:[],GlobalSequences:[],Sequences:[{Name:'clip',Interval:[0,1000]}]};
 const add=(parent,pivot)=>{const id=shift+model.Bones.length*7;model.Bones.push({ObjectId:id,Parent:parent,Name:'item_'+id,Flags:256,PivotPoint:pivot,Rotation:{LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:[0,0,0,1]},{Frame:500,Vector:[.1,0,0,Math.sqrt(.99)]},{Frame:1000,Vector:[0,0,0,1]}]}});model.PivotPoints[id]=pivot;return id;};
 const body=add(null,[0,0,8]),ends=[];for(const side of [-1,1]){let n=add(body,[0,side*2,8]);n=add(n,[1,side*2,4]);n=add(n,[0,side*2,0]);ends.push(n);model.Geosets.push({Vertices:new Float32Array([0,side*2,0,1,side*2,0,0,side*2,1]),VertexGroup:[0,0,0],Groups:[[n]],Faces:[0,1,2]});}return {model,ends};};
 for(const shift of [13,907]){const {model,ends}=make(shift),before=structuredClone(model),rig=suggestPoseRig(model,0,0);assert.deepEqual(rig.chains.map(c=>c.end),ends);assert.ok(rig.chains.every(c=>c.kind==='leg'));assert.deepEqual(model,before);for(const n of model.Bones)n.Rotation.Keys.forEach(k=>k.Vector=[0,0,0,1]);assert.equal(suggestPoseRig(model,0,0).chains.length,0,'rigid props without articulation are not inferred as legs');}
});
test('original corpus archives and loose models remain byte-identical',{skip:!manifest},()=>{for(const item of manifest.sources)assert.equal(hash(fs.readFileSync(item.path)),item.sha256,item.path);fs.mkdirSync('out',{recursive:true});fs.writeFileSync('out/pose-corpus-regression-report.json',JSON.stringify(report,null,2));});

test('displaced rigid mesh grip stays on its geometry during move, turn and ancestor pin compensation',()=>{
 const model={Bones:[{ObjectId:0,Name:'Body',Parent:null,PivotPoint:[0,0,10],Flags:256},{ObjectId:1,Name:'Upper',Parent:0,PivotPoint:[0,0,10],Flags:256},{ObjectId:2,Name:'Lower',Parent:1,PivotPoint:[4,0,8],Flags:256},{ObjectId:3,Name:'footmesh',Parent:2,PivotPoint:[0,0,40],Flags:256}],Helpers:[],Sequences:[{Name:'clip',Interval:[0,1000]}],GlobalSequences:[],Geosets:[],Attachments:[]};model.PivotPoints=model.Bones.map(n=>n.PivotPoint);
 const chain={root:1,middle:2,end:3,kind:'leg',key:'leg',grip:[7,0,3]},config={body:0,chains:[chain],nodes:[],pins:['leg']},before=structuredClone(model),frame=100,pose=samplePoseChain(model,chain,frame,0),goal=pose.end.clone().add(new Vector3(-.5,0,.5));
 let result=solvePoseLimb(model,chain,frame,0,goal);assert.deepEqual(model,before);assert.ok(result.changes.some(c=>c.id===3&&c.property==='Translation'));const moved=structuredClone(model);applyMovementPose(moved,result.changes,frame,0);let after=samplePoseChain(moved,chain,frame,0);assert.ok(after.end.distanceTo(goal)<1e-5);after.lengths.forEach((n,i)=>assert.ok(Math.abs(n-pose.lengths[i])<1e-5));assert.deepEqual(moved.Bones.map(n=>n.PivotPoint),before.Bones.map(n=>n.PivotPoint));const movedBefore=structuredClone(moved);solvePoseLimb(moved,chain,frame,0,goal.clone().add(new Vector3(.1,0,.1)));assert.deepEqual(moved,movedBefore,'existing compensation track is detached during preview');
 result=turnPoseEndpoint(model,chain,frame,0,new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.4).toArray());const turned=structuredClone(model);applyMovementPose(turned,result.changes,frame,0);after=samplePoseChain(turned,chain,frame,0);assert.ok(after.end.distanceTo(pose.end)<1e-5);assert.ok(after.rotations[2].angleTo(pose.rotations[2])>.3);
 result=solvePoseNode(model,0,poseNodeConstraints(model,config,0,'move',{kind:'body'}),frame,0,{mode:'move',space:'world',values:[.1,0,.1],control:poseNodeControl(model,config,{kind:'body'},'move')});const pinned=structuredClone(model);applyMovementPose(pinned,result.changes,frame,0);assert.ok(samplePoseChain(pinned,chain,frame,0).end.distanceTo(pose.end)<1e-5);
 for(const target of [{kind:'body'},{kind:'endpoint',key:'leg'}])assert.ok(poseTrackScope(config,target,'move',model).some(t=>t.id===3&&t.property==='Translation'));
 model.Bones[3].Translation={LineType:1,GlobalSeqId:0,Keys:[{Frame:0,Vector:[0,0,0]},{Frame:1000,Vector:[1,0,0]}]};model.GlobalSequences=[1000];assert.throws(()=>solvePoseLimb(model,chain,frame,0,goal),/global/i);
});
