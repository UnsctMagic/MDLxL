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

// Launchers exactly as npm's cmd-shim writes them for each package's bin entry.
const npmScriptLauncher = entry =>
  `@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n\r\nIF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n) ELSE (\r\n  SET "_prog=node"\r\n  SET PATHEXT=%PATHEXT:;.JS;=;%\r\n)\r\n\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\${entry}" %*\r\n`;
const npmBinaryLauncher = entry =>
  `@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n"%dp0%\\${entry}"   %*\r\n`;
async function homes(t) {
  const f = await fixture(t);
  f.env.APPDATA = path.join(f.directory, 'Roaming');
  f.env.USERPROFILE = path.join(f.directory, 'home');
  return f;
}

test('Claude native installer is found without PATH', async t => {
  const f = await homes(t), { resolveExecutable } = processModule();
  const expected = await f.file(path.join('home', '.local', 'bin', 'claude.exe'));
  assert.equal(resolveExecutable('claude', f.env), expected);
  assert.equal(resolveExecutable(path.join(f.directory, 'removed', 'claude.exe'), f.env), expected);
});

test('Claude desktop app copies are found in every known layout, newest first', async t => {
  const f = await homes(t), { resolveExecutable } = processModule();
  await f.file(path.join('Claude-Data', 'claude_abc', 'claude-code', '2.1.304', 'aed6', 'claude.exe'), 1000);
  await f.file(path.join('Roaming', 'Claude', 'claude-code', '2.1.200', 'claude.exe'), 2000);
  const msix = path.join('Packages', 'Claude_abc', 'LocalCache', 'Roaming', 'Claude', 'claude-code');
  await f.file(path.join(msix, '2.1.250', 'claude.exe'), 3000);
  const newest = await f.file(path.join('Claude-Data', 'claude_abc', 'claude-code', '2.1.308', 'c17a', 'claude.exe'), 4000);
  await f.file(path.join('Claude-Data', 'claude_abc', 'claude-code', '2.1.309', 'partial', '.payload'), 5000);
  assert.equal(resolveExecutable('claude', f.env), newest);
});

test('a launcher folder wins over a desktop copy, and PATH wins over both', async t => {
  const f = await homes(t), { resolveExecutable } = processModule();
  await f.file(path.join(f.bin, 'desktop', 'codex.exe'), 5000);
  const standalone = await f.file(path.join('Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe'));
  assert.equal(resolveExecutable('codex', f.env), standalone);
  const onPath = await f.file(path.join('tools', 'codex.exe'));
  f.env.PATH = path.dirname(onPath);
  assert.equal(resolveExecutable('codex', f.env), onPath);
});

test('npm, pnpm, WinGet and Scoop launcher folders are searched for both CLIs', async t => {
  for (const [folder, file] of [
    [path.join('Roaming', 'npm'), 'codex.cmd'],
    ['pnpm', 'claude.cmd'],
    [path.join('Microsoft', 'WinGet', 'Links'), 'claude.exe'],
    [path.join('home', 'scoop', 'shims'), 'codex.exe'],
  ]) {
    const f = await homes(t), { resolveExecutable } = processModule();
    const expected = await f.file(path.join(folder, file));
    assert.equal(resolveExecutable(path.parse(file).name, f.env), expected);
  }
});

test('Codex in a Store-virtualized folder is found', async t => {
  const f = await homes(t), { resolveExecutable } = processModule();
  const bin = path.join('Packages', 'OpenAI.Codex_2p2n', 'LocalCache', 'Local', 'OpenAI', 'Codex', 'bin');
  const expected = await f.file(path.join(bin, 'abc', 'codex.exe'));
  assert.equal(resolveExecutable('codex', f.env), expected);
});

test('each provider only ever finds its own CLI', async t => {
  const f = await homes(t), { resolveExecutable } = processModule();
  await f.file(path.join('home', '.local', 'bin', 'claude.exe'));
  await f.file(path.join('Claude-Data', 'claude_abc', 'claude-code', '2', 'h', 'claude.exe'));
  assert.throws(() => resolveExecutable('codex', f.env), /Cannot find codex/);
  const g = await homes(t);
  await g.file(path.join('Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe'));
  await g.file(path.join(g.bin, 'v', 'codex.exe'));
  assert.throws(() => resolveExecutable('claude', g.env), /Cannot find claude/);
});

test('npm Claude launcher runs its native binary directly', async t => {
  const f = await homes(t), { spawnAgent, spawns } = processModule();
  const entry = 'node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe';
  const launcher = path.join(f.directory, 'Roaming', 'npm', 'claude.cmd');
  await fs.mkdir(path.dirname(launcher), { recursive: true });
  await fs.writeFile(launcher, npmBinaryLauncher(entry));
  spawnAgent('claude', ['auth', 'login'], { env: f.env });
  assert.equal(spawns[0][0], path.resolve(path.dirname(launcher), entry));
  assert.deepEqual(spawns[0][1], ['auth', 'login']);
  assert.equal(spawns[0][2].shell, false);
});

test('npm Codex launcher runs its script with Node found like the launcher does', async t => {
  const f = await homes(t), { spawnAgent, spawns } = processModule();
  const entry = 'node_modules\\@openai\\codex\\bin\\codex.js';
  const launcher = path.join(f.directory, 'Roaming', 'npm', 'codex.cmd');
  await fs.mkdir(path.dirname(launcher), { recursive: true });
  await fs.writeFile(launcher, npmScriptLauncher(entry));
  const node = await f.file(path.join('Program Files', 'nodejs', 'node.exe'));
  f.env.ProgramFiles = path.join(f.directory, 'Program Files');
  spawnAgent('codex', ['app-server'], { env: f.env });
  assert.equal(spawns[0][0], node);
  assert.deepEqual([...spawns[0][1]], [path.resolve(path.dirname(launcher), entry), 'app-server']);
  const adjacent = await f.file(path.join('Roaming', 'npm', 'node.exe'));
  spawnAgent('codex', ['app-server'], { env: f.env });
  assert.equal(spawns[1][0], adjacent);
});
