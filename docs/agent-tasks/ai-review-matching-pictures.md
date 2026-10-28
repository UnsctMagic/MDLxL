# AI review: matching original, edited and donor pictures

Status: ready for review
Owner / consolidator: Claude Code
Updated: 2026-10-28

## Goal and completion criteria

- From the owner's handoff of 2026-10-28 (Flail07 → Flail08 Walk transfer): the
  AI review must compare the original and edited target at the same animation,
  phase, view and framing, with donor pictures for a motion transfer, never
  whatever animation happens to be on screen.
- Also: the outside check must not cut pictures off blindly, a rejection after
  the retry limit must never count as a pass, and Resume must keep the original.
- Not in scope: merge, installed app replacement, release (separate approval).

## Revision and local state

- Branch / checkout: `claude/ai-review-baseline` in `.claude/worktrees/ai-review-baseline`
- Base: `origin/main` 58d50e6e
- Required local fixtures: `out/pose/Footman.mdx` (+ Textures) for the packaged AI tests.

## Relevant owners

- `app/ai-review.js`: `beginAiReview` (no picture any more), `touchedAnimations`,
  `comparisonPictures`, `reviewAiModel`.
- `app/ai-editor.js`: `picture(id, sample, source)` draws the kept original
  (`source.model`), a donor tab (`source.documentId`) or a shared framing (`source.focus`).
- `app/App.jsx` host `render`: accepts `spec.model`.
- `electron/ai-service.cjs`: outside-check retry limit, `choosePictures`, blocked headline.
- `electron/ai-providers.cjs` `runCodex`: token baseline.
- `src/ai-tools.js`: `mdlxl_review` schema (`sequence`, `globalSequence`, `donor`), judge prompt.

## Findings and decisions

- Verified (source): `beginAiReview` captured one picture of the live view at the
  first edit and reused it as "Before the task"; animation frames were drawn for
  the edited model only and from the live sequence. Fixed by drawing the kept
  original (`review.before`, region-scoped for birds) at inspect time.
- Decision: the compared animation is the one named in `sequence`/`globalSequence`,
  else the one whose keys the edit changed (`touchedAnimations`), else the task's
  own captured animation. The live viewport never decides.
- Decision: original and edited pictures of one phase share one framing (the
  posed bounds of both models). Donor phases map by fraction of each animation.
- Decision: one tool result carries at most 16 pictures (`ai-mcp.cjs`); more is
  refused with a clear error. The outside check takes whole groups (max 12),
  spread over the animation, and is told which pictures were left out.
- Verified: Resume dropped the Codex thread but kept `providerTotalTokens`, so
  resumed runs counted 0 tokens until the new thread passed the old total. A new
  thread now counts from 0. The 2.98M figure for one turn is plausible (each tool
  round resends the context); no evidence of double counting.
- Uncertain: the run-together words ("outsidevisual", "Currentmodel") in the red
  box. No code path strips whitespace (Codex delta assembly, MCP arguments, React
  pre-wrap); the text is the worker's own `finish` summary. The incident chat was
  no longer in the installed profile, so the raw events could not be checked.
  Blocked results now start with "The edit is kept but not verified." on its own line.
- Verified: switching the visible animation stops a live task (it is part of the
  selection signature); Resume restores the task's view. An organiser job sent
  later gets the current view, but its review now compares the animation it edited.

## Changes and verification

- Tests: `test/ai-review-pictures.test.js` (new), `test/ai-workflow.test.js`
  (retry limit), `test/ai-native-providers.test.js` (token baseline),
  `test/ai-console.electron.cjs` (new labels, saves the compared pair).
- Remaining: a real provider run of a donor animation transfer in the packaged
  app; Warcraft III playback is untouched by this change.

## Blockers and next action

- Awaiting review and merge approval.
