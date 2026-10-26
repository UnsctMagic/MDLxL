# WC3 editing: file format and game integration

Use this for versions, bounds, attachments, collision, cameras, lifecycle and
delivered dependencies. Use [effects](WC3-EDITING-EMITTERS.md) for events and
[verification](WC3-EDITING-VERIFICATION.md) for acceptance and general limits.

## Preserve or convert the format

1. Read `model.Version`, material/texture-slot layout, geoset skinning,
   `BindPoses` and retained opaque records. Keep the input version for an
   ordinary edit. SD appearance can use classic or newer file layouts.
2. Read the document's editable state. Use
   `model-version.hdContentIssues(model)` to inspect content restrictions.
   Keep unsupported fields intact; choose a supported edit instead of removing
   them to force the document into another editing mode.
3. For an explicitly requested 800/1000 conversion, call
   `model-version.versionConversionIssues(model, target)` first. Resolve the
   reported losses with the owner. After any separately authorized conversion
   resolves those issues, require an empty issue list before calling
   `normalizeVersionFields(model, target)`
   and validate both the saved format and retained content. This conversion
   path accepts editable 800/1000 inputs and targets.
4. Keep concrete representation constraints in the edit: classic `VertexGroup`
   indices are bytes (0..255); triangle indices are unsigned 16-bit (0..65535);
   weighted skin has four ID/weight slots and byte weights totalling 255.
   Preserve version-dependent ID widths, typed key/event times and field lengths.
5. Use `mdlxl_document({target, action: 'validate', format: 'mdx'})` or the
   requested `'mdl'` format after the edit. Read any preservation/loss report
   before exporting; retain the supplied file.

## Recalculate the affected bounds

1. List what moved: rest vertices, skinned motion, sequence timing or visibility.
   Read `Info`, each affected geoset's bounds, `Sequences[s]` bounds and
   `Geosets[g].Anims[s]`. Keep authored special bounds outside the edit.
2. For changed rest geometry call
   `editor-document.recalculateExtents(model, geosetIndices = null)` with the
   explicit affected indices. It updates rest bounds; calculate animated bounds
   separately for changed poses.
3. Load `optimizexl-bounds` and call
   `repairBounds(model, {targets}, {includeGlobalKeys: false})`. Build targets
   for the records that need recomputation:
   - `{path: ['Sequences', s], sequence: s}` for a sequence's combined geometry.
   - `{path: ['Geosets', g, 'Anims', s], geoset: g, sequence: s}` for an existing
     geoset/sequence extent.
   - `{path: ['Geosets', g, 'Anims'], geoset: g, sequenceExtents: true}` to build
     the complete per-sequence table when it is missing or mismatched.
   - `{path: ['Geosets', g], geoset: g}` for rest bounds.
   - `{path: ['Info']}` for combined rest/animated model bounds.
4. Use `includeGlobalKeys: true` when affected geometry uses global transforms.
   The operation samples stored poses and intervening frames. Include additional
   observed extremes in the resulting minimum/maximum extents if needed;
   preserve the enclosing radius. Scope just these owning records.
5. Recheck poses near maximum displacement and view the asset crossing the
   screen edge in the target game. Check effects' visible reach separately
   from geometry. For portrait-only extent work,
   `portrait-extents.recalculatePortraitExtents(model, indices)` fills and
   recalculates the selected portrait sequence entries.

## Keep attachments with their carrier

1. Read the attachment's `Name`, `AttachmentID`, `Path`, ObjectId, parent,
   pivot and visibility. Preserve exact game-facing identifiers.
2. For a requested addition use `bone-tools.createRigNode(model, 'Attachment', selection = {})`
   or `editor-document.createNode(model, 'Attachment')`. Set the required name
   and path, parent to the chosen carrier and move the new pivot with
   `movement.applyRestPoseTransform(model, [id], {mode: 'move', values: [dx,dy,dz]})`.
3. Sample the carrier and attachment through the relevant clips. If moving an
   already animated pivot or reparenting keyed data, use the compensation/local
   transform procedures in [binding](WC3-EDITING-NODES-BINDING.md) and
   [animation](WC3-EDITING-ANIMATION.md).
4. Load the intended attached effect in the target context and check its
   placement, orientation and visibility through the state transitions.

## Set collision independently from bounds

