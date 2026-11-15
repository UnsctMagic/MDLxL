import {isGlobalTrack} from './animation.js';
import {sampleAnimationProperty,setAnimationKey} from './animation-tracks.js';

/** On/off parts of any emitter, light or attachment, and a ribbon's size keys, inside one animation. */
const FAMILIES=['ParticleEmitters2','RibbonEmitters','ParticleEmitters','ParticleEmitterPopcorns','Lights','Attachments'];
const node=(model,id)=>{const found=FAMILIES.flatMap(family=>model[family]||[]).find(item=>item.ObjectId===id);if(!found)throw Error('The emitter was removed.');return found;};
const clipOf=(model,sequenceIndex)=>{const clip=model.Sequences[sequenceIndex];if(!clip)throw Error('Choose an animation first.');return Array.from(clip.Interval,Math.round);};
// A timeline that shows a global sequence runs from 0 to its length; otherwise the animation's frames.
const ownGlobal=globalSeqId=>Number.isInteger(globalSeqId)&&globalSeqId>=0?globalSeqId:null;
const rangeOf=(model,sequenceIndex,globalSeqId)=>{
 const global=ownGlobal(globalSeqId);if(global===null)return clipOf(model,sequenceIndex);
 const length=model.GlobalSequences?.[global];if(!(length>0))throw Error('Choose an animation first.');return [0,Math.round(length)];
};
/** True when the object switches on and off with a Visibility track (emitters, ribbons, lights, attachments). */
export const hasVisibilityDiamonds=(model,id)=>FAMILIES.some(family=>(model[family]||[]).some(item=>item.ObjectId===id));

/** Visible parts as [shows, hides] frame pairs. A part that lasts to the end hides at the last frame. */
export function emitterSpans(model,id,sequenceIndex,globalSeqId=null){
 const ribbon=node(model,id),[start,end]=rangeOf(model,sequenceIndex,globalSeqId),global=ownGlobal(globalSeqId);
 // Visibility on another clock than the shown one is not edited here (EMTR: a global sequence never is).
 if(global===null?isGlobalTrack(ribbon.Visibility):ribbon.Visibility?.GlobalSeqId!==global||!ribbon.Visibility?.Keys)return {start,end,spans:[],global:true};
 const target={kind:'node',id,property:'Visibility'},on=frame=>Number(sampleAnimationProperty(model,target,frame,sequenceIndex,global))>0;
 const changes=[...new Set((ribbon.Visibility?.Keys||[]).map(key=>key.Frame).filter(frame=>frame>start&&frame<end))].sort((a,b)=>a-b);
 const spans=[];let open=on(start)?start:null;
 for(const frame of changes){const visible=on(frame);if(visible&&open===null)open=frame;else if(!visible&&open!==null){spans.push([open,frame]);open=null;}}
 if(open!==null)spans.push([open,end]);
 return {start,end,spans,global:false};
}

/** Clean, sorted, non-overlapping parts inside the animation. */
export function normalizeSpans(spans,start,end){
 const sorted=spans.map(([a,b])=>[Math.max(start,Math.min(end,Math.round(Math.min(a,b)))),Math.max(start,Math.min(end,Math.round(Math.max(a,b))))]).filter(([a,b])=>b>a).sort((x,y)=>x[0]-y[0]);
 const merged=[];for(const span of sorted){const last=merged.at(-1);if(last&&span[0]<=last[1])last[1]=Math.max(last[1],span[1]);else merged.push([...span]);}
 return merged;
}

/**
 * Rewrites only this animation's visibility keys: on at each part's first frame, off where it ends.
 * Other animations keep their keys. Visibility steps (no interpolation), as on/off should in game.
 */
export function setEmitterSpans(model,id,sequenceIndex,spans,globalSeqId=null){
 const ribbon=node(model,id),[start,end]=rangeOf(model,sequenceIndex,globalSeqId),parts=normalizeSpans(spans,start,end),global=ownGlobal(globalSeqId);
 if(global===null&&isGlobalTrack(ribbon.Visibility))throw Error('This emitter uses a global sequence for visibility. Use Adjust Manually.');
 if(global!==null&&(ribbon.Visibility?.GlobalSeqId!==global||!ribbon.Visibility?.Keys))throw Error('This object\'s visibility is not on this global sequence.');
 const keys=new Map();
 if(ribbon.Visibility?.Keys){for(const key of ribbon.Visibility.Keys)if(key.Frame<start||key.Frame>end)keys.set(key.Frame,key.Vector[0]>0?1:0);}
 else{
  // A plain value becomes keys at every other animation's ends, so those animations look the same.
  const value=typeof ribbon.Visibility==='number'?ribbon.Visibility:1;
  model.Sequences.forEach((clip,index)=>{if(index!==sequenceIndex)for(const frame of clip.Interval)if(frame<start||frame>end)keys.set(Math.round(frame),value>0?1:0);});
 }
 keys.set(start,parts[0]?.[0]===start?1:0);
 for(const [shows,hides]of parts){if(shows>start)keys.set(shows,1);if(hides<end)keys.set(hides,0);}
 keys.set(end,parts.at(-1)?.[1]===end?1:0);
 ribbon.Visibility={LineType:0,GlobalSeqId:global,Keys:[...keys].sort((a,b)=>a[0]-b[0]).map(([Frame,value])=>({Frame,Vector:new Float32Array([value])}))};
 return parts;
}

