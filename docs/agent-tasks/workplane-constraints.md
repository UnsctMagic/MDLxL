# Workplane Constraints and one gizmo for every 3D editor

Status: contract agreed with the owner item by item (2026-11-01); Codex to build
in the real app
Owner / consolidator: Codex (implementation); Claude Code (contract, review)
Updated: 2026-11-01

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

## Revision and local state

- Contract on branch `claude/workplane-constraints-contract` from `origin/main`
  `ff39174d`. Codex: a new `codex/` branch from `origin/main`.
- Fixture: `D:\Claude\MDLxL-TestModels` (never modify or clean it).

## Blockers and next action

- None. Next: Codex builds it, opens a PR into `main` with the `Session:` line,
  closes PR #496, removes the lab build and its desktop shortcut after
  verification.
