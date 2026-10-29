import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMDX } from 'war3-model';
import { createStarterDocument } from '../src/starter-model.js';
import { createNode, openDocument, EditorDocument, NODE_TYPES } from '../src/editor-document.js';
import { canonicalizeSerializedNodeOrder } from '../src/node-id-order.js';
import { generateCompatibleMdx, parseCompatibleMdx, omitEmptyMdxNodeTracks, mdxRecords } from '../src/mdx-compatibility.js';
import { parseMdx } from '../src/mdx-container.js';
import { assertModelEquivalent } from '../src/save-equivalence.js';
import { key, track } from './helpers/model-fixtures.js';

const offsets = { BONE: 0, HELP: 0, EVTS: 0, CLID: 0, ATCH: 4, LITE: 4, PREM: 4, PRE2: 4, CORN: 4, RIBB: 4 };
const properties = ['Translation', 'Rotation', 'Scaling'];
function fixture() {
  const model = createStarterDocument(1000).model;
  model.GlobalSequences = [1000];
  for (const type of Object.keys(NODE_TYPES)) for (let mode = 0; mode < 4; mode++) {
    const node = createNode(model, type); node.Name = type + mode;
    for (const property of properties) node[property] = track([], mode, mode % 2 ? 0 : null);
    if (mode < 3) {
      const property = properties[mode], vector = property === 'Rotation' ? [0, 0, 0, 1] : [1, 2, 3];
      node[property] = track([key(0, vector, { InTan: vector, OutTan: vector }), key(1000, vector, { InTan: vector, OutTan: vector })], 3, mode % 2 ? 0 : null);
    }
  }
  canonicalizeSerializedNodeOrder(model);
  // Deliberately use the unpatched dependency to construct legacy zero-key records.
  return Buffer.from(generateMDX({ ...model, BindPoses: undefined }));
}
const chunks = bytes => new Map(parseMdx(bytes).chunks.map(c => [c.tag, bytes.subarray(c.payloadOffset, c.payloadOffset + c.declaredSize)]));
function nodeTracks(record, offset) {
  const end = offset + record.readUInt32LE(offset), tracks = [];
  for (let p = offset + 96; p < end;) {
    const tag = record.toString('ascii', p, p + 4), count = record.readUInt32LE(p + 4), interpolation = record.readUInt32LE(p + 8);
    assert.ok(['KGTR', 'KGRT', 'KGSC'].includes(tag));
    const size = 16 + count * (4 + (tag === 'KGRT' ? 4 : 3) * 4 * (interpolation >= 2 ? 3 : 1));
    assert.ok(p + size <= end);
    tracks.push({ tag, count, bytes: record.subarray(p, p + size) }); p += size;
  }
  return { end, tracks };
}
function assertNoEmptyNodeTracks(bytes) {
  for (const [tag, payload] of chunks(Buffer.from(bytes))) if (tag in offsets) {
    for (const record of mdxRecords(payload, tag)) for (const t of nodeTracks(record, offsets[tag]).tracks) assert.ok(t.count > 0, tag + '/' + t.tag);
  }
}

test('empty node headers are the only removed bytes; all node families, sizes, tails and spline keys survive', () => {
  const before = fixture(), snapshot = Buffer.from(before), after = omitEmptyMdxNodeTracks(before), old = chunks(before), fresh = chunks(after);
  let removed = 0;
  for (const [tag, payload] of old) {
    if (!(tag in offsets)) { assert.deepEqual(fresh.get(tag), payload, tag); continue; }
    const at = offsets[tag], previous = mdxRecords(payload, tag), current = mdxRecords(fresh.get(tag), tag);
    assert.equal(current.length, previous.length);
    let chunkRemoved = 0;
    previous.forEach((record, i) => {
      const a = nodeTracks(record, at), b = nodeTracks(current[i], at), empty = a.tracks.filter(t => !t.count).length;
      chunkRemoved += empty * 16;
      assert.equal(b.end, a.end - empty * 16);
      assert.deepEqual(current[i].subarray(at + 4, at + 96), record.subarray(at + 4, at + 96), 'names, IDs, parents and flags');
      assert.deepEqual(b.tracks.map(t => t.bytes), a.tracks.filter(t => t.count).map(t => t.bytes), 'real keys, tangents, interpolation and global IDs');
      assert.deepEqual(current[i].subarray(b.end), record.subarray(a.end), 'bone references, event times, collision data and node-specific fields');
      if (at) assert.equal(current[i].readUInt32LE(0), current[i].length, 'outer inclusive size');
    });
    assert.equal(fresh.get(tag).length, payload.length - chunkRemoved); removed += chunkRemoved;
  }
  assert.equal(removed, 90 * 16);
  assert.equal(after.length, before.length - removed);
  assert.deepEqual(before, snapshot, 'input bytes stay untouched');
  assert.deepEqual(omitEmptyMdxNodeTracks(after), after, 'idempotent');
  assertNoEmptyNodeTracks(after);
});

