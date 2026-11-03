# Integrated editing handbook

Status: implemented on `codex/integrated-editing-handbook`, pending final packaged and CI checks.

## Goal

Make the existing book switch run repeatable native checks across providers. The separate JavaScript workspace switch remains available for custom analysis. Both use the captured document and selection.

## Owners

- `src/ai-tools.js`, `src/ai-guide-sections.js` and the WC3 editing guides route instructions by task and captured editing area.
- `src/ai-editing-procedures.js`, `src/ai-simplify-checks.js` and `src/ai-rig-checks.js` inspect components, compare candidates and report worst measured poses.
- `app/ai-editor.js`, `app/ai-review.js` and `electron/ai-service.cjs` own candidate versions, task scope, repeatable plan checks and the review verdict. Use the editor's existing sampler and capture controls.
- `electron/ai-candidate-files.cjs` stores fingerprint-verified best and reviewed MDX files with a chat. The user can export these after restarting the app.

## Teaching and verification

The following cases run without a paid provider. Keep private models in the permanent fixture collection.
- `node --test test/ai-handbook-teaching.test.js` replays a requested change, an exterior-vertex violation, its correction and a counterexample.
- `node --test test/ai-simplify-checks.test.js` compares valid compacted components, torn surfaces and unequal per-component triangle counts on the public helmet.
- `node --test test/manual/ai-rig-steve.test.js` checks the real accepted and damaged Steve candidates. A left shoulder edge is 2.41 units in the accepted rig and approximately 31.09 in the damaged one at 31.25% of Attack - 1. The frozen rigid counterpart and flexible limb form separate controls.
- `test/ai-handbook.electron.cjs` exercises the packaged book switch, unsafe candidate review refusal, correction, saved-model export and recovery in a disposable profile.

Record an owner's correction with a baseline, failed result, selected part, clip, frame, and intended behavior. Pair it with an accepted result and a counterexample where the rule should not apply. Keep the expected measurement independent of the edit code. Use additional models before promoting a narrow correction to a general rule.
