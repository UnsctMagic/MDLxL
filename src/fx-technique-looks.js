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
// sharedSites: on a body the ribbon rides its longest skin regions, not every bone.
export const orbit=(label,image,tint,extra)=>({type:'Edge',label,image,tint,orbit:true,sharedSites:true,...extra});
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
// The owner's zombie dragon breath (14 November): clouds born dense and thinning (alpha 123 > 60 > 0) while they grow
// by half, on the first frames of the cloud sheet only (0-6, then 7-12), sorted far to near, fired in a narrow cone.
export const EMITTER_SORTED=4096|32768|65536,PUFF_FRAMES={LifeSpanUVAnim:[0,6,1],DecayUVAnim:[7,12,1]};
/** A breath: a stream of cloud from the part's far end, about five and a half cloud widths long on any part (capMotion). */
export const breath=(label,image,ramp,{rate=60,filter=0,alpha=[123,60,0],frames=PUFF_FRAMES,flags=EMITTER_SORTED,loop,priority}={})=>spray(label,image,ramp[1],
 {atlas:8,filter,life:1.1,rate,velocity:1.75,spread:20,size:[.25,.3,.35],alpha},
 {starts:true,gather:'tip',aim:'tip',widthCap:1.1,capMotion:true,...(loop?{loop}:{}),native:{Time:.5,Variation:.1,...frames,Flags:flags,...(priority!=null?{PriorityPlane:priority}:{}),SegmentColor:ramp}});
/** What a breath carries: small sprites thrown along the stream (capMotion 3.14 keeps them at the stream's speed). */
export const breathSpit=(label,image,ramp,{rate=14,filter=1,fall=1,size=[.05,.04,.02],tail=.12,cap=.3,loop=2133}={})=>spray(label,image,ramp[1],
 {filter,life:.9,rate,velocity:1.6,gravity:fall,spread:22,tail,size,alpha:[255,230,0]},
 {starts:true,gather:'tip',aim:'tip',widthCap:cap,capMotion:3.14,loop,native:{Time:.5,Variation:.4,Flags:EMITTER_UNFOGGED,SegmentColor:ramp}});
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
// No lift (the tearing in test build 05): a copy a hair off the surface fights it for depth, and on a hard-edged
// crystal a copy pushed out along the normals opens at every edge. On the surface itself neither can happen.
const crystalFacets=filter=>skin('Crystal facets',tex('CrystalOpaque'),{fixed:true,bodyUV:true,filter,tint:crystal,strength:1});
// Glints were three cards in a row down the middle of every skin region: evenly spaced dots. They bloom anywhere on the
// surface now, like Sparkling facets, a few at a time.
const facetGlints=()=>spray('Facet glints',tex('star4'),[.85,.95,1],
 {life:.8,rate:9,size:[.03,.2,.03],alpha:[0,240,0]},
 {starts:true,cover:'surface',widthCap:1.4,loop:1933,native:{Time:.45,Flags:C,SegmentColor:[[1,1,1],[.85,.95,1],[.53,.77,1]]}});

// Team colour (pass 7, 14 November). The player's colour exists only as two native replaceable pictures: the flat
// colour (team 1) and the round glow (team 2). Everything here is made of those two, the way the owner's Eldritch
// Covenant does it: the flat colour added over a surface so it glows, the colour travelling over it, the glow as a
// shell, and the glow as the sprite of every particle.
const TEAM_COLOUR='ReplaceableTextures\\TeamColor\\TeamColor00.blp',TEAM_GLOW='ReplaceableTextures\\TeamGlow\\TeamGlow00.blp';
const WHITE=[[1,1,1],[1,1,1],[1,1,1]];
const teamSpray=(label,spec,extra={})=>spray(label,TEAM_GLOW,[1,1,1],{team:true,...spec},{starts:true,...extra,native:{SegmentColor:WHITE,...extra.native}});
const teamShell=(label='Team shell',strength=.8,extra={})=>glow(label,TEAM_GLOW,{team:2,atlasRect:[.5,.1,.5,.8],inflate:.3,pulse:'soft',strength,tint:[1,1,1],shell:true,...extra});
const teamMotes=(extra={})=>teamSpray('Team motes',
 {life:1.4,rate:12,velocity:.08,gravity:-.1,spread:180,size:[.02,.07,.02],alpha:[0,255,0]},
 {cover:'around',birthAcross:1.4,widthCap:.5,loop:2933,...extra,native:{Time:.5,Variation:.5,Flags:EMITTER_CARRIED}});

