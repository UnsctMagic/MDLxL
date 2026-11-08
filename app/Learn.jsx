import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHotkeys, controlActionId } from './Hotkeys.jsx';
import { formatChord } from '../src/preferences.js';
import { translate } from '../src/localization.js';
import { LEARN_STORAGE_KEY, PAINT_KEY_PREFIX, emptyNotebook, readLearnNotebook, recordKeyUse, silenceKey, reminderFor, keyCaps, forgetRebound, learnBindings, reboundDragKeys } from '../src/learn-keycaps.js';
import { usePreferencesContext } from './PreferencesContext.jsx';
import { paintKeyCaption } from '../src/paint-keys.js';
import { isCloseControl } from '../src/hotkey-allocation.js';
import './learn.css';

const CHANGED = 'mdlxl-learn-notebook';
// Keep the session's learned and muted keys if browser storage stops working.
let sessionNotebook = emptyNotebook(), storageUnavailable = false;
export function loadLearnNotebook() {
  if (!storageUnavailable) {
    try { sessionNotebook = readLearnNotebook(localStorage); }
    catch { storageUnavailable = true; }
  }
  return sessionNotebook;
}
function storeNotebook(notebook) {
  sessionNotebook = notebook;
  try { localStorage.setItem(LEARN_STORAGE_KEY, JSON.stringify(notebook)); }
  catch { storageUnavailable = true; /* Kept for this session only. */ }
}
/** Settings changes the notebook (clear silences, forget learned keys); the running reminders reload it. */
export function updateLearnNotebook(update) {
  const next = update(loadLearnNotebook());
  storeNotebook(next); window.dispatchEvent(new CustomEvent(CHANGED));
  return next;
}

const CONTROLS = 'button, summary, [role="button"], [role="tab"], [role="radio"], [role="menuitem"], input[type="checkbox"], input[type="radio"]';
const OWN_UI = '.learn-keycap';
const GAP = 8, EDGE = 6;
/** The keys that close the window this control is in, from its own close control. */
const windowCloseKeys = element => {
  const close = [...(element?.closest('[role="dialog"]')?.querySelectorAll('[data-hotkey-shortcuts]') || [])].find(other => other.getAttribute('data-hotkey-shortcuts') && isCloseControl(controlActionId(other), other.getAttribute('aria-label') || other.textContent || ''));
  return close ? close.getAttribute('data-hotkey-shortcuts').split(' / ') : null;
};

/**
 * Learn: when the user clicks something that has a key, a keycap popup shows that key.
 * Using the key closes it; using it `learnUses` times quiets that key for a while; clicking
 * the popup dismisses only this reminder. Rules live in src/learn-keycaps.js.
 */
