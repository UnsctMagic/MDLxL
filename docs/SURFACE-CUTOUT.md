# Low-poly surface cutout

The UV Wrapper's **Low-poly cutout** button opens a dismissible tool over the
existing texture canvas. The normal workspace and sidebar widths are retained.

Select the intended source before opening UV Wrapper. Choose its material, click
the intended visible face in the live model preview, then outline the detail
with Lasso, Polygon or Ellipse. Polygon closes on its first point or Enter;
Backspace removes a pending corner. Escape and Cancel discard the draft.
Camera rotation, pan and zoom keep their normal mouse controls.

The preview contains a real source hole and a separate piece in its original
position. **Remaining surface only**, **Cutout only**, wireframe and the temporary
contrasting color inspect that partition without editing the document.
**Cut & Separate** commits one undo step and selects the appended geoset.

## Scope and polygon cost

Picking a face resolves a local surface sheet independently of Grabthrough.
Overlapping UV coverage requires an explicit surface pick. **Add picked surface**
reviews additional instances; sharing a texture never authorizes them.
The UV canvas retains original face provenance as well as vertex provenance.

Auto tests a bounded set of simplified contours in native texture pixels and
chooses the lowest combined triangle increase, then the fewest new stored vertex
records. The two-sided distance check bounds the removed arcs and replacement
chords. This is the lowest tested cost within tolerance, not a global optimum.
Corners sets a complexity budget; an insufficient budget produces an explanation.
Polygon and Ellipse retain their reviewed corners. A lasso needs the actual
texture dimensions; the tool does not guess texel dimensions for a missing image.

An octagon wholly inside one original triangle has eight piece vertices and six
piece faces. The matching surround needs eleven faces, so the entire edit adds
sixteen triangles. There is no generated center/support vertex. Crossed original
edges can require more vertices and local conformity splits. Protected neighbors
block a required split rather than leaving a T-junction.

Faces whose UVs collapse to a point or line cannot be lifted. One that lies in
or touches the outline blocks the cut; one clear of the outline, even inside its
bounding box, stays untouched in the source.

## Rig and appearance policy

Strict mode inserts a vertex only when its participating source corners have the
same effective classic binding. Bone multiplicity matters; raw groups are never
unioned, sorted or deduplicated. Existing vertex records retain their bindings.

**Approximate existing rig** is an explicit alternative. It chooses an existing
binding with the largest accumulated barycentric contribution and measures the
new point against the original rendered triangle over the reported schedule,
including sequence endpoints, intermediate samples, transform keys and global
sequence samples. The maximum measured deviation is shown and Apply requires a
separate acceptance checkbox. This is sampled evidence, not a continuous motion
guarantee. No bones, pivots, hierarchy or authored animation keys are added.

All UV sets and supported vertex streams keep their array types. New normals are
linearly interpolated without a global normal rebuild; authored seam records stay
distinct. Tangent handedness must agree. Appearance mode clones RGB and alpha
records independently, including stored MDX defaults and tracks. **Keep extracted
piece untinted** changes only the new RGB behavior. Visibility/death alpha remains.
Applicable Gliders and exclusive bone GeosetId references follow existing detach
conventions. Bind bounds, primitive counts and Info counts are updated; authored
animated bounds remain, with sampled-deviation padding for approximate edits.

## Owners and validation

- [surface-cutout.js](../src/surface-cutout.js): immutable planning, local boolean
  adapter, authoritative intersection records, attribute lifting, coverage and
  conformity checks, guarded preview/apply.
- [useSurfaceCutout.js](../app/useSurfaceCutout.js),
  [SurfaceCutoutControls.jsx](../app/SurfaceCutoutControls.jsx),
  [UVWorkspace.jsx](../app/UVWorkspace.jsx) and [UVEditor.jsx](../app/UVEditor.jsx):
  scope capture, vector gestures and linked drafts.
- [preview-selection.js](../app/preview-selection.js): visible original face IDs;
  no screen barycentrics are used to lift a cut.
- [App.jsx](../app/App.jsx): one synchronous EditorDocument transaction using the
  normal history, selection and save paths.

The plan guard compares the complete model and the validated plan payload before
preview/apply. Document/revision, source selection, material and UV domain changes
invalidate pending UI work. Geometry is planned before entering the transaction.
Unrelated geosets and original vertex records are retained; no global remeshing,
position welding or texture rewriting occurs.

Source checks: node --test test/surface-cutout.test.js. The optional local
MDLXL_CUTOUT_FIXTURE_DIR points to the immutable private handoff fixture folder;
its assets are not committed or packaged. Public tests use deterministic geometry.
Mouse checks: pnpm run test:packaged default surface-cutout; see
[packaged tests](PACKAGED-TESTS.md). The same harness accepts the private fixture
environment variable and MDLXL_TEST_GAME_DATA for local textured checks.

The initial tool supports classic MDX800, one simple UV loop, selected surface
instances and reviewed rig approximation. HD skinning, multi-loop/hole input,
geometric mirroring, direct model lasso and texture edge fitting are outside this
implementation. Existing geometric creases and piecewise UV gradients are kept;
coplanar triangles are not merged. Warcraft III gameplay and a pixel-level
lighting equivalence check are separate acceptance gaps.
