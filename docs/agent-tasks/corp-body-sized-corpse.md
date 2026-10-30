# CORP: body-sized corpse on the POSE body parts

Status: anatomy correction ready for owner visual review; no PR opened.
Owner: Codex, chat `01a18c85-4bcf-74f2-9520-9aff51b2a0c9`
Updated: 2026-10-30
Branch: `claude/corp-long-bones`; worktree:
`D:\Codex\mdlxl-corp-body-20261030\repo`.
Continued handover `48bf08d5`; local checkpoints `f9173fc3`, `6876f06c`.
The original Claude checkout is untouched. Eventual PR targets
`claude/release-0.36.1`, not main. Do not merge or release.

## Owner decisions and acceptance gate

Use the last Death pose and POSE anatomy. The owner chose Blizzard overall size
with small native overhangs rather than strict outline containment. Normal arms
need an upper-arm bone plus a forearm/hand piece; that layout was accepted on
Empire Captain at `6876f06c`. The owner then rejected robe-based fits on
Necromancer and Lahmian and requested proof on other robed models.

Every corpse must match its owner's anatomy. Ordinary humanoids have two arms
and two legs. Clothing, equipment and helper controls cannot become extra limbs.
Keep rider/mount bodies separate and preserve centaur, turtle, ogre and other
creature anatomy. Missing humanoid leg chains are not permission to omit legs.
Preserve the original body geosets, sinking during Decay Flesh, static/fading
Decay Bone, native skull shape, flail exclusion and existing editing controls.

Owner pass/fail per model is required before any PR. The original 20-model
review remains pending acceptance of this anatomy correction. Release 0.37.0
waits for that gate. Claude owns independent QA under
[TESTING-RULES.md](../TESTING-RULES.md); automated checks are not owner acceptance.

## Current implementation

The current continuation changes `src/corpse-geometry.js`, its source tests and
these notes. Prior checkpoints include body-sized fitting, two-piece arms, tail
skin ownership and the draft gutz texture loader in `app/AutoCorpse.jsx`.
No changes to `src/auto-corpse.js`, POSE, original models, installed app/profile,
versions, imported libraries or UI controls.

- Garment ancestry excludes entire blended cloth vertices from fitting. Robes,
  skirts, capes and cloth do not supply body area; backpacks are equipment.
- Existing sided hip/knee/foot controls locate omitted static leg chains,
  including Necromancer's independently animated feet. No hierarchy changes.
- Torso fitting stays near the chest/pelvis. Shoulder/hip span bounds human rib
  width, including costumes bound directly to an anonymous chest control.
- Acolyte's narrow structural case (one head, two arms, no mapped legs, two
  detached static sided foot references) uses those authored references carried
  with the dead body. Its knees are inferred midpoints, not authored joints.
- Quadruped trunks reach their own rear hips. A centaur keeps separate upright
  and horizontal trunk regions. Tails start at the tail; a waist-to-tail-root
  connection cannot become a bone through the trunk.

The 0.826 Blizzard median remains a size reference, applied to eligible anatomy
rather than a requirement to fill a dress with flesh. Measurements still use
XY triangle unions, including transparent atlas padding, not alpha pixels.
See [AUTO-CORPSE.md](../AUTO-CORPSE.md) for the contract and limits.
Captain's accepted arm layout remains; its fitted dimensions changed with the
broader cloth filtering. Do not claim exact geometry equality with `6876f06c`.

Final source SHA-256:
`D589391DE4700F409EFAFD88472CEE2BD9049DCF5E86E9EFB2EB29552CBD13D1`.

## Current evidence

Artifacts: `D:\Codex\mdlxl-corp-body-20261030\reports`.

- `anatomy-review.html`: 14 complete real-app comparison pairs, Size/Height 100%.
  Necromancer, Lahmian, Captain; Acolyte, Priest, Sorceress, Medivh, Jaina, Guldan,
  Dark Elf Witch; Knight, Centaur Khan, Dragon Sea Turtle and Ogre.
