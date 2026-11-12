import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createDemoDocument, openDocument, removeGeosets } from '../src/editor-document.js';
import { findLook, GLOBAL_LOOKS, partFrame } from '../src/global-animation-looks.js';
import { compileAnimation, FX_SECTIONS, readAnimationStack } from '../src/global-animation-model.js';
import { deleteGlobalSequence } from '../src/sequence-editor.js';
import { authoredStack } from './helpers/fx-authored-stack.js';

const water = GLOBAL_LOOKS.find(look => look.id === 'water-skin');
const stackAt = (model, index = 0) => model.Geosets[index]._FxStack;
const applyFx = (doc, index, stack) =>
  doc.apply('Apply FX', FX_SECTIONS, model => compileAnimation(model, index, stack));
const deleteClock = (doc, index) =>
  doc.apply('Delete global sequence and its keyframes', [
    'GlobalSequences', 'GeosetAnims', 'Materials', 'TextureAnims', 'Nodes', 'Cameras', 'Info',
  ], model => deleteGlobalSequence(model, index));

function checkHistory(doc, read, before, after) {
  assert.equal(doc.undo(), true);
  assert.deepEqual(read(doc.model), before);
  assert.equal(doc.redo(), true);
  assert.deepEqual(read(doc.model), after);
}

function groupedModel() {
  const bytes = fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx', import.meta.url));
  const doc = openDocument(bytes, 'knight.mdx');
  const stack = authoredStack(water, partFrame(doc.model.Geosets[0]), 'grouped');
  applyFx(doc, 0, { ...stack, group: [3, 4] });
  return doc;
}

for (const [label, removed, members] of [
  ['deleting an earlier geoset', new Set([1]), [3, 4]],
  ['merging earlier geosets', new Map([[2, 1]]), [3, 4]],
  ['deleting a group member', new Set([3]), [4]],
  ['merging away a group member', new Map([[3, 2]]), [4]],
]) test('FX group keeps its surviving geometry after ' + label, () => {
  const doc = groupedModel(), before = structuredClone(stackAt(doc.model));
  const vertices = members.map(index => doc.model.Geosets[index].Vertices);
  doc.apply(label, ['Geosets', 'GeosetAnims'], model => removeGeosets(model, removed));
  const after = structuredClone(stackAt(doc.model));
  assert.deepEqual(after.group, vertices.map(data => doc.model.Geosets.findIndex(geoset => geoset.Vertices === data)));
  checkHistory(doc, stackAt, before, after);
});

test('FX impact contact keeps its vertex across a delete and clears when its geoset is merged away', () => {
  const bytes = fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx', import.meta.url));
  const doc = openDocument(bytes, 'knight.mdx');
  const look = findLook('iron-hit');
  const stack = authoredStack(look, partFrame(doc.model.Geosets[0]), 'impact');
  const sequence = doc.model.Sequences.findIndex(sequence => /^attack\b/i.test(sequence.Name));
  applyFx(doc, 0, { ...stack, sequence, hit: doc.model.Sequences[sequence].Interval[0], contact: { geoset: 4, vertex: 0, radius: 8 } });
  const before = structuredClone(stackAt(doc.model));
  const vertex = doc.model.Geosets[4].Vertices.slice(0, 3);
  doc.apply('Delete geoset', ['Geosets', 'GeosetAnims'], model => removeGeosets(model, new Set([1])));
  const after = structuredClone(stackAt(doc.model));
  assert.deepEqual(after.contact, { ...before.contact, geoset: 3 });
  assert.deepEqual(doc.model.Geosets[after.contact.geoset].Vertices.slice(0, 3), vertex);
  checkHistory(doc, stackAt, before, after);
  doc.apply('Merge geosets', ['Geosets', 'GeosetAnims'], model => removeGeosets(model, new Map([[3, 2]])));
  assert.equal(stackAt(doc.model).contact, null, 'a contact vertex is local to the removed geoset');
});

test('deleting an earlier global sequence cannot make FX take an authored clock of equal duration', () => {
  const doc = createDemoDocument();
  const stack = authoredStack(water, partFrame(doc.model.Geosets[0]), 'clock');
  doc.apply('Add an earlier clock', ['GlobalSequences'], model => model.GlobalSequences.push(500));
  applyFx(doc, 0, stack);
  const nextLoop = stack.loop + 250;
  doc.apply('Add an authored clock and track', ['GlobalSequences', 'Materials'], model => {
    const GlobalSeqId = model.GlobalSequences.push(nextLoop) - 1;
    model.Materials[0].Layers[0].Alpha = { GlobalSeqId, LineType: 1, Keys: [
      { Frame: 0, Vector: Float32Array.of(1) },
      { Frame: nextLoop, Vector: Float32Array.of(0.5) },
    ] };
  });
  const read = model => ({
    stack: stackAt(model),
    clocks: model.GlobalSequences,
    alpha: model.Materials[0].Layers[0].Alpha,
  });
  const before = structuredClone(read(doc.model));
  deleteClock(doc, 0);
  const after = structuredClone(read(doc.model));
  checkHistory(doc, read, before, after);
  const saved = readAnimationStack(doc.model, 0);
  applyFx(doc, 0, { ...saved, loop: nextLoop });
  assert.deepEqual(doc.model.GlobalSequences, [nextLoop, nextLoop], 'old FX clock swept and authored clock kept separately');
  assert.deepEqual(stackAt(doc.model).createdClockIds, [1]);
  assert.deepEqual(doc.model.Materials[0].Layers[0].Alpha, { ...before.alpha, GlobalSeqId: 0 });
  assert.deepEqual(after.stack.createdClockIds, [0], 'ownership remapped at the deletion');
});

test('deleting an FX-owned global sequence drops its ownership and duration', () => {
  const doc = createDemoDocument();
  const stack = authoredStack(water, partFrame(doc.model.Geosets[0]), 'deleted-clock');
  applyFx(doc, 0, stack);
  doc.apply('Add an authored clock', ['GlobalSequences'], model => model.GlobalSequences.push(7777));
  const before = structuredClone(stackAt(doc.model));
  deleteClock(doc, before.createdClockIds[0]);
  const after = structuredClone(stackAt(doc.model));
  assert.deepEqual(after.createdClockIds, []);
  assert.deepEqual(after.createdClocks, []);
  checkHistory(doc, stackAt, before, after);
  applyFx(doc, 0, { ...stack, loop: 7777 });
  assert.deepEqual(doc.model.GlobalSequences, [7777, 7777], 'FX did not adopt the authored clock');
});

test('FX sweep shifts clock ownership only once in both the edited and other stacks', () => {
  const doc = groupedModel(), stack = readAnimationStack(doc.model, 0);
  const authored = doc.model.GlobalSequences.filter((_, index) => !stack.createdClockIds.includes(index));
  const other = authoredStack(water, partFrame(doc.model.Geosets[1]), 'second');
  applyFx(doc, 1, { ...other, loop: stack.loop + 250 });
  applyFx(doc, 0, { ...stack, loop: stack.loop + 500 });
  assert.deepEqual(doc.model.GlobalSequences, [...authored, stack.loop + 250, stack.loop + 500]);
  assert.deepEqual(stackAt(doc.model, 0).createdClockIds, [authored.length + 1]);
  assert.deepEqual(stackAt(doc.model, 1).createdClockIds, [authored.length]);
});
