import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { applyAiEvent, recordAiEvent } from '../src/ai-transcript.js';
const require = createRequire(import.meta.url);
const { AiRecorder } = require('../electron/ai-chat-state.cjs');

// The saved transcript a sequence of AI events builds, and the events passed on
// to the console.
function record(events, { start = true } = {}) {
  const conversation = { transcript: [] },
    emitted = [];
  const recorder = new AiRecorder(conversation, value => emitted.push(value), recordAiEvent);
  if (start) recorder.start({ role: 'user', text: 'Make it red' });
  for (const event of events) event.type === 'split' ? recorder.split(event.text) : recorder.event(event);
  return { conversation, emitted, recorder };
}

test('text and thinking merge into the running part of the reply; empty text is not news', () => {
  const { conversation, emitted } = record([
    { type: 'thinking', text: 'Look ' },
    { type: 'thinking', text: 'first.' },
    { type: 'text', text: 'Hello' },
    { type: 'text', text: '' },
    { type: 'text', text: ' world' },
    { type: 'thinking', text: 'Again.' },
  ]);
  assert.deepEqual(conversation.transcript, [
    { role: 'user', text: 'Make it red' },
    {
      role: 'assistant',
      text: 'Hello world',
      parts: [
        { type: 'thinking', text: 'Look first.' },
        { type: 'text', text: 'Hello world' },
        { type: 'thinking', text: 'Again.' },
      ],
    },
  ]);
  assert.equal(emitted.length, 5);
});

test('a tool result finds its step by call id across a steering split, or the running step of that name', () => {
  const { conversation, emitted } = record([
    { type: 'tool', callId: 'c1', name: 'mdlxl_read', detail: '{"path":"/Info"}' },
    { type: 'tool', name: 'mdlxl_capture', detail: '' },
    { type: 'split', text: 'Also the cape' },
    { type: 'tool-result', callId: 'c1', name: 'mdlxl_read', summary: 'Footman' },
    { type: 'tool-result', name: 'mdlxl_capture', error: true, summary: 'No view' },
    { type: 'tool-result', callId: 'missing', name: 'mdlxl_patch' },
  ]);
  assert.deepEqual(conversation.transcript[1].parts, [
    { type: 'tool', id: 'c1', name: 'mdlxl_read', detail: '{"path":"/Info"}', status: 'done', summary: 'Footman' },
    { type: 'tool', id: undefined, name: 'mdlxl_capture', detail: '', status: 'error', summary: 'No view' },
  ]);
  assert.deepEqual(conversation.transcript.slice(2), [
    { role: 'user', text: 'Also the cape', steer: true },
    { role: 'assistant', text: '', parts: [] },
  ]);
  // An unmatched result changes nothing but still reaches the console.
  assert.equal(emitted.length, 5);
});

test('compaction shows once while running and is done once; repeats are not news', () => {
  const { conversation, emitted } = record([
    { type: 'compaction', active: true },
    { type: 'compaction', active: true },
    { type: 'split', text: 'Steer' },
    { type: 'compaction', active: false },
    { type: 'compaction', active: false },
  ]);
  assert.deepEqual(conversation.transcript[1].parts, [{ type: 'compaction', status: 'done' }]);
  assert.deepEqual(conversation.transcript[3].parts, []);
  assert.deepEqual(emitted.map(e => e.active), [true, false]);
});

test('a question is answered in place, also after a split', () => {
  const questions = [{ id: 'colour', question: 'Which red?' }];
  const { conversation } = record([
    { type: 'question', questionId: 'q1', questions, name: 'Crow', message: 'One thing', status: 'ignored' },
    { type: 'split', text: 'Steer' },
    { type: 'question-result', questionId: 'q1', status: 'done', answers: { colour: { answers: ['Dark'] } }, reason: undefined },
  ]);
  assert.deepEqual(conversation.transcript[1].parts, [
    { type: 'question', questionId: 'q1', questions, name: 'Crow', message: 'One thing', status: 'done', answers: { colour: { answers: ['Dark'] } }, reason: undefined },
  ]);
});

test('a repeated provider notice updates its row and keeps only the notice fields', () => {
  const { conversation } = record([
    { type: 'provider-notice', id: 'chat', text: 'Usage', detail: '10%', severity: 'info', name: '' },
    { type: 'provider-notice', id: 'chat', text: 'Other', detail: '', severity: 'warning', name: '' },
    { type: 'provider-notice', id: 'chat', text: 'Usage', detail: '20%', severity: 'info', name: '', extra: 1 },
  ]);
  assert.deepEqual(conversation.transcript[1].parts, [
    { type: 'provider-notice', text: 'Usage', detail: '20%', severity: 'info', name: '' },
    { type: 'provider-notice', text: 'Other', detail: '', severity: 'warning', name: '' },
  ]);
});

