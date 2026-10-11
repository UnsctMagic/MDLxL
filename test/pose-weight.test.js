import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Quaternion, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices } from '../src/animation.js';
import { applyMovementTransform, sampleMovement } from '../src/movement.js';
import { openDocument } from '../src/editor-document.js';
import { assertModelEquivalent } from '../src/save-equivalence.js';
import { samplePoseChain, suggestPoseRig } from '../src/pose-ik.js';
import { applyPoseWeight, automaticWeightSelection, buildPoseWeight, preparePoseWeight, weightMass, weightSourceTime } from '../src/pose-weight.js';

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
const analyze = (model, range = [0, 1000]) => preparePoseWeight(model, rig, target, 0, range, selection);
const applied = (model, result) => { const copy = structuredClone(model); applyPoseWeight(copy, result); return copy; };
const close = (a, b, tolerance = 1e-5) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('time shaping retains the source path, is monotone and leaves its endpoints fixed', () => {
  for (const drag of [0, .4, 1]) {
    let prior = -1;
    for (let frame = 0; frame <= 1000; frame++) {
      const source = weightSourceTime(frame, 0, 460, 1000, drag);
      assert.ok(source >= prior); assert.ok(source <= frame + 1e-8); prior = source;
    }
    for (const frame of [0, 460, 1000]) close(weightSourceTime(frame, 0, 460, 1000, drag), frame);
  }
});

for (const axis of [[0, 0, 1], [0, 1, 0], [0, -1, 0]]) test(`a mechanical swing gains drag, an impact overshoot and a recoil in its own ${axis} plane`, () => {
  const model = fixture(axis), before = structuredClone(model), analysis = analyze(model);
  const result = buildPoseWeight(analysis, 'strike', 80, {}, { body: 0, drag: 100, recoil: 100 }), changed = applied(model, result);
  const angle = (m, frame) => {
    const value = new Quaternion().fromArray(sampleMovement(m, m.Bones[3], 'Rotation', frame, 0));
    return 2 * Math.atan2(new Vector3(value.x, value.y, value.z).dot(new Vector3(...axis)), value.w);
  };
  assert.ok(angle(changed, 360) < angle(model, 360) - .08, 'preparation trails visibly');
  const hit = analysis.strike.hit;
  assert.ok(angle(changed, hit + 25) > angle(model, hit + 25) + .015, 'incoming momentum passes the impact pose');
  assert.ok(angle(changed, hit + 90) < angle(model, hit + 90) - .1, 'the part kicks back after the hit');
  close(angle(changed, 950), angle(model, 950), .004);
  assert.ok(result.tracks.every(item => item.track.Keys.filter(k => k.Frame <= 1000).length < 50), 'fitted editable keys');
  assert.deepEqual(model, before); assert.deepEqual(buildPoseWeight(analysis, 'strike', 0).tracks, []);
  assert.deepEqual(buildPoseWeight(analysis, 'strike', 100, {}, { drag: 0, recoil: 0, body: 0 }).tracks, []);
});

test('automatic selection reads visible attached geometry and never rebinds it', () => {
  const model = fixture(), before = structuredClone(model);
  assert.deepEqual(automaticWeightSelection(model, rig, target, 0, [0, 1000]), selection);
  const analysis = preparePoseWeight(model, rig, target, 0, null, {});
  assert.equal(analysis.automatic, true); assert.equal(analysis.massCount, 3);
  model.Geosets[0].SkinWeights = new Uint8Array([3,2,0,0,200,55,0,0, 3,2,0,0,200,55,0,0, 3,2,0,0,200,55,0,0]);
  assert.equal(weightMass(model, selection, 3, chain).rotor, 2);
  delete model.Geosets[0].SkinWeights; assert.deepEqual(model, before);
});

test('a rotating part gains recoil even when its mass center stays at the pivot', () => {
  const model = fixture();
  model.Geosets[0].Vertices = new Float32Array([4, -5, 18, 24, -5, 18, 14, 10, 18]);
  const analysis = analyze(model);
  assert.ok(analysis.samples.every(s => s.mass.distanceTo(analysis.samples[0].mass) < 1e-6));
  assert.ok(analysis.travel > 1, 'angular travel detects the swing');
  const result = buildPoseWeight(analysis, 'strike', 80);
  assert.ok(result.tracks.length > 0);
});

