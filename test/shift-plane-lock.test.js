import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { freeDragTranslation, screenPlaneTranslation } from '../app/viewport-math.js';
import { shiftDragLatch, shiftDragOffset } from '../app/classic-gestures.js';

const width = 800, height = 600, pivot = new Vector3(10, -20, 30);
const normalAxis = { xy: 2, xz: 1, yz: 0 };

function angledCamera() {
  const camera = new PerspectiveCamera(42, width / height, 1, 5000);
  camera.up.set(0, 0, 1);
  camera.position.set(310, -240, 260);
  camera.lookAt(pivot);
  camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  return camera;
}

function screen(camera, point) {
  const ndc = point.clone().project(camera);
  return [(ndc.x + 1) * width / 2, (1 - ndc.y) * height / 2];
}

test('Shift with the workplane off keeps an angled-camera drag inside the chosen plane', () => {
  const camera = angledCamera();
  for (const workplane of ['xy', 'xz', 'yz']) for (const [dx, dy] of [[37, 0], [0, -29], [23, 41], [-60, 15]]) {
    const locked = freeDragTranslation(camera, pivot, width, height, dx, dy, { shift: true, workplane });
    assert.equal(locked.getComponent(normalAxis[workplane]), 0, `${workplane} ${dx},${dy}`);
    assert.ok(locked.length() > 0);
  }
});

test('the old screen-axis Shift lock leaked out of XY on an angled camera', () => {
  const camera = angledCamera();
  const old = screenPlaneTranslation(camera, pivot, width, height, 4, -37, true);
  assert.ok(Math.abs(old.z) > .5, 'regression guard: the angled camera really is off-plane');
});

test('a plane-locked vertex follows the cursor on screen', () => {
  const camera = angledCamera(), [sx, sy] = screen(camera, pivot);
  for (const workplane of ['xy', 'xz', 'yz']) {
    const offset = freeDragTranslation(camera, pivot, width, height, 3, -2, { shift: true, workplane });
    const [ex, ey] = screen(camera, pivot.clone().add(offset));
    assert.ok(Math.abs(ex - sx - 3) < .05 && Math.abs(ey - sy + 2) < .05, `${workplane}: ${ex - sx}, ${ey - sy}`);
  }
});

test('without Shift the workplane-off drag still follows the screen plane', () => {
  const camera = angledCamera();
  const free = freeDragTranslation(camera, pivot, width, height, 20, 10);
  assert.deepEqual(free.toArray(), screenPlaneTranslation(camera, pivot, width, height, 20, 10).toArray());
});

test('Shift never flips the lock as the cursor turns from sideways to up', () => {
  const camera = angledCamera(), latch = shiftDragLatch({ x: 0, y: 0 }, true);
  const solve = (from, to, shift) => freeDragTranslation(camera, pivot, width, height, to.x - from.x, to.y - from.y, { shift, workplane: 'xy' }).toArray();
  let previous = null;
  for (let step = 0; step <= 40; step++) {
    const angle = step / 40 * Math.PI / 2, pointer = { x: 50 * Math.cos(angle), y: -50 * Math.sin(angle) };
    const offset = new Vector3().fromArray(shiftDragOffset(latch, pointer, true, solve));
    assert.equal(offset.z, 0);
    if (previous) assert.ok(offset.distanceTo(previous) < 3, `step ${step} jumped ${offset.distanceTo(previous)}`);
    previous = offset;
  }
});

test('pressing or releasing Shift mid-drag keeps the held vertices where they are', () => {
  const camera = angledCamera(), latch = shiftDragLatch({ x: 0, y: 0 }, false);
  const same = (actual, expected, message) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-6, message));
  const solve = (from, to, shift) => freeDragTranslation(camera, pivot, width, height, to.x - from.x, to.y - from.y, { shift, workplane: 'xy' }).toArray();
  const before = shiftDragOffset(latch, { x: 40, y: 25 }, false, solve);
  same(shiftDragOffset(latch, { x: 40, y: 25 }, true, solve), before, 'press at rest');
  const locked = shiftDragOffset(latch, { x: 70, y: 5 }, true, solve);
  assert.ok(Math.abs(locked[2] - before[2]) < 1e-9, 'locked travel stays in XY');
  same(shiftDragOffset(latch, { x: 70, y: 5 }, false, solve), locked, 'release at rest');
});
