import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, composeNodeMatrices, inheritedParentMatrix, keysInInterval, nodePivot, sampleNodeMatrices, sampleNodeProperty, sampleTrack, TRANSFORM_DEFAULTS, worldPivot } from '../src/animation.js';
import { movementParentMatrix, sampleMovement } from '../src/movement.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';

// The node maths before animation.js owned it (audit WP-1.3), kept here as the
// reference the shared version must match bit for bit.
function referenceMatrices(model, frame = 0, sequenceIndex = -1, globalTime = frame) {
  const nodes = allNodes(model), byId = new Map(nodes.map(n => [n.ObjectId, n]));
  const matrices = new Map(), visiting = new Set();
  const interval = model.Sequences?.[sequenceIndex]?.Interval;
  const bindPose = sequenceIndex < 0 || !interval;
  const options = { interval, globalSequences: model.GlobalSequences, globalTime };
  function resolve(id) {
    if (matrices.has(id)) return matrices.get(id);
    const node = byId.get(id);
    if (!node || visiting.has(id)) return new Matrix4();
    visiting.add(id);
    let matrix = new Matrix4();
    if (!bindPose) {
      const translation = new Vector3().fromArray(sampleTrack(node.Translation, frame, { ...options, fallback: [0, 0, 0] }));
      const rotation = new Quaternion().fromArray(sampleTrack(node.Rotation, frame, { ...options, fallback: [0, 0, 0, 1], quaternion: true }));
      const scale = new Vector3().fromArray(sampleTrack(node.Scaling, frame, { ...options, fallback: [1, 1, 1] }));
      const pivot = new Vector3().fromArray(node.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]);
      matrix.compose(translation, rotation, scale);
      const rotatedPivot = pivot.clone().applyMatrix4(matrix).sub(translation);
      matrix.setPosition(translation.add(pivot).sub(rotatedPivot));
      if (node.Parent != null && byId.has(node.Parent)) {
        let parent = resolve(node.Parent);
        if (node.Flags & 7) {
          const p = new Vector3(), q = new Quaternion(), s = new Vector3();
          parent.decompose(p, q, s);
          if (node.Flags & 1) p.set(0, 0, 0);
          if (node.Flags & 2) q.identity();
          if (node.Flags & 4) s.set(1, 1, 1);
          parent = new Matrix4().compose(p, q, s);
        }
        matrix.premultiply(parent);
      }
    }
    visiting.delete(id); matrices.set(id, matrix); return matrix;
  }
  nodes.forEach(node => resolve(node.ObjectId));
  return matrices;
}

