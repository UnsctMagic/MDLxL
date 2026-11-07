import { Quaternion, Vector3 } from 'three';
import { allNodes, composeNodeMatrices, nodePivot, sampleGeosetAnimation, sampleNodeMatrices } from './animation.js';
import { isHdSkinned, vertexBones } from './part-bones.js';

// BindXL: binds vertices to bones from where they sit around the skeleton.
// The model's rest pose and skeleton are taken as correct; only bindings change.
//
// analyzeBinding() does the slow, setting-free work once per model: it flattens
// the vertices, finds the separate pieces, measures every vertex against every
// bone, finds what each piece sits on, samples the animations and judges how
// well every piece is bound now. planBinding() turns that into bone groups for
// the current sliders and piece marks, fast enough to run on every slider
// move. applyBinding() writes a plan into a model as ordinary vertex groups
// (classic) or bone weights (HD).
//
// What the engine does, in short:
// - A part that is bound well stays exactly as it is. "Well" is judged from
//   the animations: it keeps moving with what it sits on, and its bone is one
//   a well-bound model would use there.
// - A stiff part that needs a bone gets the bone of what it sits on, unless a
//   bone of its own sits inside it (a weapon, a wheel). The weights below come
//   from a study of well-bound models; they rank the candidate bones.
// - A bending part (skin, cloth) follows the skeleton per vertex, blended
//   across joints by Soft joints.
// - Vertices on exactly the same spot (seams) share one binding when both
//   sides belong to the same body, so seams never open and a rider never
//   glues to the mount.

export const BIND_DEFAULTS = Object.freeze({ soft: 0.3, plates: 0.5, protect: 1 });
export const PIECE_MODES = Object.freeze(['auto', 'plate', 'bend', 'keep']);
const MAX_BONES = 4, CANDIDATES = 6, NEAR = 3;
// How strongly each clue points at the bone a stiff part should follow, in the
// order pieceRows() builds them.
const RANK_WEIGHTS = [0, 1.203, .367, -.118, 1.941, 1.353, .737, .327, .496, .362, .936, .37, 0, .473, .349, .382, 1.714, 1.391, -.583, .03, .329, .254];
// How likely a part is to move stiffly with one bone, from its shape around the skeleton.
const KIND_WEIGHTS = [1.711, 1.539, .48, .675, -.002, -.99, -1.092, -1.173];
// A bound stiff part counts as wrongly bound only when both of these say so:
// its bone ranks this far below the best one, and in the animations it drifts
// this much further (share of model size) from what it sits on than the best
// bone would. Measured on well-bound models, this leaves 99.9% of their parts alone.
const DISTRUST_RANK = 6, DISTRUST_FIT = .02;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = a => Math.hypot(a[0], a[1], a[2]);
const weigh = (features, weights) => { let sum = 0; for (let i = 0; i < weights.length; i++) sum += features[i] * weights[i]; return sum; };

const articulated = node => ['Translation', 'Rotation', 'Scaling'].some(property => (node?.[property]?.Keys?.length || 0) > 1);

/**
 * The regions vertices can follow. A vertex follows a bone, but the bone moves
 * with the nearest node that actually animates: itself, or (in Blizzard-style
 * rigs) the helper joint it hangs under. Each such joint moves the space from
 * its pivot to the pivots of the joints below it; a joint with none below
 * reaches on along its parent's direction. Bones on the same joint move alike
 * and share one region; the one already holding most vertices represents it.
 */
export function bindingBones(model, scale = 100, current = []) {
  const nodes = allNodes(model).filter(node => (model.Bones || []).includes(node) || (model.Helpers || []).includes(node));
  const byId = new Map(nodes.map(node => [node.ObjectId, node]));
  const parentOf = id => { const parent = byId.get(id)?.Parent; return Number.isInteger(parent) && parent >= 0 && parent !== id && byId.has(parent) ? parent : null; };
  const anyArticulated = nodes.some(articulated);
  const driverOf = id => {
    const seen = new Set();
    for (let node = id; node !== null && !seen.has(node); node = parentOf(node)) { seen.add(node); if (!anyArticulated || articulated(byId.get(node))) return node; }
    return id;
  };
  const parentDriver = id => { const parent = parentOf(id); return parent === null ? null : driverOf(parent); };
  const pivot = id => Array.from(nodePivot(model, byId.get(id), id)).slice(0, 3);
  const uses = new Map(); for (const group of current) for (const bone of group) uses.set(bone, (uses.get(bone) || 0) + 1);
  // Joints: every driver, with the drivers directly below it.
  const drivers = new Map();
  const driverEntry = id => { if (!drivers.has(id)) drivers.set(id, { id, pivot: pivot(id), parent: parentDriver(id), children: [] }); return drivers.get(id); };
  for (const node of nodes) driverEntry(driverOf(node.ObjectId));
  for (const entry of [...drivers.values()]) if (entry.parent !== null) driverEntry(entry.parent);
  for (const entry of drivers.values()) if (entry.parent !== null && entry.parent !== entry.id) drivers.get(entry.parent).children.push(entry.id);
  const regions = new Map();
  for (const bone of model.Bones || []) {
    const driver = driverOf(bone.ObjectId);
    if (!regions.has(driver)) regions.set(driver, { driver, ids: [] });
    regions.get(driver).ids.push(bone.ObjectId);
  }
  const minimum = scale * 1e-3, spanOf = entry => Math.max(0, ...entry.children.map(child => length(sub(drivers.get(child).pivot, entry.pivot))));
  const list = [...regions.values()].map(region => {
    const entry = drivers.get(region.driver), ids = region.ids.sort((a, b) => (uses.get(b) || 0) - (uses.get(a) || 0) || a - b);
    const bone = byId.get(ids[0]), segments = [];
    for (const child of entry.children) { const end = drivers.get(child).pivot; if (length(sub(end, entry.pivot)) > minimum) segments.push([entry.pivot, end]); }
    let reach = spanOf(entry), leaf = !segments.length;
    const parent = entry.parent !== null ? drivers.get(entry.parent) : null;
    const direction = parent ? sub(entry.pivot, parent.pivot) : null, span = direction ? length(direction) : 0;
    // Only small end bones below (a jaw, mouth corners) leave the bone's own reach
    // to it: a head still reaches up past its pivot.
    const detailOnly = !leaf && span > minimum && entry.children.every(child => !drivers.get(child).children.length) && spanOf(entry) < span * .6;
    if (leaf || detailOnly) {
      // Reaches on along the parent joint's direction, half as far again as that joint's span.
      const extension = Math.max(parent ? spanOf(parent) * .5 : 0, span * .5, scale * .02);
      reach = Math.max(leaf ? 0 : reach, extension);
      segments.push(span > minimum ? [entry.pivot, entry.pivot.map((value, axis) => value + direction[axis] / span * extension)] : [entry.pivot, entry.pivot]);
    }
    return { id: ids[0], ids, name: bone?.Name || `Bone ${ids[0]}`, driver: region.driver, pivot: entry.pivot, parentDriver: entry.parent, segments, length: reach, leaf, own: ids.includes(region.driver) };
  });
  // Parent region: the nearest joint above that has bones of its own.
  const regionOfDriver = new Map(list.map((region, index) => [region.driver, index]));
  for (const region of list) {
    let parent = region.parentDriver, seen = new Set();
    while (parent !== null && !regionOfDriver.has(parent) && !seen.has(parent)) { seen.add(parent); parent = drivers.get(parent)?.parent ?? null; }
    region.parent = parent !== null && regionOfDriver.has(parent) ? list[regionOfDriver.get(parent)].id : null;
  }
  return list;
}

