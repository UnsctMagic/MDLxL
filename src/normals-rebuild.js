/**
 * NormalsXL: one-click shading and triangle-facing repair.
 *
 * Pure model code (no React). analyzeNormals() reads the model once; it never
 * writes to it. planNormalRebuild() turns an analysis plus settings into new
 * vertex streams for the affected geosets. applyNormalRebuild() commits a plan;
 * call it inside EditorDocument.apply so the result is one undo step.
 *
 * Analysis welds vertices by position across all included geosets, so lighting
 * matches across UV seams, bone groups and geoset borders. Each triangle corner
 * joins the smoothing group of its neighbours across edges flatter than the
 * smoothing angle. A vertex index used by several groups is split into copies
 * that keep every per-vertex stream; copies that end up identical are merged.
 */
import { gather } from './mesh-tools.js';
import { forgeTangents } from './geoset-tangents.js';

export const DEFAULT_SMOOTHING_ANGLE = 70;
export const SMOOTHING_ANGLE_RANGE = Object.freeze([20, 160]);
export const VERTEX_LIMIT = 65535;

const fail = message => { throw new Error(message); };

/** All layers unshaded: normals have no effect on the rendered lighting. */
export function isShadedGeoset(model, geoset) {
  const layers = model?.Materials?.[geoset?.MaterialID]?.Layers;
  return !(layers?.length && layers.every(layer => (layer.Shading || 0) & 1));
}

// ---------- union-find over triangle corners ----------
function unionFind(size) {
  const parent = new Int32Array(size);
  for (let i = 0; i < size; i++) parent[i] = i;
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) { if (a < b) parent[b] = a; else parent[a] = b; } };
  return { find, join };
}

// ---------- bounding volume hierarchy for visibility rays ----------
function buildBVH(P, tv, triangles) {
  const count = triangles.length, ids = Int32Array.from(triangles), centroid = new Float64Array(count * 3);
  for (let i = 0; i < count; i++) {
    const t = ids[i];
    for (let axis = 0; axis < 3; axis++) centroid[i * 3 + axis] = (P[tv[t * 3] * 3 + axis] + P[tv[t * 3 + 1] * 3 + axis] + P[tv[t * 3 + 2] * 3 + axis]) / 3;
  }
  const order = Int32Array.from({ length: count }, (_, i) => i);
  const bounds = [], left = [], right = [], start = [], size = [];
  const build = (from, to) => {
    const node = left.length; left.push(-1); right.push(-1); start.push(from); size.push(to - from);
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], cbox = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = from; i < to; i++) {
      const t = ids[order[i]];
      for (let corner = 0; corner < 3; corner++) for (let axis = 0; axis < 3; axis++) {
        const value = P[tv[t * 3 + corner] * 3 + axis];
        if (value < box[axis]) box[axis] = value; if (value > box[axis + 3]) box[axis + 3] = value;
      }
      for (let axis = 0; axis < 3; axis++) { const value = centroid[order[i] * 3 + axis]; if (value < cbox[axis]) cbox[axis] = value; if (value > cbox[axis + 3]) cbox[axis + 3] = value; }
    }
    bounds.push(...box);
    if (to - from <= 4) return node;
    let axis = 0;
    for (let k = 1; k < 3; k++) if (cbox[k + 3] - cbox[k] > cbox[axis + 3] - cbox[axis]) axis = k;
    if (cbox[axis + 3] - cbox[axis] <= 0) return node;
    const slice = Array.from(order.subarray(from, to)).sort((a, b) => centroid[a * 3 + axis] - centroid[b * 3 + axis]);
    order.set(slice, from);
    const middle = (from + to) >> 1;
    left[node] = build(from, middle); right[node] = build(middle, to);
    return node;
  };
  if (count) build(0, count);
  return { ids, order, bounds: Float64Array.from(bounds), left: Int32Array.from(left), right: Int32Array.from(right), start: Int32Array.from(start), size: Int32Array.from(size) };
}

