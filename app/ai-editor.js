import { AI_TOOLS, AI_DISPLAY_COMMANDS, aiToolEditsModel, aiToolRunsUnqueued } from '../src/ai-tools.js';
import { captureJobBase, changedSource, forkJob, deliverJob } from './ai-job-copy.js';
import { isolatePaintRegion } from '../src/paint-region.js';
import {
  aiSelectionSignature,
  checkAiTarget,
  readAiModel,
  patchAiModel,
  prepareAiEdit,
  applyAiEdit,
  encodeAiValue,
  limitAiOutput,
  newSaveProblems,
  fileEditScope,
  mergeFileModel,
} from '../src/ai-model.js';
import { openDocument } from '../src/editor-document.js';
import { prepareModelSaveAsync } from './model-save.js';
import { flushSync } from 'react-dom';
import { aiCapabilities } from './ai-capabilities.js';
import { sampleAiModel } from '../src/ai-sampling.js';
import { animationEditReport } from '../src/ai-motion-style.js';
import { mdxSizeBreakdown } from '../src/ai-model-size.js';
import { meshHealth } from '../src/mesh-health.js';
import { checkSanity } from '../src/sanity-check.js';
import { sanityForAi } from '../src/ai-sanity.js';
import { hiveSanity } from './optimizexl-hive.js';
import { aiAssets, validateAiAssets, loadTextureAsset } from './ai-assets.js';
import { gamePathKey } from '../src/game-path.js';
import {
  clampZoom,
  groupGeosetsByTexture,
  markedUvPoints,
  uvArray,
  uvBounds,
  uvEdges,
  uvPictureGeosets,
  uvPictureSize,
  uvRange,
  uvTiles,
  uvIslands,
  layerText,
} from '../src/ai-uv-picture.js';
import {
  TRAIL_COLORS,
  TRAIL_NAMES,
  checkPictureOptions,
  concatPoints,
  drawnGeosets,
  filmstripFrames,
  filmstripLayout,
  frameCaption,
  hasEffects,
  motionTrails,
  picturePose,
  posedPoints,
  poseMatrices,
  trailNodeIds,
} from '../src/ai-picture.js';
import { motionPathMarker } from '../src/motion-path.js';
import { sketchContext, sketchStore } from '../src/ai-sketch.js';
import { aiCheckpoint, beginAiReview, recordAiChange, reviewAiModel, reviewStatus } from './ai-review.js';
import { SD_BRAIN_AVAILABLE } from '../src/ai-sd-rules.js';
import { createVersionStore } from '../src/ai-versions.js';
import { screenEngineHint } from '../src/ai-screen-names.js';
import { createWatchFollower, spreadVertices, tabToShow, watchLook, watchTargetRule } from './ai-watch.js';
import { aiReplay } from './ai-replay.js';
import { forgetReplayPictures } from './ai-replay-stage.js';
import { centerOf } from '../src/ai-replay.js';
import { MESH_ACTIONS, GEOSET_ACTIONS, CUT_ACTION, applyMeshAction, applyGeosetAction, applyCut, remapGeosetSet, workplaneAxis } from '../src/mesh-actions.js';

const guides = import.meta.glob(['../docs/*.md', '../README.md'], { query: '?raw', import: 'default' });
const settle = () => new Promise(resolve => setTimeout(resolve, 60));
const finite = (value, name) => {
  if (!Number.isFinite(value)) throw Error('Invalid ' + name);
  return value;
};
// The view a task was captured with, in the shape host.restoreContext takes.
const viewSnapshot = state => ({
  mode: state.mode,
  workplane: state.workplane,
  uvSet: state.uvSet,
  activeGeoset: state.activeGeoset,
  checkedGeosets: Array.from(state.selectable || []),
  selection: structuredClone(state.selection || {}),
  selectedNodeIds: [...(state.selectedNodeIds || [])],
  globalSequence: state.globalSeqId,
  sequence: state.sequence,
  frame: state.time,
  keyframes: structuredClone(state.keyframes ?? null),
});
const LEFT_TAB = "The user left this model's tab before this step could run. Try it again; it waits until they return.";
// Steps that need MDLxL's own buttons, windows or timeline on screen.
// Editor commands that also run on a model tab that is not showing, or on the job's
// private copy: Undo/Redo, the mesh tools, selection commands and view commands (the
// task's own view). Commands that open a window or need the screen wait for the tab.
const VIEW_COMMANDS = {
  ...Object.fromEntries(['perspective', 'orthographic', 'front', 'back', 'left', 'right', 'top', 'bottom'].map(view => [view, { view }])),
  frame: { renderMode: 'textured' },
  frameSelection: { renderMode: 'solid' },
  wireframe: { renderMode: 'wireframe' },
  fit: {},
  fitSelection: {},
  ...Object.fromEntries(['vertices', 'uv', 'bones'].map(mode => [mode, { mode }])),
  animation: { mode: 'animation' },
};
const SELECTION_COMMANDS = ['selectAll', 'clear', 'invertSelection'];
const runsOffScreen = id => ['undo', 'redo'].includes(id) || MESH_ACTIONS.includes(id) || Object.hasOwn(GEOSET_ACTIONS, id) || id === CUT_ACTION || SELECTION_COMMANDS.includes(id) || Object.hasOwn(VIEW_COMMANDS, id);
// The engines behind tool windows, for scripts on a model that is not on screen.
const WINDOW_ENGINES = {
  optimizeModel: 'optimizexl-run.optimizeModelStage / planToSize (search capabilities for "optimize")',
  uv: 'uv-actions and the UV modules (search capabilities for "uv")',
  animXL: 'anim-xl.buildAnimXL / applyAnimXL and the animation modules (search capabilities for "animation")',
  surfaceEffects: 'the FX modules (search capabilities for "fx")',
  autoCorpse: 'auto-corpse.autoCorpse (search capabilities for "corpse")',
  forge: 'forge-vertex-run and the forge modules (search capabilities for "forge")',
  bitsAndParts: 'bits-and-parts (mdlxl_assets source parts)',
  paint: 'the painting modules (search capabilities for "paint")',
  sanityCheck: 'sanity-check.checkSanity',
  particles: 'particle-recipes, glow-up and the particle modules (search capabilities for "particle")',
  textureLibrary: 'material-presets and texture-references (search capabilities for "material")',
};
// What to use instead when a screen-only step meets the job's private copy.
const screenOnly = (name, args) => {
  const engine = name === 'mdlxl_command' && (screenEngineHint(args.id) || WINDOW_ENGINES[args.id]);
  return 'This step needs the model on screen, and this job now works on a private copy because the user changed the model. ' +
    (engine ? 'Use ' + engine + ' in mdlxl_script instead.' : 'Use mdlxl_script with the editor modules instead; mesh tools, selection and view commands run here too.');
};
// Optional numbers of the mesh tools: Extrude distance, the Mirror/Collapse/Weld pivot, the Rotate normals angle.
const meshParameters = args => {
  const out = {};
  if (args.distance !== undefined) { if (!Number.isFinite(args.distance)) throw Error('distance must be a number.'); out.distance = args.distance; }
  if (args.angle !== undefined) { if (!Number.isFinite(args.angle)) throw Error('angle must be a number of degrees.'); out.normalAngle = args.angle; }
  if (args.pivot !== undefined) { if (!Array.isArray(args.pivot) || args.pivot.length !== 3 || !args.pivot.every(Number.isFinite)) throw Error('pivot must be [x, y, z].'); out.pivot = args.pivot; }
  return out;
};
// After an edit that changed animation data: which animations changed, how many stayed identical and
// the motion warnings the edit added. Information for the AI, never a refusal.
function animationNotes(before, after) {
  try {
    const animation = animationEditReport(before, after);
    return animation ? { animation } : {};
  } catch {
    return {};
  }
}
// Where the saved MDX bytes go (validate), for size limits such as "under 250 KB".
function sizeOf(bytes, model) {
  try {
    return { size: mdxSizeBreakdown(bytes, model) };
  } catch {
    return {};
  }
}
// Model-space positions of the marked vertices, posed at the picture's frame.
function markedPositions(model, selection = {}, sequence, globalSequence, frame) {
  // The kept original of an edited model can have fewer vertices than the selection names.
  const valid = Object.entries(selection)
    .map(([gi, ids]) => [gi, model.Geosets[gi] ? ids.filter(i => i * 3 < model.Geosets[gi].Vertices.length) : []])
    .filter(([, ids]) => ids.length);
  if (!valid.length) return [];
  if (sequence < 0 && globalSequence == null)
    return valid.flatMap(([gi, ids]) => ids.flatMap(id => Array.from(model.Geosets[gi].Vertices.subarray(id * 3, id * 3 + 3))));
  try {
    const sampled = sampleAiModel(
      model,
      { frame, sequence, globalSequence, selectedNodeIds: [] },
      { frames: [frame], vertices: Object.fromEntries(valid), limit: 1000 },
    );
    return sampled.samples[0].geosets.flatMap(g => g.selected.positions.flatMap(p => p.position));
  } catch {
    return [];
  }
}
const needsScreen = (name, args) =>
  name === 'mdlxl_ui' ||
  (name === 'mdlxl_command' && !runsOffScreen(args.id)) ||
  (name === 'mdlxl_select' && !!args.keyframes);
