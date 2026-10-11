# POSE motion research

Research date: 2026-10-11. This records reference evidence and test construction; it does not establish visual acceptance of the Motion tool.

## Original local game references

The existing read-only `electron/mpq.cjs` reader extracted these assets from the user's local Warcraft III archives. Archive lookup order was `D:/WarcraftStuff/War3Patch.mpq`, `War3x.mpq`, `War3xLocal.mpq`, then `war3.mpq`. Texture bytes were resolved from those same archives. No reference model or texture belongs in the application bundle or Git history.

| Model | Logical asset | Actual source | Studied attack 1 | Walk | Death |
| --- | --- | --- | --- | --- | --- |
| Footman | `units/Human/Footman/Footman.mdx` | `war3.mpq` | 12500-13500 | 17667-18467 | 21333-24367 |
| Peon | `units/Orc/Peon/Peon.mdx` | `war3.mpq` | 7200-8200 | 5600-6200 | 27100-31833 |
| Grunt | `units/Orc/Grunt/Grunt.mdx` | `war3.mpq` | 5133-6100 | 667-1333 | 6833-8400 |
| Peasant | `units/Human/Peasant/Peasant.mdx` | `war3.mpq` | 23200-24200 | 29100-29900 | 34333-37667 |
| Ghoul | `units/Undead/Ghoul/Ghoul.mdx` | `war3.mpq` | 10667-11500 | 2000-2667 | 13333-15000 |
| Mountain King | `units/Human/HeroMountainKing/HeroMountainKing.mdx` | `War3Patch.mpq` | 14967-15967 | 18333-19167 | 19333-21833 |

Times are native milliseconds. Provenance establishes the files present in the local game archives; their archive contents were not compared with a separate official distribution.

`out/motion-study-originals/inventory.json` records exact source paths, SHA-256 values, texture provenance, sequence indices, hierarchy and POSE chains. Reference files remain unmodified. `motion-data.json` contains 101 samples per clip for two attacks, walk and death on each model: 24 clips total. Descriptive sampling uses the editor's `src/animation.js` track sampler and world node matrices. Final pose-preservation checks below use the actual native renderer because rounded quaternion interpolation differs between them. Local quaternion range, pivot trajectories and finite-difference speeds are descriptive measures, not a collision or mass simulation.

The packaged native renderer supplied eleven checked frames for attack 1, walk and death on each model. Each capture verified the native sequence/frame. Normal Alt+mouse dragging was used to rotate the camera. Local evidence is in `{model}/capture`, `{model}/0-contact.jpg` (attack), `1-contact.jpg` (walk), and `2-contact.jpg` (death). These frame sheets expose pose relationships; continuous playback remains necessary for judging final rhythm.

## What the references show

- Attacks coordinate multiple body parts. Footman attack 1 has 19 changing transform channels, Peon 15, Grunt 19, Peasant 16 and Mountain King 22. Chest local rotation spans approximately 89, 113, 112, 138 and 123 degrees respectively. Those are measured orientation ranges, not recommended settings.
- Preparation, strike, follow-through and return use different spacing. In the sampled attack 1 clips, the visible preparation extreme to downward/forward strike occupies roughly 100-200 ms; the return takes much longer. Additional breakdown poses and staggered per-joint keys shape the transitions.
- Foot support is coordinated with body movement. Footman attack 1 shifts the root approximately 22 units fore/aft while each foot pivot moves less than 2 units along that axis. Moving its torso without accommodating the legs would destroy that relationship.
- Weight does not imply a universal bounce. Attack 1 root vertical excursion is approximately 0 units for Peon, 3.36 Footman, 8.40 Peasant, 21.92 Grunt and 31.39 Mountain King. Mountain King lifts its body and feet; permanent foot pins would fight that action. Peon attack 2 also travels much more than attack 1 despite using the same skeleton.
- Walks use opposing strides roughly half a cycle apart, plus different hip/chest, arm and body-height timing. Body vertical excursion divided by mean leg length ranges from approximately 0.13 for Peon to 0.33 for Footman. Uniformly adding a stomp pulse is not a shared original-game pattern.
- A full sequence interval is not necessarily the duration of the action. Footman death holds much of its fallen pose after about 38.5% of a 3034 ms interval. Peon death establishes its fallen pose near 29% of a 4733 ms interval. A fixed percentage of clip duration is an unreliable hit/fall detector.
- Rig names and topology need current visible-actor evidence. Ghoul has alternate/death branches that are static during ordinary attacks. Footman's sword-arm ancestors have `L` names while its hand endpoint has an `R` name. A side suffix alone is not a reliable anatomical assignment.

A concrete counterexample to peak-speed hit detection is Footman attack 1: maximum sword-hand pivot speed occurs near 12755 ms, during the raising motion. The native overhead pose is at 12800 ms, followed by the downward cut at 12900 ms. Highest endpoint speed is not necessarily intended contact.

