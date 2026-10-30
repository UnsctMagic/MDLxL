# MDLxL 0.36.0 release preparation

Status: checks complete; release PR ready for owner review.
Updated: 2026-10-30

The owner merges, tags, publishes and updates the website. No release was merged,
tagged or published by this task. Installed applications and personal profiles
were not changed.

## Scope

- Version, README title/current paragraph/release index and four release notes
  are 0.36.0. RELEASE-NEXT is reset.
- Notes include the merge-history/PR-body review, Showcase carry-over, #427 AI
  chat repairs, #429 Bitz, #430 context diet and all four #436 release notes.
  #434 is documentation only and has no release note.
- Main through #436 (de36134b), including #434 (1b4d9c6f), is integrated by
  47ae36e4. The final AI package is rebuilt from that integrated source plus
  the release translation catch-up. Runtime/renderer hashes match the source.
- The Escape repair is separate [PR #432](https://github.com/UnsctMagic/MDLxL/pull/432),
  merged by the owner as 0541756b. It arrives through main, with no duplicate
  release commit. It uses the existing Close binding; Search can dismiss the
  Library, while number-field restoration and earlier drag claims remain.
- The owner-approved missed number fields now commit on Enter/blur and restore
  on Escape. Negative Extra Time, field limits and whole-loop checks remain.
- Russian/Spanish/Chinese catalogs gained 289 entries each. Catalog counts are
  7265/7281/7145. Requested-file AST review covered 124 files; brands, paths,
  chords, formats and examples were reviewed rather than blindly translated.
  JSX title fragments and plan headings that bypass automatic translation use
  translate() explicitly. Model and AI-authored plan text stays unchanged.

## Guides

Four New-Features PDFs have seven pages each: Rotate, Smooth edges, windows and
keys, sliders/numbers, Paint/Forge, Inspector normals and Showcase quality/fonts.
All 28 built HTML page screenshots were visually inspected. Captures were
refreshed per language on the hidden desktop, with the original five Smooth
edges captures preserved. Contact sheets are in
[release-0.36.0-previews](../verification/release-0.36.0-previews).
Guide source/captures remain at D:\Claude\MDLxL-gate\features-0.36.0.
The AI addition affects no guide page, so the PDFs were not rebuilt again.
Runtime guides select 0.36.0; old 0.35.0 PDFs remain because audit evidence
still references them.

## Verification

- Full compatibility: 57 passed.
- Full source before the late AI addition: 2429 passed, 14 skipped, zero failed.
- Full hidden default/all: 155 passed, 14 failed, 24 skipped initially.
  After one retry and setup corrections: **160 passed, 9 failed, 24 skipped**.
  All nine remaining failures also fail against the official SHA-verified
  0.35.0 ZIP; see the release PR comparison table. Passing cases were not
  needlessly repeated against 0.35.0.
- Five owner-named stale harnesses passed with their original behavioral
  assertions preserved: physical Blend key, Paint Alt orbit, smoothed model
  render pass, real ESM text import and current Undo path.
- Rotation repeated all geometry, real-mouse, Undo and Settings persistence
  checks successfully. The helper waits for draft-number value synchronization.
- Archive fixture clears the inherited game-folder override; its MPQ bytes,
  restart/removal and real camera rotation checks pass. Showcase effects uses
  GameDataDiscovery with a task-local cache instead of a personal profile;
  held poses, continuous effect clocks and unchanged model bytes pass.
  Popup browser checks use installed Chrome through the existing executable
  option and pass. These development/browser checks do not prove a 0.35.0 app
  comparison merely by using the release variant.
- Number-field packaged regression and unchanged UV Library dismissal passed.
- Bitz replacement/parts: 17 passed.
- Reduced updater source: 15 passed, 1 platform skip. Hidden packaged updater
  passed real portable update/restart, one-version retention and offline revert.
  The full manual updater gate was not run, as instructed.
- Latest owner scope after #436: **AI source 297 passed, 1 skipped**;
  catalog checks 2 passed. Fresh build/package verified 1340 runtime/asset files
  and 55 Electron locales. Hidden ai-console, ai-editor, ai-routing,
  ai-questions and ai-parallel all passed. ai-editor reports 71 assertions.
  Attachments and the whole suite were not repeated for this AI-only addition.
- No live signed-in AI run, artistic acceptance, Warcraft III or external
  War3 Model Editor acceptance is claimed. Owner click-throughs remain in the PR.

## Remaining baseline/environment failures

- event-sound-scroll, manager-simplification, tree-appearance: private Graveguard
  model unavailable.
- particle-model-io, particle-prototype, particle-review: private particle
  current.json/index unavailable.
- material-presets: the required older Archer fixture is unavailable. The
  installed MDX1800 fixture lacks the requested geoset; the owner approved
  reporting this gap.
- optimizexl-review: the review panel never appears for the supplied Flail in
  either build. Cause was not fully diagnosed.
- particle-library-previews: both builds miss the 72 cached-image assertion
  before its timeout. Cause was not fully diagnosed.
- 24 explicit skips cover opt-in AI/live checks, private OptimizeXL/POSE/Showcase
  fixtures, a missing particle index, copied-profile/performance baselines and
  excluded/manual updater gates. ai-real-use remains opt-in and outside all.

## Handoff and cleanup

The PR contains the suite comparison, four PDF contact sheets, grouped owner
click-throughs (including BITZ/A1 placement) and the English release body draft.
Small logs/summaries are retained at D:\Codex\mdlxl-release-0.36.0-report.
Disposable packages, extracted release/runtime, test profiles and caches are
removed after verification; the finished worktree and its dependency junction
are removed after push. Requested guide sources and unpushed Git history remain.
