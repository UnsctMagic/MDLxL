# Contract 6: housekeeping after the review

Status: ready for Codex (do last)
Owner / consolidator: Codex (fix), Claude Code (contract and review)
Updated: 2026-11-11

Findings G1 to G3 of the [main review](main-review-2026-11-11.md). Read its "Rules for
every contract" first.

## Goal and completion criteria

1. **G2. Task index tells the truth.** For each row of
   [the task index](README.md) "Current tasks", check its PR on GitHub
   (`gh pr view <n> --json state,mergedAt,mergeCommit`). Where the work is merged:
   set the note's status line to `completed, merged in #<n> at <sha>` and remove the
   row. Rows found stale on 11 Nov: OptimizeXL exact redundancy (#548), Citadel Paint
   layout (#600), Library textures review fixes (#506), OptimizeXL world budget (#437),
   AI motion measure and AI every-frame checks (#488 / #486), AI chat loop (#430),
   Remove Offload birds (#501), Rotate ring drag (#409), EMTR Add like ribbons (#491),
   FX global animation maker (#492). Check each again; do not trust this list blindly.
   Leave rows whose work is really open. Documentation only.
2. **G1. Flail check (O6, approved by the owner on 11 Nov).**
   `test/manual/optimizexl-flail-regression.mjs` fails on main with "Only explicitly
   added repair capabilities may extend this baseline" because the extents finding
   added by #581 (`kind: 'bounds'`) is not on its allowed list. Add `bounds` to that
   list, exactly as #548 did for `exactCleanup`. Change nothing else in that file, its
   fixtures or its hashes. Then run it on both accepted models with the historical
   `MDLXL_FLAIL_MOUNTED_REFERENCE` file (see
   [OptimizeXL verification](../OPTIMIZEXL_VERIFICATION.md)) and record the result.
   The approval covers this one finding kind only.
3. **G1, second half.** Name the flail check in the
   [QA and release kit](../QA-AND-RELEASE-KIT.md) release standard, with the two model
   paths under `D:\Claude\MDLxL-TestModels` and where the reference file lives, so a
   release cannot pass without it.
4. **G3. One copy of each shared rule** (no behaviour change; existing tests must stay
   green and results identical):
   - `src/model-extents.js`: import `isPortraitSequence` from `src/sequence-editor.js`
     and `isGlobalTrack` from `src/animation.js`; share one `visibleIn` and one
     "every layer additive" test with `src/geoset-extras.js`.
   - `app/NodeEmitterVisibility.jsx`: `globalSequenceId` instead of a hand test.
   - `src/bone-wiggle.js`: `nodeIndex(model).parentOf` and `nodePivot`.
   - `src/paint-uv-layout.js` `paintHeadDetail`: `nameRegion` from `src/rig-names.js`
     and `nodeIndex` for descendants. This one can change which bones count as head
     ("Forehead" matched before): compare the result on the Paint test models first and
     keep the old result where they differ; report any difference instead of deciding.
   - `electron/main.cjs`, `electron/preload.cjs`: preset channels follow the convention
     (`preset:openFile` / `openPresetFile`, `preset:saveFile` / `savePresetFile`);
     update callers and `test/settings-presets.test.js`. No stored data uses these names.
   - `app/hotkey-sequences.css`: the discard cue uses a `--z-*` variable, above
     `--z-workspace-modal`.

Out of scope: any new check, any change to OptimizeXL results, renaming stored keys.

## Revision and local state

- Base: local `claude/main-review-2026-11-11` (`main` at `a8a4ca86`), after contracts
  1 to 5 so the index can drop their rows too.
- Flail models: `D:\Claude\MDLxL-TestModels\optimizexl\WH_WOC_KnightKhorneFlail01_HIVE_OPTIMIZED.mdx`
  and `D:\Claude\MDLxL-TestModels\optimizexl-expression\WH_WOC_KnightKhorneFlail03.mdx`.
  The `mounted-spheres` reference file was not found in the test-model folders on
  11 Nov; find it or ask the owner, and add it to the test-model collection (add only,
  never remove anything there).

## Findings and decisions

- Verified (run on `171b8bb9`; the files are unchanged since 0.39.0): the check stops at
  its line 105. A copy with `bounds` allowed
  (`D:\Claude\MDLxL-QA\2026-11-11-main-review\lead\flail-with-bounds-allowed.mjs`)
  passes Flail01 completely and on Flail03 differs only in `mounted-spheres`, the
  documented case that needs the reference file.
- G2 was checked with `gh pr list --state all` on 11 Nov.
- G3 items were read, not run; they are duplicates, not faults.

## Changes and verification

- G2: every link in the index and edited notes resolves; no test run needed.
- G1: the manual check, both models, result pasted here.
- G3: `node --test test/model-extents.test.js test/bone-wiggle.test.js
  test/paint-uv-layout.test.js test/settings-presets.test.js test/desktop-bridge.test.js
  test/node-index.test.js`, plus the geoset-extras tests; results identical before and after.

## Blockers and next action

- No blocker; O6 is approved. If the `mounted-spheres` reference file cannot be found,
  say so here and ask the owner; do not regenerate or replace the accepted hash.
- On completion: status, revision and checks here; plain summary for the owner; hand back.
