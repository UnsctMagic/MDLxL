// All pictures resolve from the installed game. Strengths here are relative to the
// skin underneath. A narrow highlight generally needs less energy than a soft wash.
const tex=name=>'Textures\\'+name+'.blp';
const layer=(name,strength,options={})=>({texture:tex(name),strength,...options});
const mote=(name,options)=>({texture:tex(name),...options});
const ribbon=(name,width,life,blend=4,alpha=.48)=>({texture:tex(name),ribbon:true,width,life,blend,alpha});
const drift=(u,v)=>({scroll:[u,v]});
const breathe=[[0,.38],[.32,1],[.66,.7],[1,.38]];
const beat=[[0,.1],[.15,.18],[.23,1],[.42,.45],[.72,.1],[1,.1]];
const flash=[[0,0],[.16,0],[.185,1],[.24,.72],[.36,.14],[.54,0],[1,0]];
const after=[[0,0],[.18,0],[.24,.82],[.4,1],[.65,.12],[.77,0],[1,0]];
const shine=(amount=.25)=>layer('GenericGlow64',amount,{light:breathe});
const glint=(amount=.48)=>layer('Star4',amount,{light:beat});
const make=(id,name,category,description,cycle,layers,extra={})=>({
  id,name,category,description,duration:cycle,layers,fitUV:true,picture:layers[0].texture,...extra,
});
const streak=(id,name,description,cycle,layers,extra)=>make(id,name,'Energy streaks',description,cycle,layers,{
  streak:true,defaultMode:'replace',undercoat:{...layers[0],strength:1,filter:0,light:undefined},...extra,
});
const aura=(id,name,description,cycle,layers,accents,extra)=>make(id,name,'Auras',description,cycle,layers,{accents,...extra});
const idle=(id,name,description,cycle,layers,accents,extra)=>make(id,name,'Ambient',description,cycle,layers,{accents,...extra});
const edge=(id,name,description,cycle,layers,accents,extra)=>make(id,name,'Weapons',description,cycle,layers,{accents,...extra});
const hit=(id,name,description,cycle,layers,accents,extra)=>make(id,name,'Impacts',description,cycle,layers,{accents,cue:'attack',...extra});
const buff=(id,name,description,cycle,layers,accents,extra)=>make(id,name,'Buffs & curses',description,cycle,layers,{accents,...extra});
const ring=(name,radius,life=1.8,extra={})=>mote(name,{flat:true,rate:3.4,life:Math.min(life,1.3),size:[radius*.86,radius,radius*1.08],alpha:[135,180,0],...extra});
const flecks=(name,options)=>mote(name,{rate:9,life:.86,size:[.05,.11,0],area:.22,velocity:.43,spread:32,alpha:[0,220,0],...options});
const burst=(name,options)=>mote(name,{burst:16,life:.68,size:[.12,.19,0],velocity:1.55,spread:78,alpha:[235,160,0],...options});

