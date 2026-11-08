// Imported before preferences.js on purpose: the two modules import each other,
// and this is the order that fails if a default is not ready in time.
import { activePreset, appearanceEdit, appearanceLook, applyPreset, captureCustom, CUSTOM_PRESET, DEFAULT_SETTINGS_PRESETS, deletePreset, listPresets, loadPreset, MAX_PRESET_FILE_BYTES, MAX_SAVED_PRESETS, normalizeSettingsPresets, parsePresetFile, PRESET_DOMAINS, presetRestoreQuestion, restoreCustom, restoreDomain, sanitizePresetName, savePreset, serializePreset } from '../src/settings-presets.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CAMERA_PRESETS, DEFAULT_PREFERENCES, DEFAULT_VISUALS, normalizePreferences } from '../src/preferences.js';
import { exportConfiguration, importConfiguration } from '../src/portable-settings.js';
import { normalizeModifiers } from '../src/modifier-bindings.js';
import { ROTATION_PRESETS, normalizeRotationPreferences, rotationPresetId } from '../src/rotation-drag.js';
import { DEFAULT_UV_DRAG, UV_DRAG_PRESETS, normalizeUVDrag, uvDragPreset } from '../src/uv-drag-settings.js';
import { BUILT_IN_VIEWPORT_PRESETS, MAX_VIEWPORT_PRESETS, normalizeViewportPresets } from '../src/viewport-appearance.js';
import { APPEARANCE_HELPER_KEYS, helpersForPreset, paintForPreset, viewportPresetChange } from '../src/light-dark-switch.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const fresh = (extra = {}) => normalizePreferences({ modelLookAnswered: true, ...extra });
const commit = (prefs, change) => normalizePreferences({ ...prefs, ...change });
const envelope = (domain, values, overrides = {}) => ({ schema: 'mdlxl-preset', version: 1, domain, name: 'Shared', app: '0.38.3', values, ...overrides });
const fileText = (domain, values, overrides) => JSON.stringify(envelope(domain, values, overrides));
const refuses = (text, pattern, options) => assert.throws(() => parsePresetFile(text, options), pattern);
const uvValues = { ...DEFAULT_UV_DRAG, rotateSpeed: 40, uvSensitivity: 1 };

/** A setting changed in each domain, so a preset of it differs from every built-in. */
const edited = {
  mouse: () => fresh({ scrollSensitivity: 4, wheelMode: 'scroll', cameraBindings: { right: 'zoom', middle: 'pan' } }),
  rotate: () => fresh({ rotation: { sensitivity: 2, precision: .5, workplaneDrag: 'ring', snap: 45, editors: { forge: { sensitivity: 3 } } } }),
  uv: () => fresh({ uvDrag: { ...DEFAULT_UV_DRAG, rotateSpeed: 40, zoomSnap: 25 }, uvSensitivity: 2 }),
  hotkeys: () => fresh({ hotkeys: { translate: ['G'], 'Some Window:action': ['Ctrl+Y', 'U'] } }),
  appearance: () => { const base = fresh(); return fresh({ viewportPreset: 'custom', viewportAppearance: { ...base.viewportAppearance, xrayVertices: true }, theme: 'light', accent: '#123456', toolHighlight: '#654321', visuals: { ...base.visuals, bone: '#010203', keyframe: '#040506' }, citadelPaint: { ...base.citadelPaint, brushCursor: '#070809', borderThickness: 4 } }); },
};
const domainState = {
  mouse: prefs => ({ cameraBindings: prefs.cameraBindings, pointerSensitivity: prefs.pointerSensitivity, scrollSensitivity: prefs.scrollSensitivity, fineSensitivity: prefs.fineSensitivity, wheelMode: prefs.wheelMode, rightScrollAdjust: prefs.rightScrollAdjust }),
  rotate: prefs => prefs.rotation, uv: prefs => ({ uvDrag: prefs.uvDrag, uvSensitivity: prefs.uvSensitivity }), hotkeys: prefs => ({ hotkeys: prefs.hotkeys, modifiers: prefs.modifiers }),
  appearance: prefs => ({ viewportAppearance: prefs.viewportAppearance, theme: prefs.theme, accent: prefs.accent, toolHighlight: prefs.toolHighlight, helpers: Object.fromEntries(APPEARANCE_HELPER_KEYS.map(key => [key, prefs.visuals[key]])), citadelPaint: prefs.citadelPaint }),
};

// ---- Module shape ----------------------------------------------------------

test('both load orders of the mutually importing modules work', () => {
  for (const first of ['preferences.js', 'settings-presets.js']) {
    const script = `const a=await import('./src/${first}');const p=await import('./src/preferences.js');const s=await import('./src/settings-presets.js');if(Object.keys(p.DEFAULT_PREFERENCES.settingsPresets).join()!=='mouse,rotate,uv,hotkeys')throw Error('default');if(s.listPresets('mouse',p.normalizePreferences({})).length!==2)throw Error('list');`;
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 0, first + ': ' + run.stderr);
  }
});
test('defaults are empty lists and an untouched profile gains nothing else', () => {
  assert.deepEqual(DEFAULT_SETTINGS_PRESETS, { mouse: [], rotate: [], uv: [], hotkeys: [] });
  assert.deepEqual(DEFAULT_PREFERENCES.settingsPresets, DEFAULT_SETTINGS_PRESETS);
  assert.deepEqual(fresh().settingsPresets, { mouse: [], rotate: [], uv: [], hotkeys: [] });
  assert.ok(!('appearance' in fresh().settingsPresets));
});
test('change objects go straight into commit and carry the status out of band', () => {
  const change = applyPreset('uv', fresh(), 'mdlvis');
  assert.equal(change.status, 'MDLVis loaded.'); assert.equal(change.presetId, 'mdlvis');
  assert.deepEqual(Object.keys(change), ['uvDrag']);
  assert.deepEqual(Object.keys({ ...change }), ['uvDrag']);
  assert.equal(typeof change.status, 'string');
});
test('an unknown domain or preset is refused with a sentence', () => {
  assert.throws(() => listPresets('toString', fresh()), /Unknown preset type/);
  assert.throws(() => listPresets('__proto__', fresh()), /Unknown preset type/);
  assert.throws(() => applyPreset('uv', fresh(), 'nope'), /no longer exists/);
  assert.throws(() => deletePreset('uv', fresh(), 'mdlxl'), /no longer exists/);
  assert.throws(() => serializePreset('uv', fresh(), 'nope', '1'), /no longer exists/);
});

// ---- Built-ins -------------------------------------------------------------

