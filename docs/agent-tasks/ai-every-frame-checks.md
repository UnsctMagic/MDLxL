# AI every-frame checks: MDLxL sweeps a rule over every animation

Status: ready for review; awaiting merge approval
Implementation by Codex. Plan by Claude Code.
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
- Implementation base: `f254e39b` (merged plan PR #486). Generated fixtures are committed as test code. The timing run reads a real model from the permanent test collection.

## Relevant owners

- Shared frame walk: `compareMotion` in [ai-motion-compare.js](../../src/ai-motion-compare.js).
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
   in the measured hierarchy using the same flag bits as `sampleAiModel`.
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

## Implementation and measurements

- Supply `sweep: {kind, a, b?, reference?, sequences?, globalSequence?, limit?}` to `mdlxl_sample`. A point is `{nodeId}` or `{geoset, vertices}`, using zero-based IDs. Omitting both selectors walks every local clip and each positive-duration global clock. Explicit local and global selectors can be combined.
- `attached` compares the centroid offset in B’s own space to its reference pose. For a vertex group, B’s origin is its posed centroid and its axes are its mean skin transform. `clear` measures the closest pair of named vertices or pivots. `level` measures signed Z, selects the largest absolute excursion, and returns min, max and spread. The optional share counts visible, measurable frames strictly below the clearance limit or strictly above the drift/absolute-height limit.
- The table declares its columns once. Each row includes the visit count, step in ms, number measured, worst value and absolute frame, p50 and p95. Invisible geosets and singular attached bases contribute no measurements. Empty rows have null statistics. The camera warning lists only billboarded nodes that influence the selected points, including their ancestors. It is omitted when none contribute. Each sweep snapshots the named points, their bone hierarchies, clips and visibility before yielding to the editor.
- Existing string plan checks still work. A check of the form `{name, sweep}` supplies the app-owned rule for inspection. Both sides are measured on each revision, against the job start or named baseline. Cache identity includes the revision, baseline and actual checklist. The independent reviewer requests the latest plan’s evidence against that inspection baseline. It reuses the cached table when it still matches. A missing ID on one side is identified on that side.
- The initial `sampleAiModel` run under Node 22.23.3 on Windows took **4.00 s** on `pose-complex-fixtures/Current_VampireDragon.mdx` (263 nodes, 2,849 vertices). The attached sweep used vertices 0–5 of geoset index 8 against node 3, limit 1. It visited **76,272 timestamps in 29 local and 6 global clips**, measured 70,271 visible samples and returned 2,255 UTF-8 bytes. The largest drift was 150.703 model units in Death Alternate at frame 171566. The walk yields to the event loop during long clips.

## Verification results

- [Sweep regressions](../../test/ai-relation-sweep.test.js) found a single 3-unit slip at frame 223 in the third clip. The old 32-frame sampler reported minimum clearance 11 on the fixture's first clip. The sweep found contact at frame 24. Further checks cover rotation, a grouped anchor, an explicit reference, isolated globals, off-grid endpoints, visibility, billboards, invalid IDs, percentiles and limit shares. A moving 30-clip level sweep stayed below 2,048 UTF-8 bytes.
- Before implementation, the sampler returned no worst value, the review had no sweep evidence and the hidden packaged MCP rejected the new argument with `Unknown argument: sweep`. Replacing a plan after inspection also reproduced a stale outside check. The corrected reviewer reads the latest plan and named baseline from the same revision cache. The focused review and workflow rerun passed 50/50 and the strengthened measurement tests passed 6/6.
- AI suite 314 passed, 0 failed, 1 Windows SIGTERM skip. Full source suite 2,618 passed, 0 failed, 10 skipped. The CI baseline has no failure entries and remained unchanged. Compatibility 57 passed, 0 failed, 0 skipped.
- The 10 full-source skips comprise the POSIX SIGTERM check, Windows symlink privilege, unavailable 8.3 short names on the volume, and optional input fixtures for archer armor, the broken/rebuilt skinning pair, private Fx, two pose-corpus manifest checks, the dense twin-head rider and the Tinker/Brown Magnataur replay.
- Rebuilt and packaged on Windows. The final hidden `ai-editor` test passed **72/72** checks in 28 s. The real MCP call measured Z = 40 at 1,001 timestamps in each of Stand and Attack. Owner playback, a live AI provider and Warcraft III were not exercised.

## PR #488 review follow-up

- The outside reviewer’s sweep block is capped at 4,000 characters including its heading and truncation notice. Full tables are sent when they fit. Larger tables retain as many complete check summaries as fit, with both sides’ worst clip, frame and value or measurement error. The sampler and inspection still return their full tables.
- Both MCP and the local sampler allow up to 256 supplied vertex IDs per sweep point. The sampler identifies the oversized point and tells the caller how many vertices to choose. The tool schema directs floor checks to each row’s signed minimum and ceiling checks to its signed maximum. This wording lives in the tool description, outside the editing prompt.
- Before the fix, a single 35-clip check produced a 4,667-character reviewer block, an unrelated billboard appeared alongside both influencing nodes, and 257 supplied IDs did not raise an error. The final workflow test exercises 20 checks with 35 clips on both sides. The billboard test covers a skinned point, its parent and an unrelated hierarchy. The input test accepts 256 IDs and rejects 257.
- All 63 tests across `ai-relation-sweep`, `ai-workflow`, `ai-review-pictures` and `ai-prompts` passed with zero failures or skips. The existing prompt fingerprints passed unchanged. The rebuilt Windows package passed all 72 `ai-editor` checks on the hidden MDLxLTests desktop in 23 s, including the real MCP sweep. Verification for this follow-up was limited to those four source files and that packaged test.

## Next action

Review the feature branch and its evidence. Merge requires owner approval.
