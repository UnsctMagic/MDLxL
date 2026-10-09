# Posing in Movement

POSE adds optional hand, foot, Bend and body handles to the existing Movement
editor. Ordinary bone Move, Rotate and Scale remain available beside them.

## First hand or foot

1. Open **Movement (F3)**, choose an animation and a frame, then enable **POSE**
   in the existing Tools section.
2. Select the actual hand/foot endpoint in the **Object** picker. Open
   **Setup…**. Its real parent and grandparent are suggested automatically.
3. Choose **Hand** or **Foot**, check **Upper joint**, **Elbow / knee** and
   **Hand / foot**, and click **Add handle**. Correct the selectors if needed.
   The three joints must be adjacent Bone/Helper nodes; setup never skips a
   helper, reparents a joint, or changes skinning. Close the popup.
4. With **Move**, drag the hand ring or foot square. Its starting world
   orientation and the limb's sampled lengths are retained. **Rotate** turns
   the endpoint. With **Move**, drag **Bend** to steer the elbow/knee while
   keeping the endpoint in place.

The ring surrounds the real bone marker. Its center and the Object picker still
select ordinary bones. Choose a real bone to use ordinary Move, Rotate or Scale
(Resize), including chest/upper-arm edits. Return to a POSE handle at any time;
it starts from the resulting pose without a matching/conversion step.

## Move the body with pinned feet

1. Add one or two **Foot** mappings through the same setup popup.
2. In Setup, click **Suggest body**, check the highlighted real ancestor, and
   click **Confirm body**. It must drive every configured leg root. Close Setup.
3. Select a foot handle and click **Pin foot**. Select the other foot and pin
   it too when both feet should stay planted. Orange handles show **PIN**.
4. Select the **Body** diamond and use **Move**. Pinned legs compensate together
   to retain their captured foot positions, orientations and lengths. Unpinned
   limbs follow their existing hierarchy. An unreachable body preview is
   rejected in full with a local explanation.
5. Select a pinned foot and click **Pinned** to release it.

Pins apply during deliberate body gestures at the current pose. Direct bone
edits, scrubbing and sequence changes rebase the next gesture to the newly
sampled feet. Pinning, setup and POSE toggles do not create keys. Pins do not
maintain contacts between keyframes or run a solver during playback.

## Navigation, history and native keys

Workplane off uses the camera-facing plane; an axis-gizmo drag follows its axis.
Workplane on uses the existing XY/ZX/YZ and Shift behavior. Normal Alt+mouse
camera rotation and wheel zoom remain available.

A drag previews on the renderer's private clone. Release commits one undoable
native edit; Escape cancels it. Losing capture/focus or changing the document,
frame, sequence, target or tool also cancels unfinished previews. A click with
no effective movement creates no key or undo step.

Limb Move/Bend write native Rotation keys; Turn writes endpoint Rotation. Body
Move writes body Translation and the pinned legs' Rotation keys. Highlight KF
shows the relevant native channels. Select a real bone/channel for existing
controller, copy, paste and delete tools; a visual chain highlight does not
select all of its keys for editing.

Save normally as MDL or MDX. Mappings, pins, handles and bend memory belong to
the open model session, so reopening requires setup again. Bones continues to
show the unanimated/rest rig. POSE is absent from Bones and Portrait editing.

## Supported boundary

Ordinary rigid SD two-link chains support rotated/transformed ancestors,
mirrored layouts and positive uniform scale. Setup explains unsupported rigs:
nonuniform/reflected/singular transforms, billboarding ancestry, non-default
inheritance flags that the bundled renderer does not reproduce, malformed or
cyclic hierarchy, missing/coincident joints, and invalid transform data.
Affected global controllers and shared sequence timestamps are rejected before
writing. Body handles support Move; use the real body bone for Rotate/Scale.

No balancing, physics, anatomical limits, persistent constraints, contact baking,
automatic animation generation or rig repair is added.

See [verification evidence](POSE_IK_VERIFICATION.md).
