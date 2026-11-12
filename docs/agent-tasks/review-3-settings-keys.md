# Contract 3: settings and keys cannot be wiped by accident

Status: reworked and ready for Claude re-check. O5 wording is ready for the next release-branch update.
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

The existing packaged hotkey audit now uses Tab and ArrowDown to choose
Default, checks that the current preset remains selected, and clicks Restore
all defaults before its existing Fit and Learn assertions. `node --check
test/hotkey-defaults-audit.electron.cjs` and `git diff --check` passed.

The named `node scripts/run-packaged-tests.mjs default hotkey-defaults-audit`
run stopped before the Default step on both `4340c5f8` and the contract 3
package. It opened all 33 windows without skips, then waited for Assign
shortcut while recording Ctrl+F9 for Fit. Both runs recorded Ctrl+F9 for
Forge's Tube thickness, which makes Settings offer Replace existing assignment.
A temporary copy that clicked that button passed the full audit on the
contract 3 package. It checked all 743 catalog rows, confirmed Default via
real input, restored Fit's Home tooltip, and reset the same Learn entry.
The committed audit keeps the pre-existing Fit setup.

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


## Rework after Claude’s review

- Implementation revision dd02737e. The settings test still checks that Classic and Orbit use the preset bar’s Custom snapshot route. The UV guide qualifies centre Zoom by profile age. The full source run found two protected Chinese catalog entries had been replaced. Those keys and values were restored alongside the new import text in the five catalogs. The community catalog check now passes with its original hash.
- C4 consequence: importing a configuration with a custom key on another command’s default now keeps the imported key instead of raising Conflicting shortcut. The check in test/release-fixes.test.js records this. Preset files still reject the clash.
- pnpm run test:source: 3,278 passed, 0 failed, 10 skipped. CI reporter: 3,288 passing events including skips, 0 failures, 0 new failures. pnpm test: 57 passed, 0 failed, 0 skipped. Focused settings, catalog and community localization checks: 22 passed. The baseline file is unchanged.
- Owner summary: the preset test protects the intended behavior, the guide explains which UV default applies, and the Chinese community wording remains available.

### O5 release handoff

Add the following line to the matching draft notes on codex/release-0.40.0 when that branch next moves.

- EN — On German and French keyboards, letter keys rebound before 0.39 may now be on a different key. Check them in Settings > Hotkeys.
- ES — En teclados alemanes y franceses, las teclas de letras reasignadas antes de la versión 0.39 pueden estar ahora en otra tecla. Revísalas en Ajustes > Atajos de teclado.
- RU — На немецких и французских клавиатурах буквенные клавиши, переназначенные до версии 0.39, теперь могут оказаться на других клавишах. Проверьте их в разделе «Настройки → Горячие клавиши».
- ZH-CN — 使用德语或法语键盘时，在 0.39 版之前重新绑定的字母快捷键现在可能对应其他按键。请在“设置 → 快捷键”中检查。
- FR — Sur les claviers allemands et français, les raccourcis de lettres réattribués avant la version 0.39 peuvent désormais se trouver sur une autre touche. Vérifiez-les dans Paramètres > Raccourcis clavier.
- DE — Auf deutschen und französischen Tastaturen können vor Version 0.39 neu belegte Buchstabenkürzel jetzt auf einer anderen Taste liegen. Prüfen Sie sie unter Einstellungen > Tastenkürzel.
