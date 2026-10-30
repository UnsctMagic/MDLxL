# MDLxL 0.36.0 release preparation

Status: active; approved Escape repair verified; final integration and suite pending
Owner / consolidator: Codex
Updated: 2026-10-30

## Goal and completion criteria

Prepare 0.36.0 through an open PR titled Release 0.36.0. The owner merges,
tags, publishes and handles the website. No installed app/profile changes.
Four release notes and seven-page feature PDFs; complete translation catch-up;
full hidden default/all packaged suite, retry failures once and compare
persistent failures with the official 0.35.0 ZIP. Only new failures block.
Use the reduced updater checks requested by the owner, not the manual gate.

## Revision and local state

- Branch: `codex/release-0.36.0`.
- Worktree: `D:\Codex\mdlxl-release-0.36.0`, created from `origin/main` 44b33618.
- Dependency junction: `D:\Claude\MDLxL\node_modules` (never run pnpm here).
- Every tool sets MDLXL_TEMP, TEMP and TMP to this worktree's `out/tmp`.
  Its `package.json` must contain `{"type":"commonjs"}` for generated fixtures.
- D: started with 39.86 GB free; owner minimum was 25 GB.
- WP-3.1 merged as #426 (d1dc4ffe); WP-2.8d (#425) remains open.
  Fetch and merge origin/main again before final build/checks.

## Changes and owners

- package.json and README: version/current summary/release index 0.36.0.
- docs/RELEASE-0.36.0{,-ES,-RU,-ZH-CN}.md: full merge-history/PR-body review,
  highlights, Showcase carry-over and ready-to-try hints.
- docs/RELEASE-NEXT.md reset to empty template.
- src/locales/{ru,es,zh}.json: missing UI text and template translations,
  placeholders preserved; catalog test counts updated.
- app/AppDialogs.jsx and app/GamePreview.jsx: malformed loading/separator text.
- Paint slider labels, Texture Library heading, density counts, OptimizeXL,
  Particle Editor and Sort My Mess fragment text explicitly uses translate().
- scripts/package.mjs runtimeGuides selects 0.36.0 feature PDFs.
- Retained the four 0.35.0 New-Features PDFs: the historical audit report
  docs/agent-tasks/codebase-audit/07-tests-scripts-docs.md still names that family.
  Runtime packaging ships only the new 0.36.0 guides.
- New guide scripts: `D:\Claude\MDLxL-gate\features-0.36.0`.
  Original five files in its `shots/` were preserved.
- Fresh localized captures/HTML/page previews: `out/feature-shots`.
  Build: `node D:/Claude/MDLxL-gate/features-0.36.0/build.mjs`.
  Run captures through scripts/hidden-run.ps1, setting location in the same call.
- PR body evidence: out/release-pr-sources-*.json (63 merged PRs from
  git log --merges v0.35.0..origin/main at the initial base).
- Translation AST scan (124 requested files): out/scan-localization.mjs and
  out/localization-scan.json. Remaining presentation literals are brands,
  keyboard chords, format names, paths, URLs and code examples. A visual follow-up found composed labels bypassing automatic translation;
  raw text fragments and the Paint label now use explicit translate() wrappers.

## Verification so far

- 57/57 compatibility tests passed.
- Localization/updater focused tests: 35 passed, 1 platform skip.
- Initial full source pass: 2375 passed, 14 failed, 14 skipped. All 14 failures
  were task temp-scope failures, not product changes. Added CommonJS temp scope;
  the affected native-provider/protocol/question/helper rerun: 47 passed, 1 skip.
  Integrated source suite then passed: 2389 passed, 14 skipped, zero failed.
  Fragment-owner/localization checks: 81 passed, 1 skip. Repeat the full source
  suite after final main integration.
- Initial package built and verified: 1332 files, 55 locales. This was for captures;
  it predates the last translation/PDF edits and must be replaced before suite.
- Official 0.35.0 ZIP and checksum downloaded, SHA-256 verified and extracted
  to out/rel-0.35.0/MDLxL-win32-x64.
- PDFs: 7 pages each, all 28 initial Chrome page previews inspected. Corrected
  smoothing label, Add sequence translation, localized Medium hint, and model crops.
  Final 28-page overview and changed full pages inspected successfully.
  Four seven-page PR contact sheets are in docs/verification/release-0.36.0-previews.
  Paint captures refreshed and inspected after explicit fragment translation.
- Captures use hidden desktop only. No CUA/computer skill was used.

- Reduced updater checks passed: test/updater.test.js (15 passed, 1 skip) and
  hidden test/updater-packaged.electron.cjs (real update/restart/retention/revert).
  Disposable updater copies and the capture package were deleted afterwards.

## Fixtures and next steps

- out/pose/Footman.mdx (1800) and Textures copied from WP-3.10 fixture.
- out/citadel-fixture/Footman.mdx (800) copied read-only from
  D:/Claude/BloodDragon/ref/blizzard/Footman.mdx; textures copied beside it.
- Review model copied to out/optimizexl-review from
  D:/Codex/sd-research/lowpolyworks/models/WH_WOC_KnightKhorneFlail03.mdx.
  Separate effect and hoofprint copies are in out/effect and out/native-fixtures.
  The mounted model has four authored FPT events and Walk MoveSpeed 380.
- Native Archer extracted read-only from the D:/Warcraft III CASC to
  out/native-fixtures/Archer.mdx. Particle index is absent (runner reports skip).
  Never edit original inputs.
