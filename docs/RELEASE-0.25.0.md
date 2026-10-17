# MDLxL 0.25.0 - Portrait editor, Hide extras, cleaner BITZ and RGB pasting

## Portrait

- New portrait camera editor in Movement. Portrait Frame View shows the model through its portrait camera, the way the game shows it in the bottom panel. Rotate and zoom with the mouse, then press Set Current View to keep the shot. Undo works.
- New Camera adds a camera framed on the head and shoulders. If the model has no Portrait animation, a "No Portrait animation · Create" link adds one.
- The "⋯" menu holds the extra controls: camera name and numbers, lens presets, Front and Level shots, game portrait lighting, composition guides, and Idle/Talk switching.

## Geosets

- Invert is replaced by Hide extras. One click hides corpse and portrait-background geosets (ones never shown in Stand, Walk or Attack) from the geoset list and the view. Nothing is deleted. Click again to bring them back. Invert is still in the right-click menu.

## BITZ

- Replace Part now places the Bit in the vertex editor. Apply replacement drops it at the center of the replaced part, selected, with Move active, so all the normal vertex tools can place it. Bones and weights still come from the replaced part.
- The BITZ and Collect Bit previews rotate with the mouse again.

## Animation

- Pasting a geoset from another model gives it one plain RGB color and never brings a global sequence along, so no duplicate global sequences appear.
- Set Sequence, Set All and Bake RGB now work on tracks that use a global sequence.

## Update

In 0.24.2, open Settings > Configuration > Search for updates > Update and restart.
