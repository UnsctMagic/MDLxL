# POSE implementation and verification

Base: online `main` at `1e1d4c93398cdca7b8d74c73cbabbcd6fb28150a` (0.21.2).
Feature branch: `codex/pose-ik`. Dependencies and release version are unchanged.
This is an unshipped PR candidate, not an installed upgrade or release.

## Ownership and preservation

- `src/pose-ik.js` solves analytical two-link geometry, converts each joint
  through the existing effective-parent API, reevaluates root/middle/endpoint
  in order, and verifies the actual forward-sampled result. It rejects
  unsupported transforms/hierarchies before writing.
- `src/movement.js` prepares every exact native quaternion/translation track
  before installing any. It preserves controller ownership, interpolation,
  other intervals/gap keys and neighbor tangents; keyless intervals use existing
  Movement boundary seeding. Quaternion tangents at a replaced key follow the
  existing squad convention. Overlapping timestamps/global mutation reject.
- The renderer-owned clone supplies temporary poses. `App` commits once through
  `EditorDocument.apply`. Virtual selection rebases real-node selection without
  adding an undo entry; ordinary selection history retains its behavior.
- Setup, mappings, pins and bend memory are model-session state. No virtual
  ObjectIds, serialized constraints, model chunks or idle solver are added.
- Timeline display scope uses the native affected channels. Mutation scope
  remains the explicitly selected real object/channel.

The bundled `war3-model` renderer ignores non-default inheritance flags. Although
the source evaluator can calculate them, this delivery rejects such POSE ancestry
with a specific explanation so handles cannot disagree with the visible mesh.
Imported libraries and the ordinary renderer are unchanged.

## Immutable fixtures

| Fixture | Sequence/frame | Joint IDs | SHA-256 |
|---|---|---|---|
| `test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx` | Stand, index 1 / 2000 ms | arm 23 → 37 → 46 | `bced442553d8b6fb3c8801f7ba096dbc9a8a0055435b59c67316badcef2edabd` |
| `out/pose/Footman.mdx` | Stand - 1, index 0 / 500 ms | arm 36 → 37 → 38; legs 27 → 28 → 29 and 30 → 31 → 32; body 26; FK chest 33 | `fa74ae722b151a1cf5e297bebe17d5a734fb89225823e37e29a588ecaf527812` |

Footman is an SD rig in an editable version-1800 native container, copied byte
for byte from the local `D:\Warcraft III` CASC resource
`war3.w3mod:units/human/Footman/Footman.mdx`. No original game/model file was
edited. Its two exact local textures were used; no substitute texture or remote
download was used. Game assets are not committed to the repository.

| Original resource | SHA-256 |
|---|---|
| `Textures/Footman.blp` | `c7f80b5fad1744eafc3333e12bfe0a4b3df0cf5dce2ef89c29254599f1d4e1f6` |
| `Textures/gutz.blp` | `fef246224e84659724f8f74d1f521d609edcd36cdb8fd7e11788eaa5eed9afc0` |

Knight's reachable endpoint error was about 0.000092 model units and segment
length error below 0.000007. Its unchanged source already fails MDL conversion
for a Helper flag; that baseline limitation is asserted explicitly. Knight MDX
and both Footman formats are covered by round-trip preservation checks.

## Packaged acceptance

Disposable candidate:
`out/pose-package/MDLxL-win32-x64/MDLxL.exe`, Electron 40.8.0, built `dist`, and
a distinct `MDLXL_PROFILE` for every test run. Tests use actual Playwright mouse
drags and keyboard/UI commands in an off-screen packaged window. They do not
stop the user's app or replace an installation/profile.

Executable SHA-256:
`a358a53e764849ab4b4b50c56f6fa9003f73542b6bcd283643adf77187e5c670`.
Bundled `dist/index.html` SHA-256:
`96f9c02fd088646f2af5739d9f0cfb444e4be4a22c0410f5da7ef7ab4dda9a81`.
Aggregate assets SHA-256 (sorted filename bytes followed by file bytes):
`19c4fcf54f216d5316c679080aad4a6fee2a109e21f564febc97146f36478e30`.

`test/pose-ik.electron.cjs` exercises one continuous packaged flow:

- Compact default UI; setup and handle selection without native edits/history.
- Hand mouse preview with canonical model, history and dirty state unchanged;
  one native multi-track commit on release. Clicking or dragging away and back
  to the grip creates no key/history step, including rounded authored quaternions.
- IK → ordinary chest Rotate with POSE visible → ordinary mouse Scale with a
  uniform scaled ancestor → exact Scale Undo → IK without a snap/transition key.
- Endpoint Turn, Bend, leg Move, one pinned foot, two pins, and ordinary FK leg
  editing with pins visible; the next body gesture samples the resulting feet.
- Body Translation plus both legs' compensation in one Undo/Redo action.
  Unreachable requests reject completely without sliding/stretching/partial keys.
  Explicit pin release/re-pin changes session state only. Setup explains a
  nonuniform ancestor introduced by ordinary bone editing.
- Escape, pointercancel, lost capture, blur, frame/sequence/tool/target/revision
  changes, teardown, and false/throwing commit rejection restore all preview
  tracks and camera input.
- Actual axis-gizmo dragging, XY/ZX/YZ, edge-on projections, Shift constraints,
  Translation/Rotation restrictions, Alt+mouse camera rotation, and wheel zoom.
- Wireframe/textured animated previews and unchanged sidebar width. Scrubbing,
  sequence changes and toggling controls create no native keys.
- Packaged MDL/MDX saves, actual tab close/file reopen, semantic equivalence to
  the committed pose, and fresh session-only setup.
- Bones retains unanimated rest matrices in wireframe/textured views.

During previews the camera-aware sampler is compared with the live native
renderer's matrices, including Footman's unrelated billboards. Maximum observed
matrix-component discrepancy is about 0.000028. Effective gestures also deform
the skinned preview mesh.

Pinned-foot position errors are below 0.000001 model units, orientation dot errors
at floating-point roundoff, and segment-length errors below 0.00000002. Assertions
use 0.004 units / 0.000001 orientation dot error for the packaged acceptance;
the solver performs tighter scale-aware checks before committing.

Preservation checks compare all semantics outside permitted native channels,
all untouched animation/gap keys within those channels, unchanged MDX chunks
outside BONE/HELP, and original model/texture hashes. Edited whole files are
expected to differ. Vertices, normals, UVs, faces, geosets, pivots, hierarchy,
skin/bind data, materials, texture paths, visibility/RGB, resources and unrelated
animations including Portrait remain unchanged.

Local evidence is in `out/pose-ui/result.json`, `01-default.png`, `02-hand.png`,
`03-turn-bend.png`, `04-two-pins.png`, `05-dismissed-camera.png`,
`06-textured-preview-restored.png`, `07-bones-rest.png`, `posed.mdx` and `posed.mdl`.

## Verification results and limits

- Focused POSE plus selection-history tests: 33 passed, including real Knight
  and local native Footman cases. Without the optional local Footman fixture,
  that one fixture test skips; synthetic codec/history cases still run.
- Required compatibility suite: 57 passed.
- Required final source suite: 1382 tests, 1358 passed, 22 failed, 2 skipped.
  Failure identities exactly match the clean-main baseline: 21 existing
  assertion failures plus the existing synchronous keyframe-timeline worker
  hang. Only that task-created worker was stopped after all other workers
  completed; no user's process was stopped. No new source failure appeared.
- A preliminary 60-second worker bound cancelled the unrelated complex GIF
  case. It passed alone in 63 seconds, and the final suite ran without that
  bound. It is not counted as a POSE regression.
- Production build and package runtime/license validation passed.
- Packaged continuous acceptance described above passed without page errors.

The clean-main failures concern existing codec/version/binding/translation/UI
expectations and timeline behavior. Their complete outputs remain in the local
`baseline-source.log` and `out/pose-source-final.log`; they were not changed to
make this feature appear green.

Warcraft III gameplay and Retera interoperability were not exercised. The
unsupported cases listed in the usage guide remain explicit exclusions.

Weekly usage baseline was 31%; the final implementation/verification gate was
33% in the same weekly window (stop threshold 66%). No credits, resets, tier,
model or dependency changes were made. These readings are account-wide and
rounded, so the change is not a precise task-only cost. Merge/publication remain
unauthorized. The candidate and evidence are retained; disposable test profiles
are removed after verification.
