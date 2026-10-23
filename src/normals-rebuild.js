/**
 * NormalsXL: recalculate vertex normals the way Retera's Model Studio does,
 * plus a separate triangle-facing repair. Nothing here adds, removes or moves
 * vertices: only Normals (and, for Fix facing, the corner order in Faces and
 * HD tangents) change, so the file keeps its size.
 *
 * Normals are computed from the triangles alone; stored normals are never
 * read, so a patch of wrong normals comes out the same as a clean one.
 * For each vertex: own = sum of the unit normals of its own triangles. Its new
 * normal is own plus the unit normals of the other triangles touching a vertex
 * at the same position (same skinning, same geoset visibility) whose angle to
 * `own` is below the smoothing angle. A vertex always keeps all of its own
 * triangles, as the SD models do. Duplicated vertices at a hard edge only pick
 * up faces on their own side; UV-seam duplicates smooth together.
 *
 * analyzeNormals() reads the model once and never writes to it. The plan
 * functions return new streams; applyNormalRebuild() commits a plan (call it
 * inside EditorDocument.apply so it is one undo step).
 */
import { forgeTangents } from './geoset-tangents.js';

export const DEFAULT_SMOOTHING_ANGLE = 90;
export const SMOOTHING_ANGLE_RANGE = Object.freeze([0, 180]);
// Normals that turn by less than this are not counted or highlighted.
const VISIBLE = Math.cos(Math.PI / 180);

const fail = message => { throw new Error(message); };

/** All layers unshaded: normals have no effect on the rendered lighting. */
export function isShadedGeoset(model, geoset) {
  const layers = model?.Materials?.[geoset?.MaterialID]?.Layers;
  return !(layers?.length && layers.every(layer => (layer.Shading || 0) & 1));
}

/**
 * @param model  the editor model (read only)
 * @param scope  { geosets: indices to use (default: every shaded geoset),
 *                 selection: { [geoset]: vertex ids } or null for the whole model }
 */
