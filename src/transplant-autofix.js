// Auto fix for a transplant (owner, 22 Nov 2026: "offer users an AUTO FIX ... to avoid regressions on other models,
// offer it as an option"). Off by default: without it the transplant is exactly the plain one. Each correction has
// its own key, reads the two models (never names alone), acts only where its fault is measured, and says what it did.
// Contract: docs/agent-tasks/xfer-auto-fix.md.
//   hand     which hand holds the weapon, and so the automatic Mirror, from what is held (heldSide, autoFixMirror)
//   markers  the grip and tip the weapon fit reads, from the measured item when the model's Hand/Weapon markers are off it
//   detached a weapon on its own bone is recognised without the name test (skeleton-transplant.js, detachedGrip)
//   trunk    the trunk posture turn is left out when this model has no legs and no hip-to-shoulder line (skeleton-transplant.js)
import { Vector3 } from 'three';
import { allNodes, nodePivot, sampleNodeMatrices, skinGeoset, worldPivot } from './animation.js';
import { vertexBones } from './part-bones.js';
import { isWeaponName } from './rig-names.js';

export const AUTO_FIX_KEYS = Object.freeze(['hand', 'markers', 'detached', 'trunk']);
/** A marker is off its item past these: the grip marker 30% of a hip height from the real grip, or the marker line 30 deg off the item. */
export const MARKER_GRIP_SHARE = 0.3, MARKER_TIP_DEGREES = 30;
/** A detached item is held by the hand it stays within this share of the standing height of, and at most half as far as the other hand. */
export const HELD_SHARE = 0.2, HELD_CLEARLY = 0.5;
/** On a model with no legs, a hip-to-shoulder line shorter than this share of the standing height is no trunk line to turn. */
export const TRUNK_LINE_SHARE = 0.08;

/** `true` turns every correction on; an object turns on the keys it holds true. -> { hand, markers, detached, trunk } or null. */
export function autoFixOptions(value) {
  if (!value) return null;
  const on = Object.fromEntries(AUTO_FIX_KEYS.map(key => [key, value === true || value[key] === true]));
  return AUTO_FIX_KEYS.some(key => on[key]) ? on : null;
}

const arms = rig => Object.values(rig?.parts || {}).filter(part => part.limbKind === 'arm');
const referenceMatrices = (model, rig) => sampleNodeMatrices(model, rig.reference?.frame ?? 0, rig.reference?.sequence ?? 0);
const index = model => { const nodes = allNodes(model); return { nodes, byId: new Map(nodes.map(node => [node.ObjectId, node])) }; };
const underOf = byId => (id, top) => { const seen = new Set(); for (let node = byId.get(id); node && !seen.has(node.ObjectId); node = byId.get(node.Parent)) { if (node.ObjectId === top) return true; seen.add(node.ObjectId); } return false; };

/** The model's height at its reference pose (all its skin). */
export function standingHeight(model, rig) {
  const matrices = referenceMatrices(model, rig);
  let low = Infinity, high = -Infinity;
  for (const geoset of model.Geosets || []) {
    const points = skinGeoset(geoset, matrices);
    for (let i = 2; i < points.length; i += 3) { if (points[i] < low) low = points[i]; if (points[i] > high) high = points[i]; }
  }
  return high > low ? high - low : 0;
}

/** The hand a detached rigid item stays with: a skinned bone outside every body part, with a Weapon attachment below it or
 * long and thin, whose skin stays near one hand through the Stand and Walk animations. -> { side, name } or null. */
