# Review of main, 11 November 2026

Status: review done; fixes not started (seven contracts below, ready for Codex)
Owner / consolidator: Claude Code (review), Codex (fixes)
Updated: 2026-11-11

## Goal and completion criteria

- The owner asked for a review of current `main` after about 55 merges in six days:
  architecture, use of shared helpers, serious issues, and lost functionality that
  nobody noticed because little was hand tested.
- Done when every finding below is fixed, decided by the owner, or dropped with a reason,
  and each contract note is marked completed.
- Nothing here changes the app. No version bump. Nothing online until the owner says "merge".

## Revision and local state

- Reviewed: `main` from release 0.38.3 (`cd3d0d09`) to `a8a4ca86` (PR #626).
  PRs #571 to #621 were each read in full by an area reviewer; #622 to #626 merged
  during the review and were read afterwards (their findings are in section "Newest five").
  The findings on #571 to #621 were made at `171b8bb9` and re-checked at `a8a4ca86`.
- Branch with these notes: local `claude/main-review-2026-11-11` (main `a8a4ca86` plus
  this folder's new notes). Not pushed.
- Proof scripts and reviewer outputs, outside Git:
  `D:\Claude\MDLxL-QA\2026-11-11-main-review\<reviewer>\`. The scripts import from
  `D:\Claude\MDLxL\src`, so run them from a checkout at the revision you want to test.
- In progress elsewhere, may overlap: local `codex/release-0.40.0` (release preparation,
  already translates the new UV preview labels and "View All Emitters"), and local
  `claude/fx-editor` (changes `app/SurfaceEffects.jsx` and `src/global-animation-model.js`).

## Findings

Confidence: **script** = reproduced by a script on real code; **run** = an existing test
was run; **read** = traced in the code, not run; **app** = needs the running app to confirm.

### Serious

| ID | What the user would notice | PR | Where | Proof | Contract |
| --- | --- | --- | --- | --- | --- |
| A1 | FX fitted across several checked geosets remembers them by position. Delete or merge an earlier geoset, reopen FX, and it silently works on different parts; Apply saves that. | #603 | `src/editor-document.js` `removeGeosets`; `_FxStack.group` written in `src/global-animation-model.js` `compileAnimation`; read in `app/SurfaceEffects.jsx` | script (`fx-library/stale-indexes.mjs` part A) | [1](review-1-fx-references.md) |
| A2 | Delete a Global Sequence, then re-apply an FX with another loop length: a Global Sequence the user made is deleted and FX's old one is left behind. Known gap from #492, still open. | #492 | `src/sequence-editor.js` `deleteGlobalSequence`; `_FxStack.createdClockIds` | script (same file, part B) | [1](review-1-fx-references.md) |
| B1 | If a save produces a file MDLxL itself cannot reopen, it now overwrites the original with no backup, the tab shows as saved, and the only sign is one status-line message. Before #579 the save was refused and the file on disk stayed intact. | #579 | `src/editor-document.js` `serialize` (`reopened.readOnly` branch), `app/App.jsx` `save` | read (no real model that triggers it was built) | [2](review-2-save-safety.md) |

### Medium

| ID | What the user would notice | PR | Where | Proof | Contract |
| --- | --- | --- | --- | --- | --- |
| B2 | OptimizeXL Save, Paint export, Collect Bit and the Library's model copy used to show an error when a model could not be written without loss. Now they write it with no message. | #579 | `src/optimizexl.js` `prepareOptimizeXL`, `src/paint-export.js`, `src/bits-and-parts.js`, `app/GameFileBrowser.jsx` | read | [2](review-2-save-safety.md) |
| B3 | An AI edit whose save loses data in the other format now passes the AI review. | #579 | `app/ai-editor.js` validate action | read | [2](review-2-save-safety.md) |
| B4 | With "Calculate extents" ticked, Save As does nothing on a model whose extents cannot be calculated (breaks the never-block-saves rule). | #581, #591 | `app/AppDialogs.jsx` `saveAsFormat` | read | [2](review-2-save-safety.md) |
| B5 | If the user deletes a texture, material or node while an AI job runs, the automatic merge can point the AI's edit at the wrong item. | #598 | `app/ai-job-copy.js` `planIndependentEdits` | read | [2](review-2-save-safety.md) |
| C1 | Settings > Hotkeys: picking "Default" in the new Preset dropdown clears every custom key at once, with no confirmation (Restore asks first). | #602 | `app/PresetBar.jsx` `choose` | script (`settings-data/roundtrip.mjs`) | [3](review-3-settings-keys.md) |
| C2 | Importing a configuration file made before 0.39, or by someone else, empties the saved preset lists and resets drag keys, UV choices and toolbar style. | #602 | `src/portable-settings.js`, `app/Settings.jsx` `loadConfiguration` | script (same) | [3](review-3-settings-keys.md) |
| C3 | After rebinding "Lock direction", the small lock badge never appears in the main window. | #602 | `app/main.jsx`, `app/ShiftLockBadge.jsx` | read | [3](review-3-settings-keys.md) |
| D1 | Vertex editor with Animated on: dragging a vertex on a bent limb moves it in another direction than the mouse. | #613 | `app/Viewport.jsx` (`posedEditing = !animated`) | read; app | [4](review-4-editors-previews.md) |
| D2 | UV Wrapper shows the model's first texture (often Team Color) for layers with an animated texture, on models opened from MDL. | #607 | `src/uv-tools.js` `uvMaterialLayers`, `app/game-preview-data.js`, `app/uv-material-preview.js` | script (`uv-preview/texture-fallback.mjs`) | [4](review-4-editors-previews.md) |
| D3 | Auto Corpse can freeze the app on a model whose tail or wing bone is its own parent. | #588 | `src/corpse-geometry.js` (wing and tail walks) | read | [4](review-4-editors-previews.md) |
| A3 | FX with "Selected geosets (3)" chosen: double-click a fourth surface and it fits four. | #603 | `app/SurfaceEffects.jsx` `pickGeoset` | read; app | [1](review-1-fx-references.md) |
| E1 | Paint: Ctrl + right-drag brush size redraws the whole Paint screen on every mouse report (lag risk). | #600 | `app/PaintViewport.jsx`, `app/usePaintImageNavigation.js`, `app/PaintWorkspace.jsx` | read | [5](review-5-paint-drags.md) |
| G1 | The OptimizeXL "accepted flail" safety check fails on main since 6 Nov and nothing runs it automatically. Cause: the new extents finding is not on its allowed list. All accepted outputs still match. | #581 | `test/manual/optimizexl-flail-regression.mjs` | run | [6](review-6-housekeeping.md) |
| G2 | Eleven rows of the task index say "awaiting merge" for work that is merged, so the next agent may redo it. | several | `docs/agent-tasks/README.md` and the matching notes | checked against GitHub | [6](review-6-housekeeping.md) |

### Low

| ID | What | PR | Where | Contract |
| --- | --- | --- | --- | --- |
| A4 | FX: a previewed emitter or a "Selected geosets" choice is not counted as unapplied work; one close key discards it. | #574, #603 | `app/SurfaceEffects.jsx` | 1 |
| A5 | FX group mode: Fit selection and Highlight geoset act on one geoset only. | #603 | `app/SurfaceEffects.jsx` | 1 |
| B6 | Save As leaves a "Calculate extents" undo step and an unsaved mark when the save is cancelled. | #581 | `app/AppDialogs.jsx` | 2 |
| C4 | A new default key (Ctrl+F2, Shift+F3, and Alt+K from #623) silences a command the user had already bound to that key. | #602, #623 | `src/commands.js`, `app/Hotkeys.jsx` `runShortcut` | 3 |
| D4 | Glow Up: models with team glow that is not a flat square now open with "Origin glow" ticked, so one click adds a second glow. | #611 | `src/glow-up.js` `glowStart` | 4 |
| D5 | "Axis guides" exists only in the desktop View menu, as a second copy of the View list; in Animations the tick changes and nothing shows. | #617 | `electron/menu.cjs` | 4 |
| D6 | FX texture fitting: a click with a 1-pixel wobble now changes UVs and adds an undo step. | #602 | `app/UVEditor.jsx` commit rule | 4 |
| D7 | Forge part drags and hover previews still read the raw Shift key, not the rebound one. | #602 | `app/Viewport.jsx` key handler | 4 |
| D8 | UV "Preview RGB" boxes change the preview per keystroke and cannot take a hotkey; "Hide Extras" is spelled unlike the existing "Hide extras" and has no hotkey tag. | #616 | `app/UVWorkspace.jsx` | 4 |
| E2 | Paint: Esc during the brush-size drag keeps the changed size. | #600 | `app/PaintViewport.jsx` `cancelGesture` | 5 |
| E3 | Paint: Alt + middle/right, Ctrl + right and the slow lamp drag ignore the rebindable mouse keys. | #600, #602 | `app/PaintViewport.jsx`, `app/usePaintImageNavigation.js` | 5 |
| E4 | The stage Rotate drag is not in the live-drag guard test. | #575 | `test/live-drag-frames.test.js` | 5 |
| G3 | Second copies of shared rules: extents (sequence, global-track, visibility, additive), emitter visibility, Wiggle parent walk, Paint head detail name test; preset IPC names; a raw z-index. | #581, #576, #583, #600, #602 | see contract | 6 |

### Owner decisions (do not fix until the owner answers)

| ID | Question in plain words | PR |
| --- | --- | --- |
| O1 | AnimXL, Selected bones: dragging on empty space now turns the camera. Box-select and click-empty-to-deselect are gone. Keep, or bring them back on Shift/Ctrl + drag? | #584 |
| O2 | POSE: Rotate on an elbow or knee now turns the joint like any bone. The old swivel (turn the limb while the hand stays put) cannot be reached. Bring it back somewhere, or remove the leftover code? | #585 |
| O3 | After tapping Alt (key hints), the next plain key is swallowed instead of doing its normal job. Wanted? | #602 |
| O4 | New installs start with right/up UV Zoom, but the UV preset reads "Custom" and Restore switches to centre Zoom. Should Restore keep right/up for them? | #602, #615 |
| O5 | German and French keyboards: letter keys the user rebound before 0.39 may now sit on another key. No automatic fix is possible; add one line to the release notes? | #602 |
| O6 | Approve the new extents finding as an allowed addition in the flail check (G1)? All accepted outputs still match. | #581 |
| O7 | Still open from 0.39.0: Esc needs two presses when a tool holds unapplied work; hotkeys no longer fire buttons scrolled out of view; dropdown letter type-ahead is gone. | #602 |

### Process

- PRs #609 to #620 (twelve) were merged while the checks were red. #609 was merged before
  its check finished and broke seven AnimXL tests; the others were compared by hand against
  the red base. The revert #621 made main green and it has stayed green through #626.
  No new failure was hidden, but nothing was guarding those merges.
- The flail check (G1) is a manual script named in the OptimizeXL teaching agreement. It is
  not in CI, the packaged suite or the QA kit, which is how it stayed broken for five days
  and through the 0.39.0 release.

### Newest five (#622 to #626, merged 11 Nov, all in [contract 7](review-7-newest-five.md))

| ID | Level | What the user would notice | PR | Where | Proof |
| --- | --- | --- | --- | --- | --- |
| H1 | Medium | BITZ Replace Part: close MDLxL (or crash) before Commit and the replacement is gone with no prompt and no recovery copy; "Save" at the close prompt saves the model without it. | #625 | `app/App.jsx` (`bitReplacement`, `hasAnyUnsavedWork`, checkpoint effect) | read |
| H2 | Medium | BITZ Replace Part always places a Bit with several RGB looks uncoloured; the look list is hidden. The result depends on click order. | #625 | `app/BitsAndParts.jsx` `choose` | read |
| H3 | Medium | On Windows a tool window dragged to the top slides under the new menu bar; in VIS its whole title bar is hidden and only Escape gets rid of it. | #623 | `app/useMovableWindow.js` `clamp`, `app/desktop-menu.css` | read; app |
| H4 | Medium | New BITZ, Library and EMTR menu text stays English in all five languages. | #622, #625, #626 | see contract | script |
| H5 | Low | Node Manager opened while the Emitter Manager is open keeps the emitter-only state. | #622 | `app/AppDialogs.jsx` | read |
| H6 | Low | Curve Properties, POSE setup and Add-ons panels open 25 px too high on Windows. | #623 | `app/movement.css`, `app/pose-controls.css`, `app/addons.css` | app |
| H7 | Low | Replace Part R/G/B boxes replace an animated colour on any selected geoset with one fixed colour. | #625 | `src/bits-and-parts.js` `setPartRgbChannel` | read |
| H8 | Low | BITZ Manage > Move leaves a Bit's own texture files behind; the Bit then shows "Unavailable textures". | #625 | `electron/bits-and-parts.cjs` | read |
| H9 | Low | Every build now needs the .NET compiler and writes a temporary program to the C: temp folder. | #624 | `vite.config.js` | read |

Owner decisions from these five:

| ID | Question in plain words | PR |
| --- | --- | --- |
| O8 | MDLxL now starts a small helper program (`capture-regions.exe`) for every Windows user as soon as an editor is visible, so ShareX can find the viewport and toolbox. No setting, also without ShareX. It writes nothing and reads nothing else. Keep it on for everyone, or make it a setting that is off by default? | #624 |
| O9 | Texture pickers in Forge, EMTR, FX, Paint and UV now open in Standard layout too, not only the Library, for users who never chose a layout. Wanted? | #626 |
| O10 | Surface Effects got the default key Alt+K. An earlier test said "no default key, by decision". Keep the key? | #623 |
| O11 | With VIS on, the top menu on Windows is now the new look's drawn menu (rounded, Segoe UI) instead of the classic one. Restyle it classic in VIS? | #623 |

## Checked and found fine

- POSE anatomy revert (#621): complete; nothing of #609/#610 is left.
- Old profiles: #602 only added preference keys; none renamed or dropped, limits unchanged.
- UV Rotate and Zoom: the owner-locked numbers and their test are unchanged.
- Shared previews: the UV-preview changes (#606, #607, #616) reach only the UV Wrapper;
  Bones (#583) and POSE (#585) changes are gated to their modes.
- Overlapping big merges did not drop each other's work: #600 against #602 (Paint), and the
  five PRs on the particle editor.
- #596 removed about 3,100 translation lines; none is still used.
- OptimizeXL exact cleanup (#548) keeps its exclusions; Flail01 reproduces every accepted
  output; Flail03 reproduces all but the documented `mounted-spheres` case, which needs
  its historical reference file.
- Glow detection: 794 test models compared before and after #611; only the two intended
  models changed, plus the four in D4.
- Settings previews stop when hidden; no new drag does per-event work except E1; new
  windows use the shared shells; no new direct file writes or localStorage use.

## Rules for every contract

1. Start a `codex/<name>` branch from local `claude/main-review-2026-11-11` in your own
   worktree under `D:\Codex\`. Read `AGENTS.md`, the map row the contract names and
   [TESTING-RULES](../TESTING-RULES.md) first.
2. For each item: first a test that fails on the current code (real input for anything on
   screen), then the smallest fix. Fix every instance of the same fault, not only the one
   listed. Old results must not change for cases that already worked.
3. No new features, panels, settings or wording beyond what the item says. No version bump.
4. Focused tests only; never the full packaged suite. Report exactly what was run.
5. An item marked **owner decision** is skipped until the owner answers. Do not choose.
6. Nothing online until the owner says "merge". Report `saved on your PC, not online`.
7. On finishing: update the contract note (status, revision, checks, what is left), add a
   short plain-language summary for the owner, and hand back to Claude for review.

## Blockers and next action

- Owner: answer O1 to O6 and O8 to O11, and say which contracts go into 0.40.0.
- Codex: contracts 1 and 2 first (both touch `src/editor-document.js` in different
  functions; merge 1 before 2). Contracts 3, 4, 5 and 7 can run at the same time
  (7 shares `app/App.jsx` and `app/AppDialogs.jsx` with 2, in other functions).
  Contract 6 last.
- On completion: mark this note completed and remove its row from the [task index](README.md).
