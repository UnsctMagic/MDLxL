# XFER transplant: Fable's review and fix plan (26 Nov 2026)

Status: in progress. Step 1 done (`918aaa11`, approved by Fable). Step 2 done (`e5718d53`, approved by Fable).
Step 2b done (`d7e96680`, approved). Step 3 done (`6571275b` and its fix `43c16f95`, approved). Step 4 done (`a12a7bc0`,
approved; housekeeping `557004c6`). Step 5 done (`22e994a7`, approved). Step 5b done (`af6def6b`, `10b7c6d2`, baseline `b0d6fd03`; approved by reading: the
walk itself was then looked at from the side: see "Step 5b finding"). Step 6 built (`e48baec7`): approved with one fix
("Step 6 fix", done `5336de33`, approved). Step 8's sheet built (`ebc2b809`, approved with the control ticks seeded).
Step 5c dropped by the owner (13:56). Step 7 merged (`7cf9992d`, baseline `e91f7b10`). The owner graded the reasonable
sheet (nine 10s, three 9s, one 8, two 5s). Next: steps 9, 10, 11 and the small sheet, under "After the reasonable sheet".
Owner, 26 Nov: "keep going without him"; Fable decides and writes each decision under "Decisions made without the owner".
From here on Fable designs and reads results; checks are run by Opus or a cheaper agent (owner, 26 Nov).
Owner's order (26 Nov): "Fable 5.2 reviews and plans the code. Opus 5.5 on medium writes, builds, tests. I review results."
Checkout: `D:\Codex\xfer-toggles`, branch `codex/xfer-toggles`, revision `6cfed3a6`. Local only: never push, PR, tag or post.
Brief: [xfer-fable-review-brief.md](xfer-fable-review-brief.md). History: [xfer-toggles.md](xfer-toggles.md), [xfer-finish-line.md](xfer-finish-line.md).

## For the owner (short)

Four causes found, each checked on your own pairs by picture and by measurement.

- **Seam fix** tears the skin at every seam it touches. It came back because the last suggester step ticks anything a number likes. It went out of suggestions (step 1) and, on your word "Remove it", the checkbox goes out of the window (step 2b).
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
- **Can Seam fix itself be repaired?** Not honestly in this plan. It has never improved a pair the owner graded. Step 1
  took it out of suggestions; the owner then answered the plan's question with "Remove it" (26 Nov), so step 2b removes the
  checkbox and the code behind it.

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

1. **Seam fix is gone.** Never suggested (step 1) and, on the owner's word "Remove it" (26 Nov), no longer a checkbox
   or an engine path (step 2b). Old sheets and answers that name it still open.
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

**Done: `918aaa11`, approved.** One accepted difference: reasonable-38 keeps Keep own torso (Seam fix used to untick it
through their shared clash group); measured better (stretched edges 45 to 10, worst stretch in Death 2.85x to 1.26x).

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

