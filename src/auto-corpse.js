import { sequenceWords, isDeathSequence, isDecaySequence, isDissipateSequence } from './sequence-editor.js';
import { allNodes, isGlobalTrack, sampleNodeMatrices, sampleTrack, sampleGeosetAnimation, skinGeoset, skinGeosetNormals } from './animation.js';
import { createRigNode } from './bone-tools.js';
import { deleteGeoset } from './editor-document.js';
import { createVisibilityGeosetAnimation, ensureGeosetAnimation } from './geoset-animation-defaults.js';
import { updateBounds } from './mesh-tools.js';
import { buildCorpseGeometry } from './corpse-geometry.js';
import { applyDeathBlood } from './corpse-blood.js';

const PREFIX='MDLxL Corpse ', FLESH='MDLxL Flesh ';
export const AUTO_CORPSE_SECTIONS=['Sequences','GlobalSequences','Geosets','GeosetAnims','Materials','Textures','TextureAnims','Bones','PivotPoints','BindPoses','Nodes','Attachments','ParticleEmitters','ParticleEmitters2','ParticleEmitterPopcorns','RibbonEmitters','Lights','EventObjects'];
const vector=v=>new Float32Array(typeof v==='number'?[v]:v);
// Some native sequences retain an unsigned wrapped negative start. Keep that
// source metadata, but never emit an invalid signed animation key from it.
const track=(pairs,line=0)=>({LineType:line,GlobalSeqId:null,Keys:[...new Map(pairs.filter(([f])=>Number.isInteger(f)&&f>=-0x80000000&&f<=0x7fffffff).map(([Frame,v])=>[Frame,{Frame,Vector:vector(v)}])).values()].sort((a,b)=>a.Frame-b.Frame)});
const global=property=>property?.Keys&&isGlobalTrack(property);
const generated=n=>n?.Name?.startsWith(PREFIX)||n?.Name?.startsWith(FLESH);
const suffix=name=>name.trim().toLowerCase().split(/\s+/).filter(t=>!['death','decay','flesh','bone','bones'].includes(t)).join(' ');
const sample=(model,value,frame,index,fallback)=>sampleTrack(value,frame,{interval:model.Sequences[index].Interval,globalSequences:model.GlobalSequences,globalTime:frame,fallback});
const textureNames=(model,g)=>model.Materials[g.MaterialID]?.Layers.flatMap(l=>{
  const ids=typeof l.TextureID==='number'?[l.TextureID]:l.TextureID?.Keys?.map(k=>k.Vector[0])||[];
  return ids.map(id=>model.Textures[id]?.Image||'');
})||[];
const glow=(model,g)=>model.Materials[g.MaterialID]?.Layers.every(l=>model.Textures[l.TextureID]?.ReplaceableId===2||l.FilterMode>=3);
const bodyVisible=(model,id,frame,index)=>sampleGeosetAnimation(model,id,frame,index).alpha>.01&&model.Materials[model.Geosets[id].MaterialID]?.Layers.some(l=>sample(model,l.Alpha,frame,index,1)>.01);
const corpseTexture=(model,g)=>textureNames(model,g).some(name=>/(?:^|[\\/])(?:gutz|guts|[^\\/]*corpse[^\\/]*)\.(?:blp|dds|tga)$/i.test(name));
const key=(frame,value,line)=>({Frame:frame,Vector:vector(value),...(line>=2?{InTan:vector(line===2?Array(vector(value).length).fill(0):value),OutTan:vector(line===2?Array(vector(value).length).fill(0):value)}:{})});

/** Replace only specified local intervals. Original interpolation, tangents,
 * globals and keys outside the decay clips are never resampled. */
function localMask(value,sequences,intervals,fallback=1) {
  if(value===0)return 0;
  if(global(value)) throw Error('This model has global visibility on both its body and material. Make one visibility channel local before using Auto Corpse.');
  const result=value?.Keys?structuredClone(value):track(sequences.map(s=>[s.Interval[0],value??fallback]));
  result.Keys=result.Keys.filter(k=>!intervals.some(([a,b])=>k.Frame>=a&&k.Frame<=b));
  for(const [a,b] of intervals) result.Keys.push(key(a,0,result.LineType),key(b,0,result.LineType));
  result.Keys=[...new Map(result.Keys.map(k=>[k.Frame,k])).values()].sort((a,b)=>a.Frame-b.Frame);
  return result;
}

