import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { createNode, openDocument, validateModel } from '../src/editor-document.js';
import { createStarterDocument } from '../src/starter-model.js';
import { allNodes, sampleNodeMatrices, sampleTrack, skinGeoset } from '../src/animation.js';
import { animationImportObjects, animationImportSkeleton, importAnimation, suggestAnimationBoneMatches } from '../src/animation-importer.js';
import { assertModelEquivalent } from '../src/save-equivalence.js';

const track = (keys, LineType = 1) => ({ LineType, GlobalSeqId: null, Keys: keys.map(([Frame, vector]) => ({ Frame, Vector: new Float32Array(vector), ...(LineType >= 2 ? { InTan: new Float32Array(vector), OutTan: new Float32Array(vector) } : {}) })) });
const rotation = angle => new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), angle).toArray();
const close = (actual, expected) => Array.from(actual).forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < .0001, `${value} vs ${expected[index]}`));
function fixture(scale = 1) {
  const doc = createStarterDocument();
  doc.apply('Fixture rig', ['Nodes', 'Sequences', 'GeosetAnims', 'Materials'], model => {
    const root = model.Bones[0]; root.PivotPoint.set([0, 0, 0]);
    let parent = root;
    for (const [name, distance] of [['Arm_Left', 10], ['Elbow_Left', 20], ['Hand_Left', 30]]) {
      const node = createNode(model, 'Bone'); node.Name = `Bone_${name}`; node.Parent = parent.ObjectId; node.PivotPoint.set([0, -distance * scale, 0]); parent = node;
    }
    model.Sequences = [{ Name: 'Stand', Interval: new Uint32Array([100, 1100]), MoveSpeed: 0, NonLooping: false, Rarity: 0, MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array(3), BoundsRadius: 0 }, { Name: 'Attack', Interval: new Uint32Array([2000, 3000]), MoveSpeed: 0, NonLooping: true, Rarity: 0, MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array(3), BoundsRadius: 0 }];
    root.Translation = track([[100, [20, 0, 0]], [1100, [20, 0, 0]], [2000, [9, 1, 0]], [3000, [10, 2, 0]]], 3);
    model.GeosetAnims = [{ GeosetId: 0, Flags: 2, Alpha: track([[100, [.2]], [1100, [.8]], [2000, [.5]], [3000, [.7]]]), Color: track([[100, [1, .2, .1]], [1100, [.5, .4, .3]], [2000, [.2, .5, .8]], [3000, [.7, .1, .6]]], 3) }];
    model.Materials[0].Layers[0].Alpha = track([[100, [.8]], [1100, [.3]], [2000, [.6]], [3000, [.9]]]);
  });
  return doc;
}
function sourceFixture() {
  const doc = fixture();
  doc.apply('Source motion', ['Nodes'], model => { model.Bones[0].Translation = track([[100, [0, 0, 0]], [1100, [5, 0, 0]]]); model.Bones[1].Rotation = track([[100, rotation(0)], [1100, rotation(Math.PI / 2)]]); });
  return doc;
}
const optionsFor = (source, into, extra = {}) => ({ sourceSequence: 0, destinationSequence: 0, mode: 'replace', matches: suggestAnimationBoneMatches(source, into), ...extra });
function apply(into, source, extra) { return into.apply('Import animation', ['Sequences', 'Nodes'], model => importAnimation(model, source, optionsFor(source, model, extra))); }

test('merged POSE recognizes both skeletons; unique names and pose roles match actual nodes', () => {
  const source = sourceFixture().model, into = fixture(2).model;
  assert.equal(animationImportSkeleton(source).rig.chains.length, 1);
  assert.deepEqual(suggestAnimationBoneMatches(source, into), { 0: 0, 1: 1, 2: 2, 3: 3 });
  source.Bones[0].Name = 'Source root'; into.Bones[0].Name = 'Target root';
  assert.equal(suggestAnimationBoneMatches(source, into)[0], 0);
});

