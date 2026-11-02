# Shift lock: one lock rule and an orange lock badge at the cursor

Status: completed in [PR #512](https://github.com/UnsctMagic/MDLxL/pull/512), merged at [418a2ddd](https://github.com/UnsctMagic/MDLxL/commit/418a2dddb6212407f8ea412b68075f83af5303f8).
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

1. With Move active and Workplane Constraints on, drag a selection and hold Shift. The badge appears
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

Owner clarification, 2 November 2026: show the badge only for **Move**, only
with **Workplane Constraints on**, and only while Shift restricts a drag.
This also applies to Movement/POSE, Forge and Sphereomancer.

- In single view the workplane's existing one-axis Move rule reports X on XY,
  Z on ZX and Y on YZ.
- In quad view, a flat pane reports the model axis of the latched screen
  direction. When an oblique pane's direction uses both model axes it reports
  their plane. Perspective uses its own checkbox.
- Sphereomancer takes the workplane from the main editor. Its center and
  numbered grabs retain the screen-direction latch. With constraints on,
  their held segment is solved in the chosen plane, then transformed into
  the shape's local space.

## What does not (no badge)

Shift means something else here; leave behaviour and visuals untouched:

- Workplane-off free Move and Move gizmo arrows/squares retain their existing
  Shift solves without feedback. Handles are available with constraints off.
- Every Scale gesture, including free-scale constraints.
- Rotate precision (`rotationAmount`, `rotationDragDegrees`, `movementRotationAmount`).
- Scale step snapping (`amount * 20 / 20`).
- Shift-click to add to a selection, Shift with marquee.
- Shift + arrow-key nudge ×10 (Sphereomancer `CollisionOverlay`, elsewhere).
- Camera `shiftScreenDrag` (camera pan, not an edit lock).

If a site is unclear, list it in the PR and ask Claude Code; do not guess.

## Centralize

[shift-lock.js](../../src/shift-lock.js) owns the latch, model-space offset,
axis/plane description and feedback lifetime. Legacy math imports re-export
the shared functions. [ShiftLockBadge.jsx](../../app/ShiftLockBadge.jsx) renders
the document's single badge in the main window or the detached preview.
Pressing or releasing Shift keeps the accumulated offset. Pointer release,
capture loss, cancellation, Escape and window blur clear feedback.

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

## Implementation and verification

PRs #504 (workplanes), #507 (Sphereomancer) and #510 (contract) were merged
before the implementation branch was created from `55fc271e`.

- [Solver and source guard](../../test/shift-lock-badge.test.js) covers the
  single-view axis rules, plane names, screen latches and their owning module.
- [Packaged badge workflow](../../test/shift-lock-badge.electron.cjs) drives
  a Footman selection, quad panes, gizmo handles, Forge, Movement and POSE.
  A Classic flail model exercises the actual Sphereomancer popup. Checks
  include cursor position, release, Escape, mouse orbit and excluded gestures.
- [Free Move regression](../../test/workplane-free-drag.electron.cjs) measures
  committed geometry and bone positions. [Sphereomancer regression](../../test/optimizexl.electron.cjs)
  exercises live drafts, selection, Escape, nudges and saving.
- The badge workflow first failed on the unmodified packaged base while
  waiting for a visible badge during a ZX Move drag. Light, dark and VIS
  [captures](../../test/evidence/shift-lock-badge/) show the implemented badge.

## Out of scope

Changing what Shift does anywhere, new lock keys, a lock indicator in toolbars or
panels, Settings for the badge, UV editor Shift behaviour.
