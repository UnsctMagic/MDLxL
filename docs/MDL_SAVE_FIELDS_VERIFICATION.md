# MDL save-field audit and verification

Task 6, baseline `9ebd84d04b23357e601bc36ea7b3910122db1509`, 2026-10-13. This audit was written before changing the codec. All inputs were hashed copies; the originals were read only. No model assets are committed.

## Findings before the patch

- N002: the layer stores unsigned `44644536` (`0x2a938b8`), not one of the seven standard filter modes. The generator indexes the mode-name enum and emits `FilterMode ,`; the reader defaults that missing name to zero.
- N007, N024, N037, N038, N060: all 60 affected GEOA flags are `26` (`0x1a`). Bit `2` enables tint, bit `1` is clear, and `0x18` has no standard GEOA MDL token. The writer emits the color but loses `0x18`; reopening returns `2`. DropShadow generation already tests bit 1 correctly.
- N066: both RIBB static color vectors are exactly `[1, 1, 1]`. The dependency omits white static colors; its ribbon reader initializes missing Color to null. The compatibility writer already handles enabled white GEOA color, but not white ribbons.

## Interpretation and correction boundary

The game-format comparison uses the documented seven material filter modes and the two defined GEOA bits. These unexpected numbers are stored MDX data, not additional named blend modes or node flags. In particular, GEOA `0x18` must not be interpreted as node billboard flags. No proprietary Warcraft III runtime test was performed, and the rendering meaning of filter value `44644536` is unestablished.

[MDX-M3-Viewer layer codec](https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/parsers/mdlx/layer.ts) preserves the numeric MDX filter and uses `None` for an unrecognized MDL mode. Its [GEOA codec](https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/parsers/mdlx/geosetanimation.ts) reads the full MDX integer but only has DropShadow and Color syntax in MDL. Its [ribbon codec](https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/parsers/mdlx/ribbonemitter.ts) emits an explicit static Color including white.

