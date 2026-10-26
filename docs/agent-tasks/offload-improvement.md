# Offload Mode (birds): keep the benefit, remove the overhead

Status: completed — merged to main in PR #322 (`2dc0c52c`); Offload console controls got shortcut keys in the follow-up handbook-hotkey PR
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

## Expansion: several birds editing one model at once (owner requested)

Do this after the overhead work above is done and measured; it builds on it.

Today one model has one working bird at a time (`workerLocks` in `runWorker`;
`send` refuses a second task on the same document; the organiser prompt says
"Workers edit one at a time"). The owner wants a large job split across birds
that edit **separate parts of the same model at the same time**, when that is
safe, and one after another when it is not.

### Requirements

1. **Each parallel bird owns a declared region.** Before it starts, a job states
   the part of the model it may change: model paths in the existing scope format
   (`/Geosets/<i>`, node collections and ObjectIds, material/texture records,
   sequence or global-sequence time ranges for tracks). Two jobs run in parallel
   only if their regions cannot overlap, including indirect dependencies: shared
   materials, textures, matrix groups referencing the same bones, parent/child
   nodes whose motion one job changes, shared global sequences, counts and IDs
   that a structural edit renumbers. If it cannot be proven disjoint, run in sequence.
2. **Edits outside the region are refused.** The edit path rejects any change by a
   bird outside its declared region (extend the existing script/patch scope and
   `protectedPaths` checks), so a parallel bird can never overwrite another's work.
3. **Structural edits are exclusive.** Anything that renumbers or reorders shared
   tables (adding/deleting geosets, nodes, materials, sequences; changing group
   tables used by other regions) takes the whole model: it waits for running birds
   and blocks new ones until it is done.
4. **Staleness per region.** Today another change to the model makes a task's
   captured target stale. A parallel bird's target stays valid when other birds
   change only other regions; it becomes stale only when its own region or a
   dependency of it changed.
5. **Verification per bird and together.** Each bird's `mdlxl_review` checks its
   own requested result and that nothing outside its region changed. When the
   parallel jobs finish, run one combined check of the whole model (positions in
   posed frames where regions meet, seams between regions, validation, save and
   reopen) before reporting the job done.
6. **Undo stays understandable.** Each bird's edits are separate, labelled Undo
   steps on the model's history. Undoing one bird's step must not undo or corrupt
   another's; if the history cannot guarantee that, say so and keep it sequential.
7. **The user sees it plainly.** The existing bird rows show which birds work at the
   same time and on what. No new panel. Steering goes to the bird the user
   addresses; a message for "the job" goes to the organiser's routing.
8. **Splitting the job.** The organiser (or the routing step from Design 2) splits
   a request into region jobs only when the parts are independent; otherwise one
   bird. Keep this cheap: the split decision reads the roster, the user's text and
   the model's structure summary, not the full history or images.
9. **Read-only work is always parallel-safe.** Inspection, sampling, captures and
   help lookups by several birds may run at once without regions.
10. **No forced cap.** Do not impose a limit on parallel birds. Show the cost per
    bird as in Design 6 so the user sees what parallel work spends. A maximum may
    exist only as an optional setting, off by default, and only after the owner
    approves it.

### Verification for the expansion

- Counting fixture tests: two jobs with disjoint regions run concurrently and both
  apply; overlapping or dependent regions fall back to sequence; an edit outside a
  bird's region is refused; a structural edit waits for running birds; a bird's
  target stays valid after another region changes and goes stale after its own does;
  each bird's Undo step is independent; the combined final check runs.
- A long multi-part job compared three ways: Offload off, birds in sequence, birds
  in parallel. Report wall-clock time, calls, tokens and the final review result.
- Packaged run on the hidden desktop with two birds editing different geosets of a
  real model at the same time, checking the result visually and through save/reopen.

## Expansion: lighter models for simple jobs (owner requested)

The organiser may give a simple job to a lighter, cheaper model when the user
allows it and the provider offers one. Strong reasoning is needed for spatial
work (shape, binding, deformation, retargeting, animation feel); many jobs are
not that (renames, recolours, flags, exact numeric values, visibility windows,
sequence metadata, reading or reporting), and a lighter model does them as well
for far less.

1. **The user decides.** An "Allow lighter models for simple jobs" setting, off by
   default, in the existing AI connection settings. Off means every bird uses the
   chosen model, as today.
2. **Only when available.** Offer the setting only when the current connection has
   a lighter model to use: the Claude API model list, Claude Code's model aliases,
   or a Codex model the user's account supports. The user picks which lighter
   model, or MDLxL suggests the provider's smallest current one. No setting where
   the provider has no choice.
3. **Simple jobs go automatically.** With the setting on, the routing step marks a
   job simple when it changes values the user named exactly, or only reads and
   reports, and needs no spatial judgement. Those go to the lighter model. Mark it
   on the bird row ("light model") and in its cost line.
