# WC3 editing: UVs, materials and visibility

Use this for seam wrapping, textures, layer changes, colour and visibility.
Use [geometry](WC3-EDITING-GEOMETRY.md) for vertex splits,
[animation](WC3-EDITING-ANIMATION.md) for timing and
[verification](WC3-EDITING-VERIFICATION.md) before finishing.

## Resolve the rendered layer

1. Read `Geosets[g].MaterialID` and call
   `uv-tools.uvMaterialLayers(model, materialID, time = 0, sequenceIndex = -1)`.
   Each result gives `layerIndex`, the sampled `textureID`, `texture` and
   `coordId`. Read the actual `TVertices[coordId]`, layer `TVertexAnimId`,
   texture path/replaceable ID and wrapping flags.
2. Preview the resolved image with
   `mdlxl_assets({target, source: 'model', action: 'preview', textureId})`.
   Inspect texture alpha and the region used by the selected faces. Repeat at
   texture-switch keys if `TextureID` is animated.
3. Read every layer in order, including `FilterMode`, `Shading`, `Alpha` and
   texture animation. Read `GeosetAnims` by `GeosetId` for geoset alpha/colour.
   `Geosets[g].Anims` contains bounds, not colour tracks.
4. Identify the layer and UV set that control the requested appearance before
   changing coordinates or transparency. Keep unresolved texture paths intact;
   resolve the asset before replacing a material to compensate for a missing image.

## Adjust UVs across a seam

1. Select the faces to rewrap and gather their vertex indices. Find shared
   corners between selected and protected faces. Keep positional/normal/binding
   seam copies and each UV set's current values.
2. If selected and protected faces share a vertex that needs different UVs,
   duplicate just that boundary vertex: call
   `mesh-tools.gather(geoset, sourceIndices)` with all original indices followed
   by the needed copies, assign the gathered streams, and redirect only the
   selected face corners to the new indices. Copy all UV sets, normals, groups,
   tangents and weighted skin before editing the chosen UV set.
3. To retain the existing wrap while splitting, use that copying procedure.
   `uv-tools.uncoupleUVVertices(geoset, indices, uvSet = 0)` splits incident
   corners and insets their UVs; use it only when that inset is intended.
4. Build a new UV buffer from the original `TVertices[coordId]`. Place matching
   boundary coordinates together for a continuous painted feature, while
   retaining a split for a texture island or hard change in paint. Move/rotate/
   scale the selected island around its chosen UV centre and preserve its
   orientation unless a mirrored texture result is requested.
5. Assign
   `g.TVertices[coordId] = uv-selection.restrictUVChange(g, coordId, values, indices)`.
   This returns a new buffer with only eligible selected coordinates replaced.
   For a view projection, call
   `uv-tools.projectUVFromView(geoset, indices, viewMatrix, projectionMatrix, source = geoset.TVertices[0])`
   using the actual chosen camera matrices; assign its returned UV buffer
   through `restrictUVChange`. Inspect foreshortened faces separately. When
   editable geometry has tangents and UV set 0 changes, compute
   `geoset-tangents.forgeTangents(geoset)` and copy its four-component entries
   to `Tangents` for vertices of affected triangles; retain exterior entries.
6. Check the seam with the actual texture in rest and bent poses, including
   oblique views and the normal viewing scale. Keep UVs outside 0..1 for an
   intentional repeated wrap. Use
   `uv-tools.setUVTextureWrapping(model, textureIDs, enabled)` to set both
   repeat axes only when requested; it changes all users of those textures.

## Change one material layer

1. Read all geosets using the material. If the change applies to only one,
   append `structuredClone(model.Materials[materialID])` and point only that
   geoset's `MaterialID` at the new index. Keep its other layers unchanged.
2. For a texture assignment call
   `material-presets.setMaterialLayerTexture(material, layerIndex, value)`,
   where `value` is a texture index or a complete typed TextureID track.
   It synchronizes the paired base passes of a generated tint stack. Preserve
   animated assignments when only one key is changing: clone that track,
   replace the selected key's integer texture value and pass the clone.
