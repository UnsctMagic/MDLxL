import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { normalizePreferences } from '../src/preferences.js';
import { exportConfiguration, importConfiguration } from '../src/portable-settings.js';
const api = () => import('../src/rotation-drag.js');
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('old and fresh profiles default every editing Rotate tool to Along the ring at 1x', async () => {
  const prefs = normalizePreferences({ pointerSensitivity: .4, uvSensitivity: .7 });
  assert.deepEqual(prefs.rotation, { behavior: 'ring', sensitivity: 1, editors: {} });
  const { ROTATION_EDITORS, rotationOptions } = await api();
  for (const editor of Object.keys(ROTATION_EDITORS)) assert.deepEqual(rotationOptions(prefs, editor), { behavior: 'ring', sensitivity: 1 });
  assert.equal(prefs.pointerSensitivity, .4); assert.equal(prefs.uvSensitivity, .7);
});
test('rotation behavior and speed inherit independently and survive portable export/import', async () => {
  const { rotationOptions } = await api();
  const prefs = normalizePreferences({ rotationRevision: 2, rotation: { behavior: 'pivot', sensitivity: 2, editors: { uv: { behavior: 'linear' }, forge: { sensitivity: .25 } } } });
  assert.deepEqual(rotationOptions(prefs, 'uv'), { behavior: 'linear', sensitivity: 2 });
  assert.deepEqual(rotationOptions(prefs, 'forge'), { behavior: 'pivot', sensitivity: .25 });
  assert.deepEqual(rotationOptions(prefs, 'movement'), { behavior: 'pivot', sensitivity: 2 });
  assert.deepEqual(importConfiguration(JSON.stringify(exportConfiguration(prefs))).rotation, prefs.rotation);
  const changed = normalizePreferences({ ...prefs, rotation: { ...prefs.rotation, behavior: 'linear', sensitivity: 3 } });
  assert.deepEqual(rotationOptions(changed, 'forge'), { behavior: 'linear', sensitivity: .25 });
  assert.deepEqual(rotationOptions(changed, 'uv'), { behavior: 'linear', sensitivity: 3 });
});
test('invalid rotation data cannot produce reversed, infinite or zero speed', async () => {
  const { normalizeRotationPreferences } = await api();
  assert.deepEqual(normalizeRotationPreferences({ behavior: 'arc', sensitivity: null, editors: { uv: { behavior: 'oops', sensitivity: 'oops' }, unknown: { behavior: 'pivot' } } }), { behavior: 'ring', sensitivity: 1, editors: {} });
  assert.equal(normalizeRotationPreferences({ sensitivity: -3 }).sensitivity, .01);
  assert.equal(normalizeRotationPreferences({ sensitivity: 999 }).sensitivity, 4);
  assert.equal(normalizeRotationPreferences({ sensitivity: Infinity }).sensitivity, 1);
});
test('linear rotation uses displacement only, regardless of pivot or camera sign', async () => {
  const { beginRotationDrag, rotationDragDegrees } = await api();
  for (const pivotSign of [-1, 1]) for (const x of [-100, 0, 100]) {
    const drag = beginRotationDrag({ x, y: 30, pivot: { x: 0, y: 0 }, pivotSign });
    assert.equal(rotationDragDegrees(drag, 30, 0), 30);
    assert.equal(rotationDragDegrees(drag, 60, 0), 60);
    assert.equal(rotationDragDegrees(drag, 0, -30), 30);
    assert.equal(rotationDragDegrees(drag, -30, 0), -30);
    assert.equal(rotationDragDegrees(drag, 0, 30), -30);
    assert.equal(rotationDragDegrees(drag, 30, 30), 0);
    assert.equal(rotationDragDegrees(drag, 0, 0), 0);
    assert.equal(rotationDragDegrees(beginRotationDrag({ sensitivity: .5 }), 30, 0, .4), 6);
  }
});
test('pivot choice follows a circular drag continuously through a full turn and scales the angle', async () => {
  const { beginRotationDrag, rotationDragDegrees } = await api();
  const drag = beginRotationDrag({ behavior: 'pivot', x: 100, y: 0, pivot: { x: 0, y: 0 }, sensitivity: .5, pivotSign: -1 });
  for (let degree=15; degree<=360; degree+=15) {
    const theta=degree*Math.PI/180;
    assert.ok(Math.abs(rotationDragDegrees(drag, 100*Math.cos(theta)-100, 100*Math.sin(theta), 2) + degree) < 1e-8);
  }
  const radial = beginRotationDrag({ behavior: 'pivot', x: 100, y: 0 });
  assert.equal(rotationDragDegrees(radial, 50, 0), 0);
});
test('pivot choice uses the linear rule when the turn circle is seen edge-on', async () => {
  const { beginRotationDrag, rotationDragDegrees } = await api();
  // Front view looking down X turns a ZX (Y-axis) circle into a vertical line.
  const edgeOn = beginRotationDrag({ behavior: 'pivot', x: 0, y: -80, pivot: { x: 0, y: 0 }, facing: 0, pivotSign: -1 });
  assert.equal(rotationDragDegrees(edgeOn, 0, -30), 30);
  assert.equal(rotationDragDegrees(edgeOn, -120, 0), -120);
  assert.equal(rotationDragDegrees(edgeOn, -120, 40), -160);
  // A circle facing the camera still follows the mouse around the center.
  const faced = beginRotationDrag({ behavior: 'pivot', x: 0, y: -80, pivot: { x: 0, y: 0 }, facing: -.9 });
  assert.equal(rotationDragDegrees(faced, 0, -30), 0);
  assert.ok(Math.abs(rotationDragDegrees(faced, 80, 80) - 90) < 1e-8);
});

