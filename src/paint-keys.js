/**
 * Citadel Paint's key captions and its cut-out key table, following the user's bindings.
 * With default bindings every caption is the literal text the UI was written with. DOM-free.
 */
import { formatChord, normalizeChord } from './preferences.js';
import { PAINT_KEY_PREFIX } from './learn-keycaps.js';

const defaultChord = key => key === 'Shift+[' ? 'Shift+{' : key === 'Shift+]' ? 'Shift+}' : normalizeChord(key.replace('↵', 'Enter'));
const COMPOSITES = Object.freeze({ '[ ]': ['[', ']'], '− +': ['-', '='], ', .': [',', '.'], 'Shift+[ ]': ['Shift+[', 'Shift+]'] });
const GUIDE_ALIASES = Object.freeze({ '+': '=', 'Ctrl+Enter': 'Ctrl+↵' });

/** The user's key for a Paint action when it differs from the default; '' when it has none; null when unchanged or unknown. */
function reboundKey(key, shortcuts) {
  const keys = shortcuts?.[PAINT_KEY_PREFIX + key];
  if (!keys || keys[0] === defaultChord(key)) return null;
  return keys.length ? formatChord(keys[0]) : '';
}

/** The current key of one Paint action, for a sentence ("Smudge (N): ..."). */
export function paintKeyText(shortcuts, key) {
  return reboundKey(key, shortcuts) ?? key;
}

/** The caption of a composite key ("[ ]"), a Help row ("B / T / E") or any other literal. */
export function paintKeyCaption(text, shortcuts) {
  const label = String(text), pair = COMPOSITES[label];
  if (pair) {
    const keys = pair.map(key => reboundKey(key, shortcuts));
    if (keys.every(key => key === null)) return label;
    return keys.map((key, index) => key ?? formatChord(defaultChord(pair[index]))).filter(Boolean).join(' / ');
  }
  if (!label.includes(' / ') && !label.endsWith(' (hold)')) return label;
  return label.split(' / ').map(part => {
    const key = part.replace(/ \(hold\)$/, ''), rebound = reboundKey(GUIDE_ALIASES[key] || key, shortcuts);
    return rebound === null ? part : (rebound || '-') + part.slice(key.length);
  }).join(' / ');
}

export const PAINT_CUTOUT_SCOPE = 'paint-cutout';
export const paintCutoutActionId = name => `${PAINT_CUTOUT_SCOPE}:${name}`;
/** Every key of the cut-out window: [name, label, ...default keys]. */
export const PAINT_CUTOUT_KEYS = Object.freeze([
  ['crop', 'Cut-out: Crop', 'R'], ['lasso', 'Cut-out: Lasso', 'L'], ['polygon', 'Cut-out: Polygon', 'P'], ['wand', 'Cut-out: Magic wand', 'W'],
  ['all', 'Cut-out: Select all', 'A'], ['none', 'Cut-out: Select none', 'N'], ['invert', 'Cut-out: Invert selection', 'I'], ['operation', 'Cut-out: Next selection mode', 'O'],
  ['contiguous', 'Cut-out: Connected only', 'C'], ['feather', 'Cut-out: Feather', 'F'], ['tolerance', 'Cut-out: Tolerance', 'T'],
  ['zoomIn', 'Cut-out: Zoom in', '=', 'Plus', 'Shift+Plus'], ['zoomOut', 'Cut-out: Zoom out', '-'], ['zoomFit', 'Cut-out: Fit view', '0'],
  ['finish', 'Cut-out: Finish', 'Enter'], ['removePoint', 'Cut-out: Remove last point', 'Backspace'],
  ['use', 'Cut-out: Use cutout', 'Ctrl+Enter'], ['whole', 'Cut-out: Use whole texture', 'Ctrl+T'], ['save', 'Cut-out: Save texture', 'Ctrl+S'],
].map(row => Object.freeze(row)));
const CUTOUT_HINTS = Object.freeze({ R: 'crop', L: 'lasso', P: 'polygon', W: 'wand', O: 'operation', A: 'all', N: 'none', I: 'invert', T: 'tolerance', C: 'contiguous', F: 'feather', Enter: 'finish', 'Ctrl+Enter': 'use', 'Ctrl+T': 'whole', 'Ctrl+S': 'save', 'Ctrl+Z': 'undo', 'Ctrl+Y': 'redo' });
const CUTOUT_ZOOM_DEFAULT = '− + / 0';

/** A key hint of the cut-out window, written in the default key. */
export function paintCutoutCaption(hint, shortcuts) {
  const first = name => shortcuts?.[paintCutoutActionId(name)]?.[0];
  if (hint === CUTOUT_ZOOM_DEFAULT) {
    const [out, plus, fit] = ['zoomOut', 'zoomIn', 'zoomFit'].map(first);
    if (out === undefined || out === '-' && plus === '=' && fit === '0') return hint;
    return `${out ? formatChord(out) : ''} ${plus ? formatChord(plus) : ''} / ${fit ? formatChord(fit) : ''}`.trim();
  }
  const name = CUTOUT_HINTS[hint];
  if (!name) return hint;
  const keys = shortcuts?.[paintCutoutActionId(name)];
  return keys ? keys.map(formatChord).join(' / ') : hint;
}
