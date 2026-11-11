# Bitz library management and Quad replacement

Status: local branch for owner review
Owner: Codex
Updated: 2026-11-11
Branch: `codex/bitz-library-quad`
Base: `171b8bb9`

- In BITZ, **Manage** lists files and folders in the desktop BitsAndParts
  library. Use **New folder**, **Rename**, **Move**, and **Delete**. Delete
  uses the platform trash. Moving a Bit leaves its texture references intact.
- In the normal Bit picker, choose a preset when available and edit the
  **R**, **G**, and **B** fields (0–255). A blank channel keeps the preset.
- Select target vertices and open BITZ. Choose **Replace Part** and click a
  Bit, or click **Replace Part** with a Bit already selected. The vertex
  editor opens directly in Quad View with Move active and the Bit at its own
  size on the target. The controls are centered just above the Quad View
  divider, with RGB for the selected geosets. **Commit** installs the edited
  result as one model undo step and returns to the previous editor view.
  **Cancel** returns to the same view with the original model.

The focused source tests failed on the baseline because custom RGB was
ignored and the library had no change API. The packaged test failed on the
baseline at the missing Manage button. It uses the Classic Footman fixture
and runs on the invisible Windows test desktop. The final build passed
125 focused source and compatibility tests and the packaged Bitz test.
The packaged test verified live RGB, mouse rotation, Move, draft undo and
redo, Cancel, one-step Commit undo and redo, and whole-part import. Its
recycle-bin destination was redirected to the disposable test folder.
The direct-entry regression failed on the previous build because selecting a
Bit left the picker open. The revised package passed both click orders, live
RGB in Quad View, and the existing Commit and Cancel checks. All 52 focused
source checks passed on the revision. Warcraft III gameplay and the OS
recycle-bin integration were not exercised. The owner test copy retains its
existing Bitz folder and profile. The placement assertion failed on the
top-bar build and passed on the centered layout. All 18 focused Quad View
and viewport checks passed for the placement change. The restore check
failed on the previous package because Commit left Quad View on. The revised
package returned to the prior single view and the prior Quad pane with their
camera framing, and preserved the single view's render mode and tool.
All 42 focused Bitz and viewport checks passed.
