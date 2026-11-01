import {Euler, Quaternion} from 'three';
import {createResourceImporter} from './model-import.js';
import {emptyParticleModel} from './particle-recipes.js';
import {adaptPasteFormat} from './paste-format.js';
import {createNode,geosetBounds,recalculateExtents,transformGeoset} from './editor-document.js';
import {constantTrack} from './plain-track-values.js';
import {vertexBoneWeights} from './part-bones.js';
import {surfacePalette, tintFromHex} from './surface-effect-colours.js';
import {stableKey} from './value-key.js';

export const SURFACE_EFFECTS = [
  {id: "eye",name: "Moving eye",category: "Eyes",path: "UI\\Glues\\BattleNet\\BattlenetWorkingExpansion\\BattlenetWorkingExp.mdx",material: 0,picture: "UI\\Glues\\BattleNet\\BattlenetWorkingExpansion\\BNetWorkingExp0000.blp",description: "The animated expansion eye. Its native surface can be placed on a shield.",nativeShape: 0,overlayFilter: 2,textureReuse: "partPath"},
  {id: "eye-classic",name: "Classic eye",category: "Eyes",path: "UI\\Glues\\BattleNet\\BattlenetWorking\\BattlenetWorking.mdx",material: 0,picture: "Textures\\BattlenetWorking0000.blp",description: "The original Battle.net eye animation.",nativeShape: 0,overlayFilter: 2,textureReuse: "partPath"},
  {id: "water",name: "Water skin",category: "Skins",path: "Units\\Human\\WaterElemental\\WaterElemental.mdx",material: 0,picture: "Textures\\Lords0000.blp",description: "Eight moving Water Elemental pictures."},
  {id: "fire",name: "Flaming skin",category: "Skins",texture: "Textures\\HeroAvatarFlame.blp",atlas: [0.03,0.815,0.45,0.176],motion: "flame",filterMode: 2,opacity: .88,duration: 1550,palette: "flame",description: "Gold flames roll across the selected surface."},
  {id: "embers",name: "Fire Lord embers",category: "Skins",path: "Units\\Creeps\\HeroFlameLord\\HeroFlameLord.mdx",material: 0,picture: "Textures\\clouds_anim1_bw.blp",atlas: [0.0005,0.25025,0.249,0.249],thumbnailRect: [0,0,0.25,0.25],palette: "embers",description: "Glowing embers bloom and dissolve in the Fire Lord’s native orange."},
  {id: "waterfall",name: "Falling water",category: "Skins",path: "Doodads\\Terrain\\CliffDoodad\\Waterfall\\Waterfall.mdx",material: 0,picture: "ReplaceableTextures\\Water\\Water00.blp",description: "Continuous downward water motion."},
  {id: "frost",name: "Frost skin",category: "Skins",palette: "ice",path: "Abilities\\Spells\\Undead\\FreezingBreath\\FreezingBreathTargetArt.mdx",material: 0,picture: "Textures\\Ice3b.blp",description: "The ice and mist layers of Freezing Breath."},
  {id: "revenant",name: "Revenant waves",category: "Skins",path: "Units\\Creeps\\Revenant\\Revenant.mdx",material: 2,picture: "Textures\\BlueWaves.blp",description: "Waves from the Revenant’s moving skin."},
  {id: "moonwell",name: "Moon well swirl",category: "Magic",path: "Abilities\\Spells\\NightElf\\MoonWell\\MoonWellTarget.mdx",material: 0,picture: "Textures\\Lords0000.blp",description: "The Moon Well’s rotating water pictures."},
  {id: "stars",name: "Starfield",category: "Magic",path: "Units\\Undead\\FrostWyrm\\FrostWyrm_Portrait.mdx",material: 4,picture: "Units\\Undead\\FrostWyrm\\starfield.blp",description: "Stars drifting across the surface."},
  {id: "lava",name: "Molten lava",category: "Terrain",textureFlags: 0,textureReuse: "partPath",texture: "TerrainArt\\Dungeon\\Cave_Lava.blp",atlas: [0,0,0.25,0.25],motion: "drift",duration: 3100,opacity: 0.75,pulse: 0.12,overlayFilter: 2,filterMode: 2,description: "Slow currents of molten rock from the Dungeon tileset."},
  {id: "fissures",filterMode: 2,inset: .025,name: "Lava fissures",category: "Terrain",textureFlags: 0,textureReuse: "partPath",texture: "TerrainArt\\Dungeon\\Cave_LavaCracks.blp",atlas: [0.625,0.25,0.125,0.25],duration: 2400,pulse: 0.42,description: "Red fissures stay in place while their light swells and recedes."},
  {id: "glacial",filterMode: 2,inset: .025,name: "Glacial fissures",category: "Terrain",textureFlags: 0,textureReuse: "partPath",texture: "TerrainArt\\Dungeon2\\GLavaCracks.blp",atlas: [0.625,0.25,0.125,0.25],duration: 3400,pulse: 0.35,palette: "ice",description: "Cold blue cracks from the Underground tileset pulse beneath the surface."},
  {id: "poison",name: "Felwood poison",category: "Terrain",textureFlags: 0,textureReuse: "partPath",texture: "TerrainArt\\Felwood\\Felwood_Poison.blp",atlas: [0.75,0.5,0.125,0.25],motion: "drift",duration: 2700,opacity: 0.72,overlayFilter: 2,filterMode: 2,palette: "venom",description: "Green poison pools drift across the surface within one Felwood tile."},
  {id: "energy",name: "Blade energy",category: "Weapons",palette: "arcane",fitUV: true,texture: "UI\\Glues\\SinglePlayer\\TutorialCampaign3D\\cloudstile1.blp",flow: [0,1,0],description: "Energy travels along the blade. Turn Direction to follow its UV map."},
  {id: "shimmer",name: "Cloud shimmer",category: "Magic",texture: "Textures\\cloudstile2.blp",flow: [1,1,0],description: "A diagonal cloud shimmer."},
  {id: "sacred",name: "Sacred edge",category: "Weapons",palette: "gold",fitUV: true,texture: "Textures\\FX\\v\\SacredGlowSharper.blp",flow: [1,0,0],description: "A band of sacred light running along the weapon."},
  {id: "frost-edge",name: "Frost edge",category: "Weapons",palette: "ice",fitUV: true,texture: "Textures\\Ice3b.blp",flow: [0,1,0],description: "Scrolling ice highlights along the weapon."},
  {id: "ember-edge",name: "Ember edge",category: "Weapons",texture: "Abilities\\Weapons\\FlamingArrow\\Fire10022.blp",fitUV: true,flow: [0,1,0],duration: 1350,palette: "flame",description: "A bright flame travels along the blade. Turn Direction to follow its length."},
  {id: "venom-edge",name: "Venom edge",category: "Weapons",texture: "Textures\\AcidSplash1.blp",fitUV: true,flow: [0,1,0],duration: 2200,palette: "venom",description: "Green streaks of acid travel along the blade."},
  {id: "own-flow",name: "Flow current skin",category: "Model",own: true,flow: [0,1,0],description: "Move the selected material’s existing textures."},
  {id: "tint",name: "Colour pulse",category: "Model",own: true,palette: "arcane",tintPulse: true,description: "Pulse the selected geoset between its colour and your tint."},
  {id: "fade",name: "Visibility pulse",category: "Model",own: true,visibilityPulse: true,description: "Fade the selected surface in and out."}
];

export const EFFECT_SECTIONS = ['Info','Geosets','GeosetAnims','Materials','Textures','TextureAnims','GlobalSequences'];
export const defaultEffectOptions = effect => ({
  geoset:0, mode:effect.own?'replace':'overlay', shape:effect.nativeShape!=null?'native':'copy',
  speed:1, opacity:effect.opacity??1, pulse:effect.pulse??(effect.visibilityPulse?1:0), tint:tintFromHex(surfacePalette(effect)[0][1]),
  setTint:!!(effect.atlas || effect.palette), tintPulse:!!effect.tintPulse, direction:0, tiling:1,
  placement:{Translation:[0,0,0], Rotation:[0,0,0,1], Scaling:[1,1,1]},
});

const hasClock = value => Number.isInteger(value?.GlobalSeqId) && value.GlobalSeqId >= 0;
function reuse(list, value) {
  const key = stableKey(value), index = list.findIndex(item => stableKey(item) === key);
  return index < 0 ? list.push(value)-1 : index;
}
function clock(model, duration) {
  const index = model.GlobalSequences.indexOf(duration);
  return index < 0 ? model.GlobalSequences.push(duration)-1 : index;
}
function loop(model, duration, values) {
  return {LineType:1, GlobalSeqId:clock(model,duration), Keys:values.map((value,index)=>({
    Frame:Math.round(duration*index/(values.length-1)), Vector:Float32Array.from(value),
  }))};
}

