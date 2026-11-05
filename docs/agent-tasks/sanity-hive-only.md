# Hive-only Sanity Check

Status: completed; merged in [PR #538](https://github.com/UnsctMagic/MDLxL/pull/538) (`370d3494`)
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

## Release QA localization follow-up

Requested by Claude release QA for 0.38.0; no merge authorized.

- Continued PR #538 from `7cbb38f37c199ae2d29fb3861037add42dd514f9` on the same branch.
- Added the shortened classic-800 limitation and the audit's missing statuses, failure template, severity labels and three displayed Hive diagnostic templates to es/ru/zh. Twelve entries per catalog; counts are ru 7924, es 7934, zh 7793. CRLF and existing entries/order are preserved.
- Added a focused catalog regression for all app-owned dialog text and populated diagnostic templates. It failed before the catalog change with `ru: Check partially completed` (2 pass / 1 fail / 0 skip).
- Requested final checks passed: `npx vite build`; `node --test tests/*.test.js` (57 pass / 0 fail / 0 skip); `node --test test/sanity-check.test.js test/localization*.test.js` (29 pass / 0 fail / 0 skip).
- Final audit: all nine current flail-fixture diagnostic messages and severities translate in each of es/ru/zh. Authored names, technical identifiers and checker/model data are unchanged.
- No packaged suite was run for this follow-up, per release QA's instruction. Claude reruns it on the final release package. Mark #538 ready for review after pushing; do not merge.

## CI private-fixture correction

- Continued from `d811faad3663983d8cb7b8ff895bbe51625b052c` after CI run 41743935233 exposed four ENOENT failures in `test/sanity-check.test.js`.
- The private path still comes from `fixturePath('optimizexl-review')`. Only the real-geometry regression skips if absent, using the existing source-test reason `private flail model not on this machine`. Its test body and assertions are byte-for-byte unchanged.
- Unsaved-data, source-diagnostics, unsupported-format and failed-Hive coverage use `createStarterDocument()` and run without private files. Native Help dispatch coverage remains unconditional.
- Reproduced before correction with a missing fixture override: 1 pass / 4 fail / 0 skip. After correction: model present 5 pass / 0 fail / 0 skip; model absent 4 pass / 0 fail / 1 skip, solely the real-model test for the reason above.
- Sanity/localization checks after correction: 29 pass / 0 fail / 0 skip locally. No application or catalog change, no packaged rerun, no change to `.github/known-test-failures.txt`.
- Push the correction on #538, confirm the new CI result and hand back to Claude release QA. No merge authorized.

## Next action

Claude owns independent QA. Review the real-model dialog, run the focused checks, and merge only after explicit owner authorization. No installed app/profile or user model is changed. Disposable test packages/profiles are removed after each run; small logs/captures are in `D:\Codex\mdlxl-hive-only-sanity`.
