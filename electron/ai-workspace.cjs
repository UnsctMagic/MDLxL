const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_FILES = 32, MAX_FILE = 512 * 1024, MAX_TOTAL = 4 * 1024 * 1024;
function checkName(name) {
  if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,62}\.(js|json|txt)$/.test(name) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./.test(name))
    throw Error('Use a plain lower-case .js, .json or .txt workspace filename.');
}

// The editor owns the model and selection. Only this job owns its scratch files.
function createWorkspace(parent, scope, call) {
  const sizes = new Map();
  let directory, queue = Promise.resolve(), closed = false;
  async function save(name, text) {
    checkName(name);
    const bytes = Buffer.byteLength(text);
    const total = [...sizes.values()].reduce((a, b) => a + b, 0) - (sizes.get(name) || 0) + bytes;
    if (bytes > MAX_FILE || total > MAX_TOTAL || (!sizes.has(name) && sizes.size >= MAX_FILES))
      throw Error('Workspace file limit exceeded (32 files, 512 KiB each, 4 MiB total).');
    directory ||= await fs.mkdtemp(path.join(parent, 'workspace-'));
    const temp = path.join(directory, 'pending');
    await fs.writeFile(temp, text);
    await fs.rename(temp, path.join(directory, name));
    sizes.set(name, bytes);
    return { file: name, bytes };
  }
  async function read(name) {
    checkName(name);
    if (!sizes.has(name)) throw Error('No workspace file named ' + name);
    return fs.readFile(path.join(directory, name), 'utf8');
  }
  async function execute(args, signal) {
    signal.throwIfAborted();
    const { action, file } = args;
    if (action === 'list') return { files: Array.from(sizes, ([file, bytes]) => ({ file, bytes })) };
    if (action === 'write') {
      if (typeof args.text !== 'string') throw Error('Supply text for the workspace file.');
      return save(file, args.text);
    }
    const text = await read(file);
    if (action === 'read') {
      const offset = args.offset ?? 0;
      return { file, offset, length: text.length, text: text.slice(offset, offset + 16000) };
    }
    const target = scope.target;
    if (action === 'run') {
      if (!file.endsWith('.js')) throw Error('Run a .js workspace file.');
      if (args.output) { checkName(args.output); if (!args.output.endsWith('.json')) throw Error('Program output needs a .json filename.'); }
      const files = Object.fromEntries(await Promise.all([...sizes.keys()].map(async name => [name, await read(name)])));
      const result = await call('mdlxl_script', { target, code: text, workspaceFiles: files }, signal);
      signal.throwIfAborted();
      if (!args.output) return result;
      return { ...await save(args.output, JSON.stringify(result.value)), logs: result.logs };
    }
    if (!['preview', 'select'].includes(action) || !file.endsWith('.json')) throw Error('Preview or select a .json vertex map.');
    const vertices = JSON.parse(text);
    if (!vertices || typeof vertices !== 'object' || Array.isArray(vertices)) throw Error('Expected vertex IDs keyed by geoset.');
    let count = 0;
    for (const [key, ids] of Object.entries(vertices)) {
      const marked = new Set(scope.selection[key]);
      if (!Array.isArray(ids) || ids.some(id => !marked.has(id)) || new Set(ids).size !== ids.length)
        throw Error('The candidate must be a subset of the vertices marked when you sent the request.');
      count += ids.length;
    }
    if (!count) throw Error('The candidate contains no marked vertices.');
    const params = { target, vertices, expectedRevision: scope.revision };
    if (action === 'preview')
      return call('mdlxl_capture', { target, expectedRevision: scope.revision, workspaceVertices: vertices, view: args.view || 'perspective' }, signal);
    const selected = await call('mdlxl_select', params, signal);
    return { target, revision: selected.revision, selectedVertices: Object.values(selected.selection).reduce((n, ids) => n + ids.length, 0) };
  }
  return {
    use(args, signal) {
      if (closed) throw Error('This workspace has closed.');
      const pending = queue.then(() => execute(args, signal));
      queue = pending.catch(() => {});
      return pending;
    },
    async close() {
      closed = true;
      await queue;
      if (directory) await fs.rm(directory, { recursive: true, force: true });
    },
  };
}
module.exports = { createWorkspace };
