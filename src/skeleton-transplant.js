// Transplant (XFER, stage 3): the open model's mesh on the donor's skeleton, with every donor
// animation. Contract: docs/agent-tasks/xfer-both-ways.md, "Stage 3: transplant"; design study:
// docs/agent-tasks/xfer-transplant-research.md. Pure module: no DOM, no React. Neither input
// model is changed; the result is a new model object the caller swaps in as one undo step.
//
// Outline (the study's section 3, with the owner's answers of 17 Nov 2026 where they differ):
// 1. Pair the bodies with the retargeting engine's own pairing (stage 1, read from
//    buildTransfer's probe). Trunk joints pair by what hangs from them: the donor joint the legs
//    hang from takes the open model's hips, the one the arms hang from its chest, the deepest
//    head joint its head.
// 2. No limb is converted (v2, owner 19 Nov 2026; skin contract): a donor joint no own joint takes
//    (a neck, a hock, a forearm) sits on this model's line between its neighbours and takes the
//    skin past its plane (src/transplant-skin.js). Skin goes onto the donor bone that carries
//    that joint's skin in the donor; a leg's foot is not corrected; the body's travel is scaled
//    by the fitted legs. A leg's run (knee > hock > foot) points along the donor's chord, so the
//    shin stays straight (owner's pick); `legs: 'folded'` folds it at the hock as the donor's.
// 3. Donor joints sit on this model's joints (paired), on this model's line between its
//    neighbours (a donor collar or neck it lacks), or at the donor's offset scaled by the size
//    ratio (a tail, a weapon root).
// 4. The mesh is bound to the donor joint each of its bones pairs with. An extra (weapon, plate,
//    belt: a skinned bone outside the body parts) goes with its bone and rides the donor's matching
//    chain (hair, cape, tail, claws: same part, same place), else the donor joint its own part joint
//    pairs with, held as the model holds it in its own reference pose; one in `keep` keeps its bone,
//    held the same way. Skin on joints outside the body rides the part joint it follows in the
//    model's own animations (the body joint when none, the world when it stays still there). The
//    weapon (v2: the extras on the weapon hand and the one the model's weapon attachment hangs from) instead rides the donor's weapon bone (the
//    joint its weapon attachment hangs from, else its weapon hand), from where the model holds it
//    in the result's reference moment, unless that bone is on the donor's other arm or on no hand (a head, a leg,
//    the body: then the weapon stays in the hand).
// 5. The donor's keys are copied with its animation list, rotation keys as they are, position keys
//    scaled (owner, 19 Nov 2026: "A TRANSPLANT IS 100% A TRANSPLANT"). The posture is the donor's:
//    the bind pose is re-posed into the donor's rest posture on this model's proportions (each limb
//    stretch along the donor's; the upper body and neck turned so hips > shoulders > head point as
//    the donor's), and the mesh follows its bones.
// 6. Attachment points are the donor's (its weapon ones hang from the bone carrying the weapon,
//    where the model's own weapon attachment sits on it); its sounds and footprints (`events`) and particle effects
//    (`emitters`) come along when asked. The model's own camera, collision shapes and effects
//    stay; what they key inside its own animations is fitted into the donor animation of the
//    same kind (else its Stand).
import { Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, isGlobalTrack, keysInInterval, nodePivot, sampleNodeMatrices, sampleTrack, visitTracks } from './animation.js';
import { nodeIndex } from './node-hierarchy.js';
import { SKIN_BAND, donorSkinCarriers, legTravelRatio, splitJoints, transplantRuns } from './transplant-skin.js';
import { standSequenceIndex, fillSequenceExtents } from './sequence-editor.js';
import { canonicalizeSerializedNodeOrder } from './node-id-order.js';
import { updateCounts } from './editor-document.js';
import { createResourceImporter } from './model-import.js';
import { adaptPasteFormat } from './paste-format.js';
import { corpseAndBackgroundGeosets } from './geoset-extras.js';
import {
  buildTransfer, clearTransferCache, copyBodyAnimation, defaultTransferPart, newSequenceExtents, sameKindSequence,
  rigSizeRatio, transferPartLabel, transferRig, transferWholeBody,
} from './anim-transfer.js';

const JOINT_KEYS = ['Bones', 'Helpers'];
const EFFECT_KEYS = ['ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters', 'Lights'];
const NODE_KEYS = [...JOINT_KEYS, 'Attachments', 'EventObjects', 'CollisionShapes', ...EFFECT_KEYS];
const TYPE_FLAGS = 0x7f00, BONE_FLAG = 256, NO_LENGTH = -2;
const v3 = value => new Vector3().fromArray(value);
const inv = q => q.clone().invert();
const near = (q, eps = 1e-6) => Math.abs(Math.abs(q.w) - 1) < eps;
const arc = (from, to) => from.lengthSq() > 1e-12 && to.lengthSq() > 1e-12 ? new Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize()) : new Quaternion();
const like = (template, values) => ArrayBuffer.isView(template) ? new template.constructor(values) : Array.from(values);
const sideSwap = key => key.replace(/^(arm|leg|wing)([LR])/, (_, kind, side) => kind + (side === 'L' ? 'R' : 'L'));

/** A copy of `model` reflected across its XZ plane (left and right exchanged), for a donor whose
 * weapon is in the other hand. Pivots, geometry, collision shapes and node keys are reflected. */
export function mirrorModel(model) {
  const copy = structuredClone(model), seen = new Set();
  const flip = array => { if (!array || seen.has(array)) return; seen.add(array); for (let i = 1; i < array.length; i += 3) array[i] = -array[i]; };
  for (const pivot of copy.PivotPoints || []) flip(pivot);
  for (const node of allNodes(copy)) flip(node.PivotPoint);
  for (const geoset of copy.Geosets || []) {
    flip(geoset.Vertices); flip(geoset.Normals);
    for (const box of [geoset, ...(geoset.Anims || [])]) if (box.MinimumExtent && box.MaximumExtent) { const lo = box.MinimumExtent[1]; box.MinimumExtent[1] = -box.MaximumExtent[1]; box.MaximumExtent[1] = -lo; }
  }
  for (const shape of copy.CollisionShapes || []) flip(shape.Vertices);
  const quat = v => { if (v) { v[0] = -v[0]; v[2] = -v[2]; } }, vec = v => { if (v) v[1] = -v[1]; };
  for (const node of allNodes(copy)) {
    for (const key of node.Rotation?.Keys || []) { quat(key.Vector); quat(key.InTan); quat(key.OutTan); }
    for (const key of node.Translation?.Keys || []) { vec(key.Vector); vec(key.InTan); vec(key.OutTan); }
  }
  return copy;
}

/** The transplant's reading of a rig. A limb whose last joint is a still skin carrier (no keys, no joint below it) next to
 * one joint that moves ends at the moving joint instead: the Ghoul's forearm skin bone `Wrist1` (pivot parked in its
 * chest) beside its hand `Bone_Hand_R`; POSE takes the first by its name, so the forearm would point into the chest. Retargeting
 * keeps the shared reading. -> the rig itself when nothing changes, else a copy with those parts copied. */
export function transplantReading(rig, model) {
  if (!rig?.ok) return rig;
  const nodes = allNodes(model), byId = new Map(nodes.map(n => [n.ObjectId, n]));
  const isJoint = n => JOINT_KEYS.some(k => (model[k] || []).includes(n));
  const keyed = n => ['Translation', 'Rotation', 'Scaling'].some(p => n?.[p]?.Keys?.length);
  const used = new Set(Object.values(rig.parts).flatMap(part => part.joints));
  let parts = null;
  for (const [key, part] of Object.entries(rig.parts)) {
    if (part.kind !== 'limb' || part.joints.length < 2) continue;
    const end = byId.get(part.joints.at(-1)), parent = part.joints.at(-2);
    if (!end || end.Parent !== parent || keyed(end) || nodes.some(n => n.Parent === end.ObjectId && isJoint(n))) continue;
    const moving = nodes.filter(n => n.Parent === parent && n !== end && isJoint(n) && keyed(n) && !used.has(n.ObjectId));
    if (moving.length !== 1) continue;
    parts ||= { ...rig.parts };
    const copy = Object.create(Object.getPrototypeOf(part), Object.getOwnPropertyDescriptors(part));
    copy.joints = [...part.joints.slice(0, -1), moving[0].ObjectId];
    copy.marker = moving[0].ObjectId;
    parts[key] = copy;
  }
  if (!parts) return rig;
  const copy = Object.create(Object.getPrototypeOf(rig), Object.getOwnPropertyDescriptors(rig));
  copy.parts = parts;
  return copy;
}

/** The turn that lays `from` along `to` and then, about `to`, turns `side` (when given) as near `sideTo` as it can. */
function alignFrames(from, to, side = null, sideTo = null) {
  if (from.lengthSq() < 1e-12 || to.lengthSq() < 1e-12) return new Quaternion();
  const swing = arc(from, to);
  if (!side || !sideTo) return swing;
  const axis = to.clone().normalize();
  const s1 = side.clone().applyQuaternion(swing), s2 = sideTo.clone();
  s1.addScaledVector(axis, -s1.dot(axis)); s2.addScaledVector(axis, -s2.dot(axis));
  if (s1.lengthSq() < 1e-12 || s2.lengthSq() < 1e-12) return swing;
  const angle = Math.atan2(s1.clone().cross(s2).dot(axis), s1.dot(s2));
  return new Quaternion().setFromAxisAngle(axis, angle).multiply(swing);
}

/** Bind pivots of the first joints of the legs, averaged (else the body joint): the hip centre in the rest pose. */
function bindHipCentre(model, rig) {
  const byId = new Map(allNodes(model).map(n => [n.ObjectId, n])), at = id => v3(nodePivot(model, byId.get(id), id));
  const legs = Object.values(rig.parts || {}).filter(part => part.limbKind === 'leg');
  if (legs.length) return legs.map(part => at(part.joints[0])).reduce((a, b) => a.add(b), new Vector3()).divideScalar(legs.length);
  return rig.body != null ? at(rig.body) : new Vector3();
}

/** Pair one trunk part: the joint that carries `ownKey` with the joint that carries `theirKey`,
 * the joints above and below by order from there. Joints are listed from the top. */
function trunkMap(own, theirs, ownKey, theirKey) {
  const kB = Math.max(0, ownKey), kA = Math.max(0, theirKey), n = theirs.length;
  return own.map((_, i) => i === kB ? kA : i < kB ? Math.max(0, kA - (kB - i)) : Math.min(n - 1, kA + (i - kB)));
}

/** Every own track that is timed inside its animations (not on a global sequence), for refitting:
 * `{ owner, property, quaternion }` and event tracks `{ owner, event: true }`. */
function ownTimedTracks(roots) {
  const found = [];
  for (const root of roots) visitTracks(root, (track, { owner, property }) => { if (!Array.isArray(owner)) found.push({ owner, property, quaternion: property === 'Rotation' && track.Keys[0]?.Vector?.length === 4 }); }, {
    skip: ['Interval', 'Anims'],
    event(node) { found.push({ owner: node, event: true }); },
  });
  return found;
}

/** Refit the own tracks into the donor's animation list: each donor animation gets the keys of
 * the own animation of the same kind (else the own Stand), fitted to its length as the transfer
 * fits a body animation (whole loops for a looping one, stretched for one that plays once). */
function refitTracks(entries, ownSequences, globalSequences, newSequences, ownStand) {
  if (!entries.length) return;
  const holderOf = list => ({ Sequences: ownSequences, GlobalSequences: globalSequences, Nodes: list });
  const plans = newSequences.map(sequence => {
    const start = sequence.Interval[0], length = sequence.Interval[1] - sequence.Interval[0];
    let kind = sameKindSequence({ Sequences: ownSequences }, sequence.Name);
    if (kind == null || !ownSequences[kind]?.Interval) kind = ownStand;
    const own = ownSequences[kind];
    if (!own?.Interval || length <= 0) return null;
    const ownLength = own.Interval[1] - own.Interval[0];
    if (ownLength <= 0) return null;
    const looping = !own.NonLooping, rate = looping ? Math.max(1, Math.round(length / ownLength)) * ownLength / length : ownLength / length;
    // The own animation is read from a copy moved past the new one (geoset sweep): copyBodyAnimation clears the new
    // animation's time span first, so where the two share frames (a model on itself, or a donor animation lying over
    // the own one) the own keys were cleared before they were read and the track showed what no key shows.
    const shift = start + length + 1 - own.Interval[0];
    const sequences = ownSequences.map((s, i) => i === kind ? { ...s, Interval: [own.Interval[0] + shift, own.Interval[1] + shift] } : s);
    return { start, length, shift, from: own.Interval, sequences, clock: { sequence: kind, first: own.Interval[0] + shift, length: ownLength, looping, start: 0, rate, amount: 1, blend: 0 } };
  });
  const holderFor = (plan, list) => ({ ...holderOf(list), Sequences: plan.sequences });
  for (const entry of entries) {
    if (entry.event) {
      const original = entry.owner.EventTrack;
      if (isGlobalTrack(entry.owner, { GlobalSequences: globalSequences })) continue;
      const frames = [];
      for (const plan of plans) {
        if (!plan) continue;
        const copy = { EventTrack: Array.from(original).filter(f => f >= plan.from[0] && f <= plan.from[1]).map(f => f + plan.shift), GlobalSeqId: entry.owner.GlobalSeqId };
        copyBodyAnimation(holderFor(plan, [copy]), plan.clock, plan.start, plan.length);
        frames.push(...copy.EventTrack.filter(f => f >= plan.start && f <= plan.start + plan.length));
      }
      entry.owner.EventTrack = like(original, [...new Set(frames)].sort((a, b) => a - b));
      continue;
    }
    const track = entry.owner[entry.property];
    if (!track?.Keys || isGlobalTrack(track, { GlobalSequences: globalSequences })) continue;
    const keys = [], name = entry.quaternion ? 'Rotation' : 'Value';
    for (const plan of plans) {
      if (!plan) continue;
      const { Keys: _all, ...rest } = track;
      const copy = { [name]: { ...structuredClone(rest), Keys: keysInInterval(track, plan.from).map(key => ({ ...structuredClone(key), Frame: key.Frame + plan.shift })) } };
      copyBodyAnimation(holderFor(plan, [copy]), plan.clock, plan.start, plan.length);
      keys.push(...copy[name].Keys.filter(key => key.Frame >= plan.start && key.Frame <= plan.start + plan.length));
    }
    if (!keys.length && track.Keys.length) { holdTrack(entry, track, ownSequences[ownStand]?.Interval, globalSequences, newSequences); continue; }
    track.Keys = keys.sort((a, b) => a.Frame - b.Frame);
  }
}

/** Whether a key may go at an animation's start: a signed 32-bit frame and an end not before it (the Far Seer's "nothing"
 * runs from 4294967129 to 0: keys there broke the key order, KEYFRAME_ORDER, analysis-v2 class 8). */
const keyable = sequence => Number.isInteger(sequence?.Interval?.[0]) && sequence.Interval[0] >= -2147483648 && sequence.Interval[0] <= 2147483647 && sequence.Interval[1] >= sequence.Interval[0];
/** What the renderer shows for a track with no key in the playing animation (war3-model's defaults). */
const HELD = { EmissionRate: [0], Visibility: [1], Alpha: [1], Color: [1, 1, 1], Rotation: [0], Intensity: [0], AmbIntensity: [0] };
/** A refitted track that got no key in any new animation (its own animations have no counterpart in the donor's):
 * the preview reads a track's first key, so it is never left empty (failure sweep class 2). It shows what it showed
 * with no key: a node's move goes (its rest); anything else holds, in every animation, the value the renderer shows
 * where a track has no key (an effect's rate 0, a visibility, alpha or colour 1, a ribbon unseen), else its first value. */
function holdTrack(entry, track, stand, globalSequences, newSequences) {
  const { owner, property, quaternion } = entry;
  if (owner.ObjectId != null && ['Translation', 'Rotation', 'Scaling'].includes(property)) { delete owner[property]; return; }
  void stand; void globalSequences; void quaternion;
  let value = HELD[property] ?? null;
  if (property === 'Visibility' && ('HeightAbove' in owner || 'HeightBelow' in owner)) value = [0];
  const template = track.Keys[0].Vector;
  if (value == null) value = Array.from(template);
  track.LineType = 0;
  track.Keys = [...new Set(newSequences.filter(keyable).map(sequence => sequence.Interval[0]))].sort((a, b) => a - b).map(frame => ({ Frame: frame, Vector: like(template, [].concat(value)) }));
}

/** Keys in time order with no two on one frame (failure sweep class 8: a donor whose animation list is out of time
 * order, or whose animations share an interval, got per-animation keys in list order and twice). Only a track out of
 * order is touched. */
function orderKeys(M) {
  const visit = track => {
    const keys = track.Keys;
    if (!Array.isArray(keys) || keys.every((key, i) => i === 0 || key.Frame > keys[i - 1].Frame)) return;
    const list = [...keys].sort((a, b) => a.Frame - b.Frame);
    track.Keys = list.filter((key, i) => i === 0 || key.Frame !== list[i - 1].Frame);
  };
  for (const key of [...NODE_KEYS, 'GeosetAnims', 'Materials', 'TextureAnims', 'Cameras']) for (const owner of M[key] || []) visitTracks(owner, visit, { skip: ['Interval', 'Anims'] });
}

/** The weapon's vertices and attachments go back onto the hand they were baked onto (ids of the result). */
function holdWeaponOnHand(weapon, vertices, moves) {
  for (const [geoset, v, hand] of vertices) {
    const count = geoset.Vertices.length / 3, weights = geoset.SkinWeights;
    if (weights?.length >= count * 8) for (let i = 0; i < 4; i++) if (weights[v * 8 + i] === weapon && weights[v * 8 + 4 + i] > 0) weights[v * 8 + i] = hand;
    const group = geoset.Groups?.[geoset.VertexGroup?.[v]];
    if (!group) continue;
    const bones = [...new Set(Array.from(group, id => id === weapon ? hand : id))].sort((a, b) => a - b), key = bones.join(',');
    let index = geoset.Groups.findIndex(g => Array.from(g).join(',') === key);
    if (index < 0) index = geoset.Groups.push(bones) - 1;
    geoset.VertexGroup[v] = index;
    geoset.TotalGroupsCount = geoset.Groups.reduce((sum, g) => sum + g.length, 0);
  }
  for (const [node, hand] of moves) node.Parent = hand;
}

/** A matrix's inverse, or null when it has none (a node scaled to nothing) or holds a number that is not finite. */
function safeInverse(matrix) {
  if (!matrix) return null;
  const det = matrix.determinant();
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  const inverse = matrix.clone().invert();
  return inverse.elements.every(Number.isFinite) ? inverse : null;
}

/** Safety net: no vertex, normal, pivot, key or extent of the result is left not finite. A bad vertex goes back to
 * the open model's bind place, a pivot to its parent's, a node's key to rest (no move, no turn, full size), any other
 * key to the track's last good value. -> counts of what was held. */
