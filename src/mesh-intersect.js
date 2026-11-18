// Clipping between parts of a model through its animations: triangle edges of one part crossing
// triangles of another, counted the way the owner's proven animation check does (every 5 ms, a 2%
// margin inside each triangle and along each edge, so parts that only touch or share a vertex do not
// count). Parts are geoset/bone groups; without them the rig is split into weapon, shield, arm, head,
// body, leg and mount parts. Read-only, except pushOutVertices, which scripts call on purpose.
import { Vector3 } from 'three';
import { allNodes, sampleGeosetAnimation, sampleNodeMatrices, skinGeoset, unskinGeosetPoint } from './animation.js';
import { animation, animationFrames } from './ai-motion-compare.js';
import { nodeIndex } from './node-hierarchy.js';
import { vertexBoneWeights } from './part-bones.js';
import { suggestPoseRig } from './pose-ik.js';
import { isWeaponName, nameTokens } from './rig-names.js';
import { isTeamGlowLayer } from './texture-references.js';
import { referenceSequence } from './ai-motion-style.js';

const MARGIN = .02;
const index = id => Number.isInteger(id) && id >= 0;
const round = (value, digits = 2) => value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));

// Segment P0-P1 against triangle ABC (Moller-Trumbore), with the owner's margins: the crossing must lie
// more than 2% inside the triangle and more than 2% from either end of the segment. Returns the
// segment parameter t, or -1.
function segmentTriangle(p, q, tri) {
  const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
  const e1x = tri[3] - tri[0], e1y = tri[4] - tri[1], e1z = tri[5] - tri[2];
  const e2x = tri[6] - tri[0], e2y = tri[7] - tri[1], e2z = tri[8] - tri[2];
  const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x;
  const a = e1x * hx + e1y * hy + e1z * hz;
  if (Math.abs(a) <= 1e-9) return -1;
  const f = 1 / a, sx = p[0] - tri[0], sy = p[1] - tri[1], sz = p[2] - tri[2];
  const u = f * (sx * hx + sy * hy + sz * hz);
  if (u <= MARGIN) return -1;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
  const v = f * (dx * qx + dy * qy + dz * qz);
  if (v <= MARGIN || u + v >= 1 - MARGIN) return -1;
  const t = f * (e2x * qx + e2y * qy + e2z * qz);
  return t > MARGIN && t < 1 - MARGIN ? t : -1;
}

// Geosets that show solid surfaces: not purely additive or team-glow effect planes.
export function solidGeosets(model) {
  return (model.Geosets || []).flatMap((geoset, i) => {
    const layers = model.Materials?.[geoset.MaterialID]?.Layers || [];
    const effect = layers.length && layers.every(layer => [3, 4].includes(layer.FilterMode) || isTeamGlowLayer(model, layer));
    return effect || !geoset.Faces?.length ? [] : [i];
  });
}

// ---- Parts --------------------------------------------------------------------------------------

/** Rig parts by bone: weapon, shield, arm, head, body, leg and mount (a ridden animal), read from the
 * POSE rig (limb chains, head, body) plus the Weapon Ref attachment and weapon/shield bone names. */
