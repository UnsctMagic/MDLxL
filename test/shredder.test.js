import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SHREDDER, SHREDDER_TEST_VERSION, normalizeShredder, emptyNotebook, normalizeNotebook, recordKeyUse, silenceKey,
  clearSilences, clearLearned, notebookCounts, reminderFor, directKey, keyCaps, paintKeyLabel,
} from '../src/shredder-keycaps.js';
import { normalizePreferences } from '../src/preferences.js';

const HOUR = 60 * 60 * 1000, NOW = 1_800_000_000_000;

test('defaults keep five uses and 24 quiet hours, and the test switch turns reminders on', () => {
  assert.equal(DEFAULT_SHREDDER.learnUses, 5);
  assert.equal(DEFAULT_SHREDDER.quietHours, 24);
  assert.equal(DEFAULT_SHREDDER.enabled, SHREDDER_TEST_VERSION);
  assert.deepEqual(normalizePreferences({}).shredder, normalizeShredder(undefined));
});

test('settings are normalized, and the old on/off switch is kept', () => {
  assert.equal(normalizeShredder(false).enabled, false);
  assert.equal(normalizeShredder(true).enabled, true);
  assert.deepEqual(normalizeShredder({ enabled: true, position: 'top', size: 'large', style: 'flash', duration: 0, learnUses: 3, quietHours: 1 }),
    { enabled: true, position: 'top', size: 'large', style: 'flash', duration: 0, learnUses: 3, quietHours: 1 });
  const junk = normalizeShredder({ position: 'moon', size: 9, style: 'disco', duration: 7, learnUses: '5', quietHours: -1 });
  assert.deepEqual({ ...junk, enabled: DEFAULT_SHREDDER.enabled }, { ...DEFAULT_SHREDDER });
  assert.deepEqual(normalizePreferences({ shredder: { enabled: false, size: 'small' } }).shredder, { ...DEFAULT_SHREDDER, enabled: false, size: 'small' });
});

test('a click reminds of the key, or of the Ctrl+Alt+Space code when that is all it has', () => {
  const notebook = emptyNotebook();
  assert.equal(reminderFor(notebook, 'translate', ['M'], NOW), 'M');
  assert.equal(reminderFor(notebook, 'thing', ['Ctrl+Alt+Space > ABC'], NOW), 'Ctrl+Alt+Space > ABC');
  assert.equal(reminderFor(notebook, 'thing', ['Ctrl+Alt+Space > ABC', 'Shift+K'], NOW), 'Shift+K', 'a direct key wins');
  assert.equal(reminderFor(notebook, 'none', [], NOW), '');
  assert.equal(directKey(undefined), '');
});

test('five real uses quiet that key for 24 hours, and only that key', () => {
  let notebook = emptyNotebook();
  for (let use = 0; use < 4; use++) notebook = recordKeyUse(notebook, 'translate', { now: NOW + use });
  assert.equal(reminderFor(notebook, 'translate', ['M'], NOW + 10), 'M', 'four uses are not enough');
  notebook = recordKeyUse(notebook, 'translate', { now: NOW + 10 });
  assert.equal(reminderFor(notebook, 'translate', ['M'], NOW + 11), '');
  assert.equal(reminderFor(notebook, 'rotate', ['R'], NOW + 11), 'R', 'other keys still remind');
  assert.equal(reminderFor(notebook, 'translate', ['M'], NOW + 10 + 24 * HOUR - 1), '');
  assert.equal(reminderFor(notebook, 'translate', ['M'], NOW + 10 + 24 * HOUR), 'M', 'back after 24 hours');
  // A later successful use renews quiet time without stacking up uses.
  notebook = recordKeyUse(notebook, 'translate', { now: NOW + 20 });
  assert.equal(notebook.keys.translate.uses, 0);
});

test('custom learn counts and quiet hours apply', () => {
  const settings = normalizeShredder({ learnUses: 3, quietHours: 1 });
  let notebook = emptyNotebook();
  for (let use = 0; use < 3; use++) notebook = recordKeyUse(notebook, 'save', { now: NOW, settings });
  assert.equal(reminderFor(notebook, 'save', ['Ctrl+S'], NOW + HOUR - 1), '');
  assert.equal(reminderFor(notebook, 'save', ['Ctrl+S'], NOW + HOUR), 'Ctrl+S');
});

