/** Timing of the Settings preview scenes. DOM-free: the window parts are injected,
 * so the three-loops-then-rest contract can be tested without a browser. */

/** A demo plays this many loops when its target or value changes, then rests. */
export const LOOPS = 3;
/** Share of each loop before the gesture starts and after it ends. */
const LEAD = .08, HOLD = .14;

export const clamp01 = value => Math.max(0, Math.min(1, value));
export const ease = t => t * t * (3 - 2 * t);

/** Where a run is after `elapsed` ms. `phase` is 0-1 within the loop; a finished run rests at exactly 1. */
export function loopProgress(elapsed, duration, loops = LOOPS) {
  if (elapsed >= duration * loops) return { phase: 1, done: true };
  return { phase: elapsed % duration / duration, done: false };
}

/** The gesture's own time (0-1) inside a loop: a short lead-in, the gesture, then a hold on its end. */
export const gestureAt = phase => clamp01((phase - LEAD) / (1 - LEAD - HOLD));

/** How visible the cursor is: fades in during the lead-in, stays on through the rest. */
export const cursorFade = phase => phase >= 1 ? 1 : clamp01(phase / LEAD);

/** One requestAnimationFrame loop. Calls `onPhase` per frame and stops by itself at rest.
 * Time does not pass while the document is hidden. Returns stop(). */
export function runLoop({ duration, loops = LOOPS, request, cancel, doc, onPhase }) {
  let frame = 0, elapsed = 0, previous = null, stopped = false, done = false;
  const tick = now => {
    frame = 0;
    if (stopped || doc?.hidden) { previous = null; return; }
    if (previous !== null) elapsed += now - previous;
    previous = now;
    const progress = loopProgress(elapsed, duration, loops);
    done = progress.done;
    onPhase(progress.phase);
    if (!done) frame = request(tick);
  };
  const visibility = () => {
    if (doc.hidden) { if (frame) cancel(frame); frame = 0; previous = null; }
    else if (!done && !stopped && !frame) frame = request(tick);
  };
  doc?.addEventListener('visibilitychange', visibility);
  frame = request(tick);
  return () => {
    stopped = true;
    if (frame) cancel(frame);
    frame = 0;
    doc?.removeEventListener('visibilitychange', visibility);
  };
}
