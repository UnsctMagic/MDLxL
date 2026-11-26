# XFER transplant: brief for the Fable review (owner's order, 26 Nov 2026, 01:30)

Owner: "At 8:01am I want a Fable 5.2 on high to review my issues and create a plan on how to fix it. Fable 5.2 reviews and
plans the code. Opus 5.5 on medium writes, builds, tests. I review results."

This overrides the older "no Fable" rule for this task.

## Who does what

- **Fable 5.2, high effort:** reads this brief, the owner's comments and the code; writes the plan; specifies the code
  changes; reviews Opus's diffs and test results before anything reaches the owner.
- **Opus 5.5, medium effort:** writes the code, builds, runs the tests and the scorecard, makes the grading build.
- **Owner:** reviews the results. Nothing goes online until he says "merge" (see the repo's AGENTS.md / CLAUDE.md).

## Where things are

- Checkout: `D:\Codex\xfer-toggles`, branch `codex/xfer-toggles`, last commit `ba80df9b` (all local, nothing pushed).
- Plan and history of this work: [xfer-finish-line.md](xfer-finish-line.md) (six rules, scorecard, rounds 1-2, known limits),
  [xfer-toggles.md](xfer-toggles.md) (checkpoints CP1-CP14; the section "What the owner's comments say" groups all 97 of his
  comments before the final sheet).
- Engine: `src/skeleton-transplant.js` (`transplantSkeleton`), weapon seat `src/transplant-weapon-seat.js`, cape
  `src/transplant-native-cloth.js`, ammunition `src/transplant-ammo.js`, toggles `src/transplant-autofix.js`, suggester
  `src/xfer-suggest-toggles.js`, scorecard measurements `src/xfer-scorecard.js`.
- Scorecard tools: [scripts/xfer-scorecard](../../scripts/xfer-scorecard/README.md) (`score.mjs`, `calibrate.mjs`,
  `page.mjs`, `live-suggest.mjs`, `toggle-sweep.mjs`, `pick-toggles.mjs`, `compare.mjs`, `render.mjs` for donor/own/result
  pictures).
- Grading build: `D:\Claude\MDLxL\TestBuilds\transfer-xl-35` (install by copying `dist` and `src` into
  `MDLxL-win32-x64\resources\app` while it is closed; keep its `profile`). Sheets `cases-*.json`, answers in each sheet's
  folder; launchers in `TestBuilds\_START HERE`.
- Owner's grades on the final sheet: `TestBuilds\transfer-xl-35\final\answers.json` (27 pairs).

## The owner's verdict on the final sheet (26 Nov): "I'm not happy"

Grades: 10 x6, 9 x3, 8 x3, 7 x1, 6 x1, 5 x9, 0 x6. His comments, grouped:

1. **Seam fix ruins models** (9 pairs: new-11, reasonable-38, reasonable-46, random-03, random-11, reasonable-40, new-26, and
   others). "I have yet to see SEAM FIX improve anything, how is this passing your visual testing?", "SEAM FIX IS CAUSING HOLES
   IN EVERY MODEL IT TOUCHES", "big hole in the ogre chest - are you blind?". Cause: Claude's six-rule suggester step
   (`suggestToggles`, round 1) ticks any checkbox the scorecard says helps; the scorecard cannot see holes, so it re-enabled
   Seam fix, which the owner had already rejected and Codex had kept out of suggestions.
2. **Weapon seat took the weapon out of the hand** (reasonable-32: "the before is a better transfer... how can you not see
   this???"; reasonable-38). reasonable-08: two-handed weapon held with fists crossed; Stand 2 holds the weapon although the
   donor puts it in its belt.
3. **Front legs should become the beast's arms** (reasonable-45 Cold One Riderless -> Snap Dragon: "this is possible").
4. **Stop testing unreasonable pairings**: horse to single unit, naga to knight, trench raider to rabbit, drummer to orc
   ranger, Ottoman cavalry to rifleman (random-06, new-29, new-06, new-22): "you are wasting compute", "NO MORE PAIRINGS LIKE
   THIS". Also stop using the Arbalester -> Crossbowman pair (reasonable-18): "please dont use this model anymore in testing".
5. Pairs at 9-10 (keep them): reasonable-05, reasonable-29, new-08, random-10, new-01, random-21, new-05, new-02.

## What went wrong in the method (Claude's own account)

- The scorecard measures stretch, part turning, weapon contact, near-twin drift and jitter. It cannot see holes, missing
  weapons that are "in hand" by distance only, or limbs mapped to the wrong role. A checkbox the owner rejected by eye was
  re-enabled because the numbers said so. Rule for the plan: the owner's explicit verdict on a checkbox outranks any metric.
- The test set (random30, new30) holds pairings the owner finds unreasonable; numbers over them misled.
- Many hours went into measuring and re-calibrating the ruler; the engine core barely changed.

## What the plan must cover (owner's standard, from all his comments)

1. The body never changes shape (no holes, no stretching beyond what the donor or the model does).
2. Every part moves like the donor's matching part; a quadruped's front legs become a biped's arms when that is the
   reasonable reading.
3. The weapon is held like the donor's (same hands, place, angle, read from the model's own animations); never removed from
   the hand.
4. Near-twins come out like themselves.
5. No jitter.
6. A fix never breaks a pair that worked.

Plus: a test set of reasonable pairings only (same body type, or a clear mapping), agreed with the owner if unsure; Seam fix
never suggested; no checkbox the owner has rejected comes back by metric.

## Working rules

- Everything on D:. Commit locally on `codex/xfer-toggles`; never push, PR, tag or post until the owner says "merge".
- Report to the owner in plain, short language (he is not a coder): one line, 2-4 bullets, what's left.
- Before any build reaches the owner: hidden click-through on the exact package (`scripts/hidden-run.ps1` with
  `MDLXL_HIDDEN_COMMAND`, Playwright at `D:\Claude\tools\node_modules\playwright-core`), and look at the results by eye
  (`scripts/xfer-scorecard/render.mjs`), not only numbers.
- Test models: `D:\Claude\MDLxL-TestModels` (never delete). Test builds open a named model.
