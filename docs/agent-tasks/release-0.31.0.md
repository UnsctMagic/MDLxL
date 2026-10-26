# MDLxL 0.31.0 release

Status: completed
Owner: Claude release session (local_1123ecca-aa7a-429e-9bd7-709e71511514)
Updated: 2026-10-25

## Result

- Published [MDLxL 0.31.0](https://github.com/UnsctMagic/MDLxL/releases/tag/v0.31.0)
  on 2026-10-25 04:40 UTC from tag v0.31.0 (merge 2d6ca1e8 of release PR #300).
  Contents since 0.30.1: #288, #291 (with #287), #292, #293, #294, #295, #296 (new
  look), #297, #298, plus the fixes in #300.
- Notes in EN/ES/RU/ZH-CN, ordered by importance (AI, then the new look with VIS
  still the classic MDLVis look, then the rest). Live on the MDLxL page via
  LowPolyWorks #39 (main) and gh-pages 035b48ad.
- New PDF guides in four languages (AI console, AI sign-in, interface map) are in
  `docs/`, shipped in the package and attached to the release. Old PDFs were removed
  from `docs/`. Old PDF assets on earlier GitHub releases were left (deleting release
  assets is permanent; the owner can remove them).
- Garithos workflow run 40162766883 succeeded. Shipped Claude sessions archived;
  Codex-owned #287, #288, #293 left for Codex.

## Owner decisions (given up front for an unattended run)

Merge #296 once ready, merge the release PR, publish site notes and the release.
New test failures versus 0.30.1: fix, then release. A late #296: keep waiting.

## Fixes found by the full packaged-app run (in #300)

- Forge Shift snap-rotate of a detail copy broke in #293 (bisected; passes on 0.30.1).
  Live Coords re-rendered the whole Forge editor per mouse move; only the Coords
  fields (`ForgeCoordinates` in `app/ForgeEditor.jsx`) re-render now.
- Forge's wrapped shape tools and Shape/Edge/Vertex get the new carved tiles.
- "Fix" in the duplicate geoset animation dialog translated.
- Tests updated for #292/#294/folded Stats; runner gives AI tests the package and a
  normal window; `ai-live` skipped (opt-in real account).

## Verification

- Source suite 1,936 pass / 0 fail / 13 skipped; compatibility 57 pass; PR CI green.
- Packaged suite (default, all): 127 pass, 24 configured skips; every failure fixed and
  rerun green, then `core` 28/28 and a Forge/UI/AI list green on the final package.
  Remaining known PC-specific: `ai-editor` (its stand-in sign-in program relies on the
  `.js` file association) and `module-button-labels.browser` (hangs here, also on
  0.28.4 / 0.29.0).
- Updater gate on the official ZIP (sha256 928e2108…5623, 207,812,138 bytes):
  0.31.0 -> private 0.31.1 -> private 0.31.2 -> offline revert to 0.31.1. 33 blocked
  relaunches per cycle, manifest/snapshot/personal-file hashes, one-version retention,
  consumed snapshot, and exactly one routed update ping per install (#297), never the
  real counter. The Save / Cancel / Close prompt was answered by clicking its Close
  button; the revert confirm was answered in memory. Public ZIP re-downloaded after
  publishing: same hash. FFmpeg source asset reused (unchanged, sha256 01b14874…091b).

## Harness notes for the next release

- `test/updater-release-gate.cjs` now takes the candidate's version and routes the
  private copies' ping to its fixture. A driver for the whole run is in
  `D:\Claude\MDLxL-gate\driver.cjs` (outside git): it presses Close in the prompt for
  updates and the revert. `test/updater-release-reopen.ps1` counts a launch Windows
  refuses mid-swap as blocked (this PR).
- Run packaged tests with `node scripts/run-packaged-tests.mjs`, not `pnpm run`: the
  pnpm pre-run install rewrote the main checkout's top-level `node_modules` links.
- `test/geoset-duplicate-open` waits for the save to register before closing.