export const TECHNIQUE_LOOKS=[
 vary(make('glow-shell','Glow shell',3333,[],{asOverlay:true}),[
  {id:'shell',name:'Glow shell',layers:[
   glow('Glow shell',tex('GenericGlow64'),{atlasRect:[.5,.1,.5,.8],inflate:.3,pulse:'soft',strength:1,tint:[.55,.8,1],shell:true}),
   glow('Inner glow',null,{strength:.6,pulse:'soft',loop:5167,enabled:false}),
  ]},
  // The owner (14 November): "Glowshell - can have also team color". The same shell and inner glow in the player's colour.
  {id:'team',name:'Team colour',layers:[
   teamShell('Glow shell',1),
   glow('Inner glow',TEAM_COLOUR,{team:1,bodyUV:true,strength:.3,pulse:'soft',tint:[1,1,1],loop:5167,enabled:false}),
  ]},
 ]),
 vary(make('team-colour','Team colour',3000,[],{asOverlay:true}),[
  {id:'wash',name:'Colour wash',layers:[
   skin('Team colour wash',TEAM_COLOUR,{team:1,fixed:true,bodyUV:true,filter:2,strength:.35,tint:[1,1,1]}),
  ]},
  {id:'glow',name:'Glowing colour',layers:[
   glow('Team light',TEAM_COLOUR,{team:1,bodyUV:true,pulse:'soft',strength:.45,tint:[1,1,1]}),
   teamShell('Team shell',.8,{loop:4133}),
  ]},
  // Two layers of the round glow, repeated and crossing: the colour flows over the part (Arcane's two crossing energies).
  {id:'flow',name:'Flowing light',layers:[
   skin('Flowing light',TEAM_GLOW,{team:2,teamTile:true,bodyUV:true,tiling:2,direction:35,strength:.8,tint:[1,1,1]}),
   skin('Crossing light',TEAM_GLOW,{team:2,teamTile:true,bodyUV:true,tiling:3,direction:140,strength:.5,tint:[1,1,1],loop:4733}),
  ]},
  {id:'bands',name:'Running bands',layers:[
   skin('Running bands',TEAM_GLOW,{team:2,teamTile:true,axis:'v',band:.3,tiling:2,speed:2,strength:.9,tint:[1,1,1],loop:2400}),
   teamShell('Team shell',.5,{loop:4133}),
  ]},
 ]),
 vary(make('team-lights','Team lights',3000,[]),[
  {id:'orbs',name:'Glow orbs',layers:[
   teamSpray('Team orbs',
    {life:.9,rate:14,velocity:.04,spread:2,size:[.05,.2,.3],alpha:[110,170,60]},
    {cover:'surface',widthCap:.9,native:{Flags:EMITTER_CARRIED}}),
   teamMotes(),
  ]},
  {id:'sparks',name:'Rising sparks',layers:[
   teamSpray('Team sparks',
    {life:.6,rate:55,velocity:.03,gravity:-2.2,spread:35,size:[.18,.15,0],alpha:[255,255,0]},
    {birthRegion:true,widthCap:1,loop:1733,native:{Time:.45,Variation:1,Flags:EMITTER_UNFOGGED}}),
   teamMotes(),
  ]},
  {id:'flames',name:'Team flames',layers:[
   teamSpray('Team flames',
    {life:.6,rate:70,velocity:.25,gravity:-1.6,spread:14,size:[.2,.16,.03],alpha:[200,160,0]},
    {cover:'surface',widthCap:.9,capMotion:true,native:{Time:.4,Variation:.4,Flags:EMITTER_UNFOGGED}}),
   teamSpray('Flame glow',
    {life:1,rate:10,size:[.3,.4,.3],alpha:[0,70,0]},
    {cover:'surface',widthCap:1.4,loop:2533,native:{Time:.5,Flags:EMITTER_CARRIED}}),
   teamMotes({loop:3467}),
  ]},
  {id:'leaping',name:'Leaping sparks',layers:[
   teamSpray('Team streaks',
    {life:.45,rate:30,velocity:2.4,gravity:12,spread:60,tail:.12,size:[.02,.07,.03],alpha:[255,255,255]},
    {cover:'surface',loop:1533,native:{Time:.2,Variation:.5,FrameFlags:2,Flags:EMITTER_UNFOGGED}}),
   teamSpray('Flame glow',
    {life:1,rate:10,size:[.3,.4,.3],alpha:[0,70,0]},
    {cover:'surface',widthCap:1.4,loop:2533,native:{Time:.5,Flags:EMITTER_CARRIED}}),
  ]},
 ]),
 // Glow orb and Star flare in the player's colour: the glow is the team picture, the core and the star stay white.
 vary(make('team-orb','Team orb',1600,[]),[
  {id:'orb',name:'Orb',layers:[
   teamSpray('Orb glow',
    {life:1.4,rate:5,size:[.9,1,.9],alpha:[0,170,0]},
    {gather:'engulf-core',widthCap:2.2,native:{Time:.5,Flags:EMITTER_CARRIED}}),
   spray('Orb core',tex('Flare'),[1,1,1],
    {life:.9,rate:6,size:[.5,.6,.5],alpha:[0,255,0]},
    {starts:true,gather:'engulf-core',widthCap:.8,loop:2133,native:{Time:.5,Flags:EMITTER_CARRIED}}),
   teamSpray('Orb wisps',
    {life:1.2,rate:9,velocity:.14,spread:180,size:[.03,.12,.03],alpha:[0,230,0]},
    {gather:'engulf-core',widthCap:.35,loop:2933,native:{Time:.4,Variation:.5,Flags:EMITTER_CARRIED}}),
  ]},
  {id:'flare',name:'Tip flare',layers:[
   spray('Flare',tex('star4'),[1,1,1],
    {life:1.1,rate:1.7,size:[.1,1,.1],alpha:[0,255,0]},
    {starts:true,gather:'tip',widthCap:2.2,native:{Time:.5,Flags:EMITTER_CARRIED}}),
   teamSpray('Flare glow',
    {life:1.3,rate:4,size:[.8,1,.8],alpha:[0,150,0]},
    {gather:'tip',widthCap:1.8,loop:2267,native:{Time:.5,Flags:EMITTER_CARRIED}}),
   teamMotes({cover:'surface',widthCap:.6,loop:1933}),
  ]},
 ]),
 // Arcane swirl in the player's colour: two streams of the glow circling the part, motes around it.
 make('team-swirl','Team swirl',2320,[
  orbit('Team stream',TEAM_GLOW,[1,1,1],{team:2,whole:true,reach:1.25,band:.3,along:-.2,orbitTurns:2,filter:3,strength:.6,lasts:.6,smoothness:60}),
  orbit('Second stream',TEAM_GLOW,[1,1,1],{team:2,whole:true,reach:1.05,band:.3,along:.2,orbitTurns:2,loop:3100,filter:3,strength:.6,lasts:.6,smoothness:60}),
  teamMotes(),
 ]),
 // Pass 6 (14 November). Both were cards at the middle of every skin region, which on a sword is the middle of the
 // blade and the grip. Star flare is now a star twinkling at the tip (gather:'tip') with glints along the part; Glow orb
 // is an orb seated where Fireball sits (gather:'engulf-core': around a blade's outer part, in the middle of a compact
 // piece, in a body's head). Everything is a billboard sized in widths of the part there.
 make('star-flare','Star flare',1600,[
  spray('Flare',tex('star4'),[1,.95,.85],
   {life:1.1,rate:1.7,size:[.1,1,.1],alpha:[0,255,0]},
   {starts:true,gather:'tip',widthCap:2.2,native:{Time:.5,Flags:C,SegmentColor:[[1,1,1],[1,.95,.85],[1,.85,.6]]}}),
  spray('Flare glow',tex('GenericGlow64'),[1,.9,.7],
   {life:1.3,rate:4,size:[.8,1,.8],alpha:[0,110,0]},
   {starts:true,gather:'tip',widthCap:1.8,loop:2267,native:{Time:.5,Flags:C}}),
  spray('Star glints',tex('star4_32'),[1,.95,.85],
   {life:.5,rate:16,size:[.02,.16,.02],alpha:[0,255,0]},
   {starts:true,cover:'surface',widthCap:1.1,loop:1933,native:{Time:.4,Flags:C,SegmentColor:[[1,1,1],[1,.95,.85],[1,.8,.5]]}}),
 ]),
 make('glow-orb','Glow orb',1600,[
  spray('Orb glow',tex('GenericGlow64'),[.7,.85,1],
   {life:1.4,rate:5,size:[.9,1,.9],alpha:[0,150,0]},
   {starts:true,gather:'engulf-core',widthCap:2.2,native:{Time:.5,Flags:C}}),
  spray('Orb core',tex('Flare'),[1,1,1],
   {life:.9,rate:6,size:[.5,.6,.5],alpha:[0,255,0]},
   {starts:true,gather:'engulf-core',widthCap:.9,loop:2133,native:{Time:.5,Flags:C,SegmentColor:[[1,1,1],[.9,.95,1],[.7,.85,1]]}}),
  spray('Orb wisps',tex('GenericGlowX'),[.7,.85,1],
   {life:1.2,rate:9,velocity:.14,spread:180,size:[.02,.1,.02],alpha:[0,220,0]},
   {starts:true,gather:'engulf-core',widthCap:.3,loop:2933,native:{Time:.4,Variation:.5,Flags:C,SegmentColor:[[1,1,1],[.7,.85,1],[.45,.6,1]]}}),
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
  // Inward souls is a flat swirl on the ground under the unit (71 units wide for a long sword): an aura. The owner wants
  // no auras, so it is offered, not started. Soul wisps rise around the part itself instead.
  spray('Inward souls',tex('Tornado2b'),[.75,.95,1],{flat:true,life:.8,rate:4.5,velocity:-.15,spread:.5,size:[1.3,.95,.28],alpha:[100,160,186]},{ground:true}),
  spray('Soul wisps',tex('GenericGlowX'),soul,
   {life:1.4,rate:12,velocity:.1,gravity:-.25,spread:40,size:[.03,.1,.02],alpha:[0,200,0]},
   {starts:true,cover:'around',birthAcross:1.3,widthCap:.5,loop:2933,
    native:{Time:.4,Variation:.4,Flags:C,SegmentColor:[[1,1,1],[.6,.9,1],[.35,.6,1]]}}),
 ]),
 make('ground-glow','Ground glow',1600,[
  cardSpec('Ground glow','ReplaceableTextures\\TeamGlow\\TeamGlow00.blp',{team:2,facing:'ground',count:2,sizeMin:.83,sizeMax:1.17,strength:.75,tint:[1,1,1]}),
 ]),
 // Pass 6 (14 November). The owner: no auras, but the circle is cool; a weapon effect? The rune circle now stands
 // across the part as rings it passes through (facing 'across'), sized to the whole part, each turning on its own clock.
 make('rune-circle','Rune circle',1267,[
  cardSpec('Rune circle',tex('AuraRune7Green'),{facing:'across',whole:true,count:3,reach:1.4,sizeMin:.92,sizeMax:1.08,spin:.25,spinEased:false,loop:4000,tint:[1,1,1]}),
  cardSpec('Inner circle',tex('AuraRune7Green'),{facing:'across',whole:true,count:2,reach:1.1,sizeMin:.94,sizeMax:1.06,spin:-.5,spinEased:false,loop:3100,strength:.7,tint:[.8,1,.7]}),
  spray('Rune motes',tex('star4_32'),[.45,1,.4],
   {life:1.1,rate:12,velocity:.06,gravity:-.1,spread:180,size:[.02,.07,.02],alpha:[0,255,0]},
   {starts:true,cover:'around',birthAcross:1.4,widthCap:.6,loop:2933,
    native:{Time:.5,Variation:.5,Flags:C,SegmentColor:[[1,1,.9],[.45,1,.4],[.15,.8,.2]]}}),
 ]),
 make('liquid-body','Liquid body',1992,[
  skin('Water body',waterFrames[0],{frames:waterFrames,bodyUV:true,filter:2,strength:.8,tint:[.65,.83,.99]}),
  skin('Water shimmer',waterFrames[0],{frames:waterFrames,bodyUV:true,filter:3,strength:.5,direction:90,loop:1320,tint:[.85,.95,1]}),
  // Four glow cards in a row down the middle until 14 November; glints anywhere on the wet surface now.
  spray('Water glints',tex('star4_32'),[.8,.9,1],
   {life:.6,rate:14,size:[.02,.14,.02],alpha:[0,230,0]},
   {starts:true,cover:'surface',widthCap:1,loop:2767,native:{Time:.4,Flags:C,SegmentColor:[[1,1,1],[.8,.9,1],[.55,.75,1]]}}),
 ],{asOverlay:true}),
 make('eye-glow','Eye glow',1300,[
  cardSpec('Left eye',tex('Flare'),{fit:.25,sizeMin:.9,sizeMax:1.1,tint:[1,.3,.12]}),
  cardSpec('Right eye',tex('Flare'),{fit:.25,sizeMin:.9,sizeMax:1.1,loop:1433,tint:[1,.3,.12]}),
  spray('Eye sparks',tex('Flare'),[1,.3,.12],{life:.5,rate:10,velocity:.15,size:[.18,.14,.1],alpha:[200,180,150]},{native:{Flags:EMITTER_CARRIED}}),
 ]),
 // Leaves (pass 7, 14 November), after the owner's Elemental Lord: leaves and dust carried around the body on a turning
 // axis, inside long wind ribbons. An emitter that circles the part sheds the leaves; the rest fall around it.
 vary(make('leaves','Leaves',4000,[]),[
  {id:'green',name:'Falling leaves',layers:[
   spray('Falling leaves',tex('Leaf4x4'),[1,1,1],
    {atlas:4,filter:0,life:2.4,rate:12,velocity:.1,gravity:.22,spread:180,size:[.02,.1,.1],alpha:[0,255,0]},
    {starts:true,cover:'around',birthAcross:1.5,widthCap:.8,capMotion:true,
     native:{Time:.3,Variation:.5,Flags:EMITTER_UNFOGGED,SegmentColor:[[1,1,1],[1,1,1],[.5,.5,.4]]}}),
   spray('Whirling leaves',tex('Leaf4x4'),[1,1,1],
    {atlas:4,filter:0,orbit:.5,life:1.3,rate:10,velocity:.08,gravity:.1,spread:180,size:[.02,.07,.07],alpha:[0,255,0]},
    {starts:true,loop:2933,native:{Time:.3,Variation:.5,SegmentColor:[[1,1,1],[1,1,1],[.5,.5,.4]]}}),
  ]},
  {id:'whirl',name:'Whirlwind',layers:[
   orbit('Wind','Abilities\\Spells\\Other\\Tornado\\wind.blp',[.7,.82,.9],{whole:true,reach:1.2,band:.3,along:-.2,orbitTurns:2,loop:2300,filter:2,strength:.4,lasts:.8,smoothness:60}),
   orbit('Second wind','Abilities\\Spells\\Other\\Tornado\\wind.blp',[.7,.82,.9],{whole:true,reach:1.4,band:.26,along:.2,orbitTurns:2,loop:2900,filter:2,strength:.4,lasts:.8,smoothness:60}),
   spray('Whirling leaves',tex('Leaf4x4'),[1,1,1],
    {atlas:4,filter:0,orbit:.6,life:1.3,rate:16,velocity:.08,gravity:.1,spread:180,size:[.02,.07,.07],alpha:[0,255,0]},
    {starts:true,loop:2100,native:{Time:.3,Variation:.5,SegmentColor:[[1,1,1],[1,1,1],[.5,.5,.4]]}}),
   spray('Whirling dust',tex('Dust3x'),[.75,.7,.6],
    {filter:0,orbit:.45,phase:.5,life:1.1,rate:10,velocity:.05,spread:180,size:[.06,.14,.2],alpha:[0,90,0]},
    {starts:true,loop:2500}),
  ]},
 ]),
 vary(make('tint','Tint',3000,[]),[
  {id:'wash',name:'Colour wash',layers:[skin('Colour wash',null,{own:true,fixed:true,filter:2,strength:.5,tint:[.55,.75,1]})]},
  {id:'team',name:'Team colour',layers:[skin('Team colour wash','ReplaceableTextures\\TeamColor\\TeamColor00.blp',{team:1,fixed:true,bodyUV:true,filter:2,strength:.3,tint:[1,1,1]})]},
 ]),
];
