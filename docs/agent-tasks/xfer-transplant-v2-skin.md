# Transplant v2, item 4: skin on the donor's bones (design and builder contract)

Status: design only, 19 Nov 2026. Nothing built. Parent note: [xfer-both-ways.md](xfer-both-ways.md),
"Owner's scope for transplant v2". Engine: `src/skeleton-transplant.js` (v1). Probes (read-only):
`out/transfer-probe/v2-skin/`.

Owner's definition (binding): a transplant is a plain implant. The open model's mesh goes onto the
donor's skeleton and takes the donor's motion 100%. Keep options exist and are off.

## 1. What is wrong in v1, measured

Kurgan on the Tauren (`rigs.mjs`):

- The Tauren's 26 moving joints are helpers (`Bone_*`); its skin sits on 18 still bones under them
  (`Geo_*`, one per joint; none under `Root`, `Bone_ClavicalL/R`). v1 binds to the helpers, turns
  them into bones and drops every `Geo_*`: that is the "18 of 50".
- The Tauren has joints the Kurgan lacks: `Bone_Neck` (v1 puts it at 0.65 of the own Chest > Head
  line, and no vertex goes to it) and the hocks `Bone_Leg3L/R` (v1 converts the legs instead).
- The three stretches the review flagged are body shape, not misplacement. Donor `Bone_Neck` >
  `Bone_Head` points forward and down (the head hangs under the hump); the Kurgan's head sits on top:
  139°. Donor `Root` > `Bone_Chest` is a 5.8-unit stub (0.11 hip heights) pointing backward: 71°.
  `Bone_Chest` > collar: the Tauren's chest pivot is low at the back: 44°. The trunk has no rest
  correction (study, step 5: A for the trunk; the owner called that result Good), so each trunk
  stretch stays off the donor's by a constant while every trunk joint turns exactly as the donor's.
  Making them equal means bending the Kurgan's torso into the Tauren's hunch. Not proposed.

## 2. Key idea

1. Joints stay where v1 fits them: paired joint on the own joint, a donor joint the model lacks on
   the own line between its neighbours at the donor's share of the path.
2. Such a joint now gets skin: the own bone whose stretch it sits inside (its host) hands over the
   vertices past the joint's plane. Vertices at the plane go on both bones.
3. Every joint's skin goes onto the donor bone that carries that joint's skin in the donor
   (`Geo_*`), so the result has the donor's bones and helpers as the donor has them.
4. No limb is converted. A line-placed joint is corrected like every limb joint (each stretch points
   as the donor's). A foot is not corrected (its world turn is the donor's).
5. The body's travel is scaled by the fitted legs, not by hip height; then feet stay down without
   any placing.

## 3. Measurements

Native skin (`native-skin.mjs`, `corpus-sd`, 395 recognised classic bodies, 241,096 vertices):

- Vertices by group size 1 / 2 / 3 / 4+: 63.9% / 28.8% / 5.5% / 1.8%.
- 2-bone groups join: parent and child joint 55.1%, two bones of one joint 27.7%, siblings 3.7%,
  further apart 4.6%, a bone outside the body parts 9.0%.
- Blended limb vertices sit at the joint: position past the lower joint as a share of the stretch
  above, 25th / 50th / 75th percentile: -0.11 / -0.02 / +0.09. Share of limb vertices blended by
  distance from the joint plane (hip heights): 77% under 0.02, 72% at 0.02 to 0.04, 56% at 0.06 to
  0.10, 14% past 0.15. Source of the band 0.10 below.
- What carries a part joint's skin: the joint itself 22.9%, one still bone under it 60.4%, several
  still bones 9.3%, only moving bones 1.9%, nothing 5.6% (mostly the first hips joint and collars).

