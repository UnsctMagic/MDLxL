# MDLxL 0.40.0 release

Status: paused at 08:00 on 12 Nov 2026 (owner's cutoff). Release candidate prepared locally; not tagged, not published. Release gates partly run.
Owner / consolidator: Claude Code (release handoff session local_2ef9913b-787a-4168-8396-bd0317361c61)
Updated: 2026-11-12

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
  merge main into this branch and rerun the tests FX touches. Done when the release standard holds for the final build and the
  owner publishes.

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

Main CI green after each merge.

## Release branch

- Local `claude/release-0.40.0` in `.claude/worktrees/release-0.40.0`: Codex's 10 Nov prep
  (`codex/release-0.40.0`: version, notes, Each Piece) merged onto main; notes rewritten for
  everything since v0.39.0 in six languages (body 3,928 of 4,096 characters); README
  summary; `newFeatureTopics['0.40.0']`; RELEASE-NEXT reset; review and Bone Namer task
  notes completed. At 07:55 main 250312c2 (all eight PRs above) was merged in, catalog sizes
  recounted ([7956, 7966, 7861, 8089, 8089]), the final guides (Bone Namer page re-shot with
  the #637 words) copied in, and an EMTR fixes clause added to the six notes. After that merge
  only `localization-catalogs` and `release-material` tests (14/14) and
  `release-material.mjs` were run; the package in `out/pkg` is still a8d946e1.
- New Features guides rebuilt on the current UI, 7 pages in six languages (Animated,
  UV Preview RGB / Hide extras, Review detected glow, Call Upon Forge, right-click menus and
  Managers, BITZ Manage / Replace Part, Bone Namer). Generator:
  `D:\Claude\MDLxL-gate\features-0.40.0` (README.txt there). Previews in its `preview` and
  `preview-final` folders.

## Release standard

| # | Line | State |
| --- | --- | --- |
| 1 | Builds and packages from the exact commit, CI green | Packages built locally; release PR not opened (no CI on the release branch yet) |
| 2 | Compatibility and source tests, no new failure | Release branch: source 3,463 tests 0 failed / 0 new; `pnpm test` 57/57 (before the last main merge) |
| 3 | Full packaged suite | Partial: 195 of 287 on the a8d946e1 package (180 pass, 11 fail, 4 skip, 92 not reached); see "Suite so far" |
| 4 | `core` on no-gpu-warp, slow-cpu, hidpi | Not run |
| 5 | Click sweep, all 19 setups | Not run (about 10–11 h) |
| 6 | Each feature and fix works the user's way | Fail-first packaged checks for each fix merged today; owner hand test not done |
| 7 | Previews: mouse rotation, Play speed | EMTR mouse orbit checked in smoke runs; rest in the suite |
| 8 | Save and reopen .mdx/.mdl | In the suite (not reached or passed, see results) |
| 9 | Release text, six languages, PDFs looked at | Done for notes and all guide pages |
| 10 | CI ZIP tested; public SHA-256 | Not reached (no tag) |

## Suite so far (package a8d946e1, before #637/#638/#639; paused 07:49)

Results and logs: `out/suite/default` in the release worktree.

| Test | Result | Classification |
| --- | --- | --- |
| ai-live, ai-live-tabs | skip | Opt-in by design (signed-in AI profile) |
| particle-library-indexing, particle-performance | skip | Always skipped by the runner (gap: real profile / old baseline build) |
| particle-feedback | fail | Fixed by #638 after this package; rerun |
| particle-prototype | fail | Fixed by #639 after this package; rerun |
| emtr-add-like-ribbons | fail | Stale particle index in the test profile ("index Warcraft assets again"); rerun with a fresh index |
| particle-world-effects, particle-lifecycle | fail | Stale copied particle library (no browse.json); rebuild the index and rerun |
| particle-picture | fail | Mouse orbit check; flaky in worker runs (about 1 in 4 on main and the fix); rerun, then compare with 0.39.0 |
| pose-console | fail | Stale test: picks the 'triangle' handle shape the owner removed on 12 Nov (0a7f017b); update the test |
| citadel-studio | fail | Unknown: image differs after "Separate this part"; rerun and compare with 0.39.0 |
| geoset-merge-conflicts | fail | Unknown: Merge Geosets popup not centred within 3 px; rerun and compare with 0.39.0 |
| model-manager-regressions | fail | Possibly stale after the Managers tab moved to the menu; rerun and compare with 0.39.0 |
| movement-gizmo | fail | Unknown, may be timing (hover glow 7 vs 6); rerun and compare with 0.39.0 |

Resume (PowerShell, in the release worktree; repackage first because main changed after a8d946e1, and rebuild the particle index):

```powershell
$env:TEMP="$PWD\out\tmp"; $env:TMP=$env:TEMP
$env:MDLXL_REAL_PLAYWRIGHT='D:\Claude\tools\node_modules\playwright-core'
$env:MDLXL_REAL_PROFILE='D:\Claude\MDLxL\profile'
node scripts/index-particles.mjs --output out/particle-index/particles
$env:SUITE_RESUME='1'; node scripts/run-packaged-tests.mjs default all
```

## Known issues and open items

- FX editor (`claude/fx-editor`, 684110ed, local): not ready; its own status note is
  `docs/agent-tasks/fx-owner-test-02.md` on that branch. FX window items A3–A5 from the
  main review wait for it.
- `emtr-add-like-ribbons` fails because the test profile's particle index is out of date
  (the Library asks to index Warcraft assets again); setup, not code. Same on main before.
- POSE handle words (Hand, Foot, Knee, Elbow…) are drawn on the canvas untranslated; they mix
  in model bone names and double as icon keys, so they need their own change.
- "Glow Up" stays English inside tooltip and help sentences in all languages.
- ZH Bone Namer group "Main" reads 主主体 (repeats 主).
- `particle-picture` and `particle-library-previews` were flaky in worker runs.
- Missing historical Flail03 reference (owner accepted the known `mounted-spheres` case).
- D: had about 35 GB free (the kit wants 40 GB for a full run).

## Next steps for whoever continues

1. Resume the full packaged suite (command below), then classify every non-pass against
   0.39.0 (section 5 of the kit).
2. Targeted reruns for what merged after the suite's package (#637, #638, #639):
   bone-namer, particle-feedback, particle-prototype, emtr-ingredient-ribbon-picture.
3. `core` on no-gpu-warp, slow-cpu, hidpi; then the click sweep of all setups.
4. Open the release PR (owner says "merge"/"release"), CI, merge, tag, finish the draft,
   website, publish — only with the owner's approval.
