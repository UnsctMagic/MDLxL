# Audit 02 — Electron main process and renderer↔main bridge

Scope: `electron/` except `electron/ai-*.cjs`, plus how `app/` and `src/` reach
`window.desktop`. Revision: origin/main `fe46a534`. Read-only audit; no
repository file was changed. Map rows: "Desktop recovery, settings, game data,
add-ons" and "Packaging and updates" in `docs/agent-map.md`.

## Inventory (measured, not estimated)

| Item | Count |
|---|---|
| `window.desktop` keys exposed by `electron/preload.cjs` | 136 |
| Channels the preload `invoke`s / `send`s / listens on | 115 / 15 / 12 |
| `ipcMain.handle`/`on` registrations in `electron/main.cjs` | 94 (AI service registers the `ai:*` set through its own loop) |
| Preload invoke/send channels with no main handler | **0** |
| Main handlers with no preload caller | **0** (only `ai-sandbox:result`, sent by the AI sandbox preload — AI auditor's area) |
| Main push channels with no preload listener | **0** |
| Preload keys never used in `app/`/`src/` | **1** (`getSettings`, tests only) |
| `window.desktop` references in `app/` | 243 in 35 files; **0 in `src/`** |
| Files using `localStorage` directly | 14 in `app/`, 3 `src/` modules take a `storage` parameter |

Method: a script parsed `preload.cjs` and every `electron/*.cjs|mjs` for channel
literals and cross-matched them; preload keys were matched against
`desktop?.<key>` / `desktop.<key>` accesses in `app/` and `src/` (the one
dynamic access, `window.desktop[external?'exportPaintTexture':'savePaintTexture']`
in `app/PaintSaveTexture.jsx:15`, was checked by hand).

Severity: **High** = can already misbehave; **Medium** = duplicated logic that
has drifted or will; **Low** = consistency/cleanup. No High finding.

---

## F1 — Dead plumbing (Medium)

### F1a. OptimizeXL save validator has no runtime caller
The only IPC that used it, `optimizexl:save`, was removed from `main.cjs` in
`3a5c89a4` ("OptimizeXL: … save into the open file"). Everything around it remains:

- `electron/optimizexl-validation.js:5` — `export function validateOptimizeXLCopies(payload) {`
- `vite.config.js:7-8` — bundles it to `dist/optimizexl-validation.cjs` on every build
- `scripts/package.mjs:102-105` — packaging *fails* if the bundle is missing:
  `if(!await exists(validationBundle))throw Error('Build the portable OptimizeXL save validator before packaging.');`
- `test/optimizexl-validation.test.js:6-14` — tests the bundle
- `docs/agent-map.md:31` — lists it as an OptimizeXL owner file

Proposal: remove the module, the vite emit, the package check and its test, and
the map mention, **or** (if a save-time reopen check is still wanted) call it
from the OptimizeXL save path. Owner decision; the code is inert either way.
Risk: low; packaging check and one test change. Tests: `pnpm run build`,
`pnpm run package` dry stage, `test/optimizexl-*.test.js`.

### F1b. `settings:get` / `getSettings` is a test-only API
- `electron/main.cjs:445` — `ipcMain.handle('settings:get',publicSettings);`
- `electron/preload.cjs:65` — `getSettings: () => ipcRenderer.invoke('settings:get'),`
- Callers: only `test/startup.electron.cjs:92`, `test/updater.electron.cjs:69`,
  `test/particle-prototype.electron.cjs:16`. The app reads settings via
  `initial()` (`app/App.jsx:1517`) and `configure()` replies.

Proposal: keep it (cheap, useful to tests) but comment it as test-facing in
preload, or switch the three tests to `window.desktop.initial()` and drop it.
Risk: none for users.

### F1c. Unused worker_threads entry for the particle indexer
Production forks a `utilityProcess` (`electron/main.cjs:68` →
`particle-library-process.cjs`). The `worker_threads` path is still wired:

- `electron/particle-library.cjs:16` — default
  `createWorker=data=>new Worker(path.join(__dirname,'particle-library-worker.mjs'),{workerData:data})`
- `electron/particle-library-worker.mjs:13` — `parentPort?.on('message', message => { if (message === 'cancel') cancelled = true; });`
- `electron/particle-library-worker.mjs:143` — `if (workerData) scanParticleLibrary({...workerData,onProgress:…})…`

Both entry points re-implement the same `progress`/`done`/`error` message
protocol (`particle-library-process.cjs:6-11` vs worker `:143`). No test or
script constructs `ParticleLibrary` with the default and reaches `scan()` past
the "no CASC folder" rejection (`test/particle-library.test.js:34`), and
`scripts/index-particles.mjs:3` calls `scanParticleLibrary` directly.
Proposal: make `createWorker` required (or default to the utilityProcess fork)
and delete the worker `workerData`/`parentPort` lines. Risk: low; run
`test/particle-library.test.js`, `test/particle-library-*.electron.cjs`, and
the packaging import at `scripts/package.mjs:109`.

### F1d. Trivia
- `electron/main.cjs:300` — `const imageExtensions=IMAGE_EXTENSIONS;` alias used at
  573/578 while 316/318 use `IMAGE_EXTENSIONS` directly. Use one name.

---

## F2 — CASC installation fingerprint computed in six places (Medium)

The same formula identifies a Warcraft build; caches and particle presets only
work while every copy agrees.

| File:line | Snippet |
|---|---|
| `electron/casc.cjs:73` | `const install = digest(path.resolve(folder).toLowerCase() + '\|' + digest(build));` |
| `electron/casc.cjs:125` | same (listFiles) |
| `electron/casc.cjs:162` | same (listTextures) |
| `electron/casc.cjs:192` | same (lookup) |
| `electron/particle-source.cjs:7` | `const sourceKey=hash(path.resolve(folder).toLowerCase()+'\|'+hash(build));` |
| `electron/particle-library-worker.mjs:41` | `const sourceKey = hash(path.resolve(folder).toLowerCase() + '\|' + hash(build));` |

Identical today. `particle-source.cjs:19` passes its key straight to
`casc.readSnapshot(…, state.sourceKey)`, so any drift silently breaks every
indexed particle preset.

Proposal: export `installKey(folder, buildBytes)` from `casc.cjs`; the worker
already `require`s `./casc.cjs` (`particle-library-worker.mjs:9`), and
`particle-source.cjs` can require it. Pure refactor. Tests:
`test/desktop-native-rescan.test.js`, `test/particle-library.test.js`,
`test/texture-library.test.js`, `test/game-file-library.test.js`.

---

## F3 — "Which Warcraft installation" is decided four different ways (Medium, behavioural)

All four call `gameDataDiscovery.discover({explicitFolder:settings.gameData…})`
and then order CASC folders differently:

| Caller | File:line | Order |
|---|---|---|
| Texture resolve (model, events, portrait frame) | `electron/main.cjs:306-311` | Settings folder's sources, then fallbacks; custom CASC as separate list |
| Texture Library | `electron/main.cjs:321-330` | `[...custom, ...selected, ...others]` (custom **first**) |
| Library game-file browser | `electron/main.cjs:343-350` | `[...selected, ...custom, ...folders][0]` (Settings folder **first**), comment at 341-342 says so |
| Particle indexer + particle sources | `electron/particle-library.cjs:165`, `electron/particle-source.cjs:5` | `discover().cascFolders[0]` — `game-data.cjs:99` puts custom CASC first, the Settings choice is not consulted at all |

So with a custom CASC source added, the Library browser reads the chosen
installation while the Texture Library and the particle indexer read the custom
one. The repeated `discover({explicitFolder:settings.gameData})` closure also
appears at `main.cjs:68, 71, 72`.

Proposal (smallest): add `orderedCascFolders(discovered, chosen, {customFirst})`
beside `selectedGameDataSources` in `electron/game-data.cjs`, make each caller
name its order explicitly (no behaviour change), and ask the owner whether
particles should follow the Settings folder like the browser does. Risk:
medium if the order changes (particle `sourceKey`s would re-index). Tests:
`test/game-data.test.js`, `test/desktop-native-rescan.test.js`,
`test/game-file-library*.{test.js,electron.cjs}`, `test/particle-library*.`

---

## F4 — Twelve atomic-write implementations, five behaviours (Medium)

| Behaviour | Instances |
|---|---|
| random temp name, `wx`, read-back verify, rename, unlink on failure | `electron/main.cjs:251-259` (`writeModelFile`), `electron/main.cjs:294-296` (`saveArtifact`) |
| random temp, `wx`, rename, unlink on failure | `electron/settings.cjs:99-105` |
| fixed `file+'.tmp'`, rename, no cleanup | `electron/session.cjs:34-36`, `electron/recovery.cjs:55-56`, `electron/texture-preview-cache.cjs:43-44`, `:63`, `electron/casc.cjs:87`, `:139`, `:177`, `:209-210` |
| `.previous` backup copy, fixed `.tmp`, rename | `electron/particle-library.cjs:10-14` |
| fixed `.tmp`, rename retried on `EPERM/EACCES/EBUSY` | `electron/particle-library-worker.mjs:14-24` (comment: "Windows can briefly deny replacement while the catalogue is being read") |
| plain `writeFile` for app-owned state | `electron/main.cjs:130` (`recent.json`), `electron/game-data.cjs:163` (discovery cache), `electron/paint-textures.cjs:47` (seed receipt) |

The Windows rename retry exists in exactly one writer; settings, session,
recovery and the thumbnail cache can hit the same `EPERM` from antivirus or
the search indexer. `recent.json` can be truncated by a crash mid-write
(it is then silently dropped by `main.cjs:603`).

Proposal: one `electron/atomic-file.cjs` exporting
`writeFileAtomic(file, data, {verify=false, backup=false})` = random temp name
+ `wx` + retrying rename + unlink on failure (union of the settings and worker
versions). Switch settings, session, recovery, texture-preview-cache, casc,
particle-library, the worker and `persistRecents`. Leave `writeModelFile`'s
no-overwrite `copyFile(…COPYFILE_EXCL)` branch as is.
Risk: medium (many writers). Constraint: `test/paint-contract.test.js:20`
asserts the literal source text `fs.rename(temporary,destination)` and `.tmp`
in `main.cjs`, and `test/particle-library.test.js:38` imports `atomic` from the
worker — keep `saveArtifact` as is or update those assertions; re-export
`atomic` from the worker. Tests: `desktop-settings`, `session-journal`,
`recovery-store`, `texture-preview-cache`, `particle-library`,
`desktop-native-rescan` (`*.test.js`).

---

## F5 — Operation tracking and sender guards rewritten per handler in main.cjs (Medium)

### Tracking
`set.add(op); op.finally(()=>set.delete(op)).catch(()=>{}); return op;` written
inline although two helpers already exist next to it:

| File:line | Snippet |
|---|---|
| `electron/main.cjs:99` | helper `function captureOperation(operation){captureOperations.add(operation);…}` |
| `electron/main.cjs:203` | `captureOperations.add(operation);operation.finally(()=>captureOperations.delete(operation))…` (inlines the helper above) |
| `electron/main.cjs:351` | helper `function gameFileOperation(operation){textureOperations.add(operation);…}` |
| `electron/main.cjs:313, 316, 319, 335, 339` | the same body inlined five times for `textureOperations` |

Identical behaviour. Proposal: use `captureOperation` at 203; rename
`gameFileOperation` → `trackTextureOperation` and use it at the five sites.
Constraint: `test/local-portrait-frame.test.js:23-28` slices `main.cjs` from
`async function resolveTextures(` to `ipcMain.handle('texture:resolve'` and
from `ipcMain.handle('preview:humanPortraitFrame'` to
`async function textureLibraryContext(` and runs it in a `vm` with only
`textureOperations` supplied — add the helper to that context (or define it
inside the slice).

### Sender guards
13 ad-hoc guards with 9 different wordings; most of the 94 handlers have none:
`main.cjs:100` (`captureOwner`, used 7×), `120`, `159`, `199`, `221`, `281`,
`393`, `447`, `462`, `471`, `477`, `489`. Example:
`if(event.sender!==win?.webContents)throw Error('Update checks require the main editor.');`
The AI service already has the shape to copy, `electron/ai-service.cjs:2004-2018`:
`const handle = (name, fn) => ipcMain.handle(name, (event, payload) => { own(event); … service.running.add(result); …`
(it also checks `event.senderFrame === event.sender.mainFrame`).
Proposal: no sweeping change; add a `editorOnly(event, message)` helper and use
it in the existing 13 places. Risk: low.

---

## F6 — Serial write queue idiom ×14 (Low)

`queue = queue.catch(()=>{}).then(op)`:
`main.cjs:130` (recents), `:279`, `:285`, `:59` (AI `writeModel`), `:524`
(`saveQueue`), `:298` (`artifactSaveQueue`); `settings.cjs:95`; `session.cjs:33`;
`recovery.cjs:47-59` (per id); `texture-preview-cache.cjs:41`; `casc.cjs` five
methods (`readSound` 67, `read` 98, `readSnapshot` 105, `list` 108, `listFiles` 113);
`particle-library.cjs:120` (`next=this.queue.then(op);this.queue=next.catch(()=>{})` — equivalent).
Identical semantics everywhere. A `serialQueue()` helper would save little;
only worth doing together with F4. Risk: low.

---

## F7 — Three copies of the CASC listing cache in casc.cjs (Medium)

`readSound` (`electron/casc.cjs:70-87`), `listFiles` (`:120-145`),
`listTextures` (`:158-180`) each: compute install key → stat+parse cached JSON
with version/size/shape guards → spawn reader → `list(kind)` → `.tmp`+rename →
prune old indexes. Divergent:

| Listing | Cache version | Size cap | Old indexes kept |
|---|---|---|---|
| sounds | 1 | 64 MB | **never pruned** |
| files | 1 | 96 MB | 4 (`:141`) |
| textures | 4 | 64 MB | 8 (`:178`) |

The locale regex is also copied: `casc.cjs:89` and `:143`
`matchAll(/\b([a-z]{2}[A-Z]{2})\s+(?:speech|text)\?/g)`.
Proposal: private `cachedListing(folder, kind, {version, maxBytes, keep, valid})`
inside `casc.cjs`, keeping each listing's constants; add a `keep` for sounds.
Risk: low-medium (cache invalidation only rebuilds). Tests:
`test/desktop-native-rescan.test.js`, `test/texture-library.test.js`,
`test/game-file-library.test.js`, event-sound tests.

---

## F8 — Native dialog wrappers (Low)

Save dialog + "force the extension" written five times, with gaps:

| File:line | Extension enforced? |
|---|---|
| `electron/main.cjs:232-239` (`saveModel`, twice) | yes: `if(path.extname(destination).toLowerCase()!=='.'+payload.format)destination+='.'+payload.format;` |
| `electron/main.cjs:195-196` (`paint:exportTexture`) | yes |
| `electron/main.cjs:291-293` (`saveArtifact`) | yes + re-check |
| `electron/main.cjs:82-83` (`particles:export`) | **no** |
| `electron/main.cjs:375-377` (`gameFiles:export`) | **no filter, no extension** |

"Open a library folder in Explorer" three times, divergent return value:
`main.cjs:183` and `:186` return the directory, `:190` (`paint:textureFolder`)
returns nothing: `const error=await shell.openPath(…);if(error)throw Error(error);`.

Proposal: `chooseSavePath({title, defaultPath, extension, filterName})` and
`openFolder(directory)` in `main.cjs`. Risk: low. Tests:
`test/paint-texture-library.test.js`, `test/particle-library-copy.electron.cjs`,
`test/game-file-library.electron.cjs`.

---

## F9 — Install-folder and test-run expressions repeated (Low)

- `app.isPackaged ? path.dirname(process.execPath) : app.getAppPath()` ×5:
  `main.cjs:40, 44, 47, 98, 202` (98 and 202 both build `'Showcase Recordings'`).
- Bundled `dist` found two ways: `path.join(app.getAppPath(),'dist','paint-library')`
  (`:44`) vs `path.resolve(__dirname,'../dist/backgrounds')` (`:47`), `../dist/branding` (`:63, 452, 623`).
- `process.env.MDLVIS_HEADLESS!=='1'` ×7 in `main.cjs` (`63, 142, 465, 512, 623, 624, 628`)
  plus `close-prompt.cjs:61`, `welcome-prompt.cjs:75`; the "real user run" test
  `app.isPackaged&&!process.env.MDLXL_PROFILE&&process.env.MDLVIS_HEADLESS!=='1'` at `:63` and `:465`.

Proposal: `const appFolder=…`, `const showcaseRecordings=path.join(appFolder,'Showcase Recordings')`,
`const headless=…`, `const userRun=…` at the top of `main.cjs`. Risk: very low;
`test/desktop-native-rescan.test.js` evaluates the whole of `main.cjs` in a
`vm` with a fake `app`, so keep `app.isPackaged`/`getAppPath` calls valid there.

---

## F10 — Renderer request/reply protocols hand-rolled three times (Medium)

Main side (request id + timer + sender check + `String(error).slice(0,500)`):
- `electron/main.cjs:111-121` texture decode (`texture:preloadDecode` → `texture:decoded`, 30 s)
- `electron/main.cjs:515-549` flush before close (`app:beforeClose` → `app:closeReady`, 1.5 s/60 s)
- `electron/main.cjs:551-571` save before close (`app:saveBeforeClose` → `app:saveBeforeCloseReady`, no timeout)

Preload side, same try/catch-reply shape:
- `electron/preload.cjs:77-84` `catch (error) { ipcRenderer.send('app:closeReady', { requestId, error: error?.message || String(error) }); }`
- `electron/preload.cjs:85-92` same for save
- `electron/preload.cjs:118-125` `catch(error){ipcRenderer.send('texture:decoded',{requestId:payload.requestId,error:String(error?.message||error)});}`

Four different "renderer is ready" handshakes, four naming styles:
`ai:ready` (`preload.cjs:38`), `model:externalReady` (`:61`),
`texture:decoderReady` (`:123`), `updates:startup` (`:74`, one-shot, no "not ready").

The plain subscription boilerplate
`const listener=(_,v)=>callback(v);ipcRenderer.on(ch,listener);return()=>ipcRenderer.removeListener(ch,listener);`
is written 12 times (`preload.cjs:38, 39, 40, 57, 59-63, 73, 74, 77-84, 85-92, 114-117, 118-125, 166`).

Proposal (smallest, zero API change): inside `preload.cjs` add
`subscribe(channel, callback, {ready})` and `answer(request, reply, callback)`
and rewrite those 12 entries with them. Leave main's three protocols (their
timeouts differ deliberately). Risk: low. Tests: `test/close-prompt.electron.cjs`,
`test/model-close.electron.cjs`, `test/startup.electron.cjs`, texture preload
tests; `test/paint-contract.test.js:21` only checks `saveArtifact` exists.