function visibility(model,id) {
  return ensureGeosetAnimation(model,id,{refuseDuplicates:'A body geoset has duplicate visibility records. Resolve them before using Auto Corpse.'});
}
function material(model,value) {
  const signature=JSON.stringify(value),existing=model.Materials.findIndex(m=>JSON.stringify(m)===signature);
  if(existing>=0)return existing;
  model.Materials.push(value);return model.Materials.length-1;
}
function ensureSequence(model,name,death,kind) {
  const found=model.Sequences.findIndex(s=>isDecaySequence(s)&&suffix(s.Name)===suffix(death.Name)&&(kind==='flesh'?/\bflesh\b/i:/\bbones?\b/i).test(s.Name));
  if(found>=0){model.Sequences[found].NonLooping=true;return found;}
  // Native critters often use just "Decay". Reuse its interval as the flesh
  // clip instead of leaving an empty third decay animation behind.
  if(kind==='flesh') {
    const generic=model.Sequences.findIndex(s=>isDecaySequence(s)&&suffix(s.Name)===suffix(death.Name)&&! /\b(?:flesh|bones?)\b/i.test(s.Name));
    if(generic>=0){model.Sequences[generic].Name=name;model.Sequences[generic].NonLooping=true;return generic;}
  }
  const start=Math.max(0,...model.Sequences.map(s=>s.Interval[1]))+1000,end=start+60000;
  if(end>0x7fffffff)throw Error('There is no room for another decay animation in the model timeline.');
  model.Sequences.push({...structuredClone(death),Name:name,Interval:new Uint32Array([start,end]),NonLooping:true,MoveSpeed:0,Rarity:0});
  return model.Sequences.length-1;
}
function root(model,name) {
  let node=model.Bones.find(n=>n.Name===name);
  if(!node){node=createRigNode(model,'Bone');node.Name=name;}
  return node;
}
function bind(g,node) {
  g.Groups=[[node.ObjectId]];g.VertexGroup=new Uint8Array(g.Vertices.length/3);g.TotalGroupsCount=1;
  if(g.SkinWeights?.length){if(node.ObjectId>255)throw Error('The HD bone palette has no free slot for the corpse.');g.SkinWeights=new Uint8Array(g.Vertices.length/3*8);for(let i=0;i<g.Vertices.length/3;i++){g.SkinWeights[i*8]=node.ObjectId;g.SkinWeights[i*8+4]=255;}}
}
function addGeoset(model,g,alpha,color=[1,1,1]) {
  const id=model.Geosets.length;model.Geosets.push(g);
  model.GeosetAnims.push({...createVisibilityGeosetAnimation(id),Alpha:alpha,Color:vector(color),Flags:color.some(v=>v!==1)?2:0,_MdxDefaults:{Alpha:0}});
  return id;
}
function sequenceVisibility(model,values) {
  return track(model.Sequences.flatMap((s,i)=>values.get(i)||[[s.Interval[0],0],[s.Interval[1],0]]));
}
function extent(vertices) {const g={Vertices:vertices};updateBounds(g);return {MinimumExtent:g.MinimumExtent,MaximumExtent:g.MaximumExtent,BoundsRadius:g.BoundsRadius};}
function decayExtents(model,pair,ids) {
  for(const index of [pair.flesh,pair.bone]) {
    const seq=model.Sequences[index],cloud=[];
    for(const t of [seq.Interval[0],seq.Interval[1]]) {
      const matrices=sampleNodeMatrices(model,t,index);
      for(const id of ids) for(const value of skinGeoset(model.Geosets[id],matrices))cloud.push(value);
    }
    Object.assign(seq,extent(new Float32Array(cloud)));
  }
}

/** Runs inside EditorDocument.apply: a failure rolls back the complete command.
 * Frozen decay meshes avoid rewriting the authored rig, global motion, Death
 * curves, living animations or skin bindings. Original meshes are only masked
 * during decay. A second click replaces this command's meshes and reuses bones.
 * Options from the Auto Corpse window: size, height, color ([r,g,b], 0-1) and
 * pieces (the first Death's edited piece list); blood replaces the first
 * Death's blood splats and spray (see corpse-blood.js). */
