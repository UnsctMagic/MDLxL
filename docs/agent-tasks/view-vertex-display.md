# View parity and vertices through materials

Status: completed — merged in [PR #525](https://github.com/UnsctMagic/MDLxL/pull/525) at `b012359f5d8c9be880a85b5dd136485fc635248a`.
Owner / consolidator: Codex
Updated: 2026-11-03

## Goal and completion criteria

- Keep View consistent between ViS and XL for each editor, including a working Bones switch in Vertex Manager.
- Keep vertices visible through mesh materials when the existing Grabthrough is enabled.
- Owner correction: no added X-Ray control. Remove this task's X-Ray menu/shortcut, command, tooltip, translations and Clear behavior. The original Appearance setting is unchanged.
- Preserve authored model data, materials, viewpoint, normal mouse controls and the accepted Bones/Helpers context menu and type choices.

## Revision and local state

- PR: [#525](https://github.com/UnsctMagic/MDLxL/pull/525), merged after explicit owner approval and green CI on `7def1b3e52d3e6a6a84ceb6314e7230deba70a50`.
- Branch: `codex/view-vertex-bugs`; base `356bb4ad8004a8e24e7e0f9898a0a5217d239694` (main / #524). Original reproduction used fa81f005; integration retained #521/#524.
- Disposable worktree: `D:/Codex/view-vertex-bugs-20261103/MDLxL`, removed after pushing.
- Evidence: `D:/Codex/view-vertex-bugs-20261103/review`; packages and test profiles removed after verification.
- Real fixture: `fixturePath('archer')`, the permanent collection's `material-fixture/Mecha-CL.mdx` and textures. The owner's recording shows Grabthrough already checked.

## Owners and decisions

- `src/view-menu.json` is the single native/browser View and Quick Display list. ViS and XL offer the same entries for each editor.
- `src/useEditorDisplay.js` / `src/display-overlays.js` honor ViS switches. Independent XL/ViS display choices and defaults remain.
- `app/App.jsx` lets Vertex Manager show explicit overlays in either look. ViS node manipulation and the combined Bones/Helpers control are retained.
- `app/viewport-shared.js::configurePointMaterial` draws square vertex dots after blended model layers in Classic. Model material definitions, depth tests and hidden-point passes are unchanged; Paint uses the same marker owner.
- No additional through-mesh control is introduced. Grabthrough already shows and selects vertices through meshes.

## Verification

- Original fail-first: View parity assertion failed on fa81f005; Classic showed only 3,621 / 4,957 projected vertex targets with Grabthrough enabled.
- Owner correction fail-first: unchanged PR head 62e1f933 failed `View has no separate X-Ray control` before removing the extra control.
- Focused source after removal: 43 passed / 0 failed / 0 skipped across display, menus, marker materials, compact toolbar and localization checks.
- Previous compatibility run: 57 passed / 0 failed / 0 skipped; no model codec or compatibility changes were made in this correction.
- Final build and package passed. Hidden packaged checks `view-vertex-display` and `bones-helper-display`: 2 passed / 0 failed / 0 skipped. Grabthrough alone shows all 4,957 / 4,957 targets in both Classic and Smooth.
- The packaged regression checks that View and display shortcuts have no added X-Ray control, compares ViS/XL menus, toggles Bones/Clear with real clicks, measures every projected vertex target with Grabthrough in Classic/Smooth and the appearance X-Ray setting off, verifies unchanged model data, and checks a real Alt+left camera rotation.
- Existing legacy ViS matrix failed the same zero-model-tabs expectation on both the original baseline and pre-rebase patch (actual: one). No assertion was loosened; this unrelated layout was not changed.
- Not exercised: owner's exact recorded model file, Warcraft III, full release suites, independent Claude QA. Tests run on the hidden desktop with software rendering, without taking over the user's screen.

## Completion

- Owner authorized merging. CI identified three source assertions that still expected differing ViS/XL menu lists; reproduced locally (6 passed / 3 failed), then updated only their explicit expected labels and the moved Normals lookup. Final focused checks: 52 passed / 0 failed / 0 skipped.
- [PR CI](https://github.com/UnsctMagic/MDLxL/actions/runs/41670230610) passed on the exact merged head. PR #525 was merged through GitHub at `b012359f5d8c9be880a85b5dd136485fc635248a`.
- Verified the merged PR and fetched online main: shared View includes Bones, the added X-Ray control is absent, and square vertex dots retain the blended-material draw-order correction.
- The active task-index row is removed in this documentation closeout. Disposable worktrees and test artifacts are removed; keep the small report and two captures.
- No release, installation or real-profile changes were made. Warcraft III, the exact recorded model and independent Claude QA remain unexercised.
