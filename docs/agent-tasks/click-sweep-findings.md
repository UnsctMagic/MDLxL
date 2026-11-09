# Click sweep: check the controls flagged as doing nothing

Status: active, ready for Codex
Owner / consolidator: Codex (sweep built by Claude Code)
Updated: 2026-11-09

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

- Branch: local `claude/qa-release-kit`. Continue it; it is not pushed. Base your
  worktree on it (`D:\Codex\<task>`).
- Checked revision: `d9c43957`, built from `main` at `5310d5fb` plus the kit. Main has moved
  three commits since.
- Sweep results (ignored files, in the Claude worktree):
  `D:\Claude\MDLxL\.claude\worktrees\qa-release-kit\out\click-sweep-footman\` is the
  corrected script. `...\out\click-sweep\` is an earlier version of the script, so treat
  its Could-not-be-closed lists as unreliable.
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

### Expected, confirm only if something looks off

Fit model and Fit selection (already fitted); BitsAndParts > Refresh (nothing new) and Open
folder (blocked by the sweep); File > Open, Choose Warcraft III folder and Showcase > Load
Showcase model (file dialogs cancelled by the sweep); Undo, Redo and Clear selection (nothing to
act on); Keyframes > Copy, Copy Frame, Paste, Delete and Clear (no keys selected); Toolbar >
Graphic, Language > English and Modules > Vertex editor (already on). The seven Managers
entries under Could not be closed are full pages, left by choosing another mode.

Not found in these runs: clipped text or untranslated labels. German is the only language run
so far.

## Changes and verification

- Changed: nothing in the app. The sweep and kit are committed on the branch.
- Remaining: this check. Sweeps of the remaining setups have not been run.

## Blockers and next action

- No blockers. Work through table rows 1 to 9, then the two lists after it.
- Rerun only what is affected:
  `$env:MDLXL_SWEEP_SETUPS='footman'; node scripts/run-packaged-tests.mjs default click-sweep`,
  or the focused tests for the fix.
- Finish with a plain-language summary for the owner, who is not a programmer. Report
  `saved on your PC, not online`.
- On completion: mark this note completed with the result and revision, and remove its
  table entry from the [task index](README.md).
