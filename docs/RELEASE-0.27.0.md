# MDLxL 0.27.0 - AnimXL, a new Emitter Editor, direct Forge shaping

## AnimXL (new, experimental)

- AnimXL shapes a model's animations with physics-style effects. Open it from the red ANIM button or the Modules menu.
- AnimXL is experimental: results can vary between rigs. Check the animation before saving; Commit as new keeps the original.
- Effects: Easing, Overlap, Settle, Weight, Drag, Secondary Motion, Footfall Impact, Anticipation, Exaggeration, Idle Motion, Hit Stop & Reaction and Fall Simulation. Presets: Default, Heavy, Agile, Relaxed and Fall.
- Apply effects to the whole rig (Auto) or only to Selected bones. Pick a section of the timeline to shape just that part; keys outside it stay as they are.
- Feet stay planted, two-handed grips stay on the weapon, and loops stay seamless.
- Compare your work with Side by side, Ghost, Arcs (the path a bone's tip draws) and the motion graph. Drag a pose diamond to change when that pose happens.
- Commit replaces the animation in one undo step. Commit as new keeps the original and adds a new animation.

## Emitter Editor (EMTR)

- Particle emitters have two tabs, Look and Motion, instead of six. Every setting appears once.
- Over its life: one table sets Color, Size and See-through % when a particle is Born, Halfway and at the End.
- Sprite sheets are found automatically. Frames lists the patterns the game itself uses for that picture (Whole animation, First half, Still frame, Looping…). Custom… lets you pick the frames yourself.
- Ribbons are on one screen with only the settings that matter in game. The play track shows when the ribbon is visible: drag its diamonds, and + adds another part.
- Smooth Size: right-click the play track, drag the green ends, then Commit. The ribbon grows or shrinks smoothly between keys.
- New ribbons are brightest at the blade and fade toward the tail.
- Adjust Manually shows the exact MDL text of any emitter. Hover a highlighted word to see what it means.

## Forge

- Forge opens on a grid with shapes standing on it.
- Double-click a face to select it, ready to Move. Hold E and drag to extrude; release to go back to Move.
- Cut makes equal sections or a cut where you click, on the selected faces or the whole shape.
- Bend, Bulge/Pinch, Taper, Bevel and Twist are now handles in the view. Drag the gold handle; ✓ keeps the change, Esc cancels.

## Animations

- Bones can be moved, rotated and scaled in global animations.
- Saving a new global animation now puts it where MdlVis looks for it, right after the animation list.

## Editor

- Workplane off: the Move tool now shows the arrows and squares from POSE in Vertices and Forge too. Drag an arrow to move along one axis, or a square to move in one plane, as an alternative to Shift + XY/ZX/YZ.
- Model tabs: with many models open, tabs shrink with "…" (the end of the name stays visible) and the active tab keeps its full name. There is no scrollbar; scroll with the mouse wheel or the small arrows.
- Drag files from Explorer onto MDLxL to open them like File > Open: textures next to the model are found, Save writes back to the file, Recent Files remembers it, and several models open in their own tabs.
- Closing with unsaved changes: Save is on top, CANCEL? is yellow and Close is red, set apart below. Escape cancels.
- UV Wrapper stays inside its model tab as a small movable window. The vertex editor stays usable while it is open.
- Copy and paste of a geoset within the same model keeps its original bones.
- POSE hides a Pelvis handle that only repeats Body.

## Fixes

- Some edited models could not be saved ("Save verification failed … PivotPoints"). They save again.

## Update

In 0.26.0, open Settings > Configuration > Search for updates > Update and restart.
