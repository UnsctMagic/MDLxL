# XFER transplant overnight run (19 → 20 Nov 2026, 22:47 → 09:00)

Owner's orders (quoted, 19 Nov ~22:45): "A TRANSPLANT IS 100% A TRANSPLANT." Fix that, then "run tests ALL
night ... EVERY single combination possible of EVERY model in SD wc3 PLUS every model in the low polyworks
repo PLUS whatever you find in my downloads ... cheap workers to run the actual transfers, you will examine
them as Opus high - you will find and correct issues using agents ... There will be no fable involved ...
this task runs TIL 9 AM." Nudge every 30 min; hourly status.

## Rules for every worker
- No Fable. Cheap workers (Sonnet) run/supervise sweeps; Opus (high) analyses and fixes.
- Local commits only on `claude/transfer-xl`; never push. Never touch the main checkout.
- Never delete/move anything in `D:\Claude\MDLxL-TestModels` or Downloads (read only).
- Sweeps: Idle priority; up to 12 node processes overnight (16 logical cores).
- "Fine" means LOOKS like the donor (look metrics), not just "didn't crash".
- Regression gate: no change may make any panel pair worse on any look metric.

## Model sets
- SD: `D:\Claude\MDLxL-TestModels\corpus-sd\*.mdx` (398)
- LowPolyWorks: `D:\Claude\lpw-main\dist\models\*.mdx` (29)
- Downloads: `C:\Users\PC\Downloads\**\*.mdx|mdl` (115, read in place)
All ordered pairs (~294k) as own × donor, Mirror as the window sets it.

## Plan
1. [x] Look metrics + resumable full-sweep runner + 61-pair regression panel (Opus high) — out/transfer-probe/overnight/
2. [ ] 100% transplant: model takes the donor's posture (hunch, arms at sides), not only its movement (Opus high)
3. [~] Baseline full sweep on current engine (df9c4059, frozen in `base/`), started 23:09, 10 shards Idle (Sonnet supervises shards)
4. [ ] Loop: Opus high analyses results → issue classes → Opus fix agents → panel gate → resweep
5. [ ] 09:00 final report for the owner + build for hand test

## How to run
All commands from `out/transfer-probe/overnight/` (in the worktree). Everything there is read-only on models.