---

## F11 — "send to the editor if it is alive" ×6 (Low)

`if(win&&!win.isDestroyed())win.webContents.send(…)`: `main.cjs:68` (particles
progress), `:107` (texture preload progress), `:459` (preferences), `:506` (menu),
`:605` (updates); `:148` sends after its own check. Proposal:
`sendToEditor(channel, value)`. Risk: none.

---

## F12 — Errors reach the user with Electron's IPC prefix (Medium, needs a packaged check)

Main handlers `throw Error('…')` (e.g. `main.cjs:134`
`'Choose an MDL, MDX, or MDLxL Paint Project.'`). `ipcRenderer.invoke`
rejects with `Error invoking remote method '<channel>': Error: <message>`; no
code in `app/`, `src/` or `preload.cjs` removes that prefix (searched for
`invoking remote`, message rewriting — none), and the UI shows
`error.message` raw, e.g. `app/App.jsx:913`
`window.desktop.openRecent(path,true).then(loadShowcaseModel).catch(error=>say(error.message,true))`.

Proposal: one wrapper in `preload.cjs`:
`const call=(ch,...a)=>ipcRenderer.invoke(ch,...a).catch(e=>{throw Error(String(e?.message||e).replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/,''))});`
and use it for every `invoke`. Risk: low (messages only get shorter; no test
asserts the prefix). **ready to test**: confirm in the packaged app that, for
example, opening a moved Recent file shows only "This recent file was moved or deleted: …".

