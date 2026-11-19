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

## Owner's scope for transplant v2 (19 Nov 2026, quoted)

"No, it gets the taurens swing and the user can correct - this is an implant - when did i ask for it to
be a complicated implant that preserves anything?" Transplant = the model's mesh goes onto the donor's
skeleton and takes the donor's motion, whole. Nothing of the model's own motion is preserved; the user
corrects afterwards with the existing tools. Dropped: the hammer's own swing, the per-extra Keep
checkbox, carrying the model's own followers. v2 list:
1. The weapon rides the donor's weapon bone (the Tauren's swing, thrown off with the totem).
2. The donor's own leg bones, not the converted legs.
3. Weapon Ref (attachment) on the bone that carries the weapon.
4. Skin goes onto the donor's bones so the body bends where the donor's does (trunk included).

Correction, same day (quoted): "YOU CAN retain the keep options - just I am explaiing to you - by default
a transplant is always 100% transplant ... i want 100% transplant and the user can adjust from there."
So: the Keep options stay as opt-in controls, all off. The default result is 100% the donor's skeleton
and motion, nothing of the model's own motion. The v2 list above is the default; Keep is unchanged.

### v2 items 1-3: result (builder: Claude Opus, 19 Nov 2026)

Default behaviour of `transplantSkeleton` changed for items 1 to 3 of the owner's v2 list; item 4 (trunk skin
split) not touched. Keep options unchanged (off by default; a kept extra still holds still on its joint).
Commits: bbed78dd (engine and tests), this note. Probes (untracked, `out/transfer-probe/`): `make-transplant-v2.mjs`,
`v2-feet.mjs`, `v2-totem-shift.mjs`, `v2-leg-skin.mjs`, `v2-rigs.mjs`; the sweep script now counts the weapon.

- **1. Weapon rides the donor's weapon bone.** The model's weapon = every extra on its weapon hand plus the extra
  its own weapon attachment hangs from. The donor's weapon bone = the joint its weapon attachment hangs from
  (by attachment, not by name), else its weapon hand. The weapon's vertices are bound to it, placed where the
  model holds them at the result's reference moment (first frame of its Stand), so they swing and leave the hand
  with the donor's weapon. A weapon bone on the donor's other arm (unmirrored) is not used: the weapon stays in
  the hand it pairs with and `report.weapon.note` says so (Kurgan on the Grunt; mirrored, it rides the axe bone).
  New `report.weapon = { extras, bone, rides, vertices, note }`.
- **2. The donor's own leg bones.** Legs are never converted now (arms still are when the donor has a joint
  inside the arm the model lacks, e.g. the Footman's shield arm). A donor leg joint no own joint takes (the
  Tauren's hock) sits on the model's leg between its neighbours at the donor's share; the own stretch's skin is
  split between the donor joints along it by nearest placed segment (both joints near a bend). That split
  (`segmentTargets`, ~20 lines) is the small helper item 4 will likely want for trunk joints too.
- **3. Weapon attachments** (`/weapon/i`) hang from the bone that carries the weapon (the donor's weapon bone, the
  hand target when it does not ride, the kept bone when kept), where the model's own weapon attachment of the same
  name sits on the weapon.
- Also changed (needed for 1): donor joints that hang from nothing (the Tauren's `Bone_Totum`) are now lowered
  with the body when the ground is settled. In v1 only the body moved, so 01-03's totem sat 0.81 higher against
  the hand than the Tauren's does.

Tests (`test/skeleton-transplant.test.js`, 11 pass; new and changed ones fail on the v1 engine: 6 fail, run by
swapping in `HEAD:src/skeleton-transplant.js` and restoring). v1 expectations changed by the owner's default:
- T4: `converted` was `['legL', 'legR']`, now `[]`; now also checks the legs point within 10 degrees of the
  Tauren's and that all eight Tauren leg joints (hocks included) are in the result carrying skin.
- T5: was "the Kurgan's own feet stay down in Walk (within 0.1 hip height)". Feet are now the Tauren's foot
  joints with the Tauren's motion, nothing plants them: the check is now feet on the ground in the Stand (within
  0.05 hip height) and in Walk within 0.2 hip height (a regression guard; measured 0.18, see below).
- T6: was "the hammer stays in the hand as held (drift < 0.05 in every animation)". Now: rides only the Tauren's
  weapon bone, sits at the Kurgan's grip at the reference moment (< 0.05), and leaves the hand where the totem does.
- T7 (keep): unchanged, plus the Weapon Ref hangs from the kept hammer bone.
- New T11 (Weapon Ref on the weapon bone, at the Kurgan's place on the hammer, < 0.05) and T12 (weapon side rule
  on the Grunt, plain and mirrored).

Other proofs: `node --test test/anim-transfer.test.js test/transfer-window.test.js` 81 pass;
`baseline.mjs s`, `baseline-compare.mjs r s`: 32 trials compared, 0 differ.

Trial: `TestBuilds\test-models\TEST TRANSPLANT 05.mdx` (Kurgan on the Tauren, v2 defaults; 01-03 untouched),
made and measured from the saved file by `out/transfer-probe/make-transplant-v2.mjs`: validateModel 0 errors,
10 animations, 48 nodes, 249 KB, built in 0.5 s (v1: 10-12 s, the converted legs).
- Hammer: 675 vertices, all on `Bone_Totum` (as 03). In the totem's frame 05 and 03 differ by at most 0.82
  (every animation, 13 moments each): exactly the totem fix above (`v2-totem-shift.mjs`: totem-to-hand height
  16.86 in 03, 16.05 in 05). In the world up to 9.9 apart (Death), because the body stands lower (below).
- Weapon Ref: parent `Bone_Totum`, at the hammer's own Weapon Ref place.
- Legs: all eight Tauren leg joints in the result with skin; none of the Kurgan's own leg joints left
  (`v2-leg-skin.mjs`: shin-only vertices on the knee joint, shin+foot vertices on hock+foot).