The reusable direction is to preserve authored pose anchors while shaping their transitions, coordinate connected body parts, and keep support/contact choices inspectable. Sparse poses leave genuine ambiguity about the intended target, contact response and style. This research supports useful constrained assistance; it does not establish a universal automatic polish operation.

## Supplied WhiteoutFlakes video and primary references

The supplied local video, `577423-3e8302e0da8bc0923434a29fd1d9c244.mp4`, was inspected in the main task. Its early UI shows Physics/Create/Ragdoll/Edit and a directional force that pushes bodies; the character then collapses. Later, the video shows a Walk sequence with dynamic plume nodes and a baking operation. This is evidence for physics-generated motion and committing simulation results to animation. It does not demonstrate automatic improvement of a sparse authored attack.

BlinkBoy's [WhiteoutFlakes+ announcement, posts 19-22](https://www.hiveworkshop.com/threads/presenting-whiteoutflakes-a-new-powerful-model-editor.374690/) introduces the demonstration, is followed by a ragdoll/physics question, and includes the author's confirmation. The local video's visible controls provide the specific force/baking evidence; the public thread corroborates the tool's physics capability. No implementation or UI was copied from it.

BlinkBoy's [3ds Max animation tutorial, section 4.5](https://www.hiveworkshop.com/threads/in-depth-animation-tutorial-3ds-max.123520/) develops an attack through coordinated body poses and timing, refining an initially weak hit. It is a useful guide to what motion assistance should improve, independently of ragdoll simulation.

Autodesk Research's [Staggered Poses](https://www.research.autodesk.com/publications/staggered-poses-a-character-motion-representation-for-detail-preserving-editing-of-pose-and-coordinated-timing/) explicitly represents coordinated timing across body parts and provides sparse pose controls while retaining movement detail. It supports separating pose constraints from coordinated timing. Its paper is conceptual research evidence, not a claim that the MDLxL implementation reproduces that algorithm or its results.

## Sparse-pose test construction

`out/motion-study-originals/sparse-inventory.json` identifies twelve standalone native MDX inputs:

- Five attacks (Footman, original Peon, Grunt, Peasant, Mountain King), each with four visually selected poses: ready, preparation extreme, cut/follow-through, ready copied at the end.
- A second version of each attack puts those identical poses at 0%, 33%, 67% and 100%. These naive equal timings prevent the test from quietly depending on original expert timing.
- Footman and Peon walk inputs use first stride, passing, opposing stride and the first pose copied at the end.

Every fixture has one sequence at index 0. Every Bone/Helper Rotation, Translation and Scaling track contains exactly four Linear keys. Original detailed pose tracks and other sequences are discarded from these copies. The production motion engine must receive only the sparse model; the dense originals and measured trajectories are evaluation references only. No reference animation is an input to generation.

| Attack | Original sampled poses | Final time | Equal-timing pose timestamps |
| --- | --- | --- | --- |
| Footman | 12500, 12800, 12900, 12500 | 13500 | 12500, 12833, 13167, 13500 |
| Peon | 7200, 7600, 7700, 7200 | 8200 | 7200, 7533, 7867, 8200 |
| Grunt | 5133, 5423, 5533, 5133 | 6100 | 5133, 5455, 5778, 6100 |
| Peasant | 23200, 23500, 23600, 23200 | 24200 | 23200, 23533, 23867, 24200 |
| Mountain King | 14967, 15267, 15367, 14967 | 15967 | 14967, 15300, 15634, 15967 |

The third pose is a visual action landmark, not a claim about gameplay damage timing. Source sample times and new anchor timestamps are recorded separately.

Nontransform local tracks are clipped to the retained interval; test event sounds are removed. Mountain King has seven global Bone/Helper tracks: two animated halo scales and five single-key clothing/object tracks. For these test copies only, their sampled values become four local keys, so no dense transform references remain. Two unused particle emission tracks receive explicit zero-emission keys after clipping; an empty emission track crashes the current native renderer's capacity calculation. Nontransform globals remain native. These fixture adaptations must not become silent production behavior.

Reopened fixtures match original sampled anchor pivots within 0.000004 model units and rotations within 0.00000006 radians. First/last pivot difference is zero. Original reference SHA-256 values remain unchanged. Native captures confirm that all five evenly timed attack inputs load and display their poses. These checks establish valid, sparse test inputs; they do not establish improved animation.

## Step proof and geometric limits

The Step study adds three-pose native walk inputs: opposing whole-body stride poses at 0% and 50%, then the first pose copied at 100%. Footman has both an input sampled at original 0/50% (airborne anchors) and one sampled at original 25/75% (contact extremes); original Peon uses 0/50%. The engine sees only those three poses. Their source times, output anchors, generated files and settings are recorded in `out/motion-study-originals/step-prototype.json` and `step-integrated.json`.

