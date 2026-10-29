import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4 } from 'three';
import { createEventPreview } from '../app/event-preview-runtime.js';
import { activeEventInstances } from '../app/event-preview-data.js';

// Exercise the event resource loader and actual decal draw transform without a GPU.
async function fixture(name = 'FPTXFHR0') {
  const transforms = [], alphas = [], warnings = [];
  const gl = new Proxy({
    getParameter: () => 0, isEnabled: () => false,
    getShaderParameter: () => true, getProgramParameter: () => true,
    getUniformLocation: (_program, uniform) => uniform,
    uniformMatrix4fv: (uniform, _transpose, matrix) => { if (uniform === 'transform') transforms.push([...matrix]); },
    uniform4fv: (uniform, value) => { if (uniform === 'tint') alphas.push(value[3]); },
  }, { get: (target, key) => key in target ? target[key] : /^[A-Z_0-9]+$/.test(key) ? key : () => ({}) });
  const model = {
    Sequences: [{ Interval: [0, 1000], MoveSpeed: 380 }, { Interval: [2000, 3000], MoveSpeed: 0 }],
    EventObjects: [{ ObjectId: 0, Name: name, PivotPoint: [100, 15, 0], EventTrack: new Uint32Array([100, 2100]) }],
  };
  const before = structuredClone(model);
  const table = 'ID;PWXL;N;E\nC;X1;Y1;K"Name"\nC;X2;K"file"\nC;X3;K"Lifespan"\nC;X4;K"Scale"\nC;X5;K"Decay"\nC;X6;K"EndA"\nC;X1;Y2;K"FHR0"\nC;X2;K"Footprint"\nC;X3;K2\nC;X4;K10\nC;X5;K5\nC;X6;K0\nE';
  const preview = createEventPreview({ gl, model, textureAssets: new Map(), onWarnings: value => warnings.push(...value),
    textureFromAsset: async () => ({ image: { width: 1, height: 1 }, dispose() {} }),
    desktop: { resolveEventResources: async ({ names }) => names.map(name => ({ name, bytes: new TextEncoder().encode(table) })) },
  });
  await preview.ready;
  const camera = { projectionMatrix: new Matrix4(), matrixWorldInverse: new Matrix4() };
  const draw = (frame, options = {}) => {
    transforms.length = 0;
    alphas.length = 0;
    preview.render({ frame, sequenceIndex: 0, globalTime: frame, camera, ...options });
    return transforms.map(matrix => matrix.slice(12, 15));
  };
  return { model, before, preview, draw, warnings, alphas };
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

test('the same footprint survives loop boundaries, keeps moving back, and fades until its full lifetime expires', async () => {
  const f = await fixture();
  const sample = (time, segment = 0) => {
    const frame = time % 1000, footprintPlayback = { motionSeconds: time / 1000, clipTime: time, speed: 1, segment, interval: [0,1000], loop: true };
    const positions = f.draw(frame, { footprintPlayback });
    const items = activeEventInstances(f.model, f.preview.definitions, { sequenceIndex: 0, frame, footprintPlayback });
    return { positions, items, alphas: [...f.alphas] };
  };
  try {
    const before = sample(999), after = sample(1001), key = before.items[0].key;
    assert.equal(after.items[0].key, key, 'loop boundary does not replace the living footprint');
    assert.equal(after.items[0].ageMs, 901);
    assert.ok(Math.abs(after.positions[0][0] - before.positions[0][0] + .76) < 1e-8, 'ground position continues smoothly across wrap');
    assert.equal(sample(1100).items.length, 2, 'next loop adds a new footprint alongside the previous one');
    const fading = sample(6099), oldest = fading.items.findIndex(item => item.key === key);
    assert.equal(fading.items[oldest].ageMs, 5999);
    assert.ok(fading.alphas[oldest] > 0 && fading.alphas[oldest] < .21, 'old footprint is drawn with its natural fading alpha');
    assert.deepEqual(sample(6099), fading, 'paused redraw preserves every living footprint');
    assert.ok(sample(7099).items.some(item => item.key === key), 'original survives until its last millisecond');
    assert.ok(!sample(7100).items.some(item => item.key === key), 'original expires at seven seconds, independently of a loop');
    const seek = sample(350, 1);assert.equal(seek.items.length, 1);assert.notEqual(seek.items[0].key,key);
  } finally { f.preview.dispose(); }
});

test('focused loops repeat only included footprint triggers; other event lifetimes stay unchanged', async () => {
  const f=await fixture(), blood=await fixture('SPLXFHR0');
  const footprintPlayback={motionSeconds:1.6,clipTime:1600,speed:1,segment:0,interval:[0,500],loop:true};
  try {
    assert.equal(f.draw(100,{footprintPlayback}).length,4);
    assert.equal(f.draw(100,{footprintPlayback:{...footprintPlayback,loop:false}}).length,1);
    assert.equal(blood.draw(100,{footprintPlayback}).length,1,'blood does not acquire repeated instances');
    assert.equal(f.draw(300,{footprintPlayback:{...footprintPlayback,interval:[200,500]}}).length,0,'out-of-range hoof contact is excluded');
  } finally { f.preview.dispose();blood.preview.dispose(); }
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