**Done: `e5718d53`, approved.** 58 pairs in `scripts/xfer-scorecard/pairs-reasonable.json`, 83 model folders copied into
`MDLxL-TestModels\xfer-reasonable\`, baseline written at `918aaa11`. `regress.mjs` also takes `--jobs n` and
`--suggestions <live.jsonl>`; a `--check --all` that is used as proof must run the suggester itself (no `--suggestions`).

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

### Step 2b. Remove the Seam fix checkbox (owner, 26 Nov: "Remove it")

Small step, run next. Seam fix stops being a repair: not shown in the Transfer window, not shown on the grading sheet, not
built by the engine. Nothing else about the suggester or the engine changes.

- **Files.**
  - `src/transplant-autofix.js`: the key, its label, its clash entry, the owner list, a new retired list.
  - `src/skeleton-transplant.js`: the import on line 45 and the block at 2893-2914.
  - `src/transplant-skin.js`: lines 123-282 (the seam repair and its helpers).
  - `src/transfer-picks.js`: the sheet's cases reader and `withGrade`.
  - `app/TransferPicks.jsx`: the two places saved ticks are read (lines 156 and 354).
  - `src/locales/de.json`, `es.json`, `fr.json`, `ru.json`, `zh.json`: two entries each.
  - `scripts/xfer-scorecard/pairs-reasonable.json`: the stored `suggestion.visible` lists.
  - Tests: `test/transplant-autofix.test.js`, `test/xfer-suggest-toggles.test.js`, `test/transfer-picks.test.js`.
  - Not touched: `app/TransplantToggles.jsx` and `app/Transfer.jsx` (they draw whatever keys they are given; with the key
    gone from the list there is nothing to draw), `src/xfer-suggest-toggles.js` except the test option below.
- **Change.**
  1. *The key.* In `transplant-autofix.js` remove `'seamFix'` from `AUTO_FIX_KEYS` (line 20), from the clash group at line 31
     (it becomes `['keepTorso', 'sewnTorso']`) and its entry in `AUTO_FIX_LABELS` (line 74). The suggester loops over
     `AUTO_FIX_KEYS`, so the Transfer window no longer gets the key and shows no box. The sheet draws the keys saved in its
     cases file, and `TransplantToggles.jsx` reads `AUTO_FIX_LABELS[key]` for each: a retired key reaching it would throw.
     Item 6 below is what keeps old sheets from crashing; it is not optional.
  2. *The owner list stays, empty.* `OWNER_REJECTED_KEYS = Object.freeze([])`. It is the mechanism of hard rule 2 and steps
     3 and 6 use the same `blocked` set, so the list and the exit filter in `suggestToggles` are kept. Comment: Seam fix was
     the first entry (26 Nov) and was then removed outright on the owner's word; the list is for a checkbox the owner
     rejects but wants kept.
  3. *A retired list for old files.* Export `RETIRED_REPAIR_KEYS = Object.freeze(['seamFix'])` and
     `knownRepairKeys = keys => keys.filter(key => AUTO_FIX_KEYS.includes(key))`. Comment with the owner's words and the last
     commit that still has the code (`e5718d53`).
  4. *The engine.* Delete the `if (fix?.seamFix) { ... }` block in `skeleton-transplant.js` (2893-2914) and
     `repairDonorSeams` from its import. Delete from `transplant-skin.js` what only that block used: `repairDonorSeams`,
     `repairSeamGeoset`, `donorSeams`, `meshNeighbours`, `jointSet`, `seamKey`, `additive` (lines 123-282), then any import
     at the top of the file that nothing else uses. Check each name with a search before deleting it; anything used
     elsewhere stays. The work is not lost: it is in Git at `e5718d53`. Reason for deleting rather than leaving it: no key
     can reach it any more, and it is the code that tore the meshes.
     `autoFixOptions` already reads only the keys in `AUTO_FIX_KEYS`, so `{ seamFix: true }` from an old caller is ignored
     and gives the plain result. No throw.
  5. *Labels and translations.* Remove the two English keys `"Seam fix"` and
     `"Keeps the skin from pulling apart where the donor never bends."` from all five catalogs (de 9062-9063, es 8947-8948,
     fr 9062-9063, ru 8937-8938, zh 8843-8844). Search first that no other screen uses either sentence. No new text
     anywhere (AGENTS.md: no flavour text).
  6. *Old sheets must open.* `parseCases` in `transfer-picks.js` checks every saved key against `AUTO_FIX_KEYS`
     (`repairList`, line 16, used at line 92) and would now reject every existing sheet under `TestBuilds` with "a saved
     repair suggestion is required". Change: `repairList` accepts keys from `AUTO_FIX_KEYS` or `RETIRED_REPAIR_KEYS`
     (anything else is still an error), and the parsed `suggestion` is returned with `visible` and `suggested` passed
     through `knownRepairKeys`.
  7. *Old answers must open and must not be rewritten.* Answers files keep `toggles` and `suggested` per pair, some with
     `seamFix` (final sheet: reasonable-45, reasonable-46, random-03). `parseAnswers` stays as it is: the saved record of
     what the owner graded is not edited. Where saved ticks are **used**, pass them through `knownRepairKeys`:
     `TransferPicks.jsx` line 156 (`checked`) and line 354 (`toggleRepair(...)`), and in `withGrade`
     (`transfer-picks.js` 214-224) for the entry being written (`entry.toggles`). Entries of other pairs are written back
     untouched.
  8. *The Transfer window.* Its ticks live in memory only (`tpRepairs`, `useState` in `Transfer.jsx` 602); nothing about
     repairs is saved in the profile, so there is nothing to migrate. Say so in the step report after checking.
  9. *The pair list.* Strip `seamFix` from every `suggestion.visible` in `pairs-reasonable.json` with a one-off script (it
     is in no `suggested` list and in no baseline tick; checked by Fable). `regression-baseline.json` is **not** rewritten.
  10. *A test option for the owner list.* With the list empty, its test would prove nothing. Give `suggestToggles` an
      option `rejected` (default `OWNER_REJECTED_KEYS`) in its fourth argument and build `blocked` from it, so a test can
      pass a living key.
- **Must not change.** Any export at any ticks that do not contain `seamFix`; any suggestion; the order of the remaining
  checkboxes; the other 25 labels and their translations; `parseAnswers`; old answers on disk.
- **Tests (each fails on today's code first).**
  - `test/transplant-autofix.test.js` (lines 360-369): `AUTO_FIX_KEYS` has no `seamFix`; `autoFixOptions({ seamFix: true })`
    is `null`; replace the old `active({ seamFix: true })` line by a living key (`sewnTorso`); `toggleRepair(['keepTorso'],
    'sewnTorso', true)` still unticks Keep own torso.
  - `test/transfer-picks.test.js`: a cases file whose `suggestion.visible` and `suggested` hold `seamFix` parses, and the
    parsed lists do not hold it; a key that never existed still throws; `withGrade` on an old answer
    `{ toggles: ['seamFix', 'seatWeapon'] }` writes `['seatWeapon']` for that pair and leaves another pair's saved
    `['seamFix']` as it was.
  - `test/xfer-suggest-toggles.test.js`: replace the two Seam fix tests. Red Dragon onto the riderless Wind Rider:
    `seamFix` is in neither `visible` nor `suggested`. Furbolg Elder Shaman onto Wendigo Shaman with
    `{ rejected: ['skinLandmarks'] }`: `skinLandmarks` is in `visible` and not in `suggested` (without the option it is
    suggested). Keep the file at three pairs.
  - Commands: `node --test test/transplant-autofix.test.js test/transfer-picks.test.js test/xfer-suggest-toggles.test.js`
    and the catalog tests `node --test test/localization-catalogs.test.js test/localization-current.test.js
    test/localization-quality.test.js test/localization-ui-gaps.test.js`.
- **Measure.**
  - `node scripts/xfer-scorecard/regress.mjs --check --all --jobs 4` with the suggester run again: **58 checked, 0 differ**
    (no suggestion and no baseline tick holds `seamFix`, and the deleted engine block only ran with that key), and
    `--check`: 8 checked, 0 differ. Any difference means something other than Seam fix was removed: stop and report.
  - A search for `seamFix`, `Seam fix`, `repairDonorSeams` and `repairSeamGeoset` under `src/`, `app/`, `scripts/` and `test/`
    finds only `RETIRED_REPAIR_KEYS`, its comment, the tests of this step, and the comment in `test/helpers/fixtures.cjs`.
  - `pnpm run build` passes.
- **By eye / in the app.** No picture changes, so no renders. The window itself is clicked in step 8 on the packaged build
  (added there): the Transfer window on Red Dragon -> Wind Rider riderless shows the repair row without Seam fix, and the old
  final sheet (`TestBuilds\transfer-xl-35\cases-final.json`, whose saved ticks name Seam fix) opens with no error, shows no
  Seam fix box, and reasonable-46 opens with no box ticked.
- **Said plainly.** On the old sheets, a grade the owner gave with Seam fix ticked now sits beside a result built without
  it; the saved answer still says which ticks he graded. The pictures in C1 can only be reproduced at `e5718d53` or
  earlier.

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
- **Test (fails first).** After step 2b no checkbox makes holes, so the test makes one: build Red Dragon -> Wind Rider
  riderless plain (`rules.holes.pass === true`), then in a copy of the result rebind one side of 20 welded pairs to the
  root bone and score again: `rules.holes.pass === false`, `torn >= 20`. Today the rule does not exist.
- **Measure.** `score.mjs` over the 58 pairs at their ticks: expected `holes` passes on all (reasonable-38 reads 47 of 807
  pairs at 2.4% without Seam fix: it must still pass by the `worst` limit and the 5.8% share must be looked at; if it
  fails, report it, do not change the limit). The eight 9-10 pairs: 0 torn. Time per pair before and after (report it).
- **By eye.** Fable compares the three worst `holes` readings of the run with their pictures to confirm the number shows
  real cracks.

### Step 3 fix. Holes veto only, and by getting worse, not by pass or fail (Fable's review of `6571275b`)

The hole rule itself is right and stays as built (limits fixed: 1.5% opening, 1% of pairs, 3% widest). Two things in how
the suggester uses it are wrong; the first is my own wording in step 3 ("add `holes` to `SCORE_RULES` so gained and lost
count it").

- **Why.** On reasonable-28 the six-rule step ticked **Find held weapon** because it "passed" the hole rule (3 torn pairs
  to 0) and lost no other rule. That checkbox changes which hand is read and mirrors the result; it was ticked for a side
  effect on a new number nobody had looked at. Pictures (`out/fable-review/step-3/r28-trac.png`, `r28-held.png`): it does
  bring the two halves of Furion's left hand together, and it also turns the stance round and leaves a small loose
  fragment by the staff. Not a clear gain, and exactly the way Seam fix came back. The hole rule may stop a tick. It may
  never add one.
- **Second fault.** The veto only fires when the plain result passes and the ticked result fails. Nine of the 58 pairs
  already fail plain (below), so on those the veto can never fire, whatever a checkbox tears. A veto has to look at
  whether holes got **worse**.
- **Change** (`src/xfer-scorecard.js`, `src/xfer-suggest-toggles.js`, tests):
  1. Export from `xfer-scorecard.js`:
     `holesWorse(before, after)` = both have `pairs`, and `after.torn - before.torn > Math.max(2, 0.005 * before.pairs)`.
     (More torn seams by more than two and more than half a percent of the seams. One touching point opening is not a hole.)
  2. In `suggestToggles`, move the six-rule bookkeeping into an exported pure function
     `ruleChange(before, after)` -> `{ gained, lost }`:
     `gained` counts rules other than `holes` going fail to pass;
     `lost` counts rules other than `holes` going pass to fail, plus 1 when `holesWorse(before.rules.holes, after.rules.holes)`.
     The loop and the "together they fail" fallback use it unchanged otherwise.
  3. The final veto compares with the plain result by the same test: when `holesWorse(plainHoles, suggestedHoles)`, drop and
     block the first tick whose removal makes it no longer worse than plain. (Today's condition "plain passes and the
     suggestion fails" goes.)
  4. `SCORE_RULES` keeps `'holes'` for the scorecard page and scripts; only the suggester treats it differently.
- **Tests (fail first, no models needed).** `ruleChange`: holes fail to pass with everything else equal gives
  `gained: 0`; holes 47 torn to 136 torn of 807 with both failing gives `lost: 1`; 0 to 1 torn of 505 gives `lost: 0`;
  another rule fail to pass still gives `gained: 1`. `holesWorse` on the same numbers. The existing tear test stays.
- **Measure.** `regress.mjs --check --all` with the suggester re-run: **58 checked, 0 differ** (reasonable-28 back to Smooth
  feet + Seat weapon). `--check`: 8 of 8. The baseline is not rewritten.

**What the hole rule found on the plain engine (no fix in this step; listed so nobody recalibrates it away).**

| Pair | Reading | What it is |
|---|---|---|
| reasonable-28 Fel Orc Warlock -> Furion | 3 of 780, 52% of height, Attack | Real. Furion's left hand is two meshes on two bones under the hand (`Mesh20ArchDruid`, `Mesh11ArchDruid`). They are carried as weapon pieces, one on the donor's `Weapon` bone and one on its `Staff` bone, so half the hand leaves the arm. Seen in the picture. Same family as C2: something under the hand read as the held item |
| reasonable-16 Kroxigor -> Tauren | 12 of 278, 13% and 6%, the Slam animations | Both wrists: hand piece against forearm piece. Not confirmed by picture at sheet size |
| reasonable-22 Arquebus -> Reikland Handgunner | 6 of 225, 2.6% | Both wrists, small |
| reasonable-38 | 47 of 807, 2.4% | Rider against mount, small |
| reasonable-41 | 4 of 1856, 4.6%, Death | Rider's chest against the mount's body when the rider falls: expected |
| reasonable-24 | 2 of 651, 5.3% | A hood tail against the chest (cloth) |
| reasonable-04 | 2 of 187, 2.8%, Death | Shoulder |
| reasonable-08 | 1 of 505, 8.2% | One point where the two thighs touch: not a hole |
| reasonable-02 | 1 of 317, 3.6% | One point between the base and a leg: not a hole |

So the pass or fail of this rule on a plain result mixes real gaps (28, 16, 22) with touching points (08, 02). The limits
are **not** changed because of that: the suggester now uses only "got worse", and the scorecard page shows the reading.
reasonable-28's split hand is a real engine fault and is added to the risks list; it is not part of steps 4-7.

### Step 4. An arm ends at its hand, not at the weapon bone (reasonable-08)

**Done: `a12a7bc0`, approved.** Only reasonable-08 changed. Its suggestion gained Rest pose fit; by picture that is better
(shoulders no longer up around the head in Stand and Walk), accepted. Two things it did **not** solve, seen in the pictures:
in Stand - 2 the sword now leaves the hand and goes down to the hip as the donor's does, but it lies through the torso with
its hilt up by the fists (see risks); in Attack - 1 the right palm is 0.12-0.31 arm lengths off the grip mid-swing (donor
0.00-0.08) and the left hand is off the sword (step 7).

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

**Done: `22e994a7`, approved.** Of the 58 pairs only reasonable-45 changes; in every donated animation the Snap Dragon's
front legs read as the Cold One's arms (Fable looked at all four picture sheets). The rule is general, as planned: it also
fires on pairings outside the test set. Checked on one, Timber Wolf taking the Footman (`out/fable-review/step-5/wolf-*.png`):
before, the wolf stayed on four legs with its front legs copying the back legs' walk; now it stands up like the Footman
with its front legs as arms. Measured, that is the cleaner result (stretched edges 7 to 2, worst stretch 1.48x to 1.04x, no
holes), and it is what "the mesh takes the donor's skeleton whole" means. It is still a visible change of behaviour for
every four-legged model without arms that takes a two-legged donor with arms. The owner answered with two checkboxes
(step 5b), so it becomes the user's choice.

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

### Step 5b. Front legs: two checkboxes, Mirror legs (with a timing slider) and Use arms (owner, 26 Nov)

Owner: "Give users a toggle 1) Allows to mirror legs - but also calculates the new animation so that the walk will be a
real walk on 4 legs - not 2 pers of legs copying eachother, it has to re-use the same motion and offset it to create a good
walk on 4 legs - give users a slider to adjust it rather than rely on a 1-shot result. 2) Use arms - does what I asked for
the snap-dragon - front legs get animated as arms."

- **Behaviour.**
  - *No box ticked:* as before step 5 (front legs copy the back legs on the same side). Step 5's rule now needs its box.
  - *Use arms* (`useArms`): exactly step 5. Applies when this model has more legs on both sides than the donor, no arms,
    and the donor has arms.
  - *Mirror legs* (`mirrorLegs`): the spare front legs take the mirrored motion of the opposite back leg (the engine's
    existing `diagonal` gait), and in looping Walk animations that motion is shifted in time by the slider. Applies when
    this model has more legs on both sides than the donor.
  - *Leg timing* slider, shown only while Mirror legs is ticked: 0 to 100 (% of the walk cycle), step 5, default 25.
    0 = front leg steps with the back leg on its own side, 25 = four-beat walk, 50 = with the opposite back leg (the plain
    mirror). The engine shifts the mirrored copy by `(value - 50)%` of the clip. Only looping animations whose name starts
    with Walk are shifted; in every other animation Mirror legs is the plain mirror.
  - The two boxes exclude each other (one clash group).
- **Files and changes.**
  1. `src/transplant-autofix.js`: add `mirrorLegs`, `useArms` to `AUTO_FIX_KEYS` (after `seatWeapon`), the clash group
     `['mirrorLegs', 'useArms']`, labels in the owner's words:
     `mirrorLegs: ['Mirror legs', 'Front legs walk with the back legs' motion, mirrored and shifted in time.']`,
     `useArms: ['Use arms', "Front legs move as the donor's arms."]`. Export `LEG_TIMING = { min: 0, max: 100, step: 5, default: 25 }`.
  2. `src/transplant-gait.js`: `transplantGait(..., { useArms, mirrorLegs })`: the `armsFromLegs` rule of step 5 only with
     `useArms`; with `mirrorLegs` the spare legs use the `diagonal` assignment whatever `choice` says. `duplicateGaitChains`
     takes the shift (a share of the clip, `(legTiming - 50) / 100`) and applies it to the copied chain's Rotation,
     Translation and Scaling keys inside each looping Walk interval: key time `a + ((t - a + shift * L) mod L)`, with keys
     added at both ends of the interval sampled from the original at the wrapped time, so the loop closes. Put the shift in
     one exported pure function (`shiftLoopKeys(track, interval, share)`) so it can be tested without models. Because the
     copies are shifted in the donor copy before anything else, feet planting and ground fitting treat them as legs as today.
  3. `src/skeleton-transplant.js` (`transplantRun`): read `fix.useArms`, `fix.mirrorLegs` and a new option `legTiming`
     (number, default `LEG_TIMING.default`, clamped) and pass them to the two functions. The leg filters added in step 5
     stay.
  4. `src/transfer-window.js` `transplantOptions`: pass `legTiming` through, only when Mirror legs is ticked (so no other
     export gets a new field).
  5. `src/xfer-suggest-toggles.js`: the two keys are a **choice**, not a scored repair: never a first-stage candidate,
     skipped by the six-rule loop, never dropped by the hole veto. They are shown by the existing rule (their result differs
     from plain). One is suggested only in the step 5 situation (no own arms, donor has arms, more legs on both sides):
     `useArms` when the donor leans like a beast (the line from the middle of its leg roots to the middle of its arm roots
     is 45 deg or more from upright at its Stand reference), else `mirrorLegs`. Measured: Cold One 76, Ghoul 74,
     Abomination 30, Kobold 11, Footman 5, Grunt 4. Put the pick in an exported pure function. Where the model has arms of
     its own (a rider on a four-legged mount, reasonable-38) Mirror legs is shown and not suggested.
  6. `app/TransplantToggles.jsx`: when `mirrorLegs` is in `checked`, a `RangeField` from `app/Fields.jsx` directly after
     that checkbox in the same row (never a bare range input; it carries the - and +): label `Leg timing`, tooltip
     `When the front legs step: 0 with the back leg on the same side, 50 with the opposite one.`, `output` as `25%`,
     `onCommit` (one rebuild per release or step, not per pointer event). New props `legTiming`, `onLegTiming`. No other
     layout change, no new panel.
  7. `app/Transfer.jsx`: `legTiming` state beside `tpRepairs` (reset with the pair), into `transplantOptions`.
     `app/TransferPicks.jsx` and `src/transfer-picks.js`: the sheet saves `legTiming` in the pair's answer next to `toggles`
     (`withGrade`), reads it back, and puts it in the live request key.
  8. Translations: both labels, both tooltips, the slider label and its tooltip in `de`, `es`, `fr`, `ru`, `zh`.
  9. `test/transplant-gait.test.js`: the Timber Wolf default goes back to `same-side` (the line step 5 changed).
  10. Pair list: add `legs-01` Footman -> Timber Wolf (both stock, `corpus-sd`) to `pairs-reasonable.json`, marked
      `choice: true`; it is there for the owner to try the boxes, not as a reasonable pairing, and is left out of scorecard
      counts.
- **Must not change.** Every export with neither box ticked equals the export before step 5 (the baseline still holds
  reasonable-45 from before step 5: do not rewrite it first). reasonable-45 with Use arms equals step 5's export byte for
  byte. No pair of the 58 other than reasonable-45 changes ticks or bytes. The eight 9-10 pairs: 8 of 8.
- **Tests (fail first).** `shiftLoopKeys`: shift 0 and shift 1 give the original samples, shift 0.5 equals the original
  sampled half a clip later, first and last key agree. `transplantGait` on the reasonable-45 fixtures: no flag = leg copy,
  `useArms` = arms, `mirrorLegs` = mirrored opposite leg. Footman -> Timber Wolf: front-foot paths in Walk at timing 25
  and 50 differ, and each front foot still swings. The pick function on the six measured leans. `transfer-picks`: an
  answer keeps `legTiming`. `test/ui-primitives.test.js` passes (no bare slider). Catalog tests as in step 2b.
- **Checks to run (Opus or a cheaper agent; Fable reads the output).**
  1. Before any change: the SHA-256 of reasonable-45's export at `skinLandmarks, authoredMotion` on `22e994a7` (step 5).
  2. After: `regress.mjs --check --all` (suggester re-run): only `reasonable-45: ticks changed: ... -> ..., useArms`; and
     its export at the new ticks has the hash from 1. `--check`: 8 of 8.
  3. Then `--write --all --only reasonable-45,legs-01` from a clean tree, with `git diff` showing only those two entries
     and the revision line.
  4. The related test files, with the known failures named (skeleton-transplant 11, transplant-support 3, detached pipe,
     2 catalog size tests).
- **Pictures** (`out/fable-plan/step-5b/`, at most three rows of animations per PNG, `--n 8` for Walk so the phases show):
  reasonable-45 Walk with no box, Use arms, Mirror legs 25; `legs-01` Walk with no box, Mirror legs at 0, 25 and 50, Use
  arms; plus Stand and Attack once for each box on both pairs.
- **Sheet (step 8).** Rows for reasonable-45 (default Use arms) and `legs-01` (default Mirror legs, 25) so the owner can
  try both boxes and the slider. Hidden click: tick each box once, press the slider's - and + once.
- **Said plainly.** The body keeps the donor's two-legged rhythm (hips, bob); only the front legs are retimed. Feet are
  placed by the existing ground fit for copied legs; whether they slide at some slider values is judged by picture, and
  the slider is there for the owner to settle it. Attack and Stand are not retimed.

### Step 5c. Mirror legs: a four-legged body stays level on a two-legged donor (one attempt)

**DROPPED by the owner, 26 Nov 13:56** ("a wolf and a footman is a RIDICLOUS pair"). Not built. Kept below as a record only.

**Why the wolf hunches** (Opus's reading of `legs-01`, Footman -> Timber Wolf). The wolf has no chest; its trunk is one
chain, `Bone Center > Bone Wolf Neck`, the back legs under the first and the front legs under the second. The transplant
pairs that chain with the Footman's `Bone_Root > Bone_Pelvis`, turns the wolf's level, forward-running chain onto the
Footman's downward one (front half pitches down), and hangs all four legs from the one pelvis (the front-leg copies take
the parent of the back legs' roots, `src/transplant-gait.js` line 94). The head follows the Footman's head on an upright
chest the wolf does not have.

**Design: two hips in tandem.** With Mirror legs a four-legged body is carried as two leg-carriers one behind the other:
the back legs keep the donor's pelvis, the front legs get a **copy of the donor's pelvis** (same keys, mirrored and shifted
by Leg timing exactly as the front-leg copies are), and the body between them keeps this model's own direction.

- **Scope.** Every change is behind one flag, `tandem` = Mirror legs ticked **and** `spareFrontLegs(...)` **and** this
  model has no chest part. With the flag off no line of the engine may behave differently.
- **Opus codes.**
  1. `src/transplant-gait.js`, `duplicateGaitChains`: for the mirrored front-leg copies, also copy their anchor (the donor
     joint the back legs' roots hang from) **once**, parented to that joint's own parent, with the same reflection and the
     same `shiftLoopKeys` shift; both front-leg copies hang from the copy. Return its id with the rig.
  2. `src/skeleton-transplant.js`, the socket block at 1238-1253 (today for `mountedPair || fourSupports`): run it for
     `tandem` too, so this model's back-leg carrier (the joint both back leg roots hang from) takes the donor's pelvis and
     its front-leg carrier takes the pelvis copy. Where the back-leg carrier is the first hips joint, do not let the third
     `link` (first hips joint to the donor's first hips joint) undo that.
  3. Same file, the trunk turn: under `tandem` the hips chain is **not** turned onto the donor's chord (the turn Opus found
     at 1888-1890) and no spine posture correction is set for the trunk joints (2101-2105 and its siblings); the two
     carriers keep the direction they have in this model's own stored pose. The head chain keeps its own direction too (no
     neck or head posture turn).
  4. Nothing in the window: no new box, no new text. Mirror legs simply behaves this way on such a body.
  5. A small reader for the checker, `scripts/xfer-scorecard/four-legs.mjs <pair id> <ticks> [--leg-timing n]`: per Walk
     moment, (a) the pitch of the body line (middle of the back-leg-carrier skin to middle of the front-leg-carrier skin)
     against the same line in the model's own Stand, in degrees; (b) the distance along the facing between the middle of
     the two front soles and the middle of the two back soles, as a share of that distance in the model's own Stand.
  6. Tests (fail first, on the `corpus-sd` Timber Wolf and Footman already used by `test/transplant-gait.test.js`): with
     Mirror legs the body-line pitch over Walk stays within 15 deg of the wolf's own Stand line (today it does not), and the
     front soles stay at least 0.6 of the own front-to-back distance ahead of the back soles; without Mirror legs the
     export equals today's.
- **The checker runs.**
  1. `regress.mjs --check --all` (suggester re-run): only `legs-01` differs (export, ticks unchanged). reasonable-45 with
     Use arms keeps the hash `1939f6eb...`. `--check`: 8 of 8.
  2. `four-legs.mjs legs-01` at Leg timing 0, 25, 50 and with no box (the "before" row).
  3. Pictures into `out/fable-plan/step-5c/`: `legs-01` Walk from the side (`--yaw 90 --n 8 --size 240`) at 0, 25, 50, and
     Stand and Attack once at 25; the hole reading for the three.
  4. The gait, skeleton-transplant and transplant-support test files, known failures named.
- **Accepted when** the side views show a level back with the head forward and the four feet under shoulders and hips, the
  pitch stays within 15 deg and the spread at 0.6 or more, no holes get worse, and the regression is as in 1. Fable reads
  the pictures.
- **If not after this one attempt:** revert the step 5c commit, keep step 5b as it is, rewrite nothing in the baseline,
  and the note to the owner carries decision 3's line. No second round without the owner.
- **Said plainly.** This was designed from reading, not from a trial: the engine's pairing of unpaired donor joints
  (`Bone_Root` then has no joint of the wolf) and the head's hang point may need a choice Fable could not foresee. Opus
  reports any such choice instead of improvising beyond the three changes above.

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

### Step 5b finding. Mirror legs retimes the front legs; the wolf still does not walk like a wolf

- **The foot table was the wrong ruler (Fable's request, not Opus's work).** A walk animation runs in place, so every
  planted foot travels along the ground: "ground travel" is stride, not sliding. And "sole lowest at" is unstable on a flat
  stance: the two back legs, whose keys are the same in every variant, read 0.39 / 0.86, 0.27 / 0.89 and 0.39 / 0.73.
  By design at 25 the landings are 0.14, 0.39, 0.61, 0.86; measured 0.20, 0.39, 0.70, 0.86. The timing does roughly what
  was specified.
- **What the side views show** (`out/fable-plan/step-5b/legs01-*-walk-side.png`): with or without the box the wolf is
  hunched nose-down with an arched back and its four feet bunched under it. No slider value makes that a four-legged walk.
  The cause is older than step 5b: a four-legged body takes an upright two-legged donor's trunk, and both leg pairs follow
  that donor's one pelvis.
- **Next: step 5c** (one engine attempt, specified after Opus read the trunk pairing). The experiment with the existing
  posture boxes is dropped: none of them touches this pairing.

### Step 6 fix. The roll test compares with the model's own grip (Fable's review of `e48baec7`)

Six pairs lose the Seat suggestion. By picture: reasonable-32, -38, -39 and -43 are right (the unseated weapon sits as in
the model's own animation; seated, the spear or lance runs through the mount or nearly vanishes). reasonable-10 shows no
visible difference either way. **reasonable-31 looks wrong:** seated, Thrall's hammer head stands as in his own pose;
unseated it lies turned across his head. The test measured the roll **between** the two results (87 deg) and assumed the
unseated one is the model's own grip; condition 1 never checked that.

- **Change** (`src/transplant-weapon-seat.js`, `src/xfer-suggest-toggles.js`, tests): a reader `rollFromOwn(own, weapon,
  mesh)`: fit the grip hand's skin (palm patch and the vertices bound to the arm's last joint) from the model's first
  Stand moment onto the same vertices of `mesh`; carry the model's own weapon through that fit; the roll about the shaft
  between that and the weapon as it sits in `mesh`, folded to 0-90. Then, for flat weapons (`flat >= 2`):
  condition 1 also needs `rollFromOwn(plain) < 45`; the roll reason becomes `rollFromOwn(seated) >= 45` (the measure
  between the two results is no longer used). `seatWithheld` takes the two numbers; the table gets two columns.
- **Expected.** reasonable-32 still withheld (plain near 0, seated near 85). reasonable-31 decided by its numbers; if the
  plain result is the turned one, Seat comes back. The slide pairs are untouched. Report the two rolls for every pair with
  `flat >= 2`. Same stop rule as step 6.
- **Checker.** `regress.mjs --check --all` (suggester re-run): list tick changes against the baseline; `--check` 8 of 8;
  pictures of any pair that changes again. After Fable's approval: `--write --all --only` the pairs whose ticks changed in
  step 6, from a clean tree.

### Step 7. Second hand on the weapon in the animations where the donor uses two hands (only after the owner has seen steps 1-6)

**Go (owner, 26 Nov 13:56). Coding brief; where it differs from the text below, this brief wins.**

- *Engine* (`src/transplant-weapon-seat.js`): `holdSupport` gets an option `perClip`. With it, the Stand precondition
  (`wanted.support`, line 704) is replaced by a test per animation: treated only when the donor's other palm is within
  `ON_SHAFT` of its weapon in at least 30% of that animation's sampled moments. Without the option nothing changes (the
  call inside `seatWeapon` stays as it is, so every Seat export is byte-identical). New export
  `secondHandOnWeapon(result, own, donor, rigB, rigA, donorMap, limbEntries, keep)`: reads both weapons with `readWeapon`,
  pairs items as `seatWeapon` does, skips an item whose bones the user keeps, calls `holdSupport(..., { perClip: true })`.
- *Call* (`src/skeleton-transplant.js`, right after the Seat block near 3287): when `fix.surfaceGrip` is ticked and Seat's
  own second hand did not act (`fixed.seatWeapon` has no `support`), run it and record `fixed.secondHand`. Nothing else in
  the engine. No baseline pair has Two-hand grip ticked, so no export changes until the suggester ticks it.
- *Reader* (same file): `secondHandShare(own, donor, mesh)`: over the moments where the donor's other palm is on its weapon,
  the share where the result's other palm is within 0.2 arm of its own weapon. (The scorecard's second-hand number only
  exists for donors two-handed in Stand, so it cannot be used.)
