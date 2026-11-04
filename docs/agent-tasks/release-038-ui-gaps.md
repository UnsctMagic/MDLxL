# 0.38.0 screenshot UI gaps

Status: ready for Claude QA; awaiting merge approval
Owner: Codex; independent release QA: Claude
Updated: 2026-11-04

## Scope and revision

- Branch: `codex/release-0.38.0-ui-gaps`, from latest `origin/main` at `dd6fd30f38a9890e6b972bba283bf4b0e33d2703`.
- Working checkout: `D:\Codex\release-038-ui-gaps` (independent Git clone; C: source is read-only).
- Session: codex release-0.38.0 ui gaps.
- PR: [#537](https://github.com/UnsctMagic/MDLxL/pull/537), open into `main`, not merged. Implementation and screenshots: `5913304fad05e33f8c3acab5c7d8563f65719ae3`.
- Four small presentation fixes from PR #536. No version change, merge, release, installation/profile change, or full packaged suite.

## Owners and boundaries

- `plainTrackValues` exposes `ownerLabel` alongside its unchanged diagnostic label. `AppDialogs` translates the property separately and renders the authored owner with `translate="no"`.
- `particleDisplayName` translates only a recognized leading generated descriptor on Warcraft entries marked `review-needed`. Reviewed/personal names, origin/game names, source paths, stored catalog/recipe names and IDs remain data. `ParticleLibrary` uses it for row labels and the selected heading; its editable name field retains the stored name.
- All six generated colors and ten descriptor nouns have complete catalog phrases (Russian agreement and Spanish gender/plurals); 62 new keys per catalog. Totals ru/es/zh: 7912 / 7922 / 7781.
- `WorldEditorTree` translates each folder in a texture search breadcrumb through the same catalog as folder rows, recomputing on language changes. Leaf names stay literal.
- The existing loose-parts row shrinks/wraps its first label, retaining Nuclear's chip and the fixed sidebar width. FX Add emitter uses the full existing control column; narrow FX labels/buttons wrap. No sidebar widths or panel arrangement changed.

## Verification and evidence

- Source regression checks failed on the base: missing `ownerLabel` (expected `Translation`, actual `undefined`) and missing generated-descriptor presentation helper.
- Packaged baseline on invisible Windows desktop `MDLxLTests`: RU Nuclear ended at x=1456.27 beyond row right x=1396 and failed hit testing; Fix model showed `gutz00 · Translation`; EMTR showed Red streaks/Pale smoke/Golden smoke; texture trails showed Human/Units/Normal/Campaign. ZH reproduced all three translation gaps. RU FX Add emitter was 114 px for 100.1 px text plus select chrome; RU life-stage headers also overflowed.
- Fix model screenshot setup reproduces PR #536 by putting a historical plain Translation value on a disposable real Footman session. This capture setup is not independent regression evidence for how that invalid state was originally created. Other interactions use actual controls/mouse; camera rotation uses mouse drags.
- `node --test tests/*.test.js`: 57 passed / 0 failed / 0 skipped.
- `node --test test/localization*.test.js test/plain-track-values.test.js test/particle-library-browse.test.js`: 28 passed / 0 failed / 0 skipped (23 localization checks).
- `npx vite build`: passed (existing chunk-size warning only).
- `node scripts/package.mjs --out out/pkg`: passed; 1,422 runtime/assets verified, 55 Electron locales retained.
- Focused final package on `MDLxLTests`: 21/21 RU/ZH/ES measurements passed, 0 skipped, 0 renderer errors. Checked localized properties, generated descriptors, breadcrumbs, both sidebar button hit targets, FX Add emitter width, other narrow FX labels and unchanged 240 px sidebar width. Normal mouse drags rotated EMTR and FX previews in all three languages.
- English and Mordor sidebar controls also fit and accepted normal Playwright hit testing: all five languages covered.
- The capture script initially mangled the Unicode breadcrumb separator in its comparison, causing three false negatives. Corrected only that comparison and reran those three checks on the same package; all passed. Final result JSON and original/recheck logs are retained.
- [Before/after screenshots](release-038-ui-gaps/) contain five RU and five ZH pairs. Spanish narrow-control screenshots and the capture/recheck scripts are in `D:\Codex\release-038-ui-gaps-report`.
- Full packaged suite and Warcraft III not run; Claude owns release QA. No merge/release authorized.
- Disposable packages, profiles, runtime staging and task helper processes removed after verification. Working clone removed after the verified PR push; source/history remain on the feature branch and the small report remains on D:.

## Claude handoff

- Run the independent release QA; do not rerun a full packaged suite as part of this patch task.
- Merge requires explicit owner approval. Warcraft III acceptance is not established by screenshots/source checks.
