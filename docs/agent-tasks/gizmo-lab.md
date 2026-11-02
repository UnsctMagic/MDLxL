# Gizmo Lab: Workplane Constraints and one gizmo for Move and Rotate

Status: superseded by [Workplane Constraints](workplane-constraints.md) (2026-11-01, real app work, no lab)
Owner / consolidator: Codex (implementation); Claude Code (contract, review)
Updated: 2026-11-01

Replaces the five-style idea in [Rotation Lab](rotation-lab.md). Build on that
lab's isolated build ([PR #496](https://github.com/UnsctMagic/MDLxL/pull/496),
branch `codex/rotation-lab`): keep its separate entry, build-time hook,
disposable profile, test model, drag log and shortcut; replace the five style
buttons with what is below.

## Why (verified on `origin/main` `cb7065fb`)

- The Workplane switch does nothing for Rotate or Scale. `Viewport.jsx` takes the
  turn axis from `planeAxes(lockedPlane || p.workplane)` whether
  `workplaneEnabled` is on or off; only Move reads it (on = in the plane, off =
  `freeDragTranslation`, free on screen).
- Rotate is an invisible gizmo: the `ring` rule in
  [src/rotation-drag.js](../../src/rotation-drag.js) makes you push along a ring
  that is never drawn. The push direction depends on where you click relative to
  the selection centre and on the camera tilt, so after a few turns, or after
  orbiting, the same hand movement turns the other way or barely at all. Quad's
  flat panes look straight down the axis, the worst case.
- Rotation speed is 1° per pixel × Rotation sensitivity × pointer sensitivity
  (DPI), so the owner's 0.67 DPI silently slows Rotate.
- Vertices has no rotate handles; POSE has sticks with X/Y/Z balls
  (`movementAxisHandles` / `drawMovementGizmo` in
  [app/movement-overlay.js](../../app/movement-overlay.js)).

## MDLVis reference (read from its source)

MDLVis 1.40 source, LGPL: <https://github.com/kisapablo/mdlvis>. The owner uses
1.41. Its "workplane" checkbox is the inverse of `IsXYZ` (`frmmain.pas` 812–814,
8370).

- **Workplane on** (`IsXYZ` false): Rotate is locked to the chosen plane radio
  (XY/XZ/YZ); only horizontal movement counts, `OldMouseX − x` degrees per move,
  1° per pixel (`TWorkPlane.FindAngles`, `guic.pas` ~1392; `vRotate`,
  `frmmain.pas` ~1553). Move is locked to the chosen plane, mouse axes mapped onto
  the plane's two axes by which one looks wider on screen (`CheckXYZ`,
  `frmmain.pas`); Shift limits it to one axis.
- **Workplane off** (`IsXYZ` true): circles/axes are drawn round the selection;
  the one nearest the mouse lights up and becomes the plane (`TWorkPlane.FindRot`,
  `TWorkPlane.Find`, `guic.pas` ~1215–1380). Rotate then follows the grabbed
  circle. Move stays in the highlighted plane; never free on screen.

## Agreed behaviour (owner, 2026-11-01)

1. **Rename** the switch to **Workplane Constraints**. Tooltip: "On: Move and
   Rotate stay locked to the chosen plane. Off: pick the axis or plane with the
   handles."
2. **Workplane Constraints on**, Rotate: locked to the chosen plane's axis; drag
   left/right only; same direction every time, whatever the click point, camera
   or earlier turns. No handles. Direction and speed match MDLVis: derive the sign
   from `vRotate` + `FindAngles` (mind MDLVis drawing Y negated) and record it
   here; check it in the Front pane.
   Feedback: a yellow double arrow (↔) next to the cursor showing the only
   direction that works, with the axis and angle beside it (for example
   `Z 37°`). The owner called this perfect: keep it exactly.
3. **Workplane Constraints on**, Move: locked to the chosen plane, as today.
   Feedback: the same cursor readout style, with a four-way arrow for the plane's
   two directions and the distance moved.
4. **Workplane Constraints off**: the standard gizmo found in every 3D program
   (3ds Max, Maya, Blender, Unity, MDLVis). Handles drawn round the selection; the
   handle under the mouse lights up yellow; grab and drag. No free-on-screen Move.
   - Move handles: today's POSE Move gizmo exactly (arrows = one axis, squares =
     one plane, `drawMovementGizmo`), now also in Vertices. A drag that starts off
     the handles moves in the plane facing the camera most; that square lights up
     on hover.
   - Shift with the Move handles (today `gizmoTranslation` ignores Shift):
     Shift + arrow = move in the plane perpendicular to that arrow (Shift + Z
     arrow slides along the floor, never up); Shift + square = lock to the one
     axis of that plane the drag runs along most. Shift can be pressed or released
     mid-drag and continues from the visible position, like today's
     `shiftDragOffset`. Shift always means "lock it down more".
   - Rotate handles: see Appearance. A drag that starts off the handles turns
     around the axis facing the camera most; its handle lights up on hover.
   - Rotate drag rule, every style: the turn follows the direction from the
     selection centre to the mouse (angle swept around the centre on screen,
     summed every pointer sample, wrap-safe; direction fixed once at grab by
     whether the axis points toward or away from the camera). Never "nearest point
     on the ring": that jumps when a ring looks thin (seen in the mockup). Inside
     8 px of the centre, hold the last angle.
