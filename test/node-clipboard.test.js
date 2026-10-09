import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, createNode, openDocument, validateModel } from '../src/editor-document.js';
import { captureNodeSelection, pasteNodesToDummy } from '../src/node-clipboard.js';
import { ensureDummyBone } from '../src/dummy-bone.js';
import { hasCanonicalSerializedNodeOrder, serializedNodes } from '../src/node-id-order.js';

test('selected nodes paste beneath one validated DummyBone and preserve selected hierarchy only', () => {
  const source = createDemoDocument(), root = createNode(source.model, 'Helper'), child = createNode(source.model, 'Bone'), omitted = createNode(source.model, 'Helper');
  root.Name = 'Copied Root'; child.Name = 'Copied Child'; omitted.Name = 'Not Copied'; child.Parent = root.ObjectId; root.Parent = omitted.ObjectId;
  root.Translation = { LineType: 1, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: new Float32Array([1, 2, 3]) }] };
  const clipboard = captureNodeSelection(source.model, [child.ObjectId, root.ObjectId]), target = createDemoDocument();
  const result = target.apply('Paste nodes', ['Nodes', 'PivotPoints'], model => pasteNodesToDummy(model, clipboard));
  const pastedRoot = target.model.Nodes[result.nodeMap[root.ObjectId]], pastedChild = target.model.Nodes[result.nodeMap[child.ObjectId]];
  assert.equal(pastedRoot.Parent, result.dummyId); assert.equal(pastedChild.Parent, pastedRoot.ObjectId);
  assert.deepEqual(pastedRoot.Translation, root.Translation);
  assert.equal(target.model.Nodes.filter(Boolean).some(node => node.Name === omitted.Name), false);
  assert.equal(target.model.Bones.filter(node => node.Name === 'DummyBone').length, 1);
  assert.deepEqual(validateModel(target.model).filter(issue => issue.severity === 'error'), []);
  for (const format of ['mdl', 'mdx']) assert.equal(openDocument(target.serialize(format), `nodes.${format}`).diagnostics.some(issue => issue.severity === 'error'), false);
});

test('a parented, occupied DummyBone is repaired with node and BitsAndParts imports in one undo step', async () => {
  const source = createDemoDocument(), copied = createNode(source.model, 'Helper'), clipboard = captureNodeSelection(source.model, [copied.ObjectId]);
  const target = createDemoDocument();
  target.apply('Occupy DummyBone', ['Nodes', 'PivotPoints'], model => {
    const occupied = createNode(model, 'Bone'); occupied.Name = 'DummyBone'; occupied.GeosetId = 0; occupied.GeosetAnimId = 0; occupied.Parent = model.Bones[0].ObjectId;
    occupied.Translation = { LineType: 1, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: new Float32Array([1, 2, 3]) }] };
  });
  const before = target.serialize('mdx');
  const original = structuredClone(target.model.Bones.find(node => node.Name === 'DummyBone'));
  const result = target.apply('Paste nodes', [], model => pasteNodesToDummy(model, clipboard));
  const dummy = target.model.Nodes[result.dummyId];
  assert.equal(dummy.Parent, null); assert.equal(dummy.GeosetId, null); assert.equal(dummy.GeosetAnimId, null);
  assert.deepEqual(dummy.Translation, original.Translation); assert.deepEqual(dummy.PivotPoint, original.PivotPoint);
  assert.equal(target.model.Nodes[result.nodeIds[0]].Parent, dummy.ObjectId);
  for (const format of ['mdl', 'mdx']) assert.equal(openDocument(target.serialize(format)).diagnostics.some(issue => issue.severity === 'error'), false);
  target.undo(); assert.deepEqual(target.serialize('mdx'), before);
  target.redo(); assert.equal(target.model.Bones.find(node => node.Name === 'DummyBone').Parent, null);
  target.undo();
  const { commitPart } = await import('../src/bits-and-parts.js');
  target.apply('Import part', [], model => commitPart(model, source.model));
  assert.equal(target.model.Bones.find(node => node.Name === 'DummyBone').Parent, null);
  assert.deepEqual(validateModel(target.model).filter(issue => issue.severity === 'error'), []);
  target.undo(); assert.deepEqual(target.serialize('mdx'), before);
});

