# WC3 editing: animation and motion transfer

Use this for key editing, donor motion, retiming and sequence transitions.
Use [binding](WC3-EDITING-NODES-BINDING.md) for hierarchy/pivots,
[effects](WC3-EDITING-EMITTERS.md) for emitters/events and
[verification](WC3-EDITING-VERIFICATION.md) for completion.

## Choose the clock and controller

1. Read `Sequences[index].Interval`, `NonLooping`, `Rarity` and `MoveSpeed`.
   Local key times are absolute milliseconds inside the sequence interval.
   A track with a nonnegative `GlobalSeqId` uses the corresponding
   `GlobalSequences` duration and its independent repeating clock.
2. Load `keyframe-timeline` and call `timelineTracks(model)`. Select targets
   by `kind`, `id` and `property`; retain their `trackId`. Read their data with
   `timelineReadTrack(model, target)`. Use
   `timelineDomain(model, sequenceIndex = -1, globalSeqId = null)` for the
   intended local or global timeline.
3. Read `LineType`, `GlobalSeqId`, `Keys[].Frame`, `Vector`, `InTan` and `OutTan`.
   `LineType` 0 holds, 1 interpolates linearly, 2 uses Hermite controls and 3
   uses Bezier controls. Rotation vectors are quaternions, not Euler angles.
4. Inventory node, geoset, material, texture, camera and effect controllers
   plus `EventTrack` records affected by the requested motion. Timeline targets
   marked `readOnly` are inspection context; edit their actual owning record
   through its supported module or a precisely scoped typed script.

## Edit a pose or a local key range

1. Select only the intended targets. For sampled values use
   `timelineSample(model, target, time, domain)`. For transform poses use
   `movement.sampleMovement(model, node, property, time, sequenceIndex)`.
2. Write exact local transform values with
   `movement.applyMovementPose(model, changes, time, sequenceIndex, restrictions = {})`,
   where each change is `{id, property, value}` and property is `Translation`,
   `Rotation` or `Scaling`. The writer validates the whole pose, normalizes
   rotation and handles clip boundary keys. Keep its refusal intact if a static
   or global controller cannot be localized without altering other motion.
3. For supported timeline channels call
   `setTimelineKeys(model, targets, time, domain, values = null)`, with
   `values = {[target.trackId]: [components]}`. Sample existing boundary values
   first; put keys at the requested change boundaries so interpolation stays
   inside the intended interval.
4. Select a range using
   `selectTimelineRange(model, targets, domain, from, to)`. Copy it with
   `copyTimelineKeys(model, targets, selection, domain, origin)` and paste with
   `pasteTimelineKeys(model, targets, clipboard, time, domain, policy = 'reject')`.
   Use `clearTimelineKeys(model, targets, selection, domain)` only for the
   explicitly replaced keys. `'replace'` overwrites collisions; `'merge'` keeps
   existing collided keys. Start with `'reject'` to expose conflicts.
5. Keep untouched interpolation and controls. A track-wide change through
   `movement.setMovementControllerType(model, ids, sequenceIndex, mode, lineType)`
   changes the whole controller and its tangents; use it only when that is the
   intended scope. For a local curve edit preserve exterior controls and compare
   both neighbouring segments.
6. For a loop, make the terminal pose agree with the initial pose on changed
   controllers and inspect velocity across the wrap. Keep sparse meaningful
   keys for anticipation, change and recovery; add keys where intermediate
   sampling exposes drift, penetration or an abrupt transition.

## Copy donor keys when the structures agree

1. Open the donor as a reference through `mdlxl_document({action: 'open', path})`
   or `mdlxl_assets`. Read `references[documentId].model` in the script.
   Build an explicit donor-to-recipient ObjectId map from hierarchy, pivots,
   rest orientation and structural role. Include keyed helpers in that map.
2. Compare the mapped nodes' parent spaces, pivot offsets, inheritance flags
   and transform conventions. Use direct key copying only where those spaces
   produce the intended recipient motion. Keep the recipient's geometry,
   hierarchy and bindings when the request is motion transfer.
3. Read donor targets and domain, select the source interval and call
   `copyTimelineKeys`. Build recipient targets with `timelineTracks(model)`.
   Replace each clipboard entry's `target` with its mapped recipient target,
   including `trackId`. Paste at the target start with `pasteTimelineKeys`.
   The paste matches target IDs, not node names, and preserves the copied
   controls. Its local/global domain and interpolation must match.
4. For a different duration, first map copied key times by
   `round(targetStart + (sourceTime-sourceStart)*targetDuration/sourceDuration)`.
   Set the copied origin to `targetStart` before pasting at that time.
   Reject distinct keys that land on one timestamp. For a zero-duration source,
   transfer a pose rather than dividing by its duration.
