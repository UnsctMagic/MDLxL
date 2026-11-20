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