---

## F13 — No renderer-side desktop adapter (Medium)

243 direct `window.desktop` references in 35 `app/` files (top: `App.jsx` 54,
`AiAssistant.jsx` 46, `GameFileBrowser.jsx` 14, `ParticleLibrary.jsx` 13,
`ParticleEditor.jsx` 11, `TextureLibrary.jsx` 11). `src/` has none.
Feature detection uses five styles:

| Style | Count | Example |
|---|---|---|
| truthiness `if (window.desktop)` / `!window.desktop` | 19 | `app/App.jsx:949` `if (window.desktop) { const result = await window.desktop.save({…` |
| property test `window.desktop?.x ? … : …` | 45 | `app/App.jsx:1228` `window.desktop?.listRecovery ? await window.desktop.listRecovery() : await browserRecovery('list')` |
| double optional `window.desktop?.x?.()` | 20 | `app/App.jsx:1515` `window.desktop?.onPreferences?.(…)` |
| single optional `window.desktop?.x()` | 6 | `app/App.jsx:1516` `window.desktop?.onMenu(…)` (throws if `onMenu` is missing) |
| `native=!!window.desktop?.x` flag | 3 | `app/PaintSaveTexture.jsx:8`, `app/PaintTextureShelf.jsx:36`, `app/usePreviewBackgrounds.js:5` |