1. Read `CollisionShapes` and distinguish the selected shape from model/sequence
   bounds and map pathing configuration. Preserve unrelated shape records.
2. For an existing sphere (`Shape: 2`), write its centre to `Vertices` and
   enclosing `BoundsRadius` in the shape's authored coordinate frame. For a
   box (`Shape: 0`), write minimum and maximum corner triplets in `Vertices`.
   Set centre/size from the intended selection volume, not from unrelated
   effect geometry.
3. For a requested new sphere use
   `editor-document.createNode(model, 'CollisionShape')` and set its parent,
   centre and radius. Preserve the node's allocated ID and collection flags.
   Check a posed shape when it inherits animated transforms.
4. Test selection/hit interaction and culling separately. Change map collision
   or pathing settings only when that configuration is part of the request.

## Preserve the camera and portrait relationship

1. Read the actual package arrangement: an embedded camera, a separate
   `_Portrait.mdx` counterpart, or both. Keep the expected relative path and
   existing sequence tags.
2. For an existing camera read `Position`, `TargetPosition`, `FieldOfView`,
   `NearClip`, `FarClip` and its `Translation`, `TargetTranslation` and
   `Rotation` tracks. The camera rotation controller is a scalar roll.
3. In a scoped `mdlxl_script`, write only requested camera position/target,
   field of view or clipping values, preserving typed vectors and unrelated
   controllers. `FieldOfView` is radians; keep it between 0 and pi, with
   `0 < NearClip < FarClip` and distinct position/target points.
   For a keyed change clone the existing track and replace only
   selected `Frame`/`Vector`/control entries. Keep the target distinct from
   camera translation.
4. Frame the intended visible geometry at the relevant sequence times, then
   recalculate the affected portrait bounds. Inspect the actual portrait
   camera's crop, clipping and transitions in game. Keep deliberately partial
   geometry when it belongs to that view.

## Edit a connected lifecycle

1. Read the existing sequence names/tags, intervals, loop flags and runtime
   configuration for entry, active, terminal and removal states. Keep only the
   states required by that asset's use; retain their exact game-facing names.
2. Capture the last visible pose of the outgoing state and the first pose of
   the incoming state. Read geoset alpha, effect visibility, emission and event
   times at the transition.
3. Edit the responsible owners using the animation and visibility procedures.
   Keep replacement surfaces aligned with the outgoing posed geometry and
   coordinate their visibility at the handoff. Set terminal/removal durations
   from the requested behavior and actual game configuration.
4. Replay the full transition in order, including lingering effects and final
   removal. Verify the target configuration uses the intended clips and paths.

## Add requested team glow

1. Read the intended placement, carrier and lifecycle visibility. Use
   `glow-up.addHeroGlow(model, {origin: true, originSize: 1, originOffset: [0,0], brightness: 0.75})`
   for an origin-plane addition, with size/offset/brightness chosen from the
   requested result. These are options of the existing operation.
2. For an attached addition call
   `addHeroGlow(model, {origin: false, weapon: true, weaponIds: [driverId], weaponSize: 1, weaponFrom: 0, weaponTo: 1, brightness: 0.75})`.
   These literal API option names select the carrier and normalized start/end
   along its fitted geometry. Choose the intended range, a size multiplier
   from 0.1 to 5 and brightness from 0 to 1. Inspect the returned
   `geosetIndices`, `materialId` and `textureId`.
3. Compare the generated geosets, materials, textures, nodes and visibility;
   scope all those changed collections. Inspect terrain overlap, turning,
   team colour and the terminal/removal states.

## Deliver the required dependencies

1. Enumerate texture references with
   `texture-references.visitTextureReferences(model, visit)` and read external
   emitter/attachment paths, event identifiers and portrait counterparts.
   Separate game-resident paths from custom files that the package must supply.
2. Export the requested edited model to an explicit new path through
   `mdlxl_document({target, action: 'export', path, format: 'mdx'})`.
   Keep custom asset paths exactly aligned with the exported files/imports.
3. Open the exported file with `mdlxl_document({action: 'open', path})`.
   Compare references and animation ownership, then load it in the intended
   map/game environment with its delivered dependencies.
4. Check resource resolution, attachments, selection, culling, portrait and
   lifecycle behaviors affected by the edit. Record the tested game build and
   the remaining checks in the final review.
