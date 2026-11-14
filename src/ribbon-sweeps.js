import {createNode} from './editor-document.js';
import {extractParticleRecipe} from './particle-recipes.js';
import {RIBBON_TEXTURE} from './particle-starters.js';

// Elemental sweeps for Add ribbon: the fitted weapon ribbon, tinted, plus ordinary
// particle emitters spread along the same edge. Everything is stock Warcraft III art,
// used the way Blizzard's own effects use it (filter, atlas and colours over life).
// Additive (1) for pictures on black, Blend (0) only for pictures with their own alpha.
const T='Textures\\';
const UNSHADED=32768,HEAD=1,BOTH=3;
const atlas=(rows,frames)=>({Rows:rows,Columns:rows,LifeSpanUVAnim:new Uint32Array([0,frames/2-1,1]),DecayUVAnim:new Uint32Array([frames/2,frames-1,1])});
// Sizes, speeds and gravity are written for a 60-unit edge and follow the fitted length.
const SWEEPS={
 fire:{label:'Fire',ribbon:{Color:[1,.42,.06],Alpha:.6,LifeSpan:.35},emitters:[
  {Name:'Fire sweep flames',texture:T+'Clouds8x8Fire.blp',...atlas(8,64),LifeSpan:.45,EmissionRate:90,Speed:12,Variation:.5,Latitude:180,Gravity:-60,Time:.35,scale:[6,10,5],colors:[[1,.86,.36],[1,.4,.05],[.5,.1,0]],Alpha:[255,210,0]},
  {Name:'Fire sweep embers',texture:T+'LavaLump2.blp',LifeSpan:.7,EmissionRate:40,Speed:45,Variation:.6,Latitude:180,Gravity:110,Time:.3,scale:[2.4,1.9,.6],colors:[[1,1,.31],[.98,.67,.01],[.87,.25,.12]],Alpha:[255,255,0]}]},
 frost:{label:'Frost',ribbon:{Color:[.5,.82,1],Alpha:.5,LifeSpan:.4},emitters:[
  {Name:'Frost sweep mist',texture:T+'Clouds8x8Fade.blp',...atlas(8,64),LifeSpan:.65,EmissionRate:50,Speed:8,Variation:.5,Latitude:180,Gravity:25,Time:.3,scale:[8,12,15],colors:[[.78,.92,1],[.42,.72,1],[.2,.45,1]],Alpha:[120,95,0]},
  {Name:'Frost sweep flakes',texture:T+'snowflake.blp',LifeSpan:.85,EmissionRate:45,Speed:30,Variation:.6,Latitude:180,Gravity:95,Time:.3,scale:[3,2.6,.8],colors:[[1,1,1],[.51,.78,1],[.33,.71,.98]],Alpha:[255,255,0]}]},
 lightning:{label:'Lightning',ribbon:{Color:[.55,.75,1],Alpha:.55,LifeSpan:.2},emitters:[
  {Name:'Lightning sweep sparks',texture:T+'Zap1.blp',FrameFlags:BOTH,TailLength:.5,LifeSpan:.25,EmissionRate:70,Speed:140,Variation:.5,Latitude:180,Gravity:0,Time:.3,scale:[5,7,1.5],colors:[[1,1,1],[.6,.82,1],[.3,.42,1]],Alpha:[75,255,0]},
  {Name:'Lightning sweep flashes',texture:T+'Blue_Star2.blp',LifeSpan:.22,EmissionRate:30,Speed:0,Variation:0,Latitude:180,Gravity:0,Time:.3,scale:[5,10,1],colors:[[1,1,1],[.7,.85,1],[.4,.5,1]],Alpha:[85,255,0]}]},
 spirit:{label:'Spirit',ribbon:{Color:[.6,.95,.9],Alpha:.45,LifeSpan:.5},emitters:[
  {Name:'Spirit sweep wisps',texture:T+'Clouds8x8Fade.blp',...atlas(8,64),LifeSpan:.9,EmissionRate:40,Speed:10,Variation:.5,Latitude:180,Gravity:-35,Time:.3,scale:[7,11,15],colors:[[.72,1,.95],[.3,.9,.82],[.15,.4,.62]],Alpha:[135,105,0]},
  {Name:'Spirit sweep motes',texture:T+'GenericGlowFaded.blp',LifeSpan:.9,EmissionRate:25,Speed:20,Variation:.6,Latitude:180,Gravity:-50,Time:.3,scale:[2.8,2.4,.4],colors:[[1,1,1],[.45,.94,.86],[.27,.7,.92]],Alpha:[255,210,0]}]},
 fel:{label:'Fel',ribbon:{Color:[.35,1,.1],Alpha:.55,LifeSpan:.35},emitters:[
  {Name:'Fel sweep flames',texture:T+'Clouds8x8Fire.blp',...atlas(8,64),LifeSpan:.45,EmissionRate:90,Speed:12,Variation:.5,Latitude:180,Gravity:-60,Time:.35,scale:[6,10,5],colors:[[.82,1,.42],[.26,.92,.05],[.05,.36,0]],Alpha:[255,210,0]},
  {Name:'Fel sweep embers',texture:T+'LavaLump2.blp',LifeSpan:.7,EmissionRate:40,Speed:45,Variation:.6,Latitude:180,Gravity:110,Time:.3,scale:[2.4,1.9,.6],colors:[[.8,1,.4],[.34,.96,.02],[.1,.6,0]],Alpha:[255,255,0]}]},
 shadow:{label:'Shadow',ribbon:{Color:[.45,.12,.9],Alpha:.5,LifeSpan:.4},emitters:[
  {Name:'Shadow sweep smoke',texture:T+'Clouds8x8Black.blp',FilterMode:0,...atlas(8,64),LifeSpan:.8,EmissionRate:40,Speed:10,Variation:.5,Latitude:180,Gravity:-20,Time:.3,scale:[7,12,17],colors:[[.51,.51,.51],[.29,.29,.29],[.13,.13,.13]],Alpha:[197,147,0]},
  {Name:'Shadow sweep motes',texture:T+'Purple_Star.blp',LifeSpan:.6,EmissionRate:30,Speed:25,Variation:.6,Latitude:180,Gravity:-20,Time:.3,scale:[3,5,.5],colors:[[.85,.6,1],[.55,.2,1],[.3,.05,.6]],Alpha:[120,255,0]}]},
 holy:{label:'Holy',ribbon:{Color:[1,.85,.42],Alpha:.5,LifeSpan:.4},emitters:[
  {Name:'Holy sweep stars',texture:T+'Yellow_Star_Dim.blp',LifeSpan:.65,EmissionRate:50,Speed:25,Variation:.6,Latitude:180,Gravity:-30,Time:.3,scale:[2,6,.4],colors:[[1,1,1],[1,.95,.75],[1,.8,.35]],Alpha:[22,255,0]},
  {Name:'Holy sweep glints',texture:T+'Sparkle_Anim.blp',...atlas(4,16),LifeSpan:.4,EmissionRate:25,Speed:15,Variation:.5,Latitude:180,Gravity:0,Time:.3,scale:[5,4,0],colors:[[.98,1,.71],[1,.63,.24],[.6,.3,.1]],Alpha:[228,170,0]}]},
 arcane:{label:'Arcane',ribbon:{Color:[.75,.32,1],Alpha:.5,LifeSpan:.4},emitters:[
  {Name:'Arcane sweep stars',texture:T+'Blue_Star2.blp',LifeSpan:.5,EmissionRate:45,Speed:30,Variation:.6,Latitude:180,Gravity:0,Time:.3,scale:[3.5,6,.5],colors:[[.48,.02,1],[1,1,1],[.8,.6,1]],Alpha:[85,255,0]},
  {Name:'Arcane sweep glow',texture:T+'Star8c.blp',LifeSpan:.4,EmissionRate:25,Speed:0,Variation:0,Latitude:180,Gravity:0,Time:.3,scale:[5,9,1],colors:[[1,1,1],[.7,.35,1],[.47,.05,1]],Alpha:[60,200,0]}]},
 blood:{label:'Blood',ribbon:{Color:[.75,.02,.02],Alpha:.5,LifeSpan:.35},emitters:[
  {Name:'Blood sweep drops',texture:T+'BloodWhiteSmall.blp',FilterMode:0,FrameFlags:BOTH,TailLength:.15,LifeSpan:.8,EmissionRate:70,Speed:70,Variation:.6,Latitude:180,Gravity:480,Time:.25,scale:[6,3,0],colors:[[.6,.08,.08],[.52,.1,.1],[.3,.02,.08]],Alpha:[255,200,0]}]},
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
 const size=clamp(fit.length/REACH,.6,2.5),amount=clamp(fit.length/REACH,.7,2),ids=[ribbon.ObjectId];
 for(const {texture,scale,colors,Alpha,...look} of sweep.emitters){
  let TextureID=model.Textures.findIndex(item=>item.Image===texture);
  if(TextureID<0)TextureID=model.Textures.push({Image:texture,ReplaceableId:0,Flags:0})-1;
  const node=createNode(model,'ParticleEmitter2');
  Object.assign(node,{FrameFlags:HEAD,...look,TextureID,Flags:node.Flags|UNSHADED,
   // Spread along the fitted edge: the emitter shares the ribbon's turn, whose Y runs along the weapon.
   Width:fit.length*.03,Length:fit.length*.46,
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
