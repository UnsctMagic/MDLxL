# One camera for every side-by-side compare view

Status: ready for review; awaiting merge approval
Owner / consolidator: Codex
Updated: 2026-11-01

## Goal and completion criteria

Owner request (verbatim): "in view points where i see both (e.g optixl) where i need to compare - i want 1 camera control for both, if i move one side the other mirrors."

- Every simultaneously visible live 3D comparison shares one always-on camera. Rotation, pan and zoom from either pane mirror live, during the drag, every drawn frame.
- Reuse AnimXL's existing `GamePreview compareCamera` bus (`{ saved, listeners: Set }`), one ref per pair, fresh when a pair/model/session opens. Both panes use `preserveCameraView`; the first seeds the view and the second adopts it.
- Keep framing equal for differently sized versions. OptimizeXL's After rebuild/revision must adopt the shared view rather than independently fitting. Existing Fit/view commands, where present, apply to both panes.
- Normal mouse rotation works on both sides. No new props, controls, settings, layout or wording. Change GamePreview only if an actual bus gap is demonstrated; retain AnimXL behavior.
- Sweep `app/` including AI versions and AiAssistant. Static images (including ParticleExampleComparison) and ShapingDialog's single Original toggle are excluded.
- Hidden packaged Electron verification: left/right real mouse drags with assertions while held, pan, wheel zoom, OptimizeXL After rebuild, and related OptimizeXL, Sort My Mess and AnimXL tests. Build and full source suite must introduce no failures beyond `.github/known-test-failures.txt`.
- Push `codex/synced-compare-camera`, open a PR into main with `Session: codex <this chat>`, report ready to test, and await merge approval.

## Revision and local state

