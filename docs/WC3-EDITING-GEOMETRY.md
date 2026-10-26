# WC3 editing: geometry and shading

Use this for shape, topology, joins, welding and normals. Pair it with
[binding](WC3-EDITING-NODES-BINDING.md), [UVs/materials](WC3-EDITING-UV-MATERIALS.md)
and [verification](WC3-EDITING-VERIFICATION.md).

## Isolate the surface defect

1. Read the selected geoset's `Vertices`, `Faces`, `Normals`, every `TVertices`
   set, `VertexGroup`/`Groups`, optional `Tangents`/`SkinWeights` and material.
   Keep a copy of those streams and the selected vertex IDs.
2. Compare rest and posed views. Inspect wireframe for shape/connectivity,
   solid shading for normals, and textured rendering for UV/material behavior.
   Use `mdlxl_view({target, renderMode: 'wireframe'|'solid'|'textured'})` and
   `mdlxl_capture({target, samples: [{view, sequence, frame}]})`.
3. Read triangle winding from `cross(b-a,c-a)`. Compare neighbouring face
   directions and stored vertex normals. A reversed triangle needs facing
   correction; a lighting discontinuity with sound geometry needs normal work.
   A gap appearing only in poses needs the binding procedure.
4. Edit the responsible data only. Keep intentional openings, thin double-sided
   surfaces and independently moving components. Use an oblique/reverse view
   to choose the intended side before reversing faces or closing a boundary.

## Close a seam without destroying its attributes

1. Identify the ordered boundary pairs from face connectivity and intended
   surface continuity. Collect coincident UV and normal copies at each point.
   Pair by boundary order and adjoining faces, not distance alone.
2. Choose a common position for each matched pair. Within one geoset call
   `classic-mesh.collapseVertices(geoset, indices, center)`; across geosets write
   that position to each selected `Vertices` triplet in `mdlxl_script`.
   This keeps separate UVs, normals and material ownership.
