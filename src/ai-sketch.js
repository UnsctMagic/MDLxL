// Pen and Marker notes drawn on the model for the AI console. They live only in
// this store: never in the model, its Undo history or saved files.

export const SKETCH_COLORS = [
  { id: 'red', value: '#ff453a' },
  { id: 'yellow', value: '#ffd60a' },
  { id: 'green', value: '#30d158' },
  { id: 'blue', value: '#0a84ff' },
];
export const SKETCH_DEFAULT_COLOR = { pen: 'red', marker: 'yellow' };
// Sizes relative to the model's framing radius, so a stroke means the same area
// on a footman and on a dragon.
export const PEN_REACH = 0.025;
export const MARKER_WIDTH = 0.08;

const MAX_VERTICES_PER_STROKE = 3000;
const MAX_POINTS_PER_STROKE = 48;

export function createSketchStore() {
  let state = { tool: null, visible: false, color: { ...SKETCH_DEFAULT_COLOR }, strokes: [], nextId: 1 };
  const listeners = new Set();
  const set = patch => {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener(state);
  };
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
      const id = state.nextId;
      set({ strokes: [...state.strokes, { ...stroke, id }], nextId: id + 1 });
      return id;
    },
    remove(ids) {
      const drop = new Set(ids);
      if (state.strokes.some(s => drop.has(s.id))) set({ strokes: state.strokes.filter(s => !drop.has(s.id)) });
    },
    undo(documentId) {
      const last = state.strokes.findLast(s => s.documentId === documentId);
      if (last) set({ strokes: state.strokes.filter(s => s !== last) });
    },
    clear(documentId) {
      if (state.strokes.some(s => s.documentId === documentId))
        set({ strokes: state.strokes.filter(s => s.documentId !== documentId) });
    },
    strokes: documentId => state.strokes.filter(s => s.documentId === documentId),
  };
}

export const sketchStore = createSketchStore();

/** Light smoothing of a hand-drawn stroke; ends stay where the user put them. */
export function smoothStroke(points, passes = 2) {
  const count = points.length / 3;
  if (count < 3) return points.slice();
  let current = Float64Array.from(points);
  for (let pass = 0; pass < passes; pass++) {
    const next = current.slice();
    for (let i = 1; i < count - 1; i++)
      for (let k = 0; k < 3; k++)
        next[i * 3 + k] = current[i * 3 + k] * 0.5 + (current[i * 3 + k - 3] + current[i * 3 + k + 3]) * 0.25;
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

/** Plain description of the drawings for the AI context; model-space coordinates. */
export function sketchContext(strokes, model) {
  if (!strokes?.length) return null;
  return {
    about:
      'The user drew these on the model in the AI console to point at areas. Pen = scribble/outline, possibly a wanted shape drawn off the surface. Marker = highlighted surface region. They are not part of the model. Colors are the user\'s own labels.',
    strokes: strokes.map((stroke, index) => {
      const count = stroke.points.length / 3,
        step = Math.max(1, Math.ceil(count / MAX_POINTS_PER_STROKE)),
        points = [];
      for (let i = 0; i < count; i += step) points.push(stroke.points.slice(i * 3, i * 3 + 3).map(round));
      if ((count - 1) % step) points.push(stroke.points.slice(-3).map(round));
      const onModel = stroke.onSurface.filter(Boolean).length;
      const vertices = strokeVertices(stroke, model);
      return {
        number: index + 1,
        tool: stroke.tool,
        color: stroke.color,
        points,
        pointsOnModel: onModel + ' of ' + count,
        ...(stroke.tool === 'marker' ? { width: round(stroke.width) } : {}),
        viewDirection: stroke.view?.map(value => Math.round(value * 100) / 100),
        [stroke.tool === 'marker' ? 'markedVertices' : 'nearbyVertices']: vertices,
      };
    }),
  };
}
