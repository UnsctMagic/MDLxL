import test from 'node:test';
import assert from 'node:assert/strict';
import { buildForgePrimitive, FORGE_SHAPES, PRIMITIVE_TEXTURE } from '../src/forge-primitives.js';
import { createForgeShape, forgeShapeMesh, forgeFaceNormal, forgeShapeEdges, forgeSelectionCenter, transformForgeSelection, extrudeForgeFaces, insetForgeFaces } from '../src/forge-shape-editing.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { commitForge } from '../src/forge.js';

const top = shape => shape.faces.filter(f => forgeFaceNormal(shape, f)[2] > .999);
const close = mesh => {
  const g = mesh.geosets[0], edges = new Map(), key = id => [...g.Vertices.slice(id * 3, id * 3 + 3)].map(v => Math.round(v * 10000)).join(',');
  for (let i = 0; i < g.Faces.length; i += 3) for (let j = 0; j < 3; j++) { const a = key(g.Faces[i + j]), b = key(g.Faces[i + (j + 1) % 3]), k = [a, b].sort().join('|'); assert.notEqual(a, b); edges.set(k, (edges.get(k) || 0) + 1); }
  assert.ok([...edges.values()].every(n => n === 2), 'solid stays closed across UV seams');
  for (let i = 0; i < g.Vertices.length; i += 9) { const [a, b, c] = [0, 3, 6].map(k => [...g.Vertices.slice(i + k, i + k + 3)]), u = b.map((v, k) => v - a[k]), v = c.map((n, k) => n - a[k]); assert.ok(Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) > 1e-6, 'no collapsed triangles'); }
};

test('editable starters recognize cube sides without changing triangle UVs or input meshes', () => {
  for (const name of FORGE_SHAPES) {
    const mesh = buildForgePrimitive({ shape: name }), before = structuredClone(mesh), shape = createForgeShape(mesh, { name }), exported = forgeShapeMesh(shape);
    assert.deepEqual(mesh, before);
    assert.equal(exported.triangleCount, mesh.triangleCount);
    const cornerUvs = g => Array.from({ length: g.Faces.length / 3 }, (_, i) => [...g.Faces.slice(i * 3, i * 3 + 3)].flatMap(v => [...g.TVertices[0].slice(v * 2, v * 2 + 2)])).map(v => v.join(',')).sort();
    assert.deepEqual(cornerUvs(exported.geosets[0]), cornerUvs(mesh.geosets[0]));
  }
  const cube = createForgeShape(buildForgePrimitive()); assert.equal(cube.vertices.length, 8); assert.equal(cube.faces.length, 6); assert.equal(forgeShapeEdges(cube).size, 12);
  const placed = createForgeShape(buildForgePrimitive({ width: .02, height: .02, depth: .02, position: [10000, 10000, 10000] })); assert.equal(placed.vertices.length, 8);
});

test('circular caps are whole selectable faces and their fan interiors follow extrusion and transforms', () => {
  for (const shapeName of ['Circle', 'Cylinder', 'Cone']) for (const complexity of [2, 3, 4]) {
    const initial = createForgeShape(buildForgePrimitive({ shape: shapeName, complexity })), cap = initial.faces.find(f => f.triangles.length > 1 && Math.abs(forgeFaceNormal(initial, f)[shapeName === 'Circle' ? 2 : 1]) > .999);
    assert.ok(cap, `${shapeName} cap`);
    const normal = forgeFaceNormal(initial, cap), extended = extrudeForgeFaces(initial, [cap.id], normal.map(v => v * 20)), scaled = transformForgeSelection(extended, [cap.id], 'Faces', { scale: [.8, .8, .8], center: forgeSelectionCenter([extended], { 1: [cap.id] }, 'Faces') });
    assert.ok(forgeShapeMesh(scaled).geosets[0].Vertices.every(Number.isFinite));
    if (shapeName !== 'Circle') close(forgeShapeMesh(scaled));
  }
});