function detachedHolder(model, rig, { nodes, byId }) {
  const hands = arms(rig), under = underOf(byId);
  if (hands.length < 2) return null;
  const partJoints = new Set(Object.values(rig.parts || {}).flatMap(part => part.joints)), skins = new Map();
  for (const geoset of model.Geosets || []) for (let v = 0; v < (geoset.Vertices?.length || 0) / 3; v++) {
    const bones = vertexBones(geoset, v);
    if (bones.length !== 1 || partJoints.has(bones[0])) continue;
    let top = bones[0], inPart = false;
    const seen = new Set();
    for (let node = byId.get(bones[0]); node && !seen.has(node.ObjectId); node = byId.get(node.Parent)) { if (partJoints.has(node.ObjectId)) { inPart = true; break; } top = node.ObjectId; seen.add(node.ObjectId); }
    if (inPart) continue;
    if (!skins.has(top)) skins.set(top, []);
    skins.get(top).push({ id: bones[0], p: new Vector3().fromArray(geoset.Vertices, v * 3) });
  }
  if (!skins.size) return null;
  const height = standingHeight(model, rig);
  if (!(height > 0)) return null;
  const clips = (model.Sequences || []).map((sequence, at) => ({ sequence, at })).filter(({ sequence }) => sequence.Interval && /^(stand|walk)/i.test(String(sequence.Name || '').trim()) && !/portrait|victory|channel|swim/i.test(sequence.Name)).slice(0, 4);
  if (!clips.length) return null;
  let best = null;
  for (const [top, list] of skins) {
    if (list.length < 6) continue;
    const marked = (model.Attachments || []).some(node => /weapon/i.test(node.Name || '') && under(node.Parent, top));
    const centre = list.reduce((sum, item) => sum.add(item.p), new Vector3()).divideScalar(list.length);
    let axis = new Vector3(1, 0.3, 0.2).normalize();
    for (let pass = 0; pass < 30; pass++) { const next = new Vector3(); for (const item of list) { const d = item.p.clone().sub(centre); next.addScaledVector(d, d.dot(axis)); } if (next.lengthSq() < 1e-12) break; axis = next.normalize(); }
    const along = list.map(item => item.p.clone().sub(centre).dot(axis)), length = Math.max(...along) - Math.min(...along);
    const across = Math.max(...list.map(item => { const d = item.p.clone().sub(centre); return d.addScaledVector(axis, -d.dot(axis)).length(); }));
    if (!marked && !(length > 0.4 * height && length > 3.6 * across)) continue;
    const step = Math.ceil(list.length / 60), sample = list.filter((_, i) => i % step === 0), worst = hands.map(() => 0);
    for (const { sequence, at } of clips) for (let k = 0; k <= 6; k++) {
      const world = sampleNodeMatrices(model, Math.round(sequence.Interval[0] + (sequence.Interval[1] - sequence.Interval[0]) * k / 6), at);
      hands.forEach((arm, a) => {
        const hand = worldPivot(model, arm.marker, world, byId.get(arm.marker));
        let gap = Infinity;
        for (const item of sample) { const matrix = world.get(item.id); if (matrix) gap = Math.min(gap, item.p.clone().applyMatrix4(matrix).distanceTo(hand)); }
        worst[a] = Math.max(worst[a], gap);
      });
    }
    const order = hands.map((arm, a) => ({ arm, gap: worst[a] })).sort((x, y) => x.gap - y.gap);
    if (order[0].gap <= HELD_SHARE * height && order[0].gap <= HELD_CLEARLY * order[1].gap && (!best || list.length > best.vertices)) best = { side: order[0].arm.side, name: byId.get(top)?.Name ?? '', vertices: list.length };
  }
  return best && (best.side === 'L' || best.side === 'R') ? best : null;
}

/** Which hand holds the model's weapon, read from what is held. -> { side: 'L' | 'R' | null, why }.
 * 1. One arm has a weapon-named bone below its hand (the plain rule): it stands when that arm holds a measured item or a
 *    weapon-named bone there carries skin. A name on an empty helper gives way to the one other arm that holds a measured item.
 * 2. No named arm: the one arm that holds a measured item; with none, the hand a detached item stays with.
 * Anything else is unknown (null): the plain decision then stands. */
export function heldSide(model, rig) {
  if (!rig?.ok) return { side: null, why: 'unread' };
  const read = index(model), under = underOf(read.byId), hands = arms(rig);
  const named = hands.filter(part => part.named), items = hands.filter(part => part.weapon);
  if (named.length === 1) {
    const arm = named[0], skinned = new Set();
    for (const geoset of model.Geosets || []) for (let v = 0; v < (geoset.Vertices?.length || 0) / 3; v++) for (const id of vertexBones(geoset, v)) skinned.add(id);
    const backed = arm.weapon || read.nodes.some(node => node.ObjectId !== arm.marker && skinned.has(node.ObjectId) && isWeaponName(node.Name) && under(node.ObjectId, arm.marker));
    if (backed) return { side: arm.side, why: 'named' };
    const others = items.filter(part => part !== arm);
    return others.length === 1 ? { side: others[0].side, why: 'item' } : { side: null, why: 'empty name' };
  }
  if (named.length > 1) return { side: null, why: 'two names' };
  if (items.length === 1) return { side: items[0].side, why: 'item' };
  if (items.length > 1) return { side: null, why: 'two items' };
  const holder = detachedHolder(model, rig, read);
  return holder ? { side: holder.side, why: 'detached', name: holder.name } : { side: null, why: 'nothing held' };
}

/** The automatic Mirror from what the two models hold: true or false when both hands are read, else null (the plain
 * decision, by names, stands). `rigA` is the donor's rig as it is, not mirrored. */
export function autoFixMirror(model, rigB, donor, rigA) {
  const own = heldSide(model, rigB), theirs = heldSide(donor, rigA);
  return own.side && theirs.side ? own.side !== theirs.side : null;
}

