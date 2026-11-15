# MDLxL 0.40.0 release

Status: waiting for FX (owner, 12 Nov). Candidate prepared and tested locally; not tagged, not
published. Full packaged suite done on the candidate; core variants and click sweep not run.
Owner / consolidator: Claude Code (release handoff session local_2ef9913b-787a-4168-8396-bd0317361c61)
Updated: 2026-11-14

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

| # | Line | State |
| --- | --- | --- |
| 1 | Builds and packages from the exact commit, CI green | Packaged locally at 978d36bc; release PR not opened (waits for FX) |
| 2 | Compatibility and source tests, no new failure | Source 3,466 / 0 failed on the camera branch (main 19481b44 + fix); release branch 3,463 / 0 before the last merges |
| 3 | Full packaged suite | Done on the 2374f4b6 package: 271 pass, 11 fail, 6 skip; every failure classified below |
| 4 | `core` on no-gpu-warp, slow-cpu, hidpi | Not run |
| 5 | Click sweep, all 19 setups | Not run (about 10–11 h) |
| 6 | Each feature and fix works the user's way | Fail-first packaged checks for each fix merged today; owner hand test not done |
| 7 | Previews: mouse rotation, Play speed | In the suite (passed) |
| 8 | Save and reopen .mdx/.mdl | In the suite (passed) |
| 9 | Release text, six languages, PDFs looked at | Notes cover #642–#648 (15 Nov); guide pages not updated for them |
| 10 | CI ZIP tested; public SHA-256 | Not reached (no tag) |

## Suite results

Full run on the 2374f4b6 package (fresh particle index, profile copy `out/real-profile`):
271 pass, 11 fail, 6 skip. Backups: `out/suite-results/{full-run-1,rerun-1,v0390}`.

| Test | Result | Classification |
| --- | --- | --- |
| ai-live, ai-live-tabs, updater-release-gate, updater-bootstrap | skip | Opt-in or manual by design |
| particle-library-indexing, particle-performance | skip | Always skipped by the runner (real profile / old baseline build) |
| emtr-add-like-ribbons, updater-packaged | fail → pass | Passed on rerun (fresh profile copy; updater timing) |
| uv-grabthrough, vis-mdlvis-mode, geoset-merge-conflicts, model-manager-regressions, movement-gizmo, rotation-interaction | fail → pass | Stale tests, fixed in c917464b: "Hide extras" rename (319e9194); VIS has no Axis guides (40304fc4); dialogs and the viewport sit below the new Windows menu (aed041a0); menu click before the page listens; bone label pixel wobble. All passed on 0.39.0 and pass on 0.40.0 now |
| uv-zoom-collapse | fail → pass | Real bug (camera moved by a rounding step); fixed on `claude/camera-idle-frames`, passes on the 978d36bc package |
| citadel-studio | fail | Also fails on 0.39.0 (pre-existing): image differs after "Separate this part" |
| particle-world-effects | fail | Also fails on 0.39.0 (pre-existing): ribbon thumbnail never appears / report folder missing |
| particle-picture | flaky | Pre-existing: "normal mouse drag rotates the EMTR preview camera" fails 1 in 4 on the 978d36bc package and 2 in 3 on 0.39.0 |

Camera fix check on the 978d36bc package (bundle verified to contain the fix): uv-zoom-collapse
and 11 UV/camera tests pass, then 56 tests that check camera preservation (Quad View,
portrait, Showcase, POSE, OptimizeXL, Forge, workplane…) all pass. Backup:
`out/suite-results/camera-978d36bc`.

Profile note: `MDLXL_REAL_PROFILE=D:\Claude\MDLxL\profile` has an October particle library
without `browse.json`; use the copy `out/real-profile` (fresh index from
`node scripts/index-particles.mjs --output out/particle-index/particles`).

Repackage note: `pnpm run package` refuses to replace an existing `release/MDLxL-win32-x64`;
use `node scripts/package.mjs --overwrite`, then copy to `out/pkg` and check the bundle date.

```powershell
$env:TEMP="$PWD\out\tmp"; $env:TMP=$env:TEMP
$env:MDLXL_REAL_PLAYWRIGHT='D:\Claude\tools\node_modules\playwright-core'
$env:MDLXL_REAL_PROFILE="$PWD\out\real-profile"
node scripts/run-packaged-tests.mjs default <names>   # MDLXL_SUITE_PKG=$PWD\out\pkg-0390\MDLxL-win32-x64 for 0.39.0
```

## Known issues and open items

- FX editor (`claude/fx-editor`, local): not ready; owner wants it in 0.40.0. Its own status
  note is `docs/agent-tasks/fx-owner-test-02.md` on that branch. FX window items A3–A5 from
  the main review wait for it.
- POSE handle words (Hand, Foot, Knee, Elbow…) are drawn on the canvas untranslated; they mix
  in model bone names and double as icon keys, so they need their own change.
- "Glow Up" stays English inside tooltip and help sentences in all languages.
- ZH Bone Namer group "Main" reads 主主体 (repeats 主).
- citadel-studio and particle-world-effects fail on 0.39.0 as well.
- Missing historical Flail03 reference (owner accepted the known `mounted-spheres` case).
- D: had about 34 GB free (the kit wants 40 GB for a full run).

## Next steps for whoever continues

1. When FX is merged into main: merge main here, `node scripts/package.mjs --overwrite`,
   rerun the tests FX touches (fx-*, particle-*, emtr-*, visual-effects-*) plus anything new.
2. `core` on no-gpu-warp, slow-cpu, hidpi; then the click sweep of all setups.
3. On the owner's "merge": push `claude/camera-idle-frames`, PR with a `Session:` line,
   merge with `gh api repos/UnsctMagic/MDLxL/pulls/<n>/merge -X PUT -f merge_method=merge`.
4. Release PR, CI, merge, tag, finish the draft, website, publish — only with the owner's
   approval. Add FX to the notes and guides first.
5. Cleanup: worktree `.claude/worktrees/v0390-baseline` (remove its `node_modules`
   junction as a link first), `out/pkg-0390`, and `camera-idle-frames` after its merge.
