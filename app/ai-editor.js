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
import { aiCheckpoint, beginAiReview, recordAiChange, reviewAiModel, reviewStatus } from './ai-review.js';

const guides = import.meta.glob(['../docs/*.md', '../README.md'], { query: '?raw', import: 'default' });
const settle = () => new Promise(resolve => setTimeout(resolve, 60));
const finite = (value, name) => {
  if (!Number.isFinite(value)) throw Error('Invalid ' + name);
  return value;
};
export class AiEditorBridge {
  constructor(host) {
    this.host = host;
    this.targets = new Map();
    this.controls = new Map();
    this.queue = Promise.resolve();
  }
  state() {
    return this.host().state();
  }
  summary() {
    return this.host().summary();
  }
  context(existing) {
    const state = this.state(),
      { doc, session, model } = state;
    if (existing) this.requireTarget(existing);
    const id = existing || crypto.randomUUID(),
      selected = structuredClone(state.selection || {});
    if (!existing)
      this.targets.set(id, {
        documentId: session.id,
        revision: doc.revision,
        selectionSignature: aiSelectionSignature(state),
        selection: selected,
        sequence: state.sequence,
        frame: state.time,
        keyframes: structuredClone(state.keyframes),
        globalSequence: state.globalSeqId,
        workplane: state.workplane,
        view: state.view,
      });
    if (this.targets.size > 100) this.targets.delete(this.targets.keys().next().value);
    const captured = this.targets.get(id);
    return {
      target: id,
      documentId: session.id,
      name: doc.name,
      path: session.path,
      revision: doc.revision,
      version: model.Version,
      readOnly: doc.readOnly,
      dirty: doc.dirty,
      selection: selected,
      selectedNodeIds: [...state.selectedNodeIds],
      checkedGeosets: Array.from(state.selectable),
      activeGeoset: state.activeGeoset,
      uvSet: state.uvSet,
      mode: state.mode,
      animationPanel: state.animationPanel,
      sequence: state.sequence,
      sequenceName: model.Sequences[state.sequence]?.Name || null,
      frame: captured.frame,
      liveFrame: state.time,
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
      documents: state.sessions.map(s => ({
        id: s.id,
        name: s.doc.name,
        path: s.path,
        active: s === session,
        revision: s.doc.revision,
      })),
      commands: this.host()
        .commands()
        .map(c => ({ id: c.id, label: c.label, enabled: c.enabled })),
    };
  }
  requireTarget(id) {
    const target = this.targets.get(id);
    checkAiTarget(target, this.state());
    return target;
  }
  advance(id, viewChanged = false) {
    const target = this.targets.get(id),
      s = this.state();
    target.revision = s.doc.revision;
    target.selectionSignature = aiSelectionSignature(s);
    target.selection = structuredClone(s.selection);
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
    const op = this.queue.then(async () => {
      let review, revision, paint;
      if (aiToolEditsModel(name, args)) {
        review = await beginAiReview(this, args.target, options);
        revision = this.state().doc.revision;
        paint = this.state().session.paintWorkingRevision;
      }
      let result;
      try {
        result = await this.dispatch(name, args, options);
        return result;
      } finally {
        if (
          review &&
          (this.state().doc.revision !== revision || this.state().session.paintWorkingRevision !== paint)
        )
          recordAiChange(review, result, this.state().model);
        if (result && review) result.review = reviewStatus(review);
        this.editorChanged();
      }
    });
    this.queue = op.catch(() => {});
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
      const index = Object.keys(guides).map(path => path.replace('../', ''));
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
      if (args.target) this.requireTarget(args.target);
      const s = this.state(),
        document = args.documentId ? s.sessions.find(x => x.id === args.documentId) : s.session;
      if (!document) throw Error('Reference model is no longer open.');
      return readAiModel(document.doc.model, args);
    }
    if (name === 'mdlxl_document' && args.action === 'list') return this.context().documents;
    if (name === 'mdlxl_ui' && args.action === 'inspect') return this.inspectUi();
    const target = this.requireTarget(args.target),
      host = this.host(),
      state = this.state();
    if (name === 'mdlxl_sample') return sampleAiModel(state.model, this.contextFor(args.target), args);
    if (name === 'mdlxl_assets') {
      const result = await aiAssets(args, host, () => {
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
      const before = structuredClone(state.doc.model);
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
              .filter(s => s !== state.session)
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
      const assets = validateAiAssets(result.assets || [], result.model, state.session.assets);
      if (!prepared.changeCount) return { applied: false, changes: [], value, logs: result.logs || [] };
      // Texture bytes are loaded first so the committed model never names a missing
      // image. They are session data, not model data; Undo of the edit drops them on save.
      if (assets.length) {
        await host.addAssets(assets);
        active();
        this.requireTarget(args.target);
      }
      // The existing App.edit owns validation, UV-preview protection, history and refresh.
      flushSync(() => {
        host.edit(args.label, prepared.sections, model => applyAiEdit(model, prepared), {
          rethrow: true,
          validate: (model, committed) => prepareAiEdit(committed, model, args),
        });
        if (result.selection && state.doc.revision !== target.revision)
          host.select({ vertices: result.selection });
      });
      if (state.doc.revision === target.revision) throw Error('The editor could not commit the edit.');
      this.advance(args.target);
      return {
        applied: true,
        target: args.target,
        revision: state.doc.revision,
        changeCount: prepared.changeCount,
        changes: prepared.summary,
        assets: assets.map(a => a.name),
        value,
        logs: result.logs || [],
        diagnostics: state.doc.diagnostics,
      };
    }
    if (name === 'mdlxl_select') {
      this.validateSelection(args);
      flushSync(() => host.select(args));
      if (args.keyframes) {
        await host.selectKeys(args.keyframes);
        await settle();
      }
      this.advance(args.target, !!args.keyframes);
      return this.contextFor(args.target);
    }
    if (name === 'mdlxl_command') {
      const command = host.commands().find(c => c.id === args.id);
      if (!command?.enabled) throw Error('This editor command is unavailable: ' + args.id);
      await host.command(args.id);
      await settle();
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
      if (
        args.sequence !== undefined &&
        (!Number.isInteger(args.sequence) ||
          args.sequence < -1 ||
          args.sequence >= state.model.Sequences.length)
      )
        throw Error('Animation index is out of range.');
      if (args.frame !== undefined) finite(args.frame, 'animation frame');
      if (
        args.globalSequence != null &&
        (!Number.isInteger(args.globalSequence) || !(state.model.GlobalSequences[args.globalSequence] > 0))
      )
        throw Error('Global animation index is out of range.');
      if (args.globalSequence != null && args.sequence !== undefined)
        throw Error('Choose a local or global animation, not both.');
      await host.view(args);
      await settle();
      this.advance(args.target, true);
      return this.contextFor(args.target);
    }
    if (name === 'mdlxl_capture' || (name === 'mdlxl_ui' && args.action === 'capture')) {
      if (name === 'mdlxl_capture' && args.samples) {
        const images = [];
        for (const sample of args.samples) {
          active();
          this.requireTarget(args.target);
          await this.dispatch(
            'mdlxl_view',
            { target: args.target, ...sample, playing: false },
            { signal, requestId },
          );
          const result = await this.dispatch('mdlxl_capture', { target: args.target }, { signal, requestId });
          const current = this.state();
          images.push({
            label: `${current.view}; ${current.globalSeqId == null ? 'sequence ' + current.sequence : 'global sequence ' + current.globalSeqId}; frame ${current.time}`,
            image: result.image,
          });
        }
        return { images };
      }
      let rect;
      if (name === 'mdlxl_capture') {
        const canvas = [...document.querySelectorAll('.classic-view canvas')].find(
          el => el.getBoundingClientRect().width > 0,
        );
        if (!canvas) throw Error('The model viewport is not visible.');
        const { x, y, width, height } = canvas.getBoundingClientRect();
        rect = {
          x: Math.max(0, Math.floor(x)),
          y: Math.max(0, Math.floor(y)),
          width: Math.ceil(width),
          height: Math.ceil(height),
        };
      }
      const panel = document.querySelector('section.ai-assistant'),
        previous = panel?.style.visibility;
      try {
        if (panel) panel.style.visibility = 'hidden';
        await settle();
        return { image: await window.desktop.aiCapture(rect) };
      } finally {
        if (panel) panel.style.visibility = previous;
      }
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
          Object.keys(state.session.uvPreviews || {}).length ||
          Object.keys(state.session.animationDrafts || {}).length
        )
          throw Error(
            'There are preview edits. Use the normal Save command to include them, or apply them through the workspace controls before exporting the committed model.',
          );
        const format = args.format || args.path?.split('.').at(-1)?.toLowerCase();
        if (!['mdl', 'mdx'].includes(format)) throw Error('Choose MDL or MDX.');
        const bytes = await prepareModelSaveAsync(state.doc, format);
        active();
        this.requireTarget(args.target);
        const result = await window.desktop.aiWriteModel({
          path: args.path,
          bytes: bytes.bytes,
          format,
          forgeAssets: host.assets(),
          overwrite: args.overwrite === true,
        });
        return { ...result, revision: target.revision, format };
      }
      if (args.action === 'validate') {
        const results = [];
        for (const format of ['mdx', 'mdl'])
          try {
            const saved = await prepareModelSaveAsync(state.doc, format),
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
      s = this.state();
    return {
      target: id,
      documentId: target.documentId,
      revision: target.revision,
      selection: target.selection,
      selectedNodeIds: [...s.selectedNodeIds],
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
  validateSelection(args) {
    const { model } = this.state();
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
        global = this.state().globalSeqId,
        interval =
          global == null
            ? model.Sequences[this.state().sequence]?.Interval
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
  editorChanged() {
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
