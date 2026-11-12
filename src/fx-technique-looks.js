// Looks built from the native effect techniques: glow shells, cards, crack beats, crossing energy,
// flame cards, lingering embers, orbit ribbons, ground decals. Native game textures only; the same
// data format as the library, so every FX control edits them. Each moving layer has its own clock
// and the clocks never divide each other.
import {cardSpec} from './fx-cards.js';

const tex=name=>'Textures\\'+name+'.blp';
const waterFrames=Array.from({length:8},(_,i)=>tex('Lords000'+i));
const skin=(label,image,extra={})=>({type:'Moving skin',label,image,...extra});
const glow=(label,image,extra={})=>({type:'Glow',label,image,...extra});
const spray=(label,image,tint,spec,extra={})=>({type:'Particles',label,kind:'native',image,tint,nativeSpec:{texture:image,...spec},...extra});
const orbit=(label,image,tint,extra)=>({type:'Edge',label,image,tint,orbit:true,...extra});
const starts=spec=>({...spec,starts:true});
const make=(id,name,loop,layers,extra={})=>({id:'fx-'+id,name,group:'',loop,palette:'native',layers,...extra});
const vary=(look,variations)=>({...look,variations,layers:variations[0].layers});

// Emitter flags: Unshaded, Unfogged, and Carry (stays with the part).
export const EMITTER_UNFOGGED=4096|32768|262144,EMITTER_CARRIED=EMITTER_UNFOGGED|524288;
/** Fire emitters: alpha holds then drops, the middle point at half life, life frames 0-40 and decay frames 41-63 of the 8x8 atlas. */
export const FLAME_NATIVE={Alpha:[255,255,0],Time:.5,LifeSpanUVAnim:[0,40,1],DecayUVAnim:[41,63,1],Flags:EMITTER_UNFOGGED};
/** Lingering embers: alpha 200>150>80, never fading to nothing. */
export const EMBER_NATIVE={Alpha:[200,150,80],Flags:EMITTER_UNFOGGED};
/** Drops that read as water: larger, falling with gravity, a streak tail behind each. */
export const DRIP={amount:12,lasts:1.1,scale:{size:2.8,gravity:1.3},native:{Alpha:[255,245,0],FrameFlags:3,TailLength:.08,Time:.5}};
const FIRE=[1,.55,.15],FEL=[.52,1,0];
/** Flipbook flame cards: a 4x4 smoke picture stepped every 75 ms, each card throbbing on its own fast clock. */
export const flameCards=(tint=FIRE)=>cardSpec('Flame cards',tex('clouds_anim1_bw'),{count:3,rows:4,columns:4,frameMs:105,sizeMin:.9,sizeMax:1.12,loop:520,fit:.6,tint});
export const lingeringEmbers=(label='Lingering embers',tint=[1,.62,.25])=>spray(label,tex('LavaLump'),tint,{life:2.5,rate:4,area:.6,velocity:.12,gravity:-.25,spread:40,size:[.16,.1,.04],alpha:[200,150,80]},{native:EMBER_NATIVE});
const glowOrb=(label,tint)=>spray(label,tex('GenericGlowX'),tint,{life:.8,rate:6,area:.05,velocity:.04,spread:2,size:[.05,.35,.6],alpha:[150,220,100]},{native:{Flags:EMITTER_CARRIED}});
export const FEL_FLAME_CARDS={...flameCards(FEL),enabled:false},FIRE_FLAME_CARDS={...flameCards(FIRE),enabled:false};
export const orbSpray=()=>glowOrb('Glow orbs',[.75,.62,1]);
export const fireHair=()=>spray('Fire hair',tex('clouds_anim1_bw'),FIRE,
 {atlas:4,life:1.8,rate:12,area:.2,velocity:.3,gravity:-.12,spread:14,size:[.4,.28,.06],alpha:[255,255,0]},
 {native:{...FLAME_NATIVE,LifeSpanUVAnim:[0,7,1],DecayUVAnim:[8,15,1],SegmentColor:[[1,.85,.45],FIRE,[.6,.08,.01]]}});

