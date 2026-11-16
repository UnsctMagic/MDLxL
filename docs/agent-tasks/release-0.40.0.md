# MDLxL 0.40.0 release

Status: completed — 0.40.0 released 15 Nov 2026 (release PR #650, bf55affa).
draft come next; publishing, Garithos and the website wait for the owner (peer session
local_a3a16fa6 publishes).
Owner / consolidator: Claude Code (release handoff session local_2ef9913b-787a-4168-8396-bd0317361c61)
Updated: 2026-11-15 (session local_2efbff72-f905-430a-97f2-ebf0b66800ce)

## Goal and completion criteria

- Owner, 12 Nov 2026 (AFK 05:20–08:00): manage the approved 0.40.0 release, fix remaining
  bugs, verify the exact release candidate against AGENTS.md and the
  [release standard](../QA-AND-RELEASE-KIT.md#release-standard), merge approved fixes
  through PRs once checks pass; release and publication stay within the recorded approval
  and release gates. Pause at 08:00 and wait.
- No recorded approval to tag or publish was found in this session's sources; nothing was
  tagged or published.
- Owner, 12 Nov 2026 (after the pause): "Do not release without FX, its stilll being worked
  on". 0.40.0 waits for the FX editor (`claude/fx-editor`) to be finished and merged; then
  merge main into this branch and rerun the tests FX touches. Done when the release standard
  holds for the final build and the owner publishes.

## Merged into main on 12 Nov

| PR | What | Merge |
| --- | --- | --- |
| #633 | Forge tests skip where the private Footman models are absent (main CI red since #630) | 00e366d4 |
| #635 | Main-review fixes, contracts 1–7 (Codex), plus an auto-corpse private-model test skip | c1548e40 |
| #634 | Handles show their job word on hover (handles session) | 97caa7bc |
| #631 | Bone Namer (Bone Namer session; main merged in twice, fr/de catalog order fixed) | ee63f627 |
| #636 | Wrong and untranslated app text found in the guides (ZH Managers menu, ES Caras, FORGE header, canvas handle words, FR/DE Glow Up) | 536abe98 |
| #637 | Bone Namer side, part and copy words keep their bone meaning in every language | 1d63fb66 |
| #638 | EMTR keeps one preview while switching emitters and View All Emitters (finishes Codex's unmerged repair) | 0909cdce |
| #639 | EMTR Ingredients pictures show particles (blank since #507) and ribbons again | 250312c2 |
| #640 | Testing rules: read after the app has caught up (another session; docs only) | 19481b44 |

Main CI green after each merge.

## Local, not online

- `claude/camera-idle-frames` (worktree `.claude/worktrees/camera-idle-frames`, from main
  19481b44): 04ec1b2d "3D camera stays exactly still on idle frames" and f10b528c "Restoring a
  saved camera keeps it exactly". Fixes uv-zoom-collapse "Zoom Shift keeps the 3D camera"
  (passed on 0.39.0, failed on the candidate): since 8b33aeb5 the UV preview's Footman Front
  framing is a view that OrbitControls' spherical round trip moves by one rounding step on
  every `update()`, both on idle frames and when a rebuilt preview restores the saved camera.
  Fail-first test `test/editor-camera-idle.test.js`; source suite 3,466 tests, 0 failed.
  Needs a PR when the owner says "merge".
- `claude/release-0.40.0` (this worktree): everything below plus the camera branch merged in.

## Release branch

- Codex's 10 Nov prep (`codex/release-0.40.0`: version, notes, Each Piece) merged onto main;
  notes rewritten for everything since v0.39.0 in six languages (body 3,928 of 4,096
  characters); README summary; `newFeatureTopics['0.40.0']`; RELEASE-NEXT reset; review and
  Bone Namer task notes completed; main 250312c2 merged at 07:55 (catalog sizes recounted
  [7956, 7966, 7861, 8089, 8089]); final guides copied in; EMTR fixes clause in the six notes.
- After the pause: main 19481b44 (#640) and `claude/camera-idle-frames` merged in;
  c917464b updates six packaged tests to 0.40.0's intended changes; 6de68df1 updates
  pose-console to the three remaining handle shapes. HEAD after these: 978d36bc.
- 14 Nov (prep without FX, owner): main 40a37825 (#641 Node Manager New browses native
  events) merged in; its six untranslated texts (Add event, Loading event data…, No entries in
  the configured game files., Add nodes, Add event object, Add light) translated in all five
  catalogs (sizes now [7962, 7972, 7867, 8095, 8095]); Node Manager line in the six notes.
  Release body 4,093 of 4,096 characters (English wording tightened): **the FX text must fit
  by rewriting the existing FX line or trimming elsewhere**; `node scripts/release-material.mjs
  0.40.0 D:\Claude\MDLxL-gate\release-0.40.0-material` checks it. No packaging or packaged
  tests run (owner: compute waits for FX). The guides have no Node Manager page.
- 15 Nov: notes rewritten in six languages for #642 Glow Up weapons, #643 Modulate fix, #644 ribbon
  sweeps, #645 FX redesign, #646 Spawn previews, #647 POSE clues and symbol sets, #648 Objects /
  Object Manager; README summary. Body 4,093 of 4,096: inline and heading bold dropped and older
  lines shortened to fit; "Default in Hotkeys asks first" dropped.
- New Features guides rebuilt on the current UI, 7 pages in six languages (Animated,
  UV Preview RGB / Hide extras, Review detected glow, Call Upon Forge, right-click menus and
  Managers, BITZ Manage / Replace Part, Bone Namer). Generator:
  `D:\Claude\MDLxL-gate\features-0.40.0` (README.txt there).

## Release standard

Final build: 2178f2d7, packaged and run from outside the repo
(`D:\Claude\MDLxL-gate\pkg-fix\MDLxL-win32-x64`). Click sweep rule: owner 15 Nov, every
release runs only the `footman` setup (rule on `claude/one-setup-sweep` a75ec913, merged by
the peer session).

| # | Line | State |
| --- | --- | --- |
| 1 | Builds and packages from the exact commit, CI green | Packaged at 2178f2d7; CI on the release PR |
| 2 | Compatibility and source tests | Compatibility 57 / 0 failed; source 4,022 tests, 0 failed, 10 skipped |
| 3 | Full packaged suite | Full run 07:00 (253 pass, 44 fail, 1 timeout, 6 skip), then every non-pass rerun on the final package; all classified below |
| 4 | `core` on no-gpu-warp, slow-cpu, hidpi | Done; failures rerun on 2178f2d7: only showcase (no-gpu) and particle-picture remain, both pre-existing |
| 5 | Click sweep (`footman`) | Pass on 2178f2d7 (39 min) |
| 6 | Each feature and fix works the user's way | Fail-first packaged checks per fix; owner hand test not done |
| 7 | Previews: mouse rotation, Play speed | In the suite (passed) |
| 8 | Save and reopen .mdx/.mdl | In the suite (passed) |
| 9 | Release text, six languages, PDFs | Notes cover #642–#648; New Features PDFs rebuilt, 12 pages, six languages |
| 10 | CI ZIP tested; public SHA-256 | After the tag |
| 11 | OptimizeXL flail regression | Pass: Flail01 identical; Flail03 differs only in `mounted-spheres` (owner rule, 11 Nov) |

## Suite results (15 Nov)

| Test | Result | Classification |
| --- | --- | --- |
| 29 tests (FX, POSE, close-prompt, auto-corpse, perspective-zoom…) | fail → pass | Concurrent runners in one worktree killed each other's apps; rerun alone on the final package |
| hotkey-badges, manager-menu-hotkeys, manager-simplification, node-effect-controls, particle-main-rig, particle-model-io, particle-prototype, particle-workflow, rotation-interaction, surface-effects-warriors, toolbar-modes | fail → pass | Stale tests for the Objects master (#648) and FX renames (#645), fixed in e59a2e2a |
| object-types | fail → pass | Real bug: Create Ref / Attachemator left new refs hidden in the XL look (old `attachments` key); fixed in 2178f2d7, attachemator and bone-namer rechecked |
| citadel-studio | fail | Also fails on 0.39.0 (pre-existing) |
| particle-world-effects | timeout | Also fails on 0.39.0 (pre-existing) |
| particle-picture | flaky | Pre-existing, fails on 0.39.0 too |
| showcase (no-gpu-warp only) | fail | Same on 0.39.0: the software renderer has no multisampling |
| particle-model-io | flaky | Timed out once on the save/reopen wait, passed three times |

Results: `out/rel/` in the release worktree (`rerun-summary.json`, `*-core-summary.json`,
`fix-*-summary.json`, `click-sweep-summary.json`, `flail.log`).

## Known issues and open items

- EMTR Lab: on a ribbon 8 units tall the edge dots sit under the Move handle at the opening
  zoom, so dragging an edge moves the ribbon; Fit view fixes it (0.39.0 kept them apart).
  Needs a design call.
- POSE handle words are drawn on the canvas untranslated; "Glow Up" stays English inside
  tooltips; ZH Bone Namer group "Main" reads 主主体.
- Missing historical Flail03 reference (owner accepted the `mounted-spheres` case).
- FX window items A3–A5 from the main review were not rechecked against the FX redesign.

## Next steps for whoever continues

1. Release PR, CI, merge, tag `v0.40.0`, fill the draft (body, FFmpeg source ZIP, CI ZIP check).
2. The owner publishes (peer session): release, Garithos post
   (`D:\Claude\MDLxL-gate\release-0.40.0-material\garithos-post.md`), LowPolyWorks FX tutorial
   (`D:\Claude\LowPolyWorks-fx-tutorial`, branch `claude/fx-tutorial`), then archive sessions.
3. Cleanup: worktrees `fx-tests-iso` and `v0390-baseline` (remove junctions as links first),
   `out/pkg-0390`.
