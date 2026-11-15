# FX element looks: design (for commit after 7e9660b2, branch claude/fx-effects)

Designer's data for the coder. Format = RECIPE-REFERENCE.md. Nothing here is rendered yet; section 5 lists what to render first.
Evidence used: baseline captures 1-131 (7e9660b2 on the light grey stage), owner screenshots 01-07, FAMILIES.md / SPRITES.md / sheet-1..3, STUDY.md numbers, source at 7e9660b2 and cbc17f49.

## 1. Principles

1. One template recoloured is the failure. Each variation is a different **shape** (fat row / leaning licks / sheath / tip / beads / falling drops / rising plume / twinkles) and each element gets only the shapes that suit it. `elementTechnique`, `ELEMENTS` and the auto-appended `technique-*` variations go away; every variation below is hand-written.
2. Sprites: only textures Blizzard uses as particles, in Blizzard's filter (table in 2.0). No-alpha sprites are Additive only. Surface textures stay on surface layers.
3. Never a lone orb mid-part. A compact source sits where one makes sense: gathered at the tip/extremity, or as several small cores along the whole edge.
4. Two size families. Things that **hug** the part (cores, beads, glints, orbs) are capped by the part's width (`widthCap`). Things that **leave** it (sheath flames, vapour, ejecta, travel distance) scale with length (`radius`), as in the references (Sunchips flame = 0.43 x radius, i.e. 4x the blade's half-width).
5. Layering from Moarg: dense core + faint halo + slow long-lived ejecta, alpha that holds (third alpha > 0) for fire and lava; fade-in/fade-out (0/x/0) for cold, vapour and glints.
6. Layering from Sunchips: one long birth area, two overlapping layers with different life and speed, the inner one carried with the part, the outer one left in the world so it streams on a swing.
7. Direction comes from world gravity, not from the bone's +Z: fire and smoke rise (negative gravity), frost vapour, drips, shards and lava fall (positive). Launch speed stays low and cones wide unless the layer is aimed (`aim`).
8. Colour changes across life (3 stage colours), native ramps where one exists (plague cloud yellow>green, forked lightning violet>blue>white, Moarg red>orange>pale yellow).
9. The stage is light grey: additive light can only whiten it. Where the native game uses an alpha sprite with Blend (smoke, plague cloud, water blobs, vapour) the body layer is Blend so the colour survives on the light stage; fire stays additive as Blizzard does it.
10. Halos are faint (alpha <= 120). A red or green additive halo at full alpha is a pink / mint disc on this stage (captures 3, 7, 14, 19).
11. Many sites must not pulse together: multi-site layers carry `scatter`. Lightning flickers locally (one site at a time), never the whole blade ("owner hates flashing effects").
12. The first variation of each look is the owner-liked cbc17f49 recipe. I changed three, each for a seen fault: Arcane orbs (white blob, capture 66), Lightning arc rhythm, Frost mist strength back to cbc.
13. Everything is a starting value: all particle layers use the same control set; layer names are short functional labels.

## 2.0 Shared definitions used by the literals

```js
const tex=name=>'Textures\\'+name+'.blp';
const CLOUDS='ReplaceableTextures\\Weather\\Clouds8x8.blp';                    // 8x8 atlas, always atlas:8
const FIRE10022='Abilities\\Weapons\\FlamingArrow\\Fire10022.blp';              // existing('ember-edge').texture
const CLOUDSTILE='UI\\Glues\\SinglePlayer\\TutorialCampaign3D\\cloudstile1.blp'; // existing('energy').texture (surface only)
const LIGHTNING4B='Doodads\\Cinematic\\Lightningbolt\\Lightning4b.blp';         // surface only
const U=EMITTER_UNFOGGED, C=EMITTER_CARRIED;                                    // fx-technique-looks.js:18
// skin, glow, dust, cardSpec, starts, vary: global-animation-looks.js. spray(label,image,tint,nativeSpec,extra), orbit(): fx-technique-looks.js.
const fire=(label,extra={})=>dust(label,'flame',CLOUDS,{atlas:8,tint:[1,.463,.173],...extra});   // unchanged
const embers=()=>/* 7e9660b2 version, unchanged (LavaLump, slow, cooling) */;
const mist=()=>dust('Falling mist','mist',CLOUDS,{atlas:8,tint:[.96,.98,1]});                      // cbc17f49 frost(), restored
```

New recipe keys used below (behaviour in section 3; each literal still works without them, with the stated loss):
`widthCap:k` · `gather:'tip'` · `aim:'tip'|'outward'` · `siteCount:n` · `scatter:s` · `birthAcross:k`.

Sprite / filter table (particle `filter`: 0 Blend, 1 Additive, 2 Modulate):

| Sprite | Alpha | Filter used here | Native use |
|---|---|---|---|
| CLOUDS (Weather Clouds8x8) | yes, 8x8 | 1 for flame/mist, 0 for vapour, fumes, smoke | Additive 473 / Blend 407 |
| CloudSingle | yes | 1 | Additive 139/141 |
| Clouds8x8ModFire | yes, 8x8 | 2 | Modulate 23/23 |
| LavaLump, LavaLump2, Red_Glow3, Green_Glow3, Blue_Glow2, GenericGlowX | no | 1 | Additive only |
| Star7b, Blue_Star2, star5tga, LightningBall, Zap1, Frost3, Bubble, Flame4 | no | 1 | Additive only |
| star4_32, snowflake, Sparkle_Anim (4x4) | yes | 1 | Additive only |
| WaterBlobs1, White_64_Foam1 | yes | 0 | Additive and Blend both native |

Size words below: `R` = the layer's `radius` (0.48 x part length, max 55). `W` = half-width of the part at the site. A straight blade is about 2.1 R long. Checked on paper against Great Unclean g11 (R 55, W 15, an unusually wide blade) and an ordinary sword (R 29, W 4).

---
## 2.1 Fire (`flaming-sword`, loop 1760)

Four variations. Dropped: "Moving surface" (capture 4: invisible).

### Surface flames — `surface-flames` (first, owner-liked)
- Glance: a fat row of flames along the whole blade with a flickering hot surface under it.
- Lesson: none new; this is cbc17f49. Capture 120 (g10) shows it at its best.
```js
{id:'surface-flames',name:'Surface flames',layers:[
 skin('Hot core',FIRE10022,{strength:.58,pulse:'flicker'}),
 fire('Blade flames',{starts:true}),           // no airyFit: cbc table values (alpha 230/254/0, 104/s, life .46)
 embers(),                                     // ingredient, not started
 FIRE_FLAME_CARDS,                             // disabled, as today
]}
```
- Sword: flame sites along the blade on its exposed face (current strip sites). Curved blade: rim sites along the outer curve. Body: rim sites, shoulders first; keep the 0.75 x W size cap at rim sites only (horn case from STUDY.md), not on straight strips.

### Flame licks — `flame-licks` (new id; this is what 7e9660b2 shows as the first variation)
- Glance: thinner, see-through tongues that leap off the blade and fall back; blade stays readable.
- Lesson: Tzeentch champion (sparse sites, alpha 58/64, short ballistic loft, colour change). Capture 1 is this recipe and it works.
```js
{id:'flame-licks',name:'Flame licks',layers:[
 skin('Hot core',FIRE10022,{strength:.58,pulse:'flicker'}),
 fire('Flame licks',{starts:true,airyFit:{version:1}}),
 {...embers(),starts:true,amount:8},
]}
```
- Sword / curved / body: same sites as Surface flames; the airy fit gives the loft and the 0.75 x W cap.

