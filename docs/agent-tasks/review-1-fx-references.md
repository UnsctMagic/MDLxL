# Contract 1: FX keeps pointing at the right geosets and clocks

Status: ready for Codex
Owner / consolidator: Codex (fix), Claude Code (contract and review)
Updated: 2026-11-11

Findings A1, A2, A3, A4, A5 of the [main review](main-review-2026-11-11.md). Read its
"Rules for every contract" first. Required reading: [FX contract](../FX-GLOBAL-ANIMATIONS.md),
map row "FX global animation maker".

## Goal and completion criteria

FX stores positions of other things in the model inside `_FxStack`. When those things are
deleted or renumbered elsewhere, FX's stored positions go stale and its next Apply damages
the model. Done means:

1. **A1.** After any geoset is removed or merged (`removeGeosets` in
   `src/editor-document.js`, the one function every geoset delete goes through: manual
   delete, Sort My Mess, Merge Similar, OptimizeXL empty-geoset repair, FX's own sweep),
   every geoset's `_FxStack.group` still names the same geosets as before, with removed
   ones dropped. Same for any other geoset position kept in `_FxStack`: check
   `contact.geoset` (impact) and list any further ones you find.
2. **A2.** After `deleteGlobalSequence` (`src/sequence-editor.js`), every
   `_FxStack.createdClockIds` still names FX's own clocks: the deleted id is dropped and
   higher ids move down by one, as `compileAnimation` already does for its own deletes.
   A later FX Apply must never delete or take over a Global Sequence the user made.
3. Models saved by 0.39.0 that already hold a stale `group` must not crash FX: on opening
   FX, entries that are out of range or point at an FX-made geoset are dropped (this
   filter exists; keep it). Do not try to guess the originally intended geoset.
4. **Part B, FX window (A3, A4, A5), see the overlap note below:**
   - A3: double-clicking a surface outside the current group switches to that part alone.
   - A4: a previewed emitter or a changed "Selected geosets" choice counts as unapplied
     work, so closing asks for the second key press like other edits.
   - A5: in group mode, Fit selection frames all group members and Highlight geoset
     highlights all of them.

Out of scope: any change to looks, layers, fitting maths, the FX window layout, or how
`_FxStack` is saved.

## Revision and local state

- Base: local `claude/main-review-2026-11-11` (`main` at `a8a4ca86`).
- **Overlap:** local branch `claude/fx-editor` changes `app/SurfaceEffects.jsx`,
  `src/global-animation-model.js` and `test/global-animations.test.js`. Parts 1 to 3 do
  not need those files: put the remaps in `src/editor-document.js` and
  `src/sequence-editor.js` and the tests in a new file `test/fx-stale-references.test.js`.
  **Do Part B only if `claude/fx-editor` has been merged or the owner says to go ahead**;
  otherwise leave it and say so in this note.
- Fixtures: none beyond the repository's demo model. The proof script builds its own.

## Relevant owners

- `removeGeosets`, `deleteGeoset`: `src/editor-document.js`.
- `deleteGlobalSequence`: `src/sequence-editor.js`.
- `compileAnimation`, `readAnimationStack`, `clockFor`, the FX sweep:
  `src/global-animation-model.js`. `_FxStack` save format: `src/global-animation-data.js`.
- Window: `app/SurfaceEffects.jsx` (`pickGeoset`, `members`, `unapplied`, `frameGeosets`).

## Findings and decisions

- Verified (script, on `171b8bb9`; files unchanged since):
  `node D:\Claude\MDLxL-QA\2026-11-11-main-review\fx-library\stale-indexes.mjs`.
  Part A: group `[3]` ("v24") still reads `[3]` after deleting geoset 1, now "v104".
  Part B: Global Sequences `[500, 1760 (FX), 7777 (user)]`; delete the first; re-apply
  with a new loop gives `[1760, 2010]`: the user's 7777 is gone, FX's 1760 is orphaned.
- Decision: fix at the shared delete functions, so every tool is covered at once.
- Uncertain: whether `clockFor` can still adopt a user clock of equal duration after the
  fix; the existing test "FX clocks do not reuse or delete an authored clock with the same
  duration" must keep passing, extended as below.

## Changes and verification

Tests to add first (each must fail on the base):

- `test/fx-stale-references.test.js`: apply a grouped look, remove an earlier geoset
  through the document (`doc.apply` + `removeGeosets`), assert the stored group names the
  same geosets (compare by vertex data, not by position). Repeat for a merge
  (`Map` form of `removeGeosets`) and for removing a group member (it is dropped).
- Same file: user Global Sequence beside an FX clock; delete an earlier Global Sequence;
  re-apply with another loop length; assert the user's sequence and every track that
  uses it are unchanged, and no orphaned FX clock remains.
- Undo and redo across both cases restore `_FxStack` exactly.
- Part B, if done: extend `test/fx-selected-geosets.electron.cjs` (real double-click on a
  surface outside the group; Fit selection bounds) and `test/fx-empty-emitters.electron.cjs`
  (pick an emitter, one Escape, window still open).

Run: `node --test test/fx-stale-references.test.js test/global-animations.test.js
test/editor-document.test.js test/geoset-operations.test.js test/sort-my-mess.test.js`,
then the two packaged tests above if Part B was done. Because `removeGeosets` is shared,
also run the focused tests of its other callers named in the map (OptimizeXL
`test/optimizexl.test.js`).

## Blockers and next action

- No blocker for parts 1 to 3. Part B waits on the overlap note.
- On completion: status, revision and checks here; plain summary for the owner; hand back.
