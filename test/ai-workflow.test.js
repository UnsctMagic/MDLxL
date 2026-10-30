import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import ownerTurns from './fixtures/ai-chat-loop-turns.json' with { type: 'json' };
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { AI_SD_RULES, AI_SD_BRAIN } from '../src/ai-sd-rules.js';
import { AI_EDITING_HANDBOOK, AI_WEB_RESEARCH } from '../src/ai-tools.js';
import { tempDir } from './helpers/fixtures.cjs';
const { AiService } = createRequire(import.meta.url)('../electron/ai-service.cjs');
const root = path.resolve(import.meta.dirname, '..');
const context = { target: 'selected', documentId: 'model', name: 'model.mdx', selection: { 0: [1, 2] } };
async function setup(t, respond) {
  const profile = tempDir('mdlxl-ai-workflow-');
  t.after(() => fs.rm(profile, { recursive: true, force: true }));
  let requests = 0,
    edits = 0,
    phase = 'unchanged',
    summary = 'Checked the edited shape.',
    fingerprint = 'before';
  const events = [],
    arts = [],
    checks = [],
    verdicts = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    const data = JSON.parse(body);
    // SD Brain's art director turn: answered with a fixed brief, outside the counts.
    if (String(data.messages?.find(m => m.role === 'system')?.content).includes('SD Brain art director')) {
      arts.push(data);
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end('data: ' + JSON.stringify({ choices: [{ delta: { content: 'Goal: an SD test brief.' }, finish_reason: 'stop' }] }) + '\n\n');
      return;
    }
    // The outside check: answered from a queue of verdicts (good by default), outside the counts.
    if (String(data.messages?.find(m => m.role === 'system')?.content).includes('independent reviewer')) {
      checks.push(data);
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end('data: ' + JSON.stringify({ choices: [{ delta: { content: JSON.stringify(verdicts.shift() || { verdict: 'good', confidence: 0.9, problems: [], strengths: ['matches the request'] }) }, finish_reason: 'stop' }] }) + '\n\n');
      return;
    }
    requests++;
    const answer = respond({ data, requests, edits, phase });
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end('data: ' + JSON.stringify({ choices: [answer] }) + '\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(
    () =>
      new Promise(resolve => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  const make = () => {
    const service = new AiService({ root, profile, electron: {}, getWindow: () => null, sdBrainAvailable: true });
    service.emit = event => events.push(event);
    service.call = async (name, args) => {
      if (name === 'mdlxl_checkpoint')
        return {
          fingerprint,
          path: 'D:/model.mdx',
          name: 'model.mdx',
          context,
          review: { changed: edits > 0, phase },
          ...(args.includeBaseline ? { baseline: { Geosets: [] } } : {}),
        };
      if (name === 'mdlxl_patch') {
        const saved = JSON.parse(await fs.readFile(service.chatFile([...service.conversations.values()].find(c => c.task?.steps.at(-1)?.status === 'pending').id), 'utf8'));
        assert.equal(saved.task.steps.at(-1).status, 'pending');
        assert.equal(saved.task.checkpoint.fingerprint, fingerprint);
        edits++;
        fingerprint = 'after';
        phase = 'pending';
        return { applied: true, changes: [{ path: '/Geosets/0/Vertices' }] };
      }
      if (name === 'mdlxl_review') {
        if (args.action === 'inspect') {
          phase = 'inspected';
          return {
            review: { passed: true },
            images: [{ label: 'after', image: 'data:image/png;base64,YQ==' }],
          };
        }
        if (args.action === 'finish') {
          assert.ok(args.acceptedByUser || phase === 'inspected');
          phase = args.outcome === 'blocked' ? 'blocked' : 'verified';
          if (args.outcome === 'blocked') summary = args.summary;
        }
        return { changed: edits > 0, phase, summary };
      }
      throw Error('Unexpected tool ' + name);
    };
    return service;
  };
  const service = make();
  await service.configure({
    provider: 'compatible',
    model: 'test',
    baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
  });
  return {
    service,
    make,
    events,
    arts,
    checks,
    verdicts,
    profile,
    counts: () => ({ requests, edits }),
    changeFingerprint: () => {
      fingerprint = 'user-edited';
    },
  };
}
const tool = (name, args) => ({
  delta: {
    tool_calls: [{ index: 0, id: 'call-' + name, function: { name, arguments: JSON.stringify(args) } }],
  },
  finish_reason: 'tool_calls',
});
const edit = () =>
  tool('mdlxl_patch', {
    target: 'selected',
    label: 'Move marked vertices',
    scope: ['/Geosets/0'],
    operations: [{ op: 'set', path: '/Geosets/0/Vertices/0', value: 2 }],
  });
const done = () => ({ delta: { content: 'Done.' }, finish_reason: 'stop' });
const plan = (extra = {}) =>
  tool('mdlxl_plan', {
    cause: 'The rim is a flat strip with no ornament.',
    reach: 'Only the rim ring of geoset 0.',
    keep: ['cup body', 'stem', 'UVs'],
    checks: ['The rim looks hammered in the matching views', 'Cup body, stem and UVs match the original'],
    options: [
      { fix: 'Reshape the rim ring', cost: 'Changes the rim silhouette only' },
      { fix: 'Add a separate ornament geoset', cost: 'More triangles' },
    ],
    choice: 0,
    why: 'Keeps the triangle count and every other part.',
    ...extra,
  });
test('an unverified edit cannot produce a success message and is checkpointed for Resume', async t => {
  const f = await setup(t, ({ requests }) => (requests === 1 ? edit() : done()));
  const result = await f.service.send({ id: 'test', text: 'Set the marked vertex to 2', context });
  assert.equal(result.ok, false);
  assert.match(result.error, /verification is incomplete/);
  assert.equal(f.counts().edits, 1);
  // The AI's words stream live, so its claim is shown, but the turn ends as a failure.
  assert.match((await f.service.conversation('test', 'compatible')).transcript.at(-1).error, /verification is incomplete/);
  assert.equal(f.events.at(-1).type, 'task');
  assert.equal(f.events.some(e => e.type === 'done'), false);
  const restarted = f.make(),
    task = await restarted.taskInfo('test');
  assert.equal(task.canResume, true);
  f.changeFingerprint();
  await assert.rejects(
    () => restarted.send({ id: 'test', context, resume: true }),
    /differs from this task checkpoint/,
  );
  assert.equal(f.counts().edits, 1);
});
test('a failed edit cannot be reported as success when the model is unchanged', async t => {
  const f = await setup(t, ({ requests }) => (requests === 1 ? edit() : done()));
  const originalCall = f.service.call;
  f.service.call = async (name, args, ...rest) => {
    if (name === 'mdlxl_patch') throw Error('The marked vertices changed before this edit.');
    return originalCall(name, args, ...rest);
  };
  const result = await f.service.send({ id: 'test', text: 'Set the marked vertex to 2', context });
  assert.equal(result.ok, false);
  assert.match(result.error, /marked vertices changed/);
  assert.equal(f.counts().edits, 0);
  assert.match((await f.service.conversation('test', 'compatible')).transcript.at(-1).error, /marked vertices changed/);
  assert.equal(f.events.some(e => e.type === 'done'), false);
  const task = await f.service.taskInfo('test');
  assert.equal(task.canResume, true);
  assert.equal(task.steps[0].status, 'failed');
});

test('look first: an edit is refused until the job has a plan, and the review gets its keep list', async t => {
  const toolMessages = [];
  let lastRequest;
  const f = await setup(t, ({ data, requests }) => {
    if (requests === 7) lastRequest = data;
    const last = data.messages.at(-1);
    if (last.role === 'tool') toolMessages.push(last.content);
    if (requests === 1) return edit();
    // One option is not a choice for a repair.
    if (requests === 2) return plan({ options: [{ fix: 'Reshape the rim ring', cost: 'rim only' }] });
    if (requests === 3) return plan({ choice: 5 });
    if (requests === 4) return plan();
    if (requests === 5) return edit();
    if (requests === 6) return tool('mdlxl_review', { target: 'selected', action: 'inspect', checksCode: 'return [{name:"rim",passed:true}]' });
    return done();
  });
  await f.service.send({ id: 'test', text: 'fix the rim so it looks hammered', context });
  assert.match(toolMessages[0], /Look first/);
  assert.equal(f.counts().edits, 1, 'only the edit made after the plan ran');
  assert.match(toolMessages[1], /at least two genuinely different fixes/);
  assert.match(toolMessages[2], /choice must be the index/);
  assert.match(toolMessages[3], /"recorded":true/);
  // The review result reminds the AI of the plan's keep list.
  const reviewed = lastRequest.messages.filter(m => m.role !== 'assistant').map(m => JSON.stringify(m.content)).join('');
  assert.ok(reviewed.includes('Confirm each keep item') && /cup body.*stem.*UVs/.test(reviewed));
  const task = (await f.service.conversation('test', 'compatible')).task;
  assert.equal(task.plan.options[task.plan.choice].fix, 'Reshape the rim ring');
  assert.equal(task.steps.length, 1, 'the refused edit left no step behind');
});

test('the decision diary keeps each job with the model, with the owner reaction, for the next job', async t => {
  const received = [];
  const f = await setup(t, ({ data, requests }) => {
    received.push(data);
    if (requests === 1) return plan();
    if (requests === 2) return edit();
    if (requests === 3) return tool('mdlxl_review', { target: 'selected', action: 'inspect', checksCode: 'return [{name:"rim",passed:true}]' });
    if (requests === 4) return tool('mdlxl_review', { target: 'selected', action: 'finish', outcome: 'passed', summary: 'Rim hammered.' });
    return done();
  });
  const conversation = await f.service.conversation('test', 'compatible');
  conversation.modelKey = 'file:d:\\model.mdx';
  assert.equal((await f.service.send({ id: 'test', text: 'fix the rim so it looks hammered', context })).ok, true);
  const entry = await f.service.registry.model('file:d:\\model.mdx');
  assert.equal(entry.diary.length, 1);
  assert.deepEqual(entry.diary[0].edits, ['Move marked vertices']);
  assert.equal(entry.diary[0].outcome, 'verified; outside check: good');
  assert.equal(entry.diary[0].plan.chosen, 'Reshape the rim ring');
  // The next message is the owner's reaction, and the next job reads it all.
  await f.service.send({ id: 'test', text: 'too shiny, and the rim lost its bevel', context });
  assert.equal(entry.diary[0].ownerNext, 'too shiny, and the rim lost its bevel');
  const prompt = JSON.stringify(received.at(-1).messages.filter(m => m.role === 'user').at(-1));
  assert.match(prompt, /Decision diary/);
  assert.match(prompt, /chose: Reshape the rim ring/);
  assert.match(prompt, /the owner then said: \\"too shiny/);
  // Wiping the chats after a save removes the diary too; a summary keeps it.
  await f.service.cleanup({ modelKey: 'file:d:\\model.mdx', mode: 'wipe' });
  assert.equal((await f.service.registry.model('file:d:\\model.mdx')).diary, undefined);
});

test('the outside check judges a finished edit from the request and pictures only, and sends doubt back', async t => {
  const toolMessages = [];
  let round = 0;
  const f = await setup(t, ({ data }) => {
    const last = data.messages.at(-1);
    if (last.role === 'tool') toolMessages.push(last.content);
    round++;
    if (round === 1) return plan();
    if (round === 2) return { delta: { content: 'My private reasoning: the rim is fine. ', tool_calls: edit().delta.tool_calls }, finish_reason: 'tool_calls' };
    if (round === 3 || round === 5) return tool('mdlxl_review', { target: 'selected', action: 'inspect', checksCode: 'return [{name:"rim",passed:true}]' });
    if (round === 4 || round === 6) return tool('mdlxl_review', { target: 'selected', action: 'finish', outcome: 'passed', summary: 'Rim hammered.' });
    return done();
  });
  f.verdicts.push({ verdict: 'doubtful', confidence: 0.6, problems: ['the rim reads as smooth in the after picture'], strengths: [] });
  assert.equal((await f.service.send({ id: 'test', text: 'fix the rim so it looks hammered', context })).ok, true);
  assert.equal(f.checks.length, 2, 'judged once, sent back, judged again');
  assert.match(toolMessages.find(m => /Outside check/.test(m)), /says doubtful: the rim reads as smooth in the after picture/);
  const judged = JSON.stringify(f.checks[0].messages);
  assert.match(judged, /fix the rim so it looks hammered/);
  assert.match(judged, /promised to keep: cup body; stem; UVs/);
  assert.match(judged, /data:image\/png;base64/, 'the judge gets the pictures');
  assert.ok(!judged.includes('My private reasoning'), "the judge never sees the worker's reasoning");
  const task = (await f.service.conversation('test', 'compatible')).task;
  assert.equal(task.phase, 'verified');
  assert.equal(task.outsideCheck.verdict, 'good');
  assert.ok(f.events.some(e => e.type === 'notice' && /Outside check: doubtful \(confidence 60%\)/.test(e.text)));
  // Each verdict stays in the chat as a step: a cross for doubt, a tick for good.
  const steps = f.events.filter(e => e.type === 'tool-result' && e.name === 'outside_check');
  assert.deepEqual(steps.map(e => e.error), [true, false]);
  assert.match(steps[0].summary, /the rim reads as smooth/);
  const saved = (await f.service.conversation('test', 'compatible')).transcript.flatMap(entry => entry.parts || []);
  assert.equal(saved.filter(p => p.type === 'tool' && p.name === 'outside_check').length, 2, 'the steps are kept in the transcript');
});

test('visible outside-check concerns remain correctable without a forced blocked round', async t => {
  let round = 0;
  const f = await setup(t, () => {
    round++;
    if (round === 1) return plan();
    if (round === 2) return edit();
    if (round % 2 === 1 && round < 11) return tool('mdlxl_review', { target: 'selected', action: 'inspect', checksCode: 'return []' });
    if (round < 11) return tool('mdlxl_review', { target: 'selected', action: 'finish', outcome: 'passed', summary: 'Rim hammered.' });
    return done();
  });
  for (let i = 0; i < 3; i++) f.verdicts.push({ verdict: 'wrong', confidence: 0.8, problems: ['a visible gap at the rim in picture 1'], strengths: [] });
  const result = await f.service.send({ id: 'test', text: 'fix the rim so it looks hammered', context });
  assert.equal(result.ok, true);
  assert.equal(f.checks.length, 4);
  assert.equal((await f.service.conversation('test', 'compatible')).task.phase, 'verified');
});

test('the outside check can be switched off in connection settings', async t => {
  const f = await setup(t, ({ requests }) =>
    requests === 1 ? edit() : requests === 2 ? tool('mdlxl_review', { target: 'selected', action: 'inspect', checksCode: 'return []' }) : requests === 3 ? tool('mdlxl_review', { target: 'selected', action: 'finish', outcome: 'passed', summary: 'ok' }) : done(),
  );
  assert.equal((await f.service.status()).outsideCheck, true, 'on by default');
  const settings = await f.service.status();
  await f.service.configure({ provider: 'compatible', model: 'test', baseUrl: settings.baseUrl, outsideCheck: false });
  assert.equal((await f.service.status()).outsideCheck, false);
  assert.equal((await f.service.send({ id: 'test', text: 'Set the marked vertex to 2', context })).ok, true);
  assert.equal(f.checks.length, 0, 'no extra AI call while it is off');
});

test('with the handbook on, a job carries the guides its request touches; effort defaults to high', async t => {
  const received = [],
    read = [];
  const f = await setup(t, ({ data }) => {
    received.push(data);
    return done();
  });
  const call = f.service.call;
  f.service.call = async (name, args, ...rest) => {
    if (name === 'mdlxl_help') {
      read.push(args.topic);
      return { topic: args.topic, text: 'GUIDE ' + args.topic };
    }
    return call(name, args, ...rest);
  };
  assert.equal((await f.service.status()).effort, 'high');
  await f.service.send({ id: 'test', text: 'the legs clip into the skirt during the walk; fix the binding', context });
  assert.deepEqual(read, [], 'no guides while the handbook is off');
  await f.service.setEditingHandbook(true);
  await f.service.send({ id: 'test', text: 'the legs clip into the skirt during the walk; fix the binding', context });
  assert.deepEqual(read, ['WC3-EDITING-NODES-BINDING.md', 'WC3-EDITING-ANIMATION.md']);
  const prompt = JSON.stringify(received.at(-1).messages.filter(m => m.role === 'user').at(-1));
  assert.match(prompt, /Editing guide for this job \(WC3-EDITING-NODES-BINDING.md\)/);
  assert.match(prompt, /GUIDE WC3-EDITING-ANIMATION.md/);
});

test('an exact value edit needs no plan, and the AI doing the work is offered the plan tool', async t => {
  const seen = [];
  const f = await setup(t, ({ data, requests }) => {
    seen.push(data.tools?.map(tool => tool.function.name) || []);
    return requests === 1 ? edit() : done();
  });
  await f.service.send({ id: 'test', text: 'Set the marked vertex to 2', context });
  assert.equal(f.counts().edits, 1);
  assert.ok(seen[0].includes('mdlxl_plan'), 'the AI doing the work is offered the plan tool');
});

test('verified completion requires measured review before finish and removes the temporary baseline', async t => {
  const f = await setup(t, ({ requests }) =>
    requests === 1
      ? edit()
      : requests === 2
        ? tool('mdlxl_review', {
            target: 'selected',
            action: 'inspect',
            checksCode: 'return [{name:"position",passed:true}]',
          })
        : requests === 3
          ? tool('mdlxl_review', {
              target: 'selected',
              action: 'finish',
              outcome: 'passed',
              summary: 'The shape matches.',
            })
          : done(),
  );
  assert.equal((await f.service.send({ id: 'test', text: 'Set the marked vertex to 2', context })).ok, true);
  assert.equal((await f.service.taskInfo('test')).phase, 'verified');
  assert.equal(
    f.events
      .filter(e => e.type === 'text')
      .map(e => e.text)
      .join(''),
    'Done.',
  );
  const saved = JSON.parse(await fs.readFile(path.join(f.profile, 'ai/chat-test.json'), 'utf8'));
  assert.equal(saved.task.baseline, undefined);
  assert.equal(saved.task.steps[0].status, 'applied');
});
test('Resume after a service restart inspects the checkpoint without repeating an applied edit', async t => {
  let resume = false;
  const f = await setup(t, ({ requests, phase }) =>
    !resume
      ? requests === 1
        ? edit()
        : done()
      : phase === 'pending'
        ? tool('mdlxl_review', {
            target: 'selected',
            action: 'inspect',
            checksCode: 'return [{name:"position",passed:true}]',
          })
        : phase === 'inspected'
          ? tool('mdlxl_review', {
              target: 'selected',
              action: 'finish',
              outcome: 'passed',
              summary: 'Checked after resuming.',
            })
          : done(),
  );
  await f.service.send({ id: 'test', text: 'Set the marked vertex to 2', context });
  resume = true;
  const restarted = f.make();
  assert.equal((await restarted.send({ id: 'test', context, resume: true })).ok, true);
  assert.equal(f.counts().edits, 1);
  assert.equal((await restarted.taskInfo('test')).canResume, false);
});

test('a message sent mid-task steers the running turn and streams live in order', async t => {
  let seen;
  const f = await setup(t, ({ data, requests }) => {
    if (requests === 1) return tool('mdlxl_review', { target: 'selected', action: 'status' });
    seen = data.messages.filter(m => m.role === 'user').at(-1);
    return { delta: { reasoning_content: 'The user wants it wider.', content: 'Adjusted.' }, finish_reason: 'stop' };
  });
  const call = f.service.call;
  f.service.call = async (name, args, ...rest) => {
    if (name === 'mdlxl_review' && args.action === 'status' && !f.events.some(e => e.type === 'steer'))
      assert.deepEqual(await f.service.steer({ id: 'test', text: 'Make it wider', annotations: { strokes: [] } }), {
        queued: true,
      });
    return call(name, args, ...rest);
  };
  assert.equal((await f.service.send({ id: 'test', text: 'Shape this', context })).ok, true);
  assert.match(seen.content, /steering for the current task:\nMake it wider/);
  assert.match(seen.content, /Current console drawings/);
  const order = f.events.map(e => e.type).filter(type => ['tool', 'steer', 'thinking', 'text', 'done'].includes(type));
  assert.deepEqual(order, ['tool', 'steer', 'thinking', 'text', 'done']);
  const transcript = (await f.service.conversation('test', 'compatible')).transcript;
  assert.deepEqual(
    transcript.map(entry => entry.role + (entry.steer ? ':steer' : '')),
    ['user', 'assistant', 'user:steer', 'assistant'],
  );
  assert.equal(transcript[1].parts[0].status, 'done');
  assert.deepEqual(
    transcript[3].parts.map(part => part.type),
    ['thinking', 'text'],
  );
  assert.deepEqual(await f.service.steer({ id: 'test', text: 'Too late' }), { queued: false });
});

test('SD Brain is off until switched on, then every turn of the next task carries the policy', async t => {
  const received = [];
  const f = await setup(t, ({ data }) => {
    received.push(data);
    return done();
  });
  // Off by default: only an authoritative off state, no SD art direction.
  assert.equal((await f.service.status()).sdBrain, false);
  assert.equal((await f.service.send({ id: 'test', text: 'Explain the SD modeling constraints', context })).ok, true);
  let system = received.at(-1).messages.find(message => message.role === 'system').content;
  assert.match(system, /SD Brain: off \(policy /);
  assert.ok(!system.includes(AI_SD_RULES) && !system.includes(AI_SD_BRAIN));
  let user = received.at(-1).messages.find(message => message.role === 'user').content[0].text;
  assert.match(user, /Task settings: SD Brain off/);
  assert.ok(user.includes(JSON.stringify(context)));
  assert.deepEqual(f.counts(), { requests: 1, edits: 0 });
  // Switching it on starts nothing, and the next task gets the full policy and rulebook.
  await f.service.setSdBrain(true);
  assert.equal(f.counts().requests, 1);
  assert.equal((await f.service.status()).sdBrain, true);
  await f.service.send({ id: 'test', text: 'make a chalice of power', context });
  system = received.at(-1).messages.find(message => message.role === 'system').content;
  assert.ok(system.includes(AI_SD_BRAIN) && system.includes(AI_SD_RULES));
  user = received.at(-1).messages.filter(message => message.role === 'user').at(-1).content[0].text;
  assert.match(user, /^make a chalice of power\n/);
  // The request went through the art director first, and its brief travels with the prompt.
  assert.equal(f.arts.length, 1);
  assert.match(f.arts[0].messages.find(message => message.role === 'user').content[0].text, /make a chalice of power/);
  assert.match(user, /SD art brief for this request[^\n]*\nGoal: an SD test brief\./);
  assert.match(user, /Task settings: SD Brain on \(policy /);
  // Off again: the old "on" in this conversation's history no longer applies.
  await f.service.setSdBrain(false);
  await f.service.send({ id: 'test', text: 'rename the geoset', context });
  system = received.at(-1).messages.find(message => message.role === 'system').content;
  assert.ok(!system.includes(AI_SD_BRAIN));
  assert.match(system, /SD Brain is off for this task\. Instructions from earlier turns about SD Brain/);
  assert.equal(f.arts.length, 1, 'no art direction while SD Brain is off');
  const guide = (await fs.readFile(path.join(root, 'docs/AI-SD-RULEBOOK.md'), 'utf8')).replace(/\r\n/g, '\n');
  assert.ok(guide.includes(AI_SD_RULES), 'the standalone rulebook matches the supplied instructions');
});

test('the editing handbook is off until switched on, then the next task carries it', async t => {
  const received = [];
  const f = await setup(t, ({ data }) => {
    received.push(data);
    return done();
  });
  const system = () => received.at(-1).messages.find(message => message.role === 'system').content;
  // Off by default: the instructions carry no handbook and no map to its guides.
  assert.equal((await f.service.status()).editingHandbook, false);
  await f.service.send({ id: 'test', text: 'rename the geoset', context });
  assert.ok(!system().includes(AI_EDITING_HANDBOOK) && !system().includes('WC3-EDITING-'));
  // Switching it on starts nothing; the next task gets the handbook, and the choice is saved.
  await f.service.setEditingHandbook(true);
  assert.equal(f.counts().requests, 1);
  assert.equal((await f.service.status()).editingHandbook, true);
  assert.equal((await f.make().status()).editingHandbook, true, 'remembered after a restart');
  await f.service.send({ id: 'test', text: 'blend the joint', context });
  assert.ok(system().includes(AI_EDITING_HANDBOOK));
  // Off again: the next task is back to the plain instructions.
  await f.service.setEditingHandbook(false);
  await f.service.send({ id: 'test', text: 'rename the material', context });
  assert.ok(!system().includes(AI_EDITING_HANDBOOK));
  await assert.rejects(() => f.service.setEditingHandbook('yes'), /Choose on or off/);
});

test('web research is off until switched on, then the next task may look things up', async t => {
  const received = [];
  const f = await setup(t, ({ data }) => {
    received.push(data);
    return done();
  });
  const system = () => received.at(-1).messages.find(message => message.role === 'system').content;
  assert.equal((await f.service.status()).webResearch, false);
  await f.service.send({ id: 'test', text: 'rename the geoset', context });
  assert.ok(!system().includes(AI_WEB_RESEARCH));
  // Switching it on starts nothing; the next task is told it can research, and the choice is saved.
  await f.service.setWebResearch(true);
  assert.equal(f.counts().requests, 1);
  assert.equal((await f.make().status()).webResearch, true, 'remembered after a restart');
  await f.service.send({ id: 'test', text: 'how do Blizzard skirts bind?', context });
  assert.ok(system().includes(AI_WEB_RESEARCH));
  await f.service.setWebResearch(false);
  await f.service.send({ id: 'test', text: 'rename the material', context });
  assert.ok(!system().includes(AI_WEB_RESEARCH));
  await assert.rejects(() => f.service.setWebResearch('yes'), /Choose on or off/);
});

test('SD Brain is parked: no switch, no art director and nothing about it in prompts', async t => {
  const received = [];
  const f = await setup(t, ({ data }) => {
    received.push(data);
    return done();
  });
  const service = f.make();
  service.sdBrainOverride = undefined;
  await service.configure({ provider: 'compatible', model: 'test', baseUrl: (await f.service.settings()).baseUrl });
  const status = await service.status();
  assert.equal(status.sdBrainAvailable, false);
  assert.equal(status.sdBrain, false);
  await assert.rejects(() => service.setSdBrain(true), /not available/);
  assert.equal((await service.send({ id: 'parked', text: 'make a chalice of power', context })).ok, true);
  const system = received.at(-1).messages.find(message => message.role === 'system').content,
    user = received.at(-1).messages.filter(message => message.role === 'user').at(-1).content[0].text;
  assert.ok(!/SD Brain|Warcraft III SD modeling rulebook/.test(system), 'no SD Brain text in the instructions');
  assert.ok(!/SD Brain|SD art brief/.test(user), 'no SD Brain text in the prompt');
  assert.equal(f.arts.length, 0, 'no art direction turn');
});

test('a failed art direction is shown with its reason and the task still runs', async t => {
  const received = [];
  const f = await setup(t, ({ data }) => {
    received.push(data);
    return done();
  });
  f.service.artDirection = async () => {
    throw Error('The provider refused the art turn.');
  };
  await f.service.setSdBrain(true);
  assert.equal((await f.service.send({ id: 'test', text: 'make a hat', context })).ok, true);
  assert.ok(f.events.some(e => e.type === 'art' && e.status === 'error' && /refused the art turn/.test(e.text)));
  const user = received.at(-1).messages.filter(message => message.role === 'user').at(-1).content[0].text;
  assert.ok(!user.includes('SD art brief'));
  const part = (await f.service.conversation('test', 'compatible')).transcript.flatMap(m => m.parts || []).find(p => p.type === 'art');
  assert.equal(part.status, 'error');
});

test('the model can change while the AI works; the running task keeps its model', async t => {
  const models = [];
  const f = await setup(t, ({ data, requests }) => {
    models.push(data.model);
    return requests === 1 ? tool('mdlxl_review', { target: 'selected', action: 'status' }) : done();
  });
  const call = f.service.call;
  f.service.call = async (name, args, ...rest) => {
    if (name === 'mdlxl_review' && args.action === 'status' && models.length === 1) await f.service.setModel('bigger-model');
    return call(name, args, ...rest);
  };
  await f.service.send({ id: 'test', text: 'check it', context });
  assert.deepEqual(models, ['test', 'test']);
  assert.equal((await f.service.status()).model, 'bigger-model');
  await f.service.send({ id: 'test', text: 'next', context });
  assert.equal(models.at(-1), 'bigger-model');
});

test('toggling SD Brain during a task keeps that task on the policy it started with', async t => {
  const systems = [];
  const f = await setup(t, ({ data, requests }) => {
    systems.push(data.messages.find(message => message.role === 'system').content);
    return requests === 1 ? tool('mdlxl_review', { target: 'selected', action: 'status' }) : done();
  });
  const call = f.service.call;
  f.service.call = async (name, args, ...rest) => {
    if (name === 'mdlxl_review' && args.action === 'status' && systems.length === 1) await f.service.setSdBrain(true);
    return call(name, args, ...rest);
  };
  await f.service.send({ id: 'test', text: 'check it', context });
  assert.equal(systems.length, 2);
  assert.ok(systems.every(system => /SD Brain: off/.test(system)));
  assert.equal((await f.service.conversation('test', 'compatible')).task.sdBrain.enabled, false);
  await f.service.send({ id: 'test', text: 'next', context });
  assert.match(systems.at(-1), /SD Brain: on/);
});

test('with SD Brain on, a passed review needs a verdict per criterion and repeated failures stop', async t => {
  const criteria = ['fidelity', 'silhouette', 'sd-identity', 'coherence', 'craftsmanship', 'detail-value', 'motion', 'preservation'].map(
    name => ({ name, result: name === 'motion' ? 'not-applicable' : 'passed', observation: name === 'motion' ? '' : 'checked ' + name }),
  );
  const toolErrors = [];
  const f = await setup(t, ({ data, requests }) => {
    const last = data.messages.at(-1);
    if (last.role === 'tool' && /SD Brain review/.test(last.content)) toolErrors.push(last.content);
    if (requests === 1) return plan();
    if (requests === 2) return edit();
    if (requests === 3)
      return tool('mdlxl_review', { target: 'selected', action: 'inspect', checksCode: 'return [{name:"moved",passed:true}]' });
    if (requests === 4) return tool('mdlxl_review', { target: 'selected', action: 'finish', outcome: 'passed', summary: 'Looks good.' });
    if (requests === 5)
      return tool('mdlxl_review', { target: 'selected', action: 'finish', outcome: 'passed', summary: 'Rim clutter.', criteria: criteria.map(c => (c.name === 'detail-value' ? { ...c, result: 'needs-correction', observation: 'rim ornament merges into a bright strip' } : c)) });
    if (requests === 6) return tool('mdlxl_review', { target: 'selected', action: 'finish', outcome: 'passed', summary: 'Chalice reads clearly.', criteria });
    return done();
  });
  const call = f.service.call,
    inspects = [];
  f.service.call = async (name, args, ...rest) => {
    if (name === 'mdlxl_review' && args.action === 'inspect') inspects.push(args);
    return call(name, args, ...rest);
  };
  await f.service.setSdBrain(true);
  assert.equal((await f.service.send({ id: 'test', text: 'make a chalice of power', context })).ok, true);
  // The review always shows the result from every side.
  assert.equal(inspects[0].turnaround, true);
  assert.match(toolErrors[0], /add criteria for fidelity, silhouette/);
  assert.match(toolErrors[1], /detail-value needs correction/);
  const task = (await f.service.conversation('test', 'compatible')).task;
  assert.equal(task.phase, 'verified');
  assert.deepEqual(task.criteria.map(c => c.result), ['passed', 'passed', 'passed', 'passed', 'passed', 'passed', 'not-applicable', 'passed']);

  // The same criterion failing three times ends blind revisions.
  let round = 0;
  const g = await setup(t, ({ data }) => {
    const last = data.messages.at(-1);
    if (last.role === 'tool' && /failed three times/.test(last.content)) return done();
    round++;
    if (round === 1) return plan();
    if (round === 2) return edit();
    return tool('mdlxl_review', { target: 'selected', action: 'finish', outcome: 'needs-correction', summary: 'Still cluttered.', criteria: [{ name: 'detail-value', result: 'needs-correction', observation: 'still cluttered' }] });
  });
  await g.service.setSdBrain(true);
  const stopped = await g.service.send({ id: 'test', text: 'fix the rim', context });
  // From the third failure on, more revisions are refused and the task cannot pass.
  assert.equal(stopped.ok, false);
  assert.ok((await g.service.conversation('test', 'compatible')).task.corrections['detail-value'] >= 3);
  assert.ok(g.events.some(e => e.type === 'tool-result' && /failed three times/.test(e.summary || '')));
});

test('two measured failures require a different plan before a third edit', async t=>{
  const errors=[]; let edits=0, phase='unchanged', inspections=0;
  const f=await setup(t,({data,requests})=>{
    if(lastMessage(data)?.role==='tool')errors.push(lastMessage(data).content);
    if(requests===1)return plan();
    if([2,4,6,9].includes(requests))return edit();
    if([3,5,10].includes(requests))return tool('mdlxl_review',{target:'selected',action:'inspect',checksCode:'return [{name:"rim contact",passed:false}];'});
    if(requests===7)return plan();
    if(requests===8)return plan({cause:'Measured contact is caused by the neighboring ring, not the rim strip.',choice:1});
    if(requests===11)return tool('mdlxl_review',{target:'selected',action:'finish',outcome:'passed',summary:'Measured contact cleared.'});
    return done();
  });
  function lastMessage(data){return data.messages.at(-1);}
  f.service.call=async(name,args)=>{
    if(name==='mdlxl_checkpoint')return {fingerprint:'rev'+edits,context,review:{changed:edits>0,phase},...(args.includeBaseline?{baseline:{Info:{Name:'original'}}}:{})};
    if(name==='mdlxl_patch'){edits++;phase='pending';return {applied:true,changes:[]};}
    if(name==='mdlxl_review'){
      if(args.action==='inspect'){inspections++;phase='inspected';return {review:{checks:[{name:'rim contact',passed:inspections>2}],passed:inspections>2},images:[]};}
      if(args.action==='finish')phase='verified';
      return {changed:edits>0,phase};
    }
    assert.fail(name);
  };
  const result=await f.service.send({id:'test',text:'Fix the rim contact while preserving the rest',context});
  assert.equal(result.ok,true,JSON.stringify(result)); assert.equal(edits,3,'third blind edit was refused; the changed plan allowed one new edit');
  assert.ok(errors.some(s=>/same check failed twice/.test(s))); assert.ok(errors.some(s=>/materially different plan/.test(s)));
  const task=(await f.service.readConversation('test')).task; assert.equal(task.replanRequired,undefined); assert.equal(task.phase,'verified');
});

test('embedded routines reuse bodies with parameters and remain isolated from other jobs',async t=>{
  const {expandRoutine}=createRequire(import.meta.url)('../electron/ai-job-plan.cjs');
  const task={}; const code='return parameters.value + 1;';
  const first=expandRoutine(task,'mdlxl_script',{routine:'measure',code,parameters:{value:3}});
  const second=expandRoutine(task,'mdlxl_script',{routine:'measure',parameters:{value:8}});
  const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
  assert.equal(await new AsyncFunction(first.code)(),4);assert.equal(await new AsyncFunction(second.code)(),9);
  assert.throws(()=>expandRoutine({},'mdlxl_script',{routine:'measure'}),/No saved/);
  assert.throws(()=>expandRoutine(task,'mdlxl_review',{action:'inspect',routine:'measure'}),/No saved/);
  assert.deepEqual(task.routines.measure,{tool:'mdlxl_script',code});
  const restored=JSON.parse(JSON.stringify(task)); assert.match(expandRoutine(restored,'mdlxl_script',{routine:'measure'}).code,/parameters.value/);
  assert.ok(JSON.stringify({routine:'measure',parameters:{value:8}}).length < JSON.stringify({routine:'measure',code:code.repeat(100),parameters:{value:8}}).length);
});


test('owner replay: outside check receives references, baseline and wireframe pairs inside its picture budget', async t => {
  const image = n => 'data:image/png;base64,' + Buffer.from(n).toString('base64');
  const reference = image('reference'), baseline = image('baseline'), wire = image('wire-before'), after = image('after'), wireAfter = image('wire-after');
  const actions = [
    plan(),
    tool('mdlxl_capture', { target: 'selected', samples: [{ view: 'front' }] }),
    edit(),
    tool('mdlxl_capture', { target: 'selected', samples: [{ view: 'front' }] }),
    tool('mdlxl_review', { target: 'selected', action: 'inspect', checksCode: 'return []' }),
    tool('mdlxl_review', { target: 'selected', action: 'finish', outcome: 'passed', summary: 'Compared the weld pattern.' }),
  ];
  const f = await setup(t, () => actions.shift() || done());
  const original = f.service.call;
  let captures = 0;
  f.service.call = async (name, args, ...rest) => {
    if (name === 'mdlxl_capture') return { images: [{ label: 'front wireframe', image: captures++ ? wireAfter : wire }] };
    const result = await original(name, args, ...rest);
    if (name === 'mdlxl_review' && args.action === 'inspect') result.images = [
      { role: 'original', group: 'still', label: 'Baseline before the task', image: baseline },
      { role: 'edited', group: 'still', label: 'Edited target', image: after },
      ...Array.from({ length: 14 }, (_, n) => ({ role: 'edited', group: 'side ' + n, label: 'side ' + n, image: image('side ' + n) })),
    ];
    return result;
  };
  assert.equal((await f.service.send({ id: 'test', text: ownerTurns.turns['27'].text, images: [reference], context })).ok, true);
  const packet = f.checks[0].messages.at(-1).content;
  const pictures = packet.filter(p => p.type === 'image_url').map(p => p.image_url.url);
  assert.ok(pictures.length <= 12);
  for (const required of [reference, baseline, after, wire, wireAfter]) assert.ok(pictures.includes(required), 'missing ' + required);
  assert.match(JSON.stringify(packet), /User reference|Owner reference/);
});

test('owner replay: absent comparison evidence is a note and does not block finish or require Resume', async t => {
  const actions = [edit(), tool('mdlxl_review', { target: 'selected', action: 'inspect', checksCode: 'return []' }), tool('mdlxl_review', { target: 'selected', action: 'finish', outcome: 'passed', summary: 'Welds applied.' })];
  const f = await setup(t, () => actions.shift() || done());
  f.verdicts.push({ verdict: 'doubtful', confidence: 0.4, problems: [], notes: [ownerTurns.turns['32'].text], strengths: [] });
  assert.equal((await f.service.send({ id: 'test', text: 'Set the marked vertex to 2', context })).ok, true);
  const task = (await f.service.conversation('test', 'compatible')).task;
  assert.equal(task.status, 'complete');
  assert.ok(f.events.some(e => e.type === 'notice' && /baseline.*wireframe/.test(e.text)));
  assert.match(f.checks[0].messages[0].content, /missing.*notes|notes.*missing/i);
});


for (const offload of [false, true]) test(`owner replay: explicit delivery completes the kept result without another provider call (${offload ? 'offload' : 'direct'})`, async t => {
  const actions = [plan(), edit(), tool('mdlxl_review', { target: 'selected', action: 'inspect', checksCode: 'return []' }), tool('mdlxl_review', { target: 'selected', action: 'finish', outcome: 'blocked', summary: 'The picture packet omits baseline and wireframe.' })];
  const f = await setup(t, () => actions.shift() || done());
  const id = offload ? (await f.service.organiser({ modelKey: 'file:fixture.mdx' })).id : 'test';
  assert.equal((await f.service.send({ id, text: ownerTurns.turns['27'].text, context })).ok, false);
  const owner = await f.service.conversation(id, 'compatible');
  const bird = offload ? await f.service.conversation(owner.currentWorker, 'compatible') : owner;
  bird.task.outsideCheck = { verdict: 'doubtful', problems: ['wireframe not available'], notes: ['No source file has been saved.'] };
  const before = f.counts();
  assert.equal(before.edits, 1);
  assert.equal((await f.service.send({ id, text: ownerTurns.turns['33'].text, context })).ok, true);
  assert.deepEqual(f.counts(), before, 'acceptance performs no edit and makes no provider request');
  assert.equal(owner.task.status, 'complete');
  assert.equal(bird.task.status, 'complete');
  assert.equal(bird.task.phase, 'verified');
  assert.equal(bird.task.acceptedByUser, true);
  assert.match(owner.transcript.at(-1).text, /accepted|accepting/i);
  assert.match(owner.transcript.at(-1).text, /wireframe/);
  assert.equal((await f.service.taskInfo(id)).canResume, false);
});


test('delivery sent while working accepts the result and keeps the outside concern as a note', async t => {
  let f, steered;
  const actions = [edit(), tool('mdlxl_review', { target: 'selected', action: 'inspect', checksCode: 'return []' })];
  f = await setup(t, () => {
    if (actions.length) return actions.shift();
    if (!steered) {
      f.service.conversations.get('test').task.outsideCheck = { problems: ['wireframe missing'], notes: [] };
      steered = f.service.steer({ id: 'test', text: 'deliver anyway' });
    }
    return done();
  });
  assert.equal((await f.service.send({ id: 'test', text: 'Set the marked vertex to 2', context })).ok, true);
  await steered;
  assert.equal((await f.service.taskInfo('test')).status, 'complete');
  assert.match((await f.service.conversation('test', 'compatible')).transcript.at(-1).text, /Note: wireframe missing/);
});

test('negated and conditional delivery wording leaves an incomplete task for the provider', async t => {
  const f = await setup(t, () => done());
  const conversation = await f.service.conversation('test', 'compatible');
  conversation.task = { status: 'incomplete', checkpoint: { review: { changed: true } } };
  for (const text of ["don't deliver it", 'deliver it after checking the bottom', 'if it passes, deliver it', '"deliver anyway" was the bad reply']) {
    assert.equal(await f.service.acceptDelivery({ conversation, text, context }), false, text);
    assert.equal(conversation.task.status, 'incomplete');
  }
});


test('accepting the current result also works with the New job route selected', async t => {
  const f = await setup(t, () => { throw Error('Acceptance does not need a provider'); });
  for (const text of ['accept current result', 'I accept this result', 'deliver it anyway']) {
    const conversation = await f.service.conversation('test', 'compatible');
    conversation.task = { status: 'incomplete', checkpoint: { review: { changed: true } } };
    assert.equal((await f.service.send({ id: 'test', text, context, route: 'new' })).ok, true, text);
    assert.equal(conversation.task.status, 'complete');
  }
});
