import { EditorDocument } from '../src/editor-document.js';
import { prepareModelSave } from '../src/save-target.js';
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

// ---- Stream H: harness robustness and cost ----
const { buildAiScript, cloneSafeAiValue, limitAiOutput, newSaveProblems, encodeAiValue } = await import('../src/ai-model.js');
const nodeRequire = (await import('node:module')).createRequire(import.meta.url);
const { createWorkspace } = nodeRequire('../electron/ai-workspace.cjs');
const http = (await import('node:http')).default;
const { runApi, anthropicCost, trimOldContext } = nodeRequire('../electron/ai-providers.cjs');
const { AI_TOOLS } = await import('../src/ai-tools.js');
const run = (code, extra = {}) => buildAiScript(code)({}, {}, {}, {}, {}, [], extra.before, {}, extra.log || (() => {}), {});

test('H1: scripts may declare before, log and parameters themselves; parameters is always defined', async () => {
  assert.equal(await run('const before = 1; const log = 2; const parameters = 3; return before + log + parameters;'), 6);
  assert.deepEqual(await run('return parameters;'), {});
  assert.equal(await run('return typeof before;', { before: { a: 1 } }), 'object');
});
test('H1: values that cannot be cloned come back as readable text', () => {
  const cycle = { name: 'loop' };
  cycle.self = cycle;
  const detached = new Float32Array(4);
  structuredClone(detached.buffer, { transfer: [detached.buffer] });
  const { value, replaced } = cloneSafeAiValue({ f: () => 1, cycle, detached, map: new Map([['a', 1]]), ok: [1, 2] });
  assert.doesNotThrow(() => structuredClone(value));
  assert.match(value.f, /function/);
  assert.match(value.cycle.self, /circular/);
  assert.match(value.detached, /detached/);
  assert.deepEqual(value.map, { a: 1 });
  assert.deepEqual(value.ok, [1, 2]);
  assert.ok(replaced.length >= 3);
  assert.deepEqual(cloneSafeAiValue({ fine: 1 }), { value: { fine: 1 }, replaced: [] });
});
test('H5: huge typed arrays and long lists are summarised with a pointer to mdlxl_read', () => {
  const big = new Float32Array(300000).map((_, i) => i % 100);
  const out = limitAiOutput(encodeAiValue({ v: big, small: new Uint8Array([1, 2, 3]), words: 'x'.repeat(200000) }));
  assert.equal(out.v.length, 300000);
  assert.equal(out.v.max, 99);
  assert.equal(out.v.first.length, 6);
  assert.match(out.v.note, /mdlxl_read/);
  assert.deepEqual(out.small.$data, [1, 2, 3]);
  assert.ok(JSON.stringify(out).length < 61000);
});
test('H3: only save problems an edit introduced count', () => {
  const old = 'Save verification failed: serialization changed 2 fields: GeosetAnims[3]._MdxDefaults.Color, GeosetAnims[4]._MdxDefaults.Color.';
  assert.deepEqual(newSaveProblems([old], [old]), []);
  const worse = 'Save verification failed: serialization changed 3 fields: GeosetAnims[3]._MdxDefaults.Color, GeosetAnims[4]._MdxDefaults.Color, Geosets[0].Faces.';
  assert.deepEqual(newSaveProblems([old], [worse]), ['Geosets[0].Faces']);
  assert.deepEqual(newSaveProblems([], ['Model comments did not reopen.']), ['Model comments did not reopen.']);
});
test('H3: an edit is not refused for save-check differences the model already had', async () => {
  const { a, bridge } = editor();
  const quirk = 'Save verification failed: serialization changed 1 field: GeosetAnims[0]._MdxDefaults.Color.';
  let broken = false;
  a.doc.serialize = function () {
    this.lastSaveWarnings = [quirk, ...(broken ? ['Save verification failed: Geoset 0 UV set count changed during serialization.'] : [])];
    return new Uint8Array(1);
  };
  const { target } = bridge.context();
  const result = await bridge.call('mdlxl_patch', move(target, 5));
  assert.equal(result.applied, true);
  assert.deepEqual(result.savedWithExistingIssues, [quirk]);
  const again = await bridge.call('mdlxl_patch', move(bridge.context().target, 6));
  assert.equal(again.applied, true);
  assert.equal(again.savedWithExistingIssues, undefined, 'reported once');
  broken = true;
  await assert.rejects(bridge.call('mdlxl_patch', move(bridge.context().target, 7)), /UV set count/);
  assert.equal(a.doc.model.Geosets[0].Vertices[0], 6, 'the new problem undid the edit');
});
test('H4: a step that needs the screen ends with a plain message instead of stalling', async () => {
  const { b, bridge, show } = editor();
  const { target } = bridge.context();
  bridge.screenWaitMs = 60;
  show(b);
  await assert.rejects(bridge.call('mdlxl_command', { target, id: 'save' }), /needs the model "A\.mdx" on screen.*Do not ask the user to switch tabs/s);
});
test('H2: preview accepts vertices outside the marked ones; select still does not', async () => {
  const seen = [];
  const workspace = createWorkspace(process.env.TEMP || '.', { target: 't', selection: { 0: [0, 1] }, revision: 3 }, async (name, args) => {
    seen.push([name, args]);
    return { revision: 3, selection: {} };
  });
  const signal = new AbortController().signal;
  await workspace.use({ action: 'write', file: 'map.json', text: JSON.stringify({ 0: [5, 6, 7] }) }, signal);
  await workspace.use({ action: 'preview', file: 'map.json' }, signal);
  assert.equal(seen[0][0], 'mdlxl_capture');
  assert.equal(seen[0][1].expectedRevision, undefined);
  await assert.rejects(workspace.use({ action: 'select', file: 'map.json' }, signal), /subset/);
  await workspace.close();
});