test('inset is an even distance on a rectangular face, followed by connected wall and roof extrusions', () => {
  let shape = createForgeShape(buildForgePrimitive({ width: 120, height: 80, depth: 10 })); const before = structuredClone(shape), ids = top(shape).map(f => f.id);
  shape = insetForgeFaces(shape, ids, 5);
  const cap = top(shape).find(f => ids.includes(f.id)), points = cap.vertices.map(id => shape.vertices[id]);
  assert.deepEqual([0, 1].map(axis => Math.max(...points.map(p => p[axis])) - Math.min(...points.map(p => p[axis]))), [110, 70]);
  shape = extrudeForgeFaces(shape, ids, [0, 0, 50]);
  shape = extrudeForgeFaces(shape, ids, [0, 0, 8]);
  shape = transformForgeSelection(shape, ids, 'Faces', { scale: [1.2, 1.2, 1], center: forgeSelectionCenter([shape], { 1: ids }, 'Faces') });
  for (let i = 0; i < 5; i++) { shape = extrudeForgeFaces(shape, ids, [0, 0, 12]); shape = transformForgeSelection(shape, ids, 'Faces', { scale: [.78, 1, 1], center: forgeSelectionCenter([shape], { 1: ids }, 'Faces') }); }
  close(forgeShapeMesh(shape)); assert.deepEqual(before, createForgeShape(buildForgePrimitive({ width: 120, height: 80, depth: 10 })));
  assert.throws(() => insetForgeFaces(before, ids, 80), /too wide/);
  assert.throws(() => insetForgeFaces(before, before.faces.map(f => f.id), 5), /flat region|same plane/);
});

test('selected grid cells extrude as one region with no walls inside the cap', () => {
  const shape = createForgeShape(buildForgePrimitive({ shape: 'Grid', complexity: 3, thickness: 10 })), ids = top(shape).map(f => f.id), edges = forgeShapeEdges(shape);
  assert.equal(ids.length, 16);
  const edited = extrudeForgeFaces(shape, ids, [0, 0, 20]);
  assert.equal(edited.faces.length - shape.faces.length, 16, 'only perimeter edges grow walls'); close(forgeShapeMesh(edited));
  const edge = [...edges.keys()][0], moved = transformForgeSelection(shape, [edge], 'Edges', { translation: [5, 0, 0] });
  assert.ok(moved.vertices.some((p, i) => p[0] !== shape.vertices[i][0])); close(forgeShapeMesh(moved));
});

test('multiple edited shapes add atomically, retain existing authored data, round trip and undo', () => {
  const doc = createDemoDocument(), before = structuredClone(doc.model), a = createForgeShape(buildForgePrimitive(), { id: 1 }), b = createForgeShape(buildForgePrimitive({ position: [200, 0, 0] }), { id: 2 });
  const selection = { 1: [1], 2: [1] }, center = forgeSelectionCenter([a, b], selection, 'Shape'); assert.deepEqual(center, [100, 0, 0]);
  const shapes = [a, b].map(s => transformForgeSelection(s, selection[s.id], 'Shape', { scale: [2, 1, 1], center }));
  const results = doc.apply('Forge shapes', [], model => shapes.map(s => commitForge(model, forgeShapeMesh(s), { texturePath: PRIMITIVE_TEXTURE })));
  assert.equal(results.length, 2);
  const authored = geosets => geosets.map(({ BoundsRadius, ...g }) => g);
  assert.deepEqual(authored(doc.model.Geosets.slice(0, before.Geosets.length)), authored(before.Geosets));
  for (const format of ['mdl', 'mdx']) { const reopened = openDocument(doc.serialize(format)); assert.equal(reopened.diagnostics.filter(d => d.severity === 'error').length, 0); for (const r of results) close({ geosets: [reopened.model.Geosets[r.geosetIndices[0]]] }); }
  doc.undo(); assert.deepEqual(doc.model, before);
});
