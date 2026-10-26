import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { AI_TOOLS } from '../src/ai-tools.js';
const { runApi, endpoint, sseEvents } = createRequire(import.meta.url)('../electron/ai-providers.cjs');

async function fixture(t, handle) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let text = '';
    for await (const part of req) text += part;
    const data = JSON.parse(text || '{}');
    requests.push({ data, headers: req.headers });
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    handle(data, res, requests.length);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(
    () =>
      new Promise(resolve => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  return { url: `http://127.0.0.1:${server.address().port}/v1`, requests };
}
const event = (res, data) => res.write('data: ' + JSON.stringify(data) + '\n\n');
test('OpenAI-compatible provider drives a real streamed tool loop with fragmented arguments', async t => {
  const server = await fixture(t, (data, res, round) => {
    if (round === 1) {
      event(res, {
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, id: 'call1', function: { name: 'mdlxl_read', arguments: '{"path":' } },
              ],
            },
          },
        ],
      });
      event(res, {
        choices: [
          {
            delta: { tool_calls: [{ index: 0, function: { arguments: '"/Geosets/0/Vertices"}' } }] },
            finish_reason: 'tool_calls',
          },
        ],
      });
    } else {
      assert.equal(data.messages.at(-1).role, 'tool');
      assert.match(data.messages.at(-1).content, /Float32Array/);
      event(res, {
        choices: [{ delta: { content: 'I can see the selected mesh.' }, finish_reason: 'stop' }],
      });
    }
    res.end();
  });
  const called = [],
    events = [],
    conversation = { messages: [] };
  await runApi({
    settings: { provider: 'compatible', baseUrl: server.url, model: 'test-model' },
    key: 'not-a-real-key',
    tools: AI_TOOLS,
    call: async (name, args) => {
      called.push({ name, args });
      return { value: { $type: 'Float32Array', $data: [1, 2, 3] } };
    },
    prompt: 'Inspect these',
    system: 'editor system',
    conversation,
    images: [],
    signal: new AbortController().signal,
    event: e => events.push(e),
  });
  assert.equal(called[0].name, 'mdlxl_read');
  assert.equal(server.requests.length, 2);
  assert.equal(server.requests[0].headers.authorization, 'Bearer not-a-real-key');
  assert.equal(
    events
      .filter(e => e.type === 'text')
      .map(e => e.text)
      .join(''),
    'I can see the selected mesh.',
  );
});
test('Claude API preserves tool IDs and returns tool errors for correction', async t => {
  const server = await fixture(t, (data, res, round) => {
    if (round === 1) {
      event(res, {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'tool_use', id: 'tool1', name: 'mdlxl_capture', input: {} },
      });
      event(res, {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '{"target":"test"}' },
      });
      event(res, { type: 'message_delta', delta: { stop_reason: 'tool_use' } });
    } else {
      assert.equal(data.messages.at(-1).content[0].tool_use_id, 'tool1');
      assert.equal(data.messages.at(-1).content[0].is_error, true);
      event(res, { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
      event(res, {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Please open a viewport.' },
      });
      event(res, { type: 'message_delta', delta: { stop_reason: 'end_turn' } });
    }
    res.end();
  });
  const events = [];
  await runApi({
    settings: { provider: 'anthropic', baseUrl: server.url, model: 'test-claude' },
    key: 'test-key',
    tools: AI_TOOLS,
    call: () => {
      throw Error('No viewport');
    },
    prompt: 'Look',
    system: 'editor',
    conversation: { messages: [] },
    signal: new AbortController().signal,
    event: e => events.push(e),
  });
  assert.equal(server.requests.length, 2);
  assert.equal(events.findLast(e => e.type === 'text').text, 'Please open a viewport.');
});
test('Claude API drops reasoning signed for an older tool list and asks again', async t => {
  const bodies = [];
  const server = http.createServer(async (req, res) => {
    let text = '';
    for await (const part of req) text += part;
    bodies.push(JSON.parse(text));
    if (JSON.stringify(bodies.at(-1).messages).includes('"type":"thinking"')) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'messages.1.content.0: Invalid `signature` in `thinking` block. The `tools` list differs.' } }));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    event(res, { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    event(res, { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Carrying on.' } });
    event(res, { type: 'message_delta', delta: { stop_reason: 'end_turn' } });
    res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  // A chat from before an update: its earlier answer carries signed reasoning.
  const conversation = {
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'Fix the skirt' }] },
      { role: 'assistant', content: [{ type: 'thinking', thinking: 'Plan', signature: 'old' }, { type: 'text', text: 'Done.' }] },
    ],
  };
  const events = [];
  await runApi({
    settings: { provider: 'anthropic', baseUrl: `http://127.0.0.1:${server.address().port}/v1`, model: 'test-claude' },
    key: 'test-key',
    tools: AI_TOOLS,
    call: () => ({}),
    prompt: 'Now the belly',
    system: 'editor',
    conversation,
    signal: new AbortController().signal,
    event: e => events.push(e),
  });
  assert.equal(bodies.length, 2, 'refused once, then asked again');
  assert.deepEqual(conversation.messages[1].content, [{ type: 'text', text: 'Done.' }], 'the old reasoning is gone, the answer stays');
  assert.equal(events.findLast(e => e.type === 'text').text, 'Carrying on.');
});
test('Claude API caches the conversation and stops a prompt at its spending limit', async t => {
  const server = await fixture(t, (data, res) => {
    event(res, {
      type: 'message_start',
      message: { usage: { input_tokens: 1000, cache_creation_input_tokens: 200000, cache_read_input_tokens: 0 } },
    });
    event(res, {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'tool_use', id: 'tool' + data.messages.length, name: 'mdlxl_context', input: {} },
    });
    event(res, { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 5000 } });
    res.end();
  });
  const events = [];
  await assert.rejects(
    runApi({
      settings: { provider: 'anthropic', baseUrl: server.url, model: 'claude-opus-5-5', spendLimit: 2 },
      key: 'test-key',
      tools: AI_TOOLS,
      call: () => ({ content: [{ type: 'text', text: '{}' }] }),
      prompt: 'Look',
      system: 'editor',
      conversation: { messages: [] },
      signal: new AbortController().signal,
      event: e => events.push(e),
    }),
    /Stopped at about \$2\.\d\d/,
  );
  // Each round is about $1.10 here: the limit stops the prompt after the second.
  assert.equal(server.requests.length, 2);
  const [first, second] = server.requests.map(r => r.data);
  assert.deepEqual(first.tools.at(-1).cache_control, { type: 'ephemeral' });
  assert.deepEqual(first.system[0].cache_control, { type: 'ephemeral' });
  assert.deepEqual(second.messages.at(-1).content.at(-1).cache_control, { type: 'ephemeral' });
  assert.equal(second.messages.filter(m => JSON.stringify(m).includes('cache_control')).length, 1);
  assert.ok(events.filter(e => e.type === 'cost').every(e => e.usd > 0));
});
test('stream decoder handles CRLF across network chunks and Unicode', async () => {
  const chunks = ['data: {"text":"héllo"}\r', '\n\r', '\n'];
  const stream = new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(new TextEncoder().encode(c));
      controller.close();
    },
  });
  const actual = [];
  for await (const e of sseEvents({ body: stream })) actual.push(e);
  assert.deepEqual(actual, [{ text: 'héllo' }]);
});
test('partial stream does not get reported as a completed response', async t => {
  const server = await fixture(t, (_, res) => {
    event(res, { choices: [{ delta: { content: 'unfinished' } }] });
    res.end();
  });
  await assert.rejects(
    () =>
      runApi({
        settings: { provider: 'compatible', baseUrl: server.url, model: 'test' },
        tools: AI_TOOLS,
        call: () => {},
        prompt: 'x',
        system: 'x',
        conversation: { messages: [] },
        signal: new AbortController().signal,
        event: () => {},
      }),
    /before completion/,
  );
});
test('provider URLs permit local models and reject cleartext remote credentials', () => {
  assert.equal(endpoint('http://localhost:1234/v1/'), 'http://localhost:1234/v1');
  assert.throws(() => endpoint('http://remote.example/v1'), /HTTPS/);
  assert.throws(() => endpoint('https://key:secret@example.com/v1'), /HTTPS/);
});
