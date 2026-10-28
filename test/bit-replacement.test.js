import test from 'node:test';
import assert from 'node:assert/strict';
import { createNode, openDocument, validateModel } from '../src/editor-document.js';
import { createStarterDocument } from '../src/starter-model.js';
import { collectPart, collectedPartModel, commitPart, partRgbSnapshot, positionPart, previewPartReplacement, serializeCollectedPart, transformPart } from '../src/bits-and-parts.js';
import { transformVertices } from '../src/editor-commands.js';
import { sampleGeosetAnimation } from '../src/animation.js';
import { selectedVertexCenter } from '../src/bone-tools.js';

const all = model => Object.fromEntries(model.Geosets.map((geoset, index) => [index, Array.from({ length: geoset.Vertices.length / 3 }, (_, id) => id)]));
const errors = model => validateModel(model).filter(issue => issue.severity === 'error');

test('replacement preview removes exactly the selection, centers the Bit, and leaves both documents unchanged', () => {
  const target = createStarterDocument(), source = createStarterDocument().model;
  const before = target.serialize('mdx'), donorBefore = structuredClone(source), selection = { 0: [0, 1, 2, 3] };
  const placed = positionPart(source, target.model, selection);
  assert.deepEqual(selectedVertexCenter(placed, all(placed)), selectedVertexCenter(target.model, selection));
  const preview = previewPartReplacement(target.model, placed, selection);
  assert.equal(preview.model.Geosets[0].Vertices.length / 3, 4);
  assert.equal(preview.model.Geosets[0].Faces.length, 6);
  assert.equal(preview.model.Geosets[1].Vertices.length / 3, 8);
  assert.deepEqual(preview.geosetIndices, [1]);
  assert.deepEqual(errors(preview.model), []);
  assert.deepEqual(target.serialize('mdx'), before); assert.deepEqual(source, donorBefore);
});

test('full replacement retains existing bones, source RGB, and shared appearance; undo/redo and both formats roundtrip', () => {
  const doc = createStarterDocument(), source = createStarterDocument().model;
  source.Textures[0].Image = 'textures\\WHITE.BLP';
  source.GeosetAnims = [{ GeosetId: 0, Flags: 2, Alpha: .8, Color: new Float32Array([.25, .5, 1]) }];
  const before = doc.serialize('mdx'), bones = structuredClone(doc.model.Bones);
  const result = doc.apply('Replace Part', [], model => commitPart(model, source, { replacement: all(model) }));
  assert.deepEqual(result.geosetIndices, [0]); assert.deepEqual(result.boneIds, [0]);
  assert.deepEqual(doc.model.Bones, bones); assert.equal(doc.model.Geosets.length, 1);
  assert.deepEqual(doc.model.Geosets[0].Groups, [[0]]);
  assert.equal(doc.model.Textures.length, 1); assert.equal(doc.model.Materials.length, 1);
  assert.deepEqual(doc.model.GeosetAnims[0].Color, source.GeosetAnims[0].Color);
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format)); assert.equal(reopened.readOnly, false);
    assert.deepEqual(reopened.model.Geosets[0].Groups, [[0]]); assert.deepEqual(errors(reopened.model), []);
  }
  const after = doc.serialize('mdx'); assert.equal(doc.undo(), true); assert.deepEqual(doc.serialize('mdx'), before);
  assert.equal(doc.redo(), true); assert.deepEqual(doc.serialize('mdx'), after);
});

test('classic multiple bindings and HD weights transfer from nearest selected vertices without importing source bones', () => {
  for (const version of [800, 1000]) {
    const doc = createStarterDocument(version), source = createStarterDocument(version).model;
    const second = createNode(doc.model, 'Bone'); second.Name = 'Weapon';
    const geoset = doc.model.Geosets[0]; geoset.Groups = [[0], [second.ObjectId]];
    for (let id = 0; id < 8; id++) geoset.VertexGroup[id] = id % 2;
    if (version === 1000) {
      geoset.SkinWeights = new Uint8Array(64);
      for (let id = 0; id < 8; id++) geoset.SkinWeights.set([0, second.ObjectId, 0, 0, id % 2 ? 64 : 192, id % 2 ? 191 : 63, 0, 0], id * 8);
    }
    const weights = geoset.SkinWeights?.slice(), groups = geoset.VertexGroup.slice();
    const result = commitPart(doc.model, source, { replacement: all(doc.model) });
    assert.deepEqual(result.boneIds, [0, second.ObjectId]); assert.equal(doc.model.Bones.length, 2);
    if (weights) assert.deepEqual(doc.model.Geosets[0].SkinWeights, weights);
    else assert.deepEqual(doc.model.Geosets[0].VertexGroup, groups);
    assert.deepEqual(errors(doc.model), []);
  }
});

