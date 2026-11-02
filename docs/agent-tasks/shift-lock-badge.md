# Shift lock: one lock rule and an orange lock badge at the cursor

Status: contract ready; Codex to build after PR #504 merges (see Sequencing)
Owner / consolidator: Codex (build); Claude Code (review and contract)
Updated: 2026-11-02

## Goal and completion criteria

The owner, 2 November 2026: holding Shift during a drag locks the movement to a
plane (or axis), but nothing on screen says so. Show a small **orange padlock with
a black outline** next to the mouse cursor while the lock is active, followed by
what is locked, for example `🔒XY`. The owner also asked for Shift locking in the
OptimizeXL sphere placer (Sphereomancer, PR #507), and other work (PR #504) is
adding Shift locks to quad view. **Every Shift lock must run through one shared
piece of code** so the rule and the badge are written once, not once per editor.

Done means:

1. Start dragging a selection in any 3D editor and hold Shift. The badge appears
   beside the cursor at once and shows the locked plane (`XY`, `ZX`, `YZ`) or
   axis (`X`, `Y`, `Z`).
2. The badge follows the cursor, never blocks clicks, and disappears the moment
   Shift is released or the drag ends or is cancelled (Escape, pointer cancel,
   window blur).
3. Press/release Shift mid-drag: the badge appears/disappears in step with the
   existing latch behaviour (`shiftDragOffset`), which stays unchanged.
4. The label always matches the motion: it comes from the same code that decides
   the locked offset, so it cannot say `XY` while the model moves along Z.
5. Sphereomancer and quad view get Shift locking from the shared code, not a
   copy of it.
6. A source search finds no Shift-lock decision outside the shared module
   (see "Centralize").

## What counts as a Shift lock (badge shows)

Only gestures where Shift **restricts where something can move**:

- Free Move with the workplane off (`freeDragTranslation` shift path, single view):
  plane label from the workplane setting.
- Quad flat pane screen-axis latch (`moveDragPoint`): the pane is already its
  plane, Shift picks one screen axis. Show the **model axis** that screen axis
  maps to (`X`, `Y` or `Z`), not "horizontal".
- Move gizmo Shift + arrow / square (`gizmoMoveTranslation` / `moveConstraint`
  in PR #504's `app/movement-overlay.js`): axis or plane from the constraint,
  including the `dominantPlaneAxis` case (shows the chosen axis once picked).
- Bones / Movement / POSE / Forge node Move drags that already use
  `shiftDragLatch` (`app/Viewport.jsx`, `app/GamePreview.jsx`).
- Free-scale with Shift constraint (`scaleConstrained`, GamePreview): axis label
  already computed there as `axisLabel`; reuse it.
- Sphereomancer Move drag (new, PR #507's `app/CollisionOverlay.jsx`), using the
  same plane rule as free Move in its preview.

## What does not (no badge)

Shift means something else here; leave behaviour and visuals untouched:

- Rotate precision (`rotationAmount`, `rotationDragDegrees`, `movementRotationAmount`).
- Scale step snapping (`amount * 20 / 20`).
- Shift-click to add to a selection, Shift with marquee.
- Shift + arrow-key nudge ×10 (Sphereomancer `CollisionOverlay`, elsewhere).
- Camera `shiftScreenDrag` (camera pan, not an edit lock).

If a site is unclear, list it in the PR and ask Claude Code; do not guess.

## Centralize

Today the latch maths is already shared (`app/classic-gestures.js`:
`shiftDragLatch`, `shiftDragOffset`, `moveDragPoint`; `app/viewport-math.js`:
`freeDragTranslation`), but each editor decides on its own *what* Shift locks
and reads `event.shiftKey` itself. The badge needs that decision in one place.

Required shape (names are suggestions; keep them if they fit the code):

- **One lock module** (extend `app/classic-gestures.js`, or a small new
  `app/shift-lock.js` next to it): a function that, given the gesture state and
  whether Shift is held, returns both the locked solve and a lock description
  `{ kind: 'plane' | 'axis', label: 'XY' | 'ZX' | 'YZ' | 'X' | 'Y' | 'Z' } | null`.
  Every site in "What counts" calls it instead of branching on `shiftKey` for
  the lock itself. Plane labels use the app's existing words: `xz` shows as `ZX`
  (same mapping as `EditorControls.jsx` and the Movement Workplane radios).
- **One badge component** (for example `ShiftLockBadge`), mounted once per
  window that hosts 3D drags (main window and any popped-out preview window,
  like Sphereomancer's), fed by a tiny shared store/event the lock module
  updates (`setShiftLock(label, clientX, clientY)` / `clearShiftLock()`).
  Editors do not render their own badge.
- Clearing is owned by the lock module on drag end, cancel, Escape and window
  blur, so no editor can leave a stale badge behind.
- No new Settings, toggles or text strings beyond the label. The label letters
  are already allowed literals in `src/localization.js`; the badge is
  `aria-hidden` with no tooltip (it is feedback, not a control).

## Look

- Padlock glyph drawn as a small inline SVG (not an emoji, so it looks the same
  on every PC), orange fill with a 1–1.5 px black outline; label text in the same
  orange with a black outline (text stroke or shadow), bold, about the size of
  the existing drag readouts.
- About 14–16 px tall, offset ~14 px right and ~14 px below the hotspot so it
  never covers the point being dragged. Clamp inside the window.
- `pointer-events: none`, above the viewport canvas, no animation, no fade.
- Orange is the owner's choice; no theme variable exists for it today. Add one
  token (for example `--shift-lock`) where the theme colours live so VIS/classic
  and new look both use it; keep it orange in every theme.
- Same badge in single view, every quad pane, VIS classic mode, Movement/POSE,
  Forge and Sphereomancer.

## Sequencing

- **PR #504** (`codex/workplane-constraints`) rewrites the same Shift-lock sites
  (`Viewport.jsx` `currentLockedPlane`, `GamePreview.jsx`, `movement-overlay.js`
  `gizmoMoveTranslation`). Build this **after #504 merges**, on fresh `main`,
  or the two will conflict and the lock rule will be duplicated.
- **PR #507** (`codex/sphereomancer-v2`) has no Shift lock yet (only the Shift +
  arrow-key ×10 nudge). The owner's new Sphereomancer Shift-lock request must use
  this shared module. If #507 adds Shift locking before this lands, it must call
  the shared module (or be moved onto it here) rather than adding its own.
- Note for the owner: the quad-view Shift work is in PR #504; PR #507 is the
  sphere placer.

## Tests

- Source: unit tests for the lock function: each plane/axis label, `xz → ZX`,
  quad screen axis → correct model axis per pane, gizmo arrow/square/dominant,
  `null` for Rotate/Scale-step/selection Shift.
- Source guard: a test that greps `app/` for Shift-lock decisions outside the
  shared module (allow-list the non-lock uses above) so a future feature cannot
  add a second copy.
- Packaged, hidden desktop, real mouse drags (AGENTS.md): hold Shift during a
  Move drag in single view (each workplane), each quad pane, a gizmo arrow and
  square, Movement/POSE bone, Forge, Sphereomancer. Read the painted badge text
  and position; release Shift mid-drag and check it is gone; Escape clears it;
  Rotate + Shift shows no badge. Camera orbit still works in every pane.
- Targeted reruns only (failed and related tests), not the full suite.
- Captures of the badge in light and dark themes and VIS mode for the owner.

## Out of scope

Changing what Shift does anywhere, new lock keys, a lock indicator in toolbars or
panels, Settings for the badge, UV editor Shift behaviour.
