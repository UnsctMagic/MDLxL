# Posing in Movement

POSE uses the existing Movement tools and sidebar. Enable it once to get the
hands, feet, hooves and main body controls recognized from anatomy names,
native references, hierarchy and skinned geometry. Setup is optional for ordinary named rigs.

## Start posing

1. Open **Movement (F3)**, choose an animation and frame, then click **POSE** in
   **Tools**. Recognized hands, feet, Body, Chest, Pelvis and Head appear in the
   view where the model provides them.
2. Click a handle's symbol or label. Use the existing **Move**, **Rotate** or
   **Scale** tool. Move a hand or foot to bend its limb; Rotate turns its
   endpoint. Drag **Bend** with Move to steer the elbow or knee.
3. Move or Rotate **Body** or **Pelvis**. Pelvis carries the connected body,
   including rigs where the chest is a sibling of the pelvis. Mapped limbs compensate
   automatically, keeping their hands/feet in place and oriented while reachable.
   Lower the body to bend the knees. Raise it farther to straighten the legs and
   lift the feet; the body keeps following your drag. Drag a hand or foot directly
   whenever you want to place it elsewhere.
4. Drag **Chest**, **Spine**, **Neck** or **Head** to bend the connected upper
   body. These grips sit on the part, above its joint. Head dragging shares the
   movement through the available neck/spine joints; joints rotate without
   translating apart. Chest movement carries the head while keeping its facing
   direction. Rotate turns the chosen part directly. Arms compensate as the
   torso bends. Select a small native bone marker for ordinary MDLvis transforms.
5. Select a hand or foot and click **Pin** only when it must stay fixed. The
   handle turns orange and shows **PIN**. Explicit pins can limit ancestor motion
   at **Reach limit**. Click **Pinned** to return to automatic compensation.
   Scale retains ordinary Movement behavior, with explicit pins compensated.

Handles use hand, boot, helmet, chest plate and Trollface pelvis symbols on dark
backings so they remain identifiable over bone markers. Whole-body control uses
a person symbol; hooves have their own symbol. Labels appear for the selected
or hovered handle. The Trollface uses the same cyan fill and yellow selection
highlight as other handles. Repeated clicks cycle through all handles and visible bones
under the pointer, including with Move, Rotate or Scale active. Dragging keeps
the currently grabbed object, even when another label overlaps its selected
symbol. A symbol takes priority over any label crossing it. Visible labels
outside symbols remain clickable.

**Controller** and **Restrictions** start minimized; click their existing headers
to open them. **Rotate on Own Axis** is removed. Normal Alt+mouse camera rotation,
wheel zoom, axis gizmos, XY/ZX/YZ workplanes and Shift constraints remain available.

## Other objects and unusual rigs

Select a native bone marker for ordinary Move, Rotate and Scale with POSE
enabled. The Object picker remains the standard Movement bone selector.

For a new handle, open **Setup…**, choose a part symbol and click its bone in the
viewport. Repeated clicks cycle overlapping bones as in Movement. The proposed
chain is highlighted on the model. **Add handle** confirms it; an invalid choice
only disables that button. Pick another bone without restarting setup or losing
the other handles. **Object** adds a direct control for another native node.

**Pick joints** exposes three dots for a custom shoulder/hip, elbow/knee and
hand/foot. Pick through the ordinary viewport selection, then use **Next joint**.
Click a dot to correct it. Cycling overlapping bones stays within the active dot.
No bone-name dropdowns or permanent panels are added. Escape or closing Setup
ends picking and restores the existing bone display.

Horse-and-rider recognition maps full multi-joint hoof chains, both rider hands,
boots and upper bodies. Native head/hand references identify unnamed anatomical
parents; skinned descendants below knees identify unnamed boots. Duplicate
mount body roots with the same authored pivot are carried together when one
owns the rider. Moving the horse carries its rider without reparenting the rig.
The rider's own body handle bends around its seat; individual controls remain
available. These rules are based on the model structure, never model filenames
or fixed node IDs.

## Edits, history and saving

Each gesture starts from the current sampled pose. Automatic targets retain
their requested endpoint pose across repeated ancestor drags, even beyond reach:
raise the body, release, grab it again and lower it to bring the feet back.
Direct bone/endpoint edits, a different frame or a changed pose rebase targets
from the native animation. Explicit pins capture the current endpoint pose;
deliberately moving a pinned endpoint moves it.
Pins do not maintain contacts between frames or run during playback.

A drag previews on the renderer's private clone. Release commits one complete
native edit, including compensating limbs. Escape cancels the preview without
adding a selection Undo step. Losing capture/focus or changing the document,
frame, sequence, target or tool cancels unfinished previews. A click or drag
back to the starting grip creates no key or Undo step.

Hand/foot Move and Bend write native Rotation keys. Rotate writes endpoint
Rotation. Connected upper-body Move writes Rotation on its spine/neck/head
joints and compensating arms. Ancestor controls also write Head Rotation to
retain its facing direction. Pelvis writes the shared body driver; separate carried roots receive native
Translation/Rotation keys. Direct Body/object tools write the corresponding
Translation, Rotation or Scaling channel plus compensated limbs' Rotation
channels. Native markers retain ordinary FK tracks; handles and markers share
one skeleton and timeline.
Highlight KF shows these native channels. Existing controller and key editing
continues to use explicitly selected real nodes and channels.

Save normally as MDL or MDX. Mappings, pins, handles and bend memory belong to
the open model session. Reopening starts with fresh session controls; enable
POSE to recognize the rig again. Setup, pinning and toggling create no keys.
Bones retains the rest rig. POSE is absent from Bones and Portrait editing.

## Supported boundary

Limb IK supports rigid SD two-link and longer hoof chains; upper-body handles
follow the actual spine/neck hierarchy. Both require positive uniform scale.
Quantized SD quaternion roundoff is measured separately from authored scale.
Recognition is structural and heuristic; unusual rigs can still need manual picks.
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
