# XFER toggles: one complete engine, every repair a switch, a suggested combo

Status: active. Checkpoint 1 is next (Codex).
Owner / consolidator: Codex builds; Claude Code reviews at every checkpoint. The owner relays.
Updated: 23 Nov 2026

## Goal and completion criteria

The owner, 23 Nov 2026:

> "If a fix introduces a regression in another model but fixes one model we dont throw it away."
> "Instead of showing me before and after - show me before and after but above after you give me checkboxes to click -
> Autofix, seamfix whatever - all the options that keep us gating in circles are now TOGGLES!!! NO MORE GATING REPAIRS."
> "We offer a complete engine, and the engine has a few options TO ADAPT!! it also AUTO-SUGGESTS based on our one million
> tests WHAT MIGHT BE THE BEST COMBO OF AUTO TOGGLES." "all the work that was done until now will NOT BE THROWN - it will be
> re-purposed." "I want XFER finished TODAY."

These choices are settled. The owner accepted Claude's picks on 23 Nov:

1. **Suggested toggles are ticked automatically.** The user can untick any of them.
2. **Clashing toggles:** ticking one unticks the toggles it clashes with.
3. **The same toggle row appears in two places:** in the Transfer window (Transplant) above the result view, and in the review sheet
   above the "after" view.
4. **The suggestion measures this pair on the spot (B).** The earlier tests only order the tries and give the first guess (A,
   optional, last).

Done today means all of the following:
- Every repair in the inventory below that can be recovered is a toggle.
- All toggles off gives exactly today's transplant, byte for byte.
- The suggester ticks a combo for the open pair.
- The Transfer window and the review sheet show the row.
- The owner has graded one sheet, and Claude has reviewed it.

Merging stays the owner's word ("merge").

## No gating: what still holds and what is gone

Gone: rejecting or reverting a repair because it changes or worsens another pair; "changed 9s and 10s must pass every check";
"the targeted warning must fall on 888 rows"; two-trial stops; the many-pairs rule. A repair that helps one pair and hurts
another becomes a toggle.

Still holds:
- **All toggles off = today's engine, byte for byte.** This keeps the base; it is not a gate on repairs.
- **No toggle may crash or throw** on the smoke set. A toggle that throws is fixed or left out with the error written down.
- **Each toggle is one key**, reads the two models (never a pair id or file name), and does only its own repair.
- **UI rules from AGENTS.md:**
  - Short functional names and a plain one-line tooltip, no flavour text.
  - Labels in en/es/ru/zh/fr/de.
  - Reuse the existing `xf-check` checkbox look; no new panel.
  - The camera stays where the user left it when a toggle rebuilds the result.
  - Live updates once per display frame.

## Revision and local state

- Worktree `D:\Codex\xfer-toggles`, branch `codex/xfer-toggles`, cut from `codex/xfer-look-fixes` at `26fb96f3`. That branch
  holds the whole XFER line: claude/transfer-xl rounds, Auto fix step 1, Codex step 2, and the look check.
- `node_modules` is a junction to `D:\Claude\MDLxL\node_modules`. Remove it as a link (`rmdir`), never recursively.
- `main` is 97 commits ahead of the base. Do not merge main until the owner says "merge".
- Local only. Commit after every checkpoint. Never push, open a PR, tag or post.

## Owners in the code

- Engine: `src/skeleton-transplant.js` (`transplantSkeleton`, options from `transferWindow.transplantOptions`); skin
  `src/transplant-skin.js`; props `src/transplant-props.js`.
- Toggle registry today: `src/transplant-autofix.js` `AUTO_FIX_KEYS` = hand, markers, detached, trunk, arms, chains;
  `autoFixOptions(value)` (`true` = all, an object = the keys set). **Extend this registry. Do not build a second mechanism.**
- Window: `app/Transfer.jsx` (Transplant aside: Sounds, Effects, the single `Auto fix` checkbox ~line 804; result view ~line 783).
- Review sheet: `app/TransferPicks.jsx` + `src/transfer-picks.js` (variants, grades, answers), started with
  `--transfer-picks=<cases.json>`.
