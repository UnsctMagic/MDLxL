# OptimizeXL world-space animation reduction
Status: ready for review; awaiting owner inspection and merge approval
Owner / consolidator: Codex
Updated: 2026-10-30

## Goal and completion criteria
Add a selectable world-space animation reducer in the existing stage; retain the default legacy reducer and immutable flail baseline. Measure private Fx against original and accepted animation-only reference; push feature branch and open PR, without merging or version change.

## Revision and local state
- Branch: codex/optimizexl-world-budget; D:/Codex/mdlxl-optimizexl-world-budget.
- Original base: aa6689820ca49fd9c48a029b71959d8bcb097ca0. Integrated main de36134b1c9653dd5500533b5c6b88a956baa3e7, then release main 4681688ec4d01ba98c5aa9acf63f31d7f39d44eb. Conflicts were limited to the task index and exact translation counts; all concurrent release controls/translations are preserved. The PR does not change the version relative to current main.
- Original implementation: 4c9e14b4fdedafe8e7584e4662ba2b1d6e225b3c. Reviewer follow-up is at the current PR head. PR: https://github.com/UnsctMagic/MDLxL/pull/437 (open, unmerged).
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
World mode remains opt-in; Local defaults and frozen legacy results remain intact. Reviewer follow-up compiles immutable quaternion/clip sampling, pools shared node matrices with edited-subtree invalidation, reuses original pose samples/bind data and proves the constant-rotation/linear-translation slow-budget certificate. Approximate error checks remain 1 ms. Largest-gap greedy order is selected after measuring alternatives; guards and budgets are unchanged.

Final Fx 60/80/100: 144,465 / 139,489 / 135,993 B (9.12 / 12.25 / 14.45%). Isolated times: 3.49 / 3.93 / 4.77 s. Three prior fresh final-order World 100 processes: 4.580 / 4.545 / 4.565 s; the ancestor-map check is 4.615 s and final cycle-cache checks are 4.736 / 4.767 s. Before same-PC profile: 60.830 s (published prior 98.01 s during other checks). All derived and manual maxima pass on dense independent replay, with exact endpoints. The 2 s stretch is unmet. Manual node-TRS gap shrinks 4,492 to 4,388 B; Attack Slam gap is 1,724 B, including 1,232 B of guarded foot translations. Detailed track/animation tables, order/refit experiments and speed proof: docs/OPTIMIZEXL_VERIFICATION.md.

301 source/compatibility/localization/shared-animation/AI/UI checks pass, 2 private skips. Frozen flail: 56 comparisons pass with unchanged goldens and existing exceptions. Vite/package verification passes (1,343 runtime/assets, 55 locales); final hidden world-budget/workflow/preview harnesses pass 3/3, including actual paired mouse drags, approval, Back and save. Warcraft III and owner visual acceptance remain untested.

## Handover
Continue the same codex/optimizexl-world-budget branch and PR #437. No default, version, budget, guard or installed profile changes. PR body contains the two-line owner decision note and refreshed timing/Fx tables. The manual saving target is still unmet; the 5 s target is met on this PC. Do not merge. Disposable task data and checkout are removed after push, retaining the small D:/Codex/mdlxl-optimizexl-world-budget-results/followup report/logs and capture.
