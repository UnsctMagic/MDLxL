import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { AI_SD_RULES } from '../src/ai-sd-rules.js';
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
  assert.equal(
    f.events.some(e => e.type === 'text' && e.text === 'Done.'),
    false,
  );
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
  assert.equal(
    f.events.some(e => e.type === 'text' && e.text === 'Done.'),
    false,
  );
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

test('embedded provider and standalone guide receive the same SD rulebook without an edit', async t => {
  let received;
  const f = await setup(t, ({ data }) => {
    received = data;
    return done();
  });
  assert.equal((await f.service.send({ id: 'test', text: 'Explain the SD modeling constraints', context })).ok, true);
  const system = received.messages.find(message => message.role === 'system');
  assert.ok(system.content.endsWith(AI_SD_RULES));
  const user = received.messages.find(message => message.role === 'user');
  assert.ok(user.content[0].text.includes(JSON.stringify(context)));
  assert.deepEqual(f.counts(), { requests: 1, edits: 0 });
  const guide = await fs.readFile(path.join(root, 'docs/AI-SD-RULEBOOK.md'), 'utf8');
  assert.ok(guide.includes(AI_SD_RULES), 'the standalone rulebook matches the supplied instructions');
});
