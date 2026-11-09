# Posing in Movement

POSE uses the existing Movement tools and sidebar. Enable it once to get the
hands, feet, wings, tail and main body controls inferred jointly from the native
skeleton and the surface it deforms. Names resolve ambiguous alternatives; they
do not select the initial anatomy. Setup remains available for manual mappings.

## Start posing

1. Open **Movement (F3)**, choose an animation and frame, then click **POSE** in
   **Tools**. POSE starts in Move. Recognized hands, feet, Body, Chest, Pelvis and Head appear in the
   view where the model provides them.
2. Click a handle's symbol or label. Use the existing **Move**, **Rotate** or
   **Scale** tool. Move a hand or foot to bend its limb; Rotate turns its
   endpoint. Hands and feet pull their connected torso or body slightly as you
   move them, while other limbs compensate and explicit pins stay fixed.
   **Restrict**, immediately left of Setup, turns off this body lead. It starts
   off. It does not disable limb IK, bending, direct body movement or pins.
   Selecting a limb also reveals its labeled **Elbow** or **Knee**
   control (**Bend** on custom chains). Drag it with Move to aim the bend
   (a swivel: the hand/foot stays in place and keeps its facing direction).
   Rotate works exactly as on every other handle: the same rotation rings
   appear on the elbow or knee joint itself, and dragging a ring (or the
   control) turns that joint so the forearm or shin swings with it. Shift
   snaps as usual. With a pinned hand or foot, Rotate turns the elbow or knee
   around the pin while the endpoint stays fixed.
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
5. Select a hand, foot, elbow or knee and click the adjacent **Pin** button when
   its endpoint must stay fixed. The button uses the appearance set's pinned colour;
   the labeled style reads **Pinned** and icon styles fill the pin symbol.
   a small pin badge stays on the endpoint even after you select the body.
   Click **Pinned** again to release it. Space or Enter also toggles the focused
   button. Pinning pauses playback at the current frame and creates no keys.
   The button keeps its size and position while you use it, follows the limb
   when the camera moves, and hides during a drag or when that limb is offscreen.
   It sits on the character's outside flank, beyond the transform arrows.
   Explicit pins can limit ancestor motion at **Reach limit**. Scale retains
   ordinary Movement behavior, with explicit pins compensated.

Handles use hand, boot, helmet, chest plate and Trollface pelvis symbols on themed
backings so they remain identifiable over bone markers. Whole-body control uses
a person symbol; hooves have their own symbol. Labels appear for the selected
or hovered handle. Pelvis uses the same handle and selection colours as the other
controls. Repeated clicks cycle through all handles and visible bones
under the pointer, including with Move, Rotate or Scale active. Dragging keeps
the currently grabbed object, even when another label overlaps its selected
symbol. A symbol takes priority over any label crossing it. Visible labels
outside symbols remain clickable.

**Restrictions** starts minimized; click its header to expand it. **Controller**
starts expanded, with Highlight KF and Highlight Chain above Controller type.
Movement's passive object statistics sit under **Details**.
Coordinates appear for a real selected node; empty numeric rows and an empty
Connected Bones list stay out of POSE's way. Bones keeps its existing inspection
controls. **Rotate on Own Axis** is removed. Normal Alt+mouse camera rotation,
wheel zoom, axis gizmos, XY/ZX/YZ workplanes and Shift constraints remain available.

## Other objects and unusual rigs

Select a native bone marker for ordinary Move, Rotate and Scale with POSE
enabled. The Object picker remains the standard Movement bone selector.
POSE has no separate Helpers switch: **Bones** also shows Helper markers, since
rigs such as the SD Footman keep the pelvis, chest and head in Helpers.

Open **Add** for the new handle symbols, or choose **New bone chain**. Click the bone you want to
move. The connected limb is suggested and highlighted. Click **Add handle**.
Repeated clicks cycle overlapping bones and refresh the suggestion.

**Adjust chain** reveals Start, End and all intermediate bending joints. Click a
field, then its bone in the Movement viewport. The existing Object picker and
**Use selected bone** also work. There is no three-joint limit; uncheck a bend
if it should only follow its parent. Explicit Start choices remain yours.

If two chains start at the same body/pelvis joint, **Use separate limbs** offers
to start each chain on its own branch. Review the highlighted chain, then save;
both mappings update together. Cancel changes neither. Unresolvable overlaps
remain editable and identify the existing handle.

**Add** opens the handle symbols directly and stays ready for another handle after
saving. **Setup** only lists or edits existing handles. Opening Setup with a
selected handle goes directly to its editor. Retarget, remove and all detailed
joint choices remain available. Setup writes no animation keys or bone parenting.

Click a hand, foot or hoof handle to reveal **Pin** next to it in the viewport. Clicking
Pin toggles it to Pinned; click again to release it. The button follows the
selected foot during camera movement and disappears when another control is
selected. Hand pinning remains beside the Movement controls.

Setup stays open while you pick or turn the camera. Drag its title bar if it
covers a bone. Escape or the close button ends picking and restores the previous
bone display. Sidebar widths and the normal Movement layout stay unchanged.

