// Owner, 18 Nov 2026: a long Claude API job re-read about 320K tokens on every step,
// because one job is one API turn and its own reasoning was never cleared. The API now
// summarises the job past 100K input tokens; the saved history starts at that summary,
// every request's tokens are kept with the chat, and a refused piece is shown, not hidden.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { recordAiEvent } from '../src/ai-transcript.js';
const require = createRequire(import.meta.url);
const { runApi } = require('../electron/ai-providers.cjs');
const { AiRecorder } = require('../electron/ai-chat-state.cjs');

const tools = [{ name: 'read_part', description: 'Reads a part.', inputSchema: { type: 'object', properties: { part: { type: 'integer' } } } }];
const sse = (res, data) => res.write('data: ' + JSON.stringify(data) + '\n\n');
async function server(t, handle) {
  const requests = [];
  const http_ = http.createServer(async (req, res) => {
    let text = '';
    for await (const part of req) text += part;
    requests.push({ data: JSON.parse(text), beta: req.headers['anthropic-beta'] });
    handle(requests.at(-1).data, res, requests.length);
  });
  await new Promise(resolve => http_.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { http_.closeAllConnections(); http_.close(resolve); }));
  return { url: `http://127.0.0.1:${http_.address().port}/v1`, requests };
}
const ok = res => res.writeHead(200, { 'content-type': 'text/event-stream' });
function toolCall(res, round, { usage = { input_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, compaction, iterations } = {}) {
  ok(res);
  sse(res, { type: 'message_start', message: { usage } });
  let index = 0;
  if (compaction !== undefined) {
    sse(res, { type: 'content_block_start', index, content_block: { type: 'compaction', content: null } });
    if (compaction !== null) sse(res, { type: 'content_block_delta', index, delta: { type: 'compaction_delta', content: compaction } });
    sse(res, { type: 'content_block_stop', index: index++ });
  }
  sse(res, { type: 'content_block_start', index, content_block: { type: 'thinking', thinking: '' } });
  sse(res, { type: 'content_block_delta', index, delta: { type: 'thinking_delta', thinking: 'Next part.' } });
  sse(res, { type: 'content_block_delta', index, delta: { type: 'signature_delta', signature: 'sig' + round } });
  sse(res, { type: 'content_block_start', index: ++index, content_block: { type: 'tool_use', id: 'call' + round, name: 'read_part', input: {} } });
  sse(res, { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: `{"part":${round}}` } });
  sse(res, {
    type: 'message_delta',
    delta: { stop_reason: 'tool_use' },
    usage: { ...usage, output_tokens: 40, ...(iterations ? { iterations } : {}) },
    context_management: { applied_edits: round === 2 ? [{ type: 'clear_tool_uses_20250919', cleared_tool_uses: 1, cleared_input_tokens: 20000 }] : [] },
  });
  res.end();
}
function done(res) {
  ok(res);
  sse(res, { type: 'message_start', message: { usage: { input_tokens: 5 } } });
  sse(res, { type: 'content_block_start', index: 0, content_block: { type: 'text', text: 'DONE' } });
  sse(res, { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 2 } });
  res.end();
}
function chat() {
  const conversation = { id: 'c', transcript: [], messages: [] };
  const emitted = [];
  const recorder = new AiRecorder(conversation, value => emitted.push(value), recordAiEvent);
  recorder.start({ role: 'user', text: 'Read the parts' });
  return { conversation, emitted, recorder };
}
const options = (url, conversation, recorder) => ({
  settings: { provider: 'anthropic', baseUrl: url, model: 'claude-fable-5-2', effort: 'xhigh' },
  key: 'k',
  tools,
  call: async () => ({ toolText: 'part text' }),
  prompt: 'Read the parts',
  system: 'editor',
  images: [],
  conversation,
  signal: new AbortController().signal,
  event: value => recorder.event(value),
});

