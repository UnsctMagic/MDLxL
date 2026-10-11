import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Quaternion, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices, sampleTrack, skinGeoset } from '../src/animation.js';
import { applyMovementTransform } from '../src/movement.js';
import { openDocument } from '../src/editor-document.js';
import { assertModelEquivalent } from '../src/save-equivalence.js';
import { samplePoseChain, suggestPoseRig } from '../src/pose-ik.js';
import { applyPoseWeight, buildPoseWeight, preparePoseWeight, weightMass } from '../src/pose-weight.js';

const chain = { root: 1, middle: 2, end: 3, kind: 'arm', key: 'arm' };
const rig = { body: 0, chains: [chain], nodes: [], pins: [] }, target = { kind: 'endpoint', key: 'arm' };
const axisQ = (axis, angle) => new Quaternion().setFromAxisAngle(new Vector3(...axis), angle).toArray();
function fixture(axis = [0, 0, 1]) {
  const pivots = [[0, 0, 10], [0, 0, 18], [8, 0, 20], [14, 0, 18]];
  const model = { Bones: pivots.map((PivotPoint, ObjectId) => ({ ObjectId, Name: `Joint ${ObjectId}`, Parent: ObjectId ? ObjectId - 1 : null, PivotPoint, Flags: 256 })), Helpers: [], PivotPoints: pivots,
    GlobalSequences: [], Sequences: [{ Name: 'motion', Interval: [0, 1000] }, { Name: 'other', Interval: [2000, 3000] }],
    Geosets: [{ Vertices: new Float32Array([20, 0, 18, 25, 0, 18, 25, 1, 18]), VertexGroup: [0, 0, 0], Groups: [[3]], Faces: [0, 1, 2] }] };
  model.Bones[3].Rotation = { LineType: 1, GlobalSeqId: null, Keys: [[0, 0], [200, 0], [450, 1], [550, 1.4], [700, 1.4], [1000, 1.4], [2000, .2], [3000, -.2]].map(([Frame, angle]) => ({ Frame, Vector: new Float32Array(axisQ(axis, angle)) })) };
  return model;
}
const selection = { 0: [0, 1, 2] };
const generate = (model, mode, amount, range = [0, 1000]) => buildPoseWeight(preparePoseWeight(model, rig, target, 0, range, selection), mode, amount);
const applied = (model, result) => { const copy = structuredClone(model); applyPoseWeight(copy, result); return copy; };
const close = (a, b, tolerance = 1e-5) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('Heavy weighs down the connected limb throughout the interior; amount is reversible and source is immutable', () => {
  const model = fixture(), before = structuredClone(model), weak = applied(model, generate(model, 'heavy', 20)), heavy = applied(model, generate(model, 'heavy', 70));
  for (const frame of [200, 400, 600, 800]) {
    const a = samplePoseChain(model, chain, frame, 0), b = samplePoseChain(weak, chain, frame, 0), c = samplePoseChain(heavy, chain, frame, 0);
    assert.ok(b.end.z < a.end.z - .2); assert.ok(c.end.z < b.end.z - .2);
    c.lengths.forEach((value, i) => close(value, a.lengths[i], .03));
  }
  for (const frame of [0, 1000]) close(samplePoseChain(heavy, chain, frame, 0).end.distanceTo(samplePoseChain(model, chain, frame, 0).end), 0);
  assert.deepEqual(generate(model, 'heavy', 0).tracks, []);
  assert.deepEqual(generate(model, 'heavy', 20), generate(model, 'heavy', 20));
  assert.deepEqual(model, before);
});

