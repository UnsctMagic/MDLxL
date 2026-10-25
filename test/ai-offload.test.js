import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { AiService } = require('../electron/ai-service.cjs');
const { nextBird, AiSteering, deleteProviderSessions, BIRDS, CORVIDS } = require('../electron/ai-offload.cjs');
const root = path.resolve(import.meta.dirname, '..');
const context = { target: 'selected', documentId: 'model', name: 'Footman.mdx', selection: { 0: [1, 2] } };
const modelKey = 'D:/Models/Footman.mdx';

// A fake OpenAI-compatible provider: `organiser` answers the organiser's requests,
// `worker` answers every worker request. Both get the request body.
async function setup(t, { organiser, worker }) {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlxl-ai-offload-'));
  t.after(() => fs.rm(profile, { recursive: true, force: true }));
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    const data = JSON.parse(body);
    const system = data.messages[0].content;
    const kind = system.includes('SD Brain art director') ? 'art' : system.includes('You are the organiser') ? 'organiser' : 'worker';
    requests.push({ kind, data });
    const answer =
      kind === 'art'
        ? { delta: { content: 'Goal: a test brief.' }, finish_reason: 'stop' }
        : await (kind === 'organiser' ? organiser : worker)(data, requests.filter(r => r.kind === kind).length);
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end('data: ' + JSON.stringify({ choices: [answer] }) + '\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => (server.closeAllConnections(), server.close(resolve))));
  const events = [];
  const service = new AiService({ root, profile, electron: {}, getWindow: () => null, sdBrainAvailable: true });
  service.emit = event => events.push(event);
  // Names are random in use; the first choice keeps tests readable (Crow, then Jackdaw).
  service.random = () => 0;
  service.call = async name => {
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

test('the organiser routes jobs to named birds, follow-ups return to the same bird, tiny jobs share one', async t => {
  const plan = [
    { job: 'Separate red garment', instructions: 'Cut the red garment into its own geoset.' },
    { worker: 'Crow', job: 'Thicken garment edge', instructions: 'Make the edge thicker.' },
    { tiny: true, job: 'Rename geoset', instructions: 'Rename geoset 25 to Coins.' },
    { tiny: true, job: 'Rename bone', instructions: 'Rename the bone.' },
  ];
  let turn = 0;
  const f = await setup(t, {
    organiser: data => (last(data).role === 'tool' ? say('Done by the worker.') : ask(plan[turn++])),
    worker: data => say('Report: finished "' + userText(data).split('\n')[0] + '"'),
  });
  const { id } = await f.service.organiser({ modelKey, name: 'Footman.mdx' });
  const send = text => f.service.send({ id, text, context });
  assert.equal((await send('I marked the red garment, cut it out like the coins')).ok, true);
  assert.equal((await send('make it a bit thicker')).ok, true);
  assert.equal((await send('rename geoset 25')).ok, true);
  assert.equal((await send('rename the bone too')).ok, true);
  const organiser = await f.service.conversation(id, 'compatible');
  assert.deepEqual(
    organiser.workers.map(w => [w.name, w.tiny, w.status]),
    [
      ['Crow', false, 'idle'],
      ['Jackdaw', true, 'idle'],
    ],
  );
  // Workers get the user's words exactly as written, beside the organiser's instructions.
  const workerPrompts = f.requests.filter(r => r.kind === 'worker').map(r => userText(r.data));
  assert.match(workerPrompts[0], /The user's message, exactly as written:\nI marked the red garment, cut it out like the coins/);
  assert.match(workerPrompts[1], /make it a bit thicker/);
  // Crow's second job continued the same conversation: it still sees its first job.
  const crowSecond = f.requests.filter(r => r.kind === 'worker')[1].data.messages;
  assert.ok(JSON.stringify(crowSecond).includes('cut it out like the coins'));
  // The organiser's chat shows a worker row per job, with the report.
  const rows = organiser.transcript.flatMap(e => e.parts || []).filter(p => p.type === 'worker');
  assert.deepEqual(rows.map(r => [r.name, r.status]), [
    ['Crow', 'done'],
    ['Crow', 'done'],
    ['Jackdaw', 'done'],
    ['Jackdaw', 'done'],
  ]);
  assert.match(rows[0].report, /Report: finished "Job: Separate red garment"/);
  // The organiser knows a bird's name before it exists, to say "I'll ask Crow to…".
  const organiserPrompts = f.requests.filter(r => r.kind === 'organiser' && r.data.messages.at(-1).role === 'user').map(r => userText(r.data));
  assert.match(organiserPrompts[0], /A new job would go to a new worker called Crow\./);
  assert.match(organiserPrompts[3], /Tiny jobs go to Jackdaw\./);
  // The organiser is told the roster each turn.
  assert.match(userText(f.requests.filter(r => r.kind === 'organiser').at(-2).data), /- Crow: Thicken garment edge/);
  const crow = await f.service.readConversation(organiser.workers[0].id);
  assert.equal(crow.kind, 'worker');
  assert.equal(crow.transcript[0].from, 'organiser');
  // Organisers belong to the model: asking again returns the same one.
  assert.equal((await f.service.organiser({ modelKey })).id, id);
});

test('with SD Brain on, birds get the same policy and the organiser can look at the result', async t => {
  let turn = 0;
  const f = await setup(t, {
    organiser: data => (data.messages.at(-1).role === 'tool' ? say('ok') : (turn++, ask({ job: 'Chalice', instructions: 'Make a chalice of power.' }))),
    worker: () => say('Made the chalice.'),
  });
  await f.service.setSdBrain(true);
  const { id } = await f.service.organiser({ modelKey });
  await f.service.send({ id, text: 'make a chalice of power', context });
  const organiserRequest = f.requests.find(r => r.kind === 'organiser').data,
    workerRequest = f.requests.find(r => r.kind === 'worker').data;
  const system = request => request.messages.find(m => m.role === 'system').content;
  assert.match(system(organiserRequest), /As the organiser with SD Brain on/);
  assert.ok(organiserRequest.tools.some(tool => tool.function.name === 'mdlxl_capture'));
  assert.ok(system(workerRequest).includes('SD Brain is on.') && system(workerRequest).includes('Warcraft III SD modeling rulebook'));
  assert.match(userText(workerRequest), /Task settings: SD Brain on/);
  // One art brief per user request: the organiser has it, and the bird gets it with its job.
  assert.equal(f.requests.filter(r => r.kind === 'art').length, 1);
  assert.match(userText(organiserRequest), /SD art brief for this request[^\n]*\nGoal: a test brief\./);
  assert.match(userText(workerRequest), /SD art brief for this request:\nGoal: a test brief\./);
  // Off: the organiser has no capture tool and the bird gets the off state.
  await f.service.setSdBrain(false);
  await f.service.send({ id, text: 'now rename it', context });
  const lastOrganiser = f.requests.filter(r => r.kind === 'organiser' && r.data.messages.at(-1).role === 'user').at(-1).data;
  assert.ok(!lastOrganiser.tools.some(tool => tool.function.name === 'mdlxl_capture'));
  assert.match(system(f.requests.filter(r => r.kind === 'worker').at(-1).data), /SD Brain: off/);
  assert.ok(!userText(f.requests.filter(r => r.kind === 'worker').at(-1).data).includes('SD art brief'));
});

test('a worker past half of its memory hands over to a new bird and retires', async t => {
  let turn = 0;
  const f = await setup(t, {
    organiser: data => (last(data).role === 'tool' ? say('ok') : ask(turn++ ? { worker: 'Crow', job: 'Spikes', instructions: 'Add spikes.' } : { job: 'Collars', instructions: 'Make collars.' })),
    worker: data => (data.tools ? say('Collar report') : say('Handover: collars done on geoset 4; user wants no spike inside.')),
  });
  const { id } = await f.service.organiser({ modelKey });
  await f.service.send({ id, text: 'make collars', context });
  const organiser = await f.service.conversation(id, 'compatible');
  organiser.workers[0].use = 0.6;
  await f.service.send({ id, text: 'now spikes on Crow', context });
  assert.deepEqual(
    organiser.workers.map(w => [w.name, w.status]),
    [
      ['Crow', 'retired'],
      ['Jackdaw', 'idle'],
    ],
  );
  // The handover ran without tools, and the new bird starts from its note.
  const workerRequests = f.requests.filter(r => r.kind === 'worker');
  assert.equal(workerRequests[1].data.tools, undefined);
  assert.match(userText(workerRequests[2].data), /Handover note from Crow, who worked on this before you:\nHandover: collars done/);
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
  assert.deepEqual(await f.service.saveState({ modelKey }), { activity: true, remember: 'ask' });
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
  assert.match(userText(f.requests.filter(r => r.kind === 'organiser' && r.data.tools).at(-2).data), /Memory note from earlier work on this model:\nMemory: garment separated/);

  const wiped = await f.service.cleanup({ modelKey, mode: 'wipe' });
  assert.equal(wiped.note, null);
  assert.equal((await f.service.organiser({ modelKey })).hasNote, false);
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
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlxl-ai-clean-'));
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
      if (userText(data).startsWith('Job: Job A')) await holdA;
      return say('Report: done');
    },
  });
  const a = await f.service.organiser({ modelKey: 'D:/Models/A.mdx', name: 'A.mdx' }),
    b = await f.service.organiser({ modelKey: 'D:/Models/B.mdx', name: 'B.mdx' });
  const on = documentId => ({ ...context, documentId });
  const jobA = f.service.send({ id: a.id, text: 'work on model A', context: on('A') });
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
  assert.equal(f.service.steer({ id: b.id, text: 'hello' }).queued, false);
  f.service.cancel(b.id);
  releaseA();
  assert.equal((await jobA).ok, true);
  assert.deepEqual(f.service.runningChats(), []);
  assert.equal(f.service.busy(), false);
});