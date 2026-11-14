# FX: effect redesign after the trial 06 rejection

Status: pass 7 saved locally (14 November): the whole library reworked folder by folder, `00e0fc49` to the commit that adds this note. Builds; compiled in Node on the owner's model and checked against the library's own rules and against the starting revision, not rendered, not opened in the app; of the unit tests only `test/fx-legacy-snapshot.test.js` was run (passes). The owner reviews test build 07 by eye. Local branch only.
Branch / checkout: `claude/fx-effects` in `D:\Claude\MDLxL\.claude\worktrees\fx-effects`, started from Codex's `7e9660b2` (`codex/fx-emitters`) to keep its control work.
Owner / consolidator: Claude (orchestrates; Fable designs the effects; cheaper agents code and capture).
Background: [emitter placement work order](fx-emitter-placement.md), [FX contract](../FX-GLOBAL-ANIMATIONS.md). Codex's failure report: `D:\Codex\fx-emitters\out\placement\trial-06-failure-handoff.zip`.

## The owner's words (12 November 2026)

> my thing is - i gave many models with great global effects and emitters - a lot were copied, great - but instead of using astra reasoning to create new ones - for example using the morag overlords fireball-style fire emitter/globals to make variations of ice, of lightning - to use the way the emitters look and feel to improve... he just added one more copy

> also not everything was made well - e.g enveloping flames is not translating well

> the same controls among all selections. it shouldnt feel different to adjust one from the other. all of these are still presets - they should be fully customizable.

> Astra failed making good effects ... Go ahead, set up your agents and do the real work. you can use high reasoning since i need this to be perfect. You can use fable to design the actual effects but please dont use fable to code everything, just for the designs.

Trial 06 (`7e9660b2`) rejected: "everything looks trash", "a serious regression in the quality of the effects", "you did not even examine if it renders correctly". Screenshots: opaque white squares on Frost, central blobs for Fire/Fel/Lightning compact cores, weak Lightning airy.

## What went wrong (findings)

- Codex turned four reference models into one generic template per technique (`elementTechnique` in `src/fx-technique-looks.js`) and filled it with element colours and textures. Several of those textures are tiling surface textures, not sprites (`Ice3b`, `Ice_Icedull`, `Flare` used as particles), so they draw as solid squares.
- "Compact core" placed one emitter mid-blade. The Moarg reference is a hand fire; a single central orb is not how that lesson applies to a blade.
- Nobody looked at a rendered frame before the owner did.
- Codex's element tags also changed looks the owner had liked (Magma flow's lava texture and new lava particles, Poison skin rebuilt from the generator, lava particles added to Molten lava and Fissures).

## Plan

