/** Physical QWERTY reach, independent of the active typing language. */
const positions = new Map();
for (const [row, keys, offset] of [[0, '1234567890-=', 0], [1, 'QWERTYUIOP[]', .25], [2, "ASDFGHJKL;'", .5], [3, 'ZXCVBNM,./', 1]]) {
  [...keys].forEach((key, index) => positions.set(key, [index + offset, row]));
}
for (const [key, point] of Object.entries({ Escape: [0, -1], Tab: [-.5, 1], Space: [4, 4], Enter: [11.5, 2], Backspace: [12, 0], Delete: [13, 1], Insert: [13, 0], Home: [14, 0], End: [14, 1], PageUp: [15, 0], PageDown: [15, 1], ArrowLeft: [13, 3], ArrowDown: [14, 3], ArrowRight: [15, 3], ArrowUp: [14, 2] })) positions.set(key, point);
const modifiers = { Ctrl: [[-.5, 4], [11, 4]], Shift: [[-.5, 3], [12, 3]], Alt: [[2.5, 4], [9, 4]], Meta: [[1, 4], [10, 4]] };

export function isEasyOneHandShortcut(chord) {
  if (typeof chord !== 'string' || !chord || chord.includes('>')) return false;
  const keys = chord.split('+');
  if (keys.length > 3 || new Set(keys).size !== keys.length) return false;
  if (keys.length === 1) return positions.has(keys[0]) || /^F(?:[1-9]|1\d|2[0-4])$/.test(keys[0]);
  const points = keys.filter(key => !modifiers[key]).map(key => positions.get(key));
  if (!points.length || points.some(point => !point)) return false;
  // Try either side's modifiers, keeping every key within a comfortable hand span.
  const held = keys.filter(key => modifiers[key]);
  return [0, 1].some(side => {
    const reach = [...points, ...held.map(key => modifiers[key][side])];
    return reach.every(a => reach.every(b => Math.hypot(a[0] - b[0], .75 * (a[1] - b[1])) <= 4.25));
  });
}

export function easyShortcutForAction(id, bindings) {
  return (bindings[id] || []).filter(isEasyOneHandShortcut)
    .filter(key => Object.entries(bindings).every(([other, keys]) => other === id || !keys.includes(key)))
    .sort((a, b) => a.split('+').length - b.split('+').length || a.length - b.length)[0] || '';
}

export const SHREDDER_TIMING = Object.freeze({ repetitionWindow: 45000, tipCooldown: 60000, tipDuration: 9000, tantrumDuration: 7000 });

/** Advice counts actual mouse uses, and only displayed advice can be ignored. */
export class ShredderCoach {
  constructor() { this.records = new Map(); this.lastSpeech = -Infinity; this.tantrumUsed = false; }
  use({ id, source, key, label }, now) {
    if (source === 'shortcut') { this.records.delete(id); return { kind: 'learned', id }; }
    if (source !== 'mouse' || !key) return null;
    let record = this.records.get(id);
    if (!record || record.key !== key) record = { count: 0, tips: 0, lastUse: now, key };
    if (now - record.lastUse > SHREDDER_TIMING.repetitionWindow) record.count = 0;
    record.lastUse = now; record.count++; this.records.set(id, record);
    if (record.count < 3 || now - this.lastSpeech < SHREDDER_TIMING.tipCooldown) return null;
    record.count = 0; this.lastSpeech = now;
    if (record.tips >= 3) {
      if (this.tantrumUsed) return null;
      this.tantrumUsed = true;
      return { kind: 'tantrum', id };
    }
    record.tips++;
    return { kind: 'tip', id, label, key, reminder: record.tips > 1 };
  }
}

/** The warning covers both entry directions, including imported preferences. */
export function shredderMordorWarning(current, next) {
  if (!next.shredderEnabled || next.language !== 'mordor' || current.shredderEnabled && current.language === 'mordor') return '';
  return current.language === 'mordor'
    ? 'Do not summon this beast into the lands of Mordor...'
    : 'Do not tempt Shredder with the powers of Mordor';
}
