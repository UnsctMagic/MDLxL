import { allocateGroup } from './hotkey-allocation.js';

/** Leader sequences extend Hotkeys without taking any original MDLVis key. */
export const HOTKEY_LEADER = 'Ctrl+Alt+Space';
const leaderPart = value => ({ control: 'ctrl', option: 'alt', spacebar: 'space', ' ': 'space' })[value] || value;
export function normalizeHotkeySequence(value) {
  if (typeof value !== 'string' || value.length > 100) return '';
  const parts = value.split('>');
  if (parts.length !== 2) return '';
  const leader = parts[0].trim().toLowerCase().split('+').map(part => leaderPart(part.trim())).sort().join('+');
  const code = parts[1].trim().toUpperCase();
  return leader === 'alt+ctrl+space' && /^[A-Z0-9]{3}$/.test(code) ? `${HOTKEY_LEADER} > ${code}` : '';
}
export const hotkeyCode = value => normalizeHotkeySequence(value).split(' > ')[1] || '';
export const hotkeySequence = code => normalizeHotkeySequence(`${HOTKEY_LEADER} > ${code}`);

/** Every command has its own one- or two-key default (src/commands.js); none gets a generated code. */
export function coreHotkeyDefaults(actions) {
  return actions.map(action => ({ ...action, defaultKeys: [...(action.defaultKeys || [])] }));
}


/**
 * Up to 0.24.0 the Hotkeys feature was internally named "WarmKeys", and the
 * ID segment "warmkeys" (Settings tab, search box, dialog "Hotkeys" buttons,
 * the Keyboard Shortcuts command) is stored in saved custom assignments, the
 * discovered-control catalog and add-on manifests. These helpers carry those
 * saved IDs over one way; nothing writes the old segment any more.
 */
const LEGACY_HOTKEY_SEGMENT = 'warmkeys', HOTKEY_SEGMENT = 'hotkeys';
const swapSegment = (id, from, to) => typeof id === 'string' && id.split(':').includes(from) ? id.split(':').map(part => part === from ? to : part).join(':') : id;
export const migrateHotkeyId = id => swapSegment(swapSegment(id, LEGACY_HOTKEY_SEGMENT, HOTKEY_SEGMENT), 'shredder', 'learn');
/** Saved assignments under a pre-rename ID keep their meaning; an assignment already saved under the new ID wins. */
export function migrateHotkeyBindings(hotkeys) {
  if (!hotkeys || typeof hotkeys !== 'object' || Array.isArray(hotkeys)) return hotkeys;
  if (!Object.keys(hotkeys).some(id => migrateHotkeyId(id) !== id)) return hotkeys;
  const result = {};
  for (const [id, keys] of Object.entries(hotkeys)) {
    const next = migrateHotkeyId(id);
    // defineProperty keeps a stray "__proto__" entry an ordinary key for later validation.
    if (next === id || !Object.hasOwn(hotkeys, next)) Object.defineProperty(result, next, { value: keys, enumerable: true, writable: true, configurable: true });
  }
  return result;
}
export const LEGACY_HOTKEY_CATALOG_STORAGE_KEY = 'mdlvis-classic-warmkeys-catalog-v1';
/** Keys the original MDLVis leaves free in the editor, and keys Windows or the menus own. */
export const EDITOR_RESERVED = Object.freeze(['H', 'K', 'Ctrl+X', 'Ctrl+B', 'Ctrl+W', 'Ctrl+Q', 'Alt+F4', 'Alt+F', 'Alt+E', 'F10']);

/**
 * On-screen controls get a short key from their name, chosen within their own window
 * (`group`; see src/hotkey-allocation.js). A key, once given, is kept (`defaultKey` is saved
 * with the discovered controls), so new controls never move an existing shortcut. Windows
 * that show the editor's own tools (`embedsEditor`) and the editor itself avoid every
 * command key; other windows only avoid commands that also work there. Generated
 * Ctrl+Alt+Space codes are no longer handed out; codes the user typed in still work.
 */
