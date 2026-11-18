// View AI work: the pure parts. The chat keeps small copies of the pictures the AI
// received (W1); the packaged check is test/ai-watch.electron.cjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { applyAiEvent, recordAiEvent } from '../src/ai-transcript.js';
const require = createRequire(import.meta.url);
const chatState = require('../electron/ai-chat-state.cjs');

const picture = n => ({ type: 'image', mimeType: 'image/png', data: 'FULL' + 'A'.repeat(4000) + n });
const conversation = () => ({ transcript: [{ role: 'user', text: 'go' }] });
const recorder = (chat, shrink, emitted = []) => {
  const r = new chatState.AiRecorder(chat, value => emitted.push(value), recordAiEvent, shrink);
  r.start({ role: 'user', text: 'go' });
  return r;
};
const fakeShrink = ({ data }) => 'data:image/jpeg;base64,small-' + data.at(-1);

test('W1: a capture step keeps small copies of its pictures in the saved chat and the console event', () => {
  const chat = conversation(), emitted = [], r = recorder(chat, fakeShrink, emitted);
  r.event({ type: 'tool', name: 'mdlxl_capture', callId: 'c1', detail: '{}' });
  r.event({ type: 'tool-result', name: 'mdlxl_capture', callId: 'c1', error: false, summary: '', content: [{ type: 'text', text: '{"label":"front"}' }, picture(1), picture(2)] });
  const part = chat.transcript.at(-1).parts.find(p => p.type === 'tool');
  assert.deepEqual(part.thumbs, ['data:image/jpeg;base64,small-1', 'data:image/jpeg;base64,small-2']);
  const sent = emitted.find(e => e.type === 'tool-result');
  assert.deepEqual(sent.thumbs, part.thumbs);
  // The full pictures never reach the saved chat or the console.
  assert.equal('content' in sent, false);
  assert.doesNotMatch(JSON.stringify(chat.transcript) + JSON.stringify(emitted), /FULL/);
  // The console applies the same event to its own copy of the chat.
  const shown = applyAiEvent([{ role: 'assistant', text: '', parts: [{ type: 'tool', id: 'c1', name: 'mdlxl_capture', status: 'running' }] }], sent);
  assert.deepEqual(shown[0].parts[0].thumbs, part.thumbs);
});

test('W1: Claude Code and Codex picture shapes are kept too; without a shrinker nothing is kept', () => {
  const chat = conversation(), r = recorder(chat, fakeShrink);
  r.event({ type: 'tool', name: 'mcp__mdlxl__mdlxl_capture', callId: 'c2' });
  r.event({ type: 'tool-result', name: 'mcp__mdlxl__mdlxl_capture', callId: 'c2', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'xyz9' } }] });
  assert.deepEqual(chat.transcript.at(-1).parts[0].thumbs, ['data:image/jpeg;base64,small-9']);
  const plain = conversation(), emitted = [], q = recorder(plain, undefined, emitted);
  q.event({ type: 'tool', name: 'mdlxl_capture', callId: 'c3' });
  q.event({ type: 'tool-result', name: 'mdlxl_capture', callId: 'c3', content: [picture(3)] });
  assert.equal(plain.transcript.at(-1).parts[0].thumbs, undefined);
  assert.equal('content' in emitted.at(-1), false);
});

test('W1: thumbnails are small: downscaled, a few per step, and only the newest kept per chat', () => {
  assert.deepEqual(chatState.thumbnailSize(768, 576), { width: chatState.THUMB_SIZE, height: 288 });
  assert.deepEqual(chatState.thumbnailSize(576, 768), { width: 288, height: chatState.THUMB_SIZE });
  assert.deepEqual(chatState.thumbnailSize(100, 50), { width: 100, height: 50 });
  assert.ok(chatState.THUMB_SIZE <= 400);
  const chat = conversation(), r = recorder(chat, fakeShrink);
  r.event({ type: 'tool', name: 'mdlxl_capture', callId: 'many' });
  r.event({ type: 'tool-result', name: 'mdlxl_capture', callId: 'many', content: Array.from({ length: 12 }, (_, i) => picture(i % 10)) });
  assert.equal(chat.transcript.at(-1).parts[0].thumbs.length, chatState.THUMBS_PER_STEP);
  for (let i = 0; i < 40; i++) {
    r.event({ type: 'tool', name: 'mdlxl_capture', callId: 'k' + i });
    r.event({ type: 'tool-result', name: 'mdlxl_capture', callId: 'k' + i, content: [picture(1), picture(2), picture(3), picture(4)] });
  }
  const parts = chat.transcript.flatMap(m => m.parts || []).filter(p => p.type === 'tool');
  const total = parts.reduce((n, p) => n + (p.thumbs?.length || 0), 0);
  assert.equal(total, chatState.THUMBS_PER_CHAT);
  // The newest steps keep theirs; the oldest lost them.
  assert.equal(parts.at(-1).thumbs.length, 4);
  assert.equal(parts[0].thumbs, undefined);
});
