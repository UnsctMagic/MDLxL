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
const { nextBird, AiSteering, deleteProviderSessions, BIRDS, CORVIDS, contextUse, RETIRE_AT, HANDOVER_TOKENS } = require('../electron/ai-offload.cjs');
const root = path.resolve(import.meta.dirname, '..');
const context = { target: 'selected', documentId: 'model', name: 'Footman.mdx', selection: { 0: [1, 2] } };
const modelKey = 'D:/Models/Footman.mdx';

// A fake OpenAI-compatible provider: `organiser` answers the organiser's requests,
// `worker` answers every worker request. Both get the request body.
async function setup(t, { organiser, worker, models = [] }) {
  const profile = tempDir('mdlxl-ai-offload-');
  t.after(() => fs.rm(profile, { recursive: true, force: true }));
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    if (req.url.endsWith('/models')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({data:models.map(id=>({id}))})); return; }
    const data = JSON.parse(body);
    const system = data.messages[0].content;
    const kind = system.includes('SD Brain art director') ? 'art' : system.includes('You are the organiser') ? 'organiser' : 'worker';
    let images = 0;
    const inputTokens = Math.ceil(JSON.stringify({ messages: data.messages, tools: data.tools }, (key, value) => {
      if (value?.type === 'image_url') { images++; return { type: 'image_url' }; }
      return value;
    }).length / 4);
    requests.push({ kind, data, inputTokens, images });
    const answer =
      kind === 'art'
        ? { delta: { content: 'Goal: a test brief.' }, finish_reason: 'stop' }
        : await (kind === 'organiser' ? organiser : worker)(data, requests.filter(r => r.kind === kind).length);
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end('data: ' + JSON.stringify({ choices: [answer], usage: { prompt_tokens: inputTokens, completion_tokens: Math.ceil(JSON.stringify(answer.delta).length / 4) } }) + '\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => (server.closeAllConnections(), server.close(resolve))));
  const events = [];
  const service = new AiService({ root, profile, electron: {}, getWindow: () => null, sdBrainAvailable: true });
  service.emit = event => events.push(event);
  // Names are random in use; the first choice keeps tests readable (Crow, then Jackdaw).
  service.random = () => 0;
  service.call = async (name, args) => {
    if (name === 'mdlxl_regions' && args.action === 'summary') return { geosets: [{ path: '/Geosets/0' }] };
    if (name === 'mdlxl_regions' && args.action === 'label') return { labelled: true };
    if (name === 'mdlxl_checkpoint') return { fingerprint: 'f', context, review: { changed: false, phase: 'unchanged' } };
    if (name === 'mdlxl_review') return { changed: false, phase: 'unchanged' };
    throw Error('Unexpected tool ' + name);
  };
  await service.configure({ provider: 'compatible', model: 'test', baseUrl: `http://127.0.0.1:${server.address().port}/v1` });
  return { service, events, requests, profile };
}
const say = text => ({ delta: { content: text }, finish_reason: 'stop' });
const ask = args => ({
  delta: { tool_calls: [{ index: 0, id: 'w' + Math.random(), function: { name: 'mdlxl_worker', arguments: JSON.stringify(args) } }] },
  finish_reason: 'tool_calls',
});
const last = data => data.messages.at(-1);
const userText = data => data.messages.filter(m => m.role === 'user').map(m => (typeof m.content === 'string' ? m.content : m.content[0].text)).at(-1);

test('manual forwarding is verbatim, follow-ups reuse their bird and tiny jobs share one', async t => {
  const f = await setup(t, { organiser: () => { throw Error('No organiser call permitted'); }, worker: () => say('Report: complete.') });
  const { id } = await f.service.organiser({ modelKey });
  const image = 'data:image/png;base64,YQ==';
  await f.service.send({ id, text: 'Cut the red garment.', job: 'Separate red garment', images: [image], context });
  await f.service.send({ id, text: 'make it a bit thicker', context });
  await f.service.send({ id, text: 'rename geoset 25', route: 'tiny', context });
  await f.service.send({ id, text: 'rename the bone too', route: 'tiny', context });
  const org = await f.service.conversation(id, 'compatible');
  assert.deepEqual(org.workers.map(w => [w.name, w.tiny, w.status]), [['Crow', false, 'idle'], ['Jackdaw', true, 'idle']]);
  assert.equal(f.requests.length, 4);
  assert.equal(f.requests.filter(r => r.kind === 'organiser').length, 0);
  assert.equal(userText(f.requests[0].data).split('\n\nMDLxL context')[0].includes('Cut the red garment.'), true);
  assert.ok(!userText(f.requests[0].data).includes('Instructions from the organiser'));
  assert.ok(JSON.stringify(f.requests[1].data.messages).includes('Cut the red garment.'));
  const rows = org.transcript.flatMap(e => e.parts || []).filter(p => p.type === 'worker');
  assert.deepEqual(rows.map(r => r.name), ['Crow', 'Crow', 'Jackdaw', 'Jackdaw']);
  assert.ok(rows.every(r => r.report === 'Report: complete.'));
  assert.equal(org.transcript.filter(e => e.role === 'assistant' && e.text).length, 0, 'no recap');
  assert.equal(org.messages.filter(m => m.role === 'assistant').length, 4, 'reports stored without a call');
  assert.ok(!JSON.stringify(org.messages).includes('image/png'), 'images never enter organiser history');
  assert.equal(org.transcript.at(-1).cost.roles.bird.calls, 1);
  assert.equal((await f.service.organiser({ modelKey })).id, id);
});

test('SD Brain and handbook are inherited by the bird, with one art brief and no organiser call', async t => {
  const f = await setup(t, { organiser: () => { throw Error('No organiser request'); }, worker: () => say('Made the chalice.') });
  await f.service.setSdBrain(true);
  await f.service.setEditingHandbook(true);
  const { id } = await f.service.organiser({ modelKey });
  await f.service.send({ id, text: 'make a chalice of power', context });
  const request = f.requests.find(r => r.kind === 'worker').data;
  assert.match(request.messages[0].content, /Warcraft III SD modeling rulebook/);
  assert.match(userText(request), /SD art brief for this request/);
  assert.equal(f.requests.filter(r => r.kind === 'art').length, 1);
  assert.equal(f.requests.filter(r => r.kind === 'organiser').length, 0);
  await f.service.setSdBrain(false);
  await f.service.send({ id, text: 'now rename it', context });
  assert.match(f.requests.at(-1).data.messages[0].content, /SD Brain: off/);
  assert.ok(!userText(f.requests.at(-1).data).includes('SD art brief'));
});

