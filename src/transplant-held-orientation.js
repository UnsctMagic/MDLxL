import { Matrix4, Quaternion, Vector3 } from 'three';
import { nodePivot, sampleNodeMatrices } from './animation.js';
import { heldContact } from './held-item.js';
import { vertexBones } from './part-bones.js';
import { solveTwoBone } from './pose-ik.js';
import { rewriteTrack } from './transplant-floor.js';
const V = () => new Vector3();
const point = (m, id, w) => V().fromArray(nodePivot(m, m.Nodes[id], id)).applyMatrix4(w.get(id));
const frame = (m, si) => sampleNodeMatrices(m, m.Sequences[si].Interval[0], si);
function ends(points, palm2) {
  if (points.length < 3) return null;
  const sorted = points.slice().sort((a, b) => a.distanceToSquared(palm2) - b.distanceToSquared(palm2));
  const mean = (group) => group.reduce((v, p) => v.add(p), V()).multiplyScalar(1 / group.length);
  const grip = mean(sorted.slice(0, Math.max(2, Math.ceil(sorted.length * 0.05))));
  sorted.sort((a, b) => b.distanceToSquared(grip) - a.distanceToSquared(grip));
  return [grip, mean(sorted.slice(0, Math.max(2, Math.ceil(sorted.length * 0.025))))];
}
function geometry(m, tree, root, w) {
  const pts = [];
  for (const g of m.Geosets) for (let i = 0; i < g.Vertices.length / 3; i++) {
    const bs = vertexBones(g, i);
    if (bs.length === 1 && tree.isAncestor(bs[0], root) && w.has(bs[0])) pts.push(V().fromArray(g.Vertices, i * 3).applyMatrix4(w.get(bs[0])));
  }
  return pts;
}
const dir = ([a, b]) => b.clone().sub(a).normalize();
function nearestArm(m, rig, w, p) {
  return Object.values(rig.parts).filter((a) => a.limbKind === 'arm' && w.has(a.marker)).sort((a, b) => point(m, a.marker, w).distanceToSquared(p) - point(m, b.marker, w).distanceToSquared(p))[0];
}
// A separately skinned rigid tool can inherit an unrelated wrist offset, or
// even the other hand. Fit the same material grip in every Attack, using a
// child of its existing carrier so the arm and all other clips keep their keys.
export function fitAttackGrip(result, own, donor, rigB, rigA, donorMap) {
  const item = heldContact(own,rigB), target = item && heldContact(donor,rigA);
  if (!item?.marked || !target?.marked || donorMap[target.hand] == null) return;
  const selected = [], parents = new Set();
  for (const [gi,g] of own.Geosets.entries()) {
    const out = result.Geosets[gi];
    for (let v=0;v<g.Vertices.length/3;v++) {
      const ids = vertexBones(g,v);
      if (!ids.includes(item.carrier)) continue;
      const to = vertexBones(out,v);
      if (ids.length!==1 || to.length!==1) return;
      parents.add(to[0]);
      selected.push({gi,v,src:V().fromArray(g.Vertices,v*3),dst:V().fromArray(out.Vertices,v*3)});
    }
  }
  if (parents.size!==1 || selected.length<3) return;
  const parent = [...parents][0], hand = donorMap[target.hand];
  // Resolve the rigid change of bind basis using three non-collinear vertices.
  const first = selected[0], far = selected.reduce((a,b)=>a.src.distanceToSquared(first.src)>b.src.distanceToSquared(first.src)?a:b);
  const edge=far.src.clone().sub(first.src), area = p=>p.src.clone().sub(first.src).cross(edge).lengthSq();
  const third=selected.reduce((a,b)=>area(a)>area(b)?a:b);
  if (area(third)<1e-5) return;
  const basis = key=>{
    const x=far[key].clone().sub(first[key]).normalize(), z=x.clone().cross(third[key].clone().sub(first[key])).normalize();
    return new Matrix4().makeBasis(x,z.clone().cross(x),z).setPosition(first[key]);
  };
  const fit=basis('dst').multiply(basis('src').invert());
  if (selected.some(p=>p.src.clone().applyMatrix4(fit).distanceTo(p.dst)>.01)) return;
  const grip=item.grip.clone().applyMatrix4(fit), axis=item.tip.clone().applyMatrix4(fit).sub(grip).normalize();
  const hands = [rigA.parts.armL, rigA.parts.armR].map(arm => donorMap[palm(donor,arm)]).filter(id => result.Nodes[id]);
  const reach = rigB.parts[item.arm].length;
  const keysR=[],keysT=[], corrected=new Set();
  for (const [si,s] of result.Sequences.entries()) {
    if (!/^attack\b/i.test(s.Name.trim())) continue;
    const [a,b]=s.Interval, turns=[],moves=[];
    let bad=0;
    for(let f=a;;f=Math.min(b,f+33)) {
      const w=sampleNodeMatrices(result,f,si), d=sampleNodeMatrices(donor,f,si);
      const carrier=w.get(parent), source=d.get(target.carrier);
      if (!carrier || !source || Math.abs(carrier.determinant())<1e-6 || Math.abs(source.determinant())<1e-6) break;
      const inv=carrier.clone().invert();
      const wanted=target.tip.clone().sub(target.grip).transformDirection(source).transformDirection(inv);
      const q=new Quaternion().setFromUnitVectors(axis,wanted);
      const delta=point(result,hand,w).applyMatrix4(inv).sub(grip);
      // A valid grip on either hand can differ from the donor marker. Only
      // reseat a material grip farther from both palms than a full arm length.
      if (hands.length === 2 && hands.every(id => point(result,id,w).applyMatrix4(inv).distanceTo(grip) > reach)) bad++;
      if (turns.length && q.dot(new Quaternion().fromArray(turns.at(-1).Vector))<0) q.set(-q.x,-q.y,-q.z,-q.w);
      turns.push({Frame:f,Vector:new Float32Array(q.toArray())});
      moves.push({Frame:f,Vector:new Float32Array(delta.toArray())});
      if(f===b)break;
    }
    if (turns.at(-1)?.Frame===b && bad>turns.length/2) {keysR.push(...turns);keysT.push(...moves);corrected.add(si);}
  }
  if (!keysR.length) return;
  const id=result.Nodes.length, groups=new Map();
  for(const {gi} of selected) {
    const g=result.Geosets[gi];
    if (g.SkinWeights?.length ? id>255 : g.Groups.length>=256) return;
    groups.set(gi,g.Groups?.length);
  }
  const pivot=new Float32Array(grip.toArray()), track=Keys=>({LineType:1,GlobalSeqId:null,Keys:Keys.sort((a,b)=>a.Frame-b.Frame)});
  const node={Name:own.Nodes[item.carrier].Name+' Grip',ObjectId:id,Parent:parent,Flags:256,GeosetId:null,GeosetAnimId:null,
    PivotPoint:pivot,Rotation:track(keysR),Translation:track(keysT)};
  result.Bones.push(node);result.Nodes[id]=node;result.PivotPoints[id]=pivot;
  for(const [gi] of groups){const g=result.Geosets[gi];if(!g.SkinWeights?.length){g.Groups.push([id]);g.TotalGroupsCount++;}}
  for(const {gi,v} of selected){const g=result.Geosets[gi];if(g.SkinWeights?.length){
    for(let k=0;k<4;k++)if(g.SkinWeights[v*8+4+k])g.SkinWeights[v*8+k]=id;
  }else g.VertexGroup[v]=groups.get(gi);}
  if (item.twoHands && target.twoHands) {
    const free = rigA.parts[target.arm === 'armL' ? 'armR' : 'armL'];
    solveSupportHand(result,donor,donorMap,free,id,item.support.clone().applyMatrix4(fit),'trackWindow',corrected);
  }
}

