import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DEFAULT_MODIFIERS, MODIFIER_MEANINGS, MODIFIER_VALUES, assignModifier, dragKeys, isModifierKey, modifierConflicts, modifierHeld, modifierLabel, modifierRows, modifierSentence, modifierValue, normalizeModifiers, selectionKeys } from '../src/modifier-bindings.js';
import { normalizePreferences } from '../src/preferences.js';
import { parsePresetFile, serializePreset, CUSTOM_PRESET, loadPreset } from '../src/settings-presets.js';
import { forgetRebound, learnBindings, reboundDragKeys } from '../src/learn-keycaps.js';

const prefs = modifiers => ({ modifiers });
const event = (shiftKey = false, ctrlKey = false, altKey = false, metaKey = false) => ({ shiftKey, ctrlKey, altKey, metaKey });
const everyEvent = [false, true].flatMap(shift => [false, true].flatMap(ctrl => [false, true].flatMap(alt => [false, true].map(meta => event(shift, ctrl, alt, meta)))));

test('the table holds today\'s keys and stored preferences hold only changes', () => {
  assert.deepEqual(DEFAULT_MODIFIERS, {});
  assert.deepEqual(MODIFIER_VALUES, ['Shift', 'Ctrl', 'Alt', '']);
  assert.equal(new Set(MODIFIER_MEANINGS.map(item => item.id)).size, MODIFIER_MEANINGS.length);
  assert.deepEqual(Object.fromEntries(MODIFIER_MEANINGS.map(item => [item.id, item.defaultValue])), {
    'drag.move.axisLock': 'Shift', 'drag.rotate.fine': 'Shift', 'drag.rotate.snap': 'Ctrl', 'drag.scale.planeLock': 'Shift', 'drag.scale.spread': 'Ctrl', 'drag.scale.snap': 'Shift',
    'drag.uv.fine': 'Shift', 'drag.uv.pressFine': 'Alt', 'drag.uv.snap': 'Ctrl', 'drag.uv.axisLock': 'Shift', 'select.add': 'Shift', 'select.remove': 'Ctrl', 'view.orbit': 'Alt',
  });
  assert.deepEqual(normalizePreferences({}).modifiers, {});
  for (const item of MODIFIER_MEANINGS) for (const field of ['id', 'scope', 'scopeLabel', 'label', 'phase', 'tooltip']) assert.ok(item[field], `${item.id} ${field}`);
});

test('normalizing keeps only known meanings with a valid, changed key', () => {
  assert.deepEqual(normalizeModifiers({ 'drag.rotate.fine': 'Alt', 'drag.rotate.snap': 'Ctrl', 'select.add': '', 'view.orbit': 'Win', nope: 'Shift', 'drag.scale.snap': 3 }), { 'drag.rotate.fine': 'Alt', 'select.add': '' });
  for (const junk of [undefined, null, 7, 'Shift', ['Shift']]) assert.deepEqual(normalizeModifiers(junk), {});
  assert.deepEqual(normalizeModifiers({ __proto__: { 'drag.rotate.fine': 'Alt' } }), {}, 'inherited values are not read');
  assert.deepEqual(normalizePreferences({ modifiers: { 'drag.rotate.snap': 'Alt', bad: 'Shift' } }).modifiers, { 'drag.rotate.snap': 'Alt' });
});

test('a binding reads the matching flag: Ctrl includes Meta, none is never held', () => {
  for (const candidate of everyEvent) {
    assert.equal(modifierHeld(candidate, 'drag.move.axisLock', undefined), candidate.shiftKey);
    assert.equal(modifierHeld(candidate, 'drag.rotate.snap', undefined), candidate.ctrlKey || candidate.metaKey);
    assert.equal(modifierHeld(candidate, 'view.orbit', undefined), candidate.altKey);
    assert.equal(modifierHeld(candidate, 'drag.rotate.fine', prefs({ 'drag.rotate.fine': 'Alt' })), candidate.altKey);
    assert.equal(modifierHeld(candidate, 'drag.rotate.fine', prefs({ 'drag.rotate.fine': '' })), false);
  }
  assert.equal(modifierHeld(event(true), 'no.such.meaning', undefined), false);
  assert.equal(modifierHeld(event(true), 'drag.move.axisLock', prefs({ 'drag.move.axisLock': 'Bogus' })), true, 'a bad stored value falls back to the table');
});