- *Suggester* (`src/xfer-suggest-toggles.js`): Two-hand grip leaves the first stage's candidates for this purpose and is
  decided in one place, after the Seat veto: built with and without it on the final ticks; suggested only when the donor
  passes the 30% test in some animation, `secondHandShare` rises by 0.1 or more, and `ruleChange` reports nothing lost
  (jitter, near-twin, holes included). Its old Stand-only candidate rule (lines 127-130, 146) stays for its old behaviour.
- *Stop rules.* (1) If the ticks of any of the eight 9-10 pairs change (new-05 and new-02 broke in round 1), stop and
  report. (2) If on any pair that gains the tick the jitter rule counts more animations than without it, or a picture
  shows the elbow snapping or locked straight, the step is reverted and listed as a known limit. No tuning of `ON_SHAFT`,
  the 30% or the easing to get past either.
- *Test (fails first):* Footman Leader -> Elf Death Knight (`xfer-r08-*` fixtures) with Two-hand grip: `secondHandShare`
  in Attack - 1 at least 0.8 (without the tick it is near 0), and the right palm's readings unchanged. `holdSupport`
  without `perClip` on a Stand-one-handed donor still returns null.
- *Checker:* `regress.mjs --check --all` (suggester re-run): list of pairs that gain Two-hand grip, no other difference;
  `--check` 8 of 8; reasonable-45 hash unchanged. For each pair that gains it: `score.mjs --only` with and without the tick
  (jitter, near-twin, weapon, holes), `secondHandShare` per animation, and pictures (every animation where the donor is
  two-handed, `--n 8 --size 240`, with and without, plus one close `--size 600 --n 2` of Attack). The three related test
  files with the known failures named.

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