export function analyzeNormals(model, { geosets, selection = null } = {}) {
  const included = [...new Set(geosets ?? (model?.Geosets || []).map((g, i) => isShadedGeoset(model, g) ? i : -1).filter(i => i >= 0))].sort((a, b) => a - b);
  const slots = [];
  let N = 0, T = 0;
  for (const index of included) {
    const g = model.Geosets?.[index], count = g?.Vertices?.length / 3;
    if (!g) continue;
    if (!Number.isInteger(count) || g.Normals?.length !== g.Vertices.length || !Array.from(g.Vertices).every(Number.isFinite))
      fail('NormalsXL needs finite positions and one normal for each vertex.');
    if (!g.Faces || g.Faces.length % 3 || Array.from(g.Faces).some(id => !Number.isInteger(id) || id < 0 || id >= count))
      fail('NormalsXL cannot use invalid triangle indices.');
    if (!g.Faces.length) continue;
    const picked = selection ? new Set((selection[index] || []).filter(id => Number.isInteger(id) && id >= 0 && id < count)) : null;
    slots.push({ index, g, base: N, count, triangleBase: T, triangles: g.Faces.length / 3, picked });
    N += count; T += g.Faces.length / 3;
  }
  if (!T) fail('NormalsXL found no visible shaded triangles.');

  const P = new Float64Array(N * 3), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const slot of slots) for (let i = 0; i < slot.count * 3; i++) {
    const value = slot.g.Vertices[i], axis = i % 3; P[slot.base * 3 + i] = value;
    if (value < min[axis]) min[axis] = value; if (value > max[axis]) max[axis] = value;
  }
  const diagonal = Math.max(1e-6, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2])), epsilon = diagonal * 1e-4;

  // Positions only combine when skinning matches (same bone set; for HD the
  // same bones and weights) and the geosets show and hide together (same
  // GeosetAnim alpha), so a sword never smooths into the hand holding it.
  const visibilityKey = index => {
    const alpha = model.GeosetAnims?.find(anim => anim.GeosetId === index)?.Alpha;
    if (alpha == null || alpha === 1) return '1';
    return JSON.stringify(alpha, (_, value) => ArrayBuffer.isView(value) ? Array.from(value) : value);
  };
  const skin = new Int32Array(N), skinIds = new Map();
  for (const slot of slots) {
    const g = slot.g, weights = g.SkinWeights?.length === slot.count * 8 ? g.SkinWeights : null, visible = visibilityKey(slot.index);
    for (let v = 0; v < slot.count; v++) {
      let key;
      if (weights) {
        const pairs = [];
        for (let k = 0; k < 4; k++) if (weights[v * 8 + 4 + k]) pairs.push(weights[v * 8 + k] + ':' + weights[v * 8 + 4 + k]);
        key = 'w' + pairs.sort().join(',');
      } else key = 'g' + [...new Set(g.Groups?.[g.VertexGroup?.[v]] || [])].sort((a, b) => a - b).join(',');
      key += '|' + visible;
      if (!skinIds.has(key)) skinIds.set(key, skinIds.size);
      skin[slot.base + v] = skinIds.get(key);
    }
  }
  const cell = epsilon * 2, grid = new Map(), weld = new Int32Array(N), first = [], members = [];
  for (let v = 0; v < N; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    let found = -1;
    for (let dx = -1; dx <= 1 && found < 0; dx++) for (let dy = -1; dy <= 1 && found < 0; dy++) for (let dz = -1; dz <= 1 && found < 0; dz++) {
      const list = grid.get((cx + dx) + ',' + (cy + dy) + ',' + (cz + dz));
      if (list) for (const w of list) { const u = first[w]; if (skin[u] === skin[v] && Math.hypot(P[u * 3] - x, P[u * 3 + 1] - y, P[u * 3 + 2] - z) <= epsilon) { found = w; break; } }
    }
    if (found < 0) {
      found = first.length; first.push(v); members.push([]);
      const key = cx + ',' + cy + ',' + cz; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(found);
    }
    weld[v] = found; members[found].push(v);
  }

  // Triangles: unit normals (area plays no part); collapsed ones are ignored.
  const tv = new Int32Array(T * 3), normal = new Float64Array(T * 3), area = new Float64Array(T), degenerate = new Uint8Array(T), inScope = new Uint8Array(T);
  for (const slot of slots) for (let f = 0; f < slot.triangles; f++) {
    const t = slot.triangleBase + f;
    for (let k = 0; k < 3; k++) { const local = slot.g.Faces[f * 3 + k]; tv[t * 3 + k] = slot.base + local; if (!slot.picked || slot.picked.has(local)) inScope[t] = 1; }
    const a = tv[t * 3] * 3, b = tv[t * 3 + 1] * 3, c = tv[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, length = Math.hypot(nx, ny, nz);
    const wa = weld[tv[t * 3]], wb = weld[tv[t * 3 + 1]], wc = weld[tv[t * 3 + 2]];
    if (!(length > diagonal * diagonal * 2e-12) || wa === wb || wa === wc || wb === wc) { degenerate[t] = 1; continue; }
    area[t] = length / 2;
    normal[t * 3] = nx / length; normal[t * 3 + 1] = ny / length; normal[t * 3 + 2] = nz / length;
  }
  // Triangles of each vertex (compressed lists).
  const start = new Int32Array(N + 1), list = new Int32Array(T * 3);
  for (let t = 0; t < T; t++) if (!degenerate[t]) for (let k = 0; k < 3; k++) start[tv[t * 3 + k] + 1]++;
  for (let v = 0; v < N; v++) start[v + 1] += start[v];
  const fill = start.slice(0, N);
  for (let t = 0; t < T; t++) if (!degenerate[t]) for (let k = 0; k < 3; k++) list[fill[tv[t * 3 + k]]++] = t;
  return { model, slots, N, T, P, weld, members, tv, normal, area, degenerate, inScope, start, list };
}

