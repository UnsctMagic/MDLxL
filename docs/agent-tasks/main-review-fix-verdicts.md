# Claude's review of the seven fix branches (11 November 2026)

Status: rework re-checked and accepted on all seven branches; one combined branch still needed before merging
Owner / consolidator: Claude Code (review), Codex (rework)
Updated: 2026-11-11 (evening)

## Re-check of the rework (11 Nov, evening)

Tips re-checked: 1 `d13fbf6f` (unchanged), 2 `426fdabe`, 3 `47337d05`, 4 `684b568e`,
5 `7961856b`, 6 `68cb09b5`, 7 `053ad9d0`. All are plain follow-up commits on the reviewed
tips; every worktree is clean. Online `main` is still `a8a4ca86`.

**Every reworked point below is done and reads correctly.** Claude read each follow-up
diff and re-ran the eleven tests that failed before plus the reworked ones on each of
branches 2 to 7: 146 to 151 tests per branch, 0 failures. Claude did not re-run all
seven whole suites or any packaged test; those rest on Codex's runs (0 failures, 10
skips per branch) until the combined branch is checked.

- **O12 (owner, relayed through the continuation session on 11 Nov: "Keep").** Done on
  branch 2: when the safety copy cannot be made the old file is left untouched, a
  translated notice says so and offers Save as; the tab stays unsaved. A repeated
  unreadable save reuses the first backup instead of copying the broken file.
- Accepted small points, no change wanted:
  - Branch 2: if the user deleted the first backup, a repeated unreadable save is
    refused with the same notice (it errs on the safe side).
  - Branch 3: two catalog entries for texts the app no longer shows were kept.
  - Branch 7: capture regions are also cleared while the UV window has focus.

**What is left before merging:** since the rework, branches 3, 4, 5 and 7 each add
translations, so they now conflict with one another in the five locale catalogs and the
catalog-size line of `test/localization-catalogs.test.js` (only there; branches 2 and 6
merge cleanly). Seven separate PRs would each need that conflict resolved again. Codex
builds one combined branch (`codex/main-review-20261111-all`), Claude checks it, and
that single branch is what gets merged when the owner says "merge".

The sections below are the first review, kept as the record of what was asked.

Reviewed: local `codex/main-review-20261111-1` to `-7` at the tips Codex handed over
(`d13fbf6f`, `5c18a201`, `49327893`, `97cbbb58`, `fa90a3cb`, `4b48365e`, `5a600416`), each
against its contract in this folder and the [main review](main-review-2026-11-11.md).

## Verdicts

| Branch | Verdict | Why |
| --- | --- | --- |
| 1 FX references | **Ready** | Both serious faults are fixed; Claude's own proof script now gives the right result. |
| 2 Save safety | Ready after small fixes | All six items work. Three gaps around the backup and the notice text. |
| 3 Settings and keys | Ready after one small fix | All seven items work, old profiles unchanged. One existing test fails. |
| 4 Editors and previews | Ready after small fixes | All eight items work. A stray `}` shows on screen; one existing test fails. |
| 5 Paint drags | **Not ready** | The drag fixes are right, but seven existing source tests fail and Paint help text lost its translations. |
| 6 Housekeeping | Ready after one small fix | No result changed on 410 models. One existing test fails. |
| 7 Newest five | Ready after small fixes | All eleven items work. One existing test fails; four smaller points. |

## The gap behind most of this: the whole source suite was not run

The contracts said "focused tests only; never the full packaged suite". That was meant to
rule out the packaged suite, not CI's source suite; the wording was Claude's and it was
unclear. Result: **eleven existing source tests fail across branches 3 to 7**, so each of
those PRs would be red in CI. Claude ran the whole source suite (`test/*.test.js` and
`tests/*.test.js`) on the base and on all seven branches merged together: base 9 failures
(the known ones), merged 22. Per branch, on the branch alone:

| Branch | Existing test that now fails | Cause |
| --- | --- | --- |
| 3 | `test/settings-review-fixes.test.js` "the Classic and Orbit buttons keep Custom the way the bar does" | Pins the old `pickPreset(domain, preferences, id, commit, say)` text; the signature gained a parameter. |
| 4 | `test/gesture-keys.test.js` "UV drags commit exactly what the map shows" | Pins the old one-line UV commit rule; D6 split it by `wrapperControls`. |
| 5 | `test/paint-image-navigation.test.js`, four tests | `ReferenceError: window is not defined`: `usePaintImageNavigation` now touches `window` while rendering. |
| 5 | `test/modifier-bindings.test.js` "…the drag owners keep no literal reads" | `PaintViewport.jsx` reads `event.shiftKey || event.ctrlKey || event.metaKey` directly for the middle button. |
| 5 | `test/hotkey-window-source.test.js` "window keys use the catalog or documented inner-state claims" | `PaintViewport.jsx` now has two Escape claims where one is documented. |
| 5 | `test/paint-localization.test.js` "Paint shortcut descriptions…have localized text" | New help rows ("Zoom texture views" and others) are in no catalog. |
| 6 | `test/ui-primitives.test.js` "…the layers come from three tokens" | A fourth layer token `--z-discard-cue` was added to `app/theme.css`. |
| 7 | `test/capture-settings.test.js` "capture defaults are medium at 30 FPS…" | The expected object lacks the new `shareXRegions: false`. |

