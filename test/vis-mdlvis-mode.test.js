import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import VIS_MENU from '../src/vis-view-menu.json' with { type: 'json' };
import VIEW_MENU from '../src/view-menu.json' with { type: 'json' };

const toolbar = readFileSync(new URL('../app/AppToolbar.jsx', import.meta.url), 'utf8').replaceAll('\r', '');
const css = readFileSync(new URL('../app/modules.css', import.meta.url), 'utf8').replaceAll('\r', '');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const classic = readFileSync(new URL('../app/portrait-view.css', import.meta.url), 'utf8').replaceAll('\r', '');
const effectBody = toolbar.match(/useLayoutEffect\(\(\) => \{([\s\S]*?)\n  \}, \[mode, animationPanel, visUI, preferences.language\]\)/)[1];
const layout = new Function('editorRow', 'visUI', 'ResizeObserver', effectBody);

test('VIS clears stale shortening without reading widths or observing the row', () => {
  const attributes = new Set(['data-short-editors']);
  const row = {
    removeAttribute: name => attributes.delete(name),
    get scrollWidth() { assert.fail('VIS measured scrollWidth'); },
    get clientWidth() { assert.fail('VIS measured clientWidth'); },
  };
  layout({ current: row }, true, class { constructor() { assert.fail('VIS installed a ResizeObserver'); } });
  assert.equal(attributes.has('data-short-editors'), false);
});

test('leaving VIS restores overflow measurement and disconnects on the next toggle', () => {
  const attributes = new Set();
  let resize, observed, disconnected = false;
  const row = { scrollWidth: 1200, clientWidth: 900, removeAttribute: name => attributes.delete(name), setAttribute: name => attributes.add(name) };
  const cleanup = layout({ current: row }, false, class {
    constructor(callback) { resize = callback; }
    observe(target) { observed = target; }
    disconnect() { disconnected = true; }
  });
  assert.equal(observed, row);
  assert.equal(attributes.has('data-short-editors'), true);
  row.clientWidth = 1920; resize();
  assert.equal(attributes.has('data-short-editors'), false);
  cleanup(); assert.equal(disconnected, true);
  for (const rule of css.split('\n').filter(line => line.includes('.editor-initial') || line.includes('[data-short-editors]'))) {
    assert.match(rule, /^\.classic-app:not\(\[data-vis-ui\]\)/);
  }
});

const built = await build({ entryPoints: [new URL('../app/QuickDisplay.jsx', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', loader: { '.css': 'empty' }, logLevel: 'silent' });
const module = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const QuickDisplay = module.exports.default;

for (const viewMode of Object.keys(VIS_MENU)) test(`${viewMode}: VIS renders the classic ordered checkbox list; XL retains its icons and menu`, () => {
  for (const vanilla of [true, false]) {
    const menu = (vanilla ? VIS_MENU : VIEW_MENU)[viewMode].filter(([, action]) => action !== 'clearDisplay' && !(vanilla && ['display:bones', 'display:attachments'].includes(action)));
    const checks = Object.fromEntries(menu.map(([, action], i) => [action, i % 2 === 0]));
    const html = renderToStaticMarkup(React.createElement(QuickDisplay, { viewMode, vanilla, checks, isEnabled: action => action !== 'grid', onCommand() {}, onClear() {} }));
    const inputs = [...html.matchAll(/<input ([^>]+)>/g)].map(([, attrs]) => attrs);
    assert.deepEqual(inputs.map(attrs => [attrs.match(/aria-label="([^"]+)"/)[1], attrs.match(/data-hotkey="([^"]+)"/)[1]]), menu);
    inputs.forEach((attrs, i) => {
      assert.match(attrs, /type="checkbox"/);
      assert.equal(attrs.includes('checked=""'), i % 2 === 0);
      assert.equal(attrs.includes('disabled=""'), menu[i][1] === 'grid');
    });
    if (vanilla) assert.doesNotMatch(html, /<svg|look-icon|compact/);
    else assert.match(html, /look-icon/);
    assert.equal((html.match(/>Clear<\/span>/g) || []).length, 1);
  }
});

test('VIS hides tabs and editors, restores classic placements and keeps the approved AI beside XL', () => {
  assert.match(classic, /data-vis-ui\]>\.classic-modules>:not\(\.toolbar-modules\):not\(\.editor-modules\)/);
  assert.match(classic, /data-vis-ui\]>\.classic-modules>\.editor-modules>button/);
  assert.match(classic, /data-vis-ui\]>\.classic-toolbar>\.toolbar-modules>:not\(\.vis-toggle\):not\(\.ai-tool\)/);
  assert.match(app, /const visibleOverlays = visUI \? \{ \.\.\.storedOverlays, bones: true, helpers: true, attachments: true \}/);
  assert.match(app, /'Bones \u00b7 Rest pose'/);
  assert.equal((toolbar.match(/\{moduleDock\}/g) || []).length, 1, 'dock stays mounted once across VIS toggles');
  assert.doesNotMatch(toolbar, /\{!?visUI && moduleDock\}/);
  assert.match(classic, /data-vis-ui\]>\.classic-toolbar>\.toolbar-modules\{position:absolute;top:calc\(100% \+ 3px\)/);
  assert.match(toolbar, /\{visUI && teamPicker\}\n\s*\{visUI && inputStrength\}/);
});
