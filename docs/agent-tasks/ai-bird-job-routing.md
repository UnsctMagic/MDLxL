# Automatic job routing in bird mode

Status: ready for review; awaiting merge approval
Owner: Codex
Updated: 2026-10-29

## Goal and scope

Automatic routing lets the organiser delegate according to task complexity and
context, with birds enabled. Keep manual controls, explicit bird destinations,
lighter-model opt-in, region boundaries, original prompts and model assets.
No release, installed-app/profile change, version bump or merge is authorized.

## Revision and owners

- Branch: `codex/bird-auto-job-routing`, based on main `8a36f2a1`.
- PR: https://github.com/UnsctMagic/MDLxL/pull/372; runtime commit `4ea20903`.
- GitHub CI pending at handoff-note update; no merge authorized.
- Runtime: `electron/ai-service.cjs` (`send`, `runOffload`, `routeJob`,
  `runRegionJobs`, `runWorker`); tooltip wording: `app/AiAssistant.jsx`.
- Contract: [AI-HOOK](../AI-HOOK.md#offload-mode-an-organiser-per-model-and-its-birds).
- Tests: `test/ai-offload.test.js`, `test/ai-routing.electron.cjs`;
  packaged runner registers the new harness.

## Findings and changes

- The old prompt supplied current/roster IDs but validation accepted only exact
  names, reproducing the reported error for a valid bird ID. Normalize IDs and
  case/whitespace in names, and recognize the reserved next bird as a new job.
- The organiser routes on the chosen model with its thinking setting, current
  job, roster and bounded recent context. Complex automatic work no longer stops
  before routing for the manual lighter-model question. The organiser's tiny
  decision selects an available opted-in lighter model per job or region.
- Invalid JSON or unknown destinations get one corrective routing turn before
  dispatch. Repeated invalid output reports an error, without starting a worker.
- Parallel tiny regions get separate bird conversations. Existing scheduling,
  dependencies, structural exclusivity, handovers and combined review remain.

## Verification

- Six new service regressions; all 26 offload tests passed in the full suite.
- Full source suite: 2,112 passed, 22 skipped, zero failures.
- Compatibility: all 57 passed; production build passed.
- Disposable package: 1,278 runtime/assets verified, 55 locales retained.
- Hidden packaged automatic-routing harness: all ten checks passed, including
  next-bird creation, ID continuation, corrective routing, complexity handover,
  new job dispatch, chosen-model routing actual Alt+mouse camera rotation and both corrective-turn token totals.
- A test-setup run initially failed because temporary native fixture JS files
  inherited this repository's ESM package type and FFmpeg had not yet been copied.
  D: temporary data outside the repository plus pinned FFmpeg resolved this;
  the final full suite passed without modifying native fixtures or failure lists.
- The first packaged assertion counted historical report rows instead of roster
  birds. The roster and persisted conversation showed one bird; the corrected
  assertion passed. No product change was made for that assertion.
- Hidden parallel packaged edit verification: all 14 checks passed, including
  simultaneous edits, combined checks, MDX save/reopen, mouse rotation, and the
  preserved manual lighter-model question. The first generated fixture exposed
  an existing test interpolation issue (`--30` for a negative coordinate); a
  positive-coordinate fixture passed without changing that harness or product.
- Router correction calls each count their full reported usage; a source
  assertion verifies both turns. This was caught by reviewing the package capture.
- Uses generated models and a local provider. Actual paid providers and the
  artistic quality of the user's animation request were not tested.

## Next action

PR #372 is open and attached. Disposable builds/profiles have been removed.
Remove the pushed worktree after saving the small report/capture on D:, verify
CI, and await explicit owner approval before merging or publishing. Source and
branch history remain in the original D: repository.
