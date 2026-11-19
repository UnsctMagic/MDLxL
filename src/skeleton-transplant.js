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
//    belt: a skinned bone outside the body parts) goes with its bone and rides the donor joint
//    its own part joint pairs with, held as the model holds it in its own reference pose; one in
//    `keep` keeps its bone, held the same way. The weapon (v2: the extras on the weapon hand and
//    the one the model's weapon attachment hangs from) instead rides the donor's weapon bone (the
//    joint its weapon attachment hangs from, else its weapon hand), from where the model holds it
//    in the result's reference moment, unless that bone is on the donor's other arm.
// 5. The donor's keys are copied with its animation list. Rotation keys of a transplanted limb
//    are corrected per key by constants so each limb stretch points as the donor's does (the
//    model's own rest shape is kept); position keys are scaled by the size ratio.
// 6. Attachment points are the donor's (its weapon ones hang from the bone carrying the weapon,
//    where the model's own weapon attachment sits on it); its sounds and footprints (`events`) and particle effects
//    (`emitters`) come along when asked. The model's own camera, collision shapes and effects
//    stay; what they key inside its own animations is fitted into the donor animation of the
//    same kind (else its Stand).
import { Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, isGlobalTrack, keysInInterval, nodePivot, sampleNodeMatrices, sampleTrack, visitTracks } from './animation.js';
import { nodeIndex } from './node-hierarchy.js';
import { donorSkinCarriers, legTravelRatio, splitJoints, transplantRuns } from './transplant-skin.js';
import { standSequenceIndex, fillSequenceExtents } from './sequence-editor.js';
import { canonicalizeSerializedNodeOrder } from './node-id-order.js';
import { updateCounts } from './editor-document.js';
import { createResourceImporter } from './model-import.js';
import { adaptPasteFormat } from './paste-format.js';
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
    if (!keys.length && track.Keys.length) { holdTrack(entry, track, ownSequences[ownStand]?.Interval, globalSequences, newSequences); continue; }
    track.Keys = keys.sort((a, b) => a.Frame - b.Frame);
  }
}

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
  track.Keys = [...new Set(newSequences.map(sequence => sequence.Interval[0]))].sort((a, b) => a - b).map(frame => ({ Frame: frame, Vector: like(template, [].concat(value)) }));
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

/** The open model's mesh on the donor's skeleton with the donor's animations.
 * -> { model, report } where model is a new model object (the caller swaps it in as one undo
 * step) and report = { fit: 'good' | 'poor', reasons: [...], follows: share of the body skin that follows the donor,
 * still: [own part keys none of whose joints got a donor joint], notes: [...], converted: [part keys],
 * extras: [{ id, name, vertices, kept }], mirrorOffer: boolean, counts: {...},
 * ownNodes: { [own ObjectId]: ObjectId in the result }, donorNodes: { [donor ObjectId]: ObjectId in the result } }.
 * `keep`: ObjectIds of own extras (their top bone, as `report.extras` lists them) whose bone stays.
 * `events`: the donor's sounds and footprints (else the model's own, fitted to the new animations).
 * `emitters`: the donor's particle effects, ribbons and lights. `mirror`: true takes the donor
 * reflected, left and right exchanged (`report.mirrorOffer` says when its weapon is in the other hand).
 * `extents` (default true): per-animation extents from the sampled motion. `legs`: 'straight' (default) keeps a
 * straight shin along the donor's knee-to-foot chord; 'folded' bends it where the donor's bends. `feet`: 'down' (default)
 * moves the body (and the donor joints that hang from nothing) up or down so the lower foot is as high above the
 * ground as the donor's, times the travel ratio (owner's pick, TEST TRANSPLANT 09); 'free' leaves the height as the keys give it. */