Mixed forms are visible within one line: `app/Settings.jsx:177`
`window.desktop.onTextureLibraryPreloadProgress?.(update)` (optional method on
a non-optional object). Most bare uses are guarded earlier in the component
(e.g. `app/useUpdates.js:19`), so this is consistency, not a live crash.

Good pattern already present (keep, extend): five modules take the bridge as
an injectable parameter — `app/ai-assets.js:45`, `app/event-preview-runtime.js:80`,
`app/event-sound-preview.js:4`, `app/asset-preload-client.js:35`
(`desktop = window.desktop`), `app/preview-recording-queue.js:23`.

Most repeated renderer idiom — "resolve game files, empty in the browser" ×8+:
`app/ParticleEditor.jsx:43`, `:54`, `app/ParticleExampleComparison.jsx:10`,
`app/PaintTextureShelf.jsx:12-14`, `app/PaintWorkspace.jsx:123-124`, `:144`,
`app/BitsAndParts.jsx:55`, `app/App.jsx:778-785`, `:936-937`, `app/ForgeShapes.jsx:105`, `app/TextureLibrary.jsx:13`.

Proposal (no rewrite): add `app/desktop.js` with
`export const desktop = globalThis.window?.desktop ?? null;`,
`export const hasDesktop = name => typeof desktop?.[name] === 'function';` and
`resolveGameFiles(names, modelPath)` (returns `[]` without the desktop). New
code uses it; migrate only the resolve-with-fallback sites. Risk: low per file.

