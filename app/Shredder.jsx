import React, { useEffect, useRef, useState } from 'react';
import { useHotkeys, controlActionId } from './Hotkeys.jsx';
import { isTextEditingTarget, cameraBindings } from '../src/preferences.js';
import { translate } from '../src/localization.js';
import {
  SHREDDER_STORAGE_KEY, SHREDDER_TIMING, SHREDDER_TEST_VERSION, emptyNotebook, normalizeNotebook, startSession, recordUse, recordShown,
  retireLesson, remindLater, quietForToday, lessonReady, learnedIn, mayInterrupt, notebookSummary,
} from '../src/shredder-notebook.js';
import {
  SHREDDER_AREAS, BASICS_BEFORE_ADVANCED, BIND_CLICKS, BIND_MENU_USES, KIND_CAPTIONS, TRICKS, WELCOME, trick, areaFor, fastestCamera, cameraSignal,
  shortcutLesson, bindLesson, shortcutSignals, trickLesson, directKey, lessonPieces,
} from '../src/shredder-lessons.js';
import ShredderBird from './ShredderBird.jsx';
import './shredder.css';

const TIMING_OVERRIDE_KEY = 'mdlxl-shredder-timing';
// The quiet start is for opening MDLxL. Switching Shredder on while working is an invitation to talk.
const APP_LOADED_AT = Date.now(), SWITCHED_ON_LATER_MS = 10 * 1000;
function loadNotebook() { try { return normalizeNotebook(JSON.parse(localStorage.getItem(SHREDDER_STORAGE_KEY) || 'null')); } catch { return emptyNotebook(); } }
function storeNotebook(notebook) { try { localStorage.setItem(SHREDDER_STORAGE_KEY, JSON.stringify(notebook)); } catch { /* He forgets this session when storage is unavailable. */ } }
// Packaged tests shorten the waits; nothing in the app writes this key.
function loadTiming() {
  try {
    const custom = JSON.parse(localStorage.getItem(TIMING_OVERRIDE_KEY) || 'null');
    if (!custom || typeof custom !== 'object') return SHREDDER_TIMING;
    const pick = (key, fallback) => Number.isFinite(custom[key]) && custom[key] >= 0 ? custom[key] : fallback;
    const pair = (key, fallback) => Array.isArray(custom[key]) && custom[key].length === 2 && custom[key].every(value => Number.isFinite(value) && value >= 0) ? custom[key] : fallback;
    const bird = SHREDDER_TIMING.bird;
    return { ...SHREDDER_TIMING,
      bird: { first: pick('birdFirst', bird.first), perch: pair('birdPerch', bird.perch), away: pair('birdAway', bird.away), placed: pick('birdPlaced', bird.placed), protest: pick('protest', bird.protest) },
      quietStart: pick('quietStart', SHREDDER_TIMING.quietStart), idle: pick('idle', SHREDDER_TIMING.idle), bubble: pick('bubble', SHREDDER_TIMING.bubble), remindLater: pick('remindLater', SHREDDER_TIMING.remindLater),
      cooldown: { normal: pick('cooldown', SHREDDER_TIMING.cooldown.normal), fewer: pick('cooldown', SHREDDER_TIMING.cooldown.fewer) } };
  } catch { return SHREDDER_TIMING; }
}
function controlLabel(element, fallback) {
  const text = element.getAttribute('data-hotkey-label') || element.getAttribute('aria-label') || (element.getAttribute('data-hotkey-base-title') || '').split('\n')[0] || element.textContent?.replace(element.querySelector('[data-hotkey-badge]')?.textContent || '\u0000', '');
  return (text || fallback || '').trim().slice(0, 80);
}
const inViewport = target => target?.tagName === 'CANVAS' && !!target.closest('.classic-view');
/** Keeps the timestamps of the last `span` milliseconds and returns how many there are with `now` added. */
const within = (list, now, span = 60 * 1000) => { while (list.length && now - list[0] > span) list.shift(); return list.push(now); };
const OWN_UI = '.shredder-ui, .shredder-bird-hit';

