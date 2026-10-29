# Automatic organiser checkpoints and helper birds

Status: ready for review; awaiting merge approval
Owner: Codex
Updated: 2026-10-29
Branch: codex/ai-organiser-checkpoints
Base: 3500255b (includes routing PR #372)

## Result and scope

Complex embedded bird jobs now declare completion checks, can use a focused
read-only helper alongside target inspection, reuse named numerical routines,
and hand remaining work to a fresh bird at a phase checkpoint when context is
half full. The baseline, applied steps, routines and helper findings survive.
Two failures of the same measured check across revisions require a changed plan
before another edit. Region jobs can declare explicit prerequisites.

Manual and explicitly addressed editor birds retain their destinations and use
the same lifecycle. Simple exact jobs avoid helper/planning overhead. Existing
lighter-model opt-in, region ownership, original user wording, model data and
recovery remain in place. The installed app and running user job were excluded.
No merge, release or upgrade is authorized.

Runtime owners: electron/ai-service.cjs and electron/ai-job-plan.cjs. Embedded
contracts: src/ai-tools.js. Durable behavior is documented in docs/AI-HOOK.md.

## Verification

- Production build and pinned FFmpeg verification passed; isolated packaging
  verified 1,279 runtime/asset files and 55 locales.
- Full source suite: 2,121 passed, 22 skipped, zero failures (2,143 total).
- Compatibility suite: 57 passed.
- Hidden packaged tests using local provider fixtures: routing/helper/handover
  18/18, restart/awareness 17/17, parallel regions/model choice 14/14.
- Checks include helper/editor overlap, refused helper writes, evidence delivery,
  durable routine reuse, handover without replay, dependency reports, stop cleanup,
  exact edits, direct bird addressing, save/reopen and actual mouse rotation.
- Fixtures now use a fresh routing profile, a graceful Electron restart and an
  explicit concurrency barrier; reused chat history, parent-only process kills
  and a 50 ms overlap assumption had caused harness failures during reruns.

Actual provider judgement, artistic quality, gameplay acceptance and time/token
savings require real-job comparison. Local fixtures prove orchestration, not a
particular speedup. The disposable app/profile is removed after validation.

## Next action

Review the PR and merge only with owner authorization. An installed-app upgrade
is a separate action; do not affect the owner's existing running job.
