import test from 'node:test';
import helmet from './fixtures/ai-context-helmet.json' with { type: 'json' };
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { tempDir } from './helpers/fixtures.cjs';
const require = createRequire(import.meta.url);
const { AiService } = require('../electron/ai-service.cjs');
const { deleteProviderSessions } = require('../electron/ai-chat-state.cjs');
const root = path.resolve(import.meta.dirname, '..');
const context = { target: 'selected', documentId: 'model', name: 'Footman.mdx', selection: { 0: [1, 2] } };
const modelKey = 'D:/Models/Footman.mdx';

async function setup(t, { reply, models = [] }) {
  const profile = tempDir('mdlxl-ai-chat-');
  t.after(() => fs.rm(profile, { recursive: true, force: true }));
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    if (req.url.endsWith('/models')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({data:models.map(id=>({id}))})); return; }
    const data = JSON.parse(body);
    const system = data.messages[0].content;
    const kind = system.includes('SD Brain art director') ? 'art' : 'direct';
    let images = 0;
    const inputTokens = Math.ceil(JSON.stringify({ messages: data.messages, tools: data.tools }, (key, value) => {
      if (value?.type === 'image_url') { images++; return { type: 'image_url' }; }
      return value;
    }).length / 4);
    requests.push({ kind, data, inputTokens, images });
    const answer =
      kind === 'art'
        ? { delta: { content: 'Goal: a test brief.' }, finish_reason: 'stop' }
        : await reply(data, requests.filter(r => r.kind === kind).length);
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end('data: ' + JSON.stringify({ choices: [answer], usage: { prompt_tokens: inputTokens, completion_tokens: Math.ceil(JSON.stringify(answer.delta).length / 4) } }) + '\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => (server.closeAllConnections(), server.close(resolve))));
  const events = [];
  const service = new AiService({ root, profile, electron: {}, getWindow: () => null, sdBrainAvailable: true });
  service.emit = event => events.push(event);
  service.call = async (name, args) => {
    if (name === 'mdlxl_checkpoint') return { fingerprint: 'f', context, review: { changed: false, phase: 'unchanged' } };
    if (name === 'mdlxl_review') return { changed: false, phase: 'unchanged' };
    throw Error('Unexpected tool ' + name);
  };
  await service.configure({ provider: 'compatible', model: 'test', baseUrl: `http://127.0.0.1:${server.address().port}/v1` });
  return { service, events, requests, profile };
}
const say = text => ({ delta: { content: text }, finish_reason: 'stop' });
const jobTool = (name,args) => ({delta:{tool_calls:[{index:0,id:'call',function:{name,arguments:JSON.stringify(args)}}]},finish_reason:'tool_calls'});
const userText = data => data.messages.filter(m => m.role === 'user').map(m => (typeof m.content === 'string' ? m.content : m.content[0].text)).at(-1);

const bigContext = (selection, frame) => ({
  ...context, revision: 7, frame, sequence: 2, mode: 'vertex', counts: { geosets: 12, vertices: 4000, triangles: 6000, nodes: 120 },
  geosets: Array.from({ length: 12 }, (_, index) => ({ index, vertices: 330, triangles: 500, material: index % 4 })),
  nodes: Array.from({ length: 120 }, (_, id) => ({ id, name: 'Bone_Node_' + id, parent: id - 1 })),
  sequences: Array.from({ length: 20 }, (_, i) => ({ Name: 'Stand ' + i, Interval: [i * 1000, i * 1000 + 999], MoveSpeed: 0, NonLooping: false, Rarity: 0, MinimumExtent: [-50, -50, 0], MaximumExtent: [50, 50, 120], BoundsRadius: 80 })),
  diagnostics: Array.from({ length: 10 }, (_, i) => ({ severity: 'warning', text: 'Diagnostic message number ' + i + ' about this model' })),
  commands: Array.from({ length: 100 }, (_, i) => ({ id: 'command-' + i, label: 'Editor command ' + i, enabled: true })),
  selection,
});

