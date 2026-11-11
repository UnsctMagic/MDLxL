# Contract 4: editor and preview fixes

Status: ready for Codex
Owner / consolidator: Codex (fix), Claude Code (contract and review)
Updated: 2026-11-11

Findings D1 to D8 of the [main review](main-review-2026-11-11.md). Read its "Rules for
every contract" first. Eight small, separate fixes; commit each on its own so one can be
dropped without the others. Map rows: "Viewport, rendering, cameras and preview",
"UV Wrapper", "Particles" (Glow Up), "Auto Corpse".

## Goal and completion criteria

1. **D1. Animated vertex preview follows the mouse** (`app/Viewport.jsx`, PR #613).
   With Animated on, a Move, Rotate or Resize of selected vertices must look on screen
   like the same gesture with Animated off: the dragged vertices follow the pointer,
   whatever pose their bones are in. The edit is still stored in the base pose. The
   billboard path in the same function already does this with
   `inverseGeosetSkinMatrix` and `modelPositions`; use that path, do not write a new
   one. With Animated off nothing changes (same values, same undo steps).
2. **D2. UV Wrapper texture for animated-texture layers** (PR #607). Where a layer's
   texture slot is keyed and the model carries no stored base value (`_MdxDefaults`,
   the case for MDL-loaded and app-made models), the rest view uses the track's first
   key, as before #607, instead of texture 0. One shared helper, used by all three
   places: `uvMaterialLayers` (`src/uv-tools.js`), `applyUVRestAppearance`
   (`app/game-preview-data.js`) and `app/uv-material-preview.js`. Do not change
   `sampleGeosetAnimation` or what other tools get from `unanimatedTrackValue` for
   Color and Alpha (MDX models with a stored base keep that base).
3. **D3. Auto Corpse cannot loop forever** (`src/corpse-geometry.js`, PR #588). The new
   wing and tail walks use the function's existing `nodeIndex` tree (`parentOf`,
   `ancestors`, children) or skip joints already visited, so a bone that is its own
   parent, or two that parent each other, ends the walk. Results for every model that
   works today stay identical.
4. **D4. Glow Up start state** (`src/glow-up.js` `glowStart`, PR #611). When the model
   already has hero glow (`hasHeroGlow`) but detection finds no pieces, Glow Up opens
   with nothing ticked, as before #611. Models with detected square glow are unchanged.
5. **D5. One View list** (`electron/menu.cjs`, PR #617; check what #623 did to it
   first). "Axis guides" comes from one shared place for the desktop menu, the in-app
   menu and the command launcher. Where axes are forced off (Animations clean preview)
   the item is absent or disabled, not a tick that does nothing. Read the View menu
   part of [MERGER_NOTES](../../MERGER_NOTES.md) before touching it.
6. **D6. FX texture fitting keeps its old click rule** (`app/UVEditor.jsx`, PR #602).
   The new "what the map shows is what commits" rule applies only when
   `wrapperControls` is set (the UV Wrapper). Other users of `UVEditor`
   (`GlobalTextureFit.jsx`) keep the earlier rule: a press that moved one pixel or
   less commits nothing. The UV Wrapper itself is owner-locked: change nothing there.
7. **D7. Rebound Shift in the 3D view** (`app/Viewport.jsx` key handler, PR #602).
   Forge part drags and hover pick previews read the lock/fine key through `dragKeys`
   like the transform drag does, including the key-change handler.
8. **D8. UV preview footer** (`app/UVWorkspace.jsx`, PR #616). The three Preview RGB
   boxes use the shared typed-number field (`useDraftNumber` in `app/Fields.jsx`:
   commit on Enter or leaving the box) and carry `data-hotkey` / `data-hotkey-manual`
   like their neighbours. The footer button uses the existing label "Hide extras" and
   its hotkey tag. All new text is in the five catalogs (already added on
   `codex/release-0.40.0`: check, do not duplicate).

Owner decisions, **do not implement**: O1 (AnimXL box-select), O2 (POSE swivel).

## Revision and local state

- Base: local `claude/main-review-2026-11-11` (`main` at `a8a4ca86`).
- Overlap: `codex/release-0.40.0` edits one label in `app/UVWorkspace.jsx` and adds the
  UV preview translations. PR #625 changed `app/Viewport.jsx` the same day: re-read the
  drag code before D1 and D7.

## Findings and decisions

- D1, read at `a8a4ca86`: in the drag start, `posedEditing = !animated && …`, so
  `poseInverses` stays empty and the world move worked out from the posed pivot is added
  to base-pose vertices unchanged; the skinned display then shows it turned by the bone.
  The task note for #613 only promises base-pose storage, not this drag feel.
- D2, script: `node D:\Claude\MDLxL-QA\2026-11-11-main-review\uv-preview\texture-fallback.mjs`
  (before: first key's texture; now: texture 0, "Team Color").
- D4, script over 794 library models
  (`D:\Claude\MDLxL-QA\2026-11-11-main-review\particles-glow\compare.mjs`): changed are
  the three Thunder Lizard creeps and `WH_WOC_KnightTzeentchSword04`.
- D3: read only; no model was built that passes every role and skin test. Build one in
  the test.
- Decision: no behaviour is redesigned here; each item restores or completes what the
  PR meant to do.

## Changes and verification

Tests to add first (each must fail on the base):

- D1: extend `test/vertex-animated-preview.electron.cjs` with a frame that turns a bone
  about 90 degrees; real mouse drag of one bound vertex to the right; its position on
  screen moves right by about the drag distance; undo restores the base pose exactly.
  Repeat once for Rotate.
- D2: `test/uv-tools.test.js`: a layer with keyed `TextureID` and no `_MdxDefaults`
  resolves to the first key's texture through `uvMaterialLayers(model, id)`; an MDX
  model with a stored base still resolves to that base.
- D3: `test/auto-corpse.test.js`: Tail bone and one Wing joint with `Parent === ObjectId`;
  `buildCorpseGeometry` returns. Then `node scripts/verify-auto-corpse.mjs` to show no
  corpse changed across the library.
- D4: `test/glow-up.test.js`: additive team-glow geoset that is not a flat square;
  `glowStart(model).origin === false` and a default `glowUp` adds no geoset.
- D5: `test/vis-mdlvis-mode.test.js`: desktop and in-app View rows match per mode.
- D6: source or packaged test driving `GlobalTextureFit` with press, 1-pixel move,
  release in Move: no change is committed. `test/uv-wrapper-isolation.electron.cjs`
  and the locked `test/uv-tools.test.js` numbers stay untouched and green.
- D7: packaged: rebind `drag.move.axisLock` to Alt; Forge part drag with Alt held is locked.
- D8: packaged: type in a Preview RGB box; the preview changes on Enter, not per key.

Run each fix's own test file plus `test/live-drag-frames.test.js`,
`test/viewport-correctness.test.js`, `test/localization-catalogs.test.js`.

## Blockers and next action

- None. On completion: status, revision and checks per item here; plain summary for the
  owner; hand back.