- Look check (the suggester's judge): `scripts/xfer-look/check.mjs` `measurePair`, `verdict.mjs`, `thresholds.json`. It imports
  `node:fs`; the measuring core must move to a pure module under `src/` so the app can call it. The scripts keep using it.
- Saved data: `D:\Claude\xfer-look\` (888 sweep, graded measurements, owner grades `graded-n.json`), and
  `D:\Claude\xfer-look\diagnosis\DIAGNOSIS.md` (the seam fix rule).

## Inventory: every repair that becomes a toggle

Recover each one onto the current engine behind its own key. Commits are on this branch's history.

| # | Repair | Where it is | Notes |
| --- | --- | --- | --- |
| 1–6 | Auto fix hand, markers, detached, trunk, arms, chains | live in the engine | split the one checkbox into six toggles |
| 7 | Loose blade alignment around the grip | `371e489c`, withdrawn `559f3544` | |
| 8 | Route recognized grip branches through weapon/shield fitting | `7d3687b2`, reverted `ce33ff57` | |
| 9 | Geometry-based held-item and mirror recognition | `5a3cc5a6`, reverted `945b3737` | may clash with 1 (hand) |
| 10 | Surface-axis placement and second-hand shaft solving | `e70b8bd0`, reverted `3897d34c` | |
| 11 | Clip-aware extra motion and bounded socket translation | `bc4bce54`, reverted `31cdf164` | |
| 12 | Skin landmarks and capped rest turn | `5e03f3dd`, reverted `a02c977b` | |
| 13 | Hanging branches matched by skin and clip motion | `3045b648`, reverted `ce97b0e7` | may clash with 6 (chains) |
| 14 | Body-height scaling on vertical root motion | `197819d7`, reverted `947d52a0` | bob/shake in Walk |
| 15 | Shared skeletal driver for saddle material | `64ec5107`, reverted `446ad47d` | riders |
| 16 | Shared track-window correction | `b4825896`, reverted `4da3f9e4` | |
| 17 | Second shared correction (preserve authored motion) | `d04ce2b0`, reverted `a200dd72` | |
| 18 | Moving child carrier | reverted in `b16e2dc2` (read its diff) | |
| 19 | Single-pair grip trial | removed in `d5529677` | |
| 20 | Independent staff correction; looping-motion correction | notes `c799fd77`, `fd516469` | code only if it exists; else "not recoverable" |
| 21 | Keep own torso (stretch trial 1) | `D:\Codex\xfer-look-fixes\out\look-fixes\stretch-1.patch` | clashes with 22 and 23 |
| 22 | Sewn torso edge (stretch trial 2) | `...\stretch-2.patch` | |
| 23 | **Seam fix (new)** | rule in `DIAGNOSIS.md` §4 | the result joins only donor-joint pairs the donor's own skin joins |
| — | Cross-kind round 3 (riders, wings, tails) | branch `claude/xfer-crosskind`, 8 commits not here | Claude decides at the CP1 review; do not merge before |

The owner sees only toggles that change the open pair's result (see the suggester). A long list stays out of sight.

## Checkpoints

Codex stops at every checkpoint. Do not start the next one. Write the checkpoint report at the end of this file, commit, and
end the turn with exactly:

`CHECKPOINT <n> READY — D:\Codex\xfer-toggles\docs\agent-tasks\xfer-toggles.md`

The owner gives that line to Claude. Claude reviews and appends **CP<n> review** with `GO` or `FIX` plus a short list. When the
owner tells Codex "continue", Codex reads the latest review first. On `FIX`, do only the listed items, then report the same
checkpoint again.

**Budget and stop rule:**
- About 45 minutes of work per checkpoint.
- If one item fails twice, stop trying. Make it a toggle as it is, or mark it "not recovered" with the error. Then go on.
- Never run the full packaged suite, the full source suite, or a fresh 888-pair sweep unless a checkpoint below says so.
- Long runs go in the background at below-normal priority, at most 4 workers, on D:.

### CP1 · Inventory and names (no engine change yet)

For each inventory row, give:
- the key
- a proposed name of 1–3 words and a tooltip of at most one sentence
- the files it touches
- whether it applies cleanly to the current engine (dry run: `git cherry-pick --no-commit`, `git apply --check`)
- the toggles it clashes with (it touches the same decision)
- what it fixed and what it hurt when it was tried, one line from its note

Report: a table only. Review before any code.

### CP2 · Engine: all repairs behind keys

- Add each recovered repair to the registry as its own key. Keep `autoFix: true` meaning the six old keys, as today.
- Clash table in code: `TOGGLE_CLASHES`.
- Proof:
  - (a) All keys off is byte-identical to the base engine on the 138 rebuildable high grades
    (`out/look-fixes/high-inputs.json`) and the 59 low grades (`graded-n.json`, grade ≤ 3, with a native).
    Use the existing hash pattern in `out/look-fixes/high-gate.mjs`.
  - (b) **Smoke:** each key alone on 40 pairs (20 low, 20 high, mixed rigs; list the ids) builds without throwing, and writes a valid MDX.
- Report per key: pairs whose bytes changed, and errors. **No look-check judgement of keys here.**

### CP3 · Suggester

- Move the measuring core of the look check into `src/` (pure, no `fs`). The scripts import it, with the same numbers on 5 saved rows.
- `suggestToggles(model, donor, options)`:
  1. Build plain.
  2. Build each key alone.
  3. Hide keys whose bytes do not change.
  4. Score each build with the look check (score = number of reasons, then the sum of `value/limit` over the reasons).
  5. Keep the keys that lower the score.
  6. Build that combo, dropping clashes (keep the better-scoring key).
  7. If the combo scores worse than the best single key, suggest the single key.
  - Return `{ visible, suggested, scores }`.
- Speed: sample fewer moments than the sweep (at most 21 per clip, Stand/Walk/Attack/Spell kinds). Report seconds per pair
  on 5 pairs. The result shows the plain build first; the suggestion arrives in the background.
- Report: the 40 smoke pairs, with suggested keys and the score before and after. The owner's grade is in the table for context only.

### CP4 · Window, sheet, and the sheet itself (Claude reviews before the owner sees it)

- **Transfer window:** one row of checkboxes directly above the result view in Transplant, replacing the single `Auto fix`
  checkbox. Only the visible keys show. Suggested keys are ticked, with a small mark; tooltip: "Suggested for this pair."
  Ticking rebuilds the result and keeps the camera and time. Sounds, Effects and Keep stay in the aside.
- **Sheet** (`TransferPicks`): a new variant kind, `transplant`. It holds the recipient and donor files and is built live, with
  the same row above it.
  - Layout: Donor | Before (all off) | After (row; starts on the suggested combo).
  - The grade and comment save with the toggles the owner left ticked.
  - The look buttons (where to look, which clip) as now.
- **The sheet:** 20 pairs, listed with the reason each is in.
  - 10 recent low grades with the owner's comments (include cloth-01, 04, 05, 06, 07, 09).
  - 5 high grades, to see that the suggestion does not spoil them.
  - 5 pairs nobody has graded.
- **Build:**
  1. `pnpm run build`, package to `D:\Claude\MDLxL\TestBuilds\transfer-xl-35` with TEMP/TMP on D:.
  2. Named test model `TEST XFER TOGGLES 01.mdx`.
  3. Launcher `GRADE - XFER toggles 20.cmd` in `TestBuilds\_START HERE`.
  4. Open the packaged build hidden, click every toggle once in the window and in the sheet, and confirm nothing crashes.
- **Do not hand the sheet to the owner.** Stop at CHECKPOINT 4. Claude opens it first.

### CP5 · After the owner's grades (Claude reviews after the sheet)

- Read `answers.json`. Per pair: grade, comment, ticked toggles, suggested toggles.
- If the owner flips a toggle on a pair, that counts as a lesson: write it down.
- Fix only what the owner names (a crash, a toggle that does nothing, a wrong name). A new repair the owner asks for becomes
  a new toggle. Nothing is reverted for hurting another pair.
- Optional A: a small table of which toggles helped which kind of pair, used to order the tries and as the first guess. Only
  if time remains.

## After today

Claude deferred cross-kind round 3 (branch `claude/xfer-crosskind`) to its own follow-up. Its rider, wing and tail features stay on that branch.

The CP2 smoke fixtures with inherited zero-length global sequences are deferred. Recheck their original
recipients separately before including them in a future review.

- `xfer-engine-34/pair-05`, `xfer-engine-34/pair-09`, `xfer-engine-34/pair-11`, `xfer-engine-34/pair-17`, `xfer-grade-repairs/new-32`, `Auto fix cloth sheet/lich`.

## Checkpoint log

(Codex appends reports here; Claude appends reviews.)

### CP1 · Inventory and names

| # | Key | Name | Tooltip | Files | Dry run against `a48cb6be` | Proposed clashes | Previous result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `hand` | Weapon hand | Set automatic Mirror from the hands actually holding equipment. | `src/transplant-autofix.js`, `src/skeleton-transplant.js`, `app/Transfer.jsx` (Mirror choice) | Already live. | `heldGeometry` (automatic Mirror) | Ungor Bow used the correct hand and Lahmian's Walk grip gap fell from 19.1% to 3.0% of height. The hand repair introduced body tears on Skink rows 493 and 841. [Auto fix](xfer-auto-fix.md) |
| 2 | `markers` | Grip markers | Move misaligned grip and tip markers onto the actual weapon before fitting it. | `src/transplant-autofix.js`, `src/skeleton-transplant.js` | Already live. | `surfaceGrip` (weapon axis), `wristGrip` (grip anchor) | Luc's hammer angle fell from 160° to 2°. The Revenant control changed and later received 10/10 on the step-1 sheet. [Auto fix](xfer-auto-fix.md) |
| 3 | `detached` | Loose weapon | Seat a detached weapon's whole surface in the hand that holds it. | `src/transplant-autofix.js`, `src/skeleton-transplant.js`, `src/transplant-props.js` | Already live. | `heldGeometry` (detached carrier selection) | Paladin's Walk grip gap fell from 13.7% to 5.7% on average, and the whole-surface update kept all 98 pipe edges in range on four Skink rows. The earlier broader version also moved six already recognized items. [Auto fix](xfer-auto-fix.md) |
| 4 | `trunk` | Legless posture | Keep the recipient's posture when it has no usable trunk line and fewer than two legs. | `src/transplant-autofix.js`, `src/skeleton-transplant.js` | Already live. | `skinLandmarks` (trunk rest turn) | Dullahan's Walk lean fell from 71° to 27°. It was the sole changed row in the saved step-1 replay. [Auto fix](xfer-auto-fix.md) |
| 5 | `arms` | Main arms | Use the donor's primary hands when the recipient has one arm pair and both donor hands are clear. | `src/transplant-autofix.js`, `src/skeleton-transplant.js`, `src/anim-transfer.js` | Already live. | — | Tinker → Kel’Thuzad Walk arm-direction error fell from 62.57° to 11.75°. The other 85 saved exports matched. [Auto fix](xfer-auto-fix.md) |
| 6 | `chains` | Cloth motion | Transfer the donor garment's swing to supported cloth panels and articulated tails. | `src/transplant-autofix.js`, `src/skeleton-transplant.js`, `src/transplant-fabric.js`, `src/transplant-floor.js` | Already live. | `extraMotion`, `hangingChains` (driver for the same extra surface) | The Lich's four robe panels passed all 32 living-clip comparisons and the Skink tail went from static to 1.10 lengths of travel. The tail still dipped 0.62 unit in Decay Flesh. [Auto fix](xfer-auto-fix.md) |
| 7 | `looseAxis` | Loose blade angle | Turn a seated loose blade about its grip to follow the donor blade. | `src/skeleton-transplant.js`, `src/transplant-autofix.js`, `src/transplant-props.js`, `src/locales/{de,es,fr,ru,zh}.json`, `test/transplant-autofix.test.js`, `docs/agent-tasks/xfer-auto-fix.md` | `371e489c` conflicts in the registry, five locales, test and note. Engine hook and prop helper merge cleanly. | `surfaceGrip` (final weapon angle). Requires an already seated item. The Paladin proof used `detached` to seat it. A lone-key check can miss the repair on pairs that need that seating. | Paladin's blade error fell from 47° to at most 7.38°. Wendigo and Dreadlord rows used hand or effect geometry as the donor blade. [Auto fix](xfer-auto-fix.md) |
| 8 | `gripRouting` | Grip branch fit | Run weapon and shield fitting when an articulated branch carries a recognized grip. | `src/anim-transfer.js`, `src/held-item.js`, `src/skeleton-transplant.js`, `src/transplant-props.js` | `7d3687b2` conflicts in `src/skeleton-transplant.js` and `src/transplant-props.js`. Its sole source difference from `5a3cc5a6` is the `explicitGrip` condition, which isolates the routing rule. | `heldGeometry` (historical routing overlap). The routing rule should leave Mirror and carrier selection to their own keys. | Paladin's Walk grip gap maxed at 4% of height and Revenant was byte-identical. Fresh #37 staff-line error rose from 8° to 82°. The full trial also changed four Retarget fingerprints. [Astra round 1](xfer-astra-round1.md) |
| 9 | `heldGeometry` | Geometry grip | Use held skin motion to identify the weapon carrier and choose automatic Mirror. | `src/anim-transfer.js`, `src/held-item.js`, `src/skeleton-transplant.js`, `src/transplant-props.js` | `5a3cc5a6` conflicts in `src/skeleton-transplant.js` and `src/transplant-props.js`. The recognizer source is present in the commit. | `hand` (Mirror), `detached` (detached carrier), `gripRouting` (historical routing overlap) | All 739 Paladin blade vertices moved from pelvis to right hand and maximum gap fell from 33% to 4% of height. Revenant's previously parallel weapon became 88° off line. [Astra round 1](xfer-astra-round1.md) |
| 10 | `surfaceGrip` | Two-hand grip | Align the weapon to the donor's visible shaft and fit a second palm when the models have a second grip. | `src/skeleton-transplant.js`, `src/transplant-held-orientation.js` | `e70b8bd0` conflicts in `src/skeleton-transplant.js`. The orientation module adds cleanly. | `markers` (axis reference), `looseAxis` (final weapon angle), `wristGrip` (seating the same surface) | #12 averaged 2° in Attack - 1 and #45 improved from 51° to 5° in Walk. #45's second palm still missed the 5% shaft band in combat and Revenant gained 6° of Walk error. [Astra round 1](xfer-astra-round1.md) |
| 11 | `extraMotion` | Extra motion | Match extra skin by its active clips and limit shoulder socket travel. | `src/skeleton-transplant.js`, `src/transplant-extra-motion.js` | `bc4bce54` conflicts in `src/skeleton-transplant.js`. The motion module adds cleanly. | `chains`, `hangingChains` (driver for the same extra surface) | Jaw travel rose from 0 to 1.17 units and #25 Attack socket travel fell from 18.2% to 9.1% of height, still above its native 5.4%. Shoulder pads still followed the chest. [Astra round 1](xfer-astra-round1.md) |
| 12 | `skinLandmarks` | Skin landmarks | Fit the trunk and arm rest turns from skin landmarks and cap the correction across bound surfaces. | `src/skeleton-transplant.js`, `src/transplant-bind-landmarks.js` | `5e03f3dd` conflicts in `src/skeleton-transplant.js`. The landmark module adds cleanly. | `trunk` (trunk rest turn) | #17 Walk lean moved from 17.8° to 28.3° toward the donor's 40.7° and #34's lowest bind point rose from −30.3 to −10.0. Both still missed the target and #49's Walk elbow reached 84°. [Astra round 1](xfer-astra-round1.md) |
| 13 | `hangingChains` | Hanging chains | Match hanging branches by their skin position, clip motion and depth. | `src/skeleton-transplant.js`, `src/transplant-secondary.js` | `3045b648` conflicts in `src/skeleton-transplant.js`. The secondary-surface changes merge cleanly. | `chains`, `extraMotion` (driver for the same extra surface) | Eredar cloak travel passed the Attack and Spell checks. Faceless One Spell tail travel reached only 0.16 lengths against 0.225 and some skin still rode the root. [Astra round 1](xfer-astra-round1.md) |
| 14 | `rootHeight` | Vertical travel | Scale vertical root motion by the models' visible standing heights. | `src/skeleton-transplant.js` | `197819d7` cherry-picks cleanly. | — | #26 Attack Slam was 0.04 heights from donor clearance, within the 0.05 limit. #15 Spell and #44 Stand - 3 still missed by 0.23 and 0.10 heights, respectively. [Astra round 1](xfer-astra-round1.md) |
| 15 | `saddleDriver` | Saddle driver | Put seat material on the donor's saddle branch when both models are mounted. | `src/skeleton-transplant.js` | `64ec5107` cherry-picks cleanly. | `keepTorso`, `sewnTorso`, `seamFix` (weights where a saddle seam overlaps the torso) | #40 was byte-identical. The seat support selected by the trial owned none of the crucial saddle vertices and the Walk gap stayed at −20.31 units. [Astra round 1](xfer-astra-round1.md) |
| 16 | `trackWindow` | Smooth track windows | Remove stale interior keys inside a solver's correction window. | `src/transplant-floor.js` | `b4825896` cherry-picks cleanly. | `authoredMotion` (same track writer and keys) | Red Sizzer Stand spikes fell from three to zero and Walk reversals from 63 to two. Tuskarr gained two new visible-skin acceleration spikes. [Astra round 1](xfer-astra-round1.md) |
| 17 | `authoredMotion` | Keep authored keys | Apply the solver's correction to authored keys and keep their original motion between corrections. | `src/transplant-floor.js` | `d04ce2b0` cherry-picks cleanly. | `trackWindow` (same track writer and keys) | Red Sizzer kept zero Stand spikes and Tuskarr's Stand event returned to baseline. Red Sizzer Attack - 2 had a 48% higher local spike at 458 ms. [Astra round 1](xfer-astra-round1.md) |
| 18 | `movingCarrier` | Moving child bone | Use a sole animated, skinned child as the donor skin carrier for an unkeyed, unskinned helper. | `src/transplant-skin.js` | `git apply --check --reverse` on the `b16e2dc2` source diff passes. | — | #50 peak Attack - 3 head turn fell from 123.16° to the donor's 35.42°. U5 expected carrier 2 and got 11, losing the child's independent motion. [Astra round 1](xfer-astra-round1.md) |
| 19 | `wristGrip` | Wrist grip | Use the mapped wrist and keep the native item offset when a grip reference is a distant effect socket. | `src/transplant-props.js` | `git apply --check --reverse` on the `d5529677` source diff passes. | `markers` (grip anchor), `surfaceGrip` (seating the same surface) | Murloc #47 Stand gap fell from 38.780 to the native 9.593 units and ten clip checks improved. There were zero reverse crossings, and it activated on only that pair. [Astra round 1](xfer-astra-round1.md) |
| 20a | `staffGrip` | Independent staff | Keep the donor staff's direction while carrying its grip with the receiving hand. | `docs/agent-tasks/xfer-auto-fix.md` only in `c799fd77`. | **Not recoverable.** No source in the named commit, local XFER history or saved Step 2 material. No patch to check. | Undetermined without source. Candidate overlap is held-item seating. | Lahmian's Spell gap at 760 ms fell to 4.4%. The held-window maximum was still 9.47% and the shaft ends reversed by 178.08°. [Auto fix](xfer-auto-fix.md) |
| 20b | `loopingMotion` | Looping motion | Keep skin on its moving bone when the movement comes from a global timer. | `docs/agent-tasks/xfer-auto-fix.md` only in `fd516469`. | **Not recoverable.** No source in the named commit, local XFER history or saved Step 2 material. No patch to check. | Undetermined without source. Candidate overlap is extra skin driven by a global timer. | Paused-clip wing travel on Locust went from zero to 14.245 units across one timer period. Attack still missed donor height by as much as 0.908 standing heights. [Auto fix](xfer-auto-fix.md) |
| 21 | `keepTorso` | Keep own torso | Keep the recipient's torso weights when they already cover every mapped donor bend. | `src/skeleton-transplant.js` | `git apply --check` passes on `stretch-1.patch` with only its three scratch-file path headers retargeted to the engine file. | `saddleDriver`, `sewnTorso`, `seamFix` (torso weights) | Cleared 16 stretch warnings. Introduced a Wyvern Rider Attack curl and removed two expected Kurgan → Tauren blended vertices. [Look handoff](xfer-look-claude-handoff.md) |
| 22 | `sewnTorso` | Sewn torso edge | Keep a sewn torso surface together when two donor hinges would pull it apart. | `src/skeleton-transplant.js` | `git apply --check` passes on `stretch-2.patch`. | `saddleDriver`, `keepTorso`, `seamFix` (torso weights) | Only Felguard → Murloc cleared. The two changed high grades still flagged for inherited collapse, and the trial mostly missed chained or multi-level torsos. [Look handoff](xfer-look-claude-handoff.md) |
| 23 | `seamFix` | Seam fix | Join only joint combinations the donor's skin joins, reusing its weights or keeping a rigid piece on the nearer joint. | Planned `src/skeleton-transplant.js` and `src/transplant-skin.js` (skin assignment). | New rule in `D:\Claude\xfer-look\diagnosis\DIAGNOSIS.md` §4. No patch to check. | `saddleDriver`, `keepTorso`, `sewnTorso` (skin weights on overlapping seams) | Diagnosis found invented seams on all 91 stretch rows and estimated that fixing them could clear about 75. No trial, so gains and side effects remain unmeasured. |
| — | Deferred to Claude | Cross-kind fit | Fit rider, wing and tail motion using the donor's visible body parts. | `src/anim-transfer.js`, `src/skeleton-transplant.js`, `src/pose-ik.js`, `src/pose-recognition.js`, `test/anim-transfer.test.js`, `test/skeleton-transplant.test.js`, `test/helpers/fixtures.cjs` in the seven branch commits. | Individual dry-run conflicts: TP1/TP2, U2, CR1, WG3b and RR2 in source, WG3 and ST1 only in test files. Merge `63615a29` left for review. | Pending scope. Tail routing may overlap `chains` and `hangingChains`. Rider trunk fit and vertical travel merit a check against `saddleDriver` and `rootHeight`. | The branch tests target Rat/Dire Wolf tail, unnamed wings, totem lift, Knight/Spider poor-fit reporting, Dragonspawn back and rider lean, and Far Seer rider fall. WG3b corrects WG3's hidden Talon raven false positive. No fresh results on this branch. |

### CP1 review (Claude) · GO, with these changes for CP2

Checked: `c799fd77` and `fd516469` touch only the note, and the step-2 worktree has no stash or loose patch. 20a and 20b stay
"not recoverable" (rebuild them later as new toggles only if the owner asks). The inventory is complete for today.

1. **Plain names and tooltips.** The owner is not a programmer. A tooltip says what the user sees change, in one sentence, with no
   engine words ("solver", "carrier", "articulated", "unkeyed", "branch", "keys"). Use these, or plainer:

   | Key | Name | Tooltip |
   | --- | --- | --- |
   | gripRouting | Weapon on bones | Fits a weapon that hangs on its own bones into the hand. |
   | heldGeometry | Find held weapon | Finds which hand holds the weapon by how it moves, not by its name. |
   | extraMotion | Jaw and pads | Moves extra parts, like jaws and shoulder pads, in the animations where they move. |
   | skinLandmarks | Rest pose fit | Lines up the body's starting pose from the shape of its skin. |
   | hangingChains | Hanging parts | Matches capes, tails and chains by where they hang and how they swing. |
   | rootHeight | Jump height | Scales jumps and drops to this model's height. |
   | saddleDriver | Saddle | Moves the saddle with the mount's saddle. |
   | trackWindow | Smooth feet | Removes jitter left where the feet are kept on the ground. |
   | authoredMotion | Keep donor motion | Keeps the donor's own movement between the ground corrections. |
   | movingCarrier | Helper bone motion | Lets a moving bone carry the skin of a still helper bone above it. |
   | wristGrip | Wrist grip | Holds the weapon at the wrist when the model's grip point is far from the hand. |
   | sewnTorso | Torso seams | Keeps the torso skin together where two donor joints would pull it apart. |

   Keep the other names (Weapon hand, Grip markers, Loose weapon, Legless posture, Main arms, Cloth motion, Loose blade angle,
   Two-hand grip, Keep own torso, Seam fix) and make their tooltips plain in the same way.

2. **Clash groups (ticking one unticks the others in its group).** Only these are exclusive:
   - Mirror choice: hand · heldGeometry
   - Grip point: markers · wristGrip
   - Weapon angle: surfaceGrip · looseAxis
   - Extra and hanging parts: chains · hangingChains · extraMotion
   - Ground corrections: trackWindow · authoredMotion
   - Torso skin: keepTorso · sewnTorso · seamFix
   - Trunk rest turn: trunk · skinLandmarks

   Everything else stacks, applied in the engine's own order. Put the groups in `TOGGLE_CLASHES` and nothing else there.

3. **Needs.** looseAxis needs detached. Add `TOGGLE_NEEDS = { looseAxis: ['detached'] }`. Ticking looseAxis ticks detached. The
   smoke test and the suggester try looseAxis together with what it needs.

4. **Retarget stays identical.** gripRouting and heldGeometry touch `src/anim-transfer.js`, and the earlier trial changed four Retarget
   fingerprints. With every key off, Retarget output must be identical too. Add the focused `test/anim-transfer.test.js` to the
   CP2 proof, along with the byte check.

5. **seamFix is new code.** Build it in CP2 from `DIAGNOSIS.md` §4, where the share step (`jointsOf` → `trunkShare` / `splitJoints`)
   decides weights.
   - Collect the donor's own edge joint-pairs once per transplant.
   - When the share would put two neighbouring result vertices on a donor joint pair the donor never joins, give those vertices
     the donor's own blend for that pair.
   - If the donor has no blend for that pair, put the whole connected rigid piece on the nearer joint.
   - Proof in the report: on H500, H912, H227 and H993, the torn invented-seam edges fall. Use
     `D:\Claude\xfer-look\diagnosis\scripts\donorseam.mjs`; its classes are in `DIAGNOSIS.md`.
   - If seamFix is not working after two attempts, report what it does and go on. It still ships as a toggle.

6. **Cross-kind round 3** (`claude/xfer-crosskind`): left out today. Five of its commits conflict in source, and they are features,
   not repairs. Record it under "After today" in this note. Do not merge it.

7. **The window UI is CP4.** In CP2, do not touch `app/`, except to keep the existing `Auto fix` checkbox working with the six old
   keys.

Then do CP2 as written, with the 40-pair smoke set (list the ids), and stop.

### CP2 · Engine repairs and proof

The existing registry now has 22 keys, including all 15 recoverable historical repairs and the new seam fix. `autoFix: true` still selects the original six. `TOGGLE_CLASHES` contains the seven reviewed groups and `TOGGLE_NEEDS` seats a loose weapon before aligning its blade. `staffGrip` and `loopingMotion` remain **not recoverable**. The existing checkbox still uses the legacy Boolean. The reviewed English labels are in the registry.

#### All-off byte identity

- **138/138 high grades and 59/59 low grades** matched the starting engine at `ed35d2e8` by SHA-256 over complete serialized MDX. The replay used the `high-gate.mjs` document writer and the saved source manifests. Nine low-grade rows without a `native` field had their originals resolved from those manifests. Two absent high-grade inputs were outside the 138 rebuildable rows.
- The first run exposed a missing track option in the ground-correction call. After fixing it, the replay reused 45 matches and reran the other 152 rows.
- Legacy `autoFix: true` exports were byte-identical on **40/40** smoke pairs. The focused registry assertion failed on the baseline at the new `seamFix` key and passed on the candidate (**1 passed, 0 failed, 0 skipped**).

#### Retarget

- `node --test test/anim-transfer.test.js` passed **82 tests**, with 0 failed and 0 skipped. **32/32 Retarget MDX fingerprints** matched across eight recipient rigs and Stand, Walk, Attack, and Spell. Held geometry is read inside Transplant, and Retarget keeps its original rig reader.

#### 40-pair smoke set

Each key was evaluated against the plain build through the document writer. **880/880** outputs serialized, reopened, and passed `validateModel` with 0 errors. `looseAxis` was run with `detached` and changed the result beyond `detached` alone on `Fresh cloak and tail 20/cloth-01`, `xfer-engine-34/pair-34`.

The initial smoke set included six exports with inherited zero-duration global sequences. The final set replaces `xfer-engine-34/pair-09`, `xfer-engine-34/pair-17`, `xfer-engine-34/pair-05`, `xfer-engine-34/pair-11`, `xfer-grade-repairs/new-32`, `Auto fix cloth sheet/lich`. The initial pair-09 and pair-17 comparisons showed `arms` and `trunk` changing the respective target outputs without introducing additional validation errors.

| Low grade | High grade |
| --- | --- |
| `xfer-engine-34/pair-02` | `xfer-engine-34/pair-03` |
| `xfer-new-models-40/new-24` | `xfer-engine-34/pair-04` |
| `xfer-engine-34/pair-12` | `xfer-engine-34/pair-13` |
| `xfer-engine-34/pair-15` | `xfer-engine-34/pair-07` |
| `transplant-grade/grade-21` | `xfer-engine-34/pair-08` |
| `xfer-engine-34/pair-18` | `xfer-engine-34/pair-22` |
| `xfer-engine-34/pair-31` | `xfer-engine-34/pair-14` |
| `xfer-engine-34/pair-34` | `xfer-engine-34/pair-16` |
| `xfer-new-models-40/new-06` | `xfer-engine-34/pair-20` |
| `xfer-new-models-40/new-11` | `xfer-engine-34/pair-27` |
| `xfer-new-models-40/new-20` | `xfer-engine-34/pair-33` |
| `xfer-new-models-40/new-30` | `xfer-four-review/followup-16` |
| `Fresh cloak and tail 20/cloth-01` | `xfer-four-review/followup-17` |
| `Fresh cloak and tail 20/cloth-04` | `xfer-fresh-50/fresh-56` |
| `Fresh cloak and tail 20/cloth-05` | `xfer-fresh-50/fresh-59` |
| `Fresh cloak and tail 20/cloth-06` | `xfer-new-models-40/new-08` |
| `Fresh cloak and tail 20/cloth-07` | `xfer-pose-handles-review/pose-support-16` |
| `Fresh cloak and tail 20/cloth-09` | `transplant-grade-astra-round1/astra-grade-15` |
| `xfer-pose-handles-review/pose-support-02` | `xfer-fresh-50/sample-2-055` |
| `Auto fix step 2 sheet/humanoid-493` | `Fresh cloak and tail 20/cloth-02` |

| Key | Tested | MDX bytes changed | Errors |
| --- | ---: | ---: | ---: |
| `hand` | 40 | 3 | 0 |
| `markers` | 40 | 1 | 0 |
| `detached` | 40 | 3 | 0 |
| `trunk` | 40 | 0 | 0 |
| `arms` | 40 | 0 | 0 |
| `chains` | 40 | 4 | 0 |
| `looseAxis` | 40 | 3 | 0 |
| `gripRouting` | 40 | 3 | 0 |
| `heldGeometry` | 40 | 11 | 0 |
| `surfaceGrip` | 40 | 7 | 0 |
| `extraMotion` | 40 | 17 | 0 |
| `skinLandmarks` | 40 | 36 | 0 |
| `hangingChains` | 40 | 23 | 0 |
| `rootHeight` | 40 | 38 | 0 |
| `saddleDriver` | 40 | 0 | 0 |
| `trackWindow` | 40 | 4 | 0 |
| `authoredMotion` | 40 | 8 | 0 |
| `movingCarrier` | 40 | 1 | 0 |
| `wristGrip` | 40 | 0 | 0 |
| `keepTorso` | 40 | 17 | 0 |
| `sewnTorso` | 40 | 2 | 0 |
| `seamFix` | 40 | 35 | 0 |

#### Seam fix

The skin pass compares neighbouring weight groups with actual donor edges. It reuses donor blends where available and places an affected connected rigid piece on the nearer donor joint otherwise. Held and additive effect skin are outside this pass.

Measured with the existing `D:/Claude/xfer-look/diagnosis/scripts/donorseam.mjs` ruler against the baseline and `seamFix` alone. Invented totals combine rigid and mixed seams. Counts in other classes also moved, including more beyond-donor stretch on three pairs.

| Pair | Torn invented edges | Donor-like | Beyond donor |
| --- | ---: | ---: | ---: |
| H500 | 40 → 0 | 20 → 8 | 0 → 0 |
| H912 | 29 → 3 | 11 → 14 | 2 → 4 |
| H227 | 131 → 49 | 2 → 24 | 1 → 37 |
| H993 | 113 → 66 | 0 → 3 | 0 → 19 |

Verification covered engine output and the independent seam measures. The desktop checkbox and Warcraft III playback remain unexercised at this checkpoint.

### CP2 review (Claude) · GO

Checked independently on six sweep pairs that are not in the smoke set (H69, H214, H227, H500, H874, P25): with every key off, the
MDX is byte-identical to the `26fb96f3` engine, and every key alone builds without throwing. The registry, `TOGGLE_CLASHES`,
`TOGGLE_NEEDS` and the labels match the CP1 review.

Seam fix is accepted as a toggle. It clears H500 (40 → 0) and H912 (29 → 3). H227 and H993 are partial: invented-seam tears fall,
but some move to beyond-donor tears. The suggester decides per pair, which is the point.

For CP3:
1. **Score exactly as the contract says.** The look check's thresholds and the donor-like flags (the Gor head swell) stay as
   they are. The same donor stretch appears in every build of a pair, so it does not bias the choice.
2. **Visible keys:** rootHeight and skinLandmarks change almost every pair (38 and 36 of 40), so expect about 5–8 visible
   toggles per pair. That is fine. Order the row by the contract's inventory order, not by score.
3. **Speed:** report the seconds for "build every key alone + measure the visible ones" on 5 pairs, and how much the
   fewer-moments sampling saves.
   - For the sheet, compute the suggestion when the sheet is built and store it in `cases.json`, so the owner never waits.
   - In the window it runs in the background after the plain build shows.
4. **Report table** for the 40 smoke pairs: visible keys, suggested keys, score plain → suggested, owner grade (context only).
   Add one line on the pairs where the suggestion is "nothing", and why.
5. **Leave out of today:** the six smoke pairs that were swapped out because the recipient's own file has a zero-length global
   sequence. Note them for later.

Then stop at CHECKPOINT 3.

### CP3 · Toggle suggester

The same model-only checker now serves the scripts and the suggester. The suggester compares generated compatible MDX against the plain build and lists changed keys in inventory order. It scores each visible build by verdict reason count, then by the sum of value divided by limit. The best-scoring key wins each clash. The final combo is compared with the best single repair, including that repair’s required keys.

#### Checker parity

**5/5 saved rows** exactly matched the original full-sampling measurements, the numbers stored on disk, and the original verdicts. Rows were `xfer-engine-34/pair-34`, `xfer-fresh-50/fresh-56`, `xfer-new-models-40/new-20`, `xfer-pose-handles-review/pose-support-02`, `Fresh cloak and tail 20/cloth-06`. The existing threshold file and donor-like warnings are unchanged.

#### Background delivery and sheet preparation

- `node --test test/transplant-builder.test.js` passed **6 tests**, with 0 failed and 0 skipped. The new assertion failed on the previous client because it did not request suggestions.
- The browser worker bundled without a filesystem import. With Paladin in a real worker thread, the first reply matched the plain MDX and the second supplied its suggestion. Changing the pair cancels the outdated suggestion. A manual Mirror choice stays fixed.
- `node scripts/xfer-look/suggest-cases.mjs <cases.json> <output.json>` reads the first `variant.transplant` in each case. That record holds `recipient`, `donor`, and optional engine `options`. The script stores `case.suggestion` for the sheet to use at opening. The prepared Paladin case held the same result as the worker.

#### Sampling and timing

Stand, Walk, Attack, and Spell families use at most 21 moments per clip. Timings are wall seconds while the smoke replay used up to three workers. Build + fast check includes the plain build, every key trial and any candidate combo. The sweep column times only the full look check on the same built variants, with the same donor and native cache reuse.

| Pair | Build + fast check (s) | Fast look (s) | Full look (s) | Result moments, fast / full |
| --- | ---: | ---: | ---: | ---: |
| `xfer-engine-34/pair-34` | 15.43 | 3.00 | 6.37 | 945 / 2880 |
| `xfer-new-models-40/new-20` | 4.51 | 0.29 | 0.95 | 945 / 3595 |
| `Fresh cloak and tail 20/cloth-01` | 33.30 | 1.21 | 4.03 | 1512 / 6344 |
| `Fresh cloak and tail 20/cloth-06` | 20.42 | 0.27 | 0.62 | 420 / 1460 |
| `xfer-pose-handles-review/pose-support-02` | 64.24 | 0.89 | 3.24 | 945 / 4210 |

Across these five pairs, fast sampling used **74.2% fewer result moments** and saved **62.7% of look-check time** (15.21 s → 5.67 s). Building candidates still accounted for most of the time.

#### 40 smoke pairs

**40/40** returned a result with no exceptions. 11/40 had a suggested repair. Visible keys ranged from 0 to 10 with a median of 5. Score cells show reason count / summed ratio, with ratios rounded here for display. Owner grades are context only.

| Pair | Owner grade | Visible keys | Suggested keys | Plain → suggested score |
| --- | ---: | --- | --- | --- |
| `xfer-engine-34/pair-02` | 0 | `extraMotion`, `skinLandmarks`, `hangingChains`, `rootHeight`, `keepTorso`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-new-models-40/new-24` | 3 | `chains`, `heldGeometry`, `skinLandmarks`, `hangingChains`, `rootHeight`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-12` | 0 | `hand`, `heldGeometry`, `surfaceGrip`, `extraMotion`, `skinLandmarks`, `hangingChains`, `rootHeight`, `keepTorso`, `seamFix` | `hand`, `skinLandmarks` | 1 / 2.150 → 0 / 0.000 |
| `xfer-engine-34/pair-15` | 0 | `hand`, `heldGeometry`, `surfaceGrip`, `skinLandmarks`, `hangingChains`, `rootHeight`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `transplant-grade/grade-21` | 3 | `extraMotion`, `skinLandmarks`, `hangingChains`, `rootHeight`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-18` | 0 | `markers`, `heldGeometry`, `surfaceGrip`, `extraMotion`, `skinLandmarks`, `rootHeight`, `keepTorso`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-31` | 0 | `extraMotion`, `skinLandmarks`, `rootHeight`, `keepTorso`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-34` | 0 | `detached`, `looseAxis`, `heldGeometry`, `skinLandmarks`, `hangingChains`, `rootHeight`, `keepTorso`, `seamFix` | — | 1 / 1.087 → 1 / 1.087 |
| `xfer-new-models-40/new-06` | 3 | `skinLandmarks`, `rootHeight`, `trackWindow`, `authoredMotion`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-new-models-40/new-11` | 2 | `gripRouting`, `surfaceGrip`, `extraMotion`, `skinLandmarks`, `hangingChains`, `rootHeight`, `seamFix` | `gripRouting`, `hangingChains` | 1 / 1.086 → 0 / 0.000 |
| `xfer-new-models-40/new-20` | 1 | `skinLandmarks`, `hangingChains`, `rootHeight`, `seamFix` | `seamFix` | 3 / 5.576 → 3 / 4.195 |
| `xfer-new-models-40/new-30` | 3 | `extraMotion`, `skinLandmarks`, `rootHeight`, `trackWindow`, `authoredMotion`, `seamFix` | `skinLandmarks`, `seamFix` | 1 / 1.342 → 1 / 1.289 |
| `Fresh cloak and tail 20/cloth-01` | 0 | `detached`, `looseAxis`, `skinLandmarks`, `hangingChains`, `rootHeight`, `seamFix` | `detached`, `looseAxis`, `skinLandmarks` | 1 / 1.922 → 1 / 1.239 |
| `Fresh cloak and tail 20/cloth-04` | 0 | `extraMotion`, `skinLandmarks`, `hangingChains`, `rootHeight`, `authoredMotion`, `keepTorso`, `seamFix` | `skinLandmarks` | 1 / 1.443 → 1 / 1.034 |
| `Fresh cloak and tail 20/cloth-05` | 0 | `chains`, `heldGeometry`, `skinLandmarks`, `hangingChains`, `rootHeight`, `authoredMotion`, `keepTorso`, `seamFix` | `rootHeight`, `seamFix` | 2 / 2.555 → 2 / 2.133 |
| `Fresh cloak and tail 20/cloth-06` | 0 | `skinLandmarks`, `hangingChains`, `rootHeight`, `seamFix` | — | 2 / 2.502 → 2 / 2.502 |
| `Fresh cloak and tail 20/cloth-07` | 0 | `skinLandmarks`, `hangingChains`, `rootHeight`, `trackWindow`, `authoredMotion`, `seamFix` | `skinLandmarks`, `rootHeight`, `seamFix` | 1 / 1.055 → 0 / 0.000 |
| `Fresh cloak and tail 20/cloth-09` | 0 | `extraMotion`, `skinLandmarks`, `hangingChains`, `rootHeight`, `seamFix` | `extraMotion`, `skinLandmarks`, `seamFix` | 1 / 1.032 → 1 / 1.012 |
| `xfer-pose-handles-review/pose-support-02` | 0 | `skinLandmarks`, `hangingChains`, `rootHeight`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `Auto fix step 2 sheet/humanoid-493` | 2 | `hand`, `detached`, `chains`, `looseAxis`, `skinLandmarks`, `hangingChains`, `rootHeight`, `keepTorso`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-03` | 10 | `skinLandmarks`, `rootHeight` | — | 2 / 2.324 → 2 / 2.324 |
| `xfer-engine-34/pair-04` | 10 | `extraMotion`, `skinLandmarks`, `hangingChains`, `rootHeight`, `authoredMotion`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-13` | 9 | `extraMotion`, `skinLandmarks`, `hangingChains`, `rootHeight`, `keepTorso`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-07` | 10 | `surfaceGrip`, `skinLandmarks`, `rootHeight`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-08` | 10 | `skinLandmarks`, `hangingChains`, `rootHeight`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-22` | 10 | `heldGeometry`, `skinLandmarks`, `rootHeight`, `keepTorso`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-14` | 10 | `skinLandmarks`, `rootHeight` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-16` | 10 | `skinLandmarks`, `rootHeight`, `movingCarrier`, `keepTorso`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-20` | 9 | `gripRouting`, `surfaceGrip`, `extraMotion`, `skinLandmarks`, `hangingChains`, `rootHeight`, `keepTorso`, `sewnTorso`, `seamFix` | `skinLandmarks`, `keepTorso` | 2 / 2.939 → 1 / 1.771 |
| `xfer-engine-34/pair-27` | 10 | — | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-33` | 9 | `skinLandmarks`, `hangingChains`, `rootHeight`, `keepTorso`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-four-review/followup-16` | 10 | `extraMotion`, `skinLandmarks`, `rootHeight`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-four-review/followup-17` | 9 | `heldGeometry`, `extraMotion`, `rootHeight`, `authoredMotion`, `seamFix` | `seamFix` | 2 / 2.068 → 2 / 2.023 |
| `xfer-fresh-50/fresh-56` | 9 | `heldGeometry`, `extraMotion`, `skinLandmarks`, `rootHeight`, `keepTorso`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-fresh-50/fresh-59` | 10 | `skinLandmarks`, `rootHeight`, `keepTorso`, `sewnTorso` | — | 1 / 1.057 → 1 / 1.057 |
| `xfer-new-models-40/new-08` | 10 | `rootHeight`, `seamFix` | — | 1 / 1.032 → 1 / 1.032 |
| `xfer-pose-handles-review/pose-support-16` | 10 | `hangingChains` | — | 0 / 0.000 → 0 / 0.000 |
| `transplant-grade-astra-round1/astra-grade-15` | 9 | `skinLandmarks`, `rootHeight`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-fresh-50/sample-2-055` | 10 | `gripRouting`, `heldGeometry`, `surfaceGrip`, `extraMotion`, `skinLandmarks`, `rootHeight`, `keepTorso`, `seamFix` | — | 0 / 0.000 → 0 / 0.000 |
| `Fresh cloak and tail 20/cloth-02` | 10 | `chains`, `heldGeometry`, `extraMotion`, `skinLandmarks`, `hangingChains`, `rootHeight`, `trackWindow`, `authoredMotion`, `keepTorso`, `seamFix` | — | 1 / 3.429 → 1 / 3.429 |

- The plain score had zero reasons on `xfer-engine-34/pair-02`, `xfer-new-models-40/new-24`, `xfer-engine-34/pair-15`, `transplant-grade/grade-21`, `xfer-engine-34/pair-18`, `xfer-engine-34/pair-31`, `xfer-new-models-40/new-06`, `xfer-pose-handles-review/pose-support-02`, `Auto fix step 2 sheet/humanoid-493`, `xfer-engine-34/pair-04`, `xfer-engine-34/pair-13`, `xfer-engine-34/pair-07`, `xfer-engine-34/pair-08`, `xfer-engine-34/pair-22`, `xfer-engine-34/pair-14`, `xfer-engine-34/pair-16`, `xfer-engine-34/pair-27`, `xfer-engine-34/pair-33`, `xfer-four-review/followup-16`, `xfer-fresh-50/fresh-56`, `xfer-pose-handles-review/pose-support-16`, `transplant-grade-astra-round1/astra-grade-15`, `xfer-fresh-50/sample-2-055`.
- No changed build improved the plain score on `xfer-engine-34/pair-34`, `Fresh cloak and tail 20/cloth-06`, `xfer-engine-34/pair-03`, `xfer-fresh-50/fresh-59`, `xfer-new-models-40/new-08`, `Fresh cloak and tail 20/cloth-02`.

The desktop row, packaged clicks, and owner review remain at their later checkpoints.

### CP3 review (Claude) · GO, with one rule change done first in CP4

Checked:
- `src/xfer-suggest-toggles.js` follows the contract.
- Checker parity is exact on 5 rows.
- The worker shows the plain build first, and a changed pair cancels the stale suggestion.
- No filesystem import reaches the app.

**Problem:** the suggestion is empty on 29 of 40 pairs. On 23 of them the look check already scores the plain build 0. That
covers most of the owner's zeros: pair-15 bow not switched, pair-18 weapon angle, pair-34 weapon floating, pair-31 arms,
humanoid-493 cloak to tail, pair-02 cloak. The check cannot see those faults; we knew it caught only 37 of 59 bad results. On the sheet,
"after" would equal "before" for half the low grades, and the owner would see nothing happen.

**Rule change (first thing in CP4, in `suggestToggles`):**
1. **Targeted repairs** act only where their own fault test fires. If such a key changes the result and does not make the
   score worse, it is suggested. Add `TARGETED_KEYS` with a one-line comment: these are the keys that changed at most 10 of
   the 40 smoke pairs: hand, markers, detached, trunk, arms, chains, looseAxis, gripRouting, surfaceGrip, saddleDriver,
   trackWindow, authoredMotion, movingCarrier, wristGrip, sewnTorso. The six original Auto fix keys are in this set; the owner kept all
   six on 22 Nov.
2. **Broad repairs** (skinLandmarks, rootHeight, seamFix, keepTorso, extraMotion, hangingChains, heldGeometry) are suggested
   only when they lower the score, as now.
3. **Clashes:** the lower score wins. On a tie, an original Auto fix key wins, then inventory order.
4. **Keep the combo check.** If the combo scores worse than the plain build, drop the broad keys from it first. Never drop a
   targeted key.
5. **Proof:** rerun the 40-pair table with only the "suggested" column and the score. Expected:
   - pair-15 gets `hand`
   - pair-34 gets `detached`, `looseAxis`
   - humanoid-493 gets `hand` / `detached` / `chains` as they fire
   - pair-18 gets `markers`

   If any of these does not happen, say why in one line.

Timing: up to 64 s per pair in the window is acceptable in the background. While it runs, show a short "Suggesting…" note in
the row, and nothing else. The sheet uses the stored suggestion.

Then do CP4 as written. Stop before the owner sees anything.

### CP4 report (Codex)

#### CP3 review replay

Targeted repairs now qualify on ties. Broad repairs still need a lower score. Exclusions prefer the lower score, then the original six repairs, then inventory order. If the combo scores worse than plain, it is rebuilt without the broad repairs. Prior grades do not enter the decision.

All 40 rows ran. The engine suggested a repair on 22 rows. Suggested scores improved on 11 and tied on 29. Score is reason count / summed value-to-limit ratio.

| Pair | Suggested | Plain → suggested score |
|---|---|---:|
| `xfer-engine-34/pair-02` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-new-models-40/new-24` | `chains` | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-12` | `hand`, `skinLandmarks` | 1 / 2.150 → 0 / 0.000 |
| `xfer-engine-34/pair-15` | `hand`, `surfaceGrip` | 0 / 0.000 → 0 / 0.000 |
| `transplant-grade/grade-21` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-18` | `markers`, `surfaceGrip` | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-31` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-34` | — | 1 / 1.087 → 1 / 1.087 |
| `xfer-new-models-40/new-06` | `trackWindow` | 0 / 0.000 → 0 / 0.000 |
| `xfer-new-models-40/new-11` | `gripRouting`, `surfaceGrip`, `hangingChains` | 1 / 1.086 → 0 / 0.000 |
| `xfer-new-models-40/new-20` | `seamFix` | 3 / 5.576 → 3 / 4.195 |
| `xfer-new-models-40/new-30` | `skinLandmarks`, `trackWindow`, `seamFix` | 1 / 1.342 → 1 / 1.289 |
| `Fresh cloak and tail 20/cloth-01` | `detached`, `looseAxis`, `skinLandmarks` | 1 / 1.922 → 1 / 1.239 |
| `Fresh cloak and tail 20/cloth-04` | `skinLandmarks`, `hangingChains`, `rootHeight`, `authoredMotion`, `keepTorso` | 1 / 1.443 → 1 / 1.226 |
| `Fresh cloak and tail 20/cloth-05` | `rootHeight`, `authoredMotion`, `seamFix` | 2 / 2.555 → 2 / 2.133 |
| `Fresh cloak and tail 20/cloth-06` | — | 2 / 2.502 → 2 / 2.502 |
| `Fresh cloak and tail 20/cloth-07` | `skinLandmarks`, `rootHeight`, `trackWindow`, `seamFix` | 1 / 1.055 → 0 / 0.000 |
| `Fresh cloak and tail 20/cloth-09` | `extraMotion`, `skinLandmarks`, `seamFix` | 1 / 1.032 → 1 / 1.012 |
| `xfer-pose-handles-review/pose-support-02` | — | 0 / 0.000 → 0 / 0.000 |
| `Auto fix step 2 sheet/humanoid-493` | `hand`, `detached`, `chains`, `looseAxis` | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-03` | — | 2 / 2.324 → 2 / 2.324 |
| `xfer-engine-34/pair-04` | `authoredMotion` | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-13` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-07` | `surfaceGrip` | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-08` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-22` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-14` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-16` | `movingCarrier` | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-20` | `gripRouting`, `surfaceGrip`, `skinLandmarks`, `keepTorso` | 2 / 2.939 → 1 / 1.771 |
| `xfer-engine-34/pair-27` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-engine-34/pair-33` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-four-review/followup-16` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-four-review/followup-17` | `authoredMotion`, `seamFix` | 2 / 2.068 → 2 / 2.023 |
| `xfer-fresh-50/fresh-56` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-fresh-50/fresh-59` | `sewnTorso` | 1 / 1.057 → 1 / 1.057 |
| `xfer-new-models-40/new-08` | — | 1 / 1.032 → 1 / 1.032 |
| `xfer-pose-handles-review/pose-support-16` | — | 0 / 0.000 → 0 / 0.000 |
| `transplant-grade-astra-round1/astra-grade-15` | — | 0 / 0.000 → 0 / 0.000 |
| `xfer-fresh-50/sample-2-055` | `gripRouting` | 0 / 0.000 → 0 / 0.000 |
| `Fresh cloak and tail 20/cloth-02` | `trackWindow` | 1 / 3.429 → 1 / 3.429 |

- Paladin `pair-34` shows both `detached` and `looseAxis`. Each kept one reason and raised its ratio, from 1.087 plain to 1.212 and 1.338 respectively, so neither was suggested.
- The background Node replay took a median 20.7 s per pair. The slowest was `Fresh cloak and tail 20/cloth-02` at 160.7 s under parallel load. The sheet reads stored suggestions.

#### Review sheet

| Case | Donor → recipient | Prior grade | Reason |
|---|---|---:|---|
| `pair-34` | Knightess → Unsanctioned Paladin | 0 | Separate sword floating away from the hand. |
| `pair-15` | Bretonnian Archer → Ungor Bow | 0 | Bow held in the quiver hand. |
| `pair-18` | Forest Troll Pillager → Luc Valonforth | 0 | Hammer angle and grip. |
| `humanoid-493` | Human Mage → Blowpipe Skink | 2 | Blowpipe and the donor cloak on the Skink tail. |
| `cloth-01` | Elven Executioner → Zweihander Knight | 0 | Cloth and weapon motion on the Zweihander Knight. |
| `cloth-04` | Gryphon Rider → Hawkstrider Knight | 0 | Rider and mount motion during the swing. |
| `cloth-05` | Dwarf Demon Huntress → Bonelord | 0 | Bonelord cloak and shoulder motion. |
| `cloth-06` | Raccoon → Giant Arctic Rat | 0 | Arctic Rat front legs in motion. |
| `cloth-07` | Silverpaw Marksman → Magnataur | 0 | Magnataur cloth and underbody motion. |
| `cloth-09` | Thanatos Serpent → Ironclaw Beast | 0 | Ironclaw tail and trunk motion. |
| `pair-03` | Skink Worker → Banisher | 10 | High-grade humanoid control. |
| `new-08` | Azure Dragon Whelp → Faerie Dragon | 10 | High-grade winged control. |
| `fresh-56` | Norse Elementalist → Witch | 9 | High-grade staff control. |
| `followup-17` | Grizzly Bear → Tauren | 9 | High-grade four-footed control. |
| `pair-27` | Limb Snapper → Toxic Snapper | 10 | High-grade reptile control. |
| `humanoid-500` | Graveguard → Spanish Swordsman | Ungraded | Torso seam across several donor levels. |
| `humanoid-912` | Felguard → Murloc | Ungraded | Two torso hinges on a small recipient. |
| `humanoid-227` | Arthas → Bretonnian Pikeman | Ungraded | Linked spine stretch in Walk. |
| `humanoid-993` | Chaos Wolf Rider → Goblin Alchemist | Ungraded | Rider and mount seam in Attack. |
| `panel-36` | Frost Wyrm → Green Dragon | Ungraded | Winged control with a flying donor. |

The ten low-grade cases display the original comments. The five ungraded cases came from saved sweep inputs. Their exact recipient/donor MDX hash pairs were checked against the available historical grade inputs. Five historical input entries could not be matched to a local model file. No new sweep was run.

#### Package and verification

- `D:\Claude\MDLxL\TestBuilds\transfer-xl-35` contains the offline Electron 40.8.0 package, `cases.json` and an empty `answers.json`. The package verified 1,680 runtime and asset files and preserved 55 locale files.
- Claude can open `D:\Claude\MDLxL\TestBuilds\_START HERE\GRADE - XFER toggles 20.cmd`. It opens `D:\Claude\MDLxL\TestBuilds\test-models\XFER Toggles\TEST XFER TOGGLES 01.mdx` and the review sheet. The standalone model and its textures match the source files by SHA-256.
- The three focused source files passed 46/46 tests. The new live-sheet parser test fails on the CP3 revision because it cannot read a transplant variant. The hidden Luc regression passed all three checks, including applying and undoing a repair.
- In the final package, the hidden Transfer run clicked 21 distinct repairs over 10 case openings, including the supplemental fixtures. The hidden sheet opened all 20 review cases and four disposable cases, and clicked 21 distinct repairs. It saved grades, the test comment and both repair lists to disposable answers. Real mouse drag rotated both views. A paused render kept its exact playback frame and camera through repair rebuilds. The tests also exercised the no-change row, background suggestion status, exclusions, the loose blade dependency and the existing Look controls.
- The window row and the sheet row each stayed on one line. The window frame check was repeated with the Pause state confirmed after an initial assertion sampled live playback.
- `saddleDriver` is the only key without a packaged click in either view. It changed none of the 40 smoke pairs, and the historical mounted #40 comparison also remained byte-identical. There is no eligible checkbox to click on these fixtures. The packaged supplemental `arms` and `trunk` cases retain their known input global-sequence faults and were used for UI coverage only.
- The transplant engine source stayed at its CP2 revision. CP4 reused the CP2 all-off byte comparison. No full suite, fresh 888-pair sweep or Warcraft III run was performed. The local-only package and sheet are for Claude’s review. Owner grading is pending.

### CP4 review (Claude) · GO; two fixes made by Claude, sheet ready for the owner

The owner was asleep and said "streamline", so Claude made the two small fixes itself instead of a round trip. Everything below
was checked on the packaged build on the hidden desktop (`out/claude-cp4/look.cjs`, screenshots in `out/claude-cp4/`).

1. **pair-34 (Knightess → Paladin, "WEAPON FLOATING") showed After identical to Before.** detached and looseAxis kept the
   same single look-check reason, but its ratio rose, so the tie rule rejected them. Change in `suggestToggles`: a targeted repair
   now qualifies unless it **adds a reason**; the ratio no longer blocks it. Now pair-34 suggests `detached, looseAxis`: the sword
   sits in the hand at the donor's angle. cloth-05 also gains `chains`. The other 18 sheet cases are unchanged.
2. **The repair row scrolled sideways** (pair-15: "Hanging parts" was cut off behind a scrollbar). `.xf-repairs` now wraps onto a
   second line instead of scrolling.

After the fixes:
- Focused tests: transplant-builder, transfer-picks and transplant-autofix, 56/56 pass.
- `pnpm run build`, then packaged again into `TestBuilds\transfer-xl-35`.
- Suggestions regenerated with `suggest-cases.mjs` into its `cases.json`; `answers.json` is still empty.
- Hidden re-check of pair-34 and pair-15: no page errors, suggested boxes ticked, row on two lines.

Seen but left for the owner to judge on the sheet: on pair-15, Two-hand grip turns the Ungor's bow into a straight line seen
edge-on. It is suggested, and the owner can untick it.

**Next (CP5):** the owner grades `TestBuilds\_START HERE\GRADE - XFER toggles 20.cmd`. Then Codex does CP5 as written, and Claude reviews it.

### CP4b review (Claude) · FIX before the owner sees the sheet

Claude rendered all 20 sheet cases on the packaged `transfer-xl-35`, hidden, with the default view and the first Look moment.
Contact sheets: `out/claude-cp4/sheet-low.png`, `out/claude-cp4/sheet-rest.png`; single shots are `out/claude-cp4/<id>.png` and `<id>-look.png`.
All 20 load with 0 page errors and the suggested boxes ticked. Fix only these:

1. **Gray, untextured models.** humanoid-493: the Blowpipe Skink recipient is gray in Before and After. pair-03: the Skink Worker
   donor is gray. Find out why the textures are not found, and make every view of all 20 cases textured. That could mean texture
   lookup for `transplant` variants and file variants, or copies of the models with their textures beside them. Prove it with one
   screenshot per case, three views each, saved in `out/cp4b/`. Use the hidden runner (`out/claude-cp4/look.cjs` is a working example).
2. **Look framing is inside the body.** On humanoid-912, humanoid-227 and followup-17 the first Look puts the camera inside the
   mesh, and the view is an unreadable smear. A Look must show the whole marked body part with a margin around it, like the Looks on the low-grade
   cases. Check every Look of all 20 cases in the same screenshots. Fix the framing, or the look entries in `cases.json`,
   whichever owns the fault.
3. Rebuild and package into `TestBuilds\transfer-xl-35`. Keep `cases.json` suggestions; regenerate them only if the engine changed.
   Keep `answers.json` empty. Run TEMP/TMP on D:. `electron/ffmpeg` binaries are already present in the worktree.

Do not change the suggester rules or any repair. Then stop with `CHECKPOINT 4b READY — <this file>`.

### CP4b report (Codex)

- The Skink source models referenced `skink.blp` and `skink_worker.blp`, but the BLPs were stored in the separate LowPolyWorks texture tree. The 20-case check also found the Witch's legacy effect missing `Textures\Clouds8x8.blp`. The sheet now opens byte-identical copies of those three MDXs with their original BLPs under `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\fixtures`. Only those model path references changed in `cases.json`. All suggestions and Look entries compare equal to the CP4 manifest.
- Look now frames the visible, non-additive skin near the markers across the selected clip window. This gives unweighted torso pivots enough context and keeps distant geometry from setting the zoom. The original package reproduced the three close-ups on `followup-17`, `humanoid-912` and `humanoid-227`. Their first Look on the new package shows the marked part with visible margin in all three panes. Actual mouse drag still rotates the view.
- Ran `pnpm run build` and repackaged `D:\Claude\MDLxL\TestBuilds\transfer-xl-35` offline with TEMP/TMP on D:. The hidden packaged run opened all 20 cases, checked the saved suggestions and clicked all 41 Looks. The 183 captured panes had zero unresolved textures or texture decode errors and the run had zero page errors. The renderer still reports its existing notice for external-model and Popcorn effects. Test grades were written to a disposable answer file. The owner's `answers.json` remains empty.
- [Screenshot proof](../../out/cp4b/) contains 20 PNGs named by case ID. Each stacks the default Donor / Before / After view with the same three panes for every Look. The [verification record](../../out/cp4b/verification.json) records the pane checks. The transplant engine, repairs and suggester stayed at the reviewed revision. The package and commit are local and ready for Claude's review.

### CP4b review (Claude) · GO, the sheet is ready for the owner

Checked Codex's `out/cp4b/` proofs for humanoid-493, pair-03, humanoid-912, followup-17 and humanoid-227. The Skinks are textured.
Every Look shows the marked part whole, with a margin. `answers.json` is empty, and the launcher opens `TEST XFER TOGGLES 01.mdx` with the
sheet. Codex: wait for the owner's grades. CP5 starts only when the owner says the sheet is graded.

### Owner's grades on the 20-pair sheet (23 Nov, ~18:00) and CP5 instructions (Claude)

The owner graded all 20 (`TestBuilds\transfer-xl-35\answers.json`). The owner's words after grading: "most times seamfix was used it made things
worse".

- **Zeros that rose:**
  - pair-34 0 → 10, pair-15 0 → 10, pair-18 0 → 10, all with the suggested toggles unchanged.
  - humanoid-493 2 → 8, with looseAxis unticked.
  - cloth-05 0 → 8, cloth-09 0 → 7.
  - cloth-01 0 → 7: "even with all fixes - i cannot get a weapon in his hand, it is not being held (its still better)".
  - cloth-06 0 → 5, nothing suggested.
- **Still 0:**
  - cloth-04 Gryphon Rider → Hawkstrider Knight: "rider collapses inside body, wings dont flap". He unticked hangingChains.
  - cloth-07 Silverpaw Marksman → Magnataur: "the whole unit has come apart and is warped and disfigure". He unticked rootHeight,
    trackWindow and seamFix, and ticked authoredMotion.
- **Controls held:** pair-03 10, pair-27 9, new-08 9, fresh-56 8, followup-17 8, panel-36 10, humanoid-912 9, humanoid-500/227/993 8.
- **Seam fix:** suggested on 7 pairs, unticked on 5 (followup-17 "seam fix RUINS the unit", humanoid-500 "makes it worse",
  humanoid-227 "made it worse", humanoid-993 "failed", cloth-07). Kept on 2 (cloth-05, cloth-09).

CP5, in this order. Stop at CHECKPOINT 5.
1. **Seam fix is never auto-suggested.** It stays in the row as a toggle; nothing is removed. In `suggestToggles`, exclude `seamFix`
   from candidates, with a one-line comment quoting the owner.
2. **Lessons table** in this note: per pair, suggested vs kept vs added, grade, comment. One line per toggle the owner flipped.
   Also add hangingChains (unticked on cloth-04), rootHeight and trackWindow (unticked on cloth-07), and looseAxis (unticked on
   humanoid-493) as observations. Do not change their rules on one pair each.
3. **Diagnose the two remaining zeros and cloth-01, about 30 minutes each, measured, no guessing.** For each, say:
   - which part of the engine (or which ticked toggle) causes what the owner describes;
   - whether an existing toggle fixes it.

   If none does, build a narrowly scoped new repair **as a new toggle** (no gating) only when the cause is clear. Otherwise
   write the cause and stop. The three cases:
   - cloth-04: the rider sinks into the mount's body, and the Hawkstrider's wings don't flap like the Gryphon's.
   - cloth-07: the Magnataur comes apart and warps. Check which ticked toggles do it, and how it looks with all toggles off.
   - cloth-01: the Zweihander Knight's weapon is not held, even with detached and looseAxis on.
4. **Rebuild and package `transfer-xl-35`.**
   - Regenerate the suggestions in `cases.json`.
   - Move the owner's answers to `answers-round1.json` and leave a fresh empty `answers.json`.
   - Make a 5-case sheet `TestBuilds\transfer-xl-35\cases-round2.json` (cloth-04, cloth-07, cloth-01, followup-17, humanoid-227)
     and the launcher `GRADE - XFER toggles round 2.cmd`.
   - Prove each case with hidden screenshots in `out/cp5/`, as in CP4b.

### CP5 report (Codex)

#### Round-one lessons

Seam fix stays available when it changes the result. The suggester leaves it unchecked. The owner dropped it on five of seven suggestions and kept it on cloth-05 and cloth-09.

| Pair | Suggested | Still ticked from suggestion | Added | Owner action | Grade | Owner comment |
|---|---|---|---|---|---:|---|
| `pair-34` | `detached`, `looseAxis` | `detached`, `looseAxis` | — | — | 10 | — |
| `pair-15` | `hand`, `surfaceGrip` | `hand`, `surfaceGrip` | — | — | 10 | — |
| `pair-18` | `markers`, `surfaceGrip` | `markers`, `surfaceGrip` | — | — | 10 | — |
| `humanoid-493` | `hand`, `detached`, `chains`, `looseAxis` | `hand`, `detached`, `chains` | — | Unticked `looseAxis` | 8 | — |
| `cloth-01` | `detached`, `looseAxis`, `skinLandmarks` | `detached`, `looseAxis`, `skinLandmarks` | — | — | 7 | even with all fixes - i cannot get a weapon in his hand, it is not being held (its still better) |
| `cloth-04` | `skinLandmarks`, `hangingChains`, `rootHeight`, `authoredMotion`, `keepTorso` | `skinLandmarks`, `rootHeight`, `authoredMotion`, `keepTorso` | — | Unticked `hangingChains` | 0 | This one is very bad, they are actually similar - bird with rider but the translation is poor - rider collapses inside body, wings dont flap = result is 0 |
| `cloth-05` | `chains`, `rootHeight`, `authoredMotion`, `seamFix` | `chains`, `rootHeight`, `authoredMotion`, `seamFix` | — | — | 8 | — |
| `cloth-06` | — | — | — | — | 5 | — |
| `cloth-07` | `skinLandmarks`, `rootHeight`, `trackWindow`, `seamFix` | `skinLandmarks` | `authoredMotion` | Unticked `rootHeight` | 0 | This one is really bad, the whole unit has come apart and is warped and disfigure |
| `cloth-07` | `skinLandmarks`, `rootHeight`, `trackWindow`, `seamFix` | `skinLandmarks` | `authoredMotion` | Unticked `trackWindow` | 0 | This one is really bad, the whole unit has come apart and is warped and disfigure |
| `cloth-07` | `skinLandmarks`, `rootHeight`, `trackWindow`, `seamFix` | `skinLandmarks` | `authoredMotion` | Unticked `seamFix` | 0 | This one is really bad, the whole unit has come apart and is warped and disfigure |
| `cloth-07` | `skinLandmarks`, `rootHeight`, `trackWindow`, `seamFix` | `skinLandmarks` | `authoredMotion` | Ticked `authoredMotion` | 0 | This one is really bad, the whole unit has come apart and is warped and disfigure |
| `cloth-09` | `extraMotion`, `skinLandmarks`, `seamFix` | `extraMotion`, `skinLandmarks`, `seamFix` | — | — | 7 | — |
| `pair-03` | — | — | — | — | 10 | — |
| `new-08` | — | — | — | — | 9 | — |
| `fresh-56` | — | — | — | — | 8 | — |
| `followup-17` | `authoredMotion`, `seamFix` | `authoredMotion` | — | Unticked `seamFix` | 8 | seam fix RUINS the unit. without way better |
| `pair-27` | — | — | — | — | 9 | — |
| `humanoid-500` | `gripRouting`, `skinLandmarks`, `seamFix` | `gripRouting`, `skinLandmarks` | — | Unticked `seamFix` | 8 | seam fix makes it woirse |
| `humanoid-912` | `gripRouting`, `surfaceGrip`, `extraMotion`, `skinLandmarks`, `keepTorso` | `gripRouting`, `surfaceGrip`, `extraMotion`, `skinLandmarks`, `keepTorso` | — | — | 9 | — |
| `humanoid-227` | `skinLandmarks`, `trackWindow`, `seamFix` | `skinLandmarks`, `trackWindow` | — | Unticked `seamFix` | 8 | Seam fix made it worse not better |
| `humanoid-993` | `seamFix` | — | — | Unticked `seamFix` | 8 | seam fix failed |
| `panel-36` | — | — | — | — | 10 | — |

The owner also unticked Hanging parts on cloth-04, Jump height and Smooth feet on cloth-07, and Loose blade angle on humanoid-493. The owner added Keep donor motion on cloth-07. These are observations from individual pairs. Their rules stay as reviewed.

#### Measured diagnoses

I compared the all-off export, each of the 22 existing repairs in isolation, the original suggestion and the owner's kept combination on the three named pairs.

- **cloth-04, Gryphon Rider → Hawkstrider Knight.** The recipient has one leg pair and the donor has two, so the base transplant skips its seated-rider branch and places the rider through the general body fit. At the sheet's Walk 133 ms and Attack 333 ms, the visible rider centroid was 10.7 and 16.8 model units above the mount centroid in the native Hawkstrider. All-off measured 13.4 and 10.3. Rest Pose Fit alone lowered those figures to −0.4 and +3.1. Both the old suggestion and the owner's kept combination put the rider below the mount centroid at both moments (−2.6 and −1.5). Hanging Parts alone measured 12.9 and 9.5, so it does not explain the pronounced sink. The Gryphon's wing branches own 72 donor skin vertices and its left wing tip moves 64.6 units relative to its root in Walk. The Hawkstrider has no recognized wing chain. Neither grafted donor wing subtree owns any recipient vertices with all keys off or with any of the existing repairs. Turning off Rest Pose Fit reduces the rider collapse. Saddle is byte-identical to plain here. Seating two different mount rigs while retaining their independent bodies needs a separate, verified placement change. Giving this recipient a flap would require a supported skin region. No new toggle was added for this pair.
- **cloth-07, Silverpaw Marksman → Magnataur.** The all-off result already distorts the torso and shoulder. The biped-to-quadruped graft sends native blended torso weights to widely diverging donor Chest, Head and arm joints. One plain Walk edge with a native maximum of 10.22 units grew to 51.02 at 433 ms. A plain Attack edge grew from 24.18 to 96.88 at 570 ms. Across 1,632 eligible visible triangle edges per clip, 38 Walk and 24 Attack edges exceeded twice their sampled native maximum with all repairs off. Rest Pose Fit alone reduced the counts to 14 and 8, exactly the counts with Keep Donor Motion also ticked. Jump Height and Smooth Feet alone kept the plain counts. Seam Fix alone reduced the counts to 22 and 16 but created worse local splits. For example, the two vertices on a Walk edge originally shared the same two native weights. Seam Fix put one exclusively on Chest and the other exclusively on Head and the edge reached 74.43 units against 10.37 native. The old suggested combination still had 10 Walk and 6 Attack edges above twice native. The remaining damage spans the main cross-kind skin and posture fit. No existing toggle resolves it and there is no verified narrow replacement for that fit.
- **cloth-01, Elven Executioner → Zweihander Knight.** Plain put the measured sword triangle on Pelvis. Loose Weapon correctly rerouted its rigid surface onto the donor Hammer bone under the right hand, but Hammer has its own translations and Loose Blade Angle pivots around a sword vertex near that carrier. In 31 sampled moments of Attack - 1, distance from the same modeled handle point to Hand Right Ref averaged 44.7 units plain, 20.9 with Loose Weapon, and 36.7 with the old suggested combination. At the sheet's 200 ms moment the old suggestion left 26.2 units of separation. The other existing keys do not seat the handle. The new **Seat loose grip** toggle uses the native solid handle surface closest to the native palm, puts that point on the result's mapped palm and retains the donor's weapon rotations. It requires Loose Weapon and applies to a rigid disconnected weapon with its own translated carrier under the mapped palm's wrist. The grip stayed within 0.1 unit of the palm at all sampled points in Stand, Walk and Attack - 1. The weapon rotation track and validation diagnostics match the old export. All-off MDX bytes matched the pre-edit exports for the three diagnosis pairs, and the existing cloth-01 repair combination still exports the same bytes when Seat Loose Grip is off.

#### Round-two package and proof

- Rebuilt with `pnpm run build` and repackaged `D:\Claude\MDLxL\TestBuilds\transfer-xl-35` offline with TEMP/TMP on D:. Package verification covered 1,681 runtime and asset files and 55 locale files.
- Regenerated the same 20 suggestions. Seam Fix remains visible on 18 cases and is suggested on zero. It dropped out of all seven previous suggestions. Keep Own Torso now wins the available slot on cloth-05. Seat Loose Grip is visible and suggested on cloth-01 only. The other 12 suggestions compare equal to round one.
- Archived the owner’s 20 grades byte for byte in `answers-round1.json`. The round-two sheet uses the fresh `answers.json`, which is still empty. `cases-round2.json` contains cloth-04, cloth-07, cloth-01, followup-17 and humanoid-227 in that order with the round-one comments. Claude can open it using `D:\Claude\MDLxL\TestBuilds\_START HERE\GRADE - XFER toggles round 2.cmd` with the existing named test model.
- [Screenshot proof](../../out/cp5/) contains a PNG for each case, with Donor / Before / After in the default view and both Looks. The cloth-01 PNG includes Seat Loose Grip off and on at the same paused Attack frame and camera. The hidden run checked five cases and clicked ten Looks. It verified the unchecked Seam Fix control on all five and normal mouse rotation. All 51 preview captures had zero unresolved textures and the run had zero page errors. Hidden test grades went to a disposable file.
- The cloth-04 and cloth-07 screenshots show the residual defects described above. No full suite, fresh 888-pair sweep or Warcraft III run was performed. CP5 and the package are local for Claude’s review.

### CP5 review (Claude) · GO, round 2 is ready for the owner

Checked:
- `out/cp5/cloth-01.png`: at the same Attack - 1 frame and camera, Seat loose grip on puts the hilt in the hands; off, it floats.
- Seam fix is visible and unticked on all five cases.
- `answers-round1.json` holds the owner's 20 grades; `answers.json` is empty.

The cloth-04 and cloth-07 diagnoses are measured and honest:
- **cloth-04:** Rest pose fit, which the suggester ticked, is what sinks the rider. The owner can untick it in round 2.
- **cloth-07:** the plain cross-kind fit already tears the Magnataur. No toggle fixes that.

Neither gets a speculative repair today. Their causes are recorded as follow-ups:
- seating a rider between two different mount rigs;
- the biped-to-quadruped torso fit;
- Hawkstrider wing skin, which has no recognized wing chain to reuse.

Codex: stop here. Round 2 waits for the owner's grades.

### Owner's round-2 grades (23 Nov) and CP6 instructions (Claude)

Round 2 (`TestBuilds\transfer-xl-35\answers.json`):
- cloth-07 Silverpaw → Magnataur 0 → **8** (kept Rest pose fit, Jump height, Smooth feet)
- cloth-01 Zweihander 7 → **8** (kept Loose weapon, Loose blade angle, Seat loose grip; **unticked Rest pose fit**)
- followup-17 Grizzly → Tauren **8**, humanoid-227 Arthas → Pikeman **9**, both without seam fix
- cloth-04 Gryphon Rider → Hawkstrider Knight 0 → **5**. The owner: "We have a GRIFFON RIDER - the rider is ONTOP of the griffon.
  if you cannot transfer the wings can you not keep the rider in the saddle??? I need to see the geoset pose to determine this one."

Archive these as `answers-round2.json`.

CP6, cloth-04 only. Stop at CHECKPOINT 6.
1. **New toggle `riderSeat` — "Keep rider seated"**, tooltip "Keeps the rider sitting in this model's own saddle while the bodies
   move." Use it when the donor and this model are both read as a rider on a mount, but the seated-rider branch is skipped (here:
   two donor leg pairs, one recipient leg pair).
   - The rider's seat, meaning its hips and pelvis skin, stays where this model's own animations put it on its own mount, every frame.
   - Measure that seat on the native Hawkstrider, relative to the mount body, in Stand/Walk/Attack.
   - The rider's upper body and arms still take the donor rider's motion. The mount keeps its transplanted motion.
   - Reuse the existing seated-rider code (`mountedPair`, `riders`, the RR1 rider-lean step in `skeleton-transplant.js`)
     instead of a new mechanism.
   - Proof: the rider-above-mount numbers from your CP5 diagnosis (native +10.7 / +16.8 at Walk 133 ms / Attack 333 ms)
     with the toggle on, both alone and together with the owner's kept combo.
   - It is a targeted key: it fires only on this rider case and joins `TARGETED_KEYS`. Translate the label into the 5 languages.
2. **Show the model's own pose.** The owner asked to "see the geoset pose". Add a fourth view, "Own", to the cloth-04 case:
   the Hawkstrider Knight's own file, playing its own matching animation. He can then compare where the rider sits natively.
   If the sheet already supports a file variant beside a transplant case, use that; otherwise add the smallest support for it.
3. **Package and sheet.**
   - Rebuild and package `transfer-xl-35`.
   - Write `cases-round3.json` with cloth-04 only (Donor | Own | Before | After) and a fresh empty `answers.json`.
   - Add the launcher `GRADE - XFER toggles round 3.cmd`.
   - Prove it with hidden screenshots in `out/cp6/`: default view and both Looks, with the toggle off and on.

#### CP6 addendum (owner, after the instructions): "geoset pose means unanimated as well"

The sheet also needs the **unanimated geoset pose**: the meshes exactly as stored, with no bones playing. Add a "Geoset pose" choice
at the start of the Animation row. It applies to every view at once: Donor, Own, Before and After show their stored vertices,
unanimated, on the same camera. Then the owner can see where the rider sits in the saddle as modelled, and where the result
puts it. Reuse the app's existing unanimated rendering (the Bones editor's unanimated rig and the `unanimatedTrackValue` path) if
GamePreview already has such a mode; otherwise add the smallest option to show the stored mesh. Add this view to the `out/cp6/`
screenshots. This is part of CHECKPOINT 6.

### CP6 report (Codex)

The owner’s five round-two answers were archived byte for byte as `answers-round2.json`. Round three uses a fresh empty `answers.json`.

#### Keep rider seated

`riderSeat` is a targeted opt-in for the two-legged wingless mounted recipient taking a four-legged winged mount donor. It extends the existing seated-rider pairing and RR1 lean. The rider’s native hips, pelvis and seated lower joints use their own retimed tracks under the donor mount. The donor’s shared chest and seat translation gives way to the retained seat. The chest rotation, arm rotation and mount-body rotation tracks still match the donor. The Hawkstrider has no wing skin branch to drive.

The table repeats CP5’s world-height centroid comparison in model units. It includes the whole rider and the same mount-root skin group, so donor lean, limb pose and mount pitch can change the number even with the pelvis correctly seated.

| Look moment | Native Hawkstrider | All off | Owner’s kept repairs | Rider seat alone | Owner’s kept repairs + rider seat |
|---|---:|---:|---:|---:|---:|
| Stand, 0 ms | +14.5 | +14.2 | +1.9 | +17.6 | +17.7 |
| Walk, 133 ms | +10.7 | +13.4 | −2.6 | +17.7 | +18.2 |
| Attack, 333 ms | +16.8 | +10.3 | −1.5 | +14.6 | +14.5 |

At each of 3,170 integer frame times across Stand, Walk and Attack, all 16 exclusively pelvis-weighted vertices matched the native pose in saddle space within 0.0001 model unit with either rider-seat configuration. The eight donor rotation tracks and all 920 mount-only vertices passed the branch checks. Both enabled exports had zero validation errors and the same seven pre-existing degenerate-face warnings. With Rider Seat off, both the plain and owner-kept exports were byte-identical to their pre-edit versions.

#### Round-three sheet and proof

- Rebuilt and repackaged `D:\Claude\MDLxL\TestBuilds\transfer-xl-35` offline with TEMP/TMP on D:. The package verified 1,681 runtime and asset files and 55 locale files. The focused sheet parser tests passed 11/11.
- `cases-round3.json` contains cloth-04 only. `D:\Claude\MDLxL\TestBuilds\_START HERE\GRADE - XFER toggles round 3.cmd` opens the named test model and the sheet. The stored engine suggestion includes Keep Rider Seated and leaves Seam Fix unchecked.
- Donor | Own | Before | After share one camera. Own plays the native Walk and Attack -1 when those Looks are selected. The first Animation choice, Geoset pose, renders all four stored meshes using identity bone matrices. Switching to it keeps the shared camera. The initial fit uses the body geometry and skips the portrait backdrop when calculating the frame.
- [Screenshot proof](../../out/cp6/) contains the eight requested captures. Default, Walk Look, Attack Look and Geoset pose each have a matched off/on pair, using the owner’s retained repairs for After. The hidden clicks verified that each pair kept its camera and frame. A real drag in Own rotated all four views. All 32 captured panes loaded with zero unresolved textures and no page errors. The [verification record](../../out/cp6/verification.json) includes the pane and engine checks.
- No full suite, fresh 888-pair sweep or Warcraft III run was performed. The round-three package and CP6 commit are local for Claude’s review.

### CP6 review (Claude) · GO, round 3 is ready for the owner

Checked `out/cp6/look-1-off.png` against `look-1-on.png` at Walk 133 ms. With Keep rider seated off, the rider is buried in the Hawkstrider. With it
on, he sits upright on its back, matching the Own view. Geoset pose shows all four stored meshes on one camera. With the
toggle off, the exports are byte-identical to before. Codex: wait for the owner's round-3 grade.

### Owner's round-3 grade and CP7 instructions (Claude): 30 new random pairs

Round 3: cloth-04 Gryphon Rider → Hawkstrider Knight **10**, with the suggested set unchanged including Keep rider seated. Archive it as
`answers-round3.json`.

The owner now wants to grade **30 new random pairs**. Two stops:

**CP7a · Draw the list, then stop (no building).**
- **Pool:** living units only.
  - Owner rule, 20 Nov: never buildings, boats, crates, missiles or effects. Filter by name **and** by rig reading (a trunk,
    a head, and limbs, wings or a legless body). Draw from `D:\Claude\MDLxL-TestModels` and the lpw `dist/models` the sweeps used.
  - Exclude every donor/recipient pair already graded (`D:\Claude\xfer-look\graded-n.json` and `answers-round1..3.json`).
  - At most two uses of any one model.
- **Draw:** random with a recorded seed, 30 pairs plus 5 spares. Kinds come as they fall; if the draw is more than 80%
  two-legged humanoid-to-humanoid, redraw once.
  - Mirror as the window picks it.
- **Report:** a table of donor → recipient, kind of each (biped, four-legged, rider, winged, legless), and the file paths. Stop
  with `CHECKPOINT 7a READY`. Claude checks every name by hand.

**CP7b · Build the sheet, only after the CP7a review.**
- **Cases:** Donor | Own | Before | After, with the Geoset pose choice, the stored suggestion, and Looks framed as in CP4b.
  - Question = the two names. No hint text.
  - Grade + comment as before.
- **Files:** `cases-random30.json`, a fresh empty `answers.json`, and the launcher `GRADE - XFER random 30.cmd` opening the named
  test model.
- **Proof:** hidden screenshots of all 30 (default view + first Look) in `out/cp7/`.
  - Zero page errors, zero untextured views.
  - Replace any pair that fails to load or renders gray with a spare, and say which.
- Stop with `CHECKPOINT 7b READY`.

### CP7a · Random living-unit pairs

- Archived the owner’s 10/10 for cloth-04 in `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\answers-round3.json`. It is a byte-for-byte copy of the graded `answers.json`, with Keep rider seated in both the selected and suggested sets. SHA-256 `8a6f163beca6752160e847ff6b76154363e5e9d4ceb04b4f72e78ca1f52aa8c8`.
- Read 532 MDX files under `D:\Claude\MDLxL-TestModels\corpus-sd` and `D:\Claude\lpw-main\dist\models`. The name and rig filter yielded 427 eligible units with a drawable mesh, an active sequence, a head and trunk, and limbs, wings or a legless body. The kind reflects the unit’s default form. Checked ambiguous names and body plans against the model’s rig, mesh and textures. Animated undead and other named creature units are included. Excluded non-unit assets and anatomies outside the five requested kinds.
- Mulberry32 seed `0x9a54f5bf` sampled donor and recipient indices from the eligible files sorted by case-insensitive path. Skipped self-pairs, repeated pairs, and any candidate that would exceed two uses of one model across the 30 cases and five spares. Checked both directions against 295 records in `graded-n.json` and 26 answers from rounds 1–3, using source paths, content hashes and name aliases. The highest use count is 2.
- 13/30 main cases are two-legged humanoid → two-legged humanoid (43.3%). The draw stayed below the redraw threshold. The Mirror column uses the Transfer window’s initial default with repairs off. Verified all 35 mirror choices against the window helper. 8 default to Yes.
- CP7a stops at the list. The engine, package and grading sheet are at their CP6 revisions. This checkpoint ran no builds, test suites or fresh sweeps.

| Case | Donor | Kind | Donor file | Recipient | Kind | Recipient file | Mirror |
|---|---|---|---|---|---|---|---|
| 01 | Reikland Halberdier | biped | `D:\Claude\lpw-main\dist\models\herrdave\77\ReiklandHalberdier.mdx` | Kodo Beast (mounted) | rider | `D:\Claude\MDLxL-TestModels\corpus-sd\orc__kotobeast.mdx` | No |
| 02 | Seal | legless | `D:\Claude\MDLxL-TestModels\corpus-sd\critters__seal.mdx` | Gor Spear Thrower | biped | `D:\Claude\lpw-main\dist\models\gluma\355533\gor_spear.mdx` | No |
| 03 | Knight of Slaanesh · Axe | rider | `D:\Claude\lpw-main\dist\models\WH_WOC_KnightSlaaneshAxe07.mdx` | Ogre | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\creeps__ogre.mdx` | No |
| 04 | Savage Orc | biped | `D:\Claude\lpw-main\dist\models\herrdave\42\Greenskin_Orc1.mdx` | Demoness | winged | `D:\Claude\MDLxL-TestModels\corpus-sd\demon__demoness.mdx` | No |
| 05 | Night Elf Runner | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\nightelf__runner.mdx` | Villager Kid | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\critters__villagerkid.mdx` | Yes |
| 06 | Naga Royal Guard | legless | `D:\Claude\MDLxL-TestModels\corpus-sd\naga__nagaroyalguard.mdx` | Knight of Nurgle · Heavy | rider | `D:\Claude\lpw-main\dist\models\WH_WOC_KnightNurgleHeavy06.mdx` | No |
| 07 | Blood Mage | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\human__herobloodelf.mdx` | Tauren Chieftain | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\orc__herotaurenchieftain.mdx` | No |
| 08 | Chaos Peon | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\demon__chaospeon.mdx` | Murloc Warrior | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\creeps__murlocwarrior.mdx` | No |
| 09 | Faceless One | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\creeps__facelessone.mdx` | Villager Woman | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\critters__villagerwoman.mdx` | No |
| 10 | Saurus Oldblood Hero | biped | `D:\Claude\lpw-main\dist\models\gluma\358116\Oldblood_hero.mdx` | Kroxigor Hero | biped | `D:\Claude\lpw-main\dist\models\gluma\359970\kroxigor_hero_xtent_fix.mdx` | No |
| 11 | Knight of Slaanesh · Axe | rider | `D:\Claude\lpw-main\dist\models\WH_WOC_KnightSlaaneshAxe07.mdx` | Skeleton | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\undead__skeleton.mdx` | Yes |
| 12 | Druid of the Claw | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\nightelf__druidoftheclaw.mdx` | Wind Serpent | winged | `D:\Claude\MDLxL-TestModels\corpus-sd\naga__windserpent.mdx` | No |
| 13 | Gargoyle | winged | `D:\Claude\MDLxL-TestModels\corpus-sd\undead__gargoyle.mdx` | Revenant of the Waves | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\creeps__revenantofthewaves.mdx` | No |
| 14 | Spanish Swordsman (Estalia) | biped | `D:\Claude\lpw-main\dist\models\herrdave\46\Spanish_Swordsman.mdx` | Revenant | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\creeps__revenant.mdx` | Yes |
| 15 | Blood Elf Lieutenant | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\other__bloodelflieutenant.mdx` | Kobold Shoveler | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\critters__shoveler.mdx` | No |
| 16 | Centaur | four-legged | `D:\Claude\MDLxL-TestModels\corpus-sd\creeps__centaur.mdx` | Black Dragon Whelp | winged | `D:\Claude\MDLxL-TestModels\corpus-sd\creeps__blackdragonwelp.mdx` | No |
| 17 | Shaman | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\orc__shaman.mdx` | Skink Chief (Hero) | biped | `D:\Claude\lpw-main\dist\models\gluma\355959\skink_chief_hero.mdx` | No |
| 18 | Empire Handgunners (Arquebus) | biped | `D:\Claude\lpw-main\dist\models\gluma\373390\handgunner_arquebus.mdx` | Magnataur Brown | four-legged | `D:\Claude\MDLxL-TestModels\corpus-sd\creeps__magnataurbrown.mdx` | No |
| 19 | Ungor with Spear | biped | `D:\Claude\lpw-main\dist\models\gluma\326273\ungor_spear.mdx` | Demoness | winged | `D:\Claude\MDLxL-TestModels\corpus-sd\demon__demoness.mdx` | No |
| 20 | Admiral Proudmoore | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\other__proudmoore.mdx` | Warrior of Khorne · Bruiser | biped | `D:\Claude\lpw-main\dist\models\WH_WOC_WarriorKhorne04.mdx` | Yes |
| 21 | Dark Elf Slavemaster (Unit) | biped | `D:\Claude\lpw-main\dist\models\gluma\371134\Dark_Elf_Slavemaster_unit_opt.mdx` | Empire Handgunners (Scoped) | biped | `D:\Claude\lpw-main\dist\models\gluma\373390\handgunner_scope.mdx` | No |
| 22 | High Elf Peasant | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\critters__highelfpeasant.mdx` | Harpy | winged | `D:\Claude\MDLxL-TestModels\corpus-sd\creeps__harpy.mdx` | Yes |
| 23 | Dark Elf Slavemaster (Hero) | biped | `D:\Claude\lpw-main\dist\models\gluma\371134\Dark_Elf_Slavemaster_hero_opt.mdx` | Knight of Khorne · Champion (Flail, Hero) | rider | `D:\Claude\lpw-main\dist\models\WH_WOC_KnightKhorneFlailHero01.mdx` | No |
| 24 | Centaur | four-legged | `D:\Claude\MDLxL-TestModels\corpus-sd\creeps__centaur.mdx` | Naga Royal Guard | legless | `D:\Claude\MDLxL-TestModels\corpus-sd\naga__nagaroyalguard.mdx` | No |
| 25 | Knight of Nurgle · Champion (Hero) | rider | `D:\Claude\lpw-main\dist\models\WH_WOC_KnightNurgleChampionHero01.mdx` | Bestigor | biped | `D:\Claude\lpw-main\dist\models\gluma\352415\bestigor10.mdx` | No |
| 26 | Death Knight (mounted) | rider | `D:\Claude\MDLxL-TestModels\corpus-sd\undead__herodeathknight.mdx` | Arthas with Sword | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\human__arthaswithsword.mdx` | Yes |
| 27 | Watcher | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\creeps__watcher.mdx` | Chaos Hellscream | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\demon__chaoshellscream.mdx` | No |
| 28 | Murloc Flesh Eater | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\creeps__murlocflesheater.mdx` | Centigor Spearman | four-legged | `D:\Claude\lpw-main\dist\models\maximal\358425\Centigor(Spearman).mdx` | No |
| 29 | Skink Worker | biped | `D:\Claude\lpw-main\dist\models\gluma\356052\skink_worker.mdx` | Saurus Warrior | biped | `D:\Claude\lpw-main\dist\models\gluma\357283\saurus_warrior_unit_run.mdx` | No |
| 30 | Blademaster | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\orc__heroblademaster.mdx` | Revenant | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\creeps__revenant.mdx` | Yes |
| Spare 1 | Harpy Queen | winged | `D:\Claude\MDLxL-TestModels\corpus-sd\creeps__harpyqueen.mdx` | Blademaster | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\orc__heroblademaster.mdx` | No |
| Spare 2 | Gargoyle | winged | `D:\Claude\MDLxL-TestModels\corpus-sd\undead__gargoyle.mdx` | High Elf Peasant | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\critters__highelfpeasant.mdx` | No |
| Spare 3 | Keeper of the Grove | four-legged | `D:\Claude\MDLxL-TestModels\corpus-sd\nightelf__herokeeperofthegrove.mdx` | Bristleback | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\creeps__bristleback.mdx` | No |
| Spare 4 | Storm Pandaren Brewmaster | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\creeps__stormpandarenbrewmaster.mdx` | Archmage Ghost (mounted) | rider | `D:\Claude\MDLxL-TestModels\corpus-sd\other__heroarchmageghost.mdx` | Yes |
| Spare 5 | Dalaran Reject | legless | `D:\Claude\MDLxL-TestModels\corpus-sd\other__dalaranreject.mdx` | Demon Hunter | biped | `D:\Claude\MDLxL-TestModels\corpus-sd\nightelf__herodemonhunter.mdx` | No |

### CP7a review (Claude) · GO

Claude checked all 30 pairs and 5 spares by hand: every one is a living unit, with no buildings, boats, crates or effects.
The unclear names were checked against their rigs: Kobold Shoveler (K_ bones with a tail), Seal (critter with feet and
walk clips), Dalaran Reject (animated creature). The seed, the exclusion of graded pairs and the two-use limit are as asked;
43% of the pairs are biped-to-biped. Build CP7b exactly as in the instructions, using the 30 main cases in this order. Use spares
only to replace a case that fails to load or renders gray, and name each swap. Stop with `CHECKPOINT 7b READY`.

### CP7b · Thirty-pair grading sheet

- Kept all 30 approved pairs in the CP7a order. No spares were needed. `cases-random30.json` stores the engine’s suggestions and the approved mirror choices. Each question contains the two model names. Every case has Donor, Own, Before and After, the Geoset pose choice, Looks with the existing CP4b framing, and the usual grade and comment controls.
- The [launcher](<D:/Claude/MDLxL/TestBuilds/_START HERE/GRADE - XFER random 30.cmd>) opens `TEST XFER RANDOM 30.mdx` in `transfer-xl-35`. Verified the launcher's arguments by opening the installed sheet hidden on case 1 of 30. The new `answers.json` is empty. The round 1–3 answer archives kept their hashes.
- Reused the accepted CP6 executable. Where a model needed local texture lookup, the sheet uses a byte-identical MDX copy with its existing textures beside it. Engine code and the original model and texture sources are unchanged.
- [Screenshot proof](../../out/cp7/) includes one default view and one first Look for every case. Reviewed the 60 PNGs. All 240 panes showed visible geometry with zero unresolved textures, texture decode errors or page errors. The shared Look camera fit all four views. The default view for pair 26 is wide, and its first Look shows the bodies at a larger scale.
- The first case’s two captures passed before the mouse test hit an ambiguous canvas selector. The supplemental check on pair 2 used the model canvas and verified real mouse rotation on the shared camera, all four Geoset poses, and grade and comment saving to disposable answers. See the [verification record](../../out/cp7/verification.json).

### CP7b review (Claude) · GO, the random-30 sheet is ready for the owner

Claude looked at all 30 first-Look captures in `out/cp7/`. Every case shows four textured views (Donor, Own, Before, After)
with the repair row above After; no pane is gray or empty. Codex: wait for the owner's grades on `GRADE - XFER random 30.cmd`.

### Owner stopped the random-30 grading; CP8 instructions (Claude): pose transfer becomes a toggle

The owner graded 8 of 30, then stopped: "50% of the pose transfers were messed up so I stopped grading. Pose transfer should be a
toggle, pose transfers need to be better - you cannot provide a pose with arms inside the body etc - that is invalid for editing".
- random-05, Runner → Villager Kid, 4: "Geoset pose is messed up - the kids arm goes into his body???"
- random-08, Chaos Peon → Murloc Warrior, 3: "Geoset pose is messed up!! why are you changing geosets pose to begin with?? this is an
  animation/bone transfeR?"

**Cause:** since `0f2a8185` (19 Nov) the transplant re-poses the stored mesh into the donor's rest posture (the `repose` block in
`skeleton-transplant.js`, "re-pose: the donor's rest posture in the bind pose"), so the donor's rotation keys can be copied
unchanged. Claude measured it: Grunt → Footman moves 531 of 582 stored vertices, by up to 35% of the height.

Archive the 8 grades as `answers-random30-part1.json`. CP8, then stop:
1. **New toggle `donorPose`, "Donor pose"**, tooltip: "Bends this model's stored pose into the donor's resting pose." **Off by
   default.**
   - **Off:** every stored vertex and normal of the result is identical to the recipient's own geoset. The donor's rest-turn
     correction goes into the keys instead of the mesh: each joint's rotation keys carry its correction, so the motion still
     follows the donor.
   - Measure how close the motion is. Take the skinned positions at sampled frames, compared with donorPose on, on 20 pairs.
     Report the median and worst difference as a share of height, and where the difference comes from (blended seam vertices).
   - **On:** the engine as before.
   - Proof: with donorPose on and every other toggle off, the export is byte-identical to the CP7 engine on the CP2 high- and
     low-grade inputs.
   - The owner's decision replaces the old baseline, so "all toggles off" now means the model keeps its own geoset pose.
2. **A donor pose must be valid for editing when on.** In the re-posed stored mesh, no arm, leg, tail or wing skin may end up
   inside the torso or inside another limb, beyond what the recipient's own geoset already has.
   - Measure each limb's added penetration in the stored mesh against the trunk and the other limbs.
   - Where a limb's rest turn adds penetration, ease that limb's correction back toward the model's own rest pose (search the
     share) until it clears. The rest of the pose stays the donor's.
   - Proof: random-05 (the kid's arm) and random-08 (the Murloc), plus a count of how many of the 30 random pairs needed easing,
     and which limbs.
3. **Suggester:** suggest donorPose only when the eased pose has no added penetration **and** it lowers the look-check score.
4. **Rebuild the random-30 sheet** (`cases-random30.json`, all 30, fresh suggestions, empty `answers.json`).
   - Prove it with hidden screenshots in `out/cp8/`: the default view **and the Geoset pose view** for every case.
   - Stop with `CHECKPOINT 8 READY`. Claude reviews every Geoset pose before the owner sees it.

### CP8 · Donor pose

- Archived the eight owner grades as `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\answers-random30-part1.json`. The live sheet has the same 30 pairs in order, refreshed suggestions and an empty answers file.
- **Donor pose** starts unchecked in Transfer and in the sheet. With it off, the bind-space correction is carried in the animation rotation and translation keys. All 30 reopened MDX exports kept the recipient’s exact stored vertex and normal bytes. The four fixtures with a zero-duration global sequence reported the same validation error as their inputs.
- Compared Donor pose off and on across the first 20 pairs, at nine frames in each of up to three clips per pair. There were **513 frames** and **366,302 visible vertex samples**, normalized by the recipient’s standing height. The median of the 20 per-pair vertex medians was **0.00000344% of height**. The worst was **41.09% of height** on random-17, Shaman → Skink Chief (Hero), in Walk at model frame 21167 (geoset 2, vertex 35, zero-based). The vertex has blended native weights. Rebasing one rigid influence preserves its motion, while rebasing a blended bind point and then skinning cannot in general reproduce the original two-stage blend. The detailed samples also separate mixed weights from rigid effects and fittings.
- The clearance check compares posed vertices and triangle centers with the recipient’s original torso and limb surfaces. It searches the limb’s share of the donor correction and keeps the nearest verified clear share. Open or differently weighted shapes limit what those samples can certify. The recipient’s stored pose is used when the checked limb adjustments cannot clear the candidate.
- With **Donor pose alone**, 19 of 30 requested a clearance adjustment. Twelve retained an eased donor pose and seven retained the recipient’s pose. With the suggested repairs also checked, 19 required adjustment and nine retained the recipient’s pose. In both runs all 30 passed the added-penetration check. The engine suggests Donor pose on random-16, Centaur → Black Dragon Whelp, where it reduced the look-check score. The recommendation remains unchecked until the user selects it.

| Case | Limbs eased with Donor pose alone | Share of donor correction kept |
|---|---|---|
| random-01 | Left leg, Right leg, Left arm, Right arm | Recipient’s stored pose |
| random-02 | Left leg, Right leg | Recipient’s stored pose |
| random-03 | Left leg, Right leg | Left leg 35.9%, Right leg 0.0% |
| random-05 | Left arm, Right arm | Left arm 63.3%, Right arm 60.9% |
| random-06 | Right arm, Tail, Left arm | Recipient’s stored pose |
| random-08 | Right arm | Right arm 15.6% |
| random-10 | Left arm, Tail, Right arm | Left arm 76.6%, Tail 53.9%, Right arm 79.7% |
| random-11 | Right leg, Left leg | Right leg 82.0%, Left leg 68.8% |
| random-13 | Left arm | Left arm 36.7% |
| random-14 | Left arm | Left arm 53.1% |
| random-15 | Left leg | Left leg 75.8% |
| random-17 | Right leg | Right leg 40.6% |
| random-21 | Left arm | Left arm 10.2% |
| random-23 | Left arm, Right arm | Recipient’s stored pose |
| random-25 | Left leg, Right leg | Recipient’s stored pose |
| random-26 | Right leg, Left leg, Left arm | Recipient’s stored pose |
| random-28 | Left arm, Right arm, Left leg, Second left leg, Second right leg, Right leg | Recipient’s stored pose |
| random-29 | Left leg, Right leg, Right arm | Left leg 45.3%, Right leg 18.0%, Right arm 28.9% |
| random-30 | Left arm | Left arm 28.9% |

- **Owner’s two cases.** Random-05 retained 63.3% of the left-arm correction and 60.9% of the right-arm correction. Random-08 retained 15.6% of its right-arm correction. Both cleared the measured added penetration while retaining the donor pose elsewhere. The `diagnosis-random-05-geoset-on.png` and `diagnosis-random-08-geoset-on.png` images show Donor pose alone.
- **CP7 byte comparison with Donor pose alone.** Of the 138 CP2 high-grade and 59 low-grade inputs, **39 high and 17 low matched** the CP7 MDX exactly. The other **99 high and 42 low** changed with the requested clearance treatment. Every byte difference corresponded to a CP7 pose that added penetration in the check. Unconditional byte identity would restore those intersections, so the clearance requirement takes precedence.
- Rebuilt the local `transfer-xl-35` package and verified the existing launcher opens case 1 of 30 with Donor pose off. The hidden run captured **90 screenshots** across all 30 pairs. The default, unanimated off and unanimated on views showed **360 textured panes** with zero page errors. The shared mouse camera rotated on random-05. The direct Transfer check rebuilt in both directions and applied the off result with the recipient’s stored vertices and normals intact. The focused parser and registry checks passed 12/12.
- [Screenshots](../../out/cp8/) · [Verification record](../../out/cp8/verification.json) · [Local launcher](<D:/Claude/MDLxL/TestBuilds/_START HERE/GRADE - XFER random 30.cmd>)

### CP8 review (Claude) · GO, the random-30 sheet is ready again

What Claude checked:
- **Geoset pose screenshots** (`out/cp8`, random-04/05/08/17). With Donor pose off, Before and After are identical to Own. With it on,
  the Murloc stands upright like the Chaos Peon, with the arm clear of the body.
- **Motion with Donor pose off.** Codex's worst blended-vertex difference was 41% of height (random-17). So Claude ran the look check on
  all 30 pairs, off against on (`out/claude-cp4/cp8motion.mjs`):
  - Off: 10 stretch, 4 collapse, 3 bob, 1 shake, 1 squash-flat, 1 held piece, 1 still walk.
  - On: 8 stretch, 4 collapse, 3 bob, 2 shake, 1 squash-flat, 1 held piece, 1 still walk.
  - Off adds borderline stretch flags only on random-11, -17 and -24 (0.038–0.043 against 0.035), and loses one on random-10.
  - No pair gets a new large defect.
  - The blended-seam difference is a known limit of moving the correction into the keys. Watch random-17 Walk.
- **Graded inputs:** 141 of the 197 now change even with Donor pose on, because of the easing. That is the owner's rule (no limbs
  inside the body) taking precedence over byte identity.

Codex: wait for the owner's grades on `GRADE - XFER random 30.cmd`.

### CP9 · New-models sheet

- The seen inventory read all **56 matching case JSONs and 24 answer JSONs** found under `D:\Codex` and `D:\Claude\MDLxL\TestBuilds`, plus the **295 grade records and 888 saved pairs**. Compared unit names with race prefixes removed, model metadata aliases, 1,120 distinct SHA-256 file hashes, and exact stored-geometry hashes. The historical `WH_VC_LahmianVampire01 (1).mdx` reference had no available file, so its recorded name was used for exclusion.
- Enumerated **755 Classic SD model files** from the installed Warcraft III CASC `war3.w3mod:units` module through `electron/casc.cjs`. Reviewed the World Editor unit entries outside that folder for eligible living rigs. Scanned **3,162 model files** in the full MDLxL-TestModels, LowPolyWorks and BindXL reference trees. The name and rig checks required a head, trunk and articulated limbs, wings or a legless body. The final draw excludes already-shown unit identities and reused file or geometry hashes.
- Seed **`0x4e4fa4f1`** used Mulberry32 on source-path-sorted candidate lists, with seeded reserves for exclusions and load failures. The final 30 pairs contain **28 Blizzard and 32 non-Blizzard models**, used once each, with **6/30 biped → biped**. The independent Blizzard reserves were exhausted when both Alchemist cases failed. The Blizzard MDXs and their textures were added under `D:\Claude\MDLxL-TestModels\new-30`. The verification record includes every original source and the copied model and texture hashes.
- [GRADE - XFER new 30.cmd](<D:/Claude/MDLxL/TestBuilds/_START HERE/GRADE - XFER new 30.cmd>) opens the CP8 build with the named startup copy of the first selected Blizzard model. `cases-new30.json` contains the four panes, Geoset pose, stored suggestions and an unchecked Donor pose. The sheet writes to its own empty `new30\answers.json`. The previous grading sheet keeps its answers file.
- Reviewed **60 screenshots**, default and unanimated Geoset pose for each pair. All **240 panes** rendered with zero unresolved textures or page errors in the final cases. Before and After matched Own’s stored vertex and normal arrays with Donor pose off. A real mouse drag rotated the shared camera. The installed launcher reopened case 1 with all four panes and empty answers.
- [Screenshots](../../out/cp9/) · [Verification record](../../out/cp9/verification.json)

#### Replacements

| Slot | Removed | Used instead | Reason |
|---|---|---|---|
| new-02 | French Rifleman → Union Field Cannon | French Rifleman → Polish Partisan WWII Sapper | Name and rig audit identified an artillery crew model. |
| new-17 | Bronze Dragon → Warhammer Chaos Knight Of Khorne Standard Bearer | Bronze Dragon → German AT-Rifle | The local model is a saved pivot-regression fixture. |
| new-26 | High Elf Hawkstrider Knight → In Land Murloc Spear Man Purple | Dire Gnoll Hero → In Land Murloc Spear Man Purple | The High Elf Hawkstrider variant is in the previously shown Hawkstrider Knight family. |
| new-04 | Hero Goblin Alchemist B → Dire Wolf (Level 2) | Italian Officer WWI → CCP Chinese Shocktroop | Hidden app could not decode the donor GOLDCoin.blp texture. |
| new-23 | Ice Troll Alchemist → Dog | Arkain Man At Arms By General Frank → French SMG | Hidden app could not decode the donor GOLDCoin.blp texture. |

#### The 60 selected models

| Case | Role | Model | Origin | Kind | File |
|---|---|---|---|---|---|
| new-01 | Donor | Nether Dragon | Blizzard | winged | `D:\Claude\MDLxL-TestModels\new-30\creeps__netherdragon-7351839c\netherdragon.mdx` |
| new-01 | Own | Makrura Pooldweller | Blizzard | many-legged | `D:\Claude\MDLxL-TestModels\new-30\creeps__lobstrokkred-c14da854\lobstrokkred.mdx` |
| new-02 | Donor | French Rifleman | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\FrenchWW1Sapper-3f6255b9\FrenchWW1Sapper.mdx` |
| new-02 | Own | Polish Partisan WWII Sapper | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\PolishPartisanSapper-8c3f7975\PolishPartisanSapper.mdx` |
| new-03 | Donor | Elven Dire Dragonhawk | Non-Blizzard | rider | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\ElvenDireDragonhawk-5a414d4e\ElvenDireDragonhawk.mdx` |
| new-03 | Own | King Anduin Wrynn H | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\King_Anduin_WrynnH-efd447a7\King Anduin WrynnH.mdx` |
| new-04 | Donor | Italian Officer WWI | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\ItalianOfficerWWI-eb3eb113\ItalianOfficerWWI.mdx` |
| new-04 | Own | CCP Chinese Shocktroop | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\ChineseCCP_Shocktroop-3d610f80\ChineseCCP_Shocktroop.mdx` |
| new-05 | Donor | Italian Airborn SMG | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\ItalianAirborn_SMG-98eb0e9a\ItalianAirborn_SMG.mdx` |
| new-05 | Own | Dire Orc Death Knight | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\Dire_GruntDead-ee32f22b\Dire_GruntDead.mdx` |
| new-06 | Donor | Ottoman Trench Raider | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\OttomanTrenchRaider-4a7cbedc\OttomanTrenchRaider.mdx` |
| new-06 | Own | Rabbit | Blizzard | four-legged | `D:\Claude\MDLxL-TestModels\new-30\critters__easterrabbit-3863e8ad\easterrabbit.mdx` |
| new-07 | Donor | Coastal Murloc Warrior Green | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\CG_MurlocWarrior-de60ab83\CG_MurlocWarrior.mdx` |
| new-07 | Own | Knight of Tzeentch · Sword | Non-Blizzard | rider | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\WH_WOC_KnightTzeentchSword07-9a7a863e\WH_WOC_KnightTzeentchSword07.mdx` |
| new-08 | Donor | Hero Berserker | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\Hero_Berserker-4acc1c0f\Hero_Berserker.mdx` |
| new-08 | Own | Druid of the Talon (Night Elf Form) | Blizzard | biped | `D:\Claude\MDLxL-TestModels\new-30\nightelf__druidofthetalon-edea56bb\druidofthetalon.mdx` |
| new-09 | Donor | Fel Boar | Blizzard | four-legged | `D:\Claude\MDLxL-TestModels\new-30\critters__felboar-3ce16578\felboar.mdx` |
| new-09 | Own | Khamûll The Easterling | Non-Blizzard | rider | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\Wraith_Khamul-1-e44250a7\Wraith_Khamul-1.mdx` |
| new-10 | Donor | Orc Warchief | Blizzard | rider | `D:\Claude\MDLxL-TestModels\new-30\demon__chaoswarlord-78bcb4fa\chaoswarlord.mdx` |
| new-10 | Own | Dragonhawk Rider | Blizzard | rider | `D:\Claude\MDLxL-TestModels\new-30\human__bloodelfdragonhawk-a175aae4\bloodelfdragonhawk.mdx` |
| new-11 | Donor | Deep Sea Murloc Mage Purple | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\DSP_MurlocMage-28b788dd\DSP_MurlocMage.mdx` |
| new-11 | Own | Red Dragon | Blizzard | winged | `D:\Claude\MDLxL-TestModels\new-30\creeps__reddragon-8fbd9325\reddragon.mdx` |
| new-12 | Donor | Costal Murloc Worker Purple | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\CP_MurlocWorker-b04d2e60\CP_MurlocWorker.mdx` |
| new-12 | Own | Crypt Lord | Blizzard | four-legged | `D:\Claude\MDLxL-TestModels\new-30\undead__herocryptlord-38598f3f\herocryptlord.mdx` |
| new-13 | Donor | Furbolg Elder Shaman | Blizzard | biped | `D:\Claude\MDLxL-TestModels\new-30\creeps__furbolgshaman-1aa9291f\furbolgshaman.mdx` |
| new-13 | Own | Overlord Arachnathid | Blizzard | many-legged | `D:\Claude\MDLxL-TestModels\new-30\creeps__archnathidpurple-86468d34\archnathidpurple.mdx` |
| new-14 | Donor | Elder Voidwalker | Blizzard | legless | `D:\Claude\MDLxL-TestModels\new-30\creeps__voidwalker-6ef9d442\voidwalker.mdx` |
| new-14 | Own | Malfurion (Mounted) | Blizzard | rider | `D:\Claude\MDLxL-TestModels\new-30\nightelf__malfurionnostag-a9fb55c2\malfurionnostag.mdx` |
| new-15 | Donor | Azure Dragon Crystal Lord By Frankster | Non-Blizzard | winged | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\AzureDragonCrystalLord_Jade-52cf127d\AzureDragonCrystalLord_Jade.mdx` |
| new-15 | Own | Bronze Dragon Whelp | Blizzard | winged | `D:\Claude\MDLxL-TestModels\new-30\creeps__bronzedragonwelp-1cf2e43b\bronzedragonwelp.mdx` |
| new-16 | Donor | Hydromancer | Blizzard | rider | `D:\Claude\MDLxL-TestModels\new-30\creeps__banditmage-8906c71d\banditmage.mdx` |
| new-16 | Own | Halahk the Lifebringer | Blizzard | biped | `D:\Claude\MDLxL-TestModels\new-30\human__heropaladinboss-343b5ecb\heropaladinboss.mdx` |
| new-17 | Donor | Bronze Dragon | Blizzard | winged | `D:\Claude\MDLxL-TestModels\new-30\creeps__bronzedragon-a20cc34e\bronzedragon.mdx` |
| new-17 | Own | German AT-Rifle | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\GermanATRifle-9e217f7e\GermanATRifle.mdx` |
| new-18 | Donor | Female Death Knight | Blizzard | rider | `D:\Claude\MDLxL-TestModels\new-30\undead__herofemaledeathknight-2cc56a65\herofemaledeathknight.mdx` |
| new-18 | Own | Riderless Horse | Blizzard | four-legged | `D:\Claude\MDLxL-TestModels\new-30\human__knightnorider-675a7c7b\knightnorider.mdx` |
| new-19 | Donor | Red Dragon Whelp | Blizzard | winged | `D:\Claude\MDLxL-TestModels\new-30\creeps__reddragonwelp-05f8e059\reddragonwelp.mdx` |
| new-19 | Own | Italian SMG WWI | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\ItalianSMGWWI-50d24447\ItalianSMGWWI.mdx` |
| new-20 | Donor | Satyr Shadowdancer | Blizzard | biped | `D:\Claude\MDLxL-TestModels\new-30\creeps__satyrtrickster-a06ae66b\satyrtrickster.mdx` |
| new-20 | Own | Reef Elemental | Blizzard | legless | `D:\Claude\MDLxL-TestModels\new-30\creeps__seaelemental-4242b9ad\seaelemental.mdx` |
| new-21 | Donor | Forest Troll Bear Rider | Non-Blizzard | rider | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\ForestTrollBearRider-ba6e8979\ForestTrollBearRider.mdx` |
| new-21 | Own | Dwarf Rifleman | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\Dire_Rifleman-b8290e4d\Dire_Rifleman.mdx` |
| new-22 | Donor | Warsong Clefthoof Drummer | Non-Blizzard | rider | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\Warsong_ClefthoofDrummerV2-1306c08f\Warsong_ClefthoofDrummerV2.mdx` |
| new-22 | Own | Chaos Orc Range | Blizzard | biped | `D:\Claude\MDLxL-TestModels\new-30\demon__chaosorcrange-dd187574\chaosorcrange.mdx` |
| new-23 | Donor | Arkain Man At Arms By General Frank | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\Arkain_ManAtArms-bc559945\Arkain_ManAtArms.mdx` |
| new-23 | Own | French SMG | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\FrenchSMG_Tommy-gun-8de1aad5\FrenchSMG(Tommy-gun).mdx` |
| new-24 | Donor | English SAS Rifleman | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\EnglishSAS_Rifleman-e64b67db\EnglishSAS_Rifleman.mdx` |
| new-24 | Own | Priestessof Death | Non-Blizzard | rider | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\PriestessofDeathV1_04-048d09cc\PriestessofDeathV1.04.mdx` |
| new-25 | Donor | Hero Murlock Purple | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\Hero_MurlockPurple-2703a4e3\Hero_MurlockPurple.mdx` |
| new-25 | Own | Pack Horse | Blizzard | four-legged | `D:\Claude\MDLxL-TestModels\new-30\critters__packhorse-7f35193b\packhorse.mdx` |
| new-26 | Donor | Dire Gnoll Hero | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\DireGnoll-466b1801\DireGnoll.mdx` |
| new-26 | Own | In Land Murloc Spear Man Purple | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\ILP_MurlocSpearman-94e16265\ILP_MurlocSpearman.mdx` |
| new-27 | Donor | Salamander | Blizzard | four-legged | `D:\Claude\MDLxL-TestModels\new-30\creeps__thunderlizardsalamander-7153b197\thunderlizardsalamander.mdx` |
| new-27 | Own | Spirit Wind Rider | Blizzard | winged | `D:\Claude\MDLxL-TestModels\new-30\orc__spiritwyvern-442f88e2\spiritwyvern.mdx` |
| new-28 | Donor | Warsaw Insurgent Officer | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\WarsawInsurgentOfficer-0e2c9eab\WarsawInsurgentOfficer.mdx` |
| new-28 | Own | Pit Lord | Blizzard | four-legged | `D:\Claude\MDLxL-TestModels\new-30\demon__pitlord-73eef75e\pitlord.mdx` |
| new-29 | Donor | Ottoman Cavalry | Non-Blizzard | rider | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\OttomanCavalry_Sword-6ab58e05\OttomanCavalry(Sword).mdx` |
| new-29 | Own | Polish KOP Rifleman | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\PolishKOPRifleman-754a5fa8\PolishKOPRifleman.mdx` |
| new-30 | Donor | Lord Garithos | Blizzard | rider | `D:\Claude\MDLxL-TestModels\new-30\creeps__lordgarithos-c8532f2c\lordgarithos.mdx` |
| new-30 | Own | Australian Sniper | Non-Blizzard | biped | `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\new30\fixtures\AustralianSniper-95362f41\AustralianSniper.mdx` |

### CP10 · Reasonable 50

- Launcher `D:\Claude\MDLxL\TestBuilds\_START HERE\GRADE - XFER reasonable 50.cmd`
- Manifest `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\cases-reasonable50.json` and separate empty answers `D:\Claude\MDLxL\TestBuilds\transfer-xl-35\reasonable50\answers.json`
- [Donor and Own Stand contact sheet](../../out/cp10/donor-own-contact.png), [50 default-view captures](../../out/cp10/), [verification record](../../out/cp10/verification.json).

Captured Stand and Attack for 381 candidates, then checked the selected pictures against joint chains, attachments and held items. The final 100 distinct models include 30 Blizzard SD models from the game CASC and 70 custom models. 33 had no match in the broader local name, geometry or byte index. Compared both directions by aliases and available content against 476 prior pair records and owner examples from 57 files. Excluded the earlier Skeleton Warrior ↔ Footman pairing. The mix is 10 foot melee, 6 polearm or two-hand, 6 ranged, 8 casters, 8 ground riders, 5 flying riders, 7 beasts or legless.

Every selected pair passed the separate skeleton and animation-family check. Compared bone parent links and bind pivots, then compared rotations sampled across Stand, Attack and other clips after normalizing sequence time. The earlier draft contained 34 shared-family matches. The revised list excludes each of them. The per-case comparisons are in the verification record.

Captured every default view using the existing CP8 grading build. All 200 panes loaded and rendered without unresolved or gray textures. Checked Geoset pose on the same camera in all 50 cases, Donor pose unchecked on entry, stored engine suggestions, unchanged geoset vertices and normals with Donor pose off, mouse rotation, and the installed launcher with its empty answers. Prior answer files retained their SHA-256 hashes. Blizzard files and textures were added under `D:\Claude\MDLxL-TestModels\reasonable-50`.

- reasonable-46 changed from Red Dragon → Von Carstein Zombie Dragon to Red Dragon → Wind Rider (Riderless) (Closer flight silhouette and size in the shared default view).
- reasonable-47 changed from Frost Wyrm → Wind Rider (Riderless) to Frost Wyrm → Von Carstein Zombie Dragon (Both are large undead dragons with independently authored skeletons and flight animations).
- Candidate texture staging excluded Knight With Lordaeron Shield, Knight With Footman Shield, Mediumcav, orcdragonrider, orcdragonriderchaos, blackdragonrider, Greenskin Orc2, Greenskin Orc3, Ironforge Ram Rider, Gnome Lindormr Rider Twin Heads Face Alpha Wrap, WH VC Zombie Dragon VCarstein02, Chaos Dragon Skeleton 13.

| # | Donor | Recipient | Body | Role | Size | Why |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | High Elf Footman | Blood Elf Lieutenant | foot biped | sword and shield | man-sized | Both are armored elf infantry who step behind a shield and cut with a one-handed sword. |
| 02 | Bretonnian Swordsman | Royal Soldier | foot biped | sword and shield | man-sized | Both are shield infantry who carry a short sword and attack from the front foot. |
| 03 | Dire Footman | Dismounted Bronzebeard Gryphon Warrior | foot biped | melee one-hand | small | Both dwarves brace a shield and swing a short hammer or mace around it. |
| 04 | Black Knight | Dismounted Knight of the Blazing Sun | foot biped | sword and shield | man-sized | Both are armored foot knights who use a shield and a one-handed blade. |
| 05 | Khorne Berserker | Mountain King | foot biped | melee one-hand | man-sized | Both carry a short weapon in each hand and swing from a wide infantry stance. |
| 06 | Fel Orc Grunt | Gor Axeman | foot biped | melee one-hand | man-sized | Both use a broad stance and a one-handed axe as their main attack. |
| 07 | Footman | Footman Sergeant | foot biped | sword and shield | man-sized | Both are armored footmen with a sword, shield, and broad forward step. |
| 08 | Footman Leader | Elf Death Knight | foot biped | melee one-hand | man-sized | Both are tall armored foot fighters who slash with a long sword in one hand. |
| 09 | Skeletal Orc | Greenskin Orc1 | foot biped | melee one-hand | man-sized | Both have a broad orc stance and swing a single weapon down from the shoulder. |
| 10 | Templar Exemplar | Captain | foot biped | melee one-hand / sword and shield | man-sized | Both are armored shield infantry who deliver a one-handed strike past the shield. |
| 11 | Skink Spearman | Northrend Murloc Spearman | foot biped | polearm/spear | small | Both are small tailed infantry who drive a long spear forward with a planted stride. |
| 12 | Reikland Halberdier | Bretonnian Pikeman | foot biped | polearm/spear | man-sized | Both brace a long polearm across the body and step into a two-handed thrust. |
| 13 | Black Fur Great Knight | Reikland Greatsword | foot biped | melee two-hand | man-sized | Both armored foot fighters swing a long, heavy weapon across the body with two hands. |
| 14 | Hero Tauren Warbeast | Bestigor | foot biped | melee two-hand | large | Both are horned heavy infantry that swing a long-handled axe. |
| 15 | Minotaur | Tauren Chieftain | foot biped | melee two-hand | large | Both are bulky bovine infantry that swing a large axe across the body. |
| 16 | Kroxigor | Tauren | foot biped | melee two-hand | large | Both heavy infantry swing a long, blunt weapon with two hands. |
| 17 | Bretonnian Archer | Night Elf Archer | foot biped | bow/crossbow | man-sized | Both are foot archers who draw a hand bow from a planted stance. |
| 18 | Arbalester | Crossbowman | foot biped | bow/crossbow | man-sized | Both aim a crossbow with two hands and fire directly ahead. |
| 19 | Gnoll Assassin | Bronzebeard Crossbowman | foot biped | bow/crossbow | small | Both are short, stocky crossbow users who shoot from a low stance. |
| 20 | Bronzebeard Rifleman | Dire Rifleman | foot biped | gun | small | Both are dwarf riflemen who raise a long gun to shoot from a braced stance. |
| 21 | Skaven Ratling Gunner | Repeater Handgunner | foot biped | gun | man-sized | Both are foot gunners who brace a heavy multibarrel gun with two hands. |
| 22 | Arquebus Handgunner | Reikland Handgunner | foot biped | gun | man-sized | Both are human handgunners who bring a long gun down out of an upright carry to shoot. |
| 23 | Hero Wizard | Tzeentch Shaman | foot biped | caster with staff | man-sized | Both stand upright and sweep a tall magical staff outward with one hand. |
| 24 | Hero Dwarf Grand Mage | Bronzebeard Priest | foot biped | caster with staff | small | Both are dwarven casters who thrust a short casting rod forward. |
| 25 | Bronzebeard Mage | Skink High Priest | foot biped | caster with staff | small | Both small ground casters extend a glowing staff in one hand. |
| 26 | Hero Murgul Warlock | Northrend Murloc Warlock | foot biped | caster with staff | small | Both small amphibious warlocks bend into a cast with a staff in one hand. |
| 27 | Forest Troll Shadow Priest | Forest Troll High Priest | foot biped | caster with staff | man-sized | Both troll priests reach forward with a short staff from a bent-knee pose. |
| 28 | Fel Orc Warlock | Furion | foot biped | caster with staff | man-sized | Both carry a staff upright in one hand and extend it to cast. |
| 29 | Furbolg Elder Shaman | Wendigo Shaman | foot biped | caster empty-handed | large | Both heavy furred shamans stand and attack with their hands free. |
| 30 | Hero Grey Wizard | Bray Shaman | foot biped | caster with staff | man-sized | Both foot casters extend a long staff from the side into a forward cast. |
| 31 | Orc Warg Rider | Thrall | mounted rider (wolf) | melee one-hand | large | Both wolf riders swing a one-handed hammer beside the mount's shoulder. |
| 32 | Arkain Cavalry Sergeant | French Dragoon Cavalry | mounted rider (horse) | melee one-hand | large | Both cavalrymen make a one-handed saber cut beside a horse's neck. |
| 33 | Swan Knight | Polish Lancer | mounted rider (horse) | polearm/spear | large | Both horse riders level a long lance for a forward strike. |
| 34 | Black Rock Rider | Arthas (mounted, undead) | mounted rider (wolf / horse) | melee one-hand | large | Both riders cut with a long blade from the saddle of a four-legged mount. |
| 35 | Arkain Knight Of Kome | Undivided Chaos Knight | mounted rider (horse) | sword and shield | large | Both heavy cavalry units make a close one-handed sword strike from a shielded horse. |
| 36 | WH WOC Knight Khorne Axe03 | Paladin Horse1.02 | mounted rider (horse) | melee one-hand | large | Both armored riders swing a heavy one-handed weapon in front of the horse's shoulder. |
| 37 | Stolio the Lancer | Tzeentch Lance Knight | mounted rider (horse) | polearm/spear | large | Both heavy cavalry models attack by leveling a lance over a horse's shoulder. |
| 38 | Cold One Rider | Lizardman Raiding Cavalry | mounted rider (reptile) | polearm/spear | large | Both attack with a spear held forward while riding a long-tailed reptile. |
| 39 | Bronzebeard Gryphon Rider | Wind Rider Undead | flying rider (gryphon / wyvern) | one-handed throw (hammer / spear) | large | Both wind up for a one-handed throw while their mounts hover and beat their wings. |
| 40 | Black Legion Gryphon Rider | Apothecary Bat Mount | flying rider (gryphon / bat) | one-handed throw (hammer / flask) | large | Both riders lob a held projectile overhand from the saddle of a winged mount. |
| 41 | Elven Dire Dragonhawk | Warsong Wyvern Rider | flying rider (dragonhawk / wyvern) | polearm/spear | large | Both riders reach forward with a spear while their mounts remain airborne. |
| 42 | Far Seer Wyvern | Hero Gnome Dragonrider | flying rider (wyvern / dragon) | caster with staff | large | Both riders aim a staff forward from a flying reptile's saddle. |
| 43 | Gryphon Rider | Dragonhawk Rider | flying rider (gryphon / dragonhawk) | one-handed aerial ranged attack | large | Both riders bring a one-handed weapon forward for a ranged attack as their mounts bank. |
| 44 | Dire Wolf | Fel Stalker | four-legged beast (wolf-like) | brute/unarmed | large | Both are long-bodied canine beasts that brace on four feet and attack headfirst. |
| 45 | Cold One Riderless | Snap Dragon | four-legged beast (reptile) | brute/unarmed | large | Both long-snouted reptiles plant four legs and thrust their jaws forward. |
| 46 | Red Dragon | Wind Rider (Riderless) | winged beast or dragon | brute/unarmed | large | Both are flying reptiles with a long tail and two wings that attack headfirst. |
| 47 | Frost Wyrm | Von Carstein Zombie Dragon | winged beast or dragon | brute/unarmed | large | Both are undead dragons that fly on skeletal wings and attack forward with their jaws. |
| 48 | Dreadlord | Succubus | winged beast (biped demon) | brute/unarmed | large | Both horned winged demons stand upright and reach forward with a free hand to attack. |
| 49 | Elder Voidwalker | Lava Spawn (Level 1) | legless (elemental) | caster empty-handed | man-sized | Both hover on a legless lower body and cast through a free hand. |
| 50 | Sea Turtle | Lightning Lizard | four-legged beast (armored reptile) | brute/unarmed | large | Both are low, armored reptiles that brace on four feet and attack from the snout. |

### Owner's reasonable-50 grades, grouped by Claude, and CP11 instructions

All 50 graded (`TestBuilds\transfer-xl-35\reasonable50\answers.json`). Mean 5.8: 19 pairs at 9–10, 23 at 5 or below, 12 zeros. The owner:
"There are repeated issues with transplant involving weapon placement, winged units wing motion and some other things. also I still see
warped poses/looks after transplant - this is also unwanted, a transplant should never cause weird body part stretching etc."

Faults, grouped (case numbers are reasonable-NN):
1. **Held weapons, the biggest group (14 pairs).**
   - Two-handed weapon not held by both hands: 12, 16, 20 ("the biggest reoccuring issue so far"). Only 22 works, with Two-hand grip.
   - Bows, crossbows and guns ruined: 17, 18, 19, 20, 21.
   - Weapon floats out of the hand: 13, 15.
   - Wrong rotation, not held like the donor: 16, 25, 28, 33 (angle during Attack).
2. **Winged flyers get no wing motion; total failure (6 pairs, all 0):** 40, 41, 42, 43, 46, 47. The owner: flyer to flyer "should be a
   perfect transfer". 42's recipient even has its own flying animations.
3. **Legs don't move; total failure:** 03 (Dire Footman → Dismounted Gryphon Warrior), 23 (Wizard → Tzeentch Shaman), 30 (Grey Wizard
   → Bray Shaman).
