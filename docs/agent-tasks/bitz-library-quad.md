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
- Select target vertices, open BITZ, choose **Replace Part** and a Bit, then
  click **Edit in Quad View**. The Bit starts at its own size on the target.
  The actual vertex editor opens on a disposable document with Move active.
  **Commit** installs the edited result as one model undo step. **Cancel**
  restores the original document and view mode.

The focused source tests failed on the baseline because custom RGB was
ignored and the library had no change API. The packaged test failed on the
baseline at the missing Manage button. It uses the Classic Footman fixture
and runs on the invisible Windows test desktop. The final build passed
125 focused source and compatibility tests and the packaged Bitz test.
The packaged test verified live RGB, mouse rotation, Move, draft undo and
redo, Cancel, one-step Commit undo and redo, and whole-part import. Its
recycle-bin destination was redirected to the disposable test folder.
Warcraft III gameplay and the OS recycle-bin integration were not exercised.
Disposable builds and profiles were removed after verification.
