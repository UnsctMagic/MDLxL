import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  clampZoom,
  geosetTexture,
  groupGeosetsByTexture,
  markedUvPoints,
  uvBounds,
  uvEdges,
  uvPictureGeosets,
  uvPictureSize,
  uvRange,
  zoomedFocus,
} from '../src/ai-uv-picture.js';
import { AI_TOOLS } from '../src/ai-tools.js';
import { aiAssets } from '../app/ai-assets.js';
const { validateArguments } = createRequire(import.meta.url)('../electron/ai-mcp.cjs');

// A quad of two triangles sharing one edge: 5 unique edges.
const quad = (uvs, material = 0) => ({
  Vertices: new Float32Array(12),
  Faces: new Uint16Array([0, 1, 2, 0, 2, 3]),
  TVertices: [new Float32Array(uvs)],
  MaterialID: material,
});
const square = [0, 0, 1, 0, 1, 1, 0, 1];

test('UV edges are unique per shared edge and come out as flat pairs', () => {
  const edges = uvEdges(quad(square));
  assert.equal(edges.length, 5 * 4);
  assert.deepEqual(edges.slice(0, 4), [0, 0, 1, 0]);
  assert.deepEqual(uvEdges({ Faces: new Uint16Array([0, 1, 2]) }), []);
});

test('the drawn UV range is the whole 0..1 picture, widened to whole tiles around the UVs', () => {
  assert.deepEqual(uvRange(uvBounds([quad(square)])), { minU: 0, maxU: 1, minV: 0, maxV: 1 });
  assert.deepEqual(uvRange(uvBounds([quad([0.1, 0.2, 0.4, 0.2, 0.4, 0.5, 0.1, 0.5])])), { minU: 0, maxU: 1, minV: 0, maxV: 1 });
  const wide = uvBounds([quad([-0.2, 0, 2.3, 0, 2.3, 1.5, -0.2, 1.5])]);
  assert.ok(Math.abs(wide.minU + 0.2) < 1e-6 && Math.abs(wide.maxU - 2.3) < 1e-6 && wide.minV === 0 && wide.maxV === 1.5);
  assert.deepEqual(uvRange(wide), { minU: -1, maxU: 3, minV: 0, maxV: 2 });
  assert.deepEqual(uvRange(null), { minU: 0, maxU: 1, minV: 0, maxV: 1 });
  assert.equal(uvBounds([{ Faces: new Uint16Array([0]), TVertices: [] }]), null);
});

test('UV picture size keeps the range proportions on a 1024 px long side', () => {
  assert.deepEqual(uvPictureSize({ minU: 0, maxU: 1, minV: 0, maxV: 1 }), { width: 1024, height: 1024 });
  assert.deepEqual(uvPictureSize({ minU: -1, maxU: 3, minV: 0, maxV: 2 }), { width: 1024, height: 512 });
});

test('marked vertices become UV points and bad ids are ignored', () => {
  assert.deepEqual(markedUvPoints(quad(square), [1, 3, 9, -1]), [[1, 0], [0, 1]]);
  assert.deepEqual(markedUvPoints(quad(square), [0], 4), []);
});

test('geosets group by texture and default to those with marked vertices', () => {
  const model = {
    Textures: [{ Image: 'A.blp' }, { Image: 'a.blp' }, { Image: '', ReplaceableId: 1 }],
    Materials: [{ Layers: [{ TextureID: 0 }] }, { Layers: [{ TextureID: 1 }] }, { Layers: [{ TextureID: 2 }] }, { Layers: [] }],
    Geosets: [quad(square, 0), quad(square, 1), quad(square, 2), quad(square, 3)],
  };
  assert.deepEqual(geosetTexture(model, model.Geosets[2]), { textureId: 2, path: '', replaceableId: 1 });
  assert.equal(geosetTexture(model, model.Geosets[3]), null);
  const groups = groupGeosetsByTexture(model, [0, 1, 2, 3]);
  assert.deepEqual(groups.map(g => g.geosets), [[0, 1], [2], [3]]);
  assert.deepEqual(uvPictureGeosets(model, null, { 2: [0], 1: [] }), [2]);
  assert.deepEqual(uvPictureGeosets(model, null, {}), [0, 1, 2, 3]);
  assert.deepEqual(uvPictureGeosets(model, [3, 9], {}), [3]);
});

