# Recognition: limb or hanging cloth (step 1 of the shared recogniser work)

Status: contract written 17 Nov 2026 (director: Fable). Not built. Local only, branch `claude/transfer-xl`.

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

- A, the table:
- B and C, proofs:
- D, the list of models whose handles change:
- Could not explain:
