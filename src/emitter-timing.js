import {sampleAnimationProperty,setAnimationKey} from './animation-tracks.js';

/** On/off parts of any emitter, and a ribbon's size keys, inside one animation. */
const FAMILIES=['ParticleEmitters2','RibbonEmitters','ParticleEmitters','ParticleEmitterPopcorns'];
const node=(model,id)=>{const found=FAMILIES.flatMap(family=>model[family]||[]).find(item=>item.ObjectId===id);if(!found)throw Error('The emitter was removed.');return found;};
const clipOf=(model,sequenceIndex)=>{const clip=model.Sequences[sequenceIndex];if(!clip)throw Error('Choose an animation first.');return Array.from(clip.Interval,Math.round);};
const globalTrack=track=>Number.isInteger(track?.GlobalSeqId)&&track.GlobalSeqId>=0;

/** Visible parts as [shows, hides] frame pairs. A part that lasts to the end hides at the last frame. */
export function emitterSpans(model,id,sequenceIndex){
 const ribbon=node(model,id),[start,end]=clipOf(model,sequenceIndex);
 if(globalTrack(ribbon.Visibility))return {start,end,spans:[],global:true};
 const target={kind:'node',id,property:'Visibility'},on=frame=>Number(sampleAnimationProperty(model,target,frame,sequenceIndex))>0;
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
export function setEmitterSpans(model,id,sequenceIndex,spans){
 const ribbon=node(model,id),[start,end]=clipOf(model,sequenceIndex),parts=normalizeSpans(spans,start,end);
 if(globalTrack(ribbon.Visibility))throw Error('This emitter uses a global sequence for visibility. Use Adjust Manually.');
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
 ribbon.Visibility={LineType:0,GlobalSeqId:null,Keys:[...keys].sort((a,b)=>a[0]-b[0]).map(([Frame,value])=>({Frame,Vector:new Float32Array([value])}))};
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

/** Frames inside this animation where the ribbon size is keyed. */
export function ribbonSizeKeys(model,id,sequenceIndex){
 const ribbon=node(model,id),[start,end]=clipOf(model,sequenceIndex);
 return [...new Set(['HeightAbove','HeightBelow'].flatMap(field=>globalTrack(ribbon[field])?[]:(ribbon[field]?.Keys||[]).map(key=>key.Frame)).filter(frame=>frame>=start&&frame<=end))].sort((a,b)=>a-b);
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
