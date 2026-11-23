import { Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, globalSequenceId, nodePivot } from './animation.js';
import { vertexBoneWeights } from './part-bones.js';
import { corpseAndBackgroundGeosets, geosetMaterialLayers, hasOnlyAdditiveLayers } from './geoset-extras.js';

const unit = new Quaternion(), origin = new Vector3();
const vector = values => new Vector3().fromArray(values);
const nearIdentity = q => q.angleTo(unit) < 1e-8;
const limb = key => /^(arm|leg|wing|tail)/.test(key);
const trunk = key => key === 'chest' || key === 'hips' ? 'torso' : limb(key) ? key : null;
const prop = (node, property) => node[property]?.Keys;
const point = (frame, v) => v.clone().sub(frame.native).applyQuaternion(frame.turn).add(frame.pivot);

// Changing bind coordinates from new to old multiplies the skin matrix by that same transform.
// With old local matrix L, the new local matrix is inverse(parentBind) * L * bind. This changes
// the rotation keys (including cubic controls), the parent-space translation, and the static pivot.
export function movePoseIntoKeys(model, transforms) {
  const unchanged = { native: origin, pivot: origin, turn: unit };
  const sequenceStarts = [...new Set(model.Sequences.map(s => s.Interval[0]))].sort((a,b) => a-b);
  for (const node of allNodes(model)) {
    const own = transforms.get(node.ObjectId) ?? unchanged, parent = transforms.get(node.Parent) ?? unchanged;
    const parentInverse = parent.turn.clone().invert();
    const oldPivot = vector(nodePivot(model,node));
    const newPivot = oldPivot.clone().sub(own.pivot).applyQuaternion(own.turn.clone().invert()).add(own.native);
    const shift = oldPivot.clone().sub(parent.pivot).applyQuaternion(parentInverse).add(parent.native).sub(newPivot);
    const rotate = !nearIdentity(parentInverse) || !nearIdentity(own.turn);
    const translate = !nearIdentity(parentInverse) || shift.lengthSq() > 1e-14;
    const rotation = q => new Quaternion().fromArray(q).premultiply(parentInverse).multiply(own.turn).toArray();
    const translateKey = (t, add) => {
      const result = vector(t).applyQuaternion(parentInverse);
      if (add) result.add(shift);
      return result.toArray();
    };
    if (rotate) rebaseTrack(model, node, 'Rotation', sequenceStarts, [0,0,0,1], rotation, rotation);
    if (translate) rebaseTrack(model, node, 'Translation', sequenceStarts, [0,0,0], t => translateKey(t, true),
      t => translateKey(t, node.Translation.LineType === 3));
    // A stored scale is diagonal. A rotated nonuniform scale can have shear, which MDX cannot
    // encode. Keep its diagonal in the new basis; uniform and axis-permuted scales are exact.
    if (!nearIdentity(own.turn) && prop(node,'Scaling')?.some(k => k.Vector[0] !== k.Vector[1] || k.Vector[1] !== k.Vector[2])) {
      const r = new Matrix4().makeRotationFromQuaternion(own.turn).elements;
      const scale = v => [0,4,8].map(i => v[0]*r[i]**2 + v[1]*r[i+1]**2 + v[2]*r[i+2]**2);
      for (const k of node.Scaling.Keys) for (const name of ['Vector','InTan','OutTan']) {
        if (k[name]) k[name] = new Float32Array(scale(k[name]));
      }
    }
    if (newPivot.distanceToSquared(oldPivot) > 1e-14) model.PivotPoints[node.ObjectId] = node.PivotPoint = new Float32Array(newPivot.toArray());
  }
}

function rebaseTrack(model, node, property, starts, fallback, convert, tangent) {
  const track = node[property], keys = track?.Keys;
  const base = new Float32Array(convert(fallback));
  if (!keys?.length) {
    if (starts.length && base.some((v,i) => Math.abs(v-fallback[i]) > 1e-8)) {
      node[property] = { LineType: 0, GlobalSeqId: null, Keys: starts.map(Frame => ({ Frame, Vector: base.slice() })) };
    }
    return;
  }
  const authored = keys.map(k => k.Frame);
  for (const k of keys) {
    k.Vector = new Float32Array(convert(k.Vector));
    for (const t of ['InTan','OutTan']) if (k[t]) k[t] = new Float32Array(tangent(k[t]));
  }
  if (globalSequenceId(track,model) !== null || !base.some((v,i) => Math.abs(v-fallback[i]) > 1e-8)) return;
  for (const {Interval:[start,end]} of model.Sequences) {
    if (authored.some(frame => frame >= start && frame <= end) || keys.some(k => k.Frame === start)) continue;
    const k = { Frame:start, Vector:base.slice() };
    if (track.LineType > 1) {
      const control = property === 'Rotation' || track.LineType === 3 ? base : origin.toArray();
      k.InTan = new Float32Array(control);
      k.OutTan = new Float32Array(control);
    }
    keys.push(k);
  }
  keys.sort((a,b)=>a.Frame-b.Frame);
}

