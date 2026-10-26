import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreferences } from '../src/preferences.js';
import { exportConfiguration, importConfiguration } from '../src/portable-settings.js';
const api = () => import('../src/rotation-drag.js');

test('old and fresh profiles default every editing Rotate tool to linear at 1x', async () => {
  const prefs = normalizePreferences({ pointerSensitivity: .4, uvSensitivity: .7 });
  assert.deepEqual(prefs.rotation, { behavior: 'linear', sensitivity: 1, editors: {} });
  const { ROTATION_EDITORS, rotationOptions } = await api();
  for (const editor of Object.keys(ROTATION_EDITORS)) assert.deepEqual(rotationOptions(prefs, editor), { behavior: 'linear', sensitivity: 1 });
  assert.equal(prefs.pointerSensitivity, .4); assert.equal(prefs.uvSensitivity, .7);
});
test('rotation behavior and speed inherit independently and survive portable export/import', async () => {
  const { rotationOptions } = await api();
  const prefs = normalizePreferences({ rotation: { behavior: 'pivot', sensitivity: 2, editors: { uv: { behavior: 'linear' }, forge: { sensitivity: .25 } } } });
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
  assert.deepEqual(normalizeRotationPreferences({ behavior: 'arc', sensitivity: null, editors: { uv: { behavior: 'oops', sensitivity: 'oops' }, unknown: { behavior: 'pivot' } } }), { behavior: 'linear', sensitivity: 1, editors: {} });
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
