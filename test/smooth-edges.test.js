import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, rmSync } from 'node:fs';
import { build } from 'esbuild';
import React from 'react';
import { normalizePreferences, DEFAULT_PREFERENCES } from '../src/preferences.js';
import { SHOWCASE_QUALITY } from '../app/showcase-director.js';
import { graphicsOptions } from '../app/viewport-performance.js';
import { translate } from '../src/localization.js';
import { Scene, PerspectiveCamera, Vector4 } from 'three';
import { createModelSmoothing, createNativeModelSmoothing } from '../app/model-smoothing.js';
const require = createRequire(import.meta.url);
const { welcomePreferences, welcomePromptHtml, modelLookStrings } = require('../electron/welcome-prompt.cjs');
const { SettingsStore } = require('../electron/settings.cjs');
const { tempDir } = require('./helpers/fixtures.cjs');

test('default stays Classic; every saved rendering revision keeps explicit Smooth/Classic and skips the new question', () => {
  assert.equal(DEFAULT_PREFERENCES.graphics.antialias, false);
  assert.equal(normalizePreferences().graphics.antialias, false);
  assert.equal(normalizePreferences().modelLookAnswered, false);
  for (const rendererRevision of [undefined, 1, 2, 3]) for (const antialias of [false, true]) {
    const prefs = normalizePreferences({ rendererRevision, graphics: { antialias } });
    assert.equal(prefs.graphics.antialias, antialias);
    assert.equal(prefs.modelLookAnswered, true);
    assert.deepEqual(normalizePreferences(prefs), prefs);
  }
  for (const old of [{ updateOfferAnswered: true }, { checkUpdatesOnStartup: true }, { theme: 'dark' }]) assert.equal(normalizePreferences(old).modelLookAnswered, true);
  assert.equal(graphicsOptions({ graphics: { antialias: true, softwareLow: true } }).antialias, false);
});

