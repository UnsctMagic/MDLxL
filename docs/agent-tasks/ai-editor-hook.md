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
- Initial implementation: `6410229f02e4bd1624e26c61eb35878de75c3afd`.
  The same branch continues with the verified sign-in repair and UI refresh.
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
- A native model list is available while signed out; it does not prove that a
  provider can answer. The first user test exposed an unsigned Codex request
  reaching `/responses` and returning HTTP 401. Check/refresh the actual account
  before a turn, show sign-in state, and retain the draft during failed/cancelled
  login. Verify login completion by reading the account again.
- Verify on a hidden desktop, including real selection, mouse rotation, Undo/Redo,
  stale targets, cancellation, provider/MCP transport, and MDX/MDL reopen.

## Delivered behavior

- A compact AI toolbar button opens movable chat, with native Codex/Claude sign-in,
  API providers and an optional authenticated local MCP connection.
- The requested UI refresh uses MDLxL's light/dark palette, a visible native-model
  chooser, clear selection context, compact icon controls, formatted replies and
  an integrated composer. The optional executable path is under Advanced
  connection. Separate native assistant messages retain paragraph boundaries.
- Eleven shared tools cover exact selections, model data/scripts, existing commands,
  controls, captures, reference models, export, round-trip validation and help.
- Detached scripts use the existing modeling libraries. Scoped edits commit through
  normal validation and one Undo step; protected geometry and animation keys are
  checked again after model normalization. Stale selections and cancelled scripts
  cannot commit. The main editor's CSP and normal controls remain intact.
- See [AI-HOOK.md](../AI-HOOK.md) for setup, supported connections and scripting.

## Verification

- Compatibility: 57 passed, zero failures.
- Full source suite after the sign-in repair and UI refresh: 1,896 tests, 1,875 passed,
  21 skipped, zero failures.
- Focused AI model, MCP, API, native-process and localization checks: 43 passed.
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
- Packaged regression after the sign-in repair: 37 checks passed. In addition
  to the workflows above, this exercised setup while signed out, failed and
  cancelled login with the draft intact, verified login across fresh provider
  processes, and native-provider MCP access. No visible desktop was used.
- Packaged regression after the UI refresh: 39 checks passed, adding native model
  selection/persistence and safe formatted reply rendering. The same end-to-end
  geometry, animation, camera rotation and cancellation checks still passed.
- Refreshed UI with a real signed-in GPT-6-Luna edit: seven checks passed. The
  visible model chooser selected the model, a real prompt moved exactly the four
  marked vertices +2 Z, response paragraphs stayed separate, both light/dark
  palettes rendered without horizontal overflow, the CLI path stayed folded,
  and the composer remained reachable at 960 x 640. The app stayed offscreen.
- Real ChatGPT sign-in completed through the provider-owned browser flow.
  GPT-6-Luna then passed 17 acceptance assertions across four real prompts in
  the packaged app on the hidden desktop: selected vertices moved +5 X with
  exact protected-data comparisons and one Undo; selected faces duplicated
  across X=0 with a welded seam; one root translation key at Stand frame 500
  with all other keys/geometry unchanged and distinct rendered poses; installed
  program help; MDX and MDL reopening without diagnostics. Fixture input bytes
  were unchanged. Reports remain under `work/real-provider-verification`.
- Live Claude-account/API-provider generation and Warcraft III gameplay were
  not exercised. Their existing protocol/fixture checks remain distinct from
  the real signed-in Codex acceptance above.

## Next action

Review the feature PR and its CI. Merge only after the owner's explicit approval.
The local user test retains its signed-in profile and GPT-6-Luna selection.
`test/ai-live.electron.cjs` is the opt-in real-account acceptance harness; ordinary
CI and `test/ai-editor.electron.cjs` use fixtures without paid credentials.
