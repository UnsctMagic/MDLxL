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

test('the four tool answers stay as they were: helper calls and calls that skip the edit queue', async () => {
  const { AI_HELPER_TOOLS, aiHelperCanCall, aiToolRunsUnqueued, aiToolEditsModel } = await import('../src/ai-tools.js');
  assert.deepEqual([...AI_HELPER_TOOLS], ['mdlxl_context', 'mdlxl_read', 'mdlxl_capabilities', 'mdlxl_help', 'mdlxl_sample', 'mdlxl_capture', 'mdlxl_script', 'mdlxl_assets']);
  assert.equal(aiHelperCanCall('mdlxl_script', { edit: false }), true);
  assert.equal(aiHelperCanCall('mdlxl_script', { edit: true }), false);
  assert.equal(aiHelperCanCall('mdlxl_assets', { action: 'search' }), true);
  assert.equal(aiHelperCanCall('mdlxl_assets', { action: 'import' }), false);
  assert.equal(aiHelperCanCall('mdlxl_patch', {}), false);
  const unqueued = ['mdlxl_read', 'mdlxl_sample', 'mdlxl_capture', 'mdlxl_help', 'mdlxl_capabilities', 'mdlxl_context', 'mdlxl_assets', 'mdlxl_patch'].filter(name => aiToolRunsUnqueued(name, {}));
  assert.deepEqual(unqueued, ['mdlxl_read', 'mdlxl_sample', 'mdlxl_capture', 'mdlxl_help', 'mdlxl_capabilities']);
  assert.equal(aiToolRunsUnqueued('mdlxl_script', { edit: false }), true);
  assert.equal(aiToolRunsUnqueued('mdlxl_script', { edit: true }), false);
  assert.equal(aiToolEditsModel('mdlxl_script', { edit: true }), true);
});
