# UV Wrapper Zoom drag (contract)

Owner correction, 4 Nov 2026: restore the pre-patch Zoom behavior. This supersedes
1 Nov's radial-drag request. Scope: **the UV Wrapper Zoom tool only.**

## Behavior

The **Zoom** tool (`scale`) resizes selected UV points around their centre:

- Drag left to shrink, right to enlarge, regardless of where the drag starts.
- Shrinking reaches zero: two selected vertices occupy exactly the same UV
  coordinate. Continuing left keeps them there; it does not enlarge them again.
- U and V scale uniformly, with the existing Shift axis lock and Alt fine control.
- Vertical movement does not affect the scale, as before the radial patch.

## Owner and regression

[app/UVEditor.jsx](../app/UVEditor.jsx), `applyMove`, uses the original expression:

```js
const factor = Math.max(0, 1 + dx / 100);
```

Commit `96eb51f2` replaced this with distance from the selection's centre.
That unsigned distance rebounds after crossing the centre and remains nonzero
when the pointer passes beside it. Restore only the original factor calculation.

## Preserve

- Select, Move, Rotate (`uvTurn`), Mirror, Fold and numeric UV commands.
- Shift axis lock, Alt sensitivity, snapping, frame coalescing and undo/redo.
- UV pan and view zoom (wheel and `drag.type === 'zoom'`).
- 3D Resize, camera zoom, bone scaling and all shared input helpers.

UV Zoom must not share new drag math with any 3D tool.

## Verification

[uv-zoom-collapse.electron.cjs](../test/uv-zoom-collapse.electron.cjs) selects two
points from the permanent Footman fixture using real mouse clicks, then tests
left/right scaling from both sides and the centre, exact zero during and after
the drag, no rebound, undo, Shift axes and Alt. It also checks unchanged Move,
Rotate, Mirror, Fold, UV camera zoom and normal 3D mouse rotation/zoom.

Run through the hidden packaged-test runner, with a fresh package:

```powershell
pnpm run test:packaged default uv-zoom-collapse
```

The check must fail on the radial version before it counts. Claude owns the
independent QA verdict; merge still requires the owner's approval.