export function rigPartLabels(model) {
  const nodes = allNodes(model), tree = nodeIndex(model, nodes), { byId } = tree, labels = new Map();
  const below = id => nodes.filter(node => tree.isAncestor(node.ObjectId, id)).map(node => node.ObjectId);
  const sequence = referenceSequence(model);
  let rig = { chains: [], roles: {} };
  try { rig = suggestPoseRig(model, sequence >= 0 ? model.Sequences[sequence].Interval[0] : 0, sequence, { clues: false }); } catch { /* names only */ }
  const pivotZ = id => (byId.get(id)?.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0])[2];
  const legs = rig.chains.filter(c => c.kind === 'leg'), arms = rig.chains.filter(c => c.kind === 'arm' && c.label !== 'Chain' && c.label !== 'Wing');
  // A ridden animal: legs that reach the ground while other legs (the rider's) stay well above it.
  const ground = legs.length ? Math.min(...legs.map(c => pivotZ(c.end))) : 0;
  const span = legs.length ? Math.max(...legs.map(c => Math.abs(pivotZ(c.root) - pivotZ(c.end)))) : 0;
  const low = legs.filter(c => pivotZ(c.end) <= ground + Math.max(4, span * .25)), high = legs.filter(c => !low.includes(c));
  const common = ids => ids.length ? ids.map(id => tree.ancestors(id, true)).reduce((a, b) => a.filter(x => b.includes(x)))[0] ?? null : null;
  // Ridden: two grounded legs under raised (rider) legs, or four grounded legs and arms. The rider
  // starts at the topmost joint above the arms that the mount's legs do not share.
  if (low.length >= 2 && (high.length || (low.length >= 4 && arms.length))) {
    const mount = common(low.map(c => c.root)), rider = common([...high, ...arms].map(c => c.root));
    if (mount != null && rider != null) {
      const shared = new Set(tree.ancestors(mount, true));
      const riderRoot = tree.ancestors(rider, true).reverse().find(id => !shared.has(id));
      if (riderRoot != null) {
        const riderSet = new Set(below(riderRoot));
        for (const id of below(tree.root(mount))) if (!riderSet.has(id)) labels.set(id, 'mount');
      }
    }
  }
  const set = (ids, label) => { for (const id of ids) if (!labels.has(id)) labels.set(id, label); };
  // Weapons: the node a Weapon Ref hangs from, and weapon-named nodes, with everything below them.
  for (const ref of model.Attachments || []) if (/weapon/i.test(ref.Name || '') && byId.has(ref.Parent) && labels.get(ref.Parent) !== 'mount') set(below(ref.Parent), 'weapon');
  for (const node of nodes) {
    if (labels.has(node.ObjectId)) continue;
    const tokens = nameTokens(node.Name);
    if (tokens.includes('shield')) set(below(node.ObjectId), 'shield');
    else if (isWeaponName(node.Name) && !/\bref\b/i.test(node.Name || '')) set(below(node.ObjectId), 'weapon');
  }
  for (const [id, role] of Object.entries(rig.roles || {})) if (['Head', 'Neck'].includes(role)) set(below(Number(id)), 'head');
  for (const node of nodes) if (/head/i.test(node.Name || '') && !/\bref\b/i.test(node.Name || '') && !labels.has(node.ObjectId)) set(below(node.ObjectId), 'head');
  for (const chain of arms) set(below(chain.root), 'arm');
  for (const chain of legs) set(below(chain.root), 'leg');
  for (const node of nodes) if (!labels.has(node.ObjectId)) labels.set(node.ObjectId, 'body');
  return labels;
}

// A vertex's part: the label of its heaviest bone (ties: the first listed).
function vertexLabel(geoset, v, labels) {
  const weights = vertexBoneWeights(geoset, v);
  if (!weights.length) return 'body';
  const score = new Map();
  for (const [id, w] of weights) { const label = labels.get(id) || 'body'; score.set(label, (score.get(label) || 0) + w); }
  return [...score].sort((a, b) => b[1] - a[1])[0][0];
}

/** Triangles of one part: { geosets?, nodeIds?, exclude? } (whole geosets, and/or triangles whose
 * vertices all hang on these bones or bones below them, minus triangles touching excluded bones),
 * or { label } for an automatic rig part. Returns [{ geoset, faces: triangle indices }]. */