export default function Learn({ settings }) {
  const { catalog, shortcuts } = useHotkeys(), { preferences } = usePreferencesContext();
  const [popup, setPopup] = useState(null);
  const notebook = useRef(null), latest = useRef({}), box = useRef(null), bound = useRef(null);
  latest.current = { settings, catalog, shortcuts, popup };
  const enabled = !!settings?.enabled;

  // A rebound command or drag key is a new key to learn, whether or not Learn is on right now.
  useEffect(() => {
    const before = bound.current, now = learnBindings(shortcuts, preferences); bound.current = now;
    if (!before) return;
    const current = loadLearnNotebook(), next = forgetRebound(current, before, now, id => latest.current.catalog.find(action => action.id === id)?.learnGroup || id);
    if (next !== current) updateLearnNotebook(() => next);
  }, [shortcuts, preferences?.modifiers]);

  useEffect(() => {
    setPopup(null);
    if (!enabled) return;
    notebook.current = loadLearnNotebook();
    const counted = new WeakSet();
    let serial = 0, clickTimer;
    const save = next => { notebook.current = next; storeNotebook(next); };
    /** Citadel Paint's keys are its own (`data-paint-key`); everything else uses the shortcut settings. */
    const keysOf = id => latest.current.shortcuts[id] || (id.startsWith(PAINT_KEY_PREFIX) ? [paintKeyCaption(id.slice(PAINT_KEY_PREFIX.length), latest.current.shortcuts)] : undefined);
    const show = (id, element, afterClick = false) => {
      // A window's extra Close / Cancel / Done buttons close it like its own close button: with the
      // key that closes that window, if one does (in Forge Esc clears the selection).
      // Only hand-picked keys are taught: a window's own buttons get keys from their names
      // (Settings' file icons), which are for working that window, not for learning, unless
      // the user chose that key.
      const handPicked = action => !action.contextual || action.bindingCommand || action.keys || action.manual || String(latest.current.shortcuts[action.id]) !== String(action.defaultKeys || []);
      const command = id.startsWith(PAINT_KEY_PREFIX) || latest.current.catalog.some(action => action.id === id && handPicked(action));
      const label = element?.getAttribute('aria-label') || element?.textContent || '';
      const closeKeys = !command && isCloseControl(id, label) ? windowCloseKeys(element) : null;
      if (!command && !closeKeys) return;
      const key = reminderFor(notebook.current, id, closeKeys || keysOf(id), Date.now());
      if (!key) return;
      const rect = element?.getBoundingClientRect?.();
      const next = { id, chord: formatChord(key) || key, rect: rect && rect.width + rect.height > 0 ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null, doc: element?.ownerDocument || document, uv: !!element?.closest?.('.uv-workspace'), serial: ++serial };
      // Repeated clicks leave the same popup, animation and original expiry alone.
      const reveal = () => setPopup(current => current?.id === id && current.chord === next.chord ? current : next);
      // A capture-phase render can restore a controlled checkbox before React
      // receives its change event. Let the native click complete first.
      if (afterClick) { clearTimeout(clickTimer); clickTimer = setTimeout(reveal, 0); }
      else reveal();
    };
    const click = event => {
      // A real mouse click has a click count; hotkeys and Enter/Space presses do not.
      if (!event.isTrusted || event.detail === 0) return;
      if (event.target.closest?.(OWN_UI)) return;
      const paintKey = event.target.closest?.('[data-paint-key]');
      if (paintKey && !paintKey.hasAttribute('data-hotkey')) { show(PAINT_KEY_PREFIX + paintKey.getAttribute('data-paint-key'), paintKey, true); return; }
      const element = event.target.closest?.('[data-hotkey]');
      if (!element || !element.matches(CONTROLS)) return;
      const id = controlActionId(element);
      if (id) show(id, element, true);
    };
    const menu = event => { if (typeof event.detail?.id === 'string') show(event.detail.id, null); };
    const used = event => {
      const { id: actionId, chord, event: source } = event.detail || {};
      if (typeof actionId !== 'string') return;
      // Paint sliders retain their composite keycap (for example − +) and shared notebook entry.
      const id = latest.current.catalog.find(action => action.id === actionId)?.learnGroup || actionId;
      // Pressing the key a popup shows closes it, even when another button owns that key (Esc).
      const current = latest.current.popup;
      if (current && (current.id === id || chord && current.chord === formatChord(chord))) setPopup(null);
      // One key press counts once, and holding a key down is not five uses.
      if (source && typeof source === 'object') { if (counted.has(source) || source.repeat) return; counted.add(source); }
      const before = notebook.current.keys[id]?.quietUntil || 0;
      const next = recordKeyUse(notebook.current, id, { now: Date.now(), settings: latest.current.settings });
      save(next);
      if ((next.keys[id]?.quietUntil || 0) !== before) window.dispatchEvent(new CustomEvent(CHANGED));
    };
    const changed = () => {
      notebook.current = loadLearnNotebook();
      const current = latest.current.popup;
      if (current && !reminderFor(notebook.current, current.id, keysOf(current.id), Date.now())) setPopup(null);
    };
    // OptimizeXL's own window: clicks there get a reminder there.
    const detached = new Set();
    const detachedRoot = event => {
      const doc = event.detail?.root?.ownerDocument;
      if (!doc) return;
      if (event.detail.add) { detached.add(doc); doc.addEventListener('click', click, true); }
      else { detached.delete(doc); doc.removeEventListener('click', click, true); setPopup(current => current?.doc === doc ? null : current); }
    };
    window.addEventListener('mdlxl-detached-root', detachedRoot);
    window.addEventListener('click', click, true); window.addEventListener('mdlxl-menu-command', menu);
    window.addEventListener('mdlxl-hotkey-used', used); window.addEventListener(CHANGED, changed);
    return () => {
      clearTimeout(clickTimer);
      window.removeEventListener('mdlxl-detached-root', detachedRoot);
      for (const doc of detached) doc.removeEventListener('click', click, true);
      window.removeEventListener('click', click, true); window.removeEventListener('mdlxl-menu-command', menu);
      window.removeEventListener('mdlxl-hotkey-used', used); window.removeEventListener(CHANGED, changed);
    };
  }, [enabled]);

  useEffect(() => {
    if (!popup || !settings?.duration) return;
    const timer = setTimeout(() => setPopup(current => current?.serial === popup.serial ? null : current), settings.duration * 1000);
    return () => clearTimeout(timer);
  }, [popup?.serial, settings?.duration]);

  // Beside what was clicked: above it, or below when there is no room; always inside the window.
  const anchored = popup?.rect && settings.position === 'control';
  useLayoutEffect(() => {
    const element = box.current;
    if (!element || !anchored) return;
    const { rect } = popup, width = element.offsetWidth, height = element.offsetHeight, view = element.ownerDocument.defaultView || window;
    const above = rect.top - GAP - height, top = above >= EDGE ? above : Math.min(view.innerHeight - height - EDGE, rect.top + rect.height + GAP);
    const left = Math.max(EDGE, Math.min(view.innerWidth - width - EDGE, rect.left + rect.width / 2 - width / 2));
    element.style.left = `${left}px`; element.style.top = `${top}px`;
  }, [popup?.serial, anchored, settings?.size]);

  if (!enabled || !popup) return null;
  const dismiss = event => { event.stopPropagation(); setPopup(null); };
  const silence = event => {
    event.preventDefault(); event.stopPropagation();
    updateLearnNotebook(current => silenceKey(current, popup.id));
    setPopup(null);
  };
  const changedDragKeys = reboundDragKeys(popup.id, preferences, popup.uv);
  // A plain element, like the K.E.Y. overlay, so the app's button styles leave its look alone.
  const keycap = <div ref={box} key={popup.serial} role="button" className="learn-keycap" data-position={anchored ? 'control' : settings.position === 'control' ? 'bottom' : settings.position}
    data-size={settings.size} data-style={settings.style} aria-label={[popup.chord, ...changedDragKeys.map(item => `${item.key}: ${item.label}`)].join(', ')} title="Click to dismiss. Right-click to mute this shortcut."
    onPointerDown={event => { event.preventDefault(); event.stopPropagation(); }} onClick={dismiss} onContextMenu={silence}>
    {keyCaps(popup.chord).map((part, index) => <React.Fragment key={index}>{index > 0 && ' + '}<kbd translate="no">{translate(part)}</kbd></React.Fragment>)}
    {changedDragKeys.map(item => <span key={item.id} className="learn-keycap-drag"><kbd translate="no">{translate(item.key)}</kbd> {translate(item.label)}</span>)}
  </div>;
  return popup.doc !== document && popup.doc?.body ? createPortal(keycap, popup.doc.body) : keycap;
}
