import test from 'node:test';
import assert from 'node:assert/strict';
import { uvToolState } from '../src/uv-tool-state.js';

// The six tools added on 16 Nov 2026 (docs/agent-tasks/uv-new-tools.md) need whole triangles or
// points to copy onto; test/uv-new-tools.test.js covers their rules.
test('UV edit tools stay available for the captured working selection', () => {
  assert.deepEqual(uvToolState({ selectionCount: 2 }), {
    move: true, rotate: true, scale: true, mirror: true, uncouple: true, fold: true,
    boxProjection: false, cylinderProjection: false, unwrap: false, straighten: true, mirrorCopy: false, relax: false, fit: false,
  });
});

test('only the valid safety and selection requirements disable UV tools', () => {
  assert.deepEqual(uvToolState({ selectionCount: 0 }), {
    move: true, rotate: true, scale: true, mirror: false, uncouple: false, fold: false,
    boxProjection: false, cylinderProjection: false, unwrap: false, straighten: false, mirrorCopy: false, relax: false, fit: false,
  });
  assert.equal(uvToolState({ selectionCount: 2, draftCount: 1 }).uncouple, false);
  assert.deepEqual(uvToolState({ readOnly: true, selectionCount: 2 }), {
    move: false, rotate: false, scale: false, mirror: false, uncouple: false, fold: false,
    boxProjection: false, cylinderProjection: false, unwrap: false, straighten: false, mirrorCopy: false, relax: false, fit: false,
  });});