test('replacement removes only orphaned replaced materials, remaps survivors, and protects ribbon references', () => {
  for (const ribbon of [false, true]) {
    const doc = createStarterDocument(), source = createStarterDocument().model;
    doc.model.Materials.push({ ...structuredClone(doc.model.Materials[0]), PriorityPlane: 2 });
    const other = structuredClone(doc.model.Geosets[0]); other.MaterialID = 1; doc.model.Geosets.push(other);
    // Keep a pre-existing unused material outside the replacement boundary.
    doc.model.Materials.push({ ...structuredClone(doc.model.Materials[0]), PriorityPlane: 3 });
    source.Materials[0].PriorityPlane = 4;
    if (ribbon) createNode(doc.model, 'RibbonEmitter').MaterialID = 0;
    const result = commitPart(doc.model, source, { replacement: { 0: Array.from({ length: 8 }, (_, id) => id) } });
    assert.equal(doc.model.Geosets.length, 2);
    assert.equal(doc.model.Materials.length, ribbon ? 4 : 3);
    assert.equal(doc.model.Materials[doc.model.Geosets[0].MaterialID].PriorityPlane, 2);
    assert.equal(doc.model.Materials[result.materialMap[0]].PriorityPlane, 4);
    assert.ok(doc.model.Materials.some(material => material.PriorityPlane === 3));
    assert.deepEqual(errors(doc.model), []);
  }
});

test('partial replacement preserves unselected attributes and material settings prevent false deduplication', () => {
  const doc = createStarterDocument(), source = createStarterDocument().model;
  const original = structuredClone(doc.model.Geosets[0]); source.Materials[0].Layers[0].Alpha = .5;
  commitPart(doc.model, source, { replacement: { 0: [0, 1, 2, 3] } });
  assert.deepEqual(doc.model.Geosets[0].Vertices, original.Vertices.slice(12));
  assert.deepEqual(doc.model.Geosets[0].TVertices[0], original.TVertices[0].slice(8));
  assert.equal(doc.model.Textures.length, 1); assert.equal(doc.model.Materials.length, 2);
  assert.deepEqual(errors(doc.model), []);
});

test('material reuse compares texture contents and settings even when existing texture IDs differ', () => {
  const doc = createStarterDocument(), source = createStarterDocument().model;
  doc.model.Textures.push({ ...doc.model.Textures[0], Image: 'textures\\WHITE.blp' });
  doc.model.Materials[0].Layers[0].TextureID = 1;
  commitPart(doc.model, source, { replacement: all(doc.model) });
  assert.equal(doc.model.Textures.length, 2); assert.equal(doc.model.Materials.length, 1);
  assert.equal(doc.model.Geosets[0].MaterialID, 0); assert.deepEqual(errors(doc.model), []);
});

test('placement transforms the whole Bit around one pivot and errors are atomic', () => {
  const doc = createStarterDocument(), source = createStarterDocument().model;
  source.Geosets.push(structuredClone(source.Geosets[0]));
  const transformed = transformPart(source, { translation: [10, 20, 30], rotation: [0, 0, 90], scale: [2, 2, 2] });
  assert.deepEqual(selectedVertexCenter(transformed, all(transformed)), [10, 20, 30]);
  assert.deepEqual(transformed.Geosets[0].Vertices, transformed.Geosets[1].Vertices);
  const before = structuredClone(doc.model);
  source.Geosets[1].MaterialID = 999;
  assert.throws(() => commitPart(doc.model, source, { replacement: all(doc.model) }), /missing material/);
  assert.deepEqual(doc.model, before);
  assert.throws(() => commitPart(doc.model, createStarterDocument().model, { replacement: {} }), /Select vertices/);
  assert.deepEqual(doc.model, before);
});

