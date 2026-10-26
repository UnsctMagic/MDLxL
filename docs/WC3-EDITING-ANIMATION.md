# WC3 editing: animation and motion transfer

Read this for posing, key changes, retiming, sequence changes or donor motion.
Use [nodes/binding](WC3-EDITING-NODES-BINDING.md) to establish the actual drivers
and [emitters](WC3-EDITING-EMITTERS.md) for synchronized effects.

## Work in the correct time domain

**Warcraft key times are milliseconds.** A displayed frame value is not a frame
number at an assumed 30 or 60 fps. Local keys share one timeline and are selected
by the sequence interval. Inspect its exact endpoints before editing or copying.
Keep keys sorted and avoid creating duplicate timestamps or unintended overlap;
shared sequence endpoints need an explicit scope decision. Compare keys outside
the authorized intervals byte-for-value, including tangents. [A1, A2]

**A global sequence belongs to the track, not the whole node.**
`GlobalSeqId` selects a duration in `GlobalSequences`; that track runs on its
own repeating clock. Other properties of the same node can use other domains.
Changing the duration affects every user of that global sequence, including
materials or effects. Inspect all references before changing it, and test several
global phases while local sequences change. Do not retime globals as if their
keys belonged to the selected local clip. [A1, A2, X1]

**Sequence metadata is behavior, not labelling decoration.** Preserve names and
animation tags, `NonLooping`, `Rarity`, `MoveSpeed`, sync data and extents unless
the request concerns them. Names/tags participate in game animation selection;
rarity describes variant selection, not a keyframe value to normalize.
`MoveSpeed` is movement metadata, not a command to translate the root.
Changing an interval alone does not retime its keys:
`sequence-editor.setSequenceInterval` only changes the interval.
Check duration, event alignment and actual game selection/playback when those
fields change; do not invent a rarity probability formula. [A2, A3, X1]

## Preserve the curve, not just the stored poses

**Interpolation is part of the motion.** `LineType` is 0 None/held, 1 Linear,
2 Hermite or 3 Bezier. Vector splines use their stored controls; rotation keys
are quaternions and need quaternion interpolation, not component-wise Euler
interpolation. MDLxL's sampler uses slerp for linear rotations and squad for cubic
rotations. Use the existing evaluator with the correct scalar/vector fallback,
sequence interval and global time. Check between keys: matching their values
does not establish matching motion. [A1]

**Track-wide changes can affect protected clips.** Interpolation and global
association live on the track, while several local sequences may have keys in
it. Changing `LineType`, deleting tangents or attaching a global sequence can
alter all those clips. Preserve track metadata for a local repair; inspect any
operation that recreates a track. Compare exterior keys and metadata as well as
samples just before and after the edited span. [A2, A4]

**Retain deliberate holds and small motion.** Repeated values can hold a pose;
a small turn can carry expression, recoil or a controlled reversal. Native
research supports sparse keys, but does not prescribe a key count or authorize
removing every similar value. Inspect the requested defect and nearby anchors,
then adjust only the responsible span. If reducing keys, compare the evaluated
curve and skinned surface with the original, not only endpoint values.
A clean warning list is not a substitute for retained intent. [A4, A5]

**Check loops as transitions.** Compare the final pose with the first, then motion
immediately on each side of the wrap. Equal endpoint positions can still have
a speed/direction discontinuity. Preserve intentional non-looping actions.
For sequence transitions involving replacement surfaces or remains, inspect
both pose continuity and visibility ownership; do not force unrelated clips
to share endpoints. [A1, A4]

## Transfer motion through the recipient's structure

Treat this as a staged editing method derived from the transform model and
existing POSE constraints, not a claim that MDLxL has a universal retarget button.
[A1, A6]

1. **Map drivers by function and hierarchy.** Inspect source and recipient
   parent chains, pivots, keyed helpers, skinned descendants and independent
   roots. Names can aid the mapping but do not prove it. Verify which surface
   moves when a driver changes before copying an entire clip.