1. Workbench: hidden capture tool (`out\fx-look\`), baseline captures of every relevant look and variation, reference models captured playing.
2. Research: which native textures Blizzard uses as particle sprites, and how (`out\native-particles\`); recipe format reference (`out\fx-design\RECIPE-REFERENCE.md`).
3. Design (Fable): per element, hand-designed variations that apply the reference lessons where they look good, with exact recipe values and placement, judged from captures.
4. Code (cheaper agents): implement the design; keep the unified controls; restore liked looks Codex changed unless the design improves them.
5. Look at every result in captures; iterate until each variation is good on a straight sword, a curved weapon and a body.
6. Focused tests, build, package to `TestBuilds\fx-effects`, named test model, hidden click check, hand to owner.

## Progress (12 November 2026)

- Design: [fx-effect-design.md](fx-effect-design.md) (Fable). Codex built it from [the work order](fx-effect-build-codex.md): commits `99c2fe76`..`72ae4bbc` (merged fast-forward). Codex's report: 83 source-test failures already present at the starting revision; not caused by this work.
- Claude tuned from renders (`09cd6252`): `widthCapStrip` (separate width cap on straight strips, model `widthCapFor`), Enveloping flames with Heat shade started and a softer ramp, fainter violet Arcane swirl, larger Fel sparks, Tip discharge, Sparkling facets and Sea spray.
- Render workbench: `out\fx-look\run.ps1 -Plan <plan.json> -Out <folder> [-Exe <MDLxL.exe>]` (hidden desktop). Round plans `out\fx-look\round1..3-plan.json`; captures under `out\fx-look\round1..3`.
- Seen and accepted in renders: every variation on Great Unclean Dude geosets 10 and 11 (wide blades).
- Open: on a large many-region body (Great Unclean Dude G6) particle layers are small next to the coloured skin from the default top-down view. The Tzeentch thin-sword test was contaminated by that model's own saved FX flames; a clean thin sword is still untested. Rendered here only; Warcraft III itself not checked.

## Polish pass after the owner's hand test (12 November 2026, evening)

Owner: Fireball unclear and badly adapted from the Moarg mace; emitters "spread out poorly" (Ice shards, Crackling arcs, body sites). Pause works for the owner; no Pause change was made.

Done in `d00ca4f3` (compiles; **not run, rendered or tested**: the owner reviews by eye):

- **`gather:'head'`** (`suggestHeadEmitterSites` in `src/fx-emitter-surface.js`, `headEmitterSites` in `src/global-animation-model.js`). Every gathered layer of a look shares 2 sites (flat blade: one off each face) or 4 sites (round head) around the part's head: the widest mass of the far half from the parent bone (outer part of a blade, a mace or axe head), or the top 30% of a body with more than 4 skin regions. `componentWidth` = head half-width, kept between 10% and 20% of the part's length, so `widthCap` reads in head widths.
- **Fireball** = the Moarg five on that source: Fire core (cap 1.5 head widths), Core glow (2.6), Spat embers (.16), Falling sparks (1), Heat shade (1.7). Proportions follow the reference's 40 : 70 : 4 : 40.
- **Fel surge** = the same compact source in fel (cores 1.4, streaks .5, glow 2.4).
- **`cover:'surface'|'around'`** (`coverSites` in the model). Fresh layers only. Straight rigid piece: birth lines along the whole length; `surface` puts one line just outside each face (4 sides on a round piece) launching away from it, `around` is the earlier single slab. Any other piece: at most 16 surface patches shared by area, each patch reaching its neighbours. Rate follows covered area (`birth.share`). `birthRegion:true` recipes now get `cover:'around'` on fresh layers.
- **No separate dots by default**: a fresh native emitter whose default sites cannot reach each other (`separateSites`, nearest pair farther than 2.5 x sprite plus birth area) is covered instead (`coverFit`). The Emitters slider and saved layers are untouched.
- Recipes moved from fixed `siteCount` dots to cover: Ice shards, Crackling arcs, Arcane Glow orbs, Bubbles (Dripping venom, Toxic fumes), Spitting lava, Sea spray, Sparkling facets, Burning cracks embers. Rates raised because births now spread over the whole part and both faces.

What the owner should look at (look > variation > expected):

- Fire > Fireball on the sword, a mace/axe and the body: one dense ball of fire around the blade's outer part / weapon head / top of the body, red outside and yellow inside, slow embers drifting out, sparks falling.
- Fel fire > Fel surge: the same ball in green with streaks.
- Frost > Ice shards: crystals and glints blooming anywhere over the blade, flakes falling from its whole length; no row of blobs.
- Lightning > Crackling arcs: bursts and sparks at random places along the blade.
- Fire > Burning cracks on the body: embers from the whole body, not two spots.
- Arcane (first), Molten lava > Spitting lava, Water > Sea spray, Lit crystal > Sparkling facets, Poison > Dripping venom / Toxic fumes: no fixed dots.

Next steps for whoever continues:

1. Run the build once and open each look above; a runtime error in `coverSites` or `headEmitterSites` would show as the effect not applying (nothing was executed here).
2. Unit tests that assert the old `siteCount` sites or `gather:'tip'` for Fireball need their expectations updated (`test/fx-*.test.js`); `test/fx-legacy-snapshot.test.js` must stay untouched and green.
3. Document `gather:'head'`, `cover` and `coverFit` in [the recipe reference](fx-effect-recipe-reference.md) section 3.3.
4. Not reviewed yet in this pass: Tip discharge (still `gather:'tip'`), body sizes of the head source, and whether hugging sprites clear the faces (raise the clearance in `coverSites` if they are half hidden).

## Refinement pass 3 (13 November 2026, Fable)

Owner after the hand test: "Its perfect. Everything looks great - Only Fireball kinda sucks so far but I tried it on swords." Then: improve Fireball, improve the overall controls. Later the same day: improvements only, no change to the recipes, placement or defaults of any look except Fireball, and no control change that alters how an existing look compiles.

The render of the head version on the owner's sword showed why: two grey Heat shade lumps larger than the fire, a pink additive halo, and a weak core, as two lobes three quarters along the blade.

### Progress

Done:

- **Fireball on swords** (`ba0a2b92`, builds; not rendered). New `gather:'strike'` / `'strike-head'` (`suggestBladeEmitterSites` in `src/fx-emitter-surface.js`, `strikeEmitterSites` in `src/global-animation-model.js`): a straight blade gets three patches off each face along its outer part, largest near the tip and thinning toward the hilt; a mace or axe head, a curved blade and a body keep the `'head'` source. `'head'` itself and Fel surge are untouched. Recipe: blended **Fire body** drawn first (red-orange on any ground, `PriorityPlane:-1`), smaller yellower additive **Fire core**, warmer fainter **Core glow** and **Spat embers** at the tip pair only, **Falling sparks** along the whole source. The modulate Heat shade is gone from Fireball. Checked only by running `suggestBladeEmitterSites` on a synthetic sword, mace and low-poly blade.

- **Controls, structure** (`62fcfe07`, UI only, no compile path touched). The selected layer or single emitter is named above its controls (`h4.fx-selected`). Add emitter and Add layer share one row; Change texture, Reset layer and Remove layer sit under the selected layer's name; the emitter menu is a labelled field, Emitter. A single emitter has All emitters (back to the whole layer) next to Snap to surface and Delete emitter. Position & size, Rotate and Emitter markers render right above More in every kind of layer (`moreAt` / `placement`), so opening More never pushes them away. Button names and aria-labels are unchanged (the electron tests find controls by them).
- **Controls, tooltips** (`62fcfe07`). `SLIDER_TIPS` gives Lasts, Size, Speed, Rise / Fall, Spawn width, Spawn length, Spread, Speed variety and Streak length a plain tooltip on the label and on both boxes (passed to `ParticleSlider` as `units`, FX only; EMTR is unchanged). Tooltips also on Variation, Emitter markers and Individual edits. All strings are in the five catalogues.
- **Reset layer** (`b8cf5387`). Rebuilds the selected layer with `makeLayer` from its own variation's recipe (else `layerIngredient`) on the same part; keeps id, on/off and recipe owner. Disabled for impact stacks and layers without a recipe. It goes through `changeStack`, so a layer with individually edited emitters asks Keep individual / Apply to all like any whole-layer edit.

Next (ideas not started; each must leave every look compiling exactly as now):

- Disabled-in-place tooltips: done in `2ca24153` for Burst duration, Time between bursts, Emitters and Formation; Rise on Death still has none.
- The dialog's top bar and preview toolbar (`app/SurfaceEffects.jsx`) were not reviewed in this pass.
- Unit tests that assert the old Fireball layers (`gather:'head'`, Heat shade) need new expectations; `test/fx-legacy-snapshot.test.js` stays untouched.

Exact next step: open the test build, Fire > Variation > Fireball on a sword, a mace and a body; then click through the regrouped controls (select a layer, Reset layer, Add emitter, pick one emitter marker, All emitters).

What the owner should look at for Fireball (Fire > Variation > Fireball):

- On a sword: a dense red-orange ball around the outer part of the blade with a yellow centre, the fire thinning along the blade toward the hilt, embers drifting out of the ball and sparks falling along it. No grey smoke lumps, no pink halo.
- On a mace or axe head and on a body: one ball around the head / top, same colours.

What the owner should look at in the controls:

- The name of the layer being edited now sits above its controls, with Change texture, Reset layer and Remove layer under it.
- Add emitter and Add layer are side by side under the layer list.
- Reset layer puts one layer back to how the look made it.
- Click an emitter marker: the heading shows its number, and All emitters goes back to the whole layer.
- Open More: Position & size stays above it.
- Hover any particle slider or its label for a short explanation.

## Pass 4: Fireball on condensed shapes (13 November 2026, Fable)

Owner on test build 03: "Good on sword, bad at other places. Start with the overlord - the mace itself - the way it uses that shape is a great way to use shapes that are more condensed." Bad cases: one small ball in the hollow of the claw (dialog geoset 17, index 16), four separate balls around the body (dialog geoset 6, index 5).

### What the Moarg mace does (measured from `MoargOverlord1.mdx`)

- All five fire emitters share one point, (90.7, -70.7, 88.3): on the mace head's centre line (-71.1, 88.3), at the spiked ring, its widest section. That point is inside the head, between its four flanges, 13 units from the nearest surface. Nothing sits beside or outside the head.
- The head's mass is about 27 units in radius there; the ring's spikes reach 53. The fire cloud is 40 > 30 > 20, the glow 70 > 50 > 40: the fire is about 1.5 x the mass and smaller than the spikes, the glow about 2.5 x.
- The fire travels only 10 units in its half second, so it stays in the head. The head hides the middle of every sprite; flames show all around its outline and between the flanges, and the spikes reach out of the fire. That is how the fire takes the head's shape.
- The emitters launch across the shaft (bone +Z), not along it.

### Progress

Done (`c1663f74`, builds):

- **`gather:'engulf'` / `'engulf-core'`** (`suggestMassEmitterSites` in `src/fx-emitter-surface.js`, `massEmitterSites` and `strikeEmitterSites` in `src/global-animation-model.js`). Fireball's five particle layers use it. A flat straight blade keeps the pass 3 patches: the owner's sword compiles to the same 22 emitters, value for value, as with `'strike'`. `'strike'`, `'strike-head'` and `'head'` are untouched, so Fel surge and layers saved from build 03 compile as before.
- **Compact piece** (mace or axe head, bulky part): one source in the middle of its mass, sized to it. A shaft is left out (`massRun`). A flat piece gets a source off each face.
- **Claw or horn**: the mass is divided along itself until every part's middle lies in the piece (`insidePiece`) and its fire covers it; each part gets a source with a birth line along the piece. The owner's claw: 6 sources from root (fire 13) to tip (fire 6). Core glow and Spat embers stay at the widest source.
- **Body** (more than 4 skin regions): one source in its head, found by head bone names (`nameRegion`); with no head, one source at its top. The owner's body: one source in the head, fire 21.
- **Separate pieces and sprawling parts**: the fire uses the bulkiest group of touching pieces (`massPiece`); a piece that would need more than 8 sources burns at its top instead.
- A mass too large for the largest sprite gets its source just under its top, so the fire shows.

Checked only in Node (`out\fx-design\pass4\dry-run.mjs <model> <geoset index>` compiles Fireball and lists the emitters; `try-mass.mjs` lists the planned sites for every geoset). Not rendered.

Next (not started):

- If the owner finds the claw's fire too slim: raise the 1.1 in `massLeaf` (`width=radius*1.1`), which scales every engulf fire, or the `.45` floor in `widthOf` for the thin end only.
- If the body's fire should sit elsewhere (chest, whole top), change the `many` branch of `suggestMassEmitterSites`; the head choice is in `massEmitterSites` (`only`).
- Unit tests that assert Fireball's `gather` need the new values; `test/fx-legacy-snapshot.test.js` stays untouched.

Exact next step: open test build 04, Fire > Variation > Fireball on dialog geoset 17 (claw), 6 (body), 21 or 22 (compact pieces) and 11 (sword, must look as in build 03).

What the owner should look at (Fire > Variation > Fireball):

- Claw (geoset 17): fire running along the claw itself from its thick end to its tip, no ball in the hollow.
- Body (geoset 6): one fire around the head, no separate balls.
- Compact pieces (geosets 21, 22, 28, 29): one fire in the middle of the piece, the piece showing through it.
- Sword (geoset 11): unchanged.

## Pass 5: electricity (13 November 2026, Fable)

Owner on test build 04: "Fire is looking great." "Overall nice: lightning variation, crackling arc. The rest need some work, also - check all layers and emitters, make sure everything makes sense (some have 5 layers, are all seen?)" "A bit more control." References, best first: MM20 Stormforger, Lightning Elemental, Lightning Shell (`D:\Claude\MDLxL-TestModels\fx-reference-lightning\`).

### What the references do (measured with `out\fx-design\pass5\ref.cjs`)

- **MM20 Stormforger.** Surface electricity is a lightning texture streaming fast along the part (`Lightning4b`, Thunderclap `Lightning2b`, `Weather\Lightning`: 4 passes per 1.2 s), two different textures layered. Sparks are tiny `Zap1` tails (width 4 to 7, tail .03 to .07) launched fast under heavy gravity, so they leap and fall; a low steady rate plus short bursts. Glows are slow (life 2.4 s, alpha 88 to 133). Crackle is `Zap1` geometry on bones that snap to a new angle every 100 ms.
- **Lightning Elemental.** Arcs change shape in steps (texture swapped every 66 ms), never fade; small bolts take turns, each on for 130 to 230 ms, at uneven intervals.
- **Lightning Shell.** Bolt strips circle the weapon on three slow rotors, jitter every 100 ms, texture streaming 5 passes a second, with sparkles in the space around it.
- Native `Zap1` (22 Blizzard emitters): streaks about four times as long as wide (speed 300, tail .55). The old Discharge drew them as long as wide, so it read as blobs.

### Progress

Done (`647934e3`, builds; compiled in Node on the owner's sword, claw, body and a compact piece with `out\fx-design\pass5\dry.mjs` and `rules.mjs`; not rendered, not opened in the app):

- **Lightning** (first variation): unchanged. Its Blade arcs layer is still offered switched off.
- **Crackling arcs**: unchanged except Charge glow, which was too faint to see (dim `Blue_Glow2` at alpha 70, smaller than the blade): size .14/.18/.12 > .2/.3/.22, alpha 40/70 > 70/130, rate 14 > 12.
- **Tip discharge** rebuilt. Forked arcs stream (speed 3); Tip glow larger and brighter; **Tip crackle** (`LightningBall`, steady) replaces the Discharge flash that blinked; **Discharge** is long thin `Zap1` streaks in bursts of 10 (window .12 s, gap .5 s, uneven starts); **Tip sparks** (thin `Zap1` tails under gravity, steady) replace Second discharge, which was a copy of Discharge.
- **Storm sparks** (new variation): Forked arcs at speed 3, Crossing arcs (Thunderclap `Lightning2b`, violet, the other way, 4 passes per 1.2 s), Leaping sparks over the whole part. No steel underlay: a third surface layer would inherit the off switch of Lightning's Blade arcs in `withVariation`.
- **Lightning cage**: Shell arcs (new: `Lightning2b` streaming on a shell lifted off the part, `liftFit:.25`, Thickness control), Zap cards (size pulse .9 to 1.25), Cage arcs (unchanged), Shell sparkles (new: `Sparkle_Anim` 4x4 around the part).
- **Rift seam, Void cracks**: audited, not changed. They are rift and void looks, not electricity; every started layer draws (Rift seam: underlay, seam, zap cards; Void cracks: cracks, aura). Their splinter emitters are offered, not started.
- **Engine, fresh layers only.** `burstCount` + `burstGap` (+ `burstWindow`) on a native emitter: a stepped EmissionRate track; the layer's sites take turns in a scattered order (`burstTurn`), each start shifted by up to half the gap, at least three bursts per cycle. `liftFit` (makeLayer): shell lift as a share of the part-fitted unit, stored as `inflate`.
- **Controls.** Particles per burst (burst emitters, under More, next to Burst duration and Time between bursts). Blade arcs: Arcs per burst, Burst duration, Time between bursts in its main controls. Five catalogues.

The library's own rules were kept (`test/fx-look-quality.test.js`, read, not run): no new dipping rhythm (new arcs use `soft`; `flicker` only on Forked arcs), card size swing under 45 %, bursts only in `lightning-blade`, layers on separate clocks, tracks closed on their clock, native catalogue textures, five translations.

Next (not started):

- Unit tests that list the old Tip discharge layers or the two-layer Lightning cage need new expectations (`test/fx-library-variations.test.js`, `test/fx-effect-tip.test.js`); `test/fx-legacy-snapshot.test.js` stays untouched.
- Document `burstCount`, `burstGap` on native emitters and `liftFit` in [the recipe reference](fx-effect-recipe-reference.md) sections 3.2 and 2.0.
- Ideas held back: a snapping-arc variation from the Elemental (`frames` of Monsoon `Lightning1b/2b/4b`); sparks on a many-region body are small (sizes follow each skin region).
- If streaks at the tip are too long or short: Speed and Streak length on Discharge. If sparks fall too far: Rise / Fall on Tip sparks or Leaping sparks.

Exact next step: open test build 05, Lightning > Variation, on dialog geoset 11 (sword), then Lightning cage on the same part.

What the owner should look at:

- Lightning > Tip discharge: arcs racing along the blade, a crackling ball and glow at the tip, thin sparks falling from it, and a burst of long streaks from the tip a little more than once a second, never on a steady beat.
- Lightning > Storm sparks: the blade keeps its own paint; white-blue and violet arcs run opposite ways along it, sparks leap off the whole blade and fall.
- Lightning > Crackling arcs: as before, with a soft blue glow now visible around the blade.
- Lightning cage: arcs streaming just off the surface, zap cards, one zap circling, sparkles around the part.
- Controls: select Discharge > More > Particles per burst, Burst duration, Time between bursts. In Lightning, switch on Blade arcs: Arcs per burst, Burst duration, Time between bursts. Lightning cage > Shell arcs: Thickness.

## Pass 6: the owner's list from test build 05 (13 to 14 November 2026, Fable)

The list, in the owner's words (short):

1. Switching geosets or clicking another surface resets my selection: keep it.
2. Clustered emitters (Tip glow, Discharge and the rest sit together): a "Select Emitter by group" toggle, to move them together.
3. Lightning cage: nice idea, looks terrible. Huge on a body, flat on a weapon. Billboards?
4. Rift seam: hit and miss, nice idea.
5. The Fire lessons also for Fel fire and for the Fire category in general.
6. Fire column belongs in Fire / Fel fire.
7. Molten lava looks like a slurpie.
8. Lit crystal is buggy, causes tearing.
9. Glacial fissures belongs in Frost.
10. Crystal veins and Lit crystal: same category.
11. Tide etching: not nice.
12. Rune circle: no auras, but cool. A weapon effect?
13. Star flare terrible, Glow orb terrible (placement on a sword), Eye glow: remove.

Later the same day: "no limits... let fable polish what I listed, but also just give it all an extra polish."

Everything below builds; it was compiled in Node on the owner's model with the scripts in `out\fx-design\pass6\`, not rendered and not opened in the app. The owner reviews test build 06 by eye.

### Progress

Done:

- **1. Selection stays** (`db026c16`). `pickGeoset` in `app/SurfaceEffects.jsx` carries the current stack to the next part: `carryAnimationStack` (`src/global-animation-model.js`) and `stackForPart` (`src/fx-own-looks.js`) refit it with the same rules a saved look uses. Look, variation, layer values, added and switched-off layers, an edited emitter count and a previewed Add emitter pick stay. Left behind: single emitters moved or edited by hand (they belong to the old part's surface). Whole-layer slider edits are stored per emitter, so they travel as ratios: `fieldScale` on the layer (new field, fresh layers only; applied in `applyFieldScale` after the layer's own values). A part that already has an applied effect shows that effect until something was chosen or changed in the window (`chosen`); after that the selection replaces the preview there, and nothing applied changes until Apply. Check: `node out/fx-design/pass6/carry.mjs <model> <look> <variation|-> <from> <to>`.
- **2. Select emitter by group** (`108921f6`). A toggle in the Position & size row, next to Emitter markers. `emitterGroup` (`src/fx-emitter-placement.js`) finds the emitters of every switched-on particle layer within 4% of the part's length of the selected one. Dragging the move handle (`GlobalAnimationStage.jsx`: `movedTogether`) or Snap to surface gives all of them the same move; the heading shows the selected emitter and `+N`. Rotate, Delete and the value sliders still act on the selected emitter only. Check: `node out/fx-design/pass6/group.mjs <model> <look> <variation|-> <geoset>`.
- **8. Lit crystal tearing** (`181a653e`). The crystal skins were the only skins in the library lifted a hair off the surface (`inflate` .05 to .13). Two things can tear such a copy: it fights the surface under it for depth, and on a hard-edged mesh it opens at the edges. No render confirmed which it was. The crystal skins now lie on the surface itself (no `inflate`), like every other skin, where neither can happen. Fresh layers only.
- **9. Glacial fissures** is a variation of Frost (`frost-blade`, id `fissures`: the same two layers plus Falling mist). The `glacial` look left `LIBRARY`; a model saved with it still opens.
- **10. Crystal** is one look (`fx-lit-crystal`, shown as Crystal): Inner light, Team colour core, Sparkling facets, Crystal veins. `crystal-veins` left `LIBRARY`.
- **11. Tide etching** (`sort-tide`) and **13. Eye glow** (`fx-eye-glow`) left `LIBRARY`. Saved stacks still open.
- **5. Fel fire** (`5dd58bf0`). Fel fire's variations are made from Fire's recipes in fel colours (the block after the tidal one in `src/global-animation-looks.js`): red and green change places, `Red_Glow3`, `Clouds8x8Fire`, `Clouds8x8ModFire` and `LavaLump` become `Green_Glow3`, `Clouds8x8`, `Clouds8x8Mod` and `GenericGlow64`, the surface is Fel fire's own. Variations: Fel flames (unchanged), Fel licks, Enveloping fel flames, Fel surge (now Fireball in fel: body, core, glow, spat embers, falling sparks on `gather:'engulf'`), Fel sparks (unchanged), Fel column. The old Fel surge recipe (the head source the owner rejected as Fireball) left `src/claude-fx-looks.js`; layers saved with it compile as before. Any later change to a Fire variation reaches Fel fire by itself.
- **6. Fire column** is a variation of Fire (id `column`) and of Fel fire (`fel-column`); `fx-fire-column` left `LIBRARY`. It is seated like Fireball (`gather:'engulf'`): a blended Fire body, the additive column on `Clouds8x8Fire`, embers. New recipe flag `capMotion` (fresh layers, `nativeParticles`): launch speed and lift follow the capped sprite, so the column climbs about 3.5 flame widths on a sword, a claw, a compact piece and a body alike (`true`: the layer's own cap; a number: that cap, for embers rising with the flame).
- **7. Molten lava** (`85ecdb97`). The red lava tile alone was one flat colour at 75%. `lavaSurface` (`src/global-animation-looks.js`) now builds every variation from: the tile at full strength, Lava glow (bright `Flame4` light flowing over it, additive, the Magma flow technique), Cooling crust (dark `CloudsTile1` shapes drifting the other way with Blend, the Living ink technique), and a Heat glow shell. Molten lava also starts Molten beads and a few Cinders. Spitting lava and Smouldering keep their particles on the new surface.
- **5. Fire folder** (same commit). Burning cracks: Crack flames (low blended flames from the surface, a third of a width tall) and no `inflate` on the two crack skins (the Lit crystal tearing applies to any detailed skin lifted off a hard-edged part). Fissures: a Heat glow shell and rising Cinders. Magma flow: Heat glow and Cinders. Forge heat: Falling sparks over the whole part. Rising embers: Ember glow, a faint glow where the embers start. Fresh layers only; saved stacks keep theirs.
- **3. Lightning cage** (`8e337025`). What was wrong in build 05: Zap cards were flat quads lying along the part (the "sheet" on the claw), one set for every skin region (dozens on a body), and Cage arcs repeated per region too; Shell arcs was a copy of the part pushed out by a distance that grew with the part (7.9 on the body). New recipe (`src/fx-technique-looks.js`): three orbit ribbons, Cage arcs, Second arc and Third arc, each once for the whole part on a ring a little wider than the part, at 28% before the middle, the middle and 28% after it; Cage zaps (billboarded thin `Zap1` streaks leaving the surface at every angle, carried with the part); Charge glow; Shell sparkles. No cards, no lifted shell. New Edge fields, fresh layers only: `whole` (one ribbon for the part, not one per region), `along` (place on the part's length; `edgeLayer`, and the handle in `GlobalAnimationStage.jsx`), and in `makeLayer` `reach` (ring radius as a share of the part's radius), `band` (ribbon width as a share of the ring, at most 6% of the part's length) and `smoothness`. Rings on the owner's model: sword 22 to 27, claw 33 to 41, body 85 to 105 with a 13-unit ribbon. Check: `node out/fx-design/pass6/cage.mjs <model> fx-lightning-cage <geoset...>`.
- **12. Rune circle** (`1406b188`) is a part effect: the rune circle stands across the part as rings the part passes through. Rune circle (three rings along the part, turning slowly, each on its own clock), Inner circle (two smaller rings turning the other way), Rune motes. No ground cards, no ground emitter; the old layers still open from a saved model. New Card facing `across` (`CARD_FACINGS` in `src/fx-cards.js`, `cardLayer`; shown as Across in the Facing menu) and, for fresh layers, the Card fields `whole`, `along` and `reach` (half-width as a share of the whole part's radius, in `makeLayer`). Rings on the owner's sword: 59 and 46 units across on a blade 160 long.
- **13. Star flare and Glow orb** (`6d86ea9d`) are rebuilt as billboarded particles sized in widths of the part; both were cards at the middle of every skin region (on a sword: mid-blade and the grip). Star flare: Flare (a `star4` star growing and fading at the tip, `gather:'tip'`), Flare glow, Star glints along the whole part. Glow orb: Orb glow, Orb core and Orb wisps on `gather:'engulf-core'`, the place Fireball's glow sits (around a blade's outer part, the middle of a compact piece, a body's head). Old card layers still open from a saved model.
- **4. Rift seam** (`485d84b9`). The three zap cards sat at the middle of every skin region and nothing else carried the look where the seam's mapping is weak (parts that are not one flat strip). The dark tear and the two-colour crack stay (the crack at full strength). New around them: Dark aura (a violet shell glow), Rift sparks (small violet bursts on the surface, the Crackling arcs technique), Rift splinters (now started: short streaks leaving the surface) and Rift glow. Recipe in `src/fx-sort-looks.js`.
- **Polish 1: bodies and shells** (`b9d3f1a8`). The fault behind "huge on a body" was general: every Card and ribbon layer made one set for each skin region (34 on the owner's body). Recipe flag `sharedSites` on Card and Edge layers (`cardLayer`, `edgeLayer`): a part with more than four skin regions gets four regions' worth, on its longest regions, the rule the emitters already follow; a weapon (up to four regions) compiles exactly as before. Set on every orbit ribbon (`orbit()`), Arcane star, Facet glints, Water glints and Thorn trail. `closedLift` (set by `makeLayer` when a recipe lifts its own layer): vertices at one place move together, so a shell on a hard-edged part stays in one piece (`overlay()`); a Lift the user adds to another layer works as before. Motes > Glow orbs is capped in widths of the part (18 units on the owner's sword, was 33). Sanguine drip starts Blood drips (the Dripping venom drops in red): it had no drip running. Molten lava's Heat glow is .35.
- **Polish 2: audit of every look** (`f00bad0c`). `node out/fx-design/pass6/audit.mjs <model> <geoset...>` lists what every look and variation makes (emitters, sprite size, particles alive, cards, ribbons) and flags huge, tiny, sparse and faint layers. On the sword nothing else stood out except Soul vortex: Inward souls is a flat swirl on the ground under the unit, 71 units wide (an aura). It is now offered, not started; Soul wisps (small lights rising around the part) start instead. The recipe reference has a section 7 with every field added in passes 5 and 6.
- Seen in the audit and left alone, because it would change looks the owner approved: on a part with many skin regions (the body, 34 regions) every built-in and native particle is sized from one region, so flames, embers and sparks are about half the size they are on the sword (flames 14 against 23, embers 1.9 against 3.1). Rune circle on a body is as wide as the body.
- **Rules and tests.** `node out/fx-design/pass6/rules.mjs` checks the whole library against the rules `test/fx-look-quality.test.js` states (compiles on the knight's blade and body with offered layers, separate clocks, closed tracks, catalogue textures, five translations, no flashing): all hold. That test's `CARRIED_BEFORE` list got one entry, `fx-lit-crystal` / Crystal glints / glint: the Crystal veins layer under its new look. No unit test was run. Tests that name what this pass changed and will need new expectations (for a cheaper agent): `fx-library-variations.test.js` (variation lists of Fel fire, Frost, Crystal, Molten lava; `crystal-veins`, `claude-magma-flow`, `fissures`), `fx-layer-editor.test.js` (`crystal-veins`), `fx-look-quality.test.js` (`glacial`, `sort-tide`, `sort-rift`, `sort-blood`, `claude-forge-hot` rows of its lists), `fx-emitter-names.test.js`, `fx-emitter-round2.test.js`, `fx-native-shared-sites.test.js` (Inward souls is no longer started; Rune rings left Rune circle), `claude-fx-looks.test.js` (Magma flow's layers), `fx-cards.test.js` (a fourth facing, Across), and the electron tests that open `sort-rift`. `test/fx-legacy-snapshot.test.js` and its fixture are untouched; saved layers take none of the new fields.
- **Polish 3: glints** (`1406f6cb`). Crystal's Facet glints (Inner light, Team colour core) and Liquid body's Water glints were cards in a row down the middle of every skin region: evenly spaced dots, the pattern the owner rejected in pass 2. Both are now small stars blooming anywhere on the surface (`cover:'surface'`, sized in widths of the part), a few at a time.

Next (not started):

- Run the unit tests and update the expectations listed under Rules and tests. Not Fable's work: a cheaper agent.
- If the owner wants larger effects on bodies: particle sizes on a part with many skin regions come from one region (`layerBasis` in `src/fx-layer-basis.js`, `radius` in `nativeParticles`). Changing that changes every look on a body, so it waits for the owner's word.
- If a Lightning cage ring is too wide or too thin: `reach` and `band` in the recipe (`src/fx-technique-looks.js`), or Radius under More in the window.

Exact next step: none: the list and the polish pass are done. Unit tests were not run; the ones that need new expectations are listed under Rules and tests.

What the owner should look at:

- Pick any look and variation, change a colour or a size, then double-click another surface or change Geoset: the same look, variation and changes show on the new part.
- Lightning > Tip discharge > select Tip glow > Position & size > Select emitter by group > click the emitter marker at the tip: the heading reads "Tip glow 1 +3". Drag the move handle: glow, crackle, discharge and sparks move together.
- Ice > Frost > Variation > Glacial fissures. Ice > Crystal > Variation > Crystal veins; Inner light and Team colour core on a crystal or any hard-edged part: no tearing.
- Water has no Tide etching; Light has no Eye glow.
- Fire > Fel fire > Variation: Fel licks, Enveloping fel flames, Fel surge (a green fireball: on the sword a ball around the outer blade, on the claw fire along it, on the body around the head), Fel column.
- Fire > Fire > Variation > Fire column, and Fel column: fire seated in the part and rising from it as a column, embers above it. Fire's other variations are unchanged.
- Fire > Molten lava: bright liquid lava with dark crust patches drifting over it and a glow around the part; beads on the surface, a few cinders rising. Spitting lava and Smouldering on the same surface.
- Fire > Burning cracks (small flames from the cracks), Fissures and Magma flow (glow and cinders), Forge heat (sparks falling), Rising embers (faint glow under the embers).
- Lightning > Lightning cage on the body (Geoset 9), the blade and the claw (Geoset 4): three thin bolts circling the part at three places along it, short streaks crackling off the surface, a soft blue charge, sparkles. No sheet, no bright shell. Radius of each ring: select Cage arcs > More > Radius.
- Arcane > Rune circle on the sword: green rune rings around the blade at three places, turning slowly, two smaller ones between them, small green motes. Facing > Across is the new choice for any Card layer.
- Light > Star flare on the sword: a star twinkling at the tip with a soft glow, small glints along the blade. Light > Glow orb: one orb of light around the outer part of the blade with a bright core and small wisps leaving it; on a mace head or compact piece it sits in the middle.
- Lightning > Rift seam on the sword, the claw and the body: the dark tear and violet-to-blue crack as before, with a violet glow around the part, small bursts and splinters over its whole surface. No zap cards.
- Any look with cards or orbit ribbons on the body (Geoset 6): Arcane (one star per large region, four in all), Ghost trails, Soul vortex, Arcane swirl, Crystal: a handful of pieces, not one per bone. Swords are unchanged.
- Death & spirit > Sanguine drip: red drops fall from the part.
- Death & spirit > Soul vortex: two streams circling the part and small lights rising around it; nothing on the ground.
- Ice > Crystal (Inner light, Team colour core) and Water > Liquid body: glints appear at changing places over the part, not as a row of dots.

## Pass 7: the whole library, folder by folder (14 November 2026, Fable)

The owner on test build 06, in short: almost everything looks good. Glow shell can also have team colour. A Team colour folder with team-coloured effects and overlays. Poison is not at the standard of the rest; Fly swarm is liked; Plague cloud needs more options (learn from the zombie dragon's breath). The folders after Poison are lacking: many cards are only variations of each other and are less customizable. Merge variations into one card with a Variation dropdown, in every folder. Fix the weak ones; Fable runs over everything once. Weak examples shown: Rune circle on a body (huge green blades), Astral chart turning a body white.

A later request for a toggle that shows every variation as its own card was withdrawn by the owner the same hour; nothing was built for it.

### What the new references do (measured with `out\fx-design\pass7\ref.cjs`)

- **Zombie dragon breath** (`fx-reference-owner2\zombie-dragon`). Two emitters at one place in the mouth, both the cloud sheet `Clouds8x8`, blended, never additive: one pale green (.69/.99/.74 > .25/.53/.32 > .33/.51/.34), one murky olive (.31/.42/.27 > .22/.27/.07 > .19/.31/.22). Born dense and thinning (alpha 123 > 60 > 0), growing by half (45 > 55 > 65), on the first frames of the sheet only (0-6, then 7-12), sorted far to near, in a 20 degree cone, fast (speed 300 to 400, life 1.25 s). The depth comes from the light and the dark cloud mixing.
- **Eldritch Covenant.** Team colour: the flat team colour added over a surface at 30 to 50% so it glows, the same travelling diagonally over it, the team glow added and swelling on a 2 s clock, and a geoset of pure team glow. Smoke: an additive coloured dust with a blended black dust in the same place.
- **Elemental Lord.** Rocks, leaves and dust carried around the body on a turning axis inside long wind ribbons (`wind.blp`, life 3 s). Its fire wears a warm additive dust (`Dust5A`, yellow to red).
- **Blade of the Abyssal Serpent.** A textured blade inside an additive glow copy of itself: the Glow shell technique. Nothing new.

### Progress

Everything below builds. Recipes were compiled in Node on the owner's model (sword G10, claw G16, body G5) with the scripts in `out\fx-design\pass7\`; nothing was rendered or opened in the app.

The library went from 61 cards to 40. Counting every variation, it grew from 92 looks to 120. Every look that left `LIBRARY` is retired: a model saved with it opens and compiles exactly as before (`findLook`).

- **Poison & nature** (`00e0fc49`).
  - Poison: six variations. Poison, Dripping venom and Toxic fumes stay and get depth: Dark rot (dark cloud shapes drifting against the film, the Cooling crust technique), Running slime, a Sickly glow shell, more bubbles; Toxic fumes gets a second, murky cloud. Felwood curse, Acid (was Venom seep) and Corrupted veins are variations, each with started particles (curse wisps, acid splashes and fumes, ichor drops). Felwood poison was the Poison film again under another name: retired.
  - Plague cloud (was Plague swarm, one haze emitter): Plague cloud, Plague breath, Sinking miasma, Spore cloud, Buzzing cloud, all on the dragon's pale and murky cloud pair with its colours and frames.
  - Vines (was Briar binding): Vine weave and Mossy bark (it was a switched-off layer), with falling leaves, pollen, spores.
  - Leaves (new): Falling leaves, Whirlwind (wind ribbons, whirling leaves and dust).
  - Fly swarm: untouched.
- **Team colour** (`67a4c0e7`, new folder). Team colour (Colour wash, Glowing colour, Flowing light, Running bands), Team lights (Glow orbs, Rising sparks, Team flames, Leaping sparks), Team orb (Orb, Tip flare), Team swirl. Glow shell has a Team colour variation. Everything is made of the two native team pictures.
- **Fire** (`dccdd444`). Fire and Fel fire: unchanged; one variation added to each, Fire breath and Fel breath. Lava: Molten lava, Spitting lava, Smouldering, Magma flow. Burning cracks: Burning cracks, Lava fissures (was Fissures; gets the low crack flames), Forge heat. Embers (was Rising embers): Rising embers, Falling sparks, Ash and cinders.
- **Ice** (same commit). Frost: unchanged; Frost breath added. Crystal: unchanged. Frost mist: glints in the mist, and a Snowfall variation.
- **Water** (same commit). Water takes Liquid body as a variation (with drips) and gains Waterfall.
- **Lightning** (same commit). Lightning and Lightning cage: unchanged. Void: Rift seam and Void cracks; Void cracks takes the rift's bursts, splinters and glow over the whole surface in place of one orbiting emitter.
- **Arcane** (`ff2cedb1`). Arcane takes Energy flow (glow started, sparks added). Runes: Runes, Thorn script, Glowing runes, Soul seal (was Soul lantern), Eclipse eye (was Eclipse brand), Hex mark; each sheds motes in its colour. Wards: Spell ward, Recall seal, Mending light, with glow and rising particles started (their particles were only offered). Night sky: Astral chart, Starlit shale (was Void shale), Moon mosaic.
  - **Astral chart** (the white body). It replaced the part's surface with a marble tile. No render here confirmed why that drew white; the layer is gone. The part's own picture is darkened to night blue as an overlay, the star field and constellation lie over it, stars twinkle on it.
  - **Rune circle** (the huge blades). A ring around all of a body is as wide as the unit, and a body's skin regions are slivers, so rings on regions mean nothing. New Card flag `seated`: on a body, or a part wider than a fifth of its length, the rings gather at the Fireball seat, stacked and sized to that mass. Owner's body: three level rings 49 across around the head (they were 266 across). Claw: 25 across (was 89). Sword: unchanged.
- **Light** (same commit). Glow shell: Glow shell, Team colour, Glowing texture (was the Glow card). Motes moved here and gains Fireflies. Star flare, Glow orb: unchanged.
- **Stone** (same commit). One card: Basalt, Carved cairn, Crumbling rock, Orbiting rocks (the last two after the Elemental Lord).
- **Death & spirit** (same commit). Spirit (Wraith form, Spirit veil, Revenant waves), Souls (Soul vortex, Ghost trails), Shadow (Dark smoke, Hollow shell, Living ink), Blood (Sanguine drip, Blood pact). Each gets particles on the part: soul wisps and a ghost haze, black dust, ink drips, blood drips and spatter.
- **Build your own**: unchanged. Its cards are separate tools, not variations of one look.
- **Breath on a body** (the commit with this note). New `gather:'mouth'`: a weapon breathes from its far end; a body breathes from its head along +X, the way the unit faces, as wide as the head.
- **Engine, fresh layers and stacks only** (details in [the recipe reference](fx-effect-recipe-reference.md), section 8): a variation's own `loop` and `asOverlay`; `tiling` from the recipe; `teamTile`; `team` on ribbons; Card `seated`; `gather:'mouth'`.
- **Controls**: Tiling goes down to 0.5 (a surface layer can show a part of its picture; Flowing light uses 0.6 and 0.8). No other control changed.
- **Search** finds a card by the name of any of its variations (`app/SurfaceEffects.jsx`), so "Magma flow" still finds Lava.
- **Translations**: every new name is in the five catalogues.

### Checks run (design checks, not tests)

- `node out/fx-design/pass7/audit.mjs <model> <folder|all> <geoset...>`: every look and variation compiles; one line per layer with emitters, sprite size, particles alive, travel, and flags for huge, tiny, sparse, faint.
- `node out/fx-design/pass7/rules.mjs`: the rules `test/fx-look-quality.test.js` states hold for the whole library (compiles on the knight's blade and body with offered layers, separate clocks, closed tracks, catalogue textures, five translations, no flashing).
- `node out/fx-design/pass7/switch.mjs`: all 362 switches between two variations of a card leave every layer on or off as its recipe says, with the right loop and overlay choice.
- `snap.mjs` + `cmp.cjs`: a fingerprint of what every look of the starting revision (`db04b3c7`) compiles to on the three parts, against now. Changed: only the looks this pass meant to change. Fire, Fel fire, Frost, Lightning, Crystal, Lightning cage, Star flare, Glow orb, Fly swarm and every retired look are identical.
- `node --test test/fx-legacy-snapshot.test.js`: passes; the test and its fixture are untouched.

### Tests that need new expectations (for a cheaper agent; none was run except the legacy snapshot)

The library's shape changed, so most FX tests that name a look, a folder or a layer list are affected:

- Lists of looks, folders, variations and counts: `fx-library-variations.test.js`, `global-animations.test.js`, `fx-look-quality.test.js` (also its `CARRIED_BEFORE` rows for looks that are variations now), `fx-sort.test.js`, `claude-fx-looks.test.js`, `fx-fifth-round.test.js`, `visual-effects.test.js`, `surface-effects.test.js`, `sort-my-mess.test.js` (if it reads the FX library), `fx-own-looks-library.test.js`, `fx-own-looks.test.js`.
- Tests that open a look that is a variation now, or whose layers changed: `fx-layer-editor.test.js`, `fx-glow-shell-thickness.test.js` (Glow shell has variations), `fx-skin-speed.test.js`, `fx-emitter-persistence.test.js`, `fx-emitter-names.test.js`, `fx-attachment-cache.test.js`, `fx-emitter-depth.test.js`, `fx-emitter-defaults.test.js`, `fx-emitter-audit.test.js`, `fx-native-shared-sites.test.js`, `fx-fly-swarm.test.js`, `fx-empty-emitters.test.js`, `fx-emitter-round2.test.js`, `fx-cards.test.js` (Rune circle `seated`).
- Electron tests that click a card by name: `fx-cards`, `fx-empty-emitters`, `fx-fifth-round`, `fx-layer-controls`, `fx-layer-editing`, `fx-own-looks`, `fx-owner-followup`, `fx-owner-motion`, `fx-owner-round`, `fx-responsiveness`, `global-animations`, `surface-effects-warriors` (`.electron.cjs`). A card that is a variation now is reached through its new card and the Variation menu.
- `test/fx-legacy-snapshot.test.js` and its fixture stay as they are.

### Next (not started)

- Update the test expectations above.
- Open questions only a render answers: whether the travelling team glow repeats cleanly in the preview and in the game (`teamTile`); whether Astral chart's darkened body is dark enough (`strength` of its Night layer); how the level rune rings read around the owner's head.
- Left alone on purpose: particle sizes on a body (they follow one skin region; the owner's word is needed, see pass 6); the wide ribbons of Lightning cage, Team swirl and Whirlwind around a body (the owner saw the cage in build 06 and did not list it).

Exact next step: none for the design; the owner reviews test build 07. The unit tests listed above need new expectations.

### What the owner should look at (test build 07)

- **Poison & nature > Plague cloud > Variation**: Plague cloud (a pale and a murky cloud billowing around the part, a faint green light inside, spores), Plague breath (a stream from the far end of a weapon; on the body from the head, forward), Sinking miasma, Spore cloud, Buzzing cloud (with flies).
- **Poison & nature > Poison > Variation**: all six. Poison and Dripping venom should have dark shapes and slime moving over the green, and a green glow around the part.
- **Team colour**: all four cards and their variations, on a unit with a team colour set. Light > Glow shell > Variation > Team colour.
- **Arcane > Rune circle** on the body (Geoset 6): three small level rings around the head, no blades. On the claw: small rings around its thick end. On the sword: as before.
- **Arcane > Night sky > Astral chart** on the body: a dark night-blue body with stars, no white.
- **Fire > Fire > Variation > Fire breath**, Fel fire > Fel breath, Ice > Frost > Frost breath: on the sword and on the body. Fire's and Frost's other variations are unchanged.
- **Every folder**: fewer cards; each card's Variation menu holds what used to be separate cards. Search still finds the old names.
- **Fire > Embers** (Falling sparks, Ash and cinders), **Lava**, **Burning cracks** (Lava fissures with small flames).
- **Water > Water > Waterfall**; **Ice > Frost mist > Snowfall**.
- **Stone > Stone > Crumbling rock, Orbiting rocks**; **Poison & nature > Leaves > Whirlwind**.
- **Death & spirit**: Spirit, Souls, Shadow, Blood: each with particles around the part now.

## Rules carried over

Native Blizzard art or the model's own parts only; no new panels; Variation dropdown for variants; no look-id exceptions; same emitter controls for every preset; everything stays editable; keep `ReplaceableTextures\Weather\Clouds8x8.blp`; no flavour text; five translation catalogues; local commits only.