const directions = [[1,.027,.043], [.037,1,.062], [.08,.053,1]];
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const minus = (a,b) => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const xyz = (arrays,g,v) => arrays[g].subarray(v*3,v*3+3);

function triangleTree(faces, arrays) {
  const tris = faces.map(([g,a,b,c]) => {
    const at = xyz(arrays,g,a), second = xyz(arrays,g,b), third = xyz(arrays,g,c);
    return { at, u:minus(second,at), v:minus(third,at),
      lo:at.map((x,i)=>Math.min(x,second[i],third[i])), hi:at.map((x,i)=>Math.max(x,second[i],third[i])) };
  });
  function branch(triangles) {
    const lo = [Infinity,Infinity,Infinity], hi = [-Infinity,-Infinity,-Infinity];
    for (const tri of triangles) for (let i=0;i<3;i++) { lo[i]=Math.min(lo[i],tri.lo[i]); hi[i]=Math.max(hi[i],tri.hi[i]); }
    if (triangles.length <= 12) return {lo,hi,triangles};
    const axis = [0,1,2].reduce((a,b)=>hi[b]-lo[b]>hi[a]-lo[a]?b:a);
    triangles.sort((a,b)=>a.lo[axis]+a.hi[axis]-b.lo[axis]-b.hi[axis]);
    const middle = triangles.length>>1;
    return {lo,hi,children:[branch(triangles.slice(0,middle)),branch(triangles.slice(middle))]};
  }
  return branch(tris);
}

function crossings(tree,p,dir,hits) {
  let lo=-Infinity, hi=Infinity;
  for(let i=0;i<3;i++) {
    lo=Math.max(lo,(tree.lo[i]-p[i])/dir[i]);
    hi=Math.min(hi,(tree.hi[i]-p[i])/dir[i]);
    if(lo>hi)return;
  }
  if (tree.children) { for (const child of tree.children) crossings(child,p,dir,hits); return; }
  for (const {at,u,v} of tree.triangles) {
    const h=cross(dir,v), det=dot(u,h);
    if (Math.abs(det)<1e-9) continue;
    const d=minus(p,at), a=dot(d,h)/det;
    if(a<0||a>1)continue;
    const q=cross(d,u), b=dot(dir,q)/det;
    if(b>=0 && a+b<=1) hits.push(dot(v,q)/det);
  }
}

function penetration(tree,p,eps) {
  if (tree.lo.some((low,i)=>p[i]<=low+eps||p[i]>=tree.hi[i]-eps)) return 0;
  const distances=[];
  for (const dir of directions) {
    const hits=[]; crossings(tree,p,dir,hits);
    let positive=0, negative=0, depth=Infinity, last=-Infinity;
    for (const t of hits.sort((a,b)=>a-b)) {
      if(Math.abs(t)<=eps)return 0;
      if(t-last<eps)continue;
      last=t; depth=Math.min(depth,Math.abs(t));
      if(t>0)positive++;else negative++;
    }
    // Both sides need odd crossings. Two rays agree before a point counts as inside; cut seams
    // and a one-sided sheet alone are not an enclosed limb or torso.
    if (positive%2 && negative%2) distances.push(depth);
  }
  return distances.length>=2?Math.min(...distances):0;
}

const layoutCache = new WeakMap();

/** Compare limb skin with the original recipient at the same samples, using surfaces partitioned
 * by the recipient rig. This avoids penalizing intersections already authored into the asset. */
