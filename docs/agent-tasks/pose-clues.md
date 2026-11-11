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

- Step 1, names may not veto (`poseNameConflicts`, commit `c432ffc3`): 10 of 852
  models change, all by the two rules; targeted tests unchanged (165 pass, 4 skip).
- Step 2, library comparison: `pnpm run pose:corpus-diff -- --base <clean checkout>`
  (commit `db5e47dd`). Use it for every change to handle detection.
- Step 3, blank-name measurement (scratch, `out/pose-compare/blank/`): with bone
  names blanked and attachments kept, 85% of limbs and 86% of heads are still
  found, but 0% of pelvis and neck handles. With every name blanked, 58% of limbs
  and 0% of heads.
- Step 4, pelvis and neck from the skeleton (`posePartGaps`): only additions, on
  146 of 852 models (88 gain a pelvis handle, 62 a neck handle); no handle lost,
  moved or re-typed. Bone names blanked: pelvis recovery 0% to 68%, neck 0% to 65%.
  Targeted tests: 177 pass, 0 fail, 4 skip.
- Step 5, wings and hand rows (owner's Lord of Change, 11 Nov): a weapon word
  excludes only what hangs below a hand (`w` reads as weapon; the wings are
  `B_W_#`); a branch may pair with a twin on the mirrored sibling joint; such a
  new branch is labelled Wing when its skin is a sheet (flatness under .3;
  measured: wing chains .04 to .07, arms median .59) and is skipped when its
  joints already have a part role; in a row of same-named hand or foot joints
  that all move, the one carrying the attachment is the end, only when the first
  of the row sits at the trunk. Library (969 models after 116 unusual community
  rigs were added as `pose-odd`): 3 models change (Lord of Change, zergling in
  both corpora). Targeted tests: 185 pass, 0 fail, 4 skip.
- Rejected on the way, keep rejected: the hand/foot row rule without the trunk
  condition moved leg ends from foot to toe on five Blizzard models.
- Not run: packaged-app tests, real mouse drags. Owner hand test pending.

## Blockers and next action

- Known limits, measured: a head with no name and no head attachment is not
  found (the "highest joint above the chest" rule was right only 19% of the time
  on two-armed rigs, so it was not used). With every name blank and no head, a
  four-legged rig's front leg junction can be labelled pelvis. Limbs are lost
  without names mainly because `inferPoseBranches` stops at a branching joint;
  273 lost limbs are not yet explained.
- Next: owner tests the build; then heads without names, then limbs through
  branching joints, each measured first and gated by the library comparison.

## Handover, 11 Nov 03:30 (session hit its usage limit; owner AFK)

- Saved: commits `db5e47dd`, `c432ffc3`, `af0ea702`, `8d291541`. Test build 3 of
  `8d291541`: `D:\Claude\MDLxL\TestBuilds\Pose-Clues-3`.
- Hidden packaged run on build 3 (`out/suite/default/summary.json`), stopped
  early: pose-setup, pose-complex, pose-one-head, pose-sd-controls, pose-view,
  pose-console pass; `pose-ik` FAILS once with "commit-throw discards every
  preview track". Not yet checked against clean main, so unknown whether it is
  new. Not run: pose-copy-body, pose-ragdoll, pose-performance, anim-xl,
  auto-corpse, attachemator.
- Next 1, unanimated units (measured in `out/pose-compare/still/summary.md`:
  limbs 88% found, neck 60%, tail 62%, wing 37%): in `poseRecognitionEvidence`
  make `moving` true for every joint when no joint in the model moves at all.
  Gates: library comparison against `pose-step4` (at `8d291541`) must show no
  difference on animated models; rerun `still.mjs` and review every handle that
  appears only in the stripped run (cloth, hair).
- Next 2, owner request: "Right click a handle - hide"; a revealer per hidden
  handle sits left of the POSE button on its row and restores it on click.
  Decided: hidden = not drawn and not pickable, mapping, pins and body-follow
  keep working; `config.hidden` keys next to `pins`, pruned in `without()` and
  `save()`, part of `poseStamp`; hiding the selected handle clears the target;
  right-drag must still pan (act only on a right click that did not move);
  one-item menu "Hide" reusing `.classic-context`; revealers are DOM buttons
  like the Pin button, placed from the live POSE button rect, showing the
  handle's symbol; no new catalog strings if avoidable. New packaged test
  `test/pose-hide.electron.cjs` with a real right-click, fail first.
- Then: package test build 4, delete builds 2 and 3.

## State, 11 Nov evening

- Saved since the handover above: `c929c709` (unanimated units) and the
  hide / reveal commit that follows it. Handover items 1 and 2 are done.
- Unanimated units, narrowed on review: relaxed motion for everything that
  rests on a name, an attachment or the pelvis / neck / hand-row rules; the
  unnamed-limb search (`inferPoseBranches`) keeps strict motion, because the
  existing test "rigid props without articulation are not inferred as legs"
  must hold. Stripped-animation run: named parts 96-100% found (tails 71%),
  limbs 91%; unnamed limbs still need motion (owner's call to loosen).
- Hide / reveal: `config.hidden` in `session.pose`; identities from
  `poseHandleKey` in `app/pose-overlay.js`; menu is a third branch of the
  `.classic-context` renderer in `app/AppDialogs.jsx`; reveal strip is a DOM
  overlay in `app/GamePreview.jsx`, positioned from `[data-hotkey="pose:mode"]`.
  A hidden limb's Focused Skeleton lines are still drawn.
- Whole branch against main (`pose-base`), 1018 library models: 825 identical,
  193 differ: Pelvis handle added on 94, Neck on 76, body changed on 16 (15
  unanimated props gain a body, Lahmian SD 14), thigh "Pelvis" handles removed
  on 10, limbs added on 6, Chest added on 2.
- Packaged tests on build 3 (`8d291541`): 13 POSE / AnimXL / Auto Corpse /
  Attachemator tests pass. `pose-ik` failed once in 3 runs there ("commit-throw
  discards every preview track") and passed 2 of 2 on main: treated as flaky,
  not reproduced. `pose-hide` passes on the hide / reveal package and fails
  first on build 3. Owner, 11 Nov: no repeat runs, the release suite covers
  the rest.
- Not verified: the owner's hand test of wings, hands and hide / reveal.

## Mount heads and the classic mode, 11 Nov late

- Owner's zombie dragon (`pose-heads/WH_VC_ZombieDragonVCarsteinHero01.mdx`):
  the mount's head has only a `Head Ref`; main ignores a head attachment when
  any joint in the hierarchy root has a head name (here the rider's). New
  rule: a head attachment marks the head unless a head-named joint is on its
  own line (ancestor, the parent's parent, or below the parent's parent) or
  shares its trunk anchor (nearest ancestor with a name role Chest, Spine,
  Pelvis, Body or Neck; "none" counts as shared). Library: 13 models gain a
  head and neck (3 owner dragons, wyvern rider, Malfurion, three death-knight
  horses, each Blizzard one twice). Rejected on the way: without the anchor
  test the Vampire Dragon rider's collar, the wind serpent and the dragonhawk
  got second heads.
- Measured for the first time: tools that read `suggestPoseRig` changed
  silently. Against main, Auto Corpse output differed on 96 library models and
  Attachemator on 118 (scratch: `out/pose-compare/consumers.mjs`), and the
  dragon corpse test failed once the dragon head was found.
- Decision: `suggestPoseRig(model, frame, sequence, { clues })`. Default
  (`clues: true`) is the POSE screen. `clues: false` returns main's rig
  exactly and is what `src/corpse-geometry.js`, `src/attachemator.js`,
  `src/anim-xl.js` and `app/AnimXL.jsx` pass. Proof on 1019 models: classic rig
  identical to main's on all (`out/pose-compare/classic.mjs`); Auto Corpse and
  Attachemator outputs identical to main's on all. Letting one of those tools
  use the new clues is a separate change with its own library comparison.
- `rig.inferred` lists the roles `posePartGaps` added.
