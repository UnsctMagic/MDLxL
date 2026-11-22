# XFER Transplant: Astra round 1 (contract, 20 Nov 2026)

Owner: "A lot of failures imo. lets do this more, because on your own the results are shit." and
"write a contract - lets give astra a chance to do this round". This round is Codex (Astra 6.2).
Claude reviews the result afterwards (owner's rule: both review everything).

## Starting point
- Engine to start from: branch `claude/xfer-bend` at `04b56bce` (= `claude/transfer-xl` 7fd22ac6 + the
  owner's "Bend arm" default 367e137c + the grade sheet). This is exactly the engine the owner graded.
- Work in your own worktree: `git -C D:\Claude\MDLxL worktree add D:\Codex\xfer-astra-r1 -b codex/xfer-astra-r1 claude/xfer-bend`.
  Link `node_modules` with a junction to `D:\Claude\MDLxL\.claude\worktrees\transfer-xl\node_modules` (never run
  `pnpm install` through a junction; never recursively delete through it).
- Read: `AGENTS.md`; `docs/agent-tasks/xfer-overnight.md` (owner orders, How to run, Log);
  `docs/agent-tasks/xfer-both-ways.md` (Stage 3 to the end: transplant rules and fix history);
  `docs/agent-tasks/xfer-transplant-fixes.md`; the class write-ups in the transfer-xl worktree:
  `out/transfer-probe/overnight/humanoid/classes.md`, `.../crosskind/classes.md`.
- Tools (all in `D:\Claude\MDLxL\.claude\worktrees\transfer-xl\out\transfer-probe\overnight\`): `look.mjs` (ruler v10),
  `panel.mjs` / `panel-compare.mjs` (61-pair gate), `humanoid/hrun.mjs` + `humanoid/sk1000.txt`, `run.mjs` (sweep).
  The review sheet: `--transfer-picks="<cases.json>"` (`app/TransferPicks.jsx`, `src/transfer-picks.js`; `grade: true`
  cases give the 0-10 + comment form). Grade sheet builder: `D:\Claude\MDLxL\.claude\worktrees\xfer-bend\out\grade\`
  (`pool.mjs`, `build-grade-units.mjs`).

## Owner decisions (binding)
- A transplant is 100% the donor: posture AND motion; the model keeps only its own proportions. Keep options exist,
  off by default. Never a 90/10 mix.
- Straight shin; feet down (body height follows the donor's lowest foot).
- The model's weapon follows the donor's weapon, including when the donor throws, drops or swaps it.
- Living body dies; the model disappears where the donor's body disappears.
- Bend arm: where the model's longer arm/weapon would go into the floor, only in those frames the arm turns up at the
  shoulder by the least angle that clears the floor; feet stay planted.
- Poor fit: say so with a reason, still produce a result.
- Tests and sweeps always run on the newest engine. No Fable. Nothing goes online until the owner says "merge":
  local commits only on `codex/xfer-astra-r1`.
- Anything shown to the owner: only real living units (no ships, carts, missiles, crates, spheres, wards, effects).
  Side by side, plain words, buttons name the choices, every screen checked before it is sent.

## The owner's grades (ground truth for this round)
Blind sheet `D:\Claude\MDLxL\TestBuilds\transplant-grade\` (`cases.json`, `answers.json` = his grades 0-10 + comments,
`grade-our-verdicts.json` = our hidden ruler-v10 verdicts). Result: average **4.6 / 10**, only **16 of 40 ≥ 7**.
Our checks barely predict him: pairs we called "ok" average 4.8, pairs we called bad 4.1. **The ruler is not a usable
judge until it agrees with his eye.**

His failure reasons, grouped (case numbers from the sheet):
1. **No leg motion when the leg counts differ** (01, 02, 15, 27, 29, 30, 31, 40, and likely 33): a biped or quadruped
   on a four-legged/turtle/spider donor (or the reverse) gets legs that just ride the body. Owner: "He has 4 legs,
   this guy has 2 legs - but there is no motion", "NO LEG MOTION", "all turtles failed". The current rule ("legs ride
   the donor's body without moving") is NOT acceptable: legs must walk with the donor's gait. Design a mapping
   (e.g. front/back leg pairs onto the model's legs by phase, or the donor's legs' stepping cycle driving the
   model's legs) and show the options to the owner side by side if it is a real choice.
2. **Wings not moving** (17 War Eagle on Harpy: "No wing movement").
3. **Weapons**: bound wrong / floating outside the hand, the whole weapon made into the donor's flail head (03);
   weapon disappears though the donor's doesn't (09); weapon sits on the shoulder (18); bows and arrows (39: "you
   struggle with bows and arrows"); the model's own ranged props (arrows etc.) showing in the wrong place (28).
4. **Twitching**: an arm twitching uncontrollably in Stand 1 (14).
5. **Head/neck** not following the donor's (06 Thunder Lizard on Huntress; 39 "head is bad, attacks clip").
6. Unexplained zeros/low with no comment (21 Footman on Handgunner 3, 25 Obsidian Statue on Druid of the Claw 0,
   33 High Elf Archer on Headhunter 0): open them, find out why they look wrong.

## What to do
1. For every graded pair, reproduce the result and write down what is visibly wrong, frame by frame (your own
   eyes on pictures plus measurements). Do not trust ruler v10.
2. Make the ruler agree with the owner first: add checks that catch his reasons (legs not moving while the donor's
   legs move; wings still; weapon off the hand / on the wrong bone / vanishing while the donor's stays; jitter
   between neighbouring frames; head turned away from the donor's). Target: on these 40 pairs, our verdict agrees
   with his grade (≥7 = ok, ≤4 = bad) on at least 36 of 40. Report the agreement table.
3. Fix the engine class by class, biggest first (class 1 first). Tests that fail first. Gates on every fix: transplant,
   anim-transfer and window tests; retarget baseline 0 differ unless proven; the 61-pair panel and the humanoid
   1,000 subset with the new ruler: no pair from good to bad without a stated reason.
4. Where a fix is a real choice (e.g. how a 4-leg gait maps onto 2 legs), build the options as trial models and a
   side-by-side sheet for the owner (rules above), before making a default.
5. At the end: a NEW blind 40-pair grade sheet (living units only, new seed, every name checked), same 0-10 + comment
   form, on your final engine, new launcher `D:\Claude\MDLxL\TestBuilds\_START HERE\GRADE - Astra round 1.cmd`,
   your hidden verdicts beside it. Packaged build in a NEW folder `D:\Claude\MDLxL\TestBuilds\transfer-xl-31`;
   run the transfer harness hidden at normal priority (per story, like `out/t30/run.cmd`) before the owner gets it.
6. Write a result section in this file: per class what changed, before/after on the 40 graded pairs (your eye +
   new ruler), gates, and what is left. Claude then reviews the whole branch.

## Limits
- Use at most 4 node processes; keep the owner's PC usable. C: is small: set TEMP/TMP to D: before packaging.
- Do not touch other branches or the main checkout. Do not edit imported libraries.

## Note added 21:30 (Claude, after the owner's question about the turtle)
Recognition is NOT the problem for class 1. `transferRig` (the shared POSE recogniser) reads the Dragon Sea Turtle and
Giant Sea Turtle with hips, head, tail and FOUR legs (legL, legR = back legs; legL2, legR2 = front legs), exactly as the
POSE window shows. The legs freeze because of a transplant RULE: when the two models stand on a different number of
legs, `transplantSkeleton` gives up pairing and lets hips and legs "ride the donor's body without moving". Fix that
rule, not recognition: pair the model's leg pair with one of the donor's leg pairs (e.g. the back pair for a biped, or by
which pair carries the body in the Walk), and decide what the other pair drives (arms, or nothing) — show the owner
the options side by side. Check out/rigcheck.mjs in this worktree to print any model's reading.

## Astra round 1 evidence — original engine

The starting branch tip was `45b0f51b`. Its only change from `04b56bce` is this contract. All 40 regenerated results and their 40 displayed donors matched the original MDX files byte for byte by SHA-256. Measurements cover 514 listed sequence entries at 0%, 25%, 50%, 75% and 100%. For Walk/Stand the leg investigation also sampled 17 phases in torso coordinates. The observations below refer to synchronized pictures of the visible skinned geometry. Shaded projections omit texture transparency, so a rectangular effect plane alone is insufficient evidence of an exposed prop.

| Case | Owner | What I saw on the graded engine |
|---|---:|---|
|01 Hellscream / Nerubian Queen|2|Across four Walk phases the Queen alternates the front and rear tips. The orc rocks with both feet held together. Four moving donor chains have zero result leg skin.|
|02 Spider / Easter Chicken|0|The chicken alternates its feet and bobs. The spider body bobs and pitches through the cycle while its legs hold one shape. Its body bone carries 409 vertices.|
|03 Stormvermin / Razormane|5|The feet stride and the body lunges. At 25% of Attack the whole polearm is clear of both hands. All 44 weapon vertices follow the last of three flail bones.|
|04 Crypt Fiend / Night Elf Battleship|8|Both hold still in Stand and then roll and sink through Death. The donor supplies no walking legs. This old graded ship remains in calibration only.|
|05 Priest / Lord of Change|8|The priest changes knees and leans into the donor's staff strike. No comparably large body fault was visible at the sampled phases.|
|06 Thunder Lizard / Huntress|2|At mid-Walk the cat raises its muzzle while the lizard points its head into the ground. The transplant selects the mount correctly (head 48 → 25). The result copies its head rotation within 0.000002°, but its skinned muzzle still faces away by a median 34.8° across Stand, Walk and Attack.|
|07 Demonette / Dark Troll|8|The push-off changes feet, and the raised attack arm changes with the troll. The sampled motion reads clearly on the different limbs.|
|08 Obsidian Statue / Cold One Rider|5|The pedestal remains rigid while the mount steps. Attack shows the other statue form lunging with the lance. The fault changes with the visible form.|
|09 Tuskarr Ranged / Greenskin Orc|5|The stride and torso swing transfer. In Attack the tuskarr spear cuts out while the donor still holds its weapon. The 32 spear vertices keep the tuskarr's attack alpha.|
|10 Harpy Queen / Lich|8|The lich glides without a stepping cycle. The harpy follows the hover and upper-body attack. Its dangling legs have no donor stride to reproduce.|
|11 Murloc Flesheater / Ratling|8|The low forward run and arm reach follow the ratling. The feet change support during Walk.|
|12 Arthas / Estalian Handgunner|9|The forward run and lift from firing pose to raised weapon are visible on Arthas.|
|13 Peon / Dragonspawn|5|Walk changes the peon's lean and pick position, but his feet hold their pose. The attack lunge transfers to his upper body.|
|14 Handgunner / Demonette|0|In Stand 1 the donor's arm barely sways. The gun hand changes angle repeatedly while the other arm stays steady. Across frames 802–875 the right arm turns 10.9° against 0.7° on the donor.|
|15 Gargoyle / Sea Turtle|4|In Walk Swim the turtle paddles while the gargoyle translates as a hovering shape. The four donor leg branches carry no result leg skin.|
|16 Gor / Priest|6|The feet step in Walk. The axe sits much more upright across the torso than the donor staff. The owner gave no reason for the 6.|
|17 War Eagle / Harpy|0|In Stand the harpy's wings change from downstroke to upstroke. The eagle rises and falls with its wings held spread. The recognized Harpy arms omit the distal wing branches.|
|18 Skink / Fire Pandaren|2|The spear stays across the shoulder as the hands swing. All 72 vertices of the separate spear mesh bind to the root.|
|19 Orc Warlock / Wyvern Rider|7|The warlock tips forward with the rider in flight and its arms move through the attack. The old ground flag also counts the low staff.|
|20 Reikland Handgunner / Naga|4|The naga drives forward on a flexing tail. The man's legs stay set underneath it and the rifle reaches down in Attack. The donor has no foot cycle to pair.|
|21 Footman / Repeater Handgunner|3|The feet run. During Attack 2 the visible shield covers the head and upper chest. Its 61 main-body vertices move onto Hand_R. A separate root-bound handle is hidden during this attack.|
|22 Lord of Change / Warrior of Khorne|9|The run and change from guard into strike transfer. The grounded donor supplies no wingbeat.|
|23 Golem Statue / Demonette|9|Alternating steps and the two-arm strike remain legible on the heavier geometry.|
|24 Demonette / Elf Villager Woman|9|The donor keeps its hands together and its lower body largely concealed. The result follows its restrained pose.|
|25 Obsidian Statue / Druid|0|The druid runs and falls onto its side. The visible pedestal stays upright through Walk and Death. Attack abruptly shows a second form. The reader follows the alternate skeleton, leaving much of the visible base on Box02.|
|26 Blue Spider / Green Dragon|5|Some appendages take the donor's flight/attack. Legs point upwards and out from a compressed body instead of preserving its stance.|
|27 Murgul / Dragon Sea Turtle|0|The turtle's feet cycle while the murgul's legs stay in the same pose through Walk Swim. Four moving donor leg branches carry no result leg skin.|
|28 Evil Sylvanas / Great Unclean One|2|The bow moves with an arm. An independent arrow flashes during the melee attack. Its eight vertices ride Mesh18.|
|29 Dragonspawn / Zombie Dragon|0|The donor cycles its feet under the wings. The dragonspawn's legs remain crouched while its upper body follows the attack.|
|30 Cold One Rider / Sea Turtle|0|The mount and rider move as one during the paddling cycle. All four donor legs have zero result leg skin.|
|31 Centigor / Tuskar Lord|0|The tuskar alternates its legs. The centigor holds all four in one standing pose, even while its upper body attacks.|
|32 Aspiring Champion / Zombie Dragon|8|The champion pitches into the dragon's flight and attack. Its leg skin does follow the two recognized donor legs. The donor's wings have no own equivalent.|
|33 High Elf Archer / Headhunter|0|The archer crouches with the troll. Its bow stretches across the figure during the spear throw and the eight arrow vertices ride the pelvis mesh. Both rigs are bipeds. The textured Attack Range picture confirms the forward fold and bow over the back, although the feet reach below that picture.|
|34 Ent / Bandit Lord|7|The ent's arms and torso follow the rider while its feet remain planted through the horse's stride. The same 22 original foot vertices move less than 0.000002 model units in torso space. The owner still accepted this pair.|
|35 Lord of Change / Demonette|8|The long-legged run and reaching attack follow the donor. Wings stay with the body of a donor that has no wingbeat.|
|36 Kobold Geomancer / Paladin|9|The kobold crouches, steps and swings its staff with the paladin's hammer.|
|37 Demonette / Gor|9|The stride and both arm positions in the attack follow the Gor. The older ruler's arm-angle flag did not correspond to a large visible failure here.|
|38 Human Mage / Furbolg|9|The mage takes the hunched walk and the shift into the attack on its own proportions.|
|39 Archer / Tauren Chieftain|0|The drawn bow cuts across the character in Attack and a separate prop moves away from the hands. The arrow mesh rides the pelvis. The head basis follows the donor within 0.000002°, but the visible head's front axis differs by a median 46.0°. The textured attack picture clips the lowest part of the figure.|
|40 Red Orc Warlock / Giant Sea Turtle|0|At each Walk Swim phase the turtle moves its feet, but the orc keeps the same crouch. Its skin never follows any of the four animated donor leg chains.|

The owner approved three labels for this round: 0–4 bad (18), 5–6 mixed (6), 7–10 good (16). Original v10 called 12 bad pairs good, four good pairs bad, five mixed pairs bad and one mixed pair good. Its agreement is 18/34 decisive and 18/40 exact. The owner's scores are for the original saved models only.

### Ruler calibration before any engine change

The offline ruler in scripts/xfer-review/ruler.mjs measures skin in body coordinates, grip carriers, projectile and weapon visibility, head and back directions, wingbeats, and adjacent idle-arm samples. Its inputs are the original model, displayed donor, result geometry and transplant report. It receives no grade, case ID, file name or lookup table. R3 was frozen before changing the engine. This is accuracy on the calibration sample; the new blind sheet is the independent test.

| Owner grade | Ruler good | Ruler mixed | Ruler bad |
|---|---:|---:|---:|
| Good, 7–10 | 15 | 0 | 1 |
| Mixed, 5–6 | 1 | 4 | 1 |
| Bad, 0–4 | 1 | 0 | 17 |

Exact agreement is **36/40 (90%)**, including **32/34** decisive grades. Disagreements are 08 (owner mixed, ruler bad for frozen gait), 16 (mixed, ruler good), 21 (bad, ruler good despite the visible shield covering the head) and 34 (good, ruler bad for genuinely frozen feet). Diagnostic accuracy for an individual defect and agreement on the overall grade are separate measurements.

## Astra round 1 results — build 31

**The new blind test failed.** The owner gave 4 of the first 20 new transplants a grade of at least 7. Build 31 uses production commit `e8d0ad1e` on `codex/xfer-astra-r1`. The comparison below uses the owner's saved answers and the predictions sealed before the grading launcher was opened.

### Independent owner result on the new selection of 20

The owner scored the first 20 cases of the new seeded draw and left 12 comments. The mean was **5.0/10**. Only **4 of 20** reached 7. R3 had called **16 of 20 good** and exactly matched **6 of 20** three-way grades. Of the 16 predictions of good, four were good, eight were mixed and four were bad by the owner's grades. None of the nine mixed grades received a mixed prediction. All four owner-good cases were predicted good. The 36/40 calibration result did not generalize to these new pairings. The original and new sheets use different pairs, so their averages do not measure an improvement on the same models.

| Owner grade | R3 good | R3 mixed | R3 bad |
|---|---:|---:|---:|
| Good, 7–10 | 4 | 0 | 0 |
| Mixed, 5–6 | 8 | 0 | 1 |
| Bad, 0–4 | 4 | 1 | 2 |

| New sheet case | Owner | Sealed R3 prediction | Owner comment |
|---|---:|---|---|
| 01 Repeater Handgunner on Gor with Axe (Unit) | 7 | good | “I would say the gun should replace the axe but otherwise the animation capture is good.” |
| 02 Tauren Chieftain on Grizzly Bear | 3 | good | “its good - but he is maintaining too much of his tauren position - why is he not taking the position of the bear?” |
| 03 Polar Bear on Riderless Wyvern | 2 | good | “arms should be wings...” |
| 04 Lord of Change on Death Knight | 6 | good | — |
| 05 Death Knight on Crypt Fiend | 5 | good | “legs are floating” |
| 06 Crypt Fiend on Naga Siren | 5 | bad | — |
| 07 Naga Summoner on Reikland Handgunner | 5 | good | — |
| 08 Orange Skink Skirmisher on Thunder Lizard | 5 | good | “Body is curled up vs a 4 legged creature” |
| 09 Tauren Chieftain on Gargoyle | 10 | good | “very nice” |
| 10 Dire Wolf on Centaur | 3 | good | “Incorectly done? I guess he is either on all 4s or standing on front legs with 2 arms attacking - this is the worst option.” |
| 11 Gargoyle on Spider | 5 | good | — |
| 12 Centaur on Naga Myrmidon | 4 | bad | “legs are static” |
| 13 Nerubian on High Elf Archer | 3 | good | “shakey - and the model is very high for no reason” |
| 14 Naga Royal Guard on Ratling Gunner (Hero) | 7 | good | — |
| 15 Dark Troll on Lord of Change | 9 | good | — |
| 16 Aspiring Champion of Tzeentch on Cold One Rider (Hero) | 6 | good | — |
| 17 Sea Turtle on Spider | 1 | mixed | — |
| 18 Harpy on Naga Siren | 2 | bad | “static legs” |
| 19 Cold One Rider (Hero) on Daemonette | 6 | good | “legs stick out oddly but ok” |
| 20 Nerubian on Gor with Axe (Hero) | 6 | good | “model is jumping up and down too much and glitching vs original but ok” |

The new grades and comments are recorded separately from the original 40. The table compares them with the predictions saved before grading, without refitting thresholds or using the 20 remaining cases.

#### What the new grades exposed

- **Body posture across different leg counts (02, 08).** Both saved reports register moving feet, no spine correction and zero trunk vertices fitted. The quadruped back fit requires equal leg counts. In 33 Walk phases, the median angle from rear upper-leg skin to head skin was 31.3° on the native Tauren, 32.5° on the result, and 10.9° on the bear. On the Skink it was 31.8° on the result and −2.9° on the Thunder Lizard. R3 only compares back orientation when both rigs have the same count of at least four legs.
- **Choosing the right limb (03, 10).** The bear’s extra forelegs repeat the Wyvern’s leg cycle. The gait mapper has no foreleg-to-wing option. On 10 the wolf supplies four walking legs and its head takes the Centaur’s humanoid head motion. It has no upper torso and arms to reproduce the Centaur’s separate attack. The engine itself recorded that poor fit. R3 still predicted good.
- **Static or wrongly directed legs (12, 17, 18, 19).** Both Naga donors on 12 and 18 have an active tail and zero leg channels. The mapper returns no assignment, leaving the recipients’ hips and legs still. R3 detected these two failures. The turtle on Spider scored 1 with no written reason. The result’s feet moved, while its measured leg axes opposed the donor’s by 99.4°. This is a candidate explanation for that grade. The owner described the mounted legs in 19 as sticking out.
- **Height and bouncing (05, 13, 20).** The two Nerubian results use the sole-height correction. Over 33 Walk phases their median visible skin height travelled 31.4% and 26.5% of their own median skinned heights. The donors travelled 23.4% and 19.4%. The ruler checks idle-arm jitter and stepping, but has no comparable Walk body-height check. On 05, the lowest leg height varied by 15.8 model units against 3.9 on the donor. That does not identify which of the mounted legs the owner saw floating.
- **Weapon role (01).** The owner liked the motion and wanted the rifle to take the axe’s place. The saved transplant report identifies zero vertices for separate weapon transfer on this pair. Following the hand was enough to earn a good automatic verdict. The owner's weapon placement concern remains.

These are diagnoses of the frozen build. The source models, sealed predictions, fresh owner answers and submitted comments remain available for reviewing the next change. None of the grades without a comment have an attributed owner motive.

### Changes by failure class

- **Unequal leg counts.** The shared reader already identified the turtles’ four legs. The transplant now pairs support limbs in facing order and copies the donor chain onto separate recipient pivots where several legs share its cadence. The five owner choices were rear pair on 01 and 40, same-side stepping on 31 and 02, and spare front legs driving the arms on 40. An existing donor arm takes precedence. The trial models and the owner’s saved choices remain in the gait sheet.
- **Wings.** A wing-only recipient can follow the donor’s feather-bearing branches beyond the elbows. War Eagle now closes and opens its wings with the Harpy.
- **Weapons and arrows.** A rigid polearm stays at the palm end of a jointed flail. The Tuskarr spear inherits the donor weapon’s attack visibility. The Skink’s independent spear follows its grip. The separate archer arrow stays hidden in a melee donor’s attack. All 30 bow and string vertices follow the donor weapon together. The Tauren’s independent axe required a second calculation. The engine locates the contact on the skinned fingers and fits the material bow grip to the corresponding hand. It sends the result through the existing shoulder clearance solve. Before the palm fit, the bow grip was 141.4 model units from the mapped left palm at mid-Attack 1. Direct mesh tests found both Tauren hands on the axe at that midpoint, only the right at mid-Attack 2 and only the left at mid-Stand 2. The throwing and dropping controls still release the recipient’s weapon. At the two attack midpoints, the final grip lies within 0.000004 model units of the carrying palm. In a one-millisecond scan of both attacks, the bow stayed within the existing floor allowance for the donor’s strike depth. The recipient’s feet moved less than 0.001 model units between the free and corrected versions in the 129-phase controls.
- **Idle arm.** The shoulder solver intersects the feasible clearance angles for the skinned points, continues its rotation axis through a dip and gives each correction a fixed time window. Across 1-ms samples, the largest shoulder change fell from 3.05° to 0.19° in Stand 1 and from 8.66° to 0.42° in Stand 4. The largest extra change over the untreated shoulder was 0.36° in Stand 4.
- **Head and neck.** The fit now calibrates the visible skull in the donor head’s standing frame. The median facing discrepancy across Stand, Walk and Attack fell from 34.77° to 11.34° on Thunder Lizard/Huntress and from 45.97° to 5.48° on Archer/Tauren Chieftain. These angles measure front-to-back geometry. The Huntress mount was already the correct actor.
- **Shield and rigid forms.** The Footman’s 61 visible shield vertices retain the support forearm’s frame across Attack 2. Ordinary wrist fitting still handles the Grunt. The Obsidian Statue’s solid pedestal, upper ornaments and visible effect geosets follow the donor body, including its fall in Death. Ordinary donor attacks retain the living statue form. The pedestal remains a single rigid object.

### The 40 original pairs on build 31

On the original saved models, R3 matched 36/40 owner grades, including 32/34 decisive grades. This was up from 18/40 exact for v10. R3 rated the originals 17 good, 4 mixed and 19 bad. After rebuilding those same pairs it rated 36 good, 1 mixed and 3 bad. All 16 pairs the owner originally rated at least 7 are now ruler-good, as are 16 of the 18 the owner originally scored 0–4. These are automatic predictions on rebuilt assets.

Each row uses the owner grade from the original sheet, the frozen R3 verdict before and after, and my observation of the rebuilt pair. The full sample covers all 514 listed sequences. The case numbers match the original evidence table above. All 40 displayed donor MDX files still match their originals by SHA-256.

| # | Original owner grade | R3 before → after | What changed on screen |
|---|---:|---|---|
| 01 | 2 | bad → good | Walk now alternates the rear-driven feet. Hellscream still sits very low between the Queen’s legs. |
| 02 | 0 | bad → good | The long legs spread, reach and retract with the chicken’s steps. The stance remains very wide. |
| 03 | 5 | mixed → good | The polearm stays through the gauntleted palm as the attack swings from upright to horizontal. The old whole-weapon sweep around the flail head is gone. |
| 04 | 8 | good → good | The old ship donor rolls and sinks in Birth/Death. The fiend follows the same roll. Calibration case only. |
| 05 | 8 | good → good | The priest still changes knees and carries the staff into the low attack. |
| 06 | 2 | bad → good | The muzzle follows the Huntress mount through mid-Walk. The lizard remains strongly tucked against the cat’s shorter body. |
| 07 | 8 | good → good | The troll’s push-off and raised attack arm remain visible on the Demonette. |
| 08 | 5 | bad → bad | The visible statue and pedestal now tip together with the Cold One Rider. The base has no articulated walking feet. R3 still flags the alternate rig’s feet. |
| 09 | 5 | mixed → good | The blue spear remains visible as the orc swings through Attack. |
| 10 | 8 | good → good | The Harpy still hovers with the Lich and follows its upper-body attack. |
| 11 | 8 | good → good | The short steps and lunging arm still follow the Ratling’s low run. |
| 12 | 9 | good → good | Arthas still changes from the running posture to the raised firing posture. |
| 13 | 5 | mixed → good | The Peon’s feet now alternate under the pick instead of keeping one pose as the body leans. |
| 14 | 0 | bad → good | The gun hand settles smoothly through both Stand 1 and Stand 4. The donor’s slower sway is visible. |
| 15 | 4 | bad → good | The gargoyle’s feet now paddle through Walk Swim while its body follows the turtle. |
| 16 | 6 | good → good | The priest’s step transfers. The Gor’s axe still sits unusually upright across its body. |
| 17 | 0 | bad → good | The eagle’s outer feathers now rise and fall with the Harpy in Stand and Walk. |
| 18 | 2 | bad → good | The spear travels with the Skink’s right hand through the swing. The old spear rode the shoulder. |
| 19 | 7 | good → good | The warlock follows the rider’s forward lean in flight. The staff still rides low. |
| 20 | 4 | bad → bad | The Naga drives forward on its tail. The handgunner still has no donor foot cycle and its legs hold their pose. |
| 21 | 3 | good → good | The shield turns with the forearm during Attack 2. Its 61 visible shield vertices used to turn with the gun hand across the face. R3 calls both versions good. |
| 22 | 9 | good → good | The grounded warrior’s run and guard-to-strike remain legible. The Lord of Change has no donor wingbeat here. |
| 23 | 9 | good → good | The alternating steps and two-arm strike still read on the heavier upper body. |
| 24 | 9 | good → good | The upright pose, low travel and hands held together still follow the villager. |
| 25 | 0 | bad → bad | The entire visible statue pitches through Attack and falls onto its side in Death. The base and lit ornaments remain with it. It has no articulated stride. |
| 26 | 5 | mixed → mixed | Some limbs follow the flying dragon. The spider’s rear remains compressed and points upward. |
| 27 | 0 | bad → good | The Murgul’s feet now follow the sea turtle’s paddling cycle. |
| 28 | 2 | bad → good | The orphaned arrow flash disappears in the melee strike. The bow remains visible. |
| 29 | 0 | bad → good | The Dragonspawn now steps through the Zombie Dragon’s cycle. |
| 30 | 0 | bad → good | The Cold One’s feet now paddle. Its rider still leans heavily forward over the turtle. |
| 31 | 0 | bad → good | The Centigor’s extra legs take the selected same-side gait on their own pivots. The body still rears high in the attack. |
| 32 | 8 | good → good | The Champion retains the dragon’s forward pitch and attack on two legs. |
| 33 | 0 | bad → good | The bow grip and string now travel together and the pelvis arrow is hidden. The Archer still folds deeply into the Headhunter’s throwing posture. |
| 34 | 7 | bad → good | The Ent now takes a long, wide stride. The owner gave the old planted-feet result 7, so the new stride still needs an owner judgment. |
| 35 | 8 | good → good | The long-legged run and broad arm reach remain visible. |
| 36 | 9 | good → good | The hunched walk and staff swing still follow the Paladin’s hammer. |
| 37 | 9 | good → good | The stride and both attacking arms still follow the Gor. |
| 38 | 9 | good → good | The mage keeps the Furbolg’s hunched walk and shifts into the strike. |
| 39 | 0 | bad → good | The fitted grip stays on a holding palm. The Tauren grips the axe with both hands in Attack 1, with the right hand alone at mid-Attack 2 and with the left alone at mid-Stand 2. The visible head follows more closely and the pelvis arrow is hidden. The bow still crosses the Archer’s cloak during the broad axe swing. |
| 40 | 0 | bad → good | The rear turtle feet drive the orc’s steps. The front pair drives its arms. Its robe conceals some of the foot motion. |

The outstanding R3 flags are gait on 08 and 25 (two forms of a rigid pedestal model), gait on 20 (a footed model borrowing a legless donor) and back posture on 26. The shield on 21 and the bow on 39 show why the visual review remains necessary. R3 missed the original shield fault and called an earlier floating bow good after its independent arrow was hidden. The fitted bow now stays with a holding palm, but it still intersects the cloak in the axe swing. On 34 the owner accepted the earlier motion despite the frozen feet. The new long stride still needs a human grade.

### Regression gates

Each row is the actual engine at that commit. G / M / B are frozen-ruler counts of good, mixed and bad. Every row covers 61 distinct panel pairs and 1,000 distinct humanoid pairs. Every comparison joins the same recipient and donor. There were zero scoring errors.

| Stage | Commit | Existing tests passed | Retarget differences / 32 | Panel 61 G / M / B | Humanoid 1,000 G / M / B | New good → bad, panel / humanoid |
|---|---|---:|---:|---|---|---|
| Original graded engine | `a38698a0` | 229/229 | 0 | 49 / 1 / 11 | 946 / 12 / 42 | — |
| Unequal-leg trials | `0b2c34fc` | 229/229 | 0 | 49 / 1 / 11 | 946 / 12 / 42 | 0 / 0 |
| Wing branches | `0abae6ac` | 229/229 | 0 | 49 / 1 / 11 | 946 / 12 / 42 | 0 / 0 |
| Weapon motion and visibility | `98d54023` | 228/229 | 0 | 49 / 1 / 11 | 973 / 3 / 24 | 0 / 0 |
| Head direction | `b2d915c0` | 228/229 | 0 | 49 / 1 / 11 | 973 / 3 / 24 | 0 / 0 |
| Shield and living statue | `c969ab91` | 227/229 | 0 | 48 / 1 / 12 | 973 / 3 / 24 | 1 / 0 |
| Shoulder floor clearance | `09d62043` | 227/229 | 0 | 49 / 1 / 11 | 992 / 3 / 5 | 0 / 1 |
| Owner gait defaults | `d41934ad` | 227/229 | 0 | 59 / 0 / 2 | 993 / 3 / 4 | 0 / 0 |
| Complete bow and string | `59fd87a1` | 227/229 | 0 | 59 / 0 / 2 | 993 / 3 / 4 | 0 / 0 |
| Polearm grip and statue details | `aba5429b` | 229/229 | 0 | 59 / 0 / 2 | 993 / 3 / 4 | 0 / 0 |
| Final bow palm and floor | `e8d0ad1e` | 229/229 | 0 | 59 / 0 / 2 | 993 / 3 / 4 | 0 / 0 |

- **Panel regression, recovered.** Footman on Ghoul, panel index 12, changed from good to bad at the shield and living-form commit. In Stand 2 the right-arm excess turn rose from 1.34° to 19.93° between adjacent samples. Allowing the arm to move freely removed the excess. The floor solver change reduced it to 5.51°, and the final value is 1.57°. All 49 original panel-good cases remain good in build 31.
- **Humanoid regression, still present.** Aspiring Hero on Paladin, humanoid index 596, changed from good to bad at the shoulder floor change. Between 3936 and 3968 ms of Stand 1 the donor arm turns 0.038°, while the result arm turns 30.314°. Its prior maximum excess was 7.10°, and the free-shoulder control gives only 0.07°. The floor correction adds a visible right-arm jump on this pair. Of the original 946 humanoid-good cases, 945 remain good in build 31. The full transition counts include 39 bad-to-good and nine mixed-to-good cases.
- **Tests.** Final build 31 passed all 229 existing transplant, anim-transfer and window tests and all 20 focused regressions, with zero skips. In intermediate commits X3 (Orc Warlock staff on Grunt forearm) failed after the general weapon change. P7 (Footman shield on Grunt forearm) also failed after the shield change. The narrower assignments in `aba5429b` restored both controls. The retarget comparison reproduced all 32 baseline entries at every stage. In both the original and final runs 31 recipes succeed and `nurglespell` requests a Spell sequence absent from its donor.
- **Provenance.** The class sweeps replayed the immutable commits. Historical runs reused deterministic floor plans and extent samples only at identical inputs and dependency versions. The final engine used stock module code. Frozen-ruler output was reused only on identical ruler inputs. Rebuilding the original 40 on an empty cache reproduced every calibration verdict, reason and metric. The repaired offline cache keeps the result model and report together across MDX node renumbering. Both cold and warm runs reproduced the direct original measurements in all 40 cases. The cache repair is a separate local tooling commit, `363b9287`.

The panel and humanoid counts describe automated regression coverage. The independent owner grades above are the quality check.

### Build and grading files

The fresh 40 use seed `20261124` and contain 40 unique, previously ungraded ordered pairs of living units. Twenty-three include a custom model. The owner’s additional 20-case launcher uses the first half of that seeded draw and the same answer IDs. Both launchers open the same packaged engine. The full 40 and the short selection count a saved grade once.

- [Open the 20-pair selection](<D:/Claude/MDLxL/TestBuilds/_START HERE/GRADE 20 - Astra round 1.cmd>)
- [Open the full 40-pair sheet](<D:/Claude/MDLxL/TestBuilds/_START HERE/GRADE - Astra round 1.cmd>)
- [Packaged build 31](<D:/Claude/MDLxL/TestBuilds/transfer-xl-31>)
- [Sheet, models, sealed predictions, owner answers and grading-screen evidence](<D:/Claude/MDLxL/TestBuilds/transplant-grade-astra-round1>)
- [The owner’s five gait decisions and trial models](<D:/Codex/xfer-astra-r1/out/gait-choice>)
- The review folder contains original and final measurements, all 40 rebuilt MDX files with their SHA-256 hashes, ten before/after atlases, contact and regression measurements, the owner’s 20 independent grades, the gate matrix and the compressed per-pair rows. [Round evidence for Claude](<D:/Codex/xfer-astra-r1/out/round1-review>)

All 20 transfer stories passed in sequential, hidden, normal-priority runs of package 31. I checked the actual default and detailed grade views for all 40 new pairs. The harness also verified 80 synchronized Walk samples and normal linked mouse rotation in all 40 screens. The texture audit covered all 520 source references, including 12 loose custom textures. There were zero unresolved texture warnings or app errors in the review. Several differently sized models display smaller in their default view, particularly the Death Knight and Ratling. Non-texture sound and external-effect notices are recorded in the grading evidence. The eight shipped engine source files match the tested worktree by SHA-256. Six unchanged custom model fixtures used by the tests are pinned under `D:\Claude\MDLxL-TestModels\transfer-astra-r1`.

The 20 new owner grades above are the independent quality result for this build. The other 20 fresh cases have no owner grade in this comparison. Verification used the packaged MDLxL preview. Warcraft III playback remains untested.

## Follow-up result — donor posture and the 20-pair review, 21 November

I reviewed 16 transfers between similar body types and four transfers between body types. I watched the posed meshes in Stand, Walk and Attack, inspected 12 phases per clip, and checked the saved MDX files side by side in the textured MDLxL viewer. I initially graded 16 good and four mixed. I withdraw that assessment. The owner subsequently gave five exports zero, and six comparisons reuse essentially the same mesh. The later skin audit below supersedes my grades.

### Engine changes

- A four-legged donor can use all four POSE support chains to orient a biped's torso. The rear legs drive its legs and the forelegs drive its arms. The existing shoulder floor correction now checks the skinned forelimbs against the recipient's hind-foot support plane. In the Chieftain's Walk, the old palms stayed 21–66 model units above zero across 12 samples. With the new fit the lowest palm ranges from about −5 to +4. During Attack both Tauren rise with the bear. Their weapons and the Chieftain's back totems still interfere with the silhouette.
- The centaur's front leg pair and humanoid upper body have a common skeletal carrier above the forequarters. The automatic biped mapping uses that pair for the recipient's legs, and keeps the torso, hands and head on their corresponding upper-body handles. An armless quadruped takes all four legs and carries its head on the centaur's forequarters. The Centaur's axe swing no longer pulls the Bear's head down with the humanoid torso. This uses the shared POSE rig, its limb hierarchy and the posed geoset surfaces used for floor clearance.
- On the Skeleton Warrior, both the sword and shield had qualified as weapons. The Footman's sword consequently followed the shield arm. Where both hands have named equipment, an authored Weapon Ref on one hand and shield-only equipment on the other resolve the weapon side. This retains an ambiguous reading for two actual weapons. The corrected Footman carries its sword forward in Walk and swings with the donor.
- Fifteen of the 16 ordinary comparisons retained their build 31 sampled skin and handle positions. Wrist placement can still differ because of shoulder spacing and arm length. On Wolf Rider → Knight the rein hand reaches across the rider's middle in Walk. On Grunt → Felguard the right elbow comes farther inside during part of Attack. These are the two ordinary transfers I judged mixed.

### Withdrawn visual grades, retained for comparison with the owner's notes

| Donor → recipient | Grade | What I saw |
|---|---:|---|
| Wolf Rider → Knight | 6 | The horse and rider follow the gallop. The rein hand reaches too far across the chest. |
| Knight → Wolf Rider | 7 | The wolf takes the horse's stride and rear, and the seated rider takes the strike. |
| Grunt → Footman | 7 | The feet alternate and the sword follows the axe swing. The shield covers more of the guard. |
| Footman → Grunt | 7 | The Grunt takes the Footman's step and attack. The axe reads clearly on the downswing. |
| Felguard → Grunt | 8 | The longer stride, forward lean and weapon thrust carry through. |
| Grunt → Felguard | 6 | The walk carries through. The right elbow comes too far inward during the attack. |
| Bandit → Footman | 7 | The walk and strike read. The larger shield partly hides the free forearm. |
| Footman → Bandit | 7 | The Bandit keeps the step, shield guard and axe swing. |
| Night Elf Archer → High Elf Archer | 9 | The run, draw and bow position track closely. |
| High Elf Archer → Night Elf Archer | 9 | The draw and release track closely in the reverse direction. |
| Timber Wolf → Dire Wolf | 9 | The paw cycle and bite track closely. |
| Dire Wolf → Timber Wolf | 9 | The reverse transfer also retains the crouch and lunge. |
| Grizzly Bear → Tauren Chieftain | 5 | The Chieftain walks on hands and hooves and rears in Attack. The polearm, back totems and hero glow obscure the contacts. |
| Centaur → Grunt | 8 | The front legs step under the humanoid chest and the hands retain the axe action. |
| Centaur → Grizzly Bear | 7 | The Bear takes the four-leg gallop. Its head stays with the forequarters during the axe strike. |
| Wolf Rider → Chaos Wolf Rider | 9 | The mounted gait and arm motion track closely on the related rig. |
| Grunt → Chaos Grunt | 9 | The footfalls and axe strokes track closely on the related rig. |
| Footman → Militia | 8 | The guard, steps and downswing remain readable. |
| Skeleton Warrior → Footman | 8 | The sword now follows the sword hand and the shield follows the shield hand. |
| Grizzly Bear → Tauren | 6 | The regular Tauren drops to all fours and rises for the strike. The log still occupies the front contact area. |

### Verification and review files

All 253 related tests passed with zero skips. The three new support regressions fail on build 31. The new shield-hand test failed before the handedness change. All 32 retarget fingerprints match the original, including the existing missing Spell sequence. All 20 saved models reopened with the donor's full sequence list. A real mouse drag rotated both panes in each hidden MDLxL review case. Verification covered MDLxL playback. Warcraft III playback remains untested.

The 61-pair panel retained 59 good and two bad. The 1,000 humanoid pairs retained 993 good, three mixed and four bad, with zero verdict changes against build 31. The full sets ran with the support change. The handedness change affected one source model in the collected fixtures, the Skeleton Warrior. Its one panel pairing and 31 humanoid pairings were rechecked on the final engine. The original owner-graded 40 retained 36 good, one mixed and three bad according to the ruler. Agreement with the original owner grades was 19/40 on the changed results. Those original grades refer to the original models. The owner's later blind 20 still scored build 31 at four of 20 good.

- [Open the 20 saved donor/result comparisons](<D:/Codex/xfer-pose-handles-review/Review 20.cmd>). The launcher opens build 31 as a viewer for MDX files exported by the revised engine. It stores any new owner grades beside this sheet.
- [Textured comparison of all 20 pairs](<D:/Codex/xfer-pose-handles-review/evidence/twenty-in-mdlxl.jpg>) and [four before-and-after Walk cycles](<D:/Codex/xfer-pose-handles-review/evidence/four-walks.webp>).
- [Saved MDX files](<D:/Codex/xfer-pose-handles-review/models>) and [regression counts](<D:/Codex/xfer-pose-handles-review/evidence/regressions.json>).

## Corrected result after the owner rejected the 20-pair selection

The owner graded all 20. Six pairs were texture or near-identical mesh variants. Of the 14 distinct transfers, the owner gave nine an 8–10 and five a zero. My earlier 16-good assessment missed visible deformation on the mounted units, a misplaced shield, and both failed Bear postures. I withdraw those grades and the selection. The original owner files and answers are preserved.

### The five zeroes

| Donor → recipient | What changed | My judgment on the revised export |
|---|---|---|
| Wolf Rider → Knight | The rider's seated POSE pelvis now carries the rider's waist. The horse's trunk fit uses the mount hips, so the horse no longer pulls the waist along a shoulder-to-hip skin band. | **Hold.** At the start of Walk the horse's covering stretches between its legs. One edge measures 96.8 units against 55.4 at its longest in the native Knight. |
| Knight → Wolf Rider | Pairing the seated pelvis also keeps wolf and rider skin on their respective actors in the reverse transfer. | **Hold.** In Death the Knight has fallen into a heap. The Wolf Rider still appears seated, and an edge between the wolf's body and chest reaches 57.8 units against a native maximum of 31.1. |
| Bandit → Footman | The Bandit's authored wrist attachment sits on the forearm. A static mesh carrier had put the apparent wrist behind the head. XFER now uses the attachment to establish the forearm direction. Where both hands carry a rigid plate, the connected shield surface sets wrist twist. | **Shield placement verified in MDLxL.** The Footman's larger shield stays at the forearm and follows the guard and strikes. Correcting position alone left the two shield faces 32° apart. The final difference is 7.5° in Stand, Walk, Defend and Attack. In Decay Bone the Bandit shows its separate gut mesh and the Footman disappears. This follows the owner's existing living-body visibility rule. |
| Grizzly Bear → Tauren Chieftain | The shoulder pairs at the POSE arm root. The forelegs locate the head. A supporting palm uses the POSE elbow solve for vertical floor clearance while retaining the paw orientation and stride. | **Hold.** Hands stay on their respective sides in all 234 Walk samples. The owner-graded export crossed in 196. Chieftain wrist travel over 10 ms peaks at 0.06 limb lengths in Walk and 0.14 in Attack Slam, against 0.07 and 0.14 on the Bear. In Attack Slam the skin between the upper arm and chest still stretches from a native maximum of 45.2 to 90.0 units. |
| Grizzly Bear → Tauren | The regular Tauren uses the same four donor support handles. It keeps its hands apart in all 234 Walk samples. The graded export crossed in 40. | **Hold.** In Attack Slam the log extends in front of the body on an elongated shoulder. The edge between the upper arm and the shoulder/neck blend reaches 63.3 units against 33.2 in the native Tauren. |

[Four held exports at the failing frames](<D:/Codex/xfer-astra-r1/out/skin-review/held-skin.jpg>) · [Bandit and Footman shield comparison](<D:/Codex/xfer-astra-r1/out/skin-review/shield.jpg>)

### Selection and visual checks

The two Archer directions share all 280 distinct vertex positions and the two Wolf directions share all 269. The Chaos Wolf Rider shares 382 positions with the ordinary Wolf Rider. The Chaos Grunt shares 403 with the ordinary Grunt. All six were excluded. Positions were rounded to 0.1 model unit so that UV seams and reordered vertices would not disguise a shared shape.

The nine genuinely different, high-graded exports regenerated byte for byte. These include Grunt ↔ Footman, Felguard ↔ Grunt, Footman → Bandit, Centaur → Grunt, Centaur → Grizzly Bear, Footman → Militia and Skeleton Warrior → Footman. Their grades belong to the owner.

I replaced the six duplicates in the **internal** comparison with Militia → Grunt, Bandit → Grunt, Grunt → Captain, Felguard → Footman, Footman → Felguard and Knight → Death Knight. Each has distinct geometry. The Militia's backswing and forward step read on the Grunt. The Captain takes the Grunt's walk and weapon throw. The two Footman/Felguard directions show why a similar body plan alone is insufficient: one holds a shield while the other uses a long weapon. Knight → Death Knight still crowds the rider and mount during the fall. These comparisons have no owner grades.

The saved-mesh check walked every visible non-additive triangle edge at 60 Hz, at authored local track keys, and at clip endpoints. It compared each edge with its maximum through the recipient's own animation catalog. It covered 173,551 poses in the original 20 exports. The five challenged exports and six new cases also ran through a hidden textured MDLxL viewer. Across their 137 clips, 103,675 synchronized pose samples were examined. After folding consecutive identical visible poses, ten camera directions yielded 768,140 donor/result comparisons, including overhead and underside views. Frame-by-frame capture and image checks were automated. I personally inspected synchronized motion strips, orbits and enlarged failure frames. I did not personally grade each individual render. Long Decay clips account for a substantial share of the frame count.

The high owner grades, the native recipient's edge lengths and the donor's actual stance provide independent references. A single moving limb, a passing floor-height test or a successful export cannot establish a visual pass. The old 20-pair launcher remains historical. I have withheld a new owner grading panel.

[Per-pair surfaces and export fingerprints](<D:/Codex/xfer-astra-r1/out/skin-review/surfaces.json>) · [Per-clip frame and camera coverage](<D:/Codex/xfer-astra-r1/out/skin-review/coverage.json>)

### Regression results

All 268 related tests passed on the final code, with zero skips. All 32 retarget fingerprints match the previous baseline, including the fixture whose donor lacks a Spell sequence. The 61-pair panel retained 59 good and two bad. The humanoid 1,000 retained 993 good, three mixed and four bad. After the initial sweep I replayed 136 humanoid rows covering potential forelimb changes and pending cases, then 326 rows whose donor could have a misplaced static hand carrier. Every prior panel and humanoid verdict was preserved.

On the original 40 pairings, the ruler called these revised exports 36 good, one mixed and three bad. Those calls agree with the owner's grades on the **original exports** in only 19 cases. This comparison does not establish owner acceptance of any revised export. Whole-model Warcraft III playback was not exercised. The local evidence records the remaining mesh failures, contains the eleven private engineering exports and leaves the previously distributed model files intact. [Regression results](<D:/Codex/xfer-astra-r1/out/skin-review/regressions.json>)


## Solo repair of the four held transplants, 21 November 2026

Local engine commit `a343ba6b` follows `061192ef`. I compared the four saved results with their donors in MDLxL. The table gives lengths in model units for the same triangle edge at the same previously rejected frame. The native column is that edge's greatest length in the recipient's own animation catalogue.

| Donor → recipient | Rejected | This export | Native | What I checked on screen |
|---|---:|---:|---:|---|
| Wolf Rider → Knight | 96.82 | 50.94 | 55.39 | At the first gallop frame the horse extends and gathers with the wolf. The material seam stays sewn, and the four boots meet the covering. I also compared the open underside with the unmodified Knight. |
| Knight → Wolf Rider | 57.75 | 31.07 | 31.06 | The wolf and rider fall together when the Knight switches to its corpse skeleton. The rider comes off the seat. At Death +1500 and +2100 ms the released sword and donor lance both lie at approximately 3° to horizontal. |
| Grizzly Bear → Tauren Chieftain | 90.05 | 59.28 | 45.25 | The palms alternate with the Bear's front paws. The right palm supports the body while the axe turns around its grip to clear the floor. The torso and upper arm stay connected through Slam. This is the largest residual stretch of the four original failure edges. |
| Grizzly Bear → Tauren | 63.25 | 35.58 | 33.20 | The Tauren takes the Bear's four-foot stance, rises for the slam and brings its hands forward. The upper arm follows the chest and the log stays with the hand. |

The mount covering shares its skin weights between each thigh and its body socket. The tops of the exposed legs share that motion at the hem. Pinning only the cloth to the body had reduced the stretch reading while leaving a 29-unit gap beneath it. On the saved result all four legs come within 1.8 units of the covering at that frame. Matching textured triangles across the Knight's living and corpse geosets identifies the moving rider, mount and loose lance despite their different roots. For the Taurens, POSE supplies the shoulders and palms, and the recipient's own chest-relative shoulder travel limits how far a sliding donor foreleg root pulls the skin.

### The 20-pair grading sheet

The panel has 20 unique unordered pairs using 28 distinct source models. Fourteen pairs have two bipedal units. The others cover mounted units, ordinary quadrupeds, the Centaur's front body and the two four-footed Taurens. Grunt → Footman, Felguard → Grunt and Wolf Rider → Knight are included. I checked the textured models and compared distinct vertex positions rounded to 0.1 unit. The largest overlap within a selected pair is 13.0%. I removed Peasant → Peon after seeing a detached gold sack, Skeleton Warrior → Footman after comparing Death, and other candidates with prop or deformation problems. The reverse mounted repair is available beside the evidence as a separate MDX.

The grading launcher opens the saved exports in MDLxL build 31. Both panes rotated through normal mouse dragging on all 20 screens. A private copy saved a grade and a comment for each pair. The owner's new sheet starts ungraded. [Launch the 20-pair sheet](<D:/Codex/xfer-solo-review-20/Review 20.cmd>) · [Four repaired poses](<D:/Codex/xfer-solo-review-20/evidence/four-transplants.jpg>) · [Panel pictures](<D:/Codex/xfer-solo-review-20/evidence/twenty-transplants.jpg>)

### Visual and regression evidence

For the four repairs, the sweep covered 52 clips, 45,113 synchronized time samples and 604,850 individual model views. For the grading panel it covered 244 clips, 179,296 time samples and 2,282,540 model views. The sets overlap. Each sweep sampled at 60 Hz, clip endpoints and authored keys. It rendered each distinct visible skin pose from eight directions around the body and from above and below. I personally inspected synchronized textured strips, rotated views, the old failure poses and the largest deformation frames. The frame sweep and pixel counts were automated. Empty raster views in the panel occurred in Decay clips. Particle effects can extend beyond the solid-skin framing. Warcraft III playback was not exercised. [Per-clip geometry, coverage and saved-file hashes](<D:/Codex/xfer-solo-review-20/evidence/visual-review.json>)

All 272 related tests passed, with zero skips. Each of the four new regressions failed on the previous commit. All 32 retarget fingerprints matched their original baseline. The 61-pair panel retained 59 good and two bad. The humanoid 1,000 retained 993 good, three mixed and four bad, including a final replay of 64 potentially affected or previously non-good rows. On the original 40 pairings the ruler still returned 36 good, one mixed and three bad. Those revised-export verdicts match 19 of the owner's labels on the original bytes. The owner's grades remain the reference for those original exports. Grades for this new selection are pending. [Regression results](<D:/Codex/xfer-solo-review-20/evidence/regressions.json>)

## Result from the owner's graded 20, 21 November 2026

Engine commit `6fe478b3` on `codex/xfer-astra-r1`. I reopened the graded exports and the donors, repaired the eleven pairs with notes and kept their original case numbers. The new sheet opens each pair on its reported animation. It writes its own grades. [Review the 11 saved exports](<D:/Codex/xfer-walk-review-11/Review 11.cmd>)

### Walks

The old ground fit shifted the entire skeleton whenever the lowest supporting foot changed. The side view showed extra dips when the Knight gathered its legs and when the Centaur handed weight between its front and rear pairs. The Satyr's much broader bounds were visible on the donor itself. Four-legged support now absorbs the changing ground correction at the knees while retaining the angle of the foot. For paired two-legged walks, the fit filters the foot-contact height over adjacent frames. The donor's original lift and fall remain in the body motion.

I stepped through 552 synchronized poses across the seven complete Walk loops from a fixed side camera and ground line. The table gives the largest extra change in vertical speed, measured as the second difference of hip height at 60 Hz after subtracting the same donor motion fitted to the recipient with the ground offset held constant. Values are model units per sample squared. [Side-view pictures](<D:/Codex/xfer-walk-review-11/Walks.jpg>)

| Donor → recipient | Owner grade on previous export | Previous peak | Repaired peak |
|---|---:|---:|---:|
| Wolf Rider → Knight | 7 | 13.47 | <0.01 |
| Satyr → Ghoul | 7 | 6.05 | 0.85 |
| Grizzly Bear → Timber Wolf | 6 | 2.94 | <0.01 |
| Gul'dan → Kobold Geomancer | 6 | 2.18 | 0.25 |
| Centaur → Grunt | 6 | 10.15 | <0.01 |
| Grizzly Bear → Tauren | 6 | 4.15 | <0.01 |
| Grizzly Bear → Tauren Chieftain | 7 | 3.40 | <0.01 |

### Belly, cloak and blade

- **Ogre Warrior → Furbolg, previously 6.** The Ogre's unnamed front belly bones move the Furbolg's stomach relative to its torso. In Stand 3 the donor's belly patch travelled 14.22 units and the Furbolg's travelled 7.40. I checked the expansion and return from the side and front.
- **Shaman → Priest, previously 5.** The broad rear robe panel drives the Priest's cape from its collar to the hem. Its lower panel travelled 12.45 units relative to the collar in Walk. The recipient's own cape joints limit how far its panels fold.
- **Acolyte → Priest, previously 7.** The rear skirt drives a gentler swing. The donor panel travelled 5.48 units and the Priest's lower cape travelled 6.11 in Walk.
- **Footman → Spell Breaker, previously 5.** The Footman's weapon attachment identifies its sword even though the bound mesh has an anonymous node name. The Spell Breaker's solid blade stayed visible and its two spinning substitutes stayed hidden at every millisecond of all three attacks, 3,003 samples. [Belly, cloak and blade pictures](<D:/Codex/xfer-walk-review-11/Belly cloak and blade.jpg>)

### Verification and remaining limits

The saved exports retained their donor timelines and recipient triangle topology. I checked the visible edges of all 20 transfers through 244 clips and 179,024 sampled poses. The packaged MDLxL viewer rendered 38,260 donor and result views across 229 non-swim clips. Each reported Walk and each Footman attack was sampled at 60 Hz and authored keys from eight headings, above and below. I inspected the side sequences, the additional angles and each repaired model's worst measured edge at its exact frame. Both panes responded to the normal mouse drag on all 20 pairs. A private copy of the delivered sheet saved a grade for all 11 cases.

The Timber Wolf's torso still lengthens when it reaches forward in the Bear's Attack Slam. Its longest excess over its native edge envelope is 38.4 units at +700 ms, also present in the graded export. These checks cover MDLxL playback. Warcraft III playback and owner grades on the repaired files remain outstanding.

All 283 related tests passed with zero skips. All eleven new regression checks failed against the graded engine. All 32 retarget fingerprints matched. The 61-pair panel retained 59 good and two bad. The full humanoid 1,000 retained 993 good, three mixed and four bad. Each pair retained its previous gate verdict. The revised exports for the original 40 scored 36 good, one mixed and three bad under the ruler. Those verdicts match 19 of the owner's labels on the original files. [Saved-file hashes, measurements and gates](<D:/Codex/xfer-walk-review-11/verification.json>)

## Four regressions reported on the 11-pair walk sheet

The owner raised seven pairs to 9 and lowered four. I reproduced all eleven graded exports byte for byte before changing the engine. The four new files were produced at local commit `e2278918`. The other sixteen outputs from the 20-pair selection match the previous engine byte for byte, including all seven files graded 9. The owner’s grades and notes on both earlier sheets are intact.

| Donor → recipient | Owner’s grades, first → latest | What changed in the reported animation |
|---|---|---|
| Centaur → Grunt | 6 → 5 | In Stand - 3 the Centaur keeps its torso level as the front legs move. The Grunt now takes that torso height and fits its own boots on the two front supports. Its hip’s vertical excursion went from 7.76 units to zero, matching the donor. The lowest boot ranges from −0.36 to +2.31 units relative to the floor. |
| Grizzly Bear → Tauren | 6 → 0 | The bear’s rear hip, knee and hoof drive the recipient’s hock. The skin around each joint now keeps its standing cross-section as the hock folds. At their narrowest, the four measured sections previously retained only 19.3% of their native width. All four retain their width throughout Walk to within 0.00002%. The skin between sections still compresses around a bent knee. |
| Acolyte → Priest | 7 → 5 | Separate points on the visible donor robe now drive the left and right cape panels and their lower seam. During Walk the trailing hem travels 20.15 units fore and aft, against 20.19 for the donor and 25.41 for the rejected result. The lower center also lifts through about 27 units, against 25 on the donor and 18 previously. |
| Grizzly Bear → Tauren Chieftain | 7 → 0 | Removing the second bend of the support limbs restored the earlier arm motion. Over 136 common Walk samples, every visible skin vertex follows the first graded export to within 0.000016 units after accounting for the whole-body shift. Peak arm reversal fell from 50.15 to the earlier 5.44 units per 60 Hz sample squared. The donor measured 4.06. The Chieftain’s hip rises and falls through 3.53 units, down from 15.64 in the first export. |

I compared the donor, both graded exports and the revised export in packaged MDLxL. The Grunt’s entire Stand - 3 and the other three complete Walks covered 555 synchronized poses at 60 Hz plus authored keys. Each was rendered from eight horizontal headings, above and below. I inspected consecutive side frames, the opposite side, the rear-leg shape, the cloak’s lift and the Chieftain’s arm reversals. A surface check covered all 45 sequences and 43,794 sampled poses. I also inspected the worst measured visible edge in each sequence that had one. All four delivered MDX files retain every donor sequence name and interval and every recipient triangle index. Both grading panes rotated under ordinary mouse drag on all four cases. A private copy saved a grade and note on each.

The complete models still have defects outside the four reported clips. The Grunt’s waist edge reaches 33.43 units in Attack - 1 at +333 ms against its native envelope of 13.23. A Chieftain leg edge reaches 42.12 in Attack Slam against 27.20 native. The Chieftain’s living body and glow also remain visible as Decay Bone starts, after the Bear’s living body disappears. I confirmed all three defects on both previously graded exports. These figures and observations describe MDLxL playback. Warcraft III playback and owner grades on the revised files remain outstanding.

All 287 related tests passed, with zero skips. The four new checks failed first on the graded engine. All 32 retarget baseline records matched, including 31 successful fingerprints and the existing Nurgle trial with no Spell sequence. The 61-pair panel retained 59 good and two bad. The 1,000-pair humanoid set retained 993 good, three mixed and four bad. No individual verdict changed on either set. On fresh exports for the original 40, the ruler returned 36 good, one mixed and three bad. Only 19 of those predictions agree with the original human labels.

[Open the four comparisons](<D:/Codex/xfer-four-review/Review 4.cmd>) · [Body and arms](<D:/Codex/xfer-four-review/Body and arms.jpg>) · [Rear legs and cloak](<D:/Codex/xfer-four-review/Rear legs and cloak.jpg>) · [Saved-file hashes, per-clip measurements and checks](<D:/Codex/xfer-four-review/verification.json>)

## Four owner grades and the 40-model showcase

The owner graded Centaur → Grunt 10, Grizzly Bear → Tauren 9, Acolyte → Priest 8 and Grizzly Bear → Tauren Chieftain 5. The Chieftain note was “back legs are still twigs.” The 9 and 8 are carried into this sheet as byte-identical files. The Grunt and the Chieftain were regenerated after the repairs in `985b62e3` and `9f01e322`.

| Donor → recipient | Evidence from the saved models |
|---|---|
| Grizzly Bear → Tauren Chieftain | The leg fit now includes skin bound directly to the recognized joints. Six rear-leg sections retained their standing width to within 0.001% across Walk and Attack Slam. The thinnest measured section previously fell to about half its standing width. The stretched thigh edge in Attack Slam fell from 42.12 to 24.88 units, within its native 27.20. The living skin and hero glow disappear with the donor in Decay Bone. |
| Centaur → Grunt | Waist vertices now follow the Centaur’s front torso. The open waist seen in Attack - 1 closed. The measured edge fell from 33.43 to 16.79 units in Attack - 1, 17.06 to 14.05 in Walk and 20.27 to 17.87 in Stand - 3. Some waist elongation remains against the Grunt’s own 13.23-unit attack envelope. This repaired export is beside the comparison pictures. |

The disappearance change exposed duplicate visibility records on two legacy recipients during the full sweep. Both now export using the first effective record for the mesh. The change covers the original Myrmidon and Reikland Handgunner Old pairing and the humanoid sweep’s Murgul Shadowcaster and Reikland Greatsword pairing.

The showcase contains 40 different recipient meshes and 51 distinct authored assets. There are 29 two-legged pairs, six mounted pairs, two four-legged pairs, two Bear-to-humanoid pairs and one flying pair. Thirty-one pairings are new relative to the last sheet of 20. The first three are Grunt → Footman, Felguard → Grunt and Wolf Rider → Knight. I selected the 40 from 88 candidates. Selection included review of donor and result silhouettes and comparisons of standing vertex positions across the source meshes to exclude reskins. The showcase tests these selected fits. For example, outside the sheet a mounted Bandit Mage’s horse motion carried into the Witch Doctor, and the Bear’s slam stretched the Thunder Lizard.

For the selected 40 I reviewed the side-view frame sequences against the donors, including the up-and-down motion through each complete primary loop. Those renders cover 3,166 synchronized poses at 60 Hz plus authored keys, each from eight horizontal headings, above and below. All 454 clips received surface measurements covering 326,156 sampled poses. I also inspected the midpoint and worst measured poses from three angles where visible geometry was present. The latest engine independently reproduced all 40 showcase exports and the separate Centaur → Grunt repair byte for byte.

All 291 related tests passed with zero skips. Four regression checks failed first. All 32 retarget baseline records matched, including the existing Nurgle trial with no Spell sequence. Individual verdicts held across the 61-pair panel (59 good and two bad) and the 1,000 humanoid pairs (993 good, three mixed and four bad). The original 40 regenerated without an export error. The ruler returned 36 good, one mixed and three bad on those revised files. Only 19 match the owner’s labels on the originals. A ruler rating cannot substitute for a new owner grade.

The packaged transfer harness exercised 22 controls, applied the transplant and restored the original with Undo. A private copy of the delivered grading sheet opened all 40 cases, accepted camera rotation by mouse in both panes, and saved all 40 grades and comments without a page error. The owner’s new sheet starts blank. Playback was verified in MDLxL. Warcraft III playback and the new owner grades remain outstanding.

[Grade the 40 models](<D:/Codex/xfer-showcase-40/Review 40.cmd>) · [Donor, graded and repaired poses](<D:/Codex/xfer-showcase-40/Repairs.jpg>) · [Centaur → Grunt repair](<D:/Codex/xfer-showcase-40/Repairs/Centaur to Grunt.mdx>) · [Pair list, SHA-256 hashes, motion measurements and test results](<D:/Codex/xfer-showcase-40/verification.json>)

## New-model capacity sheet after five owner grades

The previous showcase filled 80 donor and recipient slots with only 51 distinct models. Counting new pairings against the preceding 20 still allowed the owner to see familiar units repeatedly. The owner stopped after five cases and asked for new models in both roles. A model counts as shown as soon as a sheet is offered, including ungraded cases. For future capacity sheets, exclude both roles from every previous roster, exclude reskins and check for reversed pairs.

| Previous pair | Owner grade | Evidence |
|---|---:|---|
| Grunt → Footman | 6 | The owner reported losing the weapon handle in Stand Victory. The Grunt throws and catches its axe. On the Footman, the sampled sword and hand faces still have a 13.0-unit gap at +750 ms and return to a 0.4-unit gap by +775 ms. |
| Felguard → Grunt | 10 | No written note. |
| Wolf Rider → Knight | 9 | No written note. |
| Grizzly Bear → Tauren Chieftain | 7 | The owner reported shaking in Attack Swim. At 60 Hz, the peak absolute second difference of hip height was 7.00 units in the graded result and 0.44 in the donor. Disabling ground fitting in a diagnostic export reduced the result to 0.68. |
| Acolyte → Priest | 9 | No written note. |

The new sheet evaluates the same engine, `9f01e322`. Both previous engine defects remain open. This round changed the coverage and the delivered model files. I compared 80 candidate pairs and selected 40. Each of the 80 selected sources is unique across both roles and absent from the earlier review files. The check covered 492 prior model files, source hashes, raw and normalized vertex positions and triangle edge lengths. I also checked the rendered silhouettes for close variants. Forty-three selected models come from the custom POSE fixture collection. The other 37 come from the native and LowPolyWorks collections.

I inspected the 40 primary motions against their donors from the side at 60 Hz, totaling 2,311 synchronized poses. The comparisons include multiple camera angles, the other animation clips and the three worst measured mesh poses per pair. The surface measurements covered 46,127 samples in 426 clips. Candidates withheld included Chelid → Lurker for distorted attack geometry and Nurgle Knight Champion → Elector Count for the mounted donor’s poor fit on the recipient.

Both panes rotated and accepted grades and comments on private copies of all 40 delivered cases. The final viewer checks reported zero page errors or unresolved textures. Three pairs carry external effects that MDLxL cannot preview. The Fallen One Assassin and Black Fur Hunter comparison also reports missing footprint and splash event-table entries. A misnamed PNG in the texture bank was supplied as a BLP for the Slaanesh warrior, with identical decoded RGBA pixels. The previous grades are preserved. The new grades belong to a separate file.

[Open the grading sheet](<D:/Codex/xfer-new-models-40/Grade 40 new pairs.cmd>) · [See the 80 models](<D:/Codex/xfer-new-models-40/Model roster.jpg>) · [Read the roster](<D:/Codex/xfer-new-models-40/Pairings.md>) · [Source identities, measurements and verification](<D:/Codex/xfer-new-models-40/verification.json>)

## Repairs from the owner’s 40 new-model grades

All 40 grades were read from the original review. Twelve included written issues, including the two 8/10 notes on the Revenant and Infernal. The repair sheet opens those 12 donors beside the revised recipients and writes to a separate grades file. The engine revision is `be6dc61f`.

| Case | Donor → recipient | Original grade | Donor comparison |
|---|---|---:|---|
| 02 | Reikland Greatsword → Dismounted Knight of the Blazing Sun | 5 | The Knight releases, spins and catches his sword in Stand - 2. The transfer now binds all 42 blade vertices to the moving weapon. Mean blade-direction error fell from 71.5° to 10.7°. |
| 04 | Borreal Hound → Bagnadrana | 6 | Bagnadrana's tail follows the hound's tail through the stride. The lowest tail point moved from −71.1 to −0.2 model units in Walk and from −60.9 to −0.2 in Attack. |
| 06 | Fel Thief → Skeletal Assassin | 3 | Both legs bend and step on the thief's cadence. Mean right and left leg-direction errors on the skinned model fell from 54.0° and 43.9° to 25.6° and 10.6° in Walk - 1. |
| 11 | Naga Stealth Viper → Naga Whaler | 2 | The Whaler's linked tail sections now articulate through the serpent's stride. Mean tail-direction error in Walk fell from 35.7° to 16.0°. Attack - 2 still differs by 17.7° on average, up from 14.1°. |
| 14 | Black Stag → Spirit Pig | 6 | The Spirit Pig follows the stag's head pitch during Attack 2. The mean head-direction difference measured from the face geometry fell from 38.7° to 6.7°. |
| 17 | Crypt Mother → Nerubian Arbalest | 6 | All four Arbalest feet now follow their matching donor legs in Walk and Walk Fast. Mean direction errors across the four feet fell from 20.4–38.6° to 2.8–6.9° in Walk. |
| 20 | Phoenix → Albatross | 1 | The Albatross follows the Phoenix's rise and fall. In Stand the mean vertical tracking error fell from 40.0 model units to below 0.01. |
| 24 | Mindflayer → Odium | 3 | Odium's arms follow the Mindflayer's visible arms and its body follows the donor's rise. Mean Walk height error fell from 15.1 model units to below 0.01. Mean wrist-direction error on each side rounded to 0.0°. |
| 30 | Sand Scorpion → Red Sizzer | 3 | Red Sizzer's feet now follow the scorpion's stepping phase. The two front leg-direction errors in Walk fell from 29.7° and 23.3° to 14.0° and 15.5°. The largest gap between the nearest shell and tail-fan vertices in Spell fell from 46.2 to 5.9 model units. The different leg proportions remain visible. |
| 32 | Aspiring Champion → Revenant | 8 | The Revenant's weapon follows the Champion's grip and swing. The shield receives the mirrored change from the weapon's original pose. Mean weapon-direction error fell from 104.2° to below 0.01° in Stand and from 93.7° to 0.31° in Attack - 1. The palm-to-weapon surface distance stays at the authored 2.2 units. Shield-to-palm spacing is 11.4 units against the authored 12.3. |
| 38 | Night Elf Runner → Assassin | 5 | The Assassin's back cloak follows the runner's cape relative to the torso. Mean collar-to-hem direction error fell from 87.3° to 7.8° in Walk and from 50.6° to 7.1° in Attack. |
| 39 | Mountain Giant → Infernal | 8 | The Infernal's fists follow the Mountain Giant's sweep. Both visible shoulder-to-hand directions matched the donor to the nearest 0.1° across Walk, Attack and their Upgrade variants. |

The packaged viewer comparison covers 911 synchronized poses at 60 Hz from four angles, with live mouse rotation checked in both panes. Three frames with the greatest triangle-edge extension in different clips were also inspected from eight angles for each model. Red Sizzer’s Spell received a further 66 synchronized poses from four angles. The numerical surface sweep covers 66,638 samples in 142 clips, including authored key times. All 40 output models retain the recipient triangle indices and the donor animation intervals.

All 293 transplant, animation-transfer and window tests passed. The 32 retarget fingerprints matched the stored baseline, including the pre-existing missing Spell sequence. The packaged transplant story passed 6 checkpoints and exercised 22 controls. The 61-pair panel has 59 good and two bad, with all prior verdicts retained. The humanoid sweep produced 993 good, 3 mixed, 4 bad. 0 verdicts changed against the recorded round-one gate. The final two narrow tail changes were checked against all eligible rigs in those sets, with unaffected results reused. The older 40-pair ruler returned 36 good, one mixed and three bad. These verdicts are automated. The revised models have no new owner grades. Verification used packaged MDLxL. Warcraft III playback remains untested.

Of the 28 cases without a written issue, 26 reproduced byte for byte, including the Faerie Dragon and Obscure Dragon after exempting winged donors from the tail-floor correction. The two others are recorded individually with their before/after measurements in the verification file.

[Open the 12 repairs](<D:/Codex/xfer-grade-repairs/Review repairs.cmd>) · [Revenant attack frames](<D:/Codex/xfer-grade-repairs/Revenant comparison.jpg>) · [All 40 grades and measurements](<D:/Codex/xfer-grade-repairs/verification.json>)

## Shared engine round, 22 November

The hold-out draw is sealed in `xfer-engine-holdout.json` at commit `3e21737c`. The draw used existing unit metadata. The 15 pairs stay unopened until freeze. Evaluate the original and frozen engines together in one hold-out run, record both predictions before owner grading, and retain all 15 outcomes.

**Class 1 proposed rule.** When a transform track has an authored key between two solver samples and either bounding sample is corrected, the intervening key must follow the corrected motion through that interval while preserving the untouched motion outside the solve.

The first probe counts off-grid authored keys next to a corrected solver sample. The broader probe counts any uncorrected authored key strictly inside a rewritten window. Proposed shared rule: a rewritten window interpolates through the supplied corrected poses and its boundary poses, dropping stale interior authored keys that would reintroduce the pre-fit transform.

Before implementation, the narrower rule fired on 0/1,000 humanoid, 0/61 panel, 0/40 original, 0/20 graded, 1/40 recent and 1/12 repairs. It was rejected as a singleton. The shared window rule fired on 228/1,000 humanoid, 9/61 panel, 11/40 original, 5/20 graded, 4/40 recent and 2/12 repairs. Counts are pairs with at least one active window containing an uncorrected, strictly interior authored key, measured at the common writer in the unchanged engine. The repairs overlap the recent forty. All 1,150 distinct source pairs completed. The starting Red Sizzer export matches the graded MDX byte for byte. Its 114 short-gap reversals include 63 in Walk. Peak Walk travel at 2 ms is 0.38661 body heights.

### Class 1 result — stopped under rule D

Candidate `b4825896` changed only the common track writer. It found rewrite boundaries from solver times, omitted uncorrected authored keys strictly inside them, and preserved the boundary value and outer tangent where the boundary was unturned. The two independent checks use visible skinned vertices every 2 ms and short-gap rotation reversals of at least 10° within 50 ms. Claude’s original tools independently reproduced the observations on the saved MDX files.

| Development check | Displayed donor | Reviewed engine | Class 1 candidate |
| --- | ---: | ---: | ---: |
| Sand Scorpion → Red Sizzer, Stand surface spikes | 0 | 3 | 0 |
| Red Sizzer, short-gap reversals across clips | 0 | 114 | 13 |
| Red Sizzer, Walk short-gap reversals | 0 | 63 | 2 |
| Red Sizzer, greatest vertex travel per 2 ms in Walk, fraction of height | 0.00739 | 0.38661 | 0.03086 |
| Greenskin Orc3 → Tuskarr Ranged, Stand - 3, skin acceleration at 1,300 ms | 0.000070 | 0.000055 | 0.011965 |
| Tuskarr Ranged, Attack - 2, skin acceleration at 200 ms | 0.000640 | 0.000905 | 0.010721 |

Acceleration is the length of the second difference of visible vertex positions divided by Stand height. Both Tuskarr events newly cross the review threshold on geoset 2, vertex 1. The 1,300 ms Stand event is absent on both the donor and the reproduced baseline. On Red Sizzer the candidate cleared the Stand flicker, but Walk still exceeds twice donor travel. These are development results. The hold-out has 0/15 evaluated and there is no evidence of a gain on unseen pairs.

The candidate was reverted locally at `4da3f9e4`. The entire production source tree matches review HEAD `8c5f3c67`. Regenerating both the triggering Tuskarr pair and the target Red Sizzer after the revert reproduced the baseline bytes. Revenant 32 and Naga Whaler 11 were byte-identical to their graded exports even with the candidate enabled. No existing engine patches were removed. The offline ruler retains the 2 ms skin and short-gap checks. The other geometry checks and the full post-change validation sweeps did not run to completion. Class 2 (rest-relative rotations), 3 (skin-based roles), 4 (secondary travel), 5 (held carriers) and 6 (clearance order) were not started. The retarget, unit and packaged click gates were not run this round. The sealed draw remains available for the eventual frozen candidate.

[Independent scan output and frame comparisons](<D:/Codex/xfer-engine-rule1-review>) · [Exact Tuskarr event measurements](<D:/Codex/xfer-engine-rule1-review/Tuskarr-surface-events.json>). The frame strips show donor, reviewed result and rejected result from top to bottom. The Red Sizzer strip covers Walk 220–234 ms and the Tuskarr strip covers Stand - 3 at 1,296–1,304 ms, both at 2 ms spacing.

### Resumed after the owner's 13 comparison grades

The three changed exports received 9 (Red Sizzer), 9 (Tuskarr Ranged) and 10 (Skeletal Assassin). On the unchanged repairs the owner scored Assassin 6 for cloak scaling and Infernal 4 for arm penetration. Both remain open. The previous candidate remains rejected by the 2 ms gate.

**Revised class 1 rule, recorded before coding.** In each active transform rewrite window containing an authored key without a solver turn, keep that key and its original motion, composing its native value with the correction interpolated between adjacent solver samples and retaining the native curve where the solver applies no change.

The eligibility predicate is the same strictly-interior uncorrected authored key counted in the reviewed engine at the previous step. The saved counts are 228/1,000 humanoid, 9/61 panel, 11/40 original, 5/20 graded, 4/40 recent, and 2/12 repairs. These measure structural eligibility. Changed exports and donor-relative regressions are measured separately.

Second implementation `d04ce2b0` interpolated the solver's local quaternion or translation correction over authored keys and kept original interpolation through spans without a turn. It used the same shared writer for all callers. The independent 2 ms skin scan found that Tuskarr Stand - 3 returned to the reviewed acceleration of 0.000055 at 1,300 ms, down from 0.011965 in the first trial. Red Sizzer Stand fell from 3 spikes to 0. Red Sizzer Walk peak travel was 0.017874 body heights per 2 ms, against 0.007392 for the donor, 0.38661 for the reviewed engine and 0.030859 for the first trial. Walk still has 2 short-gap rotation reversals against the target of 0.

Rule D triggered again in Red Sizzer Attack -2. At 458 ms the reviewed and second-trial maximum skin acceleration occurs at the same geoset 0 vertex 13. It rose from 0.017821 to 0.026400 body heights per 2 ms step squared, an increase of 48%. Donor acceleration at that instant is 0.014486 and is falling. The complete clip's worst acceleration improved, from 0.333 to 0.237, but this local spike worsened. The measurements came from Claude's popscan, with its intermediate acceleration array printed around the event. The first-trial and second-trial numbers above come from exports of their respective commits.

The second candidate was reverted at `a200dd72`. Revenant and Naga Whaler exports still matched their reviewed bytes in this candidate. Neither class 2 nor class 4 was reached, and Infernal arm penetration and Assassin cloak scaling remain open. No fixture-specific patch was added or removed. The full geometry, 1,000/61 verdict, retarget and engine test gates were not completed. The 15 hold-out pairs stayed sealed. The diagnostic sheet compares three development pairs and uses its own answers file. [Open comparison](<D:/Codex/Compare XFER second trial.cmd>) · [Independent measurement](<D:/Codex/xfer-rule1-second-comparison/independent-event.log>)

### Fresh 50-pair comparison and independent hand check

The owner requested 50 previously unseen pairs. The grading sheet uses 100 distinct units, each in only one role. Selection excluded the previous sheets and the sealed 15 using identity metadata. Raw and normalized vertex overlap screened for renamed or retextured meshes. Of the 50 pairs, 48 have two recognized arms and two legs on both models. Recipients retain their original face indices, and the exported donor and result have identical sequence names and intervals. The active transplant source matches 8c5f3c67.

**Capacity.** On the initial 50, the old ruler returned 48 good, one mixed and one bad. Independent subframe checks flagged 35. On 27 the largest animated edge exceeded its recipient-native maximum by over 18% of model height. After 901 internal attempts including early rejections, 50 were selected. Across 605 donor sequences and 1,030,527 paired 2 ms poses, the selected results have zero unmatched skin spikes or short-gap reversals. Visual comparisons covered side Walk frames, front and oblique action poses and multi-angle peak-stretch poses. Mesh edge checks used existing 60 Hz plus authored-key samples. Full cut-by-cut 2 ms checks for the other engine classes remain pending. This selected sample does not measure generalization.

**Class 1, development only.** A read-only stage audit on Red Sizzer found zero short-gap reversals in Walk on the mapped skeleton and after settleFeet. The general grounding stage introduced two. The dedicated per-leg contact stage raised the count to 63. Attack -2 went from zero to 22 at the latter stage. The donor had zero on all three measured clips. No new candidate was applied.

**Independent arm check.** The shared offline sweep ruler now compares the recipient's nearest visible hand-skin landmark in chest space with its own Stand while the donor's hands remain open. It uses serialized skinned hand positions at 2 ms. The Infernal self-control had 0 flags on 834 comparable open-hand Stand samples. On the 4/10 Infernal transplant, all 657 donor-open Walk samples were below the clearance band, reaching 24.7% of native rest at 1,034 ms. The new 50 produced available landmarks on 27, with a warning on one or more frames on 25. This lateral-distance check is independent of fitted arm directions. Mesh penetration needs the separate winding-number test.

**Verification and open work.** All 283 transplant, animation-transfer and window tests passed. The packaged test clicked through the 50 actual cases, loaded all 100 native views, rotated the result by mouse, and saved all test scores and a comment separately. All 878 authored texture references resolve. The two rejected class 1 engine trials remain reverted. The Assassin cloak and Infernal arm failures remain. No further production rules or patch removals were made. The 1,000/61 and retarget gates remain open, and the original 15 remain sealed.

[Grade the 50 pairs](<D:/Codex/Grade 50 fresh XFER pairs.cmd>) · [Capacity report](<D:/Codex/xfer-fresh-50/Capacity report.md>) · [Per-pair evidence](<D:/Codex/xfer-fresh-50/Capacity evidence.json>).