test('rotate and uv built-ins are exactly the four names', () => {
  for (const domain of ['rotate', 'uv']) assert.deepEqual(listPresets(domain, fresh()), [['mdlxl', 'MDLxL'], ['mdlvis', 'MDLVis'], ['freeform', 'Freeform'], ['manipulator', 'Manipulator']].map(([id, name]) => ({ id, name, builtIn: true })));
});
test('mouse keeps its two presets and their names; hotkeys has Default; appearance its built-ins', () => {
  assert.deepEqual(listPresets('mouse', fresh()).map(preset => [preset.id, preset.name]), [['classic', 'Classic MDLVis'], ['orbit', 'Orbit navigation']]);
  assert.deepEqual(listPresets('hotkeys', fresh()), [{ id: 'default', name: 'Default', builtIn: true }]);
  assert.deepEqual(listPresets('appearance', fresh()).map(preset => preset.id), Object.keys(BUILT_IN_VIEWPORT_PRESETS));
});
for (const id of ['mdlxl', 'mdlvis', 'freeform', 'manipulator']) {
  test(`uv built-in ${id} writes all nine keys whatever was set before`, () => {
    const prefs = fresh({ uvDrag: { rotateStyle: 'both', rotateSpeed: 200, zoomStyle: 'rightUp', zoomSpeed: 400, rotateSnap: 90, zoomSnap: 25, rotateReverse: true, rotateZone: 99, rotateBigPieces: false } });
    const change = applyPreset('uv', prefs, id);
    assert.deepEqual(change.uvDrag, normalizeUVDrag(UV_DRAG_PRESETS[id]));
    assert.equal(Object.keys(change.uvDrag).length, 9);
    assert.equal(uvDragPreset(commit(prefs, change).uvDrag), id);
    assert.equal(activePreset('uv', commit(prefs, change)), id);
  });
  test(`rotate built-in ${id} writes every key and keeps Each piece`, () => {
    const prefs = fresh({ rotation: { sensitivity: 3, workplaneDrag: 'ring', handleSensitivity: 2, snap: 90, reverse: true, eachPiece: true, editors: { forge: { sensitivity: 2 } } } });
    const next = commit(prefs, applyPreset('rotate', prefs, id));
    assert.equal(next.rotation.eachPiece, true);
    assert.deepEqual(next.rotation.editors, {});
    assert.equal(rotationPresetId(next.rotation), id);
    assert.equal(activePreset('rotate', next), id);
    const { eachPiece, ...withoutEach } = next.rotation;
    assert.deepEqual(withoutEach, (({ eachPiece: _, ...rest }) => rest)(normalizeRotationPreferences(ROTATION_PRESETS[id])));
  });
}
test('uvSensitivity and uvEachPiece survive a uv built-in', () => {
  const prefs = fresh({ uvSensitivity: 2, uvEachPiece: true }), next = commit(prefs, applyPreset('uv', prefs, 'freeform'));
  assert.equal(next.uvSensitivity, 2); assert.equal(next.uvEachPiece, true);
});
test('mouse built-ins write the CAMERA_PRESETS keys', () => {
  for (const id of ['classic', 'orbit']) {
    const next = commit(fresh(), applyPreset('mouse', fresh({ scrollSensitivity: 9 }), id));
    for (const [key, value] of Object.entries(CAMERA_PRESETS[id])) assert.deepEqual(next[key], value, key);
    assert.equal(activePreset('mouse', next), id);
  }
});
test('hotkeys Default clears overrides and modifiers', () => {
  const prefs = edited.hotkeys(), change = applyPreset('hotkeys', prefs, 'default');
  assert.deepEqual(change, { hotkeys: {}, modifiers: {} });
  assert.equal(activePreset('hotkeys', commit(prefs, change)), 'default');
});
test('appearance built-ins go through the existing change', () => {
  for (const id of Object.keys(BUILT_IN_VIEWPORT_PRESETS)) {
    const next = commit(fresh(), applyPreset('appearance', fresh(), id));
    assert.equal(next.viewportPreset, id); assert.equal(activePreset('appearance', next), id);
    assert.equal(next.theme, BUILT_IN_VIEWPORT_PRESETS[id].theme);
  }
});
test('an untouched profile reads as the first built-in of each domain', () => {
  assert.equal(activePreset('mouse', fresh()), 'classic');
  assert.equal(activePreset('rotate', fresh()), 'mdlxl');
  assert.equal(activePreset('uv', fresh()), 'mdlxl');
  assert.equal(activePreset('hotkeys', fresh()), 'default');
  assert.equal(activePreset('appearance', fresh()), DEFAULT_PREFERENCES.viewportPreset);
});

// ---- Custom detection ------------------------------------------------------

test('changing any one setting reads as Custom', () => {
  assert.equal(activePreset('mouse', fresh({ pointerSensitivity: 2 })), CUSTOM_PRESET);
  assert.equal(activePreset('rotate', fresh({ rotation: { sensitivity: 2 } })), CUSTOM_PRESET);
  assert.equal(activePreset('uv', fresh({ uvDrag: { ...DEFAULT_UV_DRAG, zoomSpeed: 150 } })), CUSTOM_PRESET);
  assert.equal(activePreset('hotkeys', fresh({ hotkeys: { translate: ['G'] } })), CUSTOM_PRESET);
  assert.equal(activePreset('appearance', fresh({ viewportPreset: 'custom' })), CUSTOM_PRESET);
});
test('a per-editor rotation override reads as Custom, not the built-in', () => {
  assert.equal(activePreset('rotate', fresh({ rotation: { editors: { forge: { sensitivity: 2 } } } })), CUSTOM_PRESET);
});
test('a saved rotate preset of mostly defaults does not match settings it does not list', () => {
  let prefs = fresh({ rotation: { sensitivity: 2 } });
  const change = savePreset('rotate', prefs, 'Fast'); prefs = commit(prefs, change);
  assert.equal(activePreset('rotate', prefs), change.presetId);
  assert.equal(activePreset('rotate', commit(prefs, { rotation: { ...prefs.rotation, workplaneDrag: 'ring' } })), CUSTOM_PRESET);
});
test('a saved preset is recognised ahead of a built-in with the same listed values', () => {
  let prefs = fresh();
  const change = savePreset('uv', prefs, 'Mine'); prefs = commit(prefs, change);
  assert.equal(activePreset('uv', prefs), change.presetId);
  assert.equal(activePreset('uv', prefs, 'mdlxl'), 'mdlxl', 'the one last picked wins when values are equal');
});
test('a uv saved preset also compares its sensitivity', () => {
  let prefs = fresh({ uvSensitivity: 2 });
  const change = savePreset('uv', prefs, 'Mine'); prefs = commit(prefs, change);
  assert.equal(activePreset('uv', commit(prefs, { uvSensitivity: 3 })), 'mdlxl');
  assert.equal(activePreset('uv', prefs), change.presetId);
});
test('hotkey key and chord order do not matter', () => {
  let prefs = fresh({ hotkeys: { a: ['G', 'H'], b: ['J'] } });
  const change = savePreset('hotkeys', prefs, 'Mine'); prefs = commit(prefs, change);
  assert.equal(activePreset('hotkeys', commit(prefs, { hotkeys: { b: ['J'], a: ['H', 'G'] } })), change.presetId);
  assert.equal(activePreset('hotkeys', commit(prefs, { hotkeys: { b: ['J'], a: ['H'] } })), CUSTOM_PRESET);
});
test('accent, tool highlight, helper and Citadel edits read as Custom; no-ops and grid colours do not', () => {
  const prefs = fresh({ viewportPreset: 'nord' });
  assert.equal(appearanceEdit(prefs, { accent: '#abcdef' }).viewportPreset, CUSTOM_PRESET);
  assert.equal(appearanceEdit(prefs, { toolHighlight: '#abcdef' }).viewportPreset, CUSTOM_PRESET);
  assert.equal(appearanceEdit(prefs, { visuals: { ...prefs.visuals, bone: '#010203' } }).viewportPreset, CUSTOM_PRESET);
  assert.equal(appearanceEdit(prefs, { citadelPaint: { ...prefs.citadelPaint, brushCursor: '#010203' } }).viewportPreset, CUSTOM_PRESET);
  assert.equal(appearanceEdit(prefs, { accent: prefs.accent }).viewportPreset, undefined);
  assert.equal(appearanceEdit(prefs, { visuals: { ...prefs.visuals, gridMajor: '#010203' } }).viewportPreset, undefined);
  assert.equal(appearanceEdit(prefs, { panelScale: 1.5 }).viewportPreset, undefined);
});

// ---- Save, delete, restore -------------------------------------------------

