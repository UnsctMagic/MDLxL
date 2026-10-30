# WC3 editing: size optimisation

## Make a model smaller without changing how it moves

1. Keep the version the user accepted (or the original) with `mdlxl_versions`.
   Read real MDX/MDL byte sizes from `mdlxl_document validate`. Discover
   `ai-motion-compare` and read `trackInventory(model)` for track bytes,
   interpolation, keys per animation, keys outside animations, constant tracks
   and quaternion cubic segments whose controls equal their keys. Inspect unused
   resources through the existing OptimizeXL owners. Compare native Blizzard
   distributions first: the study's `keysPerTrack` describes each clip's median
   across active tracks, not a maximum or an individual-track budget. Its
   percentiles describe what was measured, never a target or acceptance gate.
2. Try exact cleanup through the existing OptimizeXL owners first, then measure
   the result. Reuse their supported proposals and settings; adjustable animation
   reduction is not exact cleanup. Do not change their rules or tolerances or
   reproduce their repair logic in a script. See [OptimizeXL](OPTIMIZEXL.md) and
   its [teaching agreement](OPTIMIZEXL_TEACHING.md).
3. Express “looks the same” as tolerances in model units for each animation,
   informed by its own speed: offsets are easier to see in slow movement.
   Keep first and last poses exact. Always call
   `compareMotion(acceptedModel, candidateModel, {sequences, step})` against the
   accepted version. It imports MDLxL's sampler, hierarchy and skinning: never
   write another evaluator. Read the distances, speed differences, endpoint
   samples, centre drift, contact travel and channel spans together. Changed
   topology has no assumed vertex correspondence; inspect it separately.
4. Save two or three candidates with `mdlxl_versions` at different tolerances.
   Report each candidate's real size and per-animation measured differences.
   Recommend the tightest candidate that meets the requested size; if none does,
   show the trade-off and let the user choose. Candidate statistics are evidence,
   not automatic permission to change accepted motion.
5. Change interpolation or replace a track with static values only where the
   app's motion comparison shows the change is within the stated tolerance.
   Preserve exact endpoints and check between keys. Use the app's serializer
   and editor RGB values; never reason about raw MDX bytes or channel order by
   hand. Equal quaternion controls can match linear interpolation; the same
   assumption is wrong for vector Hermite tangents.
6. Each animation keeps its own visibility keys: when an animation has no key,
   the sampler uses the default. Check geoset alpha/colour, attachment/effect/
   ribbon/light visibility and material-layer alpha in every touched animation,
   including neighbouring clips. Zero vertex movement does not prove these
   channels stayed the same.
7. Review with `mdlxl_review inspect`, using the accepted version's name as
   `baseline`. With `frames` omitted, the pictures include measured differences
   across touched animations within the existing picture budgets; use playback
   for timing. Leave mesh, rig, materials and effects alone unless requested.
   After a measured-close result is rejected, show where/how much it differs
   and ask what the user sees. Deliver one result and state remaining game tests.

Versions last until MDLxL closes. After restarting, reopen the accepted saved file
to establish the reference again. The owner judges the result; neither a native
percentile nor a small measured distance proves acceptance in Warcraft III.

## Run an existing OptimizeXL stage from a script

The sandbox already exposes the document serializer and `runOptimizeStage`.
Use this read-only recipe to return a detached candidate and its unchanged
OptimizeXL report; inspect the stage/settings signatures first. The example
uses animation strength zero for exact cleanup; adjustable reduction is a
separate measured candidate. The document owner handles colour conversion,
node order, validation and reopening. No raw writer or second reducer is needed.

```js
const { openDocument } = await api.module('editor-document');
const { runOptimizeStage, simpleSettings } = await api.module('optimizexl');
const doc = openDocument('Version { FormatVersion ' + model.Version +
  ', }\nModel "AI working copy" { BlendTime 150, }', 'working.mdl');
const sections = Object.keys(model).filter(key => key !== 'Nodes');
doc.apply('Working model snapshot', sections, working => {
  Object.assign(working, structuredClone(model));
});
const source = doc.serialize('mdx');
const report = runOptimizeStage(source, 'animation', simpleSettings('animation', 0, doc.model));
const candidate = openDocument(report.bytes, 'candidate.mdx').model;
return { candidate, report };
```

Measure `candidate` against `references["version:ACCEPTED"].model` using
`ai-motion-compare` before choosing it. To commit a chosen candidate, run the
recipe in `mdlxl_script` with `edit:true`, a plain label and the canonical
sections actually changed in `scope`; replace its final return with
`Object.assign(model, candidate); return report;`. The existing script owner
validates and applies this as one Undo step. Returning a candidate from a
read-only script never applies it, and this recipe changes no OptimizeXL rule.
