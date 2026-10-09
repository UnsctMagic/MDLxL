# POSE implementation and verification

Original base: online `main` at `1e1d4c93398cdca7b8d74c73cbabbcd6fb28150a` (0.21.2).
Current-main integration: `a73f104824e02a976894151e50c671a33b46234d`.
Sources merged cleanly; generated bundle conflicts were resolved by rebuilding
from source. Main's paste/geoset changes were retained without source edits.
Feature branch: `codex/pose-ik`, PR #148. Dependencies and release version are
unchanged. This is an unshipped test candidate, not an installed upgrade.

## User workflow corrections

The user's recordings exposed a real Setup crash: validating a chain inside a
deferred React state updater escaped the event's catch and reached the global
error boundary. Validation now happens synchronously before installing the
draft. Invalid suggestions clear the draft and display a local explanation.

First-use POSE recognizes named hands/feet through their actual hierarchy and
sampled transforms, then suggests the shared body ancestor and major body nodes.
Invalid candidates are isolated. Footman's native hand reference supplies its
missing wrist endpoint. Setup stays open when using the Object picker or view;
custom three-joint mapping remains available in a collapsed section.

Direct controls reuse ordinary Movement Move/Rotate/Scale for every native node.
Body/chest/pelvis/head controls retain real-node identity, while a labeled handle
can be added for any other node. Repeated clicks cycle through all visible
handles and real markers covering the pointer through the existing Movement
picker, including while a transform tool is active. Dragging retains the grabbed
object. A native marker and its virtual control retain separate selection
identities; a marker selection receives its real-node transform gizmo without
drawing an extra virtual symbol. Named labels select their control directly.
Overlapping labels are placed near their pivots on separate rows; a visible
axis tip controls the selected object even if another marker lies beneath it.
Hand, boot, helmet, chest plate, Trollface pelvis and whole-body symbols have dark
backings over bone markers. Controller and Restrictions start minimized through
their existing headers. Rotate on Own Axis is removed from Movement. The
existing sidebar width, other section defaults and camera controls remain unchanged.

Pins can hold hands and feet. Moving any ancestor compensates its affected,
disjoint pinned limbs together. Translation stops at the first inner/outer
reach boundary. Rotate/Scale follow the native transform and locate the first
reach boundary by sampled bracketing and bisection. The sampled native pose is
verified before any write. A failed intermediate preview retains the last
valid preview instead of resetting the gesture. No stretching or rig repair is
used to satisfy an IK target; deliberate Scale still scales the native model.

## Ownership and authored data

- `src/pose-ik.js` uses analytical two-link geometry, the existing effective
  parent API, and forward sampling to verify positions and world orientations.
  Direct transforms run the existing Movement owner on detached tracks.
- `src/movement.js` prepares every Translation/Rotation/Scaling channel before
  installation. It preserves interpolation, interval ownership, unrelated/gap
  keys and neighbor tangents. Replaced cubic handles follow existing Movement
  translation, quaternion and scaling conventions. Globals/shared timestamps
  reject atomically; no imported library is changed.
- The renderer previews on its private clone. `EditorDocument.apply` receives
  one complete native edit on release. Escape consumes the active gesture
  before selection clearing; cancellation does not create an extra Undo step.
- Mappings, pins, handles and bend memory are model-session state. No virtual
  ObjectIds, serialized constraints, model chunks, skin changes or idle solver
  are added. Timeline display scope shows affected native channels; key
  mutation remains owned by explicitly selected real objects/channels.

## Immutable fixtures

| Fixture | Pose and controls | SHA-256 |
|---|---|---|
| `test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx` | Stand, index 1 / 2000 ms; arm 23 → 37 → 46 | `bced442553d8b6fb3c8801f7ba096dbc9a8a0055435b59c67316badcef2edabd` |
| `out/pose/Footman.mdx` | Stand - 1, index 0 / 500 ms; arms 36 → 37 → 38 and 34 → 35 → 42; legs 27 → 28 → 29 and 30 → 31 → 32; Body 25, Pelvis 26, Chest 33, Head 39 | `fa74ae722b151a1cf5e297bebe17d5a734fb89225823e37e29a588ecaf527812` |

Footman and its exact textures were copied byte for byte from the local Warcraft
CASC resources. No original resource was edited and no game asset is committed.
Footman texture hashes are recorded in the packaged result. Knight's unchanged
source already fails MDL conversion for a Helper flag; that baseline limitation
is asserted. Knight MDX and both Footman formats have preservation coverage.

## Packaged mouse acceptance

Candidate: `out/pose-v3-main-package/MDLxL-win32-x64/MDLxL.exe`, Electron 40.8.0,
built `dist`, separate disposable `MDLXL_PROFILE` per run. Tests use actual
Playwright mouse drags and UI commands in an off-screen packaged window.
The user's earlier open test applications and personal profiles are untouched.

`test/pose-ik.electron.cjs` exercises a continuous flow:

- The exact first-use invalid root selection from the recording produces a
  local Setup message, no Reload editor, and no native keys/history. One POSE
  click recognizes both hands/feet and the whole-body root. Body/chest/pelvis
  labels are independently clickable. Object selection keeps Setup open.
- Controller/Restrictions are initially minimized, their existing headers open
  and close normally, and the removed Own Axis checkbox is absent. Actual clicks
  cycle through overlapping real bones and virtual controls in Select and Move,
  wrap without repeating objects, and create no native edit or history step.
  Symbol visibility is captured with the native bone overlay enabled.