for (const domain of PRESET_DOMAINS) {
  test(`${domain}: save, reselect after a change, delete keeps the settings`, () => {
    let prefs = edited[domain]();
    const saved = savePreset(domain, prefs, 'Mine');
    assert.equal(saved.status, 'Mine saved.');
    prefs = commit(prefs, saved);
    assert.equal(activePreset(domain, prefs), saved.presetId);
    assert.ok(listPresets(domain, prefs).some(preset => preset.id === saved.presetId && preset.name === 'Mine' && !preset.builtIn));
    const before = domainState[domain](prefs);
    const other = domain === 'hotkeys' ? 'default' : listPresets(domain, prefs)[1].id;
    prefs = commit(prefs, applyPreset(domain, prefs, other));
    assert.notDeepEqual(domainState[domain](prefs), before);
    prefs = commit(prefs, applyPreset(domain, prefs, saved.presetId));
    assert.deepEqual(domainState[domain](prefs), before);
    assert.equal(activePreset(domain, prefs), saved.presetId);
    const removed = deletePreset(domain, prefs, saved.presetId);
    assert.match(removed.status, /^Mine deleted\. Current (settings were|appearance was) kept\.$/);
    prefs = commit(prefs, removed);
    assert.deepEqual(domainState[domain](prefs), before);
    assert.ok(!listPresets(domain, prefs).some(preset => preset.id === saved.presetId));
    assert.equal(activePreset(domain, prefs), CUSTOM_PRESET);
  });
  test(`${domain}: restore goes back to the default`, () => {
    const change = restoreDomain(domain, edited[domain]());
    assert.equal(change.status, 'Defaults restored.');
    assert.notEqual(activePreset(domain, commit(edited[domain](), change)), CUSTOM_PRESET);
  });
  test(`${domain}: leaving Custom can be undone from a capture`, () => {
    const prefs = edited[domain](), captured = captureCustom(domain, prefs);
    const away = commit(prefs, restoreDomain(domain, prefs));
    assert.deepEqual(domainState[domain](commit(away, restoreCustom(domain, away, captured))), domainState[domain](prefs));
  });
}
test('restore matches the existing per-page buttons', () => {
  const uv = restoreDomain('uv', fresh({ uvSensitivity: 3, uvDrag: { rotateSpeed: 200 } }));
  assert.deepEqual(uv, { uvDrag: normalizeUVDrag(UV_DRAG_PRESETS.mdlxl) });
  assert.deepEqual(normalizeUVDrag(UV_DRAG_PRESETS.mdlxl), normalizeUVDrag(DEFAULT_UV_DRAG), 'MDLxL is today\'s default');
  assert.deepEqual(restoreDomain('hotkeys', edited.hotkeys()), { hotkeys: {}, modifiers: {} });
  assert.deepEqual(restoreDomain('appearance', edited.appearance()), { theme: 'light', accent: '#71b5f3', toolHighlight: '', viewportPreset: 'mdlvis-vanilla', viewportAppearance: BUILT_IN_VIEWPORT_PRESETS['mdlvis-vanilla'].appearance, visuals: DEFAULT_VISUALS });
  const mouse = commit(fresh({ scrollSensitivity: 9 }), restoreDomain('mouse', fresh({ scrollSensitivity: 9 })));
  assert.equal(mouse.scrollSensitivity, CAMERA_PRESETS.classic.scrollSensitivity);
});
test('restore keeps Each piece', () => {
  const next = commit(fresh(), restoreDomain('rotate', fresh({ rotation: { eachPiece: true, sensitivity: 3 } })));
  assert.equal(next.rotation.eachPiece, true); assert.equal(next.rotation.sensitivity, 1);
});
test('only Hotkeys asks before Restore', () => {
  assert.match(presetRestoreQuestion('hotkeys'), /Restore every default shortcut/);
  for (const domain of ['mouse', 'rotate', 'uv', 'appearance']) assert.equal(presetRestoreQuestion(domain), '');
});
test('Each piece is never part of a saved preset or file', () => {
  const prefs = fresh({ rotation: { eachPiece: true, sensitivity: 2 } }), change = savePreset('rotate', prefs, 'Mine');
  assert.ok(!('eachPiece' in commit(prefs, change).settingsPresets.rotate[0].values));
  assert.doesNotMatch(serializePreset('rotate', prefs, CUSTOM_PRESET, '1', { name: 'x' }), /eachPiece/);
  const uv = fresh({ uvEachPiece: true });
  assert.doesNotMatch(serializePreset('uv', uv, CUSTOM_PRESET, '1', { name: 'x' }), /EachPiece/);
  refuses(fileText('rotate', { sensitivity: 1, eachPiece: true }), /invalid setting: eachPiece/);
  refuses(fileText('uv', { ...uvValues, uvEachPiece: true }), /invalid setting: uvEachPiece/);
});
test('loading a preset leaves the machine\'s Each piece alone', () => {
  const text = serializePreset('rotate', fresh({ rotation: { sensitivity: 2 } }), CUSTOM_PRESET, '1', { name: 'x' });
  const prefs = fresh({ rotation: { eachPiece: true } });
  assert.equal(commit(prefs, loadPreset(prefs, parsePresetFile(text))).rotation.eachPiece, true);
});
test('saved presets have only the technical ceiling', () => {
  const values = normalizeUVDrag({}), list = Array.from({ length: MAX_SAVED_PRESETS }, (_, index) => ({ id: `custom-${index}`, name: `P${index}`, values }));
  const prefs = fresh({ settingsPresets: { uv: list } });
  assert.equal(prefs.settingsPresets.uv.length, MAX_SAVED_PRESETS);
  assert.throws(() => savePreset('uv', fresh({ settingsPresets: { uv: list }, uvDrag: { ...DEFAULT_UV_DRAG, rotateSpeed: 11 } }), 'One more'), /No room/);
  assert.equal(fresh({ settingsPresets: { uv: [...list, { id: 'custom-over', name: 'Over', values }] } }).settingsPresets.uv.length, MAX_SAVED_PRESETS);
  const many = fresh({ settingsPresets: { uv: list.slice(0, 200) }, uvDrag: { ...DEFAULT_UV_DRAG, rotateSpeed: 11 } });
  assert.equal(commit(many, savePreset('uv', many, 'Number 201')).settingsPresets.uv.length, 201);
});
test('appearance keeps its storage and its limit of 24', () => {
  const base = fresh(), list = Array.from({ length: MAX_VIEWPORT_PRESETS }, (_, index) => ({ id: `custom-${index}`, name: `P${index}`, appearance: base.viewportAppearance, theme: 'light', accent: '#112233' }));
  const full = fresh({ viewportPresets: list, viewportPreset: 'custom', accent: '#445566' });
  assert.throws(() => savePreset('appearance', full, 'One more'), /up to 24/);
  assert.throws(() => loadPreset(full, parsePresetFile(serializePreset('appearance', full, CUSTOM_PRESET, '1', { name: 'One more' }))), /up to 24/);
  const prefs = edited.appearance(), next = commit(prefs, savePreset('appearance', prefs, 'Mine'));
  assert.deepEqual(Object.keys(next.viewportPresets[0]).sort(), ['accent', 'appearance', 'citadelPaint', 'id', 'name', 'theme', 'toolHighlight', 'visuals']);
  assert.equal(next.viewportPreset, next.viewportPresets[0].id);
  assert.deepEqual(next.settingsPresets, fresh().settingsPresets);
});

// ---- Collisions ------------------------------------------------------------

test('saving under a taken name is refused unless the values are equal', () => {
  let prefs = fresh({ uvDrag: { ...DEFAULT_UV_DRAG, rotateSpeed: 40 } });
  const first = savePreset('uv', prefs, 'Mine'); prefs = commit(prefs, first);
  const again = savePreset('uv', prefs, 'MINE');
  assert.equal(again.status, 'Mine is already saved.'); assert.equal(again.presetId, first.presetId);
  assert.equal(commit(prefs, again).settingsPresets.uv.length, 1);
  const changed = commit(prefs, { uvDrag: { ...prefs.uvDrag, rotateSpeed: 50 } });
  assert.throws(() => savePreset('uv', changed, 'mine'), /already exists/);
  assert.throws(() => savePreset('uv', changed, 'MDLxL'), /already exists/);
  assert.throws(() => savePreset('uv', changed, '   '), /Enter a name/);
});
test('loading a taken name adds "Name (2)" and then "(3)", and applies it', () => {
  let prefs = fresh({ uvDrag: { ...DEFAULT_UV_DRAG, rotateSpeed: 40 } });
  prefs = commit(prefs, savePreset('uv', prefs, 'Shared'));
  const load = rotateSpeed => { const change = loadPreset(prefs, parsePresetFile(fileText('uv', { ...uvValues, rotateSpeed }))); prefs = commit(prefs, change); return change; };
  assert.equal(load(50).status, 'Shared (2) loaded.');
  assert.equal(prefs.uvDrag.rotateSpeed, 50);
  assert.equal(load(60).status, 'Shared (3) loaded.');
  assert.deepEqual(prefs.settingsPresets.uv.map(preset => preset.name), ['Shared', 'Shared (2)', 'Shared (3)']);
});
test('loading the same name with the same values reuses the entry and applies it', () => {
  let prefs = fresh({ uvDrag: { ...DEFAULT_UV_DRAG, rotateSpeed: 40 } });
  const saved = savePreset('uv', prefs, 'Shared'); prefs = commit(prefs, saved);
  const text = fileText('uv', uvValues);
  prefs = commit(prefs, { uvDrag: DEFAULT_UV_DRAG });
  const change = loadPreset(prefs, parsePresetFile(text));
  assert.equal(change.presetId, saved.presetId);
  prefs = commit(prefs, change);
  assert.equal(prefs.settingsPresets.uv.length, 1); assert.equal(prefs.uvDrag.rotateSpeed, 40);
});
test('a file named like a built-in does not replace it', () => {
  const change = loadPreset(fresh(), parsePresetFile(fileText('uv', uvValues, { name: 'MDLxL' })));
  const next = commit(fresh(), change);
  assert.deepEqual(listPresets('uv', next).filter(preset => !preset.builtIn).map(preset => preset.name), ['MDLxL (2)']);
});
test('a built-in exported and reloaded reuses the built-in', () => {
  const change = loadPreset(fresh(), parsePresetFile(serializePreset('uv', fresh(), 'mdlvis', '1')));
  assert.equal(change.presetId, 'mdlvis');
  assert.deepEqual(commit(fresh(), change).settingsPresets.uv, []);
});
test('the suffix fits inside the 80 character name limit', () => {
  const long = 'x'.repeat(80), first = commit(fresh(), loadPreset(fresh(), parsePresetFile(fileText('uv', uvValues, { name: long }))));
  const second = loadPreset(first, parsePresetFile(fileText('uv', { ...uvValues, rotateSpeed: 50 }, { name: long })));
  const names = commit(first, second).settingsPresets.uv.map(preset => preset.name);
  assert.equal(names[1], 'x'.repeat(76) + ' (2)'); assert.equal(names[1].length, 80);
});

