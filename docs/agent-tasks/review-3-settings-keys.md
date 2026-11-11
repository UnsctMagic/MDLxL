# Contract 3: settings and keys cannot be wiped by accident

Status: application fixes verified locally and ready for Claude review. O5 release-note handoff pending.
Owner / consolidator: Codex (fix), Claude Code (contract and review)
Updated: 2026-11-11

Findings C1 to C4 and owner decisions O3, O4, O5 and O10 of the
[main review](main-review-2026-11-11.md), all from PR #602 (O10: #623).
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
   Ctrl+F2 and Shift+F3 from #602, Alt+K from #623 (O10: the owner keeps Alt+K for
   Surface Effects on this condition), and every later default.
   The user's own binding keeps working; the new command stays reachable from the menu
   and can be bound by hand.

5. **O3, decided by the owner on 11 Nov.** After a tapped Alt, a key that has no Alt+
   shortcut does its normal job again, as before #602 (`app/Hotkeys.jsx`, the
   `altArmed` branch: a failed `Alt+key` lookup hides the hints and lets the key
   continue as the plain key instead of being consumed). A key that does have an Alt+
   shortcut still runs it. Escape still only hides the hints.
6. **O4, decided by the owner on 11 Nov.** On a profile that started as a fresh install
   (the first-launch seed in `electron/main.cjs` from #615 gave it right/up Zoom):
   Restore on Mouse > UV and "Restore mouse defaults" give right/up Zoom, and the UV
   preset reads as the built-in preset, not "Custom", while nothing else was changed.
   Profiles that existed before keep today's behaviour (Restore gives centre). The seed
   must leave something lasting to tell the two apart; no released version has seeded
   yet, so this can be added now. A new stored key is fine; rename none. Record the
   rule and its date in [UV Rotate and Zoom](../UV-ROTATE-ZOOM.md) (owner-locked:
   change no other default, and do not edit its locked test numbers).
7. **O5, decided by the owner on 11 Nov.** One line in the 0.40.0 release notes, in all
   six languages per [the release recipe](../RELEASING.md): on German and French
   keyboards, letter keys rebound before 0.39 may now sit on another key; check them in
   Settings > Hotkeys. The notes live on local `codex/release-0.40.0`; add the line
   there, or record here that the release session still has to.

Still open, **do not implement**: O7 (the three 0.39.0 behaviours).

Out of scope: preset file format, the Settings layout, any stored key name.

## Revision and local state

- Fix revision: `a4e7109d` on local `codex/main-review-20261111-3`.
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

- C1 uses the existing Restore confirmation when selecting a built-in Hotkeys
  preset. Cancel and Escape keep the prior selection and assignments.
- C2 updates settings supplied by the file, including fields inside partial
  settings sections. Preset libraries in `settingsPresets` and the profile's
  UV default marker are local. A supplied shortcut map is a complete map.
  The import instructions and completion message were updated in all five
  catalogs. The separate shared preset-file check still rejects default clashes.
- C3 puts the main Move lock badge inside the preferences provider. C4 gives
  explicit assignments precedence over overlapping defaults, including
  Ctrl+F2, Shift+F3 and Alt+K. Duplicate explicit assignments still fail
  configuration validation.
- O3 restores plain-key behavior after a tapped Alt when no Alt shortcut runs.
  O4 records the right/up UV default for fresh installs so both Restore buttons
  and the MDLxL preset agree. Older profiles restore centre Zoom.

Fail-first on `4340c5f8`: five new source cases failed (preset committed before
confirmation, old import reset settings, exported preset list, Ctrl+F2 still
on the launcher, seeded UV read Custom). The named Electron harness on the
baseline package passed one and failed six: the confirmation did not appear,
the import showed the old replacement message, the Alt lock badge did not
appear during a verified Move drag, plain R stayed inactive, Alt+K failed to
select Rotate, and fresh UV Restore gave centre. The older-profile UV case
passed. Two focused follow-up source cases also reproduced missing nested
capture settings and an omitted keyframe colour being reset by legacy migration.

Final source check on `a4e7109d` passed 371 tests with zero failures or skips:

```text
node --test test/settings-presets.test.js test/preferences.test.js
  test/hotkey-default-overlaps.test.js test/uv-drag-settings.test.js
  test/hotkey-defaults.test.js test/hotkey-migration.test.js
  test/hotkey-window-source.test.js test/localization-catalogs.test.js
  test/release-fixes.test.js test/final-patch-core.test.js
  test/desktop-settings.test.js test/uv-tools.test.js
  test/appearance-themes.test.js test/rotate-settings.test.js
  test/rotation-drag.test.js test/compact-geoset-set.test.js
  test/herrdave-shell.test.js test/learn.test.js test/light-dark-switch.test.js
  test/paint-lamps.test.js test/pose-console.test.js test/quad-view.test.js
  test/uv-preview-display.test.js
```

Built with Vite and packaged from the existing Electron cache on D:. Ran
`node scripts/run-packaged-tests.mjs default review-settings` on the hidden
Windows desktop against the final build: seven scenarios passed, zero failures
or skips. The preceding build also passed the named `hotkey-badges` and
`shift-lock-badge` harnesses, including the default Shift badge, detached
Sphereomancer, and Alt+R and Escape behavior. The final changes after those
two runs were confined to configuration import and preset confirmation.

## Summary for the owner

Picking Default in Hotkeys now asks before clearing keys. Importing an old
configuration keeps the saved Hotkeys and Mouse presets and settings missing
from the file. The main Move lock badge follows its assigned key. Your own
shortcuts take precedence, and tapping Alt still lets an ordinary key work.
Fresh installations restore right/up UV Zoom and older profiles restore centre.

## Next action

- Claude: review local branch `codex/main-review-20261111-3`. Saved on your PC, not online.
- O5: the 0.40.0 release session still needs to add the approved line in all six
  languages on local `codex/release-0.40.0`. English: “On German and French
  keyboards, letter keys rebound before 0.39 may now be on a different key.
  Check them in Settings > Hotkeys.”
