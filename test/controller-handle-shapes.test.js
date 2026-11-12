import test from 'node:test';
import assert from 'node:assert/strict';
import * as appearance from '../src/controller-appearance.js';

const themes = ['light', 'dark', 'warm-dark', 'nord', 'solarized-light', 'gruvbox-dark', 'catppuccin-mocha'];

test('the POSE handle shape offers no triangle; body and bend shapes still do', () => {
  assert.deepEqual(appearance.HANDLE_SHAPES, ['circle', 'square', 'diamond']);
  assert.ok(appearance.CONTROLLER_SHAPES.includes('triangle'));
});

test('no theme starts the handle as a triangle', () => {
  for (const id of themes) assert.notEqual(appearance.controllerAppearanceForTheme(id).shape, 'triangle', id);
});

test('a saved triangle handle becomes a diamond; saved body and bend triangles stay', () => {
  const out = appearance.normalizeControllerAppearance({ shape: 'triangle', bodyShape: 'triangle', bendShape: 'triangle' });
  assert.equal(out.shape, 'diamond');
  assert.equal(out.bodyShape, 'triangle');
  assert.equal(out.bendShape, 'triangle');
});
