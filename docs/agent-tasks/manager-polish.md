# Manager workspace and visual model editing

Status: completed — merged in #363 (9d988af2)
Owner: Codex, Manager polish chat
Updated: 2026-10-28

## Scope

Managers sits after Animations and before Paint and opens Materials in the full
editor workspace. The top Managers menu retains movable popup managers. Existing
manager controls, selection wiring, texture loading, previews and other editor
sidebars are preserved. The owner chose tabs and explicitly rejected replacement
mockups, clutter and numerical forms where visual editing is appropriate.

Model adds the internal model name, sphere and box collision creation, selection,
direct center dragging, symmetric edge resizing and size sliders. New shapes fit
the model's bind-pose geometry. Existing node transforms are evaluated for the
outlines and inverted for dragging; parenting and animation tracks remain intact.
A gesture commits one document history step; Escape cancels its draft. Camera
rotation uses the normal preview controls. No private comment format was added:
standard MDL header comments can be edited and saved; MDX has no native comment
field. The collapsed Comments section explains that limitation for MDX files.

## Source and handoff

- Branch: `codex/manager-schemes`.
- PR: https://github.com/UnsctMagic/MDLxL/pull/363 (merge authorized).
- Working checkout: `D:\Codex\mdlxl-manager-schemes-20261028\source`.
- App/AppToolbar/AppDialogs own workspace routing and shared manager wiring.
- ResourceEditors retains existing manager bodies and supports embedded/window modes.
- ModelManager, collision-stage and model-collisions own the new visual controls.
- model-comments/editor-document preserve native MDL header comments and history.

## Verification

- Production build passed.
- 30 focused tests passed: native MDL/MDX name/collision round trips, removal,
  undo/redo, transformed drag mapping, standard MDL comment persistence,
  inline-comment preservation, existing manager and appearance regressions.
- An isolated unpacked portable UI test assembly reported app.isPackaged=true.
  Actual mouse tests passed: full workspace, sphere/box creation, center drag,
  edge resize, slider edit, undo, camera orbit, native-menu popup, and Materials
  on re-entry. This was UI packaging, not the complete release packaging pipeline.
- A visible isolated portable app was opened at Manager > Model using demo.mdx.
  The displayed sphere is an unsaved example. No installed app, personal profile
  or supplied user model was changed. The review app remains available for testing.
- The owner accepted the design. Warcraft III in-game validation remains outstanding.
  Merge authorized by the owner. No release, version change or installation was requested.

Final integration retains main's Sanity Check menu entry and updated translations.
The optimizer verifies native MDX fields separately from standard MDL comments;
an apply/save regression proves those comments remain in the MDL document.
