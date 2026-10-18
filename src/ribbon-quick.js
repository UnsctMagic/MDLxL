import {fitRibbonToPolygons} from './particle-ribbon-fit.js';
import {placeTimedParticleRecipe} from './particle-placement.js';
import {sampleAnimationProperty,setAnimationKey} from './animation-tracks.js';

/** Sections an added ribbon touches; one undo step restores the model. */
export const RIBBON_ADD_SECTIONS=['Nodes','Textures','Materials','TextureAnims','GlobalSequences','PivotPoints'];

/** Recipe for a ribbon along the marked polygons, visible in one animation. */
export function ribbonPlacement(model,selection,sequence){
 const ribbon=fitRibbonToPolygons(model,selection),index=model.Sequences[sequence]?sequence:0;
 return {ribbon,position:[0,0,0],motion:'target',fit:true,sequence:index,sequences:model.Sequences.length?[index]:[],parent:ribbon.parent==null?'':String(ribbon.parent)};
}

export function addRibbon(model,recipe,placement){
 const result=placeTimedParticleRecipe(model,recipe,placement,{convertHD:true});
 return {id:result.ids[0],interval:result.interval,convertedHD:result.convertedHD};
}

const peak=value=>typeof value==='number'?value:value?.Keys?.length?Math.max(...value.Keys.map(key=>key.Vector[0])):0;
const keyed=value=>!!value?.Keys;
const mapKeys=(track,map)=>({...track,Keys:track.Keys.map(key=>({...key,Vector:new Float32Array(map(Array.from(key.Vector))),...(key.InTan?{InTan:new Float32Array(map(Array.from(key.InTan),true))}:{}),...(key.OutTan?{OutTan:new Float32Array(map(Array.from(key.OutTan),true))}:{})}))});

/** The few values the Ribbon box shows. Animated tracks show their strongest key. */
export function ribbonQuickValues(node){
 const color=keyed(node.Color)?node.Color.Keys[0]?.Vector:node.Color;
 const above=peak(node.HeightAbove),below=peak(node.HeightBelow);
 return {color:Array.from(color||[1,1,1]),intensity:keyed(node.Alpha)?peak(node.Alpha):node.Alpha??1,lasts:node.LifeSpan??1,size:above+below,above,below,amount:peak(node.EmissionRate),gravity:node.Gravity??0};
}

/** Whole-track edits: an animated value keeps its shape and is scaled or shifted as one. */
export function setRibbonQuick(model,id,change){
 const node=model.RibbonEmitters.find(item=>item.ObjectId===id);
 if(!node)throw Error('The ribbon was removed.');
 const now=ribbonQuickValues(node),finite=value=>{if(!Number.isFinite(value))throw Error('Enter a number.');return value;};
 const scale=(field,value,old)=>{
  value=Math.max(0,finite(value));
  if(keyed(node[field])){const factor=old>0?value/old:0;node[field]=mapKeys(node[field],(v,tangent)=>v.map(n=>old>0?n*factor:tangent?0:value));}
  else node[field]=value;
 };
 const shift=(field,value,old)=>{
  value=Math.max(0,finite(value));
  if(keyed(node[field]))node[field]=mapKeys(node[field],(v,tangent)=>tangent?v:v.map(n=>Math.max(0,n+value-old)));
  else node[field]=value;
 };
 if(change.color){
  const rgb=Array.from(change.color,n=>Math.min(1,Math.max(0,finite(n))));
  node.Color=keyed(node.Color)?mapKeys(node.Color,(v,tangent)=>tangent?v.map(()=>0):rgb):new Float32Array(rgb);
 }
 if(change.intensity!=null)scale('Alpha',Math.min(1,change.intensity),now.intensity);
 if(change.lasts!=null)node.LifeSpan=Math.max(.01,finite(change.lasts));
 if(change.gravity!=null)node.Gravity=finite(change.gravity);
 if(change.amount!=null)scale('EmissionRate',change.amount,now.amount);
 if(change.size!=null){
  const size=Math.max(.01,finite(change.size)),total=now.above+now.below;
  // Grow or shrink around the same split, so the strip stays on the blade.
  scale('HeightAbove',total>0?size*now.above/total:size/2,now.above);
  scale('HeightBelow',total>0?size*now.below/total:size/2,now.below);
 }
 if(change.above!=null)shift('HeightAbove',change.above,now.above);
 if(change.below!=null)shift('HeightBelow',change.below,now.below);
 if(change.move){
  // Moves the whole strip: the pivot is in the weapon's rest space, so every animation follows.
  const pivot=Array.from(node.PivotPoint||model.PivotPoints?.[id]||[0,0,0]).map((v,i)=>v+finite(change.move[i]));
  node.PivotPoint=new Float32Array(pivot);if(model.PivotPoints)model.PivotPoints[id]=new Float32Array(pivot);
 }
 return node;
}

