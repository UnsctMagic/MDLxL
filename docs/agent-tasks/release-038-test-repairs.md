# 0.38.0 packaged test repairs

Status: ready for review; awaiting merge approval. Claude release gate remains open for the listed cases; do not merge without owner approval.
Owner: Codex; Claude owns independent release QA.
Updated: 2026-11-04.
Session: codex release-0.38.0 test repairs.

Branch: `codex/release-0.38.0-test-repairs`, based on `3295860ea006d68ef2c362fe202f978cf4f1d2f8` (includes #535 and #537). Initial reproduction used `dd6fd30f`.
Workspace used: `D:\Codex\release-038-tests`; retained report: `D:\Codex\release-038-tests-report`.
Original evidence: `D:\Claude\MDLxL-gate\release-0.38.0-assets\suite`.

The only application change in this PR records up to 100 suppressed informational messages in the existing opt-in test hook. Normal runs record nothing; no messages return to the UI. Tests share `waitForInfo` and a cursor for repeated messages. Warning toasts, saves and model state retain their actual functional assertions. No app bug was patched speculatively.

Test changes follow the approved UI/workflow changes in #474, #477, #485, #491, #492, #504, #506, #507, #521, #525, #526, #528 and #529. They retain real mouse navigation, geometry/history/save checks and image thresholds. No skips were added. The permanent legacy MDX/MDL fixtures were reproduced using source `676aaf6f` and match the exact previously asserted hashes; they live in `D:\Claude\MDLxL-TestModels\fx-legacy`.

## Verification

- `npx vite build`: passed.
- `node --test tests/*.test.js`: 57 passed, 0 failed, 0 skipped.
- `node --test test/*.test.js`: 2799 passed, 0 failed, 10 existing skips (2809 tests).
- `node scripts/package.mjs --out out/pkg`: passed; 1422 runtime/asset files and 55 locales verified.
- Targeted hidden desktop packaged runs: 57 distinct passes; 3 failures and 4 original cases not rerun. See the exact per-test table below.
- The packaged suite was not run in full. No ai-live or real AI tests ran. Claude must perform independent release QA.

After #537 merged during verification, the branch was rebased and affected UI cases were rebuilt and rerun. Other results cover owners unchanged by that merge; each table result names its package revision. The package uses the final main revision plus the opt-in hook. Its source version remains 0.37.2; this repair branch does not bump the release version or replace Claude's 0.38.0 release artifact. Renderer fingerprints are retained in `package-fingerprint.json`.

Original release evidence provides the failing baseline for all 64 cases. A baseline package additionally reproduced eight representative failures before the repair. The new hook test failed first with `recordInfoForTests is not a function`, then passed. No behavior acceptance is inferred from the static suites. Warcraft III/World Editor acceptance and visual taste were not exercised.

## Existing source-suite skips

No skips were added. The unchanged default source run reports:

- SIGTERM-ignoring CLI: POSIX-only check is disabled on Windows.
- Supplied archer armor: `MDLXL_ARCHER` is unset.
- Broken/rebuilt skin-collapse pair: `MDLXL_SKIN_COLLAPSE_BROKEN` and `MDLXL_SKIN_COLLAPSE_REBUILT` are unset.
- Private FX optimization: `MDLXL_FX_MODEL` is unset.
- Two POSE corpus checks (anatomical expectations and source-byte identity): `MDLXL_POSE_CORPUS` / default corpus manifest is absent.
- Dense twin-head rider: `MDLXL_POSE_PERFORMANCE_MODEL` is unset.
- Background symlink escape: this Windows account cannot create symbolic links.
- Accepted Tinker/Brown replay: `MDLXL_SORT_NURGLE` is unset.
- Updater short TEMP path: this volume has no 8.3 short names.

## Reproduction and remaining work for Claude

- **citadel-studio**: open Classic Footman, begin Paint, use 5 starters; select a face, move its UVs in place, Undo/Redo, select the shield part, then click **Separate this part**. Two pre-action decoded images are identical, but post-action decoded pixels differ. The strict image equality remains. See `test/citadel-studio.electron.cjs:34`; later painting/save/orbit checks are not reached in that case. The Paint separation owner was not changed by the release; #477 changed drag scheduling, so the exact regression owner still needs investigation.
- **particle-prototype**: after the Lab/stage, direct-edit, source-context and ribbon checks, choose **New -> Magic glow -> Motion -> Ingredients**. The two decoded thumbnail pixel counts are **237 and 20**; the unchanged assertion requires both to exceed 60. Source Ingredient code is unchanged while GamePreview changed. This needs a render/fixture diagnosis, not a lowered threshold. Later ingredient metadata, export and restart checks remain unexercised.
- **pose-ik — needs Claude decision**: the deliberate body Rotate passes, but the unchanged `commit-false` React callback injection can be replaced by a render before mouse release. The latest run commits instead (revision 29 / undo 17 versus revision 28 / undo 16). `commit-throw` and later assertions are not reached in that run. Rule 2 forbids repairing this by patching React callbacks. The commit path (`commitPose -> edit -> EditorDocument.apply -> HistoryStore`) is synchronous renderer memory, with no main-process/IPC boundary; file locks affect saving, while a parser-read-only document disables the drag. No allowed external trigger preserving these same checks was found. Per the owner's explicit instruction, both fault injections and assertions stay unchanged and failing for Claude's decision. The current shared Move expectation/radius migration is ready to test once this harness blocker is resolved; its old distance assertion failed in the preceding run.
- **citadel-locales**: the Mordor-translated test targets a disabled shelf tile (`agh burzum`, Footman chainmail); both released versions fail in that area. It was not edited or retried with forced clicks.
- **game-file-library**: the 0.38.0 log times out during a screenshot after fonts loaded (line 102). The 0.37.2 log stops earlier at the absent **World Editor Style** control (line 26), so these are distinct failures. No font/screenshot bypass was added; a 0.38.0 code regression is not established.
- **particle-world-effects**: both release logs fail at `path.join(undefined, ...)` because the required `MDLXL_REAL_PROFILE` is absent. No source fallback or fabricated catalogue was introduced.
- **updater-packaged**: the 0.38.0 run closes its page, then cleanup fails with `EBUSY` on `Cache/No_Vary_Search/journal.baj`; 0.37.2 passed. Reported as an environment/lifecycle failure; no retry or lock bypass was added. It was not rerun against a differently versioned repair package.

**POSE baseline distinction:** 0.37.2 stops before the failing body Rotate test, at the absent Workplane Constraints control. Current main reproduced the 12-versus-13 history assertion. #504 treats a Rotate displacement of 5 pixels or less as a click; the repaired test uses a deliberate 12-pixel body Rotate and the current shared Move projection with its displayed handle radius, while preserving native position, planted-foot and history assertions. Its final result is in the table.

## Native data and rerun setup

Browse/layout used a copy of the existing source catalogue in disposable profiles. EMTR's source identity guard correctly rejected the old catalogue identity. A full real index of `D:\Warcraft III` was built into `out/native-fixture/particles` with `node scripts/index-particles.mjs --source "D:\Warcraft III" --output out/native-fixture/particles`; only settings were copied alongside it. It parsed 3500 of 3501 candidates into 5032 recipes, with 443 extraction exceptions and 112 missing dependencies reported by the indexer. This is not a claim that every native asset is valid. All ten EMTR placement checks passed without bypassing the source guard. Owner profiles and the game installation were not edited.

For native recipe tests, set `MDLXL_REAL_PROFILE` to a disposable profile containing a genuine catalogue matching the current game. For Showcase Queue, the existing discovery cache was copied into the worktree profile; all six recordings passed. The repair worktree's `node_modules` was a junction; build, tests, indexing and packaging used tools directly, never `pnpm run`.

All targeted runs used `MDLXL_REAL_PLAYWRIGHT=D:/Claude/tools/node_modules/playwright-core` and `node scripts/run-packaged-tests.mjs default <explicit selection>` on the hidden `MDLxLTests` desktop. FX runs retained all default looks/clips/models. Earlier diagnostic runs used a one-hour outer bound without widening individual Playwright waits. The final intensity run used the unchanged default 900-second outer limit and passed in 155 seconds. Both full motion runs completed in 442/449 seconds. Slider restoration now uses real clicks and arrow corrections with exact UI and committed-preview-value assertions; no runner timeout was changed. Tests with actual mouse rotation passed only after real drags; no programmatic camera replacement counted as proof.

## Per-test decisions

| Test | Cause | Stale or bug | What changed | Result |
| --- | --- | --- | --- | --- |
| alert-ping | #529 tab strip and #485 warning toasts | stale | Verify current tablist, toast flash/ping/repeat/fade and quiet info | PASS (15s; dd6fd30f) |
| animation-effects | #485 suppresses routine status messages | stale | Use shared read-only info observer; retain all functional checks | PASS (7s; dd6fd30f) |
| animations-sidebar | Async mode selection sampled before render | stale | Wait for actual panel visibility; keep toolbox/camera checks | PASS (4s; dd6fd30f) |
| appearance | #528 interface color set owns Compact Set color | stale | Assert new owned color/style and exact unrelated palette preservation | PASS (6s; dd6fd30f) |
| attachemator | #485 suppresses routine status messages | stale | Use shared read-only info observer; retain all functional checks | PASS (10s; dd6fd30f) |
| citadel-library | #506 Library defaults to World Editor Style | stale | Choose existing Standard view for arbitrary/model-folder searches | PASS (18s; 3295860e) |
| citadel-locales | Mordor Footman chainmail button disabled in 0.38.0; the same test also fails on 0.37.2 | old cause | No edits; report disabled-button timeout | Not rerun; release evidence retained |
| citadel-studio | Image changes after Separate this part; repeated pre-action captures are identical | app/render bug (unresolved) | Keep strict decoded pixel equality and stability proof; migrate opening info only | FAIL (7s; dd6fd30f) |
| dummy-bone | #485 suppresses routine status messages | stale | Use shared read-only info observer; retain all functional checks | PASS (4s; dd6fd30f) |
| emtr-add-like-ribbons | Release run omitted MDLXL_REAL_PROFILE; existing catalogue has older game identity | setup + stale output path | Genuine current-game catalogue in scratch; put placement report in existing test out directory; preserve all 10 functional checks | PASS (120s; 3295860e) |
| event-animation-frame | #485 suppresses routine status messages | stale | Use shared read-only info observer; retain all functional checks | PASS (3s; dd6fd30f) |
| event-focus | #485 suppresses routine status messages | stale | Use shared read-only info observer; retain all functional checks | PASS (4s; dd6fd30f) |
| event-sound-scroll | #485 suppresses routine status messages | stale | Use shared read-only info observer; retain all functional checks | PASS (3s; dd6fd30f) |
| footprint-travel | #485 suppresses routine status messages | stale | Use shared read-only info observer; retain all functional checks | PASS (29s; dd6fd30f) |
| forge-detail-editing | #504 Rotate follows painted plane tangent | stale | Drag along displayed direction; preserve live fit and exact history | PASS (129s; dd6fd30f) |
| forge-shape-hotkeys | #474 native icons replace lucide/gold class | stale | Assert native drawing class; retain icon counts/layout/keys/geometry | PASS (21s; dd6fd30f) |
| fx-empty-emitters | Old fixture rebuilt with current compiler; #492 emitter-only exception | stale | Use exact-hash 676aaf6f files; verify intended default and all save roundtrips | PASS (41s; 3295860e) |
| fx-owner-intensity | #492 removes unadded particles from visible layers; old restoration takes 924s, exceeding the default 900s outer budget | stale | Select exact labelled row; real slider click/key restoration with exact committed-value assertions; retain all 60 min/middle/max cases | PASS (155s; 3295860e) |
| fx-owner-motion | #492 owns clocks by index and leaves the emitter-free Briar default static | stale | Require owned clocks for animated looks; assert Briar is static and capture its native clip clock; retain every look/clip/frame/orbit | PASS (442s; 3295860e) |
| game-file-library | 0.38.0 screenshot stalls after fonts loaded; 0.37.2 stops earlier at absent World Editor Style | environment (unresolved) | No font/capture workaround; report both distinct release-run failures | Not rerun; release evidence retained |
| geoset-duplicate-open | #485 moves actionable warnings to toasts | stale | Target exact toast action and toast styling; preserve repairs/save | PASS (19s; dd6fd30f) |
| geoset-merge-conflicts | #485 warning toast and stale state/focus probes | stale | Read document hook; real keyboard focus; visible warning; no dirty mutation | PASS (4s; dd6fd30f) |
| geoset-operations | #485 suppresses weld/free-vertex info | stale | Use observer; retain topology/no-op/history checks | PASS (4s; 3295860e) |
| keyframe-delete | #485 removed Modified text; old save wait returned before disk write | stale | Wait for actual document clean state before reading saved bytes | PASS (4s; dd6fd30f) |
| light-dark-shortcut | #485 hides look-switch info | stale | Observe info; retain palettes and restart checks | PASS (6s; dd6fd30f) |
| localization | #485 moves actionable warnings to toasts | stale | Target exact toast action and toast styling; preserve repairs/save | PASS (19s; 3295860e) |
| manager-simplification | #485 suppresses routine status messages | stale | Use shared read-only info observer; retain all functional checks | PASS (16s; dd6fd30f) |
| model-tabs | #529 adds tablist; #485 copy info | stale | Count Open models tabs; observe copy; preserve handoff/paste/renderer/close | PASS (5s; dd6fd30f) |
| motion-inspector | #485 removed Modified text; old save wait returned before disk write | stale | Wait for actual document clean state before reading saved bytes | PASS (8s; dd6fd30f) |
| movement-chain-focus-speed | #485 copy info; #526 Playback Speed label width | stale | Observer plus fitted label, two 48px rows and unchanged 35px number input | PASS (7s; dd6fd30f) |
| movement-create-ribbon-reentry | #485 suppresses routine status messages | stale | Use shared read-only info observer; retain all functional checks | PASS (7s; dd6fd30f) |
| movement-gizmo | Broad yellow threshold counted antialiased label edges (74 vs 72) | stale | Measure exact #fff14e; keep strict idle equality and all drag/Undo checks | PASS (57s; dd6fd30f) |
| node-effect-controls | #485 opening; #521 Bones master; #525 View parity | stale | Migrate exact controls/menu presence; retain native effect checks | PASS (131s; dd6fd30f) |
| normalizer | #485 hides NormalsXL completion info | stale | Observe info; neutral real click for Undo; preserve normals and both formats | PASS (5s; dd6fd30f) |
| object-types | #521 Bones/Helpers context menu and VIS Clear | stale | Exercise type menu/master/Refs separately; retain colors/drags/persistence | PASS (18s; dd6fd30f) |
| optimizexl-cleanup | #507 x2 default; real fixture has zero authored shapes | stale | Assert zero source shapes and two exact standard spheres | PASS (6s; dd6fd30f) |
| particle-assets | #491 tree/full-clip placement; #485 info | stale | Use collection-scoped tree rows, Visibility/Create; retain assets/history/emission | PASS (7s; 3295860e) |
| particle-feedback | #485 opening; #526 speed; #521 Bones master | stale | Migrate controls; retain animated parent, visibility and geometry checks | PASS (7s; dd6fd30f) |
| particle-library-browse | Release run omitted MDLXL_REAL_PROFILE; existing catalogue has older game identity | environment | Copy catalogue into scratch; preserve source guard; prepare genuine current-game index | PASS (81s; 3295860e) |
| particle-library-layout | Release run omitted MDLXL_REAL_PROFILE; existing catalogue has older game identity | environment | Copy catalogue into scratch; preserve source guard; prepare genuine current-game index | PASS (69s; 3295860e) |
| particle-main-rig | #485 opening; #491 Create label | stale | Observe readiness and Create; retain static rig/edit/attach/Undo | PASS (5s; dd6fd30f) |
| particle-motion-tab | #485 opening info | stale | Observe readiness; retain authored motion checks | PASS (4s; dd6fd30f) |
| particle-parent | #485 opening; #526 speed; #521 Bones master | stale | Migrate controls; retain animated parent, visibility and geometry checks | PASS (7s; dd6fd30f) |
| particle-picture | #506 Library defaults to World Editor Style | stale | Choose existing Standard view for arbitrary/model-folder searches | PASS (17s; 3295860e) |
| particle-prototype | #485 opening; #491 tree/placement; #526 speed; #477 frame-coalesced edits; both ingredient captures fail the unchanged recognizable-glow threshold (237, 20; each must exceed 60) | stale + unresolved render bug | Copied source fixture; current controls/live readiness; preserve strict image threshold and report remaining failure | FAIL (33s; 3295860e) |
| particle-ribbon-fit | #491 rejects empty visibility; #526 speed; #485 opening | stale | Assert disabled Create with no clips; retain fitting/emission/history and real seeking | PASS (42s; dd6fd30f) |
| particle-workflow | #491 tree/full-clip placement; #485 info | stale | Use collection-scoped tree rows, Visibility/Create; retain assets/history/emission | PASS (14s; 3295860e) |
| particle-world-effects | Missing required source profile (path.join undefined), also on 0.37.2 | old environment | No fallback or fabricated source; report original setup failure | Not rerun; release evidence retained |
| pose-complex | #485 hides Saved info (older tests also failed on 0.37.2) | stale | Observe save, cursor for repeats; retain real GIF/native-save/content checks | PASS (60s; dd6fd30f) |
| pose-ik | #504 Rotate click distance and shared Move projection replaced the old gesture calculation; 0.37.2 stops earlier at missing Workplane Constraints. Existing commit-false/throw fixtures patch React callbacks, race renders and violate rule 2 | stale; needs Claude decision | Deliberate 12px Rotate; use current Move API and displayed radius; retain exact native position, history and planted-foot checks; leave both fault injections and assertions unchanged (owner instruction), report their failure | FAIL (126s; dd6fd30f) |
| ribbon-track | #491 rejects empty visibility; #526 speed; #485 opening | stale | Assert disabled Create with no clips; retain fitting/emission/history and real seeking | PASS (31s; dd6fd30f) |
| showcase | #485 hides Saved info (older tests also failed on 0.37.2) | stale | Observe save, cursor for repeats; retain real GIF/native-save/content checks | PASS (42s; dd6fd30f) |
| showcase-layout | #485 hides Saved info (older tests also failed on 0.37.2) | stale | Observe save, cursor for repeats; retain real GIF/native-save/content checks | PASS (78s; dd6fd30f) |
| showcase-queue | #526 Playback Speed label; worktree discovery fixture | stale + setup | Current label and existing copied discovery cache; retain six real recordings | PASS (60s; dd6fd30f) |
| showcase-recording-particles | #485 hides Saved info (older tests also failed on 0.37.2) | stale | Observe save, cursor for repeats; retain real GIF/native-save/content checks | PASS (7s; dd6fd30f) |
| sort-my-mess | #485 suppresses routine status messages | stale | Use shared read-only info observer; retain all functional checks | PASS (7s; dd6fd30f) |
| sprite-frames | #485 suppresses routine status messages | stale | Use shared read-only info observer; retain all functional checks | PASS (5s; dd6fd30f) |
| tree-appearance | #485 suppresses routine status messages | stale | Use shared read-only info observer; retain all functional checks | PASS (5s; dd6fd30f) |
| updater-packaged | EBUSY unlink Cache/No_Vary_Search/journal.baj | environment | No bypass/retry added; report release-run locked-cache failure | Not rerun; release evidence retained |
| uv-material-settings | #506 Library defaults to World Editor Style | stale | Choose existing Standard view for arbitrary/model-folder searches | PASS (17s; 3295860e) |
| uv-preview-edit-constraints | #485 suppresses routine status messages | stale | Use shared read-only info observer; retain all functional checks | PASS (12s; 3295860e) |
| vis-mdlvis-mode | #485 tabs/top strength/hint; async key result | stale | Assert current layout and active model, actual mouse/keys and unchanged hashes | PASS (35s; 3295860e) |
| visual-effects-review | #492 owns clocks by index and leaves the emitter-free Briar default static | stale | Require owned clocks for animated looks; assert Briar is static and capture its native clip clock; retain every look/clip/frame/orbit | PASS (449s; 3295860e) |
| zoom-align | #485 hides Align/Anchor info | stale | Observe info; preserve colored markers, drag math and exact Undo | PASS (6s; dd6fd30f) |
