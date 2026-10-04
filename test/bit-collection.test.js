import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { openDocument, validateModel } from '../src/editor-document.js';
import { createStarterDocument } from '../src/starter-model.js';
import { sampleGeosetAnimation, sampleTrack } from '../src/animation.js';
import { collectPart, collectedPartModel, commitPart, previewPart, selectPartAnimations, serializeCollectedPart } from '../src/bits-and-parts.js';
const { BitsAndPartsLibrary } = createRequire(import.meta.url)('../electron/bits-and-parts.cjs');

function donor(version = 800) {
  const doc = createStarterDocument(version);
  doc.apply('Prepare donor', [], model => {
    for (let gi = 1; gi < 6; gi++) model.Geosets.push(structuredClone(model.Geosets[0]));
    model.Sequences = ['Stand', 'Walk', 'Attack'].map((Name, index) => ({ Name, Interval: new Uint32Array([1000 + index * 2000, 1900 + index * 2000]), MoveSpeed: 0, NonLooping: false, Rarity: 0, MinimumExtent: model.Info.MinimumExtent.slice(), MaximumExtent: model.Info.MaximumExtent.slice(), BoundsRadius: model.Info.BoundsRadius }));
    const track = (gi, width, lineType) => ({ LineType: lineType, GlobalSeqId: null, Keys: model.Sequences.flatMap((sequence, si) => [sequence.Interval[0], sequence.Interval[0] + 450, sequence.Interval[1]].map((Frame, ki) => {
      const Vector = new Float32Array(Array.from({ length: width }, (_, channel) => (gi + si + ki + channel + 1) % 5 / 4));
      return { Frame, Vector, ...(lineType > 1 ? { InTan: new Float32Array(lineType === 2 ? Vector.map(() => 0) : Vector), OutTan: new Float32Array(lineType === 2 ? Vector.map(() => 0) : Vector) } : {}) };
    })) });
    model.GeosetAnims = [0, 2, 3, 4].map((GeosetId, index) => ({ GeosetId, Flags: 3, Color: track(GeosetId, 3, index), Alpha: track(GeosetId, 1, 1), _MdxDefaults: { Color: new Float32Array([.25, .5, .75]), Alpha: .75 } }));
    model.GeosetAnims[1].Color = new Float32Array([0, 1, 0]); delete model.GeosetAnims[1]._MdxDefaults.Color;
    model.GlobalSequences = [1000];
    model.GeosetAnims[2].Color = { LineType: 1, GlobalSeqId: 0, Keys: [{ Frame: 0, Vector: new Float32Array([0, 0, 1]) }, { Frame: 1000, Vector: new Float32Array([1, 1, 0]) }] };
    model.GeosetAnims.push({ GeosetId: 5, Flags: 1, Color: new Float32Array([1, 1, 1]), Alpha: .5 });
  });
  return doc;
}
// Skip donor geoset 1: remapping must retain the individual color identities.
const selection = { 0: [0, 1, 2, 3], 2: [4, 5, 6], 3: [0], 4: [0, 1, 2], 5: [0, 1, 2] };
const chosen = [{ sequenceIndex: 0, name: 'Idle colors' }, { sequenceIndex: 2, name: 'Attack colors' }];
const errors = model => validateModel(model).filter(issue => issue.severity === 'error');

function sameAppearance(source, destination, sourceGi, destinationGi, sourceSequence, destinationSequence) {
  for (const phase of [0, .25, .5, .75, 1]) {
    const a = source.Sequences[sourceSequence].Interval, b = destination.Sequences[destinationSequence].Interval;
    const globalTime = 250;
    assert.deepEqual(sampleGeosetAnimation(destination, destinationGi, b[0] + (b[1] - b[0]) * phase, destinationSequence, globalTime), sampleGeosetAnimation(source, sourceGi, a[0] + (a[1] - a[0]) * phase, sourceSequence, globalTime));
  }
}

test('five-geoset capture preserves selected attributes, loose points, RGB identity and donor bytes', () => {
  const doc = donor(), before = doc.serialize('mdx'), collected = collectPart(doc.model, selection);
  assert.deepEqual(collected.Geosets.map(geoset => geoset.Vertices.length / 3), [4, 3, 1, 3, 3]);
  assert.deepEqual(collected.Geosets.map(geoset => geoset.Faces.length / 3), [2, 1, 0, 1, 1]);
  assert.deepEqual([...collected.Geosets[1].TVertices[0]], [0, 0, 1, 0, 1, 1]);
  assert.equal(collected.Bones.length, 1); assert.equal(collected.Bones[0].Name, 'DummyBone'); assert.equal(collected.Bones[0].Translation, undefined);
  for (const [gi, sourceGi] of [0, 2, 3, 4, 5].entries()) {
    assert.deepEqual(collected.Geosets[gi].Groups, [[0]]);
    for (let si = 0; si < 3; si++) sameAppearance(doc.model, collected, sourceGi, gi, si, si);
  }
  assert.deepEqual(doc.serialize('mdx'), before);
  assert.throws(() => collectPart(doc.model, {}), /Select vertices/);
});