function shaftFraction(p, a, b) {
  const ab = b.clone().sub(a);
  return p.clone().sub(a).dot(ab) / Math.max(1e-8, ab.lengthSq());
}
function palm(m, arm) {
  return m.Attachments?.find((a) => a.Parent === arm.marker && /hand/i.test(a.Name))?.ObjectId ?? arm.marker;
}
function secondGrip(m, arm, rig, carrier, local) {
  const free = Object.values(rig.parts).find((p) => p.limbKind === 'arm' && p.side !== arm.side);
  if (!free) return null;
  const poses = m.Sequences.map((s, i) => [s, i]).filter(([s]) => /^stand ready|^walk|^attack/i.test(s.Name));
  let held = [];
  for (const [s, i] of poses) {
    let ratios = [];
    for (const t of [0, 0.25, 0.5, 0.75]) {
      let w = sampleNodeMatrices(m, Math.round(s.Interval[0] + t * (s.Interval[1] - s.Interval[0])), i);
      const [a, b] = local.map((p) => p.clone().applyMatrix4(w.get(carrier))), hand = point(m, palm(m, free), w), f = shaftFraction(hand, a, b);
      if (f > 0.04 && f < 0.98 && hand.distanceTo(a.clone().lerp(b, f)) < 0.15 * free.length) ratios.push(f);
    }
    if (ratios.length >= 3) held.push(...ratios);
  }
  return held.length ? held.sort((a, b) => a - b)[held.length >> 1] : null;
}
export function orientHeldSurface({ model, own, donor, rigA, rigB, treeA, donorWeapon, donorMap, weaponVertices, remap, ownHand, donorStand, resultStand, trackMode }) {
  if (!weaponVertices.length || ownHand == null || donorWeapon == null || donorStand < 0 || resultStand < 0) return;
  const old = frame(own, rigB.reference.sequence), d = frame(donor, donorStand), r = frame(model, resultStand), id = donorMap[donorWeapon];
  const arm = Object.values(rigB.parts).find((a) => a.limbKind === 'arm' && a.marker === ownHand);
  if (!arm || !r.has(id)) return;
  const indices = weaponVertices.map(([g, v]) => [model.Geosets.indexOf(g), v]), unique = Array.from(new Map(indices.map((t) => [t.join("/"), t])).values());
  const pos = (m, g, v, w) => {
    let geo = m.Geosets[g], bs = vertexBones(geo, v);
    if (bs.length !== 1 || !w.has(bs[0])) return null;
    return V().fromArray(geo.Vertices, v * 3).applyMatrix4(w.get(bs[0]));
  };
  const nativePoints = unique.map(([g, v]) => pos(own, g, v, old)).filter(Boolean), native = ends(nativePoints, point(own, ownHand, old));
  if (!native) return;
  const resultHand = remap.get(weaponVertices[0][2]);
  if (!r.has(resultHand)) return;
  let da = Object.values(rigA.parts).find((a) => a.limbKind === 'arm' && treeA.isAncestor(donorWeapon, a.marker));
  da ??= nearestArm(donor, rigA, d, point(donor, donorWeapon, d));
  if (!da) return;
  let pts = geometry(donor, treeA, donorWeapon, d);
  if (pts.length < 3) pts = geometry(donor, treeA, da.marker, d);
  const donorAxis = ends(pts, point(donor, da.marker, d)), resultAxis = ends(unique.map(([g, v]) => pos(model, g, v, r)).filter(Boolean), point(model, resultHand, r));
  if (!donorAxis || !resultAxis) return;
  const from = dir(resultAxis), to = dir(donorAxis), angle = from.angleTo(to), inv = r.get(id).clone().invert();
  const srcCarrier = vertexBones(own.Geosets[unique[0][0]], unique[0][1])[0];
  const local = (ax, w) => ax.map((p) => p.clone().applyMatrix4(w.clone().invert()));
  const frac = secondGrip(own, arm, rigB, srcCarrier, local(native, old.get(srcCarrier))) ?? secondGrip(donor, da, rigA, donorWeapon, local(donorAxis, d.get(donorWeapon)));
  // Either end of a symmetrical shaft can point forward from a central grip.
  if (angle > Math.PI / 2 && nativePoints.some((p) => p.clone().sub(native[0]).dot(dir(native)) < -0.55 * native[0].distanceTo(native[1]))) to.negate();
  if (from.angleTo(to) > Math.PI / 6) {
    const turn = new Quaternion().setFromUnitVectors(from, to), g = resultAxis[0], delta = new Matrix4().makeTranslation(g.x, g.y, g.z).multiply(new Matrix4().makeRotationFromQuaternion(turn)).multiply(new Matrix4().makeTranslation(-g.x, -g.y, -g.z));
    const affine = inv.clone().multiply(delta).multiply(r.get(id));
    for (const [gi, v] of unique) {
      let geo = model.Geosets[gi];
      if (vertexBones(geo, v)[0] !== id) continue;
      geo.Vertices.set(V().fromArray(geo.Vertices, v * 3).applyMatrix4(affine).toArray(), v * 3);
      if (geo.Normals?.length === geo.Vertices.length) geo.Normals.set(V().fromArray(geo.Normals, v * 3).transformDirection(affine).toArray(), v * 3);
    }
    resultAxis[1].applyMatrix4(delta);
  }
  if (frac == null) return;
  const free = Object.values(rigA.parts).find((a) => a.limbKind === 'arm' && a.side !== da.side);
  const anchor = resultAxis[0].clone().lerp(resultAxis[1], frac).applyMatrix4(inv);
  solveSupportHand(model, donor, donorMap, free, id, anchor, trackMode);
}

