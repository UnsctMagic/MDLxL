# XFER Transplant fixes: size without legs, Poor fit, verdicts

Design contract, 19 Nov 2026 (designer: Fable; builders: Opus workers). Scope set by the owner through
the coordinator: (a) class 1 of the [failure sweep](xfer-both-ways.md#failure-sweep-report-only-19-nov-2026),
the size ratio for bodies that do not stand on recognised legs, recogniser side included; (b) what
"Poor fit" means and how it is decided; (c) verdicts on classes 6, 7 and 10. Classes 2, 3, 4, 5, 8
and 9 are being fixed by other workers in `src/skeleton-transplant.js` and `app/Transfer.jsx` and are
not designed here.

Nothing here is built. Every number below was measured on this worktree at `a00aaf8b` (the engine is the same at `49939be4`) with read-only
probes in `out/transfer-probe/fix-design/` (named where used). The prototype there
(`proto/make.mjs` writes a patched copy of `src/anim-transfer.js` and `src/skeleton-transplant.js`
from HEAD) is evidence for the design, not code to copy in.

## Order of work

| Package | Files | When |
| --- | --- | --- |
| **A** Recogniser: body extent, measured hips, a body that drives no limb | `src/anim-transfer.js`, `test/anim-transfer.test.js`; six new lines in `test/helpers/fixtures.cjs` | `src/anim-transfer.js` and its test: now, no worker of classes 2-5, 8, 9 touches them. `fixtures.cjs` has uncommitted lines of those workers (seen 19 Nov): add the six lines after theirs are committed. |
| **B** Transplant: size and travel from A, Poor fit | `src/skeleton-transplant.js`, `test/skeleton-transplant.test.js`, the five `src/locales/*.json`, `test/localization-catalogs.test.js`, `test/fixtures/locale-feature-sources.json`, `test/transfer.electron.cjs` (one story), `docs/TRANSFER.md` | After A is committed **and** after the class 2-5, 8, 9 workers have committed (same files). |
| **D** Feet: the body is moved once (class 10, the real part) | `src/skeleton-transplant.js` (`feetDown`, `settleFeet`, one new helper), `test/skeleton-transplant.test.js` | After B, or before it: it shares no line with B, only the file. Never while another worker is in the file. |
| **C** Own pieces off the body keep their own animation by kind (class 7) | `src/skeleton-transplant.js`, `test/skeleton-transplant.test.js` | After B and D. Only if the owner says yes (question 2). |
| **Gate** | none (runs scripts) | After B and D (again after C when built). |

A and B are sequential (B imports A's export). A can run in parallel with the class 2-5, 8, 9 work.
B, D and C run one at a time and must not overlap any other work in `src/skeleton-transplant.js`.

Functions touched, for sequencing:

- A, `src/anim-transfer.js`: `readRig` (two places: right after the body joint is chosen; the block
  from `const legs =` to `const rig =`), the private `sizeRatio`, plus two new functions
  `bodyExtent` (private) and `rigSizeRatio` (exported). Nothing else.
- B, `src/skeleton-transplant.js`, all inside `transplantSkeleton`: the import list, the `size` line,
  the `travel` line, the `ridesStill` loop with its reason sentence, the `whole.reason` line, the
  bind-pose reason, the `fit` line and the `report` object; and the reason sentence in `settleFeet`.
- D, `src/skeleton-transplant.js`: the `movers` line of `feetDown`, the `shiftBody` call of
  `settleFeet`, and a new module-level helper `bodyMover`.
- C, `src/skeleton-transplant.js`: the own-node loop (`for (const node of ownNodes)` that freezes own
  joints at the reference pose) and the `timed` list before `refitTracks`.

## Class 1: size for a body that does not stand on legs

### Root cause, confirmed

- `src/skeleton-transplant.js`: `const size = rigB.ok && rigA.ok ? rigB.hipHeight / rigA.hipHeight : 1;`
  The size ratio scales the donor's position keys, the offsets of donor joints nothing pairs with and
  `MoveSpeed`.
- `src/anim-transfer.js`, `readRig`: `hipHeight: Math.max(1e-3, hipCentre.z - ground)`. With no leg
  read, `hipCentre` is the body joint and `ground` is the lowest joint of the parts; when the body
  joint is that lowest joint the height is 0 and the floor 0.001 is returned. A Footman on the Naga
  then gets size 41,382; the Naga on a Footman gets 0.00002. 452 of 1,593 pairs.
- Three different defects sit behind "hip height 0.001" and near it
  (`size-table.mjs`, `rig-dump.mjs`, `tree-dump.mjs`, `census.mjs` over 434 recognised library
  models: `corpus-sd`, `lpw-main/dist/models` and the sweep's own):
  1. **No legs at all**: Naga, Wisp, wards, ships, catapults, robed bodies (98 of 434). The number
     is not a hip height in any of them. 71 sit at the floor; 27 read some other number (Dune Worm
     10.8, Vulture 5.0, Kel'Thuzad 3.4, Mindflayer 73): the body joint's height above its lowest
     joint, which says nothing about size. The Vulture's 5.0 makes every body 8 times too big on it:
     38 of the sweep's sink and float flags.
  2. **Legs that do not stand** (19 of 336 legged models): spiders, crabs, Nerubians, Crypt Fiend,
     Crypt Lord, Ents. The first leg joint is level with the feet, so the "hip height" is 0 to 10
     for bodies 100 to 280 across. Spider 1.4, Hermit Crab 0.26, Crypt Fiend 6.7 (sizes 6 to 160).
  3. **A body joint that drives no limb** (Felhound, its two copies; 3 files): POSE finds three leg
     chains, but its first chain starts at the true body driver (`Bone Center > Bone Wolf Neck >
     Object04`, read as an arm), so no body can be worked out from the limbs and the fallback takes
     the node *named* `Body`, a still skin bone that hangs beside the legs. `readRig` then drops
     every chain (none hangs under `Body`), leaving one part and hip height 0.001.
- The Rat is case 1 as read: its legs have two joints (thigh, shin) and POSE reads no chain from
  them. That is not changed here; its size is fixed by the rule below (22 instead of 0.001, its hip
  joints stand at 17).
- Lengths written as a share of hip height (`1e-3 *`, `0.01 *`, `0.125 *` in both engines) are
  0.000001 to 0.0001 for these bodies. No visible effect of that alone was measured (the Naga on the
  Footman has 91 keys on its body joint either way, `keys-check.mjs`); they simply get a real length.

### The rule (owner's words to honour: fix it in the recogniser, not per tool)

One reading of size for every tool that reads `transferRig`:

1. Every plain reading (not `seated`, not `walker`) gets a **body extent**: the diagonal of the box
   around the visible skinned mesh at the rig's reference moment, each axis taken between its 2nd
   and 98th percentile (a blade tip, a banner or one stray vertex does not count). It needs no
   skeleton, so every model with a mesh has one.
2. A hip height is **measured** only when the body stands on at least one recognised leg and the
   hip centre is at least a twentieth of the body extent above the feet. Else it is a stand-in:
   0.26 of the body extent.
3. The **size ratio** of two bodies is the ratio of hip heights when both are measured, exactly as
   today. Otherwise it is the ratio of the two body extents.
4. With no leg, the **ground** is the mesh's own floor (the 2nd-percentile height from 1), not the
   lowest joint. (The robed Necrarch's lowest joint is 40 above the hem of its robe: 104 against 64.)
5. A body joint that drives none of its skeleton's limbs is replaced by the joint the legs hang from.

Where the numbers come from (`census.mjs`, `census.json`):

- **0.05** (a twentieth): of the 336 legged library models, 19 are below 0.05 and the highest of
  them is 0.038 (Crypt Lord); every other one is at 0.078 or more (Frost Wyrm, Skink). The value
  sits in the only gap. `leg-stand.mjs` shows the same split against leg length (splayed 0.01 to
  0.22, standing 0.28 and up), with a narrower gap, which is why the extent is used.
- **0.26**: the median of hip height over body extent across the 317 standing library bodies
  (quartiles 0.216 and 0.310). It only sizes lengths written as a share of hip height; the size
  ratio never mixes a measured hip height with a stand-in (rule 3).
- **2% trim**: the same `0.02 / 0.98` on each axis; chosen once, not tuned. Untrimmed boxes are
  dominated by weapon tips and effect planes (`hip-heights.txt`: Penguin 285 tall untrimmed, 57 trimmed).

### Package A: `src/anim-transfer.js` (the shared recogniser)

A1. New private function, placed just above `vertexPointsBelow`:

```js
// A hip height counts as measured from this share of the body extent up; a body that does not
// stand on legs gets this share of its extent as a stand-in. Library figures: docs/agent-tasks/xfer-transplant-fixes.md.
const HIP_MIN_SHARE = 0.05, HIP_SHARE = 0.26, EXTENT_TRIM = 0.02;
/** The body's extent in the reference pose: the diagonal of the box around the visible skinned mesh, each axis
 * between its 2nd and 98th percentile; `floor` is that lower height. Geosets hidden in the reference animation are
 * left out; when that leaves nothing, every geoset counts. -> { size, floor } ({ size: 0, floor: null } without a mesh). */
function bodyExtent(model, ref, sequence) {
  const item = model.Sequences?.[sequence];
  const read = visibleOnly => {
    const axes = [[], [], []];
    (model.Geosets || []).forEach((geoset, index) => {
      if (!geoset.Vertices?.length) return;
      if (visibleOnly && item?.Interval) { const alpha = geosetAlphaTrack(model, index); if (!(isGlobalTrack(alpha) || geosetVisibleIn(model, alpha, item, item.Interval))) return; }
      const points = skinGeoset(geoset, ref.world);
      for (let i = 0; i + 2 < points.length; i += 3) if (Number.isFinite(points[i] + points[i + 1] + points[i + 2])) { axes[0].push(points[i]); axes[1].push(points[i + 1]); axes[2].push(points[i + 2]); }
    });
    return axes;
  };
  let axes = read(true);
  if (!axes[0].length) axes = read(false);
  if (!axes[0].length) return { size: 0, floor: null };
  for (const axis of axes) axis.sort((a, b) => a - b);
  const at = (axis, share) => axis[Math.min(axis.length - 1, Math.floor(axis.length * share))];
  return { size: Math.hypot(...axes.map(axis => at(axis, 1 - EXTENT_TRIM) - at(axis, EXTENT_TRIM))), floor: at(axes[2], EXTENT_TRIM) };
}
```

`ref` is the `sampleAt` sample `readRig` already holds; every import it needs is already in the file.

A2. In `readRig`, directly after the `if (body == null && own.length) { ... }` block and before the
"Reference pose" comment:

```js
  // A body that drives none of this skeleton's limbs only carries the name (a still skin bone called "Body" beside
  // the helper that moves the creature): the body is then the joint the legs hang from (the limbs, with no leg).
  let rebased = false;
  const limbsHere = own.filter(chain => !chain.cloth && chain.label !== 'Chain');
  if (body != null && limbsHere.length && !limbsHere.some(chain => chain.root !== body && tree.isAncestor(chain.root, body))) {
    const hung = limbsHere.filter(chain => joints.has(tree.parentOf(chain.root))), legsHere = hung.filter(legChain), basis = legsHere.length ? legsHere : hung;
    const driver = basis.length ? tree.ancestors(basis[0].root).find(id => joints.has(id) && basis.every(chain => chain.root !== id && tree.isAncestor(chain.root, id))) : undefined;
    if (driver != null) { body = driver; rebased = true; }
  }
```

and the chain filter a few lines below gains one condition (a chain that runs through the new body
joint is no limb):

```js
  ... : seatedId(chain.root) ? armChain(chain) : tree.isAncestor(chain.root, walkerBody))).filter(chain => !chain.cloth && !(rebased && poseChainIds(chain).includes(walkerBody)));
```

`rebased` is false for every rig whose body drives at least one limb, so nothing else is reached.

A3. In `readRig`, replace the `ground` line and the `hipHeight` value, and add two properties:

```js
  if (!Object.keys(parts).length) return fail('No body parts were recognised on this model.');   // moved up one line, unchanged
  // Size (rules 1 to 4 of the fixes note). Read alone, a rider or its mount keeps the plain numbers.
  const plainReading = actor === 'both', extent = plainReading ? bodyExtent(model, ref, sequence) : { size: 0, floor: null };
  const ground = legs.length ? Math.min(...legs.map(part => pos(part.marker).z)) : extent.floor ?? Math.min(...Object.values(parts).flatMap(part => part.joints.map(id => pos(id).z)));
  const hipMeasured = !plainReading || legs.length > 0 && hipCentre.z - ground > 1e-3 && hipCentre.z - ground >= HIP_MIN_SHARE * extent.size;
  ...
  hipHeight: hipMeasured || !(extent.size > 0) ? Math.max(1e-3, hipCentre.z - ground) : Math.max(1e-3, HIP_SHARE * extent.size),
  ...
  Object.defineProperty(rig, 'hipMeasured', { value: hipMeasured, enumerable: false });
  Object.defineProperty(rig, 'extent', { value: extent.size, enumerable: false });
```

For a body with a measured hip height every expression gives the value it gives today. `failedRig`
is not changed.

A4. Replace the last line of `sizeRatio` and add the export under it:

```js
  return seated && rigA.trunk > 1e-3 && rigB.trunk > 1e-3 ? rigB.trunk / rigA.trunk : rigSizeRatio(rigB, rigA);
}
/** How much bigger one body is than another: hip heights when both stand on legs, else their extents. */
export function rigSizeRatio(rigB, rigA) {
  if (rigB.hipMeasured && rigA.hipMeasured) return rigB.hipHeight / rigA.hipHeight;
  return rigB.extent > 0 && rigA.extent > 0 ? rigB.extent / rigA.extent : rigB.hipHeight / rigA.hipHeight;
}
```

No change to `src/pose-ik.js` or `src/pose-recognition.js`: POSE handles, Bone Namer and the POSE
corpus diff are untouched by construction. (The POSE-level causes, the Felhound's fourth leg and the
Rat's two-joint legs, stay as they are: see "Not done".)

### Proof that retargeting stays unchanged

Measured with the prototype (`rig-diff.mjs`, every library model read by HEAD and by the prototype,
plain reading plus `seated` and `walker` where the model has them; 510 readings):

- 392 readings identical in every field (body, parts and their joints, lengths, hip height, ground,
  floor, trunk, hip centre, weapon side, facing, actor, reference, problems).
- 118 changed, all plain readings: 96 without legs, 19 with legs that do not stand, 3 Felhound files.
  **No reading with a measured hip height changed**, and no `seated` or `walker` reading changed.
- None of the 16 models of the retarget baseline (`out/transfer-probe/trials.json`) is among the
  118. With equal rigs and `rigSizeRatio` returning the same expression for two measured bodies,
  `buildTransfer` computes what it computes today.
- Only `src/anim-transfer.js`, `src/skeleton-transplant.js`, `src/transfer-picks.js`,
  `src/transfer-window.js` and `app/TransferPicks.jsx` read `transferRig` or `hipHeight`
  (searched); no other tool is a consumer.

The builder of A proves it again on the built code, before hand-back:

1. `node out/transfer-probe/baseline.mjs w` then `node out/transfer-probe/baseline-compare.mjs v w`: `0 differ`.
2. `node --test test/anim-transfer.test.js test/transfer-window.test.js`: the 81 pass, plus the new ones.
3. `node out/transfer-probe/fix-design/rig-diff.mjs` rewritten to compare `git show <base>:src/anim-transfer.js`
   (saved to a file as `proto/make.mjs` does, without its patches) against `src/anim-transfer.js`:
   the same three groups and counts as above (96 / 19 / 3 of 510; other counts mean the code differs
   from this contract).
4. Retargeting does change for the 118 (Take whole body from the Naga, the Spider, the Felhound).
   Those were built on a size of 0.00002 or 41,382; there is no fine result to preserve. Say so in
   the hand-back, with two numbers: Footman takes Walk from the Naga Myrmidon and from the Felhound,
   `built.problems` and the size the build used.

Tests to add to `test/anim-transfer.test.js` (each fails on today's code; new fixtures in
`test/helpers/fixtures.cjs`: `transfer-naga` = `corpus-sd/naga__nagamyrmidon.mdx`, `transfer-felhound` =
`corpus-sd/demon__felhound.mdx`, `transfer-spider` = `corpus-sd/creeps__spider.mdx`, `transfer-wisp` =
`corpus-sd/nightelf__wisp.mdx`, `transfer-necromancer` = `corpus-sd/undead__necromancer.mdx`; a missing
fixture skips, as the file's other tests do):

- S1 "a body without legs has a real size": Naga `hipMeasured === false`, `extent` within 2 of 233,
  `hipHeight` within 1 of 60.7 (today 0.001), `ground` within 1 of 3.2.
- S2 "legs that do not stand are not a hip height": Spider `hipMeasured === false`, `hipHeight`
  within 1 of 56.2 (today 1.42); Footman `hipMeasured === true`, `hipHeight` 41.382 as today (to 1e-3).
- S3 "the Felhound's body is the joint its legs hang from": body is the node named `Bone Center`,
  three leg parts, `hipMeasured === true`, `hipHeight` within 1 of 36.9 (today: one part, 0.001).
- S4 "size ratio": `rigSizeRatio(footman, naga)` within 0.02 of 0.52 (extents 121 / 233);
  `rigSizeRatio(footman, grunt)` equals `footman.hipHeight / grunt.hipHeight` exactly.
- S5 "a rider read alone keeps its numbers": for `transfer-cold-one-rider` and `transfer-knight`,
  `transferRig(model, { actor: 'seated' })` has `hipMeasured === true` and the hip height and ground
  this commit's parent gives (write the two numbers into the test from a run on the parent).
- S6 "one mesh, no legs": Wisp `hipHeight` within 2 of 83.4, Necromancer `hipMeasured === false` and
  `hipHeight` over 10 (today 3.4).

### Package B, first part: the transplant reads the size from A

In `transplantSkeleton` (`src/skeleton-transplant.js`):

- import `rigSizeRatio` from `./anim-transfer.js`;
- `const size = rigB.ok && rigA.ok ? rigSizeRatio(rigB, rigA) : 1;`
- `const travel = rigB.ok && rigA.ok && rigB.hipMeasured && rigA.hipMeasured ? legTravelRatio(legStretches, size, 1e-3 * rigA.hipHeight) : size;`
  (the leg fit divides by the donor leg's drop; a leg that does not stand has none: the sweep has
  travel -0.081 for the Mammoth on the Crypt Fiend).
- Nothing else. Every other use of `hipHeight` in the file is a length (`1e-3 *`, `0.01 *`) and now
  gets a real one for the bodies above.

Measured with the prototype on 233 sweep pairs (`sweep-proto.mjs`, `pairs-proto.json`: 9 open models
on the 21 donors whose reading changes, the three legless open models on 12 standing donors, 8
standing pairs as controls; `proto-compare.mjs`), window default:

| | Before | After |
| --- | --- | --- |
| Size outside 0.05 to 20 | 139 | 0 (sizes 0.26 to 4.4, median 0.94) |
| Pieces flung far | 62 | 4 |
| Shape or extents exploded | 12 | 0 |
| Sinks / floats flagged | 105 / 76 | 54 / 43 |
| Broken, soft, fine | 160, 32, 41 | 20, 88, 125 |

Of the 160 broken, 81 pairs went to fine, 60 from broken to soft, 19 stay broken (12 are the Hermit
Crab's `reading 'clone'`, class 4; the rest are classes 5 to 7). The 8 controls kept their size and
travel to the last digit. Three pairs that passed today are flagged now, all with a legless open
model on a donor that now has legs or a real size (Naga on the Felhound and on the Land Mine: its
lowest point 0.3 body heights under the ground in one animation; Necrarch on the Felhound: 5% of the mesh on a joint the Felhound itself
collapses in Attack). Spot values: Kurgan on the Naga 42,222 -> 0.60; Footman on the Felhound
41,382 -> 1.12, on the Rat -> 1.42, on the Wisp -> 0.38, on the Spider 29.1 -> 0.56, on the Crypt
Fiend 6.2 -> 0.56, on the Vulture 8.3 -> 1.21, on the Dune Worm 3.8 -> 1.20; Naga on the Footman
0.00002 -> 1.94; Necrarch on the Footman -> 0.89.

**What changes among pairs that pass today, and the proof asked for.** Byte-identical is kept for
every pair of two standing bodies. It cannot be kept for the rest, and that is deliberate:

- 27 fine pairs have both hip heights at the floor, so their size is 0.001 / 0.001 = 1 by accident
  (Necrarch, 107 across, on the Catapult, 267 across). They get the extent ratio.
- About 40 fine pairs have a legless donor with an arbitrary number (Dune Worm 19, Mindflayer 11,
  Banshee 4, Wind Serpent 3) or the Crypt Fiend (3). They get the extent ratio too.
- The Felhound's 2 fine pairs change because the Felhound now has legs, which the owner asked for.

Proof on the built code (scripts are written: `out/transfer-probe/fix-design/fingerprint.mjs`,
`fingerprint-compare.mjs`):

1. On the commit **before** B (A and the class 2-5, 8, 9 fixes in): `node fingerprint.mjs before 0 2`
   and `node fingerprint.mjs before 1 2` (two processes, no more; from cmd, `start /low /b node ...` runs one at low priority). 26 open models x 59 donors x Mirror off and on.
2. After B: the same with tag `after`.
3. `node fingerprint-compare.mjs before after` must print `runs that must be identical 1748, of them
   differ 0` (23 standing open models x 38 standing donors x 2; the HD Footman is left out for time) and `with a size outside 0.1 to 10,
   or a throw: 0` for the 1,320 runs that change as designed.

A alone already changes the transplant for the 118 bodies (their hip height becomes the stand-in, so
today's `hipHeight / hipHeight` line gives a sane number). Taken on A's parent, `before` shows the
whole change in the 1,320; taken after A, it shows only B's part. Either way the same 1,748 must be
identical, and that is the proof that matters.

Tests to add to `test/skeleton-transplant.test.js` (fail on today's code):

- Z1 "Kurgan on the Naga: a sane size": `report.counts.sizeRatio` between 0.5 and 0.7 (today 42,222);
  every result pivot and every key value finite and under 10,000 in magnitude; in the result's Stand,
  at 13 moments, the skinned mesh's box is at most twice the Kurgan's own bind box on every axis.
- Z2 "Naga on the Footman": `sizeRatio` between 1.7 and 2.2 (today 0.00002); the mesh does not
  collapse: in Stand the skinned box is at least half the Naga's bind box on its longest axis.
- Z3 "Footman on the Spider and on the Felhound": `sizeRatio` between 0.4 and 0.8, and 0.9 and 1.4.
- Z4 "Kurgan on the Tauren and Footman on the Grunt are untouched": `sizeRatio` and `travel` equal
  the values today's engine gives to 1e-12 (0.817 and 0.724 on the owner's pair; read both pairs'
  values from a run on the parent and write them in). On the prototype the whole Footman-on-Grunt
  result is byte-identical to HEAD's (`keys-check.mjs`).

## Poor fit

### What it says today, and why it predicts nothing

`report.fit` is `'poor'` whenever `reasons` is not empty. In the sweep (1,452 built window-default
pairs) that is 1,127 pairs, 78%. The reasons, counted (`rows-all.json`):

| Reason | Times | Is it about the fit? |
| --- | --- | --- |
| "The donor has no left leg to give this model's..." (one sentence per limb, up to 8) | 3,367 | Yes |
| "Hips and legs keep the body animation: the two models stand on a different number of legs." | 948 | Yes, but the wording is Retarget's (a transplant has no body animation) |
| "The open model has bind poses (Reforged skinning); they are left out of the result." | 59 | No: a format note. It alone makes every HD model a poor fit on every donor |
| "The result's body was not recognised..." | 15 | No: an internal reading |

Two different questions were being asked of one label:

- *Will it break?* The 89 "said good, broken" pairs are bugs: weapon on a hidden bone (class 5),
  absurd size (class 1), flung pieces (class 7). A fit label cannot and should not predict bugs; the
  fixes remove them.
- *Do the bodies match?* That is what the owner's "Say its a poor fit, still do it" answers, and on
  that question the label is mostly right: a Footman on a Catapult, a rider or a snake is a poor fit.
  The 609 "poor but working" pairs are not wrong, they are ungraded: a missing tail-like fifth leg and
  a body of which nothing follows read the same, as a wall of up to eight sentences.

### What it means from now on

**Poor fit says how much of this model moves as the donor's same part.** It is one measured share
and at most two sentences. It never reports bugs and never blocks anything.

- **Follows** (`report.follows`, 0 to 1): the share of the open model's body skin whose bone sits
  under a part joint that got a donor joint. Skin on pieces that keep their own bone (off-body
  pieces, kept extras) is not counted either way.
- **Rides still** (`report.still`): the keys of the open model's parts none of whose joints got a
  donor joint.
- `fit` is `'poor'` when any of these holds, else `'good'`:
  1. a body could not be read, the donor has no animations, or the pairing threw (the reasons the
     engine already gives for these);
  2. the hips, or an arm, a leg or a wing rides still;
  3. under half of the body follows (`follows < 0.5`);
  4. a geoset needs over 256 bone groups (the existing sentence; the result would not save whole).
- Not a poor fit by themselves, listed as notes when the fit is poor for another reason: a tail
  that rides still; bind poses left out; the size taken from the bodies' extents; the result's legs
  not read.

Why this shape: the continuum has no natural cut (`coverage.mjs` over the 1,593 pairs: the share is
spread evenly from 0 to 1; pairs whose hips and two legs ride still run from 0.32 to 0.89), so a
share threshold alone would call half of the "legs frozen" pairs good. The body-plan rule (2) is
exact and explainable; the share grades it; rule 3 ("under half", the plain majority) catches bodies
where no single arm or leg is missing but most of the skin is on parts the donor lacks (a body with
head and chest joints on a Hermit Crab: 0.40 to 0.49).

### Package B, second part: `transplantSkeleton`

B1. After the trunk pairing loop (where `jointTarget` is complete), compute:

```js
  // Poor fit: how much of the body moves as the donor's same part (docs/agent-tasks/xfer-transplant-fixes.md).
  const still = Object.values(rigB.parts || {}).filter(part => !part.joints.some(id => jointTarget.has(id))).map(part => part.key);
```

and, after `targetOf` exists, the share, over the open model's vertices with the weights the file
already reads in the `ownVertexCount` loop (HD: each bone's weight; classic: equal shares of a group):

```js
  let counted = 0, following = 0;
  // per vertex, per bone `id` with weight w (w = weight / 255 for SkinWeights, 1 / bones.length for Groups):
  //   if (targetOf(id).own != null) continue;                       // keeps its own bone: not counted
  //   const joint = treeB.ancestors(id, true).find(partJoint); if (joint == null) continue;
  //   counted += w; if (jointTarget.has(joint)) following += w;
  const follows = rigB.ok && rigA.ok && counted > 0 ? following / counted : 0;
```

B2. Sentences. `reasons` keeps its place in the report and is what the window shows; it is built at
the end in this order, with these exact strings (templates for the catalogs in brackets):

1. `` `${Math.round(follows * 100)}% of the body follows the donor.` `` [`{0}% of the body follows the donor.`]
2. when the two stand on a different number of legs (`whole.reason` is set):
   `The two models stand on a different number of legs: this model's hips and legs ride the donor's body without moving by themselves.`
3. the parts of `still` that sentence 2 does not already cover (with sentence 2: everything but
   `hips` and `leg*`), as one sentence, labels from `transferPartLabel(key).toLowerCase()` joined with `, `:
   `` `No counterpart in the donor: ${list}. They ride the donor's body without moving by themselves.` ``
   [`No counterpart in the donor: {0}. They ride the donor's body without moving by themselves.`]
4. the hard reasons, unchanged strings: body not recognised (open model, donor), no animations,
   could not be paired, over 256 bone groups;
5. notes, also returned alone as `report.notes`:
   - `The open model has bind poses (Reforged skinning); they are left out of the result.` (unchanged string)
   - when `!(rigB.hipMeasured && rigA.hipMeasured)` and both rigs are ok:
     `Sized by the bodies' overall size: one of them does not stand on legs.`
   - from `settleFeet`: `The result's legs were not read: its height was not settled.` (replaces
     "The result's body was not recognised: ...").

The per-limb sentence ("The donor has no {0} to give this model's...") and the use of
`whole.reason`'s text are removed. `counts.ridesStill` stays as it is (limbs only).

B3. `const hard = [sentences of 4]; const fit = hard.length || still.some(key => key === 'hips' || /^(arm|leg|wing)/.test(key)) || follows < 0.5 ? 'poor' : 'good';`
`report` gains `follows`, `still`, `notes`. When `fit` is `'good'`, `reasons` is still filled (the
window shows it only when poor; tests read it).

B4. Window: no code change (`app/Transfer.jsx` shows `reasons` under **Poor fit** when `fit === 'poor'`).
Add the four new sentences to the five catalogs through the task's string file
(`out/transfer-probe/transplant-window-strings.json` with `locales.mjs`, as build 23 did), remove the
two retired ones, update `test/fixtures/locale-feature-sources.json` and the catalog sizes in
`test/localization-catalogs.test.js`. No flavour text: these are functional labels.

Tests (`test/skeleton-transplant.test.js`; fail first on today's code):

- F1 "Kurgan on the Tauren and Footman on the Grunt are good fits": `fit === 'good'`, `follows >= 0.99`, `still` empty.
- F2 "the share is the skin on paired parts": Kurgan on the Naga: `still` holds `hips`, `legL` and
  `legR`, `fit === 'poor'`, `follows` equals, to 0.01, one minus the share of the Kurgan's body
  vertices whose bones hang under the parts in `still` (compute it in the test from the model and
  `transferRig`; about 0.90 by `coverage.mjs`: the hammer and the armour are most of its vertices,
  which is why rule 2 and not the share decides here).
- F3 "one share line, one sentence per cause": Kurgan on the Magnataur (replaces T10's reason
  check): `fit === 'poor'`; `reasons[0]` matches `/^\d+% of the body follows the donor\.$/`;
  exactly one reason starts with `The two models stand on a different number of legs`; no reason
  contains `to give this model's`; at most 4 reasons (today 3 on this pair, up to 8 in the sweep).
- F4 "bind poses alone are a note": a copy of the Footman with `BindPoses` set to one identity
  entry, on the Grunt: `fit === 'good'`, `notes` holds the bind-pose sentence (today `'poor'`).
- F5 "a tail alone is not a poor fit": Tauren on the Footman: `still` is `['tail']`, `fit === 'good'`,
  `follows` under 1.
- F6 "under half": Footman on the Wisp: `follows < 0.5`, `fit === 'poor'`, the result is still made
  and validates as T1 checks.
- `test/transfer.electron.cjs`, story `transplant`: the Magnataur check reads "Poor fit with a share
  line and at most 4 sentences" instead of "3 reasons". Run that story alone on the packaged build.

## Verdicts

### Class 6, own mesh vanishes in Death or Decay (20 pairs): correct donor motion

`bone-fate.mjs` and `flung-causes.mjs` on all 18 sane-scale pairs (Chaos Dragon Skeleton 16, Frost
Wyrm 2): every vanished vertex sits on a donor bone, that bone is collapsed in the donor's own
animation at the same moments (13 of 13 in Decay Bone, 2 of 13 in Death Alternate), and the donor's
own skin on it is collapsed with it (in Decay Bone its geosets are hidden as well). The donor's body
goes there; with 100% of the donor's motion so does the model. The sweep flagged it because the open
model has a larger share of its vertices on those bones than the donor has. **No engine change.**
The acceptance sweep compares bone by bone instead (below).

### Class 7, pieces fly off (66 sane-scale pairs): 59 are a bug, but not the one named

| Cause | Pairs | Verdict |
| --- | --- | --- |
| The open model's **own** pieces off the body (gut chunks, bone piles, a death club) | 59 | Bug, old (v1). Not donor motion |
| The weapon on a donor bone that flies | 2 | Belongs to class 5 |
| Donor bones that travel (Penguin swims off in Death Swim, Wyvern falls) | 5 | Correct donor motion, scaled by size |

The 59: `transplantSkeleton` keeps own skinned joints outside the body (`outsideKept`) and freezes
them at the model's Stand pose, where such pieces are parked (hidden, off to the side or at the
origin). Their geosets' visibility, though, is refitted by kind like every own effect, so in the
donor's Death the piece is **shown, frozen at its parking place** while the body is elsewhere (the
Footman's `gutz00`, 51 vertices; the Blood Dragon's 352). Nothing of the donor is involved.

Package C (only on the owner's yes, question 2), in `transplantSkeleton`:

- In the own-node loop, an own joint in `outsideKept` (not a kept extra, which holds still on its
  joint as the owner settled) keeps its own `Translation`, `Rotation` and `Scaling` tracks instead of
  the constant reference-pose tracks.
- Those joints join the list given to `ownTimedTracks` / `refitTracks`, so their keys are fitted into
  each donor animation from the own animation of the same kind (else the own Stand), exactly as the
  model's own emitters and geoset visibility already are. A joint track the refit leaves without keys
  is deleted (the joint rests at its pivot, as in an own animation with no keys); use whatever the
  class 2 fix settled for tracks left empty.
- Test P12: Footman on the Grunt: in the result's Death, at 13 moments, `gutz00`'s world matrix
  equals the Footman's own `gutz00` at the same share of its own Death (to 1e-3), and differs from
  its Stand pose at some moment (today: equal to the Stand pose at all 13). Test P13: every node but
  the off-body joints, and all geometry, are byte-identical to the result without this change.
- This changes bytes in every result whose open model has such pieces (most SD units), in those
  joints' three tracks only. P13 is the proof for pairs that pass today.

Passed on to the class 5 workers (found while judging this; not designed here): the donor's "weapon
bone" is taken from where its `Weapon Ref` hangs, and on 20 of the 59 donors that is the head, a
leg or the body (Gargoyle, Kodo, every dragon, Hydra, Wyvern, Skink: `Bone_Head`; Frog: a leg; Dire
Wolf, Catapult: the body). The model's weapon then follows the donor's head in every animation, not
only in Death; the 90 "weapon vanishes" pairs are five dragons whose head collapses with the whole
body. `weapon-bones.mjs` lists all 59.

### Class 10, feet sink or float (453 flags at sane scale): 121 are a real bug, 38 are the size, the rest is not the feet

The sweep's measure is the lowest vertex of the whole mesh, so it cannot tell a foot from a hand or
a cape. `feet-verdict.mjs` judges every flag at the feet instead (prototype engine with the class 1
size; 453 flags, 415 pairs, the HD Footman as open model left out): in the flagged animation, the
result's lowest leg end joint against what the owner's "feet down" rule aims at, the donor's lowest
leg end above its ground times the travel ratio. "On target" is within 0.1 hip heights.

| What the flag is | Sinks | Floats | Verdict |
| --- | --- | --- | --- |
| **Feet off target** | 27 | 94 | **Real, an engine bug** (package D). 118 pairs, always one of nine donors |
| The result has no legs to stand on (the model's legs ride still, or the donor has none) | 39 | 69 | 38 are the Vulture: **the size** (8 times too big, class 1). The rest hover with a legless donor (Banshee, Wind Serpent, Mindflayer): the donor's height, a poor fit by the label |
| Feet on target, the donor is off the ground itself (flies, rears, swims) | 29 | 37 | Not real: the donor's motion |
| Feet on target, something else is low or high (hands, weapon, head, tail, a folded leg) | 128 | 30 | Not the feet: the donor's pose on other proportions; the user corrects. 20 of them are the HD Footman as donor, where the read leg end is not the foot: real, but an HD reading gap, not this engine |

`lowest.mjs` names the bones for seven such pairs (Aspiring Hero on the Ghoul: the wrist 87 under the
ground with both leg ends within 0.7 of it; Footman on the Ogre in Sleep: the club and its hand;
Lord of Change on the Tauren: the collar joints).

**The bug.** `feetDown` and `settleFeet` move "the body joint and every parentless donor joint"
(`movers = [rigM.body, ...loose]`, `shiftBody(M, rigM.body, dz, loose)`). On the Tauren the body
joint has no parent. On nine of the 59 donors it hangs under another joint, which is itself one of
the parentless ones (`Bone_Body` under `Bone Frostwyrm`, `Bone_Root` under `Dummy01`): the body is
then moved **twice**. Footman on the Blood Dragon Nightmare: leg ends 62 to 72 above the ground
through Morph Alternate where the donor's stand on it; on the Gargoyle 18 too high (0.44 hip
heights). `feet-debug.mjs`, `feet-debug2.mjs`. The nine: Grizzly Bear, Gargoyle, Chaos Dragon
Skeleton, Red Dragon, Frost Wyrm, Bat King, Gryphon Rider, Blood Dragon Nightmare, Hydra
(`misc-check.mjs`). The settling has moved the parentless joints with the body since v2 items 1-3
(bbed78dd), feet down since 54d148bb.

Package D, `src/skeleton-transplant.js`:

```js
/** The joint that moves the body up and down: the topmost joint above the body joint whose position keys are not on a
 * global sequence (else the body joint), and the joints on that line, which must not be moved again. */
function bodyMover(M, body) {
  const joint = node => node && JOINT_KEYS.some(key => M[key].includes(node)), line = [body];
  for (let parent = M.Nodes[body]?.Parent; parent != null && parent !== -1 && joint(M.Nodes[parent]); parent = M.Nodes[parent].Parent) line.unshift(parent);
  const free = id => !(M.Nodes[id].Translation?.Keys?.length && isGlobalTrack(M.Nodes[id].Translation, M));
  return { mover: line.find(free) ?? body, line: new Set(line) };
}
```

- `feetDown`: `const { mover, line } = bodyMover(M, rigM.body);` and
  `const movers = [...new Set([mover, ...loose.filter(id => !line.has(id))])].map(id => M.Nodes[id]).filter(...)` (the filter as it is).
- `settleFeet`: `const { mover, line } = bodyMover(M, rigM.body); shiftBody(M, mover, groundShift(M, rigM, rigB), loose.filter(id => !line.has(id)));`
- A body joint with no joint above it gives `mover === body` and an unchanged `loose`: the result is
  byte-identical (prototype: Footman on the Grunt identical to HEAD with A, B's size lines and D in).

Measured with the prototype (the simpler form: always the topmost joint): feet off target 121 flags
-> 3 (two a biped on the four-legged Frog, 0.34 hip heights; one at 0.126); Footman on the Blood Dragon
Nightmare leg ends within 2 of the donor's at every sampled moment; on the Gargoyle within 3.

Tests (`test/skeleton-transplant.test.js`; new fixture `transfer-gargoyle` =
`corpus-sd/undead__gargoyle.mdx`):

- D1 "a body joint under another joint is moved once": Footman on the Gargoyle: in every animation
  but death and decay, at 13 moments, the result's lowest leg end joint above the Footman's ground is
  within 0.06 hip heights of the Gargoyle's lowest leg end above its ground times
  `report.counts.travel` (today: 0.44 off in Morph). Fails on today's code.
- D2 "one joint carries the height": Footman on the Gargoyle built with `feet: 'free'` and with the
  default: `Bone_Root`'s translation keys are the same in both and `Dummy01`'s differ (today both
  differ, `feet-debug2.mjs`).
- P5 and P11 (Kurgan on the Tauren) must pass unchanged.
- Proof for pairs that pass today: `fingerprint.mjs` before and after D, then
  `node fingerprint-compare.mjs <before> <after> D`: the 2,600 runs whose donor is not one of the
  nine are identical (26 open models x 50 donors x 2).

## Acceptance gate (after B and D; again after C if built)

Low priority, two processes at most (the owner's PC lagged under 12).

1. `node --test test/anim-transfer.test.js test/transfer-window.test.js`: the 81 and the new ones pass.
   `node out/transfer-probe/baseline.mjs <tag>`, `baseline-compare.mjs v <tag>`: **0 differ**.
2. `node --test test/skeleton-transplant.test.js test/transplant-skin.test.js`: all pass.
3. `fingerprint-compare.mjs` for B: 1,748 must-be-identical runs, 0 differ; for D (argument `D`):
   2,600, 0 differ.
4. The failure sweep again, in two shards: `node out/transfer-probe/failure-sweep/sweep.mjs 0 2`,
   `... 1 2` (the first run used 12 shards; how long two take was not measured, and the HD Footman as
   open model takes most of it: leave it running), then
   `analyze.mjs`. Before the run, three changes to the sweep's own measures, so it stops counting
   donor motion (in `sweep.mjs`, not in `src`):
   - `mesh-vanishes`: flag a sequence only when some result bone that carries skin is collapsed at
     a moment where the donor bone it comes from (`report.donorNodes`, inverted) is not collapsed
     in the donor.
   - `flung-vertices`: count only vertices on donor bones (ids in `report.donorNodes`' values) while
     C is not built; with C, all vertices again.
   - feet: replace `sinks-into-ground` / `floats-above-ground` by `feet-off-target` as
     `feet-verdict.mjs` measures it (the result's lowest leg end joint against the donor's, times
     travel, over 0.1 hip heights), only where the result has legs.

| Class | Sweep today (window default, of 1,593) | Target after A, B and D (others' fixes in) |
| --- | --- | --- |
| 1 size outside 0.05 to 20 | 452 | **0**; every size within 0.1 to 10 (prototype subset: 0.26 to 4.4) |
| shape exploded, extents absurd | 29, 21 | **0**, **0** |
| 6 mesh vanishes (new measure) | 20 by the old measure | **0** |
| 7 flung vertices | 296 (66 at sane scale) | at most 10 with C; without C the new measure reads at most 10 and the old one about 60 |
| 10 feet off target (new measure) | 121 flags in 118 pairs (measured on the prototype without D) | at most 5 pairs (prototype with D: 3 flags) |
| throws | 141 | 0 (classes 2, 3, 4: other workers) |
| built pairs with `fit: 'poor'` and no arm, leg, wing or hips riding still and `follows >= 0.5` and no hard reason | 59 or more (bind poses) | **0** |
| pairs with `fit: 'good'` and a size outside 0.1 to 10 | 33 | **0** |
| build time, pairs over 2 s | 360 | not worse |

Not targets (they are the donor's motion or the user's correction, see the verdicts): the old
`sinks-into-ground`, `floats-above-ground`, `weapon-on-hidden-bone` on a dragon's head.

5. Packaged check, hidden: the `transfer` harness with the sweep on the new build, then a test build
   for the owner opened with `TEST TRANSPLANT 11.mdx` (a Kurgan copy) and a launcher that names the
   three donors to try from the library: Naga Myrmidon, Felhound, Spider.

## Not done, and why

- The Felhound's fourth leg (its joints are unnamed helpers) and the Rat's two-joint legs are POSE
  reading gaps in `src/pose-ik.js`. Fixing them changes POSE handles and Bone Namer for the whole
  library and needs the POSE corpus diff and the Bone Namer gate; nothing in class 1 needs them (the
  Felhound stands on three read legs, like the Dire Wolf today).
- The HD Footman as a donor reads two legs and no arms, and its leg ends are not its feet (class 10).
  HD recognition is its own task.
- When a rig is not read at all (`rig.ok` false; 2 of 436 library models) the size stays 1.
- A rider or mount read alone (`seated`, `walker`) keeps today's numbers on purpose; the window's
  Rider / Mount buttons exist only in Retarget.

## Questions for the owner

1. **Legless donors that pass today change too.** A Footman on the Dune Worm, the Banshee, the
   Mindflayer or the Wind Serpent, and legless models on legless donors, get the size from the
   bodies instead of today's number (about 70 pairs of the sweep that are not flagged today). You
   would see: on the Dune Worm the body sways a third as far as now (size 3.8 -> 1.2); on the
   Vulture the model stops flying 8 times too far. Keeping today's results for those pairs means
   keeping those sizes. Recommended and written above: change them.
2. **Your model's own gut chunks and bone piles in the donor's Death (package C).** Today they show
   frozen at their parking place. With C they play your model's own Death pieces, fitted to the
   donor's Death. Or they could be hidden. Recommended: C. It changes those pieces in results that
   pass today.
3. **What "Poor fit" means.** Written above: it is shown when the hips, an arm, a leg or a wing of
   your model has nothing to follow in the donor, or under half of the body follows; the box starts
   with one number ("62% of the body follows the donor.") and names the parts in one sentence. An HD
   model is no longer a poor fit just for being HD. The other way would be the share alone with a
   cut you pick (under 75% shows the box on about 57% of the sweep's pairs, under 50% on 29%); it
   would call a body with frozen legs a good fit whenever the legs are a small part of the mesh
   (the Kurgan on the Naga: 90% follows, legs still). Recommended: as written.
4. **Where the model vanishes because the donor's body does** (class 6: Chaos Dragon Skeleton in
   Decay and Death Alternate, Frost Wyrm in Birth). Kept as the donor's motion, as you ruled for the
   totem. Say so if the model should stay visible there instead.

## Owner's answers (19 Nov 2026)
1. Legless donors that pass today change too: "Show me examples first of before and after." (pending, side-by-side sheet)
2. Own gore pieces in the donor's Death, play own vs hide: "Show me both." (pending, side-by-side sheet)

Sheets for answers 1 and 2 (19 Nov, prototype engines in `out/transfer-probe/owner-choices/`, `make.mjs`; build 25):
`_START HERE\7 TRANSPLANT - legless before and after.cmd` (`TestBuilds\transplant-review-legless`, models
`TEST LEGLESS 01-05`) and `_START HERE\7 TRANSPLANT - gore pieces.cmd` (`TestBuilds\transplant-review-gore`,
`TEST GORE 01-02 NOW/PLAY/HIDE`). Measurements in `owner-choices/legless-sheet.txt` and `gore-sheet.txt`.
3. Poor fit rule as written: yes.
4. Model vanishes where the donor's body vanishes: yes (keep as donor motion).
- Sheet answers (19 Nov evening): legless donors, all five cases **After** (Kurgan on Naga: "Looks right") → build packages A+B as written.
- Gore sheet: owner rejects all versions: "both death animations (gore pieces) look wrong, ogre has many bones unbound, ghoul doesnt move". Package C is on hold until the cause is investigated.
- Built 19 Nov: A (`0a70da55`) and B (`9775710e`), plus the weapon bone on a hand (`518de79f`, `244deebd`); results in [xfer-both-ways.md](xfer-both-ways.md#packages-a-and-b-weapon-bone-on-a-hand-result-builder-claude-opus-19-nov-2026). C not built.
- Gore investigated 19 Nov (`owner-choices/gore-why/`): the Ogre's plank is his off-hand weapon on a second arm (twin chain, now fixed in the engine); the Ghoul's corpse is a copy on a twin skeleton. New sheet `_START HERE TRANSPLANT - how he dies.cmd` (Living body dies / Corpse follows); results in [xfer-both-ways.md](xfer-both-ways.md#twin-chains-and-how-he-dies-builder-claude-opus-19-nov-2026). Package C stays on hold.
