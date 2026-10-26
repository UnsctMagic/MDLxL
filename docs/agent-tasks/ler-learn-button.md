# LER button: Learn menu

Status: active (contract for Codex)
Owner / consolidator: Codex; written by Claude Code
Updated: 2026-10-26

## Goal and completion criteria

The owner's request (2026-10-26): clicking **LER** no longer just switches
reminders on or off. It opens a small, elegant box with three choices:

1. **Learn mode** (on/off). This is today's Shredder, renamed: clicking a
   button that has a key shows that key ([behaviour contract](../SHREDDER.md)).
2. **Show hotkeys** (on/off). Keeps the green key letters on every button
   visible until switched off. Today they only show while a key is held.
3. **Learn settings…**. Opens Settings → Keyboard Shortcuts straight at the
   Learn block (today's "Shortcut reminders" block).

Done means:

- **Box.** LER opens a small box anchored under the LER icon. It has the look
  of the toolbar's icon dock ([TOOLBAR-DOCK.md](../TOOLBAR-DOCK.md)): the same
  dark WC3 feel, the dock's bold Oxanium label font, LER's lemon `#f2e35c` as
  its accent, theme variables, no new game look. Three rows, nothing else: no
  heading, no help text, no icons beyond what the rows need. The two on/off
  rows show their state with a tick or a lit label. *"The style of the icon
  menu" is read as "the style of the icon dock"; ask the owner if the first
  screenshot misses.*
- **Behaviour.** Reuse the existing small anchored popups (for example
  Movement's Create menu, `bone-create-anchor` in
  [MovementControllerRecomp.jsx](../../app/MovementControllerRecomp.jsx)):
  click outside or Esc closes it, clicking LER again closes it. Choosing an
  on/off row switches it and keeps the box open so both can be set; choosing
  **Learn settings…** closes the box and opens Settings. The rows get keys from
  the existing name allocator like every other control; no hand-made keys.
- **LER icon state.** The label glows (existing switched-on look) while Learn
  mode is on, as now. Ctrl+J still switches Learn mode without opening the box.
- **Show hotkeys.** Uses the exact display the held key uses today
  (`data-shortcut-hints` in [Hotkeys.jsx](../../app/Hotkeys.jsx) and
  [settings.css](../../app/settings.css)), including which buttons count as
  available in the active window or dialog. While switched on it must follow
  focus, opened and closed dialogs and detached windows (recompute what the
  held-key path computes once on keydown). Holding the key while it is on
  changes nothing; releasing the key does not hide the letters. It is saved as
  a preference and survives a restart. Off by default. The held-key behaviour
  stays exactly as it is when this is off.
  *Note:* the code reveals the letters while **Alt** is held (Shift doesn't
  matter); the owner described it as Alt+Shift. Don't change the hold key.
- **Rename Shredder to Learn**, everywhere a user can see it and in the code:
  - Words: menu item, command name, tooltip, Settings heading, docs, the three
    translations (recount catalog sizes in
    [localization-catalogs.test.js](../../test/localization-catalogs.test.js)).
    "Shortcut reminders" becomes "Learn mode"; the settings block is "Learn".
  - Code: `src/shredder-keycaps.js`, `app/Shredder.jsx`, `app/shredder.css`,
    tests, the `shredder` command id and `preferences.shredder` become
    `learn` names. `SHREDDER_TEST_VERSION` becomes `LEARN_TEST_VERSION` and
    stays `true`.
  - Migrate, don't lose: saved `preferences.shredder`, a customised key for the
    old `shredder` command, and the notebook in `mdlxl-shredder-keycaps-v1`
    (learned and muted keys) carry over once to the new names.
  - [docs/SHREDDER.md](../SHREDDER.md) becomes `docs/LEARN.md`; update links in
    [HOTKEYS.md](../HOTKEYS.md), [AI-HOOK.md](../AI-HOOK.md),
    [agent-map.md](../agent-map.md) and the packaged test list in
    [run-packaged-tests.mjs](../../scripts/run-packaged-tests.mjs).
- **Bird concept removed.** Close PR #269 (`claude/shredder-tutor`, the old
  bird tutor) with a short comment that the owner dropped the concept, and
  delete that remote branch. Remove bird/bubble/tutor wording from the Learn
  docs' History section (one line saying it replaced an earlier concept is
  enough). **Do not touch** `app/UpdateShredder.jsx` / `UpdateShredder.css`:
  that is the update-download animation shipped since PR #132, a different
  feature.
