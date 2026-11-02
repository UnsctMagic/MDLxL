# Sphereomancer v2: five presets, Add sphere/square, EMTR-style handles, no black flashing

Status: active (contract for Codex)
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
3. **Exactly these five presets, in this order.** The default is **x2 standard unit**.

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
   - **Square:** one handle per visible face center, the same circle style, resizing that face's axis around the center as now.
   - **Selecting:** clicking an outline selects that shape. The selected shape is accent-colored; the others are cyan.
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

- Changed: none yet.
- Remaining: everything above.

## Blockers and next action

- No blockers. Codex implements on `codex/sphereomancer-v2` and opens a PR into `main` with `Session: codex <task>`. Claude reviews and merges after the owner approves.
