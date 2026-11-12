// The user's own FX looks: a stack kept under a name, refitted to any part, shared as a file. DOM-free.
import {sanitizePresetName} from './settings-presets.js';
import {layerBasis,LAYER_UNIT_FALLBACK} from './fx-layer-basis.js';
import {boundedCard,cardSize} from './fx-cards.js';
import {surfaceFitInputs,SURFACE_FIT_VERSION} from './fx-emitter-surface.js';

export const MAX_OWN_LOOKS=200,MAX_OWN_LAYERS=32,MAX_OWN_LOOK_BYTES=256*1024;
export const OWN_LOOK_SCHEMA='mdlxl-fx-look',OWN_LOOK_ID=/^own-[a-z0-9-]{1,64}$/;
export const NOT_A_LOOK='This file is not an FX look.';
const BLOCKED=new Set(['__proto__','constructor','prototype']),BAD=Symbol('bad');
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
// Deep copy of JSON data only: nothing with a prototype, no non-finite numbers, no prototype keys.
function clean(v,depth=0){
 if(depth>16)throw BAD;
 if(v===null||typeof v==='boolean')return v;
 if(typeof v==='string'){if(v.length>4096)throw BAD;return v;}
 if(typeof v==='number'){if(!Number.isFinite(v))throw BAD;return v;}
 if(Array.isArray(v)){if(v.length>5000)throw BAD;return v.map(x=>clean(x,depth+1));}
 if(plain(v)){const out={};for(const [key,value] of Object.entries(v)){if(BLOCKED.has(key)||value===undefined)continue;out[key]=clean(value,depth+1);}return out;}
 throw BAD;
}
/** One saved look, or null when anything about it is invalid. */
export function normalizeOwnLook(item){
 try{
  if(!plain(item)||typeof item.id!=='string'||!OWN_LOOK_ID.test(item.id))return null;
  const name=sanitizePresetName(item.name);if(!name)return null;
  if(typeof item.loop!=='number'||!Number.isFinite(item.loop)||item.loop<100||item.loop>60000)return null;
  if(!Array.isArray(item.layers)||item.layers.length>MAX_OWN_LAYERS||!plain(item.frame))return null;
  const frame={};for(const key of ['length','girth','radius']){const v=item.frame[key];if(typeof v!=='number'||!Number.isFinite(v)||v<0)return null;frame[key]=v;}
  if(!(frame.length>0))return null;
  const layers=item.layers.map(layer=>{if(!plain(layer)||!Number.isInteger(layer.id)||typeof layer.type!=='string')throw BAD;const kept=clean(layer);if(kept.orbit!=null){kept.orbit=kept.orbit===true;if('orbitTurns' in kept)kept.orbitTurns=typeof kept.orbitTurns==='number'?Math.max(1,Math.min(8,Math.round(kept.orbitTurns))):1;if('orbitRadius' in kept)kept.orbitRadius=typeof kept.orbitRadius==='number'?Math.max(0,Math.min(100000,kept.orbitRadius)):0;}return kept.type==='Card'?boundedCard(kept):kept;});
  const look={id:item.id,name,loop:Math.round(item.loop),...(typeof item.asOverlay==='boolean'?{asOverlay:item.asOverlay}:{}),...(typeof item.variation==='string'&&item.variation.length<=64?{variation:item.variation}:{}),frame,layers};
  return JSON.stringify(look).length>MAX_OWN_LOOK_BYTES?null:look;
 }catch(error){if(error===BAD)return null;throw error;}
}
/** The saved list: invalid looks are dropped, repeated ids and names keep the first, at most MAX_OWN_LOOKS. */
export function normalizeOwnLooks(value){
 const out=[],ids=new Set(),names=new Set();
 if(!Array.isArray(value))return out;
 for(const item of value){
  if(out.length>=MAX_OWN_LOOKS)break;
  const look=normalizeOwnLook(item);
  if(!look||ids.has(look.id)||names.has(look.name.toLowerCase()))continue;
  ids.add(look.id);names.add(look.name.toLowerCase());out.push(look);
 }
 return out;
}
/** `own-<name>` with a number added when the id is taken. */
export function ownLookId(name,taken=[]){
 const slug=sanitizePresetName(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48)||'look',used=new Set(taken);
 let id='own-'+slug,n=1;
 while(used.has(id))id='own-'+slug+'-'+(++n);
 return id;
}
/** Keep a stack as a look. Everything that belongs to one model (owner, base material, clocks, group, attack timing) stays behind, and so does the value the compile step writes back onto each layer (unitAlphaPeak). */
export function ownLookFrom(stack,frame,name){
 const {length,girth,radius}=layerBasis(frame),layers=structuredClone(stack.layers);
 for(const layer of layers){
  delete layer.unitAlphaPeak;
  delete layer.emitterState;
 }
 return {id:ownLookId(name),name:sanitizePresetName(name)||'Custom look',loop:stack.loop,...(stack.asOverlay!=null?{asOverlay:stack.asOverlay}:{}),...(stack.variation!=null?{variation:stack.variation}:{}),frame:{length,girth,radius},layers};
}
const ratio=(from,to)=>from>0&&to>0?to/from:1;
const scaleNumbers=(list,k)=>Array.isArray(list)?list.map(x=>typeof x==='number'?x*k:x):list;
// A plain number, or a track of plain keys; any other shape stays as it is.
function scaleValue(v,k){
 if(typeof v==='number')return v*k;
 if(plain(v)&&Array.isArray(v.Keys))return {...v,Keys:v.Keys.map(key=>plain(key)?{...key,...(key.Vector?{Vector:scaleNumbers(key.Vector,k)}:{}),...(key.InTan?{InTan:scaleNumbers(key.InTan,k)}:{}),...(key.OutTan?{OutTan:scaleNumbers(key.OutTan,k)}:{})}:key)};
 return v;
}
/** A stack for another part. Model-unit sizes follow the part: offsets, speeds and gravity by the unit ratio, the emitter sizes by the same formulas makeLayer uses, the strip ends by the length ratio. Angles, colours, counts, times and picture fields stay. */
export function stackFromOwnLook(record,frame,owner){
 const was=layerBasis(record.frame),now=layerBasis(frame),k=ratio(was.unit,now.unit),r=ratio(was.length,now.length);
 const sizeOf=(basis,l)=>l.type==='Card'?cardSize(basis):l.type==='Rune'?basis.runeSize:l.swarm?basis.swarmRadius:l.kind==='flies'?basis.flySize:(basis.properties[l.kind]||LAYER_UNIT_FALLBACK)[5];
 const spriteOf=(basis,l)=>(basis.properties[l.kind]||LAYER_UNIT_FALLBACK)[5];
 const layers=structuredClone(record.layers).map(l=>{
  const size=ratio(sizeOf(was,l),sizeOf(now,l)),sprite=ratio(spriteOf(was,l),spriteOf(now,l)),moving=l.type==='Particles'||l.type==='Edge';
  const next={...l};
  if(Array.isArray(l.offset))next.offset=scaleNumbers(l.offset,k);
  if(typeof l.orbitRadius==='number')next.orbitRadius=l.orbitRadius*k;
  for(const key of ['upper','lower'])if(typeof l[key]==='number')next[key]=l[key]*r;
  if(moving)for(const key of ['velocity','gravity'])if(typeof l[key]==='number')next[key]=l[key]*k;
  if(typeof l.size==='number')next.size=l.size*size;
  // A fly swarm's fly size follows the unit, not the part: it stays.
  if(typeof l.spriteSize==='number'&&!l.swarm)next.spriteSize=l.spriteSize*sprite;
  if(plain(l.native)){
   next.native={...l.native};
   for(const key of ['Speed','Gravity','Width','Length'])if(key in next.native)next.native[key]=scaleValue(next.native[key],k);
   if(Array.isArray(next.native.ParticleScaling))next.native.ParticleScaling=scaleNumbers(next.native.ParticleScaling,l.kind==='flies'?sprite:size);
  }
  if(next.siteLayout){
   // Refit automatic slots in a different model. An explicit point keeps its
   // layout, but a triangle binding belongs only to its source model.
   next.siteLayout=next.siteLayout.map(({surface:_surface,attachmentPoint:_anchor,fireFit:_fireFit,...site})=>{
    if(next.siteCount!=null&&site.refit)delete site.point;
    return site;
   });
  }
  delete next.emitterState;
  for(const individual of Object.values(next.individuals||{})){
   delete individual.surface;
   delete individual.attachmentPoint;
  }
  if(next.surfaceFit?.version===SURFACE_FIT_VERSION&&(!next.siteLayout||next.siteLayout.some(site=>site.refit)))
   next.surfaceFit=surfaceFitInputs(next,now);
  return next;
 });
 return {owner,look:record.id,name:record.name,loop:record.loop,...(record.asOverlay!=null?{asOverlay:record.asOverlay}:{}),...(record.variation!=null?{variation:record.variation}:{}),impact:false,layers};
}
/** Adds or replaces (same name, any capitals) a look; the id of a replaced look stays. Throws a short message when it cannot be kept. */
export function upsertOwnLook(looks,record){
 const found=normalizeOwnLook(record);if(!found)throw Error('This look could not be saved.');
 const same=looks.findIndex(l=>l.name.toLowerCase()===found.name.toLowerCase());
 if(same<0&&looks.length>=MAX_OWN_LOOKS)throw Error('Too many saved looks.');
 const id=same>=0?looks[same].id:looks.some(l=>l.id===found.id)?ownLookId(found.name,looks.map(l=>l.id)):found.id,stored={...found,id};
 return {looks:same>=0?looks.map((l,i)=>i===same?stored:l):[...looks,stored],look:stored};
}
export function ownLookFile(record,app){return JSON.stringify({schema:OWN_LOOK_SCHEMA,version:1,name:record.name,app,look:record},null,2);}
/** The look inside a look file; anything else is refused with one short message. */
export function parseOwnLookFile(text){
 let data;
 if(typeof text!=='string'||text.length>MAX_OWN_LOOK_BYTES*2)throw Error(NOT_A_LOOK);
 try{data=JSON.parse(text);}catch{throw Error(NOT_A_LOOK);}
 const look=plain(data)&&data.schema===OWN_LOOK_SCHEMA&&data.version===1?normalizeOwnLook(data.look):null;
 if(!look)throw Error(NOT_A_LOOK);
 return look;
}