/** Shortest distance from point p to segment a-b. */
function segmentDistance(p, a, b) {
  const ab = sub(b, a), ap = sub(p, a), span = dot(ab, ab);
  const t = span > 0 ? Math.max(0, Math.min(1, dot(ap, ab) / span)) : 0;
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
}

function unionFind(count) {
  const parent = Int32Array.from({ length: count }, (_, index) => index);
  const find = index => { while (parent[index] !== index) index = parent[index] = parent[parent[index]]; return index; };
  return { parent, find, join: (a, b) => { a = find(a); b = find(b); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); } };
}

/** Geosets that show at some point of the unit's living animations. Portrait
 * backdrops often never show, and gibs only show while dying or decaying. */
function visibleGeosets(model, geosets) {
  const sequences = model.Sequences || [];
  if (!sequences.length) return new Set(geosets);
  const living = sequences.map((sequence, index) => [sequence, index]).filter(([sequence]) => !/death|decay|dissipate/i.test(sequence.Name || ''));
  const visible = new Set();
  for (const index of geosets) {
    for (const [sequence, at] of living.length ? living : sequences.map((sequence, at) => [sequence, at])) {
      if (visible.has(index)) break;
      const [start, end] = sequence.Interval;
      for (const t of [0, .5, 1]) { const frame = Math.round(start + (end - start) * t); if (sampleGeosetAnimation(model, index, frame, at, frame).alpha > .01) { visible.add(index); break; } }
    }
  }
  return visible;
}

/** Up to NEAR nearest vertices of other pieces for every vertex (-1 when none). */
function nearestOutside(position, pieceOf, count, scale) {
  const cell = scale * .03, grid = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  const cellOf = flat => [Math.floor(position[flat * 3] / cell), Math.floor(position[flat * 3 + 1] / cell), Math.floor(position[flat * 3 + 2] / cell)];
  for (let flat = 0; flat < count; flat++) { const k = key(...cellOf(flat)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(flat); }
  const nearOther = new Int32Array(count * NEAR).fill(-1), nearDistance = new Float32Array(count * NEAR).fill(Infinity);
  const pieces = new Set(pieceOf);
  if (pieces.size < 2) return { nearOther, nearDistance };
  for (let flat = 0; flat < count; flat++) {
    const [cx, cy, cz] = cellOf(flat), best = [];
    for (let radius = 1; radius <= 64; radius = radius < 3 ? radius + 1 : radius * 2) {
      best.length = 0;
      for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) for (let dz = -radius; dz <= radius; dz++) {
        const list = grid.get(key(cx + dx, cy + dy, cz + dz)); if (!list) continue;
        for (const other of list) {
          if (pieceOf[other] === pieceOf[flat]) continue;
          const distance = Math.hypot(position[flat * 3] - position[other * 3], position[flat * 3 + 1] - position[other * 3 + 1], position[flat * 3 + 2] - position[other * 3 + 2]);
          if (best.length < NEAR || distance < best[best.length - 1][1]) { best.push([other, distance]); best.sort((x, y) => x[1] - y[1]); if (best.length > NEAR) best.pop(); }
        }
      }
      if (best.length >= NEAR && best[best.length - 1][1] <= radius * cell) break;
    }
    best.forEach(([other, distance], slot) => { nearOther[flat * NEAR + slot] = other; nearDistance[flat * NEAR + slot] = distance; });
  }
  return { nearOther, nearDistance };
}

/**
 * World matrices of every region for sampled animation frames (3x4 each, flat).
 * A model without animations gets "flex" poses instead: each joint in turn
 * bent a little, so moving with the right part can still be judged.
 */
function sampleRegionPoses(model, regions, limit) {
  const sequences = model.Sequences || [], poses = [];
  const store = matrices => {
    const out = new Float32Array(regions.length * 12);
    regions.forEach((region, index) => {
      const e = matrices.get(region.id)?.elements; if (!e) { out.set([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], index * 12); return; }
      out.set([e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10], e[12], e[13], e[14]], index * 12);
    });
    poses.push(out);
  };
  if (sequences.length) {
    const perSequence = Math.max(2, Math.min(6, Math.floor(limit / sequences.length)));
    for (let sequence = 0; sequence < sequences.length && poses.length < limit; sequence++) {
      const [start, end] = sequences[sequence].Interval;
      for (let k = 0; k < perSequence && poses.length < limit; k++) { const frame = Math.round(start + (end - start) * (k + .5) / perSequence); store(sampleNodeMatrices(model, frame, sequence, frame)); }
    }
    return poses;
  }
  const byId = new Map(allNodes(model).map(node => [node.ObjectId, node])), ids = [...byId.keys()];
  const still = { t: new Vector3(), r: new Quaternion(), s: new Vector3(1, 1, 1) };
  for (const region of regions) {
    for (const axis of [new Vector3(1, 0, 0), new Vector3(0, 1, 0)]) {
      if (poses.length >= limit) return poses;
      const bend = { t: new Vector3(), r: new Quaternion().setFromAxisAngle(axis, .5), s: new Vector3(1, 1, 1) };
      store(composeNodeMatrices(model, ids, node => node.ObjectId === region.driver ? bend : still, byId));
    }
  }
  return poses;
}

const transform = (pose, region, x, y, z, out, at) => {
  const m = region * 12;
  out[at] = pose[m] * x + pose[m + 3] * y + pose[m + 6] * z + pose[m + 9];
  out[at + 1] = pose[m + 1] * x + pose[m + 4] * y + pose[m + 7] * z + pose[m + 10];
  out[at + 2] = pose[m + 2] * x + pose[m + 5] * y + pose[m + 8] * z + pose[m + 11];
};

/** Hierarchy steps between two regions (99 when they share no ancestor). */
function regionHops(analysis, x, y) {
  if (x === y) return 0;
  const key = x < y ? x * 65536 + y : y * 65536 + x, memo = analysis.hopMemo;
  if (memo.has(key)) return memo.get(key);
  const { bones, regionIndexById } = analysis;
  const up = start => { const out = [start]; let at = start, guard = 0; while (bones[at].parent !== null && guard++ < 400) { const parent = regionIndexById.get(bones[at].parent); if (parent === undefined) break; out.push(parent); at = parent; } return out; };
  const ux = up(x), uy = up(y); let hops = 99;
  for (let i = 0; i < ux.length && hops === 99; i++) { const j = uy.indexOf(ux[i]); if (j >= 0) hops = i + j; }
  memo.set(key, hops);
  return hops;
}

