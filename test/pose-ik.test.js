import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { allNodes, sampleTrack } from '../src/animation.js';
import { applyMovementPose, applyMovementTransform } from '../src/movement.js';
import { poseTrackScope, samplePoseChain, solvePoseBody, solvePoseLimb, suggestPoseBody, suggestPoseChain, turnPoseEndpoint, validatePoseBody, validatePoseChain } from '../src/pose-ik.js';
import { createNode, openDocument } from '../src/editor-document.js';
import { createStarterDocument } from '../src/starter-model.js';
import { parseMdx } from '../src/mdx-container.js';
import { assertModelEquivalent } from '../src/save-equivalence.js';
import { pickPoseHandle, projectPoseHandles } from '../app/pose-overlay.js';

const chain = { root: 1, middle: 2, end: 3, kind: 'arm', key: 'a' }, leg1 = { root: 4, middle: 5, end: 6, kind: 'leg', key: 'l' }, leg2 = { root: 7, middle: 8, end: 9, kind: 'leg', key: 'r' };
const q = (axis, angle) => new Quaternion().setFromAxisAngle(new Vector3(...axis).normalize(), angle).toArray();
const track = (...keys) => ({ LineType: 1, GlobalSeqId: null, Keys: keys.map(([Frame, value]) => ({ Frame, Vector: new Float32Array(value) })) });
function fixture() {
  const pivots = [[0, 0, 10], [0, 0, 18], [8, 0, 20], [14, 0, 18], [0, -3, 10], [2, -3, 5], [0, -3, 0], [0, 3, 10], [-2, 3, 5], [0, 3, 0]];
  const parents = [null, 0, 1, 2, 0, 4, 5, 0, 7, 8];
  return { Bones: pivots.map((PivotPoint, ObjectId) => ({ ObjectId, Name: `Odd ${ObjectId}`, Parent: parents[ObjectId], PivotPoint, Flags: 256 })), Helpers: [], PivotPoints: pivots, GlobalSequences: [], Sequences: [{ Name: 'A', Interval: [100, 1000], MoveSpeed: 0, NonLooping: false, Rarity: 0 }, { Name: 'Portrait', Interval: [2000, 3000], MoveSpeed: 0, NonLooping: false, Rarity: 0 }], Geosets: [] };
}
const near = (a, b, tolerance = 1e-4) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const vectorNear = (a, b, tolerance) => a.forEach((value, i) => near(value, b[i], tolerance));
function apply(model, result) { return applyMovementPose(model, result.changes, 500, 0); }
function check(model, c, original, target) {
  const result = samplePoseChain(model, c, 500, 0);
  vectorNear(result.root.toArray(), original.root.toArray()); vectorNear(result.lengths, original.lengths);
  if (target) vectorNear(result.end.toArray(), target.toArray());
  near(Math.abs(result.rotations[2].dot(original.rotations[2])), 1, 1e-7);
  return result;
}

test('adjacent hierarchy suggestions use identities, reject skips, cyclic and missing parents', () => {
  const m = fixture(); assert.deepEqual(suggestPoseChain(m, 3), { root: 1, middle: 2, end: 3 });
  assert.throws(() => validatePoseChain(m, { root: 0, middle: 2, end: 3 }), /adjacent/);
  assert.throws(() => validatePoseChain(m, { root: 1, middle: 1, end: 3 }), /distinct/);
  m.Bones[0].Parent = 3; assert.throws(() => samplePoseChain(m, chain, 500, 0), /cyclic/);
  m.Bones[0].Parent = 800; assert.throws(() => samplePoseChain(m, chain, 500, 0), /missing parent/);
});

for (const mirrored of [false, true]) test(`reachable analytical solve samples exact native pose and twist, mirrored=${mirrored}`, () => {
  const m = fixture(); if (mirrored) for (const node of m.Bones) node.PivotPoint[0] *= -1;
  m.Bones[0].Translation = track([500, [3, 6, 2]]); m.Bones[0].Rotation = track([500, q([1, 2, 3], .8)]); m.Bones[0].Scaling = track([500, [2, 2, 2]]);
  m.Bones[1].Rotation = track([500, q([8, 0, 2], .4)]);
  const before = structuredClone(m), pose = samplePoseChain(m, chain, 500, 0), target = pose.end.clone().add(new Vector3(-1, 2, -1));
  const result = solvePoseLimb(m, chain, 500, 0, target); assert.deepEqual(m, before, 'solve does not mutate source');
  apply(m, result); check(m, chain, pose, target);
  for (const change of result.changes) { assert.equal(change.property, 'Rotation'); near(Math.hypot(...change.value), 1, 1e-10); }
});

