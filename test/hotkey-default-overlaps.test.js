// Permanent guard on the default keys, driven by the real modules and the real source tables:
// no overlap inside a scope, nothing longer than two keys, the reserved keys stay free.
// test/hotkey-defaults-audit.electron.cjs repeats the overlap check on the keys the running app hands out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { COMMANDS, windowCommandActions } from '../src/commands.js';
import { contextualHotkeyDefaults, EDITOR_RESERVED, hotkeyCode } from '../src/hotkey-defaults.js';
import { effectiveBindings, hotkeyConflicts, normalizeChord } from '../src/preferences.js';
import { perItemControl } from '../src/hotkey-allocation.js';
import { PAINT_BRUSH_SHAPES } from '../src/paint-brush-shapes.js';
import { PAINT_KEY_PREFIX } from '../src/learn-keycaps.js';
import { PAINT_CUTOUT_KEYS, paintCutoutActionId } from '../src/paint-keys.js';
import manifest from '../src/hotkey-manifest.json' with { type: 'json' };
import { buildManifest, MANUAL_WINDOWS } from '../scripts/hotkey-manifest.mjs';

const root = resolve(import.meta.dirname, '..');
const source = file => readFileSync(resolve(root, file), 'utf8');
const appFiles = readdirSync(resolve(root, 'app')).filter(name => name.endsWith('.jsx')).map(name => 'app/' + name);

// Citadel Paint's real key table, evaluated with stubs.
function paintActions() {
  const text = source('app/PaintStudioLayout.jsx'), start = text.indexOf('const entries = [') + 'const entries = '.length;
  let depth = 0, end = start;
  for (; end < text.length; end++) { if (text[end] === '[') depth++; else if (text[end] === ']' && !--depth) { end++; break; } }
  const stub = () => {}, p = new Proxy({}, { get: () => stub });
  const entries = new Function('p', 'limited', 'brush', 'tool', 'setHelp', 'outsideKey', 'PAINT_BRUSH_SHAPES', 'return ' + text.slice(start, end))(p, false, { size: 1, opacity: 1, hardness: 1 }, 'paint', stub, {}, PAINT_BRUSH_SHAPES);
  const chord = key => normalizeChord(key.replace('↵', 'Enter'));
  return entries.map(([key, label, , bindingCommand]) => ({ id: PAINT_KEY_PREFIX + key, label, category: 'Citadel Paint', scope: 'paint', group: 'paint', contextual: true, bindingCommand, keys: key === '?' ? ['?', 'Shift+?'] : key === '=' ? ['=', 'Shift+Plus'] : key === 'Shift+[' ? ['Shift+{'] : key === 'Shift+]' ? ['Shift+}'] : [chord(key)] }));
}

