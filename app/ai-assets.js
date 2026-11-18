import { openDocument } from '../src/editor-document.js';
import { decodeTextureThumbnail, thumbnailPixels } from '../src/texture-thumbnail.js';
import { isForgeAssetPath } from '../src/forge-assets.js';
import { gamePathKey } from '../src/game-path.js';
import { prepareTextureLibrary, searchTextureLibrary } from '../src/texture-library-search.js';
import { textureInfo, texturePixels } from '../src/texture-pixels.js';
import { textureUses } from '../src/ai-model-size.js';

const page = (items, { offset = 0, limit = 30 } = {}) => ({
  total: items.length,
  offset,
  truncated: offset + limit < items.length,
  items: items.slice(offset, offset + limit),
});
const matches = (text, query = '') =>
  query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every(word => text.toLowerCase().includes(word));

export function validateAiAssets(assets, model, existing = new Map()) {
  if (!Array.isArray(assets) || assets.length > 32) throw Error('Provide up to 32 generated textures.');
  const key = gamePathKey,
    names = new Set();
  let size = 0;
  for (const asset of assets) {
    if (!isForgeAssetPath(asset.name) || names.has(key(asset.name)) || existing.has(key(asset.name)))
      throw Error(
        'Reuse first: the model\'s own or a native game texture needs only its path in Textures[].Image, not assets. A new texture the user asked for needs a new MDLxL_Forge, MDLxL_Parts or MDLxL_Citadel .tga/.blp/.dds name; existing textures are preserved.',
      );
    if (!model.Textures.some(t => key(t.Image || '') === key(asset.name)))
      throw Error('Generated textures must be referenced by the edited model.');
    if (
      !(asset.bytes instanceof Uint8Array) ||
      !asset.bytes.byteLength ||
      (size += asset.bytes.byteLength) > 64 * 1024 * 1024
    )
      throw Error('Generated texture bytes must be nonempty and total at most 64 MB.');
    const image = thumbnailPixels(asset);
    if (!image?.width || !image?.height) throw Error('Generated texture could not be decoded.');
    names.add(key(asset.name));
  }
  return assets;
}

/**
 * The bytes of one texture by path: the open model's own textures first, then what the
 * editor resolves (game data, texture library, the model's folder). Null when not found.
 */
export async function loadTextureAsset(path, session, desktop = window.desktop) {
  if (typeof path !== 'string' || !path) return null;
  return (
    session?.assets?.get(gamePathKey(path)) ||
    (await desktop.resolveTextures({ path: session?.path, names: [path] }))?.[0] ||
    null
  );
}