export function contextualHotkeyDefaults(actions, reservedKeys = []) {
  const commands = actions.filter(action => !action.contextual), direct = key => typeof key === 'string' && key && !hotkeyCode(key);
  const commandKeys = commands.flatMap(action => action.defaultKeys || []).filter(direct);
  const everywhere = commands.filter(action => action.scope === 'global' || action.allowInModal).flatMap(action => action.defaultKeys || []).filter(direct);
  const custom = reservedKeys.filter(direct), groups = new Map(), assigned = new Map(), keysOf = new Map();
  for (const action of actions) if (action.contextual && typeof action.group === 'string' && action.group) (groups.get(action.group) || groups.set(action.group, []).get(action.group)).push(action);
  // The editor first, then each window, then the pages inside a window (which also avoid their window's keys).
  const order = [...groups.keys()].sort((a, b) => (b === 'editor') - (a === 'editor') || !!groups.get(a)[0].parentGroup - !!groups.get(b)[0].parentGroup);
  for (const group of order) {
    const members = groups.get(group), editor = group === 'editor', embedsEditor = !editor && members.some(action => action.embedsEditor);
    const parent = members.find(action => action.parentGroup)?.parentGroup;
    const taken = new Set([...custom, ...everywhere, ...(editor || embedsEditor ? [...commandKeys, ...EDITOR_RESERVED] : []), ...(embedsEditor ? keysOf.get('editor') || [] : []), ...(parent ? keysOf.get(parent) || [] : [])]), fresh = [];
    for (const action of members) {
      if (direct(action.defaultKey) && !taken.has(action.defaultKey)) { taken.add(action.defaultKey); assigned.set(action.id, action.defaultKey); } else fresh.push(action);
    }
    for (const [id, key] of allocateGroup(fresh, taken, { editor, wide: editor || embedsEditor })) assigned.set(id, key);
    keysOf.set(group, members.map(action => assigned.get(action.id)).filter(Boolean));
  }
  return actions.map(action => {
    if (!action.contextual) return action;
    const key = assigned.get(action.id) || '';
    return { ...action, defaultCode: undefined, defaultKey: key, defaultKeys: key ? [key] : [] };
  });
}

const isLeader = event => event.ctrlKey && event.altKey && !event.shiftKey && !event.metaKey && (event.key === ' ' || event.key === 'Space' || event.code === 'Space');
const modifierKey = key => ['Control', 'Alt', 'Shift', 'Meta', 'AltGraph'].includes(key);
function letterFromEvent(event) {
  if (typeof event.key === 'string' && /^[a-z0-9]$/i.test(event.key)) return event.key.toUpperCase();
  const code = /^(?:Key([A-Z])|Digit([0-9])|Numpad([0-9]))$/.exec(event.code || '');
  return code ? code[1] || code[2] || code[3] : '';
}

/** DOM-free keyboard state machine shared by dispatch and the Settings recorder. */
export class HotkeySequence {
  constructor({ timeoutMs = 4000 } = {}) { this.timeoutMs = timeoutMs; this.cancel(); }
  cancel() { this.active = false; this.code = ''; this.expiresAt = 0; }
  expire(now = Date.now()) { if (!this.active || now < this.expiresAt) return false; this.cancel(); return true; }
  feed(event, now = Date.now()) {
    const expired = this.expire(now);
    const result = (consume = false, extra = {}) => ({ consume, pending: this.active, code: this.code, chord: '', cancelled: expired, ...extra });
    if (!event) return result();
    if (event.isComposing || event.keyCode === 229 || event.getModifierState?.('AltGraph')) { const active = this.active; this.cancel(); return result(false, { cancelled: active || expired }); }
    if (event.repeat) return result(this.active);
    if (isLeader(event)) { this.active = true; this.code = ''; this.expiresAt = now + this.timeoutMs; return result(true); }
    if (!this.active) return result();
    if (event.key === 'Escape') { this.cancel(); return result(true, { cancelled: true }); }
    if (modifierKey(event.key)) return result(true);
    if (event.key === 'Backspace') { this.code = this.code.slice(0, -1); this.expiresAt = now + this.timeoutMs; return result(true); }
    const letter = letterFromEvent(event);
    if (!letter || event.metaKey) { this.cancel(); return result(true, { cancelled: true }); }
    this.code += letter; this.expiresAt = now + this.timeoutMs;
    if (this.code.length < 3) return result(true);
    const code = this.code, chord = hotkeySequence(code);
    this.cancel(); return result(true, { code, chord });
  }
}
