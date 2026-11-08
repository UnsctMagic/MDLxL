/**
 * Which modifier key means what during a mouse drag. DOM-free. `preferences.modifiers`
 * holds only the changes from this table, as meaning id -> 'Shift', 'Ctrl', 'Alt' or ''
 * (none). `press` meanings are read once when the mouse goes down, `live` ones on every
 * event of the drag.
 */
export const DEFAULT_MODIFIERS = Object.freeze({});
export const MODIFIER_VALUES = Object.freeze(['Shift', 'Ctrl', 'Alt', '']);
const meaning = (id, scope, scopeLabel, label, defaultValue, phase, tooltip) => Object.freeze({ id, scope, scopeLabel, label, defaultValue, phase, tooltip });
/** One line per meaning. Inside one `scope` a key has one meaning. */
export const MODIFIER_MEANINGS = Object.freeze([
  meaning('drag.move.axisLock', 'move', 'Move', 'Lock direction', 'Shift', 'live', 'Keeps a Move drag on one direction while held.'),
  meaning('drag.rotate.fine', 'rotate', 'Rotate', 'Fine control', 'Shift', 'live', 'Does what Shift while rotating is set to in Rotate settings: turns slower, or turns in 15 degree steps.'),
  meaning('drag.rotate.snap', 'rotate', 'Rotate', 'Snap to steps', 'Ctrl', 'live', 'Press it after the drag has started: the turn then moves in the Angle snap step from Rotate settings.'),
  meaning('drag.scale.planeLock', 'scale', 'Resize', 'Lock to workplane', 'Shift', 'live', 'Keeps a Resize drag flat on the workplane while held.'),
  meaning('drag.scale.spread', 'scale', 'Resize', 'Spread pieces', 'Ctrl', 'live', 'Vertices and Forge: moves separate pieces closer or apart and keeps their size.'),
  meaning('drag.scale.snap', 'scale-handle', 'Resize handle', 'Round to 5%', 'Shift', 'live', 'Bones and Movement: rounds the size set with an axis handle to 5% steps.'),
  meaning('drag.uv.fine', 'uv', 'UV Rotate and Zoom', 'Fine control', 'Shift', 'live', 'Slows a UV Wrapper Rotate or Zoom drag while held.'),
  meaning('drag.uv.pressFine', 'uv', 'UV Rotate and Zoom', 'Start fine', 'Alt', 'press', 'Held when the drag starts, the whole UV drag is slower.'),
  meaning('drag.uv.snap', 'uv', 'UV Rotate and Zoom', 'Snap to steps', 'Ctrl', 'live', 'Press it after the drag has started: the UV turn or size then moves in the snap step from UV settings.'),
  meaning('drag.uv.axisLock', 'uv-move', 'UV Move and Zoom', 'Lock direction', 'Shift', 'live', 'Keeps the UV drag on the axis chosen with the X and Y buttons while held.'),
  meaning('select.add', 'press', 'Selection', 'Add to selection', 'Shift', 'press', 'Held when you click or drag a selection, it adds to what is selected.'),
  meaning('select.remove', 'press', 'Selection', 'Remove from selection', 'Ctrl', 'press', 'Held when you click or drag a selection, it removes from what is selected. A click with it also picks a part to inspect.'),
  meaning('view.orbit', 'press', 'Camera', 'Rotate camera', 'Alt', 'press', 'Held when you press the left mouse button in a 3D view, the drag rotates the camera.'),
]);
const BY_ID = new Map(MODIFIER_MEANINGS.map(item => [item.id, item]));
const held = { Shift: event => !!event.shiftKey, Ctrl: event => !!(event.ctrlKey || event.metaKey), Alt: event => !!event.altKey };
const KEY_NAMES = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph']);
/** Whether a key event is one of the modifier keys themselves. */
export const isModifierKey = key => KEY_NAMES.has(key);

/** Keeps known meanings with a valid key that differs from the table. */
export function normalizeModifiers(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {}, result = {};
  for (const { id, defaultValue } of MODIFIER_MEANINGS) {
    if (Object.hasOwn(input, id) && MODIFIER_VALUES.includes(input[id]) && input[id] !== defaultValue) result[id] = input[id];
  }
  return result;
}
/** The key bound to a meaning now: Shift, Ctrl, Alt, or '' when it has none. */
export function modifierValue(id, preferences) {
  const bound = preferences?.modifiers?.[id];
  return MODIFIER_VALUES.includes(bound) ? bound : BY_ID.get(id)?.defaultValue ?? '';
}
/** Whether this mouse or key event has the key bound to a meaning held. */
export function modifierHeld(event, id, preferences) {
  return held[modifierValue(id, preferences)]?.(event) ?? false;
}
/** The key's name for tooltips; '' when the meaning has no key. */
export const modifierLabel = modifierValue;
/** A tooltip sentence with `{0}` as the key, or '' when the meaning has no key. */
export function modifierSentence(template, id, preferences) {
  const key = modifierLabel(id, preferences);
  return key ? template.replace('{0}', key) : '';
}
/** Selection flags as applySelection and movementNodeSelection read them. */
export const selectionKeys = (event, preferences) => ({ shift: modifierHeld(event, 'select.add', preferences), ctrl: modifierHeld(event, 'select.remove', preferences) });