**Split (owner, 26 Nov: Fable designs and reads; Opus codes; a cheaper agent runs).** Rows of the sheet: decision 8.

- *The sheet must load (it showed the owner an error once, a broken "answers" path).* Opus writes
  `scripts/xfer-scorecard/sheet-smoke.cjs`; the checker runs it and its output goes in the report:
  1. Without the app: `parseCases` on `cases-reasonable.json` passes; `answers` is an absolute path whose folder exists;
     the answers file (if present) parses; every model file of every row exists; every control row has seeded ticks.
  2. In the packaged app, hidden (`scripts/hidden-run.ps1`), started with **the launcher's own command line** read from
     `GRADE - XFER reasonable.cmd`: the sheet appears, no page error, no problem text; every row is opened in turn and its
     Donor, Own and After views finish loading.
  3. Writing: the same run on a copy of the cases file whose `answers` is `reasonable\answers-smoke.json` (same folder as
     the real answers): one repair box is ticked and unticked, the file appears and parses, then it is deleted. The owner's
     real answers file is never written by the check.

- *Opus codes:* the sheet file `cases-reasonable.json` from `pairs-reasonable.json` with the existing sheet maker
  (`scripts/xfer-scorecard/make-final-sheet.cjs`, pointed at the pair list): rows = every pair whose export or default
  ticks changed since the final sheet (reasonable-08, -45, -38, -40, -46, new-26, the Seat pairs of step 6) + the eight
  9-10 pairs as controls + `legs-01`; every donated animation; saved `legTiming` on `legs-01`. The launcher
  `TestBuilds\_START HERE\GRADE - XFER reasonable.cmd`, the named model `TestBuilds\test-models\TEST XFER 36.mdx`, the
  `docs/agent-tasks/README.md` row. Nothing else.
