# Native Surface Effects local prototype

Status: awaiting owner review; no commit or push authorized.
Owner: Codex
Updated: 2026-10-30

## Goal and completion criteria

A compact EMTR-style workspace: select a 1-based geoset, choose a native effect, preview, adjust simple controls, then apply once. Overlay, Replace, New geoset using the selected shape, and native eye geometry are supported. Native paths only; no authored texture files. Keep work local until the owner approves.

## Revision and local state

- Source: D:\Codex\mdlxl-global-effects, branch codex/global-effects-local.
- Base: 7a9bdf69cd3a319371b19aa60cf18165c58fb3fe, 0.37.0.
- Review package: D:\Codex\mdlxl-global-effects-preview\MDLxL-win32-x64.
- Native inventory and extraction evidence: D:\Codex\mdlxl-native-global-effects.
- Existing installation and original models are unchanged.

## Relevant owners

- app/SurfaceEffects.jsx and app/surface-effects.css: workspace and native library loading.
- src/surface-effects.js: curated native paths, draft/apply logic and resource reuse.
- AppToolbar/AppDialogs: FX entry.
- GamePreview.captureApi.fitGeoset frames the current skinned geometry. Solo uses its existing isolatedGeosets/hiddenGeosets contract.
- createResourceImporter owns references/deduplication; GamePreview owns native playback, camera and movement handles.
- openDocument owns native version and RGB colour conversion.

## Findings and decisions

- Twelve examples: two eyes; water, fire and waterfall skins; blade energy and cloud shimmer; current-texture flow, colour and visibility pulses; fire and water emitters.
- Native picture sequences and UV tracks are copied with their global durations. Source-local effect fades are flattened; destination sequence intervals and original rig tracks remain unchanged.
- New copied geometry keeps skin weights and geoset visibility. New eye geometry attaches to the dominant selected bone.
- RGB on a classic material overlay tints the entire selected geoset. Use New geoset for independent effect tint.
- Existing geoset alpha is retained. Material-layer-only visibility has no additional automatic cross-channel gating; that remains a native layering limitation to review.
- Eye textures reuse existing native paths even with different wrap flags. Other effects retain sampler flags when resource identity requires them.
- No texture images are generated or saved. Library thumbnails decode native bytes in memory.
- Classic models with bind-pose matrices are explicitly outside this prototype. No light, legacy model emitter, Popcorn or HD authoring is claimed.

## Changes and verification

- Native save/reopen and undo smoke checks cover 26 combinations; five resource/roundtrip checks plus eye wrapping reuse cover isolation, timing, UV preservation, RGB and Death visibility.
- Packaged check uses real mouse camera rotation and Move/Scale handles, all twelve effect choices, Apply, Undo and Save MDX. It also offers an optional Tzeentch knight fixture check via MDLXL_EFFECTS_KNIGHT.
- Baseline UI check failed on the missing FX button before implementation; dock-colour check failed before the new colour rule.
- Final results: 10 source/dock checks passed; the packaged 12-effect workflow and knight eye passed. Detailed results live with the review package. This is Codex verification, not Claude's final QA or Warcraft III runtime acceptance.
- Preview-only presentation intentionally strips node-editing props; placement therefore uses the existing editing presentation with explicit overlays. Do not reintroduce a second handle scheme.
- No live computer-use takeover, release, installed-profile replacement, commit, push or PR.

- Concurrent release tests own their out/ paths, including fixtures named in command lines. Copy test fixtures into this task’s out/ before launching; otherwise their cleanup can terminate the test app. Use a separate hidden desktop when suites run concurrently.

## Next action

Owner tries the local FX workflow, starting with the moving shield eye. Gather workflow feedback before committing. Claude reruns applicable verification before any merge.