/** Clues for one candidate region of a piece that do not depend on other bindings. */
function staticClues(analysis, piece, region, nb = 0, nb3 = 0) {
  const { bones, position, scale } = analysis, entry = bones[region];
  let distance = 0;
  for (const flat of piece.vertices) {
    const p = [position[flat * 3], position[flat * 3 + 1], position[flat * 3 + 2]];
    let best = Infinity; for (const [start, end] of entry.segments) best = Math.min(best, segmentDistance(p, start, end));
    distance += best;
  }
  distance /= piece.vertices.length;
  const toPivot = length(sub(entry.pivot, piece.center)), grow = piece.size * .05;
  const inside = entry.pivot.every((value, axis) => value >= piece.low[axis] - grow && value <= piece.high[axis] + grow) ? 1 : 0;
  return { r: region, nb, nb3, segd: Math.log1p(distance / (piece.size + scale * .01)), pin: inside, pdist: Math.log1p(toPivot / (piece.size + scale * .01)), leaf: entry.leaf ? 1 : 0, own: entry.own ? 1 : 0, centre: Math.exp(-toPivot / (piece.size * .25 + scale * .002)) };
}

/**
 * Candidate regions of a stiff piece with their rank scores. `regionsOf(flat)`
 * gives the regions another vertex follows (what this piece sits on).
 */
function pieceRows(analysis, piece, regionsOf, extra = []) {
  const { scale, nearOther } = analysis, n = piece.vertices.length;
  const votes = new Map(); let total = 0;
  for (const flat of piece.vertices) {
    const other = nearOther[flat * NEAR]; if (other < 0) continue;
    const regions = regionsOf(other); if (!regions.length) continue;
    for (const region of regions) { votes.set(region, (votes.get(region) || 0) + 1 / regions.length); total += 1 / regions.length; }
  }
  let top = -1, topVotes = 0; for (const [region, value] of votes) if (value > topVotes) { topVotes = value; top = region; }
  const touch = Number.isFinite(piece.gap) ? Math.exp(-piece.gap / (scale * .02)) : 0, far = !Number.isFinite(piece.gap) || piece.gap > scale * .06 ? 1 : 0;
  const clues = new Map(piece.clues.map(entry => [entry.r, entry]));
  for (const region of [...votes.keys(), ...extra]) if (!clues.has(region)) clues.set(region, staticClues(analysis, piece, region));
  const tiny = n <= 4 ? 1 : 0, big = n >= 40 ? 1 : 0, rows = [];
  for (const c of clues.values()) {
    const hop = top >= 0 ? regionHops(analysis, c.r, top) : 99, share = total > 0 ? (votes.get(c.r) || 0) / total : 0;
    const features = [1, c.nb, c.nb3, c.segd, share, share * touch, c.pin, c.pdist, c.leaf, c.own, hop === 0 ? 1 : 0, hop === 1 ? 1 : 0, 0, far * c.pin, far * c.leaf, c.pin * c.own, c.centre, c.centre * c.own, tiny * c.nb, tiny * share, big * c.nb, big * share];
    rows.push({ r: c.r, score: weigh(features, RANK_WEIGHTS) });
  }
  return rows;
}

/**
 * The setting-free part of a binding: vertices, pieces, bone distances,
 * touching vertices, what every piece sits on, sampled animation poses and how
 * well each piece is bound now. `geosets` limits which geosets take part.
 */