function rayEscapes(bvh, P, tv, origin, direction, tmin) {
  if (!bvh.left.length) return true;
  const inverse = direction.map(d => 1 / (Math.abs(d) > 1e-300 ? d : 1e-300));
  const stack = [0];
  while (stack.length) {
    const node = stack.pop(), b = node * 6;
    let near = -Infinity, far = Infinity;
    for (let axis = 0; axis < 3; axis++) {
      let t0 = (bvh.bounds[b + axis] - origin[axis]) * inverse[axis], t1 = (bvh.bounds[b + axis + 3] - origin[axis]) * inverse[axis];
      if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; }
      if (t0 > near) near = t0; if (t1 < far) far = t1;
    }
    if (near > far || far < tmin) continue;
    if (bvh.left[node] >= 0) { stack.push(bvh.left[node], bvh.right[node]); continue; }
    for (let i = bvh.start[node]; i < bvh.start[node] + bvh.size[node]; i++) {
      const t = bvh.ids[bvh.order[i]], a = tv[t * 3] * 3, q = tv[t * 3 + 1] * 3, r = tv[t * 3 + 2] * 3;
      const e1x = P[q] - P[a], e1y = P[q + 1] - P[a + 1], e1z = P[q + 2] - P[a + 2];
      const e2x = P[r] - P[a], e2y = P[r + 1] - P[a + 1], e2z = P[r + 2] - P[a + 2];
      const px = direction[1] * e2z - direction[2] * e2y, py = direction[2] * e2x - direction[0] * e2z, pz = direction[0] * e2y - direction[1] * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-18) continue;
      const inv = 1 / det, sx = origin[0] - P[a], sy = origin[1] - P[a + 1], sz = origin[2] - P[a + 2];
      const u = (sx * px + sy * py + sz * pz) * inv; if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
      const v = (direction[0] * qx + direction[1] * qy + direction[2] * qz) * inv; if (v < 0 || u + v > 1) continue;
      if ((e2x * qx + e2y * qy + e2z * qz) * inv > tmin) return false;
    }
  }
  return true;
}

// ---------- analysis ----------
/**
 * @param model  the editor model (read only)
 * @param scope  { geosets: indices to analyse (default: every shaded geoset),
 *                 selection: { [geoset]: vertex ids } or null for the whole model }
 */
