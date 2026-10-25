/**
 * Shredder: keycap shortcut reminders. When the user clicks a button (or menu entry)
 * whose command has a key, a small popup shows just that key. Using the key closes it.
 * DOM-free: every update returns a new notebook so callers can persist it.
 */
import { hotkeyCode } from './hotkey-defaults.js';

export const SHREDDER_STORAGE_KEY = 'mdlxl-shredder-keycaps-v1';
const HOUR = 60 * 60 * 1000, MAX_KEYS = 3000, MAX_ID = 300;

/** TEST VERSION: reminders are on by default. Switch to false before release. */
export const SHREDDER_TEST_VERSION = true;

export const SHREDDER_POSITIONS = Object.freeze(['control', 'bottom', 'top', 'bottom-right', 'bottom-left']);
export const SHREDDER_SIZES = Object.freeze(['small', 'medium', 'large']);
export const SHREDDER_STYLES = Object.freeze(['plain', 'flash']);
/** How long a popup stays, in seconds; 0 keeps it until the key is used or it is clicked. */
export const SHREDDER_DURATIONS = Object.freeze([3, 5, 10, 0]);
export const SHREDDER_LEARN_USES = Object.freeze([3, 5, 10]);
export const SHREDDER_QUIET_HOURS = Object.freeze([1, 8, 24, 72]);

export const DEFAULT_SHREDDER = Object.freeze({
  enabled: SHREDDER_TEST_VERSION, position: 'control', size: 'medium', style: 'plain', duration: 5, learnUses: 5, quietHours: 24,
});
const pick = (value, choices, fallback) => choices.includes(value) ? value : fallback;
/** Settings from preferences; the older Shredder kept only an on/off switch. */
export function normalizeShredder(input) {
  const value = typeof input === 'boolean' ? { enabled: input } : input && typeof input === 'object' ? input : {};
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_SHREDDER.enabled,
    position: pick(value.position, SHREDDER_POSITIONS, DEFAULT_SHREDDER.position),
    size: pick(value.size, SHREDDER_SIZES, DEFAULT_SHREDDER.size),
    style: pick(value.style, SHREDDER_STYLES, DEFAULT_SHREDDER.style),
    duration: pick(value.duration, SHREDDER_DURATIONS, DEFAULT_SHREDDER.duration),
    learnUses: pick(value.learnUses, SHREDDER_LEARN_USES, DEFAULT_SHREDDER.learnUses),
    quietHours: pick(value.quietHours, SHREDDER_QUIET_HOURS, DEFAULT_SHREDDER.quietHours),
  };
}

/** The first single-chord key bound to a command, or '' when it has only a Ctrl+Alt+Space code. */
export const directKey = keys => (keys || []).find(key => key && !hotkeyCode(key)) || '';

export const emptyNotebook = () => ({ version: 1, keys: {} });
const count = value => Number.isInteger(value) && value >= 0 ? value : 0;
const time = value => Number.isFinite(value) && value > 0 ? value : 0;
export function normalizeNotebook(input) {
  const notebook = emptyNotebook();
  if (!input || typeof input !== 'object' || input.version !== 1) return notebook;
  const keys = input.keys && typeof input.keys === 'object' && !Array.isArray(input.keys) ? input.keys : {};
  for (const [id, record] of Object.entries(keys).slice(-MAX_KEYS)) {
    if (id.length > MAX_ID || id === '__proto__' || !record || typeof record !== 'object') continue;
    notebook.keys[id] = { uses: count(record.uses), quietUntil: time(record.quietUntil), silenced: record.silenced === true };
  }
  return notebook;
}
const blank = () => ({ uses: 0, quietUntil: 0, silenced: false });
function change(notebook, id, update) {
  const keys = { ...notebook.keys, [id]: update({ ...(notebook.keys[id] || blank()) }) };
  const ids = Object.keys(keys);
  if (ids.length > MAX_KEYS) delete keys[ids[0]];
  return { ...notebook, keys };
}

/** One real use of a command's key. The `learnUses`-th use quiets that key for `quietHours`. */
export function recordKeyUse(notebook, id, { now, settings = DEFAULT_SHREDDER }) {
  return change(notebook, id, record => {
    if (record.quietUntil > now) return record;
    record.uses++;
    if (record.uses >= settings.learnUses) { record.uses = 0; record.quietUntil = now + settings.quietHours * HOUR; }
    return record;
  });
}
/** A click on the popup: no more reminders for this command until silences are cleared. */
export const silenceKey = (notebook, id) => change(notebook, id, record => ({ ...record, silenced: true }));
export function clearSilences(notebook) {
  return { ...notebook, keys: Object.fromEntries(Object.entries(notebook.keys).map(([id, record]) => [id, { ...record, silenced: false }])) };
}
export function clearLearned(notebook) {
  return { ...notebook, keys: Object.fromEntries(Object.entries(notebook.keys).map(([id, record]) => [id, { ...record, uses: 0, quietUntil: 0 }])) };
}
export function notebookCounts(notebook, now) {
  const records = Object.values(notebook.keys);
  return { silenced: records.filter(record => record.silenced).length, learned: records.filter(record => record.quietUntil > now).length };
}

/** Whether a click on a command with these keys gets a reminder, and the key it shows. */
export function reminderFor(notebook, id, keys, now) {
  const key = directKey(keys), record = notebook.keys[id];
  if (!key || record?.silenced || record?.quietUntil > now) return '';
  return key;
}

/** A chord as key cap labels: Ctrl+Shift+K becomes ['Ctrl', 'Shift', 'K']. */
export const keyCaps = chord => String(chord || '').split(/\+(?=.)/).filter(Boolean);