Horse-and-rider recognition keeps separate body assemblies and the native links
within each limb. Independent rider roots can follow a mount through measured
contact, elevation and relative authored motion. Moving the mount carries the
rider without reparenting it, while the rider retains its own controls. The
recognizer has no model filenames, fixed node IDs or prescribed limb/head count.

## Edits, history and saving

With POSE on, **Copy** / **Ctrl+C** captures the whole current pose, including
interpolated transforms between stored keys. Move to another frame or animation
and use **Paste** / **Ctrl+V** to restore it in one Undo step. The timeline menu's
**Copy Pose** does the same. Transform restrictions and global controllers keep
their existing ownership. **Copy keyframes** still copies stored keys; with
POSE off, ordinary Copy retains its normal keyframe behavior.

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
Rotation. Elbow/knee Rotate writes the limb root and endpoint Rotation, retaining
intermediate tracks on rigid chains. Coarsely rounded SD rotations use the existing
limb solver for correction; an offset mesh grip may need endpoint Translation.
Connected upper-body Move writes Rotation on its spine/neck/head
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

Limb IK supports rigid SD two-link and longer connected chains; upper-body handles
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

The limb controls use separate endpoint and knee/elbow manipulators, retain
endpoint orientation, and save animation as ordinary Warcraft bone keys. POSE
works with the model's existing SD rig; enabling it requires no re-rigging or
animation removal.

## Complex SD rigs

Body follows the authored whole-body driver rather than an arm junction. This
keeps a robe or skirt attached when its bones branch below the chest. Head and
chest handles use anatomical joints instead of separately named mesh pivots.
Long limbs retain their real intermediate joints; they are not shortened to fit
a three-joint template.

Mounted rigs with an inferred native seat anchor can carry a separately animated
rider. Moving or bending the mount applies the seat's change to the rider using
native keys. The rider keeps its own body and limb grips. Dragon wings and tails
use their own symbols, also available in the same click-a-bone Setup palette.
Original hierarchy, skin weights, pivots, texture paths and existing animations
are never rewritten by recognition. Setup mappings still belong to the editor
session, so unusual rigs can be mapped through the same visual workflow.

The crosshair button beside Setup controls blocker pings. Red means enabled
(the default); click it to turn it black and disable pings. It does not release
pins or change the pose.


## Recognition from skeleton and skinned shape

Automatic setup measures weighted surface regions, their connectivity and shape,
together with native joint positions, paths and branch attachments. Head, limb,
wing and tail interpretations compete over the same skeleton. Selecting an
appendage reserves its subtree, so a held prop or a second interpretation of
that limb cannot claim the same joints. Extra limbs and separate neck/head
branches remain candidates without assuming pairs, bilateral symmetry or a
humanoid template.

Surface adapters retain their actual joint owner and native ID. Whole-body
controls include separately weighted body branches such as robes, while chest,
pelvis and spine controls retain their own place in the hierarchy. Local
animation supplies evidence when choosing among drivers of the same body;
static rigs remain valid. Complementary geoset visibility can associate a
detached replacement with the corresponding living part.

Names contribute only when structural alternatives remain ambiguous. They do
not exclude an arm, admit a named prop, require an animation, or impose a limb
count. The implementation is deterministic geometric inference, with scored
hypotheses and confidence boundaries; it is not a trained visual model or a
lookup table of studied models. Difficult shapes can still be ambiguous, and
manual Add/Setup remains available.

Recognition preserves the model's hierarchy, pivots, skinning, geometry and
animation. The native solver separately checks whether each inferred chain can
be edited at the selected frame. An unavailable transform does not change the
anatomical evidence. The local acceptance census is
`node scripts/pose-anatomy-census.mjs <report.json>`; it compares independent
anatomical expectations under original, blank, scrambled, misleading and
remapped/reordered names and IDs. Local model examples are test inputs, not
runtime presets or redistributed application assets.

## Focus and appearance

During POSE, Focused Skeleton shows a compact control skeleton: mapped body
parts and limb joints, with the selected limb or body connections emphasized.
It omits native mesh-helper, weapon and attachment branches. Switching POSE off
restores ordinary Focused Skeleton behavior; the actual rig is never replaced.

Settings starts its tab row with Configuration, with Updates at the top.
Appearance uses collapsed sections and a color-set picker in every section.
A whole appearance preset also sets the controllers. Controllers can then use
a separate set, for example Blackrock controls with a Lordaeron interface.
Lordaeron remains the default. Handle, body and bend shapes offer circles,
squares, diamonds and triangles; symbols, size, state colors and XYZ colors
are adjustable. Pin offers a labeled button, square icon and round icon.
These are familiar rig-control primitives, following Autodesk's
[custom curve control workflow](https://www.autodesk.com/learn/ondemand/tutorial/common-rig-control-methods).

Section color sets preserve the other sections, image backgrounds, sizes and
line styles. The Controllers appearance set also loads its characteristic
shapes and Pin style. Configuration export/import preserves mixed appearances.
The native animation Controller type is now a dropdown above the collapsed
Restrictions section. This interpolation setting remains separate from the
viewport controllers' appearance.
