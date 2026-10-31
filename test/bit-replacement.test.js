import test from 'node:test';
import assert from 'node:assert/strict';
import { createNode, openDocument, validateModel } from '../src/editor-document.js';
import { createStarterDocument } from '../src/starter-model.js';
import { collectPart, collectedPartModel, commitPart, partHasGlobalAnimations, partLook, partRgbOptions, positionPart, previewPartReplacement, serializeCollectedPart, transformPart } from '../src/bits-and-parts.js';
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

test('saved RGB palettes retain all tracks; choosing the Red or Blue RGB imports the correct static color in WC3 byte order', () => {
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
    const options = partRgbOptions(saved);
    assert.deepEqual(options.map(option => option.label), ['No RGB', '255/0/0', '0/0/255']);
    for (const [index, expected] of [[1, [1, 0, 0]], [2, [0, 0, 1]]]) {
      const snapshot = partLook(saved, options[index]);
      assert.deepEqual([...snapshot.GeosetAnims[0].Color], expected); assert.equal(snapshot.Sequences.length, 0);
      const target = createStarterDocument(version), result = target.apply('Replace with RGB', [], model => commitPart(model, saved, { replacement: all(model), look: options[index] }));
      // The Bit's own .75 alpha stays behind: the replaced geoset had no visibility of its own.
      assert.equal(target.model.Sequences.length, 0); assert.equal(target.model.GeosetAnims[0].Alpha, 1);
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

test('a part without animations keeps geosets whose animated alpha has a hidden zero base visible', () => {
  const source = createStarterDocument(800).model;
  source.GeosetAnims = [{ GeosetId: 0, Flags: 0, Alpha: { LineType: 0, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: Float32Array.of(1) }] }, Color: Float32Array.of(1, 1, 1), _MdxDefaults: { Alpha: 0 } }];
  assert.equal(partLook(source).GeosetAnims[0].Alpha, 1);
});

const sequence = (Name, start, end) => ({ Name, Interval: Uint32Array.of(start, end), MoveSpeed: 0, NonLooping: false, Rarity: 0, MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array(3), BoundsRadius: 0 });
const alphaTrack = pairs => ({ LineType: 0, GlobalSeqId: null, Keys: pairs.map(([Frame, value]) => ({ Frame, Vector: Float32Array.of(value) })) });
const shownIn = (model, geoset) => model.Sequences.map((item, index) => [item.Name, sampleGeosetAnimation(model, geoset, item.Interval[0], index).alpha, sampleGeosetAnimation(model, geoset, item.Interval[1], index).alpha]);

test('a replacement shows exactly where the replaced part showed; the Bit\'s own leftover keys never travel', () => {
  const doc = createStarterDocument(), bit = createStarterDocument().model;
  doc.model.Sequences = [sequence('Stand', 0, 1000), sequence('Attack', 2000, 3000)];
  doc.model.GeosetAnims = [{ GeosetId: 0, Flags: 0, Color: Float32Array.of(1, 1, 1), Alpha: alphaTrack([[0, 1], [2000, 0]]) }];
  // Like SlaanBlade: no animations, keys left behind by the models it came from.
  bit.GeosetAnims = [{ GeosetId: 0, Flags: 26, Color: Float32Array.of(1, 1, 1), Alpha: alphaTrack([[0, 1], [2500, 0], [48886, 0]]) }];
  const result = commitPart(doc.model, bit, { replacement: all(doc.model), look: partRgbOptions(bit)[0] });
  assert.deepEqual(shownIn(doc.model, result.geosetIndices[0]), [['Stand', 1, 1], ['Attack', 0, 0]]);
  assert.equal(doc.model.GeosetAnims.find(item => item.GeosetId === result.geosetIndices[0]).Flags, 24, 'No RGB clears only the tint flag');
  assert.deepEqual(errors(doc.model), []);
});

test('a new part gets CORP\'s standard visibility: body, corpse, or portrait background', () => {
  const sequences = [sequence('Stand', 0, 1000), sequence('Death', 2000, 3000), sequence('Decay Flesh', 4000, 5000), sequence('Decay Bone', 6000, 7000), sequence('Portrait', 8000, 9000)];
  const imported = configure => {
    const target = createStarterDocument().model, bit = createStarterDocument().model;
    target.Sequences = structuredClone(sequences); configure?.(bit);
    bit.GeosetAnims = [{ GeosetId: 0, Flags: 0, Color: Float32Array.of(1, 1, 1), Alpha: 0 }];
    const result = commitPart(target, bit, { look: partRgbOptions(bit)[0] });
    assert.deepEqual(errors(target), []);
    return shownIn(target, result.geosetIndices[0]).map(([, start, end]) => [start, end]);
  };
  assert.deepEqual(imported(), [[1, 1], [1, 1], [1, 0], [0, 0], [1, 1]], 'a body part lives until the end of Decay Flesh');
  assert.deepEqual(imported(bit => { bit.Textures[0].Image = 'Textures\\gutz.blp'; }), [[0, 0], [0, 0], [0, 1], [1, 0], [0, 0]], 'a corpse shows only while decaying');
  assert.deepEqual(imported(bit => { bit.Textures[0] = { Image: '', ReplaceableId: 2, Flags: 0 }; bit.Materials[0].Layers[0].FilterMode = 1; }), [[0, 0], [0, 0], [0, 0], [0, 0], [1, 1]], 'a team-glow background shows only in Portrait');
  const plain = createStarterDocument().model, bit = createStarterDocument().model;
  plain.Sequences = [sequence('Stand', 0, 1000)];
  bit.GeosetAnims = [{ GeosetId: 0, Flags: 0, Color: Float32Array.of(1, 1, 1), Alpha: 0 }];
  const { geosetIndices } = commitPart(plain, bit, { look: partRgbOptions(bit)[0] });
  assert.equal(plain.GeosetAnims.find(item => item.GeosetId === geosetIndices[0]).Alpha, 1, 'no decay: simply visible');
});

test('Bitz lists each distinct RGB once; a Bit with one RGB or none offers no choice', () => {
  const bit = createStarterDocument().model;
  bit.Geosets.push(structuredClone(bit.Geosets[0]));
  bit.Sequences = [sequence('Stand', 0, 1000), sequence('Walk', 2000, 3000), sequence('Attack', 4000, 5000), sequence('Death', 6000, 7000)];
  const color = pairs => ({ LineType: 0, GlobalSeqId: null, Keys: pairs.map(([Frame, rgb]) => ({ Frame, Vector: Float32Array.from(rgb) })) });
  bit.GeosetAnims = [
    { GeosetId: 0, Flags: 2, Alpha: 1, Color: color([[0, [1, 100 / 255, 1]], [2000, [1, 100 / 255, 1]], [4000, [100 / 255, 1, 1]], [6000, [1, 1, 1]]]) },
    { GeosetId: 1, Flags: 2, Alpha: 1, Color: color([[0, [1, 100 / 255, 1]], [2000, [1, 100 / 255, 1]], [4000, [1, 100 / 255, 1]], [6000, [1, 1, 1]]]) }];
  const options = partRgbOptions(bit);
  assert.deepEqual(options.map(option => option.label), ['No RGB', '255/100/255', '100/255/255 · 255/100/255']);
  assert.deepEqual(options[1].colors.map(rgb => rgb.map(part => Math.round(part * 255))), [[255, 100, 255], [255, 100, 255]]);
  const look = partLook(bit, options[0]);
  assert.deepEqual(look.GeosetAnims.map(item => [item.Flags, Array.from(item.Color)]), [[0, [1, 1, 1]], [0, [1, 1, 1]]]);
  bit.GeosetAnims = [{ GeosetId: 0, Flags: 2, Alpha: 1, Color: Float32Array.of(1, 0, 0) }];
  assert.deepEqual(partRgbOptions(bit).map(option => option.colors), [[[1, 0, 0], null]], 'one look is imported as is, without a list');
});

test('global animations: collecting may drop them, importing applies them only when asked', () => {
  const source = createStarterDocument().model;
  source.GlobalSequences = [1000];
  source.Materials[0].Layers[0].Alpha = { LineType: 1, GlobalSeqId: 0, Keys: [{ Frame: 0, Vector: Float32Array.of(.25) }, { Frame: 500, Vector: Float32Array.of(1) }] };
  const collected = collectPart(source, all(source));
  assert.equal(partHasGlobalAnimations(collected), true);
  const kept = collectedPartModel(collected, { name: 'Glow' }), dropped = collectedPartModel(collected, { name: 'Glow', keepGlobals: false });
  assert.ok(kept.GlobalSequences.length && kept.Materials.some(material => material.Layers[0].Alpha?.Keys));
  assert.deepEqual(dropped.GlobalSequences, []); assert.equal(partHasGlobalAnimations(dropped), false);
  assert.equal(dropped.Materials[dropped.Geosets[0].MaterialID].Layers[0].Alpha, .25);
  assert.deepEqual(errors(dropped), []);
  for (const globals of [true, false]) {
    const target = createStarterDocument().model, look = { ...partRgbOptions(kept)[0], globals };
    const { geosetIndices } = commitPart(target, kept, { look });
    const alpha = target.Materials[target.Geosets[geosetIndices[0]].MaterialID].Layers[0].Alpha;
    if (globals) { assert.equal(target.GlobalSequences[alpha.GlobalSeqId], 1000); assert.equal(alpha.Keys.length, 2); }
    else assert.equal(alpha, .25);
    assert.deepEqual(errors(target), []);
  }
});

const bounds = (model, selection = all(model)) => {
  const points = Object.entries(selection).flatMap(([index, ids]) => ids.map(id => Array.from(model.Geosets[index].Vertices.slice(id * 3, id * 3 + 3))));
  return [0, 1, 2].map(axis => [Math.min(...points.map(point => point[axis])), Math.max(...points.map(point => point[axis]))]);
};
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-4, actual + ' != ' + expected);

