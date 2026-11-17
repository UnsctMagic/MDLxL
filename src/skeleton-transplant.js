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
// 2. A limb whose donor counterpart has a joint inside the limb that no joint here takes (a hock,
//    a hand the model lacks) is converted: it keeps its own joints and the retargeting engine
//    drives them in every donor animation (Pose = Theirs, feet kept down). Every other paired
//    limb is transplanted: the donor's joints are fitted into this model's joints.
// 3. Donor joints sit on this model's joints (paired), on this model's line between its
//    neighbours (a donor collar or neck it lacks), or at the donor's offset scaled by the size
//    ratio (a tail, a weapon root).
// 4. The mesh is bound to the donor joint each of its bones pairs with. An extra (weapon, plate,
//    belt: a skinned bone outside the body parts) goes with its bone and rides the donor joint
//    its own part joint pairs with, held as the model holds it in its own reference pose; one in
//    `keep` keeps its bone, held the same way.
// 5. The donor's keys are copied with its animation list. Rotation keys of a transplanted limb
//    are corrected per key by constants so each limb stretch points as the donor's does (the
//    model's own rest shape is kept); position keys are scaled by the size ratio.
// 6. Attachment points are the donor's; its sounds and footprints (`events`) and particle effects
//    (`emitters`) come along when asked. The model's own camera, collision shapes and effects
//    stay; what they key inside its own animations is fitted into the donor animation of the
//    same kind (else its Stand).
import { Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, isGlobalTrack, keysInInterval, nodePivot, sampleNodeMatrices, sampleTrack, visitTracks } from './animation.js';
import { nodeIndex } from './node-hierarchy.js';
import { standSequenceIndex, fillSequenceExtents } from './sequence-editor.js';
import { canonicalizeSerializedNodeOrder } from './node-id-order.js';
import { updateCounts } from './editor-document.js';
import { createResourceImporter } from './model-import.js';
import { adaptPasteFormat } from './paste-format.js';
import {
  buildTransfer, clearTransferCache, copyBodyAnimation, defaultTransferPart, newSequenceExtents, sameKindSequence,
  transferNodeTracks, transferPartLabel, transferRig, transferWholeBody,
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
    return { start, length, clock: { sequence: kind, first: own.Interval[0], length: ownLength, looping, start: 0, rate, amount: 1, blend: 0 } };
  });
  for (const entry of entries) {
    if (entry.event) {
      const original = entry.owner.EventTrack;
      if (isGlobalTrack(entry.owner, { GlobalSequences: globalSequences })) continue;
      const frames = [];
      for (const plan of plans) {
        if (!plan) continue;
        const copy = { EventTrack: Array.from(original), GlobalSeqId: entry.owner.GlobalSeqId };
        copyBodyAnimation(holderOf([copy]), plan.clock, plan.start, plan.length);
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
      const copy = { [name]: structuredClone(track) };
      copyBodyAnimation(holderOf([copy]), plan.clock, plan.start, plan.length);
      keys.push(...copy[name].Keys.filter(key => key.Frame >= plan.start && key.Frame <= plan.start + plan.length));
    }
    track.Keys = keys.sort((a, b) => a.Frame - b.Frame);
  }
}

/** The open model's mesh on the donor's skeleton with the donor's animations.
 * -> { model, report } where model is a new model object (the caller swaps it in as one undo
 * step) and report = { fit: 'good' | 'poor', reasons: [...], converted: [part keys],
 * extras: [{ id, name, vertices, kept }], mirrorOffer: boolean, counts: {...},
 * ownNodes: { [own ObjectId]: ObjectId in the result }, donorNodes: { [donor ObjectId]: ObjectId in the result } }.
 * `keep`: ObjectIds of own extras (their top bone, as `report.extras` lists them) whose bone stays.
 * `events`: the donor's sounds and footprints (else the model's own, fitted to the new animations).
 * `emitters`: the donor's particle effects, ribbons and lights. `mirror`: true takes the donor
 * reflected, left and right exchanged (`report.mirrorOffer` says when its weapon is in the other hand).
 * `extents` (default true): per-animation extents from the sampled motion. */
