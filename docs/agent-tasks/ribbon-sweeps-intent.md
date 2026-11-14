# Ribbon maker: elemental sweeps (owner intent, 14 November 2026)

Status: in progress
Branch: `claude/ribbon-sweeps-6d004b` (worktree `D:\Claude\MDLxL\.claude\worktrees\ribbon-sweeps-6d004b`), from `main` at `40a37825`.
Written by the orchestrator (Opus). Fable leads design and the code that matters. This file is the brief and the running task note.

## Owner's words

"fire arrows - shows beautiful use of particles, this could easily make for elemental sweep-type attacks, currently we only have one type of ribbon (but push this design to ribbon maker - yes i want it handled too ... follow the way we've been doing things here so it comes the same quality - give me a selection of elemental sweeps, spirit sweep etc)"

## Goal

The Ribbon maker is EMTR's **Add ribbon** flow (`beginRibbon` in `app/ParticleEditor.jsx`; starter in `src/particle-starters.js` kind `ribbon`, one look: `Textures\RibbonBlur1.blp`). Today it makes one plain trail. The owner wants a **selection of beautiful elemental sweeps** to choose from when adding a ribbon: at least Fire, Frost, Lightning, Spirit and Fel, plus any others worth having (for example Shadow, Holy, Nature, Arcane, Blood; Fable decides from what native art supports well). A sweep can combine a ribbon with particle emitters riding the weapon, the way Fire Arrows pairs streaks with flame particles.

## Rules (binding)

- **Same quality bar as the FX redesign** (`D:\Claude\MDLxL\.claude\worktrees\fx-effects\docs\agent-tasks\fx-pass9-intent.md`, read-only; never edit the FX worktree). The owner loves the FX looks.
- **Modular:** every part a sweep creates stays an ordinary ribbon or emitter, editable with the existing Ribbon maker and EMTR controls and handles. No new panels, no new control scheme, no flavour text: preset names only, all strings in the five catalogues.
- **Fits any weapon shape:** reuse the existing fitting (`src/particle-ribbon-fit.js`, marked polygons, bone binding, checked animations). Test on several weapons (long sword, axe, claws/fists, staff).
- **Native Blizzard art only;** reuse model parts then game files; create no new textures.
- **No regressions:** the current plain ribbon stays the default and stays byte-identical; existing ribbon tests keep passing (`test/ribbon-attachment.electron.cjs`, `ribbon-quick`, `particle-ribbon-fit`, `particle-assets`, `particle-preview`, `movement-create-ribbon-reentry`).
- Visible in the attack the user checked; never resets the camera; preview keeps mouse rotation.

## Reference (learn and adapt, never copy)

