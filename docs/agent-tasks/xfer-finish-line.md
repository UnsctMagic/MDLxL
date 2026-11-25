# XFER transplant: finish line and how we get there

Status: concept, waiting for the owner's "go". No code until then.
Owner / builder: Claude Code (Opus), no Fable, no new Codex quota. Task log: [xfer-toggles.md](xfer-toggles.md).
Written: 25 Nov 2026.

## Why a new plan

Owner, 24-25 Nov: "this is becoming a loop of back and forth with no clear end line", "You are relying on my scores as a
metric too much ... address the sum of my scores - the trends of what is bad". Fixes were aimed at single graded pairs and
broke others; the same export was graded 9 one round and 0 the next.

## The finish line: six rules, measured on every pair

From all 97 of the owner's comments (grouped in xfer-toggles.md, "What the owner's comments say"):

| # | Rule (owner's standard) | Measured as, on every pair, every donated animation | Comments behind it |
|---|---|---|---:|
| 1 | The body never changes shape | No skin edge stretches beyond the larger of the model's own and the donor's maximum stretch (neck, head, seams) | ~15 |
| 2 | Every part moves like the donor's matching part | Each matched limb, wing, tail and hanging part travels 0.7-1.4x the donor's (by limb length); unmatched parts keep the model's own motion | ~25 |
| 3 | The weapon is held like the donor's | Grip stays on the palm; same hand(s); grip place along the shaft and shaft angle in the hand match the donor's; head end and flat side read from the model's own animations; second hand on the shaft when the donor's is; ammunition shows and hides like the donor's | ~36 |
| 4 | Near-twins come out like themselves | When the model's own animation already resembles the donor's, the result is at least as close to the donor as the model's own is | 6 |
| 5 | No jitter | Skin speed changes no faster than in the donor's and the model's own animations | 6 |
| 6 | A fix never breaks a pair that worked | Every change is compared rule by rule against the last accepted build; no pair may get worse on any rule | ~12 |

"Done" = all six hold on the test pairs (19 weapon pairs, 50 "reasonable" pairs, 60 random/new pairs: 110 distinct),
with the default ticks. The owner then looks once, at the end, not every round.

What was measured on 25 Nov before writing this: with no checkboxes, today's engine leaves the model's stored mesh untouched
on all 110 pairs; 13 pairs change it through the suggested checkboxes (weapon seat, Rest pose fit, Donor pose). So the warping
the owner sees comes from how the bones are aimed in the animations, which rule 1 measures. The engine has 26 checkboxes.

## How we get there

1. **Scorecard and baseline (one session).** One run builds every pair, plays every donated animation, and writes the six
   rules per pair into one page: pass/fail per rule, worst animation and moment, and a picture of that moment. Most
   measurements already exist in pieces (stretch: `donorseam.mjs`; limb travel: CP11; grip and angle: CP12/13; twins: CP13;
   jitter: `out/claude-cp14/skinjerk.mjs`) and get joined into one run. Result: where today's engine fails, rule by rule,
   counted over all pairs. The owner sees this page.