test('a worker at 200K tokens hands over to a new bird with a note MDLxL writes, and retires', async t => {
  // 200K tokens is the handover point on a 1M window; a 128K window hands over at half.
  assert.ok(contextUse({ usage: { used: 199999, window: 1000000 } }) < RETIRE_AT);
  assert.ok(contextUse({ usage: { used: HANDOVER_TOKENS, window: 1000000 } }) >= RETIRE_AT);
  assert.ok(contextUse({ usage: { used: 63999, window: 128000 } }) < RETIRE_AT);
  assert.ok(contextUse({ usage: { used: 64000, window: 128000 } }) >= RETIRE_AT);
  const f = await setup(t, {
    organiser: () => assert.fail('No organiser call'),
    worker: data => (data.tools ? say('Collar report: collars done on geoset 4; user wants no spike inside.') : assert.fail('No tools-off handover turn')),
  });
  const { id } = await f.service.organiser({ modelKey });
  await f.service.send({ id, text: 'make collars', context });
  const organiser = await f.service.conversation(id, 'compatible');
  const crow = await f.service.conversation(organiser.workers[0].id, 'compatible');
  crow.usage = { used: 199000, window: 1000000 };
  organiser.workers[0].use = contextUse(crow);
  await f.service.send({ id, text: 'now spikes on Crow', worker: 'Crow', context });
  assert.equal(organiser.workers[0].status, 'idle', 'below 200K the bird keeps working');
  crow.usage = { used: 200000, window: 1000000 };
  organiser.workers[0].use = contextUse(crow);
  const before = f.requests.length;
  await f.service.send({ id, text: 'now spikes on Crow', worker: 'Crow', context });
  assert.deepEqual(
    organiser.workers.map(w => [w.name, w.status]),
    [
      ['Crow', 'retired'],
      ['Jackdaw', 'idle'],
    ],
  );
  // The handover makes no request of its own; the new bird starts from the note.
  assert.equal(f.requests.length - before, 1, 'handover adds no request');
  const note = userText(f.requests.at(-1).data);
  assert.match(note, /Handover note from Crow, who worked on this before you:\nIts memory reached the handover size/);
  assert.match(note, /Its last report:\nCollar report: collars done on geoset 4/);
  assert.match(note, /Saved task state: \{/);
  assert.equal((await f.service.readConversation(organiser.workers[0].id)).retired, true);
  await assert.rejects(() => f.service.send({ id: organiser.workers[0].id, text: 'hi', context }), /The Crow is retired/);
});

test('save cleanup keeps everything, keeps a memory note, or wipes every chat for the model', async t => {
  let memory = false;
  const f = await setup(t, {
    organiser: data =>
      !data.tools ? ((memory = true), say('Memory: garment separated into geoset 26; keep spikes off the inside.')) : last(data).role === 'tool' ? say('ok') : ask({ job: 'Garment', instructions: 'Separate it.' }),
    worker: () => say('done'),
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
  assert.equal(summary.removedChats, 2);
  assert.equal(summary.providerFiles, 1);
  await assert.rejects(fs.stat(codexFile));
  await assert.rejects(fs.stat(path.join(f.profile, 'ai', 'chat-' + first.id + '.json')));
  assert.equal((await f.service.saveState({ modelKey })).remember, 'summary');
  // The next organiser for this model starts with the memory note.
  const second = await f.service.organiser({ modelKey });
  assert.notEqual(second.id, first.id);
  assert.equal(second.hasNote, true);
  await f.service.send({ id: second.id, text: 'next job', context });
  assert.match(userText(f.requests.filter(r => r.kind === 'worker').at(-1).data), /Memory note from earlier work on this model:\nMemory: garment separated/);

  const wiped = await f.service.cleanup({ modelKey, mode: 'wipe' });
  assert.equal(wiped.note, null);
  assert.equal((await f.service.organiser({ modelKey })).hasNote, false);
});

test('automatic cleanup removes models unused for the set days, keeps important ones and leftover files of current chats', async t => {
  const f = await setup(t, { organiser: () => say('x'), worker: () => say('done') });
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

test('Offload Mode off gives the model chat the normal tools; saving a new file moves its organiser', async t => {
  const f = await setup(t, { organiser: () => say('x'), worker: () => say('plain answer') });
  assert.equal((await f.service.status()).offload, true);
  await f.service.setOffload(false);
  const { id, offload } = await f.service.organiser({ modelKey: 'unsaved:abc', name: 'Untitled' });
  assert.equal(offload, false);
  await f.service.send({ id, text: 'hello', context });
  const request = f.requests.at(-1).data;
  assert.ok(request.tools.some(tool => tool.function.name === 'mdlxl_patch'));
  assert.ok(!request.tools.some(tool => tool.function.name === 'mdlxl_worker'));
  await f.service.rekey({ from: 'unsaved:abc', to: modelKey, name: 'Footman.mdx' });
  assert.equal((await f.service.organiser({ modelKey })).id, id);
});

test('bird names are everyday birds and never reused; steering follows the running worker', () => {
  const first = () => 0;
  assert.equal(nextBird([], first), 'Crow');
  assert.equal(nextBird(['Crow'], first), 'Jackdaw');
  assert.equal(nextBird(['crow', 'Jackdaw', 'Sparrow'], first), 'Robin');
  const all = [];
  for (let i = 0; i <= BIRDS.length; i++) all.push(nextBird(all, first));
  assert.equal(all[BIRDS.length], 'Crow 2');
  assert.equal(new Set(all).size, all.length);
  // In use the first bird is a random corvid, and names are not in a fixed order.
  const firsts = new Set(Array.from({ length: 60 }, () => nextBird([])));
  assert.ok([...firsts].every(name => CORVIDS.includes(name)) && firsts.size > 1);
  assert.equal(nextBird([], () => 0.99), 'Jay');
  const seen = [];
  const organiser = new AiSteering(text => seen.push('organiser:' + text));
  const worker = new AiSteering(text => seen.push('worker:' + text));
  organiser.forward = worker;
  organiser.push('keep the pads', 'message');
  assert.deepEqual(seen, ['organiser:keep the pads', 'worker:keep the pads']);
  assert.equal(worker.take(), 'message');
  assert.equal(organiser.take(), null);
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
  const f = await setup(t, { organiser: () => say('x'), worker: () => say('y') });
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
  assert.equal(reopened.workers[0].status, 'idle');
  const parts = (await restarted.readConversation(id)).transcript[1].parts;
  assert.deepEqual(parts.map(p => p.status), ['stopped', 'stopped']);
});

test('birds of different models work at the same time; a model takes one job at a time', async t => {
  let releaseA;
  const holdA = new Promise(resolve => (releaseA = resolve));
  const f = await setup(t, {
    organiser: data =>
      last(data).role === 'tool' ? say('Done.') : ask({ job: userText(data).includes('model A') ? 'Job A' : 'Job B', instructions: 'Do it.' }),
    worker: async data => {
      if (userText(data).includes('\n\nJob: Job A')) await holdA;
      return say('Report: done');
    },
  });
  const a = await f.service.organiser({ modelKey: 'D:/Models/A.mdx', name: 'A.mdx' }),
    b = await f.service.organiser({ modelKey: 'D:/Models/B.mdx', name: 'B.mdx' });
  const on = documentId => ({ ...context, documentId });
  const jobA = f.service.send({ id: a.id, text: 'work on model A', job: 'Job A', context: on('A') });
  for (let i = 0; i < 200 && !f.service.runningChats().some(r => r.id === a.id && r.worker); i++) await new Promise(r => setTimeout(r, 10));
  assert.ok(f.service.runningChats().some(r => r.id === a.id && r.worker), "A's bird is working");
  await assert.rejects(f.service.send({ id: b.id, text: 'also model A', context: on('A') }), /already working on this model/);
  // Sending re-saves the connection: unchanged is fine while A works, a change waits.
  const saved = await f.service.settings();
  await f.service.configure({ provider: saved.provider, model: saved.model, baseUrl: saved.baseUrl, executable: '' });
  await assert.rejects(f.service.configure({ provider: saved.provider, model: 'other', baseUrl: saved.baseUrl }), /Stop the current AI request/);
  // B's whole job runs and finishes while A's bird is still busy.
  assert.equal((await f.service.send({ id: b.id, text: 'work on model B', context: on('B') })).ok, true);
  assert.deepEqual(f.service.runningChats().map(r => r.id), [a.id]);
  assert.ok(f.events.some(e => e.type === 'running' && e.running.length === 2), 'the console hears both jobs running');
  // Steering and Stop reach only their own chat.
  assert.equal((await f.service.steer({ id: b.id, text: 'hello' })).queued, false);
  f.service.cancel(b.id);
  releaseA();
  assert.equal((await jobA).ok, true);
  assert.deepEqual(f.service.runningChats(), []);
  assert.equal(f.service.busy(), false);
});
test('automatic routing is one tool-free text-only call; addressed follow-ups bypass it', async t => {
  const f = await setup(t, { organiser: () => { throw Error('No organiser'); }, worker: data => data.messages[0].content.startsWith('Route one message.') ? say(JSON.stringify({ job: 'Shield', worker: '', tiny: false })) : say('Finished.') });
  const { id } = await f.service.organiser({ modelKey });
  await f.service.send({ id, text: 'shape garment', context });
  const start = f.requests.length;
  await f.service.send({ id, text: 'inspect shield', route: 'auto', images: ['data:image/png;base64,YQ=='], context });
  const routing = f.requests[start].data;
  assert.equal(routing.tools, undefined);
  assert.equal(routing.messages.length, 2);
  assert.ok(!JSON.stringify(routing).includes('MDLxL context'));
  assert.ok(!JSON.stringify(routing).includes('image_url'));
  assert.equal(f.requests.length - start, 2);
  const org = await f.service.conversation(id, 'compatible');
  assert.equal(org.transcript.at(-1).cost.roles.router.calls, 1);
  assert.equal(org.transcript.at(-1).cost.roles.bird.calls, 1);
  const before = f.requests.length;
  await f.service.send({ id, text: 'look again', worker: org.workers[0].id, route: 'auto', context });
  assert.equal(f.requests.length - before, 1);
});

test('routing preference persists and changing provider requests a new organiser', async t => {
  const f = await setup(t, { organiser: () => say('unused'), worker: () => say('ok') });
  const saved = await f.service.settings();
  await f.service.configure({ ...saved, routing: 'both' });
  assert.equal((await f.service.status()).routing, 'both');
  await assert.rejects(f.service.configure({ ...saved, routing: 'wrong' }), /Choose Manual/);
  await f.service.configure({ provider: 'openai', model: 'fixture', routing: 'manual' });
  assert.ok(f.events.some(e => e.type === 'organiser-reset'));
});

test('counting fixtures compare one job, two jobs and a real half-context handover with Offload off', async t => {
  for (const [count, split, padding] of [[1, 1, 0], [5, 3, 0], [18, 14, 24000]]) {
    const totals = [];
    for (const enabled of [false, true]) {
      const f = await setup(t, { organiser: () => { throw Error('Unexpected organiser'); }, worker: () => say('Report: inspected; protected parts unchanged.') });
      await f.service.setOffload(enabled);
      const { id } = await f.service.organiser({ modelKey });
      for (let i = 0; i < count; i++) {
        assert.equal((await f.service.send({ id, text: 'Inspect this region; keep protected parts unchanged.', route: i === split ? 'new' : 'continue', context: { ...context, fixturePayload: 'x'.repeat(padding) + i }, images: i === 0 ? ['data:image/png;base64,YQ=='] : [] })).ok, true);
      }
      const org = await f.service.conversation(id, 'compatible');
      totals.push({ calls: f.requests.length, tokens: f.requests.reduce((n, r) => n + r.inputTokens, 0), handovers: org.workers?.filter(w => w.status === 'retired').length || 0 });
      if (enabled) {
        assert.equal(f.requests.filter(r => r.kind === 'organiser').length, 0);
        const rows = org.transcript.flatMap(e => e.parts || []).filter(p => p.type === 'worker');
        assert.equal(rows.length, count);
        assert.equal(org.transcript.filter(e => e.role === 'assistant' && e.text).length, 0);
        assert.equal(org.messages.filter(m => m.role === 'assistant').length, count);
        assert.ok(org.transcript.at(-1).cost.roles.bird.tokens > 0);
      }
    }
    // The richer per-job instructions have a fixed cost; separating long histories must still save tokens.
    if (count === 18) assert.ok(totals[1].tokens < totals[0].tokens, JSON.stringify(totals));
    if (count === 18) { assert.equal(totals[1].handovers, 1); assert.equal(totals[1].calls, count, 'the handover note costs no request'); }
    else assert.equal(totals[1].calls, totals[0].calls);
    t.diagnostic(JSON.stringify({ messages: count, off: totals[0], on: totals[1] }));
  }
});

test('region scheduler overlaps independent birds, queues dependencies and structural work, routes steering and checks the combined result', async t => {
  const { regionsConflict } = await import('../src/ai-regions.js');
  for (const mode of ['parallel', 'dependent', 'structural']) {
    let running = 0, peak = 0, combined = 0;
    const starts = [], ends = [];
    let releasePair;
    const bothStarted = new Promise(resolve => { releasePair = resolve; });
    const f = await setup(t, { organiser: () => assert.fail('No organiser recap'), worker: async data => {
      if (data.messages[0].content.startsWith('Route one message')) return say(JSON.stringify({jobs:[
        { job:'First mesh', scope:['/Geosets/0'] },
        { job:'Second mesh', scope:[mode==='dependent'?'/Geosets/0':'/Geosets/1'], structural:mode==='structural' },
      ]}));
      const first = userText(data).includes('Job: First mesh');
      starts.push(first?0:1); peak=Math.max(peak,++running);
      if (mode === 'parallel') {
        if (running === 2) releasePair();
        let timeout;
        try { await Promise.race([bothStarted, new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('Independent birds did not overlap')), 10000); })]); }
        finally { clearTimeout(timeout); }
      } else await new Promise(resolve=>setTimeout(resolve,50));
      running--; ends.push(first?0:1);
      return say('Checked my assigned mesh.');
    }});
    const base=f.service.call;
    let declarations;
    f.service.call=async(name,args)=>{
      if(name!=='mdlxl_regions' || ['summary','label'].includes(args.action)) return base(name,args);
      if(args.action==='declare') { declarations=args.jobs.map(j=>({...j,region:{scope:j.scope,dependencies:[],structural:!!j.structural,readOnly:false}})); return {batch:mode,jobs:declarations}; }
      if(args.action==='begin') return {...context,target:mode+args.index,region:declarations[args.index].region};
      if(args.action==='finish') { combined++; return {passed:true}; }
      if(args.action==='close') return {closed:true};
      assert.fail('Unexpected action '+args.action);
    };
    const {id}=await f.service.organiser({modelKey});
    const result=await f.service.send({id,text:'Inspect both meshes independently',route:'auto',context});
    assert.equal(result.ok,true,JSON.stringify(result));
    assert.equal(peak,mode==='parallel'?2:1);
    assert.equal(regionsConflict(declarations[0].region,declarations[1].region),mode!=='parallel');
    // Overlapping birds may start in either order; queued ones keep the declared order.
    const order=list=>mode==='parallel'?[...list].sort():list;
    assert.deepEqual(order(starts),[0,1]); assert.deepEqual(order(ends),[0,1]); assert.equal(combined,1);
    const org=await f.service.conversation(id,'compatible');
    const rows=org.transcript.flatMap(e=>e.parts||[]).filter(p=>p.type==='worker');
    assert.equal(rows.length,2); assert.ok(rows.every(r=>r.status==='done'&&r.region));
    assert.ok(rows.every(r=>r.cost.roles.bird.calls===1),'cost belongs to that bird');
    assert.equal(org.transcript.at(-1).cost.roles.bird.calls,2);
    assert.equal(org.transcript.at(-1).cost.roles.router.calls,1);
    assert.equal(org.task.combinedReview.passed,true);
  }
});

test('multipart latency fixture compares off, sequential birds and parallel birds', async t=>{
  const results=[];
  for(const mode of ['off','sequential','parallel']){
    const count=6;
    const f=await setup(t,{organiser:()=>assert.fail('recap'),worker:async data=>{
      await new Promise(r=>setTimeout(r,30));
      if(data.messages[0].content.startsWith('Route one message'))return say(JSON.stringify({jobs:Array.from({length:count},(_,i)=>({job:'Inspect part '+i,scope:['/Geosets/'+i]}))}));
      const reads=data.messages.filter(m=>m.role==='tool').length;
      if(reads<(mode==='off'?count:1))return {delta:{tool_calls:[{index:0,id:'read'+reads,function:{name:'mdlxl_read',arguments:JSON.stringify({target:context.target,path:'/Geosets/0'})}}]},finish_reason:'tool_calls'};
      return say('Inspection complete.');
    }});
    const base=f.service.call;let jobs;
    f.service.call=async(name,args)=>{
      if(name==='mdlxl_read')return {sample:'x'.repeat(32000)};
      if(name!=='mdlxl_regions'||['summary','label'].includes(args.action))return base(name,args);
      if(args.action==='declare'){jobs=args.jobs.map(j=>({...j,region:{scope:j.scope,dependencies:[],readOnly:false,structural:mode==='sequential'}}));return{batch:mode,jobs};}
      if(args.action==='begin')return{...context,region:jobs[args.index].region};
      if(args.action==='finish')return{passed:true};
      if(args.action==='close')return{closed:true};
    };
    await f.service.setOffload(mode!=='off');const {id}=await f.service.organiser({modelKey});
    const start=performance.now();const result=await f.service.send({id,text:'Inspect six separate model parts and report each result.',route:'auto',context});
    assert.equal(result.ok,true,JSON.stringify(result));
    results.push({mode,wallMs:Math.round(performance.now()-start),calls:f.requests.length,inputProxy:f.requests.reduce((n,r)=>n+r.inputTokens,0),review:mode==='off'?'unchanged':(await f.service.readConversation(id)).task.combinedReview.passed});
  }
  t.diagnostic(JSON.stringify({multipartFixture:results}));
  assert.ok(results[2].wallMs<results[1].wallMs);
  assert.equal(results[1].calls,results[2].calls);
});

test('lighter jobs are conservative, opt-in and limited to available models', async t=>{
  const {simpleJob,lighterModels}=require('../electron/ai-model-choice.cjs');
  for(const text of ['Rename bone 3 to "Hand"','Set material 1 color to #ff0000','Set sequence 2 rarity to 4','Set geoset 1 visibility from 100 to 200','List the names','Count geosets']) assert.ok(simpleJob(text),text);
  for(const text of ['Make the shoulders stronger','Fix the binding','Rename the bone to Hand and improve the pose','List suggestions for a nicer shape','Set it to whatever looks good']) assert.equal(simpleJob(text),false,text);
  assert.equal(simpleJob('Count geosets',['image']),false);
  assert.deepEqual(lighterModels([{id:'mini'},{id:'full'}],'mini'),[]);
  const f=await setup(t,{models:['test','test-mini'],worker:()=>say('Done.'),organiser:()=>assert.fail('No organiser')});
  assert.deepEqual((await f.service.status()).lighterModels,[],'catalog is not invented');
  await f.service.models();assert.equal((await f.service.status()).lighterModels[0].id,'test-mini');
  const {id}=await f.service.organiser({modelKey});
  await f.service.send({id,text:'Count geosets',context,route:'new'});
  assert.equal(f.requests.at(-1).data.model,'test','setting defaults off');
  await f.service.configure({...await f.service.status(),allowLighter:true,lightModel:'test-mini'});
  await f.service.send({id,text:'Rename bone 3 to "Hand"',context,route:'new'});
  assert.equal(f.requests.at(-1).data.model,'test-mini');
  const before=f.requests.length;
  const asked=await f.service.send({id,text:'Make the shoulders broader',context,route:'new'});
  assert.equal(asked.modelChoiceRequired,true);assert.equal(f.requests.length,before,'question waits without a model call');
  await f.service.send({id,text:'Make the shoulders broader',context,route:'new',lightChoice:'chosen'});
  assert.equal(f.requests.at(-1).data.model,'test');
  await f.service.send({id,text:'Make the shield rounder',context,route:'new',lightChoice:'light'});
  assert.equal(f.requests.at(-1).data.model,'test-mini');
  const org=await f.service.readConversation(id);const lastBird=org.workers.at(-1);
  await f.service.send({id:lastBird.id,text:'Now improve its shape',context});
  assert.equal(f.requests.at(-1).data.model,'test');
  assert.equal(lastBird.status,'retired');
  assert.match(userText(f.requests.at(-1).data),/Handover note/);
  const rows=org.transcript.flatMap(e=>e.parts||[]).filter(p=>p.type==='worker');
  assert.ok(rows.some(r=>r.light&&r.cost.model==='test-mini'));
});

test('a lighter review failure escalates once and never retries the lighter model',async t=>{
  const f=await setup(t,{models:['test','test-mini'],organiser:()=>assert.fail('recap'),worker:data=>{
    if(data.model==='test-mini') return {delta:{tool_calls:[{index:0,id:'failed-review',function:{name:'mdlxl_review',arguments:JSON.stringify({target:context.target,action:'inspect',checksCode:'return []; '})}}]},finish_reason:'tool_calls'};
    assert.match(userText(data),/Applied edits remain.*Do not repeat completed edits/s);
    return say('Chosen model checked the result.');
  }});
  const base=f.service.call;
  f.service.call=(name,args)=>name==='mdlxl_review'&&args.action==='inspect'?{review:{passed:false,changed:true,phase:'inspected'}}:base(name,args);
  await f.service.models();await f.service.configure({...await f.service.status(),allowLighter:true,lightModel:'test-mini'});
  const {id}=await f.service.organiser({modelKey});
  const result=await f.service.send({id,text:'Set material 1 color to #ff0000',context});
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.deepEqual(f.requests.map(r=>r.data.model),['test-mini','test']);
  const org=await f.service.readConversation(id);
  assert.deepEqual(org.workers.map(w=>w.status),['retired','idle']);
  assert.equal(org.transcript.at(-1).cost.roles.bird.calls,2);
});

test('a bird keeps its model and unavailable lighter choices stay disabled',async t=>{
 const f=await setup(t,{models:['test'],worker:()=>say('Done.'),organiser:()=>assert.fail('recap')});
 await f.service.models();await f.service.configure({...await f.service.status(),allowLighter:true,lightModel:'invented-mini'});
 assert.deepEqual((await f.service.status()).lighterModels,[]);
 const {id}=await f.service.organiser({modelKey});
 await f.service.send({id,text:'Count geosets',context});
 await f.service.setModel('changed');
 await f.service.send({id,text:'Count bones',context});
 assert.deepEqual(f.requests.map(r=>r.data.model),['test','test']);
});

test('mixed session reports per-model tokens and a declared fixture price comparison',async t=>{
 const results=[];
 for(const enabled of [false,true]){
  const f=await setup(t,{models:['test','test-mini'],worker:()=>say('Done.'),organiser:()=>assert.fail('recap')});
  await f.service.models();await f.service.configure({...await f.service.status(),allowLighter:enabled,lightModel:'test-mini'});
  const {id}=await f.service.organiser({modelKey});
  for(const text of ['Count geosets','Rename bone 3 to "Hand"','Set material 1 color to #ff0000','List textures','Make the shoulders broader','Improve the walk pose']) await f.service.send({id,text,context,route:'new',...(!require('../electron/ai-model-choice.cjs').simpleJob(text)?{lightChoice:'chosen'}:{})});
  const byModel={};let units=0;
  for(const r of f.requests){byModel[r.data.model]=(byModel[r.data.model]||0)+r.inputTokens;units+=r.inputTokens*(r.data.model==='test-mini'?1:10);}
  results.push({enabled,calls:f.requests.length,inputProxyByModel:byModel,fixtureCostUnits:units});
 }
 t.diagnostic(JSON.stringify({mixedSession:results,priceAssumption:'chosen 10 units/input-token; light 1 unit/input-token; illustrative only, not provider billing'}));
 assert.equal(results[0].calls,results[1].calls);assert.ok(results[1].fixtureCostUnits<results[0].fixtureCostUnits);
});

test('complex steering hands a running lighter bird to the chosen model',async t=>{
 let ready,release;const started=new Promise(r=>ready=r),hold=new Promise(r=>release=r);
 const f=await setup(t,{models:['test','test-mini'],organiser:()=>assert.fail('recap'),worker:async data=>{
  if(data.model==='test-mini'){ready();await hold;return say('Interrupted simple job.');}
  assert.match(userText(data),/User steering: Improve the walk pose/);return say('Strong model completed the follow-up.');
 }});
 await f.service.models();await f.service.configure({...await f.service.status(),allowLighter:true,lightModel:'test-mini'});
 const {id}=await f.service.organiser({modelKey});const running=f.service.send({id,text:'Count geosets',context});
 await started;assert.deepEqual(await f.service.steer({id,text:'Improve the walk pose'}),{queued:true});release();
 assert.equal((await running).ok,true);
 assert.deepEqual(f.requests.map(r=>r.data.model),['test-mini','test']);
});


test('automatic organiser resolves bird ids and names and sees the current job context', async t => {
  let destination = 'id';
  const f = await setup(t, { organiser: () => assert.fail('No recap'), worker: data => {
    if (!data.messages[0].content.startsWith('Route one message')) return say('Finished.');
    const input = JSON.parse(userText(data));
    assert.equal(input.current.name, 'Crow');
    assert.equal(input.current.id, input.birds[0].id);
    assert.ok(input.recent.some(m => m.content.includes('Adapt donor cloth motion')));
    return say(JSON.stringify({ worker: destination === 'id' ? input.birds[0].id : '  cRoW  ', job: 'Refine donor cloth motion', tiny: false }));
  }});
  const { id } = await f.service.organiser({ modelKey });
  assert.equal((await f.service.send({ id, text: 'Adapt donor cloth motion', route: 'new', context })).ok, true);
  await f.service.configure({ ...await f.service.status(), routing: 'automatic' });
  for (destination of ['id', 'name']) {
    const result = await f.service.send({ id, text: 'Keep the cloth clear of the arm', context });
    assert.equal(result.ok, true, JSON.stringify(result));
  }
  const org = await f.service.readConversation(id);
  assert.equal(org.workers.length, 1);
  assert.equal(org.workers[0].name, 'Crow');
  assert.equal(f.requests.length, 5);
});

test('automatic organiser corrects an invalid route before any bird runs', async t => {
  let routes = 0, work = 0, tokens = 0;
  const f = await setup(t, { organiser: () => assert.fail('No recap'), worker: data => {
    if (!data.messages[0].content.startsWith('Route one message')) { work++; return say('Done.'); }
    routes++;
    if (routes > 1) assert.match(userText(data), /invalid|unknown/i);
    const answer = say(routes === 1 ? JSON.stringify({ worker: 'Missing bird', job: 'Cloth', tiny: false }) : '```json\n' + JSON.stringify({ worker: '', job: 'Cloth', tiny: false }) + '\n```');
    tokens += f.requests.at(-1).inputTokens + Math.ceil(JSON.stringify(answer.delta).length / 4);
    return answer;
  }});
  const { id } = await f.service.organiser({ modelKey });
  const result = await f.service.send({ id, text: 'Adapt donor cloth motion', route: 'auto', context });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(routes, 2);
  assert.equal(work, 1);
  const cost = (await f.service.readConversation(id)).transcript.at(-1).cost.roles.router;
  assert.equal(cost.calls, 2);
  assert.equal(cost.tokens, tokens, 'both routing turns contribute their full reported tokens');
});

test('automatic routing reports repeated invalid decisions without dispatching a bird', async t => {
  let routes = 0;
  const f = await setup(t, { organiser: () => assert.fail('No recap'), worker: data => {
    assert.ok(data.messages[0].content.startsWith('Route one message'));
    routes++;
    return say(routes === 1 ? 'not JSON' : 'null');
  }});
  const { id } = await f.service.organiser({ modelKey });
  const result = await f.service.send({ id, text: 'Adapt donor cloth motion', route: 'auto', context });
  assert.equal(result.ok, false);
  assert.match(result.error, /routing decision/i);
  assert.equal(routes, 2);
  assert.equal((await f.service.readConversation(id)).workers.length, 0);
});

test('automatic organiser judges complexity and delegates without the manual model question', async t => {
  let tiny = true;
  const f = await setup(t, { models: ['test', 'test-mini'], organiser: () => assert.fail('No recap'), worker: data => {
    if (!data.messages[0].content.startsWith('Route one message')) return say('Done.');
    assert.equal(data.model, 'test', 'the chosen organiser judges the route');
    assert.match(data.messages[0].content, /complexity/i);
    const input = JSON.parse(userText(data));
    assert.equal(input.lighterModel, 'test-mini');
    return say(JSON.stringify({ worker: input.current?.id || '', job: tiny ? 'Read bone names' : 'Repair cloth motion', tiny }));
  }});
  await f.service.models();
  await f.service.configure({ ...await f.service.status(), allowLighter: true, lightModel: 'test-mini', routing: 'automatic' });
  const { id } = await f.service.organiser({ modelKey });
  const result = await f.service.send({ id, text: 'Which bones belong to this garment?', context });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.modelChoiceRequired, undefined);
  assert.equal(f.requests.at(-1).data.model, 'test-mini');
  tiny = false;
  assert.equal((await f.service.send({ id, text: 'Make its cloth respect the arm motion', context })).ok, true);
  assert.equal(f.requests.at(-1).data.model, 'test');
  const org = await f.service.readConversation(id);
  assert.deepEqual(org.workers.map(w => [w.light, w.status]), [[true, 'retired'], [false, 'idle']]);
  assert.match(userText(f.requests.at(-1).data), /Handover note/);
});