// ---- Round trips -----------------------------------------------------------

for (const domain of PRESET_DOMAINS) {
  test(`${domain}: a file round-trips onto a fresh profile`, () => {
    const sender = edited[domain](), text = serializePreset(domain, sender, CUSTOM_PRESET, '0.38.3', { name: 'Shared one' });
    const parsed = parsePresetFile(text, { expectDomain: domain });
    assert.equal(parsed.domain, domain); assert.equal(parsed.name, 'Shared one'); assert.equal(parsed.app, '0.38.3');
    const change = loadPreset(fresh(), parsed), receiver = commit(fresh(), change);
    assert.equal(change.status, 'Shared one loaded.');
    assert.deepEqual(domainState[domain](receiver), domainState[domain](sender));
    assert.equal(activePreset(domain, receiver), change.presetId);
    assert.ok(listPresets(domain, receiver).some(preset => preset.id === change.presetId && preset.name === 'Shared one' && !preset.builtIn));
    assert.equal(serializePreset(domain, receiver, change.presetId, '0.38.3'), text, 'a second export is byte-identical');
  });
  test(`${domain}: file text is the exact six-key envelope`, () => {
    const data = JSON.parse(serializePreset(domain, edited[domain](), CUSTOM_PRESET, '9.9.9', { name: 'N' }));
    assert.deepEqual(Object.keys(data), ['schema', 'version', 'domain', 'name', 'app', 'values']);
    assert.equal(data.schema, 'mdlxl-preset'); assert.equal(data.version, 1); assert.equal(data.domain, domain); assert.equal(data.app, '9.9.9');
  });
  for (const preset of listPresets(domain, fresh())) {
    test(`${domain}: built-in ${preset.id} survives export and load`, () => {
      const text = serializePreset(domain, fresh(), preset.id, '1'), parsed = parsePresetFile(text, { expectDomain: domain });
      const change = loadPreset(fresh(), parsed);
      assert.equal(change.presetId, preset.id);
      const direct = commit(fresh(), applyPreset(domain, fresh(), preset.id)), loaded = commit(fresh(), change);
      assert.deepEqual(domainState[domain](loaded), domainState[domain](direct));
    });
  }
}
test('modifier bindings travel with hotkeys, through normalizeModifiers', () => {
  const modifiers = normalizeModifiers({ 'drag.rotate.snap': 'Alt' }), sender = fresh({ modifiers });
  const data = JSON.parse(serializePreset('hotkeys', sender, CUSTOM_PRESET, '1', { name: 'N' }));
  assert.deepEqual(data.values.modifiers, modifiers);
  assert.deepEqual(parsePresetFile(JSON.stringify(data)).values.modifiers, modifiers);
  assert.deepEqual(commit(fresh(), applyPreset('hotkeys', fresh({ modifiers }), 'default')).modifiers, {});
});
test('older files without a key take the domain default, never what is set here', () => {
  const parsed = parsePresetFile(fileText('uv', { rotateSpeed: 40 }));
  assert.deepEqual(parsed.values, { ...normalizeUVDrag({ rotateSpeed: 40 }), uvSensitivity: 1 });
  assert.deepEqual(parsePresetFile(fileText('hotkeys', {})).values, { hotkeys: {}, modifiers: normalizeModifiers(undefined) });
});
test('explicit rotation defaults in a file are fine even though storage omits them', () => {
  const parsed = parsePresetFile(fileText('rotate', { sensitivity: 2, workplaneDrag: 'arrow', handleSensitivity: null, snap: 0 }));
  assert.equal(parsed.values.sensitivity, 2);
  assert.ok(!('workplaneDrag' in parsed.values));
});

// ---- Appearance files ------------------------------------------------------

const IMAGE = 'data:image/png;base64,AAAA';
const withImage = () => { const base = fresh(); return fresh({ viewportPreset: 'custom', theme: 'light', accent: '#123456', viewportAppearance: { ...base.viewportAppearance, background: { ...base.viewportAppearance.background, type: 'image', imageData: IMAGE, imageName: 'C:/Users/Me/secret.png' }, quadView: { ...base.viewportAppearance.quadView, background: { ...base.viewportAppearance.quadView.background, type: 'image', imageData: IMAGE, imageName: 'other.png' } } } }); };
test('appearance files embed images and drop the original file name', () => {
  const text = serializePreset('appearance', withImage(), CUSTOM_PRESET, '1', { name: 'Pic' });
  assert.doesNotMatch(text, /secret|other\.png/);
  const parsed = parsePresetFile(text);
  assert.equal(parsed.values.appearance.background.imageData, IMAGE);
  assert.equal(parsed.values.appearance.background.imageName, '');
  assert.equal(parsed.values.appearance.quadView.background.imageData, IMAGE);
  assert.equal(parsed.values.appearance.quadView.background.imageName, '');
});
test('an image name inside a file is dropped, and a saved preset keeps its own', () => {
  const data = JSON.parse(serializePreset('appearance', withImage(), CUSTOM_PRESET, '1', { name: 'Pic' }));
  data.values.appearance.background.imageName = 'planted.png';
  assert.equal(parsePresetFile(JSON.stringify(data)).values.appearance.background.imageName, '');
  const prefs = withImage(), next = commit(prefs, savePreset('appearance', prefs, 'Mine'));
  assert.equal(next.viewportPresets[0].appearance.background.imageName, 'C:/Users/Me/secret.png');
  assert.doesNotMatch(serializePreset('appearance', next, next.viewportPresets[0].id, '1'), /secret/);
});
test('appearance refuses a non-image data url and an unknown theme', () => {
  const data = JSON.parse(serializePreset('appearance', withImage(), CUSTOM_PRESET, '1', { name: 'Pic' }));
  refuses(JSON.stringify({ ...data, values: { ...data.values, appearance: { ...data.values.appearance, background: { ...data.values.appearance.background, imageData: 'data:text/html;base64,AAAA' } } } }), /invalid setting: appearance\.background/);
  refuses(JSON.stringify({ ...data, values: { ...data.values, theme: 'nope' } }), /invalid setting: theme/);
  refuses(JSON.stringify({ ...data, values: { ...data.values, accent: 'red' } }), /invalid setting: accent/);
});
test('a loaded appearance goes into the existing list and becomes active', () => {
  const text = serializePreset('appearance', edited.appearance(), CUSTOM_PRESET, '1', { name: 'Shared' });
  const next = commit(fresh(), loadPreset(fresh(), parsePresetFile(text)));
  assert.equal(next.viewportPresets.length, 1); assert.equal(next.viewportPreset, next.viewportPresets[0].id);
  assert.equal(next.accent, '#123456'); assert.equal(next.viewportAppearance.xrayVertices, true);
});

// ---- The whole look --------------------------------------------------------

