// View AI work, the parts that run without the app: the chat keeps small copies of the
// pictures the AI received (W1); the live editor follows the AI (W2); edit steps name
// the parts they changed (W3). The packaged check is test/ai-watch.electron.cjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire, register } from 'node:module';
import { applyAiEvent, recordAiEvent } from '../src/ai-transcript.js';
import { createStarterDocument } from '../src/starter-model.js';
import { editTab, undoTab, selectTab } from '../src/ai-tab.js';
const require = createRequire(import.meta.url);
const chatState = require('../electron/ai-chat-state.cjs');
// app/ modules are Vite modules: stand in for their build-time file lists (as ai-background.test.js).
register(
  'data:text/javascript,' +
    encodeURIComponent(`export async function load(url, context, next) {
      const result = await next(url, context);
      if (!/\\/app\\/[^/]+\\.js$/.test(url)) return result;
      return { ...result, source: String(result.source).replaceAll('import.meta.glob(', '(() => ({}))(') };
    }`),
);
globalThis.window = Object.assign(new EventTarget(), { desktop: {} });
// The live editor draws about every 16 ms; a test frame is a short timer.
globalThis.requestAnimationFrame = callback => setTimeout(callback, 8);
globalThis.cancelAnimationFrame = id => clearTimeout(id);
const { AiEditorBridge } = await import('../app/ai-editor.js');
const watch = await import('../app/ai-watch.js');

const picture = n => ({ type: 'image', mimeType: 'image/png', data: 'FULL' + 'A'.repeat(4000) + n });
const conversation = () => ({ transcript: [{ role: 'user', text: 'go' }] });
const recorder = (chat, shrink, emitted = []) => {
  const r = new chatState.AiRecorder(chat, value => emitted.push(value), recordAiEvent, shrink);
  r.start({ role: 'user', text: 'go' });
  return r;
};
const fakeShrink = ({ data }) => 'data:image/jpeg;base64,small-' + data.at(-1);

test('W1: a capture step keeps small copies of its pictures in the saved chat and the console event', () => {
  const chat = conversation(), emitted = [], r = recorder(chat, fakeShrink, emitted);
  r.event({ type: 'tool', name: 'mdlxl_capture', callId: 'c1', detail: '{}' });
  r.event({ type: 'tool-result', name: 'mdlxl_capture', callId: 'c1', error: false, summary: '', content: [{ type: 'text', text: '{"label":"front"}' }, picture(1), picture(2)] });
  const part = chat.transcript.at(-1).parts.find(p => p.type === 'tool');
  assert.deepEqual(part.thumbs, ['data:image/jpeg;base64,small-1', 'data:image/jpeg;base64,small-2']);
  const sent = emitted.find(e => e.type === 'tool-result');
  assert.deepEqual(sent.thumbs, part.thumbs);
  // The full pictures never reach the saved chat or the console.
  assert.equal('content' in sent, false);
  assert.doesNotMatch(JSON.stringify(chat.transcript) + JSON.stringify(emitted), /FULL/);
  // The console applies the same event to its own copy of the chat.
  const shown = applyAiEvent([{ role: 'assistant', text: '', parts: [{ type: 'tool', id: 'c1', name: 'mdlxl_capture', status: 'running' }] }], sent);
  assert.deepEqual(shown[0].parts[0].thumbs, part.thumbs);
});

test('W1: Claude Code and Codex picture shapes are kept too; without a shrinker nothing is kept', () => {
  const chat = conversation(), r = recorder(chat, fakeShrink);
  r.event({ type: 'tool', name: 'mcp__mdlxl__mdlxl_capture', callId: 'c2' });
  r.event({ type: 'tool-result', name: 'mcp__mdlxl__mdlxl_capture', callId: 'c2', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'xyz9' } }] });
  assert.deepEqual(chat.transcript.at(-1).parts[0].thumbs, ['data:image/jpeg;base64,small-9']);
  const plain = conversation(), emitted = [], q = recorder(plain, undefined, emitted);
  q.event({ type: 'tool', name: 'mdlxl_capture', callId: 'c3' });
  q.event({ type: 'tool-result', name: 'mdlxl_capture', callId: 'c3', content: [picture(3)] });
  assert.equal(plain.transcript.at(-1).parts[0].thumbs, undefined);
  assert.equal('content' in emitted.at(-1), false);
});

