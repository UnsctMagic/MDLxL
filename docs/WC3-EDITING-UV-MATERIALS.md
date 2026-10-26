# WC3 editing: UVs, materials and visibility

Read this for wrapping, texture changes, tint, transparency, team colour or
geoset visibility. Pair it with [geometry](WC3-EDITING-GEOMETRY.md) when splitting
vertices and [animation](WC3-EDITING-ANIMATION.md) when editing tracks.

## Follow the material actually used

**Trace the complete reference chain at the relevant time.** A geoset's
`MaterialID` chooses a material; each ordered layer chooses a `TextureID`,
`CoordId` UV set and optional `TVertexAnimId`. Texture IDs and layer alpha can
be animated. Inspect every used layer at the failing frame before changing a
texture or UV set. A valid path on an unused texture or a correct wrap in the
wrong UV set will not change the visible result. Check that the edited references
still resolve after saving. [U1, U2]

**Choose paint by the pixels under the island.** Native sheets can serve a new
purpose when their painted material, light direction, colour and alpha suit the
surface. A filename is only a search aid. Preview the actual image and relevant
islands, then the composed model material: geoset tint and team colour can make
the final colour very different from the source RGB. Compare the mapping at the
intended size and from an oblique view before stretching a small region over a
large surface. Preserve useful authored reuse and mirroring. [U3]

**Keep mapping discontinuities without tearing the mesh.** A UV seam needs
independent vertex copies at a shared position. Use face-side selection or the
UV uncoupling operation when one side must move independently; preserve its
position, normal, binding and other UV sets. Check the seam in textured poses.
An island flipped by design is not automatically a folded chart, and UVs outside
0..1 can intentionally tile: check the texture's wrap flags before clamping.
[H1, U1]

**Projection is a starting mapping, not proof of a good wrap.** A flat projection
can collapse edge-on faces or fold a surface that curves around itself. Inspect
triangle areas in UV space, direction changes and landmark placement over the
actual sheet; rotate the model to see the reverse side. Preserve deliberate
constant-colour sampling or overlapping islands rather than treating every
overlap or small UV triangle as damage. [U1, U3]

## Keep the material's rendering job

The classic material modes below use **material-layer** enum values. Particle
Emitter 2 uses a different enum; do not copy these numbers into it. [U4]

| Material value / MDL name | Rendering job | Check after changing it |
| --- | --- | --- |
| 0 / None | Opaque surface; texture alpha is not an ordinary cutout | Intended holes and opaque interior |
| 1 / Transparent | Alpha test, with a cutout rather than a smooth fade | Fine edges at small scale; compare the target game's cutoff |
| 2 / Blend | Source-alpha blending; MDLxL labels it Alpha | Semi-transparent overlap and viewing-angle changes |
| 3 / Additive | Adds light; MDLxL labels it Add | Bright/dark backgrounds; black RGB contributes no light |
| 4 / AddAlpha | Alpha-modulated added light | Texture and layer alpha both affect the result |
| 5 / Modulate | Multiplies the background colour | Darkening against real terrain |
| 6 / Modulate2x | Twice the multiplicative contribution | Contrast and overbright areas |

**Preserve layer order and shading/depth flags.** They determine how the image
is built, lit and occluded. Additive is not interchangeable with Blend:
MDLxL's compositor scales Additive RGB by layer opacity without using texture
alpha as a mask; AddAlpha uses that mask. An unshaded surface ignores scene
lighting, and disabling depth behavior can make an overlay appear through other
geometry. Inspect overlap from several angles and on contrasting backgrounds.
Do not flatten an authored stack just to obtain a simpler material. [U4]

**Team colour is a replaceable texture plus a material arrangement.**
`ReplaceableId: 1` requests team colour; `2` requests team glow. An alpha channel
by itself does not establish either. MDLxL's Team Color preset places a None
team-colour layer before the base image's Blend layer, allowing that image's alpha
to reveal the player colour. Preserve the actual stack when editing an existing
model. Test at least two contrasting team colours and verify which parts change;
a fixed team-colour image path is not the same as a replaceable texture. [U4]

## Diagnose visibility and colour at their owners

**Geoset animation is separate from material animation.** Find
`model.GeosetAnims` by `GeosetId`, not by array position.
`Geosets[i].Anims` contains sequence extents, not visibility or tint.
A missing geoset-animation record is not inherently broken.
Tint uses its enable flag as well as `Color`; dormant data must survive.
Inspect geoset alpha and every layer's alpha, filter, sampled texture and texture
alpha at the same local/global time. Raising only one alpha may leave the surface
hidden. Editor checkboxes are another, unsaved visibility layer. [U2, H2]

**Local visibility edits must remain local.** Preserve other sequences and global
tracks, including fades and constant zero values. When making a new local track,
give the other intended states their retained values rather than allowing an
unintended default. A continuous surface's material splits should hide together
when that is its authored behavior; alternate or independently moving surfaces
need not. Check starts, switching times and ends for every affected state.
[U2, U5]

**Preserve texture identity and dependency coverage.** Native paths, replaceable
IDs, wrap flags and supplied external files have different roles. Do not replace
a native path with a machine-local absolute path, or assume the local library's
successful lookup proves map imports are complete. Inspect animated texture IDs
as well as static bases. Generated assets must use the exact relative name
written into the model. Validate through the normal serializer and test imports
in the target game when packaging is part of the request. [U1, U5]

## MDLxL tools and common mistakes

Use `mdlxl_assets` sources `model`, `textures` or `game` to inspect actual
assets. Discover `uv-tools`, `uv-selection`, `uv-preview`,
`material-presets`, `texture-references`, `animation-tracks` and
`geoset-animation-defaults` with `mdlxl_capabilities`.
`applyMaterialPreset` can replace a generated stack: inspect its behavior before
using it on authored layers. Citadel Paint has a separate working copy; use its
controls and normal apply/exit path before model scripts.

Common mistakes: welding away a UV seam, flipping already mirrored UVs again,
changing unused texture entries, setting every alpha to 1, confusing team glow
with team colour, and accepting a missing-texture placeholder as a correct wrap.

Reference validity, UV/stream preservation, local-track boundaries and sampled
alpha values are automatable. Paint suitability, bleeding at small scale and
translucent sorting still require rendered inspection.

## Sources

- **U1:** [UV tools](../src/uv-tools.js), [texture references](../src/texture-references.js),
  [UV-set preservation](../src/uv-coordinate-codec.js).
- **U2:** [Geoset animation schema and save behavior](GEOSET-ANIMATION-SAVE.md),
  [track editing](../src/animation-tracks.js).
- **U3:** [Existing SD study](AI-SD-REFERENCE-STUDY.md) and
  [PR #302's measured texture-region/reuse study](https://github.com/UnsctMagic/MDLxL/pull/302).
- **U4:** [Material presets](../src/material-presets.js),
  [reference compositor](../src/uv-material-compositor.js).
- **U5:** [AI tool/save contract](AI-HOOK.md),
  [compatibility boundaries](MDL-MDX-COMPATIBILITY-FIXES.md).
- **H1:** [Hive: Wrap up Model with ingame Texture s](https://www.hiveworkshop.com/threads/wrap-up-model-with-ingame-texture-s.255041/),
  seam selection and projection.
- **H2:** [Hive: Normal map and Geoset Visibility](https://www.hiveworkshop.com/threads/problems-normal-map-looks-glossy-and-geoset-visibility.350666/),
  Retera's explanation of layer alpha as a separate visibility source.
