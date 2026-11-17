/** Cut tool: from a vertex, split a triangle at a point on its far line, or turn a
 * quad's middle line to end at a clicked vertex. Run inside EditorDocument.apply. */
import { checkedVertexSelection, updateBounds } from './mesh-tools.js';

const LIMIT = 65536;
// Copies of a point (texture seams, two-sided surfaces) sit on the same spot.
export const SAME_SPOT = 1e-3;

const near = (positions, i, point, epsilon) => Math.abs(positions[i * 3] - point[0]) <= epsilon && Math.abs(positions[i * 3 + 1] - point[1]) <= epsilon && Math.abs(positions[i * 3 + 2] - point[2]) <= epsilon;
const spot = (positions, i) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
const pairKey = (p, q) => p < q ? `${p},${q}` : `${q},${p}`;

/** Every vertex at the same spot as `index`, the vertex included. */
export function sameSpot(positions, index, epsilon = SAME_SPOT) {
  const point = spot(positions, index), found = new Set();
  for (let i = 0; i < positions.length / 3; i++) if (near(positions, i, point, epsilon)) found.add(i);
  return found;
}

/** What can be cut from `start` in one geoset: the far line of each triangle that
 * touches it (`edges`, [a, b]) and the far corner of each quad it starts (`corners`,
 * vertex -> [a, b], the middle line that turns). */
export function cutTargets(faces, positions, start, epsilon = SAME_SPOT) {
  const at = sameSpot(positions, start, epsilon), edges = new Map(), touching = new Set();
  for (let f = 0; f + 2 < faces.length; f += 3) {
    const corner = [0, 1, 2].find(c => at.has(faces[f + c]));
    if (corner === undefined) continue;
    const p = faces[f + (corner + 1) % 3], q = faces[f + (corner + 2) % 3];
    touching.add(p); touching.add(q);
    if (!at.has(p) && !at.has(q) && p !== q) edges.set(pairKey(p, q), [p, q]);
  }
  const corners = new Map();
  for (let f = 0; f + 2 < faces.length; f += 3) {
    if ([0, 1, 2].some(c => at.has(faces[f + c]))) continue;
    for (let c = 0; c < 3; c++) {
      const edge = edges.get(pairKey(faces[f + c], faces[f + (c + 1) % 3])), far = faces[f + (c + 2) % 3];
      if (edge && !touching.has(far) && !corners.has(far)) corners.set(far, edge);
    }
  }
  return { start: at, edges: [...edges.values()], corners };
}

function newVertexStreams(g, added) {
  const grow = (data, stride) => { const out = new data.constructor(data.length + added.length * stride); out.set(data); return out; };
  const count = g.Vertices.length / 3, next = { Vertices: grow(g.Vertices, 3), TVertices: g.TVertices.map(uv => grow(uv, 2)) };
  for (const [name, stride] of [['Normals', 3], ['VertexGroup', 1], ['Tangents', 4], ['SkinWeights', 8]]) if (g[name]?.length) next[name] = grow(g[name], stride);
  const mix = (data, stride, i, j, u, out, length = stride) => { for (let k = 0; k < length; k++) out[k] = data[i * stride + k] * (1 - u) + data[j * stride + k] * u; return out; };
  const unit = values => { const length = Math.hypot(values[0], values[1], values[2]); if (length > 1e-12) for (let k = 0; k < 3; k++) values[k] /= length; return values; };
  added.forEach(({ i, j, u }, slot) => {
    const n = count + slot, nearer = u <= .5 ? i : j;
    next.Vertices.set(mix(g.Vertices, 3, i, j, u, [0, 0, 0]), n * 3);
    g.TVertices.forEach((uv, set) => next.TVertices[set].set(mix(uv, 2, i, j, u, [0, 0]), n * 2));
    if (next.Normals) next.Normals.set(unit(mix(g.Normals, 3, i, j, u, [0, 0, 0])), n * 3);
    if (next.Tangents) { const tangent = unit(mix(g.Tangents, 4, i, j, u, [0, 0, 0, 0], 3)); tangent[3] = g.Tangents[nearer * 4 + 3]; next.Tangents.set(tangent, n * 4); }
    // A point keeps one binding: the nearer end's bones move it.
    if (next.VertexGroup) next.VertexGroup[n] = g.VertexGroup[nearer];
    if (next.SkinWeights) next.SkinWeights.set(g.SkinWeights.subarray(nearer * 8, nearer * 8 + 8), n * 8);
  });
  return next;
}

