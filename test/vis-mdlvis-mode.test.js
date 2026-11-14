import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import { createSketchStore } from '../src/ai-sketch.js';
import { renderToStaticMarkup } from 'react-dom/server';
import VIEW_MENU from '../src/view-menu.json' with { type: 'json' };
// The MDLxL look has its own lists (owner's revised spec); VIS keeps view-menu.json.
import XL_VIEW_MENU from '../src/view-menu-xl.json' with { type: 'json' };

const toolbar = readFileSync(new URL('../app/AppToolbar.jsx', import.meta.url), 'utf8').replaceAll('\r', '');
const css = readFileSync(new URL('../app/modules.css', import.meta.url), 'utf8').replaceAll('\r', '');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const display = readFileSync(new URL('../src/useEditorDisplay.js', import.meta.url), 'utf8');
const classic = readFileSync(new URL('../app/portrait-view.css', import.meta.url), 'utf8').replaceAll('\r', '');
const effectBody = toolbar.match(/useLayoutEffect\(\(\) => \{(\s*const row = editorRow\.current;[\s\S]*?)\n  \}, \[mode, animationPanel, visUI, preferences.language\]\)/)[1];
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

for (const viewMode of Object.keys(VIEW_MENU)) test(`${viewMode}: VIS renders the classic ordered checkbox list; XL retains its icons and menu`, () => {
  for (const vanilla of [true, false]) {
    const menu = (vanilla ? VIEW_MENU : XL_VIEW_MENU)[viewMode].filter(([, action]) => action !== 'clearDisplay' && action !== 'axes');
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

test('VIS keeps bottom model tabs, restores classic editors and hides AI while retaining its XL state', () => {
  assert.match(classic, /data-vis-ui\]>\.classic-modules>:not\(\.toolbar-modules\):not\(\.editor-modules\)/);
  assert.match(classic, /data-vis-ui\]>\.classic-modules>\.editor-modules>button/);
  assert.match(classic, /data-vis-ui\]>\.classic-toolbar>\.toolbar-modules>:not\(\.vis-toggle\)/);
  assert.match(classic, /data-vis-ui\] \.ai-assistant\{display:none!important\}/);
  assert.match(classic, /data-vis-ui\]>\.classic-modules\{grid-template-columns:minmax\(0,1fr\);grid-template-rows:auto\}/);
  assert.doesNotMatch(display, /const visibleOverlays = visUI/);
  assert.match(app, /<div className="classic-status"><ModelTabs sessions=\{sessions\} session=\{bitReplacement\?\.original \?\? session\}/);
  assert.doesNotMatch(app, /'Bones \u00b7 Rest pose'/);
  assert.equal((toolbar.match(/\{moduleDock\}/g) || []).length, 1, 'dock stays mounted once across VIS toggles');
  assert.doesNotMatch(toolbar, /\{!?visUI && moduleDock\}/);
  assert.doesNotMatch(classic, /data-vis-ui\][^{}]*toolbar-modules\{position:absolute/);
  assert.match(classic, /data-vis-ui\]>\.classic-toolbar>\.toolbar-modules>\.vis-toggle\{width:auto!important;min-width:38px!important;height:23px!important/);
  assert.match(classic, /data-vis-ui\]>\.classic-toolbar>\.toolbar-modules>\.vis-toggle>:not\(\.module-icon-badge\)\{display:none\}/);
  assert.match(toolbar, /\{visUI && teamPicker\}\n\s*\{visUI && inputStrength\}/);
});

const ai = readFileSync(new URL('../app/AiAssistant.jsx', import.meta.url), 'utf8').replaceAll('\r', '');
const sketchVisibilityBody = ai.match(/useLayoutEffect\(\(\) => \{(\s*if \(open\) setDock[\s\S]*?)\n  \}, \[open, visUI\]\)/)[1];
const syncSketchVisibility = new Function('open', 'visUI', 'setDock', 'document', 'sketchStore', sketchVisibilityBody);

