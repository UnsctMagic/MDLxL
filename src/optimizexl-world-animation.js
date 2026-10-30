import { Vector3, Quaternion } from 'three';
import { allNodes, composeNodeMatrices, compileTrackSampler, sampleTrack, skinGeoset, TRANSFORM_DEFAULTS, isGlobalTrack } from './animation.js';
import { nodeIndex } from './node-hierarchy.js';
import { optimizexlLocalTrack } from './optimizexl-format.js';
import { animationMotionGuard, constantSegment } from './optimizexl-animation.js';

const properties=['Translation','Rotation','Scaling'];
const same=(a,b)=>a?.length===b?.length&&Array.from(a).every((v,i)=>v===b[i]);
const keysIn=(track,interval)=>track.Keys.filter(k=>k.Frame>=interval[0]&&k.Frame<=interval[1]);
// The whole-millisecond frames strictly between from and to, each once,
// in breadth-first midpoint order (the middle, then the quarters, ...).
function* bisectedFrames(from,to){
 const first=Math.floor(from)+1,last=Math.ceil(to)-1;if(first>last)return;
 const queue=[[first,last]];
 for(let i=0;i<queue.length;i++){const [a,b]=queue[i],m=(a+b)>>1;yield m;if(a<m)queue.push([a,m-1]);if(m<b)queue.push([m+1,b]);}
}
const supported=(track,property)=>!!track?.Keys&&optimizexlLocalTrack(track)&&[0,1,2,3].includes(track.LineType)&&track.Keys.length>0&&track.Keys.every((k,i,a)=>
 Number.isInteger(k.Frame)&&(!i||k.Frame>a[i-1].Frame)&&['Vector',...(track.LineType>=2?['InTan','OutTan']:[])].every(p=>
 k[p]?.length===(property==='Rotation'?4:3)&&Array.from(k[p]).every(Number.isFinite)&&(property!=='Rotation'||Math.abs(Math.hypot(...k[p])-1)<1e-5)));

/** squad(slerp(a,b,t),slerp(a,b,t),2t(1-t)) = slerp(a,b,t).
 * Require literal equality of BOTH controls at EVERY key, never vector tangents.
 * Caller owns domain/exclusion checks. No runtime reference model is involved. */
export function exactLinearQuaternion(track) {
 if(!supported(track,'Rotation')||track.LineType<2||!track.Keys.every(k=>same(k.Vector,k.InTan)&&same(k.Vector,k.OutTan)))return null;
 return {...track,LineType:1,Keys:track.Keys.map(({Frame,Vector})=>({Frame,Vector:new Float32Array(Vector)}))};
}

/** Budgets depend on local mesh speed, never animation names. Half a model/s
 * or less uses a quarter of the maximum; 6.5 models/s uses the full maximum. */
export function sequenceWorldBudget(peakSpeed,size,maximum) {
 const activity=Math.max(0,Math.min(1,(peakSpeed*1000/size-.5)/6));
 return maximum*(.25+.75*activity);
}