---

## F14 — Settings persistence: one disk store, plus a mirror and three validators (Medium)

Where each kind of state lives:

| Store | Owner | Keys / content |
|---|---|---|
| `profile/settings.json` | `electron/settings.cjs` (`SettingsStore`) via `settings:configure`, `settings:gameData`, `settings:add/removeGameDataSource`, `settings:clearGameData`, `offerStartupUpdates` (`main.cjs:457`) | `preferences`, `historyBudgetBytes`, `historyMaxSteps`, `gameData`, `gameDataSources` |
| `profile/recent.json` | `main.cjs:127-132`, read `:603` | Recent files (non-atomic, see F4) |
| `profile/game-data-discovery.json` | `game-data.cjs:158-164` | discovery cache |
| `localStorage 'mdlvis-preferences'` | `app/App.jsx:138` (read), `:1546` (write) | **full mirror of `preferences`**, written on every change also in the desktop app |
| `localStorage` UI state | `App.jsx:268/392` `mdlvis-preview-background`; `App.jsx:553-556` `mdlxl-portrait-background-look`; `AiAssistant.jsx:90` `mdlxl-ai-width`; `GameFileBrowser.jsx:105-106` `mdlvis.game-files.variant/style`; `TextureLibrary.jsx:20-22` `mdlvis.library.tab`, `mdlvis.texture-library.vibe/blp-only`; `UVWorkspace.jsx:23` `mdlxl.uv.preview-percent/side-percent`; `NodeEventEditor.jsx:7` `mdlxl-sound-expansions`; `ParticleEditor.jsx:172` `mdlxl-particle-mode`; `ShowcaseWorkspace.jsx:31` `mdlxl-showcase-saved-colors-v1`; `src/display-overlays.js:47` `mdlxl-editor-display`; `src/motion-decisions.js:28-50` (prefixed) | per-view choices |
| `localStorage` personal content | `Addons.jsx:7-8` `mdlxl-addons`; `AnimXL.jsx:61` `mdlxl.animxl.presets` and per-model `mdlxl.animxl.<path>.<name>` (`:57`); `Learn.jsx:9` `mdlxl-learn-notebook`; `Hotkeys.jsx:12` `mdlvis-classic-hotkeys-catalog-v1` | user-made data |
| IndexedDB | `app/showcase-presets.js:1` `mdlxl-showcase-setups`; `app/showcase-signature.js`; `app/showcase-custom-fonts.js:4` `mdlxl-showcase-fonts`; `src/texture-library-cache.js:7`; `App.jsx:125` `mdlvis-classic-recovery` (browser-only recovery) | personal libraries, caches |

