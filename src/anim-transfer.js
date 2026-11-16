// Transfer (XFER): copy animation from a donor onto the open model's own bones,
// per body part. Contract: docs/agent-tasks/transfer-xl.md. Pure module: no DOM,
// no React. The open model keeps its bones, pivots, skin and animations; the
// transfer only writes one new animation's keys.
import { Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, composeNodeMatrices, isGlobalTrack, keysInInterval, nodePivot, sampleTrack, skinGeoset, visitTracks } from './animation.js';
import { nodeIndex } from './node-hierarchy.js';
import { poseChainIds, poseNodeRole, suggestPoseBody, suggestPoseRig } from './pose-ik.js';
import { createSequence, standSequenceIndex } from './sequence-editor.js';
import { makeKey } from './animation-tracks.js';
import { trackValueError } from './optimizexl-animation.js';
import { extentsExclusions } from './model-extents.js';
import { box, finish, include, sequenceSampler } from './optimizexl-bounds.js';
import { geosetAlphaTrack, geosetVisibleIn } from './geoset-extras.js';
import { isWeaponName } from './rig-names.js';

export const TRANSFER_PART_LABELS = Object.freeze({
  hips: 'Hips', chest: 'Chest', head: 'Head', armL: 'Left arm', armR: 'Right arm',
  legL: 'Left leg', legR: 'Right leg', wingL: 'Left wing', wingR: 'Right wing', tail: 'Tail',
});
/** "Left arm", or "Left arm 2" for an extra limb of that kind. */
export function transferPartLabel(key) {
  const [, stem, number] = String(key).match(/^(.*?)(\d*)$/);
  return `${TRANSFER_PART_LABELS[stem] || stem}${number ? ` ${number}` : ''}`;
}
const TRUNK_ORDER = ['hips', 'chest', 'head'];
const swapSide = key => key.replace(/^(arm|leg|wing)([LR])/, (_, kind, side) => kind + (side === 'L' ? 'R' : 'L'));

// ---------------------------------------------------------------- maths
const UP = Object.freeze(new Vector3(0, 0, 1));
const v3 = value => new Vector3().fromArray(value);
const mul = (...qs) => qs.reduce((a, b) => a.multiply(b), new Quaternion());
const inv = q => q.clone().invert();
const axisAngle = (axis, radians) => new Quaternion().setFromAxisAngle(axis, radians);
const mirrorQ = q => new Quaternion(-q.x, q.y, -q.z, q.w);
const mirrorV = v => new Vector3(v.x, -v.y, v.z);
const DEG = Math.PI / 180;
function rotationOf(matrix) {
  const q = new Quaternion(); matrix.decompose(new Vector3(), q, new Vector3()); return q.normalize();
}
/** q to the power w (w may exceed 1), along the shortest arc. */
function qPow(q, w) {
  const sign = q.w < 0 ? -1 : 1, x = q.x * sign, y = q.y * sign, z = q.z * sign, s = Math.hypot(x, y, z);
  if (s < 1e-12) return new Quaternion();
  const half = Math.atan2(s, q.w * sign) * w, k = Math.sin(half) / s;
  return new Quaternion(x * k, y * k, z * k, Math.cos(half));
}
function slerpW(a, b, w) {
  if (w === 1) return b.clone();
  if (w === 0) return a.clone();
  return a.clone().multiply(qPow(inv(a).multiply(b), w)).normalize();
}
const arc = (from, to) => from && to && from.lengthSq() > 1e-12 && to.lengthSq() > 1e-12 ? new Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize()) : new Quaternion();
const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);

// ---------------------------------------------------------------- per-model caches
// One entry per model object: node lookups, the rig, and dense samples keyed by
// "sequence:frame". Models are read only; clearTransferCache after editing one.
const cache = new WeakMap();
function modelInfo(model) {
  let info = cache.get(model);
  if (!info) {
    const nodes = allNodes(model), tree = nodeIndex(model, nodes);
    info = { nodes, ids: nodes.map(node => node.ObjectId), byId: tree.byId, tree, joints: new Set([...(model.Bones || []), ...(model.Helpers || [])].map(node => node.ObjectId)), samples: new Map(), rigs: new Map(), skeletons: new Map() };
    cache.set(model, info);
  }
  return info;
}
/** Forget the cached rig and samples, for a model that was edited in place. */
export function clearTransferCache(model) { cache.delete(model); }

const REST = { t: new Vector3(), r: new Quaternion(), s: new Vector3(1, 1, 1) };
/** Local TRS and world matrices of every node at a whole frame (sequence -1 = rest pose). */
function sampleAt(model, sequence, frame) {
  const info = modelInfo(model), f = Math.round(frame), key = `${sequence}:${f}`;
  let sample = info.samples.get(key);
  if (sample) return sample;
  const interval = model.Sequences?.[sequence]?.Interval, local = new Map();
  const options = { interval, globalSequences: model.GlobalSequences, globalTime: f };
  for (const node of info.nodes) local.set(node.ObjectId, !interval ? REST : {
    t: v3(sampleTrack(node.Translation, f, { ...options, fallback: [0, 0, 0] })),
    r: new Quaternion().fromArray(sampleTrack(node.Rotation, f, { ...options, fallback: [0, 0, 0, 1], quaternion: true })).normalize(),
    s: v3(sampleTrack(node.Scaling, f, { ...options, fallback: [1, 1, 1] })),
  });
  const world = composeNodeMatrices(model, info.ids, node => local.get(node.ObjectId), info.byId);
  sample = { local, world, rot: new Map(), pos: new Map() };
  if (info.samples.size >= 2000) info.samples.clear(); // about 50 MB; slider changes keep adding frames
  info.samples.set(key, sample);
  return sample;
}
function worldRot(sample, id) {
  let q = sample.rot.get(id);
  if (!q) sample.rot.set(id, q = rotationOf(sample.world.get(id) || new Matrix4()));
  return q;
}
function worldPos(model, sample, id) {
  let p = sample.pos.get(id);
  if (!p) sample.pos.set(id, p = v3(nodePivot(model, modelInfo(model).byId.get(id), id)).applyMatrix4(sample.world.get(id) || new Matrix4()));
  return p;
}

// ---------------------------------------------------------------- rig
/** Body parts of a model, read once per model object and skeleton with POSE
 * recognition. A model with separate skeletons (a hero's demon form, a death
 * copy) uses the one the animation moves: `sequence` is the animation in use
 * (the taken one for a donor, the body animation for the open model); without
 * it the model's Stand decides. */
export function transferRig(model, { sequence } = {}) {
  const info = modelInfo(model);
  if (info.pose === undefined) info.pose = readPose(model);
  if (!info.pose.pose) return info.rigs.get(null) || (info.rigs.set(null, failedRig(info.pose.error)), info.rigs.get(null));
  const skeleton = skeletonFor(model, info, Number.isInteger(sequence) && model.Sequences?.[sequence]?.Interval ? sequence : defaultSequence(model));
  if (!info.rigs.has(skeleton)) info.rigs.set(skeleton, readRig(model, info, skeleton));
  return info.rigs.get(skeleton);
}

function defaultSequence(model) {
  const sequences = model.Sequences || [];
  let sequence = standSequenceIndex(model);
  if (sequence < 0 && sequences.length) sequence = 0;
  return sequences[sequence]?.Interval ? sequence : -1;
}
function readPose(model) {
  const sequence = defaultSequence(model), frame = sequence >= 0 ? model.Sequences[sequence].Interval[0] : 0;
  try { return { pose: suggestPoseRig(model, frame, Math.max(sequence, 0)) }; } catch (error) { return { error: `The rig could not be read: ${error.message}` }; }
}
const failedRig = sentence => ({ ok: false, reference: { sequence: -1, frame: 0 }, body: null, parts: {}, hipHeight: 0, ground: 0, weaponSide: null, facing: [1, 0, 0], problems: [sentence] });

