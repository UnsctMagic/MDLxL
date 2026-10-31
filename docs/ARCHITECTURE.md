# MDLxL architecture rules

Short rules that apply across the whole app. Feature details live in the
[project map](agent-map.md) and its linked guides.

## Only do work someone can see

**Rule:** never compute, copy, redraw or send something more often than the
result can be seen or used. Work whose result nobody sees is waste, and waste is
what makes the app feel slow.

The usual offender is the mouse. A mouse reports its position several hundred
times a second (high-polling mice up to 1000). The screen shows about 60 to 144
pictures a second. Anything done per mouse event beyond one per picture is
thrown away before it is ever shown, yet it still costs time. It also queues
behind other work, which is what lag *is*: the app is busy with positions the
hand left long ago.

So, for every live interaction (dragging vertices, UV points, bones, handles,
windows, splitters, camera turning, timeline scrubbing, hover highlights):

1. The pointer event only **records** the newest position and asks for one frame:
   `createFrameCoalescer(...).schedule()` from
   [viewport-performance.js](../app/viewport-performance.js).
2. The frame callback does the real work **once**, with the newest position:
   the maths, the redraw, the live preview, any React state or parent callback.
   Inside a 3D view (Viewport, GamePreview, PaintViewport) pass the view's
   `scheduler.frames` to the coalescer: the work then runs at the start of the
   view's next draw, so it is drawn in that same frame. With a plain animation
   frame it would land just after a draw and show one frame late.
3. Pointer up calls `flush()` first, so the final result is exactly where the
   hand stopped. Cancel and unmount call `cancel()`.
4. A live preview updates **only what the drag changed**, not the whole model
   (example: `GamePreview.updateUV` reloads only the dragged geosets).
5. Lifting state into [App.jsx](../app/App.jsx) re-renders the whole editor.
   During a drag, keep it local or send it at most once per frame.

The same rule covers anything else repeated quickly: timers, playback frames,
resize events, file watchers. Ask "who sees the result of this run?" If the
answer is "nobody, a newer one replaces it", do not run it.

### When per-event work is right

Keep per-event (or per-sample) work only when each sample changes the result:
the path of a paint stroke or AI sketch stroke, or an eraser that must touch
everything the pointer crossed. Even then, record every sample, but redraw
once per frame (see `viewport-sketch.js`). Write a short comment saying why,
so the next change does not "fix" it.

### How this is checked

- [live-drag-frames](../test/live-drag-frames.test.js) lists every live drag and
  fails if one goes back to doing its expensive work per pointer event. Add each
  new drag to it.
- A change that adds a drag, hover or live preview is reviewed against this page.
- History: this rule exists because the same lag kept returning in new places
  (AI console redraw, 26 Oct 2026; UV Wrapper, mesh moves, camera turning and
  20 more drags, 31 Oct 2026). Each was fixed alone until the rule was written down.
