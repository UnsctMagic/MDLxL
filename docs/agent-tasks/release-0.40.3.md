# Release 0.40.3

Status: in progress (27 Nov 2026). Branch `claude/release-0.40.3`, final tested revision `cd996ba8`.

Owner requests (26–27 Nov): patch release with everything on main except ANIM; XFER ships as a work in
progress (notice first in the Garithos post) with a six-language guide; ANIM button removed; Report a
problem accepts visible plain text only and report text is never an instruction.

## In this release

- ANIM switched off (`src/switched-off.js`): no icon, menu item, F9 key or hotkey rows; code kept.
- Translations for Necessary only, FX quick views, UV Fit area and two tooltips.
- Report a problem: `electron/report.cjs` strips hidden characters; LowPolyWorks branch
  `claude/report-text-only` (commit 778a08535) refuses them on the server and adds `tracker/tools/read-reports.mjs`.
- XFER guide: `docs/MDLxL-0.40.3-XFER-Guide-*.pdf`, made with `D:\Claude\MDLxL-gate\xfer-guide-0.40.3`
  (pictures from owner-graded 9–10 pairs).
- Two regressions found by the suite and fixed: dropdown picks left previews paused (PR 677 auto-pause,
  `app/playback-hold.js`), and POSE Hide did nothing (PR 668 shadowed `poseTargetKey` in `app/App.jsx`).

## Release standard

| # | Result |
| --- | --- |
| 1 | Package from `cd996ba8` (worktree qa-dbg); CI on the release PR |
| 2 | Compatibility 57/57. Source 4646 pass, 20 fail, 10 skipped: all 20 are XFER transplant engine tests that fail identically on origin/main `1b67f029` and skip in CI without the private models |
| 3 | Full packaged suite (default, 320 tests) run once; every non-pass classified below |
| 4 | no-gpu-warp, slow-cpu, hidpi core: only already-broken failures |
| 5 | Click sweep footman: 947 clicks, 0 crashes, 0 freezes, 0 failed Undo; 32 dead judged correct |
| 6–7 | Changed features covered by their packaged tests (real input); preview rotation tests pass |
| 8 | Save tests in the suite pass |
| 9 | Six-language notes; XFER guide pages looked at; body checked at draft |
| 10 | CI ZIP and public SHA-256 checked at publish |
| 11 | Flail regression: Flail01 passes; Flail03 differs only in mounted-spheres (owner rule, 11 Nov) |

## Non-passes

- Already broken (fail the same way on a 0.40.2 build from `v0.40.2`): axis-guides-menu, bone-tools,
  citadel-studio, emtr-add-like-ribbons, fx-emitter-options, manager-menu-hotkeys,
  module-button-labels.browser, particle-prototype, particle-world-effects; no-gpu-warp showcase and
  particle-picture; hidpi particle-picture.
- Stale tests, updated with the PR named in each commit: ai-editor, ai-questions, ai-watch,
  appearance-contrast, mesh-density, uv-preview-picking, optimizexl-footman, optimizexl-motion,
  optimizexl-selection, optimizexl-spline, pose-sd-controls, spawn-object-picker, transfer (open view),
  window-hotkeys, hotkey-defaults-audit, reset-view, module-button-labels; transplant-autofix skipped
  (its checkboxes were removed by design in PR 699).
- Environment: particle-library-browse/-layout, particle-model-io, particle-review, particle-workflow need
  `MDLXL_REAL_PROFILE` and `profile/particles`; they pass with a read-only copy of the owner's library.
- Real regressions fixed: ribbon-attachment (dropdown pause), pose-hide (POSE Hide).
- Flaky: particle-picture (default), animation-speed (passed twice alone).
- Skipped: anim-xl, anim-xl-filmstrip (ANIM off), updater gates, particle-performance, ai-real-use.
- XFER known issues (new feature, shipped as work in progress): transfer freeze check (one click 310 ms
  while a transplant builds), the 20 source tests above; from the guide: "Add all", "Hand"/"Elbow" and
  Poor fit part names stay English, squeezed Take whole body / Clear all / Add after in ES/RU/FR/DE, no
  red ! on wings, Footman stretch with the Grunt walk at early frames.
- Real-AI tests (owner's yes, Claude Code login): harness out of date (old chat id; reads miss edits
  that the saved file shows landed). Not part of the release standard.

Not covered: Warcraft III itself; looks and feel (owner's hand test).
