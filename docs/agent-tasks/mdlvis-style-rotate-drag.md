# MdlVis-style Rotate drag

Status: ready to test — verified; Claude review handoff queued
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

The owner expanded the scope on 2026-10-26: apply the input rule across editing
Rotate tools, default to Linear (MdlVis), offer Pivot-based behavior and sensitivity
with independent per-editor overrides in Mouse settings, and organize Mouse with
subsections and a side menu like Appearance. This supersedes the original ban on
settings UI. POSE solving, AnimXL algorithms, Move, Resize and camera navigation
remain outside the change. Existing handles, pivots, constraints and history stay.

Current extension owners: `src/rotation-drag.js` (shared input/preferences),
`src/preferences.js`, `app/Settings.jsx`, `app/Viewport.jsx` (vertices and Forge),
`app/UVEditor.jsx`, `app/GamePreview.jsx` (Movement/POSE and Showcase model), and
`app/ShowcaseLayers.jsx` (text). Citadel Paint exposes selection/painting, not a
mesh Rotate tool; its brush and camera controls are not editing Rotate drags.
One editor selector will expose overrides without a large settings table.
The owner's open manual test is the earlier PR build and stays untouched.

## Revision and local state

- Branch: `codex/mdlvis-rotate-drag`, from current `origin/main` at
  `a4c866216fd5a32dbf3ff0b8d504f3f60e626ac2` (2026-10-26 fetch).
- The source contract was untracked in the owner's checkout on
  `claude/update-usage-ping` at `fabf4f8d`; it was copied into this branch.
  The owner's source files and installed app/profile were not changed.
