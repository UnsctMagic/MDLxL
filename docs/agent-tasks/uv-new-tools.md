# UV Wrapper: six new tools

State: built and tested on local branch `claude/uv-new-tools`, rebased on `main` 0f8e4d99
(the PR #656 layout: projection row without title, map tools in the title bar). Not online.
Owner: Claude Code. Test tier: new feature (tests prove each tool + source suite).

## Owner request (15 Nov 2026, exact words)

> Box projection and Cylinder (add it next to projection)
> Straighten
> Mirror Copy
> Unwrap
> Relax
> we have space for new tools so add them there

Chosen from this list Claude gave the owner the same day: Unwrap "select a part and
it gets laid flat with no overlaps; it can work out where to cut by itself"; Relax
"select a crumpled piece and it smooths out until the triangles stop overlapping";
Box projection "projects from all 6 sides at once, so each face uses the side it
points to"; Cylinder projection "wraps around like the label on a can" (arms,
legs, handles, ropes); Straighten "lines the selected points up in a straight row or
column"; Mirror copy "copies one half's UVs onto the other half".

## Where they go

- **Projection** box (right column, under the live preview): `Box Projection` and
  `Cylinder Projection` buttons right after `Project from Current View`, same
  button style. Both read the live preview's current view, exactly like Project
  from Current View (Standard… / Angled… set that view first).
- **Tools** box: `Straighten`, `Mirror Copy`, `Unwrap`, `Relax` as four more
  tool buttons in `uv-tool-grid`, after Fold, each with its own `uv_*` icon drawn
  in the existing UV icon style. No new panel, no other layout change.
- Each button has a short plain-language tooltip (AGENTS.md: names and functional
  labels only, no flavour text). New text is added to all five locale files.
- Hotkeys follow the existing UV Wrapper button pattern (no hand-picked default keys).

## Rules shared by all six

- Work on the UV Wrapper's current selection on its combined canvas
  (`combineSelectedUVGeosets`), commit as one labelled undo step, keep the camera
  and the UV view where they are (no fit/frame).
- The selected points stay selected afterwards, including any new copies.
- Selected points with the same UV spot and the same 3D position (seam duplicates)
  move together.
- A button is disabled when its selection rule is not met; errors use the
  workspace's existing warning line.
- Box, Cylinder and Unwrap work on **whole selected triangles** (all three corners
  selected). They may give a point a copy where its triangles need two different
  UV spots (the model can store one UV per point). Copies are made only where
  needed and copy every point attribute, the same way `uncoupleUVVertices` does,
  so the 3D model looks unchanged. 65,536-point geoset limit: same error as Uncouple.
  Like Uncouple they are disabled while an unsaved test texture exists.
- Straighten, Mirror Copy and Relax only move UVs (no new points).

## Each tool

1. **Box Projection.** Each whole selected triangle goes to the side its normal
   points to most, in live-preview view space: front, back, left, right, top,
   bottom. Each side is projected flat from that side at the same scale Project
   from Current View uses. The six sides are laid out as an unfolded box: front in
   the middle, right to its right, back to the right of that, left to the front's
   left, top above the front, bottom below it, sized from the selected points'
   bounding box in view space so shared edges of a box shape touch. The whole
   layout is centred on the selection's current UV centre (same anchoring as
   `projectUVFromView`).
2. **Cylinder Projection.** Axis: the live preview's screen vertical through the
   centre of the selected points' view-space bounding box. U = angle around the
   axis times the average radius (keeps 3D proportions), V = height, same scale as
   Project from Current View. Front faces the middle; the seam sits directly
   behind, away from the viewer. Triangles crossing the seam get copies on one side.
   Centred on the selection's current UV centre.
3. **Straighten.** If the selected points are wider than tall, they become a row
   (every V set to their average V); otherwise a column (every U set to their
   average U). The other coordinate is unchanged.
