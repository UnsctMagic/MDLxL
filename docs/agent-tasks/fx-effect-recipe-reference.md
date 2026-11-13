# MDLxL FX look-recipe reference (commit 7e9660b2, branch claude/fx-effects)

Source read-only. Abbreviations (all under `src/`): **GAL** global-animation-looks.js, **GAM** global-animation-model.js,
**TL** fx-technique-looks.js, **CL** claude-fx-looks.js, **SL** fx-sort-looks.js, **FC** fx-cards.js, **LB** fx-layer-basis.js,
**VEC** visual-effect-composition.js, **ES** fx-emitter-surface.js, **EP** fx-emitter-placement.js, **UI** app/GlobalAnimationControls.jsx.
`cbc` = commit cbc17f49. Cites are file:line at 7e9660b2 unless prefixed `cbc`.
Unit note: "model units" = raw MDX units. Model Z is up. A "part" = the selected geoset(s); its "frame" = principal-axis fit (`partFrame`, GAL:263).

---
## 1. Look and variation structure

A look is a plain object (`make`, GAL:40). Layers are plain objects built with the helpers `skin`, `glow`, `dust`, `fire`, `embers`, `frost`, `cardSpec`, `spray` (GAL:17-27, FC:45, TL:11).

| Look field | Meaning |
|---|---|
| `id` | Stored in the saved model (`_FxStack.look`). Never rename. CL/TL/SL prefix ids `claude-`, `fx-`, `sort-` (CL:17, TL:14, SL:20). |
| `name` | Display name. `LIBRARY` rows may override it (GAL:145). |
| `group` | Folder. Overwritten from `LIBRARY` (GAL:145); the `group` you put in the object is ignored for listed looks. |
| `loop` | Look clock in ms. Compile uses `max(200,round(loop))` as the shared GlobalSequence (GAM:1035). |
| `palette` | Key for `surfacePalette({palette})[0][1]` = default tint of layers with no `tint` (GAL:384). `'native'` = palette default. |
| `layers` | Layer specs. For a look with `variations` it is overwritten with `variations[0].layers` (`vary`, GAL:42). |
| `element` | Key into `ELEMENTS` (TL:39). Makes `withElementTechniques` (GAL:127, TL:72) append technique variations. |
| `asOverlay` | `true` = new geoset copy drawn over the part's own material. `undefined` = overlay unless some enabled layer has `base:true` (`createsOverlay`, GAL:262). |
| `variations` | `[{id,name,layers,technique?,legacyLayers?}]`. |
| `impact` | Attack-impact look (card-loop only, GAL:119). Ignore for new looks. |

**Variations.** `vary(look,[...])` (GAL:42). `newStack` (GAL:429) builds the stack from `look.layers`, i.e. variation 0. `withVariation` (GAL:160) swaps layers on a switch:
- Layers owned by the current look (`recipeOwner===look.id`; set by `newStack` GAL:431 and `withVariation` GAL:177) are replaced, in order, by the same-kind (surface vs particle) layers of the new variation; the old layer id and its enabled flag are reused (GAL:174-177). Layers the user added (not owned) are kept (GAL:170,179).
- `recipeRole` (default = index in the variation) is stored per layer; elementTechnique sets it to the role name (TL:50).
- Legacy stacks (no `recipeOwner`) match only if exactly one structural match by `identity` (type,kind,label,image,nativeSpec.texture,ground,stamp,base,own,fixed,frames) (GAL:167-169); `legacyLayers` on a variation lists old-shaped specs for this matching (used by Enveloping/Fireball, GAL:48-49).
- `currentVariation` (GAL:158) = `stack.variation` if valid, else the variation whose first layer label is present.

**What starts.** A Particles spec is added to a new stack only if `starts:true` (GAL:431, 163); a look whose layers are all Particles also starts layer 0. Non-particle specs always enter the stack; `enabled:false` enters it switched off. A Particles spec without `starts` is not in the stack at all: it is only an ingredient offered in Add emitter (`LAYER_CHOICES` GAL:181-205, `emitterChoices` GAL:225). `enabled:false` on a Particles spec only matters inside `withVariation` for the ids it reuses (GAL:176).

**Filing.** `LIBRARY` (GAL:130-141) is the only listing: `[folder,[[id,displayName?],...]]`. A look absent from it is "retired" (GAL:143-145): not listed or searchable, but still opens from a saved model (`findLook` GAL:148). Order in LIBRARY = order in the UI.