4. **Warping and stretching, never acceptable:**
   - 36: head warped with Donor pose OFF, fixed with it ON, but then the attack arm doesn't move.
   - 50: Sea Turtle → Lightning Lizard, "overly warped and stretched".
   - 49: snappy motion.
   Suspect the CP8 off-mode key conversion on blended vertices first; 36 is the proof case.
5. **Riders:**
   - 38: mount motion leaks into the rider's legs ("if a rider is transplanted into a rider there is no reason for mount motion to go
     to rider legs").
   - 34: the cloak points up; it should take the tail motion.
6. **Suggestion lessons:**
   - Rest pose fit made it worse on 04, 07 and 16, and helped only on 08, where the owner added it himself.
   - Weapon on bones made it worse on 01 and 23.
   - Two-hand grip made it worse on 20 and 27, and helped on 22.

CP11. Work in this order. One checkpoint report at the end:
- **A. Stretching (group 4).** A transplant may never stretch skin beyond what the donor or the model itself does. Measure every pair
  with `D:\Claude\xfer-look\diagnosis\scripts\donorseam.mjs` ("invented" and "beyond donor" tears). Fix the cause in the engine, not as a toggle.
  - Proof: 36 with no head warp and the attack arm moving, with Donor pose off and on; 50 not warped.
