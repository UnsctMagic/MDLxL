/** Renderer-only, session-only activity. Never part of AI context, model or history. */
export const ACTIVITY_VERTEX_LIMIT = 512;
export const ACTIVITY_GEOSET_LIMIT = 32;
const CHANGE_MS = 1100;
const RUN_MS = 30000;

// A declared scope is only a possible area, never a script's imagined execution order.
export function activityTarget(model, scope = [], selection = {}) {
  const areas = new Map();
  for (const path of scope) {
    const match = /^\/Geosets(?:\/(\d+)(?:\/(.*))?)?$/.exec(path);
    if (!match) continue;
    const indices = match[1] === undefined ? model.Geosets.map((_, i) => i) : [Number(match[1])];
    for (const geoset of indices) {
      if (!model.Geosets[geoset] || areas.size >= ACTIVITY_GEOSET_LIMIT) continue;
      // Only an explicitly narrow Vertices scope with a known selection gets points.
      // A whole-geoset/model scope remains coarse even when vertices are selected.
      const ids = selection[geoset];
      const vertices = match[2] === 'Vertices' && ids?.length && ids.length <= ACTIVITY_VERTEX_LIMIT
        ? [...new Set(ids)].filter(i => Number.isInteger(i) && i >= 0 && i * 3 < model.Geosets[geoset].Vertices.length)
        : null;
      const previous = areas.get(geoset);
      areas.set(geoset, { geoset, vertices: previous?.vertices === null ? null : vertices?.length ? vertices : null });
    }
  }
  let count = 0;
  return [...areas.values()].map(area => {
    count += area.vertices?.length || 0;
    return count > ACTIVITY_VERTEX_LIMIT ? { ...area, vertices: null } : area;
  });
}

// Use the commit validator's untruncated deltas and the existing pre-edit snapshot.
// No extra model copies or byte-range-as-vertex approximations.
export function changedActivity(before, after, changes) {
  const candidates = new Map(), uncertainGeosets = new Set();
  for (const { path } of changes)
    if (path[0] === 'Geosets' && ['Faces', 'VertexGroup', 'Groups', 'SkinWeights', 'TVertices', 'Normals'].includes(path[2])) uncertainGeosets.add(Number(path[1]));
  for (const change of changes) {
    const [section, key, field] = change.path;
    if (section !== 'Geosets') continue;
    if (key === undefined) {
      const start = change.kind === 'splice' ? change.index : 0;
      for (let i = start; i < after.Geosets.length && candidates.size < ACTIVITY_GEOSET_LIMIT; i++) candidates.set(i, true);
    } else if (after.Geosets[key] && (field === undefined || ['Vertices', 'Faces'].includes(field))) {
      const coarse = field !== 'Vertices' || change.kind !== 'bytes' || uncertainGeosets.has(Number(key));
      if (candidates.has(Number(key)) || candidates.size < ACTIVITY_GEOSET_LIMIT)
        candidates.set(Number(key), candidates.get(Number(key)) || coarse);
    }
  }
  const areas = [];
  let count = 0;
  for (const [geoset, uncertain] of candidates) {
    const a = before.Geosets[geoset]?.Vertices, b = after.Geosets[geoset]?.Vertices;
    if (!b?.length) continue;
    if (uncertain || !a || a.length !== b.length) {
      areas.push({ geoset, vertices: null }); continue;
    }
    const vertices = [];
    for (let i = 0; i < b.length; i += 3) {
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) {
        vertices.push(i / 3);
        if (count + vertices.length > ACTIVITY_VERTEX_LIMIT) break;
      }
    }
    if (vertices.length) {
      const coarse = count + vertices.length > ACTIVITY_VERTEX_LIMIT;
      areas.push({ geoset, vertices: coarse ? null : vertices });
      if (!coarse) count += vertices.length;
    }
  }
  return areas;
}

export function createAiActivity({ now = () => performance.now(), schedule = setTimeout, cancel = clearTimeout } = {}) {
  let enabled = false, generation = 0, serial = 0, timer = null;
  const entries = new Map(), listeners = new Set();
  const notify = () => { for (const listener of listeners) listener(); };
  function expire() {
    timer = null;
    for (const [id, entry] of entries) if (entry.until <= now()) entries.delete(id);
    notify(); arm();
  }
  function arm() {
    if (timer !== null) cancel(timer);
    timer = null;
    if (entries.size) timer = schedule(expire, Math.max(0, Math.min(...[...entries.values()].map(e => e.until)) - now()));
  }
  function remove(token) {
    if (token && entries.delete(token.id)) { arm(); notify(); }
  }
  return {
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    enabled: () => enabled,
    setEnabled(value) {
      if (enabled === value) return;
      enabled = value; generation++; entries.clear(); arm(); notify();
    },
    begin(documentId, doc, areas, signal) {
      if (!enabled || signal?.aborted) return null;
      const token = { id: ++serial, documentId, doc, revision: doc.revision, generation, signal };
      const stop = () => remove(token);
      signal?.addEventListener('abort', stop, { once: true });
      token.detach = () => signal?.removeEventListener('abort', stop);
      if (areas.length) {
        if (entries.size >= 16) entries.delete(entries.keys().next().value);
        entries.set(token.id, { ...token, phase: 'target', areas, started: now(), until: now() + RUN_MS });
        arm(); notify();
      }
      return token;
    },
    finish(token, areas, doc) {
      if (!token) return;
      remove(token);
      if (!enabled || token.generation !== generation || token.signal?.aborted || token.doc !== doc || doc.revision !== token.revision + 1 || !areas.length) return;
      if (entries.size >= 16) entries.delete(entries.keys().next().value);
      entries.set(token.id, { ...token, revision: doc.revision, phase: 'applied', areas, started: now(), until: now() + CHANGE_MS });
      arm(); notify();
    },
    end(token, succeeded) {
      token?.detach();
      if (!succeeded) remove(token);
    },
    reconcile(sessions) {
      let removed = false;
      for (const [id, entry] of entries) {
        const session = sessions.find(s => s.id === entry.documentId);
        if (!session || session.doc !== entry.doc || session.doc.revision !== entry.revision) {
          entries.delete(id); removed = true;
        }
      }
      if (removed) { arm(); notify(); }
    },
    visible(documentId, revision) {
      if (!enabled) return [];
      return [...entries.values()].filter(e => e.documentId === documentId && e.revision === revision && e.until > now());
    },
  };
}
export const aiActivity = createAiActivity();
