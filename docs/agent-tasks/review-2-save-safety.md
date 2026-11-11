# Contract 2: saves stay unblocked, but never destroy the file quietly

Status: implemented and verified for Claude review.
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

## Codex handoff

Local code revision 4ff8a51d on codex/main-review-20261111-2, based on contract 1 handoff d13fbf6f.

- B1: the serializer reports unreadable output separately from readable output with warnings. The desktop save queue backs up the selected overwrite destination with the existing backup helper and verifies the written bytes. A new destination needs no backup. The notice gives the backup path when present. The tab keeps its previous source association and saved baseline and stays dirty. The previous markSaved path installed the unreadable bytes as the original and marked the live snapshot saved.
- B4/B6: Calculate extents runs on the save snapshot. Its undo step is recorded on the live model after a write. A calculation error leaves the old extents and appears alongside the save warnings. The existing animation-draft and keyframe-fix checks still run before staging; the latter retains the chosen extents option on retry.
- B5: automatic AI delivery asks when any listed indexed collection changes length or the occupancy of the sparse Nodes table changes. In-place edits can still combine under the previous overlap checks. B3 treats round-trip warnings as errors per requested format; AI export also stops before writing on such a warning.

### Serializer callers

| Caller | Policy |
| --- | --- |
| src/save-target.js and app/model-save.worker.js | User Save/Save As keeps verification warnings visible and uses the unreadable-write handling above. |
| src/optimizexl.js | Strict on the input snapshot and the candidate. The approved result uses normal user Save. |
| src/paint-export.js | Strict on the portable project's working model and the exported model. The existing Paint save/export error handler displays the failure. |
| src/bits-and-parts.js | Strict for Collect Bit. The collection dialog displays the failure. |
| app/GameFileBrowser.jsx | Strict for both serializers in the checked-geoset copy. Its existing message shows the failure. A whole-file Library copy passes through original bytes. |
| app/LibrarySaveCopy.jsx | Converts textures only. |
| app/ai-editor.js | Strict serialization immediately after AI edits. AI Validate and Export reject the verification warnings returned by the shared save worker. |
| src/model-optimizer.js | Existing input reopen and explicit round-trip checks; strict candidate serialization. |
| src/particle-recipes.js | Existing strict native import proof. |
| src/editor-document.js | markSaved fallback makes an in-memory baseline when no bytes were supplied. The user-save flow passes bytes only after the successful verification policy. |
| app/App.jsx, app/ParticleEditor.jsx, src/emitter-text.js, src/starter-model.js | Existing in-memory Paint source snapshot, Particle Lab baseline after saving a recipe, emitter text generation, and empty model initialization respectively. Their serialization calls do not write model files. |

### Verification

- Base d13fbf6f: node --test test/save-verification-writers.test.js test/ai-job-copy.test.js test/ai-background.test.js, 27 pass, 25 fail, 0 skip. Four writers accepted changed data, AI Validate reported no error for missing Info.AnimationFile in MDL, and indexed-list mutations were automatically merged. The two MDX/MDL unreadable preflight checks also failed because the unreadable flag was undefined.
- Base hidden package: save-extents had 1 pass and 2 failures (Cancel left changed bounds, one undo step and a dirty tab; non-finite geometry prevented writing). save-unreadable failed on the missing backup after a real Save As overwrite. Library copy failed to show the save warning when run with just its two pre-fix serializer calls restored in the disposable bundle.
- 4ff8a51d: 242 pass, 0 fail, 0 skip with node --test test/save-verification-writers.test.js test/ai-job-copy.test.js test/ai-background.test.js test/editor-document.test.js test/geoset-animation-save.test.js test/optimizexl.test.js test/bits-and-parts.test.js test/bit-collection.test.js test/bit-replacement.test.js test/paint-contract.test.js test/paint-export.test.js test/ai-model.test.js test/game-file-library.test.js test/desktop-bridge.test.js tests/editor-roundtrip.test.js tests/lossless-roundtrip.test.js. Another 12 pass, 0 fail, 0 skip from test/save-target.test.js and test/editor-data.test.js.
- 4ff8a51d built with pnpm exec vite build --configLoader runner and packaged offline using the cached Electron archive. Hidden Windows desktop, node --test --test-concurrency=1 test/save-extents.electron.cjs test/save-unreadable.electron.cjs test/library-copy-verification.electron.cjs, 5 pass, 0 fail, 0 skip. Real F12, clicks and keys exercised normal, cancelled and failed-extents saves; forced unreadable overwrite and new-file saves; and the Library's visible warning. Native file pickers used the shared dialog stubs. Test-only writer faults were scoped to the disposable package.
- The automatic approval reviewer rejected the broad pnpm test invocation under the focused-only instruction. The two relevant compatibility files ran above. The real Save As animation-draft and keyframe-fix branches were checked in source. Warcraft III was not run.

Owner summary: A save MDLxL cannot read back makes a copy of the file it replaces and leaves the tab unsaved. Save As can still write when extents fail and leaves extents alone if you cancel. Paint, Collect Bit, OptimizeXL, Library and AI now surface write verification failures, and AI asks before combining edits after indexed items are added or removed.