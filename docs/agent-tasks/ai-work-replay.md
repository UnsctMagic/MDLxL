# AI work replay (View AI work, fun to watch)

State: replay merged (branch `claude/ai-work-replay-only`, see Outcome). ThumperXL removed by the owner.
New providers: still only on the local branch `claude/ai-work-replay` (49f6d150), not merged, waiting for the owner.

## What the owner asked (18 Nov 2026)

"Will I see it actually edit? move vertex?" → "can we do it for anything? animating, texturing -
basically to make it FUN to watch (we can also add a bit of flare)" → "a new fable 5.2 high should
take care of this so visually it looks fantastic."

Today each AI step lands on the model at once. The replay shows every finished step as a short
animation from the old state to the new one, on the user's screen, with no AI cost (MDLxL already
has the before and after of each step).

## Agreed behaviour

- Vertices and shapes: points glide from old to new positions.
- New parts (geosets, e.g. a replaced shield): grow into place. Removed parts: shrink and fade out.
- Animation: new keys pop onto the timeline; the changed span plays once, moving bones softly lit.
- Textures and painting: new pixels sweep in across the model like a brush pass.
- UVs: pieces slide to their new place on the texture.
- Materials and colours: smooth crossfade.
- Emitters: removed ones fade out, new ones start up.
- Bones and pivots: the bone glides, the attached mesh follows.
- Flare: a small marker hovers where the AI works; the part being changed gets a soft glow trail.
  Nothing flashes or strobes (the owner hates flashing effects).

## Rules

- The AI never waits for a replay. If steps come faster than replays, older ones are skipped.
- One replay lasts about 0.5–1 s. Runs only while the View AI work switch is on.
- The replay is display only: the model data is already final; undo, save and the AI see the real model.
- Never reset the viewpoint unless View AI work is following (AGENTS.md camera rule).
- Live drawing updates at most once per display frame and refreshes only what changed
  (read docs/ARCHITECTURE.md first).
- Style with the MDLxL theme; no new panels, buttons or text beyond what the switch needs.
- Mouse camera rotation keeps working during replays.

## Part 2: ThumperXL, the AI's head (owner, 18 Nov 2026)

"thumper XL comes to life inside the AI work - he is the AI head within MDLxL. embedded in the AI
workstation and reacts to different processes the AI does." "Depending on which provider is loaded
in - his eyes are different colors."

- Owner correction (18 Nov): NOT a 3D model. Reuse the Thumper icon MDLxL already has,
  `public/branding/MDLxL.png` (the program's helmet icon: half wireframe with blue points, half
  painted, red eyes), and animate it 2.5D: the icon cut into a few flat layers from that same
  picture (horns, helmet, wireframe half, eyes/eye glow) that move with parallax, small tilts,
  turns and squash, plus a glow layer on the eyes. No new art and no 3D model.
- He lives inside the existing AI panel (`app/AiAssistant.jsx`), small, in the panel's own space
  (no new panel, toolbar or window).
- He reacts to what the AI is doing, from the events the console already gets (thinking, text,
  tool start/result per tool name, compaction, question/waiting for the user, error, stop, done,
  idle): e.g. idle = slow breathing glow; thinking = eyes slowly pulse, head tilts; looking at
  pictures/capture = head turns and eyes scan; editing = leans in, eyes narrow and brighten;
  waiting for the user = looks out at the user; error = eyes dim, small shake; done = nod.
  Smooth motion only, nothing flashes or strobes. Updates at most once per display frame and
  sleeps (no drawing) when nothing changes or the panel is closed.
- Eye colour by the loaded provider (`src/ai-providers.json` ids). Default proposal, owner may
  change: Claude API (`anthropic`) and Claude Code (`claude`) = Claude orange #D97757;
  OpenAI API (`openai`) and Codex (`codex`) = OpenAI green #10A37F; Compatible (`compatible`) =
  Thumper red #ff1a20. Switching provider changes the colour with a smooth fade.
- He ties into the replay: while View AI work is on, the marker/glow on the model uses his eye colour.
- No text bubbles or flavour text.

## Part 3: more AI providers (owner, 18 Nov 2026)

"Add all known accessible AI providers as logins/apis - what is currently ACCEPTABLE worldwide and
known - just like codex and claude are pretty popular, there are a few more. API keys and logins.
Order should always be Claude first, codex after."

- Order everywhere a provider list shows: Claude (Claude Code login, then Claude API), then Codex
  (Codex login, then OpenAI API), then the new ones, Compatible (custom endpoint) last.
  Today `src/ai-providers.json` lists codex first: fix that.
- Which providers: research the current ones (web) and pick mainstream, official, generally
  available worldwide, with tool/function calling good enough for MDLxL's `mdlxl_*` tools.
  Starting list to verify: API keys: Google Gemini, xAI Grok, Mistral, DeepSeek, Alibaba Qwen
  (international), OpenRouter, Groq; Amazon Bedrock and Azure OpenAI if their setup fits the
  existing connection form. Logins (official CLIs with MCP support, same pattern as Codex and
  Claude Code in `electron/ai-process.cjs` / `ai-providers.json`): Gemini CLI (Google account),
  GitHub Copilot CLI (GitHub account), and any other official CLI that qualifies.
  Local: Ollama and LM Studio if they fit the Compatible path as presets. Leave out anything that
  cannot call tools. Record the final list and every exclusion with its reason here.
- Reuse what exists: API providers that officially offer an OpenAI-compatible endpoint go through
  the existing OpenAI/compatible path in `electron/ai-providers.cjs` (`runApi`) so trimming,
  prices, reasoning, stop/steer keep working; add a native path only where tools need it.
  Each provider: model list, prices per model, key/login fields in the existing connection
  settings (no new panel), keys stored the same way as today's keys.
