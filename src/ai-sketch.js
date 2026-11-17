// Notes drawn for the AI console: on the model (Vertices), on the UV map (UV
// Wrapper) or over the animation (Movement). They live only in this store:
// never in the model, its Undo history or saved files.

export const SKETCH_COLORS = [
  { id: 'red', value: '#ff453a' },
  { id: 'yellow', value: '#ffd60a' },
  { id: 'green', value: '#30d158' },
  { id: 'blue', value: '#0a84ff' },
];
export const SKETCH_DEFAULT_COLOR = { pen: 'red', marker: 'yellow', arrow: 'blue', hold: 'green', hit: 'red' };
// Where a note is drawn, and the tools each place offers. Every place keeps
// Marker, Pen and Eraser; Arrow points a direction (UV) or acts out a motion
// (Movement), Hold and Hit mark still parts and contact moments in time.
export const SKETCH_SPACES = {
  model: ['marker', 'pen', 'eraser'],
  uv: ['marker', 'pen', 'arrow', 'eraser'],
  motion: ['marker', 'pen', 'arrow', 'hold', 'hit', 'eraser'],
};
export const COLORED_TOOLS = ['pen', 'marker', 'arrow', 'hold', 'hit'];
export const spaceOf = stroke => stroke.space || 'model';
/** Marker reach on the UV map, in texture widths. */
export const UV_MARKER_WIDTH = 0.04;
export const UV_PEN_REACH = 0.012;
// Sizes relative to the model's framing radius, so a stroke means the same area
// on a footman and on a dragon.
export const PEN_REACH = 0.025;
export const MARKER_WIDTH = 0.08;

const MAX_VERTICES_PER_STROKE = 3000;
const MAX_POINTS_PER_STROKE = 48;

// Each model has one timeline of drawing steps and model edits, so Ctrl+Z undoes
// whatever happened last: a drawing, an erase, a clear, or (by handing back
// 'model') the model's own Undo. Drawings themselves never enter the model history.
const MAX_STEPS = 500;

export function createSketchStore() {
  let state = { tool: null, visible: false, color: { ...SKETCH_DEFAULT_COLOR }, strokes: [], nextId: 1 };
  const timelines = new Map();
  const listeners = new Set();
  const set = patch => {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener(state);
  };
  const timeline = documentId => {
    if (!timelines.has(documentId)) timelines.set(documentId, { done: [], undone: [] });
    return timelines.get(documentId);
  };
  const record = (documentId, step) => {
    const t = timeline(documentId);
    t.done.push(step);
    if (t.done.length > MAX_STEPS) t.done.shift();
    t.undone = [];
  };
  // Drawing steps: put strokes back or take them away, keeping their order by id.
  const restore = strokes => set({ strokes: [...state.strokes, ...strokes].sort((x, y) => x.id - y.id) });
  const drop = strokes => {
    const ids = new Set(strokes.map(s => s.id));
    set({ strokes: state.strokes.filter(s => !ids.has(s.id)) });
  };
  const revert = step => (step.kind === 'add' ? drop(step.strokes) : restore(step.strokes));
  const reapply = step => (step.kind === 'add' ? restore(step.strokes) : drop(step.strokes));
  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setTool: tool => set({ tool: state.tool === tool ? null : tool }),
    // Drawings show only while the AI console is open; closing it keeps them.
    setVisible: visible => state.visible !== !!visible && set({ visible: !!visible, tool: visible ? state.tool : null }),
    clearTool: () => state.tool && set({ tool: null }),
    setColor: (tool, color) => set({ color: { ...state.color, [tool]: color } }),
    colorOf: tool => SKETCH_COLORS.find(c => c.id === state.color[tool])?.value || SKETCH_COLORS[0].value,
    add(stroke) {
      const id = state.nextId,
        added = { ...stroke, id };
      set({ strokes: [...state.strokes, added], nextId: id + 1 });
      record(stroke.documentId, { kind: 'add', strokes: [added] });
      return id;
    },
    /** Erase strokes; calls with the same gesture token form one Undo step. */
    remove(ids, gesture = null) {
      const gone = state.strokes.filter(s => ids.includes(s.id));
      if (!gone.length) return;
      drop(gone);
      const byModel = new Map();
      for (const stroke of gone) byModel.set(stroke.documentId, [...(byModel.get(stroke.documentId) || []), stroke]);
      for (const [documentId, strokes] of byModel) {
        const t = timeline(documentId),
          last = t.done.at(-1);
        if (gesture && last?.kind === 'erase' && last.gesture === gesture) last.strokes.push(...strokes);
        else record(documentId, { kind: 'erase', strokes, gesture });
      }
    },
    clear(documentId) {
      const gone = state.strokes.filter(s => s.documentId === documentId);
      if (!gone.length) return;
      drop(gone);
      record(documentId, { kind: 'clear', strokes: gone });
    },
    /** A new model edit (not an Undo or Redo of one) joins this model's timeline. */
    noteModelEdit(documentId) {
      record(documentId, { kind: 'model' });
    },
    /**
     * Ctrl+Z / Ctrl+Y. Returns 'sketch' when a drawing step was undone or redone,
     * otherwise 'model': the caller runs the model's own Undo or Redo. With
     * drawingsOnly (a drawing tool is active, or the drawings' own Undo button)
     * only drawing steps are considered.
     */
    step(documentId, redo = false, { drawingsOnly = false, modelOnly = false } = {}) {
      const t = timeline(documentId),
        from = redo ? t.undone : t.done,
        to = redo ? t.done : t.undone;
      // modelOnly: drawings are hidden, so Undo goes to the model and its step moves along.
      const at = drawingsOnly
        ? from.findLastIndex(s => s.kind !== 'model')
        : modelOnly
          ? from.findLastIndex(s => s.kind === 'model')
          : from.length - 1;
      if (at < 0) return drawingsOnly ? null : 'model';
      const [step] = from.splice(at, 1);
      to.push(step);
      if (step.kind === 'model') return 'model';
      (redo ? reapply : revert)(step);
      return 'sketch';
    },
    /** Whether Ctrl+Z / Ctrl+Y would change a drawing next. */
    canStep(documentId, redo = false, { drawingsOnly = false } = {}) {
      const t = timelines.get(documentId),
        from = (redo ? t?.undone : t?.done) || [];
      return drawingsOnly ? from.some(s => s.kind !== 'model') : from.at(-1)?.kind !== undefined && from.at(-1).kind !== 'model';
    },
    undo(documentId) {
      return this.step(documentId, false, { drawingsOnly: true });
    },
    /** A model's notes; with a space, only those drawn there. */
    strokes: (documentId, space) => state.strokes.filter(s => s.documentId === documentId && (!space || spaceOf(s) === space)),
  };
}

