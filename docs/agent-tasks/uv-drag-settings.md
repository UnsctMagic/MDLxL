# UV Wrapper drag settings

Status: built and tested on branch `claude/uv-drag-settings`, based on main
`9f11182d`, waiting for the owner's hand test. Not online until the owner says
"merge". Hand-test build: `D:\Claude\MDLxL-TestBuilds\UV-Drag-Settings`.

## Owner's request (8 Nov 2026)

"What we have now on the merged main is the default, do not change it - expand
the settings to allow users control." Later in the same conversation the owner
changed one default: Zoom becomes "from towards the center".

Everything is UV Wrapper only. "NONE of this should affect 3d tools." FX texture
fitting (`wrapperControls === false`) also keeps its original behaviour.

## Settings (`preferences.uvDrag`, see `src/uv-drag-settings.js`)

Shown on the existing Settings → Mouse → UV page. No new panels.

| Key | Default | Meaning |
|---|---|---|
| `rotateStyle` | `circle` | `circle`, `leftRight`, `both` |
| `rotateSpeed` | 70 | percent, 10–200 |
| `rotateZone` | 24 | deadzone near centre, px, 0–100 (0 = none) |
| `rotateBigPieces` | true | steady zone grows to the piece's own size |
| `rotateReverse` | false | only for `leftRight` and `both` |
| `rotateSnap` | 0 | degrees while Ctrl is held; 0 = off (1, 5, 15, 45, 90) |
| `zoomStyle` | `centre` | `centre`, `rightUp`, `leftRight` |
| `zoomSpeed` | 100 | percent, 10–400 |
| `zoomSnap` | 0 | percent while Ctrl is held; 0 = off (5, 10, 25) |

`preferences.uvEachPiece` (default false) is the always-visible "Each piece"
toggle in the UV Wrapper's Tools section.

Built-ins write all nine fields of `UV_DRAG_PRESETS`; `uvDragPreset` reports
which one matches all nine, or `custom`.

## Rotate rules

- `circle` at the defaults must stay numerically identical to main's `uvTurn`.
- Zone 0 means `steady = 1` (no division by zero). `rotateBigPieces` false means
  the zone ignores `drag.reach`. The 2 px centre skip stays.
- `leftRight`: 1 degree per pixel of horizontal mouse movement at 100%, right =
  clockwise, independent of the centre, no zone.
- `both`: the rejected-as-default build from #580 (commit `1e797017`): the
  around-the-centre part plus the straight part `sideways / 48`, both times speed.
- `rotateReverse` negates `leftRight` and the sideways part of `both`.
- Snap: while Ctrl is held and `rotateSnap` > 0, the applied angle is the
  accumulated turn rounded to the step. Releasing Ctrl never loses the real
  accumulated turn.

## Zoom rules

`centre` (new default, owner's rule): "the max is collapsed to the same spot -
as long as mouse as held its reversable, and its reversable with ctr z."

- Size is the mouse's distance from the centre divided by its distance at grab.
- The mouse reaching the centre (within 3 px) collapses the selection to exactly
  one spot. Carrying on past the centre stays collapsed and never grows back.
- Still holding: bringing the mouse back across the centre, the way it came,
  grows it again. A mouse that leaves the centre zone on the side it came from
  also grows it again. After release, one Ctrl+Z restores it.
- A drag starting within 12 px of the centre has no direction to read and uses
  `rightUp` for that drag.
- Implemented as a signed distance that depends only on where the mouse is:
  full distance on the grab side and out to 90 degrees around the centre, fading
  to zero at 120 degrees and negative behind it. A hand sweep that misses the
  centre therefore never rebounds. Each sample's change is weighted by Alt/Shift
  fine control and UV transform sensitivity, so changing Shift mid-drag never
  jumps. `factor = max(0, 1 + (virtual - start) / start * speed)`.
- `rightUp` and `leftRight` keep their #580 and #549 formulas times speed.
- Snap: while Ctrl is held and `zoomSnap` > 0, the factor is rounded to the step.
  Shift axis locks are unchanged.

## Each piece

- Off: today's behaviour, one shared centre.
- On: selected points are grouped by triangle connection (reuse
  `connectedVertices` and `eligibleUVFaces`, the same code as Select Connected);
  points at exactly the same UV spot join the same piece so a seam does not split
  it. Each group uses its own centre with the same angle or factor. Mouse input
  still reads around the shared centre. `drag.reach` becomes the largest reach of
  any piece from its own centre. The exact-number Rotate and Zoom commands obey
  it too. Mirror, Fold, Collapse and Move do not change.

## Verification

- Rotate's locked tests stay byte-identical and must pass.
- Old-vs-new `uvTurn` comparison over recorded drags at defaults.
- `uv-zoom-collapse.electron.cjs` proves the old rule by seeding
  `zoomStyle: 'rightUp'`; a new packaged test proves the new default and options.
