# Remove Offload Mode (the AI birds)

Status: contract written; implementation not started
Owner / consolidator: Codex (implementation), Claude Code (contract)
Updated: 2026-11-01

## Goal and completion criteria

The owner decided to remove Offload Mode entirely. In 72 real A/B runs it gave no
quality gain, cost about the same or more, was slower on 5 of 6 tasks, and ended
"kept but not verified" six times (never without it). See
[the A/B evidence](#evidence).

Done means:

1. MDLxL's AI always works directly in **one chat per model**: the existing
   per-model chat with "New chat" / "Earlier chat", its diary, memory note,
   outside check, editing handbook, SD Brain (parked), web research switch,
   review gate, checkpoints, steering, questions, recovery and save cleanup all
   keep working exactly as they do today with Offload switched off.
2. **Several model tabs still run AI jobs at the same time.** One job per model,
   jobs on different models in parallel, a job on a hidden tab keeps working,
   and switching tabs shows each model's own chat. This is a hard requirement
   from the owner and needs its own test (see Verification).
3. Everything that exists only for Offload is gone: birds, organiser→worker
   delegation, helper birds, region/parallel jobs, automatic job routing,
   "Tiny job", lighter-model choice and its settings, worker handovers/retirement,
   the bird roster UI, and their prompts, locale strings, CSS and tests.
4. Existing profiles upgrade without loss: old chats that contain bird work stay
   readable, interrupted bird tasks do not try to resume, and cleanup still
   deletes old bird files. No user file, chat or setting outside the removed
   keys is lost.
5. No version bump (not a release). PR into `main`, ready for review.

Out of scope: any new feature, any redesign of the AI window beyond removing the
bird controls, renaming user-visible concepts other than those removed, changing
the direct path's prompts or behaviour, SD Brain revival, the release itself.

## Decisions and constraints

- One way of doing things: the direct per-model chat is the only AI chat. Do not
  add a replacement delegation system or a new setting.
- The "organiser" chat object **is** the direct chat. `organisers.json`
  (`OrganiserRegistry`), `ai:organiser`, `ai:newOrganiser`, `organiser-reset`,
  `markActivity`, `rekey`, `saveState` and the diary/memory note must stay.
  Renaming them is optional; if you rename, migrate saved data and keep reading
  the old names. Prefer not renaming saved keys at all.
- `mdlxl_plan` and `mdlxl_job_checkpoint` are used by the direct path. Keep them;
  remove only the `helper` field / handover branch. (The `helper` field is
  advertised to direct chats today and throws "Only an editing bird can request a
  helper": removing it fixes that mismatch.)
- Keep the outside check, cost/usage display and the `.ai-offload-switch` CSS
  class used by the Handbook / Web / SD Brain switches (rename the class if you
  like, e.g. `.ai-switch`, and update every user).
- Prompt hashes pinned in `test/ai-prompts.test.js` may change only for removed
  prompts. The direct path's system prompt and `AI_EDITING_BODY` must stay
  byte-identical unless a sentence only made sense with birds; list any such
  change in the PR.
- Follow AGENTS.md: smallest change in the existing workflow, preserve profiles,
  no unrelated edits, D: drive only, `codex/` is not used for this task — continue
  this branch, `claude/remove-offload-birds`.

## Map of what to remove (from a read-only survey at f75e407d)

Line numbers are approximate; re-read before editing.

### Delete or empty
- `src/ai-birds.json` (bird names/colours).
- `electron/ai-model-choice.cjs` (`simpleJob`, `lighterModels`; light routing only).
- `src/ai-regions.js` and the `mdlxl_regions` machinery (only used by
  `runRegionJobs`, `runHelper`, `routeJob` and the region target in `send`).
- Tests that only cover birds: `test/ai-routing.electron.cjs`,
  `test/ai-parallel.electron.cjs` (replace with the multi-tab test below),
  `test/ai-organiser-refresh.electron.cjs` (keep whatever part covers the direct
  chat refresh), `test/ai-regions.test.js`.

### Split
- `electron/ai-offload.cjs`: delete `BIRDS`/`CORVIDS`/`nextBird`,
  `HANDOVER_TOKENS`/`handoverAt`/`RETIRE_AT`, `AiSteering.forward`, worker-only
  parts of `AiRecorder.report()`. Keep `AiSteering`, `AiRecorder`,
  `settleParts`/`settleConversation`, `contextUse`, `writeJsonAtomic`,
  `OrganiserRegistry`, `removeFiles`, `deleteProviderSessions` — move them to a
  neutrally named module (e.g. `electron/ai-chat-state.cjs`) and update the
  imports in `ai-service.cjs`, `ai-chats.cjs` and tests.
- `electron/ai-job-plan.cjs`: remove `helperSpec`, `acceptanceChecks`; keep
  `expandRoutine`, `recordFailures`, `checkpointNote`.

### `electron/ai-service.cjs` (largest part, ~600 lines)
- Remove whole methods: `runOffload`, `runRegionJobs`, `routeJob`, `runHelper`,
  `organiserBriefing`, `pendingBird`, `runWorker`, `workerHandover`/`sizeHandover`,
  `retireWorker`/`emitRoster`/`retitleWorker`, `setOffload`, `addressedBird`,
  `lighterChoices`, `this.workerLocks`, `this.random`, IPC `ai:offload`.
- In shared methods remove the Offload branches: `status()` (offload, routing,
  allowLighter, lightModel, lighterModels), `configure()` (routing,
  allowLighter/lightModel — keep `organiser-reset` on provider change),
  `send()` (worker redirect, light/model choice, region target, offload dispatch:
  always `runTask`), `acceptDelivery` (bird owner branch), `measureUsage` (worker
  handover trigger, `organiserId` parent aggregation; roles become direct, art
  direction, outside check), `steer()` (worker forwarding, light escalation,
  parallel routing), `cancel`/`taskOf`/`runningChats` (worker branches),
  `memoryNote` ("bird reports" text), `organiser()` (`workers`, `currentWorker`,
  `offload` fields), `createOrganiser` (`workers`/`birds` seeds), `taskInfo`
  (`regionJobs`).
- `runTask`: about 25 `organiser`/`helperOnly`/`light`/`workerYield`/`canHandover`
  branches sit inside the core edit → review → verify loop. **Riskiest part.**
  Remove them so the code equals today's direct path (offload off). Do it as a
  behaviour-preserving simplification: after each step, the direct-path tests
  must still pass. `artDirection` currently meters as role `'bird'`: rename the
  role to e.g. `'art direction'`.
- `recordFailures` attaches to `result.organiser`: rename the key, keep behaviour.

### Prompts and tools (`src/ai-tools.js`)
Remove `AI_WORKER_TOOL`, `AI_ROUTER_TOOLS_RULE`, `AI_ROUTER_PROMPT`,
`AI_ORGANISER_PROMPT`, `AI_WORKER_NOTE`, `AI_HELPER_NOTE`, `AI_HELPER_TOOLS`,
`aiHelperCanCall`, the `helper` field of `AI_PLAN_TOOL`, the "full bird hands
over" wording in `AI_JOB_CHECKPOINT`, "worker" wording in `AI_OUTSIDE_CHECK`,
"next organiser" in `AI_MEMORY_PROMPT`. Remove the `'organiser'` variant in
`src/ai-sd-rules.js` `sdBrainInstructions`.

### Editor / review (`app/ai-editor.js`, `app/ai-review.js`)
Remove `regions()`, region dispatch and region guards (`checkRegionEdit`,
`regionSignature`, `reviewRegionBatch`). These sit inside the commit and review
code: keep the non-region path byte-for-byte in behaviour.

### UI
- `app/AiAssistant.jsx`: Offload switch and `OFFLOAD_TIP`, bird roster (keep the
  "Earlier chat" selector), `viewWorker`/`liveWorkers`/`retiredWorkers`,
  `roster`/`offload`/`worker` events, workers in the chats list,
  `.ai-from-organiser` block, lighter-model question, job destination select,
  `lightChoice`/route in `send`, worker placeholder texts, `birdColor`.
- `app/AiParts.jsx`: `BIRDS`, `birdColor`, `WorkerPart` (see upgrade below),
  `mdlxl_worker` label/filter, "light model" text in the cost row.
- `app/AiConnectionSettings.jsx`: "Allow lighter", "Lighter model", "Job routing".
- `app/ai-assistant.css`: bird/roster styles.
- `electron/preload.cjs`: `aiOffload`.
- Locales `src/locales/es.json`, `ru.json`, `zh.json`: delete the strings that are
  no longer used (Offload Mode and tip, Organiser, Job from the organiser,
  Handing the job to a worker, Job routing / Job destination and tips, Tiny job,
  New job, Allow lighter / Lighter model / light model / Use lighter model,
  Retired, Retired chats, retired-bird notice, handover note).
- `scripts/sd-trial/rig.cjs` and `trial.ps1`: drop the offload argument/call.
- Not Offload, leave alone: `app/UpdateShredder.jsx` and its test (that "bird" is
  the Shredder sprite), motion/save "worker" code.

## Upgrade of existing profiles (`<profile>/ai/`)

Offload was **on by default**, so most owner profiles contain bird data.

- `connections.json`: ignore `offload`, `routing`, `providers[*].allowLighter`,
  `providers[*].lightModel`; drop them on the next save. Nothing else changes.
- `organisers.json`: unchanged.
- `chat-<id>.json` (the model's chat) may contain `workers[]`, `birds[]`,
  `nextName`, `currentWorker`, `task.workerId`, `task.regionJobs`, transcript
  parts `{type:'worker'}`, user entries `from:'organiser'`, `messages` like
  "Crow: …". Old transcripts must still render: show a `worker` part as a plain
  read-only row with the bird's job and report text (no bird colour/roster), or
  as its report text. An interrupted task with `workerId` or `regionJobs` must
  report "cannot resume" instead of trying to resume.
- `chat-<id>-<bird>.json` worker files: no longer shown, but `ai-chats.chatsOf`
  must keep walking `workers[]` so save cleanup and "delete chat" still remove
  them and their provider session files.
- Native providers (Codex/Claude CLI): an organiser that only delegated has no
  provider thread. Continuing it directly starts a fresh provider thread; the
  chat's diary/memory note and visible transcript remain the history. That is
  acceptable; do not try to replay bird threads.
- Add a unit test with a fixture profile containing all of the above.

## Verification

Use Node 22.12+, pnpm, D: drive only. Report what actually ran.

1. `pnpm run build`, `pnpm test`, `pnpm run test:source` (compare with
   `.github/known-test-failures.txt`; do not widen it).
2. Port the shared tests out of `test/ai-offload.test.js` before deleting the
   rest: cleanup (≈149, 187), provider-file deletion (≈274), settle after restart
   (≈284), `removeFiles` (≈994), connection save (≈1009), context diet
   (≈1021-1080, currently through birds: make it go through the direct chat).
   Update imports in `ai-transcript.test.js`, `ai-provider-protocol.test.js`,
   `ai-context-native.test.js`; rework `ai-console.electron.cjs` (main flow was
   organiser → Crow) and `ai-questions*.cjs/js` to the direct chat; update
   `ai-prompts.test.js`, `ai-workflow`, `ai-connection-settings`, `ai-diary`,
   `ai-attachments`, `ai-awareness`, `ai-real-use`, `ai-editor.electron`,
   `ai-background`, `ai-live-tabs`.
3. **Multi-tab test (new, required):** with a stub provider, three model tabs each
   send a job; assert the three run at the same time (`aiStatus().running` peaks
   at 3), each edit lands only in its own model, a job on a hidden tab finishes,
   and each tab shows its own chat. Run it on the hidden desktop
   (`scripts/hidden-run.ps1`).
4. Upgrade test from the fixture profile (above).
5. Focused Electron tests on the hidden desktop for the AI window: no Offload
   switch, no routing/lighter settings, Handbook/Web switches still work,
   "New chat"/"Earlier chat" still work.
6. Optional, owner's credits: `test/ai-live-tabs.electron.cjs` with a real Codex
   sign-in in a disposable profile (see its header).
7. `rg -n -i "offload|organiser|worker|bird|routing|lighter|tiny job"` over
   `src app electron docs/AI-HOOK.md` and explain every remaining hit (the kept
   organiser registry, Shredder sprite, etc.).

## Docs

- `docs/AI-HOOK.md`: remove the "Offload Mode: an organiser per model and its
  birds" section (≈103-180) and the mentions at ≈54-55, 70, 78, 99. The AI reads
  this file through `mdlxl_help`, so it must describe only the direct chat.
- `docs/PACKAGED-TESTS.md` (≈75), `docs/agent-map.md` ("job routing", ≈40).
- Leave historical release notes and old task notes alone; mark
  `docs/agent-tasks/offload-improvement.md`, `ai-bird-job-routing.md`,
  `ai-organiser-checkpoints.md` as superseded by this note.
- Add this task to the table in `docs/agent-tasks/README.md` while it runs; on
  completion mark it completed with the PR and revision.

## Evidence

A/B on 1 Nov 2026 (Claude Code session, results in `D:\Claude\MDLxL-AI-AB\`,
not committed): 72 Codex runs of six of the owner's real requests (Khorne
rider strip, rider + shield/weapon, Nurgle horse leg landing, helmet simplify,
Demonette leg split, Demonette retarget), gpt-6.1-sol, high effort, outside check
on, every task under none / birds / handbook / birds+handbook, twice.

| Sol 6.1 setup | Avg time | Avg tokens | "Not verified" endings |
| --- | --- | --- | --- |
| none | 15.9 min | 4.0M | 0 |
| birds | 16.3 min | 4.2M | 3 |
| handbook | 19.2 min | 4.9M | 0 |
| birds + handbook | 16.1 min | 4.2M | 3 |

Quality was the same across setups. Birds were faster only on the full
Demonette retarget. An earlier Claude Haiku run showed birds alone breaking the
complex task. Not measured: several tabs at once and long multi-message
sessions — hence the multi-tab requirement above.

## Revision and local state

- Branch `claude/remove-offload-birds`, based on `origin/main` f75e407d.
  Contains only this note and its README table entry.

## Next action

Codex: implement on this branch, open a PR into `main` with
`Session: codex <task>`, report ready for review; awaiting merge approval.
