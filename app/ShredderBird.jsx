import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import standArt from './assets/shredder/stand.png';
import wingsArt from './assets/shredder/wings.png';
import movesArt from './assets/shredder/moves.png';

// Sprite cells from the LowPolyWorks visitor: standing/walking 192×208, flight 240×240.
const BODY_W = 66, BODY_H = BODY_W * 208 / 192, FLIGHT = BODY_W * 1.64, FEET = .916;
const SHEETS = {
  stand: { src: standArt, cols: 8, rows: 11, w: BODY_W, h: BODY_H },
  moves: { src: movesArt, cols: 16, rows: 10, w: BODY_W, h: BODY_H },
  wings: { src: wingsArt, cols: 4, rows: 2, w: FLIGHT, h: FLIGHT },
};
// Row 8 holds a head lean one way and the other, as [column, beats].
const LEAN = [[0, 2], [5, 1], [4, 3], [5, 1], [0, 2], [6, 1], [7, 3], [6, 1]], LEAN_BEAT = 220;
const LEAN_TIME = LEAN.reduce((total, [, beats]) => total + beats, 0) * LEAN_BEAT;
const HOP = [110, 150, 200, 90], HOP_TIME = HOP.reduce((a, b) => a + b, 0); // moves row 7: look, crouch, spring
const between = (low, high) => low + Math.random() * (high - low);
const ease = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * ease(t);
function leanColumn(time) {
  let beat = Math.floor(time % LEAN_TIME / LEAN_BEAT);
  for (const [column, beats] of LEAN) { if (beat < beats) return column; beat -= beats; }
  return 0;
}
function hopColumn(age) { let left = age; for (let column = 0; column < HOP.length; column++) { if (left < HOP[column]) return column; left -= HOP[column]; } return HOP.length - 1; }

/** Only the 3D view's own picture may be under him; any control, label, panel or tip blocks a spot. */
const OPEN_GROUND = 'canvas, .viewport, .viewport-area, .viewport-host, .classic-view';
const SCARE = 110, STARTLE = 170, ACTIVE = 2500;
export function spotIsFree(document, x, feet, layer) {
  const left = x - BODY_W / 2 - 8, right = x + BODY_W / 2 + 8, top = feet - BODY_H * .85 - 8;
  for (const px of [left, (left + x) / 2, x, (x + right) / 2, right]) for (const py of [top, (top + feet) / 2, feet - 3]) {
    const hit = document.elementFromPoint(px, py);
    if (!hit || layer?.contains(hit) || !hit.matches(OPEN_GROUND) || !hit.closest('.classic-view')) return false;
  }
  return true;
}

/**
 * Shredder himself: he perches on the bottom edge of the 3D view, looks around,
 * walks a little and flies off now and then. He is never in the way: clicks
 * pass through him, he only moves while the user pauses, and he flies away
 * when the mouse comes near, a window opens, or anything useful would be under him.
 */
