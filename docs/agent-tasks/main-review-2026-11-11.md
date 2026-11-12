# Review of main, 11 November 2026

Status: main at 3dbf8f48 and Claude’s notes are merged locally. The requested checks passed. Ready for Claude’s final review.
Owner / consolidator: Claude Code (review), Codex (fixes)
Updated: 2026-11-12

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

### Owner decisions

Claude listed a suggested answer for each question. Owner, 11 Nov 2026: "Yes, your
picks". The Decision column records those answers and the owner’s separate O2 and
O7 decisions from 12 Nov.

| ID | Question in plain words | PR | Decision |
| --- | --- | --- | --- |
| O1 | AnimXL, Selected bones: dragging on empty space now turns the camera. Box-select and click-empty-to-deselect are gone. Keep, or bring them back on Shift/Ctrl + drag? | #584 | Keep as it is. No work. Reopen only if the owner misses box-select. |
| O2 | POSE: Can the elbow or knee still swivel with the hand or foot held in place after #585 changed Rotate? | #585 | Owner, 12 Nov: “i didnt use it but why was it removed? not approved.” Verified on the packaged Footman: **Move** on Elbow or Knee swivels the bend with the endpoint fixed. **Rotate** turns the joint and respects a pinned endpoint. The new check passed with the existing POSE code. |
| O3 | After tapping Alt (key hints), the next plain key is swallowed instead of doing its normal job. Wanted? | #602 | Put the old behaviour back: [contract 3](review-3-settings-keys.md) item 5. |
| O4 | New installs start with right/up UV Zoom, but the UV preset reads "Custom" and Restore switches to centre Zoom. Should Restore keep right/up for them? | #602, #615 | Restore keeps right/up on new installs: contract 3 item 6. |
| O5 | German and French keyboards: letter keys the user rebound before 0.39 may now sit on another key. No automatic fix is possible; add one line to the release notes? | #602 | One line in the 0.40.0 release notes: contract 3 item 7. |
| O6 | Approve the new extents finding as an allowed addition in the flail check (G1)? All accepted outputs still match. | #581 | Approved: [contract 6](review-6-housekeeping.md) item 2. |
| O7 | From 0.39.0: Esc needs two presses when a tool holds unapplied work; hotkeys do not fire buttons scrolled out of view; dropdown letter type-ahead is gone. | #602 | Owner, 12 Nov: “yes approved.” Keep the three behaviors. |

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

Owner decisions from these five (same "Yes, your picks" on 11 Nov 2026):

| ID | Question in plain words | PR | Decision |
| --- | --- | --- | --- |
| O8 | MDLxL now starts a small helper program (`capture-regions.exe`) for every Windows user as soon as an editor is visible, so ShareX can find the viewport and toolbox. No setting, also without ShareX. It writes nothing and reads nothing else. Keep it on for everyone, or make it a setting that is off by default? | #624 | A setting, off by default: [contract 7](review-7-newest-five.md) item 10. |
| O9 | Texture pickers in Forge, EMTR, FX, Paint and UV now open in Standard layout too, not only the Library, for users who never chose a layout. Wanted? | #626 | Keep. No work. |
| O10 | Surface Effects got the default key Alt+K. An earlier test said "no default key, by decision". Keep the key? | #623 | Keep the key, once it cannot take over a key the user bound themselves: contract 3 item 4. |
| O11 | With VIS on, the top menu on Windows is now the new look's drawn menu (rounded, Segoe UI) instead of the classic one. Restyle it classic in VIS? | #623 | Classic in VIS: contract 7 item 11. |

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
5. The owner's decisions are in the two "Owner decisions" tables above. An item still
   marked **Open** there is not touched. Do not choose for the owner.
6. Nothing online until the owner says "merge". Report `saved on your PC, not online`.
7. On finishing: update the contract note (status, revision, checks, what is left), add a
   short plain-language summary for the owner, and hand back to Claude for review.

## Local handoff to Claude

