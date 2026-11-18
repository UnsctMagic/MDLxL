const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { stopAgent } = require('./ai-process.cjs');

// Each chat has its own computer: a work folder kept for every prompt of that chat
// and deleted with it. Commands and files run there; scripts drive MDLxL through
// the job's local MCP server (mdlxl.py / mdlxl.mjs).
const CHAT_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const OUTPUT_CAP = 30000;
const DEFAULT_TIMEOUT = 120,
  MAX_TIMEOUT = 600;
const MAX_TEXT_FILE = 4 * 1024 * 1024,
  MAX_IMAGE = 5 * 1024 * 1024;
const IMAGE_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const CONNECTION_FILE = '.mdlxl-connection.json';
const CANCELLED = 'Request cancelled.';

function workFolderOf(aiDirectory, chatId) {
  if (!CHAT_ID.test(chatId || '')) throw Error('Invalid chat ID.');
  return path.join(aiDirectory, 'work', chatId);
}
async function removeWorkFolder(aiDirectory, chatId) {
  if (!CHAT_ID.test(chatId || '')) return false;
  const folder = workFolderOf(aiDirectory, chatId);
  const existed = await fs.stat(folder).then(() => true, () => false);
  await fs.rm(folder, { recursive: true, force: true });
  return existed;
}
// Environment variables every command of the chat sees.
function bridgeVariables(folder, connection) {
  const variables = {
    MDLXL_WORK: folder,
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
    PYTHONPATH: [folder, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
  };
  if (connection) Object.assign(variables, { MDLXL_URL: connection.url, MDLXL_AUTH: connection.auth, MDLXL_TARGET: connection.target || '' });
  return variables;
}
// The folder with the current helpers and this job's connection (the server and its
// key change with every job; the files stay).
async function prepareWorkFolder(folder, connection) {
  await fs.mkdir(path.join(folder, 'pictures'), { recursive: true });
  await fs.writeFile(path.join(folder, 'mdlxl.py'), PYTHON_CLIENT);
  await fs.writeFile(path.join(folder, 'mdlxl.mjs'), NODE_CLIENT);
  if (connection)
    await fs.writeFile(
      path.join(folder, CONNECTION_FILE),
      JSON.stringify({ url: connection.url, auth: connection.auth, target: connection.target || '' }),
      { mode: 0o600 },
    );
  return folder;
}

// Keeps the start and the end of long output.
function capOutput(text, cap = OUTPUT_CAP) {
  if (text.length <= cap) return text;
  const half = Math.floor(cap / 2);
  return (
    text.slice(0, half) +
    `\n[output cut: ${text.length} characters, showing the first and last ${half}]\n` +
    text.slice(-half)
  );
}
function powershell() {
  return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

function createComputer({ folder, env = process.env }) {
  const running = new Set();
  let counter = 0;
  const inside = full => {
    const relative = path.relative(folder, full);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  };
  const resolve = (file, write = false) => {
    if (typeof file !== 'string' || !file.trim()) throw Error('Give a file path.');
    const full = path.resolve(folder, file);
    if (write && !inside(full)) throw Error('Write inside the work folder (' + folder + '); use the shell for anything else.');
    return full;
  };
  const shown = full => (inside(full) ? path.relative(folder, full) || '.' : full);

  async function shell(command, timeout, signal) {
    if (typeof command !== 'string' || !command.trim()) throw Error('Give a command.');
    signal?.throwIfAborted?.();
    const seconds = Math.min(MAX_TIMEOUT, Math.max(1, Number(timeout) || DEFAULT_TIMEOUT));
    let file, args, script;
    if (process.platform === 'win32') {
      // A script file avoids command-line length and quoting limits; the BOM makes
      // Windows PowerShell read it as UTF-8.
      script = path.join(folder, '.mdlxl', `command-${process.pid}-${++counter}.ps1`);
      await fs.mkdir(path.dirname(script), { recursive: true });
      await fs.writeFile(
        script,
        '\ufeff$ProgressPreference = "SilentlyContinue"\n[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)\n$OutputEncoding = [Console]::OutputEncoding\n' +
          command +
          '\nif ($LASTEXITCODE) { exit $LASTEXITCODE }\n',
      );
      file = powershell();
      args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script];
    } else {
      file = '/bin/bash';
      args = ['-lc', command];
    }
    try {
      return await new Promise((done, fail) => {
        const child = spawn(file, args, { cwd: folder, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        running.add(child);
        // The start and the end of the output; the middle of a long output is cut.
        const half = OUTPUT_CAP / 2;
        let head = '',
          tail = '',
          total = 0,
          timedOut = false,
          cancelled = false;
        const add = chunk => {
          let text = chunk.toString('utf8');
          total += text.length;
          if (head.length < half) {
            const room = half - head.length;
            head += text.slice(0, room);
            text = text.slice(room);
          }
          if (text) tail = (tail + text).slice(-half);
        };
        child.stdout.on('data', add);
        child.stderr.on('data', add);
        const timer = setTimeout(() => {
          timedOut = true;
          stopAgent(child);
        }, seconds * 1000);
        const abort = () => {
          cancelled = true;
          stopAgent(child);
        };
        signal?.addEventListener?.('abort', abort, { once: true });
        child.on('error', error => {
          clearTimeout(timer);
          running.delete(child);
          fail(error);
        });
        child.on('close', code => {
          clearTimeout(timer);
          running.delete(child);
          signal?.removeEventListener?.('abort', abort);
          if (cancelled) return fail(Error(CANCELLED));
          const cut = total > head.length + tail.length ? `\n[output cut: ${total} characters, showing the first and last ${half}]\n` : '';
          let text = head + cut + tail;
          if (timedOut) text += `\n[stopped after ${seconds} s: the command ran too long; give timeout (up to ${MAX_TIMEOUT}) or run it in smaller parts]`;
          else if (code) text += `\n[exit code ${code}]`;
          done(text.trim() || '(no output)');
        });
      });
    } finally {
      if (script) await fs.rm(script, { force: true }).catch(() => {});
    }
  }

  async function readText(full) {
    const stat = await fs.stat(full).catch(() => null);
    if (!stat) throw Error('No file or folder at ' + shown(full) + '.');
    if (stat.isDirectory()) return { directory: true };
    if (stat.size > MAX_TEXT_FILE) throw Error('The file is larger than 4 MB; read parts of it with the shell.');
    return { text: await fs.readFile(full, 'utf8') };
  }
  async function listing(full) {
    const lines = [];
    const walk = async (dir, depth) => {
      for (const entry of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        if (lines.length >= 500 || ['node_modules', '.git', '__pycache__', '.mdlxl'].includes(entry.name)) continue;
        const child = path.join(dir, entry.name);
        lines.push('  '.repeat(depth) + entry.name + (entry.isDirectory() ? '/' : ''));
        if (entry.isDirectory() && depth < 1) await walk(child, depth + 1);
      }
    };
    await walk(full, 0);
    return shown(full) + '/\n' + (lines.join('\n') || '(empty)');
  }
  async function view(file, range) {
    const full = resolve(file);
    const read = await readText(full);
    if (read.directory) return listing(full);
    const lines = read.text.split(/\r?\n/);
    let start = 1,
      end = lines.length;
    if (Array.isArray(range) && range.length === 2) {
      start = Math.max(1, Math.floor(range[0]) || 1);
      end = range[1] === -1 ? lines.length : Math.min(lines.length, Math.floor(range[1]) || lines.length);
    }
    return capOutput(lines.slice(start - 1, end).map((line, i) => `${start + i}\t${line}`).join('\n'));
  }
  async function create(file, text) {
    if (typeof text !== 'string') throw Error('Give the file text.');
    const full = resolve(file, true);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, text);
    return `Wrote ${shown(full)} (${Buffer.byteLength(text)} bytes).`;
  }
  async function replace(file, oldText, newText = '') {
    if (typeof oldText !== 'string' || !oldText) throw Error('Give the exact text to replace.');
    const full = resolve(file, true);
    const read = await readText(full);
    if (read.directory) throw Error(shown(full) + ' is a folder.');
    const count = read.text.split(oldText).length - 1;
    if (!count) throw Error('No match for the text to replace in ' + shown(full) + '.');
    if (count > 1) throw Error(`${count} matches in ${shown(full)}; include more surrounding text so it matches once.`);
    await fs.writeFile(full, read.text.replace(oldText, () => String(newText ?? '')));
    return `Edited ${shown(full)}.`;
  }
  async function insert(file, line, text) {
    const full = resolve(file, true);
    const read = await readText(full);
    if (read.directory) throw Error(shown(full) + ' is a folder.');
    const lines = read.text.split('\n');
    if (!Number.isInteger(line) || line < 0 || line > lines.length) throw Error(`insert_line must be 0–${lines.length}.`);
    lines.splice(line, 0, ...String(text ?? '').split('\n'));
    await fs.writeFile(full, lines.join('\n'));
    return `Inserted into ${shown(full)} after line ${line}.`;
  }
  async function image(file) {
    const full = resolve(file);
    const type = IMAGE_TYPES[path.extname(full).toLowerCase()];
    if (!type) throw Error('Open a PNG, JPEG or WebP picture.');
    const stat = await fs.stat(full).catch(() => null);
    if (!stat?.isFile()) throw Error('No picture at ' + shown(full) + '.');
    if (stat.size > MAX_IMAGE) throw Error('The picture is larger than 5 MB; save a smaller one.');
    return { path: shown(full), image: `data:${type};base64,${(await fs.readFile(full)).toString('base64')}` };
  }
  const text = value => ({ toolText: value });

  async function run(name, args = {}, signal) {
    signal?.throwIfAborted?.();
    await fs.mkdir(folder, { recursive: true });
    switch (name) {
      // Anthropic's bash tool and the function-tool shell.
      case 'bash':
        if (args.restart) return text('Each command starts a fresh shell in the work folder; nothing to restart.');
        return text(await shell(args.command, args.timeout, signal));
      case 'shell':
        return text(await shell(args.command, args.timeout, signal));
      // Anthropic's text editor tool.
      case 'str_replace_based_edit_tool':
        if (args.command === 'view') return text(await view(args.path, args.view_range));
        if (args.command === 'create') return text(await create(args.path, args.file_text));
        if (args.command === 'str_replace') return text(await replace(args.path, args.old_str, args.new_str));
        if (args.command === 'insert') return text(await insert(args.path, args.insert_line, args.insert_text ?? args.new_str));
        throw Error('Use view, create, str_replace or insert.');
      case 'read_file':
        return text(
          await view(args.path, args.offset || args.limit ? [args.offset || 1, args.limit ? (args.offset || 1) + args.limit - 1 : -1] : undefined),
        );
      case 'write_file':
        return text(await create(args.path, args.text));
      case 'edit_file':
        return text(await replace(args.path, args.old_text, args.new_text));
      case 'view_image':
        return image(args.path);
      default:
        throw Error('Unknown computer tool: ' + name);
    }
  }
  return {
    folder,
    run,
    // Stop: every command still running is killed with its child processes.
    close() {
      for (const child of running) stopAgent(child);
      running.clear();
    },
  };
}

const PYTHON_CLIENT = `"""MDLxL from this work folder: call the editor's mdlxl_* tools on this chat's model.

    import mdlxl
    info = mdlxl.context()
    result = mdlxl.call('mdlxl_sample', {...})
    paths = mdlxl.capture('pose', samples=[{'view': 'front'}])   # PNG files in pictures/
    mdlxl.export_model('model.mdl')                              # model text in the work folder
    mdlxl.apply_file('model.mdl', 'Python edit')                 # back onto the model, one Undo step
"""
import base64, json, os, re, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))


class MdlxlError(Exception):
    pass


def _connection():
    try:
        with open(os.path.join(HERE, '${CONNECTION_FILE}'), encoding='utf-8') as f:
            c = json.load(f)
        return c['url'], c['auth'], c.get('target') or ''
    except (OSError, ValueError, KeyError):
        url, auth = os.environ.get('MDLXL_URL'), os.environ.get('MDLXL_AUTH')
        if not url or not auth:
            raise MdlxlError('No MDLxL connection: run this while an AI job of this chat is working.')
        return url, auth, os.environ.get('MDLXL_TARGET', '')


def _raw(tool, args=None, timeout=900):
    url, auth, target = _connection()
    name = tool if tool.startswith('mdlxl_') else 'mdlxl_' + tool
    body = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
                       'params': {'name': name, 'arguments': dict(args or {}, **({'target': target} if target else {}))}}).encode('utf-8')
    request = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + auth, 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        reply = json.loads(response.read().decode('utf-8'))
    if 'error' in reply:
        raise MdlxlError(reply['error'].get('message', 'MDLxL error'))
    result = reply['result']
    if result.get('isError'):
        raise MdlxlError(' '.join(c.get('text', '') for c in result.get('content', [])))
    return result.get('content', [])


def _value(text):
    try:
        return json.loads(text)
    except ValueError:
        return text


def call(tool, args=None, timeout=900):
    """Call an mdlxl_* tool. Returns its JSON result; pictures come back as {'value', 'images'}."""
    content = _raw(tool, args, timeout)
    texts = [c['text'] for c in content if c.get('type') == 'text']
    images = [c for c in content if c.get('type') == 'image']
    value = _value(texts[0]) if texts else None
    return {'value': value, 'images': images} if images else value


def context():
    return call('mdlxl_context', {})


def script(code, edit=False, label=None, scope=None, **more):
    args = dict(more, code=code, edit=edit)
    if label: args['label'] = label
    if scope: args['scope'] = scope
    return call('mdlxl_script', args)


def capture(name='capture', folder='pictures', **args):
    """Take pictures (mdlxl_capture arguments) and save them as PNG files. Returns [{'path', 'label'}]."""
    content = _raw('mdlxl_capture', args)
    os.makedirs(os.path.join(HERE, folder), exist_ok=True)
    saved, label = [], ''
    stem = re.sub(r'[^A-Za-z0-9_-]+', '-', name).strip('-') or 'capture'
    for c in content:
        if c.get('type') == 'text' and c.get('text', '').startswith('Image '):
            label = c['text'].split(': ', 1)[-1]
        elif c.get('type') == 'image':
            ext = {'image/jpeg': '.jpg', 'image/webp': '.webp'}.get(c.get('mimeType'), '.png')
            path = os.path.join(HERE, folder, '%s-%d%s' % (stem, len(saved) + 1, ext))
            with open(path, 'wb') as f:
                f.write(base64.b64decode(c['data']))
            saved.append({'path': path, 'label': label})
    return saved


def _path(path):
    return path if os.path.isabs(path) else os.path.join(HERE, path)


def export_model(path='model.mdl', format=None):
    """Write the model to a file (MDL text or MDX) in the work folder."""
    args = {'action': 'export', 'path': _path(path), 'overwrite': True}
    if format: args['format'] = format
    return call('mdlxl_document', args)


def apply_file(path, label='Apply file'):
    """Put an MDL/MDX file onto the model as one Undo step; returns the change report."""
    return call('mdlxl_document', {'action': 'apply', 'path': _path(path), 'label': label})


export = export_model
`;

const NODE_CLIENT = `// MDLxL from this work folder: call the editor's mdlxl_* tools on this chat's model.
//   import * as mdlxl from './mdlxl.mjs';
//   const info = await mdlxl.context();
//   const paths = await mdlxl.capture('pose', { samples: [{ view: 'front' }] }); // PNG files in pictures/
//   await mdlxl.exportModel('model.mdl'); await mdlxl.applyFile('model.mdl', 'Node edit');
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
function connection() {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(HERE, '${CONNECTION_FILE}'), 'utf8'));
    return { url: c.url, auth: c.auth, target: c.target || '' };
  } catch {
    if (!process.env.MDLXL_URL || !process.env.MDLXL_AUTH)
      throw Error('No MDLxL connection: run this while an AI job of this chat is working.');
    return { url: process.env.MDLXL_URL, auth: process.env.MDLXL_AUTH, target: process.env.MDLXL_TARGET || '' };
  }
}
function raw(tool, args = {}, timeout = 900000) {
  const { url, auth, target } = connection();
  const name = tool.startsWith('mdlxl_') ? tool : 'mdlxl_' + tool;
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: { ...args, ...(target ? { target } : {}) } } });
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method: 'POST', timeout, headers: {
      authorization: 'Bearer ' + auth, 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'content-length': Buffer.byteLength(body) } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        try {
          const reply = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (reply.error) throw Error(reply.error.message || 'MDLxL error');
          if (reply.result.isError) throw Error(reply.result.content.map(c => c.text || '').join(' '));
          resolve(reply.result.content || []);
        } catch (error) { reject(error); }
      });
    });
    request.on('timeout', () => request.destroy(Error('MDLxL call timed out.')));
    request.on('error', reject);
    request.end(body);
  });
}
const parse = text => { try { return JSON.parse(text); } catch { return text; } };
export async function call(tool, args = {}) {
  const content = await raw(tool, args);
  const texts = content.filter(c => c.type === 'text').map(c => c.text), images = content.filter(c => c.type === 'image');
  const value = texts.length ? parse(texts[0]) : null;
  return images.length ? { value, images } : value;
}
export const context = () => call('mdlxl_context');
export const script = (code, options = {}) => call('mdlxl_script', { edit: false, ...options, code });
export async function capture(name = 'capture', args = {}, folder = 'pictures') {
  const content = await raw('mdlxl_capture', args);
  fs.mkdirSync(path.join(HERE, folder), { recursive: true });
  const stem = name.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'capture', saved = [];
  let label = '';
  for (const c of content) {
    if (c.type === 'text' && c.text.startsWith('Image ')) label = c.text.split(': ').slice(1).join(': ');
    else if (c.type === 'image') {
      const ext = c.mimeType === 'image/jpeg' ? '.jpg' : c.mimeType === 'image/webp' ? '.webp' : '.png';
      const file = path.join(HERE, folder, stem + '-' + (saved.length + 1) + ext);
      fs.writeFileSync(file, Buffer.from(c.data, 'base64'));
      saved.push({ path: file, label });
    }
  }
  return saved;
}
const full = file => (path.isAbsolute(file) ? file : path.join(HERE, file));
export const exportModel = (file = 'model.mdl', format) =>
  call('mdlxl_document', { action: 'export', path: full(file), overwrite: true, ...(format ? { format } : {}) });
export const applyFile = (file, label = 'Apply file') => call('mdlxl_document', { action: 'apply', path: full(file), label });
`;

module.exports = {
  createComputer,
  workFolderOf,
  removeWorkFolder,
  prepareWorkFolder,
  bridgeVariables,
  capOutput,
  CONNECTION_FILE,
  COMPUTER_TOOL_NAMES: new Set(['bash', 'shell', 'str_replace_based_edit_tool', 'read_file', 'write_file', 'edit_file', 'view_image']),
};