- Branch / checkout: `codex/synced-compare-camera`; `D:\Codex\synced-compare-camera`.
- Base / checked revision: current origin/main at setup, `eb364705a285c9fbd6f0c8b5feadd8f30a5e7d33`; regression implementation commit `1308652c`. PR: [#487](https://github.com/UnsctMagic/MDLxL/pull/487), open and unmerged.
- Scope: packaged camera regression, this note/index, and relevant project-map rows. No product-code edit is warranted by the verified baseline.
- Fixture: permanent Blizzard classic SD Footman, `test/helpers/fixtures.cjs` `fixturePath('citadel-footman')`, under `D:\Claude\MDLxL-TestModels`. Development dependencies linked by junction to `D:\Claude\MDLxL\node_modules`.

## Relevant owners

- `app/GamePreview.jsx`: cameraChanged broadcasts snapshots; receiveCamera adopts them without rebroadcast; setup/cleanup joins/leaves the bus. `preserveCameraView` keeps rebuilds stable.
- `app/OptimizeXL.jsx`: one `camera` ref; shared `previewProps` already passes the bus and preservation to Original/After.
- `app/SortMyMess.jsx`: one `camera` ref; shared `common` already passes the bus and preservation to Before/After. `frameKey` frames a newly opened texture group.
- `app/AnimXL.jsx`: reference implementation; Side by side resets `cameraBus`, then both live previews use it and preserve the camera.
- `test/compare-camera.electron.cjs`: new hidden packaged regression; shared app/fixture/fiber-probe helpers.

## Findings and decisions

- Verified on the requested fresh main: the handover's two "missing" integrations are already implemented. OptimizeXL has used the bus since `fe0b0c58`; Sort My Mess since `d08b16e8`. Both already preserve the camera. No new wiring or GamePreview change is needed.
- Live compare pairs found: OptimizeXL Before/After; Sort My Mess Before/After; AnimXL Original/AnimXL. All three are covered by the new real-mouse test.
- AI `app/ai-editor.js` `mdlxl_versions` calls `src/ai-versions.js`: save/list/compare return stored-model differences, not live panes. `AiAssistant.jsx`/`AiParts.jsx` render conversation content; `AiOffscreenRender.jsx` queues one hidden renderer for captured pictures. No live pair to wire.
- ParticleExampleComparison and ParticleBlendComparisons display captured images produced by one hidden renderer. ParticleIngredients/ParticleThumbnailQueue are also hidden thumbnail renderers. ParticleTestView/SourceContext/PlacementStage are single-view tools, not comparison pairs.
- App's vertex/animation views and BitsAndParts replacement/source branches are mutually exclusive; Forge quad view is an editor's different projections, not a Before/After comparison. Other preview owners have one live preview. ShapingDialog's Original toggle stays out of scope.
- Decision: retain working product code and add regression proof/documentation. Do not invent a change merely because the supplied handover predates current main.

## Changes and verification

- Added read-only camera probes and real Playwright mouse input. The new regression compares position, orientation, up vector, orbit target, zoom and perspective field of view. It checks each held-drag step, both rotation/pan directions, both wheel origins, matching initial framing, After revision replacement, and reopened AnimXL comparison.
- Baseline: the new regression passed on the unmodified `eb364705` package for all three pairs. There is no failing-on-old-main product assertion: the requested wiring already exists. Negative control: disable only camera broadcasting in the disposable packaged GamePreview chunk, then restore its exact bytes. The test fails before mouse-up: `left drag from left, held step 1: camera component 0: 72.60307040128357 vs 193.80314596718202`. This validates the regression, not a claim that current main was broken. The restored final package passes.
- Build: `pnpm run build` passed; baseline package verified 1,365 runtime/asset files and 55 locale files.
- Final hidden packaged checks: **6 pass / 0 fail / 0 skip**: `compare-camera`, `optimizexl-preview`, `optimizexl-playback`, `sort-my-mess`, `anim-xl`, `anim-xl-filmstrip`. Command: `node scripts/run-packaged-tests.mjs default <comma-separated names>` with `MDLXL_REAL_PLAYWRIGHT=D:\Claude\tools\node_modules\playwright-core`. Only these packaged checks were run; no full packaged suite. All used the separate invisible `MDLxLTests` desktop.
- `pnpm run test:source`: **2,610 pass / 0 fail / 10 skip**, 2,620 tests. No new failure; `.github/known-test-failures.txt` is empty and unchanged. Initial scratch-environment failures were resolved by using the helper's default D: `out/tmp` (which supplies its CommonJS scope); `TEMP`/`TMP` still point to D:. No test or product fix was made for that setup issue.
- Source skips are existing opt-ins/platform conditions: SIGTERM-ignoring CLI (Windows); archer material input (`MDLXL_ARCHER` unset); broken/rebuilt skin-collapse pair (two input variables unset); private Fx (`MDLXL_FX_MODEL` unset); anatomical corpus and corpus-source hash checks (two tests, corpus manifest unset); dense twin-head rider (`MDLXL_POSE_PERFORMANCE_MODEL` unset); background symlink confinement (Windows account cannot create symlinks); accepted Tinker/Brown Magnataur replay (`MDLXL_SORT_NURGLE` unset); updater short-path check (volume has no 8.3 names).
- Final camera regression also asserts that the After runtime object actually changed, then compares the preserved cameras and rotates from the rebuilt right pane. Final bundle: index SHA256 `c1cdbd7233a934f6e90d483f2248ab46dad82304da5f264457c58ed23c8efdbc`, assets SHA256 `dfa6cc7222c0a999b5dbfa181a885af6c5ec3d951b26b3eb6ff6aa426396e1af`.
- Small local evidence is retained under `D:\Codex\synced-compare-camera-results`; disposable package, profiles, generated fixtures, runtime staging, caches and dependency junction are removed at handover. Task-started processes are checked for exit.
- Remaining acceptance: owner click-through and independent Claude QA, as required by `docs/TESTING-RULES.md`; Warcraft III is not exercised by this camera/UI task.

## Blockers and next action

- No product blocker. PR #487 is open, attached to this Codex chat and mergeable; CI was running at handover. Tests are ready for independent review; awaiting merge approval. The PR is intentionally tests/docs only because current main already implements the requested behavior. Small result evidence is retained; the pushed disposable checkout is removed at handover.
- Owner click-through: (1) Open OptimizeXL. (2) Drag its left preview. (3) Watch the right preview follow live. Ready to test after PR handover; awaiting merge approval.
