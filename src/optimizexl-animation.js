import { sampleTrack } from './animation.js';

const same=(a,b)=>a?.length===b?.length&&Array.from(a||[]).every((v,i)=>v===b[i]);
const zero=a=>a&&Array.from(a).every(v=>v===0);
const error=(a,b,rotation)=>{
 if(!rotation)return Math.hypot(...a.map((v,i)=>v-b[i]));
 const dot=Math.abs(a.reduce((n,v,i)=>n+v*b[i],0)/(Math.hypot(...a)*Math.hypot(...b)||1));
 return 2*Math.acos(Math.min(1,dot))*180/Math.PI;
};
function constantSegment(t,a,b,rotation){
 if(!same(a.Vector,b.Vector))return false;
 if(t.LineType<2)return true;
 return rotation||t.LineType===3?same(a.OutTan,a.Vector)&&same(b.InTan,b.Vector):zero(a.OutTan)&&zero(b.InTan);
}

// A model-sized tolerance can exceed the entire motion of a small part.
// Bound loss against each component's own span in this animation as well.
// Turning poses get a tighter bound from their neighboring excursions, so a
// small blink/talking cycle cannot disappear beside a larger movement.
// This protects authored motion; deciding whether it is jitter belongs to the
// separately approved irregularity repairs, never to file-size reduction.
// A turn or scale change moves the part's farthest point by about reach times
// its error, so a long weapon chain gets a tighter limit than a short joint.
function motionBudgets(probes,rotation,worldLimit=Infinity){
 if(!probes.length)return;
 const values=probes.map(p=>rotation?[error(probes[0].value,p.value,true)]:p.value);
 const width=values[0].length,limits=[],roundoff=[];
 for(let axis=0;axis<width;axis++){
  let lo=Infinity,hi=-Infinity,magnitude=0;
  for(const v of values){lo=Math.min(lo,v[axis]);hi=Math.max(hi,v[axis]);magnitude=Math.max(magnitude,Math.abs(v[axis]));}
  limits.push(Math.min((hi-lo)*.1,worldLimit));
  roundoff.push(rotation?1e-5:Math.max(magnitude,hi-lo,Number.MIN_VALUE)*Number.EPSILON*32);
 }
 for(const p of probes){p.motionLimits=[...limits];p.roundoff=roundoff;}
 for(let axis=0;axis<width;axis++){
  const turns=[0],noise=Math.max(limits[axis]*1e-4,roundoff[axis]);let direction=0,extreme=0;
  for(let i=1;i<values.length;i++){
   const delta=values[i][axis]-values[extreme][axis];
   if(Math.abs(delta)<=noise)continue;
   const next=Math.sign(delta);
   if(direction&&next!==direction)turns.push(extreme);
   direction=next;extreme=i;
  }
  if(turns.at(-1)!==values.length-1)turns.push(values.length-1);
  for(let i=1;i<turns.length-1;i++){
   const index=turns[i],v=values[index][axis];
   const excursion=Math.min(Math.abs(v-values[turns[i-1]][axis]),Math.abs(v-values[turns[i+1]][axis]));
   probes[index].motionLimits[axis]=Math.min(limits[axis],excursion*.1);
  }
 }
}

function preserveMotion(track,original,probes,sample,rotation,worldLimit){
 motionBudgets(probes,rotation,worldLimit);
 // Excess over budget; above 1 means the probe needs an authored key back.
 const ratio=(e,p,axis)=>e?e/(p.motionLimits[axis]*.95+p.roundoff[axis]):0;
 const excess=p=>{
  const actual=sample(track,p.frame);
  if(rotation)return ratio(error(p.value,actual,true),p,0);
  return Math.max(...p.value.map((v,axis)=>ratio(Math.abs(v-actual[axis]),p,axis)));
 };
 const present=new Set(track.Keys.map(k=>k.Frame)),missing=original.filter(k=>!present.has(k.Frame));
 let over=probes.map(excess);
 // Return authored keys one at a time at the worst offending point, as a
 // tolerance-driven exporter reinserts keys, until every probe fits its
 // budget. Restoring a whole span brought back keys the motion did not need.
 // Keys the reducer retained stay; returned keys keep authored values and
 // controls, so a fully restored span is exactly the original curve.
 for(;;){
  let worst=-1;
  over.forEach((r,i)=>{if(r>1&&(worst<0||r>over[worst]))worst=i;});
  if(worst<0)break;
  const frame=probes[worst].frame;
  const before=track.Keys.findLast(k=>k.Frame<=frame)?.Frame??-Infinity,after=track.Keys.find(k=>k.Frame>frame)?.Frame??Infinity;
  let best=-1;
  missing.forEach((k,i)=>{if(k.Frame>before&&k.Frame<after&&(best<0||Math.abs(k.Frame-frame)<Math.abs(missing[best].Frame-frame)))best=i;});
  if(best<0){over[worst]=0;continue;}
  const [key]=missing.splice(best,1);
  track.Keys.push(key);track.Keys.sort((a,b)=>a.Frame-b.Frame);
  // Only the span around the returned key changed.
  probes.forEach((p,i)=>{if(p.frame>before&&p.frame<after)over[i]=excess(p);});
 }
}

