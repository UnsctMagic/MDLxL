import { Vector3 } from 'three';
import { nodePivot, sampleTrack, isGlobalTrack } from './animation.js';
import { vertexBones } from './part-bones.js';
import { geosetAlphaTrack, geosetVisibleIn } from './geoset-extras.js';

const projectile = /arrow|missile|projectile/i;
const weapon = /weapon|spear|javelin|rifle|sword|choppa|axe|hammer|staff|bow/i;

// A detached weapon can rotate around its grip in the source animations. Compare
// its surface with the moving hand across the ordinary poses, rather than
// measuring drift of the weapon tip, which is supposed to swing away.
export function detachedGrip(model, rig, tree, id, points, samples, includeGripPivot = false) {
  if (!samples.length || !weapon.test(tree.byId.get(id)?.Name) || !(model.Attachments || []).some(n => /weapon/i.test(n.Name) && n.Parent === id)) return null;
  // The grip can sit in the middle of a long shaft with no vertex there.
  if (includeGripPivot) points = [...points, new Vector3().fromArray(nodePivot(model,tree.byId.get(id),id))];
  const arms = Object.values(rig.parts).filter(p => p.limbKind === 'arm');
  const scores = arms.map(arm => {
    const carriers = [...tree.byId.values()].filter(n => tree.isAncestor(n.ObjectId, arm.joints[0]) && /hand|palm|wrist/i.test(n.Name));
    if (!carriers.length) carriers.push(tree.byId.get(arm.marker));
    let worst = 0;
    for (const {m} of samples) {
      let gap = Infinity;
      const prop = m.get(id);
      if (!prop) continue;
      for (const hand of carriers) {
        if (!hand || !m.has(hand.ObjectId)) continue;
        const palm = new Vector3().fromArray(nodePivot(model, hand)).applyMatrix4(m.get(hand.ObjectId));
        for (const p of points) gap = Math.min(gap, p.clone().applyMatrix4(prop).distanceTo(palm));
      }
      worst = Math.max(worst, gap);
    }
    return { joint:arm.marker, worst };
  }).sort((a,b) => a.worst-b.worst);
  return scores[0]?.worst < 0.4 * rig.hipHeight && scores[0].worst < 0.7 * (scores[1]?.worst ?? Infinity) ? scores[0].joint : null;
}

function skinNames(geoset, nodes) {
  const ids = new Set();
  for (let i=0; i<geoset.Vertices.length/3; i++) for (const id of vertexBones(geoset,i)) ids.add(id);
  return [...ids].map(id => nodes.get(id)?.Name || '');
}

// Only change separate prop geometry. On a mixed body/weapon mesh the body must
// never disappear with the weapon. A thrown copy still carries the same weapon.
export function transplantPropVisibility(M, own, donor, treeB, treeA, stand, swaps, keep, constantTrack) {
  const hasMissile = (donor.Bones || []).some(n => projectile.test(n.Name));
  let donorWeaponGeos;
  for (const [gi,g] of (own.Geosets || []).entries()) {
    const original = geosetAlphaTrack(own,gi);
    if (!original?.Keys?.length || isGlobalTrack(original,own)) continue;
    const anim = M.GeosetAnims.find(a => a.GeosetId === gi);
    const names = skinNames(g,treeB.byId);
    if (!names.length || !anim || [...keep].some(id => names.includes(treeB.byId.get(id)?.Name))) continue;
    if (!hasMissile && names.every(n => projectile.test(n))) {
      anim.Alpha = constantTrack([0]);
      continue;
    }
    if (!stand || !names.every(n => weapon.test(n) && !projectile.test(n)) || !geosetVisibleIn(own,original,stand)) continue;
    donorWeaponGeos ??= donor.Geosets.map((geo,i) => skinNames(geo,treeA.byId).some(n => weapon.test(n) && !projectile.test(n) && !/death|corpse/i.test(n)) ? i : -1).filter(i => i >= 0);
    if (!donorWeaponGeos.length) continue;
    const tracks = donorWeaponGeos.map(i => geosetAlphaTrack(donor,i));
    if (tracks.some(track => isGlobalTrack(track,donor))) continue;
    const alpha = anim.Alpha;
    for (const seq of M.Sequences.filter(s => /attack/i.test(s.Name))) {
      const [a,b] = seq.Interval;
      const ownKeys = alpha.Keys.filter(k => k.Frame >= a && k.Frame <= b);
      const steps = new Set([a,b,...ownKeys.map(k => k.Frame)]);
      for (const track of tracks) for (const k of track?.Keys || []) if (k.Frame >= a && k.Frame <= b) steps.add(k.Frame);
      const thrown = swaps.filter(s => s.sequence === seq.Name).flatMap(s => s.spans);
      for (const [lo,hi] of thrown) for (const f of [a+lo,a+hi,a+hi+1]) if (f >= a && f <= b) steps.add(f);
      const visible = f => thrown.some(([lo,hi]) => f-a >= lo && f-a <= hi) ? 1 :
        Math.max(...tracks.map(track => sampleTrack(track,f,{interval:seq.Interval,fallback:1})));
      if ([...steps].every(f => Math.abs(sampleTrack(alpha,f,{interval:seq.Interval,fallback:1})-visible(f)) < 1e-5)) continue;
      alpha.Keys = alpha.Keys.filter(k => k.Frame < a || k.Frame > b);
      for (const f of steps) {
        const Vector = new Float32Array([visible(f)]);
        alpha.Keys.push(alpha.LineType >= 2 ? {Frame:f,Vector,InTan:Vector.slice(),OutTan:Vector.slice()} : {Frame:f,Vector});
      }
      alpha.Keys.sort((a,b) => a.Frame-b.Frame);
    }
  }
}
