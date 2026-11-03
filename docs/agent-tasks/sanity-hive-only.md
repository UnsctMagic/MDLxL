# Hive-only Sanity Check

Status: ready for Claude QA; awaiting merge approval
Owner / consolidator: Codex
Updated: 2026-11-04

## Goal and scope

The owner requested only Hive's checks in Help > Sanity Check. Remove MDLxL structural/parser findings and their influence on its status. Preserve editing/save validation, model data, OptimizeXL, the bundled Hive checker and the existing classic-800 comparison boundary.

## Revision and owners

- Branch: `codex/hive-only-sanity`, based on `3295860ea006d68ef2c362fe202f978cf4f1d2f8`.
- Owners: `src/sanity-check.js`, `app/SanityCheck.jsx`.
- Tests: `test/sanity-check.test.js`, `test/sanity-check.electron.cjs`.
- Real fixture: `fixturePath('optimizexl-review')`, permanently stored in the test-model collection. It has four MDLxL `DEGENERATE_FACES` warnings that Hive does not report.

## Changes and verification

- Sanity Check now serializes a read-only snapshot for Hive without running `validateModel` or consuming document diagnostics. The dialog displays only Hive's original findings and counts.
- Removed the unused structural location formatter. Save/edit validation remains in its original owners.
- The old source regressions asserted the mixed-validator behavior; replaced those expectations with the owner's requested Hive-only behavior.
- Fail-first source run: 1 pass / 4 fail / 0 skip; `Sanity Check must not include MDLxL structural findings`.
- Fail-first packaged run: 0 pass / 1 fail / 0 skip; `Sanity Check must show only Hive findings`, with `0 structural errors · 4 structural warnings` in the old dialog.
- Source checks after the change: 5 pass / 0 fail / 0 skip.
- Packaged verification uses the existing `clickMenu` helper for the native Help command, then real disclosure and Close clicks. It compares every displayed message/count to the bundled Hive result and verifies the model is unchanged. This does not verify physical navigation of the native menu.
- Final build and package verification passed. Packaged Sanity Check: 1 pass / 0 fail / 0 skip; all 9 displayed findings and all severity counts matched Hive exactly, with no MDLxL structural text, no model changes and no renderer errors. Disclosure and Close were clicked.
- Focused source (`node --test test/sanity-check.test.js test/editor-document.test.js`): 32 pass / 0 fail / 0 skip. Compatibility (`node --test tests/*.test.js`): 57 pass / 0 fail / 0 skip.
- Not exercised: physical native-menu navigation, Warcraft III runtime, full source/packaged suites, independent Claude QA. Both disposable packages/profiles were removed; no task-started app or Node process remains.

## Next action

Claude owns independent QA. Review the real-model dialog, run the focused checks, and merge only after explicit owner authorization. No installed app/profile or user model is changed. Disposable test packages/profiles are removed after each run; small logs/captures are in `D:\Codex\mdlxl-hive-only-sanity`.
