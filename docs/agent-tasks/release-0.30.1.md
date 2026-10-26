# MDLxL 0.30.1 release acceptance

Status: completed
Owner: Codex release session
Updated: 2026-10-24

## Result

- Published [MDLxL 0.30.1](https://github.com/UnsctMagic/MDLxL/releases/tag/v0.30.1) from tag v0.30.1, commit af1d0f1273f9591ef783dc60252ff4c6d5a03547. PRs #281 through #286 are included since the prior published 0.29.2 release.
- Paint Shift-click clipboard import was merged in #284. Full acceptance found and corrected Forge cut picking on hover-preview seams and POSE setup picking of Helper joints in #286. Existing controls, authored models, selected-face boundaries, undo/redo and normal camera rotation were preserved.
- The earlier 0.30.0 candidate was never published; 0.30.1 contains its complete change set and the acceptance fixes.
- English, Spanish, Russian and Simplified Chinese notes are live on the MDLxL website; all four actual pages and current download links passed headless verification. [Mega Garithos Bot announcement workflow](https://github.com/UnsctMagic/MDLxL/actions/runs/40054053138) succeeded.

## Verification

- Complete source suite: 1,859 passed, 13 skipped, zero failures. Compatibility: 57 passed. PR CI 40047571976, tagged-commit CI 40047914604 and official draft build 40047933866 passed.
- Complete runnable app suite on the official ZIP: 133 passed, 22 configured private/manual/fixture skips, zero failures. This includes native Forge cuts, POSE IK/ragdoll/SD controls, model IO, event/effect workflows, actual camera mouse input, 99 particle-lifecycle samples, 34 review recipes, Showcase recording, UV Grabthrough/N behavior and updater tests.
- The native clipboard test separately passed ordinary file import and Shift-click opening a copied 2x2 image in Paint's crop tool.
- Portable gate: official 0.30.1 -> private 0.30.2 -> private 0.30.3 -> offline revert to private 0.30.2. Program/snapshot hashes, one-version retention, consumed revert snapshot, 43 blocked relaunches and all 10 personal-file fixtures passed. Loopback transport supplied the private test versions; production updater handling and installation were unchanged.
- All 652 official manifest-file hashes and all 275 matching test renderer files passed before and after app testing. The public ZIP was downloaded and hashed after publication: 199151548 bytes, SHA256 46c137114e7680a1054f6831605687555392e4a577611d869098928b6043e63e.
- The pinned FFmpeg corresponding-source archive is attached with verified SHA256 01b14874f33eb3c4f94afe05abb028dc6da29eb12ba419ccb147462fe701091b. No user installation or real profile was upgraded; Warcraft III gameplay was not exercised.

## Harness corrections and cleanup

Integration selectors, frame observation, hidden evidence capture, teardown and manifest-only synthetic updater fixtures were refreshed without removing behavior/data assertions. The relaunch stress probe now observes the installation lock throughout startup, so a launch spanning installation completion is distinguished from a blocked launch; every wholly locked attempt must exit and any observed window while locked still fails.

A temporary shared-dependency interruption was resolved by linking an existing dependency checkout with every pinned version verified; all affected cases were rerun. A transient Windows texture-cache lock paused task-only output cleanup; cleanup completed and the remaining suite resumed. A disposable updater fixture ran out of disk space and rolled back; redundant task copies were removed before the final passing gate. These caused no shipped-code changes.

Disposable builds, profiles, update installations and archives were removed after use. Small acceptance logs and reports remain under the release task on D:. The release chat remains available; shipped idle unpinned Codex sessions are archived according to AUTO_UPDATES.md, and Claude-owned sessions are left to Claude.
