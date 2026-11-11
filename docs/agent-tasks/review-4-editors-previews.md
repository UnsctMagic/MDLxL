# Contract 4: editor and preview fixes

Status: completed locally, ready for Claude Code review
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

Not part of this contract: O1 (AnimXL box-select; the owner keeps today's behaviour)
and O2 (POSE swivel; still open with the owner). Change neither.

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

Implementation tip: `0ffa02d4` on `codex/main-review-20261111-4`. The eight fixes
are separate commits for Claude's review.

| Finding | Revision | Reproduced on the old code and checked after the fix |
| --- | --- | --- |
| D1 | `2e97b1f4` | On `4340c5f8`, the real 18 px right, 5 px down drag moved the frozen vertex 5 px right and 18 px up. `vertex-animated-preview.electron.cjs` passes Move, Rotate, Resize, base-pose commit, exact undo, and mouse orbit. `billboard-vertex-drag.electron.cjs` passes normal and quad drags. Animated edits use the existing skin inverse and base-position payload. Singular poses keep the prior fallback. |
| D2 | `4b260d01` | The old MDL-style layer showed Team Color instead of Body.blp. `uv-tools.test.js` now checks the first authored key, a preserved MDX base of zero, and the renderer clone. The UV backdrop already calls `uvMaterialLayers`, so it shares the same fallback. |
| D3 | `536a9a5f` | Both the self-parented and two-node Tail cycles timed out after 5 seconds on `4340c5f8`. Both now finish. The real malformed dragon retains the other wing. `auto-corpse.test.js` passed all 40 cases. |
| D4 | `b1cc22de` | Origin glow was selected on the native Thunder Lizard even though its non-square glow was already authored. `glow-up.test.js` and `glow-non-square.electron.cjs` pass with both additions off. `glow-detection.electron.cjs` passes both existing eye-effect workflows. Tiny square eye effects still leave the weapon picker available. |
| D5 | `40304fc4` | The desktop list injected an Axis guides row missing from the browser list, and its Animations row did nothing. The initial shared-list fix still offered a live toggle in Movement's portrait camera, which also hides axes. `vis-mdlvis-mode.test.js`, `herrdave-shell.test.js`, and `axis-guides-menu.electron.cjs` pass View parity, the Vertex toggle, clean Animations, and the disabled portrait-camera row. |
| D6 | `d70747e8` | One pixel changed the Footman FX texture fit on `4340c5f8`. `fx-uv-click-threshold.electron.cjs` proves one pixel leaves it alone and a deliberate drag still commits. `uv-wrapper-isolation.electron.cjs` and the existing locked UV numbers pass. |
| D7 | `0ffa02d4` | A real rebound Alt press left the Forge cut hover unsnapped on `4340c5f8`. `forge-detail-editing.electron.cjs` passed with default Shift and again with `MDLXL_TEST_FORGE_REBOUND=1`. It checks Alt before placement, mid-drag, and on release while the mouse stays still. |
| D8 | `319e9194` | The sampled tint changed before Enter on `4340c5f8`. `uv-preview-visibility.electron.cjs` checks unchanged tint while typing, commit on Enter and blur, actual saved shortcuts for red and Hide extras, reset, authored data, and mouse orbit. Reused the four preview text entries from `07accd24` in all five catalogs. |

- Source command passed 166 tests, with zero failures or skips:
  `node --test test/uv-tools.test.js test/uv-preview-display.test.js test/auto-corpse.test.js test/glow-up.test.js test/vis-mdlvis-mode.test.js test/herrdave-shell.test.js test/live-drag-frames.test.js test/viewport-correctness.test.js test/localization-catalogs.test.js test/hotkey-default-overlaps.test.js`.
- Ran `node scripts/audit-corpse-decay.mjs "D:\Warcraft III" out/corpse-corpus`.
  Ran `node scripts/verify-auto-corpse.mjs out/corpse-corpus <report>` with base
  and fixed sources. Both reported 96 passes, zero failures, and four exclusions.
  Frost Wyrm, Red Dragon and Red Dragon Whelp shrink away at the terminal Death
  frame. Wisp is a documented effect death. Both reports match field for field
  after removing elapsed time.
- Built with `node node_modules/vite/bin/vite.js build --configLoader runner`.
  Packaged with `node scripts/package.mjs --out out/<package> --electron-zip-dir <local cache>`.
  Ran the named Electron scripts directly with `MDLXL_TEST_EXE` and
  `scripts/hidden-run.ps1`. Ten focused runs passed, with zero skips. Reused
  earlier package results for Animated, billboard drag, FX, Forge, and UV RGB
  because the later renderer change affected only View availability and Glow Up.
  Warcraft III gameplay was not exercised.
- Prepared two real fixtures in the permanent test-model collection. The Khorne
  Knight came from an existing local copy with the expected looped effect. The
  Thunder Lizard came from the local Warcraft III CASC audit.
- Removed disposable packages, profiles, extracted models and builds. The
  source and interaction logs and the two corpse reports remain in `out`.

## Owner summary

Animated vertices now follow the pointer while edits still save in the base pose.
UV shows the authored rest texture and applies preview RGB on Enter or when the
field loses focus. FX ignores a one-pixel wobble, Forge uses the rebound drag
key, and Axis guides can be toggled only where the view can display them. Auto
Corpse finishes with cyclic bone links, and Glow Up leaves an existing non-square
glow alone by default.

## Next action

Claude Code can review the eight local commits on this branch. Saved on your PC,
not online.