function skinPoints(model) {
 // Position + bindings determine skinning. UV/normal splits need checking once.
 const points=[],groups=[],vertexGroup=[],known=new Set();
 for(const g of model.Geosets)for(let v=0;v<g.Vertices.length/3;v++){
  const group=g.Groups[g.VertexGroup[v]]||[],point=Array.from(g.Vertices.subarray(v*3,v*3+3)),key=point.join(',')+':'+group.join(',');
  if(known.has(key))continue;known.add(key);vertexGroup.push(groups.length);groups.push(group);points.push(...point);
 }
 return {Vertices:new Float32Array(points),Groups:groups,VertexGroup:vertexGroup};
}
const positions=(mesh,matrices)=>skinGeoset(mesh,matrices,new Float64Array(mesh.Vertices.length));
function hasMotion(model,sequence,ids) {
 const interval=model.Sequences[sequence].Interval;
 return allNodes(model).some(n=>(!ids||ids.has(n.ObjectId))&&properties.some(p=>{
  const t=n[p];if(!t?.Keys||!optimizexlLocalTrack(t))return false;
  const keys=keysIn(t,interval);
  return keys.some(k=>!same(k.Vector,keys[0].Vector)||t.LineType>=2&&
   (p==='Rotation'||t.LineType===3?!same(k.InTan,k.Vector)||!same(k.OutTan,k.Vector):[...k.InTan,...k.OutTan].some(v=>v!==0)));
 }));
}
// Compile only sequence domains and constant properties, never interpolation
// arithmetic. A trial invalidates its node's descriptors; immutable originals
// are reused. One-key/frozen-global domains do not consult interpolation.
function localSampler(model,sequence,versions=new Map()) {
 const descriptors=new Map(),interval=model.Sequences[sequence].Interval;
 return (node,frame)=>{
  const version=versions.get(node.ObjectId)||0;
  let entry=descriptors.get(node.ObjectId);
  if(entry?.version!==version){
   const fields=properties.map(property=>{
    const track=node[property],options={interval,globalSequences:model.GlobalSequences,globalTime:0,fallback:TRANSFORM_DEFAULTS[property],quaternion:property==='Rotation'};
    const constant=!track?.Keys||isGlobalTrack(track,model)||keysIn(track,interval).length<=1;
    const sample=compileTrackSampler(track,options);return {sample,constant,value:constant?sample(interval[0]):null};
   });
   entry={version,fields,value:{t:new Vector3(),r:new Quaternion(),s:new Vector3()}};descriptors.set(node.ObjectId,entry);
  }
  const values=entry.fields.map(f=>f.constant?f.value:f.sample(frame));
  entry.value.t.fromArray(values[0]);entry.value.r.fromArray(values[1]);entry.value.s.fromArray(values[2]);return entry.value;
 };
}
// Bind data is compiled once per influence group. Held group matrices reuse
// their posed vertices, while moving groups still use the shared skin owner.
function skinSampler(mesh) {
 const groups=new Map();
 for(let v=0;v<mesh.Vertices.length/3;v++){
  const ids=mesh.Groups[mesh.VertexGroup[v]]||[],key=ids.join(',');
  if(!groups.has(key))groups.set(key,{ids,indices:[]});groups.get(key).indices.push(v*3);
 }
 for(const group of groups.values()){
  group.mesh={Vertices:new Float32Array(group.indices.flatMap(i=>Array.from(mesh.Vertices.subarray(i,i+3)))),Groups:[group.ids],VertexGroup:group.indices.map(()=>0)};
  group.posed=new Float64Array(group.mesh.Vertices.length);group.previous=[];
 }
 return (matrices,out)=>{
  for(const group of groups.values()){
   let changed=!group.ready;
   for(let i=0;i<group.ids.length;i++){
    const elements=matrices.get(group.ids[i])?.elements,previous=group.previous[i];
    if(!previous||!elements||!elements.every((v,j)=>Object.is(v,previous[j])))changed=true;
   }
   if(changed){
    skinGeoset(group.mesh,matrices,group.posed);group.ready=true;
    group.previous=group.ids.map(id=>matrices.get(id)?.elements.slice());
   }
   for(let v=0;v<group.indices.length;v++){const i=group.indices[v],j=v*3;out[i]=group.posed[j];out[i+1]=group.posed[j+1];out[i+2]=group.posed[j+2];}
  }
  return out;
 };
}
// A certificate for clips whose only changing TRS components are linear
// translations. Constant rotations may still differ at raw quaternion keys;
// include that difference AND floating arithmetic in a whole-pose error radius.
// This is used only below the budget's flat slow-speed threshold, never to
// increase a measured speed or relax a budget. Unsupported cases sample densely.
export function slowSpeedBound(model,mesh,sequence,skinIds,size) {
 const interval=model.Sequences[sequence].Interval,byId=new Map(allNodes(model).map(n=>[n.ObjectId,n])),world=new Map(),visiting=new Set();
 const eps=1024*Number.EPSILON,norm=v=>Math.max(...Array.from(v,Math.abs));
 function local(node){
  if(node.Flags&7)return null;
  const values={},ranges={};let velocity=0,quaternionError=0;
  for(const property of properties){
   const track=node[property],options={interval,globalSequences:model.GlobalSequences,globalTime:0,fallback:TRANSFORM_DEFAULTS[property],quaternion:property==='Rotation'};
   const keys=track?.Keys&&!isGlobalTrack(track,model)?keysIn(track,interval):[];
   const raw=sampleTrack(track,interval[0],options);values[property]=Array.from(raw);ranges[property]=norm(raw);
   if(keys.length<=1)continue;
   if(property==='Translation'){
    if(track.LineType>1)return null;
    for(let i=0;i<keys.length;i++){
     ranges[property]=Math.max(ranges[property],norm(keys[i].Vector));
     if(i){const a=keys[i-1],b=keys[i],delta=norm(Array.from(b.Vector,(v,j)=>v-a.Vector[j]));
      if(track.LineType===0&&delta)return null;
      velocity=Math.max(velocity,delta/(b.Frame-a.Frame));
     }
    }
   }else{
    if(!keys.every(k=>same(k.Vector,keys[0].Vector)))return null;
    if(property==='Scaling'){if(track.LineType>1)return null;}
    else if(track.LineType!==0){
     if(!supported(track,'Rotation')||track.LineType>=2&&!keys.every(k=>same(k.Vector,k.InTan)&&same(k.Vector,k.OutTan)))return null;
     const q=new Quaternion().fromArray(keys[0].Vector).normalize().toArray();
     quaternionError=norm(q.map((v,i)=>v-keys[0].Vector[i]))+eps;
     values.Rotation=q;
    }
   }
  }
  if(!Object.values(values).every(v=>v.every(Number.isFinite)))return null;
  // Ask the shared owner for pivot composition rather than duplicating it.
  const matrix=composeNodeMatrices(model,[node.ObjectId],()=>({t:new Vector3(),r:new Quaternion().fromArray(values.Rotation),s:new Vector3().fromArray(values.Scaling)}),new Map([[node.ObjectId,node]])).get(node.ObjectId).elements;
  const a=Math.max(...[0,1,2].map(c=>Math.abs(matrix[c])+Math.abs(matrix[c+4])+Math.abs(matrix[c+8])));
  const pivot=norm(node.PivotPoint||model.PivotPoints?.[node.ObjectId]||[0,0,0]);
  const ae=24*(2*(norm(values.Rotation)+quaternionError)*quaternionError+quaternionError**2)*ranges.Scaling+eps*(1+a);
  const t=ranges.Translation+pivot*(1+a),te=ae*pivot+eps*(1+t);
  return {a,ae,t,te,v:velocity*(1+eps)};
 }
 function resolve(id){
  if(world.has(id))return world.get(id);
  const node=byId.get(id);if(!node||visiting.has(id))return null;
  visiting.add(id);const l=local(node);if(!l)return null;
  let result=l;
  if(node.Parent!=null&&byId.has(node.Parent)){
   const p=resolve(node.Parent);if(!p)return null;
   const a=p.a*l.a,t=p.a*l.t+p.t;
   result={a,t,v:(p.a*l.v+p.v)*(1+eps),ae:p.a*l.ae+p.ae*(l.a+l.ae)+eps*(1+a),te:p.a*l.te+p.ae*(l.t+l.te)+p.te+eps*(1+t)};
  }
  visiting.delete(id);world.set(id,result);return result;
 }
 for(const id of skinIds)if(!resolve(id))return null;
 let bound=0;
 for(let vertex=0;vertex<mesh.Vertices.length/3;vertex++){
  const group=mesh.Groups[mesh.VertexGroup[vertex]]||[];if(!group.length)continue;if(group.length>16)return null;
  const extent=norm(mesh.Vertices.subarray(vertex*3,vertex*3+3));let speed=0;
  for(const id of group){const w=world.get(id);if(!w)return null;speed+=w.v+2*(w.ae*extent+w.te);}
  // Equal-weight skinning adds another rounding radius at each end.
  const magnitude=group.reduce((sum,id)=>{const w=world.get(id);return sum+w.a*extent+w.t;},0)/group.length;
  bound=Math.max(bound,Math.sqrt(3)*(speed/group.length+2*eps*(1+magnitude))*(1+eps));
 }
 return Number.isFinite(bound)&&bound<=size*.5/1000?bound:null;
}
function peakSpeed(model,mesh,sequence,skinIds,size,poseIds) {
 const interval=model.Sequences[sequence].Interval;
 if(!hasMotion(model,sequence,skinIds))return 0;
 const certified=slowSpeedBound(model,mesh,sequence,skinIds,size);
 if(certified!==null)return certified;
 const byId=new Map(allNodes(model).map(n=>[n.ObjectId,n])),ids=poseIds||[...skinIds].sort((a,b)=>a-b),local=localSampler(model,sequence),scratch={},skin=skinSampler(mesh);
 let previous=new Float64Array(mesh.Vertices.length),current=new Float64Array(mesh.Vertices.length),peak=0;
 skin(composeNodeMatrices(model,ids,n=>local(n,interval[0]),byId,scratch),previous);
 for(let frame=interval[0]+1;frame<=interval[1];frame++){
  skin(composeNodeMatrices(model,ids,n=>local(n,frame),byId,scratch),current);
  for(let i=0;i<current.length;i+=3){
   const x=current[i]-previous[i],y=current[i+1]-previous[i+1],z=current[i+2]-previous[i+2],square=x*x+y*y+z*z;
   if(!Number.isFinite(square)||square>=peak*peak*(1-1e-12))peak=Math.max(peak,Math.hypot(x,y,z));
  }
  [previous,current]=[current,previous];
 }
 return peak;
}

