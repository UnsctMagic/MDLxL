# Weight in Movement

Weight creates preparation drag, a decisive strike, recoil and settling, or a
heavier foot landing. It uses the existing poses, skeleton and carried geometry
and leaves ordinary editable native keys. It is an animation assistant, not a
collision simulation.

## Use

1. Choose an animation in Movement, enable **POSE**, then click **Weight**.
   A range and vertex selection are optional. The full animation is used unless
   you selected a portion with Shift-drag first.
2. Choose a hand, foot or controller in **Part**, or click its POSE handle.
   Visible attached geometry supplies the initial carried area.
3. **Swing** offers **Drag**, **Recoil** and **Body response**. **Step** offers
   **Hang time**, **Stomp** and **Body response** for a lifted foot. Use modest
   settings when the original motion already has strong weight.
4. Playback starts at 100%. **Pause/Play** and **Original** compare the result.
   Normal playback speed and mouse camera controls remain available.
5. Under **Adjust hit / selection**, move Swing's hit or use **Hit at playhead**.
   Step shows its detected landing. **Whole animation** removes a portion
   restriction. **Pick vertices** refines the carried area on the visible model;
   Shift adds. **Use attached part** restores automatic selection. This temporary
   picker preserves normal editor selection.
6. **Apply** keeps one ordinary animation edit. **Cancel**, Escape, the close
   button or toggling Weight off discards the preview. Saving or leaving the
   workflow keeps a valid pass; an error must be resolved or cancelled. Normal
   Undo/Redo and native key editing work afterward.

The movable dialog adds no permanent sidebar space. Refinement controls start
collapsed. Each slider recomputes from the captured original; slider changes do
not accumulate passes. Zeroing all three responses restores the original.
Reopen Weight to add another pass, such as the other foot.

## Following the model

Skin bindings identify which joints carry the geometry. Triangle surface area
weights its center; distance from the grip estimates rotational inertia. Vertex
density alone does not decide which part is heavy. These are geometric proxies;
sliders supply artistic strength, not kilograms. Geometry, bindings, pivots,
textures, hierarchy and joint lengths are preserved.

Swing samples linear and angular motion for a stroke and braking event. It
prefers a stop with time to register over a fast return to the ready pose. This
is a heuristic; the hit control corrects animations with several plausible hits.
A monotone time map delays preparation and accelerates into the hit. Increasing
lag along the limb creates overlap. Native local rotations retain the authored
pose path; limb translations are not delayed or stretched. Incoming rotation
sets the plane for bounded overshoot, recoil and a smaller settle. A final-key
strike is brought forward to make room for recovery inside the same interval.
Torso response uses the nearest shared limb ancestor and measured arc, so a
rider's arm responds through its torso rather than automatically moving a mount.

Step detects lift and landing from the foot path. Hang time retimes the lifted
phase. Compression and rebound use the existing POSE body solver with native
foot positions and orientations held at each frame. This preserves source
contacts; it does not repair sliding already present in the source. Matching
looping walks carry the response through the seam, including late landings.
Their two boundary poses can change together. Other clips and selected portions
fade back to authored boundary poses.

## Native output and boundaries

The worker calculates while the native renderer plays. One active calculation
and a latest-request queue handle slider changes. Accepting a pending request
finishes it before the single document edit. Preview and Original comparison do
not modify the saved document.

Output retains existing timestamps and interpolation types. Added keys are
fitted against Warcraft interpolation with angular tolerance 0.005 radians and
translation tolerance 0.0007 of limb length. Temporary samples are not all saved.
Complex curved rigs and pinned-body steps can still produce many keys: this is
an editable starting pass, not hand-authored minimal key counts.

Other animations and keys outside a selected portion remain unchanged. Partial
cubic tracks need two enclosed authored knots per affected channel; participating
channels share their innermost guard interval. Outward boundary tangents remain
original. If the hit falls outside those guards, widen the portion or move it.

Global controllers, overlapping sequence timestamps, constant interpolation,
unsupported POSE transforms and active restrictions report errors. A still part
cannot invent a swing; Step requires a lifted foot. Selected skin must belong
to the chosen branch. SD and HD bindings are read; broad real-model coverage is
SD, with a synthetic HD binding check.

