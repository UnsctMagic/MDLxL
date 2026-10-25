import { searchNativeTextures, nativeTexture } from '../src/sd-native-textures.js';
import { openDocument } from '../src/editor-document.js';
import { decodeTextureThumbnail, thumbnailPixels } from '../src/texture-thumbnail.js';
import { isForgeAssetPath } from '../src/forge-assets.js';
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
  const key = name => name.replaceAll('/', '\\').toLowerCase(),
    names = new Set();
  let size = 0;
  for (const asset of assets) {
    if (!isForgeAssetPath(asset.name) || names.has(key(asset.name)) || existing.has(key(asset.name)))
      throw Error(
        'Give each generated texture a new MDLxL_Forge, MDLxL_Parts or MDLxL_Citadel .tga/.blp/.dds name; existing textures are preserved.',
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

/** Reuse the installed library and codecs. No downloads, external services or shell. */
export async function aiAssets(args, host, active, desktop = window.desktop) {
  const state = host.state(),
    { source, action = 'search', query = '', offset = 0, limit = 30 } = args;
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100)
    throw Error('Choose an asset page of 1–100.');
  if (source === 'native') {
    if (action === 'search') return searchNativeTextures({query,offset,limit,checkedOnly:args.checkedOnly===true});
    if (action === 'preview') {
      const texture=await nativeTexture(args.path);
      if (!texture) throw Error('Choose a native texture path from the catalogue.');
      const assets=await desktop.resolveTextures({path:state.session.path,names:[texture.sourcePath.split(':').length>2?texture.sourcePath:texture.path]});
      active();
      if (!assets?.[0]) throw Error('This native sheet is unavailable in the installed game.');
      return {texture,image:await decodeTextureThumbnail(assets[0],1024)};
    }
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
      const key = texture.Image.replaceAll('/', '\\').toLowerCase();
      const asset =
        state.session.assets?.get(key) ||
        (await desktop.resolveTextures({ path: state.session.path, names: [texture.Image] }))?.[0];
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