export function partTriangles(model, spec, labels) {
  const all = solidGeosets(model);
  if (spec.geosets !== undefined && (!Array.isArray(spec.geosets) || spec.geosets.some(gi => !index(gi) || !model.Geosets?.[gi])))
    throw Error('Invalid geosets for a clipping part.');
  const nodes = allNodes(model), tree = nodeIndex(model, nodes), ids = new Set(nodes.map(n => n.ObjectId));
  for (const key of ['nodeIds', 'exclude']) if (spec[key] !== undefined && (!Array.isArray(spec[key]) || spec[key].some(id => !ids.has(id))))
    throw Error('Invalid bones for a clipping part.');
  const within = list => { if (!list?.length) return null; const roots = new Set(list); return id => tree.ancestors(id, true).some(a => roots.has(a)); };
  const keep = within(spec.nodeIds), drop = within(spec.exclude);
  const geosets = spec.geosets ?? all, out = [];
  for (const gi of geosets) {
    const geoset = model.Geosets[gi], count = geoset.Vertices.length / 3, ok = new Uint8Array(count);
    for (let v = 0; v < count; v++) {
      const bones = vertexBoneWeights(geoset, v).map(([id]) => id);
      if (spec.label !== undefined) ok[v] = vertexLabel(geoset, v, labels) === spec.label ? 1 : 0;
      else ok[v] = (!keep || (bones.length && bones.some(keep))) && !(drop && bones.some(drop)) ? 1 : 0;
    }
    const faces = [];
    for (let f = 0; f < geoset.Faces.length / 3; f++) {
      const a = geoset.Faces[f * 3], b = geoset.Faces[f * 3 + 1], c = geoset.Faces[f * 3 + 2];
      if (a < count && b < count && c < count && ok[a] && ok[b] && ok[c] && a !== b && b !== c && a !== c) faces.push(f);
    }
    if (faces.length) out.push({ geoset: gi, faces: Int32Array.from(faces) });
  }
  return out;
}

// The rig's parts with triangles, and the pairs the owner's check looks at.
const PAIRS = [['weapon', 'body'], ['weapon', 'head'], ['weapon', 'leg'], ['weapon', 'mount'], ['weapon', 'shield'],
  ['shield', 'body'], ['shield', 'head'], ['shield', 'leg'], ['shield', 'mount'], ['arm', 'head'], ['arm', 'mount'], ['leg', 'mount']];
export function automaticParts(model) {
  const labels = rigPartLabels(model), parts = {};
  for (const label of ['weapon', 'shield', 'arm', 'head', 'body', 'leg', 'mount']) {
    const triangles = partTriangles(model, { label }, labels);
    if (triangles.length) parts[label] = triangles;
  }
  return { parts, pairs: PAIRS.filter(([a, b]) => parts[a] && parts[b]) };
}

// ---- Counting crossings in one pose -------------------------------------------------------------

// Posed triangles of a part as flat [ax,ay,az,bx,...] rows, with their source vertex ids.
function posedPart(model, part, posed, visible) {
  let count = 0;
  for (const { geoset, faces } of part) if (visible.get(geoset)) count += faces.length;
  const coords = new Float32Array(count * 9), refs = new Int32Array(count * 4);
  let t = 0;
  for (const { geoset, faces } of part) {
    if (!visible.get(geoset)) continue;
    const p = posed.get(geoset), source = model.Geosets[geoset].Faces;
    for (const f of faces) {
      for (let k = 0; k < 3; k++) { const v = source[f * 3 + k]; coords.set(p.subarray(v * 3, v * 3 + 3), t * 9 + k * 3); refs[t * 4 + 1 + k] = v; }
      refs[t * 4] = geoset; t++;
    }
  }
  return { coords, refs, count };
}
// Box [minX, minY, minZ, maxX, maxY, maxZ] of `points` xyz triples in a flat array.
function bounds(coords, points, out = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]) {
  for (let i = 0; i < points; i++) for (let k = 0; k < 3; k++) { const v = coords[i * 3 + k]; if (v < out[k]) out[k] = v; if (v > out[k + 3]) out[k + 3] = v; }
  return out;
}
// The outward unit normal of triangle t (MDX winding: (b - a) x (c - a) points out).
function faceNormal(c, t) {
  const o = t * 9, ux = c[o + 3] - c[o], uy = c[o + 4] - c[o + 1], uz = c[o + 5] - c[o + 2], vx = c[o + 6] - c[o], vy = c[o + 7] - c[o + 1], vz = c[o + 8] - c[o + 2];
  const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx], length = Math.hypot(...n) || 1;
  return n.map(v => v / length);
}
const behind = (c, t, n, point) => (point[0] - c[t * 9]) * n[0] + (point[1] - c[t * 9 + 1]) * n[1] + (point[2] - c[t * 9 + 2]) * n[2];
const triangleBox = (c, t) => {
  const o = t * 9;
  return [Math.min(c[o], c[o + 3], c[o + 6]), Math.min(c[o + 1], c[o + 4], c[o + 7]), Math.min(c[o + 2], c[o + 5], c[o + 8]),
    Math.max(c[o], c[o + 3], c[o + 6]), Math.max(c[o + 1], c[o + 4], c[o + 7]), Math.max(c[o + 2], c[o + 5], c[o + 8])];
};
const overlaps = (a, b) => a[0] <= b[3] && b[0] <= a[3] && a[1] <= b[4] && b[1] <= a[4] && a[2] <= b[5] && b[2] <= a[5];