- **B. Legs (group 3) and wings (group 2).** Find why the legs and the wings receive no motion on 03/23/30 and 40–47. Fix them in the
  engine. Flyer to flyer and biped to biped must move like the donor.
  - Proof: leg and wing travel against the donor in Walk/Stand/Attack for every listed pair.
- **C. Weapons (group 1).** Two-handed, bow, crossbow and gun grips: the weapon sits in the same hand(s) as on the donor, at the donor's angle,
  through Attack. Floating weapons: the grip stays on the palm.
  - Reuse Seat loose grip and Two-hand grip where they already work.
  - Proof: grip-to-palm distance and weapon angle against the donor for 12, 13, 15–21, 25, 28 and 33.
- **D. Riders.** On 38, the rider's legs keep the donor rider's leg motion and never take the mount's. On 34, a cloak with no donor cloak takes
  the donor's tail motion.
- **E. Suggester.** Stop auto-suggesting Rest pose fit and Weapon on bones; they stay as toggles. Suggest Two-hand grip only when both
  donor and model hold one item with two hands.
- **F. No losses on the 19 pairs graded 9–10.** With the default ticks, show each one Before/After in screenshots. Name every one that
  changes visibly, and say why.
- **Then** rebuild `transfer-xl-35`. Make a sheet `cases-fix11.json` with every pair graded 6 or below plus 5 of the 10s, and the launcher `GRADE - XFER fixes 11.cmd`.
  Prove it with hidden screenshots in `out/cp11/`. Report as `### CP11 · …`. Stop with `CHECKPOINT 11 READY`.
