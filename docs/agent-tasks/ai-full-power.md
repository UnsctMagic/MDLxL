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
- Verified (18 Nov, real Fable 5.2 requests, probe in `D:\Claude\ai-compaction-probe`):
  one job is one API turn, so `clear_thinking` never touched the job's own reasoning
  (chat-1096e5c5: 137 calls, 43.9M tokens, ~320K per call). Threshold compaction
  (`compact_20260112`, trigger 100K, own `instructions`) now runs alongside clearing;
  with ~66K-token tool results, requests went 133.5K input -> compaction -> 1.2K for
  the reply and ~67.6K for the next step, every request 200 with the strict thinking
  check on, history saved from the compaction block. Edit order accepted:
  clear_thinking, clear_tool_uses, compact. Per-request tokens are in the chat's
  `requestUsage`; a refused piece is a chat warning and only that piece goes off.
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

## Round 2: every remaining gap (owner, 18 Nov: "Identify ALL the lacking areas... so that next release is a perfect AI... address ALL the features MDLxL offers"; plus "add VIEW AI WORK, I want to see him edit the model LIVE")

Evidence: six read-only audits in `out/audit/` of the `ai-full-power` worktree (untracked):
`chats.md` (Codex thread history, 67 threads / 4,425 tool calls, plus the live Baron job),
`known.md` (open notes, provider parity), `geometry.md`, `animation.md`, `surface.md`,
`effects-view.md`. Live Baron job (Claude API, Fable 5.2 xhigh): $10.04 after ~11 min,
37 calls, 26 calls before the first edit, context held at 101–118K by trimming; per-step
cost is mostly thinking output at xhigh.

Streams (each its own worktree and branch from `claude/ai-full-power`, merged back by the
consolidator). IDs are referenced in commits.

**P: pictures that tell the truth** (`app/AiOffscreenRender.jsx`, `app/preview-presentation.js`,
`app/ai-editor.js` picture paths, `src/ai-uv-picture.js`, capture schema in `src/ai-tools.js`)
- P1 wireframe: `previewPresentationProps` overrides `mode`; pass `previewMode` from AiOffscreenRender.
- P2 plain/solid shading does nothing (no untextured preview prop).
- P3 "only these geosets" and the user's hidden geosets are dropped (`hiddenGeosets` kept only
  with uv flags); framing crops the model top and parks close-ups in a corner.
- P4 particles/ribbons not replayed from onset in pictures; `showParticles` follows the user's preference.
- P5 overlay flags (bones, attachments, normals/facing, collision, cameras), `teamColor`, model camera / portrait view per sample.
- P6 UV pictures: tiny-overshoot margin, all layers / team colour, island labels.
- P7 filmstrip: N frames of one animation in one image with shared framing.
- P8 motion trails: a bone's path through an animation drawn over the model, keys marked.

**M: measurements** (new `src` modules, `mdlxl_sample` / `mdlxl_document` options)
- M1 motion style vs donor and vs the native corpus: key spacing, interpolation mix, speed curve, impact timing, holds.
- M2 loop seams, foot slide vs MoveSpeed, event timing; motion warnings (`scanMotion`) reported after animation edits.
- M3 surface intersection / clipping across frames (penetration, automatic part pairs, worst-frame close-up), plus a push-out fixer.
- M4 mesh health (holes, non-manifold, degenerate, T-junctions, islands, vertex limit).
- M5 file size: `validate` returns a size breakdown (geosets, tracks, textures); texture inventory (size, format, bytes, used by).
- M6 texture pixels as data for scripts (`api.texture`, regions, stats).
- M7 Sanity Check runnable by the AI with its findings.
- M8 `mdlxl_sample` returns texture animations and geoset colour/alpha.

**R: reach and discoverability** (`src/ai-capabilities.js`, wrappers in `src`, command paths in `app/ai-editor.js`)
- R1 DONE (branch `claude/ai-fp-reach`): every listed module is in an `AI_AREAS` area; new `fx` and `lifecycle`
  areas; `AREA_WORDS` and `GUIDE_WORDS` know KB, bytes, polygon, clipboard, sanity, corpse, decay, death.
- R2 DONE: `src/ai-screen-names.js` (`SCREEN_NAMES`) maps on-screen names to `mdlxl_command` ids and
  `module.function` engines; `searchAiCapabilities` returns them as `screen`; `screenOnly` uses them.
  `test/ai-reach.test.js` walks the UI labels (UV Wrapper tools, toolbar icons, Modules/Managers/Help menus,
  sidebar buttons, geoset operations) and fails on an unmapped label. New UI labels need a table entry.