### Enveloping flames — `enveloping-flames` (keep id and `legacyLayers`)
- Glance: a thick billowing coat of fire born all along the blade, much wider than the blade, streaming behind it when it swings.
- Lesson: Sunchips Fire Sword. What Codex missed: sprite 0.43 R (his 0.24), alpha held at 255 (his 210), birth slab wider than the blade (his 0.7 W, inside the mesh), inner layer carried / outer layer in the world.
```js
{id:'enveloping-flames',name:'Enveloping flames',layers:[
 skin('Hot core',FIRE10022,{strength:.8,pulse:'flicker'}),
 spray('Flame sheath',tex('CloudSingle'),[1,.55,.15],
  {life:1,rate:30,velocity:.4,spread:20,size:[.43,.3,.2],alpha:[255,255,130]},
  {starts:true,birthRegion:true,birthAcross:1.6,
   native:{Time:.45,Variation:.1,Flags:C,SegmentColor:[[1,.95,.62],[1,.55,.15],[.9,.14,.03]]}}),
 spray('Flame tongues',tex('CloudSingle'),[1,.55,.15],
  {life:.5,rate:30,velocity:.62,gravity:-.5,spread:28,size:[.43,.3,.2],alpha:[255,255,130]},
  {starts:true,birthRegion:true,birthAcross:1.6,loop:2133,
   native:{Time:.45,Variation:.2,Flags:U,SegmentColor:[[1,.95,.62],[1,.55,.15],[.9,.14,.03]]}}),
 {...embers(),starts:true,amount:8},
 // ingredient only (no starts) until a render proves Modulate particles draw correctly:
 spray('Heat shade',tex('Clouds8x8ModFire'),[1,1,1],
  {atlas:8,filter:2,life:1.6,rate:10,velocity:.2,spread:20,size:[.4,.4,.3],alpha:[255,255,0]},
  {birthRegion:true,birthAcross:1.6,native:{Time:.5,SegmentColor:[[1,1,1],[1,1,1],[1,1,1]]}}),
]}
```
- Sword: one emitter, birth slab = 90% of the length x 1.6 W each side. 45 live sprites. On g11 the flame is about 47 units across on a 30 x 123 blade (same proportion as the reference).
- Curved blade: no slab (it would span air): rim sites along the curve, each with a small birth area; needs the per-site rate floor (section 3.7) or it thins out.
- Body: sites on every region; the part is wrapped in fire. Same floor needed.
- "Heat shade" is Blizzard's own trick for fire on light ground (Flame Strike, Liquid Fire): it tints what is behind the flames so they stay orange on the light stage.

### Fireball — `fireball` (keep id and `legacyLayers`)
- Glance: a burning tip: a short dense jet of fire at the end of the blade, red at the root and yellow at the head, with slow embers and falling sparks around it. The rest of the blade only glows.
- Lesson: Moarg Overlord hand fire (dense narrow core, backing glow, slow long-lived ejecta, alpha that never reaches zero, reversed ramp red > orange > pale yellow). Moved from mid-blade to the tip, capped to the blade's width, halo made faint.
```js
{id:'fireball',name:'Fireball',layers:[
 skin('Hot core',FIRE10022,{strength:.58,pulse:'flicker'}),
 spray('Fire core',CLOUDS,[1,.55,.15],
  {atlas:8,life:.5,rate:40,velocity:.4,spread:8,size:[.26,.2,.12],alpha:[220,150,80]},
  {starts:true,gather:'tip',aim:'tip',widthCap:1.2,
   native:{Time:.5,Variation:.2,Flags:U,SegmentColor:[[1,.25,.05],[1,.55,.12],[1,.9,.55]]}}),
 spray('Core glow',tex('Red_Glow3'),[1,.4,.12],
  {life:.5,rate:7,velocity:.08,spread:2,size:[.36,.3,.22],alpha:[90,70,30]},
  {starts:true,gather:'tip',aim:'tip',widthCap:1.7,
   native:{Time:.5,Flags:C,SegmentColor:[[1,.3,.08],[1,.5,.12],[1,.8,.4]]}}),
 spray('Spat embers',tex('LavaLump'),[1,.62,.25],
  {life:4,rate:3,velocity:.18,gravity:-.03,spread:90,size:[.04,.03,.02],alpha:[255,200,100]},
  {starts:true,gather:'tip',loop:3133,
   native:{Time:.5,Variation:.3,Flags:U,SegmentColor:[[1,.6,.15],[1,.85,.3],[1,.95,.6]]}}),
 spray('Falling sparks',tex('Sparkle_Anim'),[1,.7,.2],
  {atlas:4,life:1.9,rate:5,area:.15,velocity:.19,gravity:.38,spread:20,size:[.3,.15,.01],alpha:[100,150,0]},
  {starts:true,gather:'tip',aim:'tip',loop:2533,
   native:{Time:.5,Variation:.25,Flags:U,LifeSpanUVAnim:[0,0,1],DecayUVAnim:[0,0,1],
           SegmentColor:[[1,.25,.05],[1,.8,.2],[1,.9,.3]]}}),
]}
```
- Sword: all four emitters on one site at the tip, aimed past the tip (a torch). Curved blade: the same at the end farthest from the hand. Body: one site on each of up to two extremities (shoulders, horn tips).
- Without `gather`/`aim`: falls back to today's single mid-blade site, which is the rejected look. Do not ship this variation without `gather`.

---
## 2.2 Fel fire (`claude-fel-blade`, loop 1500)

Three variations. Fel is not green Fire: its own shapes are white-hot beads that collapse to green with spiky streaks thrown sideways, and a burning surface shedding sparks. No fel sheath and no fel tip: those would be Fire recoloured (the complaint about screenshots 06/07).
`const FEL=[.42,1,.22];`

### Fel flames — `original` (first, owner-liked)
- Glance: green fire along the blade over a scrolling flame surface. Capture 121 (g10).
```js
{id:'original',name:'Fel flames',layers:[
 skin('Fel fire',tex('Flame4'),{axis:'v',band:.8,pulse:'flicker',strength:.95,tint:FEL}),
 {...dust('Fel flames','flame',CLOUDS,{atlas:8,tint:FEL}),starts:true},     // no airyFit (cbc)
 FEL_FLAME_CARDS,
]}
```
- Placement: as Fire / Surface flames.

