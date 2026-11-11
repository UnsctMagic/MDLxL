# Call Upon Forge

Status: in progress — second hand-test rejected; geometry audit and visual comparison, local branch only
Owner: Codex, Call Upon Forge chat
Updated: 2026-11-11

## Accepted workflow

- Right-click Forge: **Enter the Forge** opens standalone Forge; **Call Upon Forge** adds its tools on the left of the existing Vertex editor.
- Owner clarified that opening imports no selection/geoset and establishes no restricted editing scope. Users freely select any editable mesh while the drawer stays open.
- Owner chose mixing both toolsets, with each operation committed through normal editor Undo. No separate whole-session draft.
- Added controls: primitive shapes, vertex/edge/face picking, Bend, Bulge/Pinch, Taper, Bevel, Twist, Extrude, Inset and equal-section Cut. Ordinary Move, Weld and Create triangle remain available in the existing sidebar.
- Preserve standalone Forge, existing viewport/camera/navigation, materials, UV streams, bindings and animation. No online publication authorized.

## Working state

- Worktree: `D:\Codex\mdlxl-call-upon-forge-20261111`, branch `codex/call-upon-forge`. Initially based on `171b8bb9`; rebased onto local `origin/main` at `551939ba` to reuse the current shared icon menu. Initial local commit `e8807539` became `02abda00`; the subsequent shield polish is committed with this note.
- `app/ForgeVertexTools.jsx`: added tools, shared Forge molding controls/handles/geometry, operation previews, vertex/edge/face picking.
- `src/forge-vertex.js`: authored mesh adapter and per-operation result; uses mesh-density stream interpolation and editor-document geometry append owners.
- Optional vertex ancestry in `forge-shape-editing.js` and `forge-molding.js` preserves SD/HD attributes through topology changes. Bevel now retains unchanged faces/triangles/normals instead of retriangulating everything.
- App/toolbar integration keeps the same Viewport mounted. Viewport supports parts drags without requiring the unrelated double-click callback, and updates only edited geoset buffers during Forge previews.
- Source tests: `test/forge-vertex.test.js`; real interaction: `test/forge-vertex.electron.cjs`.
- New shapes join the active geoset with its material and nearby vertex bindings. Edited geometry retains all UV sets, SD groups and HD skin formats; unrelated model records remain untouched. Bevel keeps the edited region selected and preserves untouched tangents.
- Opening retains camera and animation preview; active shaping displays rest geometry for its handles. Standalone detail Blend, manual cut placement and detail Mirror are not added to this toolset; ordinary Vertex Mirror remains available.

## Initial verification

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
- Source/unpushed branch stays in the worktree; small results remain under `out/`. Automated test packages/profiles and scratch files are disposable. User-requested visible review instances, their test models, profiles and required development bundle remain while the owner tests them; never discard their unsaved work.
- Reproduction dependencies: Playwright `D:\Claude\tools\node_modules\playwright-core`; Electron cache `D:\Claude\tools\cache\electron`; node_modules junction to `D:\Claude\MDLxL\node_modules`. Use Node directly for scripts in a junctioned worktree, with TEMP/TMP on D: and the shared hidden-desktop runner.

## Shield and toolbar polish after owner test

- Owner recording: `electron_XbzUbob0l7.gif`, 790 frames / 52.67 seconds. Matched the exact shield selection: 31 vertices / 16 triangles, centroid `(-3.2208, -26.5781, 46.5484)`. The first bevel drag moves inward and stays at zero; an outward drag later produces geometry.
- Forge now adds its two choices to AppToolbar's shared `iconMenuPopup` and uses `onIconContextMenu`, including LER/EMTR placement, focus, mutual exclusion, toggle and dismissal. Removed the separate Forge menu state and styling.
- Bevel accepts signed handle movement and uses its magnitude for width, so an inward drag works while the handle follows the mouse. Both Forge locations use the same behavior and display a positive width.
- Bevel width previously used the shortest edge anywhere in the geoset: Footman 1.055 units versus the selected shield's 6.947 units. Only edges meeting beveled corners now constrain width; the shield produces the same result before and after detaching it.
- Regression evidence: both new source assertions failed before their correction (inward drag and detached/attached width equality). The initial compiled UI failed the exact LER-style comparison. The new real-input test selects the recorded shield through actual marquees, frames and rotates to separate overlapping arm vertices, bevels inward in angled/rounded modes, commits, and undoes.
- Latest focused source suite: **130 pass / 0 fail / 0 skip**, same ten-file command above. Existing compatibility result remains applicable: codecs and format behavior unchanged.
- Packaged checks: `MDLXL_SUITE_PKG=out/shield-polish/pkg/MDLxL-win32-x64`, then `node scripts/run-packaged-tests.mjs default forge-shield,forge-vertex,forge-molding,forge-cuts,forge-add-menu,forge-face-editing,forge-bevel-sides,single-view-vertex-move,emtr-quick-options`. Final result: **9 pass / 0 fail / 0 skip**. Eight passed initially; standalone face-editing's stale top-edge assertion was corrected and its affected rerun passed. All tests used the same final build.
- That assertion expected `y=0`, but upstream `desktop-menu.css` deliberately reserves a measured 25-pixel application menu. It now verifies the exact workspace below the live menu (same width and bottom), preserving the upstream design rather than changing the UI. The original pre-menu package measured `y=0`; the integrated package measured `y=25`.
- One harness invocation pointed at the removed default package and failed before launching any app; corrected the runner's `MDLXL_SUITE_PKG` setting. It is not counted as product verification.
- Revised user test: `out/manual-forge-polish/Forge-shield-review.mdx`, with the recorded shield detached as Geoset 6 through the existing mesh owner (31 vertices / 16 triangles). Separate profile: `out/manual-forge-polish/profile`. The prior `manual-forge-test` review instance may contain unsaved work and is preserved.
- Automated test package/profiles and analysis captures removed after verification; final logs and `out/shield-polish/footman-shield-bevel.png` retained. Source changes saved locally, not online. Warcraft III and owner's acceptance remain untested.

