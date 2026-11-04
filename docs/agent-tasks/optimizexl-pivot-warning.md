# OptimizeXL unused pivot warning

Status: completed — merged in [PR #554](https://github.com/UnsctMagic/MDLxL/pull/554)
Owner: Codex
Updated: 2026-11-04

## Goal and scope

Repair the screenshot's `Expected 148 pivot points, got 149` through the existing
Insanity FIxer preview, individual/selected approval and Fix everything flow.
Keep authored nodes, referenced pivots, geometry and animation unchanged.
No installed-app/profile changes, version bump or model replacement.

## Revision and fixture

- Branch: `codex/optixl-pivot-warning`; base `d6737cb589aa696b5ddf8521192f619afd81aaa1`.
- Merge revision: `cab472bf7b06be3c1185edd69e6d988148884243`, verified on online `main`.
- CI passed on `b3adc7d60916a509ef0bc2fd397b7a20d3c419a4` ([run](https://github.com/UnsctMagic/MDLxL/actions/runs/41902193228)).
- The owner explicitly authorized merging without independent Claude QA.
- Working checkout: `D:/Codex/optixl-pivot-warning/work` (removed after push).
- Retained report: `D:/Codex/optixl-pivot-warning/report`.
- Screenshot is an unsaved model. The saved Desktop input has 143 nodes and 143
  pivots, not the screenshot's 148/149. Its unchanged permanent test copy is
  `D:/Claude/MDLxL-TestModels/optimizexl-pivots/WH_WOC_KnightKhroneBStandard01_FIXED.mdx`.
  Tests add an unused trailing pivot to a disposable copy. Private bytes are not
  committed. `test/helpers/fixtures.cjs` owns fixture lookup.

## Owners and findings

- `src/optimizexl-checker-repairs.js`: new `unusedPivots` rule, classic 800 and
  unique dense node IDs only; removes the unused tail, redetecting at apply time.
- `src/optimizexl-diagnostics.js`: route the actual Hive count warning to Preview fix.
- `app/OptimizeXL.jsx` / `enter`: Back previously treated `fixAll` as a single
  finding, passed undefined sequence/frame to the preview, and raised two Interval
  errors. Restore combined preview mode without inspecting a nonexistent finding.
- Existing remapping/removal rules keep ownership. Selected batches and both
  individual approval orders with empty-event removal agree; stale occupied
  pivot slots survive. No serializer or imported-library edit.

## Verification

- Old source: five pivot tests failed, including the real model missing its repair.
- Old package: `the pivot warning offers Preview fix` failed (`0 !== 1`).
- With the pivot rule alone, the packaged workflow reached save and Undo but
  caught the existing Back-from-Fix-everything Interval errors. The final test
  also asserts combined mode and camera preservation when returning with Back.
- Source: 209 pass, 0 fail, 2 existing private-input skips (skin-collapse pair;
  opt-in Fx world-budget input). Compatibility: 57 pass, 0 fail, 0 skip.
- Frozen flail: 56 accepted comparisons pass, original golden files unchanged.
  Its new pivot cleanup is separately checked for unchanged non-PIVT bytes.
  Historical Mounted reference was recreated from `2bfe7f64^`, preset index 4,
  and verified against `084d34e0deda0e6d2d7c1722698806b4c937db3a45c34f18d94aa1cd3bd8174a`.
- Standard Bearer: single and selected repair save exactly 12 bytes; every other
  MDX chunk is byte-identical. App-owned sampling covers all 13 animations and
  2 globals, 1,504 poses at 100 ms plus endpoints: zero vertex displacement,
  zero endpoint displacement, no changed visibility channels.
- Hidden packaged: 3 pass / 0 fail / 0 skip (`optimizexl-pivots`,
  `optimizexl-inspection`, `optimizexl-selection`). Workflow exercises real
  clicks, linked mouse rotation, individual approval, Back, Fix everything,
  backup, Save and Ctrl+Z. No UI test-hook mutations.
- Independent Claude QA was waived by the owner for this merge. The full
  release suite and Warcraft III gameplay remain untested. This is not a release gate or user visual acceptance.

## Completion

PR #554 merged after successful CI with independent Claude QA explicitly waived.
The merged PR and unchanged implementation files were verified on online main.
The active README row is removed in this documentation closeout.
This merge does not publish a release or update the installed app.
