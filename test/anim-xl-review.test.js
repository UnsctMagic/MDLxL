import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { ANIMXL_DEFAULTS, animXLRetimed, animXLTimeMap, applyAnimXL, buildAnimXL, suggestAnimXLBones } from '../src/anim-xl.js';
import { sampleNodeMatrices, sampleTrack } from '../src/animation.js';

// Regression tests for the engine review findings: AnimXL changes nothing it
// was not asked to change, and time never runs backwards.

const q = deg => new Float32Array(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), deg * Math.PI / 180).toArray());
const rot = (rows, type = 1) => ({ LineType: type, GlobalSeqId: -1, Keys: rows.map(([Frame, deg]) => ({ Frame, Vector: q(deg) })) });
const angleAt = (track, frame, interval) => new Quaternion().fromArray(sampleTrack(track, frame, { interval, quaternion: true, fallback: [0, 0, 0, 1] })).angleTo(new Quaternion()) * 180 / Math.PI;
const twoBones = rotation => ({
  Sequences: [{ Name: 'Loop', Interval: [0, 1000], NonLooping: false }, { Name: 'Other', Interval: [2000, 3000], NonLooping: true }],
  Bones: [{ Name: 'Bone_Pelvis', ObjectId: 0, Parent: -1, Flags: 256, PivotPoint: [0, 0, 0] }, { Name: 'Bone_Arm', ObjectId: 1, Parent: 0, Flags: 256, PivotPoint: [0, 0, 20], Rotation: rotation }],
  Helpers: [], Geosets: [], PivotPoints: [[0, 0, 0], [0, 0, 20]], GlobalSequences: [],
});

test('AnimXL with nothing turned up leaves an authored loop seam alone', () => {
  const model = twoBones(rot([[0, 0], [500, 90], [1000, 45]]));
  assert.equal(buildAnimXL(model, 0, {}).tracks.length, 0);
});

test('AnimXL keeps another animation that steps between keys stepping', () => {
  const model = twoBones(rot([[0, 0], [500, 90], [1000, 45], [2000, 0], [3000, 90]], 0));
  model.Sequences[0].NonLooping = true;
  const before = [2000, 2500, 2998, 3000].map(t => angleAt(model.Bones[1].Rotation, t, [2000, 3000]));
  applyAnimXL(model, buildAnimXL(model, 0, { overlap: 80 }));
  const after = [2000, 2500, 2998, 3000].map(t => angleAt(model.Bones[1].Rotation, t, [2000, 3000]));
  after.forEach((a, i) => assert.ok(Math.abs(a - before[i]) < 0.01, `frame ${[2000, 2500, 2998, 3000][i]}: ${before[i]} -> ${a}`));
});

test('suggested heavy and loose bones do nothing until their sliders are up', () => {
  const pivots = [[0, 0, 0], [0, 0, 20], [10, 0, 20], [0, 10, 20]], names = ['Bone_Pelvis', 'Bone_Arm', 'Bone_Sword', 'Bone_Tail'];
  const model = { Sequences: [{ Name: 'Attack', Interval: [0, 1000], NonLooping: true }], GlobalSequences: [], PivotPoints: pivots, Geosets: [], Helpers: [],
    Bones: pivots.map((PivotPoint, ObjectId) => ({ ObjectId, Name: names[ObjectId], Parent: ObjectId === 0 ? -1 : ObjectId === 1 ? 0 : 1, PivotPoint, Flags: 256, ...(ObjectId === 1 ? { Rotation: rot([[0, 0], [500, 90], [1000, 0]]) } : {}) })) };
  const picks = suggestAnimXLBones(model);
  assert.deepEqual([picks.heavyIds, picks.looseIds], [[2], [3]]);
  assert.equal(buildAnimXL(model, 0, picks).tracks.length, 0);
  assert.ok(buildAnimXL(model, 0, { ...picks, heavy: 50, loose: 50 }).tracks.some(t => t.id === 2), 'the sword drags once Heavy is up');
});

test('overlapping THUNK holds never run source time backwards', () => {
  const map = animXLTimeMap([0, 500, 1000], { ...ANIMXL_DEFAULTS, thunks: [100, 250, 250] });
  for (let t = 1; t <= 1000; t++) assert.ok(map(t) >= map(t - 1) - 1e-9, `time ran backwards at ${t}`);
  assert.equal(map(1000), 1000);
});

