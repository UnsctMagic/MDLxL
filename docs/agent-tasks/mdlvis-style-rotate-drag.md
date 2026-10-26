# MdlVis-style Rotate drag

Status: active — implementation complete; final packaged verification running
Owner / consolidator: Codex (implementation); Claude Code (project lead, review)
Updated: 2026-10-26

## Goal and completion criteria

Rotating a bone or node with the Rotate tool must feel like MdlVis: you push the
mouse in a straight line and the part turns steadily around a fixed grid axis.
No circling, no surprise reversal, no axis that tilts with the bone.

Reported by a long-time MdlVis animator (HerrDave), confirmed by the owner, who
says they feel it too but got used to it:

> rotation isn't turning right. Instead of consistently up/down or left/right,
> it only responds to cranking motions, and sometimes goes backwards. I think
> it's rotating along the bone's axis instead of the grid's fixed axis, and
> turning with an invisible lever instead of in MdlVis-fashion. It took me ~20
> minutes to animate a floating sword & shield.

Done means all of these hold in the packaged app with real mouse drags:

1. **Straight drag = steady turn.** Dragging right turns one way, left the other,
   at a constant rate per pixel. Dragging up/down works the same (one of the two
   directions is the turn, the other does nothing or the same turn, pick one rule
   and keep it for every axis). Angle depends only on how far the mouse moved,
   never on where it is relative to the pivot.
2. **Never backwards.** The same mouse direction always gives the same turn
   direction for a given axis and view, for the whole drag and between drags. It
   does not flip depending on which side of the pivot you grab, which way the
   arrow happens to point on screen, or whether the axis faces away from the camera.
3. **Grid axes by default.** Rotate turns around the fixed model X/Y/Z axes
   (what MdlVis does), not the bone's own tilted axes. Bone-local turning stays
   possible only as a deliberate opt-in; it is not the default.
4. **No cranking mode.** The circular "arc around the pivot" behaviour is gone
   from ordinary Rotate drags.
5. Shift still snaps to 5°, pointer sensitivity still applies, Esc/right-click
   still cancels, undo is one step per drag, and the live degree label still shows.
6. Camera rotation with the mouse still works in the preview (AGENTS.md rule).

Out of scope: POSE limb solving (`solvePoseLimb`), AnimXL, Move and Resize, new
panels or toolbars. Do not add a settings page for this.

## Revision and local state

- Branch: `codex/mdlvis-rotate-drag`, from current `origin/main` at
  `a4c866216fd5a32dbf3ff0b8d504f3f60e626ac2` (2026-10-26 fetch).
- The source contract was untracked in the owner's checkout on
  `claude/update-usage-ping` at `fabf4f8d`; it was copied into this branch.
  The owner's source files and installed app/profile were not changed.
- PR into `main` with a `Session:` line: pending packaged verification.
- Keep the Current tasks entry while owner testing and merge approval remain.

## Relevant owners

- [movement-overlay.js](../../app/movement-overlay.js):
  `movementRotationGesture` / `movementRotationAmount` capture the fixed screen
  basis and convert displacement to degrees. `movementRotationFacing` was
  removed; `movementViewRotationHandle` chooses the nearest model axis for a
  bare-marker drag. `pickMovementHandle` leaves the marker center available.
- [GamePreview.jsx](../../app/GamePreview.jsx): `beginRotationDrag`, ordinary
  node pointer handling, shared POSE rotation input, preview and commit path.
- [App.jsx](../../app/App.jsx): `movementSpace` starts as `world`.
  [MovementControllerRecomp.jsx](../../app/MovementControllerRecomp.jsx) and the
  preview/handle defaults match. Explicit `local` inputs remain supported.
- [movement.js](../../src/movement.js): existing `applyMovementTransform` owns
  world/local quaternion conversion. `rotateOnOwnAxis` changes the center to
  skinned geometry; it does not select local space. Neither mechanism changed.
- [MERGER_NOTES.md](../../MERGER_NOTES.md) and the Movement/Viewport rows of
  [agent-map.md](../agent-map.md) establish the retained toolbar/workplane rules.

## Findings and decisions