## Second hand-test: usefulness gap, not another drag correction

- Owner still cannot bevel the shield. Current screenshot shows **Inset**, all 31 shield vertices selected, with `Inset needs faces on the same plane.` The error also reproduces on the plate alone and strap alone; they are slightly curved. The central boss is a separate closed component. Do not dismiss this as clicking the wrong icon.
- Earlier tests proved changed vertices and Undo, not a useful shield rim. The plate is an open sheet; current bevel ignores open edges and instead bevels internal facet edges and the boss. The existing numeric width checks do not establish the requested visible result.
- Close-up rendering of current whole-shield bevel also exposed notches where beveled internal plate edges meet its open border. The existing cap logic explicitly excludes original open corners. This is an observed product defect to correct, not an accepted bevel result. A new regression must measure the rim/outline and continuity, not just triangle count.
- Asked whether the owner wanted a beveled outer rim or rounded existing corners/boss. Owner requested **show both**, saying they do not yet know and simply want to bevel things. Prepared a bounded geometry comparison before any further product revision.
- `out/shield-options/shield-bevel-comparison.png` and `comparison.html` show the actual shield at identical scale, camera and lighting: original; **A**, a 3.5-unit inset band with 2.5-unit depth toward the front; **B**, the existing rounded bevel applied only to the boss (width request 3, existing limit applies). B deliberately leaves the plate unchanged; it is not the defective whole-selection output. `shield-bevel-topology.png` exposes the actual triangles. Counts: original 16, rim 30, rounded boss 164.
- Rim proof reuses `insetForgeFaces` on a projected copy of the seven plate vertices (faces 4–7 in the detached geoset), then restores original surface heights and offsets the inner cap. This is a **prototype**, not a general curved-region algorithm or shipped tool mode. Source model and all unrelated geosets remain unchanged.
- All three previews passed finite/nondegenerate triangle, edge incidence/winding, adapter conversion and source preservation assertions. Rim additionally preserves boss/strap. A headless browser rendered the self-contained HTML; actual mouse drag rotated all three linked views, Reset restored the camera within measured floating-point rounding (1e-16), and no page errors occurred. The screenshots were visually inspected. This is geometry/preview proof, **not** a packaged-app acceptance test, texture mapping validation or Warcraft III test.
- No product code changed during this comparison. The Inset restriction, open-border bevel defect and useful whole-shield workflow remain outstanding. Keep the owner's running review apps/models/profiles intact. Next product work must address these evidenced mechanisms and test the actual rim before another owner hand-test.

## Owner-requested central-piece isolation experiment

- Owner asked whether separating/removing the central piece makes shield bevel work. Used the permanent `citadel-footman` fixture through the shared helper and the existing `detachFaces` owner to prepare two copies, without deleting any geometry.
- `out/shield-isolation/Shield-center-separated.mdx`: Geoset 6 is plate plus rear strap (21 vertices / 8 triangles); Geoset 7 is the central piece. `Shield-plate-isolated.mdx`: Geoset 6 is only the plate (14 vertices / 5 triangles), Geoset 7 the central piece, Geoset 8 the strap. Total triangle count and unrelated geosets are preserved.
- **Result: the central piece is not the blocker.** On the isolated plate, Bevel at width 1 produces 11 angled / 29 rounded triangles but loses three original border corners. The actual editor confirms three notches where internal facet edges reach the open outline; no perimeter rim appears. Inset still reports `Inset needs faces on the same plane.` on both copies.
- Packaged Electron 40.8.0 using unchanged renderer code from `7a44e277` (task revision `76a72a47`). Built with `node scripts/package.mjs --out out/shield-isolation/pkg --overwrite --electron-zip-dir D:/Claude/tools/cache/electron/55dc89a7fb0948840a03fd1e4c5ff38d07d35fdbf8f351eac8f4625ca2004876`; 1513 runtime/assets verified, 55 locales. Shared `scripts/hidden-run.ps1` plus `test/helpers/app.cjs` ran real menu clicks, geoset selection, Ctrl+A, normal Alt-drag rotation, Bevel/Inset handle drags, Commit, Undo and Cancel.
- Two diagnostic UI cases completed, 0 harness failures / 0 skips; **both fail the desired useful rim outcome**. Plate-only UI bevel width 1.48164 yields 11 triangles; no-middle width 1.53249 yields 17. Unselected geosets, including the detached central piece, stay unchanged. Captures `plate-before.png` and `plate-bevel.png` were inspected. The first capture used Front, which saw the one-sided plate from behind; final capture uses Left via the normal view menu so the surface and notches are visible.
- Small source/UI results and renderer hashes are in `out/shield-isolation/source-results.json`, `interaction-results.json`, and `interaction.log`. Disposable package, profiles, scratch scripts and runtime temp files removed; requested model copies retained. No product code changed or online publication occurred. The existing owner review apps were not touched.
