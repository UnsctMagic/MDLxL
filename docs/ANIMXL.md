# AnimXL

AnimXL shapes a hand-keyed animation with a few sliders and shows the result live on the model. Commit writes ordinary bone keyframes as one Undo step.

Open it with the **ANIM** module button (or Modules → AnimXL…). Pick the animation at the top.

## Controls

| Control | What it does |
| --- | --- |
| Quick start | Natural, Heavy, Snappy and Loose set the sliders to a good starting point. **Save as preset…** keeps your own slider settings as a button, for any model. |
| Ease | Speeds up out of each pose and slows into the next. Poses stay where they are. |
| Overlap | Parts further from the body follow a moment later (hips → chest → arms → hands → weapon). |
| Settle | Parts overshoot a pose slightly and wobble back into it. |
| Weight | The body is slower to start and stop and lags behind its path. |
| Anticipation | Before each big move, bones first pull back the other way for a moment (a wind-up). |
| Exaggerate | Pushes every pose further than you posed it, for punchier motion. |
| Life | Held poses breathe: small, slow drifts so the unit never freezes dead. Loops seamlessly. |
| Hit poses | How closely the result lands on your key poses (Loose ↔ Exact). |
| Timing | Drag a pose diamond on the strip to change when that pose happens; double-click it to put it back. Translations follow the new timing too. |
| Heavy bones | Picked bones (usually the weapon) trail the swing and drag the arm holding them. |
| Keep both hands on the weapon | With a two-handed grip (the other hand stays at one spot on the weapon), that hand stays on the weapon while it drags. Not yet exercised on a real two-handed model: none of the local test units has one. |
| Loose bones | Picked bones (cape, hair, tail) swing loosely on their own. |
| Body and feet | The Feet section shows the body and feet AnimXL found. If it read the rig wrong, pick the body bone from the list and pick each foot (ankle) bone, by list or in the preview; a picked foot's leg is the foot and its two parents. |
| Keep feet planted | Feet stay exactly where your animation puts them; the body still sinks and sways and the knees bend to make up the difference (two-bone IK per leg). On by default. |
| Heavy steps | Each footfall drops the body into the step and nods the chest and head. Footfalls are found from the feet touching the ground (green ticks). |
| THUNK | The weapon connects: the pose holds for a beat, then catches up; heavy bones bounce back. |
| THUNK sound | Pick a game sound (from your Warcraft III files); you hear it at each THUNK in the preview, and Commit adds it as a sound event (SNDx…) on the weapon so it plays in game. |
| Hit sound | Like THUNK sound, for flinches: the sound event goes on the body that takes the hit. Both pickers have a search box. |
| Flinch | The unit is hit from the front: the body is knocked back, the torso snaps back, then recovers. |
| Also apply to | Commit shapes other animations too, with the same sliders and bones. |
| Commit as new | Keeps the original and adds the shaped version as a new animation, "<name> (AnimXL)". One Undo removes it. |
| Arcs | Draws the path the weapon tip follows through the animation over the preview: dashed for the original, orange for the AnimXL version, with a dot at the current moment. Needs a heavy bone (the weapon). |
| Original / Side by side | Compare with the unshaped animation, alone or next to it with a shared camera. |
| Undo (Ctrl+Z / Ctrl+Y) | Steps through slider changes inside AnimXL. |

Weapon, cape, hair and tail bones are guessed from bone names. Change them with the pickers, or **Pick in view** and click bones in the preview.

The strip under the preview shows key poses (diamonds, orange once moved), footfalls (green ticks), THUNKs (stars) and flinches (red marks). Click it to jump to a moment; drag a diamond, star or red mark to move it.

Slider settings are remembered per model and animation until you commit.

AnimXL opens showing your animation unchanged; nothing moves until you move a slider or pick a preset. Shaping runs in a background worker, so sliders stay smooth on long animations of big models.

## How it works

`src/anim-xl.js` samples the authored animation as a target pose, runs a spring per bone in world orientation (so children lag their parents), and reduces the result back to smooth (squad) keys. Linear rotation tracks become Bezier; keys of other animations get flat tangents, so they play exactly as before. The body (from POSE's rig reading, bone names, or your pick) gets a translation spring for Weight, Heavy steps and Flinch. Afterwards, two-bone IK puts planted feet back on their authored path and keeps a two-handed grip on the weapon.

The weapon is found from bone names or the model's "Weapon Ref" attachment; hands, limbs, mounts and shields are never guessed as the weapon.

Hand-keyed animations use their own key times as the poses Ease preserves. Densely keyed animations use the moments where the body slows to a stop, and AnimXL says so.

Looping animations end exactly where they start: AnimXL pre-rolls whole cycles so the springs settle into the loop, then eases the last quarter onto the first pose. This also repairs loop seams already in an animation (for example a cape that jumps at the loop point).

Ease, retiming and THUNK holds also retime keyed translations, so a jump or a crouch stays in step with the rotations.

## Limits

- Rotations and translations only; scaling keys keep their original timing.
- Eased motion needs extra keys: shaped animations carry roughly 4 keys per move per bone.
- Overlap means children reach a pose slightly after their parent unless Hit poses is set to Exact.
- Bones with global-sequence or billboarded rotation are left alone.
- Heavy steps and foot planting need feet that touch the ground; a rider's feet in stirrups are left free.
- The two-handed grip has not met a real two-handed model yet (none of the local test units has one).
- AnimXL's own window text is English only; its module name is not translated, like OptimizeXL.

## Checks

- `node --test test/anim-xl.test.js`
- Packaged mouse check: `MDLXL_PLAYWRIGHT_MODULE=<playwright> MDLXL_ANIMXL_EXE=<MDLxL.exe> node test/anim-xl.electron.cjs`
- Contact sheet of one animation (Original and presets over time): `node test/anim-xl-filmstrip.electron.cjs <model.mdx> "Attack - 1" Natural Heavy`

Verified locally on 29 unit models (335 animations, every slider on, no failures; slowest build about 400 ms, in the worker), and MDX/MDL save-and-reopen gives identical poses. Foot slip under heavy Weight and Overlap drops from 4–14 units to about 0.5–1 on walks. Sound events survive MDX and MDL save-and-reopen.
