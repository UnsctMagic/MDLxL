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

## Recovery and renderer lifetime

- Autosave, tab changes and close share one checkpoint coordinator. Deduplicate
  by document/history/draft revision, yield while encoding, and serialize disk
  recovery in the desktop worker. Keep the existing disk schema and full undo.
  In-place paint strokes finish before their rasters are borrowed for encoding.
- A texture lookup must still notice changed loose files. When bytes are equal,
  retain the asset and Map identities so previews do not rebuild for no change.
- Keep live renderer/capture handles in refs, with only a readiness generation
  in render state when needed. Storing a handle in state can create a chain:
  current preview → parent callback closure → previous handle → old preview.
- Disconnect listeners from the root where they were registered. React may
  already have detached a canvas when its effect cleanup runs; getRootNode()
  then points at a different tree. Remove pending modifier-key listeners too.
- Check repeated real tab/quality changes after garbage collection. Flat DOM,
  listeners and retained buffers matter; disposing GL alone does not prove the
  old model and preview closures were released. See the
  [performance handover](agent-tasks/performance-plumbing.md) for regression proof.
