import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { createStarterDocument } from '../src/starter-model.js';
import { openDocument, createNode } from '../src/editor-document.js';
import { commitGlow, glowSelection, GLOW_TYPES } from '../src/forge-glow.js';
import { sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { samplePreviewMatrices } from '../app/preview-pose.js';

const selection = { 0: [0, 1] };
const centerOf = vertices => [0, 1, 2].map(axis => Array.from(vertices).filter((_, i) => i % 3 === axis).reduce((a, b) => a + b) / (vertices.length / 3));
const near = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-4, `${a} != ${b}`));

test('selection placement uses unique valid vertices and weighted parent influence', () => {
  const model = createStarterDocument().model;
  const anchor = glowSelection(model, { 0: [0, 1, 1, -1, 999] });
  assert.equal(anchor.count, 2); assert.deepEqual(anchor.center, [0, -32, -32]); assert.equal(anchor.parentId, model.Bones[0].ObjectId);
  const second = createNode(model, 'Bone'), g = model.Geosets[0];
  g.SkinWeights = new Uint8Array(g.Vertices.length / 3 * 8);
  for (const id of [0, 1]) g.SkinWeights.set([0, second.ObjectId, 0, 0, 55, 200, 0, 0], id * 8);
  assert.equal(glowSelection(model, selection).parentId, second.ObjectId);
  assert.equal(glowSelection(model, selection).mixed, true);
});

test('every glow type creates its own centered bone and survives MDL/MDX export and undo', () => {
  for (const type of GLOW_TYPES) {
    const doc = createStarterDocument(), before = structuredClone(doc.model);
    // Include a helper to catch interleaved serialized node order on export.
    doc.apply('Helper', [], m => createNode(m, 'Helper'));
    const base = structuredClone(doc.model);
    const result = doc.apply('Glow Up', [], m => commitGlow(m, selection, { type: type.id, width: 80, height: 40, alpha: .37 }));
    const g = doc.model.Geosets.at(-1), bone = doc.model.Nodes[result.boneId];
    assert.equal(bone.Flags, 256 | type.flags); assert.equal(bone.Parent, before.Bones[0].ObjectId);
    near(Array.from(bone.PivotPoint), [0, -32, -32]); near(centerOf(g.Vertices), Array.from(bone.PivotPoint));
    assert.deepEqual(g.Groups, [[bone.ObjectId]]); assert.equal(g.Faces.length, 6);
    assert.equal(bone.GeosetId, result.geosetIndices[0]); assert.equal(doc.model.GeosetAnims[bone.GeosetAnimId].GeosetId, bone.GeosetId);
    assert.deepEqual(doc.model.Geosets.slice(0, -1), base.Geosets);
    assert.deepEqual(doc.model.Bones.slice(0, -1), base.Bones);
    for (const format of ['mdl', 'mdx']) {
      const reopened = openDocument(doc.serialize(format)).model, glow = reopened.Bones.find(b => b.Name === 'Glow'), saved = reopened.Geosets[glow.GeosetId];
      assert.equal(glow.Flags, bone.Flags); assert.equal(reopened.Nodes[glow.Parent].Name, base.Nodes[bone.Parent].Name);
      assert.deepEqual(saved.Groups, [[glow.ObjectId]]);
      assert.deepEqual(saved.Vertices, g.Vertices);
      const layer = reopened.Materials[saved.MaterialID].Layers[0];
      assert.equal(layer.FilterMode, 4); assert.equal(layer.Shading, 17); assert.ok(Math.abs(layer.Alpha - .37) < 1e-6);
      assert.equal(reopened.Textures[layer.TextureID].ReplaceableId, 2);
    }
    doc.undo(); assert.deepEqual(doc.model, base); doc.redo(); assert.equal(doc.model.Geosets.length, base.Geosets.length + 1);
  }
});

