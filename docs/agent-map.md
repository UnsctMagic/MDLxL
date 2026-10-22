# MDLxL project map

Use the row matching the user's feature or symptom, then search within those
owners. This is a navigation guide, not a required reading list. Paths and named
symbols were checked against the source during the context setup; always check
the current branch before using them. Historical evidence is not a fresh test result.

## Start and route

[package.json](../package.json) starts [electron/main.cjs](../electron/main.cjs);
[preload.cjs](../electron/preload.cjs) exposes desktop operations.
[index.html](../index.html) loads [app/main.jsx](../app/main.jsx), which mounts
[App.jsx](../app/App.jsx). UI routing is split across
[AppToolbar.jsx](../app/AppToolbar.jsx), [AppSidebar.jsx](../app/AppSidebar.jsx),
[AppPanels.jsx](../app/AppPanels.jsx) and [AppDialogs.jsx](../app/AppDialogs.jsx).
Search the relevant component or dialog type before reading all of App.

## Feature owners

| User's area | Start here; useful symbols | Detail only when relevant | Focused checks / evidence |
| --- | --- | --- | --- |
| Open, save, import/export MDL/MDX; undo | [editor-document.js](../src/editor-document.js): `EditorDocument`, `openDocument`, `importGeosets`; [model-save.js](../app/model-save.js): `prepareModelSaveAsync`; [save-target.js](../src/save-target.js). Codecs: [mdx-compatibility.js](../src/mdx-compatibility.js), [mdl-compatibility.js](../src/mdl-compatibility.js); preservation: [record-preservation.js](../src/record-preservation.js), [history-store.js](../src/history-store.js). | [Compatibility fixes](MDL-MDX-COMPATIBILITY-FIXES.md), [save verification](SAVE-COMPATIBILITY-VERIFICATION.md) | [editor-roundtrip](../tests/editor-roundtrip.test.js), [lossless-roundtrip](../tests/lossless-roundtrip.test.js), [editor-document](../test/editor-document.test.js) |
| Mesh, vertices, geosets and rig edits | [classic-mesh.js](../src/classic-mesh.js): `weldSelectedVertices`; [editor-commands.js](../src/editor-commands.js), [geoset-operations.js](../src/geoset-operations.js), [bone-tools.js](../src/bone-tools.js). UI selection starts in [AppSidebar.jsx](../app/AppSidebar.jsx). | [Geoset animation saves](GEOSET-ANIMATION-SAVE.md) when touching animated visibility/color | [classic-mesh](../test/classic-mesh.test.js), [geoset-operations](../test/geoset-operations.test.js), [bone-tools](../test/bone-tools.test.js) |
| Animation, Movement, keyframes and POSE | [MovementControllerRecomp.jsx](../app/MovementControllerRecomp.jsx), [KeyframeTimeline.jsx](../app/KeyframeTimeline.jsx); [animation.js](../src/animation.js): `sampleTrack`, `sampleNodeMatrices`; [animation-tracks.js](../src/animation-tracks.js), [pose-ik.js](../src/pose-ik.js). | [POSE](POSE_IK.md); [merger constraints](../MERGER_NOTES.md) for toolbar/menu/workplane edits | [animation](../test/animation.test.js), [animation-tracks](../test/animation-tracks.test.js), [pose-ik](../test/pose-ik.test.js) |
| AnimXL shaping and secondary motion | [AnimXL.jsx](../app/AnimXL.jsx); [anim-xl.js](../src/anim-xl.js): `buildAnimXL`, `applyAnimXL` | [AnimXL](ANIMXL.md) | [anim-xl](../test/anim-xl.test.js), [Electron workflow](../test/anim-xl.electron.cjs) |
| Motion warnings below the timeline | [useMotionInspector.js](../app/useMotionInspector.js), [motion-inspector.js](../src/motion-inspector.js), [motion-decisions.js](../src/motion-decisions.js) | [Motion constraints and verification](MOTION-INSPECTOR.md), required before changing this feature | [motion-inspector](../test/motion-inspector.test.js), [Electron workflow](../test/motion-inspector.electron.cjs) |
| Particles, emitters, ribbons and library | [ParticleEditor.jsx](../app/ParticleEditor.jsx); [particle-recipes.js](../src/particle-recipes.js): `extractParticleRecipe`, `placeParticleRecipe`; [particle-preview-adapter.js](../app/particle-preview-adapter.js); [particle-library-worker.mjs](../electron/particle-library-worker.mjs) for indexing | Relevant [contract](particle-editor/CONTRACT.md) sections; existing [ownership map](particle-editor/HANDOFF.md#ownership-map); [feedback](particle-editor/USER-FEEDBACK.md) is historical evidence | [particle-prototype](../test/particle-prototype.test.js), [particle-assets](../test/particle-assets.test.js), [model I/O workflow](../test/particle-model-io.electron.cjs) |
| Viewport, rendering, cameras and preview | [Viewport.jsx](../app/Viewport.jsx) uses Three.js; [GamePreview.jsx](../app/GamePreview.jsx) integrates `war3-model`'s `ModelRenderer`; [warcraft-preview-adapter.js](../app/warcraft-preview-adapter.js): `installWarcraftPreviewAdapter`; [editor-camera-controls.js](../app/editor-camera-controls.js) owns mouse controls | [Showcase rendering](SHOWCASE-RENDERING.md) when relevant; inspect the installed dependency version before changing an adapter | [viewport-correctness](../test/viewport-correctness.test.js), [mouse rotation](../test/rotation-interaction.electron.cjs) |
| OptimizeXL | [OptimizeXL.jsx](../app/OptimizeXL.jsx), [optimizexl.js](../src/optimizexl.js), [optimizexl-checker-repairs.js](../src/optimizexl-checker-repairs.js), [optimizexl-validation.js](../electron/optimizexl-validation.js); follow the relevant `src/optimizexl-*` rule owner | [Teaching agreement](OPTIMIZEXL_TEACHING.md) is required; [feature guide](OPTIMIZEXL.md) and only relevant verification notes | [optimizexl](../test/optimizexl.test.js), [validation](../test/optimizexl-validation.test.js), [immutable flail regression](../test/optimizexl-flail-regression.mjs) |
| NormalsXL | [NormalizerControls.jsx](../app/NormalizerControls.jsx); [normals-rebuild.js](../src/normals-rebuild.js): `analyzeNormals`, `planNormalRebuild`, `applyNormalRebuild` | [NormalsXL](NORMALS-XL.md) | [normals-rebuild](../test/normals-rebuild.test.js) |
| Forge, Collect Bit, BitsAndParts | [ForgeShapes.jsx](../app/ForgeShapes.jsx) owns detail previews, preview Undo and Shift snapping; [forge-detail-editing.js](../src/forge-detail-editing.js) owns repeat/Blend geometry; [forge-detail-magnet.js](../src/forge-detail-magnet.js) constrains the existing Move/Rotate controls. [ForgeEditor.jsx](../app/ForgeEditor.jsx), [CollectBit.jsx](../app/CollectBit.jsx), [bits-and-parts.js](../src/bits-and-parts.js), [forge-assets.cjs](../electron/forge-assets.cjs) | [Forge Glow Up](FORGE_GLOW_UP.md) only for glow work | [forge-detail-editing](../test/forge-detail-editing.test.js), [detail Electron workflow](../test/forge-detail-editing.electron.cjs), [forge-contract](../test/forge-contract.test.js), [bits-and-parts](../test/bits-and-parts.test.js) |
| UV Wrapper, textures and resource managers | [UVWorkspace.jsx](../app/UVWorkspace.jsx), [UVEditor.jsx](../app/UVEditor.jsx), [uv-tools.js](../src/uv-tools.js); [TextureLibrary.jsx](../app/TextureLibrary.jsx), [texture-library.cjs](../electron/texture-library.cjs), [ResourceEditors.jsx](../app/ResourceEditors.jsx) | [Resource managers](RESOURCE-MANAGERS-XL.md) | [uv-tools](../test/uv-tools.test.js), [texture-library](../test/texture-library.test.js) |
| Citadel Paint | [PaintWorkspace.jsx](../app/PaintWorkspace.jsx), [paint-project.js](../src/paint-project.js), [paint-materials.js](../src/paint-materials.js); [paint-blp-bindings.cpp](../native/paint-blp-bindings.cpp) for native image codecs | [Design](citadel-paint/DESIGN.md); relevant sections of the historical [handoff](citadel-paint/HANDOFF.md) / [verification](citadel-paint/VERIFICATION.md) | [paint-contract](../test/paint-contract.test.js), [paint-model-integration](../test/paint-model-integration.test.js) |
| Localisation, labels and tooltips | [localization.js](../src/localization.js): `translate`, `setLanguage`; English source strings key [ru](../src/locales/ru.json), [es](../src/locales/es.json), [zh](../src/locales/zh.json) catalogs. [localized-element.js](../app/localized-element.js): `localizedCreateElement`, injected by [vite.config.js](../vite.config.js). | Follow the existing catalog and presentation adapter; preserve values/IDs while translating visible text | [localization-catalogs](../test/localization-catalogs.test.js), [localization-current](../test/localization-current.test.js), [Electron workflow](../test/localization.electron.cjs) |
| Showcase and recording | [ShowcaseWorkspace.jsx](../app/ShowcaseWorkspace.jsx), [showcase-export.js](../app/showcase-export.js), [preview-capture.cjs](../electron/preview-capture.cjs), [preview-ffmpeg.cjs](../electron/preview-ffmpeg.cjs) | [Rendering target](SHOWCASE-RENDERING.md), [FFmpeg provenance](../electron/ffmpeg/PROVENANCE.json) | [showcase-export](../test/showcase-export.test.js), [preview-capture](../test/preview-capture.test.js) |
| Desktop recovery, settings, game data, add-ons | [session.cjs](../electron/session.cjs), [recovery.cjs](../electron/recovery.cjs), [settings.cjs](../electron/settings.cjs), [game-data.cjs](../electron/game-data.cjs), [addons.js](../src/addons.js) | [Add-on API](ADDONS.md), [startup evidence](STARTUP_PERFORMANCE.md) | [session-journal](../test/session-journal.test.js), [game-data](../test/game-data.test.js), [addons](../test/addons.test.js) |
| Packaging and updates | [package.mjs](../scripts/package.mjs), [updater.cjs](../electron/updater.cjs), [release workflow](../.github/workflows/release.yml) | [Auto updates](AUTO_UPDATES.md), [portable release gate](UPDATER_RELEASE_GATE.md) | [updater](../test/updater.test.js), [release-gate harness](../test/updater-release-gate.cjs) |

## Run the relevant verification

Run commands from the repository root with the existing dependencies available.
[README](../README.md#source-development) and [package.json](../package.json) own
setup and script definitions; [CI](../.github/workflows/ci.yml) owns the merge checks.

- `node --test test/animation.test.js test/animation-tracks.test.js` is an example
  of a focused source run; substitute the verified test files from the matching row.
- `pnpm test` / `pnpm run test:compatibility` cover `tests/*.test.js`;
  `pnpm run test:source` covers `test/*.test.js`. These are different suites.
- Build first with `pnpm run build` when checks need bundled runtime assets;
  fetch pinned FFmpeg with `pnpm run fetch-ffmpeg` when required. Follow CI's
  order for a full run and its existing known-failure comparison.
- `.electron.cjs` files are separate interaction harnesses, outside those test
  globs. Inspect the chosen harness's setup/profile/environment requirements before
  running it. Do not label a source-only pass as packaged mouse/UI verification.
- `pnpm run test:packaged [variant] [all|core|names]` runs those harnesses
  (`test/*.cjs`) unattended on a hidden Windows desktop, under GPU/no-GPU/slow-CPU/
  HiDPI variants, with each harness's env/fixtures in one table. See
  [packaged-app tests](PACKAGED-TESTS.md).

For continuation, locate the matching active note in [agent tasks](agent-tasks/README.md)
or the existing topic handoff. Only open historical notes when their evidence is needed.
