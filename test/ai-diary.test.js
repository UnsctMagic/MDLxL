import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { recordJob, noteOwnerReply, diaryText } = createRequire(import.meta.url)('../electron/ai-diary.cjs');

const plan = {
  cause: 'Thigh vertices also follow the swinging skirt bones.',
  reach: 'Both thighs in four geosets.',
  keep: ['skirt panels', 'knees'],
  options: [
    { fix: 'Remove the skirt bones from thigh groups', cost: 'thighs stop following the skirt' },
    { fix: 'Blend the pelvis in', cost: 'more mixing' },
  ],
  choice: 0,
  why: 'Removes the cause instead of compensating.',
};
const applied = label => ({ label, status: 'applied' });

test('each job is recorded once with its plan, edits and result, and resuming updates it', () => {
  const entry = {};
  assert.equal(recordJob(entry, { id: 'a', request: 'stop the thighs folding', steps: [] }), false, 'a job with no plan and no edits leaves no entry');
  recordJob(entry, { id: 'a', request: 'stop the thighs folding', plan, steps: [applied('Rebind thighs'), { label: 'refused', status: 'failed' }], outcome: 'interrupted' });
  recordJob(entry, { id: 'a', request: 'stop the thighs folding', plan, steps: [applied('Rebind thighs'), applied('Check seams')], outcome: 'verified' });
  assert.equal(entry.diary.length, 1);
  assert.deepEqual(entry.diary[0].edits, ['Rebind thighs', 'Check seams']);
  assert.equal(entry.diary[0].outcome, 'verified');
  assert.equal(entry.diary[0].plan.chosen, 'Remove the skirt bones from thigh groups');
});

test("the owner's next message is kept as the reaction to the last job", () => {
  const entry = {};
  assert.equal(noteOwnerReply(entry, 'hello'), false, 'nothing to react to yet');
  recordJob(entry, { id: 'a', request: 'fix the walk', plan, steps: [applied('Retime walk')], outcome: 'verified' });
  assert.equal(noteOwnerReply(entry, 'it looks too mechanical'), true);
  assert.equal(noteOwnerReply(entry, 'a later message'), false, 'only the first reply counts');
  assert.equal(entry.diary[0].ownerNext, 'it looks too mechanical');
});

test('the model registry retains the complete stored diary as choices it may undo', () => {
  const entry = {};
  assert.equal(diaryText(entry), '');
  for (let i = 1; i <= 50; i++) recordJob(entry, { id: 'job' + i, request: 'job ' + i, plan, steps: [applied('Edit ' + i)], outcome: 'verified' });
  assert.equal(entry.diary.length, 40, 'the diary keeps the last 40 jobs');
  noteOwnerReply(entry, 'All the changes are bad');
  const text = diaryText(entry);
  assert.match(text, /choice another AI made, not part of the authored model/);
  assert.equal(text.split('\n').length - 1, 40, 'the complete stored diary stays with the model registry');
  assert.ok(text.indexOf('"job 50"') < text.indexOf('"job 11"'));
  assert.match(text, /the owner then said: "All the changes are bad"/);
  assert.match(text, /chose: Remove the skirt bones from thigh groups/);
});


test('direct jobs receive only relevant entries, newest first, without a fixed count cut-off', () => {
  const entry={diary:[]};
  for(let i=0;i<12;i++) recordJob(entry,{id:'w'+i,request:'Weld the plated band',steps:[{...applied('Weld band'),changes:[{path:'/Geosets/0/Vertices'}]}],outcome:'verified'});
  recordJob(entry,{id:'unrelated',request:'Retime the cape animation',steps:[{...applied('Retime cape'),changes:[{path:'/Bones/9/Translation'}]}],outcome:'verified'});
  const relevant=diaryText(entry,{request:'Weld the band like my example',context:{selection:{0:[1,2]}}});
  assert.ok(!relevant.includes('Retime cape'));
  assert.equal(relevant.split('\n').length-1,12,'all matching entries survive relevance selection');
  assert.ok(relevant.indexOf('Weld band')>=0);
  const full=diaryText(entry);
  assert.ok(full.indexOf('Retime cape')<full.indexOf('Weld band'));
  assert.equal(diaryText(entry,{request:'Inspect the camera',context:{selection:{}}}), '');
});


test('diary relevance uses selected node object ids, not the Bones array index', () => {
  const entry={};
  recordJob(entry,{id:'right',request:'Adjust motion',steps:[{...applied('Exact selected joint'),changes:[{path:'/Bones/0/Translation'}]}],nodeIds:[42],outcome:'verified'});
  recordJob(entry,{id:'wrong',request:'Alter motion',steps:[{...applied('Another joint'),changes:[{path:'/Bones/42/Translation'}]}],nodeIds:[0],outcome:'verified'});
  const text=diaryText(entry,{request:'Inspect this bone',context:{selectedNodeIds:[42]}});
  assert.ok(text.includes('Exact selected joint'));
  assert.ok(!text.includes('Another joint'));
});
