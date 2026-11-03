import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// Committed owner-authored model keeps native measurement coverage available in CI.
const fixture = new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx', import.meta.url);
import { openDocument, createNode } from '../src/editor-document.js';
import { inspectEditingParts, measureEditingCandidate } from '../src/ai-editing-procedures.js';

const native = () => openDocument(fs.readFileSync(fixture), 'Native.mdx').model;
const check = (report, name) => report.checks.find(row => row.name === name);

test('native part map retains indexed islands and exact selection without inferring semantic parts', () => {
  const model = native(), snapshot = structuredClone(model);
  const result = inspectEditingParts(model, { selection: { 0: [0] }, limit: 2 });
  assert.ok(result.total >= result.parts.length);
  assert.ok(result.parts.length <= 2);
  assert.equal(result.parts[0].geoset, 0); assert.equal(result.parts[0].shown, 1);
  assert.equal(result.parts[0].selectedVertices, 1);
  assert.equal(result.parts[0].role, 'unassigned');
  assert.ok(result.parts[0].triangles > 0);
  assert.deepEqual(model, snapshot);
  assert.throws(() => inspectEditingParts(model, { selection: { 0: [-1] } }), /selection/i);
});

test('selected vertex proposal catches exterior vertex changes even inside broad geoset scope', () => {
  const before = native(), after = structuredClone(before), options = { scope: ['/Geosets/0'], selection: { 0: [0] } };
  after.Geosets[0].Vertices[0] += 1;
  assert.equal(check(measureEditingCandidate(before, after, options), 'selection confinement').passed, true);
  after.Geosets[0].Vertices[3] += 1;
  assert.equal(check(measureEditingCandidate(before, after, options), 'selection confinement').passed, false);
  assert.deepEqual(before, native());
});

test('UV, materials and sequence/event timing have independent exact preservation checks', () => {
  const before = native(), after = structuredClone(before);
  after.Geosets[0].TVertices[0][0] += .1;
  after.Textures[0].Image = 'changed.blp';
  after.Sequences[0].Interval[1] += 1;
  const result = measureEditingCandidate(before, after, { scope: ['/Geosets', '/Textures', '/Sequences'] });
  for (const name of ['UV preservation', 'material preservation', 'timing preservation']) assert.equal(check(result, name).passed, false, name);
  const allowed = measureEditingCandidate(before, after, { scope: ['/Geosets', '/Textures', '/Sequences'], preserveUVs: false, preserveMaterials: false, preserveTiming: false });
  assert.ok(!allowed.checks.some(row => /preservation/.test(row.name)));
});

test('simplification measures each indexed island and catches complete loss instead of accepting a file ratio', () => {
  const before = native(), after = structuredClone(before);
  const original = inspectEditingParts(before).parts.find(row => row.geoset === 0);
  after.Geosets[0].Faces = after.Geosets[0].Faces.filter(index => false);
  const result = measureEditingCandidate(before, after, { operation: 'simplify', scope: ['/Geosets/0'] });
  assert.equal(check(result, 'component retention').passed, false);
  assert.ok(result.components.some(row => row.geoset === original.geoset && row.beforeTriangles === original.triangles && row.afterTriangles === 0));
  assert.ok(result.unverified.includes('silhouette and texture appearance'));
});

test('native motion evidence samples playback and exact endpoints while changed topology remains unevaluated', () => {
  const before = native(), after = structuredClone(before);
  after.Geosets[0].Vertices[0] += 2;
  const result = measureEditingCandidate(before, after, { scope: ['/Geosets/0'], motion: true, sequences: [0], step: 1000, limits: { maxDistance: 0, requireExactEndpoints: true } });
  assert.equal(check(result, 'motion distance').passed, false);
  assert.equal(check(result, 'motion endpoints').passed, false);
  assert.ok(result.motion.sequences[0].framesSampled >= 2);
  assert.ok(!('perFrame' in result.motion.sequences[0]));
  const changed = structuredClone(before); changed.Geosets[0].Faces = changed.Geosets[0].Faces.slice(3);
  const topology = measureEditingCandidate(before, changed, { scope: ['/Geosets/0'], motion: true, sequences: [0], step: 1000, limits: { maxDistance: 0 } });
  assert.equal(check(topology, 'motion correspondence').passed, false);
  assert.equal(check(topology, 'motion distance').passed, false);
});

test('emitter diagnostics resolve real owner clocks and resources and leave live particle playback unevaluated', () => {
  const before = native();
  const emitter = createNode(before, 'ParticleEmitter2'); emitter.TextureID = 0;
  emitter.Visibility = { LineType: 0, Keys: [{ Frame: before.Sequences[0].Interval[0], Vector: Float32Array.of(1) }, { Frame: before.Sequences[0].Interval[1], Vector: Float32Array.of(0) }] };
  const after = structuredClone(before), snapshot = structuredClone(after);
  const result = measureEditingCandidate(before, after, { scope: ['/ParticleEmitters2'], diagnostics: { emitters: true }, sequences: [0] });
  const row = result.emitters.find(row => row.id === emitter.ObjectId);
  assert.equal(row.family, 'ParticleEmitters2'); assert.equal(row.textureID, 0);
  assert.equal(row.clips[0].global, false);
  assert.ok(result.unverified.includes('elapsed particle playback'));
  assert.deepEqual(after, snapshot);
});

