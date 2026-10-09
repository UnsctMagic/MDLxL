# Posing in Movement

POSE uses the existing Movement tools and sidebar. Enable it once to get the
hands, feet and main body controls recognized from the model's names and actual
hierarchy. Setup is optional for ordinary named rigs.

## Start posing

1. Open **Movement (F3)**, choose an animation and frame, then click **POSE** in
   **Tools**. Recognized hands, feet, Body, Chest, Pelvis and Head appear in the
   view where the model provides them.
2. Click a handle's symbol or label. Use the existing **Move**, **Rotate** or
   **Scale** tool. Move a hand or foot to bend its limb; Rotate turns its
   endpoint. Drag **Bend** with Move to steer the elbow or knee.
3. Select a hand or foot and click **Pin** when it should stay in place. The
   handle turns orange and shows **PIN**. Click **Pinned** to release it.
4. Move, Rotate or Scale **Body**, or move another ancestor such as **Chest** or
   **Pelvis**. Affected pinned limbs compensate together. Unpinned limbs follow
   their native hierarchy. An oversized drag stops at the reachable boundary
   and shows **Reach limit**, retaining the valid movement.

Handles use hand, boot, helmet, chest plate and Trollface pelvis symbols on dark
backings so they remain identifiable over bone markers. Whole-body control uses
a person symbol. Repeated clicks cycle through all handles and visible bones
under the pointer, including with Move, Rotate or Scale active. Dragging keeps
the currently grabbed object; labels select their named control directly.
Nearby Body, Chest and Pelvis pivots keep separately clickable labels.

**Controller** and **Restrictions** start minimized; click their existing headers
to open them. **Rotate on Own Axis** is removed. Normal Alt+mouse camera rotation,
wheel zoom, axis gizmos, XY/ZX/YZ workplanes and Shift constraints remain available.

## Other objects and unusual rigs

Select any actual node in the view or existing **Object** picker to use its
ordinary Move, Rotate and Scale controls with POSE enabled. In **Setup…**, choose
an **Object** and click **Add object handle** to keep its labeled handle visible.
Bones, helpers, attachments and other native nodes retain their existing roles.
An attachment/reference handle controls that node; it does not acquire skin
weights or become a new bone.

For unnamed or unusual limbs, expand **Custom limb…**. Select the hand/foot in
the Object picker and click **Suggest selected chain**, or choose the three
joints explicitly. The upper joint and elbow/knee must be Bone or Helper nodes;
the endpoint may also be a native reference/attachment. Two adjacent parent
links are required, including intervening helpers. Click **Add handle**.

Expand **Body node…** only to change the automatically suggested body ancestor.
Setup stays open while using the Object picker or selecting in the view. An
invalid suggestion clears its draft and displays an explanation inside Setup;
the editor and other controls remain usable.

## Edits, history and saving

Each gesture starts from the current sampled pose. Pins hold the endpoint pose
captured at that gesture's start. Deliberately moving a pinned endpoint moves it;
scrubbing or editing an animation rebases the next gesture to the new pose.
Pins do not maintain contacts between frames or run during playback.

A drag previews on the renderer's private clone. Release commits one complete
native edit, including compensating limbs. Escape cancels the preview without
adding a selection Undo step. Losing capture/focus or changing the document,
frame, sequence, target or tool cancels unfinished previews. A click or drag
back to the starting grip creates no key or Undo step.

Hand/foot Move and Bend write native Rotation keys. Rotate writes endpoint
Rotation. Direct Body/object tools write the corresponding Translation,
Rotation or Scaling channel plus affected pinned limbs' Rotation channels.
Highlight KF shows these native channels. Existing controller and key editing
continues to use explicitly selected real nodes and channels.

Save normally as MDL or MDX. Mappings, pins, handles and bend memory belong to
the open model session. Reopening starts with fresh session controls; enable
POSE to recognize the rig again. Setup, pinning and toggling create no keys.
Bones retains the rest rig. POSE is absent from Bones and Portrait editing.

## Supported boundary

IK compensation supports rigid SD two-link chains with positive uniform scale.
It uses the current native hierarchy and never reparents, repairs, stretches or
changes skinning. Unsupported IK ancestry includes nonuniform/reflected/singular
transforms, billboarding, inheritance flags the preview renderer does not
reproduce, malformed/cyclic hierarchy, missing/coincident joints and invalid
transform data. A problem applies to that mapping or constraint; independent
direct controls continue to use ordinary Movement behavior.

Native edits require an editable local animation interval. Affected global
controllers and shared sequence timestamps cannot be overwritten by POSE.
Configuration remains available independently of the editing interval.

This is a posing controller; balancing, physics, anatomical limits, contact
baking, automatic animation generation and rig repair are outside its scope.

See [verification evidence](POSE_IK_VERIFICATION.md).
