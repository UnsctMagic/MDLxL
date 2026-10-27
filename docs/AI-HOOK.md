# AI in MDLxL

Click the **AI** icon (first in the XL module dock), open **Connection**, choose a provider,
and sign in or enter its API connection. Native connections check the account
when chat opens. If you are signed out, setup opens and **Sign in to send** keeps
your draft while you complete sign-in in the browser. After **Signed in.** appears,
click **Send**. Cancelled or failed sign-in keeps the draft and attached images.
VIS hides the AI interface and drawings, and disarms any drawing tool. Returning
to XL restores the console, unsent draft and existing drawings. A chat-cleanup
question triggered by saving in VIS waits until XL.

The AI console docks at the left edge of the workspace; drag its right edge to
make it wider. The viewport makes room while it is open and gets the space back
when you close it. You can keep selecting and editing the model while it is open.
The model chooser in the prompt box shows the available Codex models after
sign-in. The settings button (or the provider name) opens **Connection** with the
provider settings; **Advanced connection** contains the optional CLI executable path. The panel follows MDLxL's current appearance,
and replies format paragraphs, lists, bold text and code without executing HTML.

AI controls now use the same short shortcuts and Learn reminders as the
editor. Their keys come from their names and work while focus is in the console;
click back into the model to use editor keys. Typing and copy/paste in the prompt
stay native, and Enter still sends. Hover a control to see its key. The console
keeps its existing compact layout; Escape closes it when focus is on its controls
or background. Connection settings, Attach/remove reference, drawing tools and
colours, Send/Stop, and the chat cleanup dialog use the same shortcut system.

Viewport captures copy the renderer's current scene and selection overlays without
hiding the assistant. Full-editor UI captures mask the assistant area in the
returned image; the live panel stays visible. **Finding modeling tools** means API
discovery, while **Reading MDLxL help** means reading the manual. A recoverable
tool-error status clears when the next tool succeeds; failed tasks still show
their actual error.

### Watching and steering the AI

While the AI works, the console shows what it says, its **Thinking** (live, then
folded into **Thought process**; click to read it again) and each editor step it
takes with a spinner, check mark or cross. Click a step to see what it sent and
what came back. Providers that do not expose thinking simply show their text and
steps. Claude API models from 4.6 on show a summary of their thinking.

You can keep typing while it works: **Enter** sends the message into the running
task (the button becomes **Steer**) and it appears in the chat where you sent it,
marked "Sent while the AI was working". The AI picks it up at its next step; if it
had just finished, the message starts a follow-up turn on the same task. **Stop**
(the square) cancels; applied edits stay in Undo.

### Editing handbook

The **Editing handbook** switch (the book icon in the console header, next to the
bird) is off until you turn it on, and MDLxL remembers your choice. While it is on,
every request also carries a short set of general Warcraft III editing rules, and
the AI can open the step-by-step `WC3-EDITING-*` guides (geometry, UVs and
materials, nodes and binding, animation, emitters, game integration,
verification). While it is off, neither is sent and the guides are not listed in
help. Like SD Brain, a running job keeps the setting it started with; a change
applies from the next request.

### Web research

The **Web research** switch (the globe next to the Editing handbook book) is off
until you turn it on, and MDLxL remembers your choice. While it is on, the AI can
search the web and read pages, such as Hive Workshop and XGM tutorials, when it
needs to look something up or you ask it to. Each search shows as a step in the
chat. It works with Codex, Claude Code and the Claude API; the OpenAI API and
local-model connections stay offline. On the Claude API, searches are billed by
Anthropic on top of the tokens.

The AI is told to treat pages as information only: it never follows instructions
found on a page and never sends your model or conversation to a website. Its
editing tools are unchanged, so it can still only change the open model, and
every edit stays in Undo. The organiser of Offload Mode never searches; the bird
doing the work does. Like the handbook, a running job keeps the setting it
started with; a change applies from the next request.

### Offload Mode: an organiser per model and its birds

