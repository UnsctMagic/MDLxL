import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { controlActionId, useWarmKeys } from './WarmKeys.jsx';
import { formatChord, isTextEditingTarget } from '../src/preferences.js';
import { translate } from '../src/localization.js';
import { easyShortcutForAction, ShredderCoach, SHREDDER_TIMING } from '../src/shredder-coach.js';
import sheet from './assets/update/0.png?inline';
import wings from './assets/update/1.png?inline';
import morgoth from './assets/shredder/morgoth.png';
import './Shredder.css';

const mix = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const tipLine = 'You keep clicking {0}. Try {1}.';
const complaint = 'You are wasting my time! I have better things to do than stand here being ignored.';
const attackLine = "By Morgoth's crown, this vertex is mine!";
const spriteArt = { perch: `url("${sheet}")`, flight: `url("${wings}")`, morgoth: `url("${morgoth}")` };
const darkSpeech = [attackLine, 'Fly, little vertex! Your model belongs to Mordor!', 'Your precious model? I will tear it apart!', 'More vertices! More chaos! Caw!', 'The crown commands. The model obeys.', 'No corner of this model is safe!'];

export function ShredderTool({ active, onClick }) {
  return <button type="button" className="shredder-tool" data-warmkey="shredder" data-warmkey-badges="false" title="Shredder" aria-label="Shredder" aria-pressed={active} onClick={onClick}>
    <span className="shredder-tool-art" style={{ backgroundImage: spriteArt.perch }} aria-hidden="true"/>
    <span className="module-icon-badge" translate="no" aria-hidden="true">SHRD</span>
  </button>;
}

function Speech({ speech, language }) {
  const line = translate(speech.line, language);
  return line.split(/(\{[01]\})/).map((part, index) => part === '{0}'
    ? <strong translate="no" key={index}>{translate(speech.label, language)}</strong>
    : part === '{1}' ? <kbd translate="no" key={index}>{formatChord(speech.key)}</kbd>
      : <span translate="no" key={index}>{part}</span>);
}

/** These two warnings deliberately remain English even in Mordor. */
export function ShredderWarning({ message, onProceed, onCancel }) {
  const panel = useRef(null);
  useEffect(() => { const previous = document.activeElement; panel.current?.querySelector('button')?.focus(); return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); }; }, []);
  const keys = event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel(); }
    if (event.key === 'Tab') {
      const buttons = [...panel.current.querySelectorAll('button')], current = buttons.indexOf(document.activeElement);
      event.preventDefault(); buttons[(current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    }
  };
  return <div className="classic-modal shredder-warning-overlay" onKeyDown={keys}>
    <section ref={panel} className="classic-modal-window shredder-warning" lang="en" translate="no" role="dialog" aria-modal="true" aria-label="Shredder">
      <header><span translate="no">Shredder</span></header>
      <div className="classic-modal-body"><p translate="no">{message}</p><p translate="no">Proceed?</p></div>
      <footer><button translate="no" onClick={onProceed}>Aye!</button><button translate="no" onClick={onCancel}>Nay!</button></footer>
    </section>
  </div>;
}

