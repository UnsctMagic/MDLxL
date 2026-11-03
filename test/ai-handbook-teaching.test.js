// Bounded local correction replay. Run the command in the fixture: one positive,
// the observed bad boundary, its correction and an authorized counterexample.
// Input is the committed owner-authored native fixture; no provider is contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import lesson from './fixtures/ai-handbook-teaching.json' with { type: 'json' };
import { openDocument } from '../src/editor-document.js';
import { patchAiModel } from '../src/ai-model.js';
import { measureEditingCandidate } from '../src/ai-editing-procedures.js';

const baseline = () => openDocument(fs.readFileSync(new URL('./fixtures/' + lesson.fixture, import.meta.url)), 'native-teaching.mdx').model;
function proposal(before, edits) {
  return patchAiModel(before, edits.map(({ vertex, dx }) => ({ op: 'set', path: '/Geosets/0/Vertices/' + vertex * 3, value: before.Geosets[0].Vertices[vertex * 3] + dx })));
}
function measure(before, after, selection = lesson.selection) {
  return measureEditingCandidate(before, after, { operation: 'geometry', scope: lesson.scope, selection });
}
test('local teaching case: positive, bad, corrected and authorized counterexample', () => {
  const before = baseline(), positive = proposal(before, lesson.positive), bad = proposal(before, lesson.bad);
  assert.ok(measure(before, positive).checks.every(row => row.passed), 'positive stays inside the exact marked boundary');
  assert.equal(measure(before, bad).checks.find(row => row.name === lesson.badCheck).passed, false, 'the bad candidate fails the observed boundary');
  const corrected = patchAiModel(bad, lesson.correction.restoreVertices.flatMap(vertex => [0, 1, 2].map(axis => ({ op: 'set', path: '/Geosets/0/Vertices/' + (vertex * 3 + axis), value: before.Geosets[0].Vertices[vertex * 3 + axis] }))));
  assert.deepEqual(corrected, positive, 'replaying the correction restores exactly the intended proposal');
  assert.ok(measure(before, corrected).checks.every(row => row.passed));
  const authorized = proposal(before, lesson.counterexample.edits);
  assert.ok(measure(before, authorized, lesson.counterexample.selection).checks.every(row => row.passed), 'the same wider edit is valid when the user explicitly marks both vertices');
  assert.deepEqual(before, baseline(), 'the native baseline is never mutated');
});
