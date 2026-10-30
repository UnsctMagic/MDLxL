# AI motion measurement and size optimisation

Status: active
Owner / consolidator: Codex, AI motion measure
Updated: 2026-10-30

## Goal and completion criteria

- Deliver research §6 items 1–8 additively for 0.36.0, one commit per item, PR only; do not merge or change release versions/notes files.
- App-owned measurements and distributions, no acceptance gates or user-facing limits. No model-specific rules. Animation and OptimizeXL owners and immutable baselines stay unchanged.

## Revision and local state

- Branch / checkout: `codex/ai-motion-measure`, `D:\Codex\mdlxl-ai-motion`.
- Base: `origin/main` `a544fe9c4fd9bf54f6a2889d1b7c427cd5a0ab22`.
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
- Study definition verified before inventory implementation: `D:\Codex\mdlxl-sd-rulebook-20261024\work\model-metrics.mjs:19,23` computes median active-track keys per clip, then distributes those medians over native unit-family clips of each kind. It includes all track properties, excludes `Nodes` aliases, and selects tracks whose `GlobalSeqId` is null/absent (explicit `-1` is excluded by that reproduction script). These are not individual-track percentiles or maximum key counts.
- Checks: untouched base build and compatibility pass. Full source: 2,421 pass, 23 skip, 6 fail (five missing FFmpeg assets and the existing temp-path test under explicit MDLXL_TEMP). Item 1 AI suite: 284 pass, 1 skip, no failures.
- Remaining: items 2–8, full verification, private replay, hidden packaged checks and PR.

## Blockers and next action

- None. Continue numbered commits; publish branch and PR, then clean task-created builds/profiles, processes and worktree.