function holdNonFinite(M, source) {
  const ok = Number.isFinite, held = { vertices: 0, pivots: 0, keys: 0 };
  (M.Geosets || []).forEach((geoset, g) => {
    for (const name of ['Vertices', 'Normals']) {
      const a = geoset[name], b = source.Geosets?.[g]?.[name];
      if (!a) continue;
      for (let i = 0; i + 2 < a.length; i += 3) {
        if (ok(a[i]) && ok(a[i + 1]) && ok(a[i + 2])) continue;
        const rest = b && ok(b[i]) && ok(b[i + 1]) && ok(b[i + 2]) ? [b[i], b[i + 1], b[i + 2]] : name === 'Normals' ? [0, 0, 1] : [0, 0, 0];
        a[i] = rest[0]; a[i + 1] = rest[1]; a[i + 2] = rest[2];
        if (name === 'Vertices') held.vertices++;
      }
    }
  });
  const nodes = allNodes(M), byId = new Map(nodes.map(node => [node.ObjectId, node]));
  const finite = v => v == null || (typeof v === 'number' ? ok(v) : Array.from(v).every(ok));
  for (const node of nodes) if (node.PivotPoint && !finite(node.PivotPoint)) {
    let rest = [0, 0, 0];
    for (let at = byId.get(node.Parent); at; at = byId.get(at.Parent)) if (finite(at.PivotPoint)) { rest = Array.from(at.PivotPoint); break; }
    node.PivotPoint = new Float32Array(rest);
    held.pivots++;
  }
  const visit = (track, { owner, property }) => {
    let last = null;
    for (const key of track.Keys) {
      if ([key.Vector, key.InTan, key.OutTan].every(finite)) { last = key.Vector; continue; }
      const size = key.Vector?.length ?? 1;
      const rest = owner?.ObjectId != null && property === 'Rotation' ? [0, 0, 0, 1] : owner?.ObjectId != null && property === 'Scaling' ? [1, 1, 1] : owner?.ObjectId != null && property === 'Translation' ? [0, 0, 0] : last ? Array.from(last) : new Array(size).fill(0);
      const template = key.Vector ?? new Float32Array(size);
      key.Vector = like(template, rest);
      if (key.InTan) key.InTan = like(template, rest);
      if (key.OutTan) key.OutTan = like(template, rest);
      last = key.Vector;
      held.keys++;
    }
  };
  for (const key of [...NODE_KEYS, 'GeosetAnims', 'Materials', 'TextureAnims', 'Cameras']) for (const owner of M[key] || []) visitTracks(owner, visit, { skip: ['Interval', 'Anims'] });
  return held;
}

/** Extents that are not finite (from motion that was not) become the bind box of the result's vertices. */
function holdExtents(M) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const geoset of M.Geosets || []) for (let i = 0; i < (geoset.Vertices?.length || 0); i++) { const c = i % 3, v = geoset.Vertices[i]; if (v < lo[c]) lo[c] = v; if (v > hi[c]) hi[c] = v; }
  if (!Number.isFinite(lo[0])) { lo.fill(0); hi.fill(0); }
  const radius = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2;
  let held = 0;
  for (const box of [...(M.Sequences || []), ...(M.Geosets || []), ...(M.Geosets || []).flatMap(geoset => geoset.Anims || [])]) {
    const bad = ['MinimumExtent', 'MaximumExtent'].some(name => box[name] && !Array.from(box[name]).every(Number.isFinite)) || (box.BoundsRadius != null && !Number.isFinite(box.BoundsRadius));
    if (!bad) continue;
    if (box.MinimumExtent) box.MinimumExtent = like(box.MinimumExtent, lo);
    if (box.MaximumExtent) box.MaximumExtent = like(box.MaximumExtent, hi);
    if (box.BoundsRadius != null) box.BoundsRadius = radius;
    held++;
  }
  return held;
}

/** Pivots within this share of the hip height count as one place (twin chains: the Ogre's second arm and the Ghoul's corpse
 * skeleton sit within 0.022; the nearest pair that is no twin, 0.044). */
const TWIN_NEAR = 0.03;
/** An own extra rides a donor chain whose top sits within this share of the hip height of its own top (class E1). */
const EXTRA_NEAR = 0.1;
/** Own skin outside the body rides a part joint (or stays still in the world) instead of the body joint when it drifts at most
 * this share as far against it as against the body joint, through the model's own everyday animations (class K1). */
const FOLLOW_SHARE = 0.75;
const DEATH_KIND = /death|decay|dissipate/i, NOT_EVERYDAY = /death|decay|dissipate|portrait/i;
/** Twin chains: own joints outside the recognised body whose pivots sit on body joints, each under its parent's twin, in
 * groups of two or more joints, whose skin shows in everyday animations and which move with their twins through the own
 * Stand (the Ogre's second left arm). A corpse skeleton (skin shown only in Death or Decay: the Ghoul's) is no twin: the
 * transplant hides it there. -> Map own joint -> body joint. */
function twinChains({ model, rigB, treeB, ownNodes, ownById, pB, partJoint, bodyAncestors }) {
  const twin = new Map();
  if (!rigB.ok) return twin;
  const isJoint = id => JOINT_KEYS.some(k => (model[k] || []).includes(ownById.get(id)));
  const inBody = id => partJoint(id) || bodyAncestors.has(id) || treeB.ancestors(id).some(partJoint);
  const ids = ownNodes.map(n => n.ObjectId).filter(isJoint);
  const body = ids.filter(inBody), near = TWIN_NEAR * rigB.hipHeight;
  const outside = ids.filter(id => !inBody(id)).sort((a, b) => treeB.ancestors(a).length - treeB.ancestors(b).length);
  const proposed = new Map();
  for (const id of outside) {
    const up = proposed.get(treeB.parentOf(id)), at = pB(id);
    let best = null, distance = Infinity;
    for (const b of body) {
      if (up != null && b !== up && !treeB.ancestors(b).includes(up)) continue;
      const d = at.distanceTo(pB(b));
      if (d < distance) { distance = d; best = b; }
    }
    if (best != null && distance <= near) proposed.set(id, best);
  }
  // Groups: a proposed joint whose parent is not proposed heads one.
  const groups = new Map();
  for (const id of proposed.keys()) {
    let head = id;
    while (proposed.has(treeB.parentOf(head))) head = treeB.parentOf(head);
    if (!groups.has(head)) groups.set(head, []);
    groups.get(head).push(id);
  }
  for (const [head, members] of groups) if (members.length < 2) groups.delete(head);
  // Skin per group: vertices under the head shown in an everyday animation.
  const sequences = model.Sequences || [], everyday = sequences.filter(s => s.Interval && !NOT_EVERYDAY.test(String(s.Name || '')));
  const shownEveryday = index => {
    const alpha = (model.GeosetAnims || []).find(item => item.GeosetId === index)?.Alpha;
    return !alpha?.Keys?.length || isGlobalTrack(alpha, model) || !everyday.length || everyday.some(sequence => sampleShows(model, alpha, sequence));
  };
  const headOf = new Map();
  for (const id of ids) { const h = treeB.ancestors(id, true).find(a => groups.has(a)); if (h != null) headOf.set(id, h); }
  const alive = new Map([...groups.keys()].map(h => [h, 0]));
  (model.Geosets || []).forEach((geoset, index) => {
    if (!shownEveryday(index)) return;
    const count = (geoset.Vertices?.length || 0) / 3, weights = geoset.SkinWeights;
    for (let v = 0; v < count; v++) {
      const bones = weights?.length >= (v + 1) * 8 ? [0, 1, 2, 3].filter(i => weights[v * 8 + 4 + i] > 0).map(i => weights[v * 8 + i]) : Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []);
      for (const h of new Set(bones.map(id => headOf.get(id)).filter(h => h != null))) alive.set(h, alive.get(h) + 1);
    }
  });
  const stand = standSequenceIndex(model), interval = sequences[stand]?.Interval;
  const movesWith = members => {
    if (!interval) return false;
    for (let k = 0; k <= 8; k++) {
      const m = sampleNodeMatrices(model, Math.round(interval[0] + k / 8 * (interval[1] - interval[0])), stand);
      for (const id of members) {
        const a = pB(id).applyMatrix4(m.get(id) || new Matrix4()), b = pB(proposed.get(id)).applyMatrix4(m.get(proposed.get(id)) || new Matrix4());
        if (!(a.distanceTo(b) <= near)) return false;
      }
    }
    return true;
  };
  for (const [head, members] of groups) if (alive.get(head) > 0 && movesWith(members)) for (const id of members) twin.set(id, proposed.get(id));
  return twin;
}
/** Whether a geoset alpha track shows anywhere in an animation. */
function sampleShows(model, track, sequence) {
  const [start, end] = sequence.Interval, frames = [start, (start + end) / 2, end, ...track.Keys.map(key => key.Frame).filter(frame => frame >= start && frame <= end)];
  return frames.some(frame => sampleTrack(track, frame, { interval: sequence.Interval, globalSequences: model.GlobalSequences, globalTime: 0, fallback: 1 }) > 0.001);
}
/** In the result's Death and Decay animations every geoset shows as the open model's animation `source` shows it (hidden
 * where it hides it throughout, else at the highest value it gives it), and nothing shows where the donor hides its body. */
function holdShowing(M, model, source, newSequences, donor) {
  if (!source?.Interval) return;
  const targets = newSequences.filter(s => DEATH_KIND.test(String(s.Name || ''))), body = donorBodyAlpha(donor);
  // Where the donor hides its own body (the Grunt's Decay Bone: its bones lie on other joints), so does this model.
  const bodyShows = (sequence, frame) => !body || sampleTrack(body, frame, { interval: sequence.Interval, globalSequences: donor.GlobalSequences, globalTime: 0, fallback: 1 }) > 0.001;
  (model.GeosetAnims || []).forEach(anim => {
    const index = anim.GeosetId, own = anim.Alpha, track = (M.GeosetAnims || []).find(item => item.GeosetId === index)?.Alpha;
    if (!own?.Keys?.length || !track?.Keys || isGlobalTrack(own, model)) return;
    const [start, end] = source.Interval, frames = [start, (start + end) / 2, end, ...own.Keys.map(key => key.Frame).filter(frame => frame >= start && frame <= end)];
    const value = Math.max(0, ...frames.map(frame => sampleTrack(own, frame, { interval: source.Interval, globalSequences: model.GlobalSequences, globalTime: 0, fallback: 1 })));
    const template = track.Keys[0]?.Vector ?? own.Keys[0].Vector;
    const key = (frame, x) => { const k = { Frame: frame, Vector: like(template, [x]) }; if (track.LineType >= 2) { k.InTan = like(template, [x]); k.OutTan = like(template, [x]); } return k; };
    for (const sequence of targets) {
      const [s0, s1] = sequence.Interval, frames = new Set([s0, s1]);
      if (body) for (const k of body.Keys) if (k.Frame > s0 && k.Frame < s1) frames.add(k.Frame);
      track.Keys = track.Keys.filter(k => k.Frame < s0 || k.Frame > s1);
      for (const frame of [...frames].sort((x, y) => x - y)) track.Keys.push(key(frame, bodyShows(sequence, frame) ? value : 0));
    }
    track.Keys.sort((x, y) => x.Frame - y.Frame);
  });
}

/** The alpha track of the donor's body: its biggest geoset shown in its Stand, when that one is keyed (else null). */
function donorBodyAlpha(D) {
  const stand = D.Sequences?.[standSequenceIndex(D)];
  let best = null, size = 0;
  (D.Geosets || []).forEach((geoset, index) => {
    const alpha = (D.GeosetAnims || []).find(item => item.GeosetId === index)?.Alpha, count = (geoset.Vertices?.length || 0) / 3;
    const keyed = alpha?.Keys?.length && !isGlobalTrack(alpha, D);
    if (keyed && stand?.Interval && !sampleShows(D, alpha, stand)) return;
    if (count > size) { size = count; best = keyed ? alpha : null; }
  });
  return best;
}

/** Donor corpse swap (xfer-overnight.md, 20 Nov 2026; the owner's Berserker on the Ghoul vanished when it died). Where a
 * donor animation of death kind hides the donor's living body (`donorBodyAlpha`) and shows a death body (its biggest
 * geoset hidden in the Stand):
 * - when the death body hangs on joints that twin the living ones (pivots within `TWIN_NEAR` hip heights, each under its
 *   parent's twin; at least `TWIN_DEATH_SHARE` of its vertices), the living joints move as their twins do in that
 *   animation (each pivot where its twin's goes, turned as it turns; keyed at the joints' own keys and wherever a
 *   straight line between keys would miss, down to 33 ms) and the
 *   living body shows where either shows;
 * - otherwise, in a Death (not Decay or Dissipate), the living body shows where either shows (it follows the living joints).
 * `D` (the engine's own copy of the donor) is changed in place. -> [{ sequence, twin, joints }] */
const TWIN_DEATH_SHARE = 0.9;
function donorDeathSwap(D, rigA) {
  const done = [], stand = standSequenceIndex(D), body = donorBodyAlpha(D);
  if (!rigA.ok || stand < 0 || !body) return done;
  const nodes = allNodes(D), byId = new Map(nodes.map(n => [n.ObjectId, n])), tree = nodeIndex(D, nodes);
  const isJoint = id => JOINT_KEYS.some(k => (D[k] || []).includes(byId.get(id)));
  const alphaOf = g => (D.GeosetAnims || []).find(item => item.GeosetId === g)?.Alpha;
  const keyed = track => track?.Keys?.length && !isGlobalTrack(track, D);
  const bonesOf = (geoset, v) => { const skin = geoset.SkinWeights; return skin?.length >= (v + 1) * 8 ? [0, 1, 2, 3].filter(i => skin[v * 8 + 4 + i] > 0).map(i => skin[v * 8 + i]) : Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []); };
  const standSequence = D.Sequences[stand];
  const living = [], deathOnly = [];
  (D.Geosets || []).forEach((geoset, g) => { const alpha = alphaOf(g); if (!keyed(alpha) || sampleShows(D, alpha, standSequence)) living.push(g); else deathOnly.push(g); });
  const livingJoints = new Set();
  for (const g of living) { const geoset = D.Geosets[g]; for (let v = 0; v < geoset.Vertices.length / 3; v++) for (const id of bonesOf(geoset, v)) for (const a of tree.ancestors(id, true)) livingJoints.add(a); }
  const pivot = id => v3(nodePivot(D, byId.get(id), id)), near = TWIN_NEAR * rigA.hipHeight;
  const show = (track, sequence, frame) => sampleTrack(track, frame, { interval: sequence.Interval, globalSequences: D.GlobalSequences, globalTime: 0, fallback: 1 });
  const hasKeys = id => ['Translation', 'Rotation', 'Scaling'].some(p => byId.get(id)?.[p]?.Keys?.length);
  D.Sequences.forEach((sequence, si) => {
    if (!sequence.Interval || !DEATH_KIND.test(String(sequence.Name || ''))) return;
    const [a, b] = sequence.Interval, probe = [a, (a + b) >> 1, b, ...body.Keys.map(k => k.Frame).filter(f => f > a && f < b)];
    if (probe.every(f => show(body, sequence, f) > 0.001)) return;
    // The death body: the biggest geoset hidden in the Stand that shows here.
    let deathGeoset = -1;
    for (const g of deathOnly) if (sampleShows(D, alphaOf(g), sequence) && (deathGeoset < 0 || D.Geosets[g].Vertices.length > D.Geosets[deathGeoset].Vertices.length)) deathGeoset = g;
    if (deathGeoset < 0) return;
    const geoset = D.Geosets[deathGeoset], count = geoset.Vertices.length / 3;
    // Its joints' twins among the living joints (a joint of the living body is its own twin).
    const corpse = new Set();
    for (let v = 0; v < count; v++) for (const id of bonesOf(geoset, v)) for (const x of tree.ancestors(id, true)) if (isJoint(x) && !livingJoints.has(x)) corpse.add(x);
    const twin = new Map(), candidates = [...livingJoints].filter(isJoint);
    for (const c of [...corpse].sort((x, y) => tree.ancestors(x).length - tree.ancestors(y).length)) {
      const parent = tree.parentOf(c), up = parent == null ? null : livingJoints.has(parent) ? parent : twin.get(parent), at = pivot(c);
      let best = null, score = Infinity;
      for (const l of candidates) {
        if (up != null && l !== up && !tree.ancestors(l).includes(up)) continue;
        const d = at.distanceTo(pivot(l));
        if (d > near) continue;
        const s = d + (up != null && tree.parentOf(l) !== up ? near : 0); // a direct child of the parent's twin first
        if (s < score) { score = s; best = l; }
      }
      if (best != null) twin.set(c, best);
    }
    let twinned = 0;
    for (let v = 0; v < count; v++) if (bonesOf(geoset, v).every(id => livingJoints.has(id) || twin.has(id))) twinned++;
    // A twin skeleton is a chain (two joints or more, as `twinChains`): one joint on a living pivot is no copy of the body.
    const isTwin = count > 0 && twin.size >= 2 && twinned >= TWIN_DEATH_SHARE * count;
    if (!isTwin && (!/death/i.test(String(sequence.Name || '')) || /decay|dissipate/i.test(String(sequence.Name || '')))) return;
    let moved = 0;
    if (isTwin && twin.size) {
      // Each living joint's world placement: its twin's where it has one, else carried by its parent (own local motion).
      const order = [...livingJoints].filter(isJoint).sort((x, y) => tree.ancestors(x).length - tree.ancestors(y).length);
      const livingTwin = new Map(); for (const [c, l] of twin) if (!livingTwin.has(l)) livingTwin.set(l, c);
      const skip = l => { const c = livingTwin.get(l); return c == null || (!hasKeys(l) && !hasKeys(c) && (tree.parentOf(l) ?? null) === (tree.parentOf(c) == null ? null : livingJoints.has(tree.parentOf(c)) ? tree.parentOf(c) : twin.get(tree.parentOf(c)) ?? -2)); };
      const global = l => ['Translation', 'Rotation', 'Scaling'].some(p => byId.get(l)?.[p]?.Keys?.length && isGlobalTrack(byId.get(l)[p], D));
      const written = order.filter(l => !skip(l) && !global(l));
      const cache = new Map();
      // The local placement (t, r, s as node keys) of every written joint at a frame.
      const localsAt = frame => {
        if (cache.has(frame)) return cache.get(frame);
        const W = sampleNodeMatrices(D, frame, si), placed = new Map(), out = new Map();
        for (const l of order) {
          const parent = tree.parentOf(l), P = parent != null && byId.has(parent) ? placed.get(parent) ?? W.get(parent) : null;
          const c = livingTwin.get(l);
          // Its pivot goes where the twin's goes (turned as the twin turns), so the joints stand exactly as the corpse's.
          if (c != null) placed.set(l, W.get(c).clone().multiply(new Matrix4().makeTranslation(pivot(c).sub(pivot(l)))));
          else placed.set(l, P ? P.clone().multiply(safeInverse(W.get(parent)) ?? new Matrix4()).multiply(W.get(l)) : W.get(l).clone());
          if (skip(l) || global(l)) continue;
          const local = (P ? safeInverse(P) ?? new Matrix4() : new Matrix4()).multiply(placed.get(l));
          const pos = new Vector3(), r = new Quaternion(), sc = new Vector3();
          local.decompose(pos, r, sc);
          const p = pivot(l);
          out.set(l, { t: pos.sub(p).add(p.clone().multiply(sc).applyQuaternion(r)), r, s: sc });
        }
        cache.set(frame, out);
        return out;
      };
      // Breakpoints, per joint: the ends and every key of its twin and its parent's twin inside; halves wherever a straight
      // line between two breakpoints misses it by more than 0.01 hip heights or a degree (down to 33 ms), as feet down does.
      const tolT = 0.01 * rigA.hipHeight, tolR = Math.PI / 180, twinOfLiving = l => livingTwin.get(l);
      const framesOf = l => {
        const ends = new Set([a, b]);
        for (const id of [twinOfLiving(l), twinOfLiving(tree.parentOf(l))]) if (id != null) for (const p of ['Translation', 'Rotation', 'Scaling']) for (const k of byId.get(id)?.[p]?.Keys || []) if (k.Frame > a && k.Frame < b) ends.add(k.Frame);
        const sorted = [...ends].sort((x, y) => x - y), frames = [sorted[0]];
        const misses = (f0, f1, f) => {
          const u = (f - f0) / (f1 - f0), p = localsAt(f0).get(l), q = localsAt(f1).get(l), x = localsAt(f).get(l);
          return x.t.distanceTo(p.t.clone().lerp(q.t, u)) > tolT || x.r.angleTo(p.r.clone().slerp(q.r, u)) > tolR || x.s.distanceTo(p.s.clone().lerp(q.s, u)) > 0.01;
        };
        const refine = (f0, f1) => {
          if (f1 - f0 <= 33 || ![0.25, 0.5, 0.75].some(share => misses(f0, f1, Math.round(f0 + (f1 - f0) * share)))) return;
          const mid = Math.round((f0 + f1) / 2);
          refine(f0, mid); frames.push(mid); refine(mid, f1);
        };
        for (let i = 1; i < sorted.length; i++) { refine(sorted[i - 1], sorted[i]); frames.push(sorted[i]); }
        return frames;
      };
      for (const l of written) {
        const node = byId.get(l), list = framesOf(l).map(frame => ({ frame, ...localsAt(frame).get(l) }));
        for (let i = 1; i < list.length; i++) if (list[i].r.dot(list[i - 1].r) < 0) list[i].r = list[i].r.clone().set(-list[i].r.x, -list[i].r.y, -list[i].r.z, -list[i].r.w);
        const scaled = node.Scaling?.Keys?.length || list.some(k => Math.abs(k.s.x - 1) + Math.abs(k.s.y - 1) + Math.abs(k.s.z - 1) > 1e-3);
        for (const [property, get, size] of [['Translation', k => k.t.toArray(), 3], ['Rotation', k => k.r.toArray(), 4], ...(scaled ? [['Scaling', k => k.s.toArray(), 3]] : [])]) {
          if (!node[property]?.Keys) node[property] = { LineType: 1, GlobalSeqId: null, Keys: [] };
          const track = node[property], type = track.LineType, template = track.Keys[0]?.Vector ?? new Float32Array(size);
          const values = list.map(get), rest = track.Keys.filter(k => k.Frame < a || k.Frame > b);
          // Tangents that make every LineType move straight between the keys (a rotation's tangent is its own value).
          const fresh = list.map((k, i) => {
            const v = values[i], key = { Frame: k.frame, Vector: like(template, v) };
            if (type >= 2) {
              if (property === 'Rotation') { key.InTan = like(template, v); key.OutTan = like(template, v); }
              else {
                const prev = values[i - 1] ?? v, next = values[i + 1] ?? v;
                key.InTan = like(template, type === 3 ? v.map((x, j) => x - (x - prev[j]) / 3) : v.map((x, j) => x - prev[j]));
                key.OutTan = like(template, type === 3 ? v.map((x, j) => x + (next[j] - x) / 3) : v.map((x, j) => next[j] - x));
              }
            }
            return key;
          });
          track.Keys = [...rest, ...fresh].sort((x, y) => x.Frame - y.Frame);
        }
        moved++;
      }
    }
    // Visibility: the living body shows where it or the death body shows.
    const death = alphaOf(deathGeoset);
    for (const g of living) {
      const alpha = alphaOf(g);
      if (!keyed(alpha)) continue;
      const frames = [...new Set([a, b, ...alpha.Keys.map(k => k.Frame), ...death.Keys.map(k => k.Frame)].filter(f => f >= a && f <= b))].sort((x, y) => x - y);
      const values = frames.map(f => Math.max(show(alpha, sequence, f), show(death, sequence, f)));
      const template = alpha.Keys[0].Vector;
      alpha.Keys = [...alpha.Keys.filter(k => k.Frame < a || k.Frame > b), ...frames.map((f, i) => { const k = { Frame: f, Vector: like(template, [values[i]]) }; if (alpha.LineType >= 2) { k.InTan = like(template, [values[i]]); k.OutTan = like(template, [values[i]]); } return k; })].sort((x, y) => x.Frame - y.Frame);
    }
    done.push({ sequence: sequence.Name, twin: isTwin, joints: moved });
  });
  if (done.length) clearTransferCache(D);
  return done;
}

