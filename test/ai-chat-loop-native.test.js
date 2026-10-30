import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { AI_TOOLS } from '../src/ai-tools.js';
import turns from './fixtures/ai-chat-loop-turns.json' with { type: 'json' };
import { tempDir } from './helpers/fixtures.cjs';
const require = createRequire(import.meta.url);
const { AiService } = require('../electron/ai-service.cjs');
const { runCodex } = require('../electron/ai-providers.cjs');

test('native CLI gets the timed-out tool error, continues reading, and the next turn gets a fresh signal', async t => {
  const profile = tempDir('ai-loop-native-');
  const events = [], sent = [];
  let service;
  const win = { isDestroyed: () => false, webContents: { send: (channel, payload) => {
    sent.push({ channel, payload });
    if (channel === 'ai:tool' && payload.name === 'mdlxl_context') setImmediate(() => service.pending.get(payload.id)?.finish(null, { target: 'selected', revision: 1 }));
  } } };
  service = new AiService({ root: path.resolve('.'), profile, electron: {}, getWindow: () => win });
  service.ready = true;
  await fs.mkdir(service.directory, { recursive: true });
  await fs.writeFile(path.join(service.directory, 'package.json'), '{"type":"commonjs"}');
  t.after(async () => { await service.close(); await fs.rm(profile, { recursive: true, force: true }); });
  const agent = path.join(service.directory, 'agent.js');
  await fs.copyFile(new URL('./fixtures/ai-chat-loop-agent.cjs', import.meta.url), agent);
  await fs.mkdir(path.join(service.directory, 'bin'));
  const executable = path.join(service.directory, 'bin', process.platform === 'win32' ? 'codex.cmd' : 'codex');
  if (process.platform === 'win32') await fs.writeFile(executable, '@"%dp0%\\..\\agent.js" %*\r\n');
  else { await fs.writeFile(executable, '#!' + process.execPath + '\n' + await fs.readFile(agent, 'utf8')); await fs.chmod(executable, 0o700); }
  const timeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (fn, delay, ...args) => timeout(fn, delay === 180000 ? 25 : delay, ...args));
  const conversation = { id: 'fixture', provider: 'codex', transcript: [], messages: [] };
  for (const prompt of [turns.turns['35'].text, 'Continue from the current model']) {
    const controller = new AbortController();
    await runCodex({ settings: { executable }, directory: service.directory, tools: AI_TOOLS, call: service.call.bind(service), system: '', prompt, images: [], conversation, signal: controller.signal, event: e => events.push(e) });
    assert.equal(controller.signal.aborted, false, 'a tool timeout must not abort its task');
    assert.equal(service.pending.size, 0);
  }
  assert.equal(events.filter(e => e.type === 'text' && /Continued after/.test(e.text)).length, 2);
  assert.equal(sent.filter(e => e.channel === 'ai:toolCancel').length, 2);
});
