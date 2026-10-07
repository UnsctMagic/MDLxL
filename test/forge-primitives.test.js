import test from 'node:test';
import assert from 'node:assert/strict';
import { buildForgePrimitive, FORGE_SHAPES } from '../src/forge-primitives.js';
import { commitForge } from '../src/forge.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';

test('all primitives stay modest, have usable UV triangles and regular geometry at every complexity', () => {
  for (const shape of FORGE_SHAPES) {
    let previous = 0;
    for (let complexity = 1; complexity <= 4; complexity++) {
      const mesh = buildForgePrimitive({ shape, complexity }), g = mesh.geosets[0];
      assert.ok(mesh.triangleCount > previous && mesh.triangleCount < 800, `${shape} ${complexity} triangle budget`); previous = mesh.triangleCount;
      assert.ok([...g.Vertices, ...g.Normals, ...g.TVertices[0]].every(Number.isFinite));
      const edges = new Map(), position = id => Array.from(g.Vertices.slice(id * 3, id * 3 + 3)).map(n => Math.round(n * 1000) / 1000).join(',');
      for (let i = 0; i < g.Faces.length; i += 3) {
        const ids = Array.from(g.Faces.slice(i, i + 3)), p = ids.map(id => Array.from(g.Vertices.slice(id * 3, id * 3 + 3))), uv = ids.map(id => Array.from(g.TVertices[0].slice(id * 2, id * 2 + 2)));
        assert.ok(Math.abs((uv[1][0] - uv[0][0]) * (uv[2][1] - uv[0][1]) - (uv[1][1] - uv[0][1]) * (uv[2][0] - uv[0][0])) > 1e-8, `${shape} UV triangle`);
        const lengths = p.map((v, k) => Math.hypot(...v.map((x, a) => x - p[(k + 1) % 3][a])));
        const angles = lengths.map((v, k) => Math.acos(Math.max(-1, Math.min(1, (lengths[(k + 1) % 3] ** 2 + lengths[(k + 2) % 3] ** 2 - v * v) / (2 * lengths[(k + 1) % 3] * lengths[(k + 2) % 3])))) * 180 / Math.PI);
        assert.ok(Math.min(...angles) >= 15, `${shape} has a stretched triangle: ${Math.min(...angles)}`);
        for (let k = 0; k < 3; k++) { const key = [position(ids[k]), position(ids[(k + 1) % 3])].sort().join('|'); edges.set(key, (edges.get(key) || 0) + 1); }
      }
      if (!['Plane', 'Disc'].includes(shape)) assert.ok([...edges.values()].every(n => n === 2), `${shape} solid must close across UV seams`);
      if (shape === 'Plane') assert.ok(Array.from(g.Vertices).filter((n, i) => i % 3 === 0).includes(0), 'a middle row must exist even at minimum complexity');
    }
  }
});
test('primitive dimensions and placement apply before adding, and previews are independent', () => {
  const options = { shape: 'Box', width: 60, height: 20, depth: 8, position: [10, 20, 30] }, a = buildForgePrimitive(options), b = buildForgePrimitive(options), p = a.geosets[0].Vertices;
  for (let axis = 0; axis < 3; axis++) { const values = Array.from(p).filter((_, i) => i % 3 === axis), half = [30, 10, 4][axis]; assert.equal(Math.min(...values), options.position[axis] - half); assert.equal(Math.max(...values), options.position[axis] + half); }
  p[0] = 999; assert.notEqual(p[0], b.geosets[0].Vertices[0]);
  const rotated = buildForgePrimitive({ shape: 'Plane', width: 60, height: 20, rotation: [0, 90, 0] }).geosets[0].Vertices;
  assert.ok(Array.from(rotated).filter((_, i) => i % 3 === 0).every(n => Math.abs(n) < 1e-5));
  for (const options of [{ complexity: 5 }, { width: 0 }, { rotation: [NaN, 0, 0] }, { shape: 'Bad' }]) assert.throws(() => buildForgePrimitive(options));
});
test('each primitive commits through Forge, saves to MDL and MDX, and undoes as one operation', () => {
  for (const shape of FORGE_SHAPES) {
    const doc = createDemoDocument(), before = structuredClone(doc.model), mesh = buildForgePrimitive({ shape });
    const result = doc.apply('Forge shape', [], model => commitForge(model, mesh, { texturePath: 'MDLxL_Forge\\mdlxl-shape-white-v1.tga' })), gi = result.geosetIndices[0];
    for (const format of ['mdl', 'mdx']) { const reopened = openDocument(doc.serialize(format)); assert.equal(reopened.diagnostics.filter(d => d.severity === 'error').length, 0); const g = reopened.model.Geosets[gi]; assert.equal(g.Faces.length, mesh.geosets[0].Faces.length); assert.deepEqual(g.TVertices, mesh.geosets[0].TVertices); }
    doc.undo(); assert.deepEqual(doc.model, before);
  }
});
