# Call Upon Forge — review contract

Status: contract corrections verified and saved locally; ready for owner review.
Owner: Codex / Call Upon Forge chat. Updated: 2026-11-11.
Worktree: `D:\Codex\mdlxl-call-upon-forge-20261111`, branch `codex/call-upon-forge`.
Durable behavior: [Forge guide](../FORGE.md). Historical implementation/test details remain in Git history.

## Owner decisions and boundaries

- Standalone **Enter the Forge** and the left-side **Call Upon Forge** toolset both retain thin-surface bevel rims and curved Inset. Owner approved both after the comparison review.
- HD remains view-only. Owner explicitly accepted live shield dragging plus separate native HD data/performance tests instead of enabling HD editing for contract item 7.
- No push, PR, merge, release, version bump or installed-app/profile changes. Do not alter the older review packages/profiles or their models. PID 36544 was never controlled or closed by this task; it was no longer running at the final process inventory.

## Contract, in order

1. Rebased the six commits onto fetched `origin/main` **a8a4ca86**. Resolved App, shared toolbar menu and map conflicts while retaining main's Bit replacement/Library changes. Rebased head before this correction: **0378188d**. Immediate verification: **89 source / 6 packaged passed**, no failures/skips.
2. Added `scripts/compare-forge-standalone.mjs`: every primitive at complexities 1–4, flat/thick variants, 31 operations, including closed Thumper components. Initial comparison: **240 unintended differences**. Corrected standalone signed Bevel, width clamping, face output ordering and flat Inset sampling. Final **1,744 cases: 1,655 byte-identical, 89 approved differences, 0 unexpected** (68 thin-sheet rim, 21 curved Inset). Closed solids and flat Inset match. All 89 have before/after pictures in `out/contract-review/standalone-final/review.html`; final source hashes/results in `standalone-verified/`. Owner approved both changes in both modes.
3. `vertexForgeResult` preserves untouched original indices and every stream byte; authored duplicates/free vertices remain distinct. Changed records patch existing slots and new corners append. New real SD/HD tests fail on the old adapter; earlier position-search assertions now require the same index. Native HD skin-only binding is accepted at this source boundary without changing the application's HD view-only policy.
4. Added 42 strings to each of de/es/fr/ru/zh. Kept catalog union order and CRLF formatting, and tested required Forge labels/errors. Existing generic labels/templates are reused.
5. The four required hotkey checks: **32 passed / 0 failed / 0 skipped**.
6. Added functional hover text to selection scopes, Sections, Turn cuts, Detail, Commit and Cancel. The shared Bevel tooltip describes both modes accurately.
7. Local drafts keep the selected region and two neighboring face rings; unrelated faces bypass live shaping/interpolation. Tangent work targets changed vertices. Face/edge picking reuses unchanged geosets, including across in-place editor writes. Viewport retains edge indices when topology is unchanged. Actual shield drag trace: **Bevel max 6.614 ms and Inset max 6.363 ms of main-thread work between drawn frames**, within 16.667 ms at 60 Hz; individual task maxima 4.921/4.366 ms. Largest native HD geoset (6,947 vertices / 9,774 triangles) local geometry+adapter work is a few ms after warmup, versus over 200 ms on the previous whole-geoset path. HD live editing is intentionally blocked and was not bypassed.
8. Commit merges changed-geoset selection into the existing selection. UI regression failed first with `Commit lost the untouched body selection`; final check passes.
9. Enter belongs to focused buttons/menus/dialogs; viewport Enter still commits. UI regression failed first with `Enter on Turn cuts committed instead of activating the button`. Final real click/Tab/Enter checks cover Turn cuts, Cancel, menu opening, dialog Close and viewport Commit. No programmatic focus or app-state mutation is used by these new checks.
10. Ran **one** full `pnpm run test:source`: **3,296 passed / 3 failed / 10 skipped**. All three failures were locale counts/order/line endings introduced by item 4; corrected them and reran only `localization-catalogs.test.js`: **7 passed / 0 failed / 0 skipped**, including new Forge coverage. Baseline remains unchanged (zero allowed failures). TAP completion/failures were compared using `.github/check-test-baseline.mjs`. The full suite was not repeated.