Review base is 4340c5f8 on claude/main-review-2026-11-11. Each local branch
below is checked out in D:\Codex\mdlxl-main-review-20261111-N, with N equal to
the contract number. Read the contract note in that branch's worktree for its
fail-first evidence, checks, and owner summary.

| Contract | Branch | Local revision | Owner summary |
| --- | --- | --- | --- |
| [1](review-1-fx-references.md) | codex/main-review-20261111-1 | d13fbf6f, A1/A2 | FX keeps pointing at the same surviving parts and its own clocks. |
| [2](review-2-save-safety.md) | codex/main-review-20261111-2 | 5c18a201, diff from d13fbf6f | An unreadable overwrite backs up the destination and keeps the tab unsaved. Cancel leaves extents alone. The other model writers report verification loss, and AI asks before combining after indexed list changes. |
| [3](review-3-settings-keys.md) | codex/main-review-20261111-3 | 49327893 | Settings protects keys and saved presets. The main lock badge and shortcuts follow the user's bindings. |
| [4](review-4-editors-previews.md) | codex/main-review-20261111-4 | 97cbbb58 | Animated vertex moves follow the mouse. UV, Corpse, Glow Up, axis guides and Forge fixes passed focused checks. |
| [5](review-5-paint-drags.md) | codex/main-review-20261111-5 | fa90a3cb | Brush drags update once per frame, Escape restores the original values, and Paint follows rebound mouse keys. |
| [6](review-6-housekeeping.md) | codex/main-review-20261111-6 | 143236bc, with this handoff at branch tip | The task index reflects merges. Flail01 passes. Flail03 stops at the known case that needs the missing reference. |
| [7](review-7-newest-five.md) | codex/main-review-20261111-7 | 5a600416 | BITZ, menu and panel positioning, translations, and the ShareX setting passed the focused checks. |

### Review notes

- A3–A5 stay queued behind claude/fx-editor. Contract 1 removed one existing FX
  sweep line because the shared clock deletion now does that remap. The current
  FX editor branch still needs that overlap reconciled when integrated.
- O2 and O7 were still open at this handoff. The release lane has the O5 wording
  handoff. The owner confirmed the original Flail03 reference is missing and
  asked to record the known result and proceed. The release kit records the
  missing reference.
- Integration touchpoints include App.jsx, AppDialogs.jsx, electron/main.cjs,
  PresetBar.jsx and the locale catalogs. Contract 2 already includes contract 1.
  Verify the overlapping workflows if the owner later asks to combine branches.
- The named hotkey-defaults audit still stops in its pre-existing Ctrl+F9
  assignment setup. The contract 3 note records the same stop on the base and
  the complete passing diagnostic run using the offered Replace button.
- This is the local review handoff. All work is saved on the owner's PC.
## Re-check after Claude’s verdicts

Verdicts were read at b5a14e18 on claude/main-review-2026-11-11. Review the
numbered rework only, using the previous tip in the table above as the base
for each diff. Branch 1 remains at its original tip and its re-run is
recorded here.

| Contract | Branch | Local revision | Source pass / fail / skip | Compatibility pass / fail / skip | New CI failures |
| --- | --- | --- | --- | --- | --- |
| 1 | codex/main-review-20261111-1 | d13fbf6f | 3280 / 0 / 10 | 57 / 0 / 0 | 0 |
| 2 | codex/main-review-20261111-2 | 426fdabe | 3307 / 0 / 10 | 57 / 0 / 0 | 0 |
| 3 | codex/main-review-20261111-3 | 47337d05 | 3278 / 0 / 10 | 57 / 0 / 0 | 0 |
| 4 | codex/main-review-20261111-4 | 684b568e | 3278 / 0 / 10 | 57 / 0 / 0 | 0 |
| 5 | codex/main-review-20261111-5 | 7961856b | 3276 / 0 / 10 | 57 / 0 / 0 | 0 |
| 6 | codex/main-review-20261111-6 | 73ffd802 plus this handoff | 3272 / 0 / 10 | 57 / 0 / 0 | 0 |
| 7 | codex/main-review-20261111-7 | 053ad9d0 | 3279 / 0 / 10 | 57 / 0 / 0 | 0 |

