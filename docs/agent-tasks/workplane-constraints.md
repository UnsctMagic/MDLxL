# Workplane Constraints and one gizmo for every 3D editor

Status: implemented; ready to test; awaiting merge approval
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
   (XY / ZX / YZ). Drag left/right only. Same direction every time, whatever the
   click point, camera or earlier turns. MDLVis direction and speed: derive the
   sign from the MDLVis source above (mind MDLVis drawing Y negated) and record it
   here. While dragging: a yellow double arrow (↔) next to the cursor with the axis
   and angle beside it (for example `Z 37°`). No handles.
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

## Verification evidence

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
Ready to test; ready for review; awaiting merge approval. No merge authorized.
PR #496 is closed and unmerged; the replacement link is recorded there.
The exact Gizmo Lab installation and desktop shortcut were removed. The real
installed app/profile and permanent test corpus were preserved. Disposable
verification builds/profiles/worktree are removed after the final push, retaining
only the small report, logs and requested captures on D:.

Owner click-through on a build of this branch:

1. Vertices / POSE / Forge: Rotate with Workplane Constraints on, then off;
   hold and release Shift during a drag.
2. Settings → Appearance → Controllers: try the three Move and Rotate styles.
   Mouse → Rotation: change sensitivity and Shift precision.
3. Move with Shift + arrow / square, including Bones; try the quad Perspective
   toolbar and normal mouse orbit in all panes.