const lookFile = prefs => JSON.parse(serializePreset('appearance', prefs, CUSTOM_PRESET, '1', { name: 'Look' }));
const oldPreset = appearance => ({ id: 'custom-old', name: 'Old', appearance, theme: 'light', accent: '#112233' });
function oldProfile() {
  const base = fresh();
  return fresh({ viewportPresets: [oldPreset(base.viewportAppearance)], viewportPreset: 'custom', toolHighlight: '#aaaaaa', visuals: { ...base.visuals, bone: '#bbbbbb' }, citadelPaint: { ...base.citadelPaint, brushCursor: '#cccccc' } });
}
test('a saved look brings back tool highlight, helpers and Citadel colours', () => {
  let prefs = edited.appearance();
  const saved = savePreset('appearance', prefs, 'Whole'), wanted = domainState.appearance(prefs);
  prefs = commit(prefs, saved);
  prefs = commit(prefs, { ...applyPreset('appearance', prefs, 'nord'), toolHighlight: '' });
  assert.notDeepEqual(domainState.appearance(prefs), wanted);
  prefs = commit(prefs, applyPreset('appearance', prefs, saved.presetId));
  assert.deepEqual(domainState.appearance(prefs), wanted);
  assert.equal(prefs.toolHighlight, '#654321'); assert.equal(prefs.visuals.bone, '#010203'); assert.equal(prefs.citadelPaint.borderThickness, 4);
});
test('a file carries the three look fields and only the helper colours', () => {
  const { values } = lookFile(edited.appearance());
  assert.equal(values.toolHighlight, '#654321');
  assert.deepEqual(Object.keys(values.visuals), [...APPEARANCE_HELPER_KEYS]);
  assert.equal(values.citadelPaint.brushCursor, '#070809');
  const sender = fresh({ ...edited.appearance(), visuals: { ...edited.appearance().visuals, gridMajor: '#123123' } });
  const receiver = fresh({ visuals: { ...fresh().visuals, gridMajor: '#456456' } });
  const next = commit(receiver, loadPreset(receiver, parsePresetFile(serializePreset('appearance', sender, CUSTOM_PRESET, '1', { name: 'Look' }))));
  assert.equal(next.visuals.gridMajor, '#456456', 'the Grid page is not part of a look');
  assert.equal(next.visuals.bone, '#010203'); assert.equal(next.toolHighlight, '#654321');
});
test('an empty tool highlight is a value: the preset clears it', () => {
  let prefs = fresh({ toolHighlight: '' });
  const saved = savePreset('appearance', prefs, 'Plain'); prefs = commit(prefs, saved);
  prefs = commit(prefs, { toolHighlight: '#abcabc' });
  assert.equal(commit(prefs, applyPreset('appearance', prefs, saved.presetId)).toolHighlight, '');
});
test('an older preset keeps its shape and leaves those settings alone', () => {
  const prefs = oldProfile();
  assert.deepEqual(Object.keys(prefs.viewportPresets[0]).sort(), ['accent', 'appearance', 'id', 'name', 'theme']);
  const change = applyPreset('appearance', prefs, 'custom-old');
  assert.deepEqual(Object.keys(change).sort(), ['accent', 'theme', 'viewportAppearance', 'viewportPreset']);
  const next = commit(prefs, change);
  assert.equal(next.toolHighlight, '#aaaaaa'); assert.equal(next.visuals.bone, '#bbbbbb'); assert.equal(next.citadelPaint.brushCursor, '#cccccc');
});
test('an older preset exported and loaded still leaves those settings alone', () => {
  const file = serializePreset('appearance', oldProfile(), 'custom-old', '1');
  assert.doesNotMatch(file, /toolHighlight|"visuals"|citadelPaint/);
  const receiver = fresh({ toolHighlight: '#dddddd', citadelPaint: { ...fresh().citadelPaint, brushCursor: '#eeeeee' } });
  const next = commit(receiver, loadPreset(receiver, parsePresetFile(file)));
  assert.equal(next.toolHighlight, '#dddddd'); assert.equal(next.citadelPaint.brushCursor, '#eeeeee');
});
test('a preset holding only some look fields writes only those', () => {
  const base = fresh(), prefs = fresh({ toolHighlight: '#aaaaaa', citadelPaint: { ...base.citadelPaint, brushCursor: '#cccccc' }, viewportPresets: [{ ...oldPreset(base.viewportAppearance), visuals: { bone: '#010203' } }] });
  const change = viewportPresetChange(prefs, 'custom-old');
  assert.ok(!('toolHighlight' in change)); assert.ok(!('citadelPaint' in change));
  assert.equal(change.visuals.bone, '#010203');
  assert.equal(change.visuals.keyframe, prefs.visuals.keyframe, 'the other helpers stay');
  assert.equal(change.visuals.gridMajor, prefs.visuals.gridMajor);
});
test('every built-in writes the same result as before and never the tool highlight', () => {
  const prefs = fresh({ toolHighlight: '#aaaaaa' });
  for (const [id, preset] of Object.entries(BUILT_IN_VIEWPORT_PRESETS)) {
    assert.deepEqual(viewportPresetChange(prefs, id), { viewportPreset: id, viewportAppearance: preset.appearance, theme: preset.theme, accent: preset.accent || viewportPresetChange(prefs, id).accent, visuals: { ...prefs.visuals, ...helpersForPreset(preset) }, citadelPaint: { ...prefs.citadelPaint, ...paintForPreset(preset) } }, id);
    assert.ok(!('toolHighlight' in preset) && !('visuals' in preset) && !('citadelPaint' in preset), id);
  }
});
test('a file of an old look does not reuse a same-named preset that differs in the look fields', () => {
  const prefs = oldProfile(), base = oldPreset(prefs.viewportAppearance);
  const values = { appearance: base.appearance, theme: base.theme, accent: base.accent, toolHighlight: '#111111' };
  const next = commit(prefs, loadPreset(prefs, parsePresetFile(fileText('appearance', values, { name: 'Old' }))));
  assert.deepEqual(next.viewportPresets.map(preset => preset.name), ['Old', 'Old (2)']);
  assert.equal(next.toolHighlight, '#111111');
});
test('going back to Unsaved custom restores the tool highlight too', () => {
  const prefs = edited.appearance(), captured = captureCustom('appearance', prefs);
  const away = commit(prefs, { toolHighlight: '#101010' });
  assert.equal(commit(away, restoreCustom('appearance', away, captured)).toolHighlight, '#654321');
});
test('appearanceLook is what the Presets page stores beside a look', () => {
  const look = appearanceLook(edited.appearance());
  assert.deepEqual(Object.keys(look), ['toolHighlight', 'visuals', 'citadelPaint']);
  assert.deepEqual(Object.keys(look.visuals), [...APPEARANCE_HELPER_KEYS]);
});
test('bad look values in a file are refused with the exact path', () => {
  const { values } = lookFile(edited.appearance());
  const refused = (field, value, path) => refuses(fileText('appearance', { ...values, [field]: value }), new RegExp('invalid setting: ' + path.replaceAll('.', '\\.') + '\\.'));
  for (const bad of ['red', '#ABCDEF', 5, null, ['#123456'], {}]) refused('toolHighlight', bad, 'toolHighlight');
  for (const bad of ['x', 5, null, [], {}]) refused('visuals', bad, 'visuals');
  for (const bad of ['red', '#ABCDEF', 5, null, ['#123456']]) refused('visuals', { ...values.visuals, bone: bad }, 'visuals.bone');
  refused('visuals', { ...values.visuals, gridMajor: '#000000' }, 'visuals.gridMajor');
  for (const bad of ['x', 5, null, [], {}]) refused('citadelPaint', bad, 'citadelPaint');
  refused('citadelPaint', { ...values.citadelPaint, evil: '#000000' }, 'citadelPaint.evil');
  for (const bad of ['red', 5, null, ['#123456']]) refused('citadelPaint', { ...values.citadelPaint, brushCursor: bad }, 'citadelPaint.brushCursor');
  for (const bad of [99, 0, '3', null, 'x']) refused('citadelPaint', { ...values.citadelPaint, borderThickness: bad }, 'citadelPaint.borderThickness');
});
test('forbidden keys inside the look fields are refused', () => {
  const { values } = lookFile(edited.appearance());
  refuses(fileText('appearance', { ...values, visuals: { ...values.visuals, spare: 1 } }).replace('"spare":1', '"__proto__":{"polluted":1}'), /not valid/);
  refuses(fileText('appearance', { ...values, citadelPaint: { ...values.citadelPaint, spare: 1 } }).replace('"spare":1', '"constructor":1'), /not valid/);
  assert.equal({}.polluted, undefined);
});
test('a colour given as an array is refused in words', () => {
  const { values } = lookFile(edited.appearance());
  refuses(fileText('appearance', { ...values, appearance: { ...values.appearance, selectedVertex: { ...values.appearance.selectedVertex, color: ['#123456'] } } }), /not valid/);
});
test('junk look fields in settings.json are dropped without touching the preset', () => {
  const appearance = fresh().viewportAppearance;
  const [item] = normalizeViewportPresets([{ ...oldPreset(appearance), toolHighlight: 'red', visuals: { bone: 'red', gridMajor: '#000000' }, citadelPaint: 5 }]);
  assert.deepEqual(Object.keys(item).sort(), ['accent', 'appearance', 'id', 'name', 'theme']);
  const [array] = normalizeViewportPresets([{ ...oldPreset(appearance), toolHighlight: ['#123456'], visuals: [], citadelPaint: [] }]);
  assert.deepEqual(Object.keys(array).sort(), ['accent', 'appearance', 'id', 'name', 'theme']);
});
test('saved looks are idempotent through preferences and Export configuration', () => {
  const prefs = commit(edited.appearance(), savePreset('appearance', edited.appearance(), 'Whole'));
  assert.deepEqual(normalizeViewportPresets(prefs.viewportPresets), prefs.viewportPresets);
  assert.deepEqual(importConfiguration(JSON.stringify(exportConfiguration(prefs))).viewportPresets, prefs.viewportPresets);
});