Hock rules (`leg-rules.mjs`, `feet-height.mjs`; Kurgan legs on the Tauren's four leg joints, forward
kinematics on the donor's world turns, all animations but death, decay, portrait; L / R leg):

| Rule | Hip > foot line off the donor's (median) | Bend inside the own shin (median) | Foot pitch off the donor's | Lower ankle against standing height, Walk / Stand Ready (hip heights) |
| --- | --- | --- | --- | --- |
| A: each stretch as the donor's, body travel x hip-height ratio 0.82 | 2.0° / 2.1° | 81° / 102° | 49° / 46° (foot inherits) | -0.03..0.16 / -0.11..-0.05 |
| A, body travel x fitted-leg ratio 0.56 | same | same | 0° with the foot uncorrected | **-0.01..0.05 / -0.02..0.00** |
| C: the run knee > hock > foot along the donor's chord | 0.8° / 0.6° | 22° / 11° | 2.7° / 1.6° | -0.06..0.34 / -0.22..-0.11 |
| C, travel x 0.76 | same | same | same | -0.05..0.31 / -0.20..-0.10 |
| The Tauren's own hoof joint | | 104° at rest | | -0.01..0.03 / 0.00 |

A with the fitted-leg ratio is within 0.05 hip heights of the floor in every animation but Death
(0.12; the Tauren's own Death 0.13). C keeps the shin straight but floats and sinks: a straight leg
shortens far less than a bent one for the same turn. Chosen: A. Cost: the Kurgan's shins take the
Tauren's zig-zag, and it stands about 0.27 hip heights lower (own leg drop 43.1 becomes 31.7).

Prototype of the skin rule (`fit-skin.mjs`):

| Pair | Runs | Vertices moved by the split | In a band | Group sizes 1/2/3/4 | Most groups in a geoset |
| --- | --- | --- | --- | --- | --- |
| Kurgan on Tauren (1,445) | neck 0.65 in Chest; hocks 0.48 / 0.47 in the shins | 34: `Bone_Neck` 14, `Bone_Leg3L` 10, `Bone_Leg3R` 10 | 1 | 1337 / 89 / 19 / 0 | 14 |
| Footman on Grunt (582) | forearm 0.52 in the shield arm | 20 | 9 | 404 / 153 / 25 / 0 | 31 |
| Footman on Tauren | neck, both collars 0.73, forearm, hocks | 94 | 14 | 399 / 158 / 25 / 0 | 39 |
| Sorceress on Tauren (576) | neck, both collars, hocks | 100 | 9 | 449 / 116 / 4 / 7 | 37 |

Kurgan on Tauren, skin lands on 18 `Geo_*` bones plus `Bone_ClavicalL/R` (no carrier in the donor).

Sweep, `corpus-sd`, every body the engine pairs (344 of 398; one HD file left out):

| Donor | Threw | With runs | Geoset over 256 groups | Models with a vertex over 4 bones | Same place and own bones, different result | Share of vertices moved (median / 90th / max) |
| --- | --- | --- | --- | --- | --- | --- |
| Tauren | 0 | 277 | 0 | 1 | 0 | 7.5% / 18.8% / 41.2% |
| Grunt | 0 | 35 | 0 | 1 | 0 | 0% / 0% / 14.2% |
| Footman | 0 | 17 | 0 | 1 | 0 | 0% / 0% / 5.0% |

Not measured: any animated result (nothing was built); edge stretch over time; the collection of
561 (`lpw-main` models were not swept); HD (`SkinWeights`) models.

## 4. Algorithm

Names as in `transplantSkeleton`: B = open model, A = donor; `rigB/rigA`, `treeB/treeA`, `pB/pA`
(bind pivots), `jointTarget` (own part joint > donor joint), `pairedOwn` (donor joint > own joint),
`placed` (donor joint > place in B), `targetOf`, `extras`, `outsideKept`, `keep`.

### 4.1 Fit (unchanged from v1 except that nothing is converted)

1. Pairing: stage 1 entries from `buildTransfer`'s probe; trunk by what hangs (`trunkMap`). As v1.
2. Every paired limb is transplanted: `converted`, `keptOwn`, `dropped`, `coverOf` stay empty and
   `convert()` is not called (item 2). `settleFeet` still runs.
3. Places: v1's `placeJoint`, unchanged. Paired joint: `pB(pairedOwn)`. Unpaired joint with a placed
   joint above and exactly one paired joint below: on the line between them at the donor's share of
   the path. Else the donor's offset times `size`.

### 4.2 Runs

A run is the set of unpaired donor part joints between a paired joint `a` (above) and a paired
joint `q` (below), each with exactly one paired joint below (v1's `pairedBelow`), walking parents
from `q`. For each run:

- `joints` = `[u1..un]` top first; `seq` = `[a, u1..un]`.
- `start = pB(pairedOwn(a))`, `end = pB(pairedOwn(q))`, `axis = end - start`.
- `bounds` = `[0, t1..tn, 1]`, `ti` = donor path length `a..ui` over path length `a..q` (bind
  pivots). This equals v1's line placing, so `placed(ui) = start + ti * axis`.
- `host` = the nearest ancestor of `pairedOwn(q)` in `treeB` that is an own part joint.
- Skip the run when `|axis| < 1e-3 * rigB.hipHeight`, when `host` is undefined, or when the top of
  the chain is not a paired joint (v1 then places by offset; no split there).

### 4.3 Which donor joint a vertex goes to

For each own bone `b` in the vertex's group (or each weighted bone):

1. `targetOf(b)` as v1. `{ own }` (a kept extra, `outsideKept`): unchanged. Else `via` is the own
   part joint and `T = jointTarget(via)` the default donor joint.
2. If `b` is an extra (v1's `extras`: moves by itself) it is rigid: decide once per extra with the
   centroid of all its vertices as the point, no band. Item 1 (the weapon on the donor's weapon bone)
   takes precedence for the weapon.
3. Otherwise the point is the vertex. For every run `r` whose `host === via`:
   - `t = (p - start) . axis / |axis|^2`.
   - `wi = 0.10 * min(bounds[i] - bounds[i-1], bounds[i+1] - bounds[i])` for `i = 1..n`.
   - Eligible when `t >= t1 - w1`.
   - `d = |p - (start + clamp(t, 0, 1) * axis)|`.
4. No eligible run: `[T]`. Else the eligible run with the least `d` (tie: lower `q` id):
   - `idx` = number of `ti <= t`; joint `seq[idx]`.
   - If `|t - ti| <= wi` for some `i` (the nearest such): both `seq[i-1]` and `seq[i]`.
   - `a` in the answer is replaced by `T`.

Only the host's vertices are split. A vertex bound to the joint below `q` stays there even when it
hangs above `q`'s pivot (a beard, a helmet flap).

The vertex's donor joints are the union over its own bones. More than four (classic): keep the four
whose stretch (`placed(j)` to the place of its first part-joint child, else the point) is nearest the
vertex, tie lower id (1 model in 344). HD: a bone's weight goes to its joint, halved over two; merge,
keep the four heaviest, renormalise to 255. Coincident vertices with the same own bones get the same
result by construction.

### 4.4 Which donor bone carries a joint's skin

`carrier(j)`, once per donor part joint, from the donor's own skin (classic groups or HD weights):

1. `j` itself when it is a bone with donor skin.
2. Else the donor bones with donor skin whose nearest part-joint ancestor-or-self is `j`, with no
   `Translation`, `Rotation` or `Scaling` keys on the bone or on any node between it and `j`: the
   one with the most donor vertices (tie: lowest id).
3. Else `j` (a helper becomes a bone, as v1).

Skin goes to `carrier(joint)`. A carrier is still, so its place does not matter; v1's `correctionOf`
already gives it its parent's correction (no key).

### 4.5 Legs and corrections (overlaps item 2; needed for the legs to bend where the donor's do)

- A line-placed joint inside a limb is corrected by v1's loop as it is: each stretch
  `placed(next) - placed(id)` turns onto `pA(next) - pA(id)`. No new rule.
- The end joint of a leg (`limbKind === 'leg'`) gets the identity correction instead of the previous
  joint's. Hands keep v1's rule.
- `travel` replaces `size` for position keys outside transplanted limbs (the body joint's travel)
  and `MoveSpeed`. For each transplanted leg: `own = sum(|placed stretch i| * unit(donor stretch i))`,
  `donor = sum(donor stretch i)`, over the leg's joints first to last; ratio `own.z / donor.z`.
  `travel` = mean over legs; when a `donor.z` is under `1e-3 * rigA.hipHeight` or there are no
  legs, `size`. Offsets of donor-only joints (tail, weapon root) keep `size`.
- The trunk gets no correction (unchanged).

### 4.6 Poor fit

Nothing new is refused. Unpaired own limbs ride still and are named (v1). Runs exist only between
paired joints, so a quadruped, winged body or rider adds no new case: what is not paired takes the
default joint. Named as v1: over 256 groups in a geoset. New numbers in `report.counts.skin`:
`{ runs, moved, blended, capped, carriers, helpersMadeBones, offBody }`.

## 5. Builder contract

New pure module `src/transplant-skin.js` (three only, no model access beyond what is passed), so
the work does not collide with other edits of `skeleton-transplant.js`:

```js
export const SKIN_BAND = 0.10;
/** -> [{ a, q, joints, seq, bounds, host, start, end }] (4.2) */
export function transplantRuns({ donorPartJoints, ownPartJoints, pairedOwn, isDonorJoint, treeA, treeB, pA, pB, minLength })
/** -> donor joint ids, one or two (4.3 steps 3 and 4); `band: false` for an extra's centroid */
export function splitJoints(point, defaultJoint, runs, { band = true } = {})
/** -> Map(donor part joint -> donor bone id) (4.4); skinCount: Map(donor node id -> vertices) */
export function donorSkinCarriers({ donor, donorPartJoints, treeA, skinCount })
/** -> number (4.5); legs: [{ own: Vector3[], donor: Vector3[] }] */
export function legTravelRatio(legs, fallback)
```

In `skeleton-transplant.js`: build the runs after placing; replace `skinTarget(id)` in the skin
section by a per-vertex resolver (4.3, 4.4) for both `Groups` and `SkinWeights`; foot correction and
`travel` (4.5); `report.counts.skin`. `bake`, `keep`, `outsideKept`, events, emitters unchanged.

Tests, each failing first (break one behaviour at a time, as `transplant-fail-first.mjs`):

Unit, `test/transplant-skin.test.js`, hand-made inputs, no model files:

- U1 run: chain a > u > q, own host line (0,0,0) to (0,0,10), donor path 6 + 4: `bounds` `[0, 0.6, 1]`.
- U2 split: points at z 2 / 5.9 / 6.3 / 9 give `[T]` / `[T, u]` / `[T, u]` / `[u]` (band 0.4).
- U3 two runs from one host (neck up, collar sideways): a point past both planes takes the nearer line.
- U4 not past any plane: `[T]`. A point on the joint below is never passed to the resolver.
- U5 carrier: joint with one still skinned child bone gives the child; a keyed child gives the joint;
  two still children give the one with more vertices.
- U6 travel: own stretches of length 20.2, 11.2, 11.8 on the Tauren's left leg pivots
  (`rigs.mjs` prints them): 0.56 within 0.01; a donor leg with no drop gives the fallback.
- U7 `band: false` returns one joint at the plane.

Pairs, in `test/skeleton-transplant.test.js` (default options):

- P1 Kurgan on Tauren: `report.converted` is empty; no own leg joint in the result; every vertex is
  on a node of the result that is a bone; none on an own bone except `outsideKept` and `keep`.
- P2 counts: `Geo_Neck` 14 vertices, `Geo_lowershinL` 10, `Geo_lowershinR` 10; 34 moved, 1 blended;
  18 `Geo_*` bones carry skin; no geoset over 14 groups (weapon vertices wherever item 1 puts them).
- P3 by name at least 44 of the Tauren's 50 bones and helpers are in the result (v1: 18).
- P4 stretches, 9 moments of every animation but decay and portrait: every limb stretch (hock
  stretches included) within 1° of the donor's; every trunk stretch's angle to the donor's varies
  by at most 1° over all moments (its size is reported, not gated); each trunk and carrier node's
  turn from rest within 0.5° of the donor's.
- P5 feet: each foot joint's world turn within 0.5° of the donor's foot joint; lower ankle against
  its standing height within 0.06 hip heights in every animation but Death (prototype: 0.05).
- P6 coincident vertices with equal own bones have equal groups; no vertex has over 4 bones.
- P7 Footman on Grunt: the shield arm's 20 vertices are on the Grunt's forearm bone; T1 and T2 pass.
- P8 poor fit (Kurgan on Magnataur) still returns a model and names it.
- Existing T4 and T5 (converted legs) are replaced by P1 and P5; T6 to T10 must pass or change only
  where items 1 to 3 say so.

Sweep (`transplant-sweep.mjs` pattern, 561 bodies, Tauren, Grunt, Footman), numbers into the note:

- Built 561, threw 0, not finite 0, not valid 32 (the same 21 files as v1).
- Geoset over 256 groups 0; coincident-vertex mismatch 0.
- Transplanted limb parts with worst angle within 10°: at least v1's 98% / 100% / 100%.
- Walk, lower ankle within 0.1 hip heights of standing: report per donor. v1 with the Tauren: 91%
  (by conversion). Lower than that: hand back the numbers, do not tune.
- Median seconds per body with the Tauren: report (v1: 22, most of it conversion).

Unchanged: `node --test test/anim-transfer.test.js test/transfer-window.test.js` 81 pass;
`baseline.mjs <letter>` then `baseline-compare.mjs r <letter>`: 0 differ.

Trial models: `TEST TRANSPLANT 04.mdx` (Kurgan on Tauren, v2) in `TestBuilds\test-models`, opened
hidden once in the packaged build, no page error.

## 6. Open risks

1. Look of the legs. With the donor's own leg bones the Kurgan's straight shins fold by 81° to 102°
   at mid-shin, on a coarse mesh (28 vertices per shin, 1 in the blend band), and he stands 0.27 hip
   heights lower. This is what "the donor's leg bones, 100%" gives. The alternative (rule C) keeps
   the shin straight and floats up to 0.34 and sinks up to 0.22 hip heights. Owner's eye decides.
2. `travel` 0.56 instead of 0.82 also shortens steps and `MoveSpeed`; not checked in game.
3. Collars with no donor skin (`Bone_ClavicalL/R`) still take the own shoulder's skin (the Kurgan's
   shoulder piece, 237 vertices) and become bones. Following the donor strictly would put that skin
   on the chest; not chosen (the piece would stay behind when the collar lifts the arm).
4. The plane split cuts rigid still pieces bound to a host (a gorget across the neck plane, a boot
   across the hock). Only pieces that move by themselves are kept whole.
5. The prototype printed counts from the bind pose only; edge stretch and tearing in motion are
   unmeasured until the builder's result exists.
6. Sections 4.1 step 2 and 4.5 are item 2's ground; if its builder chose otherwise, reconcile
   before building (4.2 to 4.4 do not depend on it, but P4 and P5 do).
