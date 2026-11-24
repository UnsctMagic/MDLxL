import { Matrix4, Quaternion, Triangle, Vector3 } from 'three';
import { nodePivot, sampleTrack, sampleNodeMatrices, sampleGeosetAnimation, skinGeoset, isGlobalTrack } from './animation.js';
import { vertexBones } from './part-bones.js';
import { geosetAlphaTrack, geosetVisibleIn, geosetMaterialLayers, hasOnlyAdditiveLayers } from './geoset-extras.js';
import { nodeIndex } from './node-hierarchy.js';

// A loose, rigid item already seated on the same hand that carries the donor's
// measured blade can be turned in that hand without rewriting animation.
export function alignLooseItem(model, donor, arm, vertices, moves, resultHand, stand, donorStand) {
  const count = new Map();
  for (const [g, v] of vertices) {
    const bones = vertexBones(g, v);
    if (bones.length !== 1 || bones[0] !== resultHand) return false;
    if (!count.has(g)) count.set(g, new Set());
    count.get(g).add(v);
  }
  const points = [...count].flatMap(([g, vs]) => [...vs].map(v => new Vector3().fromArray(g.Vertices, 3*v)));
  if (points.length < 3) return false;
  const handNode = model.Nodes[resultHand], hand = new Vector3().fromArray(nodePivot(model,handNode,resultHand));
  const grip = points.reduce((p,q) => p.distanceToSquared(hand) < q.distanceToSquared(hand) ? p : q);
  const tip = points.reduce((p,q) => p.distanceToSquared(grip) > q.distanceToSquared(grip) ? p : q);
  const src = sampleNodeMatrices(donor,donor.Sequences[donorStand].Interval[0],donorStand).get(arm.marker);
  const dest = sampleNodeMatrices(model,model.Sequences[stand].Interval[0],stand).get(resultHand);
  if (!src || !dest || Math.abs(dest.determinant()) < 1e-9) return false;
  const target = new Vector3().fromArray(arm.weapon.tip).sub(new Vector3().fromArray(arm.weapon.butt))
    .transformDirection(src).transformDirection(dest.clone().invert());
  const axis = tip.clone().sub(grip).normalize();
  if (axis.angleTo(target) <= Math.PI/6) return false;
  const turn = new Quaternion().setFromUnitVectors(axis,target);
  const rotate = p => p.sub(grip).applyQuaternion(turn).add(grip);
  for (const [g, indices] of count) for (const v of indices) {
    g.Vertices.set(rotate(new Vector3().fromArray(g.Vertices,3*v)).toArray(),3*v);
    for (const [array, stride] of [[g.Normals,3],[g.Tangents,4]]) if (array?.length >= (v+1)*stride)
      array.set(new Vector3().fromArray(array,stride*v).applyQuaternion(turn).toArray(),stride*v);
  }
  for (const [node] of moves) node.PivotPoint.set(rotate(new Vector3().fromArray(node.PivotPoint)).toArray());
  return true;
}

