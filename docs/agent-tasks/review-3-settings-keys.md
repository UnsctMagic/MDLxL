# Contract 3: settings and keys cannot be wiped by accident

Status: ready for Codex
Owner / consolidator: Codex (fix), Claude Code (contract and review)
Updated: 2026-11-11

Findings C1 to C4 of the [main review](main-review-2026-11-11.md), all from PR #602.
Read its "Rules for every contract" first. Map rows: "Keyboard shortcuts (hotkeys)",
"Mouse settings and editing Rotate behavior". Read [Keyboard shortcuts](../HOTKEYS.md).

## Goal and completion criteria

1. **C1.** In Settings > Hotkeys, choosing a built-in preset in the Preset dropdown asks
   before it replaces the user's keys, with the same confirm row the Restore button
   already uses (`presetRestoreQuestion`). Nothing is applied until the user confirms; Cancel
   and Escape leave the dropdown on its old value. This also covers the arrow keys on
   the closed dropdown. Other preset pages (Mouse, Rotate, UV) keep applying at once,
   as today, unless they also define a question.
2. **C2.** Import configuration (`importConfiguration` in `src/portable-settings.js`,
   `loadConfiguration` in `app/Settings.jsx`):
   - never changes `settingsPresets` (the saved preset lists are a personal library,
     not a portable setting);
   - for any preference the file does not contain, the current value is kept instead of
     being reset to its default;
   - a file exported by this version still imports to an exact match, and the existing
     validation (unknown keys, out-of-range values, hotkey clashes) is unchanged;
   - the page text and the result message say what is and is not replaced.
3. **C3.** The lock badge reads the user's "Lock direction" key in the main window as it
   already does in detached windows. Mount `ShiftLockBadge` where it can read
   `PreferencesContext`, or pass the preferences in.
4. **C4.** A default key newly given to a command is not applied when the user's own
   `preferences.hotkeys` already gives that key to another command in the same scope
   (the rule `contextualHotkeyDefaults` already follows for controls). Covers
   Ctrl+F2 and Shift+F3 from #602, Alt+K from #623, and every later default.
   The user's own binding keeps working; the new command stays reachable from the menu
   and can be bound by hand.

Owner decisions, **do not implement**: O3 (key after a tapped Alt), O4 (Restore on a
fresh install's UV page), O5 (release-note line for German/French keyboards), O7.

Out of scope: preset file format, the Settings layout, any stored key name.

## Revision and local state

- Base: local `claude/main-review-2026-11-11` (`main` at `a8a4ca86`).
- Overlap: `claude/fx-editor` changes two lines of `app/PresetBar.jsx`; keep edits there small.

## Relevant owners

- `app/PresetBar.jsx` (`pickPreset`, `choose`, `restore`, confirm row),
  `src/settings-presets.js` (`applyPreset`, `presetRestoreQuestion`, built-in `default`).
- `src/portable-settings.js`, `app/Settings.jsx` (`loadConfiguration`, Configuration page).
- `app/main.jsx`, `app/ShiftLockBadge.jsx`, `app/PreferencesContext.jsx`, provider in
  `app/App.jsx`; `bindLockBadge` in `src/shift-lock.js`.
- `src/commands.js`, `app/Hotkeys.jsx` (`effectiveBindings`, `runShortcut`),
  `src/hotkey-defaults.js`.

## Findings and decisions

- Verified (script): `node D:\Claude\MDLxL-QA\2026-11-11-main-review\settings-data\roundtrip.mjs`
  prints, among others: after importing a file without the new keys, saved lists go
  from 1 each to 0 each, `modifiers` to `{}`, `uvDrag.zoomStyle` from `rightUp` to
  `centre`, toolbar from `trim` to `graphic`; after picking Default, hotkeys and
  modifiers are `{}`. A same-version export round-trips exactly.
- Verified by reading: `main.jsx` renders `<App/><ShiftLockBadge/>` as siblings; the
  provider is inside `App`, so the badge gets the context default (no preferences).
- Not a fault: #602 renamed or dropped no stored key; old values are still read.

## Changes and verification

Tests to add first (each must fail on the base):

- `test/settings-presets.test.js`: with a custom key set, choosing Default through the
  same path the dropdown uses leaves the key until the confirm is accepted.
- A packaged step in the style of `test/uv-drag-settings.electron.cjs`: real select
  change on the Hotkeys preset, confirm row appears, Cancel keeps keys.
- `test/preferences.test.js`: import a configuration without `settingsPresets`,
  `modifiers`, `uvDrag`, `toolbarMode` into a profile that has them; all four stay.
  Import a current export; exact match.
- Extend `test/shift-lock-badge.electron.cjs`: rebind `drag.move.axisLock` to Alt, real
  Move drag in the main window with Alt held, badge appears.
- `test/hotkey-default-overlaps.test.js`: with a user override binding Ctrl+F2 to
  another command, the launcher's effective keys do not contain Ctrl+F2 and the user's
  command runs.

Run the files above plus `test/hotkey-defaults.test.js`, `test/hotkey-migration.test.js`,
`test/hotkey-window-source.test.js`, `test/localization-catalogs.test.js` (new text
needs all five languages).

## Blockers and next action

- None. On completion: status, revision and checks here; plain summary for the owner;
  hand back.
