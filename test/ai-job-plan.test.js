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
