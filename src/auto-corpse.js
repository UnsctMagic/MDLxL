import { isTeamGlowLayer } from './texture-references.js';
import { sequenceWords, isDeathSequence, isDecaySequence, isDissipateSequence } from './sequence-editor.js';
import { allNodes, isGlobalTrack, sampleNodeMatrices, sampleTrack, sampleGeosetAnimation, skinGeoset } from './animation.js';
import { createRigNode } from './bone-tools.js';
import { deleteGeoset } from './editor-document.js';
import { createVisibilityGeosetAnimation, ensureGeosetAnimation } from './geoset-animation-defaults.js';
import { updateBounds } from './mesh-tools.js';
import { Quaternion, Vector3 } from 'three';
import { buildCorpseGeometry } from './corpse-geometry.js';
import { applyDeathBlood } from './corpse-blood.js';

// FLESH names the frozen-copy bone of CORP before 0.37.0; a repeat Create
// deletes that old copy's meshes like its own corpse.
const PREFIX='MDLxL Corpse ', FLESH='MDLxL Flesh ';
export const AUTO_CORPSE_SECTIONS=['Sequences','GlobalSequences','Geosets','GeosetAnims','Materials','Textures','TextureAnims','Bones','Helpers','PivotPoints','BindPoses','Nodes','Attachments','ParticleEmitters','ParticleEmitters2','ParticleEmitterPopcorns','RibbonEmitters','Lights','EventObjects'];
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
const glow=(model,g)=>model.Materials[g.MaterialID]?.Layers.every(l=>isTeamGlowLayer(model,l)||l.FilterMode>=3);
const bodyVisible=(model,id,frame,index)=>sampleGeosetAnimation(model,id,frame,index).alpha>.01&&model.Materials[model.Geosets[id].MaterialID]?.Layers.some(l=>sample(model,l.Alpha,frame,index,1)>.01);
const corpseTexture=(model,g)=>textureNames(model,g).some(name=>/(?:^|[\\/])(?:gutz|guts|[^\\/]*corpse[^\\/]*)\.(?:blp|dds|tga)$/i.test(name));
// Hermite tangents of a held value are zero; Bezier controls and quaternion
// tangents equal the value. A sink passes its own straight-line tangents.
const key=(frame,value,line,[inTan,outTan]=[])=>{const v=vector(value),flat=line===2&&v.length!==4?v.map(()=>0):v;return {Frame:frame,Vector:v,...(line>=2?{InTan:vector(inTan??flat),OutTan:vector(outTan??flat)}:{})};};
const TRANSFORMS={Translation:[0,0,0],Rotation:[0,0,0,1],Scaling:[1,1,1]};

/** Replace only the keys inside the given decay spans ([start,end,keys]).
 * Original interpolation, tangents, globals and keys outside them are never
 * resampled. A missing track gets keys only inside the spans when sparse. */
function replaceKeys(value,sequences,spans,{fallback=1,sparse=false}={}) {
  const result=value?.Keys?structuredClone(value):value==null&&sparse?track([],1):track(sequences.map(s=>[s.Interval[0],value??fallback]));
  // Native tracks may repeat a frame; their own keys stay exactly as they are.
  const added=[...new Map(spans.flatMap(([,,keys])=>keys).map(([frame,v,tangents])=>[frame,key(frame,v,result.LineType,tangents)])).values()];
  result.Keys=[...result.Keys.filter(k=>!spans.some(([a,b])=>k.Frame>=a&&k.Frame<=b)),...added].sort((a,b)=>a.Frame-b.Frame);
  return result;
}
function localMask(value,sequences,spans,fallback=1) {
  if(value===0)return 0;
  if(global(value)) throw Error('This model has global visibility on both its body and material. Make one visibility channel local before using Auto Corpse.');
  return replaceKeys(value,sequences,spans.map(([a,b,keys])=>[a,b,keys||[[a,0],[b,0]]]),{fallback});
}
/** Holds a keyed local track at its last-Death value through a decay span.
 * Global loops keep running, as they do on Blizzard's own units. */
