const fs = require('node:fs/promises');
const path = require('node:path');
const { safeWindowsName } = require('./windows-name.cjs');
const { TextureResolver } = require('./texture-resolver.cjs');

class BitsAndPartsLibrary {
  constructor(directory, modelRuntime = () => import('../dist/particle-runtime.mjs')) {
    this.directory = path.resolve(directory);
    this.openedPaths = new Set();
    this.modelRuntime = modelRuntime;
  }
  #pending = Promise.resolve();

  #serialize(operation) {
    const result = this.#pending.then(operation);
    this.#pending = result.catch(() => {});
    return result;
  }

  save(data) { return this.#serialize(() => this.#save(data)); }

  async #save({ name, bytes }) {
    if (typeof name !== 'string' || !name.trim() || name.length > 120) throw Error('Choose a valid Bit filename.');
    safeWindowsName(name, { reject: 'Choose a valid Bit filename.' });
    const data = Buffer.from(bytes || []);
    if (!data.length || data.length > 128 * 1024 * 1024 || data.toString('ascii', 0, 4) !== 'MDLX') throw Error('Save a readable MDX Bit smaller than 128 MB.');
    await this.list();
    const id = name.trim() + '.mdx', file = path.join(this.directory, id);
    let handle;
    try { handle = await fs.open(file, 'wx'); }
    catch (error) { if (error.code === 'EEXIST') throw Error('A Bit with this name already exists. Choose another name.'); throw error; }
    try { await handle.writeFile(data); }
    catch (error) { await handle.close(); await fs.unlink(file); throw error; }
    await handle.close();
    return { id, name: id, type: 'model' };
  }
  async list(manage = false) {
    await fs.mkdir(this.directory, { recursive: true });
    if ((await fs.lstat(this.directory)).isSymbolicLink()) throw Error('BitsAndParts must be a regular folder.');
    let count = 0;
    const visit = async (directory, depth = 0) => {
      if (depth > 32) throw Error('BitsAndParts folders are nested more than 32 levels deep.');
      const entries = await fs.readdir(directory, { withFileTypes: true }), children = [];
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const full = path.join(directory, entry.name), id = path.relative(this.directory, full).split(path.sep).join('/');
        if (entry.isDirectory()) {
          const nested = await visit(full, depth + 1);
          if (manage || nested.length) children.push({ id, name: entry.name, type: 'folder', children: nested });
        }
        else if (entry.isFile()) {
          const model = /\.(mdl|mdx)$/i.test(entry.name);
          if (model || manage) children.push({ id, name: entry.name, type: model ? 'model' : 'file' });
        }
        if (++count > 10000) throw Error('BitsAndParts contains more than 10,000 entries. Split it into smaller libraries.');
      }
      return children.sort((a, b) => (a.type === b.type ? 0 : a.type === 'folder' ? -1 : 1) || a.name.localeCompare(b.name, undefined, { numeric: true }));
    };
    return { directory: this.directory, name: 'BitsAndParts', children: await visit(this.directory) };
  }
  async #entry(id, directory = false) {
    const invalid = 'Choose an entry inside BitsAndParts.';
    if (typeof id !== 'string' || (!id && !directory)) throw Error(invalid);
    const names = id ? id.split('/') : [];
    for (const name of names) safeWindowsName(name, { reject: invalid });
    let file = this.directory, info = await fs.lstat(file);
    if (!info.isDirectory() || info.isSymbolicLink()) throw Error('BitsAndParts must be a regular folder.');
    const root = await fs.realpath(file);
    for (const name of names) {
      file = path.join(file, name);
      info = await fs.lstat(file);
      if (info.isSymbolicLink()) throw Error('Linked entries are not supported.');
    }
    if (directory ? !info.isDirectory() : !info.isDirectory() && !info.isFile()) throw Error(invalid);
    const real = await fs.realpath(file), relative = path.relative(root, real);
    if ((id && !relative) || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw Error(invalid);
    return { file: real, directory: info.isDirectory() };
  }

  change({ action, id, name, folder }, trash) {
    return this.#serialize(async () => {
      if (action === 'mkdir') {
        const parent = await this.#entry(folder, true);
        safeWindowsName(name, { reject: 'Choose a valid folder name.' });
        await fs.mkdir(path.join(parent.file, name));
        return;
      }
      const source = await this.#entry(id);
      if (action === 'delete') {
        await trash(source.file);
      } else {
        const parent = action === 'move' ? (await this.#entry(folder, true)).file : path.dirname(source.file);
        if (action === 'move') name = path.basename(source.file);
        else if (action !== 'rename') throw Error('Choose a library action.');
        safeWindowsName(name, { reject: 'Choose a valid file or folder name.' });
        const destination = path.join(parent, name);
        if (destination === source.file) return;
        const relative = path.relative(source.file, parent);
        if (source.directory && (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)))) {
          throw Error('A folder cannot be moved inside itself.');
        }
        const existing = await fs.readdir(parent);
        if (existing.some(entry => entry.toLowerCase() === name.toLowerCase() && path.join(parent, entry) !== source.file)) {
          throw Error('An entry with this name already exists in this folder.');
        }
        if (action === 'move' && !source.directory && /\.(mdl|mdx)$/i.test(name)) {
          const { bytes } = await this.read(id), { openDocument, partTextureIndices } = await this.modelRuntime();
          const model = openDocument(bytes, name, { allowHD: true }).model;
          const resolver = new TextureResolver(), original = path.dirname(source.file);
          for (const index of partTextureIndices(model)) {
            const texture = model.Textures[index];
            if (texture.ReplaceableId || !texture.Image) continue;
            const nearby = await resolver.loose(texture.Image, [original]);
            if (nearby && !nearby.equals(await resolver.loose(texture.Image, [parent]) || Buffer.alloc(0))) {
              throw Error('This Bit uses a loose texture. Move its folder to keep the texture with the model.');
            }
          }
        }
        await fs.rename(source.file, destination);
      }
      for (const opened of this.openedPaths) {
        const relative = path.relative(source.file, opened);
        if (!relative || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))) this.openedPaths.delete(opened);
      }
    });
  }

  async read(id) {
    if (typeof id !== 'string' || !id || id.includes('\0') || !/\.(mdl|mdx)$/i.test(id)) throw Error('Choose an MDL or MDX part.');
    const file = path.resolve(this.directory, id), relative = path.relative(this.directory, file);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('The part must be inside BitsAndParts.');
    const root = await fs.realpath(this.directory), real = await fs.realpath(file), realRelative = path.relative(root, real);
    if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw Error('The part must be inside BitsAndParts.');
    // Reject symlinked paths even when they point back inside the bank.
    let segment = this.directory;
    for (const name of relative.split(path.sep)) { segment = path.join(segment, name); if ((await fs.lstat(segment)).isSymbolicLink()) throw Error('Linked parts are not supported.'); }
    const info = await fs.stat(file);
    if (!info.isFile() || info.size > 128 * 1024 * 1024) throw Error('Choose a readable part smaller than 128 MB.');
    const bytes = await fs.readFile(file); this.openedPaths.add(file);
    return { id, name: path.basename(file), path: file, bytes };
  }
}
module.exports = { BitsAndPartsLibrary };