### Fel surge — `fel-surge`
- Glance: a chain of five small cores along the edge, each born white-hot and shrinking to pure green, with jagged green flame streaks spitting out sideways.
- Lesson: Moarg's layering (dense core + halo + ejecta) built from Blizzard's own green recipes: Demon Hunter missile core (Clouds8x8, speed 0, 38>25>10, cream > green) and its Flame4 tail streaks (wide cone, yellow > green).
```js
{id:'fel-surge',name:'Fel surge',layers:[
 skin('Fel fire',tex('Flame4'),{axis:'v',band:.8,pulse:'flicker',strength:.95,tint:FEL}),
 spray('Fel cores',CLOUDS,FEL,
  {atlas:8,life:.45,rate:60,velocity:.05,gravity:-.3,spread:180,size:[.2,.13,.05],alpha:[255,230,0]},
  {starts:true,siteCount:5,scatter:.25,widthCap:1,
   native:{Time:.45,Variation:.3,Flags:U,SegmentColor:[[1,.94,.76],[.1,.88,0],[.15,.75,.01]]}}),
 spray('Fel streaks',tex('Flame4'),FEL,
  {life:.35,rate:18,velocity:1.1,spread:82,tail:.25,size:[.02,.1,.03],alpha:[255,255,0]},
  {starts:true,siteCount:5,scatter:.4,aim:'outward',loop:1933,
   native:{Time:.45,Variation:.4,Flags:U,SegmentColor:[[.99,.96,.03],[.2,.96,.05],[.09,.8,0]]}}),
 spray('Fel glow',tex('Green_Glow3'),FEL,
  {life:.8,rate:5,size:[.22,.2,.16],alpha:[70,60,20]},
  {starts:true,siteCount:5,widthCap:1.3,loop:2267,native:{Time:.5,Flags:C}}),
]}
```
- Sword: five sites evenly along the blade (0.42 R apart): beads nearly touch on a wide blade, sit apart on a thin one. Streaks leave along the surface normal.
- Curved blade: five rim sites along the outer curve. Body: up to five rim sites (shoulders, then silhouette).
- Without `siteCount`: the live count (27) already gives 6 sites; fine. Without `aim`: streaks still fan 82 degrees; fine.

### Fel sparks — `fel-sparks`
- Glance: the blade burns on its surface only; a column of yellow-green stars rises off its whole length and shrinks to nothing.
- Lesson: DragonBlade (scrolling surface + stars born along a 5 x 55 slab, gravity -100, size 10>10>0, alpha 255/255/0).
```js
{id:'fel-sparks',name:'Fel sparks',layers:[
 skin('Fel fire',tex('Flame4'),{axis:'v',band:.8,pulse:'flicker',strength:.95,tint:FEL}),
 spray('Rising sparks',tex('Star7b'),FEL,
  {life:.6,rate:40,velocity:.03,gravity:-2.2,spread:35,size:[.12,.1,0],alpha:[255,255,0]},
  {starts:true,birthRegion:true,widthCap:1,loop:1733,
   native:{Time:.45,Variation:1,Flags:U,SegmentColor:[[.95,1,.6],[.5,1,.1],[.2,.9,0]]}}),
 spray('Fel motes',tex('star4_32'),FEL,
  {life:1.4,rate:8,velocity:.1,gravity:-.4,spread:180,size:[.01,.04,.01],alpha:[0,255,0]},
  {starts:true,birthRegion:true,birthAcross:1.4,loop:2933,
   native:{Time:.5,Variation:.5,Flags:U,SegmentColor:[[1,1,.8],[.6,1,.2],[.2,.85,0]]}}),
]}
```
- Sword: one slab emitter along the blade; stars rise 0.4 R in the world. Curved blade / body: rim sites, same motion.

---
## 2.3 Frost / Ice (`frost-blade`, loop 3200)

Five variations: the three owner-liked surfaces stay, two emitter variations are added. Dropped: all four technique variations (captures 32-35, screenshots 01-03).
Frost is not blue fire: vapour is born faint, grows and **sinks**; crystals bloom and fade in place; flakes are shed and fall.

### Ice — `ice` (first, owner-liked) · Frosted steel — `steel` · Dark ice — `dark`
```js
{id:'ice',name:'Ice',layers:[...ICE_VARIANTS.white,starts(mist())]},
{id:'steel',name:'Frosted steel',layers:[
 skin('Cold sheen',tex('Ice_Icedull'),{fixed:true,strength:1,base:true,filter:2,atlasRect:[0,0,1,1],tint:[1,1,1]}),
 glow('White facets',tex('Ice_Icedull'),{atlasRect:[0,0,1,1],pulse:'crystal',strength:.61,tint:[1,1,1],loop:2900}),
 shine({loop:2267}),starts(mist())]},
{id:'dark',name:'Dark ice',layers:[...ICE_VARIANTS.dark,starts(mist())]},
```
- Change from 7e9660b2: `mist()` is the cbc mist again (alpha 0/70/0, full size and fall). Codex's fainter mist is nearly invisible (captures 29, 46, 102, 119). `fixed:true` on Cold sheen stays (ice does not slide).
- Placement: mist on the current surface sites (sword: along the blade; curved: rim; body: rim, shoulders first); it falls in the world.

### Freezing vapour — `vapour`
- Glance: white frosted blade wrapped in slow cold fog that grows and pours downward off it.
- Lesson: Sunchips' long birth area and two overlapping layers, with Blizzard's cold numbers (Freezing Breath / Frostmourne: Clouds8x8, life 3-5, alpha 0/32/0, size growing 40>60>80). Blend for the body layer so the fog is visible on the light stage.
```js
{id:'vapour',name:'Freezing vapour',layers:[
 ...ICE_VARIANTS.white,
 spray('Cold vapour',CLOUDS,[.72,.88,1],
  {atlas:8,filter:0,life:2.4,rate:13,velocity:.06,gravity:.1,spread:180,size:[.16,.3,.46],alpha:[0,85,0]},
  {starts:true,birthRegion:true,birthAcross:1.2,
   native:{Time:.4,Variation:.3,SegmentColor:[[.85,.95,1],[.72,.88,1],[.62,.8,1]]}}),
 spray('Sinking mist',CLOUDS,[.8,.93,1],
  {atlas:8,life:1.5,rate:12,velocity:.04,gravity:.32,spread:180,size:[.12,.2,.3],alpha:[0,70,0]},
  {starts:true,birthRegion:true,loop:2533,
   native:{Time:.35,Variation:.3,Flags:U,SegmentColor:[[.9,.98,1],[.75,.92,1],[.6,.85,1]]}}),
]}
```
- Sword: two slab emitters along the blade; vapour hangs (sinks 0.3 R in its life), mist pours 0.4 R down. Neither is carried, so both trail on a swing.
- Curved blade / body: rim sites; on a body the fog rolls down from shoulders and arms. Needs the per-site rate floor on bodies.

### Ice shards — `shards`
- Glance: dark ice blade with five ice crystals blooming along its edge, blue star glints flashing in them, and small snowflakes breaking off and falling.
- Lesson: Moarg's core + glint + ejecta, translated: the core is a crystal that blooms and fades in place (Blizzard target: Frost3 0>9.8>0, alpha 0/219/0, white > cyan > blue), the halo is a crisp star (Blue_Star2, alpha 0/255/0, Time .75), the ejecta are flakes that fall (Frost Armor snowflake, pale > blue).
```js
{id:'shards',name:'Ice shards',layers:[
 ...ICE_VARIANTS.dark,
 spray('Frost cores',tex('Frost3'),[.55,.82,1],
  {life:.7,rate:26,velocity:.04,spread:180,size:[.03,.15,.05],alpha:[0,220,0]},
  {starts:true,siteCount:5,scatter:.25,widthCap:1,
   native:{Time:.4,Variation:.3,Flags:C,SegmentColor:[[1,1,1],[.3,.84,.9],[.1,.35,1]]}}),
 spray('Core glints',tex('Blue_Star2'),[.8,.92,1],
  {life:.67,rate:9,size:[.04,.17,.03],alpha:[0,255,0]},
  {starts:true,siteCount:5,scatter:.4,widthCap:1.2,loop:2267,
   native:{Time:.75,Flags:C,SegmentColor:[[1,1,1],[1,1,1],[.7,.85,1]]}}),
 spray('Falling shards',tex('snowflake'),[.82,.95,1],
  {life:1.5,rate:10,area:.04,velocity:.22,gravity:.7,spread:70,size:[.07,.055,.02],alpha:[255,255,0]},
  {starts:true,siteCount:5,scatter:.3,loop:2933,
   native:{Time:.5,Variation:.3,Flags:U,SegmentColor:[[.91,.98,1],[.32,.77,1],[.53,.71,1]]}}),
]}
```
- Sword: five sites along the blade; flakes fall about 0.8 R below it. Curved blade: five rim sites on the outer curve. Body: up to five rim sites; flakes fall from shoulders and arms.
- Dark surface on purpose: additive crystals cannot show on the white frost surface.
- Without `siteCount`: Frost cores get 4 sites, glints 1 (centre), shards 3; still acceptable but glints bunch at mid-blade.