**Rule for the rework:** before handing back, run `pnpm run test:source` and `pnpm test` on
each branch and compare the failures with `.github/known-test-failures.txt`, exactly as CI
does. Never widen that baseline. Where a failing test pins source text that the contract
deliberately changed, update the pin so it still protects the same thing; where it shows
a rule break, fix the code.

## Rework per branch

### Branch 1: nothing

- Parts 1 to 3 are met. Proof: `D:\Claude\MDLxL-QA\2026-11-11-fix-review\lead\stale-indexes-branch1.mjs`
  (group `[3]` becomes `[2]`, still the same geoset; the user's Global Sequence survives).
  162 focused tests pass.
- For whoever finishes `claude/fx-editor`: that branch still carries the old clock remap
  line in `compileAnimation` that branch 1 removed. Keeping both shifts FX's clocks twice.
  Branch 1's test "FX sweep shifts clock ownership only once…" catches it.
- Part B (A3 to A5) still waits for `claude/fx-editor`, as agreed.

### Branch 2

1. **A second unreadable save must not back up the broken file.** After one unreadable
   save the tab stays unsaved; pressing Save again copies the already-broken file to
   `Name_backup_2` and the notice calls it "the previous file". When the document's last
   save to this same path was already unreadable, make no new backup and name the first
   backup again in the notice. Test: two unreadable saves in a row; one backup file, and
   it holds the original good bytes.
2. **Owner decision O12, do not change until answered:** when the backup copy itself
   fails, the save currently stops (and for a permission error asks "This file is
   read-only. Save model as"). See "Owner decisions" below.
3. **Translate the new text.** The notice ("…could not be read back…") and "Extents were
   left as they were." are built by joining strings and are in no catalog. Use templates
   with `{0}` and add them to all five catalogs.
4. Do not add a file MDLxL just reported as unreadable to Recent files
   (`persistRecents` in the `model:save` handler).
5. Add the missing assertion: a successful Save As with "Calculate extents" ticked stores
   the extents and is one undo step. Remove the condition that is always true at
   `src/editor-document.js:607` and the blank lines left in `saveAsFormat`.
6. Accepted as written, no change: Paint export, Collect Bit and the Library copy stay
   strict (they stop with an error instead of writing a lossy file). A scan of 300 library
   models found none that the strict check newly refuses.

### Branch 3

1. Update the pin in `test/settings-review-fixes.test.js` to the new `pickPreset`
   signature; keep what the test protects (the Mouse page's Classic and Orbit buttons
   keep "Custom" the way the bar does).
2. `docs/UV-ROTATE-ZOOM.md`: the sentence saying the MDLxL preset keeps centre Zoom now
   needs "for profiles that existed before 11 Nov 2026"; the new rule follows two
   sentences later and reads as a contradiction.
3. Record in the contract note, as a known consequence of C4 (the user's own key wins):
   importing a configuration whose key sits on another command's default no longer fails
   with "Conflicting shortcut"; the imported key wins. `test/release-fixes.test.js:34` was
   rewritten for this. Preset files still reject that case. No code change.
4. The release-note line for German and French keyboards (O5) exists only in the contract
   note, in English. It must reach the 0.40.0 release session: add it to the release
   notes on `codex/release-0.40.0` in all six languages when that branch next moves.

### Branch 4

1. **Delete the stray `}`** at the end of `app/UVWorkspace.jsx:320`
   (`…commitPreviewRgb(2, value)}/>}`). It renders as a visible "}" between the blue
   Preview RGB box and Reset. Add a check that would have caught it: the packaged UV
   preview test asserts the footer's visible text.
2. Update the pin in `test/gesture-keys.test.js` "UV drags commit exactly what the map
   shows": it must still assert that the Wrapper commits by `uvDragChanged`, and now also
   that other users of `UVEditor` keep the one-pixel rule.
3. Note only: the four UV preview translations are word-for-word the ones on
   `codex/release-0.40.0`. Whoever merges second keeps one copy and recounts the catalog
   sizes in `test/localization-catalogs.test.js`.

### Branch 5 (not ready)

1. `app/usePaintImageNavigation.js` must not touch `window` while rendering: do it inside
   the effect, as the rest of the hook does. The four `test/paint-image-navigation.test.js`
   tests must pass unchanged.
2. `app/PaintViewport.jsx`, middle button: no raw `event.shiftKey || event.ctrlKey ||
   event.metaKey`. Read the bound orbit key through `modifierHeld` / `modifierValue`, and
   swap pan and rotate only when the held key is itself the bound orbit key. With default
   keys Alt + Shift + middle must turn the model as it did before (it now pans).
   `test/modifier-bindings.test.js` must pass unchanged.
3. One Escape claim in `PaintViewport.jsx`, not two: fold the brush-size cancel into the
   existing "Cancel the active paint/camera gesture" claim. `test/hotkey-window-source.test.js`
   must pass unchanged.
4. Translations: the new Paint hint line and help rows ("Pan model", "Zoom model",
   "Zoom texture views", "Pan texture views", "Right drag", the `{0} + middle drag` and
   `{0} + right drag` rows, and each variant of the hint template) in all five catalogs;
   update `test/fixtures/locale-feature-sources.json`. `test/paint-localization.test.js`
   must pass unchanged.
5. `usePaintImageNavigation.js`: the slow texture-view drag was moved from Alt to the
   orbit key. The contract did not ask for it. Put it back to Alt.

### Branch 6

1. Remove the new `--z-discard-cue` token from `app/theme.css`. The layers come from three
   tokens and `test/ui-primitives.test.js` guards that. In `app/hotkey-sequences.css` use
   `calc(var(--z-workspace-modal) + 1)` directly. The test must pass unchanged.
2. `docs/QA-AND-RELEASE-KIT.md`, release standard line for the flail check: add that,
   until the historical reference exists, the line passes when Flail01 passes and Flail03
   differs only in `mounted-spheres` (owner, 11 Nov 2026).
3. Wording: the "actual" hash in the contract note is three characters short
   (`…84cd2ced2645795c0836ca9`); #437 landed through #456, so `optimizexl-world-budget.md`
   should not say "open, unmerged".

### Branch 7

1. `test/capture-settings.test.js`: add `shareXRegions: false` to the expected values.
2. `test/localization-ui-gaps.test.js`: the contract asked for a scan that fails the next
   time a string is added untranslated. What was added is a fixed list. Extract visible
   strings (JSX text, `title`, `aria-label`, `placeholder`) from `BitsAndParts.jsx`,
   `PartRgb.jsx`, `LibrarySaveCopy.jsx` and the EMTR menu code and check those, with a
   short allow-list for names (BitsAndParts, EMTR, VIS, XL).
3. Tab close while a replacement draft is open (`app/App.jsx`, `app/AppDialogs.jsx`):
   ask only when the tab being closed is the draft's own model; closing another model's
   tab works as usual. The prompt offers Commit as well as Discard, continues closing the
   tab after either, and keeps the hotkey attributes its sibling close prompt has.
4. Settings > Capture: build the ShareX switch with the existing `Toggle`
   (`id="capture:sharex-regions"`), like "Show pressed keys" above it, not a hand-made
   checkbox.
5. With the switch on, changing editor (Vertices to UV and back) must not stop and
   restart the helper program: send empty regions on a mode change, and end the helper
   only when the switch is turned off or the window closes.
6. Add "Save model?" and "Close model tab?" to the catalogs that lack them.
7. Accepted, no change: the model tab strip now stays visible during Replace Part (three
   other features' tests were adjusted for it); moving a Bit is refused when a texture
   beside it would be left behind.

## Merging

- Order: 1, then 2 (it contains 1). Then 3, 4, 5, 6: they merge with no conflict.
- 7 conflicts with 3 and 4 in the five locale catalogs and in the catalog-size line of
  `test/localization-catalogs.test.js`. Both sides only add keys, with no key given two
  texts. Keep every key from both sides, keep the files' CRLF line endings and catalog
  order (two tests check exactly that), and recount the sizes.
- `codex/release-0.40.0` and `codex/call-upon-forge` are not merged and were not part of
  this review. The release branch will hit the same catalog conflict.

## Owner decisions

| ID | Question in plain words | Claude's suggestion |
| --- | --- | --- |
| O12 | A save turns out unreadable AND the safety copy of your old file cannot be made (rare). Today MDLxL then does not overwrite the old file. Keep that, with a clear message and "Save As" to another place? Or overwrite anyway, losing the last good copy? | Keep: never overwrite the last good file without a copy; say so plainly and offer Save As. |

O2 (POSE swivel) and O7 (the three 0.39.0 behaviours) are still open from the main review.

## What Claude did not check

- No `.electron.cjs` test and no packaged app was run by Claude. The real-input checks
  rest on Codex's hidden runs. The owner's hand test comes after the rework.
- The reviews read each branch alone, plus one trial merge of all seven for the source
  suite. Evidence scripts: `D:\Claude\MDLxL-QA\2026-11-11-fix-review\`.

## Next action

- Codex: rework branches 2 to 7 as listed, run the whole source suite on each, hand back.
- Claude: re-check only the reworked points, then give the owner a short click-through list.