/** Rotation keys a skeleton (a hierarchy root) carries inside one animation. */
function skeletonKeys(model, info, root, sequence) {
  const interval = model.Sequences?.[sequence]?.Interval;
  if (!interval) return 0;
  let count = 0;
  for (const id of info.joints) {
    const track = info.byId.get(id).Rotation;
    if (track?.Keys && info.tree.root(id) === root && !isGlobalTrack(track, model)) count += keysInInterval(track, interval).length;
  }
  return count;
}
/** Among separate skeletons with limbs, the one with the most Rotation keys in
 * the animation; the POSE body's skeleton when none moves. */
function skeletonFor(model, info, sequence) {
  const { pose } = info.pose, key = `skeleton:${sequence}`;
  if (info.skeletons.has(key)) return info.skeletons.get(key);
  const roots = [...new Set(pose.chains.map(chain => info.tree.root(chain.root)))];
  let best = pose.body != null ? info.tree.root(pose.body) : roots[0] ?? null, most = best == null ? -1 : skeletonKeys(model, info, best, sequence);
  for (const root of roots) { const count = skeletonKeys(model, info, root, sequence); if (count > most) { best = root; most = count; } }
  info.skeletons.set(key, best);
  return best;
}

function readRig(model, info, skeleton) {
  const { tree, byId, joints } = info, problems = [], sequences = model.Sequences || [], { pose } = info.pose;
  const roleOf = id => pose.roles?.[id] || poseNodeRole(byId.get(id));
  // The body of this skeleton: POSE's body, else the joint that drives all its limbs.
  let body = pose.body != null && tree.root(pose.body) === skeleton ? pose.body : null;
  const own = pose.chains.filter(chain => tree.root(chain.root) === skeleton);
  if (body == null && own.length) {
    try { body = suggestPoseBody(model, own, tree); body = tree.ancestors(body, true).find(id => roleOf(id) === 'Body' && !/death|portrait/i.test(byId.get(id).Name)) ?? body; } catch { body = null; }
  }
  // Reference pose: the first frame of this skeleton's own Stand (the plain
  // Stand when this skeleton moves most in it), else of an animation it moves
  // most in, else the plain Stand, else rest.
  const plain = defaultSequence(model), dominant = s => skeletonFor(model, info, s) === skeleton && skeletonKeys(model, info, skeleton, s) > 0;
  const indices = sequences.map((_, i) => i).filter(i => sequences[i]?.Interval);
  let sequence = plain >= 0 && dominant(plain) ? plain
    : indices.find(i => /^\s*stand/i.test(sequences[i].Name || '') && !/portrait/i.test(sequences[i].Name || '') && dominant(i))
      ?? indices.find(i => !/portrait|death|decay|dissipate/i.test(sequences[i].Name || '') && dominant(i)) ?? plain;
  const frame = sequence >= 0 ? sequences[sequence].Interval[0] : 0;
  const reference = { sequence, frame };
  const fail = sentence => ({ ...failedRig(sentence), reference, problems: [...problems, sentence] });
  if (body == null || !joints.has(body)) return fail('No body bone was found, so this model has no parts to transfer.');
  const ref = sampleAt(model, sequence, frame), pos = id => worldPos(model, ref, id).clone();
  const under = id => tree.isAncestor(id, body);
  const byDepth = (a, b) => tree.depth(a) - tree.depth(b);
  // Only the actor that owns the body; a rider or second creature stays put.
  const chains = pose.chains.filter(chain => under(chain.root));
  const limbIds = new Set(chains.flatMap(poseChainIds));
  const controls = (pose.nodes || []).filter(id => under(id) && joints.has(id) && !limbIds.has(id));
  // Upper and lower body: a trunk joint that carries a leg walks with the hips
  // (a horse body's chest, a Pit Lord's front neck). Chest is the Spine/Chest
  // joints that lead to the arms; head is the Neck/Head joints that hang from
  // that chest, so a mount's own neck and head stay on the body animation.
  const carriesLeg = id => chains.some(chain => chain.kind === 'leg' && chain.label !== 'Wing' && tree.isAncestor(chain.root, id));
  const arms = chains.filter(chain => chain.kind === 'arm' && chain.label !== 'Wing');
  const hips = [body, ...controls.filter(id => roleOf(id) === 'Pelvis' || ['Spine', 'Chest', 'Neck', 'Head'].includes(roleOf(id)) && carriesLeg(id))];
  const chest = controls.filter(id => ['Spine', 'Chest'].includes(roleOf(id)) && !carriesLeg(id) && (!arms.length || arms.some(chain => tree.isAncestor(chain.root, id))));
  const head = controls.filter(id => ['Neck', 'Head'].includes(roleOf(id)) && !carriesLeg(id) && (!chest.length || chest.some(c => tree.isAncestor(id, c))));
  const trunk = { hips: [...new Set(hips)].sort(byDepth), chest: chest.sort(byDepth), head: head.sort(byDepth) };
  const trunkIds = new Set(Object.values(trunk).flat());
  const nearestTrunk = (id, exclude = []) => tree.ancestors(id).find(a => trunkIds.has(a) && !exclude.includes(a)) ?? null;
  const parts = {};
  for (const key of TRUNK_ORDER) {
    const ids = trunk[key];
    if (!ids.length) continue;
    const marker = ids.at(-1);
    parts[key] = { key, kind: 'trunk', side: null, joints: ids, anchor: key === 'hips' ? null : nearestTrunk(ids[0], ids), marker, length: chainLength(ids.map(pos)), weapon: false };
  }
  // Limbs: the parent path from the chain's top to its last Bone/Helper, extended
  // upward through ancestors that carry only this limb and are not trunk joints.
  const bodyPos = pos(body), limbs = [];
  const chainsBelow = id => chains.filter(chain => tree.isAncestor(chain.root, id)).length;
  for (const chain of chains) {
    const ids = poseChainIds(chain), endJoint = tree.ancestors(chain.end, true).find(id => joints.has(id));
    const path = tree.ancestors(endJoint, true);
    const top = path.indexOf(ids[0]);
    if (top < 0) continue;
    const limb = path.slice(0, top + 1).reverse().filter(id => joints.has(id));
    for (let parent = tree.parentOf(limb[0]); parent != null && joints.has(parent) && !trunkIds.has(parent) && chainsBelow(parent) === 1; parent = tree.parentOf(parent)) limb.unshift(parent);
    if (!limb.length) continue;
    const tip = chain.end !== endJoint ? pos(chain.end) : null;
    limbs.push({ kind: chain.label === 'Wing' ? 'wing' : chain.kind === 'leg' ? 'leg' : 'arm', joints: limb, tip });
  }
  // Tail: the path from the first non-trunk joint down to a Tail-role joint.
  for (const id of [...joints].filter(id => under(id) && roleOf(id) === 'Tail' && !limbIds.has(id))) {
    const path = [];
    for (let at = id; at != null && joints.has(at) && !trunkIds.has(at); at = tree.parentOf(at)) path.unshift(at);
    if (path.length && !limbs.some(limb => limb.joints.some(j => path.includes(j)))) limbs.push({ kind: 'tail', joints: path, tip: null });
  }
  // Side is geometric: +Y of the body is left. Names are not trusted.
  for (const limb of limbs) {
    const root = pos(limb.joints[0]), end = limb.tip || pos(limb.joints.at(-1));
    const dy = Math.abs(root.y - bodyPos.y) > 0.5 ? root.y - bodyPos.y : end.y - bodyPos.y;
    limb.side = limb.kind === 'tail' ? null : dy >= 0 ? 'L' : 'R';
  }
  // Facing comes from the bind pivots: a Stand that turns the hips a little
  // (Footman 16 degrees, Lord of Change -14) must not read as a turned model.
  const bind = id => v3(nodePivot(model, byId.get(id), id));
  const legRoots = side => limbs.filter(limb => limb.kind === 'leg' && limb.side === side).map(limb => bind(limb.joints[0]));
  const armRoots = side => limbs.filter(limb => limb.kind === 'arm' && limb.side === side).map(limb => bind(limb.joints[0]));
  const pair = legRoots('L').length && legRoots('R').length ? [legRoots('L')[0], legRoots('R')[0]] : armRoots('L').length && armRoots('R').length ? [armRoots('L')[0], armRoots('R')[0]] : null;
  const across = pair ? pair[0].clone().sub(pair[1]).setZ(0) : null;
  const facing = across && across.lengthSq() > 1e-8 ? new Vector3(across.y, -across.x, 0).normalize() : new Vector3(1, 0, 0);
  // Extra limbs of a kind: legs back to front, arms and wings top to bottom.
  const order = (a, b) => a.kind === 'leg' ? pos(a.joints[0]).dot(facing) - pos(b.joints[0]).dot(facing) : pos(b.joints[0]).z - pos(a.joints[0]).z;
  const groups = new Map();
  for (const limb of limbs) { const k = limb.kind + (limb.side || ''); groups.set(k, [...(groups.get(k) || []), limb]); }
  for (const [stem, list] of groups) list.sort(order).forEach((limb, i) => {
    const key = stem + (i ? i + 1 : ''), last = limb.joints.at(-1);
    const weapon = limb.kind === 'arm' && info.nodes.some(node => node.ObjectId !== last && tree.isAncestor(node.ObjectId, last) && isWeaponName(node.Name));
    parts[key] = { key, kind: 'limb', side: limb.side, joints: limb.joints, anchor: nearestTrunk(limb.joints[0]), marker: last, length: chainLength([...limb.joints.map(pos), ...(limb.tip ? [limb.tip] : [])]), weapon };
    Object.defineProperty(parts[key], 'tip', { value: limb.tip, enumerable: false });
    Object.defineProperty(parts[key], 'limbKind', { value: limb.kind, enumerable: false });
  });
  const weapons = Object.values(parts).filter(part => part.weapon);
  const legs = Object.values(parts).filter(part => part.limbKind === 'leg');
  const hipCentre = legs.length ? average(legs.map(part => pos(part.joints[0]))) : bodyPos;
  const ground = legs.length ? Math.min(...legs.map(part => pos(part.marker).z)) : Math.min(...Object.values(parts).flatMap(part => part.joints.map(id => pos(id).z)));
  if (!Object.keys(parts).length) return fail('No body parts were recognised on this model.');
  const partJoints = new Set(Object.values(parts).flatMap(part => part.joints));
  for (const part of legs) Object.defineProperty(part, 'sole', { value: footSole(model, info, ref, part.marker, partJoints), enumerable: false });
  const rig = { ok: true, reference, body, parts, hipHeight: Math.max(1e-3, hipCentre.z - ground), ground, weaponSide: weapons.length === 1 ? weapons[0].side : null, facing: facing.toArray(), problems };
  Object.defineProperty(rig, 'hipCentre', { value: hipCentre, enumerable: false });
  return rig;
}
function chainLength(points) { let total = 0; for (let i = 1; i < points.length; i++) total += points[i].distanceTo(points[i - 1]); return total; }
function average(points) { return points.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(points.length); }