Duplication:
- **Preferences are written twice in desktop runs** (`App.jsx:1546` and
  `:1548`); boot paints with the localStorage copy, then `initial()` replaces it
  (`App.jsx:1517` `normalizePreferences(settings.current.preferences || preferencesRef.current)`).
  Two sources of truth that can differ after a failed disk write.
- **Three validators for the same preference ranges**, divergent semantics:
  `electron/settings.cjs:10-26` *rejects* (`scrollSensitivity` 0.1–10,
  `pointerSensitivity` 0.01–4, `wheelMode`, `pixelRatio` [0.5…2], `maxFps`
  [30,60,120], hotkey id ≤ 2048); `src/preferences.js:179-199` *clamps* the same
  numbers and `:117` `MAX_HOTKEY_ID_LENGTH = 2048`; `src/portable-settings.js:9-25`
  requires import values to already be canonical. A range changed in one file
  only makes `configure` throw "Scroll sensitivity must be between …" for a
  value the UI allows (or the reverse).

Proposal: (1) export the limit constants from `src/preferences.js` (main
already imports it, `main.cjs:588`) and pass them to `SettingsStore` with
`normalizePreferences`; (2) owner decision whether to keep the localStorage
mirror only when `!window.desktop`. Do **not** move personal data out of
Chromium storage without a migration; profile upgrades already preserve it.
Risk: low for (1); (2) touches boot. Tests: `test/desktop-settings.test.js`,
`test/hotkey-migration.test.js`, `test/appearance-themes.test.js`,
`test/startup.electron.cjs`.

---

## F15 — Storage key naming (Low)