// Split every triangle of one geoset that uses a line lying on from -> to.
function splitLine(g, from, to, t, epsilon) {
  const faces = g.Faces, positions = g.Vertices, pairs = new Map();
  for (let f = 0; f + 2 < faces.length; f += 3) for (let c = 0; c < 3; c++) {
    const p = faces[f + c], q = faces[f + (c + 1) % 3], key = pairKey(p, q);
    if (pairs.has(key) || p === q) continue;
    if (near(positions, p, from, epsilon) && near(positions, q, to, epsilon)) pairs.set(key, { i: p, j: q, u: t });
    else if (near(positions, q, from, epsilon) && near(positions, p, to, epsilon)) pairs.set(key, { i: q, j: p, u: t });
  }
  if (!pairs.size) return null;
  const added = [...pairs.values()], count = g.Vertices.length / 3;
  if (count + added.length > LIMIT) throw new Error('The geoset exceeds the 65536-vertex file-format limit.');
  const point = new Map(added.map((pair, slot) => [pairKey(pair.i, pair.j), count + slot])), next = [];
  for (let f = 0; f + 2 < faces.length; f += 3) {
    const face = [faces[f], faces[f + 1], faces[f + 2]], c = [0, 1, 2].find(c => point.has(pairKey(face[c], face[(c + 1) % 3])) && face[c] !== face[(c + 1) % 3]);
    if (c === undefined) { next.push(...face); continue; }
    const p = face[c], q = face[(c + 1) % 3], r = face[(c + 2) % 3], n = point.get(pairKey(p, q));
    next.push(p, n, r, n, q, r);
  }
  Object.assign(g, newVertexStreams(g, added), { Faces: new Uint16Array(next) }); updateBounds(g);
  return { added: added.map((_, slot) => count + slot), split: next.length / 3 - faces.length / 3 };
}

const normal = (positions, a, b, c) => {
  const p = spot(positions, a), u = spot(positions, b).map((v, k) => v - p[k]), w = spot(positions, c).map((v, k) => v - p[k]);
  return [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
};

// The two triangles of each quad from `start` to `corner` swap their middle line.
function turnMiddleLine(g, start, corner, epsilon) {
  const faces = Array.from(g.Faces), positions = g.Vertices, from = sameSpot(positions, start, epsilon), to = sameSpot(positions, corner, epsilon), used = new Set();
  let turned = 0;
  for (let f = 0; f + 2 < faces.length; f += 3) {
    const s = [0, 1, 2].find(c => from.has(faces[f + c]));
    if (s === undefined || used.has(f)) continue;
    const a = faces[f + (s + 1) % 3], b = faces[f + (s + 2) % 3], sv = faces[f + s];
    for (let o = 0; o + 2 < faces.length; o += 3) {
      if (o === f || used.has(o)) continue;
      const other = [faces[o], faces[o + 1], faces[o + 2]], v = other.find(id => to.has(id));
      if (v === undefined || !other.includes(a) || !other.includes(b) || new Set(other).size !== 3) continue;
      const facing = normal(positions, sv, a, b), first = [sv, a, v], second = [v, b, sv];
      for (const face of [first, second]) { const n = normal(positions, ...face); if (n[0] * facing[0] + n[1] * facing[1] + n[2] * facing[2] < 0) [face[1], face[2]] = [face[2], face[1]]; }
      faces.splice(f, 3, ...first); faces.splice(o, 3, ...second); used.add(f); used.add(o); turned++;
      break;
    }
  }
  if (!turned) throw new Error('These two points do not share a pair of triangles.');
  g.Faces = new Uint16Array(faces);
  return turned;
}

/** Cut from vertex `start` of geoset `geosetIndex`. With `vertex`, the quad's middle
 * line turns to end there. Otherwise a new point goes on line a-b at `t` (0 at a,
 * 1 at b); every triangle using that line, in any geoset and on copies at the same
 * spot, is split there so nothing tears. Returns the new points of this geoset. */
export function cutTriangles(model, { geosetIndex, start, a, b, t, vertex }, epsilon = SAME_SPOT) {
  const g = model?.Geosets?.[geosetIndex];
  if (!g) throw new Error('Select an existing geoset.');
  checkedVertexSelection(g, vertex == null ? [start, a, b] : [start, vertex], { requireFaces: true });
  if (vertex != null) return { selection: [], turned: turnMiddleLine(g, start, vertex, epsilon) };
  if (!(t > 0 && t < 1)) throw new Error('Click between the two ends of the line.');
  const targets = cutTargets(g.Faces, g.Vertices, start, epsilon);
  if (!targets.edges.some(([p, q]) => pairKey(p, q) === pairKey(a, b))) throw new Error('That line is not on a triangle touching the first point.');
  const from = spot(g.Vertices, a), to = spot(g.Vertices, b);
  let selection = [], split = 0;
  model.Geosets.forEach((geoset, index) => {
    if (index !== geosetIndex && !(geoset?.Faces?.length && geoset.Vertices?.length)) return;
    if (index !== geosetIndex && !splitLinePossible(geoset, from, to, epsilon)) return;
    if (index !== geosetIndex) checkedVertexSelection(geoset, [], { requireFaces: true, allowEmpty: true });
    const result = splitLine(geoset, from, to, t, epsilon);
    if (!result) return;
    split += result.split;
    if (index === geosetIndex) selection = result.added;
  });
  return { selection, split };
}

function splitLinePossible(g, from, to, epsilon) {
  let hasFrom = false, hasTo = false;
  for (let i = 0; i < g.Vertices.length / 3 && !(hasFrom && hasTo); i++) { hasFrom ||= near(g.Vertices, i, from, epsilon); hasTo ||= near(g.Vertices, i, to, epsilon); }
  return hasFrom && hasTo;
}