export function analyzeNormals(model, { geosets, selection = null } = {}) {
  const included = [...new Set(geosets ?? (model?.Geosets || []).map((g, i) => isShadedGeoset(model, g) ? i : -1).filter(i => i >= 0))].sort((a, b) => a - b);
  const slots = [];
  let vertexTotal = 0, triangleTotal = 0;
  for (const index of included) {
    const g = model.Geosets?.[index], count = g?.Vertices?.length / 3;
    if (!g) continue;
    if (!Number.isInteger(count) || g.Normals?.length !== g.Vertices.length || !Array.from(g.Vertices).every(Number.isFinite))
      fail('NormalsXL needs finite positions and one normal for each vertex.');
    if (!g.Faces || g.Faces.length % 3 || Array.from(g.Faces).some(id => !Number.isInteger(id) || id < 0 || id >= count))
      fail('NormalsXL cannot use invalid triangle indices.');
    if (!g.Faces.length) continue;
    const picked = selection ? new Set((selection[index] || []).filter(id => Number.isInteger(id) && id >= 0 && id < count)) : null;
    slots.push({ index, g, base: vertexTotal, count, triangleBase: triangleTotal, triangles: g.Faces.length / 3, picked });
    vertexTotal += count; triangleTotal += g.Faces.length / 3;
  }
  if (!triangleTotal) fail('NormalsXL found no visible shaded triangles.');

  // Positions and analysis-only weld.
  const N = vertexTotal, T = triangleTotal, P = new Float64Array(N * 3);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const slot of slots) for (let i = 0; i < slot.count * 3; i++) {
    const value = slot.g.Vertices[i], axis = i % 3; P[slot.base * 3 + i] = value;
    if (value < min[axis]) min[axis] = value; if (value > max[axis]) max[axis] = value;
  }
  const diagonal = Math.max(1e-6, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2])), epsilon = diagonal * 1e-5;
  const cell = epsilon * 2, grid = new Map(), weld = new Int32Array(N), weldPositions = [];
  for (let v = 0; v < N; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    let found = -1;
    for (let dx = -1; dx <= 1 && found < 0; dx++) for (let dy = -1; dy <= 1 && found < 0; dy++) for (let dz = -1; dz <= 1 && found < 0; dz++) {
      const list = grid.get((cx + dx) + ',' + (cy + dy) + ',' + (cz + dz));
      if (list) for (const w of list) if (Math.hypot(weldPositions[w * 3] - x, weldPositions[w * 3 + 1] - y, weldPositions[w * 3 + 2] - z) <= epsilon) { found = w; break; }
    }
    if (found < 0) {
      found = weldPositions.length / 3; weldPositions.push(x, y, z);
      const key = cx + ',' + cy + ',' + cz; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(found);
    }
    weld[v] = found;
  }
  const W = weldPositions.length / 3;

  // Triangles.
  const tv = new Int32Array(T * 3), tw = new Int32Array(T * 3), slotOf = new Int32Array(T), normal = new Float64Array(T * 3), area = new Float64Array(T);
  const angle = new Float64Array(T * 3), degenerate = new Uint8Array(T), editable = new Uint8Array(T);
  for (const [s, slot] of slots.entries()) for (let f = 0; f < slot.triangles; f++) {
    const t = slot.triangleBase + f;
    slotOf[t] = s;
    let touched = !slot.picked;
    for (let k = 0; k < 3; k++) {
      const local = slot.g.Faces[f * 3 + k];
      tv[t * 3 + k] = slot.base + local; tw[t * 3 + k] = weld[slot.base + local];
      if (slot.picked?.has(local)) touched = true;
    }
    editable[t] = touched ? 1 : 0;
    const a = tv[t * 3] * 3, b = tv[t * 3 + 1] * 3, c = tv[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, length = Math.hypot(nx, ny, nz);
    area[t] = length / 2;
    if (!(length > diagonal * diagonal * 2e-12) || tw[t * 3] === tw[t * 3 + 1] || tw[t * 3] === tw[t * 3 + 2] || tw[t * 3 + 1] === tw[t * 3 + 2]) { degenerate[t] = 1; continue; }
    normal[t * 3] = nx / length; normal[t * 3 + 1] = ny / length; normal[t * 3 + 2] = nz / length;
    for (let k = 0; k < 3; k++) {
      const p = tv[t * 3 + k] * 3, q = tv[t * 3 + (k + 1) % 3] * 3, r = tv[t * 3 + (k + 2) % 3] * 3;
      const ax = P[q] - P[p], ay = P[q + 1] - P[p + 1], az = P[q + 2] - P[p + 2], bx = P[r] - P[p], by = P[r + 1] - P[p + 1], bz = P[r + 2] - P[p + 2];
      angle[t * 3 + k] = Math.atan2(Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx), ax * bx + ay * by + az * bz);
    }
  }

  // Coincident triangles. Same direction: one surface (copies follow their
  // representative). Opposite directions: a two-sided sheet (twins) whose sides
  // never smooth together and never decide orientation.
  const twin = new Uint8Array(T), copyOf = new Int32Array(T).fill(-1), duplicate = new Int32Array(T).fill(-1), byTriangle = new Map();
  for (let t = 0; t < T; t++) {
    if (degenerate[t]) continue;
    const a = tw[t * 3], b = tw[t * 3 + 1], c = tw[t * 3 + 2], lo = Math.min(a, b, c), hi = Math.max(a, b, c), mid = a + b + c - lo - hi;
    const key = lo + ',' + mid + ',' + hi;
    if (!byTriangle.has(key)) byTriangle.set(key, []);
    byTriangle.get(key).push(t);
  }
  let duplicateId = 0;
  for (const list of byTriangle.values()) {
    if (list.length < 2) continue;
    const parity = t => { const a = tw[t * 3], b = tw[t * 3 + 1], c = tw[t * 3 + 2]; return (a < b) + (b < c) + (c < a) === 2 ? 1 : -1; };
    const representative = new Map();
    for (const t of list) {
      duplicate[t] = duplicateId;
      const side = parity(t);
      if (representative.has(side)) copyOf[t] = representative.get(side); else representative.set(side, t);
    }
    if (representative.size === 2) for (const t of list) twin[t] = 1;
    duplicateId++;
  }

  // Welded edges of distinct, non-degenerate triangles.
  const edges = new Map();
  for (let t = 0; t < T; t++) {
    if (degenerate[t] || copyOf[t] >= 0) continue;
    for (let k = 0; k < 3; k++) {
      const a = tw[t * 3 + k], b = tw[t * 3 + (k + 1) % 3], key = a < b ? a * W + b : b * W + a;
      let list = edges.get(key); if (!list) edges.set(key, list = []);
      list.push(t * 3 + k);
    }
  }
  return { model, slots, N, T, W, P, weld, weldPositions, diagonal, tv, tw, slotOf, normal, area, angle, degenerate, editable, twin, copyOf, duplicate, edges, cache: new Map() };
}