// Element art and motion are data; technique builders own roles and geometry.
const CLOUDS='ReplaceableTextures\\Weather\\Clouds8x8.blp';
const FLOW='UI\\Glues\\SinglePlayer\\TutorialCampaign3D\\cloudstile1.blp';
export const ELEMENTS={
 fire:{tint:FIRE,core:CLOUDS,atlas:8,back:tex('Red_Glow3'),fleck:tex('LavaLump'),wrap:tex('CloudSingle'),surface:FLOW,airy:CLOUDS,airyAtlas:8},
 frost:{tint:[.55,.8,1],core:tex('Ice3b'),back:tex('Flare'),fleck:tex('Frost3'),wrap:tex('CloudSingle'),wrap2:tex('Ice3b'),surface:tex('Ice_Icedull'),airy:CLOUDS,airyAtlas:8,structure:tex('Ice_Icedull'),gravity:1.2,moving:{gravity:.35,velocity:.03},airyMotion:{gravity:.9,velocity:.08},coreMotion:{velocity:.06},secondary:{gravity:.55,velocity:.03}},
 lightning:{tint:[.65,.8,1],core:tex('LightningBall'),back:tex('Zap1'),fleck:tex('Star7b'),surface:'Doodads\\Cinematic\\Lightningbolt\\Lightning4b.blp',airy:tex('Zap1'),noWrap:true,life:.22,gravity:.2,moving:{life:.18,rate:12,velocity:.12,gravity:0,size:[.07,.1,0]},airyMotion:{life:.18,rate:15,velocity:.3,gravity:.15},coreMotion:{life:.22,rate:24}},
 arcane:{tint:[.7,.5,1],core:tex('DarkPortal03'),back:tex('Flare'),fleck:tex('Star7b'),wrap:tex('CloudSingle'),wrap2:FLOW,surface:FLOW,underlay:tex('DarkPortal03'),airy:CLOUDS,airyAtlas:8},
 fel:{tint:[.42,1,.22],core:CLOUDS,atlas:8,back:tex('Green_Glow3'),fleck:tex('Star7b'),wrap:tex('CloudSingle'),surface:FLOW,airy:CLOUDS,airyAtlas:8},
 poison:{tint:[.45,.64,.16],core:tex('CloudSingle'),back:tex('CloudSingle'),fleck:tex('Bubble'),wrap:tex('CloudSingle'),surface:'TerrainArt\\Felwood\\Felwood_Poison.blp',airy:tex('CloudSingle'),alpha:.4,gravity:.7,flow:.25,surfaceFilter:2,moving:{gravity:-.2,velocity:.06,life:1.2,rate:7},airyMotion:{gravity:-.08,velocity:.05,life:1.1,rate:12},coreMotion:{velocity:.04,rate:18},secondary:{gravity:-.12,velocity:.03}},
 lava:{tint:[1,.36,.08],core:tex('LavaLump'),back:tex('Red_Glow3'),fleck:tex('LavaLump'),wrap:tex('CloudSingle'),wrap2:tex('LavaLump'),surface:'TerrainArt\\Dungeon\\Cave_Lava.blp',airy:tex('LavaLump'),gravity:2.4,flow:.2,heavy:true,surfaceFilter:2,wrapSurface:true,moving:{gravity:1.8,velocity:.18,rate:5,life:1.1},airyMotion:{gravity:2.4,velocity:.6,rate:9,life:.65},secondary:{gravity:2.4,velocity:.3}},
 water:{tint:[.55,.8,1],core:tex('WaterBlobs1'),back:tex('Flare'),fleck:tex('WaterBlobs1'),wrap:tex('CloudSingle'),wrap2:tex('WaterBlobs1'),surface:tex('Lords0000'),airy:tex('WaterBlobs1'),gravity:1.8,filter:0,surfaceFilter:2,moving:{gravity:1.8,velocity:.05,rate:9,life:.55},airyMotion:{gravity:1.8,velocity:.35,rate:20,life:.5},secondary:{gravity:1.8,velocity:.2,life:.7}},
 crystal:{tint:[.65,.8,1],core:tex('Flare'),back:tex('Flare'),fleck:tex('Star7b'),surface:tex('Flare'),airy:tex('Star7b'),structure:tex('CrystalOpaque'),noWrap:true,life:.35,gravity:0,moving:{gravity:0,velocity:.025,rate:8,size:[.04,.075,0]},airyMotion:{gravity:0,velocity:.02,rate:9,size:[.04,.08,0]},coreMotion:{velocity:0,rate:9},secondary:{gravity:0,velocity:.025,life:.8}},
};
const role=(spec,technique,name)=>({...spec,technique,recipeRole:name});
export function elementTechnique(element,technique){
 const e=ELEMENTS[element],alpha=values=>values.map(v=>Math.round(v*(e.alpha??1)));
 const particle=(roleId,name,image,spec,extra={})=>({...role(starts(spray(name,image,e.tint,{filter:e.filter??1,...spec,alpha:alpha(spec.alpha)},extra)),technique,roleId),recipeKey:element+'/'+technique+'/'+roleId,menuLabel:name+' ('+element[0].toUpperCase()+element.slice(1)+')'});
 const structure=e.structure?[role(skin('Fixed facets',e.structure,{fixed:true,bodyUV:true,filter:2,strength:.9,tint:e.tint}),technique,'structure')]:[];
 const surface=()=>role(skin('Moving surface',e.surface,{bodyUV:true,filter:e.surfaceFilter??3,speed:e.flow??.65,strength:.65,tint:e.tint,loop:2600}),technique,'surface');
 if(technique==='compact')return [...structure,
  particle('core','Compact core',e.core,{atlas:e.atlas,life:.5,rate:50,area:0,velocity:.32,spread:5,size:[.4,.3,.2],alpha:[255,150,100],...e.coreMotion},{focusedEmitter:true,native:{Time:.5,Variation:.15,Flags:EMITTER_UNFOGGED}}),
  particle('backing','Backing glow',e.back,{life:.75,rate:7,area:0,velocity:.07,spread:2,size:[.7,.5,.4],alpha:[180,150,80]},{focusedEmitter:true,native:{Flags:EMITTER_CARRIED}}),
  particle('secondary','Secondary particles',e.fleck,{life:2.4,rate:3,area:0,velocity:.24,gravity:e.gravity??.65,spread:65,size:[.055,.04,.025],alpha:[255,200,100],...e.secondary},{focusedEmitter:true,loop:3133}),
 ];
 if(technique==='enveloping')return [...structure,...(e.wrapSurface?[surface()]:[]),
  particle('wrap-core','Enveloping core',e.wrap,{life:1,rate:30,width:.2,length:.8,velocity:.15,spread:0,size:[.24,.17,.12],alpha:[210,210,210]},{birthRegion:true,native:{Variation:0,Time:0,Flags:EMITTER_CARRIED}}),
  particle('wrap-outer','Enveloping particles',e.wrap2||e.wrap,{life:.5,rate:30,width:.2,length:.8,velocity:.23,spread:0,size:[.24,.17,.12],alpha:[210,210,210]},{birthRegion:true,loop:2133,native:{Variation:0,Time:0,Flags:EMITTER_UNFOGGED}}),
 ];
 if(technique==='moving')return [...structure,...(e.underlay?[role(skin('Energy underlay',e.underlay,{fixed:true,bodyUV:true,filter:4,strength:.6,tint:e.tint}),technique,'underlay')]:[]),surface(),
  particle('surface-particles','Surface particles',e.fleck,{life:.6,rate:18,width:.1,length:.8,velocity:.035,gravity:e.gravity??-.8,spread:35,size:[.09,.09,0],alpha:[180,200,0],...e.moving},{birthRegion:true,loop:1733}),
 ];
 return [...structure,particle('airy','Airy particles',e.airy,{atlas:e.airyAtlas,life:e.life??.58,rate:34,area:.06,velocity:e.heavy?.6:.45,gravity:e.gravity??1.4,spread:24,size:[.16,.17,.04],alpha:[58,64,0],...e.airyMotion},{airyFit:{version:1},native:{Time:.36,Flags:EMITTER_UNFOGGED}}),
  ...(e.airy!==e.fleck?[particle('flecks','Drifting flecks',e.fleck,{life:.7,rate:5,area:0,velocity:.1,gravity:e.gravity??.5,spread:30,size:[.025,.03,0],alpha:[100,120,0]},{loop:2533})]:[]),
 ];
}
export function withElementTechniques(look){
 if(!look.element)return look;
 const techniques=['airy','compact',...(!ELEMENTS[look.element].noWrap?['enveloping']:[]),'moving'];
 const names={airy:'Airy directional',compact:'Compact core',enveloping:'Enveloping',moving:'Moving surface'};
 const variations=look.variations||[{id:'original',name:look.name,layers:look.layers}];
 return {...look,variations:[...variations,...techniques.filter(id=>!variations.some(v=>v.technique===id)).map(id=>({id:'technique-'+id,name:names[id],technique:id,layers:elementTechnique(look.element,id)}))]};
}
export const ENVELOPING_FIRE=elementTechnique('fire','enveloping');
export const FIREBALL=elementTechnique('fire','compact');
export const SHIMMERING_ENERGY=elementTechnique('arcane','moving');

