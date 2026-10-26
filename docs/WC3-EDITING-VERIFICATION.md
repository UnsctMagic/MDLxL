# WC3 editing: prove the requested edit

Use this before finishing any model edit. Verification has three distinct
questions: did the requested change occur, did protected data survive, and did
the result behave correctly in the environment actually tested? A clean parser
answers only part of them. [V1, V2]

## Establish a comparison that can expose a mistake

**Record the original state before editing.** Keep the captured target,
selection, relevant fields, sequence/time and camera. Identify the requested
change and protected collections or animation ranges separately. Use the same
resolved textures, team colour, camera and time for before/after images:
different presentation can conceal a deformation or fabricate an improvement.
Inspect the actual images rather than treating an image-returning tool as a
visual pass. [V1]

**Match IDs to what the user sees.** Tool/model indices are zero-based; MDLxL's
displayed geoset labels are one-based. Report both when useful, and refresh any
mapping after a structural operation. A correct edit on the wrong geoset fails
the request. Inspect the target's selection before mutation, and do not replace
a stale target silently. [V1]

**Make checks specific enough to fail.** For a position edit, measure the intended
displacement and compare protected coordinates/UVs/bindings. For a local
animation edit, compare exterior keys, interpolation, global association and
unrequested tracks. For a material edit, compare all untouched layers, referenced
textures and unrelated effect tracks. Counts alone do not establish preserved
content, and nonempty geometry is not evidence of the requested shape. [V1, V2]

## Use the right kind of evidence

| Edit | Measure | Inspect |
| --- | --- | --- |
| Shape/topology | Vertex/face/stream validity, protected fields, bounds, intended dimensions | Textured game-scale silhouette, wireframe and reverse/oblique views |
| UV/material | Actual layer/texture/UV references, preserved seam attributes, sampled alpha | Resolved paint, joins, small-scale edges, two team colours and transparency overlap |
| Binding/hierarchy | Effective influences, descendant transforms, seam separation and edge stretch | Bends/twists, layered-surface clearance and independent-part motion |
| Animation | Exact domains, exterior keys/controls, contacts and trajectory extrema | Between-key motion, loop wrap, anticipation/contact/recovery |
| Effects/events | Resource IDs, emission/age units, clock and trigger alignment | Replayed history, residual particles/trails; actual game events |
| Game integration | Format/dependency round trip, affected extent tables and camera data | Target-game selection, culling, lifecycle, portrait and attachments |

These are applications of the owners and measurements in the corresponding
[geometry](WC3-EDITING-GEOMETRY.md), [UV/material](WC3-EDITING-UV-MATERIALS.md),
[binding](WC3-EDITING-NODES-BINDING.md), [animation](WC3-EDITING-ANIMATION.md),
[effect](WC3-EDITING-EMITTERS.md) and
[game](WC3-EDITING-GAME-INTEGRATION.md) sections, not new universal thresholds.

**Sample where the failure could occur.** Include sequence endpoints, relevant
keys, intermediate times, extrema and just before/after the suspected transition.
For loops, sample both sides of the wrap. For layered surfaces, inspect the poses
with the most relative rotation. Refine around a detected discontinuity instead
of merely adding many evenly spaced samples. A finite sample set does not prove
every possible cubic extremum or global-clock combination. [V3, V4]

**Know the numeric sampler's limits.** `mdlxl_sample` evaluates CPU hierarchy
and skinning and reports camera-dependent nodes. It does not evaluate texture
appearance, particle history or billboard orientation for a camera. Its bounds
describe the requested geoset geometry, not a fully evaluated visible scene.
Use actual viewport captures for those domains. If a model's unsupported
transforms or renderer behavior make numeric and visual results disagree,
report the discrepancy rather than choosing the convenient answer. [V3]

**Reopen what was serialized.** Use `mdlxl_document validate` and the normal
save/export path, retaining the source. Compare semantically at file float32
precision where appropriate; integer IDs, flags, paths, key times and reference
mapping need exact preservation. The normal serializer may remap node IDs in an
export snapshot, so compare through its documented mapping rather than declaring
every changed numeric ID a changed rig. Do not bypass a loss report by deleting
the reported field. [V1, V2, V4]

**Separate diagnostics from correction authority.** An invalid reference is
different from a suspicious key, unused record or recommended range. Read the
finding and its supported domain. Keep intentional variants, helpers, holds and
effects unless the requested work includes changing them. A diagnostic can
nominate a case for inspection; it cannot establish the user's artistic intent.
Historical checker warnings include empirical guesses and have changed as new
counterexamples appeared. [V4, H1]

## Finish through the existing review

**Use the actual review baseline.** After the final edit, call
`mdlxl_review inspect` with read-only `checksCode` comparing `model` with
`before`, the operation's original model. Return named Boolean checks with
measured actual/expected values where useful. Animation changes need sampled
intermediate poses and captures. Inspect the returned before/after images and
correct a failed result within the authorized scope; another edit requires a
new review. Finish with the truthful outcome and a short visual assessment.
Do not mark an unavailable or failed visual check as passed. [V1]

**Verify reversibility at the relevant boundary.** Related scripted changes
commit in one ordinary Undo step. When a workflow test is requested, check Undo
and Redo restore the relevant geometry, resources and tracks. Do not save over
a supplied original merely to test serialization; exporting and saving the
working document are different operations. Pending live drafts also have an
apply boundary, so verify the committed model rather than assuming a dialog's
preview was applied. [V1]

**Report the strongest claim the evidence supports.** Say what changed, what
was preserved, which views/times and file formats were checked, and which target
game behaviors were exercised. For model integration, an editor render plus a
round trip means ready for game testing, not Warcraft acceptance.
Missing textures or unsupported effects remain explicit gaps. Owner artistic
acceptance and a real game test cannot be replaced by a tool returning success.
[V1, V2, V4]

## MDLxL tools and follow-up checks

Use `mdlxl_context`, `mdlxl_read`, `mdlxl_sample`, `mdlxl_capture`,
`mdlxl_document` and `mdlxl_review`; discover `animation`,
`normals-rebuild`, `motion-inspector` and `optimizexl` only for checks
relevant to the request. Capability discovery provides current signatures.

Possible automated follow-ups include seam-influence comparison, disjoint-edge
candidates, sampled layer clearance, all-stream preservation and dependency
coverage. This handbook describes how to interpret them; it does not claim that
a new automatic checker or repair has been implemented.

## Sources

- **V1:** [AI tool, edit, review and save contract](AI-HOOK.md),
  [tool definitions](../src/ai-tools.js),
  [review implementation](../app/ai-review.js).
- **V2:** [Serialization preservation and limits](MDL-MDX-COMPATIBILITY-FIXES.md).
- **V3:** [Numeric AI sampler](../src/ai-sampling.js),
  [hierarchy/skin evaluator](../src/animation.js).
- **V4:** [Motion warning boundaries](MOTION-INSPECTOR.md),
  [OptimizeXL teaching and verification agreement](OPTIMIZEXL_TEACHING.md).
- **H1:** [Hive: Mdx sanity tester](https://www.hiveworkshop.com/threads/mdx-sanity-tester.290476/),
  GhostWolf's distinction between observed failures, warnings and revised
  heuristics. Treat dated observations as evidence to test, not universal caps.