2. **Reconcile rest orientation, scale and joint placement.** Donor local
   rotations operate in the donor's parent/pivot arrangement. Copying them
   unchanged can rotate the recipient around the wrong centre or axis.
   Prove a representative pose using world-space landmarks; retain the
   recipient's proportions and binding unless rebuilding them was requested.
3. **Transfer the requested domain.** Preserve recipient sequence names,
   timestamps and protected clips unless the task changes them. Map donor local
   times into the chosen interval, keep sparse controls where they reproduce
   the motion, and reject timestamp collisions rather than silently losing keys.
4. **Check contacts and relative motion.** Compare support/contact points,
   reach, carried-part alignment and clearance through anticipation, maximum
   excursion, impact and recovery. A correct skeleton pose can still stretch a
   differently proportioned mesh. Use positional samples and actual images.
5. **Carry only necessary dependencies.** Effects, events, attachment behavior
   and visibility need their own mapping and timing decisions. Validate imported
   IDs and paths. Do not import the donor's entire rig or overwrite every
   recipient track merely to obtain one useful action.

A documented solved transfer case required manual key adjustment after importing
a starting animation; successful import alone did not establish a useful result.
[H1]

## Retiming and bounds

**Retiming includes every affected local channel.** Bone motion, geoset/layer
alpha, texture animation, emitter parameters, camera tracks and event times can
share the action. Use the existing retiming owner, inspect its affected
collections and protect global/unrequested records. Check the same normalized
phases before/after, plus exact event onset times. Changing playback speed in a
preview alone does not rewrite the saved action. [A3]

**Changed motion can outgrow stored extents.** Model, sequence and per-geoset
sequence bounds have distinct owners. Rest-pose bounds are insufficient for a
moving surface; sample extrema and intermediate poses for affected clips.
`recalculateExtents` deliberately retains existing animation bounds.
Use the supported animated-bounds workflow where applicable, then test
edge-of-screen visibility in Warcraft. Sampling is evidence, not a mathematical
guarantee of every cubic extremum. [A7]

## MDLxL tools and common mistakes

Discover `animation`, `animation-tracks`, `keyframe-timeline`,
`sequence-editor`, `animation-speed`, `pose-ik` and `motion-inspector`.
POSE writes ordinary native keys and preserves hierarchy/binding; it is not
physics, automatic balancing or unrestricted IK for every transform.
Use `mdlxl_sample` and `mdlxl_capture` on matching frames.

Common mistakes: assuming fps, copying by names alone, treating MoveSpeed as
root motion, making a local repair by changing a whole track's interpolation,
adding keys repeatedly without diagnosing overshoot, and checking only endpoints.
Timestamp/reference checks, protected-key comparison and sampled trajectory
errors are automatable; believable contact, weight and character require review.

## Sources

- **A1:** [Track evaluation, hierarchy and skinning](../src/animation.js).
- **A2:** [Track editing](../src/animation-tracks.js), [AI edit scopes](AI-HOOK.md).
- **A3:** [Sequence fields](../src/sequence-editor.js),
  [retiming across native records](../src/animation-speed.js).
- **A4:** [Motion warning constraints](MOTION-INSPECTOR.md),
  [existing repair ownership and preservation](OPTIMIZEXL_TEACHING.md).
- **A5:** [Measured animation economy](AI-SD-REFERENCE-STUDY.md#animation-economy).
- **A6:** [POSE supported domain and structural recognition](POSE_IK.md).
- **A7:** [Rest extents](../src/editor-document.js),
  [sampled animated bounds](../src/optimizexl-bounds.js).
- **X1:** [XGM: Animation from A to Z](https://xgm.guru/forum/showthread.php?t=43883),
  local/global animation and sequence controls. Historical tool-specific bug
  advice is not used as an engine rule.
- **H1:** [Hive: solved animation transfer discussion](https://www.hiveworkshop.com/threads/throne-animation-transfers.372380/),
  A]mun's explanation of the adjustment performed after import, May 2026.
