import {createNode} from './editor-document.js';
import {extractParticleRecipe} from './particle-recipes.js';
import {RIBBON_TEXTURE,STARTER_TEXTURE} from './particle-starters.js';

// Elemental sweeps for Add ribbon: the fitted weapon ribbon, tinted, plus ordinary
// particle emitters spread along the same edge. Everything is stock Warcraft III art,
// used the way Blizzard's own effects use it (filter, atlas and colours over life).
// Additive (1) for pictures on black, Blend (0) only for pictures with their own alpha.
const T='Textures\\';
const UNSHADED=32768,HEAD=1,BOTH=3;
const atlas=(rows,frames)=>({Rows:rows,Columns:rows,LifeSpanUVAnim:new Uint32Array([0,frames/2-1,1]),DecayUVAnim:new Uint32Array([frames/2,frames-1,1])});
// Sizes, speeds and gravity are written for a 60-unit edge and follow the fitted length.
const SWEEPS={
 fire:{label:'Fire',ribbon:{Color:[1,.42,.06],Alpha:.5,LifeSpan:.3},emitters:[
  {Name:'Fire sweep flames',texture:T+'Clouds8x8Fire.blp',...atlas(8,64),LifeSpan:.4,EmissionRate:75,Speed:28,Variation:.8,Latitude:180,Gravity:-70,Time:.35,scale:[6,10.5,6],colors:[[1,.72,.22],[1,.4,.05],[.5,.1,0]],Alpha:[210,200,0]},
  {Name:'Fire sweep embers',texture:T+'LavaLump2.blp',LifeSpan:.7,EmissionRate:35,Speed:55,Variation:.8,Latitude:180,Gravity:110,Time:.3,scale:[2.4,1.9,.6],colors:[[1,1,.31],[.98,.67,.01],[.87,.25,.12]],Alpha:[255,255,0]}]},
 frost:{label:'Frost',ribbon:{Color:[.5,.82,1],Alpha:.5,LifeSpan:.4},emitters:[
  {Name:'Frost sweep mist',texture:T+'Clouds8x8Fade.blp',...atlas(8,64),LifeSpan:.65,EmissionRate:50,Speed:8,Variation:.5,Latitude:180,Gravity:25,Time:.3,scale:[8,12,15],colors:[[.78,.92,1],[.42,.72,1],[.2,.45,1]],Alpha:[120,95,0]},
  {Name:'Frost sweep flakes',texture:T+'snowflake.blp',LifeSpan:.85,EmissionRate:45,Speed:30,Variation:.6,Latitude:180,Gravity:95,Time:.3,scale:[3,2.6,.8],colors:[[1,1,1],[.51,.78,1],[.33,.71,.98]],Alpha:[255,255,0]}]},
 lightning:{label:'Lightning',ribbon:{Color:[.55,.75,1],Alpha:.55,LifeSpan:.2},emitters:[
  {Name:'Lightning sweep forks',texture:T+'Zap1.blp',FrameFlags:BOTH,TailLength:.35,LifeSpan:.2,EmissionRate:45,Speed:120,Variation:.6,Latitude:180,Gravity:0,Time:.3,scale:[3,4.5,1],colors:[[1,1,1],[.6,.82,1],[.3,.42,1]],Alpha:[140,255,0]},
  {Name:'Lightning sweep flashes',texture:T+'Blue_Star2.blp',LifeSpan:.2,EmissionRate:18,Speed:0,Variation:0,Latitude:180,Gravity:0,Time:.3,scale:[4,8,1],colors:[[1,1,1],[.7,.85,1],[.4,.5,1]],Alpha:[85,230,0]}]},
 spirit:{label:'Spirit',ribbon:{Color:[.4,1,.68],Alpha:.35,LifeSpan:.5},emitters:[
  {Name:'Spirit sweep wisps',texture:T+'Clouds8x8Fade.blp',...atlas(8,64),LifeSpan:.9,EmissionRate:35,Speed:10,Variation:.5,Latitude:180,Gravity:-70,Time:.3,scale:[6,9,12],colors:[[.7,1,.82],[.3,.95,.6],[.1,.5,.4]],Alpha:[125,95,0]},
  {Name:'Spirit sweep motes',texture:STARTER_TEXTURE,LifeSpan:1,EmissionRate:28,Speed:18,Variation:.6,Latitude:180,Gravity:-95,Time:.3,scale:[2.6,2.2,.4],colors:[[1,1,.95],[.5,1,.72],[.2,.8,.6]],Alpha:[255,220,0]}]},
 fel:{label:'Fel',ribbon:{Color:[.5,1,.08],Alpha:.5,LifeSpan:.3},emitters:[
  {Name:'Fel sweep flames',texture:T+'Flame4.blp',LifeSpan:.5,EmissionRate:60,Speed:22,Variation:.8,Latitude:180,Gravity:-150,Time:.3,scale:[4.5,6,.5],colors:[[.9,1,.5],[.3,.95,.05],[.04,.4,0]],Alpha:[220,220,0]},
  {Name:'Fel sweep embers',texture:T+'LavaLump2.blp',LifeSpan:.8,EmissionRate:22,Speed:60,Variation:.8,Latitude:180,Gravity:90,Time:.3,scale:[3,2.2,.6],colors:[[.9,1,.5],[.4,1,.05],[.1,.6,0]],Alpha:[255,255,0]}]},
 shadow:{label:'Shadow',ribbon:{Color:[.42,.1,.9],Alpha:.5,LifeSpan:.4},emitters:[
  {Name:'Shadow sweep smoke',texture:T+'Clouds8x8Black.blp',FilterMode:0,...atlas(8,64),LifeSpan:.45,EmissionRate:30,Speed:10,Variation:.5,Latitude:180,Gravity:-20,Time:.4,scale:[5,8,10],colors:[[.51,.51,.51],[.29,.29,.29],[.13,.13,.13]],Alpha:[150,70,0]},
  {Name:'Shadow sweep motes',texture:T+'Purple_Star.blp',LifeSpan:.6,EmissionRate:30,Speed:25,Variation:.6,Latitude:180,Gravity:-20,Time:.3,scale:[3,5,.5],colors:[[.8,.55,1],[.5,.15,1],[.25,.03,.6]],Alpha:[120,255,0]}]},
 holy:{label:'Holy',ribbon:{Color:[1,.85,.42],Alpha:.5,LifeSpan:.4},emitters:[
  {Name:'Holy sweep stars',texture:T+'Yellow_Star_Dim.blp',LifeSpan:.65,EmissionRate:50,Speed:25,Variation:.6,Latitude:180,Gravity:-30,Time:.3,scale:[2,6,.4],colors:[[1,1,1],[1,.95,.75],[1,.8,.35]],Alpha:[22,255,0]},
  {Name:'Holy sweep glints',texture:T+'Sparkle_Anim.blp',...atlas(4,16),LifeSpan:.4,EmissionRate:25,Speed:15,Variation:.5,Latitude:180,Gravity:0,Time:.3,scale:[5,4,0],colors:[[.98,1,.71],[1,.63,.24],[.6,.3,.1]],Alpha:[228,170,0]}]},
 arcane:{label:'Arcane',ribbon:{Color:[1,.3,.78],Alpha:.45,LifeSpan:.4},emitters:[
  {Name:'Arcane sweep stars',texture:T+'Blue_Star2.blp',LifeSpan:.55,EmissionRate:55,Speed:30,Variation:.6,Latitude:180,Gravity:0,Time:.3,scale:[3,7,.5],colors:[[1,.4,.85],[1,1,1],[.55,.7,1]],Alpha:[85,255,0]},
  {Name:'Arcane sweep glow',texture:T+'Star8c.blp',LifeSpan:.4,EmissionRate:20,Speed:0,Variation:0,Latitude:180,Gravity:0,Time:.3,scale:[5,9,1],colors:[[1,1,1],[1,.4,.8],[.9,.1,.6]],Alpha:[60,190,0]}]},
 blood:{label:'Blood',ribbon:{Color:[1,.07,.04],Alpha:.6,LifeSpan:.3},emitters:[
  {Name:'Blood sweep drops',texture:T+'BloodWhiteSmall.blp',FilterMode:0,LifeSpan:.6,EmissionRate:60,Speed:55,Variation:.7,Latitude:180,Gravity:520,Time:.25,scale:[4.5,3.6,1.2],colors:[[.9,.06,.05],[.72,.04,.04],[.4,.02,.05]],Alpha:[255,235,0]}]},
};
/** [id, name] for the Add ribbon choice. Plain is the ribbon alone, exactly as before. */
export const RIBBON_SWEEPS=[['plain','Plain'],...Object.entries(SWEEPS).map(([id,sweep])=>[id,sweep.label])];
export const SWEEP_TEXTURES=[...new Set(Object.values(SWEEPS).flatMap(sweep=>sweep.emitters.map(emitter=>emitter.texture)))];
const REACH=60,clamp=(value,low,high)=>Math.min(high,Math.max(low,value));

