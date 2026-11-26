# XFER engine 2

Status: round 4 built (26 Nov 2026, late): shown form, methods A/B/Mix, new controls. Round 3: owner stopped sheets ("keeps repeating"); he plays with XFER via
`TestBuilds\_START HERE\PLAY - XFER.cmd` (TEST XFER PLAY 01, a Footman copy). No more grading sheets.
Branch `claude/xfer-engine2-1cdbdc` (local only), cut from `codex/xfer-toggles` at `f2cf9b90`.

## What it is

Engine 1 (`transplantRun`, src/skeleton-transplant.js) copies each donor joint's local turn onto the fitted skeleton, so a
pose only comes out right when the bodies are built alike (owner-confirmed root cause, 26 Nov). Engine 2 is the transplant
option `engine: 2` (+ `regions`). It runs engine 1, then re-poses limbs on its result in `engine2Pose`
([src/transplant-engine2.js](../../src/transplant-engine2.js)), every moment of every donated animation:

- each bone of an engine 2 limb points the way the donor's matching bone points: engine 1's joint turn (the donor's) times
  one fixed per-bone turn from this model's rest bone onto the donor's (a turn worked out anew each moment flipped where it
  was large);
- the foot goes to the donor's foot spot from the hip centre: forward and up by the leg-length ratio; sideways the donor's
  spread from its socket (leg ratio) from the wider of this model's socket and the donor's socket spacing times the leg
  ratio. The hand goes to the donor's hand spot from the centre of the shoulders of its own arm group (a rider's arms and
  a mount's forelimbs are separate groups; only the main pair reaches for spots), scaled by that group's arm ratio; a second hand on the weapon is placed from
  the weapon hand, blended in as the donor's hands come together. Knee and elbow bend in the donor's bend plane
  (`solveTwoBone`), easing off before full stretch, keeping the last bend direction while the donor's limb is straight;
- with both legs on engine 2, the body's height and travel follow the donor's hip centre times the leg ratio; only the
  parentless joint the legs hang from moves (a hero glow or loose plane moved with it bobbed);
- hands and feet keep engine 1's world turn (the donor's), so a held weapon keeps the donor's angle;
- new keys every 1/30 s plus every key of the limb and the joints above it, moving in straight steps; a curved track keeps
  its type and every other animation's keys exactly (round 1 keyed sparse with wrong position tangents: the "shaking";
  round 2 re-sampled other animations, which moved fast leg swings a few units).

## Engine per region (owner 26 Nov: "let users pick themselves")

`regions = {armL, armR, legL, legR, weapon}`, each 1 or 2. Spine and head follow engine 1 in both engines. A tail follows the
legs (engine 2 only when both legs are). The arm's box decides where its hand goes; the weapon box only how the weapon sits in
the hand (2: a fixed grip turn so the weapon points the way the donor's does, only when the two weapons lie within 60
degrees in the hand at rest, else engine 1's turn: a 90-degree grip difference put Thrall's hammer into his body; with an
empty donor hand, the wrist holds its average turn of the animation; 1: engine 1's turn). Before 26 Nov
evening the weapon box placed the weapon hand and the arm box did nothing on that arm (owner, pair 1 of sheet 2b). Every region on 1 gives engine 1's result byte for byte (checked on 6 pairs). `suggestEngineRegions` suggests
engine 2 where proportions differ (hip spacing vs leg length off by 25%, arm vs leg length off by 20%), else engine 1;
the weapon follows the arms. UI: one "Engine 2:" group of boxes in the repair row (app/TransplantToggles.jsx), in the
Transfer window (starts at the suggestion, kept per pair) and in the pick sheet (`engineOptions` in transfer-window.js).
Labels in all six languages. `regions.animations` = {animation name: regions}: the Transfer window's "This animation only"
box (owner: legs on 1 in Walk, 2 in Attack); unticked, the boxes edit the choice for every animation without its own.

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

## Round 3 faults (2b answers, `TestBuilds\transfer-xl-35\engine2b\answers.json`)

Micro shaking (05: loose parentless planes bobbed with the body); weapon swings in Walk (random-10: the receiver's club
rides the donor's own club bone, same in engine 1, not changed); hammer inside the body with weapon on 2 (31: grips 90
degrees apart); per-animation engine wanted (29). Also found while checking: sword spike (07) and wing shake (39).

## Round 4 (26 Nov late): what you see is what you get, methods, controls

- Shown form: `skeletonFor` (src/anim-transfer.js) picks the skeleton carrying the skin the animation shows (`shownIn`);
  a skeleton shown with the body in under half of the animations showing either is a second form, not a rider
  (`skeletonRoot`). `transferForm(model, sequence)` gives the form's key, animations (a morph is in neither; death and decay
  bodies go by name tag) and Stand. Proven: Druid of the Talon (night elf: legs; crow: wings), Druid of the Claw (bear:
  four legs), Demon Hunter and Illidan (demon form: tail). Footman <- Druid of the Talon now walks with both methods.
  The owner's eight 9-10 pairs: engine 1 byte for byte unchanged (`regress.mjs --check`).
