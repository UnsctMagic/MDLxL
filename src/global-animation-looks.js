import {vertexBoneWeights} from './part-bones.js';
import {Triangle,Vector3} from 'three';
import {weaponStripFrame} from './particle-ribbon-fit.js';
import {SURFACE_EFFECTS} from './surface-effects.js';
import {surfacePalette,tintFromHex} from './surface-effect-colours.js';
import {layerBasis,LAYER_UNIT_FALLBACK} from './fx-layer-basis.js';
import {cardSpec,cardSize} from './fx-cards.js';

import {SORT_LOOKS,inkSeal} from './fx-sort-looks.js';
import {CLAUDE_LOOKS,CLAUDE_EMITTERS,FEL_EDGE} from './claude-fx-looks.js';

const existing=id=>SURFACE_EFFECTS.find(e=>e.id===id);
const texture=name=>'Textures\\'+name+'.blp';
const waterFrames=Array.from({length:8},(_,i)=>texture('Lords000'+i));
const skin=(label,image,extra={})=>({type:'Moving skin',label,image,...extra});
const glow=(label,image,extra={})=>({type:'Glow',label,image,...extra});
const dust=(label,kind,image,extra={})=>({type:'Particles',label,kind,image,...extra});
const frost=()=>dust('Falling mist','mist','ReplaceableTextures\\Weather\\Clouds8x8.blp',{atlas:8,tint:[.96,.98,1]});
const fire=(label,extra={})=>dust(label,'flame','ReplaceableTextures\\Weather\\Clouds8x8.blp',{atlas:8,...extra});
const embers=()=>dust('Rising embers','embers',texture('Star4'));
const shine=()=>glow('Crystal glints',texture('FX\\Flare\\FlareNarrow'),{pulse:'glint',strength:.56});
const pulse=()=>glow('Glowing texture',null,{strength:.56,pulse:'breathe'});
const edge=()=>({type:'Edge',label:'Light edge',image:texture('RibbonBlur1'),strength:.28});
export const RUNE_IMAGES=[
 ['Icecrown','Doodads\\Cinematic\\IcecrownObelisk\\glow_runes.blp'],
 ['Eye',texture('DemonRune3')],['Fork',texture('DemonRune5')],['Sigil',texture('DemonRune2')],
];
const crackle=()=>dust('Blade crackle','crackle',texture('LightningBall'),{burstGap:3,burstWindow:.22,spread:76,tint:[.94,.92,1]});
const powerArcs=()=>skin('Blade arcs',texture('Lightning4b'),{powerArcs:true,axis:'v',band:.9,strength:1,tint:[.8,.92,1],burstGap:3,burstWindow:.25,amount:3});
const rune=()=>({type:'Rune',label:'Runes',image:RUNE_IMAGES[0][1],strength:2.5,tint:[.35,.7,1],pulse:'breathe',glyphs:true});
export const ICE_VARIANTS={dark:[skin('Ice surface',texture('Ice_Natural01'),{fixed:true,atlasRect:[.52,.18,.46,.76],bodyUV:true,filter:2,strength:.97,tint:[1,1,1]}),glow('Ice sheen',texture('Ice3b'),{bodyUV:true,pulse:'glint',strength:.24,tint:[.9,.96,1]})],white:[skin('Packed frost','TerrainArt\\Northrend\\North_Snow.blp',{atlasRect:[.625,.25,.125,.25],fixed:true,bodyUV:true,base:true,filter:2,tint:[1,1,1]}),glow('Ice facets',texture('Ice_IceDull'),{bodyUV:true,pulse:'crystal',strength:.42,tint:[1,1,1]})]};
const make=(id,name,group,loop,palette,layers)=>({id,name,group,loop,palette,layers});
// A look with variations lists them in order; its layers are the first variation's.
const vary=(look,variations)=>({...look,variations,layers:variations[0].layers});
const starts=spec=>({...spec,starts:true});
const thorn=SORT_LOOKS.find(l=>l.id==='sort-thorn');
export const GLOBAL_LOOKS=[
 make('flaming-sword','Flaming sword','Blades',1760,'copper',[skin('Hot core',existing('ember-edge').texture,{strength:.58,pulse:'flicker'}),fire('Blade flames',{starts:true}),embers()]),
 vary(make('frost-blade','Frost blade','Blades',3200,'glacier',[]),[
  {id:'ice',name:'Ice',layers:[...ICE_VARIANTS.white,starts(frost())]},
  {id:'steel',name:'Frosted steel',layers:[skin('Cold sheen',texture('Ice_IceDull'),{strength:1,base:true,filter:2,atlasRect:[0,0,1,1],tint:[1,1,1]}),glow('White facets',texture('Ice_IceDull'),{atlasRect:[0,0,1,1],pulse:'crystal',strength:.61,tint:[1,1,1]}),shine(),starts(frost())]},
  {id:'dark',name:'Dark ice',layers:[...ICE_VARIANTS.dark,starts(frost())]},
 ]),
 make('lightning-blade','Lightning blade','Blades',1240,'azure',[glow('Storm steel',texture('Ice3b'),{base:true,filter:2,strength:.91,pulse:'steel',steel:true}),skin('Forked arcs',texture('Lightning4b'),{pulse:'lightning',strength:.92,axis:'v',band:.32,tint:[.75,.89,1]}),{...powerArcs(),enabled:false}]),
 make('arcane-blade','Arcane blade','Blades',2320,'lilac',[glow('Enchanted steel',texture('Ice3b'),{base:true,filter:2,strength:.91,pulse:'steel',steel:true}),skin('Flowing energy',existing('energy').texture,{strength:.78,pulse:'breathe',tint:[.79,.58,1]}),glow('Narrow highlight',texture('FX\\Flare\\DiamondNarrow'),{strength:.3})]),
 vary(make('rune-blade','Rune blade','Blades',4500,'gold',[]),[{id:'runes',name:'Runes',layers:[rune()]},{id:'thorn',name:'Thorn script',layers:thorn.layers}]),
 make('water-skin','Water skin','Skins',2800,'native',[skin('Water surface',waterFrames[0],{frames:waterFrames,base:true,filter:2,strength:.48,water:true,bodyUV:true,tint:[1,1,1]}),skin('Crossing highlights',waterFrames[0],{frames:waterFrames,direction:90,speed:2,strength:.24,water:true,bodyUV:true,tint:[.85,.95,1]})]),
 make('ice-skin','Ice skin','Skins',4200,'glacier',[...ICE_VARIANTS.white,frost()]),
 make('white-ice-skin','White ice','Skins',3900,'ice',[skin('Packed frost','TerrainArt\\Northrend\\North_Snow.blp',{atlasRect:[.625,.25,.125,.25],fixed:true,bodyUV:true,base:true,filter:2,tint:[1,1,1]}),glow('Ice facets',texture('Ice_IceDull'),{bodyUV:true,pulse:'crystal',strength:.42,tint:[1,1,1]})]),
 make('lava-skin','Lava skin','Skins',3350,'copper',[skin('Dark crust',existing('fissures').texture,{base:true,filter:0,atlasRect:existing('fissures').atlas,crust:true,bodyUV:true}),glow('Molten cracks',texture('HeroAvatarFlame'),{atlasRect:[.294,.079,.236,.105],pulse:'breathe',strength:.81,bodyUV:true,tint:[.72,.88,.50]}),embers(),fire('Fire',{enabled:false})]),
 make('glowing-skin','Glowing skin','Skins',2500,'azure',[glow('Glowing texture',null,{strength:4,pulse:'breathe'})]),
 make('poison-skin','Poison skin','Skins',3400,'moss',[skin('Poison surface',existing('poison').texture,{base:true,strength:.9,nativeSurface:{...existing('poison'),description:undefined},tint:[1,1,1]}),dust('Heavy drops','drops',texture('WaterBlobs1'))]),
 make('crystal-veins','Crystal veins','Terrain',3600,'glacier',[skin('Crystal veins',existing('glacial').texture,{atlasRect:existing('glacial').atlas,strength:.88,pulse:'breathe',bodyUV:true}),shine()]),
 make('felwood-curse','Felwood curse','Buffs & curses',3100,'moss',[skin('Poison surface',existing('poison').texture,{atlasRect:existing('poison').atlas,strength:.7,pulse:'breathe',bodyUV:true,tint:[1,1,1]}),glow('Rune',texture('DemonRune5'),{pulse:'breathe',strength:.5})]),
 make('fly-swarm','Fly swarm','Around the unit',1233,'native',[dust('Orbiting flies','flies',texture('Doodads0'))]),
 make('motes','Motes','Around the unit',3250,'lilac',[dust('Drifting lights','motes',texture('GenericGlow64'))]),
 make('rising-embers','Rising embers','Around the unit',2100,'copper',[embers()]),
 make('frost-mist','Frost mist','Around the unit',3150,'glacier',[frost()]),
 make('empty','Empty','Build your own',3000,'native',[]),
 make('moving-own','Moving own texture','Your textures',3200,'native',[skin('Moving texture',null,{base:true,own:true})]),
 make('colour-pulse','Colour pulse','Your textures',2600,'lilac',[pulse()]),
 make('fade-pulse','Fade pulse','Your textures',2750,'native',[skin('Breathing opacity',null,{base:true,own:true,pulse:'fade'})]),
];
// The owner removed duplicate starters, auras and cues unrelated to an attack.
const retiredImpacts=[];
const retiredLooks=GLOBAL_LOOKS.filter(l=>['white-ice-skin','lava-skin','ice-skin','water-skin'].includes(l.id));
GLOBAL_LOOKS.splice(0,GLOBAL_LOOKS.length,...GLOBAL_LOOKS.filter(l=>!retiredLooks.includes(l)));
export const RETAINED_CARD_IDS=['sun-mend','hex-mark','venom-seep','spell-ward','spirit-veil','recall-seal','revenant','lava','fissures','glacial','poison'];
for(const e of SURFACE_EFFECTS.filter(e=>RETAINED_CARD_IDS.includes(e.id)||e.category==='Impacts'&&e.cue==='attack')){
 const impact=e.category==='Impacts',layers=[];
 if(e.id==='glacial'){
  // The crack tile carries transparent holes. Keep solid ice behind the pulsing details.
  layers.push(skin('Ice surface',texture('Ice_IceDull'),{fixed:true,bodyUV:true,filter:2,strength:.94,tint:[.78,.9,1]}),
   glow('Fissures',e.texture,{atlasRect:[.625,.25,.125,.25],bodyUV:true,pulse:'breathe',strength:1.7,tint:[.8,.97,1]}));
 }else if(!impact){
  for(const [i,spec] of (e.layers||[null]).entries())layers.push(skin(e.layers?'Surface '+(i+1):e.name,spec?.texture||e.texture||e.picture,{
   nativeSurface:{...e,description:undefined,layers:spec?[spec]:undefined,accents:[],stamp:undefined,cue:undefined},base:e.defaultMode==='replace',strength:e.opacity??1}));
 }
 if(e.id==='fissures')layers.push(fire('Fire',{enabled:false}));
 for(const [i,spec] of (e.accents||[]).entries())layers.push(dust((spec.flat?(impact?'Flash':'Ground piece'):'Particles')+' '+(i+1),'native',spec.texture,{nativeSpec:spec,ground:!!spec.flat,enabled:!spec.flat,impact}));
 if(e.stamp&&!impact)layers.push({type:'Rune',label:'Ground seal',stamp:e.stamp,ground:true,enabled:false});
 (impact?retiredImpacts:GLOBAL_LOOKS).push({...make(e.id,e.id==='fissures'?'Fissures skin':e.name,e.id==='fissures'?'Skins':e.category,e.duration||3000,e.palette||'native',layers),impact});
}
GLOBAL_LOOKS.push(...SORT_LOOKS.filter(look=>look.group),...CLAUDE_LOOKS);
{
 const i=GLOBAL_LOOKS.findIndex(l=>l.id==='claude-tidal-blade'),tidal=GLOBAL_LOOKS[i],drip=tidal.layers.find(l=>l.label==='Dripping water');
 GLOBAL_LOOKS[i]=vary(tidal,[{id:'running',name:'Running water',layers:tidal.layers},{id:'currents',name:'Crossing currents',layers:[...retiredLooks.find(l=>l.id==='water-skin').layers,drip]}]);
}
// The one table that files the library: folder, order and display name. A look missing here is not filed.
export const LIBRARY=[
 ['Fire',[['flaming-sword','Fire'],['claude-fel-blade','Fel fire'],['fissures','Fissures'],['claude-magma-flow'],['lava'],['claude-forge-hot','Forge heat'],['rising-embers']]],
 ['Ice',[['frost-blade','Frost'],['glacial'],['crystal-veins'],['frost-mist']]],
 ['Water',[['claude-tidal-blade','Water'],['sort-tide']]],
 ['Lightning',[['lightning-blade','Lightning'],['sort-rift'],['claude-void-cracked','Void cracks']]],
 ['Arcane',[['arcane-blade','Arcane'],['rune-blade','Runes'],['claude-runic-plate','Glowing runes'],['glowing-skin','Glow'],['motes'],['sort-astral'],['sort-soul'],['sort-eclipse'],['spell-ward'],['recall-seal'],['sun-mend']]],
 ['Poison & nature',[['poison-skin','Poison'],['poison'],['felwood-curse'],['venom-seep'],['claude-corrupted-veins'],['sort-briar'],['sort-ink'],['fly-swarm'],['claude-plague-swarm']]],
 ['Stone',[['sort-basalt','Basalt'],['sort-abyss'],['sort-cairn'],['sort-mosaic']]],
 ['Death & spirit',[['claude-wraith-form'],['revenant'],['spirit-veil'],['hex-mark'],['claude-blood-pact'],['sort-blood']]],
 ['Build your own',[['empty','Empty'],['moving-own','Moving texture'],['colour-pulse'],['fade-pulse']]],
];
{
 const all=new Map(GLOBAL_LOOKS.map(l=>[l.id,l])),listed=new Set(LIBRARY.flatMap(([,rows])=>rows.map(([id])=>id)));
 GLOBAL_LOOKS.splice(0,GLOBAL_LOOKS.length,...LIBRARY.flatMap(([group,rows])=>rows.filter(([id])=>all.has(id)).map(([id,name])=>({...all.get(id),group,...(name?{name}:{})}))),...[...all.values()].filter(l=>!listed.has(l.id)));
}
// A saved impact remains editable. It is never offered in the library or search.
export const findLook=id=>GLOBAL_LOOKS.find(e=>e.id===id)||retiredLooks.find(e=>e.id===id)||retiredImpacts.find(e=>e.id===id)||SORT_LOOKS.find(e=>e.id===id);
/** The look a stack uses: a built-in one, or a stand-in for a look this PC does not list (the user's own, or one from another model). */
export const lookOf=stack=>findLook(stack.look)||{id:stack.look,name:stack.name||'Custom look',group:'My looks',loop:stack.loop,palette:'native',layers:[],custom:true};
export function withIceVariation(stack,frame,variant){
 const names=new Set([...ICE_VARIANTS.dark,...ICE_VARIANTS.white].map(l=>l.label));
 const surfaces=stack.layers.filter(l=>names.has(l.label)),extra=stack.layers.filter(l=>!names.has(l.label));
 let id=Math.max(0,...stack.layers.map(l=>l.id));
 const layers=ICE_VARIANTS[variant].map((spec,i)=>({...makeLayer(spec,frame,'glacier',surfaces[i]?.id??++id),enabled:surfaces[i]?.enabled!==false}));
 return {...stack,iceVariation:variant,layers:[...layers,...extra]};
}
export const currentVariation=(stack,look)=>stack.variation&&look.variations?.some(v=>v.id===stack.variation)?stack.variation:look.variations?.find(v=>stack.layers.some(l=>l.label===v.layers[0].label))?.id||look.variations?.[0].id;
// Layers of the look's variations are swapped; layers the user added stay. A variation's emitters start only when marked.
export function withVariation(stack,frame,look,variationId){
 const variation=look.variations.find(v=>v.id===variationId);if(!variation)return stack;
 const names=new Set(look.variations.flatMap(v=>v.layers.map(l=>l.label))),particle=l=>l.type==='Particles';
 const owned=stack.layers.filter(l=>names.has(l.label)),extra=stack.layers.filter(l=>!names.has(l.label));
 const previous={surfaces:owned.filter(l=>!particle(l)),particles:owned.filter(particle)},used={surfaces:0,particles:0};
 let id=Math.max(0,...stack.layers.map(l=>l.id));
 const layers=variation.layers.filter(spec=>!particle(spec)||spec.starts).map(spec=>{
  const kind=particle(spec)?'particles':'surfaces',old=previous[kind][used[kind]++];
  return {...makeLayer(spec,frame,look.palette,old?.id??++id),enabled:old?.enabled!==false};
 });
 return {...stack,variation:variationId,layers:[...layers,...extra]};
}
export const LAYER_CHOICES=[
 skin('Flowing energy',existing('energy').texture,{pulse:'breathe'}),
 skin('Forked arcs',texture('Lightning4b'),{axis:'v',band:.32,pulse:'lightning'}),
 pulse(),glow('Diamond flash',texture('FX\\Flare\\DiamondNarrow'),{pulse:'glint',strength:1.25}),
 glow('Crescent light',texture('MoonCrescentGlow'),{pulse:'breathe',strength:1.5}),
 glow('Star field','Units\\Undead\\FrostWyrm\\Starfield.blp',{pulse:'double',strength:1.1}),
 ...RUNE_IMAGES.map(([label,image])=>({...rune(),label,image})),
 embers(),dust('Star sparks','sparks',texture('Star4')),dust('Orbiting stars','motes',texture('Star2')),
 powerArcs(),crackle(),frost(),edge(),inkSeal,...ICE_VARIANTS.dark,FEL_EDGE,...CLAUDE_EMITTERS,
 cardSpec('Card',texture('GenericGlow64')),
];
// The compact menu can start any ingredient independently of its original preset.
for(const look of GLOBAL_LOOKS){
 for(const spec of look.variations?look.variations.flatMap(v=>v.layers):look.layers){
  const choice={...spec};delete choice.enabled;delete choice.starts;
  const matches=LAYER_CHOICES.filter(other=>other.label===choice.label);
  if(matches.some(other=>other.type===choice.type&&other.image===choice.image&&other.kind===choice.kind&&other.stamp===choice.stamp&&other.nativeSurface?.id===choice.nativeSurface?.id))continue;
  const generic=/^(Surface|Particles|Ground piece) \d+$/.test(choice.label);
  const menuLabel=matches.length||generic?choice.label+' ('+look.name+')':choice.label;
  if(!LAYER_CHOICES.some(other=>(other.menuLabel||other.label)===menuLabel))LAYER_CHOICES.push({...choice,menuLabel});
 }
}
export function emitterChoices(look) {
 const own=(look.variations?look.variations.flatMap(v=>v.layers):look.layers).filter((spec,i,all)=>spec.type==='Particles'&&all.findIndex(o=>o.type==='Particles'&&o.label===spec.label&&o.image===spec.image&&o.kind===spec.kind&&o.stamp===spec.stamp&&o.nativeSurface?.id===spec.nativeSurface?.id)===i);
 const other=LAYER_CHOICES.filter(spec=>spec.type==='Particles'&&!own.some(layer=>layer.label===spec.label&&layer.image===spec.image&&layer.kind===spec.kind&&layer.stamp===spec.stamp&&layer.nativeSurface?.id===spec.nativeSurface?.id));
 return [...own.map((spec,i)=>({spec,label:spec.label+(i===0?' (recommended)':'')})),...other.map(spec=>({spec,label:spec.menuLabel||spec.label}))];
}
export const layerType=layer=>layer.fixed&&layer.type==='Moving skin'?'Surface':layer.type;
export function withLayerSize(layer,next){
 if(next.size===layer.size||layer.kind==='flies'||!layer.native?.ParticleScaling)return next;
 return {...next,native:{...next.native,ParticleScaling:layer.native.ParticleScaling.map(value=>value*next.size/layer.size)}};
}
export function withParticleStrength(layer,currentAlpha,value){
 const opacityBase=layer.opacityBase||Array.from(currentAlpha);
 return {...layer,opacityBase,particleStrength:value,native:{...layer.native,Alpha:opacityBase.map(a=>Math.round(a*value))}};
}
export function withLayerTexture(layer,image){
 const next={...layer,image,own:false,pictureOverride:true};
 if(image===layer.image)return layer;
 delete next.frames;delete next.atlasRect;delete next.atlas;
 // A new picture has its own grid: its frames follow it, not the old picture's.
 if(next.native&&['Rows','Columns','LifeSpanUVAnim','DecayUVAnim','TailUVAnim','TailDecayUVAnim'].some(key=>key in next.native)){next.native={...next.native};for(const key of ['Rows','Columns','LifeSpanUVAnim','DecayUVAnim','TailUVAnim','TailDecayUVAnim'])delete next.native[key];}
 if(next.nativeSpec){next.nativeSpec={...next.nativeSpec,texture:image};delete next.nativeSpec.atlas;delete next.nativeSpec.team;}
 if(next.nativeSurface){
  next.nativeSurface={...next.nativeSurface,texture:image,picture:image};
  if(next.nativeSurface.atlas)next.nativeSurface.atlas=[0,0,1,1];
  if(next.nativeSurface.layers)next.nativeSurface.layers=next.nativeSurface.layers.map(spec=>({...spec,texture:image,team:false,sheet:undefined}));
 }
 return next;
}
export const surfaceIngredient=l=>l.type==='Moving skin'||l.type==='Glow'||l.glyphs;
export const createsOverlay=stack=>stack.asOverlay??!stack.layers.some(l=>l.base&&l.enabled!==false);
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
// Blend choices for a surface layer: native FilterMode values. Modulate darkens what is behind it.
export const BLEND_CHOICES=[[0,'Solid'],[1,'Cut-out'],[2,'See-through'],[3,'Add'],[4,'Add alpha'],[5,'Darken']];
const additive=filter=>filter===3||filter===4;
/** The FilterMode a surface layer compiles with when it has no explicit filter (undefined when only its native file knows). */
export function layerFilter(l){
 if(l.filter!=null)return l.filter;
 const n=l.nativeSurface;
 if(n)return n.layers?n.layers[0]?.filter??3:n.texture?n.replaceFilter??n.filterMode??3:undefined;
 return l.powerArcs?3:l.base?2:3;
}
// New layers: additive light is unshaded; glows, runes and additive light ignore fog.
function lightingRule(l,filter){return {unshaded:additive(filter)?true:undefined,unfogged:l.type==='Glow'||l.glyphs||additive(filter)?true:undefined};}
/** Change Blend; unshaded and unfogged follow it unless the user set them otherwise. */
export function withBlend(l,filter){
 const before=lightingRule(l,layerFilter(l)),after=lightingRule(l,filter),next={...l,filter};
 for(const key of ['unshaded','unfogged'])if(l[key]===before[key]){if(after[key]==null)delete next[key];else next[key]=after[key];}
 return next;
}
/** Default second colour of a colour rhythm: the same hue family, its weaker channels at a third (orange 1,.3,0 → deep red 1,.1,0). */
export function secondTint(tint){
 const top=Math.max(...tint),next=tint.map(v=>v>=top-1e-6?v:v/3);
 return next.every((v,i)=>v===tint[i])?tint.map(v=>v/3):next;
}
export const COLOUR_RHYTHM_IDS=['beat','embers','shift'];
// Rhythm ids that shape a layer's alpha or colour. Saved ids keep working; new ones follow the study.
export const RHYTHM_IDS=['steady','soft','breathe','beat','embers','shift','flicker','glint','double','crystal','steel','fade','lightning'];
/** Whether a surface layer's texture travels on its clock (Speed 0 still compiles it still). An explicit fixed:false always moves. */
export function layerMoves(l){
 if(l.fixed===false)return true;
 if(l.fixed||l.glyphs||l.pulse==='steady'||l.pulse==='fade')return false;
 return l.type==='Moving skin'||l.type!=='Glow'&&!RHYTHM_IDS.includes(l.pulse);
}
/** Which motion and area controls change this surface layer. canTile: its picture repeats. */
export function surfaceControls(l,canTile){
 const n=l.nativeSurface,area=!l.glyphs&&!!(l.atlasRect||n?.atlas),moves=layerMoves(l);
 if(n)return {moving:false,speed:true,direction:!!n.fitUV&&!area,tiling:!area&&canTile,area};
 return {moving:!l.powerArcs,speed:!l.powerArcs&&(moves||!!l.frames),direction:!l.glyphs&&(area||l.own&&!canTile?moves:true),tiling:!l.glyphs&&!area&&canTile,area};
}
export function makeLayer(spec,frame,palette,id) {
 const basis=layerBasis(frame),{length}=basis;
 if(spec.type==='Card'){
  // Cards keep only their own fields; everything not given uses CARD_DEFAULTS when compiled.
  const defaultTint=spec.tint??tintFromHex(surfacePalette({palette})[0][1]);
  const {starts:_starts,...saved}=structuredClone(spec);
  return {...saved,id,enabled:spec.enabled!==false,defaultTint,tint:[...defaultTint],strength:spec.strength??1,offset:spec.offset?[...spec.offset]:[0,0,0],count:spec.count??1,size:spec.size??cardSize(basis)};
 }
 const p=basis.properties[spec.kind]||LAYER_UNIT_FALLBACK;
 const defaultTint=spec.tint??(spec.water?[.65,.83,.99]:spec.kind==='flies'?[.28,.26,.25]:tintFromHex(surfacePalette({palette})[0][1]));
 const {starts:_starts,...saved}=structuredClone(spec);
 if(surfaceIngredient(spec)&&!spec.stamp){
  const rule=lightingRule(spec,layerFilter(spec));
  for(const key of ['unshaded','unfogged'])if(saved[key]==null&&rule[key]!=null)saved[key]=rule[key];
  if(!spec.nativeSurface&&saved.twoSided==null)saved.twoSided=!spec.water;
 }
 return {...saved,id,enabled:spec.enabled!==false,defaultTint,tint:[...defaultTint],strength:spec.strength??1,
  speed:spec.speed??1,direction:spec.direction??0,tiling:1,offset:[0,0,0],upper:length/2,lower:length/2,
  count:p[0],amount:spec.amount??p[1],lasts:spec.lasts??p[2],velocity:p[3],gravity:p[4],size:spec.type==='Rune'?basis.runeSize:spec.kind==='flies'?basis.flySize:p[5],
  spriteSize:p[5],smoothness:32};
}
export function newStack(look,frame,owner) {
 const emitterOnly=look.layers.length>0&&look.layers.every(spec=>spec.type==='Particles');
 return {owner,look:look.id,loop:look.loop,...(look.id==='ice-skin'?{iceVariation:'white'}:{}),...(look.variations?{variation:look.variations[0].id}:{}),...(look.asOverlay!=null?{asOverlay:look.asOverlay}:{}),impact:!!look.impact,layers:look.layers.flatMap((s,i)=>!look.impact&&s.type==='Particles'&&!s.starts&&(!emitterOnly||i>0)?[]:[makeLayer(s,frame,look.palette,i+1)])};
}
