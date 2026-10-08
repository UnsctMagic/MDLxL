import test from 'node:test';
import assert from 'node:assert/strict';
import { buildForgePrimitive, FORGE_SHAPES, FLAT_FORGE_SHAPES, PRIMITIVE_TEXTURE, TRIANGLE_ICON_UV } from '../src/forge-primitives.js';
import { thumperImage, THUMPER_TEXTURE } from '../src/forge-thumper.js';
import { commitForge } from '../src/forge.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';

test('Forge editor starters use Z-up height and preserve corner UVs', () => {
  const options = { width: 240, height: 140, depth: 160, position: [10, 20, 30] }, original = buildForgePrimitive(options).geosets[0], editor = buildForgePrimitive({ ...options, zUp: true }).geosets[0];
  const bounds = [0, 1, 2].map(axis => { const values = Array.from(editor.Vertices).filter((_, i) => i % 3 === axis); return [Math.min(...values), Math.max(...values)]; });
  assert.deepEqual(bounds, [[-110, 130], [-60, 100], [-40, 100]]);
  assert.deepEqual(editor.TVertices, original.TVertices);
  assert.deepEqual(editor.Faces, original.Faces);
  const plane = buildForgePrimitive({ shape: 'Plane', zUp: true }).geosets[0];
  assert.ok(Array.from(plane.Normals).filter((_, i) => i % 3 === 1).every(n => Math.abs(n + 1) < 1e-6), 'flat shapes face the editor front view');
});

test('all primitives stay modest, have usable UV triangles and regular geometry at every complexity', () => {
  for (const shape of FORGE_SHAPES) {
    let previous = 0;
    for (let complexity = 1; complexity <= 4; complexity++) {
      const mesh = buildForgePrimitive({ shape, complexity }), g = mesh.geosets[0];
      assert.ok((['Plane', 'ThumperXL'].includes(shape) ? mesh.triangleCount === (shape === 'Plane' ? 2 : 272) : mesh.triangleCount > previous) && mesh.triangleCount < 800, `${shape} ${complexity} triangle budget`); previous = mesh.triangleCount;
      assert.ok([...g.Vertices, ...g.Normals, ...g.TVertices[0]].every(Number.isFinite));
      const edges = new Map(), position = id => Array.from(g.Vertices.slice(id * 3, id * 3 + 3)).map(n => Math.round(n * 1000) / 1000).join(',');
      for (let i = 0; i < g.Faces.length; i += 3) {
        const ids = Array.from(g.Faces.slice(i, i + 3)), p = ids.map(id => Array.from(g.Vertices.slice(id * 3, id * 3 + 3))), uv = ids.map(id => Array.from(g.TVertices[0].slice(id * 2, id * 2 + 2)));
        assert.ok(Math.abs((uv[1][0] - uv[0][0]) * (uv[2][1] - uv[0][1]) - (uv[1][1] - uv[0][1]) * (uv[2][0] - uv[0][0])) > 1e-8, `${shape} UV triangle`);
        const lengths = p.map((v, k) => Math.hypot(...v.map((x, a) => x - p[(k + 1) % 3][a])));
        const angles = lengths.map((v, k) => Math.acos(Math.max(-1, Math.min(1, (lengths[(k + 1) % 3] ** 2 + lengths[(k + 2) % 3] ** 2 - v * v) / (2 * lengths[(k + 1) % 3] * lengths[(k + 2) % 3])))) * 180 / Math.PI);
        assert.ok(Math.min(...angles) >= (shape === 'ThumperXL' ? .05 : 15), `${shape} has a stretched triangle: ${Math.min(...angles)}`);
        for (let k = 0; k < 3; k++) { const key = [position(ids[k]), position(ids[(k + 1) % 3])].sort().join('|'); edges.set(key, (edges.get(key) || 0) + 1); }
      }
      if (!['Plane', 'Circle', 'Grid', 'ThumperXL'].includes(shape)) assert.ok([...edges.values()].every(n => n === 2), `${shape} solid must close across UV seams`);
      if (shape === 'Grid' && complexity > 1) assert.ok(Array.from(g.Vertices).filter((n, i) => i % 3 === 0).includes(0), 'subdivided grids have a middle row');
    }
  }
});
test('primitive dimensions and placement apply before adding, and previews are independent', () => {
  const options = { shape: 'Cube', width: 60, height: 20, depth: 8, position: [10, 20, 30] }, a = buildForgePrimitive(options), b = buildForgePrimitive(options), p = a.geosets[0].Vertices;
  for (let axis = 0; axis < 3; axis++) { const values = Array.from(p).filter((_, i) => i % 3 === axis), half = [30, 10, 4][axis]; assert.equal(Math.min(...values), options.position[axis] - half); assert.equal(Math.max(...values), options.position[axis] + half); }
  p[0] = 999; assert.notEqual(p[0], b.geosets[0].Vertices[0]);
  const rotated = buildForgePrimitive({ shape: 'Plane', width: 60, height: 20, rotation: [0, 90, 0] }).geosets[0].Vertices;
  assert.ok(Array.from(rotated).filter((_, i) => i % 3 === 0).every(n => Math.abs(n) < 1e-5));
  for (const options of [{ complexity: 5 }, { width: 0 }, { thickness: -1 }, { thickness: Infinity }, { thickness: 100001 }, { rotation: [NaN, 0, 0] }, { shape: 'Bad' }]) assert.throws(() => buildForgePrimitive(options));
});
test('thin primitives keep useful grid spacing instead of excessive cuts through their thickness', () => {
  for (const options of [{ shape: 'Cube', width: 60, height: 100, depth: 10 }, { shape: 'Grid', width: 100, height: 10 }]) {
    const mesh = buildForgePrimitive({ ...options, complexity: 4 }), g = mesh.geosets[0]; assert.ok(mesh.triangleCount < 220);
    if (options.shape === 'Cube') assert.equal(new Set(Array.from(g.Vertices).filter((_, i) => i % 3 === 2)).size, 2, 'thin side has a single cell through its depth');
    for (let i = 0; i < g.Faces.length; i += 3) { const p = Array.from(g.Faces.slice(i, i + 3), id => Array.from(g.Vertices.slice(id * 3, id * 3 + 3))), lengths = p.map((v, k) => Math.hypot(...v.map((n, a) => n - p[(k + 1) % 3][a]))); const angles = lengths.map((v, k) => Math.acos(Math.max(-1, Math.min(1, (lengths[(k + 1) % 3] ** 2 + lengths[(k + 2) % 3] ** 2 - v * v) / (2 * lengths[(k + 1) % 3] * lengths[(k + 2) % 3])))) * 180 / Math.PI); assert.ok(Math.min(...angles) >= 30); }
  }
});