test('untouched preferences compute exactly the literal reads every drag owner used to make', () => {
  for (const candidate of everyEvent) for (const preferences of [undefined, {}, prefs({}), normalizePreferences({})]) {
    const shift = candidate.shiftKey, ctrl = candidate.ctrlKey || candidate.metaKey;
    assert.deepEqual(dragKeys(candidate, 'translate', preferences), { shiftKey: shift, ctrlKey: false });
    assert.deepEqual(dragKeys(candidate, 'move', preferences), { shiftKey: shift, ctrlKey: false });
    assert.deepEqual(dragKeys(candidate, 'rotate', preferences), { shiftKey: shift, ctrlKey: ctrl });
    assert.deepEqual(dragKeys(candidate, 'scale', preferences), { shiftKey: shift, ctrlKey: ctrl });
    assert.deepEqual(dragKeys(candidate, 'scale-handle', preferences), { shiftKey: shift, ctrlKey: false });
    assert.deepEqual(selectionKeys(candidate, preferences), { shift, ctrl });
    assert.equal(modifierHeld(candidate, 'view.orbit', preferences), candidate.altKey);
    assert.equal(modifierHeld(candidate, 'drag.uv.fine', preferences), shift);
    assert.equal(modifierHeld(candidate, 'drag.uv.pressFine', preferences), candidate.altKey);
    assert.equal(modifierHeld(candidate, 'drag.uv.snap', preferences), ctrl);
    assert.equal(modifierHeld(candidate, 'drag.uv.axisLock', preferences), shift);
  }
});

test('rebinding follows into every flag the drag math reads', () => {
  const rebound = prefs({ 'drag.rotate.fine': 'Alt', 'drag.rotate.snap': 'Shift', 'drag.move.axisLock': 'Ctrl', 'drag.scale.planeLock': 'Alt', 'drag.scale.spread': 'Shift', 'select.add': 'Alt', 'select.remove': 'Shift' });
  assert.deepEqual(dragKeys(event(false, false, true), 'rotate', rebound), { shiftKey: true, ctrlKey: false });
  assert.deepEqual(dragKeys(event(true), 'rotate', rebound), { shiftKey: false, ctrlKey: true });
  assert.deepEqual(dragKeys(event(false, true), 'translate', rebound), { shiftKey: true, ctrlKey: false });
  assert.deepEqual(dragKeys(event(true, false, true), 'scale', rebound), { shiftKey: true, ctrlKey: true });
  assert.deepEqual(selectionKeys(event(true, false, true), rebound), { shift: true, ctrl: true });
  assert.deepEqual(dragKeys(event(true), 'select', rebound), { shiftKey: false, ctrlKey: false }, 'a drag kind with no keys reads nothing');
  for (const key of ['Shift', 'Control', 'Alt', 'Meta', 'AltGraph']) assert.equal(isModifierKey(key), true, key);
  for (const key of ['a', 'Escape', 'Delete', 'F1', 'z']) assert.equal(isModifierKey(key), false, key);
});

test('labels and sentences show the current key, and drop out with none', () => {
  assert.equal(modifierLabel('drag.rotate.fine', undefined), 'Shift');
  assert.equal(modifierLabel('drag.rotate.fine', prefs({ 'drag.rotate.fine': 'Alt' })), 'Alt');
  assert.equal(modifierLabel('drag.rotate.fine', prefs({ 'drag.rotate.fine': '' })), '');
  assert.equal(modifierSentence('Hold {0} to lock direction.', 'drag.move.axisLock', undefined), 'Hold Shift to lock direction.', 'the default text is the shipped text');
  assert.equal(modifierSentence('Hold {0} to lock direction.', 'drag.move.axisLock', prefs({ 'drag.move.axisLock': 'Ctrl' })), 'Hold Ctrl to lock direction.');
  assert.equal(modifierSentence('Hold {0} to lock direction.', 'drag.move.axisLock', prefs({ 'drag.move.axisLock': '' })), '');
  assert.equal(modifierValue('drag.scale.snap', undefined), 'Shift');
});

test('conflicts are per scope; the same key may differ between scopes', () => {
  assert.deepEqual(modifierConflicts({}), [], 'the shipped defaults are clean');
  const rotate = modifierConflicts({ 'drag.rotate.fine': 'Ctrl' });
  assert.equal(rotate.length, 1);
  assert.deepEqual(rotate[0].ids, ['drag.rotate.fine', 'drag.rotate.snap']);
  assert.match(rotate[0].message, /Ctrl is assigned to Fine control \(Rotate\), Snap to steps \(Rotate\)/);
  assert.deepEqual(modifierConflicts({ 'view.orbit': 'Shift' })[0].ids, ['select.add', 'view.orbit'], 'camera and selection share the mouse press');
  assert.deepEqual(modifierConflicts({ 'select.add': '', 'select.remove': '' }), [], 'none never clashes');
  assert.deepEqual(modifierConflicts({ 'drag.rotate.fine': 'Alt', 'drag.scale.planeLock': 'Alt' }), [], 'different scopes');
  assert.deepEqual(modifierConflicts({ 'drag.uv.pressFine': 'Shift' })[0].ids, ['drag.uv.fine', 'drag.uv.pressFine']);
});

