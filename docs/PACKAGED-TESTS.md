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
3. Prepare the fixtures. A test whose fixture is missing is skipped and its
   reason says what to set.

| Fixture | Default | Override | Used by |
| --- | --- | --- | --- |
| SD Footman 1800 from the Warcraft III CASC install (with `Textures/`) | `out/pose/Footman.mdx` | `MDLXL_SUITE_FOOTMAN` | pose, movement gizmo, UV wrapping, AnimXL filmstrip, event focus, Attachemator |
| Classic MDX800 Footman | `out/citadel-fixture/Footman.mdx` | `MDLXL_SUITE_CITADEL_FOOTMAN` | Citadel paint |
| Particle index (`node scripts/index-particles.mjs --output out/particle-index/particles`; rebuild after game patches) | `out/particle-index/particles` | `MDLXL_PARTICLE_INDEX` | particle-lifecycle |
| OptimizeXL review model `WH_WOC_KnightKhorneFlail03.mdx` | `out/optimizexl-review/` | `MDLXL_OPTIMIZEXL_REVIEW_MODEL` | optimizexl-review, optimizexl-playback |
| An archer `.mdx` | none | `MDLXL_SUITE_ARCHER` | material-presets |
| `WH_WOC_KnightKhorneFlail03.mdx` | none | `MDLXL_EFFECT_MODEL` | showcase-effects |
| SD Chaos Knight (with hoofprint events) from the Warcraft III CASC install | none | `MDLXL_SUITE_HOOFPRINT` | footprint-travel |
| Google Chrome | `C:/Program Files/Google/Chrome/Application/chrome.exe` | `MDLXL_CHROMIUM_PATH` | module-button-labels.browser |

The pose Footman can be read from the game with `electron/casc.cjs`:
`new CascReader('<Warcraft III folder>', process.cwd()).read('war3.w3mod:units\\human\\footman\\footman.mdx')`.

Some tests are always skipped (`SKIP` in the script): manual tools such as the
updater release gate, and tests that need private models or old builds.

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
- `fixtures.cjs`: `fixturePath('footman')` and the other fixtures in the table
  above (the runner reads the same table), `gameFolder()` (`MDLXL_GAME_FOLDER`,
  else discovery, else `D:/Warcraft III`) and `tempDir(prefix)`, a new folder
  under `MDLXL_TEMP` or `out/tmp` instead of the system temp folder.
- For source tests: `model-fixtures.js` (`key`, `track`, `bone`, `sequence`,
  `minimalModel`), `assert-near.js` (`assertNear`, `assertVecNear`, always with
  an explicit tolerance), `hive.mjs` (`loadHiveViewer`, `sanityTest`) and
  `pose-compare.mjs` (`comparePoses`, `maxNodeMatrixDifference`).

Electron harnesses share these helpers across all families. A `target` override is
only for a test-owned patched package; `entry` keeps a development wrapper entry.
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
