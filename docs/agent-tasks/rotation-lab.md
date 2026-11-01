# Rotation Lab: pick the 3D Rotate rule by feel

Status: ready to test; awaiting merge approval and independent Claude QA
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

## Implementation and hand-test build

- Branch: `codex/rotation-lab`, from `origin/main` `cb7065fb` (contract PR #495).
- Implementation: `40c1492b`; [PR #496](https://github.com/UnsctMagic/MDLxL/pull/496), ready for review.
- Standalone build: `D:\Claude\MDLxL-TestBuilds\RotationLab\MDLxL.exe`.
- Desktop shortcut: **MDLxL Rotation Lab**. The owner opens it; it was never
  opened on the owner's desktop during implementation.
- Local owner drag log: `rotation-drags.jsonl` beside the executable. Verification
  reports and two captures: `D:\Codex\rotation-lab-report`.
- Footman and its Textures are copied from the permanent fixture collection.
  Footman opens with all vertices selected, Rotate active and Quad View on.
  The existing model tabs also contain an asymmetric plain Box.
- Owner preferences are a read-only snapshot of the real installed profile:
  Rotation **0.5×**, general pointer **0.67×** (combined **0.335×**).
  This supersedes the older 0.3× estimate in the contract. **1×** bypasses both
  multipliers for comparisons. No real profile content is written.
- Reset restores positions, normals and tangents on the current test model;
  it remains a normal undoable document edit and keeps the camera.
- E composes screen-up and screen-right rotations, then uses **ZYX** Euler
  order for both preview and `transformVertices` commit. The original XYZ
  conversion was caught by a perspective drag and a negative-control unit test.
- B consumes every pointer sample for wrap-safe angle accumulation. Geometry
  preview still uses the existing once-per-frame coalescer.

### Isolation

Normal `App.jsx`, `Viewport.jsx`, `rotation-drag.js`, Vite config, Electron main
and preload, Settings, package manifest and normal entries are byte-identical to
`origin/main`. The ordinary build contains no lab UI or lab IPC strings.

`vite.rotation-lab.config.js` adds a separate HTML entry and applies explicit,
checked build-only substitutions to the real App/Viewport sources. A changed
upstream anchor fails the lab build. It does not write those sources. Only the
Vertices viewport receives the lab flag; other consumers keep the original
rotation block. The normal quad camera locks are bypassed only for the lab's
Vertices viewport, so Front/Top/Side can also orbit with normal mouse controls.

The builder copies Electron into the standalone output, stages the real runtime,
redirects the copied main process to the lab HTML, adds the lab preload bridge,
and selects a separate `lab-profile`. The installed app is never replaced.

### Reproduce

```powershell
pnpm exec vite build --config vite.rotation-lab.config.js
node scripts/build-rotation-lab.mjs --owner-settings '<real profile settings.json>' --shortcut
```

The builder requires an empty destination; override `--out` to use another D:
folder. Existing `node_modules` must be linked from a D: checkout as required by
AGENTS.md. It is never copied into the lab.

For hidden desktop verification, set `MDLXL_TEST_EXE` to the lab executable and
`MDLXL_PLAYWRIGHT_MODULE` to the available Playwright installation, then run
`scripts/hidden-run.ps1` with `node test/rotation-lab.electron.cjs` as its command.
The harness copies the owner's lab preferences into its own disposable profile.
`MDLXL_LAB_SINGLE_ONLY=1` is a targeted single-view diagnostic; the reported final
run uses the full matrix. `MDLXL_LAB_BASELINE=1` expects the lab UI and therefore
fails on the unchanged product, proving the missing-feature check.

### Measured turns

Same gesture at **1×**: start 40 px right and 40 px above the selection pivot,
then drag **40 px right**. Values are signed degrees about the pane's axis;
E values are degrees about screen up (screen right stays 0°).

| Style | Single 30° | Single 60° | Single 85° | Quad Front | Quad Top | Quad Side | Quad Perspective |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A | -32.0 | -38.8 | +40.0 | -28.3 | -28.3 | +28.3 | -39.6 |
| B | -18.4 | -18.4 | -18.4 | -18.4 | -18.4 | +18.4 | -18.4 |
| C | -40.0 | -40.0 | -40.0 | -40.0 | -40.0 | +40.0 | -40.0 |
| D | -32.0 | -38.8 | -40.0 | -28.3 | -28.3 | +28.3 | -39.6 |
| E | +40.0 | +40.0 | +40.0 | +40.0 | +40.0 | +40.0 | +40.0 |

### Verification and remaining acceptance

- Rotation/styles/isolation, viewport, per-frame drag, quad and gesture tests:
  **99 passed / 0 failed / 0 skipped**.
- Compatibility suite: **57 passed / 0 failed / 0 skipped**.
- Normal production build and separate lab build both succeed.
- Final hidden package run: **223 checks passed / 0 failed / 0 skipped**,
  **62 logged drags**, **40 measurement rows**, **0 renderer errors**.
- Hidden packaged checks cover all styles in single view at 30°/60°/85° and all
  four quad panes; Shift snap for every style in every quad pane; real mouse
  orbit in all panes and single view; Ctrl+Z; Reset including normals/tangents;
  vertical and diagonal E gestures; Box; copied owner speed; local log accuracy.
- Each drag checks committed vertex positions against an independent transform;
  E also checks the actual camera's screen axes. Viewpoint comparisons include
  position, quaternion, zoom and target, excluding clip-plane maintenance.
- Fail-first proof: the product build fails `five live style buttons exist`;
  wrong E order fails `free-turn commit must equal the preview`; old Reset fails
  `Reset restores original normals and tangents`.
- B–E pure-function tests cover Front/Top/Side and 30°/60°/85°, B's 12 px zone
  and wrap across 180°, projected ellipse tangents, A parity and no-injection parity.
- This is Codex implementation evidence. Claude's independent QA, owner feel
  preference and merge authorization remain pending. No release or Warcraft III
  acceptance is claimed.

## Next action

Owner double-clicks the shortcut, compares A–E and chooses the rule by feel.
A later separately approved PR makes that choice the product rule. The ordinary
app's rotation behavior is unchanged by this PR.
