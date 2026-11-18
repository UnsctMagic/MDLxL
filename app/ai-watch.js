// View AI work (the console's switch): which model tab, animation, frame, view and
// part the live editor follows while the AI works. Every path here runs only while
// the switch is on; see AiEditorBridge.follow in ai-editor.js.
import { createFrameCoalescer } from './viewport-performance.js';

// What one finished tool call looked at, as a view change for the live editor:
// { view, sequence, globalSequence, frame, focus }. focus names the vertices or
// geosets to keep in view: { vertices } / { geosets } / { selection: true }.
// Null when the call looked at nothing new.
export function watchLook(name, args = {}, result) {
  const look = {};
  const timing = source => {
    if (source.view) look.view = source.view;
    if (source.globalSequence != null) look.globalSequence = source.globalSequence;
    else if (source.sequence !== undefined) Object.assign(look, { sequence: source.sequence, globalSequence: null });
    if (Number.isFinite(source.frame)) look.frame = source.frame;
  };
  const focus = ({ vertices, geosets, selection }) => {
    if (vertices && Object.keys(vertices).length) look.focus = { vertices };
    else if (geosets?.length) look.focus = { geosets: [...geosets] };
    else if (selection) look.focus = { selection: true };
  };
  if (name === 'mdlxl_capture') {
    // The last picture of the call is what the AI saw last; flat UV layouts have no 3D view.
    const sample = (Array.isArray(args.samples) ? args.samples : []).filter(s => s && !s.uv).at(-1);
    if (!sample) return null;
    timing(sample);
    focus({ vertices: sample.vertices, geosets: sample.geosets, selection: sample.fit === 'selection' });
  } else if (name === 'mdlxl_sample') {
    if (args.sweep) return null;
    timing({ sequence: args.sequence, globalSequence: args.globalSequence, frame: Array.isArray(args.frames) ? args.frames.at(-1) : undefined });
    focus({ vertices: args.vertices, geosets: args.geosetIds });
  } else if (name === 'mdlxl_view') timing(args);
  else if ((name === 'mdlxl_script' || name === 'mdlxl_patch') && result?.applied) {
    const geosets = changedGeosetIndices(result.changes);
    if (geosets.length) look.focus = { geosets };
  } else return null;
  return Object.keys(look).length ? look : null;
}

// The geoset indices an edit's change list touched (same rule as the saved chat's).
export function changedGeosetIndices(changes) {
  const found = new Set();
  for (const change of Array.isArray(changes) ? changes : []) {
    const match = /^\/Geosets(?:\/(\d+))?(?:\/|$)/.exec(change?.path || '');
    if (!match) continue;
    if (match[1] !== undefined) found.add(Number(match[1]));
    else if (change.kind === 'splice' && Number.isInteger(change.index))
      for (let i = 0; i < Math.min(change.added || 0, 64); i++) found.add(change.index + i);
  }
  return [...found].sort((a, b) => a - b);
}

// At most `limit` vertex ids per geoset, spread evenly: enough to frame a part, cheap to pose.
export function spreadVertices(selection, limit = 400) {
  const out = {};
  for (const [geoset, ids] of Object.entries(selection || {})) {
    const list = Array.from(ids || []);
    if (!list.length) continue;
    const step = Math.max(1, Math.ceil(list.length / limit));
    out[geoset] = list.filter((_, i) => i % step === 0);
  }
  return out;
}

// Whether a part needs a fit: fewer than half of its points are on screen.
// project([x, y, z]) returns normalized device coordinates.
export function needsFit(points, project) {
  if (!points?.length || points.length < 3) return false;
  let inside = 0, total = 0;
  for (let i = 0; i + 2 < points.length; i += 3) {
    const [x, y, z] = project([points[i], points[i + 1], points[i + 2]]);
    total++;
    if (Math.abs(x) <= 1 && Math.abs(y) <= 1 && z >= -1 && z <= 1) inside++;
  }
  return inside * 2 < total;
}

// While watching, the user's own selection or animation change on the AI's tab is not an
// edit: the job adopts it instead of moving to a private copy. Only a model change forks.
// Returns 'fork', 'adopt' or 'keep'.
export function watchTargetRule({ watching, sourceChanged, onScreen, selectionChanged }) {
  if (sourceChanged) return 'fork';
  if (!onScreen || !selectionChanged) return 'keep';
  return watching ? 'adopt' : 'fork';
}

// The tab to show when a call works on `documentId`: once per target change, so a user who
// switches away on purpose is not pulled back until the AI moves to another model.
export function tabToShow(state, documentId, activeId, isTab) {
  if (!documentId || state.shown === documentId) return null;
  state.shown = documentId;
  return documentId !== activeId && isTab ? documentId : null;
}

// Applies the newest request once per display frame; older requests in the same frame are
// dropped. `apply` may be async: a request made meanwhile waits for the next frame after it.
export function createWatchFollower(apply, frames) {
  let pending = null, busy = false;
  const coalescer = createFrameCoalescer(async () => {
    if (busy || !pending) return;
    const next = pending;
    pending = null;
    busy = true;
    try {
      await apply(next);
    } catch {}
    busy = false;
    if (pending) coalescer.schedule();
  }, frames);
  return {
    push(request) {
      pending = request;
      if (!busy) coalescer.schedule();
    },
    cancel() {
      pending = null;
      coalescer.cancel();
    },
    get pending() {
      return !!pending;
    },
  };
}
