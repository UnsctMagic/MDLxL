# Show pivot: double-click chain + bone shapes (Movement)

Status: ready for review
Owner / consolidator: Claude Code (session local_2c30e3da-07ed-4506-81d1-2e0d2e59deeb)
Updated: 2026-10-28

## Goal and completion criteria

- Owner: watching an animated model (often with bones hidden), double-click the
  part that moves and see every bone that moves it, so a small rotation that
  bends a whole arm is easy to trace. No extras: no rings, lines, trails or labels.
- Highlighted (Focused Skeleton) bones show their pivot and turning clearly as
  bone shapes; with Bones on, the other bones keep their normal MDLVis markers.

## Revision and local state

- Branch / checkout: `claude/show-pivot` in `.claude/worktrees/show-pivot`; PR #352.
- Required local fixtures: none (Electron check builds a synthetic model).

## Relevant owners

- `src/motion-chain.js` `motionChain`: skinned bones of a vertex (or one bone)
  plus all parents, root first.
- `app/GamePreview.jsx` `probeChain` (double-click: bone marker first, else the
  mesh vertex nearest the pointer; emitters keep their own double-click first).
  A `chainIds` prop forces Focused Skeleton lines and markers on.
- `app/rig-markers-gl.js`: `chainHighlightColors`, `boneShapeTails`,
  `boneShapePositions`, `BONE_SHAPE`. Every highlighted bone marker (Focused
  Skeleton from a selection, or a double-clicked chain) is drawn as an
  eight-face bone from its pivot to a highlighted child, else its own child
  bone, else a stub. One quarter is light or dark so roll is visible.
- `app/movement-overlay.js`: connectors that a bone shape already covers are
  skipped; the connector mask uses the shape's outline.
- `app/App.jsx` `probeChain`, chain status line, Esc via `mdlxl-escape-key`.

## Findings and decisions

- First version (rings at the strongest mover, link line, motion trail,
  labels) was rejected by the owner as redundant extras; removed.
- Highlight Chain (Controller panel) only scopes timeline keys; the view's
  highlighted skeleton is the Focused Skeleton display. The chain uses that.
- The app's global Esc consumes the key before the preview; use the cancelable
  `mdlxl-escape-key` event.
- Verified on a D: copy of the owner's WH_WOC_WarriorNurgle_Flail03: a
  double-click on the arm gives Bone_Root › Bone_Chest › Bone_Arm1_L ›
  Bone_Arm2_L › Bone_Hand_L as bone shapes; Bones on adds the other cubes.

## Changes and verification

- Checks: `node --test test/motion-chain.test.js test/bone-shapes.test.js
  test/bone-appearance.test.js` pass; `pnpm run test:source` 2085 tests, 0
  failures; `test/motion-chain.electron.cjs` hidden against `dist/` passes.
- Remaining: owner hand test in the packaged test build.

## Blockers and next action

- Owner test, then merge approval.
