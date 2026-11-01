# Library: World Editor Style for textures

Status: ready to test; ready for review; awaiting merge approval
Owner / consolidator: Codex (build); Claude Code (review and contract)
Updated: 2026-11-01

## Goal and completion criteria

The owner, 1 November 2026: give textures in the Library the World Editor view as
well, just like models.

Done means the owner can do this without reading anything:

1. Open the Library (`LIBR`) on **Textures**, or any texture picker (UV Wrapper
   *Replace Texture…*, Material Manager import, EMTR *Use picture*, Forge, Citadel Paint).
2. See the same **Standard · World Editor Style** buttons the Models tab has.
3. In World Editor Style, open Human › Units › Normal and click *Footman*.
4. The grid shows the Footman's textures as the usual tiles. Clicking one shows the
   usual details, and **Add texture to model**, **Preview Texture in Editor** and the
   picker button work exactly as they do now.

Scope: the texture view in [TextureLibrary.jsx](../../app/TextureLibrary.jsx) (the
full Library's Textures tab and the pickers, which use the same view). The Models,
Sounds and All files tabs, the Standard texture layout, vibe search, the material
choice popup and every picker action stay exactly as they are. No new panels, no new
windows. AGENTS.md "One way of doing things": this is the Models tab's control,
reused as it is.

## Revision and local state

- Base: `main` at `f3cbd71d`.
- Contract branch: `claude/library-textures-we-contract` (documentation only).
- Map row: "Library: game files (models, sounds, all files), World Editor view…" in
  [agent-map.md](../agent-map.md); guide [GAME-FILE-LIBRARY.md](../GAME-FILE-LIBRARY.md).

## Relevant owners (at `f3cbd71d`)

- [GameFileBrowser.jsx](../../app/GameFileBrowser.jsx): the Models tab's layout
  buttons (`gf-style`, `mdlvis.game-files.style`), `worldEditorTree` (one tree per game
  version and signature), `FOLDER_ICONS`, `GameIcon`, the World Editor `rows` walk,
  `toggle`, the name search (`visit`), arrow-key handling (`keys`) and `loadGameModel`
  (reads a model and resolves its `Textures[].Image` with `gameFilesResolve`, own
  module first).
- [world-editor-catalog.js](../../src/world-editor-catalog.js): `buildWorldEditorCatalog`.
  Leaves carry `id`, `name`, `icon` (the `Art` button) and `models[]` (`label`, `path`).
  Spells list every art model; doodads list every variation.
- [TextureLibrary.jsx](../../app/TextureLibrary.jsx): the texture view. Left
  `tl-folders` (`FolderBranch`, `textureFolderTree`), centre `tl-grid` of `TextureTile`,
  right `tl-details`. Catalogue items carry `path`, `variant`, `cacheKey`.
- [texture-library-search.js](../../src/texture-library-search.js): `filteredSource`,
  `textureFormatMatches` (BLP only).
- IPC used today: `gameFilesWorldEditorSources`, `gameFilesFindPath`, `gameFilesReadPath`,
  `gameFilesRead`, `gameFilesResolve`.

## Requirements

**R1. Same buttons, same place.** Above the texture folder list, show the Models tab's
`gf-style` group: **Standard** and **World Editor Style**, same look, wording and
tooltips. The choice is remembered for the texture view (own key, e.g.
`mdlvis.texture-library.style`) and defaults to **World Editor Style**, as on the Models tab.
The full Library's Textures tab and every picker show it.

**R2. Same tree.** World Editor Style replaces the folder list with the Models tab's tree:
the same races, Units/Buildings/Spells, Items, Doodads by tileset, the same game icons,
row height, twisties and counts. Clicking a folder only opens or closes it. Arrow keys,
Right/Left behave as on the Models tab. Take the tree, its cache and its icons out of
`GameFileBrowser.jsx` into one shared piece that both tabs use. Do not copy it. The Models
tab must look and behave exactly as before. The tree is built once per game version and
shared between both tabs.

**R3. An entry shows its textures.** Clicking an entry (or stepping onto it with the arrow
keys) fills the grid with that entry's textures:
- every `Textures[].Image` of every model on the entry (all spell arts, all doodad
  variations), resolved for the chosen version the way `loadGameModel` does (own module
  first, then the base game);
- then the entry's own icon (`Art`);
- no duplicates, in that order;
- textures without a file (`ReplaceableId` team colour/glow, empty `Image`) are skipped.

Read only the model's texture list for this. Do not build a 3D preview. Cache the list per
entry and version for the session. Older clicks must not overwrite a newer one.

**R4. Same tiles, same actions.** Each texture is matched to its texture-catalogue item
(normalised path + version) and shown with the existing `TextureTile`, thumbnail cache,
details panel, *Copy texture path*, **Add texture to model** / **Preview Texture in Editor**
/ picker button and the "Texture already in the model" choice, all unchanged. A texture
the game lists but the catalogue does not have is named in one closed
"*n* textures not found" line under the grid, like the Models tab.

**R5. Toolbar in World Editor Style.**
- The search box searches World Editor names like the Models tab: same matching and
  placeholder. A result row in the tree works like any other entry.
- **Vibe search** and the Kind menu are hidden. They return unchanged in Standard.
- **BLP only** still filters the tiles.
- The Source menu offers only Classic, Reforged and Forsaken Kingdom, like the Models tab
  (`SKIN`). Model-folder textures stay in Standard.

**R6. Smallest indicator.** Status line: "*n* textures · *entry name*". Before a click, the
grid shows one line: "Choose a unit, spell, item or doodad to see its textures."
Loading shows the existing "…" tiles, not a new spinner. Translate new strings the way
the view's existing strings are translated.

**R7. Fast.** The tree opens with no visible wait once the Models tab has built it, and
in at most the Models tab's time when it has not. Clicking an entry shows its tiles in
under 1 s on the owner's PC (cached models instantly). Scrolling the tree stays
virtualized.

**R8. Standard unchanged.** Standard is today's texture view, byte for byte in behaviour:
folders, vibe search, kinds, art search, Model folder, Show more.

## Acceptance (packaged app, hidden desktop, real mouse and keyboard)

| ID | Do | Pass |
| --- | --- | --- |
| T1 | Fresh profile → Library → Textures | World Editor Style pressed. Tree matches the Models tab (same top-level folders and icons). Grid shows the R6 line. |
| T2 | Human › Units › Normal › Footman | Tiles = the Footman model's texture list (compare with `openDocument` of the model) + its icon, no duplicates, no team colour. |
| T3 | Click a Footman texture → Add texture to model | Same result as adding the same texture from Standard (compare model before/after). |
| T4 | A spell with several arts (e.g. Blizzard) and a doodad with variations | Textures of all arts / all variations appear once each. |
| T5 | Switch Source to Reforged, click Footman | The Reforged textures (`_hd` module) are shown, and the thumbnails are Reforged. |
| T6 | Search "footman" | Footman entries listed. Click one, and T2's tiles appear. Vibe search and Kind are hidden. |
| T7 | Arrow down through five units | The grid follows each step. A fast step leaves the last unit's tiles, not an earlier one's. |
| T8 | Tick BLP only on an entry with DDS textures | DDS tiles disappear. |
| T9 | UV Wrapper → Replace Texture… → World Editor Style → pick a texture → use it | Works like the same pick from Standard. |
| T10 | Press Standard, close, reopen | Standard remembered. Standard view and its tests unchanged. Models tab layout choice is unaffected (own key). |
| T11 | Models tab after this change | Tree, icons, search, double-click open, geoset box unchanged (existing Electron workflow passes). |

Record screenshots of T1, T2 and T5 in the PR. Owner click-through for `ready to test`:
Library → Textures → Human → Units → Normal → Footman → click a texture → Add texture to model.

## Tests and docs

- Unit test the entry → texture list helper (order, dedupe, skipped replaceables, icon last,
  version mapping) next to [world-editor-catalog.test.js](../../test/world-editor-catalog.test.js).
- Extend [game-file-library.electron.cjs](../../test/game-file-library.electron.cjs) with T1–T3,
  T6, T9, T10. Run `pnpm test`, the focused source tests from the map row, and the packaged
  Library workflow. Run only failed and related tests after fixes.
- Update [GAME-FILE-LIBRARY.md](../GAME-FILE-LIBRARY.md) ("Two ways in" / a short Textures
  bullet) and the map row.

## Implementation and verification

- Branch: `codex/library-textures-world-editor`, from current main `b2365c65`
  (contract PR #499 is merged; original contract base `f3cbd71d`).
- Implementation complete. PR/revision are recorded in the review handoff below.
- Durable ownership: [GAME-FILE-LIBRARY.md](../GAME-FILE-LIBRARY.md).
- [Verification and T1/T2/T5 captures](../../test/evidence/library-textures-world-editor/README.md):
  57 compatibility + 50 focused source tests; 31 named packaged checks across
  the contract/existing workflow phases; T1–T11 passed, 0 failed, 0 skipped.
  Both phases ran on the hidden desktop against the same final bundle.
- Footman: 73 ms first click, 42 ms cached. Multi-art Dispel Magic and
  four Mushrooms variations verified; Reforged Footman has 24 resolved textures.
- Fail-first: missing World Editor Style button on main `b2365c65`; metadata
  lookup failed `0 !== 1` on the old resolver. Baseline packaging also proved
  the two global info-message assertions stale: App's unchanged `say` suppresses
  success messages. Tests now assert the actual preview/material/model effects.
- Next: owner click-through below and independent Claude QA. No merge or release
  without explicit owner authorization.

Owner click-through: Library → Textures → Human → Units → Normal → Footman →
click a texture → Add texture to model.

## Review handoff

PR and implementation revision: prepared after the verification commit.
