# Vertex Move in quad and orthographic views

Status: completed, merged in #514 at 7612078a

Owner: Codex. Branch `codex/vertex-move-quad-and-clipping` from `66e38f5`.

Both regressions were reproduced with the Footman MDX1800, displayed geoset 1 and all 447 vertices selected. In #512, the threshold for an ordinary quad Move still read the removed `drag.move.point`. It threw before the draw and prevented the edit from committing. Separately, the orthographic camera could clip the selection in either depth direction while it still projected inside the viewport. That occurred on #512 and its parent.

The shared Move solver supplies the net projected displacement across Shift changes for the quad commit threshold. The viewport uses the current visible geosets' bounding spheres for orthographic depth during edits and after commit or undo. The perspective camera keeps its existing depth calculation.


## Verification

The packaged Footman tests failed first on the #512 owner build (`ece5990a`). Ordinary Front Move raised `Cannot read properties of undefined (reading 'point')`. At each orthographic limit all 447 vertices projected inside the viewport and all 447 were depth-clipped, both while held and after release.

On the combined package the selection moved visibly, committed and undid in all four panes, including Shift changes and perspective gizmo handles. Moves of half a pixel and exactly one pixel were ignored on release. Two pixels committed. At the near and far limits there were zero clipped vertices in all four held/released captures. Mouse rotation, undo and redo were exercised.

Six packaged workflows passed: `quad-move`, `orthographic-live-depth`, `quad-view`, `shift-lock-badge`, `workplane-free-drag` and `billboard-vertex-drag`. The focused source run passed 138 tests with zero failures or skips. All six also passed on the integrated build through `d505914`. The quad test compares the last applied pointer sample with the committed result under a 30 FPS cap. [PR #514](https://github.com/UnsctMagic/MDLxL/pull/514) is ready for independent review.


## Single-view vertex Move

In the main Vertices editor, every single-view camera uses the screen plane for the unshifted part of a Move drag, including when Workplane Constraints is checked. The shared Shift latch keeps the existing lock while held and resumes free movement from the released position. The opt-in is limited to this editor's single view.

The Footman test on the prior PR head failed in Left/XY. A 36-pixel horizontal and 22-pixel upward drag moved the selection 36 pixels across and zero up. [The packaged regression](../../test/single-view-vertex-move.electron.cjs) repeats the diagonal drag in eight camera views with XY, ZX and YZ; checks the locked and released segments of the same drag; and commits and undoes the result.
