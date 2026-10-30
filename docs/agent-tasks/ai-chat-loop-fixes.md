# AI chat loop fixes

Status: original fixes and context diet merged in #427 / #430; deterministic steering test ready for review, awaiting merge approval
Owner / consolidator: Codex
Updated: 2026-10-30

## Goal and completion criteria

Fix the five failures from the owner's 0.35.0 chat in the existing chat and Undo flow. Add no limits, UI or release changes. One regression and commit per bug, source/baseline and hidden packaged checks, then push and open a PR without merging.

## Revision and local state

- Original fixes: `codex/ai-chat-loop-fixes`; PR [#427](https://github.com/UnsctMagic/MDLxL/pull/427) merged at `9f4e079b`. Its disposable checkout was removed after push.
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

- Original result: the five fixes merged through PR #427 at `9f4e079b`, and context diet through #430 at `56fb26c8`. The test follow-up below is separate and must remain unmerged until authorised.
- Cleanup: remove disposable packages, profiles, baseline and task worktrees after pushing; retain the small local result report. The branch and all source changes remain in Git/GitHub.


## Follow-up: AI context diet

Status: merged externally in [#430](https://github.com/UnsctMagic/MDLxL/pull/430) at `56fb26c8`. Checks below record the earlier branch state; the final PR description records all five hidden checks passing after main's harness audit landed.

- Branch / checkout: `codex/ai-context-diet`; `D:\Codex\mdlxl-ai-context-diet`.
- Started at first PR [#427](https://github.com/UnsctMagic/MDLxL/pull/427), tip `f1b0a923`. After #427 merged during this work, rebased onto `origin/main` at `9f4e079b` (same code tree as the starting tip). Then preserved the separately merged real-use grading harness in #428 by rebasing onto `de508bc2`. The second PR targets main; the original five fixes stay in their own PR.
- Goal: send the snapshot once per worker/conversation, then actual changes; keep user words first, pass only task-relevant model diary entries, preserve on-demand full context and necessary IDs. No new settings, UI or user-facing limits.
- Verified source: a partial diff already existed at the base. It repeated selection/frame/annotations even when unchanged, did not invalidate its cursor at compaction or model replacement, and nudges used the original captured state. `runWorker` prefixed the job label, while steering prefixed an explanation. The diary sent eight recent entries in chronological order without task relevance.
- Evidence: three complete user payloads in the supplied read-only rollout (ordinals 11, 66, 77), anonymised in `test/fixtures/ai-context-helmet.json`; original byte counts are metadata. These are recorded message sizes, not an estimate of all API history retransmitted by a stateless provider. The recorded context has 37 sections including commands; the replay stores common fields once and leaves command data out because both formatters reserve it for `mdlxl_context`.
- Decisions: target always travels; other sections travel only when changed, removed fields are explicit nulls. Reset/compaction/model replacement starts a full snapshot again. Editor tool results refresh the worker state; an on-demand full context becomes its comparison baseline. User words lead job messages, Resume, nudges and steering under separate context/update/diary headings.
- Diary: existing 40-entry storage is unchanged. Keep all stored entries with the organiser (no diary read tool exists). Workers receive the closest task-word matches, touched parts and a directly continued prior task, newest first; equally relevant entries are not cut at a fixed count. The current owner's reply is never used to manufacture a relevance match for the previous job.
- Prompt change: only the first sentence/rule of `AI_EDITING_BODY` changes to explain omission semantics and reset cases. Deliberate hashes cover all direct/worker handbook/web combinations; removing this replacement and the already-approved example rule restores the original hashes. Router and all other static prompt text remain unchanged.
- Regression evidence: three new regressions failed before editing. Added coverage also checks on-demand context reads, history reset, model replacement, compaction, current geoset/bone IDs, latest-word nudges and steering delivered after an edit. Selected node ObjectIds remain distinct from Bones array indices. A fake native CLI also reproduces rejected steering/injection delivery: this invalidates the context baseline and the late follow-up carries the current full snapshot. That regression failed before the delivery-reset patch; private reset bookkeeping stays out of the visible transcript.
- Replay sizes (UTF-8 bytes per new message, ordinals 11/66/77): recorded 34732 / 29847 / 29900; first-PR formatter 19530 / 17700 / 17753; context diet 7801 / 4265 / 3670. The two follow-ups are 78% smaller than the first-PR formatter and 87% smaller than the older actual payloads. The baseline formatter is replayed from `f1b0a923`, not estimated from a claimed 22 KB snapshot.
- Source verification: `npx vite build` passed; `node --test test/ai-*.test.js`: 266 passed, 1 skipped; `node --test test/*.test.js`: 2416 passed, 23 skipped (the first-PR baseline was 2396/23; #428 adds eleven unchanged grading tests, this PR adds nine regressions; no new failures); compatibility suite all 57 passed. Prompt hashes restore every earlier byte after reversing only the documented context-rule replacement and the first PR's example rule.
- Package verified 1332 runtime/assets and 55 locales. Hidden `node scripts/run-packaged-tests.mjs default ai-console,ai-routing,ai-questions,ai-editor,ai-parallel`: routing, questions and parallel passed. Console verified user-first steering, model edits, captures and task cleanup before reaching the same pre-existing reference-tab assertion as #427; editor stopped at the same fake native sign-in launcher as that baseline. These two checks are not claimed as passing. The console assertion was updated to require delivery with user words first, replacing only its deliberate old-prefix expectation.
- Result: push the separate `codex/ai-context-diet` branch and PR into main; do not merge. The same note covers both tasks. No installed app/profile, model source, release version, release note, user-facing setting or limit changed. Original chat/rollout were read-only evidence.
- Verification revision: `6a0128c4` on base `de508bc2`; the final amendment only records results. The first PR and new main harness are preserved. Remove task-created builds/profiles and the pushed disposable worktree; retain the small result report.


## Follow-up: deterministic native steering regression

Status: ready for review; awaiting merge approval.

- Branch / base: `codex/ai-context-diet-flake`, cut from current `origin/main` at `a544fe9c` (2026-10-30).
- Evidence: PR #433 CI run [40994272961](https://github.com/UnsctMagic/MDLxL/actions/runs/40994272961), first-attempt job `123863637023`, failed the native steering test in 431.684 ms with `2 !== 1` at the reset-count assertion; the rerun passed.
- Cause: the fixture's READY output can arrive before `turn/start` resumes. Queuing steering inline can leave both its subscription callback and the provider's initial queue check scheduled. After the first rejected delivery restores the message, the second callback can retry it and produce a second reset.
- Decision: observe the existing initial `AiSteering.take()` check with a test-scoped mock, then queue steering only after that check and READY have both occurred. Await the actual `context-reset` delivery-failure event before checking the late follow-up. No sleeps, elapsed-time assumptions, provider changes or relaxed assertions.
- Verification: `node --test test/ai-context-native.test.js` passed 30 consecutive fresh-process runs; `node --test test/ai-*.test.js` passed 273 tests, 1 skipped, 0 failed. Every original assertion is byte-identical; the fake CLI still requires the full snapshot and revision 2. No app or packaged build is needed for this test-only change.
- Result: push this narrow follow-up and open a separate PR; do not merge. Keep the small report, remove disposable profiles/logs and the finished worktree after push.
