# French and German - completed, merged

## Status

Completed and merged with owner approval on 2026-11-04. Site publication and the next release remain separate.

Session: codex Add French and German localization

- App: [PR #539](https://github.com/UnsctMagic/MDLxL/pull/539), merged as `babee7c8ec8c28f0b6b057fba781c793cccd6d98`; reviewed head `35cda62dc4f8565b6bda6e3460a006ba262e2ce2`. French/German catalogs, registration and release generator verified on online main.
- Website: [PR #56](https://github.com/UnsctMagic/LowPolyWorks/pull/56), merged as `1fb8cba0641b8a5cc297de48b556bdb9bf9d3491`; reviewed head `8dc06259fcbf8964bfcdc652b51662f91c194be4`. Localized content, both data modules, new FX GIFs and renderer verified on online main.
- Branches: `codex/french-german` and `codex/mdlxl-french-german`. Both started from latest origin/main at task start and integrated later published main changes before merging.
- All task work used `D:\Codex\french-german`, hidden/off-screen. No installed app or real profile changes. No task version bump, release tag, gh-pages push or publication. The published 0.38.0 notes/PDFs/site JSON and PR #534 were not translated or edited.
- Translation was authored entirely within Codex; no source text was sent to an external translation service.

## Catalogs and app

| Language | Keys |
| --- | ---: |
| English | Source strings |
| Russian | 7,924 |
| Spanish | 7,934 |
| Chinese | 7,793 |
| French | 8,125 |
| German | 8,125 |

The new catalogs follow Spanish order, then Russian/Chinese-only keys, then the explicit source inventory. The existing-catalog union is 7,998; 126 missing visible UI/checker labels and one contextual compact geoset-selection label bring each new catalog to 8,125. See `test/fixtures/locale-french-german-sources.json`. Current main added 62 particle descriptors and 12 Sanity Check labels during the session; both new catalogs cover them. Existing ru/es/zh catalogs are unchanged by this task relative to merged main.

UTF-8, CRLF checkout endings, exact key order and placeholder multiplicity are checked. Product/tool names, actual AI prompt examples, keyboard keys and data remain literal. `app/hive-localization.js` translates only checker prose; captured names, paths, IDs and fields stay literal, including names such as Rotation that also match UI labels. The known-template inventory comes from the untouched bundled checker.

Languages, SVG flags, preferences, native menus, update links and package verification accept fr/de. Short labels fit the existing widths; this branch did not resize layouts.

## Website and every current tutorial

Eight guides: Anchor, Align, Live Select, Auto Corpse, Glow Up, ribbons, OptimizeXL and FX. Each new locale mirrors the current Spanish media inventory: **29 GIFs and 18 PNGs**, plus localized content and animation data. Total: **58 French/German GIFs**. About/Credits have 118 translated prose entries per locale; Preview, shell/download/status text, routes, pickers and query links accept fr/de.

FX reached main while the lane awaited approval. Its 75 text parts/four accessible captions and four genuine native GIFs/card per locale were added before the authorized merge. A new inventory test failed first on missing FX media and now requires French/German to cover every Spanish guide and GIF/PNG.

New releases accept fr/de notes; missing or empty older notes fall back to English without an error/empty card. Historical release JSON is unchanged. The 139 generated model pages change only app.js/mdlxl.css cache keys; current model/catalogue/portrait work on main was preserved.

## Capture provenance and preservation

The native Electron/CDP compositor plus FFmpeg method is documented in [website capture sources](https://github.com/UnsctMagic/LowPolyWorks/tree/main/tools/mdlxl-tutorial-capture). Original retained authoring scripts were reused; missing ribbon/OptimizeXL sequences were reconstructed from retained timeline metadata with the same workflow. Text was never painted onto English screenshots.

The original 50 GIFs, 34 PNGs and 50 embedded animation records remain hash-identical after adding FX. The initial recordings used the 7,996-key build; 14 sidebar-only stills were refreshed at 8,058 keys after crop/occlusion proof. Later checker-only strings are outside those media views. FX uses the final frozen 8,125-key renderer on published 0.38.0 source.

FX embedded records use a small companion `fx-animation-data.js` per locale, statically merged by the existing `animation-data.js` default-export API. Combined French metadata exceeded GitHub's 100MiB limit. Both base/FX modules remain below it; the loader/player API and all older payloads are unchanged.

## Verification

- Post-conflict `npx vite build`: passed; no release version or historical material changed.
- Localization source checks: **31 pass / 0 fail / 0 skip**. Release-material checks: **2 / 0 / 0** (combined merge run 33 / 0 / 0).
- Compatibility tests: **57 pass / 0 fail / 0 skip**. Updater language checks: **3 / 0 / 0**. Sanity Check source checks: **5 / 0 / 0**.
- App [CI run 41755810233](https://github.com/UnsctMagic/MDLxL/actions/runs/41755810233) passed on reviewed head `35cda62d`: build, compatibility and the full source-suite gate against the repository baseline. The baseline was not widened.
- Website checks: **9 pass / 0 fail / 0 skip**; project checker verified **139 models / 10 armies**, assets and application syntax.
- Hidden Electron localization workflow passed nine language switches, native menus, particle/emitter labels, tint-conflict focus, unchanged model data and sidebar widths. Citadel passed all seven modes (en/ru/es/zh/fr/de/Mordor), five views/dialogs each, real inputs and no renderer errors.
- Packaged main, AnimXL, Forge and OptimizeXL review: eight real mouse drags, unchanged source fixture/sidebar widths, no renderer errors or clipped translated labels. Enclosing sidebar-row checks passed English/French/German. Final French/German Sanity and expanded OptimizeXL checker dialogs also passed with literal diagnostic data. These phase captures are identified in the screenshot README.
- All **58 GIFs** decoded and matched metadata/frame counts/timings/cues. The original 50 complete real-page loops passed and remained byte-identical; all **8 new FX natural full loops** passed at page size. Browser ESM imports contain 29 animation records per locale.
- Old 22 measured native tool-ping centers passed. New FX **22 recorded green control cues** passed GIF-pixel checks; 2,582 new frames had zero blank viewport frames or isolated return jumps. FX has no POSE-edit step.
- Native main and FX preview camera positions changed under real mouse drags in both locales. One blade-only FX commit preserved the original geometry, rig and animations. Desktop 1600x1032/mobile 390x844 had eight cards, no horizontal overflow, console errors or missing resources.
- French/German About, Credits, Preview, picker/nav/query synchronization, hypothetical future notes and old English fallback passed hidden browser checks.

## Screenshots and small reports

[Verification captures](../verification/french-german/) include both main windows, language pickers, native menu bars, AnimXL, Forge, OptimizeXL, Citadel, Sanity Check, expanded checker findings and FX controls. See [compact results](../verification/french-german/results.json). Main/busy-editor packaged captures were made at 8,058 keys; later checker and FX captures cover their final renderers. Native windows were captured on the invisible test desktop, never the user desktop.

Local small reports/screenshots are in `D:\Codex\french-german\report`. Disposable working checkouts, builds, profiles, raw frames, caches and unused processes are removed after verification. Original/permanent model collections remain untouched.

## Next release: six languages

The first release after 0.38.0 requires authored release notes in EN / ES / RU / ZH-CN / FR / DE, six GitHub release-body links, six-language website JSON and localized in-app summaries. Every newly authored PDF guide group uses all six suffixes, including FR/DE; the draft workflow validates and attaches them. Packaging discovers current-version guides. Released notes/PDFs/JSON are never backfilled; tutorials are the exception and remain maintained in every tutorial language.

See [release recipe](../RELEASING.md) and [updates](../AUTO_UPDATES.md). Claude publishes the site at the next release. The generator rejects historical versions and incomplete new guide sets. No actual future release material was generated or published by this task.

## Remaining limits

Code and source-site merges are complete. Site publication remains with Claude at release time. Not every rare dialog/provider path was exercised, editor checks do not prove Warcraft III/World Editor acceptance, and the actual future release/PDF publication workflow has not been executed. No installed-app upgrade was performed.