test('save cleanup keeps everything, keeps a memory note, or wipes every chat for the model', async t => {
  let memory = false;
  const f = await setup(t, {
    reply: data => !data.tools ? ((memory = true), say('Memory: garment separated into geoset 26; keep spikes off the inside.')) : say('done'),
  });
  const first = await f.service.organiser({ modelKey, name: 'Footman.mdx' });
  await f.service.send({ id: first.id, text: 'separate the garment', context });
  assert.deepEqual(await f.service.saveState({ modelKey }), { activity: true, remember: 'ask', important: false });
  assert.deepEqual(await f.service.cleanup({ modelKey, mode: 'keep' }), { mode: 'keep' });
  assert.equal((await f.service.saveState({ modelKey })).activity, false);
  assert.equal((await f.service.organiser({ modelKey })).id, first.id);

  const codexFile = path.join(f.profile, 'ai', 'codex', 'sessions', 'rollout-x-thread-1234567890.jsonl');
  await fs.mkdir(path.dirname(codexFile), { recursive: true });
  await fs.writeFile(codexFile, '{}');
  (await f.service.conversation(first.id, 'compatible')).threadId = 'thread-1234567890';
  const summary = await f.service.cleanup({ modelKey, mode: 'summary', remember: true });
  assert.equal(memory, true);
  assert.match(summary.note, /keep spikes off the inside/);
  assert.equal(summary.removedChats, 1);
  assert.equal(summary.providerFiles, 1);
  await assert.rejects(fs.stat(codexFile));
  await assert.rejects(fs.stat(path.join(f.profile, 'ai', 'chat-' + first.id + '.json')));
  assert.equal((await f.service.saveState({ modelKey })).remember, 'summary');
  // The next organiser for this model starts with the memory note.
  const second = await f.service.organiser({ modelKey });
  assert.notEqual(second.id, first.id);
  assert.equal(second.hasNote, true);
  await f.service.send({ id: second.id, text: 'next job', context });
  assert.match(userText(f.requests.filter(r => r.kind === 'direct').at(-1).data), /Memory note from earlier work on this model:\nMemory: garment separated/);

  const wiped = await f.service.cleanup({ modelKey, mode: 'wipe' });
  assert.equal(wiped.note, null);
  assert.equal((await f.service.organiser({ modelKey })).hasNote, false);
});

test('automatic cleanup removes models unused for the set days, keeps important ones and leftover files of current chats', async t => {
  const f = await setup(t, { reply: () => say('done') });
  assert.equal((await f.service.status()).cleanupDays, 3);
  const ai = path.join(f.profile, 'ai'),
    day = 24 * 60 * 60 * 1000,
    later = Date.now() + 4 * day;
  const moved = await f.service.organiser({ modelKey: 'D:/Old/Moved.mdx', name: 'Moved.mdx' });
  const kept = await f.service.organiser({ modelKey, name: 'Footman.mdx' });
  const recent = await f.service.organiser({ modelKey: 'D:/Models/Grunt.mdx', name: 'Grunt.mdx' });
  assert.deepEqual(await f.service.setImportant({ modelKey, important: true }), { important: true });
  assert.equal((await f.service.saveState({ modelKey })).important, true);
  (await f.service.conversation(moved.id, 'compatible')).threadId = 'thread-moved-123456';
  (await f.service.conversation(kept.id, 'compatible')).threadId = 'thread-kept-1234567';
  await f.service.persistConversation(await f.service.conversation(moved.id, 'compatible'));
  await f.service.persistConversation(await f.service.conversation(kept.id, 'compatible'));
  f.service.conversations.clear();
  const old = new Date(Date.now() - day);
  const write = async (file, text = '{}') => (await fs.mkdir(path.dirname(file), { recursive: true }), await fs.writeFile(file, text), file);
  const files = {
    movedLog: await write(path.join(ai, 'codex', 'sessions', '2026', 'rollout-thread-moved-123456.jsonl')),
    keptLog: await write(path.join(ai, 'codex', 'sessions', '2026', 'rollout-thread-kept-1234567.jsonl')),
    orphan: await write(path.join(ai, 'chat-orphan.json')),
    temp: await write(path.join(ai, 'temp', 'shot.png')),
    run: await write(path.join(ai, 'claude-run-abc', 'mcp.json')),
    auth: await write(path.join(ai, 'codex', 'auth.json')),
  };
  for (const file of [...Object.values(files), path.join(ai, 'claude-run-abc'), path.join(ai, 'chat-' + moved.id + '.json'), path.join(ai, 'chat-' + kept.id + '.json')])
    await fs.utimes(file, old, old);
  // Grunt was used within the last three days.
  (await f.service.registry.model('D:/Models/Grunt.mdx')).used = later - day;
  for (const key of ['D:/Old/Moved.mdx', modelKey]) (await f.service.registry.model(key)).used = old.getTime();

  const result = await f.service.cleanupUnused(later);
  assert.equal(result.models, 1);
  const data = await f.service.registry.load();
  assert.deepEqual(Object.keys(data.models).sort(), ['D:/Models/Footman.mdx', 'D:/Models/Grunt.mdx']);
  await assert.rejects(fs.stat(path.join(ai, 'chat-' + moved.id + '.json')));
  for (const gone of [files.movedLog, files.orphan, files.temp, path.join(ai, 'claude-run-abc')]) await assert.rejects(fs.stat(gone), gone);
  for (const stays of [files.keptLog, files.auth, path.join(ai, 'chat-' + kept.id + '.json'), path.join(ai, 'chat-' + recent.id + '.json'), path.join(ai, 'connections.json')])
    await fs.stat(stays);
  assert.ok(f.events.some(event => event.type === 'organiser-reset' && event.modelKey === 'D:/Old/Moved.mdx'));

  // Empty days means never; the setting is kept.
  await f.service.configure({ provider: 'compatible', model: 'test', baseUrl: (await f.service.status()).baseUrl, cleanupDays: '' });
  assert.equal((await f.service.status()).cleanupDays, 0);
  await f.service.setImportant({ modelKey, important: false });
  assert.deepEqual(await f.service.cleanupUnused(later + 100 * day), { models: 0, files: 0 });
  await assert.rejects(() => f.service.configure({ provider: 'compatible', cleanupDays: '1.5' }), /number of days/);
});

