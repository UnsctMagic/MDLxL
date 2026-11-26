import { Matrix4, Quaternion, Vector3 } from 'three';
import { nodePivot, sampleGeosetAnimation, sampleNodeMatrices } from './animation.js';
import { nodeIndex } from './node-hierarchy.js';
import { physicalSurfaceComponents } from './geoset-operations.js';
import { vertexBones } from './part-bones.js';

// A death geoset may be a separately rooted copy of a rider and mount. Three
// matching UV corners in the same material identify a patch of the same skin
// even when the artist moved the copied skeleton away from the living pivots.
function identifiableFaces(geo) {
  const uv = geo.TVertices?.[0], faces = new Map();
  if (!uv) return faces;
  const keys = Array.from({length: uv.length / 2}, (_, i) =>
    Math.round(uv[2*i]*65536) + ',' + Math.round(uv[2*i+1]*65536));
  for (let i = 0; i < geo.Faces.length; i += 3) {
    const ids = Array.from(geo.Faces.subarray(i, i+3)).sort((a,b) => keys[a].localeCompare(keys[b]));
    if (keys[ids[0]] === keys[ids[1]] || keys[ids[1]] === keys[ids[2]]) continue;
    const key = ids.map(id => keys[id]).join('/');
    faces.set(key, faces.has(key) ? null : ids);
  }
  return faces;
}

// The lance can share a bone and material with the rider's hand in Stand,
// then fall on its own root in Death. Register a rigid textured triangle in
// the two bind poses so the blade can follow that separate piece exactly.
export function mountedWeaponCopy(donor, sourceRig, recipient, ownRig, stand) {
  if (stand < 0 || !(sourceRig.actors?.length > 1 && ownRig.actors?.length > 1)) return null;
  const hand = ownRig.parts['arm' + ownRig.weaponSide]?.marker;
  const other = sourceRig.parts['arm' + ownRig.weaponSide]?.marker;
  if (hand == null || other == null) return null;
  const ownTree = nodeIndex(recipient), tree = nodeIndex(donor);
  const refs = (m,t,h) => (m.Attachments || []).filter(n => /weapon/i.test(n.Name) && n.Parent !== h && t.isAncestor(n.Parent,h));
  const mine = refs(recipient,ownTree,hand), theirs = refs(donor,tree,other);
  if (mine.length !== 1 || theirs.length !== 1) return null;
  const held = theirs[0].Parent;
  const reference = donor.Sequences[stand].Interval[0];
  const shown = donor.Geosets.map((_,gi) => sampleGeosetAnimation(donor,gi,reference,stand).alpha > 0.001);
  const faces = donor.Geosets.map(identifiableFaces);
  const points = (g,ids) => ids.map(v => new Vector3().fromArray(g.Vertices,3*v));
  const axes = p => {
    const x = p[1].clone().sub(p[0]).normalize(), z = x.clone().cross(p[2].clone().sub(p[0])).normalize();
    return new Matrix4().makeBasis(x,z.clone().cross(x),z).setPosition(p[0]);
  };
  let match = null, size = 0;
  for (const [gi,g] of donor.Geosets.entries()) if (shown[gi]) for (const [key,src] of faces[gi]) {
    if (!src || !src.every(v => {const bs=vertexBones(g,v);return bs.length === 1 && bs[0] === held;})) continue;
    const p = points(g,src);
    for (const [di,d] of donor.Geosets.entries()) {
      const dst = faces[di].get(key);
      if (shown[di] || !dst || g.MaterialID !== d.MaterialID) continue;
      const bones = dst.map(v => vertexBones(d,v)), copy = bones[0][0];
      if (copy == null || tree.parentOf(copy) != null || !bones.every(b => b.length === 1 && b[0] === copy)) continue;
      const q = points(d,dst), edges = [[0,1],[0,2],[1,2]];
      if (edges.some(([a,b]) => Math.abs(p[a].distanceTo(p[b]) - q[a].distanceTo(q[b])) > 0.01 * Math.max(1,p[a].distanceTo(p[b])))) continue;
      const area = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).length();
      if (area <= size) continue;
      size = area;
      match = {copy, geoset:di, livingGeoset:gi, vertex:src[0], relation:axes(q).multiply(axes(p).invert())};
    }
  }
  if (!match) return null;
  // The farthest two vertices give a blade direction independent of how the
  // artist oriented its bone. The one nearer the hand is the grip end.
  const endpoints = (geo, vertices, grip) => {
    let longest = 0, ends;
    for (const a of vertices) for (const b of vertices) if (b > a) {
      const [p,q] = points(geo,[a,b]), length = p.distanceToSquared(q);
      if (length > longest) { longest = length; ends = p.distanceToSquared(grip) < q.distanceToSquared(grip) ? [a,b] : [b,a]; }
    }
    return ends;
  };
  const sg = donor.Geosets[match.livingGeoset];
  const surface = physicalSurfaceComponents(sg).find(p => p.vertices.includes(match.vertex));
  const direction = endpoints(sg,surface.vertices,new Vector3().fromArray(nodePivot(donor,donor.Nodes[other],other)));
  const ownPieces = recipient.Geosets.flatMap((g,gi) => physicalSurfaceComponents(g).filter(p => p.vertices.every(v => {
    const ids=vertexBones(g,v); return ids.length === 1 && ids[0] === mine[0].Parent;
  })).map(p => ({gi,ends:endpoints(g,p.vertices,new Vector3().fromArray(nodePivot(recipient,recipient.Nodes[hand],hand)))})));
  const blades = ownPieces.filter(p => p.ends);
  if (!direction || !blades.length) return null;
  const lengthSquared = piece => {
    const [a,b] = points(recipient.Geosets[piece.gi], piece.ends);
    return a.distanceToSquared(b);
  };
  blades.sort((a,b) => lengthSquared(b) - lengthSquared(a));
  match.axis = points(sg,direction).map(v=>v.applyMatrix4(match.relation));
  match.recipient = blades[0];
  const id = Math.max(...tree.byId.keys()) + 1;
  const pivot = new Float32Array(nodePivot(donor,tree.byId.get(held),held));
  const bone = {ObjectId:id,Parent:held,Name:'Dropped weapon',PivotPoint:pivot,Flags:256,GeosetId:null,GeosetAnimId:null};
  donor.Bones.push(bone);
  donor.Nodes[id] = bone;
  donor.PivotPoints[id] = pivot;
  return {...match,driver:id,own:mine[0].Parent};
}

