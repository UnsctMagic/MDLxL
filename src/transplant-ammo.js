// A loaded arrow or bolt copies the donor's (CP14e, owner 24 Nov 2026, cases 17 and 19: "arrow doesnt move
// forward", "arrow doesnt react/disappear"). When both models carry ammunition on a bone named for it, the
// model's own ammunition sits against the result's hand where the donor's sits against the donor's hand,
// moves with it, and shows and hides when the donor's does (scale 0 while hidden). Geometry is the model's own.
import { Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, nodePivot, sampleGeosetAnimation, sampleNodeMatrices } from './animation.js';
import { vertexBones } from './part-bones.js';

const AMMO = /arrow|bolt|quarrel|missile|ammo|projectile|dart/i;
const BONE_FLAG = 256, STEP = 33, MAX_SAMPLES = 60;

function ammoSkin(model) {
  const out = [];
  for (const [gi, g] of model.Geosets.entries()) for (let v = 0; v < g.Vertices.length / 3; v++) {
    const bones = vertexBones(g, v);
    if (bones.length && bones.every(id => AMMO.test(model.Nodes[id]?.Name || ''))) out.push([gi, v]);
  }
  return out;
}
const centre = points => points.reduce((s, p) => s.add(p), new Vector3()).divideScalar(points.length);
function longAxis(points) {
  const c = centre(points);
  let axis = new Vector3(1, .3, .2).normalize();
  for (let k = 0; k < 40; k++) {
    const next = new Vector3();
    for (const p of points) { const d = p.clone().sub(c); next.addScaledVector(d, d.dot(axis)); }
    if (next.lengthSq() < 1e-12) break;
    axis = next.normalize();
  }
  return { c, axis };
}
const pivotAt = (m, id, w) => new Vector3().fromArray(nodePivot(m, m.Nodes[id], id)).applyMatrix4(w.get(id));
const visible = (m, refs, f, si) => [...new Set(refs.map(([gi]) => gi))].some(gi => sampleGeosetAnimation(m, gi, f, si).alpha > .25);