/** The open model's mesh on the donor's skeleton with the donor's animations.
 * -> { model, report } where model is a new model object (the caller swaps it in as one undo
 * step) and report = { fit: 'good' | 'poor', reasons: [...], follows: share of the body skin that follows the donor,
 * still: [own part keys none of whose joints got a donor joint], notes: [...], converted: [part keys],
 * extras: [{ id, name, vertices, kept, follows: the donor joint whose chain it rides, else null }],
 * riders: [{ id, name, joint, vertices, drift, follows }] (own skin outside the body and the part joint it rides), mirrorOffer: boolean, counts: {...},
 * ownNodes: { [own ObjectId]: ObjectId in the result }, donorNodes: { [donor ObjectId]: ObjectId in the result } }.
 * `keep`: ObjectIds of own extras (their top bone, as `report.extras` lists them) whose bone stays.
 * `events`: the donor's sounds and footprints (else the model's own, fitted to the new animations).
 * `emitters`: the donor's particle effects, ribbons and lights. `mirror`: true takes the donor
 * reflected, left and right exchanged (`report.mirrorOffer` says when its weapon is in the other hand).
 * `extents` (default true): per-animation extents from the sampled motion. `legs`: 'straight' (default) keeps a
 * straight shin along the donor's knee-to-foot chord; 'folded' bends it where the donor's bends. `feet`: 'down' (default)
 * moves the body (and the donor joints that hang from nothing) up or down so the lower foot is as high above the
 * ground as the donor's, times the travel ratio (owner's pick, TEST TRANSPLANT 09); 'free' leaves the height as the keys give it.
 * In the donor's Death and Decay the model shows what its Stand shows (the living body dies; see holdShowing). */
