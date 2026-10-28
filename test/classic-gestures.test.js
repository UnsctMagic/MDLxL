import test from 'node:test';
import assert from 'node:assert/strict';
import { alignTowardView, applySelection, dragScale, connectedVertices, insideTriangle, marqueeContainsPoint, moveDragPoint } from '../app/classic-gestures.js';

function moveGesture() {
  const start = { x: 100, y: 100, width: 800, height: 600 };
  const gesture = { pointer: start, point: start, shift: false, axis: null };
  return (x, y, shift) => {
    const point = moveDragPoint(gesture, { ...start, x, y }, shift);
    return [point.x, point.y];
  };
}

test('Shift Move keeps its first direction despite larger perpendicular motion and reversal', () => {
  const horizontal = moveGesture();
  assert.deepEqual(horizontal(80, 100, true), [80, 100]);
  assert.deepEqual(horizontal(80, 20, true), [80, 100]);
  assert.deepEqual(horizontal(120, 20, true), [120, 100]);
  const vertical = moveGesture();
  assert.deepEqual(vertical(100, 80, true), [100, 80]);
  assert.deepEqual(vertical(10, 80, true), [100, 80]);
  assert.deepEqual(vertical(10, 120, true), [100, 120]);
});

test('Shift release and repress at a stationary pointer allow a new direction without a jump', () => {
  const move = moveGesture();
  assert.deepEqual(move(80, 100, true), [80, 100]);
  assert.deepEqual(move(80, 20, true), [80, 100]);
  assert.deepEqual(move(80, 20, false), [80, 100]);
  assert.deepEqual(move(80, 20, true), [80, 100]);
  assert.deepEqual(move(80, 10, true), [80, 90]);
  assert.deepEqual(move(80, 10, true), [80, 90]); // repeated keydown preserves the latch
  assert.deepEqual(move(180, 10, true), [80, 90]);
  assert.deepEqual(move(180, 10, false), [80, 90]);
  assert.deepEqual(move(185, 17, false), [85, 97]);
});

test('pressing Shift during free Move locks the new direction from the current position', () => {
  const move = moveGesture();
  assert.deepEqual(move(160, 110, false), [160, 110]);
  assert.deepEqual(move(160, 110, true), [160, 110]);
  assert.deepEqual(move(160, 100, true), [160, 100]);
  assert.deepEqual(move(100, 100, true), [160, 100]); // pointer returns home; vertex remains moved
});

test('classic selection replaces, Shift adds, Ctrl subtracts without introducing vertices', () => {
  assert.deepEqual(applySelection([1, 2], [2, 3]), [2, 3]);
  assert.deepEqual(applySelection([1, 2], [2, 3], { shift: true }), [1, 2, 3]);
  assert.deepEqual(applySelection([1, 2], [2, 3], { ctrl: true }), [1]);
});

test('classic scale uses horizontal percentage drag and workplane axis constraints', () => {
  assert.deepEqual(dragScale(25), [1.25, 1.25, 1.25]);
  assert.deepEqual(dragScale(-150), [0, 0, 0]);
  assert.deepEqual(dragScale(25, 'xz', true), [1, 1, 1.25]);
  assert.deepEqual(dragScale(25, 'xy', true), [1.25, 1, 1]);
  assert.deepEqual(dragScale(25, 'yz', true), [1, 1.25, 1]);
});

test('marquee selection catches a single vertex marker when the box crosses it', () => {
  const start = { x: 10, y: 10 }, end = { x: 20, y: 20 };
  assert.equal(marqueeContainsPoint([21, 15], start, end, 2), true);
  assert.equal(marqueeContainsPoint([23, 15], start, end, 2), false);
});

test('connected selection reaches neighboring triangles and preserves separate islands', () => {
  assert.deepEqual(connectedVertices([0, 1, 2, 2, 3, 4, 5, 6, 7], [0]).sort(), [0, 1, 2, 3, 4]);
  assert.deepEqual(connectedVertices([0, 1, 2], []), []);
});

test('triangle fallback accepts either winding and rejects outside and degenerate faces', () => {
  assert.equal(insideTriangle([.25, .25], [0, 0], [1, 0], [0, 1]), true);
  assert.equal(insideTriangle([.25, .25], [0, 0], [0, 1], [1, 0]), true);
  assert.equal(insideTriangle([1, 1], [0, 0], [1, 0], [0, 1]), false);
  assert.equal(insideTriangle([.5, 0], [0, 0], [1, 0], [2, 0]), false);
});

test('zoom align lines points up behind the target from the eye, keeping their distance', () => {
  const eye = [0, 0, 10], target = [1, 2, 0], point = [-3, 4, -6], close = (a, b) => a.forEach((value, i) => assert.ok(Math.abs(value - b[i]) < 1e-9, `${a} vs ${b}`));
  const lined = alignTowardView(point, target, { eye }, 1), distance = values => Math.hypot(...values.map((value, i) => value - eye[i]));
  assert.ok(Math.abs(distance(lined) - distance(point)) < 1e-9);
  const ray = target.map((value, i) => value - eye[i]), fromEye = lined.map((value, i) => value - eye[i]);
  close(fromEye.map(value => value / distance(lined)), ray.map(value => value / Math.hypot(...ray)));
  close(alignTowardView(point, target, { eye }, 0), point);
  close(alignTowardView(point, target, { eye }, 2), lined);
  // Orthographic: depth along the view stays, the sideways offset goes.
  close(alignTowardView([5, 7, -3], [1, 2, 0], { direction: [0, 0, -2] }, 1), [1, 2, -3]);
  close(alignTowardView([5, 7, -3], [1, 2, 0], { direction: [0, 0, -1] }, .5), [3, 4.5, -3]);
});