- Set MDLXL_REAL_PLAYWRIGHT=D:/Claude/tools/node_modules/playwright-core.
- Final: merge both incoming packages, rerun translation scan, rebuild/package,
  start `node scripts/run-packaged-tests.mjs default all` in background with
  MDLXL_SUITE_PKG=<out/pkg/MDLxL-win32-x64>, SUITE_TIMEOUT_MS=1800000.
  Keep summary before retries. SUITE_RESUME=1 resumes only nonpassing checks.
  Compare persistent failures with variant release against the extracted ZIP.
- Finish PR with checks/table/previews/release body draft and exact Session line.
  Do not merge, tag or publish. Remove disposable builds/profiles and dependency
  junction, then remove/prune the finished worktree after branch push; retain
  the small report and requested guide sources/previews outside the worktree.

## Number-field catch-up approved during release review

The hidden packaged comparison found the Settings sensitivity boxes and Showcase
text size still applied while typing in both the candidate and official 0.35.0.
The owner chose to repair the missed fields before 0.36.0. Settings' three raw
sensitivity inputs, ShowcaseNumber, Extra Time, animation Loops and text fades
now use the existing deferred-number contract. Sliders, bounds, negative Extra
Time and the whole-loop error remain. Existing workflows explicitly commit
before checking history or duration.

- Source number/history/timeline checks: 19 passed.
- Hidden packaged number-commit: Settings Wheel/Pointer/Rotation; Showcase
  text size, Escape/Enter/blur, Undo/Redo, negative global/animation Extra Time,
  all fade inputs, and Loops validation passed.
- Baseline evidence: out/number-contract/result.json; repaired packaged evidence:
  out/number-commit.log. Final integrated suite still required.

- Broader hidden packaged showcase-actions passed: actual model/portrait mouse
  rotation, history, text, signature/presets, queue edits/model loading, STOP
  cancellation, and a real 7-second High GIF (210 frames, 1,888,479 bytes).

- The hidden number regression also verifies Enter applies Loops before OK;
  the dialog then saves that value and its negative Extra Time correctly.

## Focused-input Escape regression: repaired with owner approval

WP-2.8d confirmed UV Wrapper > Replace Texture… opens Texture Library with
Search textures focused, its Escape Close binding registered, but Escape leaves
it open. Moving focus to Close lets Escape close it. The release task repeated
the same workflow against the official 0.35.0 portable ZIP on the hidden desktop:
Search focused=true; remainsOpen after Escape=false. This is a regression.

Reported in the release chat before proceeding. The owner chose to repair it
before 0.36.0. The shared shortcut dispatcher now allows local Close from
ordinary typing fields, keeping number Escape restoration and range/picker
keys in their existing path. Drag/menu/recording claims still run first.

- Hidden packaged escape-input passed: Library Search closes only the inner
  window through the catalog and reports key use; Settings Search and Showcase
  preset name also close with Escape.
- Hidden number-commit passed again, including restoration and validation.
- Hidden window-hotkeys passed: rebound history/playback, badges and Learn,
  animation dialog, Paint and managers. Its first attempt read Loops before
  the shared number field's value-sync effect; a bounded value wait preserves
  the original assertion and the repeat passes.
- Focused hotkey/default/field source tests: 30 passed.

Evidence: out/escape-regression.md; out/uv-escape-upstream-failure.log;
out/uv-escape-baseline.log and out/uv-escape-baseline/{result.json,after-escape.png}.
Source owner: app/Hotkeys.jsx delegates local Close through
canHandleHotkeyEvent without allowInInput; src/preferences.js rejects typing
targets. Preserve numeric Escape restoration, range cancellation, active drags,
inner-menu claims and recording before closing. Do not fix only the Library
with an ad hoc Escape listener; use the shared owner.

The number-field repair is committed in 458bfbe9/e41a80fa and verified. Both
isolated number packages were removed after use. out/pkg does not exist.
After resolving this decision and committing verified changes, restart
out/final-checks.ps1 under the current PowerShell 7 process path, hidden. It
waits for #425, fetches/merges main, builds/packages, runs source checks and the
full hidden suite, retains the initial summary, retries failures once and runs
persistent failures against official 0.35.0 (variant release). Final outputs:
out/suite-initial.json, out/suite-retry.json, out/suite-baseline.json.
The PR body template is out/pr-body-template.md with CHECKS/SUITE/HEAD slots.
No branch push or release PR yet.

## Additional merged AI package

PR #427 merged as 9f4e079b and was integrated into this branch with 53f64ee8.
All four notes and out/release-body-draft.md cover review pictures/advisory
missing evidence, explicit delivery, display-step recovery, follow-ups after
AI edits and transferring an owner example over the whole requested area.
The owner may announce an AI context-diet PR later; include it if notified.
WP-2.8d (#425) is still open/draft. Merge origin/main again before final checks.

- Final Close recognition reuses isCloseControl from hotkey-allocation (the
  owner of default Close keys), including custom control IDs. Hidden input and
  number regressions passed on that build; window-hotkeys passed after waiting
  for Showcase history initialization before its first edit. The first attempt
  had observed no initial snapshot (zero Undo/Redo), rather than a refused key.
  Assertions are unchanged. Focused integrated #427 AI tests: 73 passed;
  localization catalogs: 2 passed. Final full checks still follow #425.
