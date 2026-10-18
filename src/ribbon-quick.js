import {fitRibbonToPolygons} from './particle-ribbon-fit.js';
import {placeTimedParticleRecipe} from './particle-placement.js';

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