test('inner and outer reach clamp, coincident target stays finite, bend direction remains continuous', () => {
  const m = fixture(), pose = samplePoseChain(m, chain, 500, 0);
  for (const distance of [1e5, 0, 1e-8]) {
    const copy = structuredClone(m), target = pose.root.clone().add(new Vector3(distance, 0, 0)), result = solvePoseLimb(copy, chain, 500, 0, target);
    apply(copy, result); const after = check(copy, chain, pose);
    near(after.root.distanceTo(after.end), distance > 1 ? pose.lengths[0] + pose.lengths[1] : Math.abs(pose.lengths[0] - pose.lengths[1]), 1e-4);
  }
  const a = solvePoseLimb(m, chain, 500, 0, pose.end.clone().add(new Vector3(0, .001, 0))), b = solvePoseLimb(m, chain, 500, 0, pose.end.clone().add(new Vector3(0, -.001, 0)));
  assert.ok(new Vector3(...a.bend).dot(new Vector3(...b.bend)) > .9999);
});

test('straight and folded equal-length chains handle zero targets without NaNs', () => {
  for (const end of [[20, 0, 0], [0, 0, 0]]) {
    const m = fixture(); m.Bones[1].PivotPoint = [0, 0, 0]; m.Bones[2].PivotPoint = [10, 0, 0]; m.Bones[3].PivotPoint = end;
    const pose = samplePoseChain(m, chain, 500, 0), result = solvePoseLimb(m, chain, 500, 0, [0, 0, 0]);
    apply(m, result); check(m, chain, pose); assert.ok(result.changes.flatMap(c => c.value).every(Number.isFinite));
  }
});

test('unsupported inherited-transform flags reject before mutation rather than disagreeing with the mesh renderer', () => {
  for (const flag of [1, 2, 4, 7]) {
    const m = fixture(); m.Bones[0].Translation = track([500, [4, 3, 2]]); m.Bones[0].Rotation = track([500, q([0, 0, 1], .5)]); m.Bones[0].Scaling = track([500, [2, 2, 2]]); m.Bones[1].Flags |= flag;
    const before = structuredClone(m); assert.throws(() => solvePoseLimb(m, chain, 500, 0, [10, 1, 18]), /preview renderer/); assert.deepEqual(m, before);
  }
  const m = fixture(); m.Bones[2].Flags |= 2; assert.throws(() => samplePoseChain(m, chain, 500, 0), /inherited transforms/);
});

test('body mapping rejects a hierarchy link that excludes body translation', () => {
  const m = fixture(); m.Bones[4].Flags |= 1;
  assert.throws(() => validatePoseBody(m, 0, [leg1, leg2]), /inherited translation|inherited transforms/);
  assert.throws(() => solvePoseBody(m, 0, [{ chain: leg1 }], 500, 0, [0, 0, -1]), /inherited translation|inherited transforms/);
});

test('straight-chain bend memory keeps continuity, while a bent sampled FK pose overrides memory', () => {
  const m = fixture(), pose = samplePoseChain(m, chain, 500, 0), direction = pose.end.clone().sub(pose.root).normalize();
  const extended = solvePoseLimb(m, chain, 500, 0, pose.root.clone().addScaledVector(direction, 1000)); apply(m, extended);
  const local = new Vector3(...extended.bend).applyQuaternion(extended.pose.rotations[0].clone().invert());
  const straight = samplePoseChain(m, chain, 500, 0), memory = local.clone().applyQuaternion(straight.rotations[0]);
  const folded = solvePoseLimb(m, chain, 500, 0, straight.end.clone().addScaledVector(direction, -.2), { bendMemory: memory });
  assert.ok(new Vector3(...folded.bend).dot(new Vector3(...extended.bend)) > .99);
  const normal = fixture(), target = pose.end.clone().add(new Vector3(-1, 1, 0));
  const a = solvePoseLimb(normal, chain, 500, 0, target), b = solvePoseLimb(normal, chain, 500, 0, target, { bendMemory: new Vector3(...a.bend).negate() });
  vectorNear(a.bend, b.bend, 1e-8);
});