- Feet (lower Tauren foot joint against the Kurgan's standing height, hip height 42): Stand -1 0.0..1.7,
  Stand - 3 -2.1..2.0, Walk -0.5..7.7, Stand Ready -3.6..-1.1, Attack - 1 -1.7..1.1, Stand Victory -0.6..-0.2,
  Attack Slam -4.1..3.9, Death -17.7..4.9 (the Tauren's own, scaled: within -2.7..6.8; Walk -0.4..1.1).
  The body stands 8.3 lower than in 03: the Kurgan's straight legs bent at the Tauren's angles reach less far.

Collection sweep (same 561 bodies, `transplant-sweep-all.sh`, now also counting the weapon; v1 numbers kept in
`out/transfer-probe/transplant-sweep-summary-v1.txt` and `transplant-sweep-v1.json`):

| Donor | Built | Threw | Not valid | Poor fit (v1) | Converted limbs (v1) | Transplanted parts: worst within 10 (v1) | Weapon rides / other arm / no weapon found | Walk foot within 0.1 hip (v1; median) | s per body (v1) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tauren | 561 | 0 | 32 | 3 (5) | armR 35, armL 18 (+ legs 500/499) | 98% of 4,382 (98% of 2,376) | 322 / 0 / 239 | 14% (91%; 0.1) | 0.16 (22) |
| Grunt | 561 | 0 | 32 | 3 (3) | armR 35, armL 18 (+ legL 2) | 100% of 4,382 (100% of 4,378) | 105 / 281 / 175 | 0% (0%; 0.3) | 0.06 (0.15) |
| Footman | 561 | 0 | 32 | 3 (3) | armL 18 (+ legL 2) | 100% of 4,452 (100% of 4,448) | 105 / 281 / 175 | 0% (0%; 0.4) | 0.08 (0.17) |

- Not valid: the same 32 open models that already fail `validateModel` (as in v1). Not finite: 0.
- Poor fit with the Tauren fell from 5 to 3: the two "legs not recognised on the result" cases are gone (no
  converted legs). Left: 2 winged bodies, 1 Reforged model with bind poses.
- Weapon "other arm" (281 with the Grunt and the Footman): the donor's weapon bone hangs from its other arm, so
  the weapon stays in the hand; most of these are the 223 bodies offered a mirror. "No weapon found" (175-239):
  no extra on the weapon hand and no own weapon attachment on an extra (the weapon is in the hand's own skin,
  or the body has no weapon) - unchanged from v1.
- Walk foot with the Tauren: 91% -> 14% within a tenth of hip height (median 0.1, 9 in 10 within 0.2): the
  v1 converted legs planted the feet; v2's donor legs do not (see risks). Grunt and Footman unchanged (this
  measure reads their ankle joints, which lift in their own walks, as noted for v1).

Risks and open points:
- Feet are not kept down any more (v1's planting belonged to the converted legs). Different leg proportions
  make feet float (Walk +7.7) or sink (Death -17.7). Not fixed here (outside items 1-3). A small fix if wanted:
  per key, the body height follows the donor's lower foot height times the size ratio.
- The weapon's own reference is the result's Stand first frame; a weapon that the donor holds differently in
  other animations is offset as the donor's weapon is (that is the owner's pick, 03).
- Weapon detection relies on the model's weapon arm (`part.weapon`) or its own `Weapon` attachment; a model with
  neither keeps v1 behaviour. Item 4 (trunk split) still open.

### v2 item 4: result (builder: Claude Opus, 19 Nov 2026)

Built to [the skin contract](xfer-transplant-v2-skin.md) (committed as written, f2618503). New pure module
`src/transplant-skin.js` (`transplantRuns`, `splitJoints`, `donorSkinCarriers`, `legTravelRatio`, `SKIN_BAND`);
`src/skeleton-transplant.js` uses it. Default now: no limb is converted (`convert()` removed); a donor joint the
model lacks (neck, hock, forearm) takes the own host's skin past its plane, both bones within the band; skin goes
onto the donor bone that carries that joint's skin in the donor (`Geo_*`); a leg's foot is not corrected; the
body's travel and `MoveSpeed` scale by the fitted legs (0.567 on the owner's pair, hip-height ratio 0.817).
`report.counts.skin` and `report.counts.travel` are new. Internal option `legs: 'straight'` (trial 07 only).

Where I deviated from the contract or reconciled it with items 1-3, and why:
1. Items 1-3's leg split (`segmentTargets`: nearest segment, 15% band, legs only) is replaced by the contract's
   runs (plane, 10% band, every run). They agreed on the Kurgan's legs (the same 10 vertices per hock).
2. Items 1-3 still converted arms; the contract converts nothing, so arms are transplanted too (T2's `converted`
   is now `[]`; the Footman's shield arm gets the Grunt's forearm, P7).
3. `travel` scales every position key outside transplanted limbs (body, tail, the totem root), not only the
   body joint's: a top-level weapon root that kept `size` would drift from a body moving by `travel`. Placement
   offsets keep `size` (as the contract says). Effect: the hammer sits 13.3 differently on the totem than in 03
   (reference moment moved), and is thrown slightly less far (farthest from the hand 148, 03: 166).
4. The weapon rides the donor's weapon joint itself (`Bone_Totum`), not a carrier: carriers are for part joints
   (4.4) and item 1 takes precedence (4.3 step 2). Weapon Ref stays on that joint.
5. HD models: the `SkinWeights` get the split as written; their classic `Groups` (kept beside them) take the
   default joint's carrier without a split (the contract is silent).
6. Detection risk 3 from items 1-3 fixed (not in the contract): only a weapon extra's pieces ride (bones that
   move by themselves or hang under one that does). Still skin on the hand (the Footman's hand mesh `Mesh02`
   and its `Cantine`) stays with the hand. Test P9.
7. Trial names per the coordinator: 06 and 07, not the contract's 04. Not opened in a packaged build
   (coordinator: no packaging).
8. P4's "turn within 0.5 degrees" covers trunk joints and their carriers; limb carriers carry the rest
   correction by design (their stretches are checked within 1 degree instead).

Tests: `test/transplant-skin.test.js` U1-U7 (7 pass); `test/skeleton-transplant.test.js` 17 pass: T1, T2 (changed
as above), P7, P9 (hand mesh), P1-P6 (replace T4 and T5), T6, T11, T12, T7, T8, T9, T10 (= P8). Fail first
(`out/transfer-probe/item4-fail-first.py`, one break at a time, file restored): items 1-3 engine fails T2, P7, P9,
P2, P3, P5; no runs fails P7, P2, P3; no carriers fails P7, P2, P3; foot corrected fails P5; travel by hip height
fails P5; no band fails P7, P2, U2; hand mesh riding fails P9. P1, P4, P6 already held on the items 1-3 engine.
Contract gate numbers met exactly on the owner's pair: `Geo_Neck` 14, `Geo_lowershinL/R` 10 / 10, 34 moved,
1 blended, 18 `Geo_*` bones with skin, at most 14 groups per geoset, 44 of 50 Tauren joints by name (v1: 18);
limb stretches within 1 degree, trunk stretches constant within 1, trunk turns within 0.5, feet turn within 0.5,
feet within 0.06 hip heights in every animation but Death. Retarget and window tests 81 pass; `baseline.mjs t`,
`baseline-compare.mjs r t`: 0 differ.

Trials (`out/transfer-probe/make-transplant-item4.mjs`, measured from the saved files; both validate with 0
errors, 10 animations, 251 KB, Weapon Ref on `Bone_Totum`, hammer rides it). Lower foot against the Kurgan's
standing height, in hip heights (42):

| Animation | 06 default: shin folds at the hock (travel 0.567) | 07 straight shin (travel 0.724) |
| --- | --- | --- |
| Stand -1 | 0.00 .. 0.00 | 0.00 .. 0.06 |
| Walk | -0.01 .. 0.05 | -0.03 .. 0.34 |
| Stand Ready | -0.02 .. 0.00 | -0.16 .. -0.07 |
| Attack - 1 | -0.02 .. 0.03 | -0.08 .. 0.18 |
| Attack Slam | -0.03 .. 0.02 | -0.21 .. 0.20 |
| Death | -0.04 .. 0.13 | -0.18 .. 0.32 |
| Hips standing (own 54.1) | 41.0 | 49.4 |
| Bend inside the shin, median / largest | 93 / 144 degrees | 15 / 110 degrees |

`TEST TRANSPLANT 06.mdx` and `07.mdx` in `TestBuilds\test-models` (01-05 untouched). Owner chooses by eye.

Sweep (561 bodies, `transplant-sweep-all.sh`; items 1-3 numbers kept in `transplant-sweep-summary-v2items.txt`):

