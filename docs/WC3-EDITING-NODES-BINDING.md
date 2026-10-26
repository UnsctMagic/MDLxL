# WC3 editing: nodes, hierarchy and binding

Use this for continuous joins, layered surfaces, joints, free chains and pivots.
Use [animation](WC3-EDITING-ANIMATION.md) for keys and motion transfer,
[geometry](WC3-EDITING-GEOMETRY.md) for topology and
[verification](WC3-EDITING-VERIFICATION.md) for the edit/review contract.

## Read the actual rig

1. In `mdlxl_script`, load `animation` with `await api.module('animation')`.
   Call `allNodes(model)` and map `ObjectId` to node, canonical collection and
   collection index. Read `Parent`, `Flags`, `model.PivotPoints[ObjectId]`,
   `Translation`, `Rotation` and `Scaling`. Follow ancestors as well as directly
   bound nodes. A helper carries inherited motion even without vertex influences.
2. For a classic vertex `v`, read
   `g.Groups[g.VertexGroup[v]]`. Members are bone ObjectIds with equal influence.
   For weighted data, read the eight entries at `8*v` in `g.SkinWeights`: four
   IDs followed by four byte weights. Use the document's editable format and
   preserve the array constructor and bind-pose data.
3. Read the surrounding triangle connectivity, coincident seam copies, material
   and visibility owners. Group vertices by connected surface and intended
   movement, then establish correspondence within those groups.
4. Sample relevant clips with
   `sampleNodeMatrices(model, frame = 0, sequenceIndex = -1, globalTime = frame)`
   and `skinGeoset(geoset, matrices, out)`. Keep the original world positions for
   comparison. Use a real sequence for poses; sequence `-1` gives the rest view.

## Write influences without changing neighbouring vertices

1. Choose the final influence set before writing. Every bound vertex needs a
   surviving driver. For a rigid assignment use
   `bone-tools.changeVertexBinding(model, geoset, indices, boneId, 'hard')`.
   Hard binding replaces all influences. Use `'soft'` to add an influence and
   `'detach'` to remove one. Precheck the final set before detaching.
2. For an exact classic set, reuse a `Groups` entry with the same bone members
   or append a copy; set only the selected `VertexGroup` entries to that index.
   Keep at most 256 addressable groups and update
   `TotalGroupsCount = Groups.reduce((n, group) => n + group.length, 0)`.
   Copy members across geosets, not the source group index. Leave shared group
   entries intact when unselected vertices use them.
3. Soft binding adds at most four members. Preserve an existing larger classic
   group through the exact group-table assignment above. Classic groups have
   equal weights; use intermediate group combinations for a discrete transition.
4. For editable weighted data, merge contributions by bone ID, remove zero
   contributions, and require at most four nonzero influences. Normalize to 255:
   floor each `255*w/sum`, then distribute the remaining units to the largest
   fractional remainders. Write IDs and weights into the existing eight-entry
   layout; set unused weights to zero. Resolve an ambiguous correspondence
   before reducing influences, since truncation changes motion.
5. Scope the affected `/Geosets/<index>` records. Compare protected vertices'
   resolved influences, positions, normals and every UV set after the edit.

## Join one continuous moving surface

1. Select the two boundary loops by topology. Pair their ordered vertices in
   rest space using boundary direction, adjoining faces and surface side.
   Match every UV/hard-normal duplicate at each boundary position. Keep nearby
   independent surfaces outside this pairing.
2. If the loops should meet, write each matched set to its agreed common rest
   position. Use `classic-mesh.collapseVertices(geoset, indices, center)` for
   copies within one geoset, or write the same position into each geoset's
   `Vertices` triplet. Preserve distinct UVs, normals and material ownership.
3. Give each matched seam set the same resolved influences. Across geosets,
   create/reuse the destination group by members. Carry the transition into
   adjoining rows using the joint procedure below.
