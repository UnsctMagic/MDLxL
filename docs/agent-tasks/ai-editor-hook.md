# AI editor hook

Status: ready for review; awaiting merge approval
Owner: Codex / Add AI integration to MDLxL; review fixes by Claude (session_01AvQdnF8d6Q4Km3pPERhTpy)
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
- Current research worktree: `D:\Codex\mdlxl-sd-rulebook-20261024\source` (retained with the study at the owner's request). Study outputs: `D:\Codex\mdlxl-sd-rulebook-20261024\outputs`. The existing local test remains under `D:\Codex\mdlxl-ai-hook-20261024\user-test`.
- No AI release/version change; merge and publication require approval.

## SD modeling rulebook (2026-10-24)

- The user wants strong SD art direction across agents while retaining the full
  modeling toolset. Avoid unrequested HD-style complexity; do not turn observed
  counts into hard caps or use the rulebook to redesign unrelated model data.
- Read-only research covered all 3,501 installed SD/base CASC entries (3,448
  distinct models, 53 aliases), excluding HD/DE modules. Of the first 100 approved
  resources in Hive's native highest-rating sort, 90 allow use and editing with
  credit and were studied (646 distinct MDX 800 models; all parsed). Resources
  whose authors require permission or forbid AI use are not used or mentioned.
  Preserve the distinction between resources and model files.
- Visual study: 127 native and 90 Hive representatives rendered; 30 Walk clips
  sampled at six phases (180 poses). One native bridge render failed, and 16 Hive
  representatives have unresolved legacy stock texture references. The guide
  records these limits; no Warcraft gameplay acceptance was claimed.
- `src/ai-sd-rules.js` supplies one canonical rule text to `AI_SYSTEM_PROMPT` and
  the MCP initialize response. The standalone rulebook and reference study are
  available in help and are included with the evidence JSON in offline packages.
  No new UI, edit operation, format conversion or hard modeling budget was added.
- Verification: 24 focused checks (23 passed, one skipped); source 1,916 tests
  (1,894 passed, 22 skipped, zero failed); compatibility 57 passed. The package
  verified 1,157 runtime/assets and 55 locales. All 65 packaged editor checks
  passed, including rule delivery, help, selected edits, Undo/Redo, round trips,
  mouse rotation and captures without panel hiding.
- All 705 downloaded model hashes and the native build metadata remained
  unchanged. At the owner's explicit request, keep the entire local study root:
  original archives, extracted models/textures, raw catalogues, ranking captures,
  renders, measurements, scripts, logs and this source worktree. Claude's entry
  point is `D:\Codex\mdlxl-sd-rulebook-20261024\CLAUDE-HANDOFF.md`.
- Initial CI found a CRLF-only guide-comparison failure after Windows checkout.
  Normalize line endings in that test while retaining exact rulebook content
  parity. The runtime policy and verified packaged behavior are unchanged.
- Provider protocol/delivery and editor behavior were tested with fixtures. This
  continuation did not grade generated art from a paid provider; model judgment
  still needs the existing visual and measured review.
## Review fixes (Claude, 2026-10-24)

Commits after `375817e` on the same branch. The AI keeps full control of program
controls, including Save of the open model; the owner wants it as working hands.

- AI export never replaces an existing file silently: `overwrite` plus a native
  confirmation (`writeAiModel` in `electron/main.cjs`). AI reads/exports no longer
  change Recents, the startup model or opened paths. No-overwrite export uses an
  exclusive copy (works on FAT/exFAT) and refuses before writing textures.
- The panel header uses `host.summary()` only while open; the full editor state
  (timeline key scan) is built only when the AI acts. Awareness reports playback
  as playing instead of every frame.
- Quit waits at most 5 s for AI shutdown and always flushes settings/recovery;
  CLIs ignoring SIGTERM are killed; `CodexProcess.close` is bounded.
- Saved API key cleared when the base URL changes; a custom CLI path must name the
  provider's own CLI; disabling external MCP retires its key; idle MCP sessions
  expire after an hour (64 max).
- AI edits may not change a numeric array's type (removing an optional array is
  allowed); generated textures load only after a successful commit. An unchanged
  saved CLI path keeps working; only a newly entered path is checked.