Sparse Step uses mapped limb geometry and knee-bend direction to distinguish the forward returning foot from the backward supporting foot. It adds an arched return and a ground-directed support path between the saved poses. The ground is the editor XY plane at Z=0 unless the user changes Ground height. It never moves a saved pose onto that plane. Foot geometry weighted mainly to the foot endpoint supplies an approximate sole offset, rather than assuming the ankle pivot is on the floor. Native limb/body solvers produce editable transforms.

Independently reopening the sparse before/after files gives zero anchor-matrix difference. At the two passing-frame samples, the Footman contact input has sole penetration of about 7.7–7.9 model units; Step puts its supporting sole within 0.04 units of the plane while clearing the returning sole by 2.4–3.4 units. Peon starts with about 8.8–9.0 units of penetration; Step puts the support within 0.03 units while clearing the return by 7.1–10.2 units. These measurements use skinned visible foot vertices, not only target-pivot distances. Side-view native captures are in `out/motion-study-originals/step-side-left`.

Detailed authored walks use their own per-foot clearance phases. They retain their existing foot trajectories and receive smaller lift/contact adjustments. This does not require guessing a common facing direction for front and hind knees that bend oppositely. The custom Knight's four hooves exposed precisely that ambiguity, whereas original Footman and Peon knee geometry agrees with their stride direction. The separate native body-pin solver must also preserve all mapped endpoints; a build rejection is reported rather than hidden.

Two nearly identical passing poses do not specify a stride. Peon's original quarter/three-quarter samples demonstrate this and are rejected as an insufficient sparse stride input. Sparse rigs with inconsistent bend direction, missing foot geometry or too few mapped legs also return explicit reasons. Partial/blended foot bindings and animated scale make the rigid sole estimate approximate. These are bounded helpers for a chosen Step intent, not automatic gait recognition, a contact simulator or a replacement for reviewing the resulting motion.

## Native interpolation preservation and measured residual

Final native checks reopen serialized MDX files, evaluate them through `war3-model`'s `ModelRenderer`, and compare every node matrix at each kept pose. Original Peon, the custom Knight and the custom Dragon dense Walk outputs have exactly zero matrix, pivot and foot difference at those poses. The other clips also match exactly at their start, midpoint and end: 63 checked frames for Peon, 39 for Knight and 84 for Dragon. These are sampled checks, not a claim that every fractional frame outside the clip was exhaustively compared. Boundary duplicates and outside-facing cubic tangents retain their authored semantics.

Classic/custom MDX can contain rounded, nonunit rotation quaternions. Native playback interpolates them without normalization. Subdividing a Linear interval therefore changes the quaternion magnitude between keys even if the inserted poses match the original. Keeping native anchor values prevents pose drift, but does not make subdivision mathematically invariant. Knight and Dragon's affected rotation tracks are Linear; changing cubic tangent magnitudes cannot fix this behavior. Peon's affected tracks are Hermite and its measured magnitude error is below 0.00000014 in the tested neighborhoods.

An independent probe checked offsets of 0.0001, 0.001, 0.01, 0.1, 0.25, 0.5 and 1 ms on either side of all kept poses. It isolates the radial interpolation component by retaining generated orientations/translations and replacing only quaternion magnitude with the source-native magnitude at the retimed source frame. It is a diagnostic comparison, not an alternative generated animation. Within these sampled neighborhoods:

| Dense Walk | Maximum pivot residual | Maximum foot residual | Maximum mesh-vertex residual | Vertex residual / bind height |
| --- | --- | --- | --- | --- |
| Peon | 0.000015 units | 0.000011 units | 0.000017 units | below 0.00002% |
| Knight | 0.2921 units | 0.1194 units | 0.1840 units | 0.0691% |
| Dragon | 0.4489 units | 0.0729 units | 0.6886 units | 0.2598% |

The vertex bound excludes static zero-alpha geosets but may include geosets hidden by animated visibility, making it conservative. Bind heights are 108.84, 266.37 and 265.11 units respectively. These are observed neighborhood bounds, not global error guarantees for arbitrary rigs or settings.

The Knight/Dragon pivot residual drops to 0.000042/0.000095 units at 0.0001 ms, and actual distance from the kept pose is below 0.000091 units. This is continuous native interpolation curvature rather than a demonstrated finite position discontinuity. It remains a small numerical limitation to judge in actual playback; no controller conversion or renderer change is included. Evidence and the independent harnesses are `out/motion-study-originals/tangent-experiment/{with-fit,world-bounds}.json`, `check-native-anchors.mjs`, `check-tangent-magnitude.mjs` and `check-native-radial-world.mjs`.

## Acceptance limits

A useful result must be judged through native playback at normal and reduced speed, comparing the same camera and chosen settings. Preservation checks, successful serialization and a changed silhouette are necessary evidence, but none prove aesthetic improvement. In particular, sudden stops at intermediate anchors, long unintentional freezes, foot sliding, mismatched torso/weapon movement and loss of a chosen impact pose remain failures even when every key is finite and the file saves correctly.