test('DummyBone name collisions and stale node/pivot references are repaired without deleting authored nodes', () => {
  const model = createDemoDocument().model, helper = createNode(model, 'Helper'), duplicate = createNode(model, 'Bone'), dummy = createNode(model, 'Bone');
  helper.Name = duplicate.Name = dummy.Name = 'DummyBone';
  duplicate.Name = 'DummyBone_2';
  const beforeHelper = structuredClone(helper), count = serializedNodes(model).length;
  const first = ensureDummyBone(model);
  assert.equal(first, dummy); assert.deepEqual(helper, { ...beforeHelper, Name: 'DummyBone_3', ObjectId: helper.ObjectId });
  assert.equal(serializedNodes(model).length, count);
  assert.equal(serializedNodes(model).filter(node => node.Name === 'DummyBone').length, 1);
  delete model.Nodes[dummy.ObjectId]; dummy.PivotPoint = new Float32Array([NaN, 2, 3]); model.PivotPoints[dummy.ObjectId] = undefined;
  assert.equal(ensureDummyBone(model), dummy);
  assert.equal(model.Nodes[dummy.ObjectId], dummy); assert.deepEqual(dummy.PivotPoint, new Float32Array(3));
  assert.equal(model.PivotPoints[dummy.ObjectId], dummy.PivotPoint);
  assert.equal(hasCanonicalSerializedNodeOrder(model), true);
});

test('a non-Bone DummyBone is kept and renamed while imports create a shared Bone anchor', () => {
  const model = createDemoDocument().model, helper = createNode(model, 'Helper'); helper.Name = 'DummyBone'; helper.Parent = model.Bones[0].ObjectId;
  const parent = model.Nodes[helper.Parent], pivot = helper.PivotPoint, dummy = ensureDummyBone(model);
  assert.equal(helper.Name, 'DummyBone_2'); assert.equal(model.Nodes[helper.Parent], parent); assert.equal(helper.PivotPoint, pivot);
  assert.ok(model.Bones.includes(dummy)); assert.equal(dummy.Parent, null); assert.equal(ensureDummyBone(model), dummy);
});

test('duplicate DummyBones keep their children and use one repaired shared anchor', () => {
  const model = createDemoDocument().model, first = createNode(model, 'Bone'), second = createNode(model, 'Bone'), child = createNode(model, 'Helper');
  first.Name = second.Name = 'DummyBone'; child.Parent = second.ObjectId;
  assert.equal(ensureDummyBone(model), first);
  assert.equal(second.Name, 'DummyBone_2'); assert.equal(model.Nodes[child.Parent], second);
  assert.equal(model.Bones.filter(node => node.Name === 'DummyBone').length, 1);
});

test('an invalid DummyBone object ID is repaired together with its existing parent and mesh references', () => {
  const model = createDemoDocument().model, dummy = model.Bones[0], child = model.Attachments[0];
  dummy.Name = 'DummyBone'; dummy.ObjectId = -2; child.Parent = -2;
  model.Geosets[0].Groups = [[-2]];
  assert.equal(ensureDummyBone(model), dummy);
  assert.equal(model.Nodes[child.Parent], dummy); assert.deepEqual(model.Geosets[0].Groups, [[dummy.ObjectId]]);
  assert.deepEqual(validateModel(model).filter(issue => issue.severity === 'error'), []);
});

test('weighted imports move a high-index DummyBone into an unused byte-index slot without changing existing weighted bindings', () => {
  const model = createDemoDocument().model;
  for (let i = model.Bones.length; i < 257; i++) createNode(model, 'Bone');
  const dummy = model.Bones.at(-1); dummy.Name = 'DummyBone';
  const geoset = model.Geosets[0], weightedBone = model.Bones[0];
  geoset.SkinWeights = new Uint8Array(geoset.Vertices.length / 3 * 8);
  for (let offset = 0; offset < geoset.SkinWeights.length; offset += 8) geoset.SkinWeights.set([weightedBone.ObjectId, 0, 0, 0, 255, 0, 0, 0], offset);
  ensureDummyBone(model, { weighted: true });
  assert.ok(dummy.ObjectId <= 255); assert.equal(model.Nodes[geoset.SkinWeights[0]], weightedBone);
  assert.equal(hasCanonicalSerializedNodeOrder(model), true);
});