function solveSupportHand(model, donor, donorMap, free, id, anchor, trackMode, sequences = null) {
  if (!free || free.joints.length < 3) return;
  const chain = free.joints.slice(-3).map((j) => donorMap[j]), mark = donorMap[palm(donor, free)] ?? chain[2];
  if (chain.some((j) => !model.Nodes[j]) || !model.Nodes[mark]) return;
  for (const [si, s] of model.Sequences.entries()) {
    if (sequences && !sequences.has(si)) continue;
    if (!/^(walk|attack|stand ready|spell)/i.test(s.Name)) continue;
    const [a, b] = s.Interval, times = new Set([a, b]);
    for (let f = a; f < b; f += 33) times.add(f);
    for (let j of [id, ...chain]) for (let k of model.Nodes[j].Rotation?.Keys || []) if (k.Frame >= a && k.Frame <= b) times.add(k.Frame);
    const frames = [...times].sort((x, y) => x - y), tracks = [new Map(), new Map()];
    for (const f of frames) {
      const w = sampleNodeMatrices(model, f, si), [root, middle, end] = [chain[0], chain[1], mark].map((j) => point(model, j, w));
      let target = anchor.clone().applyMatrix4(w.get(id));
      if (end.distanceTo(target) < 0.05 * free.length) continue;
      let lengths = [root.distanceTo(middle), middle.distanceTo(end)];
      if (Math.min(...lengths) < 1e-4) continue;
      const sol = solveTwoBone({ root, middle, end, lengths, tolerance: 1e-6 }, target);
      let upper = new Quaternion();
      for (let j = 0; j < 2; j++) {
        let n = model.Nodes[chain[j]], wr = new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(w.get(chain[j]))), p = w.get(n.Parent), pr = p ? new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(p)) : new Quaternion();
        let u = (j ? end.clone().sub(middle) : middle.clone().sub(root)).applyQuaternion(upper).normalize(), v = (j ? sol.end.clone().sub(sol.middle) : sol.middle.clone().sub(root)).normalize(), q = new Quaternion().setFromUnitVectors(u, v);
        let local2 = pr.premultiply(upper).invert().multiply(q).multiply(upper).multiply(wr).normalize().toArray();
        tracks[j].set(f, () => local2);
        upper.premultiply(q);
      }
    }
    tracks.forEach((tr, j) => {
      if (tr.size) rewriteTrack(model, model.Nodes[chain[j]], si, frames, tr, 'Rotation', trackMode);
    });
  }
}
