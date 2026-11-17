# XFER both ways: the campaign (retargeting and skeleton transplant)

Status: opened 17 Nov 2026 (director: Claude Fable). Stage 1 built the same day (see Stage 1).
Stages 2 to 5 are a plan, not yet agreed line by line with the owner. Local only, branch
`claude/transfer-xl`, worktree `.claude/worktrees/transfer-xl`. Earlier history of the window and
engine: [transfer-xl.md](transfer-xl.md).

## Owner intent (17 Nov 2026, quoted)

- "XFER needs to offer both. Actually, what you built so far is nice - But it cannot tackle
  everything."
- "XFER, has done only HALF of the job I thought it was doing.... it was meant to transplant a new
  skeleton"
- "We have the pillars of identifiying. We cannot use this to re-rig? as in, transplant bones and
  animations? ... poses can be pretty much standarized, across of all native WC3 plus the entire
  catalogue of lowpolyworks - can we not, with the pillars of identification - pose, names, shapes,
  animations etc - tailor a new skeleton with a HIGH possiblity of success?"
- "Do not go small Fable... I will hammer this over a few sessions, finish whatever fable power I
  have but direct smart. We will put a lot of credits into xfer before release. Make it the best
  freaking WC3 transfer tool to ever exist."

Both = **retargeting** (exists: the open model keeps its bones, the donor's movement is written
onto them, part by part) and **transplant** (new: the open model's mesh on the donor's skeleton,
with the donor's animations). Standing rules stay: one way of doing things, FX-style window, no
flavour text, no model-specific or name-only rules, statistics before verdicts, the owner judges
looks by eye on live views.

## The field, measured (17 Nov 2026)

Probes in `out/transfer-probe/` (`rest-census.mjs`, `rest-census-split.mjs`, `above-joints.mjs`,
`trunk-census.mjs`), over `D:\Claude\MDLxL-TestModels` and `D:\Claude\lpw-main\dist\models`:
1,200 different models.

- How Transfer reads their bodies: 565 two arms and two legs (2 of them with wings), 310 no legs,
  166 four or more legs, 92 two creatures, 57 other, 10 no rig.
- Limbs of the 565: arms have 3 joints in 919 of 1,130 (4 joints 148, 2 joints 51, 5 joints 10);
  legs 3 joints in 982 (4 joints 124, 5 or more 22).
- **Rest (geoset) pose, the owner's "poses can be pretty much standarized":** each limb part
  against the average direction of all of them: half of all limbs within 8 to 13 degrees, and
  within 30 degrees: upper arm 91%, forearm 83%, upper leg 81%, lower leg 85%. True for most, with
  a tail (the upper-leg figure counts hock chains as "upper leg").
- **Joints above a limb's handle chain** (POSE's chain is the last three joints): 287 on arms,
  263 on legs. Named collar pieces are short (144 of 146 under .45 of the limb below); named upper
  arms and thighs are long (101 of 120 at .45 or more; the short ones are many-jointed spider
  legs). Long joints named "Hip" are thighs.
- **Hips of more than one joint:** the piece between their joints (root to pelvis) points up 144
  times, sideways 369, down 156 of 669: a rigging habit, not a body direction, at every length.
  Chest pieces point up (44 of 47). Neck-to-head pieces mostly forward.

## The standard recipe, and where Transfer stood