- *Checker runs:* `pnpm run test:source` once (compare with `.github/known-test-failures.txt` and the failures named in
  the step reports); `pnpm run build`; package into `TestBuilds\transfer-xl-35` (app closed, `profile` kept, TEMP and TMP
  on D:); the hidden click-through below with screenshots; one picture per sheet row at its default ticks (Stand, Walk,
  Attack, 240 px, at most three rows per PNG) for Fable to read before the owner opens the sheet.
- *Fable:* reads the pictures and the click report; writes the short note for the owner (what changed, what is still
  wrong: Stand - 2 sword through the body, Attack second hand, the wolf's posture).

- `pnpm run test:source` once; fix only what this work broke; rerun only failed and related files.
- `pnpm run build`, package into `TestBuilds\transfer-xl-35` as the brief describes (app closed, `profile` kept, TEMP on D:).
- Hidden click-through on the exact package (`scripts/hidden-run.ps1`, separate hidden desktop): open the Transfer window on
  a named model `TestBuilds\test-models\TEST XFER 36.mdx`, tick and untick Seat weapon and Two-hand grip once
  each: no crash, no page error. Step 2b's two checks: the repair row has no Seam fix box, and the old final sheet
  (`cases-final.json`) opens with no error.
- Sheet `cases-reasonable.json` from `pairs-reasonable.json`: the pairs whose export or default ticks changed since the
  final sheet, plus the eight 9-10 pairs as controls; every donated animation; the reviews show donor, own, before and
  after side by side. Fable reads the pictures of every row first and removes nothing silently: a row that looks bad is
  fixed or listed as a known limit before the owner opens the sheet.
- Add the row for this plan to `docs/agent-tasks/README.md`; keep the step reports in [xfer-toggles.md](xfer-toggles.md).

## After the reasonable sheet (owner's grades, 26 Nov, build `e91f7b10`)

Fifteen rows: nine 10s, three 9s, one 8, two 5s; every 9-10 control held. Three faults, three steps, in this order.
Answers: `TestBuilds\transfer-xl-35\reasonable\answers.json`.

**Found while reading the answers:** the sheet he graded did not carry step 7. reasonable-08's saved `suggested` has no
Two-hand grip, his screenshot shows no such box, and new-02's `suggested` is empty, though the cases file on disk now
lists Two-hand grip for both. So the second-hand step has not been seen by the owner yet; the small sheet below shows it.
Checker: say which cases file and which build the graded sheet came from.

### Step 9. The weapon stays in the hand as far as the donor's does (reasonable-08, Attack - 3)

**Measured (checker, `out/fable-plan/step-9-10-pre/`), and the spec amended by it; where the text below differs, this wins.**
reasonable-08 at his ticks, right hand, result gap against the donor's: Attack - 3 0.50 vs 0.11, Attack - 1 0.34 vs 0.03,
Stand - 2 0.50 vs 0.18; every other animation within 0.03. Over all pairs the largest excesses are mostly in Death and
Spell, where the donor itself throws or drops the weapon (new-02 Death: donor 3.27), and on pairs with Seat ticked
(new-08 Spell 2.32). So:

- *Engine, `keepInHand`:* acts only while the donor holds its weapon: full strength where the donor's own gap is 0.15 arm
  or less, fading to nothing at 0.30 (the same on/off fade `holdSupport` uses), so a thrown, dropped or far-belted weapon
  is left alone. Death, Decay, Dissipate and Portrait are skipped. Never with Seat ticked.
- *Suggestion (final, after the filtered table; the rule first written here hit three controls and two more 10s):*
  the box is suggested only for the fault the owner named, a weapon that **leaves the hand during an attack**:
  1. Attack animations only. Stand and Walk are never tested: a steady offset there is how the model holds its weapon,
     and he graded such pairs 10 (new-02 Stand, new-05 Walk, reasonable-32 Walk - 2).
  2. Excess is measured against the same allowance the engine uses, the larger of the donor's gap and **the model's own
     Stand grip gap**, plus 0.03 (reasonable-31's constant 0.20 is its own grip sitting further out: no excess).
  3. The weapon starts the animation in the hand (first moment within the allowance) and later, over the moments where
     the donor's gap is 0.15 or less, at least a tenth of them exceed the allowance by 0.15 or more.
  4. The box brings that excess down by 0.1 or more and `ruleChange` reports nothing lost. Never when Seat is suggested.
  Put the test in one exported pure function (`leavesHand(rows)` on per-moment `{ donorGap, resultGap }` plus the own
  grip gap) so it is tested on numbers.
- *If the stop rule below still fires* (a control or a sheet-10 gains the box): no further rule is tried. The box ships
  as a plain toggle, never suggested, and reasonable-08's row on the small sheet opens with it ticked (seeded) so the
  owner sees it; the note to him says the box is his to tick.
- *Stop rule added:* the defaults of the 9-10 pairs stay as they are. If the box becomes suggested on any of the eight
  controls or on any pair graded 10 on the reasonable sheet, do not merge: report the pair and its numbers.
- *Checker, before Opus codes:* `pre910.mjs` again with that filter (Stand, Walk, Attack; donor gap 0.15 or less): per
  pair the largest excess and the share of moments at 0.15 or more. The pairs that would qualify are named before any
  code is written.

Owner: "Weapon leaves hand ... but only in 1 anim". In his screenshot (Attack - 3, about a quarter in) the donor holds its
sword at head height with the hilt in its hands; the result's sword sits at that height while its fists are at the chest.
The model's weapon rides the donor's weapon bone, which the donor moves against its own hand; on other arms that offset
lands elsewhere.

- **Check first (checker, no code):** for reasonable-08 at `skinLandmarks,trackWindow,keepTorso`, per animation and for
  16 moments: the donor's grip-palm gap to its weapon and the result's, in arm lengths
  (`out/fable-review/weapon.mjs` prints both); then the same "largest result gap minus donor gap" for every pair of the
  list at its ticks. Step 9's thresholds are confirmed against that table before Opus codes.
- **Opus codes.**
  1. `src/transplant-weapon-seat.js`, new export `keepInHand(result, own, donor, rigB, rigA, donorMap, limbEntries, keep)`:
     reads both weapons (`readWeapon`), pairs items as `seatWeapon` does, finds the one result bone that carries the
     model's weapon (all its vertices on one bone, else return null). Per donated animation (Death, Decay, Dissipate,
     Portrait skipped, as `holdSupport`), on a 33 ms grid plus the carrier's own keys: `allowed` = the larger of the donor's
     grip-palm gap at that moment and the model's own grip gap in its Stand, plus 0.03 arm; where the result's gap is
     larger, the weapon is moved toward the palm by the excess (along the line from its nearest surface point to the
     palm), eased over neighbouring moments exactly as `holdSupport` eases (same `SPAN`), and written as Translation keys
     on the carrier with `rewriteTrack(..., 'Translation')` (the shift taken into the carrier's parent frame). Where the
     donor lets go (its own gap is large, the belted sword of Stand - 2) the weapon may leave as far as the donor's.
     Returns `{ moments, gapBefore, gapAfter }`.
  2. `src/skeleton-transplant.js`, after the Seat block and **before** the second-hand step (so the other hand reaches
     for the moved weapon): run it when the new key is ticked and Seat is not (a seated weapon is on the hand already).
  3. `src/transplant-autofix.js`: key `gripInHand` after `useArms`; label `['Weapon in hand', "Keeps the weapon no
     further from the hand than the donor's weapon is from the donor's hand."]`; translations in `de`, `es`, `fr`, `ru`,
     `zh`.
  4. `src/xfer-suggest-toggles.js`: decided in one place, before the Two-hand grip decision: built with and without on
     the final ticks; suggested only when without it the result's gap exceeds the donor's by 0.15 arm or more in at
     least a tenth of some animation's moments, with it that excess falls by 0.1 or more, and `ruleChange` reports nothing
     lost. Never a first-stage candidate, never flipped by the six-rule loop.
- **Scope.** A new box: every export without it is byte-identical. The eight 9-10 pairs: `--check` 8 of 8 at their graded
  ticks; if the box becomes suggested on one of them, report it (the row opens at his ticks, as new-02 did).
- **Test (fails first).** `xfer-r08-*` fixtures at his ticks: in Attack - 3 the largest "result gap minus donor gap" is
  0.05 or less with the box and what the check measured (well above 0.15) without; Stand - 2 still lets the sword leave
  the hand (gap mid-clip above 0.3 with the box).
- **Stop rule.** If a pair that gains the box counts more jitter animations than without it, or a picture shows the weapon
  snapping to the hand, revert and list it as a known limit.
- **Checker.** `regress.mjs --check --all` (suggester re-run): pairs that gain the box, nothing else; `--check` 8 of 8.
  For reasonable-08: the gap table again with the box, `score.mjs --only` both ways, pictures of Attack - 3
  (`--n 8 --size 240`, and one close `--size 600 --n 2` at the quarter mark) with and without, and Stand - 2.

### Step 10. A legless flyer on a winged donor keeps the donor's steadiness (reasonable-40, -43)

**Cause confirmed by measurement:** both pairs run in `soles` mode; the body joint's vertical range against the donor's is
2.2x in Stand and 4.4x in Walk on reasonable-40, 4.8x and 9.2x on reasonable-43. The spec below stands unchanged.

**Built `cf7ce6a7`: approved with one fix.** The bounce that came from wingtips and dangling feet is gone (the ratio of the
result's body range to the donor's is now the same in every animation), but it is 0.71 on reasonable-40 and 1.70 on
reasonable-43 as shares of each model's height: the rise is scaled by the leg-travel ratio, which means nothing between two
bodies without paired legs. The owner's rule of 22 Nov is "height above ground ... as a ratio of body size". **Fix:** in
the new case only (legless model, winged donor) the donor body's rise is scaled by the two models' standing heights
(`visibleStandHeight(model) / visibleStandHeight(D)`, the ratio Jump height already uses) instead of `travel`; the old
footless-donor case keeps `travel`, so nothing else changes. Expected: both ratios 1.0, only these two pairs differ.
Open until the checker has compared scores before and after at the same ticks: reasonable-40 reads 13 stretched edges
(worst 3.45x in Attack, at Mesh13 / Mesh14 / Fur) and reasonable-43 a near-twin miss in Walk - 2; if either is new with
this step, it is reported before the baseline is written.

Owner: "jumps up and down while the donor remains stable", "model bobs up and down.... happened before."

- **Likely cause (from reading `solesDown`, `src/skeleton-transplant.js` 3420-3492; to be confirmed by the check).** Both
  models (bat mount, dragonhawk rider) have no legs; both donors (gryphon riders) have legs and wings. Legs do not pair,
  so the height is set per moment by "soles down": this model's "sole" is then the lowest 2% of its whole living body,
  which on a flyer is a wingtip or the tail, and it is held against the donor's lowest **foot**, which on a flying gryphon
  dangles and tucks. Both move with every wingbeat while the donor's body does not: the body is pushed up and down.
  The code already says "a wingtip ... is not a supporting foot" and follows the donor **body's** rise instead, but only
  when the donor has no feet at all.
- **Check first (checker, no code):** for reasonable-40 and -43 at their ticks: `report.counts.ground` (expected
  `soles`); per animation the vertical range of the donor's body joint and of the same joint in the result
  (`report.donorNodes[rigA.body]`), as shares of each model's height. Confirmed when the result's range is well above the
  donor's.
- **Opus codes** (one condition, `solesDown`): the hover branch (today `!feetA.length && this model has no legs`) is also
  taken when this model has no legs **and the donor has a wing pair** (`rigA.parts.wingL && rigA.parts.wingR`): the body
  follows the donor body's rise from its Stand with one fixed clearance, and returns `hover`. Nothing else.
- **Scope.** Not a box: the behaviour it replaces is a fault with no use (a wingtip as a sole), and the condition is
  narrow. Of the list only reasonable-40 and -43 qualify by their rig readings (new-08, a 10, has no legs and wings but
  its donor has no wings: untouched). `regress.mjs --check --all`: only those two differ; `--check` 8 of 8. If any other
  pair differs, stop and report.
- **Test (fails first).** Gryphon Rider -> Dragonhawk Rider (new named fixtures from the pair list): `report.counts.ground`
  is `hover`; over Stand and Walk the result body joint's vertical range is at most 1.2 times the donor body's range
  times the travel ratio plus 1% of the model's height (today it is not).
- **Checker.** The range table again after the change; pictures of both pairs, Stand and Walk from the side
  (`--yaw 90 --n 8 --size 240`), before and after; the hole reading; the regression as above.

### Step 11. Mirror is a checkbox in the repair row (new-26, reasonable-10)

**Done: `7983a463`, approved by diff.** Checkbox first in the row in the sheet and the Transfer window, the caption
button's own label and tooltip, the answer keeps `mirror`, no engine or suggester change. Still to run: the hidden
check in the packaged app (below).

Owner: "Why is he mirrored?... there is no checkbox allowing me to cancel this, its good but I would like this to be
optional." "again mirror is defaulted for me."

- **What is there.** The Transfer window has a Mirror button on the donor's caption. The grading sheet has nothing: each
  row carries a fixed `mirror` in its options (true on new-26, reasonable-10, reasonable-40).
- **Opus codes.**
  1. `app/TransplantToggles.jsx`: props `mirror`, `mirrorSuggested`, `onMirror`. When `onMirror` is given, a checkbox
     **first in the row**, `data-repair="mirror"`, label `Mirror`, tooltip the caption button's existing sentence ("Swap
     left and right for this whole donor. On by itself when the two models hold their weapon in opposite hands."), with
     the suggested mark when `mirrorSuggested`. Both strings are already in all five catalogs: no new text. Shown
     whenever the row is shown, also when no repair box applies.
  2. Sheet (`app/TransferPicks.jsx`, `src/transfer-picks.js`): the row's own `options.mirror` is the suggestion; the
     answer may hold `mirror` (true or false), saved by `withGrade` beside `toggles`; the live request builds with the
     answer's value when present and puts it in its key. Old answers without the field read as the row's value.
  3. Transfer window (`app/Transfer.jsx`): the same checkbox, bound to the state the caption button already uses
     (`shownMirror`, `toggleMirror`); suggested mark when the automatic choice is mirrored. The caption button stays
     (it is also the retargeting control and has a hotkey); the two always show the same state.
  4. The engine and the suggester are not touched: Mirror is an option, not a repair key.
- **Scope.** No export changes at any ticks; `--check --all` and `--check` identical.
- **Tests (fail first).** `test/transfer-picks.test.js`: `withGrade` keeps `mirror: false` on a row whose options say
  true, and a second pair's answer is untouched; an old answer without the field reads as the row's value.
- **Checker.** Regression as above. In the packaged app (hidden): on the new-26 row the Mirror box is first, ticked and
  marked suggested; unticking it rebuilds the After view with no error and writes `mirror: false` (on the
  `answers-smoke` copy); in the Transfer window the box and the caption button change together. A screenshot of the row.

### Small sheet for the owner's next look

- **Rows:** reasonable-08 (Weapon in hand and Two-hand grip, both new to him), reasonable-40 and -43 (steadiness), new-26
  and reasonable-10 (Mirror box); controls reasonable-05, random-10, new-02 at the ticks he graded (new-02 shows Two-hand
  grip as suggested). Every donated animation. Made with `make-final-sheet.cjs` as before; answers in a new folder.
- **`sheet-smoke.cjs`:** the wait per row becomes a parameter (`--row-timeout`, default 180 s) and the check waits for the
  After view to finish instead of a fixed time; reasonable-43 timed out at the old wait. A row that does not finish in
  time is a failure with the row's id, not a skip.

## Decisions made without the owner (26 Nov, on his instruction)

1. **reasonable-31 (Orc Warg Rider -> Thrall) stays without Seat weapon.** Measured against Thrall's own grip the unseated
   hammer is turned 0 deg and the seated one 89 deg; what looked turned in one Stand picture is his hand's pose under the
   donor, not the grip. The owner graded this pair 10 in the reasonable-50 round, before Seat existed, so the unseated
   version is the one he accepted. Same rule and same reading as reasonable-32, which he rejected with Seat.
2. **The eight control rows open at the ticks he graded.** The sheet maker writes those ticks into the answers file for the
   control rows (new-01 opens with Rest pose fit and Hanging parts, as he graded it, not with the suggester's Hanging parts
   alone). The suggestion marks stay what the suggester says.
3. **The wolf's posture gets one engine attempt (step 5c).** If the pictures after that attempt do not show a level back and
   four feet under the shoulders and hips, step 5c is reverted and the sheet goes out with this line in the note to the
   owner: "Mirror legs: the timing slider works, but a four-legged model on a two-legged donor still hunches (the wolf).
   Keeping its body level needs more engine work and is not in this build."
4. **The Mirror legs experiment with the existing posture boxes is dropped.** Opus's reading shows no box touches the
   pairing that causes the hunch, so the renders would cost time for nothing.

After the owner's verdict of 13:56 (Use arms accepted; stop perfecting mismatched pairs; fix weapons in the wrong place,
floating, open seams and deformed looks on pairs whose bodies are alike):

5. **Decision 3 is void:** step 5c is dropped by the owner, nothing to revert, no fallback line needed.
6. **Use arms is the suggested box wherever it applies; Mirror legs is never suggested.** The owner tried Footman -> Timber
   Wolf and said "the results with use arms are great"; the lean rule would have suggested Mirror legs there, which hunches.
   `frontLegPick` returns `useArms` whenever the model has spare front legs, no arms, and the donor has arms. Mirror legs
   and its slider stay as a box the user can tick. Only `legs-01` changes ticks.
7. **Step 7 goes ahead** (second hand on the weapon): it is one of his four faults (weapon in the wrong place) on
   like-bodied pairs, and his most repeated weapon comment. Brief under step 7.
8. **The sheet shows like-bodied pairs only.** Dropped from the sheet (they stay in the regression): `legs-01` (he has
   tried it and given his verdict), reasonable-38 (two-legged mount to four-legged mount), reasonable-46 (four-legged
   dragon to two-legged wyvern), and the controls new-01 and new-08 (unlike bodies; their exports are byte-identical to
   what he graded, which the regression check proves without his time). Rows: reasonable-08, -45 (his Use arms example),
   -40, new-26, the Seat pairs reasonable-10, -31, -32, -39, -43, any pair step 7 changes, and the controls reasonable-05,
   -29, random-10, random-21, new-05, new-02. Every donated animation.
9. **The controls open at the ticks he graded** (decision 2 stands), for the six controls left on the sheet.
10. **Step 7 is merged, and new-02 gains the Two-hand grip suggestion.** Stop rule 1 held it for a look; the look says
    merge. On new-02 (French Rifleman -> Polish Partisan Sapper, graded 9 with no box) the second hand was on the rifle in
    none of the donor's two-handed moments; with the box it is in 0.54-0.61 of them. In the pictures the supporting hand
    ends on the rifle instead of below it at the end of the aim, the elbow stays bent, and the jitter and near-twin
    readings are the same with and without. Nothing he graded changes: the export at his graded ticks is byte-identical
    (8 of 8), and on the sheet the row opens at his ticks, with the box marked as suggested for him to try. No rule that
    is not a per-pair hack keeps reasonable-08's gain (0.50 to 1.00 in Attack - 1) and leaves new-02 out, since new-02
    gains more. Said plainly: stills cannot show a twitch between frames; the jitter rule says there is none.
11. **After the merge:** the baseline takes reasonable-08, new-02 and legs-01 (suggested ticks only); the sheet is made
    again from the merged code (reasonable-08 with Two-hand grip, new-02 at his graded ticks), and the sheet check runs
    again on the final package. The 15 rows and the check's split (launcher line and first row on the real answers file,
    read only; every row and the write test on the `answers-smoke` copy) are accepted.
