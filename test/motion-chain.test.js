import test from 'node:test';
import assert from 'node:assert/strict';
import { motionChain } from '../src/motion-chain.js';

// Root -> Chest -> Arm -> Hand, Chest -> Head. Vertex 0 hangs on the Hand,
// vertex 1 is shared by Arm and Head, vertex 2 has no bone.
function rider(hd = false) {
  return {
    Bones: [
      { Name: 'Root', ObjectId: 0 }, { Name: 'Chest', ObjectId: 1, Parent: 0 }, { Name: 'Arm', ObjectId: 2, Parent: 1 },
      { Name: 'Hand', ObjectId: 3, Parent: 2 }, { Name: 'Head', ObjectId: 4, Parent: 1 },
    ],
    Geosets: [hd
      ? { Vertices: new Float32Array(9), SkinWeights: new Uint8Array([3, 0, 0, 0, 255, 0, 0, 0, 2, 4, 0, 0, 128, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) }
      : { Vertices: new Float32Array(9), VertexGroup: [0, 1, 2], Groups: [[3], [2, 4], []] }],
  };
}

test('a spot on the hand gives the whole chain up to the root, root first', () => {
  assert.deepEqual(motionChain(rider(), { geosetIndex: 0, vertexIndex: 0 }), [0, 1, 2, 3]);
  assert.deepEqual(motionChain(rider(true), { geosetIndex: 0, vertexIndex: 0 }), [0, 1, 2, 3]);
});

test('a spot shared by two bones gives both branches once', () => {
  assert.deepEqual(motionChain(rider(), { geosetIndex: 0, vertexIndex: 1 }), [0, 1, 2, 4]);
  assert.deepEqual(motionChain(rider(true), { geosetIndex: 0, vertexIndex: 1 }), [0, 1, 2, 4]);
});

test('a double-clicked bone gives itself and its parents', () => {
  assert.deepEqual(motionChain(rider(), { nodeId: 2 }), [0, 1, 2]);
});

test('no bone or a bad spot gives nothing', () => {
  assert.deepEqual(motionChain(rider(), { geosetIndex: 0, vertexIndex: 2 }), []);
  assert.deepEqual(motionChain(rider(), { geosetIndex: 0, vertexIndex: 9 }), []);
  assert.deepEqual(motionChain(rider(), { geosetIndex: 5, vertexIndex: 0 }), []);
});
