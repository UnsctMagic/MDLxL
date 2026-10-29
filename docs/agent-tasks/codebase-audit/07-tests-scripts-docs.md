# Audit 07: tests, scripts, CI and agent docs

Revision: `origin/main` at `fe46a534`, worktree `D:\Claude\MDLxL\.claude\worktrees\codebase-audit`. This audit was read-only. The only command run was `node --test tests/*.test.js` (57/57 pass). Everything else is static: grep, small node scanners in the session scratchpad, and `gh pr list` for PR states.

Inventory: `test/` holds 504 entries: 287 `*.test.js`, 187 `*.electron.cjs`, 2 `*.browser.cjs`, 1 plain `.cjs` and 27 others. `tests/` holds 2 files (57 tests). `scripts/` holds 16 files plus `sd-trial/`. There are 3 workflows. `.github/known-test-failures.txt` has 0 entries.

## Summary table

| # | Finding | Severity |
|---|---|---|
| T1 | "Packaged" suite actually drives the dev Electron for ~99 of 164 runnable harnesses (20 of 28 CORE); 19 different exe env-var names | **High** |
| T2 | No shared harness helper; launch/window/profile/error/fiber boilerplate copied into 160+ files | Medium |
| T3 | React-fiber state probes hand-written in 130 harnesses | Medium |
| T4 | Two fragment modules run as standalone "passing" tests | Medium-low |
| T5 | Two CDP harnesses bypass Playwright, so variants do nothing for them | Low |
| T6 | Stale runner entry `forge-glow` (file renamed to glow-up) | Low |
| T7 | Model/track/key/approx/fixture factories duplicated across `*.test.js` | Medium-low |
| T8 | Temp dirs on the system temp (C: on the owner's PC) in 25 source tests + package/fetch scripts, against the AGENTS "everything on D:" rule | Medium |
| T9 | Hive viewer `vm.runInThisContext` loader copied 19x with the version in the path | Low-medium |
| T10 | Manual/private-model scripts and HTML pages mixed into `test/`; `uv-camera-check` orphaned | Low |
| T11 | Two fixture homes (`fixtures/` and `test/fixtures/`) and hard-coded `D:/Warcraft III` | Low |
| T12 | 13 source tests always skip in CI; their fixture env names differ from the runner's | Low/info |
| T13 | No orphaned imports, missing modules or duplicate test titles (checked) | Clean |
| T14 | Baseline file is empty, so it hides nothing | Clean |
| S1 | Scripts: repo-root, sha256 and Playwright resolution each re-implemented; FFmpeg check duplicated | Low |
| S2 | package.json: `test` == `test:compatibility`; source glob defined twice; engines `>=20` vs documented 22.12+ | Low |
| S3 | Stale `package-lock.json` (0.28.1) beside the real `pnpm-lock.yaml` | Medium-low |
| C1 | CI and release workflows duplicate 7 setup/build steps | Low |
| C2 | Discord workflow hard-codes a `v0.21.2` exception | Low |
| D1 | `docs/agent-tasks/README.md` "Current tasks": 9 of 10 rows are already merged | **High** (for agents) |
| D2 | 15 task notes still say "ready for review" or "unmerged" although their PRs are merged | Medium |
| D3 | agent-map: all 243 links and all 48 named symbols verified OK; two overlapping AI rows | Low |
| D4 | PACKAGED-TESTS.md says "mostly the packaged MDLxL.exe" (false, see T1) | Medium |
| D5 | Small contradictions (README "full suite", CLAUDE "at release", archive matching method) | Low |
| D6 | Broken anchors/links in topic guides (COMMUNITY_RESEARCH 25, RELEASE-HISTORY-LEGACY 17) | Low |
| D7 | Historical notes name 13 deleted files | Info |
| D8 | README version/summary agrees with package.json 0.35.0 | Clean |

---

## Tests

### T1. The packaged suite mostly tests the dev build, through 19 different "which exe" variables. High

`scripts/run-packaged-tests.mjs` runs every `test/*.cjs`. It points tests at the packaged `MDLxL.exe` only through the per-test `SPECIAL` table (lines 38-71). Each harness picks its own env-var name for "the exe" and falls back to `node_modules/electron/dist/electron.exe` + repo root (the dev `dist/`).

Env-var names read by harnesses (count of reads):

| Variable | Reads |
|---|---|
| `MDLXL_ELECTRON_PATH` | 54 |
| `MDLXL_TEST_EXE` | 28 |
| `MDLXL_OPTIMIZEXL_EXE` | 17 |
| `MDLXL_AI_TEST_EXE` | 12 |
| `MDLXL_POSE_EXE` | 11 |
| `MDLXL_TEST_PACKAGE` | 7 |
| `MDLXL_PACKAGED_EXE`, `MDLXL_EXE`, `MDLXL_APP` | 3 each |
| `MDLXL_ANIMXL_EXE`, `MDLXL_ANIMXL_APP` | 2 each |
| `MDLXL_TEST_FULL_PACKAGE`, `MDLXL_SORT_EXE`, `MDLXL_PLAYBACK_EXE`, `MDLXL_INPUT_PATH`, `MDLXL_GATE_PACKAGE`, `MDLXL_DUPLICATE_EXE`, `MDLXL_BROWSER_EXE` | 1 each |
| `MDLXL_SUITE_PKG` (the runner's own variable; the newest harnesses read it directly) | 6 files |

Cross-checking each harness against `SPECIAL` shows **99 harnesses that launch the dev Electron during `pnpm run test:packaged`** (full list in Appendix R). Examples:

- `test/startup.electron.cjs` uses `executablePath: path.join(root, 'node_modules/electron/dist/electron.exe')`, with no override at all.
- `test/citadel-studio.electron.cjs:10` reads `process.env.MDLXL_ELECTRON_PATH||…electron.exe`. But `run-packaged-tests.mjs:70` gives the citadel tests only `MDLXL_PAINT_FIXTURE`.
- `test/optimizexl-preview.electron.cjs` reads `MDLXL_OPTIMIZEXL_EXE`. The runner sets that only for `optimizexl-workflow` (line 59).
- `test/workplane-free-drag.electron.cjs:15` reads `MDLXL_EXE`. The runner sets it only for `object-types` (line 51).
- `test/light-dark-shortcut.electron.cjs:12`, `updater.electron.cjs:31` and `showcase-recording-particles.electron.cjs:11` read `MDLXL_TEST_EXE`, which is not set for them.
- `alert-ping.electron.cjs:12` reads `MDLXL_TEST_PACKAGE`, which is not set for it.
- `game-file-library.electron.cjs:16` and `hd-library-preview.electron.cjs:10` read `MDLXL_PACKAGED_EXE`, which the runner never sets.

20 of the 28 `CORE` tests (line 86), the ones "worth running under every variant", run on the dev build: startup, appearance, quad-view, grabthrough, movement-chain-focus-speed, animation-speed, animations-sidebar, timeline-scrub, uv-preview-picking, uv-tab-window, citadel-studio, showcase, showcase-camera, particle-workflow, particle-picture, portrait-authoring, vertex-rgb-preview, tree-appearance, bone-tools, optimizexl-preview.

So `MDLXL_SUITE_PKG=<unzipped release>` (the `release` variants) does not test the release for most of the suite. AGENTS.md says "Verify actual mouse drags in the packaged app".

**Fix.** Add one helper, `test/helpers/app.cjs` → `appTarget()`. It returns `{ executablePath, args }` from a single variable: either `MDLXL_TEST_EXE`, or `MDLXL_SUITE_PKG`, already used by `ai-organiser-refresh.electron.cjs:13`, `model-manager-regressions.electron.cjs:18`, `vis-mdlvis-mode.electron.cjs:12` and `movement-create-ribbon-reentry.electron.cjs:25`. Its fallback is dev Electron + root. The runner then sets that one variable for every test, and most of `SPECIAL`'s exe entries (lines 39-69) disappear. Tests that intentionally need the dev build (wrapper entries that stub `electron/main.cjs`, see Appendix J) opt out explicitly.

**Risk.** Medium. Some harnesses rely on dev-only behaviour (stubbed main, `dist/` paths), so they must be moved one at a time and run under `default` before and after. Expect new real failures once the packaged exe is actually under test.

### T2. No shared harness helper; the same boilerplate is copied into 160+ files. Medium

No `test/helpers/` exists. The only cross-file requires are `rotation-interaction.electron.cjs:106,295-296`, which pull in two fragments (see T4). Every harness re-implements the same pieces. Counts are files (first file:line per file in Appendix A-L):

| Snippet | Files |
|---|---|
| A. `require(process.env.MDLXL_PLAYWRIGHT_MODULE \|\| 'playwright')` | 162 |
| B. dev fallback `node_modules/electron/dist/electron.exe` | 127 |
| C. off-screen window `setPosition(-3000,0)` / `x:-3000` | 79 |
| D. `setBackgroundThrottling(false)` | 163 |
| — `showInactive()` | 110 |
| — `--disable-backgrounding-occluded-windows` | 113 |
| E. `MDLXL_PROFILE: path.join(out,'profile-'+Date.now())` style throwaway profile | 186 (only 10 delete it afterwards) |
| F. `page.on('pageerror', e => errors.push(...))` | 155 |
| H. native dialog stubs `dialog.showSaveDialog=` / `showOpenDialog=` / `showMessageBox(Sync)=` | 44 |
| I. application-menu walk `Menu.getApplicationMenu()` + flatMap | 7 |
| K. local sha256 `createHash('sha256').update(fs.readFileSync(..))` | 34 |
| L. local `settle = () => page.waitForTimeout(n)` | 26 (405 `waitForTimeout` calls in 109 files) |
| — `app.close()` in `finally` | only 39 of 181 |

Whole blocks are also copied between harness families (from the existing `out/audit/dupscan-tests.txt`):

- `test/pose-complex.electron.cjs:22-110` ↔ `test/pose-setup.electron.cjs:22-110`: 77 identical lines.
- `pose-ik.electron.cjs:32-51` ↔ `pose-ragdoll.electron.cjs:32-51` (17 lines). The same 11-line launch block also appears in `movement-gizmo`, `movement-gizmo-layout`, `pose-complex`, `pose-performance`, `pose-setup` and `pose-view`.
- `citadel-edges.electron.cjs:5-24` ↔ `citadel-flow` ↔ `citadel-locales` (17 lines each).
- `ai-live-tabs.electron.cjs:34-51` ↔ `ai-live.electron.cjs:34-51`.
- `uv-grabthrough.electron.cjs:31-44` ↔ `uv-preview-picking.electron.cjs:34-47`.

**Fix.** Add `test/helpers/app.cjs` with:

- `launchApp({ fixture, out, args, env })`: target (T1), isolated profile under `out/`, headless env, hidden window bounds, throttling off, `pageerror` collector.
- `stubDialogs(app, { save, open, message })`
- `clickMenu(app, id)`
- `sha256File(path)`
- `settle(page, ms)`
- `closeApp()`, which removes the profile.

Start with the pose family (8 files), citadel (10) and ai (12). `scripts/playwright-variant.cjs` keeps owning variants, and `launchApp` loads Playwright through it.

**Risk.** Low per file if migrated family by family with a before/after `test:packaged <names>` run. Do not do a big-bang rewrite: each harness has subtle per-test env (`MDLVIS_HEADLESS: ''` for the AI tests, `run-packaged-tests.mjs:67`).

### T3. React-fiber state probes hand-written in 130 harnesses. Medium

`__reactFiber` appears in 130 files (197 lines). The app exposes no test hook (`window.__*` returns nothing in `app/` and `src/`). Each harness walks `fiber.return` / `memoizedState` with its own predicates. Examples:

- `test/pose-ik.electron.cjs:28` (`window.poseProbe`), copied verbatim in `pose-console.electron.cjs:28-50` ↔ `pose-copy-body.electron.cjs:29-51`.
- `test/citadel-studio.electron.cjs:14` (`window.audit`, 8 files use that name).
- `portraitRuntime` (2 files), `showcaseFiber`, `queueFiber`, `footprintRuntime`, `emitterDoc`, `rotationUV`.

A React upgrade or a hook-order change breaks all of them at once.

**Fix.** Add `test/helpers/fiber-probe.cjs`, exporting a page-side `findFiberState(selector, predicate)` that is installed once by `launchApp`. Harnesses then keep only their predicates. An app-side test hook would be cleaner but adds product code, so ask the owner first.

**Risk.** Low. Probe-only code, no product change.

### T4. Fragment modules run as standalone "passing" tests. Medium-low

- `test/rotation-local.electron.cjs:2`: `module.exports = async function rotationLocal({ app, page, check, settle, snap, menu, waitMatrix }) {`
- `test/rotation-editors.electron.cjs:2`: `module.exports = async function rotationEditors({ app, page, check, out }) {`

Both are required by `rotation-interaction.electron.cjs:106,295-296`. The runner globs every `test/*.cjs` (`run-packaged-tests.mjs:89`), so each fragment is also spawned alone. It only defines `module.exports`, exits 0, and is recorded as a pass, which inflates the counts.

**Fix.** Rename them to `test/helpers/rotation-local.cjs` / `rotation-editors.cjs`, or add them to `SKIP`.

**Risk.** None.

### T5. Two harnesses bypass Playwright, so variants are silently ignored. Low

- `test/geoset-operations.electron.cjs:55`: `spawn(path.join(root, 'node_modules/electron/dist/electron.exe'), ['--disable-gpu', `--remote-debugging-port=${port}`, root, fixture]`
- `test/uv-controls.electron.cjs:27`: same scheme.

They talk raw CDP over `net`/`http`, so `MDLXL_VARIANT_ARGS` and `MDLXL_VARIANT_CPU` never apply, and they always force `--disable-gpu`. Their no-gpu/hidpi/slow-cpu results duplicate the default ones. They are also the only 2 of 187 harnesses without a Playwright require.

**Fix.** Port them to `launchApp`.

**Risk.** Low.

### T6. Stale runner entry. Low

`scripts/run-packaged-tests.mjs:64` lists `'forge-glow'`. No `test/forge-glow.electron.cjs` exists: commit `044647d9` ("Glow Up moves to EMTR…") replaced it with `glow-up`. It is harmless under `all`, but a named run reports `missing`. Every other `SPECIAL`/`SKIP`/`CORE` name resolves to a file.

**Fix.** Delete the entry.

### T7. Fixture and assertion factories duplicated across `*.test.js`. Medium-low

Counts are files (first lines in Appendix M-Q):

- **Track factory** `const track = …`: 22 files with 22 different signatures. Examples:
  - `animation.test.js:7` `(Keys, LineType = 1) => ({ Keys, LineType })`
  - `classic-keyframes.test.js:7`, `keyframe-timeline.test.js:12` and `optimizexl-checker-repairs.test.js:17` share an identical `(Keys, LineType = 1, GlobalSeqId = null)`
  - `movement.test.js:14` and `pose-ik.test.js:18` share `(...keys) => ({ LineType: 1, …Float32Array })`
  - `auto-corpse.test.js:10`, `model-optimizer.test.js:10`, `sequence-reorder.test.js:10` …
- **Keyframe factory** `const key = (Frame, Vector) => ({ Frame, Vector: new Float32Array(Vector) })`: 13 files (`animation-options.test.js:8`, `sequence-editor.test.js:9`, `optimizexl-cleanup-visibility.test.js:10`, `animation-tracks.test.js:11` …).
- **Approx-equal**: 19 local definitions (`near`/`close`/`closeTo`, for example `animation.test.js:8`, `movement.test.js:12`, `final-viewport.test.js:22`, `pose-ik.test.js:24`, `uv-grid.test.js:6`) with epsilons from 1e-6 to 2e-5. There are also **222 inline `assert.ok(Math.abs(` in 80 files**.
- **Minimal model builders** `function fixture()`: 47 files. Several hand-build `{ Sequences:[{Interval:[100,1000]}], GlobalSequences:[], Bones:[…] }` (`movement.test.js:16`, `movement-rest-pose.test.js:13`, `movement-billboard.test.js:13`, `portrait-model-control.test.js:7`).

**Fix.** Add two files:

- `test/helpers/model-fixtures.js`: `key`, `track`, `bone`, `sequence`, `minimalModel(overrides)`.
- `test/helpers/assert-near.js`: `assertNear(a, b, eps)`, `assertVecNear`.

Adopt them when a file is next touched; do not mass-rewrite.

**Risk.** Low. Keep each test's epsilon explicit so that tolerances do not silently change.

### T8. Temporary files on C:, against AGENTS.md. Medium

AGENTS.md:34-35: "keep all task-controlled work, builds, caches, temporary files and reports on D:".

- 25 `*.test.js` use `mkdtemp(path.join(os.tmpdir(), …))` (Appendix P; 35 call sites). `pnpm run test:source` does not redirect `TEMP`. Only the packaged runner does (`run-packaged-tests.mjs:148`).
- `scripts/package.mjs:160-161` stages the whole package in `os.tmpdir()`.
- `scripts/fetch-ffmpeg.mjs:40` uses `os.tmpdir()` too.

On the owner's PC the temp folder is `C:\Users\PC\AppData\Local\Temp`. By contrast, harnesses write to `out/`, which is fine.

**Fix.** Add `test/helpers/temp.js` → `tempDir(prefix)`, rooted at `MDLXL_TEMP || out/tmp`. Give `package.mjs` and `fetch-ffmpeg.mjs` an `out/tmp` default, or honour `MDLXL_TEMP`.

**Risk.** Low. On CI, `out/` is inside the checkout, which is fine.

### T9. Hive viewer loader copied 19 times. Low-medium

`vm.runInThisContext(fs.readFileSync(new URL('../public/vendor/hive-viewer-5.12.0.js', import.meta.url), 'utf8'))` appears in:

- 4 source tests: `test/sanity-check.test.js:10`, `optimizexl-bounds.test.js:11`, `optimizexl-checker-repairs.test.js:13`, `optimizexl-diagnostics.test.js:10`, `optimizexl-format.test.js:11`, `optimizexl-spline-tracks.test.js:14`.
- 2 harnesses: `optimizexl-bounds.electron.cjs:7`, `optimizexl-workflow.electron.cjs:9`.
- 10 manual `.mjs` scripts (`optimizexl-*-models.mjs`, `optimizexl-footman.mjs:8`).
- `scripts/check-sanity-corpus.mjs:10`.

Updating the vendored version breaks 19 files. The before/after `new ModelRenderer(structuredClone(before)) … (after)` pose comparison is also repeated in 9 `optimizexl-*-models.mjs`.

**Fix.** Add `test/helpers/hive.mjs` (`loadHiveViewer()`, `sanityTest(bytes)`) and `test/helpers/pose-compare.mjs`.

### T10. Manual or private-model files mixed into `test/`. Low

These are not matched by any script glob and are never run automatically. They are documented as manual (OPTIMIZEXL_VERIFICATION.md lines 182-298, SAVE-COMPATIBILITY-VERIFICATION.md:107, UPDATER_RELEASE_GATE.md:37):

- 12 `optimizexl-*-models.mjs` / `optimizexl-footman.mjs` / `optimizexl-snaps-reference.mjs` / `optimizexl-flail-regression.mjs`
- `save-compatibility-fixtures.mjs`
- `geoset-save.retera.js`, `save-compatibility.retera.js`
- `updater-release-reopen.ps1`
- `particle-lifecycle|performance|review.html/.jsx` (loaded by their harnesses)
- `test/uv-camera-check.html` + `.jsx`: **orphaned**. Only the HTML references the JSX; nothing references the HTML.

Note: the agent-map's OptimizeXL row lists `optimizexl-flail-regression.mjs` as the "immutable flail regression". It needs private models and never runs in CI, so the baseline AGENTS.md calls "immutable" is protected only by hand.

**Fix.** Move them to `test/manual/` (and update the doc commands). Delete `uv-camera-check.*` or reattach it.

**Risk.** Doc commands must move with the files.

### T11. Two fixture homes; hard-coded game path. Low

- `fixtures/` at the repo root (6 files: `demo.mdl/mdx`, fake AI agents, render helpers) is used by 19 test files. `test/fixtures/` is used by 35. Nothing in `src/`, `app/` or `electron/` uses `fixtures/`.
- `'D:/Warcraft III'` is hard-coded in `test/particle-ribbon-fit.electron.cjs:5`, `ribbon-track.electron.cjs:5`, `sprite-frames.electron.cjs:6`, `footprint-travel.electron.cjs:8`, `particle-travel.electron.cjs:9`, `hd-library-preview.electron.cjs:11`, `game-file-library.electron.cjs` and `scripts/learn-sprite-frames.mjs:11`. `GameDataDiscovery` (used by `scripts/index-particles.mjs:5`) or one `MDLXL_GAME_FOLDER` would do.
- `scripts/sd-trial/trial.ps1:9` and docs/PACKAGED-TESTS.md hard-code `D:/Claude/tools/node_modules/playwright-core`.

**Fix.** Merge `fixtures/` into `test/fixtures/` (19 path edits). Add `gameFolder()` to the helper.

### T12. Source tests that always skip in CI. Low/info

13 files skip on missing local fixtures or env:

- `pose-ik.test.js:427,448`, `pose-console.test.js:55`, `pose-ragdoll.test.js:18`: hard-coded `out/pose/Footman.mdx`.
- `pose-complex.test.js:36`, `pose-corpus.test.js:33`, `pose-performance.test.js:50`, `optimizexl-skin-collapse.test.js:55`, `sort-my-mess.test.js:235`.
- `material-presets.test.js:50`: `MDLXL_ARCHER`, while the runner uses `MDLXL_SUITE_ARCHER` (`run-packaged-tests.mjs:54`).
- Platform skips (fine): `ai-native-providers.test.js:281`, `preview-ffmpeg.test.js:45,88`, `preview-backgrounds.test.js:67`, `updater.test.js:176`.

The Footman fixture therefore has three spellings: `out/pose/Footman.mdx`, `MDLXL_SUITE_FOOTMAN`, `MDLXL_POSE_FIXTURE`.

**Fix.** One `fixturePath('footman')` in the helper, reading the runner's variables.

### T13. Checked and clean

- **No imports of missing modules.** Every relative `import`/`require` in `test/`, `tests/` and `scripts/` resolves. The 23 apparent misses are strings evaluated in other contexts: esbuild stdin (`appearance.electron.cjs:16`, `paint-blp.test.js:38`), `createRequire(main.cjs)` (`desktop-native-rescan.test.js:12`), and main-process evals of `./updater.cjs` (`updater-packaged.electron.cjs:21` …).
- **No missing named exports** among every `import {…} from '../src|app|electron/…'` (static and `await import`) in test/scripts.
- **No duplicate test titles** among the 2070 `test(…)` titles across `test/` and `tests/`.
- **Every `*.test.js` has tests.** `collect-bit-save.test.js` builds them in a loop. Overlap is by layer (source test + packaged harness of the same feature), which is intentional. The closest same-layer overlap is `forge.test.js` ("Detail increases internal polygons…") vs `forge-contract.test.js` ("higher Detail supplies interior support…"). They assert different properties, so no action.

### T14. Baseline file: clean

`.github/known-test-failures.txt` holds only its 2 comment lines, with zero entries. Nothing is hidden. `.github/check-test-baseline.mjs` already reports baseline entries that now pass and fails on a missing completion record.

## Scripts

### S1. Re-implemented helpers. Low

- **Repo root**, 4 idioms:
  - `path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')` in `package.mjs:8`, `run-packaged-tests.mjs:11`, `fetch-ffmpeg.mjs:20`, `package-updater-bootstrap.mjs:8`
  - `fileURLToPath(new URL('../',import.meta.url))` in `check-viewport-normals.mjs:9`
  - a hand-rolled `new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')` in `learn-sprite-frames.mjs:10` (fragile with spaces or `%20`)
  - bare `process.cwd()` in `audit-citadel-sources.mjs:10`, `check-sanity-corpus.mjs:12`, `index-particles.mjs:9`, `build-paint-assets.mjs:6`
- **sha256**: `package.mjs:17` (`hash`), `fetch-ffmpeg.mjs:21` (`sha256`), while `electron/updater.cjs` already exports `digest` (used by `package-updater-bootstrap.mjs:9`).
- **Playwright resolution**: `run-packaged-tests.mjs:100-105` (`findPlaywright`), `playwright-variant.cjs:6-12` (`loadPlaywright`), `check-viewport-normals.mjs:10-11`. Three env names: `MDLXL_REAL_PLAYWRIGHT`, `MDLXL_PLAYWRIGHT_MODULE`, `PLAYWRIGHT_MODULE`.
- **FFmpeg check**: `fetch-ffmpeg.mjs:30-33,56-59` re-implements the per-file PROVENANCE hash loop that `electron/ffmpeg-verification.cjs:7-31` (`verifyFFmpegBundle`) owns. `package.mjs:9` reuses the electron version correctly.
- `package.mjs:87` says "Run npm run build" (the project uses pnpm).
- `package.mjs:14` hard-codes the shipped PDF guide names per release (`'0.35.0-New-Features', '0.32.0-AI-Guide', …`), so every release edits code. A glob or manifest would do.

**Fix.** Add `scripts/lib/paths.mjs` (`repoRoot`, `outDir`, `tempDir`) and re-export `digest` from updater.cjs. Make `fetch-ffmpeg` call `verifyFFmpegBundle` on the extracted folder. Use one `MDLXL_PLAYWRIGHT` variable.

**Risk.** Low.

### S2. package.json scripts. Low

- `package.json:9,11`: `"test"` and `"test:compatibility"` are both `node --test tests/*.test.js`, an exact duplicate.
- `.github/workflows/ci.yml:38-41` re-declares the source glob `"test/*.test.js"` with its own flags instead of calling `test:source`. The two can drift.
- `package.json:34-36` `"engines": {"node": ">=20"}` vs AGENTS.md:83 and README.md:11 "22.12+" (vite 7 needs ≥20.19/22.12). `docs/agent-tasks/context-efficiency.md:46-47` noted this and chose not to change it.

**Fix.** Drop `test:compatibility`, or keep one as an alias with a comment. Add `test:ci` and call it from ci.yml. Set engines to `>=22.12`.

### S3. Stale second lockfile. Medium-low

`package-lock.json` (lockfileVersion 3, `"version": "0.28.1"`, last changed in `230ed44e Release 0.28.1`) sits next to `pnpm-lock.yaml`. CI and release install from the latter with `--frozen-lockfile`. `THIRD_PARTY_NOTICES.md:3` claims "Exact dependency versions and transitive packages are recorded in `package-lock.json`", which is no longer the lock CI uses.

**Fix.** Delete `package-lock.json` and point THIRD_PARTY_NOTICES at `pnpm-lock.yaml`.

**Risk.** Low. Check that nobody runs `npm ci`; no doc or script does.

## CI

### C1. Duplicated setup steps. Low

`.github/workflows/ci.yml:16-29` and `.github/workflows/release.yml:25-44` share checkout@v4, setup-node@v4 `node-version: 22`, `npm install -g pnpm@10.28.0` (the pnpm version is pinned twice and absent from `package.json` `packageManager`), `pnpm install --frozen-lockfile`, `pnpm run fetch-ffmpeg`, `pnpm run build` and `pnpm test`.

**Fix.** Add a composite action `.github/actions/setup-build/action.yml` (inputs: `skip-electron`), plus `"packageManager": "pnpm@10.28.0"` so the version lives in one place.

**Risk.** Low. The release path must be dry-run with `workflow_dispatch`.

### C2. Discord one-off. Low

`.github/workflows/github-releases-to-discord.yml:26` has `github.event.release.tag_name != 'v0.21.2'`, a permanent special case for an old hotfix. It is harmless, but noise.

## Docs layer

### D1. The task index lists merged work as current. High (for agents)

`docs/agent-tasks/README.md:9-20`. 9 of the 10 "Current tasks" rows are merged on GitHub:

| Row (line) | Note | PR state |
|---|---|---|
| AI clarification questions (11) | ai-question-route.md | #375 merged 2026-10-29 |
| Organiser checkpoints (12) | ai-organiser-checkpoints.md | #376 merged 2026-10-29 |
| Bird job routing (13) | ai-bird-job-routing.md | #372 merged 2026-10-29 |
| AI-only model references (14) | ai-private-references.md | #371 merged 2026-10-29 |
| Bitz replacement fitting (15) | bitz-replacement-fit.md | #360 merged 2026-10-28 |
| Shared project context (16) | context-efficiency.md | #255 merged 2026-10-22 |
| New MDLxL look (17) | new-look.md | #296 merged 2026-10-25 |
| WC3 editing knowledge (18) | wc3-editing-agent.md | the note itself says "completed. Merged in PR #318" |
| AI review pictures (19) | ai-review-matching-pictures.md | #364 merged 2026-10-28 |
| AI hook learning facts, case 2 (20) | ai-hook-learning-facts.md | still current ("not acted on"); #380 merged the note only |

The README's own rule (line 22: "On completion, mark the note completed…, remove its table entry") is not being followed. Merges are done by Claude ("When the owner says merge, merge right away") without the follow-up note edit.

**Fix.** Empty the table down to the one live row. Add a post-merge step to CLAUDE.md's merge bullet and to AGENTS "Branches, approval and releases": "after merging, mark the task note completed with the merge revision and remove its README row in the same or the next PR."

### D2. Notes with stale status. Medium

These notes are not marked completed although their PRs are merged:

| Note:line | What it says | Actual state |
|---|---|---|
| ai-bird-job-routing.md:3 | "ready for review; awaiting merge approval" | #372 merged |
| ai-chat-attachments.md:3,17 | "awaiting merge approval", "PR …/370 (open…)" | #370 merged; also not in the README table |
| ai-organiser-checkpoints.md:3 | ready for review | #376 merged |
| ai-private-references.md:3 | ready for review | #371 merged |
| ai-question-route.md:3 | ready for review | #375 merged |
| ai-review-matching-pictures.md:3 | "ready for review" | #364 merged |
| animation-reordering.md:1-6 | no Status line | #359 merged |
| bitz-replacement-fit.md:3 | ready for review | #360 merged |
| codex-review-fixes.md:3,239 | "PR …/379 (open into main)" | #379 merged |
| context-efficiency.md:3,17 | "PR #255, open and attached" | #255 merged |
| ler-learn-button.md:3-4 | "back to Codex, not merged", "#325 (draft…; not merged)" | #325 merged 2026-10-26 |
| manager-polish.md:3 | "owner authorized PR #363 merge" | #363 merged |
| new-look.md:3 | ready for review | #296 merged |
| particle-travel.md:3 | "owner authorized merge of PR #377" | #377 merged |
| vis-mdlvis-mode.md:3 | "ready for independent review" | #324 merged |
| popup-helmet-eyes.md | no Status line | "authorized merging" |

Two notes contradict themselves: `auto-corpse.md:3` says "completed — merged in PR #276", but line 19 says "[PR #276], unmerged". `mdlvis-style-rotate-drag.md:3` says completed, but line 66 says "Open and unmerged" (history left in the current-state section).

**Fix.** One sweep: set `Status: completed — merged in #n (<sha>)` and move the in-flight bullets under a "History" heading.

**Risk.** None; docs only.

### D3. agent-map: verified, one overlap. Low

`docs/agent-map.md` checks:

- **Links**: all 243 relative links in it resolve, including the `#anchors` into other `.md` files.
- **Named symbols**: all 48 backticked symbols were checked against the file they are attributed to, and every one is defined there. Examples: `drawPivotCrosses` app/movement-overlay.js:164, `materialsUsingTexture` src/uv-preview.js:121, `hotkeyConflicts` src/preferences.js:248, `LearnSettings` app/Settings.jsx:112, `cleanupUnused` electron/ai-service.cjs:1651, `mdlxl-hotkey-used` app/Hotkeys.jsx:214, `@files` electron/CascBridge.cs:28, `OrganiserRegistry` electron/ai-offload.cjs:179, `onTransformPreview` app/Viewport.jsx:669. The map's claim "checked against the source" still holds.
- **Overlap**: the rows "AI chat, provider sign-in and external MCP…" (line 22) and "AI console, chats and providers" (line 44) both start at `AiAssistant.jsx`, `ai-service.cjs`, `ai-providers.cjs` and `AI-HOOK.md`, so an agent cannot tell which to pick.

**Fix.** Merge them into one AI row, or split them clearly (provider/MCP vs. console/offload).

### D4. PACKAGED-TESTS.md misdescribes what is tested. Medium

`docs/PACKAGED-TESTS.md:3-4` says "`test/*.cjs` drive the real MDLxL app with Playwright: mostly the packaged `MDLxL.exe`, some the development Electron with `dist/`". The actual split is roughly 99 dev / 65 packaged out of 164 runnable (T1). Line 72 says "Several tests also start the development Electron". The doc's fixture names (`MDLXL_SUITE_FOOTMAN`) also differ from what the source tests read (T12).

**Fix.** Correct this together with T1.

### D5. Small contradictions between instruction files. Low

- `README.md:17,26` "`pnpm run test:source` runs the full suite" vs `docs/agent-map.md:56` "These are different suites" and AGENTS.md:88. test:source excludes `tests/` and all 190 harnesses. README never mentions `pnpm run test:packaged`.
- `CLAUDE.md:9-12` "At release, match PRs to sessions with `list_sessions`… archive each" vs AGENTS.md:138-140 / docs/AUTO_UPDATES.md:70 "Once the release is published (never at tag or draft time)… `gh pr view <n> --json headRefName,body` gives its `Session:` line". The timing word differs ("at release" vs "after publish") and so does the matching method. They are compatible, but CLAUDE.md should say "after publishing" and reference AUTO_UPDATES step 2.
- AGENTS.md:83 / README.md:11 say Node 22.12+, but package.json engines say `>=20` (S2).
- `MDLVIS_HEADLESS` (170 harnesses, electron/main.cjs:63,142, close-prompt.cjs:61) is the only legacy `MDLVIS_` variable among dozens of `MDLXL_*`. Naming only; renaming is a product change.

No contradiction was found on branch prefixes (`claude/` in both), the merge command (`.claude/settings.json` pre-approves exactly the documented `gh api …/merge` form), or build order (build → package; the CI order is followed).

### D6. Broken anchors and links in topic guides. Low

- `docs/COMMUNITY_RESEARCH.md:17-36,99` has 25 links like `#s10-current-magoswar3-model-editor`. The headings are `### S10 — Current Magos/War3 Model Editor` (line 159), which GitHub slugs as `s10--current-…` (the em dash leaves a double hyphen), so all 25 are dead on GitHub. This doc ships in the package (`package.mjs:14`).
- `docs/RELEASE-HISTORY-LEGACY.md:49` has 17 links written root-relative (`docs/RELEASE-0.22.1.md`) inside `docs/`, so they resolve to `docs/docs/…`. The file says so deliberately (line 47), but they are still dead links.
- `docs/particle-editor/HANDOFF.md:29` names `app/ParticleSweepTools.jsx`, which does not exist.

### D7. Historical notes naming deleted files. Info

13 references, all in completed or historical notes: `ler-learn-button.md:55,106` (`src/shredder-keycaps.js`, `app/Shredder.jsx`, `app/shredder.css`, `test/shredder.test.js`, renamed to Learn), `shredder-keycaps.md:48,138,156`, `release-0.31.0.md:63`, and `wc3-editing-agent.md:82-85` (files on unmerged branches #299/#302/#303). Acceptable as history. Label them "(renamed to …)" if touched.

### D8. Version consistency: clean

`package.json:3` 0.35.0 matches `README.md:1` "# MDLxL 0.35.0", the "Current version" paragraph (line 36), the first Release-history entry (line 54 → `docs/RELEASE-0.35.0.md`, whose headline matches) and the latest GitHub release v0.35.0 (published 2026-10-28). The README line 26 claim of "57 compatibility regression tests" is accurate (57/57 pass). The only stale version is `package-lock.json` 0.28.1 (S3).

## Already shared and good

- `scripts/playwright-variant.cjs` is one wrapper that every harness gets via `MDLXL_PLAYWRIGHT_MODULE`. Variants live in one place (`run-packaged-tests.mjs:23-35`).
- `scripts/hidden-run.ps1` is reused by the runner and `sd-trial/trial.ps1`.
- `run-packaged-tests.mjs` `cleanup()` (lines 110-127) only kills processes the test started or that run from `out/`, and the runner redirects `TEMP`/`TMP` to `out/tmp/<variant>`.
- Every harness uses an isolated `MDLXL_PROFILE` (186 files), so no user profile is touched.
- `createDemoDocument` (src/editor-document.js, used by 78 test files) and `createStarterDocument` (src/starter-model.js, 42 files) are the real shared model fixtures. `test/fixtures/paint-fixtures.js` is shared by 14 paint tests, `test/starter-picture.js` by 12 files and `test/motion-worker-bridge.js` by motion-worker.test.js.
- `scripts/package.mjs` reuses `electron/updater.cjs` (`MANIFEST`, `validateManifest`) and `electron/ffmpeg-verification.cjs` instead of copying them. The corpus scripts reuse `electron/casc.cjs`, `game-data.cjs` and `particle-library-worker.mjs`.
- `.github/check-test-baseline.mjs` + `test-annotations.mjs` form a clean known-failure gate with an empty baseline.
- `docs/agent-map.md` is accurate (D3). CLAUDE.md imports AGENTS.md (no copied body), and there are no nested instruction files, as `docs/agent-tasks/README.md` states.

## Suggested order

1. D1 + D2: a docs sweep, plus the post-merge rule. Zero risk, high value for agents.
2. T6, T4, S2 (duplicate script), S3: trivial deletions.
3. T1 + D4: the single exe variable plus a corrected doc, migrated family by family and run with `test:packaged`.
4. T2/T3: `test/helpers/app.cjs` + `fiber-probe.cjs`, starting with the pose (8), citadel (10) and ai (12) families.
5. T8, T7, T9, S1, C1: when the files are next touched.

---

# Appendix: instance lists

Format: `file:firstLine (+N more lines in that file)`. All paths are under `test/`. Generated by a static scan at `fe46a534`.

### A. Playwright loader `require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright')` — 162 files

ai-hotkeys.electron.cjs:4, ai-organiser-refresh.electron.cjs:3, alert-ping.electron.cjs:4, anim-xl-filmstrip.electron.cjs:6, anim-xl.electron.cjs:4, animation-bake.electron.cjs:4, animation-dropdown-wheel.electron.cjs:4, animation-effects.electron.cjs:6, animation-heavy-editing.electron.cjs:7, animation-speed.electron.cjs:4, animations-geoset-target.electron.cjs:4, animations-sidebar.electron.cjs:4, appearance-contrast.electron.cjs:3, appearance.electron.cjs:6, attachemator.electron.cjs:8, auto-corpse.electron.cjs:3, billboard-vertex-drag.electron.cjs:5, bit-collection.electron.cjs:5, bit-replacement.electron.cjs:5, bone-appearance.electron.cjs:5, bone-tools.electron.cjs:5, bones-picker.electron.cjs:5, citadel-brushes.electron.cjs:2, citadel-default-library.electron.cjs:2, citadel-edges.electron.cjs:2, citadel-flow.electron.cjs:2, citadel-library.electron.cjs:2, citadel-locales.electron.cjs:2, citadel-model.electron.cjs:2, citadel-reskin.electron.cjs:3, citadel-studio.electron.cjs:2, citadel-surfaces.electron.cjs:3, close-prompt.electron.cjs:6, custom-game-archives.electron.cjs:7, dummy-bone.electron.cjs:6, emitter-keyframes.electron.cjs:3, event-animation-frame.electron.cjs:4, event-focus.electron.cjs:3, event-sound-scroll.electron.cjs:3, forge-bevel-sides.electron.cjs:3, forge-cuts.electron.cjs:3, forge-detail-editing.electron.cjs:4, forge-double-click.electron.cjs:3, forge-face-editing.electron.cjs:3, forge-house.electron.cjs:10, forge-molding.electron.cjs:3, forge-shape-hotkeys.electron.cjs:2, forge-shape.electron.cjs:3, geoset-duplicate-open.electron.cjs:8, geoset-leave-visible.electron.cjs:5, geoset-merge-conflicts.electron.cjs:5, geoset-rgb-merge.electron.cjs:5, geoset-save.electron.cjs:3, geoset-tabs.electron.cjs:4, glow-material-filters.electron.cjs:6, glow-up.electron.cjs:5, grabthrough.electron.cjs:4, hd-library-preview.electron.cjs:2, hotkey-badges.electron.cjs:4, hotkey-playback.electron.cjs:4, keyframe-delete.electron.cjs:5, learn-menu.electron.cjs:4, learn.electron.cjs:4, light-dark-shortcut.electron.cjs:5, localization.electron.cjs:5, manager-simplification.electron.cjs:2, material-presets.electron.cjs:4, mesh-density.electron.cjs:4, model-close.electron.cjs:5, model-manager-regressions.electron.cjs:3, model-tabs.electron.cjs:6, module-button-labels.browser.cjs:6, motion-inspector.electron.cjs:5, movement-billboard.electron.cjs:3, movement-chain-focus-speed.electron.cjs:5, movement-create-ribbon-reentry.electron.cjs:4, movement-gizmo-layout.electron.cjs:3, movement-gizmo.electron.cjs:3, node-effect-controls.electron.cjs:5, normalizer.electron.cjs:3, object-types.electron.cjs:5, optimizexl-bounds.electron.cjs:2, optimizexl-cleanup.electron.cjs:2, optimizexl-diagnostics.electron.cjs:2, optimizexl-expression.electron.cjs:2, optimizexl-footman.electron.cjs:2, optimizexl-format.electron.cjs:2, optimizexl-geosets.electron.cjs:2, optimizexl-inspection.electron.cjs:2, optimizexl-motion.electron.cjs:2, optimizexl-opening.electron.cjs:2, optimizexl-playback.electron.cjs:2, optimizexl-preview.electron.cjs:2, optimizexl-review.electron.cjs:2, optimizexl-selection.electron.cjs:2, optimizexl-spline.electron.cjs:2, optimizexl-workflow.electron.cjs:5, optimizexl.electron.cjs:2, paint-tab-camera.electron.cjs:4, part-bones.electron.cjs:7, particle-assets.electron.cjs:1, particle-feedback.electron.cjs:1, particle-library-copy.electron.cjs:1, particle-library-indexing.electron.cjs:3, particle-library-previews.electron.cjs:1, particle-lifecycle.electron.cjs:1, particle-main-rig.electron.cjs:1, particle-model-io.electron.cjs:1, particle-parent.electron.cjs:1, particle-performance.electron.cjs:1, particle-picture.electron.cjs:1, particle-prototype.electron.cjs:1, particle-review.electron.cjs:1, particle-ribbon-fit.electron.cjs:1, particle-workflow.electron.cjs:1, perspective-zoom.electron.cjs:8, portrait-authoring.electron.cjs:4, portrait-background.electron.cjs:4, pose-complex.electron.cjs:3, pose-console.electron.cjs:3, pose-copy-body.electron.cjs:3, pose-ik.electron.cjs:3, pose-performance.electron.cjs:3, pose-ragdoll.electron.cjs:3, pose-sd-controls.electron.cjs:3, pose-setup.electron.cjs:3, pose-view.electron.cjs:3, quad-view.electron.cjs:5, resource-numbering.electron.cjs:3, ribbon-track.electron.cjs:1, rig-node-order.electron.cjs:5, sanity-check.electron.cjs:1, sequence-reorder.electron.cjs:4, sort-my-mess.electron.cjs:2, sprite-frames.electron.cjs:1, startup-benchmark.electron.cjs:7, startup.electron.cjs:7, timeline-scrub.electron.cjs:5, tree-appearance.electron.cjs:4, update-popup-effects.browser.cjs:3, update-popup-fallback.electron.cjs:5, update-shredder.electron.cjs:4, updater-bootstrap.electron.cjs:4, updater-packaged.electron.cjs:5, updater-processes.electron.cjs:9, updater.electron.cjs:5, uv-grabthrough.electron.cjs:5, uv-material-settings.electron.cjs:6, uv-numpad.electron.cjs:5, uv-overlapping-horns.electron.cjs:5, uv-preview-edit-constraints.electron.cjs:5, uv-preview-picking.electron.cjs:5, uv-preview-steady.electron.cjs:7, uv-scroll-sensitivity.electron.cjs:4, uv-tab-window.electron.cjs:5, uv-team-color.electron.cjs:6, uv-wrapping.electron.cjs:5, vertex-rgb-preview.electron.cjs:5, vis-mdlvis-mode.electron.cjs:7, welcome-prompt.electron.cjs:6, workplane-free-drag.electron.cjs:7, zoom-align.electron.cjs:5

### B. Dev-Electron fallback path `node_modules/electron/dist/electron.exe` — 127 files

ai-hotkeys.electron.cjs:16, alert-ping.electron.cjs:13, animation-dropdown-wheel.electron.cjs:21, animation-effects.electron.cjs:35, animation-heavy-editing.electron.cjs:22, animation-speed.electron.cjs:26, animations-geoset-target.electron.cjs:13, animations-sidebar.electron.cjs:12, appearance-contrast.electron.cjs:9, appearance.electron.cjs:17, attachemator.electron.cjs:30, billboard-vertex-drag.electron.cjs:30, bit-collection.electron.cjs:23, bit-replacement.electron.cjs:35, bone-appearance.electron.cjs:16, bone-tools.electron.cjs:14, bones-picker.electron.cjs:13, citadel-brushes.electron.cjs:10, citadel-default-library.electron.cjs:11, citadel-edges.electron.cjs:10, citadel-flow.electron.cjs:10, citadel-library.electron.cjs:14, citadel-locales.electron.cjs:10, citadel-model.electron.cjs:10, citadel-reskin.electron.cjs:11, citadel-studio.electron.cjs:10, citadel-surfaces.electron.cjs:53, close-prompt.electron.cjs:23, custom-game-archives.electron.cjs:58, dummy-bone.electron.cjs:31, emitter-keyframes.electron.cjs:11, event-animation-frame.electron.cjs:22, event-focus.electron.cjs:9, event-sound-scroll.electron.cjs:8, footprint-travel.electron.cjs:8, game-file-library.electron.cjs:17, geoset-leave-visible.electron.cjs:12, geoset-merge-conflicts.electron.cjs:28, geoset-operations.electron.cjs:55, geoset-rgb-merge.electron.cjs:26, geoset-save.electron.cjs:9, geoset-tabs.electron.cjs:13, grabthrough.electron.cjs:15, hd-library-preview.electron.cjs:10, keyframe-delete.electron.cjs:24, learn-menu.electron.cjs:15, learn.electron.cjs:17, light-dark-shortcut.electron.cjs:12, localization.electron.cjs:30, manager-simplification.electron.cjs:7, material-presets.electron.cjs:7, model-close.electron.cjs:10, model-tabs.electron.cjs:13, motion-inspector.electron.cjs:24, movement-billboard.electron.cjs:24, movement-chain-focus-speed.electron.cjs:25, node-effect-controls.electron.cjs:40, object-types.electron.cjs:26, optimizexl-bounds.electron.cjs:12, optimizexl-cleanup.electron.cjs:7, optimizexl-diagnostics.electron.cjs:7, optimizexl-expression.electron.cjs:14, optimizexl-footman.electron.cjs:6, optimizexl-format.electron.cjs:11, optimizexl-geosets.electron.cjs:16, optimizexl-inspection.electron.cjs:7, optimizexl-motion.electron.cjs:7, optimizexl-opening.electron.cjs:7, optimizexl-playback.electron.cjs:9, optimizexl-preview.electron.cjs:23, optimizexl-review.electron.cjs:12, optimizexl-selection.electron.cjs:7, optimizexl-spline.electron.cjs:12, optimizexl-workflow.electron.cjs:22, optimizexl.electron.cjs:11, paint-tab-camera.electron.cjs:24, part-bones.electron.cjs:20, particle-assets.electron.cjs:19, particle-feedback.electron.cjs:16, particle-library-copy.electron.cjs:20, particle-library-previews.electron.cjs:16, particle-lifecycle.electron.cjs:3, particle-main-rig.electron.cjs:8, particle-model-io.electron.cjs:18, particle-parent.electron.cjs:11, particle-performance.electron.cjs:8, particle-picture.electron.cjs:7, particle-prototype.electron.cjs:10 (+1), particle-review.electron.cjs:6, particle-ribbon-fit.electron.cjs:12, particle-travel.electron.cjs:8, particle-workflow.electron.cjs:17, perspective-zoom.electron.cjs:16, portrait-authoring.electron.cjs:13, portrait-background.electron.cjs:19, portrait-extents.electron.cjs:23, quad-view.electron.cjs:23, ribbon-track.electron.cjs:12, rig-node-order.electron.cjs:21, rotation-interaction.electron.cjs:30, sanity-check.electron.cjs:5, showcase-camera.electron.cjs:15, showcase-effects.electron.cjs:12, showcase-layout.electron.cjs:18, showcase-queue.electron.cjs:10, showcase-recording-particles.electron.cjs:11, showcase-text.electron.cjs:11, showcase.electron.cjs:19, sprite-frames.electron.cjs:11, startup-benchmark.electron.cjs:31, startup.electron.cjs:55, timeline-scrub.electron.cjs:19, tree-appearance.electron.cjs:13, updater.electron.cjs:31, uv-controls.electron.cjs:27, uv-grabthrough.electron.cjs:12, uv-numpad.electron.cjs:15, uv-overlapping-horns.electron.cjs:12, uv-preview-edit-constraints.electron.cjs:14, uv-preview-picking.electron.cjs:15, uv-scroll-sensitivity.electron.cjs:22, uv-tab-window.electron.cjs:14, uv-wrapping.electron.cjs:11, vertex-rgb-preview.electron.cjs:35, welcome-prompt.electron.cjs:25, workplane-free-drag.electron.cjs:17, zoom-align.electron.cjs:15

### C. Hidden off-screen window setup (`setPosition(-3000,…)` / `x: -3000`) — 79 files

anim-xl-filmstrip.electron.cjs:18, anim-xl.electron.cjs:69, animation-heavy-editing.electron.cjs:31, appearance-contrast.electron.cjs:14, billboard-vertex-drag.electron.cjs:36, bone-tools.electron.cjs:20, bones-picker.electron.cjs:16, citadel-brushes.electron.cjs:12, citadel-edges.electron.cjs:12, citadel-flow.electron.cjs:12, citadel-library.electron.cjs:17, citadel-locales.electron.cjs:12, citadel-model.electron.cjs:11 (+1), citadel-reskin.electron.cjs:13, citadel-studio.electron.cjs:12, citadel-surfaces.electron.cjs:54, emitter-keyframes.electron.cjs:13, event-sound-scroll.electron.cjs:17, geoset-duplicate-open.electron.cjs:31, geoset-leave-visible.electron.cjs:16, geoset-rgb-merge.electron.cjs:36, geoset-save.electron.cjs:15, glow-material-filters.electron.cjs:38, grabthrough.electron.cjs:44, light-dark-shortcut.electron.cjs:16, localization.electron.cjs:38, manager-simplification.electron.cjs:11, material-presets.electron.cjs:11, motion-inspector.electron.cjs:28, movement-billboard.electron.cjs:27, movement-chain-focus-speed.electron.cjs:32, movement-gizmo-layout.electron.cjs:23, movement-gizmo.electron.cjs:24, normalizer.electron.cjs:37, object-types.electron.cjs:28, paint-tab-camera.electron.cjs:26, part-bones.electron.cjs:23, particle-assets.electron.cjs:21, particle-feedback.electron.cjs:17, particle-library-copy.electron.cjs:22, particle-library-indexing.electron.cjs:22, particle-library-previews.electron.cjs:17, particle-lifecycle.electron.cjs:3, particle-main-rig.electron.cjs:10, particle-model-io.electron.cjs:19, particle-parent.electron.cjs:12, particle-performance.electron.cjs:10, particle-picture.electron.cjs:9, particle-prototype.electron.cjs:14 (+1), particle-review.electron.cjs:6, particle-ribbon-fit.electron.cjs:14, particle-workflow.electron.cjs:19, perspective-zoom.electron.cjs:22, pose-complex.electron.cjs:25, pose-console.electron.cjs:22, pose-copy-body.electron.cjs:23, pose-ik.electron.cjs:29, pose-performance.electron.cjs:25, pose-ragdoll.electron.cjs:29, pose-sd-controls.electron.cjs:23, pose-setup.electron.cjs:25, pose-view.electron.cjs:23, quad-view.electron.cjs:26, resource-numbering.electron.cjs:19, ribbon-track.electron.cjs:14, rig-node-order.electron.cjs:24, sprite-frames.electron.cjs:13, tree-appearance.electron.cjs:17, uv-grabthrough.electron.cjs:18, uv-material-settings.electron.cjs:46, uv-overlapping-horns.electron.cjs:18, uv-preview-edit-constraints.electron.cjs:21, uv-preview-picking.electron.cjs:22, uv-preview-steady.electron.cjs:37, uv-scroll-sensitivity.electron.cjs:28, uv-wrapping.electron.cjs:17 (+1), vertex-rgb-preview.electron.cjs:48, workplane-free-drag.electron.cjs:23, zoom-align.electron.cjs:18

### D. `setBackgroundThrottling(false)` window prep — 163 files

ai-attachments.electron.cjs:43, ai-console.electron.cjs:169, ai-editor.electron.cjs:200, ai-hotkeys.electron.cjs:23, ai-live-tabs.electron.cjs:71, ai-organiser-refresh.electron.cjs:16, ai-parallel.electron.cjs:46, ai-questions.electron.cjs:25, ai-routing.electron.cjs:94, alert-ping.electron.cjs:18, anim-xl-filmstrip.electron.cjs:18, anim-xl.electron.cjs:69, animation-bake.electron.cjs:30, animation-dropdown-wheel.electron.cjs:32, animation-heavy-editing.electron.cjs:31, animation-speed.electron.cjs:38, animations-sidebar.electron.cjs:23, appearance-contrast.electron.cjs:14, appearance.electron.cjs:22, attachemator.electron.cjs:35, auto-corpse.electron.cjs:19, billboard-vertex-drag.electron.cjs:36, bit-collection.electron.cjs:28, bit-replacement.electron.cjs:43, bone-appearance.electron.cjs:19, bone-tools.electron.cjs:20, bones-picker.electron.cjs:16, citadel-brushes.electron.cjs:12, citadel-edges.electron.cjs:12, citadel-flow.electron.cjs:12, citadel-library.electron.cjs:17, citadel-locales.electron.cjs:12, citadel-model.electron.cjs:11, citadel-reskin.electron.cjs:13, citadel-studio.electron.cjs:12, citadel-surfaces.electron.cjs:54, custom-game-archives.electron.cjs:65, dummy-bone.electron.cjs:42, emitter-keyframes.electron.cjs:13, event-animation-frame.electron.cjs:34, event-focus.electron.cjs:18, event-sound-scroll.electron.cjs:18, footprint-travel.electron.cjs:11, forge-detail-editing.electron.cjs:21, forge-face-editing.electron.cjs:19, forge-house.electron.cjs:41, forge-shape-hotkeys.electron.cjs:10, forge-shape.electron.cjs:23, geoset-duplicate-open.electron.cjs:31, geoset-leave-visible.electron.cjs:16, geoset-merge-conflicts.electron.cjs:35, geoset-rgb-merge.electron.cjs:36, geoset-save.electron.cjs:15, geoset-tabs.electron.cjs:18, glow-material-filters.electron.cjs:37, glow-up.electron.cjs:35, grabthrough.electron.cjs:44, hd-library-preview.electron.cjs:15, hotkey-badges.electron.cjs:18, hotkey-playback.electron.cjs:23, learn-menu.electron.cjs:23, learn.electron.cjs:27, light-dark-shortcut.electron.cjs:16, localization.electron.cjs:38, manager-simplification.electron.cjs:11, material-presets.electron.cjs:11, mesh-density.electron.cjs:77, model-manager-regressions.electron.cjs:21, motion-inspector.electron.cjs:28, movement-billboard.electron.cjs:27, movement-chain-focus-speed.electron.cjs:32, movement-create-ribbon-reentry.electron.cjs:37, movement-gizmo-layout.electron.cjs:23, movement-gizmo.electron.cjs:24, node-effect-controls.electron.cjs:47, normalizer.electron.cjs:37, object-types.electron.cjs:28, optimizexl-bounds.electron.cjs:16, optimizexl-cleanup.electron.cjs:11, optimizexl-diagnostics.electron.cjs:11, optimizexl-expression.electron.cjs:18, optimizexl-footman.electron.cjs:10, optimizexl-format.electron.cjs:15, optimizexl-geosets.electron.cjs:20, optimizexl-inspection.electron.cjs:11, optimizexl-motion.electron.cjs:11, optimizexl-opening.electron.cjs:12, optimizexl-playback.electron.cjs:13, optimizexl-preview.electron.cjs:27, optimizexl-review.electron.cjs:16, optimizexl-selection.electron.cjs:13, optimizexl-spline.electron.cjs:16, optimizexl-workflow.electron.cjs:26, optimizexl.electron.cjs:18, paint-tab-camera.electron.cjs:26, part-bones.electron.cjs:23, particle-assets.electron.cjs:21, particle-feedback.electron.cjs:17, particle-library-copy.electron.cjs:22, particle-library-indexing.electron.cjs:22, particle-library-previews.electron.cjs:17, particle-lifecycle.electron.cjs:3, particle-main-rig.electron.cjs:10, particle-model-io.electron.cjs:19, particle-parent.electron.cjs:12, particle-performance.electron.cjs:10, particle-picture.electron.cjs:9, particle-prototype.electron.cjs:14 (+1), particle-review.electron.cjs:6, particle-ribbon-fit.electron.cjs:14, particle-travel.electron.cjs:13, particle-workflow.electron.cjs:19, perspective-zoom.electron.cjs:22, portrait-authoring.electron.cjs:19, portrait-background.electron.cjs:26, portrait-extents.electron.cjs:38, pose-complex.electron.cjs:25, pose-console.electron.cjs:22, pose-copy-body.electron.cjs:23, pose-ik.electron.cjs:29, pose-performance.electron.cjs:25, pose-ragdoll.electron.cjs:29, pose-sd-controls.electron.cjs:23, pose-setup.electron.cjs:25, pose-view.electron.cjs:23, quad-view.electron.cjs:26, resource-numbering.electron.cjs:18, ribbon-track.electron.cjs:14, rig-node-order.electron.cjs:24, rotation-interaction.electron.cjs:44, sanity-check.electron.cjs:8, sequence-reorder.electron.cjs:32, showcase-actions.electron.cjs:17, showcase-camera.electron.cjs:21, showcase-effects.electron.cjs:11, showcase-layout.electron.cjs:17, showcase-queue.electron.cjs:8, showcase-recording-particles.electron.cjs:10 (+1), showcase-text.electron.cjs:10, showcase.electron.cjs:18, sort-my-mess.electron.cjs:36, sprite-frames.electron.cjs:13, startup-benchmark.electron.cjs:39, startup.electron.cjs:39, timeline-scrub.electron.cjs:25, tree-appearance.electron.cjs:17, update-popup-fallback.electron.cjs:18, update-shredder.electron.cjs:27, updater.electron.cjs:25, uv-grabthrough.electron.cjs:18, uv-material-settings.electron.cjs:45, uv-numpad.electron.cjs:27, uv-overlapping-horns.electron.cjs:18, uv-preview-edit-constraints.electron.cjs:21, uv-preview-picking.electron.cjs:22, uv-preview-steady.electron.cjs:36, uv-scroll-sensitivity.electron.cjs:28, uv-team-color.electron.cjs:97, uv-wrapping.electron.cjs:17 (+1), vertex-rgb-preview.electron.cjs:47, vis-mdlvis-mode.electron.cjs:67, workplane-free-drag.electron.cjs:23, zoom-align.electron.cjs:18

### E. Throwaway profile `MDLXL_PROFILE: …` — 186 files

ai-attachments.electron.cjs:40, ai-awareness.electron.cjs:64, ai-console.electron.cjs:157, ai-editor.electron.cjs:189, ai-hotkeys.electron.cjs:18, ai-live-tabs.electron.cjs:63, ai-live.electron.cjs:62, ai-organiser-refresh.electron.cjs:14, ai-parallel.electron.cjs:44, ai-questions.electron.cjs:22 (+1), ai-routing.electron.cjs:91, ai-versions.electron.cjs:60, alert-ping.electron.cjs:14, anim-xl-filmstrip.electron.cjs:14, anim-xl.electron.cjs:66, animation-bake.electron.cjs:26, animation-dropdown-wheel.electron.cjs:24, animation-effects.electron.cjs:38, animation-heavy-editing.electron.cjs:24, animation-speed.electron.cjs:29, animations-geoset-target.electron.cjs:16, animations-sidebar.electron.cjs:15, appearance-contrast.electron.cjs:9, appearance.electron.cjs:17, attachemator.electron.cjs:31, auto-corpse.electron.cjs:14, billboard-vertex-drag.electron.cjs:32, bit-collection.electron.cjs:25, bit-replacement.electron.cjs:40, bone-appearance.electron.cjs:16, bone-tools.electron.cjs:14, bones-picker.electron.cjs:13, citadel-brushes.electron.cjs:10, citadel-default-library.electron.cjs:11, citadel-edges.electron.cjs:10, citadel-flow.electron.cjs:10, citadel-library.electron.cjs:14, citadel-locales.electron.cjs:10, citadel-model.electron.cjs:10, citadel-reskin.electron.cjs:11, citadel-studio.electron.cjs:10, citadel-surfaces.electron.cjs:53, close-prompt.electron.cjs:26, custom-game-archives.electron.cjs:62, dummy-bone.electron.cjs:33, emitter-keyframes.electron.cjs:11, event-animation-frame.electron.cjs:24, event-focus.electron.cjs:11, event-sound-scroll.electron.cjs:10, footprint-travel.electron.cjs:8, forge-bevel-sides.electron.cjs:15, forge-cuts.electron.cjs:22, forge-detail-editing.electron.cjs:18, forge-double-click.electron.cjs:21, forge-face-editing.electron.cjs:16, forge-house.electron.cjs:30, forge-molding.electron.cjs:11, forge-shape-hotkeys.electron.cjs:8, forge-shape.electron.cjs:20, game-file-library.electron.cjs:17, geoset-duplicate-open.electron.cjs:26, geoset-leave-visible.electron.cjs:12, geoset-merge-conflicts.electron.cjs:30, geoset-operations.electron.cjs:55, geoset-rgb-merge.electron.cjs:28, geoset-save.electron.cjs:10, geoset-tabs.electron.cjs:14, glow-material-filters.electron.cjs:32, glow-up.electron.cjs:27, grabthrough.electron.cjs:17, hd-library-preview.electron.cjs:11, hotkey-badges.electron.cjs:13, hotkey-playback.electron.cjs:18, keyframe-delete.electron.cjs:24, learn-menu.electron.cjs:20, learn.electron.cjs:20, light-dark-shortcut.electron.cjs:12, localization.electron.cjs:32, manager-simplification.electron.cjs:7, material-presets.electron.cjs:7, mesh-density.electron.cjs:67, model-close.electron.cjs:13, model-manager-regressions.electron.cjs:19, model-tabs.electron.cjs:14, motion-inspector.electron.cjs:24, movement-billboard.electron.cjs:24, movement-chain-focus-speed.electron.cjs:27, movement-create-ribbon-reentry.electron.cjs:26, movement-gizmo-layout.electron.cjs:20, movement-gizmo.electron.cjs:21, node-effect-controls.electron.cjs:41, normalizer.electron.cjs:33, object-types.electron.cjs:26, optimizexl-bounds.electron.cjs:12, optimizexl-cleanup.electron.cjs:7, optimizexl-diagnostics.electron.cjs:7, optimizexl-expression.electron.cjs:14, optimizexl-footman.electron.cjs:6, optimizexl-format.electron.cjs:11, optimizexl-geosets.electron.cjs:16, optimizexl-inspection.electron.cjs:7, optimizexl-motion.electron.cjs:7, optimizexl-opening.electron.cjs:8, optimizexl-playback.electron.cjs:9, optimizexl-preview.electron.cjs:23, optimizexl-review.electron.cjs:12, optimizexl-selection.electron.cjs:8, optimizexl-spline.electron.cjs:12, optimizexl-workflow.electron.cjs:22, optimizexl.electron.cjs:11, paint-tab-camera.electron.cjs:24, part-bones.electron.cjs:20, particle-assets.electron.cjs:19, particle-feedback.electron.cjs:16, particle-library-copy.electron.cjs:20, particle-library-indexing.electron.cjs:19, particle-library-previews.electron.cjs:16, particle-lifecycle.electron.cjs:3, particle-main-rig.electron.cjs:8, particle-model-io.electron.cjs:18, particle-parent.electron.cjs:11, particle-performance.electron.cjs:8, particle-picture.electron.cjs:7, particle-prototype.electron.cjs:10 (+1), particle-review.electron.cjs:6, particle-ribbon-fit.electron.cjs:12, particle-travel.electron.cjs:9, particle-workflow.electron.cjs:17, perspective-zoom.electron.cjs:18, portrait-authoring.electron.cjs:13, portrait-background.electron.cjs:19, portrait-extents.electron.cjs:25, pose-complex.electron.cjs:22, pose-console.electron.cjs:19, pose-copy-body.electron.cjs:20, pose-ik.electron.cjs:26, pose-performance.electron.cjs:22, pose-ragdoll.electron.cjs:26, pose-sd-controls.electron.cjs:20, pose-setup.electron.cjs:22, pose-view.electron.cjs:20, quad-view.electron.cjs:23, resource-numbering.electron.cjs:10, ribbon-track.electron.cjs:12, rig-node-order.electron.cjs:21, rotation-interaction.electron.cjs:38, sanity-check.electron.cjs:5, sequence-reorder.electron.cjs:23, showcase-actions.electron.cjs:12, showcase-camera.electron.cjs:17, showcase-effects.electron.cjs:12, showcase-layout.electron.cjs:18, showcase-queue.electron.cjs:10, showcase-recording-particles.electron.cjs:11, showcase-text.electron.cjs:11, showcase.electron.cjs:19, sort-my-mess.electron.cjs:32, sprite-frames.electron.cjs:11, startup-benchmark.electron.cjs:33, startup.electron.cjs:57, timeline-scrub.electron.cjs:21, tree-appearance.electron.cjs:13, update-popup-fallback.electron.cjs:27, update-shredder.electron.cjs:35, updater-bootstrap.electron.cjs:51, updater-packaged.electron.cjs:47, updater-processes.electron.cjs:44 (+2), updater-release-gate.cjs:68, updater.electron.cjs:31, uv-controls.electron.cjs:27, uv-grabthrough.electron.cjs:14, uv-material-settings.electron.cjs:39, uv-numpad.electron.cjs:17, uv-overlapping-horns.electron.cjs:14, uv-preview-edit-constraints.electron.cjs:17, uv-preview-picking.electron.cjs:17, uv-preview-steady.electron.cjs:31, uv-scroll-sensitivity.electron.cjs:24, uv-tab-window.electron.cjs:14, uv-team-color.electron.cjs:92, uv-wrapping.electron.cjs:13, vertex-rgb-preview.electron.cjs:37, vis-mdlvis-mode.electron.cjs:23, welcome-prompt.electron.cjs:27, workplane-free-drag.electron.cjs:19, zoom-align.electron.cjs:15

### F. `page.on('pageerror', …)` error collection — 155 files

ai-attachments.electron.cjs:41, ai-awareness.electron.cjs:72, ai-console.electron.cjs:166, ai-editor.electron.cjs:198, ai-hotkeys.electron.cjs:37, ai-live-tabs.electron.cjs:68, ai-organiser-refresh.electron.cjs:15, ai-parallel.electron.cjs:45, ai-questions.electron.cjs:23 (+1), ai-routing.electron.cjs:92, ai-versions.electron.cjs:64, alert-ping.electron.cjs:17, anim-xl.electron.cjs:68, animation-bake.electron.cjs:29, animation-dropdown-wheel.electron.cjs:28, animation-effects.electron.cjs:48, animation-heavy-editing.electron.cjs:29, animation-speed.electron.cjs:37, animations-geoset-target.electron.cjs:19, animations-sidebar.electron.cjs:22, appearance-contrast.electron.cjs:13, appearance.electron.cjs:21, attachemator.electron.cjs:34, auto-corpse.electron.cjs:17, billboard-vertex-drag.electron.cjs:35, bit-collection.electron.cjs:27, bit-replacement.electron.cjs:42, bone-appearance.electron.cjs:18, bone-tools.electron.cjs:19, citadel-brushes.electron.cjs:11, citadel-edges.electron.cjs:11, citadel-flow.electron.cjs:11, citadel-library.electron.cjs:15, citadel-locales.electron.cjs:11, citadel-model.electron.cjs:10, citadel-reskin.electron.cjs:12, citadel-studio.electron.cjs:11, citadel-surfaces.electron.cjs:53, custom-game-archives.electron.cjs:64, dummy-bone.electron.cjs:41, emitter-keyframes.electron.cjs:13, event-animation-frame.electron.cjs:31, footprint-travel.electron.cjs:10, forge-bevel-sides.electron.cjs:19, forge-cuts.electron.cjs:25, forge-detail-editing.electron.cjs:20, forge-double-click.electron.cjs:31, forge-face-editing.electron.cjs:19, forge-house.electron.cjs:40, forge-molding.electron.cjs:15, forge-shape-hotkeys.electron.cjs:10, forge-shape.electron.cjs:23, geoset-duplicate-open.electron.cjs:30, geoset-leave-visible.electron.cjs:15, geoset-save.electron.cjs:16, geoset-tabs.electron.cjs:17, glow-up.electron.cjs:34, hd-library-preview.electron.cjs:14, hotkey-badges.electron.cjs:17, hotkey-playback.electron.cjs:22, learn-menu.electron.cjs:22, learn.electron.cjs:26, light-dark-shortcut.electron.cjs:15, localization.electron.cjs:35, manager-simplification.electron.cjs:10, mesh-density.electron.cjs:75, model-manager-regressions.electron.cjs:20, model-tabs.electron.cjs:22, module-button-labels.browser.cjs:24, motion-inspector.electron.cjs:26, movement-billboard.electron.cjs:26, movement-chain-focus-speed.electron.cjs:31, movement-create-ribbon-reentry.electron.cjs:31, movement-gizmo-layout.electron.cjs:22, movement-gizmo.electron.cjs:23, node-effect-controls.electron.cjs:46, normalizer.electron.cjs:36, object-types.electron.cjs:27, optimizexl-bounds.electron.cjs:14 (+1), optimizexl-cleanup.electron.cjs:10, optimizexl-diagnostics.electron.cjs:10, optimizexl-expression.electron.cjs:17, optimizexl-footman.electron.cjs:9, optimizexl-format.electron.cjs:13 (+1), optimizexl-geosets.electron.cjs:18 (+1), optimizexl-inspection.electron.cjs:9 (+1), optimizexl-motion.electron.cjs:10, optimizexl-opening.electron.cjs:11, optimizexl-playback.electron.cjs:11 (+1), optimizexl-preview.electron.cjs:26, optimizexl-review.electron.cjs:14 (+1), optimizexl-selection.electron.cjs:12, optimizexl-spline.electron.cjs:14 (+1), optimizexl-workflow.electron.cjs:24 (+1), optimizexl.electron.cjs:14 (+1), paint-tab-camera.electron.cjs:25, part-bones.electron.cjs:22, particle-assets.electron.cjs:20, particle-feedback.electron.cjs:16, particle-library-copy.electron.cjs:21, particle-library-indexing.electron.cjs:21, particle-library-previews.electron.cjs:17, particle-lifecycle.electron.cjs:3, particle-main-rig.electron.cjs:9, particle-model-io.electron.cjs:18, particle-parent.electron.cjs:11, particle-performance.electron.cjs:9, particle-picture.electron.cjs:8, particle-prototype.electron.cjs:13 (+1), particle-review.electron.cjs:6, particle-ribbon-fit.electron.cjs:13, particle-travel.electron.cjs:12, particle-workflow.electron.cjs:18, perspective-zoom.electron.cjs:21, portrait-authoring.electron.cjs:17, portrait-background.electron.cjs:25, portrait-extents.electron.cjs:35, pose-complex.electron.cjs:24, pose-console.electron.cjs:21, pose-copy-body.electron.cjs:22, pose-ik.electron.cjs:28, pose-performance.electron.cjs:24, pose-ragdoll.electron.cjs:28, pose-sd-controls.electron.cjs:22, pose-setup.electron.cjs:24, pose-view.electron.cjs:22, quad-view.electron.cjs:25, ribbon-track.electron.cjs:13, rig-node-order.electron.cjs:23, rotation-interaction.electron.cjs:43, sanity-check.electron.cjs:7, sequence-reorder.electron.cjs:31, showcase-actions.electron.cjs:27, showcase-camera.electron.cjs:22, showcase-queue.electron.cjs:12, showcase-recording-particles.electron.cjs:13, showcase-text.electron.cjs:14, showcase.electron.cjs:22, sort-my-mess.electron.cjs:35, sprite-frames.electron.cjs:12, startup-benchmark.electron.cjs:38, startup.electron.cjs:64, timeline-scrub.electron.cjs:24, tree-appearance.electron.cjs:16, update-popup-effects.browser.cjs:14, update-popup-fallback.electron.cjs:30, update-shredder.electron.cjs:41, updater.electron.cjs:34, uv-numpad.electron.cjs:23, uv-tab-window.electron.cjs:18, uv-team-color.electron.cjs:95, vertex-rgb-preview.electron.cjs:44, vis-mdlvis-mode.electron.cjs:27, workplane-free-drag.electron.cjs:22, zoom-align.electron.cjs:17

### G. React fiber walk `__reactFiber` — 130 files

animation-effects.electron.cjs:71, animation-heavy-editing.electron.cjs:37, animation-speed.electron.cjs:62, appearance.electron.cjs:78, attachemator.electron.cjs:67 (+2), auto-corpse.electron.cjs:8, billboard-vertex-drag.electron.cjs:45, bit-collection.electron.cjs:33, bit-replacement.electron.cjs:49, bone-appearance.electron.cjs:24, bone-tools.electron.cjs:28 (+2), citadel-brushes.electron.cjs:15, citadel-edges.electron.cjs:15, citadel-flow.electron.cjs:15, citadel-library.electron.cjs:19, citadel-locales.electron.cjs:15, citadel-model.electron.cjs:13, citadel-reskin.electron.cjs:16, citadel-studio.electron.cjs:15, citadel-surfaces.electron.cjs:40, custom-game-archives.electron.cjs:127, dummy-bone.electron.cjs:47, emitter-keyframes.electron.cjs:15, event-animation-frame.electron.cjs:43, footprint-travel.electron.cjs:19, forge-cuts.electron.cjs:7 (+1), forge-detail-editing.electron.cjs:9 (+1), forge-face-editing.electron.cjs:9, forge-shape.electron.cjs:11, game-file-library.electron.cjs:104 (+1), geoset-leave-visible.electron.cjs:25, geoset-merge-conflicts.electron.cjs:46 (+1), geoset-rgb-merge.electron.cjs:43, geoset-tabs.electron.cjs:42, glow-material-filters.electron.cjs:48 (+1), glow-up.electron.cjs:30 (+2), grabthrough.electron.cjs:85, hd-library-preview.electron.cjs:27, hotkey-badges.electron.cjs:93, hotkey-playback.electron.cjs:31, learn-menu.electron.cjs:50, learn.electron.cjs:229, localization.electron.cjs:50, manager-simplification.electron.cjs:28 (+3), material-presets.electron.cjs:25 (+1), mesh-density.electron.cjs:11, model-manager-regressions.electron.cjs:26, model-tabs.electron.cjs:30, motion-inspector.electron.cjs:54, movement-billboard.electron.cjs:29 (+1), movement-chain-focus-speed.electron.cjs:111, movement-create-ribbon-reentry.electron.cjs:40 (+2), movement-gizmo-layout.electron.cjs:30, movement-gizmo.electron.cjs:31, node-effect-controls.electron.cjs:53, normalizer.electron.cjs:10, object-types.electron.cjs:35, optimizexl-bounds.electron.cjs:24, optimizexl-cleanup.electron.cjs:17, optimizexl-expression.electron.cjs:26, optimizexl-footman.electron.cjs:16, optimizexl-format.electron.cjs:32, optimizexl-geosets.electron.cjs:26, optimizexl-inspection.electron.cjs:18, optimizexl-motion.electron.cjs:27, optimizexl-opening.electron.cjs:21, optimizexl-playback.electron.cjs:20, optimizexl-preview.electron.cjs:32, optimizexl-review.electron.cjs:23, optimizexl-selection.electron.cjs:17, optimizexl.electron.cjs:24, paint-tab-camera.electron.cjs:12, particle-assets.electron.cjs:24 (+1), particle-feedback.electron.cjs:18 (+1), particle-library-copy.electron.cjs:26, particle-library-indexing.electron.cjs:27, particle-library-previews.electron.cjs:26, particle-main-rig.electron.cjs:12 (+1), particle-model-io.electron.cjs:15 (+5), particle-parent.electron.cjs:14 (+1), particle-performance.electron.cjs:15, particle-picture.electron.cjs:14 (+1), particle-prototype.electron.cjs:25 (+9), particle-ribbon-fit.electron.cjs:22 (+5), particle-travel.electron.cjs:16 (+2), particle-workflow.electron.cjs:41 (+3), perspective-zoom.electron.cjs:27, portrait-authoring.electron.cjs:26, portrait-background.electron.cjs:32, portrait-extents.electron.cjs:47, pose-complex.electron.cjs:32, pose-console.electron.cjs:31, pose-copy-body.electron.cjs:32, pose-ik.electron.cjs:36, pose-performance.electron.cjs:32, pose-ragdoll.electron.cjs:36, pose-sd-controls.electron.cjs:32, pose-setup.electron.cjs:32, pose-view.electron.cjs:30, quad-view.electron.cjs:35 (+1), ribbon-track.electron.cjs:22 (+1), rotation-editors.electron.cjs:37 (+2), rotation-interaction.electron.cjs:54, rotation-local.electron.cjs:9, sequence-reorder.electron.cjs:38, showcase-actions.electron.cjs:32, showcase-camera.electron.cjs:28, showcase-effects.electron.cjs:21, showcase-queue.electron.cjs:17 (+2), showcase-recording-particles.electron.cjs:18, showcase-text.electron.cjs:87, showcase.electron.cjs:62 (+2), sort-my-mess.electron.cjs:40 (+1), sprite-frames.electron.cjs:19, startup.electron.cjs:100, uv-controls.electron.cjs:44, uv-grabthrough.electron.cjs:33 (+1), uv-material-settings.electron.cjs:59 (+1), uv-numpad.electron.cjs:34, uv-overlapping-horns.electron.cjs:27 (+2), uv-preview-edit-constraints.electron.cjs:27, uv-preview-picking.electron.cjs:36 (+3), uv-scroll-sensitivity.electron.cjs:9, uv-tab-window.electron.cjs:23 (+1), uv-team-color.electron.cjs:39 (+1), uv-wrapping.electron.cjs:39 (+1), vertex-rgb-preview.electron.cjs:59, vis-mdlvis-mode.electron.cjs:42, workplane-free-drag.electron.cjs:31 (+1), zoom-align.electron.cjs:25

### H. Native dialog stubs (`showSaveDialog=` / `showOpenDialog=` / `showMessageBox(Sync)=`) — 44 files

ai-console.electron.cjs:390, ai-live-tabs.electron.cjs:81, animation-bake.electron.cjs:38, animation-speed.electron.cjs:50 (+4), attachemator.electron.cjs:148, auto-corpse.electron.cjs:50, citadel-model.electron.cjs:19, citadel-reskin.electron.cjs:36, citadel-studio.electron.cjs:39 (+3), close-prompt.electron.cjs:18 (+1), custom-game-archives.electron.cjs:71, dummy-bone.electron.cjs:64 (+1), forge-shape.electron.cjs:39, geoset-duplicate-open.electron.cjs:60, geoset-save.electron.cjs:40 (+1), geoset-tabs.electron.cjs:115 (+1), model-close.electron.cjs:32 (+1), motion-inspector.electron.cjs:166 (+1), movement-create-ribbon-reentry.electron.cjs:124, normalizer.electron.cjs:82, optimizexl-bounds.electron.cjs:16, optimizexl-expression.electron.cjs:18, optimizexl-format.electron.cjs:15, optimizexl-spline.electron.cjs:16, optimizexl.electron.cjs:76, particle-model-io.electron.cjs:25 (+2), particle-picture.electron.cjs:47 (+1), particle-prototype.electron.cjs:187 (+6), portrait-authoring.electron.cjs:32, portrait-background.electron.cjs:70, portrait-extents.electron.cjs:61, pose-complex.electron.cjs:141 (+1), pose-ik.electron.cjs:271 (+4), pose-ragdoll.electron.cjs:169 (+1), pose-sd-controls.electron.cjs:231 (+1), sequence-reorder.electron.cjs:96 (+1), showcase-actions.electron.cjs:46 (+1), showcase-layout.electron.cjs:15, startup.electron.cjs:40, update-shredder.electron.cjs:22 (+1), updater-bootstrap.electron.cjs:24 (+1), updater-packaged.electron.cjs:19, updater.electron.cjs:16 (+1), uv-preview-edit-constraints.electron.cjs:149

### I. Application-menu walk `Menu.getApplicationMenu()` — 7 files

ai-console.electron.cjs:392, ai-live-tabs.electron.cjs:82, citadel-studio.electron.cjs:44, forge-shape.electron.cjs:32, localization.electron.cjs:67 (+1), node-effect-controls.electron.cjs:219 (+1), sanity-check.electron.cjs:10

### J. Wrapper entry that requires `electron/main.cjs` after stubbing — 14 files

close-prompt.electron.cjs:20, model-close.electron.cjs:34, showcase-effects.electron.cjs:11, showcase-layout.electron.cjs:17, showcase-queue.electron.cjs:8, showcase-recording-particles.electron.cjs:10, showcase-text.electron.cjs:10, showcase.electron.cjs:18, startup.electron.cjs:41, update-popup-fallback.electron.cjs:16, update-shredder.electron.cjs:14, updater-bootstrap.electron.cjs:36 (+1), updater-packaged.electron.cjs:18 (+1), updater.electron.cjs:26

### K. Local SHA-256 helper `createHash('sha256')` — 34 files

ai-editor.electron.cjs:18, animation-effects.electron.cjs:168, citadel-brushes.electron.cjs:6, citadel-edges.electron.cjs:6, citadel-flow.electron.cjs:6, citadel-locales.electron.cjs:6, citadel-model.electron.cjs:6, citadel-reskin.electron.cjs:7 (+1), citadel-studio.electron.cjs:6 (+1), custom-game-archives.electron.cjs:9, emitter-keyframes.electron.cjs:4, forge-shape.electron.cjs:19, glow-material-filters.electron.cjs:9, movement-billboard.electron.cjs:4, movement-gizmo-layout.electron.cjs:16 (+1), movement-gizmo.electron.cjs:17 (+1), node-effect-controls.electron.cjs:226, pose-complex.electron.cjs:18 (+1), pose-console.electron.cjs:17, pose-copy-body.electron.cjs:18, pose-ik.electron.cjs:22 (+1), pose-performance.electron.cjs:18 (+1), pose-ragdoll.electron.cjs:22 (+1), pose-sd-controls.electron.cjs:4, pose-setup.electron.cjs:18 (+1), pose-view.electron.cjs:16 (+1), rotation-interaction.electron.cjs:27 (+1), showcase-actions.electron.cjs:11, showcase-effects.electron.cjs:6 (+1), showcase-queue.electron.cjs:5 (+2), updater-bootstrap.electron.cjs:33, uv-material-settings.electron.cjs:9, uv-team-color.electron.cjs:10, vis-mdlvis-mode.electron.cjs:13

### L. Local `settle` delay helper — 26 files

ai-live-tabs.electron.cjs:138, citadel-brushes.electron.cjs:7, citadel-edges.electron.cjs:7, citadel-flow.electron.cjs:7, citadel-locales.electron.cjs:7, citadel-reskin.electron.cjs:8, citadel-studio.electron.cjs:7, citadel-surfaces.electron.cjs:38, emitter-keyframes.electron.cjs:16, event-sound-scroll.electron.cjs:34, forge-detail-editing.electron.cjs:26, glow-material-filters.electron.cjs:71, movement-billboard.electron.cjs:54, movement-gizmo-layout.electron.cjs:49, movement-gizmo.electron.cjs:47, paint-tab-camera.electron.cjs:10, pose-complex.electron.cjs:47, pose-console.electron.cjs:46, pose-copy-body.electron.cjs:47, pose-ik.electron.cjs:49, pose-performance.electron.cjs:51, pose-ragdoll.electron.cjs:49, pose-sd-controls.electron.cjs:45, pose-setup.electron.cjs:47, pose-view.electron.cjs:49, rotation-interaction.electron.cjs:67

### M. Animation track factory `const track = …` (test.js) — 22 files

animation.test.js:7, auto-corpse.test.js:10, classic-keyframes.test.js:7, emitter-keyframes.test.js:9, geoset-animation-repair.test.js:8, global-sequence-preview.test.js:6, keyframe-timeline.test.js:12, model-optimizer.test.js:10, motion-inspector.test.js:12, movement.test.js:14, optimizexl-checker-repairs.test.js:17, optimizexl-cleanup-visibility.test.js:11, optimizexl-exclusions.test.js:12, optimizexl-format.test.js:13, optimizexl-motion-preservation.test.js:8, particle-preview.test.js:10, portrait-authoring.test.js:13, portrait-movement.test.js:10, portrait-view.test.js:10, pose-ik.test.js:18, sequence-editor.test.js:10, sequence-reorder.test.js:10

### N. Keyframe factory `const key = …` (test.js) — 13 files

ai-review-pictures.test.js:10, anim-xl.test.js:8, animation-options.test.js:8, animation-tracks.test.js:11, animation.test.js:6, classic-keyframes.test.js:6, geoset-extras.test.js:5, keyframe-timeline.test.js:11, movement-billboard.test.js:9, movement-rest-pose.test.js:12, optimizexl-checker-repairs.test.js:16, optimizexl-cleanup-visibility.test.js:10, sequence-editor.test.js:9

### O. Approx-equal helper definitions (near/close/closeTo) — 19 files

animation-batch.test.js:7, animation-options.test.js:9, animation-tracks.test.js:26, animation.test.js:8, auto-corpse.test.js:23, bit-replacement.test.js:151, editor-commands.test.js:17, final-viewport.test.js:22, forge-shape-editing.test.js:9, glow-up.test.js:10, keyframe-timeline.test.js:14, movement-billboard.test.js:10, movement.test.js:12, normals-rebuild.test.js:8, paint-lamps.test.js:26, particle-travel.test.js:14, pose-ik.test.js:24, uv-grid.test.js:6, viewport-quality.test.js:27

### P. Temp dir under the system temp `mkdtemp(…tmpdir()…)` (test.js) — 25 files

ai-native-providers.test.js:66, ai-offload.test.js:18 (+1), ai-process.test.js:26, ai-provider-protocol.test.js:14, ai-questions.test.js:12, ai-workflow.test.js:14, bit-collection.test.js:133, bits-and-parts.test.js:51 (+1), classic-storage.test.js:9 (+1), collect-bit-save.test.js:18, desktop-native-rescan.test.js:16, event-sounds.test.js:19, forge-assets.test.js:8 (+1), hotkey-migration.test.js:82, model-optimizer.test.js:35, native-cache.test.js:10, optimizexl.test.js:83 (+1), paint-model-integration.test.js:50, paint-texture-library.test.js:11 (+3), preview-backgrounds.test.js:11, preview-capture.test.js:25 (+1), preview-ffmpeg.test.js:40 (+1), texture-library.test.js:420 (+1), texture-preview-cache.test.js:13, updater.test.js:18 (+1)

### Q. Local model `fixture()` builders (test.js) — 47 files

addons.test.js:5, ai-native-providers.test.js:45, anim-xl-grip.test.js:17, animated-preview-background.test.js:6, animation-batch.test.js:13, animation-speed.test.js:10, animation-tracks.test.js:12, auto-corpse.test.js:11, classic-keyframes.test.js:8, editor-commands.test.js:5, emitter-keyframes.test.js:10, forge-contract.test.js:8, forge-hd.test.js:9, geoset-animation-repair.test.js:9, geoset-animation-save.test.js:16, keyframe-timeline.test.js:15, material-presets.test.js:9, model-optimizer.test.js:11, motion-curve-irregularities.test.js:9, motion-inspector.test.js:13, movement-billboard.test.js:13, movement-component.test.js:26, movement-rest-pose.test.js:13, movement.test.js:16, optimizexl-cleanup-visibility.test.js:12, optimizexl-diagnostics.test.js:14, optimizexl-format.test.js:15, optimizexl-motion-context.test.js:10, optimizexl-motion-removal.test.js:10, optimizexl-opening-tracks.test.js:9, optimizexl-skin-collapse.test.js:13, optimizexl-snaps.test.js:10, optimizexl-spline-tracks.test.js:17, optimizexl.test.js:16, paint-blp.test.js:10, paint-model-integration.test.js:16, paint-selection-space.test.js:13, particle-prototype.test.js:9, particle-ribbon-fit.test.js:10, particle-travel.test.js:7, portrait-extents.test.js:31, portrait-model-control.test.js:7, pose-ik.test.js:19, pose-performance.test.js:49, preview-blend-order.test.js:5, sequence-reorder.test.js:12, sort-my-mess.test.js:15

### R. Harnesses that launch the dev Electron under `pnpm run test:packaged` (99; name and the env var it reads but the runner does not set)

ai-hotkeys (MDLXL_ELECTRON_PATH), alert-ping (MDLXL_TEST_PACKAGE), animation-dropdown-wheel (MDLXL_ELECTRON_PATH), animation-effects (MDLXL_ELECTRON_PATH), animation-heavy-editing ( argv[2]), animation-speed (MDLXL_ELECTRON_PATH), animations-geoset-target (MDLXL_ELECTRON_PATH), animations-sidebar (MDLXL_ELECTRON_PATH), appearance, billboard-vertex-drag, bone-appearance, bone-tools, bones-picker, citadel-brushes (MDLXL_ELECTRON_PATH), citadel-default-library, citadel-edges (MDLXL_ELECTRON_PATH), citadel-flow (MDLXL_ELECTRON_PATH), citadel-library, citadel-locales (MDLXL_ELECTRON_PATH), citadel-model, citadel-reskin (MDLXL_ELECTRON_PATH), citadel-studio (MDLXL_ELECTRON_PATH), citadel-surfaces (MDLXL_ELECTRON_PATH), close-prompt, custom-game-archives (MDLXL_ELECTRON_PATH), dummy-bone (MDLXL_INPUT_PATH, MDLXL_ELECTRON_PATH), emitter-keyframes, event-animation-frame, event-focus, event-sound-scroll, forge-detail-editing, game-file-library (MDLXL_PACKAGED_EXE), geoset-leave-visible, geoset-operations, geoset-rgb-merge ( argv[2]), geoset-save, grabthrough, hd-library-preview (MDLXL_PACKAGED_EXE), keyframe-delete, light-dark-shortcut (MDLXL_TEST_EXE), localization (MDLXL_ELECTRON_PATH), manager-simplification, model-close, model-tabs, motion-inspector, movement-billboard, movement-chain-focus-speed, node-effect-controls (MDLXL_ELECTRON_PATH), optimizexl-playback (MDLXL_OPTIMIZEXL_EXE), optimizexl-preview (MDLXL_OPTIMIZEXL_EXE), optimizexl-review (MDLXL_OPTIMIZEXL_EXE), paint-tab-camera (MDLXL_ELECTRON_PATH), part-bones, particle-assets, particle-feedback, particle-library-copy (MDLXL_ELECTRON_PATH), particle-library-previews (MDLXL_ELECTRON_PATH), particle-lifecycle, particle-main-rig, particle-model-io, particle-parent, particle-picture (MDLXL_ELECTRON_PATH), particle-prototype, particle-review, particle-ribbon-fit, particle-workflow, portrait-authoring (MDLXL_ELECTRON_PATH), portrait-background (MDLXL_ELECTRON_PATH), portrait-extents (MDLXL_ELECTRON_PATH), quad-view, resource-numbering, ribbon-track, rig-node-order, rotation-interaction (MDLXL_ELECTRON_PATH), sanity-check, showcase-camera (MDLXL_ELECTRON_PATH), showcase-effects, showcase-layout, showcase-recording-particles (MDLXL_TEST_EXE), showcase-text, showcase, sprite-frames, startup-benchmark ( argv[2]), startup, timeline-scrub, tree-appearance, updater (MDLXL_TEST_EXE), uv-controls, uv-grabthrough, uv-numpad, uv-overlapping-horns, uv-preview-edit-constraints ( argv[2]), uv-preview-picking, uv-scroll-sensitivity, uv-tab-window, vertex-rgb-preview, welcome-prompt, workplane-free-drag (MDLXL_EXE), zoom-align

Method: a harness is counted when it contains a dev-Electron fallback and none of the exe variables it reads is given to it by `SPECIAL` in `scripts/run-packaged-tests.mjs` (SKIP entries excluded). Spot-checked: startup, quad-view, citadel-studio, showcase, timeline-scrub, optimizexl-preview, bone-tools.