12. **Step 10 is an engine change, not a box.** Holding a wingtip against a dangling foot is a fault with no use; the
    condition (this model has no legs, the donor has wings) touches two pairs of the list, both graded 5, and no 9-10 pair.
13. **Step 9 is a new box (Weapon in hand)**, per toggles-not-gates: it moves a weapon, so it stays the user's choice and
    is suggested only where the weapon leaves the hand clearly further than the donor's.
14. **Mirror gets a box in the row and the caption button stays.** The owner asked for the box; the button also serves
    retargeting and its hotkey. Two controls, one state; if he wants the button gone in transplant mode it is one line.
15. **Checks come before code on steps 9 and 10:** the causes were read from the code and one screenshot, not measured.
16. **Weapon in hand never changes a 9-10 pair's default.** The owner's instruction after new-02; made a stop rule of
    step 9 rather than a per-pair exception, with the suggestion narrowed to the animations and moments where the donor
    really holds its weapon.
17. **Step 7's broken bow test is fixed before anything else merges** ("Archer bow grip follows actual shaft-contact
    palms"). Expected fix: the second-hand step does not run where the bow grip fit already placed the hands
    (`bowHands`). Seat exports and reasonable-08's gain must stay as they are; the checker re-runs the regression after it.
18. **Weapon in hand is suggested only for a weapon that leaves the hand during an attack** (it starts in the hand, the
    donor keeps holding, the result does not), measured against the model's own grip. The first rule would have changed
    the defaults of new-02, new-05, new-08 and two more 10s on steady Stand and Walk offsets he had accepted. If even
    the narrow rule touches a control or a 10, the box is never suggested and only seeded on reasonable-08's sheet row.
    Bow regression of step 7: fixed in `78ecbfa3` (second-hand step skipped where the bow grip fit acted).




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
  (reasonable-05, reasonable-29, new-05) and added Rest pose fit himself on new-01. So neither went on the
  owner-rejected list (which is empty after step 2b). If he means them too, they are one line each.
