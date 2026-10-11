# Weight in Movement

Weight authors a load or follow-through pass over an existing local animation.
It uses the selected POSE controller, the existing timeline and the model's
native skeleton. Selected vertices describe the carried part; their bindings,
geometry, pivots and texture paths are not edited.

## Use

1. In Movement, enable POSE and choose a hand, foot or body-part controller.
2. Shift-drag a portion of its existing timeline, then click **Weight**.
3. **VERTICES** lets you click or box-select the carried part without leaving
   Movement. Shift adds vertices. An existing vertex selection is retained.
4. Choose **Heavy** for a sustained downward load, or **Swing** for drag,
   overtake and a small recoil after the existing motion slows down.
5. Use the existing **Play** button. The chosen portion loops, initially at
   **30%** speed. The speed field stays adjustable. Weight remains open and
   its amount can change during playback. Mouse camera rotation still works.
6. **Done**, the close button, leaving POSE, changing controller/animation or
   saving keeps the result as one ordinary animation edit. **Cancel** or
   Escape discards the preview. Normal Undo/Redo works after acceptance.

Weight starts at zero, which leaves the animation unchanged. Increasing it
always recomputes from the motion captured when Weight opened; it does not
repeatedly add another pass to the previous slider preview. Reopen Weight to
author a further pass. Ordinary Movement tools can refine the resulting keys.

The small movable dialog occupies no permanent sidebar space. VERTICES can be
toggled off after selection. The full setup dialog is not needed for a
recognized controller.

## Motion and native output

Heavy lowers the connected limb and turns its carried mass toward gravity.
Swing samples the selected mass, controller velocity and angular velocity.
Acceleration drives drag; a damped response carries momentum past deceleration.
A bounded recoil follows the strongest measured stop along the incoming motion,
including vertical motion. A stationary portion does not invent a swing.
This is an animation-authoring approximation, not a collision or dynamics engine.

Both styles fade back to the original boundary poses. Existing POSE solvers
and the Movement writer own the native transforms. The worker performs sampling
and fitting while the renderer continues playing; rapid slider events retain
the newest request. The renderer owns the preview clone. Saving/accepting a
pending request finishes that exact request before the single document edit.

Integration samples are temporary. Output retains authored key times and fits
additional Rotation/Translation keys against Warcraft interpolation, with a
0.007-radian angular tolerance and a translation tolerance of 0.001 limb length.
Key count follows the motion's complexity; it is not a key on every millisecond
or every display frame. The tested Footman partial attack produces about 60
keys across three tracks at Heavy 60%, including retained authored keys.

Keys and tangents outside the selected portion remain unchanged. For curved
controllers, exact preservation requires two enclosed authored knots on every
affected curved channel. The first/last enclosed knots and their outward
tangents remain original; all participating limb and offset-grip channels share
those guard poses. Select a wider portion when the dialog requests it.
Linear tracks can use newly sampled boundaries. The interpolation type is never
changed behind the user's back.

Global controllers, shared sequence timestamps, step controllers and unsupported
POSE transforms report an error rather than being overwritten. Selection must
belong to the chosen limb/body branch. Rotation restrictions also apply to the
live Weight preview. HD mass bindings are read without rebinding; the broad
fixture validation below covers SD rigs, with a synthetic HD-binding check.

## POSE entry correction

On main `76e7bbf`, selecting Footman's native hand before enabling POSE leaves
the POSE target empty while retaining its ordinary Move gizmo. Dragging that
gizmo writes only the hand's Translation. Fresh POSE handle clicks already use
the connected solver. This reproduced path explains an independent-hand
symptom without removing IK or altering the model.

Entering POSE now resolves that prior selection to the recognized endpoint or
body controller. An unmapped stale selection is cleared. Explicit native bone
marker selection after entry remains available. The packaged reproduction now
selects `limb:38` and writes connected limb/body Rotation keys, with no isolated
hand Translation. This is a proven Footman entry case, not a claim that every
possible independent-handle report has the same cause.

## References and decisions

- BlinkBoy's [Happy animating with IK](https://www.hiveworkshop.com/threads/happy-animating-with-ik.256580/)
  treats IK as an authoring abstraction over FK and describes exporting ordinary
  keys with redundant keys reduced. Weight likewise leaves native tracks for
  later editing and saving; it creates no second skeleton.
- BlinkBoy's [in-depth animation tutorial](https://www.hiveworkshop.com/threads/in-depth-animation-tutorial-3ds-max.123520/)
  discusses key poses, timing, attack preparation/hit/recovery and examining
  motion slowly. Those ideas inform the slow preview and preserving the user's
  authored action instead of inventing a replacement attack.
- WebSter's [XGM bone-animation tutorial](https://xgm.guru/p/wc3/anims-a-ya-2)
  explains characteristic movement, keyframes and interpolation. The result
  remains local bone animation, separate from skin weighting and global loops.
- Animator Drew Adams's [follow-through and overlapping-action lesson](https://www.animationmentor.com/blog/follow-through-and-overlapping-action-the-12-basic-principles-of-animation/)
  explains drag, inertia and settling after the driving motion. Swing derives
  its response from the actual motion rather than applying a fixed-axis wobble.
- Autodesk's [animation principles overview](https://help.autodesk.com/cloudhelp/2024/ENU/Maya-GettingStarted/files/GUID-0EABDA1B-D59E-4002-AAEC-75862DF6372B.htm)
  supports treating timing, anticipation, follow-through and arcs as authoring
  choices. The numerical spring settings are this implementation's choices,
  not equations supplied by these tutorials.

## Verification

- `test/pose-weight.test.js`: sustained load, horizontal/vertical drag and
  overtake, sparse fitting, exact outside motion, restrictions/global/shared
  protection, common curved grip guards, body/HD mass, native MDX round-trip,
  ordinary-key refinement and atomic history.
- `test/pose-weight-corpus.test.js`: 128 Heavy/Swing passes on 64 arm chains
  across 32 supplied SD models with attacks. Tests preserve every fixture's
  SHA-256, all non-transform model data, other animations' keys and tangents,
  native MDX round-trips and Undo. The 35-model manifest includes three models
  without eligible arm/attack pairs. Fixtures are local and not redistributed.
- `test/pose-weight-entry.electron.cjs`: four real hand/foot drags and the
  preselected-hand entry reproduction in a disposable portable profile.
- `test/pose-weight.electron.cjs`: real Shift-drag range, vertex selection in
  Movement, compact layout, initial playback measured near 30%, live native
  skeleton changes, rapid slider updates, restriction changes, actual Alt-mouse
  camera rotation, Cancel restoration, one Undo/Redo, leaving POSE, Save As and
  native MDX reopening. The window stays outside the desktop display area.
- Existing POSE source, Movement component and native compatibility checks are
  run alongside these focused checks. Evidence is under `out/pose-weight-*`.

The candidate is `out/pose-weight-package/MDLxL-win32-x64/MDLxL.exe`.
It uses a separate portable directory and test profiles. No installed copy or
personal profile is upgraded. This is an unshipped candidate; Warcraft III
in-game playback and the owner's visual acceptance remain unexercised.