export default function ShredderBird({ active, quiet, speaking, timing }) {
  const sprite = useRef(null), latest = useRef({});
  latest.current = { quiet, speaking, timing };
  useEffect(() => {
    const bird = sprite.current, owner = bird?.ownerDocument?.defaultView;
    if (!active || !bird || !owner) return;
    const document = owner.document, layer = bird.parentElement, picture = bird.firstElementChild;
    const reduced = owner.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const visits = () => latest.current.timing.bird;
    let phase = 'away', started = 0, nextAt = performance.now() + visits().first, leaveAt = 0, frame = 0, timer = 0;
    let x = 0, feet = 0, dir = 1, flight = null, action = null, nextAction = 0, steps = 0, walkUntil = 0;
    let lastInput = performance.now(), pointer = { x: -1e4, y: -1e4 }, lastCheck = 0, last = 0;

    const ledge = () => { const view = document.querySelector('.classic-view'); const rect = view?.getBoundingClientRect(); return rect && rect.width > 200 && rect.height > 150 ? rect : null; };
    /** Free stretches of the ledge, each a [min, max] range of x. */
    const stretches = () => {
      const rect = ledge(); if (!rect) return [];
      const out = []; let run = null;
      for (let px = rect.left + BODY_W; px <= rect.right - BODY_W; px += 8) {
        if (spotIsFree(document, px, rect.bottom - 1, layer)) { if (run) run[1] = px; else run = [px, px]; }
        else if (run) { out.push(run); run = null; }
      }
      if (run) out.push(run);
      return out.filter(([a, b]) => b - a >= 16).map(([a, b]) => [a, b, rect.bottom - 1]);
    };
    const pick = () => {
      const list = stretches();
      if (!list.length) return null;
      // He prefers the right-hand end, near his place in the status bar.
      const [a, b, y] = list[Math.random() < .6 ? list.length - 1 : Math.floor(Math.random() * list.length)];
      return { x: between(a + 4, b - 4), y };
    };
    const calm = () => performance.now() - lastInput > ACTIVE;
    const blocked = () => { const p = latest.current; return p.quiet || document.hidden || !!document.querySelector('[role="dialog"][aria-modal="true"]'); };

    const paint = (sheet, column, row, cx, cy, mirror, anchor) => {
      const s = SHEETS[sheet];
      bird.style.width = s.w + 'px'; bird.style.height = s.h + 'px';
      bird.style.transform = `translate(${cx - s.w / 2}px, ${anchor === 'feet' ? cy - s.h * FEET : cy - s.h / 2}px)`;
      picture.style.backgroundImage = `url("${s.src}")`;
      picture.style.backgroundSize = `${s.cols * 100}% ${s.rows * 100}%`;
      picture.style.backgroundPosition = `${-column * s.w}px ${-row * s.h}px`;
      picture.style.transform = mirror ? 'scaleX(-1)' : '';
      bird.style.visibility = 'visible';
    };
    const hide = () => { bird.style.visibility = 'hidden'; };
    const goAway = now => { phase = 'away'; hide(); nextAt = now + between(...visits().away); bird.dataset.phase = phase; };
    const takeOff = (now, urgent = false) => {
      if (reduced) { goAway(now); return; }
      flight = { x, y: feet - BODY_H * .5, speed: urgent ? 560 : 260, lift: urgent ? 300 : 140 };
      phase = urgent ? 'escape' : 'hop'; started = now;
    };
    const flyTo = (now, spot, from = null) => {
      dir = from ? (spot.x >= from.x ? 1 : -1) : (spot.x > owner.innerWidth / 2 ? 1 : -1);
      const start = from || { x: spot.x - dir * Math.min(420, owner.innerWidth * .4), y: spot.y - 260 };
      flight = { from: start, to: spot, duration: from ? 750 : 1400 };
      phase = reduced ? 'perch' : 'arrive'; started = now;
      if (reduced) { x = spot.x; feet = spot.y; leaveAt = now + between(...visits().perch); }
    };
    const scare = (now, away) => { dir = away; takeOff(now, true); };

    const tick = now => {
      frame = 0;
      bird.dataset.phase = phase;
      if (phase === 'away') return;
      const age = now - started;
      if (phase === 'arrive') {
        const t = Math.min(1, age / flight.duration), { from, to } = flight;
        if (t >= 1) { x = to.x; feet = to.y; phase = 'perch'; started = now; leaveAt = Math.max(leaveAt, now + between(...visits().perch)); nextAction = now + between(1500, 3500); }
        else {
          const cx = mix(from.x, to.x, t), cy = mix(from.y, to.y - BODY_H * .5, t) - Math.sin(t * Math.PI) * (flight.duration > 1000 ? 40 : 24);
          paint('wings', Math.floor(age / 110) % 4, Math.floor(age / 110) % 8 >= 4 ? 1 : 0, cx, cy, dir < 0, 'center');
        }
      }
      if (phase === 'hop') {
        if (age < HOP_TIME) paint('moves', hopColumn(age), 7, x, feet, dir < 0, 'feet');
        else { phase = 'fly'; started = now; }
      }
      if (phase === 'fly' || phase === 'escape') {
        const t = (now - started) / 1000;
        const cx = flight.x + dir * (flight.speed * t + 240 * t * t), cy = flight.y - flight.lift * t - 280 * t * t;
        paint('wings', Math.floor(t * 1000 / 110) % 4, Math.floor(t * 1000 / 110) % 8 >= 4 ? 1 : 0, cx, cy, dir < 0, 'center');
        if (cx < -FLIGHT || cx > owner.innerWidth + FLIGHT || cy < -FLIGHT || t > 2.6) goAway(now);
      }
      if (phase === 'perch' || phase === 'walk') {
        // Walking only while the user pauses; he stands still while they work.
        if (phase === 'walk' && (!calm() || now >= walkUntil)) { phase = 'perch'; nextAction = now + between(3000, 6000); }
        let column = Math.floor(now / 440) % 6, row = 0, mirror = false;
        if (phase === 'walk') {
          const step = dir * 14 * Math.min(40, now - (last || now)) / 1000, next = x + step;
          if (spotIsFree(document, next + dir * 6, feet, layer)) { x = next; steps += Math.abs(step); }
          else { phase = 'perch'; nextAction = now + between(2500, 5000); }
          row = 1; column = Math.floor(steps / 2.6) % 8; mirror = dir < 0;
        } else if (action) {
          const t = now - action.at;
          if (t >= action.length) action = null;
          else if (action.kind === 'lean') { row = 8; column = leanColumn(t); }
          else { row = 5; column = Math.floor(t / 150) % 8; }
        } else if (now >= nextAction) {
          const roll = Math.random();
          if (!reduced && calm() && roll < .3) { phase = 'walk'; dir = Math.random() < .5 ? -1 : 1; walkUntil = now + between(1500, 4000); }
          else action = roll < .65 ? { kind: 'look', at: now, length: 1200 * (Math.random() < .5 ? 1 : 2) } : { kind: 'lean', at: now, length: LEAN_TIME * (Math.random() < .5 ? 1 : 2) };
          nextAction = now + between(5000, 9000);
        }
        paint('stand', column, row, x, feet, mirror, 'feet');
        // A spot can stop being free: a tip, a panel or a resized window. He moves along or leaves.
        if (now - lastCheck > 400) {
          lastCheck = now;
          if (!spotIsFree(document, x, feet, layer)) { const spot = pick(); if (spot && calm()) flyTo(now, spot, { x, y: feet - BODY_H * .5 }); else takeOff(now, true); }
          else if (now >= leaveAt && !latest.current.speaking && calm()) takeOff(now);
        }
        if (Math.hypot(pointer.x - x, pointer.y - (feet - BODY_H / 2)) < SCARE) scare(now, pointer.x < x ? 1 : -1);
      }
      last = now;
      frame = owner.requestAnimationFrame(tick);
    };
    const run = () => { if (!frame) frame = owner.requestAnimationFrame(tick); };
    // While he is away a slow timer decides when he may come back.
    const check = () => {
      const now = performance.now();
      if (phase !== 'away' && blocked()) { owner.cancelAnimationFrame(frame); frame = 0; goAway(now); }
      if (phase === 'away' && !blocked() && calm() && (now >= nextAt || latest.current.speaking && now >= nextAt - 60000)) {
        const spot = pick(); if (spot) { flyTo(now, spot); run(); } else nextAt = now + 5000;
      }
      if (phase !== 'away') run();
    };
    timer = owner.setInterval(check, 500);
    const input = () => { lastInput = performance.now(); };
    const move = event => { pointer = { x: event.clientX, y: event.clientY }; };
    const down = event => {
      input();
      if ((phase === 'perch' || phase === 'walk') && Math.hypot(event.clientX - x, event.clientY - (feet - BODY_H / 2)) < STARTLE) scare(performance.now(), event.clientX < x ? 1 : -1);
    };
    const leaveWindow = event => { if (!event.relatedTarget) pointer = { x: -1e4, y: -1e4 }; };
    owner.addEventListener('pointermove', move, { capture: true, passive: true });
    owner.addEventListener('pointerdown', down, true);
    owner.addEventListener('keydown', input, true);
    owner.addEventListener('wheel', input, { capture: true, passive: true });
    owner.addEventListener('pointerout', leaveWindow, true);
    return () => {
      owner.cancelAnimationFrame(frame); owner.clearInterval(timer); hide();
      owner.removeEventListener('pointermove', move, true);
      owner.removeEventListener('pointerdown', down, true);
      owner.removeEventListener('keydown', input, true);
      owner.removeEventListener('wheel', input, true);
      owner.removeEventListener('pointerout', leaveWindow, true);
    };
  }, [active]);
  return active && createPortal(<div className="shredder-bird-layer" aria-hidden="true"><div className="shredder-bird-sprite" ref={sprite} data-phase="away"><div/></div></div>, document.body);
}
