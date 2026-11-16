import { openDocument } from '../src/editor-document.js';
import { resolveGameFiles } from './desktop.js';

/** The textures a model file names, found next to it or in the game files, as { name, bytes }. */
export async function modelFileTextures(record) {
  const names = (openDocument(record.bytes, record.name).model?.Textures || []).map(texture => texture.Image).filter(Boolean);
  const found = names.length ? await resolveGameFiles(names, record.path) : [];
  return found.filter(item => item?.bytes).map(item => ({ name: item.logicalName || item.texturePath || item.name, bytes: item.bytes }));
}

/** A model read from a file or the game files, with preview textures: { model, assets, release }.
 * The model is only read, never opened as a tab. `release` frees the textures. */
export async function previewModel(name, bytes, textures) {
  const opened = openDocument(bytes, name);
  if (!opened.model) throw new Error('This model could not be read.');
  const { previewAssets } = await import('./GameFileBrowser.jsx');
  const preview = previewAssets(textures);
  return { model: opened.model, assets: preview.assets, release: preview.release };
}

/** A model file by its path (read only, no dialog, no recent file), with its textures. */
export async function readPreviewModel(file) {
  const record = await window.desktop.readTransferModel(file);
  return { name: record.name, path: record.path, ...await previewModel(record.name, record.bytes, await modelFileTextures(record)) };
}