Each model has its own AI chat: switch model tabs to switch chats. With **Offload
Mode** on (the default; the bird switch in the console header, next to the model
picker) that chat keeps the job roster and forwards work directly to a worker with a simple bird name (the first one of a chat is a corvid, the
rest are picked at random), and the
worker does the work with its own memory. Each bird keeps its own colour in the chat. Its report appears once, without an organiser recap call. Separate memories keep long sessions from running
into compacting.

- Your message reaches the worker exactly as you wrote it, together with your
  selection and drawings. Only the working bird receives images and captured context.
- **Job routing** in Connection settings offers Manual (default), Automatic, or Both.
  Continue sends directly to the current bird. New job starts a fresh bird; Tiny job
  uses the shared bird for quick tasks. Automatic uses one small text-only routing
  call when a message has no chosen bird. Opening a bird chat or addressing its
  name bypasses routing. The first Manual job starts a bird without a routing call. Automatic can split a new request using a compact structure summary.
- The existing reply cost line shows calls and tokens by role. Codex reports provider
  turns; unavailable usage is labelled instead of estimated as zero.
- A bird whose memory is half full writes a handover note and retires; a new bird
  takes over from the note.
- Automatic routing can split a multi-part job into declared regions. Independent
  birds work at once; overlapping dependencies and structural edits wait. Each
  actual commit stays inside its region and adds a separate bird-labelled Undo
  step. Normal Undo reverses those steps in order. The final combined check covers
  shared seams in bind/posed frames and MDX/MDL save/reopen. There is no bird cap.
  If a structural change renumbers parts, remaining assignments need a fresh job.
- **Allow lighter models for simple jobs** is off by default. Load models in
  Connection settings to see the lighter choices supported by that connection.
  Select the lighter model there. Clear exact-value edits and factual reports use
  it automatically; unclear or spatial work asks which model to use. The choice
  applies to that job. A failed light review or complex follow-up hands over once
  to the chosen model, without replaying completed edits. Birds keep their model;
  rows show the model and its individual cost. Unknown wording is treated as complex.
- The chips above the chat show the organiser and its birds (spinner: working,
  pause: waiting for you). Click a bird to read its chat, watch its thinking and
  steps, or talk to it directly. Retired birds and earlier chats of this model
  stay readable under **Retired**. **New chat** starts a new organiser for the model.
- If you switch to another model tab while a bird works, it keeps working on its
  own model in the background (see below). Only a step that needs MDLxL's own
  buttons or windows on screen pauses ("Paused until you return to …"; the bird's
  chip shows a pause sign) and carries on when you come back.

### Working in the background

You can open or switch to another model and keep editing it while a bird works on
the first one. The bird has its own environment for its model tab:

- **Its own model and Undo.** Its edits go straight into its model, as normal Undo
  steps of that tab. Your Undo on the tab you are using never touches them, and
  theirs never touches yours. The tab shows the ● changed mark; save it as usual.
- **Every editing tool.** Geometry, UVs, rig, animation, materials, textures,
  events, emitters and the other model sections are edited through scripts and
  patches on that model directly, as are selection, views, Undo/Redo, reading,
  sampling, texture previews, reference models and export.
- **Its own pictures.** The bird's pictures of its model, and every review picture
  (before/after, side views, animation frames), are drawn in a hidden preview. Your
  view and camera never move, also when the bird works on the tab you are looking at.
  These pictures show the bird's marked vertices (red) and the Marker/Pen notes
  sent with the prompt, from the picture's own angle and animation frame. A
  picture can also be a close-up of the marked vertices, for small spots such as
  a joint or a seam. While a job runs MDLxL keeps drawing even when its window is
  covered or minimized, so pictures still work while you use another program.
