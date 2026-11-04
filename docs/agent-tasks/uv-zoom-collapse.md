# UV Zoom collapse regression

Status: ready for review; awaiting Claude QA and merge approval
Owner: Codex
Updated: 2026-11-04

## Request and scope

Restore UV Wrapper Zoom to its pre-patch behavior: two selected UV vertices can
shrink to exactly the same location. The owner explicitly requested the old
behavior and no changes to other UV tools or 3D zoom.

## Revision and owners

- PR: [#549](https://github.com/UnsctMagic/MDLxL/pull/549).
- Branch: `codex/uv-zoom-collapse`; base `f67cbb55` (current main at task start).
- Only application change: `app/UVEditor.jsx`, `applyMove` scale factor.
- Contract: [UV Zoom drag](../UV-ZOOM-DRAG.md).
- Check: `test/uv-zoom-collapse.electron.cjs`.
- Fixture: `fixturePath('footman')` from the permanent test-model collection;
  source file verified unchanged.
- Small local evidence: `D:\Codex\mdlxl-uv-zoom-collapse-report`.

## Findings and change

`96eb51f2` changed horizontal scaling to unsigned distance from the centre.
That cannot reach zero when passing beside the centre and rebounds after
crossing it. Restore the exact original `Math.max(0, 1 + dx / 100)` expression.
No other UV operation, shared helper, camera or 3D editor was changed.

## Verification

- New packaged test failed on unmodified `f67cbb55`: `left drag past zero:
  live drag reaches identical coordinates`. The two vertices remained at
  different UV coordinates.
- Rebuilt/package verified; corrected hidden-desktop packaged test passes
  (1 test, 114 successful checks, 0 failures, 0 skips). Real clicks select two Footman UV points.
  Mouse drags cover collapse while held and after release, no rebound,
  left/right scaling from five starting positions, diagonal drags, Alt fine
  control, both Shift axes and exact model restoration with undo.
- Preservation checks pass for Move, Rotate, both Mirrors, Fold, unselected UVs,
  UV view state and 3D camera state. UV wheel zoom and normal 3D mouse
  rotation/wheel zoom work; navigation leaves the model unchanged.
- Compatibility: 57 passed, 0 failed, 0 skipped.
- Full source run: 2808 passed, 1 failed, 10 skipped. The one failure was the
  test-helper default-temp assertion because this run set `MDLXL_TEMP` to the
  report folder. With that override removed (default already lives on D:),
  the failed test and focused UV/source checks passed: 77 passed, 0 failed,
  0 skipped. No source or baseline change was needed. The full-suite log
  preserves the existing opt-in/private-fixture/platform skips.
- No owner hand test, independent Claude QA or Warcraft III gameplay test.

## Next action

Claude reruns the packaged regression and owns the independent QA verdict.
Merge only after explicit owner approval. After merge, record its revision and
remove this note's active-index row. No version bump, release or installed
profile change is included.
