# Library textures: review fixes after PR #502

Status: contract agreed; Codex to build
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
