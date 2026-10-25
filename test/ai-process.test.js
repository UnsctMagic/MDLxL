import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../electron/ai-process.cjs', import.meta.url), 'utf8');
// Run the Windows discovery branch on every CI host with real temporary files.
// Only child spawning and the platform are substituted; path/fs use the host OS.
function processModule(platform = 'win32') {
  const module = { exports: {} }, spawns = [];
  vm.runInNewContext(source, {
    module,
    process: { platform, env: {} },
    require: name => name === 'node:child_process'
      ? { spawn: (...args) => { spawns.push(args); return { fixture: true }; } }
      : require(name),
  });
  return { ...module.exports, spawns };
}
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlxl-ai-path-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  async function file(relative, modified = 1000) {
    const full = path.join(directory, relative);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, 'fixture');
    await fs.utimes(full, modified, modified);
    return full;
  }
  const bin = path.join('OpenAI', 'Codex', 'bin');
  return { directory, file, bin, env: { PATH: '', LOCALAPPDATA: directory } };
}

test('Codex desktop is discovered without PATH and unrelated helper directories are ignored', async t => {
  const f = await fixture(t), { resolveExecutable } = processModule();
  const expected = await f.file(path.join(f.bin, '2993767bd1dfb009', 'codex.exe'));
  await f.file(path.join(f.bin, 'c602dfdab3808440', 'rg.exe'), 5000);
  await f.file(path.join(f.bin, 'not-a-directory'));
  assert.equal(resolveExecutable('codex', f.env), expected);
  assert.equal(resolveExecutable('codex.exe', f.env), expected);
});

test('newest Codex binary wins independently of hash order or newer helper directories', async t => {
  const f = await fixture(t), { resolveExecutable } = processModule();
  await f.file(path.join(f.bin, 'ffffffffffffffff', 'codex.exe'), 1000);
  const newest = await f.file(path.join(f.bin, '1111111111111111', 'codex.exe'), 2000);
  await f.file(path.join(f.bin, 'aaaaaaaaaaaaaaaa', 'rg.exe'), 3000);
  await fs.mkdir(path.join(f.directory, f.bin, 'bbbbbbbbbbbbbbbb', 'codex.exe'), { recursive: true });
  assert.equal(resolveExecutable('codex', f.env), newest);
});

test('working custom executable keeps priority over PATH and desktop discovery', async t => {
  const f = await fixture(t), { resolveExecutable } = processModule();
  const custom = await f.file(path.join('custom', 'codex.exe'));
  await f.file(path.join('path', 'codex.exe'), 2000);
  await f.file(path.join(f.bin, 'latest', 'codex.exe'), 3000);
  f.env.PATH = path.join(f.directory, 'path');
  assert.equal(resolveExecutable(custom, f.env), custom);
});

test('PATH remains preferred over the desktop installation, including Windows Path casing', async t => {
  const f = await fixture(t), { resolveExecutable } = processModule();
  const expected = await f.file(path.join('npm', 'codex.cmd'));
  await f.file(path.join(f.bin, 'latest', 'codex.exe'), 2000);
  f.env.Path = path.join(f.directory, 'npm');
  assert.equal(resolveExecutable('codex', f.env), expected);
});

test('a missing saved version path recovers to the installed desktop binary', async t => {
  const f = await fixture(t), { resolveExecutable } = processModule();
  const old = path.join(f.directory, f.bin, 'removed-version', 'codex.exe');
  const current = await f.file(path.join(f.bin, 'current-version', 'codex.exe'));
  assert.equal(resolveExecutable(old, f.env), current);
});

test('a missing saved Codex path can recover through PATH', async t => {
  const f = await fixture(t), { resolveExecutable } = processModule();
  const expected = await f.file(path.join('cli', 'codex.exe'));
  f.env.PATH = path.join(f.directory, 'cli');
  assert.equal(resolveExecutable(path.join(f.directory, 'removed', 'codex.cmd'), f.env), expected);
});

test('an update is detected on the next launch without restarting MDLxL or changing settings', async t => {
  const f = await fixture(t), { resolveExecutable, spawnAgent, spawns } = processModule();
  const old = await f.file(path.join(f.bin, 'first', 'codex.exe'));
  assert.equal(resolveExecutable(old, f.env), old);
  await fs.rm(path.dirname(old), { recursive: true });
  const current = await f.file(path.join(f.bin, 'second', 'codex.exe'), 2000);
  const options = { env: f.env, cwd: f.directory };
  const args = ['app-server'];
  spawnAgent(old, args, options);
  assert.equal(spawns[0][0], current);
  assert.equal(spawns[0][1], args);
  assert.equal(spawns[0][2].env, f.env);
  assert.equal(spawns[0][2].cwd, f.directory);
  assert.equal(spawns[0][2].shell, false);
  assert.equal(spawns[0][2].windowsHide, true);
  assert.equal(f.env.LOCALAPPDATA, f.directory);
});

test('a removed candidate during an update is skipped and the remaining Codex binary is found', async t => {
  const f = await fixture(t);
  const candidate = await f.file(path.join(f.bin, 'removed-during-scan', 'codex.exe'), 2000);
  const expected = await f.file(path.join(f.bin, 'remaining', 'codex.exe'));
  const module = { exports: {} }, realFs = require('node:fs');
  vm.runInNewContext(source, {
    module,
    process: { platform: 'win32', env: {} },
    require: name => name === 'node:fs' ? {
      ...realFs,
      statSync: full => {
        if (full === candidate) throw Object.assign(Error('Removed by updater'), { code: 'ENOENT' });
        return realFs.statSync(full);
      },
    } : require(name),
  });
  assert.equal(module.exports.resolveExecutable('codex', f.env), expected);
});

test('an absent Codex installation retains the actionable missing-CLI error', async t => {
  const f = await fixture(t), { resolveExecutable } = processModule();
  assert.throws(() => resolveExecutable('codex', f.env), /Cannot find codex\. Install its CLI/);
  assert.throws(() => resolveExecutable('codex', { PATH: '' }), /Cannot find codex/);
});

test('Codex installation root is read from LocalAppData as well as LOCALAPPDATA', async t => {
  const f = await fixture(t), { resolveExecutable } = processModule();
  const expected = await f.file(path.join(f.bin, 'current', 'codex.exe'));
  assert.equal(resolveExecutable('codex', { Path: '', LocalAppData: f.directory }), expected);
});

test('Claude, Node, unrelated custom paths and non-Windows lookups do not select Codex', async t => {
  const f = await fixture(t), { resolveExecutable } = processModule();
  await f.file(path.join(f.bin, 'current', 'codex.exe'));
  for (const command of ['claude', 'node', path.join(f.directory, 'other.exe')])
    assert.throws(() => resolveExecutable(command, f.env), /Cannot find/);
  assert.throws(() => processModule('linux').resolveExecutable('codex', f.env), /Cannot find codex/);
});

test('custom CLI validation still rejects unrelated and newly entered missing executables', async t => {
  const f = await fixture(t), { checkAgentExecutable } = processModule();
  const custom = await f.file(path.join('custom', 'codex.exe'));
  assert.equal(checkAgentExecutable('codex', custom), custom);
  assert.throws(() => checkAgentExecutable('codex', path.join(f.directory, 'other.exe')), /own CLI|CLI path/);
  assert.throws(() => checkAgentExecutable('codex', path.join(f.directory, 'missing', 'codex.exe')), /Cannot find/);
});