test('entering VIS disarms AI drawing and routes Undo to the model without losing XL drawings', () => {
  const store = createSketchStore(), dock = {};
  const sync = (open, vis) => syncSketchVisibility(open, vis, () => {}, { querySelector: () => dock }, store);
  sync(true, false);
  store.noteModelEdit('model');
  store.add({ documentId: 'model', tool: 'pen', points: [0, 0, 0, 1, 1, 1] });
  store.setTool('pen');
  const drawings = store.strokes('model');
  sync(true, true);
  assert.equal(store.get().visible, false);
  assert.equal(store.get().tool, null);
  assert.equal(store.step('model', false, { modelOnly: !store.get().visible }), 'model');
  assert.deepEqual(store.strokes('model'), drawings);
  assert.equal(store.step('model', true, { modelOnly: !store.get().visible }), 'model');
  sync(true, false);
  assert.equal(store.get().visible, true);
  assert.equal(store.get().tool, null);
  assert.deepEqual(store.strokes('model'), drawings);
  sync(false, true); sync(false, false);
  assert.equal(store.get().visible, false, 'VIS never opens an otherwise closed console');
});

test('VIS defers the body-portaled AI cleanup question and its detached hotkey root until XL', () => {
  assert.match(app, /<AiAssistant bridge=\{aiBridge\} visUI=\{visUI\}\/>/);
  assert.match(ai, /\{cleanup && !visUI &&\s*createPortal\(/);
  assert.match(ai, /const root = cleanupRoot\.current;[\s\S]*?mdlxl-detached-root[\s\S]*?\}, \[cleanup, visUI\]\)/);
});

test('desktop and browser View use the same mode rows, including Axis guides where available', () => {
  const { buildMenuTemplate } = createRequire(import.meta.url)('../electron/menu.cjs');
  for (const [vanilla, menus] of [[true, VIEW_MENU], [false, XL_VIEW_MENU]]) for (const [mode, browserRows] of Object.entries(menus)) {
    const nativeRows = buildMenuTemplate({}, () => {}, 'win32', [], value => value, { viewMode: mode, vanilla })
      .find(menu => menu.label === 'View').submenu;
    assert.deepEqual(nativeRows.map(row => row.label), browserRows.map(([label]) => label), mode);
    assert.equal(browserRows.some(([, id]) => id === 'axes'), mode !== 'animations', mode);
  }
});

