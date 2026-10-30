// Each mdx-m3-viewer checker finding gets one small model broken in exactly that way.
// "Fix everything" must clear the finding without adding errors or severe ones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMDX } from 'war3-model';
import { sanityTest } from './helpers/hive.mjs';
import { createStarterDocument } from '../src/starter-model.js';
import { createNode, openDocument } from '../src/editor-document.js';
import { generateCompatibleMdx } from '../src/mdx-compatibility.js';
import { runOptimizeStage, sanityProposals } from '../src/optimizexl.js';
import { applyCheckerRepair, checkerRepairProposals, GEOSET_VERTEX_LIMIT } from '../src/optimizexl-checker-repairs.js';
import { flattenHiveFindings } from '../app/optimizexl-hive.js';

const hive = bytes => { const r = sanityTest(bytes); return { ...r, findings: flattenHiveFindings(r.nodes) }; };
const key = (Frame, Vector, extra = {}) => ({ Frame, Vector: new Float32Array(Vector), ...extra });
const track = (Keys, LineType = 1, GlobalSeqId = null) => ({ LineType, GlobalSeqId, Keys });
const sequence = (Name, Interval) => ({ Name, Interval: new Uint32Array(Interval), MoveSpeed: 0, NonLooping: false, Rarity: 0, BoundsRadius: 0, MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array(3), SyncPoint: 0, Flags: 0 });

/** A small model the checker passes: a skinned cube with Stand, Death and an Origin point. */
function cleanModel() {
  const d = createStarterDocument(), m = structuredClone(d.model);
  m.Sequences = [sequence('Stand', [0, 1000]), sequence('Death', [1100, 2000])];
  for (const g of m.Geosets) g.Anims = m.Sequences.map(() => ({ BoundsRadius: g.BoundsRadius, MinimumExtent: new Float32Array(g.MinimumExtent), MaximumExtent: new Float32Array(g.MaximumExtent) }));
  createNode(m, 'Attachment').Name = 'Origin Ref';
  return m;
}
const bytesOf = m => { for (const g of m.Geosets) g.TotalGroupsCount = g.Groups.reduce((n, group) => n + group.length, 0); return new Uint8Array(generateCompatibleMdx(m)); };
const blocking = r => r.findings.filter(f => f.type === 'error' || f.type === 'severe').map(f => f.message);

test('the clean fixture passes the checker', () => {
  const r = hive(bytesOf(cleanModel()));
  assert.deepEqual(r.findings.filter(f => f.type !== 'unused').map(f => f.message), []);
});

