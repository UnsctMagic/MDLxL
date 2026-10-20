# MDLxL 0.28.0 - Bone influence view, cleaner Appearance, Sort My Mess, Paint stamps

## Movement

- New render mode **Bone influence**, and Movement's default view. The model turns into a smooth see-through ghost with the skeleton drawn on top. Parts the selected bone moves turn orange; parts that follow it through child bones turn pale orange.
- Movement keeps its own view. Vertices and the other editors keep theirs (Wireframe by default).
- **F** swaps between Textured View and the view you last chose in that editor: Wireframe ↔ Textured, Bone influence ↔ Textured.
- **Bones** and **Focused Skeleton** start on in Movement; **Skeleton** starts off. The display switches you change are remembered next time you open MDLxL.
- The **Bones** switch is shared by Bones, Movement and Animations. Bones that Focused Skeleton shows can be clicked even with Bones off.
- The right-hand panels of all editors share one width, 240 px by default. Drag the panel's left edge to resize it; double-click the edge to reset it.

## Settings → Appearance

- Appearance shows one page at a time. Pick a page from the list on the left: Presets, Interface, Viewport, Wires, Vertices, Bones & skeleton, Bone influence, Controllers, Lists & folders, Quadview, Editor helpers, Citadel Paint.
- **Bones & skeleton**: bone style (Cubes and shaded lines, Joint and cone, Stick), connector style (Shaded, Tapered), colors for bones, root bones, the selected bone, its parent and its children, and connector and chain highlight thickness, with a live preview. The selected chain is highlighted in the same shape. Bone colors follow these settings again.
- **Wires**: Wire style **All edges** or **Hidden-line** (wires behind the mesh become faint dashes in Wireframe), and Hidden wire intensity.
- **Bone influence**: ghost opacity and its three colors.

## Sort My Mess

- Opens on a list of what the model has, grouped by texture: geosets, materials, what differs and the proposed fix.
- You choose which fixes to apply; only those are applied.

## Citadel Paint

- Detailed stamps such as Silver Chainmail stay sharp when zoomed in or on small UV areas, and hovering shows the real result before you click.
- New **Smudge** tool (N) next to Erase: drag to push and smear painted colors.
- **Copy texture** (Ctrl+Alt+C) and **Paste texture** (Ctrl+Alt+V) take the painted texture to Photoshop or GIMP and back.
- **Strokes** (Shift+Z) lists your strokes; undo or restore one stroke while later strokes stay.

## Forge

- Shift+double-click adds a face to the faces already selected.
- Cuts follow the face outline and extrusions keep the simplest geometry: no extra points or thin slivers.

## OptimizeXL

- Insanity Fixer warns when skinned vertices blend a bone that is scaled to zero. In game those vertices stretch into long spikes, even though the model looks fine in the editor. The warning shows the first affected animation; it never changes the model.

## Editor

- MDL, MDX and Paint Project files get their own Explorer icon. Choose one in Settings → Configuration → File icons.
- UV Wrapper opens expanded. Replacing a texture reuses the existing material and texture instead of adding new copies each time.
- Runs better on PCs without a graphics card.
- Animations: Visibility & Color follows the checked geosets after a tab switch, and the Animations controls stay visible when camera rotation carries over.

## Fixes

- Settings → Configuration → Import configuration works again. Every file was refused with "Conflicting shortcut G."
- Spawned effects from the current Warcraft III (3.0.1) preview again, for example the knight's blood. Their models are now format 1800. The first spawn no longer freezes playback for a moment.
- Double-clicking overlapping emitters in Movement cycles through them again with Bones shown.
- Undo after Import whole part (BitsAndParts) removes the part in one step.
- Long model tab names read correctly for screen readers.
- A rare preview error when switching editors quickly is gone.
- The secondary label on a selected row in the Nodes list is readable in dark themes.
- MDX export no longer writes LevelOfDetail -1 for Reforged geosets.

## Update

In 0.27.0, open Settings > Configuration > Search for updates > Update and restart.
