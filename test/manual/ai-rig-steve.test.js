// Opt-in real benchmark: node --test test/manual/ai-rig-steve.test.js
// Fixtures are private permanent test models; no MDX is copied into the repository.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { openDocument } from '../../src/editor-document.js';
import { sampleNodeMatrices, skinGeoset, allNodes } from '../../src/animation.js';
import { measureRigCandidate } from '../../src/ai-rig-checks.js';
const { testModel }=createRequire(import.meta.url)('../helpers/fixtures.cjs');
const fixtures={
  good:['Steve-both.mdx','8c2d116b33a5e3e65d2c26025d8447a2c01399b2a6a0bc9264f419142a3fd155'],
  bad:['Steve-rules.mdx','52e64656464daf7b566202e69519fba9f203ad195e019afe37afb79c52994797'],
};
function load(which){
  const [name,hash]=fixtures[which],bytes=fs.readFileSync(testModel('ai-rig-steve',name));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,`The accepted ${which} benchmark bytes must match`);
  return openDocument(bytes,name).model;
}
const component=Array.from({length:50},(_,i)=>234+i);
const pose=(model,sequence,frame,geoset)=>skinGeoset(model.Geosets[geoset],sampleNodeMatrices(model,frame,sequence));
const edge=(p,a,b)=>Math.hypot(...[0,1,2].map(axis=>p[a*3+axis]-p[b*3+axis]));

test('accepted Steve plate stays rigid; bad saved rules candidate fails at the actual metal component',async()=>{
  const good=load('good'),bad=load('bad'),sequence=good.Sequences.findIndex(s=>s.Name==='Attack - 1');
  assert.equal(allNodes(good).find(n=>n.ObjectId===23).Name,'Bone_Arm1_L');
  for(const vertex of component)assert.deepEqual([...good.Geosets[25].Groups[good.Geosets[25].VertexGroup[vertex]]],[23]);
  const [start,end]=good.Sequences[sequence].Interval,frame=start+(end-start)*.3125;
  const lengths={good:edge(pose(good,sequence,frame,25),277,278),bad:edge(pose(bad,sequence,frame,25),277,278)};
  assert.ok(Math.abs(lengths.good-2.41408)<.01);assert.ok(Math.abs(lengths.bad-31.08)<.02);
  const options={rigidParts:[{geoset:25,vertices:component,driverBone:23}],flexibleParts:[{geoset:25,vertices:[277,278]}],sequences:[sequence],step:(end-start)/32};
  const accepted=await measureRigCandidate(good,good,options),rejected=await measureRigCandidate(good,bad,options);
  assert.ok(accepted.rigidParts[0].shape.normalized<1e-5);
  assert.ok(accepted.rigidParts[0].attachment.normalized<1e-5);
  assert.ok(rejected.rigidParts[0].shape.max>25,'stretched metal fails independently of an attachment-only check');
  assert.ok(rejected.rigidParts[0].attachment.max>25);
  const strain=rejected.flexibleParts[0].edgeStrain;
  assert.ok(strain.max>28);assert.equal(strain.worst.geosetId,26);
  assert.equal(strain.worst.clip,'Attack - 1');
  console.log(JSON.stringify({edgeAt31_25Percent:lengths,rigidShape:rejected.rigidParts[0].shape,driverAttachment:rejected.rigidParts[0].attachment,edgeStrain:strain}));
});

test('frozen Steve armor preserves shape but leaves its upper-arm driver; native cloth bending remains acceptable',async()=>{
  const good=load('good'),frozen=structuredClone(good),sequence=good.Sequences.findIndex(s=>s.Name==='Attack - 1');
  const unused=Math.max(...allNodes(good).map(n=>n.ObjectId))+1;
  frozen.Bones.push({ObjectId:unused,Name:'Test frozen plate'});
  const group=frozen.Geosets[25].Groups.push([unused])-1;
  for(const vertex of component)frozen.Geosets[25].VertexGroup[vertex]=group;
  const result=await measureRigCandidate(good,frozen,{rigidParts:[{geoset:25,vertices:component,driverBone:23}],sequences:[sequence],step:50});
  assert.ok(result.rigidParts[0].shape.normalized<1e-5,'rigid shape by itself must accept the frozen plate');
  assert.ok(result.rigidParts[0].attachment.max>10,'driver attachment must reject the frozen plate');
  // A bending flexible region has changing raw edge lengths, yet zero deviation
  // from its accepted native motion; do not apply a rigid-piece rule to it.
  const [start,end]=good.Sequences[sequence].Interval;
  const lengths=Array.from({length:33},(_,i)=>edge(pose(good,sequence,start+(end-start)*i/32,30),27,16));
  assert.ok(Math.max(...lengths)-Math.min(...lengths)>1);
  const cloth=await measureRigCandidate(good,good,{flexibleParts:[{geoset:30,vertices:[27,16]}],sequences:[sequence],step:(end-start)/32});
  assert.equal(cloth.flexibleParts[0].edgeStrain.max,0);
  assert.deepEqual(cloth.rigidParts,[]);
  console.log(JSON.stringify({frozenShape:result.rigidParts[0].shape,frozenAttachment:result.rigidParts[0].attachment,flexibleNativeLengthRange:[Math.min(...lengths),Math.max(...lengths)],flexibleDeviation:cloth.flexibleParts[0].edgeStrain}));
});

test('original frozen Steve is judged against bind intent: repaired rig passes and unchanged/bad rigs fail',async()=>{
  const original=openDocument(fs.readFileSync(testModel('ai-rig-steve','Steve.mdx')),'Steve.mdx').model;
  const snapshot=structuredClone(original),good=load('good'),bad=load('bad');
  const options={rigidParts:[{geoset:25,vertices:component,driverBone:23}],step:100};
  const repaired=await measureRigCandidate(original,good,options);
  assert.ok(repaired.rigidParts[0].attachment.normalized<1e-5,'the repaired first-job attachment passes with only the broken ORIGINAL as reference');
  assert.ok(repaired.rigidParts[0].shape.normalized<1e-5);
  const frozen=await measureRigCandidate(original,original,options);
  assert.ok(frozen.rigidParts[0].attachment.max>10,'unchanged original frozen rider cannot pass its declared moving upper-arm driver');
  const stretched=await measureRigCandidate(original,bad,options);
  assert.ok(stretched.rigidParts[0].shape.max>25,'bad rules-only shoulder is rejected without a golden donor');
  assert.equal(repaired.clips.length,original.Sequences.length+original.GlobalSequences.filter(x=>x>0).length);
  assert.deepEqual(original,snapshot);
  console.log(JSON.stringify({reference:'ORIGINAL Steve bind geometry',repaired:{shape:repaired.rigidParts[0].shape,attachment:repaired.rigidParts[0].attachment},frozen:{shape:frozen.rigidParts[0].shape,attachment:frozen.rigidParts[0].attachment},bad:{shape:stretched.rigidParts[0].shape,attachment:stretched.rigidParts[0].attachment}}));
});
