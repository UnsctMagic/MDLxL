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
const flames=(label,tint)=>dust(label,'flame','ReplaceableTextures\\Weather\\Clouds8x8.blp',{atlas:8,tint});

const fel=[.42,1,.22],sea=[.68,.9,1],lava=[1,.62,.3],ghost=[.62,.92,1],blood=[1,.18,.12],sick=[.5,.82,.22];
const rune_=[.4,.75,1],ember=[1,.5,.14],violet=[.72,.5,1];
const make=(group,id,name,loop,options,...layers)=>({id:'claude-'+id,name,group,loop,palette:'native',...options,layers});
const fx=(...a)=>make("Claude's FX",a[0],a[1],a[2],{},...a.slice(3));
// Armour keeps its own look underneath: every enhancement starts as an overlay.
const armour=(...a)=>make("Claude's armour",a[0],a[1],a[2],{asOverlay:true},...a.slice(3));

// Offered in Particles → Add emitter.
export const CLAUDE_EMITTERS=[
 spray('Storm cloud','CloudSingle',[.36,.38,.46],{life:1.6,rate:7,area:.5,height:.9,velocity:.08,filter:0,size:[.3,.55,.7],alpha:[0,190,0]}),
];

export const CLAUDE_LOOKS=[
 fx('fel-blade','Fel blade',1500,
  skin('Fel fire',tex('Flame4'),{axis:'v',band:.8,pulse:'flicker',strength:.95,tint:fel}),
  flames('Fel flames',fel),
  {...edge('Fel edge',fel,.3),enabled:false}),
 fx('tidal-blade','Tidal blade',2600,
  skin('Running water',water[0],{frames:water,water:true,axis:'v',strength:.85,tint:sea}),
  glow('Wet sheen',tex('Ice3b'),{pulse:'breathe',strength:.45,tint:sea}),
  dust('Dripping water','drops',tex('WaterBlobs1'),{tint:sea})),
 {...fx('magma-flow','Magma flow',3000,
  stone('Cooled rock','Dungeon\\Cave_DarkRocks'),
  skin('Lava flow',tex('Flame4'),{bodyUV:true,direction:90,strength:1,tint:lava})),asOverlay:true},
 fx('wraith-form','Wraith form',3400,
  skin('Fading body',null,{base:true,own:true,pulse:'fade'}),
  skin('Drifting mist',tex('CloudsTile1'),{bodyUV:true,strength:.6,tint:ghost}),
  spray('Spirit wisps','Ghost1',ghost,{life:1.1,rate:7,area:.55,velocity:.25,spread:30,size:[.1,.24,.04]})),
 fx('corrupted-veins','Corrupted veins',2800,
  glow('Sickly glow',null,{pulse:'breathe',strength:.42,tint:sick}),
  skin('Fel veins',tex('Lightning2b'),{axis:'v',band:.32,pulse:'breathe',strength:1,tint:fel}),
  dust('Ichor drops','drops',tex('WaterBlobs1'),{tint:sick})),
 fx('blood-pact','Blood pact',1700,
  glow('Heartbeat',null,{pulse:'double',strength:1.1,tint:blood}),
  rune('Pact mark',tex('DemonRune3'),'double',blood),
  spray('Blood beads','BloodBlobs1',[.85,.2,.15],{life:.72,rate:7,area:.4,gravity:1.8,spread:16,filter:0,size:[.06,.16,.06]})),
 fx('plague-swarm','Plague swarm',3000,
  spray('Plague haze','CloudSingle',sick,{life:1.5,rate:8,area:.55,velocity:.3,filter:0,size:[.2,.45,.65],alpha:[0,185,0]})),
 armour('runic-plate','Runic plate',4200,
  rune('Plate runes','Doodads\\Cinematic\\IcecrownObelisk\\glow_runes.blp','breathe',rune_),
  glow('Rune light',tex('GenericGlow64'),{pulse:'breathe',strength:.35,tint:rune_})),
 armour('void-cracked','Void-cracked plate',2200,
  glow('Void cracks',tex('Lightning2b'),{pulse:'flicker',strength:1.6,tint:violet}),
  glow('Dark aura',null,{pulse:'breathe',strength:.4,tint:[.45,.3,.8]}),
  spray('Void splinters','Star7b',violet,{life:.68,rate:11,orbit:.39,tail:.09,size:[.07,.14,.02]})),
 armour('forge-hot','Forge-hot plate',1900,
  glow('Heat glow',null,{pulse:'flicker',strength:.8,tint:ember}),
  glow('Glowing seams',tex('Lightning2b'),{pulse:'breathe',strength:1.6,tint:ember})),
];
