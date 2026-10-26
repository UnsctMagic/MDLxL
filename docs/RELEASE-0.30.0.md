# MDLxL 0.30.0 - Paint and UV selection improvements

- Citadel Paint: hold Shift and click **From file…** to import a copied image into the existing crop tool. Normal clicking still opens the file picker. Ctrl+V and the vertex editor are unchanged.
- UV Wrapper: Live Select now has **Grabthrough**, enabled by default. Turn it off to select and display only vertices visible to the camera. Holding A works after clicking Grabthrough or Highlight Live.
- UV Wrapper: N and Quick display can no longer accidentally turn normals on while the wrapper is open. Normals that are already on can still be turned off, and shortcuts keep keyboard focus in the wrapper.
- NormalsXL: **Fix facing** turns inside-out cuffs, bands and sleeves outward. Other open pieces such as capes and decals remain untouched. Recalculating normals keeps each vertex's own triangles and uses the smoothing angle to combine matching vertices, improving corner shading.
- Warnings across the editor flash red once, then keep red text and a red dot while displayed. Repeated warnings flash again. Normal messages keep their existing appearance.

**Update** Open Settings > Configuration > Search for updates > Update and restart, or download the full portable ZIP from the MDLxL page.