export function storedPoseClearance(source, partOf, scale) {
  let layout = layoutCache.get(source);
  if (!layout) {
    const faces=new Map(), samples=[], hidden=corpseAndBackgroundGeosets(source);
    source.Geosets.forEach((geo,g)=>{
      if(hidden.has(g)||hasOnlyAdditiveLayers(geosetMaterialLayers(source,geo)))return;
      const parts=Array.from({length:geo.Vertices.length/3},(_,v)=>{
        const votes=new Map();
        for(const [id,w] of vertexBoneWeights(geo,v)){
          const key=trunk(partOf(id));
          if(key)votes.set(key,(votes.get(key)||0)+w);
        }
        const [key,weight]=[...votes].sort((a,b)=>b[1]-a[1])[0]||[];
        return weight>=.5?key:null;
      });
      for(let v=0;v<parts.length;v++)if(parts[v])samples.push({g,points:[v],part:parts[v]});
      const flat=geo.Faces||[];
      for(let i=0;i<flat.length;i+=3){
        const [a,b,c]=flat.subarray?flat.subarray(i,i+3):flat.slice(i,i+3), x=parts[a],y=parts[b],z=parts[c];
        const part=x&&(x===y||x===z)?x:y===z?y:null;
        if(!part)continue;
        if(!faces.has(part))faces.set(part,[]);
        faces.get(part).push([g,a,b,c]);
        if(x===y&&x===z)samples.push({g,points:[a,b,c],part});
      }
    });
    const surfaces=[...faces].filter(([,faces])=>faces.length>=4);
    const native=source.Geosets.map(g=>g.Vertices), epsilon=Math.max(1e-5,scale*2e-4);
    const pointAt = (arrays,{g,points}) => points.length===1?xyz(arrays,g,points[0]):
      xyz(arrays,g,points[0]).map((x,i)=>(x+xyz(arrays,g,points[1])[i]+xyz(arrays,g,points[2])[i])/3);
    const compare = arrays => {
      const shapes=surfaces.map(([part,faces])=>[part,triangleTree(faces,arrays)]);
      return samples.map(sample=>{
        const p=pointAt(arrays,sample), depths={};
        for(const [part,shape] of shapes)if(part!==sample.part&&(limb(part)||limb(sample.part))){
          const depth=penetration(shape,p,epsilon);
          if(depth>0)depths[part]=depth;
        }
        return depths;
      });
    };
    layout={compare,samples,baseline:compare(native),epsilon};
    layoutCache.set(source,layout);
  }
  return arrays=>{
    const after=layout.compare(arrays), byLimb={};
    for (const [i,depths] of after.entries()) for (const [against,depth] of Object.entries(depths)) {
      const excess=depth-(layout.baseline[i][against]||0);
      if(excess<=layout.epsilon)continue;
      const side=layout.samples[i].part;
      for(const key of [side,against].filter(limb)){
        const entry=byLimb[key]??={samples:0,depth:0};
        entry.samples++;entry.depth=Math.max(entry.depth,excess);
      }
    }
    return byLimb;
  };
}

function weightedGeometry(model, source, full, target) {
  return model.Geosets.map((geo,g)=>{
    const own=source.Geosets[g], vertices=geo.Vertices.slice(), normals=geo.Normals?.slice(), tangents=geo.Tangents?.slice();
    for(let v=0;v<vertices.length/3;v++){
      const bound=vertexBoneWeights(geo,v);
      if(!bound.some(([id])=>target.has(id)))continue;
      const p=vector(own.Vertices.subarray(v*3,v*3+3)), moved=vector(vertices.subarray(v*3,v*3+3)), expected=new Vector3();
      let relief=0, weight=0;
      const normal=normals?.length===vertices.length?vector(own.Normals.subarray(v*3,v*3+3)):null;
      const tangent=tangents?.length>=4*(v+1)?vector(own.Tangents.subarray(v*4,v*4+3)):null;
      const n=normal&&vector(normals.subarray(v*3,v*3+3)), t=tangent&&vector(tangents.subarray(v*4,v*4+3));
      for(const [id,w] of bound){
        const old=full.get(id), next=target.get(id);
        expected.addScaledVector(old?point(old,p):p,w);
        weight+=w;
        if(!next)continue;
        relief+=w*(1-next.share);
        moved.addScaledVector(point(next,p).sub(point(old,p)),w);
        if(n)n.addScaledVector(normal.clone().applyQuaternion(next.turn).sub(normal.clone().applyQuaternion(old.turn)),w);
        if(t)t.addScaledVector(tangent.clone().applyQuaternion(next.turn).sub(tangent.clone().applyQuaternion(old.turn)),w);
      }
      if(relief>0 && weight>0)moved.addScaledVector(expected.multiplyScalar(1/weight).sub(vector(vertices.subarray(v*3,v*3+3))),Math.min(1,relief/weight));
      vertices.set(moved.toArray(),v*3);
      if(n&&n.lengthSq()>1e-12)normals.set(n.normalize().toArray(),v*3);
      if(t&&t.lengthSq()>1e-12)tangents.set(t.normalize().toArray(),v*4);
    }
    return {vertices,normals,tangents};
  });
}

