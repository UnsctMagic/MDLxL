import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, createNode, openDocument } from '../src/editor-document.js';
import { createSequenceFromCurrent, reorderSequences, reorderGlobalSequences, SEQUENCE_REORDER_SECTIONS } from '../src/sequence-editor.js';
import { setAnimationActualSpeed, ANIMATION_SPEED_KEY, ANIMATION_SPEED_FRAME, ANIMATION_SPEED_EVENTS } from '../src/animation-speed.js';
import { sampleTrack, sampleNodeMatrices } from '../src/animation.js';

const native = model => JSON.parse(JSON.stringify(model, (key, value) => [ANIMATION_SPEED_KEY, ANIMATION_SPEED_FRAME, ANIMATION_SPEED_EVENTS, 'Nodes'].includes(key) ? undefined : ArrayBuffer.isView(value) ? Array.from(value) : value));
const intervals = model => model.Sequences.map(sequence => Array.from(sequence.Interval));
const track = (frames, size = 1, global = null, lineType = 3) => ({ GlobalSeqId: global, LineType: lineType, Keys: frames.map((Frame, i) => ({ Frame, Vector: new Float32Array(size).fill(i / 10), InTan: new Float32Array(size).fill(i / 20), OutTan: new Float32Array(size).fill(i / 30) })) });

function fixture() {
  const doc = createDemoDocument();
  doc.apply('Fixture', [], model => {
    createSequenceFromCurrent(model, 0); createSequenceFromCurrent(model, 0);
    model.Sequences.forEach((sequence, index) => { sequence.Name = ['Stand', 'Walk', 'Stand 3'][index]; sequence.Rarity = index; sequence.NonLooping = !!index; });
    model.GlobalSequences = [800, 1200, 800];
    model.TextureAnims.push({ Translation: track([0, 400, 800], 3, 0) });
    const event = createNode(model, 'EventObject', 'SNDxReorder');
    event.EventTrack = new Uint32Array([0, 777, 2000, 2500, 3000, 3777, 5000, 6000, 6777, 8000, 9000]);
    const globalEvent = createNode(model, 'EventObject', 'SNDxGlobal');
    globalEvent.GlobalSeqId = 2; globalEvent.EventTrack = new Uint32Array([0, 400, 800]);
    // Different lengths and distinct spline controls expose accidental scaling.
    model.Sequences[2].Interval[1] = 8100;
    model.Bones[0].Translation = track([0, 777, 2000, 2500, 3000, 3777, 5000, 6000, 6777, 8100, 9000], 3);
    model.Geosets.forEach(geoset => geoset.Anims.forEach((anim, index) => { anim.BoundsRadius += index * 10; }));
  });
  return doc;
}

test('any permutation preserves local poses, values, tangents, durations, globals and geoset bounds', () => {
  for (const order of [[2, 0, 1], [1, 2, 0], [2, 1, 0], [0, 2, 1], [1, 0, 2]]) {
    const doc = fixture(), before = structuredClone(doc.model);
    doc.apply('Reorder', SEQUENCE_REORDER_SECTIONS, model => reorderSequences(model, order));
    const model = doc.model;
    assert.deepEqual(model.Sequences.map(sequence => sequence.Name), order.map(index => before.Sequences[index].Name));
    assert.deepEqual(model.TextureAnims, before.TextureAnims);
    assert.deepEqual(model.GlobalSequences, before.GlobalSequences);
    assert.deepEqual(model.EventObjects[1], before.EventObjects[1]);
    model.Sequences.forEach((sequence, index) => {
      const old = before.Sequences[order[index]], offset = sequence.Interval[0] - old.Interval[0];
      assert.deepEqual(sequence, { ...old, Interval: new Uint32Array(Array.from(old.Interval, frame => frame + offset)) });
      for (const fraction of [0, .1, .25, .5, .75, 1]) {
        const frame = old.Interval[0] + (old.Interval[1] - old.Interval[0]) * fraction;
        const a = sampleNodeMatrices(before, frame, order[index], 123), b = sampleNodeMatrices(model, frame + offset, index, 123);
        assert.deepEqual([...b].map(([id, matrix]) => [id, matrix.elements]), [...a].map(([id, matrix]) => [id, matrix.elements]));
      }
      for (let g = 0; g < model.Geosets.length; g++) assert.deepEqual(model.Geosets[g].Anims[index], before.Geosets[g].Anims[order[index]]);
    });
    assert.equal(model.Bones[0].Translation.Keys.length, before.Bones[0].Translation.Keys.length);
    assert.deepEqual(model.Geosets.map(({ Anims, ...geoset }) => geoset), before.Geosets.map(({ Anims, ...geoset }) => geoset));
    const after = structuredClone(model);
    doc.undo(); assert.deepEqual(doc.model, before);
    doc.redo(); assert.deepEqual(doc.model, after);
  }
});

