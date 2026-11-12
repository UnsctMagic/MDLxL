# MDLxL QA and release kit

One procedure for any AI (Claude, Codex or another) to test, repair and release
MDLxL. It assumes no memory of earlier work. Read this file, then the root
[AGENTS.md](../AGENTS.md). Details stay in the linked guides; if a guide and this
file disagree, current code decides the facts and the owner decides the intent.
Fix the stale text when you find it.

Pick a job:

| The owner wants | Job | Time | Sections |
| --- | --- | --- | --- |
| A feature or fix checked | **Check** | minutes | [2](#2-setup), [3](#3-which-tests-to-run), [5](#5-repairing-failures) |
| To know whether everything works | **Click-through QA** | hours | [2](#2-setup), [6](#6-click-through-qa), [5](#5-repairing-failures) |
| An urgent one-fix release | **Hotfix** | 30–90 min | all, with the [hotfix path](#hotfix-path) |
| A normal release | **Release** (includes the full QA) | about 14 hours, mostly unattended | all |

## Prompts to paste into an AI

Replace the part in `<angle brackets>`.

**Check**

```text
Follow docs/QA-AND-RELEASE-KIT.md in D:\Claude\MDLxL, job "Check", for: <what changed>.
Work in a new worktree. Say which tests you will run first. Do not run the full
packaged suite. Do not put anything online. End with the plain-language report.
```

**Click-through QA**

```text
Follow docs/QA-AND-RELEASE-KIT.md in D:\Claude\MDLxL, job "Click-through QA", on
<current main / this build folder>. Use the hidden desktop only, with no windows
on my screen. Run passes <all / 1-3>. Repair what you find on a local branch using
section 5. Do not put anything online. End with the plain-language report.
```

**Release**

```text
Follow docs/QA-AND-RELEASE-KIT.md in D:\Claude\MDLxL, job "Release", for version
<next version>, including <PRs or "everything on main">.
First list every approval you will need, ask for them all at once, then work
without further questions. If new tests fail: <fix them and continue / stop and ask>.
```

## Release standard

A build ships only when every line below is true **for the final build**. A result
from an earlier build does not count.

| # | What must be true | How it is shown |
| --- | --- | --- |
| 1 | The app builds and packages from the exact commit being released | Package made from that commit, online CI green |
| 2 | Compatibility and source tests have no new failure | CI, against [known-test-failures.txt](../.github/known-test-failures.txt) |
| 3 | The full packaged suite has no new failure | One run on the final package; every non-pass classified using [section 5](#5-repairing-failures) |
| 4 | Rendering holds up on weaker machines | `core` on `no-gpu-warp`, `slow-cpu` and `hidpi`, no new failure |
| 5 | Clicking everything causes no crash, freeze or failed Undo | [Click sweep](#the-click-sweep-script) with `MDLXL_SWEEP_SETUPS=all`, nothing left unreached; every dead or stuck control judged |
| 6 | Every feature and fix in this release works the way a user does it | Real clicks, drags and keys in the packaged app, with a test for each on-screen promise |
| 7 | Previews still work | Real mouse rotation in each changed preview; Play measured at real speed |
| 8 | Saved models are safe | Save and reopen `.mdx` and `.mdl`; unedited parts stay identical |
| 9 | Release text is correct | Six languages of notes, every new PDF looked at, every body link exists as an asset |
| 10 | What the public downloads is what was tested | CI ZIP tested before publishing; public ZIP SHA-256 matched by hand afterwards |
| 11 | OptimizeXL reproduces the frozen flail results | Run [the flail regression](../test/manual/optimizexl-flail-regression.mjs) on both accepted inputs with the historical mounted-spheres reference. |

For line 11, run the flail regression from the release checkout with both inputs:

- Flail01: `D:\Claude\MDLxL-TestModels\optimizexl\WH_WOC_KnightKhorneFlail01_HIVE_OPTIMIZED.mdx`
- Flail03: `D:\Claude\MDLxL-TestModels\optimizexl-expression\WH_WOC_KnightKhorneFlail03.mdx`
- Flail03's mounted-spheres case needs the historical MDX and that file is missing
  from this PC. When available, store it as `D:\Claude\MDLxL-TestModels\optimizexl-expression\Flail03-mounted-spheres-historical.mdx` and set `MDLXL_FLAIL_MOUNTED_REFERENCE` to its path.
  The checker verifies the reference against the frozen SHA-256 before comparing
  the current serialization. Until that reference is available, line 11 passes
  when Flail01 passes and Flail03 differs only in `mounted-spheres`
  (owner decision, 11 Nov 2026).

**A hotfix** needs 1, 2, 6, 9 and 10, plus targeted tests for what changed and a
`baseline` sweep of the affected window.

**This is mandatory.** When the owner says "release", in any tool and however briefly,
every line applies. Nothing needs to be asked for. Only the owner can reduce it, for that
release only, and the reduction is written in the report.

**Time.** Plan for most of a day: about 3 hours for lines 3 and 4 and an estimated 10 to 11
hours for the sweep of all 19 setups, at about 30 to 36 minutes each. It runs hidden, so
start it and let it work. Run the suite and sweep one after the other, never at once
in one worktree, because each run's cleanup stops the other's apps. Run them **once**,
on the final build. After a fix, rerun only the affected tests and the affected setups.

**What the words mean**

- *No new failure* does not mean zero failures. A test that fails the same way on the
  previous release does not block, but it is listed. It must be measured in this
  release, not copied from an older list.
- *Skipped* is not passed. Every skipped test goes in the report with its reason.
- A *flaky* test passed on two reruns alone. It is recorded and watched.
- A *dead* control does not block by itself. Someone must judge it: a real fault
  gets fixed, and correct behaviour goes in the report with the reason.
- Only the owner can waive a line, and the waiver is written in the report.

**What this standard cannot prove.** Warcraft III itself is never run, so a model can
pass here and still look wrong in the game. Tests cannot judge whether something looks
good or feels right. Private test models missing from the PC leave gaps. Real AI answers
are measured only on request. The owner's hand test covers these; say so in the report.

## 1. Rules that are never traded away

**Online**

- Nothing goes online until the owner says "merge" or "release" in the current
  conversation. No push, PR, tag, release or post, not even for a handover. Until
  then commit locally and report `saved on your PC, not online`.
- Publishing and announcing are public and hard to undo. A release approval
  must name them. Merge only through a PR, never directly to `main`.

**The owner's PC**

- Everything goes on D:. Temp files too.
- No window may ever appear on the owner's screen, not even for a moment. Every
  app launch, including one-off probes, runs on the hidden desktop
  ([how](PACKAGED-TESTS.md#windows-stay-hidden)). Never open a build unless asked.
- Do not touch the owner's running MDLxL, real profile, libraries or saves. Their
  settings may be read and copied, never changed.
- Never delete, move or tidy `D:\Claude\MDLxL-TestModels`, even during a cleanup
  the owner asked for.
- Use a new worktree under `.claude\worktrees\` (Claude) or `D:\Codex\<task>`
  (Codex). Other sessions use the main checkout live, so never switch its branch.

**Test honesty**

- A test counts only if it does what a user does: real clicks, drags and keys, with
  focus where the last real click left it. Calling `.focus()` or setting state in
  code to reach a step proves nothing. Probes may only read.
- A new test must fail on the old broken code before it counts.
- Green is not the goal. Never loosen a check, add to
  [known-test-failures.txt](../.github/known-test-failures.txt) or skip a test to
  get green.
- Report only what you ran, from a check run just now. Say `ready to test` for
  anything not actually exercised.

**Scope**

- The full packaged suite runs only inside a release the owner asked for, once, on
  the final build. Feature work and repairs get targeted tests.
- Fix every instance of a bug in the same change. Dropping scope is the owner's call.
- Do not add panels, limits, flavour text or features while repairing. Reuse existing
  controls. See [AGENTS.md](../AGENTS.md) for the product rules.
- If the owner's report or a result is unclear, say so and ask. Do not guess.

## 2. Setup

Check these first and stop with a clear message if one is missing.

```powershell
git fetch origin
git worktree add .claude\worktrees\<task> -b <claude-or-codex>/<task> origin/main
(Get-PSDrive D).Free / 1GB        # want 40 GB or more for a full run
```

Needs: Node 22.12+, pnpm, and Playwright from `D:\Claude\tools\node_modules\playwright-core`.
Link `node_modules` with a junction instead of copying it. In a junctioned worktree
**use `node`, not `pnpm run`**, because `pnpm run` re-points the main checkout's links.
Before removing a worktree, delete the junction as a link. Never delete through it.

Keep temp on D: and build the app:

```powershell
$env:TEMP = "$PWD\out\tmp"; $env:TMP = $env:TEMP; New-Item -ItemType Directory -Force $env:TEMP | Out-Null
$env:MDLXL_REAL_PLAYWRIGHT = 'D:\Claude\tools\node_modules\playwright-core'
npx vite build
node scripts/fetch-ffmpeg.mjs
node scripts/package.mjs --out out/pkg
```

Without `--out`, packaging writes to `release\`, where the runner does not look.
Packaging fails silently if that `MDLxL.exe` is open, so build to a fresh folder and
confirm the build contains your change before testing.

Real models come from `D:\Claude\MDLxL-TestModels`; the
[fixture table](PACKAGED-TESTS.md#before-a-run) lists each one. Also copy
`profile/particles` and `profile/game-data-discovery.json` from the latest
`.claude\worktrees\release-*` that has them, and set `MDLXL_REAL_PROFILE` to a
profile folder with particles. A skipped test is a gap: list it in the report.

## 3. Which tests to run

| Layer | Command | When |
| --- | --- | --- |
| Compatibility | `node --test tests/*.test.js` | every change |
| Source | `node --test test/*.test.js`, or the named files | named files per change; all before a PR |
| Focused app tests | `node scripts/run-packaged-tests.mjs default name,name` | every visible change |
| Core under other machines | `node scripts/run-packaged-tests.mjs <variant> core` | rendering, timing or layout changes; release |
| Full packaged suite | `node scripts/run-packaged-tests.mjs default all` | release only, about 2 hours |
| Click sweep | [`node scripts/run-packaged-tests.mjs default click-sweep`](#the-click-sweep-script) | every release, all setups; one setup when a window or shared control changed |
| Hand-style QA | [section 6](#things-clicks-cannot-find) | release; on request |
| Updater gate | [gate guide](UPDATER_RELEASE_GATE.md) | only if the updater, installer or package layout changed, and ask first |
| Real AI runs | [opt-in](PACKAGED-TESTS.md#opt-in-real-use-ai-measurements) | only when asked; they spend the owner's credits |

Find focused tests from the [project map](agent-map.md) row, then search `test/` for
the changed component, CSS class or command id. Say which tests you will run
before running them.

Machine variants: `default`, `no-gpu-warp`, `swiftshader`, `slow-cpu`, `hidpi`, and
`release` / `release-no-gpu` for an unzipped release (`MDLXL_SUITE_PKG=<folder>`).

Runner facts ([full guide](PACKAGED-TESTS.md)):

- Never run two runs of the same variant, and never run probes from a folder the
  runner is cleaning up. Use a second worktree for side work.
- Results: `out/suite/<variant>/summary.json`, one `.log` per test.
- Resume after a stop with `SUITE_RESUME=1`. It skips everything already passed,
  so to re-check a passed neighbour use another variant name such as `release`.
- Slow test: `SUITE_TIMEOUT_MS=1800000`.
- A silent stop is usually a full disk. Check D: and resume.
- A hidden-desktop run has about 1 frame per second, so timing tests need
  `--disable-gpu-vsync --disable-frame-rate-limit`. Compare those runs relatively.

## 4. Running the full suite (release only)

1. Freeze scope. Late additions wait unless the owner says otherwise.
2. Check `main` is green: `gh run list --branch main --limit 5`.
3. Bump the version first, because a test checks it.
4. Run `default all` on the final package, with every fixture in place.
5. Run `no-gpu-warp core`, `slow-cpu core` and `hidpi core`, one at a time.
6. Run the [click sweep](#the-click-sweep-script) with `MDLXL_SWEEP_SETUPS=all`.
7. Sort every non-pass using section 5. Only new failures block.

Over the long run, check progress from the summary file rather than guessing.

## 5. Repairing failures

Work through these in order for each failure.

**a. Reproduce it alone.** Rerun just that test. If it passes twice, call it flaky,
record it and move on. Do not call a repeat failure flaky.

**b. Classify it.**

| Type | How you know | What to do |
| --- | --- | --- |
| Already broken | Fails the same way on the previous release: download and unzip it, then `$env:MDLXL_SUITE_PKG='<folder>'; node scripts/run-packaged-tests.mjs release <name>` | Report it. Does not block. Measure this every time; do not trust old lists |
| New regression | Passes on the previous release, fails now | Fix the app. To find the cause, build older commits in a detached worktree |
| Stale test | The behaviour changed on purpose, and you can name the owner request or PR | Update that test to the new behaviour and quote the reason in the commit |
| Environment | Missing model, full disk, leftover process, launch dies in 2 seconds | Fix the setup and rerun |
| Timeout | Stopped at the limit | Raise the limit once. If it still hangs, treat it as a regression |

If you cannot show that a behaviour change was intended, it is a regression.

**c. Find the cause.** Fix the cause, not the symptom. Search for the same mistake
elsewhere and fix all of it. Before changing each place, check comments,
`git log -S` and tests for a deliberate reason, and keep deliberate code.

**d. Check for locked rules.** Read the matching rule before changing these:
[UV Rotate and Zoom](UV-ROTATE-ZOOM.md), [motion warnings](MOTION-INSPECTOR.md),
[OptimizeXL teaching](OPTIMIZEXL_TEACHING.md) (its flail baseline is immutable),
[Movement/View/workplane](../MERGER_NOTES.md). An improvement may only add
capacity: existing correct results stay identical, proven by comparison.

**e. Make the smallest fix and add a real-input test** that fails without it.

**f. Rerun only** the failed test plus tests covering the changed files. Never restart
the full suite for a fix.

**g. Two failed attempts at the same bug means stop.** Write down what you tried and
what you measured, and ask.

**Never repair by:** editing imported libraries, changing authored model data or
intended motion, adding a cap or gate nobody asked for, or hiding a control that
misbehaves.

## 6. Click-through QA

The goal is to prove that every control does what it says, in every setup users
really have. Automated tests prove chosen paths. This pass looks for what nobody
thought to test.

### The click sweep script

[test/click-sweep.electron.cjs](../test/click-sweep.electron.cjs) does the clicking.
It runs hidden, on a throwaway copy of the model and a throwaway profile, with the
internet, browser and file dialogs blocked.

```powershell
$env:MDLXL_SWEEP_SETUPS = 'all'   # for a release; or one, such as 'footman'
node scripts/run-packaged-tests.mjs default click-sweep
```

| Setting | Meaning |
| --- | --- |
| `MDLXL_SWEEP_SETUPS` | `baseline`, `no-model`, `footman`, `toolbar-trim`, `toolbar-hidden`, `vis`, `small`, `theme-<id>`, `lang-<ru, es, zh, fr, de, mordor>`, or `all` |
| `MDLXL_SWEEP_MINUTES` | Time limit per setup, default 40 |
| `MDLXL_SWEEP_OUT` | Results folder, default `out/click-sweep` |
| first argument (`default`) | Any machine variant, such as `slow-cpu` or `hidpi` |

It is never part of `all` or `core`; it runs only when named. Measured on 9 Nov 2026:
about 36 minutes for `footman` (830 clicks), 23 for `no-model`. Use a real model where you can: the bare demo
model reports some working buttons as dead.

It starts from each main mode, with and without a selection, plus Settings. It gives
every visible, enabled control one real mouse click, sweeps any window that click
opens, then restores the state. It finishes with the application menus.

Read `out/click-sweep/report.md`:

| Section | What to do |
| --- | --- |
| Crashes, Freezes, Undo did not restore | The run fails. Open the screenshot and repair using section 5 |
| The sweep lost its place | Not an app fault by itself. A button can exist only in a state the sweep cannot rebuild. Check it by hand |
| Could not be closed | Check whether Esc or Close should work there. The Managers pages appear here and are fine: you leave them by choosing another mode |
| Windows or states not reached | Find out why. It is a gap until explained |
| Dead | Judge each one. Many are correct: Fit when already fitted, Refresh with nothing new, Open folder (blocked on purpose) |
| Unverified | The preview was moving and nothing else changed. Check by hand |
| Not reached before the time limit | Raise `MDLXL_SWEEP_MINUTES` and rerun |
| Deliberately not clicked | Confirm the list is only exit, update, sign-in, send and AI |
| Clipped, Untranslated | Review the screenshot before changing anything |

**Not covered by the script,** so test these another way: typing in text and number
fields; color pickers and file pickers; dragging; hotkeys
([window-hotkeys](../test/window-hotkeys.electron.cjs) and
[hotkey-defaults-audit](../test/hotkey-defaults-audit.electron.cjs) cover those);
right-click menus; AI features; a second window such as the OptimizeXL review, which
is closed when it opens; and long lists beyond their first eight rows. Native menu items
are fired by the menu itself rather than a mouse. Dropdowns choose their next option
rather than opening the list, and only those with a command id are exercised.

Passes 3, 6 and the list under [Things clicks cannot find](#things-clicks-cannot-find)
still need a person or AI to drive them with
[settings-layout](../test/settings-layout.electron.cjs) and the helpers in
[test/helpers/app.cjs](../test/helpers/app.cjs). Put any one-off script in
`out/qa/<date>/`.

### What to cover on each pass

Every visible, enabled control in: the menus; toolbars and the module dock; sidebars;
the timeline; every tool window and dialog; every Settings tab and sub-page;
right-click menus; each hotkey in the live catalog; and tooltips on hover. Find
controls from the live page each time (`button`, `[role=button]`, `[role=menuitem]`,
`[role=tab]`, `input`, `select`, `[data-action]`, `[data-hotkey]`), because
controls appear as state changes.

**Do not fire for real:** file dialogs (stub them), Exit, Update/Revert, links that open
a browser, AI sends, or anything that writes outside the throwaway profile.

### What "fires correctly" means

For each control, do one real mouse click or key press, then check all of these:

| Check | Fails when |
| --- | --- |
| No crash | A new page error, error-level console line or red error screen appears |
| Something happened | The page, model, selection, status message and windows are all unchanged. Record it as **dead** and check whether it should be disabled at that moment |
| Right thing happened | The result does not match the label or tooltip |
| Still responsive | The next click fails, or the frame takes over about 2 seconds |
| Undo works | An edit does not fully reverse with Ctrl+Z and return with Ctrl+Y |
| Closes cleanly | Esc, Cancel or the X leaves an overlay, a stuck mode or stolen keys behind |
| Text fits | A label is clipped, overlaps, or is untranslated in another language |

Afterwards return to the starting state, restarting the app if unsure, so that one
failure does not cause a run of false ones. Record the setup and the click path for
every problem.

### Passes

Testing every combination is impossible. Change one thing at a time from a
known-good setup, and combine only where things interact. The script covers passes 1,
2 (no model and demo model), 4 and 5, and pass 7 through machine variants.

| Pass | Setup | Sweep |
| --- | --- | --- |
| 1. Baseline | English, default theme, Graphic toolbar, XL look, 1440×1000, Footman with textures | everything |
| 2. Model states | no model; demo model; read-only model; model with unsaved edits; two tabs; a model with no animations or textures | everything |
| 3. Selection states | nothing; one vertex; a geoset; one bone; many bones; a playing animation; each main tool active | toolbars, right-click menus, hotkeys, timeline |
| 4. Interface | Trim and Hidden toolbars; VIS look; each theme in [application-themes.json](../src/application-themes.json); 1024×700; maximized | main window plus all windows opened once |
| 5. Languages | each of `LANGUAGES` in [localization.js](../src/localization.js), including Mordor | open every window, screenshot, check text fit and leftover English |
| 6. Settings | each option on each Settings page changed once, then restart: it must persist and visibly apply; each preset loaded; rebound hotkey shown in tooltips and works; the owner's real `settings.json` copied into a test profile | Settings, then the feature it controls |
| 7. Machines | `no-gpu-warp`, `slow-cpu`, `hidpi`, software-rendering preset | previews, drags, Play, Save |

### Things clicks cannot find

Do these with real input on pass 1, and repeat the previews on pass 7.

- **Every 3D preview:** a real mouse drag rotates the camera; the wheel zooms.
- **Play at real speed:** press Play and measure the rate over several seconds.
  Scrubbing frames misses wrong speeds.
- **Every drag:** handles track the mouse with no lag. Esc mid-drag cancels.
- **Every on-screen promise:** "Delete removes it", "Esc cancels", "Enter applies".
- **Mouse feel:** repeat with the owner's real settings. Fresh profiles hid a bug
  that shipped.
- **Save round trip:** edit, save `.mdx` and `.mdl`, reopen, compare. Unedited parts
  stay identical.
- **Leaving work:** close with unsaved changes; switch tabs mid-tool; open one tool
  window from another.
- **Leftovers:** warnings or stale state from the previous model after opening a new one.

**Look at the screenshots yourself.** Past passes found untranslated headings and raw
data this way, after every test had passed.

### Rate what you find

| Rating | Meaning |
| --- | --- |
| Blocker | Crash, data loss, bad save, or a main feature does not work |
| Major | A feature misbehaves or a control is dead with no workaround |
| Minor | Workaround exists, or a cosmetic problem in a common place |
| Question | Might be intended. Ask, do not fix |

Repair using section 5, then re-sweep only the affected area.

## 7. Release

Read first: [release material](RELEASING.md) and
[updates](AUTO_UPDATES.md). Hotfix and normal releases follow the same steps.

**Ask once, at the start,** for everything: merging waiting PRs, the release PR, the
website, publishing and the Discord post, and what to do on new failures. If the owner
is away, keep the PC awake and do not stop until done.

1. **Preflight.** D: free space, `main` CI green, every requested item merged.
   "Include it" means the release waits for it; only the owner can drop it.
2. **Version.** Next from the latest published release; never reuse one. Patch for
   fixes, minor for compatible features, major for incompatible. Update
   `package.json`, the README title and its current-version summary together.
3. **Notes.** `docs/RELEASE-<version>.md` plus `-ES`, `-RU`, `-ZH-CN`, `-FR`, `-DE`. The
   heading is exactly `# MDLxL <version>`, with no slogan or suffix. UI words come from
   `src/locales/`. Keep the English short, since the Discord limit is 4096 characters.
4. **Guides.** Each new PDF in six languages: `docs/MDLxL-<version>-<Name>-<LANG>.pdf`.
   Look at every page. Never backfill older releases.
5. **Material.** `node scripts/release-material.mjs <version> <D:-folder>` must succeed.
6. **Tests.** Meet the [release standard](#release-standard), using
   [section 4](#4-running-the-full-suite-release-only) and the
   [click sweep](#the-click-sweep-script). Report each line of the standard in the PR.
7. **Merge** (needs approval). Push, open the PR with a `Session:` line, wait for CI,
   merge, and confirm the change is on online `main`.
8. **Tag** `v<version>` on the merge commit and push it. The
   [Draft release workflow](https://github.com/UnsctMagic/MDLxL/actions/workflows/release.yml)
   builds the ZIP, the versioned ZIP copy, checksums, body and guides as a **draft**.
9. **Finish the draft** ([releases page](https://github.com/UnsctMagic/MDLxL/releases)).
   Attach `MDLxL-FFmpeg-corresponding-source.zip`, copied from the previous release if
   `electron/ffmpeg/` is unchanged. Check every link in the body exists as an asset.
   Unzip the CI ZIP and run a few key tests on it (`MDLXL_SUITE_PKG`, variant `release`).
10. **Website.** Put `<version>.json` in LowPolyWorks at `dist/mdlxl/releases/` on
    `main` and `mdlxl/releases/` on `gh-pages`. The two branches have drifted, so edit
    each one's own file and never copy one over the other. For large uploads pass
    the JSON with `gh api --input <file>`.
11. **Publish** (needs approval):
    `gh release edit v<version> --draft=false --latest`. Publishing triggers the
    Discord post by the Garithos bot.
12. **Verify the public result.** Download the public ZIP and compare its SHA-256 by hand
    (the `.sha256` file has Windows line endings). Check `releases/latest`, the website
    post, all six language links and that the Discord post is not cut off.
13. **Tidy up.** [Archive finished sessions](AUTO_UPDATES.md#after-publishing-archive-finished-sessions),
    remove the finished worktree after deleting its junction, and update the
    [task table](agent-tasks/README.md).

### Hotfix path

Same steps, except: fix + targeted tests only, no full suite; run the targeted tests on
the unzipped CI ZIP; only the guides the fix affects; no updater gate unless the updater
changed.

## 8. The report

**To the owner:** plain language, readable in 10 seconds, no file names or test names.
One line on the result, 2–4 short bullets (what works, what broke, what got fixed), one
line on what is left.

```text
Everything I could test works, except one thing still needs you.
- Clicked every button in all 7 languages and on a slow PC: no crashes.
- Found and fixed: the Particle window stayed stuck open after Esc.
- Not tested: 3 checks need a model that isn't on this PC.
Saved on your PC, not online. Say "merge" when you're happy.
```

**For the next AI:** `out/qa/<date>/report.md`, plus a
[task note](agent-tasks/README.md) if work continues:

- revision, package path and the setups and variants covered
- counts run, passed, failed and skipped, with the reason for each skip
- each failure: class, evidence, fix or status
- each QA finding: rating, setup, exact click path, screenshot
- what was not covered and why

Do not paste long logs, credentials or private models into the repository.

## Keep this kit current

Any AI that learns a new lesson while testing or releasing adds it to the right section
here, so it is not trapped in one tool's private memory. Keep this file a procedure.
Commands and details belong in the linked guides.