function restoreLimbSkin(model, source, shares, anchors, partOfSkin) {
  return model.Geosets.map((geo,g)=>{
    const own=source.Geosets[g], vertices=geo.Vertices.slice(), normals=geo.Normals?.slice(), tangents=geo.Tangents?.slice();
    for(let v=0;v<vertices.length/3;v++){
      const joints=vertexBoneWeights(own,v).map(([id,w])=>[partOfSkin(id),w]);
      if(!joints.some(([part])=>shares[part]<1))continue;
      const original=vector(own.Vertices.subarray(v*3,v*3+3)), posed=vector(vertices.subarray(v*3,v*3+3));
      const n=normals?.length===vertices.length?vector(normals.subarray(v*3,v*3+3)):null;
      const target=posed.clone(), normal=n?.clone();
      const ownNormal=n&&vector(own.Normals.subarray(v*3,v*3+3));
      for(const [part,w] of joints){
        const share=shares[part];
        if(!(share<1))continue;
        const anchor=anchors.get(part), correction=w*(1-share);
        target.addScaledVector((anchor?point(anchor,original):original.clone()).sub(posed),correction);
        if(normal)normal.addScaledVector(ownNormal.clone().applyQuaternion(anchor?.turn||unit).sub(n),correction);
      }
      vertices.set(target.toArray(),v*3);
      if(normal?.lengthSq()>1e-12)normals.set(normal.normalize().toArray(),v*3);
    }
    return {vertices,normals,tangents};
  });
}

function replaceGeometry(model, geometry) {
  model.Geosets.forEach((geo,i) => {
    const {vertices,normals,tangents}=geometry[i];
    geo.Vertices=vertices;
    if(normals)geo.Normals=normals;
    if(tangents)geo.Tangents=tangents;
  });
}


// Earlier equipment and pad fits can bake an independent rigid surface onto a wrist or other
// shared carrier. Give that surface its own bind correction so rebasing the wrist does not
// discard its fit. A truly blended or deformed surface cannot be represented by one such key.
function keepRigidSurfaceMotion(model, source, geometry, transforms) {
  const groups=new Map();
  let nextId=Math.max(-1,...allNodes(model).map(node=>node.ObjectId))+1;
  model.Geosets.forEach((geo,g)=>{
    const original=source.Geosets[g], other=geometry[g].vertices;
    for(let v=0;v<other.length/3;v++){
      const own=[...new Set(vertexBoneWeights(original,v).map(([id])=>id))];
      const current=[...new Set(vertexBoneWeights(geo,v).map(([id])=>id))];
      if(own.length!==1 || current.length!==1)continue;
      const id=current[0], from=vector(other.subarray(v*3,v*3+3)), to=vector(geo.Vertices.subarray(v*3,v*3+3));
      const key=id+':'+own[0], group=groups.get(key)??{id,vertices:[],error:0};
      group.vertices.push({from,to,g,v});
      group.error=Math.max(group.error,(transforms.has(id)?point(transforms.get(id),from):from).distanceTo(to));
      groups.set(key,group);
    }
  });
  for(const {id,vertices,error} of groups.values()){
    if(vertices.length<3||error<.001)continue;
    const first=vertices[0];
    const far=vertices.reduce((a,b)=>a.from.distanceToSquared(first.from)>=b.from.distanceToSquared(first.from)?a:b);
    const edge=far.from.clone().sub(first.from);
    if(edge.lengthSq()<1e-8)continue;
    const area=v=>v.from.clone().sub(first.from).cross(edge).lengthSq();
    const third=vertices.reduce((a,b)=>area(a)>=area(b)?a:b);
    if(area(third)<1e-8)continue;
    const basis=(a,b,c)=>{
      const x=b.clone().sub(a).normalize(), z=x.clone().cross(c.clone().sub(a)).normalize(), y=z.clone().cross(x);
      return new Matrix4().makeBasis(x,y,z);
    };
    const old=basis(first.to,far.to,third.to), now=basis(first.from,far.from,third.from);
    const turn=new Quaternion().setFromRotationMatrix(old.multiply(now.invert())).normalize();
    const fit={native:first.from,pivot:first.to,turn};
    if(vertices.some(({from,to})=>point(fit,from).distanceToSquared(to)>1e-5))continue;
    const byGeo=new Map();
    for(const {g,v} of vertices){if(!byGeo.has(g))byGeo.set(g,[]);byGeo.get(g).push(v);}
    if([...byGeo].some(([g])=>model.Geosets[g].SkinWeights?.length?nextId>255:model.Geosets[g].Groups.length>=256))continue;
    const original=model.Nodes[id], pivot=new Float32Array(first.to.toArray());
    const node={Name:(original?.Name || 'Skin')+' Bind', ObjectId:nextId,Parent:id,Flags:256,GeosetId:null,GeosetAnimId:null,PivotPoint:pivot};
    model.Bones.push(node);
    model.Nodes[nextId]=node;
    model.PivotPoints[nextId]=pivot;
    transforms.set(nextId,fit);
    for(const [g,points] of byGeo){
      const geo=model.Geosets[g];
      if(geo.SkinWeights?.length){
        for(const v of points)for(let i=0;i<4;i++)if(geo.SkinWeights[v*8+i+4])geo.SkinWeights[v*8+i]=nextId;
      }else{
        const slot=geo.Groups.length;
        geo.Groups.push([nextId]);geo.TotalGroupsCount++;
        for(const v of points)geo.VertexGroup[v]=slot;
      }
    }
    nextId++;
  }
}

