# NormalsXL

In Vertices, click **NormalsXL** (below **Merge Geosets**). A small panel opens in the model view and the whole visible model immediately shows the proposed result. Nothing changes until **Apply**; **Cancel**, the × button or Escape leave the model exactly as it was. With vertices selected first, only the triangles touching them change.

- **Smoothing angle** (default 70°): edges sharper than this stay crisp, softer ones are smoothed.
- **Fix facing** (on by default): flips triangles that face the wrong way so each piece faces outward.
- **Fix facing only**: just the triangle-facing repair, as its own undo step. Only the corners of flipped triangles get new normals.
- **Show normals**: blue direction lines.

After Apply the status bar shows one line, for example `NormalsXL: 1,240 normals rebuilt · 310 vertices split · 12 triangles flipped · 2 pieces need a look`. Apply is one undo step.

## How it works (`src/normals-rebuild.js`)

1. Vertices are matched by position across all included geosets (tolerance 1e-5 of the model size), ignoring UV seams and bone groups. This match is for analysis only; geometry is never welded.
2. Triangles at the same three positions with opposite winding are a two-sided sheet: each side gets its own vertices, they never smooth together and they never decide which way a piece faces. Same-direction copies are treated as one triangle.
3. Triangles are paired around every edge; where three or more meet, orientation-compatible and flattest pairs come first.
4. Facing: within each connected piece, minority triangles are flipped to match. A closed piece with negative volume is turned inside out. An open piece is turned only when a ray visibility test clearly shows its back sees more open space than its front; otherwise it is left alone and counted under "pieces need a look". Pieces that cannot be wound consistently (twisted or self-crossing) are also left alone and counted.
5. Triangle corners join smoothing groups across edges flatter than the smoothing angle. Each group's normal is the angle-weighted sum of its face normals.
6. A vertex used by several groups is duplicated, copying position, every UV set, bone group, skin weights and tangents. Rebuilt vertices that end up identical in every stream are merged. A geoset that would exceed 65,535 vertices is refused.
7. HD tangents are rebuilt for every changed vertex.

Zero-area triangles stay in the mesh; their vertices take the shading at their position. Restore normals and Smooth normals in the sidebar are unchanged.

## Evidence

On 54 classic SD models (93,776 triangles) at 70°: dark corners (a vertex normal facing away from its own triangle) 9,921 → 50, visible lighting seams across smooth edges 2,331 → 8, opposite-winding edges 1,170 → 215 (nearly all remaining are deliberate same-direction duplicates), 84,670 → 108,174 vertices. Repeating the operation on a repaired model changes nothing. The in-repo `test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx` regression goes from 309 dark corners and 46 seams to 4 and 0.
