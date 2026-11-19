// Hand-animation kit for the AI. Pose a rig with a few world-space moves (turn, move, aim, reach,
// hold, plant), list key poses, animate them into a dense clip in memory, check it in numbers, and
// write only that clip's keys with few strong keys. Pure: no DOM, runs in the AI sandbox and in node.
// Reuses MDLxL's own playback (animation.js), limb finder and two-bone solve (pose-ik.js), rig parts
// and clipping count (mesh-intersect.js); nothing here is a second engine for those.
import { Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, composeNodeMatrices, inheritedParentMatrix, nodePivot, sampleGeosetAnimation, sampleNodeProperty, sampleTrack, TRANSFORM_DEFAULTS, visitTracks } from './animation.js';
import { nodeIndex } from './node-hierarchy.js';
import { vertexBoneWeights } from './part-bones.js';
import { solveTwoBone, suggestPoseChain, suggestPoseRig } from './pose-ik.js';
import { automaticParts, poseCrossings, rigPartLabels } from './mesh-intersect.js';
import { referenceSequence } from './ai-motion-style.js';
import { nameSide } from './rig-names.js';

const PROPS = ['Translation', 'Rotation', 'Scaling'];
const DIM = { Translation: 3, Rotation: 4, Scaling: 3 };
const DEG = Math.PI / 180;
const round = (value, digits = 2) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const v3 = a => a?.isVector3 ? a.clone() : new Vector3().fromArray(a);
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

// ---- quaternion helpers ---------------------------------------------------------------------------
const arc = (from, to) => {
  const a = v3(from), b = v3(to);
  if (a.lengthSq() < 1e-18 || b.lengthSq() < 1e-18) return new Quaternion();
  return new Quaternion().setFromUnitVectors(a.normalize(), b.normalize());
};
const axisDeg = (axis, deg) => new Quaternion().setFromAxisAngle(v3(axis).normalize(), deg * DEG);
// World axes (Warcraft III: +X forward, +Z up). yaw+ turns +X toward +Y, pitch+ tips +X down (leans
// forward), roll+ lifts the +Y side. Degrees.
const euler = (yaw = 0, pitch = 0, roll = 0) => axisDeg([0, 0, 1], yaw).multiply(axisDeg([0, 1, 0], pitch)).multiply(axisDeg([1, 0, 0], roll));
function logQ(q) {
  let { x, y, z, w } = q;
  if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
  const s = Math.hypot(x, y, z);
  if (s < 1e-12) return new Vector3();
  const k = 2 * Math.atan2(s, w) / s;
  return new Vector3(x * k, y * k, z * k);
}
function expQ(v) {
  const a = v.length();
  if (a < 1e-12) return new Quaternion();
  const s = Math.sin(a / 2) / a;
  return new Quaternion(v.x * s, v.y * s, v.z * s, Math.cos(a / 2));
}
const rotationOf = matrix => { const p = new Vector3(), q = new Quaternion(), s = new Vector3(); matrix.decompose(p, q, s); return q; };
const angleBetween = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]) / ((Math.hypot(...a) * Math.hypot(...b)) || 1)));

// ---- poses ----------------------------------------------------------------------------------------

// One local { t, r, s } per node; world matrices are composed with MDLxL's own playback rules.
class Pose {
  constructor(rig, values) { this.rig = rig; this.values = values; this.cache = null; }
  /** A separate copy to edit. */
  copy() { return new Pose(this.rig, new Map([...this.values].map(([id, v]) => [id, { t: [...v.t], r: [...v.r], s: [...v.s] }]))); }
  changed() { this.cache = null; return this; }
  /** Local { t, r, s } of a bone (read or edit; call changed() after editing it by hand). */
  local(bone) { return this.values.get(this.rig.find(bone)); }
  matrices() {
    if (!this.cache) {
      const values = this.values;
      this.cache = composeNodeMatrices(this.rig.model, this.rig.ids, node => {
        const v = values.get(node.ObjectId);
        return { t: new Vector3().fromArray(v.t), r: new Quaternion().fromArray(v.r).normalize(), s: new Vector3().fromArray(v.s) };
      }, this.rig.byId);
    }
    return this.cache;
  }
  matrix(bone) { return this.matrices().get(this.rig.find(bone)) || new Matrix4(); }
  /** World position of a bind-pose point carried by a bone (default its pivot). */
  point(bone, point) {
    const id = this.rig.find(bone);
    return v3(point ?? this.rig.pivot(id)).applyMatrix4(this.matrix(id));
  }
  /** World position (pivot or a bind point), world rotation quaternion and matrix of a bone. */
  world(bone, point) {
    const id = this.rig.find(bone), matrix = this.matrix(id);
    return { position: this.point(id, point).toArray(), rotation: rotationOf(matrix).toArray(), matrix: matrix.toArray() };
  }
  worldRotation(id) { return rotationOf(this.matrix(id)); }
  parentMatrix(id) {
    const node = this.rig.byId.get(id), parent = node.Parent != null && this.rig.byId.has(node.Parent) ? this.matrix(node.Parent) : new Matrix4();
    return inheritedParentMatrix(parent, node.Flags);
  }
  /** Give a bone this world rotation (quaternion array or Quaternion); its pivot stays put. */
  setWorldRotation(bone, rotation) {
    const id = this.rig.find(bone), q = rotation?.isQuaternion ? rotation.clone() : new Quaternion().fromArray(rotation).normalize();
    const local = rotationOf(this.parentMatrix(id)).invert().multiply(q).normalize(), v = this.values.get(id);
    if (local.x * v.r[0] + local.y * v.r[1] + local.z * v.r[2] + local.w * v.r[3] < 0) local.set(-local.x, -local.y, -local.z, -local.w);
    v.r = local.toArray();
    return this.changed();
  }
  /** Turn a bone in WORLD axes about its own pivot: { yaw, pitch, roll } in degrees (yaw+ turns +X toward
   * +Y, pitch+ leans forward/down, roll+ lifts the +Y side), or { axis: [x,y,z], deg }. frameBone: use that
   * bone's axes. */
  turn(bone, { yaw = 0, pitch = 0, roll = 0, axis, deg = 0 } = {}, frameBone) {
    const id = this.rig.find(bone);
    let delta = axis ? axisDeg(axis, deg) : euler(yaw, pitch, roll);
    if (frameBone != null) { const f = this.worldRotation(this.rig.find(frameBone)); delta = f.clone().multiply(delta).multiply(f.invert()); }
    return this.setWorldRotation(id, delta.multiply(this.worldRotation(id)));
  }
  /** Move a bone by a WORLD offset [dx, dy, dz] (its children follow). */
  move(bone, delta) {
    const id = this.rig.find(bone), m = this.parentMatrix(id).clone().setPosition(0, 0, 0).invert(), local = v3(delta).applyMatrix4(m), v = this.values.get(id);
    v.t = [v.t[0] + local.x, v.t[1] + local.y, v.t[2] + local.z];
    return this.changed();
  }
  /** Point a bone's axis (pivot to `end`: a bind point or another bone's pivot) along a world direction. */
  aim(bone, end, direction) {
    const id = this.rig.find(bone), tip = Array.isArray(end) || end?.isVector3 ? v3(end) : v3(this.rig.pivot(this.rig.find(end)));
    const current = this.point(id, tip).sub(this.point(id));
    return this.setWorldRotation(id, arc(current, direction).multiply(this.worldRotation(id)));
  }
  /** Two-bone reach: the chain's end pivot (or opts.point, a bind point on the end bone) to a world target.
   * pole: world direction the elbow/knee bends toward (default: keep its current bend). The end bone keeps
   * its world rotation unless opts.keepEnd is false. Longer chains bend at their second joint and keep the
   * rest rigid. Returns the distance left to the target (0 when reached). */
  reach(chain, target, pole, { keepEnd = true, point } = {}) {
    const c = this.rig.chain(chain), joints = c.joints, root = joints[0], middle = joints[1], end = joints.at(-1);
    const endRotation = this.worldRotation(end), goal = v3(target);
    const at = () => point ? this.point(end, point) : this.point(end);
    const pRoot = this.point(root), pMiddle = this.point(middle), pEnd = at();
    const lengths = [pMiddle.distanceTo(pRoot), pEnd.distanceTo(pMiddle)];
    if (Math.min(...lengths) < 1e-6) throw Error('This chain has a zero-length segment; choose other joints.');
    const geometry = solveTwoBone({ root: pRoot, middle: pMiddle, end: pEnd, lengths, tolerance: 1e-4, rotations: [this.worldRotation(root)] }, goal, pole ? pRoot.clone().add(v3(pole)) : undefined);
    this.setWorldRotation(root, arc(pMiddle.clone().sub(pRoot), geometry.middle.clone().sub(pRoot)).multiply(this.worldRotation(root)));
    const m2 = this.point(middle), e2 = at();
    this.setWorldRotation(middle, arc(e2.clone().sub(m2), geometry.end.clone().sub(m2)).multiply(this.worldRotation(middle)));
    if (keepEnd) this.setWorldRotation(end, endRotation);
    return at().distanceTo(goal);
  }
  /** A hand holds its weapon: the hand pivot (or opts.at, a bind point on the weapon) goes to world `grip`
   * and the weapon (hand pivot to its tip, default the farthest skinned vertex below the hand) points
   * along world `direction`, rolled opts.roll degrees about it. pole bends the elbow. Returns the
   * distance left to the grip. */
  hold(hand, grip, direction, pole, { roll = 0, tip, at } = {}) {
    const c = this.rig.chain(hand), end = c.joints.at(-1), held = this.rig.heldBy(end), tipPoint = tip || held?.tip;
    if (!tipPoint) throw Error('Nothing is held below this hand; give opts.tip, a bind point on the weapon.');
    const owner = held?.tipBone ?? end;
    const axis = this.point(owner, tipPoint).sub(this.point(end));
    const dir = v3(direction).normalize(), turn = axisDeg(dir, roll).multiply(arc(axis, dir)), wanted = turn.multiply(this.worldRotation(end));
    this.setWorldRotation(end, wanted);
    // The weapon is rigid in the hand, so the grip's offset from the wrist is known once the hand is turned.
    const offset = at ? this.point(owner, at).sub(this.point(end)) : new Vector3();
    this.reach(c, v3(grip).sub(offset), pole, { keepEnd: false });
    this.setWorldRotation(end, wanted);
    return (at ? this.point(owner, at) : this.point(end)).distanceTo(v3(grip));
  }
  /** Where each leg's end is now: [{ chain, position, rotation }], to plant them later. */
  feet(legs = this.rig.chains.legs) {
    return legs.map(leg => { const c = this.rig.chain(leg), end = c.joints.at(-1); return { chain: c, position: this.point(end).toArray(), rotation: this.worldRotation(end).toArray() }; });
  }
  /** Keep feet where `targets` say: an array (one per leg) of world positions, { position, rotation }, or
   * the result of pose.feet(). legs default to the targets' own chains. Returns the largest distance left. */
  plant(legs, targets) {
    if (targets === undefined) { targets = legs; legs = null; }
    let worst = 0;
    targets.forEach((target, i) => {
      const chain = legs?.[i] ?? target.chain, position = Array.isArray(target) || target?.isVector3 ? target : target.position;
      const c = this.rig.chain(chain), end = c.joints.at(-1);
      worst = Math.max(worst, this.reach(c, position));
      if (target.rotation) this.setWorldRotation(end, target.rotation);
    });
    return worst;
  }
  /** This pose blended toward another by u (0..1); bones limits the blend to those bones. */
  blend(other, u, bones) { return blendPoses(this, other, u, bones); }
}

