// Looks Claude designed with the existing five layer types, kept by the owner after review.
// Same data format as the library, so every FX control edits them unchanged.
const tex=name=>'Textures\\'+name+'.blp';
const water=Array.from({length:8},(_,i)=>tex('Lords000'+i));
const skin=(label,image,extra={})=>({type:'Moving skin',label,image,...extra});
const glow=(label,image,extra={})=>({type:'Glow',label,image,...extra});
const dust=(label,kind,image,extra={})=>({type:'Particles',label,kind,image,...extra});
const rune=(label,image,pulse,tint)=>({type:'Rune',label,image,glyphs:true,strength:1.6,pulse,tint});
const edge=(label,tint,strength=.32)=>({type:'Edge',label,image:tex('RibbonBlur1'),tint,strength});
const stone=(label,path)=>({type:'Moving skin',label,image:'TerrainArt\\'+path+'.blp',atlasRect:[.625,.25,.125,.25],bodyUV:true,fixed:true,base:true,filter:2,strength:1,tint:[1,1,1]});
const spray=(label,name,tint,spec)=>({type:'Particles',label,kind:'native',image:tex(name),tint,nativeSpec:{texture:tex(name),...spec}});
import {DRIP,FEL_FLAME_CARDS,spray as nativeSpray,vary,breath,breathSpit,EMITTER_UNFOGGED,EMITTER_CARRIED,EMITTER_SORTED,PUFF_FRAMES} from './fx-technique-looks.js';
const CLOUDS='ReplaceableTextures\\Weather\\Clouds8x8.blp';
// The Thunderclap bolt at the path the texture catalogue lists.
const LIGHTNING2B='Abilities\\Spells\\Human\\Thunderclap\\Lightning2b.blp';
const U=EMITTER_UNFOGGED,C=EMITTER_CARRIED;

const fel=[.42,1,.22],sea=[.68,.9,1],lava=[1,.62,.3],ghost=[.62,.92,1],blood=[1,.18,.12],sick=[.5,.82,.22];
const rune_=[.4,.75,1],ember=[1,.5,.14],violet=[.72,.5,1];
// The owner's zombie dragon breath (14 November): two clouds of the same shape from one place, a pale green one and a
// murky olive one, blended (never additive). Its colours are used as measured; the stream itself is breath() in
// fx-technique-looks.js.
const PALE=[[.69,.99,.74],[.25,.53,.32],[.33,.51,.34]],MURK=[[.31,.42,.27],[.22,.27,.07],[.19,.31,.22]];
const PUFF={...PUFF_FRAMES,Flags:EMITTER_SORTED};
// A cloud that hangs around the part. fall: positive sinks, negative rises (shares of the part-fitted radius).
// cover:'cloud' (pass 8): on a body it is one cloud sized by the whole body, not a puff on every skin region.
const plagueCloud=(label,ramp,{rate,life=2.4,alpha=105,fall=-.04,size=[.2,.3,.4],cap=2.2,loop}={})=>nativeSpray(label,CLOUDS,ramp[1],
 {atlas:8,filter:0,life,rate,velocity:.08,gravity:fall,spread:180,size,alpha:[0,alpha,0]},
 {starts:true,cover:'cloud',birthAcross:1.3,widthCap:cap,capMotion:true,...(loop?{loop}:{}),native:{Time:.3,Variation:.3,...PUFF,SegmentColor:ramp}});
const plagueGlow=(extra={})=>nativeSpray('Plague glow',tex('Green_Glow3'),[.4,.9,.3],
 {life:1.6,rate:8,size:[.3,.42,.3],alpha:[0,55,0]},
 {starts:true,cover:'cloud',widthCap:1.6,loop:2933,native:{Time:.5,Flags:C},...extra});
const plagueSpores=(rate=12,cap=.4)=>nativeSpray('Plague spores',tex('Bubble'),[.5,.9,.25],
 {life:1.6,rate,velocity:.08,gravity:-.12,spread:180,size:[.015,.045,.03],alpha:[0,210,0]},
 {starts:true,cover:'cloud',birthAcross:1.4,widthCap:cap,loop:1933,native:{Time:.5,Variation:.5,Flags:U,SegmentColor:[[.8,1,.5],[.5,.9,.25],[.25,.6,.2]]}});
const make=(group,id,name,loop,options,...layers)=>({id:'claude-'+id,name,group,loop,palette:'native',...options,layers});
// Each look sits in the library's normal folder for its kind.
const fx=(group,...a)=>make(group,a[0],a[1],a[2],{},...a.slice(3));
// Armour keeps its own look underneath: every enhancement starts as an overlay.
const armour=(...a)=>make('Skins',a[0],a[1],a[2],{asOverlay:true},...a.slice(3));

// Fel fire no longer starts with its edge; it stays offered in Add layer.
export const FEL_EDGE=edge('Fel edge',fel,.3);

