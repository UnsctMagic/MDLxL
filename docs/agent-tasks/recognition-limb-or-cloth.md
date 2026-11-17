# Recognition: limb or hanging cloth (step 1 of the shared recogniser work)

Status: contract written 17 Nov 2026 (director: Fable). A, B, C and D built the same day (see
Result; D follows "D, the decision"). Not seen by the owner in the app yet: no test build was
made. Local only, branch `claude/transfer-xl`.

## Owner intent (17 Nov 2026, quoted)

On Transfer reading a Bray Shaman's chest scrolls as legs and offering Rider / Mount:
"I think we already have a good way to do things with pose - we have many checks: Geoset pose and
silhouette, Skeleton, Bone names, Animations, and additionally a constructed pose handle. From all
these, we cannot infer that the scrolls are scrolls?" and "The way we recognise pose handles - this
has to be built and improved upon. This is the engine that we use, mdlxl wide, to recognise shit -
this can be used in more places! ... we have something we arent using fully". Earlier the same
night: "Stop auto patching". Standing rules for this work: no model-specific or name-only rules,
no regressions, a fix made once at the source instead of once per tool.

## The weakness

`inferPoseBranches` (`src/pose-recognition.js`) calls an unnamed, mirrored, moving, skinned chain
of three or more joints that points down a `leg`. It then compares such chains only with each
other, never with the legs the rig already has. So strips of cloth become legs:

- Bray Shaman (`D:\Claude\lpw-main\dist\models\gluma\357293\bray_shaman_unit.mdx`, `_hero`):
  `bone_scroll_L_1..3` and `_R_` hang from `Bone_Chest`, the joint the arms hang from, end 21 units
  above the floor of a 124-tall model, and turn 34 to 41 degrees in Walk where the real legs turn
  72 to 83.
- Blood Dragon nightmare rider (test collection `transfer-riders/`): `Fur_Panel_*` under the
  rider's chest. Its real legs (`R_RiderRL1..`) are keyed but still, so the recogniser does not
  see them at all.

The evidence to tell them apart is already measured or one call away (`poseRecognitionEvidence`:
swing, clips, skin centre, mirror error; `poseSkinFlatness`). Nothing combines it for this question.
Transfer carries a private patch instead (`readRig` in `src/anim-transfer.js`, the "cloth strips"
block that builds `seatedChains`), which only works after a rider was already found.

## What to build

Four parts, in this order. Stop after A and after C and write the result into this note.

### A. Measure first (no behaviour change)

A probe `out/transfer-probe/cloth-measure.mjs` over every model of `D:\Claude\MDLxL-TestModels` and
`D:\Claude\lpw-main\dist\models`. For each model: `suggestPoseRig(model, standFrame, stand)`, and
for every chain of kind `leg` whose label is not `Wing`, one row with:

- `attach`: with A = the nearest common ancestor of the non-wing arm chains' roots in the same
  hierarchy root: 1 when this chain's root is a descendant of A and at least one other leg chain
  of that root is not; 0 when it is not a descendant; null with fewer than two arms or when every
  leg descends from A (a flat rig).
