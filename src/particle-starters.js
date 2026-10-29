import { createNode } from './editor-document.js';
import { emptyParticleModel, extractParticleRecipe } from './particle-recipes.js';
import { gamePathKey } from './game-path.js';
// Stock Warcraft III pictures, read from the player's own game data like every other
// native texture. MDLxL never generates or bundles effect pictures.
export const STARTER_TEXTURE = 'Textures\\GenericGlow64.blp';
export const RIBBON_TEXTURE = 'Textures\\RibbonNE1_White.blp';
export const STARTER_TEXTURES = [STARTER_TEXTURE, RIBBON_TEXTURE];
// Pictures earlier versions generated beside the model, with their stock replacements
// (including Forge's HD helper maps, now forge.js HD_NEUTRAL_MAPS).
const LEGACY_STARTER_TEXTURES = {'mdlxl_forge\\particle_softdisc_v1':STARTER_TEXTURE,'mdlxl_forge\\ribbon_softtrail_v1':RIBBON_TEXTURE,
  'mdlxl_forge\\mdlxl-flat-normal-v1':'Textures\\normal.dds','mdlxl_forge\\mdlxl-neutral-orm-v1':'Textures\\orm.dds','mdlxl_forge\\mdlxl-black-emissive-v1':'Textures\\black32.dds'};
export const nativeStarterTexture=image=>LEGACY_STARTER_TEXTURES[gamePathKey(image).replace(/\.(tga|blp|dds)$/,'')];
/** Points textures still using an old generated starter picture at the stock one. Returns whether anything changed. */
export function repointStarterTextures(model){
  let changed=false;
  for(const texture of model?.Textures||[]){const image=nativeStarterTexture(texture.Image);if(image){texture.Image=image;changed=true;}}
  return changed;
}
export const PARTICLE_STARTERS=[['sparks','Soft sparks'],['smoke','Soft smoke'],['glow','Magic glow'],['impact','Impact burst'],['streak','Weapon streak'],['ribbon','Ribbon trail']];
export function createStarterRecipe(kind='sparks') {
  const model=emptyParticleModel();
  model.Sequences=[{Name:'Preview',Interval:new Uint32Array([0,5000]),NonLooping:false,MoveSpeed:0,Rarity:0,MinimumExtent:new Float32Array([-64,-64,-16]),MaximumExtent:new Float32Array([64,64,128]),BoundsRadius:120}];
  model.Textures=[{Image:STARTER_TEXTURE,ReplaceableId:0,Flags:0}];
  const p=createNode(model,'ParticleEmitter2');p.Name='Soft sparks';p.LifeSpan=2;p.Speed=45;p.EmissionRate=28;p.Width=8;p.Length=8;p.Latitude=30;p.ParticleScaling=new Float32Array([3,8,0]);
  let ids=[p.ObjectId],category='Sparks';
  const colors=(...rgb)=>Array.from({length:3},()=>new Float32Array(rgb));
  if(kind==='smoke'){category='Smoke';Object.assign(p,{Name:'Soft smoke',FilterMode:0,LifeSpan:4,Speed:14,Gravity:-2,EmissionRate:12,Latitude:15,Width:12,Length:12,ParticleScaling:new Float32Array([5,18,35]),Alpha:new Uint8Array([45,100,0]),SegmentColor:colors(.5,.53,.58)});}
  if(kind==='glow'){category='Glows';Object.assign(p,{Name:'Glow accent',LifeSpan:1,Speed:0,EmissionRate:18,Width:0,Length:0,ParticleScaling:new Float32Array([4,12,0]),SegmentColor:colors(.22,.4,1)});const core=createNode(model,'ParticleEmitter2');Object.assign(core,{Name:'Glow core',LifeSpan:1,Speed:0,EmissionRate:10,Width:0,Length:0,ParticleScaling:new Float32Array([1,3,0]),SegmentColor:colors(.7,.85,1)});ids.push(core.ObjectId);}
  if(kind==='impact'){category='Bursts';Object.assign(p,{Name:'Impact sparks',Squirt:true,LifeSpan:.7,Speed:100,Latitude:85,Width:0,Length:0,Gravity:50,ParticleScaling:new Float32Array([2,3,0]),SegmentColor:colors(1,.65,.12),EmissionRate:{LineType:0,GlobalSeqId:null,Keys:[[0,0],[600,30],[601,0],[5000,0]].map(([Frame,n])=>({Frame,Vector:new Float32Array([n])}))}});}
  if(kind==='streak'){category='Trails';Object.assign(p,{Name:'Weapon streak',FrameFlags:2,TailLength:.18,LifeSpan:.3,Speed:100,Latitude:3,Width:2,Length:2,ParticleScaling:new Float32Array([2,3,0])});}
  if(kind==='ribbon'){category='Trails';model.ParticleEmitters2=[];model.Nodes=[];model.PivotPoints=[];model.Materials=[{RenderMode:0,PriorityPlane:0,Layers:[{FilterMode:4,Shading:17,TextureID:0,CoordId:0,Alpha:1}]}];model.Textures[0].Image=RIBBON_TEXTURE;const ribbon=createNode(model,'RibbonEmitter');Object.assign(ribbon,{Name:'Ribbon trail',Visibility:1,EmissionRate:45,LifeSpan:.5});ids=[ribbon.ObjectId];}
  const label=PARTICLE_STARTERS.find(([id])=>id===kind)?.[1]||'Soft sparks';
  const recipe=extractParticleRecipe(model,ids,{id:'mdlxl-'+kind,name:'MDLxL starter · '+label,categories:[category],tags:[kind,'original']});
  recipe.naming={state:'original'};recipe.sources=[{creator:'MDLxL',license:'CC0-1.0',original:true}];
  return recipe;
}