test('part pages expose every island and weighted skin uses nonzero native influences', () => {
  const model = native(), g = model.Geosets[0], count = g.Vertices.length / 3;
  g.SkinWeights = new Uint8Array(count * 8);
  for (let index = 0; index < count; index++) g.SkinWeights.set([11, 12, 99, 0, 128, 127, 0, 0], index * 8);
  const all = inspectEditingParts(model, { limit: 256 });
  const first = inspectEditingParts(model, { limit: 1 }), second = inspectEditingParts(model, { limit: 1, offset: 1 });
  assert.deepEqual(first.parts[0].groups, [11, 12]);
  assert.equal(second.offset, 1); assert.deepEqual(second.parts[0], all.parts[1]);
  assert.equal(first.nextOffset, 1);
  assert.throws(() => inspectEditingParts(model, { offset: -1 }), /offset/i);
});

test('static single-frame geometry is measured and empty animation domains cannot pass motion', () => {
  const before = native(); before.GlobalSequences = []; before.Sequences = [{ Name: 'Stand', Interval: new Uint32Array([0, 0]) }];
  const after = structuredClone(before);
  let report = measureEditingCandidate(before, after, { scope: ['/Geosets/0'], motion: true, limits: { maxDistance: 0, requireExactEndpoints: true } });
  assert.equal(report.motion.sequences[0].framesSampled, 1);
  assert.equal(check(report, 'motion correspondence').passed, true);
  assert.equal(check(report, 'motion endpoints').passed, true);
  before.Sequences = []; after.Sequences = [];
  report = measureEditingCandidate(before, after, { scope: ['/Geosets/0'], motion: true, limits: { maxDistance: 0 } });
  assert.equal(check(report, 'motion correspondence').passed, false);
  assert.equal(check(report, 'motion distance').passed, false);
});

test('binding confinement permits a new selected group but rejects changing a shared exterior influence', () => {
  const before = native(), after = structuredClone(before), g = after.Geosets[0];
  const newGroup = g.Groups.push([123]) - 1; g.VertexGroup[0] = newGroup;
  const options = { scope: ['/Geosets/0'], selection: { 0: [0] } };
  assert.equal(check(measureEditingCandidate(before, after, options), 'selection confinement').passed, true);
  const outsideGroup = g.VertexGroup[1]; g.Groups[outsideGroup] = [456];
  assert.equal(check(measureEditingCandidate(before, after, options), 'selection confinement').passed, false);
});

test('optimization measures actual serialized MDX bytes and evaluates only an explicit size goal', () => {
  const model = native(), original = structuredClone(model);
  const report = measureEditingCandidate(model, model, { operation: 'optimization', scope: ['/Bones'], optimization: { measureBytes: true, maxBytes: 300000, sourceBytes: fs.readFileSync(fixture) } });
  assert.equal(report.optimization.afterBytes, openDocument(fs.readFileSync(fixture), 'Native.mdx').serialize('mdx').byteLength);
  assert.equal(check(report, 'serialized size').passed, true);
  assert.equal(check(measureEditingCandidate(model, model, { operation: 'optimization', scope: ['/Bones'], optimization: { measureBytes: true, requireReduction: true, sourceBytes: fs.readFileSync(fixture) } }), 'serialized reduction').passed, false);
  assert.deepEqual(model, original);
  assert.throws(() => measureEditingCandidate(model, model, { operation: 'optimization', scope: ['/Bones'] }), /size goal|byte goal/i);
});

test('emitter goals measure requested visibility transitions and sampled emission through native clocks', () => {
  const model = native(), emitter = createNode(model, 'ParticleEmitter2'), sequence = 0;
  const [start, end] = model.Sequences[sequence].Interval;
  emitter.Visibility = { LineType: 0, Keys: [{ Frame: start, Vector: Float32Array.of(1) }, { Frame: end, Vector: Float32Array.of(0) }] };
  emitter.EmissionRate = 25;
  const goal = { id: emitter.ObjectId, sequence, spans: [[start, end]], samples: [{ frame: start, visibility: 1, emissionRate: 25 }, { frame: end, visibility: 0 }] };
  const report = measureEditingCandidate(model, model, { operation: 'emitter', scope: ['/ParticleEmitters2'], emitterGoals: [goal] });
  assert.ok(report.checks.filter(row => row.name.startsWith('emitter ')).every(row => row.passed));
  const changed = structuredClone(model); changed.ParticleEmitters2.find(node => node.ObjectId === emitter.ObjectId).EmissionRate = 30;
  const failure = measureEditingCandidate(model, changed, { operation: 'emitter', scope: ['/ParticleEmitters2'], emitterGoals: [goal] });
  assert.equal(failure.checks.find(row => row.name.includes('emissionRate')).passed, false);
  assert.throws(() => measureEditingCandidate(model, model, { operation: 'emitter', scope: ['/ParticleEmitters2'] }), /emitter goal/i);
});
