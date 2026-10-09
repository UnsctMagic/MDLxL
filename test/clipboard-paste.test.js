import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, createNode, openDocument, validateModel } from '../src/editor-document.js';
import { captureMeshSelection } from '../src/mesh-clipboard.js';
import { captureNodeSelection } from '../src/node-clipboard.js';
import { prepareClipboardPaste } from '../src/clipboard-paste.js';
import { forgeTangents } from '../src/forge.js';
import { adaptPasteFormat } from '../src/paste-format.js';
import { generateCompatibleMdx } from '../src/mdx-compatibility.js';

const copiedMesh = doc => captureMeshSelection(doc.model, {}, new Set([0]));
const commit = (doc, plan) => doc.apply('Fix and paste', [], model => { Object.assign(model, plan.model); return plan.result; });
const identity = () => new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
const roundTrip = doc => {
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format));
    assert.equal(reopened.readOnly, false); assert.deepEqual(validateModel(reopened.model).filter(issue => issue.severity === 'error'), []);
  }
};

test('a clean geometry paste needs no repair prompt and leaves both documents unchanged until committed', () => {
  const source = createDemoDocument(), target = createDemoDocument(), clipboard = copiedMesh(source), originalSource = source.serialize(), originalTarget = target.serialize();
  const count = target.model.Geosets.length;
  const plan = prepareClipboardPaste(target.model, clipboard);
  assert.deepEqual(plan.repairs, []); assert.deepEqual(source.serialize(), originalSource); assert.deepEqual(target.serialize(), originalTarget);
  commit(target, plan); assert.equal(target.model.Geosets.length, count + 1); roundTrip(target);
  target.undo(); assert.deepEqual(target.serialize(), originalTarget);
});

test('the repair prompt resolves parented DummyBone and general node order together with the paste', () => {
  const target = createDemoDocument(), source = createDemoDocument();
  target.apply('Interleaved parented anchor', [], model => {
    const helper = createNode(model, 'Helper'), dummy = createNode(model, 'Bone'), later = createNode(model, 'Bone');
    dummy.Name = 'DummyBone'; dummy.Parent = helper.ObjectId; dummy.GeosetId = 0; later.Parent = helper.ObjectId;
  });
  const before = target.serialize(), plan = prepareClipboardPaste(target.model, copiedMesh(source));
  assert.ok(plan.repairs.includes('Make DummyBone a root bone.')); assert.ok(plan.repairs.includes('Repair node order and update existing mesh bindings.'));
  assert.notEqual(target.model.Bones.find(node => node.Name === 'DummyBone').Parent, null);
  commit(target, plan); assert.equal(target.model.Bones.find(node => node.Name === 'DummyBone').Parent, null); roundTrip(target);
  target.undo(); assert.deepEqual(target.serialize(), before); target.redo(); roundTrip(target);
});

test('bind-pose models accept ordinary geometry paste and preserve existing node and camera matrices', () => {
  const target = createDemoDocument(); target.convertVersion(1000);
  target.apply('Bind poses', [], model => {
    model.Cameras = [{ Name: 'Portrait', Position: new Float32Array([100, 0, 50]), TargetPosition: new Float32Array([0, 0, 20]), FieldOfView: 1, NearClip: 1, FarClip: 1000 }];
    model.BindPoses = [{ Matrices: [...model.Nodes.filter(Boolean).map(identity), new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 77, 88, 99])] }];
  });
  const matrices = new Map(target.model.Nodes.filter(Boolean).map(node => [node.Name, structuredClone(target.model.BindPoses[0].Matrices[node.ObjectId])])), camera = structuredClone(target.model.BindPoses[0].Matrices.at(-1));
  const source = createDemoDocument(); source.convertVersion(1000);
  const before = target.serialize(), plan = prepareClipboardPaste(target.model, copiedMesh(source));
  assert.deepEqual(plan.repairs, []); commit(target, plan);
  for (const node of target.model.Nodes.filter(node => node && matrices.has(node.Name))) assert.deepEqual(target.model.BindPoses[0].Matrices[node.ObjectId], matrices.get(node.Name));
  assert.deepEqual(target.model.BindPoses[0].Matrices.at(-1), camera); roundTrip(target); target.undo(); assert.deepEqual(target.serialize(), before);
});

test('different SD formats adapt the clipboard copy and paste without changing either document format', () => {
  for (const [from, to] of [[800, 1000], [1000, 800]]) {
    const source = createDemoDocument(), target = createDemoDocument(); if (from === 1000) source.convertVersion(from); if (to === 1000) target.convertVersion(to);
    const original = source.serialize(), clipboard = copiedMesh(source), plan = prepareClipboardPaste(target.model, clipboard);
    assert.ok(plan.repairs.some(repair => repair.includes(`MDX${from} to MDX${to}`)));
    commit(target, plan); assert.equal(source.version, from); assert.equal(target.version, to);
    assert.deepEqual(source.serialize(), original); assert.deepEqual(target.model.Geosets.at(-1).Vertices, source.model.Geosets[0].Vertices); roundTrip(target);
  }
});

