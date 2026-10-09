import { setVertexPositions } from './editor-commands.js';
import { recalculateExtents } from './editor-document.js';

/** A flight carries a plan, never an uncommitted mutation of the user's model. */
export function prepareShredderAttack(doc, target, random = Math.random) {
  if (!doc || doc.readOnly || !target) return null;
  const { geosetIndex, vertexIndex } = target, geoset = doc.model.Geosets[geosetIndex];
  if (!geoset || !Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex * 3 + 2 >= geoset.Vertices.length) return null;
  const original = Array.from(geoset.Vertices.slice(vertexIndex * 3, vertexIndex * 3 + 3));
  if (!original.every(Number.isFinite)) return null;
  const span = Math.max(1, ...[0, 1, 2].map(axis => Math.abs((geoset.MaximumExtent?.[axis] || 0) - (geoset.MinimumExtent?.[axis] || 0))));
  const distance = span * (.12 + random() * .12);
  const position = Array.from(new Float32Array(original.map((value, axis) => value + (axis === 2 ? .8 : random() * 2 - 1) * distance)));
  if (!position.every(Number.isFinite) || position.every((value, axis) => value === original[axis])) return null;
  return { doc, revision: doc.revision, geosetIndex, vertexIndex, original, position };
}

export function currentShredderAttack(doc, plan) {
  if (!plan || doc !== plan.doc || doc.readOnly || doc.revision !== plan.revision) return false;
  const vertices = doc.model.Geosets[plan.geosetIndex]?.Vertices;
  return !!vertices && plan.original.every((value, axis) => vertices[plan.vertexIndex * 3 + axis] === value);
}

export function moveShredderVertex(model, plan) {
  setVertexPositions(model.Geosets[plan.geosetIndex], [plan.vertexIndex], plan.position);
  recalculateExtents(model);
}