export const sketchStore = createSketchStore();

/** Light smoothing of a hand-drawn stroke; ends stay where the user put them. */
export function smoothStroke(points, passes = 2, size = 3) {
  const count = points.length / size;
  if (count < 3) return points.slice();
  let current = Float64Array.from(points);
  for (let pass = 0; pass < passes; pass++) {
    const next = current.slice();
    for (let i = 1; i < count - 1; i++)
      for (let k = 0; k < size; k++)
        next[i * size + k] = current[i * size + k] * 0.5 + (current[i * size + k - size] + current[i * size + k + size]) * 0.25;
    current = next;
  }
  return Array.from(current);
}

function segmentDistanceSquared(px, py, pz, points, i) {
  const ax = points[i],
    ay = points[i + 1],
    az = points[i + 2];
  const bx = points[i + 3] ?? ax,
    by = points[i + 4] ?? ay,
    bz = points[i + 5] ?? az;
  const dx = bx - ax,
    dy = by - ay,
    dz = bz - az,
    length = dx * dx + dy * dy + dz * dz;
  let t = length ? ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / length : 0;
  t = Math.max(0, Math.min(1, t));
  const x = ax + dx * t - px,
    y = ay + dy * t - py,
    z = az + dz * t - pz;
  return x * x + y * y + z * z;
}

/**
 * Vertices a stroke covers: within reach of the drawn line and on the side of the
 * surface that was drawn on, so marking the front of an arm does not also take
 * its back.
 */
export function strokeVertices(stroke, model) {
  if (spaceOf(stroke) !== 'model') return {};
  const reach = stroke.tool === 'marker' ? stroke.width / 2 : stroke.reach;
  const points = stroke.points,
    normals = stroke.normals,
    surface = stroke.onSurface;
  const result = {};
  if (!points?.length || !(reach > 0)) return result;
  // Off-model pen points describe a wanted shape, not existing vertices.
  const segments = [];
  for (let i = 0; i < points.length; i += 3) if (stroke.tool === 'marker' || surface[i / 3]) segments.push(i);
  if (!segments.length) return result;
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (const i of segments)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], points[i + k] - reach);
      max[k] = Math.max(max[k], points[i + k] + reach);
    }
  const reach2 = reach * reach;
  let total = 0;
  (model?.Geosets || []).forEach((geoset, geosetIndex) => {
    if (stroke.geosets && !stroke.geosets.includes(geosetIndex)) return;
    const vertices = geoset.Vertices,
      vertexNormals = geoset.Normals,
      found = [];
    for (let v = 0; v < vertices.length / 3 && total < MAX_VERTICES_PER_STROKE; v++) {
      const x = vertices[v * 3],
        y = vertices[v * 3 + 1],
        z = vertices[v * 3 + 2];
      if (x < min[0] || y < min[1] || z < min[2] || x > max[0] || y > max[1] || z > max[2]) continue;
      let best = Infinity,
        bestIndex = -1;
      for (const i of segments) {
        const d = segmentDistanceSquared(x, y, z, points, i);
        if (d < best) {
          best = d;
          bestIndex = i;
        }
      }
      if (best > reach2) continue;
      if (vertexNormals?.length === vertices.length && normals?.length) {
        const facing =
          vertexNormals[v * 3] * normals[bestIndex] +
          vertexNormals[v * 3 + 1] * normals[bestIndex + 1] +
          vertexNormals[v * 3 + 2] * normals[bestIndex + 2];
        if (facing < -0.2) continue;
      }
      found.push(v);
      total++;
    }
    if (found.length) result[geosetIndex] = found;
  });
  return result;
}

