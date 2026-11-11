# Call Upon Forge

Status: ready for owner review; local branch only
Owner: Codex, Call Upon Forge chat
Updated: 2026-11-11

## Accepted workflow

- Right-click Forge: **Enter the Forge** opens standalone Forge; **Call Upon Forge** adds its tools on the left of the existing Vertex editor.
- Owner clarified that opening imports no selection/geoset and establishes no restricted editing scope. Users freely select any editable mesh while the drawer stays open.
- Owner chose mixing both toolsets, with each operation committed through normal editor Undo. No separate whole-session draft.
- Added controls: primitive shapes, vertex/edge/face picking, Bend, Bulge/Pinch, Taper, Bevel, Twist, Extrude, Inset and equal-section Cut. Ordinary Move, Weld and Create triangle remain available in the existing sidebar.
- Preserve standalone Forge, existing viewport/camera/navigation, materials, UV streams, bindings and animation. No online publication authorized.

## Working state

- Worktree: `D:\Codex\mdlxl-call-upon-forge-20261111`, branch `codex/call-upon-forge`, base `171b8bb9`.
- `app/ForgeVertexTools.jsx`: added tools, shared Forge molding controls/handles/geometry, operation previews, vertex/edge/face picking.
- `src/forge-vertex.js`: authored mesh adapter and per-operation result; uses mesh-density stream interpolation and editor-document geometry append owners.
- Optional vertex ancestry in `forge-shape-editing.js` and `forge-molding.js` preserves SD/HD attributes through topology changes. Bevel now retains unchanged faces/triangles/normals instead of retriangulating everything.
- App/toolbar integration keeps the same Viewport mounted. Viewport supports parts drags without requiring the unrelated double-click callback, and updates only edited geoset buffers during Forge previews.
- Source tests: `test/forge-vertex.test.js`; real interaction: `test/forge-vertex.electron.cjs`.
- New shapes join the active geoset with its material and nearby vertex bindings. Edited geometry retains all UV sets, SD groups and HD skin formats; unrelated model records remain untouched. Bevel keeps the edited region selected and preserves untouched tangents.
- Opening retains camera and animation preview; active shaping displays rest geometry for its handles. Standalone detail Blend, manual cut placement and detail Mirror are not added to this toolset; ordinary Vertex Mirror remains available.

## Verification

- Baseline built before UI edits. Interaction test failed waiting for the missing `Call Upon Forge` menu item; log `out/baseline-interaction.log`.
- Focused source run: **128 passed / 0 failed / 0 skipped**. After the final selection fix, the affected **55 passed / 0 failed / 0 skipped** were rerun; other results reused unchanged. Commands:
  - `node --test test/forge-vertex.test.js test/forge-shape-editing.test.js test/forge-molding.test.js test/forge-detail-editing.test.js test/forge-cuts.test.js test/forge-clay.test.js test/forge-contract.test.js test/mesh-density.test.js test/live-drag-frames.test.js test/viewport-correctness.test.js`
  - Final affected rerun: `node --test test/forge-vertex.test.js test/live-drag-frames.test.js`.
- Compatibility: **57 passed / 0 failed / 0 skipped**, `node --test tests/*.test.js`.
- Built with `node node_modules/vite/bin/vite.js build`; packaged through `scripts/package.mjs --out out/pkg --overwrite` using cached Electron 40.8.0 on D:. Package verification: 1508 runtime/assets, 55 locales, no redundant dependencies.
- Hidden-desktop packaged suite: **7 passed / 0 failed / 0 skipped**, `node scripts/run-packaged-tests.mjs default forge-vertex,forge-molding,forge-cuts,forge-add-menu,forge-face-editing,forge-bevel-sides,single-view-vertex-move`.
- Rebuilt/repackaged after the adapter-only selection fix; affected final `forge-vertex` rerun: **1 passed / 0 failed / 0 skipped**. The six standalone/Move results are reused unchanged.
- Real clicks/drags/keys cover left toolset/same viewport, unchanged geometry on opening, all five molding tools, face picking, inset/cut/extrude, Commit/Undo/Redo, Escape/Ctrl+Z cancellation, ordinary Move while open, closing/reopening, actual Alt-drag camera rotation and standalone Forge entry. Mouse-selected authored/new vertices successfully Weld and Create triangle together, then Undo restores both operations.
- Source checks cover real Footman editing, MDL and MDX save/reopen after adding/welding/creating faces, mixed HD weights (bone IDs above 255), second UV streams, exact untouched normals/tangents, and preserved rig/animation/material records.
- Not exercised: Warcraft III, full release suite, every possible authored mesh, owner's hands-on assessment. This is a local feature change, not a release.

## Failure evidence and corrections

- Actual drag initially did nothing: `Viewport.pointerMove` set `down.traveled` only when `onDoubleClickParts` existed. Corrected that precise dependency, then verified Taper drag/Commit, Undo/Redo, adding a cube into the existing geoset, camera Alt-drag, closing tools and standalone Forge.
- Buffer regression failed on the first implementation (untouched geometry UUIDs changed). Incremental Forge previews passed the same assertion on the hidden desktop.
- Preservation assertions exposed bevel replacing untouched normals, resetting authored UVs that matched primitive icon coordinates, and recomputing untouched tangents. Each exact assertion passed after its owning correction.
- Bevel-selection assertion failed (`bevel keeps only the edited object selected`): standalone Forge's whole-shape selection meant the entire imported geoset. The adapter now maps selected ancestry back to the edited region.
- Camera comparison uses 1e-9 precision after measuring OrbitControls resize rounding at 1e-13 model units; no framing reset occurred.

## Handoff

- Code and this note are committed together locally on `codex/call-upon-forge`. No version bump, installation change, push or PR. Owner review is next; merging/releasing requires the owner's instruction.
- Source/unpushed branch, small logs and one screenshot remain under `out/`. Disposable package, dist, test profiles, task FFmpeg/runtime copies, dependency junction and scratch files were removed. No unused task app/Node processes remain.
- Reproduction dependencies: Playwright `D:\Claude\tools\node_modules\playwright-core`; Electron cache `D:\Claude\tools\cache\electron`; node_modules junction to `D:\Claude\MDLxL\node_modules`. Use Node directly for scripts in a junctioned worktree, with TEMP/TMP on D: and the shared hidden-desktop runner.