test('saved RGB palettes retain all tracks; selecting Red or Blue imports the correct static color in WC3 byte order', () => {
  for (const version of [800, 1000]) {
    const source = createStarterDocument(version).model;
    source.Sequences = ['Red', 'Blue'].map((Name, index) => ({ Name, Interval: Uint32Array.of(1000 + index * 2000, 1900 + index * 2000), MoveSpeed: 0, NonLooping: false, Rarity: 0, MinimumExtent: source.Info.MinimumExtent.slice(), MaximumExtent: source.Info.MaximumExtent.slice(), BoundsRadius: source.Info.BoundsRadius }));
    source.GeosetAnims = [{ GeosetId: 0, Flags: 2, Alpha: .75, Color: { LineType: 1, GlobalSeqId: null, Keys: [1000, 1900, 3000, 3900].map((Frame, index) => ({ Frame, Vector: Float32Array.from(index < 2 ? [1, 0, 0] : [0, 0, 1]) })) } }];
    const collected = collectedPartModel(collectPart(source, all(source)), { name: 'RGB palette' });
    const savedBytes = Buffer.from(serializeCollectedPart(collected)), keyOffset = savedBytes.indexOf(Buffer.from('KGAC'));
    assert.deepEqual([20, 24, 28].map(offset => savedBytes.readFloatLE(keyOffset + offset)), [0, 0, 1], 'animated Red uses BGR in KGAC');
    const saved = openDocument(savedBytes).model, before = structuredClone(saved);
    assert.deepEqual(saved.Sequences.map(sequence => sequence.Name), ['Red', 'Blue']);
    assert.equal(saved.GeosetAnims[0].Color.Keys.length, 4);
    for (const [sequenceIndex, expected] of [[0, [1, 0, 0]], [1, [0, 0, 1]]]) {
      const snapshot = partRgbSnapshot(saved, sequenceIndex);
      assert.deepEqual([...snapshot.GeosetAnims[0].Color], expected); assert.equal(snapshot.Sequences.length, 0);
      const target = createStarterDocument(version), result = target.apply('Replace with RGB', [], model => commitPart(model, saved, { replacement: all(model), rgbSequence: sequenceIndex }));
      assert.equal(target.model.Sequences.length, 0); assert.equal(target.model.GeosetAnims[0].Alpha, .75);
      const mdx = Buffer.from(target.serialize('mdx')), offset = mdx.indexOf(Buffer.from('GEOA'));
      assert.deepEqual([20, 24, 28].map(index => mdx.readFloatLE(offset + index)), expected, 'static imported color uses RGB in GEOA');
      assert.equal(mdx.indexOf(Buffer.from('KGAC')), -1);
      for (const format of ['mdl', 'mdx']) {
        const reopened = openDocument(target.serialize(format)).model;
        assert.deepEqual(sampleGeosetAnimation(reopened, result.geosetIndices[0], 0, -1).color, expected);
        assert.deepEqual(errors(reopened), []);
        if (format === 'mdl') assert.match(new TextDecoder().decode(target.serialize('mdl')), new RegExp('static Color \\{\\s*' + [...expected].reverse().join(',\\s*') + '\\s*\\}'));
      }
    }
    assert.deepEqual(saved, before);
  }
});

const bounds = (model, selection = all(model)) => {
  const points = Object.entries(selection).flatMap(([index, ids]) => ids.map(id => Array.from(model.Geosets[index].Vertices.slice(id * 3, id * 3 + 3))));
  return [0, 1, 2].map(axis => [Math.min(...points.map(point => point[axis])), Math.max(...points.map(point => point[axis]))]);
};
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-4, actual + ' != ' + expected);

test('replacement fits actual selected bounds across geosets, independent of saved bounds and vertex density', () => {
  const source = createStarterDocument().model, target = createStarterDocument().model;
  source.Geosets.push(structuredClone(source.Geosets[0]));
  // Different pieces retain their relative placement under one shared transform.
  transformVertices(source.Geosets[1], all(source)[1], [64, 0, 0]);
  transformVertices(target.Geosets[0], all(target)[0], [120, -70, 25], [2, .5, 3]);
  target.Geosets.push(structuredClone(target.Geosets[0]));
  transformVertices(target.Geosets[1], all(target)[1], [50, 0, 0]);
  const selection = { 0: [0, 1, 2, 3, 4, 0], 1: [6, 7] };
  // An unselected distant part and intentionally stale Info/geoset extents
  // must not participate in measuring what is being replaced.
  target.Geosets.push(structuredClone(target.Geosets[0]));
  transformVertices(target.Geosets[2], all(target)[2], [10000, 10000, 10000]);
  const before = structuredClone({ source, target }), expected = bounds(target, selection);
  const fitted = positionPart(source, target, selection);
  bounds(fitted).flat().forEach((value, index) => near(value, expected.flat()[index]));
  assert.deepEqual(fitted.Geosets[0].TVertices, source.Geosets[0].TVertices);
  assert.deepEqual(fitted.Geosets[0].Faces, source.Geosets[0].Faces);
  // The adjoining ends of the two source pieces still meet after fitting.
  near(fitted.Geosets[0].Vertices[3], fitted.Geosets[1].Vertices[0]);
  assert.deepEqual({ source, target }, before);
});

