# BindXL: bone binding on a moving model

Status: ready to test (owner hand-test), awaiting review
Owner / consolidator: Claude Code (session local_cc9346e6-e42d-4311-9379-7afa1afd653c)
Updated: 2026-11-07

## Goal and completion criteria

- Owner, 6–7 Nov 2026: binding by hand and with AI is "a nightmare". The geoset
  pose is right and the skeleton is laid out; it only needs binding. Armour keeps
  its plating feel and moves on its own; seams of fur, cloth, skin (sometimes
  armour) stay together. Wanted: a plug-and-play window like FX/EMTR with a live
  moving model, colours, skeleton and sliders. "Make it SUPER EASY", ADHD friendly.
- Done when the owner can open BIND, see colours on a moving model, move
  sliders, click wrong parts to fix them, Commit, and Undo.
- Owner rules: never mention other editors, their authors or the reference
  models' creators anywhere public (PR, docs, commits, UI). Reference models stay
  private on D: (`D:\Claude\BindXL-research\refs`) and are never committed.

## Revision and local state

- Branch: `claude/bind-xl`, stacked on `claude/bone-wiggle` (PR 583, the Bones
  tab Wiggle). Merge 583 first or merge both together.
- Scoring scripts (private, not in the repo): session scratchpad `bind/score.mjs`
  (`@list` files, `{"rebind":r,"corrupt":true}`), `pieces.mjs`, `confusion.mjs`;
  copies of the key ones in `D:\Claude\BindXL-research`.

## Relevant owners

- [BindXL](../BIND-XL.md) holds behaviour, engine rules and the measured results.
- Map row "BindXL" in [agent-map.md](../agent-map.md).

## Findings and decisions

- Verified: Blizzard SD rigs hang mesh bones under animated helpers; those bones
  share a junk pivot. Regions must come from the nearest animated node (driver).
- Verified: a from-skeleton binder plateaus around 2% mean drift against expert
  bindings; the residual is whole pieces on a plausible nearby bone, which
  position alone cannot tell apart. Hence keep-what-works (Rebind) plus colours
  and click-to-fix.
- Decision: the duplicate-bone weighting trick ([A,A,B]) is not used; native
  models never do it and in-game support is unconfirmed. Max 4 bones per vertex
  (the preview's GPU limit).
- Avoid repeating: picking a stiff piece's bone by the pivot inside it, or by
  the bone line through it — both scored worse on owner models.

## Changes and verification

- Changed: engine, window, dock icon (BIND, Ensnare picture with the standard
  frame), Managers menu, Alt+B, preview bone-colour shader, single-click part
  picking, joint-only markers, binding-only fast re-upload, translations (5).
- Checks: `node --test test/bind-xl.test.js` (10 pass); localization, hotkey,
  module label and command tests pass; `pnpm run build`; packaged-style workflow
  `test/bind-xl.electron.cjs` passed hidden on the owner's Tzeentch Champion and
  Vampire Dragon (screens in `out/bind-xl-ui`).
- Remaining: owner hand-test of feel (slider defaults, colours on very large
  rigs, Flex speed); full packaged suite not run.

## Blockers and next action

- Next: owner tries the test build; adjust defaults from their feedback.
- Ideas held back (not built, ask first): mirror binding L↔R, paint/brush
  selection across many parts, binding eyedropper.
