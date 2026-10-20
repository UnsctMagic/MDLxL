# Packaged-app tests

`test/*.cjs` drive the real MDLxL app with Playwright: mostly the packaged
`MDLxL.exe`, some the development Electron with `dist/`. One command runs all of
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
   `dist/` must be built either way.
2. Playwright is not a project dependency. The runner finds `playwright` or
   `playwright-core` if it can be resolved from the repo; otherwise set
   `MDLXL_REAL_PLAYWRIGHT` to its folder, e.g.
   `D:\Claude\tools\node_modules\playwright-core`.
3. Prepare the fixtures. A test whose fixture is missing is skipped and its
   reason says what to set.

| Fixture | Default | Override | Used by |
| --- | --- | --- | --- |
| SD Footman 1800 from the Warcraft III CASC install (with `Textures/`) | `out/pose/Footman.mdx` | `MDLXL_SUITE_FOOTMAN` | pose, movement gizmo, UV wrapping, AnimXL filmstrip |
| Classic MDX800 Footman | `out/citadel-fixture/Footman.mdx` | `MDLXL_SUITE_CITADEL_FOOTMAN` | Citadel paint |
| Particle index (`node scripts/index-particles.mjs --output out/particle-index/particles`; rebuild after game patches) | `out/particle-index/particles` | `MDLXL_PARTICLE_INDEX` | particle-lifecycle |
| OptimizeXL review model `WH_WOC_KnightKhorneFlail03.mdx` | `out/optimizexl-review/` | `MDLXL_OPTIMIZEXL_REVIEW_MODEL` | optimizexl-review, optimizexl-playback |
| An archer `.mdx` | none | `MDLXL_SUITE_ARCHER` | material-presets |
| `WH_WOC_KnightKhorneFlail03.mdx` | none | `MDLXL_EFFECT_MODEL` | showcase-effects |
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
- `TEMP` and `TMP` point at `out/tmp/<variant>` so temporary files stay in the
  repo's `out/` folder.

Per-test environment variables and arguments (which exe, which fixture) are in
the `SPECIAL` table at the top of the script. Add new tests there when they need
more than the shared environment.

After each test the runner stops what that test left running: processes started
by it, or started from this repo's `out/` folder, and only ones created after the
test started. Your own MDLxL, even one opened from `out/pkg` before the run, is
never touched. Tests use their own profiles, so the runner can work next to other
runs, but two runs of the same variant share `out/suite/<variant>`.

For the 0.28.0 release an `all` run took about an hour per variant and a `core`
run about 20 minutes.
