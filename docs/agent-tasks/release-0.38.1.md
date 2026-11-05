# MDLxL 0.38.1 HOTFIX

Status: Withdrawn at the owner’s request. The public release and tag, site hotfix JSON and its Garithos announcement were removed. The old draft is retained privately; version 0.38.1 must not be reused. Replacement: 0.38.2. The historical acceptance record below does not authorize republication.

Historical status: Completed before withdrawal. Release PR [#559](https://github.com/UnsctMagic/MDLxL/pull/559) merged at `09b785cba7c14bc65af602669ca32d101b3538fa`; tag `v0.38.1` pointed to that exact commit and has since been removed (withdrawn).
Owner/session: Codex `01a1a88f-016d-7483-9ef0-d84ef91e6598`.

- Release (removed; only a private draft remains): https://github.com/UnsctMagic/MDLxL/releases/tag/v0.38.1
- Site post with appended hotfix (removed; the `?version=0.38.1` link must not be used): https://www.lowpolyworks.com/mdlxl/?version=0.38.1
- Package: `MDLxL-0.38.1-win32-x64.zip`, 221254925 bytes.
- SHA-256: `74ac98c4dc357bd05598a132b802064b393ae4f087ba798d073f9492d7cf5f10`.
- Draft workflow: https://github.com/UnsctMagic/MDLxL/actions/runs/41927295408 .

## Scope and owner exception

The owner requested a hotfix, adding to the existing site post and necessary tests only, then explicitly approved targeted Codex verification and publication instead of Claude-only/full-packaged-suite acceptance for this hotfix. The release task changed version metadata, the README summary, six new release-note files and release documentation. It did not change application implementations, test assertions or failure baselines.

Included feature PRs: #539 (French/German), #544 (icons/Select through), #546 (OptimizeXL playback), #549 (UV Zoom), #550 (UV dragging), #553 (UV Rotate), #554 (unused pivots), #556 (editor/recovery/Showcase responsiveness), #558 (optional game-cache wording), plus merged closeouts. Historical PDF guides keep their original bytes/names/languages; no new guide was needed.

## Verification

- Compatibility: 57 pass / 0 fail / 0 skip.
- Focused source: 189 pass / 0 fail / 1 existing skip, because this volume has no 8.3 short names.
- Release-material/updater follow-up after correcting the new notes' update path to Configuration: 20 pass / 0 fail / 0 skip.
- Required PR CI passed on the final release head.
- Fifteen affected packaged workflows passed / 0 failed / 0 skipped on official CI package 41922199608: performance-plumbing, recovery-paint, showcase-retention, uv-drag-smooth, uv-rotate-steady, uv-zoom-collapse, uv-grid-nudge, uv-wrapper-isolation, uv-wrapper-layout, optimizexl-finding-playback, optimizexl-pivots, optimizexl-inspection, optimizexl-selection, icons-select-through, localization.
- Portable acceptance passed: candidate 0.38.1 -> private A 0.38.2 -> private B 0.38.3, then offline revert to A. Both cycles used full streamed ZIPs and checksums/manifests, real Save/CANCEL?/Close controls, blocked relaunches, correct native restarts and complete installed/retained hashes. Ten seeded personal files stayed unchanged, equal-version checks gave no repeat offer, and mouse rotation plus Forge/Undo/Redo worked after both updates. Native Cancel was also tested before revert; revert consumed the retained snapshot. No public 0.38.2/0.38.3 tags/releases were created.
- Controller-only corrections fixed camera probe/readiness and native-dialog targeting without product changes or repeating accepted update cycles. Each native restart was verified before terminating/reopening that unchanged test installation to reconnect Playwright; no program/helper files or installation state were reset between cycles. Native confirmation used the enumerated Win32 Button on the hidden test desktop.
- Final shipping ZIP came from official CI run 41926160820. Compared with the accepted package, the executable and all runtime source/assets were identical except the six new notes' Configuration-path wording and generated renderer asset references. All 42 differing renderer chunks matched after normalizing only those expected changes; no native executable metadata differed. All 1,515 manifest file hashes passed, only manifest-listed files were present, and final packaged startup passed / 0 failed / 0 skipped.
- Public assets and checksum were verified against the final ZIP and companion digests. The FFmpeg source ZIP is 522360571 bytes, SHA-256 `01b14874f33eb3c4f94afe05abb028dc6da29eb12ba419ccb147462fe701091b`.
- No Warcraft III gameplay or full packaged suite was exercised under the owner's targeted-test exception.

## Site and announcement

New six-language JSON was added through site PRs #60/#61; #62/#63 corrected only the new post's update instructions. Corrected JSON blob: `e141eac6bc82343963768d3a329a98d23ee6449d`.

Site PRs [#64](https://github.com/UnsctMagic/LowPolyWorks/pull/64) and [#65](https://github.com/UnsctMagic/LowPolyWorks/pull/65) use the existing fold mechanism to retain the displayed 0.38.0 post and append 0.38.1 beneath it, while the main download selects 0.38.1. They changed only the one fold mapping and affected cache keys. Final source merge: `c62df57aaa17c59a1501bb99b740a58fbaa5b156`; Pages merge: `312460737174f76999aba07e90375e6b285eab81`. Concurrent Khorne Standard Bearer publication changes were preserved.

The public 0.38.0 JSON remains byte-identical, SHA-256 `c8b8892ac5918c4b24a61a6409d302033b677e82a97c5cd0ccaec8b9014e3897`. Rendered checks cover the original post plus appended hotfix in EN/ES/RU/ZH-CN/FR/DE, latest download, and desktop/mobile layouts. The GitHub release uses the compact linked title and six separate language links; the existing Garithos workflow provides the announcement, with no manual duplicate or old-post edit.

## Cleanup and evidence

The shipped sessions were already archived; the active-session inventory contained no shipped match. The current release chat was retained. Owner installations/profiles and the permanent `D:/Claude/MDLxL-TestModels` collection were preserved.

Disposable test builds, profiles, extractions and runtimes were removed after checks; finished task worktrees and unused task processes were cleaned up. Small evidence and the requested ZIP/checksum remain under `D:/Codex/mdlxl-hotfix-0.38.1`. The release completion report records public asset/site/announcement verification and this closeout PR.