/** Only the bird can capture a drag. Model edits belong to the existing undo path. */
export default function Shredder({ enabled, language, blocked, contextKey, prepareAttack, onAttack }) {
  const { catalog, shortcuts } = useWarmKeys();
  const bird = useRef(null), balloon = useRef(null), layer = useRef(null), handle = useRef(null), latest = useRef({}), coaching = useRef(null), placement = useRef({ point: null, home: null });
  const [speech, setSpeech] = useState(null);
  latest.current = { catalog, shortcuts, language, blocked, contextKey, prepareAttack, onAttack };
  const mordor = language === 'mordor';

  useEffect(() => {
    if (speech?.kind !== 'tip' || !enabled) return;
    const targets = [...document.querySelectorAll('[data-warmkey]')].filter(element => controlActionId(element) === speech.id);
    for (const element of targets) element.dataset.shredderHint = '';
    return () => { for (const element of targets) delete element.dataset.shredderHint; };
  }, [speech, enabled]);

  useEffect(() => {
    setSpeech(null);
    if (!enabled) { coaching.current = null; return; }
    const sprite = bird.current, bubble = balloon.current, host = layer.current, grip = handle.current;
    const coach = coaching.current ||= new ShredderCoach(), pointers = new Set();
    let frame, phase = mordor ? 'roam' : 'perch', started = performance.now(), lastFrame = -Infinity, lastInput = -Infinity;
    let nextAttack = started + 600, plan = null, committed = false, drag = null;
    let nextWalk = started + 6000, nextFlight = started + 16000, nextAdvice = started + 14000, speechUntil = 0, darkLine = 0;
    let currentContext = latest.current.contextKey, paused = false, welcomePending = true;
    const defaultHome = () => ({ x: innerWidth - 40, y: (document.querySelector('.classic-status')?.getBoundingClientRect().top ?? innerHeight - 22) + 8 });
    let home = placement.current.home || defaultHome(), point = placement.current.point || { ...home }, origin = { ...point }, destination = { ...home }, mouse = { x: innerWidth / 2, y: innerHeight / 2 };
    let movementDuration = 2000, facing = 1;
    let currentSpeech = null;
    let previousArt = '', previousCell = '';
    const speak = (value, duration = SHREDDER_TIMING.tipDuration) => { currentSpeech = value; speechUntil = performance.now() + duration; setSpeech(value); };
    const reset = now => { phase = mordor ? 'roam' : 'perch'; started = now; origin = { ...point }; plan = null; nextAttack = now + 500; speak(null); };
    const react = (result, now) => {
      if (!result || drag || phase === 'tantrum') return;
      origin = { ...point }; started = now; phase = result.kind === 'tantrum' ? 'tantrum' : result.kind === 'tip' ? 'tip' : 'perch';
      speak({ ...result, line: result.kind === 'learned' ? "That's it! {1} for {0}. Much faster." : result.kind === 'tip' ? result.proactive ? 'Press {1} to {0}. One hand. Caw!' : result.reminder ? 'Give your mouse a rest. Use {1} for {0}.' : tipLine : complaint }, result.kind === 'learned' ? 2400 : result.kind === 'tantrum' ? SHREDDER_TIMING.tantrumDuration : SHREDDER_TIMING.tipDuration);
      nextAdvice = now + SHREDDER_TIMING.idleAdvice;
    };
    const used = event => {
      const current = latest.current, { id, source, target } = event.detail || {};
      if (mordor || current.blocked || document.hidden || drag || phase === 'tantrum' || target?.ownerDocument && target.ownerDocument !== document) return;
      const action = current.catalog.find(action => action.id === id);
      if (!action || action.enabled === false || typeof action.enabled === 'function' && !action.enabled()) return;
      const now = performance.now();
      react(coach.use({ id, source, label: action.label, key: easyShortcutForAction(id, current.shortcuts) }, now), now);
    };
    const manual = event => {
      if (!event.isTrusted || event.detail <= 0 || event.button !== 0 || mordor || latest.current.blocked || drag || phase === 'tantrum' || isTextEditingTarget(event.target)) return;
      if (!event.target?.closest?.('.classic-app') || event.target.closest('[data-warmkey], .shredder-layer') || event.target.closest('label')?.querySelector('[data-warmkey]')) return;
      const now = performance.now();
      react(coach.use({ id: '', source: 'mouse', key: '' }, now), now);
    };
    const activity = event => {
      const input = event.detail && typeof event.detail === 'object' ? event.detail : event;
      if (input.target?.closest?.('.shredder-layer')) return;
      lastInput = performance.now();
      if (input.type === 'pointerdown') pointers.add(input.pointerId);
      if (['pointerup', 'pointercancel'].includes(input.type)) pointers.delete(input.pointerId);
    };
    const move = event => { mouse = { x: event.clientX, y: event.clientY }; };
    const endDrag = event => {
      if (!drag || event.pointerId !== drag.id) return;
      event.preventDefault(); event.stopPropagation();
      if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
      drag = null; home = { ...point }; placement.current.home = home;
      reset(performance.now()); nextWalk = performance.now() + 10000; nextFlight = performance.now() + 16000;
      sprite.dataset.dragging = 'false';
    };
    const dragStart = event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      drag = { id: event.pointerId, dx: point.x - event.clientX, dy: point.y - event.clientY };
      grip.setPointerCapture(event.pointerId); plan = null; phase = 'drag'; sprite.dataset.dragging = 'true';
      speak({ kind: 'greeting', line: mordor ? 'The crown commands. The model obeys.' : 'Put me down wherever you like. I can walk from there.' }, 3000);
    };
    const dragMove = event => {
      if (!drag || event.pointerId !== drag.id) return;
      event.preventDefault(); event.stopPropagation();
      point = { x: Math.max(32, Math.min(innerWidth - 32, event.clientX + drag.dx)), y: Math.max(mordor ? 115 : 70, Math.min(innerHeight - 8, event.clientY + drag.dy)) };
    };
    const blur = () => { pointers.clear(); if (drag) { if (grip.hasPointerCapture(drag.id)) grip.releasePointerCapture(drag.id); drag = null; } sprite.dataset.dragging = 'false'; reset(performance.now()); };
    window.addEventListener('mdlxl-warmkey-use', used);
    window.addEventListener('click', manual);
    window.addEventListener('mdlxl-input-observed', activity);
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'keydown']) window.addEventListener(type, activity, true);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('blur', blur);
    grip.addEventListener('pointerdown', dragStart); grip.addEventListener('pointermove', dragMove);
    grip.addEventListener('pointerup', endDrag); grip.addEventListener('pointercancel', endDrag);
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const now = performance.now();
      if (now - lastFrame < 32) return;
      lastFrame = now;
      const current = latest.current;
      const unavailable = current.blocked || document.hidden || !!document.querySelector('[aria-modal="true"]');
      host.style.visibility = unavailable ? 'hidden' : 'visible';
      if (unavailable) {
        if (!paused) reset(now);
        paused = true; currentContext = current.contextKey; return;
      }
      if (current.contextKey !== currentContext) { if (mordor) reset(now); currentContext = current.contextKey; }
      if (paused) { paused = false; nextAttack = now + 500; }
      if (welcomePending) { welcomePending = false; speak({ kind: mordor ? 'attack' : 'greeting', line: mordor ? 'Your precious model? I will tear it apart!' : 'Caw! I will show you handy shortcuts. Drag me wherever you like.' }); }
      if (currentSpeech && now >= speechUntil && phase !== 'tantrum') { speak(null); if (phase === 'tip') phase = 'perch'; }
      if (!placement.current.home) home = defaultHome();
      home = { x: Math.max(32, Math.min(innerWidth - 32, home.x)), y: Math.max(70, Math.min(innerHeight - 8, home.y)) };
      const age = now - started;
      let flying = false, peck = false, carry = false, turn = 0;
      let row = 0, column = Math.floor(now / 450) % 6;
      if (phase === 'tip') { row = 3; column = 2; }
      else if (phase === 'drag') { row = 3; column = 1; }
      else if (phase === 'walk') {
        const t = ease(age / movementDuration);
        point = { x: mix(origin.x, destination.x, t), y: mix(origin.y, destination.y, t) - Math.sin(age / 130) * 2 };
        row = facing > 0 ? 1 : 2; column = Math.floor(now / 100) % 8;
        if (age >= movementDuration) { phase = 'perch'; point = destination; nextWalk = now + 3000 + Math.random() * 4000; }
      } else if (phase === 'excursion') {
        flying = true;
        const t = age < 1300 ? ease(age / 1300) : age < 3300 ? 1 : 1 - ease((age - 3300) / 1300);
        point = { x: mix(origin.x, destination.x, t), y: mix(origin.y, destination.y, t) };
        if (age >= 4600) { phase = 'perch'; point = home; nextFlight = now + 14000 + Math.random() * 10000; nextWalk = now + 4000; }
      } else if (phase === 'tantrum') {
        flying = true;
        const t = age / SHREDDER_TIMING.tantrumDuration, approach = ease(age / 1200);
        const destination = t > .78 ? home : { x: mouse.x + Math.cos(age / 390) * 80, y: mouse.y - 45 + Math.sin(age / 490) * 50 };
        point = { x: mix(origin.x, destination.x, approach), y: mix(origin.y, destination.y, approach) };
        peck = age % 2600 > 1800 && age % 2600 < 2200 && t < .78 && !pointers.size;
        if (peck) { point.x = mouse.x + 8; point.y = mouse.y + 5; flying = false; row = 10; column = 0; turn = -18; }
        if (age > 3500 && currentSpeech?.line === complaint) speak({ kind: 'tantrum', line: 'The shortcut is right there. Caw!' });
        if (age >= SHREDDER_TIMING.tantrumDuration) { phase = 'perch'; point = home; speak(null); nextWalk = now + 4000; nextFlight = now + 12000; }
      } else if (phase === 'attack') {
        flying = true;
        if (age < 350) point = { x: mix(origin.x, plan.from.x, ease(age / 350)), y: mix(origin.y, plan.from.y, ease(age / 350)) };
        else if (age < 550) { point = plan.from; flying = false; peck = true; row = 10; column = 0; }
        else if (age < 1000) { carry = true; point = { x: mix(plan.from.x, plan.to.x, ease((age - 550) / 450)), y: mix(plan.from.y, plan.to.y, ease((age - 550) / 450)) }; }
        else {
          point = { x: plan.to.x + Math.sin(age / 95) * 18, y: plan.to.y - Math.cos(age / 120) * 18 };
          carry = !committed;
          if (!committed && !pointers.size && now - lastInput > 160 && !isTextEditingTarget(document.activeElement)) { committed = true; current.onAttack?.(plan); }
        }
        if (age >= 1250 && committed || age >= 2200) { phase = 'roam'; started = now; origin = { ...point }; plan = null; nextAttack = now + 150; }
      } else if (phase === 'roam') {
        flying = true;
        const t = age / 1000;
        point = { x: mix(origin.x, innerWidth * (.5 + Math.sin(t * 1.3) * .38), ease(age / 900)), y: mix(origin.y, innerHeight * (.5 + Math.cos(t * 1.7) * .33), ease(age / 900)) };
      }
      if (mordor && phase === 'roam' && now >= nextAttack && !drag && !pointers.size && now - lastInput > 160 && !isTextEditingTarget(document.activeElement)) {
        plan = current.prepareAttack?.();
        if (plan) {
          phase = 'attack'; started = now; origin = { ...point }; committed = false;
        } else nextAttack = now + 350;
      }
      if (mordor && !drag && (!currentSpeech || now >= speechUntil - 400)) speak({ kind: 'attack', line: darkSpeech[darkLine++ % darkSpeech.length] }, 4500);
      if (!mordor && phase === 'perch' && !currentSpeech && now >= nextAdvice && now >= coach.restUntil) {
        const candidates = [...document.querySelectorAll('[data-warmkey]')].filter(element => !element.disabled && !element.closest('.shredder-layer') && element.getClientRects().length);
        const choice = candidates.map(element => {
          const id = controlActionId(element), action = current.catalog.find(action => action.id === id), key = easyShortcutForAction(id, current.shortcuts);
          return action && key && action.enabled !== false && (typeof action.enabled !== 'function' || action.enabled()) ? { id, label: action.label, key } : null;
        }).filter(Boolean);
        if (choice.length) react(coach.offer(choice[Math.floor(Math.random() * choice.length)], now, true), now);
        nextAdvice = now + SHREDDER_TIMING.idleAdvice;
      }
      if (!mordor && phase === 'perch' && !drag && !currentSpeech) {
        if (now >= nextFlight) {
          phase = 'excursion'; started = now; origin = { ...point };
          destination = { x: point.x < innerWidth / 2 ? -120 : innerWidth + 120, y: Math.max(90, point.y - 180) };
        } else if (now >= nextWalk) {
          const sidebar = document.querySelector('.classic-sidebar')?.getBoundingClientRect();
          destination = { x: point.x > innerWidth - 100 ? Math.max(40, (sidebar?.left ?? innerWidth - 250) + 35) : innerWidth - 40, y: defaultHome().y };
          phase = 'walk'; started = now; origin = { ...point }; facing = destination.x >= origin.x ? 1 : -1;
          movementDuration = Math.max(1200, Math.hypot(destination.x - origin.x, destination.y - origin.y) * 7);
        }
      }
      if (phase !== 'excursion') point = { x: Math.max(24, Math.min(innerWidth - 24, point.x)), y: Math.max(mordor ? 112 : 68, Math.min(innerHeight - 8, point.y)) };
      placement.current.point = point;
      sprite.dataset.phase = peck ? 'peck' : phase;
      sprite.dataset.carrying = String(carry);
      sprite.dataset.dragDisabled = String(peck);
      sprite.style.transform = `translate(${point.x - (mordor ? 56 : 32)}px, ${point.y - (mordor ? 104 : 60)}px) rotate(${turn}deg)`;
      const picture = sprite.firstElementChild;
      if (flying) { row = Math.floor(now / 100) % 8 >= 4 ? 1 : 0; column = Math.floor(now / 100) % 4; }
      if (mordor) { row = flying ? 3 : peck ? 2 : phase === 'walk' ? 1 : 0; column = Math.floor(now / (flying ? 110 : 220)) % 4; }
      const art = mordor ? 'morgoth' : flying ? 'flight' : 'perch', cell = `${art}:${row}:${column}`;
      // Embedded sheets are large: assign/parse their data URL only on takeoff or landing.
      if (art !== previousArt) {
        picture.style.backgroundImage = spriteArt[art]; previousArt = art;
        picture.style.width = mordor ? '112px' : flying ? '108px' : '64px'; picture.style.height = mordor ? '112px' : flying ? '108px' : '69.33px';
        picture.style.margin = !mordor && flying ? '-20px -22px' : '0';
        picture.style.backgroundSize = mordor ? '400% 400%' : flying ? '400% 200%' : '800% 1100%';
      }
      if (cell !== previousCell) { picture.style.backgroundPosition = `${column * (mordor ? -112 : flying ? -108 : -64)}px ${row * (mordor ? -112 : flying ? -108 : -69.33)}px`; previousCell = cell; }
      picture.style.transform = `scaleX(${phase === 'walk' ? mordor ? facing : 1 : flying && point.x < origin.x ? -1 : 1})`;
      if (bubble) {
        bubble.style.left = `${Math.max(8, Math.min(innerWidth - bubble.offsetWidth - 8, point.x - bubble.offsetWidth + 24))}px`;
        bubble.style.top = `${Math.max(8, point.y - (mordor ? 116 : 77) - bubble.offsetHeight)}px`;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      if (drag && grip.hasPointerCapture(drag.id)) grip.releasePointerCapture(drag.id);
      window.removeEventListener('mdlxl-warmkey-use', used); window.removeEventListener('mdlxl-input-observed', activity);
      window.removeEventListener('click', manual);
      for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'keydown']) window.removeEventListener(type, activity, true);
      window.removeEventListener('pointermove', move); window.removeEventListener('blur', blur);
      grip.removeEventListener('pointerdown', dragStart); grip.removeEventListener('pointermove', dragMove);
      grip.removeEventListener('pointerup', endDrag); grip.removeEventListener('pointercancel', endDrag);
    };
  }, [enabled, mordor]);

  if (!enabled) return null;
  return createPortal(<div ref={layer} className="shredder-layer" lang={language} data-mordor={mordor}>
    <div ref={bird} className="shredder-sprite"><div className="shredder-picture" aria-hidden="true"/>
      <div ref={handle} className="shredder-handle" role="img" aria-label={translate('Shredder', language)} title={translate('Drag Shredder', language)}/>
      <i className="shredder-carried-vertex"/>
    </div>
    <div ref={balloon} className="shredder-balloon" role="status" aria-live="polite" hidden={!speech}>{speech && <Speech speech={speech} language={language}/>}</div>
  </div>, document.body);
}
