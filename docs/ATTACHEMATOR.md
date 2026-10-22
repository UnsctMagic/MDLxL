# Attachemator

Bones mode → Tools → **Attachemator** places Warcraft III's standard attachment
points (Origin, OverHead, Head, Chest, Hand Left/Right, Foot Left/Right, the rear
feet of mounts and many-legged units, and Weapon) the way Blizzard's own units
have them. It opens a window with a preview first. Each point can be ticked off
(kept exactly as it is, or not added), selected and dragged with the normal
bones-mode Move handle, and nothing changes until **Commit**, which is one
undoable edit.

The engine is `src/attachemator.js`; the window is `app/Attachemator.jsx`.

## What the game's models taught us

Measured on all 417 SD unit models in the installed game's CASC
(`war3.w3mod:units\...`, read with `electron/casc.cjs`), then checked on 40
Reforged HD unit models. "H" is the unit's height in its Stand pose.

| Point | Parent Blizzard uses | Where it sits |
| --- | --- | --- |
| Origin | none (392 of 394) | the model origin, 0,0,0 |
| OverHead | none (379 of 392) | straight above the origin, a little over the top of the unit (median +0.07 H; designers vary a lot) |
| Head | the head bone | the middle of the head mesh, slightly forward |
| Chest | the chest bone | about 0.6 of the way from the chest joint to the chest mesh, i.e. just above the joint |
| Hand Left/Right | the hand bone (often a helper); sometimes the forearm | in the palm, just past the hand mesh centre |
| Foot Left/Right | the foot bone | on the ground under the foot (median z ≈ 0) |
| Foot Left/Right Rear | a mount's or many-legged unit's rear foot | on the ground under it |
| Weapon | the weapon mesh held in a hand (Cylinder02, Blade, Staff…); else a hand; the head (jaws) for beasts | out on the weapon |

Conventions:
- Left is +Y (units face +X). When a whole pair of bones is named the other way
  round from where its mesh is (Bandit, Magnataur), Blizzard follows the names,
  so Attachemator does too.
- Four-legged animals put the Hand points on the front paws (bears, wolves).
  Spiders use the front legs as hands. Flyers without arms use the wing tips.
- A mount and rider (Knight, Gryphon Rider): hands and head on the rider, the
  feet on the mount's front feet and the rear feet on its back feet.
- Reforged rigs name the attachment joints outright: `bone_hand_left`,
  `bone_leg_left` (the foot), `bone_head`, `bone_chest`, `weapon_bind_jnt`, and
  `mount_bone_hand_*` / `mount_bone_leg_*` for a hero's horse. Their arms have
  twist joints at the hand's pivot that POSE cannot bend, so these names win.
- Units without named parts (ships, wagons, critters) hang points on the body
  bone that carries the mesh.

## How it decides

1. Sample the plainest Stand animation (`Stand`, then `Stand - 1`, …) and skin
   the geosets that show in it.
2. Ask POSE (`suggestPoseRig`) for the rig with the model's own attachment
   points removed, so wrong existing points cannot vouch for themselves.
3. Pick hands, feet, head, chest and weapon with the rules above; measure each
   point in the Stand pose, then store it in the parent's bind space so it
   follows its bone in every animation.
4. Match existing points by name (`Head - Ref`, `OverHead Ref `, `Foot Right  Ref`
   all count). A point already within 2% of H on the same parent is "Already
   right". Names with numbers or "Alternate" are left alone and listed.

## How close it gets

Against Blizzard's own placement, with each model's points removed first
(scratchpad scorer, not part of the test suite):

| | same parent | placement error (median) |
| --- | --- | --- |
| Humanoids (181 models with hand and foot bones) | Head 92%, Chest 97%, Hands 84–96%, Feet 84–86% | about 0.05–0.06 H with the same parent |
| All 399 SD models with points | Hands 54–61%, Feet 56%, Weapon 41% | |

Most remaining differences are Blizzard's own inconsistencies (unparented
weapons, hands on a forearm, mirrored names, a Reforged hero with its Head point
on the floor), which is why every point can be adjusted or kept.

Tests: `test/attachemator.test.js` (made-up humanoid and Reforged-style rigs)
and `test/attachemator.electron.cjs` (the SD Footman in the real app: add,
re-parent, veto, drag, camera turn, commit and save).