/** Opt-in node TRS reduction. Whole candidate mesh error is compared with the
 * immutable stage input at every millisecond, plus quarter points of sub-ms
 * spans. Parent-first edits spend one shared sequence budget. Global-influenced
 * or camera-dependent skin groups remain under the old exact owner. The 10%
 * component/turn guard remains where this budget could flatten that excursion;
 * larger excursions use the direct skin bound. */
export function reduceWorldAnimation(model,settings,{protectedNodes=new Set(),size,reach=new Map(),onChange=()=>{}}={}) {
 const nodes=allNodes(model),tree=nodeIndex(model,nodes),mesh=skinPoints(model);
 let terminalKeys=0;
 // The legacy exact owner keeps both outer keys. This mode additionally owns
 // only the final record of a proven constant local hold; native playback holds
 // its predecessor through the unchanged sequence end. No interior key owner
 // competes with this boundary-only deletion.
 for(const node of nodes)if(!protectedNodes.has(node.ObjectId))for(const property of properties){
  const t=node[property];if(!supported(t,property))continue;
  for(const [sequence,s]of model.Sequences.entries()){
   if(model.Sequences.some((other,i)=>i!==sequence&&other.Interval[0]<=s.Interval[1]&&other.Interval[1]>=s.Interval[0]))continue;
   let inside=keysIn(t,s.Interval);
   while(inside.length>1){
    const a=inside.at(-2),b=inside.at(-1);
    if(!(t.LineType===0?same(a.Vector,b.Vector):constantSegment(t,a,b,property==='Rotation')))break;
    // Holding a non-unit raw quaternion differs from interpolating normalized
    // endpoints, even when the two raw values are equal.
    if(property==='Rotation'&&t.LineType!==0&&Math.hypot(...a.Vector)!==1)break;
    t.Keys.splice(t.Keys.indexOf(b),1);inside.pop();terminalKeys++;
    onChange(node,property,{sequence,frame:b.Frame,from:a.Frame,to:s.Interval[1]});
   }
  }
 }
 const original=structuredClone(model),originalById=new Map(allNodes(original).map(n=>[n.ObjectId,n]));
 const originalLocals=model.Sequences.map((_,i)=>localSampler(original,i));
 const maximum=Math.max(0,Number(settings.worldTolerance)||0),stats={keys:terminalKeys,terminalKeys,linearTracks:0,exactLinearTracks:0,sequences:[]};
 const originalMoving=[];
 const usable=model.Sequences.map((s,i)=>Number.isInteger(s.Interval?.[0])&&Number.isInteger(s.Interval?.[1])&&s.Interval[1]>=s.Interval[0]&&
  !model.Sequences.some((other,j)=>i!==j&&other.Interval[0]<=s.Interval[1]&&other.Interval[1]>=s.Interval[0]));
 const affected=new Map(),eligible=new Set(),byId=tree.byId,versions=new Map(),worldVersions=new Map(),caches=new Map();
 const descendants=new Map(nodes.map(n=>[n.ObjectId,nodes.filter(c=>tree.isAncestor(c.ObjectId,n.ObjectId)).map(c=>c.ObjectId)]));
 const skinIds=new Set(mesh.Groups.flatMap(group=>group.flatMap(id=>tree.ancestors(id,true))));
 // Cycles have traversal-dependent identity edges in the shared owner. Keep
 // their root order identical to full-model playback rather than a subtree.
 const cyclic=nodes.some(n=>{const path=tree.ancestors(n.ObjectId,true);return path.includes(byId.get(path.at(-1))?.Parent);});
 const fixedPoseIds=cyclic?nodes.map(n=>n.ObjectId):null;
 // CPU matrices omit camera-facing transforms; non-unit quaternion playback
 // can also differ between evaluators. Retain every affected influence chain.
 const unsupportedNodes=new Set(nodes.filter(n=>(n.Flags&248)||(n.Rotation?.Keys&&!supported(n.Rotation,'Rotation'))||properties.some(p=>n[p]?.Keys&&!optimizexlLocalTrack(n[p]))).map(n=>n.ObjectId));
 for(const node of nodes){
  const id=node.ObjectId,indices=[],dependencies=new Set();
  mesh.Groups.forEach((group,v)=>{
   if(!group.some(b=>tree.isAncestor(b,id)))return;
   indices.push(v*3);for(const bone of group)for(const parent of tree.ancestors(bone,true))dependencies.add(parent);
  });
  affected.set(id,{indices,ids:fixedPoseIds||[...new Set(indices.flatMap(i=>mesh.Groups[i/3]))],
   mesh:{Vertices:new Float32Array(indices.flatMap(i=>Array.from(mesh.Vertices.subarray(i,i+3)))),Groups:indices.map(i=>mesh.Groups[i/3]),VertexGroup:indices.map((_,i)=>i)},out:new Float64Array(indices.length*3)});
  if(indices.length&&!protectedNodes.has(id)&&![...dependencies].some(b=>unsupportedNodes.has(b)))eligible.add(id);
 }
 for(let sequence=0;sequence<model.Sequences.length;sequence++){
  originalMoving[sequence]=hasMotion(original,sequence,skinIds);
  const peak=usable[sequence]&&maximum>0?peakSpeed(original,mesh,sequence,skinIds,size,fixedPoseIds):0;
  stats.sequences.push({sequence,peakSpeed:peak,budget:sequenceWorldBudget(peak,size,maximum)});
 }
 function cacheFor(sequence){
  if(!caches.has(sequence))caches.set(sequence,new Map());
  return caches.get(sequence);
 }
 function frameState(sequence,frame){
  const cache=cacheFor(sequence);
  if(!cache.has(frame)){
   // Bound working memory; eviction never changes samples or acceptance.
   if(cache.size>=2048)cache.delete(cache.keys().next().value);
   cache.set(frame,{before:new Map(),locals:new Map(),originalMatrices:{version:()=>0},matrices:{version:n=>worldVersions.get(n.ObjectId)||0}});
  }
  return cache.get(frame);
 }
 const currentLocals=model.Sequences.map((_,i)=>localSampler(model,i,versions));
 function local(node,sequence,frame,state){
  const version=versions.get(node.ObjectId)||0,cached=state.locals.get(node.ObjectId);
  if(cached?.version===version)return cached.value;
  const sampled=currentLocals[sequence](node,frame),value={t:sampled.t.clone(),r:sampled.r.clone(),s:sampled.s.clone()};
  state.locals.set(node.ObjectId,{version,value});return value;
 }
 function touch(node){versions.set(node.ObjectId,(versions.get(node.ObjectId)||0)+1);for(const id of descendants.get(node.ObjectId))worldVersions.set(id,(worldVersions.get(id)||0)+1);}
 function fits(node,sequence,from,to){
  const {indices,ids,mesh:subset,out}=affected.get(node.ObjectId),budget=stats.sequences[sequence].budget,interval=model.Sequences[sequence].Interval;
  const check=frame=>{
   const state=frameState(sequence,frame);
   if(!state.before.has(node.ObjectId))state.before.set(node.ObjectId,positions(subset,composeNodeMatrices(original,ids,n=>originalLocals[sequence](n,frame),originalById,state.originalMatrices)));
   const before=state.before.get(node.ObjectId),matrices=composeNodeMatrices(model,ids,n=>local(n,sequence,frame,state),byId,state.matrices),after=skinGeoset(subset,matrices,out);
   const limit=frame===interval[0]||frame===interval[1]?0:budget;
   for(let i=0;i<after.length;i+=3){
    const x=after[i]-before[i],y=after[i+1]-before[i+1],z=after[i+2]-before[i+2],square=x*x+y*y+z*z;
    if(Number.isFinite(square)&&square<limit*limit*(1-1e-12))continue;
    if(!(Math.hypot(x,y,z)<=limit))return false;
   }
   return true;
  };
  if(!check(from)||!check(to))return false;
  if(!originalMoving[sequence]&&!hasMotion(model,sequence,skinIds))return true;
  // Every interior millisecond is checked; midpoints first, so an excursion
  // that rejects the deletion is usually found after a few frames.
  for(const frame of bisectedFrames(from,to))if(!check(frame))return false;
  // Integer timestamps can still contain a visible cubic excursion in 1 ms.
  if(to-from<=1)for(const fraction of [.25,.5,.75])if(!check(from+(to-from)*fraction))return false;
  return true;
 }
 function reduce(node,property,sequence,guard,record=true){
  const track=node[property],interval=model.Sequences[sequence].Interval;
  let removed=0,changed=true;
  while(changed){
   changed=false;
   const inside=keysIn(track,interval);
   const candidates=inside.slice(1,-1).map((key,i)=>({key,gap:inside[i+2].Frame-inside[i].Frame})).sort((a,b)=>b.gap-a.gap||a.key.Frame-b.key.Frame);
   for(const {key:pending}of candidates){const i=track.Keys.indexOf(pending);
    const a=track.Keys[i-1],key=track.Keys[i],b=track.Keys[i+1];
    if(a.Frame<interval[0]||b.Frame>interval[1]||key.Frame<=interval[0]||key.Frame>=interval[1]){continue;}
    track.Keys.splice(i,1);touch(node);
    if(guard(track,a.Frame,b.Frame)&&fits(node,sequence,a.Frame,b.Frame)){
     removed++;changed=true;if(record)onChange(node,property,{sequence,frame:key.Frame,from:a.Frame,to:b.Frame});
    }else{track.Keys.splice(i,0,key);touch(node);}
   }
  }
  return removed;
 }
 const ordered=[...nodes].sort((a,b)=>tree.depth(a.ObjectId)-tree.depth(b.ObjectId)||a.ObjectId-b.ObjectId);
 // Keep caches for just one sequence during greedy deletion.
 for(let sequence=0;sequence<model.Sequences.length;sequence++){
  if(!usable[sequence]||!maximum)continue;
  for(const node of ordered)if(eligible.has(node.ObjectId))for(const property of properties){
   const track=node[property];if(!supported(track,property)||track.LineType===0)continue;
   const baseline=originalById.get(node.ObjectId);
   const guard=animationMotionGuard(baseline[property],property,model.Sequences[sequence].Interval,{reach:reach.get(node.ObjectId)||0,worldBudget:stats.sequences[sequence].budget});
   stats.keys+=reduce(node,property,sequence,guard);
  }
  caches.delete(sequence);
 }
 // Interpolation is track-wide. Never convert across unassigned keys, overlaps
 // or global domains; all animations on that track must pass before committing.
 for(const node of ordered)if(eligible.has(node.ObjectId))for(const property of properties){
  const track=node[property];if(!supported(track,property)||track.LineType<2)continue;
  if(track.Keys.some(k=>!model.Sequences.some((s,i)=>usable[i]&&k.Frame>=s.Interval[0]&&k.Frame<=s.Interval[1])))continue;
  const exact=property==='Rotation'?exactLinearQuaternion(track):null;
  if(exact){node[property]=exact;touch(node);stats.exactLinearTracks++;
   for(const [sequence,s]of model.Sequences.entries())if(keysIn(track,s.Interval).length)onChange(node,property,{sequence,frame:keysIn(track,s.Interval)[0].Frame,kind:'interpolation'});
   continue;
  }
  if(!maximum)continue;
  const old=track,baseline=originalById.get(node.ObjectId)[property];
  // Start with authored samples and split only spans that fail. Baking minute-
  // long holds first creates tens of thousands of disposable keys.
  node[property]={...track,LineType:1,Keys:track.Keys.map(({Frame,Vector})=>({Frame,Vector:new Float32Array(Vector)}))};touch(node);
  let valid=true;
  for(const [sequence,s]of model.Sequences.entries()){
   const inside=keysIn(old,s.Interval);
   // A zero/one-key domain returns its fallback/raw value before consulting
   // interpolation. Changing its representation cannot change any pose.
   if(inside.length<=1||property==='Rotation'&&exactLinearQuaternion({...old,Keys:inside}))continue;
   const guard=animationMotionGuard(baseline,property,s.Interval,{reach:reach.get(node.ObjectId)||0,worldBudget:stats.sequences[sequence].budget});
   const pending=inside.slice(1).map((k,i)=>[inside[i].Frame,k.Frame]);
   while(pending.length&&valid){
    const [from,to]=pending.pop();
    if(guard(node[property],from,to)&&fits(node,sequence,from,to))continue;
    if(to-from<2){valid=false;break;}
    const frame=Math.floor((from+to)/2),Vector=new Float32Array(sampleTrack(old,frame,{interval:s.Interval,quaternion:property==='Rotation',fallback:property==='Scaling'?[1,1,1]:property==='Rotation'?[0,0,0,1]:[0,0,0]}));
    node[property].Keys.push({Frame:frame,Vector});node[property].Keys.sort((a,b)=>a.Frame-b.Frame);touch(node);
    pending.push([from,frame],[frame,to]);
   }
   if(!valid||!guard(node[property])||!fits(node,sequence,s.Interval[0],s.Interval[1])){valid=false;break;}
   reduce(node,property,sequence,guard,false);caches.delete(sequence);
  }
  const width=property==='Rotation'?4:3,oldBytes=old.Keys.length*(4+width*12),newBytes=node[property].Keys.length*(4+width*4);
  if(!valid||newBytes>=oldBytes){node[property]=old;touch(node);}
  else{
   stats.linearTracks++;stats.keys+=old.Keys.length-node[property].Keys.length;
   for(const [sequence,s]of model.Sequences.entries()){
    const kept=new Set(keysIn(node[property],s.Interval).map(k=>k.Frame));
    if(kept.size)onChange(node,property,{sequence,frame:keysIn(node[property],s.Interval)[0].Frame,kind:'interpolation'});
    for(const key of keysIn(old,s.Interval))if(!kept.has(key.Frame))onChange(node,property,{sequence,frame:key.Frame,from:s.Interval[0],to:s.Interval[1]});
   }
  }
  caches.clear();
 }
 return stats;
}
