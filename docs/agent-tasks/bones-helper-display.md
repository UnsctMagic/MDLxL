# Bones and Helpers display

Status: Completed — [PR #521](https://github.com/UnsctMagic/MDLxL/pull/521), merged 2026-11-03 at `edd5541e687c2a9b1755a4f2bea9f532a669af58`
Owner: Codex
Updated: 2026-11-03

## Goal and contract

Bones is the shared master for Bone and Helper markers. Right-click it for checked Helpers and Bones choices, both enabled by default. These choices filter ordinary markers, picking and full Skeleton links. Focused Skeleton ALWAYS displays and permits picking its selected bone/helper chain, irrespective of the master or either type choice. POSE's focused skeleton retains the same exception.

## Revision and owners

- Branch: `codex/bones-helper-display`; feature commit: `2e872b7e`; original base: `575c57c6`. Concurrent main `fa81f005` integrated before handoff; only the task-index insertion conflicted, and both task rows were retained.
- `app/QuickDisplay.jsx`: one shared context menu in Bones, Movement, Animations, POSE and VIS; dismissed by Escape or outside press. Sidebar duplicates moved here; Refs remains.
- `src/display-overlays.js`: defaults, persistence, legacy helper flag migration, shared rig-editor choices and type predicate. Master off/on and Clear preserve type choices.
- Both renderer option adapters, GL markers, connectors and picking use the same predicate; focused-chain precedence is preserved. No camera or authored model changes.

## Verification

- Build succeeds; disposable standard package verified 1,422 runtime/asset files and 55 locale files.
- `test/bones-helper-display.electron.cjs`: real SD Footman (25 Bones, 15 Helpers), actual right/left clicks, separate rendered marker changes, shared editor state, master off/on, Escape/outside dismissal, POSE/VIS menu, normal Alt+mouse camera rotation. Focused Skeleton pixel comparison is identical with both types enabled versus disabled, and changes when Focused Skeleton itself is disabled.
- Fail-first: unchanged base build timed out waiting for `getByRole('menu', { name: 'Bone types', exact: true })` after a real right-click. The exact same UI path passes on the feature package.
- Source expectations intentionally changed: helpers are enabled with Bones, Clear retains type selections, VIS now permits the Bones master. Focused source checks: 72 passed / 0 failed / 0 skipped.
- Hidden desktop checks run via `scripts/hidden-run.ps1`; no computer-use control or installed profile changes.
- Warcraft III, full suites and independent Claude QA were not run. Claude owns final QA per TESTING-RULES.md.

- Merge closeout: CI identified five stale source expectations in `portrait-toolbar.test.js` and `vis-mdlvis-mode.test.js`; updated only the expected combined Bones/Helpers Clear state, VIS Bones checkbox presence, and removal of forced-on markers. Original checks failed first; targeted rerun recorded in PR.

## Handoff

Owner tested the build and authorized merge plus test-build deletion. PR #521 was merged after CI passed on the corrected head; the merged PR and owning code were verified on online main. Test build `D:\Codex\bones-helper-test-app` was deleted and absence verified. Keep only the small verification report/capture under `D:\Codex\bones-helper-display-report`; the pushed task worktree is removed after closeout. Independent Claude QA and Warcraft III remain unexercised.
