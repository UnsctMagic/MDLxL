# Audit 05: 3D/2D preview and interaction stack

Revision: `origin/main` at `fe46a534`, read-only worktree `D:\Claude\MDLxL\.claude\worktrees\codebase-audit`.
Dependencies checked: `three@0.183.2`, `war3-model@4.0.1` (from `D:\Claude\MDLxL\node_modules`).
Method: `rg`/`sed`/`diff` over `app/`, `src/`, `test/`; seed duplicate scan `out/audit/dupscan-source.txt`.
Nothing was run in Electron. All "behaviour" statements are from reading code. Where something is a guess, it says so.

## How the preview stack is built today

There are three real 3D renderers:

| Renderer | File | Engine | Callers |
|---|---|---|---|
| Vertex editor | `app/Viewport.jsx` | Three.js `WebGLRenderer`, single view + Quad View panes | App (vertices), ForgeEditor → Forge/ForgePreview/ForgeShapes, CollectBit, BitsAndParts |
| Paint viewport | `app/PaintViewport.jsx` | Three.js, **copy of Viewport** | PaintWorkspace only (`app/PaintWorkspace.jsx:441`) |
| Warcraft preview | `app/GamePreview.jsx` | raw WebGL2 + `war3-model` `ModelRenderer`, Three cameras/maths only | App (animations/bones), Showcase, UV Wrapper, OptimizeXL, SortMyMess, Attachemator, ModelManager, ResourceDetails, AnimXL, AI offscreen, all particle tools |

