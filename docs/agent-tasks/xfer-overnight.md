# XFER transplant overnight run (19 → 20 Nov 2026, 22:47 → 09:00)

UPDATE 20 Nov ~02:30, owner: "dont stop at 9 either - keep going with this task until its finished or I say stop." The run has NO end time.

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
- **SHARED RULER = v8 since 20 Nov ~05:10** (`look.mjs` + `worker.mjs` = `humanoid/ruler-v8` plus the `LOOK_RIG_ENGINE`
  option; v6 kept as `look-v6.mjs` / `worker-v6.mjs`). v8 = v6 + humanoid v7 a/b (flung/vanish excused on donor joints
  the donor itself throws/hides; riders' arms against chest->neck) + v8 c/d (donor ground against its body height, reach
  against the geosets that animation shows); evidence `humanoid/classes.md`. Panel under v8 for 288b945a
  (`eng-288b945a/`): `panel-288b-v8.json` 50 ok / 11 look-bad, identical to `humanoid/panel-t5-v8.json` (0 worse,
  0 better). Compare v8 panels only with v8 panels (`panel-base*.json` are older rulers). `panel.mjs` now sets Idle.

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
- 01:57 RETARGET worker (Opus, owner 01:20 "check and fix Retarget"): worktree `.claude/worktrees/xfer-retarget`, local
  branch `claude/xfer-retarget` (from 5d3e5d7a). Yardstick `out/transfer-probe/overnight/retarget/rlook.mjs` (window
  emulation: Take whole body Mine / Theirs, Add all; motion = own reference turned by the donor's turn, pose = direction vs
  donor in anchor frames, mesh trunk posture, loose joints, pops, feet, travel, collapse, inside, broken); identity
  calibration 100 models (`retarget/calib`); 3,000-pair sample running (`retarget/sample`, 3 shards Idle, engine frozen in
  `retarget/eng-base`, yardstick frozen in `rt-code-s1/`). Commit 6bd4caff: camera roll keys written as quaternions in
  every new animation (validate errors, other__orccar) and weapon lift = full quarter turn where none clears the floor
  (arm pops 83-166 deg/step in Deaths). Tests C1/W1 fail first; 91/91; retarget baseline 0 differ.
