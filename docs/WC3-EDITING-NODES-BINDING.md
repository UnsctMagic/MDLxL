# WC3 editing: nodes, hierarchy and binding

Read this before binding, changing a pivot/parent, joining deforming surfaces,
adding a layered surface or transferring rigged parts. Pair with
[animation](WC3-EDITING-ANIMATION.md) for motion and
[game integration](WC3-EDITING-GAME-INTEGRATION.md) for attachments/collision.

## Understand which transform reaches the vertex

**Classic binding is an equal-weight matrix group.**
`VertexGroup[v]` indexes that geoset's `Groups`; the group contains node
ObjectIds, not indices into the Bones array. Each member contributes equally to
the transformed position. A two-bone group produces a half-and-half blend, not an
arbitrary weight slider. Do not repeat a bone to approximate a custom weight:
the study found no repeated members, and such a construction is not a supported
weight-authoring contract. Resolve every ID and compare sampled positions before
and after a binding change. [B1, B2]

**Weighted skin is a different representation.** Where `SkinWeights` is present,
MDLxL stores four bone IDs followed by four weights per vertex; authored
weights use 0..255. Current writers support wider bone IDs in version 1400+
without turning the weights into wider-range values. Preserve the actual stream,
type and influence values; do not replace it with an equal-weight classic group
because the model looks SD. Check resolved positive-weight influences and
saved/reopened arrays. [B1, B3]

**Do not confuse a group-table limit with bones per vertex.** Classic group
indices are bytes: at most 256 addressable groups per geoset. This is neither a
256-bone model limit nor a four-bone format limit for classic groups. The native
study contains larger classic groups; MDLxL's current Soft Bind operation refuses
to add a fifth influence. Preserve authored groups and treat that refusal as a
tool boundary, not permission to truncate them. Check group count/references
before topology or binding operations. [B2, B3]

## Bind the structural relationship

**A continuous deforming surface needs a transition, not a sudden driver swap.**
Adjacent regions usually retain a shared influence through blended vertex rings.
This follows from the equal-average transform and is strongly represented in
the measured native sample. Inspect edges whose endpoint groups share no bone,
then determine whether they cross a real deforming join or an intentional
independent part. Check edge length, silhouette and pinch/stretch at joint
extremes and intermediate poses. A disjoint edge is an inspection candidate,
not an automatic repair instruction. [B1, B2]

**Seam copies that continue the same surface must move together.** Coincident
vertices can retain different UVs or normals while sharing their skinning.
Compare their effective influences, including weights, across material/geoset
boundaries. Keep exceptions for separate parts and mutually exclusive surfaces.
Sample the seam through the relevant motion; matching rest positions alone
does not prevent a moving crack. [B1, B2]

**A layered surface intended to follow another must follow its deformation.**
Where a layer rests over a deforming region, establish correspondence to the
underlying surface and use compatible influences so relative motion does not
open a gap or cause sliding. Correspondence depends on the surface, its side and
motion; the nearest vertex may belong to a different overlapping part. A rigid
layer meant to articulate separately retains its own driver. Inspect relative
separation through bends, twists and crossings. The proximity study supports
investigation, not automatic nearest-neighbour rebinding. [B1, B2]

**A free chain needs its own motion and an attached root.** Retain the authored
run of keyed nodes for a flexible independent extension; blend its root into the
carrying region when that is how the connection deforms. Binding the whole chain
to its carrier removes its secondary motion, while assigning an entire layer
to an unrelated neighbouring driver creates separation. Inspect the root join
and progressive motion down the chain, including extreme and reversed poses.
[B2, B4]

**Inspect scale-collapse behavior before blending a new group.** Mixing a bone
whose world transform collapses to a point with a live bone is a known Warcraft
compatibility concern in MDLxL's diagnostic rules. A whole hidden part or a
one-axis flatten is not the same condition. Check own and inherited scale across
the relevant sequences; preserve intentional visibility mechanics and obtain an
in-game check for this case. The diagnostic is inspection-only: do not rebind
automatically to silence it. [B5]

## Preserve the hierarchy that owns the motion

**A helper can be the important animated joint.** Nodes with no directly skinned
vertices can drive many descendants. Inspect keys, parents and descendant
influences before deleting, reparenting or choosing a joint for a transfer.
Native rigs often use keyed helpers above skinned bones; this is an observed
construction, not a requirement to rebuild every skeleton that way.
Compare world-space pivots and descendant trajectories, not only node names.
[B1, B2, B4]

**Pivots, parents and inheritance flags change the result of existing keys.**
Rotation/scaling act around the pivot, with parent transforms and inheritance
flags contributing to the world transform. Moving a pivot or reparenting a node
can alter every sequence without changing a single key value. Preserve
ObjectIds, canonical `PivotPoints`, child references and bind-pose records unless
the requested edit requires them to change. Verify all affected descendants and
clips. `Nodes` and node `PivotPoint` are editor aliases; scope the canonical
collections changed by an API. [B1, B3, B6]

**Billboards are camera-dependent, not ordinary rigid joints.** Preserve
Billboarded, axis locks and CameraAnchored behavior when moving their nodes.
A correctly positioned pivot helps the attached surface turn around its intended
centre. Inspect actual captures from different camera directions; a numeric
sampler without camera-facing transforms cannot certify the billboard.
Do not remove the flag just because a fixed view looks unusual. [B4, B6]

## MDLxL tools and common mistakes

Discover `bone-tools`, `rig-node-order`, `movement`, `movement-selection`,
`pose-ik`, `animation` and `editor-document`. Read the operation before use:
Hard Bind replaces influences; Soft Bind adds one under its supported limit;
parenting is not vertex binding. `mdlxl_sample` measures posed geometry and
`mdlxl_capture` supplies the visual check.

Automatable checks include unresolved IDs, cycles, group-table overflow,
coincident-surface influence differences, disjoint edge groups and sampled
separation. Surface correspondence and intended independent motion need judgment.
Do not infer them from a bone name, a geoset number or a proximity percentage.

## Sources

- **B1:** [Hierarchy sampling and skinning](../src/animation.js).
- **B2:** 26 October binding study: 415 native unit models and a separate
  ten-model LowPolyWorks sample. [Research provenance and measurement limits](agent-tasks/wc3-editing-agent.md#evidence-and-limits).
  Measurements concern observed practice, not engine acceptance.
- **B3:** [Binding operations](../src/bone-tools.js),
  [modern skin preservation](MDL-MDX-COMPATIBILITY-FIXES.md);
  [independent GEOS reader](https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/parsers/mdlx/geoset.ts).
- **B4:** [POSE hierarchy recognition and unsupported domains](POSE_IK.md),
  [measured billboard/glow construction](GLOW_UP.md).
- **B5:** [Zero-scale skin blending boundary](OPTIMIZEXL_TEACHING.md).
- **B6:** [AI canonical-data contract](AI-HOOK.md),
  [node creation/deletion and reference mapping](../src/editor-document.js).
