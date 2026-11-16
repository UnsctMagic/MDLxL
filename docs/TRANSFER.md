# Transfer

Transfer gives the open model movement from another model, or from another of its own
animations, one body part at a time. The result is added as a new animation. The open model
keeps its bones, mesh and every animation it already has; one Undo removes the new one.

Open it with the **XFER** module button, Modules → Transfer…, or F11.

## The window

The left pane (**From**) shows where the movement comes from. The right pane (**To**) shows
the open model with the result playing. Under them are the body parts, the sliders, and the
buttons that add the animation.

| Control | What it does |
| --- | --- |
| From | First pick a source: **This model**, any other open model, **Open file...** or **Library...** (the game's own models). The model is only read; it never opens as a tab and is never changed. Later the **From** list switches between them. |
| Animation | The source animation to take movement from. |
| Take whole body | Takes every part both models have. Parts the source lacks (wings on a Footman) keep moving with the body animation. |
| Mirror | Swaps left and right. It switches itself on when the two models hold their weapon in opposite hands. |
| Body animation | The open model's own animation under everything. Parts that are not taken keep moving as it does. |
| Clicking the model | Click a part's handle on the **From** model to take that part. Click a handle on the **To** model to select that part. Taken parts are outlined in yellow on both models. |
| Part buttons | **All**, Head, Chest, Hips, arms, legs, wings, tail. A filled button is a taken part; its tooltip says where it comes from. Double-click takes it or gives it back. |
| Take from … / Give back / Reset | Take the selected part from what the **From** pane shows now, put it back on the body animation, or set its sliders back. |
| Amount | How much of the taken movement plays (0–150%). |
| Match pose | 0% keeps this model's own stance and adds the movement; 100% points the part the way the source does. Arms start at 100%, everything else at 0%. |
| Raise / Swing / Twist | Turn an arm, leg, wing or tail up or down, forward or back, or around its length. Hips, Chest and Head have Lean / Tilt / Turn instead. |
| Start / Speed / Blend | When the taken movement starts, how fast it plays, and how softly it eases in and out (Blend only for animations that play once, such as attacks). |
| Travel | Hips only: how far the body moves with the source's hips, scaled to this model's size. |
| Plant foot | Legs only: a planted foot of the source stays planted here. Needs Hips from the same animation. |
| Play / time bar / Original | Play or pause both previews, scrub the result, or show the body animation without the taken parts. |
| Name / Add animation | The new animation's name (a suggestion until you type) and the button that adds it. The window stays open, so you can add another. |
| Clear | Gives every part back. |
| Ctrl+Z / Ctrl+Y | Step through your changes inside the window. |

With **All** selected, a slider changes every taken part at once.

## Two examples

**A Lord of Change with a Footman's defend.** Open the Lord of Change, click **XFER**, pick the
Footman with **Open file...** (or **Library...**), choose `Stand Defend`, click **Take whole body**,
then **Add animation**. Its wings keep their own movement and its feet stay on the ground.

**A Footman swinging like a Grunt while he defends.** Open the Footman, set **Body animation** to
`Stand Defend`, pick the Grunt as the source and its `Attack - 1`, click the Grunt's weapon hand,
then **Add animation**. Drag **Raise** or **Amount** if the swing needs adjusting.

A held weapon keeps its own angle to the hand, so a staff can end up pointing where the source's
sword points. Lower **Match pose** on that arm, or give the arm back, to keep it upright.
