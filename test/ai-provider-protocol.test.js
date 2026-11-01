import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { recordAiEvent } from '../src/ai-transcript.js';
import { tempDir } from './helpers/fixtures.cjs';
const require = createRequire(import.meta.url);
const { AiService } = require('../electron/ai-service.cjs');
const { AiRecorder } = require('../electron/ai-chat-state.cjs');
const { CodexProcess, runClaude } = require('../electron/ai-providers.cjs');
const { mcpForm } = require('../electron/ai-user-input.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function setup(t) {
  const profile = tempDir('mdlxl-protocol-');
  const service = new AiService({ root: '.', profile, electron: { shell: { openExternal: async url => opened.push(url) } }, getWindow: () => null });
  await fs.mkdir(service.directory, { recursive: true });
  const events = [], sent = [], opened = [];
  const conversation = { id: 'chat', name: 'Model', provider: 'codex', transcript: [], messages: [] };
  const recorder = new AiRecorder(conversation, value => events.push(value), recordAiEvent); recorder.start({ role: 'user', text: 'Test' });
  const client = new CodexProcess({}, { event: value => recorder.event(value), askUser: (params, signal) => service.askUser(conversation, recorder, params, signal) });
  client.write = value => sent.push(value);
  t.after(async () => { await client.close(); await service.close(); await fs.rm(profile, { recursive: true, force: true }); });
  return { profile, service, events, sent, opened, conversation, recorder, client };
}
const q = { id: 'arms', question: 'Swap the motion or physical arms?', options: [{ label: 'Motion' }, { label: 'Sides' }] };
const ask = (id, turnId = 'turn') => ({ id, method: 'item/tool/requestUserInput', params: { threadId: 'thread', turnId, isBlocking: false, questions: [q] } });
const answer = label => ({ arms: { answers: [label] } });

test('nonblocking questions remain answerable while output continues; resolved requests cancel individually', async t => {
  const f = await setup(t);
  f.client.receive(ask(1)); f.client.receive(ask(2));
  f.client.receive({ method: 'item/agentMessage/delta', params: { delta: 'I can keep inspecting.' } });
  assert.equal(f.service.questions.size, 2);
  const ids = [...f.service.questions.keys()];
  f.client.receive({ method: 'serverRequest/resolved', params: { requestId: 1, threadId: 'thread' } });
  assert.throws(() => f.service.answerQuestion({ questionId: ids[0], answers: answer('Motion') }), /no longer/);
  assert.equal(f.service.questions.has(ids[1]), true);
  f.service.answerQuestion({ questionId: ids[1], answers: answer('Sides') });
  await Promise.all([...f.client.interactionWork]);
  assert.deepEqual(f.sent, [{ id: 2, result: { answers: answer('Sides') } }]);
  const parts = f.conversation.transcript.flatMap(m => m.parts || []).filter(p => p.type === 'question');
  assert.equal(parts[0].status, 'stopped'); assert.match(parts[0].reason, /provider cancelled/);
  assert.equal(parts[1].status, 'done');
});

test('turn completion cancels its pending controls and leaves a readable reason without fabricating answers', async t => {
  const f = await setup(t); f.client.receive(ask(1));
  f.client.receive({ method: 'turn/completed', params: { turn: { id: 'turn', status: 'completed' } } });
  await Promise.all([...f.client.interactionWork]);
  assert.equal(f.service.questions.size, 0); assert.deepEqual(f.sent, []);
  const part = f.recorder.reply.parts[0]; assert.equal(part.status, 'stopped'); assert.match(part.reason, /turn ended/); assert.equal(part.questions[0].question, q.question);
});

test('explicit user cancellation returns a cancelled RPC and removes the live controls', async t => {
  const f = await setup(t); f.client.receive(ask(1));
  f.service.answerQuestion({ questionId: [...f.service.questions.keys()][0], cancel: true });
  await Promise.all([...f.client.interactionWork]);
  assert.equal(f.sent[0].error.code, -32800); assert.equal(f.recorder.reply.parts[0].status, 'stopped');
});

test('permission requests and legacy approvals get protocol-correct refusals, never grants', async t => {
  const f = await setup(t);
  for (const [id, method] of ['item/permissions/requestApproval', 'item/commandExecution/requestApproval', 'item/fileChange/requestApproval', 'applyPatchApproval', 'execCommandApproval'].entries()) f.client.receive({ id, method, params: {} });
  assert.deepEqual(f.sent[0].result, { permissions: {}, scope: 'turn' });
  assert.deepEqual(f.sent[1].result, { decision: 'decline' }); assert.deepEqual(f.sent[2].result, { decision: 'decline' });
  assert.match(f.sent[3].result.decision.denied.rejection, /disabled/); assert.match(f.sent[4].result.decision.denied.rejection, /disabled/);
});

