# Unresolved OptimizeXL rotation-key cleanup study

Status: completed. Codex study + Claude study; owner-approved small-turn rule merged via the `claude/optixl-small-turns` PR on 15 Nov 2026.
Owner: Codex parent; approved execution GPT-6.1 Sol / low.
Updated: 2026-11-15 (Claude rule).

## Outcome

The accepted Lahmian five-key edit cannot be generalized into automatic deletion merely because the checker calls small rotations unused. Counterexamples erased entire small turns; the same small quaternion deviation produced a 10-unit displacement with a longer lever and about 1,504 times the velocity change when its rise was compressed. Existing automatic rules and tolerances remain unchanged.

Local branch: codex/optixl-unused-study-20261114, production baseline 19481b447bf06b3990adfc021dd8e2d77eec0b04. Worktree: D:/Codex/optixl-unused-study-20261114/repo. No push or PR. Only research harnesses and documentation are changed.

## Evidence

- 1,069 unique inputs / 1,091 original paths: all rehashed unchanged. 605 checker-success inputs; 464 checker exceptions (398 v1800, 66 v800), explicitly unverified.
- Fixed selection + ranked additions + accepted pair: 34 cases. Five experiments removed 36 keys in their first pass; 28 protected/no-eligible cases and one checker-unsupported HD case. Two of the five experiments are the accepted Lahmian variants.
- 130,978 all-animation mesh frames and 523,678 native channel frame positions; endpoints and unrelated fields preserved in the five first-pass experiments. Camera/global/effect coverage is limited and documented.
- 23 corrected derived cases pass. 581 exact no-ops and five existing repair-order combinations pass. Sargeras rescan exposes one extra deletion, with two further candidates handed back to existing owners.
- Existing focused protection suite: 90 unique passes including private Fx opt-in, no unresolved skips/failures. Immutable flail baselines: 56/56, with the exact hash-verified historical reference reconstructed from accepted source, never a recaptured golden.
- Production/golden diff against the baseline is empty. No Warcraft runtime, packaged/UI or other-model owner visual acceptance claim.

Full report: D:/Codex/optixl-unused-study-20261114/report/REPORT.md. Local machine-readable results are in [study results](optimizexl-unresolved-rotation-study-results.json); full per-model evidence and earlier superseded harness logs remain under the external report directory.

## Future implementation boundary

Only an evidenced new domain of unresolved findings may gain a repair. Preserve existing owners, guards, accepted outputs and clean no-ops. Do not use names, fixture indices, frame constants or accepted reference curves in runtime code. Local similarity and a generic world-space tolerance alone are insufficient; meaningful small motion, timing, hierarchy, hidden geometry, effects, independent globals, camera-facing transforms and rescan accumulation remain relevant. This study established no automatic deletion rule meeting the owner's no-regression requirement. The direct Lahmian repair remains the owner-approved example, not blanket authorization to discard authored turns.

## Claude follow-up study and rule (15 Nov 2026)

Claude's protected-turn study (`test/manual/optimizexl-protected-turn-study.mjs`, all 1,069 inputs, world displacement per deletion against part size) showed linear-track turns stay at most 0.44% of the part; every case above 0.5% was cubic. The owner approved a narrow rule ("Yes, build it"): the existing redundant-key owner removes a small turn on a local linear node track when the mesh it moves stays within 0.25% of the part. Code: `src/optimizexl-small-turns.js` used by `src/optimizexl-redundant-tracks.js`; tests: `test/optimizexl-small-turns.test.js`; boundary: [teaching table](../OPTIMIZEXL_TEACHING.md) "Small turns among similar keys"; numbers: [verification log](../OPTIMIZEXL_VERIFICATION.md#small-linear-turns-removed-by-the-redundant-key-owner-15-november-2026). Branch `claude/optixl-small-turns`, saved locally, not pushed or merged. Next: owner test build (Lahmian), then merge on the owner's word.