test('HD geometry pasted into Classic uses its exact vertices, UVs and diffuse texture after the format repair', () => {
  const source = createDemoDocument(), clipboard = copiedMesh(source), target = createDemoDocument();
  clipboard.model.Version = 1100;
  const geoset = clipboard.model.Geosets[0]; geoset.Tangents = forgeTangents(geoset); geoset.SkinWeights = new Uint8Array(geoset.Vertices.length / 3 * 8);
  for (let offset = 0; offset < geoset.SkinWeights.length; offset += 8) geoset.SkinWeights.set([0, 0, 0, 0, 255, 0, 0, 0], offset);
  clipboard.model.Materials[geoset.MaterialID].Layers[0].ShaderTypeId = 1;
  clipboard.model.Materials[geoset.MaterialID].Layers[0].NormalTextureID = 0;
  const original = structuredClone(clipboard.model), plan = prepareClipboardPaste(target.model, clipboard);
  assert.ok(plan.repairs.some(repair => repair.includes('Classic geometry and diffuse materials'))); commit(target, plan);
  const pasted = target.model.Geosets.at(-1);
  assert.deepEqual(pasted.Vertices, geoset.Vertices); assert.deepEqual(pasted.TVertices, geoset.TVertices); assert.equal(pasted.SkinWeights, undefined);
  assert.deepEqual(clipboard.model, original); roundTrip(target);
});

test('missing material, texture-animation and global-sequence references receive concrete repairs and paste successfully', () => {
  const source = createDemoDocument(), clipboard = copiedMesh(source), target = createDemoDocument();
  const material = clipboard.model.Materials[clipboard.model.Geosets[0].MaterialID];
  material.Layers[0].TextureID = 99; material.Layers[0].TVertexAnimId = 99;
  material.Layers[0].Alpha = { LineType: 1, GlobalSeqId: 99, Keys: [{ Frame: 0, Vector: new Float32Array([1]) }] };
  const plan = prepareClipboardPaste(target.model, clipboard);
  assert.equal(plan.repairs.length, 3); commit(target, plan); roundTrip(target);
  const missing = copiedMesh(source); missing.model.Geosets[0].MaterialID = 99;
  const next = prepareClipboardPaste(target.model, missing); assert.ok(next.repairs.includes('Restore missing pasted materials.')); commit(target, next); roundTrip(target);
});

test('broken destination parents, pivots and bindings are repaired before paste with one Undo', () => {
  const target = createDemoDocument(), source = createDemoDocument();
  target.model.Bones[0].Parent = 99; target.model.Bones[0].PivotPoint = new Float32Array([NaN, 0, 0]); target.model.PivotPoints[0] = undefined;
  target.model.Geosets[0].Groups = [[98]];
  const original = structuredClone(target.model), plan = prepareClipboardPaste(target.model, copiedMesh(source));
  assert.ok(plan.repairs.includes('Detach nodes from missing parents.')); assert.ok(plan.repairs.includes('Restore missing mesh binding nodes.'));
  assert.deepEqual(target.model, original); commit(target, plan); roundTrip(target);
});

test('an invalid DummyBone ID keeps its existing bound geometry and children through the repair', () => {
  const target = createDemoDocument(), source = createDemoDocument(), dummy = target.model.Bones[0];
  dummy.Name = 'DummyBone'; dummy.ObjectId = -2; target.model.Geosets[0].Groups = [[-2]]; target.model.Attachments[0].Parent = -2;
  const plan = prepareClipboardPaste(target.model, copiedMesh(source)); commit(target, plan);
  const repaired = target.model.Bones.find(node => node.Name === 'DummyBone');
  assert.equal(target.model.Nodes[target.model.Geosets[0].Groups[0][0]], repaired); assert.equal(target.model.Nodes[target.model.Attachments[0].Parent], repaired); roundTrip(target);
});

test('node paste offers the same repair flow across model formats', () => {
  const source = createDemoDocument(), target = createDemoDocument(); target.convertVersion(1000);
  const clipboard = captureNodeSelection(source.model, [source.model.Bones[0].ObjectId]), plan = prepareClipboardPaste(target.model, clipboard);
  assert.ok(plan.repairs.some(repair => repair.includes('MDX800 to MDX1000'))); commit(target, plan); roundTrip(target);
});

