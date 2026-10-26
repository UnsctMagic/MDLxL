import { AI_TOOLS, aiToolEditsModel } from '../src/ai-tools.js';
import {
  aiSelectionSignature,
  checkAiTarget,
  readAiModel,
  patchAiModel,
  prepareAiEdit,
  applyAiEdit,
  encodeAiValue,
} from '../src/ai-model.js';
import { openDocument } from '../src/editor-document.js';
import { prepareModelSaveAsync } from './model-save.js';
import { flushSync } from 'react-dom';
import { aiCapabilities } from './ai-capabilities.js';
import { sampleAiModel } from '../src/ai-sampling.js';
import { aiAssets, validateAiAssets } from './ai-assets.js';
import { sketchContext, sketchStore } from '../src/ai-sketch.js';
import { aiCheckpoint, beginAiReview, recordAiChange, reviewAiModel, reviewStatus } from './ai-review.js';
import { SD_BRAIN_AVAILABLE } from '../src/ai-sd-rules.js';

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
const needsScreen = (name, args) =>
  name === 'mdlxl_ui' ||
  (name === 'mdlxl_command' && !['undo', 'redo'].includes(args.id)) ||
  (name === 'mdlxl_select' && !!args.keyframes);
// Model-space positions of the marked vertices, posed at the picture's frame.
function markedPositions(model, selection = {}, sequence, globalSequence, frame) {
  const valid = Object.entries(selection).filter(([gi, ids]) => model.Geosets[gi] && ids.length);
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
export class AiEditorBridge {
  constructor(host) {
    this.host = host;
    this.targets = new Map();
    this.controls = new Map();
    // Steps run in order per model tab; tasks on different models do not wait on each other.
    this.queues = new Map();
    this.waiters = new Set();
  }
  state() {
    return this.host().state();
  }
  summary() {
    return this.host().summary();
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
      session = target && s.sessions.find(x => x.id === target.documentId);
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
        hidden: target.hidden || {},
        hiddenGeosets: new Set(target.hiddenGeosets || []),
        playing: false,
        dialog: null,
        uvEditing: false,
        uvEligibleSelection: undefined,
      },
    };
  }
  context(existing) {
    if (existing) this.requireTarget(existing);
    const id = existing || crypto.randomUUID();
    if (!existing) {
      const state = this.state();
      this.targets.set(id, {
        documentId: state.session.id,
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
        hidden: structuredClone(state.hidden || {}),
        hiddenGeosets: Array.from(state.hiddenGeosets || []),
        animationPanel: state.animationPanel,
        // Drawings are part of the prompt: later notes elsewhere never change them.
        annotations: sketchContext(sketchStore.strokes(state.session.id), state.model),
        // The strokes themselves, to draw them over the task's off-screen pictures.
        strokes: sketchStore.strokes(state.session.id).map(s => ({ tool: s.tool, color: s.colorValue, points: Array.from(s.points) })),
        restore: viewSnapshot(state),
      });
    }
    if (this.targets.size > 100) this.targets.delete(this.targets.keys().next().value);
    const captured = this.targets.get(id),
      env = this.env(captured),
      { state, doc, session, model } = env,
      selected = structuredClone(env.live ? state.selection || {} : captured.selection);
    return {
      target: id,
      documentId: session.id,
      onScreen: env.live,
      ...(env.live
        ? {}
        : {
            background:
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
      hiddenVertices: state.hidden,
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
        vertices: g.Vertices.length / 3,
        triangles: g.Faces.length / 3,
        material: g.MaterialID,
      })),
      nodes: model.Nodes.filter(Boolean).map(n => ({ id: n.ObjectId, name: n.Name, parent: n.Parent })),
      sequences: encodeAiValue(model.Sequences),
      diagnostics: doc.diagnostics,
      annotations: captured.annotations,
      documents: this.documents(),
      commands: this.host()
        .commands()
        .map(c => ({ id: c.id, label: c.label, enabled: c.enabled })),
    };
  }
  documents() {
    const s = this.state();
    return s.sessions.map(x => ({
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
    if (s.session.id !== target.documentId) {
      const session = s.sessions.find(x => x.id === target.documentId);
      if (session) target.revision = session.doc.revision;
      target.offscreen = true;
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
  }
  async call(name, args = {}, options = {}) {
    const key = (args.target && this.targets.get(args.target)?.documentId) || '',
      op = (this.queues.get(key) || Promise.resolve()).then(async () => {
      if (needsScreen(name, args)) await this.waitForTarget(args.target, options);
      let review, revision, paint;
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
      let result;
      try {
        result = await this.dispatch(name, args, options);
        return result;
      } finally {
        const env = review && current();
        if (env && (env.doc.revision !== revision || env.session.paintWorkingRevision !== paint))
          recordAiChange(review, result, env.model);
        if (result && review) result.review = reviewStatus(review);
        this.editorChanged();
      }
    });
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
        own = args.target ? this.env(this.requireTarget(args.target)).session : s.session,
        document = args.documentId ? s.sessions.find(x => x.id === args.documentId) : own;
      if (!document) throw Error('Reference model is no longer open.');
      return readAiModel(document.doc.model, args);
    }
    if (name === 'mdlxl_document' && args.action === 'list') return this.documents();
    if (name === 'mdlxl_ui' && args.action === 'inspect') return this.inspectUi();
    const target = this.requireTarget(args.target),
      host = this.host(),
      env = this.env(target),
      state = env.state;
    if (name === 'mdlxl_sample') return sampleAiModel(env.model, this.contextFor(args.target), args);
    if (name === 'mdlxl_assets') {
      const result = await aiAssets(args, { ...host, state: () => env.state }, () => {
        active();
        this.requireTarget(args.target);
      });
      active();
      return result;
    }
    if (name === 'mdlxl_script' || name === 'mdlxl_patch') {
      if (state.saving) throw Error('Wait for the current save to finish.');
      if ((name === 'mdlxl_patch' || args.edit) && state.mode === 'paint')
        throw Error(
          'Paint has its own working model. Use Paint controls, or use mdlxl_view to leave Paint and apply it through the editor before editing the model.',
        );
      const before = structuredClone(env.doc.model);
      let result;
      if (name === 'mdlxl_patch') result = { model: patchAiModel(before, args.operations) };
      else
        result = await window.desktop.aiScript({
          requestId,
          code: args.code,
          timeoutMs: args.timeoutMs,
          model: structuredClone(before),
          selection: structuredClone(target.selection),
          context: this.contextFor(args.target),
          references: Object.fromEntries(
            state.sessions
              .filter(s => s !== env.session)
              .map(s => [s.id, { name: s.doc.name, model: structuredClone(s.doc.model) }]),
          ),
        });
      active();
      this.requireTarget(args.target);
      const value = encodeAiValue(result.value);
      if (name === 'mdlxl_script' && !args.edit) return { value, logs: result.logs || [], applied: false };
      if (typeof args.label !== 'string' || !args.label.trim() || args.label.length > 200)
        throw Error('An edit needs a short Undo label.');
      const prepared = prepareAiEdit(before, result.model, args);
      // The user may have switched tabs while the script ran: commit where the tab is now.
      const now = this.env(target),
        { doc } = now;
      const assets = validateAiAssets(result.assets || [], result.model, now.session.assets);
      if (!prepared.changeCount) return { applied: false, changes: [], value, logs: result.logs || [] };
      const options = { rethrow: true, validate: (model, committed) => prepareAiEdit(committed, model, args) };
      if (now.live)
        // The existing App.edit owns validation, UV-preview protection, history and refresh.
        flushSync(() => {
          host.edit(args.label, prepared.sections, model => applyAiEdit(model, prepared), options);
          if (result.selection && doc.revision !== target.revision) host.select({ vertices: result.selection });
        });
      else {
        // Its own document and Undo history; the tab on screen is not touched.
        host.editIn(target.documentId, args.label, prepared.sections, model => applyAiEdit(model, prepared), {
          ...options,
          selection: { vertices: result.selection || target.selection },
        });
        this.adoptTab(target);
      }
      if (doc.revision === target.revision) throw Error('The editor could not commit the edit.');
      // An edit the model could not be saved with is taken back at once; left in place it
      // would block every later checkpoint, review and Undo step. Checked in the document's
      // own format, and MDX too when it can convert (AI checkpoints use MDX).
      try {
        for (const format of new Set([doc.format, ...(doc.saveImpact('mdx').canSave ? ['mdx'] : [])]))
          doc.serialize(format);
      } catch (error) {
        if (now.live) await host.command('undo');
        else {
          host.undoIn(target.documentId, false);
          this.adoptTab(target);
        }
        this.advance(args.target);
        throw Error(
          `Not applied: the model could not be saved after this edit (${error.message}), so it was undone. Check each new or changed geoset: Vertices and Normals as Float32Array (3 per vertex), TVertices as [Float32Array] (2 per vertex), Faces as Uint16Array of valid indices, VertexGroup as Uint8Array (1 per vertex), Groups and MaterialID valid. sd-kit commit and Forge commitForge build complete geosets.`,
        );
      }
      this.advance(args.target);
      // Texture bytes load only after a successful commit, so a refused edit leaves none behind.
      if (assets.length) await host.addAssetsIn(target.documentId, assets);
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
      };
    }
    if (name === 'mdlxl_select') {
      this.validateSelection(args, env);
      if (!env.live) {
        if (args.keyframes) throw Error(LEFT_TAB);
        host.selectIn(target.documentId, args);
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
        // Undo and Redo work on the task's own model; other commands need its tab.
        if (!['undo', 'redo'].includes(args.id)) throw Error(LEFT_TAB);
        host.undoIn(target.documentId, args.id === 'redo');
        this.adoptTab(target);
        this.advance(args.target);
        return { invoked: args.id, dialog: null, context: this.contextFor(args.target) };
      }
      const command = host.commands().find(c => c.id === args.id);
      if (!command?.enabled) throw Error('This editor command is unavailable: ' + args.id);
      await host.command(args.id);
      await settle();
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
      await settle();
      this.advance(args.target, true);
      return this.contextFor(args.target);
    }
    if (name === 'mdlxl_capture' || (name === 'mdlxl_ui' && args.action === 'capture')) {
      if (name === 'mdlxl_capture' && args.samples) {
        // Each sample is drawn off-screen, so the view on screen never moves.
        for (const sample of args.samples) checkView(sample, env.model);
        const images = [];
        for (const sample of args.samples) {
          active();
          this.requireTarget(args.target);
          images.push(await this.picture(args.target, sample));
        }
        return { images };
      }
      // On screen, the viewport as the user sees it, marks included; otherwise off-screen.
      if (name === 'mdlxl_capture')
        return { image: env.live ? await host.capture() : (await this.picture(args.target)).image };
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
        const reference = await host.addReference(record);
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
        active();
        this.requireTarget(args.target);
        const result = await window.desktop.aiWriteModel({
          path: args.path,
          bytes: bytes.bytes,
          format,
          forgeAssets: host.assetsIn(target.documentId),
          overwrite: args.overwrite === true,
        });
        return { ...result, revision: target.revision, format };
      }
      if (args.action === 'validate') {
        const results = [];
        for (const format of ['mdx', 'mdl'])
          try {
            const saved = await prepareModelSaveAsync(env.doc, format),
              reopened = openDocument(saved.bytes, 'AI round-trip.' + format);
            results.push({
              format,
              bytes: saved.bytes.byteLength,
              diagnostics: reopened.diagnostics,
              readOnly: reopened.readOnly,
            });
          } catch (error) {
            results.push({ format, error: error.message });
          }
        return { results, gameplayTested: false };
      }
    }
    throw Error('Unsupported tool action.');
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
  // chooses another view, animation or frame for this picture only.
  async picture(id, sample = {}) {
    const target = this.targets.get(id),
      { state: s, model } = this.env(target);
    const globalSequence =
      sample.globalSequence !== undefined ? sample.globalSequence : sample.sequence !== undefined ? null : s.globalSeqId;
    const sequence = globalSequence == null ? (sample.sequence ?? s.sequence) : -1;
    const frame =
      sample.frame ??
      (sample.globalSequence != null
        ? 0
        : sample.sequence !== undefined && sample.sequence !== s.sequence
          ? (model.Sequences[sample.sequence]?.Interval?.[0] ?? 0)
          : s.time);
    const view = sample.view || s.view,
      // Pictures show the surface; wireframe marks belong to the live viewport.
      renderMode = s.renderMode === 'solid' ? 'solid' : 'textured';
    const marked = markedPositions(model, target.selection, sequence, globalSequence, frame);
    if (sample.fit === 'selection' && !marked.length) throw Error('A close-up needs marked vertices: mark them with select first.');
    const image = await this.host().render({
      documentId: target.documentId,
      view,
      sequence,
      globalSequence,
      frame,
      renderMode,
      hiddenGeosets: s.hiddenGeosets,
      marks: { strokes: target.strokes || [], vertices: marked },
      focus: sample.fit === 'selection' ? marked : null,
    });
    return {
      label: `${view}; ${globalSequence == null ? 'sequence ' + sequence : 'global sequence ' + globalSequence}; frame ${frame}${sample.fit === 'selection' ? '; close-up of the marked vertices' : ''}`,
      image,
    };
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
        const finish = error => {
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
    if (!this.awarenessEnabled || !this.desktop || this.awarenessTimer) return;
    // Coalesce real React/editor changes; no polling or idle provider requests.
    this.awarenessTimer = setTimeout(() => {
      this.awarenessTimer = null;
      if (!this.awarenessEnabled || !this.desktop) return;
      const s = this.state();
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