test('only provider files named after the cleared threads are deleted', async t => {
  const directory = tempDir('mdlxl-ai-clean-');
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.mkdir(path.join(directory, 'claude', 'projects', 'x'), { recursive: true });
  await fs.writeFile(path.join(directory, 'claude', 'projects', 'x', 'aaaa-bbbb-1111.jsonl'), '');
  await fs.writeFile(path.join(directory, 'claude', 'projects', 'x', 'cccc-dddd-2222.jsonl'), '');
  assert.equal(await deleteProviderSessions(directory, ['aaaa-bbbb-1111', '..', '*']), 1);
  assert.deepEqual(await fs.readdir(path.join(directory, 'claude', 'projects', 'x')), ['cccc-dddd-2222.jsonl']);
});

test('a chat saved while a bird was working comes back settled after a restart', async t => {
  const f = await setup(t, { reply: () => say('y') });
  const { id } = await f.service.organiser({ modelKey });
  const organiser = await f.service.conversation(id, 'compatible');
  organiser.workers = [{ id: id + '-raven', name: 'Raven', job: 'Sword', status: 'working', use: 0.1 }];
  organiser.transcript.push(
    { role: 'user', text: 'make a sword' },
    { role: 'assistant', text: '', parts: [{ type: 'worker', workerId: id + '-raven', name: 'Raven', job: 'Sword', status: 'working' }, { type: 'tool', name: 'mdlxl_worker', status: 'running' }] },
  );
  await f.service.persistConversation(organiser);
  // A fresh service is what the app has after a restart.
  const { AiService: Fresh } = require('../electron/ai-service.cjs');
  const restarted = new Fresh({ root, profile: f.profile, electron: {}, getWindow: () => null });
  const reopened = await restarted.organiser({ modelKey });
  assert.equal('workers' in reopened, false);
  assert.equal((await restarted.readConversation(id)).workers[0].status, 'idle');
  const parts = (await restarted.readConversation(id)).transcript[1].parts;
  assert.deepEqual(parts.map(p => p.status), ['stopped', 'stopped']);
});

test('removeFiles deletes what it is asked to, six folders deep at most', async t => {
  const { removeFiles } = require('../electron/ai-chat-state.cjs');
  const directory = tempDir('mdlxl-ai-remove-');
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const deep = n => path.join(directory, ...Array.from({ length: n }, (_, i) => 'd' + i));
  await fs.mkdir(deep(7), { recursive: true });
  for (const n of [0, 6, 7]) for (const name of ['old.log', 'keep.txt']) await fs.writeFile(path.join(deep(n), name), '');
  const asked = [];
  assert.equal(await removeFiles(directory, async (name, full) => (asked.push(full), name.endsWith('.log'))), 2);
  assert.equal(asked.length, 4);
  assert.deepEqual(await fs.readdir(deep(6)), ['d6', 'keep.txt']);
  assert.deepEqual((await fs.readdir(deep(7))).sort(), ['keep.txt', 'old.log']);
  assert.equal(await removeFiles(path.join(directory, 'missing'), () => true), 0);
});

test('connection settings are saved whole through a temporary file, in the order changed', async t => {
  const profile = tempDir('mdlxl-ai-connections-');
  t.after(() => fs.rm(profile, { recursive: true, force: true }));
  const service = new AiService({ root, profile, electron: {}, getWindow: () => null });
  t.after(() => service.close());
  await Promise.all([service.setWebResearch(true), service.setEditingHandbook(true), service.setAwareness(true)]);
  const saved = JSON.parse(await fs.readFile(path.join(service.directory, 'connections.json'), 'utf8'));
  assert.deepEqual([saved.awareness, saved.webResearch, saved.editingHandbook], [true, true, true]);
  assert.deepEqual((await fs.readdir(service.directory)).filter(name => name.endsWith('.tmp')), []);
});


