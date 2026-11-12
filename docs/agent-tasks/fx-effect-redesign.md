# FX: effect redesign after the trial 06 rejection

Status: ready for the owner's hand test (test build `TestBuilds\fx-effects`, model `TestBuilds\test-models\TEST FX EFFECTS 01.mdx`). Local branch only.
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

## Rules carried over

Native Blizzard art or the model's own parts only; no new panels; Variation dropdown for variants; no look-id exceptions; same emitter controls for every preset; everything stays editable; keep `ReplaceableTextures\Weather\Clouds8x8.blp`; no flavour text; five translation catalogues; local commits only.