const ghost=[0,.89,.09],soul=[.6,.9,1],zap=[.75,.88,1],crystal=[.53,.77,1];
const crystalFacets=filter=>skin('Crystal facets',tex('CrystalOpaque'),{fixed:true,bodyUV:true,filter,inflate:.11,tint:crystal,strength:1});
const facetGlints=()=>cardSpec('Facet glints',tex('star4'),{count:3,fit:.35,sizeMin:.75,sizeMax:1.05,loop:1700,tint:[.85,.95,1]});

export const TECHNIQUE_LOOKS=[
 make('glow-shell','Glow shell',3333,[
  glow('Glow shell',tex('GenericGlow64'),{atlasRect:[.5,.1,.5,.8],inflate:.3,pulse:'soft',strength:1,tint:[.55,.8,1],shell:true}),
  glow('Inner glow',null,{strength:.6,pulse:'soft',loop:5167,enabled:false}),
 ],{asOverlay:true}),
 make('star-flare','Star flare',1600,[
  cardSpec('Flare',tex('star4'),{fit:1.1,sizeMin:.82,sizeMax:1.17,tint:[1,.95,.85]}),
  cardSpec('Spinning star',tex('star5tga'),{fit:.8,spin:2,sizeMin:.9,sizeMax:1.1,loop:1433,tint:[1,1,1]}),
 ]),
 make('glow-orb','Glow orb',1600,[
  cardSpec('Glow orb',tex('GenericGlow64'),{fit:1,sizeMin:.83,sizeMax:1.17,tint:[.7,.85,1]}),
  cardSpec('Orb core',tex('Flare'),{fit:.45,sizeMin:.9,sizeMax:1.12,loop:1133,tint:[1,1,1]}),
  starts(glowOrb('Orb light',[.7,.85,1])),
 ]),
 make('burning-cracks','Burning cracks',2000,[
  skin('Burning cracks','Doodads\\Cinematic\\EyeOfSargeras\\Demon_Rune_Cracks.blp',{fixed:true,bodyUV:true,pulse:'beat',tint:[1,.3,0],tint2:[1,.22,.12],inflate:.12,strength:1}),
  glow('Crack heat','Doodads\\Cinematic\\EyeOfSargeras\\Demon_Rune_Cracks.blp',{bodyUV:true,filter:4,pulse:'beat',tint:[1,.55,.1],tint2:[1,.42,.3],inflate:.2,strength:.7,loop:3333}),
  starts(lingeringEmbers()),
  FIRE_FLAME_CARDS,
 ],{asOverlay:true}),
 make('fire-column','Fire column',1500,[
  starts(spray('Fire column',tex('Clouds8x8Fire'),[1,.6,.2],{atlas:8,life:.6,rate:40,area:.25,velocity:1.1,gravity:-1.5,spread:12,size:[.42,.34,.14],alpha:[255,255,0]},{native:{Time:.5,Flags:EMITTER_UNFOGGED}})),
  starts(lingeringEmbers('Column embers')),
  glow('Heat glow',null,{pulse:'soft',strength:.5,inflate:.3,tint:[1,.5,.15],enabled:false}),
  FIRE_FLAME_CARDS,
 ]),
 make('energy-flow','Energy flow',5000,[
  skin('Energy flow','ReplaceableTextures\\Weather\\Lightning.blp',{axis:'v',speed:3,strength:.85,tint:[.45,.75,1]}),
  skin('Crossing flow','ReplaceableTextures\\Weather\\Lightning.blp',{direction:60,speed:2,strength:.6,tint:[.6,.5,1],loop:3533}),
  glow('Energy glow',null,{pulse:'soft',strength:.5,inflate:.3,loop:2633,tint:[.5,.65,1],enabled:false}),
 ],{asOverlay:true}),
 make('lightning-cage','Lightning cage',1240,[
  cardSpec('Zap cards',tex('Zap1'),{facing:'part',count:4,jitter:150,fit:1.3,sizeMin:.9,sizeMax:1.1,loop:1033,tint:zap}),
  orbit('Cage arcs',tex('Zap1'),zap,{orbitTurns:3,loop:1500,fit:.8,strength:.8,lasts:.25}),
 ]),
 vary(make('lit-crystal','Lit crystal',3600,[],{asOverlay:true,element:'crystal'}),[
  {id:'light',name:'Inner light',layers:[crystalFacets(4),skin('Crystal light',tex('CrystalOpaque'),{fixed:true,bodyUV:true,filter:3,inflate:.13,tint:crystal,strength:.7,pulse:'soft'}),facetGlints()]},
  {id:'team',name:'Team colour core',layers:[skin('Crystal core','ReplaceableTextures\\TeamColor\\TeamColor00.blp',{team:1,fixed:true,bodyUV:true,filter:0,unshaded:true,inflate:.05,strength:1,tint:[1,1,1]}),crystalFacets(3),facetGlints()]},
 ]),
 make('dark-smoke','Dark smoke',4200,[
  starts(spray('Dark smoke',tex('Clouds8x8Black'),[.12,.1,.12],{atlas:8,filter:0,life:1.9,rate:9,area:.5,velocity:.18,gravity:-.06,spread:25,size:[.2,.32,.75],alpha:[170,170,0]})),
  glow('Shadow',tex('GenericGlow64'),{atlasRect:[.5,.1,.5,.8],filter:2,tint:[.06,.04,.08],strength:.7,inflate:.3,pulse:'soft'}),
 ],{asOverlay:true}),
 make('hollow-shell','Hollow shell',3300,[
  skin('Dark hollow',tex('GenericGlowX_Mod2'),{fixed:true,bodyUV:true,filter:5,inflate:.3,strength:1,tint:[1,1,1]}),
  glow('Shade',tex('Shade'),{bodyUV:true,filter:4,inflate:.21,tint:[.62,.92,1],strength:.7,pulse:'soft'}),
  skin('Dust veil',tex('Dust5ABlack'),{bodyUV:true,filter:2,inflate:.37,strength:.6,tint:[1,1,1],loop:5167}),
 ],{asOverlay:true}),
 make('ghost-trails','Ghost trails',3300,[
  orbit('Ghost trail',tex('GraveYardGhost'),ghost,{orbitTurns:3,strength:.6,lasts:.5}),
  orbit('Second trail',tex('GraveYardGhost'),ghost,{orbitTurns:3,loop:3200,fit:.8,strength:.6,lasts:.5}),
  orbit('Third trail',tex('GraveYardGhost'),ghost,{orbitTurns:3,loop:3700,fit:1.2,strength:.6,lasts:.5}),
 ]),
 make('soul-vortex','Soul vortex',2800,[
  orbit('Soul stream',tex('RibbonBlur1'),soul,{orbitTurns:2,strength:.6,lasts:.6}),
  orbit('Second stream',tex('RibbonBlur1'),soul,{orbitTurns:2,loop:3100,fit:.75,strength:.6,lasts:.6}),
  starts(spray('Inward souls',tex('Tornado2b'),[.75,.95,1],{flat:true,life:.8,rate:4.5,velocity:-.15,spread:.5,size:[1.3,.95,.28],alpha:[100,160,186]},{ground:true})),
 ]),
 make('ground-glow','Ground glow',1600,[
  cardSpec('Ground glow','ReplaceableTextures\\TeamGlow\\TeamGlow00.blp',{team:2,facing:'ground',count:2,sizeMin:.83,sizeMax:1.17,strength:.75,tint:[1,1,1]}),
 ]),
 make('rune-circle','Rune circle',1267,[
  cardSpec('Shadow disc','Units\\NightElf\\EvilIllidan\\Shadow.blp',{facing:'ground',filter:2,strength:.5,fit:1.75,sizeMin:1,sizeMax:1,unshaded:false,loop:1733,tint:[1,1,1]}),
  cardSpec('Rune circle',tex('AuraRune7Green'),{facing:'ground',sizeMin:.83,sizeMax:1.06,spin:.1,spinEased:false,tint:[1,1,1]}),
  starts(spray('Rune rings',tex('AuraRune7Green'),[.24,.82,.19],{flat:true,life:1.4,rate:2.5,velocity:.05,gravity:.05,size:[2.592,2.376,1.944],alpha:[0,255,40]},{ground:true})),
 ]),
 make('liquid-body','Liquid body',1992,[
  skin('Water body',waterFrames[0],{frames:waterFrames,bodyUV:true,filter:2,strength:.8,tint:[.65,.83,.99]}),
  skin('Water shimmer',waterFrames[0],{frames:waterFrames,bodyUV:true,filter:3,strength:.5,direction:90,loop:1320,tint:[.85,.95,1]}),
  cardSpec('Water glints',tex('Blue_Glow2'),{count:4,fit:.4,sizeMin:.85,sizeMax:1.15,loop:2767,tint:[.8,.9,1]}),
  ...elementTechnique('water','moving').filter(l=>l.type==='Particles'),
 ],{asOverlay:true,element:'water'}),
 make('eye-glow','Eye glow',1300,[
  cardSpec('Left eye',tex('Flare'),{fit:.25,sizeMin:.9,sizeMax:1.1,tint:[1,.3,.12]}),
  cardSpec('Right eye',tex('Flare'),{fit:.25,sizeMin:.9,sizeMax:1.1,loop:1433,tint:[1,.3,.12]}),
  spray('Eye sparks',tex('Flare'),[1,.3,.12],{life:.5,rate:10,velocity:.15,size:[.18,.14,.1],alpha:[200,180,150]},{native:{Flags:EMITTER_CARRIED}}),
 ]),
 vary(make('tint','Tint',3000,[]),[
  {id:'wash',name:'Colour wash',layers:[skin('Colour wash',null,{own:true,fixed:true,filter:2,strength:.5,tint:[.55,.75,1]})]},
  {id:'team',name:'Team colour',layers:[skin('Team colour wash','ReplaceableTextures\\TeamColor\\TeamColor00.blp',{team:1,fixed:true,bodyUV:true,filter:2,strength:.3,tint:[1,1,1]})]},
 ]),
];