/** The arm whose item the markers describe, with the item's real grip and tip in the world at the rig's reference pose,
 * and how far the model's own markers are off them. -> null when no arm holds a measured item. */
function markerReading(model, rig) {
  if (!rig?.ok) return null;
  const { byId } = index(model), under = underOf(byId), held = arms(rig).filter(part => part.weapon).sort((a, b) => b.weapon.length - a.weapon.length);
  if (!held.length) return null;
  const matrices = referenceMatrices(model, rig);
  const tipMarker = (model.Attachments || []).find(node => /weapon/i.test(node.Name || '') && node.Parent != null && node.Parent >= 0) ?? null;
  const arm = held.find(part => tipMarker && under(tipMarker.Parent, part.marker)) ?? held[0], world = matrices.get(arm.marker);
  if (!world) return null;
  const butt = new Vector3().fromArray(arm.weapon.butt).applyMatrix4(world), tip = new Vector3().fromArray(arm.weapon.tip).applyMatrix4(world), line = tip.clone().sub(butt);
  if (line.lengthSq() < 1e-9) return null;
  const hand = worldPivot(model, arm.marker, matrices, byId.get(arm.marker));
  const grip = butt.clone().addScaledVector(line, Math.max(0, Math.min(1, hand.clone().sub(butt).dot(line) / line.lengthSq())));
  const gripMarker = (model.Attachments || []).find(node => /hand/i.test(node.Name || '') && node.Parent === arm.marker) ?? null;
  const onArm = tipMarker && under(tipMarker.Parent, arm.marker) ? tipMarker : null;
  let gripOff = null, tipOff = null;
  if (gripMarker) {
    const at = worldPivot(model, gripMarker.ObjectId, matrices, gripMarker);
    gripOff = at.distanceTo(grip) / Math.max(1e-6, rig.hipHeight);
    if (onArm) { const marked = worldPivot(model, onArm.ObjectId, matrices, onArm).sub(at); tipOff = marked.lengthSq() > 1e-12 ? marked.angleTo(line) * 180 / Math.PI : 180; }
  }
  return { grip, tip, gripMarker: gripMarker?.ObjectId ?? null, tipMarker: onArm?.ObjectId ?? null, gripOff, tipOff, matrices };
}

function moveMarker(model, id, target, matrices) {
  const node = allNodes(model).find(item => item.ObjectId === id);
  if (!node) return;
  const parent = matrices.get(node.Parent);
  if (!parent || Math.abs(parent.determinant()) < 1e-12) return;
  const pivot = target.clone().applyMatrix4(parent.clone().invert()).toArray();
  node.PivotPoint = new Float32Array(pivot);
  if (model.PivotPoints) model.PivotPoints[id] = node.PivotPoint;
}

/** Private copies of the two models with the grip and tip markers on the measured item, when a marker of either model is
 * off its item. The inputs are never changed. -> { model, donor } or null (nothing to correct). */
export function fixMarkers(model, donor, rigB, rigA) {
  const own = markerReading(model, rigB), theirs = markerReading(donor, rigA);
  const off = reading => !!reading && ((reading.gripOff ?? 0) > MARKER_GRIP_SHARE || (reading.tipOff ?? 0) > MARKER_TIP_DEGREES);
  if (!off(own) && !off(theirs)) return null;
  const corrected = (source, reading) => {
    if (!reading || reading.gripMarker == null && reading.tipMarker == null) return source;
    const copy = structuredClone(source);
    if (reading.gripMarker != null) moveMarker(copy, reading.gripMarker, reading.grip, reading.matrices);
    if (reading.tipMarker != null) moveMarker(copy, reading.tipMarker, reading.tip, reading.matrices);
    return copy;
  };
  const nextModel = corrected(model, own), nextDonor = corrected(donor, theirs);
  return nextModel === model && nextDonor === donor ? null : { model: nextModel, donor: nextDonor };
}

/** What Auto fix did, in the words the window shows. `mirror`: { held, named, used } from the window. */
export function autoFixNotes(report, mirror = null) {
  const notes = [], did = report?.autoFix || {};
  if (mirror && mirror.held != null && mirror.held !== mirror.named && mirror.used === mirror.held) notes.push(mirror.held ? 'Mirror on: the weapon hands differ.' : 'Mirror off: both hold the weapon in the same hand.');
  if (did.markers) notes.push('Weapon set by its real grip and tip.');
  if (did.detached?.length) notes.push('Loose weapon put in the hand.');
  if (did.trunk) notes.push('Body tilt left out: no legs to stand on.');
  return notes;
}
