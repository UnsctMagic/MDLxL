# Bitz replacement fitting

Status: ready for review; awaiting merge approval
Owner: Codex
Updated: 2026-10-28

## Request and boundary

Replace Part should measure the geometry being replaced and automatically fit the
incoming Bit to its size and position. Keep the existing workflow, bindings,
appearance, preview, selection and manual adjustment tools. No release or install.

## Implementation

Branch: codex/bitz-replacement-fit. Base: 8dc5ddfd.

- src/bits-and-parts.js positionPart measures actual vertex bounds using the
  existing updateBounds helper, scales each nonzero dimension to the selection,
  and aligns bounding-box centers through transformPart/transformVertices.
- All source geosets share one transform. Only selected target vertices determine
  the destination bounds. Vertex density and stale stored extents do not affect it.
- Zero-width source or target axes retain scale 1: a point/plane cannot define
  thickness, and a solid Bit is not collapsed. Source orientation is retained;
  this is a bounds fit, not semantic alignment or surface deformation.
- Existing normal/tangent transforms and nearest-selected-vertex binding transfer
  remain the owners. Preview and Apply consume the same fitted model.
- Updated the existing explanatory sentence and its RU/ES/ZH translations.

## Verification

- 35 focused Bitz/collection/localization tests passed, including multi-geoset and
  partial selections, stale bounds, nonuniform normals/tangents, SD/weighted
  bindings, flat/point geometry, MDL/MDX roundtrips and undo/redo.
- 57 compatibility tests passed; production build and packaging passed.
- Packaged bit-replacement test passed on the hidden Windows desktop: measured
  preview fit, preview/commit equality, camera mouse rotation, vertex Move drag,
  Cancel, RGB selection, dependency reuse, selection, undo/redo and sidebar width.
- Full source suite: 2,083 tests, zero failures; known-failure baseline check passed.
- Owner testing with authored Bits and native Warcraft III remains unexercised.

## Handoff

Push the branch and attach its PR. Await explicit merge authorization. Test app
and temporary profile were deleted; small evidence is under
D:/Codex/mdlxl-bitz-replace-fit-20261028/evidence/.