test('a stroke reaching the final key gains recovery time inside its existing clip', () => {
  const model = fixture();
  model.Bones[3].Rotation.Keys = [0, 200, 1000].map(Frame => ({ Frame, Vector: new Float32Array(axisQ([0, 0, 1], Math.max(0, (Frame - 200) / 800) * 1.4)) }));
  const analysis = analyze(model), result = buildPoseWeight(analysis, 'strike', 100, {}, { body: 0 });
  assert.ok(result.impact <= 760, 'reserve time for the recoil and settle');
  const changed = applied(model, result), rotation = frame => new Quaternion().fromArray(sampleMovement(changed, changed.Bones[3], 'Rotation', frame, 0));
  assert.ok(rotation(result.impact + 25).angleTo(rotation(result.impact + 90)) > .06);
  close(rotation(1000).angleTo(new Quaternion().fromArray(model.Bones[3].Rotation.Keys.at(-1).Vector)), 0, 1e-6);
});

test('a portion preserves all outside poses and all other animation keys', () => {
  const model = fixture(), range = [151, 879], result = buildPoseWeight(analyze(model, range), 'strike', 65), changed = applied(model, result);
  for (const frame of [0, 1, 100, 150, 151, 879, 880, 990, 1000, 2000, 2100, 2999]) {
    const sequence = frame >= 2000 ? 1 : 0, a = sampleNodeMatrices(model, frame, sequence), b = sampleNodeMatrices(changed, frame, sequence);
    for (const [id, matrix] of a) matrix.elements.forEach((value, i) => close(value, b.get(id).elements[i], .00003));
  }
  assert.deepEqual(changed.Geosets, model.Geosets); assert.deepEqual(changed.PivotPoints, model.PivotPoints);
});

test('unrelated selection, shared timestamps, globals and restrictions cannot mutate the model', () => {
  const model = fixture(), before = structuredClone(model);
  model.Geosets[0].Groups = [[0]]; assert.throws(() => analyze(model), /carried/); model.Geosets = structuredClone(before.Geosets);
  const analysis = analyze(model);
  assert.throws(() => buildPoseWeight(analysis, 'strike', 50, { rotation: true }), /restricted/);
  model.Bones[3].Rotation.GlobalSeqId = 0; model.GlobalSequences = [1000];
  assert.throws(() => buildPoseWeight(analyze(model), 'strike', 50), /global/i);
  model.Bones[3].Rotation.GlobalSeqId = null; model.GlobalSequences = []; model.Sequences[1].Interval = [400, 700];
  assert.throws(() => buildPoseWeight(analyze(model), 'strike', 50), /shared/);
});

const footman = process.env.MDLXL_POSE_FIXTURE || 'out/pose/Footman.mdx';
test('Footman curved attack retains outside motion, native save, geometry and ordinary key editing', { skip: !fs.existsSync(footman) }, () => {
  const bytes = fs.readFileSync(footman), digest = createHash('sha256').update(bytes).digest('hex'), doc = openDocument(bytes), model = doc.model, before = structuredClone(model);
  const rig = { ...suggestPoseRig(model, 12500, 4), pins: [] }, chain = rig.chains.find(c => c.end === 38), range = [12600, 13500];
  const analysis = preparePoseWeight(model, rig, { kind: 'endpoint', key: chain.key }, 4, range, {});
  const result = buildPoseWeight(analysis, 'strike', 60);
  doc.apply('Weight', ['Nodes'], m => applyPoseWeight(m, result));
  for (let frame = 12500; frame <= 13500; frame += 7) if (frame < range[0] || frame > range[1]) {
    const a = sampleNodeMatrices(before, frame, 4), b = sampleNodeMatrices(doc.model, frame, 4);
    for (const [id, matrix] of a) matrix.elements.forEach((value, i) => close(value, b.get(id).elements[i], 1e-7));
  }
  assertModelEquivalent(doc.model, openDocument(doc.serialize('mdx')).model);
  assert.deepEqual(doc.model.Geosets, before.Geosets); assert.deepEqual(doc.model.Textures, before.Textures);
  const weighted = structuredClone(doc.model);
  doc.apply('Refine a native key', ['Nodes'], m => applyMovementTransform(m, [chain.end], 13000, 4, { mode: 'rotate', space: 'local', values: [5, 0, 0] }));
  assert.notDeepEqual(doc.model, weighted); assert.ok(doc.undo()); assert.deepEqual(doc.model, weighted);
  assert.ok(doc.undo()); assert.deepEqual(doc.model, before); assert.ok(doc.redo()); assert.deepEqual(doc.model, weighted);
  assert.equal(createHash('sha256').update(fs.readFileSync(footman)).digest('hex'), digest);
});