export function transplantSkeleton(model, donor, { keep = [], events = true, emitters = false, mirror = null, extents = true, legs = 'straight', feet = 'down' } = {}) {
  // `hard`: a body not read, no animations, no pairing, too many bone groups. `notes`: said only alongside a poor fit.
  // The report's `reasons` (what the window shows under Poor fit) is built from them at the end.
  const hard = [], notes = [], keepSet = new Set(keep.map(Number));
  // ------------------------------------------------------------ read both bodies
  // A model with no bone or helper (an effect: Plague Cloud) has no skeleton: say so plainly before anything is read
  // (its joints would be undefined ids further on: "Geoset 0 references missing node NaN").
  const jointless = m => !JOINT_KEYS.some(k => (m?.[k] || []).length);
  if (jointless(donor)) throw new Error('The donor has no skeleton to transplant onto (it has no bones or helpers).');
  if (jointless(model)) throw new Error('This model has no skeleton to transplant (it has no bones or helpers).');
  const ownStand = standSequenceIndex(model);
  let rigB = transferRig(model, { sequence: ownStand >= 0 ? ownStand : undefined });
  const donorStand0 = standSequenceIndex(donor), rigA0 = transferRig(donor, { sequence: donorStand0 >= 0 ? donorStand0 : undefined });
  const mirrorOffer = !!(rigB.ok && rigA0.ok && rigA0.weaponSide && rigB.weaponSide && rigA0.weaponSide !== rigB.weaponSide);
  const reflected = mirror === true ? mirrorModel(donor) : donor;
  if (mirror === true) clearTransferCache(reflected);
  let rigA = mirror === true ? transferRig(reflected, { sequence: donorStand0 >= 0 ? donorStand0 : undefined }) : rigA0;
  // The donor's node data in this model's format (materials and versioned fields).
  const D = reflected.Version === model.Version ? structuredClone(reflected) : adaptPasteFormat(reflected, model.Version);
  // Where the donor swaps its living body for a death body, the living joints and body take the death body's part.
  const deathSwap = donorDeathSwap(D, rigA);
  if (!rigB.ok) hard.push(`The open model's body was not recognised: ${rigB.problems.join(' ')}`);
  if (!rigA.ok) hard.push(`The donor's body was not recognised: ${rigA.problems.join(' ')}`);
  if (!(D.Sequences || []).some(s => s.Interval)) hard.push('The donor has no animations.');

  const ownNodes = allNodes(model), ownById = new Map(ownNodes.map(n => [n.ObjectId, n])), treeB = nodeIndex(model, ownNodes);
  const donorNodes = allNodes(D), donorById = new Map(donorNodes.map(n => [n.ObjectId, n])), treeA = nodeIndex(D, donorNodes);
  const pB = id => v3(nodePivot(model, ownById.get(id), id)), pA = id => v3(nodePivot(D, donorById.get(id), id));
  const size = rigB.ok && rigA.ok ? rigSizeRatio(rigB, rigA) : 1;
  const hipB = rigB.ok ? bindHipCentre(model, rigB) : new Vector3(), hipA = rigA.ok ? bindHipCentre(D, rigA) : new Vector3();
  const groundB = new Vector3(hipB.x, hipB.y, 0), groundA = new Vector3(hipA.x, hipA.y, 0);

  // ------------------------------------------------------------ pairing (the engine's own)
  let entries = [];
  const whole = rigB.ok && rigA.ok ? transferWholeBody(rigB, rigA) : { parts: [], reason: null };
  if (rigB.ok && rigA.ok && ownStand >= 0 && donorStand0 >= 0 && whole.parts.length) {
    const recipe = { base: { sequence: ownStand }, length: null, sources: { d: { mirror: false } }, parts: Object.fromEntries(whole.parts.map(key => [key, { ...defaultTransferPart(rigB, key, true), source: 'd', sequence: donorStand0, match: 1, plant: false, grip: false }])) };
    try { buildTransfer(model, new Map([['d', reflected]]), recipe, { times: [0], probe: ({ entries: found }) => { entries = found; } }); }
    catch (error) { hard.push(`The bodies could not be paired: ${error.message}`); }
  }
  // From here the transplant's own reading: a limb that ends at a still skin carrier ends at the joint beside it that moves.
  rigB = transplantReading(rigB, model); rigA = transplantReading(rigA, D);
  for (const entry of entries) {
    if (rigB.parts?.[entry.own?.key]) entry.own = rigB.parts[entry.own.key];
    if (rigA.parts?.[entry.theirs?.key]) entry.theirs = rigA.parts[entry.theirs.key];
  }
  // Limbs the donor has no counterpart for (Poor fit reads `still` below).
  const ridesStill = [];
  for (const [key, part] of Object.entries(rigB.parts || {})) if (part.kind === 'limb' && !entries.some(entry => entry.key === key)) ridesStill.push(key);

  const jointTarget = new Map();   // own part joint -> donor joint id
  const pairedOwn = new Map();     // donor joint id -> own joint whose pivot it takes
  const keptOwn = new Set();       // own joints of converted limbs
  const dropped = new Set();       // donor joints of converted limbs
  const coverOf = new Map();       // dropped donor joint -> own joint that covers it
  const converted = [], transplanted = [], partOfDonor = new Map();
  for (const part of Object.values(rigA.parts || {})) for (const id of part.joints) partOfDonor.set(id, part.key);
  const ownPartOf = new Map();
  for (const part of Object.values(rigB.parts || {})) for (const id of part.joints) ownPartOf.set(id, part.key);
  const trunkEntries = entries.filter(entry => entry.own.kind === 'trunk' && entry.clipIndex === 0);
  const limbEntries = entries.filter(entry => entry.own.kind === 'limb' && entry.clipIndex === 0);
  // v2 (owner, 19 Nov 2026; skin contract 4.1): no limb is converted. Every paired limb takes the donor's own
  // joints; a donor joint no own joint takes (a hock, a forearm) sits on this model's line between its
  // neighbours and gets the skin past its plane (runs, below).
  for (const entry of limbEntries) {
    transplanted.push(entry);
    entry.own.joints.forEach((id, i) => {
      if (entry.map[i] < 0) return;
      const target = entry.theirs.joints[entry.map[i]];
      jointTarget.set(id, target);
      if (!pairedOwn.has(target)) pairedOwn.set(target, id);
    });
  }
  // Trunk: by what hangs from each joint.
  const carrier = (rig, kind) => Object.values(rig.parts || {}).find(part => part.limbKind === kind)?.anchor;
  for (const entry of trunkEntries) {
    const own = entry.own.joints, theirs = entry.theirs.joints;
    let kB = own.length - 1, kA = theirs.length - 1;
    const hangs = entry.key === 'hips' ? 'leg' : entry.key === 'chest' ? 'arm' : null;
    if (hangs) { const b = own.indexOf(carrier(rigB, hangs)), a = theirs.indexOf(carrier(rigA, hangs)); if (b >= 0 && a >= 0) { kB = b; kA = a; } }
    trunkMap(own, theirs, kB, kA).forEach((j, i) => { const target = theirs[j]; jointTarget.set(own[i], target); if (!pairedOwn.has(target) || i === kB) pairedOwn.set(target, own[i]); });
  }
  // Poor fit: how much of the body moves as the donor's same part (docs/agent-tasks/xfer-transplant-fixes.md).
  const still = Object.values(rigB.parts || {}).filter(part => !part.joints.some(id => jointTarget.has(id))).map(part => part.key);

  // ------------------------------------------------------------ own nodes: what stays, where skin goes
  const partJoint = id => ownPartOf.has(id);
  const bodyAncestors = new Set(rigB.ok && rigB.body != null ? treeB.ancestors(rigB.body) : []);
  const fallbackDonor = rigA.ok && rigA.body != null ? rigA.body : donorNodes.find(n => JOINT_KEYS.some(k => (D[k] || []).includes(n)))?.ObjectId;
  // Extras: skinned bones outside the parts that hang under a part joint, grouped by their top.
  const extraTop = new Map();
  for (const node of ownNodes) {
    if (!JOINT_KEYS.some(k => (model[k] || []).includes(node)) || partJoint(node.ObjectId)) continue;
    const line = treeB.ancestors(node.ObjectId, true), at = line.findIndex(partJoint);
    if (at > 0) extraTop.set(node.ObjectId, line[at - 1]);
  }
  const ownVertexCount = new Map(); // own bone -> vertices bound to it
  for (const geoset of model.Geosets || []) {
    const count = (geoset.Vertices?.length || 0) / 3, skin = geoset.SkinWeights;
    for (let v = 0; v < count; v++) {
      const bones = skin?.length >= (v + 1) * 8 ? [0, 1, 2, 3].filter(i => skin[v * 8 + 4 + i] > 0).map(i => skin[v * 8 + i]) : Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []);
      for (const id of new Set(bones)) ownVertexCount.set(id, (ownVertexCount.get(id) || 0) + 1);
    }
  }
  // An extra is such a group that moves by itself: some bone in it has a track (not on a global
  // sequence) whose keys hold more than one value. A still skin carrier (the SD habit of skin on a
  // bone under each turning joint) is body skin: it rides its part joint and is not listed.
  const moves = id => ['Translation', 'Rotation', 'Scaling'].some(property => {
    const track = ownById.get(id)?.[property];
    if (!track?.Keys?.length || isGlobalTrack(track, model)) return false;
    const first = track.Keys[0].Vector;
    return track.Keys.some(key => Array.from(key.Vector).some((value, i) => Math.abs(value - first[i]) > 1e-6));
  });
  const groups = new Map();
  for (const [id, top] of extraTop) { if (!groups.has(top)) groups.set(top, []); groups.get(top).push(id); }
  const extras = new Map();
  for (const [top, bones] of groups) if (bones.some(moves)) extras.set(top, { id: top, name: ownById.get(top).Name, vertices: 0, kept: keepSet.has(top), bones });
  for (const extra of extras.values()) {
    const bones = new Set(extra.bones);
    for (const geoset of model.Geosets || []) {
      const count = (geoset.Vertices?.length || 0) / 3, skin = geoset.SkinWeights;
      for (let v = 0; v < count; v++) {
        const list = skin?.length >= (v + 1) * 8 ? [0, 1, 2, 3].filter(i => skin[v * 8 + 4 + i] > 0).map(i => skin[v * 8 + i]) : Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []);
        if (list.some(id => bones.has(id))) extra.vertices++;
      }
    }
  }
  const keptExtra = id => extraTop.has(id) && extras.has(extraTop.get(id)) && keepSet.has(extraTop.get(id));
  // Own joints outside the body (a portrait background, a second skeleton) that carry skin stay still.
  const skinnedBelow = new Set();
  for (const [id, count] of ownVertexCount) if (count > 0) for (const a of treeB.ancestors(id, true)) skinnedBelow.add(a);
  const outsideKept = new Set(ownNodes.filter(n => JOINT_KEYS.some(k => (model[k] || []).includes(n)) && !partJoint(n.ObjectId) && !extraTop.has(n.ObjectId) && skinnedBelow.has(n.ObjectId) && !treeB.ancestors(n.ObjectId).some(partJoint)).map(n => n.ObjectId));
  for (const id of bodyAncestors) if (!(ownVertexCount.get(id) > 0)) outsideKept.delete(id);
  // Twin chains (docs/agent-tasks/xfer-both-ways.md, "Twin chains and how he dies"): own joints outside the body that sit
  // on body joints (a second left arm carrying the Ogre's off-hand weapon, the Ghoul's corpse skeleton). Their skin
  // goes where the twin's goes, so it moves as the twin does in every animation, instead of staying still.
  const twin = twinChains({ model, rigB, treeB, ownNodes, ownById, pB, partJoint, bodyAncestors });
  for (const id of [...outsideKept]) if (treeB.ancestors(id, true).some(a => twin.has(a))) outsideKept.delete(id);
  // Own skin outside the body (owner, 19 Nov 2026: "A TRANSPLANT IS 100% A TRANSPLANT"; overnight class K1): an outside
  // joint whose skin shows in an everyday animation (a staff, wheels, the Corrupted Ent's body) rides the part joint it
  // follows best through the model's own everyday animations (the body joint when none follows it better), held where the
  // model's reference pose holds it against that joint (as an extra is), instead of staying still in the world while the
  // donor's body moves away. One the donor has too (same name, same place) takes the donor's joint (below). Skin shown in
  // no everyday animation (a corpse, a portrait plane) stays as before. -> own outside joint -> own part joint.
  const rideOf = new Map(), ridersOut = [], outsideShown = new Set();
  // An outside joint stays only where skin that stays (not riding, not on a donor joint) hangs from it.
  const trimOutside = (away = id => rideOf.has(id)) => {
    const staying = new Set();
    for (const [id, count] of ownVertexCount) if (count > 0 && outsideKept.has(id) && !away(id)) for (const a of treeB.ancestors(id, true)) staying.add(a);
    for (const id of [...outsideKept]) if (!staying.has(id)) outsideKept.delete(id);
  };
  if (rigB.ok && outsideKept.size) {
    const hidden = corpseAndBackgroundGeosets(model), skinOf = new Map(), geosetsOf = new Map();
    (model.Geosets || []).forEach((geoset, index) => {
      if (hidden.has(index)) return;
      const count = (geoset.Vertices?.length || 0) / 3, skin = geoset.SkinWeights;
      for (let v = 0; v < count; v++) {
        const bones = skin?.length >= (v + 1) * 8 ? [0, 1, 2, 3].filter(i => skin[v * 8 + 4 + i] > 0).map(i => skin[v * 8 + i]) : Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []);
        for (const id of new Set(bones)) if (outsideKept.has(id)) {
          if (!skinOf.has(id)) { skinOf.set(id, []); geosetsOf.set(id, new Set()); }
          skinOf.get(id).push(v3(geoset.Vertices.subarray(v * 3, v * 3 + 3))); geosetsOf.get(id).add(index); outsideShown.add(id);
        }
      }
    });
    // Samples: the reference moment, then nine moments of the Stand and of the first everyday animation of each other kind
    // (six kinds at most); each joint is judged where its skin shows (the Grunt's berserk body shows only in Spell).
    const sequences = model.Sequences || [], ref = rigB.reference, kinds = new Map();
    const kindOf = sequence => String(sequence.Name || '').trim().split(/[\s\-_]+/)[0].toLowerCase();
    if (sequences[ownStand]?.Interval) kinds.set(kindOf(sequences[ownStand]), ownStand);
    sequences.forEach((sequence, index) => { if (sequence.Interval && !NOT_EVERYDAY.test(String(sequence.Name || '')) && !kinds.has(kindOf(sequence)) && kinds.size < 6) kinds.set(kindOf(sequence), index); });
    const frames = skinOf.size ? [[ref.frame, ref.sequence], ...[...kinds.values()].flatMap(index => { const [a, b] = sequences[index].Interval; return Array.from({ length: 9 }, (_, k) => [Math.round(a + k / 8 * (b - a)), index]); })] : [];
    const sampled = frames.map(([frame, sequence]) => {
      const options = { interval: sequences[sequence]?.Interval, globalSequences: model.GlobalSequences, globalTime: 0, fallback: 1 };
      const shows = new Set((model.Geosets || []).map((_, index) => index).filter(index => { const alpha = (model.GeosetAnims || []).find(item => item.GeosetId === index)?.Alpha; return !alpha?.Keys?.length || sampleTrack(alpha, frame, options) > 0.001; }));
      return { m: sampleNodeMatrices(model, frame, sequence), shows };
    });
    const parts = [...ownPartOf.keys()].sort((a, b) => treeB.depth(a) - treeB.depth(b) || a - b);
    /** How far the skin drifts against a joint where it shows: its centre and its farthest vertex, in the joint's frame. */
    const drift = (id, joint, probe, samples) => {
      let worst = 0, first = null;
      for (const { m } of samples) {
        const back = safeInverse(m.get(joint) || new Matrix4()), own = m.get(id) || new Matrix4();
        if (!back) return Infinity;
        const local = probe.map(p => p.clone().applyMatrix4(own).applyMatrix4(back));
        if (local.some(p => !Number.isFinite(p.x + p.y + p.z))) return Infinity;
        if (!first) { first = local; continue; }
        for (let i = 0; i < local.length; i++) worst = Math.max(worst, local[i].distanceTo(first[i]));
      }
      return worst;
    };
    for (const [id, points] of skinOf) {
      const centre = points.reduce((s, p) => s.add(p), new Vector3()).divideScalar(points.length);
      const probe = [centre, points.reduce((far, p) => p.distanceTo(centre) > far.distanceTo(centre) ? p : far, centre)];
      // Where it shows and is not scaled to nothing.
      let samples = sampled.filter(({ m, shows }) => [...geosetsOf.get(id)].some(index => shows.has(index)) && Math.abs((m.get(id) || new Matrix4()).determinant()) > 1e-9);
      if (samples.length < 2) samples = sampled;
      // The body joint, unless the world (staying still, as a hero glow on the ground does) or another part joint holds it
      // clearly better: it drifts at most FOLLOW_SHARE as far against it (the Orc Warlock's staff slides and turns in his
      // left hand, 1.25 hip heights against 2.10 against his body). Pieces that follow nothing (a second form shown in one
      // animation) go with the body.
      const WORLD = -1, body = rigB.body ?? parts[0];
      if (body == null) continue;
      const bodyDrift = drift(id, body, probe, samples);
      let joint = body, least = bodyDrift;
      for (const at of [WORLD, ...parts.filter(at => at !== body)]) { const d = drift(id, at, probe, samples); if (d <= FOLLOW_SHARE * bodyDrift && d < least - 1e-6 * rigB.hipHeight) { least = d; joint = at; } }
      if (joint === WORLD) continue;
      rideOf.set(id, joint);
      ridersOut.push({ id, name: ownById.get(id)?.Name, joint: ownById.get(joint)?.Name, vertices: points.length, drift: Number.isFinite(least) ? least / rigB.hipHeight : null });
    }
    trimOutside();
  }
  // Own extras riding the donor's matching chain (class E1, filled once the donor's joints are placed, below):
  // own extra bone -> donor joint.
  const extraMatch = new Map();
  // Where an own bone's skin goes: a donor joint ({ donor }) or a joint that stays ({ own }); `via` is the
  // own part joint whose place the target takes (null for a joint that keeps its own place).
  const resolved = new Map();
  // A joint met again while its own target is being found (the Undead Car's master root rides its hips, and the hips'
  // anchor is the master root: "Maximum call stack size exceeded") is read as the joints above it place it, not riding.
  const resolving = new Set();
  const targetOf = id => {
    if (resolved.has(id)) return resolved.get(id);
    const again = resolving.has(id);
    resolving.add(id);
    try { return findTarget(id, again); } finally { if (!again) resolving.delete(id); }
  };
  const findTarget = (id, again) => {
    let result;
    if (again) {
      // As a joint outside every part is placed (below), from the nearest joint above it not being resolved; not cached.
      let up = treeB.ancestors(id).find(a => !resolving.has(a) && (partJoint(a) || keptOwn.has(a) || outsideKept.has(a) || twin.has(a) || extraMatch.has(a) || rideOf.has(a)));
      if (up != null && twin.has(up) && !resolving.has(twin.get(up))) up = twin.get(up);
      result = up != null ? { ...targetOf(up), via: extraMatch.has(up) ? null : rideOf.has(up) ? rideOf.get(up) : up } : { donor: fallbackDonor, via: null };
      return result.own != null ? { own: result.own, via: null } : result;
    }
    if (extraMatch.has(id)) result = { donor: extraMatch.get(id), via: null };
    else if (rideOf.has(id)) result = { ...targetOf(rideOf.get(id)), via: rideOf.get(id) };
    else if (keptOwn.has(id) || keptExtra(id) || outsideKept.has(id)) result = { own: id, via: null };
    else if (twin.has(id)) result = targetOf(twin.get(id));
    else if (jointTarget.has(id)) result = { donor: jointTarget.get(id), via: id };
    else if (ownPartOf.has(id)) { const part = rigB.parts[ownPartOf.get(id)], anchor = part.anchor ?? treeB.parentOf(part.joints[0]); result = anchor != null ? { ...targetOf(anchor), via: anchor } : { donor: fallbackDonor, via: null }; }
    else {
      let up = treeB.ancestors(id).find(a => partJoint(a) || keptOwn.has(a) || outsideKept.has(a) || twin.has(a) || extraMatch.has(a) || rideOf.has(a));
      if (up != null && twin.has(up)) up = twin.get(up);
      result = up != null ? { ...targetOf(up), via: extraMatch.has(up) ? null : rideOf.has(up) ? rideOf.get(up) : up } : { donor: fallbackDonor, via: null };
    }
    if (result.own != null) result = { own: result.own, via: null };
    resolved.set(id, result);
    return result;
  };
  // The share of the body skin that follows: skin whose bone hangs under a joint of a part that got a donor joint, weighted
  // as the file binds it (HD: each bone's weight; classic: equal shares of a group). Skin that keeps its own bone is not counted.
  let counted = 0, following = 0;
  if (rigB.ok && rigA.ok) for (const geoset of model.Geosets || []) {
    const count = (geoset.Vertices?.length || 0) / 3, skin = geoset.SkinWeights;
    for (let v = 0; v < count; v++) {
      const hd = skin?.length >= (v + 1) * 8, group = hd ? null : Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []);
      const bound = hd ? [0, 1, 2, 3].filter(i => skin[v * 8 + 4 + i] > 0).map(i => [skin[v * 8 + i], skin[v * 8 + 4 + i] / 255]) : group.map(id => [id, 1 / group.length]);
      for (const [id, w] of bound) {
        if (targetOf(id).own != null) continue;
        const joint = treeB.ancestors(id, true).find(partJoint);
        if (joint == null) continue;
        counted += w;
        if (!still.includes(ownPartOf.get(joint))) following += w;
      }
    }
  }
  const follows = rigB.ok && rigA.ok && counted > 0 ? following / counted : 0;

  const offset = Math.max(-1, ...ownNodes.map(n => n.ObjectId)) + 1, newId = id => id + offset;
  const skinTarget = id => { const t = targetOf(id); return t.own != null ? t.own : newId(t.donor); };
  const viaOf = id => targetOf(id).via;

  // ------------------------------------------------------------ donor nodes kept, and where they sit
  const keepDonor = new Set();
  for (const node of donorNodes) {
    const isJoint = JOINT_KEYS.some(k => (D[k] || []).includes(node));
    if (isJoint) { if (!dropped.has(node.ObjectId)) keepDonor.add(node.ObjectId); }
    else if ((D.Attachments || []).includes(node)) keepDonor.add(node.ObjectId);
    else if ((D.EventObjects || []).includes(node)) { if (events) keepDonor.add(node.ObjectId); }
    else if (EFFECT_KEYS.some(k => (D[k] || []).includes(node))) { if (emitters) keepDonor.add(node.ObjectId); }
  }
  // The node a donor node hangs from in the result: its own parent, the nearest kept one above it, or for a
  // joint of a converted limb the open model's joint that covers it.
  const donorParent = id => {
    for (let parent = treeA.parentOf(id); parent != null; parent = treeA.parentOf(parent)) {
      if (dropped.has(parent)) return { own: coverOf.get(parent), from: parent };
      if (keepDonor.has(parent)) return { donor: parent };
    }
    return null;
  };
  const isDonorJoint = id => JOINT_KEYS.some(k => (D[k] || []).includes(donorById.get(id)));

  // ------------------------------------------------------------ the weapon (v2, owner 19 Nov 2026)
  // The model's weapon is every extra on its weapon hand and the extra its own weapon attachment hangs from.
  // It rides the donor's weapon bone (the joint the donor's weapon attachment hangs from; else the donor's
  // weapon hand), placed where the model holds it at the result's reference moment, so it swings and is
  // thrown off as the donor's weapon is. A weapon bone on the donor's other arm (no mirror taken), or on no hand, is not
  // used: the weapon then stays on the hand it pairs with. The donor's weapon attachments hang from the bone
  // that carries the weapon, where the model's own weapon attachment sits on it.
  const isWeaponPoint = node => /weapon/i.test(node?.Name || '');
  const ownWeaponHand = Object.values(rigB.parts || {}).find(part => part.weapon)?.marker ?? null;
  const ownWeaponPoints = (model.Attachments || []).filter(isWeaponPoint);
  const extraOf = id => { for (const at of treeB.ancestors(id, true)) if (extras.has(at)) return at; return null; };
  const weaponExtras = new Set();
  for (const extra of extras.values()) if (ownWeaponHand != null && targetOf(extra.id).via === ownWeaponHand) weaponExtras.add(extra.id);
  for (const point of ownWeaponPoints) { const top = point.Parent != null ? extraOf(point.Parent) : null; if (top != null) weaponExtras.add(top); }
  const weaponVia = [...weaponExtras].map(id => targetOf(id).via).find(id => id != null) ?? ownWeaponHand;
  // Vertices of the donor's own skin per donor node.
  const donorSkin = new Map();
  for (const geoset of D.Geosets || []) {
    const count = (geoset.Vertices?.length || 0) / 3, weights = geoset.SkinWeights;
    for (let v = 0; v < count; v++) {
      const bones = weights?.length >= count * 8 ? [0, 1, 2, 3].filter(i => weights[v * 8 + 4 + i] > 0).map(i => weights[v * 8 + i]) : Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []);
      for (const id of new Set(bones)) donorSkin.set(id, (donorSkin.get(id) || 0) + 1);
    }
  }
  // A donor weapon bone that the donor scales to nothing (failure sweep classes 3 and 5). Only the bones between it and
  // the hand count (the weapon bone and those above it the hand does not hang from): where the whole body goes, the
  // weapon goes with it. Such a bone is not the weapon bone when it is scaled to nothing at the reference moment (the
  // first frame of the Stand), or carries no donor skin and is scaled to nothing in most animations (a hidden spare,
  // the Khorne knight's Axe). Else it is, and in the result it keeps its reference size where the donor hides it: the
  // weapon stays with the hand there.
  const donorStandD = standSequenceIndex(D), donorIntervals = (D.Sequences || []).map((s, i) => s.Interval ? i : -1).filter(i => i >= 0);
  const scaleAt = (id, sequence) => {
    const track = donorById.get(id)?.Scaling, interval = D.Sequences?.[sequence]?.Interval;
    if (!track?.Keys?.length || !interval || isGlobalTrack(track, D)) return [1, 1, 1];
    return sampleTrack(track, interval[0], { interval, globalSequences: D.GlobalSequences, fallback: [1, 1, 1] });
  };
  const collapsed = value => Array.from(value).some(x => Math.abs(x) < 1e-3);
  const weaponUse = (bone, hand) => {
    const handLine = new Set(hand != null ? treeA.ancestors(hand, true) : []);
    const chain = treeA.ancestors(bone, true).filter(id => !handLine.has(id)).filter(id => {
      const track = donorById.get(id)?.Scaling;
      return track?.Keys?.length && !isGlobalTrack(track, D) && track.Keys.some(key => collapsed(key.Vector));
    });
    if (!chain.length) return { ok: true, chain };
    if (donorStandD >= 0 && chain.some(id => collapsed(scaleAt(id, donorStandD)))) return { ok: false };
    const skinned = [...donorSkin].some(([id, count]) => count > 0 && treeA.ancestors(id, true).includes(bone));
    const hidden = donorIntervals.filter(i => chain.some(id => collapsed(scaleAt(id, i)))).length;
    if (!skinned && hidden * 2 > donorIntervals.length) return { ok: false };
    return { ok: true, chain };
  };
  const decollapse = new Map(); // donor node -> its scale at the reference moment, for keys that scale it to nothing
  let donorWeapon = null, weaponSkip = null, weaponChain = [];
  {
    const point = (D.Attachments || []).find(node => isWeaponPoint(node) && node.Parent != null && node.Parent !== -1);
    const handTarget = weaponVia != null ? targetOf(weaponVia) : null, handId = handTarget?.donor ?? null;
    let bone = point ? treeA.ancestors(point.ObjectId).find(id => isDonorJoint(id)) ?? null : null, use = null;
    const check = id => {
      if (id == null || handId == null) return id;
      const result = weaponUse(id, handId);
      if (!result.ok) { weaponSkip = `The donor hides its weapon bone (${donorById.get(id)?.Name}): the weapon stays in the hand.`; return null; }
      use = result;
      return id;
    };
    bone = check(bone);
    if (bone == null) bone = check(Object.values(rigA.parts || {}).find(part => part.weapon)?.marker ?? null);
    if (bone != null && (!keepDonor.has(bone) || !isDonorJoint(bone))) bone = null;
    weaponChain = bone != null && use ? use.chain : [];
    const ownArm = weaponVia != null ? ownPartOf.get(weaponVia) : null;
    const pairedArm = ownArm != null ? limbEntries.find(entry => entry.key === ownArm)?.theirs.key ?? null : null;
    // The first part joint at or above the bone decides: an arm's hand (the bone is the hand or hangs below it) gives that
    // arm; any other part joint (a head, a leg, the body, a forearm: Gargoyle, Kodo, the dragons' Bone_Head, the Frog's
    // leg, the Dire Wolf's body) is no hand, and the weapon stays in the hand. A bone under no part joint (a weapon root the
    // donor moves by itself, the Tauren's totem) is used as it is.
    const partAbove = id => treeA.ancestors(id, true).find(a => partOfDonor.has(a)) ?? null;
    const armOf = id => { const at = partAbove(id), key = at != null ? partOfDonor.get(at) : null; return key != null && rigA.parts[key]?.limbKind === 'arm' ? key : null; };
    // A hand bone beside the arm's last joint (the Ghoul's Bone_Hand_L hangs from its forearm next to Wrist2) is a hand too.
    const onHand = id => { const at = partAbove(id), part = at != null ? rigA.parts[partOfDonor.get(at)] : null; return at == null || part?.limbKind === 'arm' && (part.marker === at || id !== at && part.joints.at(-2) === at); };
    if (bone != null && handTarget) {
      const arm = armOf(bone);
      if (!onHand(bone)) weaponSkip = `The donor's weapon bone (${donorById.get(bone)?.Name}) is not on a hand: the weapon stays in the hand.`;
      else if (arm != null && arm !== pairedArm) weaponSkip = `The donor's weapon bone is on its other arm: the weapon stays in the hand${mirrorOffer && mirror !== true ? ' (mirroring moves it to the weapon hand)' : ''}.`;
      else donorWeapon = bone;
    }
  }
  // Where the weapon's skin goes: the donor's weapon bone, else (unchanged) the hand it pairs with.
  const weaponRides = donorWeapon != null && weaponExtras.size > 0 && [...weaponExtras].some(id => !keepSet.has(id));
  if (weaponRides) for (const id of weaponChain) decollapse.set(id, Array.from(scaleAt(id, donorStandD >= 0 ? donorStandD : donorIntervals[0])));

  const placed = new Map(), correction = new Map();
  const offsetJoint = new Map(); // donor joint placed at the donor's offset from this joint above it (no own counterpart)
  const byDepth = [...keepDonor].sort((a, b) => treeA.depth(a) - treeA.depth(b));
  // Paired joints first, then the rest from the top.
  for (const [donorId, ownId] of pairedOwn) if (keepDonor.has(donorId)) placed.set(donorId, pB(ownId));
  const pairedBelow = id => { const found = []; const walk = at => { for (const child of treeA.children.get(at) || []) { if (!keepDonor.has(child.ObjectId)) continue; if (pairedOwn.has(child.ObjectId)) found.push(child.ObjectId); else walk(child.ObjectId); } }; walk(id); return found; };
  const placeFrom = (anchorPlace, anchorDonor, id, turn = null) => { const offset = pA(id).sub(pA(anchorDonor)).multiplyScalar(size); return anchorPlace.clone().add(turn ? offset.applyQuaternion(inv(turn)) : offset); };
  // A donor joint can hang from a node that is not a joint (the Hermit Crab's root hangs from its Origin Ref): that
  // node is placed first, from its own parent as the other nodes are (failure sweep class 4).
  const ensurePlaced = id => {
    if (placed.has(id)) return;
    if (isDonorJoint(id)) { placeJoint(id); return; }
    const parent = donorParent(id);
    if (parent?.own != null) placed.set(id, placeFrom(pB(parent.own), parent.from, id));
    else if (parent?.donor != null) { ensurePlaced(parent.donor); placed.set(id, placeFrom(placed.get(parent.donor), parent.donor, id)); }
    else placed.set(id, groundB.clone().add(pA(id).sub(groundA).multiplyScalar(size)));
  };
  const placeJoint = id => {
    if (placed.has(id)) return;
    const parent = donorParent(id);
    const below = pairedBelow(id);
    if (parent?.own != null) { placed.set(id, placeFrom(pB(parent.own), parent.from, id)); return; }
    const ancestor = parent?.donor;
    if (ancestor != null) ensurePlaced(ancestor);
    if (ancestor != null && below.length === 1) {
      // On this model's line between the joint above and the paired joint below, at the donor's share of that path.
      const q = below[0], path = [q]; for (let at = treeA.parentOf(q); at != null && at !== id; at = treeA.parentOf(at)) path.unshift(at);
      const pts = [pA(id), ...path.map(pA)]; let after = 0; for (let i = 1; i < pts.length; i++) after += pts[i].distanceTo(pts[i - 1]);
      const before = pA(ancestor).distanceTo(pA(id)), f = before + after > 1e-6 ? before / (before + after) : 0;
      placed.set(id, placed.get(ancestor).clone().lerp(placed.get(q), f));
      return;
    }
    if (ancestor != null) { placed.set(id, placeFrom(placed.get(ancestor), ancestor, id)); offsetJoint.set(id, ancestor); return; }
    if (below.length) {
      const same = below.find(q => partOfDonor.get(q) != null && partOfDonor.get(q) === partOfDonor.get(id)) ?? below.sort((a, b) => treeA.depth(a) - treeA.depth(b))[0];
      placed.set(id, placeFrom(placed.get(same), same, id));
      return;
    }
    placed.set(id, groundB.clone().add(pA(id).sub(groundA).multiplyScalar(size)));
  };
  for (const id of byDepth) if (isDonorJoint(id)) placeJoint(id);
  // Extras on the donor's matching chain (owner, 19 Nov 2026: "A TRANSPLANT IS 100% A TRANSPLANT"; overnight class E1):
  // an own extra (hair, a cape, a tail, a jaw, claws) whose donor counterpart hangs from the same part with its top where
  // this extra's is (EXTRA_NEAR of the hip height, in the result's placement) rides that chain: its bones take the donor
  // joints depth by depth (each child the donor child whose offset is nearest its own), which sit on this model's pivots,
  // so the donor's keys move it. Unpaired bones below ride the nearest paired one. With no such chain the extra rides its
  // part joint, held as the model's reference pose holds it (as before); one in `keep` keeps its bone.
  if (rigA.ok && rigB.ok && (extras.size || outsideShown.size)) {
    const donorMoves = id => ['Translation', 'Rotation', 'Scaling'].some(property => {
      const track = donorById.get(id)?.[property];
      if (!track?.Keys?.length || isGlobalTrack(track, D)) return false;
      const first = track.Keys[0].Vector;
      return track.Keys.some(key => Array.from(key.Vector).some((value, i) => Math.abs(value - first[i]) > 1e-6));
    });
    const free = id => isDonorJoint(id) && keepDonor.has(id) && !partOfDonor.has(id) && placed.has(id);
    const donorTops = new Map(); // donor chain top -> its part joint
    for (const node of donorNodes) {
      const id = node.ObjectId;
      if (!free(id)) continue;
      const line = treeA.ancestors(id, true), at = line.findIndex(a => partOfDonor.has(a));
      if (at === 1) donorTops.set(id, line[1]);
    }
    const chainMoves = top => { const walk = id => donorMoves(id) || (treeA.children.get(id) || []).some(child => free(child.ObjectId) && walk(child.ObjectId)); return walk(top); };
    // A chain with a part joint below it is body, not an extra (the Gryphon Rider's front carries its front legs, the Wyvern
    // Rider's its rider): left alone, so no body joint moves. The donor's weapon is the weapon's, no extra's.
    const holdsPart = (tree, isPart, top) => { const walk = id => (tree.children.get(id) || []).some(child => isPart(child.ObjectId) || walk(child.ObjectId)); return walk(top); };
    for (const top of [...donorTops.keys()]) if (!chainMoves(top) || holdsPart(treeA, id => partOfDonor.has(id), top) || donorWeapon != null && treeA.ancestors(donorWeapon, true).includes(top)) donorTops.delete(top);
    const used = new Set(), near = EXTRA_NEAR * rigB.hipHeight;
    const offsetOf = (id, parent) => pA(id).sub(pA(parent)).multiplyScalar(size);
    const pair = (own, theirs) => {
      extraMatch.set(own, theirs); used.add(theirs);
      for (const child of treeB.children.get(own) || []) {
        const id = child.ObjectId;
        if (!extraTop.has(id) || !JOINT_KEYS.some(k => (model[k] || []).includes(child))) continue;
        const mine = pB(id).sub(pB(own)), reach = Math.max(near, 0.5 * mine.length());
        let best = null, distance = Infinity;
        for (const other of treeA.children.get(theirs) || []) {
          if (!free(other.ObjectId) || used.has(other.ObjectId)) continue;
          const d = offsetOf(other.ObjectId, theirs).distanceTo(mine);
          if (d < distance) { distance = d; best = other.ObjectId; }
        }
        if (best != null && distance <= reach) pair(id, best);
      }
    };
    const candidates = [];
    for (const extra of extras.values()) {
      if (extra.kept || weaponExtras.has(extra.id) || holdsPart(treeB, partJoint, extra.id)) continue;
      const anchor = treeB.parentOf(extra.id), target = anchor != null ? targetOf(anchor).donor : null;
      if (target == null || !partOfDonor.has(target)) continue;
      for (const [top, joint] of donorTops) {
        if (partOfDonor.get(joint) !== partOfDonor.get(target)) continue;
        const d = placed.get(top).distanceTo(pB(extra.id));
        if (d <= near) candidates.push({ own: extra.id, top, d });
      }
    }
    candidates.sort((a, b) => a.d - b.d || a.own - b.own || a.top - b.top);
    for (const { own, top } of candidates) if (!extraMatch.has(own) && !used.has(top)) pair(own, top);
    // Outside joints the donor has too (same name, same place: a family's second skeleton or wheels) take the donor's.
    const plain = name => String(name ?? '').trim().toLowerCase(), outside = new Map();
    for (const node of donorNodes) {
      const id = node.ObjectId;
      if (!free(id) || used.has(id) || treeA.ancestors(id).some(a => partOfDonor.has(a))) continue;
      if (!outside.has(plain(node.Name))) outside.set(plain(node.Name), []);
      outside.get(plain(node.Name)).push(id);
    }
    for (const id of [...outsideShown].sort((a, b) => treeB.depth(a) - treeB.depth(b) || a - b)) {
      let best = null, distance = TWIN_NEAR * rigB.hipHeight;
      for (const other of outside.get(plain(ownById.get(id)?.Name)) || []) { const d = placed.get(other).distanceTo(pB(id)); if (!used.has(other) && d <= distance) { distance = d; best = other; } }
      if (best != null) { extraMatch.set(id, best); used.add(best); }
    }
    trimOutside(id => rideOf.has(id) || extraMatch.has(id));
    if (extraMatch.size) {
      // The donor's chain joints sit on this model's pivots; the joints below them, at the donor's offsets from there.
      const moved = new Set();
      for (const [own, theirs] of extraMatch) { placed.set(theirs, pB(own)); offsetJoint.delete(theirs); moved.add(theirs); }
      for (const id of byDepth) {
        if (moved.has(id) || !placed.has(id) || !isDonorJoint(id) || partOfDonor.has(id) || pairedOwn.has(id)) continue;
        const parent = treeA.parentOf(id);
        if (parent != null && moved.has(parent)) { placed.set(id, placeFrom(placed.get(parent), parent, id)); moved.add(id); }
      }
      resolved.clear();
    }
  }
  // Runs (skin contract 4.2): donor joints placed on this model's line between two paired joints.
  const donorPartJoints = new Set(partOfDonor.keys()), ownPartJoints = new Set(ownPartOf.keys());
  const runs = rigB.ok && rigA.ok ? transplantRuns({ donorPartJoints, ownPartJoints, pairedOwn, isDonorJoint: id => isDonorJoint(id) && keepDonor.has(id), treeA, treeB, pA, pB, minLength: 1e-3 * rigB.hipHeight }) : [];
  // A run inside the trunk (a neck or collar the model lacks, in its chest) reaches half way from its line to the nearest
  // other limb's top (where its own line starts: the shoulder, not a collar): since the posture is the donor's, the neck
  // turns away from the chest at rest, and shoulder skin on it would go along.
  // The trunk posture (below) is read only where the donor has a trunk line: legs to stand on and two arms (hip centre to
  // shoulder centre). A donor with no legs (a snake, a ghost) or no arms keeps this model's trunk, as before.
  const count = (rig, kind) => Object.values(rig.parts || {}).filter(part => part.limbKind === kind).length;
  const bipeds = rigA.ok && rigB.ok && count(rigA, 'leg') >= 2 && count(rigA, 'arm') >= 2;
  const ownLimbRoots = Object.values(rigB.parts || {}).filter(part => part.kind === 'limb').map(part => part.line?.find(id => part.joints.includes(id)) ?? part.joints[0]);
  for (const run of rigA.ok && rigB.ok ? runs : []) {
    if (rigB.parts[ownPartOf.get(run.host)]?.kind !== 'trunk') continue;
    const end = pairedOwn.get(run.q), axis = run.end.clone().sub(run.start), length = axis.lengthSq();
    const toLine = p => { const t = length > 1e-12 ? Math.min(1, Math.max(0, p.clone().sub(run.start).dot(axis) / length)) : 0; return p.distanceTo(run.start.clone().addScaledVector(axis, t)); };
    const others = ownLimbRoots.filter(id => id !== end && !treeB.ancestors(end).includes(id) && !treeB.ancestors(id).includes(end)).map(id => toLine(pB(id)));
    if (others.length) run.radius = 0.5 * Math.min(...others);
  }
  const runsByHost = new Map();
  for (const run of runs) { if (!runsByHost.has(run.host)) runsByHost.set(run.host, []); runsByHost.get(run.host).push(run); }
  const isLeg = id => rigA.parts[partOfDonor.get(id)]?.limbKind === 'leg';
  // Legs (owner's pick, 19 Nov 2026: straight shin, TEST TRANSPLANT 07): the joints of a leg run point along the
  // donor's chord over the run, so this model's shin stays straight at rest. `legs: 'folded'` points each
  // stretch as the donor's instead (the shin folds at the hock; contract rule A, TEST TRANSPLANT 06).
  const chordOf = new Map();
  if (legs !== 'folded') for (const run of runs) if (isLeg(run.q)) { const chord = pA(run.q).sub(pA(run.a)); for (const id of run.seq) chordOf.set(id, chord); }
  // Corrections: each transplanted limb joint turns this model's stretch onto the donor's; a leg's end joint
  // (the foot) is not corrected, so its world turn is the donor's (contract 4.5).
  for (const entry of transplanted) {
    const joints = entry.theirs.joints;
    let previous = new Quaternion();
    joints.forEach((id, j) => {
      const next = joints[j + 1];
      let turn = previous;
      if (next == null && entry.own.limbKind === 'leg') turn = new Quaternion();
      else if (next != null && placed.has(id) && placed.has(next)) {
        const mine = placed.get(next).clone().sub(placed.get(id)), theirs = chordOf.get(id)?.clone() ?? pA(next).sub(pA(id));
        if (mine.length() > 1e-3 * rigB.hipHeight && theirs.length() > 1e-3 * rigA.hipHeight) turn = arc(mine, theirs);
      }
      correction.set(id, turn.clone()); previous = turn;
    });
  }
  // The body's travel (position keys outside transplanted limbs, MoveSpeed): by the fitted legs (contract 4.5).
  const legStretches = transplanted.filter(entry => entry.own.limbKind === 'leg').map(entry => {
    const joints = entry.theirs.joints.filter(id => placed.has(id)), own = [], theirs = [], along = [];
    for (let j = 0; j + 1 < joints.length; j++) { own.push(placed.get(joints[j + 1]).clone().sub(placed.get(joints[j]))); theirs.push(pA(joints[j + 1]).sub(pA(joints[j]))); along.push(chordOf.get(joints[j]) ?? theirs[j]); }
    return { own, donor: theirs, along };
  });
  const travel = rigB.ok && rigA.ok && rigB.hipMeasured && rigA.hipMeasured ? legTravelRatio(legStretches, size, 1e-3 * rigA.hipHeight) : size;
  const limbCorrected = new Set(correction.keys());
  // Posture (owner, 19 Nov 2026: "A TRANSPLANT IS 100% A TRANSPLANT"): the trunk takes the donor's posture too, read
  // between landmarks, not between trunk pivots (riggers put a chest pivot anywhere: the Tauren's sits 5.8 behind its
  // root). The trunk (hips and chest joints) turns as one piece so the line from the hip centre (first leg joints) to the
  // shoulder centre (first arm joints) points as the donor's and the shoulder line follows the donor's; the neck joints
  // (head part above the head joint) turn so the neck (first neck joint to the head joint) points as the donor's. The
  // head joint keeps the donor's turn as it is (as a foot does). Places and bend points stay this model's.
  const posture = { spine: null, neck: null };
  let trunkSkin = null;
  /** The donor's trunk in this model's trunk. Frames: origin the hip centre, first axis to the shoulder centre (its length
   * scales heights and depths), second the shoulder line (its width scales widths). Each donor trunk joint is placed at its
   * donor coordinates in this model's frame and turns with the trunk. The donor's own trunk skin, read along its first
   * axis, gives each skinned trunk joint a level (the median of its vertices); this model's trunk vertices go to the joint
   * whose level span holds them, both joints within SKIN_BAND of a span's width from the line between two.
   * -> { levels: [{ id, at }], bounds, band, at(point) } or null. */
  const fitTrunk = ({ hipB, hipA, shoulderB, shoulderA, sideB, sideA, spine, trunkJoints }) => {
    const frame = (h, s, side) => {
      const e1 = s.clone().sub(h), length = e1.length(); e1.normalize();
      const e2 = side.clone().addScaledVector(e1, -side.dot(e1)), width = e2.length(); e2.normalize();
      return { h, e1, e2, e3: e1.clone().cross(e2), length, width };
    };
    const fB = frame(hipB, shoulderB, sideB), fA = frame(hipA, shoulderA, sideA);
    const eps = 1e-3 * rigB.hipHeight, epsA = 1e-3 * rigA.hipHeight;
    if (fB.length < eps || fA.length < epsA || fB.width < eps || fA.width < epsA) return null;
    const s1 = fB.length / fA.length, s2 = fB.width / fA.width;
    // The trunk: hips and chest joints and the donor joints between the chest and the top hips joint.
    const top = rigA.parts.hips?.joints?.[0] ?? rigA.body, chain = new Set(trunkJoints);
    for (const id of rigA.parts.chest?.joints || []) {
      const line = treeA.ancestors(id);
      if (!line.includes(top)) continue;
      for (const a of line) { if (keepDonor.has(a) && isDonorJoint(a) && placed.has(a)) chain.add(a); if (a === top) break; }
    }
    // Levels from the donor's own skin (geosets its Stand shows).
    const stand = donorStandD >= 0 ? D.Sequences[donorStandD] : null, owners = new Map();
    const ownerOf = bone => {
      if (!owners.has(bone)) { const at = treeA.ancestors(bone, true).find(a => chain.has(a) || donorPartJoints.has(a)); owners.set(bone, at != null && chain.has(at) ? at : null); }
      return owners.get(bone);
    };
    const values = new Map();
    (D.Geosets || []).forEach((geoset, index) => {
      const alpha = (D.GeosetAnims || []).find(item => item.GeosetId === index)?.Alpha;
      if (alpha?.Keys?.length && !isGlobalTrack(alpha, D) && stand?.Interval && !sampleShows(D, alpha, stand)) return;
      const count = (geoset.Vertices?.length || 0) / 3, weights = geoset.SkinWeights, hd = weights?.length >= count * 8;
      for (let v = 0; v < count; v++) {
        const bones = hd ? [0, 1, 2, 3].filter(i => weights[v * 8 + 4 + i] > 0).map(i => weights[v * 8 + i]) : Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []);
        const t = v3(geoset.Vertices.subarray(v * 3, v * 3 + 3)).sub(fA.h).dot(fA.e1) / fA.length;
        for (const o of new Set(bones.map(ownerOf).filter(o => o != null))) { if (!values.has(o)) values.set(o, []); values.get(o).push(t); }
      }
    });
    const median = list => { const s = [...list].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    const levels = [...values].filter(([, list]) => list.length >= 3).map(([id, list]) => ({ id, at: median(list) })).sort((a, b) => a.at - b.at || a.id - b.id);
    // The donor's trunk joints sit where the donor's sit in this trunk, so it bends where the donor bends, also when only one
    // of them carries skin (the Satyr's trunk skin is all on its chest, whose pivot sits at hip height: it bows from the hips;
    // its chest joint stayed at the Ghoul's own chest, half way up, and the Ghoul bowed 24 deg where the Satyr bows 61).
    // The skin is then not shared out: one skinned trunk joint, nothing to share.
    for (const id of chain) {
      const d = pA(id).sub(fA.h);
      placed.set(id, fB.h.clone().addScaledVector(fB.e1, s1 * d.dot(fA.e1)).addScaledVector(fB.e2, s2 * d.dot(fA.e2)).addScaledVector(fB.e3, s1 * d.dot(fA.e3)));
      correction.set(id, spine.clone());
    }
    if (levels.length < 2) return null;
    const bounds = levels.slice(1).map((level, i) => (levels[i].at + level.at) / 2);
    const band = levels.slice(1).map((level, i) => SKIN_BAND * (level.at - levels[i].at));
    return { levels, bounds, band, chain, at: point => point.clone().sub(fB.h).dot(fB.e1) / fB.length };
  };
  if (rigA.ok && rigB.ok) {
    const at = (list, from) => list.length ? list.map(from).reduce((a, b) => a.add(b), new Vector3()).divideScalar(list.length) : null;
    const rootsOf = kind => Object.values(rigA.parts).filter(part => part.limbKind === kind && placed.has(part.joints[0])).map(part => part.joints[0]);
    const legRoots = rootsOf('leg'), armRoots = rootsOf('arm');
    const trunkJoints = ['hips', 'chest'].flatMap(key => rigA.parts[key]?.joints || []).filter(id => placed.has(id)), headJoints = (rigA.parts.head?.joints || []).filter(id => placed.has(id));
    const headAt = rigA.parts.head?.marker != null && placed.has(rigA.parts.head.marker) ? rigA.parts.head.marker : null;
    const hipB = at(legRoots, id => placed.get(id).clone()) ?? (placed.has(rigA.body) ? placed.get(rigA.body).clone() : null), hipA = at(legRoots, pA) ?? pA(rigA.body);
    const shoulderB = at(armRoots, id => placed.get(id).clone()), shoulderA = at(armRoots, pA);
    const sideOf = from => rigA.parts.armL && rigA.parts.armR && placed.has(rigA.parts.armL.joints[0]) && placed.has(rigA.parts.armR.joints[0]) ? from(rigA.parts.armL.joints[0]).clone().sub(from(rigA.parts.armR.joints[0])) : null;
    const angle = q => 2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180 / Math.PI;
    // The upper end of the trunk line: the shoulders; a body with no arms, its head joint.
    const topB = shoulderB ?? (headAt != null ? placed.get(headAt) : null), topA = shoulderA ?? (headAt != null ? pA(headAt) : null);
    if (bipeds && trunkJoints.length && hipB && topB && topA && topB.distanceTo(hipB) > 1e-3 * rigB.hipHeight) {
      const spine = alignFrames(topB.clone().sub(hipB), topA.clone().sub(hipA), sideOf(id => placed.get(id)), sideOf(pA));
      for (const id of trunkJoints) correction.set(id, spine.clone());
      posture.spine = angle(spine);
      // Bend where the donor bends (v2 item 4, "trunk included"): the donor's trunk joints (hips, chest and the joints
      // between them) sit in this model's trunk where they sit in the donor's, measured on the trunk itself (hip centre to
      // shoulder centre, shoulder width), and this model's trunk skin is shared between them where the donor's own skin
      // is (`trunkSkin`, used by the skin below). Needs legs and two arms; else the trunk keeps this model's joints.
      const sideB = sideOf(id => placed.get(id)), sideA = sideOf(pA);
      if (legRoots.length && shoulderB && sideB && sideA) trunkSkin = fitTrunk({ hipB, hipA, shoulderB, shoulderA, sideB, sideA, spine, trunkJoints });
    }
    // The neck, for every donor with a neck joint (a snake's too: it needs no trunk line).
    const neckJoints = headAt != null ? headJoints.slice(0, headJoints.indexOf(headAt)) : [];
    if (neckJoints.length && placed.get(headAt).distanceTo(placed.get(neckJoints[0])) > 1e-3 * rigB.hipHeight) {
      const neck = alignFrames(placed.get(headAt).clone().sub(placed.get(neckJoints[0])), pA(headAt).sub(pA(neckJoints[0])), sideOf(id => placed.get(id)), sideOf(pA));
      for (const id of neckJoints) correction.set(id, neck.clone());
      posture.neck = angle(neck);
    }
  }
  const trunkJoint = id => { const key = partOfDonor.get(id); return key != null && rigA.parts[key]?.kind === 'trunk'; };
  const correctionOf = id => {
    if (correction.has(id)) return correction.get(id);
    if (id == null || trunkJoint(id)) return new Quaternion();
    const parent = treeA.parentOf(id), value = parent == null || dropped.has(parent) ? new Quaternion() : correctionOf(parent).clone();
    correction.set(id, value);
    return value;
  };
  for (const id of byDepth) if (!isDonorJoint(id) && !placed.has(id)) {
    const parent = donorParent(id);
    if (parent?.own != null) placed.set(id, placeFrom(pB(parent.own), parent.from, id));
    else if (parent?.donor != null) placed.set(id, placeFrom(placed.get(parent.donor), parent.donor, id, correctionOf(parent.donor)));
    else placed.set(id, groundB.clone().add(pA(id).sub(groundA).multiplyScalar(size)));
  }

  // ------------------------------------------------------------ the new model
  const M = structuredClone({ ...model, Nodes: undefined });
  delete M.Nodes;
  const ownKeep = new Set([...keptOwn, ...ownNodes.filter(n => keptExtra(n.ObjectId) || outsideKept.has(n.ObjectId)).map(n => n.ObjectId)]);
  // The model's own effects and collision shapes stay; its attachments are replaced by the donor's;
  // its events stay only when the donor's are not taken.
  for (const node of ownNodes) {
    if ((model.CollisionShapes || []).includes(node) || EFFECT_KEYS.some(k => (model[k] || []).includes(node))) ownKeep.add(node.ObjectId);
    if (!events && (model.EventObjects || []).includes(node)) ownKeep.add(node.ObjectId);
  }
  const ownParent = id => {
    let parent = treeB.parentOf(id);
    while (parent != null && !ownKeep.has(parent)) {
      if (partJoint(parent) || jointTarget.has(parent) || twin.has(parent) || rideOf.has(parent) || extraMatch.has(parent)) { const target = targetOf(parent); return target.own != null ? target.own : newId(target.donor); }
      parent = treeB.parentOf(parent);
    }
    return parent;
  };
  const collections = Object.fromEntries(NODE_KEYS.map(key => [key, []]));
  const ownRef = rigB.ok ? sampleNodeMatrices(model, rigB.reference.frame, rigB.reference.sequence) : new Map();
  const refLocal = node => {
    const sequence = model.Sequences?.[rigB.reference.sequence], options = { interval: sequence?.Interval, globalSequences: model.GlobalSequences };
    if (!sequence?.Interval) return null;
    return { Translation: sampleTrack(node.Translation, rigB.reference.frame, { ...options, fallback: [0, 0, 0] }), Rotation: sampleTrack(node.Rotation, rigB.reference.frame, { ...options, fallback: [0, 0, 0, 1], quaternion: true }), Scaling: sampleTrack(node.Scaling, rigB.reference.frame, { ...options, fallback: [1, 1, 1] }) };
  };
  const newSequences = structuredClone(D.Sequences || []).filter(s => s.Interval);
  for (const sequence of newSequences) sequence.MoveSpeed = (Number(sequence.MoveSpeed) || 0) * travel;
  // A track holding one value in every animation (a joint kept still, a constant correction).
  // One key per distinct start, in time order (an HD donor lists its animations out of time order, two on one interval).
  const starts = [...new Set(newSequences.filter(keyable).map(sequence => sequence.Interval[0]))].sort((a, b) => a - b);
  const constantTrack = (value, template) => ({ LineType: 0, GlobalSeqId: null, Keys: starts.map(frame => ({ Frame: frame, Vector: like(template ?? new Float32Array(value.length), value) })) });
  const isDefault = (property, value) => property === 'Rotation' ? near(new Quaternion().fromArray(value).normalize(), 1e-7) : property === 'Scaling' ? value.every(v => Math.abs(v - 1) < 1e-7) : value.every(v => Math.abs(v) < 1e-7);
  for (const node of ownNodes) {
    if (!ownKeep.has(node.ObjectId)) continue;
    const copy = structuredClone(node), key = NODE_KEYS.find(k => (model[k] || []).includes(node));
    copy.Parent = ownParent(node.ObjectId) ?? null;
    copy.PivotPoint = new Float32Array(nodePivot(model, node, node.ObjectId));
    if (JOINT_KEYS.includes(key) && !keptOwn.has(node.ObjectId)) {
      // Kept still where the model's own reference pose holds it; a global-sequence track keeps moving.
      const local = refLocal(node);
      for (const property of ['Translation', 'Rotation', 'Scaling']) {
        if (copy[property]?.Keys && isGlobalTrack(copy[property], model)) continue;
        const value = local?.[property];
        if (value && !isDefault(property, value)) copy[property] = constantTrack(value, node[property]?.Keys?.[0]?.Vector);
        else delete copy[property];
      }
    } else if (keptOwn.has(node.ObjectId)) {
      for (const property of ['Translation', 'Rotation', 'Scaling']) if (!(copy[property]?.Keys && isGlobalTrack(copy[property], model))) delete copy[property];
    }
    collections[key].push(copy);
  }
  // Donor nodes: new ids, fitted pivots, corrected keys.
  // The donor's global sequences that its kept nodes use, appended after the model's own.
  M.GlobalSequences ||= [];
  const globalMap = new Map();
  const globalShift = track => {
    if (!track || track.GlobalSeqId == null || track.GlobalSeqId === -1) return;
    if (!(D.GlobalSequences?.[track.GlobalSeqId] > 0)) { track.GlobalSeqId = NO_LENGTH; return; }
    if (!globalMap.has(track.GlobalSeqId)) globalMap.set(track.GlobalSeqId, M.GlobalSequences.push(D.GlobalSequences[track.GlobalSeqId]) - 1);
    track.GlobalSeqId = globalMap.get(track.GlobalSeqId);
  };
  // A donor weapon attachment hangs from the bone that carries the weapon, where the model's own one of the
  // same name (else its only one) sits on the weapon. Riding the donor's weapon bone, it is re-placed with the
  // weapon's skin after the keys are made (`weaponMoves`).
  const weaponMoves = [];
  const placeWeaponPoint = copy => {
    const plain = name => String(name).replace(/\s+/g, '').toLowerCase();
    const mine = ownWeaponPoints.find(point => plain(point.Name) === plain(copy.Name)) ?? (ownWeaponPoints.length === 1 ? ownWeaponPoints[0] : null);
    const top = mine?.Parent != null ? extraOf(mine.Parent) : null;
    const via = mine ? treeB.ancestors(mine.ObjectId).find(partJoint) ?? null : weaponVia;
    if (top != null && keepSet.has(top)) { copy.Parent = top; copy.PivotPoint = new Float32Array(nodePivot(model, mine, mine.ObjectId)); return; }
    const onWeapon = mine ? top != null && weaponExtras.has(top) : weaponExtras.size > 0;
    if (onWeapon && weaponRides) { copy.Parent = newId(donorWeapon); if (!mine || via == null) return; }
    else if (mine && via != null) copy.Parent = skinTarget(via);
    else return;
    const back = safeInverse(ownRef.get(via) || new Matrix4());
    if (!back) return;
    const p = v3(nodePivot(model, mine, mine.ObjectId)).applyMatrix4(ownRef.get(mine.ObjectId) || new Matrix4()).applyMatrix4(back);
    copy.PivotPoint = new Float32Array(p.toArray());
    delete copy.Translation; delete copy.Rotation; delete copy.Scaling;
    if (copy.Parent === newId(donorWeapon) && skinTarget(via) !== copy.Parent) weaponMoves.push([copy, skinTarget(via)]);
  };
  const importer = emitters ? createResourceImporter(D, M, { reuseTextures: 'fingerprint' }) : null;
  for (const id of byDepth) {
    const node = donorById.get(id), copy = structuredClone(node), key = NODE_KEYS.find(k => (D[k] || []).includes(node));
    copy.ObjectId = newId(id);
    const parent = donorParent(id);
    copy.Parent = parent == null ? null : parent.own != null ? parent.own : newId(parent.donor);
    copy.PivotPoint = new Float32Array(placed.get(id).toArray());
    if (key === 'Bones') { copy.GeosetId = null; copy.GeosetAnimId = null; }
    visitTracks(copy, globalShift, { event: globalShift });
    // A track on a global sequence of no length never plays: it holds its first key.
    visitTracks(copy, (track, { owner, property }) => {
      if (track.GlobalSeqId !== NO_LENGTH) return;
      if (track.Keys.length && !Array.isArray(owner)) owner[property] = constantTrack(Array.from(track.Keys[0].Vector), track.Keys[0].Vector);
      else track.GlobalSeqId = null;
    });
    if (copy.GlobalSeqId === NO_LENGTH) copy.GlobalSeqId = null;
    // Where the donor hides its weapon by scaling it to nothing, the weapon keeps its reference size (in the hand).
    if (decollapse.has(id) && copy.Scaling?.Keys) {
      const rest = decollapse.get(id);
      for (const k of copy.Scaling.Keys) if (collapsed(k.Vector)) {
        k.Vector = like(k.Vector, rest);
        if (k.InTan) k.InTan = like(k.Vector, copy.Scaling.LineType === 3 ? rest : [0, 0, 0]);
        if (k.OutTan) k.OutTan = like(k.Vector, copy.Scaling.LineType === 3 ? rest : [0, 0, 0]);
      }
    }
    // Rotation: the donor's keys as they are (100% transplant). The posture is in the bind pose: the mesh is re-posed
    // into the donor's rest posture below (`repose`), so no key carries a correction.
    // Translation: scaled to this model. Inside a transplanted limb a joint's move is scaled by its own stretch (this
    // model's length over the donor's), so the stretch keeps pointing as the donor's does; elsewhere by the travel ratio.
    const parentId = parent?.donor;
    // (A limb, or the neck and head: so the neck too keeps pointing as the donor's when its head moves.)
    const sameLimb = parentId != null && partOfDonor.has(id) && partOfDonor.get(id) === partOfDonor.get(parentId) && (!trunkJoint(id) || partOfDonor.get(id) === 'head');
    const lengthA = sameLimb ? pA(id).distanceTo(pA(parentId)) : 0, scale = sameLimb && lengthA > 1e-6 ? placed.get(id).distanceTo(placed.get(parentId)) / lengthA : travel;
    if (copy.Translation?.Keys) {
      const move = v => v && like(v, new Vector3().fromArray(v).multiplyScalar(scale).toArray());
      for (const k of copy.Translation.Keys) { k.Vector = move(k.Vector); if (k.InTan) k.InTan = move(k.InTan); if (k.OutTan) k.OutTan = move(k.OutTan); }
    }
    if (importer && key === 'ParticleEmitters2' && copy.TextureID != null && copy.TextureID !== -1) copy.TextureID = importer.textureRef(node.TextureID);
    if (importer && key === 'RibbonEmitters') copy.MaterialID = importer.materialRef(node.MaterialID);
    if (key === 'ParticleEmitterPopcorns' && M.Version < 900) continue;
    if (key === 'Attachments' && isWeaponPoint(copy)) placeWeaponPoint(copy);
    collections[key].push(copy);
  }
  for (const key of NODE_KEYS) M[key] = collections[key];
  M.PivotPoints = [];
  M.Sequences = newSequences;

  // ------------------------------------------------------------ skin
  // The weapon's pieces: bones of a weapon extra that move by themselves or hang under one that does. Still
  // skin above them (a hand mesh carrying the weapon) is the hand's and stays with it.
  const weaponPiece = (id, top) => { for (const at of treeB.ancestors(id, true)) { if (moves(at)) return true; if (at === top) return false; } return false; };
  const weaponBones = new Set(weaponRides ? [...weaponExtras].filter(id => !keepSet.has(id)).flatMap(id => extras.get(id).bones.filter(bone => weaponPiece(bone, id))) : []);
  const weaponVertices = []; // [geoset, vertex, the hand the weapon was baked onto] to re-place on the weapon bone
  // ---- skin on the donor's bones (contract 4.3, 4.4)
  const carriers = donorSkinCarriers({ donor: D, donorPartJoints, treeA, skinCount: donorSkin });
  const carrierOf = id => keepDonor.has(carriers.get(id)) ? carriers.get(id) : id;
  // An extra (moves by itself) is decided once, by the centroid of its vertices in the bind pose, with no band.
  const extraCentre = new Map();
  for (const geoset of model.Geosets || []) {
    const count = (geoset.Vertices?.length || 0) / 3, weights = geoset.SkinWeights;
    for (let v = 0; v < count; v++) {
      const bones = weights?.length >= count * 8 ? [0, 1, 2, 3].filter(i => weights[v * 8 + 4 + i] > 0).map(i => weights[v * 8 + i]) : Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []);
      for (const top of new Set(bones.map(id => extraTop.get(id) ?? (rideOf.has(id) ? id : null)).filter(top => top != null && (extras.has(top) || rideOf.has(top))))) {
        if (!extraCentre.has(top)) extraCentre.set(top, { sum: new Vector3(), n: 0 });
        const entry = extraCentre.get(top); entry.sum.add(v3(geoset.Vertices.subarray(v * 3, v * 3 + 3))); entry.n++;
      }
    }
  }
  /** Donor joints ({ joint }) or a node that stays ({ own }) for one own bone of a vertex at `point` (bind space). */
  const jointsOf = (id, point, { trunk = true } = {}) => {
    const t = targetOf(id);
    if (t.own != null) return [{ own: t.own }];
    const top = extraTop.get(id) ?? (rideOf.has(id) ? id : null), rigid = top != null && (extras.has(top) || rideOf.has(top)) && extraCentre.has(top);
    const at = rigid ? extraCentre.get(top).sum.clone().divideScalar(extraCentre.get(top).n) : point;
    const hosted = t.via != null ? runsByHost.get(t.via) : null;
    const first = hosted ? splitJoints(at, t.donor, hosted, { band: !rigid }) : [t.donor];
    // The trunk's skin goes where the donor's trunk skin is (fitTrunk); `trunk` marks a joint that share chose.
    const items = new Map();
    for (const joint of first) for (const share of joint === t.donor && trunk ? trunkShare(joint, at, !rigid) : [joint]) if (!items.has(share)) items.set(share, { joint: share, ...(joint === t.donor && share !== t.donor ? { trunk: true } : {}) });
    return [...items.values()];
  };
  /** Trunk joints for a point of this model's trunk skin: the donor trunk joint whose level span holds it, both near a line. */
  function trunkShare(joint, point, band) {
    if (!trunkSkin || !trunkSkin.chain.has(joint)) return [joint];
    const { levels, bounds } = trunkSkin, t = trunkSkin.at(point);
    if (band) {
      let nearest = -1, best = Infinity;
      bounds.forEach((b, i) => { const d = Math.abs(t - b); if (d <= trunkSkin.band[i] && d < best) { best = d; nearest = i; } });
      if (nearest >= 0) return [levels[nearest].id, levels[nearest + 1].id];
    }
    return [levels[bounds.filter(b => b <= t).length].id];
  }
  const firstChildJoint = new Map();
  const stretchDistance = (joint, point) => {
    if (!firstChildJoint.has(joint)) firstChildJoint.set(joint, (treeA.children.get(joint) || []).map(n => n.ObjectId).find(c => donorPartJoints.has(c) && placed.has(c)) ?? null);
    const a = placed.get(joint), child = firstChildJoint.get(joint);
    if (!a) return Infinity;
    if (child == null) return point.distanceTo(a);
    const ab = placed.get(child).clone().sub(a), length = ab.lengthSq(), s = length > 1e-12 ? Math.min(1, Math.max(0, point.clone().sub(a).dot(ab) / length)) : 0;
    return point.distanceTo(a.clone().addScaledVector(ab, s));
  };
  const resultId = item => item.own != null ? item.own : newId(carrierOf(item.joint));
  const skinCounts = { runs: runs.length, moved: 0, blended: 0, capped: 0, carriers: 0, helpersMadeBones: 0, offBody: 0, trunk: 0 };
  /** Result targets of a vertex: [[id, share of the bone's weight]] per bone, capped to four nodes. */
  const vertexTargets = (bones, point) => {
    // A vertex shared with a limb (an armpit, a groin) keeps its trunk bone's own target, the joint that limb hangs from:
    // shared by height with a lower trunk joint it would tear when the limb moves with the joint above.
    const withLimb = trunkSkin && bones.some(id => { const t = targetOf(id); return t.donor != null && rigA.parts[partOfDonor.get(t.donor)]?.kind === 'limb'; });
    const perBone = bones.map(id => ({ id, items: jointsOf(id, point, { trunk: !withLimb }) }));
    let moved = false, blended = false;
    let trunk = false;
    for (const { id, items } of perBone) { const t = targetOf(id); if (items.length > 1) blended = true; if (t.donor != null && items.some(item => item.joint !== t.donor && !item.trunk)) moved = true; if (items.some(item => item.trunk)) trunk = true; }
    if (trunk) skinCounts.trunk++;
    const unique = new Map();
    for (const { items } of perBone) for (const item of items) unique.set(resultId(item), item);
    if (unique.size > 4) {
      skinCounts.capped++;
      const keepIds = new Set([...unique].sort((x, y) => (x[1].own != null ? 0 : stretchDistance(x[1].joint, point)) - (y[1].own != null ? 0 : stretchDistance(y[1].joint, point)) || x[0] - y[0]).slice(0, 4).map(([id]) => id));
      for (const entry of perBone) { const kept = entry.items.filter(item => keepIds.has(resultId(item))); entry.items = kept.length ? kept : [entry.items[0]]; }
    }
    if (moved) skinCounts.moved++;
    if (blended) skinCounts.blended++;
    if (perBone.some(({ items }) => items.some(item => item.own != null))) skinCounts.offBody++;
    return perBone.map(({ id, items }) => ({ id, targets: items.map(item => [resultId(item), 1 / items.length]) }));
  };
  const skinned = new Set(), inverseRef = new Map();
  const refInverse = id => { if (!inverseRef.has(id)) inverseRef.set(id, safeInverse(ownRef.get(id) || new Matrix4())); return inverseRef.get(id); };
  let baked = 0;
  for (const geoset of M.Geosets || []) {
    const count = (geoset.Vertices?.length || 0) / 3;
    const bake = (v, bones) => {
      // A vertex carried by extras alone rides the part joint they hang from, held as the model's own reference pose holds it
      // (an outside joint's skin: the part joint it rides). An extra on the donor's matching chain is not held (no `via`).
      if (!rigB.ok || !bones.length || !bones.every(id => extraTop.has(id) && !keptExtra(id) || rideOf.has(id))) return;
      const vias = new Set(bones.map(viaOf));
      if (vias.size !== 1) return;
      const via = [...vias][0];
      if (via == null || !refInverse(via)) return;
      const p = new Vector3(), n = new Vector3(), at = v3(geoset.Vertices.subarray(v * 3, v * 3 + 3)), normal = v3(geoset.Normals?.subarray(v * 3, v * 3 + 3) || [0, 0, 1]);
      for (const id of bones) { const m = ownRef.get(id) || new Matrix4(); p.add(at.clone().applyMatrix4(m)); n.add(normal.clone().transformDirection(m)); }
      p.divideScalar(bones.length).applyMatrix4(refInverse(via));
      n.transformDirection(refInverse(via));
      if (p.distanceTo(at) > 1e-4) baked++;
      geoset.Vertices.set(p.toArray(), v * 3);
      if (geoset.Normals?.length === geoset.Vertices.length) geoset.Normals.set(n.normalize().toArray(), v * 3);
    };
    const rides = bones => weaponBones.size > 0 && bones.length > 0 && bones.every(id => weaponBones.has(id)) && new Set(bones.map(viaOf)).size === 1;
    const ride = (v, bones) => { weaponVertices.push([geoset, v, skinTarget(viaOf(bones[0]))]); return newId(donorWeapon); };
    const source = model.Geosets[M.Geosets.indexOf(geoset)], bindAt = v => v3(source.Vertices.subarray(v * 3, v * 3 + 3));
    if (geoset.SkinWeights?.length >= count * 8 && count) {
      const weights = geoset.SkinWeights;
      for (let v = 0; v < count; v++) {
        const merged = new Map(), bones = [];
        for (let i = 0; i < 4; i++) if (weights[v * 8 + 4 + i]) bones.push(weights[v * 8 + i]);
        const riding = rides(bones), resolved = riding ? null : vertexTargets(bones, bindAt(v));
        for (let i = 0; i < 4; i++) {
          const w = weights[v * 8 + 4 + i]; if (!w) continue;
          const targets = riding ? [[newId(donorWeapon), 1]] : resolved.find(entry => entry.id === weights[v * 8 + i]).targets;
          for (const [t, share] of targets) merged.set(t, (merged.get(t) || 0) + w * share);
        }
        bake(v, bones);
        if (riding) ride(v, bones);
        let list = [...merged].sort((a, b) => b[1] - a[1]).slice(0, 4);
        if (list.some(([, w]) => w !== Math.round(w))) {
          // Shares of a split stretch: whole weights that still add up as before.
          const sum = Math.round(list.reduce((s, [, w]) => s + w, 0));
          list = list.map(([t, w]) => [t, Math.floor(w)]);
          for (let i = 0, rest = sum - list.reduce((s, [, w]) => s + w, 0); rest > 0; i = (i + 1) % list.length, rest--) list[i][1]++;
        }
        for (let i = 0; i < 4; i++) { weights[v * 8 + i] = list[i]?.[0] ?? 0; weights[v * 8 + 4 + i] = list[i]?.[1] ?? 0; }
        for (const [t] of list) skinned.add(t);
      }
    }
    const groups = [], index = new Map(), vertexGroup = [];
    for (let v = 0; v < count; v++) {
      const bones = Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []);
      const hd = geoset.SkinWeights?.length >= count * 8, riding = rides(bones);
      if (!hd) bake(v, bones);
      const targets = [...new Set(riding ? [hd ? newId(donorWeapon) : ride(v, bones)] : hd ? bones.map(id => { const t = targetOf(id); return t.own != null ? t.own : newId(carrierOf(t.donor)); }) : vertexTargets(bones, bindAt(v)).flatMap(entry => entry.targets.map(([t]) => t)))].sort((a, b) => a - b);
      const key = targets.join(',');
      if (!index.has(key)) { index.set(key, groups.length); groups.push(targets); }
      vertexGroup.push(index.get(key));
      for (const t of targets) skinned.add(t);
    }
    if (groups.length > 256) hard.push(`A geoset needs ${groups.length} bone groups after the transplant; the format holds 256.`);
    geoset.Groups = groups;
    geoset.VertexGroup = like(geoset.VertexGroup || new Uint8Array(count), vertexGroup);
    geoset.TotalGroupsCount = groups.reduce((sum, group) => sum + group.length, 0);
  }
  if ((M.BindPoses || []).length) { notes.push('The open model has bind poses (Reforged skinning); they are left out of the result.'); M.BindPoses = []; }
  if (rigB.ok && rigA.ok && !(rigB.hipMeasured && rigA.hipMeasured)) notes.push("Sized by the bodies' overall size: one of them does not stand on legs.");
  // A donor helper that carries skin becomes a bone; a still donor joint with no skin, keys or children goes.
  const hasKeys = node => ['Translation', 'Rotation', 'Scaling'].some(p => node[p]?.Keys?.length);
  for (const [joint, bone] of carriers) if (bone !== joint && skinned.has(newId(bone))) skinCounts.carriers++;
  for (const node of [...M.Helpers]) if (skinned.has(node.ObjectId) && node.ObjectId >= offset) {
    skinCounts.helpersMadeBones++;
    M.Helpers = M.Helpers.filter(n => n !== node);
    node.Flags = (node.Flags & ~TYPE_FLAGS) | BONE_FLAG; node.GeosetId = null; node.GeosetAnimId = null;
    M.Bones.push(node);
  }
  // The hands the weapon was baked onto stay: the weapon is placed from them onto the weapon bone below, also where all
  // their skin went with the weapon (Revenant on the Skink High Priest: Wrist1 went, "reading 'elements'" of undefined).
  const weaponHands = new Set([...weaponVertices.map(([, , hand]) => hand), ...weaponMoves.map(([, hand]) => hand)]);
  for (let changed = true; changed;) {
    changed = false;
    const parents = new Set([...weaponHands, ...NODE_KEYS.flatMap(k => M[k]).map(n => n.Parent).filter(p => p != null && p !== -1)]);
    for (const key of JOINT_KEYS) {
      const before = M[key].length;
      // A donor bone exists to carry skin: without any here and with nothing hanging from it, it goes, keys or
      // not (the donor's weapon and gut pieces). A helper with keys stays (a tail, a weapon root): it costs nothing.
      M[key] = M[key].filter(n => n.ObjectId < offset || skinned.has(n.ObjectId) || parents.has(n.ObjectId) || key === 'Helpers' && hasKeys(donorById.get(n.ObjectId - offset)));
      if (M[key].length !== before) changed = true;
    }
  }

  // ------------------------------------------------------------ re-pose: the donor's rest posture in the bind pose
  // (owner, 19 Nov 2026: "A TRANSPLANT IS 100% A TRANSPLANT"). Every donor node sits where its parent's turn carries its
  // place here (from the top down), and the mesh follows the bones it is bound to: each vertex turned by its bone's
  // correction about that bone, blended by its weights. The keys are the donor's, so at every moment each stretch points
  // as the donor's does, on this model's proportions. The weapon's skin and points are re-posed with the hand they were
  // baked onto (they move onto the weapon bone below).
  const allM = NODE_KEYS.flatMap(k => M[k]), byIdM = new Map(allM.map(n => [n.ObjectId, n]));
  const turnOf = id => id >= offset && donorById.has(id - offset) ? correctionOf(id - offset) : null;
  const restPivot = new Map(allM.map(n => [n.ObjectId, v3(n.PivotPoint)])), reposed = new Map();
  const reposeVia = new Map(weaponMoves.map(([node, hand]) => [node.ObjectId, hand]));
  const skinUnder = new Set();
  for (const id of skinned) for (let at = id, guard = 0; at != null && at !== -1 && byIdM.has(at) && !skinUnder.has(at) && guard < 1e4; at = byIdM.get(at).Parent, guard++) skinUnder.add(at);
  const reposedPivot = id => {
    if (reposed.has(id)) return reposed.get(id);
    let p = restPivot.get(id) ?? new Vector3();
    const via = reposeVia.get(id) ?? byIdM.get(id)?.Parent;
    // A donor joint with no counterpart here and no skin of this model at or below it (a tail this model lacks) keeps the
    // donor's offset from the joint above it. One with skin (a skin carrier) moves with that joint, as its skin does.
    if (id >= offset && via === newId(offsetJoint.get(id - offset)) && byIdM.has(via) && !skinUnder.has(id) && !limbCorrected.has(id - offset)) p = reposedPivot(via).clone().add(pA(id - offset).sub(pA(offsetJoint.get(id - offset))).multiplyScalar(size));
    else if (id >= offset && via != null && via >= offset && byIdM.has(via)) p = reposeAbout(via, p);
    reposed.set(id, p);
    return p;
  };
  const reposeAbout = (id, point) => { const turn = turnOf(id); const moved = point.clone().sub(restPivot.get(id)); if (turn) moved.applyQuaternion(turn); return moved.add(reposedPivot(id)); };
  {
    const riding = new Map(weaponVertices.map(([geoset, v, hand]) => [`${M.Geosets.indexOf(geoset)}:${v}`, hand]));
    M.Geosets.forEach((geoset, g) => {
      const count = (geoset.Vertices?.length || 0) / 3, weights = geoset.SkinWeights, hd = count && weights?.length >= count * 8;
      const normals = geoset.Normals?.length === geoset.Vertices.length ? geoset.Normals : null, tangents = geoset.Tangents?.length >= count * 4 ? geoset.Tangents : null;
      for (let v = 0; v < count; v++) {
        let bound = hd ? [0, 1, 2, 3].filter(i => weights[v * 8 + 4 + i] > 0).map(i => [weights[v * 8 + i], weights[v * 8 + 4 + i]]) : Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || [], id => [id, 1]);
        if (riding.has(`${g}:${v}`)) bound = [[riding.get(`${g}:${v}`), 1]];
        const total = bound.reduce((s, [, w]) => s + w, 0);
        if (!(total > 0) || bound.every(([id]) => !turnOf(id) && !(id >= offset))) continue;
        const at = v3(geoset.Vertices.subarray(v * 3, v * 3 + 3)), p = new Vector3(), n = new Vector3(), t = new Vector3();
        const normal = normals ? v3(normals.subarray(v * 3, v * 3 + 3)) : null, tangent = tangents ? v3(tangents.subarray(v * 4, v * 4 + 3)) : null;
        for (const [id, w] of bound) {
          p.addScaledVector(byIdM.has(id) ? reposeAbout(id, at) : at, w / total);
          const turn = turnOf(id);
          if (normal) n.addScaledVector(turn ? normal.clone().applyQuaternion(turn) : normal, w / total);
          if (tangent) t.addScaledVector(turn ? tangent.clone().applyQuaternion(turn) : tangent, w / total);
        }
        geoset.Vertices.set(p.toArray(), v * 3);
        if (normal && n.lengthSq() > 1e-12) normals.set(n.normalize().toArray(), v * 3);
        if (tangent && t.lengthSq() > 1e-12) tangents.set(t.normalize().toArray(), v * 4);
      }
    });
    for (const node of allM) if (node.ObjectId >= offset) node.PivotPoint = new Float32Array(reposedPivot(node.ObjectId).toArray());
  }

  // ------------------------------------------------------------ everything else timed in animations
  const ownSequences = model.Sequences || [];
  const timed = ownTimedTracks([M.GeosetAnims || [], M.Materials || [], M.TextureAnims || [], M.Cameras || [], ...NODE_KEYS.flatMap(k => M[k].filter(n => n.ObjectId < offset && !JOINT_KEYS.includes(k)))]);
  refitTracks(timed, ownSequences, M.GlobalSequences, newSequences, ownStand >= 0 ? ownStand : 0);
  // How he dies (owner, 19 Nov 2026, TEST GORE2 sheet): in the donor's Death and Decay he shows what his Stand shows, so
  // his living body dies with the donor and his own death-only meshes (corpse copies, gut piles) stay hidden; where the
  // donor hides its body, so does he.
  holdShowing(M, model, ownSequences[ownStand], newSequences, D);
  // This model's own nodes that hang from a donor node (its own effects, a kept piece) stay where they were in the world
  // although their parent's bind pose was re-posed: their turn becomes C q and their move C t + (re-posed pivot - pivot),
  // the pivot itself kept, so their own skin and children need nothing.
  for (const node of allM) {
    if (node.ObjectId >= offset || !(node.Parent >= offset) || !byIdM.has(node.Parent)) continue;
    const turn = turnOf(node.Parent) ?? new Quaternion(), shift = reposeAbout(node.Parent, restPivot.get(node.ObjectId)).sub(restPivot.get(node.ObjectId));
    if (!near(turn, 1e-9)) {
      const q = v => v && like(v, turn.clone().multiply(new Quaternion().fromArray(v)).toArray());
      if (node.Rotation?.Keys?.length) for (const k of node.Rotation.Keys) { k.Vector = q(k.Vector); if (k.InTan) k.InTan = q(k.InTan); if (k.OutTan) k.OutTan = q(k.OutTan); }
      else node.Rotation = constantTrack(turn.toArray());
    }
    if (node.Translation?.Keys?.length) {
      const bezier = node.Translation.LineType === 3, move = (v, offsetToo) => v && like(v, new Vector3().fromArray(v).applyQuaternion(turn).add(offsetToo ? shift : new Vector3()).toArray());
      for (const k of node.Translation.Keys) { k.Vector = move(k.Vector, true); if (k.InTan) k.InTan = move(k.InTan, bezier); if (k.OutTan) k.OutTan = move(k.OutTan, bezier); }
    } else if (shift.length() > 1e-6) node.Translation = constantTrack(shift.toArray());
  }
  for (const geoset of M.Geosets || []) fillSequenceExtents(M, geoset, { onlyIfPresent: false });

  // ------------------------------------------------------------ ids
  const turnedNodes = allM.map(node => [node, turnOf(node.ObjectId)]).filter(([, t]) => t && !near(t, 1e-9)); // ids change below
  const remap = canonicalizeSerializedNodeOrder(M);
  const ownMap = {}, donorMap = {};
  for (const node of ownNodes) if (remap.has(node.ObjectId) && ownKeep.has(node.ObjectId)) ownMap[node.ObjectId] = remap.get(node.ObjectId);
  for (const node of donorNodes) if (remap.has(newId(node.ObjectId))) donorMap[node.ObjectId] = remap.get(newId(node.ObjectId));
  // How the bind pose was re-posed: result node -> the turn its skin took ([x, y, z, w]; only turned nodes).
  const reposeOut = {};
  for (const [node, t] of turnedNodes) reposeOut[node.ObjectId] = t.toArray();
  M.Info = { ...(M.Info || {}) };
  updateCounts(M);

  // ------------------------------------------------------------ ground (no limb is converted since v2)
  const convertedKeys = [];
  // Donor joints that hang from nothing (a thrown weapon's root) settle onto the ground with the body.
  const loose = Object.values(donorMap).filter(id => { const n = M.Nodes[id]; return JOINT_KEYS.some(k => M[k].includes(n)) && (n.Parent == null || n.Parent === -1); });
  // The result's body is the donor's, read through the id map: reading the result again can pick another skeleton
  // once its bind pose is the donor's posture (the Ghoul's corpse skeleton instead of its body).
  const rigM = rigB.ok && rigA.ok ? mappedRig(M, rigA, id => remap.get(newId(id))) : { ok: false };
  if (rigB.ok && rigA.ok) settleFeet(M, rigB, rigM, notes, loose);
  // Feet down where the legs pair; else (G1) this model's own soles go down as the donor stands or hovers.
  let ground = null;
  if (rigB.ok && rigA.ok && feet !== 'free') {
    const hasLegs = rig => Object.values(rig.parts || {}).some(part => part.limbKind === 'leg');
    // Short legs on either side (one or two joints, R1: a rat's legs end at the shin, a pig's leg is one bone) have no foot joint to
    // stand on: this model's own soles go down, as G1's.
    const shortLegs = [rigB, rigA].some(rig => Object.values(rig.parts || {}).some(part => part.limbKind === 'leg' && part.short));
    if (!whole.reason && !shortLegs && hasLegs(rigB) && hasLegs(rigA) && hasLegs(rigM)) { feetDown(M, D, rigB, rigA, rigM, loose, travel); ground = 'feet'; }
    else ground = solesDown(M, D, model, rigB, rigA, rigM, loose, travel);
  }
  // The weapon's skin and attachments, baked onto the hand, go onto the donor's weapon bone where the hand
  // holds them at the result's reference moment (the first frame of its Stand).
  const resultStand = standSequenceIndex(M);
  let weaponHeld = false;
  if ((weaponVertices.length || weaponMoves.length) && resultStand >= 0) {
    const m = sampleNodeMatrices(M, M.Sequences[resultStand].Interval[0], resultStand), toWeapon = safeInverse(m.get(remap.get(newId(donorWeapon)))), turns = new Map();
    // The weapon bone has no inverse there (scaled to nothing, or not finite): the weapon stays on the hand it was baked onto.
    if (!toWeapon) {
      weaponHeld = true;
      holdWeaponOnHand(remap.get(newId(donorWeapon)), weaponVertices.map(([geoset, v, hand]) => [geoset, v, remap.get(hand)]), weaponMoves.map(([node, hand]) => [node, remap.get(hand)]));
      weaponSkip = "The donor's weapon bone is scaled to nothing at the reference moment: the weapon stays in the hand.";
    } else {
    const turnFrom = hand => { const id = remap.get(hand); if (!turns.has(id)) turns.set(id, toWeapon.clone().multiply(m.get(id))); return turns.get(id); };
    for (const [geoset, v, hand] of weaponVertices) {
      const t = turnFrom(hand);
      geoset.Vertices.set(v3(geoset.Vertices.subarray(v * 3, v * 3 + 3)).applyMatrix4(t).toArray(), v * 3);
      if (geoset.Normals?.length === geoset.Vertices.length) geoset.Normals.set(v3(geoset.Normals.subarray(v * 3, v * 3 + 3)).transformDirection(t).toArray(), v * 3);
    }
    for (const [node, hand] of weaponMoves) node.PivotPoint.set(v3(node.PivotPoint).applyMatrix4(turnFrom(hand)).toArray());
    }
  }
  // Safety net: nothing that is not a finite number leaves the engine; what was held is said in the report.
  orderKeys(M);
  const held = holdNonFinite(M, model);
  if (held.vertices || held.pivots || held.keys) notes.push(`Parts of the result were not a number (${held.vertices} vertices, ${held.pivots} pivots, ${held.keys} keys): they are held at rest.`);
  if (extents) for (let i = 0; i < M.Sequences.length; i++) newSequenceExtents(M, i);
  holdExtents(M);
  updateCounts(M);

  // Poor fit (docs/agent-tasks/xfer-transplant-fixes.md): a hard reason, the hips or an arm, leg or wing riding still, or
  // under half of the body following. One share line, one sentence per cause, then the hard reasons and the notes.
  const fit = hard.length || still.some(key => key === 'hips' || /^(arm|leg|wing)/.test(key)) || follows < 0.5 ? 'poor' : 'good';
  const reasons = [`${Math.round(follows * 100)}% of the body follows the donor.`];
  if (whole.reason) reasons.push("The two models stand on a different number of legs: this model's hips and legs ride the donor's body without moving by themselves.");
  const listed = still.filter(key => !(whole.reason && (key === 'hips' || /^leg/.test(key))));
  if (listed.length) reasons.push(`No counterpart in the donor: ${listed.map(key => transferPartLabel(key).toLowerCase()).join(', ')}. They ride the donor's body without moving by themselves.`);
  reasons.push(...hard, ...notes);
  const extrasOut = [...extras.values()].map(({ bones, ...rest }) => ({ ...rest, follows: extraMatch.has(rest.id) ? donorById.get(extraMatch.get(rest.id))?.Name ?? null : null }));
  return {
    model: M,
    report: {
      fit, reasons, follows, still, notes, converted: convertedKeys, extras: extrasOut, riders: ridersOut.map(rider => ({ ...rider, follows: extraMatch.has(rider.id) ? donorById.get(extraMatch.get(rider.id))?.Name ?? null : null })), mirrorOffer, twins: twin.size, deathSwap,
      weapon: { extras: [...weaponExtras], bone: donorWeapon != null ? remap.get(newId(donorWeapon)) ?? null : null, rides: weaponRides && !weaponHeld, vertices: new Set(weaponVertices.map(([g, v]) => `${M.Geosets.indexOf(g)}:${v}`)).size, note: weaponSkip },
      counts: {
        sequences: M.Sequences.length, ground, donorJoints: [...M.Bones, ...M.Helpers].filter(n => !Object.values(ownMap).includes(n.ObjectId)).length,
        ownJointsKept: Object.keys(ownMap).filter(id => JOINT_KEYS.some(k => (model[k] || []).includes(ownById.get(Number(id))))).length,
        attachments: (M.Attachments || []).length, events: (M.EventObjects || []).length, emitters: EFFECT_KEYS.reduce((n, k) => n + (M[k] || []).length, 0),
        vertices: (M.Geosets || []).reduce((n, g) => n + g.Vertices.length / 3, 0), bakedVertices: baked, sizeRatio: size, travel, ridesStill, skin: skinCounts, posture,
      },
      ownNodes: ownMap, donorNodes: donorMap, repose: reposeOut,
    },
  };
}

