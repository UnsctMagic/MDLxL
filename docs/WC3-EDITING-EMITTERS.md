# WC3 editing: particles, ribbons, lights and events

Read this for effect placement, timing, appearance or copying. Use
[animation](WC3-EDITING-ANIMATION.md) for local/global clocks and
[game integration](WC3-EDITING-GAME-INTEGRATION.md) for game-resolved events.

## Identify the effect mechanism first

**PE1, PE2, ribbons and events are different records.** A classic particle emitter
can reference an external model; Particle Emitter 2 emits textured particles;
a ribbon joins a history of emitted points; event objects trigger game-defined
sounds or spawned visuals. Popcorn emitters are another system. Editing a
geoset's alpha will not necessarily control any of these. Inspect the actual
node family, parent, pivot, referenced resource and time domain, then observe
the corresponding effect through a full emission cycle. [E1, E2]

**Copy the dependency graph, not just the visible emitter.** Parent transforms,
textures, ribbon materials, texture animations and global sequences can all
contribute. The existing effect-copy owner remaps those references and rejects
unsupported version/bind-pose combinations. Preserve that boundary.
Inspect the returned mapping and timing policy; compare source/recipient
trajectories and appearance. Identical filenames alone do not establish identical
resource contents. [E1]

## Keep emission, particle age and visibility distinct

**Stopping emission is not erasing particles already alive.** Visibility controls
whether an emitter creates new particles; particle lifetime and age alpha govern
what remains afterwards. Set the requested onset/cutoff using the appropriate
channel and inspect the residual tail. For a hard visual stop, first understand
which supported mechanism the model already uses; do not shorten every lifetime
or delete the effect blindly. [H1, E3]

**Continuous rate and Squirt are different timing models.** Continuous
`EmissionRate` describes particles per second; Squirt uses keyed emission for
bursts. A visibility-only edit does not fully specify burst timing. Preserve
the existing emission keys and test entering the sequence, the intended burst
frame, repeated playback and frames after it. Historical tutorials disagree on
Squirt details; use the target game's result for onset behavior instead of
assuming an editor's scrub preview is authoritative. [H1, E3]

**Use the field's units, not a shared numeric scale.** Sequence/key times are
milliseconds, while PE2 `LifeSpan` is seconds. `Time` places the middle segment
within a particle's lifetime, rather than an absolute sequence timestamp.
PE2's three `Alpha` entries are bytes 0..255; geoset/layer alpha uses 0..1.
`SegmentColor`, `Alpha` and `ParticleScaling` describe age stages.
Inspect the start, middle and terminal appearance of a particle, independently
of the sequence's emission schedule. [E2, X1]

**An atlas has both a layout and an age animation.** Preserve Rows/Columns,
head/tail lifetime and decay intervals, and their repeat settings.
These select texture cells; they are not interchangeable with ordinary
animated material TextureID. Verify referenced cells fit the actual image grid,
then inspect newly emitted, midlife and dying particles. A missing old game
sheet cannot be validated by a substitute white or checkerboard texture.
[E2, X1]

## Preserve motion and rendering behavior

**Parent motion and Model Space answer different questions.** Parent transforms
position/orient the emitter. Model Space determines whether emitted particles
continue to move with the model/parent system. XY Quad and Head/Tail flags further
change orientation and visible geometry. Check while the carrier translates and
turns, and from multiple camera angles; a stationary preview cannot prove a trail
will remain in the intended space. Preserve the bits independently of their
preview representation. [H1, E2]

**Particle filter numbers are not material filter numbers.** PE2 uses
0 Blend, 1 Additive, 2 Modulate, 3 Modulate2x, 4 AlphaKey. Material-layer
0 means None instead. Use the actual enum for the object being edited.
Check bright and dark backgrounds, overlap and occlusion after a mode change.
Unshaded, Unfogged, depth/sort flags and PriorityPlane can change the result
without changing texture pixels; preserve them outside scope. [E2, E4]

