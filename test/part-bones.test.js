import test from 'node:test';
import assert from 'node:assert/strict';
import { partBones } from '../src/part-bones.js';

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
