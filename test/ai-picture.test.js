// The AI's off-screen pictures (mdlxl_capture samples): what the hidden preview is asked to draw.
import test from 'node:test';
import assert from 'node:assert/strict';
import { previewPresentationProps } from '../app/preview-presentation.js';
import { aiPictureProps } from '../src/ai-picture.js';

// What the hidden preview finally draws: the AI job's props after the preview presentation.
const drawn = (job, options = {}) => previewPresentationProps(aiPictureProps({ model: { Geosets: [] }, ...job }, { preferences: { graphics: {} }, ...options }));

test('a wireframe picture reaches the preview as wireframe: mesh lines drawn, surface skipped', () => {
  const wire = drawn({ renderMode: 'wireframe' });
  assert.equal(wire.mode, 'wireframe', 'GamePreview skips the surface only in wireframe mode');
  assert.equal(wire.overlays.wires, true, 'the mesh lines are drawn');
  const textured = drawn({ renderMode: 'textured' });
  assert.equal(textured.mode, 'textured');
  assert.equal(textured.overlays.wires, false, 'an ordinary picture has no mesh lines');
});

test('a plain picture reaches the preview as the untextured Surface View', () => {
  // The Warcraft preview adapter shades every first layer in one grey when mode is 'solid'.
  const plain = drawn({ renderMode: 'solid' });
  assert.equal(plain.mode, 'solid');
  assert.equal(plain.overlays.wires, false);
});
