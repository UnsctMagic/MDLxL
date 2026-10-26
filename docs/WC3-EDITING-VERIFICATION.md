# WC3 editing: verification

Use this for every edit's baseline, scope, measurements, visual review and delivery.
The other guides describe the editing methods; this section defines their common
verification limits and completion procedure.

## Establish the baseline and edit scope

1. Call `mdlxl_context({target})` and retain the captured target, selected vertex
   map, nodes, sequence and frame. Use `mdlxl_read({target, path, offset, limit})`
   for narrow field inspection or a read-only `mdlxl_script({target, code})` for
   complete structured data. Follow pagination when a result is truncated.
2. Resolve the displayed IDs before editing. Model/tool geoset indices are
   zero-based; displayed geoset labels are one-based. Refresh mappings after
   topology, geoset or node reindexing.
3. State the requested result in measurable terms and list protected data.
   Record relevant positions, resolved influences, tracks with controls,
   material references and visibility. Keep the original model as the baseline;
   compare actual values rather than counts alone.
4. Load an existing owner with `await api.module('module-name')` inside the
   script. Use `mdlxl_capabilities({module})` or `api.describe(name)` for an
   unfamiliar signature. `api.source(name, offset = 0, limit = 16000)` returns
   an object; read its `text` property. Reuse APIs already inspected.
5. Commit related changes with
   `mdlxl_script({target, code, edit: true, label, scope, protectedPaths, animationRanges})`.
   Scope canonical JSON Pointer owners, such as `/Geosets/0`, `/Bones/2`,
   `/PivotPoints` and `/GeosetAnims`. `Nodes` and node `PivotPoint` are aliases;
   include the actual collection and pivot table. The editor maintains derived
   Info counts. Keep typed arrays when replacing streams.
6. Include every affected range when a retime shifts later clips. Keep
   unrelated keys/resources protected. Let an operation's validation failure
   identify the unmet condition; correct that condition within the request
   instead of deleting authored fields to make the edit pass.

## Measure the requested result and protected data

| Edit | Read and compare | Inspect |
| --- | --- | --- |
| Shape/topology | Requested positions/dimensions, faces, all stream lengths, protected coordinates, bounds | Silhouette, wireframe, reverse and oblique views |
| UV/material | Selected UV pairs, layer/texture references, exterior UVs and layers, sampled alpha | Resolved texture, seam, transparency overlap, contrasting team colours |
| Binding/hierarchy | Resolved influence maps, world matrices, paired seam distances, layer clearance, edge stretch | Bend/twist extremes, intersections, independent motion |
| Animation | Domains, key times/values/controls, exterior keys, contacts, root/endpoint trajectories | Between-key motion, transition, loop wrap |
| Effects/events | Resource IDs, emission windows, lifetime, carrier transforms, trigger times | Replayed particles/trails and actual game events |
| Integration | Format/dependency round trip, affected bound tables and camera fields | Target-game culling, selection, attachments, portrait and lifecycle |

1. Sample endpoints, relevant stored keys, intermediate times and both sides
   of a transition. For loops include just before/after the wrap. For a layer
   use poses with the largest relative rotation. Refine around a detected gap,
   intersection or abrupt trajectory change.
2. Call
   `mdlxl_sample({target, sequence, globalSequence, frames, nodeIds, geosetIds, vertices, offset, limit})`.
   Use up to 32 frames per call and at most 1000 returned vertices per page.
   Compare before/after values in the same domains; measure the specific
   requested displacement, clearance, contact or timing relationship.
3. In a read-only script use
   `animation.sampleNodeMatrices(model, frame = 0, sequenceIndex = -1, globalTime = frame)`
   and `skinGeoset(geoset, matrices, out)` for custom comparisons. Pass the
   same explicit global clock to baseline and edited samples.
4. For IDs, flags, paths, key times and remapped references require exact
   preservation. For serialized floats compare at the file's float32 precision;
   for fitted motion declare the positional/angular tolerance used.

## Inspect the actual rendering

1. Keep camera, framing, textures, team colour, lighting and time consistent
   between baseline and result. Use
   `mdlxl_view({target, renderMode, view, fit: 'model'|'selection', sequence, frame, playing})`
   to set the relevant view when needed. Preserve normal interactive rotation.
2. Capture off-screen comparisons with
   `mdlxl_capture({target, samples: [{view, sequence, globalSequence, frame}]})`,
   up to 12 samples per call. Read the returned images. Use front/side/oblique
   views as needed to expose the changed surface and its reverse side.
3. Replay effects from before onset through cutoff and residual lifetime.
   Inspect materials with resolved textures and multiple overlapping surfaces.
   Compare camera-dependent surfaces from different viewing directions.
4. Fix a demonstrated mismatch within the authorized edit, then repeat the
   affected comparison. Preserve deliberate hard edges, holes, helper motion,
   holds and fades outside the requested change.

## Reopen and finish through review

1. Recalculate affected bounds using
   [game integration](WC3-EDITING-GAME-INTEGRATION.md#recalculate-the-affected-bounds).
   Call `mdlxl_document({target, action: 'validate', format: 'mdx'|'mdl'})` for
   the requested format. Read the result and resolve relevant serialization
   failures without discarding preserved content.
2. Call `mdlxl_review({target, action: 'inspect', checksCode, frames, turnaround})`.
   `checksCode` has `model`, `before`, `selection`, `context` and `api` and
   returns `[{name, passed, actual, expected}]` with Boolean `passed` values.
   Check the requested result and protected data separately. Supply 3..8
   relevant times for animation review.
3. Inspect the returned before/after images. If checks or visuals fail, correct
   the edit and inspect again; another mutation invalidates the previous review.
4. Finish with
   `mdlxl_review({target, action: 'finish', outcome: 'passed', summary})` only
   after the requested review passes. Use `'needs-correction'` for an outstanding
   defect or `'blocked'` for a required unavailable check, and state the reason.
5. For requested workflow verification, exercise Undo/Redo against the committed
   result and compare relevant fields. A dialog preview needs its normal apply
   action before it becomes the edited document.
6. Export only to the requested destination, preserve supplied originals and
   reopen the exported file. If serialization remaps node IDs, compare hierarchy
   and influences through that mapping. Report what changed, what survived,
   which views/times/formats ran and which game behaviors were exercised.

## General limits

- Finite samples cover the tested times and global-clock combinations. Refine
  around observed extrema and test additional phase combinations for interacting
  global controllers.
- The numeric sampler evaluates hierarchy and skinned geometry. Use rendering
  for billboard orientation, composed materials and particle/ribbon history;
  sampled geometry bounds exclude those complete visual effects.
- Format field widths define representable data, not safe renderer budgets.
  Use the requested game build and a representative scene for capacity and
  performance checks. Keep measured conventions separate from format limits.
- A diagnostic identifies a structural condition or heuristic. Correct invalid
  references relevant to the task; retain intentional artistic variants and
  unused authored data unless their alteration is requested.
- Editor rendering and serialization establish editor/file results. Warcraft
  acceptance requires the target game, its resource paths and the affected
  gameplay states. Owner artistic acceptance remains a separate decision.
  Report an editor-checked deliverable as ready for game testing when that test
  has not run.