// ---- Hostile files ---------------------------------------------------------

test('an own __proto__ is refused at the top, in values, and deep inside', () => {
  const good = envelope('uv', uvValues), inner = JSON.stringify(good);
  refuses(inner.replace('{"schema"', '{"__proto__":{"polluted":1},"schema"'), /not valid/);
  refuses(inner.replace('"values":{', '"values":{"__proto__":{"polluted":1},'), /not valid/);
  refuses(fileText('hotkeys', { hotkeys: {} }).replace('"hotkeys":{}', '"hotkeys":{"__proto__":["G"]}'), /not valid/);
  refuses(fileText('uv', { list: [{ deep: { x: 1 } }] }).replace('"x":1', '"__proto__":1'), /not valid/);
  assert.equal({}.polluted, undefined);
});
test('constructor and prototype are refused at any depth', () => {
  refuses(fileText('uv', { constructor: 1 }), /not valid/);
  refuses(fileText('uv', { a: { b: { prototype: 1 } } }), /not valid/);
  refuses(fileText('hotkeys', { hotkeys: { constructor: ['G'] } }), /not valid/);
});
test('a file for another page says which page', () => {
  refuses(fileText('hotkeys', {}), /This preset is for Hotkeys\. Open that page/, { expectDomain: 'uv' });
  refuses(fileText('appearance', {}), /This preset is for Appearance/, { expectDomain: 'mouse' });
  refuses(fileText('uv', {}), /This preset is for UV Rotate and Zoom/, { expectDomain: 'rotate' });
});
test('an unknown domain is refused, including inherited names', () => {
  for (const domain of ['graphics', 'toString', 'hasOwnProperty', 7, null]) refuses(fileText(domain, {}), /not valid/);
});
test('values that are not canonical are refused with the exact path', () => {
  refuses(fileText('uv', { ...uvValues, nonsense: 1 }), /invalid setting: nonsense/);
  refuses(fileText('uv', { ...uvValues, rotateSpeed: '70' }), /invalid setting: rotateSpeed/);
  refuses(fileText('uv', { ...uvValues, rotateSpeed: 9999 }), /invalid setting: rotateSpeed/);
  refuses(fileText('uv', { ...uvValues, rotateSpeed: 1.5 }), /invalid setting: rotateSpeed/);
  refuses(fileText('uv', { ...uvValues, rotateStyle: 'spin' }), /invalid setting: rotateStyle/);
  refuses(fileText('uv', { ...uvValues, rotateBigPieces: 'yes' }), /invalid setting: rotateBigPieces/);
  refuses(fileText('uv', { ...uvValues, rotateSpeed: null }), /invalid setting: rotateSpeed/);
  refuses(fileText('uv', { ...uvValues, rotateSpeed: { a: 1 } }), /invalid setting: rotateSpeed/);
  refuses(fileText('uv', { ...uvValues, rotateSpeed: [70] }), /invalid setting: rotateSpeed/);
  refuses(fileText('mouse', { scrollSensitivity: 11 }), /invalid setting: scrollSensitivity/);
  refuses(fileText('mouse', { cameraBindings: { right: 'fly' } }), /invalid setting: cameraBindings\.right/);
  refuses(fileText('mouse', { cameraBindings: { right: 'pan', spare: 'x' } }), /invalid setting: cameraBindings\.spare/);
  refuses(fileText('mouse', { cameraBindings: 'pan' }), /invalid setting: cameraBindings/);
  refuses(fileText('mouse', { graphics: {} }), /invalid setting: graphics/);
  refuses(fileText('rotate', { sensitivity: 99 }), /invalid setting: sensitivity/);
  refuses(fileText('rotate', { workplaneDrag: 'spin' }), /invalid setting: workplaneDrag/);
  refuses(fileText('rotate', { editors: { paint: { sensitivity: 1 } } }), /invalid setting: editors\.paint/);
});
test('values must be an object', () => {
  for (const values of [null, 1, 'x', []]) for (const domain of PRESET_DOMAINS) refuses(fileText(domain, values), /not valid/);
});
test('a depth bomb is refused while a real depth is accepted', () => {
  let bomb = '1'; for (let level = 0; level < 200000; level += 1) bomb = '[' + bomb;
  bomb += ']'.repeat(200000);
  refuses(`{"schema":"mdlxl-preset","version":1,"domain":"uv","name":"x","app":"","values":{"a":${bomb}}}`, /not valid|too complex|too large/i);
  refuses(fileText('uv', { a: [[[[[[[[1]]]]]]]] }), /too complex/);
  refuses(fileText('uv', { a: [[[[[[1]]]]]] }), /invalid setting/, undefined);
});
test('a node bomb is refused', () => {
  refuses(fileText('hotkeys', { hotkeys: { a: Array(50_001).fill(0) } }), /too complex|too large/i);
  refuses(fileText('hotkeys', { hotkeys: Object.fromEntries(Array.from({ length: 5001 }, (_, index) => [`id${index}`, ['G']])) }), /too complex/);
});
test('long strings are refused', () => {
  refuses(fileText('uv', { rotateStyle: 'x'.repeat(4097) }), /too large/);
  refuses(fileText('uv', { imageData: 'x'.repeat(12_000_001) }), /too large/);
  refuses(fileText('uv', {}, { name: 'x'.repeat(4097) }), /too large/);
  refuses(`{"${'k'.repeat(4097)}":1}`, /too large/);
});
test('files over the size limits are refused before use', () => {
  refuses(fileText('uv', uvValues) + ' '.repeat(65 * 1024), /too large/);
  refuses(fileText('hotkeys', {}) + ' '.repeat(2 * 1024 * 1024 + 1), /too large/);
  refuses('x'.repeat(MAX_PRESET_FILE_BYTES + 1), /too large/);
});
test('a leading BOM is accepted', () => {
  assert.equal(parsePresetFile('\uFEFF' + fileText('uv', uvValues)).name, 'Shared');
});
test('a newer version is refused in words; other versions as invalid', () => {
  refuses(fileText('uv', uvValues, { version: 2 }), /made by a newer MDLxL/);
  for (const version of [0, -1, 1.5, '1', null]) refuses(fileText('uv', uvValues, { version }), /not valid/);
});
test('the envelope must be exact', () => {
  const data = envelope('uv', uvValues);
  refuses(JSON.stringify({ ...data, extra: 1 }), /not valid/);
  for (const key of ['domain', 'name', 'app', 'values']) { const { [key]: _, ...rest } = data; refuses(JSON.stringify(rest), /not valid/); }
  refuses(fileText('uv', uvValues, { schema: 'mdlxl-configuration' }), /not an MDLxL preset/);
  refuses(fileText('uv', uvValues, { app: 'x'.repeat(33) }), /not valid/);
  refuses(fileText('uv', uvValues, { app: 7 }), /not valid/);
  for (const bad of ['', 'not json', '[]', '1', 'null', '"text"']) refuses(bad, /not valid|not an MDLxL/);
  assert.throws(() => parsePresetFile(undefined), /not valid/);
});
test('control and direction characters are removed from names', () => {
  assert.equal(parsePresetFile(fileText('uv', uvValues, { name: '  A\u0000B\u0007\u202eC\u2066D\n ' })).name, 'ABCD');
  assert.equal(sanitizePresetName('\u200fx\u009f'), 'x');
  assert.equal(sanitizePresetName('y'.repeat(200)).length, 80);
  assert.equal(sanitizePresetName(7), '');
  for (const name of ['', '   ', '\u0000\u202e', 7, null]) refuses(fileText('uv', uvValues, { name }), /no name/);
});
test('what is applied is the normalizer\'s output, not the parsed tree', () => {
  const parsed = parsePresetFile(fileText('hotkeys', { hotkeys: { a: ['ctrl+g', 'CTRL+G'] } }));
  assert.deepEqual(parsed.values.hotkeys, { a: ['Ctrl+G'] });
  const change = applyPreset('uv', fresh(), 'mdlvis');
  assert.notEqual(change.uvDrag, UV_DRAG_PRESETS.mdlvis);
});

