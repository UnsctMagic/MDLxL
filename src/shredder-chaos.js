import { setVertexPositions } from './editor-commands.js';
import { recalculateExtents } from './editor-document.js';
const attackBounds = new WeakMap();

/** A flight carries a plan, never an uncommitted mutation of the user's model. */
export function prepareShredderAttack(doc, target, random = Math.random) {
  if (!doc || doc.readOnly || !target) return null;
  const { geosetIndex, vertexIndex } = target, geoset = doc.model.Geosets[geosetIndex];
  if (!geoset || !Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex * 3 + 2 >= geoset.Vertices.length) return null;
  const original = Array.from(geoset.Vertices.slice(vertexIndex * 3, vertexIndex * 3 + 3));
  if (!original.every(Number.isFinite)) return null;
  let bounds = attackBounds.get(doc);
  if (!bounds) { bounds = new Map(); attackBounds.set(doc, bounds); }
  if (!bounds.has(geosetIndex)) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let index = 0; index < geoset.Vertices.length; index++) {
      const axis = index % 3, value = geoset.Vertices[index];
      if (Number.isFinite(value)) { min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); }
    }
    bounds.set(geosetIndex, { center: min.map((value, axis) => (value + max[axis]) / 2), span: Math.max(1, ...min.map((value, axis) => max[axis] - value)) });
  }
  // Keep the original scale: repeated attacks should make a mess, not inflate
  // the bounds exponentially until there are no vertices left on screen.
  const { span, center } = bounds.get(geosetIndex), distance = span * (.35 + random() * .45);
  const position = Array.from(new Float32Array(original.map((value, axis) => Math.max(center[axis] - span * 1.5, Math.min(center[axis] + span * 1.5, value + (random() * 2 - 1) * distance)))));
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
