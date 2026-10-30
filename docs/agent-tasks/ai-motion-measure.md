# AI motion measurement and size optimisation

Status: ready for review; awaiting merge approval
Owner / consolidator: Codex, AI motion measure
Updated: 2026-10-30

## Goal and completion criteria

- Deliver research §6 items 1–8 additively for 0.36.0, one commit per item, PR only; do not merge or change release versions/notes files.
- App-owned measurements and distributions, no acceptance gates or user-facing limits. No model-specific rules. Animation and OptimizeXL owners and immutable baselines stay unchanged.

## Revision and local state

- Branch / checkout: `codex/ai-motion-measure`, `D:\Codex\mdlxl-ai-motion`.
- Base: `origin/main` `a544fe9c4fd9bf54f6a2889d1b7c427cd5a0ab22`.
- Final integration base: `1b4d9c6f448850f5d773f9dfbb71dee77571fec4`; incoming changes are documentation and the native-context test's steering-delivery wait (PRs #434/#435), without product-code overlap.
- PR: [#436](https://github.com/UnsctMagic/MDLxL/pull/436), open and unmerged; eight numbered commits. Final rebased AI and full-source suites both passed; live CI status is on the PR.
- Dependencies: junction to `D:\Claude\MDLxL\node_modules`; temporary files in `D:\Codex\mdlxl-ai-motion-temp`.
- Private replay input: models in the research folder below; read as data only, never executed or committed.

## Relevant owners

- `src/animation.js`: `sampleTrack`, `sampleNodeMatrices`, `skinGeoset`, `sampleGeosetAnimation`; `src/global-sequence-preview.js`: isolated global playback.
- `app/ai-review.js`, `src/ai-tools.js`, `electron/ai-service.cjs`, `src/ai-capabilities.js`.
- `src/editor-document.js`, `src/optimizexl.js`: serialization and optimization owners, unchanged.

## Findings and decisions

- Evidence: `D:\Claude\research\fx-optimization-2026-10-30\REPORT.md`, read fully before implementation, especially §5–7. Research scripts/raw outputs under `D:\Claude\research\fx-analysis-work` are read-only references.
- Accepted optimisation achieved −18.1%; self-written evaluators missed sequence-local visibility and one attempted correction measured against a rejected candidate. Error size alone did not explain acceptance.
- Preserve explicit review frames and default baselines; add computed motion, optional saved-version baselines and difference-selected pictures.
- Contact travel is structural: horizontal movement averaged over vertices lowest in consecutive samples, independent of names. It is not a named-foot metric or an acceptance decision.

## Changes and verification

- Item 1: read-only comparison module and review/outside-check integration; generated regressions cover local visibility, colour, geometry, cubic rotation, topology and phase/global matching.
- Item 2: optional accepted-version baseline for checks, pictures and motion; detached version references and exact research prompt rule. Follow-up regression starts from a rejected candidate and verifies the accepted reference remains intact.
- Item 3: implicit pictures add measured worst distance/speed and other touched animations within 16/12 picture budgets. Explicit frames retain their path and labels; outside selection keeps whole evidence groups.
- Item 4: size-optimisation handbook and size-word route; existing binding, animation, geometry, UV, effects and game routing examples remain covered. The help glob already loads top-level documentation.
- Item 5: exact two-sentence rules for conflicting size/preservation goals and close-result rejections. Prompt fingerprints updated deliberately; stripping just the documented additions still reproduces the historic hashes.
- Item 6: track inventory uses the verified per-clip median definition. Native quantiles yield percentile brackets, not invented exact ranks; explicit `-1` tracks are inventoried but counted separately from the reproduction's null/absent-only native statistic. Encoded bytes and constant curves distinguish cubic vector controls from quaternion controls.
- Item 7: sandbox already exposes `editor-document` and `optimizexl`. Added a tested help recipe instead of the conditional adapter: serialize a detached working snapshot, call `runOptimizeStage` unchanged, return candidate/report, and use the existing script commit for one Undo step. Source test compares its bytes with the direct stage; packaged ai-editor also executes the recipe.
- Item 8: generated committed-model fixture, pure all-channel motion graders, scenarios `animation-size`/`pre-existing-motion`, repeat rates and private-path replay. Fixture/grader suite: 13 passed. Baking test samples all 13 clips every 100 ms plus endpoints; no channel differences, geometry only Float32 noise, endpoints exact. Both scenarios ran three inert-provider repeats on the hidden desktop (six observations): size ratio 1, exact endpoint share 1, no edits or channel changes; pre-existing-report and unasked-edit rates 0. Normal mouse rotation was observed. These verify plumbing, not live AI quality.
- Replay-driven corrections: match channel identities through node/resource renumbering; avoid equal-duration phase roundoff and per-vertex scratch allocations. Global controller changes are measured in every local clip they affect, plus the isolated global clock. These remain read-only measurements.
- Study definition verified before inventory implementation: `D:\Codex\mdlxl-sd-rulebook-20261024\work\model-metrics.mjs:19,23` computes median active-track keys per clip, then distributes those medians over native unit-family clips of each kind. It includes all track properties, excludes `Nodes` aliases, and selects tracks whose `GlobalSeqId` is null/absent (explicit `-1` is excluded by that reproduction script). These are not individual-track percentiles or maximum key counts.
- Checks: final Vite build and package pass. Compatibility: 57 passed. AI suite: 297 passed, 1 skipped. Full source: 2,460 passed, 14 skipped, zero failures; zero new failures against the untouched base. The first base run lacked FFmpeg and used a nondefault explicit temp path; pinned assets and the normal D: `out/tmp` path resolved those environment-only failures without changing tests or failure baselines.
- Immutable flail regression: 25 Flail03 and 31 Flail01 recorded results pass, using the existing approved exceptions. The historical sphere reference was reconstructed from trusted Git commit `c6dc15ce` and matched the unchanged SHA-256 `084d34e0deda0e6d2d7c1722698806b4c937db3a45c34f18d94aa1cd3bd8174a`; no golden file was changed. `test/optimizexl.test.js` passes untouched.
- Hidden packaged checks: ai-console, ai-editor (71 checks, including actual sandbox serialization/OptimizeXL), ai-routing, ai-questions and ai-parallel all passed again against the final rebuilt package.
- Remaining acceptance: live-provider scenario A/B rates and owner playback/Warcraft III testing. No live provider quality claim is made from the inert stand-in.

### Research replay result (§2.5 and §4.1)

All nine research comparison tables reproduce to their 0.001-unit rounding, including p95, speed differences and exact endpoints. Samples use 1 ms, or 10 ms above 5 seconds. Final whole-model runs took 13.9–17.4 seconds; routine reviews compute touched clips only and reuse each revision's result.

| Research case | Worst vertex distance | Final attack distance | Final attack speed difference (units/ms) |
| --- | ---: | ---: | ---: |
| Accepted result | 2.000 | 1.996 | 1.061 |
| Uniform world bound | 1.000 | 0.999 | 0.975 |
| Rejected evaluator-bug result | 12.412 | 3.821 | 0.509 |
| Sol full-report result | 0.000 | 0.000 | 0.000 |
| First rejected size pass | 0.465 | 0.465 | 0.268 |
| Exact-only retry | 0.000 | 0.000 | 0.000 |
| Rebuild | 5.361 | 2.317 | 0.632 |
| Axis correction | 40.038 | 40.038 | 1.084 |
| Existing OptimizeXL animation stage, strength 100 | 1.708 | 1.708 | 0.852 |

The full-report result's zero geometric distance does not imply preserved appearance: the replay asserts the emitter visibility difference over 1,267 samples at 23200–24466 and 249 samples at 191501–191749. Body geoset alpha differs over the entire 99800–159800 interval (6,001 samples at 10 ms). The accepted result's colour swap is also reported (maximum component difference 0.274510). These are evidence, never model acceptance gates.

## Blockers and next action

- None. PR #436 is attached to the chat and ready for review; owner playback, live-provider repeats and Warcraft III acceptance remain ready to test. Merge only after explicit authorization. English lines for four-language release-note preparation are in the PR body; release files were not edited.
- Disposable builds, profiles, extracted historical runtime, temporary data and task processes were removed. The small report remains at `D:\Codex\mdlxl-ai-motion-report.md`; source remains in Git. Disposable source worktrees are removed after pushing.