4. **Anything else asks first.** For a job that is not clearly simple, the organiser
   asks the user before using the lighter model and says plainly that it can lower
   the quality of the result on this kind of edit. Without a yes, the job uses the
   chosen model. The answer applies to that job only.
5. **Escalate on failure.** If a lighter-model bird's review fails or it reports it
   could not finish, hand the job to the chosen model with a handover note instead
   of retrying with the lighter one. Count and show it.
6. **One model per bird.** A bird keeps its model for its whole job, so its history
   and reasoning stay consistent. A follow-up that turns complex goes to a
   chosen-model bird with a handover note.
7. **Verification.** Fixture tests: setting off sends everything to the chosen
   model; setting on sends a simple job to the lighter model with no question; a
   complex job produces the question and waits; a failed review escalates once;
   providers without a lighter model show no setting. Report the cost difference
   on a mixed session of simple and complex jobs.

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

## Overhead measurements and decision (26 October 2026)

The owner chose a settings preference: Manual, Automatic, or Both. Manual is the
default. Continue and addressed messages go straight to a bird; New job and Tiny
job are explicit composer destinations. Automatic makes one tool-free routing
request for unaddressed messages with an existing roster. Its prompt contains
only text and the roster. There is no recap request. The bird report is expanded
once in the existing row, and its text is stored in organiser memory locally.

Baseline source is main 9ddb2838 (the task branch only added documentation).
The local compatible-provider fixture counts actual HTTP requests. Input tokens
below are ceil(serialized messages + tool schemas characters / 4), excluding
image payloads. The long case adds 24,000 synthetic context characters per turn;
its reported proxy usage triggers the real half-context handover. These are
repeatable control-flow measurements, not paid model billing or quality trials.

| Scenario | Offload off calls / input proxy | Before calls / input proxy | After Manual calls / input proxy |
| --- | ---: | ---: | ---: |
| One message, one job | 1 / 5,840 | 3 / 7,815 | 1 / 5,822 |
| Five messages, two jobs | 5 / 30,331 | 15 / 45,245 | 5 / 29,589 |
| 18 messages, two jobs | 18 / 1,151,527 | 55 / 2,819,224 | 19 / 632,206 |

The long Manual run has 18 working calls plus one required handover; it saves
45.1% of the Offload-off input proxy, but does NOT satisfy a literal requirement
for fewer calls than Offload off. The extra handover is counted, not hidden.
The one-message image formerly appeared in three provider requests (two
organiser, one bird); it now appears only in the bird request. SD Brain remains
parked; its optional art-direction policy and the handbook are preserved.

Recommendation: retain Offload on by default with Manual routing. Automatic
routing trades an extra small call for convenience and cannot promise the same
per-message call count. Native Codex counters label provider turns, not internal
model requests; unavailable token totals stay unavailable.

Verification: 57 compatibility tests passed; full source suite 1,965 passed,
22 skipped, no failures; focused AI suite 31 passed including counting fixtures.
The hidden packaged console test passed. The old missing bird row was caused by
reloading the old-provider organiser before saving the new connection. Saving a
provider now resets the organiser and sending resolves the current chat. The
packaged test also now waits for the bird transcript rather than matching the
same report still visible in the organiser view. No paid AI was used.

## Next action

The owner requested a manual handoff for updating this feature branch with current
main. Do not merge PR #322. The dry integration against main 528f5edf finds two
conflicts: retain main's chat-model hotkey attribute with this branch's pinned-model
tooltip in app/AiAssistant.jsx, and retain all current task rows in this index.
Keep main's AI console idle/playback performance changes. Rerun relevant checks,
push this same branch, and leave the PR unmerged. All implementation work below
is committed on claude/offload-task; no paid AI trials were used.


## Parallel milestone (26 October 2026)

The internal region bridge derives dependencies from the actual model. Disjoint
writers share unchanged read dependencies; writes to dependencies wait. Read-only
work bypasses the write queue. Every script/patch commit is checked, merged as a
delta into the latest model, and labelled with its bird in ordinary chronological
Undo. Structural changes run exclusively; changed table layouts require fresh
assignments rather than guessing old indices. Existing rows show region and cost.

Individual reviews use region fingerprints. The combined review checks the
union of scopes, shared boundary positions in bind/sequence/global frames, and
MDX/MDL save/reopen. It does not establish Warcraft III or artistic acceptance.
Interrupted multi-part jobs keep edits and bird checkpoints, but require a new
assignment of remaining work; resuming just the last bird cannot complete a batch.

Local six-part inspection fixture (30 ms response delay; 32,000-character tool
results; input tokens are serialized request size / 4):

| Mode | Wall time | Calls | Input proxy | Final review |
| --- | ---: | ---: | ---: | --- |
| Offload off | 318 ms | 7 | 210,604 | Unchanged inspection |
| Sequential birds | 588 ms | 13 | 119,436 | Combined fixture passed |
| Parallel birds | 156 ms | 13 | 119,442 | Combined fixture passed |