// At most this many UV islands get a number in a UV picture.
const MAX_ISLAND_NUMBERS = 40;
const loadPicture = async url => {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
};
// One picture of several frames: each cell shrunk into a grid, its caption in the top-left corner.
async function composeFilmstrip(urls, captions) {
  const layout = filmstripLayout(urls.length),
    canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext('2d');
  context.fillStyle = '#202020';
  context.fillRect(0, 0, layout.width, layout.height);
  context.font = 'bold 15px Tahoma, sans-serif';
  context.textBaseline = 'top';
  for (const [i, url] of urls.entries()) {
    const { x, y } = layout.cells[i],
      picture = await loadPicture(url),
      // Whole picture in its cell, shape kept (a portrait-shaped camera picture is narrower).
      fit = Math.min(layout.cellWidth / picture.naturalWidth, layout.cellHeight / picture.naturalHeight),
      w = picture.naturalWidth * fit,
      h = picture.naturalHeight * fit;
    context.drawImage(picture, x + (layout.cellWidth - w) / 2, y + (layout.cellHeight - h) / 2, w, h);
    context.strokeStyle = '#202020';
    context.lineWidth = 2;
    context.strokeRect(x + 1, y + 1, layout.cellWidth - 2, layout.cellHeight - 2);
    const text = `${i + 1}: ${captions[i]}`,
      width = context.measureText(text).width;
    context.fillStyle = 'rgba(0,0,0,0.7)';
    context.fillRect(x + 4, y + 4, width + 10, 21);
    context.fillStyle = '#ffffff';
    context.fillText(text, x + 9, y + 7);
  }
  return canvas.toDataURL('image/png');
}
function checkView(args, model) {
  if (
    args.sequence !== undefined &&
    (!Number.isInteger(args.sequence) || args.sequence < -1 || args.sequence >= model.Sequences.length)
  )
    throw Error('Animation index is out of range.');
  if (args.frame !== undefined) finite(args.frame, 'animation frame');
  if (
    args.globalSequence != null &&
    (!Number.isInteger(args.globalSequence) || !(model.GlobalSequences[args.globalSequence] > 0))
  )
    throw Error('Global animation index is out of range.');
  if (args.globalSequence != null && args.sequence !== undefined)
    throw Error('Choose a local or global animation, not both.');
}
// Checks a capture sample's close-up, wireframe and UV-layout options.
function checkSample(sample, model) {
  for (const key of ['uv', 'wireframe'])
    if (sample[key] !== undefined && typeof sample[key] !== 'boolean') throw Error('Invalid ' + key + ' option.');
  if (sample.zoom !== undefined && !(Number.isFinite(sample.zoom) && sample.zoom >= 1 && sample.zoom <= 8))
    throw Error('Zoom is 1 to 8.');
  if (sample.uvSet !== undefined && !Number.isInteger(sample.uvSet)) throw Error('Invalid UV set.');
  if (sample.uvSet !== undefined && !(sample.uvSet >= 0)) throw Error('Invalid UV set.');
  for (const [gi, ids] of Object.entries(sample.vertices || {}))
    if (
      !/^\d+$/.test(gi) ||
      !model.Geosets[gi] ||
      !Array.isArray(ids) ||
      !ids.length ||
      ids.some(i => !Number.isInteger(i) || i < 0 || i >= model.Geosets[gi].Vertices.length / 3)
    )
      throw Error('Invalid vertices: use geoset index -> vertex ids that exist in this model.');
  checkPictureOptions(sample, model);
}
// The open model with the edits an MDL or MDX file makes to it (for example a file a
// Python script wrote from an export). The file is read through the normal opener and
// compared with the open model as that format reads it back, so only real edits count.
async function modelFromFile(path, doc, before) {
  if (typeof path !== 'string' || !path) throw Error('Give the MDL or MDX file to apply.');
  const record = await window.desktop.aiReadModel({ path });
  const file = openDocument(record.bytes, record.name);
  if (file.readOnly) throw Error('This file can only be opened read-only, so it cannot be applied.');
  const format = String(record.name).toLowerCase().endsWith('.mdl') ? 'mdl' : 'mdx';
  let base = before;
  try {
    base = openDocument((await prepareModelSaveAsync(doc, format)).bytes, 'base.' + format).model;
  } catch {
    // Without a read-back the file is compared with the open model itself.
  }
  return mergeFileModel(before, base, file.model);
}
export class AiEditorBridge {
  constructor(host) {
    this.host = host;
    this.saveBaselines = new WeakMap();
    this.reportedSaveIssues = new WeakSet();
    this.targets = new Map();
    this.chats = new Map();
    this.controls = new Map();
    // Steps run in order per model tab; tasks on different models do not wait on each other.
    this.queues = new Map();
    this.waiters = new Set();
    // Versions the AI keeps side by side, per model tab, until MDLxL closes.
    this.versionStore = createVersionStore();
    // The open console listens here instead of redrawing with every editor render.
    this.listeners = new Set();
    this.subscribe = listener => {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    };
    // View AI work: off unless the console's switch is on and the console is open.
    this.watch = false;
    this.watchState = { shown: null };
    this.follower = createWatchFollower(request => this.applyFollow(request));
  }
  // The console turns View AI work on or off; it applies from the next tool call.
  setWatching(on) {
    if (this.watch === !!on) return;
    this.watch = !!on;
    this.watchState.shown = null;
    if (!on) {
      this.follower.cancel();
      aiReplay.stop();
    }
    this.editorChanged();
  }
  // View AI work replay: before an edit on the model tab on screen, the views keep their
  // picture and the model's state is remembered; after it, the step replays from that
  // state to the new one. Display only, and the AI's call never waits for it.
  armReplay(env) {
    if (!env?.live) return null;
    try {
      return { token: aiReplay.arm(env.session.id, env.doc.revision), documentId: env.session.id, revision: env.doc.revision, before: structuredClone(env.doc.model) };
    } catch {
      return null;
    }
  }
  playReplay(armed, env, result) {
    try {
      if (!this.watch || !env?.live || env.session.id !== armed.documentId || env.doc.revision === armed.revision) return aiReplay.disarm(armed.token);
      const s = this.state();
      aiReplay.play(armed.token, armed.before, env.doc.model, { documentId: armed.documentId, revision: env.doc.revision, assets: result?.assets, sequence: s.globalSeqId == null ? s.sequence : -1 });
    } catch {
      aiReplay.disarm(armed.token);
    }
  }
  watching() {
    return this.watch;
  }
  // After a tool call while watching: show the AI's model tab (once per target change) and
  // queue what the call looked at for the live editor, applied once per display frame.
  follow(name, args, result, liveBefore) {
    try {
      const target = args.target && this.targets.get(args.target);
      if (!target) return;
      const s = this.state(),
        session = this.env(target).session,
        isTab = s.sessions.includes(session);
      const show = tabToShow(this.watchState, session.id, s.session.id, isTab);
      if (show) this.host().showTab(show);
      // A view change on the tab being shown already moved the live viewport.
      const look = name === 'mdlxl_view' && liveBefore ? null : watchLook(name, args, result);
      if (look && isTab) this.follower.push({ documentId: session.id, target: args.target, look });
    } catch {}
  }
  async applyFollow({ documentId, target: id, look }) {
    const host = this.host();
    if (!this.watch || this.state().session.id !== documentId) return;
    const { focus, ...timing } = look;
    if (Object.keys(timing).length) {
      await host.view(timing);
      // The new view and frame are drawn before the part is checked against them.
      await host.afterPaint(1);
    }
    const target = this.targets.get(id), s = this.state();
    if (!focus || !target || !this.watch || s.session.id !== documentId) return;
    const model = s.model;
    const marks = focus.vertices
      ? focus.vertices
      : focus.geosets
        ? Object.fromEntries(focus.geosets.filter(g => model.Geosets[g]).map(g => [g, Array.from({ length: model.Geosets[g].Vertices.length / 3 }, (_, i) => i)]))
        : s.selection;
    const spread = spreadVertices(marks);
    if (!Object.keys(spread).length) return;
    const sequence = s.globalSeqId == null ? s.sequence : -1;
    const posed = markedPositions(model, spread, sequence, s.globalSeqId, s.time), rest = markedPositions(model, spread, -1, null, 0);
    host.followFit({ posed, rest });
    // The marker hovers over the part the AI just looked at.
    if (rest?.length >= 3) aiReplay.look(documentId, s.doc.revision, centerOf(rest), posed?.length >= 3 ? centerOf(posed) : null);
  }
  // An edit step's changed part, flashed on the model on screen with the geoset highlight.
  flashGeoset(index) {
    return this.host().flashGeoset(index);
  }
  // While watching, a job that had to move to a private copy (the user edited the model)
  // offers the existing "Open as new model" at once instead of at the end of the job.
  forkedDraft(documentId) {
    if (!this.watch) return null;
    for (const target of this.targets.values())
      if (target.documentId === documentId && target.job?.draft && !target.job.opened && !target.job.delivered) return target;
    return null;
  }
  openForkedDraft(documentId) {
    const target = this.forkedDraft(documentId);
    if (!target) return false;
    target.job.opened = true;
    this.host().openAiDraft(target.job.draft);
    this.editorChanged();
    return true;
  }
  state() {
    return this.host().state();
  }
  summary() {
    return this.host().summary();
  }
  setChat(documentId, chatId) {
    this.chats.set(documentId, chatId);
    this.editorChanged();
  }
  rebindChat(documentId, from, to) {
    for (const reference of this.referenceSessions({ documentId, chatId: from })) reference.referenceChatId = to;
    if (this.chats.get(documentId) === from) this.chats.set(documentId, to);
    this.editorChanged();
  }
  referenceScope(target) {
    const documentId = target?.documentId || this.state().session.id;
    return { documentId, chatId: target ? target.chatId : this.chats.get(documentId) || null };
  }
  referenceSessions(target) {
    const { documentId, chatId } = this.referenceScope(target);
    return this.host().sessions().filter(s => s.reference && s.referenceOwnerId === documentId && s.referenceChatId === chatId);
  }
  references() {
    // Header updates must not build state(), which scans selected timeline keys.
    const { documentId } = this.summary();
    return this.referenceSessions({ documentId, chatId: this.chats.get(documentId) || null }).map(s => ({ id: s.id, name: s.doc.name }));
  }
  /** The console drawings of the active model, as the AI reads them. */
  annotations() {
    const { session, model } = this.state();
    return sketchContext(sketchStore.strokes(session.id), model);
  }
  // The model tab a task works on, as that task sees it. On screen it is the live
  // editor; otherwise the tab's own document with the selection and view the task
  // captured when its prompt was sent (and changed since through its own tools).
  env(target) {
    const s = this.state(),
      session = target?.job?.draft || (target && s.sessions.find(x => x.id === target.documentId));
    if (!session) throw Error('The model this task works on was closed.');
    if (session === s.session) return { live: true, session, doc: s.doc, model: s.model, state: s };
    const view = target.restore;
    return {
      live: false,
      session,
      doc: session.doc,
      model: session.doc.model,
      state: {
        ...s,
        session,
        doc: session.doc,
        model: session.doc.model,
        selection: target.selection,
        selectedNodeIds: view.selectedNodeIds,
        selectable: new Set(view.checkedGeosets),
        activeGeoset: view.activeGeoset,
        uvSet: view.uvSet,
        mode: view.mode,
        animationPanel: target.animationPanel,
        sequence: target.sequence,
        globalSeqId: target.globalSequence,
        time: target.frame,
        view: target.view,
        workplane: target.workplane,
        keyframes: target.keyframes,
        renderMode: target.renderMode,
        hiddenGeosets: new Set(target.hiddenGeosets || []),
        playing: false,
        dialog: null,
        uvEditing: false,
        uvEligibleSelection: undefined,
      },
    };
  }
  startEmbeddedJob(resume = false) {
    const state = this.state();
    const retained = [...this.targets].find(([, t]) => t.documentId === state.session.id && t.chatId === (this.chats.get(state.session.id) || null) && t.job?.retained);
    if (retained) {
      const [id, target] = retained;
      if (resume) { target.job.retained = false; return { ...this.context(id), retainedCandidate: true }; }
      // A result the last job could not put on the model is never discarded silently.
      if (target.job.draft && !target.job.delivered)
        try {
          const result = deliverJob(this, target, 'finish');
          if (result.conflict || result.correction) deliverJob(this, target, 'open');
        } catch {
          try {
            deliverJob(this, target, 'open');
          } catch {}
        }
      this.host().dropAiDraft(target.job.draft);
      this.targets.delete(id);
    }
    const context = this.context();
    this.targets.get(context.target).job = { ...captureJobBase(state.session), token: context.target };
    return { ...context, embeddedJob: true };
  }
  closeDocument(documentId) {
    forgetReplayPictures(documentId);
    for (const [id, target] of this.targets) if (target.documentId === documentId) {
      if (target.job?.draft) this.host().dropAiDraft(target.job.draft);
      this.targets.delete(id);
    }
  }
  releaseEmbeddedJob(id) {
    const target = this.targets.get(id);
    if (!target?.job) return;
    if (target.job.draft && !target.job.delivered && (target.review?.changed || target.job.merge)) { target.job.retained = true; return; }
    if (target.job.draft) this.host().dropAiDraft(target.job.draft);
    delete target.job;
  }
  context(existing, chatId) {
    if (existing) this.requireTarget(existing);
    const id = existing || crypto.randomUUID();
    if (!existing) {
      const state = this.state();
      this.targets.set(id, {
        ...this.referenceScope(),
        revision: state.doc.revision,
        selectionSignature: aiSelectionSignature(state),
        selection: structuredClone(state.selection || {}),
        sequence: state.sequence,
        frame: state.time,
        keyframes: structuredClone(state.keyframes),
        globalSequence: state.globalSeqId,
        workplane: state.workplane,
        view: state.view,
        renderMode: state.renderMode,
        hiddenGeosets: Array.from(state.hiddenGeosets || []),
        animationPanel: state.animationPanel,
        // Drawings are part of the prompt: later notes elsewhere never change them.
        annotations: sketchContext(sketchStore.strokes(state.session.id), state.model),
        // The strokes themselves, to draw them over the task's off-screen pictures.
        strokes: sketchStore.strokes(state.session.id, 'model').map(s => ({ tool: s.tool, color: s.colorValue, points: Array.from(s.points) })),
        restore: viewSnapshot(state),
      });
    }
    if (this.targets.size > 100) {
      const unused = [...this.targets].find(([, t]) => !t.review && !t.job);
      if (unused && unused[0] !== id) this.targets.delete(unused[0]);
    }
    if (chatId !== undefined) this.targets.get(id).chatId = chatId;
    const captured = this.targets.get(id),
      env = this.env(captured),
      { state, doc, session, model } = env,
      selected = structuredClone(env.live ? state.selection || {} : captured.selection);
    return {
      target: id,
      documentId: captured.documentId,
      ...(captured.job ? { embeddedJob: true } : {}),
      onScreen: env.live,
      ...(env.live
        ? {}
        : {
            background: captured.job?.draft ? 'Working on the captured model privately. Scripts, selections, samples, captures and verification use this copy. Live UI gestures and screen-only commands are unavailable.' :
              "This model's tab is not showing: the user works on another tab. Edits, selection, views, pictures, Undo/Redo, reading, sampling and export work on this model directly. Editor commands and program controls wait until the user returns to this tab.",
          }),
      name: doc.name,
      path: session.path,
      revision: doc.revision,
      version: model.Version,
      readOnly: doc.readOnly,
      dirty: doc.dirty,
      selection: selected,
      selectedNodeIds: [...(state.selectedNodeIds || [])],
      checkedGeosets: Array.from(state.selectable),
      activeGeoset: state.activeGeoset,
      uvSet: state.uvSet,
      mode: state.mode,
      animationPanel: state.animationPanel,
      sequence: state.sequence,
      sequenceName: model.Sequences[state.sequence]?.Name || null,
      frame: captured.frame,
      liveFrame: env.live ? state.time : captured.frame,
      globalSequence: state.globalSeqId,
      uvEditing: !!state.uvEditing,
      uvEligibleSelection: state.uvEligibleSelection,
      renderMode: state.renderMode,
      hiddenGeosets: Array.from(state.hiddenGeosets || []),
      keyframes: state.keyframes || null,
      workplane: state.workplane,
      view: state.view,
      playing: state.playing,
      pending: {
        dialog: state.dialog?.type || null,
        paint: !!session.paintProject,
        animationDrafts: Object.keys(session.animationDrafts || {}),
        uvPreviews: Object.keys(session.uvPreviews || {}),
      },
      counts: {
        geosets: model.Geosets.length,
        vertices: model.Geosets.reduce((n, g) => n + g.Vertices.length / 3, 0),
        triangles: model.Geosets.reduce((n, g) => n + g.Faces.length / 3, 0),
        nodes: model.Nodes.filter(Boolean).length,
      },
      geosets: model.Geosets.map((g, index) => ({
        index,
        shown: index + 1,
        vertices: g.Vertices.length / 3,
        triangles: g.Faces.length / 3,
        material: g.MaterialID,
      })),
      nodes: model.Nodes.filter(Boolean).map(n => ({ id: n.ObjectId, name: n.Name, parent: n.Parent })),
      sequences: encodeAiValue(model.Sequences),
      diagnostics: doc.diagnostics,
      annotations: captured.annotations,
      documents: this.documents(captured),
      commands: this.host()
        .commands()
        .map(c => ({ id: c.id, label: c.label, enabled: c.enabled })),
    };
  }
  documents(target) {
    const s = this.state(), { documentId } = this.referenceScope(target), references = new Set(this.referenceSessions(target));
    return this.host().sessions().filter(x => x.id === documentId || references.has(x)).map(x => ({
      id: x.id,
      name: x.doc.name,
      path: x.path,
      active: x === s.session,
      revision: x.doc.revision,
    }));
  }
  requireTarget(id) {
    const target = this.targets.get(id),
      s = this.state(),
      session = target && s.sessions.find(x => x.id === target.documentId);
    if (target && !session) throw Error('The model this task works on was closed. Nothing was applied.');
    if (target?.job && session) {
      if (!target.job.draft) {
        // While the user watches, their own selection or animation change is not an edit:
        // the job adopts it and stays on the live model. Off, any change forks as before.
        const rule = watchTargetRule({ watching: this.watch, sourceChanged: changedSource(target.job, session), onScreen: session === s.session,
          selectionChanged: target.selectionSignature !== aiSelectionSignature(s) });
        if (rule === 'fork') forkJob(this, target);
        else if (rule === 'adopt') target.selectionSignature = aiSelectionSignature(s);
      }
      if (target.job.draft) return target;
    }
    if (session && session !== s.session) {
      // A tab that is not showing has no one else editing it; only a change to its
      // model (the user came back, edited and left again) stops the task.
      if (session.doc.revision !== target.revision) checkAiTarget(null, s);
      target.offscreen = true;
      return target;
    }
    if (target?.offscreen && session.doc.revision === target.revision) {
      // Back on screen: from here on, the user changing this tab's model or
      // selection stops the task, as it always has on the tab being shown.
      target.selectionSignature = aiSelectionSignature(s);
      target.offscreen = false;
    }
    // Following the AI moves the live animation and frame; while watching that is not a change of the task's selection.
    if (this.watch && target && session === s.session && session.doc.revision === target.revision) target.selectionSignature = aiSelectionSignature(s);
    checkAiTarget(target, s);
    return target;
  }
  // The selection a task left in a tab that is not showing becomes its own again.
  adoptTab(target) {
    const view = this.env(target).session.viewState;
    if (!view) return;
    target.selection = structuredClone(view.selection);
    Object.assign(target.restore, {
      selection: structuredClone(view.selection),
      selectedNodeIds: [...view.selectedNodeIds],
      checkedGeosets: Array.from(view.selectable),
      activeGeoset: view.activeGeoset,
      uvSet: view.uvSet,
    });
  }
  advance(id, viewChanged = false) {
    const target = this.targets.get(id),
      s = this.state();
    // A prompt may already be captured while this AI operation is committing.
    // Advance only tokens for the same chat and exact pre-operation state.
    const peers = [...this.targets.values()].filter(other => other !== target && !other.job &&
      other.documentId === target.documentId && other.chatId === target.chatId &&
      other.revision === target.revision && other.selectionSignature === target.selectionSignature);
    const advancePeers = () => {
      for (const other of peers) {
        for (const key of ['revision', 'selectionSignature', 'selection', 'offscreen']) other[key] = structuredClone(target[key]);
        for (const key of ['selection', 'selectedNodeIds', 'checkedGeosets', 'activeGeoset', 'uvSet']) other.restore[key] = structuredClone(target.restore[key]);
      }
    };
    if (target.job?.draft) { target.revision = target.job.draft.doc.revision; return; }
    const owner = s.sessions.find(x => x.id === target.documentId);
    if (target.job && owner && owner.doc.revision !== target.job.recovery.revision)
      Object.assign(target.job, captureJobBase(owner));
    if (s.session.id !== target.documentId) {
      const session = owner;
      if (session) target.revision = session.doc.revision;
      target.offscreen = true;
      advancePeers();
      return;
    }
    target.offscreen = false;
    target.revision = s.doc.revision;
    target.selectionSignature = aiSelectionSignature(s);
    target.selection = structuredClone(s.selection);
    target.restore = viewSnapshot(s);
    if (viewChanged)
      Object.assign(target, {
        sequence: s.sequence,
        frame: s.time,
        keyframes: structuredClone(s.keyframes),
        globalSequence: s.globalSeqId,
        workplane: s.workplane,
        view: s.view,
      });
    advancePeers();
  }
  async call(name, args = {}, options = {}) {
    const key = (args.target && this.targets.get(args.target)?.documentId) || '',
      run = async () => {
      if (options.signal?.aborted) throw Error('AI request cancelled; no further edit was applied.');
      // A picture or a click on the live editor sees the real model, never a replay in flight.
      if (this.watch && (name === 'mdlxl_capture' || name === 'mdlxl_ui')) aiReplay.stop();
      const display = (name === 'mdlxl_command' && AI_DISPLAY_COMMANDS.has(args.id)) || (name === 'mdlxl_view' && !args.mode);
      if (display && name === 'mdlxl_command' && this.env(this.targets.get(args.target)).live === false)
        throw Error('This display command needs the model tab on screen. Use mdlxl_capture samples with geosets to inspect its parts in the background.');
      if (needsScreen(name, args)) {
        const target = args.target && this.requireTarget(args.target);
        if (target?.job?.draft) throw Error(screenOnly(name, args));
        await this.waitForTarget(args.target, options);
        if (target?.job?.draft) throw Error(screenOnly(name, args));
      }
      let review, revision, paint, replay;
      const target = args.target && this.targets.get(args.target),
        current = () => {
          try {
            return this.env(target);
          } catch {
            return null;
          }
        };
      if (aiToolEditsModel(name, args)) {
        review = await beginAiReview(this, args.target, options);
        revision = current()?.doc.revision;
        paint = current()?.session.paintWorkingRevision;
      }
      let result, cancel;
      try {
        // Display work can wait on a UI paint that never arrives. Cancellation
        // must release this call's queue so the next read/edit can still run.
        const cancelled = display && options.signal ? new Promise((_, reject) => {
          cancel = () => reject(options.signal.reason || Error('AI display request cancelled.'));
          options.signal.addEventListener('abort', cancel, { once: true });
          if (options.signal.aborted) cancel();
        }) : null;
        const liveBefore = this.watch ? current()?.live : undefined;
        replay = liveBefore && aiToolEditsModel(name, args) ? this.armReplay(current()) : null;
        const operation = this.dispatch(name, args, options);
        result = await (cancelled ? Promise.race([operation, cancelled]) : operation);
        if (this.watch) this.follow(name, args, result, liveBefore);
        return result;
      } finally {
        if (replay) this.playReplay(replay, current(), result);
        if (cancel) options.signal.removeEventListener('abort', cancel);
        const env = review && current();
        if (env && (env.doc.revision !== revision || env.session.paintWorkingRevision !== paint))
          recordAiChange(review, result, env.model);
        if (result && review) result.review = reviewStatus(review);
        this.editorChanged();
      }
    };
    const unqueued = aiToolRunsUnqueued(name, args);
    const op = unqueued ? run() : (this.queues.get(key) || Promise.resolve()).then(run);
    if (unqueued) return op;
    const settled = op.catch(() => {});
    this.queues.set(key, settled);
    settled.then(() => this.queues.get(key) === settled && this.queues.delete(key));
    return op;
  }
  async dispatch(name, args, { signal, requestId } = {}) {
    const active = () => {
      if (signal?.aborted) throw Error('AI request cancelled; no further edit was applied.');
    };
    active();
    if (name === 'mdlxl_delivery') {
      const target = this.requireTarget(args.target);
      const result = deliverJob(this, target, args.action);
      if (result.delivered && target.job) target.job.delivered = true;
      return result;
    }
    if (name === 'mdlxl_checkpoint') {
      if (args.prepare) await beginAiReview(this, args.target, { signal, requestId });
      return aiCheckpoint(this, args.target, args);
    }
    if (!AI_TOOLS.some(t => t.name === name)) throw Error('Unknown MDLxL tool: ' + name);
    if (name === 'mdlxl_review') return reviewAiModel(this, args, { signal, requestId });
    if (name === 'mdlxl_context') return this.context(args.target);
    if (name === 'mdlxl_capabilities') {
      if (!args.module) return aiCapabilities(args);
      const result = await window.desktop.aiScript({
        requestId,
        model: null,
        selection: {},
        context: {},
        references: {},
        code: 'return await api.describe(' + JSON.stringify(args.module) + ');',
      });
      active();
      return result.value;
    }
    if (name === 'mdlxl_help') {
      // The SD rulebook and study stay out of help while SD Brain is parked, and
      // the editing handbook's guides while the user has the handbook off.
      const handbook = (await this.desktop?.aiStatus?.())?.editingHandbook === true;
      const index = Object.keys(guides)
        .map(path => path.replace('../', ''))
        .filter(path => SD_BRAIN_AVAILABLE || !path.startsWith('docs/AI-SD-'))
        .filter(path => handbook || !path.startsWith('docs/WC3-EDITING-'));
      if (!args.topic)
        return {
          topics: index,
          scripting:
            'Use a read-only script: return api.modules; then return await api.describe("module-name");',
          selection:
            'Every prompt includes the marked vertex IDs, bones, animation and frame. Scripts receive that exact selection.',
          mirror:
            'For duplicate + mirror + compatible seam weld, inspect api.describe("ai-mesh"). The ordinary Mirror command reflects in place.',
        };
      const file = index.find(p => p === args.topic || p.split('/').at(-1) === args.topic);
      if (!file) throw Error('Unknown guide. Request the help index.');
      return { topic: file, text: await guides['../' + file]() };
    }
    if (name === 'mdlxl_read') {
      const s = this.state(),
        target = args.target ? this.requireTarget(args.target) : undefined,
        own = target ? this.env(target).session : s.session,
        document = args.documentId && args.documentId !== (target?.documentId || own.id) ? this.referenceSessions(target).find(x => x.id === args.documentId) : own;
      if (!document) throw Error('Reference model is no longer open.');
      return readAiModel(document.doc.model, args);
    }
    if (name === 'mdlxl_document' && args.action === 'list') return this.documents(args.target ? this.requireTarget(args.target) : undefined);
    if (name === 'mdlxl_ui' && args.action === 'inspect') return this.inspectUi();
    const target = this.requireTarget(args.target),
      host = this.host(),
      env = this.env(target),
      state = env.state;
    if (args.expectedRevision !== undefined && args.expectedRevision !== env.doc.revision)
      throw Error('The model changed since this selection was captured. Send a new request.');
    if (name === 'mdlxl_capture' && args.workspaceVertices) {
      const vertices = args.workspaceVertices;
      this.validateSelection({ vertices }, env);
      const byGeoset = new Map();
      let triangles = 0;
      env.model.Geosets.forEach((geo, gi) => {
        const ids = new Set(vertices[gi]), faces = new Set();
        for (let i = 0; i < geo.Faces.length; i += 3)
          if (ids.has(geo.Faces[i]) && ids.has(geo.Faces[i + 1]) && ids.has(geo.Faces[i + 2])) faces.add(i / 3);
        triangles += faces.size;
        byGeoset.set(gi, faces);
      });
      if (!triangles) throw Error('There are no complete triangles in this candidate to preview.');
      const model = isolatePaintRegion(env.model, { byGeoset });
      const picture = await this.picture(args.target, { view: args.view, fit: 'selection' }, { model, candidate: vertices });
      active();
      this.requireTarget(args.target);
      return { ...picture, label: 'Candidate only, ' + args.view, triangles };
    }
    if (name === 'mdlxl_sample') return sampleAiModel(env.model, this.contextFor(args.target), args, signal, this.sampleModels(target, env, args));
    if (name === 'mdlxl_versions') {
      const versions = this.versionStore,
        id = target.documentId;
      if (args.action === 'list') return { versions: versions.list(id, env.doc.model) };
      if (args.action === 'save') {
        versions.save(id, args.name, env.doc.model, args.note);
        return { saved: args.name, versions: versions.list(id, env.doc.model) };
      }
      if (args.action === 'compare') return versions.compare(id, args.name, env.doc.model, args.other);
      if (args.action === 'use') {
        // One normal Undo step through the same validation as any AI edit.
        const result = await this.dispatch(
          'mdlxl_patch',
          { target: args.target, label: 'Back to version ' + args.name, ...versions.restore(id, args.name, env.doc.model) },
          { signal, requestId },
        );
        return { ...result, now: args.name };
      }
      throw Error('Choose list, save, compare or use.');
    }
    if (name === 'mdlxl_assets') {
      const result = await aiAssets(args, { ...host, state: () => env.state, addReference: record => host.addReference(record, this.referenceScope(target)) }, () => {
        active();
        this.requireTarget(args.target);
      });
      active();
      return result;
    }
    const fromFile = name === 'mdlxl_document' && args.action === 'apply';
    if (name === 'mdlxl_script' || name === 'mdlxl_patch' || fromFile) {
      if (state.saving) throw Error('Wait for the current save to finish.');
      if ((name === 'mdlxl_patch' || fromFile || args.edit) && state.mode === 'paint')
        throw Error(
          'Paint has its own working model. Use Paint controls, or use mdlxl_view to leave Paint and apply it through the editor before editing the model.',
        );
      const before = structuredClone(env.doc.model);
      let result;
      if (name === 'mdlxl_patch') result = { model: patchAiModel(before, args.operations) };
      else if (fromFile) {
        // A model file (for example one a Python script wrote) lands as one ordinary edit:
        // every section may change, and only what differs from the model does.
        const model = await modelFromFile(args.path, env.doc, before);
        args = { ...args, label: args.label || 'Apply ' + String(args.path).split(/[\\/]/).pop(), scope: fileEditScope(before, model) };
        result = { model };
      } else
        result = await window.desktop.aiScript({
          requestId,
          code: args.code,
          workspaceFiles: args.workspaceFiles,
          timeoutMs: args.timeoutMs,
          model: structuredClone(before),
          selection: structuredClone(target.selection),
          context: this.contextFor(args.target),
          references: Object.fromEntries([
            ...this.referenceSessions(target)
              .map(s => [s.id, { name: s.doc.name, model: structuredClone(s.doc.model) }]),
            ...(target.job?.merge ? [
              ['merge:base', { name: 'Common starting model', model: structuredClone(target.job.merge.ancestor) }],
              ['merge:candidate', { name: 'AI candidate to merge', model: structuredClone(target.job.merge.candidate) }],
            ] : []),
            // Saved versions of this model, for measuring candidates side by side.
            ...this.versionStore
              .names(target.documentId)
              .map(v => ['version:' + v, { name: 'Version ' + v, model: structuredClone(this.versionStore.get(target.documentId, v)) }]),
          ]),
        });
      active();
      this.requireTarget(args.target);
      // Large typed arrays and long lists come back summarised; workspace programs that write an output file keep their full data.
      const encoded = encodeAiValue(result.value),
        value = args.workspaceFiles && args.capOutput === false ? encoded : limitAiOutput(encoded);
      if (name === 'mdlxl_script' && !args.edit) return { value, logs: result.logs || [], applied: false };
      if (typeof args.label !== 'string' || !args.label.trim() || args.label.length > 200)
        throw Error('An edit needs a short Undo label.');
      const prepared = prepareAiEdit(before, result.model, args);
      const apply = model => {
        applyAiEdit(model, prepared);
      };
      const label = args.label;
      // The user may have switched tabs while the script ran: commit where the tab is now.
      const now = this.env(target),
        { doc } = now;
      const assets = validateAiAssets(result.assets || [], result.model, now.session.assets);
      if (!prepared.changeCount) return { applied: false, changes: [], value, logs: result.logs || [] };
      const baseline = this.saveBaseline(doc);
      const options = { rethrow: true, validate: (model, committed) => {
        const checked = prepareAiEdit(committed, model, args);
        return checked;
      } };
      if (now.live)
        // The existing App.edit owns validation, UV-preview protection, history and refresh.
        flushSync(() => {
          host.edit(label, prepared.sections, apply, options);
          if (result.selection && doc.revision !== target.revision) host.select({ vertices: result.selection });
        });
      else {
        // Its own document and Undo history; the tab on screen is not touched.
        host.editIn(now.session.id, label, prepared.sections, apply, {
          ...options,
          selection: { vertices: result.selection || target.selection },
        });
        this.adoptTab(target);
      }
      if (doc.revision === target.revision) throw Error('The editor could not commit the edit.');
      // An edit the model could not be saved with is taken back at once; left in place it
      // would block every later checkpoint, review and Undo step. Checked in the document's
      // own format, and MDX too when it can convert (AI checkpoints use MDX).
      // Only problems this edit introduced refuse it; ones the model already had are reported once.
      const afterSave = this.saveWarnings(doc),
        freshProblems = newSaveProblems(baseline, afterSave);
      if (freshProblems.length) {
        const error = Error(freshProblems.join(' '));
        if (now.live) await host.command('undo');
        else {
          host.undoIn(now.session.id, false);
          this.adoptTab(target);
        }
        this.advance(args.target);
        throw Error(
          `Not applied: the model could not be saved after this edit (${error.message}), so it was undone. Check each new or changed geoset: Vertices and Normals as Float32Array (3 per vertex), TVertices as [Float32Array] (2 per vertex), Faces as Uint16Array of valid indices, VertexGroup as Uint8Array (1 per vertex), Groups and MaterialID valid. sd-kit commit and Forge commitForge build complete geosets.`,
        );
      }
      this.saveBaselines.set(doc, { revision: doc.revision, warnings: afterSave });
      const existingSaveIssues = baseline.length && !this.reportedSaveIssues.has(doc) ? baseline : null;
      if (existingSaveIssues) this.reportedSaveIssues.add(doc);
      this.advance(args.target);
      // Texture bytes load only after a successful commit, so a refused edit leaves none behind.
      if (assets.length) await host.addAssetsIn(now.session.id, assets);
      return {
        applied: true,
        target: args.target,
        revision: doc.revision,
        changeCount: prepared.changeCount,
        changes: prepared.summary,
        assets: assets.map(a => a.name),
        value,
        logs: result.logs || [],
        diagnostics: doc.diagnostics,
        ...(existingSaveIssues ? { savedWithExistingIssues: existingSaveIssues, note: 'The model already had these save-check differences before your edit; they are not caused by it and did not block it.' } : {}),
        ...animationNotes(before, doc.model),
      };
    }
    if (name === 'mdlxl_select') {
      this.validateSelection(args, env);
      if (!env.live) {
        if (args.keyframes) throw Error(LEFT_TAB);
        host.selectIn(env.session.id, args);
        if (target.job?.draft) target.job.resultSelection = { ...target.job.resultSelection, ...Object.fromEntries(
          ['vertices', 'nodeIds', 'geosetIds', 'activeGeoset'].filter(key => args[key] !== undefined).map(key => [key, args[key]])) };
        this.adoptTab(target);
        this.advance(args.target);
        return this.contextFor(args.target);
      }
      flushSync(() => host.select(args));
      if (args.keyframes) {
        await host.selectKeys(args.keyframes);
        await settle();
      }
      this.advance(args.target, !!args.keyframes);
      return this.contextFor(args.target);
    }
    if (name === 'mdlxl_command') {
      if (!env.live) {
        // A model tab that is not showing, or the job's private copy: Undo/Redo, mesh tools,
        // selection and view commands run on the task's own model, selection and view, as on
        // screen. Commands that open a window still need the tab.
        if (['undo', 'redo'].includes(args.id)) {
          host.undoIn(env.session.id, args.id === 'redo');
          this.adoptTab(target);
          this.advance(args.target);
          return { invoked: args.id, dialog: null, context: this.contextFor(args.target) };
        }
        if (Object.hasOwn(VIEW_COMMANDS, args.id))
          return { invoked: args.id, dialog: null, context: await this.dispatch('mdlxl_view', { target: args.target, ...VIEW_COMMANDS[args.id] }, { signal, requestId }) };
        if (!MESH_ACTIONS.includes(args.id) && !SELECTION_COMMANDS.includes(args.id) && !Object.hasOwn(GEOSET_ACTIONS, args.id) && args.id !== CUT_ACTION) throw Error(LEFT_TAB);
        const model = env.model,
          checked = [...(env.session.viewState?.selectable || model.Geosets.map((_, gi) => gi))].filter(gi => model.Geosets[gi]),
          marked = Object.fromEntries(
            Object.entries(target.selection || {})
              .map(([gi, ids]) => [gi, (ids || []).filter(i => model.Geosets[gi] && i * 3 < model.Geosets[gi].Vertices.length)])
              .filter(([, ids]) => ids.length),
          ),
          count = Object.values(marked).reduce((sum, ids) => sum + ids.length, 0);
        let vertices;
        if (Object.hasOwn(GEOSET_ACTIONS, args.id) || args.id === CUT_ACTION) {
          // The sidebar's geoset operations and the Cut tool, as on screen: one Undo step, and the
          // marked vertices, checked geosets and active geoset follow the change.
          const after = {}, view = env.session.viewState;
          if (args.id === CUT_ACTION) {
            if (!args.cut || typeof args.cut !== 'object') throw Error('Cut needs cut: { geosetIndex, start, a, b, t } (a point on line a-b, t between 0 and 1) or { geosetIndex, start, vertex }.');
            host.editIn(env.session.id, CUT_ACTION, ['Geosets'], edited => {
              const shown = applyCut(edited, args.cut);
              if (shown) Object.assign(after, { vertices: { [shown.geosetIndex]: shown.selection }, activeGeoset: shown.geosetIndex });
            }, { selection: after });
          } else {
            const action = GEOSET_ACTIONS[args.id];
            if (action.needs === 'marked' && !count) throw Error('Mark the vertices first with mdlxl_select: ' + args.id + ' acts on the marked vertices.');
            if (action.needs === 'checked' && !checked.length) throw Error('Check the geosets first with mdlxl_select geosetIds: ' + args.id + ' acts on the checked geosets.');
            host.editIn(env.session.id, action.label, action.sections, edited => {
              const next = applyGeosetAction(edited, args.id, { selection: marked, selectable: new Set(checked), activeGeoset: view?.activeGeoset ?? -1 }, { resolutions: args.resolutions });
              if (next.result.oldToNew && view) for (const key of ['visibleOnly', 'hiddenByUser']) if (view[key]) view[key] = remapGeosetSet(view[key], next.result);
              Object.assign(after, { vertices: next.selection, geosetIds: [...next.selectable], activeGeoset: next.activeGeoset });
            }, { selection: after });
          }
          vertices = after.vertices ?? marked;
        } else if (SELECTION_COMMANDS.includes(args.id)) {
          const all = gi => Array.from({ length: model.Geosets[gi].Vertices.length / 3 }, (_, i) => i);
          vertices = args.id === 'clear' ? {} : Object.fromEntries(checked.map(gi => {
            const picked = new Set(marked[gi] || []);
            return [gi, args.id === 'selectAll' ? all(gi) : all(gi).filter(i => !picked.has(i))];
          }).filter(([, ids]) => ids.length));
          host.selectIn(env.session.id, { vertices });
        } else {
          if (!count) throw Error('Mark the vertices first with mdlxl_select: ' + args.id + ' acts on the marked vertices.');
          if (['Collapse', 'Weld'].includes(args.id) && count < 2) throw Error(args.id + ' needs at least two marked vertices.');
          const after = {};
          host.editIn(env.session.id, args.id, ['Geosets', 'GeosetAnims', 'Nodes'], edited => {
            const { updated, removedGeosets } = applyMeshAction(edited, args.id, marked, { axis: workplaneAxis(target.workplane), ...host.meshOptions?.(), ...meshParameters(args) });
            // As on screen: a removed geoset clears the selection, a tool's new vertices become it.
            after.vertices = removedGeosets.length ? {} : Object.keys(updated).length ? updated : marked;
          }, { selection: after });
          vertices = after.vertices;
        }
        if (target.job?.draft) target.job.resultSelection = { ...target.job.resultSelection, vertices };
        this.adoptTab(target);
        this.advance(args.target);
        return { invoked: args.id, dialog: null, context: this.contextFor(args.target) };
      }
      const command = host.commands().find(c => c.id === args.id);
      if (!command?.enabled) throw Error('This editor command is unavailable: ' + args.id);
      await host.command(args.id);
      active();
      await settle();
      active();
      // A save runs on after the command returns; report only once it is written.
      for (let i = 0; i < 1000 && this.state().saving; i++) await settle();
      if (this.state().session.id !== target.documentId)
        return { invoked: args.id, activeDocumentChanged: true, context: this.context() };
      this.advance(args.target, true);
      return {
        invoked: args.id,
        dialog: this.state().dialog?.type || null,
        context: this.contextFor(args.target),
      };
    }
    if (name === 'mdlxl_view') {
      checkView(args, env.model);
      if (!env.live) {
        // The task's own view: it decides what its pictures and samples show.
        const view = target.restore;
        if (args.mode) view.mode = args.mode;
        if (args.view) target.view = args.view;
        if (args.renderMode) target.renderMode = args.renderMode;
        if (args.globalSequence != null) Object.assign(target, { globalSequence: args.globalSequence, frame: 0 });
        else if (args.sequence !== undefined || args.globalSequence === null)
          Object.assign(target, {
            globalSequence: null,
            sequence: args.sequence ?? target.sequence,
            frame: env.model.Sequences[args.sequence ?? target.sequence]?.Interval?.[0] ?? 0,
          });
        if (args.frame !== undefined) target.frame = args.frame;
        Object.assign(view, { sequence: target.sequence, globalSequence: target.globalSequence, frame: target.frame });
        this.advance(args.target);
        return this.contextFor(args.target);
      }
      await host.view(args);
      active();
      await settle();
      active();
      this.advance(args.target, true);
      return this.contextFor(args.target);
    }
    if (name === 'mdlxl_capture' || (name === 'mdlxl_ui' && args.action === 'capture')) {
      if (name === 'mdlxl_capture' && args.samples) {
        // Each sample is drawn off-screen, so the view on screen never moves. A sample with documentId
        // draws an open reference model (a donor) at its own animation and frame instead.
        const referenceOf = sample => {
          if (sample.documentId == null || sample.documentId === target.documentId) return null;
          const reference = this.referenceSessions(target).find(x => x.id === sample.documentId);
          if (!reference) throw Error('Reference model is not open. Load it with mdlxl_assets reference or mdlxl_document open.');
          if (sample.uv || sample.filmstrip || sample.vertices || sample.fit === 'selection') throw Error('A reference picture takes view, sequence, globalSequence, frame, plain and wireframe only.');
          return reference;
        };
        for (const sample of args.samples) {
          const reference = referenceOf(sample);
          checkView(sample, reference ? reference.doc.model : env.model);
          if (!reference) checkSample(sample, env.model);
        }
        const images = [];
        for (const sample of args.samples) {
          active();
          this.requireTarget(args.target);
          const reference = referenceOf(sample);
          if (reference) images.push(await this.picture(args.target, sample, { documentId: reference.id }));
          else if (sample.uv) images.push(...(await this.uvPictures(args.target, sample)));
          else images.push(await this.picture(args.target, sample));
        }
        return { images };
      }
      // On screen, the viewport as the user sees it, marks included; otherwise off-screen.
      // A minimized or covered window draws nothing, so its picture is drawn off-screen too.
      if (name === 'mdlxl_capture')
        return { image: env.live && !globalThis.document?.hidden ? await host.capture() : (await this.picture(args.target)).image };
      // Mask the assistant only in the returned UI image. Never alter the live panel.
      const panel = document.querySelector('section.ai-assistant'), rect = panel?.getBoundingClientRect();
      const image = await window.desktop.aiCapture();
      if (!rect?.width || !rect.height) return {image};
      const source = new Image(); source.src = image; await source.decode();
      const canvas = document.createElement('canvas'); canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
      const context = canvas.getContext('2d'), scaleX = canvas.width / window.innerWidth, scaleY = canvas.height / window.innerHeight;
      context.drawImage(source, 0, 0); context.fillStyle = '#ccc';
      context.fillRect(Math.floor(rect.x * scaleX), Math.floor(rect.y * scaleY), Math.ceil(rect.width * scaleX), Math.ceil(rect.height * scaleY));
      return {image: canvas.toDataURL('image/png')};
    }
    if (name === 'mdlxl_ui') {
      const el = this.controls.get(args.id);
      if (!el?.isConnected || el.closest('.ai-assistant') || el.disabled)
        throw Error('The control changed. Inspect the UI again.');
      if (args.action === 'click') el.click();
      else if (args.action === 'gesture') {
        const rect = el.getBoundingClientRect();
        await window.desktop.aiGesture({
          requestId,
          points: args.points?.map(([x, y]) => [
            Math.round(rect.left + x * (rect.width - 1)),
            Math.round(rect.top + y * (rect.height - 1)),
          ]),
          button: args.button,
          modifiers: args.modifiers,
        });
      } else if (args.action === 'set') {
        if (el.matches('input[type=checkbox]')) {
          if (el.checked !== Boolean(args.value)) el.click();
        } else {
          if (!el.matches('input:not([type=file]):not([type=password]),select,textarea'))
            throw Error('This control does not accept text.');
          const prototype =
            el.tagName === 'SELECT'
              ? HTMLSelectElement.prototype
              : el.tagName === 'TEXTAREA'
                ? HTMLTextAreaElement.prototype
                : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, String(args.value));
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        }
      } else throw Error('Unknown UI action.');
      await settle();
      if (this.state().session.id === target.documentId) this.advance(args.target, true);
      return { acted: true, controls: this.inspectUi() };
    }
    if (name === 'mdlxl_document') {
      if (args.action === 'open') {
        const record = await window.desktop.aiReadModel({ path: args.path });
        active();
        this.requireTarget(args.target);
        const reference = await host.addReference(record, this.referenceScope(target));
        await settle();
        return { reference, context: this.contextFor(args.target) };
      }
      if (args.action === 'export') {
        if (
          state.mode === 'paint' ||
          Object.keys(env.session.uvPreviews || {}).length ||
          Object.keys(env.session.animationDrafts || {}).length
        )
          throw Error(
            'There are preview edits. Use the normal Save command to include them, or apply them through the workspace controls before exporting the committed model.',
          );
        const format = args.format || args.path?.split('.').at(-1)?.toLowerCase();
        if (!['mdl', 'mdx'].includes(format)) throw Error('Choose MDL or MDX.');
        const bytes = await prepareModelSaveAsync(env.doc, format);
        if (bytes.verificationWarnings.length) throw Error(bytes.verificationWarnings.join(' '));
        active();
        this.requireTarget(args.target);
        const result = await window.desktop.aiWriteModel({
          path: args.path,
          bytes: bytes.bytes,
          format,
          forgeAssets: host.assetsIn(env.session.id),
          overwrite: args.overwrite === true,
        });
        return { ...result, revision: target.revision, format };
      }
      if (args.action === 'health') return meshHealth(env.doc.model);
      if (args.action === 'sanity') {
        // The Help menu's Sanity Check on this target's own model (a hidden tab or private copy too).
        const report = await checkSanity(env.doc.model, hiveSanity);
        active();
        return sanityForAi(report);
      }
      if (args.action === 'validate') {
        const results = [];
        for (const format of ['mdx', 'mdl'])
          try {
            const saved = await prepareModelSaveAsync(env.doc, format);
            if (saved.verificationWarnings.length) throw Error(saved.verificationWarnings.join(' '));
            const reopened = openDocument(saved.bytes, 'AI round-trip.' + format);
            results.push({
              format,
              bytes: saved.bytes.byteLength,
              diagnostics: reopened.diagnostics,
              readOnly: reopened.readOnly,
              ...(format === 'mdx' ? sizeOf(saved.bytes, env.doc.model) : {}),
            });
          } catch (error) {
            results.push({ format, error: error.message });
          }
        return { results, gameplayTested: false };
      }
    }
    throw Error('Unsupported tool action.');
  }
  // What saving the document in its formats reports right now (never throws).
  saveWarnings(doc) {
    const found = new Set();
    for (const format of new Set([doc.format, ...(doc.saveImpact('mdx').canSave ? ['mdx'] : [])]))
      try {
        doc.serialize(format);
        doc.lastSaveWarnings.forEach(w => found.add(w));
      } catch (error) {
        found.add(error.message);
      }
    return [...found];
  }
  saveBaseline(doc) {
    const known = this.saveBaselines.get(doc);
    if (known?.revision === doc.revision) return known.warnings;
    const warnings = this.saveWarnings(doc);
    this.saveBaselines.set(doc, { revision: doc.revision, warnings });
    return warnings;
  }
  // The other models a sample measures against: a style donor (an open reference or this model) and a
  // saved version for since.
  sampleModels(target, env, args) {
    const resolved = {}, donor = args.style?.donor?.documentId;
    if (donor) {
      const session = donor === target.documentId ? env.session : this.referenceSessions(target).find(s => s.id === donor);
      if (!session) throw Error('The donor model is not open. Open it with mdlxl_document open or mdlxl_assets reference.');
      resolved.donor = session.doc.model;
    }
    if (args.since !== undefined) resolved.since = this.versionStore.get(target.documentId, args.since);
    return resolved;
  }
  contextFor(id) {
    const target = this.targets.get(id),
      env = this.env(target),
      s = env.state;
    return {
      target: id,
      documentId: target.documentId,
      onScreen: env.live,
      revision: target.revision,
      selection: target.selection,
      selectedNodeIds: [...(s.selectedNodeIds || [])],
      checkedGeosets: Array.from(s.selectable),
      activeGeoset: s.activeGeoset,
      uvSet: s.uvSet,
      uvEditing: !!s.uvEditing,
      uvEligibleSelection: s.uvEligibleSelection,
      workplane: target.workplane,
      mode: s.mode,
      sequence: target.sequence,
      frame: target.frame,
      keyframes: target.keyframes,
      globalSequence: target.globalSequence,
      view: target.view,
    };
  }
  validateSelection(args, env) {
    const { model, state } = env;
    for (const [gi, ids] of Object.entries(args.vertices || {}))
      if (
        !/^\d+$/.test(gi) ||
        !model.Geosets[gi] ||
        !Array.isArray(ids) ||
        ids.some(i => !Number.isInteger(i) || i < 0 || i >= model.Geosets[gi].Vertices.length / 3)
      )
        throw Error('Invalid vertex selection.');
    if (args.nodeIds?.some(i => !Number.isInteger(i) || !model.Nodes[i]))
      throw Error('Invalid bone selection.');
    if (args.geosetIds?.some(i => !Number.isInteger(i) || !model.Geosets[i]))
      throw Error('Invalid geoset selection.');
    if (args.activeGeoset !== undefined && !model.Geosets[args.activeGeoset])
      throw Error('Invalid active geoset.');
    if (args.keyframes) {
      const { nodeId, property, frames } = args.keyframes,
        node = model.Nodes[nodeId],
        global = state.globalSeqId,
        interval =
          global == null
            ? model.Sequences[state.sequence]?.Interval
            : [0, model.GlobalSequences[global]];
      if (
        !interval ||
        !node ||
        !['Translation', 'Rotation', 'Scaling'].includes(property) ||
        (node[property]?.GlobalSeqId ?? null) !== (global ?? null) ||
        !Array.isArray(frames) ||
        frames.some(
          frame =>
            !Number.isInteger(frame) ||
            frame < interval[0] ||
            frame > interval[1] ||
            !node[property]?.Keys?.some(key => key.Frame === frame),
        )
      )
        throw Error('Choose existing transform keys in the current animation domain.');
    }
  }
  // A picture of the task's model from its own view, drawn off-screen. A sample
  // chooses another view, animation or frame for this picture only. source.model
  // draws another state of the task's model (the original kept for review),
  // source.documentId an attached reference model (a donor), and source.focus frames
  // these model-space points so pictures meant to be compared match. The framed points
  // are posed exactly as the preview draws them (no animation is the bind pose) and end
  // up centred in the picture, in every view.
  async picture(id, sample = {}, source = {}) {
    const target = this.targets.get(id),
      env = this.env(target),
      s = env.state;
    const renderMode = sample.wireframe === true ? 'wireframe' : sample.plain || s.renderMode === 'solid' ? 'solid' : 'textured';
    if (source.documentId) {
      const donor = this.referenceSessions(target).find(x => x.id === source.documentId);
      if (!donor) throw Error('Reference model is no longer open.');
      const sequence = sample.globalSequence != null ? -1 : (sample.sequence ?? -1),
        pose = picturePose(donor.doc.model, { sequence, globalSequence: sample.globalSequence ?? null, frame: sample.frame ?? 0 });
      const image = await this.host().render({
        documentId: donor.id,
        view: sample.view || s.view,
        sequence,
        globalSequence: sample.globalSequence ?? null,
        frame: pose.frame,
        restPose: !!pose.bind,
        renderMode,
        hiddenGeosets: [],
        marks: null,
        focus: source.focus || posedPoints(pose, new Map(drawnGeosets(pose).map(g => [g, true]))),
      });
      return { label: donor.doc.name, image: typeof image === 'string' ? image : image.image };
    }
    const model = source.model || env.model;
    const globalSequence =
      sample.globalSequence !== undefined ? sample.globalSequence : sample.sequence !== undefined ? null : s.globalSeqId;
    const sequence = globalSequence == null ? (sample.sequence ?? s.sequence) : -1;
    const asked =
      sample.frame ??
      (sample.globalSequence != null
        ? 0
        : sample.sequence !== undefined && sample.sequence !== s.sequence
          ? (model.Sequences[sample.sequence]?.Interval?.[0] ?? 0)
          : s.time);
    const view = sample.view || s.view,
      // Pictures show the surface; mesh lines only when the sample asks for them (wireframe: true).
      wireframe = renderMode === 'wireframe';
    // sample.vertices marks and frames exactly those vertices without touching the selection.
    const own = sample.vertices && !source.candidate ? sample.vertices : null;
    // Only the parts in question: the other geosets are hidden and the picture frames the rest.
    const only = sample.geosets?.length ? sample.geosets.filter(g => model.Geosets[g]) : null;
    if (sample.geosets?.length && !only.length) throw Error('None of those geosets exist in this model.');
    const hidden = source.candidate
      ? []
      : only
        ? model.Geosets.map((_, g) => g).filter(g => !only.includes(g))
        : source.model && source.model.Geosets.length !== env.model.Geosets.length
          ? []
          : [...(s.hiddenGeosets || [])];
    // One frame as the preview draws it: the frame kept inside the animation (or the bind pose),
    // the marked points, the geosets drawn (not hidden, not faded out) and the points to frame.
    const shot = at => {
      const pose = picturePose(model, { sequence, globalSequence, frame: at }),
        matrices = poseMatrices(pose),
        marked = posedPoints(pose, own || source.candidate || target.selection || {}, matrices),
        shown = drawnGeosets(pose, hidden),
        whole = posedPoints(pose, new Map(shown.map(g => [g, true])), matrices);
      let focus = sample.fit === 'selection' ? marked : sample.fit === 'model' ? whole : only ? posedPoints(pose, new Map(only.map(g => [g, true])), matrices) : whole;
      if (own && sample.fit !== 'model') focus = marked;
      if (!focus.length) focus = whole;
      return { pose, frame: pose.frame, marked, shown, focus };
    };
    const strip = sample.filmstrip > 1 ? filmstripFrames(picturePose(model, { sequence, globalSequence }).interval || [], sample.filmstrip) : null;
    if (sample.filmstrip > 1 && !strip) throw Error('A filmstrip needs an animation: give sequence or globalSequence.');
    const shots = (strip || [asked]).map(shot),
      first = shots[0];
    if (sample.fit === 'selection' && !first.marked.length) throw Error('A close-up needs marked vertices: mark them with select first.');
    // Trails: each chosen node's path through the animation, drawn over the picture and framed with it.
    if (sample.trails?.length && first.pose.bind) throw Error('Trails need an animation: give sequence or globalSequence.');
    const trails = sample.trails?.length ? motionTrails(first.pose, trailNodeIds(model, sample.trails)) : [];
    const trailPoints = trails.flatMap(trail => trail.points.flat());
    // A filmstrip frames every frame alike, so the motion is the model's, not the camera's.
    const focus = source.focus || concatPoints([...(shots.length > 1 ? shots.map(one => one.focus) : [first.focus]), trailPoints]);
    const zoom = clampZoom(sample.zoom);
    const draw = one =>
      this.host().render({
        documentId: env.session.id,
        ...(source.model ? { model: structuredClone(source.model) } : {}),
        view,
        sequence,
        globalSequence,
        frame: one.frame,
        restPose: !!one.pose.bind,
        renderMode,
        hiddenGeosets: hidden,
        marks: source.candidate
          ? null
          : {
              strokes: target.strokes || [],
              vertices: Array.from(one.marked),
              trails: trails.map((trail, i) => ({
                color: TRAIL_COLORS[i],
                number: i + 1,
                points: trail.points.flat(),
                keys: trail.keys.flatMap(key => key.point),
                // Where the node is in this frame.
                now: trail.points[motionPathMarker(trail.frames, one.frame)] || null,
              })),
            },
        particles: !source.candidate && sample.particles !== false,
        ...(sample.overlays ? { overlays: sample.overlays } : {}),
        ...(sample.teamColor ? { teamColor: sample.teamColor } : {}),
        ...(Number.isInteger(sample.camera) ? { camera: sample.camera } : {}),
        focus: focus?.length ? focus : null,
        zoom: source.focus ? 1 : zoom,
      });
    const pictures = [],
      notes = new Set();
    for (const one of shots) {
      const drawn = await draw(one);
      pictures.push(typeof drawn === 'string' ? drawn : drawn.image);
      for (const note of drawn?.notes || []) notes.add(note);
    }
    const effects = hasEffects(model) && !source.candidate
      ? sample.particles === false
        ? '; particles and ribbons off'
        : first.pose.bind
          ? '; particles and ribbons need an animation (none in the bind pose)'
          : '; particles and ribbons replayed from the animation start'
      : '';
    const pose = first.pose,
      name = pose.kind === 'sequence' && model.Sequences[sequence]?.Name,
      triangles = first.shown.reduce((sum, g) => sum + model.Geosets[g].Faces.length / 3, 0),
      faded = [...new Set(shots.flatMap(one => (only || model.Geosets.map((_, g) => g)).filter(g => !hidden.includes(g) && !one.shown.includes(g))))],
      animation = pose.kind === 'global' ? 'global sequence ' + globalSequence : 'sequence ' + sequence + (name ? ' "' + name + '"' : ''),
      when =
        pose.kind === 'bind'
          ? 'bind pose (no animation)'
          : strip
            ? `${animation}; filmstrip of ${strip.length} frames ${strip.join(', ')}, left to right, top to bottom, one shared framing`
            : `${animation}; frame ${first.frame}${Number.isFinite(asked) && asked !== first.frame ? ' (asked ' + asked + ', outside the animation)' : ''}`;
    const image = strip ? await composeFilmstrip(pictures, strip.map(at => frameCaption(at, pose.interval))) : pictures[0];
    const shownOverlays = Object.entries(sample.overlays || {}).filter(([, on]) => on).map(([key]) => key),
      cameraText = Number.isInteger(sample.camera)
        ? `; through model camera ${sample.camera} "${model.Cameras[sample.camera].Name || ''}" as the game shows a portrait (portrait light, black background, portrait shape; framing and zoom do not apply)`
        : '',
      extras = `${cameraText}${shownOverlays.length ? '; overlays: ' + shownOverlays.join(', ') : ''}${sample.teamColor ? '; team colour ' + sample.teamColor : ''}`;
    const round = value => Math.round(value * 10) / 10,
      trailText = trails.length
        ? '; trails (line = path, small dots every ~33 ms so wide gaps are fast, big dots = key frames of the node or a parent, ring = this frame): ' +
          trails.map((trail, i) => `${i + 1} ${TRAIL_NAMES[i]} "${trail.name}" (node ${trail.id}): ${trail.keys.length} keys at ${trail.keys.map(key => key.frame).join(', ') || 'none'}; path ${round(trail.length)} units; peak speed ${round(trail.peakSpeed)} units/s near frame ${trail.peakFrame}; start to end ${round(trail.travel)} units`).join('; ')
        : '';
    return {
      label: `${Number.isInteger(sample.camera) ? 'camera ' + sample.camera : view}; ${when}${extras}${trailText}${sample.fit === 'selection' ? '; close-up of the marked vertices' : ''}${only ? '; only geosets ' + only.join(', ') : ''}${!only && hidden.length ? '; hidden in the task view: geosets ' + hidden.join(', ') : ''}${faded.length ? `; not drawn ${strip ? 'in some frames' : 'at this frame'} (geoset alpha 0): ` + faded.join(', ') : ''}${renderMode === 'solid' ? '; plain shading' : ''}${wireframe ? '; wireframe' : ''}${own ? '; close-up of the given vertices (selection unchanged)' : ''}${zoom > 1 && !source.focus ? '; zoom ' + zoom + 'x' : ''}${effects}${[...notes].map(note => '; ' + note).join('')}; ${triangles} triangles drawn`,
      image,
    };
  }
  // Flat pictures of the geosets' UV layout: the texture with the UV triangles drawn over it, one
  // picture per texture. Marked vertices (sample.vertices, else the task's marks) are red dots.
  // The editor's team colour, as its 3D pictures use it (the hidden picture preview knows it).
  async pictureTeamColor(documentId) {
    try {
      const color = await this.host().render({ documentId, model: {}, query: 'teamColor' });
      if (/^#[0-9a-f]{6}$/i.test(color)) return color;
    } catch {
      /* the default below */
    }
    return '#ff0303';
  }
  async uvPictures(id, sample) {
    const target = this.targets.get(id),
      env = this.env(target),
      model = env.model,
      uvSet = sample.uvSet ?? 0,
      marks = sample.vertices || target.selection || {};
    const geosets = uvPictureGeosets(model, sample.geosets, marks).filter(g => uvArray(model.Geosets[g], uvSet));
    if (!geosets.length) throw Error('These geosets have no UV set ' + uvSet + '.');
    const pictures = [],
      teamColor = sample.teamColor || (await this.pictureTeamColor(env.session.id));
    for (const group of groupGeosetsByTexture(model, geosets)) {
      const list = group.geosets.map(g => model.Geosets[g]),
        range = uvRange(uvBounds(list, uvSet)),
        tiles = uvTiles(range),
        { width, height } = uvPictureSize(range),
        canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d'),
        spanU = range.maxU - range.minU,
        spanV = range.maxV - range.minV,
        px = u => ((u - range.minU) / spanU) * width,
        py = v => ((v - range.minV) / spanV) * height;
      // Background: the material as the UV Wrapper shows it (every layer composited, team colour
      // and glow included), tiled across the range (Warcraft III wraps), else plain grey.
      context.fillStyle = '#808080';
      context.fillRect(0, 0, width, height);
      let note = '';
      if (!group.layers.length) note = 'no material layers: plain grey background';
      else {
        let picture = null;
        try {
          const assets = new Map();
          for (const layer of group.layers)
            if (layer.path) {
              const asset = await loadTextureAsset(layer.path, env.session);
              if (asset) assets.set(gamePathKey(layer.path), asset);
            }
          const { renderUVMaterialTexture } = await import('./uv-material-preview.js');
          const backdrop = await renderUVMaterialTexture(model, group.material, assets, { teamColor, time: sample.frame ?? 0, sequenceIndex: sample.sequence ?? -1 });
          picture = await loadPicture(backdrop.url);
          if (backdrop.warnings.length) note = 'not shown: ' + backdrop.warnings.join(', ');
        } catch (error) {
          note = 'texture could not be loaded (' + error.message + '): plain grey background';
        }
        if (picture)
          for (let tu = tiles.u[0]; tu < tiles.u[1]; tu++)
            for (let tv = tiles.v[0]; tv < tiles.v[1]; tv++)
              context.drawImage(picture, px(tu), py(tv), px(tu + 1) - px(tu), py(tv + 1) - py(tv));
      }
      // Tile borders where the UVs go outside 0..1.
      if (spanU > 1 || spanV > 1) {
        context.strokeStyle = 'rgba(255,255,0,0.7)';
        context.lineWidth = 1;
        context.beginPath();
        for (let tu = Math.ceil(range.minU); tu <= range.maxU; tu++) (context.moveTo(px(tu), 0), context.lineTo(px(tu), height));
        for (let tv = Math.ceil(range.minV); tv <= range.maxV; tv++) (context.moveTo(0, py(tv)), context.lineTo(width, py(tv)));
        context.stroke();
      }
      // White under cyan keeps the thin edges readable on both light and dark textures.
      const edges = group.geosets.flatMap(g => uvEdges(model.Geosets[g], uvSet));
      for (const [style, line] of [['rgba(255,255,255,0.6)', 2], ['rgba(0,255,255,0.95)', 1]]) {
        context.strokeStyle = style;
        context.lineWidth = line;
        context.beginPath();
        for (let i = 0; i < edges.length; i += 4) {
          context.moveTo(px(edges[i]), py(edges[i + 1]));
          context.lineTo(px(edges[i + 2]), py(edges[i + 3]));
        }
        context.stroke();
      }
      let dots = 0;
      context.fillStyle = '#ff2020';
      for (const g of group.geosets)
        for (const [u, v] of markedUvPoints(model.Geosets[g], marks[g] || [], uvSet)) {
          context.beginPath();
          context.arc(px(u), py(v), 3.5, 0, Math.PI * 2);
          context.fill();
          dots++;
        }
      // Islands (the UV Wrapper's pieces), numbered at their centres, largest first.
      const islands = group.geosets.flatMap(g => uvIslands(model.Geosets[g], uvSet).map(island => ({ ...island, geoset: g }))).sort((a, b) => b.area - a.area),
        numbered = islands.slice(0, MAX_ISLAND_NUMBERS);
      context.font = 'bold 14px Tahoma, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.lineWidth = 3;
      numbered.forEach((island, i) => {
        context.strokeStyle = '#000000';
        context.strokeText(String(i + 1), px(island.u), py(island.v));
        context.fillStyle = '#ffff00';
        context.fillText(String(i + 1), px(island.u), py(island.v));
      });
      const round = value => Math.round(value * 1000) / 1000,
        islandText = numbered
          .map((island, i) => `${i + 1} geoset ${island.geoset} (${island.triangles} triangles, u ${round(island.minU)}..${round(island.maxU)}, v ${round(island.minV)}..${round(island.maxV)})`)
          .join('; ');
      pictures.push({
        label: `UV layout, set ${uvSet}; geosets ${group.geosets.join(', ')}; material ${group.material} layers ${group.layers.map(layerText).join(' + ') || 'none'}${group.layers.some(layer => layer.replaceableId === 1 || layer.replaceableId === 2) ? '; team colour ' + teamColor : ''}; UV range u ${round(range.minU)}..${round(range.maxU)}, v ${round(range.minV)}..${round(range.maxV)}${note ? '; ' + note : ''}${dots ? '; red dots: ' + dots + ' marked vertices' : ''}; islands numbered in yellow, largest first: ${islandText}${islands.length > numbered.length ? `; ${islands.length - numbered.length} smaller islands not numbered` : ''}`,
        image: canvas.toDataURL('image/png'),
      });
    }
    return pictures;
  }
  inspectUi() {
    this.controls.clear();
    const rows = [];
    for (const el of document.querySelectorAll(
      'button,input,select,textarea,canvas,[role=button],[role=slider]',
    )) {
      if (
        el.closest('.ai-assistant,.ai-open') ||
        el.type === 'password' ||
        el.type === 'file' ||
        !el.getBoundingClientRect().width ||
        el.closest('[inert]')
      )
        continue;
      const id = 'control-' + crypto.randomUUID();
      this.controls.set(id, el);
      const { x, y, width, height } = el.getBoundingClientRect();
      rows.push({
        id,
        type: el.type || el.tagName.toLowerCase(),
        label:
          el.getAttribute('aria-label') ||
          el.title ||
          el.labels?.[0]?.textContent.trim() ||
          el.textContent.trim().slice(0, 180) ||
          el.closest('[aria-label]')?.getAttribute('aria-label') ||
          el.tagName.toLowerCase(),
        rect: { x, y, width, height },
        disabled: !!el.disabled,
        value: el.type === 'checkbox' ? el.checked : el.value,
        options:
          el.tagName === 'SELECT'
            ? [...el.options].map(o => ({ value: o.value, label: o.textContent }))
            : undefined,
      });
    }
    return rows;
  }
  attach(desktop) {
    if (!desktop?.onAiTool) return () => {};
    const pending = new Map();
    this.desktop = desktop;
    const awareness = desktop.onAiEvent(event => {
      if (event.type === 'awareness') {
        this.awarenessEnabled = event.enabled;
        clearTimeout(this.awarenessTimer);
        this.awarenessTimer = null;
        this.awarenessSignature = null;
        if (event.enabled) this.editorChanged();
      }
    });
    desktop
      .aiStatus()
      .then(value => {
        this.awarenessEnabled = value.awareness;
        this.editorChanged();
      })
      .catch(error => desktop.aiAwarenessError?.(error.message));
    const cancel = desktop.onAiToolCancel(id => pending.get(id)?.abort());
    const detach = desktop.onAiTool(async request => {
      const controller = new AbortController();
      pending.set(request.id, controller);
      try {
        desktop.aiToolResult({
          id: request.id,
          result: await this.call(request.name, request.arguments, {
            signal: controller.signal,
            requestId: request.id,
          }),
        });
      } catch (error) {
        desktop.aiToolResult({ id: request.id, error: error.message });
      } finally {
        pending.delete(request.id);
      }
    });
    return () => {
      clearTimeout(this.awarenessTimer);
      this.awarenessEnabled = false;
      this.desktop = null;
      awareness();
      for (const controller of pending.values()) controller.abort();
      pending.clear();
      cancel();
      detach();
    };
  }
  // A step that needs the program on screen (its buttons, windows or the Movement
  // timeline) waits until the user returns to the task's tab, then carries on with
  // the task's own selection. Everything else runs on the tab's model directly.
  async waitForTarget(id, { signal, requestId } = {}) {
    const target = id && this.targets.get(id);
    if (!target || this.state().session.id === target.documentId) return;
    const owner = () => this.state().sessions.find(s => s.id === target.documentId);
    if (!owner()) throw Error('The model this task works on was closed.');
    const document = owner().doc.name;
    const notify = waiting => {
      this.desktop?.aiToolWaiting?.({ id: requestId, waiting, document });
      window.dispatchEvent(new CustomEvent('mdlxl-ai-waiting', { detail: { waiting, document, documentId: target.documentId } }));
    };
    notify(true);
    try {
      await new Promise((resolve, reject) => {
        // A step that needs the screen waits briefly, then says so plainly: an indefinite
        // wait looked like a stalled editor and made the AI ask the user to switch tabs.
        const timer = setTimeout(
          () =>
            finish(
              Error(
                'This step needs the model "' + document + '" on screen, and the user is looking at another tab. Nothing was changed. Do not ask the user to switch tabs: use mdlxl_script, mdlxl_capture or the other tools that run on a tab in the background, or retry this step later.',
              ),
            ),
          this.screenWaitMs ?? 8000,
        );
        const finish = error => {
          clearTimeout(timer);
          this.waiters.delete(check);
          signal?.removeEventListener('abort', check);
          error ? reject(error) : resolve();
        };
        const check = () => {
          if (signal?.aborted) return finish(Error('AI request cancelled; no further edit was applied.'));
          if (!owner()) return finish(Error('The model this task works on was closed.'));
          if (this.state().session.id === target.documentId) finish();
        };
        this.waiters.add(check);
        signal?.addEventListener('abort', check);
      });
      await settle();
      await settle();
      try {
        if (target.job) { this.requireTarget(id); return; }
        checkAiTarget(target, this.state());
      } catch {
        if (target.restore && target.revision === this.state().doc.revision) {
          await this.host().restoreContext(target.restore);
          await settle();
        }
      }
    } finally {
      notify(false);
    }
  }
  editorChanged() {
    for (const waiter of [...this.waiters]) waiter();
    for (const listener of [...this.listeners]) listener();
    if (!this.awarenessEnabled || !this.desktop || this.awarenessTimer) return;
    // Coalesce real React/editor changes; no polling or idle provider requests.
    this.awarenessTimer = setTimeout(() => {
      this.awarenessTimer = null;
      if (!this.awarenessEnabled || !this.desktop) return;
      const s = this.state();
      if (!s.doc) return;
      const context = {
        documentId: s.session.id,
        name: s.doc.name,
        revision: s.doc.revision,
        selection: s.selection,
        selectedNodeIds: s.selectedNodeIds,
        checkedGeosets: Array.from(s.selectable),
        activeGeoset: s.activeGeoset,
        uvSet: s.uvSet,
        mode: s.mode,
        sequence: s.sequence,
        sequenceName: s.model.Sequences[s.sequence]?.Name || null,
        frame: s.playing ? null : s.time,
        globalSequence: s.globalSeqId,
        playing: s.playing,
        view: s.view,
        camera: s.cameraAngles,
        renderMode: s.renderMode,
        keyframes: s.keyframes,
        paintRevision: s.session.paintWorkingRevision,
        dialog: s.dialog?.type || null,
      };
      // Playback only reports that it is playing, not every frame.
      const signature = JSON.stringify(context);
      if (signature === this.awarenessSignature) return;
      this.awarenessSignature = signature;
      this.desktop.aiContextChanged(context);
    }, 400);
  }
}