- R3 DONE: `src/optimizexl-run.js` (`optimizeModelStage`, `planToSize`, `applyOptimized`), `src/uv-actions.js`
  (`flipUVs`, `unwrapUVs`, `commitUVCornerPlans`, `fitUVsToRegion`, `packUVIslands`), `src/forge-vertex-run.js`
  (`runForgeVertexTool`, `addForgeVertexShape`), hidden `mdlxl_command` ids 'Separate by loose parts',
  'Nuclear separation', 'Merge geosets', 'Nuclear Weld', 'Delete free vertices', 'Cut' (+ `cut`, `resolutions`),
  optional `distance` / `pivot` / `angle` for Extrude, Mirror/Collapse/Weld and Rotate normals; the selection
  remaps live in `src/mesh-actions.js` and `app/App.jsx` now calls them; AnimXL presets exported from `src/anim-xl.js`.
- R4 not done (paint a region into a new texture): skipped for time; it needs a new texture slot, so only on request.
- R5 library: sounds/all files, World Editor source, texture checks; R6 portrait/camera helpers in `src`.

**H: harness robustness and cost** (`app/ai-sandbox.js`, `electron/ai-workspace.cjs`, `electron/ai-service.cjs`,
`electron/ai-providers.cjs`, save checks)
- H1 scripts: `const before` / `log` name clash (wrap code in an inner function), `parameters` always defined, clone-safe returns.
- H2 workspace `preview` refuses candidates outside the first marked selection (46% failures).
- H3 save verification blocks edits on pre-existing `_MdxDefaults` quirks the AI never touched.
- H4 an edit lost to a "different document session"; tab stalls ("bring the tab to the front").
- H5 cap and summarise huge tool outputs (typed array dumps); cache help topics read in the same chat.
- H6 context: clear old huge tool inputs; trim inside one job for OpenAI / compatible; compatible usage and window size.
- H7 remove the 64-round default cap (the optional step limit stays).
- H8 spend limit and dollar cost for every provider; Haiku 5.5 over-100K price tier.
- H9 OpenAI reasoning items kept between steps; non-thinking Claude max output.

**B: behaviour** (`src/ai-tools.js` instructions, handbook, decision diary)
- B1 DONE (branch `claude/ai-fp-behaviour`): `AI_EDITING_BODY` says improve/fix/reshape/retexture keeps the user's part, shape and part list,
  changes only the named kind of data, never wipes unnamed work; re-make/re-animate/start over is done fully and boldly; one look after each edit.