3. For one filter change write the chosen layer's `FilterMode` directly in a
   scoped script. Material filter values are 0 opaque, 1 alpha-tested,
   2 alpha-blended, 3 additive, 4 additive with alpha, 5 modulate, 6 modulate2x.
   Keep `Shading`, layer order, `CoordId`, texture animation and alpha intact.
4. Use `material-presets.applyMaterialPreset(model, materialID, preset, tint = 0)`
   only for a requested whole preset. A team/tint preset rebuilds the stack;
   use the single-layer operations above for an authored stack.
5. For team colour keep the replaceable texture with `ReplaceableId: 1` and
   the intended base/overlay order. Team glow uses `ReplaceableId: 2`. Keep the
   replaceable slot rather than writing one selected team's ordinary image
   into it. Inspect contrasting team colours and layered transparency.
6. Before deleting/reindexing textures, enumerate all consumers with
   `texture-references.visitTextureReferences(model, (id, set, owner) => {...})`.
   Use the callback's setter to remap every affected reference, including
   animated IDs and emitter textures. Keep paths and unrequested texture flags.

## Change visibility at its owner

1. Trace the surface's visibility through geoset `Alpha`, every material-layer
   `Alpha`, texture alpha and active local/global tracks. For effects use the
   node's `Visibility`. Editor hiding changes only the working view.
2. Load `animation-tracks` and define the exact target:
   - `{kind: 'geoset', id: geosetIndex, property: 'Alpha'}`.
   - `{kind: 'material', id: materialIndex, layer: layerIndex, property: 'Alpha'}`.
   - `{kind: 'node', id: objectId, property: 'Visibility'}`.
   Read `readAnimationTrack(model, target)` and sample with
   `sampleAnimationProperty(model, target, frame, sequenceIndex, globalSeqId = null)`.
3. For a constant change to a static property call
   `setAnimationInlineValues(model, targets, value)`. It rejects keyed tracks.
   For a key call
   `setAnimationKey(model, targets, frame, value, sequenceIndex, globalSeqId = null)`.
   Values are 0..1. Read the current domain first: an already-global track
   remains global even if the optional argument is omitted.
4. For a local on/off interval, retain the original endpoint values, set
   visibility to 1 at its start and 0 at its cutoff, and keep hold interpolation
   when the whole track is an on/off controller. Preserve an authored fade's
   interpolation and exterior controls; edit only its intended keys.
5. To make a local property constant throughout selected complete clips, use
   `setAnimationSequences(model, targets, value, sequenceIndices = null)`.
   Pass the explicit clip indices. It replaces keys within those clips and can
   convert global tracks to local; use per-key editing for an authored global
   controller or a fade that must survive.
6. Missing geoset owners can be created with
   `createGeosetAnimations(model, geosetIds = [])`. Scope `/GeosetAnims`,
   `/Materials` or the actual node collection. Check just before/at/after each
   transition and in neighbouring clips. Keep separate surfaces/effects on
   separate owners when they need different visibility.

## Change colour without hiding another mechanism

Read and write these fields on the opened editor `model` in RGB order:

| Geoset animation field | Editor values | File boundary |
| --- | --- | --- |
| Static `Color`, including `_MdxDefaults.Color` | `[R,G,B]` | Static MDX stores RGB; leave the saved default intact when editing a track. |
| `Color.Keys[].Vector`, `InTan`, `OutTan` | `[R,G,B]` | The codec converts animated MDX BGR at load/save. |

Use the editor's save path for MDX/MDL conversion. Copy values between opened
documents without swapping channels. Read the [effect field orders](WC3-EDITING-EMITTERS.md#write-effect-colours)
before changing a light or emitter.

1. Use `{kind: 'geoset', id, property: 'Color'}` with the animation-track API
   for geoset RGB. Supply three components in 0..1.
   The geoset writer enables its colour flag and preserves
   the visible baseline when starting a track.
2. Read the texture and multiply it mentally or numerically by the intended
   tint before writing. A multiplicative tint cannot restore detail absent
   from the texture. Choose a texture edit only when the request actually
   changes that detail.
3. For a single keyed colour use `setAnimationKey`; for a static colour use
   `setAnimationInlineValues`. Preserve unrequested alpha, filter mode and
   lighting flags. Inspect the result with the resolved texture, normal scene
   lighting and the same comparison views.