/** A chord as key caps: Ctrl+K becomes [Ctrl] [K]. */
function KeyCaps({ chord }) {
  const parts = chord === '+' ? ['+'] : chord.split('+').filter(Boolean);
  return <span className="shredder-keys">{parts.map((part, index) => <kbd key={index} translate="no">{translate(part)}</kbd>)}</span>;
}
function TipBody({ tip, onRemind, onUnderstood }) {
  const pieces = lessonPieces(translate(tip.text), tip.args.map((arg, index) => tip.keyArgs.includes(index) ? arg : translate(arg)), tip.keyArgs);
  return <>
    <div className="shredder-caption">{KIND_CAPTIONS[tip.kind] || KIND_CAPTIONS.tip}</div>
    <p className="shredder-text" translate="no">{pieces.map((piece, index) => piece.key ? <KeyCaps key={index} chord={piece.text}/> : piece.text)}</p>
    <div className="shredder-actions">
      {!tip.once && <button type="button" className="shredder-secondary" title="Closes it - I'll bring it up again in a bit." onClick={onRemind}>Remind me</button>}
      <button type="button" className="shredder-primary" title="Closes it - I'll bring it up now and then until you actually use it." onClick={onUnderstood}>Understood</button>
    </div>
  </>;
}

/**
 * Shredder the Wise watches how the user works, keeps a notebook of what they
 * already do, and when he sees a slower way than necessary, shows the fastest
 * one for their own settings. Manners live in src/shredder-notebook.js, lessons in
 * src/shredder-lessons.js, and the bird who says them in ShredderBird.jsx.
 */