export const VISUAL_EFFECTS=[
  streak('solar-streak','Sun streak','A hot pin of light leads a long gold taper across the skin.',1150,[
    layer('Star4',.68,drift(1,0)),layer('FX\\Flare\\DiamondNarrow',.46,drift(1,0))],{undercoat:layer('CloudsTile2',1,{filter:0,...drift(1,0),period:2.5}),palette:'solar'}),
  streak('storm-thread','Storm filament','A fine white bolt cuts across a broader blue current.',810,[
    layer('Lightning4b',.65,drift(0,1)),layer('Lightning2b',.2,{...drift(0,-1),light:beat})],{axis:'v',band:.28}),
  streak('ember-comet','Ember comet','An orange core slides through a softer, slower flame wake.',1550,[
    layer('Flame4',.51,{...drift(1,0),period:1.65}),layer('FX\\v\\EmberGlowSharp',.87,drift(1,0))]),
  streak('ice-comb','Frost needles','Two crossing passes of cold light skim the surface.',1890,[
    layer('Ice3b',.16,drift(1,1)),layer('FX\\Flare\\FlareNarrow',.8,drift(1,0))],{palette:'glacier'}),
  streak('venom-veins','Venom veins','Fine green droplets run through a second, slower stream.',1750,[
    layer('AcidSplash1',.76,{filter:4,...drift(1,0)}),layer('AcidSplash1',.37,{filter:4,...drift(0,1),period:1.8})],{undercoat:layer('Green_Glow3',1,{filter:0,...drift(1,0),period:2.2}),palette:'moss'}),

  aura('ward-circle','Sanctuary circle','A fine seal breathes at the feet while the chosen part catches its light.',2800,
    [shine(.2)], [ring('AuraRune8',1.18,2.3,{rate:2.4,filter:0,alpha:[125,176,0]}),flecks('FX\\Flare\\FlareSimple02_BW',{rate:3,area:.8,life:1.1})],{at:'ground',palette:'gold'}),
  aura('cinder-tide','Cinder tide','Ember light rolls out from the feet, with a few rising cinders.',2250,
    [layer('Flame4',.24,{light:breathe})],[ring('Shockwave1White',1.2,1.25,{filter:0,rate:2.2,size:[.2,.88,1.4],alpha:[110,180,0]}),flecks('FX\\v\\EmberGlowSharp',{rate:9,area:.7,life:.95})],{at:'ground',palette:'copper'}),
  aura('frozen-seal','Winter seal','An icy crest opens under the model. A scattering of snow rises through it.',3200,
    [layer('Ice3b',.22,drift(0,1))],[ring('Shockwave_Ice1',1.07,1.55,{rate:2,alpha:[65,125,0]}),flecks('Snowflake',{size:[.025,.085,.025],area:.62,rate:4,life:1.2})],{at:'ground',palette:'glacier'}),
  aura('moon-orbit','Moon orbit','Two crescents circle the selected part at different heights.',3300,
    [shine(.18)],[mote('MoonCrescentGlow',{orbit:.84,rate:10,life:.24,size:[.14,.18,.03]}),mote('Star4',{orbit:.8,phase:.5,height:.22,rate:8,life:.32,size:[.04,.11,0]})],{palette:'glacier'}),
  aura('blight-sigil','Blight sigil','Green runes hang at the feet and shed slow bubbles.',3700,
    [layer('AcidSplash1',.25,{light:breathe})],[ring('AuraRune7Green',1.12,2.8,{rate:2.3,filter:0,alpha:[140,170,0]}),flecks('Bubble',{rate:4,life:1.3,area:.54,velocity:.3,size:[.035,.095,.02]})],{at:'ground',palette:'moss'}),

  idle('fireflies','Fireflies','Warm pinpricks drift apart and fade without obscuring the skin.',3600,
    [shine(.09)],[flecks('FX\\Flare\\FlareSimple02_BW',{filter:0,rate:9,life:1.6,area:.98,velocity:.23,spread:75,size:[.05,.13,0],alpha:[0,230,0]}),mote('FX\\v\\AutumnStar',{orbit:.48,height:.2,rate:7,life:.3,size:[.09,.19,.03],alpha:[210,160,0]})],{palette:'gold'}),
  idle('forge-cinders','Forge cinders','Tiny hot flecks lift off a gently smouldering surface.',1900,
    [layer('Flame4',.22,{light:breathe})],[flecks('Star4',{rate:14,life:.84,velocity:1.04,gravity:-.14,size:[.035,.10,0],tail:.075})],{palette:'copper'}),
  idle('winter-breath','Winter breath','A low mist lifts away from a cold highlight.',3100,
    [layer('Ice3b',.16,{light:breathe})],[mote('Dust3',{rate:5,life:1.5,filter:0,size:[.18,.48,.67],alpha:[28,150,0],velocity:.38,spread:22,area:.25})],{palette:'glacier'}),
  idle('lantern-wisp','Lantern wisp','A bright bead hovers above the part, leaving a soft blue echo.',2350,
    [shine(.14)],[mote('FX\\Flare\\FlareSimple02_BW',{filter:0,orbit:.47,height:.28,rate:10,life:.44,size:[.30,.24,0],alpha:[220,175,0]}),mote('Star4',{orbit:.47,height:.28,rate:10,life:.23,size:[.08,.17,0]})],{palette:'azure'}),
  idle('autumn-fall','Drifting leaves','Golden leaves turn as they fall past the surface.',4300,
    [layer('Star2',.07,{light:breathe})],[mote('FX\\v\\LeafGold8x8',{atlas:8,filter:0,rate:7,life:1.8,velocity:.24,gravity:.74,area:.93,height:.67,size:[.09,.2,.13],alpha:[0,225,0]})],{palette:'honey'}),

  edge('sun-ribbon','Sunsteel trail','A narrow gold edge leaves a short, bright ribbon as the weapon swings.',1400,
    [layer('FX\\Flare\\DiamondNarrow',.37,drift(1,0))],[ribbon('RibbonNE1_White',.27,.2)],{palette:'gold'}),
  edge('spectral-ribbon','Wraith trail','A violet afterimage lingers behind a moving edge.',2250,
    [layer('BlueWaves',.3,drift(0,1))],[ribbon('RibbonNE1_White',.22,.34,4,.42)],{palette:'lilac'}),
  edge('frost-ribbon','Rime trail','Two fine frost lines follow the swing and shed a few crystals.',1950,
    [layer('Ice3b',.31,drift(0,1))],[{...ribbon('RibbonNE1_Blue',.072,.23,2,.74),along:.23},{...ribbon('RibbonNE1_White',.035,.16,4,.42),along:-.12},flecks('Snowflake2',{rate:5,gravity:.45,velocity:.09,size:[.035,.083,0]})],{palette:'glacier'}),
  edge('coal-ribbon','Coalbrand','An ember line clings to the swing before falling away as sparks.',1260,
    [layer('Flame4',.33,drift(1,0))],[ribbon('RibbonNE1_Red2',.12,.18,4,.74),flecks('FX\\v\\EmberGlowSharp',{rate:8,velocity:.32,gravity:.4,tail:.08})],{palette:'copper'}),
  edge('viper-ribbon','Viper trail','A thin green smear follows the blade. Heavy drops fall below it.',2200,
    [layer('AcidSplash1',.37,drift(0,1))],[ribbon('RibbonNE1_White',.11,.24,4,.55),flecks('Bubble',{rate:4,gravity:1.3,velocity:.06,size:[.025,.07,.025]})],{palette:'moss'}),

  hit('iron-hit','Iron strike','One white-hot contact flash breaks into short falling sparks.',1500,
    [layer('Star2',.67,{light:flash})],[burst('Star2',{burst:1,life:.21,velocity:0,size:[.14,.78,0]}),burst('Star4',{burst:24,tail:.11,gravity:2.1,velocity:2.15,size:[.1,.065,0]})],{palette:'honey'}),
  hit('frost-hit','Ice fracture','A sharp cold flash splits into crystals and a delayed puff of mist.',1700,
    [layer('Shockwave_Ice1',.65,{light:flash})],[burst('Snowflake2',{burst:13,filter:0,gravity:1.1,velocity:1.9,size:[.13,.22,.05]}),burst('Dust3',{burst:4,delay:.09,filter:0,life:.75,velocity:.24,size:[.15,.4,.62],alpha:[0,105,0]})],{palette:'glacier'}),
  hit('ember-hit','Ember burst','A compact fireball blooms, with a darker cloud hanging after it.',1700,
    [layer('Flame4',.65,{light:flash})],[burst('Flame4',{burst:9,velocity:.92,size:[.34,.74,.12]}),burst('Dust3',{burst:5,delay:.14,filter:0,velocity:.32,life:.82,size:[.13,.32,.62],alpha:[0,95,0]})],{palette:'copper'}),
  hit('quake-hit','Dust shock','A ground ring spreads out beneath a low spray of dust.',2250,
    [layer('Shockwave4White',.39,{light:flash})],[burst('Shockwave1White',{flat:true,burst:1,velocity:0,life:.63,size:[.12,.9,1.45]}),burst('Dust3',{burst:16,filter:0,gravity:.62,life:1.1,velocity:1.6,size:[.18,.43,.67],alpha:[130,190,0]})],{at:'ground',palette:'sand'}),
  hit('soul-break','Soul release','At death the surface flashes violet and pale motes lift out of it.',2300,
    [layer('GenericGlowX',.36,{light:after})],[burst('Clouds_Anim1',{atlas:4,burst:7,life:1.55,velocity:1.22,spread:31,gravity:-.23,size:[.12,.31,.05]}),burst('Star4',{burst:6,delay:.055,life:1.1,velocity:.88,spread:38,size:[.04,.12,0]})],{cue:'death',palette:'lilac'}),

  buff('sun-mend','Mending light','Rays travel up the skin as tiny four-point stars rise from it.',2100,
    [layer('FireRing6',.28,drift(0,-1))],[flecks('Star4',{rate:8,life:1.25,velocity:.73,size:[.06,.18,0]})],{palette:'honey'}),
  buff('hex-mark','Hex mark','A violet seal pulses on the part beneath a circling spark.',2600,
    [layer('DemonRune4',.65,{filter:4,light:beat})],[mote('DemonRune4',{rate:2.5,life:.72,height:.17,size:[.30,.38,.43],alpha:[40,122,0]}),mote('Star4',{orbit:.64,height:.21,rate:9,life:.34,size:[.065,.14,0]})],{palette:'lilac'}),
  buff('venom-seep','Venom seep','A wet green stain pulses and drops escape from the underside.',2420,
    [layer('AcidSplash1',.48,{light:breathe})],[flecks('Bubble',{rate:7,life:1.18,gravity:1.16,velocity:.18,area:.43,size:[.09,.15,.035]})],{palette:'moss'}),
  buff('spell-ward','Spell ward','A silver rune brightens across the surface, then settles into a soft sheen.',2800,
    [layer('AuraRune8',.62,{filter:4,light:breathe,spin:1}),layer('FX\\v\\EclipseRingMidnight',.38,{spin:-1})],[mote('AuraRune8',{filter:0,rate:2.6,life:1.05,size:[.42,.52,.57],alpha:[30,168,0],height:.18})],{palette:'azure'}),
  buff('dawn-wake','Dawn awakening','At birth a warm star opens on the part and a few motes rise after it.',2350,
    [layer('Star10_Alpha',.64,{light:after})],[burst('Star4',{burst:12,delay:.07,life:1.45,velocity:.7,spread:35,size:[.065,.16,0]})],{cue:'birth',palette:'gold'}),
  idle('starfall-sheen','Starfall sheen','A gold glint opens and closes on the skin, followed by a few floating sparks.',1320,
    [layer('Sparkle_Anim128',.85,{sheet:4})],[flecks('Sparkle_Anim128',{atlas:4,rate:3,life:.76,area:.58,size:[.11,.21,.05],velocity:.33})],
    {atlas:[.002,.002,.246,.246],thumbnailRect:[.25,0,.25,.25],palette:'honey'}),
  buff('spirit-veil','Spirit veil','Violet wisps bloom across the surface and drift off its edge.',1760,
    [layer('Clouds_Anim1',.73,{sheet:4})],[mote('FX\\Swirl\\T_FX_Whisps',{atlas:2,rate:5,life:1.1,velocity:.31,area:.24,size:[.16,.35,.48],alpha:[100,195,0]})],
    {atlas:[.002,.002,.246,.246],thumbnailRect:[0,.25,.25,.25],palette:'lilac'}),
  aura('standard-ward','Banner ward','Your Warcraft team colour pulses around the feet and across the selected surface.',2700,
    [{team:true,strength:.35,light:breathe}],[{team:true,flat:true,rate:2.5,life:1.15,size:[1.14,1.28,1.4],alpha:[76,108,0]},ring('AuraRune8',.93,1.2,{rate:2.2,filter:0,alpha:[64,110,0]})],{at:'ground',team:true,picture:tex('AuraRune8')}),
  hit('thunder-print','Thunder print','A blue contact flash and radial sparks leave the Thunder Clap mark on the ground.',1800,
    [layer('LightningBall',.64,{light:flash})],[burst('LightningBall',{burst:3,life:.34,velocity:.23,size:[.13,.41,0]}),burst('Star4',{burst:14,tail:.11,velocity:1.9,size:[.08,.05,0]})],{at:'ground',stamp:'UBRxTHND',palette:'azure'}),
  hit('fel-rupture','Fel rupture','A sickly green spray falls into a native demon-blood stain at the feet.',2400,
    [layer('AcidSplash1',.65,{filter:4,light:after})],[burst('BloodSplashWhite',{burst:11,filter:0,gravity:2.5,velocity:1.35,size:[.16,.26,.08]}),burst('Bubble',{burst:6,delay:.09,life:.85,velocity:.66,size:[.05,.13,0]})],{at:'ground',stamp:'SPLxDBS1',palette:'moss'}),
  buff('recall-seal','Recall seal','A teleport seal opens at the feet and bright motes climb away from it.',2300,
    [layer('Star4',.52,{light:after})],[burst('Star10_Alpha',{burst:9,delay:.06,life:1.3,velocity:1.1,spread:15,filter:0,size:[.08,.17,.04]})],{cue:'birth',at:'ground',stamp:'UBRxSCTP',palette:'azure'}),
];

export function visualPaths(effect){
  return [...new Set([effect.undercoat,...(effect.layers||[]),...(effect.accents||[])].filter(part=>part?.texture).map(part=>part.texture))];
}

const searchTerms={
  'Energy streaks':'missile projectile bolt energy streak moving texture',
  Auras:'aura magic ward', Ambient:'ambient idle glow atmosphere', Weapons:'weapon enchant blade sword',
  Impacts:'impact hit explosion burst', 'Buffs & curses':'buff debuff curse enchant',
  Skins:'skin armour armor surface', Terrain:'ground tileset terrain skin',Model:'own material texture',
};
export function matchesVisualEffect(effect,query,localise=value=>value){
  const terms=[effect.name,effect.category,effect.description,localise(effect.name),localise(effect.category),searchTerms[effect.category],
    effect.accents?.some(p=>p.ribbon)?'ribbon trail swing':null,effect.at==='ground'?'ground feet floor':'body surface',
    effect.cue==='death'?'death die dying':effect.cue==='birth'?'spawn birth arrival appear':null,effect.stamp?'splat ground mark':null
  ].filter(Boolean).join(' ').toLowerCase();
  return query.trim().toLowerCase().split(/\s+/).every(word=>terms.includes(word));
};