---
## 2.4 Lightning (`lightning-blade`, loop 1240)

Three variations. Dropped: Airy (capture 60: barely visible), Compact core (61: white mass), Moving surface (62: nothing).
Lightning is brief, bright and local: each spark lives a quarter second, sites fire at different moments, colour runs white > blue > violet. The whole blade never strobes.
`const stormSteel=()=>glow('Storm steel',tex('Ice3b'),{base:true,filter:2,strength:.91,pulse:'steel',steel:true});`

### Lightning — `original` (first, owner-liked, arc rhythm changed)
- Glance: steel-blue blade with forked arcs running along it.
```js
{id:'original',name:'Lightning',layers:[
 stormSteel(),
 skin('Forked arcs',LIGHTNING4B,{pulse:'flicker',strength:.85,axis:'v',band:.32,tint:[.75,.89,1],loop:1033}),
 {...powerArcs(),enabled:false},
]}
```
- Change and why: texture path stays Codex's (the cbc path `Textures\Lightning4b.blp` is not in the texture catalogue). Rhythm: cbc `lightning`/.92 strobes the whole blade four times a second; Codex's `soft`/.64 reads as a still cyan outline (capture 59). `flicker`/.85 keeps it alive (0.65-1) without going dark.
- Placement: surface layers only; any part.

### Crackling arcs — `crackle`
- Glance: small white-blue bursts popping at different points along the blade, each throwing short jagged sparks outward, over a faint steady charge glow.
- Lesson: the owner's "Moarg as lightning": core + halo + ejecta, but spread over nine sites that each light about a third of the time. Blizzard values: Forked Lightning target (LightningBall, life .3, cone 85, 19>14>5, violet > blue > white) and Chimaera lightning (Zap1 tail, life .35, cone 86, 1>28>2, alpha 0/255/0).
```js
{id:'crackle',name:'Crackling arcs',layers:[
 stormSteel(),
 skin('Forked arcs',LIGHTNING4B,{pulse:'soft',strength:.6,axis:'v',band:.32,tint:[.75,.89,1],loop:1033}),
 spray('Arc bursts',tex('LightningBall'),[.62,.72,1],
  {life:.24,rate:14,velocity:.3,spread:85,size:[.2,.14,.05],alpha:[255,255,0]},
  {starts:true,siteCount:9,scatter:.45,widthCap:1.4,
   native:{Time:.5,Variation:.5,Flags:C,SegmentColor:[[1,1,1],[.36,.6,.9],[.37,.09,.95]]}}),
 spray('Jumping sparks',tex('Zap1'),[.6,.75,1],
  {life:.3,rate:12,velocity:1.3,spread:86,tail:.3,size:[.01,.16,.02],alpha:[0,255,0]},
  {starts:true,siteCount:9,scatter:.45,aim:'outward',loop:1533,
   native:{Time:.4,Variation:.4,Flags:U,SegmentColor:[[1,1,1],[.45,.56,.9],[.52,0,1]]}}),
 spray('Charge glow',tex('Blue_Glow2'),[.45,.7,1],
  {life:.9,rate:8,size:[.14,.18,.12],alpha:[40,70,0]},
  {starts:true,siteCount:4,widthCap:1.2,loop:2133,native:{Time:.5,Flags:C}}),
]}
```
- Sword: nine sites along the blade, each bursting about 1.5 times a second out of step with its neighbours. Curved blade: nine rim sites round the curve. Body: up to nine rim sites; sparks jump off shoulders, elbows, weapon.
- Needs `siteCount` and `scatter`: without them the live count (3) gives one site at mid-blade = the rejected look, and equal rates make every site blink together.

### Tip discharge — `tip`
- Glance: calm arcs on the blade; the tip holds a small blue glow and every second or so throws a quick star of jagged bolts.
- Lesson: Moarg's compact source moved to where a charge gathers, in lightning's own timing: bursts, not a steady stream. Two burst clocks (1240 and 1870 ms) so the rhythm never repeats evenly.
```js
{id:'tip',name:'Tip discharge',layers:[
 stormSteel(),
 skin('Forked arcs',LIGHTNING4B,{pulse:'soft',strength:.64,axis:'v',band:.32,tint:[.75,.89,1],loop:1033}),
 spray('Tip glow',tex('Blue_Glow2'),[.45,.7,1],
  {life:.8,rate:8,size:[.12,.16,.1],alpha:[60,110,0]},
  {starts:true,gather:'tip',widthCap:1.2,native:{Time:.5,Flags:C}}),
 spray('Discharge',tex('Zap1'),[.7,.82,1],
  {life:.28,burst:6,velocity:1.5,spread:180,tail:.25,size:[.02,.2,.02],alpha:[0,255,0]},
  {starts:true,gather:'tip',loop:1240,
   native:{Time:.3,Variation:.4,Flags:U,SegmentColor:[[1,1,1],[.6,.75,1],[.5,.1,1]]}}),
 spray('Second discharge',tex('Zap1'),[.7,.82,1],
  {life:.24,burst:4,delay:.33,velocity:1.2,spread:180,tail:.25,size:[.02,.16,.02],alpha:[0,255,0]},
  {starts:true,gather:'tip',loop:1870,
   native:{Time:.3,Variation:.4,Flags:U,SegmentColor:[[1,1,1],[.6,.75,1],[.5,.1,1]]}}),
 spray('Discharge flash',tex('LightningBall'),[.62,.72,1],
  {life:.2,burst:2,velocity:.1,spread:180,size:[.26,.18,.06],alpha:[200,200,0]},
  {starts:true,gather:'tip',widthCap:1.6,loop:1240,
   native:{Time:.5,Flags:C,SegmentColor:[[1,1,1],[.36,.6,.9],[.37,.09,.95]]}}),
]}
```
- Sword: everything on one site at the tip; bolts reach 0.4 R. Curved blade: the end farthest from the hand. Body: up to two extremities (horn tips, shoulders, weapon tip).
- Do not ship without `gather` (burst specs fall back to one mid-part emitter per region).

---
## 2.5 Arcane (`arcane-blade`, loop 2320)

Three variations. Dropped: Airy (68), Compact core (69: white square from a building texture), Enveloping (70: white speckle).
Arcane shimmers and swirls: colour beats between violet and blue, stars drift up slowly, ribbons circle the part.
`const enchanted=()=>glow('Enchanted steel',tex('Ice3b'),{base:true,filter:2,strength:.91,pulse:'steel',steel:true});`

