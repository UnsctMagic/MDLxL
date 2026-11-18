import { openDocument } from '../src/editor-document.js';
import { decodeTextureThumbnail, thumbnailPixels } from '../src/texture-thumbnail.js';
import { isForgeAssetPath } from '../src/forge-assets.js';
import { gamePathKey } from '../src/game-path.js';
import { prepareTextureLibrary, searchTextureLibrary } from '../src/texture-library-search.js';

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

/** Reuse the installed library and codecs. No downloads, external services or shell. */
export async function aiAssets(args, host, active, desktop = window.desktop) {
  const state = host.state(),
    { source, action = 'search', query = '', offset = 0, limit = 30 } = args;
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100)
    throw Error('Choose an asset page of 1–100.');
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
    if (action === 'search')
      return page(
        state.model.Textures.map((texture, id) => ({ id, ...texture })).filter(t =>
          matches(t.Image || 'Replaceable ' + t.ReplaceableId, query),
        ),
        args,
      );
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
