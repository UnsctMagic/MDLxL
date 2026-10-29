import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { AiRecorder } = require('../electron/ai-offload.cjs');

// The saved transcript a sequence of AI events builds, and the events passed on
// to the console.
function record(events, { start = true } = {}) {
  const conversation = { transcript: [] },
    emitted = [];
  const recorder = new AiRecorder(conversation, value => emitted.push(value));
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

test('a bird job row is added once and filled in when the bird finishes', () => {
  const { conversation, emitted } = record([
    { type: 'worker', workerId: 'w1', name: 'Crow', job: 'Red cape', status: 'working', region: 'cape', model: 'm', light: false },
    { type: 'worker', workerId: 'w1', name: 'Crow', job: 'Red cape', status: 'working' },
    { type: 'split', text: 'Steer' },
    { type: 'worker', workerId: 'w1', name: 'Crow', status: 'done', report: 'Done.', cost: { usd: 1 }, model: 'm', light: false },
    { type: 'worker', workerId: 'w1', name: 'Crow', job: 'Again', status: 'done', report: 'Again.' },
  ]);
  assert.deepEqual(conversation.transcript[1].parts, [
    { type: 'worker', workerId: 'w1', name: 'Crow', job: 'Red cape', status: 'done', region: 'cape', model: 'm', light: false, report: 'Done.', cost: { usd: 1 } },
  ]);
  // A finished bird that reports again gets a new row.
  assert.deepEqual(conversation.transcript[3].parts, [
    { type: 'worker', workerId: 'w1', name: 'Crow', job: 'Again', status: 'done', region: undefined, model: undefined, light: undefined },
  ]);
  assert.equal(emitted.length, 4);
});

test('the art brief row fills in, cost keeps roles only when sent, usage and requests stay in main', () => {
  const { conversation, emitted } = record([
    { type: 'request' },
    { type: 'art', status: 'running' },
    { type: 'art', status: 'done', text: 'Brief' },
    { type: 'art', status: 'error' },
    { type: 'cost', usd: 0.5, tokens: 10, model: 'm', light: false },
    { type: 'usage', used: 0, window: 100 },
    { type: 'usage', used: 50, window: 100 },
  ]);
  assert.deepEqual(conversation.transcript[1].parts, [
    { type: 'art', status: 'done', text: 'Brief' },
    { type: 'art', status: 'error', text: '' },
  ]);
  assert.deepEqual(conversation.transcript[1].cost, { usd: 0.5, tokens: 10, model: 'm', light: false });
  assert.deepEqual(conversation.usage, { used: 50, window: 100 });
  assert.deepEqual(emitted.map(e => e.type), ['art', 'art', 'art', 'cost']);
  const roles = record([{ type: 'cost', usd: null, tokens: 5, roles: { bird: { calls: 1 } } }]);
  assert.deepEqual(roles.conversation.transcript[1].cost, { usd: null, tokens: 5, model: undefined, light: undefined, roles: { bird: { calls: 1 } } });
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