- Budget: if one group fails twice, write down what was measured and move to the next group. Do not loop.

### CP11 · Reasonable-50 transfer fixes and owner review

The offline fixes sheet is ready for grading. The case-34 cloak and suggestion eligibility improved. The final build still has measured stretching, limb, weapon and rider failures, including a lost wingbeat on grade-10 case 39. Invented torn edges fell from 1,346 to 995 across the 50 pairs, while edges that stretched beyond the donor rose from 90 to 118. The owner’s 50 original grades supplied the selection.

#### A. Stretching

The donor seam script measured all 50 CP10 results and all 50 packaged-engine results at their respective sheet defaults. The adapter only redirected its retired source-import directory. Each result used the same recipient and the donor reflected as specified in the manifest. An edge enters the torn list when its stretch exceeds 1.5× the recipient’s own observed maximum. The script compares matching donor seams at 1.25× tolerance. The scan counts each flagged edge once.

| Scan | Edges examined | Torn | Donor-like | Beyond donor | Invented rigid | Invented seam | Kept node | Same-node scale |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| CP10 | 81565 | 2184 | 113 | 90 | 896 | 450 | 582 | 53 |
| CP11 | 81565 | 1693 | 137 | 118 | 600 | 395 | 362 | 81 |

| Pair | Donor pose | Torn before → after | Beyond donor | Invented |
|---|---|---:|---:|---:|
| 36 | Off | 183 → 17 | 0 → 1 | 4 → 3 |
| 36 | On | 4 → 17 | 0 → 1 | 4 → 3 |
| 50 | Off | 71 → 58 | 28 → 28 | 31 → 18 |
| 50 | On | 43 → 41 | 7 → 7 | 8 → 6 |