/**
 * Pair the triangles around every welded edge. With 3+ triangles on an edge,
 * orientation-compatible partners pair first, flattest first. orientation[t] is
 * +1 or -1 (a reversed triangle). Returns flat [cornerA, cornerB, compatible, cos].
 */
function pairEdges(A, orientation) {
  const { tw, normal, duplicate } = A, pairs = [];
  const direction = corner => { const t = (corner / 3) | 0, k = corner % 3; return (tw[t * 3 + k] < tw[t * 3 + (k + 1) % 3] ? 1 : -1) * orientation[t]; };
  const cosine = (s, t) => (normal[s * 3] * normal[t * 3] + normal[s * 3 + 1] * normal[t * 3 + 1] + normal[s * 3 + 2] * normal[t * 3 + 2]) * orientation[s] * orientation[t];
  for (const list of A.edges.values()) {
    if (list.length < 2) continue;
    const candidates = [];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const s = (list[i] / 3) | 0, t = (list[j] / 3) | 0;
      if (s === t || duplicate[s] >= 0 && duplicate[s] === duplicate[t]) continue;
      const compatible = direction(list[i]) !== direction(list[j]), c = cosine(s, t) * (compatible ? 1 : -1);
      candidates.push([list[i], list[j], compatible, c]);
    }
    if (candidates.length > 1) candidates.sort((x, y) => (y[2] - x[2]) || (y[3] - x[3]));
    const used = new Set();
    for (const candidate of candidates) {
      if (used.has(candidate[0]) || used.has(candidate[1])) continue;
      used.add(candidate[0]); used.add(candidate[1]); pairs.push(candidate);
    }
  }
  return pairs;
}

