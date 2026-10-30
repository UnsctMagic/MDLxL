# AI chat loop fixes

Status: active
Owner / consolidator: Codex
Updated: 2026-10-30

## Goal and completion criteria

Fix the five failures from the owner's 0.35.0 chat in the existing chat and Undo flow. Add no limits, UI or release changes. One regression and commit per bug, source/baseline and hidden packaged checks, then push and open a PR without merging.

## Revision and local state

- Branch / checkout: `codex/ai-chat-loop-fixes`; `D:\Codex\mdlxl-ai-chat-loops`.
- Base / checked revision: `d1dc4ffe` from origin/main.
- Required local fixtures: the supplied chat and Codex rollout are read-only inputs. The supplied model is copied to `out/owner-model.mdx` before use. Only anonymised prompt/evidence excerpts enter `test/fixtures/ai-chat-loop-turns.json`.

## Relevant owners

- `electron/ai-service.cjs`: task completion, outside check, tool IPC and Stop.
- `app/ai-editor.js`, `src/ai-model.js`: renderer tool queue and captured targets.
- `app/ai-review.js`: existing review completion path.
- `src/ai-tools.js`: general editing instructions.

## Findings and decisions

1. Outside check: supplied transcript turns 26–32 repeatedly report missing baseline/wireframe comparisons. Only lastInspect was forwarded; user references and other captures were absent. Keep the existing 12-picture budget and whole comparison groups; missing evidence is advisory. Remove forced blocking after outside-check rounds.
2. Delivery: turn 33 explicitly accepts delivery; turn 34 only describes the unsaved edit, without completing the existing blocked review. Explicit acceptance must complete that review and retain concerns in the reply; it does not imply overwriting the source file.
3. Hangs: the first display sequence stalls after leaving the model tab. Renderer queued operations can outlive tool cancellation and hold later calls. Turn 35 reaches Codex at 00:56:51 UTC; the supplied rollout ends there without an abort reason. Current send creates fresh controllers and the IPC timeout already owns a separate controller; do not claim stale reuse is proven.
4. Target: turn 7 is steering, after view changes at revision 308; the edit then reports stale model/selection. Inspect target bookkeeping and selection-signature fields before relaxing any guard. Preserve refusal for actual user edits/selections.
5. Quality: turns 19–21 show rejected shape/texture changes; turn 27 points to an owner-made bottom-right weld example in visible geoset 1, and turn 35 reports the bottom was missed. Add a general structural rule: read/sample the example, transfer its pattern over the requested scope, preserve silhouette and texture appearance when asked to keep the look.

## Changes and verification

- Bug 1 implemented: keep user references and worker captures, send original/edited pairs before optional views, preserve the existing 12-picture budget, classify evidence omissions as notes, and remove the outside-round forced block. Both new owner replay regressions failed before the patch; workflow and picture tests now pass (32 tests).
- Bug 2 implemented: explicit delivery in direct, Offload and steering completes through review finish; existing concerns stay in the reply. Acceptance makes no new model edit/provider call and does not silently overwrite a source. Three acceptance regressions failed before the patch. Workflow, picture and Offload tests pass.
- Bug 3 implemented: showAllGeosets/clearDisplay are display-only, so their failure cannot become an unresolved model edit. In a background tab they return a tool error with the existing capture mechanism instead of waiting for the user to return. Cancelled display calls release the renderer queue, and late replies cannot adopt a user change. IPC settlement is idempotent. Three new regressions failed before the patch; fresh-after-Stop already passed. The fake native CLI also receives the accelerated existing timeout, continues reading, and completes two consecutive turns with neither parent signal aborted.
- Baseline full source suite at d1dc4ffe: 2353 pass, 27 fail, 23 skip; compare these failures after the patch.

## Blockers and next action

- Implement and verify the five fixes; open the requested PR. No merge or release-note edits authorised.