function hold(model,owner,property,[a,b],frame,index,fallback,quaternion=false) {
  const value=owner?.[property];if(!value?.Keys||global(value))return;
  const v=sampleTrack(value,frame,{interval:model.Sequences[index].Interval,globalSequences:model.GlobalSequences,globalTime:frame,fallback,quaternion});
  const same=Array.isArray(fallback)?vector(v).every((x,i)=>x===fallback[i]):v===fallback;
  // No keys in the span already falls back to the identity value.
  if(same&&!value.Keys.some(k=>k.Frame>=a&&k.Frame<=b))return;
  owner[property]=replaceKeys(value,model.Sequences,[[a,b,[[a,v]]]]);
}
/** Nodes that move a geoset: its bindings (bound) and all their parents. */
function drivers(model,ids,byId) {
  const used=new Set();
  for(const id of ids) {
    const g=model.Geosets[id];
    for(const group of g.Groups||[])for(const node of group)used.add(node);
    const skin=g.SkinWeights;if(skin?.length)for(let i=0;i<skin.length;i+=8)for(let k=0;k<4;k++)if(skin[i+4+k])used.add(skin[i+k]);
  }
  const bound=new Set(used);
  for(const id of bound)for(let n=byId.get(id);n&&n.Parent!=null&&n.Parent>=0&&byId.has(n.Parent)&&!used.has(n.Parent);n=byId.get(n.Parent))used.add(n.Parent);
  return {nodes:[...used].map(id=>byId.get(id)).filter(Boolean),bound};
}
/** Keys that move a node by d in a straight line, like the Blizzard root
 * bone sinking. Stepped tracks get one step per second. */