/** Normals for `vertices` (global ids) from triangle normals; null = no usable triangle at its position. */
function vertexNormals(A, normal, vertices, smoothingAngle) {
  const { weld, members, start, list } = A, limit = Math.cos(smoothingAngle * Math.PI / 180) + 1e-6;
  const seen = new Int32Array(A.T).fill(-1), out = new Map();
  for (const v of vertices) {
    let ox = 0, oy = 0, oz = 0;
    for (let i = start[v]; i < start[v + 1]; i++) { const t = list[i]; ox += normal[t * 3]; oy += normal[t * 3 + 1]; oz += normal[t * 3 + 2]; }
    // A vertex without triangles of its own takes the shading at its position.
    const own = Math.hypot(ox, oy, oz), alone = !(own > 1e-9);
    if (!alone) { ox /= own; oy /= own; oz /= own; }
    let sx = 0, sy = 0, sz = 0;
    for (const u of members[weld[v]]) for (let i = start[u]; i < start[u + 1]; i++) {
      const t = list[i]; if (seen[t] === v) continue; seen[t] = v;
      const nx = normal[t * 3], ny = normal[t * 3 + 1], nz = normal[t * 3 + 2];
      // A vertex has one normal, so its own triangles always count (the SD
      // models' 3-sided bands lean the same way); the angle only decides
      // which triangles of other vertices at this position join in.
      if (alone || u === v || nx * ox + ny * oy + nz * oz > limit) { sx += nx; sy += ny; sz += nz; }
    }
    const length = Math.hypot(sx, sy, sz);
    out.set(v, length > 1e-9 ? [sx / length, sy / length, sz / length] : alone ? null : [ox, oy, oz]);
  }
  return out;
}

/** Turn computed normals (and optional flipped triangles) into per-geoset streams. */
function buildPlan(A, normals, flipped, stats) {
  const geosets = [];
  let normalsChanged = 0;
  for (const slot of A.slots) {
    const g = slot.g, Normals = g.Normals.slice(), refresh = new Set();
    let Faces = null;
    for (let v = 0; v < slot.count; v++) {
      const n = normals.get(slot.base + v); if (!n) continue;
      const old = [g.Normals[v * 3], g.Normals[v * 3 + 1], g.Normals[v * 3 + 2]], length = Math.hypot(...old);
      Normals.set(n, v * 3);
      if (Normals[v * 3] === old[0] && Normals[v * 3 + 1] === old[1] && Normals[v * 3 + 2] === old[2]) continue;
      refresh.add(v);
      if (!(length > 1e-12 && (n[0] * old[0] + n[1] * old[1] + n[2] * old[2]) / length >= VISIBLE)) normalsChanged++;
    }
    for (let f = 0; f < slot.triangles; f++) if (flipped?.[slot.triangleBase + f]) {
      Faces ||= g.Faces.slice();
      const swap = Faces[f * 3 + 1]; Faces[f * 3 + 1] = Faces[f * 3 + 2]; Faces[f * 3 + 2] = swap;
      for (let k = 0; k < 3; k++) refresh.add(Faces[f * 3 + k]);
    }
    if (!refresh.size) continue;
    const entry = { index: slot.index, vertexCount: slot.count, faceCount: g.Faces.length, Normals };
    if (Faces) entry.Faces = Faces;
    if (g.Tangents?.length === slot.count * 4) {
      // HD: tangents follow the new normals (and UV handedness of flipped triangles).
      const rebuilt = forgeTangents({ ...g, Normals, Faces: Faces || g.Faces });
      entry.Tangents = g.Tangents.slice();
      for (const v of refresh) entry.Tangents.set(rebuilt.subarray(v * 4, v * 4 + 4), v * 4);
    }
    geosets.push(entry);
  }
  return { geosets, stats: { ...stats, normalsChanged, changed: geosets.length > 0 } };
}

const checkAngle = angle => (Number.isFinite(angle) && angle >= 0 && angle <= 180) || fail('Invalid smoothing angle.');

/** Recalculate the normals of every vertex in scope. Nothing in the model is changed. */
export function planNormalRebuild(A, { smoothingAngle = DEFAULT_SMOOTHING_ANGLE } = {}) {
  checkAngle(smoothingAngle);
  const vertices = [];
  for (const slot of A.slots) for (let v = 0; v < slot.count; v++) if (!slot.picked || slot.picked.has(v)) vertices.push(slot.base + v);
  return { ...buildPlan(A, vertexNormals(A, A.normal, vertices, smoothingAngle), null, { trianglesFlipped: 0 }), settings: { smoothingAngle } };
}