test('DummyBone insertion and node paste preserve serialized ObjectId order and existing binding identities', () => {
  const target = createDemoDocument(), source = createDemoDocument();
  const bindingNames = model => model.Geosets.map(geoset => geoset.Groups.map(group => group.map(id => model.Nodes[id].Name)));
  const beforeBindings = bindingNames(target.model), priorAttachment = { id: target.model.Attachments[0].ObjectId, name: target.model.Attachments[0].Name };
  const copiedBone = source.model.Bones[0], copiedHelper = createNode(source.model, 'Helper'); copiedHelper.Parent = copiedBone.ObjectId;
  const clipboard = captureNodeSelection(source.model, [copiedBone.ObjectId, copiedHelper.ObjectId]);
  const result = target.apply('Paste nodes', ['Nodes', 'PivotPoints'], model => pasteNodesToDummy(model, clipboard));
  assert.equal(hasCanonicalSerializedNodeOrder(target.model), true);
  assert.deepEqual(serializedNodes(target.model).map(node => node.ObjectId), Array.from({ length: target.model.Nodes.length }, (_, id) => id));
  assert.deepEqual(bindingNames(target.model), beforeBindings);
  const shiftedAttachment = target.model.Attachments.find(node => node.Name === priorAttachment.name);
  assert.ok(shiftedAttachment);
  assert.notEqual(shiftedAttachment.ObjectId, priorAttachment.id);
  assert.equal(target.model.Nodes[shiftedAttachment.ObjectId], shiftedAttachment);
  assert.equal(target.model.Nodes[result.nodeIds[1]].Parent, result.nodeIds[0]);
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(target.serialize(format), `ordered-nodes.${format}`);
    assert.equal(hasCanonicalSerializedNodeOrder(reopened.model), true);
    assert.deepEqual(bindingNames(reopened.model), beforeBindings);
  }
});

test('legacy high-ID DummyBone insertion is repaired without changing bound node identities', () => {
  const doc = createDemoDocument(), beforeBindings = doc.model.Geosets.map(geoset => geoset.Groups.map(group => group.map(id => doc.model.Nodes[id].Name)));
  const legacy = createNode(doc.model, 'Bone'); legacy.Name = 'DummyBone';
  assert.equal(hasCanonicalSerializedNodeOrder(doc.model), false);
  const repaired = ensureDummyBone(doc.model);
  assert.equal(repaired, legacy);
  assert.equal(hasCanonicalSerializedNodeOrder(doc.model), true);
  assert.deepEqual(doc.model.Geosets.map(geoset => geoset.Groups.map(group => group.map(id => doc.model.Nodes[id].Name))), beforeBindings);
  assert.equal(doc.model.Nodes[repaired.ObjectId], repaired);
});

test('paste repairs general noncanonical node order instead of requiring the one legacy DummyBone shape', () => {
  const target = createDemoDocument(), source = createDemoDocument();
  target.apply('Interleave added nodes', [], model => {
    const helper = createNode(model, 'Helper'), dummy = createNode(model, 'Bone'), later = createNode(model, 'Bone');
    dummy.Name = 'DummyBone'; later.Name = 'Later bone'; later.Parent = helper.ObjectId;
    model.Geosets[0].Groups = [[later.ObjectId]];
  });
  const originalBindings = target.model.Geosets.map(geoset => geoset.Groups.map(group => group.map(id => target.model.Nodes[id].Name)));
  const parents = new Map(target.model.Nodes.filter(Boolean).map(node => [node.Name, target.model.Nodes[node.Parent]?.Name]));
  const pivots = new Map(target.model.Nodes.filter(Boolean).map(node => [node.Name, Array.from(node.PivotPoint)]));
  const original = target.serialize('mdx');
  assert.equal(hasCanonicalSerializedNodeOrder(target.model), false);
  assert.notEqual(target.model.Bones.find(node => node.Name === 'DummyBone').ObjectId, target.model.Nodes.length - 1);
  const copied = captureNodeSelection(source.model, [source.model.Bones[0].ObjectId]);
  target.apply('Paste nodes', [], model => pasteNodesToDummy(model, copied));
  assert.equal(hasCanonicalSerializedNodeOrder(target.model), true);
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(target.serialize(format));
    assert.deepEqual(reopened.model.Geosets.map(geoset => geoset.Groups.map(group => group.map(id => reopened.model.Nodes[id].Name))), originalBindings);
    for (const node of reopened.model.Nodes.filter(node => node && parents.has(node.Name))) {
      assert.equal(reopened.model.Nodes[node.Parent]?.Name, parents.get(node.Name));
      assert.deepEqual(Array.from(node.PivotPoint), pivots.get(node.Name));
    }
    assert.deepEqual(validateModel(reopened.model).filter(issue => issue.severity === 'error'), []);
  }
  target.undo(); assert.equal(hasCanonicalSerializedNodeOrder(target.model), false); assert.deepEqual(target.serialize('mdx'), original);
});