- Original cause, verified against the branch base: first motion selected
  `along`, `across` or `arc`. Arc used the swept pivot angle, along used the
  projected arrow, and across used camera-facing sign. The app defaulted to
  local bone axes.
- Implemented rule: degrees = `(dx - dy) × sensitivity`, one degree per pixel
  at normal sensitivity. Right/up are positive; left/down are negative; equal
  right/down displacement cancels. There is no first-motion mode selection,
  pivot lever, camera sign, or accumulated circular angle. A closed path returns
  to zero. Shift snapping remains in the existing handler.
- Default axis space is world/grid. Explicit local transform inputs still work.
  There is no persisted axis-space preference or visible Local/World switch;
  no settings page or new control was added.
- A bare-marker Rotate drag had no competing free-rotation behavior. It now
  picks the nearest model X/Y/Z axis to the camera normal at pointer-down and
  uses world space. The axis stays fixed throughout that drag. Existing
  workplane drags still choose their plane normal. Modified selection clicks
  remain available.
- Real-mouse verification found no right-click rollback in ordinary Rotate on
  the branch base. The existing pointer-move handler now routes the second
  mouse button to the existing cancellation path, only for ordinary Rotate.
  A minimal real-mouse Chromium proof confirmed that a held left drag emits
  pointer-move with button state 3 on right press; compatibility mouse-down is
  suppressed after the drag prevents pointer-down.
- Handles and their rendering are unchanged. Marker centers are reserved for
  direct rotation; caps retain priority and shafts remain draggable.
- Shared POSE Rotate input uses the linear rule. Explicit local Body/Object
  and world Endpoint transform semantics remain tested; `solvePoseLimb`,
  `solvePoseNode`, Move, Resize and AnimXL implementations are unchanged.
- Exact MdlVis direction/diagonal behavior remains provisional until HerrDave's
  recording arrives. This implements the contract's right/up interim rule.

## Changes and verification

- Test first: replaced the arc/radial assumptions in
  [movement.test.js](../../test/movement.test.js); all three new drag tests
  failed against the unchanged implementation. The focused Movement/POSE suite
  then passed: 93 pass, 7 existing skips.
- `pnpm test`: 57 passed, no failures.
- `pnpm run test:source`: 1,975 passed, 22 existing skips, no failures.
- `pnpm run build`: passed (existing bundle-size warning).
- Disposable Windows package: production packager verified 1,216 runtime/asset
  files and 55 locale files. No dependencies were copied into the worktree.
- [rotation-interaction.electron.cjs](../../test/rotation-interaction.electron.cjs)
  now uses a tilted rest quaternion, straight real mouse drags on every axis
  from front/back/perspective, tips/shafts, bare markers, both pivot sides on
  workplanes, left/up motion, a closed circular path, snapping, sensitivity,
  cancellation, one-step undo, live labels and actual Alt+mouse camera rotation.
  Packaged result: corrected run in progress; do not claim acceptance yet.
- Harness finding: Undo reconstructs the native renderer at frame zero before
  evaluating frame 500. The first run sampled initialization matrices after a
  fixed 100 ms delay. The corrected harness waits for the requested evaluated
  frame before comparing rotations. Cancellation checks also wait for the
  baseline matrix to return before starting the next drag. Production rendering
  behavior was not changed for these harness readiness fixes.
- Evidence is retained under `D:\Codex\mdlvis-rotate-drag\results`.
  Disposable package, profiles, fixture and task processes are removed after
  verification. Finished worktree is removed after pushing.

## Blockers and next action

- No product blocker. Finish corrected packaged checks, record PR/revision and
  leave the branch unmerged for owner testing.
- Owner acceptance is still required: animate a floating sword and shield.
  HerrDave's MdlVis recording and native Warcraft III acceptance were not part
  of this run.
- Owner click-through in a build of this PR: open a model, go to Movement,
  choose an animation/frame and a bone, choose Rotate, then drag X/Y/Z straight
  right/left and up/down. Turn the camera around and repeat. Try the bone marker
  itself, Shift, Esc/right-click and Undo; finish by animating the sword/shield.
