import { Triangle, Vector3 } from 'three';
import { nodePivot, sampleGeosetAnimation, sampleNodeMatrices } from './animation.js';
import { nodeIndex } from './node-hierarchy.js';
import { vertexBones } from './part-bones.js';

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