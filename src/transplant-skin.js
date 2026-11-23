// Transplant v2, item 4: skin on the donor's bones. Contract: docs/agent-tasks/xfer-transplant-v2-skin.md
// (sections 4.2 to 4.5). Pure: three.js vectors and the trees and maps the caller passes; no model access
// beyond the donor's nodes for its skin carriers.
import { Vector3 } from 'three';
import { geosetMaterialLayers, hasOnlyAdditiveLayers } from './geoset-extras.js';
import { isHdSkinned, vertexBoneWeights, vertexBones } from './part-bones.js';

/** Share of the shorter neighbouring segment (along a run) inside which a vertex goes on both joints. */
export const SKIN_BAND = 0.10;

const keyed = node => ['Translation', 'Rotation', 'Scaling'].some(property => node?.[property]?.Keys?.length);

/** Runs (4.2): donor part joints no own joint takes, between a paired joint `a` above and a paired joint `q`
 * below, each with exactly one paired joint below it. `treeA`/`treeB` as `nodeIndex` gives them; `pA`/`pB`
 * bind pivots (Vector3) of donor/own nodes; `pairedOwn`: donor joint -> own joint.
 * -> [{ a, q, joints, seq, bounds, host, start, end }] */
export function transplantRuns({ donorPartJoints, ownPartJoints, pairedOwn, isDonorJoint, treeA, treeB, pA, pB, minLength = 0 }) {
  const pairedBelow = id => {
    let count = 0;
    const walk = at => { for (const child of treeA.children.get(at) || []) { if (!isDonorJoint(child.ObjectId)) continue; if (pairedOwn.has(child.ObjectId)) count++; else walk(child.ObjectId); } };
    walk(id);
    return count;
  };
  const runs = [];
  for (const q of pairedOwn.keys()) {
    const joints = [];
    let a = null;
    for (let at = treeA.parentOf(q); at != null; at = treeA.parentOf(at)) {
      if (pairedOwn.has(at)) { a = at; break; }
      if (!donorPartJoints.has(at) || !isDonorJoint(at) || pairedBelow(at) !== 1) break;
      joints.unshift(at);
    }
    if (a == null || !joints.length) continue;
    const seq = [a, ...joints], path = [...seq, q].map(pA);
    const lengths = path.slice(1).map((p, i) => p.distanceTo(path[i])), total = lengths.reduce((s, l) => s + l, 0);
    if (total <= 1e-9) continue;
    const bounds = [0]; let sum = 0;
    for (let i = 0; i < joints.length; i++) { sum += lengths[i]; bounds.push(sum / total); }
    bounds.push(1);
    const start = pB(pairedOwn.get(a)), end = pB(pairedOwn.get(q));
    if (end.distanceTo(start) < minLength) continue;
    const host = treeB.ancestors(pairedOwn.get(q)).find(id => ownPartJoints.has(id));
    if (host == null) continue;
    runs.push({ a, q, joints, seq, bounds, host, start, end });
  }
  return runs;
}

/** Donor joints for a point (4.3 steps 3 and 4): one, or two at a joint's plane (`band: false`: always one,
 * for an extra's centroid). `defaultJoint` replaces each run's top joint `a`. A run with `radius` takes only
 * points within that distance of its line. */
export function splitJoints(point, defaultJoint, runs, { band = true } = {}) {
  let best = null;
  for (const run of runs) {
    const axis = run.end.clone().sub(run.start), length = axis.lengthSq();
    if (length <= 1e-12) continue;
    const t = point.clone().sub(run.start).dot(axis) / length, b = run.bounds, n = run.joints.length;
    const width = i => SKIN_BAND * Math.min(b[i] - b[i - 1], b[i + 1] - b[i]);
    if (t < b[1] - width(1)) continue;
    const d = point.distanceTo(run.start.clone().addScaledVector(axis, Math.min(1, Math.max(0, t))));
    // A run with a reach (a neck inside the chest) takes only skin that near its line: not the shoulders.
    if (run.radius != null && d > run.radius) continue;
    if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) <= 1e-9 && run.q < best.run.q)) best = { d, t, run, n, width };
  }
  if (!best) return [defaultJoint];
  const { t, run, n, width } = best, b = run.bounds, of = j => j === run.a ? defaultJoint : j;
  if (band) {
    let near = null;
    for (let i = 1; i <= n; i++) if (Math.abs(t - b[i]) <= width(i) && (!near || Math.abs(t - b[i]) < Math.abs(t - b[near]))) near = i;
    if (near != null) return [of(run.seq[near - 1]), of(run.seq[near])];
  }
  let index = 0;
  for (let i = 1; i <= n; i++) if (b[i] <= t) index = i;
  return [of(run.seq[index])];
}

/** The donor bone that carries each donor part joint's skin (4.4): the joint itself when it is a bone with skin;
 * else the still skinned bone under it (no keys on it or between) with the most vertices; else the joint.
 * `skinCount`: Map(donor node id -> vertices). -> Map(part joint -> bone id) */
