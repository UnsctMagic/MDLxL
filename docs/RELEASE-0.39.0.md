# MDLxL 0.39.0

- **Citadel Paint:** **New base coat** has a new layout with clean, upright pieces and far fewer seams, and heads get more pixels by default. **Detail** sets how many pixels a selected part gets. Also new: pen pressure, Smoothing, Symmetry (V), Alt navigation, Ctrl + right drag for brush size and softness, layer opacity and 1024 base coats.
- **Calculate extents** is now one calculator in the model inspector, OptimizeXL and Save As. It leaves out portrait backgrounds, hero and team glows and additive effect meshes, so the health bar sits at the right height.
- **EMTR and Glow Up** now have the main editor's Rotate handles on X, Y and Z. **Add ribbon** makes a native weapon trail that shows only during the swing. Ribbon fields update the live trail, and Additive ribbons follow Intensity.
- **Nodes manager:** show, hide and remove emitter visibility keys at the current frame.
- **FX:** picking a particle emitter previews it first and **Add** keeps it. Ten new looks are in the library's normal folders.
- **OptimizeXL:** **Remove exact redundancy** in Insanity FIxer removes repeated end keys, constant tracks and collapsed triangles without changing the model's look. Alternate-stance animations are now compared only with their own stance.
- **Bones tab:** **Wiggle** (J) swings the selected bones in the preview, so badly bound parts show up at once. The model is not changed.
- **Modeling:** hold Ctrl with Resize to move pieces together or apart at full size. Right-click **Uncouple** and turn off **Nuke** to separate vertices without moving them.
- **UV Wrapper:** the material dropdown lists every material in the model. Rotate and Zoom follow one fixed rule, and big pieces no longer outrun the mouse.
- **POSE and ANIM:** elbow and knee Rotate works like every other handle. In ANIM, dragging empty space turns the camera.
- **Auto Corpse:** handles big corpses with wings, tails, more than 254 nodes and looped effects.
- **AI console:** edits you and the AI make to separate data combine by themselves as one Undo step. The AI review no longer freezes the window.
- **Saving:** verification problems are now warnings and never block a save. Save As with Calculate extents works when the extents are already right.
- Every frame interval shows its total frames, and Highlight Geoset works both ways in Animations.

Update through Settings > Configuration > Search for updates > Update and restart, or download the full portable ZIP from the MDLxL page.
