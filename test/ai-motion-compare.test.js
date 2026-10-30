import test from 'node:test';
import assert from 'node:assert/strict';
import { compareMotion, trackInventory } from '../src/ai-motion-compare.js';

const key = (Frame, ...Vector) => ({ Frame, Vector: new Float32Array(Vector) });
const track = (...Keys) => ({ LineType: 1, GlobalSeqId: -1, Keys });
function model() {
  return {
    Sequences: [{ Name: 'First', Interval: [0, 10] }, { Name: 'Second', Interval: [20, 30] }], GlobalSequences: [],
    Bones: [{ ObjectId: 0, Translation: track(key(0, 0, 0, 0), key(4, 4, 0, 0), key(10, 0, 0, 0), key(20, 0, 0, 0)) }],
    Geosets: [{ Vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 1]), Faces: new Uint16Array([0, 1, 2]), VertexGroup: [0, 0, 0], Groups: [[0]], MaterialID: 0 }],
    GeosetAnims: [{ GeosetId: 0, Flags: 2, Alpha: 1, Color: [1, .5, .25] }], Materials: [{ Layers: [{ Alpha: 1 }] }],
    Attachments: [{ ObjectId: 1, Visibility: track(key(0, 0), key(20, 0)) }],
  };
}

test('identical input has zero differences, no changed channels, and remains untouched', () => {
  const a = model(), snapshot = structuredClone(a), result = compareMotion(a, a);
  for (const row of result.sequences) {
    assert.equal(row.distance.distance, 0); assert.equal(row.distance.p95, 0); assert.equal(row.distance.mean, 0);
    assert.deepEqual(row.endpoints, { start: 0, end: 0 });
    assert.equal(row.speedDifference.difference, 0); assert.equal(row.contactSlip.difference, 0);
    assert.equal(row.centreHorizontalDrift.max, 0); assert.deepEqual(row.channels, []);
  }
  assert.deepEqual(a, snapshot); assert.deepEqual(result.changedTopology, []);
});

test('removed interior key reports its actual worst frame, distributions and exact endpoints', () => {
  const a = model(), b = structuredClone(a); b.Bones[0].Translation.Keys.splice(1, 1);
  const row = compareMotion(a, b, { sequences: [0], step: 3 }).sequences[0];
  assert.deepEqual(row.perFrame.map(f => f.frame), [0, 3, 6, 9, 10]);
  assert.equal(row.distance.frame, 3); assert.equal(row.distance.distance, 3);
  assert.deepEqual(row.endpoints, { start: 0, end: 0 });
  assert.ok(row.distance.p95 > 0); assert.ok(row.speedDifference.difference > 0);
  assert.ok(row.originalPeakSpeed > 0); assert.ok(row.contactSlip.before > row.contactSlip.after);
  assert.equal(row.centreHorizontalDrift.max, 3);
});

test('removing a sequence-local visibility key reports default-visible spans in that clip only', () => {
  const a = model(), b = structuredClone(a); b.Attachments[0].Visibility.Keys.pop();
  const result = compareMotion(a, b);
  assert.deepEqual(result.sequences[0].channels, []);
  const channel = result.sequences[1].channels[0];
  assert.equal(channel.kind, 'node-visibility'); assert.equal(channel.max, 1);
  assert.deepEqual(channel.spans[0], { from: 20, to: 30, beforeFrom: 20, beforeTo: 30, samples: 11, before: 0, after: 1 });
});

test('track-to-static colour swap, layer alpha, geoset alpha and each effect visibility are measured', () => {
  const a = model(), b = structuredClone(a);
  a.GeosetAnims[0].Color = track(key(0, 1, .5, .25)); b.GeosetAnims[0].Color = [.25, .5, 1];
  b.GeosetAnims[0].Alpha = .5; b.Materials[0].Layers[0].Alpha = .25;
  for (const collection of ['ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters', 'Lights']) {
    a[collection] = [{ ObjectId: 2, Visibility: track(key(0, 0)) }];
    b[collection] = [{ ObjectId: 2 }];
  }
  const channels = compareMotion(a, b, { sequences: [0] }).sequences[0].channels;
  assert.equal(channels.find(c => c.kind === 'geoset-color').max, .75);
  assert.equal(channels.find(c => c.kind === 'geoset-alpha').max, .5);
  assert.equal(channels.find(c => c.kind === 'layer-alpha').max, .75);
  assert.equal(channels.filter(c => c.kind === 'node-visibility').length, 5);
});

