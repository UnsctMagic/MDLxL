import test from 'node:test';
import assert from 'node:assert/strict';
import { nodeIndex, uniqueName } from '../src/node-hierarchy.js';

const node = (ObjectId, Parent, Name = `Node ${ObjectId}`) => ({ ObjectId, Parent, Name });

test('nodeIndex walks parents, depth, root and ancestry', () => {
  const bones = [node(0, null), node(1, 0), node(2, 1), node(3, 0)];
  const index = nodeIndex({ Bones: bones });
  assert.equal(index.parentOf(2), 1);
  assert.equal(index.parentOf(0), null);
  assert.deepEqual(index.ancestors(2), [1, 0]);
  assert.deepEqual(index.ancestors(2, true), [2, 1, 0]);
  assert.deepEqual([index.depth(0), index.depth(2), index.depth(3)], [0, 2, 1]);
  assert.deepEqual([index.root(2), index.root(3)], [0, 0]);
  assert.ok(index.isAncestor(2, 0) && index.isAncestor(2, 2));
  assert.ok(!index.isAncestor(3, 1) && !index.isAncestor(0, 2));
  assert.deepEqual(index.children.get(0).map(n => n.ObjectId), [1, 3]);
  assert.deepEqual(index.children.get(null).map(n => n.ObjectId), [0]);
});

test('null, -1, self and missing parents all mean no parent', () => {
  const bones = [node(0, null), node(1, -1), node(2, 2), node(3, 99), node(4, undefined)];
  const index = nodeIndex({ Bones: bones });
  for (const id of [0, 1, 2, 3, 4]) {
    assert.equal(index.parentOf(id), null);
    assert.equal(index.depth(id), 0);
    assert.equal(index.root(id), id);
    assert.deepEqual(index.ancestors(id, true), [id]);
  }
  assert.deepEqual(index.children.get(null).map(n => n.ObjectId), [0, 1, 2, 3, 4]);
  assert.equal(index.children.has(2), false);
});

test('a cycle stops where the walk meets itself', () => {
  // 3 hangs off a 0 → 1 → 2 → 0 loop.
  const bones = [node(0, 2), node(1, 0), node(2, 1), node(3, 1)];
  const index = nodeIndex({ Bones: bones });
  assert.deepEqual(index.ancestors(3, true), [3, 1, 0, 2]);
  assert.equal(index.depth(3), 3);
  assert.equal(index.depth(0), 2);
  assert.equal(index.root(3), 1);
  assert.equal(index.root(0), 0);
  assert.ok(index.isAncestor(3, 2));
  assert.ok(!index.isAncestor(0, 3));
});

test('an unknown id has no ancestry, and a node list narrows the index', () => {
  const bones = [node(0, null), node(1, 0)], helpers = [node(2, 1)];
  const all = nodeIndex({ Bones: bones, Helpers: helpers });
  assert.deepEqual([all.ancestors(7, true), all.depth(7), all.root(7), all.isAncestor(7, 7)], [[], 0, undefined, false]);
  const onlyHelpers = nodeIndex(null, helpers);
  assert.equal(onlyHelpers.parentOf(2), null);
  assert.equal(onlyHelpers.byId.has(0), false);
});

test("uniqueName keeps each caller's own naming scheme", () => {
  const used = new Set(['Glow', 'Glow 2', 'Ref', 'Ref_copy', 'bone_new0']);
  assert.equal(uniqueName('Fresh', used), 'Fresh');
  assert.equal(uniqueName('Glow', used), 'Glow 3');
  assert.equal(uniqueName('Ref_copy', used, n => `Ref_copy${n}`), 'Ref_copy2');
  assert.equal(uniqueName('bone_new0', used, n => `bone_new${n}`, 1), 'bone_new1');
  assert.equal(uniqueName('Hero', { has: name => name.toLowerCase() === 'hero' }), 'Hero 2');
});