/** The ground the feet stand on in the result's reference pose, against the open model's own:
 * the body joint comes down or up by the difference, in every animation. */
function groundShift(M, rigM, rigB) {
  const legs = Object.values(rigM.parts || {}).filter(part => part.limbKind === 'leg');
  if (!legs.length || !rigB.ok) return 0;
  return rigB.ground - rigM.ground;
}
/** The joint that moves the body up and down. When the body joint hangs under a joint that is moved anyway (a parentless
 * donor joint in `loose`), moving both moved the body twice: then it is the topmost joint above the body joint whose
 * position keys are not on a global sequence (else the body joint), and the joints on that line are not moved again.
 * Otherwise (no joint above it, or only the open model's own) the body joint alone, as before. */
function bodyMover(M, body, loose = []) {
  const joint = node => node && JOINT_KEYS.some(key => (M[key] || []).includes(node)), line = [body];
  for (let parent = M.Nodes[body]?.Parent; parent != null && parent !== -1 && joint(M.Nodes[parent]); parent = M.Nodes[parent].Parent) line.unshift(parent);
  const free = id => !(M.Nodes[id]?.Translation?.Keys?.length && isGlobalTrack(M.Nodes[id].Translation, M));
  if (!line.some(id => id !== body && loose.includes(id))) return { mover: body, line: new Set([body]) };
  return { mover: line.find(free) ?? body, line: new Set(line) };
}
function shiftBody(M, body, dz, loose = []) {
  if (Math.abs(dz) < 1e-3) return;
  for (const id of new Set([body, ...loose])) shiftNode(M, id, dz);
  clearTransferCache(M);
}
function shiftNode(M, id, dz) {
  const node = M.Nodes[id];
  if (!node) return;
  // In the parent's rest frame (a body joint usually has no parent).
  const shift = new Vector3(0, 0, dz);
  if (node.Translation?.Keys?.length && !isGlobalTrack(node.Translation, M)) {
    for (const k of node.Translation.Keys) { k.Vector = like(k.Vector, new Vector3().fromArray(k.Vector).add(shift).toArray()); if (node.Translation.LineType === 3) { if (k.InTan) k.InTan = like(k.InTan, new Vector3().fromArray(k.InTan).add(shift).toArray()); if (k.OutTan) k.OutTan = like(k.OutTan, new Vector3().fromArray(k.OutTan).add(shift).toArray()); } }
    for (const sequence of M.Sequences) if (keyable(sequence) && !keysInInterval(node.Translation, sequence.Interval).length) {
      const k = { Frame: sequence.Interval[0], Vector: like(node.Translation.Keys[0].Vector, shift.toArray()) };
      if (node.Translation.LineType >= 2) { k.InTan = like(k.Vector, [0, 0, 0]); k.OutTan = like(k.Vector, [0, 0, 0]); }
      node.Translation.Keys.push(k);
    }
    node.Translation.Keys.sort((a, b) => a.Frame - b.Frame);
  } else if (!node.Translation?.Keys) node.Translation = { LineType: 0, GlobalSeqId: null, Keys: [...new Set(M.Sequences.filter(keyable).map(sequence => sequence.Interval[0]))].sort((a, b) => a - b).map(frame => ({ Frame: frame, Vector: new Float32Array(shift.toArray()) })) };
}
/** Feet down (owner's pick, 19 Nov 2026): per moment, the body joint and every parentless donor joint move up or down
 * by the same amount so the lower foot stands as high above the ground as the donor's lower foot, times `travel`.
 * The change is added onto their existing translation keys, linear in time between shared breakpoints (their own
 * key frames, more only where the change bends); curves are split exactly (de Casteljau), so how the totem root
 * moves against the body is unchanged. */
