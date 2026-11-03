# Compact Set and geoset visibility

Status: completed; PR #528 merged with owner approval on 2026-11-03 at 567dcce3b7c82cfe42f553d3cf0ffb16a6fc23e2
Owner / consolidator: Codex
Updated: 2026-11-03

## Goal and decisions

- The approved compact grid is the default for new and older profiles. Appearance → Interface offers `Compact Set` and `Classic Set`, plus an editable Compact Set color. Every appearance preset owns its default color; Lordaeron uses light blue `#71b5f3`. Both the full Appearance preset and Interface Color set must apply that color. VIS displays Classic Set automatically, preserving the chosen style and color for returning to XL.
- Geoset right-click removes Select all/Invert, adds `Hide Geoset`, and renames the prior visibility action to `Show Always`. The background menu and All/Clear controls retain their existing jobs.
- Show Always persists independently of selection and Show all. Hide Geoset keeps its list entry, suppresses drawing/edit selection even with Show all, and can be toggled off in the same menu. Enabling either visibility override clears its opposite. Group visibility and Hide extras keep their existing priority.
- These are editor view states, not authored model visibility tracks. Preserve undo/redo, model-tab state, topology remapping, resizing, normal mouse rotation and the user's viewpoint.

## Revision and owners

- Base: `a27d05536d5454a1ec8c405415f3379c59baa2b0`; branch `codex/compact-geoset-set`; [PR #528](https://github.com/UnsctMagic/MDLxL/pull/528).
- Working checkout: `D:\Codex\mdlxl-geoset-color-vis-20261103`. Dependencies are a junction to the existing D: checkout. C: source and installed/user profiles are untouched.
- Picker/menu/view state: `app/AppSidebar.jsx`, `app/geoset-set.css`, `app/AppDialogs.jsx`, `app/App.jsx`, `src/selection-history.js`.
- Appearance: `src/viewport-appearance.js`, `src/preferences.js`, `app/theme.js`, `app/Settings.jsx`.

## Verification and continuation

- Fail-first source proof: `test/compact-geoset-set.test.js` fails on the old default (`actual: undefined`, `expected: 'compact'`), custom-set persistence, and selected Show Always history. Logs live outside Git under the task directory.
- Focused source checks: 87 passed / 0 failed / 0 skipped, covering preferences, appearance, geoset selection/highlight/extras/tabs and selection history. Compatibility suite: 57 passed / 0 failed / 0 skipped.
- The older selection-history expectation stripped pins from selected geosets. Its assertion changes because Show Always now persists through selection, as requested; selected pins are covered by the new fail-first case.
- Packaged startup diagnosis: Playwright can report a disposable `about:blank` target before Electron has any BrowserWindows. Wait for the actual `file:` editor target and then use the existing `prepareWindow`; do not change production startup to accommodate the test.
- Packaged old-code proof: the corrected real-window harness fails on the original renderer at `Compact Set is the default for an existing profile` (`0 !== 1`). Older custom-preset migration also failed first with Blackrock getting `#71b5f3` instead of `#ff8a00`.
- Packaged checks: `compact-geoset-set.electron.cjs`, `geoset-leave-visible.electron.cjs`, `geoset-tabs.electron.cjs`, and `geoset-preset-colors-vis.electron.cjs`: 4 passed / 0 failed / 0 skipped on the corrected combined package. Inputs are real clicks, mouse rotation and keyboard commands; probes only read state. The Compact/Classic checks use the permanent real flail fixture through `test/helpers/fixtures.cjs`.
- Verified: number-only selection with a light-blue glow, configurable color and preset switching, Classic checklist, hidden entry retained in the list, actual Viewport drawing disabled after Hide (including hover with Highlight Geoset on), Show Always independent of selection, Vertices/Movement behavior, history, model-tab restoration, unchanged model bytes/dirty flag, retained viewpoint and actual mouse rotation. The existing tab check also verifies metadata save/reopen and unchanged panel dimensions.
- Replaced the obsolete deselect-on-pin test with real-input checks of the requested independent Show Always state, including Classic Set and model-tab restoration. Hidden view flags follow existing geoset index remapping. Model-authored animation visibility remains unchanged.
- Rebased onto current upstream `a27d0553`. Resolved only the project-map overlap, retaining the incoming Animation Speed / Playback Speed guidance alongside the new Compact Set owners. The upstream viewport display fix remains intact; focused checks are repeated on the rebased renderer before handoff.
- Coverage limits: independent Claude QA, full packaged release suites, Warcraft III and installed-app testing were not exercised. The owner authorized merging after the combined test handoff; CI passed. No tag, release or installation is included.
- Handoff: push/open PR, attach it to the chat, and delete the disposable package, profiles, baseline and finished D: checkout after verifying the pushed revision. Keep the small report/logs outside Git.
- Owner authorized merging on 2026-11-03. PR #528 is merged; no release or installed-profile update was requested.

## Owner correction: preset color paths and VIS

- Proven mismatch in the owner-test profile: Durotar interface with Lordaeron's
  `#71b5f3` Compact Set color. Interface Color set changed only theme/accent;
  full Appearance preset applied the complete color bundle.
- Interface Color set now includes the preset's Compact Set color. A custom
  Compact Set color marks this color set Custom. Switching colors preserves the
  chosen Compact/Classic style and all unrelated viewport settings.
- GeosetPicker renders Classic Set whenever VIS is active. Leaving VIS restores
  the selected style/color without rewriting the saved appearance preference.
- New `geoset-preset-colors-vis.electron.cjs` covers every one of the seven presets
  through both real UI paths, actual grid CSS colors, custom colors, VIS round trips,
  viewpoint preservation and normal mouse rotation on the permanent real flail.
- Old-build proof: `Interface Durotar loads its own Compact Set color` fails with
  actual `#71b5f3`, expected `#b8bb26`; `VIS automatically uses Classic Set` fails
  with `1 !== 0`. Logs are in this task's `out/reports` until the final handoff.
- The corrected owner test package must still include the Photoshop-style tab
  strip from PR #529. The existing running test package/profile remain untouched.
- Correction verification: the new packaged workflow passes every preset via both
  pickers, actual grid colors, VIS round trips, saved style/color, viewpoint and
  real mouse rotation. Source checks: 87 passed; compatibility: 57 passed; zero
  failures/skips. The corrected combined package passed all 4 packaged workflows.

- Corrected owner build: `D:\Codex\mdlxl-geoset-tabs-20261103\review-v2\MDLxL-win32-x64`; run `Start test.cmd`. Runtime integration: `c616d86009d329dfffcf300b0f8c2e82959f4f2e`. The older build/profile were not modified. Source checkouts are removed after the pushed handoff.