async function providerServer(t, handle) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let text = '';
    for await (const part of req) text += part;
    requests.push(JSON.parse(text || '{}'));
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    handle(requests.at(-1), res, requests.length);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => (server.closeAllConnections(), server.close(resolve))));
  return { url: `http://127.0.0.1:${server.address().port}/v1`, requests };
}
const sse = (res, data) => res.write('data: ' + JSON.stringify(data) + '\n\n');
const baseOptions = (settings, url, extra = {}) => ({
  settings: { baseUrl: url, ...settings },
  key: 'k',
  tools: AI_TOOLS,
  call: () => ({ content: [{ type: 'text', text: 'x'.repeat(5000) }] }),
  prompt: 'go',
  system: 's',
  conversation: { messages: [] },
  signal: new AbortController().signal,
  event: () => {},
  ...extra,
});
test('H6/H7: Claude API clears old tool inputs and has no default round cap', async t => {
  const server = await providerServer(t, (data, res, round) => {
    sse(res, { type: 'message_start', message: { usage: { input_tokens: 10 } } });
    if (round < 80) {
      sse(res, { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 't' + round, name: 'mdlxl_context', input: {} } });
      sse(res, { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 1 } });
    } else {
      sse(res, { type: 'content_block_start', index: 0, content_block: { type: 'text', text: 'Done.' } });
      sse(res, { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } });
    }
    res.end();
  });
  await runApi(baseOptions({ provider: 'anthropic', model: 'claude-fable-5-2' }, server.url));
  assert.equal(server.requests.length, 80);
  const edit = server.requests[0].context_management.edits.find(e => e.type === 'clear_tool_uses_20250919');
  assert.equal(edit.clear_tool_inputs, true);
  const endless = await providerServer(t, (data, res, round) => {
    sse(res, { type: 'message_start', message: { usage: { input_tokens: 10 } } });
    sse(res, { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 't' + round, name: 'mdlxl_context', input: {} } });
    sse(res, { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 1 } });
    res.end();
  });
  await assert.rejects(runApi(baseOptions({ provider: 'anthropic', model: 'claude-fable-5-2', stepLimit: 3 }, endless.url)), /3 tool rounds/);
});
test('H8: Haiku 5.5 is priced on its own prompt size', () => {
  const small = anthropicCost('claude-haiku-5-5', { input: 90000, cacheWrite: 0, cacheRead: 0, output: 1000 });
  const large = anthropicCost('claude-haiku-5-5', { input: 110000, cacheWrite: 0, cacheRead: 0, output: 1000 });
  assert.ok(Math.abs(small - (90000 * 0.1 + 1000 * 0.5) / 1e6) < 1e-9);
  assert.ok(Math.abs(large - (110000 * 0.5 + 1000 * 2.5) / 1e6) < 1e-9);
});
test('H8: Claude API charges each request at its own tier', async t => {
  const server = await providerServer(t, (data, res, round) => {
    sse(res, { type: 'message_start', message: { usage: { input_tokens: round === 1 ? 50000 : 150000 } } });
    sse(res, { type: 'content_block_start', index: 0, content_block: round < 3 ? { type: 'tool_use', id: 't' + round, name: 'mdlxl_context', input: {} } : { type: 'text', text: 'ok' } });
    sse(res, { type: 'message_delta', delta: { stop_reason: round < 3 ? 'tool_use' : 'end_turn' }, usage: { output_tokens: 0 } });
    res.end();
  });
  const events = [];
  await runApi(baseOptions({ provider: 'anthropic', model: 'claude-haiku-5-5' }, server.url, { event: e => events.push(e) }));
  const last = events.filter(e => e.type === 'cost').at(-1).usd;
  assert.ok(Math.abs(last - (50000 * 0.1 + 150000 * 0.5 + 150000 * 0.5) / 1e6) < 1e-9, 'got ' + last);
});
test('H6/H9: OpenAI history is trimmed once large, and reasoning is kept between steps', async t => {
  const server = await providerServer(t, (data, res, round) => {
    if (round === 1) assert.deepEqual(data.include, ['reasoning.encrypted_content']);
    if (round < 9) {
      sse(res, { type: 'response.output_item.done', item: { type: 'reasoning', id: 'rs' + round, summary: [], encrypted_content: 'enc' + round } });
      sse(res, { type: 'response.output_item.done', item: { type: 'function_call', call_id: 'c' + round, name: 'mdlxl_context', arguments: '{}' } });
    }
    sse(res, { type: 'response.completed', response: { usage: { input_tokens: 100000, output_tokens: 1 } } });
    res.end();
  });
  await runApi(baseOptions({ provider: 'openai', model: 'gpt-6-sol' }, server.url));
  const input = server.requests.at(-1).input;
  const reasoning = input.filter(i => i.type === 'reasoning');
  assert.equal(reasoning.length, 8);
  assert.equal(reasoning[0].encrypted_content, 'enc1');
  const outputs = input.filter(i => i.type === 'function_call_output').map(i => i.output);
  assert.equal(outputs.length, 8);
  assert.equal(outputs.filter(o => o.startsWith('[Cleared')).length, 2, 'all but the newest six long results cleared');
});
test('H6: compatible servers are asked for usage; old pictures are cleared', async t => {
  const server = await providerServer(t, (data, res) => {
    sse(res, { choices: [{ delta: { content: 'hi' }, finish_reason: 'stop' }] });
    res.end();
  });
  await runApi(baseOptions({ provider: 'compatible', model: 'm' }, server.url));
  assert.deepEqual(server.requests[0].stream_options, { include_usage: true });
  const image = { type: 'image_url', image_url: { url: 'data:image/png;base64,AA' } };
  const history = [0, 1, 2].map(n => ({ role: 'user', content: [{ type: 'text', text: 'p' + n }, image] }));
  assert.equal(trimOldContext(history), 1);
  assert.match(history[0].content[1].text, /picture cleared/);
  assert.equal(history[2].content[1].type, 'image_url');
});
