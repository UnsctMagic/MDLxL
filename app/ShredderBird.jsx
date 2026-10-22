import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { translate } from '../src/localization.js';
import { PROTESTS } from '../src/shredder-lessons.js';
import standArt from './assets/shredder/stand.png';
import wingsArt from './assets/shredder/wings.png';
import movesArt from './assets/shredder/moves.png';

// LowPolyWorks visitor sprites: standing/walking cells 192×208, flight cells 240×240.
const BODY_W = 120, BODY_H = BODY_W * 208 / 192, FLIGHT = BODY_W * 1.64, FEET = .916;
const SHEETS = {
  stand: { src: standArt, cols: 8, rows: 11, w: BODY_W, h: BODY_H },
  moves: { src: movesArt, cols: 16, rows: 10, w: BODY_W, h: BODY_H },
  wings: { src: wingsArt, cols: 4, rows: 2, w: FLIGHT, h: FLIGHT },
};
// Row 8 of the standing sheet is a head lean one way and the other, as [column, beats].
const LEAN = [[0, 2], [5, 1], [4, 3], [5, 1], [0, 2], [6, 1], [7, 3], [6, 1]], LEAN_BEAT = 220;
const LEAN_TIME = LEAN.reduce((total, [, beats]) => total + beats, 0) * LEAN_BEAT;
const HOP = [110, 150, 200, 90], HOP_TIME = HOP.reduce((a, b) => a + b, 0); // moves row 7: look, crouch, spring
const between = (low, high) => low + Math.random() * (high - low);
const ease = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * ease(t);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function leanColumn(time) {
  let beat = Math.floor(time % LEAN_TIME / LEAN_BEAT);
  for (const [column, beats] of LEAN) { if (beat < beats) return column; beat -= beats; }
  return 0;
}
function hopColumn(age) { let left = age; for (let column = 0; column < HOP.length; column++) { if (left < HOP[column]) return column; left -= HOP[column]; } return HOP.length - 1; }

/** Only the 3D view's own picture may be under him; any control, label, panel or tip makes a spot busy. */
const OPEN_GROUND = 'canvas, .viewport, .viewport-area, .viewport-host, .classic-view';
const ACTIVE = 2500, NOT_IN_YOUR_FACE = 240;
export function spotIsFree(document, x, feet, layer) {
  const left = x - BODY_W * .32, right = x + BODY_W * .32, top = feet - BODY_H * .8;
  for (const px of [left, (left + x) / 2, x, (x + right) / 2, right]) for (const py of [top, (top + feet) / 2, feet - 4]) {
    const hit = document.elementsFromPoint(px, py).find(element => !layer?.contains(element));
    if (!hit || !hit.matches(OPEN_GROUND) || !hit.closest('.classic-view')) return false;
  }
  return true;
}
/**
 * Where a bubble or panel goes: beside his head, inside the window, toward the middle of it,
 * unless that side would cover the mouse; then the other side.
 */
export function besideHead(x, feet, width, height, view, pointer = null, side = '') {
  const headY = feet - BODY_H * .78, top = clamp(headY - height + 18, 8, view.height - height - 8);
  const place = side => ({ side, top, left: clamp(side === 'right' ? x + BODY_W * .2 : x - BODY_W * .2 - width, 8, view.width - width - 8) });
  const covers = spot => pointer && pointer.x > spot.left - 30 && pointer.x < spot.left + width + 30 && pointer.y > spot.top - 30 && pointer.y < spot.top + height + 30;
  if (side) return place(side);
  const preferred = place(x < view.width / 2 ? 'right' : 'left'), other = place(preferred.side === 'right' ? 'left' : 'right');
  return covers(preferred) && !covers(other) ? other : preferred;
}
const BUBBLE_GUESS = { width: 300, height: 130 };

/**
 * Shredder himself. He roams the bottom edge of the 3D view, looks around, leans,
 * walks and flies off and back now and then. When he has a tip he flies near the
 * view (never in your face) and says it from there, then goes back. The user can
 * pick him up and put him anywhere; now and then he protests a little.
 * He is never in the way: he only roams over the 3D view's own picture, moves on
 * when anything appears under him, only roams while the user pauses, and hides
 * while a window is open. Clicks pass through everything but his body.
 */
