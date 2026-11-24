import { Triangle, Vector3 } from 'three';
import { nodePivot, sampleGeosetAnimation, sampleNodeMatrices } from './animation.js';
import { nodeIndex } from './node-hierarchy.js';
import { vertexBones } from './part-bones.js';
import { isWeaponName } from './rig-names.js';

function rigidSurfaces(model, reference) {
  const surfaces = [];
  for (const [gi, geo] of (model.Geosets || []).entries()) {
    if (sampleGeosetAnimation(model, gi, reference.frame, reference.sequence).alpha < .25) continue;
    const byBone = new Map(), rigid = [];
    for (let v = 0; v < geo.Vertices.length / 3; v++) {
      const bones = vertexBones(geo, v);
      if (bones.length !== 1) continue;
      const id = bones[0];
      rigid[v] = id;
      if (!byBone.has(id)) byBone.set(id, { id, points:[], triangles:[] });
      byBone.get(id).points.push(new Vector3().fromArray(geo.Vertices, 3 * v));
    }
    for (let i = 0; i < geo.Faces.length; i += 3) {
      const a = geo.Faces[i], b = geo.Faces[i+1], c = geo.Faces[i+2], id = rigid[a];
      if (id == null || rigid[b] !== id || rigid[c] !== id) continue;
      const point = v => new Vector3().fromArray(geo.Vertices, 3*v);
      byBone.get(id).triangles.push(new Triangle(point(a), point(b), point(c)));
    }
    for (const surface of byBone.values()) if (surface.triangles.length) surfaces.push(surface);
  }
  return surfaces;
}

const contactCache = new WeakMap();

// The marked rigid item, measured against both palms on its visible Attack skin.
// Store material coordinates so the same handle can be followed through a clip.
export function heldContact(model, rig) {
  if (contactCache.has(model)) return contactCache.get(model);
  const contact = measureHeldContact(model, rig);
  contactCache.set(model, contact);
  return contact;
}

function measureHeldContact(model, rig) {
  const refs = (model.Attachments || []).filter(n => /^weapon\b/i.test(n.Name));
  const arms = [rig.parts?.armL, rig.parts?.armR];
  if (refs.length > 1 || !arms.every(Boolean)) return null;
  const tree = nodeIndex(model), root = refs[0]?.Parent;
  const bodyJoint = id => Object.values(rig.parts).some(p=>p.joints.includes(id));
  const si = model.Sequences.findIndex(s => /^attack\b/i.test(s.Name.trim()));
  if (si < 0) return null;
  const [lo,hi] = model.Sequences[si].Interval, frame = Math.round((lo+hi)/2);
  const visible = rigidSurfaces(model,{frame,sequence:si});
  let surfaces = root != null && !bodyJoint(root) ? visible.filter(s => tree.isAncestor(s.id,root)) : [];
  const marked = surfaces.length > 0;
  if (!marked) {
    // A marker can be on a hidden alternate weapon. Read the rigid weapon
    // actually drawn in Attack. A single named carrier avoids guessing
    // between a bow, a projectile and equipment on the other hand.
    const named = visible.filter(s => !bodyJoint(s.id) && isWeaponName(tree.byId.get(s.id)?.Name || ''));
    const ids = new Set(named.map(s=>s.id));
    if (ids.size===1) surfaces=named;
    else {
      const read=readHeldItem(model,rig);
      if (read && !bodyJoint(read.carrier)) surfaces=visible.filter(s=>s.id===read.carrier);
    }
  }
  const surface = surfaces.sort((a,b) => dimensions(b.points).length-dimensions(a.points).length)[0];
  if (!surface) return null;
  const {length, a, b} = dimensions(surface.points);
  if (length < .55*Math.min(...arms.map(arm => arm.length))) return null;
  const hands = arms.map(arm => model.Attachments.find(n => /^hand\b/i.test(n.Name) && n.Parent===arm.marker)?.ObjectId ?? arm.marker);
  const samples = hands.map(()=>[]);
  for (let i=0;i<=8;i++) {
    const w = sampleNodeMatrices(model,Math.round(lo+(hi-lo)*i/8),si), carrier = w.get(surface.id);
    if (!carrier || Math.abs(carrier.determinant()) < 1e-8) continue;
    const inverse = carrier.clone().invert();
    hands.forEach((hand,side) => {
      const palm = new Vector3().fromArray(nodePivot(model,model.Nodes[hand])).applyMatrix4(w.get(hand)).applyMatrix4(inverse);
      let near, gap=Infinity;
      for (const triangle of surface.triangles) {
        const p = triangle.closestPointToPoint(palm,new Vector3()), d = p.distanceTo(palm);
        if (d < gap) {gap=d;near=p;}
      }
      if (near) samples[side].push({gap,near});
    });
  }
  if (samples.some(s=>s.length<5)) return null;
  for (const s of samples) s.sort((a,b)=>a.gap-b.gap);
  const med = samples.map(s=>s[s.length>>1]);
  const onArm = arms.findIndex(arm=>tree.isAncestor(surface.id,arm.marker));
  const side = onArm>=0 ? onArm : med[0].gap<med[1].gap ? 0 : 1;
  const held = samples.map((s,i)=>s.filter(x=>x.gap<=.22*arms[i].length).length >= Math.ceil(s.length*.65));
  if (!held[side] && med[side].gap > .55*arms[side].length) return null;
  const grip = med[side].near, tip = a.distanceToSquared(grip)>b.distanceToSquared(grip)?a:b;
  return {marked,carrier:surface.id,hand:hands[side],arm:arms[side].key,grip,tip,length,support:med[1-side].near,
    twoHands:held.every(Boolean) && med[0].near.distanceTo(med[1].near) > .06*length};
}