/** What rig, pose and clip objects offer (the methods are not module exports). */
export function kitHelp() {
  return {
    rig: 'kitRig(model): find(nameOrRegex), findAll(regex), chains {arms, legs, mountLegs, all: [{name, joints, kind, side (+Y/-Y), nameSide, shown}]}, held [{hand, tip, tipBone, kind}], body, mount, rider, rest(), pose(sequence, ms), chain(bone), sequence(name)',
    pose: 'copy(), world(bone, point?) -> {position, rotation}, point(bone, point?), turn(bone, {yaw, pitch, roll} | {axis, deg}, frameBone?), move(bone, [dx,dy,dz]), aim(bone, endPointOrBone, dir), reach(chain, target, poleDir?, {keepEnd, point}), hold(hand, grip, dir, poleDir?, {roll, tip, at}), feet(legs?), plant(legs?, targets), setWorldRotation(bone, q), blend(other, u, bones?)',
    clip: 'animate(rig, {sequence, length, loop, keys: [{ms, pose}], each(ms, pose), smooth: {ms, holds}, follow: [{chain, frequency, damping, maxDeg, share}], easeBack, timing: [[srcMs, outMs]], offsets, template}) -> clip: pose(ms), check({clipping, step}), fit(model, {tolerance}), write(model, {tolerance, curve})',
    axes: 'World: +X forward, +Z up. yaw+ turns +X toward +Y, pitch+ tips +X down (lean forward), roll+ lifts the +Y side. Degrees, model units, ms from the clip start. Check sides with a capture: rigs differ in which side +Y is.',
  };
}

/** Pose a toward pose b by u (0 = a, 1 = b): translations and scales mixed, rotations slerped. */
export function blendPoses(a, b, u, bones) {
  const out = a.copy(), ids = bones ? bones.map(x => a.rig.find(x)) : [...out.values.keys()];
  for (const id of ids) {
    const p = a.values.get(id), q = b.values.get(id), o = out.values.get(id);
    if (!p || !q) continue;
    o.t = p.t.map((x, i) => x + (q.t[i] - x) * u); o.s = p.s.map((x, i) => x + (q.s[i] - x) * u);
    o.r = new Quaternion().fromArray(p.r).normalize().slerp(new Quaternion().fromArray(q.r).normalize(), u).toArray();
  }
  return out.changed();
}

// ---- rig ------------------------------------------------------------------------------------------

/** The model's rig for hand animation: nodes, parents, pivots, find(nameOrRegex), limb chains (arms, legs,
 * mount legs), what each hand holds, rest() and pose(sequence, ms). Bones are ObjectIds or names. */