const geoset = m => m.Geosets[0], bone = m => m.Bones[0];
const CASES = [
  ['keys out of order', /lower than the track before it/, m => { bone(m).Translation = track([key(0, [0, 0, 0]), key(500, [0, 0, 9]), key(200, [0, 0, 3]), key(1000, [0, 0, 0])]); }],
  ['two keys on one frame', /has the same frame/, m => { bone(m).Translation = track([key(0, [0, 0, 0]), key(500, [0, 0, 9]), key(500, [0, 0, 5]), key(1000, [0, 0, 0])]); }],
  ['a key before frame 0', /negative frame/, m => { bone(m).Translation = track([key(-50, [0, 0, 1]), key(0, [0, 0, 0]), key(1000, [0, 0, 5])]); }],
  // The fixed exporter omits this header; use the dependency to retain a legacy broken input.
  ['an empty track', /Zero tracks/, m => { bone(m).Translation = track([]); }, m => new Uint8Array(generateMDX({ ...m, BindPoses: undefined }))],
  ['an event that never fires', /Zero tracks/, m => { createNode(m, 'EventObject').EventTrack = new Uint32Array([]); }],
  ['a missing global sequence', /Invalid global sequence/, m => { m.GeosetAnims.push({ GeosetId: 0, Flags: 0, Color: new Float32Array([1, 1, 1]), Alpha: track([key(0, [1]), key(50, [1])], 0, 4) }); }],
  ['texture path with team colour', /used together/, m => { m.Textures[0].ReplaceableId = 1; }],
  ['unknown replaceable ID', /Unknown replaceable ID/, m => { m.Textures[0].ReplaceableId = 99; }],
  ['missing texture animation', /Invalid texture animation/, m => { m.Materials[0].Layers[0].TVertexAnimId = 3; }],
  ['geoset animation for a missing geoset', /Invalid geoset/, m => { m.GeosetAnims.push({ GeosetId: 7, Flags: 0, Color: new Float32Array([1, 1, 1]), Alpha: 1 }); }],
  ['bone pointing at a missing geoset', /Invalid geoset/, m => { bone(m).GeosetId = 7; }],
  ['a node that is its own parent', /Same object and parent/, m => { bone(m).Parent = bone(m).ObjectId; }],
  ['a missing parent', /Invalid parent/, m => { bone(m).Parent = 40; }],
  ['vertices on a helper', /which is not a bone/, m => { const h = createNode(m, 'Helper'); geoset(m).Groups.push([h.ObjectId]); geoset(m).VertexGroup[0] = geoset(m).Groups.length - 1; }],
  ['a bone without vertices', /no vertices attached to this bone/, m => { createNode(m, 'Bone'); }],
  ['a geoset without faces', /Zero faces/, m => { const g = structuredClone(geoset(m)); g.Faces = new Uint16Array(0); m.Geosets.push(g); }],
  ['light attenuation out of range', /attenuation/, m => { const l = createNode(m, 'Light'); l.AttenuationStart = 10; l.AttenuationEnd = 500; }],
  ['no Origin attachment', /Origin attachment/, m => { m.Attachments = m.Attachments.filter(a => a.Name !== 'Origin Ref'); m.Nodes = []; for (const k of ['Bones', 'Attachments']) for (const n of m[k]) m.Nodes[n.ObjectId] = n; m.PivotPoints = m.PivotPoints.slice(0, m.Nodes.length); }],
  ['particle middle time', /time middle/, m => { const e = createNode(m, 'ParticleEmitter2'); e.Time = 2; }],
  ['animated particle variation', /variation animation/, m => { const e = createNode(m, 'ParticleEmitter2'); e.Variation = track([key(0, [0.1]), key(1000, [0.5])]); e._MdxDefaults = { Variation: 0.1 }; }],
  ['an animation file name', /animation file should probably be empty/, m => { m.Info.AnimationFile = 'Units\\Human\\Footman\\Footman.mdx'; }],
  ['a misspelt animation name', /is not a standard name/, m => { m.Sequences[0].Name = 'Stand1'; }],
  ['two animations on the same frame', /starts at the same frame/, m => { m.Sequences.push(sequence('Attack', [0, 500])); for (const g of m.Geosets) g.Anims.push(structuredClone(g.Anims[0])); bone(m).Translation = track([key(0, [0, 0, 0]), key(500, [0, 0, 9]), key(1000, [0, 0, 0])]); }],
  ['an overlapping animation', /starts before sequence/, m => { m.Sequences.push(sequence('Attack', [600, 1500])); for (const g of m.Geosets) g.Anims.push(structuredClone(g.Anims[0])); }],
  ['a global animation without an opening key', /Missing opening track for global sequence/, m => { m.GlobalSequences = [100]; bone(m).Translation = track([key(20, [0, 0, 1]), key(80, [0, 0, 5])], 1, 0); }],
  ['a vertex attached to nothing', /Not attached to anything|which does not exist/, m => { geoset(m).VertexGroup[0] = 9; }],
  ['a missing material', /Invalid material/, m => { geoset(m).MaterialID = 5; }],
  ['a missing texture', /Invalid texture/, m => { m.Materials[0].Layers[0].TextureID = 6; }],
  ['an unknown blend mode', /Invalid filter mode/, m => { m.Materials[0].Layers[0].FilterMode = 9; }],
  ['a texture file type the game cannot load', /Corrupted path/, m => { m.Textures[0].Image = 'Textures\\Skin.png'; }],
  ['an attachment path that is not a model', /Invalid path/, m => { m.Attachments[0].Path = 'Effects\\Glow.txt'; }],
  ['two geoset animations on one geoset', /Referenced by 2 geoset animations/, m => { for (let i = 0; i < 2; i++) m.GeosetAnims.push({ GeosetId: 0, Flags: 0, Color: new Float32Array([1, 1, 1]), Alpha: 1 }); }],
  ['burst particles with a fixed amount', /squirt/, m => { const e = createNode(m, 'ParticleEmitter2'); e.Squirt = true; }],
  ['flat particles with zero speed', /XY Quad/, m => { const e = createNode(m, 'ParticleEmitter2'); e.Flags |= 1048576; e.Speed = 0; }],
  ['a bone without vertices but with a geoset animation link', /no vertices attached to this bone/, m => { m.GeosetAnims.push({ GeosetId: 0, Flags: 0, Color: new Float32Array([1, 1, 1]), Alpha: 1 }); createNode(m, 'Bone').GeosetAnimId = 0; }],
  ['fading particle visibility', /Interpolation type not set to None/, m => { createNode(m, 'ParticleEmitter2').Visibility = track([key(0, [1]), key(1000, [0])]); }],
];

