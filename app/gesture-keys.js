import { isModifierKey } from '../src/modifier-bindings.js';

/**
 * While a mouse drag is live, only the modifier keys and Esc act: Delete, Ctrl+Z, a tool
 * key or an F-key must not change what the drag is working on. Each drag owner answers
 * the `mdlxl-window-key` claim with holdGestureKey at priority 0, before any window key.
 * Camera moves are not held: they change nothing a key can make stale.
 */
const NONE = Object.freeze([]);
/** Paint's brush size, opacity and stamp placement keys keep working during a stroke. */
export const PAINT_STROKE_KEYS = Object.freeze(['[', ']', '{', '}', '-', '=', '+', ',', '.', 'm']);

export const gestureBlocksKey = (key, allow = NONE) => key !== 'Escape' && !isModifierKey(key) && !allow.includes(key);

/**
 * True when this drag takes the key, so it does nothing else. `live` is read when the claim
 * runs. Marks `detail.gesture` so Hotkeys ignores an Alt tap during the drag. `element` (the
 * drag's canvas) leaves keys alone when it is hidden or a window on top of it has the focus.
 */
export function holdGestureKey(detail, element, live, allow = NONE) {
  if (!live()) return false;
  detail.gesture = true;
  const { event, localWindow } = detail;
  if (!gestureBlocksKey(event.key, allow)) return false;
  if (element && ((event.target?.ownerDocument || element.ownerDocument) !== element.ownerDocument || !element.getClientRects().length || localWindow && !localWindow.contains(element))) return false;
  return true;
}
