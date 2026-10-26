# WC3 editing: particles, ribbons, lights and events

Use this for adding/copying effects, their timing and their resource dependencies.
Use [animation](WC3-EDITING-ANIMATION.md) for retiming,
[materials](WC3-EDITING-UV-MATERIALS.md) for layer composition and
[verification](WC3-EDITING-VERIFICATION.md) for the review procedure.

## Choose the effect mechanism

Read the canonical collection and fields before editing. `ParticleEmitters2`
emit textured particles; `RibbonEmitters` connect sampled moving edges;
`ParticleEmitters` refer to external model paths; `ParticleEmitterPopcorns`
use their own effect path/guide. `Lights` illuminate; `EventObjects` trigger
game resources. Keep the existing family unless conversion is requested.

For any effect, read parent, pivot, transforms, flags, local/global tracks and
referenced texture/material/path. Sample its carrier before changing placement.

## Write effect colours

Use the opened editor `model`; write colour values as `[R,G,B]` in 0..1.
Keep intensity and alpha in their own fields.

| Field | Static editor value | Animated editor values | MDX boundary |
| --- | --- | --- | --- |
| Light `Color` | RGB | RGB `Vector`, `InTan`, `OutTan` | Static RGB; `KLAC` BGR is converted at load/save. |
| Light `AmbColor` | RGB | RGB `Vector`, `InTan`, `OutTan` | Static RGB; `KLBC` BGR is converted at load/save. |
| PE2 `SegmentColor[0..2]` | Three RGB vectors | Particle-age stages, not key tracks | RGB. |
| Ribbon `Color` | RGB | RGB `Vector`, `InTan`, `OutTan` | Static RGB; `KRCO` BGR is converted at load/save. |
| Popcorn `Color` | RGB | RGB `Vector`, `InTan`, `OutTan` | Static and `KPPC` RGB. |

1. Read the existing field and clock. For a static field, replace its vector
   with `Float32Array.of(r,g,b)` inside the scoped edit script. Keep a keyed
   field keyed and preserve its interpolation, controls and exterior keys.
2. For light/popcorn keys call
   `animation-tracks.setAnimationKey(model, targets, frame, value, sequenceIndex, globalSeqId = null)`
   with `targets: [{kind: 'node', id, property}]` and RGB `value`.
   Ribbon `Color` uses
   `editor-commands.setKey(node, 'Color', frame, values, options = {})`;
   retain existing `inTan`/`outTan` in `options` when replacing a cubic key.
   For a new ribbon colour track, seed the old static colour at other clips'
   boundaries before writing the requested keys.
3. Copy editor colours directly between opened documents and save through the
   document API. It handles classic MDL BGR and popcorn MDL RGB as well as MDX.
   Preserve `_MdxDefaults` when editing keys. Swapping authored channels to
   compensate for a preview changes the saved tint; keep the RGB data and
   report the preview discrepancy instead.

## Add a textured emitter

1. Call `editor-document.createNode(model, 'ParticleEmitter2')` inside an edit
   script. Retain its allocated ObjectId, set `Parent` to the chosen carrier,
   and move its pivot using
   `movement.applyRestPoseTransform(model, [id], {mode: 'move', values: [dx,dy,dz]})`.
   Scope `/ParticleEmitters2` and `/PivotPoints`, plus newly added dependencies.
2. Set `TextureID` to an existing resolved texture index or append the requested
   texture record and use its index. Set `ReplaceableId` only for a replaceable
   texture. Keep emitter `FilterMode` separate from material-layer filter
   enums; use the emitter's own editor options.
3. Set `Width` and `Length` for the local X/Y emission rectangle, `Speed`,
   `Variation`, `Latitude`, `Gravity`, `EmissionRate` and `LifeSpan`. Lifetime
   is seconds; ordinary emission rate is particles per second. Emission points
   start along local +Z. Orient it with
   `particle-editing.setParticleRotationDegrees(model, id, frame, sequenceIndex, angles)`,
   where `angles` is absolute local XYZ degrees. Read the rotation clock first.
4. Write the particle-age stages: three RGB vectors in `SegmentColor`,
   three byte opacities in `Alpha` and three sizes in `ParticleScaling`.
   `Time` is the normalized age of the middle stage. Keep its value between
   the birth and end stages. Node scale changes the field/velocity; set
   `ParticleScaling` when the particle image itself needs a different size.
5. Set atlas `Rows`/`Columns` and the required quad/trail `FrameFlags`.
   `LifeSpanUVAnim`, `DecayUVAnim`, `TailUVAnim` and `TailDecayUVAnim` each hold
   `[startCell, endCell, repeats]`. Cells start at zero in the upper-left;
   keep cell indices inside `Rows*Columns`. Set `TailLength` for the trail
   component while particle scaling controls its width.
6. Choose whether emitted particles follow the moving frame. Set the ModelSpace
   flag `524288` for carried particles, or clear only that bit for world-space
   trails. Preserve other flags. Test carrier translation and rotation during
   emission and after the emitter stops.
7. Start with the requested visibility/emission window, then replay from before
   onset through at least one lifetime after cutoff. Inspect birth direction,
   density, fade, atlas sequence and residual particles before increasing rate.

## Time continuous emission or a burst

1. Read existing `Visibility` and `EmissionRate` tracks and their clocks.
   Sample the clip start, onset, cutoff and end. Preserve a global controller
   when the request applies to that global cycle.
2. For a new continuous emitter, start with zero emission, set the requested
   rate at onset and zero at cutoff. Use
   `editor-commands.setKey(node, property, frame, values, options = {})` with
   `property: 'EmissionRate'`, `values: [rate]` and `{lineType: 0}` for a new
   held track. Seed zero at other clips' boundaries for a clip-specific effect.
   The generic writer does not add those preservation keys for you.
