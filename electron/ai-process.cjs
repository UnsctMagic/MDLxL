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
// PATH can omit a CLI, for example one installed after Windows sign-in or one
// that came with a desktop app. These are the places the official installers
// use on Windows; the CLI is looked up there again at every launch.
function windowsInstallations(name, env) {
  const local = env.LOCALAPPDATA || env.LocalAppData,
    roaming = env.APPDATA || env.AppData,
    home = env.USERPROFILE || env.UserProfile,
    programs = env.ProgramFiles || env.PROGRAMFILES;
  const at = (root, ...parts) => root && path.join(root, ...parts);
  // Launcher folders: standalone installers, npm, pnpm, WinGet and Scoop.
  const shared = [at(roaming, 'npm'), at(local, 'pnpm'), at(local, 'Microsoft', 'WinGet', 'Links'), at(home, 'scoop', 'shims')];
  // Desktop apps keep a private copy per version and remove old ones on update.
  const known = {
    codex: {
      folders: [at(local, 'Programs', 'OpenAI', 'Codex', 'bin'), ...shared],
      versions: [
        [local, 'OpenAI', 'Codex', 'bin', '*', 'codex.exe'],
        [local, 'Packages', 'OpenAI.Codex_*', 'LocalCache', 'Local', 'OpenAI', 'Codex', 'bin', '*', 'codex.exe'],
      ],
    },
    claude: {
      folders: [at(home, '.local', 'bin'), ...shared],
      versions: [
        [local, 'Claude-Data', '*', 'claude-code', '*', '*', 'claude.exe'],
        [roaming, 'Claude', 'claude-code', '*', 'claude.exe'],
        [roaming, 'Claude', 'claude-code', '*', '*', 'claude.exe'],
        [local, 'Packages', 'Claude_*', 'LocalCache', 'Roaming', 'Claude', 'claude-code', '*', 'claude.exe'],
        [local, 'Packages', 'Claude_*', 'LocalCache', 'Roaming', 'Claude', 'claude-code', '*', '*', 'claude.exe'],
      ],
    },
    node: { folders: [at(programs, 'nodejs')], versions: [] },
  }[name];
  if (!known) return { folders: [], versions: [] };
  return { folders: known.folders.filter(Boolean), versions: known.versions.filter(parts => parts[0]) };
}
// A folder that cannot be read simply offers no candidate; an update may also
// remove an older version while it is being scanned.
function expandPattern([root, ...parts]) {
  let paths = [root];
  for (const part of parts) {
    if (!part.includes('*')) {
      paths = paths.map(directory => path.join(directory, part));
      continue;
    }
    const prefix = part.slice(0, -1).toLowerCase();
    paths = paths.flatMap(directory => {
      try {
        return fs
          .readdirSync(directory, { withFileTypes: true })
          .filter(entry => entry.isDirectory() && entry.name.toLowerCase().startsWith(prefix))
          .map(entry => path.join(directory, entry.name));
      } catch {
        return [];
      }
    });
  }
  return paths;
}
function newestFile(patterns) {
  const candidates = [];
  for (const executable of patterns.flatMap(expandPattern)) {
    try {
      const stat = fs.statSync(executable);
      if (stat.isFile()) candidates.push({ executable, modified: stat.mtimeMs });
    } catch {}
  }
  candidates.sort((a, b) => b.modified - a.modified || a.executable.localeCompare(b.executable));
  return candidates[0]?.executable;
}
function isFile(full) {
  try {
    return fs.statSync(full).isFile();
  } catch {
    return false;
  }
}
function resolveExecutable(command, env = process.env) {
  const windows = process.platform === 'win32',
    known = windows && /^(codex|claude)(?:\.exe|\.cmd)?$/i.exec(path.basename(command)),
    name = known ? known[1].toLowerCase() : path.isAbsolute(command) ? '' : command.toLowerCase(),
    installations = windows ? windowsInstallations(name, env) : { folders: [], versions: [] };
  // Keep a working explicit path first. A missing saved CLI path recovers through
  // PATH or the current installation, so an update never strands the setting.
  const commands = known && path.isAbsolute(command) ? [command, name] : [command];
  for (const candidate of commands) {
    const names = windows && !path.extname(candidate) ? [candidate + '.exe', candidate + '.cmd', candidate] : [candidate];
    const directories = path.isAbsolute(candidate)
      ? ['']
      : [...(env.PATH || env.Path || '').split(path.delimiter), ...installations.folders];
    for (const directory of directories)
      for (const file of names) {
        const full = directory ? path.join(directory, file) : file;
        if (isFile(full)) return full;
      }
  }
  const installed = newestFile(installations.versions);
  if (installed) return installed;
  throw Error(`Cannot find ${command}. Install its CLI or choose its executable in AI connection settings.`);
}
function spawnAgent(command, args, options = {}) {
  const executable = resolveExecutable(command, options.env);
  const run = (file, fileArgs) =>
    spawn(file, fileArgs, { ...options, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  // npm launchers are shell programs. Run their target directly (a JS entry via
  // Node, as the launcher does) instead of putting prompts or credentials
  // through cmd.exe quoting.
  if (/\.cmd$/i.test(executable)) {
    const source = fs.readFileSync(executable, 'utf8'),
      folder = path.dirname(executable),
      script = source.match(/%~?dp0%?\\([^"\r\n]+\.js)"/i),
      binary = source.match(/%~?dp0%?\\([^"\r\n]+\.exe)"\s+%\*/i);
    if (script) {
      const node = path.join(folder, 'node.exe');
      return run(isFile(node) ? node : resolveExecutable('node', options.env), [
        path.resolve(folder, script[1]),
        ...args,
      ]);
    }
    if (binary) return run(path.resolve(folder, binary[1]), args);
    throw Error('Choose the native CLI executable; this launcher cannot be run without a shell.');
  }
  return run(executable, args);
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
