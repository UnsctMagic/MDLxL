# Sphereomancer v2: five presets, Add sphere/square, EMTR-style handles, no black flashing

Status: owner approved merge; integration verification passed
Owner / consolidator: Codex implements; Claude reviews and merges on the owner's word
Updated: 2026-11-02

## Goal and completion criteria

The owner tried the PR #482 build and asked for these changes:

> Viewpoint constantly flashes black - super annoying. Remove fit to unit, it sucks. [...] All of them should be dragable, adjustable. For all of them - Add square, Add sphere. I found the adjusting controls pretty shit - use similar ones to emtr - a draggable overlay thats easier to control.

Done means all of the following, verified in the packaged app on the hidden test desktop:

1. **No black flashing.** Neither OptimizeXL preview flashes black while you:
   - sit in Sphereomancer, paused or playing;
   - drag a shape;
   - change the preset;
   - change Size.

   Find the real cause first (see "Flash suspects") and prove the fix with a frame capture: no all-black or mostly-black frame in a sequence of at least 120 captured frames for each case above. Check whether other stages flash too. If they do, fix the same cause there as well.
2. **Fit to model is gone.** Remove both "Fit to model" presets, `fitCollisionShapes`, `fitSpheres` and `standingVertices` (`src/model-collisions.js`), plus their tests, docs text and translations. Keep `fittedCollision`, which Managers' Sphere/Box buttons use.
3. **Exactly these five presets, in this order.** Models without supported collision shapes default to **x2 standard unit**. Models with authored spheres or boxes start from those editable shapes; explicitly choosing any preset replaces them.

   | Label | Shapes (x, y, z, radius for spheres; min and max corners for a square) | Source |
   |---|---|---|
   | `x1` | one sphere `[3.5388801097869873, 3.874919891357422, 41.05950164794922, 52.40719985961914]` | SD Ghoul, exact floats |
   | `x2 standard unit` | the current Standard unit Footman spheres, unchanged | SD Footman |
   | `x3` | three Footman spheres stacked: the two Footman spheres plus a third of the same radius, 40.3736 above the upper one (the Footman's own spacing), at x 5.257450103759766, y 0 | Footman spacing, extended. No native unit-size 3-stack exists; SD 3-sphere sets are large creatures. |
   | `Mounted` | the current Mounted rider spheres, unchanged (owner-reviewed Khorne rider) | existing preset |
   | `Square` | one box `[-56.55099868774414, -64.06929779052734, 0, 56.55099868774414, 64.06929779052734, 113.10199737548828]` | SD Farm, exact floats |

   Remove every other preset: Small/Large/Tall unit, Cavalry, Flying mount, Small/Large building and Tower. Update the tests and manual scripts that use preset indices or names: `test/optimizexl.test.js`, `test/optimizexl-cleanup-visibility.test.js`, `test/sphereomancer-shapes.test.js`, `test/optimizexl.electron.cjs`, `test/optimizexl-selection.electron.cjs`, `test/optimizexl-cleanup.electron.cjs` and `test/manual/*.mjs`.
4. **Add sphere / Add square for every preset, in Simple mode too.**
   - Put the two buttons under the Size slider, labeled `Add sphere` and `Add square` (the owner's words).
   - A new shape goes to the middle of the existing shapes and becomes the selected one:
     - a sphere copies the selected sphere's radius, or 38.076 if no sphere is selected;
     - a square is 60 × 60 × 80, standing on Z=0.
   - Each shape has a way to remove it on the preview overlay, using the Managers remove action (`Remove collision shape`, trash icon). Advanced keeps its number fields.
   - Saving still writes squares as native boxes (Shape 0).
5. **Handles like EMTR's.** Every shape can be moved and resized by dragging in the After preview, with controls modelled on EMTR's emitter overlay, not the current small squares:
   - **Move:** a labeled `Move` grab at the shape center, the same markup and look as `pe-move-emitter` in `app/ParticleStageTools.jsx` (r=7 circle plus the `Move` text). It drags in the screen plane, like emitter Translation.
   - **Sphere radius:** one handle on the camera-facing outline. Dragging it outward or inward changes the radius, like the ground glow's edge handle in `app/GlowStageTools.jsx` (`particleAxisMapping` from the edge, `movementDragAmount`).
   - **Square:** face-center circles on axes with a useful screen projection, like main's outline handles, resizing that axis around the center. Keep unprojected depth out of the way. Retain the starting handle set/order and drag mapping for the whole drag.
   - **Selecting:** clicking a shape center or its wide invisible outline hit stroke selects that shape. The selected shape is accent-colored; the others are cyan.
   - **Hit targets:** at least as large as EMTR's, with the pointer cursor and `<title>` tooltips: `Move`, `Drag to resize`.
   - **Behaviour:** Escape cancels a drag, arrow keys nudge (Shift = 10), and the preview updates at most once per frame (`createFrameCoalescer`).
   - **Scope:** this replaces the overlay in the shared `app/CollisionOverlay.jsx`, so Managers' collision editor gets the same controls (AGENTS.md: one way of doing things). Keep `collisionStageSnapshot` as the geometry source, adding the handle points it needs.
   - **Camera:** mouse camera rotation in both previews still works everywhere except on a handle or outline.
6. **Checks.**
   - Source tests for the presets, squares, and handle geometry, including `test/live-drag-frames.test.js` and `test/hotkey-window-source.test.js`, which point at `CollisionOverlay.jsx`.
   - Translations (ru/es/zh) for new strings, with removed strings dropped from `src/locales/*.json` and `test/fixtures/locale-feature-sources.json`. The catalog size in `test/localization-catalogs.test.js` matches.
   - The packaged app tests `optimizexl`, `optimizexl-selection`, `optimizexl-cleanup`, `optimizexl-workflow`, `optimizexl-motion` and `model-manager-regressions`, run hidden via `pnpm run test:packaged default <names>` with `MDLXL_REAL_PLAYWRIGHT=D:/Claude/tools/node_modules/playwright-core` and `MDLXL_SUITE_PKG` set to your package.
   - Extend `optimizexl.electron` to: drag Move, drag the sphere radius handle, Add square and drag its face, and capture the flash frames.

Out of scope: the other OptimizeXL stages (apart from the flash cause), new panels, and Managers' list and sliders.

## Revision and local state

- Base: `main` at `ee5abde3` or later. PR #482 (merged) added the current code.
- Branch: `codex/sphereomancer-v2`.
- Fixtures: OptimizeXL packaged tests use `test/helpers/fixtures.cjs`. Test models live in `D:\Claude\MDLxL-TestModels`; never delete them.
- Hand-test build of #482: `D:\Claude\MDLxL-TestBuilds\Sphereomancer`.

## Relevant owners

- Presets and saving: `SPHERE_PRESETS`, `presetShapes`, `simpleSettings('spheres')` and `spheres()` in `src/optimizexl.js`. Rows hold 4 numbers for a sphere and 6 for a box.
- Availability star: `src/optimizexl-availability.js` (valid spheres or boxes, so no star).
- UI: the Sphereomancer block, `shapeNode`/`shapeRow`, `useCollisionGesture` and the After `.ox-stage` in `app/OptimizeXL.jsx`; help text in `app/OptimizeXLHelp.jsx`.
- Overlay and drag: `app/CollisionOverlay.jsx` (shared with `app/ModelManager.jsx`), `app/collision-stage.js` (snapshot) and `src/model-collisions.js` (move/resize).
- Previews: `app/GamePreview.jsx`, including the `showCollisionSpheres` canvas for Before, `onCollisionStage` and `collisionReportKey`.
- EMTR controls to copy: `app/ParticleStageTools.jsx`, `app/GlowStageTools.jsx`, `src/particle-handles.js` and the `pe-stage-tools` CSS.
- Styles: `app/optimizexl.css`. The popup copies stylesheets only when it opens, so overlay rules must be in `optimizexl.css` (PR #482 found that `model-manager.css` was missing in the popup).
- Docs: `docs/OPTIMIZEXL.md` (Sphereomancer row and research section) and `docs/OPTIMIZEXL_TEACHING.md` (Sphere presets row).

## Findings and decisions

- Verified (PR #482 survey, 2,274 SD models from CASC): units mostly use 1-2 spheres, and buildings one ground box with its bottom at Z=0. The Footman has two r38.076 spheres and the Ghoul one r52.4 sphere.
- Decision (owner, 2026-11-02): no automatic fitting; five fixed presets plus Add sphere/square; default `x2 standard unit`.
- Decision (Claude, from evidence; the owner may veto):
  - `x3` extends the Footman stack, because no native unit-size 3-stack exists.
  - `Mounted` keeps the owner-reviewed rider spheres.
  - `Square` uses the Farm box.
- Flash suspects. These are unverified; measure before changing anything.
  - Since #482, `GamePreview` calls `onCollisionStage` with a new snapshot whenever the frame or camera changes. During playback that is a React state update in OptimizeXL every frame, re-rendering both previews.
  - The Before overlay canvas reassigns `collisionCanvas.width/height` every frame, which clears it. That alone is transparent, but check whether it forces a compositor flash.
  - The After preview's `revision={revision+request.current}` changes on every settings change, so the After model reloads with a possible black frame. Dragging now commits settings, which starts a worker run each time.
  - Check whether the flash predates #482: build `463bfef5^1` (main before #482) and compare.
- Avoid: don't fix the flash by hiding the preview or adding delays. Find the frame that renders black and remove its cause.

## Changes and verification

Earlier implementation-agent verification (the owner subsequently rejected its real-settings behavior; see follow-up below): changed the shared collision editor and Sphereomancer. Fit helpers and obsolete presets/translations are removed; default is x2 standard unit. Simple mode adds spheres/squares and removes them on the overlay. Advanced retains numeric fields. Shared EMTR-style Move, sphere edge and visible-face controls retain Escape, arrow/Shift nudges and once-per-frame drafts. Native box saving, unrelated stages, model motion and linked mouse cameras are preserved.

Flash cause: settings changed the After revision at worker dispatch and again its model at completion, destroying/recreating its WebGL surface; the compositor could see that surface before its first draw. Collision-only proposals now reuse the accepted model's render resources, the worker request counter no longer owns the renderer revision, a new renderer draws before publishing its surface, and resize only assigns dimensions when they change (same-size assignments clear WebGL). The existing Portrait dependency is preserved. No masking or delay was added. Fractional Size exposed a browser serialization midpoint issue; edited radii now enter the native Float32 domain at the Sphereomancer write boundary.

Measurements: the original #482 package had one 98.4%-black preset frame and one 97.8%-black Size frame per 120-frame sequence. Building 463bfef5^1 (a3760b73) also reproduced it (3 preset frames, 1 Size frame). Final package: 120 compositor frames each for paused, playing, preset changes, Size changes, shape drag and another-stage settings change; zero mostly-black frames in either pane (720 frames per pane). The five Sphereomancer cases replaced zero WebGL canvases. CDP captures bypass screenshot stabilization; sampled RGB <24 in >90% of preview pixels defines mostly black.

Verification: full source 2592 passed / 0 failed / 10 skipped; final focused source 72/0/0; final compatibility 57/0/0. All six required packaged suites passed on the final package: optimizexl, optimizexl-selection, optimizexl-cleanup, optimizexl-workflow, optimizexl-motion, model-manager-regressions (6/0/0). Real clicks/drags verify Move, radius, square face, Simple add/remove, Escape while dragging, arrow/Shift nudge, dropdown wheel, advanced fields and camera rotation in both OptimizeXL panes and Managers. The workflow's old post-Commit text selector failed on both original and final packages; it now waits for the existing titled toolbar button. The review follow-up below supersedes the Managers disappearing-handle cancellation expectation: a face losing its projection must keep the active drag until release.

Fail-first: new preset/geometry source checks failed 4 of 5 on old code; the extended packaged check failed on the original package's preset-list assertion. Direct old-package captures reproduce the black frames. The Size interaction captured the BoundsRadius save-verification error before normalization.

The immutable flail replay has one historical Mounted hash mismatch, also present on untouched main: main and this branch both emit 3920de513a8e289edffbbd10d760ae9bbb56c5dbd2b81d8e58387806938f0207; historical golden expects 084d34e0deda0e6d2d7c1722698806b4c937db3a45c34f18d94aa1cd3bd8174a. All other replay cases matched. Golden/approved baseline files were not changed.

### PR #507 review correction (2026-11-02)

Starting head: c26b9f6c. Removed the face-normal back-face filter and horizontal depth fallback from collisionStageSnapshot. Box circles now use main's existing particleAxisMapping eligibility: both signs of every projected axis are available, and unprojected depth is omitted. Sphere edge controls, Move controls, camera presets and model resize math are unchanged.

CollisionOverlay retains the starting resize-handle set and order until release/cancel, updating positions from the live snapshot where available and keeping the starting position otherwise. The gesture's starting basis stays latched. Selection/shape loss, Escape and pointer cancellation still cancel; Move retains its existing visibility check. Pointer-event auditing demonstrated why retaining only the active handle was insufficient: appending it after the other handles moved the captured DOM node and caused lostpointercapture. Keeping the whole ordered set avoids that loss.

Tests: five source cases check Front, Side, Top, angled Perspective and level centred Perspective. All five fail on c26b9f6c (the other four Sphereomancer checks pass). The restored Managers packaged scenario drags visible Width in Top view, verifies the live draft and commit, changes to Front during a second drag, waits for that view's actual snapshot and verifies the retained drag commits its final draft. The old package fails waiting for the camera-facing depth handle to disappear in Top view. This replaces the earlier expectation that changing views should cancel a disappearing face drag, per the owner's review correction.

Review verification: 78 focused source passed / 0 failed / 0 skipped. Final hidden packaged: optimizexl passed (80s), model-manager-regressions passed (5s), 2 passed / 0 failed / 0 skipped, on the same rebuilt package. OptimizeXL again captured 120 frames per case in both panes with zero mostly-black frames. Managers also verified normal mouse rotation. Commands: node --test test/sphereomancer-shapes.test.js test/model-manager.test.js test/live-drag-frames.test.js test/hotkey-window-source.test.js test/optimizexl.test.js; pnpm run test:packaged default 'optimizexl,model-manager-regressions'. Small logs and flash summary are retained in D:\Codex\sphereomancer-v2-review-results; disposable package/profile/checkout are removed after push. The full source/packaged suites are deliberately not rerun for this focused follow-up. Independent Claude QA and owner acceptance remain pending; do not merge.

### Owner settings rejection follow-up (2026-11-02)

Starting head: ece19d84. Four corrections:
- Collision gestures now schedule/cancel frames through the pointer target's ownerDocument.defaultView, matching the existing owner-window pattern. The main window's frame clock no longer owns popup drafts. Audited the other reachable coalescers: GamePreview's camera report, selection, node and hover frames already use the owner-window preview clock/view scheduler; GeosetListBox uses its DOM owner's clock. OptimizeXL playback already uses its root owner. No unrelated clocks were changed.
- Every shape has a transparent 16px outline hit stroke and a 20px center selection target. Visible outline styling stays compact. Selected Move/resize/trash controls are painted after every shape's hit targets, retaining the prior ordered resize handles and camera controls.
- simpleSettings starts from copied native sphere/box coordinates and radii at Size 1. A disabled existing “Collision shapes” status distinguishes authored rows from the five selectable presets; choosing a preset replaces the rows, including x2. Models without supported shapes retain the x2 default. Mixed sphere/box copying is source-tested.
- Reproduced the trash failure with a real flail in a maximized popup: moving another sphere's outline across the selected trash button makes elementFromPoint return that polyline. Its pointer-down selects the other shape and removes the button before click. Painting selected controls last fixes that path. Deletion is exercised for every row through zero shapes, plus the overlap case.

Tests use normal (non-headless) Electron startup on the hidden desktop, maximize the main and popup, leave background throttling ON, and copy the tested build's preferences read-only into a disposable test profile via MDLXL_OPTIMIZEXL_SETTINGS. For the live check, Playwright's main-page focus emulation must be disabled on its original CDP session (a separate session cannot clear it); the covered parent is additionally minimized to guarantee document.hidden while the popup stays maximized. Real pointer drags assert outline changes and pointer still held before release for Move and radius. The remaining existing flash/save workflow restores the main window behind the popup. No user window/profile is changed.

Fail-first: the authored-shape source test fails on ece19d84; an executable test of the production gesture hook with separate main/popup frame queues fails “an occluded main-window frame must not own the live drag” (1 !== 0) on that revision, then proves live drafts before release with the corrected owner clock. The original packaged renderer fails authored rows, second-center selection, a click 6px outside the thin outline, and overlapped-trash deletion. Honest limit: even with document.hidden and throttling on, this hidden-desktop old-clock-only comparison still advanced enough frames to pass its live assertions; it is not fail-first renderer proof of the owner's fully stalled clock. The source clock test covers that suspended-main condition explicitly.

Focused source: 82 passed / 0 failed / 0 skipped. Final hidden packaged: optimizexl passed (155s), model-manager-regressions passed (6s), 2 passed / 0 failed / 0 skipped on the same final package. All eight owner-popup checks pass. The existing six 120-frame capture cases again contain zero mostly-black frames in either pane. Save/source-preservation and normal mouse rotation also pass. The old DOM-linked React-fiber proposal reader produced stale snapshots: the final comparison recorded 2 stale reads. The test now uses the existing committed-tree probe, waits for prior edits to settle and verifies the actual pointer target; the original radius/box assertions are unchanged. Only optimizexl and model-manager-regressions run for this follow-up. Existing cleanup/selection scripts were updated to explicitly choose a preset before their preset-specific assertions; those suites are not run per the owner's restriction. Small evidence: [owner popup verification](../../test/evidence/sphereomancer-v2/owner-popup-verification.json), with logs in D:\Codex\sphereomancer-v2-owner-results. Independent Claude QA and owner acceptance remain required; do not merge.

### Right-side sphere selection boxes (2026-11-02)

The owner accepted the previous behavior and requested a separate selection box offset to the right of every sphere, retaining line selection. collisionStageSnapshot now provides a selectionBox point for every sphere (selected or not): a 24px numbered box sits 14px beyond the projected right edge and is clamped inside the viewport. Shared CollisionOverlay renders those boxes with a selected state and the existing selection tooltip. Clicking a box selects its sphere; line and center selection, Move/radius/trash controls, square controls and camera rotation remain available. Selected editing controls retain their top paint order. Managers shares the same sphere selectors.

Fail-first: the new geometry assertion fails on 31e34117 because selectionBox is absent; the hidden real-model check fails waiting for .mm-sphere-select. Final focused source: 83 passed / 0 failed / 0 skipped. Hidden optimizexl (142s) and model-manager-regressions (5s): 2 passed / 0 failed / 0 skipped. Actual clicks select both sphere boxes and retain center/outline selection; existing live drag, trash, save and camera checks pass. Six 120-frame cases remain free of mostly-black frames. Tests reused hard links to the existing Electron runtime with a source app junction and disposable profiles, avoiding another full installation. Small logs/capture: D:\Codex\sphereomancer-v2-owner-results\selection-boxes.

The same D:\Claude\MDLxL-TestBuilds\Sphereomancer-v2 renderer files are updated in place; the currently open owner session is left running. Reopen that test to load the new controls. Old loaded bundles remain available until the owner closes that session; profiles/personal content are untouched. No merge.

### Center and Quad-style Shift movement (2026-11-02)

Starting head: 05ca56f1. The selected sphere or box now has a Center button immediately below Move. Center translates its world X/Y center to the model's vertical axis at X=0, Y=0, retaining the current world height and dimensions/radius. collisionStageSnapshot computes the translation using its evaluated matrix/inverse, including transformed parents; the shared gesture commits it through the existing moveCollision owner. Managers keeps normal Undo/Redo. Native Float32 coordinate storage can introduce translation roundoff (measured 0.00000763 model units), covered by a 0.00001 dimension tolerance; this is not a resize.

Shift movement reuses Quad view's moveDragPoint verbatim: the first motion of each Shift hold latches horizontal or vertical screen movement, perpendicular travel is discarded for that hold, and release/repress continues from the visible position. Only pointer bookkeeping runs per event; cloning/model preview work still runs on the owner-window coalescer once per frame. Ordinary Move, Shift-arrow tenfold nudges, Escape, radius/face resizing, numbered selectors, trash and camera navigation remain available. Center and the Shift tooltip are translated in ru/es/zh.

Fail-first: old geometry has no centerDelta; old real-model popup lacks Center and fails the new Shift latch check; the old production hook moves Z to 36 instead of keeping 40 on the first Shift-horizontal step. Final focused source: 96 passed / 0 failed / 0 skipped (including shared Quad gestures, parent-transform centering and modifier transitions). Final built bundle: hidden optimizexl passed (160s) and model-manager-regressions passed (6s), 2 passed / 0 failed / 0 skipped. Managers passed on the same bundle before the OptimizeXL-only Float32 expectation correction, so only that failed suite was rerun. Actual clicks verify sphere radius/height and offset-box size/height preservation; actual Shift drags verify latching and release without snapping; Managers verifies Center with Ctrl+Z/Ctrl+Y. Existing save, mouse rotation and all six 120-frame flash checks pass. No full suite was run.

Small evidence: D:\Codex\sphereomancer-v2-owner-results\center-shift. The existing Sphereomancer-v2 test files are updated in place; the owner's current session stays open, so reopen that test to load the controls. No extra portable installation and no merge. Owner acceptance and independent Claude QA remain pending.

### Dragging the numbered sphere selector (2026-11-02)

Starting head: 3792e553. Hold and drag any sphere's right-side number box to select and move that sphere in one press, including when another sphere was selected. It uses the existing owner-window frame coalescer, screen-plane Move basis, Quad-style Shift latch, Escape and pointer-cancel behavior. A click without movement only selects and does not rewrite fractional-Size geometry. Line/center selection, Center, radius/face/trash controls and camera navigation remain. The shared Managers editor gets the same number-box gesture. The tooltip is translated in ru/es/zh.

The first implementation exposed an intermittent selection race: tracing real pointer events showed the intended number retained pointer capture and changed selection, but its gesture was gone before the first move. A pending previous-selection effect could cancel the drag started in that same event. The gesture now allows its starting selection until the target selection is acknowledged; a later unrelated selection still cancels. The production-hook test fails before this correction with "a pending previous-selection effect must not cancel the number drag" (undefined !== 1), then verifies both retention and subsequent cancellation. Initial fail-first on 3792e553 also failed the missing unselected-sphere move mapping, click-only no-commit check and the packaged live-number movement timeout.

Final verification: 96 focused source passed / 0 failed / 0 skipped. On the same rebuilt bundle, hidden optimizexl passed (177s) and model-manager-regressions passed (6s): 2 passed / 0 failed / 0 skipped. Only these two requested suites ran. All thirteen owner-popup checks passed; existing save/source-preservation, camera rotation, Center/Undo/Redo and projected-face checks passed. Six 120-frame cases again had zero mostly-black frames in either preview. The added real-model check clicks at fractional Size without changing geometry, drags sphere 2 while sphere 1 stays unchanged, begins a drag on unselected sphere 1 and cancels with Escape, and starts sphere 2 with Shift before releasing Shift without snapping. It waits for the committed geometry to reach the overlay and verifies the actual pointer target before every new drag. Small evidence: D:\Codex\sphereomancer-v2-owner-results\number-drag. The existing Sphereomancer-v2 test installation was updated in place, with its open owner session and personal files preserved; reopen it to load the gesture. No second portable installation. Independent Claude QA and owner acceptance remain pending; no merge.

Existing source skips (not enabled by this task):
- CLI SIGTERM-stop test: Windows platform exclusion
- Archer material stack: MDLXL_ARCHER not set
- Skin-collapse pair: MDLXL_SKIN_COLLAPSE_BROKEN / MDLXL_SKIN_COLLAPSE_REBUILT not set
- Private Fx replay: MDLXL_FX_MODEL not set
- POSE corpus corrections: MDLXL_POSE_CORPUS manifest absent
- POSE corpus source hashes: same absent manifest
- Dense twin-head rider: MDLXL_POSE_PERFORMANCE_MODEL not set
- Background symlink isolation: this Windows account cannot create symbolic links
- Tinker/Brown Magnataur replay: MDLXL_SORT_NURGLE not set
- 8.3 TEMP updater: volume has no 8.3 short names

Evidence: [before flash](../../test/evidence/sphereomancer-v2/before-flash.png), [final controls](../../test/evidence/sphereomancer-v2/after-controls.png), [baseline measurements](../../test/evidence/sphereomancer-v2/baseline-frames.json), [all final frame measurements](../../test/evidence/sphereomancer-v2/after-frames.json), [results and renderer hashes](../../test/evidence/sphereomancer-v2/results.json).

Not exercised: native Warcraft III playback. The owner authorized merging after the interactive test; no release is authorized.

### Owner merge authorization and main integration (2026-11-02)

The owner explicitly approved merging PR #507 after trying the updated test. Current main 04082fb4 is integrated on the feature branch; conflicts were limited to adjacent rows in the agent map and task index. Both the collision-clock reference and main's Library review reference are retained; unrelated current task rows follow main. The completed Sphereomancer row is removed from the current-task index. GamePreview auto-merges main's particle preview sizing/frame-scheduler additions with the collision renderer lifetime changes. Integrated verification: 96 focused source passed / 0 failed / 0 skipped; the same rebuilt bundle passed hidden optimizexl (153s) and model-manager-regressions (6s), 2 passed / 0 failed / 0 skipped. All thirteen owner-popup checks pass and all six 120-frame cases show zero mostly-black frames in either pane. Small evidence is retained at D:\Codex\sphereomancer-v2-owner-results\merge. No release, tag or owner installation change.

## Blockers and next action

- Owner approved merge of [PR #507](https://github.com/UnsctMagic/MDLxL/pull/507); main integration verification passed. Merge through that PR, verify online main and record the merge revision. No release or tag.
