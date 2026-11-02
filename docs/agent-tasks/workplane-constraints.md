# Workplane Constraints and one gizmo for every 3D editor

Status: arrow rule corrected 2 Nov (camera only, never the press point); implement before merge (see [Owner change](#owner-change-constrained-rotate-follows-the-plane-2-nov)); review fixes accepted at `c3282939`
Owner / consolidator: Codex (implementation); Claude Code (contract, review)
Updated: 2026-11-02

This is real app work, not a test build. It replaces [Gizmo Lab](gizmo-lab.md)
and [Rotation Lab](rotation-lab.md). Port the useful pieces from Codex's lab
branch `codex/rotation-lab` (commit `1f27ae6f`: lever rule, swept-angle rule,
drag feedback, Shift on Move handles, their tests), then close
[PR #496](https://github.com/UnsctMagic/MDLxL/pull/496) unmerged with a link to
the new PR.

Only what is listed here. Do not add behaviour the owner did not agree to; ask
Claude Code if something is unclear.

## Why (verified on `origin/main` `ff39174d`)

- The Workplane switch does nothing for Rotate: `Viewport.jsx` takes the turn axis
  from `planeAxes(lockedPlane || p.workplane)` whether `workplaneEnabled` is on or
  off.
- Rotate uses an invisible ring (`behavior: 'ring'`, `rotationRingTangent` in
  [src/rotation-drag.js](../../src/rotation-drag.js)): the push direction depends
  on the click point and camera, so it changes after a few turns or an orbit and
  gets stuck. Quad's flat panes are the worst case.
- The owner reports Rotation strength (Settings → Mouse → Rotation sensitivity)
  does nothing. Find out why on every 3D path and fix it.
- MDLVis reference (1.40 source, LGPL, <https://github.com/kisapablo/mdlvis>):
  workplane on = Rotate locked to the plane radio, horizontal mouse only, 1° per
  pixel (`TWorkPlane.FindAngles` in `guic.pas`, `vRotate` in `frmmain.pas`).

## Agreed behaviour

1. **Name**: the Workplane checkbox becomes **Workplane Constraints**
   (`WorkplaneControls` in [app/EditorControls.jsx](../../app/EditorControls.jsx)),
   with a short tooltip: on = Rotate locked to the chosen plane; off = use the
   handles.
2. **Workplane Constraints on, Rotate**: locked to the chosen plane's axis
   (XY / ZX / YZ). **Changed by the owner on 2 Nov; see
   [Owner change: constrained Rotate follows the plane](#owner-change-constrained-rotate-follows-the-plane-2-nov).**
   The mouse direction follows how the plane looks on screen, and yellow arrows
   show exactly which way to move. The old rule (left/right only, MDLVis sign,
   `↔` in the label) is replaced. No handles.
3. **Workplane Constraints off, Rotate**: handles in the chosen Rotate style
   (item 9). Lines works as levers: grab an X/Y/Z ball and swing it; the first few
   pixels pick which of the other two axes it swings around; the turn follows the
   direction from the selection centre to the mouse (angle swept around the centre
   on screen, wrap-safe, never "nearest point on the ring", hold the last angle
   within 8 px of the centre). Rings and Arcs: grab a ring/arc to turn around its
   axis with the same swept-angle rule. Dragging away from the handles turns
   around the axis that faces the camera most, like a steering wheel, same rule.
4. **No ghost** of the start position.
5. **Shift while rotating = slower, 0.1× (Blender precision)**, in both modes. No
   more 15° Shift snap in 3D Rotate. Add a setting for this amount directly under
   Rotation sensitivity, default 0.1×.
6. **Speed**: Rotation sensitivity must work everywhere. 1× = MDLVis speed
   (1° per pixel in item 2). Pointer sensitivity (DPI) keeps multiplying it, as
   today. The Settings rotation-behaviour choice (Along the ring / Straight drag /
   Circle the pivot) no longer applies and goes; the `ring` rule goes with it.
   Keep the "Apply to" per-editor speed overrides.
7. **Quad view**: Front, Top and Side are always Workplane Constraints on, each
   locked to its own plane. The Perspective pane gets a small toolbar along its
   bottom edge with XY / ZX / YZ and Workplane Constraints, for that pane only. In
   quad view the side panel shows none of these controls. **Normal (single) view
   stays exactly as it is.**
8. **Move**: unchanged (on = in the plane, Shift = one axis; off = free, Shift =
   the chosen plane; arrows and squares as today). One addition: on the Move
   handles, Shift + arrow = move in the plane perpendicular to that arrow, Shift +
   square = the one axis of that plane the drag runs along most (today
   `gizmoTranslation` ignores Shift). Shift may change mid-drag and continues from
   the visible position, like `shiftDragOffset`.
9. **Appearance** (Settings → Appearance), two choices:
   - Move gizmo: **Classic** (default: pure red/green/blue, 1 px lines, no dark
     outline, small heads, faint squares), **Today** (current look), **Bold**
     (thicker shafts, bigger heads).
   - Rotate handles: **Lines** (default: today's POSE sticks with X/Y/Z balls, as
     levers), **Rings** (three rings, far halves thinner), **Arcs** (quarter rings
     between the axes; full ring while dragging).
   MDLxL's own look; colours from `COLORS` / the appearance axis colours.
10. **Drag feedback** on handles: the grabbed handle lit yellow, the angle at the
    cursor, and for Lines the ring being swung on with a filled slice of the angle.
    Make all of it slightly more noticeable than the lab (brighter highlight,
    bolder ring and slice, larger angle label).
11. **Every 3D editor** uses the same gizmos and rules: Vertices, Bones,
    Movement/POSE, Forge. Keep each editor's existing options (POSE world/local
    space, Forge magnet constraints). The UV map keeps its own Rotate
    (`uvTurn`); do not touch it.

## Owners

- Rotate rule and settings: [src/rotation-drag.js](../../src/rotation-drag.js),
  [src/preferences.js](../../src/preferences.js), Rotation section in
  [app/Settings.jsx](../../app/Settings.jsx).
- Vertices / quad: [app/Viewport.jsx](../../app/Viewport.jsx) (rotate start ~455,
  `applyTransformMove`, `gizmoPivot`, `gizmoTranslation`),
  [app/quad-view.js](../../app/quad-view.js), [app/viewport-math.js](../../app/viewport-math.js).
- Gizmo drawing and handles: [app/movement-overlay.js](../../app/movement-overlay.js)
  (`movementAxisHandles`, `drawMovementGizmo`, `movementRotationGesture`).
- POSE/Bones: [app/GamePreview.jsx](../../app/GamePreview.jsx); Forge:
  [app/ForgeShapes.jsx](../../app/ForgeShapes.jsx), [app/ForgeEditor.jsx](../../app/ForgeEditor.jsx).
- Side panel: `WorkplaneControls` in [app/AppSidebar.jsx](../../app/AppSidebar.jsx).
- Map row: "Viewport, rendering, cameras and preview" in [agent-map.md](../agent-map.md).

## Verification

- Unit tests: constrained Rotate gives identical degrees for the same drag in
  every pane, camera angle, click point and after earlier turns; recorded MDLVis
  sign; swept angle never jumps on an edge-on ring and wraps past 180°; lever axis
  choice; Shift = 0.1× (and the setting); Rotation sensitivity changes speed on
  every path; Shift + arrow / Shift + square on Move handles.
- Packaged app, real mouse drags on a hidden desktop (`pnpm run build`, then the
  harnesses such as `test/rotation-interaction.electron.cjs`): Vertices, Bones,
  POSE and Forge; constraints on and off; each Rotate and Move style; single view
  at three camera angles and all four quad panes; three Rotate drags in a row with
  the same hand movement turning the same way; the Perspective pane toolbar; the
  side panel without plane controls in quad and unchanged in single view; camera
  orbit still works in every pane.
- `pnpm test`, `pnpm run test:source` against the CI baseline; targeted reruns only
  after fixes.
- Screenshots: default view, hover highlight, mid-drag feedback per Rotate style,
  constrained arrow readout, quad Perspective toolbar, Settings rotation section.
- Report `ready to test` with a short click-through for the owner.

## Implementation and owner clarifications

- Branch `codex/workplane-constraints`, based on merged contract PR #500 at
  `0f3f80a3`, rebased onto main `af004b55`. Ported the lever, swept-angle, feedback and Move modifier rules
  from `codex/rotation-lab` `1f27ae6f` into shared production owners.
- Owner clarification: preserve Bones' rest-pose Select/Move restriction. It
  receives the Move gizmos; Rotate is exercised in Vertices, Movement/POSE and
  Forge. No rest-pose rotation was added.
- Owner separately approved the Learn click timing repair after a minimal
  hidden proof isolated its capture-phase reminder render suppressing checkbox
  change events. Reminder state now updates after the native click; no checkbox
  workaround, Learn controls or extra UI were added.
- MDLVis `guic.pas` `TWorkPlane.FindAngles` uses horizontal `oldX-x` only.
  `frmmain.pas` `vRotate` negates XY/YZ and keeps XZ in right-hand XYZ:
  rightward pixels mean XY +Z, ZX -Y, YZ +X. The drawing code negates Y for
  display only; authored coordinates are unchanged.
- Rotation retains speed overrides, drops retired behavior keys, and adds
  `precision` (default 0.1). Shift changes the speed of subsequent motion without
  jumping when pressed/released. Each coalesced sample accumulates its wrapped
  path; geometry and feedback update at most once per display frame.
- A real-click test caught the new Perspective toolbar being intercepted by the
  pane's capture handler. Toolbar presses now reach their own controls.
- Hover evidence checks yellow pixels in the actual editor/pane canvas. Its
  color predicate includes antialiased edges (quad capture: RGB 207/202/79);
  background canvases cannot satisfy the check.
- Forge repeat previews retain their model identity when a control/hover render
  changes no geometry; otherwise the model-rebuild effect canceled an armed
  rotation. The magnet fitting math and callbacks are unchanged.
- Single-view layout, UV sources/controls, existing POSE solvers and Forge magnet
  constraint callbacks are preserved. Settings are chosen before opening Forge,
  following its existing modal workflow.

- 2 Nov review: Movement and POSE dispatch modified marker clicks to node selection.
  A plain empty click clears the selection. An off-handle drag still rotates;
  Rotate no longer box-selects. Rest-pose Bones retains Select/Move.
- Flat quad panes choose their locked plane from the camera direction at drag
  start. Shift precision inherits or overrides independently per editor, and
  coalesced samples retain their individual Shift states. Rings and arcs use
  the handle threshold and distinguish tip picking from segment picking.
- GamePreview clears stale hover on exit, tool changes and disappearance of
  the handles. Removed the unreachable Forge lock, unused Move calculation
  and test-only rotation wrappers. Facing tests now exercise the live gizmo path.

## Verification evidence

**Bones Move and POSE crossing follow-up.** At `eaf5a629`, a real Shift-drag left the rest-pose bone pivot unchanged,
and a press on the visible X ring at a crossing reported Z. A unit check also
returned the ring for a tip-only pick at its hidden endpoint.

The follow-up passed 11 focused tests, 57 compatibility tests, and 2,597
source tests with zero failures and the same 10 existing skips. The CI baseline
is unchanged. The production build passed. Both targeted hidden-desktop
real-mouse reruns passed: rotation-interaction (194 checks) and movement-gizmo
(32 checks). The Footman test measured the pivot after Shift/Ctrl drags, checked
the Shift axis constraint and exact Undo, then verified modifier-click selection.
POSE Rings and Arcs reported the visible stroke's axis inside another axis's
hidden tip radius.

**2 Nov review rerun.** 131 focused checks passed. Compatibility passed 57/57.
The full source suite passed 2,597 with 0 failures and the same 10 existing
opt-in/platform skips. The CI baseline is unchanged. The production build and
package verification passed. The four requested real-mouse harnesses passed on
the hidden desktop: rotation-interaction (193 checks), quad-view (including
Move and Rotate after orbiting Top), movement-gizmo (32 checks, including
pointer-leave pixel checks), and learn-workplane (10 editor/mode combinations).
Movement and POSE cover modified clicks, plain selection/clear without an undo
entry and free drag-away rotation. Bones covers selection with its Select Tool.
The movement-gizmo pixel check now measures the specified yellow highlight,
with overlapping pivot crosses hidden for the measurement.

At `840e4995`, Shift-click failed to add the second Movement bone, and
orbited Top reported Z when the camera faced X. The focused checks also
reproduced dropped Forge precision (22° instead of 25° for the mixed batch)
and a missed ring hit 9 px from the stroke.

**Earlier implementation verification**

- `pnpm test`: 57 passed, 0 failed, 0 skipped.
- `pnpm run test:source`: 2,594 passed, 0 failed, 10 existing opt-in/platform
  skips; the CI baseline was not changed.
- New numeric assertions fail on unchanged main: constrained YZ produced
  `-160` instead of the required `40` degrees. The new packaged check also fails
  on main `b2365c65` before reaching the new controls.
- Learn's new real-click regression fails on the pre-repair feature package in
  Forge. The repaired build passes all ten editor/mode combinations (Vertices,
  Forge, Movement, POSE, Bones × Learn on/off).
- Packaged checks passed: `rotation-interaction` (190 checks), `learn-workplane`
  (10 editor/mode combinations), `uv-rotate-steady` (8 checks),
  `workplane-free-drag`, and `forge-detail-editing` (12 checks), on the invisible
  `MDLxLTests` desktop. Forge covers magnet rotation/Move, bounds, normal changes,
  live geometry, Apply, cancel, orbit and exact Undo/Redo.
  Rotation uses the owner's copied 0.67× pointer preference, actual mouse/key
  input, real Footman fixture, live geometry/native tracks and camera assertions.
- Focused source regressions after the Forge identity repair: 82 passed, 0 failed,
  0 skipped. The original magnet check failed first with `livePayload` null
  after a non-geometry render cleared the gesture.
- Fixture: `D:/Claude/MDLxL-TestModels/pose/Footman.mdx`, read-only. Original bytes
  are checked before/after. Evidence: `D:/Codex/workplane-constraints-report`.
- Warcraft III playback and owner feel/visual acceptance are not exercised by
  these checks. Claude still owns independent QA and the merge/release gate.

## Handover

Implementation PR: [#504](https://github.com/UnsctMagic/MDLxL/pull/504).
Claude Code accepted the ten review fixes at `eaf5a629`. This follow-up covers only Bones Move modifier presses and POSE ring/arc crossings on the same branch.
PR #496 is closed and unmerged; the replacement link is recorded there.
The exact Gizmo Lab installation and desktop shortcut were removed. The real
installed app/profile and permanent test corpus were preserved. Disposable
verification builds/profiles/worktree are removed after the final push, retaining
only the small report, logs and requested captures on D:.

Owner click-through on a build of this branch:

1. Bones, Move tool: hold Shift and drag a bone; then Shift-click and Ctrl-click bones.
2. POSE, Settings → Appearance → Rotate handles = Rings, then Arcs: grab each ring where it crosses another axis and check it turns around its own axis.

## Review fixes (Claude Code review, 2 Nov)

Claude Code reviewed PR #504 at `dae245ab` and found ten problems. Fix all ten on
this branch (`codex/workplane-constraints`) in one push. Line numbers below are at
`dae245ab`; the function names are what to search for. Only what is listed here:
no new behaviour, controls or UI. Agreed behaviour items 1–11 above still apply.
Where a fix seems to clash with them, stop and ask Claude Code.

### Must fix

1. **Rotate tool takes every click (Movement and POSE).**
   `pointerDown` in [app/GamePreview.jsx](../../app/GamePreview.jsx) ~612:
   `directRotate` is now true for any left press that misses the gizmo. Item 3
   says a *drag* away from the handles turns around the axis facing the camera,
   so that stays. These broke and must work again exactly as on `main`:
   - Shift- or Ctrl-click on a marker adds it to or removes it from the selection
     and never rotates. Today `markerRotate` is false with a modifier held, so
     `active` falls back to the old selection and a rotate gesture starts.
   - A plain click that doesn't move (same click distance the editors already
     use) on a different marker selects it, and on empty space clears the
     selection like on `main`. No rotation is committed and no undo step is added.
   - The same applies to the POSE path (`handle = picked || (axis || active &&
     !realPicked && (… || p.transformMode === 'rotate') …)` ~119).
   Box select while Rotate is active was replaced by item 3 (drag away = turn).
   Don't bring it back; note this in the PR description.
   Test with real mouse input in Movement and POSE with Rotate: Shift-click adds a
   bone, Ctrl-click removes it, a plain click selects another marker, empty-click
   clears, and dragging away from the handles still turns. Rest-pose Bones keeps
   Select/Move only. Check the selection clicks there with Select.

2. **Quad Front/Top/Side lock to the wrong plane after orbiting.**
   [app/Viewport.jsx](../../app/Viewport.jsx): orbit is now allowed in every pane
   (`controls.enableRotate = true` ~492, the rotate-as-pan swap removed ~539),
   which AGENTS.md requires. But drags still use `lockedPlane = quad &&
   boundPane.workplane` (~572 and `locked` ~682), the plane fixed when the pane
   was created. Rule (Claude Code's decision; the owner can overrule it): a flat
   pane stays locked to one plane, and that plane is the X/Y/Z plane the pane's
   camera looks along most *right now* (the largest component of the camera
   direction, same as `facingAxis`). Unrotated it is exactly today's plane.
   Compute it at drag start and for the gizmo/`locked` check, in one helper used
   by both. Don't change the pane's name or its view preset.
   Test: unit test of the helper for the three unrotated views and for a Top view
   orbited about 80° (it must pick the plane facing the camera). Packaged check:
   orbit the Top pane, then Rotate and Move there; the drag follows the hand.

### Should fix

3. **Hover highlight stays after leaving the preview.** GamePreview's
   `gizmoHoverAxis` (~254) is never cleared. Clear it (and `invalidate()`) on
   pointer leave, on tool change and when `nodeHandles` becomes empty. Copy what
   Viewport's `pointerLeave` does with `hoverAxis` (~663).
4. **Shift rotation precision ignores "Apply to".** In
   [app/Settings.jsx](../../app/Settings.jsx) `RotationSettings` (~429) the field
   always writes the global value. Give it the same per-editor override as
   Rotation sensitivity right above it: same `change()` path, a "Use default"
   checkbox, disabled while inherited. `normalizeRotationPreferences` and
   `rotationOptions` in [src/rotation-drag.js](../../src/rotation-drag.js) keep a
   per-editor `precision` the same way as `sensitivity`. One way of doing things:
   reuse the existing control, don't invent a new one. Add the new strings to the
   locale catalogs.
5. **Coalesced samples use the wrong Shift state.** In the coalesced-sample loops
   (Viewport `pointerMove` ~603, GamePreview `nodePointerMove` ~236), pass each
   sample's own `sample.shiftKey` to `rotationDragDegrees` /
   `movementRotationAmount`, not the parent `event.shiftKey`. Unit test: a sample
   batch where Shift goes down halfway gives full speed before and precision speed
   after.
6. **Rings and Arcs are harder to grab than Lines.** The ring branch of
   `pickMovementHandle` in [app/movement-overlay.js](../../app/movement-overlay.js)
   (~814) uses a fixed 7 px and ignores `threshold` and `mode`. Use the same
   `threshold` as the line handles, and respect `mode` the way the line branch
   does (for example `'tip'` in the POSE path). Unit test: a point 9 px from a
   ring is picked, 11 px is not.

### Tidy up

7. [app/ForgeEditor.jsx](../../app/ForgeEditor.jsx) ~68: inside `{!quad && …}`,
   `locked={quad && pane?.workplane}` is always false. Remove the prop.
8. [app/Viewport.jsx](../../app/Viewport.jsx) ~358: `gizmoTranslation` has no
   callers left. Delete it.
9. [app/movement-overlay.js](../../app/movement-overlay.js) ~283–300:
   `movementRotationNormal`, `movementRotationFacing` and the
   `movementRotationGesture` wrapper are only called from
   `test/movement.test.js`. Delete them and point those tests at
   `beginGizmoRotation` / `beginRotationDrag`, so the tests cover the path the
   app really runs. Keep what those tests check (world/local facing sign, POSE
   body/node world override).
10. [app/GamePreview.jsx](../../app/GamePreview.jsx) ~249–257: the body of
    `nodeHoverFrame` kept its old, deeper indentation. Re-indent it. No logic
    change.

### Verification for the fixes

- Unit tests named above, plus `pnpm test` and `pnpm run test:source` against the
  CI baseline. Don't widen `.github/known-test-failures.txt`.
- `pnpm run build`, then targeted packaged reruns on the hidden desktop only:
  `rotation-interaction`, `quad-view`, `movement-gizmo`, `learn-workplane`, plus
  the new checks for fixes 1 and 2. Don't rerun the full packaged suite.
- Update this note (Implementation, Verification evidence, Handover) and the PR
  description, keep the `Session:` line, push to this branch, and report
  `ready to test` with a short click-through for the owner:
  1. In Bones with Select, Shift-click and Ctrl-click bones, then click empty
     space. Repeat in Movement and POSE with Rotate, then drag away from the handles.
  2. Quad view: orbit the Top pane, then Rotate and Move a selection there.
  3. Settings → Mouse → Rotation: set Shift precision for Forge only and check
     the other editors kept theirs.

## Owner change: constrained Rotate follows the plane (2 Nov)

Before merge, the owner rejected the "left/right only" rule in item 2. In
their words: in Workplane Constraints each plane rotates the way that plane is,
and arrows show exactly which direction to move the mouse to get a rotation,
whatever the camera angle. This replaces the old item 2 rule (left/right only,
`MDLVIS_SIGN`, `↔` in the label). Everything else in this note stays. Implement
it on this branch (`codex/workplane-constraints`, from `c3282939`) before merge.
If something here is unclear, stop and ask Claude Code.

### Rule (every 3D editor: Vertices, Bones/Movement/POSE, Forge; single view and all quad panes)

Workplane Constraints on, Rotate tool. `N` is the chosen plane's axis (XY → Z,
ZX → Y, YZ → X); `P` is the turn centre the editor already uses.

1. **At mouse-down, work out one screen direction `T`** for a positive turn
   (right-hand rule about `N`) **from the camera only. Where you press never
   matters.** *(Corrected 2 Nov after the owner's quad-view test: the first
   version took `T` from the press point, so in Front/Top/Side, where the
   plane faces the camera, the arrow changed with every press.)*
   - `u` = the direction from `P` toward the camera, flattened into the plane
     (orthographic camera: the reverse view direction, flattened).
   - If the plane faces the camera within about 15° (flattened `u` shorter than
     0.26 of its unflattened length), use instead the in-plane direction that
     points most down on screen. Front, Top and Side always land here, so their
     arrow is always the same: left/right, wherever you press.
   - `T` = the screen projection of `N × u`, normalised. It stays fixed for the
     whole drag: no flips, whatever the pointer does. The arrow changes only when
     the camera orbits.
   - Delete the press-ray / hit-point branch of `constrainedRotationTangent` in
     [app/movement-overlay.js](../../app/movement-overlay.js). Its fallback is
     already this rule; add the 15° switch.
2. **Turn amount** = mouse movement along `T`: `(dx, dy) · T` pixels = degrees at
   1×. Movement across `T` does nothing. Rotation sensitivity, pointer
   sensitivity and Shift precision work exactly as they do now. Coalesced samples
   and the Shift latch stay as they are.
3. **Arrows**: from mouse-down (before the mouse moves) until release, draw one
   yellow double-headed arrow along `T`, centred on the press point, about 48 px
   long, in the same yellow and dark outline as the existing drag feedback
   (`drawGizmoRotationFeedback`). The readout beside the cursor stays as it is
   without the `↔` glyph, for example `Z 37°`. Nothing is drawn while hovering.
   The owner can ask for a hover preview later; don't add one now.
4. **Remove** what only served the old rule: the `MDLVIS_SIGN` branch for
   constrained Rotate in `rotationDragDegrees`
   ([src/rotation-drag.js](../../src/rotation-drag.js) ~64), the
   `movementWorkplanePointer` remap for *rotate* gestures in
   [app/GamePreview.jsx](../../app/GamePreview.jsx) (~734 and ~777; Move keeps its
   own use), and the `↔ ` prefix in the readout and `data-rotation-feedback`. One
   helper computes `T` and every editor calls it, from `beginGizmoRotation` in
   [app/movement-overlay.js](../../app/movement-overlay.js). No per-editor copies.
5. **Settings hint** ([app/Settings.jsx](../../app/Settings.jsx) ~110): replace
   "turns one degree per horizontal pixel" with plain wording, for example:
   "With Workplane Constraints on, move the mouse along the yellow arrow; one
   degree per pixel at 1×." Update the es/ru/zh catalogs.
6. **Unchanged**: Workplane Constraints off (handles, levers, swept angle), Move
   in every mode, quad plane locking (`lockedQuadPlane`), Bones rest-pose
   Select/Move only, the UV map's own `uvTurn`.

### Tests

- Unit tests for the `T` helper: presses at different points give the same `T`
  for the same camera; a plane facing the camera (every flat quad pane) gives a
  horizontal `T`; a plane 10° off facing still gives horizontal; an edge-on plane gives `T` along the
  plane's line on screen; after orbiting the camera to several angles, moving
  along `T` always turns positively and moving along `−T` negatively; the same
  hand movement along the arrow gives the same degrees in every quad pane and
  editor.
- Replace the MDLVis-sign assertions (for example the `40*({xy:1,xz:-1,yz:1}[plane])`
  expectation in `test/rotation-interaction.electron.cjs` and the matching unit
  tests) with the new rule. Don't keep tests for the removed rule.
- Packaged, real mouse on the hidden desktop: in Vertices (single view at three
  camera angles, plus all four quad panes), Movement, POSE and Forge, press, check
  the arrow is drawn before any movement, drag along the arrow (turns positively),
  drag back along it (returns), drag across it (no turn). Expose `T` on the
  existing feedback canvas dataset so the harness can read it. In each of Front,
  Top and Side, press at four places around the centre (above, below, left,
  right): the arrow is horizontal every time.
- `pnpm test`, `pnpm run test:source` against the CI baseline; targeted packaged
  reruns only (`rotation-interaction`, `quad-view`, `learn-workplane`).

### Owner click-through when ready

1. Vertices, Workplane Constraints on, Rotate: press on the model and follow the
   yellow arrow; try XY, ZX and YZ, then orbit the camera and try again.
2. Quad view: do the same in each of the four panes.
3. Movement / POSE and Forge: the same with a bone or a shape.

### 2 Nov initial implementation handoff (superseded tangent rule)

- `beginGizmoRotation` captures one normalized screen tangent from the press ray and
  locked plane. Constrained samples use only their projection onto that tangent;
  the existing sensitivity and Shift latch still apply. The shared feedback draws
  the yellow double-headed press arrow and exposes its direction on the canvas.
- Removed the old constrained MDLVis sign, rotate pointer remap and `↔` readout.
  Unconstrained handles, Move remapping, quad plane locks, Bones rest-pose limits
  and UV rotation retain their existing paths.
- Unit assertions now cover face-on, edge-on and orbited cameras, quad/editor
  parity, positive/back/across motion, sensitivity and Shift. The packaged
  rotation harness reads the painted arrow before moving the real mouse.
- Fail-first on the old `8dc2279d` turn: a 40 px move along a vertical arrow
  returned 0° instead of 40°. `pnpm test` passed 57/57; with `dist/` built,
  `pnpm run test:source` passed 2,601 with no failures and 9 existing skips.
  `pnpm run build` and packaging passed. Targeted `quad-view` and
  `learn-workplane` packaged checks passed (the latter 10/10 real-click cases).
  `rotation-interaction` passed 188 checks, including constrained Rotate in
  Vertices, Forge, Movement and POSE, then timed out twice at its existing
  Bones Shift+Move check in `gameMove`. The last passing line was Today/
  Perspective; the failure was the next Bold/Front drag. The correction below
  resolves this harness gap. No full release suite or Warcraft III run.

### 2 Nov camera-only correction

- `constrainedRotationTangent` now derives `T` only from the camera and locked
  plane. The press ray and hit point are gone. When the camera direction
  flattened into the plane is shorter than 0.26 of its original length, the
  in-plane screen-down direction supplies `u`. The press point still anchors
  the yellow arrow; it no longer changes its direction.
- The prior Bones timeout was a test error. Nine cumulative Bones Shift+Move
  drags pushed the selected bone's X handle below the viewport before the
  Bold/Front case. The harness now asserts the handle is on screen and undoes
  each measured Bones move. All nine Bones cases passed both on the previous
  package and on the new one; no Move product code changed.
- Fail-first: the four-press flat-pane and 10° facing unit tests failed on
  `91913789` before the helper change. `pnpm test` passed 57/57. The source
  suite passed 2,602 with 0 failures and 9 existing skips after build; its
  pre-build eight missing-`dist/` failures were generated-asset dependencies,
  and the CI baseline was not widened. Build and package passed.
- Targeted hidden-desktop reruns passed: `rotation-interaction` 197 checks,
  including four horizontal-arrow presses in each of Front, Top and Side,
  with no renderer errors; `quad-view` passed. The full release suite and
  Warcraft III playback were not run. Ready to test; awaiting merge approval.
