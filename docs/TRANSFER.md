# Transfer

Transfer gives the open model movement from another model, or from another of its own
animations, one body part at a time. The result is added as a new animation. The open model
keeps its bones, mesh and every animation it already has; one Undo removes the new one.

Open it with the **XFER** module button, Modules → Transfer…, or F11.

## The window

It is laid out like the Surface Effects window: the list on the left, the views in the middle
with the playback controls under them, the parts on the right, the buttons at the bottom.

| Control | What it does |
| --- | --- |
| From | Where the movement comes from: **This model**, any other open model, **Open file...** or **Library...** (the game's own models). The model is only read; it never opens as a tab and is never changed. |
| Animations | The chosen model's animations. Click one to play it in the donor view. It is the same choice as the donor view's dropdown. |
| Donor and result views | The donor plays the chosen animation; the result shows the open model with the taken parts. Click a part's handle on the donor to take that part. The result shows handles only for taken parts; click one to select it. Turning one view turns the other the same way. Each view plays on its own clock. |
| Playback strip | Under each view: Play / Pause, a thin track to drag through the animation, a viewing Speed (25, 50, 100 or 200%; it only changes how fast the view plays, never the animation) and a dropdown of what the view shows. The donor's dropdown lists its animations. The result's lists **New animation** (the one being built) and then the model's own animations, only to look at: while one is shown the handles and path are off and the timeline is dimmed, and using the timeline, a part switch or a slider goes back to New animation. |
| Mirror | On the donor view's caption: swaps left and right for the whole donor. It switches itself on when the two models hold their weapon in opposite hands. |
| Timeline | Under the views: the time and a ruler to click or drag through the new animation. Below it one lane for the body animation (its loops drawn as repeats) and one lane for each animation parts are taken from, named animation first, like `Attack - 1 - Grunt` (point at it for the full name and its parts). Drag a clip sideways to change when it starts (Delay); drag its right edge to change its Speed; the slopes at its ends are its Ease. Click a lane's name to select its part (a lane of several parts selects All taken parts). Yellow diamonds are moment fixes: click one to go there, Delete removes it. |
| Drag the hand or foot | With a taken arm, leg, wing or tail selected, drag its hand or foot handle on the result to where it should be at the moment shown. **Whole movement** turns the whole movement (it sets Raise, Turn and, if needed, Roll); **This moment** fixes only that moment, fading in and out around it, and shows a diamond on the timeline. **Clear fixes** removes the part's moment fixes. |
| Weapon switches | On an arm that holds a weapon: **Both hands on the weapon** (shown when the model holds it with two hands; the other arm's row then says it holds the weapon), **Keep weapon above the ground**, and **Point weapon like theirs** (when the donor's arm holds a weapon too). |
| Save as… / Load from… | At the top of the parts column. Save as… keeps the taken parts with all their settings as a setup under a name, or writes it to a file to share. Load from… uses a saved setup or a setup file on the open model: its donor models open again by their file or game path (one that cannot be found is asked for once) and the From list shows the donor and animation the parts use, parts and animations are matched by name, and what the model lacks is left out and named. With Add all, one setup gives a whole warband the same animation set. |
| Body animation | The open model's own animation under everything. Parts that are not taken keep moving as it does. |
| Take whole body / Clear all | Take every part both models have from the animation the donor view shows, or remove every taken part. When the two models stand on a different number of legs, hips and legs keep the body animation and a sentence under the buttons says so. |
| Parts list | One row per part of the open model. The switch takes the part from the donor view or removes it; the small text says where a taken part comes from. Click a row to select the part. |
| All taken parts | The first row: change every taken part at once with Strength, Pose, Timing, Travel (when Hips is taken) and Keep foot on the ground (when a leg is taken). A slider shows the shared value, or stays empty when the parts differ. Take whole body selects it, so slowing a whole-body transfer down is one drag of Speed. |
| Path | While a taken arm, leg, wing or tail is selected, the path its hand or foot travels is drawn in orange on both views, with a dot at the current moment. Moving a slider moves the path, so you can see what the slider does. |
| Other side | Take the part from the donor's other side: this left arm does what their right arm does. |
| Strength | How much of the taken movement plays (0–150%). |
| Pose | **Mine** keeps this model's own stance and adds the movement; **Theirs** points the part the way the donor's does. Starts at Mine. |
| Raise / Turn / Roll | Turn an arm, leg, wing or tail up or down, forward or back, or around its length. Hips, Chest and Head have Lean / Tilt / Turn instead. |
| Keep foot on the ground | Legs: a planted foot of the donor stays planted here. Needs Hips from the same animation. |
| Travel | Hips: how far the body moves with the donor's hips, scaled to this model's size. |
| Take from … | Shown when the donor view plays something else than the part's source: takes the part from that instead. |
| Timing | Closed at first. **Delay** (when the movement starts), **Speed**, and **Ease** (soft start and end, for animations that play once, such as attacks). |
| Name / Add animation / Cancel | The new animation's name (a suggestion until you type), the button that adds it (the window stays open, so you can add another), and Cancel, which closes. |
| Add all (N) | Gives this model the donor's whole animation set: every donor animation it does not have yet by name (Decay and Portrait ones are left out), each with the parts and slider values you took from that donor. Each plays over this model's own animation of the same kind (a Walk under Walk Defend), else the chosen Body animation. One Undo removes the whole set. The tooltip lists the names. |
| Ctrl+Z / Ctrl+Y | Step through your changes inside the window. |

Double-click a slider to put its default back.

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
