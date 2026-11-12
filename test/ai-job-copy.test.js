import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverJob } from '../app/ai-job-copy.js';

const geoset = (...values) => ({ Vertices: new Float32Array(values), MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array(3), BoundsRadius: 0 });
const base = () => ({ Info: { BlendTime: 150, MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array(3), BoundsRadius: 0 }, Geosets: Array.from({ length: 3 }, () => geoset(...new Array(120).fill(1))), Sequences: [{ Rarity: 0 }] });

function setup(editUser, editAi, options = {}) {
  const model = options.model ?? base();
  const recovery = { model, revision: 1 }, live = structuredClone(model), candidate = structuredClone(model);
  editUser(live); editAi(candidate);
  const edits = [];
  const source = { id: 'tab', doc: { model: live, revision: options.revision ?? 2 }, assets: new Map(), uvPreviews: options.uvPreviews ?? {}, animationDrafts: options.animationDrafts ?? {}, paintWorkingRevision: 0, ...options.source };
  const job = { recovery, draft: { doc: { model: candidate }, assets: new Map() }, uvPreviews: options.jobUvPreviews ?? source.uvPreviews, animationDrafts: source.animationDrafts, paintRevision: 0, ...options.job };
  const host = { sessionOf: () => source, editIn(id, label, sections, apply, opts) { if (options.reject) throw Error('Rejected by the editor.'); edits.push({ label, sections, opts }); apply(live); return true; } };
  return { live, edits, result: () => deliverJob({ host: () => host }, { job, documentId: 'tab', review: { changed: true } }, 'finish') };
}
const conflict = (run) => { const before = structuredClone(run.live); assert.deepEqual(run.result(), { conflict: true }); assert.deepEqual(run.live, before); assert.equal(run.edits.length, 0); };

test('edits on different geosets combine in one Undo step without asking', () => {
  const run = setup(m => { m.Geosets[0].Vertices[0] = 5; }, m => { m.Geosets[1].Vertices[0] = 9; });
  const result = run.result();
  assert.equal(result.delivered, true); assert.equal(result.merged, true); assert.equal(result.conflict, undefined);
  assert.equal(run.live.Geosets[0].Vertices[0], 5); assert.equal(run.live.Geosets[1].Vertices[0], 9);
  assert.equal(run.edits.length, 1); assert.equal(run.edits[0].label, 'Merge AI result');
});

test('far-apart vertices of one geoset and separate model fields also combine', () => {
  let run = setup(m => { m.Geosets[0].Vertices[0] = 5; }, m => { m.Geosets[0].Vertices[100] = 9; });
  assert.equal(run.result().delivered, true);
  assert.equal(run.live.Geosets[0].Vertices[0], 5); assert.equal(run.live.Geosets[0].Vertices[100], 9);
  run = setup(m => { m.Sequences[0].Rarity = 1; }, m => { m.Info.BlendTime = 321; });
  assert.equal(run.result().delivered, true);
  assert.equal(run.live.Sequences[0].Rarity, 1); assert.equal(run.live.Info.BlendTime, 321);
});

test('changing the same data asks the user and leaves the model alone', () => {
  conflict(setup(m => { m.Geosets[0].Vertices[0] = 5; }, m => { m.Geosets[0].Vertices[0] = 9; }));
  conflict(setup(m => { m.Sequences[0].Rarity = 1; }, m => { m.Sequences[0].Rarity = 2; }));
});

test('adding or removing a list item counts as overlap with any change to that list', () => {
  conflict(setup(m => { m.Geosets.pop(); }, m => { m.Geosets[0].Vertices[0] = 9; }));
  conflict(setup(m => { m.Geosets[0].Vertices[0] = 5; }, m => { m.Geosets.push(geoset(1, 2, 3)); }));
  conflict(setup(m => { m.Geosets.shift(); }, m => { m.Geosets.push(geoset(1, 2, 3)); }));
});

test('adding to a list the other side left alone still combines', () => {
  const run = setup(m => { m.Sequences.push({ Rarity: 3 }); }, m => { m.Geosets[1].Vertices[0] = 9; });
  assert.equal(run.result().delivered, true);
  assert.equal(run.live.Sequences.length, 2); assert.equal(run.live.Geosets[1].Vertices[0], 9);
});

