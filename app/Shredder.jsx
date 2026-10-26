import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useHotkeys, controlActionId } from './Hotkeys.jsx';
import { formatChord } from '../src/preferences.js';
import { translate } from '../src/localization.js';
import { SHREDDER_STORAGE_KEY, PAINT_KEY_PREFIX, emptyNotebook, normalizeNotebook, recordKeyUse, reminderFor, reminderPosition, keyCaps } from '../src/shredder-keycaps.js';
import { isCloseControl } from '../src/hotkey-allocation.js';
import './shredder.css';

const CHANGED = 'mdlxl-shredder-notebook';
export function loadShredderNotebook() { try { return normalizeNotebook(JSON.parse(localStorage.getItem(SHREDDER_STORAGE_KEY) || 'null')); } catch { return emptyNotebook(); } }
function storeNotebook(notebook) { try { localStorage.setItem(SHREDDER_STORAGE_KEY, JSON.stringify(notebook)); } catch { /* Forgotten after this session when storage is unavailable. */ } }
/** Settings changes the notebook (clear silences, forget learned keys); the running reminders reload it. */
export function updateShredderNotebook(update) {
  const next = update(loadShredderNotebook());
  storeNotebook(next); window.dispatchEvent(new CustomEvent(CHANGED));
  return next;
}

const CONTROLS = 'button, [role="button"], [role="tab"], [role="radio"], [role="menuitem"], input[type="checkbox"], input[type="radio"]';
const OWN_UI = '.shredder-keycap';
const GAP = 8;
const PLACEMENT_CONTROLS = 'button, input, select, textarea, a[href], label, [role="button"], [role="tab"], [role="radio"], [role="menuitem"]';

/**
 * Shredder: when the user clicks something that has a key, a keycap popup shows that key.
 * Using the key closes it; using it `learnUses` times quiets that key for a while; clicking
 * the popup dismisses only this reminder. Rules live in src/shredder-keycaps.js.
 */
