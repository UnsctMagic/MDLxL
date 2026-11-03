# View parity and vertices through materials

Status: ready for review; awaiting merge approval
Owner / consolidator: Codex
Updated: 2026-11-03

## Goal and completion criteria

- Keep View consistent between ViS and XL for each editor, and allow Bones to be disabled in Vertex Manager.
- Keep vertex dots visible through all mesh materials with Grabthrough or X-Ray; expose the existing X-Ray preference in View.
- Preserve model data, material appearance, independent display choices, compact layout and mouse camera controls. No release or installation changes.

## Revision and local state

- Branch: `codex/view-vertex-bugs`; base `356bb4ad8004a8e24e7e0f9898a0a5217d239694` (main / #524). Original reproduction used fa81f005; rebased after #521/#524 to retain the accepted Bones/Helpers context menu, master and subtype choices.
- Working copy: `D:/Codex/view-vertex-bugs-20261103/MDLxL`; disposable worktree removed after pushing.
- Video: owner recording `2026-11-03 08-57-56.mp4`; Grabthrough was already checked.
- Real fixture: `fixturePath('archer')`, the permanent collection's `material-fixture/Mecha-CL.mdx` and its textures.
- Small evidence: `D:/Codex/view-vertex-bugs-20261103/review`; disposable package and test profiles removed after checks.

## Owners and decisions

- `src/view-menu.json` is the single native/browser View and Quick Display list for both looks. Combine the prior lists; Vertex Manager adds Bones, Attachment and the existing X-Ray preference.
- `src/useEditorDisplay.js` and `src/display-overlays.js` honor and restore ViS switches instead of forcing Bones, Helpers and Attachments on. ViS defaults and separate XL/ViS display states stay intact.
- `app/App.jsx` lets Vertex Manager render explicit overlay switches in either look; ViS retains its node manipulation controls. X-Ray uses the existing appearance preference. Clear clears it alongside RGB in Vertex Manager.
- `app/viewport-shared.js::configurePointMaterial` keeps square markers in the transparent render queue. In Classic, square dots previously drew before blended mesh layers, which covered them. Depth tests, hidden-point passes and model materials are unchanged; Paint uses the same marker owner.
- Historical ViS menu exclusions are superseded by this owner request; checkbox styling remains.

## Verification

- Fail-first, unchanged package: `view-vertex-display`, case `menu`, failed `F1: View offers the same entries in ViS and XL`.
- Fail-first, unchanged package: case `points` saw only **3,621 / 4,957** projected vertex targets with Grabthrough on in Classic. The first patched package saw **4,957 / 4,957** in both Classic and Smooth.
- Focused source: 43 passed / 0 failed / 0 skipped (`display-overlays`, `vis-mdlvis-mode`, `viewport-point-selection`, `viewport-overlays`, `compact-toolbar`, `localization-quality`, `quick-display-placement`, `viewport-materials`). Compatibility: 57 passed / 0 failed / 0 skipped.
- Built and packaged with Node 22.23.3 / pnpm. Hidden checks use explicit `no-gpu-warp`: default hidden-desktop GPU startup triggers the existing app relaunch and disconnects Playwright. No product workaround was added.
- Final focused check measures Grabthrough and X-Ray separately in both renderers, toggles Bones and Clear with real clicks, compares View in Vertices/Bones/Movement, checks authored model data unchanged and verifies the camera quaternion changes with a real Alt+left drag.
- Final integrated packaged checks: 2 passed / 0 failed / 0 skipped (`view-vertex-display`, `bones-helper-display`). All 4,957 projected vertex targets visible in each of four combinations: Classic/Smooth with Grabthrough, and Classic/Smooth with X-Ray and Grabthrough off. Authored model equality, Bones/Clear and real mouse quaternion change passed.
- Legacy ViS matrix: 0 passed / 1 failed / 0 skipped on the original baseline and pre-rebase patch. It expects zero visible model tabs; both revisions show one (unchanged pre-existing assertion). No assertion was loosened. The split-menu expected list was updated to the shared table.
- The changed compact-toolbar source assertion was also run on baseline and failed before passing on the patch. The accepted Bones subtype choices remain enabled through Clear; the packaged check excludes these stored type filters when testing visible overlays.
- Not exercised: owner's exact model file (only its video), Warcraft III, full packaged/source release suites. Claude owns independent QA before merge.

## Next action

- Review the PR linked in the Codex chat; obtain independent Claude QA and owner merge approval. No merge, release, installation or real profile change is authorized.