function sinkKeys(start,d,[a,b],line) {
  const end=start.map((v,i)=>v+d[i]);
  if(line===2)return [[a,start,[d,d]],[b,end,[d,d]]];
  if(line===3)return [[a,start,[start,start.map((v,i)=>v+d[i]/3)]],[b,end,[end.map((v,i)=>v-d[i]/3),end]]];
  if(line===0){const keys=[];for(let f=a;f<b;f+=1000)keys.push([f,start.map((v,i)=>v+d[i]*(f-a)/(b-a))]);keys.push([b,end]);return keys;}
  return [[a,start],[b,end]];
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
function decayExtents(model,pair,shown) {
  for(const [index,ids] of [[pair.flesh,shown.flesh],[pair.bone,shown.bone]]) {
    const seq=model.Sequences[index],cloud=[];
    for(const t of [seq.Interval[0],seq.Interval[1]]) {
      const matrices=sampleNodeMatrices(model,t,index);
      for(const id of ids) for(const value of skinGeoset(model.Geosets[id],matrices))cloud.push(value);
    }
    Object.assign(seq,extent(new Float32Array(cloud)));
  }
}

/** Runs inside EditorDocument.apply: a failure rolls back the complete command.
 * Like Blizzard's own units, the body itself stays visible in Decay Flesh: its
 * bones get keys that hold the last Death frame and the top bones sink. Only
 * keys inside the decay clips change; living animations, Death curves, global
 * loops and skin bindings stay as they were. The only new mesh is the corpse.
 * A second click replaces this command's corpse and reuses its bone.
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
    const geometry=buildCorpseGeometry(model,body.map(x=>x.id),i,{...options,pieces:n===0?options.pieces:null});
    // The body keeps the look it has on the last Death frame. Many native
    // deaths switch the body off on exactly that frame; decay shows it whole.
    const shown=v=>v>.01?v:1;
    const look=new Map(body.map(({id})=>{const anim=model.GeosetAnims.find(a=>a.GeosetId===id);return [id,{alpha:anim&&!global(anim.Alpha)?shown(sample(model,anim.Alpha,frame,i,1)):1,color:anim?.Color?.Keys&&!global(anim.Color)?sample(model,anim.Color,frame,i,[1,1,1]):null,layers:model.Materials[model.Geosets[id].MaterialID]?.Layers.map(l=>global(l.Alpha)?null:shown(sample(model,l.Alpha,frame,i,1)))}];}));
    return {death:i,deathName:s.Name,geometry,frame,body:body.map(x=>x.id),look};
  });
  const pairs=plans.map(plan=>{const death=model.Sequences[plan.death],tail=suffix(death.Name),label=tail?' '+death.Name.trim().split(/\s+/).filter(t=>!/^death$/i.test(t)).join(' '):'';return {...plan,flesh:ensureSequence(model,'Decay Flesh'+label,death,'flesh'),bone:ensureSequence(model,'Decay Bone'+label,death,'bone')};});
  const intervals=pairs.flatMap(p=>[p.flesh,p.bone]).map(i=>Array.from(model.Sequences[i].Interval));
  const byId=new Map(originals.map(n=>[n.ObjectId,n]));
  for(const pair of pairs) {
    const span=Array.from(model.Sequences[pair.flesh].Interval),sink=Math.max(pair.geometry.bodyBounds.max[2],0)+pair.geometry.span*.025;
    pair.sink=sink;
    // Blizzard's decay: every bone holds the last Death frame with one key and
    // the top bones carry the whole body straight down.
    const {nodes,bound}=drivers(model,pair.body,byId),sinks=new Map();
    const at=(node,property)=>Array.from(vector(sampleTrack(node[property],pair.frame,{interval:model.Sequences[pair.death].Interval,globalSequences:model.GlobalSequences,globalTime:pair.frame,fallback:TRANSFORMS[property],quaternion:property==='Rotation'})));
    // A top bone that bobs on a global loop (ships) keeps bobbing and passes
    // the drop on to the bones under it, in its own held axes.
    const place=(node,d)=>{
      if(!global(node.Translation)){sinks.set(node,d);return;}
      if(bound.has(node.ObjectId)||global(node.Rotation)||global(node.Scaling))throw Error(`"${node.Name}" moves on a global loop, so the body cannot sink in Decay Flesh. Make its movement local before using Auto Corpse.`);
      const turn=new Quaternion().fromArray(at(node,'Rotation')).normalize().invert(),scale=at(node,'Scaling');
      const local=new Vector3(...d).applyQuaternion(turn).toArray().map((v,i)=>v/(scale[i]||1));
      for(const child of nodes)if(child.Parent===node.ObjectId)place(child,local);
    };
    for(const node of nodes)if(node.Parent==null||node.Parent<0||!byId.has(node.Parent))place(node,[0,0,-sink]);
    for(const node of nodes) {
      for(const [property,fallback] of Object.entries(TRANSFORMS))if(property!=='Translation'||!sinks.has(node))hold(model,node,property,span,pair.frame,pair.death,fallback,property==='Rotation');
      const d=sinks.get(node);if(!d)continue;
      const start=node.Translation?.Keys?at(node,'Translation'):Array.from(vector(node.Translation??[0,0,0]));
      node.Translation=replaceKeys(node.Translation,model.Sequences,[[...span,sinkKeys(start,d,span,node.Translation?.LineType??1)]],{fallback:start,sparse:true});
    }
    for(const id of pair.body) {
      const mat=model.Materials[model.Geosets[id].MaterialID];
      for(const layer of mat?.Layers||[]) {
        for(const [property,fallback] of [['TextureID',0],['EmissiveGain',1],['FresnelColor',[1,1,1]],['FresnelOpacity',1],['FresnelTeamColor',1]])hold(model,layer,property,span,pair.frame,pair.death,fallback);
        const uv=layer.TVertexAnimId!=null&&layer.TVertexAnimId>=0?model.TextureAnims[layer.TVertexAnimId]:null;
        for(const [property,fallback] of Object.entries(TRANSFORMS))hold(model,uv,property,span,pair.frame,pair.death,fallback,property==='Rotation');
      }
      const color=pair.look.get(id).color;
      if(color){const anim=visibility(model,id);anim.Color=replaceKeys(anim.Color,model.Sequences,[[...span,[[span[0],color]]]]);}
    }
  }
  // Blizzard's visibility: the body shows through Decay Flesh and is gone on
  // its last frame; Decay Bone shows only the corpse.
  const spans=(id,value)=>pairs.flatMap(p=>{
    const [a,b]=model.Sequences[p.flesh].Interval,[c,e]=model.Sequences[p.bone].Interval,v=p.body.includes(id)?value(p):0;
    return [[a,b,v?[[a,v],[b-1,v],[b,0]]:[[a,0],[b,0]]],[c,e,[[c,0],[e,0]]]];
  });
  for(let id=0;id<originalGeosetCount;id++) {
    const anim=visibility(model,id);
    if(oldCorpses.has(id)){anim.Alpha=0;continue;}
    if(global(anim.Alpha)) {
      const g=model.Geosets[id],mat=structuredClone(model.Materials[g.MaterialID]);
      mat.Layers.forEach((layer,n)=>{layer.Alpha=localMask(layer.Alpha,model.Sequences,spans(id,p=>p.look.get(id).layers[n]));});
      g.MaterialID=material(model,mat);
    } else {
      // A body layer that fades with its own keys holds its last Death value.
      for(const p of pairs.filter(p=>p.body.includes(id)))model.Materials[model.Geosets[id].MaterialID]?.Layers.forEach((layer,n)=>{if(layer.Alpha?.Keys&&!global(layer.Alpha)){const span=Array.from(model.Sequences[p.flesh].Interval);layer.Alpha=replaceKeys(layer.Alpha,model.Sequences,[[...span,[[span[0],p.look.get(id).layers[n]]]]]);}});
      anim.Alpha=localMask(anim.Alpha,model.Sequences,spans(id,p=>p.look.get(id).alpha));
    }
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
    const corpse=root(model,PREFIX+number),fs=model.Sequences[pair.flesh],bs=model.Sequences[pair.bone];
    const sink=pair.sink,boneSink=Math.max(pair.geometry.geoset.MaximumExtent[2],0)+pair.geometry.span*.025;
    corpse.Translation=track(model.Sequences.flatMap((s,i)=>i===pair.bone?[[s.Interval[0],[0,0,0]],[s.Interval[1],[0,0,-boneSink]]]:[[s.Interval[0],[0,0,0]]]),1);
    const corpseStart=Math.min(fs.Interval[0]+167,fs.Interval[1]-1);
    const alpha=sequenceVisibility(model,new Map([[pair.flesh,[[fs.Interval[0],0],[corpseStart,1],[fs.Interval[1],1]]],[pair.bone,[[bs.Interval[0],1],[bs.Interval[1]-1,1],[bs.Interval[1],0]]]]));
    const g=pair.geometry.geoset;bind(g,corpse);g.MaterialID=corpseMaterial;
    const id=addGeoset(model,g,alpha,options.color||[1,1,1]);
    decayExtents(model,pair,{flesh:[...pair.body,id],bone:[id]});
    results.push({pieces:pair.geometry.pieces,outline:pair.geometry.outline,sizeCenter:pair.geometry.sizeCenter,span:pair.geometry.span,death:pair.death,deathName:pair.deathName,flesh:pair.flesh,bone:pair.bone,sourceFrame:pair.geometry.frame,corpseGeoset:id,bodyGeosets:pair.body,sourceBodyGeosets:pair.geometry.bodyIds,sinkDistance:sink,boneSinkDistance:boneSink,parts:pair.geometry.parts,ground:pair.geometry.ground});
  }
  for(const g of model.Geosets.slice(originalGeosetCount))g.Anims=model.Sequences.map(s=>({MinimumExtent:new Float32Array(s.MinimumExtent),MaximumExtent:new Float32Array(s.MaximumExtent),BoundsRadius:s.BoundsRadius}));
  // Original per-sequence bounds remain byte-for-byte; new slots get bounds
  // only when a geoset already uses the per-sequence extent convention.
  // A body geoset's new Decay Flesh slot covers the body lying and sinking.
  model.Geosets.slice(0,originalGeosetCount).forEach((g,id)=>{if(g.Anims?.length)while(g.Anims.length<model.Sequences.length){const s=model.Sequences[g.Anims.length],own=pairs.some(p=>p.flesh===g.Anims.length&&p.body.includes(id))?s:g;g.Anims.push({MinimumExtent:new Float32Array(own.MinimumExtent),MaximumExtent:new Float32Array(own.MaximumExtent),BoundsRadius:own.BoundsRadius});}});
  if(options.blood)applyDeathBlood(model,deaths[0].i,options.blood);
  return {corpses:results,originalNodes:originals.length};
}
