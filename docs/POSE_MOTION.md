# Motion in POSE

Motion helps turn a few authored poses into an editable animation. It preserves
chosen poses, shapes the movement between them, and coordinates connected body
parts. The input is the model's own animation. Reference Warcraft animations are
used for evaluation, not copied into generated output.

## Workflow

1. Create an animation in Movement. Enable **POSE** and make the important poses.
   Copy the first pose to the last frame when a matching loop is wanted.
2. Click **Motion**. It uses the current animation, or the portion selected with
   Shift-drag before opening it. No selected vertices or weapon are required.
3. Motion starts with **Flow** for general pose transitions. Choose **Swing**
   for an attack or **Step** for walking. Timing controls acceleration between
   poses. Swing also offers **Follow-through** and **Body response**. Step uses
   **Hang time**, **Foot lift** and **Landing response**.
4. Play at 100%, 50% or 25%. Playback speed changes the preview only.
5. Enable **Side by side**. Each view can show **Original**, **A** or **B**.
   **Edit A/B** chooses which independent settings to adjust; **Copy A/B** copies
   a starting point to the other variant. Both views share time and camera;
   normal mouse rotation works in either view.
6. Under **Poses and feet**, inspect the kept poses or keep another pose at the
   playhead. Swing calls this **Poses, hit and feet** and also lets you choose
   the intended hit. Automatic suggestions are geometric estimates and can
   require correction.
7. **Commit A/B** writes that variant as one ordinary undoable animation edit.
   Continue with the existing bone editor or POSE. Cancel, Escape, closing Motion,
   saving, or leaving the workflow discards the uncommitted preview.

The movable controls use no permanent sidebar space. Every adjustment starts
from the captured original, so slider changes do not accumulate damage. Setting
all motion amounts to zero returns to the original. A/B comparisons remain
temporary; MDX stores the committed native tracks, not procedural layers.

## Motion and pose constraints

Sparse input keeps its pose anchors exactly. More densely keyed animation uses
a small set of suggested geometric landmarks and retains its detailed source
motion through shared retiming. Dense input therefore does not promise every
original timestamp will display its former pose. The kept-pose controls make
that boundary visible and editable.

The whole connected pose uses one time map. Swing adds preparation, faster
arrival at the selected hit, a bounded continuation and recovery. Body response
uses the existing POSE solvers so torso participation can retain intended hand
paths and supported feet. Visible skin ancestry helps exclude inactive rigs;
connected actor selection distinguishes a rider's action from the mount.

Step has separate leg/contact processing. Visible foot geometry supplies sole
offsets, while knee bends and existing support trajectories supply stride
direction. It reconstructs sparse foot paths; detailed walks retain their
existing paths. The ground is the editor's XY plane at Z=0 by default. Set
**Ground height** under the collapsed options for a different floor.

Step needs at least two mapped legs with visible foot geometry and an identifiable
stride. Ambiguous direction reports an error. Arbitrary airborne poses do not
define a unique landing; authoring useful contact poses remains part of the
workflow. This is animation assistance, not automatic collision detection,
anatomical understanding, or a guarantee of polished motion from any two poses.

## Native output and boundaries

A worker calculates previews on a detached model while the original document
remains unchanged. Each variant accepts only its latest requested result. Commit
writes native Rotation/Translation keys through the existing document history.
Geometry, skin bindings, pivots, hierarchy, scaling and other animations are
preserved. Required poses and matching loop endpoints retain their source values.

Generated samples are reduced against native interpolation. They are an editable
starting pass, not a promise of minimal hand-authored key counts. Complex rigs
take longer to calculate and may need manual POSE mapping or smaller changes.

Classic models can contain rounded, nonunit quaternions. Kept poses use the exact
native samples. Native Linear quaternion interpolation is not invariant under
subdivision: inserting a key can change the path between poses even when their
orientations agree. Motion retains the controller format and does not promise
exact reproduction between kept poses. The research notes quantify this remaining
limit on the Knight and Dragon; review detailed imported clips in A/B playback.

Affected global controllers, overlapping sequence timestamps, restricted edits,
constant interpolation and unsupported POSE transforms report an error instead
of silently changing unrelated data. Curved partial ranges require suitable
authored boundary keys. A still animation needs at least two different poses.

## Evidence

[Research notes](POSE_MOTION_RESEARCH.md) record the original game-model study,
the supplied physics demonstration, and the construction of sparse test inputs.
The original detailed animations are removed from those inputs before generation.

- `test/pose-motion.test.js` checks coordinated timing, exact kept poses, native
  tracks, connected body response, restrictions and source preservation.
- `test/pose-motion-corpus.test.js` reads an optional local manifest from
  `MDLXL_MOTION_CORPUS`. It checks sparse and dense original/custom models,
  saved/reopened native-renderer anchor matrices, other-clip preservation,
  source hashes and Undo/Redo.
- `test/pose-motion-step.test.js` checks foot clearance, support, exact anchors,
  stride direction and preservation of detailed trajectories.
- `test/pose-motion.electron.cjs` exercises the packaged UI, independent variants,
  real mouse rotation, synchronized playback and commit/discard behavior.

Local model assets and generated media are not redistributed with the source.
Native preview and serialization tests are separate from Warcraft III in-game
playback and the owner's visual acceptance.

### Local verification, 2026-10-11

- The final local manifest covers 45 sparse/detailed model, action and style
  combinations, including Flow, Swing and Step. All passed after native MDX
  serialization and reopening. Combined with 32 focused Motion/Step tests, the
  final run passed 77 checks with one unused-fixture placeholder skipped.
- The related POSE/IK/complex-rig/performance run passed 87 checks, with six
  optional local-fixture checks skipped.
- A broader animation/Movement run passed 156, skipped six and failed five.
  The same five failures were reproduced on unchanged commit `30bc4fc5`:
  animation-track parser exception, RGB/visibility bake reopening, All-line RGB,
  Quick display option count and rest-pose pivot ordering. They are not reported
  as passing or changed by this feature.
- Native captures cover sparse attacks, three-pose walks and detailed custom
  animations. Source model assets remain local and unchanged; the generated
  clips are separate test copies.
- All seven packaged workflow groups passed with zero renderer errors: native
  preview, independent variants and synchronized clocks, real mouse rotation,
  kept-pose editing, discard/save behavior, one-step commit/undo/refinement,
  creating an animation through POSE, and Step settings/commit. All 262 packaged
  `dist` files matched the source build byte-for-byte.

The local review executable is
`out/motion-review-package/MDLxL-win32-x64/MDLxL.exe`. Its build evidence and
screenshots are in `out/motion-ui`; it uses a disposable test profile. This is a
review candidate, not a merged release or an owner-approved aesthetic result.
