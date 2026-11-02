# Library texture World Editor verification

2026-11-01 · branch `codex/library-textures-world-editor` · base main `463bfef5`
(contract base `f3cbd71d`; fail-first baseline `b2365c65`; contract PR #499).

Implementation reuses the Models tree, icon cache, catalogue cache, row rendering,
search and keyboard navigation. Texture entries read only texture lists and resolve
metadata through the existing model-module-first resolver. Existing tiles, details,
actions, Standard search/folders and model/sound/file workflows remain in place.

| Check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| `pnpm test` | 57 | 0 | 0 |
| Focused source: game-file-library, world-editor-catalog, world-editor-textures, texture-library, localization-catalogs | 52 | 0 | 0 |
| Packaged contract phase (`MDLXL_TEXTURES_ONLY=1`) | 10 named checks | 0 | 0 |
| Packaged existing workflow (`MDLXL_LIBRARY_EXISTING_ONLY=1`) | 21 named checks | 0 | 0 |
| Acceptance T1–T11 across these two phases | 11 | 0 | 0 |

Both packaged phases ran on `WinSta0\MDLxLTests`, with isolated profiles, real
Playwright clicks/keys/wheel and actual mouse rotation. Both used the same final
packaged renderer. Footman: 69 ms first click, 37 ms cached click. T4 used
Dispel Magic (2 art models) and Mushrooms (4 variations). Reforged Footman showed
24 textures, with every thumbnail decoded after real wheel scrolling.

Bundle identity (matches current `dist/` exactly):
- index: `27a6235c2c2927d58d26e3e91b875db4e941bd71e40c2b696319c21cf46bdaa4`
- assets: `94b9133a97aad0fd35bc84f46a22763766b478af537733d7dec0d16aff6ca868`

Fail-first evidence on `b2365c65`: Textures had no World Editor Style button
(the new interaction check timed out looking for it); the metadata-only resolver
assertion failed `0 !== 1` when picture reads were forbidden. The new helper test
also failed to import before its implementation existed.

The old workflow expected two global success messages. `App.say` intentionally
suppresses non-error information. The `say` function was verified identical
on baseline `b2365c65`, current main and this branch. A packaged baseline
UV proof recorded zero model changes and no old toast after 10 seconds; new
Standard and World Editor proofs also recorded zero model changes. The checked
workflow now asserts the ended draft and unchanged model, and directly verifies
New material's count, texture reference and unchanged geoset assignments. App/UV
product behavior was not changed to satisfy stale messages.

Translation reconciliation retained every current-main key and added exactly the
new choose-entry prompt in each language. The strict catalogue-size assertion
was updated by +1 per language (ru 7408, es 7424, zh 7288); the failed catalogue
check was rerun successfully. Final distinct focused checks: 52 passed / 0 failed /
0 skipped, including both translation checks.

PR: https://github.com/UnsctMagic/MDLxL/pull/502
Implementation revision: `6ec1091db2fa92f0d730dca1cb35e4939458085a`.

## Captures

- [T1: default tree](textures-T1.png)
- [T2: Classic Footman](textures-T2.png)
- [T5: Reforged Footman](textures-T5.png)

## Owner click-through

Library → Textures → Human → Units → Normal → Footman → click a texture →
Add texture to model.

Ready to test; independent Claude QA and owner visual acceptance remain pending.
Warcraft III gameplay was not exercised. No merge, release or installed-profile
change was performed. Disposable packages, profiles and runtimes are removed
after verification; only source, this evidence and small result logs are retained.