test('a very short animation keeps its last pose at its end', () => {
  const keys = [0, 1, 2, 3, 30];
  assert.deepEqual(animXLRetimed(keys, ANIMXL_DEFAULTS), keys);
  assert.equal(animXLTimeMap(keys, ANIMXL_DEFAULTS)(30), 30);
  const squeezed = animXLRetimed(keys, { retime: { 2: 29 } });
  assert.equal(squeezed[4], 30);
  for (let i = 1; i < squeezed.length; i++) assert.ok(squeezed[i] > squeezed[i - 1]);
});

test('stiff bones get no Life wobble', () => {
  const model = { ...twoBones(rot([[0, 0], [500, 0], [1000, 0]])), Sequences: [{ Name: 'Attack', Interval: [0, 1000], NonLooping: true }] };
  const result = buildAnimXL(model, 0, { life: 100, stiffIds: [1] });
  assert.equal(result.tracks.length, 0);
});

test('a planted foot keeps its authored orientation even when it is already in place', () => {
  const pivots = [[0, 0, 40], [0, 0, 40], [8, 0, 20], [0, 0, 0]], names = ['Bone_Pelvis', 'Bone_Thigh_L', 'Bone_Shin_L', 'Bone_Foot_L'], parents = [-1, 0, 1, 2];
  const model = { Sequences: [{ Name: 'Stand', Interval: [0, 1000], NonLooping: true }], GlobalSequences: [], Helpers: [], Geosets: [], PivotPoints: pivots,
    Bones: pivots.map((PivotPoint, ObjectId) => ({ ObjectId, Name: names[ObjectId], Parent: parents[ObjectId], PivotPoint, Flags: 256, ...(ObjectId === 3 ? { Rotation: rot([[0, 0], [500, 90], [1000, 0]]) } : {}) })) };
  const planted = structuredClone(model);
  applyAnimXL(planted, buildAnimXL(model, 0, { overlap: 70, poses: 0, feet: true }));
  const orientation = matrix => { const r = new Quaternion(); matrix.decompose(new Vector3(), r, new Vector3()); return r; };
  for (let t = 0; t <= 1000; t += 33) {
    const a = sampleNodeMatrices(model, t, 0).get(3), b = sampleNodeMatrices(planted, t, 0).get(3);
    assert.ok(orientation(a).angleTo(orientation(b)) * 180 / Math.PI < 1.5, `foot turned at ${t}`);
  }
});

test('a Weapon Ref at the mouth or on an empty bone is not a weapon; a skinned held part is', () => {
  const bone = (ObjectId, Name, Parent) => ({ ObjectId, Name, Parent, Flags: 256, PivotPoint: [0, 0, ObjectId * 5] });
  const model = {
    Sequences: [{ Name: 'Attack', Interval: [0, 1000], NonLooping: true }], GlobalSequences: [], Helpers: [], PivotPoints: [],
    Bones: [bone(0, 'Bone_Pelvis', -1), bone(1, 'Bone_Head', 0), bone(2, 'Bone_Jaw', 1), bone(3, 'Bone_Hand_R', 0), bone(4, 'Object01', 3), bone(5, 'Bone_Weapon', 3)],
    Attachments: [{ Name: 'Weapon Ref', ObjectId: 6, Parent: 2 }, { Name: 'Weapon Ref Right', ObjectId: 7, Parent: 4 }],
    Geosets: [{ Vertices: new Float32Array(6), VertexGroup: new Uint8Array([0, 1]), Groups: [[2], [4]] }],
  };
  assert.deepEqual(suggestAnimXLBones(model).heavyIds, [4]);
});

