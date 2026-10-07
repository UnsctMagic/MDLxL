# Next release — unreleased changes

- Forge can create Plane, Box, Sphere, Disc, Cylinder, Cone and Torus meshes. Adjust dimensions, placement and four capped complexity levels before adding; the maximum is 768 triangles. Regular grids, UV islands and a checker preview support Warcraft III wrapping.
- SHAPE adds middle/end/selected-vertex centers, direct center picking, a choice of bend direction, smooth bends or center folds, and optional local influence. Optional support rows use the Forge projector grid so even a four-corner shield can bend through its middle. Start-edge pivots and selected-vertices-only editing remain available. Preview, Cancel and one-step undo preserve the existing workflow.

- EMTR library effects open as independent working copies. Editing an effect no longer changes the values opened from its library default or saved preset. Edited effects can still be saved as new presets, and My work retains drafts and undo history. [PR #111](https://github.com/UnsctMagic/MDLxL/pull/111).
- UV Wrapper initial scrolling speed increases by 30%, from 1.0 to 1.3. Both UV views share this value, reopening resets it to 1.3, and other editors' scrolling speeds stay unchanged. [PR #115](https://github.com/UnsctMagic/MDLxL/pull/115).