test('assigning refuses a clash until replaced, and stores only changes', () => {
  const refused = assignModifier({}, 'drag.rotate.fine', 'Ctrl');
  assert.equal(refused.applied, false); assert.deepEqual(refused.modifiers, {});
  assert.equal(refused.conflict, 'Ctrl is assigned to Snap to steps (Rotate). Replace removes this key from those actions.');
  const replaced = assignModifier({}, 'drag.rotate.fine', 'Ctrl', { replace: true });
  assert.equal(replaced.applied, true); assert.equal(replaced.conflict, '');
  assert.deepEqual(replaced.modifiers, { 'drag.rotate.fine': 'Ctrl', 'drag.rotate.snap': '' });
  assert.deepEqual(modifierConflicts(replaced.modifiers), []);
  assert.deepEqual(assignModifier({ 'drag.rotate.fine': 'Alt' }, 'drag.rotate.fine', 'Shift').modifiers, {}, 'back to the default leaves nothing stored');
  assert.deepEqual(assignModifier({}, 'select.add', '').modifiers, { 'select.add': '' });
  assert.deepEqual(assignModifier({}, 'no.such', 'Alt'), { modifiers: {}, applied: false, conflict: '' });
  assert.deepEqual(assignModifier({}, 'select.add', 'Win'), { modifiers: {}, applied: false, conflict: '' });
});

test('the Settings rows carry everything the page shows and saves through one function', () => {
  const saved = [], rows = modifierRows({ modifiers: { 'drag.rotate.fine': 'Alt' } }, next => saved.push(next));
  assert.equal(rows.length, MODIFIER_MEANINGS.length);
  const fine = rows.find(row => row.id === 'drag.rotate.fine'), snap = rows.find(row => row.id === 'drag.rotate.snap');
  assert.equal(fine.label, 'Fine control'); assert.equal(fine.scopeLabel, 'Rotate'); assert.equal(fine.value, 'Alt'); assert.equal(fine.defaultValue, 'Shift');
  assert.equal(fine.ariaLabel, 'Fine control key, Rotate');
  assert.deepEqual(fine.allowed, [{ value: 'Shift', label: 'Shift' }, { value: 'Ctrl', label: 'Ctrl' }, { value: 'Alt', label: 'Alt' }, { value: '', label: 'None' }]);
  assert.equal(fine.conflict, ''); assert.ok(fine.tooltip);
  const refused = snap.change('Alt');
  assert.equal(refused.applied, false); assert.match(refused.conflict, /^Alt is assigned to Fine control \(Rotate\)/); assert.deepEqual(saved, [], 'a refused key saves nothing');
  assert.equal(snap.change('Alt', { replace: true }).applied, true);
  assert.deepEqual(saved, [{ 'drag.rotate.fine': '', 'drag.rotate.snap': 'Alt' }]);
  const stored = modifierRows({ modifiers: { 'view.orbit': 'Ctrl' } }, () => {});
  assert.match(stored.find(row => row.id === 'view.orbit').conflict, /Choose a different key/, 'a clash already stored shows on both rows');
  assert.match(stored.find(row => row.id === 'select.remove').conflict, /Choose a different key/);
  assert.equal(stored.find(row => row.id === 'select.add').conflict, '');
});

test('a hotkeys preset carries drag keys there and back, and reports dropped entries', () => {
  const modifiers = { 'drag.rotate.fine': 'Alt', 'drag.rotate.snap': 'Shift', 'select.add': '' };
  const sender = normalizePreferences({ modelLookAnswered: true, modifiers });
  const text = serializePreset('hotkeys', sender, CUSTOM_PRESET, '1', { name: 'Mine' });
  assert.deepEqual(JSON.parse(text).values.modifiers, modifiers);
  const parsed = parsePresetFile(text);
  assert.deepEqual(parsed.values.modifiers, modifiers); assert.equal(parsed.skipped, 0);
  const receiver = normalizePreferences({ modelLookAnswered: true }), loaded = normalizePreferences({ ...receiver, ...loadPreset(receiver, parsed) });
  assert.deepEqual(loaded.modifiers, modifiers);
  const junk = parsePresetFile(JSON.stringify({ schema: 'mdlxl-preset', version: 1, domain: 'hotkeys', name: 'x', app: '1', values: { modifiers: { 'drag.rotate.fine': 'Alt', 'view.orbit': 'Hyper', other: 'Shift' } } }));
  assert.deepEqual(junk.values.modifiers, { 'drag.rotate.fine': 'Alt' }); assert.equal(junk.skipped, 2);
});