- Transplant options (`transplantSkeleton`): `donorSequence` (the donor view's animation: its form is read and only its
  animations are donated), `method` 'A' | 'B' | 'mix' with `mix` {armL, armR, legL, legR, weapon, animations}, `actor`
  ('both' | 'seated' | 'walker'). `report.parts` per receiver part: matched, donor part, reason; `still` when a matched
  limb did not move although the donor's did (`followCheck`). `report.form`: the form's animations and the ones left out.
- Retarget: `recipe.method` / `part.method` ('A' | 'B'); B turns each taken limb bone toward the donor's paired bone after
  the method A turn. Planted feet and the aimed weapon arm end at the same spots in both (Retarget's own later steps).
- Window (contract xfer-controls-design.md): method row (app/TransferMethods.jsx) with Copy / Match / Mix, All animations /
  This animation, More (Donor pose, Keep own torso, Keep donor motion when they apply), "! N" with the list of parts and
  reasons; Mix dots and warning marks on the result's POSE handles (`poseConfig.marks`, app/pose-overlay.js); part chip
  with Copy / Match (Shift: both sides), the weapon row on the weapon arm, the front-leg choice, Same as all; form buttons
  (Normal / Alternate, else Form n) and Both / Rider / Mount in the donor caption in Transplant too; other-form animations
  dimmed; "•" on animations with their own choice. Retarget: the same row (no scope), dots and chip on taken limbs.
- Round 5 (owner: "wtf is this"): the part chip was a huge empty panel (a stylesheet rule stretched every div in the preview;
  `.xf-chip` is now excluded) and now picks the side that covers no dot (`handlePoints()` on the preview's capture API);
  the Transplant result view framed by the animation's box (smaller than the mesh, so zoomed in) and kept it: it now
  frames the shown pose of the whole model when a pair or form first shows (`resetView`), then keeps the camera; dots hide
  while building; Retarget's donor view showed handles of every skeleton in the file (crow, death body), now only the
  read form's. Checked hidden with the Druid of the Talon, Grunt and Ghoul as donors (Mix, a dot click, Escape, rebuild,
  animation change, Retarget).
- Starting method (owner 26 Nov: "Suggested method"): Transplant starts on `suggestEngineRegions`; a Retarget part without
  its own `method` builds with its region's suggestion. Both already did; no code change.
- Not done from the contract: the M / X keys (buttons carry hotkey ids, so keys can be assigned in Settings); the
  "outlined donor limb" when a part is picked; a warning mark on a part the result has no handle for (it is in the "! N"
  list instead). The repair suggester still runs (automatically) to pick the repairs, as the contract says.

## Known limits

- Trunk (hips, chest, head) turns as engine 1 turns it; only limbs are re-posed.
- A limb of four or more joints keeps donor directions and bends only its last three joints.
- No floor check for arms after engine 2; bow string not handled (reasonable-17).
- 2-5x slower to build than engine 1.
