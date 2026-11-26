# XFER transplant: Fable's review and fix plan (26 Nov 2026)

Status: plan only. No source changed, nothing committed. Waiting for the owner's "go".
Owner's order (26 Nov): "Fable 5.2 reviews and plans the code. Opus 5.5 on medium writes, builds, tests. I review results."
Checkout: `D:\Codex\xfer-toggles`, branch `codex/xfer-toggles`, revision `6cfed3a6`. Local only: never push, PR, tag or post.
Brief: [xfer-fable-review-brief.md](xfer-fable-review-brief.md). History: [xfer-toggles.md](xfer-toggles.md), [xfer-finish-line.md](xfer-finish-line.md).

## For the owner (short)

Four causes found, each checked on your own pairs by picture and by measurement.

- **Seam fix** tears the skin at every seam it touches. It came back because the last suggester step ticks anything a number likes. It goes out of suggestions for good, by a list no number can override.
- **Elf Death Knight (crossed fists, sword not belted):** the engine read his sword as his hand. One rule fixes both.
- **Snap Dragon:** the front legs copied the back legs. A two-line rule makes them the Cold One's arms. Tried here: it works.
- **Seat weapon** replaces a good grip with the donor's (sabre turned flat, hand slid up the lance). It will only be suggested where the weapon is not already held properly.

What is left for you: one sheet of reasonable pairs only (58 pairs in the set, no horse-to-foot, no rabbit, no Arbalester),
after Fable has looked at every picture first.

## What was looked at

- All 27 grades and comments in `TestBuilds\transfer-xl-35\final\answers.json` against `cases-final.json`.
- The engine: `src/skeleton-transplant.js`, `src/transplant-weapon-seat.js`, `src/transplant-skin.js`, `src/transplant-gait.js`,
  `src/anim-transfer.js` (rig reading), `src/xfer-suggest-toggles.js`, `src/transplant-autofix.js`, `src/xfer-scorecard.js`.
- Pictures (donor / own / result) of the low pairs, with and without the disputed checkbox, made with
  `scripts/xfer-scorecard/render.mjs`: `out/fable-review/*.png`. Helper scripts used for the numbers below are in
  `out/fable-review/*.mjs` (not part of the product; `out/` is ignored by Git).
- Two fixes were tried on a private copy of `src` (deleted afterwards) to see whether they work before planning them:
  the hand rule (step 4) and front legs as arms (step 5). Pictures: `r08-probe.png`, `r45-probe.png`.

## Causes

### C1. Seam fix makes holes (suggested on 8 of the 27 final pairs) and was suggested against the owner's verdict

- **Why it tears.** `repairSeamGeoset` in `src/transplant-skin.js` (lines 167-272), called from `repairDonorSeams`
  (275-282) at `src/skeleton-transplant.js` 2893-2914. For every mesh edge whose two ends hang on a pair of donor joints the
  donor's own mesh never joins, it rebinds skin: either the two ends to a donor blend (`chooseBlend`, 189-207), or, when no
  blend exists, the **whole connected piece** natively on one bone to the single nearest donor joint (`rigidPiece` 176-187,
  `nearestJoint` 209-222, loop 224-243). Neighbours are found by face indices only (`meshNeighbours`, 127-138), so the twin
  vertex on the other side of a UV seam or hard edge (same spot, other index) is not a neighbour and is not rebound with it.
  One side of a welded seam then follows another bone: a crack. Whole pieces moved to "the nearest joint" open the chest.