function dimensions(points) {
  const far = p => points.reduce((best, v) => v.distanceToSquared(p) > best.distanceToSquared(p) ? v : best);
  const a = far(points[0]), b = far(a), axis = b.clone().sub(a);
  const length = axis.length();
  axis.normalize();
  let radius = 0;
  const delta = new Vector3();
  for (const p of points) radius = Math.max(radius, delta.subVectors(p, a).cross(axis).length());
  return {length, radius, a, b};
}

// Locate the same material point on a rigid surface in several ordinary poses.
// A sliding nearest vertex can make a sleeve look like an independent held item.
export function readHeldItem(model, rig) {
  const arms = Object.values(rig.parts).filter(p => p.limbKind === 'arm');
  if (!arms.length || !rig.ok) return null;
  const tree = nodeIndex(model), armJoints = new Set(arms.flatMap(p => p.joints));
  const joints = new Set(Object.values(rig.parts).flatMap(p => p.joints));
  const refs = (model.Attachments || []).filter(a => /^weapon\b/i.test(a.Name));
  const at = (frame, sequence) => sampleNodeMatrices(model, frame, sequence);
  const ref = at(rig.reference.frame, rig.reference.sequence);
  const poses = [ref];
  for (const [si, seq] of (model.Sequences || []).entries()) {
    if (!/^(stand|walk|attack)\b/i.test(seq.Name.trim())) continue;
    const [lo, hi] = seq.Interval;
    for (const t of [0, .5, .8]) poses.push(at(Math.round(lo + (hi-lo)*t), si));
  }
  const best = new Map();
  for (const {id, points, triangles} of rigidSurfaces(model, rig.reference)) {
    if (!ref.has(id) || (joints.has(id) && !armJoints.has(id))) continue;
    const attached = refs.some(a => tree.isAncestor(a.Parent, id));
    const {length, radius, a, b} = dimensions(points);
    for (const arm of arms) {
      const hand = arm.marker, reach = arm.length;
      if (!ref.has(hand)) continue;
      if (!(reach > 0 && length > .55 * reach) || (!attached && length < 1.65 * radius)) continue;
      const ownArm = arms.find(p => tree.isAncestor(id, p.marker));
      if (ownArm && ownArm !== arm) continue;
      if (!ownArm && joints.has(id)) continue;
      const pivot = new Vector3().fromArray(nodePivot(model,tree.byId.get(hand),hand));
      // A two-joint arm ends at the elbow pivot. Its POSE endpoint locates
      // the wrist in the terminal bone's reference space.
      if (arm.joints.length === 2 && arm.tip) pivot.copy(arm.tip).applyMatrix4(ref.get(hand).clone().invert());
      const local = pivot.clone().applyMatrix4(ref.get(hand)).applyMatrix4(ref.get(id).clone().invert());
      const grip = points[0].clone(), nearest = new Vector3();
      for (const triangle of triangles) {
        triangle.closestPointToPoint(local, nearest);
        if (nearest.distanceToSquared(local) < grip.distanceToSquared(local)) grip.copy(nearest);
      }
      const startGap = grip.distanceTo(local);
      if (startGap > .38*reach) continue;
      const gaps = poses.filter(m => m.has(hand) && m.has(id)).map(m =>
        grip.clone().applyMatrix4(m.get(id)).distanceTo(pivot.clone().applyMatrix4(m.get(hand))));
      gaps.sort((a,b) => a-b);
      const gap = gaps[Math.floor(.8*(gaps.length-1))];
      if (!(gap <= .40*reach)) continue;
      // A flat shield can reach the palm as well. Prefer a long, narrow
      // surface, with a reference on its rigid branch as supporting evidence.
      const endReach = Math.max(a.distanceTo(grip), b.distanceTo(grip)) / length;
      const score = endReach * endReach * length / reach * Math.min(4, length / Math.max(.04*reach, radius)) /
        (1 + 3*gap/reach) * (attached ? 1.35 : 1);
      const marked = refs.some(a => a.Parent === id);
      const previous = best.get(hand);
      if (!previous || (marked && !previous.marked) || (marked === previous.marked && previous.score < score))
        best.set(hand, {side:arm.side, hand, carrier:id, score, marked, detached:!ownArm});
    }
  }
  // Articulated equipment may span several rigid branches below a single
  // hand. The arm reader also measures their combined surface in Stand.
  for (const arm of arms) {
    if (!arm.weapon || !refs.some(a => a.Parent === arm.marker)) continue;
    if (!best.has(arm.marker)) best.set(arm.marker, {side:arm.side, hand:arm.marker, carrier:arm.marker,
      score:arm.weapon.length / arm.length * 2, marked:false, detached:false});
  }
  const ranked = [...best.values()].sort((a,b) => Number(b.marked)-Number(a.marked) || b.score-a.score);
  if (!ranked.length || (ranked.length>1 && ranked[1].marked === ranked[0].marked && ranked[1].score >= .9*ranked[0].score)) return null;
  return ranked[0];
}
