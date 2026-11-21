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
    const wide = branch => {
      const bones = new Set(branch);
      let left=Infinity,right=-Infinity;
      for (const [gi,g] of donor.Geosets.entries()) {
        if (hidden.has(gi)) continue;
        for (let i=0;i<g.Vertices.length/3;i++) if (vertexBones(g,i).some(id=>bones.has(id))) {
          const y=g.Vertices[i*3+1];
          left=Math.min(left,y); right=Math.max(right,y);
        }
      }
      return right-left >= .28*h;
    };
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
      if (cloth ? back.length<2 || !wide(branch) :
          moving.length<2 || p.z-low < .15*h) continue;
      const depth = (p.z-low)/h;
      candidates.push({id, host:treeA.parentOf(id), branch, score:depth - Math.abs(p.y-hip.y)/h});
    }
    const best = candidates.sort((a,b)=>b.score-a.score)[0];
    if (!best) continue;
    const drape = cloth && !best.branch.some(j=>best.branch.filter(k=>treeA.parentOf(k)===j).length>1) &&
      roots.some(n=>/cape.*dummy|cloak.*dummy/i.test(n.Name));
    // A panelled cloak can have a detached hem rig. Measure every row in
    // one collar-to-hem coordinate system, including panels hung on the arms.
    const panels = drape ? [...treeB.byId.values()].filter(n=>/cape|cloak/i.test(n.Name)) : [];
    const collar = drape ? panels.reduce((a,b)=>nodePivot(own,a)[2]>nodePivot(own,b)[2]?a:b) : root;
    const origin = new Vector3().fromArray(nodePivot(own,collar,collar.ObjectId));
    const pivot = id => new Vector3().fromArray(nodePivot(own,treeB.byId.get(id),id));
    const extent = Math.max(1,...(drape?panels.map(n=>n.ObjectId):ids).map(id=>origin.z-pivot(id).z));
    const top = pt(best.id), bottom = Math.min(...best.branch.map(j=>pt(j).z));
    for (const id of ids.sort((a,b)=>treeB.depth(a)-treeB.depth(b))) {
      const parent = matches.get(treeB.parentOf(id)), ownPoint = pivot(id);
      const depth = cloth ? Math.min(1,Math.max(0,(origin.z-ownPoint.z)/extent)) : .65;
      const targetZ = top.z+(bottom-top.z)*depth;
      const side = (ownPoint.y-origin.y)/extent;
      // A flared hem can have its left and right panels on sibling joints.
      const fork = cloth && !drape && Math.abs(side) > .15 && ids.some(s => s !== id && treeB.parentOf(s) === treeB.parentOf(id));
      const sided = fork ? best.branch.filter(j => (pt(j).y-hip.y)*Math.sign(side) > .15*h && pt(j).x < hip.x) : [];
      const allowed = sided.length ? sided : best.branch.filter(j => !parent || treeA.isAncestor(j,parent.driver));
      const cost = j => Math.abs(pt(j).z-targetZ)/h + Math.abs((pt(j).y-hip.y)/h-side) +
        (cloth ? Math.max(0,(pt(j).x-hip.x)/h)*2 : Math.max(0,(hip.x-pt(j).x)/h)*2);
      const driver = allowed.sort((a,b)=>cost(a)-cost(b))[0] ?? parent?.driver;
      if (driver != null) matches.set(id,{driver,host:parent?.driver ?? best.host,cloth,drape,collar:drape && !parent,root:root.ObjectId,
        anchor:best.host,branch:best.branch,depth,split:parent && !treeA.isAncestor(driver,parent.driver)});
    }
  }
  return matches;
}

