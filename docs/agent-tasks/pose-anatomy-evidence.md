# POSE anatomy from skeleton and skinned geometry

Status: completed; merged through [PR #609](https://github.com/UnsctMagic/MDLxL/pull/609)
Merge revision: `0783216dc53774954165938b82886f2fe415cac0` (verified on online `main`)
Owner / consolidator: Codex; Astra reasons and codes, explicitly configured low-reasoning workers execute checks
Updated: 2026-11-09

## Goal and completion criteria

Replace the automatic naming/exclusion cascade with combined skeleton and skinned surface analysis. Names only resolve ambiguous structural alternatives. No per-model identity, prescribed limb/head count, required symmetry or motion. Preserve current controls, native solver, authored data and normal mouse rotation.

Acceptance covers the supplied Lahmian, existing humanoids, four/six arms, multiple heads, wings/dragons, horses/riders, long arms and short legs. Original, anonymous, scrambled/misleading labels and changed node ordering must be judged against independent anatomical expectations. Actual hidden packaged clicks and drags supplement source probes; merge verification follows the current shared testing rules.

## Revision and local state

- Merged branch: `codex/pose-anatomy-evidence`; feature head `a9a1206187fdc56815cc2413f9dab6de0779a446`. The disposable checkout is removed after the completion note is merged; reports remain at `D:/Codex/pose-anatomy-20261109/report`.
- Base: 5310d5fba793c50d7c05a437962c13be5f82b648 (online main at start).
- Owner authorized merge on 2026-11-09; current main integrated at 411ad2807ddc775587adf1c11841a052f31a057c.
- Dependencies linked to existing D:/Claude/MDLxL/node_modules.
- Real inputs read through test/helpers/fixtures.cjs from permanent D:/Claude/MDLxL-TestModels.
- Current Lahmian copied unchanged into pose-anatomy/Lahmian_Vampire_Death_Fix5.mdx; SHA-256 c6d9afafca77f5add9058f2bf42cb6ea547bbc2074f060ab9baefa1a17532cee. This differs from the earlier audit because the saved source changed.

## Owners and decisions

- src/pose-geometry.js: weighted surface statistics and connectivity, no name interpretation.
- src/pose-anatomy.js (exported through pose-recognition.js): combined anatomical candidates and disjoint path selection; no legacy recognition fallback.
- src/pose-heads.js: terminal surface regions and native head/neck control candidates, compared against limb interpretations.
- src/pose-torso.js, pose-body-drivers.js and pose-limb-roots.js: body ownership, native whole-body motion evidence and proximal limb boundaries.
- src/pose-assemblies.js: independent rider/carrier relationships from spatial contact, elevation and relative native motion.
- src/pose-ik.js: adapt inferred native chains/roles to existing solver, separate native edit validity from anatomical identity; handle grips use resolved roles.
- New test/pose-anatomy* and helper/census: independent acceptance, fail-first baseline, no weakening existing expectations without measured justification.
- docs/POSE_IK.md and docs/POSE_IK_VERIFICATION.md describe final behavior and measured limits after implementation.

## Verification and completion

The local candidate passed the source, native integration and packaged acceptance below. Current main permits shared QA evidence without an agent-specific rerun. Installed upgrades and releases remain separately authorized operations. Reports are in `D:/Codex/pose-anatomy-20261109/report`; the original source revision is recorded above; the disposable baseline snapshot is removed after verification.

- The strict census now covers 160 cases: 23 real models and 9 fully skinned analytical rigs, each original, literally blank, scrambled, misleading, and remapped/reordered. It checks independent joint/role expectations, extra controls and missing anatomy. The old source passes 23 / fails 137 / skips 0. Suitable available PC models replace missing historical filenames as the owner requested. Real inputs include four arms, multiple heads, several riders, wings, tentacles, a rigid ship and projectile; generated inputs cover six arms and altered proportions.
- The old installed-code baseline fails both original and blank Lahmian at the screenshot's actual Attack 2, sequence 8, frame 21083. Original misses both feet and Waist; blank misses both arms and head. Both cases use actual UI sequence/frame controls and Movement/POSE clicks. Disposable copies were removed.
- The hidden Footman harness passes 1 / fails 0 / skips 0 with real POSE clicks, mouse drag, native rendered displacement, one Undo, exact Ctrl+Z restoration and Alt+mouse camera rotation. This validates the harness, not the candidate. The final candidate workflow passes all 64 original/blank model cases, with no failures or skips.
- Geometry checks pass 9 / fail 0 / skip 0. The local surface query integrates skin-weighted triangles clipped to an attachment-sized box; analytical area, centroid and inertia tests cover subdivision, distant cloth, scale, offset and point-only evidence. The two new query tests fail before the API exists.
- Four independent evidence probes found and corrected loss of an unskinned head when torso skin is present, a distant helper activating a name veto, loss of a limbless head, and coincident helpers erasing arm chains. Current tests pass 4 / fail 0 / skip 0. Two earliest probes were recorded before their regression files were written; do not describe those as automated fail-first test runs.
- Assembly checks pass 3 / fail 0 / skip 0; body-driver checks 3 / 0 / 0; limb-root checks 2 / 0 / 0. Complete-body checks have measured fail-first proof. The new front/hind trunk station test fails before its correction (Pelvis instead of Chest) and passes afterward across all five name/ID variants.
- Compatibility suite passes 57 / fails 0 / skips 0. The intermediate bat-rider head failure was corrected and covered by the frozen head-boundary and native suites below. All four complex real-model native controls, pins, undo and round-trip groups pass.
- Dense twin-head rider native controls, pins, save and undo pass 6 / 0 / 0 within the frozen native suite below.
- Frozen candidate `frozen3` passes the strict census 160 / 0 / 0, focused checks plus the corpus suite 135 / 0 / 0, and the affected native/integration suite 135 / 0 / 0. The frozen census records source hashes. Intermediate unsuccessful trials remain in separate reports and are not acceptance.
- Forty unequal-head and neck-proportion cases pass; their pre-fix run was 15 / 25 / 0. Six real head/body-boundary failures now have original/blank/scrambled/misleading/remapped checks in `test/pose-models/pose-head-boundaries.test.js` (30 cases): baseline 6 / 24 / 0, frozen candidate 30 / 0 / 0.
- The Skink consumer's original numeric bounds remain unchanged. Its reference now uses the fixture's actual rear hip joints 27 and 30: baseline endpoints project to [-0.06048, 1.19374], current endpoints to [0.24989, 1.08175]. Averaging all four newly recognized ground limbs shortened the reference and falsely produced 1.58291. Evidence: `report/skink-stable-comparison.json`.
- Auto Corpse passes 37 / 0 / 0 within the frozen native/integration suite. The dense 229-node native/pin/save/undo check was exercised with `MDLXL_POSE_PERFORMANCE_MODEL`, with no skips. Flat foot patches now contribute wing evidence in proportion to their extent versus the complete joint path; the static paired-leg regression passes. Build and packaging succeeded; hidden packaged mouse acceptance passes 64 / 0 / 0, including the exact Lahmian pose, extra arms, wings, native head manipulation and normal camera rotation. The package and profiles were removed afterward.
- Test execution uses explicitly low-reasoning workers with exact commands and a stopping point (Luna for source runs; reused Sol for final packaging, mouse workflows and merge preparation). Astra reviews failures and codes corrections; no worker runs an open-ended fix/test loop.

The portable/local-model test separation passed 173 / 0 / 0 at feature head `a9a12061`, preserving all prior assertions. Authored-model checks run with `pnpm run test:pose-models`; absent inputs fail. Existing frozen census/native/package evidence was reused because the integrated main changes affect UV rest-pose behavior rather than animated Movement.

PR #609 was merged as authorized. Its GitHub Actions run [42671236196](https://github.com/UnsctMagic/MDLxL/actions/runs/42671236196) failed with an internal server error before any job or test ran (correlation ID `368c8b2f-614a-4e2f-bdd5-3a10d82d79cc`). Effective main rules required a PR but no status checks; no rules were bypassed or changed. Online main contains the exact feature head and unchanged runtime files. This is a source merge only: no release, installed upgrade or Warcraft III gameplay claim.

The permanent model collection, shared dependencies/cache and installed profile remain unchanged. Disposable builds, profiles, temporary files and test processes were removed; small reports are retained.
