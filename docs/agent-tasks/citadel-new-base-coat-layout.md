# Citadel Paint: New base coat layout and pro controls

State: ready for owner hand test; local branch `claude/paint-layout`, no PR.
Contract: [Citadel Paint design](../citadel-paint/DESIGN.md).

## What changed

- New base coat uses [paint-uv-layout.js](../../src/paint-uv-layout.js) (`paintAtlasVersion` 2).
  Edit the texture, Resize texture and Separate this part keep `createFreshPaintAtlas`.
- Controls: pen pressure, coalesced pointer samples, Smoothing, Symmetry V (mirrored
  camera), Smooth Z preview, Alt + middle/right navigation, Ctrl + right drag for
  brush size and softness, layer opacity, 1024 base coats, optional shared left/right.
- Paint runs three texels past each piece of a version 2 layout (`uvGutter`), so the
  empty gaps never show at piece edges with filtering on.

- Detail levels per selection (`preparePaintDetailChange`), heads at Most by default,
  repeated parts stack when sharing is on, compact left panel with visible layers.

## Evidence

- `test/paint-uv-layout.test.js` and the other `test/paint-*.test.js` files.
- `test/citadel-pro.electron.cjs`: real mouse and pen (CDP) input for every control.
- Art trial: two Footman and two Grunt variations painted from blank through the real
  brush handlers, 36k to 61k strokes each. Results in
  `D:\Claude\MDLxL-TestBuilds\Paint-Layout\results` (not in Git).

## Known limits

- Image use is about 50%, against about 87% for tightly hand-packed maps that also
  stack repeated parts. The gaps come from piece shapes; share left/right helps most.
- Loose small parts stay separate pieces. Stacking identical ones is not done.
- Paint past the edge reaches three texels. Gaps further out keep the base coat colour,
  so a dark base coat is the safer choice for distant game views.
- Pressure was tested with synthetic pen events. No physical tablet has been used.
- Shift-click straight lines are not available: Shift is part selection in every tool.