test('quaternion cubic controls equal to keys give the same geometry as linear interpolation', () => {
  const a = model(); delete a.Bones[0].Translation;
  a.Bones[0].Rotation = track(key(0, 0, 0, 0, 1), key(10, 0, 0, 1, 0));
  const b = structuredClone(a); b.Bones[0].Rotation.LineType = 2;
  for (const k of b.Bones[0].Rotation.Keys) k.InTan = k.OutTan = k.Vector.slice();
  assert.ok(compareMotion(a, b, { sequences: [0] }).sequences[0].distance.distance < 1e-6);
});

test('changed topology is listed, not compared by guessed vertex correspondence', () => {
  const a = model(), b = structuredClone(a); b.Geosets[0].Faces = new Uint16Array([2, 1, 0]);
  const result = compareMotion(a, b);
  assert.deepEqual(result.changedTopology, [0]);
  assert.ok(result.sequences[0].perFrame.every(f => f.comparedVertices === 0));
});

test('names match after a reorder and differing time intervals compare equal phases', () => {
  const a = model(), b = structuredClone(a);
  b.Sequences = [{ Name: 'Second', Interval: [20, 30] }, { Name: 'First', Interval: [100, 120] }];
  b.Bones[0].Translation.Keys = [key(100, 0, 0, 0), key(108, 4, 0, 0), key(120, 0, 0, 0)];
  const row = compareMotion(a, b, { sequences: ['First'] }).sequences[0];
  assert.equal(row.baselineSequence, 0); assert.equal(row.distance.distance, 0);
  assert.equal(row.perFrame[8].beforeFrame, 4);
});

test('global animations use the existing isolated preview owner', () => {
  const a = model(); a.GlobalSequences = [10]; a.Bones[0].Translation.GlobalSeqId = 0;
  const b = structuredClone(a); b.Bones[0].Translation.Keys[1].Vector[0] = 8;
  const row = compareMotion(a, b, { sequences: [{ globalSequence: 0 }] }).sequences[0];
  assert.equal(row.globalSequence, 0); assert.equal(row.distance.distance, 4);
});

test('exported node/resource renumbering does not invent non-geometric channel differences', () => {
  const a = model(), b = structuredClone(a);
  b.Attachments[0].ObjectId = 50;
  a.Materials.unshift({ Layers: [{ Alpha: 0 }] }); a.Geosets[0].MaterialID = 1;
  assert.deepEqual(compareMotion(a, b).sequences.flatMap(s => s.channels), []);
});

test('inventory reports encoded bytes, keyed domains, constant curves and equal quaternion controls', () => {
  const m = model(); m.Sequences[0].Name = 'Attack';
  m.Bones[0].Translation.GlobalSeqId = null; m.Bones[0].Translation.Keys.push(key(40, 0, 0, 0));
  m.Bones[0].Rotation = track(key(0, 0, 0, 0, 1), key(10, 0, 0, 1, 0)); m.Bones[0].Rotation.LineType = 2;
  for (const k of m.Bones[0].Rotation.Keys) k.InTan = k.OutTan = k.Vector.slice();
  m.GeosetAnims[0].Color = { ...track(key(0, 1, 1, 1)), GlobalSeqId: null };
  m.Nodes = m.Bones; const snapshot = structuredClone(m), result = trackInventory(m);
  const translation = result.tracks.find(t => t.path === '/Bones/0/Translation');
  assert.equal(translation.bytes, 16 + 5 * 16); assert.equal(translation.keysOutsideAnimations, 1);
  assert.equal(translation.perAnimation[0].keys, 3); assert.equal(translation.constantWithinKeyedDomains, false);
  const rotation = result.tracks.find(t => t.path === '/Bones/0/Rotation');
  assert.equal(rotation.bytes, 16 + 2 * 52); assert.equal(rotation.cubicEqualControlSegments, 1);
  assert.equal(result.animations[0].nativeComparison.medianKeysPerTrack, 2, 'median of 3 and 1, not the largest track');
  assert.equal(result.animations[0].nativeComparison.excludedExplicitLocalTracks, 2, 'rotation and attachment use explicit -1');
  assert.deepEqual(result.animations[0].nativeComparison.percentileRange, [0, 10]);
  assert.equal(result.animations[0].nativeComparison.reference.median, 6);
  assert.ok(result.tracks.every(t => !t.path.startsWith('/Nodes/'))); assert.deepEqual(m, snapshot);
});

test('constant key values alone do not certify a vector Hermite curve as constant', () => {
  const m = model(), t = m.Bones[0].Translation;
  t.LineType = 2; t.Keys = [key(0, 1, 1, 1), key(10, 1, 1, 1)];
  for (const k of t.Keys) k.InTan = k.OutTan = k.Vector.slice();
  const inventory = trackInventory(m).tracks.find(t => t.path === '/Bones/0/Translation');
  assert.equal(inventory.constantKeyValues, true); assert.equal(inventory.constantWithinKeyedDomains, false);
});
