import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { applyWiggleMatrices, wiggleMatrices } from '../src/bone-wiggle.js';

const model = {
  Bones: [
    { ObjectId: 0, Name: 'Root', Parent: -1 },
    { ObjectId: 1, Name: 'Arm', Parent: 0 },
    { ObjectId: 2, Name: 'Hand', Parent: 1 },
    { ObjectId: 3, Name: 'Leg', Parent: 0 },
  ],
  PivotPoints: [[0, 0, 0], [10, 0, 50], [30, 0, 50], [5, 0, 0]],
};
const view = new Vector3(0, -1, 0), side = new Vector3(1, 0, 0);
const moved = (matrix, point) => new Vector3(...point).applyMatrix4(matrix);

test('wiggle swings the selected bone and its children around its pivot', () => {
  const matrices = wiggleMatrices(model, [1], 0.3, view, side);
  const pivot = moved(matrices.get(1), [10, 0, 50]);
  assert.ok(pivot.distanceTo(new Vector3(10, 0, 50)) < 1e-4, 'the pivot stays put');
  const hand = moved(matrices.get(2), [30, 0, 50]);
  assert.ok(hand.distanceTo(new Vector3(30, 0, 50)) > 1, 'the child follows the swing');
  assert.ok(Math.abs(hand.distanceTo(pivot) - 20) < 1e-4, 'the swing is a rotation, not a stretch');
  for (const id of [0, 3]) assert.ok(moved(matrices.get(id), [7, 3, 9]).distanceTo(new Vector3(7, 3, 9)) < 1e-6, 'other bones stay at rest');
});

test('wiggle returns to rest at the start of each swing and ignores unknown ids', () => {
  const matrices = wiggleMatrices(model, [1], 0, view, side);
  assert.ok(moved(matrices.get(2), [30, 0, 50]).distanceTo(new Vector3(30, 0, 50)) < 1e-6);
  assert.equal(wiggleMatrices(model, [99], 0.3, view, side).size, 0);
});

test('wiggle writes renderer node matrices only when bones are selected', () => {
  const rendererData = { nodes: [0, 1, 2, 3].map(() => ({ matrix: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) })) };
  const camera = { quaternion: { x: 0, y: 0, z: 0, w: 1, isQuaternion: true }, getWorldDirection: target => target.set(0, -1, 0) };
  assert.equal(applyWiggleMatrices(rendererData, model, [], 0.3, camera), false);
  assert.equal(applyWiggleMatrices(rendererData, model, [1], 0.3, camera), true);
  assert.notDeepEqual(Array.from(rendererData.nodes[2].matrix), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  assert.deepEqual(Array.from(rendererData.nodes[3].matrix), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
});
