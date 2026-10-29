# Library: game files, art search and material choice

## Two ways in

- **Library button** (toolbar `LIBR`, Modules › Material and Texture Library):
  the full *Warcraft III Library* with tabs **Textures · Models · Sounds · All files**.
  The last tab is remembered.
- **Pickers** (UV Wrapper *Replace Texture…*, Material Manager import, EMTR
  *Use picture*, Forge, Citadel Paint): the unchanged *Material & Texture
  Library*, textures only, no tabs. `openLibrary(preview, full)` in
  [App.jsx](../app/App.jsx) passes `full` only from the Library button/command.

The full Library declares `data-hotkey-scope="library"` so global shortcuts such
as Escape → *Clear vertex selection* do not swallow its keys; pickers keep their
existing hotkey behaviour.

## Game-file browser

- [CascBridge.cs](../electron/CascBridge.cs) `@files` lists every named CASC file
  with its content key and size (helper `CascBridge-0.9.0.exe`, see
  [PROVENANCE](../electron/casc/PROVENANCE.md)). `CascTextures.listFiles` caches
  it per installation/build as `<install>.files.json` in `profile/native-textures`.
- [game-file-library.cjs](../electron/game-file-library.cjs) indexes one
  installation (Settings folder first): ~175k files on 3.0.1, first open ~2 s,
  cached ~0.8 s, folder browse ~30 ms, search ~10 ms. Files are grouped by their
  logical game path (`Units\Human\Footman`), casing learned from the reviewed
  texture catalogue. Version filter matches the texture library: Classic (base,
  installed language, tilesets, balance), Reforged (`_hd`), Forsaken Kingdom
  (`_de`), Other languages, Teen & retired, All installed.
- IPC `gameFiles:summary|browse|read|resolve|export`; reads always use the listed
  content key. Model textures resolve from the model's own module first
  (Reforged/Forsaken Kingdom), then the base game. Forsaken Kingdom inherits
  missing pictures from Reforged before falling back to Classic. Authored TIF
  paths resolve to the installed DDS/BLP assets without rewriting the model.
- HD previews retain their original format and view-only editing restrictions.
  The preview adapter repacks MDX 1400+ uint16 skin streams into private GPU
  buffers with the original indices and byte-scale weights. Shader type 0
  continues through the existing Classic-material adapter in mixed HD models.
  The DDS decoder supports the installed ATI2/BC5 normal maps and reconstructs
  their third normal component. No HD editing tools or save support are added.
- [GameFileBrowser.jsx](../app/GameFileBrowser.jsx): icon tree on the left
  (virtualized; clicking a folder only opens or closes it), one central view,
  slim info panel on the right (name, path, version, animation, Open in editor,
  Copy path, Save a copy). Arrow keys step through rows, Right/Left open and
  close folders, Enter or double-click opens a model in the editor (a
  double-click on a model still loading opens it when it arrives).
- **Models tab, two layouts** (buttons above the tree, remembered):
  - *Standard*: the game folders as stored; model files show their unit icon
    when the World Editor tables know them; textures show their own thumbnail.
  - *World Editor Style* (default): [world-editor-catalog.js](../src/world-editor-catalog.js)
    builds the tree from `unitui/unitdata.slk`, `unitskin.txt`, `abilitydata.slk`,
    `abilityskin.txt`, `itemdata.slk`, `itemskin.txt`, `doodads.slk`,
    `doodadskins.txt`, `destructabledata.slk`, `destructableskin.txt`,
    `worldeditdata.txt`, the old `*func.txt` tables as fallbacks, and the
    installed language's strings: race (Human, Orc, Night Elf, Undead, Naga,
    Neutral Hostile, Neutral Passive) › Units (Normal, Heroes, Campaign,
    Campaign heroes, Special) / Buildings (Normal, Campaign) / Spells (Normal,
    Heroes); Items by class plus item abilities; Doodads by tileset › category,
    with destructibles, and every-tileset doodads in each tileset. Every entry
    keeps its game icon (`Art`, shown only in the tree) and models; spells list their Caster/Target/
    Effect/Missile/Area/Special art, doodads their variations. Skin fields are
    read per version (`Art:sd`, `file:hd`, `file:de`). Entries hidden from the
    editor, and entries without a model, are left out. The tables are read by `gameFiles:worldEditorSources`;
    `gameFiles:findPath`/`readPath` resolve the game paths per version.
