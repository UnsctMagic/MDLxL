import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { animXLRig, applyAnimXL, buildAnimXL } from '../src/anim-xl.js';
import { sampleNodeMatrices } from '../src/animation.js';

const RIGHT = { root: 2, middle: 3, end: 4 };
const LEFT = { root: 6, middle: 7, end: 8 };
const WEAPON = 5;
const FRAMES = [0, 250, 500, 750, 1000];
const SETTINGS = { heavyIds: [WEAPON], heavy: 80, overlap: 70 };
const rotation = angles => ({
  LineType: 1, GlobalSeqId: -1,
  Keys: FRAMES.map((Frame, i) => ({ Frame, Vector: new Float32Array(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), angles[i] * Math.PI / 180).toArray()) })),
});

function fixture(oneHanded = false) {
  // Bent elbows leave enough reach for the shaped weapon; an almost straight
  // arm would make the grip target unreachable and test reach clamping instead.
  const pivots = [[0, 0, 70], [0, 0, 95], [0, -12, 95], [16, -24, 82], [30, -4, 85], [30, -4, 85], [0, 12, 95], [16, 24, 82], [30, 4, 85]];
  const names = ['Bone_Pelvis', 'Bone_Chest', 'Bone_UpperArm_R', 'Bone_Forearm_R', 'Bone_Hand_R', 'Bone_Weapon', 'Bone_UpperArm_L', 'Bone_Forearm_L', 'Bone_Hand_L'];
  const parents = [-1, 0, 1, 2, 3, 4, 1, 6, 7];
  return {
    Sequences: [{ Name: 'Attack', Interval: new Uint32Array([0, 1000]), NonLooping: true }],
    GlobalSequences: [], PivotPoints: pivots, Helpers: [],
    // A 60-unit shaft, bound entirely to the right-hand weapon bone. The left
    // hand's bind pivot is eight units along that shaft from the right hand.
    Geosets: [{ Vertices: new Float32Array([29, -4, 85, 31, -4, 85, 29, 56, 85, 31, 56, 85]), VertexGroup: new Uint8Array([0, 0, 0, 0]), Groups: [[WEAPON]] }],
    Bones: pivots.map((PivotPoint, ObjectId) => ({
      ObjectId, Name: names[ObjectId], Parent: parents[ObjectId], PivotPoint, Flags: 256,
      Rotation: rotation(ObjectId === 1 ? [-35, -10, 55, 15, -35] : oneHanded && ObjectId === LEFT.root ? [0, -50, 35, -65, 20] : [0, 0, 0, 0, 0]),
    })),
  };
}

function handInWeapon(model, frame) {
  const matrices = sampleNodeMatrices(model, frame, 0);
  return new Vector3().fromArray(model.PivotPoints[LEFT.end]).applyMatrix4(matrices.get(LEFT.end)).applyMatrix4(matrices.get(WEAPON).clone().invert());
}
function shaped(model, grip) {
  const copy = structuredClone(model);
  applyAnimXL(copy, buildAnimXL(model, 0, { ...SETTINGS, grip }));
  return copy;
}
function drift(model, hold) {
  let maximum = 0;
  // Five-millisecond sampling also checks between reduced output keys.
  for (let frame = 0; frame <= 1000; frame += 5) maximum = Math.max(maximum, handInWeapon(model, frame).distanceTo(hold));
  return maximum;
}

test('the synthetic swing has two recognised arms and a keyed two-handed hold', () => {
  const model = fixture(), rig = animXLRig(model, 0);
  assert.deepEqual(rig.arms, [RIGHT, LEFT]);
  assert.equal(model.Bones[WEAPON].Parent, RIGHT.end);
  assert.equal(model.Bones[LEFT.end].Rotation.LineType, 1);
  assert.equal(model.Bones[LEFT.end].Rotation.Keys.length, 5);
  assert.ok(drift(model, handInWeapon(model, 0)) < 1e-6, 'authored hand is fixed in the weapon frame throughout the swing');
});

test('heavy weapon and overlap visibly break the hold when grip is off', t => {
  const model = fixture(), maximum = drift(shaped(model, false), handInWeapon(model, 0));
  t.diagnostic(`maximum weapon-local drift with grip off: ${maximum.toFixed(6)} model units`);
  // Measured 7.97 units off versus 0.60 on. Five units separates free drift
  // from the reduced-key interpolation error by a wide margin.
  assert.ok(maximum > 5, `grip-off drift ${maximum}`);
});

test('grip IK keeps the off hand on its weapon-local hold after applying the result', t => {
  const model = fixture(), original = structuredClone(model);
  const maximum = drift(shaped(model, true), handInWeapon(model, 0));
  t.diagnostic(`maximum weapon-local drift with grip on: ${maximum.toFixed(6)} model units`);
  // Default reduction tolerance is 0.008 radians. A 0.75-unit allowance is
  // under 1.6% of this 48.45-unit arm's reach and includes between-key error.
  assert.ok(maximum < 0.75, `grip-on drift ${maximum}`);
  assert.deepEqual(model, original, 'building and applying a copy preserves the authored model');
});

test('a freely moving off hand is not mistaken for a two-handed grip', t => {
  const model = fixture(true), hold = handInWeapon(model, 0);
  const authoredDrift = drift(model, hold);
  t.diagnostic(`one-handed authored weapon-local movement: ${authoredDrift.toFixed(6)} model units`);
  assert.ok(authoredDrift > 20, 'the authored hand leaves its initial weapon-local hold');
  const off = shaped(model, false), on = shaped(model, true);
  for (const id of [LEFT.root, LEFT.middle, LEFT.end]) assert.deepEqual(on.Bones[id].Rotation, off.Bones[id].Rotation, `left arm ${id} unchanged by grip detection`);
  for (let frame = 0; frame <= 1000; frame += 5) assert.ok(handInWeapon(on, frame).distanceTo(handInWeapon(off, frame)) < 1e-8);
});