### Arcane — `arcane` (first, owner-liked, orbs retuned)
- Glance: two violet/blue energy layers crossing on the blade, a small spinning star, and four soft orbs breathing along its length.
```js
{id:'arcane',name:'Arcane',layers:[
 enchanted(),
 skin('Flowing energy',CLOUDSTILE,{strength:.78,pulse:'beat',tint:[.72,.5,1],tint2:[.35,.55,1],loop:2600}),
 skin('Crossing energy',CLOUDSTILE,{strength:.55,pulse:'beat',tint:[.4,.6,1],tint2:[.75,.5,1],direction:120,speed:2,loop:3733}),
 cardSpec('Arcane star',tex('star5tga'),{spin:1,fit:.8,sizeMin:.85,sizeMax:1.15,loop:1400,tint:[.9,.75,1]}),
 spray('Glow orbs',tex('GenericGlowX'),[.75,.62,1],
  {life:.8,rate:10,area:.05,velocity:.04,spread:2,size:[.05,.2,.3],alpha:[110,170,60]},
  {starts:true,siteCount:4,scatter:.3,widthCap:.9,native:{Flags:C}}),
 glow('Narrow highlight',tex('FX\\Flare\\DiamondNarrow'),{strength:.3,loop:1767,enabled:false}),
]}
```
- Change and why: the cbc orb (`orbSpray()`: size .05>.35>.6 R, alpha 150/220/100, one site) is a 66-unit white ball on g11 (captures 66 and 78): the lone mid-blade orb the owner rejects. Now four orbs, each at most 0.9 W, lower alpha. `orbSpray()` itself is untouched (Motes / Glow orbs keeps it).
- Sword: orbs at four sites along the blade; star card at the centre. Curved blade: four rim sites. Body: up to four rim sites.
- `Textures\FX\Flare\DiamondNarrow.blp` (disabled layer) and `FX\Flare\FlareNarrow.blp` (`shine()`) are not in the texture catalogue; check that they load.

### Shimmering energy — `shimmer` (keep id; recipe replaced)
- Glance: energy sliding diagonally across the blade while violet stars rise off its whole length and shrink away, with fine star dust drifting round it.
- Lesson: DragonBlade (additive cloud layer scrolling (1,1) on a 2000 ms loop + Star7b slab emitter, size 10>10>0, alpha 255/255/0, rising). Codex's version used the Dark Portal building atlas as an underlay and tiny stars (capture 67: nothing visible); both removed.
```js
{id:'shimmer',name:'Shimmering energy',layers:[
 enchanted(),
 skin('Flowing energy',CLOUDSTILE,{strength:.85,pulse:'beat',tint:[.72,.5,1],tint2:[.35,.55,1],direction:45,loop:2000}),
 spray('Rising stars',tex('Star7b'),[.8,.65,1],
  {life:.7,rate:40,velocity:.03,gravity:-1.6,spread:35,size:[.13,.13,0],alpha:[255,255,0]},
  {starts:true,birthRegion:true,widthCap:1.1,loop:1733,
   native:{Time:.45,Variation:1,Flags:U,SegmentColor:[[1,.92,1],[.78,.6,1],[.4,.5,1]]}}),
 spray('Star dust',tex('star4_32'),[.85,.8,1],
  {life:1.6,rate:10,velocity:.08,gravity:-.2,spread:180,size:[.01,.045,.01],alpha:[0,255,0]},
  {starts:true,birthRegion:true,birthAcross:1.5,loop:2933,
   native:{Time:.5,Variation:.5,Flags:U,SegmentColor:[[1,1,1],[.85,.75,1],[.5,.6,1]]}}),
]}
```
- Sword: slab emitters along the blade; stars rise 0.4 R. Curved blade / body: rim sites, same motion.

### Arcane swirl — `swirl`
- Glance: two thin ribbons of light circling the blade at different speeds, with small lights riding the same orbits; the blade's energy is dimmer so the swirl leads.
- Lesson: Blizzard's arcane effects are ribbon-led (Mana Flare, Spell Steal, Mana Shield). Built with the orbit ribbon the owner kept in Soul vortex, plus orbiting motes.
```js
{id:'swirl',name:'Arcane swirl',layers:[
 enchanted(),
 skin('Flowing energy',CLOUDSTILE,{strength:.6,pulse:'beat',tint:[.72,.5,1],tint2:[.35,.55,1],loop:2600}),
 orbit('Swirl',tex('RibbonBlur1'),[.72,.55,1],{orbitTurns:2,strength:.6,lasts:.6}),
 orbit('Second swirl',tex('RibbonBlur1'),[.45,.6,1],{orbitTurns:2,loop:3100,fit:.75,strength:.6,lasts:.6}),
 starts(dust('Orbiting motes','motes',tex('GenericGlow64'),{tint:[.8,.7,1]})),
]}
```
- Sword / curved blade: ribbons turn about the part's long axis at radius max(2.5 x girth, 0.14 x length). Body: they circle each skin region; on a whole body this is busy, expected use is weapons, arms, horns.

---
## 2.6 Poison (`poison-skin`, loop 3400)

Three variations. Dropped: Codex's replacement first look and all four techniques (captures 89-93: a few large comic bubbles, faint haze, yellow lamp).
Poison is wet and heavy: it coats, bubbles in small quick pops, drips and falls; its gas is a yellow-to-green smoke, not a glow.
`const VENOM=[.5,.82,.22];`
`const poisonFilm=(extra={})=>skin('Poison surface','TerrainArt\\Felwood\\Felwood_Poison.blp',{nativeSurface:{...existing('poison'),description:undefined},tint:[1,1,1],...extra});`
`const bubbles=(rate,sites)=>spray('Bubbles',tex('Bubble'),[.45,.9,.25],{life:.45,rate,area:.06,velocity:.1,spread:60,size:[.012,.035,.045],alpha:[0,200,0]},{starts:true,siteCount:sites,scatter:.4,widthCap:.35,loop:1933,native:{Time:.6,Variation:.4,Flags:C,SegmentColor:[[.7,1,.4],[.45,.9,.25],[.3,.72,.33]]}});`

### Poison — `original` (first, owner-liked: cbc17f49)
- Glance: the part's own texture replaced by drifting green Felwood poison.
```js
{id:'original',name:'Poison',layers:[
 poisonFilm({base:true,strength:.9}),
 dust('Heavy drops','drops',tex('WaterBlobs1'),{...DRIP}),      // ingredient, not started (cbc)
]}
```
- Placement: surface only; any part.

### Dripping venom — `venom`
- Glance: the part keeps its own look under a green film; green drops with short tails fall from it and tiny bubbles pop on its surface.
- Lesson: Moarg's "ejecta that outlives the core", turned to weight: drops fall. Drops are the Tidal blade recipe (capture 47 shows them reading well; Blend, so they stay green on the light stage). Bubbles follow Blizzard's cauldron (small, life .3, quick), not Codex's 1.2 s rings of 0.09 R.
```js
{id:'venom',name:'Dripping venom',layers:[
 poisonFilm({strength:.7}),                                      // overlay: no base
 dust('Venom drips','drops',tex('WaterBlobs1'),{tint:VENOM,starts:true,...DRIP}),
 bubbles(20,8),
]}
```
- Sword: drops fall from sites along the blade (current drop sites); bubbles at eight sites on the blade face, 4-5 units across on g11, about 2.5 on an ordinary sword. Curved blade: rim sites. Body: rim sites; drops fall from arms and shoulders.

