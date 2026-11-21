import { Matrix4, Quaternion, Vector3 } from 'three';
import { isGlobalTrack, nodePivot, sampleNodeMatrices } from './animation.js';
import { vertexBones } from './part-bones.js';
import { corpseAndBackgroundGeosets } from './geoset-extras.js';

// Match hanging surfaces by their bound vertices and the POSE trunk that carries
// them. A rear panel can hang from the hips even when a cape hangs from the chest.
export function secondarySurfaces(own, donor, rig, treeB, treeA, partJoint, keep) {
  const matches = new Map();
  const roots = [...treeB.byId.values()].filter(n => /cape|cloak|belly|stomach/i.test(n.Name) &&
    !partJoint(n.ObjectId) && !treeB.ancestors(n.ObjectId).some(id => /cape|cloak|belly|stomach/i.test(treeB.byId.get(id)?.Name)));
  if (!roots.length || !rig.parts.chest || !rig.parts.hips) return matches;
  const core = new Map(Object.values(rig.parts).flatMap(p => p.joints.map(id => [id,p])));
  const centres = new Map(), hidden = corpseAndBackgroundGeosets(donor);
  for (const [gi,g] of donor.Geosets.entries()) {
    if (hidden.has(gi)) continue;
    for (let v=0; v<g.Vertices.length/3; v++) for (const id of vertexBones(g,v)) {
      if (!centres.has(id)) centres.set(id,{sum:new Vector3(), n:0});
      const c = centres.get(id);
      c.sum.add(new Vector3().fromArray(g.Vertices,v*3)); c.n++;
    }
  }
  const pt = id => centres.get(id)?.sum;
  for (const c of centres.values()) c.sum.divideScalar(c.n);
  const hip = new Vector3().fromArray(nodePivot(donor,treeA.byId.get(rig.body),rig.body));
  const h = rig.hipHeight;
  for (const root of roots) {
    const ids = [...treeB.byId.keys()].filter(id => treeB.isAncestor(id,root.ObjectId) &&
      (own.Bones?.includes(treeB.byId.get(id)) || own.Helpers?.includes(treeB.byId.get(id))));
    if (ids.some(partJoint) || treeB.ancestors(root.ObjectId,true).some(id => keep.has(id))) continue;
    if (ids.some(id => ['Rotation','Translation','Scaling'].some(k => isGlobalTrack(treeB.byId.get(id)[k],own)))) continue;
    // Leave corresponding authored chains to the ordinary extra-to-extra fit.
    if ([...treeA.byId.values()].some(n => n.Name === root.Name &&
        treeA.byId.get(n.Parent)?.Name === treeB.byId.get(root.Parent)?.Name)) continue;
    const cloth = /cape|cloak/i.test(root.Name);
    const candidates = [];
    for (const [id,{sum:p}] of centres) {
      if (Math.abs(p.y-hip.y) > .19*h || (cloth ? p.z > hip.z+.1*h : p.x < hip.x+.12*h || p.z < hip.z)) continue;
      const host = treeA.ancestors(id).find(j => core.has(j) && core.get(j).key !== 'tail');
      if (!['hips','chest'].includes(core.get(host)?.key) || core.has(id) && core.get(id).key!=='tail') continue;
      const branch = [...centres.keys()].filter(j => treeA.isAncestor(j,id));
      if (branch.some(j => core.has(j) && core.get(j).key!=='tail')) continue;
      const moving = branch.filter(j => ['Translation','Rotation','Scaling'].some(k => treeA.byId.get(j)[k]?.Keys?.length > 1));
      const low = Math.min(...branch.map(j=>pt(j).z));
      const back = moving.filter(j => pt(j).x < hip.x-.12*h && pt(j).z < hip.z-.15*h);
      if (cloth ? back.length<2 || Math.max(...branch.map(j=>pt(j).y))-Math.min(...branch.map(j=>pt(j).y)) < .28*h :
          moving.length<2 || p.z-low < .15*h) continue;
      const depth = (p.z-low)/h;
      candidates.push({id, host:treeA.parentOf(id), branch, score:depth - Math.abs(p.y-hip.y)/h});
    }
    const best = candidates.sort((a,b)=>b.score-a.score)[0];
    if (!best) continue;
    const origin = new Vector3().fromArray(nodePivot(own,root,root.ObjectId));
    const pivot = id => new Vector3().fromArray(nodePivot(own,treeB.byId.get(id),id));
    const extent = Math.max(1,...ids.map(id=>origin.z-pivot(id).z));
    const top = pt(best.id), bottom = Math.min(...best.branch.map(j=>pt(j).z));
    for (const id of ids.sort((a,b)=>treeB.depth(a)-treeB.depth(b))) {
      const parent = matches.get(treeB.parentOf(id)), ownPoint = pivot(id);
      const depth = cloth ? Math.min(1,Math.max(0,(origin.z-ownPoint.z)/extent)) : .65;
      const targetZ = top.z+(bottom-top.z)*depth;
      const side = (ownPoint.y-origin.y)/extent;
      const allowed = best.branch.filter(j => !parent || treeA.isAncestor(j,parent.driver));
      const cost = j => Math.abs(pt(j).z-targetZ)/h + Math.abs((pt(j).y-hip.y)/h-side) +
        (cloth ? Math.max(0,(pt(j).x-hip.x)/h)*2 : Math.max(0,(hip.x-pt(j).x)/h)*2);
      const driver = allowed.sort((a,b)=>cost(a)-cost(b))[0] ?? parent?.driver;
      if (driver != null) matches.set(id,{driver,host:parent?.driver ?? best.host,cloth});
    }
  }
  return matches;
}