Four prefixes for the same app: `mdlvis-` (`mdlvis-preferences`),
`mdlvis.` (`mdlvis.library.tab`), `mdlxl-` (`mdlxl-addons`), `mdlxl.`
(`mdlxl.animxl.presets`). AnimXL writes one key per model path and name
(`AnimXL.jsx:57`) with no cleanup. Proposal: name new keys `mdlxl-…`; do not
rename existing keys (would lose user state without a migration).

---

## F16 — Duplicated constants (Low–Medium)

- **Model extensions**: `electron/main.cjs:125` (dialog filters), `:134`
  `['.mdl','.mdx','.mdlxlpaint']`, `:177`, `:229`, `:265` `['mdl','mdx']`;
  `electron/external-model-open.cjs:3` `/\.(?:mdl|mdx|mdlxlpaint)$/i`;
  `electron/optimizexl-save.cjs:8`; `electron/bits-and-parts.cjs:34, 42`;
  `app/App.jsx:888` drop filter, `:1703` `accept=".mdl,.mdx,.mdlxlpaint"`.
  Proposal: export `MODEL_EXTENSIONS` from `external-model-open.cjs` and use it
  in `main.cjs` (readModel + filters).
- **Image extensions**: `texture-resolver.cjs:4` `IMAGE_EXTENSIONS` is shared
  well (main, paint-textures, texture-library), but `game-file-library.cjs:9`,
  `forge-assets.cjs:8`, `app/App.jsx:1703`, `app/PaintWorkspace.jsx:453` keep their own lists.
- **Forge asset path rule, identical in two layers**:
  `electron/forge-assets.cjs:9` and `src/forge-assets.js:2`
  `/^MDLxL_(?:Forge|Parts|Citadel)\/[a-z0-9][a-z0-9_.-]{0,200}\.(blp|dds|tga)$/i`.
  Main already dynamically imports `src/*.js`; `saveForgeAssets` is async and
  could `await import('../src/forge-assets.js')`.
- **Windows filename rules** (`<>:"/\|?*`, trailing dot/space, CON/PRN/…):
  `bits-and-parts.cjs:7`, `forge-assets.cjs:8`, `preview-capture.cjs:7-9`,
  `main.cjs:82`, `updater.cjs:59` (+ `update-extract.ps1:16`),
  `src/paint-export.js:59`, `src/paint-materials.js:14`. Some reject, some
  replace with `_`. Proposal: `safeWindowsName(name)` / `isWindowsName(name)`
  in one CJS file for the electron callers.
- **Size limits**: 128 MB models (`main.cjs:135, 230, 266`;
  `bits-and-parts.cjs:9, 51`; `particle-source.cjs:31`), 64 MiB textures
  (`main.cjs:194, 572`; `paint-textures.cjs:75, 85, 91`; `preview-backgrounds.cjs:6`;
  `texture-library.cjs:43`; `forge-assets.cjs:11`; `casc.cjs:76, 166, 194`),
  16 MiB presets (`main.cjs:77`; `particle-library.cjs:117, 147`). Proposal:
  named constants only where the same limit guards the same data (models,
  textures).
- **Channel names** are string literals on both sides. The preload is
  sandboxed (`main.cjs:623` `sandbox:true`), so it cannot share a channel
  module without bundling; keep literals and add the cross-reference check
  below as a test instead.

---

## F17 — Channel and key naming inconsistencies (Low; document, do not rename)

- Namespace forms: `particles:` (plural) vs `texture:`/`model:` (singular) vs
  `parts:` (plural); `gameFiles:` (camelCase) vs lowercase elsewhere;
  `ai-sandbox:` (hyphen); bare `menu` (`main.cjs:506`, `preload.cjs:166`).
- Domain drift: `preview:openModel` opens a model; `preview:eventResources`
  and `preview:humanPortraitFrame` are texture-resolve variants;
  `texture:open`/`texture:folder` are file dialogs; `settings:gameData` is a picker.
- Four verb sets for the same "personal library" shape:
  `parts:list/read/save/folder`; `preview:backgrounds/background/backgroundFolder`;
  `paint:textures/texture/saveTexture/textureFolder`; `particles:catalog/read/save/…`.
- `updates:status` is both an invoke channel and a push channel (`main.cjs:446`, `:605`).
- Preload key ≠ channel: `open`→`model:open`, `save`→`model:save`,
  `textures`→`texture:open`, `recent`→`model:recent`, `initial`→`app:initial`,
  `configure`→`settings:configure`, `saveCapture`→`preview:capture`,
  `openShowcaseModel`→`preview:openModel`, `chooseGameData`→`settings:gameData`,
  `textureLibraryCatalog`→`texture:library`, `setCaptureBusy`→`preview:busy`,
  `writePaintClipboard`→`paint:clipboardWrite`, `listParts`→`parts:list`.