- Out of scope: popup placement, timing, learning and muting rules (keep every
  owner refinement in [shredder-keycaps.md](shredder-keycaps.md)); the
  Particle Editor / AnimXL / Texture Library key coverage; any other dock icon.

## Revision and local state

- Base: `claude/shredder-keycaps` at `1c363bf4` (PR #304, still **open**, not
  merged; that note's "merged into main" status line is wrong). LER, Shredder
  and the per-window keys exist only on this branch.
- Branch: continue `claude/shredder-keycaps` in PR #304 (the rename touches
  nearly every file the PR adds). Merge `origin/main` first if it moved.
- No fixtures needed beyond the existing Shredder Electron test's demo model.

## Relevant owners

- LER `Tool` in the dock: [AppToolbar.jsx](../../app/AppToolbar.jsx) line ~48
  (`className="learner-tool"`, `active={preferences.shredder.enabled}`).
- Command and key: [commands.js](../../src/commands.js) (`shredder`, Ctrl+J),
  [electron/menu.cjs](../../electron/menu.cjs), `commands` in
  [App.jsx](../../app/App.jsx).
- Held-key letters: second `useEffect` near the end of
  [Hotkeys.jsx](../../app/Hotkeys.jsx) (`reveal` / `dismiss`).
- Settings block: `ShredderSettings` in [Settings.jsx](../../app/Settings.jsx);
  Settings opens through `settingsTab` / the `hotkeys` command in App.jsx.
- Preferences: [preferences.js](../../src/preferences.js) (`shredder:
  DEFAULT_SHREDDER`, `normalizeShredder`).
- Dock rules and tests: [TOOLBAR-DOCK.md](../TOOLBAR-DOCK.md),
  [module-button-labels.test.js](../../test/module-button-labels.test.js),
  [module-button-labels.browser.cjs](../../test/module-button-labels.browser.cjs).
- Map row: Shredder / hotkeys in [agent-map.md](../agent-map.md).

## Verification required

- Source tests: rename `test/shredder.test.js`; add checks for the preference
  and notebook migration (old saved data comes through, damaged data still
  normalises) and for the Show hotkeys preference default and round trip.
- Packaged app on a hidden desktop (never pop windows on the owner's screen):
  - LER opens the box under the icon; Esc, click outside and LER close it.
  - Learn mode row switches reminders and the LER glow; Ctrl+J does the same
    without the box.
  - Show hotkeys row: letters stay visible with no key held, follow opening and
    closing a dialog and a detached window, survive a restart, and go away
    when switched off; holding Alt with it off still works as before.
  - Learn settings… lands on Keyboard Shortcuts with the Learn block in view.
  - A profile with old Shredder settings, learned and muted keys keeps them.
  - Re-run the existing Shredder packaged checks under the new name.
  - Mouse camera rotation in the preview still works (real drag) with the box
    closed and with Show hotkeys on.
- Screenshot of the box open (new look) for the owner; check it at 1100 and
  1920 widths. In VIS the box uses VIS's classic look (see
  [vis-mdlvis-mode.md](vis-mdlvis-mode.md)); no new-look styling leaks there.
- `pnpm test`, `pnpm run test:source`, `pnpm run build`, PR CI green.
- Update PR #304's description (`Session:` lines kept, add `Session: codex
  <task>`), report `ready to test` with a short click-through for the owner.
  No merge or release without the owner's word.

## Blockers and next action

- None. Next: Codex merges main into the branch, renames, adds the box and the
  Show hotkeys preference, closes PR #269, verifies, pushes.
- On completion: mark this note completed, fix the status line in
  [shredder-keycaps.md](shredder-keycaps.md) (or fold it into a renamed
  `learn.md` note), remove the row from [README.md](README.md).