Each worktree built offline with the cached FFmpeg binaries before running
pnpm run test:source and pnpm test. The CI source reporter and baseline
checker found zero failing tests. The tracked baseline has zero entries.
The nine earlier particle-library failures in the verdict evidence were
missing dist/particle-runtime.mjs errors.

The ten skips on each branch are the Windows SIGTERM check, Windows
symlink permissions, the volume without 8.3 short names, optional archer,
skin-repair pair, Fx, twin-head rider and Tinker/Brown Magnataur inputs,
and two opt-in POSE corpus checks.

- O12 is implemented as the owner decided. The save notice preserves the
  last good destination when the copy fails and offers Save As elsewhere.
- Paint camera controls, Escape, and translations were rechecked. The BITZ
  tab close choices and ShareX PID across Vertices and UV were verified on
  the hidden test desktop. Contract notes record their named checks.
- FX Part B still waits on claude/fx-editor. O2 and O7 were still open at this re-check. The O5
  text is ready in six languages for the next release-branch update.
- Flail01 passed all 31 frozen comparisons. The release kit allows the known
  Flail03 mounted-spheres mismatch only while the historical file is missing.
- For later integration, branches 2, 3, 4, 5 and 7 add or retain locale
  entries. Preserve each key, catalog order and CRLF, then recount the
  expected sizes. The four UV preview strings match the release lane.

All revisions and notes are saved locally for Claude’s re-check.

## Combined branch for Claude’s final check

Branch `codex/main-review-20261111-all` in
`D:\Codex\mdlxl-main-review-20261111-all`. Combined merge tip `a2dedb93`.
The build and tests used `c4273a26`. The only change between those tips is
Claude’s verdict note at `1de45e9b`, merged after `9317b54f`.

Started from contract 2 (`426fdabe`, which includes contract 1), then used
merge commits for 6, 3, 4, 5 and 7 in that order, followed by Claude’s
documentation. Conflicts were confined to the five locale catalogs, their
size assertion and the task index. All incoming translations and CRLF
line endings were verified. French and German match the ordered union.
The index keeps contract 6’s table and Claude’s main-review row. The CI
baseline, UV test numbers and frozen flail comparisons were preserved.

### Combined checks

| Command or check | Result |
| --- | --- |
| `pnpm run build` | Passed, with Vite’s chunk-size warning |
| `pnpm run test:source` | 3,330 passed, 0 failed, 10 skipped, 0 cancelled |
| `pnpm test` | 57 passed, 0 failed, 0 skipped |
| `node .github/check-test-baseline.mjs out/combined/source.fails .github/known-test-failures.txt` | 3,340 passing reporter events including skips, 0 failing, 0 baseline entries, 0 new |
| `node --test test/localization-catalogs.test.js` | 6 passed, 0 failed, 0 skipped. Both order and CRLF guards passed unchanged. |
| Offline package using cached Electron 40.8.0 | Passed, with 1,510 runtime and asset files and 55 locale files verified |

The ten source skips were the Windows SIGTERM case, Windows symlink
permissions, this volume’s lack of 8.3 names, optional archer, skin-repair
pair, private Fx, twin-head rider and Tinker/Brown Magnataur inputs, and
two opt-in POSE corpus checks.

Ran `node scripts/run-packaged-tests.mjs default` with the comma-separated
harness names below, once per file on the hidden Windows test desktop.
**21 harnesses passed, 3 failed, 0 skipped.** Forge used
`MDLXL_TEST_FORGE_REBOUND=1` for the rebound Alt drag. Raw logs are in
`out/combined` and `out/suite/default` in the worktree.