// Edges of `from` (three per triangle, as the owner's check counts them) crossing triangles of `to`,
// through a uniform grid over the overlap of both parts. Calls hit(edgeOwner, corner, toTriangle, t).
function crossEdges(from, to, region, hit) {
  const candidates = [];
  for (let t = 0; t < to.count; t++) if (overlaps(triangleBox(to.coords, t), region)) candidates.push(t);
  if (!candidates.length) return 0;
  const n = Math.max(1, Math.min(16, Math.round(Math.cbrt(candidates.length / 2)))), size = [0, 1, 2].map(k => Math.max(1e-6, (region[k + 3] - region[k]) / n));
  const cell = (v, k) => Math.max(0, Math.min(n - 1, Math.floor((v - region[k]) / size[k])));
  const grid = new Map();
  for (const t of candidates) {
    const box = triangleBox(to.coords, t);
    for (let x = cell(box[0], 0); x <= cell(box[3], 0); x++) for (let y = cell(box[1], 1); y <= cell(box[4], 1); y++)
      for (let z = cell(box[2], 2); z <= cell(box[5], 2); z++) { const key = (x * n + y) * n + z; (grid.get(key) || grid.set(key, []).get(key)).push(t); }
  }
  const stamp = new Int32Array(to.count).fill(-1), tri = new Float32Array(9);
  let crossings = 0, stamps = 0;
  for (let s = 0; s < from.count; s++) {
    const o = s * 9;
    for (let e = 0; e < 3; e++) {
      const p = from.coords.subarray(o + e * 3, o + e * 3 + 3), q = from.coords.subarray(o + ((e + 1) % 3) * 3, o + ((e + 1) % 3) * 3 + 3);
      const box = [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2]), Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.max(p[2], q[2])];
      if (!overlaps(box, region)) continue;
      stamps++;
      for (let x = cell(box[0], 0); x <= cell(box[3], 0); x++) for (let y = cell(box[1], 1); y <= cell(box[4], 1); y++)
        for (let z = cell(box[2], 2); z <= cell(box[5], 2); z++) for (const t of grid.get((x * n + y) * n + z) || []) {
          if (stamp[t] === stamps) continue;
          stamp[t] = stamps;
          tri.set(to.coords.subarray(t * 9, t * 9 + 9));
          const at = segmentTriangle(p, q, tri);
          if (at >= 0) { crossings++; hit?.(s, e, t, at, p, q); }
        }
    }
  }
  return crossings;
}

// The box where two parts overlap, or null.
function overlapRegion(a, b) {
  if (!a.count || !b.count) return null;
  const boxA = bounds(a.coords, a.count * 3), boxB = bounds(b.coords, b.count * 3);
  if (!overlaps(boxA, boxB)) return null;
  return [0, 1, 2].map(k => Math.max(boxA[k], boxB[k]) - 1e-6).concat([0, 1, 2].map(k => Math.min(boxA[k + 3], boxB[k + 3]) + 1e-6));
}

