import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeRecovery, decodeRecovery } from '../src/recovery-wire.js';
import { createRecoveryCheckpointer } from '../app/recovery-checkpoint.js';
import { EditorDocument, createDemoDocument } from '../src/editor-document.js';

const session = doc => ({ doc, id: 'test', checkpoint: 0, path: null, assets: new Map(), uvPreviews: {}, animationDrafts: {}, paintProject: null, paintWorkingRevision: 0 });
// Portable source coverage complements the real owner histories in the packaged test.
const fixture = async () => {
  const doc = createDemoDocument();
  for (let i = 0; i < 60; i++) doc.apply('Move vertex', ['Geosets'], model => { model.Geosets[0].Vertices[0] += 0.25; });
  return doc.captureRecoveryState({ compact: true });
};

test('recovery wire preserves structured values, aliases, cycles and compact binary views', async () => {
  const backing = new Uint8Array(1024 * 1024), view = backing.subarray(32, 48); view[3] = 253;
  const value = { undef: undefined, none: null, numbers: [-0, NaN, Infinity, -Infinity, 12.25], text: 'Русский 简体中文 😀', big: 12345678901234567890n,
    view, same: view, pooled: Buffer.from([1,2,3]), data: new DataView(new ArrayBuffer(8)), buffer: new ArrayBuffer(7), date: new Date(1234567), regex: /a+/gi,
    map: new Map(), set: new Set(), sparse: new Array(3) };
  value.self = value; value.map.set(value, value.view); value.set.add(value); value.sparse[2] = 'last';
  Object.defineProperty(value, '__proto__', { value: { preserved: true }, enumerable: true });
  const encoded = await encodeRecovery(value), restored = decodeRecovery(encoded);
  assert.deepEqual(restored, value);
  assert.equal(restored.view.buffer.byteLength, restored.view.byteLength);
  assert.equal(restored.same, restored.view); assert.equal(restored.self, restored);
  assert.equal(decodeRecovery(Buffer.from(encoded)).view.buffer.byteLength, view.byteLength);
  assert.ok(encoded.byteLength < 2000, 'unrelated backing storage is not transported');
});

test('wire rejects corruption and cancels before publishing a superseded snapshot', async () => {
  const bytes = await encodeRecovery({ a: [1, 2, 3] });
  for (const invalid of [bytes.slice(0, 3), bytes.slice(0, -1), new Uint8Array([...bytes, 1])]) assert.throws(() => decodeRecovery(invalid));
  let current = true, turns = 0;
  const result = await encodeRecovery(Array.from({ length: 20000 }, (_, i) => ({ i })), { sliceMs: 0, current: () => current, yieldTask: async () => { turns++; current = false; } });
  assert.equal(result, null); assert.equal(turns, 1);
});

test('document recovery round-trip preserves full undo/redo and model data', async () => {
  const state = await fixture(), expected = EditorDocument.restoreRecoveryState(state), actual = EditorDocument.restoreRecoveryState(decodeRecovery(await encodeRecovery(state)));
  assert.deepEqual(actual.model, expected.model);
  assert.deepEqual(actual.historyStats, expected.historyStats);
  for (let step = 0; step < 5; step++) { expected.undo(); actual.undo(); assert.deepEqual(actual.model, expected.model); }
  for (let step = 0; step < 5; step++) { expected.redo(); actual.redo(); assert.deepEqual(actual.model, expected.model); }
});

test('unchanged checkpoints coalesce; selection-only history and unbaked drafts persist', async () => {
  const doc = EditorDocument.restoreRecoveryState(await fixture()), target = session(doc), writes = [];
  const recovery = createRecoveryCheckpointer(async wire => writes.push(decodeRecovery(wire.encoded)));
  const first = recovery.checkpoint(target); assert.equal(recovery.checkpoint(target), first);
  await first; await recovery.checkpoint(target); assert.equal(writes.length, 1);
  const revision = doc.revision;
  const entry = doc._historyStore.prepare({ label: 'Change selection', sections: [], changes: [] }); doc._historyStore.commit(entry);
  await recovery.checkpoint(target); assert.equal(doc.revision, revision); assert.equal(writes.length, 2);
  target.animationDrafts = { 'node:0': { text: 'unbaked text' } };
  await recovery.checkpoint(target); assert.deepEqual(writes.at(-1).animationDrafts, target.animationDrafts);
  assert.equal(writes.at(-1).state.history.undoEntries.at(-1).label, 'Change selection');
});

test('an edit while encoding restarts the snapshot and a failed write is retryable', async () => {
  const doc = EditorDocument.restoreRecoveryState(await fixture()), target = session(doc), writes = [];
  let turns = 0, changed = false, fail = true;
  const recovery = createRecoveryCheckpointer(async wire => { if (fail) { fail = false; throw Error('write failure'); } writes.push(decodeRecovery(wire.encoded)); }, {
    yieldTask: async () => { if (++turns === 2) { target.animationDrafts = { track: 'new draft' }; changed = true; } },
  });
  await assert.rejects(recovery.checkpoint(target), /write failure/);
  await recovery.checkpoint(target); assert.equal(changed, true); assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].animationDrafts, { track: 'new draft' });
});


test('checkpoint waits for an in-flight paint transaction and preserves the committed raster', async () => {
  const target = session(EditorDocument.restoreRecoveryState(await fixture())), writes=[];
  target.paintProject={revision:1,dirty:true,raster:new Uint8Array(1024*1024)};
  const recovery=createRecoveryCheckpointer(async payload=>writes.push(decodeRecovery(payload.encoded)));
  recovery.setInteracting(target,true);
  const pending=recovery.checkpoint(target);
  target.paintProject.raster.fill(42); target.paintProject.revision++;
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(writes.length,0);
  recovery.setInteracting(target,false); await pending;
  assert.deepEqual(writes[0].paintProject.raster,target.paintProject.raster);
  assert.equal(writes[0].paintProject.revision,2);
});