- Hand Move/Turn/Bend, leg Move, ordinary chest Rotate/Scale, no-op clicks and
  returning to the grip, and FK/IK transitions preserve the current pose.
- One/two planted feet, body Move/Rotate/Scale, all four limbs pinned together,
  chest Move with pinned hands, head Move/Rotate/Scale, and an arbitrary native
  attachment handle. Oversized body dragging retains the reachable movement
  and all pin positions; it commits one Undo action instead of rolling back.
- Previews leave canonical model/history/dirty state unchanged. Release is one
  complete action. Undo/Redo, Escape, pointercancel, lost capture, blur,
  frame/sequence/tool/target/revision changes, teardown and false/throwing
  commit rejection restore preview and camera input.
- Actual axis tips, workplanes, edge-on views, Shift, restrictions, Alt+mouse
  camera rotation, mouse-wheel zoom, textured rendering and sidebar width.
- Packaged MDL/MDX save, actual tab close/reopen, native semantic equivalence,
  fresh session controls, and unchanged Bones rest matrices.

Live native matrices are compared with camera-aware marker sampling during
previews, including unrelated billboards. Effective skinned controls must move
the native mesh; direct reference controls must move their actual native matrix.
Acceptance tolerances are 0.004 model units for matrix/pin position comparisons
and 0.000001 for orientation dot error. The solver verifies tighter scale-aware
bounds before commit. Exact measurements, executable/index/aggregate asset
hashes and immutable texture hashes are in `out/pose-v3-main-ui/result.json`.

Preservation checks compare all semantics outside explicitly permitted native
transform channels, untouched animation/gap keys inside those channels, and
original model/texture hashes. Untouched MDX chunks outside BONE/HELP/ATCH remain
byte-identical. Vertices, normals, UVs, topology, pivots, hierarchy, skin/bind
data, resources, material/texture paths, visibility/RGB and other animations
including Portrait remain unchanged. Edited complete files necessarily differ.

Local evidence: `out/pose-v3-main-ui/result.json`, screenshots `01-default.png`
through `09-controller-symbols.png`, and `posed.mdx` / `posed.mdl`.
The same flow also passed before current-main integration in `out/pose-v3-ui`.
The visible manual test uses that retained `out/pose-v3-package` build and a fresh
`out/pose-v3-manual/Footman_POSE_Test_3.mdx` copy. Its running profile is separate
from disposable acceptance profiles and is not replaced during integration.

Pelvis icon follow-up: `out/pose-v4-package/MDLxL-win32-x64/MDLxL.exe` uses
the user's selected black-and-white Trollface reference, prepared with the built-in
image tool and stored as `app/pose-trollface.png` (96 x 96, 15,070 bytes).
The selected symbol draws above overlapping controls. Packaged evidence in
`out/pose-trollface/result.json`, `pelvis-in-editor.png` and `pelvis-closeup.png`
confirms the actual image draw, unchanged Pelvis label/native node 26 selection,
unchanged model data, normal Alt+mouse camera rotation and no page errors.
This rendering-only follow-up uses the existing full regression results below;
the full solver/source suites were not repeated for the icon change.

Color follow-up: `out/pose-v5-package/MDLxL-win32-x64/MDLxL.exe` tints the
unchanged Trollface asset with the existing handle color, using cached canvas
multiply/mask compositing. Normal cyan and selected yellow pixel samples,
transparent surroundings, unchanged native node/model selection and actual
Alt+mouse rotation passed in `out/pose-trollface-color/result.json`; its screenshots
show the selected icon above overlapping handles. No page errors occurred.
The full solver/source suites were not repeated for this color-only change.

## Checks and limits

- Focused POSE/selection-history/Movement/marker checks: 79 passed, including immutable Knight,
  local native Footman, reach boundaries, all direct tools, pinned ancestors,
  cubic native handles, shared marker/handle cycling, native-marker transform
  selection and overlapping-label selection. The component check confirms the
  removed checkbox, minimized defaults and unchanged other section defaults;
  its two unrelated failures match the existing clean-main baseline.
- Compatibility suite: 57 passed.
- Current-main source regression run: 1422 tests, 1399 passed, 21 failed, 2
  skipped. No new failure identities relative to the original clean-main
  baseline: 20 existing assertions and the existing synchronous keyframe-timeline
  worker hang remain. Main's accepted HD anchor changes replace the former
  failing capacity/bind-pose test with two passing repair/preservation tests.
  All other workers completed; only the verified task-owned hanging worker was
  stopped. Before integration: 1391 tests, 1367 passed, 22 failed, 2 skipped,
  exactly matching the original baseline failure identities.
- Production build and runtime/license/package checks passed. The packaged
  acceptance above passed without page errors; final measurements are retained
  in its result file.

Source outputs: `baseline-source.log`, `out/pose-v3-main-source.log` and
`out/pose-v3-main-regression-comparison.json`; the original v3 comparison is
retained in `out/pose-v3-regression-comparison.json`. Existing codec/version/binding/UI
failures were not edited to make POSE look green.

IK remains limited to rigid two-link ancestry with positive uniform scale and
editable local tracks. Invalid/global/shared tracks reject locally. Direct
controls retain ordinary Movement behavior. No balancing, physics, contact
baking or automatic animation generation is supplied. Warcraft III gameplay
and Retera interoperability were not exercised. Merge and release remain
unauthorized; the candidate and evidence are retained for manual testing.
