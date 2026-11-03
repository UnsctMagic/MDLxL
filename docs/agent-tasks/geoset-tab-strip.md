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
- Build, 29 focused geoset source checks and 57 compatibility checks pass, zero
  failures/skips. Packaged workflow and combined build verification are in progress.

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
- Claude QA, owner visual approval and Warcraft III playback remain separate gates.

## Next action

Finish focused verification, open the feature PR into main, and provide one
combined test package with the verified Compact Set revision. No merge authorized.
