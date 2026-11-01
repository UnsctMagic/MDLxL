// Native hand-test recipes. Unfiled entries resolve only when reopening an older stack.
const tex=name=>(name.startsWith('Units\\')?name:'Textures\\'+name)+'.blp';
const surface=(label,name,extra={})=>({type:'Moving skin',label,image:tex(name),strength:.75,...extra});
const light=(label,name,pulse,strength,tint)=>({type:'Glow',label,image:tex(name),pulse,strength,tint});
const mark=(label,name,pulse,tint)=>({type:'Rune',label,image:tex(name),glyphs:true,strength:1.55,pulse,tint});
const stone=(label,path)=>({type:'Moving skin',label,image:'TerrainArt\\'+path+'.blp',atlasRect:[.625,.25,.125,.25],bodyUV:true,fixed:true,base:true,filter:2,strength:1,tint:[1,1,1]});
const trail=(label,name,tint,strength,lasts)=>({type:'Edge',label,image:tex(name),tint,strength,lasts});
function spray(label,name,tint,spec){
 const image=tex(name);
 return {type:'Particles',label,kind:'native',image,tint,nativeSpec:{texture:image,...spec}};
}
const white=[1,1,1],silver=[.83,.91,1],gold=[1,.72,.29],mint=[.48,1,.73],violet=[.76,.49,1],ember=[1,.34,.085];
const folders={
 basalt:'Terrain',briar:'Skins',abyss:'Terrain',cairn:'Terrain',mosaic:'Terrain',buried:'Terrain',
 eclipse:'Buffs & curses',ink:'Skins',soul:'Buffs & curses',thorn:'Blades',astral:'Buffs & curses',
 oath:'Blades',tide:'Skins',blood:'Around the unit',rift:'Blades',
};
const overlays=new Set(['basalt','briar','cairn','mosaic','eclipse']);
const make=(id,name,loop,...layers)=>({id:'sort-'+id,name,group:folders[id],loop,palette:'native',layers,...(overlays.has(id)?{asOverlay:true}:{})});
const moss=stone('Mossy bark','Felwood\\Felwood_Vines');
const spores=spray('Spores','Bubble',mint,{life:1.45,rate:8,area:.5,velocity:.34,spread:50,size:[.04,.13,.08],alpha:[0,204,0]});
export const inkSeal=mark('Ink seal','DemonRune2','glint',violet);
export const SORT_LOOKS=[
 make('porcelain','Gilded porcelain',3900,{...stone('White marble','Cityscape\\City_WhiteMarble'),tint:[.76,.71,.63]},mark('Gold inscription','Rune1D','breathe',gold)),
 make('basalt','Basalt kiln',2900,stone('Black stone','Dungeon\\Cave_DarkRocks'),surface('Heat seams','Flame4',{axis:'v',band:.19,tint:ember,pulse:'glint',strength:.66})),
 make('briar','Briar binding',4600,stone('Vine weave','Ashenvale\\Ashen_Vines'),spray('Pollen','Star2',gold,{life:1.25,rate:9,velocity:.24,area:.72,spread:55,size:[.025,.085,.01]}),{...moss,enabled:false},{...spores,enabled:false}),
 make('abyss','Void shale',3500,stone('Outland strata','Outland\\Outland_Abyss'),light('Starlight','Units\\Undead\\FrostWyrm\\Starfield','glint',1.05,silver)),
 make('cairn','Carved cairn',5300,stone('Grey stones','Dungeon\\Cave_GreyStones'),mark('Carving','DemonRune5','steady',mint),light('Carving light','GenericGlow64','glint',.38,mint)),
 make('copper','Copper storm',1450,stone('Red stone','Dungeon\\Cave_RedStones'),surface('Copper lightning','Lightning2b',{axis:'v',band:.32,pulse:'lightning',tint:gold})),
 make('lichen','Spore bark',3700,moss,spores),
 make('mosaic','Moon mosaic',4100,stone('Tiled stone','Icecrown\\Ice_TiledBricks'),light('Crescent','MoonCrescentGlow','breathe',1.1,silver)),
 make('buried','Buried coals',1950,stone('Cracked earth','Outland\\Outland_DirtCracked'),spray('Coal sparks','FX\\v\\EmberGlowSharp',ember,{life:.8,rate:14,velocity:.78,gravity:.95,spread:37,tail:.13,size:[.055,.10,.02]})),
 make('sand','Sandblasted bronze',4800,stone('Desert grain','Barrens\\Barrens_Desert'),surface('Polished ridge','FX\\Flare\\FlareNarrow',{axis:'v',band:.22,tint:gold,pulse:'breathe',strength:.67})),
 make('eclipse','Eclipse brand',3400,surface('Passing shadow','CloudsTile2',{base:true,filter:2,strength:1,axis:'v',tint:[.32,.29,.46]}),mark('Eclipse eye','DemonRune3','breathe',white)),
 make('comet','Comet glass',1200,surface('Comet core','Star2',{axis:'v',band:.34,pulse:'steel',tint:silver}),trail('Comet tail','RibbonNE1_White',silver,.52,.25)),
 make('ink','Living ink',3800,surface('Ink clouds','CloudsTile1',{filter:2,bodyUV:true,strength:.86,tint:[.18,.13,.23]})),
 make('phoenix','Phoenix quill',1850,surface('Feather light','Units\\Human\\Phoenix\\Phoenix2',{base:true,filter:2,atlasRect:[.03,.12,.43,.4],strength:1}),spray('Falling feathers','Feather',gold,{life:1.45,rate:8,filter:1,area:.6,velocity:.28,gravity:.62,spread:50,size:[.07,.24,.09],alpha:[40,235,0]})),
 make('soul','Soul lantern',2700,mark('Soul seal','Rune6b','breathe',mint),spray('Lantern flame','Ghost1',mint,{life:.95,rate:9,orbit:.56,velocity:.21,size:[.12,.28,.02]})),
 make('thorn','Thorn script',2450,mark('Thorn glyph','DemonRune4','flicker',mint),trail('Thorn trail','RibbonNE1_White',mint,.38,.32)),
 make('astral','Astral chart',5400,stone('Black stone','Cityscape\\City_BlackMarble'),surface('Star field','Units\\Undead\\FrostWyrm\\Starfield',{bodyUV:true,direction:26,strength:1,tint:white}),mark('Constellation','Rune4','glint',gold)),
 make('prism','Prism sweep',2850,surface('Prism band','CrystalOpaque',{base:true,filter:2,atlasRect:[0,0,1,1],strength:1}),surface('Polished ridge','FX\\Flare\\DiamondNarrow',{axis:'v',band:.38,tint:[1,.28,.71],strength:1}),light('Prism flash','FX\\v\\RainbowLenseFlare_BW','glint',1.7,silver)),
 make('oath','Oathfire',2100,mark('Oath mark','Rune1','double',gold),spray('Oath flames','Flame4',gold,{life:.48,rate:15,area:.28,velocity:.52,spread:17,size:[.13,.27,.03]})),
 make('tide','Tide etching',3100,surface('Tide lines','BlueWaves',{base:true,filter:2,axis:'v',band:.76,tint:[.76,.96,1],strength:1}),mark('Tide mark','Rune4b','breathe',silver)),
 make('snowfall','Windborne snow',3250,spray('Falling snow','Snowflake2',white,{life:1.6,rate:16,area:.94,height:.46,velocity:.12,gravity:.65,spread:48,size:[.055,.17,.10],alpha:[0,242,0]})),
 make('bubbles','Diving bell',3800,spray('Rising bubbles','Bubble',silver,{life:1.6,rate:10,area:.65,velocity:.49,spread:18,size:[.06,.24,.28],alpha:[0,222,0]}),light('Water reflection','ShockwaveWater1','breathe',.43,silver)),
 make('dust','Dust devil',2200,spray('Dust spiral','Dust3', [1,.82,.57],{life:.72,rate:16,orbit:.64,velocity:.32,area:.12,filter:0,size:[.08,.32,.45],alpha:[0,152,0]})),
 make('sparks','Arc welder',980,spray('Arc spray','LightningBall',silver,{life:.18,rate:12,velocity:.31,spread:68,size:[.13,.32,.11]}),spray('Hot filings','Star4',gold,{life:.54,rate:17,tail:.09,velocity:.95,gravity:1.7,spread:52,size:[.05,.09,.005]})),
 make('maple','Maple drift',4900,spray('Maple leaves','FX\\v\\LeafGold8x8',white,{life:1.8,rate:7,atlas:8,area:.88,height:.58,velocity:.20,gravity:.62,spread:67,filter:0,size:[.09,.25,.14],alpha:[0,240,0]})),
 make('blood','Sanguine drip',2550,spray('Blood beads','BloodBlobs1',[.87,.24,.18],{life:.72,rate:9,area:.43,gravity:1.8,spread:16,filter:0,size:[.06,.18,.06]}),light('Red stain','BloodPool','breathe',.64,[1,.35,.28])),
 make('crescent','Twin crescents',3600,spray('Outer crescent','MoonCrescentGlow',silver,{life:.39,rate:9,orbit:.73,size:[.19,.31,.04]}),spray('Inner star','Star4',gold,{life:.24,rate:9,orbit:.41,phase:.5,height:.19,size:[.10,.17,.02]})),
 make('veil','Ash veil',4350,spray('Ash veil','CloudSingle',[.62,.57,.57],{life:1.5,rate:9,area:.55,velocity:.38,filter:0,size:[.18,.48,.69],alpha:[0,155,0]}),spray('Ash flecks','Dust3x',silver,{life:.85,rate:12,velocity:.68,spread:60,size:[.07,.12,.02],alpha:[0,196,0]})),
 make('dew','Dew pearls',4600,light('Dew sheen','FX\\Flare\\DiamondNarrow','glint',.55,mint),spray('Dew pearls','WaterBlobs1',silver,{life:.93,rate:9,area:.67,gravity:.83,spread:28,filter:0,size:[.04,.16,.07]})),
 make('rift','Rift seam',1600,surface('Rift seam','Lightning4b',{axis:'v',band:.25,tint:violet,pulse:'lightning'}),spray('Rift splinters','Star7b',violet,{life:.68,rate:11,orbit:.39,tail:.09,size:[.07,.14,.02]})),
];
