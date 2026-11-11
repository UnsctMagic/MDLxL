# Contract 2: saves stay unblocked, but never destroy the file quietly

Status: ready for Codex (start after contract 1 is merged or rebased on it)
Owner / consolidator: Codex (fix), Claude Code (contract and review)
Updated: 2026-11-11

Findings B1 to B6 of the [main review](main-review-2026-11-11.md). Read its "Rules for
every contract" first. Map rows: "Open, save, import/export MDL/MDX; undo", "AI chat".
Read [save verification](../SAVE-COMPATIBILITY-VERIFICATION.md).

## Goal and completion criteria

The owner's rule from PR #579 stays: **a save is never refused**. What #579 lost is the
protection around it. Done means:

1. **B1.** When the file about to be written cannot be reopened by MDLxL
   (`reopened.readOnly` in `EditorDocument.serialize`):
   - the save still happens;
   - the file being replaced is first kept as a copy beside it (use the existing
     `backupModelFile` in `electron/optimizexl-save.cjs`, `Name_backup.ext`; do not
     invent a second backup scheme), only in this case and only when a file is being
     overwritten;
   - the user gets a real notice (`setNotice`, the existing dialog), saying in plain
     words that the saved file could not be read back and where the copy of the previous
     file is; a status-line message alone is not enough;
   - the tab stays marked unsaved and the document's saved baseline is not replaced by
     the unreadable bytes (`markSaved` is not called for this save).
2. **B2.** Every other writer that used to stop on a verification problem either shows
   the warning or keeps the strict check: `prepareOptimizeXL` (`src/optimizexl.js`),
   Paint export (`src/paint-export.js`), Collect Bit (`serializeCollectedPart` in
   `src/bits-and-parts.js`), the Library model copy (`app/GameFileBrowser.jsx`, and
   `app/LibrarySaveCopy.jsx` if it writes models). Tools that write unattended use
   `serialize(format, { strict: true })`; a user-driven save shows
   `doc.lastSaveWarnings`. List each caller of `serialize(` in `src/` and `app/` in this
   note with the choice made.
3. **B3.** The AI `validate` action (`app/ai-editor.js`) treats save-verification
   warnings as errors again, for every format it checks.
4. **B4.** Save As with "Calculate extents" ticked: if extents cannot be calculated the
   save still happens, with a message that extents were left as they were. Only a
   failed rename keeps blocking as today.
5. **B6.** If Save As does not end in a written file (dialog cancelled, animation
   drafts, plain-track fix), the "Calculate extents" step is not left in the model.
6. **B5.** AI automatic merge (`planIndependentEdits` in `app/ai-job-copy.js`): when the
   user's edits since the job started add to or remove from a list that other data refers
   to by position (Textures, Materials, TextureAnims, GlobalSequences, Geosets,
   GeosetAnims, every node collection, PivotPoints), there is no automatic merge; the
   existing ask-the-user path is used.

Out of scope: changing what counts as a verification problem, the save dialog layout,
new settings, any change to recovery checkpoints.

## Revision and local state

- Base: local `claude/main-review-2026-11-11` (`main` at `a8a4ca86`), after contract 1
  (both edit `src/editor-document.js`, in different functions).
- No real model is known that reaches the unreadable-save path. Build the case in a test
  (for example stub the writer or the reopen check); do not wait for a real one.

## Relevant owners

- `EditorDocument.serialize`, `markSaved`, `lastSaveWarnings`: `src/editor-document.js`.
- `prepareModelSave(Async)`: `app/model-save.js`, `src/save-target.js` (`notes`).
- `save`: `app/App.jsx`. Save As: `saveAsFormat` in `app/AppDialogs.jsx`.
- Desktop write: `model:save` and `model:backup` in `electron/main.cjs`,
  `electron/atomic-file.cjs`, `electron/optimizexl-save.cjs`.
- AI: `app/ai-editor.js` (validate), `app/ai-review.js`, `app/ai-job-copy.js`.

## Findings and decisions

- Verified by reading at `a8a4ca86`: `serialize` returns the output after a warning when
  the reopen fails; `App.save` writes it, shows `Saved <name>`, then replaces that with
  the notes on the status line, then calls `markSaved`. The model file has no backup on
  an ordinary save. `lastSaveWarnings` is read only in `src/save-target.js`.
- Verified by reading: `saveAsFormat` wraps `calculateExtents` in `try … catch { return; }`.
- Decision: keep the owner's never-block rule. Protection, notice and unsaved mark
  replace the old refusal.
- Uncertain: what `markSaved` does today with unreadable bytes (it reopens them). The
  B1 test will show; record it here.

## Changes and verification

Tests to add first (each must fail on the base):

- `tests/editor-roundtrip.test.js` or `test/editor-document.test.js`: force an
  unreadable output; assert `serialize` still returns bytes, flags the case, and that
  after the app-level save step the document is still dirty with its old baseline.
- A packaged test beside `test/save-extents.electron.cjs`: real Save on such a model;
  the notice is shown, `Name_backup.ext` holds the previous bytes, the tab is unsaved.
- `test/save-extents.electron.cjs`: a model with a non-finite vertex and the box ticked
  is written; cancelling the file dialog leaves the document unchanged and not dirty.
- A source test per B2 caller: with a forced verification difference the caller throws
  or returns the warning.
- AI validate: a model that loses data in the other format fails validation.
- `test/ai-job-copy.test.js`: user deletes `Textures[0]` while the job sets a layer's
  `TextureID` to 1; expect a conflict, not a merge. Same for a deleted material and node.

Run the files above plus `pnpm test` (compatibility suite), `test/optimizexl.test.js`,
`test/bits-and-parts.test.js`, `test/paint-contract.test.js`, `test/ai-model.test.js`.

## Blockers and next action

- None. On completion: status, revision and checks here; plain summary for the owner;
  hand back.
