import React, { useEffect, useRef, useState } from 'react';
import { Bird } from 'lucide-react';
import { useHotkeys, controlActionId } from './Hotkeys.jsx';
import { isTextEditingTarget } from '../src/preferences.js';
import {
  SHREDDER_STORAGE_KEY, SHREDDER_TIMING, SHREDDER_TEST_VERSION, emptyNotebook, normalizeNotebook, startSession, recordUse, recordShown,
  retireLesson, remindLater, quietForToday, lessonReady, learnedIn, mayInterrupt, notebookSummary,
} from '../src/shredder-notebook.js';
import { SHREDDER_AREAS, BASICS_BEFORE_ADVANCED, TRICKS, WELCOME, trick, areaFor, shortcutLesson, shortcutSignals, trickLesson, directKey, fillLesson } from '../src/shredder-lessons.js';
import './shredder.css';

const TIMING_OVERRIDE_KEY = 'mdlxl-shredder-timing', RECENT_MS = 60 * 1000;
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
    return { ...SHREDDER_TIMING, quietStart: pick('quietStart', SHREDDER_TIMING.quietStart), idle: pick('idle', SHREDDER_TIMING.idle), bubble: pick('bubble', SHREDDER_TIMING.bubble), remindLater: pick('remindLater', SHREDDER_TIMING.remindLater),
      cooldown: { normal: pick('cooldown', SHREDDER_TIMING.cooldown.normal), fewer: pick('cooldown', SHREDDER_TIMING.cooldown.fewer) } };
  } catch { return SHREDDER_TIMING; }
}
function controlLabel(element, fallback) {
  const text = element.getAttribute('data-hotkey-label') || element.getAttribute('aria-label') || (element.getAttribute('data-hotkey-base-title') || '').split('\n')[0] || element.textContent?.replace(element.querySelector('[data-hotkey-badge]')?.textContent || '\u0000', '');
  return (text || fallback || '').trim().slice(0, 80);
}
const inViewport = target => target?.tagName === 'CANVAS' && !!target.closest('.classic-view');
/** Keeps the last minute of timestamps and returns how many there are with `now` added. */
const within = (list, now) => { while (list.length && now - list[0] > RECENT_MS) list.shift(); return list.push(now); };

/**
 * Shredder the Wise watches the hotkey system and a few gestures, keeps a
 * notebook of what the user already does, and now and then offers one tip.
 * Manners live in src/shredder-notebook.js; lessons in src/shredder-lessons.js.
 */
