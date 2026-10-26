# One-click Auto Corpse

Status: ready for user testing and PR review; awaiting merge authorization
Owner: Codex
Updated: 2026-10-23

## Goal and scope

One click in the VIS toolbar row fits a substantial corpse beneath the literal
last Death pose, creates/reuses flesh and bone decay, handles sinking and
visibility, and supports Undo without adding a panel. Study 100 Warcraft models.
Wisp/Statue-style effect deaths are excluded. User specifically rejected thin
rig-centerline corpses: respect actual body width and silhouette, including
large Ogres. The approved prior lane's body/corpse alignment is the reference.

## Revision

- Branch: `codex/auto-corpse-placer`, base `683037ee`.
- Review: [PR #276](https://github.com/UnsctMagic/MDLxL/pull/276), unmerged.
- Working checkout: `D:\Codex\mdlxl-auto-corpse-20261023\repo`.
- Test build: sibling `outputs\MDLxL-win32-x64`; no installed app replaced.
- Session: codex codex://threads/01a165fc-409d-7423-ad0f-6d448c018b84
- Prior reference: codex://threads/01a16405-f577-7420-b22f-b84a2ab9a18b

## Owners and decisions

See [Auto Corpse](../AUTO-CORPSE.md) for source ownership, behavior, reproduction
and known boundaries. Do not introduce sliders or a permanent result panel.
Do not simplify the corpse back to thin joint segments: Blizzard often binds
the visible skin to mesh children, and measuring only the control nodes loses
body width. Keep full joint lengths and body-derived widths independently.

## Verification state

- Focused corpse/animation/localization tests: 23 passed. Compatibility: 57 passed.
- Full source suite: 1858 passed, 21 environment skips, no failures. Required
  test-baseline gate passed with no baseline changes.
- Actual portable button, native MDX/MDL Save As, Undo/Redo, repeat click, hidden
  window and normal mouse camera rotation passed.
- 100 unique Warcraft III SD models studied; 95 physical terminal poses passed
  the corpus verifier. Wisp and Statue are excluded as requested. Frost Wyrm,
  Red Dragon and Red Dragon Whelp shrink to 0.001 on their last Death frame;
  these are reported atomically instead of generating almost invisible corpses.
- All 95 passed MDX reopen; 90 passed MDL reopen. Five untouched native inputs
  already fail MDL save with `Cameras[0].Variant`; the verifier confirms the
  identical pre-existing error. Evidence: `docs/research/auto-corpse-models.json`.
- Initial corpse vertices are checked above terrain, including Death meshes
  that penetrate the floor; burial occurs only during the decay phases.
- Final packaged body/corpse pairs reviewed on Footman, Ogre and the referenced
  Tzeentch warrior. Native Footman/Ogre atlas comparisons informed limb mapping.
- Portable runtime audit: 580 runtime/assets, 55 locales, no duplicated dependencies.
- Warcraft III gameplay has not run. Visual fitting is ready for user testing,
  not universal artistic acceptance.

## Next action

Test `outputs/START AUTO CORPSE TEST.cmd`, then CORP in the VIS row. See the
adjacent verification report and body-versus-corpse image. The test launcher
uses its own D: profile; the installed app and personal data were not changed.
Await explicit merge authorization. Do not merge or publish a release silently.