/** Where an edit lands: an animation frame, or the static value when nothing is chosen. */
export function ribbonEditFrame(model,{time=0,sequenceIndex=-1,globalSeqId=null,restPose=false}={}){
 const frame=Math.round(time),global=!restPose&&Number.isInteger(globalSeqId)&&globalSeqId>=0?globalSeqId:null;
 const sequence=restPose||global!==null?-1:sequenceIndex>=0?sequenceIndex:model.Sequences.findIndex(item=>frame>=item.Interval[0]&&frame<=item.Interval[1]);
 return {frame,sequenceIndex:sequence,globalSeqId:global,animated:!restPose&&(sequence>=0||global!==null)};
}

export const ribbonSizeKeyed=node=>!!(node?.HeightAbove?.Keys||node?.HeightBelow?.Keys);

/** Box values at this frame: a keyed size shows the size the ribbon has right now. */
export function ribbonFrameValues(model,id,at){
 const node=model.RibbonEmitters.find(item=>item.ObjectId===id);if(!node)return null;
 const values=ribbonQuickValues(node);
 if(ribbonSizeKeyed(node)&&at.animated){
  const sample=property=>Number(sampleAnimationProperty(model,{kind:'node',id,property},at.frame,at.sequenceIndex,at.globalSeqId));
  values.above=sample('HeightAbove');values.below=sample('HeightBelow');values.size=values.above+values.below;
 }
 return {...values,sizeKeyed:ribbonSizeKeyed(node)};
}

/** Size edits write keys at this frame once size is keyed; everything else edits the whole value. */
export function applyRibbonEdit(model,id,change,at){
 const node=model.RibbonEmitters.find(item=>item.ObjectId===id);
 if(!node)throw Error('The ribbon was removed.');
 const sizing=change.size!=null||change.above!=null||change.below!=null||change.sizeKey;
 if(!sizing||!(change.sizeKey||ribbonSizeKeyed(node)))return setRibbonQuick(model,id,change);
 if(!at.animated)throw Error('Choose an animation to set a size key.');
 const now=ribbonFrameValues(model,id,at),finite=value=>{if(!Number.isFinite(value))throw Error('Enter a number.');return Math.max(0,value);};
 let above=now.above,below=now.below;
 if(change.size!=null){const size=Math.max(.01,finite(change.size)),total=above+below;above=total>0?size*above/total:size/2;below=total>0?size*below/total:size/2;}
 if(change.above!=null)above=finite(change.above);
 if(change.below!=null)below=finite(change.below);
 setAnimationKey(model,[{kind:'node',id,property:'HeightAbove'}],at.frame,above,at.sequenceIndex,at.globalSeqId);
 setAnimationKey(model,[{kind:'node',id,property:'HeightBelow'}],at.frame,below,at.sequenceIndex,at.globalSeqId);
 const {size,above:_a,below:_b,sizeKey,...rest}=change;
 if(Object.keys(rest).length)setRibbonQuick(model,id,rest);
 return model.RibbonEmitters.find(item=>item.ObjectId===id);
}
