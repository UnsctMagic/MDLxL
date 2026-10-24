# AI in MDLxL

Click **AI** in the desktop toolbar, open **Connection**, choose a provider,
and sign in or enter its API connection. The chat is a movable, resizable window;
you can keep selecting and editing the model while it is open.

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
path in Connection. Native providers manage their own sign-in in MDLxL's profile;
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
MDLxL is open, and keeps its port across restarts when available. Disable the
connection to disconnect external clients.

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
| `mdlxl_context` | Live document, exact selection, animation context, references, diagnostics and enabled commands. |
| `mdlxl_read` | Read any model field, with typed arrays and explicit pagination. |
| `mdlxl_script` | General JavaScript using the complete model, references, captured selection and MDLxL's own modeling libraries. |
| `mdlxl_patch` | Precise JSON Pointer edits with typed values, validation and Undo. |
| `mdlxl_select` | Change real vertex, bone and geoset selections. |
| `mdlxl_command` | Invoke existing editor commands using their normal behavior. |
| `mdlxl_view` | Change workspace, camera preset, animation, frame and playback. |
| `mdlxl_capture` | Capture the actual rendered model viewport. |
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

## Scripting contract

Start with context. Keep its `target` for the operation; never replace a stale
target to force an edit onto a changed selection. Each embedded prompt already
contains this captured context. IDs are zero-based.

Scripts receive `model`, `selection`, `context`, `references`, `api` and `log`.
They run on detached copies in a disposable sandboxed renderer. They cannot access
Node, the filesystem, network or the editor's DOM/desktop API. A script's return
value is reported to the AI; `model` changes commit only with `edit: true`.

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
