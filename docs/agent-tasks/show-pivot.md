# Show pivot (Movement)

Status: ready for review
Owner / consolidator: Claude Code (session local_2c30e3da-07ed-4506-81d1-2e0d2e59deeb)
Updated: 2026-10-28

## Goal and completion criteria

- Owner wants to find where a movement comes from by clicking the moving part,
  not by hunting for a small bone box that moves. Approved mockup: a big ring
  at the pivot, a line to the clicked spot, the spot's path through the
  animation, other bone boxes out of the way, click the ring to select the bone.
- No new panel, button or menu. One gesture, dismissible with Esc.

## Revision and local state

- Branch / checkout: `claude/show-pivot` in `.claude/worktrees/show-pivot`.
- Base: `origin/main` at 912ecf40.
- Required local fixtures: none (the Electron check builds a synthetic model).

## Relevant owners

- `src/pivot-finder.js`: `findMotionPivots` (which bones move one vertex in a
  sequence), `pivotsAtFrame` (ring and spot positions at the current frame).
- `src/animation.js`: `sampleNodeMatrices` gained an optional `frozen` map
  (node id -> frame) used to freeze one bone at a time.
- `app/GamePreview.jsx`: `probePivot` (double-click), ring drawing in the path
  overlay (`PIVOT_COLOR`, `pivotScreens`, `data-pivots`), ring click in
  `pointerDown`, bone boxes hidden while rings show (`shownNodes`).
- `app/App.jsx`: `pivotProbe` state, `probePivot`, Esc via `mdlxl-escape-key`.

## Findings and decisions

- Decision: the gesture is **double-click** on a part in Movement with an
  animation chosen. Alt+click already rotates the camera and Ctrl+click picks a
  geoset; double-click on an emitter still picks the emitter first.
- Decision: a bone's share is the motion of the clicked spot that disappears
  when that bone alone is frozen at the sequence start. Bones whose keys never
  change in the sequence are skipped. Up to three rings, those with at least
  15% of the strongest; the strongest is bright with a crosshair and name.
- Verified: the app's global Esc handler consumes the key before the preview
  sees it, so Esc must use the cancelable `mdlxl-escape-key` event.
- Rings, line and trail use the orange from the approved mockup with a black
  edge, so they stay visible on the orange Bone influence view.

## Changes and verification

- Checks: `node --test test/pivot-finder.test.js` (5 pass);
  `pnpm run test:source` 2082 tests, 0 failures; `pnpm run build` ok;
  `test/show-pivot.electron.cjs` on the hidden desktop with dev Electron and
  `dist/`: double-click finds Blade_Root, one ring, ring click selects it, Esc
  clears, Alt+drag still turns the camera.
- Remaining: not tried on the owner's own large models (e.g. the vampire dragon
  with a rider); not checked in the packaged exe.

## Blockers and next action

- Owner test on a real model, then merge approval.