test('Learn: an untouched profile adds nothing; a changed drag key is a new key to learn for its tool', () => {
  assert.deepEqual(reboundDragKeys('rotate', undefined), []);
  const shortcuts = { rotate: ['R'], translate: ['M', 'Q'], undo: ['Ctrl+Z'] };
  assert.deepEqual(learnBindings(shortcuts, undefined), shortcuts);
  const rebound = prefs({ 'drag.rotate.fine': 'Alt', 'drag.uv.snap': 'Shift', 'drag.rotate.snap': '' });
  assert.deepEqual(reboundDragKeys('rotate', rebound), [{ id: 'drag.rotate.fine', key: 'Alt', label: 'Fine control' }], 'a key taken away has nothing to teach');
  assert.deepEqual(reboundDragKeys('rotate', rebound, true), [{ id: 'drag.uv.snap', key: 'Shift', label: 'Snap to steps' }], 'the UV Wrapper shows its own keys');
  assert.deepEqual(reboundDragKeys('undo', rebound), []);
  const notebook = { version: 1, keys: { rotate: { uses: 3, quietUntil: 9e12, silenced: true }, translate: { uses: 2, quietUntil: 0, silenced: false }, undo: { uses: 1, quietUntil: 0, silenced: false } } };
  const next = forgetRebound(notebook, learnBindings(shortcuts, undefined), learnBindings(shortcuts, rebound));
  assert.deepEqual(next.keys.rotate, { uses: 0, quietUntil: 0, silenced: true }, 'a mute survives');
  assert.equal(next.keys.translate, notebook.keys.translate); assert.equal(next.keys.undo, notebook.keys.undo);
  assert.equal(forgetRebound(notebook, learnBindings(shortcuts, rebound), learnBindings(shortcuts, rebound)), notebook, 'nothing changed, same notebook');
});

const appFile = name => readFileSync(new URL('../app/' + name, import.meta.url), 'utf8');
const LITERAL = /\b(?:event|sample|e)\.(?:shiftKey|ctrlKey|altKey|metaKey)\b/;
test('every meaning used in the app exists, and the drag owners keep no literal reads', () => {
  const ids = new Set(MODIFIER_MEANINGS.map(item => item.id));
  for (const name of readdirSync(new URL('../app/', import.meta.url)).filter(file => /\.jsx?$/.test(file))) {
    for (const [, id] of appFile(name).matchAll(/(?:modifierHeld|modifierLabel|modifierValue)\([^,()]*,?\s*'([a-z.A-Z]+)'/g)) assert.ok(ids.has(id), `${name}: ${id}`);
    for (const [, id] of appFile(name).matchAll(/modifierSentence\('[^']*',\s*'([a-z.A-Z]+)'/g)) assert.ok(ids.has(id), `${name}: ${id}`);
  }
  for (const name of ['UVEditor.jsx', 'StageRotate.jsx', 'ShowcaseLayers.jsx', 'ShiftLockBadge.jsx', 'game-preview-data.js']) assert.doesNotMatch(appFile(name), LITERAL, name);
  // Every line left reads a flag the drag owner already computed, or one of the keys that stay fixed: Forge's part snap, the camera's own Shift, the Showcase camera swap, hold-A, lamps.
  const allowed = {
    'Viewport.jsx': ['function point(event)', 'gizmoMoveTranslation(', 'solveViewMove(', 'partHover =', 'hoverMove = {', 'hoverMove.event.shiftKey', 'dragScale(dx, drag.workplane', 'event.ctrlKey ? spreadOffsets(', 'rotationDragDegrees(drag.rotationDrag'],
    'GamePreview.jsx': ['gizmoMoveTranslation(', 'solveViewMove(', 'rotationAmount(', 'movementFreeScaleValues(', 'scaleConstrained =', 'Math.round(nodeGesture.amount', 'rotating = p.showcase', 'shiftScreenDrag', 'layoutKey(event)'],
    'PaintViewport.jsx': ['lampFine: event.shiftKey', 'pendingPicks', '!p.paintSelectedLamp', 'paintLampDrag('],
  };
  for (const [name, known] of Object.entries(allowed)) for (const line of appFile(name).split('\n').filter(item => LITERAL.test(item))) assert.ok(known.some(part => line.includes(part)), name + ': ' + line.trim().slice(0, 90));
});
