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
  (Reforged/Forsaken Kingdom), then the base game.
- [GameFileBrowser.jsx](../app/GameFileBrowser.jsx): folder tree, list (arrow
  keys, Enter, Backspace), details: 3D model preview (`GamePreview`, mouse
  rotation, animations), sound/video player, image and text views, Copy path,
  Save a copy. *Open in editor* / double-click opens a model as a new unsaved tab
  with its module's textures (`openGameModel`; `loadTextures` keeps `gameFile`
  assets when the ordinary game-data lookup runs).
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

Add or Preview of a texture already in the model shows an inline choice:
*Use existing material* (select when several materials show it) or *Make a new
material*. Helpers in [uv-preview.js](../src/uv-preview.js):
`existingTextureIndex`, `materialsUsingTexture`, `addTextureMaterial`; UV drafts
carry `material` (index or `'new'`), honoured by `applyUVPreviews` and recovery.

## Verification

- `node --test test/game-file-library.test.js` (index, search, resolve, art
  rules, material choice).
- `test/game-file-library.electron.cjs` (needs Warcraft III; `MDLXL_PACKAGED_EXE`
  for a package, `MDLXL_TEST_THEME=dark`): picker unchanged + material choice,
  painting search, new material, Models browse with real mouse-drag rotation,
  Open in editor, sound playback, arrow keys, text view, Escape, screenshots.
