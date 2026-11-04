# French and German - after 0.38.0

## Status

Both PRs are **ready for review; awaiting merge approval**. No merge or publication.

Session: codex Add French and German localization

- App: `codex/french-german`; started from origin/main `dd6fd30f38a9890e6b972bba283bf4b0e33d2703`, integrated current main `3295860ea006d68ef2c362fe202f978cf4f1d2f8`. [PR #539](https://github.com/UnsctMagic/MDLxL/pull/539).
- Website: `codex/mdlxl-french-german`; started from origin/main `ee19e5a775cf93e81dd00f8a7623e324f08fc164`, integrated current main `74670a2f2dd3ac41c081950a77f07f73792e8790`. [PR #56](https://github.com/UnsctMagic/LowPolyWorks/pull/56).
- All task work is in `D:\Codex\french-german`, hidden/off-screen. No installed app, real profile, version number, 0.38.0 release PR or PR #534 edits. No gh-pages push. Claude publishes at release time.
- Translation was authored entirely within Codex. No source text was sent to an external translation service.

## Catalogs and app

| Language | Keys |
| --- | ---: |
| English | Source strings |
| Russian | 7,912 |
| Spanish | 7,922 |
| Chinese | 7,781 |
| French | 8,058 |
| German | 8,058 |

The new catalogs follow Spanish order, then Russian/Chinese-only keys, then the source inventory. The final existing-catalog union is 7,986; 71 visible labels missing from main plus one contextual compact geoset-selection label bring each to 8,058. The inventory is `test/fixtures/locale-french-german-sources.json`. Current main added 62 particle descriptors during this session; both new catalogs include them. Existing catalogs are unchanged relative to current main.

UTF-8, CRLF checkout endings, exact keys and placeholder multiplicity are checked. Product/tool names, actual AI prompt examples, paths, IDs and keyboard keys remain literal. The geoset-selection context uses short FR/DE Clear labels while retaining generic Clear elsewhere. Split and sidebar labels were shortened; this branch changes no layout widths.

Languages, SVG flags, saved preferences, native-menu enumeration and update links accept fr/de. The packaged app verifies both catalogs.

## Website and tutorials

Seven guides: Anchor, Align, Live Select, Auto Corpse, Glow Up, ribbons and OptimizeXL. Each locale mirrors the Spanish inventory: 25 GIFs, animation-data.js, content.html and the tool/card PNGs. About/Credits have 118 translated prose entries per locale; Preview, shell, download/status text, routes, all pickers and query links accept fr/de.

New releases read French/German notes; absent or empty old notes fall back to English without an empty card. Historical release JSON is untouched. Generated model pages differ only in app.js and mdlxl.css cache keys; current model/portrait/catalogue changes on main are preserved.

Capture method: LowPolyWorks history and retained `lpw-tutorial-languages`/accepted Glow Up scripts establish native Electron CDP captures plus FFmpeg. Missing original ribbon/OptimizeXL authoring scripts were reconstructed from retained animation metadata using that same native workflow. Native UI is localized in the app; translated text is never painted onto English media. See the website capture-source README for reproducible scripts and permanent corpus inputs.

All 50 GIF loops decode and match embedded bytes, frame counts, timings and cue ranges. All 50 real-page complete loops and 22 native target centers passed, with zero resource/console errors and no horizontal overflow at desktop 1600x1032 and mobile 390x844. The final split labels lie outside every GIF crop; 14 main-window tool PNGs were refreshed on the final build while all GIF/embedded bytes remained identical.

## Verification

- `npx vite build`: passed on final 8,058-key catalogs and integrated main.
- `node --test test/localization*.test.js`: 28 pass / 0 fail / 0 skip.
- `node --test tests/*.test.js`: 57 pass / 0 fail / 0 skip.
- Release-material tests: 2 pass / 0 fail / 0 skip. Updater language checks: 3 pass / 0 fail / 0 skip.
- GitHub app CI [run 41745525007](https://github.com/UnsctMagic/MDLxL/actions/runs/41745525007): passed on code/verification commit `3e2081c1`; this final handover update changes documentation/results only.
- Website MDLxL tests: 8 pass / 0 fail / 0 skip. Project checker: 139 models / 10 armies plus assets and application syntax verified.
- Electron localization workflow: passed nine switches, native menus, particle/emitter controls, tint-conflict focus and unchanged model data/sidebar widths; passed again on the final package.
- Citadel locale workflow: passed all seven modes (en/ru/es/zh/fr/de/Mordor), five editor/dialog views each, input accepted and no renderer errors. Stable control IDs disambiguate colliding Mordor labels without skipping assertions.
- Main/sidebar enclosing-row audit: English/French/German all clear. Final packaged main, AnimXL, Forge and OptimizeXL captures passed in both locales; eight real mouse drags, no renderer errors or clipped translated labels.
- Hidden website checks: French/German About, Credits, Preview, picker/query/nav synchronization, hypothetical future notes and old English fallback passed; no page exceptions or horizontal overflow.

## Screenshots

In [verification/french-german](../verification/french-german/): `fr-main.png`, `de-main.png`; both language menus and native menu bars; OptimizeXL, AnimXL and Forge in both languages; two Citadel captures. Native menu JSON and small logs are in `D:\Codex\french-german\report`. Captures use the task-owned window on an invisible desktop, never the user desktop. Compact [results](../verification/french-german/results.json) include the final app hashes and tutorial scope.

## Next release: six languages

The first release after 0.38.0 requires authored release notes in EN / ES / RU / ZH-CN / FR / DE, six GitHub release-body links, six-language website JSON and localized in-app summaries. Every newly authored PDF guide group uses all six suffixes, including FR/DE; the draft workflow validates and attaches them. The package discovers current-version guides. No historical PDF or release note is generated or translated.

See [release recipe](../RELEASING.md) and [updates](../AUTO_UPDATES.md). Claude publishes the site at release time. The generator rejects historical versions and incomplete new guide language sets. No release material was generated for an already released version.

## Remaining gates and limits

Both branches are pushed and both PRs are open, non-draft and ready for review. Local verification and tutorial media work are complete. Owner merge approval and Claude QA remain required; this task does not merge, publish, tag or bump versions. Not every rare dialog/provider path was exercised, and editor checks do not prove Warcraft III/World Editor acceptance. No actual future release/PDF or GitHub Actions publication was run.