export default function Shredder({ enabled, pace = 'normal', preferences, mode, tool, cameraMode, selectionCount, playing, busy, onPreferences }) {
  const { shortcuts, catalog } = useHotkeys();
  const [tip, setTip] = useState(null), [notebookOpen, setNotebookOpen] = useState(false), [ready, setReady] = useState(false);
  const notebook = useRef(null), latest = useRef({});
  latest.current = { pace, preferences, mode, tool, cameraMode, selectionCount, playing, busy, shortcuts, catalog, tip };

  useEffect(() => {
    if (!enabled) { setTip(null); setNotebookOpen(false); setReady(false); return; }
    const timing = loadTiming(), startedAt = Date.now() - APP_LOADED_AT > SWITCHED_ON_LATER_MS ? 0 : Date.now();
    notebook.current = startSession(loadNotebook());
    let saveTimer = 0;
    const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => storeNotebook(notebook.current), 400); };
    save(); setReady(true);
    let lastInput = 0, lastTipAt = 0, held = 0, focused = true, altDown = 0, altAlone = false, lastListPointer = 0, drag = null, modeSource = '';
    const clicks = new Map(), keyedClicks = [], listSteps = [], selections = [], edits = { tool: '', selection: -1, times: [] };
    const cameraTaps = [], scrubs = [], geosetClicks = [], uvDrags = [], listIndex = new WeakMap();
    /** Tips waiting for a quiet moment: the hello first, then tricks, then the newest key tip. */
    let candidates = [];

    /** A signal proves its own shortcut lesson, every lesson that teaches it, and covers lessons it makes unnecessary. */
    const record = (signal, area) => {
      const now = Date.now();
      if (/^(key|code):/.test(signal)) notebook.current = recordUse(notebook.current, signal, { now, area });
      for (const lesson of TRICKS) {
        if (lesson.learnedBy.includes(signal)) notebook.current = recordUse(notebook.current, lesson.id, { now, area: lesson.area });
        else if (lesson.coveredBy?.includes(signal)) notebook.current = recordUse(notebook.current, lesson.id, { now, area: lesson.area, need: 1 });
      }
      const current = latest.current.tip;
      if (current && (current.learnedBy.includes(signal) || current.coveredBy?.includes(signal))) setTip(null);
      candidates = candidates.filter(item => !item.lesson.coveredBy?.includes(signal) && !item.lesson.learnedBy.includes(signal));
      save();
    };
    const offer = lesson => {
      if (!lesson || candidates.some(item => item.lesson.id === lesson.id) || latest.current.tip?.id === lesson.id) return;
      if (!lessonReady(notebook.current.lessons[lesson.id], { now: Date.now() })) return;
      if (lesson.level > 1 && learnedIn(notebook.current, lesson.area) < BASICS_BEFORE_ADVANCED) return;
      candidates = [...candidates.slice(-5), { lesson, at: Date.now() }];
    };
    const offerTrick = id => { const lesson = id && trick(id); if (lesson) offer(trickLesson(lesson, latest.current.shortcuts)); };
    /** The user moved the camera the slow way: show the fastest way their mouse settings allow. */
    const offerCamera = action => offerTrick(fastestCamera(action, latest.current.preferences));
    const quiet = () => {
      const p = latest.current;
      return document.hidden || !focused || held > 0 || p.playing || p.busy || ['paint', 'showcase'].includes(p.mode) ||
        isTextEditingTarget(document.activeElement) || !!document.querySelector('[role="dialog"][aria-modal="true"]');
    };

    const pointerdown = event => {
      if (event.target?.closest?.(OWN_UI)) return;
      lastInput = Date.now(); held++;
      const target = event.target, now = lastInput, p = latest.current, canvas = inViewport(target);
      const { right, middle } = cameraBindings(p.preferences);
      const cameraDrag = canvas && (event.button === 2 ? right !== 'none' : event.button === 1 ? ['rotate', 'pan', 'zoom'].includes(middle) : event.button === 0 && (event.altKey || p.cameraMode !== 'work'));
      drag = canvas ? { camera: cameraDrag, start: now, recorded: false } : null;
      if (canvas) {
        const signal = cameraSignal(event, p.preferences);
        if (signal) { record(signal, 'camera'); if (signal === 'cam:middle-click') modeSource = 'middle'; }
        // Left drags in a camera mode that was picked with the toolbar buttons are the slow way.
        if (event.button === 0 && !event.altKey) {
          if (p.cameraMode === 'rotate' && modeSource === 'button') offerCamera('rotate');
          if (p.cameraMode === 'move') offerCamera('pan');
          if (p.cameraMode === 'zoom') offerCamera('zoom');
        }
        if (event.button === 0 && !cameraDrag && p.mode === 'vertices') {
          if (edits.tool !== p.tool || edits.selection !== p.selectionCount) Object.assign(edits, { tool: p.tool, selection: p.selectionCount, times: [] });
          if (p.tool === 'select') {
            // Selecting again and again from scratch: Shift and Ctrl change a selection instead.
            if (event.shiftKey || event.ctrlKey) record('select-modifier', 'vertices'); else if (within(selections, now, 20000) >= 3) offerTrick('faster:select-modifiers');
          }
          // Moving or rotating the same selection again and again: Shift locks or snaps it.
          if (p.tool === 'translate' && within(edits.times, now, 20000) >= 2) offerTrick('tip:move-axis');
          if (p.tool === 'rotate' && within(edits.times, now, 20000) >= 2) offerTrick('tip:rotate-snap');
          if (p.tool === 'scale') offerTrick('tip:zoom-anchor');
        }
      }
      if (event.button === 0 && target.closest?.('.classic-reel-play')) offerTrick('shortcut:play');
      if (event.button === 0 && target.closest?.('.keyframe-timeline') && !target.closest('input,button,select,label') && within(scrubs, now, 20000) >= 3) offerTrick('faster:timeline-keys');
      if (event.button === 0 && target.closest?.('.classic-geosets .geoset-row, .classic-geosets input[type="checkbox"]')) { if (event.shiftKey) record('geoset-range', 'vertices'); else if (within(geosetClicks, now, 15000) >= 3) offerTrick('faster:geoset-range'); }
      if (event.button === 0 && target.closest?.('.uv-editor')) { if (event.altKey) record('uv-fine', 'uv'); else if (within(uvDrags, now, 20000) >= 4) offerTrick('tip:uv-fine'); }
      const list = target.closest?.('select');
      if (list) { lastListPointer = now; listIndex.set(list, list.selectedIndex); }
    };
    const pointerup = () => {
      lastInput = Date.now(); held = Math.max(0, held - 1);
      // Many short camera nudges in a row: Shift gives slow, precise control.
      if (drag?.camera && !drag.recorded && lastInput - drag.start < 700 && within(cameraTaps, lastInput, 15000) >= 4) offerTrick('tip:camera-fine');
      drag = null;
    };
    // A button released outside the window sends no pointerup here.
    const pointermove = event => {
      if (!event.buttons) { held = 0; drag = null; return; }
      if (!drag || drag.recorded || !event.shiftKey) return;
      const p = latest.current, signal = drag.camera ? 'camera-fine' : p.mode !== 'vertices' ? '' : p.tool === 'translate' ? 'shift-move' : p.tool === 'rotate' ? 'shift-rotate' : '';
      if (signal) { drag.recorded = true; record(signal, drag.camera ? 'camera' : 'vertices'); }
    };
    const keydown = event => {
      lastInput = Date.now();
      if (event.key === 'Alt' && !event.ctrlKey && !event.shiftKey && !event.metaKey) { if (!event.repeat) { altDown = lastInput; altAlone = true; } }
      else altAlone = false;
      if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !event.altKey && !event.ctrlKey && event.target.closest?.('.keyframe-timeline') && !event.target.matches('input,textarea,select,button')) record('timeline-arrows', 'animation');
    };
    // Holding Alt by itself (not as part of a shortcut) shows every key badge.
    const keyup = event => { if (event.key === 'Alt') { if (altAlone && Date.now() - altDown >= 400) record('alt-reveal', 'everywhere'); altAlone = false; } };
    const wheel = event => {
      lastInput = Date.now();
      if (inViewport(event.target)) { const signal = cameraSignal(event, latest.current.preferences); if (signal) record(signal, 'camera'); }
      if (event.target.closest?.('select')) record('dropdown-wheel', 'everywhere');
    };
    // Opening a list just to pick the next or previous entry: the wheel steps through it.
    const change = event => {
      const now = Date.now(), list = event.target;
      if (list.tagName !== 'SELECT' || now - lastListPointer > 15000) return;
      if (Math.abs(list.selectedIndex - (listIndex.get(list) ?? -10)) === 1 && within(listSteps, now) >= 2) offerTrick('faster:dropdown-wheel');
      listIndex.set(list, list.selectedIndex);
    };
    const clicked = (id, label, via) => {
      const p = latest.current, times = (clicks.get(id) || 0) + 1;
      clicks.set(id, times);
      // The camera mode buttons are the slow way to look around.
      if (id.startsWith('camera:')) {
        modeSource = 'button';
        offerCamera(id === 'camera:move' ? 'pan' : id === 'camera:zoom' ? 'zoom' : 'rotate');
        return;
      }
      if (id === 'scale') offerTrick('tip:zoom-anchor');
      const keys = p.shortcuts[id] || [];
      if (directKey(keys)) {
        if (within(keyedClicks, Date.now()) >= 3) offerTrick('tip:alt-badges');
        offer(shortcutLesson({ actionId: id, label, keys, mode: p.mode }));
      } else if (times >= (via === 'menu' ? BIND_MENU_USES : BIND_CLICKS)) offer(bindLesson({ actionId: id, label, mode: p.mode, shortcuts: p.shortcuts }));
    };
    const click = event => {
      // A real mouse click has a click count; hotkeys and Enter/Space presses do not.
      if (!event.isTrusted || event.detail === 0) return;
      const element = event.target.closest?.('[data-hotkey]');
      if (!element || !element.matches('button, [role="button"], [role="tab"], [role="radio"]')) return;
      if (element.closest(`[role="dialog"][aria-modal="true"], [data-hotkey-scope="paint"], [data-hotkey-scope="forge-shapes"], ${OWN_UI}`)) return;
      const id = controlActionId(element); if (id) clicked(id, controlLabel(element, id), 'click');
    };
    const hotkey = event => {
      const { id, chord } = event.detail || {};
      if (typeof id !== 'string') return;
      for (const signal of shortcutSignals(id, chord || '')) record(signal, areaFor(id, latest.current.mode));
      if (id === 'cameraToggle' || id.startsWith('camera:')) modeSource = 'key';
      if (id === 'scale') offerTrick('tip:zoom-anchor');
    };
    const menu = event => {
      const id = event.detail?.id, action = typeof id === 'string' && latest.current.catalog.find(item => item.id === id);
      if (action) clicked(id, action.label, 'menu');
    };
    const blur = () => { focused = false; held = 0; altAlone = false; }, focus = () => { focused = true; };
    const tick = () => {
      const now = Date.now();
      if (latest.current.tip && (latest.current.busy || ['paint', 'showcase'].includes(latest.current.mode) || document.querySelector('[role="dialog"][aria-modal="true"]'))) setTip(null);
      // Tricks wait two minutes for a quiet moment; key tips only while the click is fresh.
      candidates = candidates.filter(item => item.lesson.once || now - item.at <= (item.lesson.priority ? 2 * 60 * 1000 : timing.candidate));
      if (!candidates.length || latest.current.tip || now - lastInput < timing.idle || quiet()) return;
      if (!mayInterrupt({ now, notebook: notebook.current, sessionStartedAt: startedAt, lastTipAt, pace: latest.current.pace, timing })) return;
      const top = Math.max(...candidates.map(item => item.lesson.priority || 0));
      const next = candidates.filter(item => (item.lesson.priority || 0) === top).at(-1);
      candidates = candidates.filter(item => item !== next);
      const { lesson } = next;
      if (!lessonReady(notebook.current.lessons[lesson.id], { now })) return;
      notebook.current = recordShown(notebook.current, lesson.id, { now, area: lesson.area });
      if (lesson.once) notebook.current = retireLesson(notebook.current, lesson.id, { area: lesson.area });
      save(); lastTipAt = now; setTip(lesson);
    };
    offer(WELCOME);
    const listeners = [['pointerdown', pointerdown, true], ['pointerup', pointerup, true], ['pointercancel', pointerup, true], ['pointermove', pointermove, { capture: true, passive: true }], ['keydown', keydown, true], ['keyup', keyup, true],
      ['wheel', wheel, { capture: true, passive: true }], ['change', change, true], ['mdlxl-input-observed', () => { lastInput = Date.now(); }], ['click', click, true], ['mdlxl-hotkey-used', hotkey], ['mdlxl-menu-command', menu], ['blur', blur], ['focus', focus]];
    for (const [type, listener, options] of listeners) window.addEventListener(type, listener, options);
    const timer = setInterval(tick, 250);
    return () => {
      clearInterval(timer); clearTimeout(saveTimer);
      for (const [type, listener, options] of listeners) window.removeEventListener(type, listener, options);
      storeNotebook(notebook.current);
    };
  }, [enabled]);

  useEffect(() => {
    if (!notebookOpen) return;
    const close = event => { if (event.type === 'pointerdown' ? !event.target.closest?.(OWN_UI) : event.key === 'Escape') setNotebookOpen(false); };
    // The Hotkeys system consumes Esc first and announces it with mdlxl-input-observed.
    const consumed = event => { if (event.detail) close(event.detail); };
    window.addEventListener('pointerdown', close, true); window.addEventListener('keydown', close, true); window.addEventListener('mdlxl-input-observed', consumed);
    return () => { window.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', close, true); window.removeEventListener('mdlxl-input-observed', consumed); };
  }, [notebookOpen]);

  if (!enabled || !ready) return null;
  const timing = loadTiming();
  const update = next => { notebook.current = next; storeNotebook(next); };
  const later = () => { if (tip) update(remindLater(notebook.current, tip.id, { now: Date.now(), area: tip.area, timing })); setTip(null); };
  const quietToday = () => { update(quietForToday(notebook.current, Date.now())); setTip(null); setNotebookOpen(false); };
  const summary = notebookOpen ? notebookSummary(notebook.current, SHREDDER_AREAS, Date.now()) : null;
  const quietUntilTomorrow = notebook.current.quietUntil > Date.now();
  const panel = summary && <div role="dialog" aria-label="Shredder's notebook">
    <header><span className="shredder-caption">Shredder's notebook</span><button type="button" className="shredder-close" aria-label="Close" onClick={() => setNotebookOpen(false)}>×</button></header>
    <table><tbody>{summary.areas.map(row => <tr key={row.area}><td>{row.label}</td><td>{row.met ? `${row.learned} of ${row.met} learned` : 'Not visited yet'}</td></tr>)}</tbody></table>
    <p className="shredder-week">{`This week: ${summary.learnedThisWeek} learned · ${summary.learned} in all`}</p>
    <p className="shredder-help">Use a trick yourself 5 times and it counts as learned. Drag me wherever you want.</p>
    {quietUntilTomorrow && <p className="shredder-help">Quiet until tomorrow.</p>}
    {SHREDDER_TEST_VERSION && <p className="shredder-help">Test version: tips come every few seconds.</p>}
    <div className="shredder-actions">
      <button type="button" className="shredder-secondary" disabled={quietUntilTomorrow} title="No tips until tomorrow." onClick={quietToday}>Quiet for today</button>
      <button type="button" className="shredder-secondary" aria-pressed={pace === 'fewer'} title="At most one tip every 10 minutes instead of every 3." onClick={() => onPreferences(previous => ({ ...previous, shredderPace: previous.shredderPace === 'fewer' ? 'normal' : 'fewer' }))}>Fewer tips</button>
      <button type="button" className="shredder-secondary" title="Shredder flies away. Turn him on again in Settings → Configuration." onClick={() => onPreferences(previous => ({ ...previous, shredder: false }))}>Turn off</button>
    </div>
  </div>;
  return <ShredderBird active quiet={busy || ['paint', 'showcase'].includes(mode)} timing={timing} tip={tip}
    tipContent={tip && <TipBody tip={tip} onRemind={later} onUnderstood={() => setTip(null)}/>} panel={panel}
    onExpire={() => setTip(null)} onToggleNotebook={() => setNotebookOpen(open => !open)}/>;
}