- `ignoreAiAlias` replaced by `editor-document`'s `ignoreHistoryAlias`; App's AI
  host uses one `afterPaint` helper; new AI files formatted with Prettier
  (110 columns, single quotes), no behaviour change.
- Packaged tests: restart test saves through `mdlxl_command save` instead of an AI
  overwrite (which now needs a dialog); fixture CLIs are named `codex(.cmd)`.
- Not run in the cloud checkout: packaged Windows tests and real mouse checks.

## Findings and decisions

- The visible test exposed a capture-path bug: each screenshot hid/restored the
  AI panel. Capture the native/geometry renderer layers directly instead; mask
  only the assistant area of full-editor images. Keep normal mouse controls.
- Tool discovery was labeled as reading help, and successful tool results did
  not clear a preceding error status. Distinguish discovery from manual reads
  and clear recovered status without suppressing actual failures.
- Animation APIs update derived Info.Num* counts. A scoped collection edit may
  include only its exact derived count using the editor's shared count map;
  authored Info fields and explicit protected paths remain checked. Clarify
  canonical GeosetAnims tracks, sequence extents, api.source().text and identical
  generated-asset/model texture paths to avoid repeated contract mistakes.

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
- Fifteen shared tools cover exact selections, model data/scripts, existing commands,
  controls, captures, reference models, export, round-trip validation and help.
  The capability index searches 188 public source modules; 45 modules across the
  core task areas were imported successfully in the packaged sandbox. Direct
  operations include mesh/density, Forge construction, binding/IK, UV, materials,
  animation, particles/ribbons and generated texture assets. Native preview/brush
  workflows retain their own controls rather than bypassing their draft state.
- Added local/global pose sampling across 32 frames, up to 12 labeled viewport
  images per call, exact transform-key selection with track metadata, model texture
  inspection and installed game/texture/personal-part library access. Opening a
  donor keeps the original active document and prompt target. Key selection advances
  the target's cached keyframe context as well as its selection signature.
- Generated image bytes use the existing reserved asset paths and export/recovery
  pipeline, with new filenames and decode validation before commit. Compound model
  edits retain one Undo/Redo step. The AI is instructed to inspect, act, verify and
  correct within the user's requested scope, including actual visual checks.
- Detached scripts use the existing modeling libraries. Scoped edits commit through
  normal validation and one Undo step; protected geometry and animation keys are
  checked again after model normalization. Stale selections and cancelled scripts
  cannot commit. The main editor's CSP and normal controls remain intact.
- See [AI-HOOK.md](../AI-HOOK.md) for setup, supported connections and scripting.

## Verification

Capture/status repair (2026-10-24): 63 packaged editor checks passed, including
selection pixels in renderer captures, unchanged assistant visibility/focus in
viewport/UI and animation captures, successful-tool error-status recovery, and
the three-second rainbow workflow without broad Info scope. The rainbow edit
reopens as MDX/MDL and one Undo restores the whole model. Its assertion measures
the requested sequence; the animation API also retains neutral guard keys for
other sequences. Awareness/correction/restart acceptance: 17 passed. Full source
suite: 1,915 tests, 1,893 passed, 22 skipped, zero failures on Windows.
Compatibility: 57 passed. Tests used disposable profiles on the invisible desktop;
the user's open model and signed-in profile were left alone. Installing the
repaired test requires the user to save and close the active test first.

Current continuation adds an off-by-default, persisted Continuous awareness
switch, event-driven editor snapshots and authenticated MCP resource subscriptions.
Codex receives active-turn context injections; API/Claude tools receive current
context at tool boundaries. Awareness starts no idle AI requests and never
retargets an existing edit. `mdlxl_review` requires read-only result assertions,
MDX/MDL reopen checks, before/after images and explicit visual review. Animation
reviews include intermediate poses. Embedded completion checks this evidence;
unfinished work is journaled before/after edits and can resume after a restart
when the model matches its checkpoint. Original model/selection protection and
normal camera controls remain in place. The signed-in Codex account accepted live
context during a running turn without a second user turn. All desktop checks ran
on the invisible test desktop; the user's visible app remained closed.

