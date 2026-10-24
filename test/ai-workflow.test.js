import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { AI_SD_RULES, AI_SD_BRAIN } from '../src/ai-sd-rules.js';
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
  const events = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    const data = JSON.parse(body);
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
    const service = new AiService({ root, profile, electron: {}, getWindow: () => null });
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
test('an unverified edit cannot produce a success message and is checkpointed for Resume', async t => {
  const f = await setup(t, ({ requests }) => (requests === 1 ? edit() : done()));
  const result = await f.service.send({ id: 'test', text: 'Move these', context });
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
  const result = await f.service.send({ id: 'test', text: 'Move these', context });
  assert.equal(result.ok, false);
  assert.match(result.error, /marked vertices changed/);
  assert.equal(f.counts().edits, 0);
  assert.match((await f.service.conversation('test', 'compatible')).transcript.at(-1).error, /marked vertices changed/);
  assert.equal(f.events.some(e => e.type === 'done'), false);
  const task = await f.service.taskInfo('test');
  assert.equal(task.canResume, true);
  assert.equal(task.steps[0].status, 'failed');
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
  assert.equal((await f.service.send({ id: 'test', text: 'Move these', context })).ok, true);
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
  await f.service.send({ id: 'test', text: 'Move these', context });
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
      assert.deepEqual(f.service.steer({ id: 'test', text: 'Make it wider', annotations: { strokes: [] } }), {
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
  assert.deepEqual(f.service.steer({ id: 'test', text: 'Too late' }), { queued: false });
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
  assert.match(system, /chalice of power/);
  user = received.at(-1).messages.filter(message => message.role === 'user').at(-1).content[0].text;
  assert.match(user, /^make a chalice of power\n/);
  assert.match(user, /Task settings: SD Brain on \(policy /);
  // Off again: the old "on" in this conversation's history no longer applies.
  await f.service.setSdBrain(false);
  await f.service.send({ id: 'test', text: 'rename the geoset', context });
  system = received.at(-1).messages.find(message => message.role === 'system').content;
  assert.ok(!system.includes(AI_SD_BRAIN));
  assert.match(system, /SD Brain is off for this task\. Instructions from earlier turns about SD Brain/);
  const guide = (await fs.readFile(path.join(root, 'docs/AI-SD-RULEBOOK.md'), 'utf8')).replace(/\r\n/g, '\n');
  assert.ok(guide.includes(AI_SD_RULES), 'the standalone rulebook matches the supplied instructions');
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
    if (requests === 1) return edit();
    if (requests === 2)
      return tool('mdlxl_review', { target: 'selected', action: 'inspect', checksCode: 'return [{name:"moved",passed:true}]' });
    if (requests === 3) return tool('mdlxl_review', { target: 'selected', action: 'finish', outcome: 'passed', summary: 'Looks good.' });
    if (requests === 4)
      return tool('mdlxl_review', { target: 'selected', action: 'finish', outcome: 'passed', summary: 'Rim clutter.', criteria: criteria.map(c => (c.name === 'detail-value' ? { ...c, result: 'needs-correction', observation: 'rim ornament merges into a bright strip' } : c)) });
    if (requests === 5) return tool('mdlxl_review', { target: 'selected', action: 'finish', outcome: 'passed', summary: 'Chalice reads clearly.', criteria });
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
    if (round === 1) return edit();
    return tool('mdlxl_review', { target: 'selected', action: 'finish', outcome: 'needs-correction', summary: 'Still cluttered.', criteria: [{ name: 'detail-value', result: 'needs-correction', observation: 'still cluttered' }] });
  });
  await g.service.setSdBrain(true);
  const stopped = await g.service.send({ id: 'test', text: 'fix the rim', context });
  // From the third failure on, more revisions are refused and the task cannot pass.
  assert.equal(stopped.ok, false);
  assert.ok((await g.service.conversation('test', 'compatible')).task.corrections['detail-value'] >= 3);
  assert.ok(g.events.some(e => e.type === 'tool-result' && /failed three times/.test(e.summary || '')));
});
