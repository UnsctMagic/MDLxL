# AnimXL

AnimXL shapes a hand-keyed animation with a few sliders and shows the result live on the model. Commit writes ordinary bone keyframes for that animation only, as one Undo step.

Open it with the **ANIM** module button (or Modules → AnimXL…).

## Controls

| Control | What it does |
| --- | --- |
| Ease | Speeds up out of each pose and slows into the next. Poses stay where they are. |
| Overlap | Parts further from the body follow a moment later (hips → chest → arms → hands → weapon). |
| Settle | Parts overshoot a pose slightly and wobble back into it. |
| Weight | The whole body is slower to start and stop. |
| Heavy bones | Picked bones (usually the weapon) trail the swing and drag the arm holding them. |
| Loose bones | Picked bones (cape, hair, tail) swing loosely on their own. |
| THUNK | At each THUNK the animation holds the hit pose for a beat, then catches up; heavy bones bounce back. |
| Original | Shows the unshaped animation for comparison. |

Weapon, cape, hair and tail bones are guessed from bone names; change them with the bone pickers.

## How it works

`src/anim-xl.js` samples the authored animation as a target pose, runs a spring per bone in world orientation (so children lag their parents), and reduces the result back to keys. Keys of other animations are kept exactly. Hand-keyed animations use their own key times as the poses Ease preserves; densely keyed animations use the moments where the body slows to a stop.

## Limits (v1)

- Rotations only. Translations, scaling and Weight's body sink are not written yet.
- Overlap means children reach a pose slightly after their parent; on held poses they settle into it exactly.
- Shaped animations carry more keys than hand-made ones (a 1-second attack on a 73-bone rig: about 2,000 keys).
- Bones with global-sequence or billboarded rotation are left alone.

## Checks

- `node --test test/anim-xl.test.js`
- Packaged mouse check: `MDLXL_PLAYWRIGHT_MODULE=<playwright> MDLXL_ANIMXL_EXE=<MDLxL.exe> node test/anim-xl.electron.cjs`