test('automatic tiny jobs respect disabled lighter models and explicit bird destinations', async t => {
  const f = await setup(t, { models: ['test', 'test-mini'], organiser: () => assert.fail('No recap'), worker: data =>
    say(data.messages[0].content.startsWith('Route one message') ? JSON.stringify({ worker: '', job: 'Bone names', tiny: true }) : 'Done.') });
  await f.service.models();
  const { id } = await f.service.organiser({ modelKey });
  assert.equal((await f.service.send({ id, text: 'Which bones are these?', route: 'auto', context })).ok, true);
  assert.ok(f.requests.every(r => r.data.model === 'test'));
  const before = f.requests.length;
  assert.equal((await f.service.send({ id, text: 'Crow: count the bones again', route: 'auto', context })).ok, true);
  assert.equal(f.requests.length, before + 1);
});


test('automatic multipart routing assigns complexity per part and gives each region its own bird', async t => {
  const f = await setup(t, { models: ['test', 'test-mini'], organiser: () => assert.fail('No recap'), worker: data =>
    say(data.messages[0].content.startsWith('Route one message') ? JSON.stringify({ jobs: [
      { job: 'Read first part', tiny: true, scope: ['/Geosets/0'] },
      { job: 'Read second part', tiny: true, scope: ['/Geosets/1'] },
      { job: 'Shape third part', tiny: false, scope: ['/Geosets/2'] },
    ] }) : 'Done.') });
  await f.service.models();
  await f.service.configure({ ...await f.service.status(), allowLighter: true, lightModel: 'test-mini', routing: 'automatic' });
  const base = f.service.call;
  let jobs, finished = false;
  f.service.call = async (name, args) => {
    if (name !== 'mdlxl_regions' || ['summary', 'label'].includes(args.action)) return base(name, args);
    if (args.action === 'declare') {
      jobs = args.jobs.map(j => ({ ...j, region: { scope: j.scope, dependencies: [], structural: false, readOnly: false } }));
      return { batch: 'mixed', jobs };
    }
    if (args.action === 'begin') return { ...context, target: 'part-' + args.index, region: jobs[args.index].region };
    if (args.action === 'finish') { finished = true; return { passed: true }; }
    if (args.action === 'close') return { closed: true };
    assert.fail('Unexpected region action ' + args.action);
  };
  const { id } = await f.service.organiser({ modelKey });
  assert.equal((await f.service.send({ id, text: 'Inspect two parts and shape the separate third part', context })).ok, true);
  const org = await f.service.readConversation(id);
  assert.equal(org.workers.length, 3);
  assert.deepEqual(org.workers.map(w => w.model), ['test-mini', 'test-mini', 'test']);
  assert.ok(finished);
});