3. For a new burst, set `Squirt = true`. Seed zero at the clip start, set the
   intended particle count at the burst time, then return the rate to zero.
   Retain distinct timestamps so repeated bursts stay separate. Visibility
   enables the emitter; the emission keys place the bursts.
4. For an existing authored rate curve, preserve `LineType`, `GlobalSeqId` and
   exterior keys/controls. When replacing one key with `setKey`, pass its
   original `inTan`/`outTan` if present. Passing `lineType` changes the whole
   controller; use it only for an intended controller-wide change.
5. Read binary visibility spans with
   `emitter-timing.emitterSpans(model, id, sequenceIndex)`. For a static/binary
   held controller, use `setEmitterSpans(model, id, sequenceIndex, spans)`,
   where spans are `[[on, off], ...]` in milliseconds. It rebuilds visibility
   as held 0/1 values, including exterior keys; use
   `animation-tracks.setAnimationKey` for an authored fade instead.
   A span reaching the clip end remains on at that endpoint; place an earlier
   cutoff or an explicit final key when the next state requires it off.
6. Preview by replaying elapsed time. Speed keys affect newly emitted particles;
   change gravity for ongoing acceleration. Compare density while the carrier
   moves: rate times lifetime estimates the steady live count, while overlapping
   transparent quads determine much of the visible fill.

## Copy an existing effect graph

1. Read the selected donor effect IDs and all their ancestors/dependencies.
   Use `references[documentId].model` as the donor in the script. Choose a
   recipient parent and explicit source/target intervals.
2. For matching native versions without bind-pose matrices, call
   `particle-recipes.copyEffectGraph(target, source, ids, {parent: null, sourceInterval, targetInterval, fit: false})`.
   It copies the selected effects, required ancestor transforms, textures,
   materials, texture animations and global sequences. Read its returned
   `ids` and `maps`; keep the donor intact.
3. Set `fit: true` to scale local key times into the target interval. With
   `false`, keys receive only a start offset and must fit. This operation
   transfers existing visibility as part of the graph; it does not create
   a new visibility window.
4. For a placed recipe use
   `extractParticleRecipe(source, ids, metadata = {})` on the donor, then
   `particle-placement.placeTimedParticleRecipe(model, recipe, placement, {preview: false, convertHD: false})`.
   Set placement `{sequence, from, to, parent, position: [x,y,z], fit, motion}`.
   The placement creates an anchor and writes the new effects' visibility
   window. Choose `motion: 'target'` only when copied ancestor animation should
   be removed so the recipient carrier owns the movement; otherwise retain
   donor ancestor motion. Keep effect-local animation.
5. Scope the actual effect families, Helpers, PivotPoints and resource arrays
   that the graph adds. Inspect mapped parents and texture/material/global IDs,
   then replay the recipient before/inside/after the window. Compare the donor
   motion in the chosen interval and leave recipient effects untouched.

## Fit or edit a ribbon

1. Select complete polygons defining the intended moving edge and call
   `particle-ribbon-fit.fitRibbonToPolygons(model, selection)`. Read its
   `recipe`, `endpoints`, `parent` and `needsBone`. A ribbon follows a straight
   local-Y edge; inspect the fitted endpoints against the selected geometry.
2. Use an existing rigid carrier for that edge. If `needsBone` is true, choose
   a rigid subregion or design a separate driver explicitly; rebinding the
   deforming surface just to fit a ribbon would change its motion.
3. Place the returned recipe with `placeTimedParticleRecipe` using
   `{ribbon: true, sequence, sequences: [selectedClipIndices], parent, position: [0,0,0]}`.
   This path stores the fitted edge directly in the carrier space and assigns
   visibility for the chosen complete clips. It canonicalizes node order;
   read returned maps and refresh every affected node reference/scope.
4. Set `MaterialID` to the intended material, retain its layer stack, and set
   `LifeSpan`, `EmissionRate`, `Gravity`, `Rows`/`Columns` and `TextureSlot`.
   For keyed edge size call
   `emitter-timing.setRibbonSizeKey(model, id, frame, sequenceIndex, {above, below})`
   with nonnegative distances.
5. Replay slow and fast turns. Adjust sampling rate for gaps, lifetime for
   trail persistence and edge size for coverage. Inspect the trail after
   visibility switches off; previously emitted segments age out separately.

## Edit lights and events

1. Create a requested light with `editor-document.createNode(model, 'Light')`.
   Set its parent/pivot, `LightType`, `AttenuationStart`/`AttenuationEnd`,
   `Color`, `Intensity`, `AmbColor` and `AmbIntensity`. Write both colours in RGB;
   intensity is its own scalar. For existing keyed fields retain the track and
   change only selected keys through `editor-commands.setKey`. Set visibility
   through `animation-tracks` and inspect the illuminated surfaces in motion.
2. For an event, use the existing Event Object chooser to select a valid game
   resource. Read its exact resulting `Name` and retain the complete identifier.
   Use `mdlxl_context`/`mdlxl_ui({action: 'inspect'})` to obtain the actual
   enabled command/control IDs when using that chooser; do not invent a code.
3. For a known requested event definition, create
   `editor-document.createNode(model, 'EventObject')`, set that exact `Name`,
   parent/pivot and sorted `EventTrack` times. Preserve the array constructor
   for edits and `GlobalSeqId` for global events. Sample the pivot at every
   trigger and align it with the intended pose.
4. Retiming must include local event tracks, as described in
   [animation](WC3-EDITING-ANIMATION.md#retime-a-clip-with-events-and-effects).
   Check resource resolution and the actual event in the target game.