test('Replace moves the destination mesh, scales root movement, preserves rig, RGB/visibility and unrelated keys', () => {
  const sourceDoc = sourceFixture(), into = fixture(2), source = sourceDoc.model, original = structuredClone(into.model), sourceBefore = sourceDoc.serialize('mdx');
  const result = apply(into, source); assert.equal(result.sequenceIndex, 0);
  close(sampleTrack(into.model.Bones[0].Translation, 1100, { interval: into.model.Sequences[0].Interval, fallback: [0, 0, 0] }), [10, 0, 0]);
  close(sampleTrack(into.model.Bones[1].Rotation, 1100, { interval: into.model.Sequences[0].Interval, fallback: [0, 0, 0, 1], quaternion: true }), rotation(Math.PI / 2));
  assert.deepEqual(into.model.GeosetAnims, original.GeosetAnims); assert.deepEqual(into.model.Materials, original.Materials);
  assert.deepEqual(into.model.Bones[0].Translation.Keys.filter(key => key.Frame >= 2000), original.Bones[0].Translation.Keys.filter(key => key.Frame >= 2000));
  assert.deepEqual(into.model.PivotPoints, original.PivotPoints); assert.deepEqual(into.model.Geosets[0].Groups, original.Geosets[0].Groups); assert.deepEqual(into.model.Geosets[0].Vertices, original.Geosets[0].Vertices);
  const vertices = skinGeoset(into.model.Geosets[0], sampleNodeMatrices(into.model, 1100, 0)); assert.ok(vertices.some((value, index) => value !== original.Geosets[0].Vertices[index]));
  assert.deepEqual(sourceDoc.serialize('mdx'), sourceBefore); assert.equal(into.model.Sequences[0].Name, 'Stand');
});

test('Make new copies original animated geoset RGB/visibility and material alpha at corresponding times', () => {
  const source = sourceFixture().model, into = fixture(2), original = structuredClone(into.model);
  const result = apply(into, source, { mode: 'new', destinationSequence: 1 }), interval = into.model.Sequences[result.sequenceIndex].Interval;
  assert.equal(result.sequenceIndex, 2); assert.equal(interval[1] - interval[0], 1000);
  for (const phase of [0, .25, .5, 1]) for (const [owner, originalOwner, property, fallback] of [[into.model.GeosetAnims[0], original.GeosetAnims[0], 'Alpha', 1], [into.model.GeosetAnims[0], original.GeosetAnims[0], 'Color', [1, 1, 1]], [into.model.Materials[0].Layers[0], original.Materials[0].Layers[0], 'Alpha', 1]]) {
    const value = sampleTrack(owner[property], interval[0] + phase * 1000, { interval, fallback }), expected = sampleTrack(originalOwner[property], 2000 + phase * 1000, { interval: original.Sequences[1].Interval, fallback });
    close(typeof value === 'number' ? [value] : value, typeof expected === 'number' ? [expected] : expected);
  }
  assert.deepEqual(into.model.Sequences.slice(0, 2), original.Sequences);
});

