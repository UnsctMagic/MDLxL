import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { sampleTrack } from '../src/animation.js';
import { buildAnimXL, applyAnimXL, animXLKeyTimes, suggestAnimXLBones, animXLRig } from '../src/anim-xl.js';

const q = deg => Array.from(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), deg * Math.PI / 180).toArray());
const key = (Frame, deg) => ({ Frame, Vector: new Float32Array(q(deg)) });

function model() {
  return {
    Sequences: [{ Name: 'Attack', Interval: new Uint32Array([0, 1000]), NonLooping: true }, { Name: 'Stand', Interval: new Uint32Array([2000, 3000]) }],
    GlobalSequences: [],
    Bones: [
      { Name: 'Bone_Root', ObjectId: 0, Parent: -1, Flags: 0, Translation: { LineType: 1, GlobalSeqId: -1, Keys: [{ Frame: 0, Vector: new Float32Array([0, 0, 0]) }, { Frame: 500, Vector: new Float32Array([30, 0, 0]) }, { Frame: 1000, Vector: new Float32Array([0, 0, 0]) }, { Frame: 2000, Vector: new Float32Array([5, 5, 5]) }] } },
      { Name: 'Bone_Arm', ObjectId: 1, Parent: 0, Flags: 0, Rotation: { LineType: 1, GlobalSeqId: -1, Keys: [key(0, 0), key(500, 90), key(1000, 0), key(2000, 10), key(3000, 10)] } },
      { Name: 'Bone_Sword', ObjectId: 2, Parent: 1, Flags: 0 },
    ],
    Helpers: [], PivotPoints: [[0, 0, 0], [0, 0, 50], [10, 0, 50]],
  };
}
const angleAt = (track, frame, interval = [0, 1000]) => {
  const v = sampleTrack(track, frame, { interval, quaternion: true, fallback: [0, 0, 0, 1] });
  return new Quaternion(v[0], v[1], v[2], v[3]).angleTo(new Quaternion()) * 180 / Math.PI;
};

test('all sliders at zero leave the animation untouched', () => {
  assert.deepEqual(buildAnimXL(model(), 0, {}).tracks, []);
});

test('ease keeps every authored pose and changes the spacing between them', () => {
  const m = model(), result = buildAnimXL(m, 0, { ease: 100 });
  const arm = result.tracks.find(t => t.id === 1);
  assert.ok(arm, 'arm track rewritten');
  for (const [frame, deg] of [[0, 0], [500, 90], [1000, 0]]) assert.ok(Math.abs(angleAt(arm.track, frame) - deg) < 0.5, `pose at ${frame}`);
  assert.ok(Math.abs(angleAt(arm.track, 125) - angleAt(m.Bones[1].Rotation, 125)) > 3, 'spacing changed');
});

test('overlap makes an unkeyed child drag behind its parent', () => {
  const result = buildAnimXL(model(), 0, { overlap: 80 });
  const sword = result.tracks.find(t => t.id === 2);
  assert.ok(sword, 'sword receives keys');
  assert.ok(angleAt(sword.track, 250) > 2, 'sword lags during the swing');
  assert.equal(sword.track.Keys.every(k => k.Frame >= 0 && k.Frame <= 1000), true);
});

test('keys belonging to other animations are preserved exactly', () => {
  const m = model(), result = buildAnimXL(m, 0, { ease: 60, overlap: 60, settle: 60, weight: 60 });
  const arm = result.tracks.find(t => t.id === 1).track;
  const outside = arm.Keys.filter(k => k.Frame >= 2000);
  assert.deepEqual(outside.map(k => [k.Frame, Array.from(k.Vector)]), m.Bones[1].Rotation.Keys.slice(3).map(k => [k.Frame, Array.from(k.Vector)]));
  applyAnimXL(m, result);
  assert.ok(Math.abs(angleAt(m.Bones[1].Rotation, 2500, [2000, 3000]) - 10) < 0.01);
});

test('a THUNK holds the pose for a beat at the hit', () => {
  const result = buildAnimXL(model(), 0, { thunks: [500], thunk: 100 });
  const arm = result.tracks.find(t => t.id === 1).track;
  assert.ok(Math.abs(angleAt(arm, 560) - 90) < 1, 'still on the hit pose after 60 ms');
  assert.ok(angleAt(arm, 1000) < 0.5, 'returns to the final pose');
});

