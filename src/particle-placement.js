import {placeParticleRecipe} from './particle-recipes.js';
import {canonicalizeSerializedNodeOrder} from './node-id-order.js';
import {sampleNodeMatrices,visitTracks,isGlobalTrack} from './animation.js';
import {particleVertexSelection} from './particle-selection.js';
import {Matrix4,Vector3} from 'three';

export function initialParticlePlacement(model,selection,nodeId,sequenceIndex){
 const selected=particleVertexSelection(model,selection),node=model.Nodes[nodeId];
 const sequence=model.Sequences[sequenceIndex]?sequenceIndex:0,parent=selected.points.length?selected.parent:node?.ObjectId;
 return {parent:parent==null?'':String(parent),position:selected.points.length?selected.center:Array.from(node?.PivotPoint||[0,0,0]),sequence,sequences:model.Sequences.length?[sequence]:[],fit:true,motion:'target'};
}

/** A chosen visibility window belongs to the newly inserted effect only. */
export function particlePlacementInterval(model,placement,{preview=false}={}) {
 if(!model.Sequences.length)return null;
 const clip=model.Sequences[placement.sequence];if(!clip)throw Error('Choose an animation.');
 const [start,end]=clip.Interval,from=Number(placement.from),to=Number(placement.to);
 if(placement.from===''||!Number.isInteger(from)||from<start||from>=end)throw Error('Choose a start inside this animation.');
 if(placement.to===''||placement.to==null){if(preview)return [from,end];throw Error('Choose when the effect ends.');}
 if(!Number.isInteger(to)||to<=from||to>end)throw Error('Choose an end after the start, inside this animation.');
 return [from,to];
}

export function placeTimedParticleRecipe(model,recipe,placement,{preview=false,convertHD=false}={}) {
 const wholeAnimations=Array.isArray(placement.sequences);
 const window=placement.ribbon||wholeAnimations?model.Sequences[placement.sequence]?.Interval:particlePlacementInterval(model,placement,{preview});
 const sourceInterval=Array.from(recipe.native.Sequences[recipe.defaultSequence||0]?.Interval||[0,5000]);
 const prior={materials:model.Materials.length,textureAnims:model.TextureAnims.length};
 const result=placeParticleRecipe(model,recipe,{parent:placement.parent===''?null:Number(placement.parent),position:placement.position,sourceInterval,targetInterval:window||sourceInterval,fit:placement.fit,motion:placement.motion,directAttachment:!!placement.ribbon,convertHD});
 if(wholeAnimations&&!placement.ribbon){
  // Position names the visible emitter, not the zero-pivot wrapper. Keep the
  // source graph's relative offsets while anchoring its first ingredient.
  const matrices=sampleNodeMatrices(model,window?.[0]||0,model.Sequences.length?placement.sequence:-1),anchor=model.Nodes[result.anchorId],emitter=model.Nodes[result.ids[0]],parent=matrices.get(anchor.Parent)||new Matrix4();
  // Gallery captions may contain translated punctuation; this is a native node.
  anchor.Name=emitter.Name;
  if(Math.abs(parent.determinant())<1e-10)throw Error('The selected bone has a zero scale. Choose another bone or animation.');
  const local=new Vector3().fromArray(emitter.PivotPoint).applyMatrix4(matrices.get(emitter.ObjectId)||new Matrix4()).applyMatrix4(parent.clone().invert());
  const delta=new Vector3(...placement.position).sub(local);
  const anchorPosition=placement.position.map((value,axis)=>window?value+delta.getComponent(axis):value-local.getComponent(axis));
  const anchorFrames=model.Sequences.length?[...new Set(model.Sequences.flatMap(clip=>Array.from(clip.Interval)))].sort((a,b)=>a-b):[0];
  anchor.Translation={LineType:0,GlobalSeqId:null,Keys:anchorFrames.map(Frame=>({Frame,Vector:new Float32Array(anchorPosition)}))};
  // Fit the source's local tracks to every checked clip, without touching any
  // reused target resources or global loops.
  const imported={nodes:[...result.maps.nodes.values()].map(id=>model.Nodes[id]),materials:model.Materials.slice(prior.materials),textureAnims:model.TextureAnims.slice(prior.textureAnims)};
  if(window)visitTracks(imported,track=>{
   if(isGlobalTrack(track))return;
   const keys=track.Keys.filter(key=>key.Frame>=window[0]&&key.Frame<=window[1]);
   track.Keys=placement.sequences.flatMap(index=>{const clip=model.Sequences[index];if(!clip)throw Error('Choose an existing animation.');const [start,end]=clip.Interval;return keys.map(key=>({...structuredClone(key),Frame:Math.round(start+(key.Frame-window[0])*(end-start)/(window[1]-window[0]))}));}).sort((a,b)=>a.Frame-b.Frame);
  });
 }
 if(placement.ribbon||wholeAnimations){
  const selected=new Set(placement.sequences),visibility=new Map(),boundaries=new Set();
  for(let i=0;i<model.Sequences.length;i++)for(const frame of model.Sequences[i].Interval){visibility.set(frame,selected.has(i)?1:0);boundaries.add(frame);}
  for(const id of result.ids){
   const node=model.Nodes[id];
   node.Visibility=visibility.size?{LineType:0,GlobalSeqId:null,Keys:[...visibility].sort((a,b)=>a[0]-b[0]).map(([Frame,value])=>({Frame,Vector:new Float32Array([value])}))}:1;
   // The fitted edge is constant in the weapon's space in every animation.
   const rotation=placement.ribbon&&node.Rotation?.Keys?.[0]?.Vector;
   if(rotation&&boundaries.size)node.Rotation={LineType:0,GlobalSeqId:null,Keys:[...boundaries].sort((a,b)=>a-b).map(Frame=>({Frame,Vector:new Float32Array(rotation)}))};
  }
 }else if(window){
  const values=new Map();
  for(const clip of model.Sequences)for(const boundary of clip.Interval)if(boundary<window[0]||boundary>window[1])values.set(boundary,0);
  values.set(window[0],1);values.set(window[1],0);
  for(const id of result.ids)model.Nodes[id].Visibility={LineType:0,GlobalSeqId:null,Keys:[...values].sort((a,b)=>a[0]-b[0]).map(([Frame,value])=>({Frame,Vector:new Float32Array([value])}))};
 }
 if(placement.ribbon){
  // Keep pivots and every node reference aligned with the MDL/MDX section order.
  // External editors resolve these indices before all nodes are indexed.
  const order=canonicalizeSerializedNodeOrder(model);
  result.ids=result.ids.map(id=>order.get(id));
  for(const [oldId,id]of result.maps.nodes)result.maps.nodes.set(oldId,order.get(id));
 }
 return {...result,interval:window||sourceInterval};
}