// Crossings both ways (A's edges through B, B's edges through A) in one pose; with detail, the size of
// the clipping region, the depth (how far the inside end of a crossing edge sits behind the face it
// crosses, the largest) and the vertices involved.
function countCrossings(a, b, detail = false) {
  const region = overlapRegion(a, b);
  if (!region) return detail ? { crossings: 0 } : 0;
  if (!detail) return crossEdges(a, b, region) + crossEdges(b, a, region);
  const points = [], vertices = { a: new Map(), b: new Map() };
  let depth = 0;
  const note = (side, part, t, corners) => { for (const k of corners) { const gi = part.refs[t * 4], set = vertices[side].get(gi) || vertices[side].set(gi, new Set()).get(gi); set.add(part.refs[t * 4 + 1 + k]); } };
  const record = (from, to, sides) => (s, e, t, at, p, q) => {
    points.push(p[0] + (q[0] - p[0]) * at, p[1] + (q[1] - p[1]) * at, p[2] + (q[2] - p[2]) * at);
    const n = faceNormal(to.coords, t);
    depth = Math.max(depth, -Math.min(behind(to.coords, t, n, p), behind(to.coords, t, n, q)));
    note(sides[0], from, s, [e, (e + 1) % 3]); note(sides[1], to, t, [0, 1, 2]);
  };
  const crossings = crossEdges(a, b, region, record(a, b, ['a', 'b'])) + crossEdges(b, a, region, record(b, a, ['b', 'a']));
  const box = bounds(points, points.length / 3);
  const list = side => Object.fromEntries([...vertices[side]].map(([gi, ids]) => [gi, [...ids].sort((x, y) => x - y).slice(0, 32)]));
  return { crossings, depth: round(depth), extent: points.length ? round(Math.max(box[3] - box[0], box[4] - box[1], box[5] - box[2])) : 0, vertices: { a: list('a'), b: list('b') } };
}

// Skinned positions of the geosets two parts use, and which are visible, at one time.
function poseParts(model, geosets, matrices, clip, frame, buffers) {
  const posed = new Map(), visible = new Map();
  for (const gi of geosets) {
    const geoset = model.Geosets[gi];
    visible.set(gi, !clip || sampleGeosetAnimation(clip.model, gi, frame, clip.sequence).alpha >= .01);
    posed.set(gi, skinGeoset(geoset, matrices, buffers.get(gi) || buffers.set(gi, new Float32Array(geoset.Vertices.length)).get(gi)));
  }
  return { posed, visible };
}

// ---- The sweep ---------------------------------------------------------------------------------

function clipList(model, { sequences, globalSequence }) {
  if (sequences !== undefined && (!Array.isArray(sequences) || !sequences.length || sequences.some(i => !index(i) || !model.Sequences?.[i])))
    throw Error('Invalid sweep sequence list.');
  if (globalSequence !== undefined && (!index(globalSequence) || !(model.GlobalSequences?.[globalSequence] > 0))) throw Error('Invalid sweep global sequence.');
  const all = sequences === undefined && globalSequence === undefined;
  // By default every local animation except Decay (a corpse lying for a minute).
  const local = all ? (model.Sequences || []).flatMap((s, i) => /^\s*decay/i.test(s.Name || '') ? [] : [i]) : [...new Set(sequences || [])];
  const globals = all ? [] : globalSequence === undefined ? [] : [globalSequence];
  return [...local.map(sequence => ({ sequence })), ...globals.map(g => ({ globalSequence: g }))];
}

/**
 * Clipping between two parts (rule.a and rule.b: { geosets?, nodeIds?, exclude? }) or, when both are
 * omitted, between the rig's automatic parts (weapon, shield, arm, head, body, leg, mount), through
 * every listed animation (default all local animations) at rule.step ms (default 5, the owner's
 * check). Per pair: the crossings in the reference pose (rest), and per animation the frames with
 * crossings, the worst frame and its count. The worst frame of each pair adds depth, the size of the
 * clipping region and the vertices involved (for capture vertices). limit: frames with more crossings
 * than this count as hits (default 0).
 */