test('nonuniform/reflected/singular scales, billboards, coincident joints and invalid keys reject before mutation', () => {
  for (const scale of [[1, 2, 1], [-1, -1, -1], [0, 0, 0]]) { const m = fixture(); m.Bones[0].Scaling = track([500, scale]); const before = structuredClone(m); assert.throws(() => solvePoseLimb(m, chain, 500, 0, [10, 0, 18]), /scale|transform/); assert.deepEqual(m, before); }
  const m = fixture(); m.Bones[0].Flags |= 8; assert.throws(() => samplePoseChain(m, chain, 500, 0), /billboard/);
  m.Bones[0].Flags = 256; m.Bones[2].PivotPoint = m.Bones[1].PivotPoint; assert.throws(() => samplePoseChain(m, chain, 500, 0), /nonzero/);
  m.Bones[2].PivotPoint = [8, 0, 20]; m.Bones[0].Rotation = track([500, [0, 0, 0, 0]]); assert.throws(() => samplePoseChain(m, chain, 500, 0), /invalid/);
});

test('Bend keeps endpoint pose; Turn writes only endpoint Rotation and holds its pivot', () => {
  const m = fixture(), pose = samplePoseChain(m, chain, 500, 0), result = solvePoseLimb(m, chain, 500, 0, pose.end, { pole: pose.middle.clone().add(new Vector3(0, 8, 0)) });
  apply(m, result); const bent = check(m, chain, pose, pose.end); assert.ok(bent.middle.distanceTo(pose.middle) > 1);
  const turned = turnPoseEndpoint(m, chain, 500, 0, q([0, 0, 1], .4)); assert.deepEqual(turned.changes.map(change => change.id), [3]); apply(m, turned);
  const after = samplePoseChain(m, chain, 500, 0); vectorNear(after.end.toArray(), pose.end.toArray()); assert.ok(Math.abs(after.rotations[2].dot(pose.rotations[2])) < .999);
});

test('IK to direct bone rotation to IK seeds the new pose with no stale target', () => {
  const m = fixture(), start = samplePoseChain(m, chain, 500, 0); apply(m, solvePoseLimb(m, chain, 500, 0, start.end.clone().add(new Vector3(-2, 1, 0))));
  applyMovementTransform(m, [1], 500, 0, { mode: 'rotate', axis: 'Z', amount: 20 });
  const edited = samplePoseChain(m, chain, 500, 0), result = solvePoseLimb(m, chain, 500, 0, edited.end);
  const bytes = structuredClone(m); assert.equal(apply(m, result), 0); assert.deepEqual(m, bytes);
  const target = edited.end.clone().add(new Vector3(0, 0, 1)); apply(m, solvePoseLimb(m, chain, 500, 0, target)); check(m, chain, edited, target);
});

test('writer rejects globals, overlap, malformed and restricted tracks atomically', () => {
  for (const prepare of [m => { m.Bones[2].Rotation = { ...track([0, [0, 0, 0, 1]]), GlobalSeqId: 0 }; m.GlobalSequences = [1000]; }, m => { m.Sequences[1].Interval = [900, 3000]; }]) {
    const m = fixture(); prepare(m); const original = structuredClone(m), changes = [1, 2].map(id => ({ id, property: 'Rotation', value: q([0, 0, 1], .4) })); assert.throws(() => applyMovementPose(m, changes, 500, 0), /global|shared/); assert.deepEqual(m, original);
  }
  const m = fixture(), pose = samplePoseChain(m, chain, 500, 0), result = solvePoseLimb(m, chain, 500, 0, pose.end.clone().add(new Vector3(-1, 1, 0)));
  assert.throws(() => applyMovementPose(m, result.changes, 500, 0, { rotation: true }), /restricted/); assert.ok(applyMovementPose(m, result.changes, 500, 0, { translation: true }) > 0);
});

