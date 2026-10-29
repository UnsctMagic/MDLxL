/**
 * Default keys for on-screen controls: one key, or a modifier and one key, never more.
 * Each window (its "group") has its own keys, picked from the control's name, so the
 * same key can mean different things in the Material Manager and in Settings. Only the
 * window on screen reacts (see runShortcut in app/Hotkeys.jsx). DOM-free.
 */

/** Controls that exist once per item (each geoset row, each list entry) get no key. */
const PER_ITEM = /(^|:)(item|geoset|restore|key):[^:]*$/;
export const perItemControl = id => PER_ITEM.test(id);

/** Keys that keep their usual meaning in every window. */
const DIALOG_KEEP = ['Enter', 'Space', 'Tab', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'];
const STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'to', 'for', 'in', 'on', 'with', 'this', 'from', 'by', 'as', 'at', 'is', 'focus', 'toggle', 'choose', 'expand', 'collapse', 'configure', 'select']);
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), DIGITS = '1234567890'.split('');
const unique = list => [...new Set(list)];

/** The words a control is known by: its label, or for a bare "X" field its section too ("Rotate X"). */
export function allocationWords(id, label = '') {
  let text = String(label).replace(/Ctrl\+Alt\+Space\s*>\s*\w+/g, '').trim();
  const parts = String(id).split(':');
  if (text.replace(/[^a-z0-9]/gi, '').length <= 2) text = `${parts.at(-3) || ''} ${parts.at(-1) || text}`;
  return text.split(/[^A-Za-z0-9]+/).filter(word => word && !STOP_WORDS.has(word.toLowerCase()));
}

const F_KEYS = ['F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F11', 'F12'];
/**
 * Keys to try, best first: initials, the other letters of its name, then any letter, then digits;
 * each alone before Shift+. The main editor is crowded with commands, so it also tries Alt+ and
 * Ctrl+ and the F keys. Alt+F and Alt+E open the File and Edit menus.
 */
export function keyCandidates(words, { editor = false } = {}) {
  const initials = words.map(word => word[0].toUpperCase()).filter(key => /[A-Z0-9]/.test(key));
  const letters = words.join('').toUpperCase().split('').filter(key => /[A-Z]/.test(key));
  const named = unique([...initials, ...letters]), others = [...LETTERS, ...DIGITS].filter(key => !named.includes(key));
  const keys = [...named, ...named.map(key => 'Shift+' + key), ...others, ...others.map(key => 'Shift+' + key)];
  if (!editor) return keys;
  const extra = [...named, ...others, ...F_KEYS];
  return [...keys, ...['Alt+', 'Ctrl+'].flatMap(modifier => extra.map(key => modifier + key)), ...F_KEYS, ...F_KEYS.map(key => 'Shift+' + key)].filter(key => !['Alt+F', 'Alt+E'].includes(key));
}

/** How a control is used, best first: buttons get the best keys, then tabs, switches, lists, fields, and sections. */
export const CONTROL_KINDS = Object.freeze(['action', 'tab', 'toggle', 'choice', 'field', 'expand']);
export function controlKind(element) {
  const role = element.getAttribute('role') || '', type = (element.getAttribute('type') || '').toLowerCase(), tag = element.tagName;
  if (role === 'tab') return 'tab';
  if (tag === 'SELECT') return 'choice';
  if (tag === 'TEXTAREA' || tag === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(type)) return 'field';
  if (tag === 'INPUT' || ['radio', 'switch', 'checkbox', 'menuitemcheckbox'].includes(role) || element.hasAttribute('aria-pressed') || element.hasAttribute('aria-checked')) return 'toggle';
  if (/(^|:)expand$/.test(element.getAttribute('data-hotkey') || '')) return 'expand';
  return 'action';
}
/** A window's close button gets Esc; other Close / Cancel / Done buttons in it need no key of their own. */
export const isCloseControl = (id, label = '') => /(^|:)close$/.test(id) || /^(close|cancel|done)\b/i.test(String(label).replace(/Ctrl\+Alt\+Space\s*>\s*\w+/g, '').trim());

/**
 * Keys for new controls of one window. `taken` holds the keys already used there (by
 * earlier controls, user assignments or commands that also work in it). `wide` also tries
 * Alt+, Ctrl+ and F keys, for crowded windows. Returns id → key;
 * a control that finds no free key is left out.
 */
export function allocateGroup(controls, taken = [], { editor = false, wide = editor, bindings = {} } = {}) {
  const used = new Set([...taken, ...(editor ? [] : DIALOG_KEEP)]), result = new Map();
  const order = [...controls].sort((a, b) => Number(isCloseControl(b.id, b.label)) - Number(isCloseControl(a.id, a.label)) || Number(!!(b.bindingCommand || b.keys)) - Number(!!(a.bindingCommand || a.keys)) || CONTROL_KINDS.indexOf(a.kind || 'action') - CONTROL_KINDS.indexOf(b.kind || 'action'));
  for (const control of order) {
    if (perItemControl(control.id)) continue;
    if (isCloseControl(control.id, control.label)) {
      if (!editor && !used.has('Escape')) { used.add('Escape'); result.set(control.id, 'Escape'); }
      continue;
    }
    if (control.bindingCommand || control.keys) {
      const keys = control.bindingCommand ? bindings[control.bindingCommand] || [] : control.keys;
      for (const key of keys) used.add(key);
      result.set(control.id, keys);
      continue;
    }
    const key = keyCandidates(allocationWords(control.id, control.label), { editor: wide }).find(candidate => !used.has(candidate));
    if (key) { used.add(key); result.set(control.id, key); }
  }
  return result;
}