test('moves every native animated owner once, including events, camera target, material and emitter channels', () => {
  const local = () => track([100, 150, 200, 500, 650, 800]);
  const model = { Sequences: [{ Name: 'A', Interval: [100, 200] }, { Name: 'B', Interval: [500, 800] }], GlobalSequences: [800],
    Bones: [{ Translation: local(), Rotation: local(), Scaling: local() }], Helpers: [{ Translation: local() }],
    Attachments: [{ Visibility: local() }], Lights: [{ Intensity: local(), Color: local(), AmbIntensity: local(), AttenuationStart: local(), AttenuationEnd: local() }],
    ParticleEmitters: [{ EmissionRate: local(), Gravity: local(), Longitude: local(), Latitude: local(), LifeSpan: local(), InitVelocity: local() }],
    ParticleEmitters2: [{ Width: local(), Length: local(), Speed: local(), Variation: local(), Visibility: local() }],
    ParticleEmitterPopcorns: [{ Alpha: local(), Color: local() }], RibbonEmitters: [{ HeightAbove: local(), HeightBelow: local(), TextureSlot: local() }],
    Materials: [{ Layers: [{ TextureID: local(), Alpha: local(), EmissiveGain: local(), FresnelColor: local(), FresnelOpacity: local() }] }],
    TextureAnims: [{ Translation: local(), Rotation: local(), Scaling: local() }], GeosetAnims: [{ Alpha: local(), Color: local() }],
    Cameras: [{ Translation: local(), Rotation: local(), TargetTranslation: local() }], EventObjects: [{ EventTrack: [100, 150, 650, 800] }],
  };
  model.Nodes = model.Bones;
  reorderSequences(model, [1, 0]);
  const visit = object => {
    if (!object || typeof object !== 'object' || ArrayBuffer.isView(object)) return;
    if (object.Keys) { assert.deepEqual(object.Keys.map(key => key.Frame), [100, 250, 400, 700, 750, 800]); assert.deepEqual(object.Keys.map(key => key.Vector[0]), [.3, .4, .5, 0, .1, .2].map(value => Math.fround(value))); return; }
    Object.values(object).forEach(visit);
  };
  visit(model);
  assert.deepEqual(model.EventObjects[0].EventTrack, [250, 400, 700, 750]);
});

test('gap and outside keys remain outside animations and round trip without loss', () => {
  const doc = fixture(), before = native(doc.model);
  reorderSequences(doc.model, [2, 0, 1]);
  assert.deepEqual(intervals(doc.model), [[0, 2100], [3100, 5100], [6100, 8100]]);
  assert.ok(doc.model.Bones[0].Translation.Keys.some(key => key.Frame === 2600));
  assert.ok(doc.model.Bones[0].Translation.Keys.some(key => key.Frame === 9000));
  reorderSequences(doc.model, [1, 2, 0]);
  assert.deepEqual(native(doc.model), before);
});

test('shared endpoint keys and events survive in both clips with independent vectors', () => {
  const model = { Sequences: [{ Interval: [0, 100] }, { Interval: [100, 200] }], Bones: [{ Translation: track([0, 100, 200]) }], EventObjects: [{ EventTrack: [100] }] };
  const before = structuredClone(model);
  reorderSequences(model, [1, 0]);
  assert.deepEqual(intervals(model), [[0, 100], [101, 201]]);
  assert.deepEqual(model.Bones[0].Translation.Keys.map(key => key.Frame), [0, 100, 101, 201]);
  assert.deepEqual(model.EventObjects[0].EventTrack, [0, 201]);
  for (const [index, old] of [1, 0].entries()) for (const offset of [0, 50, 100]) assert.equal(sampleTrack(model.Bones[0].Translation, model.Sequences[index].Interval[0] + offset, { interval: model.Sequences[index].Interval }), sampleTrack(before.Bones[0].Translation, before.Sequences[old].Interval[0] + offset, { interval: before.Sequences[old].Interval }));
  assert.notEqual(model.Bones[0].Translation.Keys[0].Vector, model.Bones[0].Translation.Keys[3].Vector);
});

test('speed baseline follows reordered animations and restores exact 100% keys/events', () => {
  for (const percent of [50, 137, 300]) {
    const doc = fixture(), expected = fixture();
    reorderSequences(expected.model, [2, 0, 1]);
    setAnimationActualSpeed(doc.model, 0, percent);
    setAnimationActualSpeed(doc.model, 2, 73);
    reorderSequences(doc.model, [2, 0, 1]);
    assert.equal(doc.model.Sequences[1][ANIMATION_SPEED_KEY].percent, percent);
    setAnimationActualSpeed(doc.model, null, 100);
    assert.deepEqual(native(doc.model), native(expected.model));
  }
});

