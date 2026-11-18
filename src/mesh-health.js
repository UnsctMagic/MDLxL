// Mesh health for the AI: per geoset holes (open borders), non-manifold edges, degenerate and duplicate
// triangles, T-junctions, islands, loose vertices, broken numbers and the game's vertex limit.
// Topology is read on welded positions, so the split vertices of UV seams do not count as holes.
// Read-only statistics: open borders are normal on capes, planes and cards.
import { GEOSET_VERTEX_LIMIT } from './optimizexl-checker-repairs.js';

const examples = (list, limit = 5) => list.slice(0, limit);

function geosetHealth(geoset, index) {
  const V = geoset.Vertices, F = geoset.Faces, count = V.length / 3, triangles = Math.floor(F.length / 3);
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], nonFinite = 0;
  for (let v = 0; v < count; v++) for (let k = 0; k < 3; k++) {
    const x = V[v * 3 + k];
    if (!Number.isFinite(x)) { nonFinite++; continue; }
    lo[k] = Math.min(lo[k], x); hi[k] = Math.max(hi[k], x);
  }
  const size = Math.max(1e-6, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 0), tolerance = size * 1e-4;
  // Weld by position: one id per point within tolerance.
  const weld = new Int32Array(count), keys = new Map(), points = [];
  for (let v = 0; v < count; v++) {
    const key = [0, 1, 2].map(k => Math.round(V[v * 3 + k] / tolerance)).join(',');
    if (!keys.has(key)) { keys.set(key, points.length); points.push(v); }
    weld[v] = keys.get(key);
  }
  const used = new Uint8Array(count), edges = new Map(), faces = new Map(), degenerate = [], duplicates = [];
  for (let t = 0; t < triangles; t++) {
    const ids = [F[t * 3], F[t * 3 + 1], F[t * 3 + 2]];
    if (ids.some(i => i >= count)) { degenerate.push(t); continue; }
    ids.forEach(i => { used[i] = 1; });
    const w = ids.map(i => weld[i]);
    const [a, b, c] = ids.map(i => [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]]);
    const u = [0, 1, 2].map(k => b[k] - a[k]), v = [0, 1, 2].map(k => c[k] - a[k]);
    const area = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
    if (new Set(w).size < 3 || area <= tolerance * tolerance) { degenerate.push(t); continue; }
    const faceKey = [...w].sort((x, y) => x - y).join(',');
    if (faces.has(faceKey)) duplicates.push(t); else faces.set(faceKey, t);
    for (let e = 0; e < 3; e++) {
      const p = w[e], q = w[(e + 1) % 3], key = p < q ? p + ',' + q : q + ',' + p;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  const boundary = [], nonManifold = [];
  for (const [key, uses] of edges) { if (uses === 1) boundary.push(key.split(',').map(Number)); else if (uses > 2) nonManifold.push(key); }
  // Open borders: connected loops of boundary edges.
  const parent = new Map(), root = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const [p, q] of boundary) { if (!parent.has(p)) parent.set(p, p); if (!parent.has(q)) parent.set(q, q); parent.set(root(p), root(q)); }
  const loops = new Map();
  for (const [p] of boundary) { const r = root(p); loops.set(r, (loops.get(r) || 0) + 1); }
  // T-junctions: a border point lying inside another border edge (not at its ends).
  const borderPoints = [...new Set(boundary.flat())], cell = size / 64, grid = new Map(), at = p => points[p] * 3;
  const cellKey = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (const p of borderPoints) { const o = at(p), key = cellKey(V[o], V[o + 1], V[o + 2]); (grid.get(key) || grid.set(key, []).get(key)).push(p); }
  const junctions = new Set();
  for (const [p, q] of boundary) {
    const a = at(p), b = at(q), d = [V[b] - V[a], V[b + 1] - V[a + 1], V[b + 2] - V[a + 2]], length = Math.hypot(...d);
    if (length <= tolerance) continue;
    const lo3 = [0, 1, 2].map(k => Math.floor((Math.min(V[a + k], V[b + k]) - tolerance) / cell)), hi3 = [0, 1, 2].map(k => Math.floor((Math.max(V[a + k], V[b + k]) + tolerance) / cell));
    if ((hi3[0] - lo3[0] + 1) * (hi3[1] - lo3[1] + 1) * (hi3[2] - lo3[2] + 1) > 4096) continue;
    for (let x = lo3[0]; x <= hi3[0]; x++) for (let y = lo3[1]; y <= hi3[1]; y++) for (let z = lo3[2]; z <= hi3[2]; z++) for (const r of grid.get(`${x},${y},${z}`) || []) {
      if (r === p || r === q) continue;
      const o = at(r), w = [V[o] - V[a], V[o + 1] - V[a + 1], V[o + 2] - V[a + 2]], t = (w[0] * d[0] + w[1] * d[1] + w[2] * d[2]) / (length * length);
      if (t <= .01 || t >= .99) continue;
      if (Math.hypot(w[0] - d[0] * t, w[1] - d[1] * t, w[2] - d[2] * t) <= Math.max(tolerance, length * 1e-3)) junctions.add(points[r]);
    }
  }
  // Islands: connected triangles by shared vertex index, and by shared position.
  const islands = welded => {
    const up = new Map(), find = x => { while (up.get(x) !== x) { up.set(x, up.get(up.get(x))); x = up.get(x); } return x; };
    for (let t = 0; t < triangles; t++) {
      const ids = [F[t * 3], F[t * 3 + 1], F[t * 3 + 2]].filter(i => i < count).map(i => welded ? weld[i] : i);
      for (const i of ids) if (!up.has(i)) up.set(i, i);
      for (let k = 1; k < ids.length; k++) up.set(find(ids[k]), find(ids[0]));
    }
    return new Set([...up.keys()].map(find)).size;
  };
  const loose = [];
  for (let v = 0; v < count; v++) if (!used[v]) loose.push(v);
  return {
    geoset: index, vertices: count, triangles,
    openBorders: loops.size, borderEdges: boundary.length, nonManifoldEdges: nonManifold.length,
    degenerate: degenerate.length, duplicates: duplicates.length, tJunctions: junctions.size,
    islands: islands(true), indexedIslands: islands(false), looseVertices: loose.length, nonFinite,
    overVertexLimit: count >= GEOSET_VERTEX_LIMIT,
    examples: {
      ...(degenerate.length ? { degenerateTriangles: examples(degenerate) } : {}),
      ...(duplicates.length ? { duplicateTriangles: examples(duplicates) } : {}),
      ...(junctions.size ? { tJunctionVertices: examples([...junctions]) } : {}),
      ...(loose.length ? { looseVertices: examples(loose) } : {}),
      ...(loops.size ? { openBorderEdges: examples([...loops.values()].sort((a, b) => b - a)) } : {}),
    },
  };
}

/** Mesh health of every geoset (or the listed ones), as rows plus totals. */
export function meshHealth(model, { geosets } = {}) {
  const list = geosets ?? (model.Geosets || []).map((_, i) => i);
  if (!Array.isArray(list) || list.some(i => !Number.isInteger(i) || !model.Geosets?.[i])) throw Error('Invalid geoset list.');
  const rows = list.map(i => geosetHealth(model.Geosets[i], i));
  const sum = key => rows.reduce((n, r) => n + (r[key] || 0), 0);
  return {
    vertexLimit: GEOSET_VERTEX_LIMIT - 1,
    totals: Object.fromEntries(['openBorders', 'nonManifoldEdges', 'degenerate', 'duplicates', 'tJunctions', 'looseVertices', 'nonFinite'].map(key => [key, sum(key)])),
    geosets: rows,
    note: 'Topology on welded positions (UV seams are not holes). openBorderEdges lists the edge count of the largest open borders; open borders are normal on capes, planes and cards.',
  };
}