test('flat Blender starters gain real, closed thickness with usable front, back and edge UVs', () => {
  for (const shape of FLAT_FORGE_SHAPES) for (let complexity = 1; complexity <= 4; complexity++) {
    const flat = buildForgePrimitive({ shape, complexity }), mesh = buildForgePrimitive({ shape, complexity, thickness: 10 }), g = mesh.geosets[0];
    assert.ok(mesh.triangleCount > flat.triangleCount && mesh.triangleCount < 800);
    const z = Array.from(g.Vertices).filter((_, i) => i % 3 === 2);
    assert.ok(Math.abs(Math.max(...z) - 5) < 1e-5 && Math.abs(Math.min(...z) + 5) < 1e-5, `${shape} thickness bounds`);
    const edges = new Map(), key = id => Array.from(g.Vertices.slice(id * 3, id * 3 + 3), n => Math.round(n * 1000)).join(','), p = id => Array.from(g.Vertices.slice(id * 3, id * 3 + 3));
    let volume = 0;
    for (let i = 0; i < g.Faces.length; i += 3) {
      const ids = Array.from(g.Faces.slice(i, i + 3)), [a, b, c] = ids.map(p), uv = ids.map(id => Array.from(g.TVertices[0].slice(id * 2, id * 2 + 2)));
      volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
      assert.ok(Math.abs((uv[1][0] - uv[0][0]) * (uv[2][1] - uv[0][1]) - (uv[1][1] - uv[0][1]) * (uv[2][0] - uv[0][0])) > 1e-8, `${shape} thick UV triangle`);
      for (let k = 0; k < 3; k++) { const edge = [key(ids[k]), key(ids[(k + 1) % 3])].sort().join('|'); edges.set(edge, (edges.get(edge) || 0) + 1); }
    }
    assert.ok([...edges.values()].every(count => count === 2), `${shape} must close across UV seams`);
    assert.ok(volume > 30000, `${shape} has outward winding and real volume`);
    const rotated = buildForgePrimitive({ shape, complexity, thickness: 10, rotation: [90, 0, 0], position: [0, 20, 0] }).geosets[0].Vertices;
    const y = Array.from(rotated).filter((_, i) => i % 3 === 1); assert.ok(Math.abs(Math.min(...y) - 15) < 1e-5 && Math.abs(Math.max(...y) - 25) < 1e-5, `${shape} thickness rotates and moves with the shape`);
  }
});
test('each primitive commits through Forge, saves to MDL and MDX, and undoes as one operation', () => {
  for (const shape of FORGE_SHAPES) {
    const doc = createDemoDocument(), before = structuredClone(doc.model), mesh = buildForgePrimitive({ shape, thickness: FLAT_FORGE_SHAPES.includes(shape) ? 10 : 0 });
    const result = doc.apply('Forge shape', [], model => commitForge(model, mesh, { texturePath: shape === 'ThumperXL' ? THUMPER_TEXTURE : PRIMITIVE_TEXTURE })), gi = result.geosetIndices[0];
    for (const format of ['mdl', 'mdx']) { const reopened = openDocument(doc.serialize(format)); assert.equal(reopened.diagnostics.filter(d => d.severity === 'error').length, 0); const g = reopened.model.Geosets[gi]; assert.equal(g.Faces.length, mesh.geosets[0].Faces.length); assert.deepEqual(g.TVertices, mesh.geosets[0].TVertices); }
    doc.undo(); assert.deepEqual(doc.model, before);
  }
});