function feetDown(M, D, rigB, rigA, rigM, loose, travel) {
  clearTransferCache(M);
  if (!rigM.ok) return;
  const legsOf = rig => Object.values(rig.parts).filter(part => part.limbKind === 'leg').map(part => part.marker);
  const feetM = legsOf(rigM), feetA = legsOf(rigA);
  if (!feetM.length || !feetA.length) return;
  const donorById = new Map(allNodes(D).map(n => [n.ObjectId, n]));
  const lowest = (model, byId, feet, ground, sequence, frame) => { const m = sampleNodeMatrices(model, frame, sequence); return Math.min(...feet.map(id => v3(nodePivot(model, byId(id), id)).applyMatrix4(m.get(id)).z)) - ground; };
  heightPerMoment(M, D, rigM, loose, 0.01 * rigB.hipHeight, (index, donorIndex) =>
    frame => lowest(D, id => donorById.get(id), feetA, rigA.ground, donorIndex, frame) * travel - lowest(M, id => M.Nodes[id], feetM, rigB.ground, index, frame));
}
/** Soles down (G1, xfer-overnight.md): the legs are not paired (another number of legs, or one model has none), so the
 * result has no feet of the donor's to stand on. Per moment the body moves so this model's own sole stands as the donor
 * does: with a legged donor, as high above the ground as the donor's lower foot (times `travel`) plus where the sole
 * stands in this model's own Stand; with a legless donor (a Naga, a hovering Banshee), at its own Stand height plus the
 * donor body joint's rise from its Stand (times `travel`), so a flying donor's model flies.
 * The sole: the lowest vertex this model's legs carry, else (no legs) the 2nd percentile of its living body's heights.
 * A donor whose legs are short (one or two joints, R1: a rat's legs end at the shin) has no foot joint either: its rise
 * is its own sole's (the same reading) above where that sole stands in its Stand. */
