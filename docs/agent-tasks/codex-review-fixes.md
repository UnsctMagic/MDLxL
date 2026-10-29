# Fixes from the review of Codex's 0.35.0 → 0.36 changes

Status: active
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

- Branch: `claude/codex-review-fixes` (continue it; it only adds this note).
- Base / reviewed revision: `origin/main` at `6d211c88` (merge of #376).
- Uncommitted changes: none.
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

1. **Update popup blanks the app without WebGL.** `src/update-popup-effects.js:50`
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

2. **Sanity Check reports every view-only HD model as broken.**
   `app/SanityCheck.jsx:12` passes `doc.diagnostics`, which contains
   `{severity:'error', code:'HD_VIEW_ONLY'}` from `src/editor-document.js:326`;
   `src/sanity-check.js:6-8` counts it as a structural error ("Structural
   errors found"). Fix: drop or downgrade `HD_VIEW_ONLY` (it is a mode notice,
   not a model defect) in `checkSanity`. Add a unit test that passes source
   diagnostics containing it (`test/sanity-check.test.js` currently omits them).
3. **HD view-only notice lost its translations.** `src/model-version.js:34`
   `HD_VIEW_ONLY_MESSAGE` was reworded; es/ru/zh entries (es.json ~5035,
   ru.json ~5023, zh.json ~2154) are still keyed by the old English text and
   `translate()` needs an exact match. Re-key them to the new text and update
   `test/fixtures/locale-feature-sources.json` if it tracks it.
4. **Doubled word in AI web-research prompt.** `src/ai-tools.js:408`
   "XGM and XGM tutorials" (blind replace in `7797f977`). Restore a correct
   source list. Grep the rest of `7797f977` for other "X and X" artefacts.
5. **`MDLXL_` comment lines break MDL saves.** `src/model-comments.js:10`
   skips header lines starting with `// MDLXL_` on read, but
   `writeModelComments` writes user lines as `// <line>` unescaped, so a user
   line starting `MDLXL_` vanishes on reopen and every save fails with "Model
   comments did not reopen." (`src/editor-document.js` ~568/620). Fix: escape on
   write / unescape on read (or reject such lines in the textarea with a clear
   message). Add a round-trip test.
6. **Collision size sliders treat cylinders and planes as boxes.**
   `app/ModelManager.jsx:98-106` gives Width/Depth/Height to every non-sphere;
   on an upright cylinder (endpoints (0,0,0)/(0,0,100)) "Width" sets X to ±w/2
   and tilts the axis, and radius is never offered. Fix: sliders only for shapes
   the stage draws (box, sphere) or give cylinder Length + Radius and plane its
   two real extents, matching `src/model-collisions.js` `resizeCollision`.

### AI helpers (birds) and AI chat

7. **Resume overwrites the bird's job title.** `electron/ai-service.cjs:509`
   passes `job: bird.task?.plan?.reach || 'Resume task'`; `runWorker` (~1250
   `else if (!worker.tiny) worker.job = args.job`) replaces the stored title.
   Fix: keep the existing `bird.job` on resume.
8. **Resume only sees the last 20 steps.** `electron/ai-job-plan.cjs:61-72`
   `checkpointNote` keeps `recentSteps` = last 20 (tool/label/status only), yet
   the resume prompt (~781-783 in ai-service.cjs) says "do not repeat an applied
   edit". Fix: always include every *applied* step (compactly) plus the recent
   tail, so long jobs cannot redo early edits. Test with 25+ steps.
9. **Long check names never clear.** `ai-job-plan.cjs:52/56` records failures
   under `check.name.slice(0,200)` but deletes with the full name. Use the same
   key for both.
10. **Stopped helper never restarts on Resume.** Stop aborts
    `helperController`; `runHelper`'s catch sets `status:'failed'`; the restart
    (~ai-service.cjs:841) only handles `status === 'working'`, and
    `startHelper` returns early because `task.helper` exists. Fix: treat a
    cancelled/failed helper as restartable on resume.
11. **Two region jobs can share one bird in parallel.** `jobOf` (~629-635)
    maps each region job's `worker` to an existing bird without checking
    duplicates; both run under different `batch:index` locks and write the same
    conversation's `task` and transcript. Fix: reject or serialise duplicate
    workers within one batch.
12. **Attachments made while viewing an earlier chat are stranded.**
    `app/AiAssistant.jsx:536` keys drafts by the viewed earlier chat, but Attach
    / paste stay enabled there (~1603, ~855 check `busy || authBusy`, not
    read-only). Fix: disable attaching in earlier (read-only) chats, or key
    attachments to the live organiser chat as before.
13. **Typing dropped while no chat is loaded.** `AiAssistant.jsx:540-541`
    `setDraft` returns when `draftKey` is null (panel opening, model switch,
    organiser load failure) but the textarea (~1582) stays enabled. Fix: keep a
    pending draft and move it into the chat once it loads, or disable the box
    with a short "loading" state; never swallow keystrokes.
14. **`sendingId` can stay stuck; references dropped on organiser refresh.**
    `AiAssistant.jsx:746`, `762-768`, `815`: when the organiser is replaced
    (`fresh.id !== id`) and the user switches tabs during that IPC call,
    `setSendingId(fresh.id)` is skipped and `finally` only clears when
    `current === fresh.id`, so `anyBusy` stays true. Line 765 rebinds to
    `fresh.id`, so references attached under the old id are left out, and on
    `modelChoiceRequired` (~798) the question is restored into the old chat's
    draft. Fix: clear by the id that was actually set, and carry the old chat's
    draft/references to `fresh.id`.

### Decide (small or judgement calls)

15. **Bitz fit on a flat selection.** `src/bits-and-parts.js:322-327` keeps
    scale 1 on a zero-size axis; a large Bit on a flat quad stays full
    thickness, and a near-flat selection (~1e-4) can squash it to almost zero
    (below 1e-8 `transformVertices` throws "Scale cannot be zero", caught in
    `BitsAndParts.jsx`). The task note (`bitz-replacement-fit.md`) says scale 1
    is deliberate; consider using the other axes' scale for flat/near-flat axes
    with a relative threshold.
16. **Abandoned collision drag can be committed later.**
    `app/ModelManager.jsx:49-73`: if a handle is filtered out mid-drag (edge-on
    / out of view) the drag never ends; the list's `onClick` (~102) then
    `commit()`s the stale draft. Cancel the draft when its handle disappears or
    on pointer capture loss.
17. **MDL comments silently dropped on Save as MDX.** `src/editor-document.js`
    ~543: comment edits are lost and the document is marked clean without
    listing comments in the "left out" notice. Add comments to that list.
18. **Licence notice placement.** `THIRD_PARTY_NOTICES.md:17-22`: the Blizzard
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

## Changes and verification

- Item 1 implemented: static helmet until effects are ready; failed WebGL,
  renderer/texture setup or image decode releases partial state and keeps the
  popup mounted. Welcome sizing runs independently of optional effects.
- [x] Item 1 done. Five focused source tests, production build, pinned FFmpeg
  verification and full package passed. Hidden no-gpu-warp checks passed:
  update-popup-fallback (real packaged app; missing WebGL and failed bundle),
  welcome-prompt (Yes/Escape/layout), update-popup-effects.browser (normal eye
  timing, audio, remount/mute/reopen). Initial harness bootstrap/argument issues
  were corrected; no product workaround was needed. Items 2–18 remain.

## Blockers and next action

- None. Start with item 1, then 2-6, then 7-14, then decide 15-18.
- On completion: PR URL here, mark this note completed, remove its index row.

- [x] Item 2: exclude the HD_VIEW_ONLY mode notice from structural findings;
  retain actual parser/validator errors. Focused sanity tests: 8 passed.
- [x] Item 3: re-keyed and corrected the es/ru/zh HD preview notice. The locale
  fixture did not track the old notice; regression tests the exported current
  message directly. Localization current/catalog checks passed.