- New packaged awareness/correction/restart acceptance: 17 checks passed.
- Updated original packaged regression: 55 checks passed, including immutable
  verification scripts, animation pose images and playhead restoration.
- Final source suite for this continuation: 1,911 tests, 1,890 passed,
  21 skipped, zero failures. Compatibility: 57 passed.
- Focused awareness, native-provider and recovery checks: 14 passed, including
  refusing a success reply when an edit fails without changing the model.
- Real signed-in GPT-6-Luna: 23 checks across four prompts, covering exact marked
  vertex movement, duplicate mirror/seam weld, sparse animation authoring,
  protected-data preservation, actual review completion, Undo, program help and
  MDX/MDL reopening. Live context injection was acknowledged without delivery
  errors. The animation prompt encountered tool errors, corrected its call and
  completed review successfully. Source input bytes remained unchanged.
- Final runtime package: 1,149 runtime/asset files verified and 55 Electron
  locale files retained. User profile and the original test model are separate
  from the replaceable application package.

Earlier milestones (before optional awareness and durable verification):

- Compatibility: 57 passed, zero failures.
- Final full source suite: 1,903 tests, 1,882 passed, 21 skipped, zero failures.
- Final focused AI tests: 31 passed (model, capabilities, sampling, generated assets,
  MCP, API and native-process authentication).
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
- Final packaged regression: 52 checks passed, no renderer errors. Added actual
  module discovery/imports, reference loading without retargeting, exact native
  key selection, skinned motion measurements, multi-view/frame images, and one
  script combining procedural geometry, UV/material edits, binding, an emitter
  and its generated texture. Protected mesh/animation stayed unchanged; generated
  texture export, whole-edit Undo/Redo and MDX/MDL reopening passed.
- Real signed-in Codex vision requested an actual viewport image and correctly
  described the wireframe model, red marked vertices, blue unmarked vertices and
  gray background. Model data was unchanged.
- A further real GPT-6-Luna prompt passed seven checks: exactly the four marked
  vertices +3 Z, only their UV U coordinates +0.125, first material alpha 0.75,
  protected topology/normals/rig/animation intact, direct script use, real before/
  after image inspection and one Undo restoring the complete model.

## Next action

Owner review of SD-guided modeling behavior in the local test and the existing
AI hook PR. Merge only after approval. Local source, compatibility and packaged
checks for this continuation are complete; CI runs against the pushed revision.
The user's existing test profile and saved models stay separate from the package.
`test/ai-live.electron.cjs` remains the opt-in real-account acceptance harness.

## SD Brain (2026-10-24, Claude)

- Implemented from `D:\Codex\mdlxl-sd-rulebook-20261024\outputs\SD-BRAIN-IMPLEMENTATION-BRIEF.md` on the Claude console branch (Offload Mode, steering, Marker/Pen).
- The rulebook is no longer appended unconditionally. `src/ai-sd-rules.js` owns `AI_SD_RULES`, the SD Brain behavior (`AI_SD_BRAIN`, interpretation, chalice lesson, review criteria), `SD_BRAIN_REVISION`, `sdBrainInstructions(policy, role)` and `sdReviewProblem(args)`.
- `electron/ai-service.cjs`: `config.sdBrain` (default off), `setSdBrain`; `runTask` captures `task.sdBrain` and adds the instructions to every turn's system text plus a "Task settings" line; workers and handovers inherit it; the organiser gets `mdlxl_capture` while on; review finish is checked and repeated failures stop.
- External MCP: initialize points to `mdlxl_context.sdBrain`; the service adds the current state there.
- UI: SD Brain checkbox in the console header; tooltip localized (es/ru/zh).
- Not verified: real Codex/Claude/API turns judging art, Warcraft III gameplay.