export function kitRig(model) {
  const nodes = allNodes(model), tree = nodeIndex(model, nodes), byId = tree.byId;
  const ids = nodes.map(n => n.ObjectId).sort((a, b) => tree.depth(a) - tree.depth(b) || a - b);
  const reference = referenceSequence(model);
  const rig = {
    model, tree, byId, ids, reference,
    nodes: ids.map(id => ({ id, name: byId.get(id).Name || '', parent: tree.parentOf(id), pivot: Array.from(nodePivot(model, byId.get(id))) })),
    pivot: id => Array.from(nodePivot(model, byId.get(id))),
    parent: id => tree.parentOf(rig.find(id)),
    name: id => byId.get(id)?.Name || `node ${id}`,
    /** A bone by ObjectId, exact name, name part or RegExp (case-insensitive). Throws when none matches. */
    find(x) {
      if (Number.isInteger(x) && byId.has(x)) return x;
      if (x instanceof RegExp) { const hit = nodes.find(n => x.test(n.Name || '')); if (hit) return hit.ObjectId; }
      else if (typeof x === 'string') {
        const want = x.trim().toLowerCase(), names = nodes.map(n => [n, String(n.Name || '').trim().toLowerCase()]);
        const hit = names.find(([, n]) => n === want) || names.find(([, n]) => n.includes(want));
        if (hit) return hit[0].ObjectId;
      }
      throw Error(`No bone ${String(x)}. Some names: ${nodes.slice(0, 40).map(n => n.Name).join(', ')}`);
    },
    findAll: pattern => nodes.filter(n => (pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i')).test(n.Name || '')).map(n => n.ObjectId),
    /** Sequence index by name or index; -1 when missing. */
    sequence(x) {
      if (Number.isInteger(x)) return model.Sequences?.[x] ? x : -1;
      const want = String(x ?? '').trim().toLowerCase();
      return (model.Sequences || []).findIndex(s => String(s.Name || '').trim().toLowerCase() === want);
    },
    /** Bind pose: every node at its default local transform. */
    rest() { return new Pose(rig, new Map(ids.map(id => [id, { t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1] }]))); },
    /** The pose an existing animation shows at ms after its start (local T/R/S per node). */
    pose(sequence, ms = 0) {
      const index = rig.sequence(sequence);
      if (index < 0) throw Error(`No animation ${sequence}.`);
      const [start, end] = model.Sequences[index].Interval, frame = clamp(start + ms, start, end);
      return new Pose(rig, new Map(ids.map(id => {
        const node = byId.get(id), get = p => sampleNodeProperty(model, node, p, frame, index);
        return [id, { t: get('Translation'), r: get('Rotation'), s: get('Scaling') }];
      })));
    },
    /** A limb chain: a chain object, or a bone in one (its end, or any joint); else POSE's suggestion. */
    chain(x) {
      if (x?.joints) return x;
      if (x?.root != null && x?.end != null) return { ...x, joints: x.joints || [x.root, x.middle, x.end] };
      const id = rig.find(x), found = rig.chains.all.find(c => c.end === id) || rig.chains.all.find(c => c.joints.includes(id));
      if (found) return found;
      const c = suggestPoseChain(model, id);
      return { ...c, joints: c.joints || [c.root, c.middle, c.end], name: rig.name(id) };
    },
    /** What a hand (chain end) holds: { hand, tip, tipBone, objects }, or null. */
    heldBy: end => rig.held.find(h => h.hand === end) || null,
  };
  let found = { chains: [], body: null, roles: {} };
  try { found = suggestPoseRig(model, reference >= 0 ? model.Sequences[reference].Interval[0] : 0, reference); } catch { /* names only */ }
  let labels = new Map();
  try { labels = rigPartLabels(model); } catch { /* no parts */ }
  // Skin of every vertex (bones, weights), shared by hold, check and write.
  rig.skin = (model.Geosets || []).map(geoset => {
    const count = (geoset.Vertices?.length || 0) / 3, list = [];
    for (let v = 0; v < count; v++) list.push(vertexBoneWeights(geoset, v));
    return list;
  });
  // Joints that carry skin shown in the stand pose (hidden death or portrait copies of a rig do not).
  const carries = new Set();
  (model.Geosets || []).forEach((geoset, gi) => {
    if (reference >= 0 && sampleGeosetAnimation(model, gi, model.Sequences[reference].Interval[0], reference).alpha < .01) return;
    for (const weights of rig.skin[gi]) for (const [b] of weights) for (const a of tree.ancestors(b, true)) carries.add(a);
  });
  const bodyY = found.body != null ? rig.pivot(found.body)[1] : 0, hasArms = found.chains.some(c => c.kind === 'arm' && !c.label);
  const all = found.chains.filter(c => c.kind === 'arm' || c.kind === 'leg').map(c => {
    const joints = c.joints || [c.root, c.middle, c.end], y = rig.pivot(c.end)[1];
    const mount = c.kind === 'leg' && (labels.get(c.root) === 'mount' || c.label === 'Hoof' && hasArms);
    const side = Math.abs(y - bodyY) < 1e-3 ? 'middle' : y > bodyY ? '+Y' : '-Y';
    return { ...c, joints, side, nameSide: nameSide(rig.name(c.end)), mount, shown: joints.some(j => carries.has(j)), name: `${mount ? 'mount ' : ''}${c.kind} ${side} (${rig.name(c.end)})` };
  });
  const shown = list => list.some(c => c.shown) ? list.filter(c => c.shown) : list;
  rig.chains = { all, arms: shown(all.filter(c => c.kind === 'arm' && !c.label)), legs: shown(all.filter(c => c.kind === 'leg' && !c.mount)), mountLegs: shown(all.filter(c => c.mount)) };
  const common = list => list.length ? list.map(c => tree.ancestors(c.root, true)).reduce((a, b) => a.filter(x => b.includes(x)))[0] ?? null : null;
  rig.mount = common(rig.chains.mountLegs);
  // The rider: the topmost joint above its arms that is not part of the mount's own chain.
  const armsTop = rig.mount != null ? common(rig.chains.arms) : null, mountLine = rig.mount != null ? new Set(tree.ancestors(rig.mount, true)) : new Set();
  rig.rider = armsTop != null ? tree.ancestors(armsTop, true).filter(id => !mountLine.has(id)).at(-1) ?? null : null;
  rig.body = found.body;
  rig.roles = found.roles || {};
  // What each hand holds: the farthest skinned point below the hand is the weapon's tip.
  rig.held = rig.chains.arms.map(c => {
    const hand = c.joints.at(-1), origin = v3(rig.pivot(hand));
    let best = null;
    (model.Geosets || []).forEach((geoset, gi) => rig.skin[gi].forEach((weights, v) => {
      if (!weights.some(([b]) => tree.isAncestor(b, hand))) return;
      const p = new Vector3().fromArray(geoset.Vertices, v * 3), d = p.distanceTo(origin);
      if (!best || d > best.d) best = { d, p: p.toArray(), bone: weights.reduce((a, b) => b[1] > a[1] ? b : a)[0] };
    }));
    const objects = nodes.filter(n => tree.isAncestor(n.ObjectId, hand) && n.ObjectId !== hand && ['weapon', 'shield'].includes(labels.get(n.ObjectId))).map(n => n.ObjectId);
    return { hand, chain: c.name, tip: best?.p || null, tipBone: best?.bone ?? hand, objects, kind: objects.some(id => labels.get(id) === 'shield') ? 'shield' : objects.length ? 'weapon' : 'hand' };
  });
  return rig;
}

// ---- dense clips ----------------------------------------------------------------------------------

// Shape-preserving cubic slopes through (x, y) (no overshoot; ends hold still unless the clip loops).
function pchipSlopes(x, y, loop) {
  const n = x.length, m = new Array(n).fill(0);
  if (n < 2) return m;
  const h = [], d = [];
  for (let i = 0; i < n - 1; i++) { h.push(x[i + 1] - x[i]); d.push((y[i + 1] - y[i]) / (h[i] || 1)); }
  const mix = (d0, d1, h0, h1) => d0 * d1 <= 0 ? 0 : (3 * h0 + 3 * h1) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1);
  for (let i = 1; i < n - 1; i++) m[i] = mix(d[i - 1], d[i], h[i - 1], h[i]);
  if (loop && n > 2) m[0] = m[n - 1] = mix(d[n - 2], d[0], h[n - 2], h[0]);
  return m;
}
function hermiteAt(x, y, m, t) {
  if (t <= x[0]) return y[0];
  if (t >= x[x.length - 1]) return y[y.length - 1];
  let i = 0;
  while (i < x.length - 2 && t > x[i + 1]) i++;
  const h = x[i + 1] - x[i], u = (t - x[i]) / h, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * y[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * y[i + 1] + (u3 - u2) * h * m[i + 1];
}
function linearAt(x, y, t) {
  if (t <= x[0]) return y[0];
  if (t >= x[x.length - 1]) return y[y.length - 1];
  let i = 0;
  while (i < x.length - 2 && t > x[i + 1]) i++;
  return y[i] + (y[i + 1] - y[i]) * (t - x[i]) / ((x[i + 1] - x[i]) || 1);
}
// Piecewise-linear time map from [[sourceMs, outputMs], ...]: output time -> source time.
function timeMap(points) {
  const p = points.map(([a, b]) => [Number(a), Number(b)]).sort((a, b) => a[1] - b[1]);
  if (p.length < 2 || p.some(([a, b], i) => !Number.isFinite(a) || !Number.isFinite(b) || i && (a <= p[i - 1][0] || b <= p[i - 1][1]))) throw Error('timing: give increasing [sourceMs, outputMs] pairs.');
  return { toSource: t => linearAt(p.map(x => x[1]), p.map(x => x[0]), t), toOutput: s => linearAt(p.map(x => x[0]), p.map(x => x[1]), s), length: p.at(-1)[1] };
}

/** Animate key poses into a dense clip in memory (about every 5 ms), not yet written. Options: sequence (name
 * or index; created on write if missing), length, loop, keys [{ ms, pose }], each(ms, pose, outMs) for per-step
 * constraints (plant feet, keep a hand on the weapon), smooth { ms, holds: [[from, to]] } (blur after each;
 * holds stay sharp), follow [{ chain, frequency, damping, maxDeg, share }] for lagging parts, easeBack,
 * timing [[sourceMs, outputMs], ...], offsets { bone: ms }, interp 'smooth'|'linear', template (sequence
 * whose geoset visibility a new clip copies). Returns a result with check(), write(), pose(ms). */
export function animate(rig, options = {}) {
  const { keys = [], each, follow = [], offsets = {}, interp = 'smooth', step = 5 } = options;
  if (!keys.length) throw Error('animate needs keys: [{ ms, pose }].');
  if (!(step >= 1 && step <= 50)) throw Error('step is 1 to 50 ms.');
  const sequence = options.sequence ?? 'New animation', index = rig.sequence(sequence);
  if (index < 0 && typeof sequence !== 'string') throw Error('A new animation needs a name: sequence: "Attack - 3".');
  const existing = index >= 0 ? rig.model.Sequences[index] : null;
  const loop = options.loop ?? (existing ? !existing.NonLooping : false);
  const sorted = [...keys].map(k => ({ ms: Number(k.ms), pose: k.pose })).sort((a, b) => a.ms - b.ms)
    .filter((k, i, list) => i === list.length - 1 || list[i + 1].ms !== k.ms);
  if (sorted.some(k => !Number.isFinite(k.ms) || !(k.pose instanceof Pose))) throw Error('Each key needs ms and a pose from rig.rest(), rig.pose() or a copy.');
  const timing = options.timing ? timeMap(options.timing) : null;
  const sourceLength = existing && !timing ? existing.Interval[1] - existing.Interval[0] : Math.max(...sorted.map(k => k.ms));
  const length = Math.round(options.length ?? (timing ? timing.length : sourceLength));
  if (!(length >= step)) throw Error('The clip needs a length of at least one step.');
  const times = [];
  for (let t = 0; t < length; t += step) times.push(t);
  times.push(length);
  const N = times.length, ids = rig.ids;
  const T = new Map(), R = new Map(), S = new Map();
  for (const id of ids) { T.set(id, new Float64Array(N * 3)); R.set(id, new Float64Array(N * 4)); S.set(id, new Float64Array(N * 3)); }
  const source = times.map(t => timing ? timing.toSource(t) : t);
  // Keys -> dense: a shape-preserving cubic through the key poses per channel (no overshoot).
  const keyMs = sorted.map(k => k.ms);
  for (const id of ids) {
    const off = offsets[id] ?? offsets[rig.name(id)] ?? 0;
    const xs = keyMs.map((ms, i) => i === 0 || i === keyMs.length - 1 ? ms : clamp(ms + off, keyMs[0] + 1, keyMs.at(-1) - 1));
    for (const [prop, store, dim] of [['t', T.get(id), 3], ['r', R.get(id), 4], ['s', S.get(id), 3]]) {
      const values = sorted.map(k => [...k.pose.values.get(id)[prop]]);
      if (prop === 'r') for (let i = 0; i < values.length; i++) {
        const q = values[i], n = Math.hypot(...q) || 1;
        for (let c = 0; c < 4; c++) q[c] /= n;
        if (i && q.reduce((a, x, c) => a + x * values[i - 1][c], 0) < 0) for (let c = 0; c < 4; c++) q[c] = -q[c];
      }
      const constant = values.every(v => v.every((x, c) => Math.abs(x - values[0][c]) < 1e-9));
      for (let c = 0; c < dim; c++) {
        const ys = values.map(v => v[c]), m = constant || interp === 'linear' ? null : pchipSlopes(xs, ys, loop);
        for (let n = 0; n < N; n++) store[n * dim + c] = constant ? ys[0] : m ? hermiteAt(xs, ys, m, source[n]) : linearAt(xs, ys, source[n]);
      }
      if (prop === 'r') for (let n = 0; n < N; n++) {
        const l = Math.hypot(store[n * 4], store[n * 4 + 1], store[n * 4 + 2], store[n * 4 + 3]) || 1;
        for (let c = 0; c < 4; c++) store[n * 4 + c] /= l;
      }
    }
  }
  const result = new AnimResult(rig, { sequence, index, loop, length, step, times, T, R, S, template: options.template, moveSpeed: options.moveSpeed });
  // Per-step constraints.
  const changed = new Set();
  if (each) for (let n = 0; n < N; n++) {
    const pose = result.poseAt(n), before = result.poseAt(n);
    each(source[n], pose, times[n]);
    for (const id of ids) {
      const a = pose.values.get(id), b = before.values.get(id);
      if (a.t.some((x, i) => x !== b.t[i]) || a.r.some((x, i) => x !== b.r[i]) || a.s.some((x, i) => x !== b.s[i])) changed.add(id);
    }
    result.put(n, pose);
  }
  // Blur the last kinks out of per-step solves; impacts in holds stay sharp.
  const smooth = options.smooth === undefined ? (each ? { ms: 12 } : null) : options.smooth === true ? { ms: 12 } : options.smooth || null;
  if (smooth?.ms > 0) {
    const bones = smooth.bones ? smooth.bones.map(b => rig.find(b)) : [...changed];
    const sigma = smooth.ms / step, k = Math.max(1, Math.ceil(3 * sigma)), w = [];
    for (let i = -k; i <= k; i++) w.push(Math.exp(-0.5 * (i / sigma) ** 2));
    const holds = (smooth.holds || []).map(([a, b]) => [Math.ceil(a / step), Math.floor(b / step)]);
    for (const id of bones) for (const [store, dim] of [[R.get(id), 4], [T.get(id), 3]]) {
      const out = store.slice();
      for (let n = 1; n < N - 1; n++) {
        const hold = holds.find(([a, b]) => n >= a && n <= b);
        if (hold) continue;
        const before = holds.find(([a]) => a > n), after = [...holds].reverse().find(([, b]) => b < n);
        const acc = new Array(dim).fill(0);
        let sum = 0;
        for (let j = -k; j <= k; j++) {
          let at = n + j;
          if (loop) at = ((at % (N - 1)) + (N - 1)) % (N - 1); else at = clamp(at, 0, N - 1);
          if (before && at >= before[0]) at = before[0];
          if (after && at <= after[1]) at = after[1];
          const sign = dim === 4 && (store[at * 4] * store[n * 4] + store[at * 4 + 1] * store[n * 4 + 1] + store[at * 4 + 2] * store[n * 4 + 2] + store[at * 4 + 3] * store[n * 4 + 3]) < 0 ? -1 : 1;
          for (let c = 0; c < dim; c++) acc[c] += w[j + k] * sign * store[at * dim + c];
          sum += w[j + k];
        }
        const len = dim === 4 ? Math.hypot(...acc) || 1 : sum;
        for (let c = 0; c < dim; c++) out[n * dim + c] = acc[c] / len;
      }
      store.set(out);
    }
  }
  // Follow-through: each chain bone's long axis is a damped spring toward its authored direction.
  const authored = new Map();
  for (const spec of follow) {
    const chain = (Array.isArray(spec.chain) ? spec.chain : [spec.chain]).map(b => rig.find(b));
    for (const id of chain) if (!authored.has(id)) authored.set(id, R.get(id).slice());
    followChain(result, chain, spec);
  }
  const easeBack = options.easeBack ?? !loop;
  if (easeBack && authored.size) {
    const share = typeof easeBack === 'number' ? easeBack : 0.2, k = Math.max(2, Math.round(N * share));
    for (const [id, q0] of authored) {
      const store = R.get(id);
      for (let n = N - k; n < N; n++) {
        let u = (n - (N - k)) / (k - 1); u = u * u * (3 - 2 * u);
        const a = new Quaternion().fromArray(store, n * 4), b = new Quaternion().fromArray(q0, n * 4);
        a.slerp(b, u).toArray(store, n * 4);
      }
    }
  }
  return result;
}

function followChain(result, chain, { frequency = 2.5, damping = 0.5, maxDeg = 30, share = 1, inertia = 1, end, cycles = 3 } = {}) {
  const { rig, N, step, R } = result, dt = step / 1000;
  const top = chain[0], parentId = rig.tree.parentOf(top);
  const axisOf = (id, i) => {
    const pivot = v3(rig.pivot(id)), next = chain[i + 1];
    const tip = i === chain.length - 1 && end ? v3(end) : next != null ? v3(rig.pivot(next)) : (() => {
      const child = rig.nodes.find(n => n.parent === id);
      if (child) return v3(child.pivot);
      let best = null;
      (rig.model.Geosets || []).forEach((g, gi) => rig.skin[gi].forEach((w, v) => {
        if (!w.some(([b]) => rig.tree.isAncestor(b, id))) return;
        const p = new Vector3().fromArray(g.Vertices, v * 3);
        if (!best || p.distanceTo(pivot) > best.distanceTo(pivot)) best = p;
      }));
      return best || pivot.clone().add(new Vector3(0, 0, -10));
    })();
    const axis = tip.clone().sub(pivot);
    return { axis: axis.lengthSq() > 1e-12 ? axis.normalize() : new Vector3(0, 0, -1), length: Math.max(axis.length(), 1) * 0.6 };
  };
  const specs = chain.map((id, i) => ({ id, ...axisOf(id, i) }));
  const out = new Map(chain.map(id => [id, R.get(id).slice()]));
  const still = new Map();
  {
    const pose = result.poseAt(0);
    for (const id of chain) still.set(id, pose.worldRotation(id));
  }
  const state = new Map(), w = 2 * Math.PI * frequency, passes = result.loop ? cycles : 1;
  for (let pass = 0; pass < passes; pass++) for (let n = 0; n < N; n++) {
    const pose = result.poseAt(n);
    let parent = parentId != null ? pose.matrix(parentId).clone() : new Matrix4();
    for (const spec of specs) {
      const node = rig.byId.get(spec.id), v = pose.values.get(spec.id), pivot = v3(rig.pivot(spec.id));
      const local = new Matrix4().compose(new Vector3().fromArray(v.t), new Quaternion().fromArray(v.r).normalize(), new Vector3().fromArray(v.s));
      local.setPosition(new Vector3().fromArray(v.t).add(pivot).sub(pivot.clone().applyMatrix4(local).sub(new Vector3().fromArray(v.t))));
      const effective = inheritedParentMatrix(parent, node.Flags), world = effective.clone().multiply(local);
      let qa = rotationOf(world);
      if (share !== 1) qa = still.get(spec.id).clone().slerp(qa, share);
      const at = pivot.clone().applyMatrix4(world), da = spec.axis.clone().applyQuaternion(qa);
      let s = state.get(spec.id);
      if (!s) { s = { d: da.clone(), v: new Vector3(), p1: at.clone(), p2: at.clone(), a: new Vector3() }; state.set(spec.id, s); }
      const acc = at.clone().sub(s.p1.clone().multiplyScalar(2)).add(s.p2).divideScalar(dt * dt);
      s.a.add(acc.sub(s.a).multiplyScalar(Math.min(1, dt / 0.05))); s.p2.copy(s.p1); s.p1.copy(at);
      const force = da.clone().sub(s.d).multiplyScalar(w * w).sub(s.v.clone().multiplyScalar(2 * damping * w)).sub(s.a.clone().multiplyScalar(inertia / spec.length));
      force.addScaledVector(s.d, -force.dot(s.d));
      s.v.addScaledVector(force, dt); s.v.addScaledVector(s.d, -s.v.dot(s.d));
      const d = s.d.clone().addScaledVector(s.v, dt).normalize();
      const angle = Math.acos(clamp(d.dot(da), -1, 1)) / DEG;
      if (maxDeg != null && angle > maxDeg) { d.copy(da).applyQuaternion(new Quaternion().setFromAxisAngle(da.clone().cross(d).normalize(), maxDeg * DEG)); s.v.multiplyScalar(0.5); }
      s.d.copy(d);
      const q = arc(da, d).multiply(qa), localQ = rotationOf(effective).invert().multiply(q).normalize();
      if (pass === passes - 1) localQ.toArray(out.get(spec.id), n * 4);
      v.r = localQ.toArray(); pose.changed();
      const next = new Matrix4().compose(new Vector3().fromArray(v.t), localQ, new Vector3().fromArray(v.s));
      next.setPosition(new Vector3().fromArray(v.t).add(pivot).sub(pivot.clone().applyMatrix4(next).sub(new Vector3().fromArray(v.t))));
      parent = effective.clone().multiply(next);
    }
  }
  for (const [id, store] of out) {
    for (let n = 1; n < N; n++) {
      const dot = store[n * 4] * store[n * 4 - 4] + store[n * 4 + 1] * store[n * 4 - 3] + store[n * 4 + 2] * store[n * 4 - 2] + store[n * 4 + 3] * store[n * 4 - 1];
      if (dot < 0) for (let c = 0; c < 4; c++) store[n * 4 + c] = -store[n * 4 + c];
    }
    R.get(id).set(store);
  }
}

class AnimResult {
  constructor(rig, data) {
    Object.assign(this, data);
    this.rig = rig; this.N = data.times.length;
    this.name = typeof data.sequence === 'string' ? data.sequence : rig.model.Sequences[data.index]?.Name;
  }
  poseAt(n) {
    const values = new Map();
    for (const id of this.rig.ids) {
      const t = this.T.get(id), r = this.R.get(id), s = this.S.get(id);
      values.set(id, { t: [t[n * 3], t[n * 3 + 1], t[n * 3 + 2]], r: [r[n * 4], r[n * 4 + 1], r[n * 4 + 2], r[n * 4 + 3]], s: [s[n * 3], s[n * 3 + 1], s[n * 3 + 2]] });
    }
    return new Pose(this.rig, values);
  }
  put(n, pose) {
    for (const id of this.rig.ids) {
      const v = pose.values.get(id);
      this.T.get(id).set(v.t, n * 3); this.R.get(id).set(new Quaternion().fromArray(v.r).normalize().toArray(), n * 4); this.S.get(id).set(v.s, n * 3);
    }
  }
  sampleIndex(ms) { return ms >= this.length ? this.N - 1 : clamp(Math.round(ms / this.step), 0, this.N - 1); }
  /** The clip's pose at ms (nearest sample). */
  pose(ms) { return this.poseAt(this.sampleIndex(ms)); }
  matricesAt(n, cache) {
    if (cache?.has(n)) return cache.get(n);
    const m = this.poseAt(n).matrices();
    cache?.set(n, m);
    return m;
  }

  /** Numbers for the clip: jitter (small fast back-and-forth), clipping by body part minus what already overlaps
   * in the stand pose (clipping: true or { step }), planted-foot slide, loop seam, joint bends, estimated bytes. */
  check({ clipping = false, step = 5, jitter = true, feet = true, seam = true, bends = true, bytes = true, tolerance } = {}) {
    const out = { sequence: this.name, length: this.length, loop: this.loop };
    const cache = new Map(), rig = this.rig, model = rig.model;
    const markers = this.markers();
    const paths = markers.map(() => new Float64Array(this.N * 3));
    for (let n = 0; n < this.N; n++) {
      const m = this.matricesAt(n, cache);
      markers.forEach((mk, i) => { const p = v3(mk.point).applyMatrix4(m.get(mk.bone) || new Matrix4()); paths[i].set([p.x, p.y, p.z], n * 3); });
    }
    if (jitter) {
      const rows = [];
      let total = 0;
      markers.forEach((mk, i) => {
        const events = wobble(paths[i], this.N, this.step), sum = events.reduce((a, e) => a + e[1], 0);
        total += sum;
        if (events.length) rows.push([mk.name, round(sum), events.length, round(Math.max(...events.map(e => e[1]))), [...new Set(events.map(e => Math.round(e[0] / 50) * 50))].slice(0, 10)]);
      });
      rows.sort((a, b) => b[1] - a[1]);
      out.jitter = { total: round(total), columns: ['marker', 'sum', 'count', 'worst', 'atMs'], rows: rows.slice(0, 12) };
    }
    if (feet) {
      const legs = [...rig.chains.legs, ...rig.chains.mountLegs], ends = legs.map(c => c.joints.at(-1));
      const z = ends.map(id => { const i = markers.findIndex(mk => mk.bone === id && mk.pivot); return i < 0 ? null : paths[i]; });
      const ground = Math.min(...z.filter(Boolean).flatMap(p => Array.from({ length: this.N }, (_, n) => p[n * 3 + 2])));
      out.feet = legs.flatMap((c, li) => {
        const p = z[li];
        if (!p) return [];
        const low = Math.min(...Array.from({ length: this.N }, (_, n) => p[n * 3 + 2]));
        if (low > ground + Math.max(4, Math.abs(ground) * 0.1)) return [];
        let slide = 0, planted = 0, anchor = null;
        for (let n = 0; n < this.N; n++) {
          const x = p[n * 3] + (this.moveSpeed || 0) * this.times[n] / 1000, y = p[n * 3 + 1];
          if (p[n * 3 + 2] <= low + 1) { planted++; if (!anchor) anchor = [x, y]; slide = Math.max(slide, Math.hypot(x - anchor[0], y - anchor[1])); }
          else anchor = null;
        }
        return [{ foot: c.name, planted: round(planted / this.N), slide: round(slide) }];
      });
    }
    if (seam && this.loop) {
      let position = 0, velocity = 0;
      const last = this.N - 1;
      for (const p of paths) {
        position = Math.max(position, Math.hypot(p[0] - p[last * 3], p[1] - p[last * 3 + 1], p[2] - p[last * 3 + 2]));
        const v0 = [0, 1, 2].map(c => p[3 + c] - p[c]), v1 = [0, 1, 2].map(c => p[last * 3 + c] - p[(last - 1) * 3 + c]);
        velocity = Math.max(velocity, Math.hypot(...v0.map((x, c) => x - v1[c])) / (this.step / 1000));
      }
      out.seam = { position: round(position), velocityJump: round(velocity, 1) };
    }
    if (bends) {
      const stand = rig.reference >= 0 ? rig.pose(rig.reference, 0) : rig.rest();
      out.bends = rig.chains.all.filter(c => !c.label).map(c => {
        const [a, b, e] = [c.joints[0], c.joints[1], c.joints.at(-1)];
        const normal = pose => { const pa = pose.point(a), pb = pose.point(b), pe = pose.point(e); return pb.clone().sub(pa).cross(pe.clone().sub(pb)); };
        const restNormal = normal(stand);
        let min = 180, max = 0, flipped = null;
        for (let n = 0; n < this.N; n += 2) {
          const pose = this.poseAt(n), pa = pose.point(a), pb = pose.point(b), pe = pose.point(e);
          const bend = Math.acos(clamp(pb.clone().sub(pa).normalize().dot(pe.clone().sub(pb).normalize()), -1, 1)) / DEG;
          min = Math.min(min, bend); max = Math.max(max, bend);
          if (flipped == null && bend > 10 && restNormal.lengthSq() > 1e-6 && normal(pose).dot(restNormal) < 0) flipped = this.times[n];
        }
        return { chain: c.name, minDeg: round(min, 0), maxDeg: round(max, 0), bentBackwardAtMs: flipped, overFolded: max > 160 };
      });
    }
    if (clipping) {
      const every = typeof clipping === 'object' && clipping.step ? clipping.step : step;
      out.clipping = this.clipping(every);
    }
    if (bytes) { const fit = this.fit(model, { tolerance }); out.bytes = { estimated: fit.bytes, keys: fit.keys, tracks: fit.tracks, keysPerTrack: fit.keysPerTrack, largestVertexError: fit.maxError }; }
    return out;
  }
  markers() {
    const rig = this.rig, list = [], seen = new Set();
    const add = (bone, point, name, pivot = false) => { const key = bone + ':' + point.join(','); if (seen.has(key)) return; seen.add(key); list.push({ bone, point, name, pivot }); };
    for (const c of rig.chains.all) for (const id of c.joints) add(id, rig.pivot(id), rig.name(id), true);
    for (const h of rig.held) if (h.tip) add(h.tipBone, h.tip, 'tip of ' + rig.name(h.hand));
    for (const id of rig.ids) if (rig.byId.get(id).Parent == null || /head/i.test(rig.name(id))) add(id, rig.pivot(id), rig.name(id), true);
    return list;
  }
  clipping(every = 5) {
    const rig = this.rig, model = rig.model, found = automaticParts(model);
    if (!found.pairs.length) return { pairs: [], note: 'No two rig parts to compare.' };
    const visible = this.visibility(), buffers = new Map();
    const standSeq = rig.reference, standMatrices = standSeq >= 0 ? rig.pose(standSeq, 0).matrices() : rig.rest().matrices();
    const standVisible = gi => standSeq < 0 || sampleGeosetAnimation(model, gi, model.Sequences[standSeq].Interval[0], standSeq).alpha >= .01;
    const pairs = found.pairs.map(([a, b]) => ({ a, b, rest: poseCrossings(model, found.parts[a], found.parts[b], standMatrices, standVisible, buffers), worst: 0, worstMs: null, framesHit: 0 }));
    for (let t = 0; t <= this.length; t = t + every > this.length && t < this.length ? this.length : t + every) {
      const n = this.sampleIndex(t), matrices = this.matricesAt(n);
      for (const pair of pairs) {
        const count = Math.max(0, poseCrossings(model, found.parts[pair.a], found.parts[pair.b], matrices, gi => visible(gi, this.times[n]), buffers) - pair.rest);
        if (count > 0) pair.framesHit++;
        if (count > pair.worst) { pair.worst = count; pair.worstMs = this.times[n]; }
      }
      if (t >= this.length) break;
    }
    return { columns: ['a', 'b', 'rest', 'worst', 'worstMs', 'framesHit'], rows: pairs.map(p => [p.a, p.b, p.rest, p.worst, p.worstMs, p.framesHit]), total: pairs.reduce((s, p) => s + p.worst, 0) };
  }
  // Which geosets show at a clip time: the clip's own visibility when it exists, else the template's.
  visibility(model = this.rig.model) {
    const index = model === this.rig.model ? this.index : this.rig.sequence(this.name);
    const seq = index >= 0 ? index : this.templateIndex(model);
    if (seq < 0) return () => true;
    const [start, end] = model.Sequences[seq].Interval;
    return (gi, ms) => sampleGeosetAnimation(model, gi, clamp(start + ms, start, end), seq).alpha >= .01;
  }
  templateIndex(model = this.rig.model) {
    if (this.template != null) { const i = Number.isInteger(this.template) ? this.template : (model.Sequences || []).findIndex(s => String(s.Name).toLowerCase() === String(this.template).toLowerCase()); if (i >= 0) return i; }
    return referenceSequence(model);
  }

  // Where the clip goes in `model` and which channels it changes there.
  plan(model) {
    const index = (model.Sequences || []).findIndex(s => String(s.Name || '').trim().toLowerCase() === String(this.name || '').trim().toLowerCase());
    const existing = index >= 0 ? model.Sequences[index] : null, oldInterval = existing ? Array.from(existing.Interval) : null;
    let start, relocate = false;
    if (existing && oldInterval[1] - oldInterval[0] === this.length) start = oldInterval[0];
    else if (existing) {
      const next = Math.min(Infinity, ...model.Sequences.filter(s => s !== existing && s.Interval[0] > oldInterval[0]).map(s => s.Interval[0]));
      if (oldInterval[0] + this.length < next) start = oldInterval[0]; else { start = Math.max(0, ...model.Sequences.map(s => s.Interval[1])) + 1000; relocate = true; }
    } else start = Math.max(0, ...(model.Sequences || []).map(s => s.Interval[1])) + 1000;
    const end = start + this.length, sameTiming = existing && oldInterval[0] === start && oldInterval[1] === end;
    const byId = new Map(allNodes(model).map(n => [n.ObjectId, n])), props = [], skipped = [], clear = [];
    for (const id of this.rig.ids) {
      const node = byId.get(id);
      if (!node) continue;
      for (const prop of PROPS) {
        const dim = DIM[prop], store = prop === 'Translation' ? this.T.get(id) : prop === 'Rotation' ? this.R.get(id) : this.S.get(id), track = node[prop];
        const keyed = track?.Keys, global = keyed && Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId >= 0 && model.GlobalSequences?.[track.GlobalSeqId] > 0;
        const plays = n => {
          if (sameTiming) return sampleNodeProperty(model, node, prop, start + this.times[n], index);
          if (global) return sampleNodeProperty(model, node, prop, start + this.times[n], index);
          if (track && !keyed) return Array.from(track);
          return [...TRANSFORM_DEFAULTS[prop]];
        };
        let differs = false;
        for (let n = 0; n < this.N && !differs; n++) {
          const now = plays(n), want = Array.from(store.subarray(n * dim, n * dim + dim));
          differs = prop === 'Rotation' ? angleBetween(now, want) > 1e-4 : want.some((x, c) => Math.abs(x - now[c]) > 1e-4);
        }
        const stale = keyed && !global && !sameTiming && existing && track.Keys.some(k => k.Frame >= oldInterval[0] && k.Frame <= oldInterval[1]);
        if (global) { if (differs) skipped.push({ id, name: node.Name, prop, why: 'global sequence track' }); continue; }
        if (differs && track && !keyed && Array.from(track).some((x, c) => x !== TRANSFORM_DEFAULTS[prop][c])) { skipped.push({ id, name: node.Name, prop, why: 'static value; keys would change other animations' }); continue; }
        if (differs) props.push({ id, node, prop, dim, store, lineType: keyed ? track.LineType : null });
        else if (stale) clear.push({ node, prop });
      }
    }
    return { index, existing, oldInterval, start, end, relocate, sameTiming, props, skipped, clear };
  }

  /** Fit few strong keys to the clip without changing the model: { keys, tracks, bytes, maxError, ... }. */
  fit(model = this.rig.model, { tolerance = 0.5, curve = 'hermite', plan = this.plan(model) } = {}) {
    if (!(tolerance > 0)) throw Error('tolerance is a positive distance in model units.');
    const { start, end, props } = plan, N = this.N, rig = this.rig, times = this.times;
    const lineTypeOf = p => p.lineType ?? (curve === 'linear' ? 1 : 2);
    // Error points: skinned vertices of shown geosets and pivots of nodes below the changed channels.
    const changedIds = new Set(props.map(p => p.id)), underCache = new Map();
    const under = id => { if (!underCache.has(id)) underCache.set(id, rig.tree.ancestors(id, true).some(a => changedIds.has(a))); return underCache.get(id); };
    const shown = this.visibility(model), seqShown = gi => times.some((t, n) => n % 10 === 0 && shown(gi, t));
    const points = [];
    (model.Geosets || []).forEach((geoset, gi) => {
      if (!seqShown(gi)) return;
      rig.skin[gi]?.forEach((weights, v) => { if (weights.length && weights.some(([b]) => under(b))) points.push({ p: Array.from(geoset.Vertices.subarray(v * 3, v * 3 + 3)), weights }); });
    });
    for (const id of rig.ids) if (under(id)) points.push({ p: rig.pivot(id), weights: [[id, 1]] });
    const P = points.length;
    const skin = (matrices, out) => {
      for (let i = 0; i < P; i++) {
        const { p, weights } = points[i];
        let x = 0, y = 0, z = 0, total = 0;
        for (const [b, w] of weights) {
          const e = matrices.get(b)?.elements;
          x += (e ? e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12] : p[0]) * w; y += (e ? e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13] : p[1]) * w; z += (e ? e[2] * p[0] + e[6] * p[1] + e[10] * p[2] + e[14] : p[2]) * w;
          total += w;
        }
        out[i * 3] = x / total; out[i * 3 + 1] = y / total; out[i * 3 + 2] = z / total;
      }
      return out;
    };
    const dense = [], densePivots = [];
    for (let n = 0; n < N; n++) {
      const m = this.matricesAt(n);
      dense.push(skin(m, new Float64Array(P * 3)));
      densePivots.push(new Map(props.map(p => [p.id, v3(rig.pivot(p.id)).applyMatrix4(m.get(p.id))])));
    }
    // Approximate tracks: dense values at key samples; Hermite tangents from the clip's own one-sided slopes.
    const keySets = props.map(() => new Set([0, N - 1]));
    const valueAt = (p, n) => Array.from(p.store.subarray(n * p.dim, n * p.dim + p.dim));
    const build = (p, set) => {
      const lineType = lineTypeOf(p), ks = [...set].sort((a, b) => a - b), rotation = p.prop === 'Rotation', keys = [];
      let prev = null;
      const values = ks.map(n => { const v = valueAt(p, n); if (rotation) { if (prev && v.reduce((a, x, c) => a + x * prev[c], 0) < 0) v.forEach((x, c) => { v[c] = -x; }); prev = v; } return v; });
      ks.forEach((n, i) => {
        const key = { Frame: start + times[n], Vector: new Float32Array(values[i]) };
        if (lineType >= 2) {
          const dIn = i ? times[n] - times[ks[i - 1]] : 0, dOut = i < ks.length - 1 ? times[ks[i + 1]] - times[n] : 0;
          const left = n > 0 ? n - 1 : n, right = n < N - 1 ? n + 1 : n;
          if (rotation) {
            const q = new Quaternion().fromArray(values[i]), inv = q.clone().invert();
            const rate = (a, b) => { if (a === b) return new Vector3(); const qa = new Quaternion().fromArray(valueAt(p, a)), qb = new Quaternion().fromArray(valueAt(p, b)); return logQ(qa.invert().multiply(qb)).divideScalar(times[b] - times[a]); };
            const wOut = right !== n ? rate(n, right) : rate(left, n), wIn = left !== n ? rate(left, n) : rate(n, right);
            const chordOut = i < ks.length - 1 ? logQ(inv.clone().multiply(new Quaternion().fromArray(values[i + 1]))) : new Vector3();
            const chordIn = i ? logQ(inv.clone().multiply(new Quaternion().fromArray(values[i - 1]))) : new Vector3();
            const out = i < ks.length - 1 ? q.clone().multiply(expQ(wOut.multiplyScalar(dOut).sub(chordOut).multiplyScalar(0.5))) : q.clone();
            const inn = i ? q.clone().multiply(expQ(chordIn.negate().sub(wIn.multiplyScalar(dIn)).multiplyScalar(0.5))) : q.clone();
            key.OutTan = new Float32Array(out.normalize().toArray()); key.InTan = new Float32Array(inn.normalize().toArray());
          } else {
            const slope = (a, b) => a === b ? null : valueAt(p, b).map((x, c) => (x - valueAt(p, a)[c]) / (times[b] - times[a]));
            const mOut = slope(n, right) || slope(left, n), mIn = slope(left, n) || slope(n, right);
            if (lineType === 3) { key.OutTan = new Float32Array(values[i].map((x, c) => x + mOut[c] * dOut / 3)); key.InTan = new Float32Array(values[i].map((x, c) => x - mIn[c] * dIn / 3)); }
            else { key.OutTan = new Float32Array(mOut.map(x => x * dOut)); key.InTan = new Float32Array(mIn.map(x => x * dIn)); }
          }
        }
        keys.push(key);
      });
      return { LineType: lineType, Keys: keys };
    };
    const tracks = props.map((p, i) => build(p, keySets[i]));
    const approxValue = (pi, n) => Array.from(sampleTrack(tracks[pi], start + times[n], { interval: [start, end], fallback: TRANSFORM_DEFAULTS[props[pi].prop], quaternion: props[pi].prop === 'Rotation' }));
    const byNode = new Map();
    props.forEach((p, i) => { if (!byNode.has(p.id)) byNode.set(p.id, []); byNode.get(p.id).push(i); });
    const approxMatrices = n => {
      const pose = this.poseAt(n);
      for (const [id, list] of byNode) {
        const v = pose.values.get(id);
        for (const i of list) { const value = approxValue(i, n); if (props[i].prop === 'Translation') v.t = value; else if (props[i].prop === 'Rotation') v.r = value; else v.s = value; }
      }
      return pose.matrices();
    };
    const errors = new Float64Array(N), worstPoint = new Int32Array(N), buffer = new Float64Array(P * 3);
    const measure = n => {
      const approx = skin(approxMatrices(n), buffer), d = dense[n];
      let worst = 0, at = -1;
      for (let i = 0; i < P; i++) { const e = Math.hypot(approx[i * 3] - d[i * 3], approx[i * 3 + 1] - d[i * 3 + 1], approx[i * 3 + 2] - d[i * 3 + 2]); if (e > worst) { worst = e; at = i; } }
      errors[n] = worst; worstPoint[n] = at;
    };
    for (let n = 0; n < N; n++) measure(n);
    const limit = tolerance * 0.98;
    for (let round_ = 0; round_ < 400; round_++) {
      const order = [...errors.keys()].filter(n => errors[n] > limit).sort((a, b) => errors[b] - errors[a]);
      if (!order.length) break;
      const picked = [];
      for (const n of order) { if (picked.every(m => Math.abs(m - n) >= 4)) picked.push(n); if (picked.length >= 6) break; }
      const dirty = new Set();
      for (const n of picked) {
        const point = points[worstPoint[n]], at = v3(dense[n].subarray(worstPoint[n] * 3, worstPoint[n] * 3 + 3));
        // The channel above this point whose own curve is furthest off here (turn error times reach).
        let best = -1, bestCost = -1;
        props.forEach((p, i) => {
          if (keySets[i].has(n) || !point.weights.some(([b]) => rig.tree.isAncestor(b, p.id))) return;
          const want = valueAt(p, n), have = approxValue(i, n);
          const reach = densePivots[n].get(p.id).distanceTo(at);
          const cost = p.prop === 'Rotation' ? angleBetween(want, have) * reach : p.prop === 'Scaling' ? Math.max(...want.map((x, c) => Math.abs(x - have[c]))) * reach : Math.hypot(...want.map((x, c) => x - have[c]));
          if (cost > bestCost) { bestCost = cost; best = i; }
        });
        if (best < 0) continue;
        const set = keySets[best], sortedKeys = [...set].sort((a, b) => a - b);
        const lo = [...sortedKeys].reverse().find(k => k < n) ?? 0, hi = sortedKeys.find(k => k > n) ?? N - 1;
        // A Hermite key also reshapes the next segments out; mark them dirty too.
        const lo2 = [...sortedKeys].reverse().find(k => k < lo) ?? lo, hi2 = sortedKeys.find(k => k > hi) ?? hi;
        set.add(n); tracks[best] = build(props[best], set);
        for (let m = lo2; m <= hi2; m++) dirty.add(m);
      }
      if (!dirty.size) break;
      for (const n of dirty) measure(n);
    }
    const keyCount = tracks.reduce((s, t) => s + t.Keys.length, 0), perTrack = tracks.map(t => t.Keys.length).sort((a, b) => a - b);
    const bytes = tracks.reduce((s, t, i) => s + t.Keys.length * (4 + 4 * props[i].dim * (t.LineType >= 2 ? 3 : 1)) + (props[i].lineType == null ? 16 : 0), 0);
    const gaps = tracks.flatMap(t => t.Keys.slice(1).map((k, i) => k.Frame - t.Keys[i].Frame)).sort((a, b) => a - b);
    return { props, trackList: tracks, keys: keyCount, tracks: tracks.length, bytes, maxError: round(Math.max(0, ...errors), 3), keysPerTrack: perTrack.length ? perTrack[perTrack.length >> 1] : 0, spacingMs: gaps.length ? gaps[gaps.length >> 1] : 0 };
  }

  /** Write ONLY this clip's keys on the channels it changes into model (the sequence is replaced in place or
   * created after the last one), with few strong keys: no skinned vertex moves more than `tolerance` units from
   * the clip. curve 'hermite' (default) or 'linear'; existing tracks keep their interpolation. Every other
   * sequence and every untouched channel keeps its keys. Returns { sequence, keys, bytes, largestVertexError }. */
  write(model = this.rig.model, { tolerance = 0.5, curve = 'hermite' } = {}) {
    const plan = this.plan(model), fit = this.fit(model, { tolerance, curve, plan });
    const { start, end, existing, oldInterval, relocate } = plan;
    let index = plan.index;
    const inside = ([a, b]) => k => k.Frame >= a && k.Frame <= b;
    if (!existing) {
      const template = this.templateIndex(model), base = template >= 0 ? structuredClone(model.Sequences[template]) : {};
      index = model.Sequences.push({ ...base, Name: this.name, Interval: new Uint32Array([start, end]), NonLooping: !this.loop, MoveSpeed: this.moveSpeed || 0, Rarity: 0 }) - 1;
      if (template >= 0) copyVisibility(model, model.Sequences[template].Interval, [start, end]);
    } else {
      existing.NonLooping = !this.loop;
      if (this.moveSpeed != null) existing.MoveSpeed = this.moveSpeed;
      if (!plan.sameTiming) {
        // Other channels of this clip (visibility, effects, events) move with it.
        remapClip(model, oldInterval, [start, end], { skipNodeTransforms: true });
        existing.Interval = ArrayBuffer.isView(existing.Interval) ? new existing.Interval.constructor([start, end]) : [start, end];
      }
    }
    for (const { node, prop } of plan.clear) node[prop].Keys = node[prop].Keys.filter(k => !inside(oldInterval)(k));
    fit.trackList.forEach((built, i) => {
      const { node, prop } = fit.props[i];
      if (!node[prop]?.Keys) node[prop] = { LineType: built.LineType, Keys: [] };
      const track = node[prop];
      track.Keys = track.Keys.filter(k => !inside([start, end])(k) && !(oldInterval && !plan.sameTiming && inside(oldInterval)(k)));
      track.Keys.push(...built.Keys);
      track.Keys.sort((a, b) => a.Frame - b.Frame);
    });
    return {
      sequence: index, name: this.name, interval: [start, end], created: !existing, moved: relocate,
      keys: fit.keys, tracks: fit.trackList.length, keysPerTrack: fit.keysPerTrack, spacingMs: fit.spacingMs, bytes: fit.bytes,
      largestVertexError: fit.maxError, skipped: plan.skipped,
    };
  }
}