for (const version of [800, 1000]) for (const animations of [null, [chosen[1]], chosen]) test(`MDX${version}: ${animations === null ? 'as is' : animations.length + ' selected'} keeps five independent full RGB tracks through save, import and undo/redo`, () => {
  const sourceDoc = donor(version), source = collectPart(sourceDoc.model, selection), before = structuredClone(source);
  const model = collectedPartModel(source, { name: 'Collected weapon', animations });
  const sourceIndices = animations?.map(item => item.sequenceIndex) || [0, 1, 2];
  assert.deepEqual(model.Sequences.map(item => item.Name), animations?.map(item => item.name) || ['Stand', 'Walk', 'Attack']);
  for (const format of ['mdx', 'mdl']) {
    const mdx = serializeCollectedPart(model), saved = openDocument(mdx);
    const reopened = format === 'mdx' ? saved : openDocument(saved.serialize('mdl'));
    assert.equal(reopened.readOnly, false); assert.deepEqual(errors(reopened.model), []);
    for (let si = 0; si < sourceIndices.length; si++) for (let gi = 0; gi < 5; gi++) sameAppearance(source, reopened.model, gi, gi, sourceIndices[si], si);
    // Independent byte oracle: the first KGAC vector stores BGR.
    const buffer = Buffer.from(mdx), offset = buffer.indexOf(Buffer.from('KGAC'));
    const vector = model.GeosetAnims[0].Color.Keys[0].Vector;
    assert.deepEqual([20, 24, 28].map(index => buffer.readFloatLE(offset + index)), [...vector].reverse());
    const destination = createStarterDocument(version), targetBefore = destination.serialize('mdx');
    const existingSequences = structuredClone(destination.model.Sequences), existingColors = structuredClone(destination.model.GeosetAnims);
    const result = destination.apply('Import Bit', [], target => commitPart(target, reopened.model));
    assert.deepEqual(destination.model.Sequences.slice(0, existingSequences.length), existingSequences);
    assert.deepEqual(destination.model.GeosetAnims.slice(0, existingColors.length), existingColors);
    const imported = openDocument(destination.serialize(format)); assert.deepEqual(errors(imported.model), []);
    for (let si = 0; si < sourceIndices.length; si++) for (let gi = 0; gi < 5; gi++) sameAppearance(source, imported.model, gi, result.geosetIndices[gi], sourceIndices[si], result.sequenceIndices[si]);
    const importedBytes = destination.serialize('mdx');
    assert.equal(destination.undo(), true); assert.deepEqual(destination.serialize('mdx'), targetBefore);
    assert.equal(destination.redo(), true); assert.deepEqual(destination.serialize('mdx'), importedBytes);
  }
  assert.deepEqual(source, before);
});

test('as-is and preview preserve every source record; selection removes only unselected local keys', () => {
  const source = collectPart(donor().model, selection), before = structuredClone(source);
  const saved = collectedPartModel(source, { name: 'As is' }), preview = previewPart(source);
  for (const model of [saved, preview]) assert.deepEqual(model.GeosetAnims, source.GeosetAnims);
  const selected = selectPartAnimations(source, chosen);
  assert.deepEqual(selected.GeosetAnims[1].Color, source.GeosetAnims[1].Color);
  assert.deepEqual(selected.GeosetAnims[2].Color, source.GeosetAnims[2].Color);
  assert.deepEqual(selected.GeosetAnims[3].Color.Keys.map(key => key.Frame), [1000, 1450, 1900, 5000, 5450, 5900]);
  assert.deepEqual(selected.GeosetAnims[3]._MdxDefaults, source.GeosetAnims[3]._MdxDefaults);
  assert.deepEqual(source, before);
});

test('selected material and texture animation keys follow their sequences; global channels keep their clock', () => {
  const source = collectPart(donor().model, selection);
  source.Materials[0].Layers[0].Alpha = structuredClone(source.GeosetAnims[0].Alpha);
  source.TextureAnims = [{ Translation: { ...structuredClone(source.GeosetAnims[0].Color), LineType: 1 } }];
  source.Materials[0].Layers[0].TVertexAnimId = 0;
  const target = createStarterDocument().model, result = commitPart(target, source, { animations: [chosen[1]] });
  const si = result.sequenceIndices[0], frame = target.Sequences[si].Interval[0] + 225;
  const layer = target.Materials[result.materialMap[0]].Layers[0];
  assert.equal(layer.Alpha.Keys.length, 3);
  assert.deepEqual(sampleTrack(layer.Alpha, frame, { interval: target.Sequences[si].Interval }), sampleTrack(source.Materials[0].Layers[0].Alpha, 5225, { interval: source.Sequences[2].Interval }));
  assert.deepEqual(sampleTrack(target.TextureAnims[layer.TVertexAnimId].Translation, frame, { interval: target.Sequences[si].Interval, fallback: [1, 1, 1] }), sampleTrack(source.TextureAnims[0].Translation, 5225, { interval: source.Sequences[2].Interval, fallback: [1, 1, 1] }));
  assert.deepEqual(errors(target), []);
});