- B2 DONE: act on clear requests, ask only when two readings change the result and neither is obvious, no whole-model survey before
  the first edit, checks scaled to the request (handbook's review line too). All sentence changes are `BEHAVIOUR_RULES` pairs in `test/ai-prompts.test.js`.
- B3 DONE: `electron/ai-diary.cjs` `noteRequirements`/`requirementsText` (owner-worded, max 8, replaced by same subject or a new size limit,
  released by "you can now"/"forget", from requests and steering, wiped with chats); `src/ai-model-digest.js` + `mdlxl_checkpoint {digest, since}`:
  each job end stores `entry.delivered`, the next job gets "Hand edits since the AI's last delivery". Extraction is keyword-based (may miss or over-catch).
- B4 DONE: `AI_ANIMATION_CRAFT` + `animationRequest` in `src/ai-tools.js`, sent once per provider history with animation requests,
  independent of the handbook. POSE/AnimXL recipes beyond the AnimXL Bezier caution not added.

**W: View AI work** (`app/AiAssistant.jsx`, `app/AiParts.jsx`, `app/ai-editor.js`, `app/App.jsx`, `app/ai-job-copy.js`)
- W1 DONE (branch `claude/ai-fp-watch`): tool results hand their content to `AiRecorder` (`electron/ai-chat-state.cjs`
  `toolResultMedia`), which keeps JPEG copies (`shrinkPicture` in `ai-service.cjs`, 384 px, 6 per step, newest 120 per
  chat) as `part.thumbs`; full pictures never reach the saved chat or the console. `StepPictures` in `AiParts.jsx`.
- W2 DONE: switch `watchAi` (main `setSwitch`, `ai:watchAi`, `aiWatchAi`), `bridge.setWatching(open && on)`.
  `app/ai-watch.js` (`watchLook`, `createWatchFollower`, `needsFit`, `tabToShow`, `watchTargetRule`); `AiEditorBridge.follow`
  / `applyFollow` after each call; App `showTab`, `afterPaint`, `followFit` (event `mdlxl-ai-follow`, handled only by
  the main GamePreview/Viewport with `aiFollow`). Fork rule while watching adopts selection/animation changes;
  `forkedDraft` / `openForkedDraft` + `job.opened` guard in `deliverJob`. Not done: no follow for a forked job that
  was not opened (no tab), and a mid-drag camera move is not detected in GamePreview.
- W3 DONE: `part.changed.geosets` from the edit change list; `ChangedParts` chips call `bridge.flashGeoset` ->
  App `aiFlash` drives `hoveredGeoset` for 1.6 s. Proof: `test/ai-watch.test.js` (11), `test/ai-watch.electron.cjs` (23 checks).

**K: animation kit** (`src/ai-anim-kit.js`, owner request 18 Nov after the Baron chat spent about $26 writing its own maths)
- K1 DONE: `kitRig` (POSE chains, held weapon tips, mount/rider, `pose(seq, ms)`), `Pose` world moves (`turn`, `move`, `aim`,
  `reach` = `solveTwoBone` with a pole direction, `hold`, `plant`, `feet`), `animate` (shape-preserving cubic through key poses,
  `each` constraints, `smooth` with sharp holds, `follow` springs with `share`, `easeBack`, `timing` map), `check` (wobble meter,
  clipping minus the stand pose via `poseCrossings` in `mesh-intersect.js`, foot slide, seam, bends, bytes), `write` (key insertion
  until no skinned vertex or pivot is more than `tolerance` off, measured with `sampleTrack`; one-sided Hermite/squad tangents;
  replaces a same-named clip in place, else appends; new clips copy the template's visibility keys), `retime`. Method list: `kitHelp()`.
  Port of the method of the owner's Lord of Change workspace (kit.py, common.finish, jit, fscan, kfit/shrinkC, timing/retime) only.
- K2 DONE: `AI_ANIMATION_CRAFT` card (use the kit, one animation at a time, never delete first); `mdlxl_capture` samples take
  `documentId` to draw an open reference model (view, sequence, frame, plain, wireframe). Proof: `test/ai-anim-kit.test.js` (9).

**C: the AI's own computer** (owner, 18 Nov: "I want FULL power - that means I want the SAME capacity it has in
claude/chatgpt/codex + the powers of having a modeling program"; a Baron knight job took 137 steps and $50)
- C1 DONE: `electron/ai-computer.cjs`: work folder per chat `<profile>/ai/work/<chat id>` (`workFolderOf`), kept across
  prompts, removed by `removeChats` and by `cleanupUnused` for chats that no longer exist. The workspace switch, its
  offer question and per-request clearing are gone; `mdlxl_workspace` files live in the work folder (`createWorkspace` `folder`).
- C2 DONE: `runTask` starts one MCP server per job (`bridge`), shared by Claude Code/Codex (`options.mcp`) and scripts.
  Claude Code: `--tools`/`--allowedTools` Bash, Read, Write, Edit, Glob, Grep, cwd = work folder (older threads from the
  profile folder restart with the last exchange: `threadFolder`). Codex: `features.shell_tool=true`,
  `sandbox_workspace_write.network_access=true`, thread `sandbox: 'workspace-write'`, cwd = work folder, approval never.
  Claude API: `bash_20250124` and `text_editor_20250728` by type plus `view_image`; OpenAI/compatible: `shell`,
  `read_file`, `write_file`, `edit_file`, `view_image` (`AI_COMPUTER_TOOLS_*` in `src/ai-tools.js`), run by
  `createComputer` (PowerShell `-File` on Windows, 120 s default / 600 s max, 30,000-character cap, Stop kills the tree).
- C3 DONE: every command gets `MDLXL_URL`, `MDLXL_AUTH`, `MDLXL_TARGET`, `MDLXL_WORK`, `PYTHONPATH`; the folder holds
  `mdlxl.py`/`mdlxl.mjs` (`call`, `context`, `script`, `capture` saving PNGs in `pictures/`, `export_model`, `apply_file`)
  and `.mdlxl-connection.json` (Codex filters `*TOKEN*` variables). `mdlxl_document apply` (`app/ai-editor.js`
  `modelFromFile`, `mergeFileModel`/`matchArrayTypes` in `src/ai-model.js`) applies an MDL/MDX file as one Undo step,
  compared with the model as that format reads it back, so MDL text noise is not a change. Export into a work folder
  replaces its own file without the dialog (`workFolder` in `ai:writeModel` / `writeAiModel`).
- C4 DONE: `AI_COMPUTER` in the system prompt when tools are on; `Work folder of this chat: …` in each prompt.
- Proof: `test/ai-computer.test.js` (8). Removed `test/ai-local-workspace.electron.cjs` (switch and offer no longer exist).
- Not verified: a real Claude Code/Codex/API run in the packaged app; Codex's Windows sandbox with `workspace-write`
  (pip `--user` writes outside the work folder and may be refused there); Claude Code's Bash needs Git Bash on Windows.