test('zoom shrinks the framed box around its centre', () => {
  const points = [0, 0, 0, 10, 20, 40];
  const box = zoomedFocus(points, 1);
  assert.equal(box.length, 24);
  const span = (list, k) => Math.max(...list.filter((_, i) => i % 3 === k)) - Math.min(...list.filter((_, i) => i % 3 === k));
  assert.deepEqual([0, 1, 2].map(k => span(box, k)), [10, 20, 40]);
  const near = zoomedFocus(points, 4);
  assert.deepEqual([0, 1, 2].map(k => span(near, k)), [2.5, 5, 10]);
  const centre = k => (Math.max(...near.filter((_, i) => i % 3 === k)) + Math.min(...near.filter((_, i) => i % 3 === k))) / 2;
  assert.deepEqual([0, 1, 2].map(centre), [5, 10, 20]);
  assert.equal(zoomedFocus([], 3).length, 0);
  assert.equal(clampZoom(20), 8);
  assert.equal(clampZoom(0.2), 1);
  assert.equal(clampZoom(undefined), 1);
});

test('the capture and assets tools accept the new fields and still reject unknown ones', () => {
  const capture = AI_TOOLS.find(t => t.name === 'mdlxl_capture').inputSchema,
    assets = AI_TOOLS.find(t => t.name === 'mdlxl_assets').inputSchema;
  const sample = { uv: true, uvSet: 1, wireframe: true, vertices: { 2: [0, 5] }, zoom: 3.5, geosets: [1] };
  validateArguments(capture, { target: 't', samples: [sample] });
  assert.throws(() => validateArguments(capture, { target: 't', samples: [{ zoom: 9 }] }), /out of range/);
  assert.throws(() => validateArguments(capture, { target: 't', samples: [{ vertices: [1] }] }), /wrong type/);
  assert.throws(() => validateArguments(capture, { target: 't', samples: [{ wires: true }] }), /Unknown/);
  validateArguments(assets, { target: 't', source: 'textures', action: 'preview', path: 'Textures\\Eyes.blp' });
  validateArguments(assets, { target: 't', source: 'game', action: 'preview', id: '4', signature: 's' });
});

test('texture preview by path looks in the model, then the editor, and says when nothing is found', async () => {
  const asked = [],
    host = { state: () => ({ model: { Textures: [] }, session: { path: 'D:\\m.mdx', assets: new Map() } }) },
    desktop = {
      resolveTextures: async payload => (asked.push(payload), []),
      gameFilesRead: async () => ({ type: 'models', name: 'x.mdx', bytes: new Uint8Array(1) }),
    };
  await assert.rejects(
    () => aiAssets({ source: 'textures', action: 'preview', path: 'Textures\\Eyes.blp' }, host, () => {}, desktop),
    /No texture was found at Textures\\Eyes\.blp/,
  );
  assert.deepEqual(asked, [{ path: 'D:\\m.mdx', names: ['Textures\\Eyes.blp'] }]);
  await assert.rejects(
    () => aiAssets({ source: 'game', action: 'preview', id: '4', signature: 's' }, host, () => {}, desktop),
    /Choose a texture/,
  );
  // A found texture goes on to decoding (which needs the editor's canvas, absent in Node).
  const found = { resolveTextures: async () => [{ name: 'Eyes.blp', bytes: new Uint8Array([1, 2, 3, 4]) }] };
  await assert.rejects(
    () => aiAssets({ source: 'model', action: 'preview', path: 'Eyes.blp' }, host, () => {}, found),
    /Background texture previews are unavailable/,
  );
});