test('camera-facing glow stays centered through orbit and inherits parent animation', () => {
  const doc = createStarterDocument(), m = doc.model;
  m.Sequences = [{ Name: 'Move', Interval: new Uint32Array([0, 1000]) }];
  m.Bones[0].Translation = { LineType: 1, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: new Float32Array([0, 0, 0]) }, { Frame: 1000, Vector: new Float32Array([30, 20, 10]) }] };
  const result = commitGlow(m, selection, { width: 40, height: 20 });
  const g = m.Geosets.at(-1), bone = m.Nodes[result.boneId], expected = new Vector3().fromArray(bone.PivotPoint).applyMatrix4(sampleNodeMatrices(m, 1000, 0).get(bone.Parent));
  for (const position of [[200, 0, 0], [-130, 90, 150], [0, 200, 40]]) {
    const camera = new PerspectiveCamera(); camera.up.set(0, 0, 1); camera.position.set(...position); camera.lookAt(expected); camera.updateMatrixWorld();
    const points = skinGeoset(g, samplePreviewMatrices(m, 1000, 0, 1000, camera)); near(centerOf(points), expected.toArray());
    const a = new Vector3().fromArray(points, 0), b = new Vector3().fromArray(points, 3), c = new Vector3().fromArray(points, 6);
    const normal = b.sub(a).cross(c.sub(a)).normalize(); assert.ok(Math.abs(normal.dot(camera.getWorldDirection(new Vector3()))) > .999);
  }
});

test('flat planes, alpha endpoints, independent materials and root attachment are exact', () => {
  const m = createStarterDocument().model;
  for (const plane of ['xy', 'xz', 'yz']) {
    commitGlow(m, selection, { type: 'plane', plane, width: 20, height: 60, alpha: 0, parentId: null });
    const g = m.Geosets.at(-1), axis = { xy: 2, xz: 1, yz: 0 }[plane];
    assert.ok(Array.from(g.Vertices).filter((_, i) => i % 3 === axis).every(v => v === glowSelection(m, selection).center[axis]));
    assert.equal(m.Bones.at(-1).Parent, null); assert.equal(m.Materials[g.MaterialID].Layers[0].Alpha, 0);
  }
  commitGlow(m, selection, { alpha: 1 });
  assert.equal(m.Textures.filter(t => t.ReplaceableId === 2).length, 1);
  assert.equal(new Set(m.Bones.map(b => b.Name)).size, m.Bones.length);
  assert.equal(m.Materials.at(-1).Layers[0].Alpha, 1); assert.equal(m.Materials.at(-2).Layers[0].Alpha, 0);
});

test('invalid inputs cannot partially edit a document', () => {
  for (const [selected, settings] of [[{}, {}], [selection, { alpha: NaN }], [selection, { width: 0 }], [selection, { parentId: 9999 }], [selection, { type: 'unknown' }]]) {
    const doc = createStarterDocument(), before = structuredClone(doc.model);
    assert.throws(() => doc.apply('Glow Up', [], m => commitGlow(m, selected, settings))); assert.deepEqual(doc.model, before);
  }
});

test('adding an SD glow to a weighted model retains skins and existing bind matrices', () => {
  const doc = createStarterDocument(), m = doc.model; m.Version = 1000;
  const g = m.Geosets[0]; g.SkinWeights = new Uint8Array(g.Vertices.length / 3 * 8);
  for (let v = 0; v < g.Vertices.length / 3; v++) g.SkinWeights.set([0, 0, 0, 0, 255, 0, 0, 0], v * 8);
  const matrix = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
  m.BindPoses = [{ Matrices: [matrix] }]; const original = structuredClone(g);
  commitGlow(m, selection); assert.deepEqual(g, original); assert.deepEqual(m.BindPoses[0].Matrices[0], matrix); assert.equal(m.BindPoses[0].Matrices.length, 2);
  assert.equal(m.Geosets.at(-1).LevelOfDetail, 0); assert.equal(m.Geosets.at(-1).SkinWeights, undefined);
});