/** Triangle facing: consistent winding per connected piece, then outward. */
function facing(A) {
  if (A.cache.has('facing')) return A.cache.get('facing');
  const { T, tw, tv, P, normal, area, degenerate, twin, copyOf, diagonal } = A;
  const ones = new Int8Array(T).fill(1), pairs = pairEdges(A, ones), neighbours = Array.from({ length: T }, () => []);
  for (const [a, b, compatible] of pairs) {
    const s = (a / 3) | 0, t = (b / 3) | 0;
    if (twin[s] || twin[t]) continue;
    neighbours[s].push(t, compatible ? 1 : -1); neighbours[t].push(s, compatible ? 1 : -1);
  }
  const sign = new Int8Array(T), orientation = new Int8Array(T).fill(1), pieces = [];
  let bvh = null;
  for (let seed = 0; seed < T; seed++) {
    if (sign[seed] || degenerate[seed] || twin[seed] || copyOf[seed] >= 0) continue;
    const list = [seed]; sign[seed] = 1; let conflict = false;
    for (let cursor = 0; cursor < list.length; cursor++) {
      const t = list[cursor], links = neighbours[t];
      for (let i = 0; i < links.length; i += 2) {
        const next = links[i], wanted = sign[t] * links[i + 1];
        if (!sign[next]) { sign[next] = wanted; list.push(next); } else if (sign[next] !== wanted) conflict = true;
      }
    }
    // Majority by area keeps the side most of the piece already shows.
    let plus = 0, minus = 0;
    for (const t of list) if (sign[t] > 0) plus += area[t]; else minus += area[t];
    let major = plus >= minus ? 1 : -1;
    // Closed: every welded edge of the piece is used twice or more inside it.
    const use = new Map();
    for (const t of list) for (let k = 0; k < 3; k++) { const a = tw[t * 3 + k], b = tw[t * 3 + (k + 1) % 3], key = a < b ? a * A.W + b : b * A.W + a; use.set(key, (use.get(key) || 0) + 1); }
    let closed = true; for (const n of use.values()) if (n < 2) { closed = false; break; }
    const center = [0, 0, 0]; let corners = 0;
    for (const t of list) for (let k = 0; k < 3; k++) { for (let axis = 0; axis < 3; axis++) center[axis] += P[tv[t * 3 + k] * 3 + axis]; corners++; }
    for (let axis = 0; axis < 3; axis++) center[axis] /= corners;
    let volume = 0, absolute = 0;
    for (const t of list) {
      const a = tv[t * 3] * 3, b = tv[t * 3 + 1] * 3, c = tv[t * 3 + 2] * 3;
      const ax = P[a] - center[0], ay = P[a + 1] - center[1], az = P[a + 2] - center[2], bx = P[b] - center[0], by = P[b + 1] - center[1], bz = P[b + 2] - center[2], cx = P[c] - center[0], cy = P[c + 1] - center[1], cz = P[c + 2] - center[2];
      const value = ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
      volume += sign[t] * major * value; absolute += Math.abs(value);
    }
    const ratio = absolute > 0 ? volume / absolute : 0;
    let decision = conflict ? 'conflict' : 'kept', reverse = false;
    if (conflict) { /* left as authored; reported as needing a look */ }
    else if (closed && Math.abs(ratio) > .02) { reverse = ratio < 0; decision = reverse ? 'reversed' : 'kept'; }
    else {
      // Open (or flat closed) piece: compare how much of the sky each side sees.
      bvh ||= buildBVH(P, tv, Array.from({ length: T }, (_, t) => t).filter(t => !degenerate[t]));
      const { front, back } = visibility(A, bvh, list, sign, major);
      if (back - front >= .4 && back >= .5) { reverse = true; decision = 'reversed'; }
      else if (back - front > .15) decision = 'unsure';
    }
    if (reverse) major = -major;
    // A piece that cannot be wound consistently (a twisted or self-crossing
    // sheet) keeps its triangles as they are; any flip there is a guess.
    for (const t of list) orientation[t] = conflict ? 1 : sign[t] * major;
    pieces.push({ triangles: list, closed, decision });
  }
  for (let t = 0; t < T; t++) if (copyOf[t] >= 0 && !twin[t]) orientation[t] = orientation[copyOf[t]];
  const result = { orientation, pieces };
  A.cache.set('facing', result);
  return result;

  function visibility(A, bvh, list, sign, major) {
    const samples = list.filter(t => area[t] > 0), step = Math.max(1, Math.floor(samples.length / 16)), delta = diagonal * 1e-4, tmin = diagonal * 1e-6;
    const tilt = 50 * Math.PI / 180;
    let front = 0, back = 0, weight = 0;
    for (let i = 0; i < samples.length && i / step < 16; i += step) {
      const t = samples[i], a = tv[t * 3] * 3, b = tv[t * 3 + 1] * 3, c = tv[t * 3 + 2] * 3, o = sign[t] * major;
      const center = [0, 1, 2].map(axis => (P[a + axis] + P[b + axis] + P[c + axis]) / 3), n = [0, 1, 2].map(axis => normal[t * 3 + axis] * o);
      const helper = Math.abs(n[0]) < .8 ? [1, 0, 0] : [0, 1, 0], d = helper[0] * n[0] + helper[1] * n[1] + helper[2] * n[2];
      let u = helper.map((v, axis) => v - d * n[axis]); const ul = Math.hypot(...u); u = u.map(v => v / ul);
      const w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
      for (const side of [1, -1]) {
        let escaped = 0, rays = 0;
        const origin = center.map((v, axis) => v + side * n[axis] * delta);
        const directions = [n.map(v => v * side)];
        for (let k = 0; k < 6; k++) { const phi = k * Math.PI / 3; directions.push(n.map((v, axis) => side * v * Math.cos(tilt) + (u[axis] * Math.cos(phi) + w[axis] * Math.sin(phi)) * Math.sin(tilt))); }
        for (const direction of directions) { rays++; if (rayEscapes(bvh, P, tv, origin, direction, tmin)) escaped++; }
        if (side > 0) front += escaped / rays * area[t]; else back += escaped / rays * area[t];
      }
      weight += area[t];
    }
    return weight ? { front: front / weight, back: back / weight } : { front: 0, back: 0 };
  }
}

/**
 * Turn an analysis into new geoset streams. Nothing in the model is changed.
 * @param settings { smoothingAngle, fixFacing, facingOnly }
 */
