# Packaged-app tests

`test/*.cjs` drive the real MDLxL app with Playwright. The runner tells every
test which app to use through one variable, `MDLXL_TEST_EXE` (see
[Which app is tested](#which-app-is-tested)). The Electron harnesses use the
[shared helper](#shared-helper), including tests that drive a patched package copy. One command runs all of
them unattended and records the results:

```
pnpm run test:packaged [variant] [all|core|name,name]
```

- `variant` (default `default`) is the machine to imitate, see below.
- `all` (the default) runs every `test/*.cjs`; `core` runs the 28 rendering-,
  timing- and layout-heavy tests listed in `CORE` in the script; or name tests,
  e.g. `anim-xl,startup` (file name without `.electron.cjs` / `.cjs`).

The script is `scripts/run-packaged-tests.mjs`. It prints one line per test and
exits non-zero when a test fails, times out or does not exist. Skipped tests do
not fail the run.

## Windows stay hidden

The tests open real app windows. On Windows the runner therefore restarts itself
on a separate, invisible Windows desktop called `MDLxLTests`, using
`scripts/hidden-run.ps1` (`CreateDesktop` + `CreateProcess` with
`lpDesktop = WinSta0\MDLxLTests`). Everything the tests start inherits that
desktop, so no window can appear on your screen or take focus, even for a
moment, and you can keep working. WebGL2 and rendering work there.

The launcher is usable on its own for a single test or probe:

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\hidden-run.ps1 -Command 'cmd /c "node test\startup.electron.cjs > out\startup.log 2>&1"' -WorkDir .
```

It waits for the command and returns its exit code. The command gets no console,
so redirect its output to a file. When the command itself contains quotes that
PowerShell would mangle, put it in `$env:MDLXL_HIDDEN_COMMAND` instead of
`-Command`.

On the hidden desktop `requestAnimationFrame` has no display refresh to follow.
Tests that measure frame rates need `--disable-gpu-vsync --disable-frame-rate-limit`
and should be compared relatively.

Set `MDLXL_SUITE_VISIBLE=1` to run on the current desktop instead (for watching
a single test). Other platforms always run on the current display.

## Opt-in real-use AI measurements

`ai-real-use` sends eight owner-style scenario sequences through the packaged
AI console with Codex `gpt-6-luna` and low reasoning effort. It is excluded from
`all`, `core` and CI, even when its opt-in environment variable is set. It runs
only when named explicitly **and** `MDLXL_AI_REAL_USE=1`. Use a D: worktree.
No product limits or product code are changed.

```powershell
$env:TEMP = 'D:\Codex\mdlxl-ai-real-use\out\task-tmp'
$env:TMP = $env:TEMP
$env:npm_config_cache = 'D:\Codex\mdlxl-ai-real-use\out\npm-cache'
New-Item -ItemType Directory -Force $env:TEMP | Out-Null
npx vite build
node scripts/package.mjs --out out/pkg
$env:MDLXL_AI_REAL_USE = '1'
$env:MDLXL_AI_LIVE_PROFILE = 'D:\path\to\signed-in-app\resources\app\profile'
$env:MDLXL_AI_REAL_USE_REPEATS = '3'
node scripts/run-packaged-tests.mjs default ai-real-use
```

The runner uses `hidden-run.ps1` and the separate `MDLxLTests` desktop. The harness
refuses a visible Windows run. It never starts a sign-in flow or opens a browser.
Only `ai/codex/auth.json` is copied from the named profile to disposable scratch;
no owner settings or chats are copied or written. Scratch gets a fresh
`ai/codex/config.toml` with `model = "gpt-6-luna"` and
`model_reasoning_effort = "low"`. The outside check stays enabled; every request uses the selected cheap model
in its direct model chat. A missing or signed-out login triggers one dry-run
repetition using an explicitly inert local stand-in. A provider auth error while
sending stops further live calls and starts one fresh dry-run repetition with
the stand-in. No interactive reauthentication is attempted.

Each invocation writes `out/ai-real-use/<UTC timestamp>/report.json` and
`report.md`, plus per-scenario transcript, before/after geometry and demonstration
evidence. Reports show separate workflow/edit scores, mean/min/max distributions,
completion/resume-loop/cutoff/false-refusal rates, geometry/UV/texture deltas,
example coverage, per-stud triangle counts, elapsed seconds and transcript tokens.
Unavailable cost stays `null`/unknown, especially for subscription-backed Codex.
Reports never collapse the measurements to a single pass/fail. A zero runner exit
means it produced measurements; it does not approve the AI edits. Unexpected
harness errors still exit nonzero. Harness timeouts are marked separately from
provider-initiated stops.

`animation-size` and `pre-existing-motion` are scenarios 7 and 8; set
`MDLXL_AI_LIVE_FROM=7` to run just these. They generate redundant 1–3 ms local
keys with MDLxL's sampler from the committed
`test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx`, including quaternion
cubic controls equal to keys, unassigned keys and a constant colour track.
The second fixture has a structural root excursion before baking. Graders read
model bytes through the live document serializer and report size ratio,
per-animation distances/speed/channels, exact endpoint share and structure
counts. Follow-up wording and edits without a question are observations with
rates over repeats, never pass/fail. Transcript detection is a wording heuristic.
Set `MDLXL_AI_REAL_USE_DRY_RUN=1` for inert plumbing checks without live AI calls.

For private research replay, run
`node test/manual/ai-motion-compare-replay.mjs before.mdx after.mdx --out D:\Codex\replay.json`.
`--manifest` accepts a private JSON array of `{before,after,expected?,channels?}`;
`expected` points at a research comparison JSON and checks rounded per-animation
distance, speed and endpoint results. Model files are read as data only.

The fixture is a neutral copy of the authorized helmet; provenance is in
[test/fixtures/ai-real-use/README.md](../test/fixtures/ai-real-use/README.md).
Textures are read from local CASC into disposable scratch, not committed.
Weld scenarios introduce compatible redundant points without changing the look;
the harness performs the example with MDLxL's actual Weld command first.
Surface and interpolated-UV comparisons tolerate reindexing and coplanar
retriangulation. Three rasterized orthographic silhouettes provide shape evidence,
not artistic judgment. Photo resemblance and small details still require review;
Warcraft III itself is not exercised. Evidence may contain provider text: review
it before sharing; never publish a disposable profile or credentials.

Optional controls: `MDLXL_AI_LIVE_FROM=1` starts at a numbered scenario;
`MDLXL_AI_REAL_USE_REPEATS` defaults to 3; `MDLXL_AI_REAL_USE_GAME` defaults to
`D:\Warcraft III`; `MDLXL_AI_REAL_USE_TURN_MS` defaults to 240000 per turn;
`MDLXL_AI_REAL_USE_RESUMES` defaults to 2 resume attempts per scenario;
`MDLXL_AI_REAL_USE_DRY_RUN=1` exercises the console/report path without live calls.
The existing `MDLXL_SUITE_PKG` and `MDLXL_REAL_PLAYWRIGHT` select the package and
Playwright as usual. All test profiles, textures and scratch are removed on exit.

## Variants

| Variant | Imitates | How |
| --- | --- | --- |
| `default` | this PC | nothing extra |
| `no-gpu-warp` | a PC without a graphics card | `--use-angle=d3d11-warp` |
| `swiftshader` | software rendering through SwiftShader | `--use-angle=swiftshader --enable-unsafe-swiftshader` |
| `slow-cpu` | a four times slower CPU | CDP `Emulation.setCPUThrottlingRate` 4 on every window |
| `hidpi` | 150% Windows display scaling | `--force-device-scale-factor=1.5` |
| `release`, `release-no-gpu` | same as `default` / `no-gpu-warp` with separate results | meant for `MDLXL_SUITE_PKG=<unzipped release>` |

Variants work through `scripts/playwright-variant.cjs`, which the runner sets as
`MDLXL_PLAYWRIGHT_MODULE` for every test. It wraps the real Playwright and adds
`MDLXL_VARIANT_ARGS` (Chromium switches) and `MDLXL_VARIANT_CPU` (CPU throttle)
to every Electron launch.

## Before a run

1. Build and package the app into `out/pkg`:
   ```
   pnpm run build
   pnpm run fetch-ffmpeg
   node scripts/package.mjs --out out/pkg
   ```
   Or point `MDLXL_SUITE_PKG` at another `MDLxL-win32-x64` folder, e.g. an
   unzipped release. Several tests also start the development Electron, so
   `dist/` must be built either way. Run the script with `node` (as above, or
   `node scripts/run-packaged-tests.mjs ...`) in a worktree whose `node_modules`
   is a junction: `pnpm run` first tries an install. That reports a failure but
   still re-points the main checkout's top-level links into the worktree.
2. Playwright is not a project dependency. The runner finds `playwright` or
   `playwright-core` if it can be resolved from the repo; otherwise set
   `MDLXL_REAL_PLAYWRIGHT` to its folder, e.g.
   `D:\Claude\tools\node_modules\playwright-core`.
3. Real models come from the permanent test-model collection
   `D:\Claude\MDLxL-TestModels` (override with `MDLXL_TEST_MODELS`; its README
   lists every file). It lives outside Git because it holds Blizzard, LowPolyWorks
   and the owner's own models. Never delete or clean it up; only add to it. The
   Default column below is a subfolder of it unless it starts with `out/`.

| Fixture | Default | Override | Used by |
| --- | --- | --- | --- |
| SD Footman 1800 from the Warcraft III CASC install (with `Textures/`) | `pose/Footman.mdx` | `MDLXL_SUITE_FOOTMAN` | pose, movement gizmo, UV wrapping, AnimXL filmstrip, event focus, Attachemator |
| Classic MDX800 Footman | `citadel-fixture/Footman.mdx` | `MDLXL_SUITE_CITADEL_FOOTMAN` | Citadel paint |
| Particle index (`node scripts/index-particles.mjs --output out/particle-index/particles`; rebuild after game patches) | `out/particle-index/particles` | `MDLXL_PARTICLE_INDEX` | particle-lifecycle |
| OptimizeXL review model `WH_WOC_KnightKhorneFlail03.mdx` | `optimizexl-review/` | `MDLXL_OPTIMIZEXL_REVIEW_MODEL` | optimizexl-review, optimizexl-playback |
| A model whose geoset index 4 uses Materials[4] with 3 layers and that has 11+ textures (the original archer is gone; the Hive model `Mecha-CL.mdx` fits) | `material-fixture/Mecha-CL.mdx` | `MDLXL_SUITE_ARCHER` | material-presets |
| The owner's `graveguard_Optimized Weapon (1).mdx` (private) | `graveguard/` | `MDLXL_TEST_MODEL` per test | event-sound-scroll, manager-simplification, tree-appearance |
| `WH_WOC_KnightKhorneFlail03.mdx` | `effect-fixture/` | `MDLXL_EFFECT_MODEL` | showcase-effects |
| SD Chaos Knight (with hoofprint events) from the Warcraft III CASC install | `corpus-sd/human__knight.mdx` | `MDLXL_SUITE_HOOFPRINT` | footprint-travel |
| Google Chrome | `C:/Program Files/Google/Chrome/Application/chrome.exe` | `MDLXL_CHROMIUM_PATH` | module-button-labels.browser |
| The owner's `WH_WOC_KnightKhorneFlail01_HIVE_OPTIMIZED.mdx` (private; the byte-exact `_Before` copy in `D:/MDLxL-Reviews/OptimizeXL-geosets-20260928/portable-proofs/optimizexl-proof/`) | `optimizexl/` | `MDLXL_OPTIMIZEXL_MODEL` | optimizexl, optimizexl-geosets, optimizexl-inspection |
| The owner's `WH_WOC_KnightKhorneFlail07.mdx` and `WH_WOC_KnightKhorneFlail03.mdx` (private; `_Before` copies in `D:/MDLxL-Reviews/OptimizeXL-expression-20260929/packaged-proofs/expression-ui/`) | `optimizexl-expression/` | `MDLXL_EXPRESSION_MODEL` (list separated by `;`) | optimizexl-expression |
| The owner's `WH_VC_NecrarchLord3.mdx` (private, from Downloads) | `pose-complex-fixtures/` | `MDLXL_POSE_FIXTURE` | pose-complex, pose-performance |
| The owner's flail model `Fx_original.mdx` (private; `D:/Claude/research/fx-optimization-2026-10-30/fable-success/Fx_optimization_research/01_original/`) | `pose-flail/` | `MDLXL_FLAIL_MODEL` | pose-one-head |
| Two Khorne knights with an `Attack - 1` animation (the owner's `WH_WOC_KnightKhorneFlail03.mdx` and `WH_WOC_KnightKhorneAxe03.mdx` from Downloads), plus `profile/game-data-discovery.json` | `showcase-queue/` | `MDLXL_QUEUE_MODEL_A`, `MDLXL_QUEUE_MODEL_B` | showcase-queue |
| LowPolyWorks `WH_WOC_WarriorKhorneGW02.mdx`: only checker unused notices, all repaired by the Insanity FIxer (25) | `optimizexl-diagnostics/` | `MDLXL_DIAGNOSTICS_MODEL` | optimizexl-diagnostics |
| LowPolyWorks herrdave `Spanish_Halberdier.mdx`: one severe missing opening key (Jaw, Portrait Talk), 409 notices that one select-all pass clears | `optimizexl-opening/` | `MDLXL_OPENING_MODEL` | optimizexl-opening, optimizexl-cleanup |
| The owner's `WH_WOC_WarriorNurgle_Flail11_Optimized.mdx` (Downloads): a bounds repair on sequence extents is its only proposal | `optimizexl-bounds/` | `MDLXL_BOUNDS_MODEL` | optimizexl-bounds |
| LowPolyWorks herrdave `KnightOfTheBlazingSun.mdx`: a non-None visibility interpolation and a Portrait | `optimizexl-format/` | `MDLXL_FORMAT_MODEL` | optimizexl-format |
| LowPolyWorks gluma `Warp_Lightning_CannonB.mdx`: spline tracks with notices only resampling clears | `optimizexl-spline/` | `MDLXL_SPLINE_MODEL` | optimizexl-spline |
| SD Footman MDX800 (`corpus-sd800/human__footman.mdx`, with `Textures/` from `pose`): 13 animations, invalid bounds | `optimizexl-footman/` | `MDLXL_FOOTMAN_MODEL` | optimizexl-footman |
| The owner's `WH_WOC_WarriorNurgle_Flail12_Optimized.mdx` (Downloads): repairable irregular movement, bounds-only Insanity FIxer, Standard spheres | `optimizexl-motion/` | `MDLXL_FOOTMAN_MODEL` | optimizexl-motion |
| SD Muradin MDX800 (`corpus-sd800/human__muradin.mdx`): orange motion pair in one animation, context inspections, invalid bounds | `optimizexl-selection/` | `MDLXL_FOOTMAN_MODEL` | optimizexl-selection |
| LowPolyWorks `WH_VC_VonCarsteinLord07.mdx` with its game textures (read from CASC): four-joint left arm 13-14-15-16 | `pose-setup-fixture/` | `MDLXL_POSE_FIXTURE` | pose-setup |

Each of the last nine rows was chosen for the feature its test exercises, measured with MDLxL's own code by the scripts in
`out/fixture-scan/` (`scan.mjs`, `sim.mjs`, `one-fix.mjs`, `motion.mjs`, `pose-rig.mjs`); the test comments give the numbers.
Checks no available model can exercise (an effect glow left without its geometry, a sequence-timeline quirk, portrait
particles beside a format quirk, a red whole-body irregular movement) stay in the tests and are named there.

The pose Footman can be read from the game with `electron/casc.cjs`:
`new CascReader('<Warcraft III folder>', process.cwd()).read('war3.w3mod:units\\human\\footman\\footman.mdx')`.

Source tests use the same collection: the SD corpora (`corpus-sd`, `corpus-sd800`), the SD units in `pose`
(Ogre, Medivh, Guldan, Acolyte, Necromancer, turtle, centaur, knight) and `corpse-fixtures` (the owner's
`Lahmian_SD_14.mdx`, the native Skink and the LowPolyWorks ratlings). Some tests are always skipped (`SKIP` in the script): manual tools such as the
updater release gate, old builds, and tests whose exact private model is not on
this PC. Each reason names the missing file and where it would go.

## Results

- `out/suite/<variant>/<test>.log` holds each test's output.
- `out/suite/<variant>/summary.json` holds every result (status, exit code,
  seconds, last log lines); `done.txt` the final counts.
- `SUITE_RESUME=1` keeps the earlier summary and reruns only tests that did not
  pass.
- `SUITE_TIMEOUT_MS` sets the per-test timeout (default 15 minutes). A test that
  times out is stopped with its whole process tree.
- `TEMP`, `TMP` and `MDLXL_TEMP` point at `out/tmp/<variant>` so temporary files stay in the
  repo's `out/` folder.

Per-test environment variables and arguments (fixtures, the package folder for
updater tests) are in the `SPECIAL` table at the top of the script. Add new tests
there when they need more than the shared environment.

## Which app is tested

The runner picks one target, `MDLXL_SUITE_PKG` or `out/pkg/MDLxL-win32-x64`, and
gives every test its `MDLxL.exe` as `MDLXL_TEST_EXE`. A harness asks
`appTarget()` in `test/helpers/app.cjs`, which returns `{ executablePath, args }`:

1. `MDLXL_TEST_EXE`: that exe, no extra arguments.
2. else `MDLXL_SUITE_PKG`: `MDLxL.exe` in that unzipped release folder.
3. else the development Electron (`node_modules/electron`) with the repo root as
   its app, which loads `dist/`. This is what a harness started by hand without
   either variable gets.

So `release` variants with `MDLXL_SUITE_PKG=<unzipped release>` really test the
release for every harness that reads the variable.

Exceptions:

- `DEV_ONLY` in the script lists harnesses that replace `electron/main.cjs` with
  a stubbed wrapper entry (startup, showcase, close prompts, updater UI). A
  packaged exe cannot load such an entry, so they get an empty `MDLXL_TEST_EXE`
  and always use the development Electron.
- `showcase-actions`, `update-shredder`, `updater-packaged`, `updater-processes`,
  `geoset-merge-conflicts` and `geoset-tabs` copy or patch the whole package and
  get its folder as `MDLXL_TEST_PACKAGE`, from the same target.
- Updater lifecycle tests attach over CDP after an installer-owned restart. Their
  initial process uses `launchApp`; the installer still owns the real relaunch.

## Shared helper

New and migrated harnesses use `test/helpers/` instead of copying boilerplate:

- `app.cjs`: `appTarget()`, `appDist()` (the `dist/` the target loads),
  `bundleHashes()`, `launchApp({ fixture, out, args, env, settings, show, entry, profile, target, cwd })`
  (throwaway profile under `out/`, `MDLVIS_HEADLESS`, the test hook switched on,
  window off-screen and unthrottled, page errors collected, Playwright loaded
  through `MDLXL_PLAYWRIGHT_MODULE` so variants apply), `stubDialogs(app,
  { save, open, message })`, `clickMenu(app, label)`, `sha256File(path)`,
  `settle(page, ms)` and `closeApp(app)`, which also deletes the profile.
- `fiber-probe.cjs`: page functions `launchApp` installs. `mdlxlProbe()` returns
  `{ session, runtime, props }` for the main preview; `findFiberState(selector,
  predicate)` is the generic React-fiber walk for anything else.
- `fixtures.cjs`: `fixturePath('footman')` and the other fixtures in the table, `testModel(path)` for any file in the test-model collection
  above (the runner reads the same table), `gameFolder()` (`MDLXL_GAME_FOLDER`,
  else discovery, else `D:/Warcraft III`) and `tempDir(prefix)`, a new folder
  under `MDLXL_TEMP` or `out/tmp` instead of the system temp folder.
- For source tests: `model-fixtures.js` (`key`, `track`, `bone`, `sequence`,
  `minimalModel`), `assert-near.js` (`assertNear`, `assertVecNear`, always with
  an explicit tolerance), `hive.mjs` (`loadHiveViewer`, `sanityTest`) and
  `pose-compare.mjs` (`comparePoses`, `maxNodeMatrixDifference`).

Electron harnesses share these helpers across all families. A `target` override is
only for a test-owned patched package; `entry` keeps a development wrapper entry.
`bounds: null` preserves a native prompt's own size.
A seeded `profile` must be inside `out`. `closeApp(app, { keepProfile: true })`
retains it only for an immediate restart; the last close removes it. Browser-only
harnesses keep their headless Chromium launch and reuse the applicable helpers.

Synthetic fixtures live under `test/fixtures/`. Private-model and independent
Retera tools live under `test/manual/`; their commands remain in the relevant
verification guides. Build-script staging uses `scripts/lib/paths.mjs`: `repoRoot`,
`outDir()` and a new `tempDir(prefix)` under `MDLXL_TEMP` or `out/tmp`.

## Test hook

When the app starts with `MDLXL_TEST_HOOK=1` (`launchApp` sets it), the preload
reports it and `app/test-hook.js` adds a frozen, read-only `window.__mdlxl`:
`session()`, `document()`, `model()`, `selection()` and `preview(element)` (the
`{ runtime, props }` of the preview drawn in that element, by default the main
editor preview). Without the variable, in normal use and in the browser build,
nothing is added. `mdlxlProbe()` uses the hook and falls back to walking React
fibers, so the same harness also runs against releases made before the hook.

After each test the runner stops what that test left running: processes started
by it, or started from this repo's `out/` folder, and only ones created after the
test started. Your own MDLxL, even one opened from `out/pkg` before the run, is
never touched. Tests use their own profiles, so the runner can work next to other
runs, but two runs of the same variant share `out/suite/<variant>`.

For the 0.28.0 release an `all` run took about an hour per variant and a `core`
run about 20 minutes.
