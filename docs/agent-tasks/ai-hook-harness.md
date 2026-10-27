# AI hook harness (fixes from the learning facts)

Status: active. Steps 1–3 are ready for review and awaiting merge approval; steps 4–5 haven't started.
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
- Steps 1–3 share the worktree `.claude/worktrees/ai-plan-first`.
- Merge #346, #347 and #348 in that order. Retarget each to `main` after the one below it merges.
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

- Next step 4 has two parts:
  - **Outside check.** After the AI's own `mdlxl_review finish` passes, a fresh tool-less provider call judges the result. It gets the owner's request, the plan's keep list, the review's before/after pictures and the check results, but never the worker's reasoning. It gives a graded verdict with reasons. A doubtful verdict sends the job back once with those reasons. It's on by default, with an off switch in Connection settings, because it costs a call. Reuse the `artDirection` pattern (tool-less `runCodex` / `runClaude` / `runApi`).
  - **Isolated pictures.** Review and capture pictures that show only the named geosets, in plain shading, with the same camera and frame before and after.
- Next step 5 has two parts:
  - Attach the Editing-handbook guide section for the job's topic directly to the job.
  - Reword the SD and binding statistics as evidence ("most Blizzard units do X, because Y"). Add a thinking-effort choice next to the model picker (Codex `reasoning_effort`, Claude `--effort` or `output_config.effort`), defaulting to high for editing.
- Not covered by step 3: trimming the ~23 KB captured context repeated with every message.
- On completion: mark this note completed, remove its table row and fold durable rules into `docs/AI-HOOK.md`.
