// An AI task works on its own model tab while the user works on another one:
// edits, Undo, selection, views and pictures go to the task's tab; steps that
// need the program on screen wait; the tab on screen is never touched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createStarterDocument } from '../src/starter-model.js';
import { editTab, undoTab, selectTab } from '../src/ai-tab.js';

// app/ modules are Vite modules: stand in for their build-time file lists.
register(
  'data:text/javascript,' +
    encodeURIComponent(`export async function load(url, context, next) {
      const result = await next(url, context);
      if (!/\\/app\\/[^/]+\\.js$/.test(url)) return result;
      return { ...result, source: String(result.source).replaceAll('import.meta.glob(', '(() => ({}))(') };
    }`),
);
globalThis.window = Object.assign(new EventTarget(), { desktop: {} });
// Checkpoints serialize in a worker in the app; here a stand-in answers at once.
globalThis.Worker = class {
  postMessage() {
    setTimeout(() => this.onmessage({ data: { bytes: new Uint8Array([1, 2, 3]) } }));
  }
  terminate() {}
};
const { AiEditorBridge } = await import('../app/ai-editor.js');

const tab = (name, path) => {
  const doc = createStarterDocument();
  doc.name = name;
  return {
    id: name,
    doc,
    path,
    assets: new Map(),
    uvPreviews: {},
    animationDrafts: {},
    viewState: {
      mode: 'vertices',
      selectable: new Set([0]),
      visibleOnly: new Set(),
      selection: { 0: [0, 1] },
      hidden: {},
      activeGeoset: 0,
      uvSet: 0,
      selectedNodeIds: [],
    },
  };
};
// A small editor: tabs, the one on screen, and what the AI may use.
function editor() {
  const a = tab('A.mdx', 'A.mdx'),
    b = tab('B.mdx', 'B.mdx');
  const app = { sessions: [a, b], active: a, renders: [], liveCaptures: 0, liveViews: [], commands: [] };
  const host = {
    state: () => {
      const s = app.active, v = s.viewState;
      return {
        session: s,
        sessions: app.sessions,
        doc: s.doc,
        model: s.doc.model,
        selection: v.selection,
        selectedNodeIds: v.selectedNodeIds,
        selectable: v.selectable,
        activeGeoset: v.activeGeoset,
        uvSet: v.uvSet,
        mode: v.mode,
        animationPanel: 'movement',
        sequence: -1,
        globalSeqId: null,
        time: 0,
        view: 'perspective',
        workplane: 'xy',
        keyframes: null,
        renderMode: 'wireframe',
        hidden: {},
        hiddenGeosets: new Set(),
        playing: false,
        saving: false,
        dialog: null,
        uvEditing: false,
      };
    },
    summary: () => ({}),
    commands: () => [
      { id: 'undo', label: 'Undo', enabled: true },
      { id: 'save', label: 'Save', enabled: true },
    ],
    command: async id => {
      app.commands.push([app.active.id, id]);
      if (id === 'undo') app.active.doc.undo();
    },
    edit: (label, sections, operation, options) => app.active.doc.apply(label, sections, operation, options),
    select: value => selectTab(app.active, value),
    view: async value => app.liveViews.push(value),
    capture: async () => {
      app.liveCaptures++;
      return 'data:image/png;base64,live';
    },
    restoreContext: async () => {},
    sessionOf: id => app.sessions.find(s => s.id === id),
    editIn: (id, ...change) => editTab(host.sessionOf(id), ...change),
    undoIn: (id, redo) => undoTab(host.sessionOf(id), redo),
    selectIn: (id, value) => selectTab(host.sessionOf(id), value),
    assetsIn: () => [],
    addAssetsIn: async () => {},
    render: async spec => {
      app.renders.push(spec);
      return 'data:image/png;base64,offscreen';
    },
  };
  const bridge = new AiEditorBridge(() => host);
  const show = s => {
    app.active = s;
    bridge.editorChanged();
  };
  return { a, b, app, bridge, show };
}
const move = (target, value, label = 'AI move') => ({
  target,
  label,
  scope: ['/Geosets/0/Vertices'],
  operations: [{ op: 'set', path: '/Geosets/0/Vertices/0', value }],
});

