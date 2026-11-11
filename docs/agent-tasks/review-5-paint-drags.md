# Contract 5: Paint brush-size drag and the live-drag guard list

Status: ready for Codex
Owner / consolidator: Codex (fix), Claude Code (contract and review)
Updated: 2026-11-11

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

Tests to add first (each must fail on the base):

- The three new entries in `test/live-drag-frames.test.js`.
- `test/citadel-pro.electron.cjs`: real Ctrl + right drag changes the Brush size field;
  Escape during the drag returns it to the start value; release keeps the new value.
- A source test: `PaintViewport` `cameraAction` contains no raw `event.altKey` check.

Run those plus `test/paint-contract.test.js`, `test/paint-uv-layout.test.js` and the
packaged Paint test the map row names for mouse rotation in the paint 3D view.

## Blockers and next action

- None. On completion: status, revision and checks here; plain summary for the owner;
  hand back.