/** The sole of a foot: the vertices skinned only to the foot joint and the nodes
 * it carries that belong to no other part, kept in the foot joint's frame, and
 * the reference ground level (the lowest of them in the reference pose). */
function footSole(model, info, ref, foot, partJoints) {
  const own = new Set(info.ids.filter(id => info.tree.isAncestor(id, foot) && (id === foot || !partJoints.has(id))));
  const points = [];
  for (const geoset of model.Geosets || []) {
    const count = (geoset.Vertices?.length || 0) / 3, skin = geoset.SkinWeights, picked = [];
    for (let v = 0; v < count; v++) {
      const hd = skin?.length >= (v + 1) * 8;
      const bones = hd ? [0, 1, 2, 3].filter(i => skin[v * 8 + 4 + i] > 0).map(i => skin[v * 8 + i]) : Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []);
      if (bones.length && bones.every(id => own.has(id))) picked.push(v);
    }
    if (!picked.length) continue;
    const skinned = skinGeoset(geoset, ref.world);
    for (const v of picked) points.push(new Vector3(skinned[v * 3], skinned[v * 3 + 1], skinned[v * 3 + 2]));
  }
  if (!points.length) return null;
  // Every such vertex is checked: a foot that rolls brings its toes, not the
  // reference sole, to the floor (the Ghoul's toes in the Footman's walk).
  points.sort((a, b) => a.z - b.z);
  const toFoot = (ref.world.get(foot) || new Matrix4()).clone().invert();
  return { level: points[0].z, points: points.map(p => p.clone().applyMatrix4(toFoot)) };
}

/** Defaults of one taken part; the caller fills `source` and `sequence`. Every
 * part starts in the open model's own stance (Pose 0, "Mine"). */
export function defaultTransferPart(recipientRig, partKey, wholeBody = false) {
  return {
    source: null, sequence: null, from: null, flip: false, amount: 1, match: 0,
    offset: [0, 0, 0], start: 0, speed: 1, loop: null, blend: wholeBody ? 0 : 150, plant: true, travel: 1,
  };
}

/** The parts "Take whole body" takes: every part of the open model the donor
 * has (on either side). When the two walk on a different number of legs, hips
 * and legs stay on the body animation, and `reason` says so. */
export function transferWholeBody(recipientRig, donorRig) {
  const legs = rig => Object.keys(rig?.parts || {}).filter(key => /^leg/.test(key));
  const pairs = rig => Math.max(legs(rig).filter(key => /^legL/.test(key)).length, legs(rig).filter(key => /^legR/.test(key)).length);
  const lower = pairs(recipientRig) !== pairs(donorRig);
  const parts = Object.keys(recipientRig?.parts || {}).filter(key => (donorRig?.parts?.[key] || donorRig?.parts?.[swapSide(key)]) && !(lower && (key === 'hips' || /^leg/.test(key))));
  return { parts, reason: lower ? 'Hips and legs keep the body animation: the two models stand on a different number of legs.' : null };
}

// ---------------------------------------------------------------- clocks
const CLOCK_EPS = 1e-6;
/** Frame and weight of a clip at result time t. Looping clips wrap (the last
 * frame of a whole loop maps to the clip's first frame); others clamp and ramp. */
function clockAt(clock, t) {
  const { first, length, looping } = clock;
  if (looping) {
    const x = (t - clock.start) * clock.rate;
    let phase = length > 0 ? x - length * Math.floor(x / length + 1e-9) : 0;
    if (phase < 0) phase = 0;
    return { frame: first + phase, w: clock.amount };
  }
  const elapsed = t - clock.start, x = elapsed * clock.rate;
  const frame = first + Math.max(0, Math.min(length, x));
  if (x < -CLOCK_EPS || x > length + CLOCK_EPS) return { frame, w: 0 };
  const span = length / clock.rate, ramp = clock.blend > 0 ? smooth(Math.min(1, elapsed / clock.blend, (span - elapsed) / clock.blend)) : 1;
  return { frame, w: clock.amount * ramp };
}

