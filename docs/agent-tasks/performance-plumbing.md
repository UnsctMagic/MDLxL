# Editor responsiveness and recovery plumbing

Status: Completed implementation; PR #556 merged on owner instruction at 12dfe6bc4926e87bfde7ebeb9efa7e6b7137b725. Independent QA remains a release follow-up.
PR: https://github.com/UnsctMagic/MDLxL/pull/556
Owner: Codex; Claude owns independent QA
Updated: 2026-11-04

## Scope and revision

Fix the owner's whole-app/menu/panel lag for the next release. PR #556 was merged after the owner explicitly instructed it, with the pending independent QA disclosed. No installed-app/profile change, version bump or release was performed.

- Branch: codex/performance-plumbing; base cab472bf7b06be3c1185edd69e6d988148884243.
- Task/report root: D:\Codex\mdlxl-performance-fix. Finished worktree, task clone, disposable packages, profiles and heap dumps were removed. Reports remain; continue from main.
- Initial read-only audit: D:\Codex\mdlxl-lag-audit-20261104\REPORT.txt and audit-evidence.json.
- Permanent real fixtures: D:\Claude\MDLxL-TestModels\performance-20261104 (Knight and Impaler recovery histories), plus helpers/fixtures.cjs citadel-footman. Never delete this collection. Private models are not committed.

## Changes and owners

1. App.jsx/recovery-checkpoint.js: deduplicate unchanged checkpoints; share pending work across tab changes, autosave and close; encode in short tasks and restart if a concurrent edit changes the snapshot. Include selection-only history and paint-only changes. Reuse PaintWorkspace's interaction lifecycle to wait for complete strokes; close flushes the final drafts.
2. editor-document.js/history-store.js: borrow immutable history entries without deep-cloning the retained history. Capture mutable model deltas separately and track history changes even when document revision does not change.
3. recovery-wire.js/recovery-encoder.cjs/recovery-worker.cjs/recovery.cjs: compact binary transport across Electron's context bridge; V8 disk serialization/compression in a worker. Existing recovery disk schema, typed-array/Buffer types, aliases, sparse nodes and complete undo are preserved. The worker exits when idle and is drained at shutdown.
4. App.jsx texture lookup: share simultaneous requests and preserve identical asset/Map objects. Revalidate files on re-entry, including changed and removed loose overrides.
5. editor-camera-controls.js: remember the original listener root. React can detach the canvas before disposal; removing keyboard listeners from its new root leaked the controls and preview. Remove pending Control keyup too; imported Three.js remains untouched.
6. App.jsx/ShowcaseWorkspace.jsx: keep current renderer handles in refs. Old handles in render state chained through callbacks to every previous preview. Showcase readiness/history use a generation, preserving recording and view restoration.

## Reproductions and evidence

All UI runs used real keyboard/mouse input on the hidden Windows desktop, with disposable profiles. Read-only heap/DOM/model probes only. Small results/logs live under reports in the task root.

| Regression | Before | Final package |
| --- | --- | --- |
| Original tab/recovery test | 3 pass / 6 fail; max task 410 ms | 16 pass / 0 fail; max task 105 ms |
| 60 tab changes | backing storage 100→463 MB, +140 nodes per 20 switches | 38.184 MB in all three batches; 1,570 nodes and 557 listeners flat |
| Showcase quality changes | +5 MB JS heap and +24 nodes per batch; plateau assertion fails | 23.6→23.8 MB JS heap; 9.509 MB backing storage, 1,163 nodes and 375 listeners flat |
| Paint-only autosave | “Completed paint-only edits did not reach recovery” | complete pixels/history saved; held stroke waits for release; Undo paint saved exactly |

- Fail-first reports: baseline-ui-final, retention-fail-first, showcase-fail-first, paint-before.log.
- Final harnesses: performance-plumbing.electron.cjs (verified-ui), recovery-paint.electron.cjs (paint-verified), showcase-retention.electron.cjs (showcase-verified). All pass, zero skips/errors. Includes menu input during undo/autosave, full model/history recovery, immediate Alt+F4/themed Close, normal mouse rotation, loose texture invalidation, Showcase quality Undo, and an actual saved 174,524-byte GIF.
- Verification ran before the unrelated OptimizeXL pivot change landed. Rebase onto cab472bf resolved only the task-index row; all tested performance runtime/test files are byte-identical to verified commit 34485387. PR CI passed on 0ab0b5b10fbe20d3280b400ea701577dd68887ca: https://github.com/UnsctMagic/MDLxL/actions/runs/41909236177. The merged PR and recovery implementation were verified on online main.
- Final renderer asset hash: 2d882bc019ea6a9ce5f6531eae64e4704ada313087711141755f8b2389b48e18. Each final result records the bundle hashes.
- Heap traces identified document listeners and then the callback/previous-capture-handle chain. Conditional WeakMap edges were excluded when tracing the second root. Dumps are deleted; small retainer reports remain.
- CPU-slowed close check (12x) passed; shutdown timeout behavior was not changed.
- Compatibility: 57 pass / 0 fail / 0 skip. Full source on final code: 2,815 pass / 0 fail / 10 existing environment/opt-in skips (source-verified.log). No baseline was widened.

The ten source skips are existing gates: Unix-only SIGTERM behavior; optional archer overlay input; optional broken/rebuilt skin-collapse pair; optional private Fx input; two optional pose-corpus manifest checks; optional dense rider; optional accepted Tinker/Magnataur input; Windows account without symlink privilege; volume without 8.3 short names. They are not reported as passes.

## Review and release gate

Claude's independent QA has not run; no Claude Code CLI is available in the inspected locations. The full packaged release suite and Warcraft III gameplay were not run. These focused checks are developer verification, not release acceptance. The owner explicitly instructed the merge after this gap was disclosed; that instruction completed the merge on 2026-11-04. Independent QA must rerun these harnesses and the appropriate release gate before release.

Review focus: cooperative snapshot consistency/cancellation, history-only revisions, mutable paint transaction boundary, worker shutdown/legacy disk compatibility, and ref/generation ownership during Showcase recording/history restoration.