test('Footman stomp compresses the body while both native foot contacts remain in place', { skip: !fs.existsSync(footman) }, () => {
  const model = openDocument(fs.readFileSync(footman)).model, sequence = 6, range = Array.from(model.Sequences[sequence].Interval);
  const config = { ...suggestPoseRig(model, range[0], sequence), pins: [] }, chain = config.chains.find(c => c.end === 29);
  const analysis = preparePoseWeight(model, config, { kind: 'endpoint', key: chain.key }, sequence, range, {});
  const changed = applied(model, buildPoseWeight(analysis, 'step', 80, {}, { recoil: 100, body: 75 }));
  const nodes = new Map(allNodes(model).map(n => [n.ObjectId, n]));
  let drop = 0, slip = 0;
  for (let frame = Math.ceil(analysis.step.hit); frame < analysis.step.hit + (range[1] - range[0]) * .25; frame += 7) {
    const a = sampleNodeMatrices(model, frame, sequence), b = sampleNodeMatrices(changed, frame, sequence);
    const point = new Vector3().fromArray(nodes.get(config.body).PivotPoint);
    drop = Math.max(drop, point.clone().applyMatrix4(a.get(config.body)).z - point.clone().applyMatrix4(b.get(config.body)).z);
    for (const leg of config.chains.filter(c => c.kind === 'leg')) {
      const original = samplePoseChain(model, leg, frame, sequence), weighted = samplePoseChain(changed, leg, frame, sequence);
      slip = Math.max(slip, original.end.distanceTo(weighted.end));
      weighted.lengths.forEach((length, i) => close(length, original.lengths[i], .015));
    }
  }
  assert.ok(drop > 1, `visible body compression: ${drop}`);
  assert.ok(slip < .35, `fitted foot contact error: ${slip}`);
});

const peon = process.env.MDLXL_WEIGHT_PEON || 'out/weight-redesign/fixtures/peon/Peon (Re-Classic)/PeonV2.mdx';
test('a late Peon landing compresses across the loop seam without a pose jump', { skip: !fs.existsSync(peon) }, () => {
  const model = openDocument(fs.readFileSync(peon)).model, sequence = 1, range = Array.from(model.Sequences[sequence].Interval);
  const config = { ...suggestPoseRig(model, range[0], sequence), pins: [] }, leg = config.chains.find(c => c.end === 42);
  const analysis = preparePoseWeight(model, config, { kind: 'endpoint', key: leg.key }, sequence, range, {});
  assert.equal(analysis.step.loop, true);
  assert.ok(analysis.step.hit > range[1] - 50);
  const changed = applied(model, buildPoseWeight(analysis, 'step', 80, {}, { body: 75, recoil: 100 }));
  const first = sampleNodeMatrices(changed, range[0], sequence), last = sampleNodeMatrices(changed, range[1], sequence);
  for (const [id, matrix] of first) matrix.elements.forEach((value, i) => close(value, last.get(id).elements[i], .0001));
  const body = allNodes(model).find(n => n.ObjectId === config.body), point = new Vector3().fromArray(body.PivotPoint);
  const before = point.clone().applyMatrix4(sampleNodeMatrices(model, range[0] + 15, sequence).get(config.body));
  const after = point.clone().applyMatrix4(sampleNodeMatrices(changed, range[0] + 15, sequence).get(config.body));
  assert.ok(before.z - after.z > 1, 'late landing compression survives the wrap');
});