// ---------------------------------------------------------------- build
/** Dense local motion of every driven joint. Pure: inputs are never changed. */
export function buildTransfer(recipient, sources, recipe, options = {}) {
  const step = options.step ?? 1000 / 30, problems = [];
  const baseIndex = recipe?.base?.sequence, baseSeq = recipient.Sequences?.[baseIndex];
  if (!baseSeq?.Interval) throw new Error('Choose a body animation first.');
  const rigB = transferRig(recipient, { sequence: baseIndex }), infoB = modelInfo(recipient), byIdB = infoB.byId;
  const modelOf = id => id === 'self' ? recipient : sources?.get?.(id);
  const refB = sampleAt(recipient, rigB.reference.sequence, rigB.reference.frame);

  // Taken parts, each with its donor, mapping and constant rotations.
  const taken = [];
  for (const [key, part] of Object.entries(recipe.parts || {})) {
    const own = rigB.parts[key];
    if (!own) { problems.push(`This model has no ${transferPartLabel(key).toLowerCase()}.`); continue; }
    const donor = modelOf(part.source), seq = donor?.Sequences?.[part.sequence];
    if (!seq?.Interval) { problems.push(`${transferPartLabel(key)}: choose an animation to take it from.`); continue; }
    const rigA = transferRig(donor, { sequence: part.sequence });
    const auto = donor !== recipient && !!rigA.weaponSide && !!rigB.weaponSide && rigA.weaponSide !== rigB.weaponSide;
    const whole = recipe.sources?.[part.source]?.mirror ?? auto;
    // Other side: the donor's opposite limb, mirrored so it bends the right way.
    const from = part.from ?? (whole ? swapSide(key) : key), fromKey = part.flip ? swapSide(from) : from, theirs = rigA.parts[fromKey];
    const mirror = whole !== !!part.flip;
    if (!theirs) { problems.push(`${transferPartLabel(key)}: the donor has no ${transferPartLabel(fromKey).toLowerCase()}, so it keeps the body animation.`); continue; }
    taken.push(prepareTaken({ key, part, own, theirs, donor, seq, sequence: part.sequence, rigA, rigB, refB, mirror, recipient }));
  }
  const drivenOrder = [...taken].sort((a, b) => (TRUNK_ORDER.indexOf(a.key) + 1 || 9) - (TRUNK_ORDER.indexOf(b.key) + 1 || 9) || infoB.tree.depth(a.own.joints[0]) - infoB.tree.depth(b.own.joints[0]));

  // Length and loops. A taken clip that plays once sets the length (its latest
  // end) and the result plays once; looping clips then run at their own speed
  // and are cut. When every taken clip loops, they play whole loops inside the
  // result: the longest clip when the body animation loops too, else the body
  // animation's length. A body animation that plays once is fitted to the
  // result, first frame to first frame and last to last, so untaken parts
  // (wings, cloth) finish their own action with the taken one.
  const baseLength = baseSeq.Interval[1] - baseSeq.Interval[0];
  const takenOnce = taken.some(entry => !entry.looping), nonLooping = !!baseSeq.NonLooping || takenOnce;
  let length = recipe.length;
  if (!(Number.isFinite(length) && length > 0)) {
    if (!taken.length) length = baseLength;
    else if (takenOnce) length = Math.max(...taken.filter(e => !e.looping).map(e => e.start + e.length / e.speed));
    else if (baseSeq.NonLooping) length = baseLength;
    else length = Math.max(baseLength, ...taken.map(e => e.length / e.speed));
  }
  length = Math.max(1, Math.round(length));
  const loopRate = (clipLength, speed) => takenOnce ? speed : Math.max(1, Math.round(length / (clipLength / speed))) * clipLength / length;
  const baseClock = { first: baseSeq.Interval[0], length: baseLength, looping: !baseSeq.NonLooping, start: 0, rate: baseSeq.NonLooping ? baseLength / length : loopRate(baseLength, 1), amount: 1, blend: 0, sequence: baseIndex };
  for (const entry of taken) entry.clock = { first: entry.seq.Interval[0], length: entry.length, looping: entry.looping, start: entry.start, rate: entry.looping ? loopRate(entry.length, entry.speed) : entry.speed, amount: entry.amount, blend: entry.looping ? 0 : entry.blend };

  const times = [];
  for (let t = 0; t < length - 0.5; t += step) { const f = Math.round(t); if (f !== times.at(-1)) times.push(f); }
  times.push(length);
  const n = times.length;

  // Driven joints: every joint of a taken part except global-sequence ones.
  const tracks = new Map(), driven = [];
  for (const entry of taken) for (const id of entry.own.joints) {
    if (isGlobalTrack(byIdB.get(id)?.Rotation, recipient)) { problems.push(`${byIdB.get(id).Name} turns on a global sequence, so it is left as it is.`); entry.skip.add(id); continue; }
    if (!tracks.has(id)) { tracks.set(id, { Rotation: new Float32Array(n * 4) }); driven.push(id); }
  }
  const hips = taken.find(entry => entry.key === 'hips');
  const moveBody = hips && !isGlobalTrack(byIdB.get(rigB.body)?.Translation, recipient);
  if (moveBody) tracks.get(rigB.body) ? tracks.get(rigB.body).Translation = new Float32Array(n * 3) : (tracks.set(rigB.body, { Translation: new Float32Array(n * 3) }), driven.push(rigB.body));
  const plantLegs = hips ? drivenOrder.filter(e => e.own.limbKind === 'leg' && e.part.plant !== false && e.donor === hips.donor && e.sequence === hips.sequence) : [];

  for (let k = 0; k < n; k++) {
    const t = times[k], base = sampleAt(recipient, baseIndex, clockAt(baseClock, t).frame);
    const over = new Map(), lookup = node => over.get(node.ObjectId) || base.local.get(node.ObjectId);
    const world = id => composeNodeMatrices(recipient, [id], lookup, byIdB).get(id);
    const parentRot = id => { const parent = infoB.tree.parentOf(id); return parent == null ? new Quaternion() : rotationOf(world(parent)); };
    const setRotation = (id, worldRotation, w) => {
      const own = base.local.get(id), local = inv(parentRot(id)).multiply(worldRotation).normalize();
      if (own.r.dot(local) < 0) local.set(-local.x, -local.y, -local.z, -local.w);
      over.set(id, { t: over.get(id)?.t || own.t, r: slerpW(own.r, local, w), s: own.s });
    };
    const states = new Map();
    // Rotation transfer, parts in hierarchy order.
    for (const entry of drivenOrder) {
      const { frame, w } = clockAt(entry.clock, t);
      if (!(w > 0)) continue;
      const donorSample = sampleAt(entry.donor, entry.sequence, frame);
      states.set(entry, { donorSample, w });
      const dA = entry.theirs.anchor == null ? new Quaternion() : worldRot(donorSample, entry.theirs.anchor).clone().multiply(entry.refAnchorA);
      const dB = entry.own.anchor == null ? new Quaternion() : rotationOf(world(entry.own.anchor)).multiply(entry.refAnchorB);
      const deltaOf = j => entry.convert(inv(dA).multiply(worldRot(donorSample, entry.theirs.joints[j])).multiply(entry.refInvA[j]));
      const spread = entry.spread ? deltaOf(entry.theirs.joints.length - 1) : null;
      entry.own.joints.forEach((id, i) => {
        if (entry.skip.has(id)) return;
        const delta = spread ? qPow(spread, entry.spread[i]) : deltaOf(entry.map[i]);
        setRotation(id, mul(dB, entry.offset, delta, entry.align[i], entry.refRotB[i]), w);
      });
      // Hips travel: move the body bone so the hip centre follows the donor's.
      if (entry === hips && moveBody) {
        const body = rigB.body, current = hipCentreOf(recipient, rigB, id => world(id));
        const donorCentre = hipCentreOf(entry.donor, entry.rigA, id => donorSample.world.get(id));
        const target = rigB.hipCentre.clone().add(entry.convertV(donorCentre.sub(entry.rigA.hipCentre)).multiplyScalar((entry.part.travel ?? 1) * entry.scale));
        const parent = infoB.tree.parentOf(body), linear = new Matrix3().setFromMatrix4(parent == null ? new Matrix4() : world(parent));
        const move = target.sub(current).applyMatrix3(linear.invert()).multiplyScalar(w);
        const own = over.get(body) || base.local.get(body);
        over.set(body, { ...own, t: own.t.clone().add(move) });
      }
    }
    // Planted feet: aim each leg's end on the donor foot's scaled path.
    for (const entry of plantLegs) {
      const state = states.get(entry), hipState = states.get(hips);
      if (!state || !hipState) continue;
      const donorEnd = worldPos(entry.donor, state.donorSample, entry.theirs.marker);
      const planted = entry.refEndB.clone().add(entry.convertV(donorEnd.clone().sub(entry.refEndA)).multiplyScalar(hips.scale));
      const own = worldPos(recipient, base, entry.own.marker);
      const target = own.clone().lerp(planted, Math.min(1, state.w));
      target.sub(entry.refRootB).applyQuaternion(entry.offset).add(entry.refRootB);
      solveLimb(recipient, entry.own.joints.filter(id => !entry.skip.has(id)), target, { world, over, base, parentRot });
      if (entry.own.sole && !entry.skip.has(entry.own.marker)) liftSole(recipient, entry.own.marker, entry.own.sole, { world, over, base, parentRot });
    }
    for (const id of driven) {
      const value = over.get(id) || base.local.get(id), out = tracks.get(id);
      if (out.Rotation) {
        const q = value.r, at = k * 4, prev = k ? out.Rotation.subarray(at - 4, at) : null;
        const sign = prev && prev[0] * q.x + prev[1] * q.y + prev[2] * q.z + prev[3] * q.w < 0 ? -1 : 1;
        out.Rotation.set([q.x * sign, q.y * sign, q.z * sign, q.w * sign], at);
      }
      if (out.Translation) out.Translation.set([value.t.x, value.t.y, value.t.z], k * 3);
    }
  }

  // Timing and naming come from the hips' donor animation when hips are taken.
  const moveSpeed = hips ? (hips.seq.MoveSpeed || 0) * hips.scale * (hips.part.travel ?? 1) : baseSeq.MoveSpeed || 0;
  const first = taken[0];
  const suggestedName = uniqueSequenceName(recipient, first ? first.seq.Name : baseSeq.Name);
  return { length, times, tracks, driven, nonLooping, moveSpeed, suggestedName, problems, baseClock };
}

