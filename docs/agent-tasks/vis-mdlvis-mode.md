# VIS stays MDLVis

Status: completed implementation; ready for review; awaiting merge approval
Owner / consolidator: Codex; written by Claude Code
Updated: 2026-10-26

## Goal and completion criteria

The owner's rule: **VIS is VIS inside MDLxL.** The VIS button switches the
*user interface only* to a minimal look that resembles MDLVis. It never changes
model data, tools' results or saved files. New-look and responsive behaviour
must not leak into VIS.

Done means, with VIS on, at every window size:

- No model tabs and no editor-module buttons (Vertices/Bones/Movement/
  Animations/Paint/Showcase). Editors are reached the MDLVis way (menus,
  existing keys), as VIS already did before the new look.
- Visibility shortcuts are the classic VIS checkboxes from
  [vis-view-menu.json](../../src/vis-view-menu.json), with their VIS names,
  order and keys. No icon chips, no new-look styling, no shrinking to icons
  or first letters, no other responsive compaction.
- None of the new-look rules, labels or measurements apply. VIS looks the
  same as the last release before the new look (`v0.30.1`) unless the owner
  approved a VIS change since (example: the AI icon beside XL, 0.31.0).
- Turning VIS off restores the new look exactly as it was (tabs, chips,
  PR #321's letter shortening on overflow).
- Out of scope: any change to the new look itself, model data, menus'
  contents, or adding VIS features MDLVis doesn't have.

## Revision and local state

- Base: latest `main` at `de08162e` when this task began (PR #323).
- Branch: `codex/vis-mdlvis-mode`.
- Integrated newer main `a4c86621` (PR #304) after it landed during the task;
  retained its Shredder/LER, shortcut and new-look dock changes. Repeated the
  packaged checks and compared VIS-off against a matching current-main build.
- PR: [#324](https://github.com/UnsctMagic/MDLxL/pull/324).
- All work and disposable test data used `D:\Codex\mdlxl-vis-mdlvis-20261026`;
  installed apps and real profiles were not changed.

## Relevant owners

- [AppToolbar.jsx](../../app/AppToolbar.jsx): editor row, `editorRow` +
  `useLayoutEffect` that sets `data-short-editors` (added by PR #321), Quick
  Display wiring (`vanilla={visUI}`), VIS toggle.
- [QuickDisplay.jsx](../../app/QuickDisplay.jsx): chips vs VIS checkboxes.
- [portrait-view.css](../../app/portrait-view.css) lines ~34-44: what VIS hides.
- [modules.css](../../app/modules.css): classic/shared rules, incl. the
  unscoped `data-short-editors` rules from PR #321.
- [new-look.css](../../app/new-look.css): everything here must stay scoped
  to `:not([data-vis-ui])`.
- Map row: "Main window look" in [agent-map.md](../agent-map.md); related
  note [new-look.md](new-look.md).

## Packaged comparison and decisions

Compared packaged `v0.30.1` (`af1d0f12`) and the starting main build on the
hidden Windows desktop, in Vertices, Bones, Movement and Animations at
900x760, 1100x760 and 1920x1080, with VIS on and off. Differences found:

| Starting main in VIS | v0.30.1 / resulting VIS |
| --- | --- |
| AI/XL dock in the first toolbar row; 24px buttons | Dock restored to the right of the second row; classic 46px buttons |
| Team colour before Hide/Show | Team colour restored after Hide/Show |
| DPI/Scroll in the status bar | DPI/Scroll restored to the toolbar's right edge |
| Editor name/key hint removed from status bar | Classic editor hint restored in VIS only |
| PR #321 measures the editor row in VIS; its CSS applies there | Remove the attribute and return before measuring/observing; scope all three shortening rules to `:not([data-vis-ui])` |
| AI icon added since v0.30.1 | Owner-approved: retained beside XL, with the classic dock styling |

No visible tabs, editor buttons, icon chips or shortened checkbox names were
found in VIS in the starting package. The checkbox styles, names, order, keys,
sidebars and remaining chrome matched v0.30.1. New-look SVGs are now omitted
from VIS Quick Display markup as well, rather than merely hidden by CSS.

The classic VIS list is the JSON list with the existing Bones/Attachment
shortcut exclusions. Both versions deliberately force Bones, Helpers and
Attachments visible in VIS (`App.jsx`, introduced before v0.30.1 in PR #254).
The existing menu entries remain untouched. The owner explicitly confirmed
preserving v0.30.1's working VIS checkbox list. No VIS visibility feature is added.

Only presentation owners changed: AppToolbar, QuickDisplay, portrait-view.css,
modules.css, and the status-bar presentation in App. The model, command handlers,
menus, viewport behavior and separate XL/VIS display state retain their existing
implementation. With VIS off, all 12 captured layout/style snapshots match the
starting main build exactly, including PR #321's overflow shortening.

## Verification

- [Source regression](../../test/vis-mdlvis-mode.test.js): executes the actual
  layout effect with width getters that fail if VIS reads them, checks observer
  cleanup/restoration in XL and CSS scoping; renders both Quick Display variants
  for all four editors and checks checkbox labels/actions/order/state and icons.
- [Packaged regression](../../test/vis-mdlvis-mode.electron.cjs): run through
  `pnpm run test:packaged default vis-mdlvis-mode` on the hidden desktop.
  Checks all 24 editor/size/look combinations, complete screenshot matrix,
  real Alt + left-mouse drags, no VIS width reads or clipped names, the original
  checkbox click/key bindings, and restored XL tabs/chips/shortening.
- Model JSON, serialized MDX bytes, revision and undo history unchanged through
  toggles, shortcut interactions and camera drags. Actual XL and VIS saves of a
  disposable fixture also produce identical bytes; original input hash
  unchanged. The open AI console and an unsent prompt also survive VIS/XL toggles; the dock stays mounted and only moves through VIS CSS.
- `pnpm test`: 57 passed, zero failures.
- `pnpm run test:source`: 1,981 passed, 22 existing skips, zero failures.
- Focused toolbar/VIS/dock source checks: 16 passed.
- Build/package verification passed; no renderer errors in the packaged matrix.
- PR CI: [checks](https://github.com/UnsctMagic/MDLxL/pull/324/checks). No merge or release authorized.

The Windows toolchain used existing dependencies through a junction. Script
runs disabled pnpm's automatic pre-run reinstall for that junction; no project
configuration or dependency files changed. Test builds/profiles/runtimes are
removed after verification; only the small report, logs and two comparison
images are retained under the task's `report` directory.

## Owner click-through

1. Open a model, click VIS, and resize around 900px, 1100x760 and a wide window.
2. Use Modules / F1 and F3 to visit Vertices, Bones, Movement and Animations.
   Check the classic checkbox row, absent tabs/editor buttons, AI beside XL,
   top-right DPI/Scroll and bottom-right editor hint.
3. Alt + left-drag the preview to rotate. Click a visibility checkbox or use
   its existing hotkey, then switch editors and return.
4. Click XL. Check that model tabs, editor buttons, icon/name chips, status
   controls and overflow initials return. Save and reopen if desired.

## Next action

Ready to test / ready for review; awaiting the owner's merge approval.
