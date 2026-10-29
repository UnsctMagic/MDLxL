// An AI task works on its own model tab while the user works on another one:
// edits, Undo, selection, views and pictures go to the task's tab; steps that
// need the program on screen wait; the tab on screen is never touched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createStarterDocument } from '../src/starter-model.js';
import { editTab, undoTab, selectTab } from '../src/ai-tab.js';
import { sketchStore } from '../src/ai-sketch.js';

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
  const app = { sessions: [a, b], references: [], active: a, renders: [], liveCaptures: 0, liveViews: [], commands: [] };
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
    sessions: () => [...app.sessions, ...app.references],
    summary: () => ({ documentId: app.active.id }),
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

test('a close-up sample frames the marked vertices; other samples frame the whole model', async () => {
  const { a, app, bridge } = editor();
  const { target } = bridge.context();
  const shots = await bridge.call('mdlxl_capture', { target, samples: [{ view: 'front', fit: 'selection' }, { view: 'front' }] });
  assert.match(shots.images[0].label, /close-up of the marked vertices/);
  const vertices = a.doc.model.Geosets[0].Vertices;
  assert.deepEqual(Array.from(app.renders[0].focus), Array.from(vertices.subarray(0, 6)), 'the two marked vertices');
  assert.equal(app.renders[1].focus, null);
  await bridge.call('mdlxl_select', { target, vertices: {} });
  await assert.rejects(bridge.call('mdlxl_capture', { target, samples: [{ fit: 'selection' }] }), /mark them with select/);
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

test('a task waiting for its tab does not hold up a task on another model', async () => {
  const { a, b, bridge, show } = editor();
  const onA = bridge.context().target;
  show(b);
  const onB = bridge.context().target;
  let saved = false;
  const save = bridge.call('mdlxl_command', { target: onA, id: 'save' }).then(() => (saved = true));
  const moved = await bridge.call('mdlxl_patch', move(onB, 42, 'B move'));
  assert.ok(moved.applied && !saved, "B's edit ran while A's step waits for its tab");
  assert.equal(b.doc.model.Geosets[0].Vertices[0], 42);
  show(a);
  await save;
  assert.ok(saved);
});

const strokeShape = n => ({ normals: Array(n * 3).fill(0), onSurface: Array(n).fill(false), width: 1, reach: 1, lift: 0, view: [0, 0, -1] });
test("the task's pictures carry its drawings and marked vertices from when the prompt was sent", async () => {
  const { app, bridge, show, a, b } = editor();
  sketchStore.add({ documentId: 'A.mdx', tool: 'marker', color: 'yellow', colorValue: '#ffd60a', points: [1, 2, 3, 4, 5, 6], ...strokeShape(2) });
  const { target } = bridge.context();
  show(b);
  // A drawing made later, or on another tab, is not part of this task.
  sketchStore.add({ documentId: 'A.mdx', tool: 'pen', color: 'red', colorValue: '#ff0000', points: [7, 8, 9], ...strokeShape(1) });
  await bridge.call('mdlxl_capture', { target });
  const { marks } = app.renders.at(-1);
  assert.deepEqual(marks.strokes, [{ tool: 'marker', color: '#ffd60a', points: [1, 2, 3, 4, 5, 6] }]);
  const vertices = a.doc.model.Geosets[0].Vertices;
  assert.deepEqual(marks.vertices, [...vertices.subarray(0, 6)], 'the two marked vertices, where the model has them');
});
test('two region targets on one live model preserve each other, enforce scope and keep independent Undo', async t => {
  const { EditorDocument } = await import('../src/editor-document.js');
  const { prepareModelSave } = await import('../src/save-target.js');
  const oldWorker = globalThis.Worker;
  globalThis.Worker = class {
    postMessage({ snapshot, format, name }) {
      setTimeout(() => {
        try { this.onmessage({ data: prepareModelSave(EditorDocument.restoreRecoveryState(snapshot), format, name) }); }
        catch (error) { this.onmessage({ data: { error: error.message } }); }
      });
    }
    terminate() {}
  };
  t.after(() => { globalThis.Worker = oldWorker; });
  const { a, bridge } = editor();
  a.doc.apply('Second geoset', ['Geosets'], m => m.Geosets.push(structuredClone(m.Geosets[0])));
  const { target } = bridge.context();
  const declared = await bridge.call('mdlxl_regions', { target, action: 'declare', jobs: [{ job: 'Left', scope: ['/Geosets/0'] }, { job: 'Right', scope: ['/Geosets/1'] }] });
  const left = await bridge.call('mdlxl_regions', { action: 'begin', batch: declared.batch, index: 0, name: 'Crow' });
  const right = await bridge.call('mdlxl_regions', { action: 'begin', batch: declared.batch, index: 1, name: 'Raven' });
  const patch = (context, gi, value) => ({ target: context.target, label: 'Move part', scope: ['/Geosets/' + gi], operations: [{ op: 'set', path: '/Geosets/' + gi + '/Vertices/0', value }] });
  await bridge.call('mdlxl_patch', patch(left, 0, 12));
  assert.doesNotThrow(() => bridge.requireTarget(right.target));
  await bridge.call('mdlxl_patch', patch(right, 1, 17));
  assert.doesNotThrow(() => bridge.requireTarget(left.target));
  assert.equal(a.doc.model.Geosets[0].Vertices[0], 12);
  assert.equal(a.doc.model.Geosets[1].Vertices[0], 17);
  assert.deepEqual(a.doc._historyStore.undoEntries.slice(-2).map(e => e.label), ['Crow: Move part', 'Raven: Move part']);
  await assert.rejects(bridge.call('mdlxl_patch', patch(left, 1, 66)), /declared region/);
  a.doc.undo();
  assert.equal(a.doc.model.Geosets[0].Vertices[0], 12);
  assert.notEqual(a.doc.model.Geosets[1].Vertices[0], 17);
  a.doc.redo();
  const result = await bridge.call('mdlxl_regions', { action: 'finish', batch: declared.batch });
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.equal(result.validation.results.length, 2);
  a.doc.apply('User changes owned region', ['Geosets'], m => { m.Geosets[0].Vertices[1] += 2; });
  assert.throws(() => bridge.requireTarget(left.target), /region or one of its dependencies/);
});

test('combined review rejects a gap against an unassigned neighbour', async () => {
  const { reviewRegionBatch } = await import('../app/ai-review.js');
  const { a } = editor();
  const before=structuredClone(a.doc.model);
  before.Geosets[0].Faces=before.Geosets[0].Faces.slice(0,3);
  before.Geosets.push(structuredClone(before.Geosets[0]));
  const after=structuredClone(before),vertex=after.Geosets[0].Faces[0];
  after.Geosets[0].Vertices[vertex*3]+=2;
  let validated=false;
  const bridge={requireTarget:()=>({}),env:()=>({model:after}),dispatch:async()=>{validated=true;return {results:[{}]};}};
  const result=await reviewRegionBatch(bridge,'test',before,[{scope:['/Geosets/0'],dependencies:[],readOnly:false,structural:false}],{});
  assert.equal(result.passed,false);assert.ok(result.seams>0);assert.ok(result.posedSeamChecks>0);assert.ok(result.failures.length);assert.ok(validated);
});

test('model chats expose only their own attached donors, including scripts and reads in the background', async () => {
  const { a, b, app, bridge, show } = editor();
  const donorA = tab('Donor A.mdx'), donorB = tab('Donor B.mdx');
  Object.assign(donorA, { reference: true, referenceOwnerId: a.id, referenceChatId: 'chat-a' });
  Object.assign(donorB, { reference: true, referenceOwnerId: b.id, referenceChatId: 'chat-b' });
  app.references.push(donorA, donorB);
  assert.equal(app.sessions.length, 2);
  bridge.setChat(a.id, 'chat-a');
  const contextA = bridge.context();
  assert.deepEqual(contextA.documents.map(d => d.id), [a.id, donorA.id]);
  assert.deepEqual(bridge.references().map(d => d.id), [donorA.id]);
  show(b);
  bridge.setChat(b.id, 'chat-b');
  const contextB = bridge.context();
  assert.deepEqual(contextB.documents.map(d => d.id), [b.id, donorB.id]);
  assert.deepEqual(bridge.references().map(d => d.id), [donorB.id]);
  assert.deepEqual(bridge.context(contextA.target).documents.map(d => d.id), [a.id, donorA.id]);
  assert.deepEqual((await bridge.dispatch('mdlxl_document', { action: 'list', target: contextA.target })).map(d => d.id), [a.id, donorA.id]);
  await assert.rejects(() => bridge.dispatch('mdlxl_read', { target: contextA.target, documentId: donorB.id }), /Reference model is no longer open/);
  await assert.rejects(() => bridge.dispatch('mdlxl_read', { target: contextA.target, documentId: b.id }), /Reference model is no longer open/);
  window.desktop.aiScript = async args => {
    assert.deepEqual(Object.keys(args.references), [donorA.id]);
    return { value: Object.keys(args.references) };
  };
  const read = await bridge.dispatch('mdlxl_script', { target: contextA.target, code: 'return Object.keys(references);' });
  assert.deepEqual(read.value, [donorA.id]);
  const picture = await bridge.picture(contextA.target, {}, { documentId: donorA.id });
  assert.equal(picture.label, donorA.doc.name);
  assert.equal(app.renders.at(-1).documentId, donorA.id);
  await assert.rejects(() => bridge.picture(contextA.target, {}, { documentId: donorB.id }), /Reference model is no longer open/);
  // A new organiser for the same model starts without the previous chat's donors.
  show(a);
  bridge.setChat(a.id, 'new-chat-a');
  assert.deepEqual(bridge.references(), []);
  assert.deepEqual(bridge.context().documents.map(d => d.id), [a.id]);
  assert.deepEqual(bridge.context(contextA.target).documents.map(d => d.id), [a.id, donorA.id]);
});

test('references opened by a background job retain its original model and chat', async () => {
  const { a, b, app, bridge, show } = editor();
  bridge.setChat(a.id, 'chat-a');
  const { target } = bridge.context();
  show(b);
  bridge.setChat(b.id, 'chat-b');
  window.desktop.aiReadModel = async () => ({ name: 'Background donor.mdx', bytes: new Uint8Array([1]) });
  bridge.host().addReference = async (record, scope) => {
    assert.deepEqual(scope, { documentId: a.id, chatId: 'chat-a' });
    const donor = tab(record.name);
    Object.assign(donor, { reference: true, referenceOwnerId: scope.documentId, referenceChatId: scope.chatId });
    app.references.push(donor);
    return { id: donor.id, name: donor.doc.name };
  };
  await bridge.dispatch('mdlxl_document', { action: 'open', target, path: 'Donor.mdx' });
  assert.deepEqual(bridge.references(), []);
  assert.deepEqual(bridge.context(target).documents.map(d => d.id), [a.id, 'Background donor.mdx']);
  window.desktop.readPart = async () => ({ name: 'Part donor.mdx', bytes: new Uint8Array([1]) });
  await bridge.dispatch('mdlxl_assets', { source: 'parts', action: 'reference', target, id: 'Part donor.mdx' });
  assert.deepEqual(bridge.references(), []);
  assert.deepEqual(bridge.context(target).documents.map(d => d.id), [a.id, 'Background donor.mdx', 'Part donor.mdx']);
});