function prepareTaken({ key, part, own, theirs, donor, seq, sequence, rigA, rigB, refB, mirror, recipient }) {
  const refA = sampleAt(donor, rigA.reference.sequence, rigA.reference.frame);
  // Mirroring reflects the donor across the XZ plane; a facing difference over
  // 20 degrees turns the donor's motion by that yaw.
  const facingA = v3(rigA.facing), facingB = v3(rigB.facing);
  if (mirror) facingA.y = -facingA.y;
  let yaw = Math.atan2(facingB.y, facingB.x) - Math.atan2(facingA.y, facingA.x);
  yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  const turn = Math.abs(yaw) > 20 * DEG ? axisAngle(UP, yaw) : new Quaternion(), turnInv = inv(turn);
  const convert = q => mul(turn, mirror ? mirrorQ(q) : q, turnInv);
  const convertV = v => (mirror ? mirrorV(v) : v.clone()).applyQuaternion(turn);
  const posA = id => worldPos(donor, refA, id), posB = id => worldPos(recipient, refB, id);
  const pointsA = theirs.joints.map(posA), pointsB = own.joints.map(posB);
  // The tip (an end attachment such as Hand Right Ref) counts toward arc length,
  // so a two-joint forearm still maps to the recipient's forearm.
  const map = jointMap(own.tip ? [...pointsB, own.tip] : pointsB, theirs.tip ? [...pointsA, theirs.tip] : pointsA, pointsB.length, pointsA.length);
  // Trunk parts with unequal counts share the donor part's whole turn by depth:
  // the deepest joint ends with all of it.
  const depths = own.joints.map(id => modelInfo(recipient).tree.depth(id)), top = Math.min(...depths), span = Math.max(...depths) - top + 1;
  const spread = own.kind === 'trunk' && own.joints.length !== theirs.joints.length ? depths.map(d => (d - top + 1) / span) : null;
  // Align: b's reference bone direction onto a's (in the converted donor space).
  const dirs = (points, tip, convertDir) => points.map((p, i) => {
    const next = points[i + 1] || tip;
    return next ? convertDir(next.clone().sub(p)) : null;
  });
  const dirB = dirs(pointsB, own.tip, v => v), dirA = dirs(pointsA, theirs.tip, convertV);
  for (let j = dirA.length - 1; j > 0; j--) if (!dirA[j]) dirA[j] = dirA[j - 1];
  const match = Math.max(0, Math.min(1, part.match ?? defaultTransferPart(rigB, key).match));
  const align = [];
  own.joints.forEach((id, i) => { align.push(dirB[i] ? qPow(arc(dirB[i], dirA[map[i]]), match) : (align[i - 1] || new Quaternion()).clone()); });
  const looping = part.loop ?? !seq.NonLooping;
  const speed = part.speed > 0 ? part.speed : 1;
  const refRootB = posB(own.joints[0]).clone();
  return {
    key, part, own, theirs, donor, seq, sequence, rigA, looping, speed,
    start: Number(part.start) || 0, length: Math.max(0, seq.Interval[1] - seq.Interval[0]),
    amount: Math.max(0, Math.min(1.5, part.amount ?? 1)), blend: Math.max(0, part.blend ?? 150),
    scale: rigB.hipHeight / rigA.hipHeight, convert, convertV, map, spread, align,
    offset: partOffset(rigB, own, refB, recipient, part.offset),
    refAnchorA: theirs.anchor == null ? null : inv(worldRot(refA, theirs.anchor)),
    refAnchorB: own.anchor == null ? null : inv(worldRot(refB, own.anchor)),
    refInvA: theirs.joints.map(id => inv(worldRot(refA, id))),
    refRotB: own.joints.map(id => worldRot(refB, id).clone()),
    refEndA: posA(theirs.marker).clone(), refEndB: posB(own.marker).clone(), refRootB,
    skip: new Set(),
  };
}

/** Recipient joint i -> donor joint index: one to one when counts match, else
 * nearest arc-length fraction along the reference pose (first and last fixed). */
function jointMap(ownPath, theirPath, ownCount, theirCount) {
  if (ownCount === theirCount) return Array.from({ length: ownCount }, (_, i) => i);
  const own = ownPath, theirs = theirPath;
  const fractions = points => {
    const cumulative = [0];
    for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + points[i].distanceTo(points[i - 1]));
    const total = cumulative.at(-1);
    return cumulative.map((c, i) => total > 1e-9 ? c / total : points.length > 1 ? i / (points.length - 1) : 0);
  };
  const a = fractions(own).slice(0, ownCount), b = fractions(theirs).slice(0, theirCount);
  return a.map((f, i) => {
    if (i === 0) return 0;
    if (i === ownCount - 1) return theirCount - 1;
    let best = 0;
    b.forEach((g, j) => { if (Math.abs(g - f) < Math.abs(b[best] - f)) best = j; });
    return best;
  });
}