4. **Mirror Copy.** The selected points are the source. Every source point's
   mirror point, among the UV Wrapper's other (unselected) points, gets the
   source's UV. The mirror plane is picked automatically: of the three model axes,
   the one with the most matches, through the middle of the UV Wrapper's points on
   that axis. Match tolerance: 0.1% of those points' bounding-box diagonal
   (at least 0.0001). When a position has several points (seams), pick the one whose
   triangle mirrors the target's triangle. Points on the plane stay. If nothing
   matches: "No mirror points found among the UV Wrapper's points."
5. **Unwrap.** Whole selected triangles, connected through 3D positions (points at
   the same position count as one, so existing UV splits and hard edges do not cut).
   Each connected piece is flattened with LSCM (least-squares conformal map),
   pinning the two boundary points farthest apart. A piece with no open edge is cut
   along its outline as seen from the live preview: triangles facing the viewer
   make one piece, the rest another, laid to its right with a gap of 5% of its
   width. Then: scale so UV area equals 3D area at the Project from Current View
   scale; rotate (never mirror) to best match the same points' Project from Current
   View layout, so up on screen is up on the texture; each piece centred where
   Project from Current View would put its points; all of it anchored on the
   selection's current UV centre. Points sharing one 3D position get the same UV
   (no copy), except along a closed piece's cut, where copies are made.
6. **Relax.** Selected points move; unselected points stay. Selected points on the
   selection's outer edge also stay: a point of a triangle that is not fully
   selected, or on an open UV edge (edge used by one triangle). Each remaining
   point is solved to the mean-value-weighted average of its UV neighbours
   (weights from the 3D triangle angles), which straightens out overlaps inside a
   fixed outline. Gauss–Seidel until the largest move is below 1e-7 UV or 5000
   sweeps. If no selected point is free, show "Relax keeps the selection's outer
   edge in place. Select more than the edge."

## Files

- Algorithms: new `src/uv-unwrap.js` (Box, Cylinder, Unwrap, corner-UV splitting)
  and `src/uv-tools.js` (Straighten, Mirror Copy, Relax), plain functions on the
  combined canvas, unit-tested in `test/uv-new-tools.test.js`.
- `combineUVGeosetsBySet` may add a `faceStarts` field (additive) so per-corner
  results map back to each geoset.
- UI: `app/UVWorkspace.jsx`, `src/uv-tool-state.js`, UV icons in `app/ToolIcon.jsx`.
- Point-adding commits: a new App handler next to `uncoupleUVSelection` in
  `app/App.jsx`, passed through `app/AppPanels.jsx`; it keeps the selection and
  adds created copies to the UV working selection.
- Packaged test: `test/uv-new-tools.electron.cjs` (real clicks on the six buttons,
  checks the UVs and one Undo per tool).

## Status

- [x] Algorithms + unit tests
- [x] Buttons, icons, tooltips, locales, wiring
- [x] Packaged test, source suite vs `.github/known-test-failures.txt`
- [x] Test build `TestBuilds\uv-new-tools`, hidden click smoke, `TEST UV TOOLS 01.mdx`

## Results (16 Nov 2026)

Placement on the #656 layout: Box Projection and Cylinder Projection follow Project
from Current View in the projection row (the row wraps onto a second line when the
right column is narrow); Straighten, Mirror Copy, Unwrap and Relax follow Fold in
`uv-tool-grid` with icons `straighten`, `mirrorCopy`, `unwrap`, `relax` (ToolIcon,
mapped as `uv_*` in ModernIcon). Manual hotkeys: `uv-wrapper:box-projection`,
`uv-wrapper:cylinder-projection`, `uv:straighten`, `uv:mirror-copy`, `uv:unwrap`,
`uv:relax` (no default keys; manifest regenerated). Button rules
(`src/uv-tool-state.js`): Box, Cylinder, Unwrap need a whole selected triangle and no
unsaved test texture; Relax a whole selected triangle; Straighten two points; Mirror
Copy a selected point and at least one unselected UV Wrapper point.

