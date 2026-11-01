# Gizmo Lab: Workplane Constraints and one gizmo for Move and Rotate

Status: ready to test; ready for review; awaiting merge approval and independent Claude QA
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

### Verified authored-coordinate direction (Codex)

Reference revision: `kisapablo/mdlvis` `3d120eb046183c9c91a7b29b5e52f986fbe0a41c`.
[FindAngles](https://github.com/kisapablo/mdlvis/blob/3d120eb046183c9c91a7b29b5e52f986fbe0a41c/guic.pas#L1392-L1409)
produces `a = oldX - newX = -dx`. Comparing the coordinate equations in
[vRotate](https://github.com/kisapablo/mdlvis/blob/3d120eb046183c9c91a7b29b5e52f986fbe0a41c/frmmain.pas#L1553-L1617)
with right-hand XYZ rotation gives:

| Plane | Turn axis | Authored angle for a rightward drag |
| --- | --- | --- |
| YZ | X | `+dx` degrees |
| XZ / ZX | Y | `-dx` degrees |
| XY | Z | `+dx` degrees |

The XY/YZ coordinate equations use the negative of `a`; XZ uses `a`.
[mdlDraw's Y reflection](https://github.com/kisapablo/mdlvis/blob/3d120eb046183c9c91a7b29b5e52f986fbe0a41c/mdlDraw.pas#L1415)
is a display transform, not another negation of the authored vertex data. The
lab matches the authored equations; it does not add camera-dependent sign
changes. Unit tests independently evaluate all three MDLVis equations. The
hidden Front check measures `+37°` about X for `+37 px` horizontal movement,
including three consecutive turns before Undo.

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

## Implementation and local state

- Continued `codex/rotation-lab`, [PR #496](https://github.com/UnsctMagic/MDLxL/pull/496).
- Merged `origin/main` `ff39174d` first in `9d3815cb` before implementation.
  Main's superseded Rotation Lab status and new Gizmo Lab contract were kept
  when resolving the two documentation-only merge conflicts.
- Final main sync: `f3cbd71d` in `123a3e09`, carrying its UVEditor-only fix
  unchanged. The lab runtime was rebuilt and checked after that sync.
- Runtime owners: `app/gizmo-lab.js` (input adapter, POSE handles and feedback),
  `app/gizmo-lab-rules.js` (pure rules), `app/rotation-lab.jsx` (reused fixture
  sessions and the replacement Lines / Rings / Arcs / Reset row).
- `scripts/rotation-lab-transform.mjs` compiles checked, lab-only hooks into the
  real App, Viewport, AppSidebar and EditorControls. Drift fails the build.
  The ordinary source files, movement-overlay, preferences, Settings, Electron
  owners, package manifest and ordinary Vite entry stay unchanged.
- Pure lab rules deliberately live outside `src/`: the product AI inventory
  glob collects every `src/*.js`. Keeping these rules under `app/` prevents
  experimental lab functions from appearing in the normal AI inventory.
- POSE `movementAxisHandles`, `pickMovementHandle` and `drawMovementGizmo` own
  Move arrows/squares and the Lines parts. Ring hit testing chooses only the
  handle: rotation uses the cursor's swept angle, never a nearest ring point.
- Move reuses `shiftDragOffset` to keep the visible offset across modifier
  changes. Plane drags use Three ray/plane intersection; the existing projected
  workplane solver handles a mathematically edge-on plane. Arrow displacement
  retains the existing POSE/Vertices axis solver. Gizmo Move uses raw pointer
  coordinates; constrained Move retains the existing pointer sensitivity.
- Rotation strength starts at 1× in the copied lab preferences. Constrained
  Rotate uses that strength and the fixed MDLVis signs above. DPI never scales
  Rotate; gizmo Rotate ignores strength and follows the swept angle one to one.
- Every wrapped-angle sample is retained, including coalesced pointer samples.
  Geometry and feedback use the existing viewport frame coalescer. Start ghosts
  cache projected selected triangle edges per pane for the drag.
- Hover results are reused until the pointer or drawn handle geometry changes.
  Release/cancel records the final pointer for the next paint; leaving a pane
  clears it. This prevents an old lever/pane highlight from surviving a turn.
- Reset restores positions, normals and tangents as one normal undoable edit.
  Edits, Undo, Reset and appearance changes preserve the camera.

### Build, profile and logging

- Build: `D:\Claude\MDLxL-TestBuilds\GizmoLab\MDLxL.exe`.
- Desktop shortcut: **MDLxL Gizmo Lab**. Never opened on the owner's desktop.
- `lab-profile` is disposable and separate. Owner preferences are read only;
  the copied Rotation strength is set to 1×. Navigation/mouse preferences remain
  copied (owner pointer sensitivity was 0.67× at build time).
- Footman and Textures come from the unchanged permanent fixture directory.
  Box is the existing generated lab fixture. Both open with vertices selected.
- Per-drag log remains `rotation-drags.jsonl` beside the executable, with tool,
  constraints, appearance, pane, camera direction, handle, used axis/plane,
  pointer displacement, degrees/distance, translation, Shift and cancellation.
- The old Rotation Lab build and shortcut are replaced; only its small report
  (including the owner’s test-Footman recovery and 11,633-byte drag log) remains at `D:\Codex\rotation-lab-report`.
- Current evidence: `D:\Codex\gizmo-lab-report` (report, measurements, build
  metadata, test logs and the six required captures).

Rebuild with linked D: dependencies:

```powershell
pnpm exec vite build --config vite.rotation-lab.config.js
node scripts/build-rotation-lab.mjs --owner-settings '<real profile settings.json>' --shortcut
```

The builder defaults to the GizmoLab folder and requires an empty destination;
`--out` chooses another D: path. The old filenames for the separate HTML,
Electron entry and build config are retained as the reused isolated scaffold.
The superseded five-style rule module and tests have been removed.

### Verification

- Focused source/unit/regression checks: **101 passed / 0 failed / 0 skipped**.
- Compatibility: **57 passed / 0 failed / 0 skipped**.
- Desktop bridge follow-up: **4 passed / 0 failed / 0 skipped**. First CI
  exposed that its inventory scanned the lab main but only the product preload,
  reporting `rotationLab:fixtures has no preload invoke` and
  `rotationLab:log has no preload send`. Reproduced locally before the correction.
  The check now validates product and isolated lab main/preload pairs separately,
  preserving every bidirectional registration and listener assertion. Runtime
  files and the verified delivery package are unchanged by this test-only fix.
- Normal app and lab builds pass. Normal runtime owner files match online main;
  the ordinary bundle contains neither lab control/event code nor the lab rule
  module in its AI inventory.
- Final package: **1,363 checks passed / 0 failed / 0 skipped**, **134 committed
  measurements + 2 cancelled drags**, **0 renderer errors**.
- Full hidden desktop harness: `test/gizmo-lab.electron.cjs`, run through the
  existing `scripts/hidden-run.ps1` on the invisible MDLxLTests desktop.
  Final package result is recorded in the small report; no visible window is
  used, and test profiles/processes are removed when each run finishes.
- Covers Move and Rotate for every appearance; constraints on/off; single view
  at measured 30°/60°/85° camera angles; all four quad panes; all three Move
  arrows and all three squares with Shift before and during dragging in both
  single view and quad Perspective; repeated
  Rotate turns in constrained and gizmo modes; Shift snap; Esc/right-click
  cancel; Reset, Undo, Box, live previews, committed geometry and mouse orbit.
- Numeric camera setup waits for each displayed camera angle to commit before
  editing the next one. Tests use only real mouse/keys and read-only state.
- Required captures: default, hover, mid-Lines, mid-Rings, mid-Arcs and the
  constrained yellow double-arrow/axis/angle readout.
- Fail first: missing pure-rule module; old Rotation Lab lacks the replacement
  Gizmo row. Two hover lifecycle checks also reproduce the old stale highlights:
  X after leaving Perspective, and Z after releasing a lever where Y should be
  highlighted. Both are corrected in the final adapter.
- Claude's independent QA and owner feel/appearance approval remain pending.
  Warcraft III and the full release suites are not claimed.

## Next action

Owner tests the standalone build and chooses the appearance/feel. PR #496 stays
open, ready for review and awaiting explicit merge approval. This task does not
change the shipped Move/Rotate rule or authorize a release.