// Every per-window Undo/Redo/Play, from the useWindowHotkeys calls in the source.
function windowActions() {
  const found = [];
  for (const file of appFiles) for (const match of source(file).matchAll(/useWindowHotkeys\(\s*('[^']+'|\w+)\s*,\s*windowCommandActions\(\s*('[^']+'|\w+)\s*,\s*('[^']+'|[^,]+?)\s*,\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g)) {
    const scope = match[1].replace(/'/g, ''), handlers = Object.fromEntries([...match[4].matchAll(/\b(undo|redo|play)\b\s*[:,}]?/g)].map(row => [row[1], () => {}]));
    for (const action of windowCommandActions(scope, match[3], handlers)) found.push({ ...action, scope, group: scope, contextual: true });
  }
  return found;
}

// Static on-screen controls with the real allocator; a window's controls live in its source file.
const EDITOR_FILES = new Set(['AppToolbar', 'AppSidebar', 'EditorControls', 'Inspectors', 'KeyframeTimeline', 'QuickDisplay', 'MovementControllerRecomp', 'AnimationController', 'PaintIcon', 'PortraitToolbar', 'UVWorkspace']);
const groupOf = file => { const name = basename(file, '.jsx'); return EDITOR_FILES.has(name) ? 'editor' : name; };
function staticControls() {
  const controls = new Map();
  for (const file of appFiles) {
    if (/Hotkeys\.jsx|Settings\.jsx/.test(file)) continue;
    const text = source(file);
    for (const match of text.matchAll(/data-hotkey="([^"]+)"([^>]{0,300})/g)) {
      const [, raw, rest] = match;
      if (/data-hotkey-manual/.test(rest.split('>')[0]) || COMMANDS.some(action => action.id === raw) || /^(forge:shape:|paint-key:)/.test(raw)) continue;
      const label = rest.match(/data-hotkey-label="([^"]+)"/)?.[1] || rest.match(/aria-label="([^"]+)"/)?.[1] || rest.match(/title="([^"]+)"/)?.[1] || raw;
      const id = `${groupOf(file)}/${raw}`;
      controls.set(id, { id, label, category: 'control', scope: 'context', group: groupOf(file), contextual: true, defaultKeys: [] });
    }
  }
  return [...controls.values()];
}

const cutoutActions = () => [
  ...PAINT_CUTOUT_KEYS.map(([name, label, ...keys]) => ({ id: paintCutoutActionId(name), label, category: 'Paint cut-out', scope: 'paint-cutout', group: 'cutout', contextual: true, keys })),
  ...windowCommandActions('paint-cutout', 'Paint cut-out', { undo() {}, redo() {} }).map(action => ({ ...action, scope: 'paint-cutout', group: 'cutout', contextual: true })),
];
const manualActions = () => manifest.map(entry => ({ ...entry, scope: 'context', contextual: true, manual: true, defaultKeys: [] }));

const catalog = contextualHotkeyDefaults([...COMMANDS, ...paintActions(), ...windowActions(), ...cutoutActions(), ...staticControls(), ...manualActions()], [], {});
const bindings = effectiveBindings(catalog, {});
const keysOf = action => bindings[action.id] || [];
const keyCount = chord => chord.replace(/\+Plus$/, '+P').split(/\+(?=.)/).length;

function duplicates(actions) {
  const seen = new Map(), found = [];
  for (const action of actions) for (const key of keysOf(action)) { if (seen.has(key)) found.push(`${key}: ${seen.get(key)} and ${action.id}`); else seen.set(key, action.id); }
  return found;
}

test('commands: no key is used twice where it can fire', () => {
  for (const scope of ['editor', 'forge-shapes', 'paint']) assert.deepEqual(duplicates(catalog.filter(action => !action.contextual && action.scope === scope)), [], scope);
});

test('Citadel Paint: every chord is unique and its commands drive its own keys', () => {
  const paint = catalog.filter(action => action.group === 'paint');
  assert.ok(paint.length >= 65);
  assert.deepEqual(duplicates(paint), []);
  for (const [command, key] of [['paint:select', 'Q'], ['paint:draw', 'B']]) assert.equal(paint.find(action => action.id === PAINT_KEY_PREFIX + key).bindingCommand, command);
});

test('per-window Undo, Redo, Play and Close: unique in each window, and they follow the command key', () => {
  const windows = windowActions();
  assert.ok(windows.length >= 16, `found ${windows.length}`);
  for (const action of windows) assert.deepEqual(keysOf(action), COMMANDS.find(command => command.id === action.bindingCommand).defaultKeys, action.id);
  const groups = new Map();
  for (const action of catalog.filter(item => item.contextual && item.group)) (groups.get(action.group) || groups.set(action.group, []).get(action.group)).push(action);
  for (const [group, actions] of groups) assert.deepEqual(duplicates(actions), [], group);
  assert.equal(groups.get('AutoCorpse')?.filter(action => keysOf(action).includes('Escape')).length ?? 0, 0, 'Auto Corpse takes Esc from ToolWindow, not from its own file');
});

test('Paint cut-out keys are unique and short', () => {
  const cutout = catalog.filter(action => action.group === 'cutout');
  assert.deepEqual(duplicates(cutout), []);
  assert.deepEqual(keysOf(cutout.find(action => action.id === paintCutoutActionId('crop'))), ['R']);
  assert.deepEqual(keysOf(cutout.find(action => action.id === 'paint-cutout:undo')), ['Ctrl+Z'], 'follows Undo');
});

test('no default longer than two keys, and no generated code', () => {
  for (const action of catalog) for (const key of keysOf(action)) {
    assert.ok(keyCount(key) <= 2, `${action.id}: ${key}`);
    assert.equal(hotkeyCode(key), '', `${action.id}: ${key}`);
  }
});

test('the reserved keys stay free in the editor', () => {
  const editorActions = catalog.filter(action => !action.contextual && action.scope === 'editor' || action.group === 'editor');
  for (const key of ['H', 'K', 'Ctrl+X', 'Ctrl+B', ...EDITOR_RESERVED.filter(key => key !== 'Alt+F4')]) assert.deepEqual(editorActions.filter(action => keysOf(action).includes(key)).map(action => action.id), [], key);
  assert.deepEqual(editorActions.filter(action => keysOf(action).includes('Alt+F4')).map(action => action.id), ['exit'], 'Exit teaches the Windows key');
});

test('every default passes the same conflict check Settings uses', () => {
  const clashes = [];
  for (const action of catalog) for (const key of keysOf(action)) { const hits = hotkeyConflicts(catalog, {}, action.id, key); if (hits.length) clashes.push(`${action.id} ${key}: ${hits.join(', ')}`); }
  assert.deepEqual(clashes, []);
});

test('the launcher and toolbar commands have their agreed keys, and those keys are not used elsewhere in the editor', () => {
  const by = id => COMMANDS.find(action => action.id === id);
  assert.deepEqual(by('launcher').defaultKeys, ['Ctrl+F2']);
  assert.equal(by('launcher').label, 'Search commands');
  assert.deepEqual(by('toolbarCycle').defaultKeys, ['Shift+F3']);
  assert.equal(by('toolbarCycle').label, 'Next toolbar style');
  for (const id of ['showcase', 'managers', 'autoCorpse', 'visToggle']) assert.deepEqual(by(id).defaultKeys, [], id);
  for (const key of ['Ctrl+F2', 'Shift+F3']) assert.equal(catalog.filter(action => (!action.contextual && action.scope === 'editor' || action.group === 'editor') && keysOf(action).includes(key)).length, 1, key);
});

test('manual controls have no default key, and the manifest lists every one of them', () => {
  assert.deepEqual(buildManifest(root), manifest, 'run: node scripts/hotkey-manifest.mjs');
  assert.ok(manifest.length >= 250, `only ${manifest.length} entries`);
  for (const entry of manifest) {
    const action = catalog.find(item => item.id === entry.id);
    assert.deepEqual(keysOf(action), [], entry.id);
    assert.ok(entry.label && entry.group && entry.category, entry.id);
    assert.equal(perItemControl(entry.id), false, entry.id);
    assert.ok(MANUAL_WINDOWS[entry.id.split(':')[0]], entry.id);
    assert.ok(!['undo', 'select', 'fit'].includes(entry.id), `${entry.id} would make its window look like the editor`);
    assert.notEqual(COMMANDS.some(command => command.id === entry.id) && entry.id !== 'eachPiece', true, `${entry.id} is also a command`);
  }
  for (const window of ['particles:', 'animxl:', 'texture-library:', 'showcase:', 'optimizexl:', 'forge-image:', 'uv-wrapper:', 'animation-controller:', 'portrait:', 'auto-corpse:', 'sort-my-mess:', 'pose:', 'geoset-tabs:', 'particle-library:', 'game-files:', 'particle-picture:', 'surface-effects:']) assert.ok(manifest.some(entry => entry.id.startsWith(window)), window);
});