test('lowest detail uses only essential triangles and each ordinary triangle includes the whole icon', () => {
  const counts = { Plane: 2, Cube: 12, Circle: 1, 'UV Sphere': 8, Icosphere: 20, Cylinder: 8, Cone: 4, Torus: 36, Grid: 2, 'Quad Sphere': 12 };
  assert.equal(PRIMITIVE_TEXTURE, String.raw`ReplaceableTextures\CommandButtons\BTNTemp.blp`);
  for (const [shape, count] of Object.entries(counts)) {
    const mesh = buildForgePrimitive({ shape }); assert.equal(mesh.triangleCount, count, shape);
    for (const g of mesh.geosets) for (let i = 0; i < g.Faces.length; i += 3) {
      const uv = Array.from(g.Faces.slice(i, i + 3)).flatMap(id => Array.from(g.TVertices[0].slice(id * 2, id * 2 + 2)));
      assert.deepEqual(uv, TRIANGLE_ICON_UV);
      for (const [u,v] of [[0,0],[0,1],[1,0],[1,1]]) assert.ok(v >= 0 && v <= 2 && u >= -.5 + v / 2 && u <= 1.5 - v / 2);
    }
  }
});

test('ThumperXL keeps gray armor and two red triangular eyes with outward side faces', () => {
  const g = buildForgePrimitive({ shape: 'ThumperXL' }).geosets[0], image = thumperImage();
  let eyes = 0, sides = 0;
  const key = id => Array.from(g.Vertices.slice(id * 3, id * 3 + 3), n => Math.round(n * 1000)).join(',');
  const edges = new Set();
  for (let i = 0; i < g.Faces.length; i += 3) for (let k = 0; k < 3; k++) edges.add(key(g.Faces[i + k]) + '|' + key(g.Faces[i + (k + 1) % 3]));
  for (let i = 0; i < g.Faces.length; i += 3) {
    const ids = Array.from(g.Faces.slice(i, i + 3)), p = ids.map(id => Array.from(g.Vertices.slice(id * 3, id * 3 + 3)));
    const id = ids[0], x = Math.floor(g.TVertices[0][id * 2] * image.width), color = Array.from(image.data.slice(x * 4, x * 4 + 3));
    if (color[0] > color[1] * 2) { eyes++; assert.ok(p.every(v => v[2] > 0)); }
    if (p.some(v => v[2] < 0) && p.some(v => v[2] > 0)) { sides++; for (let k = 0; k < 3; k++) assert.ok(edges.has(key(ids[(k + 1) % 3]) + '|' + key(ids[k])), 'solid side edges must wind opposite their front, back and side neighbors'); }
  }
  assert.equal(eyes, 2); assert.ok(sides > 0);
});
