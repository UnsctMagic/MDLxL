# WC3 editing: geometry and shading

Read this for reshaping, joining, mirroring, welding, density or shading edits.
Also read [nodes/binding](WC3-EDITING-NODES-BINDING.md) for deforming surfaces,
[UV/materials](WC3-EDITING-UV-MATERIALS.md) for seams, and
[verification](WC3-EDITING-VERIFICATION.md) before finishing.

## Diagnose the surface before rebuilding it

**Separate shape, facing and shading.** A wrong outline requires geometry work;
missing front faces suggest winding or visibility; dark patches can come from
normals, painted light or material flags. Two-sided rendering does not repair
winding or give the back of a triangle a separately authored normal. Inspect
wireframe, one-sided solid shading, normal directions and the textured result
from both sides before choosing a correction. MDLxL's preview and Warcraft can
shade back faces differently, so a good-looking two-sided preview is insufficient.
[X1, G1]

**Judge density in the state that will be seen.** Whole-file counts can include
hidden alternate surfaces, remains, effects and LODs. Count the affected visible
surface at a specified sequence/time before proposing reduction. Existing
research shows both painted thin surfaces and fully modelled volume serving
different roles; neither a corpus median nor one construction family is an
automatic target. Keep geometry that carries the requested silhouette,
articulation or visible depth. Check textured game-scale and oblique views, not
only a close wireframe. [G2]

## Keep the right vertices separate

**A position is not a complete vertex.** Warcraft geosets store per-vertex normals,
UV coordinates and binding streams. Two corners at the same position can need
different UVs or normals while remaining one continuous visible surface. A
material split can also divide a continuous surface into different geosets.
Before joining, compare all UV sets, normals, tangents, binding and visibility
roles; after joining, inspect the paint boundary and the posed seam. Position
coincidence alone is no permission to weld. [H1, G1, G3]

**Choose the intended weld operation.** In MDLxL, classic
`weldSelectedVertices` merges the selected vertices at a common centre and retains
the last selected vertex's attributes even across UV/normal/rig seams.
`mesh-tools.weldVertices` is the compatible tolerance weld. They solve different
requests. Inspect conflicts and the requested selection before calling either;
compare retained attributes, surviving triangles and selected IDs afterwards.
Moving seam copies to a common position can close a gap without deleting their
separate attributes. [G3]

**Keep every vertex stream aligned when changing topology.** Splitting, appending
or deleting vertices must remap faces, normals, each UV set, classic groups and
any weighted skin/tangent stream together. Update primitive counts through the
existing editor/serializer path. Otherwise a file can look plausible in memory
yet save stale counts or associate paint/bones with the wrong vertices. Check
stream lengths, face indices, primitive counts and the saved/reopened result.
[G3, G4]

**A mirror includes facing, not automatic re-rigging.** Reflection reverses
orientation. Use the existing transform/mirror implementation so copied triangles
have corrected winding and transformed normals. A copied vertex retains its
source binding unless explicitly remapped; a spatially mirrored part can still
follow the original side's motion. Choose the axis/plane from the actual model,
inspect both sides and sample asymmetric poses. Preserve mirrored UV reuse unless
the paint's direction or the request requires a separate wrap. [G3]

## Preserve continuous motion and intentional separation

**Build deformation transitions into the surface.** Abruptly joining regions that
follow unrelated transforms can stretch the connecting triangles. Keep sufficient
rings for the observed bend and transition influences through the deforming
region. A rigid separate part can retain a single transform; adding blend rings
everywhere would change its character. Measure edge stretch and seam separation
at the most different neighbouring poses, including between stored keys.
[Nodes/binding](WC3-EDITING-NODES-BINDING.md) explains the evidence and exceptions.

**Do not merge geosets solely because their texture matches.** Material identity,
layer animation, geoset alpha/colour, selection flags, LOD and rig dependencies
also matter. Separate parts can intentionally show at different times.
Use `geosetMergeConflicts` to inspect the actual conflict list and respect the
approved resolutions. Compare visibility across every affected state, not just
the currently visible pose. [G5]

**Rebuild normals locally, with the authored breaks in view.** A UV seam can
remain smooth; a duplicated hard edge can remain sharp. NormalsXL groups
coincident positions only with compatible binding and visibility, and its
smoothing threshold controls which face contributions join. A global rebuild can
erase intended shading. Inspect the changed region under diagnostic lighting,
then with its actual diffuse texture; verify unchanged positions, faces, UVs and
bindings. Do not equate a smoothing angle with permission to subdivide. [G1, X1]

## MDLxL tools and common mistakes

Discover exact signatures with `mdlxl_capabilities` for `mesh` or `inspection`:
`ai-mesh`, `mesh-tools`, `classic-mesh`, `geoset-operations`,
`editor-commands`, `normals-rebuild`. `ai-mesh.mirrorSelection` duplicates
fully marked triangles; the ordinary Mirror command reflects in place.

Common mistakes are a position-only mass weld, a global normals pass for a local
shadow, binding a mirrored part to the wrong driver, counting hidden geometry as
visible detail, and shrinking an underlying surface to conceal a motion mismatch.

Automatable checks include stream alignment, index/primitive counts, conflicting
weld attributes, untouched-field comparison and sampled seam/edge distances.
They detect candidates; they cannot decide whether a split or a thin surface is
intentional.

## Sources

- **G1:** [NormalsXL mechanics and measured evidence](NORMALS-XL.md).
- **G2:** [Existing SD structural/visual study](AI-SD-REFERENCE-STUDY.md);
  [continued construction and UV research](https://github.com/UnsctMagic/MDLxL/pull/302).
  Measurements describe examples and sampled states, not universal budgets.
- **G3:** Current owners:
  [classic weld](../src/classic-mesh.js),
  [compatible weld](../src/mesh-tools.js),
  [duplicate mirror](../src/ai-mesh.js),
  [transforms](../src/editor-commands.js).
- **G4:** [MDL/MDX preservation boundary](MDL-MDX-COMPATIBILITY-FIXES.md).
- **G5:** [Geoset merge conflicts and operations](../src/geoset-operations.js).
- **H1:** [Hive: Wrap up Model with ingame Texture s](https://www.hiveworkshop.com/threads/wrap-up-model-with-ingame-texture-s.255041/),
  2014 practitioner explanation of duplicate-position UV seams and face-side selection.
- **X1:** [XGM: Useful modelling details](https://xgm.guru/p/wc3/useful-modelling-trivias),
  reALien's explanation of facing and why two-sided materials do not repair it.
