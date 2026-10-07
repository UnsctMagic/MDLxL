import { densifyGeoset } from './mesh-density.js';
import { previewShape, shapeGeosets } from './shaping.js';
import { recalculateExtents } from './editor-document.js';

function prepareSupport(model, selection, options) {
  const level = options.support || 0;
  if (!Number.isInteger(level) || level < 0 || level > 4) throw Error('Support must be between 0 and 4.');
  if (!level) return { model, selection };
  const prepared = { ...model, Info: { ...model.Info }, Geosets: model.Geosets.map(g => ({ ...g })) }, expanded = {};
  for (const [gi, ids] of Object.entries(selection)) {
    const source = model.Geosets[gi];
    if (!source || new Set(ids).size !== source.Vertices.length / 3 || ids.some(id => !Number.isInteger(id) || id < 0 || id >= source.Vertices.length / 3)) throw Error('Choose Affect → Whole geosets before adding support rows.');
    prepared.Geosets[gi] = densifyGeoset(source, level);
    expanded[gi] = Array.from({ length: prepared.Geosets[gi].Vertices.length / 3 }, (_, id) => id);
  }
  return { model: prepared, selection: expanded };
}

export function previewSupportedShape(model, selection, options = {}) {
  const prepared = prepareSupport(model, selection, options);
  return previewShape(prepared.model, prepared.selection, options);
}

export function shapeGeosetsWithSupport(model, selection, options = {}) {
  const prepared = prepareSupport(model, selection, options);
  const result = shapeGeosets(prepared.model, prepared.selection, options);
  if (prepared.model !== model) {
    for (const gi of Object.keys(prepared.selection)) Object.assign(model.Geosets[gi], prepared.model.Geosets[gi]);
    recalculateExtents(model);
  }
  return result;
}
