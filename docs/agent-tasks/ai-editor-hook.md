# AI editor hook

Status: ready for review; awaiting merge approval
Owner: Codex / Add AI integration to MDLxL
Updated: 2026-10-24

## Goal and completion criteria

Connect an AI to the full editor through prompts, including current selections,
surgical geometry/UV/rig/animation edits, visual inspection, reference models,
and in-program help. Support embedded Codex and Claude conversations plus an
open MCP interface and configurable API providers. Preserve ordinary commands,
mouse camera controls, document validation, byte-preserving save and Undo.

## Revision and local state

- Branch: `codex/ai-editor-hook`.
- Base: `af1d0f12` (main, including the 0.30.1 changes).
- Implementation: `6410229f02e4bd1624e26c61eb35878de75c3afd`.
- Checkout: `D:\Codex\mdlxl-ai-hook-20261024\source`.
- No AI release/version change; merge and publication require approval.

## Findings and decisions

- The existing add-on API only dispatches commands; it cannot inspect/edit model data.
- Reuse `App.edit` / `EditorDocument.apply`, command enablement and selection history.
- Bind a prompt to the active document, revision and selection; reject stale edits.
- Provide general model scripting as well as precise patches; do not limit AI to presets.
- Run generated scripts in a separate hidden, sandboxed renderer, with no Node or
  editor desktop API and no network. Validate and commit results in the editor.
- Use provider-owned authentication. Never read another application's token files.
- Verify on a hidden desktop, including real selection, mouse rotation, Undo/Redo,
  stale targets, cancellation, provider/MCP transport, and MDX/MDL reopen.

## Delivered behavior

- A compact AI toolbar button opens movable chat, with native Codex/Claude sign-in,
  API providers and an optional authenticated local MCP connection.
- Eleven shared tools cover exact selections, model data/scripts, existing commands,
  controls, captures, reference models, export, round-trip validation and help.
- Detached scripts use the existing modeling libraries. Scoped edits commit through
  normal validation and one Undo step; protected geometry and animation keys are
  checked again after model normalization. Stale selections and cancelled scripts
  cannot commit. The main editor's CSP and normal controls remain intact.
- See [AI-HOOK.md](../AI-HOOK.md) for setup, supported connections and scripting.

## Verification

- Compatibility: 57 passed, zero failures.
- Full source suite: 1,893 tests, 1,872 passed, 21 skipped, zero failures.
- Focused AI model, MCP, API and native-process checks: 21 passed.
- Packaged Windows app on implementation revision: 32 workflow checks passed on
  a hidden desktop with a disposable profile. Real selection -> local provider
  fixture -> MCP -> sandbox -> live model was exercised, including duplicate
  mirror/seam weld, unrelated mesh/rig preservation, one Undo/Redo, MDX/MDL reopen,
  non-overwriting export, encrypted credentials, sparse animation interpolation,
  unchanged other-sequence keys, selected timeline keys, actual rendered poses,
  normal mouse rotation, AI canvas gestures, reference attachments, installed help,
  chat dragging and 1280 x 800 resize, Stop, stale selection, invalid script return,
  and shutdown during a 30-second script. No renderer errors.
- Current native Codex binary: initialization, signed-out account status, MCP tool
  discovery and an actual MCP edit-tool call passed using an isolated profile.
- Current Claude CLI 2.1.310: supported invocation flags and signed-out account
  handling verified. Native adapters also have child-process protocol tests.
- Real provider sign-in and paid model generation were not exercised. Provider
  account/plan access, model quality and Warcraft III gameplay acceptance remain
  separate checks. No existing credentials, models or user profiles were changed.

## Next action

Review the feature PR and its CI. Merge only after the owner's explicit approval.
For an account acceptance test, install the chosen CLI, open AI -> Connection,
sign in, mark vertices and send a prompt. The desktop tests use a local provider
fixture and do not claim real-model planning quality.
