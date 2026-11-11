# POSE handles from several clues

Status: active
Owner / consolidator: Claude (Fable as coordinator; Sonnet agents code and run checks)
Updated: 2026-11-11

## Goal and completion criteria

- Owner, 11 Nov: "pose to work always and offer a suggested pose handle (users can
  still adjust and add)". Five clues: shape (skinned geosets), skeleton, bone names,
  existing animations, attachment points. "All these things are clues." A clear
  name is a strong clue; no clue may veto another; when names are missing or
  wrong the others must carry the suggestion.
- This replaces the reverted [PR #609](https://github.com/UnsctMagic/MDLxL/pull/609)
  (reverted by [PR #621](https://github.com/UnsctMagic/MDLxL/pull/621)). That PR
  deleted the working detector; this work only adds to it.
- Done when: the Lahmian gets both legs and its waist; every other handle change
  in the test-model library is listed and intended; AnimXL, Auto Corpse and
  Attachemator tests stay green; the owner has tried a test build.
- Nothing is pushed until the owner says "merge".

## Revision and local state

- Branch / checkout: `claude/pose-evidence-repair`, `D:\Claude\MDLxL\.claude\worktrees\pose-repair`
- Base / checked revision: `171b8bb9` (online main after the revert)
- Reference checkouts, read-only: `.claude\worktrees\pose-base` (clean main, the
  comparison baseline) and `.claude\worktrees\pose-609` (the reverted code).
- Required local fixtures: `D:\Claude\MDLxL-TestModels` (852 models, never edit).

## Relevant owners

- [pose-ik.js](../../src/pose-ik.js): `suggestPoseRig`, `poseNodeRole`, `suggestPoseChain`.
- [pose-recognition.js](../../src/pose-recognition.js): `poseRecognitionEvidence`, `inferPoseBranches`.
- Shared consumers of `suggestPoseRig`: AnimXL (`src/anim-xl.js`), Auto Corpse
  (`src/corpse-geometry.js`), Attachemator (`src/attachemator.js`).
- Guide: [POSE](../POSE_IK.md).

## Findings and decisions

- Verified: PR #609 changed the handles on 755 of 852 test models (675 of the 755
  that had limb or part handles). 406 lost a limb handle, 240 changed head count.
  Evidence: `out/pose-compare/pr609/`.
- Verified: the Lahmian's names are fine. `Hip_R` / `Hip_L` read as Pelvis, and a
  chain whose root reads as Pelvis is dropped, in both the named path and
  `inferPoseBranches`. `Waist` has no role. `Hair_Rear_Root` reads as Body.
- Decision: the comparison of every test model against clean main is the gate
  for each step. A handle change that is not in the step's list of intended
  changes stops the step; it is never tuned away.
- Decision: recognition quality without names is reported as a percentage over
  the whole library (blank the names of models that work today and count how
  many of their own handles come back), never as pass/fail on a few models.
- Avoid repeating: replacing the detector, score cutoffs, stamping unrecognised
  nodes as `Object`, accepting on renamed copies of the models used for tuning.

## Changes and verification

- Step 1, names may not veto: in progress.
- Step 2, permanent library comparison script: in progress.
- Step 3, blank-name measurement: in progress.
- Step 4, fill gaps from the other clues: contract waits for step 3's numbers.

## Blockers and next action

- None. Next: review the three agents' results, then write step 4's contract.
