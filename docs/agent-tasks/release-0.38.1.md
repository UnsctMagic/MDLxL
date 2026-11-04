# MDLxL 0.38.1 hotfix release

Status: Owner-authorized release candidate; targeted verification and portable acceptance passed. Publication follows PR #559 merge and exact tag v0.38.1.
Owner/session: Codex 01a1a88f-016d-7483-9ef0-d84ef91e6598.
Base: b326c370ac10a4b5458f63f3cf887bbffa7e1f9a; release PR https://github.com/UnsctMagic/MDLxL/pull/559.

## Scope and authorization

The owner requested a hotfix, an additive website post and necessary tests only, then explicitly approved targeted Codex checks and publication instead of Claude-only/full-packaged-suite acceptance for this hotfix. No product code, test assertions or failure baselines were changed by the release task.

0.38.1 includes feature PRs #539 (French/German), #544 (icons/Select through), #546 (OptimizeXL playback), #549 (UV Zoom), #550 (UV drag performance), #553 (UV Rotate), #554 (unused pivots), #556 (editor/recovery/Showcase performance), #558 (optional game-cache wording), and their merged documentation/closeouts. Release changes are package.json, README version/summary, six new note files, the project-map link and this handover. Existing PDFs retain their original names and languages in the portable ZIP; no new PDF is required for the hotfix.

## Final package and checks

Feature/updater acceptance package: https://github.com/UnsctMagic/MDLxL/actions/runs/41922199608 (same runtime source as this release; subsequent changes are this unbundled handover only).
Acceptance ZIP: MDLxL-0.38.1-win32-x64.zip, 221254966 bytes.
SHA-256: efb07b0346028bbe5591b1719ff9db6ba0ffb786851156e8f955f46f60a67233.
The final shipping package is refreshed by official CI run 41926160820 after correcting only the update instructions from Appearance to Configuration in the six new note files. Runtime app/src/electron/scripts files are byte-identical to this acceptance basis; the changed raw notes alter renderer chunk names. Carry forward the feature and portable-update results, then verify the final ZIP manifest, startup and six-language post. Publish that final validated CI ZIP/checksum after the tag workflow creates the draft, replacing its newly rebuilt ZIP/checksum if needed. Its final hash is recorded in the release completion report. It contains only manifest-listed files; every file hash passed, with no profile, recordings or test logs. The local test package was discarded after its test-created textures/recording were detected during ZIP audit; it is not the shipping ZIP.

- Focused source: 189 pass / 0 fail / 1 existing skip (the volume has no 8.3 short names).
- Compatibility: 57 pass / 0 fail / 0 skip.
- Required PR CI passed; its configured source/compatibility checks remain enabled.
- Exact official CI ZIP: 15 packaged workflows passed / 0 failed / 0 skipped: performance-plumbing, recovery-paint, showcase-retention, uv-drag-smooth, uv-rotate-steady, uv-zoom-collapse, uv-grid-nudge, uv-wrapper-isolation, uv-wrapper-layout, optimizexl-finding-playback, optimizexl-pivots, optimizexl-inspection, optimizexl-selection, icons-select-through, localization. The same focused set also passed on the local build; it was repeated because embedded release documentation changed the CI bundle hashes.
- Full portable gate passed: 0.38.1 -> private A 0.38.2 -> private B 0.38.3; real streamed ZIPs, checksums/manifests, real Save/CANCEL?/Close prompts, blocked relaunches, native restarts, complete installed/retained hashes, ten seeded personal files preserved, no repeat offers, normal mouse rotation, Forge commit/Undo/Redo, and offline revert to A consuming the retained snapshot. Native Cancel was also exercised before revert. No public 0.38.2/0.38.3 tag or release exists from these fixtures.
- The controller's camera probe/readiness and native-dialog targeting were corrected without product changes. Accepted update cycles were retained. Each native restart was verified before terminating/reopening that unchanged disposable installation to reconnect Playwright; no program/helper files or installation state were reset between cycles. Native confirmation used its enumerated Win32 Button on the hidden desktop.
- FFmpeg source companion: 522360571 bytes; SHA-256 01b14874f33eb3c4f94afe05abb028dc6da29eb12ba419ccb147462fe701091b, matching the official 0.38.0 companion.

## Website and announcement

Source PR #60 merged at ce0ba449ae3784c0d7014af4362d316630b97350. Pages PR #61 merged at 3f8f162bb47b3f13e21bdd6465c5e33edf102136. Only the new 0.38.1 JSON post was added on each branch; its initial blob ID was a94111483722abbcfc89f0bc90833247da31ce14. The pre-release post receives the same Configuration-path correction as the six new source notes. Public post matches the six-language generator bytes. The previous public 0.38.0 post remains byte-identical, SHA-256 c8b8892ac5918c4b24a61a6409d302033b677e82a97c5cd0ccaec8b9014e3897.

Use the compact linked title, Read patch notes in:, and six separate language links as the GitHub release body so the existing Garithos workflow posts the approved format. Do not dispatch an extra announcement or edit an old post.

## Completion

After merge, verify online main, tag the exact approved merge, wait for Draft release, replace its ZIP/checksum with the final validated CI assets, attach the verified FFmpeg source companion, verify the draft asset list and six links, then publish. Verify public latest, asset digests, the rendered site with separate 0.38.1 and 0.38.0 cards, and the existing announcement workflow result. Record final public confirmation in the completion report and close this handover through a follow-up PR.

Archive audit: all seven shipped sessions with explicit IDs were already archived; the active-session inventory has no shipped match. The UV-drag, pivot and French/German sessions were also found archived by their recorded titles. Keep the current release chat. No unrelated or active session was archived.

Evidence: D:/Codex/mdlxl-hotfix-0.38.1/report. Used test packages/profiles/runtimes are disposable and must be removed immediately after checks; retain only small evidence and the requested release ZIP/checksum. Preserve owner installations/profiles and D:/Claude/MDLxL-TestModels. No Warcraft III gameplay verification; no full packaged suite was run under the owner's targeted-test exception.