- Four contact sheets: `anatomy-robes-1.png`, `anatomy-robes-2.png`,
  `anatomy-owner-check.png`, `anatomy-creatures.png`.
- Eleven pairs were captured on preceding source `89A99356...`; their planned
  geometry is exactly unchanged on final source. Three changed creature pairs
  were recaptured. `after-quadruped-comparison.json` records that comparison;
  `anatomy-review/results.json` records each capture's provenance.
- `anatomy-review-measurements.json`: per-piece anatomy. Ten humanoids have
  two upper arms, two forearm/hands, four leg pieces and one skull/torso. Knight
  has separate rider/horse with 12 leg pieces; centaur eight leg pieces and two
  trunks; turtle eight leg pieces and its tail; Ogre retains its two heads.
- `blizzard-206-anatomy-table.html` and `after-owner-anatomy.json`: final per-unit
  comparison for all 206 native SD corpses, zero measurement errors.
  `owners-owner-anatomy.json`: final numerical results for the original 20.
- `source-quadruped-after.log`: 34 pass, zero fail/skip. New checks failed first
  on preceding behavior: `source-robes-before.log`, `source-cloth-blend-before.log`,
  `source-acolyte-before.log`, `source-quadruped-before.log`. Earlier checkpoint
  red proofs are `source-before.log`, `source-held-before.log`,
  `source-tail-before.log`, `source-arms-before.log`, `texture-before.log`.
- `corpus-owner-anatomy.log` / `corpus-preservation.json`: 362 pass, zero fail;
  same 36 explicit refusals among 398 inputs (collapsed Death 12, no Death 14,
  read-only format 1, globally moving body root 1, invisible Death body 8).
- `final-controls.log` and `final-controls-check/results.json`: final packaged
  Footman Create/Save As, saved footprint, actual mouse camera rotation, drag,
  Escape cancel, Delete, Ctrl+Z and Escape close passed. Native/generated mesh
  areas 3067.9 / 4272.1. This is behavior evidence, not artistic acceptance.
- `quadruped-refresh`: final creature pairs and separate Skink tail check passed.
- Initial capture batches had unexpected app closures. Preserve the failed
  logs; interrupted pairs passed unchanged-build retries. Cause remains unknown.
- Warcraft III itself and independent Claude QA were not exercised.

Lahmian still lacks its custom `Maid.blp` in the body preview; gutz is resolved.
Krell's exact native texture was found in the existing SD-Brain-Kitbash pack.
Gluma fixtures were staged with existing website textures; `fixture-hashes.json`
records byte-identical models. Originals remain unchanged. The Khorne Flail
Knight Hero has a pre-existing global-effect visibility refusal; do not alter
its globals to force a capture.

`review.html`, `blizzard-206-table.html`, `after.json`, earlier robe galleries
and the complete `screenshots-6876f06c` set are historical, not the current
anatomy candidate. `reports/reproduction/anatomy-review.py` generates the current
14-pair gallery and 206-unit table.

## Next steps and reproduction

1. Obtain owner pass/fail on the anatomy proof. Correct only observed failures.
2. Complete the original 20-model review on the accepted candidate, including
   the explicit texture/refusal limits, before any PR.
3. After owner acceptance, push this named feature branch and open a PR into
   `claude/release-0.36.1`. Do not merge. Include the Codex session in the PR.

Use linked dependencies. Never run pnpm run/test/install. Build with
`npx vite build`; package with `node scripts/package.mjs --out out/pkg --overwrite`;
source checks use `node --test test/auto-corpse.test.js` with the documented
fixtures. Packaged checks use `node scripts/run-packaged-tests.mjs default corpse-size`.
Set TEMP/TMP/MDLXL_TEMP/npm cache under this D: task directory. Playwright is
`D:\Claude\tools\node_modules\playwright-core`; game is `D:\Warcraft III`.
Never take over the user's desktop. Disposable build, staged test fixtures,
profiles, runtime and caches are removed after checks. Keep the unfinished
source and review evidence; no push/worktree-removal gate has been reached.
