# WC3 editing: file format and game integration

Read this for export targets, visibility in game, attachments, portraits,
collision, hero glow, death/decay or linked resources. Pair with
[emitters](WC3-EDITING-EMITTERS.md) and
[verification](WC3-EDITING-VERIFICATION.md).

## Separate format, editor support and game acceptance

**SD is not a version number.** Version 800 is the classic file layout;
900/1000 and later layouts add fields and record variants. Current native files
with SD appearance can use newer versions, including 1800 in the existing study.
Inspect actual materials, skinning and chunks before deciding compatibility.
Preserve the source version for an ordinary edit; changing only the version
number is not a conversion. Test the saved file on the requested game build.
[I1, I2, H1]

**Reading a format does not imply unrestricted editing or conversion.** MDLxL's
compatibility boundary preserves multiple modern versions and opaque data, but
its explicit version-conversion API currently accepts editable 800/1000 inputs
and targets. Content with weighted skin or HD fields can be view-only or require
an explicit conversion choice. Do not bypass a refusal by stripping fields.
Inspect the actual editable/diagnostic state and conversion losses; reopen the
result and compare protected data. [I1, I3]

**Use real representation limits without turning them into performance promises.**

| Representation | Constraint to check | What it does not establish |
| --- | --- | --- |
| Classic vertex-group index | Byte index: 0..255, up to 256 addressable groups per geoset | Total model bone cap or a four-member classic group cap |
| Geoset face index | Unsigned 16-bit vertex reference: 0..65535 | A target game's safe draw size, or a triangle budget |
| Weighted skin | Four slots per vertex; preserve the version-dependent ID width and 0..255 weights | Arbitrary conversion to classic groups |
| Local key/event time | Preserve the codec's signed 32-bit key/event representation | Permission to normalize authored negative setup records |
| Names/paths/UV streams | Respect the specific codec field and operation validation | One universal character, texture-size or UV-set rule for every dialect |

These are format/editor checks, not a certification of every game build's
renderer. Historical in-game geoset-size reports give lower practical thresholds
with uncertainty; do not present the file's 16-bit address space as a guaranteed
working maximum. Inspect the target and a known-good asset when approaching a
reported engine boundary. [I1, I4, H2]

**Preserve unfamiliar material/chunk structure.** A modern SD material may use
texture-slot arrangements an older editor cannot rewrite. Opaque chunks,
FaceFX or unsupported emitter records are not unused junk. Same-format
preservation and conversion have different guarantees. Use the existing loss
checks and report an unsupported edit rather than deleting data to make a
serializer succeed. [I1, H1]

## Keep the model connected to its game role

**An attachment is a named transform, not a bone nickname.** The game uses
attachment-point conventions to place external effects. Preserve the exact name,
ID, path, parent, pivot and visibility behavior required by the model's use.
When its carrier changes, inspect the attachment's world position through the
relevant sequences and test an actual attached effect. Moving only the mesh can
leave the effect behind. Do not rename attachment points as cosmetic cleanup.
[I5, I6]

**Collision shapes, extents and map pathing solve different problems.** Collision
shapes support model interaction/selection; extents describe bounds used for
visibility/culling. Object-editor collision/pathing settings are separate game
configuration, not a substitute for either model record.
Check selection and edge-of-screen visibility separately in Warcraft.
A large collision sphere does not repair stale sequence extents; rebuilding
rest bounds alone does not cover animated motion. [I7, X1]

**Test sequence states as a connected lifecycle.** Stand/Walk, Attack, Birth,
Morph, Death, Decay and Dissipate are game conventions with different jobs.
Preserve the source's appropriate states and tags; not every asset needs all
of them. For a changed lifecycle, inspect the last visible pose, the next state's
first pose, replacement surfaces and effect visibility together. Check the game
object's death/decay configuration as well as the model: model naming alone does
not establish corpse duration or removal behavior. Existing long decay intervals
are observed conventions, not a command to retime every asset. [I2, I8]

**Events encode behavior in the name and track.** Classic prefixes include SND
(sound), SPL (blood splat), FPT (footprint), UBR (ubersplat) and SPN (spawned
object). The remaining identifier selects game data; it is not arbitrary prose.
Use the existing event chooser/catalogue, retain the event clock and inspect
the pivot at its trigger time. Verify resource resolution and the actual
sound/visual in game, including after a retime. [I5, H3]