test('key times and name suggestions', () => {
  assert.deepEqual(animXLKeyTimes(model(), 0), [0, 500, 1000]);
  assert.deepEqual(suggestAnimXLBones(model()).heavyIds, [2]);
});

test('hit poses lands overlapping bones exactly on the key pose', () => {
  const loose = buildAnimXL(model(), 0, { overlap: 90, poses: 0 }).tracks.find(t => t.id === 1).track;
  const exact = buildAnimXL(model(), 0, { overlap: 90, poses: 100 }).tracks.find(t => t.id === 1).track;
  assert.ok(Math.abs(angleAt(loose, 500) - 90) > 1, 'overlap alone misses the pose');
  assert.ok(Math.abs(angleAt(exact, 500) - 90) < 0.6, 'hit poses lands it');
});

test('weight lags the body and keeps other animations', () => {
  const m = model();
  assert.equal(animXLRig(m, 0).body, 0);
  const body = buildAnimXL(m, 0, { weight: 100, poses: 0 }).tracks.find(t => t.id === 0 && t.property === 'Translation');
  assert.ok(body, 'body translation written');
  const x = frame => sampleTrack(body.track, frame, { interval: [0, 1000], fallback: [0, 0, 0] })[0];
  assert.ok(x(250) < 14, `body lags the authored path (x=${x(250)})`);
  assert.deepEqual(Array.from(body.track.Keys.find(k => k.Frame === 2000).Vector), [5, 5, 5]);
});

test('a flinch knocks the body back', () => {
  const body = buildAnimXL(model(), 0, { flinches: [200], flinch: 100, poses: 0 }).tracks.find(t => t.property === 'Translation');
  assert.ok(body, 'body moved');
  const x = frame => sampleTrack(body.track, frame, { interval: [0, 1000], fallback: [0, 0, 0] })[0];
  const authored = 30 * 260 / 500;
  assert.ok(x(260) < authored - 2, `pushed back at 260 ms (x=${x(260)}, authored ${authored})`);
});
test('anticipation winds up against the coming move without moving the poses', () => {
  const arm = buildAnimXL(model(), 0, { anticipation: 100 }).tracks.find(t => t.id === 1).track;
  assert.ok(angleAt(arm, 87) < angleAt(model().Bones[1].Rotation, 87) - 5, `wind-up at 87 ms (${angleAt(arm, 87)})`);
  assert.ok(Math.abs(angleAt(arm, 500) - 90) < 0.6, 'pose kept');
});

test('exaggerate pushes poses further from the average', () => {
  const arm = buildAnimXL(model(), 0, { exaggerate: 100 }).tracks.find(t => t.id === 1).track;
  assert.ok(angleAt(arm, 500) > 100, `bigger pose (${angleAt(arm, 500)})`);
});

test('life makes a held pose breathe and loops seamlessly', () => {
  const m = model();
  m.Bones[1].Rotation.Keys = [key(0, 20), key(1000, 20), key(2000, 10), key(3000, 10)];
  m.Sequences[0].NonLooping = false;
  const arm = buildAnimXL(m, 0, { life: 100 }).tracks.find(t => t.id === 1).track;
  const values = [100, 300, 500, 700, 900].map(f => angleAt(arm, f));
  assert.ok(Math.max(...values) - Math.min(...values) > 0.8, `held pose moves (${values.map(v => v.toFixed(2))})`);
  assert.ok(Math.abs(angleAt(arm, 0) - angleAt(arm, 1000)) < 0.3, 'start and end match for looping');
});

test('a flinch from behind pushes the body forward', () => {
  const body = buildAnimXL(model(), 0, { flinches: [200], flinch: 100, poses: 0, flinchBehind: true }).tracks.find(t => t.property === 'Translation');
  const x = frame => sampleTrack(body.track, frame, { interval: [0, 1000], fallback: [0, 0, 0] })[0];
  assert.ok(x(260) > 30 * 260 / 500 + 2, `pushed forward (x=${x(260)})`);
});
