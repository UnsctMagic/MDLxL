# Contract 6: housekeeping after the review

Status: completed for Claude review. Flail03 historical mounted-spheres reference missing, as confirmed by the owner.
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

## Codex handoff

Local implementation revision 143236bc on codex/main-review-20261111-6, based on
4340c5f8. Housekeeping followed the other contracts' implementation branches.

- G2: checked each task against the merge history already present in 4340c5f8.
  Fourteen merged task rows were removed and fifteen notes got their merge
  revision. The world-budget branch was integrated at 9ffbd7f8 and reached main
  through #456 at 7dc13293. Local history does not identify a separate #437 merge.
  The deterministic AI steering follow-up merged in #435, so its row could close
  along with the original #427/#430 work. The other current tasks stay listed.
  132 local file links resolved across the 17 edited documents. This was a
  local history and link check.
- G1: the immutable check on 4340c5f8 stopped at “Only explicitly added repair
  capabilities may extend this baseline.” The single allowlist addition is
  bounds. The script, baseline files, stored hashes and fixtures otherwise
  keep the accepted rules. The release standard names both input files and
  records that the historical Flail03 reference is missing.
- G1 verification: node test/manual/optimizexl-flail-regression.mjs ran once
  per accepted model on 143236bc. Flail01 matched all 31 accepted results and
  verified the extents repair. Flail03 stopped only at mounted-spheres.
  Actual SHA-256 c0a0955d8f92cb3d1ab1d13914845cc134060a31d84cd2ced5795c0836ca9
  is the same as the main-review run with only bounds allowed. Frozen SHA-256
  084d34e0deda0e6d2d7c1722698806b4c937db3a45c34f18d94aa1cd3bd8174a
  is unchanged. The owner confirmed the 237,022-byte reference is absent and
  asked to record the known failure and finish the rest. No reference was rebuilt.
- G3: extents and Hide extras share visibility sampling and additive-layer
  recognition. The extents caller keeps its original fallback for missing
  intervals and its treatment of global tracks. Emitter visibility reuses
  globalSequenceId. Wiggle and Paint reuse nodeIndex, and Wiggle reuses nodePivot.
  Preset IPC uses preset:openFile and preset:saveFile, with openPresetFile and
  savePresetFile in the renderer. The updated preset IPC assertion failed on the
  old handlers and passed on the renamed bridge.
- G3 verification: node --test test/model-extents.test.js test/bone-wiggle.test.js
  test/paint-uv-layout.test.js test/settings-presets.test.js
  test/desktop-bridge.test.js test/node-index.test.js test/geoset-extras.test.js
  passed 188 before and 188 after, with zero failures or skips. Direct comparisons
  of computed extents, exclusion and visibility lists, Wiggle matrices, and
  Paint face assignments were identical on the Paint Footman, Tzeentch Knight,
  Mecha-CL and Flail03 fixtures.
- The proposed nameRegion rule would change Paint head detail on real models.
  It adds 26 detailed faces on Tzeentch Knight by recognising the horse neck,
  and 14 on Flail03 by recognising the horse neck, jaw and mouth. Paint's
  original head-name rule stays in use. Only its descendant lookup was shared.
- Built with pnpm exec vite build --configLoader runner and packaged from the
  cached Electron archive. One focused hidden desktop comparison used real
  AnimXL clicks, Heavy and Escape. Before the change the visible cue was at
  layer 2200, below workspace dialogs at 16000. After the change it was above
  that layer and the second Escape closed the tool as before.
- Owner summary: The task index now reflects merged work. The Flail01 safety
  check passes and Flail03 reaches the known case that needs the missing
  reference. Shared rules produced the same model results in the focused
  comparisons. The discard message appears above workspace dialogs.

Claude can review 143236bc and this note locally. The historical case can be
rerun if the exact reference becomes available.