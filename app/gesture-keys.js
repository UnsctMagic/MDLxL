import { chordFromEvent } from '../src/preferences.js';
import { isModifierKey } from '../src/modifier-bindings.js';
import { PAINT_KEY_PREFIX } from '../src/learn-keycaps.js';

/**
 * While a mouse drag is live, only the modifier keys and Esc act: Delete, Ctrl+Z, a tool
 * key or an F-key must not change what the drag is working on. Each drag owner answers
 * the `mdlxl-window-key` claim with holdGestureKey at priority 0, before any window key.
 * Camera moves are not held: they change nothing a key can make stale.
 */
const NONE = Object.freeze([]);
/** The Paint actions that keep working during a stroke: brush size, softness, opacity, stamp turn and mirror. */
export const PAINT_STROKE_ACTIONS = Object.freeze(['[', ']', 'Shift+[', 'Shift+]', '-', '=', ',', '.', 'M'].map(key => PAINT_KEY_PREFIX + key));

export const gestureBlocksKey = key => key !== 'Escape' && !isModifierKey(key);

/** A plain key bound right now to one of `actions`. Anything held with Ctrl, Alt or Meta is a command, so it waits. */
function actionKeepsWorking(event, actions, shortcuts) {
  if (!actions.length || event.ctrlKey || event.altKey || event.metaKey) return false;
  const chord = chordFromEvent(event);
  return !!chord && actions.some(id => shortcuts?.[id]?.includes(chord));
}

/**
 * Which windows are holding a mouse press. A drag can end without its pointerup reaching
 * anyone: the window loses focus, the captured element goes away. Owners end their drag
 * when told through onMousePressLost, and the key guard asks here before it holds a key,
 * so a drag that ended can never leave the keyboard dead.
 */
const watched = new Map(), lostListeners = new Set();
function endPress(record) {
  if (!record.press) return;
  record.press = null;
  for (const listener of [...lostListeners]) listener();
}
/** Starts watching one window; returns the function that stops. Several callers may share a window. */
export function watchMousePress(view) {
  let record = watched.get(view);
  if (!record) {
    const created = { press: null, users: 0 };
    const pressed = event => { created.press = { id: event.pointerId, capture: null }; };
    const released = event => { if (created.press?.id === event.pointerId) created.press = null; };
    const moved = event => { if (created.press?.id === event.pointerId && event.pointerType === 'mouse' && event.buttons === 0) endPress(created); };
    const captured = event => { if (created.press?.id === event.pointerId) created.press.capture = event.target; };
    const lostCapture = event => { if (created.press?.id === event.pointerId) endPress(created); };
    const blurred = () => endPress(created);
    const listeners = [['pointerdown', pressed], ['pointerup', released], ['pointercancel', released], ['pointermove', moved], ['gotpointercapture', captured], ['lostpointercapture', lostCapture]];
    for (const [type, listener] of listeners) view.addEventListener(type, listener, true);
    // Not captured: focus leaving an element inside the window is not the window losing focus.
    view.addEventListener('blur', blurred);
    created.unwatch = () => { for (const [type, listener] of listeners) view.removeEventListener(type, listener, true); view.removeEventListener('blur', blurred); };
    watched.set(view, created); record = created;
  }
  record.users += 1;
  return () => { if (--record.users === 0) { record.unwatch(); watched.delete(view); } };
}
/** Calls `listener` when a press ends with no pointerup. Returns the function that stops. */
export function onMousePressLost(listener) {
  lostListeners.add(listener);
  return () => lostListeners.delete(listener);
}
/** False when the window has no press left to hold keys for. A window nobody watches counts as held. */
function pressHeld(view) {
  const record = watched.get(view);
  if (!record) return true;
  const press = record.press;
  if (press?.capture && !press.capture.hasPointerCapture?.(press.id)) { endPress(record); return false; }
  return !!press;
}

/**
 * True when this drag takes the key, so it does nothing else. `live` is read when the claim
 * runs. Marks `detail.gesture` so Hotkeys ignores an Alt tap during the drag. `element` (the
 * drag's canvas) leaves keys alone when it is hidden or a window on top of it has the focus.
 * `actions` are the hotkey actions that keep working during this drag, by their current keys.
 */
export function holdGestureKey(detail, element, live, actions = NONE) {
  const { event, localWindow, shortcuts } = detail;
  if (!live() || !pressHeld(event.view)) return false;
  detail.gesture = true;
  if (!gestureBlocksKey(event.key) || actionKeepsWorking(event, actions, shortcuts)) return false;
  if (element && ((event.target?.ownerDocument || element.ownerDocument) !== element.ownerDocument || !element.getClientRects().length || localWindow && !localWindow.contains(element))) return false;
  return true;
}