- **36, Donor pose off.** In Attack - 1, hammer-hand excursion changed from 0.00× to 0.98× donor. Peak rider-head edge stretch changed from 34.45× to 1.80× native length. 3 of 346 head edges still exceeded 1.5×.
- **36, Donor pose on.** In Attack - 1, hammer-hand excursion changed from 0.00× to 0.98× donor. Peak rider-head edge stretch changed from 1.00× to 1.80× native length. 3 of 346 head edges still exceeded 1.5×.
- **50.** Separately hinged front and rear supports can keep their original trunk pivots. This reduced invented tearing in the focused trial. The residual seams above still fail the no-warp criterion. **49.** Both hand trajectories matched CP10 at 1 ms and 60 Hz in the same-tick comparison. The reported snap remained. [motion-current-checked-49-44.json](../../out/cp11/motion-current-checked-49-44.json)

Case 36 had selected the mount while losing the separately rooted rider. Recovering the walking body restored the rider’s arm with both Donor pose settings. The blended head edges and case 50 still stretch. [seams-old-all.jsonl](../../out/cp11/seams-old-all.jsonl) · [seams-final-all.jsonl](../../out/cp11/seams-final-all.jsonl) · [seams-final-focus.jsonl](../../out/cp11/seams-final-focus.jsonl)

#### B. Legs and wings

The missing foot chains use abbreviated left/right names. Several flyer wings were read as arms or omitted. The engine now recognizes bilateral joint chains with matching sockets and motion, and maps coincident wing-finger joints to their donor tip. Each cell gives visible distal skin excursion divided by the donor’s excursion at 25 matched phases, normalized by the corresponding limb length. 1.00 is equal travel. The two or four numbers follow the landmark order in the linked JSON. A dash marks a missing counterpart or negligible donor motion.

| Pair | Walk | Stand | Attack |
|---|---|---|---|
| 03 Dire Footman → Dismounted Bronzebeard Gryphon Warrior | 1.05 / 0.79 | 0.52 / 0.41 | 0.49 / 1.01 |
| 23 Hero Wizard → Tzeentch Shaman | 1.36 / 1.20 | 3.03 / 1.60 | 0.72 / 0.85 |
| 30 Hero Grey Wizard → Bray Shaman | 1.04 / 0.98 | 2.01 / 1.02 | 0.50 / 0.99 |
| 40 Black Legion Gryphon Rider → Apothecary Bat Mount | 0.87 / 0.88 | 0.97 / 1.01 | 0.91 / 0.94 |
| 41 Elven Dire Dragonhawk → Warsong Wyvern Rider | 1.08 / 1.11 | 1.15 / 1.21 | 1.03 / 1.08 |
| 42 Far Seer Wyvern → Hero Gnome Dragonrider | 0.85 / 0.66 | 0.86 / 0.52 | 0.79 / 1.29 |
| 43 Gryphon Rider → Dragonhawk Rider | 1.25 / 1.15 | 1.35 / 1.34 | 1.18 / 1.14 |
| 44 Dire Wolf → Fel Stalker | 1.18 / 0.85 / 1.22 / 1.00 | 2.11 / 1.65 / 2.00 / 0.99 | 1.22 / 4.57 / 3.86 / 1.86 |
| 45 Cold One Riderless → Snap Dragon | 1.04 / 0.74 / — / — | 1.01 / 0.78 / — / — | 1.44 / 1.00 / — / — |
| 46 Red Dragon → Wind Rider (Riderless) | 0.96 / 0.93 | 0.94 / 0.91 | 0.95 / 0.92 |
| 47 Frost Wyrm → Von Carstein Zombie Dragon | 1.21 / 1.22 | 1.52 / 1.48 | 1.52 / 1.48 |

The original left/right Walk excursions on 03, 23 and 30 were respectively 0.18× / 0.40×, zero / zero and 0.20× / 0.20× donor. All three gained Walk travel. Several Stand and Attack excursions still diverge from the donor. Case 45 has no matching donor forefeet for two recipient landmarks. The second wing trial improved case 47’s phase error across all three clips, while travel still overshot in Stand and Attack. All sampled clip variants and per-phase donor and result trajectories are in [motion-f2-suggested-all.json](../../out/cp11/motion-f2-suggested-all.json). The original trajectories are in [motion-baseline-checked-all.json](../../out/cp11/motion-baseline-checked-all.json).

#### C. Weapons

Fixed grip-to-palm distances are measured in model units on the same skinned material patches through Attack. The table reports median / peak. A dash denotes a hand without a tracked grip patch. The directed shaft angle compares the result with the donor at matched phases, in degrees. Bow 17 uses the unsigned shaft angle because either bow-axis endpoint defines the same orientation. Shaft-to-hand distances, native controls, sampled coordinates and accessory selections accompany the table.

| Pair | Frames | Donor R grip | Result R grip | Donor L grip | Result L grip | Weapon angle error |
|---|---:|---:|---:|---:|---:|---:|
| 12 Reikland Halberdier → Bretonnian Pikeman | 82 | 11.8 / 25.7 | 45.9 / 54.1 | 17.6 / 33.3 | 56.3 / 65.1 | 29.4 / 29.4 |
| 13 Black Fur Great Knight → Reikland Greatsword | 89 | 34.7 / 54.2 | 16.4 / 18.8 | 24.5 / 42.0 | 65.3 / 103.3 | 4.0 / 8.5 |
| 15 Minotaur → Tauren Chieftain | 98 | 90.3 / 155.6 | 114.6 / 288.7 | 28.1 / 44.8 | 36.9 / 40.4 | 7.0 / 15.8 |
| 16 Kroxigor → Tauren | 178 | 27.1 / 63.5 | 86.2 / 86.4 | 112.6 / 122.1 | 82.6 / 115.7 | 114.9 / 178.0 |
| 17 Bretonnian Archer → Night Elf Archer | 41 | 8.6 / 9.1 | — | — | 7.8 / 7.8 | 48.0 / 86.4 |
| 18 Arbalester → Crossbowman | 126 | 60.5 / 74.0 | 66.8 / 88.5 | 10.9 / 33.7 | 15.3 / 15.6 | 72.7 / 80.6 |
| 19 Gnoll Assassin → Bronzebeard Crossbowman | 61 | 7.7 / 10.5 | 5.2 / 5.2 | 12.3 / 18.0 | 50.8 / 53.8 | 103.6 / 108.5 |
| 20 Bronzebeard Rifleman → Dire Rifleman | 36 | 7.4 / 12.2 | 5.9 / 10.2 | 15.5 / 16.8 | 34.9 / 37.0 | 61.1 / 61.1 |
| 21 Skaven Ratling Gunner → Repeater Handgunner | 95 | 1.2 / 3.2 | 43.8 / 68.1 | 18.0 / 28.5 | 3.9 / 3.9 | 151.0 / 166.3 |
| 22 Arquebus Handgunner → Reikland Handgunner | 47 | 1.7 / 2.2 | 4.5 / 7.2 | 13.2 / 14.0 | 11.8 / 16.7 | 29.3 / 29.3 |
| 25 Bronzebeard Mage → Skink High Priest | 44 | — | 7.1 / 13.7 | 7.9 / 7.9 | — | 32.9 / 81.9 |
| 28 Fel Orc Warlock → Furion | 44 | 26.7 / 29.3 | 40.5 / 40.5 | — | 164.6 / 176.9 | 67.6 / 70.2 |
| 33 Swan Knight → Polish Lancer | 45 | 24.1 / 25.1 | 55.6 / 57.4 | — | — | 38.6 / 38.6 |

The first repair reattached the marked rigid item in 13 and improved its Attack angle. The broader second repair made 19’s crossbow face about 172° from its donor and worsened individual palm contacts in 15–18 and 21. The retained repair requires a marked weapon on both models and a material grip farther than a full arm’s reach from either palm for most of the clip. It reuses the existing support-hand solver for proven two-handed contact. With final defaults and a serialized MDX round trip, 13’s median angle improved from 87.5° to 4.0°. The result’s left-hand fixed grip still peaked at 103.3 units. Case 20’s right median grip improved from 64.2 to 5.9 units, but its median angle error rose from 43.6° to 61.1°. The broad trial’s near-reversal on 19 did not ship. Several grips and angles above remain wrong. [grip-trial1-comparison.txt](../../out/cp11/grip-trial1-comparison.txt) · [grip-trial2-comparison.txt](../../out/cp11/grip-trial2-comparison.txt) · [grip-final-all.json](../../out/cp11/grip-final-all.json)

#### D. Riders

**38 is not recovered in the final package.** The first rider trial isolated the seated waist and weighted boot, improving Walk rider-relative foot travel from 0.00× / 4.13× to 0.85× / 0.75× donor, with hind mount feet remaining at 0.66× / 0.91×. The later restriction used to preserve the accepted cavalry pair on 35 removed this gain. In the packaged result both rider-local feet have effectively zero travel in Walk and Attack. Relative to the mount they still travel 0.47× / 0.23× donor in Walk, showing that mount movement cannot serve as proof of independent rider motion. Both old ticks and final ticks reproduce this failure. Case 34 sends the donor tail’s motion to the recipient’s chest-mounted cloak when the donor has no cloak. Its initially still cloak reached 0.99× / 0.84× / 0.86× donor tail travel in Stand / Walk / Attack. [motion-dtrial1-checked-34-38.json](../../out/cp11/motion-dtrial1-checked-34-38.json)

#### E. Suggested toggles

Rest pose fit and Weapon on bones remain available for manual use and are excluded from default suggestions. Two-hand grip requires both models to show two distinct palm contacts on the same visible rigid item. All 50 suggestions were recomputed with the original transplant options. Rest pose fit is visible on 45 and suggested on zero. Weapon on bones is visible on seven and suggested on zero. Two-hand grip is visible on 11 and suggested only on 22, where both models qualify. Cases 20 and 27 leave it off. [suggestions.json](../../out/cp11/suggestions.json)

#### F. The 19 grades of 9–10

