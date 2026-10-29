import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { recordAiEvent } from '../src/ai-transcript.js';
import { tempDir } from './helpers/fixtures.cjs';
const require = createRequire(import.meta.url);
const { AiService } = require('../electron/ai-service.cjs');
const { AiRecorder, settleConversation } = require('../electron/ai-offload.cjs');
const { runCodex, CodexProcess } = require('../electron/ai-providers.cjs');
async function setup(t) {
  const profile = tempDir('mdlxl-questions-');
  const service = new AiService({ root: '.', profile, electron: {}, getWindow: () => null });
  await fs.mkdir(service.directory, { recursive: true });
  t.after(async () => { await service.close(); await fs.rm(profile, { recursive: true, force: true }); });
  const events = [];
  service.emit = event => events.push(event);
  const chat = id => {
    const conversation = { id, transcript: [], messages: [], provider: 'codex', name: id };
    service.conversations.set(id, conversation);
    const recorder = new AiRecorder(conversation, value => service.emit({ id, ...value }), recordAiEvent);
    recorder.start({ role: 'user', text: 'Switch the arms' });
    return { conversation, recorder };
  };
  return { profile, service, events, chat };
}
const question = { id: 'arms', header: 'Arms', question: 'Swap motion or physical sides?', options: [{ label: 'Motion', description: 'Keep the mesh' }, { label: 'Sides', description: 'Move the mesh' }] };
const response = text => ({ arms: { answers: [text] } });

test('native question reaches organiser and bird; selected and custom answers return to the original RPC', async t => {
  const { service, events, chat } = await setup(t);
  const parent = chat('organiser'), bird = chat('crow');
  service.tasks.set('organiser', { id: 'organiser', recorder: parent.recorder, workers: new Map([['crow', {}]]), controller: new AbortController() });
  await fs.copyFile(new URL('../fixtures/ai-question-agent.cjs', import.meta.url), path.join(service.directory, 'agent.js'));
  await fs.mkdir(path.join(service.directory, 'bin'));
  const executable = path.join(service.directory, 'bin', process.platform === 'win32' ? 'codex.cmd' : 'codex');
  if (process.platform === 'win32') await fs.writeFile(executable, '@"%dp0%\\..\\agent.js" %*\r\n');
  else { await fs.writeFile(executable, '#!' + process.execPath + '\n' + await fs.readFile(path.join(service.directory, 'agent.js'), 'utf8')); await fs.chmod(executable, 0o700); }
  const emit = service.emit;
  service.emit = event => {
    emit(event);
    if (event.type === 'question' && event.id === 'organiser') {
      assert.throws(() => service.answerQuestion({ questionId: event.questionId, answers: {} }), /Answer each/);
      assert.equal(parent.conversation.transcript.at(-1).parts.at(-1).status, 'running');
      service.answerQuestion({ questionId: event.questionId, answers: { arms: { answers: ['Swap animation'] }, keep: { answers: ['Keep shoulders and enlarged axe'] } } });
      assert.throws(() => service.answerQuestion({ questionId: event.questionId, answers: response('Sides') }), /no longer/);
    }
  };
  await runCodex({ settings: { executable }, directory: service.directory, tools: [], call: () => {}, system: '', prompt: 'Switch the arms', conversation: bird.conversation, images: [], signal: new AbortController().signal,
    event: value => bird.recorder.event(value), askUser: (params, signal) => service.askUser(bird.conversation, bird.recorder, params, signal) });
  const received = JSON.parse((await fs.readFile(path.join(service.directory, 'question-answers.jsonl'), 'utf8')).trim());
  assert.equal(received.id, 'native-question');
  assert.deepEqual(received.result.answers, { arms: { answers: ['Swap animation'] }, keep: { answers: ['Keep shoulders and enlarged axe'] } });
  assert.equal(events.filter(e => e.type === 'question').length, 2);
  assert.equal(events.filter(e => e.type === 'question-result').length, 2);
  for (const target of [parent, bird]) {
    const saved = JSON.parse(await fs.readFile(path.join(service.directory, 'chat-' + target.conversation.id + '.json')));
    const part = saved.transcript.flatMap(m => m.parts || []).find(p => p.type === 'question');
    assert.equal(part.status, 'done'); assert.deepEqual(part.answers, received.result.answers);
  }
  assert.match(bird.recorder.reply.text, /Answer received: Swap animation/);
  assert.equal(service.questions.size, 0);
});