test('silencing is per key and the settings can bring silenced and learned keys back', () => {
  let notebook = silenceKey(emptyNotebook(), 'translate');
  for (let use = 0; use < 5; use++) notebook = recordKeyUse(notebook, 'rotate', { now: NOW });
  assert.equal(reminderFor(notebook, 'translate', ['M'], NOW), '');
  assert.equal(reminderFor(notebook, 'scale', ['S'], NOW), 'S');
  assert.deepEqual(notebookCounts(notebook, NOW), { silenced: 1, learned: 1 });
  const unsilenced = clearSilences(notebook);
  assert.equal(reminderFor(unsilenced, 'translate', ['M'], NOW), 'M');
  assert.equal(reminderFor(unsilenced, 'rotate', ['R'], NOW), '', 'clearing silences keeps learned keys quiet');
  const relearn = clearLearned(notebook);
  assert.equal(reminderFor(relearn, 'rotate', ['R'], NOW), 'R');
  assert.equal(reminderFor(relearn, 'translate', ['M'], NOW), '', 'forgetting learned keys keeps silences');
});

test('damaged notebooks are repaired', () => {
  assert.deepEqual(normalizeNotebook(null), emptyNotebook());
  assert.deepEqual(normalizeNotebook({ version: 2, keys: { a: {} } }), emptyNotebook());
  const notebook = normalizeNotebook({ version: 1, keys: { a: { uses: -3, quietUntil: 'x', silenced: 'yes' }, b: null, ['x'.repeat(400)]: {} } });
  assert.deepEqual(notebook.keys, { a: { uses: 0, quietUntil: 0, silenced: false } });
  assert.equal(Object.getPrototypeOf(normalizeNotebook(JSON.parse('{"version":1,"keys":{"__proto__":{"silenced":true}}}')).keys), Object.prototype);
});

test('chords become key caps', () => {
  assert.deepEqual(keyCaps('Ctrl+Shift+K'), ['Ctrl', 'Shift', 'K']);
  assert.deepEqual(keyCaps('Ctrl++'), ['Ctrl', '+']);
  assert.deepEqual(keyCaps('+'), ['+']);
  assert.deepEqual(keyCaps('F1'), ['F1']);
  assert.deepEqual(keyCaps('Ctrl+Alt+Space > ABC'), ['Ctrl', 'Alt', 'Space > ABC']);
});

test('a key Citadel Paint ran is named the way its button shows it', () => {
  assert.equal(paintKeyLabel('b'), 'B');
  assert.equal(paintKeyLabel('f', { shift: true }), 'Shift+F');
  assert.equal(paintKeyLabel('s', { ctrl: true }), 'Ctrl+S');
  assert.equal(paintKeyLabel('c', { alt: true }), 'Alt+C');
  assert.equal(paintKeyLabel('enter', { ctrl: true }), 'Ctrl+↵');
  assert.equal(paintKeyLabel('['), '[ ]'); assert.equal(paintKeyLabel(']'), '[ ]');
  assert.equal(paintKeyLabel('{', { shift: true }), 'Shift+[ ]');
  assert.equal(paintKeyLabel(','), ', .'); assert.equal(paintKeyLabel('.'), ', .');
  assert.equal(paintKeyLabel('-'), '− +'); assert.equal(paintKeyLabel('+', { shift: true }), '− +');
  assert.equal(paintKeyLabel('?', { shift: true }), '?');
  assert.equal(paintKeyLabel('home'), 'Home'); assert.equal(paintKeyLabel('f6'), 'F6'); assert.equal(paintKeyLabel('4'), '4');
});


test('learned shortcuts stay quiet from their last use, including after a break and reload', () => {
  let notebook = emptyNotebook();
  for (let use = 0; use < 5; use++) notebook = recordKeyUse(notebook, 'translate', { now: NOW });
  const original = notebook;
  notebook = recordKeyUse(notebook, 'translate', { now: NOW + 23 * HOUR });
  assert.equal(original.keys.translate.quietUntil, NOW + 24 * HOUR, 'does not mutate the saved record');
  assert.equal(reminderFor(notebook, 'translate', ['M'], NOW + 25 * HOUR), '', 'daily use stays quiet');
  assert.equal(reminderFor(notebook, 'translate', ['M'], NOW + 47 * HOUR), 'M', 'returns after a full quiet period without use');
  notebook = recordKeyUse(normalizeNotebook(notebook), 'translate', { now: NOW + 50 * HOUR });
  assert.equal(notebook.keys.translate.quietUntil, NOW + 74 * HOUR, 'one remembered shortcut use renews it after a break');
  notebook = recordKeyUse(clearLearned(notebook), 'translate', { now: NOW + 51 * HOUR });
  assert.equal(reminderFor(notebook, 'translate', ['M'], NOW + 51 * HOUR), 'M', 'bring back learned keys resets learning');
});