// ---- Hotkey files ----------------------------------------------------------

const catalog = [
  { id: 'translate', label: 'Move', category: 'Editor', defaultKeys: ['M'] },
  { id: 'rotate', label: 'Rotate', category: 'Editor', defaultKeys: ['R'] },
  { id: 'scale', label: 'Scale', defaultKeys: ['S'] },
  { id: 'Materials:new', label: 'New material', category: 'Material Manager', contextual: true, group: 'Materials', defaultKeys: ['N'] },
  { id: 'Textures:new', label: 'New texture', category: 'Texture Manager', contextual: true, group: 'Textures', defaultKeys: ['N'] },
];
test('the leader chord is refused, sequences after it are not', () => {
  for (const chord of ['Ctrl+Alt+Space', 'alt+ctrl+space']) refuses(fileText('hotkeys', { hotkeys: { translate: [chord] } }), /Ctrl\+Alt\+Space starts/, { catalog });
  assert.deepEqual(parsePresetFile(fileText('hotkeys', { hotkeys: { translate: ['Ctrl+Alt+Space > ABC'] } }), { catalog }).values.hotkeys, { translate: ['Ctrl+Alt+Space > ABC'] });
});
test('ids this PC has not seen are kept, count as waiting and raise no clash', () => {
  const parsed = parsePresetFile(fileText('hotkeys', { hotkeys: { 'Unopened:one': ['M'], 'Unopened:two': ['M'], translate: ['G'] } }), { catalog });
  assert.deepEqual(Object.keys(parsed.values.hotkeys).sort(), ['Unopened:one', 'Unopened:two', 'translate']);
  assert.equal(parsed.waiting, 2); assert.equal(parsed.skipped, 0);
  assert.equal(loadPreset(fresh(), parsed).status, 'Shared loaded. Keys for unopened windows: 2.');
});
test('a true clash between known controls is refused and names both', () => {
  refuses(fileText('hotkeys', { hotkeys: { translate: ['G'], rotate: ['G'] } }), /G is on both Move and Rotate in Editor\./, { catalog });
  refuses(fileText('hotkeys', { hotkeys: { scale: ['G'], translate: ['G'] } }), /G is on both/, { catalog });
});
test('a clash with a default the file leaves in place counts', () => {
  refuses(fileText('hotkeys', { hotkeys: { translate: ['R'] } }), /R is on both Move and Rotate/, { catalog });
  assert.ok(parsePresetFile(fileText('hotkeys', { hotkeys: { translate: ['R'], rotate: ['G'] } }), { catalog }));
});
test('a clash already in the defaults is not blamed on the file', () => {
  const clashing = [...catalog, { id: 'twin', label: 'Twin', defaultKeys: ['M'] }];
  assert.ok(parsePresetFile(fileText('hotkeys', { hotkeys: { scale: ['G'] } }), { catalog: clashing }));
});
test('the same key in different windows is allowed', () => {
  assert.ok(parsePresetFile(fileText('hotkeys', { hotkeys: { 'Materials:new': ['P'], 'Textures:new': ['P'] } }), { catalog }));
});
test('a binding-command override clashes through the control that uses it', () => {
  const bound = [...catalog, { id: 'button:move', label: 'Move button', bindingCommand: 'moveCommand', defaultKeys: [] }];
  refuses(fileText('hotkeys', { hotkeys: { moveCommand: ['R'] } }), /R is on both Move button and Rotate/, { catalog: bound });
});
test('without a catalog nothing can clash', () => {
  assert.equal(parsePresetFile(fileText('hotkeys', { hotkeys: { translate: ['G'], rotate: ['G'] } })).waiting, 0);
});
test('single bad entries are dropped and counted', () => {
  const parsed = parsePresetFile(fileText('hotkeys', { hotkeys: { translate: ['G', 'Ctrl+Ctrl+NotAKey', 7], rotate: 'R', scale: ['S'] } }), { catalog });
  assert.deepEqual(parsed.values.hotkeys, { translate: ['G'], scale: ['S'] });
  assert.equal(parsed.skipped, 3);
  assert.equal(loadPreset(fresh(), parsed).status, 'Shared loaded. Entries skipped: 3.');
});
test('more than eight chords per action are cut to eight and counted', () => {
  const parsed = parsePresetFile(fileText('hotkeys', { hotkeys: { translate: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] } }));
  assert.equal(parsed.values.hotkeys.translate.length, 8); assert.equal(parsed.skipped, 2);
});
test('ids and chords the settings store would refuse are dropped, so saving keeps working', () => {
  const parsed = parsePresetFile(fileText('hotkeys', { hotkeys: { 'bad\nid': ['G'], ok: ['\u0001', 'H'] } }));
  assert.deepEqual(parsed.values.hotkeys, { ok: ['H'] });
  assert.equal(parsed.skipped, 2);
});
test('unknown top-level hotkey fields and wrong shapes are refused', () => {
  refuses(fileText('hotkeys', { windowKeys: {} }), /invalid setting: windowKeys/);
  refuses(fileText('hotkeys', { hotkeys: [] }), /invalid setting: hotkeys/);
  refuses(fileText('hotkeys', { modifiers: 1 }), /invalid setting: modifiers/);
});
test('legacy ids are carried over', () => {
  assert.deepEqual(parsePresetFile(fileText('hotkeys', { hotkeys: { 'settings:warmkeys:search': ['G'] } })).values.hotkeys, { 'settings:hotkeys:search': ['G'] });
});
test('both kinds of note fit in one status', () => {
  const parsed = parsePresetFile(fileText('hotkeys', { hotkeys: { unseen: ['G'], rotate: 'R' } }), { catalog });
  assert.equal(loadPreset(fresh(), parsed).status, 'Shared loaded. Entries skipped: 1. Keys for unopened windows: 1.');
});

// ---- Stored lists ----------------------------------------------------------

