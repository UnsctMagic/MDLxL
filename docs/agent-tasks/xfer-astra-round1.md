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
|06 Thunder Lizard / Huntress|2|At mid-Walk the cat raises its muzzle while the lizard points its head into the ground. The selected donor head is the rider's 69. The cat's head is 48.|
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
|21 Footman / Repeater Handgunner|3|The feet run, but the shield clings to the torso while the arms take the firing pose. All 26 shield vertices bind to the root.|
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
|33 High Elf Archer / Headhunter|0|The archer crouches with the troll. Its bow stretches across the figure during the spear throw and the eight arrow vertices ride the pelvis mesh. Both rigs are bipeds.|
|34 Ent / Bandit Lord|7|The ent's arms and torso follow the rider while its feet remain planted through the horse's stride. The same 22 original foot vertices move less than 0.000002 model units in torso space. The owner still accepted this pair.|
|35 Lord of Change / Demonette|8|The long-legged run and reaching attack follow the donor. Wings stay with the body of a donor that has no wingbeat.|
|36 Kobold Geomancer / Paladin|9|The kobold crouches, steps and swings its staff with the paladin's hammer.|
|37 Demonette / Gor|9|The stride and both arm positions in the attack follow the Gor. The older ruler's arm-angle flag did not correspond to a large visible failure here.|
|38 Human Mage / Furbolg|9|The mage takes the hunched walk and the shift into the attack on its own proportions.|
|39 Archer / Tauren Chieftain|0|The drawn bow cuts across the character in Attack and a separate prop moves away from the hands. The arrow mesh rides the pelvis. A head pivot alone cannot verify the facing of the face.|
|40 Red Orc Warlock / Giant Sea Turtle|0|At each Walk Swim phase the turtle moves its feet, but the orc keeps the same crouch. Its skin never follows any of the four animated donor leg chains.|

The owner approved three labels for this round: 0–4 bad (18), 5–6 mixed (6), 7–10 good (16). Original v10 called 12 bad pairs good, four good pairs bad, five mixed pairs bad and one mixed pair good. Its agreement is 18/34 decisive and 18/40 exact. The owner's scores are for the original saved models only.
