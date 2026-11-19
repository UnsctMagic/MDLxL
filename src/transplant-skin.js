// Transplant v2, item 4: skin on the donor's bones. Contract: docs/agent-tasks/xfer-transplant-v2-skin.md
// (sections 4.2 to 4.5). Pure: three.js vectors and the trees and maps the caller passes; no model access
// beyond the donor's nodes for its skin carriers.
import { Vector3 } from 'three';

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
export function donorSkinCarriers({ donor, donorPartJoints, treeA, skinCount }) {
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
    else carriers.set(joint, best.get(joint)?.id ?? joint);
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
