import test from 'node:test';
import assert from 'node:assert/strict';
import { viewportPointDepth, viewportPointIndices, viewportSelectionKey } from '../app/viewport-point-selection.js';

test('a newly active geoset with no vertex selection uses its existing non-indexed points immediately', () => {
  assert.deepEqual(viewportPointIndices(250000), { unselected: null, selected: [] });
});

test('selected and hidden vertices receive separate point indices', () => {
  assert.deepEqual(viewportPointIndices(6, [1, 4], [2]), { unselected: [0, 3, 5], selected: [1, 4] });
});

test('wireframe vertices render once above lines while General View preserves depth and optional X-Ray', () => {
  assert.deepEqual(viewportPointDepth(true, false), { depthTest: false, showHidden: false });
  assert.deepEqual(viewportPointDepth(true, true), { depthTest: false, showHidden: false });
  assert.deepEqual(viewportPointDepth(false, false), { depthTest: true, showHidden: false });
  assert.deepEqual(viewportPointDepth(false, true), { depthTest: true, showHidden: true });
  assert.deepEqual(viewportPointDepth(false, false, true), { depthTest: true, showHidden: true }, 'Grabthrough draws occluded textured vertices');
});

test('selection signatures retain selected/hidden IDs, visible scope, tools and appearance independently of camera and frame', () => {
  const props = { selectedGeoset: 0, selectedVertices: [1, 4], selectableGeosets: new Set([0]), visibleGeosets: new Set([0, 2]), hiddenVertices: {0: new Set([3])}, mode: 'wireframe', sequenceIndex: -1, transformMode: 'select' };
  const visual = { selectedVertex: '#ff0000' }, key = viewportSelectionKey(props, visual);
  assert.equal(viewportSelectionKey({...props, selectionByGeoset: {0: new Set([1, 4])}}, visual), key);
  assert.equal(viewportSelectionKey({...props, time: 987, cameraMode: 'rotate', view: 'perspective'}, visual), key);
  for (const patch of [{ selectedVertices: [4] }, { hiddenVertices: {0: [2]} }, { selectableGeosets: [2] }, { mode: 'textured' }, { sequenceIndex: 0 }, { transformMode: 'translate' }]) assert.notEqual(viewportSelectionKey({...props, ...patch}, visual), key);
  assert.notEqual(viewportSelectionKey(props, {selectedVertex: '#00ff00'}), key);
  const visible = viewportSelectionKey(props, visual, true);
  assert.notEqual(visible, key, 'editor includes geosets left visible; Paint retains its editable scope');
  assert.notEqual(viewportSelectionKey({...props, visibleGeosets: [0]}, visual, true), visible);
  assert.equal(viewportSelectionKey({...props, visibleGeosets: [2]}, visual), key);
});
