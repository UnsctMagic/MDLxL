# AI every-frame checks: MDLxL sweeps a rule over every animation

Status: plan approved by the owner 1 Nov 2026; implementation not started
Owner / consolidator: Codex (gpt-6-astra) implements; plan by Claude Code
Updated: 2026-11-01

## Goal and completion criteria

This is idea 2 (fact 12) of [AI hook learning facts](ai-hook-learning-facts.md#12-requirements-that-must-hold-in-every-animation-are-not-checked-in-every-animation).

- Problem: requirements such as "the weapon stays in both hands in all
  animations" must hold on every frame of every clip. Today the AI can only spot-check
  them. `mdlxl_sample` takes 1–32 frames per call (`src/ai-sampling.js`
  `sampleAiModel`), and every number it returns costs AI tokens. So the AI picks a
  few frames, misses the bad ones and still reports "passed".
- Owner decision: MDLxL does the counting, not the AI. The AI states the rule
  once. MDLxL walks every frame of every animation locally, which costs no tokens,
  and hands back a few lines: the worst moment, which clip and frame, and how far
  off it is. The cost to the AI stays about one tool call, however many animations
  the model has.
- Done when:
  1. The AI can describe a rule in one tool call and gets back a compact result
     for every animation (or the ones it lists), including global sequences.
  2. The review re-runs the rules a plan listed against the edited model and puts
     the numbers in its evidence, including the outside check's table.
  3. The prompt tells the AI when to use a sweep instead of chosen frames.
  4. The tests below pass, with no new failures against the baseline.
- Out of scope: any panel, button, list or indicator for the owner. The owner sees
  the AI's normal chat reply only. A "jump to the worst frame" click may come later,
  but only if the owner asks. Also out of scope: standing requirements (fact 14),
  per-check final verdicts (fact 15), and the Motion warnings feature.

## Revision and local state

- Branch / checkout: `codex/ai-every-frame-checks` from current `origin/main`, in
  `D:\Codex\mdlxl-every-frame` with a `node_modules` junction to
  `D:\Claude\MDLxL\node_modules`.
- Plan written against `origin/main` `eb364705`.
- Uncommitted changes: none. Fixtures: generated in tests only, with no private models.

## Relevant owners

- Frame walk to copy: `compareMotion` in [ai-motion-compare.js](../../src/ai-motion-compare.js).
  It already samples every frame of a clip (step 1 ms, or 10 ms above 5 s, both
  endpoints), handles global sequences through `isolateGlobalSequence`, skips
  invisible geosets (alpha < 0.01) and reports p50/p95/shares. Reuse its
  `animation()` selection and step rules (export or share them) rather than
  writing a second clock.
- Pose maths: `sampleNodeMatrices`, `skinGeoset`, `sampleGeosetAnimation` in
  [animation.js](../../src/animation.js). Import them; do not copy them.
- Tool schema and prompt: `sample` in [ai-tools.js](../../src/ai-tools.js) and
  `AI_EDITING_BODY`. Sampling: [ai-sampling.js](../../src/ai-sampling.js).
- Plan checks: `acceptanceChecks` in [ai-job-plan.cjs](../../electron/ai-job-plan.cjs).
  Review evidence: [ai-review.js](../../app/ai-review.js), where `compareMotion`
  and `motionTable` are already wired and cached per revision.
- AI map row: "AI chat, console, provider sign-in…" in [agent-map.md](../agent-map.md).
  Related: [AI motion measure](ai-motion-measure.md) (same measuring style).

## Design (decided; ask the owner before changing it)

1. **One tool, not a new one.** Add an optional `sweep` argument to the existing
   `mdlxl_sample`. With `sweep`, `frames` is not used: MDLxL walks every frame of
   every animation (or the listed `sequences` / `globalSequence`). This keeps one
   way of measuring and does not grow the tool list.
2. **Points.** A point is a node's pivot (by id) or the centre of a list of
   vertices in one geoset (by geoset + vertex ids, as `vertices` already works).
   Skin only the vertices the rule names, not whole geosets, so a sweep stays cheap.
3. **Three rule kinds** cover the owner's examples:
   - `attached`: point A keeps the same place relative to point B (for example a
     grip vertex group relative to a hand bone). It is measured in B's own space,
     against a reference pose: a given sequence and frame, default the first Stand
     animation (`standSequenceIndex` in `sequence-editor.js`), frame start. The
     result is how far A drifts from where it should be.
   - `clear`: the smallest distance between point/group A and group B (for example
     a weapon head against the body). The result is the closest approach.
   - `level`: the height difference between A and B along the model's up axis, or
     A's height alone. The result is the lowest, highest and spread.
4. **Compact result, numbers only.** For each animation: name, frames sampled,
   worst value and its frame, p50/p95, and the share of frames past an optional
   `limit` the AI gives. Add an overall worst line on top. No per-frame lists by
   default. Keep the whole reply small: aim under ~2 KB for a 30-animation model.
   Follow the existing rule in `ai-motion-compare.js`: statistics, never pass/fail
   fields. The AI judges the numbers. Flag camera-dependent (billboarded) nodes
   the same way `sampleAiModel` does, because a sweep cannot judge them.
5. **Plan and review.** A plan check may carry one sweep rule. `mdlxl_review` and
   the outside check re-run those rules on the edited model (and on the baseline
   when one is set, so before/after both show) and include the compact rows next to
   `motionTable`. Cache them per revision the way `review.motionCache` does.
6. **Prompt.** Add one or two plain sentences to `AI_EDITING_BODY`: when a
   requirement must hold "in all animations", "everywhere" or "always", state it as a
   `mdlxl_sample` sweep and check the worst moment; do not pick frames. Update prompt
   fingerprints deliberately, as [AI motion measure](ai-motion-measure.md) did.
7. **Speed.** A sweep runs on the owner's PC. Measure it on a large model with many
   animations; the motion-measure replay used models of that size. Name the
   duration in the note. If a full sweep would block the editor for long, yield
   between animations (or move it off the main thread) so the editor stays usable.
   Never shorten the walk to whole-second steps to save time. If the walk is
   coarser than every frame, say so in the result.

## Rules to keep

- General rules only: no bone names, model names or "flail" or "skirt" logic.
  Points come from ids the AI passes.
- Measurements, never gates or limits forced on the owner. `limit` is the AI's
  own optional threshold for counting frames.
- Do not change `animation.js` playback semantics, OptimizeXL or Motion warnings.
- Imported libraries stay untouched.

## Verification required

- Source tests (new `test/ai-relation-sweep.test.js` or similar, from a generated model):
  - an `attached` part that slips in only one of three clips: that clip and the
    right frame come back as worst, and the other clips read about 0;
  - `clear` finds a closest approach that falls between two of today's 32-frame picks;
  - `level` across a global sequence;
  - endpoints are always sampled, a billboarded node is flagged, and bad ids or
    sequences give plain errors;
  - the result size stays within budget for a 30-clip model.
- The review test shows plan sweeps re-run against edited and baseline revisions.
- Packaged `ai-editor` check: the AI tool call runs a sweep in the real app, hidden.
- Report the runtime of a large-model sweep. Run the AI suite and full source suite
  and compare with `.github/known-test-failures.txt`. Do not widen it.
- After a fix, rerun only the failed and related tests, not the whole suite.
- No live AI quality claim from an inert provider. Owner testing comes after.

## Blockers and next action

- None. Next: Codex implements on `codex/ai-every-frame-checks`, opens a PR into
  `main` with a `Session: codex …` line, updates this note, and reports
  `ready for review; awaiting merge approval`. Do not merge or bump versions.