**Portraits need their intended camera and asset relationship.** Preserve
camera position, target, field of view, clipping and animation. A separate
portrait convention uses the same model basename with `_Portrait.mdx`; an
embedded camera/portrait sequence is a different arrangement. Check the actual
package path, intended portrait view, talk/idle motion and clipping in the game.
A full-body orbit image does not validate portrait framing, and a deliberately
partial portrait mesh is not unfinished body geometry. [I2, I8, H4]

**Hero glow is authored effect behavior.** Team glow uses ReplaceableId 2 and
an appropriate material; it is not the same as assigning hero gameplay status.
The existing study distinguishes origin planes with pulsing scale from attached
billboard surfaces that follow a carrier. Preserve parent/pivot placement and
death/decay visibility, and inspect the glow on terrain and through turns.
Do not add it to an ordinary edit unless requested. Use the existing Glow Up
owner for authorized additions rather than inventing another setup. [I9]

**Verify the delivered dependency paths.** Texture and external model paths,
portrait counterparts and event resources must resolve in the intended map/game
environment. Successful local-library lookup can conceal missing map imports.
Preserve native references, export requested custom assets with matching relative
paths, then reload in a fresh target context. Preserve supplied originals during verification.
[I1, I5, I6, X1]

## MDLxL tools and common mistakes

Discover `model-version`, `editor-document`, `texture-references`,
`sequence-editor`, `portrait-extents`, `optimizexl-bounds` and `glow-up`.
Use `mdlxl_document validate` for serialization checks and the existing resource
managers for cameras, attachments, lights and game event data. The installed
capability list, not this document, determines whether an operation is callable.

Common mistakes: relabelling a modern file as 800, treating every warning as a
game crash, claiming a 65,536-vertex geoset must work in game, confusing collision
with pathing, or testing a portrait only through a free camera.
Reference/format checks are automatable; the game-specific outcomes above require
the named target and an actual game test.

## Sources

- **I1:** [MDL/MDX preservation and remaining boundaries](MDL-MDX-COMPATIBILITY-FIXES.md).
- **I2:** [Existing native/reference study](AI-SD-REFERENCE-STUDY.md).
- **I3:** [Current conversion and content classification](../src/model-version.js).
- **I4:** [Classic mesh limits](../src/classic-mesh.js),
  [binding limits](../src/bone-tools.js),
  [independent GEOS format reader](https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/parsers/mdlx/geoset.ts).
- **I5:** [Resource managers and game event definitions](RESOURCE-MANAGERS-XL.md).
- **I6:** [AI save and asset contract](AI-HOOK.md).
- **I7:** [Rest bounds](../src/editor-document.js),
  [animated bounds](../src/optimizexl-bounds.js).
- **I8:** [Sequence operations](../src/sequence-editor.js),
  [portrait bounds](../src/portrait-extents.js).
- **I9:** [Measured glow construction and native writer](GLOW_UP.md).
- **H1:** [Hive: MDX 1100 parsing discussion](https://www.hiveworkshop.com/threads/bug-in-the-mdx-1100-parsing-by-thompzon-and-twilac.349270/),
  Retera's explanation of multiple assignments within a layer and preservation loss.
- **H2:** [Hive: Mdx sanity tester](https://www.hiveworkshop.com/threads/mdx-sanity-tester.290476/),
  GhostWolf's 2021 notes distinguish uncertain engine thresholds from warnings.
- **H3:** [Hive: Adding Event Objects](https://www.hiveworkshop.com/threads/adding-event-objects-in-3dsmax-5.7396/),
  Chriz's approved explanation of native event codes.
- **H4:** [Hive: Modeling and Animation 101](https://www.hiveworkshop.com/threads/modeling-and-animation-101.41840/),
  portrait camera and separate-file conventions; historical crash claims are not
  treated as universal modern behavior.
- **X1:** [XGM: Modelling FAQ](https://xgm.guru/p/wc3/mfaq),
  separate selection, bounds, import-path and scene-lighting diagnoses.
