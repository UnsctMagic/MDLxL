# Fixes from the review of Codex's 0.35.0 → 0.36 changes

Status: follow-up fixes added; ready for review; awaiting merge approval
Owner / consolidator: Codex (fixes); review done by Claude Code
Updated: 2026-10-29

## Goal and completion criteria

- Fix every defect below on this branch, one focused commit per numbered item
  (or per closely related group), each with a regression test where practical.
- Keep the existing behaviour and UI; these are bug fixes, no redesigns, no new
  panels, no version bump.
- Items marked "decide" are judgement calls: pick the smallest sensible fix or
  record why the current behaviour stays.
- Done = all items fixed or explicitly declined here with a reason, `pnpm test`
  and `pnpm run test:source` pass against the CI baseline, relevant Electron
  tests run, PR into `main` opened with a `Session:` line, state `ready for
  review; awaiting merge approval`.

## Revision and local state

- Branch: `claude/codex-review-fixes` (fetched before editing; continued from `97b1e909`).
- Base / reviewed revision: `origin/main` at `6d211c88` (merge of #376).
- Working checkout: isolated `D:\Codex\codex-review-fixes\repo`; existing Claude checkout and personal profiles were untouched.
- Required fixtures: none beyond the existing test fixtures.

## Reviewed commits

`58d50e6e` (#359 reorder), `fed52e8f` (Bitz fit), `8bcdf40a` `7797f977`
`949b0f14` `fbf3b5ec` (sanity check), `f4bd99c1` `27726654` `3903ba4f` (update
popup), `9d988af2` (#363 Managers), `a2942229` `f7822456` `5f26cf39` (Library),
`fa146750` `9d1276d8` (AI attachments / private references), `4ea20903`
`55508f6a` (bird routing / checkpoints). Animation reordering, HD Library DDS /
skinning / texture lookup and unit labels were reviewed and found sound.

## Findings to fix (line numbers at 6d211c88)

### Serious

1. [done] **Update popup blanks the app without WebGL.** `src/update-popup-effects.js:50`
   `HelmetView` throws `'The update helmet needs WebGL.'` (and `parseMDX` /
   `initGL` / `decodeBLP` can throw). `app/UpdateHelmet.jsx:7` calls
   `effects.attach()` in `useEffect` with no try/catch and the app has no error
   boundary, so React unmounts the root on a VM / Remote Desktop / blocklisted
   GPU. Fix: catch in `attach` (or in `UpdateHelmet`) and fall back to the static
   helmet `<img>` with no particles; release any partial GL state. Same in the
   welcome window: `app/welcome-popup-effects.js` throws while loading so
   `prepareWelcomeEffects` is never defined; `electron/welcome-prompt.cjs:68-71`
   swallows it and `setContentSize` never runs (fixed 240px height can clip the
   text). Make the welcome prompt size itself even when effects fail. Verify
   with the existing no-GPU packaged-test mode (`pnpm run test:packaged`).

### Clear bugs

2. [done] **Sanity Check reports every view-only HD model as broken.**
   `app/SanityCheck.jsx:12` passes `doc.diagnostics`, which contains
   `{severity:'error', code:'HD_VIEW_ONLY'}` from `src/editor-document.js:326`;
   `src/sanity-check.js:6-8` counts it as a structural error ("Structural
   errors found"). Fix: drop or downgrade `HD_VIEW_ONLY` (it is a mode notice,
   not a model defect) in `checkSanity`. Add a unit test that passes source
   diagnostics containing it (`test/sanity-check.test.js` currently omits them).
3. [done] **HD view-only notice lost its translations.** `src/model-version.js:34`
   `HD_VIEW_ONLY_MESSAGE` was reworded; es/ru/zh entries (es.json ~5035,
   ru.json ~5023, zh.json ~2154) are still keyed by the old English text and
   `translate()` needs an exact match. Re-key them to the new text and update
   `test/fixtures/locale-feature-sources.json` if it tracks it.
4. [done] **Doubled word in AI web-research prompt.** `src/ai-tools.js:408`
   "XGM and XGM tutorials" (blind replace in `7797f977`). Restore a correct
   source list. Grep the rest of `7797f977` for other "X and X" artefacts.
5. [done] **`MDLXL_` comment lines break MDL saves.** `src/model-comments.js:10`
   skips header lines starting with `// MDLXL_` on read, but
   `writeModelComments` writes user lines as `// <line>` unescaped, so a user
   line starting `MDLXL_` vanishes on reopen and every save fails with "Model
   comments did not reopen." (`src/editor-document.js` ~568/620). Fix: escape on
   write / unescape on read (or reject such lines in the textarea with a clear
   message). Add a round-trip test.
6. [done] **Collision size sliders treat cylinders and planes as boxes.**
   `app/ModelManager.jsx:98-106` gives Width/Depth/Height to every non-sphere;
   on an upright cylinder (endpoints (0,0,0)/(0,0,100)) "Width" sets X to ±w/2
   and tilts the axis, and radius is never offered. Fix: sliders only for shapes
   the stage draws (box, sphere) or give cylinder Length + Radius and plane its
   two real extents, matching `src/model-collisions.js` `resizeCollision`.

### AI helpers (birds) and AI chat

7. [done] **Resume overwrites the bird's job title.** `electron/ai-service.cjs:509`
   passes `job: bird.task?.plan?.reach || 'Resume task'`; `runWorker` (~1250
   `else if (!worker.tiny) worker.job = args.job`) replaces the stored title.
   Fix: keep the existing `bird.job` on resume.
8. [done] **Resume only sees the last 20 steps.** `electron/ai-job-plan.cjs:61-72`
   `checkpointNote` keeps `recentSteps` = last 20 (tool/label/status only), yet
   the resume prompt (~781-783 in ai-service.cjs) says "do not repeat an applied
   edit". Fix: always include every *applied* step (compactly) plus the recent
   tail, so long jobs cannot redo early edits. Test with 25+ steps.
9. [done] **Long check names never clear.** `ai-job-plan.cjs:52/56` records failures
   under `check.name.slice(0,200)` but deletes with the full name. Use the same
   key for both.
10. [done] **Stopped helper never restarts on Resume.** Stop aborts
    `helperController`; `runHelper`'s catch sets `status:'failed'`; the restart
    (~ai-service.cjs:841) only handles `status === 'working'`, and
    `startHelper` returns early because `task.helper` exists. Fix: treat a
    cancelled/failed helper as restartable on resume.
11. [done] **Two region jobs can share one bird in parallel.** `jobOf` (~629-635)
    maps each region job's `worker` to an existing bird without checking
    duplicates; both run under different `batch:index` locks and write the same
    conversation's `task` and transcript. Fix: reject or serialise duplicate
    workers within one batch.
12. [done] **Attachments made while viewing an earlier chat are stranded.**
    `app/AiAssistant.jsx:536` keys drafts by the viewed earlier chat, but Attach
    / paste stay enabled there (~1603, ~855 check `busy || authBusy`, not
    read-only). Fix: disable attaching in earlier (read-only) chats, or key
    attachments to the live organiser chat as before.
13. [done] **Typing dropped while no chat is loaded.** `AiAssistant.jsx:540-541`
    `setDraft` returns when `draftKey` is null (panel opening, model switch,
    organiser load failure) but the textarea (~1582) stays enabled. Fix: keep a
    pending draft and move it into the chat once it loads, or disable the box
    with a short "loading" state; never swallow keystrokes.
14. [done] **`sendingId` can stay stuck; references dropped on organiser refresh.**
    `AiAssistant.jsx:746`, `762-768`, `815`: when the organiser is replaced
    (`fresh.id !== id`) and the user switches tabs during that IPC call,
    `setSendingId(fresh.id)` is skipped and `finally` only clears when
    `current === fresh.id`, so `anyBusy` stays true. Line 765 rebinds to
    `fresh.id`, so references attached under the old id are left out, and on
    `modelChoiceRequired` (~798) the question is restored into the old chat's
    draft. Fix: clear by the id that was actually set, and carry the old chat's
    draft/references to `fresh.id`.

### Decide (small or judgement calls)

15. [declined] **Bitz fit on a flat selection.** `src/bits-and-parts.js:322-327` keeps
    scale 1 on a zero-size axis; a large Bit on a flat quad stays full
    thickness, and a near-flat selection (~1e-4) can squash it to almost zero
    (below 1e-8 `transformVertices` throws "Scale cannot be zero", caught in
    `BitsAndParts.jsx`). The task note (`bitz-replacement-fit.md`) says scale 1
    is deliberate; consider using the other axes' scale for flat/near-flat axes
    with a relative threshold.
16. [done] **Abandoned collision drag can be committed later.**
    `app/ModelManager.jsx:49-73`: if a handle is filtered out mid-drag (edge-on
    / out of view) the drag never ends; the list's `onClick` (~102) then
    `commit()`s the stale draft. Cancel the draft when its handle disappears or
    on pointer capture loss.
17. [done] **MDL comments silently dropped on Save as MDX.** `src/editor-document.js`
    ~543: comment edits are lost and the document is marked clean without
    listing comments in the "left out" notice. Add comments to that list.
18. [done] **Licence notice placement.** `THIRD_PARTY_NOTICES.md:17-22`: the Blizzard
    eye-texture entry sits among runtime dependencies; move it under "Warcraft
    data" and add the standard line ("retains Blizzard Entertainment's rights;
    no new asset license is granted").

Noted only, no change requested: bird mode now redirects every non-light bird
chat to the organiser (by design); `test/ai-offload.test.js:373` was relaxed to
count 18; `test/ai-attachments.electron.cjs:129` detach-wait now passes
trivially; "Remove current reference" button (~AiAssistant.jsx:1505) is dead
code and may be removed.

## Relevant owners

- AI: `docs/AI-HOOK.md`, `ai-bird-job-routing.md`, `ai-organiser-checkpoints.md`,
  `ai-chat-attachments.md`, `ai-private-references.md`.
- Update popup: `docs/AUTO_UPDATES.md`, `popup-helmet-eyes.md`.
- Sanity check: `docs/SANITY-CHECK.md`. Library: `docs/GAME-FILE-LIBRARY.md`.
- Managers: `docs/RESOURCE-MANAGERS-XL.md`, `manager-polish.md`.

## Result and decisions

- Items 1–14, 16–18 are implemented. Runtime changes are confined to the listed
  bug owners; no redesign, panels, version bump, release or installed-app update.
- Item 1: static helmet until optional effects are ready. Failed WebGL, native
  renderer/texture setup or image decode releases partial state; the editor stays
  mounted. Welcome sizing is independent of optional effects loading.
- Items 2–5/17: HD view-only is excluded from structural defects; current HD
  notices are translated; research names Hive Workshop and XGM. Reserved-looking
  user comment lines use ordinary MDL comment syntax without the space required
  by native metadata. Literal backslashes and existing metadata remain intact.
  MDX save impact now explicitly lists standard comments among omitted data.
- Items 6/16: sphere/box size controls only; disappearing projected handles cancel
  the current draft. Native cylinder/plane data and deletion remain available.
- Items 7–11: Resume preserves the roster title, includes all applied steps and
  restarts unfinished read-only helpers. Passing long-named checks use the same
  key as failures. Duplicate canonical bird destinations are rejected before
  region dispatch, including the same bird addressed once by name and once by ID.
- Items 12–14: unloaded/read-only chats reject attachments; input waits for a
  draft key with a localized loading state. Organiser replacement carries its
  prompt/images/references and model-choice restoration to the returned ID.
  Completion clears the sending indicator even after a model-tab switch.
- Item 15 declined: the existing fitting note and flat/point regression expressly
  preserve scale 1 on an axis without measurable thickness. Borrowing another
  axis scale or inventing a relative flatness threshold would change that
  approved behavior. Measurable axes still fit exactly or reject atomically.
- Item 18: eye textures now sit under Warcraft data with the existing Blizzard
  rights/no-new-license wording. Paths and provenance are retained.

## Verification

- Node 22.23.3; existing dependencies linked by junction. Task-controlled files,
  profiles, caches and temporary files stayed on D:. No computer-use control.
- `pnpm run build`: passed. Pinned FFmpeg verification and isolated full package
  passed (1,280 runtime/asset files, 55 locales).
- `pnpm test`: 57 passed.
- `pnpm run test:source`: 2,154 passed, 22 skipped, zero failures. CI reporter
  comparison against unchanged `.github/known-test-failures.txt`: zero new.
  Two old expectations were updated for the requested new omission notice and
  two additional catalog entries; the failure baseline was not widened.
- Hidden default Electron checks passed: `model-manager-regressions`,
  `ai-organiser-refresh`, `ai-attachments`, `ai-routing`, `ai-awareness`,
  `sanity-check`. These cover actual manager mouse rotation, cancellation,
  tab-switch recovery, donor scope, read-only attachment/paste blocking, delayed
  chat loading, helper/handover flow and restart/recovery.
- Hidden `no-gpu-warp`: `update-popup-fallback`, `welcome-prompt`,
  `update-popup-effects.browser` passed. The packaged fallback test explicitly
  denies the optional helmet WebGL context and also breaks the welcome effects
  bundle, proving both failure paths even when software WebGL is available.
- Parallel-bird no-gpu-warp harness: 14 checks passed with a generated five-geoset
  fixture, including combined boundaries/posed seams/save-reopen, independent
  edits, cost attribution, mouse orbit and lighter-model choice. Its initial
  setup required the `MDLXL_AI_CONSOLE_MODEL` variable; a negative coordinate
  exposed missing parentheses in the harness-generated check, now corrected.
  Retrying used a fresh disposable profile to avoid its recovery modal.
- Source regressions cover a 32-step checkpoint, long failure keys, Stop/Resume
  titles/helpers, duplicate name/ID destinations, repeated MDL saves, omission
  notice, reference rebinding and partial GL cleanup. No live paid provider or
  Warcraft III gameplay/artistic acceptance was exercised.

## Owner click-through

1. Open Search for updates and the first-launch welcome: check that text/buttons
   fit, closing works, and the editor remains usable on software graphics.
2. Open an HD model, run Help → Sanity Check, and check the view-only notice in
   Russian, Spanish or Chinese.
3. Managers → Model: resize a sphere/box, switch camera view during a drag, then
   select another shape; confirm there is no surprise edit and mouse orbit works.
4. Save/reopen an MDL comment beginning MDLXL_; try Save as MDX and check the
   comments-left-out notice.
5. In AI, attach a donor/picture, switch model tabs, open an earlier chat and
   Stop/Resume a helper job. Confirm drafts/references stay with the right chat.

## Handoff

- PR: https://github.com/UnsctMagic/MDLxL/pull/379 (open into main).
- Session: codex codex-review-fixes.
- Awaiting explicit merge approval. No merge/release/upgrade is authorized.
- Disposable builds, profiles and extracted runtimes removed after verification;
  unused task processes checked. Only the Git history and small result report
  remain on D:.

## Follow-up review (Claude Code, 2026-10-29)

Reviewed Codex's fixes above plus the Codex PRs not in the first review:
#375 (AI questions), #377 (particle travel) and #378 (CORP opens Decay Bone).
#378 is sound as is. Fixed on this branch (`1e04c50f`, `4c6f8fb0`, after
merging main at `d5acb46f`):

- Item 14 regression: `send()` wrote the cleared prompt and the model-choice
  question under the bird's id while the box reads the organiser's draft, so
  sending from a bird's chat left the text in the box and hid "Keep chosen /
  Use lighter". It now writes to the draft the box shows (`draftOwner`).
- Item 12 side effect: pasting a picture while the AI works was silently
  dropped; attaching is allowed again while busy (not in earlier chats).
- Item 10: Resume no longer restarts a helper whose report was delivered.
- #375: provider questions are whitelisted in `electron/ai-user-input.cjs`
  (`codexQuestions`, `claudeQuestions`); links, input types and validators come
  only from MDLxL's MCP adapters. Codex `isOther:false` hides free text. The
  input-page link shows its site; optional single choices can be cleared.
  Repeated provider notices update one row (UI and recorder). Question/notice
  controls and app-written reasons are in ru/es/zh and the current-source
  fixture.
- #377: synced OptimizeXL / Sort My Mess previews trail particles while
  playing; Showcase particles use the row speed (0 on a held pose) like the
  footprints; the All-timeline sequence lookup runs once per frame; both new
  Electron tests are registered in `scripts/run-packaged-tests.mjs`
  (footprint-travel needs `MDLXL_SUITE_HOOFPRINT`); map updated.

Not changed: Claude multi-select answers are sent as an array; the real CLI's
expected shape was not checked against a live turn. Sixteen older Electron
tests default to a Codex runtime Playwright path; the packaged runner overrides
it, so it was left alone.