// Decoded RGBA of a texture: the editor's own BLP/DDS/TGA codecs, else the browser for PNG/JPEG.
async function decodePixels(asset) {
  const pixels = thumbnailPixels(asset);
  if (pixels) return pixels;
  if (typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') throw Error('This texture format cannot be read here.');
  const bitmap = await createImageBitmap(new Blob([asset.bytes]));
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally { bitmap.close(); }
}

// Each listed model texture's file (format, size, mipmaps, bytes) and what uses it, and the total of
// every image texture the model uses. Files come from the model's own assets, else the editor's
// resolver (model folder, game data); textures it cannot find are listed as missing.
async function textureWeights(state, result, desktop, active) {
  const model = state.model, uses = textureUses(model), files = new Map(), names = [];
  for (const texture of model.Textures) {
    if (!texture.Image || files.has(texture.Image)) continue;
    const own = state.session?.assets?.get(gamePathKey(texture.Image));
    if (own) files.set(texture.Image, own); else names.push(texture.Image);
  }
  if (names.length && desktop?.resolveTextures) {
    const found = await desktop.resolveTextures({ path: state.session?.path, names });
    active();
    for (const asset of found || []) files.set(asset.name, asset);
  }
  const fileOf = texture => {
    if (!texture.Image) return { replaceable: texture.ReplaceableId };
    const asset = files.get(texture.Image);
    return asset ? textureInfo(asset.bytes, texture.Image) : { missing: true };
  };
  result.items = result.items.map(item => ({ ...item, file: fileOf(item), usedBy: uses[item.id] }));
  const counted = [...new Set(model.Textures.map(t => t.Image).filter(name => files.has(name)))];
  return { textureBytes: { total: counted.reduce((sum, name) => sum + files.get(name).bytes.byteLength, 0), files: counted.length,
    missing: [...new Set(model.Textures.map(t => t.Image).filter(name => name && !files.has(name)))].length,
    note: 'Bytes of the texture files as found; native game textures do not add to a map, imported ones do.' } };
}

/** Reuse the installed library and codecs. No downloads, external services or shell. */
export async function aiAssets(args, host, active, desktop = window.desktop) {
  const state = host.state(),
    { source, action = 'search', query = '', offset = 0, limit = 30 } = args;
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100)
    throw Error('Choose an asset page of 1–100.');
  // Pixels as data: a model texture by textureId, or any texture by path or game search hit.
  if (action === 'pixels' && ['model', 'textures', 'game'].includes(source)) {
    let path = args.path;
    if (source === 'model' && !path) {
      const texture = state.model.Textures[args.textureId];
      if (!texture?.Image) throw Error('Choose an image texture in this model (textureId) or a path.');
      path = texture.Image;
    }
    let asset;
    if (source === 'game' && args.id) {
      if (!args.signature) throw Error('Use the signature returned by the game library search.');
      const record = await desktop.gameFilesRead({ id: Number(args.id), signature: args.signature });
      active();
      if (record.type !== 'textures') throw Error('Choose a texture.');
      asset = { name: record.name, bytes: record.bytes };
      path = record.path || record.name;
    } else {
      asset = await loadTextureAsset(path, state.session, desktop);
      active();
      if (!asset && source === 'game' && desktop.gameFilesReadPath) {
        const record = await desktop.gameFilesReadPath({ path });
        active();
        if (record?.bytes) asset = { name: record.name, bytes: record.bytes };
      }
    }
    if (!asset) throw Error('No texture was found at ' + path + '. Search with source textures or game (type textures) for its path.');
    const image = await decodePixels(asset);
    return { path, file: textureInfo(asset.bytes, asset.name || path), ...texturePixels(image, { region: args.region, units: args.units, grid: args.grid, find: args.find }) };
  }
  // A texture by path (model, texture library or game data) or by a game search hit.
  if (action === 'preview' && ['model', 'textures', 'game'].includes(source) && (args.path || (source === 'game' && args.id))) {
    let asset = null,
      path = args.path;
    if (source === 'game' && args.id) {
      if (!args.signature) throw Error('Use the signature returned by the game library search.');
      const record = await desktop.gameFilesRead({ id: Number(args.id), signature: args.signature });
      active();
      if (record.type !== 'textures') throw Error('Choose a texture.');
      asset = { name: record.name, bytes: record.bytes };
      path = record.path || record.name;
    } else {
      asset = await loadTextureAsset(path, state.session, desktop);
      active();
      if (!asset && source === 'game' && desktop.gameFilesReadPath) {
        const record = await desktop.gameFilesReadPath({ path });
        active();
        if (record?.bytes) asset = { name: record.name, bytes: record.bytes };
      }
    }
    if (!asset) throw Error('No texture was found at ' + path + '. Search with source textures or game (type textures) for its path.');
    return { image: await decodeTextureThumbnail(asset, 1024), path };
  }
  if (source === 'model') {
    if (action === 'search') {
      const result = page(
        state.model.Textures.map((texture, id) => ({ id, ...texture })).filter(t =>
          matches(t.Image || 'Replaceable ' + t.ReplaceableId, query),
        ),
        args,
      );
      const weights = await textureWeights(state, result, desktop, active);
      return { ...result, ...weights };
    }
    if (action === 'preview') {
      const texture = state.model.Textures[args.textureId];
      if (!texture?.Image) throw Error('Choose an image texture in this model.');
      const asset = await loadTextureAsset(texture.Image, state.session, desktop);
      active();
      if (!asset) throw Error('This texture could not be resolved by the editor.');
      return { image: await decodeTextureThumbnail(asset, 1024) };
    }
  }
  if (source === 'parts') {
    if (action === 'search') {
      const bank = await desktop.listParts(),
        items = [];
      const walk = rows => {
        for (const row of rows || [])
          if (row.type === 'folder') walk(row.children);
          else if (matches(row.id, query)) items.push(row);
      };
      walk(bank.children);
      active();
      return page(items, args);
    }
    if (action === 'reference') {
      const record = await desktop.readPart(args.id);
      active();
      return { reference: await host.addReference(record) };
    }
  }
  if (source === 'game') {
    if (action === 'search')
      return desktop.gameFilesBrowse({
        query,
        folder: args.folder || '',
        variant: args.variant || 'all',
        type: args.type || 'models',
        offset,
        limit,
      });
    if (action === 'reference') {
      if (!args.signature) throw Error('Use the signature returned by the game library search.');
      const record = await desktop.gameFilesRead({ id: Number(args.id), signature: args.signature });
      active();
      if (record.type !== 'models') throw Error('Choose a model reference.');
      const doc = openDocument(record.bytes, record.name),
        names = doc.model.Textures.map(t => t.Image).filter(Boolean);
      const textures = await desktop.gameFilesResolve({
        id: Number(args.id),
        signature: args.signature,
        names,
      });
      active();
      return {
        reference: await host.addReference({
          name: record.name,
          path: null,
          bytes: record.bytes,
          textures: textures.found,
        }),
        missingTextures: textures.missing,
      };
    }
  }
  if (source === 'textures' && action === 'search') {
    const catalog = await desktop.textureLibraryCatalog({ modelPath: state.session.path });
    active();
    const result = searchTextureLibrary(prepareTextureLibrary(catalog.items), {
      query,
      variant: args.variant || 'all',
      limit: offset + limit,
    });
    return {
      ...result,
      items: result.items.slice(offset, offset + limit),
      offset,
      truncated: offset + limit < result.total,
    };
  }
  throw Error(
    'This asset source/action is unavailable. Search model textures, installed textures, game models or BitsAndParts; open model parts as references before using their data in a script.',
  );
}