// A dropped lance and a carried sword can point in different directions in
// bind space. Register the actual blade axis after fitting the receiver and
// bake that correction only while the donor's loose weapon is showing.
export function fitDroppedBlade(result, donor, info, driver, scale) {
  const n = result.Nodes[driver], {gi,ends} = info.recipient;
  if (!n?.Rotation?.Keys?.length || !n.Translation?.Keys?.length) return;
  const geo = result.Geosets[gi], [base,tip] = ends.map(i=>new Vector3().fromArray(geo.Vertices,3*i));
  const bind = tip.clone().sub(base), pivot = new Vector3().fromArray(n.PivotPoint);
  const rotations = new Map(n.Rotation.Keys.map(k=>[k.Frame,k]));
  const moves = [];
  for (const [si,s] of donor.Sequences.entries()) {
    if (!/death|decay/i.test(s.Name) || !s.Interval) continue;
    for (const k of n.Translation.Keys) {
      const t=k.Frame, rk=rotations.get(t);
      if (!rk || t<s.Interval[0] || t>s.Interval[1] || sampleGeosetAnimation(donor,info.geoset,t,si).alpha <= 0.001) continue;
      const dw=sampleNodeMatrices(donor,t,si).get(info.copy), rw=sampleNodeMatrices(result,t,si);
      const world=rw.get(driver), parent=rw.get(n.Parent);
      if (!world || !parent || Math.abs(parent.determinant())<1e-8) continue;
      const [a,b]=info.axis.map(p=>p.clone().applyMatrix4(dw));
      const grip=base.clone().applyMatrix4(world), far=tip.clone().applyMatrix4(world);
      const swing=new Quaternion().setFromUnitVectors(far.sub(grip).normalize(),b.clone().sub(a).normalize());
      const pos=new Vector3(),rotation=new Quaternion(),stretch=new Vector3();
      world.decompose(pos,rotation,stretch); rotation.premultiply(swing);
      const endZ=grip.z+bind.clone().multiply(stretch).applyQuaternion(rotation).z;
      const lowest=Math.min(a.z,b.z), range=Math.max(1,a.distanceTo(b)*0.1);
      const grounded=Math.max(0,Math.min(1,1-Math.max(0,lowest)/range));
      grip.z += grounded*(lowest*scale-Math.min(endZ,grip.z));
      pos.copy(grip).sub(base.clone().multiply(stretch).applyQuaternion(rotation));
      const local=parent.clone().invert().multiply(new Matrix4().compose(pos,rotation,stretch));
      local.decompose(pos,rotation,stretch);
      const translation=pos.sub(pivot).add(pivot.clone().multiply(stretch).applyQuaternion(rotation));
      moves.push({k,rk,translation,rotation});
    }
  }
  for (const {k,rk,translation,rotation} of moves) { k.Vector.set(translation.toArray()); rk.Vector.set(rotation.toArray()); }
}

export function deathSkinTwins(model, tree, living, dying) {
  const observed = new Map(), visited = new Set();
  const owners = new Map();
  function owner(gi, vertex) {
    const key = gi + ':' + vertex;
    if (!owners.has(key)) {
      const bones = vertexBones(model.Geosets[gi], vertex);
      owners.set(key, bones.length ? tree.ancestors(bones[0], true)
        .find(id => bones.every(b => tree.isAncestor(b, id))) : null);
    }
    return owners.get(key);
  }
  const faces = new Map([...living,...dying].map(i => [i, identifiableFaces(model.Geosets[i])]));
  for (const d of dying) for (const l of living) {
    if (model.Geosets[d].MaterialID !== model.Geosets[l].MaterialID) continue;
    for (const [key, end] of faces.get(d)) {
      const start = faces.get(l).get(key);
      if (!start || !end) continue;
      for (let i = 0; i < 3; i++) {
        const sample = [d,end[i],l,start[i]].join('/');
        if (visited.has(sample)) continue;
        visited.add(sample);
        let a = owner(l,start[i]), b = owner(d,end[i]);
        while (a != null && b != null) {
          if (!observed.has(b)) observed.set(b, new Map());
          const votes = observed.get(b);
          votes.set(a, (votes.get(a) || 0) + 1);
          a = tree.parentOf(a);
          b = tree.parentOf(b);
        }
      }
    }
  }
  const matches = new Map();
  for (const [copy, votes] of observed) {
    const [[joint, count]] = [...votes].sort((a,b) => b[1]-a[1]);
    const total = [...votes.values()].reduce((a,b) => a+b, 0);
    if (count >= 3 && count >= 0.8*total) matches.set(copy,joint);
  }
  return matches;
}
