import test from 'node:test';
import assert from 'node:assert/strict';
import { isHdSkinned, partBones, vertexBoneWeights, vertexBones } from '../src/part-bones.js';
import { geosetBoneIds } from '../src/resource-relations.js';

// Vertex 0 hangs on bone 3, vertex 1 on bones 2 and 4, vertex 2 on nothing.
const model = hd => ({
  Geosets: [hd
    ? { Vertices: new Float32Array(9), SkinWeights: new Uint8Array([3, 0, 0, 0, 255, 0, 0, 0, 2, 4, 0, 0, 128, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) }
    : { Vertices: new Float32Array(9), VertexGroup: [0, 1, 2], Groups: [[3], [2, 4], []] }],
});

test('a part gives the bones it hangs on, classic and HD', () => {
  for (const hd of [false, true]) {
    assert.deepEqual(partBones(model(hd), 0, 0), [3]);
    assert.deepEqual(partBones(model(hd), 0, 1), [2, 4]);
  }
});

test('no bone or a bad spot gives nothing', () => {
  assert.deepEqual(partBones(model(false), 0, 2), []);
  assert.deepEqual(partBones(model(false), 0, 9), []);
  assert.deepEqual(partBones(model(false), 5, 0), []);
});

test("vertexBones keeps each caller's own weight threshold; classic groups ignore it", () => {
  const hd = model(true).Geosets[0], classic = model(false).Geosets[0];
  assert.deepEqual(vertexBones(hd, 1), [2, 4]);
  assert.deepEqual(vertexBones(hd, 1, { minWeight: 128 }), [2]);
  assert.deepEqual(vertexBones(hd, 1, { minWeight: 129 }), []);
  assert.deepEqual(vertexBones(classic, 1, { minWeight: 128 }), [2, 4]);
  assert.deepEqual(geosetBoneIds(hd).sort(), [2, 3, 4]);
  assert.deepEqual(geosetBoneIds(classic, [1, 7]), [2, 4]);
});

test('vertexBoneWeights shares a vertex between its bones', () => {
  assert.deepEqual(vertexBoneWeights(model(true).Geosets[0], 1), [[2, 128 / 255], [4, 127 / 255]]);
  assert.deepEqual(vertexBoneWeights(model(false).Geosets[0], 1), [[2, .5], [4, .5]]);
  assert.deepEqual(vertexBoneWeights(model(false).Geosets[0], 2), []);
});

test('only a weight array of exactly eight bytes per vertex is HD', () => {
  const hd = model(true).Geosets[0];
  assert.ok(isHdSkinned(hd));
  assert.ok(!isHdSkinned(model(false).Geosets[0]));
  // A truncated array falls back to the vertex groups for every vertex.
  const truncated = { ...hd, SkinWeights: hd.SkinWeights.slice(0, 16), VertexGroup: [0, 0, 0], Groups: [[9]] };
  assert.ok(!isHdSkinned(truncated));
  assert.deepEqual(vertexBones(truncated, 0), [9]);
});