export function analyzeBinding(model, { geosets, maxPoses = 64 } = {}) {
  const geosetList = (geosets ?? model.Geosets.map((_, index) => index)).filter(index => model.Geosets[index]?.Vertices?.length);
  let count = 0;
  const offsets = new Map();
  for (const index of geosetList) { offsets.set(index, count); count += model.Geosets[index].Vertices.length / 3; }
  const geosetOf = new Int32Array(count), vertexOf = new Int32Array(count), position = new Float32Array(count * 3), normal = new Float32Array(count * 3);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const index of geosetList) {
    const geoset = model.Geosets[index], start = offsets.get(index), n = geoset.Vertices.length / 3;
    for (let vertex = 0; vertex < n; vertex++) {
      const flat = start + vertex;
      geosetOf[flat] = index; vertexOf[flat] = vertex;
      for (let axis = 0; axis < 3; axis++) {
        const value = geoset.Vertices[vertex * 3 + axis];
        position[flat * 3 + axis] = value; normal[flat * 3 + axis] = geoset.Normals?.[vertex * 3 + axis] || 0;
        if (value < min[axis]) min[axis] = value; if (value > max[axis]) max[axis] = value;
      }
    }
  }
  const scale = count ? Math.max(1e-3, ...max.map((value, axis) => value - min[axis])) : 1;
  const current = Array.from({ length: count }, (_, flat) => vertexBones(model.Geosets[geosetOf[flat]], vertexOf[flat]));
  const bones = bindingBones(model, scale, current);
  const point = flat => [position[flat * 3], position[flat * 3 + 1], position[flat * 3 + 2]];

  // Pieces: faces joined inside one geoset, plus vertices sitting on the same spot there.
  const pieces = unionFind(count), exact = scale * 1e-4;
  const neighbourSets = Array.from({ length: count }, () => new Set());
  for (const index of geosetList) {
    const geoset = model.Geosets[index], start = offsets.get(index);
    for (let face = 0; face + 2 < geoset.Faces.length; face += 3) {
      const a = start + geoset.Faces[face], b = start + geoset.Faces[face + 1], c = start + geoset.Faces[face + 2];
      pieces.join(a, b); pieces.join(a, c);
      neighbourSets[a].add(b).add(c); neighbourSets[b].add(a).add(c); neighbourSets[c].add(a).add(b);
    }
  }
  // Vertices on the same spot anywhere in the model (seams), and near it.
  const reach = scale * .002, cell = Math.max(reach, exact), grid = new Map(), touches = [];
  const keyOf = (x, y, z) => `${x},${y},${z}`;
  for (let flat = 0; flat < count; flat++) {
    const x = Math.floor(position[flat * 3] / cell), y = Math.floor(position[flat * 3 + 1] / cell), z = Math.floor(position[flat * 3 + 2] / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const other of grid.get(keyOf(x + dx, y + dy, z + dz)) || []) {
        const distance = Math.hypot(position[flat * 3] - position[other * 3], position[flat * 3 + 1] - position[other * 3 + 1], position[flat * 3 + 2] - position[other * 3 + 2]);
        if (distance > reach) continue;
        if (distance <= exact && geosetOf[flat] === geosetOf[other]) pieces.join(flat, other);
        touches.push(other, flat, distance);
      }
    }
    const key = keyOf(x, y, z);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(flat);
  }
  const touchPairs = new Int32Array(touches.length / 3 * 2), touchDistance = new Float32Array(touches.length / 3);
  for (let i = 0; i < touchDistance.length; i++) { touchPairs[i * 2] = touches[i * 3]; touchPairs[i * 2 + 1] = touches[i * 3 + 1]; touchDistance[i] = touches[i * 3 + 2]; }
  // Exactly coincident vertices also count as neighbours for smoothing.
  for (let i = 0; i < touchDistance.length; i++) if (touchDistance[i] <= exact) { const a = touchPairs[i * 2], b = touchPairs[i * 2 + 1]; neighbourSets[a].add(b); neighbourSets[b].add(a); }

  const pieceOf = new Int32Array(count), pieceIndex = new Map(), pieceList = [];
  for (let flat = 0; flat < count; flat++) {
    const root = pieces.find(flat);
    if (!pieceIndex.has(root)) { pieceIndex.set(root, pieceList.length); pieceList.push({ index: pieceList.length, geoset: geosetOf[flat], vertices: [] }); }
    const piece = pieceIndex.get(root); pieceOf[flat] = piece; pieceList[piece].vertices.push(flat);
  }
  for (const piece of pieceList) {
    const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
    for (const flat of piece.vertices) for (let axis = 0; axis < 3; axis++) { const value = position[flat * 3 + axis]; if (value < low[axis]) low[axis] = value; if (value > high[axis]) high[axis] = value; }
    piece.center = low.map((value, axis) => (value + high[axis]) / 2); piece.low = low; piece.high = high;
    piece.size = Math.hypot(...high.map((value, axis) => value - low[axis]));
    piece.vertices = Int32Array.from(piece.vertices);
    // A stable name for marks: geoset plus its lowest vertex.
    piece.key = `${piece.geoset}:${vertexOf[piece.vertices[0]]}`;
  }

  // Every vertex's nearest bones, by distance to the space each bone moves.
  const candidateBone = new Int32Array(count * CANDIDATES).fill(-1), candidateDistance = new Float32Array(count * CANDIDATES).fill(Infinity);
  for (let flat = 0; flat < count; flat++) {
    const p = point(flat), best = [];
    for (let b = 0; b < bones.length; b++) {
      let distance = Infinity;
      for (const [start, end] of bones[b].segments) distance = Math.min(distance, segmentDistance(p, start, end));
      if (best.length < CANDIDATES || distance < best[best.length - 1][1]) {
        best.push([b, distance]); best.sort((x, y) => x[1] - y[1]); if (best.length > CANDIDATES) best.pop();
      }
    }
    best.forEach(([b, distance], slot) => { candidateBone[flat * CANDIDATES + slot] = b; candidateDistance[flat * CANDIDATES + slot] = distance; });
  }

  const neighbourStart = new Int32Array(count + 1);
  for (let flat = 0; flat < count; flat++) neighbourStart[flat + 1] = neighbourStart[flat] + neighbourSets[flat].size;
  const neighbours = new Int32Array(neighbourStart[count]);
  for (let flat = 0; flat < count; flat++) neighbours.set([...neighbourSets[flat]], neighbourStart[flat]);
  const regionOfBone = new Map(); bones.forEach((region, index) => region.ids.forEach(id => regionOfBone.set(id, index)));
  const regionIndexById = new Map(bones.map((region, index) => [region.id, index]));
  const currentRegions = current.map(group => [...new Set(group.map(id => regionOfBone.get(id)).filter(region => region !== undefined))]);
  const { nearOther, nearDistance } = nearestOutside(position, pieceOf, count, scale);
  const visible = visibleGeosets(model, geosetList);
  const analysis = { regionOfBone, regionIndexById, hopMemo: new Map(), count, scale, geosets: geosetList, offsets, geosetOf, vertexOf, position, normal, bones, pieces: pieceList, pieceOf,
    candidateBone, candidateDistance, neighbourStart, neighbours, touchPairs, touchDistance, current, currentRegions, nearOther, nearDistance, visible };
  if (!bones.length) { for (const piece of pieceList) Object.assign(piece, { visible: visible.has(piece.geoset), clues: [], gap: Infinity, stiff: 1, valid: 0, rigid: null, agree: 0, misfit: 0, misrank: 0, ownBone: false }); return analysis; }

  // How each piece sits: its shape around the skeleton and its candidate bones.
  for (const piece of pieceList) {
    const n = piece.vertices.length;
    piece.visible = visible.has(piece.geoset);
    piece.gap = Infinity;
    for (const flat of piece.vertices) if (nearDistance[flat * NEAR] < piece.gap) piece.gap = nearDistance[flat * NEAR];
    const nb = new Map(), nb3 = new Map(), tally = new Map();
    for (const flat of piece.vertices) for (let slot = 0; slot < 3; slot++) {
      const region = candidateBone[flat * CANDIDATES + slot]; if (region < 0) continue;
      nb3.set(region, (nb3.get(region) || 0) + 1 / n);
      if (!slot) { nb.set(region, (nb.get(region) || 0) + 1 / n); tally.set(region, (tally.get(region) || 0) + 1); }
    }
    const regions = new Set(nb3.keys()), grow = piece.size * .05;
    bones.forEach((entry, region) => { if (entry.pivot.every((value, axis) => value >= piece.low[axis] - grow && value <= piece.high[axis] + grow)) regions.add(region); });
    piece.clues = [...regions].map(region => staticClues(analysis, piece, region, nb.get(region) || 0, nb3.get(region) || 0));
    // Stiff or bending, from its shape around the skeleton.
    const ranked = [...tally].sort((a, b) => b[1] - a[1]), top = ranked[0][0];
    const s1 = ranked[0][1] / n, s2 = (ranked[1]?.[1] || 0) / n, wide = ranked.filter(([, c]) => c / n >= .15).length;
    const kind = [1, s1, s2, Math.min(4, wide) / 2, Math.log(Math.max(piece.size, scale * 1e-4) / Math.max(bones[top].length, scale * .01)), Math.log(n) / 4, ranked[1] && regionHops(analysis, top, ranked[1][0]) <= 1 ? 1 : 0, Math.min(3, ranked.length / 3)];
    piece.stiff = 1 / (1 + Math.exp(-weigh(kind, KIND_WEIGHTS)));
    // How it is bound now.
    let valid = 0, agree = 0; const keys = new Set();
    for (const flat of piece.vertices) {
      const regionsNow = currentRegions[flat];
      if (current[flat].length && current[flat].every(id => regionOfBone.has(id))) valid++;
      keys.add(regionsNow.slice().sort((a, b) => a - b).join());
      for (let slot = 0; slot < 3; slot++) if (regionsNow.includes(candidateBone[flat * CANDIDATES + slot])) { agree++; break; }
    }
    piece.valid = valid / n; piece.agree = agree / n;
    piece.rigid = keys.size === 1 && currentRegions[piece.vertices[0]].length === 1 ? currentRegions[piece.vertices[0]][0] : null;
    piece.misfit = 0; piece.misrank = 0;
  }
  // A prop bone: an end bone that only ever holds stiff parts, never blended
  // with another bone (a thrown axe, a flapping leaf, a wheel, a weapon).
  // Parts on such a bone are always there on purpose.
  const blended = new Set();
  for (let flat = 0; flat < count; flat++) if (currentRegions[flat].length > 1) for (const region of currentRegions[flat]) blended.add(region);
  for (const piece of pieceList) piece.ownBone = piece.rigid !== null && !blended.has(piece.rigid) && (bones[piece.rigid].leaf || bones[piece.rigid].own && regionUseOf(piece.rigid) === piece.vertices.length);
  function regionUseOf(region) { let n = 0; for (let flat = 0; flat < count; flat++) if (currentRegions[flat].includes(region)) n++; return n; }

  // Animated check of every stiff, fully bound piece: does its bone keep it with
  // what it sits on as well as the best other bone would, and does it rank near it?
  const poses = sampleRegionPoses(model, bones, count > 20000 ? Math.min(maxPoses, 24) : maxPoses);
  analysis.poseCount = poses.length;
  if (poses.length) {
    const now = poses.map(pose => {
      const out = new Float32Array(count * 3), t = new Float32Array(3);
      for (let flat = 0; flat < count; flat++) {
        const regions = currentRegions[flat], x = position[flat * 3], y = position[flat * 3 + 1], z = position[flat * 3 + 2];
        if (!regions.length) { out[flat * 3] = x; out[flat * 3 + 1] = y; out[flat * 3 + 2] = z; continue; }
        let sx = 0, sy = 0, sz = 0;
        for (const region of regions) { transform(pose, region, x, y, z, t, 0); sx += t[0]; sy += t[1]; sz += t[2]; }
        out[flat * 3] = sx / regions.length; out[flat * 3 + 1] = sy / regions.length; out[flat * 3 + 2] = sz / regions.length;
      }
      return out;
    });
    const p = new Float32Array(3);
    const misfitOf = (piece, region) => {
      const near = Math.max(piece.gap, scale * .005);
      let sum = 0, weight = 0;
      for (let k = 0; k < poses.length; k++) for (const flat of piece.vertices) {
        transform(poses[k], region, position[flat * 3], position[flat * 3 + 1], position[flat * 3 + 2], p, 0);
        for (let slot = 0; slot < NEAR; slot++) {
          const other = nearOther[flat * NEAR + slot]; if (other < 0) continue;
          const rest = nearDistance[flat * NEAR + slot], moved = Math.hypot(p[0] - now[k][other * 3], p[1] - now[k][other * 3 + 1], p[2] - now[k][other * 3 + 2]);
          const w = 1 / (rest + near); sum += Math.abs(moved - rest) * w; weight += w;
        }
      }
      return weight ? sum / weight / scale : 0;
    };
    for (const piece of pieceList) {
      if (piece.rigid === null || piece.valid < 1 || !Number.isFinite(piece.gap)) continue;
      const rows = pieceRows(analysis, piece, flat => currentRegions[flat], [piece.rigid]);
      let bestScore = -Infinity, ownScore = -Infinity;
      for (const row of rows) { if (row.score > bestScore) bestScore = row.score; if (row.r === piece.rigid) ownScore = row.score; }
      piece.misrank = Number.isFinite(ownScore) ? bestScore - ownScore : Infinity;
      if (piece.misrank <= 0) continue;
      const own = misfitOf(piece, piece.rigid);
      let best = own;
      for (const row of rows) if (row.r !== piece.rigid && row.score > ownScore) best = Math.min(best, misfitOf(piece, row.r));
      piece.misfit = own - best;
    }
  }
  return analysis;
}

