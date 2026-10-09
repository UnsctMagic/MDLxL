# POSE implementation and verification

Original base: online `main` at `1e1d4c93398cdca7b8d74c73cbabbcd6fb28150a` (0.21.2).
Current-main integration: `a73f104824e02a976894151e50c671a33b46234d`.
Sources merged cleanly; generated bundle conflicts were resolved by rebuilding
from source. Main's paste/geoset changes were retained without source edits.
The initial POSE feature and Trollface refinement were merged through PR #148.
The automatic ancestor compensation described below is on `codex/pose-auto-ik`.
Dependencies and release version remain unchanged; this is a test candidate.

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

Native markers reuse ordinary Movement Move/Rotate/Scale for every native node.
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

Moving or rotating an ancestor automatically compensates its mapped, disjoint
limbs. Automatic targets yield at limb reach while the ancestor continues moving.
Their requested position/orientation survives repeated drags at the same pose;
matching sampled joint positions, rotations, frame, sequence and mapping prevents
stale goals after direct FK/endpoint edits or timeline changes. Mouse and numeric
Movement edits share this session result. Pin toggles rebase that endpoint.
Explicit pins can hold hands and feet firmly. Only these pins limit Translation
at the first inner/outer reach boundary, or Rotate/Scale by sampled bracketing
and bisection. Scale otherwise uses ordinary Movement behavior. The sampled native pose is
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

## Automatic ancestor posing (2026-10-09)