/**
 * Fix facing: in each connected piece (triangles of one geoset joined by edges
 * at the same positions), triangles wound against the piece's majority are
 * flipped, even a whole patch of them, and a closed piece that is inside out
 * (negative volume) is reversed. An open band, sleeve or ring around a limb
 * (two boundary loops that both go around one axis) is turned to face away
 * from its axis, as every such piece in the SD unit models does. Back-to-back
 * twins, other open pieces without a clear majority (or as a whole) and pieces
 * that cannot be wound consistently are left alone. With a selection, pieces
 * touching it are repaired whole. The normals around flipped triangles are
 * recalculated as above.
 */
export function planFacingFix(A, { smoothingAngle = DEFAULT_SMOOTHING_ANGLE } = {}) {
  checkAngle(smoothingAngle);
  const { T, tv, weld, normal, area, degenerate, P } = A, tw = i => weld[tv[i]];
  const point = w => { const v = A.members[w][0] * 3; return [P[v], P[v + 1], P[v + 2]]; };
  // Band facing: 1 or -1 (the side of `sign` that faces away from the axis), 0 = not a band or unclear.
  const bandFacing = (piece, sign, use) => {
    const next = new Map();
    for (const [key, n] of use) if (n === 1) {
      const [a, b] = key.split(',').map(Number);
      for (const [x, y] of [[a, b], [b, a]]) { if (!next.has(x)) next.set(x, []); next.get(x).push(y); }
    }
    if (!next.size || [...next.values()].some(list => list.length !== 2 || list[0] === list[1])) return 0;
    const loops = [], seen = new Set();
    for (const start of next.keys()) if (!seen.has(start)) {
      const loop = []; let at = start, from = -1;
      do { seen.add(at); loop.push(at); const [x, y] = next.get(at), to = x === from ? y : x; from = at; at = to; } while (at !== start && !seen.has(at));
      if (at !== start || loop.length < 3) return 0;
      loops.push(loop.map(point));
    }
    if (loops.length !== 2) return 0;
    const [c0, c1] = loops.map(loop => loop.reduce((c, p) => c.map((x, k) => x + p[k] / loop.length), [0, 0, 0]));
    const axis = c1.map((x, k) => x - c0[k]), length2 = axis.reduce((s, x) => s + x * x, 0);
    if (!(length2 > 0)) return 0;
    const radial = p => { const d = p.map((x, k) => x - c0[k]), s = d.reduce((t, x, k) => t + x * axis[k], 0) / length2; return d.map((x, k) => x - axis[k] * s); };
    // Both loops go once around the axis (a flap or a strip does not).
    const e1 = radial(loops[0][0]), e2 = [axis[1] * e1[2] - axis[2] * e1[1], axis[2] * e1[0] - axis[0] * e1[2], axis[0] * e1[1] - axis[1] * e1[0]];
    for (const loop of loops) {
      let turn = 0, last = null;
      for (const p of [...loop, loop[0]]) {
        const r = radial(p), x = r[0] * e1[0] + r[1] * e1[1] + r[2] * e1[2], y = r[0] * e2[0] + r[1] * e2[1] + r[2] * e2[2];
        if (!(Math.hypot(x, y) > 0)) return 0;
        const angle = Math.atan2(y, x);
        if (last !== null) turn += ((angle - last + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
        last = angle;
      }
      if (Math.abs(turn) < Math.PI) return 0;
    }
    let vote = 0, total = 0;
    for (const t of piece) {
      const c = [0, 1, 2].map(k => (P[tv[t * 3] * 3 + k] + P[tv[t * 3 + 1] * 3 + k] + P[tv[t * 3 + 2] * 3 + k]) / 3), r = radial(c), length = Math.hypot(...r);
      if (!(length > 0)) continue;
      const out = (normal[t * 3] * r[0] + normal[t * 3 + 1] * r[1] + normal[t * 3 + 2] * r[2]) / length;
      vote += sign[t] * area[t] * out; total += area[t] * Math.abs(out);
    }
    return total > 0 && Math.abs(vote) > total * .5 ? Math.sign(vote) : 0;
  };
  // Triangles at the same three positions: opposite winding = a two-sided
  // sheet (twins, never touched); same winding = copies that follow the first.
  const twin = new Uint8Array(T), copyOf = new Int32Array(T).fill(-1), byPositions = new Map();
  const parity = t => { const a = tw(t * 3), b = tw(t * 3 + 1), c = tw(t * 3 + 2); return (a < b) + (b < c) + (c < a) === 2 ? 1 : -1; };
  for (let t = 0; t < T; t++) if (!degenerate[t]) {
    const key = [tw(t * 3), tw(t * 3 + 1), tw(t * 3 + 2)].sort((a, b) => a - b).join(',');
    if (!byPositions.has(key)) byPositions.set(key, []); byPositions.get(key).push(t);
  }
  for (const same of byPositions.values()) if (same.length > 1) {
    const sides = new Map();
    for (const t of same) { const side = parity(t); if (sides.has(side)) copyOf[t] = sides.get(side); else sides.set(side, t); }
    if (sides.size === 2) for (const t of same) twin[t] = 1;
  }
  const slotOf = new Int32Array(T);
  A.slots.forEach((slot, i) => slotOf.fill(i, slot.triangleBase, slot.triangleBase + slot.triangles));
  const active = t => !degenerate[t] && !twin[t] && copyOf[t] < 0;
  // Pair the triangles around each edge, consistently wound and flattest pairs first.
  const edges = new Map();
  for (let t = 0; t < T; t++) if (active(t)) for (let k = 0; k < 3; k++) {
    const a = tw(t * 3 + k), b = tw(t * 3 + (k + 1) % 3), key = slotOf[t] + ':' + (a < b ? a + ',' + b : b + ',' + a);
    if (!edges.has(key)) edges.set(key, []); edges.get(key).push([t, a < b ? 1 : -1]);
  }
  const links = Array.from({ length: T }, () => []);
  for (const around of edges.values()) {
    if (around.length < 2) continue;
    const candidates = [];
    for (let i = 0; i < around.length; i++) for (let j = i + 1; j < around.length; j++) {
      const [s, ds] = around[i], [t, dt] = around[j], compatible = ds !== dt;
      const c = (normal[s * 3] * normal[t * 3] + normal[s * 3 + 1] * normal[t * 3 + 1] + normal[s * 3 + 2] * normal[t * 3 + 2]) * (compatible ? 1 : -1);
      candidates.push([s, t, compatible, c]);
    }
    candidates.sort((x, y) => (y[2] - x[2]) || (y[3] - x[3]));
    const used = new Set();
    for (const [s, t, compatible] of candidates) {
      if (used.has(s) || used.has(t)) continue;
      used.add(s); used.add(t); links[s].push(t, compatible ? 1 : -1); links[t].push(s, compatible ? 1 : -1);
    }
  }
  const sign = new Int8Array(T), flipped = new Uint8Array(T);
  let trianglesFlipped = 0;
  for (let seed = 0; seed < T; seed++) {
    if (sign[seed] || !active(seed)) continue;
    const piece = [seed]; sign[seed] = 1; let conflict = false;
    for (let cursor = 0; cursor < piece.length; cursor++) {
      const t = piece[cursor];
      for (let i = 0; i < links[t].length; i += 2) {
        const next = links[t][i], wanted = sign[t] * links[t][i + 1];
        if (!sign[next]) { sign[next] = wanted; piece.push(next); } else if (sign[next] !== wanted) conflict = true;
      }
    }
    if (conflict || !piece.some(t => A.inScope[t])) continue;
    let plus = 0, minus = 0;
    for (const t of piece) if (sign[t] > 0) plus += area[t]; else minus += area[t];
    // Open pieces need a clear majority; closed ones are decided by volume.
    let major = plus >= minus ? 1 : -1, sure = Math.min(plus, minus) <= .4 * (plus + minus);
    // Closed: every edge of the piece is used twice or more inside it.
    const use = new Map();
    for (const t of piece) for (let k = 0; k < 3; k++) { const a = tw(t * 3 + k), b = tw(t * 3 + (k + 1) % 3), key = a < b ? a + ',' + b : b + ',' + a; use.set(key, (use.get(key) || 0) + 1); }
    if ([...use.values()].every(n => n >= 2)) {
      const center = [0, 0, 0];
      for (const t of piece) for (let k = 0; k < 9; k++) center[k % 3] += P[tv[t * 3 + ((k / 3) | 0)] * 3 + k % 3] / (piece.length * 3);
      let volume = 0, absolute = 0;
      for (const t of piece) {
        const [a, b, c] = [0, 1, 2].map(k => [0, 1, 2].map(axis => P[tv[t * 3 + k] * 3 + axis] - center[axis]));
        const value = a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
        volume += sign[t] * major * value; absolute += Math.abs(value);
      }
      if (absolute > 0 && Math.abs(volume) / absolute > .02) { if (volume < 0) major = -major; sure = true; }
    } else {
      // A band around a limb faces outward, even when it is wholly inside out or half and half.
      const band = bandFacing(piece, sign, use);
      if (band) { major = band; sure = true; }
    }
    if (!sure) continue;
    for (const t of piece) if (sign[t] !== major) { flipped[t] = 1; trianglesFlipped++; }
  }
  for (let t = 0; t < T; t++) if (copyOf[t] >= 0 && flipped[copyOf[t]]) { flipped[t] = 1; trianglesFlipped++; }
  if (!trianglesFlipped) return { geosets: [], stats: { trianglesFlipped: 0, normalsChanged: 0, changed: false }, settings: { smoothingAngle } };
  // Recalculate normals at every position touched by a flipped triangle.
  const turned = A.normal.slice(), affected = new Set();
  for (let t = 0; t < T; t++) if (flipped[t]) for (let k = 0; k < 3; k++) { turned[t * 3 + k] = -turned[t * 3 + k]; for (const v of A.members[weld[tv[t * 3 + k]]]) affected.add(v); }
  return { ...buildPlan(A, vertexNormals(A, turned, affected, smoothingAngle), flipped, { trianglesFlipped }), settings: { smoothingAngle } };
}

/** Commit a plan. Run inside EditorDocument.apply so it is one undo step. */
export function applyNormalRebuild(model, plan) {
  for (const entry of plan.geosets) {
    const g = model.Geosets?.[entry.index];
    if (!g || g.Vertices.length / 3 !== entry.vertexCount || g.Faces.length !== entry.faceCount) fail('The model changed. Open NormalsXL again.');
  }
  for (const entry of plan.geosets) {
    const g = model.Geosets[entry.index];
    g.Normals = entry.Normals.slice();
    if (entry.Faces) g.Faces = entry.Faces.slice();
    if (entry.Tangents) g.Tangents = entry.Tangents.slice();
  }
  return plan.stats;
}

/** A copy of the model whose affected geosets show the planned result. */
export function previewNormalRebuild(model, plan) {
  if (!plan?.geosets.length) return model;
  const geosets = model.Geosets.slice();
  for (const { index, Normals, Faces, Tangents } of plan.geosets) geosets[index] = { ...geosets[index], Normals, ...(Faces && { Faces }), ...(Tangents && { Tangents }) };
  return { ...model, Geosets: geosets };
}

/** One-call helpers for scripts and tests. They mutate the model. */
export function rebuildNormals(model, { geosets, selection, ...settings } = {}) {
  const plan = planNormalRebuild(analyzeNormals(model, { geosets, selection }), settings);
  applyNormalRebuild(model, plan);
  return plan;
}
export function fixFacing(model, { geosets, selection, ...settings } = {}) {
  const plan = planFacingFix(analyzeNormals(model, { geosets, selection }), settings);
  applyNormalRebuild(model, plan);
  return plan;
}