test('missing/keyless tracks seed only active interval, preserve gaps, other intervals and cubic tangents', () => {
  for (const line of [1, 2, 3]) {
    const m = fixture(), old = track([50, [0, 0, 0, 1]], [500, q([0, 0, 1], .1)], [1500, q([1, 0, 0], .2)], [2000, q([0, 1, 0], .3)]); old.LineType = line;
    if (line >= 2) for (const key of old.Keys) { key.InTan = new Float32Array(q([1, 0, 0], .2)); key.OutTan = new Float32Array(q([0, 0, 1], .2)); }
    m.Bones[1].Rotation = old; const before = structuredClone(old), value = q([0, 0, 1], .5);
    applyMovementPose(m, [{ id: 1, property: 'Rotation', value }, { id: 2, property: 'Rotation', value }], 500, 0);
    assert.equal(m.Bones[1].Rotation.LineType, line); assert.deepEqual(m.Bones[1].Rotation.Keys.filter(k => k.Frame !== 500), before.Keys.filter(k => k.Frame !== 500));
    assert.deepEqual(m.Bones[2].Rotation.Keys.map(k => k.Frame), [100, 500, 1000]); assert.deepEqual(sampleTrack(m.Bones[2].Rotation, 2500, { interval: m.Sequences[1].Interval, quaternion: true, fallback: [0, 0, 0, 1] }), [0, 0, 0, 1]);
    if (line >= 2) { const delta = new Quaternion().fromArray(value).multiply(new Quaternion().fromArray(before.Keys[1].Vector).normalize().invert()); vectorNear(Array.from(m.Bones[1].Rotation.Keys[1].InTan), delta.multiply(new Quaternion().fromArray(before.Keys[1].InTan)).toArray()); }
  }
});

test('body mapping follows hierarchy, and one/two simultaneous pins preserve feet and lengths', () => {
  assert.equal(suggestPoseBody(fixture(), [leg1, leg2]), 0); assert.throws(() => validatePoseBody(fixture(), 1, [leg1, leg2]), /drives/);
  for (const legs of [[leg1], [leg1, leg2]]) {
    const m = fixture(), original = structuredClone(m), poses = legs.map(c => samplePoseChain(m, c, 500, 0)), displacement = new Vector3(.6, .1, -.6);
    const result = solvePoseBody(m, 0, legs.map(chain => ({ chain })), 500, 0, displacement); assert.deepEqual(m, original);
    assert.equal(result.changes.filter(change => change.property === 'Translation').length, 1); assert.ok(result.changes.every(change => change.id === 0 && change.property === 'Translation' || change.property === 'Rotation'));
    apply(m, result); legs.forEach((c, i) => { const after = samplePoseChain(m, c, 500, 0); vectorNear(after.end.toArray(), poses[i].end.toArray()); vectorNear(after.lengths, poses[i].lengths); near(Math.abs(after.rotations[2].dot(poses[i].rotations[2])), 1, 1e-7); });
    vectorNear(Array.from(sampleTrack(m.Bones[0].Translation, 500, { interval: m.Sequences[0].Interval, fallback: [0, 0, 0] })), displacement.toArray());
  }
});

test('body unreachable either leg rejects the whole solve, restrictions prevent all writes', () => {
  const m = fixture(), before = structuredClone(m); assert.throws(() => solvePoseBody(m, 0, [leg1, leg2].map(chain => ({ chain })), 500, 0, [0, 0, 100]), /out of reach/); assert.deepEqual(m, before);
  const result = solvePoseBody(m, 0, [leg1, leg2].map(chain => ({ chain })), 500, 0, [.5, 0, -.5]);
  for (const restriction of [{ translation: true }, { rotation: true }]) { assert.throws(() => applyMovementPose(m, result.changes, 500, 0, restriction), /restricted/); assert.deepEqual(m, before); }
  const zero = solvePoseBody(m, 0, [leg1, leg2].map(chain => ({ chain })), 500, 0, [0, 0, 0]); assert.equal(apply(m, zero), 0);
});

test('display scopes native channels and hidden/invalid handles cannot intercept; real pivot centers stay pickable', () => {
  const m = fixture(), config = { enabled: true, chains: [chain, leg1, leg2], body: 0, pins: ['l', 'r'], target: { kind: 'body' } };
  assert.deepEqual(poseTrackScope(config, { kind: 'endpoint', key: 'a' }, 'rotate'), [{ id: 3, property: 'Rotation' }]);
  assert.equal(poseTrackScope(config, config.target, 'move').length, 7);
  const camera = new PerspectiveCamera(42, 1, .1, 1000); camera.position.set(50, -100, 60); camera.lookAt(0, 0, 10); camera.updateMatrixWorld();
  const handles = projectPoseHandles(m, config, 500, 0, camera, 600, 600), hand = handles.find(h => h.key === 'a');
  assert.equal(pickPoseHandle([hand], hand.x, hand.y), null); assert.equal(pickPoseHandle([hand], hand.x + 13, hand.y), hand);
  assert.deepEqual(projectPoseHandles(m, { ...config, enabled: false }, 500, 0, camera, 600, 600), []);
  m.Bones[2].Parent = 0; assert.ok(!projectPoseHandles(m, config, 500, 0, camera, 600, 600).some(h => h.key === 'a'));
});