for (const [name, finding, breakModel, legacyBytes] of CASES) test(`Fix everything repairs ${name}`, () => {
  const m = cleanModel(); breakModel(m);
  const broken = legacyBytes ? legacyBytes(m) : bytesOf(m), before = hive(broken);
  assert.ok(before.findings.some(f => finding.test(f.message)), `the fixture must show the finding (${before.findings.map(f => f.message).join(' | ')})`);
  const result = runOptimizeStage(broken, 'sanity', {}, { kind: 'fixAll', stage: 'sanity' }), after = hive(result.bytes);
  assert.deepEqual(after.findings.filter(f => finding.test(f.message)).map(f => f.message), []);
  assert.deepEqual(blocking(after).filter(x => !blocking(before).includes(x)), []);
  assert.equal(openDocument(result.bytes, 'fixed.mdx').readOnly, false);
});

test('an oversized geoset is split without changing its look', () => {
  const m = cleanModel(), g = geoset(m), size = 90, count = (size + 1) * (size + 1);
  assert.ok(count >= GEOSET_VERTEX_LIMIT);
  const vertices = [], faces = [];
  for (let y = 0; y <= size; y++) for (let x = 0; x <= size; x++) vertices.push(x, y, 0);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const a = y * (size + 1) + x; faces.push(a, a + 1, a + size + 1, a + 1, a + size + 2, a + size + 1); }
  Object.assign(g, { Vertices: new Float32Array(vertices), Normals: new Float32Array(count * 3).map((_, i) => i % 3 === 2 ? 1 : 0), VertexGroup: new Uint8Array(count), TVertices: [new Float32Array(count * 2)], Faces: new Uint16Array(faces) });
  g.Groups = [[bone(m).ObjectId]]; g.PrimitiveTypes = new Uint32Array([4]); g.PrimitiveCounts = new Uint32Array([faces.length]);
  const broken = bytesOf(m);
  assert.ok(hive(broken).findings.some(f => /Too many vertices/.test(f.message)));
  const result = runOptimizeStage(broken, 'sanity', {}, { kind: 'fixAll', stage: 'sanity' }), after = openDocument(result.bytes, 'x.mdx').model;
  assert.ok(!hive(result.bytes).findings.some(f => /Too many vertices/.test(f.message)));
  assert.ok(after.Geosets.length > 1);
  assert.equal(after.Geosets.reduce((n, x) => n + x.Faces.length, 0), faces.length);
});

test('every checker repair is listed with a plain label and a default', () => {
  const m = cleanModel(); geoset(m).MaterialID = 5; m.Sequences[0].Name = 'Stand1';
  const list = checkerRepairProposals(m);
  assert.deepEqual(list.map(f => f.rule).sort(), ['materialReference', 'sequenceNames']);
  assert.equal(openDocument(runOptimizeStage(bytesOf(m), 'sanity', {}, { kind: 'fixAll', stage: 'sanity' }).bytes, 'x.mdx').model.Sequences.length, m.Sequences.length, 'Fix everything never adds animations');
  assert.ok(list.every(f => f.label && f.detail));
  assert.equal(list.find(f => f.rule === 'materialReference').choice, 'first');
  assert.ok(sanityProposals(m).some(f => f.id === 'checker:sequenceNames'));
});