test('W1: thumbnails are small: downscaled, a few per step, and only the newest kept per chat', () => {
  assert.deepEqual(chatState.thumbnailSize(768, 576), { width: chatState.THUMB_SIZE, height: 288 });
  assert.deepEqual(chatState.thumbnailSize(576, 768), { width: 288, height: chatState.THUMB_SIZE });
  assert.deepEqual(chatState.thumbnailSize(100, 50), { width: 100, height: 50 });
  assert.ok(chatState.THUMB_SIZE <= 400);
  const chat = conversation(), r = recorder(chat, fakeShrink);
  r.event({ type: 'tool', name: 'mdlxl_capture', callId: 'many' });
  r.event({ type: 'tool-result', name: 'mdlxl_capture', callId: 'many', content: Array.from({ length: 12 }, (_, i) => picture(i % 10)) });
  assert.equal(chat.transcript.at(-1).parts[0].thumbs.length, chatState.THUMBS_PER_STEP);
  for (let i = 0; i < 40; i++) {
    r.event({ type: 'tool', name: 'mdlxl_capture', callId: 'k' + i });
    r.event({ type: 'tool-result', name: 'mdlxl_capture', callId: 'k' + i, content: [picture(1), picture(2), picture(3), picture(4)] });
  }
  const parts = chat.transcript.flatMap(m => m.parts || []).filter(p => p.type === 'tool');
  const total = parts.reduce((n, p) => n + (p.thumbs?.length || 0), 0);
  assert.equal(total, chatState.THUMBS_PER_CHAT);
  // The newest steps keep theirs; the oldest lost them.
  assert.equal(parts.at(-1).thumbs.length, 4);
  assert.equal(parts[0].thumbs, undefined);
});

// A small editor with two tabs (as ai-background.test.js), recording what View AI work does to the screen.
function editor() {
  const tab = name => {
    const doc = createStarterDocument();
    doc.name = name;
    doc.apply('Animations', ['Sequences'], m => {
      m.Sequences = [{ Name: 'Stand', Interval: new Uint32Array([0, 1000]), MoveSpeed: 0, NonLooping: false, Rarity: 0 },
        { Name: 'Attack', Interval: new Uint32Array([2000, 3000]), MoveSpeed: 0, NonLooping: false, Rarity: 0 }];
    });
    return { id: name, doc, path: name, assets: new Map(), uvPreviews: {}, animationDrafts: {},
      viewState: { mode: 'animation', selectable: new Set([0]), visibleOnly: new Set(), selection: { 0: [0, 1] }, hidden: {}, activeGeoset: 0, uvSet: 0, selectedNodeIds: [], sequence: 0, time: 0 } };
  };
  const a = tab('A.mdx'), b = tab('B.mdx');
  const app = { sessions: [a, b], active: a, shown: [], views: [], fits: [], opened: [], drafts: 0 };
  const host = {
    state: () => {
      const s = app.active, v = s.viewState;
      return { session: s, sessions: app.sessions, doc: s.doc, model: s.doc.model, selection: v.selection, selectedNodeIds: v.selectedNodeIds,
        selectable: v.selectable, activeGeoset: v.activeGeoset, uvSet: v.uvSet, mode: v.mode, animationPanel: 'movement', sequence: v.sequence,
        globalSeqId: null, time: v.time, view: 'perspective', workplane: 'xy', keyframes: null, renderMode: 'textured', hidden: {},
        hiddenGeosets: new Set(), playing: false, saving: false, dialog: null, uvEditing: false };
    },
    sessions: () => app.sessions,
    summary: () => ({ documentId: app.active.id }),
    commands: () => [],
    edit: (label, sections, operation, options) => app.active.doc.apply(label, sections, operation, options),
    select: value => selectTab(app.active, value),
    view: async value => {
      app.views.push(value);
      const v = app.active.viewState;
      if (value.sequence !== undefined) v.sequence = value.sequence;
      if (value.frame !== undefined) v.time = value.frame;
    },
    afterPaint: async () => {},
    followFit: points => app.fits.push(points),
    showTab: id => { app.shown.push(id); app.active = app.sessions.find(x => x.id === id); },
    makeAiDraft: () => { app.drafts++; return { id: 'draft', doc: createStarterDocument(), assets: new Map(), viewState: {} }; },
    openAiDraft: draft => app.opened.push(draft.id),
    dropAiDraft: () => {},
    capture: async () => 'data:image/png;base64,live',
    restoreContext: async () => {},
    sessionOf: id => app.sessions.find(x => x.id === id),
    editIn: (id, ...change) => editTab(host.sessionOf(id), ...change),
    undoIn: (id, redo) => undoTab(host.sessionOf(id), redo),
    selectIn: (id, value) => selectTab(host.sessionOf(id), value),
    assetsIn: () => [],
    addAssetsIn: async () => {},
    render: async () => 'data:image/png;base64,offscreen',
  };
  const bridge = new AiEditorBridge(() => host);
  return { a, b, app, bridge };
}
const frames = (n = 4) => new Promise(resolve => setTimeout(resolve, 8 * n + 20));
const move = (target, value) => ({ target, label: 'AI move', scope: ['/Geosets/0/Vertices'], operations: [{ op: 'set', path: '/Geosets/0/Vertices/0', value }] });

