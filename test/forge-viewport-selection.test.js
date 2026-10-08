import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera } from 'three';
import { buildForgePrimitive } from '../src/forge-primitives.js';
import { createForgeShape, forgeShapeMesh, forgeSelectionVertices } from '../src/forge-shape-editing.js';
import { forgeVertexSelection, forgePartsFromVertices, pickForgeParts } from '../app/forge-viewport-selection.js';

const make = (id, x = 0) => {
  const shape = createForgeShape(buildForgePrimitive({ shape: 'Cube', width: 40, height: 40, depth: 40, complexity: 1, position: [x, 0, 0], zUp: true }), { id });
  return { shape, mesh: forgeShapeMesh(shape) };
};
function view(start, end = start, modifiers = {}) {
  const camera = new OrthographicCamera(-100, 100, 100, -100, .1, 1000); camera.up.set(0, 0, 1); camera.position.set(0, -300, 0); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  return { camera, start: { x: start[0], y: start[1], ...modifiers }, end: { x: end[0], y: end[1], width: 400, height: 400 }, grabThrough: true };
}
test('Forge shape selection follows vertex-editor replace, Shift-add and Ctrl-subtract', () => {
  const entries = [make(1, -40), make(2, 40)];
  let picked = pickForgeParts(entries, {}, 'Shape', view([120, 200])); assert.deepEqual(picked, { 1: ['shape'], 2: [] });
  picked = pickForgeParts(entries, picked, 'Shape', view([280, 200], undefined, { shift: true })); assert.deepEqual(picked, { 1: ['shape'], 2: ['shape'] });
  picked = pickForgeParts(entries, picked, 'Shape', view([120, 200], undefined, { ctrl: true })); assert.deepEqual(picked, { 1: [], 2: ['shape'] });
  assert.deepEqual(pickForgeParts(entries, picked, 'Shape', view([5, 5])), { 1: [], 2: [] });
});
test('marquee selection catches either or both shapes and face picking resolves one polygon', () => {
  const entries = [make(1, -40), make(2, 40)];
  assert.deepEqual(pickForgeParts(entries, {}, 'Shape', view([70, 140], [175, 260])), { 1: ['shape'], 2: [] });
  assert.deepEqual(pickForgeParts(entries, {}, 'Shape', view([70, 140], [330, 260])), { 1: ['shape'], 2: ['shape'] });
  const picked = pickForgeParts(entries, {}, 'Faces', view([120, 200]));
  assert.equal(picked[1].length, 1); assert.equal(picked[2].length, 0);
  const ids = forgeSelectionVertices(entries[0].shape, picked[1], 'Faces');
  assert.equal(ids.length, 4); assert.ok(ids.every(i => entries[0].shape.vertices[i][1] === -20));
});
test('vertex-editor selection expands UV seams without selecting another shape', () => {
  const entries = [make(1), make(2, 60)], raw = { 0: [0] };
  const parts = forgePartsFromVertices(entries, raw, 'Vertices'), selected = forgeVertexSelection(entries, parts, 'Vertices');
  assert.equal(parts[1].length, 1); assert.ok(selected[0].length > 1); assert.deepEqual(selected[1], []);
  assert.ok(selected[0].every(i => entries[0].mesh.vertexIds[i] === entries[0].mesh.vertexIds[0]));
  assert.deepEqual(forgePartsFromVertices(entries, selected, 'Vertices'), parts);
});
