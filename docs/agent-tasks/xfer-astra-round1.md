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
