# UV Wrapper Zoom drag (contract)

Owner request, 1 Nov 2026. Scope: **the UV Wrapper only.**

## What the owner wants

In the UV Wrapper, the **Zoom** tool (the `scale` tool, icon `Maximize2`,
label "Zoom") resizes the selected UV points. Today it only reacts to
**left/right** mouse movement. Up/down does nothing.

The UV map is a flat 2D space, so the drag must work in **every direction**
and feel natural:

- Dragging **away from the selection's centre** enlarges, dragging **toward
  it** shrinks — in any direction (right, left, up, down, diagonal).
- The drag is uniform (U and V scale together), exactly like today.
- Shift still locks to the chosen axis, as today.
- Alt still gives fine control, as today (via `pointerDragPoint`).

## Where it lives

Only [app/UVEditor.jsx](../app/UVEditor.jsx), `pointerMove`, the line

```js
const factor = Math.max(0, 1 + dx / 100);
```

`dy` is ignored there. That is the bug.

## The change

Make the factor radial around the pivot, the same way the Rotate drag right
above it already uses `drag.pivotScreen`:

- `a` = start point minus pivot, `b` = current point minus pivot (both already
  computed for Rotate).
- When the drag started clearly away from the pivot (`Math.hypot(...a) > 12`,
  same threshold Rotate uses): `factor = Math.hypot(...b) / Math.hypot(...a)`.
- When the drag started on or very near the pivot (no usable distance):
  fall back to `1 + (dx - dy) / 100` so right **and** up enlarge, left **and**
  down shrink. (Screen y grows downward, hence `- dy`.)
- Keep `Math.max(0, …)`.

Nothing else in the UV Wrapper changes: Move, Rotate, Mirror, Fold, the
numeric scale command (`kind === 'scale'` around line 264), snapping, pan and
the view-zoom (`drag.type === 'zoom'`, the camera, not the tool) stay as they
are.

## Do NOT touch (other "scale/zoom/resize" code)

These are different features with their own rules. Leave them exactly as they are:

- 3D model viewports: [Viewport.jsx](../app/Viewport.jsx), [PaintViewport.jsx](../app/PaintViewport.jsx) (`dragScale`).
- Bone/movement scale: [GamePreview.jsx](../app/GamePreview.jsx), [movement-overlay.js](../app/movement-overlay.js),
  [MovementControllerRecomp.jsx](../app/MovementControllerRecomp.jsx), `movementFreeScaleValues`.
- The vertex Resize tool and zoom anchor in [App.jsx](../app/App.jsx) / [EditorControls.jsx](../app/EditorControls.jsx).
- The UV view camera zoom (`s.zoom`, mouse wheel, zoom binding) in UVEditor.jsx.
- Shared helpers (`pointerDragPoint`, `uvTransformSensitivity`, `viewportCursor`).

Same rule as the two Rotate drags: the 3D tools and the UV map each keep their
own drag maths; never share or "unify" them.

## Done means

- In the UV Wrapper with points selected and Zoom active: dragging right, left,
  up, down or diagonally away from the selection enlarges it; toward it shrinks
  it; it never jumps on the first pixel of the drag.
- Starting the drag right on the selection centre still works (right/up
  enlarge, left/down shrink).
- Shift axis lock and Alt fine control behave as before.
- 3D Resize, bone scale and UV view zoom behave exactly as before.
- `pnpm run build`, `pnpm test`, `pnpm run test:source` pass (CI baseline unchanged).
  A focused test for the factor is welcome if it can stay small (e.g. export a
  tiny `uvScaleFactor(start, end, pivot)` helper from UVEditor.jsx or
  `src/uv-tools.js` and test it in [test/uv-tools.test.js](../test/uv-tools.test.js)).
- Report `ready to test` with a short click-through for the owner.
