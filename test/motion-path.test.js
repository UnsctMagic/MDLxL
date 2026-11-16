import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleNodeMatrices, worldPivot } from '../src/animation.js';
import { motionPathInputs, motionPathMarker, motionPaths, sameInputs } from '../src/motion-path.js';

// A shoulder that turns a quarter circle around Z in Attack, a hand one unit out along X,
// and an unrelated head bone.
const quarter = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
const arm = () => ({
  Sequences: [{ Name: 'Stand', Interval: [0, 500] }, { Name: 'Attack', Interval: [1000, 2000] }],
  PivotPoints: [[0, 0, 0], [1, 0, 0], [0, 0, 2]],
  Bones: [
    { Name: 'Shoulder', ObjectId: 0, Parent: -1, Rotation: { LineType: 1, Keys: [{ Frame: 1000, Vector: [0, 0, 0, 1] }, { Frame: 2000, Vector: quarter }] } },
    { Name: 'Hand', ObjectId: 1, Parent: 0 },
    { Name: 'Head', ObjectId: 2, Parent: -1 },
  ],
});
const close = (actual, expected) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-6, `${actual} vs ${expected}`));

test('a hand follows its turning shoulder: the path is the arc the hand draws', () => {
  const model = arm(), { frames, paths } = motionPaths(model, 1, [1]);
  assert.equal(frames[0], 1000); assert.equal(frames.at(-1), 2000);
  assert.ok(frames.length >= 30, 'about 30 samples a second');
  close(paths[0].points[0], [1, 0, 0]);
  close(paths[0].points.at(-1), [0, 1, 0]);
  // Every sample is where the preview would put the hand at that frame.
  frames.forEach((frame, i) => close(paths[0].points[i], worldPivot(model, 1, sampleNodeMatrices(model, frame, 1), model.Bones[1]).toArray()));
  // The arc stays one unit from the shoulder: a curve, not a straight line between the ends.
  for (const point of paths[0].points) assert.ok(Math.abs(Math.hypot(point[0], point[1]) - 1) < 1e-6);
});

test('the path is per animation, and nothing is drawn without one', () => {
  const model = arm();
  for (const point of motionPaths(model, 0, [1]).paths[0].points) close(point, [1, 0, 0]);
  assert.deepEqual(motionPaths(model, -1, [1]), { frames: [], paths: [] });
  assert.deepEqual(motionPaths(model, 1, [99]), { frames: [], paths: [] });
});

test('long animations are sampled at most `limit` times', () => {
  const model = arm(); model.Sequences[1].Interval = [1000, 61000];
  assert.ok(motionPaths(model, 1, [1]).frames.length <= 241);
});

test('the path is sampled again when the joint or a parent changes, not for unrelated bones', () => {
  const model = arm(), before = motionPathInputs(model, [1]);
  assert.ok(sameInputs(before, motionPathInputs(model, [1])));
  // A drag installs fresh tracks; an unrelated bone's edit does not touch the hand's path.
  model.Bones[2].Rotation = { LineType: 1, Keys: [{ Frame: 1000, Vector: quarter }] };
  assert.ok(sameInputs(before, motionPathInputs(model, [1])));
  model.Bones[0].Rotation = structuredClone(model.Bones[0].Rotation);
  assert.ok(!sameInputs(before, motionPathInputs(model, [1])));
});

test('the moving dot sits on the nearest sample', () => {
  assert.equal(motionPathMarker([1000, 1033, 1067, 1100], 1050), 1);
  assert.equal(motionPathMarker([1000, 1033, 1067, 1100], 5000), 3);
  assert.equal(motionPathMarker([], 10), 0);
});
