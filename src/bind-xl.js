import { allNodes, nodePivot } from './animation.js';
import { isHdSkinned, vertexBones } from './part-bones.js';

// BindXL: binds vertices to bones from where they sit around the skeleton.
// The model's rest pose and skeleton are taken as correct; only bindings change.
//
// analyzeBinding() does the slow, setting-free work once per model: it flattens
// the vertices, finds the separate pieces, measures every vertex against every
// bone and lists the vertices that touch across pieces and geosets.
// planBinding() turns that into bone groups for the current sliders and piece
// marks, fast enough to run on every slider move. applyBinding() writes a plan
// into a model as ordinary vertex groups (classic) or bone weights (HD).

export const BIND_DEFAULTS = Object.freeze({ rebind: 0.5, soft: 0.3, plates: 0.7, glue: 0.2 });
export const PIECE_MODES = Object.freeze(['auto', 'plate', 'bend', 'keep']);
const MAX_BONES = 4, CANDIDATES = 6;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = a => Math.hypot(a[0], a[1], a[2]);

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
    return { id: ids[0], ids, name: bone?.Name || `Bone ${ids[0]}`, driver: region.driver, pivot: entry.pivot, parentDriver: entry.parent, segments, length: reach, leaf };
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

/**
 * The setting-free part of a binding: vertices, pieces, bone distances and
 * touching vertices. `geosets` limits which geosets take part (default all).
 */
export function analyzeBinding(model, { geosets } = {}) {
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
  // Touching vertices anywhere in the model, up to the widest Seams setting.
  const reach = scale * .02, cell = Math.max(reach, exact), grid = new Map(), touches = [];
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
  return { regionOfBone, count, scale, geosets: geosetList, offsets, geosetOf, vertexOf, position, normal, bones, pieces: pieceList, pieceOf, candidateBone, candidateDistance, neighbourStart, neighbours, touchPairs, touchDistance, current };
}

/** Bones that should not take vertices unless the user turns them on: roots
 * that hold nothing and only carry the skeleton, and portrait backdrops. */
