# Geoset tab strip

Status: completed with owner approval on 2026-11-03.

- [PR #529](https://github.com/UnsctMagic/MDLxL/pull/529) merged at `7240caee2d46ebe4102c3d8379b7e1d958ed2063`.
- Compact Set, preset colors and the VIS override shipped in [PR #528](https://github.com/UnsctMagic/MDLxL/pull/528), merged at `567dcce3b7c82cfe42f553d3cf0ffb16a6fc23e2`.
- Both merged PRs and their owning code were verified on online `main`.

## Result and ownership

The Geosets dropdown is replaced by the approved Photoshop-style strip. Full tabs
fit without clipped fragments, the active tab stays visible, and overflow contains
only tab names. New (+) and Tab actions live in the existing Geosets heading and
follow the panel when floating or docking.

`app/GeosetTabs.jsx` and `app/geoset-tabs.css` own the strip, menu and dialogs;
`app/AppSidebar.jsx` provides explicit header portal targets. The existing dismissal
and Hotkeys claim APIs own popup keys. Home/End navigate tabs without invoking Fit.
The dismissal callback restores focus only for keyboard dismissal.

Sidebar width, list height/resizing, selection/assignment, visibility, camera
controls/viewpoint, model codecs and the existing MDL/MDX annotation format remain
unchanged. Compact Set and its seven preset colors coexist with the tab strip;
VIS displays Classic Set and restores the chosen style/color when leaving VIS.

## Verification

- The old dropdown fails at `Geoset tabs are a visible tab strip` (`0 !== 1`).
- Combined package: `geoset-tabs`, `compact-geoset-set`, `geoset-leave-visible`,
  `geoset-preset-colors-vis`: 4 passed, 0 failed, 0 skipped.
- Focused source: 87 passed; compatibility: 57 passed; no failures/skips.
- Merge-time keyboard source check: failed before the callback correction, then
  2 passed, 0 failed, 0 skipped. The affected packaged tab workflow was rerun on
  the final merged candidate and passed. Both feature PRs had passing CI at merge.
- Real flail fixture unchanged. Checked actual mouse rotation and retained viewpoint,
  all tab actions, overflow/keys, Escape/outside dismissal, floating/docking,
  assignment/history, visibility, both color pickers, VIS, MDL/MDX save/reopen.
- Independent Claude QA, full packaged release suites, Warcraft III and installed-app
  testing were not performed. The owner explicitly authorized these merges.

## Retained owner test build

`D:\Codex\mdlxl-geoset-tabs-20261103\review-v2\MDLxL-win32-x64` remains available;
run `Start test.cmd`. Its separate profile and the older owner test build/profile
were preserved. No installation, release or version bump was requested.

Disposable merge checks/builds/profiles and the finished checkout are removed;
small results remain in `D:\Codex\mdlxl-geoset-merge-report-20261103`.