**Registering a new look/variation without id exceptions**
1. New element: add a row to `ELEMENTS` (TL:39-49). Fields used by `elementTechnique` (TL:51-71): `tint`, `core`(+`atlas`), `back`, `fleck`, `wrap`, `wrap2`, `surface`, `airy`(+`airyAtlas`), `underlay`, `structure`, `alpha` (multiplies every particle alpha triplet, TL:52), `filter` (PE2 blend, default 1), `surfaceFilter` (material filter, default 3), `flow` (surface Speed, default .65), `gravity`, `life`, `heavy`, `wrapSurface`, `noWrap`, and per-role overrides `moving`, `airyMotion`, `coreMotion`, `secondary` (spread over the role's nativeSpec, so any nativeSpec key works).
2. Put `element:'<key>'` on the look (`make(...,element)` GAL:40, or `{...look,element}`). `withElementTechniques` then appends `technique-airy|compact|enveloping|moving` variations (enveloping omitted if `noWrap`), skipping techniques already declared by a variation's `technique` field (GAL:127, TL:72-77). No look-id is tested anywhere.
3. A hand-written variation is just another `{id,name,layers}` object in the `vary` list (e.g. GAL:46-50, 58-66). `technique:'airy|compact|enveloping|moving'` on it only tells `withElementTechniques` not to add that technique again.
4. File it in `LIBRARY`.
`recipeKey` (`element/technique/role`, TL:53) + `menuLabel` identify an emitter in menus (GAL:200-203, `layerIngredient` GAL:218).

---
## 2. Layer types

### 2.0 Fields common to all layers (made by `makeLayer`, GAL:374-428)
| Field | Default | Meaning |
|---|---|---|
| `type` | - | `'Moving skin' 'Glow' 'Particles' 'Card' 'Edge' 'Rune'`. UI shows a `fixed` Moving skin as "Surface" (GAL:238). |
| `label` | - | Name. Also the identity for `layerIngredient`. |
| `enabled` | true | false = present but not compiled (GAM:1053). |
| `tint` `[r,g,b]` 0..1 | palette colour (`water`:[.65,.83,.99]; flies [1,1,1]) | Geoset colour (surfaces, cards), SegmentColor (particles), ribbon Color. |
| `strength` | 1 | Surfaces: alpha scale. Glow: >1 adds extra additive passes. Particles: multiplies nativeSpec/built-in Alpha. Edge: ribbon Alpha. Card: 0..1. |
| `loop` | look loop | ms. Own GlobalSequence (min 100) for surface layers, Edge, and any layer with `nativeSpec` (GAM:1056). **Ignored by built-in-kind Particles.** Card: base clock (FC bounds 100..20000). |
| `offset` `[x,y,z]` | 0 | Model units added to emitter/ribbon/card points (GAM:746, EP:31). |
| `speed` | 1 | Surfaces: texture passes per loop. Native emitters: time scale (see 3.2). |
| `direction` | 0 | Degrees; UV lattice rotation / atlas excursion direction. |
| `tiling` | 1 | UV repeat multiplier (not with `atlasRect`). |
| `upper`,`lower` | `length/2` | Half-spans (model units) along the part used to place built-in emitters and ribbon height (GAM:625-626, 726). |
| `smoothness` | 32 | Edge ribbon EmissionRate. |
| `scale` `{size,velocity,gravity,stages}` | {} | Look-only multipliers of the part-fitted emitter values (GAL:386-398). `stages:[a,b,c]` writes `native.ParticleScaling=[a,b,c]*size`. Not saved. |
| `fit` | 1 | Card size share / orbit radius share. Not saved. |
| `shell` | - | UI only: shows Lift as "Thickness". Not saved (GAL:387). |

### 2.1 Filter mode numbers
Two different enums. Confusing them is the commonest mistake.
| # | Material layer (`filter` on skin/glow/card/edge; GAL:337) | Particle emitter `FilterMode` (`nativeSpec.filter`, `native.FilterMode`; `particleBlendNames` src/particle-picture.js:21) |
|---|---|---|
| 0 | Solid (None, ignores alpha) | Blend (uses texture alpha) |
| 1 | Cut-out (Transparent, alpha-key) | Additive |
| 2 | See-through (Blend, texture alpha) | Modulate |
| 3 | Add | Modulate 2x |
| 4 | Add alpha | Alpha Key |
| 5 | Darken (Modulate) | - |

Material defaults: skin/glow `filter ?? (base?2:3)` (GAM:264); Edge `orbit?3:4` (GAM:724); Card 3 (FC:6). `strengthPasses` turns a 0/1 filter into 2 when the pass alpha <1 (GAM:130), and adds extra passes with filter 3 for Glow strength >1 (GAM:126-129). Particles: `spec.filter??1`; built-in `drops`,`flies` use 0 (GAM:655).

### 2.2 Moving skin / Glow / Rune (`skinLayer`, GAM:227-291)
All three become **a copy of the selected geoset** (`overlay`, GAM:96) with its own TVertices, own Material (1 layer, plus extra additive passes for Glow strength>1), a GeosetAnim (`Flags|=2` = use colour; `Color`=tint, or animated colour for colour rhythms; `Alpha` copied from the part's anim). Tag `<owner>/<id>/shape`. Material PriorityPlane = `base?0:1`.

| Field | Range / unit | Becomes |
|---|---|---|
| `image` | game path; `null` = the part's own texture (`own`) | Texture entry. Wrap flags 3 (repeat) unless `atlasRect` is set (clamped) (GAM:240, 72-75). `team:1\|2` = ReplaceableId 1 team colour / 2 team glow (GAM:77). |
| `own:true` | bool | Use the part's original material texture/UV (GAM:170,173). Painted atlas + not-repeating => only a ±1.4% drift (GAM:171,270). |
| `base:true` | bool | PriorityPlane 0, default filter 2, and (if no `asOverlay`) the part's own layer becomes an underlay (`FilterMode 2`, Alpha 0) (GAM:1038-1050). With `water` the underlay keeps the part's layers at alpha .22. |
| `bodyUV:true` | bool | Use the part's own UVs, each connected island stretched to 0..1 (GAM:173,183-188). Default Shading 16 (shaded). |
| (neither) | | `streakCoordinates` (VEC:56): per island, position along the strip axis -> one UV axis, across -> the other. |
| `axis:'v'` | `'u'` (default) \| `'v'` | `'v'`: along-blade runs on V, scroll goes on V (GAM:274). |
| `band` | 0..1, default `.8` (base: `1`) | Fraction of the texture's cross-axis the blade width samples, centred at .5 (VEC:69). Smaller = narrower slice. |
| `atlasRect` `[u0,v0,w,h]` | 0..1 | UVs squeezed into that rect with 10%/12% margins (glyphs 2%) (GAM:200-207); texture un-wrapped; movement becomes a ±9% excursion of the rect, direction `direction` (GAM:270-273). |
| `fixed:true` | bool | No texture animation (`layerMoves` false, GAL:363). Shown as "Surface". |
| `frames` | array of 8 paths | Texture-id animation (LineType 0), 3 cycles per loop per unit speed; speed 0 holds frame 0 (GAM:241-246). |
| `speed` | >=0 | Integer: that many whole UV passes per layer loop; fractional: next whole number of passes on a proportionally longer own clock (`passClock`, GAM:59-64). 0 = held. Translation LineType 1: `[0,0,0]->[turns,0,0]` (or `[0,turns,0]` for axis v). |
| `direction` | degrees | Rotates the UV lattice (`cos/sin`, GAM:210-211); atlas: excursion axis. |
| `tiling` | 1..4 UI | UV scale about .5 (GAM:210). |
| `uvOffset`,`uvMatrix` | | Extra shift / affine (UV Wrapper); `keepUV` retains hand-edited UVs (GAM:234-239). |
| `water:true` | bool | UVs = spatial projection (u across, v along, /(0.55*length)); Shading base?1:0; default tint [.65,.83,.99]; twoSided off (GAM:176-182,264; GAL:384,391). |
| `inflate` | model units (NOT a fraction) | Each vertex of the copy moved `inflate` along its normal (GAM:100-103). Bounds recomputed. `.3` = 0.3 units. |
| `steel:true` | | Colour mapped `.22+v*.31` (dim steel base), Shading 16 (GAM:288,264). |
| `crust:true` | | Colour mapped `.18+v*.22` (GAM:288). |
| `tint2` | colour | 2nd colour for colour rhythms; default `secondTint(tint)`: non-top channels /3 (GAL:355, GAM:52). |
| `unshaded`,`unfogged`,`twoSided` | bool | Shading bits 1, 32, 16 (GAM:114-119). `makeLayer` fills them for surfaces: unshaded = filter is 3/4; unfogged = Glow/glyph/additive; twoSided = not `water` (GAL:347,389-391). Default Shading otherwise `bodyUV\|\|steel ? 16 : 17` (GAM:264). |
| `nativeSurface` | Blizzard effect row from `SURFACE_EFFECTS` | Material imported from the native effect (Felwood poison, Cave_Lava, ...), `speed` = `effect.duration/loopMs * layer.speed`, `pulse` replaces its own alpha (GAM:292-319). |
| `powerArcs` | bool (+ `amount`, `burstGap` s, `burstWindow` s) | Skin alpha = N quick flashes (alpha 0->1->0 per arc, window `max(60,window*1000)` ms) and a V shift per arc, own clock `window+gap` (GAM:251-261,284). Filter default 3. |
| `repeats`,`glyphScale`,`glyphTurn`,`glyphSlide`,`glyphAcross` | | Rune layout (see Rune). |

**Glow** differs only by default pulse: a Glow without `pulse` uses `breathe` (GAM:248), never scrolls (`layerMoves`, GAL:363-367), and strength >1 adds ceil(strength) passes (additive after the first).
**Rune** (`glyphs:true`): compiled by `skinLayer` as a Glow with `axis:'v', band:.8, bodyUV:false` (GAM:887-889), but UVs come from `streakCoordinates(axis v, band .65)` with the V axis multiplied by repeats per island = `max(1,round(length/(2*radius)*.4))` or `repeats` (GAM:190-196); `atlasRect` margin 2%. Rune layout order: `glyphTransform` (scale 1/glyphScale about .5, rotate -glyphTurn, shift glyphAcross/Slide) then `uvMatrix` (GAM:150-155,214). Pulses `flicker` and `breathe` have glyph-specific curves (GAM:249). `stamp:'XXXn'` (ground seal) instead writes an EventObject (SPL-style decal) at ground (0,0,1.5) on the look clock (GAM:509-514).

### 2.3 Pulse names (alpha/colour over one layer loop, t=0..1)
`RHYTHM_IDS` (GAL:361). Curves are `curves` (GAM:27-38): LineType 3 (Bezier) for `soft`, 1 (linear) for all others (GAM:248). Alpha = curve*strength.
| pulse | Effect |
|---|---|
| (none) on skin | constant alpha = strength. Texture still scrolls unless `fixed`. |
| `steady` | constant alpha, **no texture movement** (`layerMoves` false). On Edge: constant ribbon alpha. |
| `soft` | alpha .78 -> 1 (t=.5) -> .78. |
| `breathe` | .38, .56@.22, 1@.53, .69@.78, .38. (Glow default.) |
| `steel` | .93 -> 1@.55 -> .93 (near constant). |
| `crystal` | .78, .93@.4, 1@.63, .78. |
| `flicker` | .72, .96, .67, .89, .73, 1@.64, .65, .72 (irregular). Edge non-steady always uses this (GAM:726). |
| `glint` | ~.08-.12 base with 1.0 spike @.29 and .65 spike @.82 (two sparkles). |
| `double` | .05 base, spikes 1@.20 and .87@.36 (heartbeat). |
| `lightning` | .34 base, spikes at .10,.19,.53,.82 (peaks 1,.94,.96,.91). |
| `fade` | 1 -> .24 (t=.4..0.57) -> 1. Also `layerMoves` false. |
| `beat` | **colour** rhythm: alpha constant; geoset colour tint -> tint2 -> tint (t=0,.5,1), Bezier (GAM:41,50-54). |
| `embers` | colour rhythm: tint, tint2 @.11, tint @.27, tint2*.41 @.45, tint @.58, tint2*.76 @.79, tint; linear (GAM:42). |
| `shift` | colour rhythm: hold tint to .2, tint2 .5-.7, back; linear (GAM:43). |
Card alpha uses the same curves (not colour rhythms) on the card's clock (GAM:786). Colour rhythm on a Card moves the geoset colour (GAM:800).

### 2.4 Card (`cardLayer`, GAM:735-801; fields/bounds FC:4-17,19-43)
Becomes **one new owned geoset** of flat quads, one bone per quad (`Flags 256`, +8 billboard when `facing:'camera'`), own material (filter `card.filter`, Shading from unshaded/twoSided/unfogged), own GeosetAnim. Quad half-width = `size` (model units).
| Field | Default / range | Effect |
|---|---|---|
| `image`, `team` | | texture; `team:2` = team glow. Wrapped only if flipbook. |
| `facing` | `'camera'` `'ground'` `'part'` | camera: +X-facing billboard; ground: flat in XY at (0,0,1.5)+offset, **one set, not per region**; part: lies along the part axis. |
| `count` | 1..8 | cards per region, spaced along 90% of each region's length. |
| `fit` | 1 | multiplies fitted `size`. `size` default = `cardSize` `max(unit*1.2, min(length*.18,girth*2.2))` (FC:53); ground `max(cardSize,length*.45,radius*1.6)` (FC:49). |
| `sizeMin`,`sizeMax` | .83 / 1.17 (.05..4) | bone Scaling pulse min<->max on each card's own clock (base*[1,1.133,1.2,1.3,1.433,...]); odd cards start large (GAM:756-760; FC:76). |
| `spin` | -16..16 turns per `loop` | bone Rotation about the quad normal; `spinEased` (default true) uses the native uneven flare angles. |
| `jitter` | 0..180 deg | child-bone random wobble on 100-157 ms clocks (GAM:769-774). |
| `rows`,`columns`,`frameMs`,`cell` | 1..16, 0..5000 ms, 0..255 | atlas cell picked per card; flipbook if rows*columns>1 and frameMs>0: TextureAnim steps one cell per `frameMs` (LineType 0) (GAM:789-793). |
| `strength` | 0..1 | 2 if <1 on filter 0/1. |
| `pulse` | any non-colour curve | alpha curve on the card clock. |

### 2.5 Edge (ribbon, `edgeLayer` GAM:711-730)
One RibbonEmitter per skin region at the region centre (+offset), parent = dominant bone. Material: 1 layer, `FilterMode l.filter??(orbit?3:4)`, Shading 17, texture unwrapped. Rotation aligns ribbon Y with the part axis. Fields: `HeightAbove=upper`, `HeightBelow=lower` (default length/2 each), `LifeSpan=lasts` (default **0.12 s**), `EmissionRate=smoothness` (32), `Alpha=strength` (steady/orbit) else flicker curve*strength, `Color=tint`, `Gravity=gravity`. Non-orbit: Translation sway +-0.18*girth sideways on the layer clock (GAM:721-723).
`orbit:true` (`withOrbit` GAL:231, `orbitChain` GAM:697): ribbon rides 3 helper bones: turn about the part axis (`orbitTurns` per loop, default 2), tilt +-35 deg on 0.739x that period, bob 0.3*radius on 0.479x. `orbitRadius` default `max(1,girth*2.5,length*.14)*fit`; ribbon height = `max(1,radius*.55)`; `lasts` clamped to `[.45,1.2]` from the turn time unless set; `strength` forced .7 unless the look sets it; `smoothness>=40` (GAL:420,231-234).

### 2.6 Other
* `Particles` -> section 3 (built-in kinds, `native`, `flies` swarm).
* Fly swarm (`kind:'flies'`, `amount` 5..30, `spriteSize`, `speed`): owned quad geoset, one billboard bone per fly on native Hermite paths (GAM:828-886, FC:59-86). Not particle emitters.
* `FLY`, `stamp`, `impact` are specialised; recipes rarely need them.

---
## 3. Particles

### 3.1 Built-in kinds (`particles()`, GAM:604-695; sizes from `layerBasis`, LB:4-15)
Let `unit=max(1,min(length*.23,max(length*.055,girth*.82)))` from the part's **longest skin region** (LB:8). Table `[emitters per region, amount/s total, lasts s, velocity, gravity, size]` (LB:10-14):
| kind | count | amount | lasts | velocity | gravity | size | notes |
|---|---|---|---|---|---|---|---|
| flame | 7 | 104 | .46 | unit*2.2 | -unit*9 (rises) | min(length*.19,unit*2.38) | Latitude 24; Alpha [230,254,0]; scaling [.94s,s,.23s]; colours [tint*.37+.63, tint, tint*[.98,.42,.08]] |
| embers | 4 | 46 | .72 | unit*3.6 | -unit*5 | unit*.40 | Latitude 34; Alpha [88,232,0]; scaling [.45s,s,.12s]; colours [tint,tint,tint*.75] |
| crackle | 3 | 4 | .40 | unit*6.2 | 0 | unit*2.25 | additive, Model Space; Variation .18 (.55 with `burstGap`); Latitude `spread??55`; Time .43; Alpha [255,250,0]; scaling [.48s,s,1.18s]; white->tint (GAM:669-674). `burstGap`,`burstWindow`: one turn per site per `period` on its own clock (GAM:662-668) |
| sparks | 4 | 58 | .38 | unit*6 | unit*.5 | unit*.45 | generic branch |
| mist | 5 | 22 | 1.18 | -unit*.52 | unit*2.5 | unit*1.72 | Latitude 48; Alpha [0,70,0]; scaling [.45s,s,1.38s]; colours all tint; UV frames life 0-12, decay 13-25 (assumes 8x8 sheet) (GAM:675). Size capped to `unitHeight*.35/1.38` when no `size` given (GAL:413) |
| drops | 4 | 7 | .69 | -unit*.5 | unit*7 (falls) | unit*.33 | PE2 FilterMode 0 (Blend); `amount` raised to `ceil(2*sites/lasts)` (GAL:405) |
| motes | 4 | 11 | 1.05 | unit*.7 | -unit*.35 | unit*.53 | emitters ride orbit bones; size x1.5, amount>=2*sites (GAL:414-418); Flags + Model Space |
| flies | 5 | 5 | .09 | 0 | 0 | see LB:12,20 | swarm (2.6) |
Common to flame/embers/sparks/mist/drops/motes (GAM:655-661): `Squirt false`, Flags `4096\|32768` (+524288 for mote/fly), FilterMode 1 (0 for drops/flies), `Rows=Columns=atlas`, `Speed=velocity`, `Gravity`, `LifeSpan=lasts`, `Width=size*.2`, `Length=size*.25`, `Variation .35`, `Time .36`, FrameFlags 1, Visibility keyed on the look clock. UV frames: life `[0,floor((atlas^2-1)*.4),1]`, decay `[that+1,atlas^2-1,1]` (GAM:675-676). `TextureID` wrap flags 0 (GAM:655).
Emission: per emitter `rate=amount/(count*regions)` (or `/(count*4)` when shared across >4 regions, `/planned.length` with a site layout). `steadyRate` (set by `makeLayer` for every new non-native, non-burst layer, GAL:403) = constant rate; otherwise a 9-key sinusoidal swell on the look clock (GAM:658).
Look-spec overrides on a built-in kind: `amount` (total per second, default table), `lasts`, `scale.size|velocity|gravity` (multipliers; a spec `size` is overwritten by table*scale.size except for flies, GAL:395), `scale.stages` (native.ParticleScaling), `tint`, `strength`, `atlas`, `count` (set via layer), `burstGap/burstWindow/spread`, `native:{...}` (below). `velocity`/`gravity`/`size` on a spec are **ignored** by `makeLayer` (recomputed from table*scale, GAL:395); use `scale`. So a native layer's own `size` is always `1*scale.size`.

### 3.2 `kind:'native'` (`spray`, TL:11): `nativeParticles` GAM:459-508 + `addParticles` VEC:125-148
Spec: `{type:'Particles',label,kind:'native',image,tint,nativeSpec:{texture,...},native?,starts?,loop?,...}`.
`radius = max(2, min(region.frame.length*.48, 55))` model units, computed **per skin region** (GAM:476); impact uses the contact radius. `speed`=layer `speed` (default 1), `density=amount/24*share` (default `amount`=24 -> 1; `share` = 1/numberOfAutoSites, siteRateScale/active, or region share, GAM:477-478).
| nativeSpec key | Default | PE2 field | Formula |
|---|---|---|---|
| `texture` | - | TextureID | model texture (wrap 0). `team:true` -> ReplaceableId 2 and tint [1,1,1] (VEC:127,133) |
| `filter` | 1 | FilterMode | PE2 enum (2.1) |
| `atlas` | none | Rows=Columns, LifeSpanUVAnim, DecayUVAnim | N; life `[0,floor((N^2-1)*.45),1]`, decay `[floor(..)+1,N^2-1,1]` (VEC:135-139) |
| `life` | required | LifeSpan | `life/speed` s |
| `rate` | 8 | EmissionRate | `rate*density*speed` per second (summed over emitters; each of S sites gets rate/S when auto-sited) |
| `area` | 0 | Width, Length | `area*radius` both |
| `width`,`length` | `area` | Width / Length | `*radius` |
| `velocity` | 0 | Speed | `velocity*radius*speed` ; also Variation = `.22` if velocity else 0 |
| `gravity` | 0 | Gravity | `gravity*radius*speed^2`; positive falls, negative rises |
| `spread` | 0 | Latitude | degrees, cone half-angle about emitter +Z (0 = straight along +Z; `Latitude` max 180) |
| `size` `[a,b,c]` | required | ParticleScaling | `size[i]*radius*layer.size` (start, middle, end) (VEC:131, GAM:504). Skipped if `native.ParticleScaling` exists |
| `alpha` `[a,b,c]` | [235,180,0] | Alpha (Uint8) | `round(alpha[i]*layer.strength)`; replaced wholesale by `native.Alpha` |
| `tail` | 0 | FrameFlags 3 (head+tail), TailLength | `tail/speed`  (fraction of life) |
| `burst`,`delay` | - | Squirt true, EmissionRate | key at `.185+delay` of the loop with `round(burst*density)` particles (VEC:141-145); `makeLayer` skips `surfaceFit` for burst specs |
| `orbit`,`phase` | - | Translation | circle radius `orbit*radius`, 17 keys, z wobble `.1*radius*sin(2a)`, one turn per look loop (VEC:117-124,146). Disables surface sites |
| `flat` | - | Flags `\|1048576` (XY Quad) | quads lie flat in XY. Disables surface sites; `sharedSites` collapses regions to the longest region (GAM:445) |
| `height` | 0 | pivot z | `+radius*height` (no `surfaceFit` when set) (GAM:497) |
| `fromWhite` | - | SegmentColor | `[white,tint,tint]` else `[tint*1.17+.025, tint, tint*.56]` (VEC:134) |
| `team` | - | texture | team glow |
Fixed fields written by `addParticles`: `Time .43`, `Squirt false`, `Flags 4096\|32768` ("Unshaded" only: **fogged**, not model space) (VEC:128-132), FrameFlags 1.
`ground:true` (layer) = `parent:null`, pivot (0,0,1.5) world, `enabled:false` by default in card imports (GAL:116) ; no part tracking.

**`native:{...}` raw overrides** (applied last, GAM:503 for native, 691 for built-in; typed by `nativeValue` GAM:556-565). Keys (EMITTER_DEPTH GAM:553 plus the rest of INDIVIDUAL_NATIVE_FIELDS GAM:928): `Alpha` `[0..255 x3]`; `SegmentColor` `[[r,g,b] x3]` 0..1; `ParticleScaling` `[x3]` **absolute model units** (no radius, no cap); `Time` 0..1 (where the "middle" stage sits in life); `Variation` 0..1 (speed variation); `Latitude` deg; `Width`,`Length`; `Speed`,`Gravity`,`LifeSpan`,`EmissionRate` (absolute, bypass radius/density); `FilterMode`; `Rows`,`Columns`; `LifeSpanUVAnim`,`DecayUVAnim`,`TailUVAnim`,`TailDecayUVAnim` `[first,last,repeat]`; `FrameFlags` (1 head, 2 tail, 3 both); `TailLength`; `Squirt`; `Flags`; `Rotation` (quaternion or `{Keys}` track); any `{Keys,GlobalSeqId,_FxGlobalDuration}` track becomes an animated field on a (created) global sequence (GAM:557-562).
`Flags` bits (src/particle-editing.js:7, node-type bit 4096 from createNode editor-document.js:37): `4096` emitter node (always include), `32768` Unshaded, `65536` Sort Far Z, `131072` Line Emitter, `262144` Unfogged, `524288` **Model Space** (particles simulate in the emitter's frame: "Carry", stay on the moving part instead of staying in the world), `1048576` XY Quad. Constants TL:18: `EMITTER_UNFOGGED=4096\|32768\|262144`, `EMITTER_CARRIED=UNFOGGED\|524288`. `native.Flags` **replaces** the whole field (including the XY-quad bit `flat` set).
Presets: `FLAME_NATIVE` (TL:20) Alpha [255,255,0], Time .5, life frames 0-40, decay 41-63 (8x8 sheet), UNFOGGED. `EMBER_NATIVE` (TL:22) Alpha [200,150,80], UNFOGGED. `DRIP` (TL:24) `{amount:12,lasts:1.1,scale:{size:2.8,gravity:1.3},native:{Alpha:[255,245,0],FrameFlags:3,TailLength:.08,Time:.5}}`.
Other per-layer keys on a native spec: `amount` (density numerator /24), `speed`, `strength`, `loop` (own clock for the burst/orbit tracks), `lasts` unused (life comes from nativeSpec), `scale.size` (becomes the layer `size` multiplier, default 1).

### 3.3 Placement (where emitters sit)
`makeLayer` flags (GAL:402-427):
* `sharedSites` for every new native non-impact layer.
* `surfaceSites:true` for every new non-impact, non-ground Particles layer **except** `flat`/`orbit` native specs and kinds crackle/motes/flies. => `surfaceFit` (footprint, liveParticles) is frozen from `surfaceFitInputs` (ES:12-24) unless `burstGap`, `burst`, `height` or `native.Squirt` is set.
* `birthRegion:true` (spec) deletes `surfaceFit` and sets `surfaceSites:false` (GAL:425).
* `airyFit:{version:1}` / `fireFit:1`: see below. `focusedEmitter:true` (ES:22).

`defaultSurfaceSites` (GAM:325-338) runs at compile, once per part revision:
1. `birthRegion` -> `birthRegionSites` (below).
2. else `surfaceFit` -> `suggestEmitterSites(analyseEmitterSurface(part), fit)` (ES:216-239). `footprint=max(1, largest visible-stage size)` where size = `nativeSpec.size[i]*radius*layer.size` for stages whose alpha>0 (ES:13-18); `liveParticles=rate*amount/24*life`; **site limit = clamp(floor(liveParticles/4),1,16)**; `focusedEmitter` forces footprint `max(1,length*.1)` and liveParticles 4 => **exactly 1 site**.
3. Neither -> legacy path: one emitter per skin region at `region.frame.surfaceAt(0, clearance)` (native) or `count` emitters per region spread along `upper/lower` (built-in) (GAM:626-629).

Site shapes (ES):
* **Strips**: connected pieces with `frame.length >= 5.2*radius90` (90th percentile radial distance) and area >=4% of the part; used if strips are >=65% of the part's area (ES:223-237). Sites at stations spread over 90% of each strip's length, desired count `round(length/footprint)`, on the triangle cross-section most exposed to world +Z (axis near-vertical (|z|>=.9) uses +X instead) and pushed out along its normal by `max(.04,min(footprint*.1,radius*.18))`. Each site carries `fit:{strip:true}`.
* **Rim sites** (everything else, e.g. curved weapons, bodies): candidates scored by rim distance, outward normal and upper silhouette; spacing `max(1,footprint*.88,span*.12)`; count `round(coverage/spacing)` capped by the limit; a "body" (`span.z>=.43*unitHeight` and tall) takes >=2 and prefers one shoulder-height site per side (ES:166-213).
* `siteCount`/Emitters slider adds/removes slots (`suggestAdditionalEmitterSites` ES:243, max 64).

Rate share: auto sites split the layer rate equally: each emitter gets `1/sites` of the density (GAM:477). Hence **more sites at the same `amount` = same total particles, not more**. `Formation`, `formationWidth/Depth` apply only after the user edits placement (`layer.placement` truthy, EP:19-29); a recipe cannot get them by setting `formation` alone.

Gathered sources (`gather`, fresh layers; every gathered layer of a look shares the same sites, checked first in `defaultSurfaceSites`):
* `gather:'tip'`: one site at the far end of the longest strip (`suggestTipEmitterSites`).
* `gather:'head'`: 2 sites (flat) or 4 (round) around the part's head, the widest mass of its far half, or the top of a body (`suggestHeadEmitterSites`, `headEmitterSites`). `componentWidth` is the head's half-width, kept between 10% and 20% of the part's length.
* `gather:'strike'` / `'strike-head'` (Fireball in test build 03; kept so layers saved with it compile as before): a straight blade (`suggestBladeEmitterSites`: wide slices over at least half the part, at least 1.6 widths long, centre line straight) gets three patches off each face at 74%, 50% and 27% of the blade, sprite widths 1.1 / .78 / .52 of its half-width and rate shares 1.5 / .95 / .55, so the source is largest near the tip. `'strike-head'` keeps only the pair near the tip. The patches carry a birth rectangle and its rotation (launch away from the face), so `aim:'outward'` applies only where there is no blade: any other part falls back to the `'head'` sites.
* `gather:'engulf'` / `'engulf-core'` (Fireball): a flat straight blade (the `'strike'` blade whose cross-section is under half as thick as wide) keeps the `'strike'` patches. Any other part gets the fire seated in its own mass (`suggestMassEmitterSites`, `massEmitterSites`): one site in the middle of a compact piece, a chain of sites down the middle of a claw or horn (at most 8, each with a birth line along the piece), one site off each face of a flat piece, one site in a body's head (more than 4 skin regions; skin bound to head bones by `nameRegion`, else the top 30%). A part of separate pieces uses its bulkiest touching group; a piece that would need more than 8 sites burns at its top. `componentWidth` is 1.1 x the radius of the mass at the site, so `widthCap:1.35` draws the fire about 1.5 x that radius. `'engulf-core'` keeps only the main site (the blade's tip pair).
* `cover:'surface'|'around'` and `coverFit`: continuous cover instead of dots (`coverSites`); see the task note's polish pass.

| Part | What default placement does |
|---|---|
| (a) straight sword (one strip) | strip sites along the blade on its upper (+Z) face (or +X face if vertical); N = clamp(floor(live/4),1,16) bounded by `round(length/footprint)`; each pushed slightly off the surface. Built-in flames: site positions get an extra rate scatter +-6% (`airyFit`) and strip-fit velocity/gravity (below). |
| (b) curved weapon / hook | fails the 5.2*radius rule or <65% strip area => rim sites around the silhouette top, spacing from footprint; may cluster at the curve apex. `birthRegion` curved pieces use the same sampler with a tiny emit area. |
| (c) body with many skin regions | regions come from identical bone-weight groups >=3 vertices (GAL:319-332). `radius`/`size` use the longest region (LB:6-8); rim sites prefer shoulders. Legacy path (no surface sites): built-in kinds share `count*4` sites by region length when regions>4 (`emissionShares`, GAM:596-603); ground/flat natives collapse to one emitter at the longest region. Card `ground` facing: one set at the feet. |

`birthRegion:true` (`birthRegionSites`, GAM:341-364): per region/physical component. If one bone weight and `length>=5.2*radius` ("straight"): ONE emitter at the component centre (**inside** the blade), `Width=max(.05,radius*.7)`, `Length=frame.length*.45` (absolute units, native "half extents": covers ~90% of the length), and a `Rotation` track = shortest rotation of local Y onto the part axis. Otherwise (curves, blended regions): surface-anchored point sites (`Width=Length=.05`), `liveParticles:16`. nativeSpec `width/length/area` are **overridden** by these (GAM:480). Extra emitters on a long straight piece share it by splitting the rectangle (GAM:402-407).
`airyFit:{version:1}` / `fireFit:1` (`airyFit` in native: rate x`1+.06*(i%5-2)` and `ParticleScaling` peak capped to `site.fireFit.radius*.75` (GAM:481,504); built-in: also strip sites replace velocity with `loft=clamp(24..64, footprint*2.6)`, gravity with `loft/.38`, Alpha with [84,106,0] (flame) and the lighter colour ramp, sprite size capped to `.75*componentRadius`; user edits (`velocityEdited`) disable (GAM:616-661)). `fireFit:1` only sets `layer.fireFit`; both are read as one flag in `particles()`.

**Direction.** PE2 launch direction is the emitter's local **+Z** (Latitude = cone half-angle around it), Width = local X extent, Length = local Y extent. The compile never aims emitters: no Rotation unless `birthRegion` (Y->axis) or the user aims one (EP:77). The emitter's parent is the dominant skin bone of the site's region (or a created "Skin attachment" bone for blended regions, GAM:517-551), so +Z is **that bone's +Z, not the blade axis**. Whether that is "up the blade" depends on the rig; on a hand-held sword it usually is not. With `birthRegion`, local Y points along the blade, so launch (+Z) is perpendicular to the blade, in the bone's frame. `ground` emitters have `Parent:null` => world +Z. Gravity pulls world -Z (Model Space particles: in the emitter frame).

---
## 4. Rendering traps visible in the code
1. **Two filter enums** (2.1). `filter:1` on a skin = alpha-key cut-out; `filter:1` on a native spray = Additive.
2. **Blend (0) needs texture alpha.** Textures without alpha (LavaLump, GenericGlowX, Flare, Star7b are used additively in TL; `Clouds8x8Black`, WaterBlobs1, BloodBlobs1, Ghost1 with `filter:0` rely on their alpha). A no-alpha texture with `filter:0` is opaque squares; with Additive black becomes invisible. Skins with `filter:2` on a texture that has no alpha show as solid.
3. **Alpha 255 + Additive blows out**: `FLAME_NATIVE` Alpha [255,255,0] x7 emitters x overlap saturates to white; the built-in kinds peak at 230-254 and get their saturation from the colour ramp. Keep middle alpha <=~150 for many stacked additive emitters, or scale `strength`.
4. **Fogged by default**: native sprays have Flags `4096\|32768` (unfogged bit 262144 missing) (VEC:128). Add `native:{Flags:EMITTER_UNFOGGED}` for glows. `native.Flags` replaces the whole field, so it must repeat `4096\|32768` and the `1048576` bit for `flat`.
5. **Model Space (524288)** makes particles follow the part and ignore world gravity/velocity space; without it, sprites left in the air by a swinging sword. Mixed up in `glowOrb` (carried) vs flames (not carried).
6. **Atlas mismatch**: `FLAME_NATIVE` hard-codes frames 0-40 / 41-63 for an 8x8 sheet (TL:20); `fireHair` overrides to 4x4 `[0,7]/[8,15]` (TL:34). `atlas:N` computes frames from N^2. mist hard-codes frames 0-25 (assumes 8x8) (GAM:675) and flies assume a 12x16 sheet unless `pictureOverride` (GAM:655). A non-square sheet, or wrong `atlas`, shows blank/clamped cells.
7. **Wrap flags**: particle and `atlasRect` textures are loaded with Flags 0 (clamped); skins without `atlasRect` get Flags 3 (repeat) (GAM:240). A repeat texture used both ways shares one entry only if flags match (GAM:73).
8. **`native.Alpha` beats `strength`**: native keys are applied after `strength` (GAM:503,691). `frost()`'s `native:{Alpha:[0,42,0]}` is not scaled by Intensity until the UI rewrites it (`withParticleStrength` GAL:243).
9. **Gravity sign and scale**: positive gravity falls; native gravity = `gravity*radius*speed^2` (so `speed` 2 = 4x pull); built-in flame `-unit*9` rises.
10. **`ParticleScaling` from `native` is absolute**, whereas `nativeSpec.size` is x radius (up to 55) x `layer.size`; mixing them gives 50x jumps. A `Width/Length` spec on `birthRegion` layers is overwritten.
11. **Built-in `velocity`/`gravity`/`size` in a spec are discarded** (GAL:395); use `scale` or `native.Speed/Gravity/ParticleScaling`.
12. **`loop` ignored on built-in kinds**; `lasts` ignored on native (use `nativeSpec.life`).
13. **Emission total is constant**: auto-sites divide the rate; a spec tuned on one site thins out as the part gets more sites. `focusedEmitter` pins 1 site.
14. **Strength >1** only works for Glow (extra additive passes); on Moving skin it is clamped to 1 (GAM:127-129).
15. **`inflate`** is in model units: `.3` on a part 10 units across is a thick shell; on 100 units it barely clears z-fighting. Shell geosets duplicate the mesh (cost x layers).
16. **Edge `lasts` default .12 s** and `smoothness` 32: a ribbon on a still blade has almost no length (hence the sway, GAM:721).
17. **Particles with `enabled:false` but no `starts`** never reach the stack (so `fire('Fire',{enabled:false})` is menu-only).
18. **Ground cards/emitters** are placed at the world origin (0,0,1.5) with no parent: they will not follow a moving unit's bone, only the unit's origin if it translates in Z=0.

---
## 5. cbc17f49 versus 7e9660b2

Global differences (all affect every listed look):
* `makeLayer` now sets `surfaceSites` on every built-in/native emitter and freezes `surfaceFit` (GAL:402-424) => emitters sit on the surface at `suggestEmitterSites` points. At cbc: built-in kinds `frame.surfaceAt(along)` with no clearance and `count` emitters per region spread along `upper/lower`; native: one emitter per region at `surfaceAt(0)` (cbc GAM:445,341; cbc GAM:431-458). Drops no longer sink `girth*.35` when surface-sited (GAM:644).
* `steadyRate` on every new built-in emitter (constant rate rather than the 9-key swell) (GAL:403 / GAM:658).
* `withElementTechniques` appends `technique-*` variations to every look with an `element` (GAL:127). None existed at cbc.
* `Ice_IceDull` -> `Ice_Icedull` is case only.
* Layer ownership: new `recipeOwner`/`recipeRole` stored on every layer (GAL:431).

| Look | cbc17f49 | 7e9660b2 | Net change in the model |
|---|---|---|---|
| **Fire** (`flaming-sword`) | cbc GAL:43. Single variation-less look: skin "Hot core" (ember-edge, .58, flicker); `fire('Blade flames',starts)`; `embers()` = kind embers, **Star4** texture, table sizes (cbc GAL:23); `FIRE_FLAME_CARDS` disabled. | GAL:46-50: variations `surface-flames` (same 4 layers, flames get `airyFit:{version:1}`), `enveloping-flames`, `fireball`; + `technique-moving` auto-added (GAL:127). `embers()` GAL:24: **LavaLump**, tint [1,.35,.12], amount 12, lasts 2.5, `scale{size .5,velocity .1,gravity .02,stages[1.6,1,.4]}`, native EMBER_NATIVE (Alpha [200,150,80], UNFOGGED) + Time .5 + SegmentColor [[1,.7,.25],[1,.35,.12],[.45,.07,.01]]. | Flames now on strip surface sites with loft velocity/gravity and alpha [84,106,0] (airyFit, GAM:650-661) instead of 7 emitters/region along the blade at table values. Embers: slow, large (1.6x), 2.5 s, unfogged, fixed 3-colour ramp vs fast Star4 sparks. Two new variations. |
| **Fel blade** (`claude-fel-blade`) | cbc CL:32-34: skin "Fel fire" (Flame4, axis v, band .8, flicker, .95); flames tint fel starts; FEL_FLAME_CARDS. No `element`. | CL:32-34: same layers; flames get `airyFit:{version:1}`; `element:'fel'` => variations `original` + technique airy/compact/enveloping/moving. | Same skin; flames re-sited as for Fire; 4 extra technique variations. |
| **Frost blade** | cbc GAL:44-48: variations ice/steel/dark; `frost()` = mist, tint [.96,.98,1], table size/velocity/gravity, Alpha [0,70,0]. | GAL:51-55 + `element:'frost'`. `frost()` GAL:20: tint [.8,.9,1], `scale{size .65,velocity .25,gravity .25}`, `native:{Alpha:[0,42,0]}`. Steel variation "Cold sheen" gets `fixed:true`. | Mist: 35% smaller, 4x slower, 4x less gravity, peak alpha 42 vs 70 (x strength ignored), bluer. "Cold sheen" no longer scrolls. Adds 4 technique variations. |
| **Lightning blade** | cbc GAL:49: "Forked arcs" `Textures\Lightning4b.blp`, pulse `lightning`, strength .92; powerArcs same texture. | GAL:56: texture `Doodads\Cinematic\Lightningbolt\Lightning4b.blp`, pulse `soft`, **strength .64**; powerArcs texture the same new path; `element:'lightning'` (noWrap): technique airy/compact/moving added. | Different source texture; arcs no longer flash on the lightning curve but swell softly at 64% brightness. `LAYER_CHOICES` "Forked arcs" also moved to the new path (GAL:183). |
| **Arcane blade** | cbc GAL:51-56: one layer list (Enchanted steel, Flowing/Crossing energy, Arcane star card, `starts(orbSpray())`, disabled Narrow highlight). | GAL:58-66: `vary` with `arcane` (identical layers) + `shimmer` (`SHIMMERING_ENERGY` = `elementTechnique('arcane','moving')`); `element:'arcane'` adds airy/compact/enveloping. | Layers identical. Glow orbs (native, `GenericGlowX`, CARRIED) now on surface sites (focused none) instead of one per region. 4 extra variations. |
| **Tidal blade** | cbc CL:35-38: Running water (frames, water, axis v, .85), Wet sheen (Ice3b soft .45 loop 1733), Dripping water (drops, DRIP, starts). Variations running/currents (cbc GAL:111-114). | CL:35-38: same specs; `element:'water'` (GAL variations kept) => 4 technique variations appended after running/currents. | Drops: `amount=max(amount,ceil(2*sites/lasts))` and surface sites replace the "z-=girth*.35, spread along blade" placement (GAL:405, GAM:644). |
| **Magma flow** | cbc CL:39-41: "Cooled rock" base stone + "Lava flow" **Flame4**, bodyUV, direction 90, speed (default) 1, tint lava; `asOverlay`. | CL:39-41: "Lava flow" **TerrainArt\Dungeon\Cave_Lava.blp**, `speed:.2`; plus `elementTechnique('lava','moving')` particles (a `Surface particles` LavaLump spray, `birthRegion`, `starts`, loop 1733); `element:'lava'`. | Slow lava texture (5x slower) instead of a flame texture, plus spitting lava specks along each straight piece (TL:46,66). 4 technique variations. |
| **Poison skin** | cbc GAL:64: base skin "Poison surface" = `nativeSurface` Felwood poison (strength .9, `base:true`); `dust('Heavy drops','drops',WaterBlobs1,DRIP)` (not started). | GAL:74: `elementTechnique('poison','moving')` + airy role of `'poison','airy'`: **no `base`** (overlay); "Moving surface" `Felwood_Poison.blp` bodyUV filter 2 speed .25 strength .65 tint [.45,.64,.16] loop 2600; "Surface particles" Bubble birthRegion (rate 7, life 1.2, gravity -.2, velocity .06, alpha x.4); "Airy particles" CloudSingle (rate 12, life 1.1, gravity -.08, airyFit, alpha [23,26,0]); `element:'poison'`. | Poison no longer replaces the part's texture; it is a green overlay + bubbles + haze, no drops. 4 technique variations. |
| **Molten lava** (`lava`) | cbc GAL:85-109: one skin "Molten lava" = `nativeSurface` Cave_Lava, atlas [0,0,.25,.25], duration 3100, opacity .75 strength .75, overlayFilter 2. | GAL:96-120: same skin plus `speed:.2` (GAL:106); plus `elementTechnique('lava','moving')` Particles (starts) (GAL:109); `element:'lava'`. | Texture drift 5x slower and lava specks added; 4 technique variations. |
| **Fissures** (`fissures`, "Fissures skin") | cbc: skin "Lava fissures" `nativeSurface` Cave_LavaCracks (atlas [.625,.25,.125,.25], filter 2, duration 2400, pulse .42) + `fire('Fire',enabled:false)` (menu-only). | Same skin + `speed:.2`; `Fire` unchanged (menu-only, GAL:108); lava moving particles added (GAL:109); `element:'lava'`. | Crack pulse slowed (speed .2) and speck particles added; 4 technique variations. |

---
## 6. Codex's unified particle controls (7e9660b2)

`app/GlobalAnimationControls.jsx:194-216` now gives every Particles layer (built-in, native, swarm) the same panel: a `LifeTable` (SegmentColor/Alpha/ParticleScaling per stage), sliders for EmissionRate, LifeSpan, ParticleScaling, Speed, Gravity and, under More, Width, Length, Latitude, Variation, `burstWindow`/`burstGap` (layer fields), the middle-stage `Time` marker, Blend (`FilterMode`), Carry (Model-Space flag), Draw-as, `TailLength`, the frame strip (`Rows/Columns/*UVAnim/TextureID`) and Squirt modes, plus **Emitters** (`siteCount`) and **Formation** (`formation`, or swarm `size`). All emitter-field edits are written to `layer.native[field]` (single site) or to per-site `individuals[key].values.native[field]` with `groupFields` (group edit, `nativeFinish`), so after any edit the layer carries raw `native` keys indistinguishable from a recipe-authored `native:{...}`; compile re-applies them last (GAM:503,691) and `readAnimationStack` reads EMTR edits back into `layer.native` (GAM:985-996). Consequence for a recipe designer: put intent in `nativeSpec`/`scale` and use `native` only for fields the table above says have no spec equivalent; hand-set `native` values pin the field against Intensity, Size and Speed sliders (compare 4, item 8).