test('the art brief row fills in, cost keeps roles only when sent, usage and requests stay in main', () => {
  const { conversation, emitted } = record([
    { type: 'request' },
    { type: 'art', status: 'running' },
    { type: 'art', status: 'done', text: 'Brief' },
    { type: 'art', status: 'error' },
    { type: 'cost', usd: 0.5, tokens: 10, model: 'm' },
    { type: 'usage', used: 0, window: 100 },
    { type: 'usage', used: 50, window: 100 },
  ]);
  assert.deepEqual(conversation.transcript[1].parts, [
    { type: 'art', status: 'done', text: 'Brief' },
    { type: 'art', status: 'error', text: '' },
  ]);
  assert.deepEqual(conversation.transcript[1].cost, { usd: 0.5, tokens: 10, model: 'm' });
  assert.deepEqual(conversation.usage, { used: 50, window: 100 });
  assert.deepEqual(emitted.map(e => e.type), ['art', 'art', 'art', 'cost']);
  const roles = record([{ type: 'cost', usd: null, tokens: 5, roles: { direct: { calls: 1 } } }]);
  assert.deepEqual(roles.conversation.transcript[1].cost, { usd: null, tokens: 5, model: undefined, roles: { direct: { calls: 1 } } });
});

test('a recorder that was never started keeps its reply out of the saved chat', () => {
  const { conversation, recorder } = record(
    [
      { type: 'text', text: 'Art direction call' },
      { type: 'usage', used: 5, window: 10 },
    ],
    { start: false },
  );
  assert.deepEqual(conversation.transcript, []);
  assert.equal(recorder.reply.text, 'Art direction call');
  assert.deepEqual(conversation.usage, { used: 5, window: 10 });
});

test('an error shows inline on the reply that failed, live and after reopening (D13)', () => {
  const { conversation, emitted } = record([
    { type: 'text', text: 'Working' },
    { type: 'error', text: 'Provider failed', authRequired: false },
  ]);
  assert.equal(conversation.transcript[1].error, 'Provider failed');
  assert.deepEqual(emitted.at(-1), { type: 'error', text: 'Provider failed', authRequired: false });
  // The console's copy of the same chat shows it on the same reply.
  const shown = applyAiEvent([{ role: 'user', text: 'Make it red' }], { type: 'error', text: 'Provider failed' });
  assert.deepEqual(shown, [{ role: 'user', text: 'Make it red' }, { role: 'assistant', text: '', parts: [], error: 'Provider failed' }]);
});

// Every event kind, in an order that crosses steering splits.
const questions = [{ id: 'colour', question: 'Which red?' }];
const STREAM = [
  { type: 'thinking', text: 'Look ' },
  { type: 'thinking', text: 'first.' },
  { type: 'text', text: 'Hello' },
  { type: 'text', text: '' },
  { type: 'art', status: 'running' },
  { type: 'tool', callId: 'c1', name: 'mdlxl_read', detail: '{"path":"/Info"}' },
  { type: 'tool', name: 'mdlxl_capture', detail: '' },
  { type: 'compaction', active: true },
  { type: 'compaction', active: true },
  { type: 'question', questionId: 'q1', questions, name: 'Crow', message: 'One thing' },
  { type: 'provider-notice', id: 'chat', text: 'Usage', detail: '10%', severity: 'info', name: '' },
  { type: 'steer', text: 'Also the cape' },
  { type: 'art', status: 'done', text: 'Brief' },
  { type: 'tool-result', callId: 'c1', name: 'mdlxl_read', summary: 'Footman' },
  { type: 'tool-result', name: 'mdlxl_capture', error: true, summary: 'No view' },
  { type: 'tool-result', callId: 'missing', name: 'mdlxl_patch' },
  { type: 'compaction', active: false },
  { type: 'question-result', questionId: 'q1', status: 'done', answers: { colour: { answers: ['Dark'] } } },
  { type: 'provider-notice', id: 'chat', text: 'Usage', detail: '20%', severity: 'info', name: '' },
  { type: 'cost', usd: 0.5, tokens: 10, model: 'm', roles: { direct: { calls: 1 } } },
  { type: 'text', text: 'Finished.' },
  { type: 'error', text: 'Stopped late' },
  { type: 'done' },
  { type: 'notice', text: 'Status only' },
];

test('the console reducer builds the same chat as the saved transcript', () => {
  const saved = record(STREAM.map(e => (e.type === 'steer' ? { type: 'split', text: e.text } : e))).conversation.transcript;
  const shown = STREAM.reduce(applyAiEvent, [{ role: 'user', text: 'Make it red' }, { role: 'assistant', text: '', parts: [] }]);
  assert.deepEqual(shown, saved);
});

test('the console reducer never changes what it is given and copies only what changes', () => {
  const freeze = value => {
    if (value && typeof value === 'object') {
      Object.freeze(value);
      for (const child of Object.values(value)) freeze(child);
    }
    return value;
  };
  let messages = freeze([{ role: 'user', text: 'Make it red' }, { role: 'assistant', text: '', parts: [] }]);
  for (const event of STREAM) {
    const before = messages,
      after = applyAiEvent(before, freeze(structuredClone(event)));
    // Events that change nothing keep the same list, so React skips a render.
    if (['done', 'notice'].includes(event.type) || (event.type === 'text' && !event.text)) assert.equal(after, before);
    // Streaming text copies only the reply it adds to.
    if (event.type === 'text' && event.text) for (let i = 0; i < after.length - 1; i++) assert.equal(after[i], before[i]);
    messages = freeze(after);
  }
  // Unmatched results and repeated states change nothing.
  assert.equal(applyAiEvent(messages, { type: 'tool-result', callId: 'none', name: 'none' }), messages);
  assert.equal(applyAiEvent(messages, { type: 'compaction', active: false }), messages);
  assert.equal(recordAiEvent(structuredClone(messages), { type: 'compaction', active: false }), false);
});