test('SD geometry receives the complete streams needed by an existing weighted HD destination', () => {
  const source = createDemoDocument(), target = createDemoDocument(); target.convertVersion(1000);
  target.apply('Weighted destination', [], model => {
    for (const geoset of model.Geosets) {
      geoset.Tangents = forgeTangents(geoset); geoset.SkinWeights = new Uint8Array(geoset.Vertices.length / 3 * 8);
      for (let vertex = 0; vertex < geoset.Vertices.length / 3; vertex++) geoset.SkinWeights.set([geoset.Groups[geoset.VertexGroup[vertex]][0], 0, 0, 0, 255, 0, 0, 0], vertex * 8);
    }
  });
  const plan = prepareClipboardPaste(target.model, copiedMesh(source));
  assert.ok(plan.repairs.includes('Build HD skin weights for the copied geometry.')); commit(target, plan);
  const geoset = target.model.Geosets.at(-1), dummy = target.model.Bones.find(node => node.Name === 'DummyBone');
  assert.equal(geoset.SkinWeights.length, geoset.Vertices.length / 3 * 8); assert.equal(geoset.Tangents.length, geoset.Vertices.length / 3 * 4);
  for (let offset = 0; offset < geoset.SkinWeights.length; offset += 8) assert.equal(geoset.SkinWeights[offset], dummy.ObjectId);
  roundTrip(target);
});

test('HD format adaptation retains texture-slot positions and the static texture behind animated keys', () => {
  const source = createDemoDocument().model; source.Version = 1100;
  const layer = source.Materials[0].Layers[0];
  layer.ShaderTypeId = 1;
  layer.ORMTextureID = { LineType: 0, Keys: [{ Frame: 0, Vector: new Int32Array([0]) }] };
  layer._MdxDefaults = { TextureID: 0, ORMTextureID: 0 };
  const before = structuredClone(source), older = adaptPasteFormat(source, 1000);
  assert.equal(older.Materials[0].Layers[1].TextureID, -1, 'the empty normal slot stays before ORM');
  assert.deepEqual(older.Materials[0].Layers[2].TextureID, layer.ORMTextureID);
  assert.equal(older.Materials[0].Layers[2]._MdxDefaults.TextureID, 0);
  const modern = adaptPasteFormat(older, 1100);
  assert.deepEqual(modern.Materials[0].Layers[0].ORMTextureID, layer.ORMTextureID);
  assert.equal(modern.Materials[0].Layers[0]._MdxDefaults.ORMTextureID, 0);
  assert.deepEqual(source, before);
});

test('special paste into MDX1400 widens donor skin indices before assigning imported nodes above 255', () => {
  const source = createDemoDocument(), template = createDemoDocument(); source.convertVersion(1000); template.model.Version = 1400;
  const target = openDocument(generateCompatibleMdx(template.model));
  target.apply('Large destination rig', [], model => { for (let index = 0; index < 260; index++) createNode(model, 'Bone'); });
  const clipboard = copiedMesh(source), geoset = clipboard.model.Geosets[0];
  geoset.Tangents = forgeTangents(geoset); geoset.SkinWeights = new Uint8Array(geoset.Vertices.length / 3 * 8);
  const oldId = geoset.Groups[0][0];
  for (let offset = 0; offset < geoset.SkinWeights.length; offset += 8) geoset.SkinWeights.set([oldId, 0, 0, 0, 255, 0, 0, 0], offset);
  const plan = prepareClipboardPaste(target.model, clipboard, { special: true }); commit(target, plan);
  const pasted = target.model.Geosets.at(-1), importedId = plan.result.nodeMap[oldId];
  assert.ok(importedId > 255); assert.ok(pasted.SkinWeights instanceof Uint16Array);
  for (let offset = 0; offset < pasted.SkinWeights.length; offset += 8) assert.equal(pasted.SkinWeights[offset], importedId);
  roundTrip(target);
});

test('same-document special paste reuses the intended bones after repairing interleaved node order', () => {
  const target = createDemoDocument();
  target.apply('Interleaved rig', [], model => {
    createNode(model, 'Helper');
    const bone = createNode(model, 'Bone'); bone.Name = 'Late_Bone'; model.Geosets[0].Groups = [[bone.ObjectId]];
  });
  const count = target.model.Nodes.filter(Boolean).length;
  const plan = prepareClipboardPaste(target.model, copiedMesh(target), { special: true, sameModel: true }); commit(target, plan);
  const pasted = target.model.Geosets[plan.result.geosetIndices[0]];
  assert.ok(pasted.Groups.every(group => group.every(id => target.model.Nodes[id].Name === 'Late_Bone')));
  assert.equal(target.model.Nodes.filter(Boolean).length, count); roundTrip(target);
});

test('a copied rig removed from the same document is restored from the clipboard during special paste', () => {
  const target = createDemoDocument(), clipboard = copiedMesh(target), oldId = clipboard.model.Geosets[0].Groups[0][0];
  target.model.Bones = target.model.Bones.filter(node => node.ObjectId !== oldId); delete target.model.Nodes[oldId];
  const plan = prepareClipboardPaste(target.model, clipboard, { special: true, sameModel: true });
  assert.ok(plan.repairs.includes('Restore missing copied rig nodes.'));
  const pasted = plan.model.Geosets[plan.result.geosetIndices[0]];
  assert.equal(plan.model.Nodes[pasted.Groups[0][0]].Name, `${clipboard.model.Nodes[oldId].Name}_import`);
  assert.deepEqual(validateModel(plan.model).filter(issue => issue.severity === 'error'), []);
});
