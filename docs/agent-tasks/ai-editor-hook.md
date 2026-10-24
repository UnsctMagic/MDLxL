# AI editor hook

Status: active
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
- Base: `b36dd6fada1f5b6da2fd6e3e285e8d8c1f8121f3`.
- Checkout: `D:\Codex\mdlxl-ai-hook-20261024\source`.
- No release/version change; merge and publication require approval.

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

## Next action

Implement the shared model/tool interface, transports, providers and compact chat.
Record exact verification and provider login gaps before review.
