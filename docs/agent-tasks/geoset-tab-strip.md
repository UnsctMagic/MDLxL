# Geoset tab strip

## Goal and accepted design

Replace the Geosets dropdown with the approved Photoshop-style strip. Keep the
sidebar width and geoset list, put New (+) and Tab actions in the existing header,
and use a separate overflow menu for tab names. Keep create, assignment, rename,
delete, visibility and the existing MDL/MDX annotation format.

The owner requested testing this together with Compact Set (PR #528), from
`codex/compact-geoset-set`. Do not offer a tabs-only build for owner testing.
The owner explicitly approved this task's C: checkout; disposable outputs are on D:.

## Current state

- Branch: `codex/geoset-tab-strip`; starting revision `356bb4ad`.
- Owners: `app/GeosetTabs.jsx`, `app/geoset-tabs.css`, header slots in
  `app/AppSidebar.jsx`. The header uses an explicit portal target and the existing
  dismissal hook. Full tabs fit without fragments; the active tab stays visible.
- No model codec, viewport or geoset-selection changes in this feature.
- Ready for review; awaiting merge approval. No merge or installation authorized.
- Tabs-only packaged workflow passed on the real flail model. On the combined
  package, all 3 focused packaged workflows pass (`geoset-tabs`,
  `compact-geoset-set`, `geoset-leave-visible`), plus 87 source checks and 57
  compatibility checks, zero failures/skips. This is Codex verification; Claude QA
  and the owner's visual acceptance remain pending.
- Combined runtime is based on integration revision `1d96f95d75483e187f2c0fc5275c30662fe1077c`,
  including Compact Set `05d7e80158e727a3bc00375e23b04b90607f7092` (PR #528).
- Owner build: `D:\Codex\mdlxl-geoset-tabs-20261103\review\MDLxL-win32-x64`.
  Launch `Start test.cmd`; its separate profile leaves the installed app untouched.

## Verification

- Updated `test/geoset-tabs.electron.cjs` uses the permanent real flail fixture and
  real clicks, wheel and keys, replacing its old forced focus and synthetic wheel.
- Fail-first: the existing packaged dropdown fails at
  `Geoset tabs are a visible tab strip` (`0 !== 1`).
- The packaged workflow also exposed Home reaching the global Fit command. Tab
  and menu navigation now claim their keys through the existing Hotkeys API.
- Logs: `D:\Codex\mdlxl-geoset-tabs-20261103\reports`.
- Preserve create/move/rename/delete, context assignment, undo/redo, filtering,
  eye visibility, MDL/MDX saves/reopen, list dimensions, camera rotation and viewpoint.
- The final combined tab check also verifies the header controls after floating
  Geosets and docking it again. Appearance and visibility checks exercise both
  Compact Set and Classic Set.
- Claude QA, owner visual approval and Warcraft III playback remain separate gates.

## Next action

Owner: test the combined package. Claude: independently rerun focused QA. Merge
only after explicit owner approval; test package is intentionally retained.