- **Measured** with a hole check written for this review (`out/fable-review/tears.mjs`: stored points on the same spot that
  the model's own animations never pull apart must stay together). Without Seam fix: 0 torn pairs on every pair below.
  With it:

  | Pair | Torn welded pairs | Largest opening (share of the model's height) |
  |---|---:|---:|
  | random-03 (ogre chest) | 89 of 350 | 62% |
  | new-26 | 64 of 127 | 60% |
  | reasonable-46 | 40 of 125 | 49% |
  | random-11 | 8 of 133 | 49% |
  | reasonable-38 | 136 of 807 (47 without) | 41% (2.4% without) |
  | new-11 | 33 of 265 | 35% |
  | reasonable-45 | 49 of 228 | 35% |
  | reasonable-40 | 60 of 687 | 9% |

  The eight pairs graded 9-10 and the four graded 7-8 all read 0 torn pairs at their graded ticks.
- **Why it was suggested.** `suggestToggles` in `src/xfer-suggest-toggles.js`: the first stage keeps Seam fix out (line 79,
  with the owner's words in the comment), but the six-rule step added on 25 Nov (lines 133-162) loops over every **shown**
  checkbox (`for (const key of visible)`, 145-150) and flips any that passes one more scorecard rule. The scorecard
  (`src/xfer-scorecard.js`) has no hole measure, so Seam fix "passed" a stretch rule and was ticked. The owner's verdict lived
  only in a comment inside an earlier `if`; nothing stopped a later stage.
- **Can Seam fix itself be repaired?** Not honestly in this plan. It has never improved a pair the owner graded. It stays an
  untouched checkbox (toggles, not gates) and is never suggested. Question for the owner at the end.

### C2. Elf Death Knight (reasonable-08): fists crossed, Stand 2 keeps the sword the donor belts

One cause for both. The rig reader ends his right arm on his **sword bone**:

- `transferRig` in `src/anim-transfer.js`, limb building at lines 502-512, takes the POSE chain to its end joint. On
  `Elf_DeathKnight.mdx` the chain is `RA1 > RA2 > RA3 > RH > Weapon`: the hand is `RH` (it carries `Hand Right Ref`), and
  `Weapon` (it carries `Weapon Ref`, 244 skinned vertices: the sword) is read as the last arm joint, the "hand".
- Pairing then shifts by one (printed with `out/fable-review/pairing.mjs`): own `RH` follows the donor's forearm `RA2`, own
  `Weapon` follows the donor's hand `RH`. The left arm pairs correctly (`LH` to `LH`). So the right fist sits where the
  donor's forearm is (fists cross, no two-hand grip), and the sword follows the donor's **hand** instead of the donor's
  **sword bone**, so when the donor belts its sword in Stand 2 the result keeps swinging it. Only 4 vertices ride the donor's
  weapon bone (`report.weapon.vertices: 4`).
- The engine already has the same repair for the **donor** side only: `src/skeleton-transplant.js` 1084-1093 trims a donor
  arm whose end joint carries the Weapon attachment while the wrist carries the Hand attachment. The recipient side was missed.
- Tried on the private copy: with the arm ended at `RH`, pairing is `RH -> RH`, 248 vertices ride the donor's sword bone,
  and in Stand 2 the sword goes to the hip with the donor's (`r08-probe.png` against `r08.png`).
- Of the 110 sheet pairs only this model has the pattern (`out/fable-review/scan-attach.mjs`), so nothing else changes.
- **Still open after that fix:** in Attack the donor holds with both hands; the result's left palm stays 0.2-0.35 arm lengths
  off the sword. The existing second-hand step (`holdSupport`, `src/transplant-weapon-seat.js` 703-783) only runs when the
  donor is two-handed in its **Stand** reading (`wanted.support`, line 704) and only with Seat ticked, which would glue the
  sword back to the hand in Stand 2. Step 7.

### C3. Snap Dragon (reasonable-45): front legs did not become the beast's arms

- `transplantGait` in `src/transplant-gait.js` (lines 29-49). The Snap Dragon stands on two leg pairs, the Cold One on one.
  For the extra (front) leg the loop at 36-42 picks the donor's leg again and marks it `copy: true`: the front legs get a
  **copy of the back legs' walk**. The donor's two arms are never used, because the Snap Dragon has no arm part
  (`transferWholeBody`, `src/anim-transfer.js` 799-805, keeps only parts both have).
- The reverse case is already there (lines 44-47: a biped's arms take a quadruped donor's spare forelegs). The forward case
  is missing.
- Tried on the private copy (three lines): front legs take `armL` / `armR`; the engine's pairing accepts it
  (`from` in `buildTransfer`, `src/anim-transfer.js` line 1080), no error, 0 torn pairs, and the Snap Dragon stands like the
  Cold One with its front legs held as arms in Stand, Walk and Attack (`r45-probe.png` against `r45-noseam.png`).
- Pairs it touches among the 110: reasonable-45, and four pairs that leave the test set anyway (new-06 rabbit, new-11,
  new-15, new-25). None of the 9-10 pairs.

### C4. Seat weapon like donor took the weapon out of a good grip (reasonable-32, reasonable-38)

What Seat does (`seatWeapon`, `src/transplant-weapon-seat.js` 528-638): it rebinds the model's weapon to the hand bone and
places it by the **donor's** reading: the weapon's principal axes onto the donor weapon's axes in the donor's hand (`turn`,
560-561; axes from `shape` 36-69 and `oriented` 194-205), the grip at the **donor's** place along the shaft
(`gripFit` line 428, `wanted.fraction`), and the grip surface exactly on the centre of the palm patch (`destination`, 546).

Measured (`gapsum.mjs`, `plane.mjs`; gap in arm lengths, place 0 = butt, 1 = head):

| Pair | Grade | Own animations: gap / place | Plain result: gap / place | Seated: place | What Seat changed |
|---|---|---|---|---|---|
| reasonable-32 | 5, "REMOVED the weapon" | 0.12 / 0.16 | 0.12 / 0.17 (as own) | 0.17 | blade plane turned about 80 deg from the model's own grip: the sabre lies flat, hilt pushed 0.12 arm into the hand |
| reasonable-38 | 5, "makes things worse" | 0.04 / 0.11 | 0.03 / 0.12 (as own) | 0.30 | hand slid from the handle up the shaft: the shaft goes down through the mount |
| random-04 | 7, owner unticked Seat | 0.55 / 0.03 | 0.57 / 0.03 (as own) | 0.24 | same slide (the item read is 6 vertices: probably not the real weapon) |
| new-08 | 10 with Seat | 0.03 / 0.62 | 0.03 / 0.62 (as own) | 0.20 | hand moved toward the butt of a staff; it swings like the donor's axe |
| random-10 | 10 with Seat | 0.02 / 0.12 | 0.05 / **0.54** (not as own) | 0.38 | plain held the hammer mid-haft; Seat repaired it |
| random-21 | 9 with Seat | 0.04 / 0.37 | **0.44** / 0.44 (not in hand) | 0.57 | plain left the gun out of the hand; Seat repaired it |
| random-17 | 8 with Seat | 0.41 / 0.13 | 0.48 / **0.38** (not as own) | 0.03 | Seat repaired it |
| random-24 | 8 with Seat | 0.00 / 0.18 | 0.00 / 0.18 (as own) | 0.07 | second hand put on the shaft (0.94 to 0.08 arm) |

Reading: where the plain result already held the weapon the way the model's own animations do, Seat had nothing to repair
and exchanged a correct grip for the donor's; that is where the owner said "the before is a better transfer". Where the plain
result was broken, Seat got 8-10.

Why it was suggested anyway: the suggester trusts the seat's **own** before/after number
(`src/xfer-suggest-toggles.js` 87-91 and 125-132, numbers from `gripFit` 465-472). That number is how well Seat reached its
own target in the hand's frame; it cannot see a blade turned flat or a shaft through a mount. On reasonable-38 it reports
0.54 to 0.02 while the weapon was already in the hand.

The scorecard's weapon rule cannot tell these apart either (it scores reasonable-32 better **with** Seat). That is the limit
the brief names; the plan does not try to out-measure the owner here, it only stops Seat where there was nothing to repair
and it changes the grip.

### C5. The numbers were taken on the wrong pairs and from disposable folders

- 8 of the 27 final pairs are pairings the owner calls unreasonable; about 45 of the 110 scorecard pairs are cross-kind
  (table in `out/fable-review/scan-arms.txt`). "25 of 110 pass" was never a meaningful figure.
- 88 of the 122 model files behind the reasonable pairs live under `TestBuilds\transfer-xl-35\...\fixtures`, a test build
  folder, not in `D:\Claude\MDLxL-TestModels` (AGENTS.md: tests read models from the permanent collection only).

### C6. Smaller things found on the way

- The suggester's last step can flip **any** shown checkbox with no picture looked at. It is the door Seam fix came back
  through; after step 1 it stays, but behind the owner list and the hole check.
- `render.mjs` defaults to the weapons-13 sheet; every command below passes `--manifest`.

## Hard rules for every step

1. **Seam fix is never suggested.** The checkbox stays; no code path ticks it.
2. **The owner's verdict outranks numbers, structurally.** A checkbox on the owner-rejected list cannot be suggested by any
   stage of `suggestToggles`, present or future (step 1 makes this one filter at the function's single exit, with a test).
   Measurements may **withhold** a suggestion. No measurement may add a rejected checkbox back.
3. **Toggles, not gates.** No repair is deleted or disabled. A change that could alter a pair the owner accepted goes behind
   a checkbox or behind a suggestion rule, not into the default engine path, unless the regression check shows those pairs
   byte-identical.
4. **The eight pairs graded 9-10 stay the same or better:** reasonable-05, reasonable-29, new-08, random-10, new-01,
   random-21, new-05, new-02, at the ticks the owner graded (table in "Test set"). "Same" = the exported file is
   byte-identical. Any difference stops the step until Fable has compared pictures of every donated animation.
5. **Pictures before numbers.** Every step ends with `render.mjs` pictures that Fable reads; a step is not done on numbers
   alone. Limits are never recalibrated to make a run pass.
6. **Reasonable pairs only** (the set below). No horse to foot unit, naga to knight, anything to rabbit, drummer to orc
   ranger, Ottoman cavalry to rifleman; never the Arbalester or Crossbowman pair.
7. **Testing tier** (AGENTS.md, "How much to test"): this is a feature being built, so each step gets a focused test that
   fails on today's code first, and `pnpm run test:source` runs once before hand-back (step 8). **Do not run the full
   packaged suite** (`test:packaged`). After a fix, rerun only the failed and related tests.
8. Everything on D: (set `TEMP` and `TMP` to a D: folder before packaging). Commit locally per step; never push.
   `D:\Claude\MDLxL-TestModels` is add-only.

## Steps

Each step is one Opus session: change, focused test, measurements, pictures, local commit, short report in
[xfer-toggles.md](xfer-toggles.md) ("### Fable plan step N"). Fable reviews the diff and the pictures before the next step.
Pictures go to `out/fable-plan/step-N/`.

Shared commands (Git Bash, from `D:\Codex\xfer-toggles`; `M` is the pair list from step 2):

    M=scripts/xfer-scorecard/pairs-reasonable.json
    node scripts/xfer-scorecard/render.mjs <id> out/fable-plan/step-N/<id>.png --manifest $M --seq "Stand,Walk,Attack" --n 4 --size 300 --toggles <ticks>
    #   --toggles ""   no checkbox      --yaw -55   the right-hand side      --size 600 --n 2   close look
    node scripts/xfer-scorecard/regress.mjs --check          # step 2: the eight 9-10 pairs, byte for byte
    node scripts/xfer-scorecard/regress.mjs --check --all    # every pair of the set: which exports and which ticks changed

### Step 1. Seam fix never suggested; an owner-rejected list the suggester cannot override

- **Files.** `src/transplant-autofix.js`, `src/xfer-suggest-toggles.js`, new `test/xfer-suggest-toggles.test.js`.
- **Change.**
  1. In `transplant-autofix.js` export `OWNER_REJECTED_KEYS = Object.freeze(['seamFix'])`, with the owner's words and date in
     the comment (26 Nov 2026: "SEAM FIX IS CAUSING HOLES IN EVERY MODEL IT TOUCHES"). Keys are added to this list only on
     the owner's word.
  2. In `suggestToggles`: build `const blocked = new Set(OWNER_REJECTED_KEYS)` at the top. The first stage skips blocked
     keys as candidates (replace `'seamFix'` in the list at line 79 by the set; `skinLandmarks` and `gripRouting` stay as
     they are). The six-rule loop (line 145) skips blocked keys. Every `return` goes through one helper,
     `allowed(keys) = keys.filter(key => !blocked.has(key))`, applied to `suggested` last, so a later stage cannot add one
     back. `visible` is unchanged: the checkbox is still shown and the user can tick it.
  3. Steps 3 and 6 add per-pair keys to the same `blocked` set (withheld by a hole or grip check). One mechanism.
- **Must not change.** The engine; any export; the suggestions of pairs where Seam fix was not suggested.
- **Test (fails first).** `suggestToggles` on Red Dragon -> Wind Rider riderless (both stock models in
  `MDLxL-TestModels\reasonable-50`; today it returns `['seamFix']`): `suggested` has no `seamFix`, `visible` still has it.
  A second, model-free test: a stub that tries to add a rejected key after the exit filter is not possible (assert the
  filter is the last thing applied: `suggested.every(key => !OWNER_REJECTED_KEYS.includes(key))` for three pairs).
  Command: `node --test test/xfer-suggest-toggles.test.js`.
- **Measure.** `node scripts/xfer-scorecard/live-suggest.mjs out/fable-plan/step-1/live.jsonl` on the eight pairs of the
  final sheet that had Seam fix suggested (reasonable-45, new-11, reasonable-38, reasonable-46, random-03, random-11,
  reasonable-40, new-26; `--only` is not in that script: add the same `--only` option `score.mjs` has). Expected: Seam fix
  gone, every other tick as on the final sheet.
- **By eye.** None needed: no export changes. Reference pictures: `out/fable-review/x03-seam.png` / `x03-noseam.png`.

### Step 2. The reasonable test set, in the permanent collection, with a byte-for-byte regression check

- **Files.** New folder `D:\Claude\MDLxL-TestModels\xfer-reasonable\` (add only); `D:\Claude\MDLxL-TestModels\README.txt`
  (one added line); new `scripts/xfer-scorecard/pairs-reasonable.json`, `scripts/xfer-scorecard/regress.mjs`,
  `scripts/xfer-scorecard/regression-baseline.json`; `score.mjs` and `live-suggest.mjs` (read the pair list);
  `scripts/xfer-scorecard/README.md`; `test/helpers/fixtures.cjs` (entries for the models steps 4 and 5 test with).
- **Change.**
  1. Copy every model of the 58 pairs below that sits under `TestBuilds\transfer-xl-35` (with its textures folder) into
     `MDLxL-TestModels\xfer-reasonable\<same folder name>\`. Copy, never move; nothing existing in the collection changes.
  2. `pairs-reasonable.json`: `{ cases: [...] }` in the sheets' own row shape (so `render.mjs --manifest` reads it), paths
     pointing into the collection, plus per pair `regression: true` and `ticks: [...]` for the eight 9-10 pairs.
  3. `score.mjs` and `live-suggest.mjs` take `--pairs <file>` and default to `pairs-reasonable.json`. The four old sheets
     are no longer read by default.
  4. `regress.mjs`: builds each regression pair at its graded ticks, writes the SHA-256 of `generateCompatibleMdx(result)`.
     `--write` saves `regression-baseline.json`; `--check` prints every pair whose bytes differ; `--all` does the same for
     all 58 pairs at the suggester's ticks and also lists pairs whose **ticks** changed.
  5. Run `regress.mjs --write --all` on this revision **before any engine change**: that file is the reference for the
     rest of the plan.
- **Must not change.** No source under `src/`. Nothing in `MDLxL-TestModels` except the new folder and the README line.
- **Check.** `regress.mjs --check --all` right after writing: 0 differences. `render.mjs reasonable-05 ... --manifest $M`
  draws from the new paths. No source test needed (no product code).

### Step 3. A hole check in the scorecard (it can only veto)

- **Files.** `src/xfer-scorecard.js` (`scoreResult`, `judgeResult`, `SCORE_RULES`), `src/xfer-suggest-toggles.js`,
  `scripts/xfer-scorecard/page.mjs` (one more column), `test/xfer-suggest-toggles.test.js`.
- **Change.** Port `out/fable-review/tears.mjs` into `scoreResult` as `result.rules.holes`:
  - Pairs: stored vertices of the model used by a face that sit on the same spot (grid 0.1% of the model's height), within
    and across geosets; consecutive members of each cluster.
  - Allowance per pair: its largest distance over the model's **own** animations (9 moments each, Decay and Dissipate left
    out, both geosets shown).
  - Result: the same over every donated animation. `torn` = pairs opening more than 1.5% of the model's height beyond their
    allowance; `worst` = the largest such opening.
  - `pass` = `torn / pairs <= 0.01` and `worst <= 0.03`. These two limits are fixed here from the geometry (a crack you
    can see), not from grades. Do not tune them.
  - Add `'holes'` to `SCORE_RULES` so the suggester's `gained` / `lost` count it: a flip that opens holes loses a rule and
    is never "helpful". After the six-rule step, if the suggested set fails `holes` while the plain result passes, drop the
    key whose removal restores the pass and add it to `blocked` for this pair.
- **Must not change.** Any export. The limits of the other five rules.
- **Test (fails first).** `scoreResult` on Knight of Slaanesh Axe -> Ogre built with `seamFix`: `rules.holes.pass === false`
  (today the rule does not exist); built without: `true`.
- **Measure.** `score.mjs` over the 58 pairs at their ticks: expected `holes` passes on all (reasonable-38 reads 47 of 807
  pairs at 2.4% without Seam fix: it must still pass by the `worst` limit and the 5.8% share must be looked at; if it
  fails, report it, do not change the limit). The eight 9-10 pairs: 0 torn. Time per pair before and after (report it).
- **By eye.** Fable compares the three worst `holes` readings of the run with their pictures to confirm the number shows
  real cracks.

### Step 4. An arm ends at its hand, not at the weapon bone (reasonable-08)

- **File.** `src/anim-transfer.js`, `transferRig`, the limb loop at lines 502-512. New case in
  `test/skeleton-transplant.test.js` (or `anim-transfer.test.js`).
- **Change.** After `limb` is built and before `limbs.push`, for arm chains (not legs, not wings) of three or more joints:
  when the last joint carries an attachment whose name starts with `Weapon`, the joint before it carries one whose name
  starts with `Hand`, and the last joint carries no `Hand` attachment, drop the last joint from `limb`, set `tip` to null
  and leave it out of `line`. The dropped bone is then an ordinary bone below the hand, which the existing code reads as the
  held weapon (`named`, `weaponShape`, lines 560-562) and lets ride the donor's weapon bone. Comment the rule with the case
  (Elf Death Knight, owner 26 Nov). Leave the donor-side trim at `skeleton-transplant.js` 1084-1093 as it is.
- **Not in this step.** The POSE recogniser (`src/pose-ik.js`) is not touched: it serves the POSE editor too. Whether POSE
  itself should stop at the hand is a separate question for later.
- **Must not change.** `regress.mjs --check --all`: only reasonable-08 may differ. The scan for this review found the
  pattern on that one model among 110 pairs; if any other pair changes, stop and report which.
- **Test (fails first).** Elf Death Knight (copied in step 2): `transferRig(...).parts.armR.marker` is the node named `RH`;
  transplant from Footman Leader: `report.weapon.vertices >= 200` (today 4).
- **Measure.** `node out/fable-review/weapon.mjs $M reasonable-08 trackWindow,keepTorso`: in Stand - 2 the right palm's gap
  to the sword rises mid-clip as the donor's does (probe: 0.40-0.48 arm; donor 0.14-0.18), and returns to under 0.02 at the
  ends. Hole check: 0.
- **By eye.** `render.mjs reasonable-08 ... --seq "Stand - 1,Stand - 2,Stand Ready,Attack - 1,Attack - 2,Walk,Spell,Death" --n 4`
  and a close look `--size 600 --n 2 --seq "Stand - 2"`. Compare with `out/fable-review/r08.png`: the right fist on the
  hilt in Stand and Walk; the sword at the hip in Stand - 2, not raised over the shoulder. Known and expected: the left
  hand is still off the sword in Attack (step 7).

### Step 5. Spare front legs take the donor's free arms (reasonable-45)

- **File.** `src/transplant-gait.js`, `transplantGait` (lines 29-49). `test/transplant-gait.test.js`.
- **Change.** After the per-leg loop of a side, mirroring the existing rule at 44-47: when `choice === 'back-and-arms'`,
  this model has more legs on that side than the donor (`mine.length > theirs.length`), this model has **no** arm on that
  side and the donor **has** one (`donorRig.parts['arm' + side]`), the front-most own leg (`mine.at(-1)`) is assigned
  `{ from: 'arm' + side }` instead of the leg copy. Apply only when both sides qualify, so the body stays symmetric.
  Comment with the owner's words ("why did the front legs not become the arms of the beast?... this is possible").
- **Check the rest of the engine reads it right** (it did in the trial, but read these before trusting it): `fourSupports`
  (`skeleton-transplant.js` 1233) stays false; the ground code reads the **donor's** rig (`mappedRig`, 3090), where these
  limbs are arms, so no foot is planted for them; `walkingLegs` (3122) and `matchingFourLinkLegs` (3123) must not treat
  them as walking legs: if `walkingLegs` is used where a leg-to-arm entry would be wrong, filter on
  `e.theirs.limbKind === 'leg'`.
- **Must not change.** `regress.mjs --check --all`: only reasonable-45 may differ (the other pairs the rule touches left
  the test set). Existing gait tests that assert the leg copy for this body pairing are updated with the owner's sentence
  as the reason; tests for other pairings must pass unchanged.
- **Test (fails first).** `transplantGait` for Snap Dragon (stock, `reasonable-50\naga__snapdragon-...`) taking a stock
  biped with arms (`transfer-footman`): `legL2 <- armL`, `legR2 <- armR`, back legs unchanged.
- **Measure.** Hole check 0. `score.mjs --only reasonable-45`: report shape, motion and jitter before and after.
- **By eye.** `render.mjs reasonable-45 ... --toggles skinLandmarks,authoredMotion` for **every** donated animation (the
  review saw only Stand, Walk, Attack): `--seq "Stand,Walk,Attack - 1,Attack - 2,Spell,Death,Stand Ready,Stand Victory"` and
  whatever else the Cold One has. Compare with `out/fable-review/r45-noseam.png` (now) and `r45-probe.png` (trial). The
  front legs must read as the Cold One's arms in each, never drag on the ground, never fold through the chest.
- **Limit, said plainly.** With a rider on the mount (reasonable-38) the rule does not fire, because the model has arms
  (the rider's). Giving the mount's front legs the donor mount's arms needs the arms told apart by who carries them; not in
  this plan.

### Step 6. Seat weapon is suggested only where there is something to repair

- **Files.** `src/xfer-suggest-toggles.js`; a small exported reader in `src/transplant-weapon-seat.js`;
  `test/xfer-suggest-toggles.test.js`.
- **Engine.** `seatWeapon` itself is **not changed**: with Seat ticked every export stays byte-identical (the 9-10 pairs
  random-21, new-08, random-10 were graded with it).
- **Change.** A reader `gripReading(own, weapon, mesh)` (port of `out/fable-review/gapsum.mjs`): over the Stand, Walk and
  Attack animations of `mesh` (7 moments each, weapon shown), the nearest palm's gap to the weapon surface in arm lengths
  (median, largest) and its place along the shaft (median, 0 butt to 1 head), using `readWeapon(own)`'s item and palm
  patches (their vertex numbers are valid on the result). And `weaponTurn(plain, seated)`: the rigid fit (`similarity`,
  `src/transplant-native-cloth.js`) of the weapon's vertices from the plain result to the seated result at the first Stand
  moment, split into the turn of the shaft and the roll about the shaft; plus `flat` = the weapon's cross-section spread,
  widest over thinnest (as `out/fable-review/roll.mjs`).
  In `suggestToggles`, after the existing Seat conditions (lines 87-91, 125-132, kept), Seat is **withheld** (added to
  `blocked` for this pair, so the six-rule step cannot tick it either) when all of these hold:
  1. *Nothing is broken:* the plain result holds the weapon as the model's own animations do (largest gap no more than the
     own largest gap + 0.05, and place within 0.08 of the own place) **and** already points it roughly like the donor's:
     the median angle between the result's shaft and the donor's shaft, in world space over the same moments, is under
     35 deg (the result stands on the donor's skeleton, so both face the same way; mirror the donor when the build did).
     Reference: `out/fable-review/plane.mjs`.
  2. *Seat changes the grip:* either the hand slides off an end handle (own place under 0.25 and seated place at least 0.10
     further toward the head), or a flat weapon (`flat >= 2`) is rolled 45 deg or more about its shaft.
  3. *No second hand gained:* the seat's report has no `support` (the second-hand step did not act).
- **What this must give** (from the table in C4; put these in the step report as a table of before and after ticks):
  withheld on reasonable-32 (plain shaft 17 deg off the donor's; roll) and reasonable-38 (31 deg; slide); kept on
  reasonable-40 (plain shaft 87 deg off: something to repair), new-08, random-10, random-21, random-17, random-24. Any other pair of the 58 whose Seat tick changes is listed for Fable with pictures of both versions.
- **Must not change.** `regress.mjs --check`: the eight 9-10 pairs byte-identical and their ticks unchanged. No export at
  fixed ticks changes anywhere (suggestion-only step).
- **Test (fails first).** `suggestToggles` on Arkain Cavalry Sergeant -> French Dragoon Cavalry: no `seatWeapon` in
  `suggested` (today: `['seatWeapon']`), still in `visible`. On Saurus Oldblood Hero -> Kroxigor Hero: `seatWeapon` still
  suggested.
- **By eye.** For each pair whose tick changed: `render.mjs <id> ... --yaw -55 --size 600 --n 2 --seq Stand` and
  `--seq "Stand,Walk,Attack"` twice, with and without `seatWeapon`. Reference: `r32-plain-big.png` / `r32-seat-big.png`,
  `r38-plain.png` / `r38-seat.png`. Fable confirms the unticked version is the better one on each; where it is not, that
  pair is reported to the owner instead of the thresholds being moved.
- **Honest limit.** The numbers (0.25, 0.10, 45 deg, 35 deg) come from 11 pairs; reasonable-38 sits at 31 deg, close to
  the 35. They are written as what they mean (an end
  handle, a visible slide, a blade turned on its side), not fitted further. If the 58-pair run shows them splitting pairs
  wrongly, the fallback is the simpler rule "withheld whenever condition 1 holds, unless a second hand is gained", with
  new-08 shown to the owner both ways.

### Step 7. Second hand on the weapon in the animations where the donor uses two hands (only after the owner has seen steps 1-6)

- **Why separate.** It was tried in round 1 and reverted (two near-twin results got worse, on new-05 and new-02, both 9s).
  It is the remaining half of the owner's reasonable-08 comment, and of his most frequent weapon comment over all rounds.
- **Files.** `src/transplant-weapon-seat.js` (`holdSupport`, 703-783, and a new exported entry), `src/skeleton-transplant.js`
  (one call next to 3287-3290), `src/xfer-suggest-toggles.js` (lines 80-83, 99), tests.
- **Change.**
  1. Split `holdSupport` so it can run on the weapon wherever it is (seated on the hand, or riding the donor's weapon bone):
     it already works from the result's skinned weapon surface and palms. Entry `secondHandOnWeapon(result, own, donor, rigB,
     rigA, donorMap, limbEntries)` reads both weapons with `readWeapon` and calls it per item.
  2. Trigger per animation instead of per Stand reading: an animation is treated when the donor's other palm is on its
     weapon (within `ON_SHAFT`) in at least 30% of its sampled moments. Easing, the 97% reach limit and the skipped Death /
     Decay / Dissipate / Portrait stay as they are. An arm that cannot reach is left as it is (no stretching).
  3. Checkbox: reuse the existing **Two-hand grip** (`surfaceGrip`), per AGENTS.md "one way of doing things": when it is
     ticked, run step 1's entry after its present work. With Seat ticked and the donor two-handed in Stand, behaviour is as
     today. No new checkbox.
  4. Suggestion: `surfaceGrip` becomes a candidate also when the donor is two-handed in some animation by the 30% rule
     (today: both models two-handed in Stand, lines 80-83), and only when the built result shows the second hand gaining
     at least 0.1 of held moments with no rule lost and no holes. It is not suggested on a pair where the model's own
     animation of the same kind already resembles the donor's and the result moves away from it (the near-twin rule).
- **Must not change.** `regress.mjs --check`: the eight 9-10 pairs byte-identical and ticks unchanged (new-05 and new-02 are
  the two that broke in round 1: if either gets the tick, stop). `--all`: list every pair whose export or tick changed.
- **Test (fails first).** Footman Leader -> Elf Death Knight with `surfaceGrip`: in Attack - 1 the left palm's mean gap to
  the sword over the moments the donor's left palm is on its sword is under 0.1 arm (probe after step 4: 0.2-0.35).
- **By eye.** reasonable-08 every donated animation with and without the tick, close on Attack - 1 and Attack - 2; and each
  changed pair. Fable looks for the round-1 faults: arm twitch, elbow locked straight.
- **If it does not hold up:** report it as a known limit. Do not ship a second-hand step that twitches.

### Step 8. Source suite, build, hidden click, one sheet

- `pnpm run test:source` once; fix only what this work broke; rerun only failed and related files.
- `pnpm run build`, package into `TestBuilds\transfer-xl-35` as the brief describes (app closed, `profile` kept, TEMP on D:).
- Hidden click-through on the exact package (`scripts/hidden-run.ps1`, separate hidden desktop): open the Transfer window on
  a named model `TestBuilds\test-models\TEST XFER 36.mdx`, tick and untick Seam fix, Seat weapon and Two-hand grip once
  each: no crash, no page error.
- Sheet `cases-reasonable.json` from `pairs-reasonable.json`: the pairs whose export or default ticks changed since the
  final sheet, plus the eight 9-10 pairs as controls; every donated animation; the reviews show donor, own, before and
  after side by side. Fable reads the pictures of every row first and removes nothing silently: a row that looks bad is
  fixed or listed as a known limit before the owner opens the sheet.
- Add the row for this plan to `docs/agent-tasks/README.md`; keep the step reports in [xfer-toggles.md](xfer-toggles.md).

## Test set: reasonable pairs only

58 pairs. **Every donated animation of every pair is graded and measured** (Decay and Dissipate left out of the
measurements, as before), not a sample of two.

- 49 from the reasonable-50 sheet (all but the Arbalester -> Crossbowman pair): foot unit to foot unit of the same kind,
  rider to rider, flyer to flyer, four legs to four legs, and the one clear forelegs-to-arms case (reasonable-45).
- 7 foot-to-foot pairs from the other sheets: new-02, new-04, new-05, new-26, random-10, random-17, random-21.
- 2 kept **only** as regression controls because the owner graded them 10: new-01 (Nether Dragon -> Makrura) and new-08
  (Hero Berserker -> Druid of the Talon). They are not examples of reasonable pairings and no new pairs like them are added.

Left out, with the owner's reason: random-06 (naga to knight), new-06 (rabbit), new-22 (drummer to orc ranger), new-29
(Ottoman cavalry to rifleman), random-03, random-11, random-25, random-26, new-16, new-30 (horseman to foot unit),
reasonable-18 (Arbalester / Crossbowman: never used again, either model), and every other cross-kind pair of the random-30
and new-30 sheets, including random-01 and random-24 (graded 8, but foot unit to rider and centaur to naga) and new-15
(a dragon lord on two legs to a whelp: looked at for this plan, not a like-for-like creature).

Regression set (hard rule 4), at the ticks the owner graded:

| Pair | Grade | Ticks |
|---|---:|---|
| reasonable-05 Khorne Berserker -> Mountain King | 10 | skinLandmarks, hangingChains, trackWindow, keepTorso |
| reasonable-29 Furbolg Elder Shaman -> Wendigo Shaman | 10 | skinLandmarks |
| new-08 Hero Berserker -> Druid of the Talon | 10 | skinLandmarks, hangingChains, trackWindow, keepTorso, seatWeapon |
| random-10 Saurus Oldblood Hero -> Kroxigor Hero | 10 | skinLandmarks, trackWindow, seatWeapon |
| new-01 Nether Dragon -> Makrura Pooldweller | 10 | skinLandmarks, hangingChains |
| random-21 Dark Elf Slavemaster -> Empire Handgunners (Scoped) | 9 | heldGeometry, authoredMotion, seatWeapon |
| new-05 Italian Airborn SMG -> Dire Orc Death Knight | 9 | gripRouting |
| new-02 French Rifleman -> Polish Partisan WWII Sapper | 9 | none |

All pairs. `TB` = `D:\Claude\MDLxL\TestBuilds\transfer-xl-35`, `TM` = `D:\Claude\MDLxL-TestModels`. Step 2 copies the `TB`
files into `TM\xfer-reasonable\` and the pair list then points there. "Last grade" is the owner's most recent grade of the
pair on any sheet (noisy; a guide, not a target).

| Pair | Donor → target | Donor file | Target file | Last grade | Role |
|---|---|---|---|---:|---|
| reasonable-01 | High Elf Footman → Blood Elf Lieutenant | `TB/reasonable50/fixtures/HighElfFootman-4859392a/HighElfFootman.mdx` | `TM/reasonable-50/other__bloodelflieutenant-4e36f0c2/bloodelflieutenant.mdx` | 9 |  |
| reasonable-02 | Bretonnian Swordsman → Royal Soldier | `TB/reasonable50/fixtures/Bretonnian_Swordsman-936bce4a/Bretonnian_Swordsman.mdx` | `TB/reasonable50/fixtures/RoyalSoldier-c0183011/RoyalSoldier.mdx` | 10 |  |
| reasonable-03 | Dire Footman → Dismounted Bronzebeard Gryphon Warrior | `TB/reasonable50/fixtures/Dire_Footman-545f7840/Dire_Footman.mdx` | `TB/reasonable50/fixtures/BronzebeardDismountedGryphonWarrior_bakr-a8f95118/BronzebeardDismountedGryphonWarrior_bakr.mdx` | 9 |  |
| reasonable-04 | Black Knight → Dismounted Knight of the Blazing Sun | `TB/reasonable50/fixtures/BlackKnight-d1b34590/BlackKnight.mdx` | `TB/reasonable50/fixtures/KnightOfTheBlazingSunDismounted-bdbd9311/KnightOfTheBlazingSunDismounted.mdx` | 10 |  |
| reasonable-05 | Khorne Berserker → Mountain King | `TB/reasonable50/fixtures/WH_WOC_WarriorKhorneBerserker03-ed8a78ee/WH_WOC_WarriorKhorneBerserker03.mdx` | `TM/reasonable-50/human__heromountainking-b52747fc/heromountainking.mdx` | 10 | **regression** (ticks: skinLandmarks, hangingChains, trackWindow, keepTorso) |
| reasonable-06 | Fel Orc Grunt → Gor Axeman | `TM/reasonable-50/demon__chaosgrunt-158dc9da/chaosgrunt.mdx` | `TB/reasonable50/fixtures/gor_axe_NOglow-531837b7/gor_axe_NOglow.mdx` | 10 |  |
| reasonable-07 | Footman → Footman Sergeant | `TM/reasonable-50/human__footman-fa74ae72/footman.mdx` | `TB/reasonable50/fixtures/Sargeant-63aee91a/Sargeant.mdx` | 10 |  |
| reasonable-08 | Footman Leader → Elf Death Knight | `TB/reasonable50/fixtures/Footman_Leader-992d24c9/Footman Leader.mdx` | `TB/reasonable50/fixtures/Elf_DeathKnight-d080b1d6/Elf_DeathKnight.mdx` | 6 |  |
| reasonable-09 | Skeletal Orc → Greenskin Orc1 | `TM/reasonable-50/creeps__skeletonorc-a9c3bdee/skeletonorc.mdx` | `TB/reasonable50/fixtures/Greenskin_Orc1-49f7d59d/Greenskin_Orc1.mdx` | 10 |  |
| reasonable-10 | Templar Exemplar → Captain | `TB/reasonable50/fixtures/TemplarExemplar-63b20f51/TemplarExemplar.mdx` | `TM/reasonable-50/human__thecaptain-7b551366/thecaptain.mdx` | 8 |  |
| reasonable-11 | Skink Spearman → Northrend Murloc Spearman | `TB/reasonable50/fixtures/skink_spear_final-ee0d924e/skink_spear_final.mdx` | `TB/reasonable50/fixtures/NRW_MurlocSpearman-183144f2/NRW_MurlocSpearman.mdx` | 10 |  |
| reasonable-12 | Reikland Halberdier → Bretonnian Pikeman | `TB/reasonable50/fixtures/ReiklandHalberdier-d5c5d41a/ReiklandHalberdier.mdx` | `TB/reasonable50/fixtures/Bretonnian_Pikeman-6adaf835/Bretonnian_Pikeman.mdx` | 10 |  |
| reasonable-13 | Black Fur Great Knight → Reikland Greatsword | `TB/reasonable50/fixtures/BlackFurGreatKnight-959c55fd/BlackFurGreatKnight.mdx` | `TB/reasonable50/fixtures/ReiklandGreatsword-d1b26f1a/ReiklandGreatsword.mdx` | 8 |  |
| reasonable-14 | Hero Tauren Warbeast → Bestigor | `TB/reasonable50/fixtures/HeroTaurenWarbeast-c4eb9404/HeroTaurenWarbeast.mdx` | `TB/reasonable50/fixtures/bestigor10_noglow-6f9274be/bestigor10_noglow.mdx` | 9 |  |
| reasonable-15 | Minotaur → Tauren Chieftain | `TB/reasonable50/fixtures/Minotaur-85350aaa/Minotaur.mdx` | `TM/reasonable-50/orc__herotaurenchieftain-8a02a1dc/herotaurenchieftain.mdx` | 0 |  |
| reasonable-16 | Kroxigor → Tauren | `TB/reasonable50/fixtures/kroxigor_unit_xtent_fix-36f57762/kroxigor_unit_xtent_fix.mdx` | `TM/reasonable-50/orc__tauren-dac60423/tauren.mdx` | 0 |  |
| reasonable-17 | Bretonnian Archer → Night Elf Archer | `TB/reasonable50/fixtures/Bretonnian_Archer-39884eb9/Bretonnian_Archer.mdx` | `TM/reasonable-50/nightelf__archer-bbaa371a/archer.mdx` | 7 |  |
| reasonable-19 | Gnoll Assassin → Bronzebeard Crossbowman | `TM/reasonable-50/creeps__gnollarcher-003001dd/gnollarcher.mdx` | `TB/reasonable50/fixtures/BronzebeardCrossbowman_bakr-67a8433c/BronzebeardCrossbowman_bakr.mdx` | 6 |  |
| reasonable-20 | Bronzebeard Rifleman → Dire Rifleman | `TB/reasonable50/fixtures/BronzebeardRifleman_bakr-19090b77/BronzebeardRifleman_bakr.mdx` | `TB/reasonable50/fixtures/Dire_Rifleman-b8290e4d/Dire_Rifleman.mdx` | 10 |  |
| reasonable-21 | Skaven Ratling Gunner → Repeater Handgunner | `TB/reasonable50/fixtures/ratling_unit-78117503/ratling_unit.mdx` | `TB/reasonable50/fixtures/handgunner_repeater-c2ddeec3/handgunner_repeater.mdx` | 10 |  |
| reasonable-22 | Arquebus Handgunner → Reikland Handgunner | `TB/reasonable50/fixtures/handgunner_arquebus-8b548da0/handgunner_arquebus.mdx` | `TB/reasonable50/fixtures/ReiklandHandgunner-86c8fb6f/ReiklandHandgunner.mdx` | 10 |  |
| reasonable-23 | Hero Wizard → Tzeentch Shaman | `TB/reasonable50/fixtures/Hero_Wizard-ac8a4103/Hero_Wizard.mdx` | `TB/reasonable50/fixtures/tzeench_shaman_unit-f50f769e/tzeench_shaman_unit.mdx` | 0 |  |
| reasonable-24 | Hero Dwarf Grand Mage → Bronzebeard Priest | `TB/reasonable50/fixtures/Hero_DwarfGrandMage-1ffc98f7/Hero_DwarfGrandMage.mdx` | `TB/reasonable50/fixtures/BronzebeardPriest_bakr-8bf2d2fe/BronzebeardPriest_bakr.mdx` | 10 |  |
| reasonable-25 | Bronzebeard Mage → Skink High Priest | `TB/reasonable50/fixtures/BronzebeardMage_bakr-9ed883b9/BronzebeardMage_bakr.mdx` | `TB/reasonable50/fixtures/skink_high_priest_unit-5dbd9f60/skink_high_priest_unit.mdx` | 8 |  |
| reasonable-26 | Hero Murgul Warlock → Northrend Murloc Warlock | `TB/reasonable50/fixtures/HeroMurgulWarlock-f4d64dab/HeroMurgulWarlock.mdx` | `TB/reasonable50/fixtures/NRO_MurlocWarlock-985ea5a9/NRO_MurlocWarlock.mdx` | 10 |  |
| reasonable-27 | Forest Troll Shadow Priest → Forest Troll High Priest | `TB/reasonable50/fixtures/ForestTrollShadowPriest-f80842b0/ForestTrollShadowPriest.mdx` | `TM/reasonable-50/creeps__foresttrollshadowpriest-22f1c69d/foresttrollshadowpriest.mdx` | 10 |  |
| reasonable-28 | Fel Orc Warlock → Furion | `TB/reasonable50/fixtures/FelOrcWarlock-8a3f4d5d/FelOrcWarlock.mdx` | `TM/reasonable-50/nightelf__furion-9b694098/furion.mdx` | 5 |  |
| reasonable-29 | Furbolg Elder Shaman → Wendigo Shaman | `TM/reasonable-50/creeps__furbolgshaman-1aa9291f/furbolgshaman.mdx` | `TM/reasonable-50/creeps__wendigoshaman-2445ff6f/wendigoshaman.mdx` | 10 | **regression** (ticks: skinLandmarks) |
| reasonable-30 | Hero Grey Wizard → Bray Shaman | `TB/reasonable50/fixtures/Hero_GreyWizard-1c798ba7/Hero_GreyWizard.mdx` | `TB/reasonable50/fixtures/bray_shaman_unit-72644e0e/bray_shaman_unit.mdx` | 0 |  |
| reasonable-31 | Orc Warg Rider → Thrall | `TB/reasonable50/fixtures/OrcWargRider-20b96db2/OrcWargRider.mdx` | `TM/reasonable-50/orc__thrall-e8b81916/thrall.mdx` | 10 |  |
| reasonable-32 | Arkain Cavalry Sergeant → French Dragoon Cavalry | `TB/reasonable50/fixtures/Arkain_CavalrySergeant-840af16a/Arkain_CavalrySergeant.mdx` | `TB/reasonable50/fixtures/FrenchDragoonCavalry-3c93ab4d/FrenchDragoonCavalry.mdx` | 5 |  |
| reasonable-33 | Swan Knight → Polish Lancer | `TB/reasonable50/fixtures/SwanKnight-70c4e072/SwanKnight.mdx` | `TB/reasonable50/fixtures/PolishCavalry_2_Lance-75cdcf9c/PolishCavalry_2(Lance).mdx` | 9 |  |
| reasonable-34 | Black Rock Rider → Arthas (mounted, undead) | `TB/reasonable50/fixtures/Black_Rock_RiderV1_0-01d66965/Black Rock RiderV1.0.mdx` | `TM/reasonable-50/undead__undeadarthas-935d2338/undeadarthas.mdx` | 7 |  |
| reasonable-35 | Arkain Knight Of Kome → Undivided Chaos Knight | `TB/reasonable50/fixtures/Arkain_KnightOfKome-03d21799/Arkain_KnightOfKome.mdx` | `TB/reasonable50/fixtures/WH_WOC_KnightUndividedSword07-6c335aab/WH_WOC_KnightUndividedSword07.mdx` | 9 |  |
| reasonable-36 | WH WOC Knight Khorne Axe03 → Paladin Horse1.02 | `TB/reasonable50/fixtures/WH_WOC_KnightKhorneAxe03-7907efb9/WH_WOC_KnightKhorneAxe03.mdx` | `TB/reasonable50/fixtures/PaladinHorse1_02-5febf0c7/PaladinHorse1.02.mdx` | 6 |  |
| reasonable-37 | Stolio the Lancer → Tzeentch Lance Knight | `TB/reasonable50/fixtures/Stolio-b297c452/Stolio.mdx` | `TB/reasonable50/fixtures/WH_WOC_KnightTzeentchLance07-7ad03a7b/WH_WOC_KnightTzeentchLance07.mdx` | 7 |  |
| reasonable-38 | Cold One Rider → Lizardman Raiding Cavalry | `TB/reasonable50/fixtures/Cold_One_Rider_UNIT-56eb708c/Cold_One_Rider_UNIT.mdx` | `TB/reasonable50/fixtures/LizardmanRaidingCavalry-03441e1b/LizardmanRaidingCavalry.mdx` | 5 |  |
| reasonable-39 | Bronzebeard Gryphon Rider → Wind Rider Undead | `TB/reasonable50/fixtures/BronzebeardGryphonRider_bakr-27c8ff9f/BronzebeardGryphonRider_bakr.mdx` | `TB/reasonable50/fixtures/WindRiderUndeadV1_00-63dc1654/WindRiderUndeadV1.00.mdx` | 10 |  |
| reasonable-40 | Black Legion Gryphon Rider → Apothecary Bat Mount | `TB/reasonable50/fixtures/BlackLegionGryphonRiderV2-c3990817/BlackLegionGryphonRiderV2.mdx` | `TB/reasonable50/fixtures/ApothecaryBatMountV1_02-40a7eb7c/ApothecaryBatMountV1.02.mdx` | 5 |  |
| reasonable-41 | Elven Dire Dragonhawk → Warsong Wyvern Rider | `TB/reasonable50/fixtures/ElvenDireDragonhawk-5a414d4e/ElvenDireDragonhawk.mdx` | `TB/reasonable50/fixtures/Warsong_WyvernRiderV2-98c6eaed/Warsong_WyvernRiderV2.mdx` | 0 |  |
| reasonable-42 | Far Seer Wyvern → Hero Gnome Dragonrider | `TB/reasonable50/fixtures/FarSeerWyvernV2_02-0700890b/FarSeerWyvernV2.02.mdx` | `TB/reasonable50/fixtures/HeroGnomeDragonrider-90f63ebd/HeroGnomeDragonrider.mdx` | 0 |  |
| reasonable-43 | Gryphon Rider → Dragonhawk Rider | `TM/reasonable-50/human__gryphonrider-fe21e8ec/gryphonrider.mdx` | `TM/reasonable-50/human__bloodelfdragonhawk-a175aae4/bloodelfdragonhawk.mdx` | 0 |  |
| reasonable-44 | Dire Wolf → Fel Stalker | `TM/reasonable-50/creeps__direwolf-bbc7dc3d/direwolf.mdx` | `TM/reasonable-50/demon__felhound-09aca38c/felhound.mdx` | 10 |  |
| reasonable-45 | Cold One Riderless → Snap Dragon | `TB/reasonable50/fixtures/Cold_One_Riderless-d2eca444/Cold_One_Riderless.mdx` | `TM/reasonable-50/naga__snapdragon-b3ced23c/snapdragon.mdx` | 5 |  |
| reasonable-46 | Red Dragon → Wind Rider (Riderless) | `TM/reasonable-50/creeps__reddragon-8fbd9325/reddragon.mdx` | `TM/reasonable-50/orc__riderlesswyvern-a9e3ab42/riderlesswyvern.mdx` | 0 |  |
| reasonable-47 | Frost Wyrm → Von Carstein Zombie Dragon | `TM/reasonable-50/undead__frostwyrm-1f00494f/frostwyrm.mdx` | `TB/reasonable50/fixtures/WH_VC_ZombieDragon02-bd69b285/WH_VC_ZombieDragon02.mdx` | 0 |  |
| reasonable-48 | Dreadlord → Succubus | `TM/reasonable-50/undead__herodreadlord-c5ef9019/herodreadlord.mdx` | `TM/reasonable-50/demon__demoness-649aaa9d/demoness.mdx` | 5 |  |
| reasonable-49 | Elder Voidwalker → Lava Spawn (Level 1) | `TM/reasonable-50/creeps__voidwalker-6ef9d442/voidwalker.mdx` | `TM/reasonable-50/creeps__lavaspawn-6ff3e1cb/lavaspawn.mdx` | 6 |  |
| reasonable-50 | Sea Turtle → Lightning Lizard | `TM/reasonable-50/creeps__seaturtle-b1f2b661/seaturtle.mdx` | `TM/reasonable-50/creeps__thunderlizard-f8e878c9/thunderlizard.mdx` | 5 |  |
| new-01 | Nether Dragon → Makrura Pooldweller | `TM/new-30/creeps__netherdragon-7351839c/netherdragon.mdx` | `TM/new-30/creeps__lobstrokkred-c14da854/lobstrokkred.mdx` | 10 | **regression** (ticks: skinLandmarks, hangingChains) |
| new-02 | French Rifleman → Polish Partisan WWII Sapper | `TB/new30/fixtures/FrenchWW1Sapper-3f6255b9/FrenchWW1Sapper.mdx` | `TB/new30/fixtures/PolishPartisanSapper-8c3f7975/PolishPartisanSapper.mdx` | 9 | **regression** (ticks: none) |
| new-04 | Italian Officer WWI → CCP Chinese Shocktroop | `TB/new30/fixtures/ItalianOfficerWWI-eb3eb113/ItalianOfficerWWI.mdx` | `TB/new30/fixtures/ChineseCCP_Shocktroop-3d610f80/ChineseCCP_Shocktroop.mdx` | 10 |  |
| new-05 | Italian Airborn SMG → Dire Orc Death Knight | `TB/new30/fixtures/ItalianAirborn_SMG-98eb0e9a/ItalianAirborn_SMG.mdx` | `TB/new30/fixtures/Dire_GruntDead-ee32f22b/Dire_GruntDead.mdx` | 9 | **regression** (ticks: gripRouting) |
| new-08 | Hero Berserker → Druid of the Talon (Night Elf Form) | `TB/new30/fixtures/Hero_Berserker-4acc1c0f/Hero_Berserker.mdx` | `TM/new-30/nightelf__druidofthetalon-edea56bb/druidofthetalon.mdx` | 10 | **regression** (ticks: skinLandmarks, hangingChains, trackWindow, keepTorso, seatWeapon) |
| new-26 | Dire Gnoll Hero → In Land Murloc Spear Man Purple | `TB/new30/fixtures/DireGnoll-466b1801/DireGnoll.mdx` | `TB/new30/fixtures/ILP_MurlocSpearman-94e16265/ILP_MurlocSpearman.mdx` | 5 |  |
| random-10 | Saurus Oldblood Hero → Kroxigor Hero | `TB/fixtures/random30/e3533207a5b0378b/Oldblood_hero.mdx` | `TB/fixtures/random30/18c1dc9673e4b407/kroxigor_hero_xtent_fix.mdx` | 10 | **regression** (ticks: skinLandmarks, trackWindow, seatWeapon) |
| random-17 | Shaman → Skink Chief (Hero) | `TB/fixtures/random30/9edbbf8be272a140/orc__shaman.mdx` | `TB/fixtures/random30/f25101fecc65628d/skink_chief_hero.mdx` | 8 |  |
| random-21 | Dark Elf Slavemaster (Unit) → Empire Handgunners (Scoped) | `TB/fixtures/random30/c520ac4cbad1d5c0/Dark_Elf_Slavemaster_unit_opt.mdx` | `TB/fixtures/random30/cdde947153c43e36/handgunner_scope.mdx` | 9 | **regression** (ticks: heldGeometry, authoredMotion, seatWeapon) |

## Risks and what I am unsure of

- **Seat rule (step 6) rests on 11 pairs.** The split between "repaired" and "exchanged a good grip" is clear in the table,
  but the thresholds are mine, and one pair (reasonable-38) sits close to one of them. The step lists every tick that changes so the pictures decide, and names a simpler
  fallback. I could not make any measurement prefer the owner's choice on reasonable-32; the rule there works by noticing
  that nothing was broken and the blade was rolled, not by scoring the look.
- **What the owner saw on reasonable-32** is inferred from flat-shaded pictures (sabre flat, hilt in the hip). The textured
  app view may show more. If the sheet after step 6 still reads wrong on that pair, the cause is not the one named here.
- **Seat keeps one known limit:** a seated weapon follows the hand only. Where the donor sheathes, throws or changes hands,
  a seated weapon stays in the hand. Not fixed in this plan; with step 6 Seat is suggested on fewer pairs, which narrows it.
- **Step 4 changes the rig reading used by both Transfer modes.** The pattern is narrow (Hand attachment on the wrist,
  Weapon attachment on the chain's end) and matched one model in 110 pairs, but models outside the test set with that
  pattern will read differently in retargeting too. I believe that is the correct reading; it is untested there.
- **Step 5 was tried on three animations of one pair.** Death, Spell and the rest were not looked at. The same rule fires
  for any four-legged model without arms taking a two-legged donor with arms (a horse taking a footman would rear up with
  its front legs as arms). The owner asked for exactly this on the Snap Dragon; whether it is wanted on every such pairing
  was not asked. Those pairings are outside the test set, so nobody will look at them unless the owner does.
- **Step 7 may fail again.** Round 1's second-hand work was reverted. The plan keeps it behind a checkbox and after the
  owner's look, and says to stop rather than ship twitching.
- **Earlier "rejected" checkboxes.** Rest pose fit and Weapon on bones were taken out of suggestions on the owner's
  reasonable-50 comments, then ticked again by the six-rule step, and the owner graded those pairs 9-10 on the final sheet
  (reasonable-05, reasonable-29, new-05) and added Rest pose fit himself on new-01. So only Seam fix goes on the
  owner-rejected list now. If he means the others too, they are one line each.
- **reasonable-38 has small openings without Seam fix** (47 of 807 welded pairs, 2.4% of height). Either real small gaps
  between the rider's parts or pieces that are meant to separate in an animation the own model never plays. Step 3 reports
  it; I have not looked at where they are.
- **random-04's "weapon"** is a 6-vertex item 0.5 arm lengths long held 0.55 arm from the palm in the model's own
  animations: probably not a weapon at all. The pair is out of the set; the misreading in `readWeapon` is not investigated.
- **The scorecard's shaft angle** read 45 deg on reasonable-38 with Seat while the shaft matches the donor's within 1 deg
  in world space (`plane.mjs`). One of the two readings is wrong; I did not find which. Step 6 does not rely on it.
- **Grades are noisy** (owner, 25 Nov). The 9-10 pairs are held byte-identical, which is safe but also means nothing in
  this plan can improve them.

## One question for the owner (not blocking)

Seam fix: keep the checkbox (never ticked for you) or remove it from the window? The plan keeps it, because your rule is
toggles, not gates. Removing it is a five-minute change.
