# Show pivot: double-click selects a part's bones; axis cross on Focused Skeleton

Status: completed (merged via PR #352, owner approved 2026-10-28)
Owner / consolidator: Claude Code (session local_2c30e3da-07ed-4506-81d1-2e0d2e59deeb)
Updated: 2026-10-28

## Goal and completion criteria

- Owner: watching an animated model (often with bones hidden), double-click
  the part that moves; its bone(s) get selected and Focused Skeleton turns on,
  showing exactly as it always has (cubes, lines, parent/child colours).
- On the Focused Skeleton bones, add a visible pivot that turns with the bone.
  The owner chose style B from a mockup: an axis cross through the pivot.
- With Bones on, all other bones keep their normal MDLVis markers.

## Revision and local state

- Branch / checkout: `claude/show-pivot` in `.claude/worktrees/show-pivot`; PR #352.
- Required local fixtures: none (Electron check builds a synthetic model).

## Relevant owners

- `src/part-bones.js` `partBones`: the bones a vertex hangs on.
- `app/GamePreview.jsx` `pickPartBones` (double-click: a bone marker first,
  else the mesh vertex nearest the pointer; emitters keep their double-click).
- `app/App.jsx` `selectPartBones`: selects those bones and turns the
  `focusedSkeleton` display on via `changeOverlay`.
- `app/movement-overlay.js` `drawPivotCrosses`: on every bone highlighted by
  Focused Skeleton, the bone's own X (red), Y (green) and Z (blue) axes drawn
  through its pivot, 28/20/20 pixels, black-edged, on the node canvas.

## Findings and decisions

- Rejected earlier versions (do not repeat): rings at the strongest mover with
  a link line, motion trail and labels ("redundant extras"); replacing Focused
  Skeleton cubes with diamond bone shapes and a custom ancestor chain ("who
  asked you to change how focused skeleton works", "100% useless without
  visible bones"). Focused Skeleton must stay unchanged; only add the cross.
- The mockup showed two arms; the build adds the Z axis so a cross never
  collapses to a dot when one axis points at the camera.
- Verified on a D: copy of the owner's WH_WOC_WarriorNurgle_Flail03: a
  double-click on the hand selects Bone_Hand_L, Focused Skeleton turns on, the
  crosses sit on the black parent and red selected pivots and turn in playback.

## Changes and verification

- Checks: `node --test test/part-bones.test.js`; `pnpm run test:source` 2079
  tests, 0 failures; hidden-desktop `part-bones`, `bones-picker`,
  `movement-chain-focus-speed`, `rotation-interaction` against `dist/`.
- Remaining: owner hand test in the packaged test build.

## Blockers and next action

- None. Owner tested the build and approved the merge.
