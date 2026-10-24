# AI in MDLxL

Click **AI** in the desktop toolbar, open **Connection**, choose a provider,
and sign in or enter its API connection. Native connections check the account
when chat opens. If you are signed out, setup opens and **Sign in to send** keeps
your draft while you complete sign-in in the browser. After **Signed in.** appears,
click **Send**. Cancelled or failed sign-in keeps the draft and attached images.
The chat is a movable, resizable window;
you can keep selecting and editing the model while it is open.
The model chooser beside the provider shows the available Codex models after
sign-in. **Connection** holds provider settings; **Advanced connection** contains
the optional CLI executable path. The panel follows MDLxL's current appearance,
and replies format paragraphs, lists, bold text and code without executing HTML.

**Continuous awareness** is an optional switch below the model/selection strip.
It starts off and remembers your choice. When on, real editor changes update the
connected AI's context: document/revision, marked vertices, selected bones/keys,
camera angles, workspace and animation frame. Changes are coalesced; there is no
idle polling and enabling it does not start paid AI requests by itself. Codex
receives updates in its active turn; API/Claude tool results carry the latest
context at the next tool boundary. External MCP clients can subscribe to
`mdlxl://editor/context`. Turning the switch off clears that live resource and
stops future updates. Context already sent remains in the conversation.

Live awareness never moves an existing edit onto a new selection. If the user
changes the captured model or selection, delayed mutations still stop.

After model edits, **Result verified** appears only after the AI runs measured,
read-only checks against the original model, validates MDX/MDL reopening, receives
actual before/after images, and finishes its visual review. Animation edits also
sample and capture intermediate poses, then restore the playhead. A failed check
requires correction and a fresh review; another edit invalidates the old review.
The AI judges appearance and chooses task-specific assertions: the gate verifies
that these checks ran, not that AI judgment is infallible. External clients have
the same review tools but control their own conversation completion.

Interrupted embedded tasks show **Resume task**. Checkpoints are written before
and after edit tools, including the original model, exact target context and
completed-step summaries. Resume verifies the current model against the saved
checkpoint, restores its selection and continues with inspection, without blindly
replaying an applied tool. If the model differs, recover it through MDLxL's normal
recovery first or send a new prompt. Checkpoints do not save over model files.
The temporary original-model snapshot is removed after verified completion.

Mark vertices, select bones or timeline keys, then describe the change. For example:

- “Mirror these to the other side and weld the seam. Keep the existing UVs.”
- “Raise this hand slightly during Attack. Leave the weapon and every other animation alone.”
- “Use the attached model's cloak, keeping this model's proportions and animation.”
- “What does this control do, and how do I use it?”

The prompt includes the active model, exact marked vertex IDs, selected bones,
checked geosets, UV set, sequence, frame and selected timeline keys. An AI edit
uses the editor's normal validation and Undo history. If you change the model or
selection while the AI is preparing an edit, that delayed edit is rejected and
the AI can explain why. **Stop** cancels pending work; edits already applied stay
available in Undo. Nothing is saved automatically by sending a prompt.

**Attach** adds MDL/MDX reference models or PNG/JPEG/WebP reference images.
Reference models remain open as ordinary tabs. Image paste also works.

## Connections

