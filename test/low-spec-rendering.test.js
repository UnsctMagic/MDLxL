import test from 'node:test';
import assert from 'node:assert/strict';
import { isSoftwareRenderer, detectRenderer } from '../app/renderer-detection.js';
import { viewportPixelRatio } from '../app/viewport-quality.js';
import { createEventPreview } from '../app/event-preview-runtime.js';
import { normalizePreferences, SOFTWARE_RENDERING_GRAPHICS } from '../src/preferences.js';

test('software renderers are recognized by the names Windows and Chromium report', () => {
  for (const name of [
    'ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
    'llvmpipe (LLVM 15.0.7, 256 bits)',
  ]) assert.equal(isSoftwareRenderer(name), true, name);
  for (const name of [
    'ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (AMD, Radeon RX 580 Series (0x00006FDF) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    '', undefined,
  ]) assert.equal(isSoftwareRenderer(name), false, String(name));
});

test('renderer detection reads the unmasked name once and releases its probe context', () => {
  let lost = 0, contexts = 0;
  const gl = { RENDERER: 1, getExtension: name => name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 2 } : { loseContext: () => lost++ },
    getParameter: value => value === 2 ? 'ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)' : 'WebKit WebGL' };
  const canvas = () => ({ getContext: () => (contexts++, gl) });
  const first = detectRenderer(canvas), second = detectRenderer(canvas);
  assert.equal(first.software, true); assert.equal(second, first);
  assert.equal(contexts, 1); assert.equal(lost, 1);
});

test('render resolutions below 1x shrink every 3D view, while 1x and above keep native sharpness', () => {
  for (const device of [1, 1.25, 2]) {
    assert.equal(viewportPixelRatio({ antialias: false, pixelRatio: 0.5 }, device), 0.5);
    assert.equal(viewportPixelRatio({ antialias: true, pixelRatio: 0.75 }, device), 0.75);
    assert.equal(viewportPixelRatio({ antialias: false, pixelRatio: 0.75 }, device, true), 0.75);
    assert.equal(viewportPixelRatio({ antialias: false, pixelRatio: 1 }, device), device);
  }
});

test('the software rendering adjustment is a stored, one-time 30 fps switch', () => {
  assert.deepEqual({ ...SOFTWARE_RENDERING_GRAPHICS }, { antialias: false, maxFps: 30, softwareLow: true });
  assert.equal(normalizePreferences({}).graphics.softwareLow, false);
  const adjusted = normalizePreferences({ rendererRevision: 3, graphics: { pixelRatio: 2, antialias: true, textures: false, ...SOFTWARE_RENDERING_GRAPHICS } }).graphics;
  assert.equal(adjusted.maxFps, 30); assert.equal(adjusted.antialias, false); assert.equal(adjusted.softwareLow, true);
  assert.equal(adjusted.pixelRatio, 2); assert.equal(adjusted.textures, false);
  for (const pixelRatio of [0.5, 0.75]) assert.equal(normalizePreferences({ graphics: { pixelRatio } }).graphics.pixelRatio, pixelRatio);
  assert.equal(normalizePreferences({ graphics: { pixelRatio: 0.25 } }).graphics.pixelRatio, 1.5);
});

test('event preview leaves WebGL state alone on frames without an event effect', async () => {
  const queries = [];
  const gl = new Proxy({}, { get: (target, name) => name in target ? target[name] : typeof name === 'string' && /^[A-Z_0-9]+$/.test(name) ? name : (...args) => { queries.push(name); return null; } });
  const preview = createEventPreview({ gl, model: { Sequences: [{ Name: 'Stand', Interval: [0, 1000] }], EventObjects: [], Nodes: [] }, modelPath: 'unit.mdx', invalidate: () => {}, desktop: null });
  await preview.ready;
  const camera = { position: { clone: () => ({}) } };
  for (let frame = 0; frame < 5; frame++) preview.render({ frame: frame * 100, sequenceIndex: 0, globalTime: frame * 100, camera });
  assert.deepEqual(queries, []);
  preview.dispose();
});
