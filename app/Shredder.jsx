import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { controlActionId, useWarmKeys } from './WarmKeys.jsx';
import { formatChord, isTextEditingTarget } from '../src/preferences.js';
import { translate } from '../src/localization.js';
import { easyShortcutForAction, ShredderCoach, SHREDDER_TIMING } from '../src/shredder-coach.js';
import sheet from './assets/update/0.png?inline';
import wings from './assets/update/1.png?inline';
import './Shredder.css';

const mix = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const tipLine = 'You keep clicking {0}. Try {1}.';
const reminderLine = 'Still clicking {0}? One hand, {1}. Caw!';
const complaint = 'You are wasting my time! I have better things to do than stand here being ignored.';
const attackLine = "By Morgoth's crown, this vertex is mine!";
const spriteArt = { perch: `url("${sheet}")`, flight: `url("${wings}")` };

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

/** An entirely click-through visitor. Only onAttack is allowed to edit anything. */
export default function Shredder({ enabled, language, blocked, contextKey, prepareAttack, onAttack }) {
  const { catalog, shortcuts } = useWarmKeys();
  const bird = useRef(null), balloon = useRef(null), layer = useRef(null), latest = useRef({}), coaching = useRef(null);
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
    const sprite = bird.current, bubble = balloon.current, host = layer.current;
    const coach = coaching.current ||= new ShredderCoach(), pointers = new Set();
    let frame, phase = 'perch', started = performance.now(), lastFrame = -Infinity, lastInput = started;
    let nextAttack = started + 12000, attacksLeft = 0, plan = null, committed = false;
    let currentContext = latest.current.contextKey, paused = false;
    let point = { x: innerWidth - 32, y: innerHeight - 24 }, origin = { ...point }, mouse = { x: innerWidth / 2, y: innerHeight / 2 };
    let currentSpeech = null;
    let previousArt = '', previousCell = '';
    const speak = value => { currentSpeech = value; setSpeech(value); };
    const reset = now => { phase = 'perch'; plan = null; attacksLeft = 0; nextAttack = now + 12000; speak(null); };
    const used = event => {
      const current = latest.current, { id, source, target } = event.detail || {};
      if (mordor || current.blocked || document.hidden || target?.ownerDocument && target.ownerDocument !== document) return;
      const action = current.catalog.find(action => action.id === id);
      if (!action || action.enabled === false || typeof action.enabled === 'function' && !action.enabled()) return;
      const result = coach.use({ id, source, label: action.label, key: easyShortcutForAction(id, current.shortcuts) }, performance.now());
      if (result?.kind === 'learned') {
        if (currentSpeech?.id === id) reset(performance.now());
      } else if (result && phase === 'perch') {
        phase = result.kind; started = performance.now(); origin = { ...point };
        speak({ ...result, line: result.kind === 'tip' ? result.reminder ? reminderLine : tipLine : complaint });
      }
    };
    const activity = event => {
      const input = event.detail || event;
      lastInput = performance.now();
      if (input.type === 'pointerdown') pointers.add(input.pointerId);
      if (['pointerup', 'pointercancel'].includes(input.type)) pointers.delete(input.pointerId);
      if (mordor && phase === 'attack') reset(lastInput);
    };
    const move = event => { mouse = { x: event.clientX, y: event.clientY }; };
    const blur = () => { pointers.clear(); reset(performance.now()); };
    window.addEventListener('mdlxl-warmkey-use', used);
    window.addEventListener('mdlxl-input-observed', activity);
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'keydown']) window.addEventListener(type, activity, true);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('blur', blur);
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
      if (paused) { paused = false; nextAttack = now + 12000; }
      const status = document.querySelector('.classic-status')?.getBoundingClientRect();
      const sidebar = document.querySelector('.classic-sidebar')?.getBoundingClientRect();
      const rightHome = { x: innerWidth - 32, y: (status?.top ?? innerHeight - 22) + 8 };
      const home = Math.hypot(mouse.x - rightHome.x, mouse.y - rightHome.y) < 90
        ? { x: (sidebar?.left || 0) + 32, y: rightHome.y } : rightHome;
      const age = now - started;
      let flying = false, peck = false, carry = false, turn = 0;
      let row = 0, column = Math.floor(now / 450) % 6;
      if (phase === 'perch' || phase === 'tip') {
        point = home;
        if (phase === 'tip') { row = 3; column = 2; }
        if (phase === 'tip' && age >= SHREDDER_TIMING.tipDuration) { phase = 'perch'; speak(null); }
      } else if (phase === 'tantrum') {
        flying = true;
        const t = age / SHREDDER_TIMING.tantrumDuration, approach = ease(age / 1200);
        const destination = t > .78 ? home : { x: mouse.x + Math.cos(age / 390) * 80, y: mouse.y - 45 + Math.sin(age / 490) * 50 };
        point = { x: mix(origin.x, destination.x, approach), y: mix(origin.y, destination.y, approach) };
        peck = age % 2600 > 1800 && age % 2600 < 2200 && t < .78;
        if (peck) { point.x = mouse.x + 8; point.y = mouse.y + 5; flying = false; row = 10; column = 0; turn = -18; }
        if (age > 3500 && currentSpeech?.line === complaint) speak({ kind: 'tantrum', line: 'The shortcut is right there. Caw!' });
        if (age >= SHREDDER_TIMING.tantrumDuration) { phase = 'perch'; point = home; speak(null); }
      } else if (phase === 'attack') {
        flying = true;
        if (age < 1000) point = { x: mix(origin.x, plan.from.x, ease(age / 1000)), y: mix(origin.y, plan.from.y, ease(age / 1000)) };
        else if (age < 1350) { point = plan.from; flying = false; peck = true; row = 10; column = 0; }
        else if (age < 2500) { carry = true; point = { x: mix(plan.from.x, plan.to.x, ease((age - 1350) / 1150)), y: mix(plan.from.y, plan.to.y, ease((age - 1350) / 1150)) }; }
        else {
          if (!committed) { committed = true; current.onAttack?.(plan); }
          point = { x: mix(plan.to.x, home.x, ease((age - 2500) / 1000)), y: mix(plan.to.y, home.y, ease((age - 2500) / 1000)) };
        }
        if (age >= 3500) { phase = 'perch'; point = home; plan = null; speak(null); nextAttack = now + (attacksLeft > 0 ? 600 : 30000); }
      }
      if (mordor && phase === 'perch' && now >= nextAttack && !pointers.size && now - lastInput > 1800 && !isTextEditingTarget(document.activeElement)) {
        plan = current.prepareAttack?.();
        if (plan) {
          if (!attacksLeft) attacksLeft = 3;
          attacksLeft--; phase = 'attack'; started = now; origin = { ...point }; committed = false;
          speak({ kind: 'attack', line: attacksLeft === 1 ? 'Fly, little vertex! Your model belongs to Mordor!' : attackLine });
        } else nextAttack = now + 5000;
      }
      point = { x: Math.max(24, Math.min(innerWidth - 24, point.x)), y: Math.max(68, Math.min(innerHeight - 12, point.y)) };
      sprite.dataset.phase = peck ? 'peck' : phase;
      sprite.dataset.carrying = String(carry);
      sprite.style.transform = `translate(${point.x - 32}px, ${point.y - 60}px) rotate(${turn}deg)`;
      const picture = sprite.firstElementChild;
      if (flying) { row = Math.floor(now / 100) % 8 >= 4 ? 1 : 0; column = Math.floor(now / 100) % 4; }
      const art = flying ? 'flight' : 'perch', cell = `${art}:${row}:${column}`;
      // Embedded sheets are large: assign/parse their data URL only on takeoff or landing.
      if (art !== previousArt) {
        picture.style.backgroundImage = spriteArt[art]; previousArt = art;
        picture.style.width = flying ? '108px' : '64px'; picture.style.height = flying ? '108px' : '69.33px';
        picture.style.margin = flying ? '-20px -22px' : '0';
        picture.style.backgroundSize = flying ? '400% 200%' : '800% 1100%';
      }
      if (cell !== previousCell) { picture.style.backgroundPosition = `${column * (flying ? -108 : -64)}px ${row * (flying ? -108 : -69.33)}px`; previousCell = cell; }
      picture.style.transform = `scaleX(${flying && point.x < origin.x ? -1 : 1})`;
      if (bubble) {
        bubble.style.left = `${Math.max(8, Math.min(innerWidth - bubble.offsetWidth - 8, point.x - bubble.offsetWidth + 24))}px`;
        bubble.style.top = `${Math.max(8, point.y - 77 - bubble.offsetHeight)}px`;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('mdlxl-warmkey-use', used); window.removeEventListener('mdlxl-input-observed', activity);
      for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'keydown']) window.removeEventListener(type, activity, true);
      window.removeEventListener('pointermove', move); window.removeEventListener('blur', blur);
    };
  }, [enabled, mordor]);

  if (!enabled) return null;
  return createPortal(<div ref={layer} className="shredder-layer" lang={language} data-mordor={mordor}>
    <div ref={bird} className="shredder-sprite" aria-hidden="true"><div className="shredder-picture"/>
      {mordor && <svg className="shredder-crown" viewBox="0 0 48 32"><path d="M5 27 1 9 13 18 15 2 24 15 33 2 35 18 47 9 43 27Z" fill="#242028" stroke="#b2a4b9" strokeWidth="1.5"/><path d="M6 27h36v4H6z" fill="#151019" stroke="#b2a4b9"/><g fill="#fff4cb" stroke="#d6a942"><circle cx="14" cy="24" r="3"/><circle cx="24" cy="24" r="3.5"/><circle cx="34" cy="24" r="3"/></g></svg>}
      <i className="shredder-carried-vertex"/>
    </div>
    <div ref={balloon} className="shredder-balloon" role="status" aria-live="polite" hidden={!speech}>{speech && <Speech speech={speech} language={language}/>}</div>
  </div>, document.body);
}
