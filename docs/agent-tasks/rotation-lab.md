# Rotation Lab: pick the 3D Rotate rule by feel

Status: superseded by [Gizmo Lab](gizmo-lab.md) (2026-11-01); its build (PR #496) is reused there
Owner / consolidator: Codex (implementation); Claude Code (contract, review)
Updated: 2026-11-01

## Why

The owner is fed up with 3D Rotate. It feels right in one view and wrong in
another, and every fix in one place regressed another. Verified cause on
`origin/main` `911c345a`: the `ring` rule in
[src/rotation-drag.js](../../src/rotation-drag.js) changes behaviour with the
camera angle. `rotationRingTangent` switches between "tangent at the grab point"
(ring seen open) and "near side of the ring" (ring thinner than `THIN_RING` 0.3,
or grab within `ON_AXIS` of the axis line), with another switch at
`FACING_AXIS`. With the ring seen open, grabbing above vs below the pivot reverses
which way a sideways drag turns (reads as "mirrored"), and only the part of the
drag along the frozen tangent counts (reads as "weak / resisting"). Quad view's
Front/Top/Side panes always look straight down the Vertices turn axis
(`Viewport.jsx` takes the axis from the pane's locked workplane), so they always
hit the "depends where you clicked" case. The owner confirmed: changing the camera
ruins the feel; only the front camera feels good.

The earlier history is in [MdlVis-style Rotate drag](mdlvis-style-rotate-drag.md)
(Pivot-based was rejected for an edge-on fallback, a 12 px dead zone and cranking
near the centre). Do not reread it beyond that; this lab replaces the guessing.

## Goal and completion criteria

Build an isolated **Rotation Lab** the owner opens with a double-click. It is the
real MDLxL Vertices editor (same viewport, same quad view, same selection, same
Rotate tool and workplane buttons, same theme), with one extra row of five buttons
that swap the rotate rule live. The owner plays with all five and says which one
wins. That choice then becomes the single 3D Rotate rule in a separate, later PR.

Done means:

1. Double-click opens the lab with a test model already loaded and some vertices
   already selected, Rotate tool active, quad view on. Nothing else to set up.
2. Five buttons **A B C D E**, each with its plain name (below) and a short hover
   tooltip saying how to drag. One click switches; the next drag uses the new
   rule. The active button is highlighted. No other new panels.
3. **Reset model** button puts the vertices back. Ctrl+Z works as in MDLxL.
4. Single view and quad view both work (the existing quad toggle), with normal
   mouse camera rotation in every pane.
5. Shift snaps to 15° in every style, as today.
6. Speed: every style uses the owner's saved Rotation sensitivity (copied from
   their real profile, read-only), with a toggle **Your speed / 1×** so feel is
   not hidden by the owner's slow 0.3× setting.
7. The real MDLxL app behaves exactly as before. No new setting appears in
   Settings, no menu entry, no shipped UI.

## The five styles

All five turn about the same axis the Vertices editor uses today (the axis not in
the pane's workplane), so only the mouse rule differs. Sign is always the
right-hand rule, so authored data is unchanged.

| Button | Name | Rule | Industry reference |
| --- | --- | --- | --- |
| A | Current | Exactly today's `ring` rule, untouched. The baseline to compare against. | MDLxL today |
| B | Circle around | Turn = the angle your mouse sweeps around the pivot on screen, summed every sample (wrap-safe). Direction decided once at grab: flip if the axis points away from the camera. No edge-on fallback, no camera-angle thresholds. Inside 12 px of the pivot, hold the last angle (do not jam). | Blender R |
| C | Straight drag | Left/right only: 1° per pixel of horizontal movement. Right = turns clockwise as you see it from where the axis points at you; flip if it points away. Vertical movement ignored. | MdlVis, many 2D tools |
| D | Drawn ring | Direction = the tangent of the ring as it is drawn on screen (the projected ellipse) at the grab point, fixed for the drag; speed 1° per pixel along it. One formula only: when the ellipse is nearly a line, use its long direction. No switches. | Unity, Maya |
| E | Free turn | Ignores the workplane axis: left/right turns about the screen's up axis, up/down about the screen's right axis, 1° per pixel. | Blender R R (trackball), ZBrush |

B–E must contain **no camera-angle cutoffs**: the same hand movement gives the
same turn whatever the camera angle (except D's direction, which follows the drawn
ring by design). Put B–E as pure functions in one new module
(`src/rotation-lab-styles.js`), each `begin(options)` / `degrees(drag, dx, dy)`
matching `beginRotationDrag` / `rotationDragDegrees`. Smallest possible hook in
product code so the lab can swap the rule (for example an optional injected rule
passed through the existing rotation options); with no injection, every product
call path is byte-for-byte today's behaviour.

## How the lab is built (constraints)

- Reuse the real component tree for the Vertices editor and quad view
  ([app/Viewport.jsx](../../app/Viewport.jsx), [app/quad-view.js](../../app/quad-view.js),
  the existing toolbar tools). Do not rebuild a look-alike viewport.
- Separate entry (its own html/entry in the Vite build and its own Electron start
  path), separate disposable profile. Never write the owner's real profile.
- Test model: copy `human__footman.mdx` (and its `Textures`) from
  `D:\Claude\MDLxL-TestModels\optimizexl-footman` into the lab build; also a
  plain box so the turn is easy to read. Never modify or clean
  `D:\Claude\MDLxL-TestModels`.
- Hand-test build in `D:\Claude\MDLxL-TestBuilds\RotationLab` with a desktop
  shortcut named `MDLxL Rotation Lab`. Do not open it on the owner's screen; they
  open it.
- Write a small local log next to the lab (style, pane, camera direction, pixels
  dragged, degrees turned per drag) so Claude can read what the owner tried. No
  on-screen log.
- MDLxL theme variables only. No flavour text: names and how-to-drag tooltips only.

## Verification

- Unit tests (`test/rotation-lab-styles.test.js`): for B–E, a fixed gesture gives
  the same degrees in Front, Top, Side and at 30°/60°/85° camera tilt (D: same
  speed along its ring); B has no flip across the 12 px zone and wraps past 180°;
  A matches `rotationDragDegrees` exactly; product paths without injection are
  unchanged (existing `test/rotation-drag.test.js` still passes).
- Packaged real-mouse drags (hidden desktop, as in
  `test/rotation-interaction.electron.cjs`): every style, single view at three
  camera angles plus all four quad panes, Shift snap, Reset, Ctrl+Z, and a camera
  orbit drag in each pane.
- Report a short table: style × view → degrees for the same drag. Then `ready to
  test` with a 5-line click-through for the owner.

## Out of scope

- Changing the real Rotate rule, Settings, Bones, POSE/Movement, Forge, Showcase,
  or the UV map (the UV map keeps its own turn; see the Two Rotate rules in
  AGENTS/the old note). That is the follow-up PR after the owner picks.

## Revision and local state

- Branch / checkout: contract on `claude/rotation-lab-contract`; Codex builds on
  its own `codex/` branch from `origin/main`.
- Base / checked revision: `origin/main` `911c345a`.
- Required local fixtures: `D:\Claude\MDLxL-TestModels\optimizexl-footman`.

## Blockers and next action

- None. Next: Codex builds the lab and hands the owner the shortcut.
- After the owner picks: one PR makes that style the only 3D Rotate rule in every
  3D editor, removes the losers and the lab hook, and keeps the lab only if the
  owner wants it.