test('warnings, startup failures, usage limits, plans and model switches stay recorded after later tool activity', async t => {
  const f = await setup(t);
  for (const [method, params] of [
    ['warning', { message: 'Provider warning' }], ['configWarning', { summary: 'Invalid provider option', details: 'Change the connection setting' }],
    ['mcpServer/startupStatus/updated', { name: 'mdlxl', status: 'failed', error: 'Connection refused' }],
    ['account/rateLimits/updated', { rateLimits: { limitId: 'weekly', primary: { usedPercent: 0, resetsAt: 1234 } } }],
    ['model/rerouted', { fromModel: 'chosen', toModel: 'fallback', reason: 'limit' }],
    ['turn/plan/updated', { plan: [{ step: 'Inspect arms', status: 'inProgress' }] }],
  ]) f.client.receive({ method, params });
  f.client.receive({ method: 'item/started', params: { item: { id: 'read', type: 'mcpToolCall', tool: 'mdlxl_read', arguments: {} } } });
  f.recorder.finish();
  const notices = f.recorder.reply.parts.filter(p => p.type === 'provider-notice'); assert.equal(notices.length, 6);
  assert.match(JSON.stringify(notices), /Connection refused/); assert.match(JSON.stringify(notices), /primary: 0% used/);
  f.client.receive({ method: 'account/rateLimits/updated', params: { rateLimits: { limitId: 'weekly', primary: null, limitName: 'Account weekly' } } });
  assert.match(f.recorder.reply.parts.at(-1).detail, /primary: 0% used/);
});

test('dynamic tool calls use only registered editor tools; other calls return structured failures', async t => {
  const f = await setup(t); let calls = 0;
  f.client.tools = [{ name: 'mdlxl_read', inputSchema: { type: 'object', properties: {}, additionalProperties: false } }];
  f.client.call = async () => { calls++; return { model: 'read-only' }; };
  f.client.receive({ id: 1, method: 'item/tool/call', params: { tool: 'mdlxl_read', arguments: {} } });
  f.client.receive({ id: 2, method: 'item/tool/call', params: { tool: 'Bash', arguments: {} } });
  await tick(); assert.equal(calls, 1);
  assert.equal(f.sent.find(s => s.id === 1).result.success, true); assert.equal(f.sent.find(s => s.id === 2).result.success, false);
});

test('inactive external auth and attestation paths report actionable failures without inventing credentials', async t => {
  const f = await setup(t);
  f.client.receive({ id: 1, method: 'account/chatgptAuthTokens/refresh' }); f.client.receive({ id: 2, method: 'attestation/generate' });
  assert.equal(f.sent[0].error.code, -32001); assert.match(f.sent[0].error.message, /Sign in again/);
  assert.equal(f.sent[1].error.code, -32002); assert.equal(f.sent.some(s => s.result?.token || s.result?.accessToken), false);
  assert.equal(f.events.some(e => e.type === 'error' && e.authRequired), true);
});

const formParams = { mode: 'form', message: 'Choose the model settings', requestedSchema: { type: 'object', required: ['count', 'visible', 'parts'], properties: {
  count: { type: 'integer', minimum: 1, maximum: 4, title: 'Copy count' }, visible: { type: 'boolean', title: 'Visible?' },
  parts: { type: 'array', title: 'Protected parts', items: { type: 'string', enum: ['shoulders', 'axe'] }, minItems: 1 },
  note: { type: 'string', title: 'Optional note' },
} } };
test('MCP forms preserve field types, optional omissions and multiselection; invalid answers keep the request live', async t => {
  const f = await setup(t); f.client.receive({ id: 1, method: 'mcpServer/elicitation/request', params: formParams });
  const id = [...f.service.questions.keys()][0];
  const input = { count: { answers: ['2.5'] }, visible: { answers: ['No'] }, parts: { answers: ['shoulders', 'axe'] }, note: { answers: [] } };
  assert.throws(() => f.service.answerQuestion({ questionId: id, answers: input }), /valid integer/); assert.equal(f.service.questions.has(id), true);
  input.count.answers = ['2']; f.service.answerQuestion({ questionId: id, answers: input }); await Promise.all([...f.client.interactionWork]);
  assert.deepEqual(f.sent[0].result, { action: 'accept', content: { count: 2, visible: false, parts: ['shoulders', 'axe'] } });
  const form = mcpForm(formParams); assert.equal(form.questions[0].allowCustom, true);
});