/** Bones that should not take vertices unless the user turns them on: roots
 * that hold nothing and only carry the skeleton, loose bones and portrait
 * backdrops. A bone the model already uses is never turned off: modellers bind
 * on purpose to still bones (to calm a part's motion) and to their own props. */
export function defaultExcludedBones(model, analysis) {
  const used = new Set(analysis.current.flat()), excluded = new Set();
  const anyUsed = analysis.bones.some(region => region.ids.some(id => used.has(id)));
  const isLoose = region => region.parent === null && region.parentDriver === null && !analysis.bones.some(other => other.parent === region.id);
  const skeleton = analysis.bones.some(region => !isLoose(region));
  for (const region of analysis.bones) {
    const children = analysis.bones.filter(other => other.parent === region.id).length;
    for (const id of region.ids) {
      if (anyUsed && used.has(id)) continue;
      const name = model.Nodes?.[id]?.Name ?? (model.Bones || []).find(bone => bone.ObjectId === id)?.Name ?? '';
      // Loose bones outside the skeleton (corpse gibs, planes) carry props, not the body.
      const loose = skeleton && isLoose(region);
      if (/portrait|backdrop|background|glow/i.test(name) || loose || region.parent === null && children > 0 && (anyUsed || children === 1)) excluded.add(id);
    }
  }
  return excluded;
}

const hierarchyNear = (bones, a, b) => {
  if (a === b) return true;
  const A = bones[a], B = bones[b];
  return A.parent === B.id || B.parent === A.id || A.parent !== null && A.parent === B.parent || A.parentDriver !== null && A.parentDriver === B.parentDriver
    || A.parent !== null && bones.find(bone => bone.id === A.parent)?.parent === B.id
    || B.parent !== null && bones.find(bone => bone.id === B.parent)?.parent === A.id;
};

/** Distance from vertex `flat` to the space region `b` moves. */
function regionDistance(analysis, flat, b) {
  const p = [analysis.position[flat * 3], analysis.position[flat * 3 + 1], analysis.position[flat * 3 + 2]];
  let distance = Infinity;
  for (const [start, end] of analysis.bones[b].segments) distance = Math.min(distance, segmentDistance(p, start, end));
  return distance;
}

/**
 * A bone's area on a piece is one connected patch: where the same bone also
 * claims a smaller, separate patch (the inside of a thigh claimed by the other
 * leg), that patch takes the bone of what surrounds it.
 */