// The Bit keeps its own size and is centred on the selected part's actual bounds.
const centredOn = (source, target, selection) => {
  const own = bounds(source), goal = bounds(target, selection);
  return own.map(([low, high], axis) => { const shift = (goal[axis][0] + goal[axis][1]) / 2 - (low + high) / 2; return [low + shift, high + shift]; });
};

test('replacement keeps its size, centred on actual selected bounds across geosets, independent of saved bounds and vertex density', () => {
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
  const before = structuredClone({ source, target }), expected = centredOn(source, target, selection);
  const fitted = positionPart(source, target, selection);
  bounds(fitted).flat().forEach((value, index) => near(value, expected.flat()[index]));
  assert.deepEqual(fitted.Geosets[0].TVertices, source.Geosets[0].TVertices);
  assert.deepEqual(fitted.Geosets[0].Faces, source.Geosets[0].Faces);
  // The adjoining ends of the two source pieces still meet after fitting.
  near(fitted.Geosets[0].Vertices[3], fitted.Geosets[1].Vertices[0]);
  assert.deepEqual({ source, target }, before);
});

test('placed replacement keeps its normals/tangents and transfers bindings at placed positions', () => {
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
    Array.from(fitted.Geosets[0].Normals).forEach((value, index) => near(value, source.Geosets[0].Normals[index]));
    if (version === 1000) {
      const n = fitted.Geosets[0].Normals, t = fitted.Geosets[0].Tangents;
      near(Math.hypot(...t.slice(0, 3)), 1); near(n[0] * t[0] + n[1] * t[1] + n[2] * t[2], 0);
      assert.equal(t[3], 1);
    }
    const before = doc.serialize('mdx'), preview = previewPartReplacement(target, fitted, selection);
    doc.apply('Replace fitted Bit', [], model => commitPart(model, fitted, { replacement: selection }));
    assert.deepEqual(doc.model.Geosets[0].Vertices, fitted.Geosets[0].Vertices);
    assert.deepEqual(doc.model.Geosets[0].Vertices, preview.model.Geosets[0].Vertices);
    if (version === 800) assert.deepEqual(doc.model.Geosets[0].VertexGroup, original.VertexGroup);
    if (version === 1000) assert.deepEqual(doc.model.Geosets[0].SkinWeights, original.SkinWeights);
    for (const format of ['mdl', 'mdx']) {
      const reopened = openDocument(doc.serialize(format));
      assert.deepEqual(reopened.model.Geosets[0].Vertices, fitted.Geosets[0].Vertices);
      assert.deepEqual(errors(reopened.model), []);
    }
    const after = doc.serialize('mdx'); doc.undo(); assert.deepEqual(doc.serialize('mdx'), before);
    doc.redo(); assert.deepEqual(doc.serialize('mdx'), after);
  }
});

test('flat and point selections place the Bit at its own size without collapsing it', () => {
  const target = createStarterDocument().model, source = createStarterDocument().model;
  transformVertices(target.Geosets[0], all(target)[0], [20, 30, 40], [2, 3, 4]);
  for (const selection of [{ 0: [0, 1, 2, 3] }, { 0: [6] }, all(target)])
    assert.deepEqual(bounds(positionPart(source, target, selection)), centredOn(source, target, selection));
  for (let id = 0; id < 8; id++) source.Geosets[0].Vertices[id * 3 + 2] = 10;
  const planar = positionPart(source, target, all(target));
  assert.deepEqual(bounds(planar), centredOn(source, target, all(target)));
  assert.ok(planar.Geosets[0].Vertices.every(Number.isFinite));
  assert.throws(() => positionPart(source, target, {}), /Select vertices/);
  source.Geosets = [];
  assert.throws(() => positionPart(source, target, all(target)), /no vertices/);
});