test('collapse drops a standing figure to the ground and leaves other animations alone', () => {
  // A stick figure: root > pelvis > spine > head, and two legs, standing 100 units tall.
  const bones = [['Bone_Root', -1, [0, 0, 0]], ['Bone_Pelvis', 0, [0, 0, 50]], ['Bone_Spine', 1, [0, 0, 75]], ['Bone_Head', 2, [0, 0, 100]],
    ['Bone_Thigh_L', 1, [0, 8, 50]], ['Bone_Shin_L', 4, [2, 8, 25]], ['Bone_Foot_L', 5, [0, 8, 2]],
    ['Bone_Thigh_R', 1, [0, -8, 50]], ['Bone_Shin_R', 7, [2, -8, 25]], ['Bone_Foot_R', 8, [0, -8, 2]]];
  const still = { LineType: 1, GlobalSeqId: -1, Keys: [0, 1000, 2000, 3000].map(Frame => ({ Frame, Vector: q(0) })) };
  const model = { Sequences: [{ Name: 'Stand', Interval: [0, 1000], NonLooping: false }, { Name: 'Walk', Interval: [2000, 3000], NonLooping: false }], GlobalSequences: [], Helpers: [], Geosets: [],
    PivotPoints: bones.map(b => b[2]), Bones: bones.map(([Name, Parent, PivotPoint], ObjectId) => ({ Name, ObjectId, Parent, PivotPoint, Flags: 0, Rotation: structuredClone(still) })) };
  const result = buildAnimXL(model, 0, { collapse: 100, collapseAt: 10 });
  assert.ok(result.tracks.length > 0);
  for (const t of result.tracks) for (const k of t.track.Keys) assert.ok(Array.from(k.Vector).every(Number.isFinite));
  const fallen = structuredClone(model);
  applyAnimXL(fallen, result);
  const head = (m, t, seq) => new Vector3(0, 0, 100).applyMatrix4(sampleNodeMatrices(m, t, seq).get(3));
  assert.ok(head(fallen, 1000, 0).z < 30, `the head ends near the ground (z=${head(fallen, 1000, 0).z.toFixed(1)})`);
  assert.ok(head(fallen, 1000, 0).x < -20, 'it falls backwards by default');
  assert.ok(head(fallen, 0, 0).distanceTo(head(model, 0, 0)) < 0.5, 'before it goes limp the animation is unchanged');
  assert.ok(head(fallen, 2500, 1).distanceTo(head(model, 2500, 1)) < 0.01, 'the Walk is untouched');
});

test('a section is shaped on its own: outside it and its edge keys stay exactly as they were', () => {
  const model = { ...twoBones(rot([[0, 0], [250, 60], [500, 90], [750, 30], [1000, 0]])), Sequences: [{ Name: 'Attack', Interval: [0, 1000], NonLooping: true }] };
  const before = structuredClone(model.Bones[1].Rotation);
  const result = buildAnimXL(model, 0, { overlap: 90, settle: 60, poses: 0, range: [250, 750] });
  const shaped = structuredClone(model);
  applyAnimXL(shaped, result);
  const track = shaped.Bones[1].Rotation;
  for (const t of [0, 100, 240, 760, 900, 1000]) assert.ok(Math.abs(angleAt(track, t, [0, 1000]) - angleAt(before, t, [0, 1000])) < 0.05, `unchanged at ${t}`);
  for (const frame of [0, 250, 750, 1000]) assert.deepEqual(Array.from(track.Keys.find(k => k.Frame === frame).Vector), Array.from(before.Keys.find(k => k.Frame === frame).Vector), `original key kept at ${frame}`);
  const inside = [350, 450, 550, 650].map(t => Math.abs(angleAt(track, t, [0, 1000]) - angleAt(before, t, [0, 1000])));
  assert.ok(Math.max(...inside) > 1, `the section itself changes (${inside.map(v => v.toFixed(1)).join(', ')} degrees)`);
  assert.equal(buildAnimXL(model, 0, { overlap: 90, range: [400, 400] }).tracks.length, 0, 'an empty section shapes nothing');
});

test('selected bones: only they are shaped, every other bone keeps its animation exactly', () => {
  const pivots = [[0, 0, 0], [0, 0, 20], [10, 0, 20], [0, 10, 20]], names = ['Bone_Pelvis', 'Bone_Arm', 'Bone_Sword', 'Bone_Tail'];
  const model = { Sequences: [{ Name: 'Attack', Interval: [0, 1000], NonLooping: true }], GlobalSequences: [], PivotPoints: pivots, Geosets: [], Helpers: [],
    Bones: pivots.map((PivotPoint, ObjectId) => ({ ObjectId, Name: names[ObjectId], Parent: ObjectId === 0 ? -1 : ObjectId === 1 ? 0 : 1, PivotPoint, Flags: 256, Rotation: rot(ObjectId === 1 ? [[0, 0], [500, 90], [1000, 0]] : [[0, 0], [1000, 0]]) })) };
  const all = buildAnimXL(model, 0, { overlap: 90, heavy: 80, heavyIds: [2], loose: 80, looseIds: [3], poses: 0 });
  const picked = buildAnimXL(model, 0, { overlap: 90, heavy: 80, heavyIds: [2], loose: 80, looseIds: [3], poses: 0, only: [2] });
  assert.ok(all.tracks.some(t => t.id === 3), 'without a selection the tail is shaped too');
  assert.deepEqual(picked.tracks.map(t => t.id), [2], 'with the sword selected, only the sword is shaped');
});