/** donor: the (possibly mirrored) donor the result was made from. */
export function ammoFollowsDonor(M, own, donor, rigA, rigB, donorMap) {
  if (!rigA?.ok || !rigB?.ok) return null;
  const mine = ammoSkin(own), theirs = ammoSkin(donor);
  if (mine.length < 3 || theirs.length < 3) return null;
  if (mine.some(([gi]) => !M.Geosets[gi] || M.Geosets[gi].Vertices.length !== own.Geosets[gi].Vertices.length)) return null;
  const donorArms = Object.values(rigA.parts).filter(p => p.limbKind === 'arm');
  if (!donorArms.length) return null;
  const skinAt = (m, refs, w) => refs.map(([gi, v]) => {
    const g = m.Geosets[gi], ids = vertexBones(g, v), p = new Vector3().fromArray(g.Vertices, 3 * v), sum = new Vector3();
    for (const id of ids) sum.add(p.clone().applyMatrix4(w.get(id) || new Matrix4()));
    return sum.divideScalar(ids.length);
  });
  // The donor's Attack moments where its ammunition shows: the reference placement and the hand it stays nearest.
  const attacks = donor.Sequences.map((s, i) => [s, i]).filter(([s]) => /^attack/i.test(s.Name.trim()));
  let reference = null;
  const near = new Map();
  for (const [s, i] of attacks) for (let k = 0; k <= 10; k++) {
    const f = Math.round(s.Interval[0] + k * (s.Interval[1] - s.Interval[0]) / 10);
    if (!visible(donor, theirs, f, i)) continue;
    const w = sampleNodeMatrices(donor, f, i), pts = skinAt(donor, theirs, w), c = centre(pts);
    reference ??= { f, i, pts };
    for (const arm of donorArms) near.set(arm, (near.get(arm) || 0) + pivotAt(donor, arm.marker, w).distanceTo(c));
  }
  if (!reference) return null;
  const arm = [...near].sort((a, b) => a[1] - b[1])[0][0];
  const hand = arm.marker, resultHand = donorMap[hand];
  if (resultHand == null || !M.Nodes[resultHand]) return null;
  // Own ammunition, tip forward: in the model's own Attack where it shows, the end along the facing is the tip.
  const stored = mine.map(([gi, v]) => new Vector3().fromArray(own.Geosets[gi].Vertices, 3 * v));
  const ownLine = longAxis(stored);
  const ownFront = new Vector3(...(rigB.facing || [1, 0, 0])).setZ(0).normalize();
  const ownAttack = own.Sequences.findIndex(s => /^attack/i.test(s.Name.trim()));
  if (ownAttack >= 0) {
    const [a, z] = own.Sequences[ownAttack].Interval;
    for (let k = 0; k <= 10; k++) {
      const f = Math.round(a + k * (z - a) / 10);
      if (!visible(own, mine, f, ownAttack)) continue;
      const w = sampleNodeMatrices(own, f, ownAttack), pts = skinAt(own, mine, w), line = longAxis(pts);
      const tipWorld = line.axis.clone(); if (tipWorld.dot(ownFront) < 0) tipWorld.negate();
      // carry the world tip direction back to stored space through the first ammunition vertex's bones
      const [gi, v] = mine[0], ids = vertexBones(own.Geosets[gi], v);
      if (ownLine.axis.clone().transformDirection(w.get(ids[0]) || new Matrix4()).dot(tipWorld) < 0) ownLine.axis.negate();
      break;
    }
  }
  const donorFront = new Vector3(...(rigA.facing || [1, 0, 0])).setZ(0).normalize();
  const donorLine = longAxis(reference.pts);
  if (donorLine.axis.dot(donorFront) < 0) donorLine.axis.negate();
  // Own stored arrow onto the donor's at the reference moment, own size kept.
  const turn = new Quaternion().setFromUnitVectors(ownLine.axis, donorLine.axis);
  const place = new Matrix4().compose(donorLine.c.clone().sub(ownLine.c.clone().applyQuaternion(turn)), turn, new Vector3(1, 1, 1));
  const refWorld = sampleNodeMatrices(donor, reference.f, reference.i);
  const inHand = refWorld.get(hand).clone().invert().multiply(place);   // stored arrow -> donor hand space
  const pivot = ownLine.c.clone();
  const bone = { Name: 'Ammunition', ObjectId: Math.max(...allNodes(M).map(n => n.ObjectId)) + 1, Parent: null,
    PivotPoint: new Float32Array(pivot.toArray()), Flags: BONE_FLAG, GeosetId: null, GeosetAnimId: null,
    Translation: { LineType: 1, GlobalSeqId: null, Keys: [] }, Rotation: { LineType: 1, GlobalSeqId: null, Keys: [] },
    Scaling: { LineType: 0, GlobalSeqId: null, Keys: [] } };
  let shown = 0, total = 0;
  for (const [si, s] of M.Sequences.entries()) {
    const di = donor.Sequences.findIndex(d => d.Name === s.Name && d.Interval[0] === s.Interval[0]);
    const [a, z] = s.Interval, count = Math.max(2, Math.min(MAX_SAMPLES, Math.round((z - a) / STEP) + 1));
    for (let k = 0; k < count; k++) {
      const f = Math.round(a + k * (z - a) / (count - 1));
      const on = di >= 0 && visible(donor, theirs, f, di);
      const w = sampleNodeMatrices(M, f, si), handWorld = w.get(resultHand) || new Matrix4();
      let world = handWorld.clone().multiply(inHand);
      if (on) {
        const dw = sampleNodeMatrices(donor, f, di);
        // follow the donor ammunition's own travel against its hand
        const now = skinAt(donor, theirs, dw), line = longAxis(now); if (line.axis.dot(donorLine.axis) < 0) line.axis.negate();
        const was = refWorld.get(hand).clone().invert(), is = dw.get(hand).clone().invert();
        const refLocal = donorLine.c.clone().applyMatrix4(was), nowLocal = line.c.clone().applyMatrix4(is);
        const refDir = donorLine.axis.clone().transformDirection(was), nowDir = line.axis.clone().transformDirection(is);
        const drift = new Matrix4().compose(nowLocal.clone().sub(refLocal.clone().applyQuaternion(new Quaternion().setFromUnitVectors(refDir, nowDir))),
          new Quaternion().setFromUnitVectors(refDir, nowDir), new Vector3(1, 1, 1));
        world = handWorld.clone().multiply(drift).multiply(inHand);
      }
      const t = new Vector3(), q = new Quaternion(), sc = new Vector3();
      world.decompose(t, q, sc);
      bone.Translation.Keys.push({ Frame: f, Vector: new Float32Array(pivot.clone().applyMatrix4(world).sub(pivot).toArray()) });
      bone.Rotation.Keys.push({ Frame: f, Vector: new Float32Array(q.toArray()) });
      bone.Scaling.Keys.push({ Frame: f, Vector: new Float32Array(on ? sc.toArray() : [0, 0, 0]) });
      total++; if (on) shown++;
    }
  }
  M.Bones.push(bone);
  if (Array.isArray(M.Nodes)) M.Nodes[bone.ObjectId] = bone;
  if (Array.isArray(M.PivotPoints)) M.PivotPoints[bone.ObjectId] = bone.PivotPoint;
  let moved = 0;
  const byGeoset = new Map();
  for (const [gi, v] of mine) { if (!byGeoset.has(gi)) byGeoset.set(gi, []); byGeoset.get(gi).push(v); }
  for (const [gi, verts] of byGeoset) {
    const rg = M.Geosets[gi], g = own.Geosets[gi];
    if (rg.SkinWeights?.length) continue;
    let group = rg.Groups.findIndex(list => list.length === 1 && list[0] === bone.ObjectId);
    if (group < 0) { if (rg.Groups.length >= 256) continue; group = rg.Groups.push([bone.ObjectId]) - 1; rg.TotalGroupsCount = rg.Groups.reduce((n, l) => n + l.length, 0); }
    for (const v of verts) {
      rg.VertexGroup[v] = group;
      for (let k = 0; k < 3; k++) rg.Vertices[3 * v + k] = g.Vertices[3 * v + k];
      if (g.Normals?.length === g.Vertices.length) for (let k = 0; k < 3; k++) rg.Normals[3 * v + k] = g.Normals[3 * v + k];
      moved++;
    }
    // A geoset that holds only ammunition shows whenever the bone does.
    if (verts.length === g.Vertices.length / 3) {
      const anim = M.GeosetAnims?.find(item => item.GeosetId === gi);
      if (anim) anim.Alpha = 1;
    }
  }
  return moved ? { vertices: moved, hand: donor.Nodes[hand]?.Name, shown: shown / Math.max(1, total) } : null;
}