function removeIslands(analysis, owner) {
  const { count, neighbourStart, neighbours, pieceOf } = analysis;
  for (let pass = 0; pass < 3; pass++) {
    const patches = unionFind(count);
    for (let flat = 0; flat < count; flat++) for (let i = neighbourStart[flat]; i < neighbourStart[flat + 1]; i++) { const other = neighbours[i]; if (owner[other] === owner[flat] && pieceOf[other] === pieceOf[flat]) patches.join(flat, other); }
    const size = new Map();
    for (let flat = 0; flat < count; flat++) { const root = patches.find(flat); size.set(root, (size.get(root) || 0) + 1); }
    // The largest patch of each bone on each piece is its main patch.
    const main = new Map();
    for (const [root, n] of size) { const key = `${pieceOf[root]}:${owner[root]}`; if (!main.has(key) || n > size.get(main.get(key))) main.set(key, root); }
    const votes = new Map();
    for (let flat = 0; flat < count; flat++) {
      const root = patches.find(flat), key = `${pieceOf[flat]}:${owner[flat]}`;
      if (main.get(key) === root || size.get(root) > size.get(main.get(key)) * .5) continue;
      for (let i = neighbourStart[flat]; i < neighbourStart[flat + 1]; i++) {
        const other = neighbours[i];
        if (owner[other] === owner[flat] || pieceOf[other] !== pieceOf[flat]) continue;
        const tally = votes.get(root) || new Map(); tally.set(owner[other], (tally.get(owner[other]) || 0) + 1); votes.set(root, tally);
      }
    }
    if (!votes.size) return;
    const next = new Map();
    for (const [root, tally] of votes) { let best = -1, most = 0; for (const [b, n] of tally) if (n > most) { best = b; most = n; } next.set(root, best); }
    for (let flat = 0; flat < count; flat++) { const to = next.get(patches.find(flat)); if (to !== undefined && to >= 0) owner[flat] = to; }
  }
}

/** The most common group among a vertex's neighbours that have one (null if none). */
function neighbourMajority(analysis, flat, groups, usable) {
  const votes = new Map();
  for (let i = analysis.neighbourStart[flat]; i < analysis.neighbourStart[flat + 1]; i++) {
    const other = analysis.neighbours[i];
    if (!usable(other)) continue;
    const key = groups[other].join(',');
    const vote = votes.get(key) || { group: groups[other], count: 0 };
    vote.count++; votes.set(key, vote);
  }
  let best = null;
  for (const vote of votes.values()) if (!best || vote.count > best.count) best = vote;
  return best;
}

/**
 * Whether a piece's binding is kept. Without Protect (null), BindXL changes a
 * bound part only on strong evidence. Protect (0..1) says how much of the
 * current binding to keep: 1 keeps every bound part (only torn seams, stray
 * and unbound vertices change), 0 binds everything again from the skeleton.
 */
function trusted(piece, protect) {
  if (piece.valid < .5) return false;
  if (protect == null) return piece.rigid === null || piece.ownBone || !(piece.misrank > DISTRUST_RANK && piece.misfit > DISTRUST_FIT);
  if (protect >= .999) return true;
  if (protect <= .001) return false;
  if (piece.rigid !== null) return (piece.ownBone && protect >= .5) || !(piece.misrank > DISTRUST_RANK * 1.2 * protect && piece.misfit > DISTRUST_FIT * 1.5 * protect);
  return piece.agree >= .6 * (1 - protect);
}

/**
 * Bone groups for every analysed vertex. Settings:
 * - soft (0..1): how far bending vertices blend across joints.
 * - plates (0..1): how readily a part that needs a new binding moves stiffly as one.
 * - protect (null or 0..1): how much to trust the current binding (see trusted()).
 * - excluded: bone ids never used. Parts held only by them stay as they are,
 *   unless the user turned those bones off (`turnedOff`): then they move to other bones.
 * - marks: { [pieceKey]: { mode: 'auto'|'plate'|'bend'|'keep', bone, together } }.
 *   Stiff parts sharing a `together` value move as one, held by one bone.
 */