// Some layered clothes have a separate rig for the bottom row. Treat the
// authored seams as one continuous strip and fit each row to the moving
// donor cloth surface in chest space. Adjacent panels share a hinge.
function panelledCloak(own,donor,tree,matches,ref,matrices) {
  const tracks=new Map(), rows=[...matches].filter(([id,m])=>m.drape && /dummy/i.test(own.Nodes[id].Name))
    .map(([id])=>id).sort((a,b)=>nodePivot(own,own.Nodes[b])[2]-nodePivot(own,own.Nodes[a])[2]);
  if(rows.length<3)return tracks;
  const match=matches.get(rows[0]), bones=new Set(match.branch), host=match.anchor, samples=[];
  const mat=matrices(ref.frame,ref.sequence);
  for(const [gi,g] of donor.Geosets.entries()) {
    if(corpseAndBackgroundGeosets(donor).has(gi))continue;
    for(let v=0;v<g.Vertices.length/3;v++) {
      const ids=vertexBones(g,v);
      if(ids.length && ids.every(id=>bones.has(id))) samples.push({ids,p:new Vector3().fromArray(g.Vertices,3*v)});
    }
  }
  if(samples.length<8)return tracks;
  const position=(s,w)=>{
    const v=new Vector3();
    for(const id of s.ids) v.addScaledVector(s.p.clone().applyMatrix4(w.get(id)),1/s.ids.length);
    return v;
  };
  const ranked=samples.sort((a,b)=>position(b,mat).z-position(a,mat).z);
  const cloud=Array.from({length:rows.length+1},(_,i)=>{
    const centre=(ranked.length-1)*i/rows.length, half=Math.max(1,ranked.length*.09);
    return ranked.slice(Math.max(0,Math.floor(centre-half)),Math.ceil(centre+half)+1);
  });
  const levels=rows.map(id=>new Vector3().fromArray(nodePivot(own,own.Nodes[id])));
  levels.push(levels.at(-1).clone().add(levels.at(-1).clone().sub(levels.at(-2))));
  for(const [id,m] of matches) if(m.drape) {
    const j=rows.indexOf(id), z=nodePivot(own,own.Nodes[id])[2];
    if(j<0) m.panelParent=rows.reduce((a,b)=>Math.abs(nodePivot(own,own.Nodes[a])[2]-z)<Math.abs(nodePivot(own,own.Nodes[b])[2]-z)?a:b);
    else if(j>0)m.panelParent=rows[j-1];
    tracks.set(id,{});
  }
  const keys=rows.map(()=>new Map());
  for(const [si,s] of donor.Sequences.entries()) {
    if(!s.Interval)continue;
    const [a,b]=s.Interval,times=new Set([a,b]),last=[];
    for(let k=1;a+Math.round(k*1000/30)<b;k++)times.add(a+Math.round(k*1000/30));
    for(const id of bones)for(const key of donor.Nodes[id].Rotation?.Keys||[])if(key.Frame>=a&&key.Frame<=b)times.add(key.Frame);
    for(const f of [...times].sort((x,y)=>x-y)){
      const world=matrices(f,si),anchor=world.get(host);
      if(!anchor || Math.abs(anchor.determinant())<1e-8)continue;
      const inverse=anchor.clone().invert();
      const path=cloud.map(bucket=>bucket.reduce((v,s)=>v.add(position(s,world)),new Vector3()).divideScalar(bucket.length).applyMatrix4(inverse));
      let upper=new Quaternion();
      rows.forEach((id,j)=>{
        const from=levels[j+1].clone().sub(levels[j]),to=path[j+1].clone().sub(path[j]);
        const angle=to.lengthSq()>1e-6 ? new Quaternion().setFromUnitVectors(from.normalize(),to.normalize()) : upper.clone();
        const q=upper.clone().invert().multiply(angle).normalize();
        if(last[j] && last[j].dot(q)<0)q.set(-q.x,-q.y,-q.z,-q.w);
        keys[j].set(f,{Frame:f,Vector:new Float32Array(q.toArray())});last[j]=q;upper=angle;
      });
    }
  }
  rows.forEach((id,j)=>{tracks.get(id).Rotation={LineType:1,GlobalSeqId:null,Keys:[...keys[j].values()].sort((a,b)=>a.Frame-b.Frame)};});
  return tracks;
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
  const splitRoots = new Set([...matches.values()].filter(m => m.split).map(m => m.root));
  const spans = new Map();
  const drapeTracks = panelledCloak(own,donor,tree,matches,ref,matrices);
  for(const [id,keys] of drapeTracks) tracks.set(id,keys);
  for (const [id,match] of matches) {
    if(drapeTracks.has(id)) continue;
    const {driver,host,cloth} = match;
    if (splitRoots.has(match.root)) {
      tracks.set(id,hemMotion(id,match));
      continue;
    }
    const out = {}; tracks.set(id,out);
    if (driver===host) continue;
    const chain = tree.ancestors(driver,true);
    const hosts = tree.ancestors(host,true);
    const common = chain.find(j => hosts.includes(j));
    const below = path => common == null ? path : path.slice(0,path.indexOf(common));
    const local = [...below(chain),...below(hosts)].flatMap(j => ['Rotation','Scaling','Translation'].map(k=>tree.byId.get(j)[k]).filter(t=>t?.Keys?.length && !isGlobalTrack(t,donor)));
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

    // Follow the direction of each weighted strip of robe. The receiver bends
    // about its own sewn seams, so the hem can flare without lengthening a panel.
    function hemMotion(id, match) {
      const region = new Set(match.branch);
      const samples = [], hidden = corpseAndBackgroundGeosets(donor);
      for (const [gi,g] of donor.Geosets.entries()) {
        if (hidden.has(gi)) continue;
        for (let v=0;v<g.Vertices.length/3;v++) {
          const bones = vertexBones(g,v);
          if (bones.length && bones.every(j=>region.has(j)))
            samples.push({p:new Vector3().fromArray(g.Vertices,v*3),bones});
        }
      }
      if (!samples.length) return {};
      const top = Math.max(...samples.map(s=>s.p.z)), bottom=Math.min(...samples.map(s=>s.p.z));
      const left=Math.min(...samples.map(s=>s.p.y)), right=Math.max(...samples.map(s=>s.p.y));
      const pivot=j=>new Vector3().fromArray(nodePivot(own,own.Nodes[j],j));
      const collar=pivot(match.root), rootHeight=collar.z;
      const owned = new Set([...matches].filter(([,p])=>p.root===match.root).map(([j])=>j));
      let low=rootHeight, y0=Infinity, y1=-Infinity;
      const fabric=[];
      for (const g of own.Geosets) for (let v=0;v<g.Vertices.length/3;v++) {
        const bones=vertexBones(g,v);
        if (!bones.length || !bones.every(j=>owned.has(j))) continue;
        const p=new Vector3().fromArray(g.Vertices,3*v);
        fabric.push(p);low=Math.min(low,p.z);y0=Math.min(y0,p.y);y1=Math.max(y1,p.y);
      }
      const landmark=(z,y)=>{
        // Select the rearmost vertex near this height and side. Weighting the
        // height first keeps the two endpoints on different rows of the mesh.
        const cost=s=>Math.abs(s.p.z-z)*3+Math.abs(s.p.y-y)*1.6+s.p.x*.6;
        return samples.reduce((a,b)=>cost(a)<cost(b)?a:b);
      };
      const curve=j=>{
        if (spans.has(j)) return spans.get(j);
        const p=pivot(j),children=[...owned].filter(k=>own.Nodes[k].Parent===j);
        const rim=fabric.filter(v=>v.z<=low+.14*(rootHeight-low));
        const nearest=rim.reduce((a,b)=>Math.abs(a.y-p.y)<Math.abs(b.y-p.y)?a:b);
        const end=children.length===1 ? pivot(children[0]) : nearest;
        const below=end.z;
        const donorZ=z=>top+(bottom-top)*Math.min(1,Math.max(0,(rootHeight-z)/Math.max(1,rootHeight-low)));
        const y=left+(right-left)*(end.y-y0)/Math.max(1,y1-y0);
        const upper=landmark(donorZ(p.z),y),lower=landmark(donorZ(below),y);
        const position=(m,s)=>{
          const v=new Vector3();
          for (const driver of s.bones) v.addScaledVector(s.p.clone().applyMatrix4(m.get(driver)),1/s.bones.length);
          return v.applyMatrix4(m.get(match.anchor).clone().invert());
        };
        const span=m=>position(m,lower).sub(position(m,upper));
        const origin=span(matrices(ref.frame,ref.sequence)).normalize();
        const ownAxis=end.clone().sub(p);
        const lean = matches.get(j).depth>.4 && ownAxis.lengthSq()>1e-6 && origin.lengthSq()>.5 ?
          new Quaternion().setFromAxisAngle(new Vector3(0,1,0),
            Math.atan2(ownAxis.x,-ownAxis.z) - Math.atan2(origin.x,-origin.z)) : new Quaternion();
        const rotation=m=>origin.lengthSq()<.5 ? new Quaternion() :
          new Quaternion().setFromUnitVectors(origin,span(m).normalize()).multiply(lean);
        spans.set(j,rotation);return rotation;
      };
      const parent=own.Nodes[id].Parent,upper=owned.has(parent)?curve(parent):()=>new Quaternion(),lower=curve(id);
      const times=new Map(), drivers=new Set(match.branch.flatMap(j=>tree.ancestors(j,true)));
      for (const [si,s] of donor.Sequences.entries()) {
        if (!s.Interval) continue;
        const [a,b]=s.Interval,frames=new Set([a,b]);
        for (const j of drivers) for (const k of ['Translation','Rotation','Scaling'])
          for (const key of tree.byId.get(j)[k]?.Keys || []) if (key.Frame>=a && key.Frame<=b) frames.add(key.Frame);
        for (let f=a;f<b;f+=1000/30) frames.add(Math.round(f));
        for (const f of frames) times.set(f,si);
      }
      const Keys=[];let previous;
      for (const [Frame,si] of [...times].sort((a,b)=>a[0]-b[0])) {
        const m=matrices(Frame,si),q=upper(m).invert().multiply(lower(m)).normalize(),v=q.toArray();
        if (previous && previous.dot(q)<0) for (let k=0;k<4;k++) v[k]*=-1;
        previous=new Quaternion().fromArray(v);Keys.push({Frame,Vector:new Float32Array(v)});
      }
      return {Rotation:{LineType:1,GlobalSeqId:null,Keys}};
    }
}