## Animation references

- BlinkBoy's [3ds Max animation tutorial](https://www.hiveworkshop.com/threads/in-depth-animation-tutorial-3ds-max.123520/)
  breaks attacks into preparation, a quick hit and recovery, with additional
  poses, torso participation and planted feet. These inform the staged response.
- BlinkBoy's [Happy animating with IK](https://www.hiveworkshop.com/threads/happy-animating-with-ik.256580/)
  treats IK as an authoring aid exporting ordinary keys. Weight reuses POSE and
  leaves native channels available for later refinement.
- Autodesk's [3ds Max Ease and Multiplier curves](https://help.autodesk.com/cloudhelp/2017/ENU/3DSMax/files/GUID-7FDB51E0-73D4-42FA-A44F-D6F676A243A3.htm)
  distinguish timing from track intensity. Separate drag and recoil controls
  follow that distinction.
- Autodesk's [Animation Layers](https://help.autodesk.com/cloudhelp/2026/ENU/3DSMax-Animation/files/GUID-ACAD407C-B079-4DAB-9DD0-6C8DC22389EF.htm)
  inform the reversible preview over an unchanged base. Apply bakes native keys;
  MDLxL does not claim to store Max-style layers in MDX.
- Animation Mentor's [Timing](https://www.animationmentor.com/blog/timing-the-12-basic-principles-of-animation/)
  and [Follow-through and overlapping action](https://www.animationmentor.com/blog/follow-through-and-overlapping-action-the-12-basic-principles-of-animation/)
  explain how spacing, drag and settling communicate weight. Numerical response
  curves here are implementation choices, not tutorial-supplied physics equations.

## Verification and visual review

The supplied Peon is the primary visual gate. Local comparisons also cover
Footman, Kurgan Warlord, Knight of Tzeentch and dragon/Footman/Peon walking.
Both supplied Peon variants also have generated native examples.
There are no model-name rules. Supplied models are not redistributed in the PR.

- `test/pose-weight.test.js`: three swing planes, angular motion with a stationary
  mass center, final-key strike recovery, geometry/HD bindings, exact outside
  motion, native serialization, key refinement and history, Footman foot contacts
  during compression, and Peon's late landing across the loop seam. Asset cases
  skip when their local fixtures are absent.
- `test/pose-weight-corpus.test.js`: 64 arm passes across 32 eligible models in
  the preserved 35-model SD corpus; native round-trips, untouched non-transform
  data and other clips, quaternion validity, source hashes and Undo.
- `test/pose-weight.electron.cjs`: the packaged Peon workflow, default access,
  Original comparison, latest slider requests, hit adjustment, vertex picking,
  target changes, restrictions, Cancel, Apply/Undo/Redo, Save As/reopening and
  actual mouse camera rotation.
- `test/pose-weight-entry.electron.cjs`: preselected Footman hand entry and four
  real hand/foot drags. POSE entry maps that native selection to its recognized
  connected controller instead of retaining the independent-bone Move gizmo.

Disposable evidence and comparison clips are in `out/weight-redesign`. The
candidate is `out/weight-review-package/MDLxL-win32-x64/MDLxL.exe`, in its own
portable directory with separate test profiles. Installed copies and personal
profiles are not upgraded. Warcraft III in-game playback and the owner's visual
acceptance remain separate from automated validation.

Verified on 2026-10-11: all 12 Weight source checks passed; the preserved corpus
passed 36 tests (64 arm cases) with its optional-fixture placeholder skipped.
The packaged workflow passed eight groups with no renderer errors, including
Step across the loop seam and returning a real timeline portion to Whole
animation. The entry test passed four limb drags and the preselected-hand case.
Packaging verified 559 runtime/assets and 55 locales; bundled source and dist
hashes matched the worktree.

The broader 230-check animation/component/compatibility run passed 220 and
skipped seven. Three unrelated failures reproduced on the unchanged starting
commit `30bc4fc5`: All-line RGB values, Quick display option count, and rest-pose
round-trip pivot ordering. They are not reported as passing or changed here.