2. **Fix by rule, biggest first (one session each).** Weapons (rule 3), then parts that don't move (rule 2), then body
   shape (rule 1). A change is kept only when the scorecard shows its rule improves and no pair gets worse on any rule.
   Fixes are general (structure and the models' own animations), never tuned to one pair.
3. **Checkboxes.** The default result must pass by itself. A checkbox is suggested for a pair only when it improves that
   pair's scorecard. Nothing is removed; the 26 boxes stay available.
4. **One look by the owner.** A final sheet with every donated animation, today's result and the new one side by side,
   only after the scorecard passes. Then merge.

**Hard stop:** at most two fix rounds after the baseline. After that the best version of each pair is what gets merged, and
any rule still failing is listed as a known limit instead of another round.

## What this costs

About four sessions of Claude's own work: scorecard and baseline, two fix rounds, final sheet and merge. No Fable, no
Codex. The owner's time: read the baseline page, look at one final sheet.

## Baseline scorecard (25 Nov, owner said "Go")

Tools: [scripts/xfer-scorecard](../../scripts/xfer-scorecard/README.md). Run on revision with this note, 110 pairs, every donated
animation except Decay, default ticks; about 2 s per pair. Page: `out/scorecard/baseline-page/index.html` (local).

Calibration: fixed limits stopped every pair, including the owner's 10s, so each limit now sits at the level of the pairs the
owner accepted (80th percentile of the 19 pairs graded 9-10 in reasonable-50; grades used only as a group). The measurements
separate his high and low groups: stretched edges 0.9% vs 1.9%, part-moves off the donor's 36% vs 52%, near-twin drift 0% vs 25%.
The weapon numbers do not separate them (those grades predate the weapon seat). Limits are frozen in `limits.json`.

| Rule | Pass / judged |
|---|---|
| Body keeps its shape | 51 / 110 |
| Parts move like the donor | 59 / 110 |
| Weapon held like the donor | 28 / 70 |
| Near-twins stay alike | 33 / 54 |
| No jitter | 69 / 110 |
| **All rules** | **15 / 110** |

Patterns: stretching sits mostly in Death (21), Attack (12) and Spell (11); the head is the part most often moving wrong (19),
and parts move too little (32) more often than too much (19); weapons fail by leaving the hand (21), angle (15), second hand
off (6); jitter mostly in Stand (14). 35 pairs fail two rules, 27 three, 10 four.

First fix round, by the plan's order: weapons (rule 3), starting with the weapon leaving the hand.

### Same scorecard on earlier versions (owner asked: "so the whole engine has now regressed again?")

Same pairs, same frozen limits: Codex's CP13 (b7c7f078) 15/110 all rules; the weapons-14 build (50612c6e, owner's weapon
grades averaged 8.7) 15/110; current (a29ce894 code) 15/110. No overall regression, and no overall gain: from CP13 to now two
rule results started passing (17 movement, 16 shape) and three started failing (17 jitter, 18 near-twin, 18 jitter). Weapon on
18: second hand 12% -> 96% of held moments, angle 23° -> 30° (fails either way). Known weakness of the ruler: 15's second hand
measures 99% "on the shaft" in CP13 although the owner saw it off in Walk; the 0.2-arm-length contact tolerance is too loose.

## Round 1 (weapons), 25 Nov