### Toxic fumes — `fumes`
- Glance: green film on the part and a low yellow-green smoke clinging to its whole length, thinning to dark green as it lifts.
- Lesson: Sunchips' long birth area with two layers; values from Blizzard's Plague Cloud (Clouds8x8 **Blend**, alpha 123/60/0, yellow f7ff11 > green 82fa02 > 00cb0a, growing 45>55>65).
```js
{id:'fumes',name:'Toxic fumes',layers:[
 poisonFilm({strength:.7}),
 spray('Toxic fumes',CLOUDS,[.6,.85,.1],
  {atlas:8,filter:0,life:1.7,rate:14,velocity:.1,gravity:-.06,spread:180,size:[.14,.22,.32],alpha:[110,60,0]},
  {starts:true,birthRegion:true,birthAcross:1.2,
   native:{Time:.5,Variation:.3,SegmentColor:[[.97,1,.07],[.51,.98,.01],[0,.8,.04]]}}),
 spray('Fume glow',tex('CloudSingle'),[.55,.9,.15],
  {life:1.1,rate:10,velocity:.08,gravity:-.1,spread:180,size:[.12,.2,.26],alpha:[0,60,0]},
  {starts:true,birthRegion:true,loop:2633,native:{Time:.4,Variation:.3,Flags:U}}),
 bubbles(10,5),
]}
```
- Sword: slab emitters along the blade; smoke stays within about 0.3 R of it. Curved blade / body: rim sites; needs the per-site rate floor on bodies.

---
## 2.7 Water (`claude-tidal-blade`, loop 2600)

Three variations: the two existing ones stay, one added. Dropped: all four techniques (captures 49-52: grey smudge, dark square halo).
`const sea=[.68,.9,1]; const water=Array.from({length:8},(_,i)=>tex('Lords000'+i));`
`const running=()=>skin('Running water',water[0],{frames:water,water:true,axis:'v',strength:.85,tint:sea});`
`const sheen=()=>glow('Wet sheen',tex('Ice3b'),{pulse:'soft',strength:.45,tint:sea,loop:1733});`
`const drip=(extra={})=>dust('Dripping water','drops',tex('WaterBlobs1'),{tint:sea,starts:true,...DRIP,...extra});`

### Running water — `running` (first, owner-liked) · Crossing currents — `currents` (kept as is)
```js
{id:'running',name:'Running water',layers:[running(),sheen(),drip()]},
{id:'currents',name:'Crossing currents',layers:[/* the two water-skin layers as today */,drip()]},
```
- Captures 47 and 48: both read well; no change. Keep Codex's drop count floor and surface sites.

### Sea spray — `spray`
- Glance: running water on the blade with small splashes leaping off it in short arcs and a fine white spray falling behind them.
- Lesson: Tzeentch's sparse sites and short ballistic loft, with Blizzard's water numbers (Water Elemental missile: WaterBlobs1, life .5, cone 29-38, strong gravity, 35>25>6, blue > pale > white; Crushing Wave foam). Blend for both, as Crushing Wave does, so they show on the light stage like the drops do.
```js
{id:'spray',name:'Sea spray',layers:[
 running(),sheen(),
 spray('Splashes',tex('WaterBlobs1'),sea,
  {filter:0,life:.55,rate:30,velocity:.9,gravity:2.6,spread:34,size:[.13,.09,.02],alpha:[215,255,0]},
  {starts:true,siteCount:6,scatter:.35,aim:'outward',widthCap:1.2,
   native:{Time:.5,Variation:.35,Flags:U,SegmentColor:[[.26,.76,1],[.71,.88,1],[1,1,1]]}}),
 spray('Spray mist',tex('White_64_Foam1'),[.85,.95,1],
  {filter:0,life:.8,rate:18,velocity:.5,gravity:1.2,spread:60,size:[.05,.08,.09],alpha:[200,160,0]},
  {starts:true,siteCount:6,scatter:.35,aim:'outward',loop:2133,
   native:{Time:.5,Variation:.3,Flags:U,SegmentColor:[[.55,.68,.97],[.85,.89,.99],[1,1,1]]}}),
 drip({amount:8}),
]}
```
- Sword: six sites along the blade; splashes leave along the surface normal, travel about 0.5 R and fall 0.4 R. Curved blade: six rim sites on the outer curve. Body: up to six rim sites.
- Without `aim`: launch follows the bone's +Z; the arcs still fall correctly, only their first direction is arbitrary.

---
## 2.8 Lava (`lava` "Molten lava", loop 3100) and the two other lava looks

`lava` carries the Variation list (three). `claude-magma-flow` and `fissures` return to their cbc single recipes (section 4) with no variations.
Lava is heavy and glowing: beads swell and cool on the surface, lumps are thrown a short way and drop fast, drips fall, smoke rises slowly.
`const molten=()=>/* the skin the SURFACE_EFFECTS loop builds for 'lava' today, without speed:.2 */;`

### Molten lava — `original` (first, owner-liked: cbc17f49)
```js
{id:'original',name:'Molten lava',layers:[molten()]}
```
- Glance: slow lava currents over the part. Surface only; any part.

### Spitting lava — `spitting`
- Glance: lava surface with glowing beads swelling and cooling along it, bright lumps thrown off and dropping fast, and slow drips with short tails.
- Lesson: Moarg's dense core + ejecta at lava's weight. Beads: the row of LavaLump beads in captures 20 and 25 is the one technique result that already looked good; kept, made to swell and cool instead of sitting still. Lumps: Volcano / Lava Spawn missiles (LavaLump2, cone 32, gravity about 2x speed, alpha 255/255/0).
```js
{id:'spitting',name:'Spitting lava',layers:[
 molten(),
 spray('Molten beads',tex('LavaLump'),[1,.5,.12],
  {life:1.6,rate:16,velocity:.02,spread:180,size:[.05,.13,.08],alpha:[0,230,0]},
  {starts:true,siteCount:8,scatter:.3,widthCap:.8,
   native:{Time:.5,Flags:C,SegmentColor:[[1,.85,.4],[1,.5,.12],[.7,.1,.02]]}}),
 spray('Lava spit',tex('LavaLump2'),[1,.8,.4],
  {life:.9,rate:9,velocity:.75,gravity:2.4,spread:32,tail:.12,size:[.085,.065,.02],alpha:[255,255,0]},
  {starts:true,siteCount:4,scatter:.4,aim:'outward',loop:2267,
   native:{Time:.5,Variation:.4,Flags:U,SegmentColor:[[1,1,.85],[1,.75,.3],[1,.3,.05]]}}),
 spray('Lava drips',tex('LavaLump'),[1,.55,.15],
  {life:1.3,rate:6,velocity:.02,gravity:1.5,spread:180,tail:.1,size:[.06,.05,.03],alpha:[255,230,60]},
  {starts:true,siteCount:5,scatter:.4,loop:2933,
   native:{Time:.5,Flags:U,SegmentColor:[[1,.8,.35],[1,.45,.1],[.6,.08,.01]]}}),
]}
```
- Sword: eight bead sites along the blade, four spit sites, five drip sites. Curved blade: rim sites. Body: rim sites; drips fall from arms and shoulders.