**No-loss criterion failed on 39.** The wing changes on this grade-10 gryphon/wyvern pair persist even when the old repair ticks are restored. The repaired reader recognizes the recipient’s wings, while the donor still has no corresponding wing pair in its transfer rig. Left/right excursion changed from 1.14× / 1.14× donor to 0.07× / 0.00× in Walk, from 1.31× / 1.34× to 0.07× / 0.00× in Stand, and from 1.17× / 1.13× to 0.05× / 0.00× in Attack. Both high-grade attempts left that loss. [CP10 measurements](../../out/cp11/motion-baseline-checked-39.json) · [CP11 measurements](../../out/cp11/motion-f2-suggested-39.json)

Each image pairs the CP10 and CP11 packaged After panes at identical default and Attack frames, with the actual default ticks of each build. Twelve pairs have identical exported MDX bytes **and** zero changed model pixels in both captures. For the six changes caused only by new defaults, the CP11 engine still exports the exact CP10 MDX with the old ticks. The owner had manually adjusted some ticks while grading. This comparison uses the defaults as requested. [Frame and pixel measurements](../../out/cp11/before-after/comparison.json) · [Three-way export hashes, repair ticks and grades](../../out/cp11/high-three-way-mdx.json)

| Pair | Visible result and cause |
|---|---|
| [01 High Elf Footman → Blood Elf Lieutenant](../../out/cp11/before-after/reasonable-01.png) | The sword and shield shift slightly relative to the hand. Weapon on bones drops out of the defaults, matching the owner’s grading selection. |
| [02 Bretonnian Swordsman → Royal Soldier](../../out/cp11/before-after/reasonable-02.png) | Identical MDX and both frames. |
| [04 Black Knight → Dismounted Knight of the Blazing Sun](../../out/cp11/before-after/reasonable-04.png) | The shield sits lower and the sword extends farther in Walk. Rest pose fit drops out, as the owner requested. |
| [05 Khorne Berserker → Mountain King](../../out/cp11/before-after/reasonable-05.png) | Identical MDX and both frames. |
| [06 Fel Orc Grunt → Gor Axeman](../../out/cp11/before-after/reasonable-06.png) | Identical MDX and both frames. |
| [07 Footman → Footman Sergeant](../../out/cp11/before-after/reasonable-07.png) | The shield changes angle behind the shoulder and the sword sits flatter in Attack. Rest pose fit drops out. The owner’s comment grades this pair 10 with it off. |
| [08 Footman Leader → Elf Death Knight](../../out/cp11/before-after/reasonable-08.png) | Identical MDX and both frames. |
| [09 Skeletal Orc → Greenskin Orc1](../../out/cp11/before-after/reasonable-09.png) | Identical MDX and both frames. |
| [11 Skink Spearman → Northrend Murloc Spearman](../../out/cp11/before-after/reasonable-11.png) | Identical MDX and both frames. |
| [14 Hero Tauren Warbeast → Bestigor](../../out/cp11/before-after/reasonable-14.png) | Identical MDX and both frames. |
| [24 Hero Dwarf Grand Mage → Bronzebeard Priest](../../out/cp11/before-after/reasonable-24.png) | Identical MDX and both frames. |
| [26 Hero Murgul Warlock → Northrend Murloc Warlock](../../out/cp11/before-after/reasonable-26.png) | The warlock’s torso and arms sit higher and the weapon line changes. The owner graded this pair with Rest pose fit on. The new default leaves it off, and this changed pose awaits owner grading. |
| [27 Forest Troll Shadow Priest → Forest Troll High Priest](../../out/cp11/before-after/reasonable-27.png) | The staff crosses the torso in Walk and lies diagonally in Attack. Weapon on bones and Two-hand grip both drop out. The owner flagged Two-hand grip on this pair. |
| [29 Furbolg Elder Shaman → Wendigo Shaman](../../out/cp11/before-after/reasonable-29.png) | Identical MDX and both frames. |
| [31 Orc Warg Rider → Thrall](../../out/cp11/before-after/reasonable-31.png) | Identical MDX and both frames. |
| [32 Arkain Cavalry Sergeant → French Dragoon Cavalry](../../out/cp11/before-after/reasonable-32.png) | The rider’s raised arm and blade change angle in Walk and Attack. The owner graded with Rest pose fit and Hanging parts. Only Hanging parts remains on by default. |
| [35 Arkain Knight Of Kome → Undivided Chaos Knight](../../out/cp11/before-after/reasonable-35.png) | Identical MDX and both frames. |
| [39 Bronzebeard Gryphon Rider → Wind Rider Undead](../../out/cp11/before-after/reasonable-39.png) | The wings lie low and one side stops flapping. The engine change is measurable with both sets of repair ticks. The new suggested ticks are Hanging parts and Keep own torso. |
| [44 Dire Wolf → Fel Stalker](../../out/cp11/before-after/reasonable-44.png) | Identical MDX and both frames. |

The first high-grade pass also found case 44’s trunk pivots displaced by 8.58 and 13.35 model units. Limiting the correction to builds with separate articulated support parents restored the entire grade-10 result. The final pass also restored the original engine outputs on 06, 07, 09, 32 and 35 at their old ticks. Default-tick changes on 07 and 32 are listed above. [Case 44 pivot audit](../../out/cp11/motion-44-source-route.json)

#### Offline fixes sheet

Rebuilt and verified 1,684 package runtime and asset files and 55 locales. The installed engine and renderer matched all 1,547 staged source and distribution files. The owner’s original answers retain SHA-256 `bdbc84a7b26dbaee6a91497746178717c7a9a67fa669bd2f761e6caf42a18a63`. The packaged grade sheet opened on 1 / 31 with Donor, Own, Before and After. Its 26 pairs graded 0–6 are followed by five grade-10 controls (02, 08, 27, 39 and 44). The 31 grading checks wrote to a separate scratch answers file. The new owner answer file starts empty.

- Launcher [GRADE - XFER fixes 11.cmd](<D:/Claude/MDLxL/TestBuilds/_START HERE/GRADE - XFER fixes 11.cmd>).
- Manifest [cases-fix11.json](D:/Claude/MDLxL/TestBuilds/transfer-xl-35/cases-fix11.json).
- Hidden packaged screenshots for all 31 pairs [fixes/](../../out/cp11/fixes/) and [fixes-launcher.png](../../out/cp11/fixes-launcher.png). A normal mouse drag rotated all four linked cameras by 66.69° on the first pair. [fixes/captures.json](../../out/cp11/fixes/captures.json) · [package-verification.json](../../out/cp11/package-verification.json)

Targeted source verification covered 280 tests. The first pass returned 265 passes and 15 failures. Eleven of those failures also occurred on the exact CP10 source and recurred in the final targeted run (P9, P2, P4, T6, T12, WS4, Q3, V2, V3, HG1 and detached pipe). The four new failures (P1, G1, Q2 and FB1 Grunt/Murloc) all passed on the final source. These counts reuse the original passing checks. The full suite, Warcraft III gameplay and a fresh owner grade were outside this checkpoint. [Targeted results](../../out/cp11/targeted-tests.log) · [Baseline replay](../../out/cp11/old-failing-replay.log) · [Final focused reruns](../../out/cp11/cp11-specific-trial2.log) · [Final existing failures](../../out/cp11/final-known-failures.log)

### CP11 review (Claude) · FIX one regression before the owner grades

Accepted: legs on 03/23/30, wings on 40–47, the head stretch on 36 (34.45× → 1.80×), the cloak on 34, the suggestion changes, and the honest record of
what still fails (weapons, rider legs on 38, stretch on 50).

**Not acceptable: grade-10 case 39 lost its wingbeat** (Walk 1.14×/1.14× → 0.07×/0.00× donor). CP11b, then stop:
1. When the new reader finds wings on the model but the donor has no matching wing pair, the model's wings take exactly the CP10 path.
   Case 39 must be byte-identical to its CP10 export at its old ticks, and its wing travel must return to about 1.1× in Walk/Stand/Attack.
2. Re-measure wing travel on 40–47 to prove the gain is kept.
3. Rebuild `transfer-xl-35` and regenerate the `cases-fix11.json` suggestions. Replace the 39 screenshots in `out/cp11/`.
   Stop with `CHECKPOINT 11b READY — <this file>`.

Weapons (group C) get their own checkpoint after the owner grades this sheet. Do not start them now.

### CP11b · Grade-10 gryphon wingbeat restored

Case 39 again produces the exact CP10 export with **Keep donor motion** checked. Both files are 352,223 bytes and have SHA-256 `dbf7c7fa47cdc0579c03f81dc793207dc8de8d5ede2cb0cc80f65f9a1c8f669a`. The regenerated grading sheet also selects Keep donor motion. [Export and donor-switch checks](../../out/cp11b/wing39-export-proof.json)

When the recipient’s extra wing recognition finds a pair and the donor lacks a matching pair, the transplant uses the original recipient wing reading. Selecting a donor with matching wings on that same recipient still gives the CP11 export. Switching back restores the CP10 bytes.

The table gives visible skin travel divided by donor travel. Case 39 matched CP10 at every sampled phase. Cases 40–47 matched the accepted CP11 trajectories and travel ratios at all 25 phases across each clip. Cases 44 and 45 are four-legged controls. Dashes mark unmatched landmarks. The check covered 57 clip records. [Per-clip comparison](../../out/cp11b/wing-motion-comparison.json)

| Pair | Walk | Stand | Attack |
|---|---|---|---|
| 39 Bronzebeard Gryphon Rider → Wind Rider Undead | 1.13 / 1.14 | 1.30 / 1.34 | 1.17 / 1.13 |
| 40 Black Legion Gryphon Rider → Apothecary Bat Mount | 0.87 / 0.88 | 0.97 / 1.01 | 0.91 / 0.94 |
| 41 Elven Dire Dragonhawk → Warsong Wyvern Rider | 1.08 / 1.11 | 1.15 / 1.21 | 1.03 / 1.08 |
| 42 Far Seer Wyvern → Hero Gnome Dragonrider | 0.85 / 0.66 | 0.86 / 0.52 | 0.79 / 1.29 |
| 43 Gryphon Rider → Dragonhawk Rider | 1.25 / 1.15 | 1.35 / 1.34 | 1.18 / 1.14 |
| 44 Dire Wolf → Fel Stalker | 1.18 / 0.85 / 1.22 / 1.00 | 2.11 / 1.65 / 2.00 / 0.99 | 1.22 / 4.57 / 3.86 / 1.86 |
| 45 Cold One Riderless → Snap Dragon | 1.04 / 0.74 / — / — | 1.01 / 0.78 / — / — | 1.44 / 1.00 / — / — |
| 46 Red Dragon → Wind Rider (Riderless) | 0.96 / 0.93 | 0.94 / 0.91 | 0.95 / 0.92 |
| 47 Frost Wyrm → Von Carstein Zombie Dragon | 1.21 / 1.22 | 1.52 / 1.48 | 1.52 / 1.48 |

The offline package build verified 1,684 runtime and asset files and 55 locales. All 1,547 installed engine and renderer files matched the staged build. All 31 fixes-sheet suggestions were recomputed with their original options. Only case 39’s default ticks changed. The owner’s answers and case order were preserved. All 18 targeted wing and mounted tests passed. Verification covered the model engine and the packaged viewer. Warcraft III gameplay was not exercised. [Package verification](../../out/cp11b/package-verification.json) · [Sheet verification](../../out/cp11b/sheet-verification.json) · [Focused tests](../../out/cp11b/wing-mounted-tests.log)

The hidden packaged run reopened case 39 with its regenerated defaults. The Walk (334 ms) and Attack (834 ms) model panes matched the CP10 captures pixel for pixel. The comparison and grading screenshots below replace the CP11 captures for this pair. [Before and after](../../out/cp11/before-after/reasonable-39.png) · [Grading sheet, Walk](../../out/cp11/fixes/reasonable-39-default.png) · [Grading sheet, Attack](../../out/cp11/fixes/reasonable-39-attack.png) · [Capture verification](../../out/cp11b/screenshot-verification.json)

### CP11b review (Claude) · GO, the fixes sheet is ready for the owner

Case 39 exports byte-identical to CP10 at its old ticks, its panes match CP10 pixel for pixel, and 40–47 keep their wing gains. Claude
spot-checked fixes captures 03, 23, 41, 47, 13 and 39: all four views are textured, with the repair row in place. Codex: wait for the owner's
grades on `GRADE - XFER fixes 11.cmd`. Weapons are the next checkpoint after that.

### CP12 · Seat weapon like donor

The new checkbox places the recipient’s stored weapon vertices at the donor’s grip orientation after Mirror. It rotates the normals and binds the selected weapon pieces at full weight to the copied main hand. The measured grip is the closest point on a visible Stand triangle to the palm. A matching wrist helper can become a bone at its existing ID and pivot. The report records the donor’s hand-space axis, face, contact point, and the secondary palm’s distance where it finds support. The rigid move keeps the recipient weapon’s size.

Both transfer views use the label **Seat weapon like donor** and the tooltip “Moves this model's weapon in its geoset pose so it sits in the hand like the donor's weapon.” Both pieces must be recognized for the suggestion. Rest pose fit, Weapon on bones and the older grip controls remain available. The previous automatic Attack and grip-travel passes were removed. The independent bow palm-switch pass now runs only through the manual Two-hand grip checkbox.

**Result for owner grading.** All 19 rows suggest the new checkbox. The complete under-15° angle gate passed on 5/19 pairs (04, 15, 22, 27, 33). Case 06 was below 15° on all visible samples, with one unavailable Walk sample. At least one measured angle reached 15° on each of 01, 02, 05, 12, 13, 16, 17, 18, 19, 20, 21, 25, 28. Primary grip median improved on 15/19 in Attack and 15/19 in Walk. Case 18’s primary grip stayed within 0.1 model unit, while its angle error peaked at 121.1° in Attack and 141.1° in Walk. Case 25’s staff pointed almost opposite the donor at 179.3°. Case 15’s support palm reached a 202.9-unit gap during Attack, where the donor’s own support gap peaked at 160.3 units.

The initial implementation seated 11 of the 19, selected case 04’s shield hand and omitted case 02’s hilt. Correcting the piece boundary, the hand selection and the transverse crossbow measurement seated all 19. Case 05 now seats two weapons. Texture inspection identified a loaded arrow on the same bone as case 18’s stock and a separate bolt on case 19. Both keep their original bindings. Remaining angle and support misses are recorded for grading. [First comparison](../../out/cp12/grip-pass1-summary.txt)

The independent mesh check compared serialized and reopened outputs with only seatWeapon changed. All 1,497 changed positions belong to the audited weapons. No body skin moved in 481,915 sampled vertex moments. All 73 audited ammunition vertices kept their positions and weights, and every selected weapon vertex ended on one hand. Across 2,725 weapon edges, the largest relative difference from native length was 2.71e-6. Animation tracks, pivots and hierarchy matched. [Mesh and binding audit](../../out/cp12/mesh-isolation-final-summary.json)

Distances below are model units. Each cell reports median / maximum. The first condition has seating off, the second on, with every other sheet default held constant. The independent check followed fixed barycentric grip points from each native model’s first Stand. It sampled every Attack and Walk sequence at intervals of at most about 25 ms, with at least 21 phases per clip. The angle is directed away from the grip for shafts with a distinct far end. Symmetric shafts and bows use their unsigned angle, explicitly marked. Support distance uses the finite shaft segment. Donor and recipient measurements retain their original scales. [Full method and Stand results](../../out/cp12/grip-final.md) · [Per-sample measurements](../../out/cp12/grip-final.json)

#### Attack

| Pair | Donor → native primary | Axis samples | Axis off → on | Gate on | Primary off → on | Primary donor / native | Support shaft off → on | Support donor / native |
|---|---|---:|---|---|---|---|---|---|
| 01 | L → L | 200 / 200 of 200 | 0.4 / 1.8° → 1.0 / 27.8° | fails | 1.2 / 2.2 → 2.0 / 2.0 | 4.3 / 5.3 · 1.4 / 1.4 | — | — |
| 02 | R → R | 123 / 123 of 123 | 35.8 / 101.2° → 26.2 / 68.5° | fails | 1.9 / 2.3 → 1.1 / 1.6 | 8.1 / 14.0 · 1.7 / 2.0 | — | — |
| 04 | L → L | 200 / 200 of 200 | 7.0 / 35.5° → 9.2 / 11.5° | passes | 4.1 / 5.1 → 0.9 / 2.9 | 1.1 / 1.7 · 1.9 / 2.4 | — | — |
| 05 left axe | L → L | 82 / 82 of 82 | 19.3 / 32.8° → 37.9 / 50.3° | fails | 1.7 / 2.0 → 0.5 / 0.6 | 2.0 / 2.0 · 1.8 / 2.9 | — | — |
| 05 right axe | R → R | 82 / 82 of 82 | 10.5 / 46.2° → 23.5 / 48.1° (symmetric) | fails | 2.1 / 2.4 → 0.8 / 1.0 | 3.9 / 4.1 · 2.2 / 2.8 | — | — |
| 06 | L → R | 80 / 80 of 80 | 65.2 / 155.6° → 5.3 / 5.3° | passes | 65.4 / 92.6 → 7.0 / 9.6 | 3.9 / 3.9 · 5.1 / 18.7 | — | — |
| 12 | R → R | 82 / 82 of 82 | 29.4 / 29.4° → 1.4 / 16.7° | fails | 4.4 / 7.5 → 0.0 / 0.0 | 4.0 / 12.9 · 34.8 / 41.5 | 23.5 / 37.4 → 8.7 / 16.3 | 5.4 / 11.4 · 2.5 / 8.5 |
| 13 | R → R | 89 / 89 of 89 | 84.5 / 93.8° → 23.3 / 82.4° | fails | 134.2 / 158.8 → 0.1 / 0.2 | 29.7 / 49.1 · 6.1 / 23.1 | 170.1 / 188.7 → 15.1 / 53.7 | 9.7 / 17.6 · 11.0 / 30.4 |
| 15 | L → R | 98 / 98 of 98 | 70.3 / 89.5° → 1.7 / 1.7° (symmetric) | passes | 107.9 / 188.0 → 0.7 / 1.8 | 17.3 / 46.9 · 11.6 / 41.4 | 47.0 / 190.8 → 41.6 / 202.9 | 31.0 / 160.3 · 16.1 / 26.8 |
| 16 | R → R | 178 / 178 of 178 | 65.5 / 134.1° → 4.3 / 30.5° | fails | 9.2 / 11.6 → 0.0 / 0.0 | 4.8 / 56.6 · 38.2 / 76.9 | 48.3 / 80.1 → 16.5 / 40.4 | 9.4 / 26.5 · 26.4 / 88.5 |
| 17 | R → L | 41 / 41 of 41 | 48.0 / 86.4° → 0.8 / 0.8° (bow) | passes | 52.9 / 74.1 → 4.0 / 4.0 | 2.4 / 3.3 · 2.9 / 2.9 | — | — |
| 18 | R → R | 126 / 126 of 126 | 120.4 / 176.0° → 109.6 / 121.1° | fails | 42.5 / 67.2 → 0.0 / 0.0 | 10.6 / 34.2 · 7.9 / 11.7 | 37.8 / 37.8 → 42.3 / 50.6 | 10.0 / 19.9 · 2.0 / 4.1 |
| 19 | L → R | 61 / 61 of 61 | 103.6 / 108.5° → 17.7 / 54.0° | fails | 17.0 / 22.6 → 5.2 / 5.2 | 11.2 / 18.1 · 7.4 / 11.6 | 6.4 / 6.4 → 16.1 / 22.3 | 9.4 / 12.4 · 8.9 / 12.7 |
| 20 | R → R | 36 / 36 of 36 | 61.1 / 61.1° → 5.9 / 12.3° | passes | 3.4 / 5.5 → 1.9 / 1.9 | 7.4 / 11.6 · 3.8 / 7.4 | 30.4 / 33.8 → 13.0 / 16.8 | 4.3 / 7.1 · 66.8 / 88.0 |
| 21 | R → R | 95 / 95 of 95 | 151.0 / 166.3° → 18.8 / 19.2° | fails | 46.7 / 72.0 → 1.4 / 2.3 | 8.8 / 10.2 · 2.3 / 2.9 | 9.1 / 9.1 → 13.0 / 25.1 | 20.2 / 23.6 · 9.4 / 10.6 |
| 22 | R → R | 47 / 47 of 47 | 62.4 / 62.4° → 9.2 / 10.6° | passes | 3.0 / 5.2 → 4.1 / 4.1 | 1.7 / 2.2 · 4.8 / 5.7 | 12.4 / 20.5 → 13.1 / 14.3 | 7.3 / 7.8 · 5.0 / 5.6 |
| 25 | L → R | 44 / 44 of 44 | 148.7 / 179.5° → 179.3 / 179.3° | fails | 44.4 / 72.0 → 24.5 / 26.4 | 1.0 / 1.0 · 5.1 / 8.7 | — | — |
| 27 | R → R | 50 / 50 of 50 | 115.1 / 115.1° → 6.5 / 6.5° | passes | 3.9 / 3.9 → 6.5 / 6.5 | 1.4 / 1.4 · 3.9 / 3.9 | — | — |
| 28 | R → R | 44 / 44 of 44 | 112.5 / 116.5° → 30.8 / 48.1° | fails | 2.0 / 2.0 → 9.4 / 9.4 | 4.4 / 6.8 · 2.0 / 22.4 | — | — |
| 33 | R → R | 45 / 45 of 45 | 38.6 / 38.6° → 1.5 / 1.5° | passes | 7.1 / 11.4 → 3.3 / 4.3 | 1.2 / 1.4 · 6.3 / 7.2 | — | — |

#### Walk

| Pair | Donor → native primary | Axis samples | Axis off → on | Gate on | Primary off → on | Primary donor / native | Support shaft off → on | Support donor / native |
|---|---|---:|---|---|---|---|---|---|
| 01 | L → L | 56 / 56 of 56 | 0.4 / 0.4° → 1.0 / 1.0° | passes | 1.2 / 1.2 → 2.0 / 2.0 | 4.2 / 4.2 · 1.4 / 1.4 | — | — |
| 02 | R → R | 84 / 84 of 84 | 45.5 / 54.7° → 44.0 / 44.0° | fails | 2.1 / 2.1 → 1.1 / 1.1 | 6.5 / 11.9 · 1.8 / 1.8 | — | — |
| 04 | L → L | 56 / 56 of 56 | 7.0 / 7.0° → 9.2 / 9.2° | passes | 4.9 / 4.9 → 0.1 / 0.5 | 1.0 / 1.0 · 1.9 / 2.0 | — | — |
| 05 left axe | L → L | 33 / 33 of 33 | 10.8 / 13.6° → 40.4 / 40.4° | fails | 1.6 / 1.7 → 0.5 / 0.6 | 2.2 / 2.3 · 1.7 / 1.7 | — | — |
| 05 right axe | R → R | 33 / 33 of 33 | 10.5 / 10.7° → 23.5 / 23.6° (symmetric) | fails | 2.3 / 2.4 → 0.7 / 0.7 | 1.4 / 1.4 · 2.6 / 2.6 | — | — |
| 06 | L → R | 27 / 27 of 28 | 39.9 / 101.5° → 4.2 / 4.2° | partial | 66.3 / 77.3 → 5.3 / 5.5 | 3.8 / 3.8 · 5.4 / 7.8 | — | — |
| 12 | R → R | 33 / 33 of 33 | 29.4 / 29.4° → 1.4 / 1.4° | passes | 1.1 / 1.1 → 0.0 / 0.0 | 2.1 / 2.1 · 3.0 / 3.0 | 27.7 / 28.2 → 7.1 / 8.1 | 2.7 / 4.5 · 3.9 / 5.0 |
| 13 | R → R | 32 / 32 of 32 | 92.5 / 92.5° → 0.4 / 0.6° | passes | 106.3 / 106.3 → 0.1 / 0.1 | 3.8 / 4.2 · 8.2 / 8.2 | 113.7 / 160.5 → 91.3 / 96.3 | 72.9 / 77.7 · 75.2 / 77.3 |
| 15 | L → R | 29 / 29 of 29 | 70.6 / 74.9° → 1.7 / 1.7° (symmetric) | passes | 121.5 / 128.4 → 0.4 / 1.0 | 4.0 / 4.0 · 1.6 / 2.2 | 41.1 / 54.8 → 23.5 / 27.9 | 22.8 / 24.4 · 16.2 / 16.7 |
| 16 | R → R | 41 / 41 of 41 | 54.5 / 57.1° → 4.1 / 6.1° | passes | 9.4 / 10.1 → 0.0 / 0.0 | 2.3 / 5.9 · 5.5 / 6.4 | 51.8 / 57.1 → 23.3 / 26.3 | 11.1 / 14.9 · 82.4 / 89.7 |
| 17 | R → L | 35 / 35 of 35 | 49.4 / 86.7° → 6.1 / 30.9° (bow) | fails | 45.1 / 57.5 → 4.0 / 4.0 | 1.0 / 1.4 · 2.9 / 2.9 | — | — |
| 18 | R → R | 33 / 33 of 33 | 117.6 / 133.8° → 115.7 / 141.1° | fails | 34.8 / 39.2 → 0.0 / 0.0 | 6.8 / 10.2 · 7.3 / 10.3 | 37.8 / 37.8 → 28.0 / 33.4 | 5.9 / 14.0 · 3.3 / 5.0 |
| 19 | L → R | 67 / 67 of 67 | 121.6 / 121.6° → 4.4 / 4.4° | passes | 30.6 / 32.7 → 5.2 / 5.2 | 1.4 / 1.4 · 7.9 / 11.0 | 6.4 / 6.4 → 13.7 / 19.2 | 10.8 / 13.3 · 8.7 / 13.2 |
| 20 | R → R | 35 / 35 of 35 | 61.1 / 61.1° → 16.8 / 21.7° | fails | 4.6 / 9.7 → 1.9 / 1.9 | 7.9 / 11.0 · 2.8 / 2.8 | 33.7 / 35.8 → 6.4 / 11.7 | 2.3 / 6.6 · 73.2 / 73.2 |
| 21 | R → R | 41 / 41 of 41 | 50.1 / 71.8° → 9.3 / 9.3° | passes | 32.9 / 38.3 → 0.1 / 0.2 | 6.6 / 6.8 · 2.6 / 2.9 | 9.3 / 9.3 → 15.9 / 23.1 | 17.2 / 19.8 · 9.9 / 10.7 |
| 22 | R → R | 41 / 41 of 41 | 62.4 / 62.4° → 9.9 / 10.5° | passes | 3.2 / 4.3 → 4.1 / 4.1 | 2.0 / 2.3 · 0.6 / 0.6 | 21.7 / 23.6 → 12.7 / 13.5 | 7.3 / 7.8 · 2.1 / 5.7 |
| 25 | L → R | 33 / 33 of 33 | 109.8 / 164.8° → 179.3 / 179.3° | fails | 42.7 / 50.4 → 23.8 / 28.4 | 1.0 / 1.0 · 4.8 / 6.6 | — | — |
| 27 | R → R | 28 / 28 of 28 | 115.1 / 115.1° → 6.5 / 6.5° | passes | 3.9 / 3.9 → 6.5 / 6.5 | 1.4 / 1.4 · 14.8 / 14.8 | — | — |
| 28 | R → R | 28 / 28 of 28 | 124.8 / 136.1° → 27.6 / 32.1° | fails | 2.0 / 2.0 → 9.4 / 9.4 | 5.3 / 18.5 · 2.0 / 2.0 | — | — |
| 33 | R → R | 24 / 24 of 24 | 38.6 / 38.6° → 1.5 / 1.5° | passes | 6.5 / 6.5 → 3.8 / 3.8 | 1.1 / 1.1 · 7.2 / 7.2 | — | — |