test('both sides changing the model-wide box rebuilds it from the combined geoset boxes', () => {
  const grow = (index, low, high) => m => {
    m.Geosets[index].MinimumExtent = new Float32Array([low, low, low]); m.Geosets[index].MaximumExtent = new Float32Array([high, high, high]);
    m.Info.MinimumExtent = new Float32Array([low, low, low]); m.Info.MaximumExtent = new Float32Array([high, high, high]);
    m.Info.BoundsRadius = high;
  };
  const run = setup(grow(0, -10, 2), grow(1, -1, 20));
  assert.equal(run.result().delivered, true);
  assert.deepEqual([...run.live.Info.MinimumExtent], [-10, -10, -10]);
  assert.deepEqual([...run.live.Info.MaximumExtent], [20, 20, 20]);
  assert.equal(run.edits.length, 1);
});

test('a box change on only the AI side is applied as it is', () => {
  const run = setup(m => { m.Sequences[0].Rarity = 1; }, m => { m.Info.MaximumExtent = new Float32Array([7, 8, 9]); });
  assert.equal(run.result().delivered, true);
  assert.deepEqual([...run.live.Info.MaximumExtent], [7, 8, 9]);
});

test('unfinished paint, UV previews or animation drafts still ask', () => {
  const edit = m => { m.Geosets[0].Vertices[0] = 5; }, ai = m => { m.Geosets[1].Vertices[0] = 9; };
  conflict(setup(edit, ai, { uvPreviews: { a: 1 }, jobUvPreviews: {} }));
  conflict(setup(edit, ai, { animationDrafts: { a: 1 }, job: { animationDrafts: {} } }));
  conflict(setup(edit, ai, { source: { paintProject: { dirty: true }, paintWorkingRevision: 4 } }));
});

test('saving during the job replaces the empty preview list and does not force a question', () => {
  const run = setup(m => { m.Geosets[0].Vertices[0] = 5; }, m => { m.Geosets[1].Vertices[0] = 9; }, { uvPreviews: {}, jobUvPreviews: {} });
  assert.equal(run.result().delivered, true);
});

test('a combination the editor rejects falls back to the choice', () => {
  const run = setup(m => { m.Geosets[0].Vertices[0] = 5; }, m => { m.Geosets[1].Vertices[0] = 9; }, { reject: true });
  assert.deepEqual(run.result(), { conflict: true });
});

test('no live edit still delivers as a plain AI result', () => {
  const run = setup(() => {}, m => { m.Geosets[1].Vertices[0] = 9; }, { revision: 1 });
  const result = run.result();
  assert.equal(result.delivered, true); assert.equal(result.merged, false);
  assert.equal(run.edits[0].label, 'Apply AI result');
});

test('an editor failure without a live edit still surfaces', () => {
  const run = setup(() => {}, m => { m.Geosets[1].Vertices[0] = 9; }, { revision: 1, reject: true });
  assert.throws(() => run.result(), /Rejected by the editor/);
});


test('deleting a texture prevents the AI merge from pointing at a different image', () => {
  const model = { ...base(), Textures: [{ Image: 'one.blp' }, { Image: 'two.blp' }, { Image: 'three.blp' }], Materials: [{ Layers: [{ TextureID: 0 }] }] };
  conflict(setup(m => m.Textures.shift(), m => { m.Materials[0].Layers[0].TextureID = 1; }, { model }));
});

test('deleting a material prevents the AI merge from pointing at a different material', () => {
  const model = { ...base(), Materials: [{ PriorityPlane: 0 }, { PriorityPlane: 1 }, { PriorityPlane: 2 }] };
  conflict(setup(m => m.Materials.shift(), m => { m.Geosets[0].MaterialID = 1; }, { model }));
});

test('deleting a node prevents the AI merge from using a different parent', () => {
  const model = { ...base(), Nodes: [{ ObjectId: 0 }, { ObjectId: 1 }], Helpers: [{ ObjectId: 2, Parent: 0 }] };
  conflict(setup(m => { delete m.Nodes[0]; }, m => { m.Helpers[0].Parent = 1; }, { model }));
});

for (const key of [
  'Textures', 'Materials', 'TextureAnims', 'GlobalSequences', 'Geosets', 'GeosetAnims',
  'Bones', 'Helpers', 'Attachments', 'EventObjects', 'CollisionShapes', 'ParticleEmitters',
  'ParticleEmitters2', 'ParticleEmitterPopcorns', 'Lights', 'RibbonEmitters', 'PivotPoints',
]) test('adding a record to ' + key + ' asks before combining the job', () => {
  const model = { ...base(), [key]: [] };
  conflict(setup(m => m[key].push(5), m => { m.Info.BlendTime = 321; }, { model }));
});