| Contract | Passing `.electron.cjs` harnesses | Failing harnesses |
| --- | --- | --- |
| 1 | Part A uses source checks | FX Part B is deferred |
| 2 | `save-extents` (3 cases), `save-unreadable` (1), `library-copy-verification` (1) | |
| 3 | `review-settings` (7 scenarios), `hotkey-badges`, `shift-lock-badge` | `hotkey-defaults-audit` |
| 4 | `billboard-vertex-drag`, `glow-non-square`, `glow-detection` (2 workflows), `axis-guides-menu`, `fx-uv-click-threshold`, `uv-wrapper-isolation`, `forge-detail-editing`, `uv-preview-visibility` | `vertex-animated-preview` |
| 5 | `citadel-pro`, `paint-tab-camera`, `paint-image-navigation` | |
| 6 | The contract’s discard-cue comparison was a separate disposable probe | |
| 7 | `review-desktop` (7 cases), `bit-replacement`, `emtr-quick-options`, `manager-menu-hotkeys` | `review-bitz` (4 passed, 1 failed) |

- `hotkey-defaults-audit` stopped at the existing Ctrl+F9 setup, waiting
  for **Assign shortcut** before reaching **Default**. Contract 3 records
  the same stop on the base. The separate `review-settings` harness
  passed the Default confirmation workflow on the combined package.
- `vertex-animated-preview` failed at line 138. The harness read the
  vertex at +13.5 px right and +3.75 px down after requesting +18 px and
  +5 px in four steps. The read matches the third step exactly, and
  the wait accepts any nonzero translation. The final painted step
  and subsequent assertions were not verified in this run.
- `review-bitz` showed the Save warning on Exit. Its check for the
  original Footman’s disk checkpoint returned false. The installed
  Playwright treats the async predicate’s Promise as a successful poll,
  so the test can read before a checkpoint is present. The disk
  checkpoint and subsequent assertions remain unverified. The four
  other BITZ scenarios passed, including Commit and Discard on tab close.

### Owner summary

The seven reviewed fixes are together. The save check confirmed that
MDLxL keeps the last good file if it cannot make a safety copy and offers
Save As elsewhere. Claude’s final check should look at the animated
vertex and BITZ recovery failures and the known shortcut-audit stop.

O2 and O7 were still open at this combined handoff. See the 12 Nov decisions
above. FX Part B (A3–A5) waits on `claude/fx-editor`. The release kit
still records that Flail03’s mounted-spheres case needs the missing
historical reference. The O5 text is ready for the next authorized
update of the separate release branch.

Claude’s next step is review only, using this note and the
[fix verdicts](main-review-fix-verdicts.md). The branch is local.

## Follow-up on the three packaged test faults

Test revision `8b9130e5` on `codex/main-review-20261111-all`, from
`7bb44d28`. Fit’s audit chooses an unused shortcut from the live Hotkeys
table. The animated Move check waits up to five seconds for the requested
screen position. The BITZ recovery check polls from Node for up to ten
seconds for the fixture path. Only the three harnesses changed.

`node --check` passed for all three files. The prior disposable package
had been removed, so the unchanged combined app was rebuilt once offline
and the same package was used for every combined run. Each harness was
launched with `node test/<name>.electron.cjs` through `scripts/hidden-run.ps1`.

| Combined harness | Run 1 | Run 2 |
| --- | --- | --- |
| `hotkey-defaults-audit` | Passed, 33 windows/states and 748 catalog rows | Passed, 33 windows/states and 748 catalog rows |
| `vertex-animated-preview` | Failed at line 245, “release keeps the posed edit at component 0” | Unrun |
| `review-bitz` | Unrun | Unrun |

The vertex run passed the corrected Move check. It stopped in the
Rotate/Resize loop after mouse-up, when the displayed vertices were
compared with the last sampled preview. The log does not identify which
tool was active. The sequence stopped at that failure. No further test
or application changes were made.

### Old-code proof

The corrected harnesses were also run hidden against a separate offline
package of `4340c5f8`. Each exited 1 on the original behavior.

- Hotkeys passed the Fit rebind, then timed out waiting for **Restore all
  defaults** after choosing Default. The old app did not offer that
  confirmation.