/** The constant user offset (degrees) as one world rotation from the reference pose. */
function partOffset(rig, part, ref, model, degrees = [0, 0, 0]) {
  const [a, b, c] = (degrees || [0, 0, 0]).map(value => (Number(value) || 0) * DEG);
  if (!a && !b && !c) return new Quaternion();
  const forward = v3(rig.facing), left = UP.clone().cross(forward).normalize();
  if (part.kind === 'trunk') return mul(axisAngle(UP, c), axisAngle(left, a), axisAngle(forward, b));
  const root = worldPos(model, ref, part.joints[0]), end = part.tip || worldPos(model, ref, part.marker);
  const line = end.clone().sub(root), flat = line.clone().setZ(0);
  const bearing = flat.length() < line.length() * Math.sin(15 * DEG) || flat.lengthSq() < 1e-12
    ? (part.side === 'R' ? left.clone().negate() : part.side === 'L' ? left.clone() : forward.clone()) : flat.normalize();
  const raiseAxis = bearing.clone().cross(UP).normalize();
  return mul(axisAngle(UP, b), axisAngle(raiseAxis, a), line.lengthSq() > 1e-12 ? axisAngle(line.normalize(), c) : new Quaternion());
}

function hipCentreOf(model, rig, matrixOf) {
  const at = id => v3(nodePivot(model, modelInfo(model).byId.get(id), id)).applyMatrix4(matrixOf(id) || new Matrix4());
  const legs = Object.values(rig.parts).filter(part => part.limbKind === 'leg');
  return legs.length ? average(legs.map(part => at(part.joints[0]))) : at(rig.body);
}

/** Leg solve: scale every interior bend about its own axis by one factor until
 * the root-to-end distance matches, aim the first joint at the target, and give
 * the end joint back its world rotation. Works for any joint count. */
function solveLimb(model, ids, target, { world, over, base, parentRot }) {
  if (ids.length < 2) return;
  const byId = modelInfo(model).byId;
  const matrices = ids.map(world), rotations = matrices.map(rotationOf);
  const points = ids.map((id, i) => v3(nodePivot(model, byId.get(id), id)).applyMatrix4(matrices[i]));
  const segments = points.slice(1).map((p, i) => p.clone().sub(points[i]));
  const bends = segments.slice(1).map((out, i) => {
    const incoming = segments[i], angle = incoming.angleTo(out), axis = incoming.clone().cross(out);
    return angle > 1e-4 && axis.lengthSq() > 1e-12 ? { axis: axis.normalize(), angle } : null;
  });
  const reach = segments.reduce((sum, s) => sum + s.length(), 0), want = target.clone().sub(points[0]);
  const distance = Math.min(want.length(), reach * 0.999);
  const turns = factor => {
    const list = [new Quaternion()];
    bends.forEach((bend, i) => list.push(list[i].clone().multiply(bend ? axisAngle(bend.axis, (factor - 1) * bend.angle) : new Quaternion())));
    return list;
  };
  const endOf = list => segments.reduce((p, s, i) => p.add(s.clone().applyQuaternion(list[i])), points[0].clone());
  const reachAt = factor => endOf(turns(factor)).distanceTo(points[0]);
  let factor = 1;
  const active = bends.filter(Boolean);
  if (active.length) {
    let lo = 0, hi = Math.min(...active.map(bend => (Math.PI - 0.05) / bend.angle));
    if (reachAt(hi) >= distance) factor = hi;
    else if (reachAt(lo) <= distance) factor = lo;
    else for (let i = 0; i < 40; i++) { factor = (lo + hi) / 2; if (reachAt(factor) > distance) lo = factor; else hi = factor; }
  }
  const list = turns(factor), aim = arc(endOf(list).sub(points[0]), want);
  const end = rotations.at(-1).clone();
  ids.forEach((id, i) => {
    const desired = i === ids.length - 1 ? end : mul(aim, list[i] || list.at(-1), rotations[i]);
    const own = base.local.get(id), current = over.get(id) || own;
    const local = inv(parentRot(id)).multiply(desired).normalize();
    if (current.r.dot(local) < 0) local.set(-local.x, -local.y, -local.z, -local.w);
    over.set(id, { t: current.t, r: local, s: current.s });
  });
}

/** Feet above the ground: when the sole of a planted foot dips below its own
 * reference level, turn the foot joint about its pivot by the least angle that
 * lifts the lowest sole point back, until the whole sole is up. */
function liftSole(model, foot, sole, { world, over, base, parentRot }) {
  const pivotLocal = v3(nodePivot(model, modelInfo(model).byId.get(foot), foot));
  for (let pass = 0; pass < 6; pass++) {
    const matrix = world(foot), points = sole.points.map(p => p.clone().applyMatrix4(matrix));
    const lowest = points.reduce((a, b) => b.z < a.z ? b : a);
    if (lowest.z >= sole.level - 1e-3) return;
    const pivot = pivotLocal.clone().applyMatrix4(matrix), arm = lowest.clone().sub(pivot), axis = arm.clone().cross(UP);
    if (axis.lengthSq() < 1e-10 || pivot.z < sole.level) return;
    axis.normalize();
    const lift = axis.clone().cross(arm), heightAt = angle => pivot.z + arm.z * Math.cos(angle) + lift.z * Math.sin(angle);
    let lo = 0, hi = Math.PI / 2;
    if (heightAt(hi) < sole.level) lo = hi;
    else for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (heightAt(mid) >= sole.level) hi = mid; else lo = mid; }
    const turned = axisAngle(axis, Math.max(lo, hi) + 1e-4).multiply(rotationOf(matrix));
    const current = over.get(foot) || base.local.get(foot), local = inv(parentRot(foot)).multiply(turned).normalize();
    if (current.r.dot(local) < 0) local.set(-local.x, -local.y, -local.z, -local.w);
    over.set(foot, { t: current.t, r: local, s: current.s });
  }
}

function uniqueSequenceName(model, name) {
  const taken = new Set((model.Sequences || []).map(sequence => sequence.Name));
  if (!taken.has(name)) return name;
  const stem = String(name).replace(/\s*-\s*\d+\s*$/, '');
  for (let n = 2; ; n++) if (!taken.has(`${stem} - ${n}`)) return `${stem} - ${n}`;
}

