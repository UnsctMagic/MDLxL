// View AI work: the clock and the one current replay that every view draws from.
// The AI never waits for it: start() returns at once, a newer step replaces an older
// replay, and nothing here touches model data (see src/ai-replay.js).
import { planReplay, REPLAY_MAX_MS, REPLAY_MIN_MS } from '../src/ai-replay.js';

// How long a view may keep showing the picture from before an edit while the edit's
// replay has not started yet (the edit is on the model, its tool call is still returning).
export const REPLAY_HOLD_MS = 300;
// A look (the AI inspected a part without changing it) shows the marker only.
const LOOK_MS = 700;

export function createAiReplay({ now = () => performance.now(), setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id) } = {}) {
  let armed = null, current = null, serial = 0, timer = 0, color = '#ff1a20';
  const listeners = new Set();
  const notify = reason => {
    for (const listener of [...listeners])
      try {
        listener(reason);
      } catch {}
  };
  const end = () => {
    clearTimer(timer);
    timer = 0;
    if (!current) return;
    current = null;
    serial++;
    notify('end');
  };
  const begin = (documentId, revision, plan) => {
    clearTimer(timer);
    // An older replay still running is dropped: the newest step is the one on screen.
    current = { id: ++serial, documentId, revision, plan, startedAt: now(), ms: Math.min(REPLAY_MAX_MS, Math.max(plan.look ? LOOK_MS : REPLAY_MIN_MS, plan.ms)) };
    timer = setTimer(end, current.ms + 40);
    notify('start');
    return current.id;
  };
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // Changes when a replay starts or ends (for useSyncExternalStore).
    version: () => serial,
    // Before an edit that may change the model on screen: views keep their current picture.
    arm(documentId, revision) {
      armed = { documentId, revision, at: now() };
      notify('arm');
      return armed;
    },
    disarm(token) {
      if (armed !== token || !token) return;
      armed = null;
      notify('disarm');
    },
    // After the edit: plays it from `before` to `after`. Returns the replay id, or 0 when
    // the edit changed nothing a view can show.
    play(token, before, after, { documentId, revision, assets, sequence } = {}) {
      const wasArmed = armed === token && !!token;
      if (wasArmed) armed = null;
      let plan = null;
      try {
        plan = planReplay(before, after, { assets, sequence });
      } catch {}
      if (!plan) {
        if (wasArmed) notify('disarm');
        return 0;
      }
      return begin(documentId, revision, plan);
    },
    // The AI inspected a part: the marker hovers there briefly. Never replaces a replay.
    look(documentId, revision, focus, focusPosed = null) {
      if (current && !current.plan.look) return 0;
      if (!Array.isArray(focus) || focus.length < 3 || !focus.every(Number.isFinite)) return 0;
      return begin(documentId, revision, { look: true, ms: LOOK_MS, focus, focusPosed, glides: [], grows: [], uvs: [], ghosts: [], pivots: [], emitters: [], bones: [], glow: [], keyFrames: [], span: null, fade: null });
    },
    stop() {
      const token = armed;
      armed = null;
      if (current) end();
      else if (token) notify('disarm');
    },
    // The replay at time `at`: { id, plan, p, documentId, revision }, or null.
    sample(at = now()) {
      if (!current) return null;
      return { id: current.id, plan: current.plan, documentId: current.documentId, revision: current.revision, p: Math.min(1, Math.max(0, (at - current.startedAt) / current.ms)) };
    },
    get armed() {
      return armed;
    },
    get active() {
      return !!current;
    },
    // The marker and glow take the AI head's eye colour (app/ThumperHead.jsx).
    get color() {
      return color;
    },
    setColor(next) {
      if (typeof next === 'string' && /^#[0-9a-f]{6}$/i.test(next)) color = next;
    },
  };
}

export const aiReplay = createAiReplay();