// Only an eye surface needs geometry. The material importer collects every referenced
// picture (including animated TextureID), texture animation and clock in local slots.
export function prepareSurfacePackage(donor, effect) {
  const pack = emptyParticleModel(donor.Version);
  createResourceImporter(donor,pack,{reuseTextures:'partKey',reuseGlobals:true}).materialRef(effect.material);
  if (effect.nativeShape != null) pack.Geosets.push(structuredClone(donor.Geosets[effect.nativeShape]));
  return pack;
}
function retime(value, speed) {
  if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return;
  if (value.Keys) {
    if (hasClock(value)) for (const key of value.Keys) key.Frame=Math.round(key.Frame/speed);
    return;
  }
  for (const child of Object.values(value)) retime(child,speed);
}
function adjustedPackage(pack, version, effect, speed) {
  if (effect.texture) {
    const source=emptyParticleModel(version);
    source.Textures.push({Image:effect.texture,ReplaceableId:0,Flags:effect.textureFlags??3});
    source.Materials.push({PriorityPlane:0,RenderMode:0,Layers:[{TextureID:0,TVertexAnimId:null,CoordId:0,Alpha:1,FilterMode:effect.filterMode??3,Shading:17}]});
    return source;
  }
  const source = pack.Version===version ? structuredClone(pack) : adaptPasteFormat(pack,version);
  if (speed!==1) {
    retime(source.Materials,speed);
    retime(source.TextureAnims,speed);
    source.GlobalSequences=source.GlobalSequences.map(ms=>Math.max(1,Math.round(ms/speed)));
  }
  return source;
}

