const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
function providerEnvironment(directory, provider) {
  const env = { ...process.env, TEMP: path.join(directory, 'temp'), TMP: path.join(directory, 'temp') };
  for (const key of [
    'OPENAI_API_KEY',
    'OPENAI_BASE_URL',
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_BASE_URL',
    'CLAUDE_CODE_OAUTH_TOKEN',
    'CLAUDE_CODE_USE_BEDROCK',
    'CLAUDE_CODE_USE_VERTEX',
    'CLAUDE_CODE_USE_FOUNDRY',
  ])
    delete env[key];
  env[provider === 'codex' ? 'CODEX_HOME' : 'CLAUDE_CONFIG_DIR'] = path.join(directory, provider);
  return env;
}
// The desktop app replaces its hashed bin directory on update. Resolve it at
// launch time instead of saving another version-specific path in MDLxL's profile.
function windowsCodexExecutable(env) {
  const localAppData = env.LOCALAPPDATA || env.LocalAppData;
  if (!localAppData) return;
  const directory = path.join(localAppData, 'OpenAI', 'Codex', 'bin');
  let versions;
  try {
    versions = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return;
    throw error;
  }
  const candidates = [];
  for (const version of versions) {
    if (!version.isDirectory()) continue;
    const executable = path.join(directory, version.name, 'codex.exe');
    let stat;
    try {
      stat = fs.statSync(executable);
    } catch (error) {
      // An update may remove an older version while the directory is scanned.
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') continue;
      throw error;
    }
    if (stat.isFile()) candidates.push({ executable, modified: stat.mtimeMs });
  }
  candidates.sort((a, b) => b.modified - a.modified || a.executable.localeCompare(b.executable));
  return candidates[0]?.executable;
}
function resolveExecutable(command, env = process.env) {
  const codex = process.platform === 'win32' && /^codex(?:\.exe|\.cmd)?$/i.test(path.basename(command));
  // Keep a working explicit path first. A missing saved Codex path can recover
  // through PATH or the current desktop installation, including in an open app.
  const commands = codex && path.isAbsolute(command) ? [command, 'codex'] : [command];
  for (const candidate of commands) {
    const names =
      process.platform === 'win32' && !path.extname(candidate)
        ? [candidate + '.exe', candidate + '.cmd', candidate]
        : [candidate];
    const directories = path.isAbsolute(candidate) ? [''] : (env.PATH || env.Path || '').split(path.delimiter);
    for (const directory of directories)
      for (const name of names) {
        const full = directory ? path.join(directory, name) : name;
        if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
      }
  }
  if (codex) {
    const installed = windowsCodexExecutable(env);
    if (installed) return installed;
  }
  throw Error(`Cannot find ${command}. Install its CLI or choose its executable in AI connection settings.`);
}
function spawnAgent(command, args, options = {}) {
  const executable = resolveExecutable(command, options.env);
  // npm launchers are shell programs. Run their adjacent JS entry via Node
  // instead of putting prompts or credentials through cmd.exe quoting.
  if (/\.cmd$/i.test(executable)) {
    const source = fs.readFileSync(executable, 'utf8'),
      match = source.match(/%dp0%\\([^"\r\n]+\.js)/i) || source.match(/%~dp0\\([^"\r\n]+\.js)/i);
    if (!match) throw Error('Choose the native CLI executable; this launcher cannot be run without a shell.');
    return spawn(
      resolveExecutable('node', options.env),
      [path.resolve(path.dirname(executable), match[1]), ...args],
      { ...options, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
    );
  }
  return spawn(executable, args, {
    ...options,
    shell: false,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
// A custom CLI path may only name that provider's own CLI, so a setting can
// never make MDLxL launch an unrelated program.
function checkAgentExecutable(provider, value) {
  if (!value) return '';
  if (!path.isAbsolute(value)) throw Error('Choose the full path to the ' + provider + ' CLI.');
  const extension = path.extname(value).toLowerCase(),
    name = path.basename(value, path.extname(value)).toLowerCase();
  if (name !== provider || !['', '.exe', '.cmd'].includes(extension))
    throw Error(
      'The CLI path must point to ' +
        provider +
        (process.platform === 'win32' ? '.exe or ' + provider + '.cmd.' : '.'),
    );
  if (!fs.existsSync(value) || !fs.statSync(value).isFile()) throw Error('Cannot find ' + value + '.');
  return value;
}
function stopAgent(child) {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null || child.stopping) return;
  child.stopping = true;
  if (process.platform === 'win32') {
    const killer = spawn(
      path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'),
      ['/PID', String(child.pid), '/T', '/F'],
      { windowsHide: true, stdio: 'ignore' },
    );
    killer.on('error', () => child.kill());
    return;
  }
  child.kill('SIGTERM');
  // A CLI that ignores SIGTERM must not keep MDLxL from quitting.
  const force = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }, 3000);
  force.unref();
  child.once('exit', () => clearTimeout(force));
}
function lines(stream, callback, onError = () => {}) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', chunk => {
    buffer += chunk;
    if (buffer.length > 32 * 1024 * 1024) {
      onError(Error('Agent output line is too large.'));
      buffer = '';
      return;
    }
    let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + 1);
      if (line) callback(line);
    }
  });
  stream.on('end', () => {
    if (buffer.trim()) callback(buffer.trim());
  });
}
module.exports = {
  spawnAgent,
  stopAgent,
  lines,
  resolveExecutable,
  providerEnvironment,
  checkAgentExecutable,
};
