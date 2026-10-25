import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useHotkeys, controlActionId } from './Hotkeys.jsx';
import { formatChord } from '../src/preferences.js';
import { translate } from '../src/localization.js';
import { SHREDDER_STORAGE_KEY, emptyNotebook, normalizeNotebook, recordKeyUse, silenceKey, reminderFor, keyCaps } from '../src/shredder-keycaps.js';
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
const GAP = 8, EDGE = 6;

/**
 * Shredder: when the user clicks something that has a key, a keycap popup shows that key.
 * Using the key closes it; using it `learnUses` times quiets that key for a while; clicking
 * the popup silences it. Rules live in src/shredder-keycaps.js.
 */
export default function Shredder({ settings, paint }) {
  const { shortcuts } = useHotkeys();
  const [popup, setPopup] = useState(null);
  const notebook = useRef(null), latest = useRef({}), box = useRef(null);
  latest.current = { settings, shortcuts, paint, popup };
  const enabled = !!settings?.enabled;

  useEffect(() => {
    setPopup(null);
    if (!enabled) return;
    notebook.current = loadShredderNotebook();
    const counted = new WeakSet();
    let serial = 0;
    const save = next => { notebook.current = next; storeNotebook(next); };
    const show = (id, element) => {
      const p = latest.current;
      if (p.paint) return;
      const key = reminderFor(notebook.current, id, p.shortcuts[id], Date.now());
      if (!key) return;
      const rect = element?.getBoundingClientRect?.();
      setPopup({ id, chord: formatChord(key), rect: rect && rect.width + rect.height > 0 ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null, serial: ++serial });
    };
    const click = event => {
      // A real mouse click has a click count; hotkeys and Enter/Space presses do not.
      if (!event.isTrusted || event.detail === 0) return;
      const element = event.target.closest?.('[data-hotkey]');
      if (!element || !element.matches(CONTROLS) || element.closest(`[data-hotkey-scope="paint"], ${OWN_UI}`)) return;
      const id = controlActionId(element);
      if (id) show(id, element);
    };
    const menu = event => { if (typeof event.detail?.id === 'string') show(event.detail.id, null); };
    const used = event => {
      const { id, event: source } = event.detail || {};
      if (typeof id !== 'string') return;
      if (latest.current.popup?.id === id) setPopup(null);
      // One key press counts once, and holding a key down is not five uses.
      if (source && typeof source === 'object') { if (counted.has(source) || source.repeat) return; counted.add(source); }
      save(recordKeyUse(notebook.current, id, { now: Date.now(), settings: latest.current.settings }));
    };
    const changed = () => {
      notebook.current = loadShredderNotebook();
      const current = latest.current.popup;
      if (current && !reminderFor(notebook.current, current.id, latest.current.shortcuts[current.id], Date.now())) setPopup(null);
    };
    window.addEventListener('click', click, true); window.addEventListener('mdlxl-menu-command', menu);
    window.addEventListener('mdlxl-hotkey-used', used); window.addEventListener(CHANGED, changed);
    return () => {
      window.removeEventListener('click', click, true); window.removeEventListener('mdlxl-menu-command', menu);
      window.removeEventListener('mdlxl-hotkey-used', used); window.removeEventListener(CHANGED, changed);
    };
  }, [enabled]);

  useEffect(() => { if (paint) setPopup(null); }, [paint]);
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
    const { rect } = popup, width = element.offsetWidth, height = element.offsetHeight;
    const above = rect.top - GAP - height, top = above >= EDGE ? above : Math.min(window.innerHeight - height - EDGE, rect.top + rect.height + GAP);
    const left = Math.max(EDGE, Math.min(window.innerWidth - width - EDGE, rect.left + rect.width / 2 - width / 2));
    element.style.left = `${left}px`; element.style.top = `${top}px`;
  }, [popup?.serial, anchored, settings?.size]);

  if (!enabled || !popup) return null;
  const silence = event => {
    event.stopPropagation();
    const next = silenceKey(notebook.current, popup.id);
    notebook.current = next; storeNotebook(next); setPopup(null);
  };
  // A plain element, like the K.E.Y. overlay, so the app's button styles leave its look alone.
  return <div ref={box} key={popup.serial} role="button" className="shredder-keycap" data-position={anchored ? 'control' : settings.position === 'control' ? 'bottom' : settings.position}
    data-size={settings.size} data-style={settings.style} aria-label={popup.chord} title="Click to stop showing this key."
    onPointerDown={event => event.stopPropagation()} onClick={silence}>
    {keyCaps(popup.chord).map((part, index) => <React.Fragment key={index}>{index > 0 && ' + '}<kbd translate="no">{translate(part)}</kbd></React.Fragment>)}
  </div>;
}