test('extra emitter asks separately, keeps exact texture path, binds to the corresponding bone and stays hidden elsewhere', () => {
  const sourceDoc = sourceFixture(), into = fixture(2);
  sourceDoc.apply('Source effect', ['Nodes', 'Textures'], model => { model.Textures.push({ Image: 'Textures\\My Exact Effect.blp', Flags: 0, ReplaceableId: 0 }); const emitter = createNode(model, 'ParticleEmitter2'); emitter.Name = 'Sword sparks'; emitter.Parent = 3; emitter.PivotPoint.set([1, -30, 0]); emitter.TextureID = 1; emitter.Visibility = track([[100, [1]], [1100, [1]]], 0); });
  const source = sourceDoc.model, matches = suggestAnimationBoneMatches(source, into.model), extras = animationImportObjects(source, 0, matches);
  assert.equal(extras.length, 1); assert.equal(extras[0].name, 'Sword sparks');
  const result = apply(into, source, { mode: 'new', objects: extras.map(item => ({ ...item, import: true })) });
  assert.equal(result.importedObjects, 1); const emitter = into.model.ParticleEmitters2[0], parent = allNodes(into.model).find(node => node.ObjectId === emitter.Parent);
  assert.equal(parent.Name, 'Bone_Hand_Left'); assert.equal(into.model.Textures[emitter.TextureID].Image, 'Textures\\My Exact Effect.blp');
  for (const index of [0, 1, 2]) assert.equal(sampleTrack(emitter.Visibility, into.model.Sequences[index].Interval[0], { interval: into.model.Sequences[index].Interval, fallback: 1 }), index === 2 ? 1 : 0);
  assert.equal(validateModel(into.model).filter(issue => issue.severity === 'error').length, 0);
  for (const format of ['mdx', 'mdl']) { const saved = into.serialize(format), reopened = openDocument(saved, `effect.${format}`); assert.equal(reopened.readOnly, false); assertModelEquivalent(into.model, reopened.model, { keys: ['Sequences', 'Bones', 'ParticleEmitters2', 'Geosets', 'GeosetAnims', 'Textures', 'Materials'] }); }
});

test('one import is one Undo/Redo; canceling detached preview and rejecting a global controller leave the document unchanged', () => {
  const source = sourceFixture().model, into = fixture(), before = into.serialize('mdx'), depth = into.historyStats.undoSteps;
  const preview = structuredClone(into.model); importAnimation(preview, source, optionsFor(source, preview)); assert.deepEqual(into.serialize('mdx'), before);
  apply(into, source); assert.equal(into.historyStats.undoSteps, depth + 1); const saved = into.serialize('mdx'); into.undo(); assert.deepEqual(into.serialize('mdx'), before); into.redo(); assert.deepEqual(into.serialize('mdx'), saved);
  into.apply('Global fixture', ['Nodes', 'GlobalSequences'], model => { model.GlobalSequences.push(1000); model.Bones[0].Rotation = { ...track([[0, rotation(0)], [1000, rotation(1)]]), GlobalSeqId: 0 }; });
  const globalBefore = into.serialize('mdx'), globalDepth = into.historyStats.undoSteps; assert.throws(() => apply(into, source), /global controller/); assert.deepEqual(into.serialize('mdx'), globalBefore); assert.equal(into.historyStats.undoSteps, globalDepth);
});

test('duplicate mappings and overlapping destination intervals reject atomically', () => {
  const source = sourceFixture().model, into = fixture(), before = into.serialize('mdx');
  assert.throws(() => apply(into, source, { matches: { 0: 0, 1: 0 } }), /only one/); assert.deepEqual(into.serialize('mdx'), before);
  into.apply('Shared interval', ['Sequences'], model => { model.Sequences[1].Interval[0] = 1100; });
  const shared = into.serialize('mdx'); assert.throws(() => apply(into, source), /overlaps/); assert.deepEqual(into.serialize('mdx'), shared);
});

test('step/global source motion bakes locally into a shorter replacement with unique timestamps', () => {
  const sourceDoc = sourceFixture(), into = fixture();
  sourceDoc.apply('Source global', ['Nodes', 'GlobalSequences'], model => { model.GlobalSequences = [500]; model.Bones[0].Translation = { ...track([[0, [0, 0, 0]], [250, [4, 0, 0]], [500, [0, 0, 0]]], 0), GlobalSeqId: 0 }; });
  into.apply('Short animation', ['Sequences'], model => { model.Sequences[0].Interval[1] = 150; });
  apply(into, sourceDoc.model); for (const node of into.model.Bones) for (const property of ['Translation', 'Rotation', 'Scaling']) if (node[property]?.Keys) assert.equal(new Set(node[property].Keys.map(key => key.Frame)).size, node[property].Keys.length);
  assert.deepEqual(into.model.GlobalSequences, []); assert.equal(validateModel(into.model).filter(issue => issue.severity === 'error').length, 0);
});