Renaming would touch the packaged test suite (it calls `window.desktop.*`
names) for no user benefit. Proposal: write the convention
(`area:verbNoun`, area singular, preload key = `verbAreaNoun`) next to the map
row for new channels, and add a source test that fails when a preload channel
has no handler or vice versa (the cross-match used for this audit).

---

## F18 — Two themed prompt windows share one skeleton (Low)

`electron/close-prompt.cjs:36-66` and `electron/welcome-prompt.cjs:46-81` repeat
the BrowserWindow options, `setMenu(null)`, deny-open, block-navigate,
"answer through the page title" listener, resize-to-content on load, headless
show check and `closed → resolve`; `escapeHtml` is copied (`close-prompt.cjs:3`,
`welcome-prompt.cjs:5`). Divergent: frame, modal, size, sound/effects hook.
Proposal: `showThemedPrompt({html, width, prefix, answers, fallback, frame, onLoaded})`
in one file; both prompts become HTML + options. Risk: low. Tests:
`test/close-prompt.electron.cjs`, `test/welcome-prompt.electron.cjs`.

---

## F19 — Small helpers repeated, leave as is (Low)

- `execFile` wrappers ×4: `game-data.cjs:7`, `updater.cjs:7`,
  `ffmpeg-verification.cjs:5`, `file-types.cjs:56` — each injectable for tests;
  not worth merging.
- Logging is `console.warn/error` with ad-hoc prefixes (`'Session journal: '`
  `main.cjs:219`, `'File types: '` `:64`, `'Recovery reset: '` `:611`,
  `'Update result: '` `:607`). No log file; fine for now.
- Library containment checks have four implementations with deliberately
  different strictness (`bits-and-parts.cjs:41-49`, `paint-textures.cjs:53-66`,
  `preview-backgrounds.cjs:41-50`, `forge-assets.cjs:15-24`, plus
  `main.cjs:579-580`). Security-sensitive and individually tested
  (`bits-and-parts`, `paint-texture-library`, `preview-backgrounds`,
  `forge-assets` tests); do not merge without a dedicated review.
- `.mdlxl-installing` is checked twice (`main.cjs:3`, `:57`); intentional and commented.

---

## Already shared and good

- **Every preload channel has a handler and every main push has a listener**;
  only one preload key is app-unused (F1b).
- **`src/` never touches `window.desktop`**; domain code stays platform-free,
  and `main.cjs` reuses it by dynamic import (`src/preferences.js`,
  `commands.js`, `localization.js`, `particle-data.js`) instead of duplicating it.
- **Native dialog localization is one wrapper** (`main.cjs:590-599`): every
  `showOpenDialog/showSaveDialog/showMessageBox(Sync)` title, button and filter
  is translated in one place.
- **The profile path is resolved once** (`main.cjs:51`) and handed to every
  store as a directory (recovery, sessions, settings, texture previews,
  native-texture cache, particles, discovery cache, AI). No module calls
  `app.getPath`.
- `src/application-themes.json` is shared by `main.cjs`, both prompts and the
  renderer; `electron/data/showcase-gif-levels.json` by `preview-ffmpeg.cjs:13`
  and `app/showcase-export.js:1`; `IMAGE_EXTENSIONS` by main, paint textures and
  the Texture Library.
- `SettingsStore` validates before enqueueing and snapshots IPC input
  (`settings.cjs:91-111`); `load` keeps each valid legacy field independently.
- `selectedGameDataSources` / `isInsideFolder` (`game-data.cjs:15-30`) are the
  single owner of "is this inside the chosen installation".
- `electron/ai-service.cjs:2004-2018` `handle()` (ownership check + in-flight
  tracking) is the template F5 should copy.
- Five renderer modules accept `desktop = window.desktop` as a parameter,
  which keeps them unit-testable (F13).

## Suggested order (smallest first)

1. F1a/F1c dead code removal; F1d alias.
2. F2 `installKey`, F5 tracking helpers, F11 `sendToEditor`, F9 constants.
3. F12 preload error unwrapping (+ packaged click-through).
4. F10 preload `subscribe/answer` helpers.
5. F4 `atomic-file.cjs` (with F6), F7 `cachedListing`.
6. F3 and F14 need an owner decision before behaviour changes.

## Checks run

Static reading and scripted cross-reference only (Node script over
`preload.cjs`, `electron/*`, `app/`, `src/`; `rg` searches; `git log -S`).
No build, test or app run was needed or performed; nothing was edited except
this report. F12 is **ready to test** in the packaged app.