Retera's [GEOA implementation](https://github.com/Retera/ReterasModelStudio/blob/master/craft3data/src/com/hiveworkshop/wc3/mdl/GeosetAnim.java) also interprets only bits 1 and 2 and has no MDL spelling for the remaining bits. [OpenWarcraft3's format documentation](https://corepunch.github.io/open-realm/games/warcraft-3/file-formats/mdx/) documents the seven layer modes and ribbon tint; it is an independent engine implementation, not a retail-game execution result.

The fix stays in the MDL compatibility codec and its source-record boundaries: emit legal `FilterMode None` for the unrecognized number, preserve the original number in an owner-scoped MDLxL line comment, and preserve only the unnamed GEOA bits in such a comment. Other readers ignore these comments and see standard MDL fields; only MDLxL restores the raw values for exact MDX re-export. A different editor that removes the comments will lose these raw values. Explicit standard flags remain editable. Always emit an omitted static ribbon Color. Save equivalence and export validation stay unchanged.

## Exact field audit

Offsets are zero-based bytes in the supplied MDX. A Color-track body is abbreviated below because it does not change the audited Flags value; complete pre-patch candidate snippets are retained in `field-audit-before.json` in the local results.

| Model | Field | Byte offset | Raw MDX / MDLxL value | Pre-patch MDL | Reopened value |
| --- | --- | ---: | --- | --- | --- |
| N002 | Materials[4].Layers[0].FilterMode | 932 | 44644536 | FilterMode , | 0 |
| N007 | GeosetAnims[0].Flags | 70820 | 26 | static Color { 1, 1, 1 }, | 2 |
| N007 | GeosetAnims[1].Flags | 70896 | 26 | static Color { 1, 1, 1 }, | 2 |
| N007 | GeosetAnims[2].Flags | 70972 | 26 | static Color { 1, 1, 1 }, | 2 |
| N007 | GeosetAnims[3].Flags | 71096 | 26 | static Color { 1, 1, 1 }, | 2 |
| N007 | GeosetAnims[4].Flags | 71300 | 26 | static Color { 1, 1, 1 }, | 2 |
| N007 | GeosetAnims[5].Flags | 71504 | 26 | static Color { 1, 1, 1 }, | 2 |
| N007 | GeosetAnims[6].Flags | 71684 | 26 | static Color { 1, 1, 1 }, | 2 |
| N007 | GeosetAnims[7].Flags | 71864 | 26 | static Color { 1, 1, 1 }, | 2 |
| N007 | GeosetAnims[8].Flags | 72044 | 26 | static Color { 1, 1, 1 }, | 2 |
| N007 | GeosetAnims[9].Flags | 72224 | 26 | static Color { 1, 1, 1 }, | 2 |
| N007 | GeosetAnims[10].Flags | 72404 | 26 | static Color { 1, 1, 1 }, | 2 |
| N024 | GeosetAnims[0].Flags | 64926 | 26 | static Color { 1, 1, 1 }, | 2 |
| N024 | GeosetAnims[1].Flags | 64994 | 26 | static Color { 1, 1, 1 }, | 2 |
| N024 | GeosetAnims[2].Flags | 65062 | 26 | static Color { 1, 1, 1 }, | 2 |
| N024 | GeosetAnims[3].Flags | 65218 | 26 | static Color { 1, 1, 1 }, | 2 |
| N024 | GeosetAnims[4].Flags | 65286 | 26 | static Color { 1, 1, 1 }, | 2 |
| N024 | GeosetAnims[5].Flags | 65354 | 26 | static Color { 1, 1, 1 }, | 2 |
| N024 | GeosetAnims[6].Flags | 65422 | 26 | static Color { 1, 1, 1 }, | 2 |
| N024 | GeosetAnims[7].Flags | 65490 | 26 | static Color { 1, 1, 1 }, | 2 |
| N024 | GeosetAnims[8].Flags | 65558 | 26 | static Color { 1, 1, 1 }, | 2 |
| N024 | GeosetAnims[9].Flags | 65626 | 26 | static Color { 1, 1, 1 }, | 2 |
| N037 | GeosetAnims[0].Flags | 66486 | 26 | static Color { 1, 1, 1 }, | 2 |
| N037 | GeosetAnims[1].Flags | 66682 | 26 | static Color { 1, 1, 1 }, | 2 |
| N037 | GeosetAnims[2].Flags | 66846 | 26 | static Color { 1, 1, 1 }, | 2 |
| N037 | GeosetAnims[3].Flags | 66962 | 26 | static Color { 1, 1, 1 }, | 2 |
| N037 | GeosetAnims[4].Flags | 67134 | 26 | static Color { 1, 1, 1 }, | 2 |
| N037 | GeosetAnims[5].Flags | 67274 | 26 | static Color { 1, 1, 1 }, | 2 |
| N037 | GeosetAnims[6].Flags | 67470 | 26 | static Color { 0, 0.800000011920929, 1 }, | 2 |
| N037 | GeosetAnims[7].Flags | 67666 | 26 | static Color { 1, 1, 1 }, | 2 |
| N037 | GeosetAnims[8].Flags | 67830 | 26 | static Color { 1, 1, 1 }, | 2 |
| N037 | GeosetAnims[9].Flags | 67994 | 26 | static Color { 1, 1, 1 }, | 2 |
| N038 | GeosetAnims[0].Flags | 60893 | 26 | static Color { 1, 1, 1 }, Color 31 { ... } | 2 |
| N038 | GeosetAnims[1].Flags | 61697 | 26 | static Color { 1, 1, 1 }, Color 31 { ... } | 2 |
| N038 | GeosetAnims[2].Flags | 62501 | 26 | static Color { 1, 1, 1 }, Color 31 { ... } | 2 |
| N038 | GeosetAnims[3].Flags | 63305 | 26 | static Color { 1, 1, 1 }, Color 31 { ... } | 2 |
| N038 | GeosetAnims[4].Flags | 64109 | 26 | static Color { 1, 1, 1 }, Color 31 { ... } | 2 |
| N038 | GeosetAnims[5].Flags | 64913 | 26 | static Color { 1, 1, 1 }, Color 31 { ... } | 2 |
| N038 | GeosetAnims[6].Flags | 65717 | 26 | static Color { 1, 1, 1 }, Color 31 { ... } | 2 |
| N038 | GeosetAnims[7].Flags | 66521 | 26 | static Color { 1, 1, 1 }, Color 31 { ... } | 2 |
| N038 | GeosetAnims[8].Flags | 67325 | 26 | static Color { 1, 1, 1 }, Color 31 { ... } | 2 |
| N038 | GeosetAnims[9].Flags | 68129 | 26 | static Color { 1, 1, 1 }, Color 31 { ... } | 2 |
| N038 | GeosetAnims[10].Flags | 68933 | 26 | static Color { 1, 1, 1 }, Color 31 { ... } | 2 |
| N038 | GeosetAnims[11].Flags | 69737 | 26 | static Color { 1, 1, 1 }, Color 31 { ... } | 2 |
| N038 | GeosetAnims[12].Flags | 70541 | 26 | static Color { 1, 1, 1 }, Color 31 { ... } | 2 |
| N038 | GeosetAnims[13].Flags | 71345 | 26 | static Color { 1, 1, 1 }, Color 31 { ... } | 2 |
| N038 | GeosetAnims[14].Flags | 72149 | 26 | static Color { 1, 1, 1 }, Color 31 { ... } | 2 |
| N038 | GeosetAnims[15].Flags | 72953 | 26 | static Color { 1, 1, 1 }, Color 31 { ... } | 2 |
| N038 | GeosetAnims[16].Flags | 73757 | 26 | static Color { 1, 1, 1 }, | 2 |
| N038 | GeosetAnims[17].Flags | 74049 | 26 | static Color { 1, 1, 1 }, | 2 |
| N038 | GeosetAnims[18].Flags | 74333 | 26 | static Color { 0.2509799897670746, 0.5019609928131104, 1 }, | 2 |
| N038 | GeosetAnims[19].Flags | 74649 | 26 | static Color { 0.05490199849009514, 0.7294120192527771, 0.9960780143737793 }, | 2 |
| N038 | GeosetAnims[20].Flags | 74965 | 26 | static Color { 0.05490199849009514, 0.7294120192527771, 0.9960780143737793 }, | 2 |
| N060 | GeosetAnims[0].Flags | 32545 | 26 | static Color { 1, 1, 1 }, | 2 |
| N060 | GeosetAnims[1].Flags | 32613 | 26 | static Color { 1, 1, 1 }, | 2 |
| N060 | GeosetAnims[2].Flags | 32681 | 26 | static Color { 1, 1, 1 }, | 2 |
| N060 | GeosetAnims[3].Flags | 32805 | 26 | static Color { 1, 1, 1 }, | 2 |
| N060 | GeosetAnims[4].Flags | 32929 | 26 | static Color { 1, 1, 1 }, | 2 |
| N060 | GeosetAnims[5].Flags | 33053 | 26 | static Color { 1, 1, 1 }, | 2 |
| N060 | GeosetAnims[6].Flags | 33201 | 26 | static Color { 1, 1, 1 }, | 2 |
| N060 | GeosetAnims[7].Flags | 33349 | 26 | static Color { 1, 1, 1 }, | 2 |
| N066 | RibbonEmitters[0].Color | 278528 | [1,1,1] | (omitted) | null |
| N066 | RibbonEmitters[1].Color | 278792 | [1,1,1] | (omitted) | null |

## Verification after the patch

All 63 listed fields are exact after MDX -> MDL -> MDX. Unnamed values are restored from comments on the owning closing line. The GEOA section span includes that annotation so an ordinary edit or removal also replaces/removes the correct raw flags. Comments remain attached to their records; quoted paths and nested animation comments are not interpreted as raw-field annotations. An explicitly selected standard filter mode and cleared reserved flags remove obsolete annotations on regeneration.

| Corpus | MDX before | MDX after | MDL before | MDL after |
| --- | ---: | ---: | ---: | ---: |
| Supplied 75 SD models | 75/75 | 75/75 | 68/75 | 75/75 |
| 30 original Blizzard units | 30/30 | 30/30 | 30/30 | 30/30 |
| Total | 105/105 | 105/105 | 98/105 | 105/105 |

MDX checks require byte-identical unmodified output. MDL checks include the normal strict save verification, reopen, and MDL -> MDX regeneration/reopen. Every previous format pass remains a pass. The exact post-save fields are recorded in the local `field-audit-after.json` results.

- Focused in-memory regression: **12/12 pass**, exercising all 60 affected GEOA records, the material field, both ribbon colors, uint32 boundary bytes, explicit edits, repeated saves, owner scope, and rejection of real losses. No model files are committed.
- Full source suite on unchanged main: **1,560 tests, 1,525 pass, 17 fail, 18 skip**. Final patch: **1,572 tests, 1,536 pass, 17 fail, 19 skip**. The 17 failure titles are identical. The additional conditional skip is the updater test requiring 8.3 short TEMP names, which this D: volume does not provide. Existing failures include unavailable fixture data, missing pre-build particle runtime/FFmpeg, and three existing Popcorn tests.
- Production build: **pass**, using `pnpm --config.verify-deps-before-run=false run build` with the shared node_modules junction. No dependency install or version change is part of the patch.
- Independent Retera craft3data 0.4.5 parser: **7/7 generated MDL files load**. It reads the Chinese Dragon layer as standard None, and both Werewolf colors as white. Across the five GEOA models, its MDX and generated-MDL reads retain **76 tracks and 1,585 keys exactly**, including frame values, interpolation, global sequence IDs and cubic tangents. These closing-line annotations avoid its comment-only-line parsing defect ([MDLReader source](https://github.com/Retera/ReterasModelStudio/blob/master/craft3data/src/com/hiveworkshop/wc3/mdl/MDLReader.java)). Its original Chinese Dragon MDX read rejects filter ordinal 44644536 as outside the seven-mode enum; raw integer preservation is provided by MDLxL, not certified for another editor's re-export.
- All **75 original input SHA-256 hashes remain unchanged**. The 30 Blizzard copies match the earlier archive extraction hashes; archive size/mtime stayed unchanged during extraction.
- No retail Warcraft III playback or packaged GUI test was performed. This is codec and saved-data verification; the undocumented filter number's rendering behavior remains unestablished.

Source changes are limited to `src/mdl-compatibility.js` and the GEOA annotation boundary in `src/editor-document.js`; `src/save-equivalence.js` and the color export gate are unchanged. Local test copies, generated build output and scratch data are removed after verification. Small logs and JSON evidence are retained outside the finished worktree.
