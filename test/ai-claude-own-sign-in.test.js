import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { tempDir } from './helpers/fixtures.cjs';

const require = createRequire(import.meta.url);
const { providerEnvironment } = require('../electron/ai-process.cjs');
const { providerAuth } = require('../electron/ai-providers.cjs');

// MDLxL does not offer a Claude sign-in: Claude Code runs on the user's own
// installation and sign-in (`claude auth login` in their own terminal).
test('Claude Code uses the PC\'s own Claude Code sign-in, Codex keeps its MDLxL home', () => {
  const directory = path.join('D:', 'mdlxl-ai');
  const saved = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = path.join('D:', 'own-claude');
  try {
    assert.equal(providerEnvironment(directory, 'claude').CLAUDE_CONFIG_DIR, path.join('D:', 'own-claude'));
    delete process.env.CLAUDE_CONFIG_DIR;
    assert.equal(providerEnvironment(directory, 'claude').CLAUDE_CONFIG_DIR, undefined);
    assert.equal(providerEnvironment(directory, 'codex').CODEX_HOME, path.join(directory, 'codex'));
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = saved;
  }
});

test('MDLxL never signs in or out of Claude Code; it points to claude auth login', async t => {
  const directory = tempDir('claude-own-sign-in-');
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const options = { directory, signal: new AbortController().signal, openExternal: () => assert.fail('no browser'), notify: () => {} };
  // A missing executable proves nothing was started: the refusal comes first.
  const settings = { provider: 'claude', executable: path.join(directory, 'missing-claude.exe') };
  for (const action of ['login', 'logout'])
    await assert.rejects(providerAuth(settings, action, options), /claude auth login/);
});