export function transplantSkeleton(model, donor, { keep = [], events = true, emitters = false, mirror = null, extents = true, legs = 'straight', feet = 'down' } = {}) {
  // `hard`: a body not read, no animations, no pairing, too many bone groups. `notes`: said only alongside a poor fit.
  // The report's `reasons` (what the window shows under Poor fit) is built from them at the end.
  const hard = [], notes = [], keepSet = new Set(keep.map(Number));
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
  // thrown off as the donor's weapon is. A weapon bone on the donor's other arm (no mirror taken) is not
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
    const armOf = id => { for (const at of treeA.ancestors(id, true)) { const key = partOfDonor.get(at); if (key != null && rigA.parts[key]?.limbKind === 'arm') return key; } return null; };
    if (bone != null && handTarget) {
      const arm = armOf(bone);
      if (arm != null && arm !== pairedArm) weaponSkip = `The donor's weapon bone is on its other arm: the weapon stays in the hand${mirrorOffer && mirror !== true ? ' (mirroring moves it to the weapon hand)' : ''}.`;
      else donorWeapon = bone;
    }
  }
  // Where the weapon's skin goes: the donor's weapon bone, else (unchanged) the hand it pairs with.
  const weaponRides = donorWeapon != null && weaponExtras.size > 0 && [...weaponExtras].some(id => !keepSet.has(id));
  if (weaponRides) for (const id of weaponChain) decollapse.set(id, Array.from(scaleAt(id, donorStandD >= 0 ? donorStandD : donorIntervals[0])));

  const placed = new Map(), correction = new Map();
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
    if (ancestor != null) { placed.set(id, placeFrom(placed.get(ancestor), ancestor, id)); return; }
    if (below.length) {
      const same = below.find(q => partOfDonor.get(q) != null && partOfDonor.get(q) === partOfDonor.get(id)) ?? below.sort((a, b) => treeA.depth(a) - treeA.depth(b))[0];
      placed.set(id, placeFrom(placed.get(same), same, id));
      return;
    }
    placed.set(id, groundB.clone().add(pA(id).sub(groundA).multiplyScalar(size)));
  };
  for (const id of byDepth) if (isDonorJoint(id)) placeJoint(id);
  // Runs (skin contract 4.2): donor joints placed on this model's line between two paired joints.
  const donorPartJoints = new Set(partOfDonor.keys()), ownPartJoints = new Set(ownPartOf.keys());
  const runs = rigB.ok && rigA.ok ? transplantRuns({ donorPartJoints, ownPartJoints, pairedOwn, isDonorJoint: id => isDonorJoint(id) && keepDonor.has(id), treeA, treeB, pA, pB, minLength: 1e-3 * rigB.hipHeight }) : [];
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
  for (const sequence of newSequences) sequence.MoveSpeed = (Number(sequence.MoveSpeed) || 0) * travel;
  // A track holding one value in every animation (a joint kept still, a constant correction).
  // One key per distinct start, in time order (an HD donor lists its animations out of time order, two on one interval).
  const starts = [...new Set(newSequences.map(sequence => sequence.Interval[0]))].sort((a, b) => a - b);
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
    // Where the donor hides its weapon by scaling it to nothing, the weapon keeps its reference size (in the hand).
    if (decollapse.has(id) && copy.Scaling?.Keys) {
      const rest = decollapse.get(id);
      for (const k of copy.Scaling.Keys) if (collapsed(k.Vector)) {
        k.Vector = like(k.Vector, rest);
        if (k.InTan) k.InTan = like(k.Vector, copy.Scaling.LineType === 3 ? rest : [0, 0, 0]);
        if (k.OutTan) k.OutTan = like(k.Vector, copy.Scaling.LineType === 3 ? rest : [0, 0, 0]);
      }
    }
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
    const lengthA = sameLimb ? pA(id).distanceTo(pA(parentId)) : 0, scale = sameLimb && lengthA > 1e-6 ? placed.get(id).distanceTo(placed.get(parentId)) / lengthA : travel;
    if (copy.Translation?.Keys) {
      const move = v => v && like(v, new Vector3().fromArray(v).applyMatrix3(linear).multiplyScalar(scale).toArray());
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
      for (const top of new Set(bones.map(id => extraTop.get(id)).filter(top => top != null && extras.has(top)))) {
        if (!extraCentre.has(top)) extraCentre.set(top, { sum: new Vector3(), n: 0 });
        const entry = extraCentre.get(top); entry.sum.add(v3(geoset.Vertices.subarray(v * 3, v * 3 + 3))); entry.n++;
      }
    }
  }
  /** Donor joints ({ joint }) or a node that stays ({ own }) for one own bone of a vertex at `point` (bind space). */
  const jointsOf = (id, point) => {
    const t = targetOf(id);
    if (t.own != null) return [{ own: t.own }];
    const hosted = t.via != null ? runsByHost.get(t.via) : null;
    if (!hosted) return [{ joint: t.donor }];
    const top = extraTop.get(id), rigid = top != null && extras.has(top);
    return splitJoints(rigid ? extraCentre.get(top).sum.clone().divideScalar(extraCentre.get(top).n) : point, t.donor, hosted, { band: !rigid }).map(joint => ({ joint }));
  };
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
  const skinCounts = { runs: runs.length, moved: 0, blended: 0, capped: 0, carriers: 0, helpersMadeBones: 0, offBody: 0 };
  /** Result targets of a vertex: [[id, share of the bone's weight]] per bone, capped to four nodes. */
  const vertexTargets = (bones, point) => {
    const perBone = bones.map(id => ({ id, items: jointsOf(id, point) }));
    let moved = false, blended = false;
    for (const { id, items } of perBone) { const t = targetOf(id); if (items.length > 1) blended = true; if (t.donor != null && items.some(item => item.joint !== t.donor)) moved = true; }
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
      // A vertex carried by extras alone rides the part joint they hang from, held as the model's own reference pose holds it.
      if (!rigB.ok || !bones.length || !bones.every(id => extraTop.has(id) && !keptExtra(id))) return;
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

  // ------------------------------------------------------------ ground (no limb is converted since v2)
  const convertedKeys = [];
  // Donor joints that hang from nothing (a thrown weapon's root) settle onto the ground with the body.
  const loose = Object.values(donorMap).filter(id => { const n = M.Nodes[id]; return JOINT_KEYS.some(k => M[k].includes(n)) && (n.Parent == null || n.Parent === -1); });
  if (rigB.ok && rigA.ok) settleFeet(M, rigB, rigA, remap, offset, notes, loose);
  if (rigB.ok && rigA.ok && feet !== 'free') feetDown(M, D, rigB, rigA, loose, travel);
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
  const extrasOut = [...extras.values()].map(({ bones, ...rest }) => rest);
  return {
    model: M,
    report: {
      fit, reasons, follows, still, notes, converted: convertedKeys, extras: extrasOut, mirrorOffer,
      weapon: { extras: [...weaponExtras], bone: donorWeapon != null ? remap.get(newId(donorWeapon)) ?? null : null, rides: weaponRides && !weaponHeld, vertices: new Set(weaponVertices.map(([g, v]) => `${M.Geosets.indexOf(g)}:${v}`)).size, note: weaponSkip },
      counts: {
        sequences: M.Sequences.length, donorJoints: [...M.Bones, ...M.Helpers].filter(n => !Object.values(ownMap).includes(n.ObjectId)).length,
        ownJointsKept: Object.keys(ownMap).filter(id => JOINT_KEYS.some(k => (model[k] || []).includes(ownById.get(Number(id))))).length,
        attachments: (M.Attachments || []).length, events: (M.EventObjects || []).length, emitters: EFFECT_KEYS.reduce((n, k) => n + (M[k] || []).length, 0),
        vertices: (M.Geosets || []).reduce((n, g) => n + g.Vertices.length / 3, 0), bakedVertices: baked, sizeRatio: size, travel, ridesStill, skin: skinCounts,
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
    for (const sequence of M.Sequences) if (!keysInInterval(node.Translation, sequence.Interval).length) {
      const k = { Frame: sequence.Interval[0], Vector: like(node.Translation.Keys[0].Vector, shift.toArray()) };
      if (node.Translation.LineType >= 2) { k.InTan = like(k.Vector, [0, 0, 0]); k.OutTan = like(k.Vector, [0, 0, 0]); }
      node.Translation.Keys.push(k);
    }
    node.Translation.Keys.sort((a, b) => a.Frame - b.Frame);
  } else if (!node.Translation?.Keys) node.Translation = { LineType: 0, GlobalSeqId: null, Keys: [...new Set(M.Sequences.map(sequence => sequence.Interval[0]))].sort((a, b) => a - b).map(frame => ({ Frame: frame, Vector: new Float32Array(shift.toArray()) })) };
}
/** Feet down (owner's pick, 19 Nov 2026): per moment, the body joint and every parentless donor joint move up or down
 * by the same amount so the lower foot stands as high above the ground as the donor's lower foot, times `travel`.
 * The change is added onto their existing translation keys, linear in time between shared breakpoints (their own
 * key frames, more only where the change bends); curves are split exactly (de Casteljau), so how the totem root
 * moves against the body is unchanged. */
function feetDown(M, D, rigB, rigA, loose, travel) {
  const stand = standSequenceIndex(M);
  clearTransferCache(M);
  const rigM = transferRig(M, { sequence: stand >= 0 ? stand : undefined });
  if (!rigM.ok) return;
  const legsOf = rig => Object.values(rig.parts).filter(part => part.limbKind === 'leg').map(part => part.marker);
  const feetM = legsOf(rigM), feetA = legsOf(rigA);
  if (!feetM.length || !feetA.length) return;
  const { mover, line } = bodyMover(M, rigM.body, loose);
  const movers = [...new Set([mover, ...loose.filter(id => !line.has(id))])].map(id => M.Nodes[id]).filter(node => node && !(node.Translation?.Keys?.length && isGlobalTrack(node.Translation, M)));
  const donorSequences = (D.Sequences || []).filter(sequence => sequence.Interval), donorById = new Map(allNodes(D).map(n => [n.ObjectId, n]));
  const lowest = (model, byId, feet, ground, sequence, frame) => { const m = sampleNodeMatrices(model, frame, sequence); return Math.min(...feet.map(id => v3(nodePivot(model, byId(id), id)).applyMatrix4(m.get(id)).z)) - ground; };
  const tolerance = 0.01 * rigB.hipHeight;
  const done = new Set(); // two animations on one interval (an HD donor) share their keys: the height goes on once
  M.Sequences.forEach((sequence, index) => {
    const [a, z] = sequence.Interval || [];
    const donorIndex = D.Sequences.indexOf(donorSequences[index]);
    if (!(z > a) || donorIndex < 0 || done.has(`${a},${z}`)) return;
    done.add(`${a},${z}`);
    const cache = new Map();
    const change = frame => {
      if (!cache.has(frame)) cache.set(frame, lowest(D, id => donorById.get(id), feetA, rigA.ground, donorIndex, frame) * travel - lowest(M, id => M.Nodes[id], feetM, rigB.ground, index, frame));
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
function settleFeet(M, rigB, rigA, remap, offset, notes, loose = []) {
  const stand = standSequenceIndex(M);
  clearTransferCache(M);
  const rigM = transferRig(M, { sequence: stand >= 0 ? stand : undefined });
  if (!rigM.ok) { notes.push("The result's legs were not read: its height was not settled."); return; }
  const { mover, line } = bodyMover(M, rigM.body, loose);
  shiftBody(M, mover, groundShift(M, rigM, rigB), loose.filter(id => !line.has(id)));
  void rigA; void remap; void offset;
}
