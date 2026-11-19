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

## Stage 2, first part (built 17 Nov 2026): stance from the rest pose, and feet that stay down

The owner on build 16: "I honestly didnt notice that much change, but it doesnt mean it wasnt
improved. keep going". So the next step was chosen to be visible: the open model given every
animation of a donor in one go, which is the outcome a transplant promises, made with the
retargeting engine. It showed what a whole set needs beyond the pairing.

What changed in code (`src/anim-transfer.js`):

- New recipe field `stance` on a trunk part (0 to 1, off by default, not in the window yet): the
  turn the donor's joint has from its rest pose is carried over, so the trunk stands as the donor's
  does and not only moves as it does. A part with stance, and a limb with Pose toward Theirs on
  such a part, ride on the donor's anchor movement instead of this model's own (`onStance`).
- With "Keep foot on the ground": a foot that stands on the ground in the donor (its end within an
  eighth of the donor's hip height of its ground) stays down here. When the leg cannot reach its
  place, the place is first brought within the stride native walks use (0.70 of the leg's length
  from under the hip: `stride-census.mjs`, 178 native two-leg walks, 9 in 10 stay under 0.70, half
  under 0.59), then the hips come down as far as the leg needs. A foot the leg already reaches is
  left alone, so a model taking its own animation is unchanged (test E1).

Proofs (probes and outputs in `out/transfer-probe/`):

- `stance-check.mjs`, the owner's pair: each trunk joint's turn from the rest pose is 0 degrees
  from the Tauren's with stance (12 to 17 without); the limbs keep pointing as the Tauren's.
  On this pair the stance itself is small: the Tauren's hunch is mostly in its shape, not its pose.
- `foot-float.mjs` on the trial model (lower foot above its standing height, hip height 42):
  Walk 24.1 -> 0.8, Attack Slam 12.1 -> 0.0, Attack - 1 4.8 -> 0.2, the Stands 4.4 -> 0.1; Death
  15.6 unchanged (the Tauren's own feet leave the ground there, 8.4).
- `contact-sweep.mjs`, 530 bodies with a Walk taking the Tauren's Walk as the window starts: a foot
  stays down (lower foot never over a tenth of hip height up) in 9% before and 95% after; 0 threw,
  0 non-finite. From the Grunt, Ghoul and Footman the figure reads 0% before and after and says
  nothing: this probe measures the ankle joint, which lifts 25 to 47% of hip height in those
  donors' own walks while the toes are down. A sole-based measure is owed (stage 4).
- `node --test test/anim-transfer.test.js`: 54 pass (52 + 2 new, R13). Fail first on the committed
  source: "stance" has no such field; "feet stay down" fails with `the Kurgan's lower foot gets
  24.5 above its standing height (hip height 42)`.
- `baseline.mjs l`, `baseline-compare.mjs i l`: 32 trials, 24 identical; 8 differ (`ogre`, `ogre0`,
  `ogreLegs1`, `tauren`, `kurgan`, `kurganwalk`, `kurganNoClear`, `nurgle`), all whole-body takes
  where a leg ran out of length before. The stance field alone changed none.
- `riders-gate.mjs`: 95 built, 5 skipped, 1 flagged, as before.

Trial models for the owner (`make-all-trial.mjs`, in `TestBuilds\test-models`): `TEST TRANSFER ALL
01.mdx` is `TEST TRANSFER 03` (the Kurgan) with its own 15 animations plus all 8 of the Tauren's,
named "<name> (Tauren)": limbs at Pose = Theirs, trunk with stance, feet kept down, hands free.
`TEST TRANSFER ALL 02.mdx` is the same with both hands kept on the hammer. Looked at hidden in the
Transfer window's "This model" view; numbers say the Walk is a forward-leaning walk with the feet
down (chest lean 5 to 22 degrees, as the Tauren's), stills from that camera cannot judge it.

Still open in stage 2: stance and "take every animation" in the window (owner decides how it
shows); hands that meet (two-handed weapons when the donor's arms are apart); a sole-based contact
measure; the weapon's own direction; scaling of the stride for the game's move speed.

Test build: `D:\Claude\MDLxL\TestBuilds\transfer-xl-17`, packaged from aeaf801c. Launcher
`TestBuilds\_START HERE\5 TRANSFER - all Tauren animations.cmd` opens the two trial models with the
Tauren in a third tab. On that exact copy, hidden: `tauren-smoke.cjs` (Transfer on the owner's pair)
and `all-trial-look2.cjs` (each of the 8 added animations played in the Transfer window's "This
model" view); no page errors. Opened for the owner; his verdict is open.

## Owner decisions, 17 Nov 2026 (after build 17, quoted)

- On the trial models: "the results are as good as it gets for a retarget I THINK, probably still
  can improve slightly", and: "Can they be made exacty the same by using the program and clicking?"
  Rule from now on: a result shown to the owner must be reachable by clicks in the window.
- Add all, when the donor has an animation the open model already has: "Replace existing, unless
  user wants to keep animations."
- "Transplant = replace all, no keeping of old animations and adapting."
- "Retarget = more control, let them modular it"
- Then he went away: "run the last 3% of fable until a checkpoint. If you have research to do, run
  opus agents - use my credits as best as possible."

### Stage 2, second part (contract for the builder, director: Fable)

Goal: the trial result by clicks alone. In the Transfer window, no new panel, existing controls.

1. **Pose on Head, Chest and Hips carries the stance.** For a trunk part the Pose slider reads and
   writes the recipe field `stance` (0 to 1) instead of `match`; for limbs it stays `match`. The
   "All taken parts" row writes `stance` to the trunk parts and `match` to the limbs in one drag,
   and shows the shared value as it does now. Same label, same Mine and Theirs ends; the tooltip
   says for a trunk part that Theirs takes the donor's stance. What the window writes by itself
   for a rider (`seatedMatch`) stays `match` only, so riders and saved setups do not change.
   Setups save and load `stance` (an old setup without it reads as 0).
2. **Add all replaces.** Add all takes every animation of the donor except Decay and Portrait
   ones. Where the open model already has an animation of that name, the new one replaces it:
   built over the model's own animation of that name as body animation, added under that name,
   and the old one removed, in one undo step with the rest. A checkbox beside Add all, "Keep own
   animations" (off by default, with a short tooltip), gives today's behaviour: only the
   animations the model does not have are added. The count on the button follows the checkbox.
3. **Proof.** Unit tests for both (failing first). On the packaged build, hidden: Take whole body
   from the Tauren on the Kurgan, All taken parts Pose to Theirs, "Both hands on the weapon" off
   on the weapon arm, Add all: every resulting animation's keys equal what `buildTransfer` gives
   for the same recipe, and the model ends with the Tauren's names and none of its own of the
   same name twice. Engine untouched: `baseline-compare` against `l` stays `0 differ`.

### Stage 2, second part: result (builder: Claude Opus)

Built 17 Nov 2026 to the contract above, points 1 to 3; the engine (`src/anim-transfer.js`) is untouched.

What changed:

- `src/transfer-window.js`: `poseKey`, `poseOf`, `withPose` (Pose reads and writes `stance` on a trunk
  part, `match` on a limb; a part without the field reads 0); `addAllPlan(..., { replace })` (with
  `replace` every donor name but Decay and Portrait ones, each clip listing in `replaces` the open
  model's animations of that name, its body animation the first of them); `sequenceIndexAfter` (where
  an animation of the open model is after the set is appended and the replaced ones removed).
- `app/Transfer.jsx`: the Pose field passes the part's kind to `get`/`set`/`reset`, so one drag on
  All taken parts writes `stance` to Head, Chest and Hips and `match` to limbs and shows the shared
  value; a trunk part's Pose tooltip says Theirs takes the donor's stance. `seatedMatch` and `take`,
  `takeWhole`, `addAfter` are unchanged (they write `match`). Footer: "Keep own animations" checkbox
  beside Add all, off at first; the plan and the count follow it. Add all appends every clip, then
  removes the replaced animations with the editor's own `deleteSequence` (`src/sequence-editor.js`,
  the Animation Controller's delete), all inside the one `edit` call (one Undo step; `Info` added to
  its sections when something is removed, as the Animation Controller does). After it, the window's
  Body animation and parts taken from This model are moved to the same animations' new places
  (`sequenceIndexAfter`), without a window history step. The Add all tooltip adds "Replaces: ..." when
  something is replaced. Setups needed no change: every part field already travels, so `stance` saves
  and loads; an old setup has none and its trunk Pose reads 0.
- Strings: three new ones (trunk Pose tooltip, "Keep own animations", its tooltip) in all five
  catalogs, `test/fixtures/locale-feature-sources.json`, catalog sizes in
  `test/localization-catalogs.test.js` (+3 each); `src/hotkey-manifest.json` regenerated
  (`transfer:keep-own`); `docs/TRANSFER.md` rows for Pose and Add all.
- Tests: `test/transfer-window.test.js` three tests (Pose field mapping; setup round trip of `stance`
  and an old setup; Add all on the Kurgan from the Tauren in both modes plus `sequenceIndexAfter`).
  `test/transfer.electron.cjs` story `set`; story `all` now ticks "Keep own animations" first (it
  covers the only-new-names case, which is no longer the default).

Proofs (run on this worktree, 17 Nov):

- `node --test test/transfer-window.test.js test/anim-transfer.test.js`: 81 pass, 0 fail (27 + 54).
  Fail first on the committed `src/transfer-window.js`: the file fails to load (`does not provide an
  export named 'poseKey'`); with only the new helpers added to the old file, the Add all test fails
  (`clip.replaces` undefined: the old plan neither replaces nor lists anything).
- `baseline.mjs m`, `baseline-compare.mjs l m`: `32 trials compared, 0 differ` (nurglespell has the
  same "no sequence /^spell/i" in `l` and `m`).
- `node --test test/ui-primitives.test.js test/localization*.test.js`: 61 pass, 0 fail;
  `test/hotkey-default-overlaps.test.js`: 11 pass.
- Packaged (`out/pkg-transfer`, built from this source), hidden through `scripts\hidden-run.ps1`:
  story `set` 6 checks, 0 errors. One Pose drag on All taken parts: stance 1 on hips, chest, head;
  match 1 on legL, legR, armL, armR (trunk match unchanged, limbs no stance); Hips Pose reads 100 with
  the stance tooltip; armR (the Kurgan's weapon arm) Both hands on the weapon off; Add all reads (8)
  with Keep own animations off, (3) on; Add all leaves 18 animations (15 - 5 replaced + 8), each
  Tauren name once, the Kurgan's other 10 once each, Body animation still Stand - 1. Every one of the
  8 added animations has the keys `buildTransfer` + `applyTransfer` give for the same recipe on the
  Kurgan as opened (one clip at a time on a fresh copy): Stand -1 129 tracks 370 keys, Stand - 3 129 /
  1181, Walk 36 / 366, Stand Ready 30 / 170, Attack - 1 33 / 547, Stand Victory 129 / 348, Death 35 /
  1077, Attack Slam 39 / 675; same tracks, same key frames, largest value difference 1.1e-13 (Death),
  0 elsewhere. One Undo after closing the window puts the Kurgan's own 15 back.
  Fail first: the same story on a package built from the committed `Transfer.jsx` and
  `transfer-window.js` stops at "Pose at Theirs writes stance 1 on the trunk and match 1 on the limbs"
  (hips got `match: 1`, no stance).
- Story `B` on the new package: 11 checks, 0 errors. Story `all` (edited): 2 checks, 0 errors (Add all
  (7) on the Lord of Change from the Footman with Keep own animations on; Undo, Redo, Save as keep them).

Not done or not run:

- Story `sweep34` was not run; it asserts only that Add all adds animations (the Footman from the
  Grunt), which replacing may or may not still satisfy. The full source and packaged suites were not run.
- The window's own Undo stack keeps recipes from before Add all with the old animation numbers; after a
  replacing Add all, a window Undo back past it can point the Body animation at another animation.
  Same class as an editor Undo under the window today; not changed (read from the code, not run).
- Nothing seen that could not be explained.

## Checkpoint, 17 Nov 2026 (director: Fable; the owner was away)

- Stage 2, second part is built by the Opus builder (0ebf4c94) and checked again by the director:
  `test/transfer-window.test.js` and `test/anim-transfer.test.js` 81 pass; `ui-primitives` and the
  localisation tests 61 pass; `baseline-compare l n` 0 differ; story `set` rerun hidden on the
  package: 6 checks, 0 errors (one Pose drag on All taken parts, Add all (8), every added
  animation's keys equal `buildTransfer`'s, one Undo restores the model's own 15).
- Test build `D:\Claude\MDLxL\TestBuilds\transfer-xl-18` is a copy of that tested package. Launcher
  `TestBuilds\_START HERE\6 TRANSFER - whole set by clicks.cmd` opens `TEST TRANSFER 03.mdx` with
  the Tauren in a second tab. Not opened: the owner was asleep.
- Stage 3 study, by the Opus researcher: [xfer-transplant-research.md](xfer-transplant-research.md)
  (its probes are `out/transfer-probe/transplant-*`). A study, not a contract: the director has read
  its summary and structure, not checked every number. Its headline findings: the owner's pair is
  feasible (only the hock, 38 of 1,445 vertices, has no counterpart on the body); 63% of the
  Kurgan's skin is extras (hammer 47%, a collar piece 15%; collection median 26%), which lose
  their own motion when the own animations go; the Tauren animates its totem on its own root, so
  a weapon hung on the donor's hand does not follow its attacks; with the Tauren as donor 502 of
  561 bodies have a shin across its hock; copied rotation keys leave each limb part off by the
  rest-pose difference unless corrected per key. Its recommendation is a mixed result: the donor's
  skeleton and keys where the two bodies agree, the retargeting engine for a limb with a donor
  joint the model lacks.
- Next, in this order: the owner's verdict on build 18 (clicks) and on the trial look; his answers
  to the open questions in section 7 of the study; then a transplant contract and a first
  prototype on the owner's pair, with the gates of stage 4 (a sole-based contact measure first).

## Stage 3: transplant. Owner's answers (17 Nov 2026, quoted) and the engine contract

Answers to the study's eight questions (section 7 of [the study](xfer-transplant-research.md)):

1. Where the result goes: "same model no new tabs."
2. Portrait animations and camera: "keep camera"
3. Attachment points: "take donors"
4. Donor's effects and sounds: "checkbox select"
5. The model's own extras: "No, you give checkboxes!!! A transplant is always FULL first and foremost."
6. Weapon: "offer to switch the weapons hands if the donor has a mirrored setup"
7. A limb with a joint only the donor has: "CONVERTED"
8. Poor fit: "Say its a poor fit, still do it."

The director's reading, to be confirmed by the owner where marked:

- In place: the open model itself becomes the transplanted model, as one undo step. No new tab.
- Full by default: every animation of the model is replaced by the donor's (Portrait ones too),
  every bone of the body is the donor's, and the donor's attachment points replace the model's.
  The model's own camera stays.
- Extras (reading of answer 5, to confirm): by default an extra's own bone goes too, and its mesh
  rides the donor bone its own bone hung from (a hammer rides the hand, rigid). One checkbox per
  extra keeps that extra's own bone (still: its own animation is gone either way).
- Effects and sounds: one checkbox each for the donor's sounds/events and the donor's particle
  effects. Defaults until the owner says otherwise: events on, particle effects off.
- Weapon hand: when the donor holds its weapon in the other hand, the tool offers to mirror (the
  offer Transfer already makes for retargeting). Whether a weapon should follow a donor weapon
  that leaves the hand (the Tauren's totem) was not answered: it rides the hand.
- A limb with a joint only the donor has is converted: the model's own limb joints stay and are
  driven by the retargeting engine (Pose = Theirs, feet kept down) in every donor animation.
- A poor fit is named as one, with the reason, and the transplant is still made.

### Engine contract (builder: Opus; no window yet)

A new pure module `src/skeleton-transplant.js` (no DOM, no React), reusing the helpers the study's
section 2 lists and the pairing of `src/anim-transfer.js` (export what is needed from there
rather than copying it). One entry:

```js
/** The open model's mesh on the donor's skeleton with the donor's animations.
 * -> { model, report } where model is a new model object (the caller swaps it in as one undo
 * step) and report = { fit: 'good' | 'poor', reasons: [...], converted: [part keys],
 * extras: [{ id, name, vertices, kept }], mirrorOffer: boolean, counts: {...} } */
export function transplantSkeleton(model, donor, { keep = [], events = true, emitters = false, mirror = null } = {})
```

Follow the study's recommended algorithm (its section 3 and the summary in "Checkpoint" above)
with the owner's answers above taking precedence where they differ: attachments are the donor's;
extras are not kept unless listed in `keep`; nothing goes to a new tab. Trunk pairing is by what
hangs from each joint, as the study found the retargeting trunk pairing wrong for this.

Proof, all before hand-back:

- Unit tests `test/skeleton-transplant.test.js` on the owner's pair (`transfer-kurgan`,
  `transfer-tauren`) and one easy pair (`transfer-footman`, `transfer-grunt`): the result
  validates and survives `generateCompatibleMdx` then `parseCompatibleMdx`; it has exactly the
  donor's animation names and intervals and none of its own; every vertex is bound to a node that
  exists; no own body bone is left unless its part is in `report.converted` or its id in `keep`;
  through each donor animation each paired limb part points within 10 degrees of the donor's
  part of the same role (the fair measure of `out/transfer-probe/pose-fair.mjs`); the Kurgan's
  legs are in `converted` and a foot stays down in Walk (the R13 test's measure); with `keep`
  holding the hammer's bone that bone survives; a pair that is a poor fit reports `fit: 'poor'`
  with a reason and still returns a model.
- A sweep over the collection (pattern: `out/transfer-probe/pairing-sweep.mjs`): every two-arm
  two-leg body taking the Tauren, the Grunt and the Footman: built, threw, validates, not finite,
  share of limb parts within 10 degrees, and share reported as a poor fit. Numbers into the note.
- Trial models in `D:\Claude\MDLxL\TestBuilds\test-models`: `TEST TRANSPLANT 01.mdx` (the Kurgan on
  the Tauren, nothing kept) and `TEST TRANSPLANT 02.mdx` (the same with the hammer's bone kept),
  made by a script in `out/transfer-probe/`, each opened hidden in the packaged build
  (`D:\Claude\MDLxL\TestBuilds\transfer-xl-18\MDLxL.exe`, pattern
  `out/transfer-probe/all-trial-look2.cjs`) to show it loads and plays with no page error.
- `node --test test/anim-transfer.test.js test/transfer-window.test.js` still 81 pass;
  `baseline-compare` against `l` still `0 differ` (exports only, no engine behaviour change).
- These are prototypes for the owner's eye, labelled as such: the window does not offer the
  transplant yet (stage 5 is designed with him first).

### Stage 3, engine prototype: result (builder: Claude Opus)

Built 17 Nov 2026 to the engine contract above. A prototype for the owner's eye: no window, no UI
strings. Commits: e870df17 (module and the easy pair), dce7ebd5 (owner's pair, options), and this note.

What was built:

- `src/skeleton-transplant.js` (new, pure): `transplantSkeleton(model, donor, { keep = [], events = true,
  emitters = false, mirror = null, extents = true })` -> `{ model, report }`, and `mirrorModel(model)` (a
  donor reflected left to right, for `mirror: true`). The result is a new model; neither input changes.
  `report` = `{ fit, reasons, converted, extras: [{ id, name, vertices, kept }], mirrorOffer, counts,
  ownNodes, donorNodes }`; the last two map the open model's and the donor's ObjectIds to the result's.
- `src/anim-transfer.js`: exports only (`sameKindSequence`, `copyBodyAnimation`, `newSequenceExtents`);
  nothing it computes changed. The pairing itself is read from `buildTransfer`'s `probe` (one sample), as
  the study's probes did, so no pairing code is copied.
- How it works (the study's section 3 with the owner's answers):
  1. Pairing is the engine's own (stage 1). Trunk joints pair by what hangs from them: the joint the legs
     hang from takes the hips (Kurgan `Hip` -> `Bone_Pelvis`), the one the arms hang from the chest, the
     deepest head joint the head (`Head` -> `Bone_Head`).
  2. A limb is converted when its donor limb has a joint inside the limb, between two joints the pairing
     uses, that no joint here takes (the Tauren's hock; the Grunt's forearm, where the Footman's shield arm
     ends at an attachment). Its own joints stay and the retargeting engine drives them in every donor
     animation on the result itself (Pose = Theirs; feet kept down for legs; hands free and not aimed).
     First the Stand, then the body joint is moved up or down by one constant so the feet stand at the
     model's own standing height in that reference pose, then every animation. Everything else paired is
     transplanted.
  3. Donor joints sit on this model's joints (paired; several own joints on one donor joint: the first);
     on this model's line between the placed joint above and the one paired joint below at the donor's
     share of that path (a collar or neck this model lacks); else at the donor's offset from the nearest
     placed joint, scaled by the size ratio (hip heights; tail, weapon root); top nodes about the ground
     point under the hip centre.
  4. Skin: every own bone goes to the donor joint its part joint pairs with. An extra (a bone outside the
     parts that moves by itself: some key with a second value) goes with its bone and rides that joint,
     held where the model's own reference pose holds it (its vertices are re-placed in the joint's rest
     frame by that pose). With its id in `keep` its bone stays, still at that pose, on the same donor joint.
     A still skin carrier (the SD habit) is body skin and is not listed. Donor helpers that get skin become
     bones; donor bones left with no skin and nothing below go; keyed donor helpers stay (tail, totem root).
  5. Keys: the donor's, with its animation list and intervals. In a transplanted limb each joint's rotation
     keys (and tangents) become C(parent)^-1 q C(self), C turning this model's stretch onto the donor's, so
     every stretch points as the donor's (twist: shortest arc); position keys inside such a limb are scaled
     by that stretch's own length ratio, elsewhere by the size ratio; `MoveSpeed` times the size ratio.
  6. Attachments are the donor's. `events` on: the donor's sounds and footprints; off: the model's own,
     refitted. `emitters` on: the donor's particle emitters, ribbons and lights with their textures. The
     model's own camera, collision shapes and effects stay; geoset animations, material and texture keys
     and own effects' keys are refitted into each donor animation from the own animation of the same kind
     (`sameKindSequence`, else the own Stand) with `copyBodyAnimation`. Donor global sequences that kept
     nodes use are appended; one of no length becomes a constant (the Knight has one).
  7. Poor fit (named, still made): either body not recognised, a different number of legs, or an own arm,
     leg or wing with no donor counterpart (it rides still). A tail with no counterpart rides still without
     making it poor (`counts.ridesStill`). Bind poses (Reforged) are left out and named.

Proofs (run on this worktree, 17 Nov):

- `node --test test/skeleton-transplant.test.js`: 9 pass, 0 fail (T1, T2 Footman on the Grunt; T4 to T6 the
  Kurgan on the Tauren; T7 keep; T8 sounds and effects; T9 mirror on the Kurgan and the Grunt; T10 poor fit,
  the Kurgan on the Magnataur). Each checks: validates, survives `generateCompatibleMdx` and
  `parseCompatibleMdx` with exactly the donor's names and intervals, none of its own animations, every
  vertex on a node that exists, no own body joint left unless its part is converted or kept. Measures:
  transplanted arm and leg parts against the donor's part of the same role through every animation but
  decay and portrait: 0.0 degrees on both pairs (largest); the Kurgan's lower foot in Walk 2.4 above its
  standing height (hip height 42, limit 4.2); the hammer's vertices against the hand within 0.05 of the
  Kurgan's own grip through every animation, kept or not.
- Fail first (`out/transfer-probe/transplant-fail-first.mjs`, one behaviour broken at a time, file restored):
  correction off -> T2 `legL: the lower part is up to 11.6 degrees from the Grunt's`; no conversion -> T4
  (`converted` empty) and T5 (`the Kurgan's own feet are in the result`); feet not kept down -> T5 `lower
  foot gets 16.3 above its standing height`; extras not held -> T6 `the hammer drifts up to 25.55`; keep
  ignored -> T7 `the hammer's bone is in the result`; events or emitters ignored -> T8; mirror ignored -> T9
  `armL: the upper part is up to 132.7 degrees`; poor fit not named -> T10.
- `node --test test/anim-transfer.test.js test/transfer-window.test.js`: 81 pass. `baseline.mjs p`,
  `baseline-compare.mjs l p`: `32 trials compared, 0 differ` (nurglespell has no Spell, as in `l`).
- The owner's pair (`out/transfer-probe/transplant-run.mjs`): 10 animations, 46 nodes, 0 validation errors;
  arms 0.0 degrees from the Tauren's; converted legs at feet kept down: thigh up to 46 degrees (mean 10 and
  15), lower leg up to 37 and 40 (mean 8 and 12) from the Tauren's thigh and knee-to-hoof line (the placing
  moves them, as at Pose = Theirs in retargeting); lower foot above standing height: Stands 0.1 to 0.3,
  Walk 2.4, attacks 1.5 and 1.6. Build time 10 to 12 s (extents included), most of it the converted legs.
- Other pairs (`transplant-options.mjs`, all 0 validation errors, round trip ok, transplanted parts 0
  degrees): Kurgan on Ghoul, Sorceress, Lord of Change (legs converted); Footman on the Grunt mirrored;
  Footman on the Kurgan; Tauren on the Footman; Kurgan on the Knight and the Magnataur named poor.

Collection sweep (`out/transfer-probe/transplant-sweep.mjs`, sharded, merged by `transplant-sweep-merge.mjs`
into `transplant-sweep.json`; `extents` off): every two-arm two-leg body of `D:\Claude\MDLxL-TestModels` and
`D:\Claude\lpw-main\dist\models` (561, read as `pairing-sweep.mjs` reads them) taking each donor's skeleton.
Limb parts = upper and lower part of each arm and leg against the donor's part of the same role, 6 moments
of every animation but decay and portrait; "worst within 10" = the part's largest angle is 10 or less.

| Donor | Built | Threw | Not valid | Not finite | Poor fit | Converted limbs | Transplanted parts: worst within 10 (samples) | Converted parts: worst within 10 (samples; median, 9 in 10) | s per body (median) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tauren | 561 | 0 | 32 | 0 | 5 (1%) | legL 500, legR 499, armR 35, armL 18 | 98% of 2,376 (99%) | 2% of 2,049 (52%; 9.8, 26.3) | 22 |
| Grunt | 561 | 0 | 32 | 0 | 3 (1%) | armR 35, armL 18, legL 2 | 100% of 4,378 (100%) | 93% of 55 (93%; 0.1, 0.7) | 0.15 |
| Footman | 561 | 0 | 32 | 0 | 3 (1%) | armL 18, legL 2 | 100% of 4,448 (100%) | 90% of 20 (91%; 0, 4.4) | 0.17 |

- Not valid: all 32 per donor (21 file names) are open models that already fail `validateModel` the same
  way (their own global sequences of no length, one missing texture animation;
  `transplant-invalid-check.mjs`: 21 of 21 invalid before the transplant). Not repaired here.
- Poor fit reasons: a winged body (2, wings ride still), one Reforged model with bind poses, and with the
  Tauren 2 bodies whose converted legs were not recognised on the result (they keep their rest pose).
- Mirror offered: 223 bodies with the Grunt and the Footman; 0 with the Tauren (its weapon side is not read).
- Feet in Walk (the R13 measure, lower foot's joint against the model's own standing height): with the
  Tauren a foot stays within a tenth of hip height in 91% (median 0.1 hip heights). With the Grunt and the
  Footman 0% (median 0.3 and 0.4): those are transplanted legs, and this measure reads the ankle joint, which
  lifts 25 to 47% of hip height in those donors' own walks while the toes are down (stage 2 lesson); it
  says nothing there. A sole-based measure is still owed.
- Converted parts with the Tauren: half within 10 degrees; the placing (feet kept down) moves them, as in
  retargeting at Pose = Theirs with the switches on.

Trial models (`out/transfer-probe/make-transplant-trial.mjs`, prototypes, in `TestBuilds\test-models`):
`TEST TRANSPLANT 01.mdx` (the Kurgan on the Tauren, nothing kept) and `TEST TRANSPLANT 02.mdx` (the hammer's
bone kept); each 10 animations, 189 KB. Each opened hidden in `TestBuilds\transfer-xl-18\MDLxL.exe` with
`all-trial-look2.cjs` (ONLY `.`): every one of the 10 animations played in the Transfer window's "This
model" view, `page errors: []`, `DONE`. What the pictures show (`out/all-trial-look/transplant01-*`,
`transplant02-*`; I looked at 8 of the 60): the Kurgan whole, arms and legs attached, the hammer in the
weapon hand in each of those (raised over the head in Attack - 1, swung low in Attack Slam), a wide crouch in Stand Ready, the body lying
down in Death with the Tauren's blood splats, footprints on the ground in Walk. Nothing torn or detached
was seen. The view's camera looks from behind and close, so the head and face are hard to judge; stills
cannot judge the motion.

Not done or not run:

- No window (by contract). The internal option `extents` (default true) is extra: the sweep turns it off.
- Own trunk skin is not split between donor joints (own head over neck and head, own hip over root and
  pelvis: the study's nearest-segment split); each own joint goes whole to one donor joint.
- Followers (a shoulder pad that turns with a limb) are not carried: every extra rides its joint rigidly.
- Corrections are shortest-arc: a hand and its weapon can roll; no bend-plane match.
- `MoveSpeed` scaling and the result in Warcraft III itself are not verified. Full source and packaged
  suites not run (as instructed).
- With `events: false` the model's own sounds are refitted by kind (my reading of "checkbox select"); the
  director's reading did not say what happens to own events.
- A converted arm whose own end is an attachment (the Footman's shield arm) cannot be measured on its lower
  part: the model's own attachments are replaced by the donor's.

- Commits: (b) and (c) share one test commit; the module was complete at (a).
- Two Tauren-sweep bodies whose converted legs the result's reading did not find: not looked into.

Could not explain: nothing seen.

Most likely to look wrong to the owner:

1. The weapon. The hammer is held rigidly as in the Kurgan's own Stand: its own swing is gone, and where the
   Tauren throws or swings its totem away from the hand the hammer stays in the hand. The donor's
   `Weapon Ref` stays on the Tauren's totem root (attachments are the donor's), so weapon effects appear
   where the totem would be, not on the hammer.
2. The converted legs. The Kurgan's straight legs follow the hoofed legs' thigh and knee-to-hoof line with
   the feet kept down: up to about 46 degrees off the Tauren's at the worst moments; knees can look bent
   differently from the hooves they replace.
3. Proportions. The arms point exactly as the Tauren's, but the Kurgan's upper arm is about a quarter of the
   Tauren's, so hands land elsewhere (the other hand off the shaft, arms close to the body); the Tauren's
   hunch is in its shape and is not carried; the shoulder piece and belt no longer move by themselves.

### Stage 3, engine prototype: director's review (Fable, after the owner's "restart all paused work")

Checked again on ad9693a7, not through the builder's own tests where it mattered:

- Reruns: `test/skeleton-transplant.test.js` 9 pass; `test/anim-transfer.test.js` with
  `test/transfer-window.test.js` 81 pass; `baseline.mjs q`, `baseline-compare l q`: 0 differ.
- The saved trial models against the Tauren (`out/transfer-probe/transplant-review.mjs`,
  `transplant-review2.mjs`, from the files only): the animation list is the Tauren's exactly, none of
  the Kurgan's own left; all 1,445 vertices sit on a bone that exists, none on a helper; attachments
  are the Tauren's. The result has 25 bones: 18 of the Tauren's by name, the six leg joints of the
  Kurgan (converted) and its portrait background; 32 of the Tauren's 50 are not in it (its leg
  bones, and bones left with no skin and nothing below). Trunk bones turn exactly as the Tauren's
  through every animation (0 degrees: root, pelvis, chest, neck, head, tail, totem root). Arm bones
  differ from the Tauren's turn by a constant 21 to 22 degrees, which is the rest-pose correction:
  the arm stretches themselves point within 1 degree of the Tauren's. Three stretches point
  elsewhere by 44 to 139 degrees (neck to head, root to chest, chest to left collar): that is where
  the donor's joints were placed inside the Kurgan's body, not a turn. Lower foot above standing
  height: Walk 2.4, attacks 1.5 and 1.6, Stands 0.2, Death 12.2 (the Tauren's own Death lifts too).
- Pictures looked at (`out/all-trial-look/transplant01-view-*`: Stand -1, Attack - 1, Walk): the
  Kurgan whole, the hammer in the weapon hand and carried over the shoulder as the Tauren carries
  its totem, swung in the attack, footprints in Walk. Nothing torn.
- Not reviewed: the module line by line (692 lines); the sweep's numbers were not rerun.
- Verdict: the prototype does what the contract asked on the owner's pair and the builder's
  account of it holds where checked. Open, in the order they matter to the eye: the hammer is
  rigid (its own swing is gone with the model's animations); the legs are converted, so they are
  the retargeting result with feet kept down, not the Tauren's bones; "the donor's skeleton" is 18
  of 50 bones here; trunk skin is not split and followers (shoulder pads) are not carried.
- Launcher for the owner: `TestBuilds\_START HERE\7 TRANSPLANT - warrior on Tauren skeleton.cmd`
  (build 18, the Tauren and both prototypes). Not opened by the director.

## Main merged in, build 19 (19 Nov 2026)

- Merge `0f0bc3b7` (main at ff39c9f0; conflicts only in `app/App.jsx`, `app/AppDialogs.jsx` dialog
  lines and the catalog sizes in `test/localization-catalogs.test.js`). 81/81 retarget + window tests,
  9/9 transplant, ui-primitives/hotkeys/catalogs 37 pass, `baseline-compare q r` 0 differ.
- Package `D:\Claude\MDLxL\TestBuilds\transfer-xl-19`, launcher `_START HERE\8 TRANSFER - build 19
  after main.cmd`. Packaged `transfer` harness hidden: 57 checks, 1 error, the 140-control sweep
  without a crash (needs `MDLXL_REAL_PLAYWRIGHT=D:\Claude\tools\node_modules\playwright-core`).
- The one error is old, not the merge: riders story (`test/transfer.electron.cjs` "the Pose slider
  shows Theirs") clicks Hips and expects 100. Since stage 2 the Hips Pose slider shows `stance`
  (trunk), while a seated rider sets only `match` on hips (`seatedMatch`, kept on purpose). So a
  seated Footman's Hips slider reads Mine (0) although the hips take the seat. Open: fix the test
  to read a leg, or make the trunk slider show the seat; decide with the window work (step 7).

## Owner's answers on the compare sheet (19 Nov 2026)

Compare sheet (build 21, `TestBuilds\transplant-review\cases.json`, answers in `answers.json` there):
- Transplant, warrior on the Tauren skeleton: **Good**.
- "The Tauren lets go of his totem. What should the Kurgan's hammer do?": **Follows the totem**
  (TEST TRANSPLANT 03: the weapon rides the donor's weapon bone, thrown off with it). This replaces
  the unconfirmed reading "weapon stays in the hand". The engine cannot make this yet (03 was built in
  `out/transfer-probe/make-transplant-options.mjs`); it goes into transplant v2.
- Extras question dropped: kept plates and belt move within 0.41 of 01 (keep holds a bone still on its
  joint), so there was no visible choice. Still open, together with the hammer losing its own swing.
- Owner, 19 Nov: no Fable; when the hard algorithm step comes, ask him which model.