## Evidence and reproduction

- `out/contract-review/` retains the logs, source hashes, standalone review and frame-cost JSON. `indices-before.log`, `contract-ui-before.log` and `standalone-before/` are failing-first evidence. `source-baseline.log` records the original three locale failures; `locales-source.log` records their resolution.
- Final focused source checks: **81 passed / 0 failed / 0 skipped**, plus the separate 32 hotkey and 7 locale checks. Command: `node --test test/forge-vertex-indices.test.js test/forge-vertex.test.js test/forge-surface-bevel.test.js test/forge-shield-inset.test.js test/live-drag-frames.test.js test/viewport-correctness.test.js`.
- Shared packaged runner: **8 passed / 0 failed / 0 skipped** for `forge-vertex-contract,forge-vertex,forge-shield,forge-shield-rim,forge-shield-controls,forge-face-editing,emtr-quick-options,citadel-locales`. Additional `forge-vertex-drag` passed; expanded menu/dialog contract check passed. These are **9 distinct checks**, not a full packaged suite. Final catalog-only rebuild passed the affected locale rerun. Final Extrude full-geoset hit-testing review passed `forge-vertex` again on the review package.
- Actual shield checks include whole shield with boss/strap, isolated plate, 19-triangle angled and 61-triangle rounded rims, curved Inset, repeated/reversed drags, crossing zero, unselect/reselect, oversized-Inset recovery, Commit/Cancel, Undo/Redo and normal mouse rotation. Screenshot-located handle error: **0.000 px** in the repeated axis drags. Images inspected: `out/shield-controls/bevel-angled.png` and the standalone comparison samples.
- Original collection: 1,018 MDX + 2 MDL files, no genuine skin+tangent HD geoset. Added unmodified native Reforged Footman to `D:\Claude\MDLxL-TestModels\forge-hd\Footman.mdx` through the existing CASC reader; source content key is in its README. SHA256: `aa2b13f2440d65ce8b87c24dd6456fc4bf133437263fb044ed3a13efba0b0798`. Tests use `fixturePath('forge-hd-footman')`.
- Full-source skips: seven existing opt-in/private-model checks (archer armor, skin-collapse pair, private Fx, two anatomical corpus checks, dense twin-head rider, accepted Tinker/Magnataur choices); three Windows-dependent checks (SIGTERM behavior, symlink privilege, 8.3 short paths). No skips were added and no known-failure entry changed.
- CI was not run online. The real-model checks require the permanent collection or fixture overrides; the hosted CI setup currently does not provision that collection (already true of this branch’s earlier shield checks).
- Not exercised: Warcraft III, native hardware mouse acceptance, full packaged/release suite or user hand-test acceptance. Source data checks and Playwright mouse/keyboard interaction are distinct evidence.

## Handoff / cleanup

- Keep source/unpushed branch and the owner's review assets. Older review: `out/manual-shield-controls/Forge-controls-verified.mdx`, its profile, and `out/shield-controls/pkg` remain preserved.
- Fresh review target: `out/contract-review/pkg/MDLxL-win32-x64/MDLxL.exe`, saved model copied to `out/manual-contract-review/Forge-contract-review.mdx`, independent profile there. Open only after the older owner window has finished. Do not connect to or operate owner windows during automated checks.
- Removed the disposable main comparison worktree after unlinking its dependency junction. Kept the unpushed feature worktree and the small comparison/verification reports.
- Disposable test profiles close through `test/helpers/app.cjs`. The final review package may be retained for the requested hand test; earlier owner packages/profiles remain until acceptance. Remove junctions as links before deleting temporary worktrees.