export function effectAnchor(model, geoset) {
  const totals = new Map();
  for (let vertex=0; vertex<geoset.Vertices.length/3; vertex++) {
    for (const [bone,weight] of vertexBoneWeights(geoset,vertex)) {
      if (model.Nodes[bone]) totals.set(bone,(totals.get(bone)||0)+weight);
    }
  }
  return [...totals].sort((a,b)=>b[1]-a[1])[0]?.[0] ?? null;
}
function bounds(geoset) {
  const box=geosetBounds(geoset.Vertices);
  const size=Array.from(box.MaximumExtent,(value,i)=>value-box.MinimumExtent[i]);
  return {size,center:size.map((span,i)=>box.MinimumExtent[i]+span/2)};
}
function newSurface(model, original, pack, effect, options, preview) {
  let geometry, anchorId=null;
  if (options.shape==='native' && effect.nativeShape!=null) {
    geometry=structuredClone(pack.Geosets[0]);
    const from=bounds(geometry), to=bounds(original), pivot=to.center;
    const scale=Math.max(...to.size)*.35/Math.max(...from.size,1e-6);
    transformGeoset(geometry,{translation:from.center.map(v=>-v)});
    transformGeoset(geometry,{scale,rotation:[90,0,90],translation:[pivot[0]+to.size[0]/2+.5,pivot[1],pivot[2]]});
    let bone=effectAnchor(model,original);
    if (preview) {
      const helper=createNode(model,'Helper');
      helper.Name=effect.name; helper.Parent=bone;
      helper.PivotPoint=model.PivotPoints[helper.ObjectId]=Float32Array.from(pivot);
      for (const [field,value] of Object.entries(options.placement)) helper[field]=constantTrack(model,value);
      anchorId=bone=helper.ObjectId;
    } else {
      // transformGeoset applies X, then Y, then Z (ZYX Euler composition).
      const pose=options.placement;
      const euler=new Euler().setFromQuaternion(new Quaternion().fromArray(pose.Rotation),'ZYX');
      transformGeoset(geometry,{translation:pivot.map(v=>-v)});
      transformGeoset(geometry,{rotation:[euler.x,euler.y,euler.z].map(r=>r*180/Math.PI),scale:pose.Scaling,
        translation:pivot.map((value,i)=>value+pose.Translation[i])});
    }
    geometry.Groups=[bone==null?[]:[bone]]; geometry.TotalGroupsCount=bone==null?0:1;
    geometry.VertexGroup=new Uint8Array(geometry.Vertices.length/3);
    delete geometry.SkinWeights; delete geometry.Tangents;
    geometry.Anims=structuredClone(original.Anims||[]);
  } else geometry=structuredClone(original);
  const index=model.Geosets.push(geometry)-1;
  const visibility=model.GeosetAnims.find(a=>a.GeosetId===options.geoset);
  if (visibility) model.GeosetAnims.push({...structuredClone(visibility),GeosetId:index});
  recalculateExtents(model,[index]);
  return {index,anchorId};
}
function effectCoordinates(geometry,effect,options) {
  const fitted=!!(effect.atlas || effect.fitUV);
  if (!fitted && options.tiling===1) return null;
  const uv=geometry.TVertices[0].slice();
  const [left,top,width,height]=effect.atlas || [0,0,1,1];
  // A Warrior part may occupy a sliver of an atlas, or wrap beyond 1. Fit the
  // effect to that part while keeping the original material on its own UVs.
  const low=[Infinity,Infinity], high=[-Infinity,-Infinity];
  if (fitted) for (let i=0;i<uv.length;i++) {
    const axis=i%2; low[axis]=Math.min(low[axis],uv[i]); high[axis]=Math.max(high[axis],uv[i]);
  }
  const inset=effect.motion==='drift' ? .13 : effect.inset??0;
  const repeats=effect.atlas ? 1 : options.tiling;
  for (let i=0;i<uv.length;i+=2) {
    for (let axis=0;axis<2;axis++) {
      const span=high[axis]-low[axis];
      const value=fitted ? (span>0 ? (uv[i+axis]-low[axis])/span : .5) : uv[i+axis];
      uv[i+axis]=(axis===0?left:top)+(inset+value*(1-2*inset))*repeats*(axis===0?width:height);
    }
  }
  if (options.mode==='overlay') return reuse(geometry.TVertices,uv);
  geometry.TVertices[0]=uv;
  return 0;
}

