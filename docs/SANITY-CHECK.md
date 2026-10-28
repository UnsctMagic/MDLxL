# Help → Sanity Check

Read-only popup for the current editor model, including unsaved document changes.
Uses a cloned model, current parser diagnostics, the existing `validateModel`
owner, and the already bundled MIT-licensed mdx-m3-viewer 5.12.0 checker.
OptimizeXL detection, repair behavior, saves and installed profiles are unchanged.

## Evidence and scope

- [GhostWolf's checker source](https://github.com/flowtsohg/mdx-m3-viewer/tree/2ff0bc00c6363f425016e23d88c0fb2929d3b3cc/src/utils/mdlx/sanitytest): reviewed testers, tracks and result traversal. Runtime uses the existing pinned 5.12.0 bundle, not this newer source checkout. Existing full MIT attribution remains in THIRD_PARTY_NOTICES.md and public/vendor/hive-viewer-LICENSE.txt.
- [Hive: author's Sanity Tester description](https://www.hiveworkshop.com/threads/mdx-sanity-tester.290476/): reference validation, severity levels and unused-object notices. Original findings are retained verbatim, separately labelled advisory. No guessed vertex limit, required animation name or attachment convention is promoted into a structural error.
- [Hive: Retera's empty-event diagnosis](https://www.hiveworkshop.com/threads/world-editor-only-shows-the-models-shadow.357280/): zero-entry EVTS records can prevent model loading. This popup checks empty event tracks before serialization, with a synthetic regression.
- [XGM: MDL structure](https://xgm.guru/p/wc3/mdl-structure): cross-checked sequence intervals, zero-based resource references, replaceable textures, material layers and global-sequence representation. Historical speculation in the article is not used as a validation rule.
- Blizzard's installed assets: `scripts/check-sanity-corpus.mjs` reads local CASC data without extracting or redistributing game files. The committed report records source paths and SHA-256 hashes. Deterministic evenly spaced samples select 20 models each from units, buildings, doodads, abilities and UI.

## Validation on 2026-10-28

100 Blizzard models, all format 1800: no parse failures, no final structural errors.
15 models initially exposed a zero-duration-global false positive in the editor's
strict edit validator. The new report maps exactly zero duration to a warning
without changing the validator or optimizer. Negative and non-integer durations
remain errors. This applies to all models, with no filename exceptions.

All 100 reports explicitly show partial coverage: the legacy Hive comparison is
run only on classic format 800. No conversion of modern models is performed to
make the old checker accept them. Unknown preserved source data also prevents a
complete-pass status. Source errors, engine failures and skipped checks cannot
be presented as a clean result.

Seven focused tests cover non-mutation, unsaved broken references, menu dispatch,
modern-format limits, failed Hive execution, numbering, zero-duration globals,
empty event tracks, parser errors and opaque data. 37 existing document/save-node
regressions passed. Production Vite build passed. Background Electron integration
verified native Help dispatch, result rendering and dismissal without renderer
errors, using a disposable profile. This was a source Electron run with production
dist, not a packaged release or a Warcraft III runtime acceptance test.

Structural locations use one-based list positions; node ObjectIds stay literal.
Raw Hive findings retain its explicitly labelled zero-based indices. Texture file
availability, external dependencies, artistic quality and in-game acceptance are
outside this check. No finite corpus establishes 100% Warcraft compatibility.

Reproduce:

    node --test test/sanity-check.test.js
    node scripts/check-sanity-corpus.mjs "D:\Warcraft III" "D:\Codex\sanity-report.json"
    npm run build
    node test/sanity-check.electron.cjs

Set MDLXL_PLAYWRIGHT_MODULE to an installed Playwright package for the UI test.