5. Copy required visibility, effect and event timing separately through their
   owners with the same time mapping. Remap referenced resources and global
   sequence IDs explicitly. Compare exterior recipient keys and every
   unrequested controller after transfer.

## Retarget motion to different proportions

1. Match roots, chains, independent drivers and helper ancestry structurally.
   Choose donor/recipient reference poses, a world orientation alignment and
   the intended root travel scale. Record contacts and release times.
   Preserve recipient pivots and segment lengths.
2. Sample donor motion at keys, contact changes and intermediate times. Align
   donor root displacement to the recipient axes and scale it to the requested
   travel. Write the corresponding recipient local Translation with
   `applyMovementPose`, accounting for its parent transform.
3. For each chain, call
   `pose-ik.poseChainBetween(model, root, end, excluded = [])` and
   `samplePoseChain(model, chain, frame, sequence, globalTime = frame)`.
   Map the donor endpoint vector from its chain root through the chosen
   orientation alignment; scale by the recipient/donor chain-length ratio.
   Add the recipient chain root position to obtain the target world point.
   Map the donor bend direction to a world pole point as well.
4. Call `solvePoseLimb(model, chain, frame, sequence, target, settings = {})`
   with `settings.pole` as a world point and `settings.orientation` as the
   desired world quaternion `[x,y,z,w]`. For an aligned donor rotation change,
   use `Qtarget = C * (Qdonor(t) * inverse(Qdonor(ref))) * inverse(C) * Qrecipient(ref)`.
   Use the returned `changes` with `applyMovementPose`. The solver works on a
   preview and returns local changes; apply them from root toward descendants.
   It requires supported ancestry and positive uniform scale. Keep an
   unsupported rig intact and edit its local controllers instead of stripping
   flags or scale to force IK.
5. Hold a planted endpoint at its recorded world contact until release.
   Check the solver's `clamped` result; move the root or revise the target when
   it is out of reach. Carry a consistent pole through near-straight poses.
6. For an independently animated child transferred to another carrier, compute
   the desired world transform first, then
   `local = inverse(effectiveParentWorld) * desiredWorld`.
   Obtain the parent with `movement.movementParentMatrix(node, matrices)` and
   matrices with `animation.sampleNodeMatrices(model, frame, sequence, globalTime)`.
   Decompose local rotation/scale, then recover native translation from pivot
   `p` as `t = localTranslation - p + R*S*p`. Write those local transforms;
   reparenting alone changes the motion on a differently moving carrier.
7. Sample the result between written poses. Add keys only where contacts,
   orientation or path differ beyond the chosen tolerance. Inspect seam
   deformation, attachments, effect alignment, loop wrap and root travel.

## Retime a clip with events and effects

1. Read every sequence interval and
   `animation-speed.animationSpeed(sequence)`. The speed value is an absolute
   percent of the remembered original duration, not a multiplier applied to
   the current duration. Record local event times and active global associations.
2. Call `animation-speed.setAnimationActualSpeed(model, index, percent)` with
   an integer percent from 1 to 300. The selected clip's new duration is the
   original duration times `100/percent`, rounded to milliseconds. The operation
   shifts subsequent clips, retimes all local key families and local event
   tracks, and preserves values and spline controls. Global clocks stay intact.
3. For a batch, call `setAnimationSpeedChecked(model, index, checked)` for the
   intended clips, then `setAnimationActualSpeed(model, null, percent)`.
   Include all changed canonical track collections, `/Sequences` and
   `/_AnimationSpeed` in the script scope. Include the shifted later ranges in
   `animationRanges` and compare their relative timing.
4. If later absolute times must stay fixed, use a scoped script instead:
   require a free destination interval, map every local key/event inside the
   selected interval with the formula above, preserve exterior records,
   precheck duplicate timestamps and interval overlap, then write the new
   interval and mapped times together. Keep typed event arrays and track
   controls. `sequence-editor.setSequenceInterval(model, index, start, end)`
   changes interval metadata only; pair it with the actual time remapping.
5. Check each event against its associated pose, emission onset and visibility
   change before and after. Particle lifetime is in seconds and stays unchanged
   when key times move; change it separately only if the requested effect must
   also run faster. Inspect residual trails and particles after the clip.
6. Recalculate affected animated bounds and compare the whole state transition.
   Keep sequence names, loop flags, rarity and movement metadata unless the
   requested timing change includes them.

## Set sequence metadata deliberately

Use `sequence-editor.setSequenceMoveSpeed(model, index, value)` for movement
metadata, and `animation.setSequenceOptions(model, index, {nonLooping, rarity})`
for those fields. Read the existing values first, set only requested fields and
check the corresponding game state. Metadata edits and retiming are separate
operations. Recompute animated extent tables after changing motion with the
[game integration procedure](WC3-EDITING-GAME-INTEGRATION.md).