test('normalizing the stored lists throws nothing away that is valid and is idempotent', () => {
  let prefs = fresh();
  for (const domain of ['mouse', 'rotate', 'uv', 'hotkeys']) { const source = edited[domain](); prefs = commit(prefs, savePreset(domain, { ...source, settingsPresets: prefs.settingsPresets }, 'Mine')); }
  assert.deepEqual(normalizeSettingsPresets(prefs.settingsPresets), prefs.settingsPresets);
  assert.deepEqual(normalizeSettingsPresets(JSON.parse(JSON.stringify(prefs.settingsPresets))), prefs.settingsPresets);
});
test('a list already normalized is not worked through again, but an equal copy is', () => {
  const once = normalizeSettingsPresets({ mouse: [{ id: 'custom-a', name: 'A', values: { scrollSensitivity: 3 } }] });
  assert.equal(normalizeSettingsPresets(once).mouse[0].values, once.mouse[0].values);
  const copy = JSON.parse(JSON.stringify(once));
  copy.mouse[0].values.scrollSensitivity = 999;
  assert.equal(normalizeSettingsPresets(copy).mouse[0].values.scrollSensitivity, 10);
});
test('junk in settings.json cannot get through', () => {
  for (const input of [undefined, null, 1, 'x', []]) assert.deepEqual(normalizeSettingsPresets(input), { mouse: [], rotate: [], uv: [], hotkeys: [] });
  const values = normalizeUVDrag({});
  const cleaned = normalizeSettingsPresets({ uv: [null, 1, { id: 'bad id', name: 'A', values }, { id: 'custom-1', name: '', values }, { id: 'custom-2', name: 'B', values: 7 }, { id: 'custom-3', name: 'C', values }, { id: 'custom-3', name: 'D', values }, { id: 'custom-4', name: 'c', values }, { id: 'custom-5', name: 'E\u202e', values: { rotateSpeed: 99999 } }], extra: [{}] });
  assert.deepEqual(cleaned.uv.map(item => [item.id, item.name]), [['custom-3', 'C'], ['custom-5', 'E']]);
  assert.equal(cleaned.uv[1].values.rotateSpeed, 200);
  assert.ok(!('extra' in cleaned));
});
test('saved presets ride along in Export configuration and come back', () => {
  let prefs = edited.uv();
  prefs = commit(prefs, savePreset('uv', prefs, 'Mine'));
  const hotkeyPrefs = edited.hotkeys(); prefs = commit(prefs, savePreset('hotkeys', { ...hotkeyPrefs, settingsPresets: prefs.settingsPresets }, 'Keys'));
  const restored = importConfiguration(JSON.stringify(exportConfiguration(prefs)));
  assert.deepEqual(restored.settingsPresets, prefs.settingsPresets);
});

// ---- Desktop channels ------------------------------------------------------

test('two thin IPC channels, editor only, same size limit as the module', () => {
  const main = source('electron/main.cjs'), preload = source('electron/preload.cjs');
  assert.match(main, /ipcMain\.handle\('presets:openFile',async event=>\{\s*editorOnly\(event/);
  assert.match(main, /ipcMain\.handle\('presets:saveFile',async\(event,payload\)=>\{\s*editorOnly\(event/);
  assert.match(preload, /presetOpenFile: \(\)=>call\('presets:openFile'\)/);
  assert.match(preload, /presetSaveFile: payload=>call\('presets:saveFile',payload\)/);
  const limit = /const MAX_PRESET_FILE=(\d+)\*(\d+)\*(\d+);/.exec(main);
  assert.ok(limit); assert.equal(Number(limit[1]) * Number(limit[2]) * Number(limit[3]), MAX_PRESET_FILE_BYTES);
  assert.equal([...main.matchAll(/ipcMain\.handle\('presets:/g)].length, 2);
});

// ---- The bar ---------------------------------------------------------------

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('vite'))('esbuild');
async function barModule() {
  const result = await build({ entryPoints: [fileURLToPath(new URL('../app/PresetBar.jsx', import.meta.url))], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', loader: { '.css': 'empty' }, logLevel: 'silent' });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  return module.exports;
}
const bar = await barModule(), PresetBar = bar.default, PresetNameRow = bar.PresetNameRow;
const renderBar = (domain, preferences, props = {}) => renderToStaticMarkup(React.createElement(PresetBar, { domain, preferences, commit() {}, ...props }));

for (const domain of PRESET_DOMAINS) test(`${domain}: bar shows the four actions with their hotkey ids and tooltips`, () => {
  const html = renderBar(domain, fresh());
  for (const part of ['select', 'save-as', 'load', 'restore']) assert.match(html, new RegExp(`<[a-z]+[^>]*data-hotkey="preset:${domain}:${part}"[^>]*title="[^"]+"|<[a-z]+[^>]*title="[^"]+"[^>]*data-hotkey="preset:${domain}:${part}"`), part);
  assert.match(html, />Save as…</); assert.match(html, />Load from…</); assert.match(html, />Restore</); assert.match(html, />Preset</);
  assert.match(html, /<optgroup label="Built-in">/);
  assert.doesNotMatch(html, /optgroup label="Saved"/);
  assert.doesNotMatch(html, /Preset name|Save to file/, 'the name row waits for a deliberate click');
  assert.doesNotMatch(html, new RegExp(`preset:${domain}:delete`));
  // Appearance's list holds the viewport looks that shipped before this work, under their existing names.
  if (domain !== 'appearance') assert.doesNotMatch(html, /Blender|Maya/i);
});
test('nothing matching shows one disabled Custom entry', () => {
  const html = renderBar('uv', fresh({ uvDrag: { ...DEFAULT_UV_DRAG, zoomSpeed: 150 } }));
  assert.match(html, /<option value="custom" disabled="" selected="">Custom<\/option>/);
  assert.equal([...html.matchAll(/>Custom</g)].length, 1);
  assert.doesNotMatch(renderBar('uv', fresh()), />Custom</);
});
test('a saved preset is listed and, while active, can be deleted', () => {
  let prefs = fresh({ uvDrag: { ...DEFAULT_UV_DRAG, zoomSpeed: 150 } });
  prefs = commit(prefs, savePreset('uv', prefs, 'A <b>name'));
  const html = renderBar('uv', prefs);
  assert.match(html, /<optgroup label="Saved">/);
  assert.match(html, /A &lt;b&gt;name/);
  assert.match(html, /data-hotkey="preset:uv:delete"/);
  assert.match(html, /aria-label="Delete this preset"/);
  assert.doesNotMatch(html, /Delete selected preset/, 'that name belongs to the Appearance page button');
});
test('Appearance can jump to its Presets page and still write a file', () => {
  const html = renderBar('appearance', fresh(), { onSaveAs() {}, selectLabel: 'Viewport appearance preset' });
  assert.match(html, /aria-label="Viewport appearance preset"/);
  assert.match(html, /data-hotkey="preset:appearance:save-file"/);
  assert.match(html, />Save to file…</);
});
test('without the desktop bridge a hidden file input is the fallback; with it there is none', () => {
  assert.match(renderBar('uv', fresh()), /type="file" accept="\.mdlxl-preset,\.json"/);
  globalThis.desktop = { presetOpenFile() {}, presetSaveFile() {} };
  try { assert.doesNotMatch(renderBar('uv', fresh()), /type="file"/); }
  finally { delete globalThis.desktop; }
});
test('the bar takes no default hotkey letters', () => {
  const html = renderBar('uv', fresh()), ids = [...html.matchAll(/<[a-z]+[^>]*data-hotkey="preset:[^>]*>/g)].map(match => match[0]);
  assert.equal(ids.length, 4);
  for (const tag of ids) assert.match(tag, /data-hotkey-manual=""/);
});
test('the name row has a name box, Save, Save to file and a way out', () => {
  const html = renderToStaticMarkup(React.createElement(PresetNameRow, { domain: 'uv', name: '', onName() {}, onSave() {}, onSaveFile() {}, onClose() {} }));
  assert.match(html, /aria-label="Preset name"/);
  assert.match(html, /<button type="submit"[^>]*disabled=""[^>]*>Save<\/button>/);
  assert.match(html, /<button type="button"[^>]*>Save to file…<\/button>/);
  assert.match(html, /<button type="button"[^>]*>Cancel<\/button>/);
  for (const part of ['name', 'save', 'save-file', 'close']) assert.match(html, new RegExp(`data-hotkey="preset:uv:${part}"`));
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(PresetNameRow, { domain: 'uv', name: 'Mine', onName() {}, onSave() {}, onSaveFile() {}, onClose() {} })), /disabled/);
});
test('the bar claims Escape at priority 20 and styles only with theme tokens', () => {
  const jsx = source('app/PresetBar.jsx'), css = source('app/preset-bar.css');
  assert.match(jsx, /useWindowKeyClaim\(\(\{ event, localWindow \}\) => \{[\s\S]*?\n  \}, 20\);/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.match(css, /flex-wrap:wrap/);
  assert.doesNotMatch(jsx, /Blender|Maya/i);
});