function surfaceTranslation(effect,direction) {
  if (effect.motion==='drift') {
    const [, , width,height]=effect.atlas;
    return [[0,0],[.055,.035],[.085,0],[.06,-.045],[0,-.075],[-.065,-.045],[-.085,0],[-.055,.035],[0,0]]
      .map(([x,y])=>[x*width,y*height,0]);
  }
  if (effect.motion==='flame') return [[0,0,0],[.25,.003,0],[.5,0,0],[.75,-.003,0],[1,0,0]];
  if (!effect.flow) return null;
  const angle=direction*Math.PI/180, [x,y]=effect.flow;
  return [[0,0,0],[x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle),0]];
}
function layerVisibility(layer, source, options, duration) {
  if(options.pulse===0 && options.opacity===1)return;
  if (options.pulse>0) {
    layer.Alpha=loop(source,duration,[[options.opacity],[options.opacity*(1-options.pulse)],[options.opacity]]);
  } else if (options.opacity!==1 && layer.Alpha?.Keys) {
    for (const key of layer.Alpha.Keys) for (const field of ['Vector','InTan','OutTan']) {
      if (key[field]) key[field]=Float32Array.from(key[field],v=>v*options.opacity);
    }
  } else if (!layer.Alpha?.Keys) layer.Alpha=(layer.Alpha??1)*options.opacity;
}
function applyMaterial(model, geometry, originalMaterial, source, effect, options, duration) {
  // Own materials already use destination IDs. Only the chosen material needs a copy.
  if((effect.own||options.mode==='overlay')&&!originalMaterial?.Layers?.length)throw Error('Select a geoset with a material or choose Replace with a native effect.');
  let material=effect.own?structuredClone(originalMaterial):source.Materials[0];
  const coord=effectCoordinates(geometry,effect,options);
  const translation=surfaceTranslation(effect,options.direction);
  if (translation) {
    const animation=reuse(source.TextureAnims,{Translation:loop(source,duration,translation)});
    for(const layer of material.Layers)layer.TVertexAnimId=animation;
  }
  for(const layer of material.Layers) {
    if(!effect.own && layer.Alpha?.Keys && !hasClock(layer.Alpha))layer.Alpha=1;
    layerVisibility(layer,source,options,duration);
    if(coord!==null)layer.CoordId=coord;
    if(options.mode==='overlay'){
      layer.FilterMode=effect.overlayFilter??3;
      layer.Shading=(layer.Shading||0)|16;
    }
  }
  if(!effect.own)material=createResourceImporter(source,model,{
    reuseTextures:effect.textureReuse??'partKey',reuseGlobals:true,reuseTextureAnims:true,
  }).remapMaterial(material);
  if(options.mode==='overlay') {
    const combined=structuredClone(originalMaterial);
    for(const layer of material.Layers)if(!combined.Layers.some(existing=>stableKey(existing)===stableKey(layer)))combined.Layers.push(layer);
    material=combined;
  }
  geometry.MaterialID=reuse(model.Materials,material);
}
function applyGeosetAppearance(model,index,effect,options,duration) {
  let animation=model.GeosetAnims.find(a=>a.GeosetId===index);
  const tint=options.tintPulse || options.tint.some(v=>v!==1) || (options.setTint && (animation?.Flags & 2));
  // A local Death/Decay alpha stays on the geoset. Its material can supply
  // the independent global pulse. A free alpha channel needs no new material.
  const localGate=animation?.Alpha?.Keys && !hasClock(animation.Alpha);
  const fade=effect.visibilityPulse && options.mode!=='overlay' && !localGate;
  if(!tint&&!fade)return false;
  if(!animation){animation={GeosetId:index,Alpha:1,Flags:0};model.GeosetAnims.push(animation);}
  if(fade){
    const peak=options.opacity*(typeof animation.Alpha==='number'?animation.Alpha:1);
    animation.Alpha=options.pulse>0?loop(model,duration,[[peak],[peak*(1-options.pulse)],[peak]]):peak;
  }
  if(!tint)return fade;
  const base=(animation.Flags & 2) && animation.Color ? animation.Color : [1,1,1];
  animation.Flags|=2;
  if(options.tintPulse){
    const start=base.Keys?.[0]?.Vector??base;
    animation.Color=loop(model,duration,[start,options.tint,start]);
  }else if(base.Keys){
    for(const key of base.Keys)for(const field of ['Vector','InTan','OutTan'])if(key[field])key[field]=Float32Array.from(key[field],(v,i)=>v*options.tint[i]);
  }else animation.Color=Float32Array.from(options.tint);
  return fade;
}
export function applySurfaceEffect(model,pack,effect,options,{preview=false}={}) {
  const original=model.Geosets[options.geoset];
  if(!original)throw Error('Select a geoset.');
  if(options.mode==='new'&&model.BindPoses?.length)throw Error('New geoset requires a model without bind-pose matrices.');
  if(!Number.isFinite(options.speed)||options.speed<=0)throw Error('Choose a positive speed.');
  const duration=Math.max(100,Math.round((effect.duration??2000)/options.speed));
  const source=effect.own?model:adjustedPackage(pack,model.Version,effect,options.speed);
  const {index,anchorId}=options.mode==='new'?newSurface(model,original,source,effect,options,preview):{index:options.geoset,anchorId:null};
  const geosetVisibility=applyGeosetAppearance(model,index,effect,options,duration);
  const materialOptions=geosetVisibility?{...options,opacity:1,pulse:0}:options;
  applyMaterial(model,model.Geosets[index],model.Materials[original.MaterialID],source,effect,materialOptions,duration);
  return {geoset:index,anchorId};
}
