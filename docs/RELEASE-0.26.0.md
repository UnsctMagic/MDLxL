# MDLxL 0.26.0 - NormalsXL rework, MDL saving fix

## NormalsXL

- NormalsXL now recalculates normals the way Retera's Model Studio does. It never adds or removes vertices, so the file size stays the same.
- Normals are rebuilt from the triangles alone, so whole patches of wrong, flipped or empty normals are fixed in one click. Texture seams are smoothed, and edges the model already splits stay crisp.
- Parts on different bones and swap parts are not smoothed into each other.
- The panel is simpler: one Smoothing angle slider (default 90°), Show normals, Apply and Cancel.
- Normal lines show as soon as NormalsXL opens: yellow lines are normals it changes, blue lines stay the same.
- Fix facing is its own button and undo step. It turns triangles that face the wrong way, including whole groups of them, and inside-out closed parts. It never adds vertices.
- With vertices selected, only the selected area changes.

## Saving

- Models with a geoset color whose tint is off, or with MDLVis editor data, can now be saved as MDL. The game ignores both, so MDL leaves them out and the status line says so. MDX still keeps them.

## Update

In 0.25.1, open Settings > Configuration > Search for updates > Update and restart.
