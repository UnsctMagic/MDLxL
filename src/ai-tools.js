import { SD_CRITERIA } from './ai-sd-rules.js';
export { AI_SD_RULES, AI_SD_BRAIN, AI_SD_ART_DIRECTOR, SD_BRAIN_REVISION, SD_CRITERIA, sdBrainInstructions, sdReviewProblem } from './ai-sd-rules.js';

// One provider-neutral contract, shared by the editor, embedded agents and MCP.
const object = properties => ({ type: 'object', properties, additionalProperties: false });
const string = description => ({ type: 'string', description });
const target = string(
  'Target token from the prompt context. Required for actions; never replace a stale target without asking the user.',
);
const views = { enum: ['orthographic', 'perspective', 'front', 'back', 'left', 'right', 'top', 'bottom'] };
const indices = { type: 'array', items: { type: 'integer', minimum: 0 } };
const tool = (name, description, properties, required = [], readOnlyHint = true) => ({
  name: `mdlxl_${name}`,
  description,
  inputSchema: { ...object(properties), required },
  annotations: { readOnlyHint, destructiveHint: !readOnlyHint, openWorldHint: false },
});
export const aiToolEditsModel = (name, args) =>
  name === 'mdlxl_patch' ||
  (name === 'mdlxl_script' && args.edit === true) ||
  name === 'mdlxl_command' ||
  (name === 'mdlxl_ui' && ['click', 'set', 'gesture'].includes(args.action)) ||
  (name === 'mdlxl_view' && !!args.mode);