// A 3/4 view of the world axes (Z up), as the Movement camera sees the Footman.
const threeQuarterAxes = () => {
  const camera = new PerspectiveCamera(); camera.position.set(300, -260, 220); camera.up.set(0, 0, 1); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  return Object.fromEntries([['X', [1, 0, 0]], ['Y', [0, 1, 0]], ['Z', [0, 0, 1]]].map(([name, axis]) => [name, new Vector3(...axis).transformDirection(camera.matrixWorldInverse).toArray()]));
};
// Where the gizmo draws an axis ball: 68 pixels of axis length, projected.
const ball = (axis, pivot = { x: 400, y: 300 }) => ({ x: pivot.x + axis[0] * 68, y: pivot.y - axis[1] * 68, pivot });
// The screen direction (y down) a view-space point starts to move when turned about the axis (right-hand rule).
const screenMotion = (axis, point) => {
  const moved = new Vector3(...point).applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3(...axis).normalize(), 1e-5));
  const x = moved.x - point[0], y = -(moved.y - point[1]), size = Math.hypot(x, y);
  return { x: x / size, y: y / size };
};
test('Along the ring turns X, Y and Z the same for the same pull in a 3/4 view', async () => {
  const { beginRotationDrag, rotationDragDegrees } = await api();
  for (const axis of Object.values(threeQuarterAxes())) {
    const grab = ball(axis), drag = beginRotationDrag({ behavior: 'ring', sensitivity: 1, ...grab, axis });
    const { x, y } = drag.tangent;
    near(Math.hypot(x, y), 1);
    for (const pixels of [1, 10, 40, 90, -40]) near(rotationDragDegrees(drag, x * pixels, y * pixels), pixels);
    near(rotationDragDegrees(drag, -y * 50, x * 50), 0);
    // Rotation sensitivity × pointer DPI is the only speed.
    near(rotationDragDegrees(beginRotationDrag({ behavior: 'ring', sensitivity: .5, ...grab, axis }), x * 40, y * 40, .4), 8);
    // On the axis handle, pulling along the ring moves the ring's near side with the pointer.
    const front = new Vector3(0, 0, 1).projectOnPlane(new Vector3(...axis)).toArray(), motion = screenMotion(axis, front);
    near(motion.x * x + motion.y * y, 1);
  }
});
test('Along the ring keeps the turn direction wherever the ring is grabbed', async () => {
  const { beginRotationDrag, rotationDragDegrees } = await api();
  // Axis facing the camera: every side of the circle turns the same way.
  const pivot = { x: 0, y: 0 };
  for (const [x, y, dx, dy] of [[60, 0, 0, -30], [-60, 0, 0, 30], [0, 60, 30, 0], [0, -60, -30, 0]]) {
    near(rotationDragDegrees(beginRotationDrag({ behavior: 'ring', x, y, pivot, axis: [0, 0, 1] }), dx, dy), 30);
    near(rotationDragDegrees(beginRotationDrag({ behavior: 'ring', x, y, pivot, axis: [0, 0, -1] }), dx, dy), -30);
  }
  // Tilted rings: grabs on opposite sides each follow the grabbed point's own turn.
  let checked = 0;
  for (const axis of Object.values(threeQuarterAxes())) for (const [gx, gy] of [[90, 40], [-90, -40], [-30, 80], [30, -80]]) {
    const drag = beginRotationDrag({ behavior: 'ring', x: gx, y: gy, pivot, axis });
    const [ax, ay, az] = axis;
    if (Math.abs(az) < .3 || Math.abs(gx * ay + gy * ax) / Math.hypot(ax, ay) < 12) continue;
    const point = [gx, -gy, -(ax * gx - ay * gy) / az], motion = screenMotion(axis, point);
    near(motion.x * drag.tangent.x + motion.y * drag.tangent.y, 1);
    assert.ok(rotationDragDegrees(drag, motion.x * 20, motion.y * 20) > 19.99);
    checked++;
  }
  assert.ok(checked >= 8);
  // The direction is fixed for the drag: crossing the pivot never flips it.
  const drag = beginRotationDrag({ behavior: 'ring', x: 60, y: 0, pivot, axis: [0, 0, 1] });
  near(rotationDragDegrees(drag, -120, 0), 0);
  near(rotationDragDegrees(drag, -120, -200), 200);
  near(rotationDragDegrees(drag, 0, -400), 400);
});
test('Along the ring has no dead zone, even when the grab is on the pivot', async () => {
  const { beginRotationDrag, rotationDragDegrees } = await api();
  for (const axis of [[0, 0, 1], [0, 0, -1], ...Object.values(threeQuarterAxes())]) for (const [x, y] of [[0, 0], [1, 0], [3, 4], [0, -11], [8, 8]]) {
    const drag = beginRotationDrag({ behavior: 'ring', x, y, pivot: { x: 0, y: 0 }, axis });
    near(rotationDragDegrees(drag, drag.tangent.x, drag.tangent.y), 1);
    near(rotationDragDegrees(drag, drag.tangent.x * 2, drag.tangent.y * 2), 2);
  }
  // On the center of a camera-facing axis, the pull is screen right.
  assert.deepEqual(beginRotationDrag({ behavior: 'ring', x: 5, y: 5, pivot: { x: 0, y: 0 }, axis: [0, .1, .995] }).tangent, { x: 1, y: 0 });
});
test('Straight drag and Circle the pivot opt-ins keep their old turns with the axis input', async () => {
  const { beginRotationDrag, rotationDragDegrees } = await api();
  for (const axis of [[0, 0, 1], [0, 0, -1], [.2, .3, .93], [.95, .1, -.29], ...Object.values(threeQuarterAxes())]) for (const [x, y] of [[100, 0], [5, 3], [-60, 70]]) {
    const facing = axis[2], explicit = { x, y, pivot: { x: 0, y: 0 }, pivotSign: facing > 0 ? -1 : 1, facing }, derived = { x, y, pivot: { x: 0, y: 0 }, axis };
    const pivotOld = beginRotationDrag({ ...explicit, behavior: 'pivot' }), pivotNew = beginRotationDrag({ ...derived, behavior: 'pivot' });
    for (let step = 1; step <= 24; step++) {
      const dx = Math.cos(step / 4) * 80 - x, dy = Math.sin(step / 4) * 80 - y;
      assert.equal(rotationDragDegrees(pivotNew, dx, dy, .7), rotationDragDegrees(pivotOld, dx, dy, .7));
      assert.equal(rotationDragDegrees(beginRotationDrag({ ...derived, behavior: 'linear' }), dx, dy, .7), (dx - dy) * .7);
    }
  }
});
test('saved profiles move to Along the ring once; later choices and editor overrides stay', () => {
  const saved = { rendererRevision: 3, pointerSensitivity: .6, rotation: { behavior: 'pivot', sensitivity: 2, editors: { uv: { behavior: 'linear' }, movement: { behavior: 'pivot' }, forge: { sensitivity: .25 } } } };
  const migrated = normalizePreferences(saved);
  assert.equal(migrated.rotationRevision, 2);
  assert.deepEqual(migrated.rotation, { behavior: 'ring', sensitivity: 2, editors: { uv: { behavior: 'linear' }, movement: { behavior: 'pivot' }, forge: { sensitivity: .25 } } });
  assert.equal(normalizePreferences({ ...saved, rotation: { behavior: 'linear' } }).rotation.behavior, 'ring');
  for (const behavior of ['linear', 'pivot', 'ring']) {
    const chosen = normalizePreferences({ ...migrated, rotation: { ...migrated.rotation, behavior } });
    assert.equal(chosen.rotation.behavior, behavior);
    assert.equal(normalizePreferences(chosen).rotation.behavior, behavior);
    assert.equal(importConfiguration(JSON.stringify(exportConfiguration(chosen))).rotation.behavior, behavior);
  }
  // A configuration exported before the change imports with the new default.
  const { rotationRevision, ...before } = normalizePreferences(saved);
  assert.equal(importConfiguration(JSON.stringify({ schema: 'mdlxl-configuration', version: 1, preferences: { ...before, rotation: saved.rotation } })).rotation.behavior, 'ring');
});