test('a differently oriented, larger destination rig retargets root movement and effect offsets into its bone axes', () => {
  const sourceDoc = sourceFixture(), into = fixture(2);
  into.apply('Different rest orientation', ['PivotPoints'], model => { for (const point of model.PivotPoints) { const x = point[0]; point[0] = -point[1]; point[1] = x; } });
  sourceDoc.apply('Hand effect', ['Nodes'], model => { const node = createNode(model, 'ParticleEmitter2'); node.Name = 'Hand glow'; node.Parent = 3; node.PivotPoint.set([1, -30, 0]); });
  const source = sourceDoc.model, extras = animationImportObjects(source, 0, suggestAnimationBoneMatches(source, into.model));
  apply(into, source, { objects: extras.map(item => ({ ...item, import: true })) });
  close(sampleTrack(into.model.Bones[0].Translation, 1100, { interval: into.model.Sequences[0].Interval, fallback: [0, 0, 0] }), [0, 10, 0]);
  close(into.model.ParticleEmitters2[0].PivotPoint, [60, 2, 0]);
});

test('approved ribbon imports its material, animated texture IDs and texture animation without rewriting existing resources', () => {
  const sourceDoc = sourceFixture(), into = fixture(), originalMaterials = structuredClone(into.model.Materials);
  sourceDoc.apply('Ribbon dependencies', ['Nodes', 'Materials', 'Textures', 'TextureAnims', 'GlobalSequences'], model => {
    model.GlobalSequences.push(1000); model.Textures.push({ Image: 'Textures\\Exact Ribbon.blp', Flags: 0, ReplaceableId: 0 });
    model.TextureAnims.push({ Translation: { ...track([[0, [0, 0, 0]], [1000, [1, 0, 0]]]), GlobalSeqId: 0 } });
    model.Materials.push({ PriorityPlane: 0, RenderMode: 0, Layers: [{ FilterMode: 2, Shading: 0, TextureID: { ...track([[0, [0]], [500, [1]]], 0), GlobalSeqId: 0 }, TVertexAnimId: 0, CoordId: 0, Alpha: track([[100, [.2]], [1100, [.8]]]) }] });
    const ribbon = createNode(model, 'RibbonEmitter'); ribbon.Name = 'Weapon trail'; ribbon.Parent = 3; ribbon.MaterialID = 1; ribbon.PivotPoint.set([0, -30, 0]);
  });
  const source = sourceDoc.model, extras = animationImportObjects(source, 0, suggestAnimationBoneMatches(source, into.model));
  apply(into, source, { mode: 'new', objects: extras.map(item => ({ ...item, import: true })) });
  const originalMaterial = structuredClone(into.model.Materials[0]); originalMaterial.Layers[0].Alpha.Keys = originalMaterial.Layers[0].Alpha.Keys.filter(key => key.Frame <= 3000);
  assert.deepEqual([originalMaterial], originalMaterials); assert.deepEqual(into.model.GlobalSequences, []);
  const ribbon = into.model.RibbonEmitters[0], layer = into.model.Materials[ribbon.MaterialID].Layers[0];
  assert.ok(layer.TextureID.Keys.some(key => into.model.Textures[key.Vector[0]].Image === 'Textures\\Exact Ribbon.blp'));
  assert.equal(into.model.TextureAnims[layer.TVertexAnimId].Translation.GlobalSeqId, null);
  assert.equal(validateModel(into.model).filter(issue => issue.severity === 'error').length, 0);
  const reopened = openDocument(into.serialize('mdx'), 'ribbon.mdx'); assertModelEquivalent(into.model, reopened.model, { keys: ['RibbonEmitters', 'Materials', 'Textures', 'TextureAnims', 'Sequences'] });
});