// Small quick reversals of a marker path (the owner's wobble meter): [[ms, amplitude], ...].
function wobble(path, N, step, lo = 0.25, hi = 5, window = 220) {
  const events = [];
  for (let axis = 0; axis < 3; axis++) {
    const y = n => path[n * 3 + axis], ext = [[0, y(0)]];
    let dir = 0;
    for (let n = 1; n < N; n++) {
      const d = y(n) - ext.at(-1)[1];
      if (dir === 0) { if (Math.abs(d) > lo) { dir = Math.sign(d); ext.push([n, y(n)]); } }
      else if (d * dir > 0) ext[ext.length - 1] = [n, y(n)];
      else if (Math.abs(d) > lo) { dir = -dir; ext.push([n, y(n)]); }
    }
    for (let i = 0; i + 2 < ext.length; i++) {
      const amp = Math.min(Math.abs(ext[i + 1][1] - ext[i][1]), Math.abs(ext[i + 2][1] - ext[i + 1][1]));
      if (amp >= lo && amp <= hi && (ext[i + 2][0] - ext[i][0]) * step <= window) events.push([ext[i + 1][0] * step, amp]);
    }
  }
  return events;
}

// Every keyed local track's keys inside `from` (and event frames) moved linearly into `to`. Node transform
// tracks can be skipped (the kit rewrites those). Global tracks are never touched.
function remapClip(model, from, to, { skipNodeTransforms = false, map } = {}) {
  const nodes = new Set(allNodes(model)), f = map || (frame => to[0] + (from[1] === from[0] ? 0 : (frame - from[0]) * (to[1] - to[0]) / (from[1] - from[0])));
  const inside = frame => frame >= from[0] && frame <= from[1], target = frame => frame >= to[0] && frame <= to[1];
  visitTracks(model, (track, { owner, property }) => {
    if (Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId >= 0 && model.GlobalSequences?.[track.GlobalSeqId] > 0) return;
    if (skipNodeTransforms && nodes.has(owner) && PROPS.includes(property)) return;
    const moved = [];
    for (const key of track.Keys.filter(k => inside(k.Frame))) {
      const frame = Math.round(f(key.Frame));
      if (moved.length && moved.at(-1).Frame >= frame) continue;
      moved.push({ ...key, Frame: frame });
    }
    track.Keys = [...track.Keys.filter(k => !inside(k.Frame) && !target(k.Frame)), ...moved].sort((a, b) => a.Frame - b.Frame);
  }, {
    skip: ['Nodes'],
    event: value => {
      const frames = Array.from(value.EventTrack), moved = frames.filter(inside).map(frame => Math.round(f(frame)));
      const kept = frames.filter(frame => !inside(frame) && !target(frame)), all = [...kept, ...moved].sort((a, b) => a - b);
      value.EventTrack = ArrayBuffer.isView(value.EventTrack) ? new value.EventTrack.constructor(all) : all;
    },
  });
}