export async function sweepIntersections(model, rule = {}, signal) {
  const step = rule.step ?? 5, limit = rule.limit ?? 0;
  if (!(Number.isFinite(step) && step >= 1 && step <= 1000)) throw Error('Choose a clipping step of 1-1000 ms.');
  if (!(Number.isFinite(limit) && limit >= 0)) throw Error('Choose a finite nonnegative sweep limit.');
  const explicit = rule.a !== undefined || rule.b !== undefined;
  if (explicit && (!rule.a || !rule.b)) throw Error('Choose both parts A and B, or neither for automatic parts.');
  let pairs;
  if (explicit) {
    for (const [label, spec] of [['A', rule.a], ['B', rule.b]])
      if (!spec || typeof spec !== 'object' || ['nodeId', 'geoset', 'vertices'].some(key => key in spec)) throw Error(`Part ${label} takes geosets, nodeIds and exclude.`);
    const a = partTriangles(model, rule.a), b = partTriangles(model, rule.b);
    if (!a.length || !b.length) throw Error(`Part ${a.length ? 'B' : 'A'} has no solid triangles.`);
    pairs = [{ a: 'a', b: 'b', parts: [a, b] }];
  } else {
    const found = automaticParts(model);
    pairs = found.pairs.map(([a, b]) => ({ a, b, parts: [found.parts[a], found.parts[b]] }));
    if (!pairs.length) return { kind: 'intersect', stepMs: step, parts: Object.keys(found.parts), pairs: [], note: 'No two rig parts to compare; name parts A and B.' };
  }
  const geosets = [...new Set(pairs.flatMap(p => p.parts.flat().map(x => x.geoset)))], buffers = new Map();
  const reference = referenceSequence(model), restClip = reference >= 0 ? animation(model, { sequence: reference }) : null;
  const restFrame = restClip ? restClip.interval[0] : 0;
  {
    const { posed, visible } = poseParts(model, geosets, sampleNodeMatrices(model, restFrame, restClip ? reference : -1), restClip, restFrame, buffers);
    for (const pair of pairs) pair.rest = countCrossings(posedPart(model, pair.parts[0], posed, visible), posedPart(model, pair.parts[1], posed, visible));
  }
  const columns = ['clip', 'framesSampled', 'framesHit', 'worst', 'worstMs', 'firstHitMs', 'lastHitMs'];
  for (const pair of pairs) { pair.rows = []; pair.worst = null; }
  let lastYield = performance.now();
  for (const selection of clipList(model, rule)) {
    const clip = animation(model, selection), [start, end] = clip.interval;
    const frames = animationFrames(clip.interval, step).frames;
    const stats = pairs.map(() => ({ hits: 0, worst: 0, worstMs: null, first: null, last: null }));
    for (const frame of frames) {
      if (performance.now() - lastYield >= 16) { await new Promise(resolve => setTimeout(resolve, 0)); lastYield = performance.now(); }
      signal?.throwIfAborted();
      const { posed, visible } = poseParts(model, geosets, sampleNodeMatrices(clip.model, frame, clip.sequence), clip, frame, buffers);
      pairs.forEach((pair, i) => {
        const count = countCrossings(posedPart(model, pair.parts[0], posed, visible), posedPart(model, pair.parts[1], posed, visible)), s = stats[i];
        if (count > limit) { s.hits++; s.first ??= frame - start; s.last = frame - start; }
        if (count > s.worst) { s.worst = count; s.worstMs = frame - start; }
        if (count > (pair.worst?.crossings ?? 0)) pair.worst = { clip: clip.name, ...selection, frame, crossings: count };
      });
    }
    pairs.forEach((pair, i) => { const s = stats[i]; pair.rows.push([clip.name, frames.length, s.hits, s.worst, s.worstMs, s.first, s.last]); });
  }
  // Detail for each pair's worst frame: depth, region size and the vertices involved.
  for (const pair of pairs) {
    if (!pair.worst) continue;
    const clip = animation(model, pair.worst.globalSequence != null ? { globalSequence: pair.worst.globalSequence } : { sequence: pair.worst.sequence });
    const { posed, visible } = poseParts(model, geosets, sampleNodeMatrices(clip.model, pair.worst.frame, clip.sequence), clip, pair.worst.frame, buffers);
    Object.assign(pair.worst, countCrossings(posedPart(model, pair.parts[0], posed, visible), posedPart(model, pair.parts[1], posed, visible), true));
  }
  return {
    kind: 'intersect', stepMs: step, rest: restClip ? `${restClip.name} start` : 'bind pose',
    ...(explicit ? {} : { parts: Object.fromEntries([...new Set(pairs.flatMap(p => [p.a, p.b]))].map(label => [label, pairs.find(p => p.a === label)?.parts[0] ?? pairs.find(p => p.b === label).parts[1]]).map(([label, part]) => [label, part.reduce((n, x) => n + x.faces.length, 0)])) }),
    columns,
    pairs: pairs.map(({ parts, ...pair }) => pair),
  };
}

