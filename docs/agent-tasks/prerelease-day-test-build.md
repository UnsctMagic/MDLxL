# Pre-release day-test build of current main

Status: active (Codex builds; owner tests by hand for a day)
Owner / consolidator: Codex builds and hands over; owner tests; Claude merges
Updated: 2026-11-02

## Goal and completion criteria

The owner's request:

> Prepare a checklist of tests to create a LOCAL build of the most updated merge before release, so I can test it myself. I dont need a full test suite, I need it working for me to use it for a day to make sure it's good.

Done means:

1. A packaged Windows build of the newest `origin/main` sits in its own folder,
   ready to double-click, with the owner's real settings and personal files copied in.
2. The quick checks below passed. The full packaged suite is **not** run.
3. The owner gets the short click-through checklist (bottom of this note) and the
   build's folder path. Nothing is opened on their screen.

Out of scope: version bump, tag, draft release, release notes, code fixes. If a
check fails, stop and report it; do not fix it in this task.

## Revision and local state

- Build from: the newest `origin/main` at the moment you start. At writing it was
  `d505914b` (Merge PR #492, FX global animation maker), last release `v0.37.2`.
  Record the exact SHA you built in this note and in the folder name.
- Workspace: `D:\Codex\prerelease-day-test` (a `git worktree` of main at that SHA,
  detached). Link `node_modules` from the main checkout with a junction; do not copy.
- Output folder for the owner: `D:\Claude\MDLxL-TestBuilds\Main-<short sha>\`.
- Owner's real install (read-only source of settings/personal files):
  `D:\MDLxLVisButton\MDLxL-win32-x64-0.20.0\resources\app\profile\`.
  The folder name says 0.20.0 but it has been updated in place; it is the live install.
- Do not bump the version. The build reports 0.37.2; the folder name tells it apart.

## What changed since 0.37.2 (what the owner should try)

Merged PRs, grouped by what the owner will see:

- **New windows / big features:** FX global animation maker (#492);
  Sphereomancer v2 – five presets, Add sphere/square, EMTR-style handles, no black
  flashing (#507, #482); Workplane Constraints + one shared Move/Rotate gizmo (#504),
  with the orange Shift lock badge while dragging (#512).
- **Layout:** model controls in the top toolbar, model tabs at the bottom, warning
  toasts (#485); one MDLVis-based icon set (#474); Current Sequence above Rotate
  around Axis (#508).
- **EMTR / Library:** add effects the way ribbons are added, Library browsing (#491);
  textures browse in the World Editor tree and load correctly (#502, #506);
  Emitter Editor Motion tab works on models without animations (#484).
- **Editing:** live drags once per frame, no lag (#477); UV Wrapper Zoom drag in
  every direction (#494); UV Live Select Lines + Grabthrough (#468); Nuclear Weld /
  Loose parts row (#481); hidden geosets stay listed after Hide extras (#490);
  Auto Corpse raise/lower one part (#479); Bitz visibility + RGB list (#478);
  broken-keyframe model repair prompt (#480).
- **AI chat:** offload birds removed, chats per model kept (#501, #505); editor
  functions handed to jobs (#476); geosets named by list number (#462);
  every-frame animation checks (#488); short job titles (#471).
- **Behind the scenes:** only the installed copy owns double-clicked model files
  (#467); one fixed zip name from 0.39.0 (#472); updater test ping off (#460);
  test-model collection (#473, #475).

## Codex steps (all on the hidden test desktop, zero windows on the owner's screen)

Rules: never open a window on the owner's screen; launch every Electron run on the
separate hidden desktop (`WinSta0\MDLxLTests`); only stop processes whose command
line is inside your own workspace or output folder, never the owner's MDLxL.

1. **Get main.** `git fetch origin`, note `git rev-parse origin/main`, create the
   detached worktree at that SHA under `D:\Codex\prerelease-day-test`. Confirm
   `git status` is clean.
2. **Install/link deps.** Junction `node_modules` from `D:\Claude\MDLxL` (check it
   is on a current lockfile; if `pnpm install` is needed, run it in the worktree's
   own folder, never through the junction). `pnpm run fetch-ffmpeg` must verify OK.
3. **Build.** `pnpm run build`. Must finish with no errors.
4. **Quick tests (not the full suite).** `pnpm test` (compatibility, a few minutes).
   Then only these focused source tests: `node --test test/file-types.test.js`
   plus any `test/*.test.js` whose name matches the areas above
   (sphereomancer, workplane, shift-lock, global/fx, library, emtr, uv). Report
   pass/fail counts. A failure listed in `.github/known-test-failures.txt` is not new.
5. **Package to a fresh folder.** `node scripts/package.mjs --out <workspace>\pkg`.
   Never package over a folder an `MDLxL.exe` is running from (it fails silently).
6. **Check the package really has this main.** Confirm
   `resources\app\dist` files carry today's build time and that something only on
   new main is present (for example the FX global animation code from #492 in the
   bundle). Write the SHA into `BUILD-SHA.txt` beside `MDLxL.exe`.
7. **Copy the owner's real profile in.** Copy (never move) the whole
   `resources\app\profile\` folder from the owner's install into the new build's
   `resources\app\profile\`. Do not change the original. Skip `ai\codex\auth.json`
   and any other sign-in token file: the owner signs the AI in again inside the test
   build if they want to use it (a copied login goes stale and can sign the real
   install out).
8. **Smoke launch, hidden.** Start the packaged `MDLxL.exe` on the hidden desktop
   with the copied profile and check, then close it:
   - it opens without an error dialog and the main window renders;
   - a test model from `D:\Claude\MDLxL-TestModels` (for example the Footman) loads
     and the preview draws;
   - a mouse drag in the 3D preview rotates the camera;
   - Save As to a scratch path in the workspace writes a file that opens again;
   - after closing, no `MDLxL.exe` from the build is left running.
   Never delete or change anything in `D:\Claude\MDLxL-TestModels`.
9. **Double-click files stay with the real install.** After the smoke launch,
   `.mdx`/`.mdl` file associations in `HKCU\Software\Classes` must still point at
   the owner's real install, not the test build (#467). If they changed, restore
   them and report it.
10. **Deliver.** Move the package to `D:\Claude\MDLxL-TestBuilds\Main-<short sha>\`.
    Put the owner checklist below in that folder as `TEST-CHECKLIST.md`. Remove the
    worktree registration and task-made scratch files; remove the `node_modules`
    junction as a link before deleting anything. Do not open the build.
11. **Update this note** (state, SHA built, checks run with results) on the branch
    `codex/prerelease-day-test`, push, open a PR into `main` with
    `Session: codex <task name>`, and report `ready to test` with the folder path.

## Owner checklist (copy to `TEST-CHECKLIST.md` in the build folder)

Use this build for normal work for a day. Tick what works; write down what doesn't
(what you did, what happened). Your real install is untouched.

**Start**
- [ ] Open `MDLxL.exe` in `D:\Claude\MDLxL-TestBuilds\Main-<sha>\`. Your settings,
      hotkeys and libraries are there.
- [ ] Open a few of your own models (File → Open, not double-click: double-click
      still opens your real install, on purpose).

**New layout**
- [ ] Model buttons sit in the top bar, model tabs along the bottom; switching
      tabs works.
- [ ] Icons look like one set; nothing missing or blank.
- [ ] Warnings show as small toasts and go away.

**Everyday editing (most important)**
- [ ] Rotate/zoom/pan the 3D view with the mouse: smooth, feels like before.
- [ ] Move and Rotate a selection with the gizmo. Hold Shift while dragging: the
      orange lock badge shows and the move stays on one axis/plane.
- [ ] Drags feel instant, no lag on a big model.
- [ ] UV Wrapper: zoom drag works in every direction; Live Select Lines and
      Grabthrough work.
- [ ] Vertex sidebar: Nuclear Weld and Loose parts | Nuclear in one row.
- [ ] Undo (Ctrl+Z) and redo after each of the above.
- [ ] Save, close, reopen: the model is as you left it. Try it in the game/World
      Editor once.

**Feature windows**
- [ ] FX: make a global animation on a model, play it, save, reopen.
- [ ] OptimizeXL → Sphereomancer: no black flashing; pick each of the five
      presets; Add sphere / Add square; drag and remove shapes; save.
- [ ] EMTR: add an effect from the Library the way you add ribbons; drag its handles.
- [ ] Library textures: browse in the World Editor tree, textures load.
- [ ] Emitter Editor Motion tab on a model with no animations.
- [ ] Auto Corpse: raise/lower one part. Bitz: visibility + RGB list.
- [ ] Hide extras: hidden geosets still show in the Geosets list.

**AI chat (optional, uses your Codex credits)**
- [ ] Sign in, open chats on two models: each keeps its own chat.
- [ ] Ask a small job ("rename geoset 3 to Cape"): it uses the list number.

**End of day**
- [ ] Anything crash, freeze or look wrong? Note it. If all is fine, say
      "release it".

## Blockers and next action

- None. Next: Codex runs the steps above on the newest main.
- On completion: build path, SHA, check results here; owner tests; release waits
  for the owner's "release it".