export function planBinding(analysis, settings = {}) {
  const { soft = BIND_DEFAULTS.soft, plates = BIND_DEFAULTS.plates, protect = null, excluded = new Set(), turnedOff = new Set(), marks = {} } = settings;
  const { count, bones, candidateBone, candidateDistance, pieces, pieceOf, neighbourStart, neighbours, scale, current, currentRegions } = analysis;
  const allowed = bones.map(region => region.ids.some(id => !excluded.has(id)));
  const boneOf = b => bones[b].ids.find(id => !excluded.has(id)) ?? bones[b].id;
  if (!allowed.some(Boolean)) throw new Error('Turn on at least one bone to bind to.');
  const groups = new Array(count), locked = new Uint8Array(count), owner = new Int32Array(count).fill(-1);

  // 1. Skeleton: the nearest allowed bone per vertex, with speckles and
  // islands smoothed away (a vertex follows the bone around it).
  for (let flat = 0; flat < count; flat++) {
    for (let slot = 0; slot < CANDIDATES; slot++) { const b = candidateBone[flat * CANDIDATES + slot]; if (b >= 0 && allowed[b]) { owner[flat] = b; break; } }
    if (owner[flat] < 0) owner[flat] = allowed.findIndex(Boolean);
  }
  for (let pass = 0; pass < 2; pass++) {
    const next = owner.slice();
    for (let flat = 0; flat < count; flat++) {
      const votes = new Map([[owner[flat], 1.5]]);
      for (let i = neighbourStart[flat]; i < neighbourStart[flat + 1]; i++) { const b = owner[neighbours[i]]; votes.set(b, (votes.get(b) || 0) + 1); }
      let best = owner[flat], bestVotes = votes.get(best);
      for (const [b, value] of votes) if (value > bestVotes) { best = b; bestVotes = value; }
      next[flat] = best;
    }
    owner.set(next);
  }
  removeIslands(analysis, owner);

  // 2. What each piece does: stays (kept or cleaned), or is bound again as a
  // stiff plate or bending skin.
  const pieceMode = new Array(pieces.length), keptPiece = new Uint8Array(pieces.length);
  const usableNow = flat => current[flat].length && current[flat].every(id => !excluded.has(id) && analysis.regionOfBone.has(id));
  for (const piece of pieces) {
    const mark = marks[piece.key] || {};
    let mode = mark.mode && mark.mode !== 'auto' ? mark.mode : null;
    // Hidden geosets (portrait backdrops, gibs) and pieces held only by
    // turned-off bones stay exactly as they are.
    const offOnly = piece.vertices.every(flat => current[flat].length && current[flat].every(id => excluded.has(id)));
    const released = piece.vertices.some(flat => current[flat].some(id => turnedOff.has(id)));
    if (!mode && (!piece.visible || offOnly && !released)) mode = 'keep';
    if (!mode && !(offOnly && released) && trusted(piece, protect) && (piece.rigid === null || allowed[piece.rigid])) mode = 'clean';
    if (!mode) mode = piece.stiff >= 1 - plates ? 'plate' : 'bend';
    pieceMode[piece.index] = mode;
    keptPiece[piece.index] = mode === 'keep' || mode === 'clean' ? 1 : 0;
  }

  // 3. Groups for kept, cleaned and bending pieces.
  const ratio = 1 + soft * soft * 1.5;
  const skeletonGroup = flat => {
    const primary = owner[flat];
    let primaryDistance = Infinity;
    for (let slot = 0; slot < CANDIDATES; slot++) if (candidateBone[flat * CANDIDATES + slot] === primary) primaryDistance = candidateDistance[flat * CANDIDATES + slot];
    if (!Number.isFinite(primaryDistance)) primaryDistance = regionDistance(analysis, flat, primary);
    const group = [primary];
    if (soft > 0) for (let slot = 0; slot < CANDIDATES && group.length < MAX_BONES; slot++) {
      const b = candidateBone[flat * CANDIDATES + slot], distance = candidateDistance[flat * CANDIDATES + slot];
      if (b < 0 || b === primary || !allowed[b] || !hierarchyNear(bones, primary, b)) continue;
      if (distance <= primaryDistance * ratio + scale * 1e-3 * soft) group.push(b);
    }
    return group.map(boneOf);
  };
  const pending = [];
  for (let flat = 0; flat < count; flat++) {
    const mode = pieceMode[pieceOf[flat]];
    if (mode === 'keep') { groups[flat] = current[flat].slice(); locked[flat] = 3; }
    else if (mode === 'clean') { if (usableNow(flat)) { groups[flat] = current[flat].slice(); locked[flat] = 2; } else pending.push(flat); }
    else if (mode === 'bend') groups[flat] = skeletonGroup(flat);
  }

  // 4. Stiff pieces: the best-ranked bone for what each sits on, biggest first,
  // so a small plate sees the bones its bigger neighbours ended up with.
  const regionsOf = flat => {
    if (groups[flat]) return [...new Set(groups[flat].map(id => analysis.regionOfBone.get(id)).filter(region => region !== undefined))];
    return keptPiece[pieceOf[flat]] ? currentRegions[flat] : [owner[flat]];
  };
  const stiff = pieces.filter(piece => pieceMode[piece.index] === 'plate');
  const together = new Map();
  for (const piece of stiff) { const key = marks[piece.key]?.together; if (key != null) { if (!together.has(key)) together.set(key, []); together.get(key).push(piece); } }
  const handled = new Set();
  for (const piece of [...stiff].sort((a, b) => b.vertices.length - a.vertices.length)) {
    if (handled.has(piece.index)) continue;
    const mark = marks[piece.key] || {}, members = mark.together != null ? together.get(mark.together) : [piece];
    members.forEach(member => handled.add(member.index));
    let bone = Number.isInteger(mark.bone) ? mark.bone : members.map(member => marks[member.key]?.bone).find(Number.isInteger);
    if (!Number.isInteger(bone)) {
      // Scores of all members, weighted by their size, so parts marked together share one bone.
      const totals = new Map(), inGroup = new Set(members.map(member => member.index));
      for (const member of members) for (const row of pieceRows(analysis, member, flat => inGroup.has(pieceOf[flat]) ? [] : regionsOf(flat))) {
        if (!allowed[row.r]) continue;
        totals.set(row.r, (totals.get(row.r) || 0) + row.score * member.vertices.length);
      }
      let best = -1, bestScore = -Infinity; for (const [region, value] of totals) if (value > bestScore) { bestScore = value; best = region; }
      if (best < 0) best = owner[members[0].vertices[0]];
      bone = boneOf(best);
    }
    for (const member of members) for (const flat of member.vertices) { groups[flat] = [bone]; locked[flat] = 1; }
  }

  // Vertices in kept pieces whose own binding was off take their neighbours'.
  const isSet = flat => !!groups[flat];
  for (let pass = 0; pass < 8 && pending.length; pass++) {
    const filled = [];
    for (const flat of pending) { const best = neighbourMajority(analysis, flat, groups, isSet); if (best) filled.push([flat, best.group.slice()]); }
    for (const [flat, group] of filled) { groups[flat] = group; locked[flat] = 2; }
    if (!filled.length) break;
    const done = new Set(filled.map(([flat]) => flat));
    pending.splice(0, pending.length, ...pending.filter(flat => !done.has(flat)));
  }
  for (const flat of pending) groups[flat] = skeletonGroup(flat);

  // 5. Cleaned pieces: a stray vertex sharing no bone with any neighbour takes
  // theirs, and a piece almost wholly on one binding moves as one.
  for (const piece of pieces) {
    if (pieceMode[piece.index] !== 'clean') continue;
    for (const flat of piece.vertices) {
      const own = new Set(groups[flat]);
      let shared = false, around = 0;
      for (let i = neighbourStart[flat]; i < neighbourStart[flat + 1] && !shared; i++) { around++; shared = groups[neighbours[i]].some(id => own.has(id)); }
      if (shared || around < 2) continue;
      const best = neighbourMajority(analysis, flat, groups, () => true);
      if (best && best.count >= 2) groups[flat] = best.group.slice();
    }
    const tally = new Map();
    for (const flat of piece.vertices) { const key = groups[flat].join(','); tally.set(key, (tally.get(key) || 0) + 1); }
    const [key, most] = [...tally].sort((a, b) => b[1] - a[1])[0];
    if (most < piece.vertices.length && most >= piece.vertices.length * .95) {
      // Only vertices sharing no bone with the rest are strays; joint blends stay.
      const group = key.split(',').map(Number);
      for (const flat of piece.vertices) if (!groups[flat].some(id => group.includes(id))) groups[flat] = group.slice();
    }
  }

  // 6. Seams: vertices on the same spot move together when both sides belong
  // to the same body (never a rider and its mount). A part bound again takes
  // the binding of the part it meets that stays. Where two parts that stay
  // meet with different bones at a joint (one bone the parent of the other),
  // both seam vertices follow both bones, as modellers bind joints; parts
  // that meet across bodies or further apart keep their own binding.
  const exact = scale * 1e-4, seams = unionFind(count);
  for (let i = 0; i < analysis.touchDistance.length; i++) if (analysis.touchDistance[i] <= exact) seams.join(analysis.touchPairs[i * 2], analysis.touchPairs[i * 2 + 1]);
  const mainRegion = new Map();
  const mainOf = piece => {
    if (mainRegion.has(piece)) return mainRegion.get(piece);
    const tally = new Map(); for (const flat of pieces[piece].vertices) for (const region of regionsOf(flat)) tally.set(region, (tally.get(region) || 0) + 1);
    let best = -1, most = 0; for (const [region, n] of tally) if (n > most) { most = n; best = region; }
    mainRegion.set(piece, best); return best;
  };
  const agrees = flat => groups[flat].includes(boneOf(owner[flat])) ? 1 : 0;
  const rank = flat => locked[flat] * 1e9 + agrees(flat) * 1e8 + pieces[pieceOf[flat]].vertices.length;
  const clusters = new Map();
  for (let flat = 0; flat < count; flat++) { const root = seams.find(flat); if (!clusters.has(root)) clusters.set(root, []); clusters.get(root).push(flat); }
  const hopsBetween = (a, b) => { const x = mainOf(pieceOf[a]), y = mainOf(pieceOf[b]); return x >= 0 && y >= 0 ? regionHops(analysis, x, y) : 99; };
  const regionsIn = group => group.map(id => analysis.regionOfBone.get(id));
  for (const members of clusters.values()) {
    if (members.length < 2) continue;
    const winner = members.reduce((best, flat) => rank(flat) > rank(best) ? flat : best, members[0]);
    for (const flat of members) {
      if (flat === winner || locked[flat] === 3 || groups[flat].join() === groups[winner].join()) continue;
      if (pieceOf[flat] !== pieceOf[winner] && hopsBetween(flat, winner) > 3) continue;
      if (locked[flat] < 2) { groups[flat] = groups[winner].slice(); continue; }
      // Both stay: blend across a parent-child joint only.
      const mine = regionsIn(groups[flat]), theirs = regionsIn(groups[winner]);
      const joint = mine.some(x => theirs.some(y => x !== undefined && y !== undefined && regionHops(analysis, x, y) <= 1));
      const union = [...new Set([...groups[flat], ...groups[winner]])];
      if (!joint || union.length > MAX_BONES) continue;
      for (const other of members) if (locked[other] !== 3 && (other === flat || other === winner || groups[other].join() === groups[winner].join())) groups[other] = union.slice();
    }
  }
  for (let flat = 0; flat < count; flat++) groups[flat] = [...new Set(groups[flat])].sort((a, b) => a - b);
  return { groups, pieceMode, owner };
}