// Each kind of drag reads two flags, named after their default keys so the drag math stays as it is.
const DRAG_KEYS = Object.freeze({
  translate: ['drag.move.axisLock'], move: ['drag.move.axisLock'],
  rotate: ['drag.rotate.fine', 'drag.rotate.snap'],
  scale: ['drag.scale.planeLock', 'drag.scale.spread'],
  'scale-handle': ['drag.scale.snap'],
});
/** `{ shiftKey, ctrlKey }` for one kind of 3D drag: true when that drag's first or second meaning is held. */
export function dragKeys(event, kind, preferences) {
  const [first, second] = DRAG_KEYS[kind] || [];
  return { shiftKey: !!first && modifierHeld(event, first, preferences), ctrlKey: !!second && modifierHeld(event, second, preferences) };
}

const inScope = (scope, modifiers) => MODIFIER_MEANINGS.filter(item => item.scope === scope).map(item => ({ item, key: modifierValue(item.id, { modifiers }) }));
const names = rivals => rivals.map(item => `${item.label} (${item.scopeLabel})`).join(', ');
/** Every key that has two meanings inside one scope, as `{ key, scope, ids, message }`. */
export function modifierConflicts(modifiers) {
  const current = normalizeModifiers(modifiers), scopes = [...new Set(MODIFIER_MEANINGS.map(item => item.scope))], conflicts = [];
  for (const scope of scopes) {
    const rows = inScope(scope, current);
    for (const key of [...new Set(rows.map(row => row.key))]) {
      const sharing = rows.filter(row => row.key === key).map(row => row.item);
      if (key && sharing.length > 1) conflicts.push({ key, scope, ids: sharing.map(item => item.id), message: `${key} is assigned to ${names(sharing)}. Choose a different key for one of them.` });
    }
  }
  return conflicts;
}
/**
 * Gives a meaning a key. A key already in use inside that scope is refused with a sentence
 * unless `replace`, which takes it from the others, as Replace does for shortcuts.
 * Returns `{ modifiers, applied, conflict }`; `modifiers` holds only changes.
 */
export function assignModifier(modifiers, id, value, { replace = false } = {}) {
  const current = normalizeModifiers(modifiers), target = BY_ID.get(id);
  if (!target || !MODIFIER_VALUES.includes(value)) return { modifiers: current, applied: false, conflict: '' };
  const rivals = value ? inScope(target.scope, current).filter(row => row.item.id !== id && row.key === value).map(row => row.item) : [];
  if (rivals.length && !replace) return { modifiers: current, applied: false, conflict: `${value} is assigned to ${names(rivals)}. Replace removes this key from those actions.` };
  const next = { ...current, [id]: value };
  for (const rival of rivals) next[rival.id] = '';
  return { modifiers: normalizeModifiers(next), applied: true, conflict: '' };
}
/**
 * The rows of the Hotkeys table's "Mouse drag keys" category. `row.change(value, { replace })`
 * saves through `commit(nextModifiers)` and returns the assignModifier result, so a refused
 * key leaves the setting alone and the page shows `conflict` with a Replace button.
 * `row.conflict` reports a clash already stored, for example from a hand-edited file.
 */
export function modifierRows(preferences, commit) {
  const current = normalizeModifiers(preferences?.modifiers), conflicts = modifierConflicts(current);
  return MODIFIER_MEANINGS.map(({ id, label, scope, scopeLabel, tooltip, defaultValue }) => ({
    id, label, scope, scopeLabel, tooltip, defaultValue,
    ariaLabel: `${label} key, ${scopeLabel}`,
    value: modifierValue(id, { modifiers: current }),
    allowed: MODIFIER_VALUES.map(value => ({ value, label: value || 'None' })),
    conflict: conflicts.find(item => item.ids.includes(id))?.message || '',
    change(value, options) {
      const result = assignModifier(current, id, value, options);
      if (result.applied) commit(result.modifiers);
      return result;
    },
  }));
}