test('MCP URL input opens only on an explicit click for its live request and supports decline', async t => {
  const f = await setup(t); f.client.receive({ id: 1, method: 'mcpServer/elicitation/request', params: { mode: 'url', url: 'https://example.com/input', message: 'Complete this input' } });
  const questionId = [...f.service.questions.keys()][0]; assert.deepEqual(f.opened, []);
  await f.service.openQuestionLink({ questionId, id: 'confirm' }); assert.deepEqual(f.opened, ['https://example.com/input']);
  f.service.answerQuestion({ questionId, answers: { confirm: { answers: ['Decline'] } } }); await Promise.all([...f.client.interactionWork]);
  assert.equal(f.sent[0].result.action, 'decline'); await assert.rejects(f.service.openQuestionLink({ questionId, id: 'confirm' }), /no longer/);
});

async function claudeFixture(f) {
  await fs.copyFile(new URL('./fixtures/ai-claude-question-agent.cjs', import.meta.url), path.join(f.service.directory, 'agent.js'));
  const executable = path.join(f.service.directory, process.platform === 'win32' ? 'claude.cmd' : 'claude');
  if (process.platform === 'win32') await fs.writeFile(executable, '@"%dp0%\\agent.js" %*\r\n');
  else { await fs.writeFile(executable, '#!' + process.execPath + '\n' + await fs.readFile(path.join(f.service.directory, 'agent.js'))); await fs.chmod(executable, 0o700); }
  return executable;
}
for (const cancel of [false, true]) test('Claude structured questions use the shared route' + (cancel ? ' and honour provider cancellation' : ', return multiple choices and refuse Bash'), async t => {
  const f = await setup(t), executable = await claudeFixture(f);
  const askUser = (params, signal) => {
    const result = f.service.askUser(f.conversation, f.recorder, params, signal);
    if (!cancel) f.service.answerQuestion({ questionId: [...f.service.questions.keys()][0], answers: { 0: { answers: ['Shoulders', 'Axe'] } } });
    return result;
  };
  await runClaude({ askUser, settings: { executable }, directory: f.service.directory, tools: [], call: () => {}, system: '', prompt: cancel ? 'cancel-by-provider' : 'Ask the owner', images: [], conversation: f.conversation, signal: new AbortController().signal, event: value => f.recorder.event(value) });
  const question = f.recorder.reply.parts.find(p => p.type === 'question'); assert.equal(question.status, cancel ? 'stopped' : 'done');
  if (!cancel) {
    const responses = (await fs.readFile(path.join(f.service.directory, 'claude-control-answers.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(responses[0].response.response.updatedInput.answers['Which parts should stay unchanged?'], ['Shoulders', 'Axe']);
    assert.equal(responses[1].response.response.behavior, 'deny');
  }
  assert.equal(f.service.questions.size, 0); assert.ok(f.recorder.reply.parts.some(p => p.type === 'provider-notice'));
});


test('privileged MCP tool-approval forms cannot bypass the registered-tool boundary', async t => {
  const f = await setup(t);
  for (const [id, kind] of ['mcp_tool_call', 'tool_suggestion'].entries()) f.client.receive({ id, method: 'mcpServer/elicitation/request', params: { ...formParams, _meta: { codex_approval_kind: kind } } });
  assert.deepEqual(f.sent.map(s => s.result), [{ action: 'decline' }, { action: 'decline' }]);
  assert.equal(f.service.questions.size, 0);
});

test('editor shutdown rejects every pending question even outside a tracked provider task', async t => {
  const f = await setup(t);
  const pending = f.service.askUser(f.conversation, f.recorder, { questions: [q] }, new AbortController().signal);
  const rejected = assert.rejects(pending, /editor closed/);
  await f.service.close(); await rejected;
  assert.equal(f.service.questions.size, 0); assert.equal(f.recorder.reply.parts[0].status, 'stopped');
});

test('No on an empty MCP form is a decline, and provider errors remain recorded', async t => {
  const f = await setup(t);
  f.client.receive({ id: 1, method: 'mcpServer/elicitation/request', params: { mode: 'form', message: 'Continue?', requestedSchema: { type: 'object', properties: {} } } });
  f.service.answerQuestion({ questionId: [...f.service.questions.keys()][0], answers: { confirm: { answers: ['No'] } } });
  await Promise.all([...f.client.interactionWork]); assert.deepEqual(f.sent[0].result, { action: 'decline' });
  f.client.receive({ method: 'error', params: { error: { message: 'Provider failure' }, willRetry: true } });
  f.client.receive({ method: 'item/agentMessage/delta', params: { delta: 'Working again' } });
  const notice = f.recorder.reply.parts.find(p => p.type === 'provider-notice'); assert.equal(notice.text, 'Provider failure'); assert.match(notice.detail, /will retry/);
});
