// Looks built from the native effect techniques: glow shells, cards, crack beats, crossing energy,
// flame cards, lingering embers, orbit ribbons, ground decals. Native game textures only; the same
// data format as the library, so every FX control edits them. Each moving layer has its own clock
// and the clocks never divide each other.
import {cardSpec} from './fx-cards.js';

const tex=name=>'Textures\\'+name+'.blp';
const waterFrames=Array.from({length:8},(_,i)=>tex('Lords000'+i));
const skin=(label,image,extra={})=>({type:'Moving skin',label,image,...extra});
const glow=(label,image,extra={})=>({type:'Glow',label,image,...extra});
export const spray=(label,image,tint,spec,extra={})=>({type:'Particles',label,kind:'native',image,tint,nativeSpec:{texture:image,...spec},...extra});
export const orbit=(label,image,tint,extra)=>({type:'Edge',label,image,tint,orbit:true,...extra});
const starts=spec=>({...spec,starts:true});
const make=(id,name,loop,layers,extra={})=>({id:'fx-'+id,name,group:'',loop,palette:'native',layers,...extra});
// A look uses the first variation's layers by default.
export const vary=(look,variations)=>({...look,variations,layers:variations[0].layers});

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

const C=EMITTER_CARRIED;
const ghost=[0,.89,.09],soul=[.6,.9,1],zap=[.75,.88,1],crystal=[.53,.77,1];
// No lift: a copy pushed out along the normals of a hard-edged crystal comes apart at every edge (the tearing in test build 05).
const crystalFacets=filter=>skin('Crystal facets',tex('CrystalOpaque'),{fixed:true,bodyUV:true,filter,tint:crystal,strength:1});
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
  skin('Burning cracks','Doodads\\Cinematic\\EyeOfSargeras\\Demon_Rune_Cracks.blp',{fixed:true,bodyUV:true,pulse:'beat',tint:[1,.3,0],tint2:[1,.22,.12],strength:1}),
  glow('Crack heat','Doodads\\Cinematic\\EyeOfSargeras\\Demon_Rune_Cracks.blp',{bodyUV:true,filter:4,pulse:'beat',tint:[1,.55,.1],tint2:[1,.42,.3],strength:.7,loop:3333}),
  {...lingeringEmbers(),starts:true,cover:'around',birthAcross:1,amount:48},
  // Low flames from the cracks: a blended body under the light, as in Fireball, a third of a width tall.
  spray('Crack flames','ReplaceableTextures\\Weather\\Clouds8x8.blp',[1,.42,.08],
   {atlas:8,filter:0,life:.6,rate:44,velocity:.25,gravity:-.5,spread:25,size:[.5,.45,.15],alpha:[110,120,0]},
   {starts:true,cover:'surface',widthCap:.45,loop:2267,
    native:{Time:.45,Variation:.3,Flags:EMITTER_UNFOGGED,SegmentColor:[[1,.55,.12],[.98,.32,.05],[.5,.07,.02]]}}),
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
 // Pass 6 (14 November). The owner on build 05: huge on a body, flat on a weapon. The zap cards lay flat along the
 // part and repeated on every skin region, and the lifted shell grew with the part. Now three zaps circle the whole
 // part on rings sized to it (whole, reach, along), and what crackles between them is billboarded: thin streaks that
 // snap out of the surface at every angle, a soft charge on the surface, sparkles in the space around it.
 make('lightning-cage','Lightning cage',1240,[
  orbit('Cage arcs',tex('Zap1'),zap,{whole:true,reach:1.15,band:.22,along:-.28,orbitTurns:3,loop:1500,strength:.8,lasts:.25,smoothness:60}),
  orbit('Second arc',tex('Zap1'),zap,{whole:true,reach:1.3,band:.2,orbitTurns:3,loop:1300,strength:.8,lasts:.25,smoothness:60}),
  orbit('Third arc',tex('Zap1'),zap,{whole:true,reach:1.05,band:.22,along:.28,orbitTurns:3,loop:1700,strength:.8,lasts:.25,smoothness:60}),
  spray('Cage zaps',tex('Zap1'),zap,
   {life:.16,rate:30,velocity:1.1,spread:90,tail:.5,size:[.04,.08,.03],alpha:[255,255,0]},
   {starts:true,cover:'surface',loop:1533,
    native:{Time:.4,Variation:.5,FrameFlags:2,Flags:C,SegmentColor:[[1,1,1],[.6,.75,1],[.5,.1,1]]}}),
  spray('Charge glow',tex('Blue_Glow2'),[.45,.7,1],
   {life:.9,rate:12,size:[.2,.3,.22],alpha:[70,130,0]},
   {starts:true,cover:'surface',widthCap:1.2,loop:2133,native:{Time:.5,Flags:C}}),
  spray('Shell sparkles',tex('Sparkle_Anim'),zap,
   {atlas:4,life:.5,rate:16,velocity:.25,spread:180,size:[.03,.14,.03],alpha:[0,255,0]},
   {starts:true,cover:'around',birthAcross:1.3,widthCap:1,loop:1933,
    native:{Time:.4,Variation:.4,Flags:C,SegmentColor:[[1,1,1],[.75,.88,1],[.5,.6,1]]}}),
 ]),
 vary(make('lit-crystal','Lit crystal',3600,[],{asOverlay:true}),[
  {id:'light',name:'Inner light',layers:[crystalFacets(4),skin('Crystal light',tex('CrystalOpaque'),{fixed:true,bodyUV:true,filter:3,tint:crystal,strength:.7,pulse:'soft'}),facetGlints()]},
  {id:'team',name:'Team colour core',layers:[skin('Crystal core','ReplaceableTextures\\TeamColor\\TeamColor00.blp',{team:1,fixed:true,bodyUV:true,filter:0,unshaded:true,strength:1,tint:[1,1,1]}),crystalFacets(3),facetGlints()]},
  {id:'sparkle',name:'Sparkling facets',layers:[
   crystalFacets(4),
   skin('Crystal light',tex('CrystalOpaque'),{fixed:true,bodyUV:true,filter:3,tint:crystal,strength:.7,pulse:'soft'}),
   spray('Facet sparkles',tex('star4_32'),[.85,.95,1],
    {life:.5,rate:36,size:[.02,.14,.02],alpha:[0,255,0]},
    {starts:true,cover:'surface',widthCap:1.2,
     native:{Time:.4,Flags:C,SegmentColor:[[1,1,1],[.8,.93,1],[.53,.77,1]]}}),
   spray('Prism flares',tex('star5tga'),[.75,.8,1],
    {life:1.1,rate:6,size:[.03,.24,.03],alpha:[0,230,0]},
    {starts:true,cover:'surface',widthCap:2,loop:2933,
     native:{Time:.5,Flags:C,SegmentColor:[[1,1,1],[.7,.75,1],[.85,.6,1]]}}),
  ]},
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
 ],{asOverlay:true}),
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