- **Editing handbook.** With the [Editing handbook](#editing-handbook) switch on,
  a bird working in the background gets the same rules and guides.
- **Older chats keep working.** After an update or an SD Brain switch the AI's
  tool list changes and Claude refuses its earlier reasoning; MDLxL then drops
  that reasoning from finished turns and asks again.
- **Its own selection and drawings.** The selection and Marker/Pen notes are taken
  when you send the prompt; what you select or draw on another tab does not change
  them. When you switch to the bird's tab you see the selection it left there.
- **Screen-only steps wait.** Editor commands other than Undo/Redo, program
  controls (`mdlxl_ui`) and choosing timeline keys need the bird's tab on screen.
  Such a step waits until you return to that tab.
- **Changes are checked.** Region birds become stale when their own part or a dependency changes; changes to another independent part do not invalidate them. For ordinary jobs on the tab being shown, if you change that model or its
  selection while the bird prepares an edit, the edit is refused and the bird asks,
  as before. Closing the bird's tab stops its task.

**Several jobs at once.** Each model's chat runs its own job: while a bird works
on one model, switch to another model's tab and send its chat a prompt; its own
organiser and birds work alongside. One owner request per model at a time: its declared region birds can run concurrently; a second independent chat of the same model waits. **Stop** and steering act on
the chat you are looking at. Connection settings and sign-in stay unavailable
while any job runs, since all chats share one connection.

After you save a model the AI worked on, MDLxL asks how to tidy its chats:
**Keep everything**, **Keep a summary** (the organiser writes a memory note, then
all chats, screenshots and the copies Codex or Claude keep are deleted; the next
organiser for this model starts with the note) or **Wipe it all**. **Remember for
this model** skips the question next time; **After saving** in the connection
settings changes the remembered choice.

With Offload Mode off, the model's chat edits directly, as one assistant.

### Marker and Pen

The prompt box has **Marker**, **Pen** and **Eraser**. They draw notes on the
model for the AI and never change the model, its Undo history or saved files.

- **Marker**: drag over the model to highlight an area, e.g. "cut this area into
  its own geoset". The AI gets the vertices under the marker on the side you drew.
- **Pen**: scribble a line or outline, also off the model, e.g. draw the muscle
  shape you want and ask for "more shape here like this".
- **Eraser**: drag over notes to remove them. The drawings chip above the prompt
  undoes the last note or clears all notes on this model.

The colored dot picks a color per tool (red, yellow, green, blue); the AI gets the
color name, so colors can mean different things. Drawing uses the left button in
Work mode; Alt+drag, the camera toggle and the other mouse buttons keep their
normal camera actions, so you can turn the model and keep drawing. Esc or a second
click on the tool stops drawing. Choosing a tool outside the Vertices editor
switches to it. Notes belong to their model tab, hide while the console is closed
and come back when it reopens. Each prompt sends them as `context.annotations`
(model-space points, colors and covered vertices); a message sent while the AI
works includes the current notes, and viewport captures show them.

### SD Brain

> **Parked (2026-10-25).** SD Brain is hidden and always off in this version:
> no header switch, no art direction, no SD rules in prompts, and the SD Kit and
> SD guides are left out of the AI's tool list and help. The code stays in place;
> setting `SD_BRAIN_AVAILABLE` in `src/ai-sd-rules.js` to `true` brings all of it
> back. The description below is how it works when it is available.

**SD Brain** is a switch in the AI console header, the brain icon next to the
Offload Mode bird (off until you turn it on; it
is remembered across restarts, providers and new chats). It is art direction for
your prompts, not a library of models to copy:

- **Art direction first.** Every request sent with SD Brain on first goes to an
  art director: one short AI turn without tools that turns your words into an SD
  art brief (goal, role and size with a triangle and texture budget, silhouette,
  shape language, palette, one focal motif, what is painted rather than modelled,
  pitfalls to avoid, and checks for the result). The brief carries the Warcraft III
  style rules learned from Blizzard's models, so a short or weak prompt ("make a
  sword", "evil cup") still gets a coherent SD result, and a subject Warcraft never
  had ("a chalice worthy of Mordor") becomes SD shapes and symbols in that spirit.
  The brief shows as a collapsed **Art direction** row in the chat; the AI that
  does the work (or the Offload worker) receives it with your own words, which come
  first. Edits, UV mapping, cleanup and animation get a plan and a list of what to
  preserve instead of a new design.
- **Build, don't copy.** The AI does not search for, load or copy Warcraft or other
  models as a starting point unless you ask for it.
- **SD Kit.** New props are built with `src/sd-kit.js`: solid parts (turned shapes
  such as cups and stems, extruded outlines such as blades and emblems, spikes,
  rings and gems) that commit as one geoset with one hand-painted texture (light
  from above, dark creases and contact shadows, bright edges, a limited palette,
  painted runes, rivets, eyes or gems). The AI chooses shapes and materials; the kit
  paints, so textures no longer depend on the AI writing pixels.
- **Saving stays possible.** An AI edit that would leave the model unsavable is
  refused with a plain explanation, so a malformed part cannot block later review,
  Undo or saving.

- The state is captured when a task starts. Toggling during a task changes the
  next task, not the running one; a resumed task keeps its own state. Toggling
  starts no AI request and does not touch the model.
- The same policy text (`src/ai-sd-rules.js`: the SD Brain behavior plus the
  [Warcraft III SD rulebook](AI-SD-RULEBOOK.md)) goes into the trusted
  instructions of every turn for Codex, Claude Code and API providers. When it is
  off, each turn carries an explicit "off" state, so an earlier "on" in the chat
  history cannot keep applying. Offload workers inherit the organiser task's
  state, and with SD Brain on the organiser may look at a capture of the combined
  result. External MCP clients read the current state and instructions in every
  `mdlxl_context` result (`sdBrain`).
- Review: with SD Brain on, `mdlxl_review finish` with outcome passed needs a
  verdict for each criterion (fidelity, silhouette, sd-identity, coherence,
  craftsmanship, detail-value, motion, preservation): passed, needs-correction,
  unverified or not-applicable, each with an observation. Every `mdlxl_review
  inspect` also returns front, back, left and right views, so a part that only
  works from one side is seen; they are drawn off-screen, so the user's view never moves.
  A pass is refused while
  a criterion needs correction; the same criterion failing three times stops
  further revisions. Missing textures or a provider without image input leave
  appearance criteria unverified. A renderer preview is not gameplay acceptance.
- The [reference study](AI-SD-REFERENCE-STUDY.md) (3,448 distinct installed
  Blizzard models and 646 models from 90 approved Hive SD resources whose authors
  allow use and editing with credit, with limits, credits and source links) is
  available through `mdlxl_help`; it is not sent with every prompt.

**Continuous awareness** is an optional switch (the eye) in the prompt box.
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

**Look first, then change once.** Before the first edit of a job, the AI records
a plan (the **Planning the change** step; click it to read the plan):

- what is actually wrong, as it measured it;
- how far that cause reaches, which can be more or less than the area you marked;
- what must stay the same;
- at least two different fixes, what each costs, and which one it chose and why.

MDLxL refuses the AI's edits until the plan exists. Exact value edits, such as
"set the alpha to 0.5" or a rename, need no plan. The review then reminds the AI
to confirm every item it promised to keep. If a result shows the plan was wrong,
the AI records a new plan before editing again instead of patching on top.

**Versions side by side.** While it works, the AI can keep versions of the model
next to each other (the **Comparing versions** step). MDLxL keeps two kinds
automatically: **original** (the model before the first AI edit since it was
opened) and **before job 1**, **before job 2** and so on (the model before each
job's first edit). The AI can also save its own, such as "repair only". It can
list them, see what differs between any two, measure them side by side in a
script, and make the model exactly one of them again. Going back is one normal
Undo step, so you can undo it too. This means "go back to the good version" works:
ask for it by name or by job. Versions are kept until MDLxL closes; they are not
saved into the model file.

**Outside check.** When the AI says a model edit is finished, a separate AI that
never saw its work judges the result. It gets only your request, the plan's keep
list, the AI's own measured checks and the before/after pictures. It answers
good, doubtful or wrong, with how sure it is and what it saw. A doubtful or wrong
answer sends the job back with those reasons (up to twice) before the result
counts as verified. Each verdict is an **Outside check** step in the chat, with a
tick when good and a cross otherwise; click it to read the verdict, such as
"doubtful (confidence 60%) — the rim reads as smooth in the after picture". It is
on by default and costs one extra AI call per finished edit; turn it off with
**Outside check** in Connection settings. If the check cannot run, the job is not
blocked and the chat says why.

**Pictures of the parts in question.** The AI's pictures can show only chosen
geosets, framed on them, and use plain shading without textures, so shape, folds
and gaps are not hidden by the rest of the model. The AI is told to take the same
pictures before and after a change, so the pair compares like with like.

**Thinking effort.** Connection settings has a **Thinking effort** choice:
Provider default, Medium, High (the default) or Extra high. It sets how hard the
AI thinks before each step: Codex's reasoning effort, Claude Code's effort, or the
Claude API's effort (Claude 4.6 stops at High; older Claude models keep their own
setting). Higher is slower and uses more of your plan or credits. Job routing
always uses the provider default, since it only picks a bird. Other AI / local
model connections do not offer it.

**Guides and patterns.** With the Editing handbook on, each job also carries the
full guide (or two) its request touches, for example the binding guide for "the
legs clip into the skirt", instead of only a pointer to it. Patterns from
reference models, and rules you pass on in the chat, are given to the AI as
evidence about what is common and why, not as orders: it checks that this model
is like the cases the pattern comes from before applying it.

**Decision diary.** MDLxL keeps a short diary for each model: for every AI job,
your request, the plan (cause, chosen fix, why, what it kept), the edits it made,
whether the result was verified, and your next message as your reaction. Every new
job on that model, by any bird or provider, gets the last eight entries and is
told that earlier AI edits were choices it may undo, not part of your authored
model. The diary lives in MDLxL's own profile, so it survives switching between
Codex and Claude, a bird's memory filling up, and **Keep a summary** after
saving. **Wipe it all** deletes it with the chats.

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
uses the editor's normal validation and Undo history of its own model tab. If you
change that model or, while its tab is showing, its selection while the AI is
preparing an edit, that delayed edit is rejected and the AI can explain why. **Stop** cancels pending work; edits already applied stay
available in Undo. Nothing is saved automatically by sending a prompt.

**Attach** adds MDL/MDX reference models or PNG/JPEG/WebP reference images.
Reference models remain open as ordinary tabs. Image paste also works.

## Connections

| Choice | Setup |
| --- | --- |
| Codex / ChatGPT | Install the [Codex CLI](https://developers.openai.com/codex/cli), or use the installed Codex desktop app on Windows, then click **Sign in**. Complete the provider's sign-in page in your browser. |
| Claude Code | Install [Claude Code](https://code.claude.com/docs/en/setup), then click **Sign in**. Your plan must support Claude Code. |
| OpenAI API | Enter an OpenAI API key and choose a model that supports tools. |
| Claude API | Enter a workspace-scoped Claude API key and choose a model that supports tools. |
| Other AI / local model | Supply an OpenAI-compatible API base URL and model ID. HTTP is supported for localhost servers; remote endpoints use HTTPS. A local server need not require a key. |

The native CLI executable is found on PATH, or can be chosen by entering its full
path in Connection. PATH can omit a CLI (installed after Windows sign-in, or one
that came with a desktop app), so on Windows MDLxL also searches, in order:

- the official launcher folders: Codex's installer
  (`%LOCALAPPDATA%\Programs\OpenAI\Codex\bin`), Claude Code's native installer
  (`%USERPROFILE%\.local\bin`), npm (`%APPDATA%\npm`), pnpm, WinGet links and Scoop shims;
- the copy kept by the desktop app: Codex in `%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>`,
  Claude in `%LOCALAPPDATA%\Claude-Data\<package>\claude-code\<version>\<hash>` or
  `%APPDATA%\Claude\claude-code\<version>`, including their Store-virtualized
  `%LOCALAPPDATA%\Packages\…\LocalCache` folders. The newest file wins by modification time.

A working chosen path takes priority; if a saved path disappears after an update,
MDLxL searches again each time it launches the CLI. The saved setting and MDLxL's
own sign-in profile are preserved, so each person signs in with their own account.
npm launchers (`.cmd`) are not run through a shell: a JS entry runs with Node (the
launcher's adjacent `node.exe`, PATH, or `%ProgramFiles%\nodejs`) and a native
entry, such as Claude Code's `claude.exe`, runs directly.
A chosen path must name that provider's own CLI (`codex.exe`,
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
| `mdlxl_plan` | Embedded chat only: record the job's cause, reach, keep list, alternative fixes and choice before the first edit. |
| `mdlxl_versions` | Keep versions of the model side by side: list, save, compare, and use one again as one Undo step. Scripts read them as `references["version:NAME"]`. |
| `mdlxl_review` | Run task-specific assertions against `model` and original `before`, validate files, inspect actual images/animation samples and finish or request correction. |
| `mdlxl_context` | Live document, exact selection, animation context, references, diagnostics and enabled commands. |
| `mdlxl_read` | Read any model field, with typed arrays and explicit pagination. |
| `mdlxl_script` | General JavaScript using the complete model, references, captured selection and MDLxL's own modeling libraries. |
| `mdlxl_patch` | Precise JSON Pointer edits with typed values, validation and Undo. |
| `mdlxl_select` | Change real vertex, bone, geoset and exact transform-key selections. |
| `mdlxl_command` | Invoke existing editor commands using their normal behavior. |
| `mdlxl_view` | Change workspace, camera preset, render mode, local/global animation, frame, playback and fit; for a tab that is not showing, the task's own view. |
| `mdlxl_sample` | Measure node world transforms and skinned vertex positions/bounds across up to 32 frames without moving the playhead. |
| `mdlxl_capture` | Inspect real viewport images, including up to 12 labeled camera/frame samples per call, drawn off-screen. A sample with `fit: selection` is a close-up of the marked vertices in that frame. |
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
to `App.edit`, selection and existing commands; its `env(target)` resolves the
task's own tab (the live editor when showing, else that tab's document with the
task's captured selection and view). `src/ai-tab.js` edits, undoes and selects in
a tab that is not showing; `app/AiOffscreenRender.jsx` draws pictures in a hidden
`GamePreview`. `electron/ai-service.cjs` owns
connections, credentials, chat persistence and IPC. Native provider transports
are in `electron/ai-providers.cjs`; external MCP is in `electron/ai-mcp.cjs`.
`ai-sandbox.html` is a separate Vite entry with its own restricted preload/CSP.
The main editor's CSP remains unchanged.

Focused checks: `node --test test/ai-*.test.js` (background work:
`test/ai-background.test.js`; in the packaged app, `test/ai-console.electron.cjs`
edits a second tab while a bird edits the first). The native interaction test is
`test/ai-editor.electron.cjs`; run it on a hidden Windows desktop with a disposable
profile. `MDLXL_AI_TEST_EXE` selects a packaged executable and `MDLXL_AI_TEST_OUT`
selects its report directory. It uses a local provider fixture, so it does not
authenticate to a paid account. Native provider account tests are separate from
model-editing verification.

For an opt-in real-provider acceptance check, use `test/ai-live.electron.cjs` on
the hidden desktop. Set `MDLXL_AI_LIVE_PROFILE` to the MDLxL profile whose owner
has signed in, plus the same packaged executable and report variables above.
`test/ai-live-tabs.electron.cjs` is the same kind of opt-in check for several
model tabs at once (15 small prompts on three generated models, jobs side by side);
give its profile its own sign-in rather than a copied one.
This makes real model requests against generated fixtures, checking selected
vertex edits, one Undo, mirror/weld, sparse animation keys, unchanged other data,
program help and MDX/MDL reopening. It preserves the signed-in profile and never
overwrites the owner's model files. Authentication must succeed before edits run.