// Offered in Particles → Add emitter.
export const CLAUDE_EMITTERS=[
 spray('Storm cloud','CloudSingle',[.36,.38,.46],{life:1.6,rate:7,area:.5,height:.9,velocity:.08,filter:0,size:[.3,.55,.7],alpha:[0,190,0]}),
];

export const CLAUDE_LOOKS=[
 vary(fx('Blades','fel-blade','Fel blade',1500),[
  {id:'original',name:'Fel flames',layers:[
   skin('Fel fire',tex('Flame4'),{axis:'v',band:.8,pulse:'flicker',strength:.95,tint:fel}),
   {...dust('Fel flames','flame',CLOUDS,{atlas:8,tint:fel}),starts:true,widthCap:.75,widthCapRimOnly:true,widthCapStrip:1.6},     // no airyFit (cbc)
   FEL_FLAME_CARDS,
  ]},
  // Fel surge is Fireball in fel colours now: global-animation-looks.js makes it from Fire's recipe.
  {id:'fel-sparks',name:'Fel sparks',layers:[
   skin('Fel fire',tex('Flame4'),{axis:'v',band:.8,pulse:'flicker',strength:.95,tint:fel}),
   nativeSpray('Rising sparks',tex('Star7b'),fel,
    {life:.6,rate:55,velocity:.03,gravity:-2.2,spread:35,size:[.18,.15,0],alpha:[255,255,0]},
    {starts:true,birthRegion:true,widthCap:1,loop:1733,
     native:{Time:.45,Variation:1,Flags:U,SegmentColor:[[.95,1,.6],[.5,1,.1],[.2,.9,0]]}}),
   nativeSpray('Fel motes',tex('star4_32'),fel,
    {life:1.4,rate:14,velocity:.1,gravity:-.4,spread:180,size:[.02,.07,.02],alpha:[0,255,0]},
    {starts:true,birthRegion:true,birthAcross:1.4,loop:2933,
     native:{Time:.5,Variation:.5,Flags:U,SegmentColor:[[1,1,.8],[.6,1,.2],[.2,.85,0]]}}),
  ]},
 ]),
 fx('Blades','tidal-blade','Tidal blade',2600,
  skin('Running water',water[0],{frames:water,water:true,axis:'v',strength:.85,tint:sea}),
  glow('Wet sheen',tex('Ice3b'),{pulse:'soft',strength:.45,tint:sea,loop:1733}),
  dust('Dripping water','drops',tex('WaterBlobs1'),{tint:sea,starts:true,...DRIP})),
 {...fx('Skins','magma-flow','Magma flow',3000,
  stone('Cooled rock','Dungeon\\Cave_DarkRocks'),
  skin('Lava flow',tex('Flame4'),{bodyUV:true,direction:90,strength:1,tint:lava}),
  glow('Heat glow',null,{pulse:'soft',strength:.4,tint:ember,inflate:.3,loop:3733}),
  nativeSpray('Cinders',tex('LavaLump'),[1,.5,.15],
   {life:2.4,rate:8,velocity:.14,gravity:-.22,spread:40,size:[.035,.028,.012],alpha:[220,170,60]},
   {starts:true,cover:'around',birthAcross:1,loop:3133,
    native:{Time:.5,Variation:.4,Flags:U,SegmentColor:[[1,.7,.25],[1,.35,.12],[.45,.07,.01]]}})),asOverlay:true},
 fx('Buffs & curses','wraith-form','Wraith form',3400,
  skin('Fading body',null,{base:true,own:true,pulse:'fade'}),
  skin('Drifting mist',tex('CloudsTile1'),{bodyUV:true,strength:.6,tint:ghost,loop:4533}),
  spray('Spirit wisps','Ghost1',ghost,{life:1.1,rate:7,area:.55,velocity:.25,spread:30,size:[.1,.24,.04]})),
 fx('Buffs & curses','corrupted-veins','Corrupted veins',2800,
  glow('Sickly glow',null,{pulse:'soft',strength:.42,tint:sick,inflate:.3,loop:3733}),
  skin('Fel veins',LIGHTNING2B,{axis:'v',band:.32,pulse:'beat',strength:1,tint:fel}),
  dust('Ichor drops','drops',tex('WaterBlobs1'),{tint:sick,...DRIP})),
 fx('Buffs & curses','blood-pact','Blood pact',1700,
  glow('Heartbeat',null,{pulse:'double',strength:1.1,tint:blood,inflate:.3}),
  {...rune('Pact mark',tex('DemonRune3'),'beat',blood),tint2:[.85,.12,.3],loop:2267},
  spray('Blood beads','BloodBlobs1',[.85,.2,.15],{life:.72,rate:7,area:.4,gravity:1.8,spread:16,filter:0,size:[.12,.32,.12]})),
 // Plague cloud (owner, 14 November: "needs more options"). It was one haze emitter. Five variations now, all built
 // on the zombie dragon breath's pair of pale and murky clouds.
 vary(fx('Around the unit','plague-swarm','Plague cloud',3000),[
  {id:'cloud',name:'Plague cloud',legacyLayers:[spray('Plague haze','CloudSingle',sick,{life:1.5,rate:8,area:.55,velocity:.3,size:[.2,.45,.65],alpha:[0,120,0]})],layers:[
   plagueCloud('Pale cloud',PALE,{rate:12}),
   plagueCloud('Murky cloud',MURK,{rate:9,life:2.8,alpha:120,size:[.22,.34,.46],cap:2.5,loop:3467}),
   plagueGlow(),
   plagueSpores(),
  ]},
  {id:'breath',name:'Plague breath',layers:[
   breath('Pale breath',CLOUDS,PALE,{rate:60}),
   breath('Murky breath',CLOUDS,MURK,{rate:45,loop:3467}),
   nativeSpray('Breath glow',tex('Green_Glow3'),[.4,.9,.3],
    {life:.6,rate:8,size:[.36,.45,.36],alpha:[0,90,0]},
    {starts:true,gather:'mouth',widthCap:1.3,loop:2933,native:{Time:.5,Flags:C}}),
   breathSpit('Spittle',tex('WaterBlobs1'),[[.7,1,.4],[.45,.75,.2],[.25,.5,.15]],{filter:0}),
  ]},
  {id:'miasma',name:'Sinking miasma',layers:[
   plagueCloud('Pale cloud',PALE,{rate:14,life:2.2,fall:.22,size:[.14,.26,.42]}),
   plagueCloud('Murky cloud',MURK,{rate:10,life:2.6,alpha:120,fall:.3,size:[.16,.3,.48],cap:2.5,loop:3467}),
   plagueGlow(),
   {...dust('Plague drips','drops',tex('WaterBlobs1'),{tint:[.42,.6,.15],starts:true,...DRIP}),amount:8},
  ]},
  {id:'spores',name:'Spore cloud',layers:[
   plagueCloud('Pale cloud',PALE,{rate:8,alpha:60}),
   plagueSpores(40,.5),
   nativeSpray('Spore glints',tex('star4_32'),[.6,1,.35],
    {life:.7,rate:12,size:[.02,.1,.02],alpha:[0,230,0]},
    {starts:true,cover:'cloud',birthAcross:1.4,widthCap:.7,loop:2267,native:{Time:.45,Flags:C,SegmentColor:[[1,1,.85],[.6,1,.35],[.25,.75,.2]]}}),
   plagueGlow(),
  ]},
  // The flies keep the clock of the Fly swarm look.
  {id:'swarm',name:'Buzzing cloud',loop:1233,layers:[
   plagueCloud('Murky cloud',MURK,{rate:10,life:2.8,alpha:120,size:[.22,.34,.46],cap:2.5,loop:3467}),
   plagueCloud('Pale cloud',PALE,{rate:7,alpha:70,loop:3000}),
   {...dust('Orbiting flies','flies',tex('Abomination')),starts:true},
  ]},
 ]),
 armour('runic-plate','Runic plate',4200,
  {...rune('Plate runes','Doodads\\Cinematic\\IcecrownObelisk\\glow_runes.blp','beat',rune_),tint2:[.6,.68,1]},
  glow('Rune light',tex('GenericGlow64'),{pulse:'soft',strength:.35,tint:rune_,inflate:.3,loop:2900})),
 armour('void-cracked','Void-cracked plate',2200,
  glow('Void cracks',LIGHTNING2B,{pulse:'beat',strength:1.6,tint:violet,tint2:[.5,.5,1],loop:2633}),
  glow('Dark aura',null,{pulse:'soft',strength:.4,tint:[.45,.3,.8],inflate:.3,loop:3133}),
  spray('Void splinters','Star7b',violet,{life:.68,rate:11,orbit:.39,tail:.09,size:[.14,.28,.04]})),
 armour('forge-hot','Forge-hot plate',1900,
  glow('Heat glow',null,{pulse:'soft',strength:.8,tint:ember,inflate:.3}),
  glow('Glowing seams',LIGHTNING2B,{pulse:'beat',strength:1.6,tint:ember,tint2:[1,.38,.3],loop:2033}),
  // Sparks dropping off the hot metal (Fireball's falling sparks, over the whole part).
  nativeSpray('Falling sparks',tex('Sparkle_Anim'),[1,.7,.2],
   {atlas:4,life:1.4,rate:12,velocity:.3,gravity:.7,spread:40,size:[.4,.2,.02],alpha:[100,150,0]},
   {starts:true,cover:'surface',widthCap:.7,loop:2533,
    native:{Time:.5,Variation:.25,Flags:U,LifeSpanUVAnim:[0,0,1],DecayUVAnim:[0,0,1],SegmentColor:[[1,.25,.05],[1,.8,.2],[1,.9,.3]]}})),
];
