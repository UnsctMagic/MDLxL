# Contract 5: Paint brush-size drag and the live-drag guard list

Status: completed locally, ready for Claude review
Owner / consolidator: Codex (fix), Claude Code (contract and review)
Updated: 2026-11-11
Branch: `codex/main-review-20261111-5`
Fix revision: `c51c7fcb23e9f37d330ad4c2f45b87571a6bc198`

Findings E1 to E4 of the [main review](main-review-2026-11-11.md). Read its "Rules for
every contract" first, then [architecture rules](../ARCHITECTURE.md) ("Only do work
someone can see"). Map row: "Citadel Paint".

## Goal and completion criteria

1. **E1.** Ctrl + right-drag brush size, in both Paint views, does its work at most once
   per display frame. The pointer handler only records the newest offset and calls
   `schedule()` on a `createFrameCoalescer` (`app/viewport-performance.js`); the
   `onBrushAdjust` call runs in the frame callback. In the 3D view use the view's
   existing drag coalescer (`scheduler.frames`), as the lamp drag does. Pointer up
   calls `flush()` first, so the final size is where the hand stopped.
2. **E2.** Escape, a lost mouse press and unmount cancel the drag (`cancel()`) and put
   brush size and hardness back to their values at the press, like the lamp drag.
   `brushAdjustStart` in `PaintWorkspace.jsx` already holds them.
3. **E3.** Paint's Alt + middle pan, Alt + right zoom and `altMiddleFree` read the
   user's orbit key through `modifierHeld(event, 'view.orbit', preferences)`, and the
   slow lamp drag reads the fine key through `dragKeys`, as the rest of the app does
   since #602. Ctrl + right for brush size stays a fixed Paint gesture. Hint and help
   text in Paint show the keys actually in use.
4. **E4.** `test/live-drag-frames.test.js` lists the two brush-adjust handlers and the
   stage Rotate drag (`app/StageRotate.jsx`, `move`), each with the calls that must not
   happen per pointer event (`onBrushAdjust`, `setBrush`; `onTurn`).

Out of scope: brush maths, stroke sampling (per-sample recording is correct there),
any Paint layout or new setting.

## Revision and local state

- Base: local `claude/main-review-2026-11-11` (`main` at `a8a4ca86`).
- Overlap: `claude/fx-editor` adds one line to `test/live-drag-frames.test.js`.

## Relevant owners

- `app/PaintViewport.jsx` (press at the `brushAdjust` action, move, `cancelGesture`,
  `cameraAction`, `lampFine`), `app/usePaintImageNavigation.js` (`pan.current` type
  `brush`), `app/PaintWorkspace.jsx` (`adjustBrushByDrag`, `brushAdjustStart`).
- `src/modifier-bindings.js` (`modifierHeld`, `dragKeys`), `app/StageRotate.jsx`.

## Findings and decisions

- Verified by reading at `a8a4ca86`: both move handlers call `onBrushAdjust({dx, dy})`
  straight from the pointer event; it calls `setBrush`, which re-renders
  `PaintWorkspace` and rebuilds the brush outline image. Neither handler is in the
  guard test. `cancelGesture` restores only the lamp and paint gestures.
- The stage Rotate drag itself is correct (records, then one `onTurn` per frame); it is
  only missing from the guard list.

## Changes and verification

Owner summary: Ctrl + right-drag updates brush size and softness smoothly in both
Paint views. Escape restores both values, and releasing keeps the final adjustment.
Paint navigation and its help now use the assigned mouse keys.

- The model view uses its existing render scheduler for brush drags. The texture view
  schedules the newest offset in a frame callback. Release flushes the pending move.
  Escape, lost presses and unmount cancel pending work and restore the values at press.
- Paint uses the assigned orbit modifier for its model camera gestures and image
  navigation sensitivity, and the Rotate fine modifier for the lamp drag. The fixed
  Ctrl + right brush gesture keeps priority if the orbit key is Ctrl.
- The drag guard now covers both brush handlers and Stage Rotate. Stage Rotate passed
  the new guard on the base, so its implementation needed no change.

Checks on base `4340c5f8`

- `node --test test/live-drag-frames.test.js` — 45 passed, 3 failed, 0 skipped.
  Both brush handlers failed the frame-scheduling assertion, and the camera handler
  failed the raw Alt assertion.
- `node scripts/run-packaged-tests.mjs default citadel-pro` — 1 failed, 0 skipped.
  The assertion “Escape restores the starting size and softness in both Paint views”
  reported both `model` and `texture`. Release already kept the final values.
- `node scripts/run-packaged-tests.mjs default paint-tab-camera` — 1 failed, 0 skipped.
  “The rebound Shift + middle drag pans even when plain middle toggles Work/Rotation”
  failed with an unchanged camera target.

Checks on fix `c51c7fcb`

- `node --test test/live-drag-frames.test.js test/paint-contract.test.js test/paint-uv-layout.test.js test/paint-model-integration.test.js test/viewport-performance.test.js test/viewport-correctness.test.js`
  — 109 passed, 0 failed, 0 skipped.
- `node node_modules/vite/bin/vite.js build` and
  `node scripts/package.mjs --out out/pkg --overwrite` — built and verified the local package.
- `node scripts/run-packaged-tests.mjs default citadel-pro,paint-tab-camera,paint-image-navigation`
  — 3 passed, 0 failed, 0 skipped on the hidden Windows test desktop with the Classic
  Footman. Verified Escape and release in both views, default Alt + left rotation,
  rebound Shift + middle pan and Shift + right zoom, matching Paint hints and help,
  per-tab camera memory, and existing Paint/Forge image navigation.
- Lost press, unmount and the lamp-drag binding were checked in code. Real input
  covered Escape, release and camera navigation. Warcraft III gameplay was outside
  these checks.

## Blockers and next action

- Ready for Claude to review the local branch. Saved on your PC, not online.