const sameMaps = (actual, expected) => {
  assert.deepEqual([...actual.keys()], [...expected.keys()]);
  for (const [id, matrix] of expected) assert.ok(actual.get(id).elements.every((v, i) => Object.is(v, matrix.elements[i])), `node ${id} differs`);
};
const knight = () => openDocument(readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx', import.meta.url)), 'knight.mdx').model;
// Every inherit-flag combination on a parented node, so the shared Flags block is exercised.
const withFlags = model => { allNodes(model).forEach((node, i) => { if (node.Parent != null && node.Parent >= 0) node.Flags = (node.Flags & ~7) | (i % 8); }); return model; };

test('shared node matrices match the previous sampler bit for bit', () => {
  for (const model of [createDemoDocument().model, knight(), withFlags(knight())]) {
    model.Sequences.forEach((sequence, index) => {
      const [from, to] = sequence.Interval;
      for (const frame of [from, from + (to - from) / 3, (from + to) / 2, to]) sameMaps(sampleNodeMatrices(model, frame, index), referenceMatrices(model, frame, index));
    });
    sameMaps(sampleNodeMatrices(model), referenceMatrices(model));
  }
});

test('parent loops resolve to identity as before', () => {
  const model = knight(), nodes = allNodes(model).filter(node => node.Parent != null && node.Parent >= 0);
  const [a] = nodes, parent = allNodes(model).find(node => node.ObjectId === a.Parent);
  parent.Parent = a.ObjectId;
  const frame = model.Sequences[0].Interval[0] + 100;
  sameMaps(sampleNodeMatrices(model, frame, 0), referenceMatrices(model, frame, 0));
});

test('inherited parent matrix and its callers keep their old results', () => {
  const parent = new Matrix4().compose(new Vector3(3, -4, 5), new Quaternion(0.2, -0.3, 0.4, 0.8).normalize(), new Vector3(1.5, 0.5, 2));
  assert.equal(inheritedParentMatrix(parent, 8), parent);
  for (let flags = 1; flags < 8; flags++) {
    const p = new Vector3(), q = new Quaternion(), s = new Vector3();
    parent.decompose(p, q, s);
    if (flags & 1) p.set(0, 0, 0); if (flags & 2) q.identity(); if (flags & 4) s.set(1, 1, 1);
    const expected = new Matrix4().compose(p, q, s);
    assert.deepEqual(inheritedParentMatrix(parent, flags).elements, expected.elements);
    const moved = movementParentMatrix({ Parent: 7, Flags: flags }, new Map([[7, parent]]));
    assert.deepEqual(moved.elements, expected.elements);
  }
  const plain = movementParentMatrix({ Parent: 7, Flags: 0 }, new Map([[7, parent]]));
  assert.notEqual(plain, parent);
  assert.deepEqual(plain.elements, parent.elements);
});

test('composeNodeMatrices takes local transforms from the caller', () => {
  const model = knight(), frame = model.Sequences[0].Interval[0] + 250;
  const custom = composeNodeMatrices(model, allNodes(model).map(n => n.ObjectId), node => ({
    t: new Vector3().fromArray(sampleNodeProperty(model, node, 'Translation', frame, 0)),
    r: new Quaternion().fromArray(sampleNodeProperty(model, node, 'Rotation', frame, 0)),
    s: new Vector3().fromArray(sampleNodeProperty(model, node, 'Scaling', frame, 0)),
  }));
  sameMaps(custom, referenceMatrices(model, frame, 0));
});

test('node property sampling, pivots and interval keys match the inline copies', () => {
  const model = knight(), [from, to] = model.Sequences[0].Interval;
  for (const node of allNodes(model)) {
    for (const property of ['Translation', 'Rotation', 'Scaling']) {
      const old = Array.from(sampleTrack(node[property], from + 77, { interval: model.Sequences[0].Interval, globalSequences: model.GlobalSequences, globalTime: from + 77,
        fallback: { Translation: [0, 0, 0], Rotation: [0, 0, 0, 1], Scaling: [1, 1, 1] }[property], quaternion: property === 'Rotation' }));
      assert.deepEqual(sampleNodeProperty(model, node, property, from + 77, 0), old);
      assert.deepEqual(sampleMovement(model, node, property, from + 77, 0), old);
      if (node[property]?.Keys) assert.deepEqual(keysInInterval(node[property], [from, to]), node[property].Keys.filter(k => k.Frame >= from && k.Frame <= to));
    }
    assert.equal(nodePivot(model, node), node.PivotPoint || model.PivotPoints?.[node.ObjectId] || [0, 0, 0]);
  }
  assert.deepEqual(nodePivot({ PivotPoints: [[1, 2, 3]] }, undefined, 0), [1, 2, 3]);
  assert.deepEqual(nodePivot({}, undefined, 4), [0, 0, 0]);
  const matrices = new Map([[2, new Matrix4().makeTranslation(1, 2, 3)]]);
  assert.deepEqual(worldPivot({ PivotPoints: { 2: [1, 1, 1] } }, 2, matrices).toArray(), [2, 3, 4]);
  assert.deepEqual(worldPivot({}, 5, matrices, { PivotPoint: [1, 0, 0] }).toArray(), [1, 0, 0]);
  assert.ok(Object.isFrozen(TRANSFORM_DEFAULTS.Rotation));
});
