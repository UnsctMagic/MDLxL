# MDL/MDX icons and persistent Select through

Status: completed — merged in PR #544; remaining Windows QA is recorded below
Owner: Codex; Claude owns independent QA
Updated: 2026-11-04

## Request and scope

Fix independently chosen MDL/MDX icons and readable format labels; remember Select through being disabled after restart. Preserve existing controls, icon styles, Vertex default on / Bones default off, unrelated preferences and Windows' user-controlled default applications. No release, installation or real-profile changes.

## Revision

Branch: `codex/icons-select-through`, based on online main `c0f71708`.
Merged into `main` as `1dc76817e75b8a487a8edf0d5dfe44df6c4abe37` on 2026-11-04 following explicit owner approval. PR #544 and the changes on online main were verified; PR CI passed. The D: task checkout and disposable packages/profiles were removed.
Evidence: `D:\Codex\mdlxl-icons-select-through-report-20261104`.

## Owners and findings

- `app/App.jsx` previously initialized Grabthrough to `{vertices:true,bones:false}` on every launch. It now reads and writes `preferences.grabThroughByEditor` through the existing preference store. `src/preferences.js` preserves each boolean independently, including false.
- `electron/file-types.cjs` already registers separate `MDLxL.MDL` and `MDLxL.MDX` icons. Its warning check only recognized the legacy `MDLxL.Model` default, missing `Applications\MDLxL.exe` from Open with. It now detects both, case-insensitively.
- Windows shared ProgIDs have only one icon and cannot express independent format icons. The user must choose MDLxL for both extensions in Windows Default apps. No UserChoice hashing, deletion or silent reassociation. Reference: https://learn.microsoft.com/en-us/windows/win32/shell/default-programs and https://techcommunity.microsoft.com/blog/askperf/how-to-configure-file-associations-for-it-pros/1313151.
- `app/Settings.jsx` explains this constraint and the existing button; rechecks the warning on window focus after returning from Windows settings. RU/ES/ZH/FR/DE strings updated.
- `scripts/build-file-icons.py` omitted letters at 16/24px; 32px page labels were barely readable. Small label bands now use crisp pixel letters; all ten labelled ICOs regenerated. Unlabelled and program choices remain unchanged.

## Verification

- Baseline packaged test failed: `Vertex Select through stays disabled after restart`, actual true / expected false.
- Shared-icon packaged test with the old backend failed waiting for the visible shared-icon warning under `Applications\MDLxL.exe`.
- Baseline artwork check failed: `page 16px: MDL and MDX must have different visible letter shapes, not only different colours`.
- Final `pnpm run build` and `node scripts/package.mjs --out out/pkg` succeeded; packager verified 1,430 runtime/assets and 55 locale files.
- `node scripts/run-packaged-tests.mjs default icons-select-through,file-icons-registration`: 2 pass, 0 fail, 0 skip on the hidden Windows desktop. Real mouse clicks and keyboard shortcuts; two restarts; Vertex off and Bones on then off; all 18 choices; Settings -> IPC -> separate registry icon values; shell notification; Default apps button; warning clears after simulated OS reassociation. The registration test replaces only registry/notification/open-settings I/O in a disposable package, not the settings or registration logic. It does not prove live Explorer behavior.
- `node --test test/file-types.test.js test/preferences.test.js test/desktop-settings.test.js test/localization-catalogs.test.js test/localization-current.test.js`: 38 pass, 0 fail, 0 skip.
- `python test/file-icon-art.py`: all 35 style/size pairs have distinct white letter shapes. Native-size and enlarged sheet inspected.
- React review: uses the existing preference owner, functional updates preserve other settings, focus listener cleans up, late responses after unmount are ignored, existing accessible labels and controls preserved.

## Remaining QA

Claude should rerun focused checks and confirm real Windows Explorer icons on a disposable Windows user/VM: choose different labelled MDL and MDX styles, confirm each file type is associated with the matching registered MDLxL ProgID, inspect small/medium/large icon views, and reselect defaults from the shared legacy/Open-with state. Check returning to the open Settings window clears the warning. Real Windows defaults and the installed app were deliberately not modified during this task. Full suites and Warcraft III were not run; neither model data nor rendering controls changed.

Merge completion does not claim independent Claude QA or live Explorer acceptance. No release or installed-app upgrade was performed.