// ---- Push out -----------------------------------------------------------------------------------

/**
 * Moves the vertices of part A that sit behind part B's surface out through it, at one frame of one
 * animation (default: the reference pose): each vertex at the inside end of an edge that crosses a
 * B triangle moves along that triangle's outward normal to `margin` (default 0.5) past it. It edits
 * bind-pose geometry (through each vertex's own skinning), so the change shows in every frame.
 * Repeats up to `rounds` times. Use it inside an editing script; returns { moved, maxMove, before,
 * after } with crossing counts.
 */
export function pushOutVertices(model, { a, b, sequence, frame, margin = .5, rounds = 6 } = {}) {
  if (!a || !b) throw Error('Choose parts A and B.');
  if (!(Number.isFinite(margin) && margin >= 0)) throw Error('Choose a nonnegative margin.');
  const partA = partTriangles(model, a), partB = partTriangles(model, b);
  const seq = sequence ?? referenceSequence(model);
  if (seq !== -1 && !model.Sequences?.[seq]) throw Error('Animation index is out of range.');
  const time = frame ?? (seq >= 0 ? model.Sequences[seq].Interval[0] : 0);
  const geosets = [...new Set([...partA, ...partB].map(x => x.geoset))], buffers = new Map();
  const clip = seq >= 0 ? animation(model, { sequence: seq }) : null;
  const measure = () => {
    const matrices = sampleNodeMatrices(model, time, seq), { posed, visible } = poseParts(model, geosets, matrices, clip, time, buffers);
    return { matrices, posed, A: posedPart(model, partA, posed, visible), B: posedPart(model, partB, posed, visible) };
  };
  let state = measure();
  const before = countCrossings(state.A, state.B), moved = new Set();
  let maxMove = 0;
  for (let pass = 0; pass < rounds; pass++) {
    const moves = new Map(), region = overlapRegion(state.A, state.B);
    if (!region) break;
    crossEdges(state.A, state.B, region, (s, e, t, at, p, q) => {
      // The end behind the crossed face (outward normal) moves out along the normal to margin past it.
      const n = faceNormal(state.B.coords, t), dp = behind(state.B.coords, t, n, p), dq = behind(state.B.coords, t, n, q);
      const corner = dp <= dq ? e : (e + 1) % 3, d = Math.min(dp, dq);
      if (d >= 0) return;
      const shift = new Vector3(...n).multiplyScalar(margin - d);
      const gi = state.A.refs[s * 4], vertex = state.A.refs[s * 4 + 1 + corner], key = gi + ':' + vertex;
      if (!moves.has(key) || moves.get(key).shift.length() < shift.length()) moves.set(key, { gi, vertex, shift });
    });
    if (!moves.size) break;
    for (const { gi, vertex, shift } of moves.values()) {
      const geoset = model.Geosets[gi], posed = state.posed.get(gi);
      const target = new Vector3().fromArray(posed, vertex * 3).add(shift);
      const local = unskinGeosetPoint(geoset, vertex, state.matrices, target);
      if (!local) continue;
      geoset.Vertices[vertex * 3] = local.x; geoset.Vertices[vertex * 3 + 1] = local.y; geoset.Vertices[vertex * 3 + 2] = local.z;
      moved.add(gi + ':' + vertex); maxMove = Math.max(maxMove, shift.length());
    }
    state = measure();
  }
  return { moved: moved.size, maxMove: round(maxMove), before, after: countCrossings(state.A, state.B) };
}
