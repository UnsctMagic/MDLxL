# Vertex Move in quad and orthographic views

Owner: Codex. Branch `codex/vertex-move-quad-and-clipping` from `66e38f5`.

Both regressions were reproduced with the Footman MDX1800, displayed geoset 1 and all 447 vertices selected. In #512, the threshold for an ordinary quad Move still read the removed `drag.move.point`. It threw before the draw and prevented the edit from committing. Separately, the orthographic camera could clip the selection in either depth direction while it still projected inside the viewport. That occurred on #512 and its parent.

The shared Move solver supplies the net projected displacement across Shift changes for the quad commit threshold. The viewport uses the current visible geosets' bounding spheres for orthographic depth during edits and after commit or undo. The perspective camera keeps its existing depth calculation.


## Verification

The packaged Footman tests failed first on the #512 owner build (`ece5990a`). Ordinary Front Move raised `Cannot read properties of undefined (reading 'point')`. At each orthographic limit all 447 vertices projected inside the viewport and all 447 were depth-clipped, both while held and after release.

On the combined package the selection moved visibly, committed and undid in all four panes, including Shift changes and perspective gizmo handles. Moves of half a pixel and exactly one pixel were ignored on release. Two pixels committed. At the near and far limits there were zero clipped vertices in all four held/released captures. Mouse rotation, undo and redo were exercised.

Six packaged workflows passed: `quad-move`, `orthographic-live-depth`, `quad-view`, `shift-lock-badge`, `workplane-free-drag` and `billboard-vertex-drag`. The focused source run passed 138 tests with zero failures or skips. Ready for independent review.
