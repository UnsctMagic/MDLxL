// A chat job works on its own copy of the model. The user's clicks and edits never
// stop it; when it ends, its changes go back as one Undo step, or the user is asked
// when both changed the same part.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createStarterDocument } from '../src/starter-model.js';
import { editTab, undoTab, selectTab } from '../src/ai-tab.js';
import { mergePlan, applyMerge, changedParts } from '../src/ai-own-copy.js';
import { AI_TAB_CLOSED } from '../src/ai-tools.js';

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
globalThis.Worker = class {
  postMessage() {
    setTimeout(() => this.onmessage({ data: { bytes: new Uint8Array([1, 2, 3]) } }));
  }
  terminate() {}
};
const { AiEditorBridge } = await import('../app/ai-editor.js');

// Two parts: geoset 0 and a copy of it off to the side as geoset 1.
function twoParts() {
  const doc = createStarterDocument();
  doc.apply('Second part', ['Geosets'], model => {
    const copy = structuredClone(model.Geosets[0]);
    for (let i = 0; i < copy.Vertices.length; i += 3) copy.Vertices[i] += 200;
    model.Geosets.push(copy);
  });
  return doc;
}
// A small editor with one model tab on screen, like the background tests' stand-in.
function editor() {
  const doc = twoParts();
  doc.name = 'A.mdx';
  const a = {
    id: 'A',
    doc,
    path: 'A.mdx',
    assets: new Map(),
    uvPreviews: {},
    animationDrafts: {},
    viewState: { mode: 'vertices', selectable: new Set([0, 1]), visibleOnly: new Set(), selection: { 0: [0, 1] }, activeGeoset: 0, uvSet: 0, selectedNodeIds: [] },
  };
  const app = { sessions: [a], active: a, renders: [], opened: [], view: 'perspective', time: 0 };
  const host = {
    state: () => {
      const s = app.active, v = s.viewState;
      return {
        session: s, sessions: app.sessions, doc: s.doc, model: s.doc.model,
        selection: v.selection, selectedNodeIds: v.selectedNodeIds, selectable: v.selectable, activeGeoset: v.activeGeoset, uvSet: v.uvSet, mode: v.mode,
        animationPanel: 'movement', sequence: -1, globalSeqId: null, time: app.time, view: app.view, workplane: 'xy', keyframes: null,
        renderMode: 'textured', hiddenGeosets: new Set(), playing: false, saving: false, dialog: null, uvEditing: false,
      };
    },
    sessions: () => app.sessions,
    summary: () => ({ documentId: app.active.id }),
    commands: () => [{ id: 'Weld', label: 'Weld', enabled: true }],
    command: async () => assert.fail('an editor command must not run on the user model'),
    edit: (label, sections, operation, options) => app.active.doc.apply(label, sections, operation, options),
    select: value => selectTab(app.active, value),
    restoreContext: async () => {},
    sessionOf: id => app.sessions.find(s => s.id === id),
    editIn: (id, ...change) => editTab(host.sessionOf(id), ...change),
    undoIn: (id, redo) => undoTab(host.sessionOf(id), redo),
    selectIn: (id, value) => selectTab(host.sessionOf(id), value),
    assetsIn: () => [],
    addAssetsIn: async () => {},
    openCopy: async copy => app.opened.push(copy),
    render: async spec => {
      app.renders.push(spec);
      return 'data:image/png;base64,offscreen';
    },
  };
  return { a, app, bridge: new AiEditorBridge(() => host) };
}
const raise = (target, geoset, by, label = 'AI raise') => ({
  target,
  label,
  scope: ['/Geosets/' + geoset + '/Vertices'],
  operations: [{ op: 'set', path: `/Geosets/${geoset}/Vertices/2`, value: by }],
});
// What the user does by hand: tick geosets, mark vertices, edit a part.
const userClicks = a => Object.assign(a.viewState, { selectable: new Set([1]), selection: { 1: [3] }, activeGeoset: 1 });
const userEdit = (a, geoset, value) => a.doc.apply('Owner edit', ['Geosets'], m => { m.Geosets[geoset].Vertices[5] = value; });

