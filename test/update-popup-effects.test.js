import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMDX } from 'war3-model';
import { UpdatePopupEffects, darkEyePixels, POPUP_EFFECT_DELAY } from '../src/update-popup-effects.js';
import { eyeScene, eyeTextures } from '../src/update-helmet-assets.js';

test('idle darkening follows the eyes, fills their bright centers and preserves gold and alpha', () => {
  const size = 256, pixels = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([180, 90, 20, 173], i);
  const eyes = [];
  for (const center of [98, 156]) for (let y = 129; y <= 151; y++) for (let x = center - 10; x <= center + 10; x++) {
    const radius = Math.hypot(x - center, y - 140);
    if (radius > 10) continue;
    const offset = (y * size + x) * 4;
    pixels.set(radius < 4 ? [255, 130, 38, 173] : [220, 0, 0, 173], offset);
    eyes.push(offset);
  }
  pixels.set([250, 0, 0, 255], 0); // Unrelated red outside the eye sockets.
  const dark = darkEyePixels(pixels, size, size), selected = new Set(eyes);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    assert.equal(dark[offset + 3], pixels[offset + 3], 'alpha is unchanged');
    if (selected.has(offset)) assert.ok(dark[offset] < 12, 'both red rings and orange centers become dark');
    else assert.deepEqual(dark.subarray(offset, offset + 4), pixels.subarray(offset, offset + 4), 'helmet trim and unrelated red remain unchanged');
  }
});

test('ships the four approved native eye emitters with their original particle settings and textures', () => {
  const buffer = Buffer.from(eyeScene, 'base64');
  const model = parseMDX(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  assert.deepEqual(model.ParticleEmitters2.map(e => e.Name), ['PeyeL1', 'PeyeL2', 'PeyeR1', 'PeyeR2']);
  assert.equal(model.Geosets.length, 0);
  for (const emitter of model.ParticleEmitters2) {
    assert.equal(emitter.Speed, 5); assert.equal(emitter.Gravity, -25); assert.equal(emitter.EmissionRate, 16);
    assert.ok(Math.abs(emitter.LifeSpan - .6) < .000001);
    assert.deepEqual(Array.from(emitter.ParticleScaling), emitter.Name.endsWith('1') ? [2.25, 2.25, 2.25] : [2, 1, 0]);
    const texture = model.Textures[emitter.TextureID].Image;
    assert.ok(eyeTextures[texture]);
    assert.equal(Buffer.from(eyeTextures[texture], 'base64').toString('ascii', 0, 4), 'BLP1');
  }
});

function environment() {
  const original = Object.fromEntries(['document', 'performance', 'AudioContext', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const listeners = new Map(), audio = [];
  let time = 1000;
  const document = { visibilityState: 'visible', addEventListener: (event, callback) => listeners.set(event, callback), removeEventListener: event => listeners.delete(event) };
  class AudioContext {
    constructor() { this.state = 'running'; audio.push(this); }
    async resume() {}
    async close() { this.state = 'closed'; }
  }
  for (const [key, value] of Object.entries({ document, performance: { now: () => time }, AudioContext, requestAnimationFrame: () => 1, cancelAnimationFrame: () => {} })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  return { document, listeners, audio, advance: value => { time += value; }, restore() { for (const [key, descriptor] of Object.entries(original)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } } };
}

test('starts once after visibility and does not restart on status updates or unmuting', async () => {
  const env = environment(), effects = new UpdatePopupEffects();
  try {
    env.document.visibilityState = 'hidden'; effects.open({ muted: true });
    assert.equal(effects.started, undefined); assert.equal(env.audio.length, 0);
    env.document.visibilityState = 'visible'; env.listeners.get('visibilitychange')();
    assert.equal(effects.deadline, 1000 + POPUP_EFFECT_DELAY);
    env.advance(200); effects.open(); effects.setMuted(false);
    assert.equal(effects.deadline, 1650); assert.equal(env.audio.length, 0, 'unmute only restores the next popup sound');
    effects.close(); assert.equal(env.listeners.size, 0);
    effects.open(); assert.equal(effects.deadline, 1850); assert.equal(env.audio.length, 1);
    effects.setMuted(true); effects.setMuted(false);
    assert.equal(env.audio[0].state, 'closed'); assert.equal(env.audio.length, 1);
    effects.close(); await Promise.resolve();
  } finally { effects.close(); env.restore(); }
});

test('closing before audio preparation completes cancels the pending fanfare', async () => {
  const env = environment(), effects = new UpdatePopupEffects();
  try {
    effects.open(); effects.close(); await Promise.resolve();
    assert.equal(env.audio.length, 1); assert.equal(env.audio[0].state, 'closed');
    assert.equal(effects.cancelWarmup, null); assert.equal(effects.active, false);
  } finally { effects.close(); env.restore(); }
});
