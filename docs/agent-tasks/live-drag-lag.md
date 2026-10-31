# Live drags: once per frame

Status: ready for review; awaiting merge approval
Owner / consolidator: Claude Code
Updated: 2026-10-31

## Goal and completion criteria

- Owner report: moving mesh in the UV Wrapper lags. Cause: drags did their work on
  every pointer event (hundreds per second) instead of at most once per display frame.
- Owner: fix every drag with the same problem, no regressions, and write the rule
  down so it does not return. Rule: [architecture rules](../ARCHITECTURE.md);
  enforced by [live-drag-frames](../../test/live-drag-frames.test.js).

## Revision and local state

- Branch: `claude/drag-lag` from `origin/main` b1758f4b.
- Fixtures copied from the release-0.36.1 worktree: `out/pose`, `out/citadel-fixture`,
  `out/optimizexl-review`, `profile/particles`, `profile/game-data-discovery.json`;
  FFmpeg copied from the main checkout.

## Relevant owners

- `createFrameCoalescer` in [viewport-performance.js](../../app/viewport-performance.js):
  `schedule()` per event, `flush()` on pointer up, `cancel()` on cancel/unmount.

## Changes

Every drag listed in `test/live-drag-frames.test.js` now does its work once per frame:
UV Wrapper (and the 3D preview reloads only dragged geosets), vertex transforms, Forge
part drags, zoom-anchor marquee, hover picking in Viewport and GamePreview, camera-angle
reports (Viewport, Paint, GamePreview), preview bone/POSE drags and marquee, AI sketch
line, movable windows, timeline scrub, Paint (lamp, face sweep, texture mask, cutout,
divider, image zoom), Forge mask editor, Glow Up, Auto Corpse, EMTR handles/markers/
placement/ribbon keys, AnimXL strip, Showcase layers/crop, Model Manager collision,
UV splitters, AI console resize, geoset list resize, emitter text tooltip.

Deliberately unchanged (reasons in code or here):
- Sketch stroke samples and the sketch eraser: every sample changes the result.
- Paint face sweep raycasts every recorded sample (fast sweeps keep every face).
- Showcase `moveDragPoint` stays per event: it locks the Shift axis from the first delta.
- Particle Clueless sliders: controlled inputs, delaying makes the thumb jitter.
- Floating Geosets panel (`AppSidebar.jsx`): drop commits the rendered position; a
  flush would save one frame behind. Small panel; needs a restructure to change.

Tests adjusted for one-frame updates (same assertions, they now wait a frame):
`model-manager-regressions.electron.cjs` live draft, `particle-parent.electron.cjs`
held value, `paint-image-navigation.test.js` zoom drag (steps a manual frame).

## Verification

- `node --test test/*.test.js`: 2594 tests, 0 failures.
- Packaged run on an early build (UV only), 22 drag/UV/timeline tests: 21 pass, 1 skip
  (fixture, since copied).
- Full packaged suite and reruns: see [PR #477](https://github.com/UnsctMagic/MDLxL/pull/477); only citadel-locales (also fails on main) and update-popup-fallback (symlink permission) fail.

## Blockers and next action

- Owner hand-tests the build in `D:\Claude\MDLxL-TestBuilds\Live-Drags`; then merge.