- Each new provider gets Thumper eye colour from its brand colour.
- Never enter, invent or copy real keys or logins; never copy auth between installs; never create
  accounts. Test the request/response format against a local mock server; the owner tests real
  logins and keys by hand.

## Where the code is

- `app/ai-watch.js`: what a finished call looked at (`watchLook`), tab to show, frame-coalesced follower.
- `app/ai-editor.js`: `follow()` / `applyFollow()` after each tool call, `flashGeoset()`, `setWatching()`.
- `app/Viewport.jsx` (`followFit`) and `app/GamePreview.jsx`: the live preview that follows.
- `app/AiAssistant.jsx`: the View AI work switch (`data-hotkey="watch"`).
- `electron/ai-chat-state.cjs`: the changed-part list per step (`changedGeosets`).
- Edits return `result.changes` (JSON-pointer paths such as `/Geosets/3/Vertices`).

## Watching it without AI credits

Drive the app's own `mdlxl_*` tools over its local MCP link (pattern in
`D:\Claude\MDLxL\TestBuilds\test-models\baron\run-baron.cjs`, export block) to apply real edits
step by step, so replays can be watched and tested without a paid AI job.

## Part 3 result: final provider list

Order everywhere: claude (Claude Code login), anthropic (Claude API), codex (Codex login), openai (OpenAI API),
gemini (Gemini CLI login), copilot (GitHub Copilot CLI login), google (Gemini API), xai, mistral, deepseek, qwen,
openrouter, groq, azure, ollama, lmstudio, compatible (last).

Excluded, with reasons:
- Amazon Bedrock: tool calling on its OpenAI-compatible address could not be confirmed. Usable today through Compatible.
- Any CLI without a published non-interactive mode with MCP support.

## Progress

Local commits on `claude/ai-work-replay` (base `claude/ai-full-power` 54d3a603), not online:
- 97a7734d AI work replay: each finished AI step plays from the old model to the new one
- d6628a07 ThumperXL: the AI's head lives in the AI console and reacts to the AI's work
- 49f6d150 More AI providers: Claude first, Codex after, then keys and logins for the others
- test fix and hand-over commit (see `git log`): `useSyncExternalStore` in `app/KeyframeTimeline.jsx` and `app/ThumperHead.jsx` now passes the server snapshot as third argument (static renders in tests need it; fixed 10 failing tests).

Test build: `D:\Claude\MDLxL\TestBuilds\ai-work-replay-01\MDLxL-win32-x64\MDLxL.exe` (02 = big Thumper, not merged)
Test model: `D:\Claude\MDLxL\TestBuilds\test-models\TEST AI REPLAY 01.mdx` (Footman copy; open it as `MDLxL.exe "<that file>"`).
Demo script: `D:\Claude\MDLxL\TestBuilds\test-models\replay-demo.cjs`. With the AI panel open and View AI work on, click Connection settings, Enable connection, Copy connection JSON, then run `node replay-demo.cjs`. It makes five edits about 1.8 s apart (vertex move, new part, removed part, animation key, texture change) through the app's local link. No AI provider is called.

Test results (19 Nov 2026):
- Source suite (`node --test test/*.test.js`): 4252 tests, 4237 pass, 6 fail, 9 skipped. The 6 failures also fail on the base `claude/ai-full-power` (checked on a clean checkout of 54d3a603): packaged-main-imports (ai-computer.cjs / ai-tools.js name `./mdlxl.mjs`), four particle-reentry tests, and the Movement/Portrait viewpoint dropdown test. Not caused by this branch; left alone and not added to the known-failures list.
- `node --test test/ai-*.test.js test/thumper-mood.test.js`: 491 tests, 490 pass, 0 fail.
- `vite build`: ok.
- Hidden packaged smoke (`test/ai-replay.electron.cjs` with the test model): 42/42 checks. Covers Thumper in the console header, eye colour changing on provider switch (red, Claude orange, OpenAI green), View AI work on, vertex move, new part, removed part, texture change and animation key replays, a newer step replacing a running replay, switch off, no page errors.
- Demo script against the hidden packaged build: all five edits applied, 5 replays seen, Thumper moods idle/looking/editing, no page errors.

Open items:
- Gemini CLI and Copilot CLI flags were written from their docs and never run against the real programs (settings.json field names, `--additional-mcp-config`, `--allow-tool` / `--deny-tool`).
- Sign-in checks for the new providers are lenient.
- No real mouse camera-drag check during a replay (the packaged smoke did not drag with a real mouse).
- The owner tests real keys and logins by hand.

## Outcome (19 Nov 2026)

- Owner looked at the test build: "the animations in the viewport is cool". Thumper at 40 px could
  not be seen; at 112 px above the message box (local aaee8691, build `ai-work-replay-02`) the owner
  then said: "Remove the icon from the AI thing, just merge the AI work-animations."
- Merged: the replay only (a09bd3aa = 97a7734d cherry-picked onto main, plus the timeline snapshot fix,
  docs and `test/ai-replay.electron.cjs` without Thumper checks). Replay colour stays Thumper red #ff1a20.
- Not merged, still on local `claude/ai-work-replay`: ThumperXL (removed by owner, do not re-propose
  unless asked) and the new providers (49f6d150: Claude first, Codex second, then Gemini CLI, Copilot
  CLI and API keys). Providers need the owner's word before they go anywhere; Gemini/Copilot CLI flags
  were never run against the real programs.
- Checks before merge: `node --test test/ai-*.test.js test/ui-primitives.test.js` 443 pass, 0 fail;
  hidden `test/ai-replay.electron.cjs` on the built app 30/30.
