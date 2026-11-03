import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const {checkpointNote,recordFailures}=createRequire(import.meta.url)('../electron/ai-job-plan.cjs');
test('checkpoints retain all applied steps even beyond the recent tail',()=>{
 const task={steps:Array.from({length:32},(_,i)=>({tool:'mdlxl_patch',label:'Edit '+i,status:i===30?'pending':i===31?'failed':'applied'}))};
 const note=JSON.parse(checkpointNote(task));
 assert.equal(note.appliedStepCount,30); assert.equal(note.appliedSteps.length,30);
 assert.deepEqual(note.appliedSteps[0],{tool:'mdlxl_patch',label:'Edit 0'});
 assert.equal(note.appliedSteps.at(-1).label,'Edit 29');
 assert.equal(note.recentSteps.length,20);assert.equal(note.recentSteps.at(-2).status,'pending');
 assert.equal(note.recentSteps.at(-1).status,'failed');
});
test('passing a long-named check clears its truncated failure key',()=>{
 const task={}, name='Contact '.repeat(50);
 recordFailures(task,[{name,passed:false}],'before');
 assert.equal(Object.keys(task.checkFailures).length,1);
 recordFailures(task,[{name,passed:true},{passed:true}],'after');
 assert.deepEqual(task.checkFailures,{});
 recordFailures(task,[{name,passed:false}],'third');
 assert.equal(task.checkFailures[name.slice(0,200)].count,1);
 assert.equal(task.replanRequired,undefined);
});

test('editing and read-only calls keep their existing queue behavior', async () => {
  const { aiToolRunsUnqueued, aiToolEditsModel } = await import('../src/ai-tools.js');
  const unqueued = ['mdlxl_read', 'mdlxl_sample', 'mdlxl_capture', 'mdlxl_help', 'mdlxl_capabilities', 'mdlxl_context', 'mdlxl_assets', 'mdlxl_patch'].filter(name => aiToolRunsUnqueued(name, {}));
  assert.deepEqual(unqueued, ['mdlxl_read', 'mdlxl_sample', 'mdlxl_capture', 'mdlxl_help', 'mdlxl_capabilities']);
  assert.equal(aiToolRunsUnqueued('mdlxl_script', { edit: false }), true);
  assert.equal(aiToolRunsUnqueued('mdlxl_script', { edit: true }), false);
  assert.equal(aiToolEditsModel('mdlxl_script', { edit: true }), true);
});

test('exact value requests keep their exemption after a leading name or courtesy word', () => {
 const {exactValueRequest}=createRequire(import.meta.url)('../electron/ai-job-plan.cjs');
 for (const text of ['Please, rename Bone_Head to Head','Footman: set Alpha to 0','ask Crow to rename Bone_Head to Head','rename Bone_Head to Head']) assert.equal(exactValueRequest(text),true,text);
 assert.equal(exactValueRequest('Please, fix the shoulders'),false);
});

test('a new measured candidate with a different result can continue testing the same hypothesis', () => {
  const task = {}, inspect = (revision, actual) => recordFailures(task, [
    { name: 'Plate shape', passed: false, actual, expected: 0.1 },
  ], revision);
  inspect('A', 31);
  inspect('B', 3);
  assert.equal(task.replanRequired, undefined, 'changing the measured result is evidence');
  inspect('C', 3);
  assert.match(task.replanRequired, /Plate shape/);
});


test('private candidate staging obeys recorded scope/protection and remains queued without a live edit',async()=>{
  const{candidatePolicy,candidatePlan,planScope}=createRequire(import.meta.url)('../electron/ai-job-plan.cjs');
  const task={plan:{scope:['/Geosets/0'],protectedPaths:['/Bones'],options:[{fix:'repair',cost:'bindings'}],choice:0,keep:['keys'],checks:['shape']}};
  const args={candidate:'A',edit:false,scope:['/Geosets/0/Vertices'],protectedPaths:['/Textures']};
  const staged=candidatePolicy(task,args);assert.deepEqual(staged.protectedPaths,['/Bones','/Textures']);assert.equal(staged._candidatePlan,candidatePlan(task));
  assert.throws(()=>candidatePolicy({},args),/record.*scope|mdlxl_plan/);
  assert.throws(()=>candidatePolicy(task,{...args,edit:true}),/edit:false/);
  assert.throws(()=>candidatePolicy(task,{...args,scope:['/Geosets']}),/exceeds.*scope/);
  assert.throws(()=>planScope(task.plan,{scope:['/Geosets']}),/broaden/);
  assert.deepEqual(planScope(task.plan,{scope:['/Geosets/0/Vertices']}),{scope:['/Geosets/0/Vertices'],protectedPaths:['/Bones']});
  const{aiToolEditsModel,aiToolRunsUnqueued}=await import('../src/ai-tools.js');
  for(const name of ['mdlxl_script','mdlxl_patch']){assert.equal(aiToolEditsModel(name,args),false);assert.equal(aiToolRunsUnqueued(name,args),false);}
  assert.equal(aiToolRunsUnqueued('mdlxl_script',{edit:false}),true,'ordinary inspection scripts remain concurrent');
});
