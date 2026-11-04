# Live UV drag performance

Status: ready for Claude QA; awaiting merge approval
Owner / consolidator: Codex
Updated: 2026-11-04

## Current follow-up

- Branch: `codex/uv-drag-smooth`, based on main `f67cbb5564c9e5f47a1b4f3c2a5ab0d661738efa`.
- Request: keep UV Move and Rotate smooth while retaining the live model preview.
- Installed 0.38.0 forwards each live UV model into the main Viewport behind the
  UV window. Its model effect recreated every geometry/material/overlay per frame.
  Frame coalescing from the earlier task remains in place; this is additional work
  inside each coalesced frame.
- `app/Viewport.jsx` reuses `isUVOnlyPreviewChange` from GamePreview's data helper.
  Within an unchanged document revision and shading configuration it updates only
  changed layer UV buffers and their animation base UVs. Geometry/material changes,
  commit and history still use the normal rebuild path. Both viewports remain live.
- `app/UVEditor.jsx` uses stable empty selection defaults so parent preview renders
  do not trigger redundant map draws. Closed triangle paths are assembled in batches
  of 64 and stroked once, preserving the same joins and appearance.
- No changes to drag math, mouse bindings, selection, camera rules, model content,
  app version, installed app or personal profile.

## Verification of this follow-up

- New `test/uv-drag-smooth.electron.cjs`: real clicks/keys/drags in the packaged app
  on the hidden Windows desktop; permanent Footman and Khorne Flail fixtures.
  37 checks pass, 0 fail, 0 skip: pixels and UV data update while held, no geometry
  or material recreation, release/undo/Escape, unchanged cameras and real orbit.
- Fail-first on installed 0.38.0: all four Move/Rotate resource-retention checks
  failed (25 geometry generations per 24-step drag). Original exact floating-point
  camera equality also failed on ~1e-12 OrbitControls roundoff; the probe now rounds
  to 1e-9, retaining meaningful camera-position checks.
- Final larger-model p95 animation-frame gaps: 10 ms for Move and Rotate versus
  about 50 ms before. Geometry generations: 25 -> 1. These are same-machine hidden
  desktop measurements, not a universal FPS guarantee. Move included one 205 ms
  initialization spike; profiling also saw native shader initialization in that run.
- Isolated drawing proof using the same 3,416 real triangles: growing path ~21 ms,
  64-face batches ~1.5 ms, identical pixels. Full Khorne map captures for both tools
  also match before/after exactly.
- `uv-tab-window` passed on final package. `single-view-vertex-move` passed on the
  same final Viewport code (later changes only touched 2D UV drawing).
- Focused source tests: 116 pass, 0 fail, 0 skip (`viewport-correctness`, `movement`,
  `uv-tools`, `live-drag-frames`). Build and package checks passed.
- Evidence: `D:\Codex\mdlxl-uv-drag-smooth-report`. Disposable package/profile,
  profiling scripts and raw traces are removed after verification.
- Claude QA, owner testing in the user's live session, and Warcraft III gameplay
  were not run. PR review/merge approval remains the next step.

## Previous frame-coalescing work (2026-10-31; historical)

### Goal and completion criteria

- Owner report: moving mesh in the UV Wrapper lags. Cause: drags did their work on
  every pointer event (hundreds per second) instead of at most once per display frame.
- Owner: fix every drag with the same problem, no regressions, and write the rule
  down so it does not return. Rule: [architecture rules](../ARCHITECTURE.md);
  enforced by [live-drag-frames](../../test/live-drag-frames.test.js).

### Revision and local state

- Branch: `claude/drag-lag` from `origin/main` b1758f4b.
- Fixtures copied from the release-0.36.1 worktree: `out/pose`, `out/citadel-fixture`,
  `out/optimizexl-review`, `profile/particles`, `profile/game-data-discovery.json`;
  FFmpeg copied from the main checkout.

### Relevant owners

- `createFrameCoalescer` in [viewport-performance.js](../../app/viewport-performance.js):
  `schedule()` per event, `flush()` on pointer up, `cancel()` on cancel/unmount.

### Changes

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

### Verification

- `node --test test/*.test.js`: 2600 tests, 0 failures (final build).
- Packaged run on an early build (UV only), 22 drag/UV/timeline tests: 21 pass, 1 skip
  (fixture, since copied).
- Full packaged suite and reruns: see [PR #477](https://github.com/UnsctMagic/MDLxL/pull/477); only citadel-locales (also fails on main) and update-popup-fallback (symlink permission) fail.

### Blockers and next action

- Owner hand-tests the build in `D:\Claude\MDLxL-TestBuilds\Live-Drags`; then merge.