### Smouldering — `smoulder`
- Glance: lava surface with an orange heat glow, thin dark smoke rising slowly off the whole part and a few cinders floating up through it.
- Lesson: Sunchips' long birth area; smoke as Blizzard draws it over lava and fire (Clouds8x8 Blend 407 native uses; Volcano smoke grey-brown, growing, alpha fading in and out). Dark Blend smoke is the one layer that reads strongly on the light stage.
```js
{id:'smoulder',name:'Smouldering',layers:[
 molten(),
 glow('Heat glow',null,{pulse:'soft',strength:.6,tint:[1,.45,.12],inflate:.3,loop:3733}),
 spray('Smoke',CLOUDS,[.3,.26,.24],
  {atlas:8,filter:0,life:2.6,rate:9,velocity:.12,gravity:-.16,spread:30,size:[.1,.24,.42],alpha:[0,85,0]},
  {starts:true,birthRegion:true,
   native:{Time:.3,Variation:.3,SegmentColor:[[.5,.3,.2],[.3,.26,.24],[.2,.2,.2]]}}),
 spray('Cinders',tex('LavaLump'),[1,.5,.15],
  {life:2.4,rate:7,velocity:.14,gravity:-.22,spread:40,size:[.035,.028,.012],alpha:[220,170,60]},
  {starts:true,birthRegion:true,loop:3133,
   native:{Time:.5,Variation:.4,Flags:U,SegmentColor:[[1,.7,.25],[1,.35,.12],[.45,.07,.01]]}}),
]}
```
- Sword: slab emitters along the blade; smoke climbs about 0.85 R. Curved blade / body: rim sites; on a body the smoke rises from shoulders and back.

---
## 2.9 Crystal (`fx-lit-crystal`, loop 3600, overlay)

Three variations: the two existing ones stay, one added. Dropped: Airy, Compact core (captures 39, 44, 112, 117: white lamp), Moving surface.
Crystal is hard and still: no smoke, no drift, no gravity. Its life is light catching facets: many small crisp glints that flash and vanish in place, and a rare larger flare.

### Inner light — `light` (first) · Team colour core — `team` (kept as is)
```js
{id:'light',name:'Inner light',layers:[crystalFacets(4),
 skin('Crystal light',tex('CrystalOpaque'),{fixed:true,bodyUV:true,filter:3,inflate:.13,tint:crystal,strength:.7,pulse:'soft'}),facetGlints()]},
{id:'team',name:'Team colour core',layers:[/* as today */]},
```

### Sparkling facets — `sparkle`
- Glance: lit crystal with a dozen points along it twinkling out of step, and now and then a larger four-ray flare.
- Lesson: DragonBlade's "surface plus small particles", stripped of motion for crystal. Glint timing from Blizzard's star sprites (alpha 0/255/0, size 3>10>3).
```js
{id:'sparkle',name:'Sparkling facets',layers:[
 crystalFacets(4),
 skin('Crystal light',tex('CrystalOpaque'),{fixed:true,bodyUV:true,filter:3,inflate:.13,tint:crystal,strength:.7,pulse:'soft'}),
 spray('Facet sparkles',tex('star4_32'),[.85,.95,1],
  {life:.5,rate:10,area:.06,size:[.01,.085,.01],alpha:[0,255,0]},
  {starts:true,siteCount:12,scatter:.45,widthCap:.8,
   native:{Time:.4,Flags:C,SegmentColor:[[1,1,1],[.8,.93,1],[.53,.77,1]]}}),
 spray('Prism flares',tex('star5tga'),[.75,.8,1],
  {life:1.1,rate:2.5,size:[.02,.16,.02],alpha:[0,200,0]},
  {starts:true,siteCount:3,scatter:.45,widthCap:1.4,loop:2933,
   native:{Time:.5,Flags:C,SegmentColor:[[1,1,1],[.7,.75,1],[.85,.6,1]]}}),
]}
```
- Sword: twelve sparkle sites along the blade, each lit about 40% of the time; three flare sites. Curved blade: rim sites. Body / armour: rim sites spread over the silhouette.
- Needs `siteCount`: the live count (5) alone gives one site.
- `crystal-veins` (Terrain look): return to the cbc recipe (section 4); no variations.

---
## 3. Placement and engine needs

Behaviour only; how it is built is the head designer's call. Every one of these is a starting value the user can still change with the existing controls (Emitters, Size, placement and aim handles).

