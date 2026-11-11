# Library textures: review fixes after PR #502

Status: completed, merged in #506 at af85b712
Owner / consolidator: Codex (build); Claude Code (review and contract)
Updated: 2026-11-02

## Goal and completion criteria

Claude reviewed the merged [PR #502](https://github.com/UnsctMagic/MDLxL/pull/502)
(Library → Textures in World Editor Style). It works; these eight findings are
the follow-up. Fix all eight in one PR (see "Fix every instance" below).

Done means:

- Opening the Library in World Editor Style (the default) shows an entry's tiles
  as soon as possible: no Standard-only work runs first.
- A unit never loses all its textures because one lookup failed.
- The status line never says "0 textures" while it is still loading.
- The packaged Library test is not flaky on slow machines and reports the real
  error when it fails.
- Nothing else changes: Standard view, Models tab, pickers and every action
  behave exactly as in PR #502's contract ([library-textures-world-editor.md](library-textures-world-editor.md), R1–R8).

## Revision and local state

- Base: `main` at `69cdf108` (merge of PR #502).
- Branch: `claude/library-textures-review-fixes` (this note only). Codex continues
  this branch and opens the PR into `main`.
- Map row: "Library: game files (textures, models, sounds, all files), World Editor
  view…" in [agent-map.md](../agent-map.md); guide [GAME-FILE-LIBRARY.md](../GAME-FILE-LIBRARY.md).

## Findings to fix (at `69cdf108`)

**F1. Default view waits for a page it throws away.**
[TextureLibrary.jsx](../../app/TextureLibrary.jsx), the catalogue effect
(`textureLibraryPreview` … `.finally(… refreshCatalog …)`). In World Editor Style
the Standard first-page preview still runs; its result is discarded
(`filters.worldEditor` early return), but the full catalogue load waits for it
plus 75 ms. Entry tiles cannot match until that catalogue arrives.
Fix: when the style is World Editor at open, skip the preview and call
`refreshCatalog` straight away. Standard keeps its fast first page unchanged.

**F2. Search worker indexes the catalogue nobody searches.**
Same file, `useCatalog` posts `{type:'init',items…}` to the worker even in World
Editor Style, where the search effect returns early. Fix: defer the worker
`init` until Standard is shown (first open in Standard, or switching to it).
Switching to Standard must still show results without a visible extra wait;
keep the existing `ready`/`warmSignature` flow.

**F3. A failed icon lookup hides the whole entry.**
[world-editor-textures.js](../../src/world-editor-textures.js) `createEntryTextureLists`:
`await readIcon(...)` is not guarded like the model reads. If it rejects, the
entry's whole list rejects. Fix: catch it and fall back to
`{path:entry.icon,variant}` (the same as a missing icon, which then shows in the
"not found" line). Do not cache that list as complete (same rule as a failed art).

**F4. "0 textures" while loading.**
TextureLibrary.jsx status line (`tl-result-status`) in World Editor Style always
shows "*n* textures". Fix: while `entryLoading` or `!catalog` with an entry chosen,
show the existing "Loading texture library…" text instead. No new spinner (R6).

**F5. Hard 1-second timing asserts in the packaged test.**
[library-textures-contract.cjs](../../test/library-textures-contract.cjs), `coldMs<1000`
and `cachedMs<1000`. R7 (under 1 s on the owner's PC) stays the requirement, but
`pnpm run test:packaged` also runs `slow-cpu` (`MDLXL_VARIANT_CPU`) and no-GPU
(`MDLXL_VARIANT_ARGS`) variants. Fix: assert the 1 s budget only in the default
variant; in other variants record the timing in the check text without failing.

**F6. Undefined fallback in the test probe.**
Same file, `state()` falls back to `findFiberProps(...)`, which does not exist in
the page. Fix: drop the fallback and assert `window.__mdlxl.model` exists.

**F7. Failure diagnostics can hide the real error.**
[game-file-library.electron.cjs](../../test/game-file-library.electron.cjs), the new
`catch`: `shot(page,'failure')` and the dialog `innerText` can themselves throw
(page closed/crashed) and replace the original error. Fix: wrap each diagnostic in
`.catch(()=>{})` before `throw error`.

**F8. Duplicated empty-tree messages.**
[WorldEditorTree.jsx](../../app/WorldEditorTree.jsx) `WorldEditorTextureTree`
(`noGame`, "No matches…") copies the strings
[GameFileBrowser.jsx](../../app/GameFileBrowser.jsx) passes to `LibraryTree` as
`empty`. Fix: export the two strings once from WorldEditorTree.jsx and use them in
both. Wording stays exactly the same (translation keys unchanged, so the locale
size test stays as it is).

## Rules for this fix

- Fix every instance: all eight in one PR. If one turns out to be deliberate or
  wrong, say why in the PR instead of silently skipping it.
- Smallest change; no new controls, panels, strings or settings.
- Standard view behaviour unchanged (R8 of the original contract).

## Acceptance

| ID | Do | Pass |
| --- | --- | --- |
| A1 | Fresh profile → Library → Textures (World Editor Style) | No `textureLibraryPreview` call; catalogue load starts at once. Footman tiles appear; R7 time recorded. |
| A2 | Same, then press Standard | Standard results appear as before (search, vibe, kinds work). Worker initialised only now. |
| A3 | Unit test: `readIcon` rejects | Model textures still returned; icon path listed as not found; next call retries. |
| A4 | Pick an entry before the catalogue has loaded | Status shows "Loading texture library…", never "0 textures". |
| A5 | `pnpm run test:packaged` default + `slow-cpu` for the Library workflow | Default asserts < 1 s; slow-cpu passes and reports its timing. |
| A6 | Existing Library workflow and T1–T11 from PR #502 | All still pass. |

## Tests

- `pnpm test`, the focused source tests from the map row
  ([world-editor-textures](../../test/world-editor-textures.test.js),
  [game-file-library](../../test/game-file-library.test.js),
  [localization-catalogs](../../test/localization-catalogs.test.js)), plus the new A3 unit test.
- `pnpm run build`, then the packaged Library workflow on the hidden desktop
  (default and slow-cpu). After a fix, rerun only failed and related tests.
- Update [GAME-FILE-LIBRARY.md](../GAME-FILE-LIBRARY.md) only if behaviour it
  describes changes (F1/F2 load order).

Owner click-through for `ready to test`: Library → Textures → Human → Units →
Normal → Footman → tiles appear → press Standard → search "painting" → tiles appear.

## Implementation and verification

- Continued `claude/library-textures-review-fixes` at `3863d1aa`, based on
  `69cdf108`; no unrelated source changes were present.
- F1/F2: World Editor skips the Standard preview and starts catalogue loading
  directly. Worker creation, listeners and indexing now start only in Standard;
  the existing warm-signature and result flow remains in use.
- F3/F4: rejected icons yield their missing-path record and leave model textures
  usable; partial results are not cached. Chosen entries show the existing loading
  message while their model list or catalogue is pending.
- F5/F7/F8: both timing asserts apply only with no CPU/Chromium variant flags;
  timings remain recorded in every variant. Each failure diagnostic is guarded,
  and both browsers import the same two unchanged empty-tree strings.
- F6 correction: `test/helpers/fiber-probe.cjs` actually installs
  `window.findFiberProps` (line 21), and `launchApp` installs that probe. The
  undefined-fallback premise was inaccurate in this harness. The requested
  cleanup is still applied: assert `window.__mdlxl.model` exists and use it alone.
- Fail-first: the old packaged view recorded preview=1, catalogue=1, a World
  Editor worker init and `0 textures · Footman` while its real catalogue reply
  was held; A1 failed `1 !== 0`. The new A3 test failed `icon read failed` on
  the old helper, then passed after F3. Diagnostic fault injection masked the
  original error in all three old cases (screenshot/count/text) and preserved it
  in all three fixed cases.
- Completed checks: `pnpm test` 57 passed / 0 failed / 0 skipped; named focused
  source files with A3 16 / 0 / 0; build and packaging passed. The required runner
  passed `game-file-library,library-textures-review` on default (2 / 0 / 0) and
  actual 4× slow-cpu (2 / 0 / 0), hidden on `WinSta0\MDLxLTests`.
- A1/A2/A4 in both variants: preview=0, direct catalogue=1, worker creation/init=0
  before Standard, one init in Standard; held-catalogue entry shows the loading
  message. [A4 capture](../../test/evidence/library-textures-review-fixes/loading-default.png).
- A5/A6: T1–T11 passed in both variants. Default Footman first/cached:
  52/51 ms (both < 1 s asserted); slow-cpu 126/49 ms (recorded, not budgeted).
  Standard first grid: 295 ms default, 1128 ms slow-cpu.
- Exact same tested bundle: index `8c8394f3c93c9d435a997dce8c4aac1d0ce4a6691b13168a2dfc0796a2e72cb4`;
  assets `8c18f829dceff8e3b2f5ff94ab4699429c6cd684aa4522b83be935b08c192c75`.
- Not exercised: Warcraft III gameplay, no-GPU variants, owner visual acceptance.
  Independent Claude QA remains pending. No installed profile change or merge.

## Claude review (2026-11-02)

Independent rerun at `9cfcd3f6` confirmed F1–F8, A3 fail-first, `pnpm test`
57/0/0, focused 16/0/0, and both packaged tests on default and slow-cpu. Two
follow-ups fixed on this branch:

- The search-worker effect depended on `catalog?.signature` and a ref, so a new
  catalogue with an unchanged signature (model changed while the Library is open,
  same texture sources) never re-attached the worker: Standard search stayed on
  "Searching…". It now depends on the catalogue object.
- A failed catalogue load with an entry chosen kept "Loading texture library…"
  and its placeholder tile next to the error; both now stop on an error.

Rerun after the fix: packaged `game-file-library,library-textures-review` pass
on default and slow-cpu (preview=0, catalogue=1, no early worker, loading text).

## Review handoff

PR: [#506](https://github.com/UnsctMagic/MDLxL/pull/506), into `main`, unmerged.
Implementation revision: `f8ebeb3c16bf4aff65896b5c649edc21cfa5f95d`.
All runtime changes and tests were verified before this documentation-only handoff.
Owner click-through: Library → Textures → Human → Units → Normal → Footman →
tiles appear → Standard → search "painting" → tiles appear.