/** Seat the native handle on the mapped palm while keeping the donor weapon's rotations. */
export function seatLooseGrip(model, own, donor, item, hand, stand, donorMap, constantTrack) {
  const palmRef = (m, part) => m.Attachments.find(node =>
    /^Hand (Left|Right) Ref$/i.test(node.Name.trim()) && part.joints.includes(node.Parent) &&
    (node.Parent === part.marker || node.Parent === m.Nodes[part.marker]?.Parent));
  const nativePalm = palmRef(own, hand.own), donorPalm = palmRef(donor, hand.theirs);
  const palm = donorPalm && model.Nodes[donorMap[donorPalm.ObjectId]];
  const [firstGeoset, firstVertex] = item.vertices[0];
  const carrier = model.Nodes[vertexBones(model.Geosets[firstGeoset], firstVertex)[0]];
  if (!nativePalm || !palm || stand < 0 || !carrier?.Translation?.Keys?.length ||
      carrier.Parent !== palm.Parent || (carrier.Flags & 7) !== (palm.Flags & 7)) return false;

  const claimed = new Map();
  for (const [index, vertex] of item.vertices) {
    const weights = vertexBones(model.Geosets[index], vertex);
    if (weights.length !== 1 || weights[0] !== carrier.ObjectId) return false;
    if (!claimed.has(index)) claimed.set(index, new Set());
    claimed.get(index).add(vertex);
  }
  // The carrier must belong to this rigid item alone.
  if (model.Geosets.some((g, index) => g.VertexGroup.some((_, vertex) =>
    !claimed.get(index)?.has(vertex) && vertexBones(g, vertex).includes(carrier.ObjectId)))) return false;

  const frame = own.Sequences[stand].Interval[0], matrices = sampleNodeMatrices(own, frame, stand);
  const nativeGrip = new Vector3().fromArray(nativePalm.PivotPoint).applyMatrix4(matrices.get(nativePalm.ObjectId));
  let grip = null, least = Infinity;
  for (const [index, selected] of claimed) {
    const geoset = own.Geosets[index];
    if (hasOnlyAdditiveLayers(geosetMaterialLayers(own, geoset)) || sampleGeosetAnimation(own, index, frame, stand).alpha < .5) continue;
    const posed = skinGeoset(geoset, matrices);
    for (let i = 0; i + 2 < geoset.Faces.length; i += 3) {
      const face = Array.from(geoset.Faces.subarray(i, i + 3));
      if (!face.every(vertex => selected.has(vertex))) continue;
      const triangle = new Triangle(...face.map(vertex => new Vector3().fromArray(posed, vertex * 3)));
      const near = triangle.closestPointToPoint(nativeGrip, new Vector3()), gap = near.distanceToSquared(nativeGrip);
      const weights = triangle.getBarycoord(near, new Vector3());
      if (!weights || gap >= least) continue;
      least = gap;
      const result = model.Geosets[index].Vertices;
      grip = face.reduce((point, vertex, at) => point.addScaledVector(new Vector3().fromArray(result, vertex * 3), weights.getComponent(at)), new Vector3());
    }
  }
  if (!grip) return false;

  // Move the measured handle to the weapon pivot, then keep that pivot on the palm.
  const pivot = new Vector3().fromArray(carrier.PivotPoint), offset = pivot.clone().sub(grip);
  for (const [index, vertices] of claimed) {
    const values = model.Geosets[index].Vertices, point = new Vector3();
    for (const vertex of vertices) values.set(point.fromArray(values, vertex * 3).add(offset).toArray(), vertex * 3);
  }
  const tree = nodeIndex(model);
  for (const joint of tree.byId.values()) if (joint !== carrier && tree.isAncestor(joint.ObjectId, carrier.ObjectId)) {
    joint.PivotPoint.set(new Vector3().fromArray(joint.PivotPoint).add(offset).toArray());
    if (model.PivotPoints[joint.ObjectId] !== joint.PivotPoint) model.PivotPoints[joint.ObjectId]?.set(joint.PivotPoint);
  }
  carrier.Translation = constantTrack(new Vector3().fromArray(palm.PivotPoint).sub(pivot).toArray());
  return true;
}

const projectile = /arrow|missile|projectile/i;
const weapon = /weapon|spear|javelin|rifle|sword|choppa|axe|hammer|staff|bow/i;