const round = value => Math.round(value * 10) / 10;
const round3 = value => Math.round(value * 1000) / 1000;

function samplePoints(flat, size, map, extra) {
  const count = flat.length / size,
    step = Math.max(1, Math.ceil(count / MAX_POINTS_PER_STROKE)),
    points = [];
  const at = i => [...Array.from(flat.slice(i * size, i * size + size), map), ...(extra ? [extra(i)] : [])];
  for (let i = 0; i < count; i += step) points.push(at(i));
  if (count > 1 && (count - 1) % step) points.push(at(count - 1));
  return points;
}

function segmentDistanceSquared2(px, py, points, i) {
  const ax = points[i],
    ay = points[i + 1],
    bx = points[i + 2] ?? ax,
    by = points[i + 3] ?? ay,
    dx = bx - ax,
    dy = by - ay,
    length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0;
  return (ax + dx * t - px) ** 2 + (ay + dy * t - py) ** 2;
}

/**
 * UV points a UV-map note covers, mapped back to the model: a Marker takes what
 * it painted over, a Pen what its line runs through, an Arrow the piece under
 * its tail (what it says to move). `uv` is the map's flat [u, v] list, `refs`
 * names each entry's geoset and vertex.
 */
export function uvStrokeVertices(stroke, uv, eligible, refs) {
  const points = stroke.points,
    result = {};
  if (!points?.length || !uv?.length) return result;
  const reach = stroke.tool === 'marker' ? stroke.width / 2 : stroke.reach,
    reach2 = reach * reach;
  // The arrow's tail: its first stretch only.
  const last = stroke.tool === 'arrow' ? Math.min(points.length - 2, 4) : points.length - 2;
  let total = 0;
  for (const index of eligible) {
    if (total >= MAX_VERTICES_PER_STROKE) break;
    const u = uv[index * 2],
      v = uv[index * 2 + 1];
    let near = false;
    for (let i = 0; i <= last && !near; i += 2) near = segmentDistanceSquared2(u, v, points, i) <= reach2;
    if (!near) continue;
    const ref = refs?.[index] || { geosetIndex: 0, vertexIndex: index };
    (result[ref.geosetIndex] ||= []).push(ref.vertexIndex);
    total++;
  }
  return result;
}

/**
 * How far a drawn line turns around a point on screen, in degrees: positive
 * counter-clockwise as the user saw it. Small wobbles cancel out, so only a
 * stroke that really circles the joint reads as a turn.
 */
export function sweptAngle(points, pivot) {
  let total = 0,
    previous = null;
  for (let i = 0; i < points.length; i += 2) {
    const dx = points[i] - pivot[0],
      dy = points[i + 1] - pivot[1];
    if (Math.hypot(dx, dy) < 4) continue;
    // Screen y grows downward; flip it so counter-clockwise is positive.
    const angle = Math.atan2(-dy, dx);
    if (previous !== null) {
      let step = angle - previous;
      if (step > Math.PI) step -= Math.PI * 2;
      if (step < -Math.PI) step += Math.PI * 2;
      total += step;
    }
    previous = angle;
  }
  return Math.round((total * 180) / Math.PI);
}

/**
 * The acted-out pace of an Arrow: its drawn length split into five equal stretches
 * of time, each the share of the motion covered then (1 = even speed). A slow
 * start and end read as [0.4, 1.2, 1.8, 1.2, 0.4].
 */
