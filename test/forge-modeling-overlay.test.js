import test from 'node:test';
import assert from 'node:assert/strict';
import { buildForgePrimitive } from '../src/forge-primitives.js';
import { createForgeShape, forgeShapeMesh, extrudeForgeFaces } from '../src/forge-shape-editing.js';
import { forgeModelingOverlay, geosetModelingOverlay } from '../app/forge-surface-colors.js';

test('solid Forge overlays follow polygon edges and selected faces without coloring mesh data', () => {
  const shape = createForgeShape(buildForgePrimitive({shape:'Cube',complexity:1})), mesh = forgeShapeMesh(shape), before = structuredClone(mesh);
  const overlay = forgeModelingOverlay(shape, mesh, [shape.faces[0].id], 'Faces');
  assert.equal(overlay.edgeIndices.length, 24); // Twelve cube edges, no triangle diagonals.
  assert.equal(overlay.selectedEdgeIndices.length, 8);
  assert.equal(overlay.selectedFaceIndices.length, 6);
  assert.deepEqual(mesh, before);
  const extended = extrudeForgeFaces(shape, [shape.faces[0].id], [0,0,10]), next = forgeModelingOverlay(extended, forgeShapeMesh(extended), [shape.faces[0].id], 'Faces');
  assert.ok(next.edgeIndices.length > overlay.edgeIndices.length);
  assert.equal(next.selectedFaceIndices.length, 6);
});

test('edge selection highlights only the chosen edge and SHAPE maps outlines to real source indices', () => {
  const shape = createForgeShape(buildForgePrimitive({shape:'Cube',complexity:1})), mesh = forgeShapeMesh(shape), face = shape.faces[0], [a,b] = face.vertices;
  const key = a < b ? `${a}:${b}` : `${b}:${a}`, overlay = forgeModelingOverlay(shape, mesh, [key], 'Edges');
  assert.equal(overlay.selectedEdgeIndices.length, 2);
  assert.equal(overlay.selectedFaceIndices.length, 0);
  const geoset = mesh.geosets[0], preview = geosetModelingOverlay(geoset, Array.from({length:mesh.vertexCount},(_,i)=>i));
  assert.ok(preview.edgeIndices.every(i=>Number.isInteger(i)&&i>=0&&i<mesh.vertexCount));
  assert.equal(preview.selectedEdgeIndices.length, preview.edgeIndices.length);
});
