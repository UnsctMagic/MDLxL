# XFER look check

Status: built, tuned, not yet used as a gate. Branch `claude/xfer-look-check` (cut from
`codex/xfer-auto-fix-step2` d10584fd), local only.

## Why

Owner, 22 Nov 2026: "every new 40 pairings exposes the same mistakes over and over".
Across seven grade sheets the same five failures came back (unit bobs or shakes in Walk; legs
collapse, turn to wires or stop; weapon leaves the hand; cloak or tail frozen; arms come off or
twitch). Nothing checked the drawn result before the owner saw it, so each sheet rediscovered
them. On the Fresh cloak and tail 20 sheet, 5 of 6 zeros were byte-identical to build 33.
The owner said "Yes, build the check".

## What it measures

`scripts/xfer-look/check.mjs` `measurePair(donor, result, { native })` samples every clip of
the result except death, decay, portrait and birth (20 ms steps, at most 121 moments). It
measures only the skinned, visible, non-additive geosets. It reads no bone names and no case ids.

- **Against the donor, same clip:** how much the whole unit bobs and shakes; the 95th-percentile
  vertex acceleration (twitch); body height and lowest point over time (curl-up, float or sink).
- **Against the original unit** (same mesh and vertex order, its own clips; `native`):
  - Skin that moves in the unit's own clip of the same kind but stays still in the result (per
    vertex, and per region of skin on the same bones).
  - Edges stretched past 1.5x, or squashed below 0.6x, anything the unit does in any clip.
  - Held pieces: each loose mesh piece (welded by position, because many models store loose
    triangles) and the steadiest skin on other bones near it. That skin is the hand, even on
    low-poly units whose hand never touches the sword. In the result, the gap may not grow by
    more than the limit over the unit's own worst gap in that kind of clip.

`verdict.mjs` turns the numbers into reasons in plain words. It uses `thresholds.json`, which
`tune.mjs` tuned on the graded results. `look.mjs <donor> <result> [original]` checks one result.

## Data and how it was tuned

- `graded-rows.mjs` collects every graded result from the sheets listed in the Fresh cloak and
  tail 20 sheet record: 295 results, 59 bad (grade 3 or less), 140 good (9 or more).
- `find-natives.mjs` finds the original unit for 241 of them in `MDLxL-TestModels`, BindXL refs
  and lpw `dist/models` (same vertex and face count per geoset). For the other 54, only the donor
  checks run.
- `measure-all.mjs` measures the rows in parallel (about 2 s each). The working files are in
  `D:\Claude\xfer-look` (`graded-n.json`, `graded-m4.jsonl`).
- `tune.mjs graded-m4.jsonl 0.15` added limits greedily, up to a budget of 15% of good results
  flagged.

| Run | Bad caught | Good flagged |
| --- | ---: | ---: |
| Tuned on all sheets | 44 / 59 | 16 / 139 |
| Held out: 3-fold by sheet, tuned on two thirds, scored on the rest | **37 / 59** | **23 / 139** |

The held-out row is the honest number. Some results are caught for a different reason than the
owner's: cloth-01, where he said the weapon leaves the hand, is flagged for bobbing in Spell.

### What it does not catch

- **Not a motion fault:** black texture (sample-1-460); "B was better" (humanoid-532); the bow
  hand not switched (pair-15); the head and neck not like the donor's (grade-06).
- **Cloak that should take the donor's cloak motion:** pair-02 and fresh-08 (Eredar), and
  humanoid-493. The original cloak does not move either, so nothing breaks; the motion is
  missing.
- **Visible faults it still misses:** pair-18 (weapon angle), pair-31 (arms not attached),
  pose-support-07 (shield placement), grade-30, grade-21, humanoid-95 and -195 (Skink pipe),
  fresh50-31 (Gnoll).

## Sweep over the saved pair lists

`sweep.mjs` rebuilds today's transplant (Auto fix off; mirror as the window picks it) for the
overnight humanoid 1,000 and panel 61 lists. 888 pairs still have both files. It measures each
result against the donor and the original. The results are in `D:\Claude\xfer-look\sweep-888.jsonl`,
with counts below.

SWEEP-RESULTS

## Next

1. Look at the visible misses side by side and add what they need. Then rerun `tune.mjs` and the
   held-out check: the held-out score has to rise, not only the tuned one.
2. Fix the most common failure types in the normal engine, one type at a time. Before showing
   any sheet, rerun the sweep: the flagged count of that type falls, and the other types do not
   rise.
3. Show the owner only pairs the check passes.
