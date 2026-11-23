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
