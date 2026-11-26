# XFER engine 2

Status: built, waiting for the owner's grades (26 Nov 2026). Branch `claude/xfer-engine2-1cdbdc` (local only), cut from
`codex/xfer-toggles` at `f2cf9b90`.

## What it is

Engine 1 (`transplantRun`, src/skeleton-transplant.js) copies each donor joint's local turn onto the fitted skeleton, so a
pose only comes out right when the bodies are built alike (owner-confirmed root cause, 26 Nov). Engine 2 is the transplant
option `engine: 2`. It runs engine 1, then re-poses the paired limbs on its result in `engine2Pose`
([src/transplant-engine2.js](../../src/transplant-engine2.js)), every moment of every donated animation:

- each leg, arm, tail and wing bone points the way the donor's matching bone points (rotation only, so the shape stays);
- the foot is aimed at the donor's foot spot from the hip centre, scaled forward and up by the leg-length ratio and
  sideways by the larger of the hip-width and leg-length ratios, in the donor's heading. The hand is aimed at the donor's
  hand spot from the shoulder centre, scaled by the arm-length ratio. Knee and elbow bend in the donor's bend plane
  (`solveTwoBone`, pose-ik.js; on the last three joints of a longer chain);
- the body's height above the ground and its travel follow the donor's hip centre times the leg ratio, so planted feet stay planted;
- hands and feet keep engine 1's world turn (the donor's), so a held weapon keeps the donor's angle.

Engine 1 and its toggles are unchanged; the toggles still run before engine 2 if ticked.

## Grading sheet

- `node scripts/xfer-scorecard/make-engine2-sheet.cjs` writes `TestBuilds\transfer-xl-35\cases-engine2.json` (20 pairs:
  the owner's 9-10 pairs, Nurgle Sorcerer -> Footman, and seven more reasonable pairs) and the launcher
  `TestBuilds\_START HERE\GRADE - XFER engine 2.cmd`. Answers: `TestBuilds\transfer-xl-35\engine2\answers.json`.
- Views: Donor, Receiver, Engine 1 (at the ticks the owner graded, else the pair's suggestion; options `toggles`, read by
  app/TransferPicks.jsx), Engine 2 (no ticks).

## Checks run

- All 20 pairs build with engine 2 in node: no crash, no non-finite vertex; mesh reach matches engine 1 (the big reaches are
  donor Birth/Dissipate moves engine 1 has too).
- Installed into `TestBuilds\transfer-xl-35` (dist + src, profile kept). `sheet-smoke.cjs --app` hidden: every row opens with
  Donor, Receiver, Engine 1, Engine 2; nurgle-01, new-01 and reasonable-23 were counted while still loading (known flaw).
  Its "control opens at its graded ticks" lines fail by design: engine 1's ticks sit in the sheet's options, not in answers.

## Known limits

- Trunk (hips, chest, head) still turns as engine 1 does; only limbs are re-posed.
- A leg of four or more joints keeps donor directions and bends only its last three joints.
- No floor check for arms after engine 2 (engine 1's arm floor bend is overwritten on re-posed arms).
- About 3-5x slower to build than engine 1.