| # | Key in the literals | Behaviour wanted | Values | Used by | If missing |
|---|---|---|---|---|---|
| 3.1 | `widthCap:k` | After sizing, if the largest stage is bigger than k x W (W = half-width of the part at that site: the site's component radius), scale all three stages down to it. Today only `airyFit` does this, fixed at 0.75, and slab (`birthRegion`) sites have no W. Size slider edits still win. | 0.35 to 1.7 | cores, beads, orbs, glints, bubbles | hugging sprites are 2-4x too big on thin swords (they scale with length only) |
| 3.2 | `gather:'tip'` | All sites of the layer sit at the part's extremity. Straight strip: one site in the last 10% of the length, at the end farthest from the parent bone's pivot (the hand). Curved piece: the rim site farthest from that pivot. Body / many regions: up to two extremity sites, one per side (shoulder preference as today). Every `gather:'tip'` layer of a variation uses the same site(s). Also applies to `burst` specs. | - | Fireball, Tip discharge | single mid-part site = the rejected orb. Blocking for those two variations |
| 3.3 | `aim:'tip'` / `aim:'outward'` | Emitter +Z turned along the part axis toward the extremity (`tip`) or along the site's surface normal (`outward`). Written as the same Rotation the aim handle edits. No key = today's behaviour (bone +Z). | - | Fireball jet; streaks, sparks, splashes, lava spit | first direction of the particles is arbitrary; shapes still fall/rise correctly |
| 3.4 | `siteCount:n` | The fresh layer starts with n sites even when its live-particle budget would allow fewer (today: floor(live/4)). Same stations as the strip/rim sampler gives for n; on rim shapes n is an upper bound; rate split evenly. This is the Emitters slider's value preset by the recipe. Layers of one variation with the same n land on the same stations. | 3 to 12 | all multi-core and twinkle layers | intermittent layers collapse to one mid-part site (Crackling arcs, Sparkling facets, Arcane orbs) |
| 3.5 | `scatter:s` | Each site's emission rate multiplied by a fixed per-site factor spread over 1 +/- s (today `airyFit` gives +/- 0.12), so sites do not emit in step. | 0.25 to 0.45 | every `siteCount` layer | all sites blink together: a whole-blade strobe |
| 3.6 | `birthAcross:k` | Slab (`birthRegion`) half-width across the part = k x W instead of 0.7 x W, so particles are born around the blade, not inside the mesh. | 1.2 to 1.6 | sheaths, vapour, fumes, dust | flames start inside the blade and show only where they overflow (capture 2) |
| 3.7 | (none) | Per-site rate floor. When a slab layer lands on a curved piece or a body it becomes many point sites that share one rate. Keep at least 2 live particles per site by raising the layer total, up to 4x the recipe rate. Also let curved pieces take sites by coverage (length / footprint, max 16) instead of the fixed 4. | min live 2, max x4 | all `birthRegion` layers | sheath, vapour and smoke are full on a sword and threadbare on a body |
| 3.8 | `native.SegmentColor` in the literals | The three stage colours are recipe intent. Wanted: the Colour control re-tints the ramp (each stage x newTint / recipeTint) instead of the ramp being pinned. Same wish for `Time`, `Variation`, `Flags`: recipe defaults, not pins. | - | every native layer | Colour swatch does nothing on these layers until the user edits the three stage colours |
| 3.9 | `filter:2` | Check that Modulate particles draw as in game (white = no change, no square edge) before `Heat shade` is started. | - | Enveloping flames | layer stays an ingredient |
| 3.10 | - | Variations are listed by hand per look; `withElementTechniques`, `elementTechnique`, `ELEMENTS` and the `technique-*` ids are removed. Those ids exist only in the rejected trial; a stack saved with one should open on the look's first variation with its layers kept as user layers. | - | all nine | - |
| 3.11 | (optional) `side:'under'` | Site on the face most exposed to world -Z, for drip layers. | - | Venom drips, Lava drips, Dripping water | drips start on the top face and fall through the part; acceptable (capture 47) |

Already expressible, no work: birth area along the long axis (`birthRegion`), alpha that holds (third alpha value), carried vs world particles (`Flags`), bursts on their own clock (`burst`, `delay`, `loop`), colour across life (`native.SegmentColor`).

Sizing note for review: with `radius` = 0.48 x length, a straight blade's own half-width W is between 0.14 R (ordinary sword) and 0.27 R (g11). Uncapped sizes above are therefore 1.5-3 W on ordinary swords; that is intended only for sheath, vapour, smoke and Surface flames.

## 4. Keep / undo list for Codex's changes (7e9660b2 vs cbc17f49)

| Change | Decision | Reason |
|---|---|---|
| Surface-fitted emitter sites on every built-in and native emitter | **Keep** | Captures 1, 5, 120, 121, 122: flames sit on the surface and follow the part. |
| Strip loft / gravity / alpha rewrite of built-in flames (`airyFit`) on the first Fire and Fel variations | **Undo there, keep as "Flame licks"** | The liked recipe is the dense cbc flame. The airy one is good (capture 1) and becomes its own variation. Keep the 0.75 W size cap at rim sites for both. |
| `steadyRate` on new built-in emitters | **Keep** | Owner item; no visible fault. |
| Rebuilt Rising embers (LavaLump, slow, cooling) | **Keep** | Owner item; matches Moarg's long-lived sparks. |
| Auto-appended technique variations (Airy / Compact core / Enveloping / Moving surface) on every element look, `ELEMENTS`, `elementTechnique` | **Undo (remove)** | The rejected work: captures 4, 6-9, 13-26, 32-35, 38-40, 43-45, 49-57, 60-62, 68-70, 90-93. Only the LavaLump bead row (20, 25) is reused, in Spitting lava. |
| Fire `enveloping-flames`, `fireball` | **Keep ids, replace recipes** | 2.1. |
| Arcane `shimmer` | **Keep id, replace recipe** | 2.5; capture 67 shows nothing. |
| Fainter Frost mist (`frost()` tint, scale, alpha 42) | **Undo** | Captures 29, 46, 102, 119: mist barely visible. Applies to Frost, Frost mist and the retired ice skins. |
| Frosted steel "Cold sheen" `fixed:true` | **Keep** | Ice should not slide across the blade. |
| Lightning arc texture path (Doodads\Cinematic\Lightningbolt) for Forked arcs, Blade arcs and the Add layer entry | **Keep** | The cbc path is not in the texture catalogue. |
| Lightning Forked arcs `soft` / .64 | **Change to `flicker` / .85** | 2.4: neither the cbc strobe nor a still outline. |
| Arcane glow orbs moved to surface sites | **Keep sites, retune the layer** | 2.5: four capped orbs instead of one 66-unit ball. |
| Tidal blade drops: count floor and surface sites | **Keep** | Captures 47, 48 read well. |
| Magma flow: Cave_Lava texture, `speed:.2`, lava specks | **Undo** | Back to cbc (Flame4 flow at speed 1 over Cooled rock). Specks were thin and off-rhythm (capture 17). |
| Molten lava: `speed:.2`, lava specks | **Undo** | cbc drift was already slow; x0.2 is nearly still (capture 22). Particles now live in the two new variations. |
| Fissures skin: `speed:.2`, lava specks | **Undo** | Same; the crack pulse should swell at its cbc pace. |
| Poison: overlay + bubbles + haze replacing the first look | **Undo** | First variation is the cbc replacing surface. The overlay idea continues in Dripping venom and Toxic fumes with correct sprites. |
| Crystal veins: CrystalOpaque fixed surface | **Undo** | Back to cbc (glacial vein tile, soft pulse); capture 42 is a flat dark teal. |
| Liquid body: appended water particles | **Undo** | Came from the removed technique table (captures 53-57). |
| `element` field on looks | **Remove with the technique table** | Nothing reads it afterwards. |
| Unified particle controls, Emitters / Formation, placement and aim handles, markers, Keep individual / Apply all | **Keep** | Owner-requested; the new recipe keys in section 3 only preset what these controls edit. |

## 5. Render these first

Stage: the app's light grey. Parts: Great Unclean g11 (wide straight blade), g10 (blade face), g17 (curved scythe), g9 (horns), Footman body, and one **ordinary thin sword** (Footman or Tzeentch champion blade): g11 is 4:1, most swords are 10:1 or thinner, and every `widthCap` value needs both.

1. **Fire / Enveloping flames** on g11 and the thin sword, beside reference capture 129. Confirms sprite size 0.43 R, `birthAcross`, held alpha. Then the same with `Heat shade` switched on: does Modulate draw without squares, and does it keep the fire orange on the light stage. If yes, start it by default.
2. **Fire / Fireball** on g11, g17 and Footman: is the tip found, is the jet aimed past it, is the halo no longer a pink disc. Reject back to me if it still reads as a lamp.
3. **Lightning / Crackling arcs** on g11: do the nine sites fire out of step (no whole-blade blink), are the bursts about blade-wide. Beside it the first variation with `soft`/.64, `flicker`/.85 and `lightning`/.92 so the owner's taste on flicker can be read off one sheet.
4. **Arcane (first)** on g11: the white blob of capture 66 must be gone, four soft orbs instead.
5. **Frost / Freezing vapour** on g10: is the Blend fog visible on the light stage without hiding the blade (alpha 85). **Ice shards** on g10: crystal size against the blade, flakes falling.
6. **Fel surge** on g11 and thin sword: bead chain and streak length.
7. **Poison / Dripping venom** on g11 and Footman: bubble size (must be small and many), drops green.
8. **Lava / Spitting lava** and **Smouldering** on g11: bead swell, spit arc, smoke density.
9. **Water / Sea spray** on g11: Blend splashes visible, arcs short.
10. **Crystal / Sparkling facets** on g10 and Footman armour: twinkle rate, flare size.
11. First variations after the undo list (Fire, Fel, Frost, Poison, Molten lava, Magma flow, Fissures, Crystal veins) on g11 and Footman, to confirm they match what the owner liked.

What I am least sure of without a render: absolute sprite sizes on bodies (many small regions change `radius`), Modulate support, and whether carried zero-speed sprites at surface sites clear the mesh (if glints are half-hidden, raise their site clearance to the sprite's peak size).

