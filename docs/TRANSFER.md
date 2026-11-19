# Transfer

Transfer gives the open model movement from another model, or from another of its own
animations, one body part at a time. The result is added as a new animation. The open model
keeps its bones, mesh and every animation it already has; one Undo removes the new one.

Open it with the **XFER** module button, Modules → Transfer…, or F11.

## The window

It opens over the whole editor area, like the UV Wrapper, and is laid out like the Surface Effects window: the list on the left, the views in the middle
with the playback controls under them, the parts on the right, the buttons at the bottom.

| Control | What it does |
| --- | --- |
| From | Where the movement comes from: **This model**, any other open model, **Open file...** or **Library...** (the game's own models). The model is only read; it never opens as a tab and is never changed. |
| Animations | The chosen model's animations. Click one to play it in the donor view. It is the same choice as the donor view's dropdown. |
| Donor and result views | The donor plays the chosen animation; the result shows the open model with the taken parts. Click a part's handle on the donor to take that part. The result shows handles only for taken parts; click one to select it. Turning one view turns the other the same way; zoom and pan stay with each view, and the horizon stays level. Each view plays on its own clock. |
| Playback strip | Under each view: Play / Pause, a thin track to drag through the animation, a viewing Speed (25, 50, 100 or 200%; it only changes how fast the view plays, never the animation) and a dropdown of what the view shows. The donor's dropdown lists its animations. The result's lists **New animation** (the one being built) and then the model's own animations, only to look at: while one is shown the handles and path are off and the timeline is dimmed, and using the timeline, a part switch or a slider goes back to New animation. The small ↺ button at the end of the scrub track resets that view: the model is framed again and both views turn back to the starting angle. |
| Mirror | On the donor view's caption: swaps left and right for the whole donor. It switches itself on when the two models hold their weapon in opposite hands. |
| Both / Rider / Mount | On a view's caption when its model is two creatures (a rider on a mount). **Both** reads the rider's upper body on the mount's legs, **Rider** the rider alone with its own hips and legs, **Mount** the mount alone. On the donor it chooses what you take from; on the result it chooses which parts of this model are listed. Taken parts the new choice reads from the other creature (or lacks) are removed and named. One Undo step. |
| Timeline | Under the views: the time and a ruler to click or drag through the new animation. Below it one lane for the body animation (its loops drawn as repeats) and one lane for each clip group: parts whose clip comes from the same animation with the same Delay, Speed and trim share a lane, named animation first, like `Attack - 1 - Grunt` (point at it for the full name and its parts). Clips added with **Add after** get lanes of their own below the first ones. Drag a clip sideways to change when it starts (Delay). Drag either edge to trim it, like a video editor: the part you keep stays where it is in time; a cut end is drawn dashed; double-click an edge to put that end back. The slopes at its ends are its Ease. Click a lane's name to select that clip of its part (a lane of several parts selects All taken parts); the sliders then edit that clip. A lane added with Add after has a small × that removes that clip; Delete does the same while its lane is selected. Yellow diamonds are moment fixes: click one to go there, Delete removes it. |
| Drag the hand or foot | With a taken arm, leg, wing or tail selected (its first clip), drag its hand or foot handle on the result to where it should be at the moment shown. **Whole movement** turns the whole movement (it sets Raise, Turn and, if needed, Roll); **This moment** fixes only that moment, fading in and out around it, and shows a diamond on the timeline. **Clear fixes** removes the part's moment fixes. |
| Weapon switches | On an arm that holds a weapon: **Both hands on the weapon** (shown when the model holds it with two hands; the other arm's row then says it holds the weapon), **Keep weapon above the ground**, and **Point weapon like theirs** (when the donor's arm holds a weapon too). |
| Save as… / Load from… | At the top of the parts column. Save as… keeps the taken parts with all their settings (switches, trims and clips added with Add after) as a setup under a name, or writes it to a file to share. Load from… uses a saved setup or a setup file on the open model: its donor models open again by their file or game path (one that cannot be found is asked for once) and the From list shows the donor and animation the parts use, parts and animations are matched by name, and what the model lacks is left out and named. With Add all, one setup gives a whole warband the same animation set. |
| Body animation | The open model's own animation under everything. Parts that are not taken keep moving as it does. |
| Take whole body / Clear all | Take every part both models have from the animation the donor view shows, or remove every taken part. When the two models stand on a different number of legs, hips and legs keep the body animation and a sentence under the buttons says so. |
| Add after | Plays the animation the donor view shows after what is already taken, for the selected part (or every taken part when All taken parts or nothing is selected) that the donor has. It starts 150 ms before the result ends and fades in over those 150 ms, so the first clip hands over without a dip. Drag to aim, This moment and moment fixes work on first clips. Switching a part off removes all its clips. |
| Parts list | One row per part of the open model. The switch takes the part from the donor view or removes it; the small text says where a taken part comes from, its clips in order (`Attack - 1, then Attack - 2`). Click a row to select the part. |
| All taken parts | The first row: change every taken part at once with Strength, Pose, Timing, Travel (when Hips is taken), Keep foot on the ground (when a leg is taken) and the switches below. A slider shows the shared value, or stays empty when the parts differ; a switch shows a dash when the parts differ. Take whole body selects it, so slowing a whole-body transfer down is one drag of Speed. |
| Path | While a taken arm, leg, wing or tail is selected, the path its hand or foot travels is drawn in orange on both views, with a dot at the current moment. Moving a slider moves the path, so you can see what the slider does. |
| Other side | Take the part from the donor's other side: this left arm does what their right arm does. |
| Strength | How much of the taken movement plays (0–150%). |
| Pose | **Mine** keeps this model's own stance and adds the movement; **Theirs** points the part the way the donor's does. On Head, Chest and Hips, Theirs takes the donor's stance: the part stands as the donor's does. Starts at Mine. |
| Raise / Turn / Roll | Turn an arm, leg, wing or tail up or down, forward or back, or around its length. Hips, Chest and Head have Lean / Tilt / Turn instead. |
| Keep foot on the ground | Legs: a planted foot of the donor stays planted here. Needs Hips from the same animation. |
| Travel | Hips: how far the body moves with the donor's hips, scaled to this model's size. |
| Stay in own range | Keeps the part inside what this model's own animations do: no deeper bend, lean or crouch than it has anywhere else. Off at first. |
| Own features (N) | A fold under the parts list, closed at first, shown when the open model has features (the header also says how many are kept): its loose pieces that move on their own, such as a belly, a cape or shoulder bones, each named as the model names it, with its part and number of bones. The switch keeps that feature moving the way it does in this model's own animation of the same kind. A feature of the body (a belly) also keeps the arms out of it. Rows of parts that are not taken are dimmed. Pointing at a row lights the feature up on the result. Setups keep the switches by the feature's name. |
| Keep arm out of the body | Arms: turns the shoulder so the arm does not pass through the chest, hips or head. An arm that holds a two-handed weapon with the other is left alone. Off at first. |
| Take from … | Shown when the donor view plays something else than the part's source: takes the part from that instead. |
| Timing | Closed at first. **Delay** (when the movement starts), **Speed** (only here: the clip's edges trim it), and **Ease** (soft start and end, for animations that play once, such as attacks). |
| Name / Add animation / Cancel | The new animation's name (a suggestion until you type), the button that adds it (the window stays open, so you can add another), and Cancel, which closes. |
| Add all (N) | Gives this model the donor's whole animation set: every donor animation (Decay and Portrait ones are left out); one this model already has by name is replaced, built over its own animation of that name. With **Keep own animations** (beside it, off at first) only the animations it does not have yet are added. Each comes with the parts, slider values and switches you took from that donor (first clips only: clips added with Add after and trims stay with the animation they were made on). Each plays over this model's own animation of the same kind (a Walk under Walk Defend), else the chosen Body animation. One Undo removes the whole set. The tooltip lists the names. |
| Ctrl+Z / Ctrl+Y | Step through your changes inside the window. |

Double-click a slider to put its default back.

## Transplant mode

**Retarget / Transplant** at the top of the window switches modes. Retarget is everything above.
Transplant puts the open model's mesh on the donor's skeleton: the model gets the donor's bones,
all of the donor's animations (its own are replaced) and the donor's attachment points. Its own
camera stays. Retarget keeps its taken parts while Transplant is shown.

| Control | What it does |
| --- | --- |
| From, Animations, donor view | As in Retarget: choose the donor and the animation to look at. Mirror on the donor caption swaps the donor's left and right (on by itself when the two models hold their weapon in opposite hands). Part handles and Both / Rider / Mount are not shown. |
| Result view | The open model transplanted onto the donor, playing the donor view's animation. Its dropdown chooses the same animation for both views. Turning one view turns the other; a changed setting rebuilds the result without moving the camera. |
| Poor fit | Shown only when the bodies fit badly (different number of legs, an arm or wing the donor lacks, an unrecognised body), with the reason. Transplant still works. |
| Sounds | The donor's sounds and footprints. On at first; off keeps this model's own, fitted to the new animations. |
| Effects | The donor's particle effects, ribbons and lights. Off at first. |
| Keep | One box per loose piece of the model (a belt, a weapon). On: the piece stays on its own bone instead of the donor's. Off at first. |
| Transplant / Cancel | Transplant makes the open model the result, in place (no new tab), as one Undo step. The window stays open and says Transplanted. Cancel closes. |

## A rider on a mount

A model that is two creatures, such as the Knight or a Chaos knight, shows **Both | Rider | Mount** on
its view. To make a unit sit like a rider: choose the knight under From, choose **Rider**, then **Take
whole body**. Hips and legs take the rider with Pose at Theirs, so the unit takes the rider's seated
stance; its legs are not kept on the ground. **Both** gives the rider's arms and upper body only when
the unit walks on two legs and the mount on four.

## Two examples

**A Lord of Change with a Footman's defend.** Open the Lord of Change, click **XFER**, pick the
Footman with **Open file...** (or **Library...**), click `Stand Defend` under Animations, click
**Take whole body**, then **Add animation**. Its wings keep their own movement and its feet stay
on the ground.

**A Footman swinging like a Grunt while he defends.** Open the Footman, set **Body animation** to
`Stand Defend`, pick the Grunt as the source and click its `Attack - 1`, click the Grunt's weapon
hand, then **Add animation**. Drag **Raise** or **Strength** and watch the hand's path if the swing
needs adjusting.

A held weapon keeps its own angle to the hand, so a staff can end up pointing where the source's
sword points. Move **Pose** toward Mine on that arm, or switch the arm off, to keep it upright.