test('invalid selections and invalid dependencies are atomic', () => {
  const source = collectPart(donor().model, selection), target = createStarterDocument().model, before = structuredClone(target);
  for (const animations of [[], [{ sequenceIndex: 99, name: 'Missing' }], [{ sequenceIndex: 0, name: '' }], [chosen[0], chosen[0]], [chosen[0], { sequenceIndex: 2, name: chosen[0].name }]]) {
    assert.throws(() => commitPart(target, source, { animations })); assert.deepEqual(target, before);
  }
  source.Geosets[0].MaterialID = 999;
  assert.throws(() => commitPart(target, source), /missing material/); assert.deepEqual(target, before);
});

test('as-is import retains out-of-sequence keys and relative timing without sampling or broadcasting', () => {
  const source = collectPart(donor().model, selection), record = source.GeosetAnims[0];
  record.Color.Keys.unshift({ Frame: 0, Vector: new Float32Array([.5, 0, .25]) });
  record.Color.Keys.push({ Frame: 6500, Vector: new Float32Array([.25, .5, 0]) });
  const before = structuredClone(source), target = createStarterDocument().model;
  const result = commitPart(target, source), imported = target.GeosetAnims.find(item => item.GeosetId === result.geosetIndices[0]);
  const offset = target.Sequences[result.sequenceIndices[0]].Interval[0] - source.Sequences[0].Interval[0];
  assert.deepEqual(imported.Color.Keys, record.Color.Keys.map(key => ({ ...key, Frame: key.Frame + offset })));
  assert.deepEqual(source, before);
  assert.equal(target.Sequences[result.sequenceIndices[2]].Interval[0] - target.Sequences[result.sequenceIndices[0]].Interval[0], 4000);
});

test('library saves collected bytes and portable dependencies, lists them, and preserves an existing Bit on collision', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlxl-collect-bit-')); t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const library = new BitsAndPartsLibrary(path.join(directory, 'BitsAndParts'));
  const model = collectedPartModel(collectPart(donor().model, selection), { name: 'My Bit' });
  const asset = { name: `MDLxL_Parts\\${'a'.repeat(64)}.tga`, bytes: new Uint8Array([1, 2, 3]) };
  model.Textures[0].Image = asset.name;
  const bytes = serializeCollectedPart(model), entry = await library.save({ name: 'My Bit', bytes, assets: [asset] });
  assert.equal(entry.id, 'My Bit.mdx'); assert.equal((await library.list()).children.some(item => item.id === entry.id), true);
  assert.deepEqual(new Uint8Array((await library.read(entry.id)).bytes), new Uint8Array(bytes));
  assert.deepEqual(new Uint8Array(await fs.readFile(path.join(library.directory, asset.name))), asset.bytes);
  await assert.rejects(library.save({ name: 'My Bit', bytes, assets: [] }), /already exists/);
  assert.deepEqual(new Uint8Array((await library.read(entry.id)).bytes), new Uint8Array(bytes));
  await assert.rejects(library.save({ name: '../escape', bytes }), /filename/);
  await assert.rejects(library.save({ name: 'Bad asset', bytes, assets: [{ ...asset, name: '..\\outside.tga' }] }), /MDLxL_Parts/);
});

test('disabled dormant RGB and missing color records are preserved in MDX without enabling or creating tint', () => {
  const source = collectPart(donor().model, selection);
  source.GeosetAnims[4].Color = new Float32Array([1, 0, 0]);
  source.GeosetAnims = source.GeosetAnims.filter(record => record.GeosetId !== 1);
  const saved = openDocument(serializeCollectedPart(collectedPartModel(source, { name: 'Dormant', animations: chosen })));
  assert.equal(saved.model.GeosetAnims.some(record => record.GeosetId === 1), false);
  assert.deepEqual([...saved.model.GeosetAnims.find(record => record.GeosetId === 4).Color], [1, 0, 0]);
  const target = createStarterDocument().model, result = commitPart(target, saved.model);
  assert.equal(target.GeosetAnims.some(record => record.GeosetId === result.geosetIndices[1]), false);
  assert.deepEqual(sampleGeosetAnimation(target, result.geosetIndices[4], target.Sequences[result.sequenceIndices[0]].Interval[0], result.sequenceIndices[0]).color, [1, 1, 1]);
});
