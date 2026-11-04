# French and German — after 0.38.0

## Status

In progress. Not ready for merge. No version bump, merge, site publication,
0.38.0 release-PR edit or PR #534 edit is authorized by this task.

Session: codex Add French and German localization

- App: `codex/french-german`, based on origin/main
  `dd6fd30f38a9890e6b972bba283bf4b0e33d2703`. PR pending.
- Website: `codex/mdlxl-french-german`, based on origin/main
  `ee19e5a775cf93e81dd00f8a7623e324f08fc164`. PR pending.
- Workspace: `D:\Codex\french-german`. Everything is background/hidden;
  no computer-use skill or real profile/installation changes.

## Scope and inventory

- New catalogs: target **7,996 keys each**, in Spanish catalog order, then
  Russian/Chinese-only keys, then 71 visible labels proven missing on main and one context-specific
  compact geoset-selection label.
  Existing counts: English uses source text, ru 7,850; es 7,860; zh 7,719.
  Catalog union: 7,924. A Babel JSX/attribute audit added 28 labels beyond the
  initial 43-label text inventory. Source-only additions are recorded in
  `test/fixtures/locale-french-german-sources.json`.
- Registration, SVG flags, preference persistence, native-menu translation
  and package verification cover fr/de. Existing UI widths are unchanged.
- Seven site tutorials: Anchor, Align, Live Select, Auto Corpse, Glow Up,
  ribbons, OptimizeXL. Spanish inventory is **25 GIFs** plus tool/card PNGs.
  French/German prose is authored; native-language recording is in progress.
- About/Credits prose has 118 translated entries per new language. Page,
  release and tutorial language pickers and query links accept fr/de.
- Older release JSON and PDFs remain untouched. The site uses English when
  French/German notes are absent or empty.

## Future release material

The first release after 0.38.0 must have notes and new guide PDFs in
EN / ES / RU / ZH-CN / FR / DE, six GitHub release-body links, six-language
website release JSON, and localized in-app update text. See
[release recipe](../RELEASING.md) and [updates](../AUTO_UPDATES.md).
The generator rejects historical versions and incomplete new PDF sets.
It never translates old material; existing historical guides keep their
original language set. Claude publishes the site at release time.

## Verification so far

- Failing on main: fr registration was undefined; future fr update link was
  undefined; website fr raw note source was null. New checks prove each gap.
- Pilot `npx vite build`: passed (partial catalogs, capture setup only).
- Release-material checks: 2 pass / 0 fail / 0 skip.
- Website MDLxL checks: 7 pass / 0 fail / 0 skip.
- Hidden browser: fr/de About, Credits, Preview, picker/query handling,
  hypothetical future localized notes and old English fallback passed;
  no page exceptions or horizontal overflow. Four page screenshots in
  `D:\Codex\french-german\report`.
- Final build, prescribed catalog/compatibility tests, Electron localization,
  Citadel locale workflow, busy-editor screenshots and full tutorial playback
  remain pending. No claim of Warcraft III runtime acceptance.

## Capture provenance

First four tutorial scripts reuse `D:\Codex\lpw-tutorial-languages`;
Glow Up uses the accepted `lpw-glow-up-revision` script. Ribbon and OptimizeXL
original authoring scripts were cleaned up; their action sequences are being
reconstructed from retained animation metadata using the same Electron CDP,
offscreen native-window capture and FFmpeg method. No translated text is
painted over English recordings. Pilot assets are isolated from site assets.