export function finishDonorPose(model, source, full, {enabled, measure, anchors, partOfSkin}) {
  const ownGeometry = () => source.Geosets.map(geo=>({vertices:geo.Vertices.slice(),normals:geo.Normals?.slice(),tangents:geo.Tangents?.slice()}));
  const keepOwn = () => {
    const geometry=ownGeometry();
    keepRigidSurfaceMotion(model,source,geometry,full);
    movePoseIntoKeys(model,full);
    replaceGeometry(model,geometry);
  };
  if (!enabled) {
    keepOwn();
    return { enabled:false };
  }
  const original=measure(model.Geosets.map(geo=>geo.Vertices));
  if(!Object.keys(original).length)return {enabled:true,added:{},eased:{}};

  const shares={};
  let wholeLimb=false;
  const build=()=>{
    const target=new Map();
    for(const [id,frame] of full){
      const share=shares[frame.part];
      if(share==null||share===1)continue;
      const anchor=anchors.get(frame.part);
      const straight=anchor?point(anchor,frame.native):frame.native;
      target.set(id,{...frame,share,turn:(anchor?.turn||unit).clone().slerp(frame.turn,share),pivot:straight.clone().lerp(frame.pivot,share)});
    }
    const geometry=wholeLimb?restoreLimbSkin(model,source,shares,anchors,partOfSkin):weightedGeometry(model,source,full,target);
    return {target,geometry,added:measure(geometry.map(g=>g.vertices))};
  };
  // Start with the limbs that added penetration, then include any limb a changed one now clips.
  // A coarse bracket followed by bisection leaves each branch as close to the donor as it clears.
  for(const key of Object.keys(original))shares[key]=0;
  let safe=build();
  while(Object.keys(safe.added).some(key=>shares[key]==null)){
    for(const key of Object.keys(safe.added))shares[key]??=0;
    safe=build();
  }
  if(Object.keys(safe.added).length){
    // A limb without a matching donor chain can still be carried by other donor joints.
    // In that case use its native skin ownership to ease the whole visible limb.
    wholeLimb=true;
    safe=build();
    while(Object.keys(safe.added).some(key=>shares[key]==null)){
      for(const key of Object.keys(safe.added))shares[key]??=0;
      safe=build();
    }
  }
  if(Object.keys(safe.added).length){
    // Some source meshes cannot retain the donor trunk while keeping their own intersections.
    // The validated native geometry is the result when even zero limb correction cannot clear it.
    keepOwn();
    return {enabled:true,added:{},original,eased:shares,retainedOwn:true,blocked:safe.added};
  }
  for(const key of Object.keys(shares)){
    let low=0,high=1;
    shares[key]=high;
    let trial=build();
    if(!Object.keys(trial.added).length){safe=trial;continue;}
    for(let i=0;i<7;i++){
      shares[key]=(low+high)/2; trial=build();
      if(Object.keys(trial.added).length)high=shares[key];
      else {low=shares[key];safe=trial;}
    }
    shares[key]=low;
  }
  const transforms=new Map();
  for(const [id,next] of safe.target){
    const old=full.get(id);
    transforms.set(id,{native:next.pivot,pivot:old.pivot,turn:old.turn.clone().multiply(next.turn.clone().invert())});
  }
  keepRigidSurfaceMotion(model,source,safe.geometry,transforms);
  movePoseIntoKeys(model,transforms);
  replaceGeometry(model,safe.geometry);
  return {enabled:true,added:{},original,eased:shares,...(wholeLimb?{wholeLimb:true}:{})};
}