function solesDown(M, D, model, rigB, rigA, rigM, loose, travel) {
  clearTransferCache(M);
  if (!rigM.ok) return null;
  const ownStand = standSequenceIndex(model), donorStand = standSequenceIndex(D);
  if (ownStand < 0 || donorStand < 0) return null;
  const own = soleReader(model, rigB, ownStand);
  if (!own) return null;
  const { soleOf, sample, standSole: ownSole } = own;
  const donorById = new Map(allNodes(D).map(n => [n.ObjectId, n]));
  const legsA = Object.values(rigA.parts || {}).filter(part => part.limbKind === 'leg');
  const feetA = legsA.map(part => part.marker).filter(id => donorById.has(id));
  const pivotZ = (id, m) => v3(nodePivot(D, donorById.get(id), id)).applyMatrix4(m.get(id)).z;
  const donorBody = rigA.body != null && donorById.has(rigA.body) ? rigA.body : null;
  if (!feetA.length && donorBody == null) return null;
  const bodyRest = donorBody != null ? pivotZ(donorBody, sampleNodeMatrices(D, D.Sequences[donorStand].Interval[0], donorStand)) : 0;
  const donorSole = feetA.length && legsA.some(part => part.short) ? soleReader(D, rigA, donorStand) : null;
  const donorRise = donorSole && donorSole.useLegs
    ? (donorIndex, frame) => { const sole = donorSole.soleOf(D, donorSole.sample, sampleNodeMatrices(D, frame, donorIndex)); return sole == null ? 0 : sole - donorSole.standSole; }
    : feetA.length
      ? (donorIndex, frame) => { const m = sampleNodeMatrices(D, frame, donorIndex); return Math.min(...feetA.map(id => pivotZ(id, m))) - rigA.ground; }
      : (donorIndex, frame) => pivotZ(donorBody, sampleNodeMatrices(D, frame, donorIndex)) - bodyRest;
  heightPerMoment(M, D, rigM, loose, 0.01 * rigB.hipHeight, (index, donorIndex) => frame => {
    const sole = soleOf(M, sample, sampleNodeMatrices(M, frame, index));
    return sole == null ? 0 : ownSole + donorRise(donorIndex, frame) * travel - sole;
  });
  return feetA.length ? 'soles' : 'hover';
}
/** A model's sole (G1): the vertices that make it (the living body = the geosets its Stand shows; the legs' skin when it
 * has legs), at most 1,500 of them, and where it stands in its Stand (median over twelve moments, G1b). `soleOf(target,
 * sample, matrices)` reads the same vertices in `target` (the model itself, or a result with its geosets). */
