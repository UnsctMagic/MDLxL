# Automatic Windows software rendering

Status: completed; merged in PR #519
Owner: Codex
Updated: 2026-11-03

## Goal and scope

A Windows user whose default graphics backend cannot create WebGL contexts can
open MDLxL without adding `--use-angle=d3d11-warp` to a shortcut. Keep normal GPU
rendering and explicit `use-angle` / `use-gl` choices. No settings UI, version
bump, installation change or release is included. The owner authorized merging
once checks passed; PR #519 merged after CI succeeded.

## Revision and owners

Branch: `codex/auto-warp`, based on online main `7612078a`.
Merged: [PR #519](https://github.com/UnsctMagic/MDLxL/pull/519), revision
`fa81f005c8c66aeee4bc385481ff3d73f9d8fb51`. The startup call and WARP implementation were verified on online main.
Startup owner: `electron/main.cjs`; check/retry: `electron/software-rendering.cjs`.
Packaged regression: `test/software-rendering.electron.cjs`.

## Implementation

Before loading settings, beginning the session journal or opening editor windows,
a sandboxed unattached WebContentsView tries real WebGL 2 and WebGL 1 contexts
and releases them. If either is unavailable, Windows restarts once with WARP,
retaining launch arguments. An explicit backend bypasses the automatic check,
including the retry's WARP argument, preventing repeated relaunches. Other
platforms keep their existing startup. The probe has no visible window and its
WebContents is closed in finally.

## Verification

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

- GitHub CI run 41659762605: build, compatibility and full source-suite steps passed before merge.

## Remaining acceptance

Claude owns independent QA and the release gate. The friend's actual machine,
GPU-process fatal crashes/hangs, normal mouse camera interaction and Warcraft III
were not exercised. This handles failed context creation before editing; it does
not restart a running editing session after a later context loss.

Disposable package/profile/runtime files are removed after checks. Logs and the
small report remain under `D:/Codex/mdlxl-auto-warp-report`.