- **reasonable-38 has small openings without Seam fix** (47 of 807 welded pairs, 2.4% of height). Either real small gaps
  between the rider's parts or pieces that are meant to separate in an animation the own model never plays. Step 3 reports
  it; I have not looked at where they are.
- **random-04's "weapon"** is a 6-vertex item 0.5 arm lengths long held 0.55 arm from the palm in the model's own
  animations: probably not a weapon at all. The pair is out of the set; the misreading in `readWeapon` is not investigated.
- **The scorecard's shaft angle** read 45 deg on reasonable-38 with Seat while the shaft matches the donor's within 1 deg
  in world space (`plane.mjs`). One of the two readings is wrong; I did not find which. Step 6 does not rely on it.
- **reasonable-08, Stand - 2: the belted sword lies through the body.** The donor's sword bone hangs from the donor's
  **hand** and is moved to the belt by keys relative to that hand. The Elf Death Knight's fists end up at shoulder height
  (the donor folds its arms at the chest), so the sword hangs from there: hilt by the fists, blade through the torso to the
  hip. Step 4 made it follow the donor's sword at all; placing a weapon that has left the hand against the body it rests on
  (the hips) instead of against the hand is a separate engine change, not in this plan. The owner will see this on the sheet.
- **reasonable-28: half of Furion's left hand is carried as a weapon piece** (found by the hole rule in step 3, seen in the
  picture). Not fixed by any step here. Find held weapon closes it but turns the stance round; the owner has not seen
  either version since the staff-foot fix.
