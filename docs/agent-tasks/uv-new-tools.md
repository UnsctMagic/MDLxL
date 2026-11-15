# UV Wrapper: six new tools

State: in progress on local branch `claude/uv-new-tools` (from `main` a7c5ed17).
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

- [ ] Algorithms + unit tests
- [ ] Buttons, icons, tooltips, locales, wiring
- [ ] Packaged test, source suite vs `.github/known-test-failures.txt`
- [ ] Test build `TestBuilds\uv-new-tools`, hidden click smoke, `TEST UV TOOLS 01.mdx`