test('the MDX generator omits empty node tracks without mutating its input model', () => {
  const model = parseCompatibleMdx(fixture()), before = structuredClone(model);
  const bytes = generateCompatibleMdx(model);
  assertNoEmptyNodeTracks(bytes);
  assertModelEquivalent(before, parseCompatibleMdx(bytes), { format: 'mdx' });
  assert.deepEqual(model, before);
});

for (const edit of ['none', 'unrelated', 'node']) test('MDX save removes legacy empty tracks through the ' + edit + ' preservation path', () => {
  const doc = openDocument(fixture(), 'legacy.mdx');
  assert.equal(doc.readOnly, false);
  if (edit === 'unrelated') doc.apply('Rename model', ['Info'], m => { m.Info.Name += ' edited'; });
  if (edit === 'node') doc.apply('Rename bone', ['Bones'], m => { m.Bones[0].Name += ' edited'; });
  const before = structuredClone(doc.model), history = doc.historyStats, bytes = doc.serialize('mdx');
  assertNoEmptyNodeTracks(bytes);
  assertModelEquivalent(before, openDocument(bytes, 'saved.mdx').model, { format: 'mdx' });
  assert.deepEqual(doc.model, before); assert.deepEqual(doc.historyStats, history);
  for (const compact of [false, true]) assertNoEmptyNodeTracks(EditorDocument.restoreRecoveryState(doc.captureRecoveryState({ compact })).serialize('mdx'));
  doc.markSaved(bytes, 'saved.mdx'); assert.equal(doc.dirty, false);
  assert.deepEqual(doc.serialize('mdx'), bytes);
  if (edit !== 'none') { doc.undo(); assertNoEmptyNodeTracks(doc.serialize('mdx')); doc.redo(); assertNoEmptyNodeTracks(doc.serialize('mdx')); }
});

test('MDL retains empty-track metadata and conversion to MDX omits only the empty node blocks', () => {
  const doc = openDocument(fixture(), 'legacy.mdx'), mdl = doc.serialize('mdl'), reopened = openDocument(mdl, 'legacy.mdl');
  assert.deepEqual(reopened.model.Bones.find(n => n.Name === 'Bone3').Translation.Keys, []);
  assertModelEquivalent(doc.model, reopened.model, { format: 'mdl' });
  assertNoEmptyNodeTracks(reopened.serialize('mdx'));
  const classic = createStarterDocument();
  classic.model.Bones[0].Translation = track([]);
  classic.convertVersion(1000); assertNoEmptyNodeTracks(classic.serialize('mdx'));
  assert.deepEqual(classic.model.Bones[0].Translation.Keys, [], 'conversion keeps the live empty track');
});

test('save verification permits only absent empty node transforms, and still rejects lost keys and metadata', () => {
  const model = value => ({ Bones: [{ ObjectId: 0, Translation: value }] });
  for (const property of properties) {
    const empty = { Bones: [{ ObjectId: 0, [property]: track([]) }] }, absent = { Bones: [{ ObjectId: 0 }] };
    assertModelEquivalent(empty, absent, { format: 'mdx' });
    assertModelEquivalent(absent, empty, { format: 'mdx' });
    assert.throws(() => assertModelEquivalent(empty, absent, { format: 'mdl' }), /Save verification failed/);
  }
  const real = track([key(7, [1, 2, 3])]);
  for (const changed of [undefined, track([]), track([key(8, [1, 2, 3])]), track([key(7, [1, 2, 4])]), { ...real, LineType: 0 }, { ...real, GlobalSeqId: 0 }]) {
    assert.throws(() => assertModelEquivalent(model(real), model(changed), { format: 'mdx' }), /Save verification failed/);
  }
  assert.throws(() => assertModelEquivalent({ Materials: [{ Alpha: track([]) }] }, { Materials: [{ Alpha: 1 }] }, { format: 'mdx' }), /Save verification failed/);
});