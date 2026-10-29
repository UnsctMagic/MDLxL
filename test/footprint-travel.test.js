import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4 } from 'three';
import { createEventPreview } from '../app/event-preview-runtime.js';

// Exercise the event resource loader and actual decal draw transform without a GPU.
async function fixture(name = 'FPTXFHR0') {
  const transforms = [], warnings = [];
  const gl = new Proxy({
    getParameter: () => 0, isEnabled: () => false,
    getShaderParameter: () => true, getProgramParameter: () => true,
    getUniformLocation: (_program, uniform) => uniform,
    uniformMatrix4fv: (uniform, _transpose, matrix) => { if (uniform === 'transform') transforms.push([...matrix]); },
  }, { get: (target, key) => key in target ? target[key] : /^[A-Z_0-9]+$/.test(key) ? key : () => ({}) });
  const model = {
    Sequences: [{ Interval: [0, 1000], MoveSpeed: 380 }, { Interval: [2000, 3000], MoveSpeed: 0 }],
    EventObjects: [{ ObjectId: 0, Name: name, PivotPoint: [100, 15, 0], EventTrack: new Uint32Array([100, 2100]) }],
  };
  const before = structuredClone(model);
  const table = 'ID;PWXL;N;E\nC;X1;Y1;K"Name"\nC;X2;K"file"\nC;X3;K"Lifespan"\nC;X4;K"Scale"\nC;X1;Y2;K"FHR0"\nC;X2;K"Footprint"\nC;X3;K2\nC;X4;K10\nE';
  const preview = createEventPreview({ gl, model, textureAssets: new Map(), onWarnings: value => warnings.push(...value),
    textureFromAsset: async () => ({ image: { width: 1, height: 1 }, dispose() {} }),
    desktop: { resolveEventResources: async ({ names }) => names.map(name => ({ name, bytes: new TextEncoder().encode(table) })) },
  });
  await preview.ready;
  const camera = { projectionMatrix: new Matrix4(), matrixWorldInverse: new Matrix4() };
  const draw = (frame, options = {}) => {
    transforms.length = 0;
    preview.render({ frame, sequenceIndex: 0, globalTime: frame, camera, ...options });
    return transforms.map(matrix => matrix.slice(12, 15));
  };
  return { model, before, preview, draw, warnings };
}

test('hoofprints move behind their contact point while fading; pause, scrub and sequence changes stay deterministic', async () => {
  const f = await fixture();
  try {
    assert.deepEqual(f.draw(100), [[100, 15, 0]], 'new print forms at the hoof');
    assert.deepEqual(f.draw(600), [[-90, 15, 0]], 'half a second of travel leaves the print 190 units behind');
    assert.deepEqual(f.draw(600), [[-90, 15, 0]], 'paused redraw does not accumulate displacement');
    assert.deepEqual(f.draw(350), [[5, 15, 0]], 'backward scrub reconstructs the footprint');
    assert.deepEqual(f.draw(2600, { sequenceIndex: 1 }), [[100, 15, 0]], 'zero-speed sequence keeps its contact point');
    assert.deepEqual(f.draw(600, { travel: false }), [[100, 15, 0]], 'rest/global preview can disable travel');
    assert.deepEqual(f.model, f.before, 'authored model is untouched');
    assert.deepEqual(f.warnings, []);
  } finally { f.preview.dispose(); }
});

test('Showcase footprint age follows animation speed; manual event tests and blood splats retain their placement', async () => {
  const f = await fixture(), blood = await fixture('SPLXFHR0');
  try {
    assert.deepEqual(f.draw(600, { playback: { motionSeconds: .6, speed: 2, clipTime: 300, segment: 0 } }), [[-90, 15, 0]]);
    assert.equal(f.preview.trigger(0, 600, 0, 600), true);
    assert.deepEqual(f.draw(600), [[100, 15, 0]], 'manually triggered footprint stays at the requested point');
    assert.deepEqual(blood.draw(600), [[100, 15, 0]], 'unrelated decals keep their existing behavior');
  } finally { f.preview.dispose(); blood.preview.dispose(); }
});
