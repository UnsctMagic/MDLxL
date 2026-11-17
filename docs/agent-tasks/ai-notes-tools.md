# AI console notes in the UV Wrapper and Movement

Owner request (17 Nov 2026): "Add AI tools inside the UV wrapper - e.g pencil/markup
etc they should work in 2D as well. for movement editor - add directional arrows,
movement helpers - e.g stuff I can put to quickly show an AI what I want ... find
the holy grail for animating".

State: built on local branch `claude/ai-markup` (Claude Code), not online. Waiting
for the owner's hand test with `TestBuilds\ai-notes` and
`TestBuilds\test-models\TEST AI NOTES 01.mdx`.

## What exists

The AI console's drawing tools now draw where the user works (`SKETCH_SPACES` in
`src/ai-sketch.js`; the editor summary's `sketchSpace` picks the place):

- Vertices: Marker, Pen, Eraser, unchanged.
- UV Wrapper (open, not minimized): Marker, Pen, Arrow, Eraser on the map, in UV
  coordinates. Covered UV points are stored per note by geoset and vertex
  (`uvStrokeVertices`, through the combined map's `refs`).
- Movement: Marker, Pen, Arrow, Hold, Hit, Eraser over the animation
  (`app/preview-sketch.js`). Notes keep sequence and frame, show faint away from it.
  The Arrow is the "act it out" tool: holding it plays the animation in real time
  from the shown frame (through `onTimeChange`, not playback), stamps every point
  with its frame, draws spacing dots every 100 frames, and returns the playhead to
  the start on release. The AI gets path + frames, `speedProfile` and `turnDegrees`
  when the stroke circles the joint it started on.

Notes never touch the model, its Undo or saved files. AI captures still draw only
the model-space notes.

## Checks run

- `test/ai-sketch.test.js` (16, incl. 6 new), `test/live-drag-frames.test.js`.
- Packaged, hidden: new `test/ai-notes.electron.cjs` (18 real-mouse checks) and the
  existing `test/ai-console.electron.cjs` both pass on the packaged build.

## Open

- Owner's hand test of feel (Arrow timing, how faint far-away notes are).
- Not translated yet: new tool names/tooltips need the six locale catalogs before release.