// ---------------------------------------------------------------- write
// Cubic keys (line types 2 and 3) get tangents fitted to the motion's rate of
// change at each end of their segment, so a key placed mid-curve continues the
// curve instead of flattening it. Rates are per ms: a vector for Translation,
// the quaternion log (half-angle vector, in the key's own frame) for Rotation.
function logQ(q) {
  const sign = q.w < 0 ? -1 : 1, v = new Vector3(q.x * sign, q.y * sign, q.z * sign), s = v.length();
  return s < 1e-12 ? v.set(0, 0, 0) : v.multiplyScalar(Math.atan2(s, q.w * sign) / s);
}
function expQ(v) {
  const s = v.length();
  if (s < 1e-12) return new Quaternion();
  const k = Math.sin(s) / s;
  return new Quaternion(v.x * k, v.y * k, v.z * k, Math.cos(s));
}
/** Set a.OutTan and b.InTan for the segment a..b (frames apart) from end rates. */
function fitSegment(a, b, rateA, rateB, lineType, rotation) {
  if (lineType < 2) return;
  const span = b.Frame - a.Frame, typed = (template, value) => ArrayBuffer.isView(template) ? new template.constructor(value) : Array.from(value);
  if (rotation) {
    // The sampler's squad: tangents act through slerp(OutTan_a, InTan_b) weighted 2t(1-t).
    const qa = new Quaternion().fromArray(a.Vector).normalize(), qb = new Quaternion().fromArray(b.Vector).normalize();
    if (qa.dot(qb) < 0) qb.set(-qb.x, -qb.y, -qb.z, -qb.w);
    const step = logQ(inv(qa).multiply(qb));
    const out = qa.clone().multiply(expQ(rateA.clone().multiplyScalar(span).sub(step).multiplyScalar(0.5)));
    const into = qb.clone().multiply(expQ(step.clone().sub(rateB.clone().multiplyScalar(span)).multiplyScalar(0.5)));
    a.OutTan = typed(a.OutTan || a.Vector, out.toArray()); b.InTan = typed(b.InTan || b.Vector, into.toArray());
  } else if (lineType === 2) {
    a.OutTan = typed(a.OutTan || a.Vector, rateA.map(v => v * span)); b.InTan = typed(b.InTan || b.Vector, rateB.map(v => v * span));
  } else {
    a.OutTan = typed(a.OutTan || a.Vector, rateA.map((v, i) => a.Vector[i] + v * span / 3)); b.InTan = typed(b.InTan || b.Vector, rateB.map((v, i) => b.Vector[i] - v * span / 3));
  }
}
/** Rate of change per ms of a sampled value: side +1 looks ahead, -1 behind, 0 both. */
function rateOf(sample, frame, rotation, side, h = 0.5) {
  const ahead = side >= 0 ? h : 0, behind = side <= 0 ? h : 0;
  const a = sample(frame - behind), b = sample(frame + ahead), span = ahead + behind;
  if (rotation) { const qa = new Quaternion().fromArray(a), qb = new Quaternion().fromArray(b); if (qa.dot(qb) < 0) qb.set(-qb.x, -qb.y, -qb.z, -qb.w); return logQ(inv(qa).multiply(qb)).divideScalar(span); }
  return b.map((v, i) => (v - a[i]) / span);
}

const ROTATION_TOLERANCE = 0.5, TRANSLATION_TOLERANCE = 0.2;
/** Greedy longest-run reduction of dense values, checked with the real sampler
 * on the track's own line type. First and last frames are always keys. */
function reduceDense(frames, values, width, lineType, property) {
  const rotation = property === 'Rotation', tolerance = rotation ? ROTATION_TOLERANCE : TRANSLATION_TOLERANCE;
  const vals = frames.map((_, i) => Array.from(values.subarray(i * width, i * width + width)));
  const rates = lineType < 2 ? [] : frames.map((_, i) => denseRate(vals, frames, i, rotation));
  const segment = (i, j) => {
    const a = makeKey(frames[i], vals[i], lineType, property), b = makeKey(frames[j], vals[j], lineType, property);
    if (lineType >= 2) fitSegment(a, b, rates[i], rates[j], lineType, rotation);
    return [a, b];
  };
  const fits = (i, j) => {
    const track = { LineType: lineType, Keys: segment(i, j) }, options = { interval: [frames[i], frames[j]], fallback: rotation ? [0, 0, 0, 1] : [0, 0, 0], quaternion: rotation };
    for (let k = i + 1; k < j; k++) if (trackValueError(vals[k], sampleTrack(track, frames[k], options), rotation) > tolerance) return false;
    return true;
  };
  const keys = [makeKey(frames[0], vals[0], lineType, property)];
  for (let i = 0; i < frames.length - 1;) {
    let j = i + 1;
    while (j + 1 < frames.length && fits(i, j + 1)) j++;
    const [a, b] = segment(i, j);
    if (a.OutTan) keys.at(-1).OutTan = a.OutTan;
    keys.push(b); i = j;
  }
  return keys;
}
/** Rate at dense sample i: slope at i of a least-squares cubic through up to two
 * neighbours on each side (rotations in the log map around sample i). */