4. Keep the geosets separate when their rendering or visibility differs.
   Joining positions and motion needs no geoset merge. For an explicitly
   requested merge, use the conflict procedure in [geometry](WC3-EDITING-GEOMETRY.md).
5. Sample the paired vertices through maximum relative rotation and intermediate
   poses. Measure pair distance and adjacent edge stretch, then inspect the
   join from both sides. Correct the correspondence or transition where it opens.

## Bind a layer to its underlying deforming surface

1. In a read-only `mdlxl_script`, identify the layer's connected patches, the
   underlying connected patches and their intended sides. Read rest positions, face indices, normals and bindings.
   For each layer vertex, search triangles only in the matching underlying
   patch. Project toward that surface along the local surface normal, or find
   the closest point on its triangles within an explicitly chosen clearance.
   Reject opposite-facing triangles, the reverse side of a thin surface and
   unrelated components. Keep ambiguous matches for explicit inspection.
2. Store the matched triangle, barycentric coordinates and signed rest clearance.
   Check neighbouring layer vertices map to neighbouring triangles and preserve
   order. Follow continuity across a legitimate underlying UV/geoset seam;
   match its duplicate positions and influences before crossing it.
3. Inside the contact region, copy a coherent underlying classic group where
   the matched triangle has one. Where triangle corners differ, follow the
   underlying transition with the same ordered group bands; add layer vertices
   if its topology cannot represent the boundary. For weighted skin, barycentrically
   interpolate the three resolved influence maps, then normalize as above.
4. Where the layer lifts away, keep the contact row's underlying influences.
   Progress through adjoining rows toward the independent driver: for two
   classic drivers use `[A]`, `[A,B]`, `[B]`. With more drivers, retain the
   underlying combination at contact and choose intermediate equal-weight
   groups that preserve the underlying region's motion. For weighted skin
   interpolate `(1-u)*underlying + u*independent` along the transition.
   Keep UV-seam copies identical at every row.
5. If the layer spans two deforming regions, map each side to its own underlying
   patch and continue the underlying blend across their shared joint. Place
   enough rows through that joint to carry the transition. Assign the free
   boundary to its independent driver only after the supported region ends.
6. Sample both meshes at joint extremes, twists and between-key frames.
   Recompute the matched triangle point with its stored barycentric coordinates;
   compare signed clearance and tangential displacement with the rest relation.
   Inspect penetration, sliding and silhouette. Adjust the transition's width,
   correspondence or rest clearance, then repeat those poses.

## Add a blend ring at a joint

1. Read both drivers' hierarchy and posed transforms. Locate the joint in the
   mesh and identify existing rows on each side. Use existing rows when they can
   bend smoothly; add topology only where the transition lacks support.