The scheduler fixture checks concurrent disjoint work, dependent/structural
serialization and combined review. Bridge tests apply real deltas, refuse
out-of-region edits, check region staleness and independent Undo. A hidden
packaged Footman run passed eight checks: two simultaneous writers on geosets
1 and 3 (API indices), per-bird cost, combined review, mouse rotation, both
changes saved and reopened, and no renderer errors. The fixture initially omitted
script edit:true (read-only default); after auditing that mismatch the committed
run passed. Package and disposable profiles were removed.

## Lighter-model milestone (26 October 2026)

The existing connection settings offer Allow lighter models for simple jobs only
when the returned model catalog (or supported Claude aliases) has a lower model
tier. It defaults off; the user selects the offered model. Unknown provider/model
IDs are not invented. The local conservative recognizer accepts factual reads
and explicitly named values; uncertain or spatial wording asks in the composer
and waits for the owner choice. Non-English or unfamiliar wording may therefore
ask unnecessarily, rather than silently downgrade the job.

Each bird pins its model. A failed light review, an inability report, or complex
follow-up/steering transfers once to the chosen model with a local checkpoint
handover; it includes already-applied edits and warns against repeating them.
The old bird retires. Both calls remain visible in cost accounting.

Mixed fixture: six jobs, four simple and two complex, six working calls either
way. With the setting off: 35,210 input-token equivalents on the chosen model.
With it on: 23,471 on the lighter model and 11,739 on the chosen model. Total
tokens do not fall. Under an explicitly illustrative 10:1 per-token fixture
price, cost units fall from 352,100 to 140,861 (60.0%). These are NOT provider
prices or a promise of real dollar savings. No paid AI trials were run.

The combined hidden app test passed 14 checks, including absent/unavailable
setting, default off, actual selected model in requests and rows, complex-job
question with no working call before the answer, and choosing the normal model.
A focused test also verifies complex steering switches models once. Source suite
before current-main integration: 1,977 passed, 22 skipped, zero failures.

## Final verification and limits

Compatibility: 57/57. Full source: 1,978 passed, 22 skipped, zero failures.
Focused AI/region suite: 46/46, including the added unassigned-neighbour seam
regression. Hidden packaged console: 71/71. Hidden parallel/light flow: 14/14
on detached Footman geosets 2 and 3 (API indices), both surviving save/reopen.
A whole-cloth displacement on geoset 1 was correctly refused by the final check
because it separated shared boundary vertices from an unassigned neighbour.

Remaining limits: no paid model quality trials, no Warcraft III runtime check,
conservative local simple-job recognition, and interrupted multi-part batches
need a new assignment of unfinished work. The long overhead fixture has one
extra handover call versus Offload off; the token reduction is measured, but a
literal fewer-calls criterion for that scenario is not met. Current-main merge
was not performed: automatic approval review required explicit permission, and
the owner chose a manual handoff.

## Current-main integration (26 October 2026, Claude Code)

Merged main `528f5edf` (includes #326 console redraw fix, #304 Shredder/hotkeys)
into this branch. Conflicts: `app/AiAssistant.jsx` keeps main's
`data-hotkey="chat-model"` with Offload's tooltip (existing birds keep their
model); `docs/agent-tasks/README.md` keeps all rows. Main's `React.memo`,
`headerKey`/`FrameLabel` and `bridge.subscribe` survive unchanged; Offload adds
no render-time bridge reads, so the memoized console does not go stale.

Fixes made during integration:

- `test/ai-offload.test.js` region-scheduler test was flaky before the merge
  (3/8 failures on `bc397a85`): overlapping birds may start in either order.
  Parallel mode now compares order-free; queued modes keep strict order. 10/10.
- Main's hotkeys gave Escape inside the console to its Close button, so Escape
  with a drawing tool focused closed the console instead of leaving the tool.
  `Hotkeys.jsx` now offers Escape to owners first (`mdlxl-escape-key`, same
  pattern as the showcase/UV/paint key events); the console takes it only while
  a drawing tool is active. Otherwise Escape still closes the console.
- `test/ai-console.electron.cjs` viewport comparisons now wait for Shredder's
  keycap reminder to disappear; it otherwise differs a pixel comparison.

Verification after merge: build ok; compatibility 57/57; full source 1,998
passed, 14 skipped, 0 failed (FFmpeg binaries copied in for the recording
tests); focused `test/ai-*.test.js` 117 passed, 1 skipped. Hidden packaged
(`out/pkg-ai`, Footman fixture): ai-console 71/71, ai-parallel 14/14,
shredder pass. No paid AI trials.

Known outside this task: packaged `test/ai-hotkeys.electron.cjs` fails on main
too, because main's Editing handbook switch has no `data-hotkey`. Not changed
here, since assigning it a key may shift the hand-picked console keys.