test('fitted replacement uses the existing inverse-scale normals/tangents and transfers bindings at fitted positions', () => {
  for (const version of [800, 1000]) {
    const source = createStarterDocument(version).model, doc = createStarterDocument(version);
    const geoset = source.Geosets[0];
    if (version === 1000) {
      geoset.Tangents = new Float32Array(8 * 4);
      for (let id = 0; id < 8; id++) geoset.Tangents.set([Math.SQRT1_2, -Math.SQRT1_2, 0, 1], id * 4);
    }
    let second;
    doc.apply('Add binding fixture', [], model => { second = createNode(model, 'Bone'); });
    const target = doc.model, selection = all(target);
    target.Geosets[0].Groups = [[0], [second.ObjectId]];
    target.Geosets[0].TotalGroupsCount = 2;
    if (version === 1000) target.Geosets[0].SkinWeights = new Uint8Array(64);
    for (let id = 0; id < 8; id++) {
      target.Geosets[0].VertexGroup[id] = id % 2;
      if (version === 1000) target.Geosets[0].SkinWeights.set([0, second.ObjectId, 0, 0, id % 2 ? 64 : 192, id % 2 ? 191 : 63, 0, 0], id * 8);
    }
    transformVertices(target.Geosets[0], selection[0], [250, -80, 30], [2, .5, 3]);
    doc.apply('Record target fixture', [], () => {});
    const original = structuredClone(target.Geosets[0]), fitted = positionPart(source, target, selection);
    const expectedNormal = [-.5, -2, -1 / 3], length = Math.hypot(...expectedNormal);
    Array.from(fitted.Geosets[0].Normals.slice(0, 3)).forEach((value, axis) => near(value, expectedNormal[axis] / length));
    if (version === 1000) {
      const n = fitted.Geosets[0].Normals, t = fitted.Geosets[0].Tangents;
      near(Math.hypot(...t.slice(0, 3)), 1); near(n[0] * t[0] + n[1] * t[1] + n[2] * t[2], 0);
      assert.equal(t[3], 1);
    }
    const before = doc.serialize('mdx'), preview = previewPartReplacement(target, fitted, selection);
    doc.apply('Replace fitted Bit', [], model => commitPart(model, fitted, { replacement: selection }));
    assert.deepEqual(doc.model.Geosets[0].Vertices, original.Vertices);
    assert.deepEqual(doc.model.Geosets[0].Vertices, preview.model.Geosets[0].Vertices);
    if (version === 800) assert.deepEqual(doc.model.Geosets[0].VertexGroup, original.VertexGroup);
    if (version === 1000) assert.deepEqual(doc.model.Geosets[0].SkinWeights, original.SkinWeights);
    for (const format of ['mdl', 'mdx']) {
      const reopened = openDocument(doc.serialize(format));
      assert.deepEqual(reopened.model.Geosets[0].Vertices, original.Vertices);
      assert.deepEqual(errors(reopened.model), []);
    }
    const after = doc.serialize('mdx'); doc.undo(); assert.deepEqual(doc.serialize('mdx'), before);
    doc.redo(); assert.deepEqual(doc.serialize('mdx'), after);
  }
});

test('flat and point selections fit measurable axes without collapsing the Bit or inventing thickness', () => {
  const target = createStarterDocument().model, source = createStarterDocument().model;
  transformVertices(target.Geosets[0], all(target)[0], [20, 30, 40], [2, 3, 4]);
  const flat = positionPart(source, target, { 0: [0, 1, 2, 3] });
  assert.deepEqual(bounds(flat), [[-44, 84], [-66, 126], [-120, -56]]);
  const point = positionPart(source, target, { 0: [6] });
  assert.deepEqual(bounds(point), [[52, 116], [94, 158], [136, 200]]);
  for (let id = 0; id < 8; id++) source.Geosets[0].Vertices[id * 3 + 2] = 10;
  const planar = positionPart(source, target, all(target));
  assert.deepEqual(bounds(planar), [[-44, 84], [-66, 126], [40, 40]]);
  assert.ok(planar.Geosets[0].Vertices.every(Number.isFinite));
  assert.throws(() => positionPart(source, target, {}), /Select vertices/);
  source.Geosets = [];
  assert.throws(() => positionPart(source, target, all(target)), /no vertices/);
});