**Tune visible cost through coverage as well as count.** For constant-rate,
non-Squirt emitters, rate × lifetime estimates a steady-state live-particle
count; it is not an FPS guarantee or a burst estimate. Large overlapping
translucent quads can be expensive even with few particles.
Compare the requested effect at intended size and repeated-instance density
before increasing rate, size or lifetime. Keep burst and animated-rate cases
separate from the constant estimate. [E5]

## Ribbons, lights and events

**A ribbon needs movement history.** Its parent/pivot and height-above/below
fields define the emitting edge; lifetime and emission determine the trail left
behind. A single static frame can show no ribbon even when the saved setup is
valid. Replay from a known start, inspect the full sweep and cutoff, and check
material/atlas references. Fit it to the intended surface in posed frames,
rather than assuming the bone pivot is the visible edge. [E1, E6]

**A light is illumination, not a glow card.** Preserve its type, attenuation,
colour/intensity, visibility and parent motion. A luminous-looking unshaded
material does not necessarily illuminate nearby geometry. Inspect the affected
surfaces and lighting context in the target game, especially for UI/portrait
scenes with different ambient lighting; do not replace a light with an additive
plane solely because one view looks similar. [E2, X2]

**Events need a valid game identifier and a correct time.** Preserve the event's
type/code, parent, pivot, EventTrack and optional global-sequence reference.
Use the configured game event definitions instead of inventing names.
Sound, footprint, splat, ubersplat and spawned-model behavior depends on game
resources and playback. Preview what the editor supports, then verify the
triggered result in Warcraft. Retiming transforms without retiming an event can
detach its visible or audible cue from the action. [E7, E8]

## MDLxL tools and common mistakes

Discover `particle-recipes`, `particle-editing`, `particle-placement`,
`particle-ribbon-fit`, `emitter-timing`, `particle-inspection`,
`glow-up` and `animation-tracks` through `mdlxl_capabilities`.
EMTR's existing controls own live placement drafts; Node Manager owns event
selection. Read exact signatures and changed collections before scripting.

Common mistakes: using particle Alpha 1 as fully opaque, setting LifeSpan in
milliseconds, copying a material filter number into PE2, changing Visibility
instead of age alpha, judging a ribbon without replay, and calling an unsupported
effect preview a broken model.

Reference/atlas validity, clock consistency and protected-field comparison are
automatable. Emission history, sorting, appearance and game event behavior need
the appropriate renderer/game check.

## Sources

- **E1:** [Effect extraction/copy/placement](../src/particle-recipes.js).
- **E2:** [war3-model record types and enums](https://github.com/4eb0da/war3-model/blob/master/model.ts);
  checked against installed 4.0.1 types/source map.
- **E3:** [Native timing owner](../src/emitter-timing.js),
  [animated particle fields](../src/particle-editing.js).
- **E4:** [Material modes for comparison](WC3-EDITING-UV-MATERIALS.md).
- **E5:** [Constant-rate estimate and repeated instances](../src/particle-inspection.js).
- **E6:** [Ribbon fitting](../src/particle-ribbon-fit.js).
- **E7:** [Resource managers and native event lookup](RESOURCE-MANAGERS-XL.md).
- **E8:** [Event global-sequence preservation](../src/event-object-codec.js).
- **H1:** [Hive: Particle Emitters 2](https://www.hiveworkshop.com/threads/particle-emitters-2.329335/),
  Vinz with credited research by Hermit, GhostWolf and other practitioners.
  Its viewer/game distinctions matter; unverified timing estimates are not caps.
- **X1:** [XGM: Particle Emitter 2](https://xgm.guru/p/heavens-gallery/particle-emitter-2),
  Empyreal's field explanations. Its struck-out Squirt advice is not used.
- **X2:** [XGM: Modelling FAQ](https://xgm.guru/p/wc3/mfaq),
  scene-lighting context and light-object distinctions.
