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
  recordJob(entry, { id: 'a', request: 'stop the thighs folding', plan, steps: [applied('Rebind thighs'), applied('Check seams')], outcome: 'verified', bird: 'Crow' });
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

test('new jobs see the most recent entries as choices they may undo', () => {
  const entry = {};
  assert.equal(diaryText(entry), '');
  for (let i = 1; i <= 50; i++) recordJob(entry, { id: 'job' + i, request: 'job ' + i, plan, steps: [applied('Edit ' + i)], outcome: 'verified' });
  assert.equal(entry.diary.length, 40, 'the diary keeps the last 40 jobs');
  noteOwnerReply(entry, 'All the changes are bad');
  const text = diaryText(entry);
  assert.match(text, /choice another AI made, not part of the authored model/);
  assert.equal(text.split('\n').length - 1, 8, 'eight most recent jobs');
  assert.ok(text.includes('"job 50"') && !text.includes('"job 42"'));
  assert.match(text, /the owner then said: "All the changes are bad"/);
  assert.match(text, /chose: Remove the skirt bones from thigh groups/);
});