export function autoCorpse(model, options={}) {
  const deaths=model.Sequences.map((s,i)=>({s,i})).filter(({s})=>isDeathSequence(s));
  if(!deaths.length)throw Error('Auto Corpse needs a Death animation.');
  const originals=allNodes(model).filter(n=>!generated(n)),generatedIds=new Set(allNodes(model).filter(generated).map(n=>n.ObjectId));
  for(let i=model.Geosets.length-1;i>=0;i--)if(model.Geosets[i].Groups?.length&&model.Geosets[i].Groups.every(g=>g.length&&g.every(id=>generatedIds.has(id))))deleteGeoset(model,i);
  const originalGeosetCount=model.Geosets.length;
  const oldCorpses=new Set(model.Geosets.map((g,i)=>corpseTexture(model,g)?i:-1).filter(i=>i>=0));
  const nonDecay=model.Sequences.map((s,i)=>({s,i})).filter(({s})=>!isDecaySequence(s)&&!isDeathSequence(s)&&!isDissipateSequence(s));
  // Custom corpse textures are recognized by their actual visibility, not a
  // fuzzy texture-name match that would mistake living skeletons for corpses.
  for(let i=0;i<model.Geosets.length;i++)if(!glow(model,model.Geosets[i])&&nonDecay.length&&nonDecay.every(({s,i:si})=>sampleGeosetAnimation(model,i,s.Interval[0],si).alpha<.01)&&deaths.every(({s,i:si})=>sampleGeosetAnimation(model,i,s.Interval[1],si).alpha<.01)&&model.Sequences.some((s,si)=>isDecaySequence(s)&&/^bones?$/.test(sequenceWords(s.Name)[1])&&sampleGeosetAnimation(model,i,s.Interval[0],si).alpha>.5))oldCorpses.add(i);
  // Plan all terminal poses before masking the source visibility.
  const plans=deaths.map(({s,i},n)=>{
    const frame=s.Interval[1],eligible=model.Geosets.map((g,id)=>({g,id})).filter(({g,id})=>!oldCorpses.has(id)&&!glow(model,g)&&g.Faces?.length);
    let body=eligible.filter(({id})=>bodyVisible(model,id,frame,i));
    if(!body.length) body=eligible.filter(({id})=>[0,.5,.99].some(t=>bodyVisible(model,id,s.Interval[0]+(frame-s.Interval[0])*t,i)));
    if(!body.length)throw Error('Death has no body geometry to place a corpse beneath.');
    const geometry=buildCorpseGeometry(model,body.map(x=>x.id),i,{...options,pieces:n===0?options.pieces:null}),matrices=sampleNodeMatrices(model,frame,i);
    const frozen=body.map(({g,id})=>{
      const copy=structuredClone(g);copy.Vertices=skinGeoset(g,matrices);copy.Normals=skinGeosetNormals(g,matrices);delete copy.Tangents;
      updateBounds(copy);
      const appearance=sampleGeosetAnimation(model,id,frame,i),mat=structuredClone(model.Materials[g.MaterialID]);
      for(const layer of mat.Layers) {
        layer.Alpha=sample(model,layer.Alpha,frame,i,1);
        for(const property of ['TextureID','EmissiveGain','FresnelOpacity','FresnelTeamColor'])if(layer[property]?.Keys)layer[property]=sample(model,layer[property],frame,i,property==='TextureID'?0:1);
        if(layer.FresnelColor?.Keys)layer.FresnelColor=vector(sample(model,layer.FresnelColor,frame,i,[1,1,1]));
        // Keep the renderer's existing UV transform owner and per-layer UV
        // sets; a detached constant animation freezes global texture drift.
        if(layer.TVertexAnimId!=null&&layer.TVertexAnimId>=0) {
          const animation=model.TextureAnims[layer.TVertexAnimId];
          if(animation){const frozen={};for(const [property,fallback] of Object.entries({Translation:[0,0,0],Scaling:[1,1,1],Rotation:[0,0,0,1]}))if(animation[property])frozen[property]=track([[0,sampleTrack(animation[property],frame,{interval:model.Sequences[i].Interval,globalSequences:model.GlobalSequences,globalTime:frame,fallback,quaternion:property==='Rotation'})]]);
            // A constant global of duration 1 holds this value in every clip.
            let globalId=model.GlobalSequences.indexOf(1);if(globalId<0){globalId=model.GlobalSequences.length;model.GlobalSequences.push(1);}for(const t of Object.values(frozen))t.GlobalSeqId=globalId;
            let id=model.TextureAnims.findIndex(t=>JSON.stringify(t)===JSON.stringify(frozen));if(id<0){id=model.TextureAnims.length;model.TextureAnims.push(frozen);}layer.TVertexAnimId=id;
          }
        }
      }
      return {g:copy,mat,alpha:appearance.alpha||1,color:appearance.color};
    });
    return {death:i,deathName:s.Name,geometry,frozen};
  });
  const pairs=plans.map(plan=>{const death=model.Sequences[plan.death],tail=suffix(death.Name),label=tail?' '+death.Name.trim().split(/\s+/).filter(t=>!/^death$/i.test(t)).join(' '):'';return {...plan,flesh:ensureSequence(model,'Decay Flesh'+label,death,'flesh'),bone:ensureSequence(model,'Decay Bone'+label,death,'bone')};});
  const intervals=pairs.flatMap(p=>[p.flesh,p.bone]).map(i=>Array.from(model.Sequences[i].Interval));
  for(let id=0;id<originalGeosetCount;id++) {
    const anim=visibility(model,id);
    if(oldCorpses.has(id)){anim.Alpha=0;continue;}
    if(global(anim.Alpha)) {
      const g=model.Geosets[id],mat=structuredClone(model.Materials[g.MaterialID]);
      for(const layer of mat.Layers)layer.Alpha=localMask(layer.Alpha,model.Sequences,intervals);
      g.MaterialID=material(model,mat);
    } else anim.Alpha=localMask(anim.Alpha,model.Sequences,intervals);
  }
  for(const key of ['Attachments','ParticleEmitters','ParticleEmitters2','ParticleEmitterPopcorns','RibbonEmitters','Lights'])for(const node of model[key]||[]) {
    if(global(node.Visibility))throw Error('An effect has global visibility. Make its visibility local before using Auto Corpse.');
    node.Visibility=localMask(node.Visibility,model.Sequences,intervals);
  }
  for(const event of model.EventObjects||[])if(event.EventTrack)event.EventTrack=new Uint32Array(Array.from(event.EventTrack).filter(t=>!intervals.some(([a,b])=>t>=a&&t<=b)));
  let texture=model.Textures.findIndex(t=>/^textures[\\/]gutz\.blp$/i.test(t.Image));
  if(texture<0){texture=model.Textures.length;model.Textures.push({Image:'Textures\\gutz.blp',ReplaceableId:0,Flags:0});}
  const corpseMaterial=material(model,{PriorityPlane:0,RenderMode:0,Layers:[{FilterMode:1,Shading:16,TextureID:texture,TVertexAnimId:null,CoordId:0,Alpha:1}]});
  const results=[];
  for(const [number,pair] of pairs.entries()) {
    const corpse=root(model,PREFIX+number),flesh=root(model,FLESH+number),fs=model.Sequences[pair.flesh],bs=model.Sequences[pair.bone];
    const sink=Math.max(pair.geometry.bodyBounds.max[2],0)+pair.geometry.span*.025;
    const boneSink=Math.max(pair.geometry.geoset.MaximumExtent[2],0)+pair.geometry.span*.025;
    flesh.Translation=track(model.Sequences.flatMap((s,i)=>i===pair.flesh?[[s.Interval[0],[0,0,0]],[s.Interval[1],[0,0,-sink]]]:[[s.Interval[0],[0,0,0]]]),1);
    corpse.Translation=track(model.Sequences.flatMap((s,i)=>i===pair.bone?[[s.Interval[0],[0,0,0]],[s.Interval[1],[0,0,-boneSink]]]:[[s.Interval[0],[0,0,0]]]),1);
    const corpseStart=Math.min(fs.Interval[0]+167,fs.Interval[1]-1);
    const alpha=sequenceVisibility(model,new Map([[pair.flesh,[[fs.Interval[0],0],[corpseStart,1],[fs.Interval[1],1]]],[pair.bone,[[bs.Interval[0],1],[bs.Interval[1]-1,1],[bs.Interval[1],0]]]]));
    const g=pair.geometry.geoset;bind(g,corpse);g.MaterialID=corpseMaterial;
    const ids=[addGeoset(model,g,alpha,options.color||[1,1,1])];
    for(const frozen of pair.frozen) {
      bind(frozen.g,flesh);frozen.g.MaterialID=material(model,frozen.mat);
      ids.push(addGeoset(model,frozen.g,sequenceVisibility(model,new Map([[pair.flesh,[[fs.Interval[0],frozen.alpha],[fs.Interval[1]-1,frozen.alpha],[fs.Interval[1],0]]]])),frozen.color));
    }
    decayExtents(model,pair,ids);
    results.push({pieces:pair.geometry.pieces,outline:pair.geometry.outline,sizeCenter:pair.geometry.sizeCenter,span:pair.geometry.span,death:pair.death,deathName:pair.deathName,flesh:pair.flesh,bone:pair.bone,sourceFrame:pair.geometry.frame,corpseGeoset:ids[0],bodyGeosets:ids.slice(1),sourceBodyGeosets:pair.geometry.bodyIds,sinkDistance:sink,boneSinkDistance:boneSink,parts:pair.geometry.parts,ground:pair.geometry.ground});
  }
  for(const g of model.Geosets.slice(originalGeosetCount))g.Anims=model.Sequences.map(s=>({MinimumExtent:new Float32Array(s.MinimumExtent),MaximumExtent:new Float32Array(s.MaximumExtent),BoundsRadius:s.BoundsRadius}));
  // Original per-sequence bounds remain byte-for-byte; new slots get bounds
  // only when a geoset already uses the per-sequence extent convention.
  for(const g of model.Geosets.slice(0,originalGeosetCount))if(g.Anims?.length)while(g.Anims.length<model.Sequences.length)g.Anims.push({MinimumExtent:new Float32Array(g.MinimumExtent),MaximumExtent:new Float32Array(g.MaximumExtent),BoundsRadius:g.BoundsRadius});
  if(options.blood)applyDeathBlood(model,deaths[0].i,options.blood);
  return {corpses:results,originalNodes:originals.length};
}
