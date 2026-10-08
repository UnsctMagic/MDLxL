import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { createPortraitSequence } from '../src/sequence-editor.js';
import { applyPortraitModelTransform, modelControlRoots } from '../src/portrait-model-control.js';
import { recalculatePortraitExtents } from '../src/portrait-extents.js';
import { setCameraFromCurrentView } from '../app/portrait-camera-edit.js';

const extentKeys = ['MinimumExtent', 'MaximumExtent', 'BoundsRadius'];
const withoutExtents = value => JSON.parse(JSON.stringify(value, (key, item) => extentKeys.includes(key) ? undefined : item));
const extent = owner => Object.fromEntries(extentKeys.map(key => [key, structuredClone(owner[key])]));
const contains = (box, vertices) => {
  for (let i = 0; i < vertices.length; i++) {
    assert.ok(vertices[i] >= box.MinimumExtent[i % 3] && vertices[i] <= box.MaximumExtent[i % 3], `posed coordinate ${vertices[i]} outside ${i % 3} bounds`);
  }
  const center = Array.from(box.MinimumExtent, (min, axis) => (min + box.MaximumExtent[axis]) / 2);
  for (let i = 0; i < vertices.length; i += 3) assert.ok(Math.hypot(...center.map((v, axis) => vertices[i + axis] - v)) <= box.BoundsRadius + 1e-4);
};
const checkPortrait = (model, sequence) => {
  const [start, end] = model.Sequences[sequence].Interval;
  for (let frame = start; frame <= end; frame += 7) {
    const matrices = sampleNodeMatrices(model, frame, sequence);
    for (const geoset of model.Geosets) {
      const vertices = skinGeoset(geoset, matrices);
      contains(model.Sequences[sequence], vertices);
      contains(geoset.Anims[sequence], vertices);
    }
  }
};
function fixture() {
  const doc = createDemoDocument();
  doc.apply('Create Portrait', ['Sequences', 'Geosets'], model => createPortraitSequence(model, 1000));
  doc.apply('Create second Portrait', ['Sequences', 'Geosets'], model => createPortraitSequence(model, 1200));
  return doc;
}

test('portrait bounds follow moved roots; other data, animation bounds and undo remain exact', () => {
  const doc = fixture(), model = doc.model, roots = modelControlRoots(model).map(root => root.id);
  doc.apply('Move portrait', ['Nodes'], m => applyPortraitModelTransform(m, roots, 3500, 1, { mode: 'move', values: [600, -350, 80] }));
  assert.throws(() => checkPortrait(doc.model, 1), /outside/);
  const before = structuredClone(doc.model);
  const baselines = new Map(['mdl', 'mdx'].map(format => [format, withoutExtents(openDocument(doc.serialize(format), `before.${format}`).model)]));
  doc.apply('Refresh portrait bounds', ['Sequences', 'Geosets'], recalculatePortraitExtents);
  const after = structuredClone(doc.model);
  for (const index of [1, 2]) checkPortrait(after, index);
  assert.deepEqual(withoutExtents(after), withoutExtents(before));
  assert.deepEqual(after.Info, before.Info);
  assert.deepEqual(after.Sequences[0], before.Sequences[0]);
  after.Geosets.forEach((geoset, index) => {
    assert.deepEqual(extent(geoset), extent(before.Geosets[index]));
    assert.deepEqual(geoset.Anims[0], before.Geosets[index].Anims[0]);
  });
  doc.undo(); assert.deepEqual(doc.model, before);
  doc.redo(); assert.deepEqual(doc.model, after);
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format), `portrait.${format}`).model;
    for (const index of [1, 2]) checkPortrait(reopened, index);
    assert.deepEqual(withoutExtents(reopened), baselines.get(format));
  }
});

test('Set Current View refreshes all portrait bounds after rig edits without changing rig keys', () => {
  const doc = fixture(), roots = modelControlRoots(doc.model).map(root => root.id);
  applyPortraitModelTransform(doc.model, roots, 3500, 1, { mode: 'rotate', axis: 'Y', amount: 65 });
  const bones = structuredClone(doc.model.Bones), stand = structuredClone(doc.model.Sequences[0]);
  setCameraFromCurrentView(doc.model, -1, { position: [400, -200, 100], target: [0, 0, 80], fieldOfView: Math.PI / 4, near: 1, far: 2000 });
  for (const index of [1, 2]) checkPortrait(doc.model, index);
  assert.deepEqual(doc.model.Bones, bones);
  assert.deepEqual(doc.model.Sequences[0], stand);
});

test('new portraits include shared global motion instead of inheriting bind-pose bounds', () => {
  const doc = createDemoDocument();
  doc.apply('Shared motion', ['GlobalSequences', 'Nodes'], model => {
    model.GlobalSequences = [200];
    model.Bones[0].Translation = { GlobalSeqId: 0, LineType: 1, Keys: [0, 100, 200].map((Frame, index) => ({ Frame, Vector: new Float32Array([index === 1 ? 500 : 400, 0, 0]) })) };
  });
  const bones = structuredClone(doc.model.Bones);
  const index = doc.apply('Create Portrait', ['Sequences', 'Geosets'], model => createPortraitSequence(model, 1000));
  checkPortrait(doc.model, index);
  assert.deepEqual(doc.model.Bones, bones);
});

test('scope stays on the edited portrait and missing geoset extent slots are aligned', () => {
  const doc = fixture(), model = doc.model;
  const untouched = structuredClone(model.Sequences[2]), slots = model.Geosets.map(geoset => structuredClone(geoset.Anims[2]));
  model.Geosets[0].Anims = [model.Geosets[0].Anims[0]];
  recalculatePortraitExtents(model, [1]);
  checkPortrait(model, 1);
  assert.deepEqual(model.Sequences[2], untouched);
  model.Geosets.slice(1).forEach((geoset, index) => assert.deepEqual(geoset.Anims[2], slots[index + 1]));
});
