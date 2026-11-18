# AI full power (no gates, real Stop, shrinking history, eyes, tools on hidden tabs)

Status: ready for review (owner hand test of a packaged build)
Owner / consolidator: Claude Code (branch `claude/ai-full-power`)
Updated: 2026-11-18

## Goal and completion criteria

- Owner, 18 Nov 2026, after the Shield_Blackwing chat (Claude API, Fable 5.2,
  extra-high effort) used ~12.9M tokens and made one small real edit: "I wanted AI
  to just have full power in MDLxL - it seems SUPER gated." The owner approved all
  seven gaps of the review ("Yes, all seven"):
  1. History never shrank (every step re-sent every old picture, dump and thought).
  2. Plan gate (two fixes required before any edit; commands counted as edits).
  3. Review gate (no finish without a formal review; up to 4 forced re-runs).
  4. Half blind (no preview of game textures, no UV layout or wireframe pictures,
     zoom only by changing the real selection).
  5. Editor commands refused or waiting on a hidden tab / private copy.
  6. Stop: typed "stop" was advice and replaced the job request; a question restarted
     work; the Stop button needed many presses.
  7. No price for Fable 5.2, so no dollars shown and no working spending limit.
- Done when the owner hand-tests a packaged build with a real provider and the
  chat stops wasting rounds. This reverses the 27 Oct "look first, then change once"
  plan gate (0.34.0, [AI hook harness](ai-hook-harness.md)) on the owner's request.

## Revision and local state

- Branch / checkout: `claude/ai-full-power` in `.claude/worktrees/ai-full-power`
  (own `node_modules`, FFmpeg copied). Local only, not pushed.
- Base: `main` 0084b368 plus the unmerged local `claude/ai-prices` (cfcc4c39,
  Fable 5.2 and other prices), merged into this branch.
- Overlap to expect at merge: local `claude/ai-markup` (AI notes in UV Wrapper and
  Movement) also edits `app/AiAssistant.jsx`, `app/ai-editor.js`, `docs/AI-HOOK.md`,
  `app/GamePreview.jsx` and the locale catalog sizes in
  `test/localization-catalogs.test.js`.

## Relevant owners

- Job loop and gates: `electron/ai-service.cjs` `runTask`, `steer`, `send`,
  `acceptDelivery`, `lastExchange`/`FRESH_HISTORY_AT`; `electron/ai-job-plan.cjs`
  `recordFailures` (advisory only now).
- Instructions: `src/ai-tools.js` `AI_EDITING_BODY`, tool descriptions;
  the deliberate sentence changes are listed as `FULL_POWER_RULES` in
  `test/ai-prompts.test.js`.
- Stop: `src/ai-transcript.js` `isStopRequest`; console `app/AiAssistant.jsx`
  `stopJob`, frame-batched event stream (`streamed`, `dropStreamed`).
- History: `electron/ai-providers.cjs` `anthropicContextEditing`
  (beta `context-management-2025-06-27`, retried without it on refusal).
- Eyes: `app/ai-assets.js` `loadTextureAsset`; `app/ai-editor.js` `picture`,
  `uvPictures`, `checkSample`; `src/ai-uv-picture.js`.
- Hidden-tab commands: `src/mesh-actions.js` `applyMeshAction` (App's mesh tools
  moved there unchanged); `app/ai-editor.js` `VIEW_COMMANDS`, `SELECTION_COMMANDS`,
  `runsOffScreen`, `screenOnly`; host `meshOptions` in `app/App.jsx`.
- User guide: [AI in MDLxL](../AI-HOOK.md).

## Findings and decisions

- Verified (chat logs in the desktop profile): Shield chat run 1 = 64 rounds,
  10.8M tokens, zero real edits; 22 captures, 21 camera/selection steps, 5 fake
  texture-viewer geosets. The earlier Codex chat on the same shield used 15.6M
  tokens over 6 prompts (~200K per tool step, context 255K).
- Verified: images were only ~15% of a run's tokens; the growing history and the
  forced looking were the cost.
- Decision: client-side trimming of old turns would break Fable 5.2's preserved
  thinking (every account is checked); the API's own context editing does not.
- Decision: pictures follow the task view's wireframe only when a sample asks
  (`wireframe: true`); following the user's live wireframe view would change every
  picture's look.
- Uncertain: the exact cause of "Stop needed ~10 presses" was not reproduced. Most
  likely the console re-rendered the whole chat on every streamed word; events now
  reach the chat once per frame and Stop acts on pointer down for every job the
  chat shows as working.

## Changes and verification

- Changed: all seven gaps (commit list on the branch).
- Checks: `node --test test/ai-*.test.js test/mesh-actions.test.js
  test/localization-catalogs.test.js` pass. The 14 new or changed checks were run
  against the pre-change code (a temporary worktree at 879728a2) and failed there.
  `npx vite build` passes. Full source suite (`node --test test/*.test.js`): 4065 pass, 5 fail, 9 skipped; the 5 (4 EMTR in particle-reentry, 1 portrait-toolbar viewpoint dropdown) fail the same way on unchanged main 0084b368.
- Hidden probe of the built app (MCP tool calls on `TEST AI FULLPOWER 01.mdx`): zoom, vertex close-up (selection unchanged), UV layout picture and texture previews by path and game path work; no error notices. Hidden smoke of the packaged build: AI panel opens and closes, no page errors.
- Remaining: **wireframe pictures do not draw lines yet** (the picture equals the plain one; `mode: wireframe` reaches AiOffscreenRender but the capture shows the textured surface; investigate GamePreview `render`/`captureView` and the geometry overlay). UV pictures widen to whole tiles for tiny overshoots past 0..1 (Footman geoset 1 gave u -1..2): add a small margin in `uvRange`. no real-provider run (costs the owner money; owner
  hand test). Haiku 5.5's over-100K price tier is not modelled.

## Blockers and next action

- Test build: `D:ClaudeMDLxLTestBuildsai-full-powerMDLxL-win32-x64` (owner AI connection and settings copied from the desktop profile; codex/claude sign-in folders not copied). Opened for the owner on 18 Nov with both Baron files at his request.
- Next: fix the wireframe picture and the UV margin; owner hand test (animating the Baron); then "merge".
- On completion: mark completed with the merge revision and remove the README row.
