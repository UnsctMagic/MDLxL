# Click sweep: check the controls flagged as doing nothing

Status: completed — merged in PR #657 (ca7293b8); owner chose to hide/grey all three controls
Owner / consolidator: Claude Code (sweep built by Claude Code)
Updated: 2026-11-16

## Goal and completion criteria

- Decide, for every item under "Check these", whether it is a real fault or correct
  behaviour, and record the answer with its evidence in this note.
- Fix confirmed faults following
  [section 5 of the kit](../QA-AND-RELEASE-KIT.md#5-repairing-failures). Each fix needs a
  real-input test that fails without it. Fix every instance of the same fault.
- Where the right behaviour is a product choice (for example, should this button be
  greyed out or do something?), do not choose. List it for the owner in plain language.
- Exclusions: no new panels, limits or features. Do not run the full packaged suite;
  this is not a release. Nothing goes online until the owner says "merge".

## Revision and local state

- Branch: `claude/click-sweep-fixes` in `.claude\worktrees\click-sweep`, from `main` at
  `a7c5ed17`. Local only.
- First sweep: `d9c43957`, built from `main` at `5310d5fb` plus the kit. Recheck (15 Nov):
  `main` at `a7c5ed17`, `dist/` built in the worktree and run with the development Electron
  on the hidden desktop. Probes: `out/qa/2026-11-15/probe.cjs` in that worktree (real
  clicks and keys; probes only read).
- Sweep results, kept outside Git: `D:\Claude\MDLxL-QA\2026-11-09-click-sweep\footman\`
  is the corrected script. `...\earlier-script\` is an earlier version of the script, so
  treat its Could-not-be-closed lists as unreliable.
- Package: removed after the runs. Build it again as in
  [kit section 2](../QA-AND-RELEASE-KIT.md#2-setup).

## Relevant owners

- Script and how to read its report:
  [test/click-sweep.electron.cjs](../../test/click-sweep.electron.cjs),
  [the kit](../QA-AND-RELEASE-KIT.md#the-click-sweep-script).
- Menu: [electron/menu.cjs](../../electron/menu.cjs); commands in
  [app/App.jsx](../../app/App.jsx); toolbar in [app/AppToolbar.jsx](../../app/AppToolbar.jsx).
- Auto Corpse: [app/AutoCorpse.jsx](../../app/AutoCorpse.jsx).
- Others: use the matching row of the [project map](../agent-map.md).

## Findings and decisions

Verified, all on the packaged app, hidden desktop:

| Setup | Clicked | Crashes | Freezes | Failed Undo | Minutes |
| --- | --- | --- | --- | --- | --- |
| footman (corrected script) | 830 | 0 | 0 | 0 | 36 |
| baseline (earlier script) | 669 | 0 | 0 | 0 | 30, time limit |
| no-model (earlier script) | 496 | 0 | 0 | 0 | 23 |
| lang-de (earlier script) | 579 | 0 | 0 | 0 | 30, time limit |

"Dead" means the screen, model, selection, messages and the 3D picture were all unchanged one
click later. **It does not mean broken.** No item below has been confirmed as a bug.

### Check these (unexplained)

For each: reproduce with a real click, on Footman unless the setup says otherwise.

| # | Control | Setup | Question |
| --- | --- | --- | --- |
| 1 | Menu > Settings > Toolbar > **Trim** | footman, no-model | Starting from Graphic this should change the toolbar. Does it? Graphic before it is expected. Could the sweep's order hide the change? |
| 2 | Bones > **Connected Bones** | all | Clicked with nothing selected. Does it work with a bone selected? Should it be greyed with none? |
| 3 | Animations > Adjust All Speed > **Include Stand Defend in Master Controller** | footman | A checkbox with no visible change. Does it take effect when applied? |
| 4 | Showcase > Add animation > **SPLxHBS0, SPLxHBS1, SPNxHBF0** | footman | Other entries reacted. Why not these three? |
| 5 | Texture Manager button with hotkey **Shift+F7** (Shift+F5 / Shift+F8 in other runs) | footman, baseline, lang-de | The key differs per run because the sweep reached different tabs. Which button is it, and what should it do? |
| 6 | Node Manager > **Expand all / Collapse all** | footman, baseline, no-model, lang-de | Does this work on a model with nested nodes? |
| 7 | Auto Corpse > **+ Skull, + Ribs, + Bone, + Hand** | demo and no-model only; they work on Footman | Should they be greyed out when they cannot add anything? |
| 8 | Menu > Shape > **Bend, Warp, Dome, Wrap, Taper**; Menu > Edit > **Select all, Copy, Paste**; File > **Save**; toolbar **Save** | no-model | Enabled with nothing to act on. Should they be greyed out? |
| 9 | Movement > **Controller** dropdown area ("Mixed / unset, Non-Interp, Linear, Bezier, Hermite") | lang-de | Flagged in German only. Is it a real difference? |

Also look at:

- **Could not be checked (preview was moving):** Surface Effects > Frame the selected part;
  Movement > Portrait settings > Idle; Settings hotkey rows for Next sequence (assign, restore)
  and Apply Move Speed (assign).
- **Sweep lost its place:** Showcase > Save preset, Load preset and Edit preset, then
  Recording set. The script clicked the first level but could not rebuild the window. Test
  them by hand. If the sweep can be taught to reach them, do that.

### Answers (15 Nov, `main` at `a7c5ed17`)

Each was reproduced with real clicks on Footman unless stated. Probe output is in
`out/qa/2026-11-15/*.log` in the worktree.

| # | Verdict | Evidence |
| --- | --- | --- |
| 1 | Works. Sweep blind spot | Menu Trim shrinks the toolbar from 56 to 32 px and ticks Trim, with and without a model. The change is a `data-toolbar` attribute and sizes only, which the sweep's fingerprint did not read. Taught (below) |
| 2 | Works. Owner chose to hide it when empty | The heading folds and unfolds the section. In Bones it is empty until vertices are selected: after Ctrl+A in Vertices it lists 19 bones and clicking Box04 selects it. Folding an empty section changes no text, so the sweep missed it. Taught (below) |
| 3 | Works | Unticking Stand Defend records "Select animation for Master Controller". With Master Controller at 50%, every other animation doubles in length and Stand Defend keeps its 1000 ms. All 8 boxes toggle when clicked at the sweep's own pace. Not flagged in the 15 Nov sweep |
| 4 | Works. Sweep misclick | By hand each box unticks and the heading counts "1 off", "2 off", "3 off". The sweep still flags them, and its screenshot shows the Emitters section folded after the "dead" click: it hit the heading because the position it read was stale. The sweep now re-reads the position just before clicking |
| 5 | Gone | The button was in the full-page Managers workspace, removed in `252f4980` (11 Nov). The name changed per run because the sweep named controls by their "Hotkey: …" tooltip, and keys are given out in order. The sweep now names controls without their hotkey. The popup managers have no button whose only name is a hotkey |
| 6 | Works. Owner chose to grey them with hierarchy off | Object Manager on Footman: Collapse all 57 → 12 rows, Expand all → 57. Expand all with nothing folded does nothing (like Fit when fitted). With Show hierarchy off the list is flat and both buttons do nothing |
| 7 | Owner chose to grey them out | With no model, CORP is now greyed out (`e41542f2`). On the demo model, which has no Death animation, the window says "Auto Corpse needs a Death animation." but + Skull, + Ribs, + Bone and + Hand stay clickable and do nothing (`add` returns when there is no corpse) |
| 8 | Fixed already | Since `e41542f2` (15 Nov) these are greyed with no model: menu Save, Save as, Select all, Clear selection, Copy, Paste, Paste special, Bend to Taper, Auto Corpse, and the toolbar Save |
| 9 | Works. Not a real difference | The heading holds the word and the Controller dropdown. In German the longer "Gemischt / ungesetzt" widens the dropdown, so the centre of the heading lands on it (left edge 1280 < centre 1297). A click there does not fold the section, by design. The dropdown is greyed until something is selected. Clicking the word folds the section in both languages |

Could not be checked (preview moving), checked by hand:

- Surface Effects > Fit selection ("Frame the selected part."): after a real drag and zoom the
  camera was at (-77.7, -96.7, 224.4); Fit selection put it back at (126.7, -164.3, 147.7). Works.
- Movement > Portrait settings > Idle: Footman has no Portrait animation, so Idle picks Stand - 1,
  which is already showing. After choosing Walk, Idle switches back to Stand - 1. Works.
- Hotkey rows Next sequence and Apply Move Speed: Add shortcut opens the recorder with focus in
  the key box. Reset does nothing while the keys are already the defaults. Works.

Sweep lost its place:

- Showcase Save, Load and Edit preset are disabled for about 1.25 s after entering Showcase
  (they wait for the preview). The sweep waited 350 ms. It now waits up to 5 s for a control.
  The 15 Nov sweep reached all three and their Recording set. By hand, Recording set switches
  the preset type in all three dialogs, and Esc closes them.

New in the 15 Nov sweep:

- **Fault, fixed:** in Showcase, every Manager edit failed Undo (44 rows: New, Clone, Remove and
  every flag tick in the Material, Texture, Object, Geoset, Sequence, Texture Animation and Global
  Sequence Managers). Ctrl+Z and the Manager's own "Undo manager edit" button both went to
  Showcase's settings history (`undo` in `app/App.jsx`, from `d771c94c`, 8 Oct), which predates
  Managers opening over Showcase. Manager Undo/Redo now undo the model. Showcase's own Ctrl+Z,
  outside a Manager, is unchanged. Test: `test/showcase-manager-undo.electron.cjs` (fails on
  `a7c5ed17` with 4 !== 3, passes with the fix).
- Edit preset > OK: the sweep lost its place because OK enters preset editing ("Editing
  preset: Classic · title above"), which swaps Save, Load and Edit for Update preset and Done.
  Not an app fault.
- Material Manager > Add layer and Geoset Manager > Selected mesh operations showed as dead:
  both sat below the visible part of the scrolling pane, and the sweep clicked the pane. After
  scrolling to them with the mouse wheel, Add layer adds a layer (Ctrl+Z removes it) and the
  heading folds its section. The sweep now counts such controls as covered instead.
- Eleven Showcase buttons (Add, Collapse, Center and others) showed as unverified in one run:
  the whole sidebar is a disabled fieldset while Showcase is busy, which `.disabled` on a
  button does not report. The sweep now skips controls that match `:disabled`.

### Expected, confirm only if something looks off

Fit model and Fit selection (already fitted); BitsAndParts > Refresh (nothing new) and Open
folder (blocked by the sweep); File > Open, Choose Warcraft III folder and Showcase > Load
Showcase model (file dialogs cancelled by the sweep); Undo, Redo and Clear selection (nothing to
act on); Keyframes > Copy, Copy Frame, Paste, Delete and Clear (no keys selected); Toolbar >
Graphic, Language > English and Modules > Vertex editor (already on). The seven Managers
entries under Could not be closed are full pages, left by choosing another mode.

Not found in these runs: clipped text or untranslated labels. German is the only language run
so far.

## Owner choices (answered 15 Nov: "Yes, all three")

1. Bones: "Connected Bones" now hides when no selected vertices are bound, using Movement's
   rule (`boundBoneIds.length > 0` in `app/App.jsx`).
2. Object Manager: "Expand all" and "Collapse all" are greyed out while "Show hierarchy" is off
   (`app/ResourceEditors.jsx`).
3. Auto Corpse: "+ Skull", "+ Ribs", "+ Bone" and "+ Hand" are greyed out when no corpse can be
   fitted, such as with no Death animation; the "needs a Death animation" message stays
   (`app/AutoCorpse.jsx`).

Small polish, tested by the owner by hand. Clicked hidden in the packaged build: Bones shows no
panel with nothing selected, and after Ctrl+A in Vertices it lists 19 bones and Box04 selects;
hierarchy on: Collapse all 57 → 12, Expand all → 57; hierarchy off: both greyed, and they work
again when it is back on; demo model: all four + buttons greyed with the message; Footman: all
four on, and + Skull clicks without errors.

## Changes and verification

- App: Manager Undo/Redo in Showcase undo the model (`app/App.jsx`, `app/AppDialogs.jsx`).
  New test `showcase-manager-undo` (registered in `scripts/run-packaged-tests.mjs`).
- Sweep (`test/click-sweep.electron.cjs`): waits up to 5 s for a control on the way back to a
  window; sees folded sections and the app's `data-` look switches; names controls without
  their hotkey; re-reads a control's position just before clicking; skips controls disabled
  through their fieldset and controls scrolled out of their pane; saves a screenshot for
  each dead control; `MDLXL_SWEEP_STARTS` rechecks one area; default limit 90 minutes. Kit
  updated.
- Checks run (15 Nov, hidden desktop): probes for every item above; full `footman` sweep
  with the taught script on the unfixed app (0 crashes, freezes, failed Undo or stuck; hit the
  40-minute limit, menus not reached); `showcase` start point only: before the fix 44 failed
  Undo; after the fix and the sweep corrections 421 clicked, 0 crashes, freezes, failed Undo,
  stuck or unverified, 3 dead, all expected (Load Showcase model and Save MDX: file dialogs the
  sweep cancels; Object Manager Expand all: nothing folded); focused app tests on `out/pkg`:
  `showcase-manager-undo`, `showcase-actions`, `model-manager-regressions`,
  `node-manager-add` pass. `showcase` and `manager-menu-hotkeys` fail on unchanged
  `a7c5ed17` as well: `manager-menu-hotkeys` clicks Material Manager in the browser build
  without a model, which `e41542f2` greys out; `showcase` fails at a video or clock step.
  Neither is caused by this change. `node --test tests/*.test.js` 57/57; focused source tests
  (showcase, showcase-history, model-manager, manager-simplification, desktop-settings,
  hotkey-defaults) 55/55.
- Not run: the full packaged suite (not a release); a full `footman` sweep that reaches the
  menus (needs the new 90-minute limit, about an hour).

## Blockers and next action

- No blockers. The three owner choices are done.
- Two existing test failures above belong to `e41542f2` (no-model start) and the Showcase
  video/clock step. They are not tracked by this note.
- After the owner says "merge": mark this note completed with the merge revision and remove
  its row from the [task index](README.md).