- Implementation/test revision: `dfbfc4e9fb567ab2aca39b219b944db8d448bf60`.
- PR: [#327](https://github.com/UnsctMagic/MDLxL/pull/327) into `main`, with the
  `Session:` line. Open and unmerged. The owner now authorizes merge only if Claude
  approves its review, using Opus 5.5 at medium effort. After handing it off,
  Codex must go idle. Claude should return a concrete task to this Codex chat
  if changes are needed (chat `01a17864-2f9a-77a1-aed8-4cdebfa613d8`).
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

## Original Movement implementation (verified before the expanded request)

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

## Original Movement verification

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
  Packaged result: **341 checks passed, zero failures and zero renderer errors**.
  Confirmed one hidden window, no popups, and actual Alt+mouse camera rotation
  with Workplane both off and on. Bundle SHA-256:
  `0d0864b6813d0b7e7f07d60714c71b77b27d5e9ca1dfeac50a37b3d25905cc87`.
- Harness finding: Undo reconstructs the native renderer at frame zero before
  evaluating frame 500. The first run sampled initialization matrices after a
  fixed 100 ms delay. The corrected harness waits for the requested evaluated
  frame before comparing rotations. Cancellation checks also wait for the
  baseline matrix to return before starting the next drag. Production rendering
  behavior was not changed for these harness readiness fixes.
- Evidence is retained under `D:\Codex\mdlvis-rotate-drag\results`.
  Disposable package, profiles and fixture were removed after verification;
  test processes exited. Finished worktree is removed after pushing.

## Expanded implementation and current verification

- All editing Rotate paths share `src/rotation-drag.js`. Fresh and older
  profiles default to Linear (MdlVis), at 1× rotation sensitivity. Pointer/UV
  sensitivity still multiplies that value; camera, Move and Resize are unchanged.
- Mouse → Rotation is headed **Rotational Behavior**. Choose **All editors
  (default)** or one editor: Vertices, Bones, Movement / POSE, Forge, UV Wrapper,
  Showcase. Behavior and sensitivity can each inherit or override the default.
  Configuration export/import preserves the sparse overrides. Restore mouse
  defaults resets the global choice and clears every editor override.
- Mouse now has Camera, Rotation, Wheel, Pointer and UV subsections, using the
  existing Appearance side-menu layout. One editor's controls appear at a time.
- Linear uses raw pointer displacement with a constant right/up-positive rule.
  Pivot-based measures the angle around the existing selection center and unwraps
  successive samples for continuous full turns. Its captured camera-side sign
  applies only to Pivot-based in 3D. At the center, where a pivot angle is
  undefined, the existing straight-drag fallback remains available.
- Existing mesh/UV/text pivots, vertex-normal editing, selected axes, snapping,
  UV locks, history and cancellation paths remain owned by the existing editors.
  Bones and Movement have separate overrides despite sharing GamePreview.
  POSE input uses the preference; limb and node solvers are unchanged. AnimXL,
  camera navigation and Paint brush controls are unchanged.
- Test first: five new unit tests failed before implementation. They now pass,
  covering defaults, independent inheritance, export/import, invalid values,
  linear direction/speed and continuous pivot rotation. Focused Movement/POSE
  suite: 98 passed, 7 existing skips.
- Final `pnpm test`: 57 passed. Final `pnpm run test:source`: 1,980 passed,
  22 existing skips. `pnpm run build`: passed (existing bundle-size warning).
  An initial source run lacked the untracked FFmpeg files; after copying the
  existing verified binaries, the complete suite passed. No failure was masked.
- Packager verified 1,219 runtime/asset files and 55 locale files. Initial hidden
  packaged checks passed for Mouse navigation/defaults/override persistence/reset,
  Vertices and UV angles/Undo, Forge angles/Undo and Showcase text rotation.
  Expanded acceptance: 374 passing checks, zero renderer errors or visible
  windows/popups. The first combined run had two camera-check failures: its
  pointer landed over navigation overlays. A targeted editor rerun on clear
  canvas passed both camera checks without production camera changes. Full
  Movement checks were retained from the combined run. Reconciled evidence:
  `D:\Codex\mdlvis-rotate-drag\results\all-editors\verification.json`.
  Bones/POSE settings use the tested shared handler and source tests; separate
  packaged Bones/POSE and Quad View gestures were not exercised in this extension.
- The owner's earlier manual test was left untouched while it ran. It had
  unsaved work and is no longer running at the final process check. Preserve its
  model and test profile for possible recovery; no installed app/profile changed.

## Next action and review handoff

The verified branch is ready for PR #327 review. The desktop handoff helper
returned “Computer Use helper already has an active request” on the initial
attempt, retry and recovery after a kernel reset. The installed standalone
Claude CLI reports signed out; do not extract Desktop credentials or automate
sign-in. Queue an automatic retry of the authorized Claude Desktop handoff,
using Opus 5.5 Medium, then go idle after delivery. The owner authorized
Claude to merge if review is okay; if not, Claude must create a concrete follow-up
task and send it back to this Codex chat. No release, installed-app upgrade or
replacement of the owner's manual-test model/profile is authorized.

## Claude review of 26a26cee (2026-10-26): Codex follow-up required

Not merged. Everything else reviewed looked right: Linear is the default, its
direction no longer flips with the camera, bones default to World (grid) axes,
handles look the same, settings round-trip through export/import, and
`node --test test/rotation-drag.test.js test/movement.test.js test/pose-ik.test.js`
passes (98 passed, 7 skipped). One regression must be fixed first.

### Finding 1: Pivot-based Rotate turns the wrong way on Local axes

- Where: `app/GamePreview.jsx` `beginRotationDrag` (about line 426). It
  computes `facing` from the plain world axis
  (`new THREE.Vector3().setComponent(axis, 1)`). On `main`,
  `movementRotationFacing` (removed from `app/movement-overlay.js`) turned that
  axis by the node's rotation (`active.rotation`, or the POSE handle's) when the
  gesture used Local space, except for ordinary workplane drags. POSE
  Body/Object kept Local even with a workplane.
- Why it matters: `src/movement.js` applies a Local Rotate around the rotated
  axis. If that axis points the other way relative to the camera than the
  world axis, `pivotSign` has the wrong sign. Then circling the mouse clockwise
  turns the bone counter-clockwise.
- Reproduce: Settings → Mouse → Rotation → Behavior = Pivot-based. In Movement,
  choose Local axes and select a bone whose current rotation turns its local X
  around by about 180° compared with world X. Drag the X rotate handle in a
  circle around the bone: the bone turns opposite to the mouse. With World
  axes it follows the mouse. Linear mode is unaffected.
- Fix: pass the node or POSE handle rotation to `beginRotationDrag` again. For
  Local-space axis handles, turn the axis by it before the dot product, using
  the same exceptions as `main`'s `movementRotationFacing`. Keep Linear
  unchanged.

### Acceptance checks

- A unit test, or a test in `test/movement.test.js`, covering a node rotated
  180° about Y with a Local X handle: Pivot-based gives the same visual
  direction as World on an unrotated node, and Linear is unchanged.
- The existing focused tests, `pnpm test` and `pnpm run test:source` still pass.
- The packaged check of Pivot-based + Local Rotate in Movement follows the mouse
  circle. If possible, add the Bones/POSE gesture that this PR has not yet
  exercised in the packaged app.
