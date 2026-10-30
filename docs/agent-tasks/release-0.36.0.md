# MDLxL 0.36.0 release preparation

Status: active; final package/suite waits for owner merge of Escape PR #432
Owner / consolidator: Codex
Updated: 2026-10-30

## Goal and completion criteria

Open Release 0.36.0 PR only. Owner merges, tags, publishes and does the website.
Four localized notes/PDFs, translation catch-up, full hidden default/all suite,
one retry of failures and persistent-failure comparisons with official 0.35.0.
AI console/editor are must-pass; compare any failure against main before #430.
No real profile or installed application changes.

## Current state

- D:\Codex\mdlxl-release-0.36.0, branch codex/release-0.36.0.
- Main through #425, #426, #427, #428, #429 and #430 is integrated (56fb26c8).
- Release history was consolidated onto that main to split the Escape repair.
  Original unpublished history is protected by codex/release-0.36.0-pre-escape-split.
- Escape is separate PR https://github.com/UnsctMagic/MDLxL/pull/432,
  branch codex/uv-library-escape, 03b248b1, cut from current main. It changes
  only Hotkeys.jsx and adds escape-input.electron.cjs. No duplicate Escape
  source/test diff remains on the release branch. Merge main after owner merges
  #432. Its disposable worktree/package/profile/junction were removed.
- All tools use MDLXL_TEMP, TEMP and TMP = this worktree's out/tmp.
  out/tmp/package.json must remain {"type":"commonjs"}. D: began at 39.86 GB,
  above the owner's 25 GB minimum; it later had over 50 GB free.
- Dependency junction: D:\Claude\MDLxL\node_modules. Never pnpm scripts here.
- Final checker is out/final-checks.ps1. Current PID is out/final-checks.pid.
  Consult out/release-run-state.json and stdout/stderr logs before acting.
  An interrupted partial out/pkg was deleted. No final suite has run yet.

## Release changes

- package.json, README title/current summary/release index: 0.36.0.
- Four notes cover the merge-history/PR-body review plus RELEASE-NEXT carry-over;
  RELEASE-NEXT is reset. #427 AI chat fixes, #429 Bitz visibility and #430 AI
  context diet are included in all four notes and out/release-body-draft.md.
  Owner BITZ/A1 placement click-through is in out/pr-body-template.md.
- Catalogs ru/es/zh gained 285 entries each; counts 7261/7277/7141. Placeholders
  preserved. AST review of 124 requested files; remaining presentation strings
  are brands, chords, formats, paths, URLs and examples. Composed JSX labels
  now explicitly translate; malformed loading/separator text corrected.
- Owner-approved number-field repair completes D11: Settings sensitivities,
  ShowcaseNumber, Extra Time, animation Loops and fades apply on Enter/blur;
  Escape restores. Sliders, limits, negative Extra Time and whole-loop error
  remain. Packaged number regression and Showcase actions passed.
- Runtime guides select the four 0.36.0 New-Features PDFs. Old 0.35.0 PDFs stay:
  docs/agent-tasks/codebase-audit/07-tests-scripts-docs.md references that family.
- Guide source: D:\Claude\MDLxL-gate\features-0.36.0. Original five top-level
  shots were preserved. Fresh localized captures/HTML/28 page previews are in
  out/feature-shots and copied to external source shots/<lang>/ and previews/.
  Four seven-page PDFs in docs; all 28 HTML pages rendered with Chrome and LOOKED
  at. Fixed headings, labels, crops and pictures. pypdf verified pages/text.
  Contact sheets tracked in docs/verification/release-0.36.0-previews.

## Five stale harnesses: owner-approved updates

- citadel-flow sends physical shifted } for the current Blend binding.
- citadel-surfaces uses documented Paint Alt-drag, verifies camera rotation and
  retains exact paint hash / mapped preview / committed texel / Undo checks.
- showcase measures GL samples while the model draw runs (High/Medium 4, Low 0),
  keeps the default framebuffer single-sample and retains resolution ratios.
- showcase-text imports the real ESM module and its dependencies, preserving
  every font/effect/pixel/fade/capture assertion.
- uv-preview-edit-constraints uses the current menu Undo/Redo path, retaining
  all model equality, live camera, save/reload and input-preservation assertions.
- The typed-number behavior updates Showcase tests to commit before history or
  timing assertions. Window-key harness waits for initialized history and the
  restored draft value; original assertions remain.

## Evidence and pending verification

- Before final integration: compatibility 57 pass; full source 2389 pass/14 skip.
  Initial 14 temp-scope failures were fixed by out/tmp CommonJS scope, with all
  affected tests passing on repeat. Final full source must run after all merges.
- Number/history/timeline source 19 pass; hidden number-commit, Showcase actions
  (including mouse rotation and real 7-second/210-frame High GIF) passed.
- Reduced updater gate: source updater 15 pass/1 platform skip; hidden packaged
  update/restart/retention/offline revert passed. Do not run full manual gate.
- Escape PR: 29 focused source tests, Vite/package, unchanged complete hidden
  uv-tab-window and new escape-input passed. The official 0.35.0 Search-focused
  Escape control closes, proving prior current-main behavior was a regression.
  Logs copied to out/escape-split-results. #432 CI is tracked on GitHub.
- #427 focused integrated AI tests 73 pass; catalogs 2 pass; #428 graders 11 pass.
- Required #429 command: node --test test/bit-replacement.test.js
  test/bits-and-parts.test.js: 17 passed.
- Final checker waits for #432, fetches/merges main, builds/packages, runs source
  checks, then AI console/editor must-pass and the five updated harnesses as
  preflight before full default/all. Copies preflight summaries/logs separately.
- Pre-#430 main is b3bb48e920041cb074cac25e0a1004258b381aff (#430 first parent),
  saved in out/pre430-main.txt. If AI console/editor fail, compare against a
  clean package of that main and report any regression HERE before continuing.
  They are must-pass, not accepted environment failures.
- Initial/retry/baseline suite snapshots: out/suite-initial.json,
  out/suite-retry.json, out/suite-baseline.json. Runner logs out/suite/default
  and release. If stopped early, resume with SUITE_RESUME=1. Compare failure
  causes, not just fail statuses, before calling one pre-existing.
- Known environment gaps to list: event-sound-scroll, manager-simplification,
  tree-appearance (private models); particle-model-io, particle-prototype,
  particle-review (profile/particles/current.json). Keep their assertions.
- #428 live AI measurements are deliberately excluded from default/all; no
  signed-in real-use run is requested. Other documented runner skips stay.

## Fixtures and finish

Fixtures live only under out: pose/Footman (MDX1800); citadel-fixture/Footman
(MDX800, copied from D:/Claude/BloodDragon/ref/blizzard); native-fixtures/Archer
(read-only CASC extraction); effect and optimizexl-review KnightKhorneFlail03;
native-fixtures/HoofprintModel (four authored FPT events, Walk MoveSpeed 380).
Particle index is absent. See final-checks.ps1 for exact environment variables.
Official 0.35.0 ZIP was SHA-256 verified and extracted at out/rel-0.35.0.

After checks: curate this note/report, push release branch, open Release 0.36.0
PR with checks, suite comparison table, all PDF previews, owner click-through,
Release body draft, final line Session: codex release 0.36.0. Do not merge/tag/
publish. Reply with release PR URL and release branch revision. Remove disposable
packages/profiles/runtimes and unused processes, preserve small report and
requested external guide sources/captures, unlink node_modules then remove and
prune finished worktree after push. Preserve unpushed history and user inputs.
