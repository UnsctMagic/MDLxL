# FX: effect redesign after the trial 06 rejection

Status: refinement pass 3 in progress (13 November): Fireball reworked for swords (`ba0a2b92`), controls pass next. Compiled only; the owner reviews builds by eye. Local branch only.
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

Next: FX controls pass in `app/GlobalAnimationControls.jsx` (order, labels, tooltips, less friction), one small commit at a time, strings in all five catalogues.

Exact next step: read `app/GlobalAnimationControls.jsx` top to bottom and list the control changes that cannot alter how any look compiles.

What the owner should look at for Fireball (Fire > Variation > Fireball):

- On a sword: a dense red-orange ball around the outer part of the blade with a yellow centre, the fire thinning along the blade toward the hilt, embers drifting out of the ball and sparks falling along it. No grey smoke lumps, no pink halo.
- On a mace or axe head and on a body: one ball around the head / top, same colours.

## Rules carried over

Native Blizzard art or the model's own parts only; no new panels; Variation dropdown for variants; no look-id exceptions; same emitter controls for every preset; everything stays editable; keep `ReplaceableTextures\Weather\Clouds8x8.blp`; no flavour text; five translation catalogues; local commits only.
