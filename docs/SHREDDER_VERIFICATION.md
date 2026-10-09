# Shredder verification

Enable **Settings → Mouse → Shredder**. It is off by default and remembered in the existing portable preferences. The existing updater visitor is unchanged.

The helper observes trusted mouse activation of WarmKeys controls and native menu actions. It uses current effective bindings, including remaps and cleared assignments. Advice requires three repetitions within 45 seconds, allows at most one balloon per minute, and excludes long leader sequences, conflicting assignments and uncomfortable one-hand reaches. The supplied `Z+1` / `Z+1+0` examples are covered by the reach check; no new shortcut syntax or bindings were introduced. Using the advised shortcut clears that action's frustration.

Three ignored tips followed by further repetition can cause one seven-second tantrum per enabled session. Flying, complaining, pointing and cursor pecks are visual only. The overlay and its children pass every click through, never send editing input, and never move the mouse. The default view adds no panel or sidebar width.

Mordor replaces advice with Morgoth's crown and attacks in the active Vertices view. Each flight plans a visible vertex displacement and commits it through the existing editor edit/undo path. Other vertex attributes, topology, texture paths and rig data are retained; bounds update through the existing extent routine. Modals, saving, read-only documents, pending drafts and active input prevent an attack. Switching models/modes or disabling Shredder cancels a pending flight. Committed attacks remain ordinary undoable edits and are not written to the model file until the user saves.

Both directions into Shredder + Mordor require the exact English warning, `Proceed?`, `Aye!` and `Nay!`. The requested warnings are exempt from localization and Mordor's font. Nay leaves the attempted setting unchanged. The helper's speech uses English, Russian, Spanish, Chinese or the program's existing Mordor cipher and font; shortcut keys remain literal.

## Checks

- `node --test test/shredder.test.js test/preferences.test.js test/warmkey-defaults.test.js`: 19 passed.
- `node test/shredder.electron.cjs`: packaged Electron acceptance passed with an isolated synthetic model/profile and an off-screen window. Covers default/idle layout, trusted clicks vs programmatic activation, remapped Q tips and target outline, shortcut learning, bounded tantrum, click-through hit testing, normal-mode serialized-byte equality, actual mouse camera rotation, both exact warnings and choices, crown/carry speech, live vertex/preview agreement, original-byte restoration by editor Undo, all languages and preference persistence. The test advances the observer's clock so minute-long cooldowns are exercised without waiting real minutes.
- Production Vite build and complete Windows packaging passed; packaged runtime/assets were hash-verified and all 55 Electron locale files retained. Assets were rebuilt after integrating current main's Movement POSE changes; generated bundles were not manually merged.
- The wider selection/document/mesh/POSE run had 99 passes, 6 failures and 2 skips. All six failures reproduced on an isolated `origin/main` source snapshot (40 passes, 6 failures): existing bone-capacity, node deletion, visibility/sentinel, read-only/version-conversion and rest-pose pivot assertions. They are outside this change's owners.
- Localization checks retain the unchanged community Chinese catalog. One existing completeness assertion fails for `ru: Forge: Add shape`; the same missing translation was verified in the unchanged localization source. Shredder's new speech and placeholder checks pass for every language.

Screenshots and reports are generated locally under `out/shredder-helper-ui/`; the test package is under `out/shredder-helper-package/MDLxL-win32-x64/`. No personal model, installed editor or user profile was exercised or replaced. Interaction pacing was checked with the simulated cooldowns and a synthetic cube; extended everyday use remains a user acceptance check.