export default function Shredder({ enabled, pace = 'normal', mode, tool, cameraMode, selectionCount, playing, busy, onPreferences }) {
  const { shortcuts, catalog } = useHotkeys();
  const [tip, setTip] = useState(null), [notebookOpen, setNotebookOpen] = useState(false), [ready, setReady] = useState(false);
  const notebook = useRef(null), latest = useRef({}), hovered = useRef(false), camera = useRef(null), context = useRef(null);
  latest.current = { pace, mode, tool, cameraMode, selectionCount, playing, busy, shortcuts, catalog, tip };

  useEffect(() => {
    if (!enabled) { setTip(null); setNotebookOpen(false); setReady(false); return; }
    const timing = loadTiming(), startedAt = Date.now() - APP_LOADED_AT > SWITCHED_ON_LATER_MS ? 0 : Date.now();
    notebook.current = startSession(loadNotebook());
    let saveTimer = 0;
    const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => storeNotebook(notebook.current), 400); };
    save(); setReady(true);
    let lastInput = 0, lastTipAt = 0, held = 0, focused = true, altDown = 0, altAlone = false, lastListPointer = 0, rotateSince = 0;
    const clicks = new Map(), keyedClicks = [], listChanges = [], selections = [], cameraDrags = [], geosetClicks = [], uvDrags = [];
    let drag = null;
    /** Tips waiting for a quiet moment: the hello first, then tricks, then the newest key tip. */
    let candidates = [];

    /** A signal proves its own shortcut lesson (key:/code:) and every trick that lists it. */
    const record = (signal, area) => {
      const now = Date.now();
      if (/^(key|code):/.test(signal)) notebook.current = recordUse(notebook.current, signal, { now, area });
      for (const lesson of TRICKS) if (lesson.learnedBy.includes(signal)) notebook.current = recordUse(notebook.current, lesson.id, { now, area: lesson.area });
      if (latest.current.tip?.learnedBy.includes(signal)) setTip(null);
      save();
    };
    const offer = lesson => {
      if (!lesson || candidates.some(item => item.lesson.id === lesson.id) || latest.current.tip?.id === lesson.id) return;
      if (!lessonReady(notebook.current.lessons[lesson.id], { now: Date.now() })) return;
      if (lesson.level > 1 && learnedIn(notebook.current, lesson.area) < BASICS_BEFORE_ADVANCED) return;
      candidates = [...candidates.slice(-5), { lesson, at: Date.now() }];
    };
    const offerTrick = id => { const lesson = id && trick(id); if (lesson) offer(trickLesson(lesson, latest.current.shortcuts)); };
    // Every pick of Resize (the "zoom" tool) is a moment to mention Zoom anchor.
    const offerAnchor = () => { if (latest.current.mode === 'vertices') offerTrick('trick:zoom-anchor'); };
    const settingsIds = new Set(['settings', 'hotkeys', 'graphics', 'appearanceSettings', 'configurationSettings', 'gridSettings', 'captureSettings']);
    const quiet = () => {
      const p = latest.current;
      return document.hidden || !focused || held > 0 || p.playing || p.busy || ['paint', 'showcase'].includes(p.mode) ||
        isTextEditingTarget(document.activeElement) || !!document.querySelector('[role="dialog"][aria-modal="true"]');
    };

    const pointerdown = event => {
      lastInput = Date.now(); held++;
      const target = event.target, now = lastInput, p = latest.current;
      const canvas = inViewport(target), cameraDrag = canvas && (event.button === 2 || event.button === 0 && (event.altKey || p.cameraMode !== 'work'));
      drag = { canvas, camera: cameraDrag, recorded: false };
      if (event.button === 0 && canvas && event.altKey) record('alt-orbit', 'camera');
      if (cameraDrag && within(cameraDrags, now) >= 2) offerTrick('trick:camera-fine');
      if (event.button === 0 && canvas && !cameraDrag && p.mode === 'vertices') {
        if (p.tool === 'scale') offerAnchor();
        if (p.tool === 'select') { if (event.shiftKey || event.ctrlKey) record('select-modifier', 'vertices'); else if (within(selections, now) >= 2) offerTrick('trick:select-modifiers'); }
      }
      if (event.button === 0 && target.closest?.('.keyframe-timeline') && !target.closest('input,button,select,label')) offerTrick('trick:timeline-keys');
      if (event.button === 0 && target.closest?.('.classic-geosets .geoset-row, .classic-geosets input[type="checkbox"]')) { if (event.shiftKey) record('geoset-range', 'vertices'); else if (within(geosetClicks, now) >= 3) offerTrick('trick:geoset-range'); }
      if (event.button === 0 && target.closest?.('.uv-editor')) { if (event.altKey) record('uv-fine', 'uv'); else if (within(uvDrags, now) >= 2) offerTrick('trick:uv-fine'); }
      if (target.closest?.('select')) lastListPointer = now;
    };
    const pointerup = () => { lastInput = Date.now(); held = Math.max(0, held - 1); };
    // A button released outside the window sends no pointerup here.
    const pointermove = event => {
      if (!event.buttons) { held = 0; drag = null; return; }
      if (!drag?.canvas || drag.recorded || !event.shiftKey) return;
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
    const wheel = event => { lastInput = Date.now(); if (event.target.closest?.('select')) record('dropdown-wheel', 'everywhere'); };
    const change = event => {
      const now = Date.now();
      if (event.target.tagName === 'SELECT' && now - lastListPointer < 15000 && within(listChanges, now) >= 2) offerTrick('trick:dropdown-wheel');
    };
    const clicked = (id, label) => {
      const p = latest.current, times = (clicks.get(id) || 0) + 1;
      clicks.set(id, times);
      if (id.startsWith('camera:')) { offerTrick('trick:camera-toggle'); return; }
      if (id === 'scale') offerAnchor();
      if (settingsIds.has(id)) offerTrick('trick:hotkeys-page');
      const keys = p.shortcuts[id] || [], lesson = shortcutLesson({ actionId: id, label, keys, mode: p.mode });
      if (!lesson) return;
      if (directKey(keys) && within(keyedClicks, Date.now()) >= 3) offerTrick('trick:alt-badges');
      if (times >= lesson.clicks) offer(lesson);
    };
    const click = event => {
      // A real mouse click has a click count; hotkeys and Enter/Space presses do not.
      if (!event.isTrusted || event.detail === 0) return;
      const element = event.target.closest?.('[data-hotkey]');
      if (!element || !element.matches('button, [role="button"], [role="tab"], [role="radio"]')) return;
      if (element.closest('[role="dialog"][aria-modal="true"], [data-hotkey-scope="paint"], [data-hotkey-scope="forge-shapes"], .shredder')) return;
      const id = controlActionId(element); if (id) clicked(id, controlLabel(element, id));
    };
    const hotkey = event => {
      const { id, chord } = event.detail || {};
      if (typeof id !== 'string') return;
      for (const signal of shortcutSignals(id, chord || '')) record(signal, areaFor(id, latest.current.mode));
      if (latest.current.mode === 'bones') record('bones:' + id, 'bones');
      if (id === 'scale') offerAnchor();
      if (settingsIds.has(id) && id !== 'hotkeys') offerTrick('trick:hotkeys-page');
    };
    const menu = event => {
      const id = event.detail?.id, action = typeof id === 'string' && latest.current.catalog.find(item => item.id === id);
      if (action) clicked(id, action.label);
    };
    const blur = () => { focused = false; held = 0; altAlone = false; }, focus = () => { focused = true; };
    const tick = () => {
      const now = Date.now();
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
    // Camera rotation entered and left again quickly is a job for Alt-drag.
    camera.current = () => {
      const now = Date.now(), current = latest.current.cameraMode;
      if (current === 'rotate') rotateSince = now;
      else if (current === 'work' && rotateSince && now - rotateSince < 20000) { rotateSince = 0; offerTrick('trick:alt-orbit'); }
    };
    // Entering an editor or picking a tool is when its tricks help.
    context.current = () => {
      const { mode, tool } = latest.current;
      if (mode === 'vertices') offerTrick({ scale: 'trick:zoom-anchor', rotate: 'trick:rotate-snap', translate: 'trick:move-axis' }[tool]);
      else offerTrick({ uv: 'trick:uv-keys', animation: 'trick:play-space', bones: 'trick:bones-keys' }[mode]);
    };
    offer(WELCOME);
    const listeners = [['pointerdown', pointerdown, true], ['pointerup', pointerup, true], ['pointercancel', pointerup, true], ['pointermove', pointermove, { capture: true, passive: true }], ['keydown', keydown, true], ['keyup', keyup, true],
      ['wheel', wheel, { capture: true, passive: true }], ['change', change, true], ['mdlxl-input-observed', () => { lastInput = Date.now(); }], ['click', click, true], ['mdlxl-hotkey-used', hotkey], ['mdlxl-menu-command', menu], ['blur', blur], ['focus', focus]];
    for (const [type, listener, options] of listeners) window.addEventListener(type, listener, options);
    const timer = setInterval(tick, 250);
    return () => {
      clearInterval(timer); clearTimeout(saveTimer); camera.current = null; context.current = null;
      for (const [type, listener, options] of listeners) window.removeEventListener(type, listener, options);
      storeNotebook(notebook.current);
    };
  }, [enabled]);
  useEffect(() => { camera.current?.(); }, [cameraMode]);
  useEffect(() => { context.current?.(); }, [mode, tool, ready]);

  // The bubble fades by itself; the mouse resting on it keeps it.
  useEffect(() => {
    if (!tip) return;
    const { bubble } = loadTiming();
    let timer;
    const wait = () => { timer = setTimeout(() => hovered.current ? wait() : setTip(null), bubble); };
    wait();
    return () => { clearTimeout(timer); hovered.current = false; };
  }, [tip]);
  useEffect(() => {
    if (!notebookOpen) return;
    const close = event => { if (event.type === 'pointerdown' ? !event.target.closest?.('.shredder') : event.key === 'Escape') setNotebookOpen(false); };
    // The Hotkeys system consumes Esc first and announces it with mdlxl-input-observed.
    const consumed = event => { if (event.detail) close(event.detail); };
    window.addEventListener('pointerdown', close, true); window.addEventListener('keydown', close, true); window.addEventListener('mdlxl-input-observed', consumed);
    return () => { window.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', close, true); window.removeEventListener('mdlxl-input-observed', consumed); };
  }, [notebookOpen]);

  if (!enabled || !ready) return null;
  const update = next => { notebook.current = next; storeNotebook(next); };
  const later = () => { update(remindLater(notebook.current, tip.id, { now: Date.now(), area: tip.area, timing: loadTiming() })); setTip(null); };
  const quietToday = () => { update(quietForToday(notebook.current, Date.now())); setTip(null); setNotebookOpen(false); };
  const summary = notebookOpen ? notebookSummary(notebook.current, SHREDDER_AREAS, Date.now()) : null;
  const quietUntilTomorrow = notebook.current.quietUntil > Date.now();
  return <div className="shredder" data-shredder="">
    {tip && <div className="shredder-bubble" role="status" aria-live="polite" data-shredder-lesson={tip.id}
      onPointerEnter={() => { hovered.current = true; }} onPointerLeave={() => { hovered.current = false; }}>
      <p>{fillLesson(tip.text, tip.args)}</p>
      <div className="shredder-actions"><button type="button" title="Close this tip. Until you use the trick yourself, it comes back now and then." onClick={() => setTip(null)}>K, bro.</button>
        {!tip.once && <button type="button" title="Close this tip and bring it back soon." onClick={later}>Tell me later, bro.</button>}</div>
    </div>}
    {summary && <div className="shredder-notebook" role="dialog" aria-label="Shredder's notebook">
      <header><strong>Shredder's notebook</strong><button type="button" aria-label="Close" onClick={() => setNotebookOpen(false)}>×</button></header>
      <table><tbody>{summary.areas.map(row => <tr key={row.area}><td>{row.label}</td><td>{row.met ? `${row.learned} of ${row.met} learned` : 'Not visited yet'}</td></tr>)}</tbody></table>
      <p className="shredder-week">{`This week: ${summary.learnedThisWeek} learned · ${summary.learned} in all`}</p>
      <p className="shredder-help">A trick counts as learned once you have used it yourself five separate times.</p>
      {quietUntilTomorrow && <p className="shredder-help">Quiet until tomorrow.</p>}
      {SHREDDER_TEST_VERSION && <p className="shredder-help">Test version: tips come every few seconds.</p>}
      <div className="shredder-actions">
        <button type="button" disabled={quietUntilTomorrow} title="No tips until tomorrow." onClick={quietToday}>Quiet for today</button>
        <button type="button" aria-pressed={pace === 'fewer'} title="At most one tip every 10 minutes instead of every 3." onClick={() => onPreferences(previous => ({ ...previous, shredderPace: previous.shredderPace === 'fewer' ? 'normal' : 'fewer' }))}>Fewer tips</button>
        <button type="button" title="Shredder flies away. Turn him on again in Settings → Configuration." onClick={() => onPreferences(previous => ({ ...previous, shredder: false }))}>Turn off</button>
      </div>
    </div>}
    <button type="button" className={'shredder-bird' + (tip ? ' speaking' : '')} aria-label="Shredder the Wise" aria-expanded={notebookOpen} title="Shredder the Wise. Click for his notebook: what you have learned, and quiet options." onClick={() => setNotebookOpen(open => !open)}><Bird size={14} strokeWidth={2} aria-hidden="true"/></button>
  </div>;
}
