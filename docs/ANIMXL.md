# AnimXL

AnimXL shapes a hand-keyed animation with a few sliders and shows the result live on the model. Commit writes ordinary bone keyframes as one Undo step.

Open it with the **ANIM** module button (or Modules → AnimXL…). Pick the animation at the top.

## Controls

The window is a big preview with a timeline under it, and effect cards beside it. Click a card to switch an effect on and open its slider; the switch in its corner turns it off. Point at a card and the bones it moves light up in the preview.

| Control | What it does |
| --- | --- |
| Presets | Natural, Heavy, Snappy, Floppy and Death switch several cards on at good starting values. **Save as preset…** (under Fine-tune) adds your own preset button, for any model. |
| Smooth | Speeds up out of each pose and slows into the next. Poses stay where they are. |
| Follow-through | Parts further from the body follow a moment later (hips → chest → arms → hands → weapon). |
| Wobble | Parts overshoot a pose slightly and wobble back into it. |
| Weight | The body is slower to start and stop and lags behind its path. |
| Weapon drag | The weapon (or any heavy part you pick) trails the swing and drags the arm holding it. Its card picks the bones and keeps a two-handed grip on the weapon. |
| Cloth & hair | Capes, hair, tails and plumes swing freely. Its card picks the bones. |
| Heavy steps | Each footfall drops the body into the step and nods the chest and head. Footfalls show as green ticks on the timeline. |
| Wind-up | Before each big move, bones first pull back the other way for a moment. |
| Punch it up | Pushes every pose further than you posed it, for punchier motion. |
| Breathing | Held poses breathe: small, slow drifts so the unit never freezes dead. Loops seamlessly. |
| Hits | THUNK: the weapon connects, the pose holds for a beat and heavy bones bounce back. Flinch: the unit is hit, the body is knocked back and the torso snaps. Each can play a game sound, written as a sound event on Commit. |
| Collapse | From a chosen moment the unit loses its strength and falls to the ground under its own weight: Goes limp at, Falls (direction) and Landing. The Death preset turns any pose into a death; use Commit as new to keep the original. |
| Fine-tune | Stick to my poses (Loose ↔ Exact), timing reset, Keep feet planted, the body and feet bones, stiff bones (they and everything below them follow exactly), and other animations to shape on Commit. |
| Timeline | Diamonds are your key poses; drag one to change when it happens (double-click puts it back). The graph shows how much the unit moves over time: dashed for the original, orange for AnimXL. |
| Ghost | The original skeleton (dashed white) under the bones AnimXL moved most, coloured yellow, orange and red by how far they moved. |
| ×3 | The preview shows every change three times as strong, so subtle changes are easy to see. Commit writes the real result. |
| Arcs | Draws the path a bone's tip follows: dashed for the original, orange for AnimXL. |
| Original / Side by side | Compare with the unshaped animation, alone or next to it with one shared camera. |
| Commit as new | Keeps the original and adds the shaped version as a new animation, "<name> (AnimXL)". |
| Undo (Ctrl+Z / Ctrl+Y) | Steps through slider changes inside AnimXL. |

Weapon, cape, hair and tail bones are guessed from bone names. Change them with the pickers, or **Pick in view** and click bones in the preview.

The strip under the preview shows key poses (diamonds, orange once moved), footfalls (green ticks), THUNKs (stars) and flinches (red marks). Click it to jump to a moment; drag a diamond, star or red mark to move it.

Slider settings are remembered per model and animation until you commit.

AnimXL opens showing your animation unchanged; nothing moves until you switch a card on or pick a preset. Shaping runs in a background worker, so sliders stay smooth on long animations of big models.

## How it works

`src/anim-xl.js` samples the authored animation as a target pose, runs a spring per bone in world orientation (so children lag their parents), and reduces the result back to smooth (squad) keys. Linear rotation tracks become Bezier; keys of other animations get flat tangents, so they play exactly as before. On a stepped (no interpolation) track, each key of the other animations is held until just before the next, so they keep stepping. The body (from POSE's rig reading, bone names, or your pick) gets a translation spring for Weight, Heavy steps and Flinch. Afterwards, two-bone IK puts planted feet back on their authored path and keeps a two-handed grip on the weapon.

The weapon is found from bone names or the model's "Weapon Ref" attachment; hands, limbs, mounts and shields are never guessed as the weapon, and neither is a head or jaw that carries a Weapon Ref at the mouth. Only bones that move visible vertices are suggested. On a machine (no legs or arms), the throwing arm, launcher, barrel or turret is the weapon and ropes and slings are loose. Tails with plain names (Bone12, Object44) are found from their shape: a skinned chain reaching backwards along the middle of a creature that stands on legs.

Legs come from POSE's rig reading. A leg owns its upper and middle bone; on a rig with no legs, limbs that stand at the bottom of the rig (a crab's walking legs, a bull's forelegs marked with Hand Refs) are legs. Without leg chains, only bones named as feet count as feet, so wheels and tails carrying Foot Refs are left alone.

Hand-keyed animations use their own key times as the poses Ease preserves. Densely keyed animations use the moments where the body slows to a stop, and AnimXL says so.

Looping animations end exactly where they start: AnimXL pre-rolls whole cycles so the springs settle into the loop, then eases the last quarter of every shaped bone onto its first pose. On those bones this also repairs seams already in the animation (for example a cape that jumps at the loop point); bones AnimXL does not shape keep their keys.

Ease, retiming and THUNK holds also retime keyed translations, so a jump or a crouch stays in step with the rotations.

Collapse treats the unit's own skeleton (the tree holding its body; separate effect bones are left alone) as points joined at their bone lengths. Muscles pull the points toward the animated pose less and less, gravity and a push in the chosen direction take over, knees and elbows fold but the spine hardly does, and each bone comes to rest at the thickness of its own mesh above the ground. The points then go back into rotations and the body's translation.

## Limits

- Rotations and translations only; scaling keys keep their original timing.
- Eased motion needs extra keys: shaped animations carry roughly 4 keys per move per bone.
- Follow-through means children reach a pose slightly after their parent unless Stick to my poses is set to Exact.
- Bones with global-sequence or billboarded rotation are left alone.
- Heavy steps and foot planting need feet that touch the ground; a rider's feet in stirrups are left free. A leg must have its own upper and middle bone: dangling flyer talons that hang off one hip bone are not legs.
- A weapon that is scaled to nothing during an animation gets no grip in that animation.
- Reforged HD (format 1000) models open read-only in MDLxL, so AnimXL cannot shape them yet.

## Checks

- `node --test test/anim-xl.test.js test/anim-xl-grip.test.js test/anim-xl-review.test.js`
- Packaged mouse check: `MDLXL_PLAYWRIGHT_MODULE=<playwright> MDLXL_ANIMXL_EXE=<MDLxL.exe> node test/anim-xl.electron.cjs`
- Contact sheet of one animation (Original and presets over time): `node test/anim-xl-filmstrip.electron.cjs <model.mdx> "Attack - 1" Natural Heavy`

Verified locally on 29 unit models (335 animations, every slider on, no failures; slowest build about 400 ms, in the worker), and MDX/MDL save-and-reopen gives identical poses. Foot slip under heavy Weight and Overlap drops from 4–14 units to about 0.5–1 on walks. Sound events survive MDX and MDL save-and-reopen.
