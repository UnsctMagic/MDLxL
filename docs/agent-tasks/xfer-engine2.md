# XFER engine 2

Status: round 2 (engine per region + polish) built, waiting for the owner's grades on sheet `engine2b` (26 Nov 2026).
Branch `claude/xfer-engine2-1cdbdc` (local only), cut from `codex/xfer-toggles` at `f2cf9b90`.

## What it is

Engine 1 (`transplantRun`, src/skeleton-transplant.js) copies each donor joint's local turn onto the fitted skeleton, so a
pose only comes out right when the bodies are built alike (owner-confirmed root cause, 26 Nov). Engine 2 is the transplant
option `engine: 2` (+ `regions`). It runs engine 1, then re-poses limbs on its result in `engine2Pose`
([src/transplant-engine2.js](../../src/transplant-engine2.js)), every moment of every donated animation:

- each bone of an engine 2 limb points the way the donor's matching bone points (rotation only, so the shape stays);
- the foot goes to the donor's foot spot from the hip centre: forward and up by the leg-length ratio; sideways the donor's
  spread from its socket (leg ratio) from the wider of this model's socket and the donor's socket spacing times the leg
  ratio. The hand goes to the donor's hand spot from the centre of the shoulders of its own arm group (a rider's arms and
  a mount's forelimbs are separate groups), scaled by that group's arm ratio; a second hand on the weapon is placed from
  the weapon hand, blended in as the donor's hands come together. Knee and elbow bend in the donor's bend plane
  (`solveTwoBone`), easing off before full stretch, keeping the last bend direction while the donor's limb is straight;
- with both legs on engine 2, the body's height and travel follow the donor's hip centre times the leg ratio;
- hands and feet keep engine 1's world turn (the donor's), so a held weapon keeps the donor's angle;
- written tracks are linear, keyed every 1/30 s plus every key of the limb and the joints above it (round 1 keyed sparse,
  and curved tracks got wrong tangents: the owner's "shaking").

## Engine per region (owner 26 Nov: "let users pick themselves")

`regions = {armL, armR, legL, legR, weapon}`, each 1 or 2. Spine and head follow engine 1 in both engines. A tail follows the
legs (engine 2 only when both legs are). The arm's box decides where its hand goes; the weapon box only how the weapon sits in
the hand (2: the hand turns so the weapon points the way the donor's weapon points; 1: engine 1's turn). Before 26 Nov
evening the weapon box placed the weapon hand and the arm box did nothing on that arm (owner, pair 1 of sheet 2b). Every region on 1 gives engine 1's result byte for byte (checked on 6 pairs). `suggestEngineRegions` suggests
engine 2 where proportions differ (hip spacing vs leg length off by 25%, arm vs leg length off by 20%), else engine 1;
the weapon follows the arms. UI: one "Engine 2:" group of boxes in the repair row (app/TransplantToggles.jsx), in the
Transfer window (starts at the suggestion, kept per pair) and in the pick sheet (`engineOptions` in transfer-window.js).
Labels in all six languages.

## Grading sheets

- `node scripts/xfer-scorecard/make-engine2-sheet.cjs [--name engine2b]` writes `TestBuilds\transfer-xl-35\cases-<name>.json`
  (20 pairs: the owner's 9-10 pairs, Nurgle Sorcerer -> Footman, seven more) and `TestBuilds\_START HERE\GRADE - XFER
  engine 2[b].cmd`. Views: Donor, Receiver, Engine 1 (ticks the owner graded, else the suggestion; options `toggles`),
  Engine 2 (no ticks). Sheet `engine2b` starts every part on engine 2 (`regions` in the options); its boxes and the
  answers (`regions`) change that; ✦ marks the suggestion.
- Round 1 answers: `TestBuilds\transfer-xl-35\engine2\answers.json`. Trends: engine 2 shook (5 pairs), weapon hold better
  in 1 on some pairs and in 2 on others, legs better in 1 on wide-hipped receivers, bow string off (reasonable-17).

## Checks run (round 2)

- 20 pairs build with every part on engine 2: no crash, no non-finite vertex. Shake (mean frame-to-frame jerk of the
  mesh) on the shaky pairs is now at engine 1's level (reasonable-07 0.56 -> 0.075, engine 1 0.078).
- `node --test` transfer-picks, transfer-window, ui-primitives pass. localization-catalogs fails its catalog size and
  French/German order checks; both fail before this work too (sizes were already off, first order break at "Repairs").
- Hidden `sheet-smoke.cjs --app` on the 2b launcher (now also changes one Engine 2 box).

## Known limits

- Trunk (hips, chest, head) turns as engine 1 turns it; only limbs are re-posed.
- A limb of four or more joints keeps donor directions and bends only its last three joints.
- No floor check for arms after engine 2; bow string not handled (reasonable-17).
- 2-5x slower to build than engine 1.
