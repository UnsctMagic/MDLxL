# Automatic Windows software rendering

Status: ready for review; awaiting merge approval
Owner: Codex
Updated: 2026-11-03

## Goal and scope

A Windows user whose default graphics backend cannot create WebGL contexts can
open MDLxL without adding `--use-angle=d3d11-warp` to a shortcut. Keep normal GPU
rendering and explicit `use-angle` / `use-gl` choices. No settings UI, version
bump, installation change, release or merge is included.

## Revision and owners

PR #519 merged the original fallback. Follow-up branch: `codex/webgl-probe-test-runs`, based on online main `db5121ce`.
Startup owner: `electron/main.cjs`; check/retry: `electron/software-rendering.cjs`.
Packaged regression: `test/software-rendering.electron.cjs`; unit coverage: `test/software-rendering.test.js`.

## Implementation

Before loading settings, beginning the session journal or opening editor windows,
a sandboxed unattached WebContentsView tries real WebGL 2 and WebGL 1 contexts
and releases them. If either is unavailable, Windows restarts once with WARP,
retaining launch arguments. An explicit backend bypasses the automatic check,
including the retry's WARP argument, preventing repeated relaunches. Other
platforms keep their existing startup. The probe has no visible window and its
WebContents is closed in finally.

Automated runs (`MDLXL_TEST_HOOK=1`) skip this probe so Playwright's
`firstWindow()` receives the editor rather than the short-lived probe page.
Dedicated startup regressions set `MDLXL_TEST_WEBGL_PROBE=1` to opt back in,
covering real context creation and the WARP relaunch. Normal user startup and
explicit graphics-backend bypasses remain unchanged.

## Automated-test compatibility follow-up

The release suite exposed the probe page closing after Playwright selected it.
The follow-up changes only the test-run gate and opts the existing packaged
startup regression back into the check.

- Fail-first: all three new skip cases failed on the original owner (`true !== false`).
  The packaged `ai-console` also failed on the original owner after 2 seconds:
  `Cannot read properties of undefined (reading 'unmaximize')`.
- Focused unit checks: 10 pass / 0 fail / 0 skip.
- `npx vite build`: passed (existing chunk-size warnings).
- `node --test tests/*.test.js`: 57 pass / 0 fail / 0 skip.
- `node --test test/*.test.js`: 2,796 pass / 0 fail / 10 existing platform/private-fixture
  skips. The unchanged known-failure baseline has no entries; no new failures.
  The report lists each skip's existing gate.
- `node scripts/package.mjs --out out/pkg`: passed; 1,422 runtime/assets and 55 locales verified.
- Hidden desktop, default variant, Playwright from `D:/Claude/tools/node_modules/playwright-core`:
  `startup`, `ai-console`, `ai-awareness`, `software-rendering`: 4 pass / 0 fail / 0 skip.
  The runner's existing `startup` entry uses the development wrapper; both AI
  checks and the WARP regression use the package. No page-closed failures.
- Opted-in WARP regression: normal / unavailable WebGL / explicit WARP all passed
  (1 / 2 / 1 launches), real Footman loaded, WebGL usable; fallback and explicit
  runs reported Microsoft Basic Render Driver.

Claude owns independent release QA and the merge decision. No full packaged
suite, Warcraft III check, hardware-failure reproduction, merge, version bump or
release was performed. Disposable builds/profiles and task processes are removed;
follow-up evidence is in `D:/Codex/webgl-probe-fix-report`.

## Original PR #519 verification

- `pnpm run build`: passed (existing chunk-size warnings).
- `pnpm run package -- --out out/pkg`: passed; 1,423 runtime/assets and 55 locales verified.
- Packaged `node test/software-rendering.electron.cjs`: 3 pass / 0 fail / 0 skip.
  Normal startup kept NVIDIA D3D11 and used one process launch. Unavailable
  WebGL retried with WARP and used two launches. Explicit WARP used one launch.
  Every case opened the real command-line Footman model (five geosets), and
  fallback/explicit runs reported Microsoft Basic Render Driver.
- Focused desktop bridge, external model opening and session-journal checks: 8 pass / 0 fail / 0 skip.
- Fail-on-old-code proof: replacing only disposable package main.cjs with
  origin/main failed `fallback: expected automatic WARP retry when WebGL is
  unavailable`, actual 1 versus expected 2 launches; WebGL was false.
- Failure setup uses real `--disable-gpu --disable-software-rasterizer` flags.
  Fixture instrumentation removes those test-induced flags only from the real
  relaunch so the second process can exercise WARP. This simulates unavailable
  WebGL on an otherwise working GPU machine; it is not the friend's hardware.
- Checks observe the editor DOM, read-only model hook and actual Chromium renderer;
  they do not invoke editor actions or replace its context-creation result.

## Remaining acceptance

Claude owns independent QA and the release gate. The friend's actual machine,
GPU-process fatal crashes/hangs, normal mouse camera interaction and Warcraft III
were not exercised. This handles failed context creation before editing; it does
not restart a running editing session after a later context loss.

Disposable package/profile/runtime files are removed after checks. Logs and the
small report remain under `D:/Codex/mdlxl-auto-warp-report`.