export function defaultExcludedBones(model, analysis) {
  const used = new Set(analysis.current.flat()), excluded = new Set();
  const anyUsed = analysis.bones.some(region => region.ids.some(id => used.has(id)));
  const isLoose = region => region.parent === null && region.parentDriver === null && !analysis.bones.some(other => other.parent === region.id);
  const skeleton = analysis.bones.some(region => !isLoose(region));
  for (const region of analysis.bones) {
    const children = analysis.bones.filter(other => other.parent === region.id).length;
    for (const id of region.ids) {
      const name = model.Nodes?.[id]?.Name ?? (model.Bones || []).find(bone => bone.ObjectId === id)?.Name ?? '';
      // Loose bones outside the skeleton (corpse gibs, planes) carry props, not the body.
      const loose = skeleton && isLoose(region);
      if (/portrait|backdrop|glow/i.test(name) || loose || region.parent === null && children > 0 && (anyUsed ? !used.has(id) : children === 1)) excluded.add(id);
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
 * Bone groups for every analysed vertex. Sliders, each 0..1:
 * - rebind: 0 keeps every current binding whose bone is near its vertex (only
 *   seams, strays and unbound vertices change); 1 binds everything from the skeleton.
 * - soft: how far bending skin blends across joints.
 * - plates: how readily a separate piece moves stiffly as one.
 * - glue: how far apart touching vertices may be and still share one binding.
 * excluded: bone ids never used. marks: { [pieceKey]: { mode: 'auto'|'plate'|'bend'|'keep', bone } }.
 */
export function planBinding(analysis, settings = {}) {
  const { rebind = BIND_DEFAULTS.rebind, soft = BIND_DEFAULTS.soft, plates = BIND_DEFAULTS.plates, glue = BIND_DEFAULTS.glue, excluded = new Set(), marks = {} } = settings;
  const { count, bones, candidateBone, candidateDistance, pieces, pieceOf, neighbourStart, neighbours, scale, current, regionOfBone } = analysis;
  const allowed = bones.map(region => region.ids.some(id => !excluded.has(id)));
  const boneOf = b => bones[b].ids.find(id => !excluded.has(id)) ?? bones[b].id;
  if (!allowed.some(Boolean)) throw new Error('Turn on at least one bone to bind to.');
  const groups = new Array(count), locked = new Uint8Array(count), owner = new Int32Array(count).fill(-1);

  // 1. Skeleton: the nearest allowed bone per vertex, with speckles smoothed
  // away (a vertex follows the bone most of its connected neighbours have).
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

  // 2. Current binding: kept where its bones are allowed and not much further
  // away than the nearest bone. Rebind tightens "much further" from anything
  // (0) to nothing (1), so a vertex bound across the body is caught first.
  const factor = rebind <= 0 ? Infinity : rebind >= .999 ? -1 : 1 + 2 * (1 / rebind - 1);
  const keepable = new Uint8Array(count);
  for (let flat = 0; flat < count; flat++) {
    const group = current[flat];
    if (!group.length || group.some(id => excluded.has(id) || !regionOfBone.has(id))) continue;
    if (factor === Infinity) { keepable[flat] = 1; continue; }
    let distance = Infinity;
    for (const id of group) distance = Math.min(distance, regionDistance(analysis, flat, regionOfBone.get(id)));
    let nearest = Infinity;
    for (let slot = 0; slot < CANDIDATES; slot++) { const b = candidateBone[flat * CANDIDATES + slot]; if (b >= 0 && allowed[b]) { nearest = candidateDistance[flat * CANDIDATES + slot]; break; } }
    if (distance <= Math.max(nearest, scale * .01) * factor) keepable[flat] = 1;
  }

  // 3. Pieces: kept (mostly fine as bound), stiff (moves as one) or bending.
  const pieceMode = new Array(pieces.length), pieceBones = new Array(pieces.length);
  for (const piece of pieces) {
    const mark = marks[piece.key] || {};
    let mode = mark.mode && mark.mode !== 'auto' ? mark.mode : null;
    // Pieces held only by bones that are turned off stay exactly as they are.
    if (!mode && piece.vertices.every(flat => current[flat].length && current[flat].every(id => excluded.has(id)))) mode = 'keep';
    const tally = new Map();
    for (const flat of piece.vertices) tally.set(owner[flat], (tally.get(owner[flat]) || 0) + 1);
    const ranked = [...tally].sort((a, b) => b[1] - a[1]);
    const [top, topCount] = ranked[0], share = topCount / piece.vertices.length;
    if (!mode) {
      let kept = 0; for (const flat of piece.vertices) kept += keepable[flat];
      if (kept >= piece.vertices.length * .5) mode = 'clean';
    }
    if (!mode) {
      const small = piece.size <= Math.max(bones[top].length, scale * .05) * (.15 + plates * .85);
      mode = plates >= .999 || plates > 0 && (share >= 1 - plates * .5 || small) ? 'plate' : 'bend';
    }
    pieceMode[piece.index] = mode;
    if (mode === 'plate') {
      const second = ranked[1];
      // A stiff piece split nearly evenly over two neighbouring bones follows both.
      pieceBones[piece.index] = Number.isInteger(mark.bone) ? [mark.bone]
        : (second && second[1] / piece.vertices.length >= .4 && hierarchyNear(bones, top, second[0]) ? [top, second[0]] : [top]).map(boneOf);
    }
  }

  // 4. Groups. Bending vertices take their bone plus close neighbours across a joint.
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
    const piece = pieceOf[flat], mode = pieceMode[piece];
    if (mode === 'keep') { groups[flat] = current[flat].slice(); locked[flat] = 3; }
    else if (mode === 'plate') { groups[flat] = pieceBones[piece].slice(); locked[flat] = 2; }
    else if (mode === 'clean') { if (keepable[flat]) { groups[flat] = current[flat].slice(); locked[flat] = 2; } else pending.push(flat); }
    else groups[flat] = skeletonGroup(flat);
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

  // 5. Kept pieces: a stray vertex sharing no bone with any neighbour takes
  // theirs, and a piece almost wholly on one binding moves as one (Plates).
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
    if (plates <= 0) continue;
    const tally = new Map();
    for (const flat of piece.vertices) { const key = groups[flat].join(','); tally.set(key, (tally.get(key) || 0) + 1); }
    const [key, most] = [...tally].sort((a, b) => b[1] - a[1])[0];
    if (most < piece.vertices.length && most >= piece.vertices.length * (1 - plates * .15)) {
      // Only vertices sharing no bone with the rest are strays; joint blends stay.
      const group = key.split(',').map(Number);
      for (const flat of piece.vertices) if (!groups[flat].some(id => group.includes(id))) groups[flat] = group.slice();
    }
  }

  // 6. Seams: vertices that touch share one binding. Kept pieces win, then
  // stiff and cleaned pieces (bigger first), so a seam follows the part it is fixed to.
  const tolerance = scale * (1e-4 + glue * glue * .02);
  const seams = unionFind(count);
  for (let i = 0; i < analysis.touchDistance.length; i++) if (analysis.touchDistance[i] <= tolerance) seams.join(analysis.touchPairs[i * 2], analysis.touchPairs[i * 2 + 1]);
  const winners = new Map();
  // Between equals, the side that agrees with the skeleton wins.
  const agrees = flat => groups[flat].includes(boneOf(owner[flat])) ? 1 : 0;
  const rank = flat => locked[flat] * 1e9 + agrees(flat) * 1e8 + (locked[flat] ? pieces[pieceOf[flat]].vertices.length : 0);
  for (let flat = 0; flat < count; flat++) {
    const root = seams.find(flat), best = winners.get(root);
    if (best === undefined || rank(flat) > rank(best)) winners.set(root, flat);
  }
  for (let flat = 0; flat < count; flat++) {
    const winner = winners.get(seams.find(flat));
    if (winner !== undefined && winner !== flat && locked[flat] !== 3) groups[flat] = groups[winner].slice();
  }
  for (let flat = 0; flat < count; flat++) groups[flat] = [...new Set(groups[flat])].sort((a, b) => a - b);
  return { groups, pieceMode, owner, keepable };
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