Small extra renderers: `app/EventDecalPreview.jsx` (flat 2D decal, raw WebGL2), `app/event-preview-runtime.js` (extra `ModelRenderer`s for spawned event models on GamePreview's context), `src/update-popup-effects.js` (updater popup).
2D canvases: `app/UVEditor.jsx`, `app/Forge.jsx` (MaskEditor), `app/usePaintImageNavigation.js` (Paint image views), `app/ShowcaseLayers.jsx`.

The good news first: Forge, Collect Bit, BitsAndParts and ForgePreview all reuse `Viewport`, and every animation-type preview reuses `GamePreview`. There is no separate Forge or Bits renderer (topic 8 is clean). Almost all the duplication sits in **one fork, PaintViewport**, and in small helpers that each of the three renderers wrote for itself.

## Summary table

| # | Finding | Severity | Instances | Identical? |
|---|---|---|---|---|
| F1 | PaintViewport is a frozen fork of Viewport, and the copies have drifted | **High** | ~495 identical non-trivial lines, 19 duplicate blocks, 10 drift points | divergent |
| F2 | Scene/camera/light/context-loss boilerplate in every 3D renderer | Medium | 3 renderers + 4 quad panes | mostly identical |
| F3 | Pointer-down "which mouse button does what" set up 3 times | Medium | 3 (+2 `cameraAction`) | divergent |
| F4 | `bindScrollSensitivity` option block and indicator copied | Low | 4 + 4 | identical |
| F5 | 2D image pan/zoom done three different ways | Medium | 3 | divergent |
| F6 | Vertex click/marquee rules differ between editor and previews | Medium | 2 implementations (3 copies) | divergent |
| F7 | BLP/TGA/DDS decoding and "texture → pixels" repeated | Medium | 4 decoders, 7 pixel consumers, 1 dead branch | divergent |
| F8 | Team colour / team glow handled in 4 ways (event models get linear colour) | Medium | 4 glow copies, 2 colour conversions, 3 default colours | divergent |
| F9 | Six modules monkey-patch the same `war3-model` objects | Medium | 3× destroy guard, 2× ribbon clock, 2× `updateEmitter` | partly identical |
| F10 | 2D overlay canvas create/size/remove repeated per overlay | Low | 19 | divergent |
| F11 | Background-image drawing written twice beside an existing helper | Low | 2 (+1 `containRect`) | identical |
| F12 | Camera snapshot/restore inline in Viewport and Paint | Low | 4 inline + 1 helper | divergent |
| F13 | Two playback step functions and two React rAF clocks | Low | 2 + 2 (+1 unscheduled loop) | divergent |
| F14 | Hidden-preview thumbnail queues | Low | 4 | near-identical |
| F15 | Three "long edge" size calculators, one unused in production | Low | 3 | divergent |
| F16 | Raw-GL program/texture/state helpers | Low | 5 programs, 4 uploads, 2 state savers | near-identical |
| F17 | Two resolvers for the same `overlays` prop | Low (info) | 2 | divergent |
| F18 | NDC → pixel conversion written inline | Low | ~37 in 15 files | identical |
| F19 | Viewport rebuilds its renderer on an antialias setting it no longer uses | Low | 6 effect deps | n/a |

Totals: 19 findings: 1 High, 7 Medium, 11 Low. Code that looks like a real bug left by drift: 5 (F1b, F1e, F7 dead branch, F8 event team colour, plus the Paint capture gap noted under F2).

---

## F1. PaintViewport is a frozen fork of Viewport (High)

`app/PaintViewport.jsx` (956 lines) began as a copy of `app/Viewport.jsx` (1202). Its component is still called `Viewport` (`PaintViewport.jsx:139`, `export default function Viewport(inputProps)`). The seed scan finds 19 duplicate blocks (205 lines per side). Comparing the two files with whitespace trimmed, 495 non-trivial lines are identical. The Viewport copy kept receiving fixes and the Paint copy did not.

Identical copies (examples):
- `textureFromAsset`: `Viewport.jsx:59-97` vs `PaintViewport.jsx:50-88`
- `layerMaterial`: `Viewport.jsx:99-136` vs `PaintViewport.jsx:90-119`
- `updateWideWireGeometry`: `Viewport.jsx:138-147` vs `PaintViewport.jsx:121-129`
- `configureWideLine`: `Viewport.jsx:149-154` vs `PaintViewport.jsx:131-136`
- background sync: `Viewport.jsx:244-266` vs `PaintViewport.jsx:201-223`
- `screenPosition`, `point`, `editableGeosets`, `selections`: `Viewport.jsx:408,461` vs `PaintViewport.jsx:304-307`
- vertex pick/marquee: `Viewport.jsx:725-757` vs `PaintViewport.jsx:500-529`
- scheduler + dispose: `Viewport.jsx:1047-1077` vs `PaintViewport.jsx:815-837`
- geometry rebuild: `Viewport.jsx:1081-1118` vs `PaintViewport.jsx:842-873`

Drift between the copies:

a. **Zero-normal shader fix.** Viewport has the newer fix, in both the vertex and fragment shader (`Viewport.jsx:110-124`, "A zero authored normal must stay finite before interpolation"). Paint still has the older fragment-only patch (`PaintViewport.jsx:103-105`).
b. **Alpha-to-coverage.** Viewport only enables it for `FilterMode === 1` on a multisampled context (`Viewport.jsx:1101-1103`; its comment says that otherwise "it leaks fractional alpha as white cutout edges"). Paint enables it on every layer whenever antialias is on: `material.alphaToCoverage = graphics.antialias;` (`PaintViewport.jsx:858`). That is the exact case Viewport's comment warns about. Likely bug: white fringes on cut-out textures in Citadel Paint with antialias on. Not verified visually.
c. **Wire dash pattern.** Viewport calls `configureWideWirePattern(material, appearance)` (`src/wire-pattern.js`, which follows the Appearance wire-spacing setting). Paint hard-codes the old constants: `material.dashSize = appearance.style === 'dotted' ? .6 : 4` (`PaintViewport.jsx:135`).
d. **Wire geometry.** Viewport has the `Math.max(6, …)` empty-array floor and also updates `selectedWire`. Paint has neither (`PaintViewport.jsx:123`).
e. **Ortho framing.** Viewport uses `orthographicHalfHeight(radius, aspect)` (`viewport-math.js:55`), which widens for tall windows. Paint uses `const half = state.radius * 1.3;` (`PaintViewport.jsx:243`). Likely bug: ortho views in a tall Paint panel crop the model at the sides.
f. **Grabthrough.** Viewport's vertex pick skips occluded vertices when Grabthrough is off (`Viewport.jsx:727-736`, `createOverlayDepth`). Paint's copy has no such check.
g. Hover wire: Viewport uses `side: THREE.DoubleSide` and Paint does not.
h. **Rotate drag.** Paint still has the pre-`rotation-drag.js` rotate (`PaintViewport.jsx:452-460`: `Math.atan2(a.x * b.y - a.y * b.x, a.dot(b))`). Viewport uses `beginRotationDrag`/`rotationDragDegrees`. This breaks the "one Rotate behaviour" rule from the map row, but see "unreachable" below.
i. **Antialias.** Viewport hard-codes `antialias: false` (`Viewport.jsx:172`, since commit `59cf9ce7`). Paint still uses `graphics.antialias` (`PaintViewport.jsx:154`).
j. **BLP detection.** Viewport checks the full `BLP2` magic (`Viewport.jsx:66`). Paint checks `bytes[3]===50` and falls back to `decodePaintBlp` (`PaintViewport.jsx:57`).

**Unreachable code in Paint.** The only caller (`PaintWorkspace.jsx:441`) passes `transformMode="select"`, `sequenceIndex={-1}`, `playing={false}`, `showVertices={false}`, empty `overlays`, no `zoomAnchor`, and always `paintWorkspace`. So these Paint copies look unreachable: the transform-drag start (`PaintViewport.jsx:389-406`), `translateInPlane` (`408-413`), drag application (`450-470`), the anchor marquee (`308-324`, `429-436`), `advanceSequence` playback (`605`) and the `!paintWorkspace` branches (`617`, `880`). This is a static reading; the `cameraProps` spread (`App.jsx:206`) adds only camera callbacks and `grabThrough`.

**Proposed shared owner.** Do not merge the components. Move the pure pieces into one new module, `app/viewport-materials.js`:
- `textureFromAsset(asset, info, { fallbackDecoder })`. Paint passes `decodePaintBlp`. Keep the re-export from `Viewport.jsx`, so its 9 importers (`GamePreview`, `Forge`, `BitsAndParts`, `EventDecalPreview`, `uv-material-preview`, `particle-picture-canvas`, …) do not change.
- `layerMaterial(layer, shaded, { extendShader, cacheKey })`. Paint passes `applyPaintLightShader`.
- `updateWideWireGeometry`, `configureWideLine` (always via `configureWideWirePattern`).

Callers that switch: Viewport and PaintViewport. Deleting Paint's unreachable transform/anchor/playback branches is a separate, optional second step.

**Risk.** This brings fixes a, b and c into Paint, which is a visible change: the owner should look at Paint cut-out edges and normals. `test/paint-contract.test.js:19` reads `PaintViewport.jsx` source and checks the `paintHit` field names; those stay where they are. Covering tests: `viewport-correctness.test.js`, `viewport-quality.test.js`, `paint-view.test.js`, `paint-preview.test.js`, `paint-tab-camera.electron.cjs`, `glow-material-filters.electron.cjs`, `billboard-vertex-drag.electron.cjs`, `workplane-free-drag.electron.cjs`, `rotation-interaction.electron.cjs`.

## F2. Scene, camera, light and context-loss boilerplate (Medium)

| Piece | Viewport | PaintViewport | GamePreview | Notes |
|---|---|---|---|---|
| Renderer + error | `171-179` | `153-161` | `264-268` (raw `getContext('webgl2')`) | same error wording in V/P |
| Perspective/ortho cameras, `up(0,0,1)` | `182-186` | `164-168` | `364-365` | identical `42, 1, .2, 1000` / `-100..100` |
| `EditorCameraControls` + `enableDamping=false` + default buttons | `190-193`, quad panes `393` | `169-172` | `367-372` | G sets LEFT=ROTATE, V/P LEFT=null |
| Hemisphere + key light | `194-197` | `173-176` | n/a (native shader) | identical colours/intensities |
| Resize | `299-323` (+quad) | `239-247` | `895-905`, observer `1097` | ortho differs (F1e); G handles portrait |
| `webglcontextlost` | `812-813` | `576-577` | `1572`, `1716` | none handle `webglcontextrestored` |
| Dispose | `1072-1077` | `827-837` | `1725+`, `releasePreviewGraphics` `102-115` | V/P `renderer.dispose(); forceContextLoss()`; G `WEBGL_lose_context` |

Snippet shared by all three:
```js
const perspective = new THREE.PerspectiveCamera(42, 1, .2, 1000); perspective.up.set(0, 0, 1);
const ortho = new THREE.OrthographicCamera(-100, 100, 100, -100, .2, 1000); ortho.up.set(0, 0, 1);
const controls = new EditorCameraControls(camera, canvas); controls.enableDamping = false;
```

**Proposed owners.**
- `createEditorCameras(element, { target, leftButton })` in `app/editor-camera-controls.js`, returning `{ perspective, ortho, controls }`. Callers: Viewport single view and Quad View panes, PaintViewport, GamePreview.
- `createEditorLights(scene)` in `app/preview-lighting.js`, beside `configurePreviewLights`. Callers: Viewport and Paint.
- `watchContextLoss(canvas, onLost)` in `app/viewport-performance.js`, returning an unbind. Callers: the 3 renderers.

Keep resize per renderer: the portrait, quad and Paint framing legitimately differ.

**Gap noticed, not verified at runtime.** PaintViewport never publishes `onCaptureReady`/`captureApi`. `App.jsx:1410` uses `viewportCaptureAPI` only in vertices mode, so AI `mdlxl_capture` in Paint mode probably finds no viewport.

**Risk.** Mouse rotation must keep working. Covering tests: `editor-camera-controls.test.js`, `rotation-interaction.electron.cjs`, `quad-view.electron.cjs`/`quad-view.test.js`, `showcase-camera.electron.cjs`, `paint-tab-camera.electron.cjs`; plus a packaged-app mouse drag check.

## F3. Pointer-down camera-button setup repeated (Medium)

Each renderer translates `cameraBindings(preferences)` into OrbitControls buttons on every pointer-down:
- `Viewport.jsx:501-507` (+ `cameraAction` `479-485`)
- `PaintViewport.jsx:362-368` (+ `cameraAction` `325-331`)
- `GamePreview.jsx:659-668`

```js
const binding = cameraBindings(p.preferences), mouseAction = value => value === 'pan' ? THREE.MOUSE.PAN : value === 'rotate' ? THREE.MOUSE.ROTATE : value === 'zoom' ? THREE.MOUSE.DOLLY : null;
controls.mouseButtons.RIGHT = preserveShiftCameraAction(mouseAction(binding.right), event); ...
controls.rotateSpeed = controls.panSpeed = pointerSensitivityValue(...); if (event.shiftKey ...) *= fineSensitivity ?? .2
```

How they differ:
- Viewport maps Rotate to Pan on Quad workplane panes and skips `preserveShiftCameraAction` in Quad View.
- GamePreview turns off Shift-fine in Showcase and computes `rotating` separately for the cursor.
- Paint's `cameraAction` maps `pan→move` only for the right and middle buttons.

UVEditor reads the same bindings for its 2D pan (`UVEditor.jsx:147`). That is legitimate, because 2D has no OrbitControls.

**Proposed owner.** `applyCameraButtons(controls, event, preferences, { left, rotateAsPan, fine })` plus an exported `orbitMouseAction(value)` in `app/editor-camera-controls.js`. Callers: Viewport, Paint, GamePreview. Each keeps its own `left` decision.

**Risk.** This is the user's Mouse settings path. Covering tests: `rotation-interaction.electron.cjs`, `rotation-editors.electron.cjs`, `uv-scroll-sensitivity.electron.cjs`, `quad-view.electron.cjs`, `showcase-camera.electron.cjs`.

## F4. Scroll-sensitivity options and indicator copied (Low)

`bindScrollSensitivity` is shared, which is good. But the six-callback options object is written out four times: `Viewport.jsx:280-290`, `PaintViewport.jsx:228-237`, `GamePreview.jsx:421-429`, `UVEditor.jsx:290-299`. The only differences are `onWheel` and `onPointerAdjustment`. The indicator JSX is also identical 4×: `Viewport.jsx:1196`, `PaintViewport.jsx:949`, `GamePreview.jsx:1773`, `UVEditor.jsx:316`.

**Proposed owner.** `scrollSensitivityCallbacks(latestRef, overrides)` in `viewport-performance.js`, and a two-line `<SensitivityIndicator value>` exported beside `sensitivityIndicatorText`.

**Risk.** Low. Covering tests: `viewport-performance.test.js`, `uv-scroll-sensitivity.electron.cjs`.

## F5. 2D image pan/zoom done three ways (Medium; owner decision)

- `UVEditor.jsx:272-276` (wheel) and `146-150` (pan): goes through `bindScrollSensitivity` and `wheelPixels(event) * .0015 * sensitivity`, and follows the Mouse bindings.
- `app/usePaintImageNavigation.js:10-14`: raw `Math.exp(-e.deltaY*.002)`, middle/right pan hard-wired, ignores Wheel sensitivity, Wisp and Mouse bindings. Used by `PaintCutoutEditor.jsx:13` and `PaintTextureCanvas.jsx:13`.
- `Forge.jsx` MaskEditor: no wheel zoom at all, only ± buttons (`Forge.jsx:83`); middle/right or the Pan tool drags (`Forge.jsx:49-50`).

This is the same job with three behaviours, which breaks "one way of doing things".

**Proposal.** Route `usePaintImageNavigation`'s wheel through `bindScrollSensitivity` with the same zoom step UVEditor uses. Export that step from `viewport-performance.js` as `wheelZoomFactor(event, sensitivity)`. Give Forge's MaskEditor the same wheel. This changes how zoom feels in Paint and Forge, so ask the owner first.

**Risk.** Covering tests: `uv-scroll-sensitivity.electron.cjs`, `paint-texture-library.test.js`, Forge image-tool manual check.

## F6. Vertex click/marquee rules differ (Medium; owner decision)

- Editor rule, `Viewport.jsx:725-757` (copied at `PaintViewport.jsx:500-529`): Manhattan distance `< 5` for a click, and the marquee uses `marqueeContainsPoint(…, marqueeRadius)` with the vertex-marker size.
- Preview rule, `app/preview-selection.js:27-47` `selectPreviewVertices` (used at `GamePreview.jsx:761`): Euclidean distance `< 7`, strict rectangle.

Both then fall back to the shared `pickPreviewGeoset`. So picking the same vertex feels different in the vertex editor and in preview selection mode (UV Wrapper preview, OptimizeXL selection).

**Proposed owner.** `selectPreviewVertices(..., { clickRadius, metric, marqueeRadius })`, with Viewport's loop calling it. Alternatively choose one rule and use it everywhere.

**Risk.** Covering tests: `viewport-point-selection.test.js`, `uv-preview-picking.test.js`/`.electron.cjs`, `uv-grabthrough.electron.cjs`, `optimizexl-selection.electron.cjs`, `selection-history.test.js`.

## F7. Texture decoding and "texture → pixels" repeated (Medium)

Four BLP/TGA/DDS → RGBA decoders, each detecting the format differently:
- `Viewport.jsx:59-97`: extension first, full `BLP2` magic, WeakMap cache.
- `PaintViewport.jsx:50-88`: `bytes[3]===50`, falls back to `decodePaintBlp`.
- `app/paint-raster.js:23-26` `decodePaintImage`: DDS by magic, BLP by extension with the paint fallback, `Uint8ClampedArray` out.
- `src/texture-thumbnail.js:7-17` `thumbnailPixels`: magic first.

Seven consumers build a Three texture only to read its pixels and then dispose it:
- `GamePreview.jsx:59-67` (`textureCanvas`, Human frame)
- `uv-material-preview.js:15-28`
- `particle-picture-canvas.js:15-22`
- `Forge.jsx:8-18`
- `event-preview-runtime.js:92-98`
- `EventDecalPreview.jsx:30-36`
- `BitsAndParts.jsx:28-31` (validation only)

Four of them repeat the same `image.data ? putImageData : drawImage` to-canvas step.

**Dead branch.** `GamePreview.jsx:1173-1181` (`texture.isCompressedTexture` → `setTextureCompressedImage`) and `particle-picture-canvas.js:17` can never run: `textureFromAsset` always decodes DDS to a `DataTexture`, and there is no `DDSLoader`/`CompressedTexture` anywhere in `app/` or `src/`.

**Proposed owner.** `textureRaster(asset, info)` (async, cached per asset), plus `rasterCanvas(raster)`, in a new `app/texture-raster.js`. Seed it from `paint-raster.js`, which already has the most complete detection. `textureFromAsset` becomes raster → `DataTexture`. The seven pixel-only consumers call `textureRaster` directly. Separately, remove the dead compressed branch.

**Risk.** Medium, because every texture path is involved. Covering tests: `texture-preview-cache.test.js`, `paint-texture-library.test.js`, `texture-library.test.js`, `hd-library-preview.electron.cjs`, `uv-team-color.electron.cjs`, `particle-library-previews.electron.cjs`, `event-preview.test.js`.

## F8. Team colour and team glow (Medium)

Team-glow falloff `sin(clamp(1 - distance*1.4))` is written 4 times:
- `app/viewport-shared.js:16-25` `makeTeamGlow`: 128 px, grey RGB.
- `app/particle-picture-canvas.js:7-10`: 64 px, colour × factor.
- `app/particle-preview-adapter.js:174-178`: 32 px, colour × factor.
- `app/uv-material-preview.js:40-48`: the factor goes into **alpha** with full colour RGB. This is divergent.

Colour conversion:
- `viewport-quality.js:3` `nativeTeamColor` gives encoded 0..1 values. GamePreview (`GamePreview.jsx:1366`) and particle pictures use it.
- `event-preview-runtime.js:231`: `const color = new Color(teamColor || '#ff0000'); native.setTeamColor([color.r,color.g,color.b]);`. In three r183 `ColorManagement` is on, so this passes **linear** values. Likely bug: spawned event models get darker, wrong non-red team colours than the unit they belong to. Pure red is unaffected, which may be why nobody has noticed.

Default team colour literals disagree:
- `'#ff0000'`: `Viewport.jsx:158`, `PaintViewport.jsx:140`, `BitsAndParts.jsx:36`, `event-preview-runtime.js:231`
- `'#ed3333'`: `GamePreview.jsx:1366`, `particle-picture-canvas.js:5`
- `'#ff0303'`: `App.jsx:208`, `uv-material-preview.js:54`

**Proposed owner.** `teamGlowFactor(x, y, size)`, `teamColorPixels(id, rgb, size)` and `DEFAULT_TEAM_COLOR` in `app/viewport-quality.js`, beside `nativeTeamColor`. `event-preview-runtime` switches to `nativeTeamColor`.

**Risk.** Covering tests: `uv-team-color.electron.cjs`, `event-preview.test.js`, `particle-preview.test.js`, `glow-up.electron.cjs`.

## F9. `war3-model` patching spread over six modules (Medium)

Patches on the same `ModelRenderer` instance or its WebGL context:

| Module | What it patches | Restores? |
|---|---|---|
| `warcraft-preview-adapter.js:130-339` | `gl.shaderSource/useProgram/bindBuffer/vertexAttribPointer/drawElements`; `native.setLayerProps/setLayerPropsHD/render`; `particlesController.render`; `ribbonsController.update/render` | yes (`dispose`) |
| `particle-preview-adapter.js:26-60` | `particlesController.updateParticle/createParticle/updateParticleBuffers/updateParticleTexCoordsByType/setLayerProps` | no (WeakSet guard) |
| `node-effect-controls.js:13-36` | `particlesController/ribbonsController.updateEmitter` (persistent) | yes |
| `showcase-playback.js:54-74` | the same `updateEmitter`, wrapped again around each `update` | yes, per call |
| `GamePreview.jsx:102-115` | `destroyShaderProgramObject` guard | n/a |
| `event-preview-runtime.js:13-17, 205-208` | `destroyShaderProgramObject` guard; `ribbonsController.update` wall-clock shift | n/a |
| `src/update-popup-effects.js:109-110` | `destroyShaderProgramObject` guard | n/a |

Exact duplicates:
- The destroy guard, three times: `if (shader) return destroyShader.call(this, shader);`
- The ribbon wall-clock compensation, twice: `warcraft-preview-adapter.js:244-252` and `event-preview-runtime.js:205-208`, both computing `now - previous - delta` and adding it to `emitter.creationTimes[i]`.

Event-model renderers get none of the main adapter's fixes (additive `ONE,ONE`, geoset tint, replaceable colour, MDX1400 skin repack). That could explain any "spawned model looks different" reports. Unverified.

**Proposed owner.** A small `app/war3-model-patches.js` with `guardRendererDestroy(native)` (3 callers) and `compensateRibbonWallClock(controller)` (2 callers), plus a header comment that lists which module owns which patch. Not a rewrite. Note the pinned `war3-model@4.0.1`; the comments already name that version.

**Risk.** Covering tests: `preview-blend-order.test.js`, `particle-travel.test.js`/`.electron.cjs`, `showcase-recording-particles.*`, `event-preview.test.js`, `event-animation-frame.electron.cjs`.

## F10. Overlay canvas lifecycle repeated (Low)

Each preview lazily creates 2D overlay canvases with the same four steps (`if (!x) { createElement; dataset; cssText; appendChild }`, then size, then remove):
- Viewport, 7: `962, 968, 995, 1001, 1007, 1018, 1030`
- PaintViewport, 5: `766, 772, 778, 787, 799`
- GamePreview, 7: `1401, 1434, 1443, 1450, 1457, 1460, 1551`

How they differ: Viewport and Paint reassign `width/height` every frame (`previewCanvas.width = Math.round(surface.clientWidth * renderer.getPixelRatio())`), which reallocates and clears even when nothing changed. GamePreview assigns only on change (`if (geometryCanvas.width !== canvas.width) …`) and uses explicit `z-index` 10-41.

**Proposed owner.** `overlayCanvas(slots, key, host, { zIndex, width, height, clear })` and `releaseOverlays(slots)` in `app/preview-overlays.js`.

**Risk.** `composeViewportLayers` (`game-preview-capture.js:37-54`) orders captured layers by z-index, then DOM order. If creation order changes, captures (AI pictures, Showcase stills) change too. Covering tests: `game-preview-capture.test.js`, `preview-capture.test.js`, `vertex-rgb-preview.electron.cjs`, `quad-view.electron.cjs`.

## F11. Background image drawn by hand beside an existing helper (Low)

`Viewport.jsx:256-264` and `PaintViewport.jsx:213-221` do the colour fill, then `backgroundImageRect`, then opacity, then `drawImage`. `game-preview-capture.js:10-23` `drawPreviewBackground(context, w, h, image, color, { display, opacity })` already does exactly this. Also `showcase-crop.js:30-33` `containRect` equals `backgroundImageRect(…, 'fit')` (`src/viewport-appearance.js:224`).

**Proposal.** Viewport and Paint call `drawPreviewBackground`; `containRect` delegates to `backgroundImageRect`.

**Risk.** Low. Covering tests: `preview-backgrounds.test.js`, `game-preview-capture.test.js`.

## F12. Camera snapshot/restore inline (Low)

GamePreview uses `restorePreviewCamera` (`game-preview-data.js:29-34`) and `snapshotCamera` (`GamePreview.jsx:380`). The other renderers copy the same lines inline:
- Viewport single view: `Viewport.jsx:1136-1137`
- Viewport Quad panes: `Viewport.jsx:396-398`
- Paint: `PaintViewport.jsx:885-887`

The snapshot shapes differ too: `Viewport.jsx:1066` `remember`, `PaintViewport.jsx:826`, and the GamePreview one.

**Proposal.** Move `restorePreviewCamera` and a matching `snapshotPreviewCamera` into `app/viewport-math.js`, and use them in all four places.

**Risk.** `test/uv-camera-preservation.test.js:32-33` pins GamePreview's restore text with a regex, so update the test together with the code. Also `paint-tab-camera.electron.cjs`, `quad-view.electron.cjs`.

## F13. Playback clocks (Low)

There are two step functions:
- `advanceSequence` (`src/animation.js:178`), which honours `NonLooping`. Used by `Viewport.jsx:841` and `PaintViewport.jsx:605`.
- `previewPlaybackStep` (`game-preview-capture.js:57`), with an explicit `loop`. Used by GamePreview, `SortMyMess.jsx:110` and `OptimizeXL.jsx:71`.

There are also two nearly identical React rAF clocks: `SortMyMess.jsx:106-112` (no speed, always loops) and `OptimizeXL.jsx:71` (speed + loop). `EventDecalPreview.jsx:17-25` runs its own continuous rAF loop that ignores Max FPS and Pause-when-hidden.

**Proposed owner.** `usePreviewClock({ interval, playing, speed, loop })` in a new `app/usePreviewClock.js`, for SortMyMess and OptimizeXL. EventDecalPreview switches to `createRenderScheduler`.

**Risk.** Covering tests: `optimizexl-preview.electron.cjs`, SortMyMess tests, `event-preview.test.js`.

## F14. Hidden thumbnail queues (Low)

The same "wait, fit, capture, store" sequence (`await api.whenReady(); api.fit(); api.captureFrame({maxDimension}).toDataURL('image/png')`, guarded by a busy ref, then advance the index) appears in:
- `ParticleIngredients.jsx:20-31`
- `ParticleThumbnailQueue.jsx:29-37`
- `ParticleBlendComparisons.jsx:9`
- `ParticleExampleComparison.jsx:13` (adds a camera reuse)

**Proposed owner.** `capturePreviewThumbnail(api, { maxDimension, camera })` in `game-preview-capture.js`.

**Risk.** Low. Covering test: `particle-library-previews.electron.cjs`.

## F15. Three "long edge" size calculators (Low)

- `src/capture-settings.js:13` `captureDimensions(width, height, longEdge)`: no production caller, only `test/capture-settings.test.js:4`.
- `app/viewport-quality.js:48` `captureDimensions(width, height, maxDimension, limit)`: used at `GamePreview.jsx:1699`.
- `app/showcase-crop.js:34` `recordingDimensions(...)`: crop- and aspect-aware.

The first two share a name but take different signatures.

**Proposal.** Remove the `src/` copy, or make it the single implementation and have `viewport-quality` re-export it. Keep `recordingDimensions`.

**Risk.** Low. Covering test: `capture-settings.test.js`.

## F16. Raw-GL helpers (Low)

- Shader compile/link, 5 programs in 4 files: `event-preview-runtime.js:37-48`, `game-preview-background-gl.js:5-16`, `preview-scene-gl.js:8-12`, `rig-markers-gl.js:157-178`.
- RGBA texture upload with filter/clamp/flip handling: `event-preview-runtime.js:141-146`, `EventDecalPreview.jsx:34-37`, `preview-scene-gl.js:20-26`, `game-preview-background-gl.js:27-31`.
- GL state preservation: `event-preview-runtime.js:19-30` `preserveGLState` vs `game-preview-background-gl.js` `draw()`'s `previous = {...}`.

**Proposed owner.** `app/gl-utils.js` with `createGLProgram(gl, vs, fs)`, `uploadTexture(gl, texture, image, { filter, flipY })` and `preserveGLState(gl)`.

**Risk.** Low. Covering tests: `hd-library-preview.electron.cjs`, `event-animation-frame.electron.cjs`, `preview-backgrounds.test.js`.

## F17. Two resolvers for the `overlays` prop (Low, informational)

`app/viewport-overlays.js:4-23` `viewportOverlayOptions` (Viewport/Paint) and `app/preview-overlays.js:13-28` `previewOverlayOptions` (GamePreview) turn the same `overlays` object into flags with different defaults:
- `boneLines` defaults to `true` in previews, but follows `showSkeleton` in the editor.
- Sounds and events grouping exists only in the preview resolver.

This is probably intentional. Document it in the map row; merge only if the owner wants one display rule.

## F18. NDC → pixel conversion inline (Low)

`(p.x + 1) * width / 2, (1 - p.y) * height / 2` (and the reverse, `x/width*2-1`) appears about 37 times in 15 files. The most are in Viewport (9), Paint (8) and `movement-overlay.js` (4).

**Proposal.** `toScreen(projected, w, h)` and `toNdc(x, y, w, h)` in `app/viewport-math.js`. Adopt them only when touching those lines, not as a sweep.

## F19. Viewport rebuilds its renderer on an unused antialias setting (Low)

`Viewport.jsx:172` always creates `antialias: false`. Yet its effects still depend on `graphics.antialias` (`1078, 1139, 1171, 1174, 1176, 1177`), so toggling Antialias rebuilds the whole vertex editor for nothing. Because the context is never multisampled, `Viewport.jsx:1103`'s `alphaToCoverage` check is now always false.

**Proposal.** Drop the dependency, or restore antialias, after asking the owner which was intended.

**Risk.** Low. Covering test: `viewport-quality.test.js`.

---

## Already shared and good

- **Mouse camera:** every 3D preview (Viewport single view and Quad panes, PaintViewport, GamePreview) uses `EditorCameraControls` (`app/editor-camera-controls.js`). None has its own orbit/pan/zoom state machine. Showcase auto-orbit (`showcase-orbit.js`) only places the camera and leaves the user's drag intact. EventDecalPreview is a flat 2D decal, so it needs no camera.
- **Wheel/Wisp/sensitivity:** `bindScrollSensitivity` and `createScrollSensitivity` (`viewport-performance.js:100`) back all four interactive canvases.
- **Render loop:** `createRenderScheduler` (`viewport-performance.js:134`) drives Viewport, Paint and GamePreview (Max FPS, pause when hidden, detached windows).
- **Rotate drag:** `src/rotation-drag.js` is used by Viewport, UVEditor, GamePreview (via `movement-overlay.js`) and ShowcaseLayers. The only exception is the unreachable Paint copy (F1h).
- **Capture:** `composeViewportLayers` (`game-preview-capture.js:37`) serves `captureView` for both Viewport (`Viewport.jsx:1057-1060`) and GamePreview (`GamePreview.jsx:1586-1589`). AI offscreen pictures (`AiOffscreenRender.jsx`) and Showcase recording reuse GamePreview's API instead of having their own paths.
- **Grid and platform:** `gridSegments` (`viewport-grid.js:8`) and `platformGeometry` (`preview-platform.js:11`) feed both the Three renderer and the raw-GL one (`preview-scene-gl.js`), so the data is defined once.
- **Picking core:** `projectPreviewGeosets` and `pickPreviewGeoset` (`preview-selection.js`) are shared by all three renderers. Grabthrough depth comes from `preview-depth.js`.
- **Overlay drawing:** `drawPreviewGeometryOverlay`, `drawPresentationOverlay`, `drawModelCameraOverlay`, `drawMovementOverlay`/`drawPivotCrosses`/`drawBoneConnectors`, `drawPoseOverlay` and `createRigMarkersGL` are each written once and used by the previews.
- **Quality and lighting:** `viewportPixelRatio`, `configureEditorTexture`, `cameraLeftLight`, `previewLighting`/`configurePreviewLights`, `viewportCursor`.
- **Reuse instead of new renderers:** Forge (`ForgePreview.jsx`, `ForgeShapes.jsx` → `ForgeEditor.jsx` → `Viewport`), Collect Bit and BitsAndParts reuse `Viewport`. Showcase, UV Wrapper, OptimizeXL, SortMyMess, Attachemator, the AI offscreen render and the particle tools reuse `GamePreview`.

## Suggested order (smallest safe steps)

1. F15, F11, F14, F16: pure helpers with no visible change and unit tests already in place.
2. F9 (destroy guard and ribbon clock) and the F8 `nativeTeamColor` fix in the event runtime.
3. F1 shared materials/texture module: brings three Viewport fixes into Paint; the owner eyeballs Paint.
4. F2, F3, F12: camera plumbing; verify real mouse drags in the packaged app.
5. F5, F6, F19: these change how things feel, so get owner approval first.

Source-text tests to update alongside the code: `test/uv-camera-preservation.test.js`, `test/portrait-toolbar.test.js`, `test/release-fixes.test.js`, `test/bone-influence-view.test.js` (GamePreview regexes), and `test/paint-contract.test.js` (PaintViewport regex).
