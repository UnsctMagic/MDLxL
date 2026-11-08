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

- Only movement **around** the selection's centre turns it. Circling clockwise
  turns clockwise, counter-clockwise turns counter-clockwise, past full turns.
- Moving straight toward or away from the centre does **not** turn it.
- Outside the piece (and from 24 px out), the same circle turns the same amount at any distance: 70% of
  the mouse's angle (the UV Wrapper is 30% slower than the mouse).
- Within 24 px of the centre the turn goes by distance moved around the centre,
  so the same circle turns less, steadily. Sweeping across the piece never
  snaps it to the other side (no step over 3°).
- **A big piece never spins (owner, 7 Nov 2026).** The steady zone is the
  piece's own size: its farthest selected point from the centre, in screen
  pixels, measured when the drag starts (at least 24 px). While the mouse is
  over the piece, no point of it moves faster than 70% of the mouse. Outside
  the piece nothing changes. The owner: big pieces "rotate with disregard",
  small ones were "somewhat okay"; it "should NEVER rotate that fast". Free
  circling stays.
- History: 6 Nov the zone was 48 px and the owner said it was "still resisting
  when im close too much"; 16 px was then "a lil bit" less smooth
  than wanted, so it is 24 px. Adding left/right drag turning was
  tried the same day and rejected ("this isnt good, go back 1").
- The turn is in screen pixels, so non-square textures turn without skewing.
- One piece turns on its own spot; several turn around their shared centre.
- Hold Shift for fine control (Mouse → fine sensitivity, 20% by default);
  pressing or releasing it mid-drag never jumps. Alt fine control stays.
- No 3D rotation setting applies. FX texture fitting uses the same rule at 1:1
  with its original 48 px zone.

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

- [uv-tools.test.js](../test/uv-tools.test.js): `UV map Rotate: only circling
  turns, same strength everywhere, never snaps`. It fails on the 4 Nov rule.
- [uv-rotate-steady.electron.cjs](../test/uv-rotate-steady.electron.cjs): real
  mouse drags with the owner's mouse settings. It checks the same circle at
  24/60/120/300 px, straight moves that don't turn the piece, sweeps across the
  piece without snapping, Shift and Alt.
- [uv-zoom-collapse.electron.cjs](../test/uv-zoom-collapse.electron.cjs): real
  drags covering left/right/up/down, diagonals, collapse to exactly zero with no
  rebound, Shift, Alt, axis locks and undo, plus preservation of the other tools.
- [uv-wrapper-isolation.electron.cjs](../test/uv-wrapper-isolation.electron.cjs):
  FX texture fitting keeps its original input.

```powershell
pnpm run test:packaged default uv-rotate-steady,uv-zoom-collapse,uv-wrapper-isolation
```