/** Writes a plan into the model's geosets (one undoable edit for the caller). */
export function applyBinding(model, analysis, plan) {
  const byGeoset = new Map();
  for (let flat = 0; flat < analysis.count; flat++) {
    const index = analysis.geosetOf[flat];
    if (!byGeoset.has(index)) byGeoset.set(index, []);
    byGeoset.get(index).push(flat);
  }
  for (const [index, flats] of byGeoset) {
    const geoset = model.Geosets[index];
    if (isHdSkinned(geoset)) {
      for (const flat of flats) {
        const vertex = analysis.vertexOf[flat], bones = plan.groups[flat].slice(0, 4), share = Math.floor(255 / bones.length);
        const row = [0, 0, 0, 0, 0, 0, 0, 0];
        bones.forEach((bone, slot) => { row[slot] = bone; row[4 + slot] = slot === 0 ? 255 - share * (bones.length - 1) : share; });
        geoset.SkinWeights.set(row, vertex * 8);
      }
      continue;
    }
    // Rebuild the vertex groups from scratch so stale groups do not pile up.
    const keyed = new Map(), groups = [];
    const vertexGroup = geoset.VertexGroup.slice();
    const inScope = new Set(flats.map(flat => analysis.vertexOf[flat]));
    for (let vertex = 0; vertex < vertexGroup.length; vertex++) {
      const flat = inScope.has(vertex) ? analysis.offsets.get(index) + vertex : -1;
      const bones = flat >= 0 ? plan.groups[flat] : Array.from(geoset.Groups[geoset.VertexGroup[vertex]] || []);
      const key = bones.join(',');
      if (!keyed.has(key)) { keyed.set(key, groups.length); groups.push(bones.slice()); }
      vertexGroup[vertex] = keyed.get(key);
    }
    if (groups.length > 256) throw new Error(`Geoset ${index} would need ${groups.length} vertex groups; the classic format allows 256. Lower Soft joints.`);
    geoset.Groups = groups; geoset.VertexGroup = vertexGroup;
    geoset.TotalGroupsCount = groups.reduce((sum, group) => sum + group.length, 0);
  }
}

/** A copy of `model` showing a plan, for the live preview: only the analysed
 * geosets get new binding arrays; everything else is shared, so the preview
 * re-uploads bindings without rebuilding. */
export function previewBinding(model, analysis, plan) {
  const preview = { ...model, Geosets: model.Geosets.map((geoset, index) => analysis.offsets.has(index)
    ? { ...geoset, ...(isHdSkinned(geoset) ? { SkinWeights: geoset.SkinWeights.slice() } : {}) } : geoset) };
  applyBinding(preview, analysis, plan);
  return preview;
}

// Ten strong, clearly different colours; neighbouring bones never share one.
const PALETTE = [[.93, .33, .27], [.25, .58, .96], [.98, .8, .2], [.3, .78, .4], [.72, .42, .95], [.98, .56, .15], [.2, .82, .84], [.96, .45, .72], [.62, .8, .22], [.55, .4, .3]];

/** One clear colour per bone (bones on the same joint share it): bones next to
 * each other in the skeleton or in the model get different colours from a
 * small set of strong ones. [boneId, [r, g, b]] pairs in 0..1. */
export function boneColors(analysis) {
  const { bones, scale } = analysis, colors = new Map(), choice = new Array(bones.length).fill(-1);
  const index = new Map(bones.map((region, at) => [region.id, at]));
  const near = bones.map(() => new Set());
  const link = (a, b) => { if (a !== b && a >= 0 && b >= 0) { near[a].add(b); near[b].add(a); } };
  bones.forEach((region, at) => {
    const parent = region.parent !== null ? index.get(region.parent) ?? -1 : -1;
    link(at, parent);
    if (parent >= 0) { const grand = bones[parent].parent !== null ? index.get(bones[parent].parent) ?? -1 : -1; link(at, grand); }
    bones.forEach((other, to) => { if (to > at && (other.parent !== null && other.parent === region.parent || length(sub(other.pivot, region.pivot)) < scale * .08)) link(at, to); });
  });
  // Depth-first from the roots, so a limb's colours alternate down the chain.
  const children = new Map(bones.map((_, at) => [at, []])), order = [], seen = new Set();
  bones.forEach((region, at) => { const parent = region.parent !== null ? index.get(region.parent) : undefined; if (parent !== undefined) children.get(parent).push(at); });
  const visit = at => { if (seen.has(at)) return; seen.add(at); order.push(at); for (const child of children.get(at)) visit(child); };
  bones.forEach((region, at) => { if (region.parent === null || !index.has(region.parent)) visit(at); });
  bones.forEach((_, at) => visit(at));
  for (const at of order) {
    const used = new Map(); for (const other of near[at]) if (choice[other] >= 0) used.set(choice[other], (used.get(choice[other]) || 0) + 1);
    let pick = PALETTE.findIndex((_, colour) => !used.has(colour));
    if (pick < 0) pick = [...PALETTE.keys()].sort((a, b) => (used.get(a) || 0) - (used.get(b) || 0))[0];
    choice[at] = pick;
    for (const id of bones[at].ids) colors.set(id, PALETTE[pick].slice());
  }
  return colors;
}

/** Colours for looking at one bone: its area lights up, everything else is grey. */
export function focusColors(analysis, boneId) {
  const colors = new Map(), region = analysis.regionOfBone.get(boneId);
  analysis.bones.forEach((entry, at) => { for (const id of entry.ids) colors.set(id, at === region ? [1, .82, .18] : [.42, .44, .48]); });
  return colors;
}

/** The piece a vertex of a geoset belongs to, or -1. */
export function pieceAt(analysis, geosetIndex, vertexIndex) {
  const offset = analysis.offsets.get(geosetIndex);
  return offset === undefined ? -1 : analysis.pieceOf[offset + vertexIndex] ?? -1;
}
