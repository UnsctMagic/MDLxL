# Weapon ribbon bright edge

Status: ready for owner testing; awaiting merge approval
Owner: Codex
Updated: 2026-11-03

## Goal and scope

New ribbons must start wide and bright at the weapon, fading along their emitted history. The owner requested the fix and a launched test build. No installed app, real profile, authored ribbon or original model is changed.

## Revision and owners

- Branch: `codex/ribbon-direction`; base `bc8b21935efdffdc5caa8d1ba52b8bb2a812eeac`.
- Default image owner: `src/particle-starters.js` (`RIBBON_TEXTURE`); fitting still uses `src/particle-ribbon-fit.js` unchanged.
- Real source fixture: `test/helpers/fixtures.cjs` `ribbon-attachment`, copied byte-for-byte from the owner's reported saved Knight into the permanent collection. The saved source has no ribbons; the screenshot's ribbon was unsaved.

## Finding and correction

The newest strip edge samples U=0. The previous default `Textures\RibbonNE1_White.blp` is almost transparent there, so its bright band appears detached during a fast swing. The native Blademaster texture `Textures\RibbonBlur1.blp` is bright across its entire leading edge and fades at its tail. Reuse that existing stock image. Bone binding, strip placement, motion, controls and existing authored texture references are unchanged.

## Verification

- New packaged check `test/ribbon-attachment.electron.cjs`: open the real Knight, select displayed geoset 26, select its geometry, EMTR > Add ribbon > Attack Slam > Create; inspect the actual live ribbon UVs against the real game image, preserve source geometry/bones/animation, and rotate the preview with the mouse.
- Unchanged baseline package failed: `Newest ribbon edge must be bright across most of its width; got 0.0% from Textures\RibbonNE1_White.blp`.
- Final packaged check: 1 pass, 0 fail, 0 skip; actual head bright across 100% of the width, tail 0%; real mouse camera rotation passed. Save As to a separate test copy preserves geometry, bones and animations.
- Focused source checks: 32 pass, 0 fail, 0 skip (`ribbon-quick`, `particle-ribbon-fit`, `particle-assets`, `particle-preview`). Build and official package verification passed (1,422 runtime/asset files).
- Owner test build: `D:\Codex\mdlxl-ribbon-direction-20261103\test-build\MDLxL-win32-x64`; launched separately with the test Knight, EMTR open and Attack Slam playing. Real application/profile and the original source model are untouched.
- Warcraft III and independent Claude QA are not exercised here. Merge requires owner approval.
