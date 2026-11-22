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

At `a96fd433`, the check flagged 259 of 888 distinct transplants. All 888 had measured clips. A pair can have several reasons. Arrows run from the animation donor to the model wearing it. H is the humanoid list and P is the panel.

| What the check saw | Pairs out of 888 | Three examples |
| --- | ---: | --- |
| Skin tears or stretches | 91 | H27 Dreadlord → Grunt, H50 Dark Troll → Gnoll Archer, H62 Chaos Wolf Rider → Archmage |
| Body curls up or collapses | 71 | H69 Demon Hunter → Mountain King, H286 Mountain King → Grunt, H314 Pandaren Brewmaster → Tauren |
| A held piece comes off | 48 | H21 Grunt → Satyr, H296 Wendigo → Razormane, H606 Huntress → Knight |
| Skin squashes flat | 44 | H206 Huntress → Archmage, H268 Human Mage → Watcher, H316 Druid of the Claw → Villager Woman |
| Shakes more than the donor | 37 | H489 Chaos Peon → Warden, H867 Murloc → Demon Hunter, P32 Footman → Shade |
| Bobs more than the donor | 28 | H39 Footman → Kurgan Warlord, H85 Chaos Wolf Rider → Knight of Khorne, H444 Sea Giant → Bray-Shaman |
| Floats or sinks compared with the donor | 24 | H45 Hippogryph Rider → Gryphon Rider, H69 Demon Hunter → Mountain King, H506 Demon Hunter → Blademaster |
| Legs, tail or cloak stop moving in Walk | 19 | H69 Demon Hunter → Mountain King, H471 Murloc Mutant → Kobold Geomancer, H943 Villager Woman → Priest |
| A body part that normally moves stays still | 13 | H35 Banshee Ranger → Blood Mage, H574 Shandris → Paladin, H874 Warlock → Jungle Beast |

### Stretched skin in the normal transplant

Sampling every fourth stretch warning in manifest order gave 23 pairs. The same piece of the original chest could be cut across separate donor joints by the height split. For example, on H912, Felguard → Murloc, 18 stretched edges had both ends on the Murloc’s original chest. On H153, Brewmaster → Minotaur, 98 came from a single original torso bone. The first trial keeps a torso region on its own mapped joint when native skin already covers every bend carrying the donor’s torso.

The check also flags an intended donor movement. In Attack Slam at 408 ms the Gor enlarges its visible head. Of 202 edges rigidly on its head, 51 grow past 1.5 times their starting length. The longest ratio is 1.667 on the donor, 1.678 on the Ghoul (H75) and 1.679 on Jaina (H982). This head stretch follows the donor. Other edges and other warnings on those pairs still count. The published look check and its thresholds are unchanged.

The first trial reduced stretch from 91 to 75. It cleared 15 pairs of every warning and introduced body collapse on two formerly clean pairs. Other counts were unchanged except for still body regions (13 → 11) and body collapse (71 → 73). Of 138 replayable high grades, 59 changed. Six of the changed exports failed the check, and the Kurgan → Tauren binding test lost its two required blended vertices (250 of 251 tests passed). The trial was rejected.

| Changed high grade that still flagged | Reason on the trial |
| --- | --- |
| Dire Ice Troll → Kroxigor Ancient | Stretched skin |
| Murloc Behemoth → Sea Giant | Body collapse and stretched skin |
| Baphomet Sr → Tyrael | Excessive bob and still body region |
| Lichling → Villager | Still skin in Walk |
| Fel Vindicator → Dark Hunter | Body collapse |
| Black Fur Great Knight → Brigand | Body collapse |

The second trial compares a sewn torso edge under two independent donor hinges with that edge on the recipient’s authored weights in the same pose. It retains those weights only when the hinges swing more than a right angle apart from their starting relation and the proposed height cut more than doubles the edge against both its bind length and its length on the paired weights. Other donors, other joints and surfaces without this fault use the starting engine’s assignment.

### Round outcome

Both trials failed their gates. The first rule repainted too many surfaces that the owner had accepted. The second cleared one stretch warning in 888 pairs, Felguard → Murloc (H912). It changed ten high-grade results. Eight passed the look check. Two changed and still flagged.

- Murloc Behemoth → Sea Giant, grade 9. Body collapse stayed at 0.442 in Walk Swim (limit 0.402). The stretched-edge share in Spell fell from 6.5% to 6.0% (limit 3.46%).
- Fel Vindicator → Dark Hunter, grade 10. Body collapse stayed at 0.425 in Stand - 4 (limit 0.402).

Both warnings were present on the owner-graded files. Under this round’s rule a changed high-grade result has to pass the entire check. All 251 tests passed on the second trial. The two-trial stop applies to stretched skin, so work on the lower-ranked reasons ended here.

| Look-check reason | Start | First trial | Second trial | Retained |
| --- | ---: | ---: | ---: | ---: |
| Skin tears or stretches | 91 | 75 | 90 | 91 |
| Body curls up or collapses | 71 | 73 | 71 | 71 |
| A held piece comes off | 48 | 48 | 48 | 48 |
| Skin squashes flat | 44 | 44 | 44 | 44 |
| Shakes more than the donor | 37 | 37 | 37 | 37 |
| Bobs more than the donor | 28 | 28 | 28 | 28 |
| Floats or sinks compared with the donor | 24 | 24 | 24 | 24 |
| Legs, tail or cloak stop moving in Walk | 19 | 19 | 19 | 19 |
| A body part that normally moves stays still | 13 | 11 | 13 | 13 |
| **Pairs with any warning** | **259** | **246** | **258** | **259** |

All three sweeps have exactly the 888 manifest keys, no error rows and at least one measured clip per pair. Both experimental engines were removed. The retained normal engine, Auto fix and look-check files match `a96fd433` byte for byte. The retained column therefore uses its completed baseline sweep. Zero pairs qualify for the requested grade sheet. The sheet viewer requires at least one qualifying pair.

The high-grade inventory is 140 results. Of the 138 that could be rebuilt, the starting engine reproduced 110 archived exports byte for byte, 27 older differences passed, and one older difference (Paladin → Kobold Geomancer, grade 9) already flagged for collapse. The original Daemonette21 recipient for grades 24 and 37 is unavailable. Neither row was counted as a successful replay. The unchanged final engine introduces zero high-grade changes. The accompanying report names every high grade that changed in either trial. [Graded replays](xfer-look-fixes-grades.md)

The complete measurements and per-pair changes are saved locally in the worktree’s `out/look-fixes` directory (`stretch-1.jsonl`, `stretch-2.jsonl` and their `-delta.json` reports).

On the retained engine, all 251 tests passed across skeleton transplant, Auto fix, animation transfer and the transfer window. None were skipped. The log is `out/look-fixes/retained-tests.log`.

The single packaged reference build opened `TEST XFER AUTOFIX 02.mdx` in a hidden window. After 10 seconds the model canvas measured 1024 × 735, with zero preview errors or crashes. Packaging verified 1,659 runtime and asset files. The packaged normal engine has the same SHA-256 as the starting engine (`52d049cb8587548d21b1b3850eb46aa6af27380194427541a2e42255ae4d7236`).

## Next

1. Look at the visible misses side by side and add what they need. Then rerun `tune.mjs` and the
   held-out check: the held-out score has to rise, not only the tuned one.
2. Fix the most common failure types in the normal engine, one type at a time. Before showing
   any sheet, rerun the sweep: the flagged count of that type falls, and the other types do not
   rise.
3. Show the owner only pairs the check passes.