for (const axis of [[0, 0, 1], [0, 1, 0], [0, -1, 0]]) test(`Swing derives drag and overtake from ${axis} motion, including a vertical bash`, () => {
  const model = fixture(axis), result = generate(model, 'swing', 70), changed = applied(model, result);
  const delta = frame => {
    const old = samplePoseChain(model, chain, frame, 0).rotations[2], now = samplePoseChain(changed, chain, frame, 0).rotations[2];
    const rotation = now.multiply(old.invert()); if (rotation.w < 0) rotation.set(-rotation.x, -rotation.y, -rotation.z, -rotation.w);
    return new Vector3(rotation.x, rotation.y, rotation.z).dot(new Vector3(...axis));
  };
  assert.ok(delta(360) < -.015, 'mass trails during acceleration');
  assert.ok([650, 700, 750, 800, 850].some(frame => delta(frame) > .005), 'momentum overtakes after deceleration');
  assert.ok(result.impact >= 400 && result.impact <= 750);
  assert.ok(result.tracks.every(item => item.track.Keys.filter(key => key.Frame <= 1000).length < 45), 'fitted editable keys, not one key per integration sample');
});

test('a selected subinterval leaves all outside motion and other sequences unchanged', () => {
  const model = fixture(), range = [151, 879], result = generate(model, 'swing', 65, range), changed = applied(model, result);
  for (const frame of [0, 1, 100, 150, 151, 879, 880, 990, 1000, 2000, 2100, 2999]) {
    const sequence = frame >= 2000 ? 1 : 0, a = sampleNodeMatrices(model, frame, sequence), b = sampleNodeMatrices(changed, frame, sequence);
    for (const [id, matrix] of a) matrix.elements.forEach((value, i) => close(value, b.get(id).elements[i], .00003));
  }
  for (const item of result.tracks) {
    const old = allNodes(model).find(n => n.ObjectId === item.id)[item.property];
    assert.deepEqual(item.track.Keys.filter(k => k.Frame < range[0] || k.Frame > range[1]).filter(k => old?.Keys?.some(o => o.Frame === k.Frame)), old?.Keys?.filter(k => k.Frame < range[0] || k.Frame > range[1]) || []);
  }
  assert.deepEqual(changed.Geosets, model.Geosets); assert.deepEqual(changed.PivotPoints, model.PivotPoints);
});

test('unrelated selection, globals, shared timestamps and restrictions fail without mutation', () => {
  const model = fixture(), before = structuredClone(model);
  assert.throws(() => preparePoseWeight(model, rig, target, 0, [0, 1000], {}), /VERTICES/);
  model.Geosets[0].Groups = [[0]];
  assert.throws(() => generate(model, 'heavy', 50), /carried/); model.Geosets = structuredClone(before.Geosets);
  const analysis = preparePoseWeight(model, rig, target, 0, [0, 1000], selection);
  assert.throws(() => buildPoseWeight(analysis, 'heavy', 50, { rotation: true }), /restricted/);
  model.Bones[3].Rotation.GlobalSeqId = 0; model.GlobalSequences = [1000];
  assert.throws(() => generate(model, 'heavy', 50), /global/i);
  model.Bones[3].Rotation.GlobalSeqId = null; model.GlobalSequences = []; model.Sequences[1].Interval = [400, 700];
  assert.throws(() => generate(model, 'heavy', 50), /shared/);
});

const footman = process.env.MDLXL_POSE_FIXTURE || 'out/pose/Footman.mdx';
test('curved offset-grip translation shares the preserved guard poses with its limb rotations', () => {
  const model = fixture(), gripChain = { ...chain, grip: [16, 0, 18] }, config = { ...rig, chains: [gripChain] };
  model.Bones[3].Translation = { LineType: 2, Keys: [200, 400, 600, 800].map(Frame => ({ Frame, Vector: new Float32Array(3), InTan: new Float32Array(3), OutTan: new Float32Array(3) })) };
  const analysis = preparePoseWeight(model, config, target, 0, [0, 1000], selection);
  for (const mode of ['heavy', 'swing']) {
    const weighted = applied(model, buildPoseWeight(analysis, mode, 55));
    for (const frame of [0, 100, 200, 800, 900, 1000]) {
      const a = sampleNodeMatrices(model, frame, 0), b = sampleNodeMatrices(weighted, frame, 0);
      for (const [id, matrix] of a) matrix.elements.forEach((value, i) => close(value, b.get(id).elements[i], .00003));
    }
  }
});