test('the welcome writes the same antialias preference for both choices and preserves existing choices', async () => {
  const out = tempDir('smooth-welcome-');
  try {
    for (const updates of ['yes', 'no']) for (const look of ['smooth', 'classic']) {
      const file = out + '/settings.json', store = new SettingsStore(file, normalizePreferences);
      await store.configure({ preferences: welcomePreferences(updates + '-' + look) });
      const saved = JSON.parse(readFileSync(file, 'utf8')).preferences;
      assert.equal(saved.graphics.antialias, look === 'smooth');
      assert.equal(saved.checkUpdatesOnStartup, updates === 'yes');
      assert.equal(saved.modelLookAnswered, true);
      assert.equal((await new SettingsStore(file, normalizePreferences).load()).preferences.modelLookAnswered, true);
    }
    assert.deepEqual(welcomePreferences('yes'), { updateOfferAnswered: true, checkUpdatesOnStartup: true });
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('the exact first-run wording has Smooth highlighted by default and is translated through the native prompt path', () => {
  for (const language of ['en', 'ru', 'es', 'zh']) {
    const strings = modelLookStrings(text => translate(text, language));
    const html = welcomePromptHtml({ heading: '', question: '', detail: '', note: '', labels: { yes: 'Yes', no: 'No' }, theme: 'light', modelLook: strings });
    assert.match(html, /data-look="smooth" aria-pressed="true" autofocus/);
    assert.match(html, /data-look="classic" aria-pressed="false"/);
    assert.ok(html.includes(strings.question));
    if (language !== 'en') for (const [key, value] of Object.entries(strings)) assert.notEqual(value, modelLookStrings(text => text)[key]);
  }
});

const built = await build({ entryPoints: [new URL('../app/AppToolbar.jsx', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', loader: { '.css': 'empty' }, logLevel: 'silent' });
const module = { exports: {} };
const hooks = { ...React, useRef: value => ({ current: value }), useState: value => [value, () => {}], useEffect() {}, useLayoutEffect() {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(name => name === 'react' ? hooks : require(name), module, module.exports);
function findSwitch(element) {
  if (!element || typeof element !== 'object') return null;
  if (element.props?.className === 'smooth-edges-toggle') return element;
  for (const child of React.Children.toArray(element.props?.children)) { const found = findSwitch(child); if (found) return found; }
  return null;
}
test('the XL toolbar toggles the shared preference both ways and VIS never renders the switch', () => {
  const previousWindow = globalThis.window; globalThis.window = { desktop: {} };
  try {
    let preferences = normalizePreferences();
    const render = visUI => module.exports.default({ preferences, visUI, mode: 'vertices', displayMode: 'vertices', doc: {}, resources: [], teamColor: '#ff0000', commandEnabled: () => true, commands: { current: {} }, changePreferences: update => { preferences = update(preferences); } });
    let button = findSwitch(render(false));
    assert.equal(button.props.title, 'Classic MDLVis'); button.props.onClick();
    assert.equal(preferences.graphics.antialias, true);
    button = findSwitch(render(false)); assert.equal(button.props.title, 'Smooth'); button.props.onClick();
    assert.equal(preferences.graphics.antialias, false);
    assert.equal(findSwitch(render(true)), null);
  } finally { globalThis.window = previousWindow; }
});

test('the multisampled model pass resolves depth before single-sample editor lines; Classic draws both layers directly', () => {
  const calls = [], scene = new Scene(), camera = new PerspectiveCamera();
  const renderer = { autoClear: true, getViewport: v => v.copy(new Vector4(0, 0, 400, 300)), getPixelRatio: () => 2,
    setRenderTarget: target => calls.push(['target', target]), render: (s, c) => calls.push(['render', s, c.layers.mask, renderer.autoClear]) };
  const smooth = createModelSmoothing(renderer);
  smooth.render(scene, camera, true);
  assert.equal(calls[0][1].samples, 0, 'grid/background stays single-sample');
  const target = calls[2][1]; assert.equal(target.samples, 4); assert.equal(target.width, 800); assert.equal(target.height, 600);
  assert.equal(calls[1][2], 4, 'sharp grid/background layer only');
  assert.equal(calls[4][2], 2, 'model layer only');
  assert.equal(calls[5][1], null, 'resolve before compositing');
  assert.equal(calls[7][2], 1, 'editor layer only'); assert.equal(calls[7][3], false, 'preserve resolved depth');
  assert.equal(camera.layers.mask, 1); assert.equal(renderer.autoClear, true);
  calls.length = 0; smooth.render(scene, camera, false);
  assert.equal(calls[0][2], 7, 'Classic directly draws model and editor at native pixels');
  smooth.dispose();
});


test('the native model resolves color and depth before single-sample rig drawing and reuses its target on a toggle', () => {
  const calls = [], glBase = { MAX_SAMPLES: 1, FRAMEBUFFER: 2, RENDERBUFFER: 3, RGBA8: 4, DEPTH_COMPONENT24: 5,
    COLOR_ATTACHMENT0: 6, DEPTH_ATTACHMENT: 7, READ_FRAMEBUFFER: 8, DRAW_FRAMEBUFFER: 9, COLOR_BUFFER_BIT: 16, DEPTH_BUFFER_BIT: 32, NEAREST: 10,
    getParameter: () => 8, getShaderParameter: () => true, getProgramParameter: () => true, createProgram: () => ({}), createFramebuffer: () => 'model-target', createRenderbuffer: () => ({}),
    bindFramebuffer: (...args) => calls.push(['bind', ...args]), bindRenderbuffer() {}, framebufferRenderbuffer() {},
    createTexture: () => ({}), bindTexture() {}, texImage2D() {}, texParameteri() {}, framebufferTexture2D() {}, deleteTexture() {},
    renderbufferStorageMultisample: (...args) => calls.push(['storage', ...args]),
    blitFramebuffer: (...args) => calls.push(['resolve', ...args]), deleteFramebuffer: target => calls.push(['delete', target]), deleteRenderbuffer() {} };
  const gl = new Proxy(glBase, { get: (target, key) => key in target ? target[key] : /^[A-Z_0-9]+$/.test(key) ? key : () => {} });
  const smoothing = createNativeModelSmoothing(gl);
  smoothing.prepare(true, 800, 600); smoothing.resolve();
  assert.equal(calls.filter(c => c[0] === 'storage').length, 2);
  assert.ok(calls.filter(c => c[0] === 'storage').every(c => c[2] === 4), 'four samples for model color and depth');
  assert.deepEqual(calls.find(c => c[0] === 'resolve').slice(1), [0, 0, 800, 600, 0, 0, 800, 600, 48, 10]);
  assert.deepEqual(calls.at(-1), ['bind', 2, null], 'rig helpers draw into the single-sample default framebuffer');
  calls.length = 0; smoothing.prepare(false, 800, 600); smoothing.resolve(); assert.deepEqual(calls, []);
  smoothing.prepare(true, 800, 600); assert.equal(calls.filter(c => c[0] === 'storage').length, 0, 'toggle does not recreate the target');
  smoothing.resolve(); smoothing.dispose(); assert.deepEqual(calls.at(-1), ['delete', 'model-target']);
});


test('Showcase quality cannot override Classic; Low and software still force smoothing off', () => {
  const source = readFileSync(new URL('../app/ShowcaseWorkspace.jsx', import.meta.url), 'utf8');
  const expression = source.split('\n').find(line => line.includes('graphics:{...preferences.graphics,...SHOWCASE_QUALITY[quality]')).trim().slice('graphics:'.length).replace(/,$/, '');
  const graphics = new Function('preferences', 'SHOWCASE_QUALITY', 'quality', 'return (' + expression + ');');
  for (const quality of ['low', 'medium', 'high']) for (const antialias of [false, true]) {
    const result = graphics({ graphics: { antialias } }, SHOWCASE_QUALITY, quality);
    assert.equal(result.antialias, antialias && quality !== 'low');
    assert.equal(result.pixelRatio, SHOWCASE_QUALITY[quality].pixelRatio);
    assert.equal(graphicsOptions({ graphics: { ...result, softwareLow: true } }).antialias, false);
  }
});
