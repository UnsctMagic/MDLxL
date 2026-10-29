# AI hook harness (fixes from the learning facts)

Status: completed. PRs #345–#350 merged on 2026-10-27 and shipped in 0.34.0, which also shows the outside check as a chat step and the plan as plain lines. Not yet tried with a real provider by the owner.
Owner / consolidator: Claude Code (session local_a1193075-94ec-4f8b-9517-9fe5d83a2c75)
Updated: 2026-10-27

## Goal and completion criteria

- Close the gaps in [AI hook learning facts](ai-hook-learning-facts.md) between the embedded AI hook and an outside agent that fixed the Demonette in one go.
- The owner's chosen order (2026-10-27) has five steps:
  1. Look first, then change once (plan gate).
  2. Versions side by side.
  3. Decision diary.
  4. An outside check, plus pictures that isolate the parts in question.
  5. Knowledge used as evidence, plus a thinking-effort setting.
- Each step is its own PR, so the owner can hand-test them one at a time.
- Owner rules:
  - Fixes are built into the hook and always on, like Undo; they aren't SD-Brain-style toggles.
  - Settings are only for cost choices (effort, and turning the outside check off).
  - No new panels.
  - Statistics inform the AI as evidence; they're never yes/no rules taken from a few cases.
  - Don't make it case-specific.

## Revision and local state

- Web research switch (asked for separately): [PR #345](https://github.com/UnsctMagic/MDLxL/pull/345), branch `claude/ai-web-research`, worktree `.claude/worktrees/ai-web-research`.
- Step 1: [PR #346](https://github.com/UnsctMagic/MDLxL/pull/346), `claude/ai-plan-first`, into `main`.
- Step 2: [PR #347](https://github.com/UnsctMagic/MDLxL/pull/347), `claude/ai-versions`, stacked on #346.
- Step 3: [PR #348](https://github.com/UnsctMagic/MDLxL/pull/348), `claude/ai-diary`, stacked on #347.
- Step 4: [PR #349](https://github.com/UnsctMagic/MDLxL/pull/349), `claude/ai-outside-check`, stacked on #348.
- Step 5: [PR #350](https://github.com/UnsctMagic/MDLxL/pull/350), `claude/ai-effort-knowledge`, stacked on #349. It covers isolated pictures, thinking effort, guides by topic, and patterns treated as evidence.
- Steps 1–5 share the worktree `.claude/worktrees/ai-plan-first`.
- Merge #346, #347, #348, #349 and #350 in that order. Retarget each to `main` after the one below it merges.
- #345 and #346 both bump `test/localization-catalogs.test.js` counts from main's `[6419,6431,3618]`. The second one merged needs the counts summed (+1 for web, +1 per step label).
- Fixtures for packaged AI tests: copy `out/pose` (Footman.mdx and its Textures) from `.claude/worktrees/release-0.33.0/out/pose`. Without it, `ai-console` silently skips. For `ai-parallel`, set `MDLXL_AI_CONSOLE_MODEL`.

## Relevant owners

- `electron/ai-service.cjs` `runTask`, which:
  - handles `mdlxl_plan`;
  - refuses edits until the plan exists;
  - adds the keep list to `mdlxl_review inspect` results;
  - injects the diary into prompts;
  - records the diary in its `finally`.
- `src/ai-tools.js`: `AI_PLAN_TOOL`, the `mdlxl_versions` tool, `aiToolEditsModel`, and the look-first paragraph in `AI_SYSTEM_PROMPT`.
- `src/ai-versions.js` (store) and `app/ai-editor.js` (dispatch, plus script references `version:NAME`). The automatic versions come from `beginAiReview` in `app/ai-review.js`.
- `electron/ai-diary.cjs`: diary entries live on the `organisers.json` model entry (`entry.diary`). `cleanup` wipe removes them.
- User guide: `docs/AI-HOOK.md` (Look first, Versions, Decision diary, Web research).

## Findings and decisions

- Decision: exact value edits (`simpleJob` in `electron/ai-model-choice.cjs`), view switches and going back to a version don't need a plan.
- Decision: the plan needs at least two options unless the edit is an exact value edit. A new plan replaces the old one, which is how the AI starts over.
- Verified: fake providers send `target` with every tool, so `AI_PLAN_TOOL` accepts it. Without that, the edit was refused with "Unknown argument: target".
- Verified: `ai-parallel.electron.cjs` reuses `out/ai-parallel/profile`. Clear it between runs, or old birds make "both birds finished" fail.
- Verified: PowerShell env vars don't persist between tool calls. Set `MDLXL_REAL_PLAYWRIGHT` in the same command as the runner, or every test "fails" with "Playwright not found".
- Avoid: closing the packaged app with an edited, unsaved model waits on the save question. Destroy the windows first, as `ai-awareness` and `ai-versions` do.

## Changes and verification

- Changed: steps 1–3 above, plus the web research switch.
- Checks on the full stack, at the `claude/ai-diary` tip:
  - `pnpm run test:source`: 2,056 passed, 0 failed.
  - Packaged hidden runs of `ai-versions`, `ai-console`, `ai-awareness`, `ai-parallel` and `ai-hotkeys` pass.
  - `ai-editor` fails at the sign-in stand-in (line ~251) on this PC, as it already did on untouched bases.
- Remaining: no real provider run yet; the owner hand-tests.

## Blockers and next action

- Built in step 4 (#349): `AiService.outsideCheck`, `AI_OUTSIDE_CHECK` and `config.outsideCheck` (on by default). A doubtful or wrong verdict sends the job back up to twice.
- Built in step 5 (#350):
  - `capture` samples take `geosets` and `plain` (`picture()` in `app/ai-editor.js`);
  - `effortFor` in `electron/ai-providers.cjs`, with the provider setting `effort` defaulting to `high`; Claude API `max_tokens` is 64000 for adaptive models;
  - `guidesForRequest` in `src/ai-tools.js` attaches up to two handbook guides while the handbook is on;
  - the look-first paragraph treats patterns as evidence.
- Not done:
  - `mdlxl_review inspect` still draws whole-model before/after pictures. Isolated before pictures would need a render of the saved version.
  - ~~The ~23 KB captured context is still repeated with every message.~~ Fixed in [AI credit fixes](ai-credit-fixes.md): full once per bird, then deltas.
- Next: the owner hand-tests with a real provider. Merge in order on approval.
- On completion: mark this note completed, remove its table row and fold durable rules into `docs/AI-HOOK.md`.