2. For a new ring, split the crossed edges with the conforming edge procedure in
   [geometry](WC3-EDITING-GEOMETRY.md#add-a-ring-with-conforming-edges). Preserve
   UV/normal copies at seams and give every incident triangle the same split.
3. Keep the outer rows on their original drivers. For classic binding use
   `[A]`, `[A,B]`, `[B]` across the bend; widen the middle band when a single row
   pinches. For weighted binding vary the ratio gradually across rows while
   keeping each row's seam copies equal. Use the exact assignment procedure.
4. Pose both flexion directions and a twist using existing clips or
   `movement.applyMovementPose(model, changes, time, sequenceIndex, restrictions = {})`
   on a detached comparison model. A change is
   `{id, property: 'Rotation', value: [x,y,z,w]}` in local coordinates.
   Check volume, edge stretch and opposing-surface intersections before committing.

## Add a free chain

1. Establish the anchored root, joint positions and contiguous vertex rows.
   Create each driver with `bone-tools.createRigNode(model, 'Bone', selection = {})`
   or `editor-document.createNode(model, 'Bone')`. Retain its allocated ObjectId.
2. Set each new pivot using
   `movement.applyRestPoseTransform(model, [id], {mode: 'move', values: [dx,dy,dz]})`,
   where the delta is desired pivot minus current pivot. Scope `/PivotPoints`
   and the canonical node collection.
3. Parent root to its carrier and each next driver to the preceding driver.
   `bone-tools.attachToBone(model, childId, parentId)` takes a bone parent.
   Precheck that the parent is not a descendant: this operation otherwise
   detaches a conflicting branch. For a helper parent, assign the new node's
   `Parent` directly after the same cycle check.
4. Bind the anchored row to the carrier, transition into the first driver, and
   continue through joint bands. Keep the free end on its own driver. Test
   isolated driver rotations from root outward before adding motion.
5. Add local keys with `applyMovementPose` at the clip start, meaningful poses
   and end. Copy the starting pose to the endpoint for a loop, then offset
   successive drivers' change times to create follow-through. Inspect the whole
   chain between keys and at the wrap; retain independent motion beyond the anchor.

## Set camera-facing motion

1. Read the node's billboard bits and inherited transforms. Give independently
   facing surface patches separate drivers; place each pivot at its intended
   turning centre, parent it to the moving carrier and bind its patch rigidly
   using the creation/binding procedures above.
2. For a bone that should face the camera freely, call
   `bone-tools.setBoneBillboarded(model, id, enabled)`. This clears the billboard
   mask (8, 16, 32, 64) and sets bit 8 when enabled. Preserve unrelated flags.
3. For a new axis lock, clear the free-billboard bit 8 and other lock bits,
   then set the chosen X/Y/Z bit 16/32/64 in `Flags` through a scoped script.
   Retain an existing authored combination when the lock is outside the edit.
   Avoid the free-billboard setter when an existing axis lock must survive.
4. Inspect the patch while rotating the camera and while its carrier moves.
   Check that neighbouring independent patches turn around their own pivots
   and the shared anchor stays attached.

## Relocate a pivot while preserving motion

1. Read the pivot, all transform tracks, their local/global domains and inheritance
   flags. If the request is only for another attachment position, add a helper
   or attachment under the existing driver at that position and keep its pivot.
2. For an actual pivot relocation, keep an untouched model for sampling. Let
   `d = newPivot - oldPivot`. With the same parent and flags, the local transform
   is `T(t) T(p) R S T(-p)`. Preserve it by writing
   `tNew(time) = tOld(time) + (R(time)*S(time) - I)*d`, while retaining rotation
   and scale. A pivot-only write would shift animated geometry.
3. Sample `movement.sampleMovement(model, node, property, time, sequenceIndex)`
   for Translation, Rotation and Scaling. Form `R*S*d` by component-scaling
   `d` then rotating it by the sampled quaternion. For constant rotation/scale,
   the compensation is constant; add it to each translation value, to Bezier
   control values, and to static translation. Leave Hermite derivative tangents
   unchanged for a constant offset.
4. For varying rotation/scale, prepare a new translation curve from the old
   model's samples at endpoints, all involved keys and subdivided intervals.
   Clone the old translation track's metadata, then set `LineType: 1`,
   `GlobalSeqId: null` and `Keys: [{Frame, Vector: new Float32Array(values)}, ...]`
   for a local bake. Cover every existing clip and compensate setup values
   outside them; sample any retained exterior curve spans too. Refine until
   old/new world matrices and influenced vertices
   agree within the chosen positional tolerance at intermediate times.
   For one shared global clock, sample 0 through its duration and retain that
   `GlobalSeqId` in the new track. Use this only when every varying contributing
   curve uses that same clock. For mixed independent clocks, retain the driver and add an anchor;
   one local translation curve cannot retain both clocks.
5. Apply the pivot delta with `applyRestPoseTransform` and the prepared translation
   in one scoped script. Compare descendants and attached effects as well as
   skinned vertices through every affected clip. Keep the original curve if the
   sampling tolerance or interpolation change is unacceptable.