Deviations from the plan above, each because the plan failed on the real Footman:

- **Unwrap cuts more than closed pieces.** Plain LSCM folded 20 of 288 body
  triangles and, on an open tube (an arm), folded triangles with a 25,000:1 area
  spread. A piece is now cut along its outline in the live preview (front-facing
  part, the rest to its right with the 5% gap) when it has no open edge, more than
  one outline loop (a tube, a piece with holes) or folded triangles after LSCM. A
  part of that cut that still folds is cut once more by the box side its triangles
  face (Box Projection's sides), each laid flat and centred where Project from
  Current View puts it. Result: 0 folded triangles on all five Footman geosets in
  four views; tubes unroll with even triangle sizes. Pieces are joined through
  shared edges (two shared positions), not a single shared point.
- **Mirror Copy also looks for the model's own mirror plane.** The middle of the
  Footman body's points on Y is -5.9 (arm and shield pose); its symmetry plane is
  0.55 (161 point pairs), so the planned plane matched nothing. Each axis now also
  tries the plane most pairs of UV Wrapper points are centred on; the plane with
  the most matches wins (the middle first on ties).

Known gaps: separate Unwrap pieces are centred where Project from Current View puts
them, so pieces that overlap in that view (front and back of a body that are not
one closed piece) can overlap in UV. Cylinder Projection flips triangles that face
the axis (inherent). Box and Cylinder use each triangle's winding for its normal.
Not verified: the owner's judgement by eye, Warcraft III itself.

Checks run on the rebased branch (Windows, Node 22):

- `node --test test/uv-new-tools.test.js test/uv-tools.test.js`: 28 pass, 0 fail.
  Fail-first: on `main` 0f8e4d99 the new file fails to load (`src/uv-unwrap.js` missing).
- `node --test test/localization-*.test.js`: 34 pass; `test/hotkey-*.test.js`: 48 pass;
  `test/ui-primitives.test.js` and the other UVWorkspace source checks pass.
  `test/uv-tool-state.test.js` and `test/localization-catalogs.test.js` sizes gained
  the new keys and texts.
- `node --test tests/*.test.js`: 57 pass, 0 fail.
- Full source suite `node --test --test-concurrency=4 test/*.test.js`: 4043 tests, 4033
  pass, 0 fail, 10 skipped (the usual opt-in and private-model skips);
  `.github/known-test-failures.txt` lists nothing. Two earlier runs at the default
  concurrency, while other sessions loaded the PC, lost test processes to out-of-memory
  aborts, one `spawn UNKNOWN` and one hung AI-questions agent; each of those files
  passes when rerun (158 tests, 0 fail), and the first run's seven also pass on `main`.
- Packaged (`out/pkg`, hidden MDLxLTests desktop): `node scripts/run-packaged-tests.mjs
  default uv-new-tools,uv-controls,uv-wrapper-layout,uv-zoom-collapse,uv-rotate-steady`:
  5 pass. `uv-new-tools` (79 checks) clicks each button on the Footman body, compares
  every UV with the src functions under the live view, checks 3D unchanged, the
  selection keeps its points plus the copies, no folded triangles (Box, Unwrap),
  camera and UV view unchanged, one Ctrl+Z per tool, Mirror Copy after a marquee on
  the Box Projection's left island. Fail-first: against a package of `main`
  0f8e4d99 it fails waiting for the `Box Projection` button.
- Test build `D:\Claude\MDLxL\TestBuilds\uv-new-tools\MDLxL-win32-x64\MDLxL.exe` with
  `D:\Claude\MDLxL\TestBuilds\test-models\TEST UV TOOLS 01.mdx` (Footman copy; its
  textures were already beside it). Hidden click smoke on that package: all six
  buttons clicked once and each changed the model, UV Wrapper closed, no error
  screen, no page or console errors, model file unchanged.