test('body Weight uses its existing native driver and reads HD mass without rebinding', () => {
  const model = fixture();
  model.Geosets.push({ Vertices: new Float32Array([0, 0, 10, 1, 0, 10, 0, 1, 10]), SkinWeights: new Uint8Array([0, 3, 0, 0, 255, 0, 0, 0, 0, 3, 0, 0, 255, 0, 0, 0, 0, 3, 0, 0, 255, 0, 0, 0]), Faces: [0, 1, 2] });
  const selection = { 1: [0, 1, 2] }, before = structuredClone(model);
  const mass = weightMass(model, selection, 0);
  assert.equal(mass.count, 3); assert.equal(mass.rotor, 0);
  const result = buildPoseWeight(preparePoseWeight(model, rig, { kind: 'body' }, 0, [0, 1000], selection), 'heavy', 50);
  const weighted = applied(model, result), point = m => new Vector3(0, 0, 10).applyMatrix4(sampleNodeMatrices(m, 500, 0).get(0));
  assert.ok(point(weighted).z < point(model).z - .01);
  assert.deepEqual(model, before); assert.deepEqual(weighted.Geosets, before.Geosets);
});

test('Footman curved sword motion: exact outside curves, native MDX round trip, direct refinement and atomic Undo/Redo', { skip: !fs.existsSync(footman) }, () => {
  const bytes = fs.readFileSync(footman), digest = createHash('sha256').update(bytes).digest('hex'), doc = openDocument(bytes), model = doc.model, before = structuredClone(model);
  const rig = { ...suggestPoseRig(model, 12500, 4), pins: [] }, chain = rig.chains.find(c => c.end === 38), geo = model.Geosets[0];
  const selection = { 0: Array.from(geo.VertexGroup).flatMap((group, i) => geo.Groups[group].every(id => [19, 21, 22, 23].includes(id)) ? [i] : []) };
  const range = [12600, 13410], analysis = preparePoseWeight(model, rig, { kind: 'endpoint', key: chain.key }, 4, range, selection);
  for (const mode of ['heavy', 'swing']) {
    const result = buildPoseWeight(analysis, mode, 65), priorUndo = doc.historyStats.undoSteps;
    assert.deepEqual(model, before); doc.apply('Weight', ['Nodes'], m => applyPoseWeight(m, result));
    assert.equal(doc.historyStats.undoSteps, priorUndo + 1);
    for (let frame = 12500; frame <= 13500; frame += 7) if (frame < range[0] || frame > range[1]) {
      const a = sampleNodeMatrices(before, frame, 4), b = sampleNodeMatrices(doc.model, frame, 4);
      for (const [id, matrix] of a) matrix.elements.forEach((value, i) => close(value, b.get(id).elements[i], 1e-7));
    }
    assertModelEquivalent(doc.model, openDocument(doc.serialize('mdx')).model);
    assert.deepEqual(doc.model.Geosets, before.Geosets); assert.deepEqual(doc.model.Textures, before.Textures);
    const weighted = structuredClone(doc.model);
    doc.apply('Refine a native key', ['Nodes'], m => applyMovementTransform(m, [chain.end], 13000, 4, { mode: 'rotate', space: 'local', values: [5, 0, 0] }));
    assert.notDeepEqual(doc.model, weighted); assert.ok(doc.undo()); assert.deepEqual(doc.model, weighted);
    assert.ok(doc.undo()); assert.deepEqual(doc.model, before); assert.ok(doc.redo()); assert.deepEqual(doc.model, weighted); assert.ok(doc.undo());
  }
  assert.equal(createHash('sha256').update(fs.readFileSync(footman)).digest('hex'), digest);
});
