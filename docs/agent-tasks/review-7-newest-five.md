# Contract 7: fixes for the five PRs merged on 11 November (#622 to #626)

Status: reworked and ready for Claude re-check.
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


## Codex handoff

Code and tests at 6dec5dc5 on local branch codex/main-review-20261111-7, from 4340c5f8.
Contract 2 shares App.jsx and AppDialogs.jsx in its save paths. Review the two
patches together when integrating them.

- H1. The original model tab stays reachable during replacement. Its close prompt
  asks whether to discard the draft or keep editing. Window close warns about
  the replacement, and choosing Save keeps the draft open and asks for Commit or
  Discard first. The underlying model continues to receive its existing recovery
  checkpoint, including when a draft starts on a clean model. Commit puts the
  replacement into that model's history and recovery.
- H2 and H7. A Bit with multiple looks exposes its RGB list before staging in
  either click order. A one-look Bit keeps the direct path. Quad View RGB is
  scoped to selected incoming Bit geosets and preserves animated color tracks.
- H8. Moving an individual Bit is refused with a message if the destination
  would lose or change any nearby texture it uses. Move its containing folder
  in that case. The existing TextureResolver handles both relative texture
  paths and its basename lookup.
- H3, H5, H6 and O11. Windows menu height applies to movable titles and the
  three fixed panels. Node Manager starts with hierarchy and Bone when opened
  from Emitter Manager. VIS uses the shared classic menu surface and Tahoma.
- H4. Audited the added UI strings and dynamic labels in #622, #625 and #626,
  including native sound categories, prompts and errors. Added 54 entries to
  each of Russian, Spanish, Simplified Chinese, French and German, including
  the wording introduced by this contract. The catalog source scan covers the
  owning UI and desktop files and the composed labels.
- H9 and O8. Vite writes helper compiler output under the worktree's out folder
  and warns when csc.exe is unavailable. Packaging still requires the helper.
  ShareX regions is off by default and starts and stops from Settings > Capture.

### Checks actually run

- At 4340c5f8, new BITZ/RGB/move/capture/model-close source checks gave 11 pass,
  5 fail, 0 skip in bits-and-parts.test.js, model-close.test.js and
  capture-regions.test.js. The animated Color became a static value, Move lost
  the sibling texture, the preference was undefined, the missing compiler
  aborted the build plugin, and a clean tab with a replacement did not require
  a close decision. The localization scan gave 2 pass, 1 fail, 0 skip before
  catalog additions.
- The two new hidden packaged harnesses reproduced ten failures at 4340c5f8:
  the original BITZ tab could not be closed, Exit lost the moved draft without
  a warning, the multi-look chooser was skipped, the Node Manager title went
  under the menu, Node Manager did not open from Emitter Manager, Add-ons opened
  at 64 instead of 89 px, POSE setup and Curve Properties each opened at 118
  instead of 143 px, the ShareX process started by default, and VIS retained a
  10 px popup radius.
- At 6dec5dc5, node --test on test/{bits-and-parts,model-close,capture-regions,localization-ui-gaps,localization-catalogs,bit-replacement,toolbar-modes,vis-mdlvis-mode,compact-toolbar,desktop-bridge,game-file-library,particle-reentry}.test.js
  gave 100 pass, 0 fail, 0 skip. Includes a loose texture refusal and a permitted
  move when the destination provides identical texture bytes.
- At 6dec5dc5, node --test --test-concurrency=1 test/review-bitz.electron.cjs
  test/review-desktop.electron.cjs on the hidden Windows desktop gave 10 pass,
  0 fail, 0 skip. This exercised the original model's disk checkpoint during
  a draft, the save guard with unchanged input bytes, both RGB click orders,
  repeat dragging in both looks, manager reset, all three fixed panels,
  the ShareX child lifecycle including restart, and the classic VIS popup.
  Reused 3 pass, 0 fail, 0 skip from the existing bit-replacement,
  emtr-quick-options and manager-menu-hotkeys packaged harnesses, run against
  the same renderer before the final preload-only close-state correction.
- Vite build and local packaging passed. Package verification covered 1,510
  runtime and asset files and 55 locale files. A separate Vite build with
  WINDIR set to an empty path on D: passed with the csc.exe warning and
  produced no capture-regions.exe. git diff --check passed.
- Remaining verification: forced process termination and recovery restart,
  remembered window position after reopening, ShareX's own region picker,
  a live installation with the helper binary missing, and Warcraft III
  playback. The full packaged VIS matrix was outside the focused checks.

### Owner summary

BITZ warns before closing with an unfinished replacement, keeps your model's
recovery copy running, and applies the selected Bit color in either click order.
It keeps the original model's colors and stops a move that would leave a texture
behind. The Windows menu no longer covers tool titles, and VIS has the classic
menu again. Node Manager opens in its normal state, the reviewed controls have
translations, and ShareX sharing starts only when you turn it on in Capture.

Saved on your PC, not online. Ready for Claude review.

## Rework after Claude’s review

- Implementation revision 9e348665. Only the replacement’s own tab offers Commit, Discard replacement, and Cancel with the existing close-prompt hotkeys. Commit continues through the normal save prompt for the edited tab. Discard resumes the ordinary close flow. Another tab can close while the draft stays open.
- ShareX uses the shared Settings Toggle and keeps the same helper on editor switches. UV sends empty region coordinates. Disabling the switch ends the helper. The capture defaults test now includes the off setting.
- The localization test extracts JSX text, title, aria-label and placeholder strings from BITZ, Part RGB, Library Save Copy and the EMTR menu. It checks future literals with a small name allowlist. All five catalogs include the missing dialog titles and the older labels exposed by the new scan.
- pnpm run test:source: 3,279 passed, 0 failed, 10 skipped. CI reporter: 3,289 passing events including skips, 0 failures, 0 new failures. pnpm test: 57 passed, 0 failed, 0 skipped. Focused capture and localization checks: 20 passed. The baseline file is unchanged.
- Hidden node --test --test-concurrency=1 test/review-bitz.electron.cjs test/review-desktop.electron.cjs: 11 passed; the initial ShareX locator expected the old checkbox label. After switching to the shared Toggle and selecting vertices before opening UV, node --test --test-name-pattern=ShareX test/review-desktop.electron.cjs passed its one scenario. It observed empty regions in UV and the same helper PID after returning to Vertices. BITZ tests closed an unrelated tab, saved a committed replacement before closing, and verified a discarded replacement left the file bytes intact.
- Owner summary: the BITZ draft only interrupts closing the tab it belongs to. ShareX keeps running as you switch editors and stops when you turn it off.
