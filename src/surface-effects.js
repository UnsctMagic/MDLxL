import {createResourceImporter} from './model-import.js';
import {emptyParticleModel} from './particle-recipes.js';
import {adaptPasteFormat} from './paste-format.js';
import {createNode,geosetBounds,recalculateExtents,transformGeoset} from './editor-document.js';
import {vertexBoneWeights} from './part-bones.js';
import {stableKey} from './value-key.js';

const eye='UI\\Glues\\BattleNet\\BattlenetWorkingExpansion\\BattlenetWorkingExp.mdx';
const fire='Units\\Creeps\\HeroFlameLord\\HeroFlameLord.mdx';
const water='Units\\Human\\WaterElemental\\WaterElemental.mdx';
export const SURFACE_EFFECTS=[
 {id:'eye',name:'Moving eye',category:'Eyes',path:eye,material:0,nativeShape:0,description:'The animated expansion eye. Use its own surface to place it on a shield.'},
 {id:'eye-classic',name:'Classic eye',category:'Eyes',path:'UI\\Glues\\BattleNet\\BattlenetWorking\\BattlenetWorking.mdx',material:0,nativeShape:0,description:'The original Battle.net eye animation.'},
 {id:'water',name:'Water skin',category:'Skins',path:water,material:0,description:'Eight native water pictures with flowing texture motion.'},
 {id:'fire',name:'Flaming skin',category:'Skins',path:fire,material:0,atlas:[.0005,.25025,.24975,.24975],description:'Fire Lord flames. Native picture-sheet motion.'},
 {id:'waterfall',name:'Falling water',category:'Skins',path:'Doodads\\Terrain\\CliffDoodad\\Waterfall\\Waterfall.mdx',material:0,description:'Continuous downward water motion.'},
 {id:'energy',name:'Blade energy',category:'Energy',texture:'UI\\Glues\\SinglePlayer\\TutorialCampaign3D\\cloudstile1.blp',flow:[0,1,0],description:'Additive energy moving along the existing UV map. Turn Direction to align it with the blade.'},
 {id:'shimmer',name:'Cloud shimmer',category:'Energy',texture:'Textures\\cloudstile2.blp',flow:[1,1,0],description:'A slow cloud shimmer using a native repeating texture.'},
 {id:'own-flow',name:'Flow current skin',category:'Model',own:true,flow:[0,1,0],description:'Move the selected material’s existing textures.'},
 {id:'tint',name:'Colour pulse',category:'Model',own:true,tintPulse:true,description:'Pulse the selected geoset between its colour and your RGB tint.'},
 {id:'fade',name:'Visibility pulse',category:'Model',own:true,visibilityPulse:true,description:'Fade the selected surface in and out while retaining its Death and Decay visibility.'},
 {id:'fire-emitter',name:'Fire wisps',category:'Emitters',path:fire,emitter:101,description:'Native Fire Lord particles. Drag the handles to place them.'},
 {id:'water-emitter',name:'Water droplets',category:'Emitters',path:water,emitter:61,description:'Native Water Elemental droplets. Drag the handles to place them.'}
];
export const EFFECT_SECTIONS=['Info','Geosets','GeosetAnims','Materials','Textures','TextureAnims','GlobalSequences','Bones','Helpers','ParticleEmitters2','PivotPoints'];
export const defaultEffectOptions=effect=>({geoset:0,mode:effect.own?'replace':'overlay',shape:effect.nativeShape!=null?'native':'copy',speed:1,opacity:1,pulse:effect.visibilityPulse?1:effect.emitter!=null?.5:0,tint:effect.tintPulse?[.25,.6,1]:[1,1,1],tintPulse:!!effect.tintPulse,direction:0,tiling:1,amount:1,size:1,placement:{Translation:[0,0,0],Rotation:[0,0,0,1],Scaling:[1,1,1]}});
const clone=value=>structuredClone(value);
const global=t=>Number.isInteger(t?.GlobalSeqId)&&t.GlobalSeqId>=0;
const clock=(model,duration)=>{const i=model.GlobalSequences.indexOf(duration);return i<0?model.GlobalSequences.push(duration)-1:i;};
const track=(id,values,duration=2000,line=1)=>({LineType:line,GlobalSeqId:id,Keys:values.map((Vector,i)=>({Frame:Math.round(duration*i/(values.length-1||1)),Vector:new Float32Array(Vector)}))});
const scaleValue=(value,factor)=>{if(value?.Keys){for(const key of value.Keys)for(const p of ['Vector','InTan','OutTan'])if(key[p])key[p]=new Float32Array(Array.from(key[p],n=>n*factor));return value;}return Number(value??1)*factor;};
const localValue=(value,fallback=1)=>value?.Keys?Math.max(fallback,...value.Keys.map(k=>Number(k.Vector[0]))):value??fallback;
function retime(model,speed){
 const visit=value=>{if(!value||typeof value!=='object'||ArrayBuffer.isView(value))return;if(value.Keys&&global(value)){for(const k of value.Keys)k.Frame=Math.round(k.Frame/speed);}else for(const child of Object.values(value))visit(child);};
 for(const collection of ['Materials','TextureAnims','GeosetAnims','ParticleEmitters2'])visit(model[collection]);
 model.GlobalSequences=model.GlobalSequences.map(v=>Math.max(1,Math.round(v/speed)));
}
function reuse(collection,value){const key=stableKey(value),id=collection.findIndex(v=>stableKey(v)===key);return id<0?collection.push(value)-1:id;}
export function effectAnchor(model,g){
 const totals=new Map();for(let i=0;i<g.Vertices.length/3;i++)for(const [id,w] of vertexBoneWeights(g,i))if(model.Nodes[id])totals.set(id,(totals.get(id)||0)+w);
 return [...totals].sort((a,b)=>b[1]-a[1])[0]?.[0]??null;
}
function bounds(g){const b=geosetBounds(g.Vertices),size=Array.from(b.MaximumExtent,(v,i)=>v-b.MinimumExtent[i]);return {center:size.map((v,i)=>b.MinimumExtent[i]+v/2),size};}
function anchor(model,g,name,placement){
 const node=createNode(model,'Helper'),b=bounds(g);node.Name=name;node.Parent=effectAnchor(model,g);node.PivotPoint=new Float32Array(b.center);model.PivotPoints[node.ObjectId]=node.PivotPoint;
 const id=clock(model,1000);for(const key of ['Translation','Rotation','Scaling'])node[key]=track(id,[placement[key]],1000,0);
 return node;
}
function inheritAnimation(model,from,to){
 const a=model.GeosetAnims.find(a=>a.GeosetId===from);if(a)model.GeosetAnims.push({...clone(a),GeosetId:to});
}
function tintGeoset(model,index,options,duration){
 if(options.tint.every(v=>v===1)&&!options.tintPulse)return;
 let a=model.GeosetAnims.find(a=>a.GeosetId===index);if(!a){a={GeosetId:index,Alpha:1,Color:new Float32Array([1,1,1]),Flags:2};model.GeosetAnims.push(a);}
 a.Flags=(a.Flags||0)|2;const colour=options.tint;
 if(options.tintPulse){const base=a.Color?.Keys?Array.from(a.Color.Keys[0]?.Vector||[1,1,1]):Array.from(a.Color||[1,1,1]);a.Color=track(clock(model,duration),[base,colour,base],duration);}
 else if(a.Color?.Keys)for(const k of a.Color.Keys)for(const p of ['Vector','InTan','OutTan'])if(k[p])k[p]=new Float32Array(Array.from(k[p],(v,i)=>v*colour[i]));
 else a.Color=new Float32Array(Array.from(a.Color||[1,1,1],(v,i)=>v*colour[i]));
}
export function applySurfaceEffect(model,donor,effect,options){
 const original=model.Geosets[options.geoset];if(!original)throw Error('Select a geoset.');
 if(model.BindPoses?.length)throw Error('This local prototype supports Classic meshes without bind-pose matrices.');
 if(!Number.isFinite(options.speed)||options.speed<=0)throw Error('Choose a positive speed.');
 const duration=Math.max(100,Math.round(2000/options.speed));
 let source=effect.own?clone(model):donor?adaptPasteFormat(clone(donor),model.Version):emptyParticleModel(model.Version);
 let materialId=effect.own?original.MaterialID:effect.material??0;
 if(effect.texture){source.Textures=[{Image:effect.texture,ReplaceableId:0,Flags:3}];source.Materials=[{PriorityPlane:0,RenderMode:0,Layers:[{TextureID:0,TVertexAnimId:null,CoordId:0,Alpha:1,FilterMode:3,Shading:17}]}];}
 if(effect.flow){
  const material=clone(source.Materials[materialId]);source.Materials.push(material);materialId=source.Materials.length-1;
  const angle=options.direction*Math.PI/180,flow=effect.flow,vector=[flow[0]*Math.cos(angle)-flow[1]*Math.sin(angle),flow[0]*Math.sin(angle)+flow[1]*Math.cos(angle),0];
  const id=clock(source,2000);for(const layer of material.Layers){layer.TVertexAnimId=source.TextureAnims.push({Translation:track(id,[[0,0,0],vector])})-1;}
 }
 if(!effect.own||effect.flow)retime(source,options.speed);
 const importer=createResourceImporter(source,model,{reuseTextures:effect.category==='Eyes'?'partPath':'partKey',reuseGlobals:true,reuseMaterials:true,reuseTextureAnims:true});
 if(effect.emitter!=null){
  const sourceNode=source.ParticleEmitters2.find(n=>n.ObjectId===effect.emitter);if(!sourceNode)throw Error('The native emitter is unavailable.');
  const root=anchor(model,original,effect.name,options.placement),node=createNode(model,'ParticleEmitter2'),id=node.ObjectId;
  const copy=clone(sourceNode);for(const key of ['Translation','Rotation','Scaling'])delete copy[key];
  for(const [key,value] of Object.entries(copy))if(value?.Keys&&!global(value))copy[key]=localValue(value,key==='Visibility'?1:0);
  importer.globalRef(copy);copy.TextureID=importer.textureRef(sourceNode.TextureID);
  Object.assign(node,copy,{ObjectId:id,Parent:root.ObjectId,Name:effect.name,PivotPoint:new Float32Array(root.PivotPoint)});
  model.PivotPoints[id]=node.PivotPoint;
  node.EmissionRate=scaleValue(node.EmissionRate,options.amount);node.ParticleScaling=new Float32Array(Array.from(node.ParticleScaling,v=>v*options.size));
  node.SegmentColor=node.SegmentColor.map(v=>new Float32Array(Array.from(v,(n,i)=>n*options.tint[i])));
  node.Alpha=new Uint8Array(Array.from(node.Alpha,v=>Math.round(v*options.opacity)));
  // Preserve the selected surface's ordinary visibility; pulse emission independently.
  const geoAlpha=model.GeosetAnims.find(a=>a.GeosetId===options.geoset)?.Alpha;
  node.Visibility=clone(geoAlpha??1);
  if(options.pulse>0){const maximum=localValue(node.EmissionRate,0);node.EmissionRate=track(clock(model,duration),[[maximum],[maximum*(1-options.pulse)],[maximum]],duration);}
  return {geoset:options.geoset,anchorId:root.ObjectId,emitterId:id};
 }
 const material=clone(source.Materials[materialId]);if(!material?.Layers?.length)throw Error('This effect has no surface material.');
 for(const layer of material.Layers){
  if(!effect.own&&layer.Alpha?.Keys&&!global(layer.Alpha))layer.Alpha=localValue(layer.Alpha);
  layer.Alpha=scaleValue(layer.Alpha,options.opacity);
  if(options.pulse>0)layer.Alpha=track(clock(source,duration),[[options.opacity],[options.opacity*(1-options.pulse)],[options.opacity]],duration);
  if(options.mode==='overlay'){layer.FilterMode=effect.category==='Eyes'?2:3;layer.Shading=(layer.Shading||0)|16;}
 }
 source.Materials.push(material);materialId=source.Materials.length-1;
 let index=options.geoset,geometry=original,root=null;
 if(options.mode==='new'){
  if(options.shape==='native'&&effect.nativeShape!=null){
   geometry=clone(source.Geosets[effect.nativeShape]);const from=bounds(geometry),to=bounds(original),span=Math.max(...to.size)*.35,scale=span/Math.max(...from.size,1e-6);
   transformGeoset(geometry,{translation:from.center.map(v=>-v)});transformGeoset(geometry,{scale,rotation:[90,0,90],translation:[to.center[0]+to.size[0]/2+.5,to.center[1],to.center[2]]});
   root=anchor(model,original,effect.name,options.placement);geometry.Groups=[[root.ObjectId]];geometry.TotalGroupsCount=1;geometry.VertexGroup=new Uint8Array(geometry.Vertices.length/3);delete geometry.SkinWeights;delete geometry.Tangents;
   geometry.Anims=clone(original.Anims||[]);
  }else geometry=clone(original);
  index=model.Geosets.push(geometry)-1;inheritAnimation(model,options.geoset,index);
 }
 const native=options.mode==='new'&&options.shape==='native'&&effect.nativeShape!=null;
 // An independent UV set lets an overlaid atlas leave the original skin mapping intact.
 const uv=clone(geometry.TVertices[0]);
 if(!native&&(effect.atlas||options.tiling!==1)){const [u,v,w,h]=effect.atlas||[0,0,1,1];for(let i=0;i<uv.length;i+=2){uv[i]=u+uv[i]*w*options.tiling;uv[i+1]=v+uv[i+1]*h*options.tiling;}}
 let coord=0;
 if(options.mode==='overlay'&&(effect.atlas||options.tiling!==1)){coord=geometry.TVertices.findIndex(a=>stableKey(a)===stableKey(uv));if(coord<0)coord=geometry.TVertices.push(uv)-1;}
 else if(!native)geometry.TVertices[0]=uv;
 for(const layer of material.Layers)layer.CoordId=coord;
 const materialsBefore=model.Materials.length,importedId=importer.materialRef(materialId);
 if(options.mode==='overlay'){
  const combined=clone(model.Materials[original.MaterialID]);
  for(const layer of model.Materials[importedId].Layers)if(!combined.Layers.some(x=>stableKey(x)===stableKey(layer)))combined.Layers.push(clone(layer));
  geometry.MaterialID=reuse(model.Materials,combined);
  // The intermediate imported material is disposable if nothing references it.
  if(importedId>=materialsBefore&&!model.Geosets.some(g=>g.MaterialID===importedId)&&!model.RibbonEmitters.some(n=>n.MaterialID===importedId)){model.Materials.splice(importedId,1);for(const g of model.Geosets)if(g.MaterialID>importedId)g.MaterialID--;}
 }else geometry.MaterialID=importedId;
 tintGeoset(model,index,options,duration);
 if(options.mode==='new')recalculateExtents(model,[index]);
 return {geoset:index,anchorId:root?.ObjectId??null};
}