test('W2: what each tool call looked at becomes the view, animation, frame and part to follow', () => {
  assert.deepEqual(watch.watchLook('mdlxl_capture', { samples: [{ view: 'left' }, { view: 'front', sequence: 1, frame: 2500, geosets: [2] }, { uv: true }] }),
    { view: 'front', sequence: 1, globalSequence: null, frame: 2500, focus: { geosets: [2] } });
  assert.deepEqual(watch.watchLook('mdlxl_capture', { samples: [{ globalSequence: 0, frame: 40, vertices: { 1: [3] } }] }),
    { globalSequence: 0, frame: 40, focus: { vertices: { 1: [3] } } });
  assert.deepEqual(watch.watchLook('mdlxl_capture', { samples: [{ fit: 'selection' }] }), { focus: { selection: true } });
  assert.equal(watch.watchLook('mdlxl_capture', { samples: [{ uv: true }] }), null);
  assert.equal(watch.watchLook('mdlxl_capture', {}), null, 'a plain capture is the live view already');
  assert.deepEqual(watch.watchLook('mdlxl_sample', { sequence: 1, frames: [2100, 2400] }), { sequence: 1, globalSequence: null, frame: 2400 });
  assert.equal(watch.watchLook('mdlxl_sample', { sweep: { kind: 'level' } }), null);
  assert.deepEqual(watch.watchLook('mdlxl_patch', {}, { applied: true, changes: [{ path: '/Geosets/3/Vertices', kind: 'bytes' }, { path: '/Geosets', kind: 'splice', index: 5, added: 2 }, { path: '/Bones/0' }] }),
    { focus: { geosets: [3, 5, 6] } });
  assert.equal(watch.watchLook('mdlxl_script', {}, { applied: false, changes: [] }), null);
  assert.equal(watch.watchLook('mdlxl_read', {}), null);
  assert.equal(watch.spreadVertices({ 0: Array.from({ length: 1000 }, (_, i) => i) }, 100)[0].length, 100);
});

test('W2: following is coalesced: at most one move per display frame, the newest request wins', async () => {
  const queued = [], applied = [];
  const follower = watch.createWatchFollower(request => applied.push(request), { request: callback => (queued.push(callback), callback), cancel: callback => queued.splice(queued.indexOf(callback), 1) });
  follower.push('a'); follower.push('b'); follower.push('c');
  assert.equal(queued.length, 1, 'one frame requested for three pushes');
  assert.deepEqual(applied, []);
  await queued.shift()();
  assert.deepEqual(applied, ['c']);
  follower.push('d');
  await queued.shift()();
  assert.deepEqual(applied, ['c', 'd']);
  follower.push('e'); follower.cancel();
  follower.push('f');
  assert.equal(queued.length, 1);
  await queued.shift()();
  assert.deepEqual(applied, ['c', 'd', 'f'], 'cancel drops the pending move');
});