**Look metrics** (`look.mjs`, thresholds in `thresholds.json`, calibration `calibrate.mjs` + `calib-stats.mjs`):
result vs donor (reflected when Mirror is on), every animation but Portrait, 12 frames each; joints paired through
`report.donorNodes`. The yardstick always reads bodies with the frozen engine copy `base/src` (df9c4059), so a new
engine is measured with the same ruler. Rigs are read as the transplant reads them (`transplantReading`, copied into
look.mjs from 7f2c3454: the Ghoul's forearm ends at `Bone_Hand_R`, not the parked `Wrist1`). Ruler v3 (20 Nov, Y1-Y3,
T1, Ghoul forearm, neckless neck); v2 kept in `analysis/look-before-y1y3.mjs`. Ruler v4 (20 Nov 01:00, v3 kept in
`analysis/look-v3.mjs`): (a) feet-off-target reads only legs that carry skin; a side with none left (G1 soles down) reads
its lowest visible mesh point above its own Stand floor, median over the frames; (b) a donor death animation that hides
its living body on a twin corpse skeleton is read on the corpse joints (`donorTwins`, the engine's twin rule copied);
(c) bind reach ignores geosets hidden in every animation; (d) the torso capsule radius ignores vertices that reach a
trunk joint through a joint with keys of its own (the Knight's horse neck and head). Examples: `v4/check.mjs`.
- `pose`: angle of each segment (neck, arm/leg/tail/wing upper, lower, endN) result vs donor in the body frame
  (pelvis origin, up pelvis->chest, across right->left). Bad when median > 15 deg or p90 > 30 (neck 35/55). Donors with
  no neck joint: `neck` = the head joint's turn (the donor's bind chest->head line turned by the head joint) in the body
  frame, as the engine poses it, not chest pivot -> head pivot.
- `posture`: spine pitch (pelvis->chest along the facing) result minus donor, the hunch. Bad when |median| > 10 deg.
- `collapse` (Y3): limb root-to-end over its bind PATH length (sum of segments), so keeping a bent pose is not a
  collapse; a frame is short when the result is under 50% where the donor is not AND under 0.8x the donor; bad in > 25%.
- `reach`: same from the limb's own vertices (90th percentile distance from the limb root); a frame is short only when
  short both against the bind reach and scaled by the bind bend (straight/path).
- `inside` / `hand-inside` (Y1): arm vertices / hand inside the torso capsule (pelvis->neck, radius = 60th percentile of
  the vertices the OWN model calls trunk; arm vertices = those the own model calls arm); excess = result minus
  max(donor, own model in its own animation of the same kind, else its Stand); bad > 0.25 (vertex share) / > 0.3 (frames).
- `geoset` (v2, by kind, 19 Nov 23:50): each result animation is compared with the model's OWN animation of the same
  kind (`sameKindSequence`, the engine's refit rule: same name, else same first word; else its Stand), so Spell glows,
  Morph forms, Lumber and Victory pieces are fine where the model's own animation shows them. Death/Decay/Dissipate
  compare with the Stand (the living body dies). `hidden-geoset` = shown in the result but hidden in that own animation;
  `corpse-geoset` = a geoset the model shows in no everyday animation (corpses, portrait planes) shown anywhere. Any is
  bad. v1 (Stand only) is kept in `analysis/look-before-geoset-by-kind.mjs`; `sweep-base/code` still runs v1, so its
  geoset rows over-count (re-score or read them with v2 in mind). Panels re-run with v2: `panel-base2.json`,
  `panel-geoset2.json`; identity calibration v2: `analysis/calib-base2` (76 of 100 geoset), `analysis/calib-geoset2` (0).
- old checks kept: throws, non-finite data/vertices/matrices, scale absurd, flung, exploded, mesh vanishes, extents,
  validateModel errors (=> `broken`); ground (sinks/floats/feet off target) and slow (=> `look-bad` / note).
  `mesh vanishes` (Y2) in Death/Decay/Dissipate: share of each model's living body (its Stand geosets) hidden by alpha OR
  scaled to nothing, result vs donor (+0.02); not flagged where the donor hides >= 50% of its own. Other animations: as before.
- `no-rig` (T1): an own model or donor with no readable skeleton (no bone or helper, e.g. Plague Cloud) is `no-rig` with
  a plain reason in `why`, also when the engine throws, not `broken`.
- Verdict per pair: `ok` / `look-bad` (+ `cls` = which metrics, `why` = details, `severe`) / `broken` / `no-rig`.
- Thresholds: identity calibration (100 SD models onto themselves) gives pose medians p99 0.8 deg, posture p99 0.5 deg,
  collapse/reach 0, so every threshold is over 10x the identity noise; cross-model pivot placement moves directions up to
  ~10 deg (Footman on Knight neck 21 deg with identical keys), hence 15/30 and neck 35/55.
- One pair: `node look.mjs <own> <donor> [--mirror true|false|window] [--engine <skeleton-transplant.js>] [--debug]`

**Regression panel** (the gate for every engine change): 61 fixed pairs in `panel.json` (`make-panel.mjs`).
```
mkdir eng-<rev> && git -C ../../.. archive <rev> src app/classic-gestures.js docs/AI-SD-STUDY-DATA.json | tar -x -C eng-<rev>   # freeze the engine to test
node panel.mjs --engine eng-<rev>/src/skeleton-transplant.js --out panel-<rev>.json --jobs 6      # ~30-60 s
node panel-compare.mjs panel-base.json panel-<rev>.json    # exit 1 + list when any pair got worse on any metric
```
(`--engine ../../../src/skeleton-transplant.js` tests the live working copy.) Base: `panel-base.json` (df9c4059).
Ruler v3 panels (compare only like with like): `panel-base3.json` (55 look-bad / 6 ok), `panel-geoset3.json` (47/14),
`panel-posture3.json` (`eng-posture/` = 7f2c3454, 39/22); identity calibration v3 `analysis/calib-geoset3` (93/100 ok).
Example checks: `node analysis/y-check.mjs <pairs.json>` (`analysis/y1-|y2-|y3-|t1-pairs.json`, outputs `*-check.txt`).

**Full sweep** (`run.mjs`, `shard.mjs`, `worker.mjs`, `summary.mjs`), 542 models, 293,764 ordered pairs incl. identity,
Mirror as the window sets it. Stratified sample (4,000 pairs over 144 own/donor set x kind strata) runs first in every
shard, then the rest donor by donor. Each shard's workers run a frozen copy of the yardstick in `<sweep>/code`.
```
node run.mjs init   --out sweep-<name> --shards 10                 # once per sweep: models.json + plan.json
node run.mjs launch --out sweep-<name> --engine <path to skeleton-transplant.js>   # start or RESUME, detached, Idle
node run.mjs status --out sweep-<name>                             # progress.json: done/total/rate/ETA + live shards
node run.mjs stop   --out sweep-<name>          # each shard ends after its current pair (add --now to kill at once)
node summary.mjs    --out sweep-<name> [--sample]                  # -> <sweep>/summary.txt (summary-sample.txt)
```
Baseline: `node run.mjs launch --out sweep-base --engine base/src/skeleton-transplant.js` (running since 23:09).
CURRENT sweep (01:02): `sweep-v2` = engine 15ea8d63 frozen in `eng-v2/` (`eng-v2/REV.txt`), ruler v4, 651 models
(SD 398 + LPW 134 recursive + Downloads 119), 423,801 pairs, 14 shards. `sweep-base` is stopped (56,606 rows = the
'before', ruler v1). Compare: `node --max-old-space-size=3072 compare-sweeps.mjs [--a sweep-base] [--b sweep-v2]`
(-> `compare-sweep-base-sweep-v2.txt`; verdict matrix, per class flagged/gone/new, by set, examples; engine AND ruler differ).
Idle priority: `os.constants.priority.PRIORITY_LOWEST` does not exist in Node 22 (it is `PRIORITY_LOW` = 19), so until
01:05 shard/gate/models never set Idle (sweep-v2 was set Idle by hand; shard.mjs fixed for any resume).
Rows: `<sweep>/rows-<k>.jsonl`, logs `log-<k>.txt`. Resume = `launch` again (done pairs are skipped). Per-pair
timeout 180 s (row `timeout`, worker restarted), worker crash -> row `crash`. A new engine needs a new `--out`.

## Log
- 22:47 started. Keep-awake requested. Cron nudges set.
- 23:10 look metrics + panel + sweep runner ready. Panel on df9c4059: 56 of 61 look-bad (32 severe), 5 ok; Berserker
  on Ghoul flagged (posture -27 deg, arms collapse to 35%/58% of their length, hands inside the torso 84%/59% of frames).
  Identity transplants find an engine bug: hidden geosets (corpses, portrait planes, alternates) show in the result
  (Penguin on itself: 58% of its vertices are corpse geosets shown in Stand). Baseline sweep started, ~10 pairs/s.
- 23:11 look metrics OK (Berserker-on-Ghoul flagged). Geoset-visibility fix worker started in separate worktree claude/xfer-geoset; posture worker still running.
- 23:21 Geoset fix 0519aaeb on local claude/xfer-geoset (frozen eng-geoset/): refitTracks lost own visibility keys where a donor animation lies over the own one (copyBodyAnimation clears the span first), so they were held at 1. Identity calib (calib-geoset-wip): geoset 79 -> 33 of 100, corpse 0; the 33 + 6 LPW knights are own same-kind animations (Spell, Morph, Lumber) shown exactly as the model's own (identity scan geoset-same.mjs: 129 of 129 identical). Panel panel-geoset.json: 20 better, 5 -> 11 ok, 1 WORSE = Rat on Dire Wolf floats 0.474 -> 0.681, an artefact (base showed the rat's corpse lying on the ground; the living rat's lowest point is identical frame by frame, geoset-rat.mjs). Tests H1-H3 (H1, H2 fail before), 54/54 + 89/89, retarget baseline 0 differ.
- 23:21 geoset fix done on claude/xfer-geoset 0519aaeb (panel 20 better, Rat-on-DireWolf worse only because the corpse no longer hides an existing float: ACCEPTED by orchestrator). Merge into transfer-xl after the posture worker commits. Analyst started on sweep-base sample + yardstick geoset-by-kind fix.
- 23:24 nudge: sweep-base 10/10 shards alive; posture worker + analyst running.
- 23:55 analyst (Opus): yardstick geoset v2 (by kind) in look.mjs. Panel base2 = base (56/5, 0 worse, 3 better); geoset2 12 ok, 0 geoset flags, vs base2 20 better / 1 worse (Rat on Dire Wolf float, real); identity geoset rows base 76 -> geoset engine 0 (ok 91/100). Sweep-base sample classes (outside pose/posture/geoset) in `out/transfer-probe/overnight/analysis/classes.md`: G1 ground with no paired legs 21.9% (real: no ground reference, feetDown/settleFeet skip), Y1 inside 16.2% (mostly yardstick: capsule from result regions), R1 1/3-leg rig reads (wolves, bears, pig, seal, HD Footman) behind 534 of 1180 ground flags, F1 feetDown re-reads the result's feet (identity Mortar Team/Mammoth, Knight on Wolf Rider), T1 throws 6.8% (Plague Cloud has no joint -> NaN ids), Y2 mesh-vanishes 4.0% (yardstick: donor hides its own body in Death), Y3 collapse 2.2% (yardstick: bind normalisation), K1 flung 2.0% (outsideKept skin stays still: staffs, wheels, ent body), E1 frozen extras (identity Ghoul/War Eagle/Demon Hunter). Order: yardstick Y1-Y3 + T1 now; after posture: worker A F1->G1, worker B E1+K1 in parallel; R1 last.
- 23:46 analyst done (classes.md). Yardstick worker started (Y1-Y3,T1). Engine fixes F1+G1, E1+K1, T1, R1 queued until the posture worker commits.
- 23:54 nudge: checked sweep, posture worker + yardstick worker running.
- 00:00 posture worker (Opus) done: commits 0f2a8185, f828a91b, 85f5b78b, notes 7f2c3454. Transplant takes the donor's posture (bind re-posed into the donor's rest posture, keys untouched; trunk by hips>shoulders landmarks + trunk joints/skin fitted where the donor's are; neck; Ghoul arms end at Bone_Hand not Wrist1 via transplantReading; feet read through the id map = analyst F1 done). Measure: Berserker on Ghoul limb 74->0, spine 71->0.3, neck 100->0. Panel (look.mjs 23:51, base8 vs posture8): ok 5->18, posture 27.2->0.4; gate lists 32 pairs worse with stated reasons (Ghoul arm.lower = yardstick reads Wrist1; Tauren shin; neck chest-pivot artefact; riders mixed). Tests 57/57 + 89/89, baseline z3 vs p1 0 differ. Trials TEST POSTURE 01-04 BEFORE|AFTER. Engine files free for the queued fixes (geoset merge, F1 is done).
- 00:01 posture fix landed (panel ok 5->18/61; Berserker-on-Ghoul 0 deg). Started: Opus merge geoset + G1 ground + donor corpse swap (Berserker vanishes in Ghoul Death) + T1; Opus E1/K1 extras on claude/xfer-extras; yardstick worker extended (Ghoul forearm, neck).
- 00:20 yardstick v3 (Opus, look.mjs only; sweep-base/code untouched). Y1 inside: 11 of 16 analyst examples lose
  inside/hand-inside false alarms (Corrupted Ent, Villager Woman, GUO, Phoenix, both Baron riders ok); mounted knights
  (Tzeentch/Nurgle/Slaanesh/Khorne) stay flagged; Berserker/Kurgan/Graveguard on Ghoul gain a real `inside`. Y2: Death/
  Decay false alarms gone (Orc Warlock/LoC, Hero Lich/Lahmian, Dire Wolf/ChaosDragon, Alchemist/Necrarch, identity
  Battle Troll); Birth x2 + Stand-3 still flagged (not Death). Y3: Quill Beast/Murloc/Pit Lord collapse+reach gone;
  Ghoul donor arms are bent at bind, so Berserker-on-Ghoul `collapse` was the artefact (result = donor 0.35 of path);
  its posture/hand-inside/inside stay. T1: Plague Cloud pairs = no-rig "has no bone or helper". Coordinator adds:
  Ghoul forearm via transplantReading (posture engine arm.lower on Ghoul 51-91 -> 1-4.5 deg) and neckless neck by head
  turn (Footman on Grunt 0.1). Gates v3: base3->geoset3 2 worse (Rat float accepted; Ghoul on Ghoul inside +0.06 under
  threshold), base3->posture3 23 worse (was 32; Tauren leg.end2, ground, riders' inside, Wyvern/Kurgan-on-Knight pose).
- 00:08 yardstick v3 done (panel posture3: 22 ok / 39 bad; 23 worse vs base3 = Tauren shin tip, ground, rider inside, Wyvern Rider/Kurgan-on-Knight pose) -> queued for a pose follow-up worker after the main-line fixes.
- 00:20 engine worker (Opus): merged claude/xfer-geoset into transfer-xl (9eba1a6d, test conflicts only, both kept). Tests 60/60 (H1-H3, Q1-Q5) + 89/89, baseline z3 vs o1 0 differ. Panel gate (`gate.mjs`: both engines measured back to back with one frozen ruler `ruler-<step>/`, 3 jobs Idle): posture 7f2c3454 -> merge: ok 22 -> 37, 20 better, 2 "worse" = Rat on Dire Wolf float (accepted at 23:21, cured by G1) and Ghoul on Ghoul inside armL -0.064 -> 0 (identity now exact).
- 00:28 G1 soles down (35b7614b engine, 35204b70 tests S1/S2, fail on 9eba1a6d): legs not paired -> `solesDown` (own leg skin's lowest vertex, legless: 2nd percentile; legged donor: donor lower foot x travel + own Stand sole; legless donor: own Stand + donor body rise x travel = 'hover'). Tests 62/62 + 89/89, baseline 0 differ. Panel g1: 5 better (Footman on Banshee floats gone), 14 "worse" all `feet-off-target` = YARDSTICK FALSE ALARM: it measures the donor's leg joints in the result, which carry 0 vertices in every one of the 14 (`g1/sole.mjs`, `g1/sole-g1.txt`: skin on donor legs 0). Mesh lowest point vs donor's x travel (median |dev|/H) better in 12 of 14 (Rat 0.377 -> 0.053, Dire Wolf on Tauren 0.298 -> 0.011, Footman on Banshee 0.895 -> 0.164, Kurgan on Khorne Knight 0.041 -> 0.004); Archmage on Paladin 0.08 -> 0.14 and Necrarch Lord on Footman 0.03 -> 0.10 are their own Stand grounds (Paladin's lowest point is his hammer 0.21 H under ground; the Necrarch's robe hangs 0.05 H above it). Yardstick worker: skip feet-off-target when the donor legs carry no skin.
- 00:24 nudge: sweep alive; main-line + extras workers running.
- 00:25 OWNER: LPW has more models (gluma 72, herrdave 28, maximal 4, nurgle 1 = 134 total, sweep-base only had the 29 top-level). run.mjs now walks lpw-main/dist/models recursively. NEXT SWEEP (new engine + yardstick v3) = 647 models (~419k pairs); start it as soon as the main-line fixes land, stratified first; sweep-base (old engine, 542 models) can then be stopped - its 37k+ rows are the 'before' picture.
- 00:27 OWNER: 'clear out old ones' -> deleted superseded test builds (transfer-xl-12..26, zz old builds, anim-01/02/04, ai-full-power..03-astra), 19.3 GB freed, D: 28.3 GB free; launchers repointed to transfer-xl-27. Kept: transfer-xl-27, anim-05, ai-full-power-04*, uv/other feature builds, all sheets + test-models.
- 00:37 E1+K1 extras worker (Opus) done: commit 676d6814 on local claude/xfer-extras (worktree .claude/worktrees/xfer-extras, from 7f2c3454; diff only in the own-extras/outsideKept/skin code of src/skeleton-transplant.js + new test/transplant-extras.test.js + fixture transfer-corrupted-ent). E1: an own extra rides the donor's matching chain (same part, top within 0.1 hip, joint by joint on own pivots; chains holding part joints and the donor weapon chain excluded); outside joints the donor has too (same name+place) take the donor's. K1: everyday-shown outside skin rides the part joint it follows in its own animations (body unless world/part joint drifts <= 0.75 of body's); corpse/portrait unchanged. Identity now exact for the extras of Ghoul, War Eagle, Mammoth, Demon Hunter hair + demon form. Tests X1-X4 fail on 7f2c3454, pass; 61/61 transplant+skin+extras, 89/89 retarget+window, baseline z3 vs x2 0 differ. Panel (eng-extras vs eng-7f2c3454, same yardstick, panel-extras*.json, panel-extras-compare.txt): 2 worse, both false alarms: Villager Man on Footman reach legs (only a geoset hidden in every result animation moved, donor joints identical; look.mjs bind reach counts hidden geosets), Khorne Knight Axe on Knight inside/hand-inside (horse neck+head now move as the Knight's horse, capsule radius shifts; arm joints identical, excess still negative). 0 better (identity pairs were already ok). Not merged into transfer-xl.
- 00:37 extras E1/K1 done on claude/xfer-extras 676d6814 (2 panel 'worse' traced to yardstick: reach counts hidden geosets; Knight horse neck shifts torso capsule) -> ACCEPTED, merge into transfer-xl after the main-line worker finishes; yardstick todo: reach ignores geosets hidden in every result animation.
- 00:40 donor corpse swap (e795111e + a485ffce, tests C1 x3 fail on 35b7614b: 0% shown / root>head 158 deg off the corpse): where a donor death-kind animation hides its living body and shows a death body on a twin skeleton (pivots within 0.03 hip heights under the parent's twin, chain of 2+, 90% of its vertices) the living joints take the twins' world placement (pivots on the twins', baked every 33 ms) and the living body shows where either shows; no twin: in a Death the body stays visible on the living joints until the death body vanishes (Skeleton Warrior: it stands still, flag for the owner); Decay without a twin unchanged (G5). `report.deathSwap`. Berserker/Kurgan/Footman on the Ghoul: visible all through Death, joints on the corpse's. Q1/Q4 now read the Ghoul's visible joints in Death (trunk line slack 6 deg, Footman 5.4). Tests 65/65 + 89/89, baseline 0 differ. Panel corpse: 7 "worse", all Ghoul donors (incl. Ghoul on Ghoul), pose p90 against the Ghoul's HIDDEN living joints = YARDSTICK FALSE ALARM: `corpse/deathpose.mjs` (`deathpose.txt`), Death, every segment with a <name>01 twin: against the visible corpse p90 72 -> 0.1-1.3 deg, against the hidden joints 0-1 -> 72. Yardstick worker: read the donor's visible (twin corpse) joints where its living body is hidden. First version had a false twin (Gargoyle's one statue bone; Doom Guard on Gargoyle tail p90 16.3 -> 18.7), fixed by the chain rule.
- 00:49 engine worker: T1 cbc39957 (test N1 fails on a485ffce with "Geoset 0 references missing node NaN."): a model or donor with no bones or helpers throws "The donor has no skeleton to transplant onto (it has no bones or helpers)." / "This model has no skeleton to transplant ..." before anything is read; the window shows thrown text; look.mjs scores Footman on Plague Cloud `no-rig`. Panel t1 vs corpse: 0 worse, 0 better (GATE PASSES). Corpse swap size fix 82a73f98: baking every 33 ms over the Ghoul's 60 s Decay Flesh made Berserker on the Ghoul 3.2 MB (was 258 KB); now per joint at its twin's keys + halves where a straight line misses by 0.01 hip heights / 1 degree: 297 KB; panel corpse2 vs t1: 0 worse, 4 better (GATE PASSES); visible-corpse p90 still 0.6-1.3 deg (`corpse/deathpose2.txt`). Tests 66/66 + 89/89, baseline z3 vs c5 0 differ after every step. Trials `TestBuilds\test-models\TEST POSTURE 01-04 AFTER2.mdx` (82a73f98, `posture/make-posture-trials-after2.mjs`, `trials-after2.txt`; validated, reopened, 0 errors; its Death numbers for 01/03 are read on the Ghoul's hidden living joints, see deathpose). Open: yardstick false alarms (feet-off-target on skinless donor legs; Ghoul Death pose against hidden joints); no-twin Death (Skeleton Warrior as donor) now stands still visible until its bone pile vanishes, as ordered: owner to judge; Footman on the Ghoul trunk line up to 5.4 deg off the corpse (separate corpse waist root).
- 00:50 main-line done (merge geoset, G1, corpse swap, T1; all 'worse' = yardstick). Started Opus: merge extras + yardstick v4 + launch sweep-v2 (647 models, 14 shards) and stop sweep-base. Next: R1 recogniser legs + rider pose worker after the merge.
- 00:54 nudge: checked sweeps; merge/yardstick-v4/sweep-v2 worker running.
- 00:54 R1 legs + rider pose worker started on claude/xfer-r1.
- 01:12 merge/yardstick/sweep worker (Opus): (1) merged claude/xfer-extras 676d6814 into transfer-xl = 15ea8d63 (one
  conflict, the report line: kept `riders` and `deathSwap`). Tests 159/159 (skeleton-transplant + skin + extras 70,
  anim-transfer + transfer-window 89), retarget baseline z3 vs m1 32 trials 0 differ. (2) Ruler v4 (see How to run).
  Pure ruler effect on the same engine (15ea8d63, `panel-head3.json` ruler v3 vs `panel-head4.json` ruler v4,
  `v4/cmp-head3-head4.txt`): ok 25 -> 37; flags gone: (a) feet-off-target on Kurgan/Felhound, Archmage/Paladin,
  Centaur/Footman, Footman/Centaur, Rat/Dire Wolf, Necrarch/Footman, Dire Wolf/Tauren; (b) Ghoul donors' Death pose:
  Ghoul on Ghoul p90 106.6 -> 0, Berserker 03/04, Kurgan, Grunt, Footman, Graveguard on the Ghoul p90 70-112 -> 1-10;
  (c) Villager Man on Footman reach legs 0.45/0.48 -> ok; (d) Khorne Knight Axe on Knight ok (hand-inside stays
  negative). Still flagged (real): Shade on Footman (floats + feet 0.35 hip heights by mesh), Green Dragon on Frost Wyrm
  0.35 and Bones on Green Dragon 0.36 (feet by mesh, for the owner's eye), Gargoyle on Doom Guard (leg pose 33 deg +
  sinks), Wyvern Rider on Gryphon Rider (pose, plus a NEW feet 0.17: only skinned legs compared now), Footman on Ghoul
  sinks 0.32; base engine under v4 (`panel-base4.json` 4 ok / 57) keeps the Ghoul pairs bad (corpse unswapped). The 10
  "worse" of head3->head4 are inside excess shifts that stay negative or under 0.25 (capsule radius without the
  horse neck), none flagged except the Wyvern feet. Panel ruler v4: base3 engine (df9c4059) 4 ok / 57 look-bad; head
  15ea8d63 37 ok / 24 look-bad. Identity calibration v4 on 15ea8d63 (`analysis/calib-head4`): 95/100 ok (v3 geoset
  engine 93); left: Beastmaster + Pit Lord flung-vertices, Dragonhawk + Vulture sinks, Ridden Hippogryph leg.end7 pose.
  (3) sweep-v2 launched 01:02: `mkdir eng-v2 && git -C ../../.. archive 15ea8d63 src app/classic-gestures.js
  docs/AI-SD-STUDY-DATA.json | tar -x -C eng-v2`, `node run.mjs init --out sweep-v2 --shards 14` (651 models: sd 398,
  lpw 134, dl 119; all readable; 423,801 pairs, sample 4,000 over 196 strata), `node run.mjs stop --out sweep-base`
  (stopped at 56,606 rows), `node run.mjs launch --out sweep-v2 --engine eng-v2/src/skeleton-transplant.js`. Shards were
  at Normal priority (PRIORITY_LOWEST is undefined in Node 22; fixed to PRIORITY_LOW in shard/gate/models.mjs), set to
  Idle by hand: 28 processes Idle; shard parents are gone (WMI launcher), they outlive this session. Status 01:11:
  done 4,270 / 423,801 (1.01%), sample 3,645/4,000, 8.2 pairs/s, ETA 14.2 h, 14/14 shards alive. compare-sweeps (01:09,
  407 common pairs, `compare-sweep-base-sweep-v2.txt`): ok 86 -> 140, look-bad 271 -> 184, broken 24 -> 9, no-rig 26 ->
  74 (all Plague Cloud / Plague Cloud Target, T1: base v1 scored them ok/look-bad); per class gone/new: geoset 117 -> 0,
  posture 108 -> 50, pose 155 -> 99, inside 65 -> 15, hand-inside 48 -> 17, mesh-vanishes 11 -> 0, flung 13 -> 8,
  collapse 10 -> 3, ground 112 -> 116 (43 gone, 47 new: next look).
- 01:12 sweep-v2 running (651 models, 423,801 pairs, 14 shards, ~8.2/s -> ~55% by 09:00, stratified first). Panel head4 37 ok / 24 bad (base 4/57). NEXT at ~01:45 nudge: Opus analyst on sweep-v2 sample (ground 47 new, remaining pose/posture), then fix workers; merge claude/xfer-r1 when done.
- 01:16 sweep-v2 sample done: ok 40.7% (base sample 16.7%), broken 1.1% (base 10.4%). Analyst v2 started on it.
- 01:21 OWNER: 'use this run to also fix other things' -> 1 Retarget mode + 2 ANIM. Started Opus workers on claude/xfer-retarget and claude/anim-overnight (ANIM merges transfer-xl to run on transplant results).
- 01:24 nudge: sweep-v2 checked; analyst v2, R1, Retarget, ANIM workers running.
- 01:53 analyst v2 (Opus) on the sweep-v2 sample, POPULATION-weighted (the stratified sample over-weights rare kinds:
  Plague Cloud x2 = 11.9% of the sample, 0.6% of pairs): v4 ok 46.7% / look-bad 49.5% / broken 3.1% / no-rig 0.6%.
  `out/transfer-probe/overnight/analysis-v2/classes.md`. no-rig = only Plague Cloud + Plague Cloud Target (0 nodes,
  0 vertices): correct, no unit. Proven yardstick false alarms -> **ruler v5 now installed as look.mjs** (v4 kept in
  `analysis-v2/look-v4.mjs`; sweep-v2 keeps its frozen v4 in sweep-v2/code): sinks/floats against each model's own
  Stand floor/sole (78 models stand below the origin: flyers, swimmers); feet-off-target mesh side reads the engine's G1
  sole at the Stand's first frame (90% of feet flags: engine on its target, v4 read weapon tips/tails); hock legs read
  as thigh + knee->foot (owner's straight shin: 33% of leg.lower/end2 weight, offsets = the donor's bind hock bend);
  body frame/posture by hip/shoulder landmarks for biped trunks (55% of posture weight: chest pivots; Fire Pandaren on
  Spanish Halberdier 35.7 -> 1.4 deg); flung ignores never-moving bones (hero glow left on the ground in Dissipate, as
  the donor's own); segments pair by label (v4 compared nothing when a pelvis/chest was missing). Same engine, 180
  population pairs: ok 47.2 -> 65.6%, feet-off 18.3 -> 3.9, leg.lower 16.7 -> 2.8, sinks 22.2 -> 16.1; panel 37 -> 48 ok
  (`analysis-v2/panel-head5.json`). REAL, ranked: (1) body dips ~16%: weapon/arm tips/upright dragon bodies under the
  ground while feet are right = 100% transplant on longer parts -> owner option G-OPT (opt-in lift, off by default);
  (2) rider/mount + dragon posture ~6% (R1 rider pose); (3) inside on owns whose front legs/wings read as arms ~4% (R1);
  (4) leg pairing knee<->hock flips L/R on Lord of Change donors ~1.5%, `limbPairing` anim-transfer.js 1612 -> R-B,
  after R1 (same file, shared with retargeting: baseline must stay 0 differ); (5) odd-leg reads = R1 (5.7% of pairs touch
  one); (6) G1 sole reference at Stand frame 0 (`solesDown` 1796, Faerie Dragon) small; (7) throws: Undead Car
  keptExtra<->targetOf recursion (skeleton-transplant.js 728), Revenant Matrix undefined, Far Seer KEYFRAME_ORDER.
  Parallel: G1b/G-OPT (skeleton-transplant ground functions) with R1; R-B after R1.
- 01:54 nudge: sweep-v2 checked; workers running.
- 01:54 analyst v2 done: ruler v5 live (weighted ok 46.7% under v4 -> ~65.6% under v5 on a 180-pair representative set; panel 48 ok). Started Opus: solesDown median + 3 throws on transfer-xl. Row 3 (own long weapon/arms under ground: opt-in lift) WAITS for owner. Row 10 (knee/hock L/R pairing) after R1.