- Animated Move still failed the original pointer assertion after the
  five-second wait. An 18 px right and 5 px down drag moved the vertex
  5 px right and 18 px up.
- The BITZ Exit scenario reported “Exit did not keep the replacement
  open for the Save warning.” It failed before reaching the checkpoint
  poll. The combined-package checkpoint remains unverified.

Logs are in `out/test-faults`. Claude’s handoff is review only. The
hotkey setup now passes twice, and the animated release failure is the
point to inspect next.

## Rotate and Resize harness recheck

Test revision `419a147b` on `codex/main-review-20261111-all`, from
`d029ece9`. The Rotate/Resize loop keeps its initial drag wait, then polls
for up to five seconds for two reads 50 ms apart with identical drawn
positions and drag payload. The second read supplies the comparison
before mouse-up. Failures identify the tool and first differing component
with both values, using the same 0.0002 tolerance.

`node --check test/vertex-animated-preview.electron.cjs` passed. The
previous disposable package had been removed, so the unchanged combined
app was packaged once offline from the same inputs. All four runs reused
that package and used `node test/<name>.electron.cjs` through
`scripts/hidden-run.ps1`.

| Hidden harness | Run 1 | Run 2 |
| --- | --- | --- |
| `vertex-animated-preview` | Passed, exit 0 | Passed, exit 0 |
| `review-bitz` | 5 passed, 0 failed, 0 skipped, exit 0 | 5 passed, 0 failed, 0 skipped, exit 0 |

Both vertex runs verified that Rotate and Resize keep the posed edit
on release and restore the frozen pose on Undo. Both BITZ runs verified
the original Footman’s disk checkpoint while the replacement draft was
open. The two earlier hotkey audit passes at `8b9130e5` still apply.

Only the vertex harness and this note changed. Logs are in
`out/vertex-recheck`. The combined branch is back with Claude for a local,
review-only final check.

## Main update and owner decisions, 12 November 2026