test('Knight SD arm native solve, atomic Undo/Redo and MDX reopen preserve all other data/chunks', () => {
  const path = new URL('fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx', import.meta.url), bytes = fs.readFileSync(path), hash = createHash('sha256').update(bytes).digest('hex');
  const doc = openDocument(bytes, 'Knight.mdx'), original = structuredClone(doc.model), c = { root: 23, middle: 37, end: 46 }, pose = samplePoseChain(doc.model, c, 2000, 1), target = pose.end.clone().add(new Vector3(2, 1, 1));
  assert.equal(applyMovementPose(doc.model, solvePoseLimb(doc.model, c, 2000, 1, pose.end).changes, 2000, 1), 0, 'no-op retains rounded authored quaternions'); assert.deepEqual(doc.model, original);
  const result = solvePoseLimb(doc.model, c, 2000, 1, target); doc.apply('POSE', ['Nodes'], m => applyMovementPose(m, result.changes, 2000, 1));
  const edited = structuredClone(doc.model), strip = model => { const copy = structuredClone(model); for (const key of ['Bones', 'Nodes']) for (const node of copy[key] || []) if (node && [23, 37, 46].includes(node.ObjectId)) delete node.Rotation; return copy; };
  assert.deepEqual(strip(edited), strip(original)); assert.ok(doc.undo()); assert.deepEqual(doc.model, original); assert.equal(doc.undo(), false); assert.ok(doc.redo()); assert.deepEqual(doc.model, edited);
  // This imported fixture has an existing MDL conversion failure for helper
  // type flags even before editing. Its MDX path remains losslessly testable.
  assert.throws(() => openDocument(bytes, 'Knight.mdx').serialize('mdl'), /Helpers\[0\].Flags/);
  for (const format of ['mdx']) { const saved = doc.serialize(format), reopen = openDocument(saved, `pose.${format}`); const after = samplePoseChain(reopen.model, c, 2000, 1); near(after.end.distanceTo(target), 0, .002); near(Math.abs(after.rotations[2].dot(pose.rotations[2])), 1, 1e-6); }
  const saved = doc.serialize('mdx'), oldChunks = parseMdx(bytes).chunks, newChunks = parseMdx(saved).chunks;
  for (const chunk of oldChunks) if (chunk.tag !== 'BONE') { const other = newChunks.find(item => item.tag === chunk.tag); assert.deepEqual(Buffer.from(saved).subarray(other.offset, other.payloadOffset + other.declaredSize), bytes.subarray(chunk.offset, chunk.payloadOffset + chunk.declaredSize), `${chunk.tag} unchanged`); }
  assert.equal(createHash('sha256').update(fs.readFileSync(path)).digest('hex'), hash);
});