test('clicks and checked geosets never stop a job on its own copy; an unrelated edit merges as one Undo step', async () => {
  const { a, bridge } = editor();
  const { target, onScreen, ownCopy } = bridge.context(null, undefined, { ownCopy: true });
  assert.equal(onScreen, false);
  assert.match(ownCopy, /own copy/);
  assert.equal(bridge.copyJob('A').status, 'working');
  // The owner's case: geosets "All"/none, a new selection, then an edit on another part.
  userClicks(a);
  a.viewState.selectable = new Set([0, 1]);
  userEdit(a, 1, 77);
  const read = await bridge.call('mdlxl_context', { target });
  assert.deepEqual(read.selection, { 0: [0, 1] }, 'the AI keeps the selection sent with the prompt');
  assert.deepEqual(read.checkedGeosets, [0, 1]);
  const edited = await bridge.call('mdlxl_patch', raise(target, 0, 33));
  assert.equal(edited.applied, true);
  assert.notEqual(a.doc.model.Geosets[0].Vertices[2], 33, 'the user model is untouched while the AI works');
  const undoSteps = a.doc.historyStats.undoSteps;
  assert.deepEqual(await bridge.finishCopy(target), { status: 'merged' });
  assert.equal(a.doc.model.Geosets[0].Vertices[2], 33, "the AI's change is in the user's model");
  assert.equal(a.doc.model.Geosets[1].Vertices[5], 77, "the user's own edit stays");
  assert.equal(a.doc.historyStats.undoSteps, undoSteps + 1, 'one Undo step');
  assert.match(a.doc.historyStats.undoLabel, /^AI: AI raise/);
  a.doc.undo();
  assert.notEqual(a.doc.model.Geosets[0].Vertices[2], 33);
  assert.equal(a.doc.model.Geosets[1].Vertices[5], 77, 'Undo takes back only the AI job');
  assert.equal(bridge.copyJob('A'), null);
});

test('an edit to the same part asks; Save as a new file, Keep AI result and Keep yours do what they say', async () => {
  for (const choice of ['new', 'ai', 'yours']) {
    const { a, app, bridge } = editor();
    const { target } = bridge.context(null, undefined, { ownCopy: true });
    await bridge.call('mdlxl_patch', raise(target, 0, 33));
    userEdit(a, 0, 55);
    userEdit(a, 1, 66);
    const outcome = await bridge.finishCopy(target);
    assert.equal(outcome.status, 'clash');
    assert.deepEqual(outcome.clashes, ['Geosets/0']);
    assert.equal(bridge.copyJob('A').status, 'clash');
    assert.notEqual(a.doc.model.Geosets[0].Vertices[2], 33, 'nothing is merged before the user chooses');
    await bridge.resolveCopy(target, choice);
    const g = a.doc.model.Geosets;
    if (choice === 'new') {
      assert.equal(app.opened.length, 1);
      assert.equal(app.opened[0].doc.model.Geosets[0].Vertices[2], 33, 'the new tab has the AI result');
      assert.equal(g[0].Vertices[5], 55);
      assert.notEqual(g[0].Vertices[2], 33, "the user's model stays as it is");
    } else if (choice === 'ai') {
      assert.equal(g[0].Vertices[2], 33);
      assert.equal(g[1].Vertices[5], 66, "the user's edits elsewhere stay");
    } else {
      assert.notEqual(g[0].Vertices[2], 33);
      assert.equal(g[0].Vertices[5], 55);
    }
    assert.equal(bridge.copyJob('A'), null);
  }
});

test('Adapt keeps the AI result as a version and asks the AI to fit it onto the current model', async () => {
  const { a, bridge } = editor();
  const { target } = bridge.context(null, undefined, { ownCopy: true });
  await bridge.call('mdlxl_patch', raise(target, 0, 33));
  userEdit(a, 0, 55);
  await bridge.finishCopy(target);
  const outcome = await bridge.resolveCopy(target, 'adapt');
  assert.equal(outcome.status, 'adapt');
  assert.match(outcome.prompt, /do not redo the job from scratch/);
  assert.equal(bridge.versionStore.get('A', 'AI result').Geosets[0].Vertices[2], 33);
  // The next job starts from the user's latest version, on a new copy.
  const next = bridge.context(null, undefined, { ownCopy: true });
  assert.equal((await bridge.call('mdlxl_read', { target: next.target, path: '/Geosets/0/Vertices' })).value.$data[5], 55);
});

