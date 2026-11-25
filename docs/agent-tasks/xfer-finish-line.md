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