/** A new on/off part: the whole animation when there is none, else the middle of the widest hidden gap. */
export function addSpan(spans,start,end){
 if(!spans.length)return [[start,end]];
 const gaps=[];let from=start;for(const [a,b]of spans){if(a>from)gaps.push([from,a]);from=b;}if(end>from)gaps.push([from,end]);
 const gap=gaps.sort((x,y)=>(y[1]-y[0])-(x[1]-x[0]))[0];
 if(!gap||gap[1]-gap[0]<4)throw Error('There is no hidden time left for another part. Shorten a part first.');
 const third=Math.max(1,Math.round((gap[1]-gap[0])/3));
 return normalizeSpans([...spans,[gap[0]+third,gap[1]-third]],start,end);
}

/** Event and sound frames shown on this timeline. Events on a global sequence belong to that sequence only. */
const eventNode=(model,id)=>{const found=(model.EventObjects||[]).find(item=>item.ObjectId===id);if(!found)throw Error('The event was removed.');return found;};
export const hasEventDiamonds=(model,id)=>(model.EventObjects||[]).some(item=>item.ObjectId===id);
export function eventDiamonds(model,id,sequenceIndex,globalSeqId=null){
 const event=eventNode(model,id),[start,end]=rangeOf(model,sequenceIndex,globalSeqId);
 if(ownGlobal(event.GlobalSeqId)!==ownGlobal(globalSeqId))return {start,end,frames:[],global:true};
 return {start,end,frames:Array.from(event.EventTrack||[]).filter(frame=>frame>=start&&frame<=end).sort((a,b)=>a-b),global:false};
}
/** Rewrites only this timeline's event frames; frames in other animations stay. */
export function setEventDiamonds(model,id,sequenceIndex,frames,globalSeqId=null){
 const event=eventNode(model,id),[start,end]=rangeOf(model,sequenceIndex,globalSeqId);
 if(ownGlobal(event.GlobalSeqId)!==ownGlobal(globalSeqId))throw Error('This event plays on another clock.');
 const kept=Array.from(event.EventTrack||[]).filter(frame=>frame<start||frame>end),own=frames.map(frame=>Math.max(start,Math.min(end,Math.round(frame))));
 event.EventTrack=new Uint32Array([...new Set([...kept,...own])].sort((a,b)=>a-b));
 return own;
}
/** One more event frame at the playhead. */
export function addEventFrame(frames,frame,start,end){
 const at=Math.max(start,Math.min(end,Math.round(frame)));
 if(frames.includes(at))throw Error('There is already a diamond at frame '+at+'. Move the playhead first.');
 return [...frames,at].sort((a,b)=>a-b);
}

/** The clicked object's diamonds on this timeline, or null (nothing, bones, another clock, no animation). */
export function timelineDiamonds(model, selectedNodeIds, domain) {
  const id = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;
  const sequence = domain?.sequenceIndex ?? -1, global = Number.isInteger(domain?.globalSeqId) ? domain.globalSeqId : null;
  if (id == null || !domain || sequence < 0 && global === null) return null;
  try {
    if (hasVisibilityDiamonds(model, id)) {
      const timing = emitterSpans(model, id, sequence, global);
      return timing.global ? null : { id, sequence, global, kind: 'spans', start: timing.start, end: timing.end, groups: timing.spans };
    }
    if (hasEventDiamonds(model, id)) {
      const timing = eventDiamonds(model, id, sequence, global);
      return timing.global ? null : { id, sequence, global, kind: 'events', start: timing.start, end: timing.end, groups: timing.frames.map(frame => [frame]) };
    }
  } catch { return null; }
  return null;
}

/** Frames inside this animation where the ribbon size is keyed. */
export function ribbonSizeKeys(model,id,sequenceIndex){
 const ribbon=node(model,id),[start,end]=clipOf(model,sequenceIndex);
 return [...new Set(['HeightAbove','HeightBelow'].flatMap(field=>isGlobalTrack(ribbon[field])?[]:(ribbon[field]?.Keys||[]).map(key=>key.Frame)).filter(frame=>frame>=start&&frame<=end))].sort((a,b)=>a-b);
}

/** Ribbon ends at a frame, read the way the game interpolates them. */
export function ribbonSizeAt(model,id,frame,sequenceIndex){
 const sample=property=>Number(sampleAnimationProperty(model,{kind:'node',id,property},frame,sequenceIndex));
 return {above:sample('HeightAbove'),below:sample('HeightBelow')};
}

/** Writes a size key (both ends) at this frame; the ribbon grows or shrinks smoothly between keys. */
export function setRibbonSizeKey(model,id,frame,sequenceIndex,{above,below}){
 node(model,id);const [start,end]=clipOf(model,sequenceIndex);
 if(frame<start||frame>end)throw Error('The size key must be inside this animation.');
 for(const [property,value]of [['HeightAbove',above],['HeightBelow',below]]){
  if(!Number.isFinite(value)||value<0)throw Error('Ribbon size values must be 0 or more.');
  setAnimationKey(model,[{kind:'node',id,property}],Math.round(frame),value,sequenceIndex);
 }
}

/** Removes the size key at this frame; the last key turns back into a plain size. */
export function removeRibbonSizeKey(model,id,frame,sequenceIndex){
 const ribbon=node(model,id),size=ribbonSizeAt(model,id,frame,sequenceIndex);
 for(const field of ['HeightAbove','HeightBelow']){
  const track=ribbon[field];if(!track?.Keys)continue;
  const keys=track.Keys.filter(key=>key.Frame!==frame);
  ribbon[field]=keys.length?{...track,Keys:keys}:field==='HeightAbove'?size.above:size.below;
 }
}