| Choice | Setup |
| --- | --- |
| Codex / ChatGPT | Install the [Codex CLI](https://developers.openai.com/codex/cli), then click **Sign in**. Complete the provider's sign-in page in your browser. |
| Claude Code | Install [Claude Code](https://code.claude.com/docs/en/setup), then click **Sign in**. Your plan must support Claude Code. |
| OpenAI API | Enter an OpenAI API key and choose a model that supports tools. |
| Claude API | Enter a workspace-scoped Claude API key and choose a model that supports tools. |
| Other AI / local model | Supply an OpenAI-compatible API base URL and model ID. HTTP is supported for localhost servers; remote endpoints use HTTPS. A local server need not require a key. |

The native CLI executable is found on PATH, or can be chosen by entering its full
path in Connection. A chosen path must name that provider's own CLI (`codex.exe`,
`codex.cmd`, `claude.exe`, `claude.cmd`), so the setting cannot launch another
program. A saved API key is cleared when the API base URL changes, so it is never
sent to a different server. Native providers manage their own sign-in in MDLxL's profile;
MDLxL does not extract tokens from another app. API credentials are encrypted with
the operating system's credential storage. Each provider retains its connection
settings. Switching providers starts a new chat. Subscription access and API
billing follow the provider's own terms; API keys do not use a ChatGPT subscription.

The integration has a general tool contract. A provider needs tool calling to use
it, and vision to inspect captures/images. Model capability still determines the
quality of an edit. MDLxL cannot make an arbitrary chat-only service execute tools.

## Connect an external AI client

In **Connection → Connect another AI**, click **Enable connection** and **Copy
connection JSON**. Add that configuration to a local MCP client. It describes an
authenticated Streamable HTTP endpoint on `127.0.0.1`. It remains available while
MDLxL is open, and keeps its port and key across restarts when available. Disable
the connection to disconnect external clients; enabling it again issues a new key,
so previously copied configurations stop working. Idle client sessions expire after
an hour.

Clients with an `mcpServers` configuration can use the copied JSON directly.
Clients with other configuration formats need its URL and bearer token in their
equivalent fields. For example, Codex uses:

```toml
[mcp_servers.mdlxl]
url = "http://127.0.0.1:PORT/mcp"
bearer_token_env_var = "MDLXL_TOKEN"
```

Set that environment variable to the token from the copied configuration in the
client's environment. The connection JSON grants access to the open editor;
keep it private. A cloud-only client cannot directly reach a localhost endpoint.
Embedded chat works without enabling this external listener.

## Available editor tools

| Tool | Capability |
| --- | --- |
| `mdlxl_capabilities` | Search installed editing libraries by task, discover exported functions and read their actual runtime signatures. |
| `mdlxl_review` | Run task-specific assertions against `model` and original `before`, validate files, inspect actual images/animation samples and finish or request correction. |
| `mdlxl_context` | Live document, exact selection, animation context, references, diagnostics and enabled commands. |
| `mdlxl_read` | Read any model field, with typed arrays and explicit pagination. |
| `mdlxl_script` | General JavaScript using the complete model, references, captured selection and MDLxL's own modeling libraries. |
| `mdlxl_patch` | Precise JSON Pointer edits with typed values, validation and Undo. |
| `mdlxl_select` | Change real vertex, bone, geoset and exact transform-key selections. |
| `mdlxl_command` | Invoke existing editor commands using their normal behavior. |
| `mdlxl_view` | Change workspace, camera preset, render mode, local/global animation, frame, playback and fit. |
| `mdlxl_sample` | Measure node world transforms and skinned vertex positions/bounds across up to 32 frames without moving the playhead. |
| `mdlxl_capture` | Inspect real viewport images, including up to 12 labeled camera/frame samples per call. |
| `mdlxl_assets` | Search installed game/texture and personal part libraries, preview model textures, load donor references without switching the working model. |
| `mdlxl_ui` | Inspect, set and click controls, capture the editor, or drag on a canvas/control using its actual mouse interaction. |
| `mdlxl_document` | Open/list models, export with the existing serializer and asset writer, or validate MDX/MDL reopening. |
| `mdlxl_help` | Read the installed documentation and discover the scripting API. |

Model scripts can edit geometry, UVs, skinning, bones, animation tracks, materials,
textures, emitters, cameras and the other native model sections. This is a general
modeling interface, not a fixed set of generated-model presets. Program controls
remain available for workflows with their own preview, project or dialog state.
Paint owns a separate working model: operate its controls, or leave Paint through
`mdlxl_view` to apply it through the ordinary editor before changing model data.
Pending UV or animation-text previews retain the editor's existing protections.
Normal Save includes pending previews; direct export targets the committed model.
Export writes to the path the AI names without a save dialog, but never replaces an
existing file silently: the AI must request `overwrite` and the user confirms the
replacement in a native dialog. Opening references and exporting do not change
Recent files or the model MDLxL reopens at startup.

## Scripting contract

Start with context. Keep its `target` for the operation; never replace a stale
target to force an edit onto a changed selection. Each embedded prompt already
contains this captured context. IDs are zero-based.

Scripts receive `model`, `selection`, `context`, `references`, `api`, `assets` and `log`.
They run on detached copies in a disposable sandboxed renderer. They cannot access
Node, the filesystem, network or the editor's DOM/desktop API. A script's return
value is reported to the AI; `model` changes commit only with `edit: true`.

The capability index covers mesh editing and density, procedural Forge shapes,
reusable parts, bones/binding/IK, keyframes/retiming/secondary motion, UVs,
materials, painting libraries, particles/ribbons/glow, normals and inspection.
It searches the installed public source modules, so functions outside the task
groups remain discoverable. This uses MDLxL's own functions and format support;
it does not claim to add Blender's feature set or an unconfigured external
text-to-3D/image-generation service.

For a multi-step edit, the AI can inspect an image and exact selected data, combine
geometry/UV/rig/material/animation operations in one script, then check numerical
samples, multiple rendered views and serialization before reporting the result.
The same contract is available to embedded providers and external MCP clients.

To generate a texture with the existing procedural image/painting libraries,
push `{name, bytes: Uint8Array}` to `assets` and reference that name in
`model.Textures`. Use a new relative `MDLxL_Forge/Name.tga`, `.blp` or `.dds`
path (the existing `MDLxL_Parts` and `MDLxL_Citadel` paths are also supported).
Textures are decoded before the model edit commits. Existing images cannot be
replaced in place; use a new name so one normal Undo restores the old material.
The editor retains generated bytes for Redo, recovery and ordinary asset export.
This supports up to 32 generated images totaling 64 MB per script.

Discover existing implementations before writing math:

```js
return api.modules;
// Then, in another read-only call:
return await api.describe('animation');
// The original, unminified implementation can be paged:
return await api.source('animation', 0, 16000);
```

An edit requires an Undo `label` and explicit JSON Pointer `scope`, such as
`["/Geosets/2/TVertices/0"]`. `protectedPaths` checks sections that must remain
identical. `animationRanges: [[start, end]]` preserves stored keys outside the
specified intervals, global tracks and shared interpolation metadata. Scripts
must preserve the model's typed arrays. Use canonical collections such as
`Bones` and `PivotPoints`; `Nodes` and each node's `PivotPoint` are aliases.

For duplicate mirroring, inspect `ai-mesh` and specify the intended axis and
plane from the model/view. The ordinary editor Mirror command reflects in place.

```js
const {mirrorSelection} = await api.module('ai-mesh');
const result = mirrorSelection(model, selection, {axis: 'y', plane: 0, weld: true});
for (const key of Object.keys(selection)) delete selection[key];
Object.assign(selection, result.selection);
return result.details;
```

Compatible seam welding preserves UV, normal and skinning discontinuities. A
mirrored part retains its original binding; remapping to counterpart bones is an
explicit rig edit. Only fully marked triangles are duplicated. Unmarked geometry
does not become part of the requested selection.

For vector animation sampling, supply a vector fallback (the animation API uses
a scalar fallback by default):

```js
const {sampleTrack} = await api.module('animation');
return sampleTrack(model.Bones[0].Translation, context.frame, {
  interval: Array.from(model.Sequences[context.sequence].Interval),
  fallback: [0, 0, 0]
});
```

Model validation and MDX/MDL reopening prove structural compatibility. Actual
viewport captures and sampled intermediate poses provide additional evidence;
Warcraft III gameplay acceptance still requires testing in Warcraft III.

## Ownership and verification

`src/ai-tools.js` owns the provider-neutral contract. `app/ai-editor.js` adapts it
to `App.edit`, selection and existing commands. `electron/ai-service.cjs` owns
connections, credentials, chat persistence and IPC. Native provider transports
are in `electron/ai-providers.cjs`; external MCP is in `electron/ai-mcp.cjs`.
`ai-sandbox.html` is a separate Vite entry with its own restricted preload/CSP.
The main editor's CSP remains unchanged.

Focused checks: `node --test test/ai-*.test.js`. The native interaction test is
`test/ai-editor.electron.cjs`; run it on a hidden Windows desktop with a disposable
profile. `MDLXL_AI_TEST_EXE` selects a packaged executable and `MDLXL_AI_TEST_OUT`
selects its report directory. It uses a local provider fixture, so it does not
authenticate to a paid account. Native provider account tests are separate from
model-editing verification.

For an opt-in real-provider acceptance check, use `test/ai-live.electron.cjs` on
the hidden desktop. Set `MDLXL_AI_LIVE_PROFILE` to the MDLxL profile whose owner
has signed in, plus the same packaged executable and report variables above.
This makes real model requests against generated fixtures, checking selected
vertex edits, one Undo, mirror/weld, sparse animation keys, unchanged other data,
program help and MDX/MDL reopening. It preserves the signed-in profile and never
overwrites the owner's model files. Authentication must succeed before edits run.
