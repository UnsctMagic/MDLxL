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
