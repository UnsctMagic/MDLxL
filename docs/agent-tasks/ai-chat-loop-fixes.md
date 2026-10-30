# AI chat loop fixes

Status: completed (implementation ready to test; PR not merged)
Owner / consolidator: Codex
Updated: 2026-10-30

## Goal and completion criteria

Fix the five failures from the owner's 0.35.0 chat in the existing chat and Undo flow. Add no limits, UI or release changes. One regression and commit per bug, source/baseline and hidden packaged checks, then push and open a PR without merging.

## Revision and local state

- Branch / checkout: `codex/ai-chat-loop-fixes`; `D:\Codex\mdlxl-ai-chat-loops`.
- Base / checked revision: `d1dc4ffe` from origin/main (unchanged at final fetch). Five commits, one per bug, on this PR branch. Final documentation amendment does not change tested code.
- Required local fixtures: the supplied chat and Codex rollout are read-only inputs. The supplied model is copied to `out/owner-model.mdx` before use. Only anonymised prompt/evidence excerpts enter `test/fixtures/ai-chat-loop-turns.json`.

## Relevant owners

- `electron/ai-service.cjs`: task completion, outside check, tool IPC and Stop.
- `app/ai-editor.js`, `src/ai-model.js`: renderer tool queue and captured targets.
- `app/ai-review.js`: existing review completion path.
- `src/ai-tools.js`: general editing instructions.

## Findings and decisions

1. Outside check: supplied transcript turns 26–32 repeatedly report missing baseline/wireframe comparisons. Only lastInspect was forwarded; user references and other captures were absent. Keep the existing 12-picture budget and whole comparison groups; missing evidence is advisory. Remove forced blocking after outside-check rounds.
2. Delivery: turn 33 explicitly accepts delivery; turn 34 only describes the unsaved edit, without completing the existing blocked review. Explicit acceptance must complete that review and retain concerns in the reply; it does not imply overwriting the source file.
3. Hangs: the first display sequence stalls after leaving the model tab. Renderer queued operations can outlive tool cancellation and hold later calls. Turn 35 reaches Codex at 00:56:51 UTC; the supplied rollout ends there without an abort reason. Current send creates fresh controllers and the IPC timeout already owns a separate controller. That reply is emitted only when the top-level task was aborted through Stop/closing; the rollout does not record which cancellation event occurred. Stale controller reuse is not supported by the current call path.
4. Target: turn 7 is steering, after view changes at revision 308; the edit then reports stale model/selection. The guard also fingerprints the whole timeline selection context, including its controller even when no key/range is selected. Mounting that empty context changes the signature without a user selection. Separately, advance refreshed only the operation token, leaving a follow-up captured during its own AI commit stale. Both mechanisms are reproduced; the supplied turn does not retain the full signature, so its exact differing field is not recoverable. Normalise empty timeline selection and advance only same-chat tokens matching the exact pre-AI state. Preserve refusal for actual user edits/selections.
5. Quality: turns 19–21 show rejected shape/texture changes; turn 27 points to an owner-made bottom-right weld example in visible geoset 1, and turn 35 reports the bottom was missed. Add a general structural rule: read/sample the example, transfer its pattern over the requested scope, preserve silhouette and texture appearance when asked to keep the look.

## Changes and verification

- Bug 1 implemented: keep user references and worker captures, send original/edited pairs before optional views, preserve the existing 12-picture budget, classify evidence omissions as notes, and remove the outside-round forced block. Both new owner replay regressions failed before the patch; workflow and picture tests now pass (32 tests).
- Bug 2 implemented: explicit delivery in direct, Offload and steering completes through review finish; existing concerns stay in the reply. Acceptance makes no new model edit/provider call and does not silently overwrite a source. Three acceptance regressions failed before the patch. Workflow, picture and Offload tests pass.
- Bug 3 implemented: showAllGeosets/clearDisplay are display-only, so their failure cannot become an unresolved model edit. In a background tab they return a tool error with the existing capture mechanism instead of waiting for the user to return. Cancelled display calls release the renderer queue, and late replies cannot adopt a user change. IPC settlement is idempotent. Three new regressions failed before the patch; fresh-after-Stop already passed. The fake native CLI also receives the accelerated existing timeout, continues reading, and completes two consecutive turns with neither parent signal aborted.
- Bug 4 implemented: empty timeline controller changes no longer invalidate selection; a follow-up captured during the AI commit advances to that AI result only when its previous revision and selection match exactly. Both regressions failed before the patch. Real user model edits, vertex selection and key/range changes remain guarded.
- Bug 5 implemented: one general structural rule tells direct and worker agents to read/sample the owner example first, transfer its pattern over the whole requested scope, and preserve silhouette and texture appearance when keeping the look. The prompt regression failed before the patch; new hashes are deliberate, and removing only the new sentence restores every previous editing/worker prompt hash. Router remains byte-identical.
- `npx vite build`: passed (existing bundle-size warnings).
- `node --test test/ai-*.test.js`: 246 passed, 1 skipped, 0 failed.
- `node --test test/*.test.js`: 2396 passed, 23 skipped, 0 failed. Clean baseline with the same build/FFmpeg/temp preparation: 2380 passed, 23 skipped, 0 failed. The first unprepared baseline had 27 fixture/asset failures; these disappeared when the required files and CommonJS scratch scope were prepared. No failure allowlist changed.
- `node --test tests/*.test.js`: all 57 passed.
- `node scripts/package.mjs --out out/pkg`: verified 1332 runtime/asset files and 55 locales against pinned FFmpeg provenance; final code rebuilt and repackaged after the target correction.
- Hidden `node scripts/run-packaged-tests.mjs default ai-console,ai-routing,ai-questions,ai-editor,ai-parallel`: routing, questions and parallel passed. Console and editor failed identically on a separately built clean baseline. Console expects an attached reference to create an editor tab, contrary to the current AI-only-reference contract; editor's fake native launcher uses an unsupported spelling before sign-in can run. No tracked test was weakened or unrelated product code changed.
- Additional hidden editor diagnostic: correcting the disposable launcher's spelling/CommonJS scope moved past sign-in; the existing canvas-click step then timed out because the view-orientation compass intercepted it. This was not a passing packaged editor acceptance run.
- Live-provider helmet replays: not run. No separate signed-in disposable Codex test profile was located in the available test workspaces. The supplied owner profile stayed read-only; it was not used to refresh or copy sign-in material.
- Remaining acceptance: the owner's real helmet workflow and artistic quality are ready to test. The supplied chat does not preserve the exact signature field behind turn 7 or the initiating abort behind turn 35; the reproduced source defects and those evidence limits are distinguished above.
- Preserved: existing console/UI, source models, real profile, Undo and real-user target guards. No version, release-note, installed-app or release changes.

## Blockers and next action

- Result: the five changes and regressions are ready for owner testing; push and PR handoff into main. Do not merge. Release inclusion is left to the 0.36.0 release PR if still open, otherwise the next release.
- Cleanup: remove disposable packages, profiles, baseline and task worktrees after pushing; retain the small local result report. The branch and all source changes remain in Git/GitHub.
