# AI credit fixes (audit #1–#4)

Status: ready for review
Owner / consolidator: Claude Code (`local_cec22511-34ed-43a0-b4f7-23afdf4f168e`)
Updated: 2026-10-29

## Goal and completion criteria

- Fix the first four issues of the 29 Oct 2026 AI integration audit
  (claude.ai artifact `E65MvD4BGSnDJvfKeMYxfo`): context snapshot repeated every
  message (#1), handover at half of 1M windows (#2), AI-written handover note (#3),
  "Keep a summary" blind on Codex/Claude Code (#4).
- Proof without paid AI runs: the local counting fixture in `test/ai-offload.test.js`.
- Out of scope: audit issues #5–#19; no new settings or user-facing limits.

## Revision and local state

- Branch / checkout: `claude/ai-credit-fixes-5f0bc4` (worktree `.claude/worktrees/ai-credit-fixes-5f0bc4`)
- Base / checked revision: `fe46a534` (main); PR into `main`
- Uncommitted changes: none after the PR commit
- Required local fixtures/artifacts: none

## Relevant owners

- `electron/ai-service.cjs`: `contextText` (#1), `sizeHandover` and the retire
  branch in `runWorker` (#3), `memoryNote` (#4).
- `electron/ai-offload.cjs`: `HANDOVER_TOKENS`, `handoverAt`, `contextUse`,
  `RETIRE_AT` (#2). Both checkpoint triggers (`measureUsage`, the
  `mdlxl_job_checkpoint` branch) and the between-jobs retire use `contextUse`.
- `src/ai-tools.js`: system-prompt context sentence; `AI_HANDOVER_PROMPT` removed.
- Guide: [AI hook](../AI-HOOK.md).

## Findings and decisions

- Decision #1: a conversation gets the full snapshot (minus `commands`, which
  `mdlxl_context` still returns) when it has no provider history (`messages`
  empty and no `threadId`) or no recorded `sentContext`. Later prompts send
  `target`, `documentId`, `revision`, `selection`, `frame`, `sequence`,
  `annotations`, `region` plus changed fields (per-field SHA-1 fingerprints in
  `conversation.sentContext`); removed fields are sent as `null`. Resume clears
  history, so it gets the full snapshot again; a handover is a new bird.
- Decision #2: `contextUse` is now progress toward the handover point
  (`used / min(200000, window/2)`), `RETIRE_AT = 1`. Estimated use without a
  reported window keeps the old 100K estimate. The OpenAI route's fixed 128K
  window is unchanged (64K handover, as before).
- Decision #3: note = saved task state (`checkpointNote`), the bird's last job and
  its last report from the transcript. The diary is not repeated: `runTask`
  already gives every new bird the diary.
- Decision #4: the stored ledger (requests + `Bird: report` entries, newest 24K
  chars) and `diaryText` go into the memory prompt for Codex/Claude Code when the
  organiser has no thread. Chosen over a local note because the AI still condenses
  to a short note that folds in the previous one; a local note would be raw
  reports that grow every save. API routes already send the ledger as history, so
  it is not repeated there.

## Changes and verification

- Fixture numbers (local fake provider, no paid AI):
  - Context per message to the same bird: 16.6K chars before → 10.3K first, ~0.26K later.
  - Handover between jobs: 1 extra tools-off request before → 0.
  - 18-message fixture with a changing 24K payload: Offload on 608K proxy tokens vs off 1.19M, 18 calls, 1 handover.
  - Handover at 200,000 tokens on a 1M window (199,999 stays); 64K on a 128K window.
  - Summary prompt for Codex/Claude Code contains the bird reports and diary.
- Checks: `node --test test/ai-*.test.js` (190 pass), `pnpm test` (pass),
  full source suite against `.github/known-test-failures.txt` (see PR).
- Remaining: not tried with a real provider (owner rule: no paid runs). Packaged
  `test:packaged` not run.

## Blockers and next action

- Awaiting owner review and merge approval.
- On completion: remove this row from the index and the worktree.
