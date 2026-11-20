# OptimizeXL: Necessary only geoset animation bounds

Status: ready for review (local branch, not online)
Owner / consolidator: Claude Code (Opus); tests and corpus diff by Sonnet/Haiku workers
Updated: 2026-11-20

## Goal and completion criteria

- The owner's approved plan (from his ChaosDragonSkeleton work, 20 Nov 2026): OptimizeXL's
  **Calculate extents** finding gets one choice, **Geoset animation bounds**: **Full** (the
  earlier result, byte-identical) or **Necessary only (saves N KB)**, which empties every
  geoset's per-animation table (`geoset.Anims`, 28 bytes per record) and grows each geoset box
  so it stays a safe fallback. Model (`Info`) and animation (`Sequences[i]`) boxes are the same
  in both.
- An empty table is no longer a broken target; Hive's 0-record warning is a note.
- Default: Necessary only when the model already has no complete table (its own state is the
  remembered choice, no stored setting). Classic/SD only; Reforged HD keeps its tables.
- Out of scope here (parallel branch by another agent): the tools that refill tables
  (`src/sequence-editor.js`, `src/forge.js`, `src/bits-and-parts.js`, `src/glow-up.js`,
  `src/auto-corpse.js`, `src/geoset-operations.js`, `src/global-animation-model.js`,
  `src/portrait-extents.js`, `app/portrait-background.js`). That agent adds
  `keepsGeosetAnimationBounds(model)` to sequence-editor.js; combine it with
  `defaultExtentsChoice` here when the branches meet.

## Revision and local state

- Branch / checkout: `claude/geoset-bounds-necessary` in `D:\Claude\MDLxL\.claude\worktrees\geoset-bounds-necessary`
- Base: main 16904f82. Not pushed.
- Scratch (untracked): the worktree's `out/geoset-bounds/` (research and corpus-diff scripts and results, a `git archive 16904f82` snapshot).

## Relevant owners

- `src/model-extents.js`: `calculateExtents(model, { necessaryOnly })`, `offersNecessaryExtents`,
  `defaultExtentsChoice`, `geosetAnimationBoundsBytes`, `extentsDiffer(model, choice)`, `boundsProposals` (choices).
- `src/optimizexl.js` `applyRepair` (`fix.kind==='bounds'`) and `fixAllSettings`.
- `src/optimizexl-bounds.js` `invalidBoundsTargets`; `src/optimizexl-diagnostics.js` `classifyHiveFindings` (status `note`).
- UI: the existing Repair choice select in `app/OptimizeXL.jsx`, labelled by `fix.choiceLabel` with its tooltip in `app/OptimizeXLHelp.jsx`.
- `app/Inspectors.jsx` (Calculate extents button) and `app/App.jsx` (Save As option) pass the model's own state.
- Guide: [OptimizeXL](../OPTIMIZEXL.md) current scope; rule rows in [teaching agreement](../OPTIMIZEXL_TEACHING.md).

## Findings and decisions

- Verified (corpus-sd800, 386 models, 1,782 full tables): Blizzard's geoset box equals the union of
  its per-animation records in 1,782 of 1,782. In 283 of them the still (bind) pose lies outside that
  union and the geoset box does not cover it: Blizzard's box leaves the still pose out.
- Verified: a geoset hidden in an animation stores an empty record there (min +3.4e38, max -3.4e38),
  so hidden animations never widen Blizzard's geoset box. Glow, portrait and effect geosets
  (`extentsExclusions`) have ordinary swept records; the exclusion only affects model and animation boxes.
- Decision: Necessary only sets the geoset box to still pose plus every animation that shows the geoset
  (same visibility test as the animation boxes). Matches Blizzard wherever the still pose is inside the
  sweep and is only ever larger otherwise; it keeps every pose MDLxL itself shows (edit mode uses the
  still pose; `app/viewport-math.js` clip radius reads these boxes) inside the box.
- Decision: a partial table in an otherwise empty model is repaired by emptying it (the default there is
  Necessary only). Records carry no sequence identity, so a partial table cannot be trusted, and emptying
  leaves one consistent state with the geoset box covering every animation.
- Existing behaviour, not changed: MDLxL counts Blizzard's empty hidden-animation records (min > max) as
  broken boxes, so Blizzard models show "Calculate extents (N broken)" (archnathid: 42).
- Uncertain: whether Warcraft III reads these tables at all. One owner test (ChaosDragonSkeleton_19 with
  all tables removed) showed and played normally; screen edges, scaled units, portrait and Death/Decay
  half off-screen are untested in game.

## Changes and verification

- Numbers: ChaosDragonSkeleton_13 label "Necessary only (saves 55 KB)": 913,182 → 856,706 bytes
  (56,476 B = 65 full + 2 one-record tables); Full output 914,862 (the 2 partial tables refilled).
  ChaosDragonSkeleton_08 "saves 48 KB": 779,944 → 730,468 (49,476 B = 57 × 31 × 28). Info and Sequences
  identical between Full and Necessary only on both.
- Tests: `test/model-extents-necessary.test.js` (new, 5 tests) and the count-0 case in
  `test/optimizexl-bounds.test.js`; `node --test test/model-extents-necessary.test.js test/optimizexl-bounds.test.js test/model-extents.test.js test/optimizexl-diagnostics.test.js`: 28 pass, 0 fail. The new checks fail on main 16904f82 (missing exports; on a shimmed copy: `0 !== 1960`, empty tables still targets, default undefined, `10 !== 0` Anims).
- Corpus: `calculateExtents` with no options and the applied Full result (`runOptimizeStage` sha256) are
  identical to main for all 386 corpus-sd800 models plus both dragons.
- `test/optimizexl-bounds.electron.cjs` (packaged) now picks Full in the window, since its model has no
  tables and defaults to Necessary only. Not run. `test/manual/optimizexl-bounds-models.mjs` passes Full.
- Remaining: packaged UI check (choice label, tooltip, Full/Necessary preview, save size); translations
  of the new strings ("Geoset animation bounds", "Necessary only (saves {0} KB)", tooltip, note) are
  not in the locale catalogs yet.

## Blockers and next action

- Combine with the other agent's refill branch, build, and hand the owner a test build with
  `TEST GEOSET BOUNDS 01.mdx` (a ChaosDragon copy).
- Open question for the owner: the choice appears only when Calculate extents is proposed (some box
  off or broken). A model whose boxes are already right shows no finding, so Necessary only cannot be
  picked there.
- On completion: mark completed with the merge revision and remove the README row.
