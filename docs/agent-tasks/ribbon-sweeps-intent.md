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
