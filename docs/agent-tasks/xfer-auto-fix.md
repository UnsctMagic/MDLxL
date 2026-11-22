# XFER Transplant: Auto fix (step 1)

**Status:** step 1 built and verified, waiting for the owner's grades; local only. Branch `claude/xfer-auto-fix` (worktree `D:\Claude\MDLxL\.claude\worktrees\xfer-auto-fix`), cut from `codex/xfer-astra-r1` at `d831e3c7` (graded engine source `8c5f3c67`). Nothing is online.

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

## Not done

- The change list over the 1,263-pair replay (plan gate 3). The 34 graded pairs and the fresh 50 are swept.
- Steps 2 to 5 of the plan (Tinker's arms, looping-timer motion, shoulders, cloak and tail, weapon out of the body).