function soleReader(model, rig, standIndex) {
  const ownNodes = allNodes(model), treeB = nodeIndex(model, ownNodes), legJoint = new Set();
  for (const part of Object.values(rig.parts || {})) if (part.limbKind === 'leg') for (const id of part.joints) legJoint.add(id);
  const onLeg = new Map(), isLeg = id => { if (!onLeg.has(id)) onLeg.set(id, treeB.ancestors(id, true).some(a => legJoint.has(a))); return onLeg.get(id); };
  const stand = model.Sequences[standIndex];
  const shows = index => { const alpha = (model.GeosetAnims || []).find(item => item.GeosetId === index)?.Alpha; return !alpha?.Keys?.length || isGlobalTrack(alpha, model) || sampleShows(model, alpha, stand); };
  const legs = [], all = [];
  (model.Geosets || []).forEach((geoset, g) => {
    if (!shows(g)) return;
    const count = (geoset.Vertices?.length || 0) / 3, skin = geoset.SkinWeights;
    for (let v = 0; v < count; v++) {
      const bones = skin?.length >= (v + 1) * 8 ? [0, 1, 2, 3].filter(i => skin[v * 8 + 4 + i] > 0).map(i => skin[v * 8 + i]) : Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []);
      all.push([g, v]);
      if (legJoint.size && bones.some(isLeg)) legs.push([g, v]);
    }
  });
  const useLegs = legs.length > 0, pool = useLegs ? legs : all;
  if (!pool.length) return null;
  const at = (target, [g, v], m) => {
    const geoset = target.Geosets[g], skin = geoset.SkinWeights, x = geoset.Vertices[v * 3], y = geoset.Vertices[v * 3 + 1], z = geoset.Vertices[v * 3 + 2];
    const hd = skin?.length >= (v + 1) * 8, group = hd ? [0, 1, 2, 3].map(i => skin[v * 8 + i]) : geoset.Groups?.[geoset.VertexGroup?.[v]] || [];
    let sum = 0, total = 0;
    group.forEach((id, i) => { const w = hd ? skin[v * 8 + 4 + i] / 255 : 1, e = m.get(id)?.elements; if (!w) return; sum += (e ? e[2] * x + e[6] * y + e[10] * z + e[14] : z) * w; total += w; });
    return total > 0 ? sum / total : z;
  };
  const soleOf = (target, sample, m) => {
    const heights = sample.map(item => at(target, item, m)).filter(Number.isFinite);
    if (!heights.length) return null;
    if (useLegs) return Math.min(...heights);
    heights.sort((x, y) => x - y);
    return heights[Math.floor(0.02 * (heights.length - 1))];
  };
  // At most 1,500 vertices: the lowest 500 in the own Stand and an even share of the rest.
  const own0 = sampleNodeMatrices(model, stand.Interval[0], standIndex);
  let sample = pool;
  if (pool.length > 1500 && useLegs) {
    const ranked = pool.map(item => [item, at(model, item, own0)]).sort((x, y) => x[1] - y[1]);
    sample = [...ranked.slice(0, 500).map(([item]) => item), ...ranked.slice(500).filter((_, i) => i % Math.ceil((ranked.length - 500) / 1000) === 0).map(([item]) => item)];
  } else if (pool.length > 1500) sample = pool.filter((_, i) => i % Math.ceil(pool.length / 1500) === 0);
  // Where the sole stands in this model's own Stand: the median over twelve moments of it, not its first frame (G1b,
  // analysis-v2 class 6: the Faerie Dragon's dangling legs swing 1.3 hip heights through its Stand).
  const [standStart, standEnd] = stand.Interval;
  const standSoles = Array.from({ length: 12 }, (_, k) => soleOf(model, sample, k ? sampleNodeMatrices(model, Math.round(standStart + k / 11 * (standEnd - standStart)), standIndex) : own0)).filter(Number.isFinite).sort((x, y) => x - y);
  if (!standSoles.length) return null;
  const middle = standSoles.length >> 1, standSole = standSoles.length % 2 ? standSoles[middle] : (standSoles[middle - 1] + standSoles[middle]) / 2;
  return { useLegs, sample, soleOf, standSole };
}
/** The body joint (and the parentless donor joints) move up or down per moment by `changeOf(index, donorIndex)(frame)`
 * in every animation, added onto their keys linear between breakpoints (see `feetDown`). */
function heightPerMoment(M, D, rigM, loose, tolerance, changeOf) {
  const { mover, line } = bodyMover(M, rigM.body, loose);
  const movers = [...new Set([mover, ...loose.filter(id => !line.has(id))])].map(id => M.Nodes[id]).filter(node => node && !(node.Translation?.Keys?.length && isGlobalTrack(node.Translation, M)));
  const donorSequences = (D.Sequences || []).filter(sequence => sequence.Interval);
  const done = new Set(); // two animations on one interval (an HD donor) share their keys: the height goes on once
  M.Sequences.forEach((sequence, index) => {
    const [a, z] = sequence.Interval || [];
    const donorIndex = D.Sequences.indexOf(donorSequences[index]);
    if (!(z > a) || donorIndex < 0 || done.has(`${a},${z}`)) return;
    done.add(`${a},${z}`);
    const cache = new Map(), measure = changeOf(index, donorIndex);
    const change = frame => {
      if (!cache.has(frame)) cache.set(frame, measure(frame));
      return cache.get(frame);
    };
    // Breakpoints: every mover's key frames inside the animation and its ends; then halves wherever the straight
    // line between two breakpoints misses the change by more than a hundredth of hip height (down to 16 ms).
    const ends = new Set([a, z]);
    for (const node of movers) for (const key of node.Translation?.Keys || []) if (key.Frame > a && key.Frame < z) ends.add(key.Frame);
    const sorted = [...ends].sort((x, y) => x - y), frames = [sorted[0]];
    const refine = (f0, f1) => {
      if (f1 - f0 <= 16) return;
      const misses = [0.25, 0.5, 0.75].some(share => { const f = Math.round(f0 + (f1 - f0) * share); return Math.abs(change(f) - (change(f0) + (change(f1) - change(f0)) * (f - f0) / (f1 - f0))) > tolerance; });
      if (!misses) return;
      const mid = Math.round((f0 + f1) / 2);
      refine(f0, mid); frames.push(mid); refine(mid, f1);
    };
    for (let i = 1; i < sorted.length; i++) { refine(sorted[i - 1], sorted[i]); frames.push(sorted[i]); }
    const values = frames.map(change);
    for (const node of movers) addHeight(M, node, sequence.Interval, frames, values);
  });
  clearTransferCache(M);
}
/** Add a height that is linear between `frames` (`values` there; all inside `interval`) onto a node's translation keys
 * in that interval. Keys are added only at those frames, splitting curves exactly. */
function addHeight(M, node, interval, frames, values) {
  const [a, z] = interval;
  if (!node.Translation?.Keys?.length) node.Translation = { LineType: 1, GlobalSeqId: null, Keys: [] };
  const track = node.Translation, type = track.LineType, curved = type === 2 || type === 3;
  const template = track.Keys[0]?.Vector ?? new Float32Array(3);
  const sample = frame => sampleTrack(track, frame, { interval, globalSequences: M.GlobalSequences, fallback: [0, 0, 0] });
  const outside = track.Keys.filter(key => key.Frame < a || key.Frame > z);
  let keys = track.Keys.filter(key => key.Frame >= a && key.Frame <= z).map(key => ({ ...key }));
  // Bezier control points of a segment; Hermite tangents (per segment) converted to them and back.
  const controls = (k0, k1) => type === 3 ? [v3(k0.Vector), v3(k0.OutTan), v3(k1.InTan), v3(k1.Vector)] : [v3(k0.Vector), v3(k0.Vector).addScaledVector(v3(k0.OutTan), 1 / 3), v3(k1.Vector).addScaledVector(v3(k1.InTan), -1 / 3), v3(k1.Vector)];
  const asOut = (p0, p1) => type === 3 ? p1 : p1.clone().sub(p0).multiplyScalar(3), asIn = (p2, p3) => type === 3 ? p2 : p3.clone().sub(p2).multiplyScalar(3);
  const flat = vector => like(template, type === 3 ? vector : [0, 0, 0]);
  // 1. A key at every breakpoint, the curve unchanged.
  for (const frame of frames) {
    if (keys.some(key => key.Frame === frame)) continue;
    const right = keys.findIndex(key => key.Frame > frame);
    if (right <= 0 || !curved || !keys[right - 1].OutTan || !keys[right].InTan) {
      // Outside the keyed span (held value), a linear or stepped track, or a curve without tangents.
      const vector = like(template, sample(frame)), key = { Frame: frame, Vector: vector };
      if (curved) {
        key.InTan = flat(vector); key.OutTan = flat(vector);
        // The held value stays held: the neighbour's tangent toward the new key was unused, now flat.
        if (right === 0) keys[0].InTan = flat(keys[0].Vector);
        if (right < 0 && keys.length) keys[keys.length - 1].OutTan = flat(keys[keys.length - 1].Vector);
      }
      keys.push(key); keys.sort((x, y) => x.Frame - y.Frame);
      continue;
    }
    const k0 = keys[right - 1], k1 = keys[right], s = (frame - k0.Frame) / (k1.Frame - k0.Frame), [p0, p1, p2, p3] = controls(k0, k1);
    const p01 = p0.clone().lerp(p1, s), p12 = p1.clone().lerp(p2, s), p23 = p2.clone().lerp(p3, s), p012 = p01.clone().lerp(p12, s), p123 = p12.clone().lerp(p23, s), p = p012.clone().lerp(p123, s);
    const key = { Frame: frame, Vector: like(template, p.toArray()) };
    k0.OutTan = like(template, asOut(p0, p01).toArray()); key.InTan = like(template, asIn(p012, p).toArray());
    key.OutTan = like(template, asOut(p, p123).toArray()); k1.InTan = like(template, asIn(p23, p3).toArray());
    keys.splice(right, 0, key);
  }
  // 2. The height, linear between breakpoints, onto values and onto each segment's control points.
  const heightAt = frame => {
    const i = frames.findIndex(f => f >= frame);
    if (i < 0) return values[values.length - 1];
    if (frames[i] === frame || i === 0) return values[i];
    return values[i - 1] + (values[i] - values[i - 1]) * (frame - frames[i - 1]) / (frames[i] - frames[i - 1]);
  };
  const lift = (vector, dz) => like(vector, [vector[0], vector[1], vector[2] + dz]);
  const tangents = keys.map(key => ({ in: key.InTan, out: key.OutTan }));
  keys.forEach((key, i) => {
    const d0 = heightAt(key.Frame), next = keys[i + 1], previous = keys[i - 1];
    key.Vector = lift(key.Vector, d0);
    if (!curved) return;
    if (tangents[i].out) key.OutTan = next ? (type === 3 ? lift(tangents[i].out, d0 + (heightAt(next.Frame) - d0) / 3) : lift(tangents[i].out, heightAt(next.Frame) - d0)) : (type === 3 ? lift(tangents[i].out, d0) : tangents[i].out);
    if (tangents[i].in) key.InTan = previous ? (type === 3 ? lift(tangents[i].in, heightAt(previous.Frame) + 2 * (d0 - heightAt(previous.Frame)) / 3) : lift(tangents[i].in, d0 - heightAt(previous.Frame))) : (type === 3 ? lift(tangents[i].in, d0) : tangents[i].in);
  });
  track.Keys = [...outside, ...keys].sort((x, y) => x.Frame - y.Frame);
}

/** No converted limb: only the ground is settled (feet of the open model's proportions in the donor's stance). */
function settleFeet(M, rigB, rigM, notes, loose = []) {
  clearTransferCache(M);
  if (!rigM.ok) { notes.push("The result's legs were not read: its height was not settled."); return; }
  const { mover, line } = bodyMover(M, rigM.body, loose);
  shiftBody(M, mover, groundShift(M, rigM, rigB), loose.filter(id => !line.has(id)));
}
/** The result's body as the donor's, read through the id map (its legs are the donor's): { ok, body, parts (legs), ground },
 * the ground being the lower foot joint's height at the first frame of the result's Stand. */
function mappedRig(M, rigA, mapId) {
  const body = mapId(rigA.body);
  if (body == null || !M.Nodes[body]) return { ok: false };
  const legs = Object.values(rigA.parts).filter(part => part.limbKind === 'leg').map(part => ({ key: part.key, limbKind: 'leg', marker: mapId(part.marker) })).filter(part => part.marker != null && M.Nodes[part.marker]);
  const stand = standSequenceIndex(M), interval = M.Sequences?.[stand]?.Interval;
  let ground = 0;
  if (legs.length && interval) { const m = sampleNodeMatrices(M, interval[0], stand); ground = Math.min(...legs.map(part => v3(nodePivot(M, M.Nodes[part.marker], part.marker)).applyMatrix4(m.get(part.marker)).z)); }
  return { ok: true, body, parts: Object.fromEntries(legs.map(part => [part.key, part])), ground };
}
