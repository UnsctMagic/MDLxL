import { Vector3, Quaternion } from 'three';
import { allNodes, composeNodeMatrices, sampleNodeMatrices, sampleNodeProperty, sampleTrack, skinGeoset } from './animation.js';
import { nodeIndex } from './node-hierarchy.js';
import { optimizexlLocalTrack } from './optimizexl-format.js';
import { animationMotionGuard, constantSegment } from './optimizexl-animation.js';

const properties=['Translation','Rotation','Scaling'];
const same=(a,b)=>a?.length===b?.length&&Array.from(a).every((v,i)=>v===b[i]);
const keysIn=(track,interval)=>track.Keys.filter(k=>k.Frame>=interval[0]&&k.Frame<=interval[1]);
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
const distance=(a,b,i)=>Math.hypot(a[i]-b[i],a[i+1]-b[i+1],a[i+2]-b[i+2]);
function hasMotion(model,sequence,ids) {
 const interval=model.Sequences[sequence].Interval;
 return allNodes(model).some(n=>(!ids||ids.has(n.ObjectId))&&properties.some(p=>{
  const t=n[p];if(!t?.Keys||!optimizexlLocalTrack(t))return false;
  const keys=keysIn(t,interval);
  return keys.some(k=>!same(k.Vector,keys[0].Vector)||t.LineType>=2&&
   (p==='Rotation'||t.LineType===3?!same(k.InTan,k.Vector)||!same(k.OutTan,k.Vector):[...k.InTan,...k.OutTan].some(v=>v!==0)));
 }));
}
function peakSpeed(model,mesh,sequence,skinIds) {
 const interval=model.Sequences[sequence].Interval;
 if(!hasMotion(model,sequence,skinIds))return 0;
 let previous=positions(mesh,sampleNodeMatrices(model,interval[0],sequence,0)),peak=0;
 for(let frame=interval[0]+1;frame<=interval[1];frame++){
  const current=positions(mesh,sampleNodeMatrices(model,frame,sequence,0));
  for(let i=0;i<current.length;i+=3)peak=Math.max(peak,distance(current,previous,i));
  previous=current;
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
 const maximum=Math.max(0,Number(settings.worldTolerance)||0),stats={keys:terminalKeys,terminalKeys,linearTracks:0,exactLinearTracks:0,sequences:[]};
 const originalMoving=[];
 const usable=model.Sequences.map((s,i)=>Number.isInteger(s.Interval?.[0])&&Number.isInteger(s.Interval?.[1])&&s.Interval[1]>=s.Interval[0]&&
  !model.Sequences.some((other,j)=>i!==j&&other.Interval[0]<=s.Interval[1]&&other.Interval[1]>=s.Interval[0]));
 const affected=new Map(),eligible=new Set(),byId=tree.byId,versions=new Map(),caches=new Map();
 const skinIds=new Set(mesh.Groups.flatMap(group=>group.flatMap(id=>tree.ancestors(id,true))));
 // CPU matrices omit camera-facing transforms; non-unit quaternion playback
 // can also differ between evaluators. Retain every affected influence chain.
 const unsupportedNodes=new Set(nodes.filter(n=>(n.Flags&248)||(n.Rotation?.Keys&&!supported(n.Rotation,'Rotation'))||properties.some(p=>n[p]?.Keys&&!optimizexlLocalTrack(n[p]))).map(n=>n.ObjectId));
 for(const node of nodes){
  const id=node.ObjectId,indices=[],dependencies=new Set();
  mesh.Groups.forEach((group,v)=>{
   if(!group.some(b=>tree.isAncestor(b,id)))return;
   indices.push(v*3);for(const bone of group)for(const parent of tree.ancestors(bone,true))dependencies.add(parent);
  });
  affected.set(id,{indices,ids:[...new Set(indices.flatMap(i=>mesh.Groups[i/3]))],
   mesh:{Vertices:new Float32Array(indices.flatMap(i=>Array.from(mesh.Vertices.subarray(i,i+3)))),Groups:indices.map(i=>mesh.Groups[i/3]),VertexGroup:indices.map((_,i)=>i)}});
  if(indices.length&&!protectedNodes.has(id)&&![...dependencies].some(b=>unsupportedNodes.has(b)))eligible.add(id);
 }
 for(let sequence=0;sequence<model.Sequences.length;sequence++){
  originalMoving[sequence]=hasMotion(original,sequence,skinIds);
  const peak=usable[sequence]&&maximum>0?peakSpeed(original,mesh,sequence,skinIds):0;
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
   cache.set(frame,{before:positions(mesh,sampleNodeMatrices(original,frame,sequence,0)),locals:new Map()});
  }
  return cache.get(frame);
 }
 function local(node,sequence,frame,state){
  const version=versions.get(node.ObjectId)||0,cached=state.locals.get(node.ObjectId);
  if(cached?.version===version)return cached.value;
  const value={t:new Vector3().fromArray(sampleNodeProperty(model,node,'Translation',frame,sequence,0)),
   r:new Quaternion().fromArray(sampleNodeProperty(model,node,'Rotation',frame,sequence,0)),
   s:new Vector3().fromArray(sampleNodeProperty(model,node,'Scaling',frame,sequence,0))};
  state.locals.set(node.ObjectId,{version,value});return value;
 }
 function touch(node){versions.set(node.ObjectId,(versions.get(node.ObjectId)||0)+1);}
 function fits(node,sequence,from,to){
  const {indices,ids,mesh:subset}=affected.get(node.ObjectId),budget=stats.sequences[sequence].budget,interval=model.Sequences[sequence].Interval;
  const check=frame=>{
   const state=frameState(sequence,frame),matrices=composeNodeMatrices(model,ids,n=>local(n,sequence,frame,state),byId),after=positions(subset,matrices);
   const limit=frame===interval[0]||frame===interval[1]?0:budget;
   return indices.every((i,v)=>Math.hypot(after[v*3]-state.before[i],after[v*3+1]-state.before[i+1],after[v*3+2]-state.before[i+2])<=limit);
  };
  if(!check(from)||!check(to))return false;
  if(!originalMoving[sequence]&&!hasMotion(model,sequence,skinIds))return true;
  for(let frame=Math.ceil(from);frame<to;frame++)if(frame>from&&!check(frame))return false;
  // Integer timestamps can still contain a visible cubic excursion in 1 ms.
  if(to-from<=1)for(const fraction of [.25,.5,.75])if(!check(from+(to-from)*fraction))return false;
  return true;
 }
 function reduce(node,property,sequence,guard,record=true){
  const track=node[property],interval=model.Sequences[sequence].Interval;
  let removed=0,changed=true;
  while(changed){
   changed=false;
   for(let i=1;i<track.Keys.length-1;){
    const a=track.Keys[i-1],key=track.Keys[i],b=track.Keys[i+1];
    if(a.Frame<interval[0]||b.Frame>interval[1]||key.Frame<=interval[0]||key.Frame>=interval[1]){i++;continue;}
    track.Keys.splice(i,1);touch(node);
    if(guard(track,a.Frame,b.Frame)&&fits(node,sequence,a.Frame,b.Frame)){
     removed++;changed=true;if(record)onChange(node,property,{sequence,frame:key.Frame,from:a.Frame,to:b.Frame});
    }else{track.Keys.splice(i,0,key);touch(node);i++;}
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
   const inside=keysIn(old,s.Interval);if(!inside.length)continue;
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