- `flat`: `poseSkinFlatness(model, evidence, ids)` (null under 8 vertices).
- `reach`: (this chain's end z minus the lowest leg end z of the same root) / the root's joint
  height, at the first Stand frame.
- `phase`: in the first animation named Walk, the correlation over 16 frames of the forward
  position of this chain's end (relative to its top joint) with its mirror partner's; null when
  there is no Walk, no partner, or either end moves under 5% of the chain's length.
- `swing`: the top joint's largest turn in Walk, and the same for the root's most-turning leg.
- `name`: `limb` when a joint's `nameRegion` is `leg` or its role is Foot or Hoof; `cloth` when a
  name token is a cloth word (cloth, cape, cloak, banner, scroll, ribbon, strap, tassel, skirt,
  tabard, loin, fur, panel, flap, sash, hair, beard, braid); else null.
- vertices bound, joints, model, chain root name.

Write the rows to `out/transfer-probe/cloth-rows.json` and, into this note, the distribution of
each clue for three groups: named limbs, named cloth, unnamed. The named groups are the reference:
the unnamed ones are what the score must sort. Do not tune anything before this table exists.

### B. The answer, in the shared engine

In `src/pose-recognition.js`, a new export (nothing existing changes):

```js
/** Whether a chain the rig reads as a leg is a limb or hanging cloth, from several clues.
 * -> { kind: 'limb' | 'cloth' | 'unsure', score, clues: { attach, flat, reach, phase, name } } */
export function poseLimbOrCloth(model, rig, chain, { evidence, sequence } = {})
```

Rules for the score:

- A sum of graded clues, cloth positive, limb negative. Starting weights, to be replaced by what
  table A supports: hangs from the arms' joint +2; flat sheet (under .3) +2, tube (over .5) -2;
  pair moves in phase +1, in antiphase -2; reaches the floor -2, stops short while the root's
  other legs reach it +1; cloth name +2, limb name -3.
- `cloth` needs at least two clues that agree and a score of 3 or more; 0 or less is `limb`; in
  between is `unsure`. No single clue may decide, a name least of all.
- `unsure` is treated as `limb` by every caller: today's behaviour.
- One cloth word list, exported from `src/rig-names.js` beside `WEAPON_WORDS`. Do not change
  `poseExcludedBranchName` or `poseNonAnatomyName`: they feed the rig itself.

### C. Transfer asks the engine instead of its own rule

In `readRig` (`src/anim-transfer.js`):

- The condition of the "cloth strips" block becomes "every chain read as the seated creature's leg
  is `cloth` by `poseLimbOrCloth`" (today: "hangs from the joint its arms hang from").
- A seat found by the hanging-legs rule whose hanging legs are all `cloth`, and for which that
  block finds no real pair of legs under a hip, is not a rider: clear it and let the two-heads rule
  run. This is what makes the Bray Shaman one creature again while the nightmare rider, whose real
  legs the block finds, stays exactly as it is.

### D. The handles themselves (only after C is reported)

`suggestPoseRig` with `clues` on (POSE's handles, Bone Namer, Transfer) stops offering a `cloth`
chain as a leg: it keeps the chain, as kind `arm` with label `Chain` is today for repeated
branches, under a new label `Cloth`, so nothing that iterates chains loses a joint. With `clues:
false` (ANIM, Attachemator, Auto Corpse) nothing changes, ever. Before building D, list every model
whose handle set would change and put the list in this note; if a real leg is on it, stop.

#### D, the decision (director: Fable, 17 Nov 2026, after the dry run in Result)

The dry run failed because a new label is a new thing every reader has to learn, and each one that
had not learned it read the strip as an ordinary arm. So D adds no label.

- **The handle is a plain bone chain.** A leg chain `poseLimbOrCloth` calls `cloth` becomes kind
  `arm`, label `Chain` (the label repeated branches already carry), with one extra field
  `cloth: true` that records why. This replaces "a new label `Cloth`" above.
- **Which chains.** `suggestPoseRig` with `clues` on reads the rig as before, asks
  `poseLimbOrCloth` about every leg on that complete rig (exactly what parts A and B measured and
  C uses), and only when one is `cloth` reads the rig a second time with those chains as cloth
  chains from the start, so the chest, pelvis and body are found without them. The floor is read
  in the model's own Stand, never the animation POSE happens to be in. `unsure` stays a leg.
- **`poseLimbOrCloth` gives the same answer on a rig that already carries it**: a `cloth` chain is
  measured with the legs and is not one of the arms the `attach` clue reads.
- **One rule per reader:**

  | Reader | Rule for a cloth chain | Code change |
  | --- | --- | --- |
  | POSE handles (`app/PoseControls.jsx`, `app/pose-overlay.js`) | What `Chain` does: part "Chain", bends as "Bend", editable as a bone chain. No new word on screen. | none |
  | POSE body pull (`limbBodyTarget`, `src/pose-ik.js`) | What `Chain` does: dragging it never pulls the body. | none |
  | The rig itself (`suggestPoseRig` chest, `posePartGaps`) | What `Chain` does: not one of the arms that mark the chest, not a leg that marks a pelvis. | none |
  | Bone Namer (`src/bone-namer.js`) | What `Chain` does: its joints keep their names. (Before D the strips were renamed as legs.) | none |
  | ANIM, Attachemator, Auto Corpse (`clues: false`) | Never see one. | none |
  | Transfer (`src/anim-transfer.js`) | Its own rule, below. | yes |

- **Transfer.** Today Transfer reads a `Chain` as an arm (a Mind Flayer's tentacles), so here
  cloth needs its own rule, in two halves:
  1. *Cloth is no limb.* No reading (both, seated, walker) makes a part of a cloth chain, and it
     is not one of the arms that find the chest or a creature's free arms. Its joints are then
     ordinary joints outside the parts, as a cape's are: they keep the open model's own motion and
     can follow as loose joints.
  2. *Cloth can still point at a rider.* For the search for a seated creature only, a cloth chain
     counts as a leg that hangs (never as one that walks). This is the reading after C, kept:
     strips hanging astride a walker from a subtree with arms of its own have the shape of a
     rider, cloth alone proves nothing, and C's rule already demands a real pair of legs under a
     hip before such a seat counts. Transfer reads `chain.cloth` from the rig and no longer asks
     the recogniser itself.
- Not chosen: label `Cloth` with a rule in every reader (five places to keep in step, a new
  untranslated word on POSE's handles, and POSE setup would open a `Cloth` handle as a single
  joint because it only knows its own part names); dropping the strips from the rig (the
  contract keeps every chain so no joint is lost).

## Proof, all of it, before hand-back

- **The rig as every tool reads it.** New probe `out/transfer-probe/pose-dump.mjs`: the JSON of
  `suggestPoseRig` for every model, with `clues` on and off. After A, B and C it is identical in
  both modes. After D it is identical with `clues: false`, and with `clues` on it differs only in
  the listed models.
- **Transfer readings.** `node out/transfer-probe/rig-dump.mjs <tag> D:/Claude/MDLxL-TestModels
  D:/Claude/lpw-main/dist/models` before and after, then `rig-dump.mjs diff`. Expected: the two
  Bray Shamans become one creature. Every other difference is listed and explained; the nightmare
  rider, the dragon rider, the Cold One Rider and all knights are unchanged.
- `node out/transfer-probe/baseline.mjs after`, `baseline-compare.mjs before2 after`: `0 differ`.
- `node out/transfer-probe/riders-gate.mjs`: 95 built, 1 flag, as now.
- `node --test test/anim-transfer.test.js` (45 now) plus new tests, each failing on the old code
  first: the shaman is one creature; `poseLimbOrCloth` calls the scrolls and the fur strips cloth
  and every native unit's named legs limbs; a name alone does not make cloth. Add the two shamans
  to `D:\Claude\MDLxL-TestModels\transfer-riders\` (add only) and to `test/helpers/fixtures.cjs`.
- Bone Namer and POSE source tests (`node --test test/bone-namer*.test.js test/pose*.test.js`).
- Once at the end, the source suite the CI way (`.github/workflows/ci.yml`, the
  `check-test-baseline.mjs` step): 0 new failures. No packaged suite, no test build.

## Rules for the builder

- Work in the worktree `D:\Claude\MDLxL\.claude\worktrees\transfer-xl`, branch `claude/transfer-xl`,
  one writer. Commit locally with the Fable co-author trailer the earlier commits use only if
  Fable wrote it; otherwise your own. Never push, open a PR or post anything.
- If a result cannot be explained, stop and write what you saw into this note. Do not patch
  around it. The director reviews exactly those points.
- Shell heredocs lose backslashes on this machine: write scripts with the Write tool.
- Read first: `docs/agent-tasks/transfer-xl.md` rounds 9 and 10, `docs/ARCHITECTURE.md` if a
  preview is touched (none should be), `docs/TESTING-RULES.md` before writing tests.
- Out of scope: the Meat Wagon and the jezzail crew (different causes), FX, any window change.

## Result (builder fills this in)

Status: A, B and C built 17 Nov 2026 (builder: Claude Opus), local commits on `claude/transfer-xl`.

- A, the table (`out/transfer-probe/cloth-measure.mjs`, rows in `cloth-rows.json`, full text with
  every cloth and unnamed row in `cloth-summary.txt`). 1,164 models (36 byte-identical copies
  measured once, 36 without animation or skeleton, 0 failed), 2,507 chains read as legs. Phase
  over 16 frames of the first Walk, forward = +X; "swing ratio" = top joint's largest turn in Walk
  over the root's most-turning leg's.

  | Clue | Named limbs (2,423 chains, 875 models) | Named cloth (6 chains, 3 models) | Unnamed (78 chains, 32 models) |
  | --- | --- | --- | --- |
  | attach 1 / 0 / null | 34 / 1,731 / 658 | 6 / 0 / 0 | 10 / 46 / 22 |
  | flat median (p10 to p90); under .3; over .5 | .69 (.42 to .88); 38 of 2,411; 1,997 | .25 and .41 (4 null: 6 vertices); 1 of 2; 0 | .60 (.14 to .91); 23 of 77; 47 |
  | reach median (p90); under .05; over .15 | .001 (.066); 2,150; 99 | .17 (.57); 0; 6 | 0 (.16); 49; 15 |
  | phase median (p10 to p90); under -.5; over .5 | -.82 (-.97 to .86); 1,418 of 2,113; 313 | .44 and 1; 0 of 6; 2 | .07 (-.95 to .80); 28 of 60; 14 |
  | swing ratio median; under .6 | .95; 361 of 2,219 | .5; 4 of 6 | .66; 26 of 60 |
  | vertices median (p10 to p90) | 46 (29 to 81) | 6 (6 to 18) | 70 (21 to 196) |

  Named cloth is only the two Bray Shamans' scrolls (attach 1, flat null, reach .16 to .17,
  phase .44) and the nightmare rider's two fur strips (attach 1, flat .25/.41, reach .56, phase 1):
  every other cloth-named joint is already kept out of the rig by `poseExcludedBranchName`.
  The 34 named limbs with attach 1 are real: the front legs of the archnathid family (scorpions,
  crabs, nerubians: they hang from the claws' joint) and the centaur archer's front legs; all
  reach the floor and swing in antiphase or are tubes. Scored with the starting weights
  (`out/transfer-probe/cloth-score.mjs`): named limbs 2,423 limb, 0 cloth; named cloth 6 cloth;
  unnamed 63 limb, 15 unsure, 0 cloth. **Without the name clue** the same: named limbs 2,405 limb,
  18 unsure, 0 cloth (highest: Baron Rivendare's rider legs, 2: in phase, short); named cloth 6
  cloth (scrolls exactly 3: attach + short; fur strips 4 and 6). So the table supports the
  starting weights unchanged; no weight was tuned. The scrolls sit on the threshold without their
  name: margin is thin there, and it is the two agreeing structural clues that carry them.
  The 15 unsure unnamed chains (today's behaviour): the Blood Elf Spell Thief's and Undead Fire
  Mage's four skirt-like chains (sheet, short, antiphase: 1), the Warden's and Spirit of
  Vengeance's Mesh05 chain (attach, sheet, floor: 2), the Tidebringer's bone_12 (1).
- B: `poseLimbOrCloth` in `src/pose-recognition.js`, `CLOTH_WORDS` and `isClothName` in
  `src/rig-names.js` beside `WEAPON_WORDS`; nothing existing changed. The clues are computed
  exactly as the probe measures them (`out/transfer-probe/cloth-check.mjs`: all 2,507 chains, 0
  values differing from the probe; engine 2,486 limb, 15 unsure, 6 cloth). The Stand and Walk
  poses it samples are kept per evidence object (`WeakMap`), so one evidence is one snapshot.
- C: `readRig` asks `poseLimbOrCloth` (cached per chain on the model's info): the "cloth strips"
  block (now `seatLegs`) runs when every chain read as the seated creature's leg is `cloth`; a seat
  found by the hanging-legs rule whose legs are all cloth and under which no real pair of legs
  hangs from a hip is cleared before the two-heads rule.
- B and C, proofs (all run 17 Nov 2026 on the worktree after C):
  - `pose-dump.mjs` (new): 1,236 models, `diff pre abc`: clues on 0 differ, clues off 0 differ.
    (Determinism checked first: two runs of the old code, 0 differ.)
  - `rig-dump.mjs diff pre abc`: 1,196 same, 4 differ, all four the two Bray Shamans (the copies
    in the test collection and in LowPolyWorks): `actors` ['both','seated','walker'] -> ['both'].
    Nightmare rider, dragon rider, Cold One Riders and every knight unchanged. Two creatures 102 -> 98.
    Their 'both' reading changed too, which follows from one creature while POSE still reads the
    scrolls as legs (part D is what changes that): the scrolls become legR2/legL2, and Bone_Chest,
    which now carries a leg, rides with the hips (`hips: Root, Bone_Chest, Bone_Pelvis, bone_hip2`,
    no `chest` part). Before, 'both' left the "rider's" legs out and had `chest: Bone_Chest`.
  - `baseline.mjs after`, `baseline-compare.mjs before2 after`: 32 trials compared, 0 differ.
  - `riders-gate.mjs`: 95 riders built, 5 skipped, 1 flagged (Kurgan on the dragon rider's Walk,
    rise x0.58), as before.
  - `node --test test/anim-transfer.test.js`: 48 pass (45 + 3 new R11). Fail first, run on the
    previous source: with the old engine the file does not load (`poseLimbOrCloth` is not
    exported); with B but the old Transfer, "R11 one creature" fails: `transfer-bray-shaman is
    one creature`, actual ['both','seated','walker'].
  - `node --test test/bone-namer*.test.js test/pose*.test.js`: 202 tests, 199 pass, 0 fail, 3
    skipped (corpus archives and the dense twin-head rider are not on this machine; unrelated).
  - Source suite the CI way (`node --test --test-timeout=300000 "test/*.test.js"`, then
    `check-test-baseline.mjs`), once, on a0078f90: 3,859 passing, 5 failing, 0 in the baseline.
    The 5 are whole files that hit the 300 s per-file limit under the full parallel load:
    `fx-emitter-depth` and `fx-emitter-persistence` 1 to 4. Rerun alone, the same 5 files: 279
    tests, 279 pass (3 min 37 s). They touch the changed code only through `nameRegion` and
    `isWeaponName` in `src/rig-names.js`, which did not change (that file only gained exports).
    Not proven against the previous commit under the same load (that would be a second full run).
  - Test collection: `bray_shaman_unit.mdx` and `bray_shaman_hero.mdx` copied into
    `D:\Claude\MDLxL-TestModels\transfer-riders\` (README line added), fixtures
    `transfer-bray-shaman`, `transfer-bray-shaman-hero`.
- D, the list of models whose handles change (measured with a dry run of D: in `suggestPoseRig`
  with `clues` on, after the inferred branches, every leg chain `poseLimbOrCloth` calls `cloth`
  became kind `arm`, label `Cloth`, and `Cloth` was left out of the chest's arms as `Chain` is;
  `pose-dump.mjs ddry`, then reverted, not committed). `clues: false`: 0 models differ. `clues`
  on: 5 files, 3 models, and in each only the strips themselves change (no role, body, node or
  other chain moves; `out/transfer-probe/pose-dump-detail.mjs abc ddry`):
  - `bray_shaman_unit.mdx` (test collection and LowPolyWorks `gluma/357293`): bone_scroll_L_1..3
    and bone_scroll_R_1..3, leg -> arm/Cloth.
  - `bray_shaman_hero.mdx` (both places): the same two scroll chains.
  - `BloodDragonNightmare_Polished_2_1.mdx`: Fur_Panel_04..10 and Fur_Panel_06..12, leg -> arm/Cloth.
  No real leg is on the list. **D was not built anyway**, because the same dry run breaks
  Transfer (the contract's own proof: "the nightmare rider ... unchanged"), see below.
- Why D stopped (the director's decision): every reader that knows `Chain` would meet `Cloth` as
  an ordinary arm. Transfer's dry-run reading (`rig-dump.mjs ddry`, diff in
  `out/transfer-probe/rigdiff-ddry.txt`, 5 files differ):
  - Nightmare rider: no longer two creatures (actors ['both']). With the fur strips no longer
    legs, the hanging-legs rule has no hanging legs to find the rider by, and the strips become
    the rider's first arms (`armL: Fur_Panel_03,06,09,12`, the real arm moves to `armL2`).
  - Bray Shamans: still one creature, the chest part is back (`chest: Bone_Chest`), but the
    scrolls become `armL`/`armR` and the real arms `armL2`/`armR2` (arms are ordered top to
    bottom and the scrolls start higher than the clavicles). A transfer onto the shaman would put
    the donor's arms on its scrolls.
  Other readers that special-case `Chain` and would need a rule for `Cloth`: `app/PoseControls.jsx`
  (`limbParts`, the part name shown is the label), `src/pose-ik.js` line 942 (IK settings skip
  Wing, Tail, Chain), `src/bone-namer.js` (Chain joints keep their names; a `Cloth` arm would get
  no name at all), `app/pose-overlay.js` (labelled chains bend as "Bend"); Attachemator reads
  `clues: false` and is unaffected. Deciding what each reader does with a cloth chain (for
  Transfer: leave the strips out of the limbs, or keep them as the seated creature's "read legs"
  for the hip search) is a design choice, not a measurement, so it is left to the director.
- Could not explain: nothing. Every difference above is traced to its rule.

### D, built (17 Nov 2026, builder and director: Claude Fable)

Built as "D, the decision" says. What changed in code:

- `src/pose-ik.js`: `suggestPoseRig` is now a small wrapper round the unchanged reader
  (`readPoseRig`). With clues it asks `poseLimbOrCloth` about every leg of the rig as read, and
  when one is cloth reads the rig again with those chains as `{ kind: 'arm', label: 'Chain',
  cloth: true }` from just after the inferred branches. A model whose Stand or Walk cannot be
  sampled keeps the rig as read. With `clues: false` the wrapper returns the first reading.
- `src/pose-recognition.js`: `poseLimbOrCloth` measures a chain already marked `cloth` with the
  legs and leaves it out of the arms, so it answers the same before and after the mark.
- `src/anim-transfer.js`: three shared predicates (`armChain` without cloth, `legChain`,
  `hangingChain` = leg or cloth). Cloth is filtered out of every reading's limbs; the rider search
  (`seatedAssemblies`' astride test, `seatLegs`, the hanging legs under the body) reads
  `hangingChain`; cloth never counts as walking. Transfer no longer calls `poseLimbOrCloth`.
- No change in `app/`, `src/bone-namer.js`, `src/attachemator.js` or any `clues: false` caller.

What changed for models (all three, nothing else in 1,236):

- **POSE handles**: the two scroll chains of each Bray Shaman and the two fur strips of the
  nightmare rider show as Chain handles (bend handle "Bend", no body pull) where they were Foot
  handles with a knee. No other chain, role, body or node moves.
- **Transfer**: the Bray Shamans (both files, both places) read `hips: Root, Bone_Pelvis,
  bone_hip2 | chest: Bone_Chest | head | armR, armL (clavicle to hand) | legR, legL`; the scrolls
  are in no part (after C they were `legR2`/`legL2` and the chest rode with the hips). The
  nightmare rider reads exactly as after C in all three readings.
- **Bone Namer** (`out/transfer-probe/namer-diff.mjs`, committed source against working):
  - Bray Shamans: the six scroll joints keep their names (before: `Bone_Leg1_Front_L` ..
    `Bone_Foot_Front_R`), and the real legs lose the `Rear` they only had because the scrolls
    were the "front legs" (`Bone_Leg1_Rear_L` -> `Bone_Leg1_L`, their meshes the same). 62 and 65
    other rows the same.
  - Nightmare rider: the six fur joints keep their names (before: `Bone_Leg1_L` .. `Bone_Foot_R`).
    The model is now named as one creature: `Bone_Body` is `Bone_Root`, the mount's hind legs and
    tail lose `Extra` (`Bone_Extra_Leg1_L` -> `Bone_Leg1_L`), `BK_Ground_BodyWeight` keeps its
    name (before: `Bone_Root`), `R_RiderHip` becomes `Bone_Pelvis_2`. Traced
    (`namer-trace.mjs`): Bone Namer makes a nested body a creature of its own only when two leg
    chains hang from it ("A named internal body is not a second actor unless two leg chains use
    it"). `BK_Ground_BodyWeight` holds the mount's forelimbs and the rider; its only "legs" were
    the two fur strips, so before D the strips made it the main creature and the mount's own
    hind legs the extra one. 92 other rows the same. Bone Namer still does not name the rider's
    real legs: POSE does not see them (keyed but still), as "The weakness" says. Not changed here.

Proofs (all run 17 Nov 2026 on the final code; outputs in `out/transfer-probe/`):

- `pose-dump.mjs d`, `diff abc d`: 1,236 models; clues off 0 differ; clues on 5 differ, the 5
  files of the list above. `pose-dump-detail.mjs abc d`: in each, only the two strip chains
  change (`leg` -> `arm/Chain/cloth`), nothing else.
- `cloth-fixpoint.mjs` (new): on the rig as now read, a chain is marked cloth exactly when
  `poseLimbOrCloth` calls it cloth. 2,614 chains asked (copies not merged): 2,589 limb, 15
  unsure, 10 cloth, 10 marked, 0 mismatches, 0 marked without clues.
- `rig-dump.mjs d`, `diff abc d` (`rigdiff-d.txt`): 1,196 same, 4 differ, the four Bray Shaman
  files, as described above. The nightmare rider, the dragon rider, the Cold One Riders and every
  knight are identical to `rigdump-abc`. Two creatures: 98, as after C.
- `baseline.mjs d`, `baseline-compare.mjs before2 d` and `after d`: 32 trials, 0 differ.
- `riders-gate.mjs`: 95 built, 5 skipped, 1 flagged (the same Kurgan Walk row); `riders-gate.json`
  is byte-identical to the one from before D (`riders-gate.abc.json`).
- `node --test test/anim-transfer.test.js`: 49 pass (48 + 1 new, "R11 hanging cloth is a plain
  bone chain in the rig and no limb in Transfer"). Fail first, on D without the Transfer rule
  (the rig change alone): the new test fails with `transfer-bray-shaman (both): no part holds a
  strip joint (hips,chest,head,armR,armR2,armL,armL2,legR,legL)`, and "R9 a rider on a
  four-footed mount" fails with actors `['both']`. The three earlier R11 tests now ask about the
  strips whether the rig reads them as legs or already marks them cloth.
- `node --test test/bone-namer*.test.js test/pose*.test.js`: 202 tests, 199 pass, 0 fail, 3
  skipped (the same three as before). `test/transfer-window`, `rig-names`, `attachemator`: 39 pass.
  The other source tests that read the changed modules (`ai-capabilities`, `auto-corpse`,
  `localization-release-labels`) with `ui-primitives`: 72 pass.
- `node scripts/bone-namer-corpus.mjs` (the gate `docs/POSE_IK.md` asks of every recognition
  change): 941 models, 0 failing; review items GAINED 245, RETYPED 10, CASE-DUPLICATE 4,
  RE-ROOTED 13 (no earlier run was kept to compare the review counts with).
- Cost: `pose-dump.mjs` over 1,236 models, both modes, 28 s where it was 21.5 s: about 5 ms more
  per model with clues on (one Stand and sixteen Walk samples, and the skin of each leg).

Not done, on purpose: no packaged suite, no full source suite, no test build, no window opened
(the brief). So nothing here was seen on screen: the Chain handles on the strips in POSE, Bone
Namer's new plan for the nightmare rider, and a transfer onto a Bray Shaman are `ready to test`.

Could not explain: nothing. Left as it is and worth the director's eye:

- Bone Namer on the nightmare rider is one creature now (above). It follows from Bone Namer's own
  rule once the strips stop being legs; whether a rider whose legs POSE cannot see should still
  be named as a second creature is a Bone Namer question, not decided here.
- The rider search still starts from cloth for the nightmare rider. A rider with still legs and
  no strips would not be found by the hanging-legs rule at all; that gap is older than this work.
- A chain marked cloth can later be relabelled `Wing` by the existing coincident-end rule (as any
  arm can). No model in the corpus does; Transfer checks `cloth` first, so it would stay out of
  the limbs.