- **Grades are noisy** (owner, 25 Nov). The 9-10 pairs are held byte-identical, which is safe but also means nothing in
  this plan can improve them.

## The owner's answer on front legs

Asked: front legs as arms for every such pairing, or only for beasts? Answered 26 Nov: two checkboxes, Mirror legs (with a
slider) and Use arms. Step 5b.

## The owner's answer on Seam fix

Asked: keep the checkbox (never ticked) or remove it from the window? Answered 26 Nov: "Remove it". Step 2b.

## Owner, 26 Nov 13:56 (after trying Footman -> Timber Wolf in the app)

"the results with use arms are great." "Waste less time trying to get imperfect pairs perfect - e.g a wolf and a footman is
a RIDICLOUS pair, this is PRETTY FUCKING GOOD for a pair like that." He does not like: weapons in wrong places, floating,
seams open, deformed looks. General rule (the orcs are one example only): a good pair has bodies alike enough to look right, with different animations (e.g. Footman <-> HerrDave's orcs).
Knight <-> Footman is ridiculous (no horse). Decision: the wolf Mirror-legs posture fix is dropped; Use arms is accepted
as is. Remaining effort goes to similar-body pairs and those four faults. The Fable run was stopped by the owner at this
point (last commit 5336de33); README.md and make-final-sheet.cjs edits were left uncommitted.
