# Offload Mode (birds): keep the benefit, remove the overhead

Status: ready for Codex to start
Owner / consolidator: Codex (written by Claude Code after reviewing the current design with the owner)
Updated: 26 October 2026

## Goal and completion criteria

Offload Mode should be worth switching on: cheaper or equal in compute to working
without it, with better results on long sessions. The owner reports it is
sometimes more wasteful than helpful and that it double-messages: a request
meant for a bird passes through the organiser, which spends a model call on it,
and the organiser then repeats the bird's report.

Done when:

1. A follow-up to an existing bird reaches that bird **without any organiser
   model call**: the app forwards the user's exact message, selection, drawings
   and images itself.
2. A new job costs **at most one small routing call**, or none when the target is
   already clear (see Design).
3. The bird's report reaches the user **once**. No organiser call exists just to
   restate it.
4. Images, drawings and the captured context are sent **only to the AI that
   does the work**, not also to the organiser.
5. The benefits stay: a separate memory per job, handover before a bird's memory
   fills, a tiny-jobs bird, bird names, steering forwarded to the working bird,
   save cleanup and memory note, one job per model at a time.
6. Measured proof (see Verification) shows calls and tokens per user message with
   Offload on are at or below Offload off for single jobs, and lower for long
   multi-job sessions.

## What is wasteful today (verified in code at main 9ddb2838)

- Every message in the organiser view runs a full organiser task
  (`AiService.runTask` with `organiser` set): one model call to choose
  `mdlxl_worker`, and after the bird finishes a second call that summarises the
  report (`AI_ORGANISER_PROMPT` asks for a short recap). That is two extra calls
  per message, each carrying the organiser system prompt, its growing history,
  the roster briefing (`organiserBriefing`) and the full captured context JSON.
- Images go to both. `runTask` gives the organiser the user's images, then
  `runWorker` passes the same images to the bird (`workerImages`). The captured
  context is in both prompts as well.
- The bird receives `Job` + `Instructions from the organiser` + the user's exact
  message. The organiser's instructions mostly paraphrase that message.
- The user sees the bird's report in the bird row, then the organiser's recap of it.
- Birds work one at a time per model (`workerLocks`), so there is no speed gain
  to offset the overhead.
- Already good and to keep: opening a bird's own chat and sending there goes
  straight to that bird (`send` with the worker id, no organiser); handover at
  `RETIRE_AT` 0.5; the registry, cleanup and naming code in `electron/ai-offload.cjs`.

## Design (Codex may improve it; keep the owner's two rules)

Rules from the owner: no organiser compute for a message meant for a bird, and as
little organiser compute as possible overall.

1. **Route without a model where the target is known.** In the organiser view, a
   message continues the bird whose job is current (the last bird that worked, or
   the one the user is replying to) unless the user starts a new job. The app
   forwards the message verbatim, with images and context, to that bird.
2. **Starting a new job.** Decide with the owner how the user signals it, before
   building UI. Options: an explicit "new job" action in the existing composer;
   a single cheap routing call (roster + the user's text only, no history, no
   images, no context, smallest available model of the provider) that answers
   "continue <bird>" or "new job: <title>"; or both. Any new control must follow
   AGENTS.md: small, in the existing composer or bird row, no new panel.
3. **No recap call.** Show the bird's report as the reply. Append the report to
   the organiser's memory as data (for routing and the save memory note) without
   a model call.
4. **The bird gets the user's words directly**, plus a one-line job title. Drop the
   paraphrased organiser instructions; keep the handover note and SD Brain /
   editing-handbook policy the bird already inherits.
5. **Organiser model calls remain only where they add value:** the memory note at
   save, explaining the roster when the user asks about the birds, and answering
   how-to questions with `mdlxl_help` when no bird is needed (or route those to
   the tiny-jobs bird; choose the cheaper).
6. **Make the cost visible.** Record calls and tokens per role (organiser, router,
   bird) on each reply, so the switch's value can be judged. No new panel: the
   existing per-reply cost line can carry it.

Also put to the owner: Offload Mode is on by default today. Recommend whether it
should stay on by default after this change, with the measurements behind it.

## Relevant owners

- `electron/ai-service.cjs`: `send`, `runTask` (organiser branch, `mdlxl_worker`
  call), `organiserBriefing`, `pendingBird`, `runWorker`, `handover`,
  `retireWorker`, `memoryNote`/cleanup, `setOffload`.
- `electron/ai-offload.cjs`: `AiSteering` (forwarding), `AiRecorder` (worker rows,
  `report()`), `OrganiserRegistry`, `nextBird`, `RETIRE_AT`, `contextUse`.
- `src/ai-tools.js`: `AI_WORKER_TOOL`, `AI_ORGANISER_PROMPT`, `AI_WORKER_NOTE`,
  `AI_HANDOVER_PROMPT`, `AI_MEMORY_PROMPT`.
- `app/AiAssistant.jsx`: organiser and bird views, worker rows, composer.
- Docs: `docs/AI-HOOK.md` (Offload Mode section). Tests: `test/ai-offload.test.js`,
  `test/ai-workflow.test.js`, packaged `test/ai-console.electron.cjs`.
- Known before this task: the packaged `ai-console` test fails on main at
  waiting for `.ai-worker-row` (it passed on 0.32.1). Find out why as part of this
  work; it is in the code this task changes.

## Verification

- Extend `test/ai-offload.test.js` with a fixture provider that counts requests,
  tokens (prompt size as a proxy) and images per request, by role:
  - follow-up to an existing bird: 0 organiser requests;
  - new job: at most 1 routing request, with no images and no context;
  - a reply shows the bird's report once; the organiser history gets the report
    without a model call;
  - images reach only the bird;
  - handover, tiny jobs, steering, save memory note and cleanup still pass.
- Compare Offload on vs off for: one job; a five-message session over two jobs;
  a long session that triggers a handover. Report the numbers in this note.
- `pnpm test`, `pnpm run test:source`, focused AI tests; packaged `ai-console`
  on the hidden desktop (scripts/hidden-run.ps1), fixing the existing failure.
- No paid AI trials unless the owner approves them.

## Revision and local state

- Branch: `claude/offload-task` from main `9ddb2838`. Continue this branch and
  its PR; do not create a competing note.
- Uncommitted changes: none.

## Next action

Read the owners above, confirm the waste with a counting test on main, then show
the owner the routing choice for new jobs (Design 2) and the measured
before-numbers before building.
