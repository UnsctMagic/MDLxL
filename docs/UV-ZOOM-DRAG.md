# UV Wrapper Zoom drag (contract)

Owner correction, 4 Nov 2026: restore the pre-patch Zoom behavior. This supersedes
1 Nov's radial-drag request. Scope: **the UV Wrapper Zoom tool only.**

## Behavior

The **Zoom** tool (`scale`) resizes selected UV points around their centre:

- Drag left to shrink, right to enlarge, regardless of where the drag starts.
- Shrinking reaches zero: two selected vertices occupy exactly the same UV
  coordinate. Continuing left keeps them there; it does not enlarge them again.
- U and V scale uniformly. Hold Shift for the existing fine-control speed (20%
  by default); press or release it during a drag without a jump. Existing Shift
  axis locks still apply, and Alt fine control is preserved without doubling it.
- Vertical movement does not affect the scale, as before the radial patch.

## Owner and regression

[app/UVWorkspace.jsx](../app/UVWorkspace.jsx) alone enables `wrapperControls` in
[app/UVEditor.jsx](../app/UVEditor.jsx). Zoom accumulates horizontal movement at
the current normal/fine rate, then uses `Math.max(0, 1 + scaleDX / 100)`. This
keeps the same full-speed behavior while allowing Shift changes mid-drag.
FX texture fitting defaults to the original input and receives none of the
wrapper-specific Rotate or Zoom changes.

Commit `96eb51f2` replaced this with distance from the selection's centre.
That unsigned distance rebounds after crossing the centre and remains nonzero
when the pointer passes beside it. The original signed horizontal behavior remains the base; Shift scales only
subsequent movement.

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
the drag, no rebound, undo, Shift fine press/release, Shift axes and Alt. It also checks unchanged Move,
Rotate, Mirror, Fold, UV camera zoom and normal 3D mouse rotation/zoom.
[uv-wrapper-isolation.electron.cjs](../test/uv-wrapper-isolation.electron.cjs)
checks that FX Rotate and Scale retain their original mouse behavior.

Run through the hidden packaged-test runner, with a fresh package:

```powershell
pnpm run test:packaged default uv-zoom-collapse
```

The check must fail on the radial version before it counts. Claude owns the
independent QA verdict; merge still requires the owner's approval.