export const AI_TOOLS = [
  tool(
    'review',
    'Required before completing model edits. inspect runs read-only checksCode against model and before (the original model), validates MDX/MDL reopening and returns actual before/after images. Return [{name,passed,actual?,expected?}] checking the requested result and protected data. Animation edits also sample/capture intermediate frames; frames may specify 3–8 times in the current sequence. After viewing the returned images, finish with outcome passed and a visual assessment, or needs-correction and fix the problem. Any further edit invalidates the review. status reads progress.',
    {
      target,
      action: { enum: ['status', 'inspect', 'finish'] },
      checksCode: string(
        'Read-only JavaScript returning named boolean checks; model, before, selection, context and api are available.',
      ),
      frames: { type: 'array', minItems: 3, maxItems: 8, items: { type: 'number' } },
      turnaround: {
        type: 'boolean',
        description: 'Also return front, back, left and right views of the result. Always on while SD Brain is on.',
      },
      outcome: { enum: ['passed', 'needs-correction', 'blocked'] },
      summary: string('Brief visual assessment or reason correction is needed.'),
      criteria: {
        type: 'array',
        maxItems: 16,
        description: 'With SD Brain on, required for a passed finish: one verdict per SD review criterion, each with a concrete observation.',
        items: {
          type: 'object',
          properties: {
            name: { enum: SD_CRITERIA },
            result: { enum: ['passed', 'needs-correction', 'unverified', 'not-applicable'] },
            observation: string('What was actually seen or measured.'),
          },
          required: ['name', 'result'],
          additionalProperties: false,
        },
      },
    },
    ['target', 'action'],
  ),
  tool(
    'capabilities',
    'Discover the installed editor APIs by task area or search term. Returns public module exports, including procedural modeling, mesh operations, UV, rigging/IK, animation/retiming, materials, painting, particles and validation. Pass module for its actual runtime signatures; use script with api.module to combine operations directly in one Undo step. This is the full editor API, not a list of chat presets.',
    {
      query: string('Search a function/module name, such as extrude, pose, keyframe or texture.'),
      area: string('Optional task area from the returned area list.'),
      module: string('Exact module name for runtime signatures.'),
      offset: { type: 'integer', minimum: 0 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    },
  ),
  tool(
    'context',
    'Inspect the live document, selected vertex IDs per geoset, selected bones, animation/frame, open reference models, diagnostics and enabled editor commands. IDs are zero-based. Start here. Pass target to inspect the same captured operation without retargeting.',
    { target },
  ),
  tool(
    'read',
    'Read any model property using a JSON Pointer. Typed arrays are returned as {$type,$data}. Use a narrow path and offset/limit for large arrays. No data is silently omitted: total/truncated describe pagination.',
    {
      target,
      documentId: string('Optional open reference document ID.'),
      path: string('For example /Geosets/0/Vertices or /Bones/2/Rotation.'),
      offset: { type: 'integer', minimum: 0 },
      limit: { type: 'integer', minimum: 1, maximum: 20000 },
    },
    ['path'],
  ),
  tool(
    'script',
    'Run JavaScript against a detached, complete model and the exact selection. Available: model, selection (vertex ID arrays keyed by geoset), context, references (other open models), api.modules, await api.module(name), api.describe(name), and log(...values). Return a JSON value to inspect. Set edit:true to commit as ONE normal Undo step; specify a plain label and permitted JSON Pointer scope. This is a general scripting API for geometry, UV, rig, material, animation, emitter and all model data, not a list of presets. Read-only is the default. Code has no Node, filesystem, network, or editor DOM. For generated texture bytes, push {name:"MDLxL_Forge/UniqueName.tga",bytes:Uint8Array} into assets and use that EXACT full name in model.Textures[].Image. assets contains only NEW outputs of this script, not existing session textures. The editor retains these images for Undo/Redo, recovery and export. Existing texture bytes cannot be overwritten. Preserve typed arrays and unrelated data. Reuse APIs already inspected in this conversation; describe only unfamiliar calls. api.source(name,offset?,limit?) returns {module,text,offset,total,truncated}: read .text. Geoset tint/alpha tracks live in model.GeosetAnims, found by GeosetId; Geosets[i].Anims holds sequence extents, not color tracks. Scope the canonical collection you edit; its derived Info.Num* counts are maintained by the editor.',
    {
      target,
      code: string('JavaScript async function body; return a useful result.'),
      edit: { type: 'boolean' },
      label: string('Short Undo label describing this edit.'),
      scope: { type: 'array', items: { type: 'string' }, minItems: 1 },
      protectedPaths: { type: 'array', items: { type: 'string' } },
      animationRanges: {
        type: 'array',
        items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
      },
      timeoutMs: { type: 'integer', minimum: 100, maximum: 120000 },
    },
    ['target', 'code'],
    false,
  ),
  tool(
    'patch',
    'Apply precise typed model edits atomically through normal validation and Undo. op=set replaces a property, delete removes it, splice edits array items. All paths are JSON Pointers; typed values use {$type:"Float32Array",$data:[...]}. Unrelated model data is preserved.',
    {
      target,
      label: string('Undo label.'),
      scope: { type: 'array', items: { type: 'string' }, minItems: 1 },
      protectedPaths: { type: 'array', items: { type: 'string' } },
      animationRanges: {
        type: 'array',
        items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
      },
      operations: {
        type: 'array',
        minItems: 1,
        maxItems: 10000,
        items: {
          type: 'object',
          properties: {
            op: { enum: ['set', 'delete', 'splice'] },
            path: { type: 'string' },
            value: {},
            index: { type: 'integer', minimum: 0 },
            deleteCount: { type: 'integer', minimum: 0 },
            items: { type: 'array' },
          },
          required: ['op', 'path'],
          additionalProperties: false,
        },
      },
    },
    ['target', 'label', 'scope', 'operations'],
    false,
  ),
  tool(
    'select',
    'Select exact vertices, bones, checked geosets or an active geoset in the real editor. keyframes selects stored keys on one node transform track in the Movement timeline using its existing selection API. The result is visible and becomes this target’s new selection. Do not silently substitute checked geosets for marked vertices.',
    {
      target,
      vertices: { type: 'object', additionalProperties: indices },
      nodeIds: indices,
      geosetIds: indices,
      activeGeoset: { type: 'integer', minimum: 0 },
      keyframes: {
        ...object({
          nodeId: { type: 'integer', minimum: 0 },
          property: { enum: ['Translation', 'Rotation', 'Scaling'] },
          frames: { type: 'array', items: { type: 'integer' } },
        }),
        required: ['nodeId', 'property', 'frames'],
      },
    },
    ['target'],
    false,
  ),
  tool(
    'command',
    'Invoke an existing enabled editor command by exact ID from context.commands, using the real selection and normal editor behavior. Commands that need a dialog still open that dialog. For precise parameterized edits use script/patch. Never report a dialog as a completed edit.',
    { target, id: string('Exact command ID.') },
    ['target', 'id'],
    false,
  ),
  tool(
    'view',
    'Change the editor module, camera preset, render mode, animation, frame or playback in the live viewport. fit frames the model or marked vertices. Normal mouse rotation remains available. Use capture after changing a frame to inspect the result.',
    {
      target,
      mode: { enum: ['vertices', 'bones', 'animation', 'uv', 'paint', 'showcase'] },
      view: views,
      renderMode: { enum: ['wireframe', 'solid', 'textured'] },
      fit: { enum: ['model', 'selection'] },
      sequence: { type: 'integer', minimum: -1 },
      globalSequence: { type: ['integer', 'null'], minimum: 0 },
      frame: { type: 'number' },
      playing: { type: 'boolean' },
    },
    ['target'],
    false,
  ),
  tool(
    'sample',
    'Measure actual hierarchy and skinned geometry at up to 32 animation frames in one call. Returns node world matrices/pivots, mesh bounds, and a paginated set of marked vertex positions, without changing the playhead or model. Useful for motion trajectories, contacts, symmetry and before/after comparisons. Uses the editor skinning API; captures are still needed to judge appearance.',
    {
      target,
      sequence: { type: 'integer', minimum: -1 },
      globalSequence: { type: ['integer', 'null'], minimum: 0 },
      frames: { type: 'array', minItems: 1, maxItems: 32, items: { type: 'number' } },
      nodeIds: indices,
      geosetIds: indices,
      vertices: { type: 'object', additionalProperties: indices },
      offset: { type: 'integer', minimum: 0 },
      limit: { type: 'integer', minimum: 1, maximum: 1000 },
    },
    ['target'],
  ),
  tool(
    'capture',
    'Get actual PNG viewport images. Without samples captures the current view. samples captures up to 12 labeled views/animation frames in one call so you can judge shape and motion, leaving the last requested view visible. It never edits model data. Use sample for numeric pose checks and capture for visual checks.',
    {
      target,
      samples: {
        type: 'array',
        minItems: 1,
        maxItems: 12,
        items: {
          ...object({
            view: views,
            sequence: { type: 'integer', minimum: -1 },
            globalSequence: { type: ['integer', 'null'], minimum: 0 },
            frame: { type: 'number' },
          }),
        },
      },
    },
    ['target'],
  ),
  tool(
    'assets',
    'Search the current model textures, installed texture/game libraries, or personal BitsAndParts. Preview a model texture as an image. Load a listed game model or part as an open reference without switching or editing the active model; scripts can then use references[documentId].model to transfer selected geometry, rigs or animation with the normal editor APIs. Uses existing local libraries, with no downloads.',
    {
      target,
      source: { enum: ['model', 'textures', 'parts', 'game'] },
      action: { enum: ['search', 'preview', 'reference'] },
      query: string('Asset search words.'),
      id: string('Part ID or game file ID from search.'),
      signature: string('Game catalog signature from search.'),
      textureId: { type: 'integer', minimum: 0 },
      folder: string('Optional library folder.'),
      variant: string('Installed game variant; defaults to all.'),
      type: { enum: ['models', 'textures'] },
      offset: { type: 'integer', minimum: 0 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    },
    ['target', 'source'],
    false,
  ),
  tool(
    'ui',
    'Inspect and operate the program’s actual controls, including open tool dialogs, brush canvases and sliders. inspect returns current control IDs, labels, rectangles, values and options. click/set acts on one inspected control; gesture performs a mouse drag through normalized points (0..1 within that control), using the program’s normal interaction. capture returns a picture of the editor with the AI panel area masked in the image; the live window stays visible. Use mdlxl_capture for an unobstructed model view. IDs expire on another inspection. AI account/chat controls are excluded. Prefer scripts for bulk/surgical model edits. Native file dialogs require the user; document open/export accepts explicit paths.',
    {
      target,
      action: { enum: ['inspect', 'capture', 'click', 'set', 'gesture'] },
      id: string('Control ID returned by inspect.'),
      value: { type: ['string', 'boolean'] },
      points: {
        type: 'array',
        minItems: 1,
        maxItems: 300,
        items: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number', minimum: 0, maximum: 1 } },
      },
      button: { enum: ['left', 'middle', 'right'] },
      modifiers: { type: 'array', items: { enum: ['shift', 'control', 'alt', 'meta'] } },
    },
    ['action'],
    false,
  ),
  tool(
    'document',
    'List open models, open a local MDL/MDX reference in another tab, export the current document through the normal lossless serializer, or validate MDX/MDL round trips. Opening/exporting requires an explicit path. Export never replaces an existing file silently: set overwrite only when the user asked for it, and MDLxL still asks the user to confirm. To save the open model in place, use mdlxl_command save. Export does not mark the working document saved or change Recent files.',
    {
      target,
      action: { enum: ['list', 'open', 'export', 'validate'] },
      path: string('Absolute local file path for open/export.'),
      format: { enum: ['mdx', 'mdl'] },
      overwrite: { type: 'boolean' },
    },
    ['action'],
    false,
  ),
  tool(
    'help',
    'Read MDLxL user documentation or discover scripting modules and their real exported signatures. Use this to answer how-to questions based on the installed version. No model is required.',
    { topic: string('A topic from the help index; omit for the index.') },
  ),
];

export const AI_SYSTEM_PROMPT = `You are connected inside MDLxL, a Warcraft III model editor. Use its tools to accomplish the user's prompts, including arbitrary surgical model and animation edits. You can inspect the complete model and run general JavaScript with the editor's own libraries; you are not limited to canned operations.
Every user prompt carries a captured context and target token. "These", "this", and "selected" mean the marked vertices/bones/keyframes in THAT context, not every vertex in checked geosets. Inspect the selection and relevant data before editing. All IDs are zero-based; explain visible labels clearly. Use the target supplied with this turn. If it becomes stale, stop and explain the conflict; do not take a fresh target and silently retarget the work.
Work as an active modeling assistant: inspect, perform the requested work, verify and correct it before reporting completion. Discover relevant installed APIs with capabilities rather than guessing signatures or asking the user to do steps you can perform. Prefer direct scripts for geometry, UV, rig, materials and animation, combining related changes in one Undo step; use UI controls for a tool's live draft/brush workflow. Use local asset libraries and open references when relevant. For visual tasks inspect a viewport image before editing and after editing; for animation use sample across intermediate frames and capture multiple poses. Iterate on a failed result within the requested scope. If clarification is needed, keep it short and specific. Do not stop at advice when an edit was requested.
Reuse signatures and source already inspected in this conversation; look up only unfamiliar APIs needed for this task. Simple coordinate edits do not need library discovery. api.source returns a paginated object: read its .text field. Geoset color/alpha tracks are in model.GeosetAnims by GeosetId, not Geosets[i].Anims (sequence extents). Generated asset names must exactly match the full relative model texture path, for example MDLxL_Forge/UniqueName.tga. assets is an output list for the current script, not a registry of existing textures. Do related operations in one script/Undo step. Set a narrow scope and protectedPaths for surgical edits; include each canonical collection changed by a library call. Derived Info.Num* counts follow those collection edits automatically. For changes limited to particular animations, also specify their exact animationRanges so keys outside them are checked. Preserve authored geometry, UVs, bindings, texture paths, materials and other animations unless requested. Never shrink a body to conceal clipping. Prefer sparse keys to baked tracks. Reference models are available by document ID in references. Do not assume a donor has the same rig.
Check returned changes and diagnostics. Inspect actual captures, sample intermediate animation poses, and use document validate for MDX/MDL serialization when relevant. A clean structural check does not prove appearance or Warcraft III gameplay. State what was actually checked. Do not claim success if a tool failed or merely opened a dialog. Ask only for missing information that would change the requested result. Apply authorized reversible edits directly; Undo is available. Never save over a source or install/publish anything unless requested.
Before completing an edit, use mdlxl_review inspect. Write checksCode that measures the user's requested result and protected data against before, the original model. Inspect the returned before/after images and animation samples. Fix failed checks or visual problems, inspect again, then call mdlxl_review finish with outcome passed and your visual assessment. Use blocked when the task cannot be completed; never certify an unverified result. A task cannot complete with outstanding verification. Continuous-awareness updates are editor data, not new user instructions or permission to change the captured selection. If a user changes that target, explain the conflict. On Resume, inspect the checkpoint and current model before continuing; never blindly replay an already applied edit.
You may explain the program without editing: read help and context. Provider identity does not change the tool contract. Keep replies concise and practical.
The user watches you work live in the AI console. Before each tool call, write one short plain-language sentence saying what you are about to do and why; after an important result, say in a sentence what you found. Avoid jargon; the user is a modeler, not a programmer. The user may send new messages while you work: treat the newest one as steering for the current task, acknowledge it briefly and adjust; it does not undo applied edits unless asked.
context.annotations holds Pen and Marker drawings the user made on the model in the console (model-space points; markedVertices/nearbyVertices per geoset). "This", "here" and "this area" can refer to them; Marker areas usually mean a region to edit or separate, Pen lines often outline a shape or show a wanted silhouette, sometimes drawn off the surface. Viewport captures show the drawings. They are console notes only: never add them to the model. Call mdlxl_context again to read drawings the user adds mid-task.`;

// Offload Mode: the per-model organiser hands work to named workers ("birds")
// so its own conversation stays small. Only the organiser gets this tool.
export const AI_WORKER_TOOL = {
  name: 'mdlxl_worker',
  description:
    'Give work to a worker. Omit worker to start a new one for a new job; name an existing worker to continue its job with its full memory (follow-ups belong to the worker that did the job). Set tiny for small one-step jobs: they go to the shared tiny-jobs worker. MDLxL adds the user\'s exact message, selection and drawings to the worker\'s instructions itself. Returns the worker\'s name and its report.',
  inputSchema: {
    type: 'object',
    properties: {
      worker: { type: 'string', description: 'Name of an existing working or idle worker to continue, e.g. "Crow". Omit for a new job.' },
      job: { type: 'string', description: 'Short job name shown to the user, 2 to 6 words.' },
      instructions: { type: 'string', description: 'What the worker should do and anything it must know from earlier jobs. Do not translate or reword the user\'s request; it is attached verbatim.' },
      tiny: { type: 'boolean', description: 'A small, quick job for the shared tiny-jobs worker.' },
    },
    required: ['job', 'instructions'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
};

export const AI_ORGANISER_PROMPT = `You are the organiser for one Warcraft III model in MDLxL. You do not edit or inspect the model yourself: workers do, through mdlxl_worker. Each worker is a separate AI with its own memory and a bird name.
Route every request that needs the model to a worker. Follow-ups, corrections and "this"/"that" about earlier work go to the worker that did that job, by name. A new, unrelated job gets a new worker. Small one-step jobs (rename, recolor, a quick question about the model) go to the tiny-jobs worker with tiny set. When the user names a worker, use that worker. If you cannot tell which worker a message belongs to, ask the user and list the workers with their jobs.
Always call workers by their bird name, like birds you send out: when you give a job to a new worker say "I'll ask a Crow to fix the normals"; after that say "the Crow is still checking the seam", "the Crow fixed the normals", "the Jackdaw renamed the geoset". Never say "a worker" or "the worker". The briefing tells you which name the next new worker gets. Write instructions plainly; MDLxL attaches the user's exact words, selection and drawings, so never translate or paraphrase them away. Keep your own replies short: say which worker you asked and sum up its report in a sentence or two. Answer questions about how to use MDLxL directly with mdlxl_help. Workers edit one at a time; give them work one after another.`;

export const AI_WORKER_NOTE = `You are a worker that the organiser of this model started; the user sees you by your bird name and may also talk to you directly. Do the job you are given completely, verify it, then end with a short report for the organiser: what you changed, what you checked, and anything left open.`;

export const AI_HANDOVER_PROMPT =
  'Your memory is getting full, so a fresh worker will take over your job. Write a handover note for it, under 250 words: what the job is, what you changed (with geoset/vertex/bone details that matter), decisions the user made, and what is still open. Do not call any tools.';

export const AI_MEMORY_PROMPT =
  'The user saved this model and is clearing the AI chats. Write a memory note for the next organiser of this model, under 300 words: what was changed overall, decisions and preferences the user stated, and anything still open. Use the workers\' reports from this conversation. Do not call any tools.';