/** Reduce within each sequence, retaining its first/last authored keys and
 * spline controls. Positive tolerances are checked against the original curve,
 * including the interior of every original segment, never just its key values.
 * `reach` is the farthest model distance this node moves; with a positive
 * `position` it limits turns and scaling to that distance at the far end. */
export function reduceAnimationTrack(model,track,property,tolerance,onRemove,{reach=0,position=0}={}){
 if(track.GlobalSeqId!=null&&track.GlobalSeqId!==-1&&track.GlobalSeqId!==0xffffffff)return 0;
 if(![0,1,2,3].includes(track.LineType)||track.Keys.some((k,i,a)=>!Number.isInteger(k.Frame)||i&&k.Frame<=a[i-1].Frame))return 0;
 const rotation=property==='Rotation',transform=['Translation','Rotation','Scaling'].includes(property),width=rotation?4:transform?3:track.Keys[0]?.Vector?.length;
 if(![1,3,4].includes(width))return 0;
 if(track.Keys.some(k=>k.Vector?.length!==width||Array.from(k.Vector).some(v=>!Number.isFinite(v))||track.LineType>=2&&['InTan','OutTan'].some(p=>k[p]?.length!==width||Array.from(k[p]).some(v=>!Number.isFinite(v)))))return 0;
 const worldLimit=property!=='Translation'&&transform&&reach>0&&position>0?position/reach*(rotation?180/Math.PI:1):Infinity;
 const baseline=structuredClone(track),fallback=rotation?[0,0,0,1]:property==='Scaling'?[1,1,1]:new Array(width).fill(0);
 // Non-unit quaternion interpolation differs between renderers. Exact constant
 // removal remains valid; approximate reduction requires normalized controls.
 const canApproximate=transform&&tolerance>0&&track.LineType!==0&&(!rotation||track.Keys.every(k=>['Vector',...(track.LineType>=2?['InTan','OutTan']:[])].every(p=>Math.abs(Math.hypot(...k[p])-1)<1e-5)));
 let removed=0;
 for(const [sequence,s]of model.Sequences.entries()){
  const [lo,hi]=s.Interval;
  if(model.Sequences.some((other,i)=>i!==sequence&&other.Interval[0]<=hi&&other.Interval[1]>=lo))continue;
  const original=baseline.Keys.filter(k=>k.Frame>=lo&&k.Frame<=hi);
  const options={interval:s.Interval,fallback,quaternion:rotation};
  const sample=(t,f)=>Array.from(sampleTrack(t,f,options));
  const probes=[];
  if(canApproximate)for(let i=0;i<original.length;i++){
   const start=original[i].Frame,end=original[i+1]?.Frame??start;
   for(let j=0;j<(end>start?32:1);j++){const frame=start+(end-start)*j/32;probes.push({frame,value:sample(baseline,frame)});}
  }
  const removals=[];
  for(let i=1;i<track.Keys.length-1;){
   const a=track.Keys[i-1],k=track.Keys[i],b=track.Keys[i+1];
   if(a.Frame<lo||b.Frame>hi||k.Frame<=lo||k.Frame>=hi){i++;continue;}
   const exact=track.LineType===0?same(a.Vector,k.Vector):constantSegment(track,a,k,rotation)&&constantSegment(track,k,b,rotation);
   if(!exact&&!canApproximate){i++;continue;}
   track.Keys.splice(i,1);
   const valid=exact||probes.every(p=>p.frame<a.Frame||p.frame>b.Frame||error(p.value,sample(track,p.frame),rotation)<=tolerance*.95);
   if(valid)removals.push({sequence,frame:k.Frame,from:a.Frame,to:b.Frame});
   else{track.Keys.splice(i,0,k);i++;}
  }
  if(removals.length&&canApproximate)preserveMotion(track,original,probes,sample,rotation,worldLimit);
  const kept=new Set(track.Keys.map(k=>k.Frame));
  for(const removal of removals)if(!kept.has(removal.frame)){removed++;onRemove(removal);}
 }
 return removed;
}