/**
 * The fitted ribbon with a sweep chosen. `fit` comes from fitRibbonToPolygons (or an
 * earlier call here). Plain hands back the fitted recipe untouched; any other sweep
 * builds a recipe of that ribbon plus emitters lying along the same edge.
 */
export function sweepRibbonFit(fit,kind='plain'){
 const plain=fit.plain||fit.recipe;
 if(kind==='plain')return {...fit,plain,sweep:'plain',recipe:plain};
 const sweep=SWEEPS[kind];if(!sweep)throw Error('Unknown sweep.');
 const model=structuredClone(plain.native),ribbon=model.RibbonEmitters[0];
 Object.assign(ribbon,{Name:sweep.label+' sweep',Color:new Float32Array(sweep.ribbon.Color),Alpha:sweep.ribbon.Alpha,LifeSpan:sweep.ribbon.LifeSpan});
 const size=clamp((fit.length/REACH)**.6,.8,1.6),amount=clamp(fit.length/REACH,.85,1.6),ids=[ribbon.ObjectId];
 for(const {texture,scale,colors,Alpha,...look} of sweep.emitters){
  let TextureID=model.Textures.findIndex(item=>item.Image===texture);
  if(TextureID<0)TextureID=model.Textures.push({Image:texture,ReplaceableId:0,Flags:0})-1;
  const node=createNode(model,'ParticleEmitter2');
  Object.assign(node,{FrameFlags:HEAD,...look,TextureID,Flags:node.Flags|UNSHADED,
   // Spread along the fitted edge: the emitter shares the ribbon's turn, whose Y runs along the weapon.
   Width:fit.length*.06,Length:fit.length*.46,
   Speed:look.Speed*size,Gravity:look.Gravity*size,EmissionRate:Math.round(look.EmissionRate*amount),
   ParticleScaling:new Float32Array(scale.map(value=>value*size)),SegmentColor:colors.map(color=>new Float32Array(color)),Alpha:new Uint8Array(Alpha),
   Rotation:structuredClone(ribbon.Rotation)});
  node.PivotPoint=new Float32Array(ribbon.PivotPoint);model.PivotPoints[node.ObjectId]=node.PivotPoint;
  ids.push(node.ObjectId);
 }
 const recipe=extractParticleRecipe(model,ids,{id:'weapon-sweep-'+kind,name:sweep.label+' sweep',categories:plain.categories,tags:[kind,'sweep'],sources:plain.sources});
 recipe.naming=structuredClone(plain.naming);
 // The ribbon stays first, so it is the part selected after Create, as with Plain.
 recipe.ingredients.sort((a,b)=>(b.family==='RibbonEmitters')-(a.family==='RibbonEmitters'));
 return {...fit,plain,sweep:kind,recipe};
}
export const sweepTextures=()=>[RIBBON_TEXTURE,...SWEEP_TEXTURES];