// A new clip shows the same geosets, emitters and lights as its template: the template's non-transform keys
// (visibility, alpha, colour, emitter rates) are copied into the new interval, clipped to its length.
function copyVisibility(model, from, to) {
  const nodes = new Set(allNodes(model)), length = to[1] - to[0];
  visitTracks(model, (track, { owner, property }) => {
    if (Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId >= 0 && model.GlobalSequences?.[track.GlobalSeqId] > 0) return;
    if (nodes.has(owner) && PROPS.includes(property)) return;
    const inTemplate = track.Keys.filter(k => k.Frame >= from[0] && k.Frame <= from[1]);
    if (!inTemplate.length) return;
    const copies = inTemplate.filter(k => k.Frame - from[0] <= length).map(k => ({ ...structuredClone(k), Frame: to[0] + k.Frame - from[0] }));
    if (!copies.length || copies[0].Frame > to[0]) copies.unshift({ ...structuredClone(inTemplate[0]), Frame: to[0] });
    track.Keys = [...track.Keys.filter(k => k.Frame < to[0] || k.Frame > to[1]), ...copies].sort((a, b) => a.Frame - b.Frame);
  }, { skip: ['Nodes'] });
}

/** Retime an existing animation with a time map [[oldMs, newMs], ...] (first [0, 0], increasing): every keyed
 * local track of that sequence (bones, helpers, emitters, visibility, events) moves through the same map, so
 * the hit can stay where it is while wind-up and recovery stretch. A longer clip that no longer fits moves
 * after the last sequence. Other sequences are untouched. Returns the new interval. */
export function retime(model, sequence, points) {
  const index = Number.isInteger(sequence) ? sequence : (model.Sequences || []).findIndex(s => String(s.Name || '').trim().toLowerCase() === String(sequence).trim().toLowerCase());
  const s = model.Sequences?.[index];
  if (!s) throw Error(`No animation ${sequence}.`);
  const [a0, a1] = Array.from(s.Interval), map = timeMap(points);
  if (Math.abs(points.at(-1)[0] - (a1 - a0)) > 0.5 || points[0][0] !== 0 || points[0][1] !== 0) throw Error(`The time map runs from [0, 0] to [${a1 - a0}, newLength].`);
  const length = Math.round(map.length);
  const next = Math.min(Infinity, ...model.Sequences.filter(x => x !== s && x.Interval[0] > a0).map(x => x.Interval[0]));
  const start = a0 + length < next ? a0 : Math.max(...model.Sequences.map(x => x.Interval[1])) + 1000;
  remapClip(model, [a0, a1], [start, start + length], { map: frame => start + map.toOutput(frame - a0) });
  s.Interval = ArrayBuffer.isView(s.Interval) ? new s.Interval.constructor([start, start + length]) : [start, start + length];
  return { sequence: index, interval: [start, start + length], moved: start !== a0 };
}