export function planNormalRebuild(A, { smoothingAngle = DEFAULT_SMOOTHING_ANGLE, fixFacing = true, facingOnly = false } = {}) {
  if (!Number.isFinite(smoothingAngle) || smoothingAngle < 0 || smoothingAngle > 180) fail('Invalid smoothing angle.');
  const { T, tv, tw, normal, angle, degenerate, editable, twin, copyOf, slots } = A;
  const face = fixFacing || facingOnly ? facing(A) : null;
  // Only triangles in scope may change winding.
  const orientation = new Int8Array(T).fill(1);
  let flipped = 0;
  if (face) for (let t = 0; t < T; t++) if (face.orientation[t] < 0 && editable[t] && !twin[t] && !degenerate[t]) { orientation[t] = -1; flipped++; }
  const key = 'pairs:' + (face ? 1 : 0);
  if (!A.cache.has(key)) A.cache.set(key, pairEdges(A, orientation));
  const pairs = A.cache.get(key);

  // Smoothing groups over corners: transitive across smooth paired edges.
  const groups = unionFind(T * 3), limit = Math.cos(smoothingAngle * Math.PI / 180) - 1e-9;
  for (const [a, b, compatible, c] of pairs) {
    if (!compatible || c < limit) continue;
    const s = (a / 3) | 0, t = (b / 3) | 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (tw[s * 3 + i] === tw[t * 3 + j]) groups.join(s * 3 + i, t * 3 + j);
  }
  for (let t = 0; t < T; t++) {
    const r = copyOf[t]; if (r < 0) continue;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (tw[t * 3 + i] === tw[r * 3 + j]) groups.join(t * 3 + i, r * 3 + j);
  }
  // Angle-weighted sum of unit face normals per group.
  const sums = new Float64Array(T * 9);
  for (let t = 0; t < T; t++) {
    if (degenerate[t] || copyOf[t] >= 0) continue;
    for (let k = 0; k < 3; k++) {
      const root = groups.find(t * 3 + k), weight = angle[t * 3 + k] * orientation[t];
      for (let axis = 0; axis < 3; axis++) sums[root * 3 + axis] += normal[t * 3 + axis] * weight;
    }
  }
  const cornerNormal = (t, k) => {
    const root = groups.find(t * 3 + k), x = sums[root * 3], y = sums[root * 3 + 1], z = sums[root * 3 + 2], length = Math.hypot(x, y, z);
    if (length > 1e-12) return [x / length, y / length, z / length];
    return [normal[t * 3] * orientation[t], normal[t * 3 + 1] * orientation[t], normal[t * 3 + 2] * orientation[t]];
  };
  // A vertex used only by collapsed triangles takes the shading at its position.
  const weldNormal = new Map();
  const positionNormal = w => {
    if (!weldNormal.size) for (let t = 0; t < T; t++) if (!degenerate[t] && copyOf[t] < 0) for (let k = 0; k < 3; k++) {
      const n = cornerNormal(t, k), sum = weldNormal.get(tw[t * 3 + k]) || [0, 0, 0];
      weldNormal.set(tw[t * 3 + k], sum.map((v, axis) => v + n[axis]));
    }
    const sum = weldNormal.get(w), length = sum && Math.hypot(...sum);
    return length > 1e-12 ? sum.map(v => v / length) : null;
  };

  const stats = { normalsRebuilt: 0, verticesSplit: 0, verticesMerged: 0, trianglesFlipped: flipped, piecesNeedLook: 0 };
  if (face) for (const piece of face.pieces) if ((piece.decision === 'unsure' || piece.decision === 'conflict') && piece.triangles.some(t => editable[t])) stats.piecesNeedLook++;
  if (facingOnly && !flipped) return { geosets: [], stats: { ...stats, changed: false }, settings: { smoothingAngle, fixFacing, facingOnly } };
  const geosets = [], tolerance = Math.cos(.5 * Math.PI / 180);
  for (const slot of slots) {
    const g = slot.g, count = slot.count, first = slot.triangleBase, last = first + slot.triangles;
    // Facing only: rebuild just the vertices of reversed triangles.
    let affected = null;
    if (facingOnly) {
      affected = new Uint8Array(count);
      for (let t = first; t < last; t++) if (orientation[t] < 0) for (let k = 0; k < 3; k++) affected[tv[t * 3 + k] - slot.base] = 1;
    }
    const active = (t, local) => editable[t] && (!affected || affected[local]);
    // A vertex also used by an out-of-scope corner keeps its stored normal there.
    const pinned = new Uint8Array(count);
    for (let t = first; t < last; t++) for (let k = 0; k < 3; k++) { const local = tv[t * 3 + k] - slot.base; if (!active(t, local)) pinned[local] = 1; }
    const faces = new Int32Array(slot.triangles * 3), copies = [], copyNormals = [], assigned = new Map(), firstRoot = new Int32Array(count).fill(-1), byGroup = new Map(), touched = new Set();
    for (let t = first; t < last; t++) for (let k = 0; k < 3; k++) {
      const local = tv[t * 3 + k] - slot.base;
      faces[(t - first) * 3 + k] = local;
      if (!active(t, local) || degenerate[t]) continue;
      // Selection border: a vertex shared with untouched triangles keeps its
      // stored normal, so no lighting seam appears. A flipped triangle still
      // gets its own correctly facing copy.
      if (pinned[local] && orientation[t] > 0) continue;
      const root = groups.find(t * 3 + k);
      let out;
      if (!pinned[local] && (firstRoot[local] < 0 || firstRoot[local] === root)) {
        if (firstRoot[local] < 0) { firstRoot[local] = root; assigned.set(local, cornerNormal(t, k)); }
        out = local;
      } else {
        const id = local * T * 3 + root;
        out = byGroup.get(id);
        if (out === undefined) { out = count + copies.length; copies.push(local); copyNormals.push(cornerNormal(t, k)); byGroup.set(id, out); }
      }
      faces[(t - first) * 3 + k] = out; touched.add(out);
    }
    // Collapsed triangles keep their indices; a vertex used only by them takes
    // the shading at its position.
    for (let t = first; t < last; t++) if (degenerate[t]) for (let k = 0; k < 3; k++) {
      const local = tv[t * 3 + k] - slot.base;
      if (!active(t, local) || pinned[local] || assigned.has(local)) continue;
      const stored = Array.from(g.Normals.subarray(local * 3, local * 3 + 3)), length = Math.hypot(...stored);
      assigned.set(local, positionNormal(tw[t * 3 + k]) || (length > 1e-12 && stored.every(Number.isFinite) ? stored.map(v => v / length) : [0, 0, 1]));
      touched.add(local);
    }
    for (let t = first; t < last; t++) if (orientation[t] < 0) { const f = t - first, swap = faces[f * 3 + 1]; faces[f * 3 + 1] = faces[f * 3 + 2]; faces[f * 3 + 2] = swap; }

    // Streams: every original vertex, then the split copies (all streams copied).
    const sources = Array.from({ length: count + copies.length }, (_, i) => i < count ? i : copies[i - count]);
    const streams = gather(g, sources);
    for (const [local, n] of assigned) streams.Normals.set(n, local * 3);
    copyNormals.forEach((n, i) => streams.Normals.set(n, (count + i) * 3));

    // Merge rebuilt vertices that became identical to another vertex in every
    // stream that matters for rendering and rigging. Untouched vertices stay.
    const keyOf = v => {
      const parts = [streams.VertexGroup[v]];
      for (const [array, stride] of [[streams.Vertices, 3], [streams.Normals, 3], ...streams.TVertices.map(uv => [uv, 2]), ...(streams.SkinWeights ? [[streams.SkinWeights, 8]] : [])])
        for (let i = 0; i < stride; i++) parts.push(array[v * stride + i]);
      return parts.join(',');
    };
    const target = new Int32Array(sources.length).fill(-1), seen = new Map();
    for (let v = 0; v < sources.length; v++) if (!touched.has(v)) { const key = keyOf(v); if (!seen.has(key)) seen.set(key, v); }
    for (const v of [...touched].sort((a, b) => a - b)) {
      const key = keyOf(v), existing = seen.get(key);
      if (existing === undefined) seen.set(key, v); else target[v] = existing;
    }
    const keep = [], remap = new Int32Array(sources.length);
    for (let v = 0; v < sources.length; v++) if (target[v] < 0) { remap[v] = keep.length; keep.push(v); }
    for (let v = 0; v < sources.length; v++) if (target[v] >= 0) remap[v] = remap[target[v]];
    if (keep.length > VERTEX_LIMIT) fail(`NormalsXL would give geoset ${slot.index} more than 65,535 vertices. Split the geoset first.`);
    const final = keep.length === sources.length ? streams : gather(streams, keep);
    const outFaces = new g.Faces.constructor(faces.length);
    for (let i = 0; i < faces.length; i++) outFaces[i] = remap[faces[i]];
    const sourceOf = Int32Array.from(keep, v => sources[v]);
    const touchedOut = [...new Set([...touched].map(v => remap[v]))].sort((a, b) => a - b);

    const facesChanged = outFaces.some((v, i) => v !== g.Faces[i]);
    const normalsChanged = final.Normals.length !== g.Normals.length || final.Normals.some((v, i) => v !== g.Normals[i]);
    if (!facesChanged && !normalsChanged) continue;
    const keptCopies = keep.length - keep.filter(v => v < count).length;
    for (const v of touchedOut) {
      const a = final.Normals.subarray(v * 3, v * 3 + 3), b = g.Normals.subarray(sourceOf[v] * 3, sourceOf[v] * 3 + 3), length = Math.hypot(b[0], b[1], b[2]);
      if (!(length > 1e-12 && (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / length >= tolerance)) stats.normalsRebuilt++;
    }
    stats.verticesSplit += keptCopies; stats.verticesMerged += count - (keep.length - keptCopies);
    if (final.Tangents?.length) {
      const rebuilt = forgeTangents({ ...final, Faces: outFaces }), refresh = new Set(touchedOut);
      // Reversed triangles change UV handedness even where normals stay.
      for (let i = 0; i < outFaces.length; i += 3) if (orientation[first + i / 3] < 0) for (let k = 0; k < 3; k++) refresh.add(outFaces[i + k]);
      for (const v of refresh) final.Tangents.set(rebuilt.subarray(v * 4, v * 4 + 4), v * 4);
    }
    geosets.push({ index: slot.index, sourceVertexCount: count, sourceFaceCount: g.Faces.length, streams: { ...final, Faces: outFaces }, sourceOf, oldToNew: { sources: Int32Array.from(sources), remap }, touched: touchedOut });
  }
  stats.changed = geosets.length > 0;
  return { geosets, stats, settings: { smoothingAngle, fixFacing, facingOnly } };
}

/** Commit a plan. Run inside EditorDocument.apply so it is one undo step. */
export function applyNormalRebuild(model, plan) {
  for (const entry of plan.geosets) {
    const g = model.Geosets?.[entry.index];
    if (!g || g.Vertices.length / 3 !== entry.sourceVertexCount || g.Faces.length !== entry.sourceFaceCount) fail('The model changed. Open NormalsXL again.');
  }
  for (const entry of plan.geosets) {
    const g = model.Geosets[entry.index], streams = entry.streams;
    g.Vertices = streams.Vertices.slice(); g.Normals = streams.Normals.slice(); g.Faces = streams.Faces.slice();
    g.VertexGroup = streams.VertexGroup.slice(); g.TVertices = streams.TVertices.map(uv => uv.slice());
    if (streams.Tangents != null) g.Tangents = streams.Tangents.slice();
    if (streams.SkinWeights != null) g.SkinWeights = streams.SkinWeights.slice();
  }
  return plan.stats;
}

/** A copy of the model whose affected geosets show the planned result. */
export function previewNormalRebuild(model, plan) {
  if (!plan?.geosets.length) return model;
  const geosets = model.Geosets.slice();
  for (const entry of plan.geosets) geosets[entry.index] = { ...geosets[entry.index], ...entry.streams };
  return { ...model, Geosets: geosets };
}

/** Carry per-vertex selection (or hidden) state through the plan's new indices. */
export function remapVertexState(state, plan) {
  if (!state || !plan?.geosets.length) return state;
  const next = { ...state };
  for (const entry of plan.geosets) {
    const old = state[entry.index];
    if (!old) continue;
    const picked = new Set(old), ids = new Set(), { sources, remap } = entry.oldToNew;
    for (let i = 0; i < sources.length; i++) if (picked.has(sources[i])) ids.add(remap[i]);
    next[entry.index] = [...ids].sort((a, b) => a - b);
  }
  return next;
}

/** One-call helper for scripts and tests. Mutates the model. */
export function rebuildNormals(model, { geosets, selection, ...settings } = {}) {
  const plan = planNormalRebuild(analyzeNormals(model, { geosets, selection }), settings);
  applyNormalRebuild(model, plan);
  return plan;
}