Local branch `codex/main-review-20261111-all` started at `7e3faedf`.
It merged the local `origin/main` at `f49889b9` (PR #627), then
`claude/main-review-2026-11-11` at `c188ad03`. Both were plain merges
with no conflicts. Merged app tip `84e3b068`. Test revision `7c255671`.

On the packaged SD Footman at frame 500, a real mouse drag in **Move**
on the selected **Elbow** or **Knee** aimed the bend around the fixed
hand or foot. The shoulder and hip stayed fixed. Settled preview and
committed measurements matched. Each gesture added exactly one undo
step, and Undo restored the entire model exactly.

| Move control | Hand/foot world displacement | Shoulder/hip world displacement | Bend world displacement | Screen movement toward drag |
| --- | ---: | ---: | ---: | ---: |
| Arm Elbow | 0.000000336 | <0.000000000001 | 5.9745 | 13.9941 px |
| Leg Knee | 0.000000526 | <0.000000000001 | 3.4783 | 5.9620 px |

The endpoint tolerance was 0.004 model units. The existing Rotate
checks passed at three camera views, including the pinned-foot case.
The POSE implementation, `swivelPoseLimb` and its source tests remain
as they were. O7 is approved as recorded in the owner table above.

### Checks on the merged branch

| Command or hidden harness | Result |
| --- | --- |
| `node --check test/pose-sd-controls.electron.cjs` | Passed |
| `pnpm run build` | Passed with Vite’s chunk-size warning |
| `pnpm run test:source` | 3,330 passed, 0 failed, 10 skipped |
| `pnpm test` | 57 passed, 0 failed, 0 skipped |
| `node .github/check-test-baseline.mjs out/main-20261112/source.fails .github/known-test-failures.txt` | 3,340 reporter passing events including skips, 0 failing, 0 baseline entries, 0 new |
| `pose-sd-controls.electron.cjs` | Once, 11 reported checks passed, exit 0 |
| `pose-ik.electron.cjs` | Once, 26 reported checks passed, exit 0 |
| `emtr-add-like-ribbons.electron.cjs` | Once with `MDLXL_PLACEMENT_REVIEW=1`, P1/P4/P5/P6 passed, exit 0 |
| `surface-effects.electron.cjs` | Once, the Tzeentch Knight check passed, exit 0 |

The first source run used an `MDLXL_TEMP` override and reported 14
failures in fixture-dependent tests and the default-temp assertion.
The rerun used the repository’s default `out/tmp` and passed without
code or baseline edits. The ten skips are the same optional input
and Windows-specific skips documented above.

The four harnesses used one offline package of `84e3b068` and the
hidden Windows test desktop. Packaging verified 1,510 runtime and
asset files and 55 locale files. The PR #627 checks came from the local
`D:\Codex\mdlxl-interactive-preview-pause-review.md` report. The original
SD Footman and Tzeentch Knight fixtures were available. Logs and
measurements are in `out/main-20261112`.

**For the owner.** To swivel a limb, select its Elbow or Knee control
and drag with Move. The hand or foot stays in place. Rotate still turns
the joint and honors a pin. O7’s three behaviors are approved as they are.

Claude’s next step is a local review only. FX Part B and the missing
historical Flail03 reference remain as recorded above.

## Local integration of `3dbf8f48`, 12 November 2026

The tested tip is `c1468723` on `codex/main-review-20261111-all` in
`D:\Codex\mdlxl-main-review-20261111-all`. From `36dbb578`, the first
plain merge brought in local `origin/main` at `3dbf8f48` as `ff9283fc`.
The second brought in Claude’s documentation-only `c3bcd96d` cleanly.
The commit after `c1468723` updates this handoff only.

The first merge had the eight expected file conflicts. The pointer-move
handler keeps main’s drag threshold for parts and the fix branch’s
`partSnap(event)`. The task index keeps both sets of rows. Each of the
five locale catalogs preserves every translation from both sides,
including all 44 incoming keys per language, with CRLF in the checkout
and the project’s catalog order. Recounted in ru/es/zh/fr/de order,
the sizes are **7,902 / 7,912 / 7,807 / 8,035 / 8,035**. The CI
failure baseline, locked UV tests and flail files match `36dbb578`.

| Check | Result |
| --- | --- |
| `pnpm run build` | Passed with Vite’s chunk-size warning |
| `pnpm run test:source` | 3,376 passed, 0 failed, 10 skipped |
| `pnpm test` | 57 passed, 0 failed, 0 skipped |
| CI reporter and `.github/check-test-baseline.mjs` | 3,386 passing events including skips, 0 failing, 0 baseline entries, 0 new |
| `vertex-animated-preview` | Passed, worst of ten hotkey switches 25 ms |
| `forge-detail-editing`, default and `MDLXL_TEST_FORGE_REBOUND=1` | Passed, 12 checks in each run |
| `billboard-vertex-drag` | Passed in normal and quad views |
| `review-settings` | 7 checks passed |
| `pose-sd-controls` | 11 checks passed |
| PR #630 Bevel hand-test replay | `forge-vertex` and `forge-shield` passed |
| PR #632 packaged checks | `event-sound-missing`, `event-sound-scroll`, `event-focus`, `manager-simplification` and `anim-xl` passed |

PR #628 lists source checks only. The three controller handle-shape
checks passed. For PR #630, the saved PR description lists the owner’s
Bevel hand-test and a skim of the other tools. The replay used the
existing Vertex Forge and shield harnesses.

All 13 packaged runs used the same offline build of `c1468723` on the
hidden desktop, once each, with 0 failures and 0 skips. The ten source
skips were the same seven optional fixture/corpus checks and three
platform checks (SIGTERM, symlink privilege and 8.3 short paths).
Logs are in `out/main-3dbf8f48`. The temporary package and profiles were
removed. Verification covered the named checks only.

Claude can continue the review from the local branch. Main, the remote
and releases were left alone.