// VIS = MDLVis 1.40 (owner, 14 Nov 2026). Rows per editor, what is drawn, and saves.
{
  const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
  const { parseCompatibleMdx } = await import('../src/mdx-compatibility.js');
  const { previewOverlayOptions, visibleMovementPoints, movementNodeCategories } = await import('../app/preview-overlays.js');
  const { viewportOverlayOptions } = await import('../app/viewport-overlays.js');
  const { clearQuickDisplay, defaultEditorDisplay, defaultPoseDisplay, setEditorDisplay, storedEditorDisplay } = await import('../src/display-overlays.js');
  const load = name => { const bytes = readFileSync(fixturePath(name)); return parseCompatibleMdx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)); };
  const view = ['Shadows', 'Vertices', 'Normals', 'Grid'], objects = ['Bones', 'Attachment', 'Emitters', 'Skeleton'];

  test('VIS rows per editor are MDLVis 1.40\'s, with no XL-only switches', () => {
    assert.deepEqual(VIEW_MENU.vertices.map(([label]) => label), [...view, 'Axis guides', 'Clear']);
    assert.deepEqual(VIEW_MENU.bones.map(([label]) => label), [...view, 'Axis guides', ...objects, 'Clear']);
    assert.deepEqual(VIEW_MENU.movement.map(([label]) => label), [...view, 'Axis guides', ...objects, 'Clear']);
    assert.deepEqual(VIEW_MENU.animations.map(([label]) => label), [...view, 'Clear']);
    for (const rows of Object.values(VIEW_MENU)) for (const [, id] of rows)
      assert.ok(!['display:focusedSkeleton', 'display:nodes', 'display:events', 'display:sounds', 'display:lights', 'display:wires', 'display:objects', 'rgb'].includes(id), id);
  });

  test('VIS draws and picks only bones, helpers, attachments and emitters, only in Bones and Movement', () => {
    for (const name of ['sd-chaos-orc', 'ribbon-attachment']) {
      const model = load(name), kinds = movementNodeCategories(model, true);
      const ids = collection => (model[collection] || []).map(node => node.ObjectId);
      const all = ['Bones', 'Helpers', 'Attachments', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters', 'EventObjects', 'Lights', 'CollisionShapes'].flatMap(ids);
      const points = all.map(id => ({ node: { ObjectId: id }, overlayKind: kinds.get(id) || 'nodes', helperNode: ids('Helpers').includes(id) }));
      const never = new Set(['RibbonEmitters', 'EventObjects', 'Lights', 'CollisionShapes'].flatMap(ids));
      assert.ok(never.size, name);
      // Every switch on, including stale keys an old save or a hotkey could leave behind.
      const everything = { shaded: true, vertices: true, normals: true, grid: true, bones: true, helpers: true, attachments: true, particles: true, skeleton: true, focusedSkeleton: true, nodes: true, events: true, sounds: true, lights: true, wires: true, objects: true };
      for (const mode of ['bones', 'movement']) {
        const options = previewOverlayOptions(everything, true, mode, true);
        const shown = visibleMovementPoints(points, options).map(point => point.node.ObjectId);
        assert.deepEqual(shown.filter(id => never.has(id)), [], `${name} ${mode}: no ribbons, events, sounds, lights or collision`);
        assert.ok(shown.length, `${name} ${mode} shows its bones`);
        assert.deepEqual([options.focusedBoneLines, options.focusedBoneMarkers, options.wires, options.sounds, options.events, options.ribbons], [false, false, false, false, false, false]);
      }
      assert.deepEqual(visibleMovementPoints(points, previewOverlayOptions(everything, true, 'animations', true)), [], `${name} Animations draws no objects`);
      assert.equal(previewOverlayOptions(everything, true, 'animations', true).boneLines, false);
      const vertex = viewportOverlayOptions({ overlays: everything, vanilla: true });
      assert.deepEqual(visibleMovementPoints(points, vertex), [], `${name} Vertices draws no objects`);
      assert.equal(vertex.boneLines, false);
    }
    // POSE in VIS shows no Focused Skeleton either.
    assert.equal(previewOverlayOptions(defaultPoseDisplay(defaultEditorDisplay(true).movement), false, 'movement', true).focusedBoneLines, false);
  });

  test('VIS object switches are shared by Bones and Movement; Clear elsewhere leaves them', () => {
    let state = defaultEditorDisplay(true);
    state = setEditorDisplay(state, 'bones', 'particles', true, true);
    state = setEditorDisplay(state, 'movement', 'bones', false, true);
    state = setEditorDisplay(state, 'bones', 'skeleton', true, true);
    for (const mode of ['bones', 'movement']) assert.deepEqual([state[mode].particles, state[mode].bones, state[mode].helpers, state[mode].skeleton, state[mode].focusedSkeleton], [true, false, false, true, undefined], mode);
    for (const mode of ['vertices', 'animations']) assert.equal(state[mode].bones, undefined, mode);
    const cleared = clearQuickDisplay(state, 'animations', true);
    assert.deepEqual(cleared.bones, state.bones); assert.deepEqual(cleared.movement, state.movement);
    assert.deepEqual(Object.values(cleared.animations), [false, false, false, false]);
    const both = clearQuickDisplay(state, 'movement', true);
    assert.deepEqual([both.bones.particles, both.bones.skeleton, both.bones.boneTypesBones], [false, false, true]);
  });

  test('old VIS saves drop removed switches and never break loading', () => {
    const storage = value => ({ getItem: () => typeof value === 'string' ? value : JSON.stringify(value) });
    const restored = storedEditorDisplay(true, storage({ vis: {
      vertices: { bones: true, nodes: true, attachments: true, particles: true, wires: true, rgb: true, normals: true },
      movement: { focusedSkeleton: true, nodes: true, events: true, sounds: true, particles: true, attachments: false },
      animations: { bones: true, skeleton: true, focusedSkeleton: true, nodes: true, particles: true, wires: true, grid: true },
    } }));
    assert.deepEqual(restored.vertices, { shaded: true, vertices: true, normals: true, grid: false });
    assert.deepEqual([restored.movement.particles, restored.movement.attachments, restored.movement.focusedSkeleton, restored.movement.nodes, restored.movement.events], [true, false, undefined, undefined, undefined]);
    assert.deepEqual(restored.animations, { shaded: false, vertices: false, normals: false, grid: true });
    for (const junk of ['{', '"x"', '[1]', 'null', '{"vis":{"movement":7,"bones":null,"animations":[1]}}']) {
      assert.doesNotThrow(() => storedEditorDisplay(true, storage(junk)), junk);
      assert.deepEqual(Object.keys(storedEditorDisplay(true, storage(junk))), Object.keys(defaultEditorDisplay(true)));
    }
  });
}
