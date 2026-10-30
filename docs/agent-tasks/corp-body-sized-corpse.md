# CORP: body-sized corpse on the POSE body parts

Status: local candidate; owner per-model capture approval pending. No PR opened.
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
and the existing editing controls. Owner judges the 20 listed models pass/fail
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
`app/AutoCorpse.jsx` resolves the draft's gutz texture through the existing game-data
loader, so models without an original gutz reference no longer show grey
placeholders. No control/layout changes. No edits to `auto-corpse.js`, installed
apps, real profiles, model originals, versions or imported libraries.

The exact fitting contract and measurement limitations are in
[AUTO-CORPSE.md](../AUTO-CORPSE.md). Metrics measure XY triangle unions, not texture
alpha pixels. Matching the median is not per-species artistic acceptance. Dragonspawn remains
a weak corpus fit (43% coverage versus native 69%); Murlocs are about 50%
versus 62%. These are exposed in the table, not counted as visual passes.

## Evidence

Artifacts: `D:\Codex\mdlxl-corp-body-20261030\reports`.
- `baseline.json` and `after.json`: per-unit data for all 206 SD gutz corpses.
- `owners-before.json` / `owners-after.json`: all 20 requested owner models.
- `source-before.log`: three new regressions fail on handover code; 22 pass,
  3 fail, zero skips. `source-final.log`: 25 pass, zero failures/skips.
- Separate regression caught a held Ogre club enlarging its hand before the
  corrected hand-component selection; see `source-held-before.log`.
- `corpus-preservation.json`: supplied corpus checks for body reuse, posed/sunk
  body, living animation, saved size and Undo; 362 pass, zero failures. The 36
  unsupported inputs are enumerated, not counted as successes.
- `packaged-size.log`: hidden real-app Create/Save As, size, camera and keyboard
  check. Baseline failed: saved Footman corpse area 1795.4 versus native 3067.9.
- `texture-before.log`: the new preview texture assertion fails on the old app
  on Krell; the final app resolves and renders the native texture.
- `review.html`: 20 numbered model entries; 19 corpse/body pairs and the existing
  Khorne Flail Knight error. `review-page-1.png` through `review-page-5.png`
  provide contact sheets. `blizzard-206-table.html` lists every unit.
- Median area/body: Blizzard 82.6%, old CORP 40.2%, candidate 82.6%.
  Median coverage inside the outline: Blizzard 64.8%, old 36.9%, candidate 68.0%.

## Remaining work

1. Obtain owner pass/fail per model from the delivered table/captures; correct
   only identified mismatches. The Khorne Flail Knight Hero has a pre-existing
   global-effect visibility refusal, shown in the gallery. Do not alter its globals.
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