test('W2: a part needs a fit only when most of it is off screen; tabs show once per target change', () => {
  const project = ([x, y, z]) => [x, y, z];
  assert.equal(watch.needsFit([0, 0, 0, 0.5, 0.5, 0, 0.9, -0.9, 0], project), false);
  assert.equal(watch.needsFit([0, 0, 0, 3, 0, 0, 0, 4, 0], project), true);
  assert.equal(watch.needsFit([], project), false);
  const state = { shown: null };
  assert.equal(watch.tabToShow(state, 'B', 'A', true), 'B');
  assert.equal(watch.tabToShow(state, 'B', 'A', true), null, 'the user switched away on purpose: not pulled back');
  assert.equal(watch.tabToShow(state, 'C', 'A', false), null, 'a private copy has no tab');
  assert.equal(watch.tabToShow(state, 'A', 'A', true), null);
  assert.equal(watch.watchTargetRule({ watching: false, onScreen: true, selectionChanged: true }), 'fork');
  assert.equal(watch.watchTargetRule({ watching: true, onScreen: true, selectionChanged: true }), 'adopt');
  assert.equal(watch.watchTargetRule({ watching: true, onScreen: true, sourceChanged: true }), 'fork');
  assert.equal(watch.watchTargetRule({ watching: true, onScreen: false, selectionChanged: true }), 'keep');
});

test('W2 on: the live editor shows the AI tab and follows its frame and view; selection changes do not fork', async () => {
  const { a, b, app, bridge } = editor();
  bridge.setWatching(true);
  const { target } = bridge.startEmbeddedJob();
  // The user looks at another tab: the AI's next step brings its tab back once.
  app.active = b;
  await bridge.call('mdlxl_context', { target });
  assert.deepEqual(app.shown, ['A.mdx']);
  app.active = b;
  await bridge.call('mdlxl_context', { target });
  assert.deepEqual(app.shown, ['A.mdx'], 'not pulled back while the AI keeps the same target');
  app.active = a;
  await bridge.call('mdlxl_capture', { target, samples: [{ view: 'front', sequence: 1, frame: 2500 }] });
  await bridge.call('mdlxl_capture', { target, samples: [{ view: 'left', sequence: 1, frame: 2600 }] });
  await frames();
  assert.deepEqual(app.views.at(-1), { view: 'left', sequence: 1, globalSequence: null, frame: 2600 });
  assert.ok(app.views.length <= 2);
  // The user picks other vertices while watching: the job stays on the live model.
  a.viewState.selection = { 0: [4] };
  const edit = await bridge.call('mdlxl_patch', move(target, 33));
  assert.equal(edit.applied, true);
  assert.equal(app.drafts, 0, 'no private copy for a selection-only change');
  assert.equal(a.doc.model.Geosets[0].Vertices[0], 33, 'the edit landed live');
  await frames();
  // A real edit by the user still forks, and the copy is offered at once.
  a.doc.apply('Owner edit', ['Geosets'], m => { m.Geosets[0].Vertices[3] += 1; });
  await bridge.call('mdlxl_context', { target });
  assert.equal(app.drafts, 1);
  assert.ok(bridge.forkedDraft('A.mdx'));
  assert.equal(bridge.openForkedDraft('A.mdx'), true);
  assert.deepEqual(app.opened, ['draft']);
  assert.equal(bridge.forkedDraft('A.mdx'), null);
});

test('W2 on: an edit asks the editor to keep the changed part in view', async () => {
  const { app, bridge } = editor();
  bridge.setWatching(true);
  const { target } = bridge.startEmbeddedJob();
  await bridge.call('mdlxl_patch', move(target, 44));
  await frames();
  assert.equal(app.fits.length, 1);
  assert.ok(app.fits[0].posed.length >= 3 && app.fits[0].rest.length >= 3);
  assert.equal(app.fits[0].rest[0], 44, 'rest-pose points of the edited geoset');
});

test('W2 off: nothing changes: no tab switch, no follow, a selection change forks as before', async () => {
  const { a, b, app, bridge } = editor();
  const { target } = bridge.startEmbeddedJob();
  app.active = b;
  await bridge.call('mdlxl_capture', { target, samples: [{ view: 'front', frame: 10 }] });
  app.active = a;
  await bridge.call('mdlxl_capture', { target, samples: [{ view: 'front', frame: 10 }] });
  await bridge.call('mdlxl_patch', move(target, 55));
  await frames();
  assert.deepEqual([app.shown, app.views, app.fits], [[], [], []]);
  a.viewState.selection = { 0: [5] };
  await bridge.call('mdlxl_context', { target });
  assert.equal(app.drafts, 1, 'the job moved to a private copy, as it always has');
  assert.equal(bridge.forkedDraft('A.mdx'), null, 'no early offer without the switch');
});