test('context diet: words lead, unchanged drawings stay out of follow-ups, replacement and compaction reset once', async t => {
  const f = await setup(t, { reply: () => say('Done.') });
  const { id } = await f.service.organiser({ modelKey });
  const ctx = { ...bigContext({ 0: [1, 2] }, 0), annotations: { strokes: Array.from({ length: 120 }, (_, i) => ({ points: [i, i+1, i+2] })), markedVertices: { 0: [1, 2] } }, view: 'front' };
  await f.service.send({ id, text: 'Read geoset 1 and Bone_Node_119', context: ctx });
  await f.service.send({ id, text: 'Keep its shape and textures', context: { ...ctx, target: 'follow-up', view: 'left' } });
  const prompts = f.requests.map(r => userText(r.data));
  assert.ok(prompts[0].startsWith('Read geoset 1 and Bone_Node_119\n\n'));
  assert.ok(prompts[0].includes('Bone_Node_119') && prompts[0].includes('"selection":{"0":[1,2]}'));
  assert.ok(prompts[1].startsWith('Keep its shape and textures\n\n'));
  const delta=JSON.parse(prompts[1].split('\n').at(-1));
  assert.deepEqual(delta, { target: 'follow-up', view: 'left' });
  const chat=await f.service.conversation(id,'compatible');
  f.service.measureUsage(chat, f.service.recorder(chat, () => {}), 'direct')({type:'compaction',active:false});
  await f.service.send({id,text:'After compaction',context:ctx});
  assert.match(userText(f.requests.at(-1).data), /context captured when this prompt was sent/);
  await f.service.send({id,text:'Still the same model',context:ctx});
  assert.equal(JSON.parse(userText(f.requests.at(-1).data).split('\n').at(-1)).nodes, undefined);
  await f.service.send({id,text:'A replacement model',context:{...ctx,documentId:'replacement'}});
  assert.ok(userText(f.requests.at(-1).data).includes('Bone_Node_119'));
});

test('context diet: replay the three recorded helmet messages and measure the actual follow-up reduction', async t => {
  const f = await setup(t, { reply: () => say('Done.') });
  const {id}=await f.service.organiser({modelKey});
  const sent=[];
  for(const row of helmet.records) {
    (await f.service.registry.model(modelKey)).diary=structuredClone(row.jobs);
    await f.service.send({id,text:row.request,context:{...helmet.context,...row.context}});
    const message=userText(f.requests.at(-1).data);
    assert.ok(message.startsWith(row.request+'\n\n'));
    sent.push(Buffer.byteLength(message));
  }
  const recorded=helmet.records.map(r=>r.recordedBytes), before=helmet.records.map(r=>r.beforeContextDietBytes);
  t.diagnostic(JSON.stringify({recordedBytes:recorded,firstPrBytes:before,dietBytes:sent,followupReductionPercent:Math.round(100*(1-(sent[1]+sent[2])/(before[1]+before[2]))),recordedReductionPercent:Math.round(100*(1-(sent[1]+sent[2])/(recorded[1]+recorded[2])))}));
  assert.ok(sent[1]+sent[2] < (recorded[1]+recorded[2])/5);
  assert.ok(sent[1]+sent[2] < (before[1]+before[2])/2, 'large improvement over the first PR, not only the older recorded payload');
});


test('context diet: an on-demand context read becomes the diff baseline and fresh history starts full again',async t=>{
  let f,asked=false;
  const ctx={...bigContext({0:[3]},0),selectedNodeIds:[119]};
  f=await setup(t,{reply:()=>{
    if(!asked){asked=true;return jobTool('mdlxl_context',{target:ctx.target});}
    return say('Read the exact parts.');
  }});
  const original=f.service.call;
  f.service.call=(name,args,...rest)=>name==='mdlxl_context'?Promise.resolve({...ctx,view:'right',geosets:[{index:0,vertices:9,triangles:8}],nodes:[{id:119,name:'Selected bone',parent:42}]}):original(name,args,...rest);
  const {id}=await f.service.organiser({modelKey});
  await f.service.send({id,text:'Read the selected part and bone 119',context:ctx});
  const current={...ctx,view:'right',geosets:[{index:0,vertices:9,triangles:8}],nodes:[{id:119,name:'Selected bone',parent:42}]};
  await f.service.send({id,text:'Use those same part and bone ids',context:current});
  assert.deepEqual(JSON.parse(userText(f.requests.at(-1).data).split('\n').at(-1)),{target:ctx.target});
  const chat=await f.service.conversation(id,'compatible');
  chat.messages=[];
  await f.service.send({id,text:'After a provider-history reset',context:current});
  const restored=userText(f.requests.at(-1).data);
  assert.match(restored,/context captured when this prompt was sent/);
  assert.match(restored,/"selectedNodeIds":\[119\]/);
  assert.match(restored,/"parent":42/);
});
