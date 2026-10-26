# VIS stays MDLVis

Status: active (contract for Codex)
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

- Base: `main` at `85c38382` (merge of PR #321).
- Branch: start `codex/vis-mdlvis-mode` from current `main`.
- No uncommitted work or fixtures needed.

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

## Findings and decisions

- Verified (code, `85c38382`): VIS CSS already hides model tabs and editor
  buttons (`portrait-view.css` lines 34-35), and Quick Display uses the VIS
  menu in VIS. So PR #321's letter shortening is not visible in VIS today.
- Verified: PR #321's measuring still runs in VIS and its
  `data-short-editors` CSS in `modules.css` is not scoped away from VIS. Any
  later change that shows a button in VIS would show the letters. Make the
  effect skip VIS (`visUI` true: don't measure, remove the attribute) and
  scope the CSS to `:not([data-vis-ui])`.
- Uncertain: the owner reports VIS currently differs from MDLVis (tabs,
  visibility shortcuts). Not seen by Claude in the running app. Codex must
  look at VIS in the packaged app before and after, side by side with a
  `v0.30.1` build, and list every difference found, then fix each one that
  isn't an owner-approved VIS change.
- Decision: follow AGENTS.md (no new panels/controls, one way of doing
  things). Fixes are removals/scoping, not new UI.

## Verification required

- Source test (new or extend [quick-display-placement.test.js](../../test/quick-display-placement.test.js)):
  with VIS on, no `data-short-editors`, no model tabs/editor buttons
  visible, Quick Display shows the VIS checkbox list per editor.
- Packaged app on a hidden desktop (never pop windows on the owner's
  screen): VIS on at narrow (~900px), 1100x760 and wide widths, in Vertices,
  Bones, Movement and Animations; then VIS off at the same sizes. Screenshots
  of each, compared with `v0.30.1`.
- Mouse camera rotation still works in the VIS preview (real drag).
- `pnpm test`, `pnpm run test:source`, PR CI green.
- PR into `main` with `Session: codex <task>`; report `ready to test` with a
  short click-through for the owner.

## Blockers and next action

- None. Next: Codex branches, audits VIS against `v0.30.1`, fixes, verifies,
  opens the PR.
- On completion: mark this note completed with the PR, remove its row from
  [README.md](README.md).