export function donorSkinCarriers({ donor, donorPartJoints, treeA, skinCount, movingCarrier = false }) {
  const bones = new Set((donor.Bones || []).map(node => node.ObjectId)), carriers = new Map(), best = new Map();
  for (const node of donor.Bones || []) {
    const count = skinCount.get(node.ObjectId) || 0;
    if (!count || donorPartJoints.has(node.ObjectId)) continue;
    let moving = keyed(node), joint = null;
    for (let at = treeA.parentOf(node.ObjectId); at != null; at = treeA.parentOf(at)) {
      if (donorPartJoints.has(at)) { joint = at; break; }
      if (keyed(treeA.byId.get(at))) moving = true;
    }
    if (joint == null || moving) continue;
    const held = best.get(joint);
    if (!held || count > held.count || (count === held.count && node.ObjectId < held.id)) best.set(joint, { id: node.ObjectId, count });
  }
  for (const joint of donorPartJoints) {
    if (bones.has(joint) && (skinCount.get(joint) || 0) > 0) carriers.set(joint, joint);
    else {
      let carrier = best.get(joint)?.id ?? joint;
      if (movingCarrier && carrier === joint && !keyed(treeA.byId.get(joint))) {
        const moving = (treeA.children.get(joint) || []).filter(n =>
          bones.has(n.ObjectId) && !donorPartJoints.has(n.ObjectId) && skinCount.get(n.ObjectId) > 0 && keyed(n));
        if (moving.length === 1) carrier = moving[0].ObjectId;
      }
      carriers.set(joint, carrier);
    }
  }
  return carriers;
}

/** The body's travel ratio from the fitted legs (4.5): the own leg's drop when each own stretch points as the
 * donor's (or along `along`, when given), over the donor's drop; the mean over legs.
 * legs: [{ own: Vector3[], donor: Vector3[], along?: Vector3[] }], stretch by stretch. */
export function legTravelRatio(legs, fallback, minDrop = 0) {
  const ratios = [];
  for (const leg of legs) {
    const own = new Vector3(), donor = new Vector3();
    leg.own.forEach((stretch, i) => { const direction = (leg.along?.[i] || leg.donor[i]).clone(); if (direction.lengthSq() > 1e-12) own.addScaledVector(direction.normalize(), stretch.length()); donor.add(leg.donor[i]); });
    if (Math.abs(donor.z) <= minDrop || Math.abs(donor.z) <= 1e-9) return fallback;
    ratios.push(own.z / donor.z);
  }
  return ratios.length ? ratios.reduce((s, r) => s + r, 0) / ratios.length : fallback;
}

const jointSet = weights => [...new Set(weights.map(([id]) => id))].sort((a, b) => a - b);
const seamKey = (a, b) => a < b ? a + '/' + b : b + '/' + a;
const additive = (model, geo) => hasOnlyAdditiveLayers(geosetMaterialLayers(model, geo));

function meshNeighbours(geo) {
  const neighbours = Array.from({ length: geo.Vertices.length / 3 }, () => new Set());
  for (let f = 0; f + 2 < geo.Faces.length; f += 3) {
    for (let side = 0; side < 3; side++) {
      const a = geo.Faces[f + side], b = geo.Faces[f + (side + 1) % 3];
      if (a === b || !neighbours[a] || !neighbours[b]) continue;
      neighbours[a].add(b);
      neighbours[b].add(a);
    }
  }
  return neighbours;
}

/** The donor's actual edge transitions and its existing blends, in result bone ids. */
function donorSeams(donor, resultId) {
  const edges = new Set(), blends = new Map(), joints = new Set();
  for (const geo of donor.Geosets) {
    if (additive(donor, geo)) continue;
    const signatures = Array.from({ length: geo.Vertices.length / 3 }, (_, v) => {
      const weights = vertexBoneWeights(geo, v).map(([id, weight]) => [resultId(id), weight]);
      const ids = jointSet(weights);
      if (!ids.length || ids.some(id => id == null)) return '';
      for (const id of ids) joints.add(id);
      const key = ids.join(',');
      for (const [i, a] of ids.entries()) for (const b of ids.slice(i + 1)) {
        const pair = seamKey(a, b);
        if (!blends.has(pair)) blends.set(pair, new Map());
        if (!blends.get(pair).has(key)) blends.get(pair).set(key, weights);
      }
      return key;
    });
    for (const [v, neighbours] of meshNeighbours(geo).entries()) {
      for (const other of neighbours) {
        if (other > v && signatures[v] && signatures[other]) edges.add(seamKey(signatures[v], signatures[other]));
      }
    }
  }
  return { edges, blends, joints };
}