Retargeting elsewhere pairs bones by role (shoulder, elbow, hand; hip, knee, foot), compares both
models in one rest pose, then corrects contacts (feet, hands on a weapon). Transfer paired limb
joints by their place along the limb's length, lined poses up in the Stand animation, and lined
hips up by the gap between their own joints. The owner met the first on 17 Nov ("he is not taking
the right skeleton - how can he pose?").

## Stages

1. **Who is who (built, see below).** One pairing of bones by role, in the shared recogniser
   where it is recognition and in the engine where it is transfer. Both ways need it.
2. **Stance from the rest pose (retargeting).** Pose today means "own Stand plus their movement"
   (Mine) or "their directions" (Theirs). Missing: the donor's stance carried over as its turn
   from the rest pose, for the trunk as well (the Tauren's hunch), with contacts kept (feet on
   the ground, both hands on a weapon when the donor's arms allow it). Owner decides how it
   shows in the window (a third stop on Pose, or what Theirs becomes).
3. **Transplant (new mode).** The open model's mesh on the donor's skeleton fitted into the
   model's own joints; every donor animation arrives at once. Needs: the stage 1 pairing; rules
   for joints only one side has (the Tauren's hock, a collar piece); the model's own extras
   (weapon, plates, cloth: Transfer's "own features") kept on their bones and hung on the new
   skeleton; sizes (move keys scaled); a new file or tab, never over the open model. Open product
   questions for the owner before a contract: what happens to the model's own animations; whether
   attachments, emitters and events move over; where the result goes.
4. **Gates.** A fixed set of pairs the owner knows (Kurgan and Tauren; Footman and Grunt; Nurgle
   warrior and Tauren attack; the riders), shown as live views on a pick sheet, plus the numbers
   below run over the whole collection after every engine change.
5. **One window, both ways.** FX layout, minimal. Concept with the owner before any code.

## Stage 1: bones pair by role (built 17 Nov 2026)

What changed in code:

- `src/pose-recognition.js`: `poseLimbStart(points, names, top, end, kind)`: where a limb itself
  starts among the joints that lead to it. A joint above the handle chain is part of the limb
  (a thigh above a hock chain, an upper arm) when two of three clues agree with a score of 2 or
  more: its length against the limb below (.45 or more: +2, else -2), how it lies along the limb
  (within 35 degrees: +1, over 60: -1), its name (upper-arm or thigh word +1, collar or shoulder
  word -1; `nameLimbTop` in `src/rig-names.js`). Otherwise it stays above the limb, as before.
- `src/anim-transfer.js`, `limbPairing` (arms and legs whose handle chain is known on both
  models; everything else pairs by distance as before): girdle pairs with girdle, and a girdle
  piece without a counterpart takes no turn; the limb's first joint pairs with the donor limb's
  first, end with end, and bend with bend where the handle chain is the whole limb on both; with
  unequal joint counts the pairing whose stretches point most alike in the rest pose wins. A
  joint paired with several donor joints follows the donor's line across them (the first joint's
  turn, then the swing that brings that line to where the donor's joints put it). A limb that
  ends in an attachment keeps taking the donor's last joint's turn on its last joint, as before.
- Hips are no longer lined up by the direction between their own joints (see the field above):
  at any Pose they keep their own stance, as a one-joint hips part always did.
- The weapon floor guard (`smoothLift`) starts its lift as early as the 400 degrees a second
  limit needs to meet a deep dip, and is not blurred back below it there. Needed because the
  corrected arm made the Kurgan's hammer dip for one sample in the Grunt's attack (9.8 under the
  floor, test N3); nothing else in the baseline changed with it.

Proofs (all on the final code; probes and outputs in `out/transfer-probe/`):

- The owner's pair, `pose-fair.mjs` (Kurgan taking the Tauren's `Stand -1`, Pose = Theirs, the
  two placing switches off): collar, shoulder piece, upper arm, forearm 2 to 4 degrees from the
  Tauren's; thigh 0; lower leg 0 to 1 (it follows the Tauren's knee-to-hoof line). Before: upper
  arms 121 and 79 degrees off. With the switches on (as the window starts) the legs stay planted
  (thigh 22 and 25, lower leg 12 and 14) and the other hand stays on the hammer.
- The whole collection, `pairing-sweep.mjs`: see "Collection numbers" below.
- `node --test test/anim-transfer.test.js`: 52 pass (49 + 3 new, R12). Fail first, on the
  committed source: "bones pair by role" fails with `armL: the upper arm is 92 degrees from the
  Tauren's upper arm`; "hips keep their stance" fails with `hips: Bone_Root is turned 178
  degrees`; "where a limb starts" has no function to call.
- `baseline.mjs i`, `baseline-compare.mjs d i`: 32 trials, 24 identical, 8 differ, each traced:
  `tauren`, `kurgan`, `kurganwalk`, `nurgle`, `kurganArm`, `kurganArmNoGrip`, `kurganNoClear`
  (pairs with unequal joint counts: the Tauren's four-joint limbs, the Kurgan's five-joint arms)
  and `ogreLegs1` (the one trial with Pose = Theirs on hips of two joints).
- `riders-gate.mjs`: 95 built, 5 skipped, 1 flagged (the same Kurgan Walk row). Seat, shin, lean
  and rise are unchanged in all 100 rows; the "arms" figure changed in 37 rows (donor riders with
  a shoulder piece, and the Kurgan as receiver), which is the pairing change itself.
- `node --test test/bone-namer*.test.js test/pose*.test.js test/transfer-window.test.js
  test/rig-names.test.js`: 233 tests, 230 pass, 0 fail, 3 skipped (the same three).
- Robustness: 561 bodies times 3 donors built, 0 threw, 0 problem lines, 0 non-finite keys.

Collection numbers (561 two-arm two-leg bodies, whole body at Pose = Theirs, placing switches
off; share of limb parts within 10 degrees of the donor part):

| Donor (animation) | Part | Before | After |
| --- | --- | --- | --- |
| Tauren (Stand -1), four-joint limbs | upper arm | 11% | 97% |
| | forearm | 53% | 99% |
| Grunt (Attack - 1), three-joint limbs | upper arm | 94% | 95% |
| | forearm | 96% | 97% |
| | upper leg | 90% | 92% |
| | lower leg | 91% | 100% |
| Ghoul (Walk) | upper arm | 86% | 89% |
| | forearm | 90% | 90% |
| | upper leg | 89% | 91% |
| | lower leg | 93% | 97% |

Nothing got worse. The Tauren's legs are left out of the table: this sweep reads a hoofed donor's
leg by its hock chain, so its figure (8% and 11%) says nothing either way; on the owner's pair the
fair measure is 0 to 1 degrees. Most of the Tauren's forearm gain is the hips rule (bodies no longer
turned over), most of its upper-arm gain the pairing.

Not done in stage 1: the trunk does not take the donor's stance at Theirs (stage 2); the legs'
figure from a hoofed donor is read against the donor's hock chain, so it understates the result
(the fair measure exists only for the owner's pair); no window change.

Could not explain: nothing so far.

Test build: `D:\Claude\MDLxL\TestBuilds\transfer-xl-16`, packaged from f66fcefc. Launcher
`TestBuilds\_START HERE\4 TRANSFER - Tauren stance.cmd` opens `TEST TRANSFER 03.mdx` with
`transfer-donors\Tauren.mdx` in a second tab. On that exact copy, hidden
(`out/transfer-probe/tauren-smoke.cjs`, pictures in `out/tauren-smoke`): Transfer opened, the
Tauren's `Stand -1` taken whole, Pose dragged to Theirs, "Keep foot on the ground" unticked; no
page errors. In the pictures the warrior's weapon arm is raised as the Tauren's totem arm and,
with the feet free, its legs take the Tauren's wide stance; the other hand stays on the hammer
("Both hands on the weapon") and the trunk stays upright (stage 2). Opened for the owner; his
verdict is open.