- `D:\Claude\MDLxL-TestModels\fx-reference-owner3\Fire Arrows\` (Bonefire, Firecracker, Searing arrows, with and without fire; `readme.html` for author/permission).
- Native ribbon and particle usage: `D:\Claude\MDLxL\.claude\worktrees\fx-effects\out\native-particles\FAMILIES.md`, `SPRITES.md`, `FX-REFERENCE.md`.
- Capture workbench pattern: `D:\Claude\MDLxL\.claude\worktrees\fx-effects\out\fx-look\` (copy what you need into this worktree's `out\`; never run it inside the FX worktree).

## How the work runs

- **Fable:** all design and meaningful code; chooses helpers.
- **Sonnet:** manual work: captures on a hidden desktop, translations, test expectations, credits.
- **Opus:** reviews captures across models and forwards only bad cases, with images, to Fable.
- **Credits:** each studied model gets author, link and permission check in `THIRD_PARTY_NOTICES.md`, section "FX reference models" (Sonnet).
- **Test build:** `D:\Claude\MDLxL\TestBuilds\ribbon-sweeps-01`, opened on `D:\Claude\MDLxL\TestBuilds\test-models\TEST RIBBON SWEEPS 01.mdx` (copy of `D:\Claude\MDLxL-TestModels\fx-owner\Great Unclean Dude.mdx`). `pnpm run build`, then `node scripts/package.mjs --out <folder> --overwrite`; hidden click-through smoke of every new control before handover.
- **Credit rule:** at 90% of the 5-hour window everything is committed and a test build is packaged and open for the owner; stop new work at 98% and write the exact next step here.
- Local commits only; nothing goes online until the owner says "merge".

## Progress

- 14 Nov: brief written; Fable lead started.
- 14 Nov (Fable): built. Add ribbon's panel has a **Sweep** list: Plain (default, the same ribbon byte for byte) and Fire, Frost, Lightning, Spirit, Fel, Shadow, Holy, Arcane, Blood. Owner: [ribbon-sweeps.js](../../src/ribbon-sweeps.js) `sweepRibbonFit`; the list is in [ParticlePlacementControls.jsx](../../app/ParticlePlacementControls.jsx); `ParticleEditor.jsx` only loads the extra stock pictures.
  - A sweep = the fitted ribbon (same `RibbonBlur1`, tinted) + one or two ordinary `ParticleEmitter2` nodes on the same bone, pivot and turn, spread along the edge (`Length` = 46% of the edge each way). Not Model Space, so particles stay behind as a trail. Sizes follow the edge length (`(length/60)^0.6`, held to 0.8–1.6).
  - Pictures (all `Textures\`, stock): Fire `Clouds8x8Fire` + `LavaLump2`; Frost `Clouds8x8Fade` + `snowflake`; Lightning `Zap1` + `Blue_Star2`; Spirit `Clouds8x8Fade` + `GenericGlow64`; Fel `Flame4` + `LavaLump2`; Shadow `Clouds8x8Black` (Blend) + `Purple_Star`; Holy `Yellow_Star_Dim` + `Sparkle_Anim`; Arcane `Blue_Star2` + `Star8c`; Blood `BloodWhiteSmall` (Blend).
  - Tests: [source](../../test/ribbon-sweeps.test.js), [packaged](../../test/ribbon-sweeps.electron.cjs). New names Plain/Spirit/Fel/Shadow/Holy are in all five catalogues.
  - Looks: capture workbench in `out\sweep-look\` (`run.ps1 -Out <folder> [-Only slugs] [-Sweeps ids]`, `models.json`); Sonnet captured, Opus reviewed, Fable tuned over rounds 1–4. The Footman capture selects a geoset that holds sword and shield together, so its fitted edge is not the blade; that is the capture's selection, not the sweep.
- 14 Nov, pass 2 (owner on build 01: "Its good, lightning needs to be a bit better"). Only Lightning changed; the other eight sweeps and Plain are owner-approved and save byte-identical files (40 saved-file hashes compared before/after, 10 choices at 4 edge lengths: only the 4 Lightning ones differ; `out\sweep-baseline.mjs`). Lightning is now thin `Zap1` forks over `LightningBall` crackle and `Sparkle_Anim` glints with a fainter, shorter ribbon, learned from the owner's Lightning Missile reference (short lives, almost no drift, a pop in size, white cooling to blue). Build `TestBuilds\ribbon-sweeps-02`, model `TEST RIBBON SWEEPS 02.mdx`.
  - Verified: source `ribbon-sweeps` 13/13; related source tests 140/140; packaged on build 01: ribbon-attachment, particle-ribbon-fit, ribbon-track, movement-create-ribbon-reentry, ribbon-sweeps pass. Fail-first: on `TestBuilds\fx-effects-06` the new packaged test stops at line 44, `waiting for getByLabel('Sweep', { exact: true })`.
  - Not verified: `emtr-add-like-ribbons` needs a profile with a current Warcraft effect index (`MDLXL_REAL_PROFILE`); it stops before its ribbon step here, the same on the older build. Warcraft III itself not run.
  - Open (Opus review, not applied because the owner approved the looks): Fire puffs large on very big weapons; Fel reads close to green fire; Blood hard to see on red models; Spirit wisps faint. Offer as new options only.
- 14 Nov, pass 2b (owner rules: no custom textures, e.g. no AzureGlow; draw modes must match the picture so no blocks float; Stormforger as the lightning authority). Lightning now has a crisp ribbon flash (0.12 s, 70 pieces/s) and forks that leap from nothing and vanish (blue at birth, white hot, fast with a short tail), kept over the crackle and glints. Two new source tests in `ribbon-sweeps.test.js`: every sweep picture, the ribbon's included, must be in `electron/data/texture-library-catalog.json`; every ribbon layer is Additive and every emitter uses the mode and atlas size native models use for that picture. Both were shown to fail (a custom glow path; a wrong mode). Saved-file hashes: still only Lightning differs from build 01.
- 14 Nov, build 02 packaged (`TestBuilds\ribbon-sweeps-02`, revision `ecd20d98`), hidden packaged test 1 pass. Opus block check of the final captures: no square or block sprites in any sweep; Lightning better or equal on all six models, none worse. Left for the owner to judge: the ribbon strip itself (Plain and every element share it) can show a straight edge when a weapon slides sideways instead of turning (Chikichiki staff) or very early in a swing; long lightning forks are straight, not kinked. Next step if wanted: a softer ribbon end, as a change to the shared ribbon that needs the owner's yes because it changes Plain.
