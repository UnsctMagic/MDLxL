import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { AI_SD_RULES, AI_SD_BRAIN } from '../src/ai-sd-rules.js';
import { AI_EDITING_HANDBOOK } from '../src/ai-tools.js';
const { AiService } = createRequire(import.meta.url)('../electron/ai-service.cjs');
const root = path.resolve(import.meta.dirname, '..');
const context = { target: 'selected', documentId: 'model', name: 'model.mdx', selection: { 0: [1, 2] } };
async function setup(t, respond) {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlxl-ai-workflow-'));
  t.after(() => fs.rm(profile, { recursive: true, force: true }));
  let requests = 0,
    edits = 0,
    phase = 'unchanged',
    fingerprint = 'before';
  const events = [],
    arts = [];
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
        const saved = JSON.parse(await fs.readFile(path.join(profile, 'ai/chat-test.json'), 'utf8'));
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
          assert.equal(phase, 'inspected');
          phase = 'verified';
        }
        return { changed: edits > 0, phase, summary: 'Checked the edited shape.' };
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
  assert.equal(entry.diary[0].outcome, 'verified');
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