export function transplantSkeleton(model, donor, { keep = [], events = true, emitters = false, mirror = null, extents = true } = {}) {
  const reasons = [], keepSet = new Set(keep.map(Number));
  // ------------------------------------------------------------ read both bodies
  const ownStand = standSequenceIndex(model);
  const rigB = transferRig(model, { sequence: ownStand >= 0 ? ownStand : undefined });
  const donorStand0 = standSequenceIndex(donor), rigA0 = transferRig(donor, { sequence: donorStand0 >= 0 ? donorStand0 : undefined });
  const mirrorOffer = !!(rigB.ok && rigA0.ok && rigA0.weaponSide && rigB.weaponSide && rigA0.weaponSide !== rigB.weaponSide);
  const reflected = mirror === true ? mirrorModel(donor) : donor;
  if (mirror === true) clearTransferCache(reflected);
  const rigA = mirror === true ? transferRig(reflected, { sequence: donorStand0 >= 0 ? donorStand0 : undefined }) : rigA0;
  // The donor's node data in this model's format (materials and versioned fields).
  const D = reflected.Version === model.Version ? structuredClone(reflected) : adaptPasteFormat(reflected, model.Version);
  if (!rigB.ok) reasons.push(`The open model's body was not recognised: ${rigB.problems.join(' ')}`);
  if (!rigA.ok) reasons.push(`The donor's body was not recognised: ${rigA.problems.join(' ')}`);
  if (!(D.Sequences || []).some(s => s.Interval)) reasons.push('The donor has no animations.');

  const ownNodes = allNodes(model), ownById = new Map(ownNodes.map(n => [n.ObjectId, n])), treeB = nodeIndex(model, ownNodes);
  const donorNodes = allNodes(D), donorById = new Map(donorNodes.map(n => [n.ObjectId, n])), treeA = nodeIndex(D, donorNodes);
  const pB = id => v3(nodePivot(model, ownById.get(id), id)), pA = id => v3(nodePivot(D, donorById.get(id), id));
  const size = rigB.ok && rigA.ok ? rigB.hipHeight / rigA.hipHeight : 1;
  const hipB = rigB.ok ? bindHipCentre(model, rigB) : new Vector3(), hipA = rigA.ok ? bindHipCentre(D, rigA) : new Vector3();
  const groundB = new Vector3(hipB.x, hipB.y, 0), groundA = new Vector3(hipA.x, hipA.y, 0);

  // ------------------------------------------------------------ pairing (the engine's own)
  let entries = [];
  const whole = rigB.ok && rigA.ok ? transferWholeBody(rigB, rigA) : { parts: [], reason: null };
  if (whole.reason) reasons.push(whole.reason);
  if (rigB.ok && rigA.ok && ownStand >= 0 && donorStand0 >= 0 && whole.parts.length) {
    const recipe = { base: { sequence: ownStand }, length: null, sources: { d: { mirror: false } }, parts: Object.fromEntries(whole.parts.map(key => [key, { ...defaultTransferPart(rigB, key, true), source: 'd', sequence: donorStand0, match: 1, plant: false, grip: false }])) };
    try { buildTransfer(model, new Map([['d', reflected]]), recipe, { times: [0], probe: ({ entries: found }) => { entries = found; } }); }
    catch (error) { reasons.push(`The bodies could not be paired: ${error.message}`); }
  }
  // An arm, leg or wing the donor has no counterpart for makes a poor fit; a tail only rides still.
  const ridesStill = [];
  for (const [key, part] of Object.entries(rigB.parts || {})) {
    if (part.kind !== 'limb' || entries.some(entry => entry.key === key)) continue;
    ridesStill.push(key);
    if (part.limbKind !== 'tail') reasons.push(`The donor has no ${transferPartLabel(key).toLowerCase()} to give this model's: it rides the donor's body without moving by itself.`);
  }

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
  for (const entry of limbEntries) {
    const mapped = entry.map.filter(j => j >= 0), lo = Math.min(...mapped), hi = Math.max(...mapped);
    const skipped = mapped.length ? entry.theirs.joints.map((_, j) => j).filter(j => j > lo && j < hi && !mapped.includes(j)) : [];
    if (skipped.length) {
      converted.push(entry);
      for (const id of entry.own.joints) keptOwn.add(id);
      entry.theirs.joints.forEach((id, j) => {
        dropped.add(id);
        let cover = entry.own.joints[0];
        entry.map.forEach((m, i) => { if (m >= 0 && m <= j) cover = entry.own.joints[i]; });
        coverOf.set(id, cover);
      });
    } else {
      transplanted.push(entry);
      entry.own.joints.forEach((id, i) => {
        if (entry.map[i] < 0) return;
        const target = entry.theirs.joints[entry.map[i]];
        jointTarget.set(id, target);
        if (!pairedOwn.has(target)) pairedOwn.set(target, id);
      });
    }
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
  // Where an own bone's skin goes: a donor joint ({ donor }) or a joint that stays ({ own }); `via` is the
  // own part joint whose place the target takes (null for a joint that keeps its own place).
  const resolved = new Map();
  const targetOf = id => {
    if (resolved.has(id)) return resolved.get(id);
    let result;
    if (keptOwn.has(id) || keptExtra(id) || outsideKept.has(id)) result = { own: id, via: null };
    else if (jointTarget.has(id)) result = { donor: jointTarget.get(id), via: id };
    else if (ownPartOf.has(id)) { const part = rigB.parts[ownPartOf.get(id)], anchor = part.anchor ?? treeB.parentOf(part.joints[0]); result = anchor != null ? { ...targetOf(anchor), via: anchor } : { donor: fallbackDonor, via: null }; }
    else { const up = treeB.ancestors(id).find(a => partJoint(a) || keptOwn.has(a) || outsideKept.has(a)); result = up != null ? { ...targetOf(up), via: up } : { donor: fallbackDonor, via: null }; }
    if (result.own != null) result = { own: result.own, via: null };
    resolved.set(id, result);
    return result;
  };

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
  const placed = new Map(), correction = new Map();
  const isDonorJoint = id => JOINT_KEYS.some(k => (D[k] || []).includes(donorById.get(id)));
  const byDepth = [...keepDonor].sort((a, b) => treeA.depth(a) - treeA.depth(b));
  // Paired joints first, then the rest from the top.
  for (const [donorId, ownId] of pairedOwn) if (keepDonor.has(donorId)) placed.set(donorId, pB(ownId));
  const pairedBelow = id => { const found = []; const walk = at => { for (const child of treeA.children.get(at) || []) { if (!keepDonor.has(child.ObjectId)) continue; if (pairedOwn.has(child.ObjectId)) found.push(child.ObjectId); else walk(child.ObjectId); } }; walk(id); return found; };
  const placeFrom = (anchorPlace, anchorDonor, id, turn = null) => { const offset = pA(id).sub(pA(anchorDonor)).multiplyScalar(size); return anchorPlace.clone().add(turn ? offset.applyQuaternion(inv(turn)) : offset); };
  const placeJoint = id => {
    if (placed.has(id)) return;
    const parent = donorParent(id);
    const below = pairedBelow(id);
    if (parent?.own != null) { placed.set(id, placeFrom(pB(parent.own), parent.from, id)); return; }
    const ancestor = parent?.donor;
    if (ancestor != null && below.length === 1) {
      // On this model's line between the joint above and the paired joint below, at the donor's share of that path.
      const q = below[0], path = [q]; for (let at = treeA.parentOf(q); at != null && at !== id; at = treeA.parentOf(at)) path.unshift(at);
      const pts = [pA(id), ...path.map(pA)]; let after = 0; for (let i = 1; i < pts.length; i++) after += pts[i].distanceTo(pts[i - 1]);
      const before = pA(ancestor).distanceTo(pA(id)), f = before + after > 1e-6 ? before / (before + after) : 0;
      placed.set(id, placed.get(ancestor).clone().lerp(placed.get(q), f));
      return;
    }
    if (ancestor != null) { placed.set(id, placeFrom(placed.get(ancestor), ancestor, id)); return; }
    if (below.length) {
      const same = below.find(q => partOfDonor.get(q) != null && partOfDonor.get(q) === partOfDonor.get(id)) ?? below.sort((a, b) => treeA.depth(a) - treeA.depth(b))[0];
      placed.set(id, placeFrom(placed.get(same), same, id));
      return;
    }
    placed.set(id, groundB.clone().add(pA(id).sub(groundA).multiplyScalar(size)));
  };
  for (const id of byDepth) if (isDonorJoint(id)) placeJoint(id);
  // Corrections: each transplanted limb joint turns this model's stretch onto the donor's.
  for (const entry of transplanted) {
    const joints = entry.theirs.joints;
    let previous = new Quaternion();
    joints.forEach((id, j) => {
      const next = joints[j + 1];
      let turn = previous;
      if (next != null && placed.has(id) && placed.has(next)) {
        const mine = placed.get(next).clone().sub(placed.get(id)), theirs = pA(next).sub(pA(id));
        if (mine.length() > 1e-3 * rigB.hipHeight && theirs.length() > 1e-3 * rigA.hipHeight) turn = arc(mine, theirs);
      }
      correction.set(id, turn.clone()); previous = turn;
    });
  }
  const trunkJoint = id => { const key = partOfDonor.get(id); return key != null && rigA.parts[key]?.kind === 'trunk'; };
  const correctionOf = id => {
    if (correction.has(id)) return correction.get(id);
    if (id == null || trunkJoint(id)) return new Quaternion();
    const parent = treeA.parentOf(id), value = parent == null || dropped.has(parent) ? new Quaternion() : correctionOf(parent).clone();
    correction.set(id, value);
    return value;
  };
  for (const id of byDepth) if (!isDonorJoint(id)) {
    const parent = donorParent(id);
    if (parent?.own != null) placed.set(id, placeFrom(pB(parent.own), parent.from, id));
    else if (parent?.donor != null) placed.set(id, placeFrom(placed.get(parent.donor), parent.donor, id, correctionOf(parent.donor)));
    else placed.set(id, groundB.clone().add(pA(id).sub(groundA).multiplyScalar(size)));
  }

  // ------------------------------------------------------------ the new model
  const M = structuredClone({ ...model, Nodes: undefined });
  delete M.Nodes;
  const offset = Math.max(-1, ...ownNodes.map(n => n.ObjectId)) + 1, newId = id => id + offset;
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
      if (partJoint(parent) || jointTarget.has(parent)) { const target = targetOf(parent); return target.own != null ? target.own : newId(target.donor); }
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
  for (const sequence of newSequences) sequence.MoveSpeed = (Number(sequence.MoveSpeed) || 0) * size;
  // A track holding one value in every animation (a joint kept still, a constant correction).
  const constantTrack = (value, template) => ({ LineType: 0, GlobalSeqId: null, Keys: newSequences.map(sequence => ({ Frame: sequence.Interval[0], Vector: like(template ?? new Float32Array(value.length), value) })) });
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
  const importer = emitters ? createResourceImporter(D, M, { reuseTextures: 'fingerprint' }) : null;
  for (const id of byDepth) {
    const node = donorById.get(id), copy = structuredClone(node), key = NODE_KEYS.find(k => (D[k] || []).includes(node));
    copy.ObjectId = newId(id);
    const parent = donorParent(id);
    copy.Parent = parent == null ? null : parent.own != null ? parent.own : newId(parent.donor);
    copy.PivotPoint = new Float32Array(placed.get(id).toArray());
    if (key === 'Bones') { copy.GeosetId = null; copy.GeosetAnimId = null; }
    const parentTurn = parent?.donor != null ? correctionOf(parent.donor) : new Quaternion(), ownTurn = correctionOf(id);
    const pre = inv(parentTurn), linear = new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromQuaternion(pre));
    visitTracks(copy, globalShift, { event: globalShift });
    // A track on a global sequence of no length never plays: it holds its first key.
    visitTracks(copy, (track, { owner, property }) => {
      if (track.GlobalSeqId !== NO_LENGTH) return;
      if (track.Keys.length && !Array.isArray(owner)) owner[property] = constantTrack(Array.from(track.Keys[0].Vector), track.Keys[0].Vector);
      else track.GlobalSeqId = null;
    });
    if (copy.GlobalSeqId === NO_LENGTH) copy.GlobalSeqId = null;
    // Rotation: q' = C(parent)^-1 q C(self), per key and tangent; constant where the donor has no key.
    const fixed = pre.clone().multiply(ownTurn);
    if (copy.Rotation?.Keys) {
      const turn = v => { if (!v) return v; const q = pre.clone().multiply(new Quaternion().fromArray(v)).multiply(ownTurn); return like(v, q.toArray()); };
      for (const k of copy.Rotation.Keys) { k.Vector = turn(k.Vector); if (k.InTan) k.InTan = turn(k.InTan); if (k.OutTan) k.OutTan = turn(k.OutTan); }
      if (!near(fixed) && !isGlobalTrack(copy.Rotation, M)) {
        for (const sequence of newSequences) if (!keysInInterval(copy.Rotation, sequence.Interval).length) {
          const value = fixed.toArray(), k = { Frame: sequence.Interval[0], Vector: like(copy.Rotation.Keys[0].Vector, value) };
          if (copy.Rotation.LineType >= 2) { k.InTan = like(copy.Rotation.Keys[0].Vector, value); k.OutTan = like(copy.Rotation.Keys[0].Vector, value); }
          copy.Rotation.Keys.push(k);
        }
        copy.Rotation.Keys.sort((a, b) => a.Frame - b.Frame);
      }
    } else if (!near(fixed)) copy.Rotation = constantTrack(fixed.toArray());
    // Translation: scaled to this model and turned into the corrected parent's frame. Inside a transplanted
    // limb a joint's move is scaled by its own stretch (this model's length over the donor's), so the
    // stretch keeps pointing as the donor's does; elsewhere by the size ratio.
    const parentId = parent?.donor;
    const sameLimb = parentId != null && correction.has(id) && correction.has(parentId) && partOfDonor.get(id) === partOfDonor.get(parentId);
    const lengthA = sameLimb ? pA(id).distanceTo(pA(parentId)) : 0, scale = sameLimb && lengthA > 1e-6 ? placed.get(id).distanceTo(placed.get(parentId)) / lengthA : size;
    if (copy.Translation?.Keys) {
      const move = v => v && like(v, new Vector3().fromArray(v).applyMatrix3(linear).multiplyScalar(scale).toArray());
      for (const k of copy.Translation.Keys) { k.Vector = move(k.Vector); if (k.InTan) k.InTan = move(k.InTan); if (k.OutTan) k.OutTan = move(k.OutTan); }
    }
    if (importer && key === 'ParticleEmitters2' && copy.TextureID != null && copy.TextureID !== -1) copy.TextureID = importer.textureRef(node.TextureID);
    if (importer && key === 'RibbonEmitters') copy.MaterialID = importer.materialRef(node.MaterialID);
    if (key === 'ParticleEmitterPopcorns' && M.Version < 900) continue;
    collections[key].push(copy);
  }
  for (const key of NODE_KEYS) M[key] = collections[key];
  M.PivotPoints = [];
  M.Sequences = newSequences;

  // ------------------------------------------------------------ skin
  const skinTarget = id => { const t = targetOf(id); return t.own != null ? t.own : newId(t.donor); };
  const viaOf = id => targetOf(id).via;
  const skinned = new Set(), inverseRef = new Map();
  const refInverse = id => { if (!inverseRef.has(id)) inverseRef.set(id, (ownRef.get(id) || new Matrix4()).clone().invert()); return inverseRef.get(id); };
  let baked = 0;
  for (const geoset of M.Geosets || []) {
    const count = (geoset.Vertices?.length || 0) / 3;
    const bake = (v, bones) => {
      // A vertex carried by extras alone rides the part joint they hang from, held as the model's own reference pose holds it.
      if (!rigB.ok || !bones.length || !bones.every(id => extraTop.has(id) && !keptExtra(id))) return;
      const vias = new Set(bones.map(viaOf));
      if (vias.size !== 1) return;
      const via = [...vias][0];
      if (via == null) return;
      const p = new Vector3(), n = new Vector3(), at = v3(geoset.Vertices.subarray(v * 3, v * 3 + 3)), normal = v3(geoset.Normals?.subarray(v * 3, v * 3 + 3) || [0, 0, 1]);
      for (const id of bones) { const m = ownRef.get(id) || new Matrix4(); p.add(at.clone().applyMatrix4(m)); n.add(normal.clone().transformDirection(m)); }
      p.divideScalar(bones.length).applyMatrix4(refInverse(via));
      n.transformDirection(refInverse(via));
      if (p.distanceTo(at) > 1e-4) baked++;
      geoset.Vertices.set(p.toArray(), v * 3);
      if (geoset.Normals?.length === geoset.Vertices.length) geoset.Normals.set(n.normalize().toArray(), v * 3);
    };
    if (geoset.SkinWeights?.length >= count * 8 && count) {
      const weights = geoset.SkinWeights;
      for (let v = 0; v < count; v++) {
        const merged = new Map(), bones = [];
        for (let i = 0; i < 4; i++) { const w = weights[v * 8 + 4 + i]; if (!w) continue; bones.push(weights[v * 8 + i]); const t = skinTarget(weights[v * 8 + i]); merged.set(t, (merged.get(t) || 0) + w); }
        bake(v, bones);
        const list = [...merged].sort((a, b) => b[1] - a[1]).slice(0, 4);
        for (let i = 0; i < 4; i++) { weights[v * 8 + i] = list[i]?.[0] ?? 0; weights[v * 8 + 4 + i] = list[i]?.[1] ?? 0; }
        for (const [t] of list) skinned.add(t);
      }
    }
    const groups = [], index = new Map(), vertexGroup = [];
    for (let v = 0; v < count; v++) {
      const bones = Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []);
      if (!(geoset.SkinWeights?.length >= count * 8)) bake(v, bones);
      const targets = [...new Set(bones.map(skinTarget))].sort((a, b) => a - b);
      const key = targets.join(',');
      if (!index.has(key)) { index.set(key, groups.length); groups.push(targets); }
      vertexGroup.push(index.get(key));
      for (const t of targets) skinned.add(t);
    }
    if (groups.length > 256) reasons.push(`A geoset needs ${groups.length} bone groups after the transplant; the format holds 256.`);
    geoset.Groups = groups;
    geoset.VertexGroup = like(geoset.VertexGroup || new Uint8Array(count), vertexGroup);
    geoset.TotalGroupsCount = groups.reduce((sum, group) => sum + group.length, 0);
  }
  if ((M.BindPoses || []).length) { reasons.push('The open model has bind poses (Reforged skinning); they are left out of the result.'); M.BindPoses = []; }
  // A donor helper that carries skin becomes a bone; a still donor joint with no skin, keys or children goes.
  const hasKeys = node => ['Translation', 'Rotation', 'Scaling'].some(p => node[p]?.Keys?.length);
  for (const node of [...M.Helpers]) if (skinned.has(node.ObjectId) && node.ObjectId >= offset) {
    M.Helpers = M.Helpers.filter(n => n !== node);
    node.Flags = (node.Flags & ~TYPE_FLAGS) | BONE_FLAG; node.GeosetId = null; node.GeosetAnimId = null;
    M.Bones.push(node);
  }
  for (let changed = true; changed;) {
    changed = false;
    const parents = new Set(NODE_KEYS.flatMap(k => M[k]).map(n => n.Parent).filter(p => p != null && p !== -1));
    for (const key of JOINT_KEYS) {
      const before = M[key].length;
      // A donor bone exists to carry skin: without any here and with nothing hanging from it, it goes, keys or
      // not (the donor's weapon and gut pieces). A helper with keys stays (a tail, a weapon root): it costs nothing.
      M[key] = M[key].filter(n => n.ObjectId < offset || skinned.has(n.ObjectId) || parents.has(n.ObjectId) || key === 'Helpers' && hasKeys(donorById.get(n.ObjectId - offset)));
      if (M[key].length !== before) changed = true;
    }
  }

  // ------------------------------------------------------------ everything else timed in animations
  const ownSequences = model.Sequences || [];
  const timed = ownTimedTracks([M.GeosetAnims || [], M.Materials || [], M.TextureAnims || [], M.Cameras || [], ...NODE_KEYS.flatMap(k => M[k].filter(n => n.ObjectId < offset && !JOINT_KEYS.includes(k)))]);
  refitTracks(timed, ownSequences, M.GlobalSequences, newSequences, ownStand >= 0 ? ownStand : 0);
  for (const geoset of M.Geosets || []) fillSequenceExtents(M, geoset, { onlyIfPresent: false });

  // ------------------------------------------------------------ ids
  const remap = canonicalizeSerializedNodeOrder(M);
  const ownMap = {}, donorMap = {};
  for (const node of ownNodes) if (remap.has(node.ObjectId) && ownKeep.has(node.ObjectId)) ownMap[node.ObjectId] = remap.get(node.ObjectId);
  for (const node of donorNodes) if (remap.has(newId(node.ObjectId))) donorMap[node.ObjectId] = remap.get(newId(node.ObjectId));
  M.Info = { ...(M.Info || {}) };
  updateCounts(M);

  // ------------------------------------------------------------ converted limbs: the retargeting engine
  const convertedKeys = [];
  if (converted.length) convert(M, D, rigB, rigA, converted, remap, ownStand, donorStand0, reasons, convertedKeys, size);
  else if (rigB.ok && rigA.ok) settleFeet(M, rigB, rigA, remap, offset, reasons);
  if (extents) for (let i = 0; i < M.Sequences.length; i++) newSequenceExtents(M, i);
  updateCounts(M);

  const fit = reasons.length ? 'poor' : 'good';
  const extrasOut = [...extras.values()].map(({ bones, ...rest }) => rest);
  return {
    model: M,
    report: {
      fit, reasons, converted: convertedKeys, extras: extrasOut, mirrorOffer,
      counts: {
        sequences: M.Sequences.length, donorJoints: [...M.Bones, ...M.Helpers].filter(n => !Object.values(ownMap).includes(n.ObjectId)).length,
        ownJointsKept: Object.keys(ownMap).filter(id => JOINT_KEYS.some(k => (model[k] || []).includes(ownById.get(Number(id))))).length,
        attachments: (M.Attachments || []).length, events: (M.EventObjects || []).length, emitters: EFFECT_KEYS.reduce((n, k) => n + (M[k] || []).length, 0),
        vertices: (M.Geosets || []).reduce((n, g) => n + g.Vertices.length / 3, 0), bakedVertices: baked, sizeRatio: size, ridesStill,
      },
      ownNodes: ownMap, donorNodes: donorMap,
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
function shiftBody(M, body, dz) {
  if (Math.abs(dz) < 1e-3) return;
  const node = M.Nodes[body];
  if (!node) return;
  // In the parent's rest frame (a body joint usually has no parent).
  const shift = new Vector3(0, 0, dz);
  if (node.Translation?.Keys?.length && !isGlobalTrack(node.Translation, M)) {
    for (const k of node.Translation.Keys) { k.Vector = like(k.Vector, new Vector3().fromArray(k.Vector).add(shift).toArray()); if (node.Translation.LineType === 3) { if (k.InTan) k.InTan = like(k.InTan, new Vector3().fromArray(k.InTan).add(shift).toArray()); if (k.OutTan) k.OutTan = like(k.OutTan, new Vector3().fromArray(k.OutTan).add(shift).toArray()); } }
    for (const sequence of M.Sequences) if (!keysInInterval(node.Translation, sequence.Interval).length) {
      const k = { Frame: sequence.Interval[0], Vector: like(node.Translation.Keys[0].Vector, shift.toArray()) };
      if (node.Translation.LineType >= 2) { k.InTan = like(k.Vector, [0, 0, 0]); k.OutTan = like(k.Vector, [0, 0, 0]); }
      node.Translation.Keys.push(k);
    }
    node.Translation.Keys.sort((a, b) => a.Frame - b.Frame);
  } else if (!node.Translation?.Keys) node.Translation = { LineType: 0, GlobalSeqId: null, Keys: M.Sequences.map(sequence => ({ Frame: sequence.Interval[0], Vector: new Float32Array(shift.toArray()) })) };
  clearTransferCache(M);
}
/** No converted limb: only the ground is settled (feet of the open model's proportions in the donor's stance). */
function settleFeet(M, rigB, rigA, remap, offset, reasons) {
  const stand = standSequenceIndex(M);
  clearTransferCache(M);
  const rigM = transferRig(M, { sequence: stand >= 0 ? stand : undefined });
  if (!rigM.ok) { reasons.push(`The result's body was not recognised: ${rigM.problems.join(' ')}`); return; }
  shiftBody(M, rigM.body, groundShift(M, rigM, rigB));
  void rigA; void remap; void offset;
}

/** Converted limbs keep their own joints; the retargeting engine drives them in every donor animation,
 * on the result itself (its trunk is the donor's): Pose = Theirs, feet kept down, hands free. First the
 * Stand, so the result's reference pose stands as the donor does; then the ground is settled; then every
 * animation. */
function convert(M, D, rigB, rigA, converted, remap, ownStand, donorStand, reasons, convertedKeys, size) {
  void size; void ownStand;
  const stand = standSequenceIndex(M);
  clearTransferCache(M); clearTransferCache(D);
  let rigM = transferRig(M, { sequence: stand >= 0 ? stand : undefined });
  if (!rigM.ok) { reasons.push(`The result's body was not recognised, so converted limbs keep their rest pose: ${rigM.problems.join(' ')}`); return; }
  // Each converted own limb, found again on the result by its end joint.
  const parts = [];
  for (const entry of converted) {
    const marker = remap.get(entry.own.marker), key = Object.keys(rigM.parts).find(k => rigM.parts[k].marker === marker);
    if (!key) { reasons.push(`${transferPartLabel(entry.key)} was not recognised on the result, so it keeps its rest pose.`); continue; }
    parts.push({ key, from: entry.theirs.key, joints: rigM.parts[key].joints, leg: rigM.parts[key].limbKind === 'leg', own: entry.key });
    convertedKeys.push(entry.key);
  }
  if (!parts.length) return;
  const legs = parts.some(part => part.leg) && rigM.parts.hips && rigA.parts.hips;
  const sources = new Map([['d', D]]);
  const recipeFor = (sequence, plant) => {
    const interval = M.Sequences[sequence].Interval, recipeParts = {};
    // Pose = Theirs with the placing a leg needs (feet kept down); hands free and not aimed like the donor's weapon.
    for (const part of parts) recipeParts[part.key] = { ...defaultTransferPart(rigM, part.key, true), source: 'd', sequence, from: part.from, match: 1, plant, grip: false, aim: 0, clear: false };
    if (legs && plant) recipeParts.hips = { ...defaultTransferPart(rigM, 'hips', true), source: 'd', sequence, from: 'hips', match: 1 };
    return { base: { sequence }, length: interval[1] - interval[0], sources: { d: { mirror: false } }, parts: recipeParts };
  };
  // `wanted`: [id, [properties]] pairs; only those are written (the trunk keeps the donor's own keys).
  const write = (results, wanted) => {
    for (const [id, properties] of wanted) for (const property of properties) {
      const pieces = results.map(({ sequence, tracks }) => ({ sequence, track: tracks.find(t => t.id === id && t.property === property)?.track })).filter(item => item.track);
      if (!pieces.length) continue;
      const node = M.Nodes[id], base = node[property]?.Keys ? node[property] : null;
      const inside = (frame, list) => list.some(({ sequence }) => frame >= M.Sequences[sequence].Interval[0] && frame <= M.Sequences[sequence].Interval[1]);
      const keys = (base?.Keys || []).filter(k => !inside(k.Frame, pieces));
      for (const { sequence, track } of pieces) { const [a, b] = M.Sequences[sequence].Interval; keys.push(...track.Keys.filter(k => k.Frame >= a && k.Frame <= b)); }
      node[property] = { ...(base || { GlobalSeqId: null }), LineType: pieces[0].track.LineType, Keys: keys.sort((x, y) => x.Frame - y.Frame) };
    }
    clearTransferCache(M);
  };
  const jointIds = parts.flatMap(part => part.joints).map(id => [id, ['Rotation']]);
  // 1. The Stand, placing off.
  if (stand >= 0) {
    try {
      const built = buildTransfer(M, sources, recipeFor(stand, false));
      write([{ sequence: stand, tracks: transferNodeTracks(M, stand, built) }], jointIds);
    } catch (error) { reasons.push(`Converted limbs could not take the donor's Stand: ${error.message}`); }
  }
  // 2. The ground.
  rigM = transferRig(M, { sequence: stand >= 0 ? stand : undefined });
  if (rigM.ok) shiftBody(M, rigM.body, groundShift(M, rigM, rigB));
  rigM = transferRig(M, { sequence: stand >= 0 ? stand : undefined });
  // 3. Every animation, feet kept down.
  const results = [];
  let failed = 0;
  M.Sequences.forEach((sequence, index) => {
    if (!sequence.Interval || sequence.Interval[1] <= sequence.Interval[0]) return;
    try { const built = buildTransfer(M, sources, recipeFor(index, true)); results.push({ sequence: index, tracks: transferNodeTracks(M, index, built) }); }
    catch { failed++; }
  });
  if (failed) reasons.push(`Converted limbs could not follow ${failed} donor animation${failed > 1 ? 's' : ''}.`);
  write(results, legs ? [...jointIds, [rigM.body, ['Translation']]] : jointIds);
  void donorStand;
}