- **Camera**: one `GamePreview` stays mounted (`glideCamera`,
  `fitSequenceExtent`). A newly picked model replaces the old one once loaded;
  the camera keeps its turned angle and eases over 450 ms to frame the new model
  using the playing animation's own extents (×1.3), so hidden portrait/birth
  geometry (e.g. the Altar of Kings' portrait backdrop) does not shrink it.
  Grabbing the camera stops the glide. The destination is read on the first
  glide frame, when the new animation choice has arrived.
- **Geoset box** ([LibraryGeosets.jsx](../app/LibraryGeosets.jsx)), under the
  animation controls: the vertex editor's numbered list with click, shift and
  ctrl selection (All, Clear, Invert), *View selected only* (isolates the checked
  geosets in the preview), *Highlight Geoset* (on by default; like the vertex
  editor it outlines the geoset under the mouse in the preview and the list), and, acting on the
  Library's own copy of the model without selecting vertices:
  *Seperate by Loose parts* and *Nuclear Seperation* (`geoset-operations.js`,
  every vertex of each checked geoset), *Import to current* (`collectPart` →
  App `importPart`, the BitsAndParts path: geometry on DummyBone, textures,
  materials and animations carried; the Library stays open, `keepOpen`) and
  *Open in editor* (a new tab with only the checked geosets; untouched whole
  models open from their original bytes). Edits on the copy rebuild the
  preview without moving the camera (`glideKey` only changes with the model).
  Parts in another model format are converted like a paste (`adaptPasteFormat`
  in `commitPart`, for BitsAndParts too): the game's classic models are MDX 1000
  and import into MDX 800 models with Classic geometry and diffuse materials.
  Results and errors appear under the buttons.
- CASC installs only (1.30+). MPQ-only installs show the "choose your folder" note.
  Files over 64 MiB cannot be read by the helper.

## Painting / art search

[texture-library-art.js](../src/texture-library-art.js): vibe searches for
*painting(s), artwork, illustration, drawing, concept art, key art, loading
screen* (and *art* on its own) show only illustrations; remaining words filter
them (`orc painting`, `painting ashenvale`). Kind menu: *Paintings & art*.
Included: classic loading screens and campaign maps, Reforged loading screens,
campaign key art, menu/splash backgrounds, victory/defeat screens, concept art,
the painted day/night dial, and reviewed catalogue entries tagged as painted
artwork. Excluded after inspection: skins, icons (including score-screen hero
icons), map symbols, UI frames and `webui\portraits` (3D renders). Bare *art*
with other words stays a name fragment (`art clo`, `undead art` → Arthas).

## Texture already in the model

Add or Preview of a texture already in the model pops up a small choice over
the library: one button per material that shows it (*Material 12 · geoset 18*)
and *New material*; one click decides. When no material shows it, Preview
goes ahead without asking and Add makes a new material. Helpers in [uv-preview.js](../src/uv-preview.js):
`existingTextureIndex`, `materialsUsingTexture`, `addTextureMaterial`; UV drafts
carry `material` (index or `'new'`), honoured by `applyUVPreviews` and recovery.

## Verification

- `test/hd-library-preview.electron.cjs` uses an isolated hidden packaged app
  (`MDLXL_PACKAGED_EXE`, `MDLXL_PLAYWRIGHT_MODULE`) and installed Classic Footman,
  Forsaken Kingdom Peon and Reforged Blademaster: textures, Stand/Walk/Attack,
  real mouse rotation, original-format editor opening and view-only restrictions.
  Popcorn/external event effect rendering remains a separate capability.
- `node --test test/game-file-library.test.js` (index, search, resolve, art
  rules, material choice).
- `node --test test/world-editor-catalog.test.js` (races, units, spells, items,
  doodads, per-version skins, function-table fallbacks).
- `test/game-file-library.electron.cjs` (needs Warcraft III; `MDLXL_PACKAGED_EXE`
  for a package, `MDLXL_TEST_THEME=dark`): picker unchanged + material choice,
  painting search, new material, World Editor tree with loaded icons, folder
  clicks leave the view unchanged, real mouse-drag rotation, glide to a larger
  model (frames saved), chest framing distance, spell/doodad/item search,
  Standard tree icons, double-click opens in the editor, geoset box (View
  selected only, both separations, Import to current on DummyBone, Open in editor
  with only the checked geosets), sound playback, arrow
  keys, text view, Escape, screenshots.