test('removing faceless geosets keeps bone and glider references consistent', () => {
  const m = cleanModel(), empty = structuredClone(geoset(m)), last = structuredClone(geoset(m));
  empty.Faces = new Uint16Array(0);
  m.Geosets.push(empty, last);
  m.GeosetAnims = [0, 1, 2].map(GeosetId => ({ GeosetId, Flags: 0, Color: new Float32Array([1, 1, 1]), Alpha: 1 }));
  Object.assign(bone(m), { GeosetId: 2, GeosetAnimId: 2 });
  createNode(m, 'Bone').GeosetId = 7;
  m.Gliders = [{ GeosetId: 1 }, { GeosetId: 2 }];
  applyCheckerRepair(m, { rule: 'zeroFaces' });
  assert.equal(m.Geosets.length, 2);
  assert.deepEqual(m.GeosetAnims.map(a => a.GeosetId), [0, 1]);
  assert.deepEqual([bone(m).GeosetId, bone(m).GeosetAnimId], [1, 1]);
  assert.equal(m.Bones.at(-1).GeosetId, null, 'a reference that was already invalid is cleared, as before');
  // Gliders were left stale before the shared removeGeosets; they now follow too.
  assert.deepEqual(m.Gliders, [{ GeosetId: 1 }]);
});

// Origin Ref: rename a misspelt one, make one if there is none, fix one that
// is not right, and stay silent when it is already valid.
const originRule = m => checkerRepairProposals(m).filter(f => f.rule === 'origin');
const origins = m => allNodesNamed(m, 'Origin Ref');
const allNodesNamed = (m, name) => ['Bones', 'Helpers', 'Attachments'].flatMap(k => (m[k] || []).filter(n => n.Name === name).map(n => ({ type: k, node: n })));
const fixedOrigin = m => openDocument(runOptimizeStage(bytesOf(m), 'sanity', {}, { kind: 'fixAll', stage: 'sanity' }).bytes, 'x.mdx').model;

test('a valid Origin Ref shows no origin repair', () => {
  const m = cleanModel();
  assert.deepEqual(originRule(m), []);
  const before = structuredClone(m.Attachments); applyCheckerRepair(m, { rule: 'origin' });
  assert.deepEqual(m.Attachments, before);
});

for (const name of ['origin ref', 'OriginRef', 'Origin_Ref', 'origin']) test(`a misspelt "${name}" is renamed, not doubled`, () => {
  const m = cleanModel(); m.Attachments[0].Name = name;
  const id = m.Attachments[0].ObjectId, count = m.Attachments.length;
  assert.deepEqual(originRule(m).map(f => f.items), [[name]]);
  const after = fixedOrigin(m);
  assert.equal(after.Attachments.length, count);
  assert.deepEqual(origins(after).map(o => [o.type, o.node.ObjectId]), [['Attachments', id]]);
  assert.deepEqual(originRule(after), []);
});

test('a model without any origin gets one', () => {
  const m = cleanModel(); m.Attachments[0].Name = 'Chest Ref';
  const after = fixedOrigin(m);
  assert.deepEqual(origins(after).map(o => o.type), ['Attachments']);
  assert.equal(after.Attachments.find(a => a.Name === 'Chest Ref').ObjectId, m.Attachments[0].ObjectId);
  assert.deepEqual(originRule(after), []);
});

test('a helper named Origin Ref becomes the attachment point in place', () => {
  const m = cleanModel(); m.Attachments[0].Name = 'Chest Ref';
  const h = createNode(m, 'Helper'); h.Name = 'origin ref';
  const after = fixedOrigin(m), found = origins(after);
  assert.deepEqual(found.map(o => o.type), ['Attachments']);
  assert.equal(found[0].node.ObjectId, h.ObjectId);
  assert.equal(after.Helpers.length, 0);
  assert.notEqual(found[0].node.AttachmentID, after.Attachments.find(a => a.Name === 'Chest Ref').AttachmentID);
});

test('a bone named Origin Ref that moves vertices stays a bone; a new origin is added', () => {
  const m = cleanModel(); m.Attachments[0].Name = 'Chest Ref'; bone(m).Name = 'Origin Ref';
  const after = fixedOrigin(m);
  assert.deepEqual(origins(after).map(o => o.type).sort(), ['Attachments', 'Bones']);
});

test('an Origin Ref sharing another point\'s attachment number gets its own', () => {
  const m = cleanModel(), chest = createNode(m, 'Attachment'); chest.Name = 'Chest Ref'; chest.AttachmentID = m.Attachments[0].AttachmentID;
  assert.deepEqual(originRule(m).map(f => f.items), [['Origin Ref']]);
  applyCheckerRepair(m, { rule: 'origin' });
  assert.equal(m.Attachments.length, 2);
  assert.notEqual(m.Attachments[0].AttachmentID, chest.AttachmentID);
  assert.equal(chest.AttachmentID, 0, 'the other point keeps its number');
  assert.deepEqual(originRule(m), []);
});