function repairSeamGeoset(geo, source, donor, pivotOf, excluded) {
  const neighbours = meshNeighbours(geo), hd = isHdSkinned(geo);
  const weights = neighbours.map((_, v) => vertexBoneWeights(geo, v));
  const ids = weights.map(jointSet), signatures = ids.map(bones => bones.join(','));
  const eligible = ids.map((bones, v) => !excluded.has(v) && bones.length && bones.every(id => donor.joints.has(id)));
  const native = neighbours.map((_, v) => vertexBones(source, v));
  const repaired = new Map();
  const connects = (a, b) => a === b || donor.edges.has(seamKey(a, b));

  function rigidPiece(v) {
    const bone = native[v].length === 1 ? native[v][0] : null;
    if (bone == null) return [v];
    const piece = new Set([v]), pending = [v];
    while (pending.length) for (const next of neighbours[pending.pop()]) {
      if (!piece.has(next) && eligible[next] && native[next].length === 1 && native[next][0] === bone) {
        piece.add(next);
        pending.push(next);
      }
    }
    return [...piece];
  }

  function chooseBlend(a, b) {
    const candidates = new Map();
    for (const left of ids[a]) for (const right of ids[b]) {
      if (left === right) continue;
      for (const [key, blend] of donor.blends.get(seamKey(left, right)) ?? []) {
        if (!hd || blend.every(([id]) => id <= 255)) candidates.set(key, blend);
      }
    }
    let best = null, bestCost = Infinity;
    for (const [key, blend] of candidates) {
      let newSeams = 0;
      for (const v of [a, b]) for (const neighbour of neighbours[v]) {
        if (neighbour !== a && neighbour !== b && eligible[neighbour] && !connects(key, signatures[neighbour])) newSeams++;
      }
      const cost = newSeams + jointSet(blend).length / 10;
      if (cost < bestCost) { bestCost = cost; best = blend; }
    }
    return best;
  }

  function nearestJoint(piece, candidates) {
    let best = null, bestDistance = Infinity;
    for (const id of candidates) {
      const pivot = pivotOf(id);
      if (!pivot || (hd && id > 255)) continue;
      let distance = 0;
      for (const v of piece) {
        const at = v * 3;
        distance += Math.hypot(geo.Vertices[at] - pivot.x, geo.Vertices[at + 1] - pivot.y, geo.Vertices[at + 2] - pivot.z);
      }
      if (distance < bestDistance) { best = id; bestDistance = distance; }
    }
    return best;
  }

  for (const [a, adjacent] of neighbours.entries()) {
    if (!eligible[a]) continue;
    for (const b of adjacent) {
      if (b <= a || !eligible[b] || connects(signatures[a], signatures[b])) continue;
      let piece = [a, b], replacement = chooseBlend(a, b);
      if (!replacement) {
        piece = [...new Set([...rigidPiece(a), ...rigidPiece(b)])];
        const nearer = nearestJoint(piece, new Set([...ids[a], ...ids[b]]));
        if (nearer == null) continue;
        replacement = [[nearer, 1]];
      }
      const joints = jointSet(replacement), key = joints.join(',');
      for (const v of piece) {
        if (signatures[v] === key) continue;
        signatures[v] = key;
        ids[v] = joints;
        repaired.set(v, replacement);
      }
    }
  }
  if (!repaired.size) return 0;
  const groups = [], index = new Map(), vertexGroup = [];
  for (let v = 0; v < weights.length; v++) {
    const replacement = repaired.get(v);
    const group = replacement ? replacement.map(([id]) => id).sort((a, b) => a - b)
      : Array.from(geo.Groups[geo.VertexGroup[v]] || []);
    const key = group.join(',');
    if (!index.has(key)) { index.set(key, groups.length); groups.push(group); }
    vertexGroup.push(index.get(key));
  }
  if (groups.length > 256) return 0;
  if (hd) for (const [v, replacement] of repaired) {
    const shares = new Map();
    for (const [id, weight] of replacement) shares.set(id, (shares.get(id) || 0) + weight);
    const total = [...shares.values()].reduce((sum, value) => sum + value, 0);
    let left = 255;
    const packed = new Uint8Array(8);
    [...shares].forEach(([id, weight], i) => {
      packed[i] = id;
      packed[4 + i] = i === shares.size - 1 ? left : Math.min(left, Math.round(255 * weight / total));
      left -= packed[4 + i];
    });
    for (let i = 0; i < packed.length; i++) geo.SkinWeights[v * 8 + i] = packed[i];
  }
  geo.Groups = groups;
  geo.VertexGroup = ArrayBuffer.isView(geo.VertexGroup) ? new geo.VertexGroup.constructor(vertexGroup) : vertexGroup;
  geo.TotalGroupsCount = groups.reduce((sum, group) => sum + group.length, 0);
  return repaired.size;
}

/** Repair donor-joint transitions invented by skin sharing, before pruning unused result bones. */
export function repairDonorSeams(model, own, donor, resultId, pivotOf, excluded) {
  const seams = donorSeams(donor, resultId);
  let changed = 0;
  for (const [g, geo] of model.Geosets.entries()) {
    if (!additive(model, geo)) changed += repairSeamGeoset(geo, own.Geosets[g], seams, pivotOf, excluded.get(geo) ?? new Set());
  }
  return changed;
}