function denseRate(vals, frames, i, rotation) {
  const lo = Math.max(0, i - 2), hi = Math.min(frames.length - 1, i + 2), q = rotation && new Quaternion().fromArray(vals[i]);
  const xs = [], ys = [];
  for (let j = lo; j <= hi; j++) {
    xs.push(frames[j] - frames[i]);
    ys.push(rotation ? logQ(inv(q).multiply(new Quaternion().fromArray(vals[j]))).toArray() : vals[j]);
  }
  const degree = Math.min(3, xs.length - 1), size = degree + 1, scale = Math.max(...xs.map(Math.abs)) || 1;
  // Normal equations on x / scale for conditioning; the slope is a1 / scale.
  const matrix = Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => xs.reduce((sum, x) => sum + (x / scale) ** (r + c), 0)));
  const slope = ys[0].map((_, component) => {
    const rhs = Array.from({ length: size }, (_, r) => xs.reduce((sum, x, k) => sum + (x / scale) ** r * ys[k][component], 0));
    return solveLinear(matrix.map(row => row.slice()), rhs)[1] / scale;
  });
  return rotation ? new Vector3().fromArray(slope) : slope;
}
function solveLinear(a, b) {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    [a[c], a[pivot]] = [a[pivot], a[c]]; [b[c], b[pivot]] = [b[pivot], b[c]];
    if (Math.abs(a[c][c]) < 1e-12) continue;
    for (let r = c + 1; r < n; r++) { const f = a[r][c] / a[c][c]; for (let k = c; k < n; k++) a[r][k] -= f * a[c][k]; b[r] -= f * b[c]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { if (Math.abs(a[r][r]) < 1e-12) continue; let s = b[r]; for (let k = r + 1; k < n; k++) s -= a[r][k] * x[k]; x[r] = s / a[r][r]; }
  return x;
}

/** The node tracks the transfer writes into one animation: each the node's whole
 * track with only that interval's keys replaced by the reduced built motion. */
export function transferNodeTracks(model, sequenceIndex, built) {
  const interval = model.Sequences?.[sequenceIndex]?.Interval;
  if (!interval) throw new Error('Choose the animation to write the transfer into.');
  const byId = modelInfo(model).byId, start = interval[0], end = interval[1];
  const frames = built.times.map(t => start + t), result = [];
  for (const id of built.driven) {
    const node = byId.get(id), dense = built.tracks.get(id);
    for (const property of ['Rotation', 'Translation']) {
      if (!dense?.[property] || isGlobalTrack(node[property], model)) continue;
      const existing = node[property]?.Keys ? node[property] : null, lineType = existing?.LineType ?? 1;
      const ours = reduceDense(frames, dense[property], property === 'Rotation' ? 4 : 3, lineType, property);
      const outside = (existing?.Keys || []).filter(k => k.Frame < start || k.Frame > end);
      result.push({ id, property, track: { ...(existing || { GlobalSeqId: null }), LineType: lineType, Keys: [...outside, ...ours].sort((a, b) => a.Frame - b.Frame) } });
    }
  }
  return result;
}

/** The Rotation and Translation tracks of `ids` as applyTransfer leaves an undriven
 * node: the recipient's own track with the body animation copied into the new
 * animation at `start`. A preview that drove these nodes earlier puts them back with
 * this, without rebuilding its model. The recipient is not changed. */
export function transferRestoreTracks(recipient, start, built, ids) {
  const byId = modelInfo(recipient).byId, holder = { Sequences: recipient.Sequences, GlobalSequences: recipient.GlobalSequences, Nodes: [] }, result = [];
  for (const id of ids) {
    const node = byId.get(id);
    if (!node) continue;
    for (const property of ['Rotation', 'Translation']) {
      const own = node[property];
      if (own?.Keys && isGlobalTrack(own, recipient)) continue;
      const track = own?.Keys ? structuredClone(own) : own;
      if (track?.Keys) holder.Nodes.push({ [property]: track });
      result.push({ id, property, track });
    }
  }
  if (holder.Nodes.length) copyBodyAnimation(holder, built.baseClock, start, built.length);
  return result;
}

/** Result time t -> body animation frame, the build's own clock. */
const baseFrame = (clock, t) => clockAt(clock, t).frame;
const like = (template, value) => ArrayBuffer.isView(template) ? new template.constructor(value) : Array.from(value);

/** Copy the body animation into [start, start + length]: every non-global track's
 * keys time-mapped by the base clock, plus sampled keys at loop seams and ends. */
function copyBodyAnimation(model, clock, start, length) {
  const base = model.Sequences[clock.sequence], [bs, be] = base.Interval;
  const period = clock.looping ? clock.length / clock.rate : Infinity;
  const loops = clock.looping && clock.length > 0 ? Math.ceil(length / period - 1e-9) : 1;
  const seams = [];
  for (let m = 1; m < loops; m++) seams.push(Math.round(m * period));
  const mapFrame = (f, m) => (m * period || 0) + (f - bs) / clock.rate;
  // Stray keys that already sit past the last animation (some repaired models
  // have them) would play inside the new one; they belong to no animation.
  const outside = frame => frame < start || frame > start + length;
  visitTracks(model, (track, { owner, property }) => {
    if (isGlobalTrack(track, model)) return;
    if (Array.isArray(owner)) property = null;
    if (!track.Keys.every(key => outside(key.Frame))) track.Keys = track.Keys.filter(key => outside(key.Frame));
    const inside = keysInInterval(track, base.Interval);
    if (!inside.length) return;
    const rotation = property === 'Rotation', template = inside[0], width = template.Vector?.length ?? 1;
    const keys = new Map(), sampleBase = f => sampleTrack(track, f, { interval: base.Interval, globalSequences: model.GlobalSequences, fallback: rotation ? [0, 0, 0, 1] : new Array(width).fill(0), quaternion: rotation });
    for (let m = 0; m < loops; m++) for (const key of inside) {
      const t = mapFrame(key.Frame, m);
      if (t > length + 1e-6) continue;
      const copy = { Frame: start + Math.round(t), Vector: like(key.Vector, key.Vector) };
      if (key.InTan) copy.InTan = like(key.InTan, key.InTan);
      if (key.OutTan) copy.OutTan = like(key.OutTan, key.OutTan);
      keys.set(copy.Frame, { key: copy, base: key.Frame });
    }
    const sampled = t => {
      const frame = start + Math.round(t);
      if (keys.has(frame)) return;
      const at = baseFrame(clock, t), key = makeKey(frame, sampleBase(at), track.LineType, property);
      keys.set(frame, { key: { Frame: frame, Vector: like(template.Vector, key.Vector), ...(key.InTan ? { InTan: like(template.InTan || key.InTan, key.InTan), OutTan: like(template.OutTan || key.OutTan, key.OutTan) } : {}) }, base: at, sampled: true });
    };
    sampled(0); sampled(length);
    for (const seam of seams) { if (seam - 1 > 0) sampled(seam - 1); sampled(seam); }
    const list = [...keys.values()].sort((a, b) => a.key.Frame - b.key.Frame);
    // A sampled key cuts a cubic segment: refit the tangents on both sides of it
    // to the body animation's own rate, so the curve carries on through the cut.
    if (track.LineType >= 2) {
      const scale = clock.rate, rate = (entry, side) => { const r = rateOf(sampleBase, entry.base, rotation, side); return rotation ? r.multiplyScalar(scale) : r.map(v => v * scale); };
      list.forEach((entry, i) => {
        if (!entry.sampled) return;
        if (list[i - 1]) fitSegment(list[i - 1].key, entry.key, rate(list[i - 1], 1), rate(entry, -1), track.LineType, rotation);
        if (list[i + 1]) fitSegment(entry.key, list[i + 1].key, rate(entry, 1), rate(list[i + 1], -1), track.LineType, rotation);
      });
    }
    track.Keys = [...track.Keys, ...list.map(entry => entry.key)].sort((a, b) => a.Frame - b.Frame);
  }, {
    skip: ['Keys', 'EventTrack', 'Interval', 'Anims'],
    event(node) {
      if (isGlobalTrack(node, model)) return;
      const frames = Array.from(node.EventTrack).filter(outside), copies = new Set();
      for (let m = 0; m < loops; m++) for (const f of frames) if (f >= bs && f <= be) { const t = mapFrame(f, m); if (t <= length + 1e-6) copies.add(start + Math.round(t)); }
      const combined = [...frames, ...copies].sort((a, b) => a - b);
      node.EventTrack = ArrayBuffer.isView(node.EventTrack) ? new node.EventTrack.constructor(combined) : combined;
    },
  });
}

/** The new animation's extents from its sampled motion, as Calculate extents does. */
function newSequenceExtents(model, index) {
  const sequence = model.Sequences[index], excluded = extentsExclusions(model), boxes = sequenceSampler(model, { includeGlobalKeys: true })(index), total = box();
  (model.Geosets || []).forEach((geoset, i) => {
    if (geoset.Anims?.length > index) geoset.Anims[index] = finish(boxes[i]);
    const alpha = geosetAlphaTrack(model, i);
    if (!excluded.has(i) && geoset.Vertices?.length && Number.isFinite(boxes[i].min[0]) && (isGlobalTrack(alpha) || geosetVisibleIn(model, alpha, sequence, sequence.Interval))) { include(total, boxes[i].min); include(total, boxes[i].max); }
  });
  if (Number.isFinite(total.min[0])) Object.assign(sequence, finish(total));
}

/** Add the built transfer to `model` as one new animation. Mutates the model;
 * the caller wraps it in the document's undo step. */
export function applyTransfer(model, built, recipe, { name, extents = true } = {}) {
  const index = createSequence(model, built.length, { name: name ?? built.suggestedName, nonLooping: built.nonLooping, extents: 'ifPresent' });
  const sequence = model.Sequences[index];
  sequence.MoveSpeed = built.moveSpeed;
  copyBodyAnimation(model, { ...built.baseClock, sequence: recipe?.base?.sequence ?? built.baseClock.sequence }, sequence.Interval[0], built.length);
  const byId = modelInfo(model).byId;
  for (const { id, property, track } of transferNodeTracks(model, index, built)) byId.get(id)[property] = track;
  if (extents) newSequenceExtents(model, index);
  return { sequenceIndex: index };
}

/** A private copy with the transfer applied: geoset vertex data is shared, all
 * that applyTransfer writes is copied. Preview and commit share one code path. */
export function transferPreviewModel(recipient, built, recipe) {
  const { Geosets, ...rest } = recipient;
  const model = structuredClone(rest);
  model.Geosets = (Geosets || []).map(geoset => ({ ...geoset, ...(geoset.Anims ? { Anims: structuredClone(geoset.Anims) } : {}) }));
  // The preview does not show extents, so it skips that sampling pass.
  const { sequenceIndex } = applyTransfer(model, built, recipe, { extents: false });
  return { model, sequenceIndex };
}
