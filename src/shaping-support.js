import { densifyGeoset } from './mesh-density.js';
import { previewShape, shapeGeosets } from './shaping.js';
import { recalculateExtents } from './editor-document.js';

function autoSupport(source, options) {
  if (options.tool === 'Taper') return 0;
  const coordinates = [0, 1, 2].map(axis => [...new Set(Array.from(source.Vertices).filter((_, i) => i % 3 === axis))].sort((a, b) => a - b));
  const spans = coordinates.map(values => values.at(-1) - values[0]);
  // Only remesh flat, coarse surfaces automatically. Existing solids and
  // sufficiently sampled surfaces keep their authored topology.
  if (Math.min(...spans) > Math.max(...spans) * 1e-5) return 0;
  const axes = options.tool === 'Dome' ? [0, 1, 2].filter(a => a !== options.axis) : [options.axis];
  const needsRows = axes.some(axis => {
    const values = coordinates[axis], span = spans[axis], center = (values[0] + values.at(-1)) / 2, epsilon = span * 1e-5;
    for (let i = 0; i < source.Faces.length; i += 3) {
      const triangle = Array.from(source.Faces.slice(i, i + 3), id => source.Vertices[id * 3 + axis]), low = Math.min(...triangle), high = Math.max(...triangle);
      if (options.bendStyle === 'fold' ? low < center - epsilon && high > center + epsilon : high - low > span / 4 + epsilon) return true;
    }
    return false;
  });
  if (!needsRows) return 0;
  return 1;
}

export function prepareShapeSupport(model, selection, options) {
  const level = options.support || 0;
  if (level !== 'auto' && (!Number.isInteger(level) || level < 0 || level > 4)) throw Error('Support must be between 0 and 4.');
  if (!level) return { model, selection };
  const prepared = { ...model, Info: { ...model.Info }, Geosets: model.Geosets.map(g => ({ ...g })) }, expanded = {};
  for (const [gi, ids] of Object.entries(selection)) {
    const source = model.Geosets[gi];
    if (!source || new Set(ids).size !== source.Vertices.length / 3 || ids.some(id => !Number.isInteger(id) || id < 0 || id >= source.Vertices.length / 3)) throw Error('Choose Affect → Whole geosets before adding support rows.');
    const detail = level === 'auto' ? autoSupport(source, options) : level;
    prepared.Geosets[gi] = detail ? densifyGeoset(source, detail, { minimumSegments: level === 'auto' ? options.bendStyle === 'fold' ? 2 : 4 : 1 }) : source;
    expanded[gi] = Array.from({ length: prepared.Geosets[gi].Vertices.length / 3 }, (_, id) => id);
  }
  return { model: prepared, selection: expanded };
}

export function previewSupportedShape(model, selection, options = {}) {
  const prepared = options.amount === 0 ? { model, selection } : prepareShapeSupport(model, selection, options);
  return previewShape(prepared.model, prepared.selection, options);
}

export function shapeGeosetsWithSupport(model, selection, options = {}) {
  const prepared = options.amount === 0 ? { model, selection } : prepareShapeSupport(model, selection, options);
  const result = shapeGeosets(prepared.model, prepared.selection, options);
  if (prepared.model !== model) {
    for (const gi of Object.keys(prepared.selection)) Object.assign(model.Geosets[gi], prepared.model.Geosets[gi]);
    recalculateExtents(model);
  }
  return result;
}