const nativeFixture = process.env.MDLXL_POSE_FIXTURE || new URL('../out/pose/Footman.mdx', import.meta.url);
test('native SD Footman limb/body preserves both foot pins and all other data through MDL and MDX', { skip: !fs.existsSync(nativeFixture) }, () => {
  const bytes = fs.readFileSync(nativeFixture), hash = createHash('sha256').update(bytes).digest('hex'), doc = openDocument(bytes, 'Footman.mdx'), original = structuredClone(doc.model);
  const arm = { root: 36, middle: 37, end: 38 }, legs = [{ root: 27, middle: 28, end: 29 }, { root: 30, middle: 31, end: 32 }];
  const pose = samplePoseChain(doc.model, arm, 500, 0), target = pose.end.clone().add(new Vector3(-1, 0, 2)), feet = legs.map(chain => samplePoseChain(doc.model, chain, 500, 0));
  doc.apply('Arm', ['Nodes'], m => applyMovementPose(m, solvePoseLimb(m, arm, 500, 0, target).changes, 500, 0));
  doc.apply('Body with two pins', ['Nodes'], m => applyMovementPose(m, solvePoseBody(m, 26, legs.map(chain => ({ chain })), 500, 0, [0, 0, -1]).changes, 500, 0));
  const permitted = new Set([27, 28, 29, 30, 31, 32, 36, 37, 38]), strip = model => { const copy = structuredClone(model); for (const key of ['Nodes', 'Bones', 'Helpers']) for (const node of copy[key] || []) if (node) { if (permitted.has(node.ObjectId)) delete node.Rotation; if (node.ObjectId === 26) delete node.Translation; } return copy; };
  assert.deepEqual(strip(doc.model), strip(original));
  for (const node of allNodes(original)) for (const property of ['Translation', 'Rotation']) {
    if (!(permitted.has(node.ObjectId) && property === 'Rotation' || node.ObjectId === 26 && property === 'Translation')) continue;
    const after = allNodes(doc.model).find(item => item.ObjectId === node.ObjectId);
    assert.deepEqual(after[property]?.Keys?.filter(key => key.Frame < 167 || key.Frame > 1667) || [], node[property]?.Keys?.filter(key => key.Frame < 167 || key.Frame > 1667) || []);
  }
  for (const format of ['mdx', 'mdl']) {
    const saved = doc.serialize(format), reopened = openDocument(saved, `posed.${format}`);
    assertModelEquivalent(strip(original), strip(reopened.model));
    near(samplePoseChain(reopened.model, arm, 500, 0).end.distanceTo(target), 0, .002);
    legs.forEach((chain, i) => { const after = samplePoseChain(reopened.model, chain, 500, 0); vectorNear(after.end.toArray(), feet[i].end.toArray(), .002); vectorNear(after.lengths, feet[i].lengths, .002); near(Math.abs(after.rotations[2].dot(feet[i].rotations[2])), 1, 1e-6); });
    if (format === 'mdx') for (const chunk of parseMdx(bytes).chunks) if (!['BONE', 'HELP'].includes(chunk.tag)) { const match = parseMdx(saved).chunks.find(item => item.tag === chunk.tag); assert.deepEqual(Buffer.from(saved).subarray(match.offset, match.payloadOffset + match.declaredSize), bytes.subarray(chunk.offset, chunk.payloadOffset + chunk.declaredSize), `${chunk.tag} preserved`); }
  }
  assert.equal(createHash('sha256').update(fs.readFileSync(nativeFixture)).digest('hex'), hash);
});

test('one body operation is atomic history, including absent tracks restored by Undo', () => {
  const doc = createStarterDocument(); doc.apply('Rig fixture', ['Nodes', 'Sequences', 'PivotPoints'], m => {
    const data = fixture(); m.Sequences = data.Sequences;
    for (let id = 1; id < 10; id++) createNode(m, 'Bone');
    data.Bones.forEach((node, id) => { Object.assign(m.Bones[id], node); m.PivotPoints[id] = m.Bones[id].PivotPoint = new Float32Array(node.PivotPoint); });
  });
  const clean = openDocument(doc.serialize('mdx'), 'rig.mdx'), before = structuredClone(clean.model), result = solvePoseBody(clean.model, 0, [leg1, leg2].map(chain => ({ chain })), 500, 0, [.5, 0, -.5]);
  assert.deepEqual(solvePoseBody(clean.model, 0, [leg1, leg2].map(chain => ({ chain })), 500, 0, [0, 0, 0]).changes, []);
  clean.apply('Body', ['Nodes'], m => applyMovementPose(m, result.changes, 500, 0)); const after = structuredClone(clean.model);
  assert.ok(clean.undo()); assert.deepEqual(clean.model, before); assert.equal(clean.undo(), false); assert.ok(clean.redo()); assert.deepEqual(clean.model, after);
  for (const format of ['mdx', 'mdl']) { const reopened = openDocument(clean.serialize(format), `body.${format}`); for (const c of [leg1, leg2]) { const original = samplePoseChain(before, c, 500, 0), saved = samplePoseChain(reopened.model, c, 500, 0); vectorNear(saved.end.toArray(), original.end.toArray()); near(Math.abs(saved.rotations[2].dot(original.rotations[2])), 1, 1e-6); } }
  const failed = structuredClone(clean.model); assert.throws(() => clean.apply('Failed body', ['Nodes'], m => { const bad = [...result.changes, { id: 9, property: 'Translation', value: [NaN, 0, 0] }]; applyMovementPose(m, bad, 500, 0); })); assert.deepEqual(clean.model, failed); assert.ok(clean.undo()); assert.deepEqual(clean.model, before);
});
