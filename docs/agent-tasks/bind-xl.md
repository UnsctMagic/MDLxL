# BindXL: bone binding on a moving model

Status: second version ready to test (owner hand-test), awaiting review
Owner / consolidator: Claude Code (session local_cc9346e6-e42d-4311-9379-7afa1afd653c)
Updated: 2026-11-07

## Goal and completion criteria

- Owner, 6–7 Nov 2026: binding by hand and with AI is "a nightmare". The geoset
  pose is right and the skeleton is laid out; it only needs binding. Armour keeps
  its plating feel and moves on its own; seams of fur, cloth, skin (sometimes
  armour) stay together. Wanted: a plug-and-play window like FX/EMTR with a live
  moving model, colours, skeleton and sliders. "Make it SUPER EASY", ADHD friendly.
- Second round (owner, 7 Nov, after rejecting the first build on the Vampire
  Dragon): study far more well-bound models; reach the quality of the owner's
  repaired dragon fast; BindXL "can never DESTROY a good binding"; an optional
  scale to protect the current binding; more readable colours.
- Done when the owner can open BIND, see readable colours on a moving model,
  fix wrong parts by clicking (Stiff / Bend / Good / bone), optionally Protect,
  Commit and Undo, and good bindings survive untouched.
- Owner rules: never mention other editors, their authors or the reference
  models' creators anywhere public (PR, docs, commits, UI). Reference models stay
  private on D: (`D:\Claude\BindXL-research\refs`) and are never committed.

## Revision and local state

- Branch: `claude/bind-xl`, stacked on `claude/bone-wiggle` (PR 583, the Bones
  tab Wiggle). Merge 583 first or merge both together.
- Private research (not in the repo), `D:\Claude\BindXL-research`:
  - `lists/<set>.txt` model lists (natives, lpw, herrdave, gluma, grendel,
    direfury, mounted), built by `lists.mjs` from `refs/`.
  - `bench.mjs <sets> <scenarios> [settings] [--max N] [--old]`: damage
    (good, wrong, strays, torn, geoset, unbound, wipe) → plan → per-part drift.
  - `harmed.mjs <set>`: good parts the default changes, with clue values.
  - `dataset.mjs` + `train.mjs`: stiff-part ranker data and training
    (weights in `ranker-all.json`, copied into `RANK_WEIGHTS`); `kind.mjs` for
    `KIND_WEIGHTS`; `trustdist.mjs` for the trust thresholds.
  - `pairscore.mjs <bad> <good>`: owner's dragon versions vs the repaired one;
    the dragon files are in `refs/owner`.

## Relevant owners

- [BindXL](../BIND-XL.md) holds behaviour, engine rules and the measured results.
- Map row "BindXL" in [agent-map.md](../agent-map.md).

## Findings and decisions

- Verified: regions must come from the nearest animated node (Blizzard rigs hang
  mesh bones under animated helpers at one junk pivot).
- Verified (study of ~970 models, checked on 816 mounted ones): a stiff part's
  bone is the nearest bone only ~55% of the time; the bone of what it sits on
  (nearest other geometry) ~80%; a learned score over these clues 82–89%.
- Verified: from shape alone a good binding cannot be told from a "bound by
  geoset" one (experts often use bones that are not the nearest). Decision:
  keep bound parts unless the evidence is strong (misrank > 6 and misfit > 2%),
  always keep parts alone on prop bones; Protect lets the owner trade safety
  for repairs; Stiff / Bend / Good do the rest by click.
- Verified: the first version's failures on the dragon came from nearest-bone
  of any skeleton plus transitive seam glue. Seams now glue only exact spots on
  one body (hierarchy within 3 steps), never change parts that stay (except a
  blend across a parent-child joint), and rebuilt parts follow parts that stay.
- Verified: modellers blend with still bones on purpose (calming a part) and
  bind gibs to bones shown only in Death/Decay; neither is touched now.
- Open weakness: binding bending parts from the skeleton alone (Protect None or
  Bend) leaves about half of expert bending parts more than 1% off. A per-vertex
  learned ranker (like the stiff one) is the next study step.
- Decision: the duplicate-bone weighting trick ([A,A,B]) is not used; max 4
  bones per vertex (the preview's GPU limit).

## Changes and verification

- Changed: engine rewritten (`analyzeBinding` poses/clues/trust, `planBinding`
  trust/rank/seams), window (Rebind and Seams sliders removed; Protect + scale;
  Good replaces Current; Stiff on several parts = one plate; palette colours and
  one-bone focus), translations (12 strings replaced in 5 catalogs, counts unchanged).
- Checks: `node --test test/bind-xl.test.js` (14 pass); localization catalog and
  quality tests pass; `pnpm run build`; packaged workflow `test/bind-xl.electron.cjs`
  passed hidden on the owner's Vampire Dragon and Tzeentch Champion.
- Remaining: owner hand-test; full source suite and full packaged suite.

## Blockers and next action

- Next: owner tries the new test build; then per-vertex ranker for bending parts.
- Ideas held back (not built, ask first): mirror binding L↔R, paint/brush
  selection across many parts, binding eyedropper.