**Ruler fixes first.** The grip hand is now whichever palm is nearer the weapon at each moment (the old check assumed the
donor's side and missed mirrored pairs). Contact stays at 20% of an arm's length: a gripping palm's centre sits about a
hand's thickness from the haft, and a 6% tolerance failed the owner's accepted pairs. "Same place along the shaft" is not
compared: base and head ends are not read the same way round on every weapon. Known limit: 15 in CP13 measures both hands on
the haft (23% and 75% along it, donor 22% and 66%); the owner saw them off in Walk. Up close they lie along the haft rather
than closed around it, which a contact measure cannot see. Weapon limits re-derived from the accepted pairs (in hand 0.938,
angle 20.6°); the other limits unchanged.

**The real baseline uses the app's live ticks.** The sheets store suggestions made before the weapon seat existed; the app
suggests live (`src/xfer-suggest-toggles.js` in the transplant worker). `scripts/xfer-scorecard/live-suggest.mjs` records them
(seat suggested on 66 of 110 pairs); `score.mjs --keys-from`. With live ticks: shape 49, movement 61, weapon **54/70**, twins
33/54, jitter 73, **all rules 21/110** (stored ticks gave 15). Page: `out/scorecard/live-page/index.html`.

**Tried and reverted (rule 6).** Remaining weapon failures (16): second hand off the weapon (8), shaft angle 28-52° (8).
Second hand: the step measured the result in the donor's arm lengths, and on mirrored pairs could pick the arm already
holding; on 19 the dwarf's arm also cannot reach the gnoll's second-hand spot. Fixes (result's own arm lengths, free arm from
the skin it carries, slide an unreachable spot toward the main hand, run on any clip where the donor's second hand stays on
the weapon 30% of the time) brought 19's second hand from 13% to 60% of held moments and 12, 16, new-02, new-24 up, but over
all 110 pairs: two rule results passed (new-05 movement, new-02 jitter) and two failed (new-05, new-02 near-twin). Weapon
count unchanged. Reverted; engine back to a29ce894 behaviour.

### Round 1 result: the suggester follows the six rules (kept)

- Ruler: the shape allowance is now the donor's own stretch **per animation** (99.9th percentile of its edges), as the plan
  says ("beyond what the donor does"), not its typical stretch over all animations; shape limits re-derived from the
  accepted pairs (0.009 share, 1.391 worst over). Baseline with live ticks: shape 52, all rules 19/110 (`out/scorecard/live2`).
  Each stretched edge now records the two body parts it joins (`seams`); most stretch sits where skin blends two parts.
- Trial reverted: seam skin weighted like the donor's matching seam (`transplant-seam-weights.js`) — no gain, one pair worse.
- Checkbox sweep (`toggle-sweep.mjs`, 667 pair x checkbox trials, `pick-toggles.mjs`): on 30 pairs a checkbox flip passes a
  rule and fails none. All together: **19 -> 24 pairs pass every rule, 34 rule results start passing, 0 start failing.**
- Kept: the measuring moved into `src/xfer-scorecard.js` (`scoreResult`, `judgeResult`, frozen `SCORE_LIMITS`), the script
  `score.mjs` is a thin wrapper (identical numbers checked on 3 pairs). `suggestToggles` (the app's live suggestion) ends with a
  six-rule step: each shown checkbox is flipped when that passes a rule and fails none; flips applied together, falling back to
  the best single flip if together they fail a rule. Re-run over all 110 pairs with the app's own suggester: 24/110, the same 34
  gains, 0 losses (`out/scorecard/live3`). Cost: one transplant and score per shown checkbox (about 2-3 s each) in the worker.
- A second flip round over the new picks finds 2 more rule passes on 2 pairs (24 -> 25), at about twice the suggestion time;
  left out. Round 1 page: `out/scorecard/round1-page/index.html`. Round 2 (last before the final sheet): parts that move
  wrong (41 pairs) and stretching (46 pairs) in the engine itself.

## Round 2 and final numbers (25-26 Nov)

Round 2 looked for an engine cause behind "parts move wrong". Most of it was the ruler: parts were measured against the
torso skin (a torso with swaying cloth made a still head look like it moved) and by distance (heads whose centre sits near
the neck joint looked stiff). The rule now compares turning angles: the donor's part joint against the joint it hangs from,
and the result's visible part skin (fitted as a rigid turn) against the same joint in the result; donor parts turning less
than 0.05 rad RMS are skipped. Movement limit re-derived from the accepted pairs (0.115). The remaining movement failures are
spread thin (tails, weapon arms in some attacks, a few special animations); no general engine fault was found, so round 2
made no engine change, as the plan's hard stop allows.

`SCORE_LIMITS` in `src/xfer-scorecard.js` synced with `limits.json`. Final run, same ruler for both
(`out/scorecard/start` = the app's suggestions before this work, `out/scorecard/final` = the six-rule suggester):

| Rule | Before | After |
|---|---|---|
| All six rules | 18 / 110 | **25 / 110** |
| Started passing / failing | | 32 / **0** |

## Known limits at the hard stop (final scorecard, 110 pairs, default ticks)

| Rule still failing | Pairs | Where |
|---|---:|---|
| Body stretches beyond what the donor and the model do | 46 | Death 14, Stand 9, Attack 7, Spell 7, Walk 6; mostly skin blended between two parts |
| A part turns differently from the donor's | 36 | legs or arms turning less (16), tails turning less (4), legs turning more (4) |
| Weapon not held like the donor's | 14 | second hand off the weapon 6, shaft angle 5, weapon leaves the hand 3 |
| Near-twins drift from each other | 19 | |
| Jitter | 29 | spread over Spell, Stand, Walk |

Tried this round and reverted because a pair got worse: second hand reaching the donor's spot (reachability, free arm from
the skin), seam skin weighted like the donor's seams. Ruler limit: a contact measure cannot see a hand lying along a haft
instead of closed around it (15, CP13).

Final sheet for the owner's one look: `cases-final.json`, launcher `GRADE - XFER final.cmd` — the 27 pairs whose default
ticks changed, every donated animation, new ticks as defaults. Answers: `transfer-xl-35\final\answers.json`.
