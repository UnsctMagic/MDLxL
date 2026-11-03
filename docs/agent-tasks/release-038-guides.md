# 0.38.0 New Features guides

Status: Ready for Claude QA; awaiting merge approval
Owner: Codex (Session: codex release-0.38.0 guides)
Updated: 2026-11-03

## Goal and scope

Four nine-page A4 PDFs in EN, ES, RU and ZH-CN, with real screenshots of all nine requested headline features. Title: `MDLxL 0.38.0 - New Features`. No application implementation or locale edits. PR targets `claude/release-0.38.0`, not main; do not merge without owner approval.

## Revision and handover

- Branch: `codex/release-0.38.0-guides`.
- Base: `claude/release-0.38.0` at `6bcacdb7b9850238688196db271d2294f7019696` (remote rechecked unchanged).
- Working checkout: `D:\Codex\release-038-guides`; removed after push as required.
- Kept local deliverables and small verification logs: `D:\Codex\release-038-guides-report`.
- Generator: `D:\Claude\MDLxL-gate\features-0.38.0` (`shots.cjs`, `content.mjs`, `build.mjs`); copied from 0.37.0, whose folder was left untouched. `shots/<locale>` retains this release's source captures and bounds. `previews` holds the four first pages.
- To rebuild in a release checkout: copy generator `shots` to the checkout's `out/feature-shots`, then run `node D:\Claude\MDLxL-gate\features-0.38.0\build.mjs`. Capturing again requires a fresh package and `MDLXL_TEST_EXE` pointing to it. Run each `shots.cjs <en|es|ru|zh>` through `scripts/hidden-run.ps1` on MDLxLTests, with Set-Location to the checkout in the same PowerShell call and TEMP/TMP on D:.

## Changes

- Added `docs/MDLxL-0.38.0-New-Features-{EN,ES,RU,ZH-CN}.pdf` and four first-page preview PNGs.
- Replaced only `0.37.0-New-Features` with `0.38.0-New-Features` in `scripts/package.mjs` runtimeGuides. Kept the AI Guide, AI Sign-in and Interface Map guides.
- Removed the four old New Features PDFs after repository link search found no reference besides the replaced runtime entry.
- Content comes from the four release notes and current UI owners. Named controls resolve through `src/localization.js` and `src/locales/*.json`. Plain short steps; no marketing copy.

## Verification

- `npx vite build`: passed (existing chunk-size warning only).
- `node scripts/package.mjs --out out/pkg`: passed before captures and again with the final PDFs; 1,426 runtime/asset files verified, 55 Electron locale files preserved. All four packaged PDF SHA-256 hashes matched docs. Disposable packages removed after use.
- `node --test tests/*.test.js`: 57 passed, 0 failed, 0 skipped.
- All MDLxL captures ran on the invisible MDLxLTests desktop using the packaged 0.38.0 app. No computer-use skill or owner-desktop control was used.
- Every source screenshot inspected before printing. Every final PDF page rendered with Poppler and visually reviewed; 9 A4 pages per language. Headless Chrome layout inspection found no content/footer overlap or missing images. Extracted text has the exact title on each page, no 0.37.0 version and no unresolved label markers.
- Real mouse drags rotated FX, EMTR placement and Sphereomancer previews; captured gizmo with constraints off and orange Shift lock with constraints on.
- Test inputs came from `D:\Claude\MDLxL-TestModels` through fixtures.cjs; collection untouched. Fix model capture seeded a plain Translation value in a disposable real-model session, then clicked Bones and Fix through the UI. This is screenshot setup, not an independent regression test.
- Real profiles, installation, user libraries and game files were not modified. EMTR used a copied index in disposable profiles; stale copied index was rebuilt there before captures.
- Claude still owns independent QA and the full release/update gate. This work did not exercise Warcraft III/World Editor, updater acceptance, or the full local source suite.

## App findings visible in screenshots (not hidden or fixed here)

1. Fix model item labels retain English `Translation` in ES/RU/ZH even though the surrounding prompt is translated (page 9). Owner: `src/plain-track-values.js` plainTrackValues constructs `${node.Name} · ${property}`; `app/AppDialogs.jsx` renders that whole dynamic string. The catalog already translates `Translation` by itself. Node name `gutz00` is authored data and should stay unchanged.
2. EMTR's generated recipe descriptors `Red streaks`, `Pale smoke`, `Golden smoke` remain English in ES/RU/ZH (page 5). Source recipe/item identity and game names are data; the gap is the app-generated descriptors. Owners include `src/particle-library-browse.js` distinctParticleNames and `app/ParticleLibrary.jsx`.
3. World Editor texture search breadcrumbs show `Human › Units › Normal/Campaign` in ES/RU/ZH (page 7). `app/WorldEditorTree.jsx` joins the raw trail, and renders search detail with translate="no". The game installation is English, so authored names such as Footman are expected to remain English; the category breadcrumb is the localization gap.
4. In RU, the long Separate by loose parts label overflows the fixed sidebar row, leaving Nuclear out of view (page 8). Nuclear Weld itself remains visible and legible. Owner: `app/AppSidebar.jsx` / the existing `.classic-geoset-operations` row. Other narrow controls show truncation as captured (e.g. FX Add emitter); no app layout edits are included.

## Next action

Claude: review the PDFs/previews and the reported app gaps, rerun required QA on this branch, and continue release work through its release PR. Do not treat screenshot completion as approval to merge or publish.
