# AI work replay (View AI work, fun to watch)

State: not started. Scheduled for 19 Nov 2026 morning (Fable 5.2, high effort).
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