| Donor | Built / threw / not finite | Not valid | Poor fit | Converted | Over 256 groups | Coincident mismatch | Capped to 4 (models) | Share of vertices moved (median / 90th / max) | Transplanted parts within 10 | Walk foot within 0.1 hip (v1 / items 1-3) | s per body |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tauren | 561 / 0 / 0 | 32 | 3 | none | 0 | 0 | 17 | 10.4% / 27% / 46.6% | 98% of 4,488 | **89%** (91% / 14%) | 0.16 |
| Grunt | 561 / 0 / 0 | 32 | 3 | none | 0 | 0 | 16 | 0% / 0% / 16.3% | 100% of 4,488 | 0% (0% / 0%) | 0.07 |
| Footman | 561 / 0 / 0 | 32 | 3 | none | 0 | 0 | 16 | 0% / 0% / 3.2% | 100% of 4,488 | 0% (0% / 0%) | 0.08 |

- Not valid: 32 per donor as in v1 (count compared; the file list was not re-diffed against v1's).
- Weapon rides: Tauren 323, Grunt and Footman 105 (281 on the other arm, mostly mirror offers).
- Grunt / Footman walk foot: the measure reads their ankle joints, which lift in their own walks (as for v1).
- Capped: 16-17 models have a vertex that would need over 4 bones (the corpus-sd prototype saw 1 of 344).

Open: the owner's choice between 06 and 07; `travel` also shortens steps and `MoveSpeed` (not checked in game);
collar skin on `Bone_ClavicalL/R` (contract risk 3); plane cuts through still rigid pieces (risk 4); motion
tearing not looked at by eye.

## Owner's answers on the v2 compare sheet (19 Nov 2026)

Sheet: build 22, `TestBuilds\transplant-review-v2\cases.json`, answers in `answers.json` there.
- Old (v1, TEST TRANSPLANT 01) or New (v2, 06): **New**.
- Legs: **Straight shin** (TEST TRANSPLANT 07), not "Bent like the Tauren" (06). The engine default
  must switch to the straight-shin variant; 06's folded shin becomes the alternative (or goes).
- Next: make straight shin the default (rerun the gates and the sweep), then the transplant window
  entry, concept with the owner first (talk only until "go").

### Owner's pick: straight shin is the default (19 Nov 2026)

Side-by-side sheet: New (v2) over Old; legs = straight shin (07) over folded at the hock (06). Commit 83da5ce3:
`legs: 'straight'` is the default, `legs: 'folded'` stays as an option (off). Tests 25 pass (P10 new, fails on the
folded default; P1 checks only the legs' thighs, P4 leaves out the two shin stretches, P5's foot-height bound is now a
0.4 hip-height guard, all for straight shins). 81 retarget/window pass; `baseline-compare r u` 0 differ.
`TEST TRANSPLANT 08.mdx` (default) is byte-identical to 07 (0 difference in pivots, joints, vertices, skin).
Sweep: 561 x 3 all built, 0 threw, 32 not valid as before, 0 over 256 groups, 0 coincident mismatch; with the
Tauren, Walk foot within 0.1 hip heights 12% (folded 89%, v1 91%), median 0.4; transplanted limb parts within 10
degrees 87% (folded 98%: the shins now follow the chord, not each stretch). Kurgan feet as 07: Walk -0.03..0.34,
Attack Slam -0.21..0.20, Death -0.18..0.32 hip heights.
Proposed, not built (`out/transfer-probe/feet-fix-probe.mjs`): the body joint's height follows the Tauren's lower
foot (times travel), keyed every 33 ms; the shin is not bent. On 08: Walk -0.01..0.04, Attack Slam -0.05..0.01,
Attack - 1 -0.02..0.02, Death -0.06..0.14; body moved -0.33..0.16 hip heights; ~4,300 height keys (100 ms keys:
1,434, Attack - 1 up to 0.12). A real build must also move loose donor joints (the totem root) with the body.

## Owner's answer on the feet sheet (19 Nov 2026)

`TestBuilds\transplant-review-feet`: **Feet down, body dips** (TEST TRANSPLANT 09: body height follows the
donor's lowest foot, the totem root moves with it). Goes into the engine default with straight shin.

### Owner's pick: feet down is the default (19 Nov 2026)

Commit 54d148bb: `feet: 'down'` (default; `'free'` is the option) moves the body joint and every parentless donor joint
(the totem root) together so the lower foot is as high above the ground as the Tauren's, times travel. The height is
added onto their existing translation keys: breakpoints are their own key frames plus halves only where the change
bends by over 0.01 hip heights; Bezier/Hermite curves are split exactly, control points lifted linearly. Tests 26 pass
(P5 back to 0.06 hip heights, new P11: totem root and hammer against the body unchanged within 0.01); fail first
(`out/transfer-probe/feet-fail-first.py`): feet free fails P5, P11; totem left fails P11; curves not split fails P11;
control points not lifted fails P5. 81 retarget/window pass; `baseline-compare r v` 0 differ.
`TEST TRANSPLANT 10.mdx` (`make-transplant-10.mjs`): 0 validation errors, 259 KB (09: 375, 08: 251), 241 keys each
on Root and the totem root (09: 4,322; 08: 190 and 79). Lower foot (hip heights), 10 vs 09: Walk -0.01..0.03 vs
-0.02..0.03, Attack - 1 -0.02..0.01 vs -0.02..0.05, Attack Slam -0.06..0.01 vs -0.05..0.01, Death -0.05..0.16 vs
-0.06..0.15, stands within 0.01. Body dip/rise as 09 (Walk -0.33..0.04, Attack - 1 -0.21..0.08, Attack Slam
-0.22..0.15). Hammer-to-hand change against 08: 0.000 in every animation (09: up to 1.68 in Attack - 1).
Sweep 561 x 3: all built, 0 threw, 32 not valid as before, 0 over 256 groups, 0 coincident mismatch; Tauren Walk foot
within 0.1 hip heights 99% (v1 91%, straight without feet down 12%); seconds per body with the Tauren 0.72 median
(was 0.16; the per-moment foot sampling), Grunt and Footman 0.24 / 0.23.

## Transplant in the window: owner picks layout A (19 Nov 2026)

Engine default now: straight shin, feet down (`54d148bb`, TEST TRANSPLANT 10). Window concept shown as two
sketches; owner picked **A: a Retarget / Transplant switch at the top of the Transfer window**. In
Transplant mode: From list and donor view as now; result view shows the open model transplanted, playing
the donor's animations; the right column becomes the transplant settings (poor-fit line, Sounds on,
Effects off, Keep options off, mirror offer on the donor caption as now); bottom button Transplant
(in place, one Undo step). Not built until the owner says "go".

### Transplant mode: result (builder: Claude Opus, 19 Nov 2026)

Built to the owner's layout A (commit d5c88b6f). Retarget is unchanged when selected; it keeps its taken
parts while Transplant is shown.
- **Switch** `Retarget | Transplant` above the three columns (`data-mode`, hotkey ids `transfer:mode-retarget`,
  `transfer:mode-transplant`). Transplant hides the part handles and Both/Rider/Mount on the donor view, the
  clip timeline, the parts column and the Name/Add footer.
- **Result view**: `transplantSkeleton(model, donor, options)` with engine defaults (100%, straight shin, feet
  down, extents on), built 30 ms after a paint (~1 s on the owner's pair; the UI waits that long per setting).
  The last result stays on screen while a setting rebuilds it, so the camera never moves. It plays the
  result's animation of the donor view's name (`transplantSequence`); its dropdown moves the donor view too.
- **Settings column**: poor-fit box (`Poor fit` + each engine reason) only when `report.fit === 'poor'`;
  Sounds (`events`, on), Effects (`emitters`, off; the donor's textures join the preview), `Keep` one box per
  `report.extras` (off, tooltip "Keeps this piece on its own bone instead of the donor's."). Mirror is the
  donor caption's existing button (`mirror: donorMirror`). The engine already had every option: no engine change.
- **Transplant** button: `edit('Transplant', ...)` with `replaceModelContents` (the previewed result, cloned):
  in place, one Undo step, no tab. The window stays open (as Add all) and says `Transplanted`; the result view
  then shows the open model itself until a setting, the donor or the model changes. Disabled for "This model".
- New pure helpers in `src/transfer-window.js`: `transplantOptions`, `transplantSequence`, `replaceModelContents`.
- 23 strings (UI and the engine's poor-fit sentences as templates) in ru/es/zh/fr/de
  (`out/transfer-probe/transplant-window-strings.json` through `locales.mjs`); catalog sizes updated.

Proof:
- `node --test` skeleton-transplant, transplant-skin, anim-transfer, transfer-window, ui-primitives,
  hotkey-default-overlaps, localization*: 181 pass, 0 fail. The two new transfer-window tests fail on the old
  `src/transfer-window.js` (helpers missing). `baseline.mjs v`, `baseline-compare.mjs u v`: 32 compared, 0 differ.
- `test/transfer.electron.cjs` new story `transplant` (TEST TRANSPLANT WINDOW 01 = the Kurgan): switch shows the
  settings column and nothing of Retarget; Kurgan on the Magnataur shows Poor fit with 3 reasons, Transplant
  enabled; on the Tauren the result view has the Tauren's 10 animations and follows the donor view both ways;
  Sounds, Effects (0 -> 2 effects), Keep Belt/Wep/RP and Mirror each rebuild with the dragged camera unchanged;
  Transplant: the model has the Tauren's animation list, 44 of 45 joints are the Tauren's, own camera kept, no
  tab; one Undo restores 15 animations and 21 bones. Sweep also toggles Transplant mode and its settings and
  checks Retarget keeps its parts. Riders story fixed: reads the left leg's Pose (the stale hips check).
- Package `TestBuilds\transfer-xl-23`, whole transfer harness hidden with the sweep: 69 checks, 0 errors,
  sweep 151 controls, PASSED. Screenshots `out/transplant-ui/` (empty, Tauren picked, after Transplant).
- Launcher `TestBuilds\_START HERE\7 TRANSPLANT - in the XFER window.cmd` (build 23, TEST TRANSPLANT WINDOW 01).

Open: the ~1 s build runs on the UI thread (no worker); window Ctrl+Z in Transplant mode steps the Retarget
history (Mirror included), not the model; the result is not checked in Warcraft III; owner's eye pending.

### Transplant mode polish: owner feedback on build 23 (19 Nov 2026)

Owner: "Make transplant the default" and the mode buttons must be more visible and clearer ("two VERY different
modes"). The window now opens in Transplant. The switch moved into the caption bar beside the title as a
segmented two-part control, Transplant first: **Transplant** / Whole skeleton, **Retarget** / Pick parts; the
active part is filled with `--ui-accent` (text black or white by the accent's lightness), the other plain.
Tooltips: Transplant "Puts this model on the donor's skeleton with all the donor's animations.", Retarget
"Takes movement from the donor part by part onto this model's own bones." Three new strings in the five catalogs.
Harness: `openTransfer` switches to Retarget unless a story asks for Transplant (an unreadable model shows only
its problems); the transplant story checks the default and the switch order; the dark story shoots the window
just opened. Package `TestBuilds\transfer-xl-24`, whole harness hidden with the sweep: 68 checks passed, the one
failure (`unreadable`: the helper waited for a parts column that model never has) fixed in the test and that
story rerun alone on build 24: passed. Screenshots `out/transplant-ui/00-just-opened-light.png`, `-dark.png`.
Launcher `_START HERE\7 TRANSPLANT - in the XFER window.cmd` now opens build 24.

## Failure sweep, report only (19 Nov 2026)

After the owner hit two bugs in three tries (Naga donor = thin line; Khorne knight = "non-finite geometry"):
1593 pairs (27 open models x 59 donors, Mirror as the window sets it). Fine 466, broken 748 (141 throw),
doubtful 379. Classes, causes with lines, and per-donor safety in `out/transfer-probe/failure-sweep/`
(`analysis.txt`, scripts, raw rows). Main causes: size ratio from hip heights, which are 0.001 for rigs
without recognised legs (`skeleton-transplant.js` size line; `anim-transfer.js` hipHeight floor), old in v1;
refitted particle tracks left with no keys (`refitTracks`), old; donor weapon bone scaled to zero ->
singular inverse -> NaN weapon (new in v2); joint ancestor not yet placed (`placeFrom`), old; weapon vanishes
when the donor hides its weapon bone in Death (new in v2). The poor-fit label does not predict breakage.
Owner asked for a report, not a fix; nothing changed.

## Engine fixes for classes 2,3,4,5,8: result (builder: Claude Opus, 19 Nov 2026)

Only `src/skeleton-transplant.js` changed (no size/scale or poor-fit logic touched). Scripts and data in
`out/transfer-probe/engine-fixes/`.
- **Class 2** (own track left with no keys, the preview threw "reading 'Vector'"): `refitTracks` never leaves a
  track empty. A node's move goes (rest); any other track holds, in every animation, what the renderer showed with
  no key (`HELD`: rate 0, visibility/alpha/colour 1, a ribbon unseen), else its first value. Looks the same as before.
- **Class 3** (Khorne knight's `Axe` scaled to zero -> singular inverse -> NaN weapon): a donor weapon bone whose own
  chain (the bones the hand does not hang from) is scaled to nothing at the reference moment, or carries no donor
  skin and is scaled to nothing in most animations, is not the weapon bone; the donor's weapon hand is tried next,
  else the weapon stays on the hand it pairs with. `report.weapon.note` says "The donor hides its weapon bone (...)".
  Every inverse is guarded (`safeInverse`): weapon re-placement falls back to the hand (`holdWeaponOnHand`), the
  extra bake and the weapon attachment keep their place.
- **Class 4** (joint ancestor not placed: the Hermit Crab's root hangs from its Origin Ref): `ensurePlaced` places a
  non-joint ancestor first, from its own parent.
- **Class 5**: where a weapon bone the donor keeps scales to nothing in some animations only, the result's copy keeps
  its reference size there (`decollapse`): the weapon stays with the hand. The sweep's 90 pairs (dragons) were the
  whole body going: the root scales to zero in Death; after the change all 180 runs hide the weapon only together
  with the joint it hangs from (`class5-check.mjs`), as the donor does. The sweep's check does not compare with the
  hand, so it still lists them.
- **Class 8** (HD donor: animations out of time order, two on one interval): constant tracks and new translation
  tracks get one key per distinct start in time order; `feetDown` lifts a shared interval once (it lifted it twice);
  `orderKeys` sorts and de-duplicates any track left out of order.
- **Safety net**: `holdNonFinite` before extents (vertex -> own bind place, pivot -> parent's, node key -> rest, other
  key -> last good value) and `holdExtents` after; anything held adds the reason "Parts of the result were not a
  number (...): they are held at rest." (new sentence, not yet in the locale catalogs.)

Proof:
- New tests C2, C3, C4, C5 (synthetic Death collapse on the Grunt's axe bone), C8, C9 (NaN donor key) fail on the old
  engine and pass; C5 Red Dragon is a guard (passes before and after). New fixture keys `transfer-hermit-crab`,
  `transfer-villager`, `transfer-red-dragon`. skeleton-transplant + transplant-skin 33/33, anim-transfer +
  transfer-window 83/83, `baseline.mjs w` vs `v`: 32 compared, 0 differ.
- Affected pairs rerun (244 pairs, 488 runs, 2 idle processes): class 2 246 -> 0, class 3 14 -> 0, class 4 26 -> 0,
  class 8 8 -> 0, class 5 180 listed by the sweep -> 0 hidden apart from the body. The 286 runs that threw now build
  (67 with no problem; the rest show the size-ratio classes, the designer's work). Runs that built before only lost
  problems.
- 100 previously fine pairs (`fine-pairs.json`, `hash-fine.mjs`, `diffall.mjs`): 53 identical; 47 differ only in tracks
  that had zero keys and now hold the renderer's no-key value or were removed (node moves): same picture.

## Package D, feet moved once: result (builder: Claude Opus, 19 Nov 2026)

Contract: [xfer-transplant-fixes.md](xfer-transplant-fixes.md), package D. Only `src/skeleton-transplant.js` (`feetDown`
movers, `settleFeet`, new `bodyMover`) and its test changed; fixture key `transfer-gargoyle` added. Scripts and data in
`out/transfer-probe/fix-design/d-check/` and `fingerprint-{preD,postD2}-*.jsonl`.
- **One deviation from the contract, to meet its own proof:** `bodyMover` climbs to the topmost free joint only when
  the line above the body joint reaches a joint that is moved anyway (a parentless donor joint in `loose`); otherwise
  the body joint alone moves, as before. As written ("always climb"), the Khorne Knight Axe as open model on ten
  legless donors changed (20 runs): its result keeps its own `Bone_Root` under its own `HorseBONE_ABDOMEN_Death`,
  which was never moved twice (`khorne-line.mjs`).
- Tests D1 (Footman on the Gargoyle: lower foot within 0.06 hip heights of the Gargoyle's times travel; before 0.513
  off in Morph) and D2 (`Dummy01` carries the height, `Bone_Root` keys as with feet free) fail on the old engine and
  pass. skeleton-transplant + transplant-skin 35/35, anim-transfer + transfer-window 83/83, `baseline.mjs x` vs `w`:
  32 compared, 0 differ.
- Fingerprint (`fingerprint-compare.mjs preD postD2 D`, 3,068 runs, 2 idle processes): 2,600 must-be-identical runs,
  0 differ; all 468 runs on the nine donors changed, no throws before or after.
- Feet on the nine donors (`feet-d.mjs`, 234 pairs, every animation but death/decay/portrait, 13 moments, off target =
  over 0.1 hip heights): before 2,126 of 2,392 animations in 227 pairs; after 17 animations in 4 pairs, all the Naga
  Myrmidon as open model at size 0.00 (class 1, packages A/B, not the feet).
- Class 5 note (weapon bone = the donor's head on ~20 donors): not in the functions D touches (it is the weapon-bone
  choice in `transplantSkeleton`, `armOf(bone)` is null for a head so the head is taken). Left for its own work.

## Packages A and B, weapon bone on a hand: result (builder: Claude Opus, 19 Nov 2026)

Contract: [xfer-transplant-fixes.md](xfer-transplant-fixes.md), packages A and B (owner: legless "After" in all five
cases, Poor fit as written). Package C not built (on hold). Commits `0a70da55` (A), `9775710e` (B), `518de79f` and
`244deebd` (weapon bone). Scripts and data in `out/transfer-probe/xfer26/`.
- **A** (`src/anim-transfer.js`): `bodyExtent`, measured or stand-in hip height (0.26 of the extent), mesh floor as
  ground without legs, the Felhound's body joint rebased to `Bone Center`, exported `rigSizeRatio`. Tests S1-S6.
  `rig-diff.mjs` (parent vs built): 392 of 510 readings identical, 118 changed = 96 legless, 19 legs that do not
  stand, 3 Felhound files; no measured reading and no seated/walker reading changed. `baseline.mjs y` vs `x`: 32
  compared, 0 differ. Retarget changes for those bodies as designed: Footman takes Walk from the Naga, size 41,382 ->
  0.517 (chest, head, arms; no problems); from the Felhound 41,382 with no part taken -> 1.12 (head, arms).
- **B** (`src/skeleton-transplant.js`): size from `rigSizeRatio`, leg travel only when both stand. `report.follows`,
  `report.still`, `report.notes`; `reasons` = share line, "different number of legs", "No counterpart in the donor:
  ...", hard reasons, notes. Bind poses, "Sized by the bodies' overall size", "The result's legs were not read" and
  the safety-net sentence are notes. **One deviation:** `follows` counts skin by part (skin under any joint of a
  part that got a donor joint), not by joint as the B1 sketch reads: the joint form gave 0.74 for the Kurgan on the
  Naga, the part form 0.903 as F2 and `coverage.mjs` (whose figures set the 0.5 cut) define it. Five strings added
  to the five catalogs, two retired; catalog sizes updated; harness story checks the share line and <= 4 sentences;
  `docs/TRANSFER.md` Poor fit row. Tests Z1-Z4, F1-F6; T10 reads `fit` (Z1, Z3 already pass after A alone).
- **Weapon bone** (passed on from the class 7 verdict): the donor's weapon point counts only when its first part
  joint is an arm's hand (or the bone hangs beside the arm's last joint, as the Ghoul's `Bone_Hand_L`), or when it
  hangs under no part joint (the Tauren's totem: T6/T11 unchanged). Else the weapon stays in the hand it pairs with;
  `report.weapon.note` names the bone. Test W1 (Footman on the Gargoyle, Weapon Ref on `Bone_Head`) fails before.
  Footman and Kurgan on all 59 donors: 41 runs change, all head, leg, body, jaw or tentacle bones (Gargoyle, Kodo,
  dragons, Hydra, Wyvern, Skink, Frog, Dire Wolf, Catapult, Grizzly's front paw read as a leg, Sheep, Penguin, ...).
- **Owner's sheet:** the five legless cases built by `src` at B (`legless-compare.mjs`) equal the approved
  `TEST LEGLESS 0N AFTER.mdx` exactly (max difference 0, no structural difference). With the weapon rule, Footman
  on the Dune Worm differs from its After in one way: the sword stays in the hand instead of riding the worm's head.
- **Fingerprint for B** (`fingerprint-compare.mjs preB26 postB26 B`, 3,068 runs, 2 idle processes): 1,748
  must-be-identical runs, 0 differ; 1,190 changed as designed, none with a size outside 0.1 to 10 or a throw.
- Tests: skeleton-transplant + transplant-skin 46/46, anim-transfer + transfer-window 89/89, localization 20/20.
- **Failure sweep again** (all 1,593 pairs, window default, 2 idle shards, 27 min; `failure-sweep/rows26-*.jsonl`,
  `analysis26.txt`). `sweep.mjs` keeps every old measure and adds the gate's three as extra classes ("new: ...",
  left out of the fine/broken totals so they stay comparable; the old version is `sweep-before26.mjs.bak`).

  | Window default | Before (`analysis.txt`) | After |
  | --- | --- | --- |
  | fine / broken / doubtful | 466 / 748 / 379 | **866 / 102 / 625** |
  | size outside 0.05-20 | 452 | 0 (sizes 0.17 to 12.9, median 1.03) |
  | throws | 141 | 0 |
  | exploded shape / extents absurd | 29 / 21 | 0 / 0 |
  | weapon on hidden bone | 90 | 0 |
  | flung vertices (old measure) | 296 | 74 |
  | new: flung on donor bones | - | 8 |
  | mesh vanishes (old measure) | 20 | 28 |
  | new: mesh vanishes (bone collapsed where the donor's is not) | - | 0 |
  | sinks / floats (old measures) | 513 / 395 | 395 / 257 |
  | new: feet off target | - | 5 (Frog x2 at 0.34, Felhound x2, Hippogryph) |
  | slow (over 2 s) | 172 | 92 |
  | poor without a cause | 59+ | 0 |
  | good with size outside 0.1-10 | 33 | 1 (Doom Guard on the Skink, 10.3) |

  Sizes above 10: two standing bodies on the tiny Skink (Blood Dragon 12.9, Doom Guard 10.3): measured hip heights
  on both, the unchanged branch, real proportions. The old mesh-vanishes count rose because more pairs are now at
  sane scale where the donor's body collapses (class 6, kept as donor motion); the new measure finds none.
- Package `TestBuilds\transfer-xl-26`; whole transfer harness hidden with the sweep: 70 checks, 0 errors, 151
  controls, passed (Kurgan on the Magnataur: share line + 2 sentences). Launcher
  `_START HERE\7 TRANSPLANT - in the XFER window.cmd` opens build 26 on `TEST TRANSPLANT 11.mdx` (Kurgan copy)
  and names Naga Myrmidon, Felhound, Spider and the Tauren.

Open: package C (own gore pieces) on hold; the five "new: flung on donor bones" Death/Birth pairs (Penguin, Wyvern,
Phoenix Egg, Sheep) not judged; owner's eye on build 26 pending.

## Twin chains and how he dies (builder: Claude Opus, 19 Nov 2026)

Cause (investigation in `out/transfer-probe/owner-choices/gore-why/`): the Ogre's "plank" is his off-hand weapon
`Cylinder03` on a second left arm (`Bone_Root#25 > Bone_Chest#3 > Bone_Arm1_L#8 > Bone_Arm2_L#44 > Bone_Hand_L#52`,
pivots on the real chain's); the Ghoul's Death hides his living body and shows a corpse copy on a second skeleton
(`Bone_Waist01`, `Bone_Root01`, ...). Both sat in `outsideKept` and were frozen.

- **Part 1, twin chains (`src/skeleton-transplant.js`, `twinChains`; recogniser untouched).** An own joint outside
  the body whose pivot lies within `TWIN_NEAR` = 0.03 hip heights of a body joint (under its parent's twin), in a
  group of 2 or more, is that joint's twin: its skin goes where the twin's goes. A group whose skin shows in everyday
  animations is taken only when it moves with its twins through the own Stand (within 0.03). Measured over the
  library (`gore2/twin-scan.mjs`, `scan-sd.txt`, `scan-lpw.txt`): Ogre and Ghoul twins at 0 to 0.022; the nearest
  pivot pair that is no twin 0.044; Khorne/Nurgle knights' `Object22` pairs coincide but move 0.07 apart in Stand
  (not taken). Death-only groups (the Ghoul's corpse) are not taken by default.
  - Ogre on the Tauren (`gore2/twin-probe.mjs`): weapon against left hand varies by 1.85 hip heights (HEAD, Attack
    Slam) -> 0.000.
  - Fingerprint (`fingerprint-compare.mjs preT postT T`, 3,068 runs, 2 idle processes): 2,950 must-be-identical
    runs, 0 differ; the 118 that change are exactly the Ogre (LPW) on all 59 donors, Mirror off and on, none with
    a bad size or a throw. Retarget `baseline.mjs z` vs `y`: 32 compared, 0 differ.
  - Not changed: an emitter or attachment under the twin chain rides the twin's target (emitter) or stays the donor's
    (attachments); pieces under a twin that move by themselves are not listed as extras.
- **Part 2, `deathBody` option (default `'own'`, unchanged).** `'living'` ("Living body dies"): in the donor's
  Death and Decay every geoset shows as the own Stand shows it (living body follows the donor and dies; corpse
  copies, gut piles hidden). `'follow'` ("Corpse follows"): death-only groups on twin skeletons become twins when
  their vertices are at least `TWIN_DEATH_SHARE` = 0.9 of the living body the own Death hides (shown in the own
  Stand, hidden at the end of the own Death; Ghoul 535 of 535, Knight 208 of 629, Skeleton Warrior 0); the own
  swap moment is kept in Death, Decay shows the end of the own Death, death-only meshes not on twins (the Ghoul's gut
  pile) are hidden. Otherwise `'follow'` is `'living'` exactly (test G5). `report.deathBody`, `report.twins`.
  - Found on the way, not fixed (shared refit, changes default): the own geoset showing refit into the donor's
    Decay drops the Ghoul's keys (`refitTracks`: own keys at the very start of Decay Flesh are lost), so today's
    default shows his living body, not his corpse, in Decay.
- Tests (`test/skeleton-transplant.test.js` G1-G5; fixtures `transfer-ogre-twin` = new
  `MDLxL-TestModels/transfer-gore/WH_WOC_Ogre10.mdx`, `transfer-skeleton`): all five fail on HEAD's engine (G1:
  "Stand -1: the weapon against the hand varies by 0.085 hip heights"); skeleton-transplant + transplant-skin
  51/51, anim-transfer + transfer-window 89/89.
- **Owner sheet** (`gore2/gore2-sheet.mjs`, `gore2-sheet.txt`; models `TestBuilds\test-models\TEST GORE2 0N
  BEFORE|A|B.mdx`, `TestBuilds\transplant-review-gore2\cases.json`, launcher `_START HERE\7 TRANSPLANT - how he
  dies.cmd` on build 26). BEFORE = HEAD's engine.
  1. Ogre on the Tauren: A = B (no death-only body); Before / After, "Looks right" / "Looks wrong". After vs Before
     up to 1.62 hip heights (Death), 1.49 (Attack Slam), 0.99 (Attack - 1); the weapon now moves with the hand.
     After also shows the body through Decay (A's rule) where Before shows nothing.
  2. Ghoul on the Grunt: Living body dies / Corpse follows. A vs B up to 0.65 hip heights in Death (1.2 s) and 1.32
     at the start of Decay Bone. **The Ghoul's corpse is a copy of his living mesh**, so the two look alike: the
     difference is the hands (the living claws ride the Grunt's axe bone as the weapon; the corpse's claws are
     skinned to the hand bone and stay with the hand) and the gut pile (hidden in both).
  3. Skeleton Warrior on the Grunt: B falls back to A; Before / After. Before shows nothing of his body in the Death
     (his living body hidden, the corpse frozen off to the side); After shows him dying with the Grunt.
  Hidden click run on build 26 (`out/compare-sheet-gore2/`, `results.txt`): 3 cases, 6 looks, Flip, answers, Done,
  no page errors; PASSED.

Open: owner's pick on the gore2 sheet; then set the `deathBody` default and offer it in the window if he wants a
choice; the Decay refit gap above.

### Owner's verdict on gore2 and the follow-up (19 Nov 2026)

Ogre: "Looks right". Ghoul: "both look wrong": Living body dies "contorted, legs stretched long and splayed, torso
twisted"; Corpse follows "tiny, about a third, also contorted". Measured (`gore2/ghoul-why.mjs`, `leg-len.mjs`,
pictures by `out/compare-sheet-gore2/death-shot.cjs`, which scrubs the sheet's own time slider):

- **Torn skin: no.** Edges outside 0.5-1.5x of their bind length: the Ghoul's own Death 8-16 of 1,389 (worst 2.3x);
  the transplant's Stand - 1 16 (2.1x), Attack - 1 40 (2.9x), Death 12-24 (2.6x). All at elbows and knees (rigid SD
  skin), the same in every transplanted animation.
- **Long legs: his own.** Thigh-to-foot piece distance: own Stand 23 (crouched), own Death end 54; transplant Stand 36
  (shin straight along the Grunt's chord, the owner's pick), Death end 50-56. Lying, the Ghoul's legs are that long
  in his own Death too.
- **Tiny: not reproduced.** Corpse follows and Living body dies have the same size at every Death moment (box at the
  end 95x134x88 against 95x115x77; Stand 71x78x83) and in the pictures.
- **Real bug (fixed):** where the donor hides its own body (the Grunt's Decay Bone shows a bone pile on other
  joints) both choices still showed the Ghoul, on joints the Grunt does not move there: standing, 147 wide, edges
  stretched up to 5.0x. Now `holdShowing` follows the donor body's showing (its biggest geoset shown in its Stand),
  as the owner ruled for the totem. Test G6 fails before. The Ogre's After now also vanishes in the Tauren's Decay.
- Corpse follows differs from Living body dies only at the hands (0.65 hip heights in Death, 0.56 in Decay Flesh):
  no real choice, so the Ghoul case is now Before / After (`TEST GORE2 02 BEFORE|A.mdx`, "Does he die right?", id
  `ghoul-grunt-2` so it opens unanswered; the owner's `answers.json` is kept). Tests 52/52 and 89/89, baseline `z2` 0
  differ, fingerprint `postT2` 2,950 must-be-identical 0 differ (118 Ogre runs as before). Hidden click run: every
  check passed; its last check fails only because the owner's real answers file already exists. Pictures
  `out/compare-sheet-gore2/v3-case2-*.png`: lying at the end of the Death, same size as the Grunt, nothing in Decay Bone.

### The living body dies: default, build 27 (19 Nov 2026)

Owner on the gore2 sheet: Ogre, Ghoul (`ghoul-grunt-2`) and Skeleton Warrior all "Looks right", then "GO".

- `src/skeleton-transplant.js`: in the donor's Death and Decay every keyed own geoset shows as the own Stand shows it
  (`holdShowing`): the living body dies with the donor, death-only meshes (corpse copies, gut piles) stay hidden, and
  nothing shows where the donor hides its own body (its biggest geoset shown in its Stand). The `deathBody` option
  and "Corpse follows" are removed (it differed only at the hands); twin chains are again only the everyday ones.
  Not covered: a geoset with no visibility keys stays shown everywhere, as before (no keys are added to the model).
- Tests G1-G5 (`test/skeleton-transplant.test.js`): G3 Ghoul and G4 Skeleton Warrior show the living body and hide
  the corpse through the Grunt's Death, G5 nothing in the Grunt's Decay Bone; all three fail on b155b3f0.
  skeleton-transplant + transplant-skin 51/51, anim-transfer + transfer-window 89/89, baseline `z3` vs `y` 0 differ.
- Fingerprint (`postT2` -> `postL`, `fix-design/fingerprint-postL-changes.txt`): 2,940 of 3,068 runs change, 128
  identical. Bytes change for every own model with keyed geosets (Death/Decay keys rewritten); the visible change
  (`gore2/who-changes.mjs`): every sweep own model but three has death-only meshes or a living body its own
  Death/Decay hides (most SD models swap to a bone pile in Decay Bone), so nearly every pair shows differently in
  the donor's Death/Decay. Unchanged: Archmage (no keyed geosets), Kurgan and Lord of Change (nothing death-only).
- Failure sweep (`failure-sweep/rows27-*`, `analysis27.txt`, 2 idle shards), window default against build 26:

  | Window default | Build 26 | Now |
  | --- | --- | --- |
  | fine / broken / doubtful | 866 / 102 / 625 | **875 / 58 / 660** |
  | flung vertices (old measure) | 74 | 40 |
  | mesh vanishes (old measure) | 28 | 18 |
  | new: flung on donor bones | 8 | 9 (+Ghoul on the Wyvern and the Blood Dragon Nightmare, -2 gone) |
  | floats / sinks (old measures, donor motion) | 257 / 395 | 265 / 397 (all new ones the Ogre in Decay on fliers, Hydra, Penguin: his body now shows there) |
  | feet off target | 5 | 5 |
  | said good but broken | 27 | 16 |

  (The first two shards were started without `PREFIX` and overwrote the 12-shard run's `rows-0/1.jsonl`;
  `analysis.txt` from that run is kept.)
- Package `TestBuilds\transfer-xl-27` (TEMP on D:); `transfer` harness hidden with the sweep: 70 checks, 151 controls,
  passed. Launcher `_START HERE\7 TRANSPLANT - in the XFER window.cmd` opens build 27 on `TEST TRANSPLANT 12.mdx`
  (Kurgan copy).

## Posture: a transplant is 100% a transplant (builder: Claude Opus, overnight 19-20 Nov 2026)

Owner (19 Nov, quoted): "A TRANSPLANT IS 100% A TRANSPLANT." The Khorne Berserker on the Ghoul stood upright with its
arms folded into its body while the Ghoul is hunched with long arms hanging at its sides. Two causes: the engine kept the
open model's own trunk posture on purpose (v2 skin contract: "Making them equal ... Not proposed"; arms carried a constant
key correction), and POSE reads the Ghoul's arms to `Wrist1`/`Wrist2`, still forearm skin bones whose pivots are parked in
its chest, so the forearm was aimed into the chest. Commits `0f2a8185`, `f828a91b`, `85f5b78b`. Scripts, pictures and data in
`out/transfer-probe/overnight/posture/`.

What the engine does now (`src/skeleton-transplant.js`, default, no option):
- The donor's rotation keys are copied as they are; the posture lives in the bind pose. The mesh is re-posed into the
  donor's rest posture on this model's proportions: each donor joint sits where its parent's turn carries it, each vertex
  turns with the bones it is bound to (blended by weight). Own nodes hanging on a donor joint (effects, a kept piece) keep
  their place in the world; a donor joint this model lacks and with no skin of it (a tail) keeps the donor's offset.
- Limbs: every stretch along the donor's (as before; straight shin, feet down and the weapon rules unchanged).
- Trunk, for donors with legs and two arms: it turns as one piece so the hip centre (first leg joints) to the shoulder
  centre (first arm joints) points as the donor's, the shoulder line twisted to follow; landmarks, not trunk pivots
  (riggers put a chest pivot anywhere: the Tauren's sits 5.8 behind its root). The donor's trunk joints (hips, chest and
  the joints between) are placed in this model's trunk where they sit in the donor's (hip-to-shoulder length, shoulder
  width), and the trunk skin is shared between them where the donor's own trunk skin is (median height of each joint's
  skin, 10% band), so the body bends where the donor's does (v2 item 4 "trunk included"). A vertex shared with a limb keeps
  the trunk joint that limb hangs from. Legless or armless donors (Naga, Banshee) keep this model's trunk, as before.
- Neck, for every donor with a neck joint: the neck joints turn so the first neck joint to the head joint points as the
  donor's; the head joint keeps the donor's turn (as a foot). A head's moves are scaled by the neck's own length. A neck
  placed inside the chest takes only skin within half the distance to the nearest shoulder (`splitJoints` `radius`).
- `transplantReading` (exported): a limb whose last joint is a still skin carrier with one moving joint beside it ends at
  the moving joint (Ghoul: `Bone_Hand_R/L`). Retargeting keeps the shared reading (the recogniser gap is still there for
  Retarget; see open points).
- Feet: `settleFeet`/`feetDown` read the result's legs through the id map (the donor's legs), not by reading the re-posed
  result again (Grunt on the Ghoul read the Ghoul's corpse skeleton: 88 off in Stand Victory). This is the analyst's F1.
- `report.counts.posture` (spine and neck turn, degrees), `report.repose` (result node -> turn its skin took).

Tests (`node --test test/skeleton-transplant.test.js test/transplant-skin.test.js`: 57 pass):
- New Q1 Berserker on the Ghoul (fixture `transfer-berserker` = new `MDLxL-TestModels/transfer-posture/WH_WOC_WarriorKhorneBerserker03.mdx`),
  Q2 Kurgan on the Tauren, Q4 Footman on the Ghoul: at 9 moments of Stand, Walk, Attack and Death every arm stretch, the
  thigh, hips>shoulders and the neck within 3 degrees of the donor's (world, both face the same way); arms at least 80% of
  rest length and reach; no hand inside the torso where the donor's is not. Q3: every donor rotation key is the donor's.
  Q4 also: POSE reads the Ghoul's arms to `Wrist*`, the transplant to `Bone_Hand_*`. Q1-Q4 fail on df9c4059 (Q1 "arm
  Bone_Arm2_R > Bone_Hand_R up to 74.1 degrees", Q2 "spine up to 25.3", Q4 "125.1"). Q5 (feet through the id map) fails
  when the result is read again (88.3 off). U8 (`radius`).
- Expectations that encoded the old rule, changed: P2 neck skin 14 -> 1 vertex, moved 34 -> 21, blended 1 -> 2 (the neck
  no longer takes the collar ring, since it now turns away from the chest at rest; trunk shares are counted apart in
  `counts.skin.trunk`); T6, T11, T7 find the result's hand through `donorNodes` and carry the Kurgan's grip through
  `report.repose` (they assumed the result's hand sits on the Kurgan's pivot in the Kurgan's rest pose).
- Unchanged: `node --test test/anim-transfer.test.js test/transfer-window.test.js` 89 pass; `baseline.mjs p1`,
  `baseline-compare.mjs z3 p1`: 32 compared, 0 differ.

Measured (`posture/measure.mjs`, worst degrees off the donor over Stand, Walk, Attack, Death; before = df9c4059):

| Pair | limb | hips>shoulders | neck |
| --- | --- | --- | --- |
| Berserker on the Ghoul | 74.1 -> 0.0 | 70.8 -> 0.3 | 99.8 -> 0.0 |
| Kurgan on the Tauren | 0.0 -> 0.0 | 36.4 -> 0.1 | 138.7 -> 0.0 |
| Footman on the Ghoul | 125.1 -> 0.0 | 78.2 -> 2.5 | 88.1 -> 0.0 |
| Kurgan on the Naga | 0.0 -> 0.0 | 15.9 -> 15.9 (legless: trunk kept) | 111.6 -> 0.0 |

Panel (the other worker's `panel.mjs`/`look.mjs` of 23:51, base = df9c4059 snapshot and this engine run back to back:
`posture/panel-posture-base8.json`, `panel-posture8.json`, `panel-compare8.txt`, table by `panel-table.mjs`): verdicts
ok 5 -> 18 of 61; mean of per-pair medians: posture pitch 27.2 -> 0.4, spine 27.6 -> 0.7, neck 48.3 -> 17.3, arm upper
22.0 -> 3.4, arm lower 24.8 -> 12.4, leg upper 28.8 -> 3.6, leg lower 34.4 -> 8.6. The gate still lists 32 pairs with
some metric worse (47 better). The reasons, by class:
- arm.lower on the Ghoul (6 pairs, about 20 -> 75): the yardstick reads the Ghoul's arm to `Wrist1`, the still skin bone
  parked in its chest; against its moving hand the forearm is 0.0 off (Q1, Q4). Yardstick fix: read the donor with
  `transplantReading`.
- leg.lower / leg.end2 on the Tauren (4 pairs): straight shin (owner's pick); the legs did not move in the world (my
  knee-to-foot measure 16 both), the yardstick's body frame now matches the Tauren's (spine 39.7 -> 0).
- neck = chest pivot > head pivot, on donors with no neck joint (Paladin, Footman x3, Grunt, Mountain Giant, Footman HD,
  Gryphon Rider; 6 -> 15 typical): the donor's chest pivot now sits where the donor has it inside this model's trunk; the
  head mesh only moves with the trunk turn (there is no neck joint to bend).
- sinks-into-ground (Footman, Grunt, Graveguard on the Ghoul; Dire Wolf on the Tauren): the lowest vertex of the whole
  mesh; the hunch brings claws and weapons low like the Ghoul's; the feet are on target (Q5).
- inside / hand-inside, small (about 10 pairs): the arms point as the donor's on a bulkier body.
- riders: Wyvern Rider on Gryphon Rider (posture 4.2 -> 7.4, neck, arms), Kurgan on Khorne Knight Axe (medians better, p90s
  worse), Knight on Wolf Rider (its tail is now measured); other rider pairs improved (Wolf Rider on Knight 70.2 -> 2.5).
- Infernal on Grunt: p90s up, medians down; Kurgan on Felhound: arm reach short 0 -> 0.19 (four-legged donor).

Mesh (`posture/mesh-check.mjs`: triangle edges over 2x / under 0.5x their bind length, 9 moments; before -> after): Berserker
on the Ghoul Stand 110/79 -> 90/57, Walk 93/109 -> 84/103, Attack 93/141 -> 82/209 (of 34,866); Kurgan on the Tauren
Stand 45/8 -> 60/15, Attack 91/24 -> 104/34 (of 25,524); Footman on the Ghoul Stand 12/9 -> 85/42, Walk 20/46 -> 86/56,
Attack 20/29 -> 81/82 (of 6,543: its tabard is bound to chest and thighs and the Ghoul crouches 62 degrees). Pictures
(software render; donor blue, before red, after green; side then front): `posture/pictures/0N *.png`.

Trial models (`posture/make-posture-trials.mjs`, validated and reopened, 0 errors; Mirror as the window sets it):
`TestBuilds\test-models\TEST POSTURE 01|02|03|04 BEFORE|AFTER.mdx` = Berserker on the Ghoul, Kurgan on the Tauren,
Footman on the Ghoul, Kurgan on the Naga. Not opened in a packaged build (no build made).

Open points and risks:
- Fixed overnight (e795111e..82a73f98, `xfer-overnight.md` Log): the Ghoul as donor hid the result for its whole Death. Now
  the donor corpse swap: where a donor hides its living body and shows a death body on a twin skeleton, the living joints
  take the twins' placement there and the body stays visible (`donorDeathSwap`, `report.deathSwap`, tests C1).
- POSE (the shared recogniser) reads the Ghoul's arms to `Wrist1`/`Wrist2`; Retarget still aims at them (the Ghoul is in
  the retarget baseline, so it was left alone tonight). The fix belongs in `src/pose-ik.js` with the POSE corpus diff.
- Rigid pieces follow the re-posed trunk: capes and shields stick out where the donor hunches (the Berserker's cape; the
  Footman's tabard stretches). The Kurgan's neck band turns 139 degrees into the Tauren's (the head hangs forward of the hump).
- The Tauren's hump is mesh, not skeleton: its trunk line leans only 18 degrees, so the Kurgan changes little there.
- Riders as donors are mixed (above). Legless donors keep this model's trunk line.