const jobTool = (name, args) => ({ delta: { tool_calls: [{ index: 0, id: 'c-' + Math.random(), function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: 'tool_calls' });
const jobPlan = extra => ({ cause: 'The requested part needs adjustment.', reach: 'Only the requested part.', keep: ['unrelated model data'], options: [{ fix: 'Adjust the owned part', cost: 'Only its values change' }, { fix: 'Rebuild it', cost: 'Changes topology' }], choice: 0, why: 'Preserves the original structure', checks: ['Requested change is visible', 'Unrelated data matches the baseline'], ...extra });
function helperRegions(f) {
  const base = f.service.call; const batches = new Map(); let closed = 0;
  f.service.call = async (name,args,...rest) => {
    if (name !== 'mdlxl_regions' || ['summary','label'].includes(args.action)) return base(name,args,...rest);
    if (args.action === 'declare') { const batch = 'batch-' + batches.size; const jobs=args.jobs.map(j=>({...j,region:{scope:j.scope||[],dependencies:[],readOnly:!!j.readOnly,structural:!!j.structural}})); batches.set(batch,jobs); return {batch,jobs}; }
    if (args.action === 'begin') return {...context,target:args.batch+'-'+args.index,region:batches.get(args.batch)[args.index].region};
    if (args.action === 'finish') return {passed:true};
    if (args.action === 'close') {closed++;return {closed:true};}
    assert.fail('Unexpected region action '+args.action);
  };
  return {closed:()=>closed};
}

test('automatic organiser runs a read-only helper alongside inspection and delivers evidence before an edit', async t => {
  let release, observed, editorTurns=0, helperTurns=0, edits=0;
  const inspected=new Promise(r=>release=r); const evidence=[];
  const f=await setup(t,{organiser:()=>assert.fail('no recap'),worker:async data=>{
    const system=data.messages[0].content;
    if(system.startsWith('Route one message')) return say(JSON.stringify({job:'Adjust owned part',helper:{job:'Inspect reference',instructions:'Measure the matching donor part and return its ID.'},checks:['Requested part aligns with reference']}));
    if(system.startsWith('You are a read-only')) {
      helperTurns++;
      if(helperTurns===1){await inspected; observed=true; return jobTool('mdlxl_script',{target:'batch-0-0',edit:true,code:'model.Info.Name="wrong";'});}
      assert.match(data.messages.at(-1).content,/read-only/);
      assert.ok(!data.tools.some(t=>t.function.name==='mdlxl_command'));
      return say('Donor reference has part ID 7; measured alignment is 2 units.');
    }
    editorTurns++;
    evidence.push(JSON.stringify(data.messages));
    if(editorTurns===1) return jobTool('mdlxl_context',{});
    if(editorTurns===2) return jobTool('mdlxl_plan',jobPlan());
    if(editorTurns===3) { assert.ok(observed); assert.match(data.messages.at(-1).content,/part ID 7/); return jobTool('mdlxl_patch',{target:context.target,label:'premature edit',scope:['/Geosets/0'],operations:[{op:'set',path:'/Geosets/0/Vertices/0',value:2}]}); }
    if(editorTurns===4) { assert.match(data.messages.at(-1).content,/Incorporate the helper/); return jobTool('mdlxl_plan',jobPlan()); }
    if(editorTurns===5) return jobTool('mdlxl_patch',{target:context.target,label:'Apply alignment',scope:['/Geosets/0'],operations:[{op:'set',path:'/Geosets/0/Vertices/0',value:2}]});
    return say('Aligned the requested part.');
  }});
  const regions=helperRegions(f); const base=f.service.call;
  f.service.call=async(name,args,...rest)=>{
    if(name==='mdlxl_context'){release();return {target:context.target};}
    if(name==='mdlxl_patch'){edits++;return {applied:true,changes:[]};}
    return base(name,args,...rest);
  };
  const {id}=await f.service.organiser({modelKey});
  const result=await f.service.send({id,text:'Adjust this model part to match the attached reference',route:'auto',context});
  assert.equal(result.ok,true,JSON.stringify(result)); assert.equal(edits,1); assert.equal(helperTurns,2); assert.equal(regions.closed(),1);
  const org=await f.service.readConversation(id);
  assert.equal(org.workers.length,2); assert.ok(org.workers[1].helperOnly); assert.equal(org.currentWorker,org.workers[0].id);
  const bird=await f.service.readConversation(org.currentWorker);
  assert.equal(bird.task.helper.delivered,true); assert.equal(bird.task.helper.needsPlan,false);
  assert.match(bird.task.helper.report,/part ID 7/); assert.equal(f.service.tasks.size,0); assert.equal(f.service.workerLocks.size,0);
});

test('a bird can request a helper in manual routing without an extra organiser call',async t=>{
  let n=0;
  const f=await setup(t,{organiser:()=>assert.fail('manual route'),worker:data=>{
    if(data.messages[0].content.startsWith('You are a read-only'))return say('Measured donor reference 4.');
    n++;
    if(n===1)return jobTool('mdlxl_plan',jobPlan({helper:{job:'Measure donor',instructions:'Inspect the donor only.'}}));
    if(n===2)return jobTool('mdlxl_plan',jobPlan());
    if(n===3){assert.match(last(data).content,/Measured donor/);return jobTool('mdlxl_plan',jobPlan());}
    return say('Used the reference measurements.');
  }});
  const regions=helperRegions(f); const {id}=await f.service.organiser({modelKey});
  const result=await f.service.send({id,text:'Inspect and fit the requested part',context});
  assert.equal(result.ok,true,JSON.stringify(result)); assert.equal(regions.closed(),1);
  assert.equal(f.requests.filter(r=>r.data.messages[0].content.startsWith('Route one message')).length,0);
});

test('phase handover retains baseline, reusable routines and edits without replaying them',async t=>{
  let first=0, second=0, edits=0, restored=0, routineCalls=0;
  let f;
  f=await setup(t,{organiser:()=>assert.fail('no routing'),worker:data=>{
    if(userText(data).includes('Resume the interrupted task')) {
      second++;
      if(second===1){assert.match(userText(data),/remaining verification/);assert.ok(!JSON.stringify(data.messages).includes('large-body-marker'));return jobTool('mdlxl_script',{target:context.target,routine:'measure',parameters:{value:5}});}
      return say('Remaining verification complete.');
    }
    first++;
    if(first===1)return jobTool('mdlxl_plan',jobPlan());
    if(first===2)return jobTool('mdlxl_script',{target:context.target,routine:'measure',code:'// large-body-marker\nreturn parameters.value;',parameters:{value:2}});
    if(first===3)return jobTool('mdlxl_patch',{target:context.target,label:'Apply once',scope:['/Geosets/0'],operations:[{op:'set',path:'/Geosets/0/Vertices/0',value:2}]});
    const bird=[...f.service.conversations.values()].find(c=>c.kind==='worker'); bird.usage={used:150000,window:200000};
    return jobTool('mdlxl_job_checkpoint',{phase:'verify',evidence:'Candidate aligned; original saved in checkpoint.',remaining:['remaining verification']});
  }});
  const base=f.service.call;
  f.service.call=async(name,args,...rest)=>{
    if(name==='mdlxl_script'){routineCalls++;assert.match(args.code,/large-body-marker/);return {value:1};}
    if(name==='mdlxl_patch'){edits++;return {applied:true,changes:[]};}
    if(name==='mdlxl_checkpoint'){
      if(first>=4 && second===0) [...f.service.conversations.values()].find(c=>c.kind==='worker' && !c.retired).usage={used:150000,window:200000};
      if(args.restore){restored++;assert.deepEqual(args.baseline,{Info:{Name:'Original'}});}
      return {fingerprint:edits?'after':'before',name:context.name,context,review:{changed:!!edits,phase:'verified'},...(args.includeBaseline?{baseline:{Info:{Name:'Original'}}}:{})};
    }
    if(name==='mdlxl_review')return {changed:!!edits,phase:'verified'};
    return base(name,args,...rest);
  };
  const {id}=await f.service.organiser({modelKey}); const result=await f.service.send({id,text:'Fit the requested part accurately',context});
  assert.equal(result.ok,true,JSON.stringify(result)); assert.equal(edits,1); assert.equal(routineCalls,2); assert.equal(restored,1);
  const org=await f.service.readConversation(id); assert.deepEqual(org.workers.map(w=>w.status),['retired','idle']);
  const bird=await f.service.readConversation(org.currentWorker); assert.equal(bird.task.steps.length,1); assert.equal(bird.task.workCheckpoint.remaining[0],'remaining verification');
});

test('dependent jobs receive only completed prerequisite reports',async t=>{
  const started=[];
  const f=await setup(t,{organiser:()=>assert.fail('no recap'),worker:data=>{
    if(data.messages[0].content.startsWith('Route one message')) return say(JSON.stringify({jobs:[{job:'Reference report',readOnly:true},{job:'Dependent check',readOnly:true,dependsOn:[0]}]}));
    if(userText(data).includes('\n\nJob: Reference')){started.push(0);return say('Reference ID 42 measured.');}
    started.push(1);assert.match(userText(data),/Reference ID 42 measured/);return say('Checked against the reference.');
  }});
  helperRegions(f); const {id}=await f.service.organiser({modelKey}); const result=await f.service.send({id,text:'Inspect reference then compare its proportions',route:'auto',context});
  assert.equal(result.ok,true,JSON.stringify(result)); assert.deepEqual(started,[0,1]);
});



test('stopping a job stops its helper and Resume restarts the read-only investigation',async t=>{
  let ready, release, helperTurns=0;const started=new Promise(r=>ready=r),hold=new Promise(r=>release=r);
  const f=await setup(t,{organiser:()=>assert.fail('no recap'),worker:async data=>{
    if(data.messages[0].content.startsWith('Route one message'))return say(JSON.stringify({job:'Inspect',helper:{job:'Measure reference',instructions:'Read the reference.'}}));
    if(data.messages[0].content.startsWith('You are a read-only')){helperTurns++;ready();await hold;return say('Read only.');}
    await hold;return say('Read only.');
  }});
  const regions=helperRegions(f);const {id}=await f.service.organiser({modelKey});
  const pending=f.service.send({id,text:'Inspect the reference and target together',route:'auto',context});
  await started; f.service.cancel(id);release();const result=await pending;
  assert.equal(result.cancelled,true,JSON.stringify(result));assert.equal(regions.closed(),1);assert.equal(f.service.workerLocks.size,0);assert.equal(f.service.tasks.size,0);
  const org=await f.service.readConversation(id), bird=await f.service.readConversation(org.task.workerId);
  assert.equal(bird.task.helper.status,'failed');
  const resumed=await f.service.send({id,context,resume:true});
  assert.equal(resumed.ok,true,JSON.stringify(resumed)); assert.equal(helperTurns,2);
  const after=await f.service.readConversation(org.task.workerId);
  assert.equal(after.task.helper.status,'done');assert.equal(after.task.helper.delivered,true);
  assert.equal(regions.closed(),2);assert.equal(f.service.workerLocks.size,0);assert.equal(f.service.tasks.size,0);
});

test('an exact value edit uses the existing direct bird path without a plan or helper',async t=>{
  let n=0, edits=0;
  const f=await setup(t,{organiser:()=>assert.fail('no organiser'),worker:()=>++n===1?jobTool('mdlxl_patch',{target:context.target,label:'Rename',scope:['/Info'],operations:[{op:'set',path:'/Info/Name',value:'Test'}]}):say('Renamed.')});
  const base=f.service.call;f.service.call=(name,args,...rest)=>name==='mdlxl_patch'?(edits++,{applied:true,changes:[]}):base(name,args,...rest);
  const {id}=await f.service.organiser({modelKey});const result=await f.service.send({id,text:'Rename model to Test',context});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(edits,1);assert.equal((await f.service.readConversation(id)).workers.length,1);assert.equal(f.requests.length,2);
});


test('direct messages to an editor bird retain organiser lifecycle and destination',async t=>{
  const f=await setup(t,{organiser:()=>assert.fail('no routing'),worker:()=>say('Finished the assigned job.')});
  const {id}=await f.service.organiser({modelKey});
  await f.service.send({id,text:'Inspect the model',context});
  const org=await f.service.readConversation(id), bird=org.workers[0];
  const result=await f.service.send({id:bird.id,text:'Inspect that same model again',context});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(org.workers.length,1);assert.equal(org.currentWorker,bird.id);
  assert.equal(org.transcript.filter(m=>m.role==='user').length,2);assert.equal(f.requests.length,2);
});


test('resuming an interrupted bird preserves its job title rather than its plan reach', async t=>{
 let ready,release,turn=0;
 const started=new Promise(r=>ready=r), hold=new Promise(r=>release=r);
 const f=await setup(t,{organiser:()=>assert.fail('No organiser'),worker:async data=>{
   if(userText(data).includes('Resume the interrupted task')) return say('Inspection complete.');
   if(++turn===1) return jobTool('mdlxl_plan',jobPlan({reach:'Only the left shoulder vertices.'}));
   ready(); await hold; return say('Stopped inspection.');
 }});
 const {id}=await f.service.organiser({modelKey});
 const pending=f.service.send({id,text:'Inspect the shoulder',job:'Shoulder inspection',context,route:'new'});
 await started; f.service.cancel(id); release();
 assert.equal((await pending).cancelled,true);
 assert.equal((await f.service.send({id,context,resume:true})).ok,true);
 const org=await f.service.readConversation(id);
 assert.equal(org.workers[0].job,'Shoulder inspection');
 assert.equal(org.workers.length,1);
});

test('a bird names its job in its plan instead of echoing the request', async t=>{
 let turn=0;
 const f=await setup(t,{organiser:()=>assert.fail('No organiser'),worker:async()=>++turn===1?jobTool('mdlxl_plan',jobPlan({title:'Copy trim to geoset 4'})):say('Done.')});
 const {id}=await f.service.organiser({modelKey});
 assert.equal((await f.service.send({id,text:'Geoset 6 creates a trim between geoset 8 and 13, make the same between 8 and 4',context,route:'new'})).ok,true);
 const org=await f.service.readConversation(id);
 assert.equal(org.workers[0].job,'Copy trim to geoset 4');
 const working=f.events.filter(e=>e.type==='worker'&&e.status==='working').map(e=>e.job);
 assert.deepEqual(working,['Geoset 6 creates a trim between…','Copy trim to geoset 4']);
});


test('region routing rejects the same bird named by both name and id before dispatch',async t=>{
 let existing;
 const f=await setup(t,{organiser:()=>assert.fail('no recap'),worker:data=>{
   if(!data.messages[0].content.startsWith('Route one message')) return say('Initial inspection complete.');
   return say(JSON.stringify({jobs:[{job:'First region',worker:existing.name,readOnly:true},{job:'Second region',worker:existing.id.toUpperCase(),readOnly:true}]}));
 }});
 const {id}=await f.service.organiser({modelKey});
 assert.equal((await f.service.send({id,text:'Inspect the model',route:'new',context})).ok,true);
 existing=(await f.service.readConversation(id)).workers[0];
 const before=f.requests.length, result=await f.service.send({id,text:'Inspect two regions',route:'auto',context});
 assert.equal(result.ok,false); assert.match(result.error,/different bird/);
 assert.equal(f.requests.length-before,2,'only the router and its correction ran');
 assert.equal((await f.service.readConversation(id)).workers.length,1);
 assert.equal(f.service.workerLocks.size,0);assert.equal(f.service.tasks.size,0);
});

// An editor snapshot the size of a real one: ~120 nodes, 20 sequences and ~100 commands.
const bigContext = (selection, frame) => ({
  ...context, revision: 7, frame, sequence: 2, mode: 'vertex', counts: { geosets: 12, vertices: 4000, triangles: 6000, nodes: 120 },
  geosets: Array.from({ length: 12 }, (_, index) => ({ index, vertices: 330, triangles: 500, material: index % 4 })),
  nodes: Array.from({ length: 120 }, (_, id) => ({ id, name: 'Bone_Node_' + id, parent: id - 1 })),
  sequences: Array.from({ length: 20 }, (_, i) => ({ Name: 'Stand ' + i, Interval: [i * 1000, i * 1000 + 999], MoveSpeed: 0, NonLooping: false, Rarity: 0, MinimumExtent: [-50, -50, 0], MaximumExtent: [50, 50, 120], BoundsRadius: 80 })),
  diagnostics: Array.from({ length: 10 }, (_, i) => ({ severity: 'warning', text: 'Diagnostic message number ' + i + ' about this model' })),
  commands: Array.from({ length: 100 }, (_, i) => ({ id: 'command-' + i, label: 'Editor command ' + i, enabled: true })),
  selection,
});

test('a bird gets the full editor snapshot once; later messages carry the target and what changed', async t => {
  const f = await setup(t, { organiser: () => assert.fail('No organiser'), worker: () => say('Done.') });
  const { id } = await f.service.organiser({ modelKey });
  const sent = [bigContext({ 0: [1, 2] }, 0), bigContext({ 0: [3] }, 0), { ...bigContext({ 0: [3] }, 250), target: 'next-target', diagnostics: [] }];
  for (const [i, ctx] of sent.entries()) await f.service.send({ id, text: 'Inspect the selection ' + i, route: 'continue', context: ctx });
  const prompts = f.requests.map(r => userText(r.data));
  const contextPart = text => text.slice(text.indexOf('\n\nMDLxL context'));
  const before = sent.map(ctx => ('\n\nMDLxL context captured when this prompt was sent:\n' + JSON.stringify(ctx)).length);
  const after = prompts.map(p => contextPart(p).length);
  t.diagnostic(JSON.stringify({ contextCharsPerMessage: { before, after } }));
  assert.equal(prompts.length, 3);
  assert.match(prompts[0], /MDLxL context captured when this prompt was sent/);
  assert.ok(prompts[0].includes('Bone_Node_119'), 'first message has the full lists');
  assert.ok(prompts.every(p => !p.includes('command-0')), 'the command list stays with mdlxl_context');
  for (const p of prompts.slice(1)) {
    assert.match(p, /Call mdlxl_context for the full lists/);
    assert.ok(!p.includes('Bone_Node_'), 'unchanged lists are not repeated');
  }
  const delta = i => JSON.parse(contextPart(prompts[i]).split('\n').at(-1));
  assert.deepEqual(delta(1), { target: 'selected', selection: { 0: [3] } });
  assert.deepEqual(delta(2), { target: 'next-target', frame: 250, diagnostics: [] });
  assert.ok(after[1] * 10 < after[0] && after[2] * 10 < after[0], 'later messages are much smaller');
  // A new bird starts again from the full snapshot.
  await f.service.send({ id, text: 'Something new', route: 'new', context: sent[1] });
  assert.ok(userText(f.requests.at(-1).data).includes('Bone_Node_119'));
});

test('Keep a summary gives Codex and Claude Code the stored bird reports and the diary', async t => {
  const f = await setup(t, { organiser: () => assert.fail('No organiser'), worker: () => say('Crow report: garment separated into geoset 26.') });
  const { id } = await f.service.organiser({ modelKey });
  await f.service.send({ id, text: 'separate the garment', context });
  const organiser = await f.service.conversation(id, 'compatible');
  (await f.service.registry.model(modelKey)).diary = [{ id: 'd', at: '2026-10-29T00:00:00Z', request: 'separate the garment', edits: ['Split garment'], outcome: 'verified' }];
  const prompts = [];
  f.service.runTask = async ({ text }) => { prompts.push(text); };
  for (const provider of ['codex', 'claude', 'compatible']) await f.service.memoryNote(organiser, { ...(await f.service.settings()), provider }, null);
  for (const prompt of prompts.slice(0, 2)) {
    assert.match(prompt, /User: separate the garment\n\nCrow: Crow report: garment separated into geoset 26\./);
    assert.match(prompt, /Decision diary: .*\n- 2026-10-29: "separate the garment" \| edits: Split garment/);
  }
  // API routes already send the ledger as history; it is not repeated in the prompt.
  assert.ok(!prompts[2].includes('Crow report'));
});

test('an organiser task that is running stays running when the console asks about it', async t => {
  const profile = tempDir('mdlxl-ai-taskinfo-');
  t.after(() => fs.rm(profile, { recursive: true, force: true }));
  const service = new AiService({ root, profile, electron: {}, getWindow: () => null });
  t.after(() => service.close());
  await fs.mkdir(service.directory, { recursive: true });
  service.conversations.set('organiser', { id: 'organiser', provider: 'codex', kind: 'organiser', transcript: [], messages: [], task: { status: 'running', phase: 'editing', steps: [] } });
  service.tasks.set('organiser', { id: 'organiser' });
  assert.equal((await service.taskInfo('organiser')).status, 'running');
  service.tasks.delete('organiser');
  assert.equal((await service.taskInfo('organiser')).status, 'interrupted');
});

test('removeFiles deletes what it is asked to, six folders deep at most', async t => {
  const { removeFiles } = require('../electron/ai-offload.cjs');
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
  await Promise.all([service.setOffload(false), service.setWebResearch(true), service.setEditingHandbook(true), service.setOffload(true)]);
  const saved = JSON.parse(await fs.readFile(path.join(service.directory, 'connections.json'), 'utf8'));
  assert.deepEqual([saved.offload, saved.webResearch, saved.editingHandbook], [true, true, true]);
  assert.deepEqual((await fs.readdir(service.directory)).filter(name => name.endsWith('.tmp')), []);
});


test('context diet: words lead, unchanged drawings stay out of follow-ups, replacement and compaction reset once', async t => {
  const f = await setup(t, { organiser: () => assert.fail('No organiser'), worker: () => say('Done.') });
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
  const org=await f.service.conversation(id,'compatible'), bird=await f.service.conversation(org.currentWorker,'compatible');
  f.service.measureUsage(bird, f.service.recorder(bird, () => {}), 'bird')({type:'compaction',active:false});
  await f.service.send({id,text:'After compaction',context:ctx});
  assert.match(userText(f.requests.at(-1).data), /context captured when this prompt was sent/);
  await f.service.send({id,text:'Still the same model',context:ctx});
  assert.equal(JSON.parse(userText(f.requests.at(-1).data).split('\n').at(-1)).nodes, undefined);
  await f.service.send({id,text:'A replacement model',context:{...ctx,documentId:'replacement'}});
  assert.ok(userText(f.requests.at(-1).data).includes('Bone_Node_119'));
});

test('context diet: replay the three recorded helmet messages and measure the actual follow-up reduction', async t => {
  const f = await setup(t, { organiser: () => assert.fail('No organiser'), worker: () => say('Done.') });
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
  f=await setup(t,{organiser:()=>assert.fail('No organiser'),worker:()=>{
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
  const org=await f.service.conversation(id,'compatible'),bird=await f.service.conversation(org.currentWorker,'compatible');
  bird.messages=[];
  await f.service.send({id,text:'After a provider-history reset',context:current});
  const restored=userText(f.requests.at(-1).data);
  assert.match(restored,/context captured when this prompt was sent/);
  assert.match(restored,/"selectedNodeIds":\[119\]/);
  assert.match(restored,/"parent":42/);
});