export default function ShredderBird({ active, quiet, timing, tip, tipContent, panel, onExpire, onToggleNotebook }) {
  const layerRef = useRef(null), sprite = useRef(null), hitRef = useRef(null), bubbleRef = useRef(null), panelRef = useRef(null), protestRef = useRef(null);
  const latest = useRef({}), hovered = useRef(false);
  latest.current = { quiet, timing, tip, panel: !!panel, onExpire, onToggleNotebook };
  useEffect(() => {
    const bird = sprite.current, layer = layerRef.current, hit = hitRef.current, owner = bird?.ownerDocument?.defaultView;
    if (!active || !bird || !owner) return;
    const document = owner.document, picture = bird.firstElementChild;
    const reduced = owner.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const visits = () => latest.current.timing.bird;
    let phase = 'away', started = performance.now(), nextAt = performance.now() + visits().first, leaveAt = 0, frame = 0;
    let x = 0, feet = 0, dir = 1, flight = null, action = null, nextAction = 0, steps = 0, walkUntil = 0, last = 0, lastCheck = 0;
    let home = null, speaking = null, returnAt = 0, protest = null, grab = null, expired = '';
    let lastInput = performance.now(), pointer = { x: -1e4, y: -1e4 };

    const view = () => ({ width: owner.innerWidth, height: owner.innerHeight });
    const ledge = () => { const element = document.querySelector('.classic-view'), rect = element?.getBoundingClientRect(); return rect && rect.width > 240 && rect.height > 200 ? rect : null; };
    const freeXs = () => {
      const rect = ledge(); if (!rect) return [];
      const spots = [];
      for (let px = rect.left + BODY_W * .5; px <= rect.right - BODY_W * .5; px += 10) if (spotIsFree(document, px, rect.bottom - 1, layer)) spots.push({ x: px, y: rect.bottom - 1 });
      return spots;
    };
    /** A roaming spot: anywhere free along the bottom edge of the 3D view. */
    const pickRoam = (awayFrom = null) => {
      const spots = freeXs().filter(spot => awayFrom === null || Math.abs(spot.x - awayFrom) > 160);
      return spots.length ? spots[Math.floor(Math.random() * spots.length)] : null;
    };
    /** A speaking spot: near where the user works, but at least NOT_IN_YOUR_FACE from the mouse. */
    const pickSpeak = () => {
      const spots = freeXs(), rect = ledge(); if (!spots.length) return null;
      const nearest = target => spots.reduce((best, spot) => !best || Math.abs(spot.x - target) < Math.abs(best.x - target) ? spot : best, null);
      const inside = pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom;
      if (!inside) return nearest(x || rect.right);
      // Neither he nor his bubble may come near the mouse.
      const far = spots.filter(spot => {
        if (Math.hypot(spot.x - pointer.x, spot.y - BODY_H / 2 - pointer.y) < NOT_IN_YOUR_FACE) return false;
        const bubble = besideHead(spot.x, spot.y, BUBBLE_GUESS.width, BUBBLE_GUESS.height, view(), pointer);
        return !(pointer.x > bubble.left - 30 && pointer.x < bubble.left + BUBBLE_GUESS.width + 30 && pointer.y > bubble.top - 30 && pointer.y < bubble.top + BUBBLE_GUESS.height + 30);
      });
      return (far.length ? far : spots).reduce((best, spot) => !best || Math.abs(spot.x - pointer.x) < Math.abs(best.x - pointer.x) ? spot : best, null);
    };
    const calm = () => performance.now() - lastInput > ACTIVE;
    const blocked = () => latest.current.quiet || document.hidden || !!document.querySelector('[role="dialog"][aria-modal="true"]');
    const landed = () => phase === 'perch' || phase === 'walk' || phase === 'land';

    const placeBeside = element => {
      if (!element) return;
      // The side is chosen once, away from the mouse, so the bubble never jumps when the mouse comes to its buttons.
      const spot = besideHead(x, feet, element.offsetWidth, element.offsetHeight, view(), pointer, element.dataset.side || '');
      element.style.transform = `translate(${spot.left}px, ${spot.top}px)`;
      element.dataset.side = spot.side;
    };
    const paint = (sheet, column, row, cx, cy, mirror, anchor) => {
      const s = SHEETS[sheet];
      bird.style.width = s.w + 'px'; bird.style.height = s.h + 'px';
      bird.style.transform = `translate(${cx - s.w / 2}px, ${anchor === 'feet' ? cy - s.h * FEET : cy - s.h / 2}px)`;
      picture.style.backgroundImage = `url("${s.src}")`;
      picture.style.backgroundSize = `${s.cols * 100}% ${s.rows * 100}%`;
      picture.style.backgroundPosition = `${-column * s.w}px ${-row * s.h}px`;
      picture.style.transform = mirror ? 'scaleX(-1)' : '';
      bird.style.visibility = 'visible';
      // Only his body takes the mouse, and only while he stands or is held.
      const grabbable = landed() || phase === 'held';
      hit.style.display = grabbable ? 'block' : 'none';
      if (grabbable) hit.style.transform = `translate(${x - BODY_W * .25}px, ${feet - BODY_H * .66}px)`;
    };
    const hide = () => { bird.style.visibility = 'hidden'; hit.style.display = 'none'; if (bubbleRef.current) bubbleRef.current.style.visibility = 'hidden'; };
    const goAway = now => { phase = 'away'; hide(); nextAt = now + between(...visits().away); bird.dataset.phase = phase; };
    const settle = (now, spot) => { x = spot.x; feet = spot.y; phase = 'land'; started = now; leaveAt = Math.max(leaveAt, now + between(...visits().perch)); nextAction = now + between(1500, 3500); };
    const takeOff = now => {
      if (reduced) { goAway(now); return; }
      dir = x > view().width / 2 ? 1 : -1;
      flight = { x, y: feet - BODY_H * .5, speed: 260, lift: 140 };
      phase = 'hop'; started = now;
    };
    /** Flies from the current position (or in from the nearer side) to a spot. */
    const flyTo = (now, spot) => {
      const from = phase !== 'away' ? { x, y: feet - BODY_H * .5 } : null;
      dir = from ? (spot.x >= from.x ? 1 : -1) : (spot.x > view().width / 2 ? -1 : 1);
      if (reduced) { settle(now, spot); return; }
      const start = from || { x: dir > 0 ? -FLIGHT : view().width + FLIGHT, y: spot.y - 260 };
      flight = { from: start, to: spot, duration: from ? clamp(Math.abs(spot.x - from.x) * 1.6, 500, 1100) : 1400 };
      phase = 'arrive'; started = now;
    };
    const say = (now, text) => {
      protest = { until: now + 1800 };
      if (protestRef.current) { protestRef.current.textContent = translate(text); protestRef.current.dataset.side = ''; protestRef.current.style.visibility = 'visible'; }
    };

    // A tip: fly near the view, unless he already stands close (but not in your face).
    const startSpeaking = now => {
      speaking = { id: latest.current.tip.id, moved: false, shownAt: 0 };
      if (phase === 'held') return;
      const here = landed() && Math.abs(x - pointer.x) < 620 && Math.hypot(x - pointer.x, feet - BODY_H / 2 - pointer.y) >= NOT_IN_YOUR_FACE && (home?.placed || spotIsFree(document, x, feet, layer));
      if (here) { action = { kind: 'lean', at: now, length: LEAN_TIME }; return; }
      const spot = pickSpeak() || (home && { x: home.x, y: home.feet });
      if (spot) { speaking.moved = true; flyTo(now, spot); }
    };
    const stopSpeaking = now => {
      hovered.current = false;
      if (bubbleRef.current) bubbleRef.current.style.visibility = 'hidden';
      if (speaking?.moved && home) returnAt = now + 700;
      speaking = null;
    };

    const tick = now => {
      frame = 0;
      const p = latest.current, dt = Math.min(40, now - (last || now)); last = now;
      if ((p.tip?.id || null) !== (speaking?.id || null)) { if (speaking) stopSpeaking(now); if (p.tip) startSpeaking(now); }
      if (returnAt && now >= returnAt && landed() && !speaking) {
        returnAt = 0;
        if (home && (Math.abs(home.x - x) > 4 || Math.abs(home.feet - feet) > 4)) flyTo(now, { x: home.x, y: home.feet });
      }
      bird.dataset.phase = phase;
      if (protest && now >= protest.until) { protest = null; if (protestRef.current) protestRef.current.style.visibility = 'hidden'; }
      if (phase === 'away') return;
      const age = now - started;
      if (phase === 'arrive') {
        const t = Math.min(1, age / flight.duration), { from, to } = flight;
        if (t >= 1) settle(now, to);
        else {
          const cx = mix(from.x, to.x, t), cy = mix(from.y, to.y - BODY_H * .5, t) - Math.sin(t * Math.PI) * (flight.duration > 1200 ? 50 : 26);
          x = cx; feet = cy + BODY_H * .5;
          paint('wings', Math.floor(age / 110) % 4, Math.floor(age / 110) % 8 >= 4 ? 1 : 0, cx, cy, dir < 0, 'center');
        }
      }
      if (phase === 'hop') {
        if (age < HOP_TIME) paint('moves', hopColumn(age), 7, x, feet, dir < 0, 'feet');
        else { phase = 'fly'; started = now; }
      }
      if (phase === 'fly') {
        const t = (now - started) / 1000;
        const cx = flight.x + dir * (flight.speed * t + 240 * t * t), cy = flight.y - flight.lift * t - 280 * t * t;
        x = cx; feet = cy + BODY_H * .5;
        paint('wings', Math.floor(t * 1000 / 110) % 4, Math.floor(t * 1000 / 110) % 8 >= 4 ? 1 : 0, cx, cy, dir < 0, 'center');
        if (cx < -FLIGHT || cx > view().width + FLIGHT || cy < -FLIGHT || t > 2.6) goAway(now);
      }
      // Held by the scruff, he flaps one wing about it.
      if (phase === 'held') paint('stand', Math.floor(age / 120) % 4, 3, x, feet, pointer.x < x, 'feet');
      if (phase === 'land') {
        paint('stand', age < 260 ? 3 : 0, age < 260 ? 4 : 0, x, feet, false, 'feet');
        if (age >= 260) { phase = 'perch'; started = now; }
      }
      if (phase === 'perch' || phase === 'walk') {
        const settled = !speaking && !p.panel && !returnAt, placedHold = home?.placed && now - home.placedAt < visits().placed;
        if (phase === 'walk' && (!calm() || now >= walkUntil || !settled)) { phase = 'perch'; nextAction = now + between(3000, 6000); }
        let column = Math.floor(now / 440) % 6, row = 0, mirror = false;
        if (phase === 'walk') {
          const step = dir * 26 * dt / 1000, next = x + step;
          if (spotIsFree(document, next + dir * 10, feet, layer)) { x = next; steps += Math.abs(step); }
          else { phase = 'perch'; nextAction = now + between(2500, 5000); }
          row = 1; column = Math.floor(steps / 5) % 8; mirror = dir < 0;
        } else if (action) {
          const t = now - action.at;
          if (t >= action.length) action = null;
          else if (action.kind === 'lean') { row = 8; column = leanColumn(t); }
          else { row = 5; column = Math.floor(t / 150) % 8; }
        } else if (now >= nextAction) {
          const roll = Math.random(), roam = settled && !reduced && calm() && !placedHold;
          if (roam && roll < .25) { phase = 'walk'; dir = Math.random() < .5 ? -1 : 1; walkUntil = now + between(1500, 4000); }
          else if (roam && roll < .35) { const spot = pickRoam(x); if (spot) { home = { x: spot.x, feet: spot.y, placed: false }; flyTo(now, spot); } }
          else action = roll < .7 ? { kind: 'look', at: now, length: 1200 * (Math.random() < .5 ? 1 : 2) } : { kind: 'lean', at: now, length: LEAN_TIME * (Math.random() < .5 ? 1 : 2) };
          nextAction = now + between(5000, 9000);
        }
        if (phase === 'perch' || phase === 'walk') paint('stand', column, row, x, feet, mirror, 'feet');
        // While he roams, home is where he stands; after a tip he flies back there.
        if (!speaking && !returnAt && !placedHold && phase === 'perch') home = { x, feet, placed: false };
        if (now - lastCheck > 400 && (phase === 'perch' || phase === 'walk')) {
          lastCheck = now;
          const userSpot = home?.placed && Math.abs(home.x - x) < 4 && Math.abs(home.feet - feet) < 4;
          // Anything useful appearing under him sends him along; a place the user chose is theirs.
          if (!userSpot && !spotIsFree(document, x, feet, layer)) { const spot = speaking ? pickSpeak() : pickRoam(); if (spot) flyTo(now, spot); else takeOff(now); }
          else if (now >= leaveAt && settled && calm() && !placedHold) takeOff(now);
        }
      }
      // The tip shows once he stands where he speaks; it fades unless the mouse rests on it.
      const bubble = bubbleRef.current;
      if (bubble) {
        const show = speaking && (phase === 'perch' || phase === 'walk');
        bubble.style.visibility = show ? 'visible' : 'hidden';
        if (show) {
          placeBeside(bubble);
          if (!speaking.shownAt || hovered.current) speaking.shownAt = now;
          if (now - speaking.shownAt > p.timing.bubble && expired !== speaking.id) { expired = speaking.id; p.onExpire?.(); }
        }
      }
      // The notebook shows only once it stands beside him, never at the corner of the window.
      if (panelRef.current) { placeBeside(panelRef.current); panelRef.current.style.visibility = 'visible'; }
      if (protest && protestRef.current) placeBeside(protestRef.current);
      frame = owner.requestAnimationFrame(tick);
    };
    const run = () => { if (!frame) frame = owner.requestAnimationFrame(tick); };
    // While he is away a slow timer decides when he may come back; a waiting tip brings him at once.
    const check = () => {
      const now = performance.now(), p = latest.current;
      if (phase !== 'away' && phase !== 'held' && blocked()) { owner.cancelAnimationFrame(frame); frame = 0; speaking = null; goAway(now); return; }
      if (phase === 'away' && !blocked() && (p.tip || calm() && now >= nextAt)) {
        const spot = p.tip ? pickSpeak() : home?.placed ? { x: home.x, y: home.feet } : pickRoam();
        if (spot) {
          if (p.tip) speaking = { id: p.tip.id, moved: true, shownAt: 0 };
          else if (!home?.placed) home = { x: spot.x, feet: spot.y, placed: false };
          flyTo(now, spot); run();
        } else nextAt = now + 5000;
      }
      if (phase !== 'away') run();
    };
    const timer = owner.setInterval(check, 300);

    // Picking him up: press on his body and drag. A click without dragging opens his notebook.
    const grabStart = event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      hit.setPointerCapture?.(event.pointerId);
      grab = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    };
    const grabMove = event => {
      if (!grab || event.pointerId !== grab.id) return;
      if (!grab.moved && Math.hypot(event.clientX - grab.x, event.clientY - grab.y) < 5) return;
      const now = performance.now();
      if (!grab.moved) {
        grab.moved = true; phase = 'held'; started = now; action = null; returnAt = 0;
        hit.classList.add('held');
        if (Math.random() < visits().protest) say(now, PROTESTS[Math.floor(Math.random() * PROTESTS.length)]);
      }
      x = clamp(event.clientX, BODY_W * .3, view().width - BODY_W * .3);
      feet = clamp(event.clientY + BODY_H * .5, BODY_H * .9, view().height - 2);
      run();
    };
    const grabEnd = event => {
      if (!grab || event.pointerId !== grab.id) return;
      const moved = grab.moved, now = performance.now(); grab = null;
      hit.classList.remove('held');
      if (!moved) { latest.current.onToggleNotebook?.(); return; }
      home = { x, feet, placed: true, placedAt: now };
      settle(now, { x, y: feet });
      leaveAt = Math.max(leaveAt, now + visits().placed);
      run();
    };
    hit.addEventListener('pointerdown', grabStart);
    hit.addEventListener('pointermove', grabMove);
    hit.addEventListener('pointerup', grabEnd);
    hit.addEventListener('pointercancel', grabEnd);

    const input = event => { if (!event.target?.closest?.('.shredder-bird-hit, .shredder-ui')) lastInput = performance.now(); };
    const move = event => { pointer = { x: event.clientX, y: event.clientY }; };
    const out = event => { if (!event.relatedTarget) pointer = { x: -1e4, y: -1e4 }; };
    owner.addEventListener('pointermove', move, { capture: true, passive: true });
    owner.addEventListener('pointerdown', input, true);
    owner.addEventListener('keydown', input, true);
    owner.addEventListener('wheel', input, { capture: true, passive: true });
    owner.addEventListener('pointerout', out, true);
    return () => {
      owner.cancelAnimationFrame(frame); owner.clearInterval(timer); hide();
      hit.removeEventListener('pointerdown', grabStart); hit.removeEventListener('pointermove', grabMove);
      hit.removeEventListener('pointerup', grabEnd); hit.removeEventListener('pointercancel', grabEnd);
      owner.removeEventListener('pointermove', move, true);
      owner.removeEventListener('pointerdown', input, true);
      owner.removeEventListener('keydown', input, true);
      owner.removeEventListener('wheel', input, true);
      owner.removeEventListener('pointerout', out, true);
    };
  }, [active]);
  return active && createPortal(<div className="shredder-bird-layer" ref={layerRef}>
    <div className="shredder-bird-sprite" ref={sprite} data-phase="away" aria-hidden="true"><div/></div>
    <div className="shredder-bird-hit" ref={hitRef} role="button" aria-label="Shredder the Wise" title="Shredder the Wise - click me for my notebook, drag me wherever."/>
    <div className="shredder-ui shredder-protest" ref={protestRef} aria-hidden="true"/>
    {tipContent && <div className="shredder-ui shredder-bubble" ref={bubbleRef} role="status" aria-live="polite" data-shredder-lesson={tip?.id}
      onPointerEnter={() => { hovered.current = true; }} onPointerLeave={() => { hovered.current = false; }}>{tipContent}</div>}
    {panel && <div className="shredder-ui shredder-panel" ref={panelRef}>{panel}</div>}
  </div>, document.body);
}
