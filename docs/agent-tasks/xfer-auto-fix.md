# XFER Transplant: Auto fix (step 1)

**Status:** step 1 built, verified and **accepted by the owner** (22 Nov 2026: all four keys kept; grades 10, 5, 10, 9, 10, 10, 8, 10, 10 for pairs 10, 12, 15, 17, 18, 32, 34, fresh #18, fresh #31; comments: 12 "needs improvement, not smooth and staff angle is incorrect.", 34 "angle of sword is slightly off but much better"). Step 2 handed to Codex on `codex/xfer-auto-fix-step2`, cut from this branch. Local only. Branch `claude/xfer-auto-fix` (worktree `D:\Claude\MDLxL\.claude\worktrees\xfer-auto-fix`), cut from `codex/xfer-astra-r1` at `d831e3c7` (graded engine source `8c5f3c67`). Nothing is online.

## Why

The owner graded 34 transplant pairs on 22 Nov 2026 (eight zeros) and asked: "at this point you need to offer users an AUTO FIX!!!!! to avoid regressions on other models, offer it as an option". Nine earlier engine trials were all reverted because each changed the default result for every model.

- Diagnosis: `D:\Codex\xfer-engine-34\Claude diagnosis.md`
- Plan (all steps, pass numbers, gates): `D:\Codex\xfer-engine-34\Claude fix plan.md`
- Measuring scripts and pictures: `D:\Codex\xfer-engine-34\Claude diagnosis files\held\` (`engine.mjs` runs any engine source in memory: `XFER_SRC=<src folder>`, `AUTOFIX=all|hand,markers,detached,trunk`)

## Contract

- **Off is today's transplant, exactly.** `autoFix` absent or false: no code path changes, the result model is byte-identical, and the report has no `autoFix` key.
- **On, each correction is separate**: its own key, its own commit, acts only where its fault is measured on the two models, refuses when unsure, and reports what it did.
- **No minimum number of pairs** a correction must fire on (owner agreed, 22 Nov 2026). A repair for a rare modelling fault is rare. The tests are: written as a general rule, silent where its fault is absent, refuses when unsure.
- **Never judged by the quantity it sets.** Checks follow the recipient's own vertices (same indices in the native model and the result).
- **UI:** one "Auto fix" checkbox with Sounds and Effects in the Transplant settings column, one short line per correction made under it. No new panel. Off by default.

## What is built (`src/transplant-autofix.js`, option `autoFix` on `transplantSkeleton`)

| Key | Rule | Where | Report |
|---|---|---|---|
| `hand` | Weapon hand from what is held. A named side stands when that arm holds a measured item or a weapon-named bone there carries skin; a name on an empty helper gives way to the one other arm that holds a measured item; no name: the one arm with a measured item, else the hand a detached item stays with (within 20% of standing height and half the other hand's distance). Unknown on either model: the named decision stands. | `heldSide`, `autoFixMirror`; the caller decides Mirror (`Transfer.jsx` `mirrorOf`); the engine's `mirrorOffer` follows it | `autoFix.mirror = { held, named }` |
| `markers` | A model's `Hand … Ref` more than 30% of a hip height from the real grip, or `Hand Ref → Weapon Ref` more than 30° off the measured butt-to-tip line: the transplant runs on private copies of both models with those markers on the measured grip and tip. Where no weapon fit ran on the corrected markers, the result is rebuilt without the key, so it is the plain one (corrected donor markers would otherwise move the result's own attachment points for nothing: pairs 04, 22, 24, 29). | `fixMarkers`, start of `transplantRun`; `transplantSkeleton` is the wrapper that rebuilds | `autoFix.markers = true` only when the fit used them |
| `detached` | A skinned bone outside the arms is the weapon without the name test, when the plain call found none; its `Weapon` attachment and hand distance are still required. | `detachedGrip(…, anyName)` in `transplant-props.js`; call site in `transplantSkeleton` | `autoFix.detached = [bone names]` |
| `trunk` | The trunk posture turn is left out when the model has fewer than two legs and its placed hip-to-shoulder line is shorter than 8% of its standing height. A model on legs is never touched (pair-33, graded 9, has a 5% line and must not change). | `twoLegged` in `transplantSkeleton` | `autoFix.trunkLine` (share), `autoFix.trunk = true` |

`autoFixNotes(report, mirror)` gives the window's lines.

## Pass numbers (graded pairs, measured with the `held\` scripts)

| Pair | Check | Graded | Limit | With the key |
|---|---|---:|---:|---:|
| 15 Bretonnian Archer → Ungor Bow | bow against the donor's bow, Attack - 1, 2 ms (`track.mjs`) | 0.42 H off | 0.10 | 0.10 (`hand`: Mirror off) |
| 12 Demon Hag → Lahmian | spear to hand skin, Walk / Attack mean (`float.mjs`) | 19.1% / 18.4% | 7.4% | 3.0% / 3.3% (`hand`: Mirror on) |
| 18 Forest Troll → Luc | hammer against the troll's sword (`axis.mjs`) | 160° | 30° | 2° (`markers`) |
| 10 Obsidian Reaver → Murloc | blade to hand skin (`float.mjs`) | 20.8% | 6.1% | 4.3% (`markers`) |
| 34 Knightess → Paladin | sword to hand skin, Walk (`float.mjs`) | 13.7% mean | 9.2% | 5.7% mean, 6.1% max (`detached`) |
| 17 Snotling → Dullahan | lean, lowest to highest quarter of the body (`lean.mjs`) | Walk 71°, Stand 72° | native 24°, 19° | 27°, 23° (`trunk`; line 4.4% of height) |

## Known leftovers (later steps of the plan)

- Pair-34: the sword is in the hand but 47° off the donor's sword.
- Pair-12: Spell reopens after 450 ms; Walk tops its limit briefly (8.6% at 230 ms).
- Pair-32 (graded 8) changes under `markers`; the owner judges it on the sheet.

## Checks run (22 Nov 2026)

- **Off is the graded bytes.** For all 34 graded pairs the plain transplant, serialized, equals the graded result file byte for byte (`D:\Codex\xfer-engine-34\Auto fix sheet\byte-gate.json`, built by `build.mjs` there).
- **On changes seven pairs, byte for byte:** 10, 18, 32 (`markers`), 12, 15 (`hand`), 34 (`detached`), 17 (`trunk`). The other 27, including every 10 and every 9, are byte-identical to the plain result.
- **Each key alone** over the 34 (`held\gates\*.txt`, largest vertex move): `hand` 12, 15; `markers` 10, 18, 32; `detached` 34; `trunk` 17.
- **Two rules were tightened by these sweeps.** `trunk` first fired on pair-33 (graded 9), so it now needs fewer than two legs. `markers` first moved attachment points on pairs 04, 22, 24 and 29, so it now falls back to the plain result where the fit did not use the markers.
- **The earlier fresh 50** (`heldgatesresh50-all.txt`, all keys on): 43 identical, 7 change. Five are the same pairs as above under their old numbers. Two are new, both graded 9, both by `hand` turning Mirror on: fresh #18 (War Monger to Fresh Shambler: the Shambler's only measured item is in its left hand while its Weapon marker sits on its bare right hand) and fresh #31 (Crossbowman to Gnoll: the crossbow, on its own bone, stays with the right hand; the Gnoll's flail is in its left). Not verified as better; both are on the grade sheet for the owner to judge.
- **Full source suite** (`node --test "test/*.test.js"`, 22 Nov 2026, at `a4e2215a`): 4,390 tests, 4,375 pass, 10 skipped, 5 fail. The five are 4 EMTR tests in `test/particle-reentry.test.js` and "Movement and Portrait share the complete viewpoint dropdown" in `test/portrait-toolbar.test.js`. The same five fail on the base `d831e3c7` and on `main` `6ff9136f` in the owner's checkout, which has CRLF sources these text-matching tests read. Not caused by Auto fix. (An earlier run of this suite never started: the PowerShell file list was too long for Windows and still reported exit 0. Quote the glob so node expands it.)
- **Source tests:** `test/transplant-autofix.test.js`, 30 tests on nine real pairs in `D:\Claude\MDLxL-TestModels\xfer-auto-fix`; each visible check also asserts the plain result fails its limit.
- **App click, packaged build, hidden:** `test/transplant-autofix.electron.cjs` on `TestBuilds\transfer-xl-32`: off by default, ticking rebuilds and lists the correction, unticking takes it back, Transplant then one Undo.
- **Grade sheet checked hidden in the same build:** nine cases, three views each, Look buttons find their bones, no error text.

## For the owner

- Grade sheet (donor, today, Auto fix side by side): `D:\Claude\MDLxL\TestBuilds\_START HERE\GRADE - Auto fix (9 pairs).cmd`; answers in `D:\Codex\xfer-engine-34\Auto fix sheet\answers.json`.
- The switch itself: `D:\Claude\MDLxL\TestBuilds\_START HERE\9 TRANSPLANT - Auto fix switch.cmd` (opens `TEST XFER AUTOFIX 01.mdx`).

## Outstanding at the end of step 1

- The change list over the 1,263-pair replay (plan gate 3). The 34 graded pairs and the fresh 50 are swept.
- Steps 2 to 5 of the plan (Tinker's arms, looping-timer motion, shoulders, cloak and tail, weapon out of the body).

## Step 2 · stopped on the accepted step-1 replay

The step-1 `detached` key splits the Chameleon Skink’s blowpipe mesh on two independently reproduced donors. On humanoid 95, the same edge is 3.34% of native standing height with Auto fix off and 43.14% with only `detached` on. This occurs in Stand - Var3 at 1,625 ms. On humanoid 195, the edge grows from 3.76% to 43.54% in Attack - 2 at 906 ms. The native edge is 3.34%. Two other Skink blowpipe recipients show the same split. On humanoid 493 the edge grows from 3.66% to 39.01% in Stand - 4 at 1,517 ms. On humanoid 841 it grows from 2.87% to 40.01% in Stand - 1 at 750 ms. On all four rows, both adjoining triangles are on a visible geoset with an opaque material layer. The key moves the blowpipe carrier to the hand while the tip stays on the body. The two ends of a continuous surface then follow different joints. All four reproductions use the accepted step-1 commit 45f64e6e. The owner’s stop condition applies.

[Matched frame](<D:/Codex/xfer-engine-34/Step 1 replay/Skink blowpipe.png>) · [Frame, material and skin weights](<D:/Codex/xfer-engine-34/Step 1 replay/Skink measurements.txt>)

### Step-2 work at the stop

| Pair | Rule and disposition | Evidence |
|---|---|---|
| 09 Tinker → Kel’Thuzad | Saved `arms` alone at a45b81ac. For a single pair of recipient arms, prefer the first POSE arm on each donor side only when both uniquely meet the shoulder-height and terminal hand-reference tests. Ambiguous readings retain the original pairing. | The recipient’s shoulder-to-wrist skin direction in chest space, sampled every 20 ms, improved from 62.57° to 11.75° in Walk and from 58.66° to 11.94° in Attack - 1 (limit 15°). The historical 55.7° and 54.1° baselines use joint directions. Across 86 saved exports, only pair-09 changed with the key alone or added to step 1. Nine single-arm control models passed the focused test. The wider step-2 replay and packaged verification remain outstanding. |
| 30 Locust | Looping timer keys should keep the skin on its moving bone. Pending. | No trial before the stop. |
| 34 Paladin | Align a detached sword with the donor blade around the hand. Pending. | Step-1 output still matches the owner’s grade-8 file. |
| 12 Lahmian | Keep staff and hand together through the donor’s swing. Measurement only. | In Spell the step-1 gap is 7.4% at 450 ms and 35.4% at 760 ms. At 750 ms the donor gap is 5.3%. Peak tip travel per 2 ms in Spell is 3.70% of recipient height versus 2.20% on the donor. The directed offset reaches 23.6° in the measured Walk, Attack and Spell. The source of the owner’s angle complaint remains open. |

Auto fix off matched 86/86 saved exports before and after the arm selection. With all keys enabled all nine accepted step-1 exports matched their saved bytes. The two focused test cases passed. The remaining transplant, transfer and window tests, hidden packaged click and grade sheet were deferred at the stop. No step-2 key was reverted. The four accepted step-1 keys remain intact.

### Accepted step-1 keys across all 1,263 replay rows

Row numbers are one-based within each named manifest set. A changed row has a vertex displacement above 0.01% of native standing height or a moving attachment. Each row compares Auto fix off with each of the four keys individually. A byte change with neither kind of movement is listed separately.

- **hand** — 59 changed. humanoid 9, 38, 65, 68, 142, 143, 145, 154, 175, 183, 264, 276, 288, 300, 325, 329, 338, 375, 399, 411, 428, 443, 479, 484, 493, 503, 504, 508, 538, 543, 548, 561, 642, 671, 704, 747, 761, 822, 826, 833, 841, 846, 865, 870, 903, 920, 929, 940, 983, 984, 990, 994 · panel 54 · original40 16 · new40 26 · fresh50 18, 23, 29, 31.
- **markers** — 5 changed. humanoid 435, 532 · showcase40 25 · fresh50 12, 47.
- **detached** — 5 changed. humanoid 95, 195, 493, 841 · fresh50 2.
- **trunk** — 1 changed. panel 57.

All 1,263 input pairs completed the first replay against step 1. The second pass explicitly serialized keys that the first pass could rule out from the rig. 2 original download paths needed substitutes in that second pass. Their plain and all four single-key exports matched the hashes from the first replay; the JSON identifies the substitute inputs. The native file WH_DOC_Demonette21.mdx for original40-37 became unavailable between passes. The first replay found no changed key on that pair. A second explicit serialization of its inactive keys could not be repeated.

The independent movement check follows every recipient vertex and attachment through every clip at the union of skeletal key times and nine samples per clip. Byte equality covers the serialized model, including attachments. Read-only inputs were compared using the compatible MDX writer in memory. 6 rows also needed direct encoding because the ordinary Save validation rejected an existing sequence interval. Each affected manifest row records that limitation. Results cover the sampled movement and complete serialized bytes.

[All pair paths, hashes and maximum displacements](<D:/Codex/xfer-engine-34/Step 1 replay/Pair measurements.json>)

### Detached item repair and revised tear gate

A loose item and every vertex influenced by its carrier or descendants move as one surface. If that surface shares a triangle with the remaining body, retain the plain placement. A rigid grip inherits rotation and translation separately when the donor scales its arm.

All four Skinks carry the whole pipe. Across all clips at 2 ms, every one of its 98 edges fits its own native maximum on every row. Other edges already outside their native bands with the switch off counted 167, 204, 148 and 247 on rows 95, 195, 493 and 841. The corrected counts are 167, 181, 148 and 224. No other overrun grew. All 86 plain exports and all nine owner-accepted step-1 exports matched their saved bytes, including Paladin and its fresh50-2 counterpart.

The owner set the tear threshold to more than 1.5 times both the native maximum and the plain maximum for the same edge. Fresh Shambler retains its accepted grade of 10 and its Death jump at 584 ms. Humanoid 175 and 443 use the owner's authorized replacement, the Warcraft III Bandit. Their old export hashes apply only to the missing original.

### Looping motion trial and staff measurements before editing

**Timers, pair 30.** A skinned extra driven by a changing global sequence keeps its own joint and timer. Holding the clip frame still and advancing only the global clock across its 333 ms period produced 14.245 units of wing travel, up from zero; body movement from the clock was zero. The independent visible-skin height check still missed the donor by as much as 0.908 standing height in Attack (limit 0.05). The trial is withdrawn. Keeping the joint does not change where the transplant sets the body.

**Staff, pair 12.** Following the authored ends of both items every 2 ms showed a fixed 23.587° seating error in Walk, Attack and Spell. The recipient shaft moves less than 0.000002° in the donor staff’s coordinate system. It follows the separate global staff carrier exactly, while the hand follows the recipient arm. The donor still holds the staff at 750 ms in Spell (5.3% of donor height); the recipient's own hand and staff skin separate by 35.4% near 760 ms. Its peak tip travel is 3.70% of visible native height per 2 ms, versus 2.20% for the donor. This identifies both a constant alignment error and a separate translation mismatch through the swing.

### Loose sword angle

A rigid item already seated on the donor’s blade-carrying hand turns about its grip to follow that blade. It requires exactly one detached item and one measured donor weapon on the same carrier. It leaves an uncertain reading alone. This alignment uses the existing detached seating. It does not recognize new items on its own.

On Paladin (34, also fresh50-2) the directed skin angle fell from 47° to 7.38° or less in Walk and Attack. Walk grip distance is 5.36% of native visible height (limit 9.2%). Those are the only two entries that changed in the 86-file sweep when added to the seated result. All 86 plain files and all twelve protected results matched byte for byte. Step-1-only outputs retain all nine accepted hashes.