- 02:10 R1 worker (Opus): commit 0302dc4a on local claude/xfer-r1 (worktree .claude/worktrees/xfer-r1, from 15ea8d63; engine frozen in `overnight/eng-r1/`). Shared recogniser (pose-ik.js readPoseRig, clues on only; clues off identical for all 1243 models): legs read in mirrored pairs. A Hand ref above a named foot = forepaw; a Hand-ref paw mirrored by a leg, both standing, = leg (wolf rig front right: Dire/Timber/White/Spirit Wolf, Spirit Pig, Thrall, Far Seer, Snapdragon, Fel Stalker; bears' front left; Druid bear form); an unnamed twin of a named leg is a leg (Zergling, Felhound); a limb chain through the joint its mirrored twin also hangs from is re-read below it (pig/sheep/seal hips, wyvern/hippogryph/faerie dragon/Archimonde/Sargeras hips, Wyvern Rider + Archnathid family + Infernal chests); the SD numbered-helper extension no longer climbs through a shared hip; short legs (1-2 joints) as `stubs` (pig, Fel Boar, sheep, seal, rat, flying sheep; Arthas/DK/Malfurion seated riders gain their 2-joint legs); an HD hand on its last twist joint reads upper arm>forearm>hand; an arms-only turret root at a 2-leg pelvis root = one creature (HD Footman: body pelvis, real legs, `uppers`). Transfer: stubs are limbs, short legs' hip height to their soles. Transplant: short legs on either side stand by soles (G1). Proof: rig-dump 1207 models: 1102 same, 105 differ (all listed in out/transfer-probe/rigdiff-a5-compact.txt of the r1 worktree, each a model with a misread limb or a limb swallowing its shared hip/chest; no rider lost its two-creature reading); retarget fingerprints (r1-retarget.mjs: 398 SD x Grunt/Dire Wolf Walk + Footman x 398): 399/1192 differ = every Dire Wolf-donor row (the wolf now walks on 4 legs) + rows of the changed models only; baseline z3 32 trials 0 differ; riders gate 95 built 1 flag as before. Tests L1-L4 fail on 15ea8d63, pass; S3 Felhound 3->4 legs, S1 rat now soles measured on its legs (legs at rest in Attack Slam; old engine floated them 0.3-0.45 H), Bone Namer Archnathid Box23 -> Bone_Chest (it carries both arms). 176/176 transfer+transplant, 207/211 (3 skip, 1 fixed) POSE+Bone Namer, 89/89 AnimXL/Attachemator/Corpse.
- 02:10 R1 panel (ruler-r1 = yardstick at 5d3e5d7a, head eng-5d3e5d7a vs eng-r1, panel-r1-prev.json / panel-r1.json / panel-compare-r1.txt): ok 37 -> 35, 7 better, 9 worse, GATE FAILS on paper. Better: Wyvern Rider on Gryphon Rider loses all 4 pose flags (arms 30, legs 22 deg), Dire Wolf on Tauren loses 7 pose flags, Felhound on Dire Wolf loses inside 0.563, Infernal on Grunt -> ok. Worse, with reasons: Footman HD on Grunt (feet-off 1.526) and Grunt on Footman HD (0.894) = YARDSTICK FALSE ALARM: the ruler reads rigs with base/src, where the HD Footman's legs are its forearm twists (own ground 56.5); real lowest points: old engine floated the HD Footman 6.0 above the donor's 0.3 and sank the Grunt to -10.7, new 0.4 vs 0.4 and -0.1 vs -0.1. Felhound on Dire Wolf feet-off 0.229 = ruler's 3-leg base reading: the engine now plants the lowest of 4 feet (front right included), the ruler's lowest of 3 differs in one Walk frame (8.7 vs 0.3), medians -1.3 vs -1.6. Wyvern on Gryphon feet-off 0.172->0.287 = ruler switches to mesh mode (base reading's legs carry no skin); result lowest now nearer the donor's (Stand -56.8 vs -70.2, was -52.6 vs -99.4). Sheep on Rat: new tail reach row = 0 (no short frame). Kurgan on Felhound inside +0.05, Infernal on Grunt inside +0.13 (both under threshold, unflagged; base ruler calls the Infernal's chest skin arm). REAL: Rat on Dire Wolf ok -> sinks 0.498 in Attack Slam: the rat's legs now stand at their Stand height all through (old floated them), its tail (longer than its height) follows the wolf's tail through the floor; size 0.434 -> 0.183 (the rat now has a measured hip). Dire Wolf on Tauren neck med 33.6 -> 43.6 (a quadruped on a biped; trunk fit lost the misread front-leg shoulder): not traced. Not fixed (owner/orchestrator call): Tauren leg.lower 56 / leg.end2 48 deg is constant over every own model and animation with feet on target = the straight-shin rule against the Tauren's 3-segment hoofed leg, segment by segment (no foot misplacement); Wolf Rider on Knight leg.lower 25 deg constant in every clip = wolf 3-joint legs on the horse's 4-joint legs, same kind; Kurgan on Khorne Knight Axe p90 33 comes only from Death and Decay Flesh, where every segment is off by the same ~35 deg for the whole clip = body-frame mismatch (likely the ruler's death-root joints), limbs fine elsewhere (med 1-7). Yardstick todo: read rigs with the engine under test (or R1) so HD/wolf/rat legs are the real ones.
- 01:57 R1 done on claude/xfer-r1 0302dc4a: 105 misread rigs now read right (wolves, bears, pig, rat, HD Footman, wyverns...). Retarget changes only on those (399/1192 fingerprints, all Dire-Wolf-donor rows + changed models; 32-trial baseline 0 differ). Panel: 7 better / 9 worse (5 yardstick, Rat-on-DireWolf tail through floor = row-3 class, 2 untraced small). ACCEPTED: merge after the sole-median worker finishes; then yardstick reads rigs with the engine under test; then row 10 knee/hock pairing. FLAG FOR OWNER: biped taking a 4-legged walk in Retarget now gets only the head.
- 02:40 sole-median + throws worker (Opus): commit 5f337969 on transfer-xl (skeleton-transplant.js only + tests + fixtures;
  engine frozen in `overnight/eng-g2/`, head e14f4fdb in `eng-head/`). G1b: `solesDown` own sole = median over 12 moments
  of the own Stand (was its first frame). Throws: `targetOf` cycle guard (Undead Car: skinned Bone_MasterRoot rides its
  hips, the hips' anchor is it -> re-read from the joints above); the hands the weapon was baked onto stay through the
  donor-bone prune (Revenant on Skink High Priest: Wrist1 lost all skin to the staff, then was pruned); no key at the start
  of an animation that is not a signed 32-bit span (Far Seer "nothing" 4294967129..0). All 34 sweep-v2 throws/KEYFRAME_ORDER
  rows now made, no new validate codes (`g2/rerun.mjs`). Tests S3, V1-V3 fail on e14f4fdb, pass; 74/74 transplant+skin+
  extras, 89/89 anim-transfer+window, retarget baseline z3 vs g2 32 trials 0 differ. Gate `node gate.mjs g2 head g2`
  (ruler v5): 48/13 both, 0 worse, 0 better -> PASSES (panel holds none of these pairs). Pair checks (`g2/look-*.txt`,
  v5): Undead Car on Footman, Revenant on Skink broken -> ok; White Wolf on Far Seer broken -> look-bad (tail.upper 51 deg,
  was hidden by the throw); Faerie Dragon on Footman / on Baron ok -> feet-off-target 0.945 = RULER FALSE ALARM: v5's
  Y5f reads the sole against the Stand's FIRST frame, exactly the reference G1b replaced; 0.945 = the dragon's own
  first-frame vs median sole gap (-0.40 vs -1.34 hip heights). By the median the result's sole is within 0.1 hip at every
  Footman-on-its-feet moment (S3; head 0.99 off), and its mesh centre hovers nearer its own (own Stand 0.42-0.85 hip, head
  2.1-2.6, now 1.2-1.7; `g2/hover.mjs`). Yardstick todo (v6): Y5f reference = median Stand sole, as the engine.
- 02:14 sole median + 3 throws done (5f337969; 34 throwing sweep rows now build). Started Opus: merge R1 + ruler v6 (rigs read by engine under test, median sole) + row 10 knee/hock pairing. C: 15.8 GB (pagefile 12.8 GB grows with memory pressure; owner told; threshold 8 GB).
- 02:21 OWNER TARGET: humanoid->humanoid (incl. riders like Wolf Rider orc <-> Knight) must work ~99%. sweep-v2 biped->biped now 57.9% ok / 8.2% broken (v4 ruler, pre-fixes). Started dedicated Opus humanoid worker (measure now, fix after the R1 merge, loop until 08:30 or >=99%).
- 02:21 OWNER: humanoid worker does not stop until done (>=99% humanoid->humanoid), even past 09:00. The 09:00 report happens anyway; the work continues after it.
- 02:22 OWNER: no stop at 09:00 - run until finished or he says stop. 09:00 is now a status report only; keep-awake extended.
- 02:24 nudge: sweep-v2 alive; merge/R1/ruler-v6, humanoid, Retarget, ANIM workers running.
- 02:38 RETARGET worker: local `claude/xfer-retarget` now 5c0a03e1 (5 commits on 5d3e5d7a, tests 95/95, each fails
  first): 6bd4caff camera roll + lift never a useless quarter turn; cda7f1f0 + 389065fd joints outside every part that the
  donor has too (same name, parent, place) take its turn, per clip (identity: Footman shield 39 -> 0, sword 22 -> 0, Ghoul
  waist 59 -> 0; baseline walkattack: sword 22 -> 0); 2a2a9653 hips held down through moments with no donor foot down
  (Footman/Grunt/Ghoul taking the Shadow Hunter's Walk leapt 50 -> 140-165 for a frame, now steady; baseline kurganwalk
  largest body step 12.0 -> 7.7); 5c0a03e1 lift axis does not flip (pops 25 -> 10 of 30 rechecked pairs; baseline
  pitlord/abom/locdeath/kurgan, weapon never under the floor, R7 premise updated with numbers). Sample 2,591/3,000.
- 02:41 merge/ruler/row-10 worker (Opus): (1) merged claude/xfer-r1 0302dc4a into transfer-xl = bb2e891f (one conflict,
  test/helpers/fixtures.cjs, both fixture sets kept; tonight's fixes intact). Tests 167/167 transplant+skin+extras+
  anim-transfer+window, 13/13 picks+builder, 199/202 (3 skip) POSE+Bone Namer, 26/26 rig names/part bones/bone tools, 89/89
  AnimXL+Attachemator+Auto Corpse; retarget baseline z3 vs m2 32 trials 0 differ; R1 fingerprints (`r1-retarget.mjs`, 1192
  rows) identical to R1's own, 399 differ from before R1 exactly as R1 documented. (2) Ruler v6 = `look.mjs` (v5 kept in
  `v6/look-v5.mjs`): (j) rigs (transferRig, transplantReading, mirrorModel) read with the ENGINE UNDER TEST (`loadEngine`
  loads its anim-transfer.js; bodies still sampled with base/src; `LOOK_RIG_ENGINE=<engine>` reads rigs with another engine
  for a like-with-like cross-check); (k) feet check sole reference = median Stand sole (G1b), not frame 0; (l) a side with
  short legs (R1 `short`) reads its sole. Gate `gate.mjs v6m a4a41584 bb2e891f` (ruler-v6m): ok 48 -> 47, "14 worse"
  on paper: 7 are only metrics measured now that were not before (rigs read with real legs; all under threshold, verdict
  ok both: Dire Wolf/Felhound, Felhound/Dire Wolf, Tauren/Dire Wolf, Mammoth/Felhound, Footman HD/Grunt, Grunt/Footman HD,
  Penguin/Penguin); R1's ruler false alarms CLEAR (Footman HD on Grunt, Grunt on Footman HD, Felhound on Dire Wolf feet,
  Wyvern feet: all gone; Sheep on Rat tail reach row gone); Faerie Dragon feet false alarm CLEARS (on Footman and on Baron:
  a4a41584 ok under v6, was feet-off 0.945). Cross-check with one reader (prev engine read with the merged engine's rigs,
  `panel-v6m-prev-xr.json`): ok 43 -> 47 for the merge; the old engine was really bad on Grunt on Footman HD (posture 151 deg,
  legs 138-162 deg: upside down) and Footman HD on Grunt (feet 1.1 hip), Rat/Tauren/Felhound on Dire Wolf feet 1.08/2.03/0.10;
  all ok after the merge. Real, left: Footman on Rat 0.235 / Sheep on Rat 0.24 feet-off (R1: short donor legs go to
  soles mode, but the donor's rise is read from its stub end joints, which run up to 0.4 rat hips off its paws in the
  rat's hopping Walk: `rb/ratground.mjs`); Rat on Dire Wolf sinks 0.43 (accepted 01:57, body dip); Wyvern Rider on
  Gryphon Rider 6 flags -> 1 (new sinks 0.27 = its armL under the floor in Attack, body dip); Dire Wolf on Tauren neck
  35.6 -> 43.1 (R1, untraced); Kurgan on Felhound inside +0.05, Infernal on Grunt +0.03 (under threshold). Faerie Dragon
  with the merged engine: on Footman sinks 0.61 (its armL, body dip; old engine floated 0.59 + feet 1.7 under one reader),
  on Baron leg.upper 18.7 + posture -14 (rider class). C: 8.7 GB free at 02:40 (was 15.7 at 02:25): REPORTED, sweep not touched.
- 02:47 row 10 (Opus) e01028cb: `limbPairing` scores a left/right pair of limbs together (this limb + the other side's
  limb and the donor limb it takes from, same joints in the same roles: lower SUM wins) and a leg's bend goes to the
  donor leg's knee (first joint below its top bending > 10 deg at rest) where the donor leg has more joints, unless the
  thigh points > 20 deg further off there. Tests R10 x2 fail on bb2e891f (Footman thigh 32 deg off the LoC hip-to-knee;
  LoC donor legs 0.33 hip from mirrored) and pass. Before/after (ruler v6, `rb/rows.mjs`, `rb/pairs.json`): Bandit Spear
  Thrower on P26 thigh 31.7 -> 0.1, shin 20.7 -> 2.1 (ok); Tuskar Ranged on P14_1 29.9 -> 1.2 / 22.9 -> 2.2 (left: sinks 0.29,
  body dip); Headhunter on P21 24.2 -> 0.5 / 27.2 -> 2.3 (ok, its knee took the HIP before); GUO on P7 30.6 -> 1.7 /
  33.9 -> 2.3 (ok); Steam Tank on P13 39.3 -> 7.5 / 25.5 -> 9.1 (floats 0.56 stays); 4 other LoC pairs unchanged.
  Retarget: baseline z3 vs rb1 0 differ; R1 fingerprints 5 of 1192 differ, all left/right fixes (`rb/retarget-5-pairing.txt`:
  Footman taking the Walk of Nether Dragon/Phoenix/Faerie Dragon: right upper arm now follows the donor's line to its third
  wing joint as the left does; Zergling: left arm pairs as the right; HD Forsaken Paladin: right knee on the knee joint
  as the left). Panel v6 bb2e891f -> e01028cb: 0 worse, 1 better (Wolf Rider on Knight legs 11.5 -> 2.9) GATE PASSES.
- 02:47 short-legged donors 5dd104fb (from the merge gate's real Footman/Sheep on Rat): R1 puts short donor legs in soles
  mode but read the donor's rise from its stub end joints (the rat's shins: up to 0.4 rat hips off its paws in its hopping
  Walk); `solesDown` now reads such a donor's sole as the own one (`soleReader`, shared). Test S4 fails on e01028cb (0.24
  hip median) and passes; 183/183 + 89/89 AnimXL/Attachemator/Corpse; baseline 0 differ. Panel v6: 0 worse, 2 better
  (Footman on Rat, Sheep on Rat -> ok): 49 ok / 12 (head before merge 48/13 under v6, 43/18 read with the new rigs).
  Left real vs before the merge (all known): Rat on Dire Wolf sinks 0.43 and Wyvern Rider on Gryphon Rider sinks 0.27
  (body dips, row 3 / G-OPT, owner), Dire Wolf on Tauren neck 35.6 -> 43.1 (R1, untraced), Kurgan on Felhound inside +0.05
  (under threshold). C: 8.7 GB, steady since 02:40.
- 02:48 merge R1 + ruler v6 + row 10 + rat-paw fix done (17b70745; panel 49 ok / 12 bad). C: hit 8.7 GB (pagefile 14 GB, RAM free 3.9 GB) -> paused sweep-v2 shards 10-13 (taskkill), 10 shards keep running. RESUME LATER with 'node run.mjs launch --out sweep-v2 --engine eng-v2/src/skeleton-transplant.js' (done pairs skipped) once fewer agents run. Open: Dire Wolf on Tauren neck +7.5 deg from R1 untraced -> humanoid/next worker.
- 02:54 nudge: sweep-v2 (10 shards) alive; humanoid, Retarget, ANIM workers running.
- 02:54 C: back to 16 GB, RAM free 9 GB -> resumed shards 10-13 (14 alive). Watch C: each nudge.
- 03:24 nudge: checked sweep + workers.
- 03:24 RAM free 2.4 GB, C: 8.7 GB again with 14 shards -> paused shards 10-13 again; keep sweep-v2 at 10 shards while 3+ Opus workers run (do NOT resume until workers finish).
- 03:30 RETARGET worker done (Opus): local `claude/xfer-retarget` ad59611f (6 commits on 5d3e5d7a; tests 95/95, each
  fix fails first). Report: `out/transfer-probe/overnight/retarget/classes.md`. Identity (100 onto themselves, ruler
  v2): Mine ok 37 -> 81, Theirs 37 -> 79, Add all pairs ok 60 -> 71 (pops 25 -> 3, loose 61 -> 3). Sample 3,000
  (5d3e5d7a): 1,955 measured; Mine ok 62%, Theirs 49%, Add all pairs 25% (45.7% of added animations flagged). Cross
  pairs (300) before/after: small gains (Add all pops 50 -> 35 pairs). Panel 40 pairs: 36 better, 1 worse (Ungor spear
  own Death: two-hand grip bends the left arm now that the weapon arm is not flung; accepted, class G). Retarget
  baseline: 6 of 32 differ, each proven in the commits. Open for the owner: T Theirs trunk stance (Ghoul hunch is in
  its shape: Footman <- Ghoul pitch 64 deg off; R13 asserts today's rule), W2/F2 weapon/sole lifts against the
  donor's own ground contact, G grip IK flips, K looping clip fitted to a longer Body animation (walk at 0.69x),
  M world-axis turns. For the R1 recogniser worker: Ghoul arms end at Wrist1/2 parked in the chest (Retarget has no
  transplantReading), 1/3-leg critters, SteamTank legs, rider 'both' readings, Archnathid arms on a helper.
  Note: claude/xfer-retarget adds 3 fixtures to test/helpers/fixtures.cjs; transfer-xl has its own uncommitted
  fixtures edit (another worker): expect a small merge.
- 03:30 Retarget worker done round 1 on claude/xfer-retarget ad59611f (identity Take-whole-body ok 37->81/100; sword/shield/wheels follow donor; camera keys, arm fling, arm snap, body leap fixed; 6/32 baseline trials changed, each better). Continuing: grip elbow flip + loop speed, then merge transfer-xl into it. OWNER QUESTIONS for 09:00: (a) Retarget Pose Theirs: take the donor's visible stance (hunch in shape)? (b) lifts vs donor ground contact (weapon may go into floor like donor's)? (c) transplant: opt-in lift so long weapons/arms stay above ground? Recogniser items queued: Ghoul Wrist1 for retarget, SteamTank feet, Baron rider/mount reads, Archnathid arms.
- 03:34 ANIM round 1 done on claude/anim-overnight 18ac41d2 (runs on all 3,121 results, Fix all harming the look 100->56 of 299; 4 ANIM bugs fixed). Continuing: open bugs 2-5 after merging transfer-xl. OWNER QUESTION (d): ANIM Fix all should respect the donor's own motion (donor-aware polish = new feature)?
- 03:40 HUMANOID worker (Opus): set `out/transfer-probe/overnight/humanoid/` (408 humanoids: 355 on foot, 53 riders split rider/flyer/biped-mount; 59 core x 58 + 1,000 family-uniform random = 4,422 pairs, shuffled; runner hrun.mjs, classes humanoid/classes.md). START bb2e891f ruler v6 (1,843 pairs): all 77.4%, SAME-KIND (foot>foot+rider>rider+flyer>flyer) 79.5%, foot>foot 80.2%, rider>rider 69.5%. After R-B + short legs (5dd104fb, 2,422 pairs): same-kind 80.0%. Biggest class = P-ground 12.9% of same-kind (weapon/hand/shield under the floor: pose exact, own arm/part longer: G-OPT owner option) + P-body 1.7% (own hand inside its bulkier chest, checked on the trunk surface: proportion); without an owner choice on those 99% is not reachable. FIX H1 a04efc4f: fitTrunk kept the own trunk pivots when the donor's trunk skin is on one joint (28 of 408 donors: herrdave soldiers, Satyrs, Rifleman, Peon, Ent...), so the donor bent at the own chest (Ghoul on Satyr bowed 24 deg for 61); T2 fails first; 77/77+94/94, baseline 0 differ, panel 0 worse; 282 affected pairs ok 199->215, posture error 4.96->1.09 deg, 9 'worse' = pose now exact + proportion (sinks/hand-inside). RULER v7 (humanoid/ruler-v7, panel 49/12 unchanged): a) flung/vanish excused on donor joints the donor itself throws/hides (19/22 cured), b) riders' arms against chest->neck not horse-pelvis->neck (12/25 cured, 0 ok->bad). Full rate on a04efc4f+v7 running (CPU: sweep-v2's 10 old-engine shards take most of it; humanoid runs at 0.35 pairs/s).
- 04:40 RETARGET worker, round 2 (coordinator: grip flip + looping timing are bugs; max 2 node processes): local
  `claude/xfer-retarget` abe1f7fb G1 the gripping arm's solve starts from its own solve of the moment before, and a
  grip point too near the shoulder slides out (Kurgan <- Grunt left arm 135 -> 44 deg in one step, bend plane 128 ->
  44); 421cb577 K1 with the hips taken a looping clip plays at its own speed (result = whole loops of the hips clip,
  the body animation fitted: the Footman's walk on the Ghoul 0.80x -> 1.00x, on the Lord of Change 1.20x -> 1.00x).
  Tests fail first; 97/97; baseline 7 differ, proven in the commits; panel vs 5d3e5d7a 37 better / 1 worse (Ungor,
  accepted), vs ad59611f 2 worse = Flame Lord own Walk weapon-lift pop on a shorter timeline (W2, owner). Then merged
  claude/transfer-xl a04efc4f into claude/xfer-retarget = 70c1bd7c (test-file conflict only, both kept); baseline 0
  differ by the merge; XFER tests 167/167; full source suite running (Idle, 2 at a time).
- 03:54 nudge: sweep-v2 10 shards; humanoid, Retarget r2, ANIM r2 running.
- 03:58 HUMANOID: FIX H2 7dde7d73 (shoulder position keys scaled by the whole-body travel ratio; Kobold pulls a shoulder in 7.4, Troll Trapper's went 18.2 at travel 2.5: shoulder line 13 deg off at rest, 36 in Attack - 2, limbs 16-20): on two-legged donors the scale is travel held within the trunk's own length/width ratios. T3 fails first (36.3). 83/83 + 94/94, baseline 0 differ. Panel 48/13 both, 6 better, 2 mixed (pose medians now 0.2-0.5 deg; Footman on Mountain Giant inside +0.08 unflagged, Graveguard on Ghoul sinks +0.016). Same-kind sample 300: ok 234->236, 0 worse, 28 pose better/0 worse. Full humanoid rate on 7dde7d73 + ruler v7 running (humanoid/rows-7dde7d73-v7.jsonl).
- 04:18 HUMANOID: FIX H3 c7d7ac20 (recogniser, anim-transfer readRig): a tail no longer climbs into a joint that carries the trunk or an arm/wing (Far Seer/Thrall Bone Wolf Waist carries the rider: every own tail took the wolf's back, 25-36 deg). Readings: 4 of 522 change (Far Seer, Thrall, Quillbeast, Jezzail), each that fix. H3 fails first; 95/95 + 83/83; baseline 0 differ; R1 fingerprints 3/1192 = those models taking the Dire Wolf Walk; panel 0 worse; 237 Far Seer/Thrall pairs ok 138->160 (2 cross-kind worse, pose exact). RATE (same-kind 1,000-pair subset humanoid/sk1000.txt, same pairs every step): start bb2e891f/v6 79.1%, after R-B+short legs 79.8%, after ruler v7 + H1 + H2 81.7%, after H3 81.9% (riders 70.2 -> 86.0%). Proportion-only classes (sinks; own hand inside its bulkier body, pose exact) = 15.6% of pairs: excluding them 92.8% -> 97.0%. Those need an owner choice (see humanoid/classes.md); 99% is not reachable without it.
- 04:25 RETARGET worker: all tests on `claude/xfer-retarget` 70c1bd7c (merge of transfer-xl a04efc4f): compatibility
  57/57; source suite 4,259 tests, 4,236 pass, 9 skipped, 14 fail, none XFER: 9 particle-library (no dist/ built here:
  dist/particle-runtime.mjs missing), 4 particle-reentry + 1 portrait-toolbar (fail the same on claude/transfer-xl;
  this branch changes nothing in app/ or those tests). Branch ready to merge back into transfer-xl.
- 04:22 Retarget r2 done (70c1bd7c: grip elbow flip 135->44 deg, looping walks play at 1.00x; 7 baseline trials changed, each better). Humanoid worker asked to merge it at its next safe point. Started recogniser round 2 on claude/xfer-r2 (Ghoul wrists, SteamTank feet, Baron rider/mount, Archnathid arms, leftover critters).
- 04:23 HUMANOID worker: merged claude/xfer-retarget 70c1bd7c into transfer-xl = 6b0a0f88 (no conflicts). Tests 103/103 anim-transfer+window (incl. H3), 83/83 transplant+skin+extras+builder. Retarget baseline z3 vs merge: 11 of 32 differ = exactly the union the retarget commits list (ghoul, ghoul0, locwalk, kurganwalk: loop speed; kurgan, kurganNoClear, kurganArm: grip; pitlord, abom, locdeath: weapon lift; walkattack: shared joints per clip); no other trial changed.
- 04:24 nudge: sweep + humanoid, ANIM r2, recogniser r2 running.
- 04:35 ANIM r2 done on claude/anim-overnight e0071808 (Fix all harm 53->44, joint jumps 34->12, floats 0). Workers left: humanoid + recogniser r2 -> resumed sweep-v2 shards 10-13 (watch RAM/C:).
- 04:50 HUMANOID: ruler v8 (humanoid/ruler-v8: v7 + c donor ground moves against its BODY height, not a bind box inflated by a portrait backdrop/raised wings/club: Gnoll 331 vs ~110, Gargoyle 303 vs ~102; + d mesh reach against the bind reach of the geosets that animation shows: Villager's lumber/gold sacks). 11 test pairs 8 cured 0 worse; panel 48/13 -> 50/11, 0 worse. Merged-head run 6b0a0f88 + v8 on sk1000: 83.6% (17 better, 0 worse vs c7d7ac20/v7). FIX H4 34e81775 (+288b945a comment): sameKindSequence took the Dread Lord's 'Cinematic death' as the kind of a donor's 'Cinematic Walk/Stand' and showed his corpse; a dying animation now matches only a dying name. H4 fails first; 103/103 + 84/84, baseline 0 differ, fingerprints 0/1192, both touched set pairs bad -> ok, panel 0 worse. RATE sk1000 now 83.7% same-kind (riders 87.7%); proportion-only 14.8%; excluding those 98.2%. Left (13 pairs): 3 Dissipate slivers (1-4 vertices), Kil'jaeden Cin feet 0.11-0.12, Troll on Sapper floats, neckless owns on forward-headed donors, Witch Hunter 2-joint arm, Tercio on LoC P24, Skeleton Orc on Tauren, Demonette on Gor, flyers.
- 04:51 HUMANOID r1 finished (context limit): same-kind 79.1% -> 83.7%, 98.2% excluding the proportion class (14.8%: weapon/arm/shield into floor or own body with exact pose; OWNER DECISION; worker suggests arm-only clearance in dipping frames, feet stay planted). Riders 70% -> 88%. Started humanoid r2 (ruler v8 shared, scattered 1.3%, full 4,422 re-run).
- 04:54 nudge: sweep-v2 + humanoid r2 + recogniser r2 running.
- 05:11 RECOGNISER r2 (Opus) done: commit faaa6067 on local `claude/xfer-r2` (worktree .claude/worktrees/xfer-r2, from 6b0a0f88; proof scripts + outputs in its out/transfer-probe/, engine frozen eng-a3/). (1) Ghoul arms: the shared reading (anim-transfer readRig `endAtMovingJoints`) ends a limb at the one moving joint beside a still skin carrier, exactly the old transplantReading rule (Ghoul/murloc x13/kobold/shoveler arms -> Bone_Hand, ~40 tails Geo_Tail1 -> Bone_Tail2, bear front paw, vulture wings); transplantReading is now a pass-through. Retarget Theirs arm.lower: Ghoul<-Footman Walk 131 -> 35 deg, Footman<-Murloc Attack 85 -> 38. Transplant: 753/775 fingerprints identical; 22 differ because the pairing probe now sees the real hand/tail (it ran on the old reading before): all same or better under ruler v8 (Lobstrokk on Ghoul/Murloc sinks 0.63/0.56 -> 0.36/0.34; Ghoul/Murloc on Lobstrokk look-bad -> ok; vulture sinks gone; faerie dragon sinks 0.50/0.71 -> 0.47/0.66; wyverns equal; `r2-tpdiff-look.txt`). (2) Steam Tank: POSE inferPoseBranches: a branch hanging from the joint the head/neck hangs from, ending higher above the lowest skinned joint than it is long, is an arm: the commander's arms were its 2 legs. SteamTank<-Bandit Walk feet:off 0.13/0.24 -> ok; Footman on SteamTank sinks+floats -> ok; SteamTank on Footman floats 0.48 -> hand-inside 0.74/0.81 (the commander's hands inside the hull's torso capsule: a tank on a Footman skeleton, ruler capsule = hull; for the owner's eye). (3) Barons: every Downloads Baron (10) + TestModels Baron already reads two creatures (both/seated/walker); R1 gave the H_/R_ rigs' rider its legs (5d3e5d7a: seated hip 0.0, no legs); 0 Downloads readings change in r2. Retarget's 'both' default on a rider donor is the window's choice (Both/Rider/Mount buttons), not a misread: left for owner/orchestrator. TestModels vertex-rgb-match Baron has all skin on DummyBone (no chest/head read: correct). (4) Archnathid: R1 already fixed it (arms on Bone_Box23 = chest, was Box23 swallowed into armL, no chest). Tried: legs' hanging joints (Box17/Box18, dragons' Bone_Front, pig Mesh01, Huntress 'Bone ass', ~50 models) into hips: panel 3 WORSE (Rat on Dire Wolf sinks 0.43 -> 0.74, Wyvern Rider on Gryphon Rider pose p90 7 -> 13, Dryad on Huntress reach 0.03) -> NOT kept; open: those trunk segments are in no part (or in the tail). (5) odd legs after R1: pig/seal/sheep/felboar/rat 4 legs already; Hydralisk (1 leg = its tail, Foot refs on tail joints) -> legless (POSE: a chain all of tail-named joints is no leg; Footman<-Hydralisk Mine posture -14 -> ok; Footman on Hydralisk 6 flags -> 1); Snapdragon (3 legs: back left shin has a copy ShinX, only it carries the toe; mirrorPath now searches on) -> 4 legs (Snapdragon<-Dire Wolf feet med 0.21 -> 0.02 hip; Dire Wolf<-Snapdragon feet/floats gone; Snapdragon on Dire Wolf feet-off 0.20 -> ok). Left: bone-namer/Raider.mdx 5 legs (renamed test fixture, rider foot on the waist), MM20 Stormforger 1 leg (tracks). PROOF: rig-dump 1210 models (TestModels+LPW) 142 differ, all in the classes above (`r2-rigdiff-a3-unique.txt`), Downloads 120: 0 differ; pose-dump 1244: clues off 0 differ (only the new transfer-r2 copy), clues on 7 = Hydralisk, Snapdragon, Steam Tank (+copies); R1 retarget fingerprints 80/1192 differ, every one with a changed model, 0 unexplained; retarget baseline 2/32 differ = ghoul, ghoul0 (Ghoul takes the Footman's Walk: its arms end at its hands); panel ruler v8 (humanoid/ruler-v8) 6b0a0f88 vs r2: 50/11 both, 0 worse, 0 better -> GATE PASSES; riders gate 95 built 1 flag as before. Tests RG1 x2, RG2-RG4 fail on 6b0a0f88, pass; Q4 premise updated; 199/199 transfer+transplant+picks, 225/228 (3 skip) POSE+Bone Namer+rig names/part bones/bone tools, 89/89 AnimXL/Attachemator/Auto Corpse. Added (only) TestModels/transfer-r2/SteamTank_Normal.mdx (+README line). Not merged into transfer-xl.
- 05:12 recogniser r2 done on claude/xfer-r2 faaa6067 (Ghoul arms end at hand for all tools, Steam Tank legless, Hydralisk/Snapdragon fixed; 142 readings changed, all explained; panel 0 worse). Humanoid r2 to merge it. Note for owner: Retarget defaults to 'Both' for rider donors (window default, his call).
- 05:12 started cross-kind worker (biped->winged, quadruped<->biped, legless->biped, armless) on claude/xfer-crosskind.
- 05:24 nudge: sweep-v2, humanoid r2, crosskind running.
- 05:40 HUMANOID r2 (Opus): shared ruler = v8 (`look.mjs`, v6 kept as `look-v6.mjs`; How to run). Panel v8 for 288b945a 50/11. FIX H5+H6 017beda5: (H5) an own joint outside the body that only scales (no position/turn keys on it or above it) stays in the world instead of riding the body (Eredar Warlock's ground ring stood up and flew 6 heights in the Chaos Blademaster's Dissipate; ride audit 651 models: 17 change, all ground rings / glow planes / spell pieces on unparented scale-only roots); (H6) a body joint moving on a global sequence takes no height keys, so its height now goes on the nodes hanging from it when it carries no skin (Kil'jaeden Cin: feet 0.11 hip high; donors affected: Kil'jaeden Cin, Tinker Robot, Wisp). Tests H5/H6 fail first; 86/86 + 103/103; retarget baseline hm7 vs h56 0 differ; panel 0 worse. RATE sk1000 (ruler v8): 83.7% -> 84.0%, excl. proportion 98.2% -> 98.6%, 4 better 0 worse. Merged claude/xfer-r2 faaa6067 = abec69f2 (clean): 86/86, 108/108, POSE 139/139 (3 skip), retarget baseline hm7 vs r2m: only ghoul, ghoul0 (as expected). FIX H7 46f88948 (recogniser, pose-ik readPoseRig): an arm chain read from a two-joint arm's last joint that climbs into the chest (root holds the head and the other hand beside it) is read from its hand ref instead: Witch Hunter armL ShoulderL>LowArmL, chest Bone_Chest (as the Footman's right arm reads). Rig readings over 651 models: only the Witch Hunter changes. H7 fails first; 109/109, POSE 139/139, 86/86; baseline 0 differ; panel 0 worse. Witch Hunter copied to MDLxL-TestModels/transfer-humanoid (README line). Found, not engine faults: Ghoul/Murloc on Blademaster Dissipate far toes = proportion (legs 1.06x the Blademaster's at 0.73 its size: the donor's leg stretch on longer legs; result joints = donor x travel/size exactly); Troll Priest on Goblin Sapper = the Sapper is three goblins (multi-figure, belongs out of the set like Mortar Team).
- 05:45 CROSS-KIND worker (Opus): START on transfer-xl head 1bca3a4f (engine = eng-288b945a), ruler v8 (frozen `crosskind/ruler-v8`), 1,505 uniform random pairs over the 7 sweep-v2 groups (`crosskind/pairs.json`, `make-pairs.mjs`, runner hrun.mjs 3 jobs Idle; rates `crosskind/groups.mjs`, buckets `classify.mjs`): biped>winged 54.0% ok (sweep-v2/v4 13.3%), biped-armless>quadruped 59.1% (15.8), quadruped>winged 52.6% (22.3), biped-armless>biped 64.7% (25.2), legless>biped 75.8% (25.3), quadruped>biped 55.3% (35.8), quadruped>quadruped 54.9% (48.7); all 59.5%. Note: 'biped-armless' (sweep-v2 kinds) is now mostly wolves/bears/pig/rabbit read with 4 legs (R1). Worktree `.claude/worktrees/xfer-crosskind`, branch claude/xfer-crosskind (from 1bca3a4f), fixes K1-K5 in progress.
- 06:00 HUMANOID r2: FIX H8 57be6fc4: a stepped (DontInterp) body track that takes a height becomes linear keys holding the same values (each value keyed again 1 ms before the next key), so the height is linear between breakpoints (HD Forsaken Paladin body joint: Troll Priest's feet 0.13 hip heights off between his 30-60 ms keys, exact on them). H8 fails first; 87/87. FIX H9 d7a48a1c: buildTransfer option `kneeToKnee` (set only by the transplant): a leg's bend always takes the donor's knee; the 20-deg rest-direction exception of limbPairing stays for retargeting (the transplant re-poses its bind, rest directions do not matter): Skeleton Orc on Tauren thighs 31 -> <5 deg (now ok), Spanish Tercio on LoC P24 legs fixed (left: sinks = proportion). H9 fails first; 88/88 + 109/109; retarget baseline r2m vs h9 0 differ. Engines frozen eng-46f88948 (merge + H7), eng-57be6fc4 (H8), eng-d7a48a1c (H9). Ruler false alarms found (not changed, ruler stays v8 for like-with-like): Demonette on Gor (every segment's world direction within 4 deg of the Gor's in every animation; the body frame's across line reads the clavicle pivots, which sit 20 deg skewed in the Gor's bind against the Demonette's); Blademaster on Jaina (Jaina's Spell and Stand Channel 1 share one interval: the refit of Stand Channel 1 takes the Blademaster's Stand - 2 flash, the ruler compares Spell with his Stand). Left open, by design or owner: Headhunter on Gnoll neck 35.7 (neckless own: the head stays over its chest, the Gnoll's juts forward; changing neck placement touches every neckless own on a necked donor); Gryphon Rider on Ridden Hippogryph (flyers; the hippogryph's front talons read as 8 vs 6 joints, recogniser); Goblin Alchemist (rider) on Chaos Wolf Rider arm inside (proportion).
- 05:54 nudge: sweep-v2, humanoid r2, crosskind running.
- 06:20 HUMANOID r2 RATE sk1000 (ruler v8): merge xfer-r2 + H7 (46f88948): 84.0% -> 84.1% (excl. proportion 98.6 -> 98.7%); the r2 merge changes none of the 1,000 pairs, H7 cures Murgul Slave on the Witch Hunter (arms 89-103 deg -> ok); 0 worse. Correction to H8's cause: the Forsaken Paladin's mover local_C0_0_jnt has no position keys of its own; settleFeet's shiftNode created a stepped (LineType 0) track for it, onto which feet-down added the height (unstep also covers genuinely stepped tracks). Final head d7a48a1c (H8+H9) now runs sk1000 first, then the whole 4,422-pair set into humanoid/rows-d7a48a1c-v8.jsonl (humanoid/chain-full.sh).