test('concurrent birds have independent pending questions and Stop clears only its own request', async t => {
  const { service, chat } = await setup(t), one = chat('one'), two = chat('two');
  const stopOne = new AbortController(), stopTwo = new AbortController();
  const a = service.askUser(one.conversation, one.recorder, { questions: [question] }, stopOne.signal);
  const rejected = assert.rejects(a, /Stopped/);
  const b = service.askUser(two.conversation, two.recorder, { questions: [question] }, stopTwo.signal);
  const [first, second] = [...service.questions.keys()];
  assert.throws(() => service.answerQuestion({ questionId: 'wrong-chat', answers: response('Motion') }), /no longer/);
  stopOne.abort(Error('Stopped'));
  await rejected;
  assert.equal(service.questions.has(first), false); assert.equal(service.questions.has(second), true);
  service.answerQuestion({ questionId: second, answers: response('Keep the axe on the right') });
  assert.deepEqual(await b, { answers: response('Keep the axe on the right') });
  assert.equal(one.recorder.reply.parts[0].status, 'stopped');
  assert.equal(two.recorder.reply.parts[0].status, 'done');
  const restarted = settleConversation({ transcript: [{ parts: [{ type: 'question', status: 'running' }] }] });
  assert.equal(restarted.transcript[0].parts[0].status, 'stopped');
});

test('malformed questions fail visibly and secret answers are sent without being saved', async t => {
  const { service, chat } = await setup(t), { conversation, recorder } = chat('secret');
  const signal = new AbortController().signal;
  await assert.rejects(service.askUser(conversation, recorder, { questions: [question, question] }, signal), /unique ID/);
  const pending = service.askUser(conversation, recorder, { questions: [{ ...question, isSecret: true }] }, signal);
  service.answerQuestion({ questionId: [...service.questions.keys()][0], answers: response('private-answer') });
  assert.deepEqual(await pending, { answers: response('private-answer') });
  assert.equal(JSON.stringify(conversation).includes('private-answer'), false);
});

test('question routing never grants terminal or filesystem approval; provider exit aborts the question', async () => {
  let signal; const sent = [];
  const client = new CodexProcess({}, { askUser: (_params, inputSignal) => { signal = inputSignal; return new Promise(() => {}); } });
  client.write = value => sent.push(value);
  client.receive({ id: 1, method: 'item/tool/requestUserInput', params: { questions: [question] } });
  await Promise.resolve();
  client.receive({ id: 2, method: 'item/commandExecution/requestApproval', params: {} });
  assert.deepEqual(sent, [{ id: 2, result: { decision: 'decline' } }]);
  client.fail(Error('Provider exited')); assert.equal(signal.aborted, true);
});

test('provider questions keep only plain text and choices; repeated notices share one row', () => {
  const { codexQuestions, claudeQuestions } = require('../electron/ai-user-input.cjs');
  const raw = { id: 'q', question: 'Which arm?', link: 'https://example.com', validateAnswers: 'x', inputType: 'password', isOther: false, options: [{ label: 'Left', extra: 1 }] };
  const [codex] = codexQuestions({ questions: [raw] }).questions;
  assert.deepEqual(codex, { id: 'q', question: 'Which arm?', description: '', options: [{ label: 'Left', description: '' }], multiSelect: false, isSecret: false, allowCustom: false });
  const [claude] = claudeQuestions({ questions: [raw] });
  assert.equal(claude.link, undefined);
  assert.equal(claude.allowCustom, false);
  assert.equal(codexQuestions({ questions: [{ ...raw, isOther: true }] }).questions[0].allowCustom, undefined);
  const conversation = { id: 'n', transcript: [], messages: [] };
  const recorder = new AiRecorder(conversation, () => {}, recordAiEvent);
  recorder.start({ role: 'user', text: 'Go' });
  for (const detail of ['1 of 3', '2 of 3']) recorder.event({ type: 'provider-notice', text: 'Tool progress', detail, severity: 'info' });
  const notices = recorder.parts().filter(p => p.type === 'provider-notice');
  assert.equal(notices.length, 1);
  assert.equal(notices[0].detail, '2 of 3');
});