The user requested the body/limb freedom shown in the WhiteoutFlakes Auto IK
video and the Hive tutorials [Happy Animating with IK](https://www.hiveworkshop.com/threads/happy-animating-with-ik.256580/)
and [In-depth Animation Tutorial](https://www.hiveworkshop.com/threads/in-depth-animation-tutorial-3ds-max.123520/).
The relevant workflow is body/root motion with independent hand/foot goals,
orientation preservation, knee/elbow steering, and native keyed poses. Tutorial
instructions about rebuilding skins, removing imported animations or replacing
controllers belong to that 3ds Max/NeoDex workflow and are not applied to MDLxL.

- POSE enables automatic Move/Rotate compensation for complete limbs below the
  selected ancestor. Direct edits to a limb's own joints remain ordinary FK.
- Reaching a soft goal never caps the body. The two-link solution finds the
  closest reachable endpoint without changing bone lengths or skinning.
- Automatic goals remain available after release/re-grab, so a lifted body can
  return to its original foot targets. A changed native pose rebases the goal;
  session targets never enter MDX/MDL or add history on their own.
- The focused packaged proof uses ordinary mouse drags on native Footman:
  crouch, rise above reach, release/re-grab/lower, pelvis and chest controls,
  and complete Undo/Redo. Both feet return to their earlier positions.
- Three keyed poses at 500, 850 and 1200 ms use Body plus the foot controllers
  for crouch/landing placement. Measured hip heights were 40.40, 91.32 and 40.05.
  Timeline scrubbing and actual Play/Stop were exercised; MDX save and real
  packaged reopen retained the native model. The result is a test animation,
  not an automatically generated jump or a replacement for the user's model.
- Focused source checks: 33/33 POSE tests passed. Combined Movement, component,
  selection and marker checks: 102/105 passed. The three failures match the
  existing baseline: inline RGB on All line, active-editor display options,
  and rest-pose pivot serialization. Compatibility checks: 57/57 passed.

Candidate: `out/pose-auto-package/MDLxL-win32-x64/MDLxL.exe`.
Full packaged evidence: `out/pose-auto-ui-final/result.json` (25 checks) and
screenshots. This includes ordinary Alt+mouse camera rotation and wheel zoom,
explicit pins, overlap cycling, cancellations, native preview matrices, Undo/Redo,
MDL/MDX saves and actual reopen, plus the new automatic posing sequence.
Numeric coordinate parity passed separately in `out/pose-auto-numeric-ui/result.json`.
The narrower first proof is retained in `out/pose-auto-focused-ui/result.json`.
The original Footman/texture hashes remain unchanged. The measured native
preview matrix error was below 0.000029; no page errors occurred. Production
build and the package runtime/license checks passed. Full source-suite results
below belong to the earlier integration run, not a rerun of that entire suite.

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

Limb IK uses rigid two-link ancestry; connected upper-body IK uses native
spine/neck links. Both require positive uniform scale and
editable local tracks. Invalid/global/shared tracks reject locally. Direct
controls retain ordinary Movement behavior. No balancing, physics, contact
baking or automatic animation generation is supplied. Warcraft III gameplay
and Retera interoperability were not exercised. The automatic-posing follow-up awaits user acceptance and merge authorization;
no release or installed upgrade was performed.


## Connected upper body follow-up

Head/Chest Move previously authored native Translation directly. That let their
pivots detach from their parents. Named upper-body controls now grip the part
above the pivot using the existing skin-centroid reader (including mesh children
under SD helpers). Damped rotational solving shares Head Move through the
available Chest/Spine/Neck/Head ancestry. Anonymous intervening helpers retain
their links; Body/Pelvis remain the foundation and keep their accepted movement.
No pivot, hierarchy, skin, scale or local translation is changed by this solve.
Chest/ancestor handles carry the head but retain its world facing, matching the
head orientation constraint described in the IK tutorial. Native bone markers
keep ordinary Movement, including deliberate translation and scale.

Only existing controls are used. Mouse and numeric inputs share the solver;
numeric positions refer to the visible grip, and Highlight KF/Controller expose
its actual Rotation channels. Explicit hand pins constrain the shared torso
solve. Rotation restrictions apply to connected Move. Session IK still commits
one native transaction and does not introduce playback controllers.

Source evidence: `out/pose-connected-source.log` (39 POSE checks passed), covering
large/small Head/Chest drags, all parent-child lengths, multiple spine/neck joints,
FK transitions, pin reach, native track scope, Undo/Redo, and three keyed poses
saved/reopened through both MDL and MDX with intermediate-frame sampling.
A selected symbol wins over crossing labels when a drag begins, matching its
foreground drawing order. The regression reproduces a hand label crossing Body
in an upper-body pose and verifies that Body retains the drag.

Affected Movement checks: 107 tests, 104 passed. The same three baseline failures
remain: inline RGB fields on All line, quick display options, and rest-pose pivot
ordering. Compatibility: 57/57 passed. Final production build and packaging
verified 550 runtime/asset files and 55 locales. All 461 packaged source/bundle
files match the working source and generated output. The immutable Footman and
both exact Warcraft texture hashes remain unchanged.


Final packaged acceptance: `out/pose-connected-final-ui/result.json`, **26 checks
passed, zero page errors**, using
`out/pose-connected-final-package/MDLxL-win32-x64/MDLxL.exe`.
This includes actual Head/Chest mouse drags, numeric head coordinates, native
head-marker FK selection, cancel/Undo/Redo, head facing during chest motion,
existing four-limb pins and automatic body posing, mouse camera rotation/zoom,
compact default UI, MDL/MDX saving, and actual MDX reopen.
The three mouse-authored jump/upper-body poses at 500/850/1200 ms had leg-root
heights 40.40107/91.32011/40.05215. Playback advanced from 500 to 820 ms. Maximum
native preview/evaluator matrix difference was 0.00001806.

Final index hash: `95309f263cc6d05e2e73a23ac973ab055f8320c157d669ec12dcfb4b0d116479`.
Final assets hash: `73bf121fdbf67557196bd2933e62248433218ab8686aca1069d8ffa20dd8f86a`.
The test model and saved animation are ignored local evidence, not repository
assets. The user's running editor and profiles were not replaced. The candidate
awaits user testing and merge authorization on PR #154.


## Connected pelvis, mounted rigs and visual setup (2026-10-09)

The Footman pelvis previously translated only its lower-body branch, leaving the
sibling chest behind. Its handle now writes the shared body driver. Native bone
markers retain deliberate FK. Mounted recognition uses anatomy names, references,
hierarchy and skin centres to find four full hoof chains, two rider boots and two
hands. The rider follows the mount's separate carrier root without reparenting.
No model filenames or fixed object IDs enter runtime recognition.

Setup is a compact symbol palette and the existing Movement bone picker. An end
bone previews its chain; explicit custom joints use three selectable dots. Clicks
cycle overlapping bones within the active dot. Bad picks disable Add locally.
No bone dropdowns remain in Setup. Existing sidebar dimensions and closed sections
are unchanged. Labels appear only on selection/hover, avoid neighboring symbols,
and clear when leaving the viewport, including with bone markers hidden.

Source validation: `out/pose-ragdoll-final-source.log`, **50/50 passed**. This
includes all nine unmodified local `WH_WOC_Knight*.mdx` reference copies (Khorne,
Nurgle, Slaanesh, Tzeentch and Undivided variants), all eight controls per model,
connected parent-child distances, both heads, native writer scope, three frames,
Undo/Redo, MDX roundtrip and unchanged source hashes. The portable synthetic mounted
rig test runs without those local assets. Its jump/re-grab/landing check prevents
straight hoof chains from losing their bend or returning toward stale goals.
The overlay-only follow-up also passed all 39 existing pose tests.

Affected Movement suite: 110 tests, 107 passed. Three established baseline failures
remain: `Animations exposes inline RGB fields on All line`, `quick display shows
only the active editor options without Reveal`, and rest-pose pivot ordering in
`rest-pose pivot edits support every node kind, persist in MDL/MDX, undo, and retain
authored animation/skin/BPOS`. Compatibility: **57/57 passed**.

Packaged mouse/keyboard evidence:

- `out/pose-ragdoll-acceptance-full-ui/result.json`: **26 checks**,
  zero page errors. Pins, cancellation, no-op gestures, restrictions, ordinary FK,
  controls/display, camera rotation/zoom, MDL/MDX save/reopen, and a three-pose jump
  with native playback. This preceded only the final hover-label rendering polish.
- `out/pose-ragdoll-ready-footman-ui/result.json`: **4 workflow checks,
  5 drags**, zero page errors, on the final build. Textured view,
  symbol plus actual viewport bone selection, invalid root selection, explicit
  custom joint picking, XY pelvis movement matching the supplied GIF, connected
  jump/return, head/chest posing, camera rotation and native MDX save/reopen.
- `out/pose-ragdoll-ready-knight-ui/result.json`: **3 workflow checks,
  15 drags**, zero page errors, on the final build. Textured
  Undivided Chaos Knight with connected pelvis, horse/rider jump and return, all
  eight limb drags, both heads and chests, camera rotation and MDX save/reopen.
- Final native preview matrix errors were at most
  `4.582651662587978e-06` (Footman) and `8.208085915839547e-06` (Knight).
  The Knight's already-hidden zero-scale weapon and its reference (77/93) are
  excluded from invertible-matrix comparisons; their existing zero scale is
  preserved. Visible skeletal transforms are compared directly with the native
  renderer. All nine variants have source/model checks; the full mounted mouse
  walkthrough uses the Undivided Sword variant.

The Windows computer-use helper could not initialize (`failed to write kernel
assets`). Mouse and keyboard acceptance ran in hidden packaged Electron windows
through Playwright. Read-only probes inspect native state; posing and mapping
use actual UI input. This is not a claim of independent human enjoyment or
Warcraft in-game playback; those remain for user acceptance.

Final package: `out/pose-ragdoll-ready/MDLxL-win32-x64/MDLxL.exe`.
Packaging verified 551 runtime/assets and 55 locales; all 462 packaged
source/bundle files match the source byte-for-byte, with no mismatches.
Index hash: `0903a395ef451b7c00a4db825d8296ec1517f2415c1bc8f1cbb3ef62acdc817e`.
Assets hash: `11816f9fab1ade2a83976d3557e97511777c40e4d2ef9e79e773b27e20b7a149`.

Original models, textures, open editors, profiles and the primary `codex/model-tabs`
checkout were not modified. This remains an unshipped test candidate on PR #154;
no release/version bump or merge was performed.


## Complex SD bodies, riders, wings and tails (2026-10-09)

The Necrarch distortion came from recognizing its arm junction as Body. Moving
that junction left the lower robe behind. Recognition now ascends to the authored
whole-body driver, infers the chest separately, and uses native attachment
references to locate anonymous wrist, ankle and head joints. Connected upper-body
motion includes intervening anonymous spine/neck joints. The immutable blended
robe test checks the actual skinned vertices, not just bone positions.

The Vampire Dragon retains both four-joint legs, recognizes its wings and tail,
and carries its separately rooted rider and reins through the authored saddle
anchor. Chest bending and body movement both use the seat's actual matrix change.
The rider pelvis bends at its seat. Kurgan retains shoulder/bicep links in both
arms. Great Unclean One exposes the controlling head joint instead of the duplicate
mesh pivot. These rules use hierarchy, references, anatomy names and geometry;
there are no model filenames or fixed object IDs in runtime recognition.

All changes remain within POSE recognition, connected solving, gesture snapshots
and two additional symbols in the existing Setup palette. Native markers retain
ordinary Movement transforms. Sidebar widths, overlap cycling, Trollface palette,
track ownership and one-gesture history behavior remain unchanged. No rig repair,
reparenting, skin-weight edits or texture-path rewrites are performed.

Source evidence: `out/pose-complex-source-final.log`, **56/56 passed**, no skips.
This includes all 50 prior POSE/mounted tests and six complex-rig tests. The four
local models exercise every inferred control at three frames, connected geometry,
carrier placement, native channel snapshots, Undo/Redo and MDX roundtrips. Two
portable synthetic tests cover the robe and seat behavior without local assets.
All nine Chaos Knight variants remain in the accepted source regression.
Compatibility: `out/pose-complex-compatibility.log`, **57/57 passed**.
`out/pose-complex-sequences.json` additionally checks **33 authored poses** across
Stand, Walk, Attack and alternate sequences: no solve failures or missing limbs.
The broader Movement suite was not repeated in this pass; its three previously
recorded baseline failures above are not claimed fixed.

Packaged mouse/keyboard evidence on the final build:

- `out/pose-complex-final-necrarch/result.json`: **8 drags, 3 workflow checks**,
  zero page errors.
- `out/pose-complex-final-unclean/result.json`: **10 drags, 3 workflow checks**,
  zero page errors.
- `out/pose-complex-final-kurgan/result.json`: **11 drags, 3 workflow checks**,
  zero page errors.
- Dragon: `out/pose-complex-ready-dragon/progress.json` records **19 drags**,
  each with connected preview and exact Undo/Redo. Its full walk also reached
  native playback, camera rotation and a successful save. The final comparison
  exposed signed-zero loss in the test's JSON snapshot, not in the MDX: all 62
  differences reproduced as `-0` becoming `0` in JSON. Evidence is in
  `out/pose-dragon-save-snapshot-audit.json`. The snapshot now preserves signed
  zero. A focused packaged proof on the exact saved 19-drag pose then passed:
  `out/pose-complex-dragon-save-proof/result.json`, **3 workflow checks**, zero
  page errors, exact native values on open/save/reopen, and existing editor data
  retained through the normal Save model prompt. Product serialization and its
  strict comparison were not changed or relaxed.
- `out/pose-complex-final-regression/result.json`: all **26 original packaged
  Footman checks** passed with zero page errors. This includes pins, cancel,
  restrictions, normal FK/Scale, mouse camera controls, MDL/MDX save/reopen, and
  mouse-authored crouch/takeoff/landing with native playback.

The complex-model walkthrough uses actual clicks and drags for whole-body
movement, a repeated jump/return, every inferred part and limb, and exact Undo/Redo
for each gesture. It also checks hover labels, the visual Setup palette, native
playback, ordinary right-mouse camera rotation, sidebar width, MDX save/reopen and
unchanged fixture hashes. Only native file-dialog destinations are stubbed.
Read-only probes inspect model, renderer and history state; no pose is injected
through a test API. Test windows and profiles are isolated from the user's editor.

The Necrarch already has differences between the untouched native renderer and
CPU matrices, mainly on independent bats (maximum 0.68761; robe joint about
0.0366). The per-node comparison records that baseline and rejects additional
preview disagreement above baseline + 0.004. The body-drag audit measured an added
maximum error about 2.4e-7 and no added bat error. This pass does not fix or conceal
that existing evaluator discrepancy. Other final maximum errors are 0.00003737
(Unclean), 0.00001629 (Kurgan), and 0.00008153 (Dragon).
This is packaged editor evidence, not Warcraft in-game playback or independent
human acceptance of the feel.

Final executable: `D:/MDLxL-Tests/pose-complex-ready/MDLxL-win32-x64/MDLxL.exe`.
Packaging verified **551 runtime/assets and 55 locales**. All **462** packaged
source/bundle files match the tested source, with zero mismatches, recorded in
`out/pose-complex-package-proof.json`.
Index SHA256: `2b53bccf008c91f8ae68a7dcb68075ed9717b93615757c23e3baca5387b6a73e`.
Assets SHA256: `e8e5c4bcd95e0fe31408fa677e610e000358f42e1e9d842077f8c10be157c2d2`.

Original model SHA256 values (all unchanged, with byte-identical test copies):

| Model | SHA256 |
| --- | --- |
| WH_VC_NecrarchLord3.mdx | df905372b3a3eb7d864eab40f914839a901293faee499336affe49dfc3fd5dc5 |
| Current_VampireDragon.mdx (Desktop/WIP) | 53382ca34f9c9c0f8ee3a09ec8e5669a390390af9d4ca112531530a901d7004f |
| WH_DOC_GreatUncleanOneNewV2.mdx | 8717b78f7f373cf434447bd0c72d1dd9ec97bbc075dacd31f35a48f136b55de7 |
| WH_WOC_KurganWarlord3.mdx | 73a0ebe1ae66b47ee490c8af828a40bae98771a360b850d1dff772c8a45e2737 |

Exact Warcraft textures were resolved locally; no substitutes were downloaded.
Models, texture files, test profiles and screenshots remain ignored local evidence.
The primary checkout and user's open editors/profiles remain untouched. The build
is an unshipped candidate on PR #154, version 0.21.2, awaiting user testing and
merge authorization. No merge or release was performed.


## Editable custom chain setup (2026-10-09)

The previous three-dot picker hid manual control, limited direct setup to three
joints, and presented mapped handles without a useful editing path. Setup now
opens the selected mapping for editing, identifies handles by role and bone name,
and provides explicit Start/End picks plus the intermediate bending joints.
New bone chain follows the existing hierarchy without an artificial length limit.
Intermediate helpers can be excluded from IK rotation while retaining native
inheritance. No rig is reparented. Invalid bounds and empty bends stay local and
editable. Retargeting replaces the old mapping and clears stale endpoint state;
same-end edits retain pin state. Cancel and Remove affect only the chosen mapping.

The existing viewport picker, overlap cycling and Movement Object selection own
bone selection. Setup also offers Use selected bone, remains open during normal
camera input, and uses the existing movable-window hook so its title can be dragged
away from a bone. The floating editor is 260 px wide; the sidebar is unchanged.
No permanent panel is added. The accepted solver, automatic recognition, native
animation writer and model serialization are unchanged.

Source evidence: `out/pose-setup-source.log`, **57/57 passed**, no skips. The new
manual-chain check covers a four-joint path, optional helper rotation, a real limb
solve, invalid/cyclic/different-branch picks and an unchanged input model. The
existing Footman, nine Chaos Knight variants and four complex models still pass.

The initial packaged setup walkthrough passed all four functional checks. Visual
inspection then found flex compression in the named handle list; only the row
sizing was corrected before the final build. Final mouse/layout verification passed in
`out/pose-setup-final-ui/result.json`: **4 workflow checks**, zero page errors. The legacy Footman script was updated to return to
the Handles list before adding another mapping, since Setup now opens the selected
handle directly for editing.


The final setup walkthrough uses the Kurgan Warlord's four-joint arm. Actual mouse
picks create a chain, correct an unrelated Start, edit optional bending joints,
retarget the End and restore it, cancel a draft, remove one handle, and recreate
it from scratch. It checks unchanged other mappings, pin preservation on same-end
edits, removal of stale endpoint pins, no model/history changes during setup,
restoration of the previous bone display, normal camera rotation while picking,
and moving the setup window away from the rig. The resulting custom handle is
actually dragged; its native edit and exact Undo/Redo are verified. Rendered row
bounds confirm both the role and bone name fit without overlap. Maximum native
preview/evaluator matrix difference was 0.000005068.

Final executable: `D:/MDLxL-Tests/pose-setup-final/MDLxL-win32-x64/MDLxL.exe`.
Packaging verified 551 runtime/assets and 55 locales. All 462 packaged source and
bundle files match the working source byte-for-byte, with zero mismatches:
`out/pose-setup-package-proof.json`.
Index SHA256: `407f718f20498adf5e51cd32ec83c56b27accc755adbefc05352c0af60170c70`.
The original Kurgan fixture hash is unchanged. The user's open test, models and
profiles were not replaced; no visible test window was opened. Version remains
0.21.2, unshipped and unmerged on PR #154.


`out/pose-setup-final-footman/result.json` passed all **26 packaged regression
checks**, zero page errors, on the same final build. It exercises first-use invalid
selection, the Movement Object picker, normal bone editing, pins, cancellation,
restrictions, camera rotation/zoom, connected body/head/chest posing, MDL/MDX save
and actual reopen. Three mouse-authored jump poses at 500/850/1200 ms retained root
heights 40.40107/91.32011/40.05215; native playback advanced to about 800 ms before
save/reopen. No user model, texture, profile or currently open editor was modified.
This validates the editor workflows; user acceptance of the interaction remains
pending, and no Warcraft in-game playback was performed in this setup pass.


A concurrent texture-search merge advanced main to `53a49794` during handoff.
Its generated bundle conflicts were resolved by merging the source and rebuilding
Vite, never by hand-merging hashed assets. The POSE/Movement source matches
`f5561a44` exactly, and the incoming texture-search source matches main exactly.
Combined source validation: `out/pose-setup-integrated-source.log`, **90/90 passed**
(57 POSE plus 33 texture-library checks), no skips.

The final integrated candidate is
`D:/MDLxL-Tests/pose-setup-integrated/MDLxL-win32-x64/MDLxL.exe`.
Its complete setup mouse walkthrough passed all **4 checks**, zero page errors:
`out/pose-setup-integrated-ui/result.json`. The 26-check Footman result above
covers the identical POSE/Movement source; that full walkthrough was not repeated
for the unrelated texture-search integration. Packaging again verified 551 files
and 55 locales. All 462 packaged source/bundle files match the combined source:
`out/pose-setup-integrated-proof.json`.
Index SHA256: `507e450499f0f979fb5be8adcca5895ad11d015fde333d7bbdf470879c331f6c`.
The feature PR remains unmerged and the candidate has not been opened visibly.


## Assisted chain setup (2026-10-10)

The follow-up reduces the unopened Setup view to New bone chain plus closed
Other handle types / Edit existing handles sections. New chains pick the end
first and infer the native unbranched limb. Adjust chain retains explicit Start,
End and bend inclusion; explicit starts do not get replaced by later suggestions.
Cycling endpoint picks refreshes an automatic start. Shared body starts offer a
reviewable Use separate limbs correction, applied to both mappings only on save.
No bone parenting, skinning, animation tracks, profiles or sidebar widths change.

Evidence:
- `out/pose-assisted-source.log`: 58/58 POSE source checks, zero failures/skips.
- `out/pose-assisted-verified-wag/result.json`: two packaged workflow checks using
  actual viewport bone clicks on a copy of WAG. Rear endpoints 27 and 28 suggest
  native paths 35/42/21/27 and 36/14/22/28. Reproducing the shared pelvis start at
  node 2 offers and applies the two-chain correction. Both handles deform native
  geometry independently, with exact Undo and one edit per drag. Actual right
  mouse camera rotation works. Setup creates no model/history changes.
- `out/pose-assisted-verified-kurgan/result.json`: four packaged manual-edit checks
  including retargeting, bend exclusions, pins, Cancel/Remove, camera input,
  movable Setup and exact Undo/Redo. No page errors in either walkthrough.
- `out/pose-assisted-verified-package.log`: complete package, 551 runtime/assets
  and 55 locales. Test executable is in D:/MDLxL-Tests/pose-assisted-verified.
- Screenshots of the quiet default, endpoint suggestion and offered correction
  were visually inspected. All original models remain unchanged.

Recognition diagnosis is separate from this setup change. The current recognizer
uses names, hierarchy, attachments and limited geometry. It does not compare
motion across animation sequences. Gnome rider's T1-T4 tail lies beneath a nested
hip instead of the inferred actor root, outside the current tail rule. WAG's
anonymous horse legs and concatenated person-hand names are missed. Black Knight
has all four hooves in Stand; scanning 65 poses found the rear-right hoof rejected
at Walk frames 333 and 900 by the sampled rigid-transform check. Decay also has
rejected transforms. These are observed limitations, not fixes claimed here.
Geometry/motion-based semantic inference and arbitrary scaled/sheared IK remain
unimplemented. No Warcraft in-game playback or subjective human acceptance claim.

The complete Footman regression also passed 26/26 packaged checks with no page
errors in `out/pose-assisted-final-footman/result.json`, including native MDL/MDX
save/reopen and three-frame keyed jump playback. That run used the assisted-final
build immediately before the bend-exclusion preservation refinement; both WAG
and Kurgan setup walkthroughs were rerun successfully on assisted-verified after
that refinement. The final candidate source/dist comparison is 462 files with
zero mismatches. Original WAG SHA256 is
2164e7f72d9256d095ef3ef9cac15c8955e48e86062c4e3e9cee87144f32b9ca.


## Direct Add / existing-only Setup and nearby Pin (2026-10-10)

User recording MDLxL_Oxn3El3EKS.mp4 was sampled locally. Camera rotation unmounted
MovementController in App.jsx, which discarded PoseControls window/draft state.
Movement remains mounted during rotation; other camera behavior is retained.
Add now opens the new-handle symbols directly and remains ready after saving.
Setup only edits existing mappings. Pin for a selected foot/hoof is a small
viewport button beside that handle; it uses the existing session pin state.

`out/pose-add-setup-ui-pass/result.json` passed five packaged mouse workflow
checks with zero page errors: two hooves and pelvis added consecutively, Alt-mouse
rotation while the pelvis draft remains open during and after the gesture,
existing-only Setup, nearby Pin toggle on both hooves with no keys/history,
button disappearance on pelvis selection, actual posing and exact Undo, camera
rotation and unchanged sidebar width. Screenshots were visually inspected.
The original WAG hash is unchanged. Production build and complete packaging
passed; candidate is D:/MDLxL-Tests/pose-add-setup-ready/MDLxL-win32-x64/MDLxL.exe.
Native computer-use helper initialization failed (kernel asset path); the
packaged Electron mouse harness supplied the input evidence. React lifecycle,
latest callback refs and overlay removal were reviewed with the React skill.
The full source and Footman suites were not repeated for this UI-only pass;
prior results remain associated with their documented build boundaries.


## Red blocker crosshair (2026-10-10)

The existing reach limiter now reports the pinned endpoint(s) which constrain
its valid movement prefix. Linear limits retain the original fraction math;
nonlinear limits identify the failing pins immediately beyond the boundary.
Pin-retention rejections also identify their offending endpoint. Direct limb
reach limits ping the dragged limb. The existing overlay draws a red crosshair
with a dark outline, pulses for 1.2 seconds and fades; no extra panel, selection,
keys or document history are introduced.

41/41 pose source checks pass, including single and simultaneous blocking pins.
Packaged mouse proof: out/pose-blocker-final-ui/result.json. WAG rear hoof 27
is explicitly pinned, hoof 28 remains free, and a pelvis drag exceeding reach
pings only hoof 27. Screenshot, isolated preview/history, fade-out, exact Undo,
normal posing, Add/Setup/Pin and actual Alt-mouse camera rotation are checked.
Original WAG bytes remain unchanged. No native Warcraft playback was exercised.
Candidate: D:/MDLxL-Tests/pose-blocker-final/MDLxL-win32-x64/MDLxL.exe.


## Crosshair toggle and handle Pin placement (2026-10-10)

The remaining hand Pin moved from the sidebar to the existing projected-endpoint
button used for feet/hooves. Its sidebar spot is now a compact crosshair toggle:
red/on by default and black/off when disabled. It controls only blocker feedback,
preserving pins, pose solving, setup drafts and document history. Session-only
config stores crosshair=false when disabled; unspecified defaults to enabled.

out/pose-crosshair-toggle-ready-ui/result.json passes seven packaged workflow
checks with no page errors. Actual WAG hand chain 11/18/25 is added with mouse
bone selection and its nearby Pin toggles without keys/history. Keyboard Space
on the crosshair button during a captured pelvis drag verifies red/on and
black/off, suppression of an active ping, and re-enabling. Screenshots were
visually inspected. Earlier Add/Setup, hoof Pin, isolated drag preview, exact
Undo, fade-out, normal posing, unchanged sidebar width and actual Alt-mouse
camera rotation also pass. WAG original bytes remain unchanged. No native
Warcraft gameplay or new solver regression suite was exercised for this UI pass.
Candidate: D:/MDLxL-Tests/pose-crosshair-toggle-ready/MDLxL-win32-x64/MDLxL.exe.