test('global reorder remaps ID zero and duplicate-duration IDs without retiming anything', () => {
  const doc = fixture(), before = structuredClone(doc.model);
  doc.apply('Globals', ['GlobalSequences', ...SEQUENCE_REORDER_SECTIONS], model => reorderGlobalSequences(model, [2, 0, 1]));
  assert.deepEqual(doc.model.GlobalSequences, [800, 800, 1200]);
  assert.equal(doc.model.TextureAnims[0].Translation.GlobalSeqId, 1);
  assert.equal(doc.model.EventObjects[1].GlobalSeqId, 0);
  const expected = structuredClone(before);
  expected.GlobalSequences = [800, 800, 1200]; expected.TextureAnims[0].Translation.GlobalSeqId = 1; expected.EventObjects[1].GlobalSeqId = 0;
  assert.deepEqual(doc.model, expected);
  doc.undo(); assert.deepEqual(doc.model, before);
  doc.redo(); assert.deepEqual(doc.model, expected);
});

test('native MDL and MDX save/reopen retain reordered local/global tracks, events and bounds', () => {
  const doc = fixture();
  doc.apply('Reorder', SEQUENCE_REORDER_SECTIONS, model => reorderSequences(model, [2, 0, 1]));
  doc.apply('Globals', ['GlobalSequences', ...SEQUENCE_REORDER_SECTIONS], model => reorderGlobalSequences(model, [2, 0, 1]));
  for (const format of ['mdx', 'mdl']) {
    const opened = openDocument(doc.serialize(format), `reorder.${format}`);
    assert.equal(opened.readOnly, false);
    for (const section of ['Sequences', 'TextureAnims', 'EventObjects']) assert.deepEqual(native(opened.model[section].map((item, index) => Object.fromEntries(Object.keys(doc.model[section][index]).map(key => [key, item[key]])))), native(doc.model[section]));
    assert.deepEqual(opened.model.GlobalSequences, doc.model.GlobalSequences);
    assert.deepEqual(native(opened.model.Bones[0].Translation), native(doc.model.Bones[0].Translation));
    assert.deepEqual(opened.model.Geosets.map(geoset => geoset.Anims), doc.model.Geosets.map(geoset => geoset.Anims));
  }
});

test('invalid orders, overlaps, missing bounds and overflow fail before mutation; identity is a no-op', () => {
  const doc = fixture(), before = structuredClone(doc.model);
  for (const order of [[0, 0, 1], [0, 1], [0, 1, 3], [0, 1, .5]]) {
    assert.throws(() => reorderSequences(doc.model, order), /exactly once/);
    assert.throws(() => reorderGlobalSequences(doc.model, order), /exactly once/);
    assert.deepEqual(doc.model, before);
  }
  assert.equal(reorderSequences(doc.model, [0, 1, 2]), false);
  for (const change of [model => { model.Sequences[1].Interval[0] = 100; }, model => { model.Geosets[0].Anims.pop(); }, model => { model.Sequences[0].Interval[0] = 0xffffffff; }, model => { model.Sequences[1].Interval = [2000, 0x7fffffff]; model.Sequences[2].Interval = [0x7fffffff, 0x7fffffff]; }]) {
    const model = structuredClone(before); change(model); const input = structuredClone(model);
    assert.throws(() => reorderSequences(model, [2, 0, 1])); assert.deepEqual(model, input);
  }
});

test('zero-length animations and empty tracks reorder without invented keys', () => {
  const model = { Sequences: [{ Interval: [10, 10] }, { Interval: [20, 30] }], Bones: [{ Translation: track([10, 20, 30]), Scaling: track([]) }] };
  reorderSequences(model, [1, 0]);
  assert.deepEqual(intervals(model), [[10, 20], [30, 30]]);
  assert.deepEqual(model.Bones[0].Translation.Keys.map(key => key.Frame), [10, 20, 30]);
  assert.deepEqual(model.Bones[0].Scaling.Keys, []);
});

test('sequence identity does not depend on unique names or an initially chronological list', () => {
  const model = { Sequences: [{ Name: 'Stand', Interval: [500, 800] }, { Name: 'Stand', Interval: [100, 200] }], Bones: [{ Translation: track([100, 200, 500, 800]) }] };
  reorderSequences(model, [1, 0]);
  assert.deepEqual(intervals(model), [[100, 200], [500, 800]]);
  assert.deepEqual(model.Bones[0].Translation.Keys.map(key => key.Frame), [100, 200, 500, 800]);
  reorderSequences(model, [1, 0]);
  assert.deepEqual(intervals(model), [[100, 400], [700, 800]]);
  assert.deepEqual(model.Bones[0].Translation.Keys.map(key => key.Vector[0]), [.2, .3, 0, .1].map(Math.fround));
});