#### Hidden Attack captures

Each link shows all four textured grading panes at the same paused Attack moment. Read the rightmost After pane to compare the unchecked and checked conditions. Across all 38 screenshots, the donor, recipient and plain transfer comparison panes had zero pixels differing by more than three channel levels. [Captured frames and ticks](../../out/cp12/captures.json) · [Screenshot comparison](../../out/cp12/screenshot-verification.json)

- 01 [off](../../out/cp12/reasonable-01-attack-before.png) · [on](../../out/cp12/reasonable-01-attack-after.png)  |  02 [off](../../out/cp12/reasonable-02-attack-before.png) · [on](../../out/cp12/reasonable-02-attack-after.png)  |  04 [off](../../out/cp12/reasonable-04-attack-before.png) · [on](../../out/cp12/reasonable-04-attack-after.png)  |  05 [off](../../out/cp12/reasonable-05-attack-before.png) · [on](../../out/cp12/reasonable-05-attack-after.png)
- 06 [off](../../out/cp12/reasonable-06-attack-before.png) · [on](../../out/cp12/reasonable-06-attack-after.png)  |  12 [off](../../out/cp12/reasonable-12-attack-before.png) · [on](../../out/cp12/reasonable-12-attack-after.png)  |  13 [off](../../out/cp12/reasonable-13-attack-before.png) · [on](../../out/cp12/reasonable-13-attack-after.png)  |  15 [off](../../out/cp12/reasonable-15-attack-before.png) · [on](../../out/cp12/reasonable-15-attack-after.png)
- 16 [off](../../out/cp12/reasonable-16-attack-before.png) · [on](../../out/cp12/reasonable-16-attack-after.png)  |  17 [off](../../out/cp12/reasonable-17-attack-before.png) · [on](../../out/cp12/reasonable-17-attack-after.png)  |  18 [off](../../out/cp12/reasonable-18-attack-before.png) · [on](../../out/cp12/reasonable-18-attack-after.png)  |  19 [off](../../out/cp12/reasonable-19-attack-before.png) · [on](../../out/cp12/reasonable-19-attack-after.png)
- 20 [off](../../out/cp12/reasonable-20-attack-before.png) · [on](../../out/cp12/reasonable-20-attack-after.png)  |  21 [off](../../out/cp12/reasonable-21-attack-before.png) · [on](../../out/cp12/reasonable-21-attack-after.png)  |  22 [off](../../out/cp12/reasonable-22-attack-before.png) · [on](../../out/cp12/reasonable-22-attack-after.png)  |  25 [off](../../out/cp12/reasonable-25-attack-before.png) · [on](../../out/cp12/reasonable-25-attack-after.png)
- 27 [off](../../out/cp12/reasonable-27-attack-before.png) · [on](../../out/cp12/reasonable-27-attack-after.png)  |  28 [off](../../out/cp12/reasonable-28-attack-before.png) · [on](../../out/cp12/reasonable-28-attack-after.png)  |  33 [off](../../out/cp12/reasonable-33-attack-before.png) · [on](../../out/cp12/reasonable-33-attack-after.png)

#### Offline grading build

Open [GRADE - XFER weapons 12.cmd](<D:/Claude/MDLxL/TestBuilds/_START HERE/GRADE - XFER weapons 12.cmd>). The [19-pair sheet](D:/Claude/MDLxL/TestBuilds/transfer-xl-35/cases-weapons12.json) writes to weapons12/answers.json. The install verification checked 1,550 engine and renderer files and the existing profile and grades. [Package and sheet verification](../../out/cp12/package-verification.json)

The focused suite finished with 52 passing checks and one failure also reproduced on the unmodified CP11b baseline. The detached pipe stretches in a scaling donor’s Death clip. All three legacy Archer checks passed after routing Two-hand grip through a single bow alignment. Warcraft III gameplay was not exercised. [Test summary](../../out/cp12/test-verification.txt)

### Owner's weapons-12 grades and CP13 instructions (Claude)

All 19 graded (`TestBuilds\transfer-xl-35\weapons12\answers.json`), all with Seat weapon like donor ticked. Mean 6.5, up from 5.5
on the same 19 in the reasonable-50 round. Better: 12 (5→7), 13 (5→6), 16 (5→7), 20 (0→5), 21 (3→8), 25 (3→7), 28 (5→7), 33 (6→7).
Kept at 10: 02, 04, 05, 06, 27. Worse: 01 (9→8), 15 (5→4). Still 0: 17, 18, 19.

The owner's comments, grouped:
1. **Twins ruined, the worst result (17, 18, 19, all 0).** "Look at the donor and own - they are ALMOST THE SAME!!! then you
   transplant" and it is ruined. 19: "just mirroring the original donor gives you ALMOST identical animations." 18: "I am not sure
   what is being compared here." 17: the bow seems to move to the wrong hand, as if the body is mirrored and the weapon placed wrong;
   the cloak "ruins everything".
2. **The grip is in the wrong place or the weapon points the wrong way (13, 15, 16, 28, 33).** 13 holds the sword backwards: "it
   should be compared vs his ORIGINAL pose/animations to determine where the hilt is and not guess." 28: staff upside down.
   16: hold it by its end like the donor. 15: donor and model have near-identical weapons and proportions, so "they should end up
   looking 100% identical". 33: the new angle is right but the weapon is no longer in the hand.
   The owner to Claude: "this cannot become a CASE specific".
3. **Neck warping on 15:** "EXCESSIVE NECK WARPING to the point its UGLY, you can LIFT slightly but not like this."
4. **Cloaks:** 17's cloak balloons; 20's cloak has no motion.
5. **22's gun looks deformed.** CP12 measured the seated weapon edges within 2.7e-6 of native, so the deformation comes from
   somewhere else. Find it.
6. **Suggestion:** 06 "I wouldnt suggest it" (still a 10). 01 dropped to 8 with Seat on (its Attack angle peak rose from 1.8° to 27.8°).

CP13. One checkpoint report at the end. Everything is a general rule measured on every pair, never a per-case patch.
- **A. Twins first (17, 18, 19).** Add an engine-wide check: compare the model's own animation with the donor's, plain and mirrored.
  When one of them is close, that tells the engine which way the donor maps onto the model (mirror or not, which hand holds the weapon).
  The result must then end up close to both. Find why the current result is far from both on 17, 18 and 19 and fix the cause.
  - Proof: for every pair in the 19, a pose distance (result vs donor, result vs own) per clip. On 17–19 the result is at least as
    close to the donor as the own model is.
- **B. Grip from the model's own animation.** Seat weapon like donor finds the model's own grip point and the weapon's head end
  from the model's own Stand/Walk/Attack (where its own palm holds its own weapon), not from geometry guesses. Where along the shaft
  the hand sits follows the donor's grip, as a fraction of the donor's weapon length. The angle follows the donor. The grip stays
  in the palm through the whole clip.
  - Proof: grip-to-palm distance, grip fraction along the shaft and head direction against the donor for 13, 15, 16, 28 and 33.
    15 must look the same as the donor.
- **C. Neck on 15.** Same no-stretch rule as CP11 A: no edge stretches beyond the donor's or the model's own maximum. Show the neck
  edge stretch before and after.
- **D. Cloaks.** A model cloak follows the donor cloak's motion (20). It never balloons past the donor cloak's reach (17).
- **E. 22's gun.** Find what deforms it, then fix it or report the cause.
- **F. Suggestion.** Suggest Seat weapon like donor only when it brings the weapon measurably closer to the donor than leaving it off
  (06 and 01 should come out unsuggested if that is what the measurement says).
- **No losses:** 02, 04, 05, 06 and 27 stay at 10. Show each Before/After at default ticks and name any visible change.
- **Then** rebuild `transfer-xl-35`, make `cases-weapons13.json` with the same 19 pairs and the launcher
  `GRADE - XFER weapons 13.cmd`, prove it with hidden screenshots in `out/cp13/`, report as `### CP13 · …` and stop with
  `CHECKPOINT 13 READY — <this file>`.
- Budget: if a group fails twice, record what was measured and move on. Do not loop.

### CP13 · Native animation, weapon grip and cloak motion

The offline weapons-13 sheet is ready for owner grading. All 19 pairs opened in the installed four-pane grader. Outstanding visual failures include the reversed sword on 13, the inflated cape on 17 and the low crossbow on 18. Pair 15's neck and pair 20's cloak motion improved. The five previous 10s still need an owner grade. The two-attempt limit was applied to grip and cloak fitting.

[Open GRADE - XFER weapons 13.cmd](<D:/Claude/MDLxL/TestBuilds/_START HERE/GRADE - XFER weapons 13.cmd>) · [19-pair sheet](D:/Claude/MDLxL/TestBuilds/transfer-xl-35/cases-weapons13.json) · [Hidden Attack captures and exact playback settings](../../out/cp13/cp13-defaults.json)

#### A. Twins

The previous orientation came from weapon names or a held-item reading. The new comparison samples corresponding Stand, Walk and Attack clips, normalizes for body size and facing, and compares both body landmarks and held material in the original and reflected donor poses. The grading sheet records the chosen After orientation. A deliberate Mirror choice in Transfer takes precedence. A single orientation applies to the entire donor animation set.

The independent ruler measured 33 phases per clip. Distances below are RMS fractions of bind landmark height. All nine grading clips for 17–19 met the result-to-donor requirement. For all 265 donor clips across 19 pairs there were 150 exact native matches, 71 same-kind matches and 44 without a native counterpart. Among the twins, all 31 native-comparable clips passed against the donor **in the orientation actually selected**. Against the closer of both native comparisons, 17's Decay Bone measured 0.1172 versus 0.1156. The grading set passed that stricter comparison on 63/65 clips. [Per-pair, per-clip results](../../out/cp13/pose-final.md) · [All 265 donor clips](../../out/cp13/pose-final-all-clips.json)

| Pair | After donor | CP12 → CP13 distance to own, Walk / Attack / Stand | Visible result |
|---|---|---|---|
| 17 | Plain | .371 → .230 / .438 → .262 / .387 → .310 | CP12 had reflected the body despite better native agreement with the plain donor in all three clips. Bow placement changes, but the stiff cape fold remains. [Attack](../../out/cp13/cp13-defaults-reasonable-17.png) |
| 18 | Plain | .255 → .255 / .209 → .209 / .087 → .087 | The body was already close to the donor. The stock still points low relative to the native horizontal aim at this Attack moment. [Attack](../../out/cp13/cp13-defaults-reasonable-18.png) |
| 19 | Mirrored | .223 → .238 / .343 → .196 / .114 → .166 | The weapon changes from nearly vertical to low and forward. Attack moves closer to native, while Walk and Stand move farther away. [Attack](../../out/cp13/cp13-defaults-reasonable-19.png) |

#### B. Grip and head direction

The engine follows material contacts against the native palm through Stand, Walk and Attack. It transfers the donor's median fractional hand position onto an actual cross-section of the recipient shaft, then fits the rigid weapon orientation and contact in the mapped hand's frame. A single rigid hand binding cannot reproduce every changing donor grip or independently animated weapon angle.

The independent check sampled serialized and reopened models. Fraction is measured from the base toward the weapon head, with symmetric orientation on 15. The gap is the maximum shortest distance from the tracked palm to the weapon surface across sampled Stand, Walk and Attack. This checks physical contact but does not prove the same piece of material stayed in the hand. The textured tip identified which endpoint to use on 13 and 28. All clip-family distributions and the original fixed-point measurements are available in the [surface results](../../out/cp13/surface-final.json).

| Pair | Attack grip fraction, donor → result (median) | Largest palm gap | Attack head angle (median) | Textured result |
|---|---:|---:|---:|---|
| 13 | .396 → .368 | .140 | 163.35° | Sword is still backwards. The visible red donor blade and recipient blade point in opposite directions. [Attack](../../out/cp13/cp13-defaults-reasonable-13.png) |
| 15 | .301 → .231 | .731 | 5.33° on symmetric axis | The broad axe pose is closer. The shaft is foreshortened and partially occluded. The grip fraction and body silhouette still differ from the donor. [Attack](../../out/cp13/cp13-defaults-reasonable-15.png) |
| 16 | .173 → .122 | <.000004 | .98° | The grip is near the end, with a residual fraction difference. Angle reaches 26.94° in Attack. [Attack](../../out/cp13/cp13-defaults-reasonable-16.png) |
| 28 | .451 → .599 | .656 | 20.53° | Both ornate heads are above their hands at the graded moment. The recipient hand still sits at a different fraction along the staff. [Attack](../../out/cp13/cp13-defaults-reasonable-28.png) |
| 33 | .143 → .150 | 2.579 | .01° | Angle and median fraction closely match. The maximum gap still leaves some separation. [Attack](../../out/cp13/cp13-defaults-reasonable-33.png) |

#### C. Neck on 15

The previous bind-pose correction turned the neck 101°. The revised rule carries an opposing bind neck with the chest and lets the donor animation bend it. All 84 audited neck edges stayed inside the larger of the donor clip-family maximum and the corresponding native edge maximum at the sampled phases. The worst Walk stretch fell from 3.560× to 2.442× (donor 2.974×, own 1.559×). The Attack maximum fell from 2.820× to 2.089×. [CP12 baseline](../../out/cp13/surface-baseline.json) · [CP13 edge measurements](../../out/cp13/surface-final.json)

#### D. Cloaks

On 20 the earlier chain match sent both fork tips to one side and selected the same driver for adjacent levels. Driving the forked panel from the donor's skinned surface improved chest-relative motion. Peak Walk RMS went from 15.10 to 22.62 units against the donor's 22.63. Attack went from 3.79 to 6.21 against 6.70. The hem still travels farther than the donor's. [Pair 20](../../out/cp13/cp13-defaults-reasonable-20.png)

On 17 the same continuous garment has one strip rigged under the arm and another under the chest. Restoring split panels in the chest frame did not contain the complete visible garment. Its Attack span/reach measured 129.27/72.56 units on CP12, 126.06/76.01 on the first CP13 pass and **137.88/83.36** in the final build. The native cape measured 86.29/64.56. The donor's closest visible rear garment measured 59.32/55.84 and differs in construction. The final result regressed on both span and reach. [First pass](../../out/cp13/surface-cape-pass1.json) · [Final](../../out/cp13/surface-final.json)

#### E. Rifle on 22

The barrel points farther along the line of sight when seated. The visible gun's 117 vertices move rigidly together. Its diameter at Attack tick 40567 was 121.15482 units off and 121.15484 on. The alternate rifle stayed hidden. Projecting off and on into the same packaged camera shortened the gun from 144.38 to 113.86 pixels, making the black muzzle cap more prominent. This accounts for the apparent deformation at the reported frame. [Captured camera](../../out/cp13/cp13-case22-camera.json) · [Textured frame](../../out/cp13/cp13-defaults-reasonable-22.png)

#### F. Seat suggestion

The previous suggester promoted any successful bind. The new gate compares the off and on shaft-direction error in radians plus the grip gap divided by shaft length in matched visible phases. It also checks the chosen combination. The minimum mean improvement is .01. The final sheet suggests seating on 18/19. Pair 01 is off (.0171 off → .0244 on). Pair 06 remains on (2.114 → .058). Its previous grade was 10 despite the owner's preference to leave it off. Case 13 demonstrates a limit of this gate when the engine reads the wrong head end. [Scores for all 19 pairs](../../out/cp13/surface-final.json)

#### Five previous 10s at default ticks

Each plate compares the CP12 and CP13 After panes at the same Attack frame, camera and checkbox settings. Both weapons are visible on 05. The hidden run also exercised normal mouse rotation. All five pictures changed. Whether they retain a 10 is pending owner grading.

| Pair | CP12 → CP13 | Pixels differing by more than 3 channel levels |
|---|---|---:|
| [02](../../out/cp13/no-loss-reasonable-02.png) | The sword drops lower and points farther down-right. | 621 |
| [04](../../out/cp13/no-loss-reasonable-04.png) | The sword shifts slightly below the shield. | 231 |
| [05](../../out/cp13/no-loss-reasonable-05.png) | The axe on the left swings outward. The other axe stays near its previous position. | 3,372 |
| [06](../../out/cp13/no-loss-reasonable-06.png) | The shaft is more vertical and the axe blade turns. | 820 |
| [27](../../out/cp13/no-loss-reasonable-27.png) | The skull on the staff turns toward the viewer and the shaft sits slightly more upright. | 914 |

[Camera, frame, default ticks and pixel measurements](../../out/cp13/no-loss-comparison.json)

#### Offline build and checks

The rebuilt `transfer-xl-35` grading package opened every row and rendered all 76 textured panes with zero page errors. The launcher opened row 1/19 with the correct donor, recipient and four labels. The install check verified 1,674 application files and 432 protected files, including 395 profile files. Hidden grade writes used scratch answers. The owner's weapons-13 sheet is ready for fresh grades. [Package verification](../../out/cp13/package-verification.json) · [Launcher proof](../../out/cp13/launcher-verification.json)

The four focused source suites finished with **52 passing, 1 failing, 0 skipped**. The outstanding detached-pipe edge assertion in Death at 650 ms also failed on the earlier CP11b baseline. All three legacy Archer checks passed. Warcraft III gameplay and owner grading remain unverified. [Test log](../../out/cp13/work/tests-focused.log)

### Owner's weapons-13 grades (24 Nov, 12 of 19) and CP14 · Claude codes the fixes

Graded before stopping: 01 9, 02 10, 04 10, 05 10 (Seat off is better), 06 10 (prefers Seat off), 12 10, 13 8 ("still upside
down but its ok"), 15 7 ("hands are still not gripping the shaft ... during walk"), 16 10, 17 5 ("look at the cloak, you really
ruined this model"), 18 5, 19 0. The owner then said Codex "offered 0 improvements" and asked Claude to code it.

Claude rendered donor / own / result frames per pair (`out/claude-cp14/render.mjs`, flat colour per geoset) and found three causes:

1. **19, crossbow turned a quarter turn about its stock.** For a launcher the stock part gives the shaft, and the roll came from
   the stock's own cross-section, which is arbitrary for a thin bar. Fix (`transplant-weapon-seat.js` `rolled`): when the axis
   comes from a stock part, the roll comes from the whole item (the bow limbs lie across it), in both the Stand reading and the
   stored frame.
2. **18, crossbow held sideways and backwards; the loaded bolt left behind.** The donor reading picked the arbalest string as
   the "stock" (the two palms sit side by side). Fix (`aimedAxis`): a launcher's stock is the item direction that the model's own
   Attack keeps pointing along its facing, muzzle first; it is used for the axis, the head end and the stored frame. Pieces that
   ride only on the weapon's own bones (the bolt cards) now move with the seated weapon.
3. **17, the cape ballooned.** One side of the cape hangs from the right shoulder in the model's rig; the transplant bound it to
   the donor's right forearm, so every bow draw flung it out. CP13's split-cape pass moved only one of the two coincident cape
   layers, which pulled them apart. Fix (new `transplant-native-cloth.js` `nativeCloth`, engine, not a toggle): cloth chains
   (three or more non-body links under the chest or a shoulder, no weapon/head names) whose skin the transplant put on a donor
   forearm keep the model's own motion against its own torso. Per moment the own torso skin is fitted onto the result torso
   skin (similarity fit) and the cloth bones are baked from the own model's same-kind clip; chains sharing skin are one garment.

Measured: exports of the 19 weapons-13 pairs at their suggested ticks change only on 17, 18, 19 and 21 (21: same picture, tiny
numeric change). Over the 50 reasonable-50 pairs at their own ticks only 17 changes; new30 and random30 (60 pairs) are
byte-identical to CP13. The five 10s (02, 04, 05, 06, 27) are byte-identical.

Not fixed yet: 15's second hand does not reach the shaft in Walk (Two-hand grip does nothing with Seat on), 13's sword head end,
and the Seat suggestion on 05/06 (owner prefers it off).

Grading build: `transfer-xl-35` reinstalled with this source (old dist/src kept in `out/claude-cp14/installed-cp13`). Sheet
`cases-weapons14.json` = 17, 18, 19 plus the seven ungraded weapons-13 rows (20, 21, 22, 25, 27, 28, 33), launcher
`GRADE - XFER weapons 14.cmd`. Hidden run opened all 10 rows with zero page errors (`out/claude-cp14/smoke`).

#### CP14b · second hand on the shaft (owner: "Yes, fix 15")

15's donor carries the axe with both hands in Walk; the result held it with one. New step in `seatWeapon` (`holdSupport`): when
the donor holds its item with two hands in its Stand reading (`wanted.support`), at every moment (33 ms) where the donor's other
palm touches its weapon surface (within .12 arm length, fading out by .30), the result's other palm is moved onto the seated
weapon's surface at the same fraction along the shaft (`surfaceAt`), by the two-bone arm solve already used for planted palms
(upper arm and forearm rotation keys via `rewriteTrack`). Arms already within .1 arm length, and moments when the donor lets go,
keep their motion. Measuring against the end-to-end line instead of the surface failed first (the axe blade pulls that line off
the haft: donor gap read .40 instead of .03).

Mean result palm gap at those moments, in arm lengths, before → after: 15 .24 → .01 (214 moments), 12 .23 → .06, 16 .39 → .04,
18 .61 → .07, 19 .61 → .02, 20 .53 → .04, 22 .41 → .08. Bows (17), single-hand items and 21/25 are untouched (the donor has no
two-hand Stand grip). Only runs with Seat weapon like donor ticked: the reasonable-50, new30 and random30 sheets are byte-identical
to the previous commit; on weapons-13 it changes 12, 15, 16, 18, 19, 20 and 22.

`GRADE - XFER weapons 14.cmd` now has 13 rows: 15, 17, 18, 19, then 12 and 16 (10s, to confirm) and 20, 21, 22, 25, 27, 28, 33.

#### Owner's weapons-14 grades (24 Nov) and open points

13 rows, mean 8.7: 15 9, 17 8, 18 10, 19 6, 12 10, 16 5, 20 10, 21 10, 22 10, 25 8, 27 10, 28 9, 33 8. Only comment, 16: "the motion
of his amulet became the motion of the head = unwanted". 16's export differs from the CP13 build (graded 10) only in the left arm
(CP14b second hand); no neck or head skin changed, so the amulet motion predates CP14. Claude could not identify the amulet: the
head-bound plates under the jaw sit on head skin (teeth/tusks), and the separate chest band (geoset 1) moves with the hips; asked
the owner to point it out.

Owner: the next grading sheet shows every donated animation. Sheets made by `out/claude-cp14/make-sheet.cjs` now omit
`sequences`, so the sheet lists all of the donor's animations (`TransferPicks.jsx` uses the donor's names when the list is empty).
