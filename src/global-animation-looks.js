import {vertexBoneWeights} from './part-bones.js';
import {Triangle,Vector3} from 'three';
import {weaponStripFrame} from './particle-ribbon-fit.js';
import {SURFACE_EFFECTS} from './surface-effects.js';
import {surfacePalette,tintFromHex} from './surface-effect-colours.js';

const existing=id=>SURFACE_EFFECTS.find(e=>e.id===id);
const texture=name=>'Textures\\'+name+'.blp';
const waterFrames=Array.from({length:8},(_,i)=>texture('Lords000'+i));
const skin=(label,image,extra={})=>({type:'Moving skin',label,image,...extra});
const glow=(label,image,extra={})=>({type:'Glow',label,image,...extra});
const dust=(label,kind,image,extra={})=>({type:'Particles',label,kind,image,...extra});
const frost=()=>dust('Falling mist','mist',texture('Clouds8x8Grey'),{atlas:8,tint:[.83,.93,1]});
const embers=()=>dust('Rising embers','embers',texture('Star4'));
const shine=()=>glow('Crystal glints',texture('FX\\Flare\\FlareNarrow'),{pulse:'glint',strength:.56});
const pulse=()=>glow('Glowing texture',null,{strength:.56,pulse:'breathe'});
const edge=()=>({type:'Edge',label:'Light edge',image:texture('RibbonBlur1'),strength:.28});
const rune=()=>({type:'Rune',label:'Runes',image:'Doodads\\Cinematic\\IcecrownObelisk\\glow_runes.blp',strength:2.5,tint:[.35,.7,1],pulse:'breathe',glyphs:true});
const make=(id,name,group,loop,palette,layers)=>({id,name,group,loop,palette,layers});
export const GLOBAL_LOOKS=[
 make('flaming-sword','Flaming sword','Blades',1760,'copper',[skin('Hot core',existing('ember-edge').texture,{strength:.58,pulse:'flicker'}),dust('Blade flames','flame','ReplaceableTextures\\Weather\\Clouds8x8.blp',{atlas:8}),embers()]),
 make('frost-blade','Frost blade','Blades',3200,'glacier',[skin('Cold sheen',existing('frost-edge').texture,{strength:.94,base:true,filter:2,tint:[.84,.94,1]}),shine(),frost()]),
 make('lightning-blade','Lightning blade','Blades',1240,'azure',[glow('Storm steel',texture('Ice3b'),{base:true,filter:2,strength:.91,pulse:'steel',steel:true}),skin('Forked arcs',texture('Lightning4b'),{pulse:'lightning',strength:.92,axis:'v',band:.32,tint:[.75,.89,1]}),dust('Jumping sparks','sparks',texture('Star4'))]),
 make('arcane-blade','Arcane blade','Blades',2320,'lilac',[glow('Enchanted steel',texture('Ice3b'),{base:true,filter:2,strength:.91,pulse:'steel',steel:true}),skin('Flowing energy',existing('energy').texture,{strength:.78,pulse:'breathe',tint:[.79,.58,1]}),glow('Narrow highlight',texture('FX\\Flare\\DiamondNarrow'),{strength:.3})]),
 make('rune-blade','Rune blade','Blades',4500,'gold',[rune()]),
 make('water-skin','Water skin','Skins',2800,'native',[skin('Water surface',waterFrames[0],{frames:waterFrames,base:true,filter:2,strength:.48,water:true,bodyUV:true,tint:[1,1,1]}),skin('Crossing highlights',waterFrames[0],{frames:waterFrames,direction:90,speed:2,strength:.24,water:true,bodyUV:true,tint:[.85,.95,1]})]),
 make('ice-skin','Ice skin','Skins',4200,'glacier',[skin('Crystal surface',texture('CrystalOpaque'),{base:true,strength:.95,nativeSurface:{...existing('glacial'),texture:texture('CrystalOpaque'),atlas:undefined,description:undefined},tint:[.82,.95,1]}),shine(),frost()]),
 make('lava-skin','Lava skin','Skins',3350,'copper',[skin('Dark crust',existing('fissures').texture,{base:true,filter:0,atlasRect:existing('fissures').atlas,crust:true,bodyUV:true}),glow('Molten cracks',texture('HeroAvatarFlame'),{atlasRect:[.294,.079,.236,.105],pulse:'breathe',strength:.81,bodyUV:true,tint:[.72,.88,.50]}),embers()]),
 make('glowing-skin','Glowing skin','Skins',2500,'azure',[pulse()]),
 make('poison-skin','Poison skin','Skins',3400,'moss',[skin('Poison surface',existing('poison').texture,{base:true,strength:.9,nativeSurface:{...existing('poison'),description:undefined},tint:[1,1,1]}),dust('Heavy drops','drops',texture('WaterBlobs1'))]),
 make('crystal-veins','Crystal veins','Terrain',3600,'glacier',[skin('Crystal veins',existing('glacial').texture,{atlasRect:existing('glacial').atlas,strength:.88,pulse:'breathe',bodyUV:true}),shine()]),
 make('felwood-curse','Felwood curse','Buffs & curses',3100,'moss',[skin('Poison surface',existing('poison').texture,{atlasRect:existing('poison').atlas,strength:.7,pulse:'breathe',bodyUV:true,tint:[1,1,1]}),glow('Rune',texture('DemonRune5'),{pulse:'breathe',strength:.5})]),
 make('fly-swarm','Fly swarm','Around the unit',1233,'native',[dust('Orbiting flies','flies',texture('Doodads0'))]),
 make('motes','Motes','Around the unit',3250,'lilac',[dust('Drifting lights','motes',texture('GenericGlow64'))]),
 make('rising-embers','Rising embers','Around the unit',2100,'copper',[embers()]),
 make('frost-mist','Frost mist','Around the unit',3150,'glacier',[frost()]),
 make('moving-own','Moving own texture','Your textures',3200,'native',[skin('Moving texture',null,{base:true,own:true})]),
 make('colour-pulse','Colour pulse','Your textures',2600,'lilac',[pulse()]),
 make('fade-pulse','Fade pulse','Your textures',2750,'native',[skin('Breathing opacity',null,{base:true,own:true,pulse:'fade'})]),
];
// The owner removed duplicate starters, auras and cues unrelated to an attack.
export const RETAINED_CARD_IDS=['iron-hit','frost-hit','ember-hit','quake-hit','thunder-print','fel-rupture','sun-mend','hex-mark','venom-seep','spell-ward','spirit-veil','recall-seal','revenant','lava','fissures','glacial','poison'];
export const REMOVED_CARDS=SURFACE_EFFECTS.filter(e=>!RETAINED_CARD_IDS.includes(e.id));
for(const e of SURFACE_EFFECTS.filter(e=>RETAINED_CARD_IDS.includes(e.id))){
 const impact=e.category==='Impacts',layers=[];
 if(!impact){
  for(const [i,spec] of (e.layers||[null]).entries())layers.push(skin(e.layers?'Surface '+(i+1):e.name,spec?.texture||e.texture||e.picture,{
   nativeSurface:{...e,description:undefined,layers:spec?[spec]:undefined,accents:[],stamp:undefined,cue:undefined},base:e.defaultMode==='replace',strength:e.opacity??1}));
 }
 for(const [i,spec] of (e.accents||[]).entries())layers.push(dust((spec.flat?'Ground piece':'Particles')+' '+(i+1),'native',spec.texture,{nativeSpec:spec,ground:!!spec.flat,enabled:!spec.flat,impact}));
 if(e.stamp)layers.push({type:'Rune',label:'Ground seal',stamp:e.stamp,ground:true,enabled:false});
 GLOBAL_LOOKS.push({...make(e.id,e.name,e.category,e.duration||3000,e.palette||'native',layers),impact});
}
export const LAYER_CHOICES=[skin('Moving skin',existing('energy').texture),pulse(),rune(),embers(),edge()];
export const findLook=id=>GLOBAL_LOOKS.find(e=>e.id===id);
export function partFrame(geometry,split=true) {
 const points=Array.from({length:geometry.Vertices.length/3},(_,i)=>Array.from(geometry.Vertices.subarray(i*3,i*3+3)));
 const frame=weaponStripFrame(points);
 if(!frame){if(!split)return null;throw Error('Select a part with a visible length.');}
 const {center,axis,length}=frame;
 const samples=points.map(p=>{const v=new Vector3(...p),along=v.clone().sub(center).dot(axis);return {v,along};});
 const radius=samples.reduce((r,{v,along})=>Math.max(r,v.clone().sub(center).addScaledVector(axis,-along).length()),length*.025);
 // A hook bends away from its principal axis. Follow the centre of the nearest cross-section.
 function at(distance){
  const nearest=samples.reduce((best,s)=>Math.min(best,Math.abs(s.along-distance)),Infinity);
  const near=samples.filter(s=>Math.abs(s.along-distance)<=nearest+length*.065);
  const p=near.reduce((c,s)=>c.add(s.v),new Vector3()).multiplyScalar(1/near.length);
  return p.addScaledVector(axis,distance-p.clone().sub(center).dot(axis));
 }
 const middle=at(0),slice=samples.filter(s=>Math.abs(s.along)<length*.16);
 const girth=(slice.length?slice:samples).reduce((r,s)=>Math.max(r,s.v.clone().sub(middle).addScaledVector(axis,-s.along).length()),length*.035);
 // On hooked or disconnected blades the centre line can cross air. Emit from the closest
 // triangle on the selected part. Deliberate handle extensions can still reach beyond it.
 function surfaceAt(distance){
  const target=at(distance);
  if(Math.abs(distance)>length/2||!geometry.Faces?.length)return target;
  const tri=new Triangle(),candidate=new Vector3(),best=target.clone();let closest=Infinity;
  for(let i=0;i<geometry.Faces.length;i+=3){
   tri.set(samples[geometry.Faces[i]].v,samples[geometry.Faces[i+1]].v,samples[geometry.Faces[i+2]].v);
   tri.closestPointToPoint(target,candidate);
   const d=candidate.distanceToSquared(target);if(d<closest){closest=d;best.copy(candidate);}
  }
  return best;
 }
 const result={center,axis,length,radius,girth,at,surfaceAt};
 if(split&&geometry.Groups){
  const groups=new Map();
  for(let i=0;i<points.length;i++){
   const weights=vertexBoneWeights(geometry,i),key=JSON.stringify(weights);
   if(!groups.has(key))groups.set(key,{weights,vertices:[]});groups.get(key).vertices.push(i);
  }
  result.regions=[...groups.values()].flatMap(({weights,vertices})=>{
   if(vertices.length<3)return [];
   const remap=new Map(vertices.map((v,i)=>[v,i])),faces=[];
   for(let i=0;i<geometry.Faces.length;i+=3){const tri=Array.from(geometry.Faces.subarray(i,i+3));if(tri.every(v=>remap.has(v)))faces.push(...tri.map(v=>remap.get(v)));}
   const region={Vertices:Float32Array.from(vertices.flatMap(v=>points[v])),Faces:Uint16Array.from(faces)};
   // Coincident seam vertices have no surface span to fit an emitter along.
   const f=partFrame(region,false);return f?[{frame:f,weights,vertices,geometry:region}]:[];
  });
 }
 return result;
}
export function makeLayer(spec,frame,palette,id) {
 frame=frame.regions?.[0]?.frame||frame;
 const {length,girth,radius}=frame,unit=Math.max(1,Math.min(length*.23,Math.max(length*.055,girth*.82)));
 const properties={
  flame:[7,104,.46,unit*2.2,-unit*9,Math.min(length*.19,unit*2.38)],embers:[4,12,.68,unit*2.8,-unit*4,unit*.22],
  sparks:[4,9,.23,unit*5,unit*.5,unit*.28],mist:[5,22,1.18,-unit*.52,unit*2.5,unit*1.72],
  drops:[4,7,.69,-unit*.5,unit*7,unit*.33],motes:[4,11,1.05,unit*.7,-unit*.35,unit*.53],
  flies:[5,5,.09,0,0,Math.max(2.1,Math.min(8,length*.066+radius*.037))],
 };
 const p=properties[spec.kind]||[1,24,.12,1,0,1];
 return {...structuredClone(spec),id,enabled:spec.enabled!==false,tint:spec.tint??(spec.water?[.65,.83,.99]:spec.kind==='flies'?[.28,.26,.25]:tintFromHex(surfacePalette({palette})[0][1])),strength:spec.strength??1,
  speed:spec.speed??1,direction:spec.direction??0,tiling:1,offset:[0,0,0],upper:length/2,lower:length/2,
  count:p[0],amount:p[1],lasts:p[2],velocity:p[3],gravity:p[4],size:spec.type==='Rune'?Math.min(girth,length*.29)*1.35:spec.kind==='flies'?Math.max(radius*1.12,length*.32):p[5],
  spriteSize:p[5],smoothness:32};
}
export function newStack(look,frame,owner) {
 return {owner,look:look.id,loop:look.loop,impact:!!look.impact,layers:look.layers.map((s,i)=>makeLayer(s,frame,look.palette,i+1))};
}
