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
