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
async function setup(t, { organiser, worker, models = [] }) {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlxl-ai-offload-'));
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
  assert.match(userText(f.requests.filter(r => r.kind === 'worker').at(-1).data), /Memory note from earlier work on this model:\nMemory: garment separated/);

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
        assert.equal((await f.service.send({ id, text: 'Inspect this region; keep protected parts unchanged.', route: i === split ? 'new' : 'continue', context: { ...context, fixturePayload: 'x'.repeat(padding) }, images: i === 0 ? ['data:image/png;base64,YQ=='] : [] })).ok, true);
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
    assert.ok(totals[1].tokens <= totals[0].tokens, JSON.stringify(totals));
    if (count === 18) { assert.equal(totals[1].handovers, 1); assert.equal(totals[1].calls, count + 1); }
    else assert.equal(totals[1].calls, totals[0].calls);
    t.diagnostic(JSON.stringify({ messages: count, off: totals[0], on: totals[1] }));
  }
});

test('region scheduler overlaps independent birds, queues dependencies and structural work, routes steering and checks the combined result', async t => {
  const { regionsConflict } = await import('../src/ai-regions.js');
  for (const mode of ['parallel', 'dependent', 'structural']) {
    let running = 0, peak = 0, combined = 0;
    const starts = [], ends = [];
    const f = await setup(t, { organiser: () => assert.fail('No organiser recap'), worker: async data => {
      if (data.messages[0].content.startsWith('Route one message')) return say(JSON.stringify({jobs:[
        { job:'First mesh', scope:['/Geosets/0'] },
        { job:'Second mesh', scope:[mode==='dependent'?'/Geosets/0':'/Geosets/1'], structural:mode==='structural' },
      ]}));
      const first = userText(data).includes('Job: First mesh');
      starts.push(first?0:1); peak=Math.max(peak,++running);
      await new Promise(resolve=>setTimeout(resolve,50));
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
    assert.deepEqual(starts,[0,1]); assert.deepEqual(ends,[0,1]); assert.equal(combined,1);
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
