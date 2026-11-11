# Forge editing

Right-click the Forge module icon in the shared LER/EMTR icon menu:

- **Enter the Forge** opens standalone Forge.
- **Call Upon Forge** adds tools on the left of the existing Vertex editor.

Opening the toolset imports nothing and restricts no geometry. Selection, camera,
ordinary Vertex tools and editor history remain available. Each operation captures
the current selection, previews locally, then commits as one normal Undo step.
Cancel discards only that preview. Commit retains other geosets' selections.
Enter commits from the viewport; focused buttons, menus and dialogs own their keys.

## Geometry and handles

- Reuse the existing Forge tools and gold handles. In the Vertex toolset, Bevel
  and Inset handles move in model units along their displayed axis. Either drag
  direction controls width; reversing the mouse must move the handle back without
  jumping. An excessive Inset remains adjustable through the same handle.
- Bevel handles solid edges and the complete border of a thin surface. Thin
  surfaces receive a continuous angled or rounded rim, retaining their original
  outline. Internal triangulation is not a bevel edge. Other objects' tiny edges
  must not limit the selected surface's width.
- Inset accepts coherent curved surfaces and samples the cap onto that surface.
  It rejects folded/oversized caps without flattening the mesh.
- The owner approved thin-surface rims and curved Inset in **both Forge modes**
  on 2026-11-11. Other standalone results remain byte-identical to main, including
  closed solids, flat Inset, primitive UVs and standalone Bevel's existing clamp.

## Authored data and performance

`src/forge-vertex.js` owns adaptation to authored meshes. Untouched vertices keep
their original index and exact stream bytes, including authored duplicates and
free vertices. Changed vertices update existing slots; additional corners append.
Preserve all UV sets, normals, bindings, skin/tangents and non-geometry records.

Local operations retain two rings of neighboring faces for topology context;
distant triangles bypass per-frame shaping and interpolation. Only changed HD
tangents are recalculated. Face/edge picking caches each geoset independently and
detects in-place stream edits. Extrude hit testing retains full geosets for
occlusion; only shaping uses the reduced draft. Viewport keeps existing edge indices when topology
is unchanged. Mouse updates use the viewport's existing frame coalescer.

HD models remain view-only in the application. The owner explicitly retained this
rule during the review contract. Native HD data preservation/performance is
checked at the source boundary; live drag acceptance uses the editable real shield.

Verification: [vertex indices](../test/forge-vertex-indices.test.js),
[shield rim](../test/forge-surface-bevel.test.js),
[curved Inset](../test/forge-shield-inset.test.js),
[mouse controls](../test/forge-shield-controls.electron.cjs),
[selection and keys](../test/forge-vertex-contract.electron.cjs),
[live frame cost](../test/forge-vertex-drag.electron.cjs),
[standalone comparison](../scripts/compare-forge-standalone.mjs).
