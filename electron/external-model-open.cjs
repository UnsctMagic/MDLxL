const path = require('node:path');

const WARCRAFT_MODEL_EXTENSIONS = ['mdl', 'mdx'];
// Files MDLxL opens: Warcraft models and its own paint projects.
const MODEL_EXTENSIONS = [...WARCRAFT_MODEL_EXTENSIONS, 'mdlxlpaint'];
const MODEL_EXTENSION = new RegExp(`\\.(?:${MODEL_EXTENSIONS.join('|')})$`, 'i');

function modelPathsFromArguments(args, workingDirectory = process.cwd()) {
  const found = [], seen = new Set();
  for (const value of args || []) {
    if (typeof value !== 'string' || !MODEL_EXTENSION.test(value)) continue;
    const resolved = path.normalize(path.isAbsolute(value) ? value : path.resolve(workingDirectory, value));
    const identity = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    if (!seen.has(identity)) { seen.add(identity); found.push(resolved); }
  }
  return found;
}

module.exports = { modelPathsFromArguments, MODEL_EXTENSIONS, WARCRAFT_MODEL_EXTENSIONS };