export default function Shredder({ settings }) {
  const { shortcuts } = useHotkeys();
  const [popup, setPopup] = useState(null);
  const notebook = useRef(null), latest = useRef({}), box = useRef(null);
  latest.current = { settings, shortcuts, popup };
  const enabled = !!settings?.enabled;

  useEffect(() => {
    setPopup(null);
    if (!enabled) return;
    notebook.current = loadShredderNotebook();
    const counted = new WeakSet();
    let serial = 0;
    const save = next => { notebook.current = next; storeNotebook(next); };
    /** Citadel Paint's keys are its own (`data-paint-key`); everything else uses the shortcut settings. */
    const keysOf = id => id.startsWith(PAINT_KEY_PREFIX) ? [id.slice(PAINT_KEY_PREFIX.length)] : latest.current.shortcuts[id];
    const show = (id, element) => {
      // A window's extra Close / Cancel / Done buttons close it like its own close button: with Esc,
      // when Esc closes that window (in Forge it clears the selection).
      const label = element?.getAttribute('aria-label') || element?.textContent || '', keys = keysOf(id);
      const closer = !keys?.length && isCloseControl(id, label) && [...(element?.closest('[role="dialog"]')?.querySelectorAll('[data-hotkey-shortcuts="Escape"]') || [])]
        .some(other => isCloseControl(controlActionId(other), other.getAttribute('aria-label') || other.textContent || ''));
      const key = reminderFor(notebook.current, id, closer ? ['Escape'] : keys, Date.now());
      if (!key) return;
      const rect = element?.getBoundingClientRect?.();
      const next = { id, chord: id.startsWith(PAINT_KEY_PREFIX) ? key : formatChord(key), rect: rect && rect.width + rect.height > 0 ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null, serial: ++serial };
      // Repeated clicks leave the same popup, animation and original expiry alone.
      setPopup(current => current?.id === id && current.chord === next.chord ? current : next);
    };
    const click = event => {
      // A real mouse click has a click count; hotkeys and Enter/Space presses do not.
      if (!event.isTrusted || event.detail === 0) return;
      if (event.target.closest?.(OWN_UI)) return;
      const paintKey = event.target.closest?.('[data-paint-key]');
      if (paintKey) { show(PAINT_KEY_PREFIX + paintKey.getAttribute('data-paint-key'), paintKey); return; }
      const element = event.target.closest?.('[data-hotkey]');
      if (!element || !element.matches(CONTROLS)) return;
      const id = controlActionId(element);
      if (id) show(id, element);
    };
    const menu = event => { if (typeof event.detail?.id === 'string') show(event.detail.id, null); };
    const used = event => {
      const { id, chord, event: source } = event.detail || {};
      if (typeof id !== 'string') return;
      // Pressing the key a popup shows closes it, even when another button owns that key (Esc).
      const current = latest.current.popup;
      if (current && (current.id === id || chord && current.chord === formatChord(chord))) setPopup(null);
      // One key press counts once, and holding a key down is not five uses.
      if (source && typeof source === 'object') { if (counted.has(source) || source.repeat) return; counted.add(source); }
      save(recordKeyUse(notebook.current, id, { now: Date.now(), settings: latest.current.settings }));
    };
    const changed = () => {
      notebook.current = loadShredderNotebook();
      const current = latest.current.popup;
      if (current && !reminderFor(notebook.current, current.id, keysOf(current.id), Date.now())) setPopup(null);
    };
    window.addEventListener('click', click, true); window.addEventListener('mdlxl-menu-command', menu);
    window.addEventListener('mdlxl-hotkey-used', used); window.addEventListener(CHANGED, changed);
    return () => {
      window.removeEventListener('click', click, true); window.removeEventListener('mdlxl-menu-command', menu);
      window.removeEventListener('mdlxl-hotkey-used', used); window.removeEventListener(CHANGED, changed);
    };
  }, [enabled]);

  useEffect(() => {
    if (!popup || !settings?.duration) return;
    const timer = setTimeout(() => setPopup(current => current?.serial === popup.serial ? null : current), settings.duration * 1000);
    return () => clearTimeout(timer);
  }, [popup?.serial, settings?.duration]);

  const anchored = popup?.rect && settings.position === 'control';
  useLayoutEffect(() => {
    const element = box.current;
    if (!element || !popup) return;
    const place = () => {
      const width = element.offsetWidth, height = element.offsetHeight;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const position = anchored ? 'control' : settings.position === 'control' ? 'bottom' : settings.position;
      const preferred = position === 'control'
        ? { left: popup.rect.left + (popup.rect.width - width) / 2, top: popup.rect.top - GAP - height }
        : { left: position === 'bottom-left' ? 22 : position === 'bottom-right' ? viewport.width - width - 22 : (viewport.width - width) / 2,
          top: position === 'top' ? 70 : viewport.height - height - (position === 'bottom' ? 70 : 66) };
      const obstacles = [...document.querySelectorAll(PLACEMENT_CONTROLS)].filter(control => !control.closest(OWN_UI) && control.checkVisibility({ checkVisibilityCSS: true }))
        .flatMap(control => [...control.getClientRects()]).filter(rect => rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < viewport.height && rect.left < viewport.width);
      const point = reminderPosition(preferred, { width, height }, viewport, obstacles);
      // A completely packed window must still leave its controls usable.
      element.style.visibility = point ? '' : 'hidden';
      if (point) { element.style.left = point.left + 'px'; element.style.top = point.top + 'px'; }
    };
    place();
    // Recheck after dialogs open or close, or the user scrolls/resizes; no polling.
    const observer = new MutationObserver(place);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [popup?.serial, anchored, settings?.size, settings?.position]);

  if (!enabled || !popup) return null;
  const dismiss = event => { event.stopPropagation(); setPopup(null); };
  // A plain element, like the K.E.Y. overlay, so the app's button styles leave its look alone.
  return <div ref={box} key={popup.serial} role="button" className="shredder-keycap" data-position={anchored ? 'control' : settings.position === 'control' ? 'bottom' : settings.position}
    data-size={settings.size} data-style={settings.style} aria-label={popup.chord} title="Click to dismiss this reminder."
    onPointerDown={event => { event.preventDefault(); event.stopPropagation(); }} onClick={dismiss}>
    {keyCaps(popup.chord).map((part, index) => <React.Fragment key={index}>{index > 0 && ' + '}<kbd translate="no">{translate(part)}</kbd></React.Fragment>)}
  </div>;
}