// Express donor deformation relative to the panel above it, at this surface's
// own pivot. The cape collar therefore follows the recipient's actual chest.
export function secondaryMotion(own, donor, tree, matches, ref, size) {
  const tracks = new Map(), cache = new Map();
  const matrices = (f,si) => {
    const key = si+','+f;
    if (!cache.has(key)) cache.set(key,sampleNodeMatrices(donor,f,si));
    return cache.get(key);
  };
  const relative = (m,d,h) => (m.get(h) || new Matrix4()).clone().invert().multiply(m.get(d));
  for (const [id,{driver,host,cloth}] of matches) {
    const out = {}; tracks.set(id,out);
    if (driver===host) continue;
    const chain = tree.ancestors(driver,true);
    const h = chain.indexOf(host);
    const local = (h<0 ? chain : chain.slice(0,h)).flatMap(j => ['Rotation','Scaling','Translation'].map(k=>tree.byId.get(j)[k]).filter(t=>t?.Keys?.length && !isGlobalTrack(t,donor)));
    if (!local.length) continue;
    const base = relative(matrices(ref.frame,ref.sequence),driver,host);
    const pivot = new Vector3().fromArray(nodePivot(donor,tree.byId.get(driver),driver)).applyMatrix4(base);
    const frames = new Map();
    for (const [si,s] of donor.Sequences.entries()) {
      if (!s.Interval) continue;
      const [a,b] = s.Interval, times = new Set([a,b]);
      for (const t of local) for (const k of t.Keys) if (k.Frame>=a && k.Frame<=b) times.add(k.Frame);
      for (const f of times) if (!frames.has(f)) frames.set(f,si);
    }
    const inverse = base.clone().invert();
    const values = {Rotation:[],Scaling:[],Translation:[]};
    const joint = own.Nodes[id];
    // Cloth panels without an authored stretch or slide articulate at their seam.
    // Bound the bend by the range the recipient's own weighted panel can take.
    const angles = joint.Rotation?.Keys;
    const maxBend = cloth && angles?.length ? angles.reduce((a,k) =>
      Math.max(a,2*Math.acos(Math.min(1,Math.abs(k.Vector[3])))),0) : Math.PI;
    let previous;
    for (const [Frame,si] of [...frames].sort((a,b)=>a[0]-b[0])) {
      const delta = relative(matrices(Frame,si),driver,host).multiply(inverse);
      const rot = new Quaternion(), scale = new Vector3();
      delta.decompose(new Vector3(),rot,scale); rot.normalize();
      const angle = rot.angleTo(new Quaternion());
      if (angle > maxBend) rot.slerp(new Quaternion(),1-maxBend/angle);
      const q = rot.toArray();
      if (previous && rot.dot(previous)<0) for (let i=0;i<4;i++) q[i]*=-1;
      previous = new Quaternion().fromArray(q);
      const shift = pivot.clone().applyMatrix4(delta).sub(pivot).multiplyScalar(size);
      for (const [k,v] of Object.entries({Rotation:q,Scaling:scale.toArray(),Translation:shift.toArray()}))
        values[k].push({Frame,Vector:new Float32Array(v)});
    }
    for (const [k,keys] of Object.entries(values)) if ((!cloth || k==='Rotation' || joint[k]?.Keys?.length) && keys.some(key=>key.Vector.some((v,i)=>Math.abs(v-(k==='Scaling' || k==='Rotation' && i===3 ? 1:0))>1e-4)))
      out[k] = {LineType:1,GlobalSeqId:null,Keys:keys};
  }
  return tracks;
}
