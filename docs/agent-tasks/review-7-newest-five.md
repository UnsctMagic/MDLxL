# Contract 7: fixes for the five PRs merged on 11 November (#622 to #626)

Status: ready for Codex
Owner / consolidator: Codex (fix), Claude Code (contract and review)
Updated: 2026-11-11

Findings H1 to H9 and owner decisions O8 and O11 of the
[main review](main-review-2026-11-11.md). Read its "Rules for
every contract" first. Map rows: "Forge, Collect Bit, BitsAndParts", "Main window look",
"Localisation, labels and tooltips", "Packaging and updates".

## Goal and completion criteria

1. **H1. A BITZ Replace Part draft is never lost quietly** (`app/App.jsx`, PR #625).
   While a replacement draft is open (`bitReplacement`):
   - closing the window, or a model tab, asks the user to commit or discard the
     replacement first (use the existing close prompt and wording style; no new dialog
     type), also when the model itself has no other unsaved change;
   - "Save" from the close prompt never saves the model without telling the user the
     replacement is not in it;
   - a crash or forced close leaves something to recover: either the draft is part of
     the recovery checkpoint, or the underlying model's checkpoint keeps running while
     the draft is open. Say which in this note.
2. **H2. Replace Part keeps the RGB look choice** (`app/BitsAndParts.jsx`, PR #625).
   With Replace Part on, the look list (`PartRgb`) is shown as it was before #625 and
   the Bit is staged with the look currently chosen. Clicking the Bit first or Replace
   Part first gives the same result.
3. **H3. Tool windows cannot be dragged under the Windows menu bar**
   (`app/useMovableWindow.js`, PR #623). The lowest allowed top edge is the menu bar's
   height (`--desktop-menu-height`, 0 where there is no drawn menu). A window already
   remembered at a position under the bar is brought back into reach when shown.
   Covers every user of `useMovableWindow`, in both looks.
4. **H4. Translations.** Every visible string added by #622, #625 and #626 is in all
   five catalogs (`src/locales/{ru,es,zh,fr,de}.json`), including tooltips, error
   messages and the sound folder names sent from `electron/game-file-library.cjs`.
   Lists found: BITZ "Manage", "New folder", "Create folder", "Save name", "Move here",
   "Move to Recycle Bin", "Custom RGB", "Replacement RGB", "Choose a Bit to replace the
   selection.", both RGB tooltips; Library "Material and Texture Library. Right-click to
   choose a section.", "Texture save format", the two World Editor Style titles,
   "Campaign dialogue", "Music", "Combat", "Other sounds", "Saved "; EMTR "EMTR Library",
   "Emitter Manager", "New emitter type:", "No emitters.", "Search emitters",
   "Emitters list", "Emitter Editor. Right-click for Glow Up, EMTR Library, and Manager.".
   Search the three PRs for more; do not trust the lists as complete. Extend the source
   scan in `test/localization-ui-gaps.test.js` to the new files so this fails next time.
5. **H5. Node Manager opened while the Emitter Manager is open** (`app/AppDialogs.jsx`,
   PR #622) starts in its normal state: "Show hierarchy" ticked, new node type Bone.
6. **H6. Fixed panels sit below the menu bar** (PR #623): Movement "Curve Properties"
   (`app/movement.css`), POSE setup (`app/pose-controls.css`) and the Add-ons panel
   (`app/addons.css`) add `var(--desktop-menu-height, 0px)` to their `top`, as #623
   did for Forge's Add menu. Check in the packaged app first; look for other
   `position: fixed` panels with a pixel `top` and fix every one.
7. **H7. Replace Part RGB boxes touch only the Bit** (`src/bits-and-parts.js`
   `setPartRgbChannel`, PR #625): they apply to the staged Bit's own geosets and never
   replace an animated colour track on the model's own geosets.
8. **H8. Moving a Bit keeps it usable** (`electron/bits-and-parts.cjs`, PR #625): a Bit
   whose loose textures sit beside it is moved together with those textures, or the
   move is refused with a plain message. The user's Bits folder is otherwise never
   rewritten.
9. **H9. Build does not depend on C: or on a compiler being present** (`vite.config.js`,
   PR #624): compile the helper into a folder under `out/` (D: on the owner's PC), and
   when `csc.exe` is missing skip it with a warning so `pnpm run build` still works;
   packaging keeps its hard check.

10. **O8, decided by the owner on 11 Nov: the ShareX helper is a setting, off by
    default** (PR #624). One switch in Settings > Capture, stored with the other capture
    settings (`src/capture-settings.js`; a new field, no renamed key). Suggested label
    "ShareX regions" with a tooltip saying, in plain words, that it lets ShareX find the
    viewport and toolbox as capture regions and runs a small helper program while an
    editor is open. Label and tooltip in all five catalogs. While it is off,
    `capture-regions.exe` is never started and no edges are sent; switching it off
    while it runs stops the helper; switching it on starts it without a restart. A
    missing helper file only greys nothing and logs a warning, as today. #624 is not
    released, so no user's behaviour changes except the owner's own PC, where the
    switch has to be turned on once.
11. **O11, decided by the owner on 11 Nov: classic menu in VIS** (PR #623). With VIS on
    (`[data-vis-ui]`), the drawn Windows menu looks like the classic menu: reuse the
    existing `.classic-menu` look from `app/styles.css` (square, classic colours and
    font, no rounded popups or soft shadows). The new look is unchanged. Read the
    [VIS contract](vis-mdlvis-mode.md) first and confirm the current look in the
    packaged app before changing CSS.

Decided with no work here: O9 (texture pickers keep opening in Standard) and O10 (Alt+K
stays on Surface Effects; its condition is [contract 3](review-3-settings-keys.md) item 4).

Out of scope: BITZ layout, the Library layout, the menu contents, new settings.

## Revision and local state

- Base: local `claude/main-review-2026-11-11` (`main` at `a8a4ca86`).
- Overlap: contract 2 edits `save` in `app/App.jsx` and `saveAsFormat` in
  `app/AppDialogs.jsx`; this contract edits other functions of the same files.
  Whoever merges second rebases.

## Findings and decisions

- H1, read at `a8a4ca86`: the draft is its own session that is never added to
  `sessions`; `hasAnyUnsavedWork = sessions.some(sessionDirty)`; the checkpoint effect
  starts with `if (bitReplacement) return;`; the before-close flush gets only `sessions`.
- H2, read: `choose` stages with `partRgbOptions(source)[0]` ("No RGB" when a Bit has
  two or more looks) and `PartRgb` is rendered only when not replacing.
- H3, read: `clamp` uses `top: Math.max(0, …)` with `position: fixed`; the menu bar is
  25 px at `z-index: 10100`, above every overlay; the VIS title bar is 23 px.
- H4: script `D:\Claude\MDLxL-QA\2026-11-11-main-review\desktop-library\locale-check.mjs`
  and a grep of the EMTR strings in all five catalogs.
- H6 and the VIS menu look (item 11) were not seen in the app; confirm there before
  changing CSS.
- Checked and fine in these PRs: the ShareX helper writes no files, opens no network
  connection and reads no other program's data; it exits with MDLxL; Library "Save a
  copy" writes only where the user's Save dialog points; BITZ Manage cannot escape the
  Bits folder and deletes to the Recycle Bin; no line of any of the five PRs was lost
  to a later merge; no IPC channel is registered twice.

## Changes and verification

Tests to add first (each must fail on the base):

- H1: `test/bit-replacement.electron.cjs`: clean Footman, start a replacement, move the
  Bit with the real mouse, close the window: a prompt appears. Same with the tab close.
- H2: same file: Replace Part on, click a Bit with several looks, pick a look; the draft
  geosets carry that colour. Reverse click order gives the same.
- H3: `test/manager-menu-hotkeys.electron.cjs`: real drag of a Node Manager title bar to
  the top of the screen; the header stays below `.desktop-menu` and can be dragged again.
- H4: the extended scan in `test/localization-ui-gaps.test.js`, plus
  `test/localization-catalogs.test.js`.
- H5: `test/emtr-quick-options.electron.cjs`: open Manager from the EMTR menu, then
  Managers > Node Manager; "Show hierarchy" is ticked.
- H7: `test/bits-and-parts.test.js`: a geoset with animated Color keeps its track.
- H8: a bits-and-parts test that moves a Bit with a sibling BLP and resolves its textures.
- Item 10: a source test that `useCaptureRegions` is not enabled under default
  preferences; a packaged test that no `capture-regions.exe` child process exists with
  the switch off, one exists after a real click on the switch with an editor visible,
  and none after switching it off again.
- Item 11: extend `test/vis-mdlvis-mode.electron.cjs`: in VIS the drawn menu popup's
  computed border radius, shadow and font match the classic menu; in the new look they
  are unchanged.

Run those plus `test/bit-replacement.test.js`, `test/toolbar-modes.test.js`,
`test/vis-mdlvis-mode.test.js`, `test/desktop-bridge.test.js`.

## Blockers and next action

- None. On completion: status, revision and checks here; plain summary for
  the owner; hand back.
