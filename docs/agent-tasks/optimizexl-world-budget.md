# OptimizeXL world-space animation reduction
Status: ready for review; awaiting merge approval
Owner / consolidator: Codex
Updated: 2026-10-30

## Goal and completion criteria
Add a selectable world-space animation reducer in the existing stage; retain the default legacy reducer and immutable flail baseline. Measure private Fx against original and accepted animation-only reference; push feature branch and open PR, without merging or version change.

## Revision and local state
- Branch: codex/optimizexl-world-budget; D:/Codex/mdlxl-optimizexl-world-budget.
- Original base: aa6689820ca49fd9c48a029b71959d8bcb097ca0. Integrated current main de36134b1c9653dd5500533b5c6b88a956baa3e7; only the task-index row conflicted, and both tasks were retained.
- Implementation: 4c9e14b4fdedafe8e7584e4662ba2b1d6e225b3c. PR: https://github.com/UnsctMagic/MDLxL/pull/437 (open, unmerged).
- Private input/reference: owner's D:/Claude/research/fx-optimization-2026-10-30 folder; never commit or execute its scripts.
- Results: D:/Codex/mdlxl-optimizexl-world-budget-results.

## Relevant owners
- src/optimizexl-world-animation.js: opt-in world bound, motion budgets and interpolation conversion.
- src/optimizexl-animation.js: existing reducer and shared motion protection.
- src/optimizexl.js, app/OptimizeXL.jsx and app/OptimizeXLHelp.jsx: stage/settings and existing review flow.

## Findings and decisions
- Local mode remains the default; all legacy settings remain unchanged.
- World mode retains the unchanged 10% component/turn guard where the direct budget could flatten that excursion (translation range; angle or scale range times existing reach). Its direct cumulative skin bound owns larger excursions and replaces the reach acceptance approximation only in this opt-in mode. The default local reducer retains full existing component/reach protection.
- Independent global influence is excluded from approximate world reduction. Effect/event tracks retain their existing exact cleanup; a skin parent is not excluded merely because it carries an attachment or event.
- Quaternion squad identity requires exact controls equal to values; vector cubic controls do not share the identity.
- No new checker proposals: existing redundant-key and remaining-cubic owners retain their repair workflows.

## Changes and verification
Implemented selectable world mode, reused exact owners and small-motion guard, bounded cubic refits and quaternion identity. Fx: 144,453 / 139,281 / 136,097 bytes at 60/80/100 (9.13/12.38/14.39%); all derived bounds and accepted per-animation maxima pass, with exact endpoints. Raw manual target 18.08% is not achieved; its node-TRS-only equivalent is 17.21%. Full evidence and 55 per-animation rows are in docs/OPTIMIZEXL_VERIFICATION.md.

251 source/compatibility/localization tests pass, 2 private skips. Frozen flail: 56 comparisons pass with unchanged golden files and existing exceptions. Vite and packaging pass (1,339 runtime/assets; 55 locales). Final generated hidden package checks pass 3/3, with native poses, actual paired mouse drags, strength restoration, approval, Back and save. The fuller selection adds Flail03 playback passing; 13 private-policy skips and an untouched stale review assertion remain (unmodified base also gives identical 9 rows where the test expects 10).

## Blockers and next action
PR #437 is open and attached. Integrated-main verification is complete, including 12 AI integration checks and exact final Fx bytes. Remote CI is visible on the PR. The disposable checkout is removed after pushing this handover; the small report and one screenshot remain in D:/Codex/mdlxl-optimizexl-world-budget-results. Do not merge; awaiting owner approval.