3. Make the paired vertices' resolved influences agree using
   [continuous binding](WC3-EDITING-NODES-BINDING.md#join-one-continuous-moving-surface).
   Smooth only the intended shading join; retain hard-edge normals.
4. Inspect rest-space separation, posed separation, UV continuity and silhouette.
   Keep the duplicate vertices when the surface still needs a UV or shading seam.

## Weld compatible vertices

1. Read all selected corner attributes. Resolve classic groups to members;
   if identical groups occupy different table entries, assign the selected
   vertices to one existing entry before welding.
2. Call `mesh-tools.weldVertices(geoset, indices, epsilon = 1e-5)` with a
   tolerance smaller than the nearest intentional gap. It requires compatible
   normals, every UV set, group index and optional tangent/skin streams.
   It returns `{merged, selection}` and removes collapsed triangles.
3. Use the returned selection and refresh the displayed geoset/vertex mapping.
   Check triangle count, remaining boundaries and all stream lengths.
4. For an explicitly requested attribute collapse, use
   `classic-mesh.weldSelectedVertices(geoset, indices, center)`. It retains the
   last selected vertex's attributes. Put the chosen attribute owner last;
   ordinary tolerance welding or position-only closure preserves authored seams.
5. After a scripted topology change, maintain the triangle-list metadata:
   `PrimitiveTypes = Uint32Array.of(4)` and
   `PrimitiveCounts = Uint32Array.of(Faces.length)`. Recalculate affected bounds
   with the procedure in [game integration](WC3-EDITING-GAME-INTEGRATION.md).

## Add a ring with conforming edges

1. Mark the edges the ring crosses, in order around the surface. Choose a split
   fraction on each edge. Include every triangle incident to each marked edge
   so both sides receive the same new vertex. Match geometric seam copies by
   their endpoint positions while keeping their separate corner attributes.
2. In a scoped `mdlxl_script`, allocate one new vertex per marked indexed edge.
   Use `mesh-tools.gather(geoset, sourceIndices)` with all original indices plus
   one endpoint for each new vertex to copy every existing stream and type.
   Overwrite each new position and UV pair with the endpoint interpolation.
   Interpolate/normalize smooth normals; keep each hard-normal side separate.
   For weighted skin interpolate resolved contributions and normalize to 255;
   for classic skin assign the intended ring group using the binding guide.
3. Replace each incident triangle with triangles of the same winding. Rotate
   its labels cyclically to use these cases (`m` splits `ab`, `n` splits `bc`,
   `p` splits `ca`):
   - One split: `(a,m,c)`, `(m,b,c)`.
   - Two splits: `(b,n,m)`, `(a,m,c)`, `(m,n,c)`.
   - Three splits: `(a,m,p)`, `(m,b,n)`, `(p,n,c)`, `(m,n,p)`.
4. Assign the gathered streams and a new `Uint16Array` for `Faces`. Keep indices
   within 0..65535. Refresh triangle metadata and rebuild tangents with the
   normal-rebuild plan if the geoset carries them. Retain unrelated faces.
5. Check shared-edge incidence, winding, nonzero triangle area and seam pairs.
   Give the new rows their joint influences and test bent poses before accepting
   the topology. A ring should support the bend without changing the rest silhouette.

For uniform refinement of an entire chosen component,
`mesh-density.subdivideGeoset(source, level, {selectedVertices})` returns a new
geoset; assign that result to `model.Geosets[index]`. Use a closed selection
boundary or split adjoining faces too: subdividing one side of an interior edge
leaves a T-junction. Use the edge procedure for a local ring.

## Rebuild normals or repair facing

1. Read the current normals and identify which boundaries should shade smoothly.
   Load `normals-rebuild` and call
   `analyzeNormals(model, {geosets, selection = null})`, where `geosets` is an
   index array and `selection` maps geoset indices to vertex IDs.
2. For shading, call `planNormalRebuild(analysis, {smoothingAngle = 90})`.
   Choose the angle from the intended hard/smooth boundaries, rather than
   accepting the default for every surface. For inconsistent winding, use
   `planFacingFix(analysis, {smoothingAngle = 90})`.
3. Read the plan and compare the normals/faces returned by
   `previewNormalRebuild(model, plan)` with the original data. Facing repair
   changes triangle order; inspect intended inner and
   outer sides before applying that plan. For an isolated, explicitly identified
   reversed triangle, swap its second and third face indices instead.
4. Call `applyNormalRebuild(model, plan)` in the edit script. Scope affected
   geosets; compare positions, UVs and bindings with the baseline. Check solid
   shading under changed views and textured rendering at the join.
5. For a deliberate smooth join across duplicated corners, keep the copies'
   binding and visibility compatible so they continue to coincide in poses.
   Keep a hard normal break where the surfaces intentionally meet sharply.

## Duplicate, detach or merge geometry

1. For duplication across a plane, call
   `ai-mesh.mirrorSelection(model, selection, {axis: 'x', plane: 0, weld: false, tolerance: 1e-5})`.
   Choose the actual axis/plane; the operation duplicates selected complete faces
   and reverses winding. Inspect the UV orientation and map the new influences
   to the intended drivers before requesting a compatible seam weld.
2. To detach selected complete faces, call
   `mesh-tools.detachFaces(model, geosetIndex, indices)`. Read the returned new
   geoset index and refresh selections; the operation also copies visibility
   ownership and updates affected bone references. Include those collections
   in the edit scope.
3. For a requested geoset merge, first call
   `geoset-operations.geosetMergeConflicts(model, selectionByGeoset)`.
   Read material, RGB, visibility and animation-setting differences.
   Keep conflicting geosets separate unless the requested result specifies
   which authored state to retain; changing a shared layer to force a merge
   would also alter its other users.
4. With compatible whole geosets selected, call
   `mergeSimilarGeosets(model, selectionByGeoset, resolutions)` with
   `resolutions` omitted. This selection chooses geosets, not a subset of their
   faces. Scope `/Geosets`, `/GeosetAnims`, `/Bones` and `/Gliders` when present.
   Read `oldToNew` and `vertexOffsets` from the result and report refreshed IDs.
5. Check every affected sequence's visibility and bounds after structural edits.
   Use the normal review and serialization procedure before finishing.
