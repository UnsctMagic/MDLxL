# 0.37.0 packaged test fixes

Status: ready for review; awaiting merge approval
Owner / consolidator: Codex
Updated: 2026-10-30

## Goal and scope

Fix `particle-prototype` and `module-button-labels.browser` on the 0.37.0 release branch. PR target is explicitly `claude/release-0.36.1`; do not merge. Product files and other sessions' feature owners remain unchanged.

## Revision and fixtures

- Branch: `codex/037-test-fixes`, based on `778518263cc2ba5b6e36d7b7d3d096f0458c0066`.
- Separate checkout: `D:\Codex\mdlxl-037-tests`; dependencies junction to `D:\Claude\MDLxL\node_modules`.
- User-specified fixture directories, `profile/particles`, `out/suite-env.sh`, and FFmpeg binaries copied from the release worktree. Source the environment file before each run; all scratch data stays on D:.
- Build: `npx vite build`; package: `node scripts/package.mjs --out out/pkg`. Tests only through `node scripts/run-packaged-tests.mjs default <names>`, on the hidden desktop.

## Findings and changes

- Browser harness: reproduced an indefinite wait before browser launch when 4174 is occupied. Vite chooses another port, but the original readiness promise accepts only 4174 and never rejects an early exit. An otherwise clean baseline passed in 4 seconds. The revised harness asks for port 0, reads the actual URL across stdout chunks, rejects startup failures/15-second startup timeouts, and closes the preview even when browser launch fails. Existing UI assertions and real clicks remain.
- Particle harness: the supplied failure screenshot shows the main Vertices view with the Particle Editor closed, rather than a Pause button in that editor. The original test passed against our fresh package in 37 seconds; 20 consecutive real resize/Escape gestures also kept the editor open, restored the size, and showed Play. Thus no playback product defect was demonstrated. The old test never proves that its coordinate drag started: unchanged data also passes its restoration assertion, and idle Escape can asynchronously close the editor after its immediate visibility check. Deliberately omitting the second mouse-down reproduced the closed-editor result in the original test (12 seconds); the revised test rejects it before Escape (9 seconds). The exact lost-handle timing of the supplied suite was not captured, so this is a demonstrated harness defect, not a claim that a new product playback bug was fixed.
- The revised cancellation step waits for the paused control and uses a real hover to let the visible handle settle before measuring it. It requires a pinned sample and an actually changed size before Escape, captures `out/particle-prototype/escape-cancel.png`, then requires restored data, an open editor, paused playback, and a released sample. No `.focus()` or synthetic product-state changes are used in the committed test.
- Mutation check: temporarily making cancellation resume playback in our disposable packaged chunk makes the revised test fail at `Escape leaves the editor paused` in 9 seconds. The exact original chunk bytes are restored in `finally` before normal verification.

## Verification

- Baseline build and package passed (1,347 verified runtime/assets, 55 locales).
- Browser fixed-port reproduction: original timed out at the diagnostic 15-second limit; revised harness passed in 3 seconds with 4174 occupied.
- Final combined packaged run passed: `particle-prototype` 40 seconds, `module-button-labels.browser` 3 seconds; no renderer errors. Command: `node scripts/run-packaged-tests.mjs default particle-prototype,module-button-labels.browser`. The temporary packaged mutation was verified restored against its original update-manifest SHA-256.
- Supplemental diagnostics hit unrelated later distance/transport timing failures; a run against the other checkout's package lost its app process later in the workflow. Those are not claimed as passing runs or product fixes.

## Handoff

Implementation and required packaged verification are complete. Push/open the PR into `claude/release-0.36.1`; do not merge. Keep only the small report and the supplied-failure / successful-Escape screenshots after verification; remove the disposable checkout and its junction after pushing. No excluded feature files or product code were changed.