5. **Quad view**: Front, Top and Side always use Workplane Constraints on, each
   locked to its own plane. The Perspective pane follows the switch like single
   view.
6. **Speed**: Rotation strength default 1× = exactly MDLVis's speed in
   constrained Rotate. Pointer sensitivity (DPI) no longer multiplies Rotate.
   Gizmo drags follow the mouse one to one, so strength does not apply to them.
   Shift snaps Rotate to 15° everywhere.
7. **Feedback while dragging** (gizmo and constrained): the grabbed handle lit,
   a dashed ghost of the selection's start position, the angle or distance at the
   cursor, Esc/right-click cancel as today.
8. **Gizmo appearance** (lab: a small button row; later Settings → Appearance →
   "Rotate handles"). MDLxL's own look: today's POSE colours and parts only
   (`COLORS` X `#fa4343`, Y `#34cf59`, Z `#3588ff`; outline `#162137`; selected
   `#fff14e`; Tahoma lettered balls), not copies of other programs.
   - **Lines (default)**: today's POSE sticks with X/Y/Z balls, working as
     levers. Grab a ball and swing it; the stick follows the mouse around the
     centre and the model turns with it. The first ~6 px of movement pick which of
     the two other axes it swings around (the one whose turn moves the ball most
     along the push); that axis's ring, a filled slice of the angle turned, and a
     dashed line from centre to mouse appear only while dragging. The stick of the
     turn axis stays put.
   - **Rings**: three rings, always drawn; far halves thinner. Grab a ring to
     turn around its axis; slice of the angle while dragging.
   - **Arcs**: quarter rings between the positive axes, compact; the full ring
     appears while dragging.
   - The appearance changes only the Rotate handles and how they are grabbed;
     Move keeps arrows and squares in every appearance.

## The lab

- Real Vertices editor, real quad view, real selection, Move and Rotate tools and
  the existing Workplane switch (renamed), plus one small row: appearance
  **Lines / Rings / Arcs** and **Reset model**. Ctrl+Z works. No other panels.
- Opens with the test model loaded, vertices selected, Rotate active, quad view
  on, Workplane Constraints off. Normal mouse camera rotation in every pane.
- Speed comes from the owner's real profile, read only; the lab starts at
  rotation strength 1× regardless.
- Product app unchanged: no new setting, menu or behaviour outside the lab until
  the owner approves the result. Rename only inside the lab for now.
- Log per drag: tool, constraint on/off, appearance, pane, camera direction,
  handle grabbed, axis/plane used, pixels, degrees/distance.
- Build to `D:\Claude\MDLxL-TestBuilds\GizmoLab` with a desktop shortcut
  `MDLxL Gizmo Lab`; replace the old Rotation Lab build and shortcut (keep only
  its small report). Never open it on the owner's screen.

## Verification

- Unit tests for the pure rules: constrained Rotate gives identical degrees for
  the same drag in every pane, camera angle, click point and after earlier turns;
  sign matches the recorded MDLVis direction; swept-angle rule has no jump when
  the ring is nearly edge-on and wraps past 180°; lever axis choice; DPI no longer
  scales Rotate; strength 1× = 1° per pixel.
- Packaged real-mouse drags on a hidden desktop (as
  `test/rotation-interaction.electron.cjs`): Move and Rotate, constraints on and
  off, all three appearances, single view at three camera angles and all four
  quad panes, Shift + arrow and Shift + square on each Move handle, three Rotate drags in a row with the same hand movement (must turn
  the same way each time), Shift snap, Reset, Ctrl+Z, camera orbit in each pane.
- Screenshots of: default (uncluttered), hover highlight, mid-drag feedback for
  each appearance, constrained arrow readout.
- Then `ready to test` with a 5-line click-through for the owner.

## Out of scope

Changing the shipped app, Bones/POSE/Forge (they get the same gizmo after the
owner approves), Scale, and the UV map (keeps its own turn).

## Revision and local state

- Contract: branch `claude/gizmo-lab-contract` from `origin/main` `cb7065fb`.
- Codex continues `codex/rotation-lab` (PR #496) or a new `codex/` branch from it.
- Fixture: `D:\Claude\MDLxL-TestModels\optimizexl-footman` (never modify or
  clean that folder).

## Blockers and next action

- None. Next: Codex builds the Gizmo Lab and reports `ready to test`.
- After the owner approves: one PR ships this as the only Move/Rotate behaviour
  in every 3D editor and removes the `ring` rule and the lab hook.
