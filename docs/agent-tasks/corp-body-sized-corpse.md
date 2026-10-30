# CORP: body-sized corpse on the POSE body parts

Status: two-piece arm preview awaiting owner judgment; full capture set must
be regenerated after acceptance. No PR opened.
Owner: Codex, chat `01a18c85-4bcf-74f2-9520-9aff51b2a0c9`
Updated: 2026-10-30
Branch: `claude/corp-long-bones`, continued from handover `48bf08d5` in
`D:\Codex\mdlxl-corp-body-20261030\repo`. The original Claude checkout was clean
and is untouched. Base of this lane is release `6049624e`; eventual PR targets
`claude/release-0.36.1`, not main. Do not merge or release.

## Owner decisions and gate

CORP must use the last Death pose and POSE body parts, producing native-sized
remains rather than tiny strips. The owner explicitly chose **Blizzard overall
size, allowing small native overhangs**, when measurements showed that strict
containment conflicts with Blizzard's meshes. Preserve body reuse, sinking in
Decay Flesh, static/fading Decay Bone, the native skull shape, weapon exclusion,
and the existing editing controls. The owner subsequently corrected the arm
layout: normal arms need **an upper-arm bone plus a forearm/hand piece**, not
hand-only. This supersedes the earlier Claude prompt. Owner judges the 20 listed
models pass/fail
before any PR. Release 0.37.0 still waits for this gate.

## Current implementation

`src/corpse-geometry.js` keeps disconnected
body-skin patches instead of fitting an entire part from its nearest tiny patch;
fits projected part extents; includes foot skin in lower-leg pieces; resolves
skinless hand references; preserves native forearm-sized hands without treating
held equipment as palm skin; recognizes detached anatomical Death chests without
recognizing flail roots as anatomy. It measures the actual union of corpse
footprints and adjusts widths toward the Blizzard 0.826 corpse/body area median.
Skulls scale uniformly. Part placement/length and manual edits are preserved.
The arm planner now includes the upper arm on a normal articulated arm chain.
Recognized tail joints retain their own skin instead of attributing it to the
root; this corrects the Skink rib cage stretching along its tail.
`app/AutoCorpse.jsx` resolves the draft's gutz texture through the existing game-data
loader, so models without an original gutz reference no longer show grey
placeholders. No control/layout changes. No edits to `auto-corpse.js`, installed
apps, real profiles, model originals, versions or imported libraries.

The exact fitting contract and measurement limitations are in
[AUTO-CORPSE.md](../AUTO-CORPSE.md). Metrics measure XY triangle unions, not texture
alpha pixels. Matching the median is not per-species artistic acceptance; the table exposes
per-unit coverage and overhang rather than claiming every model passes.

## Evidence

Artifacts: `D:\Codex\mdlxl-corp-body-20261030\reports`.
- `baseline.json` and `after.json`: per-unit data for all 206 SD gutz corpses.
- `owners-before.json` / `owners-after.json`: all 20 requested owner models.
- `source-before.log`: three new regressions fail on handover code; 22 pass,
  3 fail, zero skips. `source-final.log`: 26 pass, zero failures/skips.
- `source-tail-before.log`: Skink rib endpoint 3.27 torso lengths from the
  neck fails before separating tail skin.
- `source-arms-before.log`: the owner's revised arm check fails 0 versus 2
  upper-arm bones on the hand-only candidate.
- Separate regression caught a held Ogre club enlarging its hand before the
  corrected hand-component selection; see `source-held-before.log`.
- `corpus-preservation.json`: supplied corpus checks for body reuse, posed/sunk
  body, living animation, saved size and Undo; 362 pass, zero failures. The 36
  unsupported inputs are enumerated, not counted as successes.
- `packaged-size.log`: hidden real-app Create/Save As, size, camera and keyboard
  check. Baseline failed: saved Footman corpse area 1795.4 versus native 3067.9.
- `texture-before.log`: the new preview texture assertion fails on the old app
  on Krell; the final app resolves and renders the native texture.
- `review.html` and the five contact sheets are historical captures of the
  hand-only candidate `f9173fc3`, before the tail/arm corrections. They are
  explicitly labeled stale for acceptance.
- `arm-review` contains the current Empire Captain preview for owner judgment;
  `arm-comparison.png` compares its prior one-piece and current two-piece arms.
  The 206-unit table and `after.json` track the current geometry.
- Missing Gluma body textures were found in the website texture folders.
  `fixture-hashes.json` records byte-identical model copies staged beside those
  existing textures. Originals are unchanged.

## Remaining work

1. Obtain the owner's judgment on the two-piece arms shown on Empire Captain.
   Then regenerate all 20 captures on the accepted candidate, with the five
   Gluma textures staged beside byte-identical copies, and obtain pass/fail per
   model. The Khorne Flail Knight Hero has a pre-existing global-effect visibility
   refusal. Show it; do not alter its globals.
2. After acceptance, push this named branch and open a PR into
   `claude/release-0.36.1`. No merge authorization. Claude owns independent QA and
   the release gate under [TESTING-RULES.md](../TESTING-RULES.md).

Use existing linked dependencies. No pnpm run/test/install. Commands:
`npx vite build`, `node scripts/package.mjs --out out/pkg --overwrite`,
`node --test test/auto-corpse.test.js`, and the hidden packaged runner.
Set TEMP/TMP/MDLXL_TEMP/npm cache to this D: task directory. Playwright is
`D:\Claude\tools\node_modules\playwright-core`; game is `D:\Warcraft III`.
Never take over the user's desktop. Remove disposable packages/profiles and
unused task processes after checks. Preserve this unfinished source until the
owner accepts it; no PR/worktree cleanup gate has been reached yet.
