# Manager access and polish

Status: active; first visual pass awaiting owner review
Owner: Codex, Manager polish chat
Updated: 2026-10-28

## Goal and scope

- Add Manager after Animations and before Paint, opening Materials directly.
- Polish the existing managers in MDLxL's own visual language, taking cues from
  Library. Preserve working controls, previews, layout and existing sidebars.
- Keep the UI uncluttered. Use visual interaction where it helps; do not replace
  previews with coordinate forms or explanatory text.
- Later in this same task: add Model for model name, standard saved model
  comments, and visual collision sphere/box editing using existing controls.
- The owner chose tabs, rejected replacement mockups, and asked to see a small
  real-app polish pass before proceeding further. This is that first pass.

## Revision and owners

- Branch: `codex/manager-schemes`; base: `dc60ad3d`.
- Draft PR: https://github.com/UnsctMagic/MDLxL/pull/363 (unmerged).
- D: working checkout: `D:\Codex\mdlxl-manager-schemes-20261028\source`.
- `app/AppToolbar.jsx`: editor-row Manager entry.
- `app/ResourceEditors.jsx`: existing window and manager navigation.
- `app/ResourceDetails.jsx`: existing texture/geoset previews, unchanged.
- `app/resource-managers-xl.css`: manager-specific styling using existing tokens.
- Reference: [Resource managers](../RESOURCE-MANAGERS-XL.md).

## First pass

- Manager opens the existing Materials dialog; reopening also starts there.
- The existing eight managers share accessible tabs and existing theme styling.
- Removed the resource-list heading that repeated the selected tab.
- Library-like tabs and quieter section borders retain the existing controls,
  window layout, list widths, and custom node-tree colors.
- Existing texture and collapsible geoset previews are unchanged.
- No version, installed application, real profile, or user model changes.

## Verification and next action

- Production build passed.
- Existing manager simplification and appearance/theme suites: 15 tests passed.
- Background Electron verification uses the production bundle and disposable
  profile. Entry position, Materials reopening, all eight manager tabs, all
  seven palettes, 1000px tab wrapping, actual mouse rotation and a hidden window
  all passed. Results and actual-app capture are kept in the task directory.
- Review the actual first-pass screenshot before continuing visual changes.
- Model manager, collision manipulation, comments persistence and packaged-app
  acceptance are still pending. The current patch does not claim those features.
- MDX comment representation remains to be verified; do not invent a private
  metadata format or silently discard text on format conversion.
