# AI work replay (View AI work, fun to watch)

State: not started. Scheduled for 19 Nov 2026 at 08:10 (Fable 5.2, high effort).
Base: local branch `claude/ai-full-power` (not online). Work branch: `claude/ai-work-replay`.

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

## Progress

(Update here.)