test("the AI's pictures and view are its own; the user's camera and frame never change them", async () => {
  const { a, app, bridge } = editor();
  const { target } = bridge.context(null, undefined, { ownCopy: true });
  await bridge.call('mdlxl_patch', raise(target, 0, 33));
  app.view = 'top';
  app.time = 500;
  userClicks(a);
  await bridge.call('mdlxl_capture', { target });
  const spec = app.renders.at(-1);
  assert.equal(spec.view, 'perspective');
  assert.equal(spec.frame, 0);
  assert.equal(spec.model.Geosets[0].Vertices[2], 33, "the picture shows the AI's copy");
});

test('screen-only steps are refused with a plain message; a closed tab stops with one line', async () => {
  const { app, bridge } = editor();
  const { target } = bridge.context(null, undefined, { ownCopy: true });
  await assert.rejects(bridge.call('mdlxl_command', { target, id: 'Weld' }), /own copy/);
  await bridge.call('mdlxl_patch', raise(target, 0, 33));
  await bridge.call('mdlxl_command', { target, id: 'undo' });
  assert.notEqual((await bridge.call('mdlxl_read', { target, path: '/Geosets/0/Vertices' })).value.$data[2], 33, 'Undo works on the copy');
  app.sessions = [];
  await assert.rejects(bridge.call('mdlxl_read', { target, path: '/Geosets/0/Vertices' }), error => error.message === AI_TAB_CLOSED);
  assert.equal((await bridge.finishCopy(target)).status, 'closed');
});

test('calls from outside the chat keep working on the live editor', () => {
  const { bridge } = editor();
  assert.equal(bridge.context().onScreen, true);
});

test('parts: list items, one-level fields, added items and derived bounds', () => {
  const base = twoParts().model;
  const ai = structuredClone(base), live = structuredClone(base);
  ai.Geosets[0].Vertices[0] = 9;
  ai.Info.MinimumExtent = new Float32Array([1, 2, 3]);
  live.Info.MinimumExtent = new Float32Array([4, 5, 6]);
  live.Geosets[1].Vertices[0] = 8;
  assert.deepEqual(mergePlan(base, live, ai).clashes, [], 'different geosets and bounds never clash');
  // Adding a geoset at the end leaves earlier ones in place; removing one moves the later ones.
  const added = structuredClone(base);
  added.Geosets.push(structuredClone(base.Geosets[0]));
  assert.deepEqual(mergePlan(base, live, added).clashes, []);
  const removed = structuredClone(base);
  removed.Geosets.splice(0, 1);
  assert.deepEqual(mergePlan(base, live, removed).clashes, [], 'removing geoset 0 keeps the edited geoset 1');
  const edited0 = structuredClone(base);
  edited0.Geosets[0].Vertices[0] = 7;
  assert.deepEqual(mergePlan(base, edited0, removed).clashes, ['Geosets'], 'removing the part the user edited clashes');
  const inserted = structuredClone(base), extra = structuredClone(base.Geosets[0]);
  extra.Vertices[1] += 50;
  inserted.Geosets.unshift(extra);
  assert.deepEqual(mergePlan(base, inserted, live).clashes, ['Geosets/1'], 'a part after one the user inserted has moved');
  assert.deepEqual(mergePlan(base, added, live).clashes, [], 'a part the user added at the end moves nothing');
  assert.deepEqual(changedParts([{ kind: 'value', path: ['Info', 'Name'] }], base), [{ section: 'Info', field: 'Name' }]);
  const plan = mergePlan(base, live, ai), merged = structuredClone(live);
  applyMerge(merged, plan, ai);
  assert.equal(merged.Geosets[0].Vertices[0], 9);
  assert.equal(merged.Geosets[1].Vertices[0], 8);
});

test('a stopped job shows one friendly line in the thread, not an error', async () => {
  const { applyAiEvent } = await import('../src/ai-transcript.js');
  const thread = applyAiEvent([{ role: 'user', text: 'Raise it' }], { type: 'stopped', text: AI_TAB_CLOSED });
  assert.equal(thread.at(-1).notice, AI_TAB_CLOSED);
  assert.equal(thread.at(-1).error, undefined);
});
