import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, EditorDocument, openDocument, validateModel } from '../src/editor-document.js';
import { constantTrack, fixPlainTrackValues, plainTrackValues } from '../src/plain-track-values.js';
import { collectedPartModel, commitPart, partRgbOptions, serializeCollectedPart } from '../src/bits-and-parts.js';
import { captureMeshSelection } from '../src/mesh-clipboard.js';
import { prepareClipboardPaste } from '../src/clipboard-paste.js';

const errors = model => validateModel(model).filter(issue => issue.code === 'PLAIN_TRACK_VALUE');
const saves = model => {
  const doc = createDemoDocument();
  doc.apply('Fixture', [], target => { Object.assign(target, structuredClone(model)); });
  for (const format of ['mdx', 'mdl']) assert.equal(openDocument(doc.serialize(format), 'check.' + format).readOnly, false, format);
};
// The Bit shape: a material scrolling its texture over the Stand animation.
const scrolling = (globalSeqId = null) => {
  const model = structuredClone(createDemoDocument().model);
  if (globalSeqId !== null) model.GlobalSequences = [1000];
  model.TextureAnims = [{ Translation: { LineType: 1, GlobalSeqId: globalSeqId, Keys: [0, 1000].map((Frame, index) => ({ Frame, Vector: Float32Array.of(index, 0, 0) })) } }];
  model.Materials[0].Layers[0].TVertexAnimId = 0;
  return model;
};

test('plain values in keyframe-only fields are found, cannot be saved, and the fix keeps the look', () => {
  const model = structuredClone(createDemoDocument().model);
  model.TextureAnims = [{ Translation: Float32Array.of(0, 0, 0), Scaling: Float32Array.of(2, 2, 1) }];
  model.Materials[0].Layers[0].TVertexAnimId = 0;
  model.Bones[0].Rotation = Float32Array.of(0, 0, 0, 1);
  model.Bones[1].Translation = Float32Array.of(0, 0, 5);
  assert.deepEqual(plainTrackValues(model).map(item => item.label), ['Blade_Root · Rotation', 'Rune_Core · Translation', 'Texture animation 1 · Translation', 'Texture animation 1 · Scaling']);
  assert.equal(errors(model).length, 4);
  const doc = createDemoDocument();
  assert.throws(() => doc.apply('Break', [], target => { target.Bones[1].Translation = Float32Array.of(0, 0, 5); }), /single value; Warcraft III needs keyframes/);
  assert.equal(fixPlainTrackValues(model), 4);
  assert.deepEqual(errors(model), []);
  // Defaults disappear; any other value plays unchanged in every animation.
  assert.equal(model.Bones[0].Rotation, undefined); assert.equal(model.TextureAnims[0].Translation, undefined);
  assert.deepEqual(model.Bones[1].Translation, constantTrack(model, [0, 0, 5]));
  assert.deepEqual(model.TextureAnims[0].Scaling.Keys.map(key => [key.Frame, Array.from(key.Vector)]), [[0, [2, 2, 1]], [2000, [2, 2, 1]]]);
  saves(model);
});

test('drafts saved with plain values still restore, so the Fix model prompt can repair them', () => {
  const doc = createDemoDocument();
  const state = doc.captureRecoveryState();
  doc.model.TextureAnims = [{ Translation: Float32Array.of(0, 0, 0) }]; doc.model.Materials[0].Layers[0].TVertexAnimId = 0;
  const broken = EditorDocument.restoreRecoveryState({ ...doc.captureRecoveryState(), originalBytes: state.originalBytes });
  assert.equal(plainTrackValues(broken.model).length, 1);
  broken.apply('Fix keyframe values', ['TextureAnims'], fixPlainTrackValues);
  assert.deepEqual(plainTrackValues(broken.model), []);
});

test('a Bit imported with a look keeps its frozen texture animation saveable', () => {
  const doc = createDemoDocument(), part = scrolling();
  doc.model.Sequences = [{ ...structuredClone(doc.model.Sequences[0]), Interval: Uint32Array.of(500, 2500) }];
  doc.apply('Import BitsAndParts', [], model => commitPart(model, part, { look: partRgbOptions(part)[0] ?? null }));
  assert.deepEqual(plainTrackValues(doc.model), []);
  saves(doc.model);
});

test('Collect Bit without global animations freezes them into saveable keyframes', () => {
  const source = scrolling(0);
  source.TextureAnims[0].Translation.Keys[0].Vector = Float32Array.of(0.25, 0, 0);
  const model = collectedPartModel(source, { name: 'Scroll', keepGlobals: false });
  assert.deepEqual(plainTrackValues(model), []);
  assert.deepEqual(Array.from(model.TextureAnims[0].Translation.Keys[0].Vector), [0.25, 0, 0]);
  assert.ok(serializeCollectedPart(model).length);
});

test('pasting parts with plain values asks to fix them and pastes keyframes', () => {
  const source = createDemoDocument(), target = createDemoDocument();
  source.model.TextureAnims = [{ Translation: Float32Array.of(0.5, 0, 0) }]; source.model.Materials[source.model.Geosets[0].MaterialID].Layers[0].TVertexAnimId = 0;
  const plan = prepareClipboardPaste(target.model, captureMeshSelection(source.model, {}, new Set([0])));
  assert.ok(plan.repairs.includes('Turn single animation values into keyframes.'));
  assert.deepEqual(plainTrackValues(plan.model), []);
  target.apply('Fix and paste', [], model => { Object.assign(model, plan.model); });
  saves(target.model);
});