export function speedProfile(points, times, parts = 5) {
  const count = points.length / 3;
  if (count < 2 || !times?.length) return null;
  const travelled = [0];
  for (let i = 1; i < count; i++)
    travelled.push(travelled[i - 1] + Math.hypot(points[i * 3] - points[i * 3 - 3], points[i * 3 + 1] - points[i * 3 - 2], points[i * 3 + 2] - points[i * 3 - 1]));
  const length = travelled.at(-1),
    duration = times.at(-1) - times[0];
  if (!(length > 0) || !(duration > 0)) return null;
  const distanceAt = time => {
    const i = times.findIndex(t => t >= time);
    if (i <= 0) return i === 0 ? 0 : length;
    const span = times[i] - times[i - 1];
    return travelled[i - 1] + (span ? (travelled[i] - travelled[i - 1]) * (time - times[i - 1]) / span : 0);
  };
  const profile = [];
  for (let k = 0; k < parts; k++) {
    const from = distanceAt(times[0] + (duration * k) / parts),
      to = distanceAt(times[0] + (duration * (k + 1)) / parts);
    profile.push(Math.round(((to - from) / length) * parts * 10) / 10);
  }
  return profile;
}

const ABOUT = {
  model: 'Drawn on the model in Vertices view (model space). Pen = scribble/outline, possibly a wanted shape drawn off the surface. Marker = highlighted surface region.',
  uv: 'Drawn on the UV Wrapper map ([u, v] texture coordinates, v down as in Warcraft). Marker = UV area, Pen = line or outline on the texture, Arrow = move or stretch the piece under its tail toward its head.',
  motion:
    'Drawn over the animation in the Movement view, at the frame shown (model space, through the camera). Pen = a line of action or wanted shape at that frame. Marker = the parts to change. Arrow = an acted-out motion: the user dragged it while the animation ran in real time, so each point carries the frame it was drawn at; follow its path for the part it starts on and its pace (speedProfile, 1 = even speed). turnDegrees (counter-clockwise as seen from viewDirection) means the arrow circles the joint: a rotation. Hold = keep this part still (planted foot, gripping hand). Hit = a contact or impact moment at that frame.',
};

function motionContext(stroke) {
  const timed = stroke.tool === 'arrow' && stroke.frames?.length === stroke.points.length / 3;
  const context = {
    animation: stroke.sequenceName ?? null,
    frame: stroke.frame,
    ...(timed ? { endFrame: stroke.frames.at(-1) } : {}),
    ...(stroke.part ? { part: stroke.part.name, partId: stroke.part.id } : {}),
    ...(stroke.parts?.length ? { parts: stroke.parts.map(part => part.name), partIds: stroke.parts.map(part => part.id) } : {}),
    points: samplePoints(stroke.points, 3, round, timed ? i => stroke.frames[i] : null),
    ...(timed ? { pointFormat: '[x, y, z, frame]', speedProfile: speedProfile(stroke.points, stroke.times) } : {}),
    ...(Number.isFinite(stroke.turn) && Math.abs(stroke.turn) >= 45 ? { turnDegrees: stroke.turn } : {}),
    viewDirection: stroke.view?.map(value => Math.round(value * 100) / 100),
  };
  return context;
}

/** Plain description of the drawings for the AI context. */
export function sketchContext(strokes, model) {
  if (!strokes?.length) return null;
  const spaces = [...new Set(strokes.map(spaceOf))];
  return {
    about: `The user drew these notes in the AI console. They are not part of the model. Colors are the user's own labels. ${spaces.map(space => ABOUT[space]).join(' ')}`,
    strokes: strokes.map((stroke, index) => {
      const base = { number: index + 1, tool: stroke.tool, color: stroke.color };
      const space = spaceOf(stroke);
      if (space === 'uv')
        return {
          ...base,
          place: 'uv map',
          points: samplePoints(stroke.points, 2, round3),
          ...(stroke.tool === 'marker' ? { width: round3(stroke.width) } : {}),
          [stroke.tool === 'marker' ? 'markedUVPoints' : stroke.tool === 'arrow' ? 'pieceUnderTail' : 'nearbyUVPoints']: stroke.vertices || {},
          uvPointFormat: '{ geoset: [vertex indices] }',
        };
      if (space === 'motion') return { ...base, place: 'animation', ...motionContext(stroke) };
      const count = stroke.points.length / 3;
      const onModel = stroke.onSurface.filter(Boolean).length;
      const vertices = strokeVertices(stroke, model);
      return {
        ...base,
        points: samplePoints(stroke.points, 3, round),
        pointsOnModel: onModel + ' of ' + count,
        ...(stroke.tool === 'marker' ? { width: round(stroke.width) } : {}),
        viewDirection: stroke.view?.map(value => Math.round(value * 100) / 100),
        [stroke.tool === 'marker' ? 'markedVertices' : 'nearbyVertices']: vertices,
      };
    }),
  };
}