test('a compaction is kept exactly, the saved and sent history start at it, and each request is recorded with the chat', async t => {
  const summary = '<summary>User asked to read parts 1-3. Parts 1-2 read. Remaining: part 3.</summary>';
  const compactionUsage = { input_tokens: 1200, cache_read_input_tokens: 0, cache_creation_input_tokens: 300 };
  const fixture = await server(t, (data, res, round) => {
    if (round === 1) toolCall(res, 1);
    else if (round === 2)
      toolCall(res, 2, {
        // message_start reports the summarising pass; message_delta the reply that followed.
        usage: compactionUsage,
        compaction: summary,
        iterations: [
          { type: 'compaction', input_tokens: 2000, cache_read_input_tokens: 100000, cache_creation_input_tokens: 0, output_tokens: 900 },
          { type: 'message', ...compactionUsage, output_tokens: 40 },
        ],
      });
    else if (round === 3) toolCall(res, 3);
    else done(res);
  });
  const { conversation, emitted, recorder } = chat();
  await runApi(options(fixture.url, conversation, recorder));
  assert.equal(fixture.requests.length, 4);
  // The request after the compaction starts at the compaction block, which goes back as it came.
  const after = fixture.requests[2].data.messages;
  assert.equal(after.length, 2);
  assert.equal(after[0].role, 'assistant');
  assert.deepEqual(after[0].content[0], { type: 'compaction', content: summary });
  assert.deepEqual(after[0].content.map(b => b.type), ['compaction', 'thinking', 'tool_use']);
  assert.equal(after[0].content[1].signature, 'sig2', 'the reasoning after the summary is replayed unchanged');
  assert.equal(after[1].content[0].type, 'tool_result');
  // The saved history is append-only from the summary on.
  assert.deepEqual(conversation.messages[0].content[0], { type: 'compaction', content: summary });
  assert.deepEqual(conversation.messages.map(m => m.role), ['assistant', 'user', 'assistant', 'user', 'assistant']);
  assert.equal(fixture.requests[3].data.messages.length, 4);
  // Every request's tokens are in the chat, with clearing and compaction.
  const log = conversation.requestUsage;
  assert.equal(log.length, 4);
  assert.deepEqual(
    log.map(entry => [entry.input, entry.cacheRead, entry.cacheWrite, entry.output]),
    [[10, 0, 0, 40], [1200, 0, 300, 40], [10, 0, 0, 40], [5, 0, 0, 2]],
  );
  assert.deepEqual(log[1].compaction, { input: 102000, output: 900 });
  assert.deepEqual(log[1].edits, [{ type: 'clear_tool_uses_20250919', cleared_tool_uses: 1, cleared_input_tokens: 20000 }]);
  assert.ok(log.every(entry => entry.at && entry.model === 'claude-fable-5-2'));
  // The summarising pass is billed on top of the reply: 2000x8 + 100000x0.2 + 900x40, then the reply.
  const reply = (1200 * 8 + 300 * 10 + 40 * 40) / 1e6;
  assert.ok(Math.abs(log[1].usd - ((2000 * 8 + 100000 * 0.2 + 900 * 40) / 1e6 + reply)) < 1e-9);
  // The chat shows the compaction as a finished step, and its context use after it.
  assert.ok(conversation.transcript.at(-1).parts.some(part => part.type === 'compaction' && part.status === 'done'));
  assert.equal(conversation.usage.used, 5);
  assert.ok(!emitted.some(value => value.type === 'request-usage'), 'the token log stays out of the console stream');
  // The user's effort setting is sent as it is.
  assert.ok(fixture.requests.every(request => request.data.output_config.effort === 'xhigh'));
});

test('a compaction without a summary keeps the full history and says so', async t => {
  const fixture = await server(t, (data, res, round) => {
    if (round === 1) toolCall(res, 1, { compaction: null });
    else done(res);
  });
  const { conversation, recorder } = chat();
  await runApi(options(fixture.url, conversation, recorder));
  const sent = fixture.requests[1].data.messages;
  assert.equal(sent[0].role, 'user');
  assert.equal(sent[0].content[0].text, 'Read the parts');
  assert.equal(conversation.messages[0].role, 'user');
  assert.ok(conversation.transcript.at(-1).parts.some(part => part.type === 'provider-notice' && /no summary/.test(part.text)));
});

test('a refused compaction is shown in the chat and only compaction is switched off', async t => {
  const fixture = await server(t, (data, res, round) => {
    if (round === 1) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'context_management.edits.2: compact_20260112 is not supported on this model' } }));
    } else done(res);
  });
  const { conversation, recorder } = chat();
  await runApi(options(fixture.url, conversation, recorder));
  assert.equal(fixture.requests.length, 2);
  assert.deepEqual(fixture.requests[0].data.context_management.edits.map(e => e.type), ['clear_thinking_20251015', 'clear_tool_uses_20250919', 'compact_20260112']);
  assert.deepEqual(fixture.requests[1].data.context_management.edits.map(e => e.type), ['clear_thinking_20251015', 'clear_tool_uses_20250919']);
  assert.equal(fixture.requests[1].beta, 'context-management-2025-06-27');
  const notice = conversation.transcript.at(-1).parts.find(part => part.type === 'provider-notice');
  assert.match(notice.text, /context compaction/);
  assert.equal(notice.severity, 'warning');
  assert.match(notice.detail, /compact_20260112 is not supported/);
  assert.deepEqual(conversation.requestUsage[0].refused, ['compact_20260112']);
});

test('an unrelated 400 is an error and never switches clearing or compaction off', async t => {
  for (const message of ['max_tokens: 64000 > 32000, which is the maximum', 'Unexpected value(s) `foo-2026` for the `anthropic-beta` header']) {
    const fixture = await server(t, (data, res) => {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message } }));
    });
    const { conversation, recorder } = chat();
    await assert.rejects(runApi(options(fixture.url, conversation, recorder)), /HTTP 400/);
    assert.equal(fixture.requests.length, 1, message);
    assert.ok(!conversation.transcript.at(-1).parts.some(part => part.type === 'provider-notice'));
  }
});
