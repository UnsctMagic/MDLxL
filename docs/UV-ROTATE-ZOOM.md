# UV Wrapper Rotate and Zoom (owner-locked contract)

**Locked by the owner on 6 Nov 2026.** Scope: the Rotate and Zoom drag tools in
the UV Wrapper only. 3D editors keep their own rules (`src/rotation-drag.js`).

Do not change how these drags feel unless the owner explicitly asks for a new
rule. A complaint about one detail (speed, a jump) is fixed inside these rules,
never by switching to a different rule. If a test below fails, the feel changed:
fix the code, not the test numbers.

## Why this is locked

Between 26 Oct and 4 Nov 2026 the UV Rotate rule changed about ten times
(PRs #327, #409, #465, #469, #553) and Zoom changed twice (#494, #549). Each fix
solved one wish and brought back the previous problem, and users had to relearn
the tool each time:

- Following the mouse by angle snaps when the mouse passes over the piece. #469
  fixed that with a steady zone near the centre. #553 removed the zone and also
  let straight moves turn the piece. That brought back the snapping and made the
  strength depend on distance (a quarter circle turned 71°, 102° or 126°).
- Zoom by distance from the centre (#494) reacted to every move but could not
  shrink two points onto one spot. Going back to left/right only (#549) fixed
  that but ignored up/down movement.

## Rotate (`uvTurn` in `src/uv-tools.js`)

Owner, 6 Nov 2026: "The strength is perfect - but i want rotation to work also
left and right, just like it does now on main - but with this power, and no
jumping." Each mouse step counts in two parts:

- **Around the centre:** circling clockwise turns clockwise, counter-clockwise
  turns counter-clockwise, past full turns. From 48 px out the same circle
  turns the same amount at any distance: 70% of the mouse's angle (the UV
  Wrapper is 30% slower than the mouse). Within 48 px it goes by pixels moved
  around the centre, so the same circle turns less, steadily.
- **Left/right:** the part of the move that goes straight toward or away from
  the centre turns by its left/right travel: right = clockwise, left =
  counter-clockwise, 0.7 radian per 48 px (the same strength as circling at
  48 px). Straight up/down does not turn.
- Sweeping left/right across the piece, through or beside its centre, never
  snaps (no step over 3°). Below the centre a rightward drag is also a
  counter-clockwise circle, so it slows and briefly turns back near the middle;
  it stays smooth.
- The turn is in screen pixels, so non-square textures turn without skewing.
- One piece turns on its own spot; several turn around their shared centre.
- Hold Shift for fine control (Mouse → fine sensitivity, 20% by default);
  pressing or releasing it mid-drag never jumps. Alt fine control stays.
- No 3D rotation setting applies. FX texture fitting keeps circling only, at 1:1.

## Zoom (`scale` in `app/UVEditor.jsx`)

- Every mouse move counts, like Resize in the Movement tool: **right or up
  enlarges, left or down shrinks**. The two add up, so up-left or down-right
  cancel each other.
- Shrinking reaches zero: selected points land on exactly one spot and stay
  there while the mouse keeps going; it never rebounds.
- U and V scale uniformly. Shift fine control and the Shift axis locks behave
  as before; Alt fine control is preserved.
- FX texture fitting keeps its original left/right input.

## Verification

- [uv-tools.test.js](../test/uv-tools.test.js): `UV map Rotate: circling and
  left/right turn, same strength everywhere, never snap`. It fails on the 4 Nov rule.
- [uv-rotate-steady.electron.cjs](../test/uv-rotate-steady.electron.cjs): real
  mouse drags with the owner's mouse settings. It checks the same circle at
  60/120/300 px, straight left/right turning and up/down not turning, sweeps
  across the piece without snapping, Shift and Alt.
- [uv-zoom-collapse.electron.cjs](../test/uv-zoom-collapse.electron.cjs): real
  drags covering left/right/up/down, diagonals, collapse to exactly zero with no
  rebound, Shift, Alt, axis locks and undo, plus preservation of the other tools.
- [uv-wrapper-isolation.electron.cjs](../test/uv-wrapper-isolation.electron.cjs):
  FX texture fitting keeps its original input.

```powershell
pnpm run test:packaged default uv-rotate-steady,uv-zoom-collapse,uv-wrapper-isolation
```