test('a task edits its own model while the user edits another tab, each with its own Undo', async () => {
  const { a, b, app, bridge, show } = editor();
  const { target } = bridge.context();
  show(b);
  const ownerBefore = b.doc.model.Geosets[0].Vertices[0];
  b.doc.apply('Owner edit', ['Geosets'], m => {
    m.Geosets[0].Vertices[0] = ownerBefore + 1;
  });
  const context = await bridge.call('mdlxl_context', { target });
  assert.equal(context.onScreen, false);
  assert.match(context.background, /not showing/);
  assert.equal(context.name, 'A.mdx');
  assert.deepEqual(context.selection, { 0: [0, 1] }, 'the selection captured when the prompt was sent');
  // Two steps of one task, both on model A.
  await bridge.call('mdlxl_checkpoint', { target, prepare: true });
  const first = await bridge.call('mdlxl_patch', move(target, 11));
  const second = await bridge.call('mdlxl_patch', move(target, 12, 'AI move again'));
  assert.ok(first.applied && second.applied);
  assert.equal(a.doc.model.Geosets[0].Vertices[0], 12);
  assert.equal(b.doc.model.Geosets[0].Vertices[0], ownerBefore + 1, "the user's tab keeps their edit only");
  assert.deepEqual(a.doc._historyStore.undoEntries.map(e => e.label).slice(-2), ['AI move', 'AI move again']);
  assert.ok(!b.doc._historyStore.undoEntries.some(e => /AI/.test(e.label)), "no AI step in the user's Undo");
  assert.equal(second.review.changed, true);
  // Undo through the AI goes to its own model, never the tab on screen.
  await bridge.call('mdlxl_command', { target, id: 'undo' });
  assert.equal(a.doc.model.Geosets[0].Vertices[0], 11);
  assert.equal(b.doc.model.Geosets[0].Vertices[0], ownerBefore + 1);
  assert.equal(app.commands.length, 0, 'no command ran on the tab on screen');
  // The user's own Undo on B undoes their edit, and A keeps the AI's.
  b.doc.undo();
  assert.equal(b.doc.model.Geosets[0].Vertices[0], ownerBefore);
  assert.equal(a.doc.model.Geosets[0].Vertices[0], 11);
  assert.equal(app.active, b, 'the tab on screen never changed');
});

test('pictures of a model that is not showing are drawn off-screen and the screen never moves', async () => {
  const { app, bridge, show, b } = editor();
  const { target } = bridge.context();
  show(b);
  const one = await bridge.call('mdlxl_capture', { target });
  assert.equal(one.image, 'data:image/png;base64,offscreen');
  await bridge.call('mdlxl_view', { target, view: 'front', frame: 250 });
  const many = await bridge.call('mdlxl_capture', { target, samples: [{ view: 'left' }, { frame: 500 }] });
  assert.deepEqual(
    many.images.map(i => i.label),
    ['left; sequence -1; frame 250', 'front; sequence -1; frame 500'],
  );
  assert.ok(app.renders.every(spec => spec.documentId === 'A.mdx'));
  assert.equal(app.liveCaptures, 0);
  assert.equal(app.liveViews.length, 0, 'the view on screen was not changed');
  const context = await bridge.call('mdlxl_context', { target });
  assert.equal(context.view, 'front');
  assert.equal(context.frame, 250);
});

test('on the tab being shown, samples are still drawn off-screen; a plain capture copies the live view', async () => {
  const { app, bridge } = editor();
  const { target } = bridge.context();
  await bridge.call('mdlxl_capture', { target });
  await bridge.call('mdlxl_capture', { target, samples: [{ view: 'back' }, { view: 'right' }] });
  assert.equal(app.liveCaptures, 1);
  assert.equal(app.renders.length, 2);
  assert.equal(app.liveViews.length, 0);
});

test('a step that needs the screen waits for the task tab and then runs there', async () => {
  const { a, b, app, bridge, show } = editor();
  const { target } = bridge.context();
  show(b);
  const waiting = [];
  window.addEventListener('mdlxl-ai-waiting', event => waiting.push(event.detail));
  let done = false;
  const saved = bridge.call('mdlxl_command', { target, id: 'save' }).then(value => ((done = true), value));
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(done, false, 'the save waits while the user is on another tab');
  assert.deepEqual(waiting.at(-1), { waiting: true, document: 'A.mdx', documentId: 'A.mdx' });
  assert.equal(app.commands.length, 0);
  show(a);
  const result = await saved;
  assert.equal(result.invoked, 'save');
  assert.deepEqual(app.commands, [['A.mdx', 'save']]);
  assert.equal(waiting.at(-1).waiting, false);
});

test('the same tab still blocks: an edit by the user on the task model stops the task', async () => {
  const { a, b, bridge, show } = editor();
  const { target } = bridge.context();
  show(b);
  await bridge.call('mdlxl_patch', move(target, 5));
  show(a);
  // Back on screen the task carries on...
  await bridge.call('mdlxl_patch', move(target, 6));
  // ...until the user edits the same model at the same time.
  a.doc.apply('Owner edit', ['Geosets'], m => {
    m.Geosets[0].Vertices[1] += 3;
  });
  await assert.rejects(bridge.call('mdlxl_patch', move(target, 7)), /changed since this prompt/);
  assert.equal(a.doc.model.Geosets[0].Vertices[0], 6);
});

test("selection changes go to the task's tab, and closing that tab stops the task", async () => {
  const { a, b, app, bridge, show } = editor();
  const { target } = bridge.context();
  show(b);
  const context = await bridge.call('mdlxl_select', { target, vertices: { 0: [2] } });
  assert.deepEqual(context.selection, { 0: [2] });
  assert.deepEqual(a.viewState.selection, { 0: [2] }, 'switching to A shows the AI selection');
  assert.deepEqual(b.viewState.selection, { 0: [0, 1] }, "the user's tab keeps its own selection");
  app.sessions = [b];
  await assert.rejects(bridge.call('mdlxl_patch', move(target, 9)), /was closed/);
});