// A detached weapon can rotate around its grip in the source animations. Compare
// its surface with the moving hand across the ordinary poses, rather than
// measuring drift of the weapon tip, which is supposed to swing away.
// `anyName` (Auto fix `detached`): the bone's name is not asked; its Weapon attachment and its distance to the hand still are.
export function detachedGrip(model, rig, tree, id, points, samples, includeGripPivot = false, anyName = false) {
  if (!samples.length || !anyName && !weapon.test(tree.byId.get(id)?.Name) || !(model.Attachments || []).some(n => /weapon/i.test(n.Name) && n.Parent === id)) return null;
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

// A detached surface may have more than one joint. Claim every vertex touched by
// the carrier's subtree before testing the boundary, including mixed-weight vertices.
export function detachedSurface(model, tree, carrier, keep) {
  const family = new Set([...tree.byId.keys()].filter(id => tree.isAncestor(id, carrier)));
  if ([...family].some(id => keep.has(id))) return null;
  const pieces = [], vertices = [];
  for (const [gi, geo] of model.Geosets.entries()) {
    const touched = new Uint8Array(geo.Vertices.length / 3);
    for (let v = 0; v < touched.length; v++) {
      const ids = vertexBones(geo, v);
      if (!ids.some(id => family.has(id))) continue;
      touched[v] = 1;
      vertices.push([gi, v]);
      if (ids.some(id => id !== carrier)) pieces.push([gi, v]);
    }
    for (let i = 0; i < geo.Faces.length; i += 3) {
      const [a,b,c] = [geo.Faces[i], geo.Faces[i+1], geo.Faces[i+2]];
      if (touched[a] !== touched[b] || touched[b] !== touched[c]) return null;
    }
  }
  return { family, pieces, vertices };
}

// A held rigid item takes the position of its grip and the rotations of its
// carrier chain. A donor's animated muscle scale must not lengthen the prop.
// Build the position and rotation separately so global sequences still run on
// their own clocks. Node references survive the final ID renumbering.
export function rigidItemSocket(model, nodes, byId, skin, grip, label, constantTrack) {
  const parentIds = new Set(skin.flatMap(([gi, v]) => vertexBones(model.Geosets[gi], v)));
  if (parentIds.size !== 1 || !grip) return false;
  const parent = byId.get([...parentIds][0]), chain = [];
  for (let n = parent; n; n = byId.get(n.Parent)) chain.unshift(n);
  if (!chain.some(n => n.Scaling?.Keys?.some(k => Array.from(k.Vector).some(x => Math.abs(x-1) > 1e-6)
    || k.InTan || k.OutTan))) return null;
  const meshes = new Set(skin.map(([gi]) => model.Geosets[gi]));
  if ([...meshes].some(g => g.Groups.length >= 256)) return false;
  let id = Math.max(...nodes.map(n => n.ObjectId)) + 1;
  // The packed HD indices are bytes before canonicalization as well.
  if ([...meshes].some(g => g.SkinWeights?.length) && id + chain.length > 255) return false;
  const add = (group, parentId, flags) => {
    const n = { Name: label + ' Grip ' + id, ObjectId: id++, Parent: parentId, Flags: flags, PivotPoint: new Float32Array(3) };
    model[group].push(n); nodes.push(n);
    return n;
  };
  const pivot = new Vector3().fromArray(grip.PivotPoint);
  const anchor = add('Helpers', parent.ObjectId, 0);
  anchor.Translation = constantTrack(pivot.toArray());
  const copies = [];
  let last = anchor;
  for (const [i, source] of chain.entries()) {
    const terminal = i === chain.length-1;
    // Discard the anchor's rotation and scale. Its translated origin is the grip.
    const flags = (i === 0 ? 6 : source.Flags & 2) | (terminal ? 256 : 0);
    last = add(terminal ? 'Bones' : 'Helpers', last.ObjectId, flags);
    if (terminal) { last.GeosetId = null; last.GeosetAnimId = null; }
    if (source.Rotation) last.Rotation = source.Rotation;
    copies.push([source, last]);
  }
  const group = new Map();
  for (const g of meshes) {
    group.set(g, g.Groups.length);
    g.Groups.push([last.ObjectId]); g.TotalGroupsCount++;
  }
  for (const [gi,v] of skin) {
    const g = model.Geosets[gi];
    const pos = new Vector3().fromArray(g.Vertices, 3*v).sub(pivot);
    g.Vertices.set(pos.toArray(), 3*v);
    g.VertexGroup[v] = group.get(g);
    if (g.SkinWeights?.length) g.SkinWeights.set([last.ObjectId,0,0,0,255,0,0,0], 8*v);
  }
  return () => {
    for (const [source, socket] of copies) {
      if (source.Rotation) socket.Rotation = structuredClone(source.Rotation);
      else delete socket.Rotation;
    }
  };
}

// Match the authored grip-to-tip direction in the donor's Stand. A rigid
// weapon then follows the donor's weapon joint throughout its swings and throws.
export function fitHeldEquipment({model,own,donor,gripBranches,weaponVertices,weaponMoves,
  donorWeapon,donorMap,rigA,rigB,treeA,treeB,matrices,remap,donorStand,plateNormal,reposeAbout,keep, wristGrip = false }) {
  if (gripBranches.size!==1 || !weaponVertices.length || weaponMoves.length!==1 || donorStand<0) return null;
  const [{hand,grip}] = gripBranches.values();
  const handRef = (m,id) => m.Attachments.find(n=>/hand/i.test(n.Name) && n.Parent===id);
  const wrist = treeA.ancestors(donorWeapon).find(id=>handRef(donor,id));
  if (wrist==null || !handRef(own,hand)) return null;
  const point = donor.Attachments.find(n=>/weapon/i.test(n.Name) && n.Parent===donorWeapon);
  if (!point || !own.Attachments.some(n=>/weapon/i.test(n.Name) && n.Parent===grip)) return null;
  const pos = (m,n,world) => new Vector3().fromArray(nodePivot(m,n,n.ObjectId)).applyMatrix4(world.get(n.ObjectId));
  const ref = sampleNodeMatrices(donor,donor.Sequences[donorStand].Interval[0],donorStand);
  const aim = pos(donor,point,ref).sub(pos(donor,handRef(donor,wrist),ref));
  const [tip,carrier] = weaponMoves[0], handId=remap.get(carrier);
  const palm = model.Attachments.find(n=>n.Name.trim().toLowerCase()===handRef(donor,wrist).Name.trim().toLowerCase());
  if (!palm || !matrices.has(handId)) return null;
  const ownWorld=sampleNodeMatrices(own,rigB.reference.frame,rigB.reference.sequence);
  const referenceGrip = pos(own,handRef(own,hand),ownWorld);
  const handOrigin = wristGrip ? pos(own,treeB.byId.get(hand),ownWorld) : null;
  const remote = handOrigin && referenceGrip.distanceTo(handOrigin) > .15 * (rigB.extent || rigB.hipHeight);
  const gripCarrier = remote ? model.Nodes[donorMap[wrist]] : palm;
  if (remote && (!gripCarrier || !matrices.has(gripCarrier.ObjectId))) return null;
  const targetGrip = pos(model,gripCarrier,matrices);
  const authoredGrip = remote ? handOrigin : referenceGrip;
  const intoHand=ownWorld.get(hand).clone().invert();
  const sourceGrip=authoredGrip.clone().applyMatrix4(intoHand).applyMatrix4(matrices.get(handId));
  // Rebuild the rigid surface and its reference from the same authored
  // frame. Body repose can have turned the baked vertices separately.
  for (const [geo,v] of weaponVertices) {
    const g=own.Geosets[model.Geosets.indexOf(geo)],ids=vertexBones(g,v);
    if (ids.length!==1 || !ownWorld.has(ids[0])) continue;
    const local=intoHand.clone().multiply(ownWorld.get(ids[0]));
    geo.Vertices.set(new Vector3().fromArray(g.Vertices,3*v).applyMatrix4(local).toArray(),3*v);
    for (const [dst,src,stride] of [[geo.Normals,g.Normals,3],[geo.Tangents,g.Tangents,4]]) if (src?.length>=(v+1)*stride)
      dst.set(new Vector3().fromArray(src,stride*v).transformDirection(local).toArray(),stride*v);
  }
  const ownPoint=own.Attachments.find(n=>n.Parent===grip && /weapon/i.test(n.Name));
  tip.PivotPoint.set(pos(own,ownPoint,ownWorld).applyMatrix4(intoHand).toArray());
  const axis = new Vector3().fromArray(tip.PivotPoint).applyMatrix4(matrices.get(handId)).sub(sourceGrip);
  if (axis.lengthSq()<1e-6 || aim.lengthSq()<1e-6) return null;
  const turn = new Quaternion().setFromUnitVectors(axis.normalize(),aim.normalize());
  const about = (from,to,q) => new Matrix4().makeTranslation(to.x,to.y,to.z).multiply(new Matrix4().makeRotationFromQuaternion(q))
    .multiply(new Matrix4().makeTranslation(-from.x,-from.y,-from.z));
  const correction=about(sourceGrip,targetGrip,turn);

  // Reflect the change about the opposite grip. The original shield keeps
  // its authored offset on that forearm, including an asymmetric shield boss.
  const other=Object.values(rigB.parts).find(p=>p.limbKind==='arm' && p.marker!==hand && handRef(own,p.marker));
  if (!other) return correction;
  const plate = new Set();
  for (const child of treeB.children.get(other.marker)||[]) {
    if (keep.has(child.ObjectId) || /glove|finger|hand/i.test(child.Name)) continue;
    const solid=new Set([child.ObjectId]);
    const lo=[Infinity,Infinity,Infinity], hi=lo.map(()=>-Infinity);
    for(const g of own.Geosets) for(let i=0;i<g.Vertices.length/3;i++) if(vertexBones(g,i).includes(child.ObjectId)) {
      for(let k=0;k<3;k++){const v=g.Vertices[3*i+k];lo[k]=Math.min(lo[k],v);hi[k]=Math.max(hi[k],v);}
    }
    const spans=hi.map((v,k)=>v-lo[k]).sort((a,b)=>a-b);
    const longPlate=spans[2]>rigB.hipHeight && spans[1]>.4*rigB.hipHeight && spans[0]<.6*spans[1];
    if (/shield|buckler/i.test(child.Name) || plateNormal(own,solid) || longPlate)
      for(const id of treeB.byId.keys()) if(treeB.isAncestor(id,child.ObjectId))plate.add(id);
  }
  if (!plate.size) return correction;
  const support = Object.values(rigA.parts).find(p=>p.limbKind==='arm' && !p.joints.includes(wrist) && handRef(donor,p.marker));
  const resultPalm=support && model.Attachments.find(n=>n.Name.trim().toLowerCase()===handRef(donor,support.marker).Name.trim().toLowerCase());
  if (!resultPalm) return correction;
  const inFittedHand = p => reposeAbout(carrier,p).applyMatrix4(matrices.get(handId));
  const priorGrip=inFittedHand(authoredGrip.clone().applyMatrix4(intoHand));
  const priorAxis=inFittedHand(new Vector3().fromArray(tip.PivotPoint)).sub(priorGrip).normalize();
  const change=new Quaternion().setFromUnitVectors(priorAxis,aim);
  const anchor=pos(model,resultPalm,matrices), shift=targetGrip.clone().sub(priorGrip);
  shift.y*=-1;
  const mirrored=about(anchor,anchor.clone().add(shift),new Quaternion(-change.x,change.y,-change.z,change.w));
  for (const [gi,g] of own.Geosets.entries()) {
    const fitted=model.Geosets[gi];
    for (let v=0;v<g.Vertices.length/3;v++) {
      const bones=vertexBones(g,v), targets=vertexBones(fitted,v);
      if (!bones.length || !bones.every(j=>plate.has(j)) || targets.length!==1) continue;
      const world=matrices.get(targets[0]);
      if (!world || Math.abs(world.determinant())<1e-9) continue;
      const delta=world.clone().invert().multiply(mirrored).multiply(world);
      fitted.Vertices.set(new Vector3().fromArray(fitted.Vertices,3*v).applyMatrix4(delta).toArray(),3*v);
      for(const [attr,stride] of [[fitted.Normals,3],[fitted.Tangents,4]]) if(attr?.length>=(v+1)*stride)
        attr.set(new Vector3().fromArray(attr,v*stride).transformDirection(delta).toArray(),v*stride);
    }
  }
  return correction;
}

function skinNames(geoset, nodes) {
  const ids = new Set();
  for (let i=0; i<geoset.Vertices.length/3; i++) for (const id of vertexBones(geoset,i)) ids.add(id);
  return [...ids].map(id => nodes.get(id)?.Name || '');
}

// Only change separate prop geometry. On a mixed body/weapon mesh the body must
// never disappear with the weapon. A thrown copy still carries the same weapon.
export function transplantPropVisibility(M, own, donor, treeB, treeA, stand, swaps, keep, constantTrack, hand) {
  const hasMissile = (donor.Bones || []).some(n => projectile.test(n.Name));
  const grips = new Set((donor.Attachments || []).filter(n => /weapon/i.test(n.Name) && hand != null &&
    treeA.isAncestor(n.Parent,hand)).map(n => treeA.byId.get(n.Parent)?.Name));
  const solidWeapon = n => weapon.test(n) && !projectile.test(n);
  const spinBlade = n => /(?:blade.*spin|spin.*blade)/i.test(n);
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
    if (!stand) continue;
    const spinning = names.every(spinBlade) && !geosetVisibleIn(own,original,stand);
    if (!spinning && !(names.every(solidWeapon) && geosetVisibleIn(own,original,stand))) continue;
    donorWeaponGeos ??= donor.Geosets.map((geo,i) => skinNames(geo,treeA.byId).some(n => (solidWeapon(n) || grips.has(n)) && !/death|corpse/i.test(n)) ? i : -1).filter(i => i >= 0);
    if (!donorWeaponGeos.length) continue;
    if (spinning && donor.Bones.some(n => spinBlade(n.Name))) continue;
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
      const visible = f => spinning ? 0 : thrown.some(([lo,hi]) => f-a >= lo && f-a <= hi) ? 1 :
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
