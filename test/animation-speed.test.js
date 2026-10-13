import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMDL } from 'war3-model';
import { createDemoDocument, openDocument, EditorDocument, createNode } from '../src/editor-document.js';
import { createSequenceFromCurrent, deleteSequence } from '../src/sequence-editor.js';
import { parseCompatibleMdx } from '../src/mdx-compatibility.js';
import { parseMdx } from '../src/mdx-container.js';
import { ANIMATION_SPEED_KEY, ANIMATION_SPEED_FRAME, ANIMATION_SPEED_EVENTS, ANIMATION_SPEED_TAG, ANIMATION_SPEED_LEGACY_TAG, ANIMATION_SPEED_CHUNK, animationSpeed, animationSpeedChecked, animationMasterSpeed, setAnimationActualSpeed, setAnimationSpeedChecked } from '../src/animation-speed.js';

function fixture() {
  const doc = createDemoDocument();
  doc.apply('Speed fixture', [], model => {
    const source = structuredClone(model.Sequences[0]);
    source.Name = 'Walk'; source.Interval = new Uint32Array([3000, 5000]); model.Sequences.push(source);
    for (const geoset of model.Geosets) geoset.Anims.push(structuredClone(geoset.Anims[0]));
    for (const track of [model.Bones[0].Translation, model.Bones[0].Rotation, model.GeosetAnims[4].Alpha]) {
      track.Keys.push(...track.Keys.map(key => ({ ...structuredClone(key), Frame: key.Frame + 3000 })));
    }
    model.GlobalSequences = [1000];
    model.TextureAnims.push({ Translation: { LineType: 1, GlobalSeqId: 0, Keys: [{ Frame: 0, Vector: new Float32Array([0, 0, 0]) }, { Frame: 1000, Vector: new Float32Array([1, 1, 0]) }] } });
    const event = createNode(model, 'EventObject', 'SNDxSpeed', { pivot: [0, 0, 0] });
    event.EventTrack = new Uint32Array([0, 777, 2000, 3000, 4777, 5000]);
    model.Bones[0].Translation.Keys.splice(1, 0, { Frame: 777, Vector: new Float32Array([1, 2, 3]) });
  });
  return doc;
}
const native = model => JSON.parse(JSON.stringify(model, (key, value) => [ANIMATION_SPEED_KEY, ANIMATION_SPEED_FRAME, ANIMATION_SPEED_EVENTS, 'Nodes'].includes(key) ? undefined : ArrayBuffer.isView(value) ? Array.from(value) : value));
const intervals = model => model.Sequences.map(sequence => Array.from(sequence.Interval));

test('individual speed changes real intervals, all local keys and events; 100 restores exact native timing', () => {
  const doc = fixture(), before = native(doc.model), globals = structuredClone(doc.model.TextureAnims);
  doc.apply('Half speed', [], model => setAnimationActualSpeed(model, 0, 50));
  assert.deepEqual(intervals(doc.model), [[0, 4000], [5000, 7000]]);
  assert.equal(doc.model.Bones[0].Translation.Keys[1].Frame, 1554);
  assert.deepEqual(Array.from(doc.model.EventObjects[0].EventTrack), [0, 1554, 4000, 5000, 6777, 7000]);
  assert.deepEqual(doc.model.TextureAnims, globals);
  assert.equal(animationSpeed(doc.model.Sequences[1]), 100);
  for (const speed of [300, 137, 1, 259, 100]) doc.apply('Speed', [], model => setAnimationActualSpeed(model, 0, speed));
  assert.deepEqual(native(doc.model), before);
});

for (const format of ['mdl', 'mdx']) {
  test(`${format}: speed changes save native timing only and reopen at 100%`, () => {
    let doc = fixture();
    doc.apply('137%', [], model => setAnimationActualSpeed(model, 0, 137));
    doc.apply('Exclude Walk', [], model => setAnimationSpeedChecked(model, 1, false));
    doc.apply('Master 259%', [], model => setAnimationActualSpeed(model, null, 259));
    const bytes = doc.serialize(format), timing = intervals(doc.model);
    assert.ok(!Buffer.from(bytes).includes(ANIMATION_SPEED_TAG));
    if (format === 'mdx') assert.equal(parseMdx(bytes).chunks.filter(chunk => chunk.tag === ANIMATION_SPEED_CHUNK).length, 0);
    const plain = format === 'mdl' ? parseMDL(Buffer.from(bytes).toString('utf8')) : parseCompatibleMdx(bytes);
    assert.deepEqual(intervals(plain), timing);
    assert.deepEqual(plain.Bones[0].Translation.Keys.map(key => key.Frame), doc.model.Bones[0].Translation.Keys.map(key => key.Frame));
    doc = openDocument(bytes, `different-person.${format}`);
    assert.equal(doc.readOnly, false); assert.equal(doc.dirty, false);
    assert.deepEqual(intervals(doc.model), timing);
    assert.deepEqual(doc.model.Sequences.map(animationSpeed), [100, 100]);
    assert.equal(animationMasterSpeed(doc.model), 100); assert.equal(animationSpeedChecked(doc.model.Sequences[1]), true);
    assert.deepEqual(doc.serialize(), bytes);
    doc.apply('Half', [], model => setAnimationActualSpeed(model, 0, 50));
    assert.equal(doc.model.Sequences[0].Interval[1] - doc.model.Sequences[0].Interval[0], (timing[0][1] - timing[0][0]) * 2);
  });

  test(`${format}: speed annotations from earlier versions are stripped on save without touching native data`, () => {
    const nativeBytes = Buffer.from(createDemoDocument().serialize(format));
    for (const tag of [ANIMATION_SPEED_TAG, ANIMATION_SPEED_LEGACY_TAG]) {
      const text = Buffer.from(`// ${tag} {"master":50}\n`);
      const header = Buffer.alloc(8); header.write(ANIMATION_SPEED_CHUNK, 'ascii'); header.writeUInt32LE(text.length, 4);
      const input = format === 'mdl' ? Buffer.concat([text, nativeBytes]) : Buffer.concat([nativeBytes, header, text]);
      const doc = openDocument(input, `old.${format}`);
      assert.equal(doc.readOnly, false);
      assert.ok(!doc.diagnostics.some(item => item.code === 'OPAQUE_DATA_PRESERVED'));
      assert.deepEqual(doc.model.Sequences.map(animationSpeed), doc.model.Sequences.map(() => 100));
      assert.deepEqual(Buffer.from(doc.serialize()), nativeBytes);
    }
  });
}

test('master only changes checked speeds, per-animation settings remain independent, and undo/recovery retain the baseline', () => {
  const doc = fixture(); const before = native(doc.model);
  doc.markSaved(doc.serialize('mdx'), 'fixture.mdx');
  doc.apply('Exclude', [], model => setAnimationSpeedChecked(model, 1, false));
  assert.equal(doc.dirty, false); // Choosing participants alone changes nothing in the file.
  doc.apply('Master', [], model => setAnimationActualSpeed(model, null, 50));
  assert.equal(animationSpeed(doc.model.Sequences[0]), 50); assert.equal(animationSpeed(doc.model.Sequences[1]), 100);
  assert.equal(doc.model.Sequences[1].Interval[1] - doc.model.Sequences[1].Interval[0], 2000);
  const copy = EditorDocument.restoreRecoveryState(doc.captureRecoveryState({ compact: true }));
  assert.deepEqual(copy.model.Sequences.map(animationSpeed), [50, 100]);
  copy.undo(); assert.deepEqual(native(copy.model), before); copy.redo();
  copy.apply('Walk speed', [], model => setAnimationActualSpeed(model, 1, 200));
  assert.equal(animationSpeed(copy.model.Sequences[0]), 50); assert.equal(animationSpeed(copy.model.Sequences[1]), 200);
  copy.apply('Restore all', [], model => { setAnimationActualSpeed(model, 0, 100); setAnimationActualSpeed(model, 1, 100); });
  assert.deepEqual(native(copy.model), before);
});

test('new keys, edited key values, removed events, copied and deleted sequences restore exactly in the session', () => {
  const doc = fixture();
  doc.apply('Speed', [], model => setAnimationActualSpeed(model, 0, 50));
  doc.apply('Edit motion', [], model => {
    model.Bones[0].Translation.Keys[1].Vector[0] = 99;
    model.Bones[0].Translation.Keys.splice(2, 0, { Frame: 1600, Vector: new Float32Array([3, 4, 5]) });
    model.EventObjects[0].EventTrack = new Uint32Array(Array.from(model.EventObjects[0].EventTrack).filter(frame => frame !== 1554));
    createSequenceFromCurrent(model, 0);
  });
  doc.apply('Copy original speed', [], model => setAnimationActualSpeed(model, 2, 100));
  assert.equal(doc.model.Sequences[2].Interval[1] - doc.model.Sequences[2].Interval[0], 2000);
  doc.apply('Delete Walk', [], model => deleteSequence(model, 1));
  doc.apply('Original', [], model => setAnimationActualSpeed(model, 0, 100));
  assert.equal(doc.model.Bones[0].Translation.Keys.find(key => key.Frame === 777).Vector[0], 99);
  assert.ok(doc.model.Bones[0].Translation.Keys.some(key => key.Frame === 800));
  assert.ok(!Array.from(doc.model.EventObjects[0].EventTrack).includes(777));
  const reopened = openDocument(doc.serialize('mdx'), 'copy.mdx');
  assert.equal(reopened.readOnly, false);
  assert.deepEqual(intervals(reopened.model), intervals(doc.model));
});

test('invalid percentages and keyframe collisions fail without dropping motion; contiguous sequences work', () => {
  const doc = fixture(), before = native(doc.model);
  for (const speed of [0, 301, 1.5, NaN]) assert.throws(() => setAnimationActualSpeed(doc.model, 0, speed), /1 to 300/);
  assert.deepEqual(native(doc.model), before);
  doc.model.Bones[0].Translation.Keys.splice(1, 0, { Frame: 1, Vector: new Float32Array([1, 1, 1]) });
  const dense = native(doc.model);
  assert.throws(() => setAnimationActualSpeed(doc.model, 0, 300), /merge distinct keyframes/);
  assert.deepEqual(native(doc.model), dense);
  const minimal = { Sequences: [{ Interval: [0, 1000] }, { Interval: [1000, 2000] }] };
  setAnimationActualSpeed(minimal, 0, 50); assert.deepEqual(intervals(minimal), [[0, 2000], [2000, 3000]]);
});

test('negative local key and event times remain signed, and cubic values and tangents survive speed changes', () => {
  const doc = fixture();
  doc.apply('Signed cubic fixture', [], model => {
    const track = model.Bones[0].Translation; track.LineType = 2;
    track.Keys.unshift({ Frame: -10, Vector: new Float32Array([1, 2, 3]) });
    for (const key of track.Keys) { key.InTan = new Float32Array([2, 3, 4]); key.OutTan = new Float32Array([5, 6, 7]); }
    model.EventObjects[0].EventTrack = new Int32Array([-10, ...model.EventObjects[0].EventTrack]);
  });
  const before = structuredClone(doc.model.Bones[0].Translation);
  const keys = model => model.Bones[0].Translation.Keys.map(key => ({ Frame: key.Frame, Vector: key.Vector, InTan: key.InTan, OutTan: key.OutTan }));
  doc.apply('Speed', [], model => setAnimationActualSpeed(model, 0, 200));
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format), `signed.${format}`);
    assert.equal(reopened.readOnly, false);
    assert.equal(reopened.model.EventObjects[0].EventTrack[0], -10);
    assert.deepEqual(keys(reopened.model), keys(doc.model));
  }
  doc.apply('Original', [], model => setAnimationActualSpeed(model, 0, 100));
  assert.deepEqual(keys(doc.model), before.Keys);
});

test('saved baselines and edits during disk writing keep the dirty state accurate', () => {
  const doc = fixture();
  doc.apply('Speed', [], model => setAnimationActualSpeed(model, 0, 50));
  const saved = doc.serialize('mdx'); doc.markSaved(saved, 'speed.mdx'); assert.equal(doc.dirty, false);
  assert.deepEqual(doc.serialize(), saved);
  doc.apply('Master', [], model => setAnimationActualSpeed(model, null, 137));
  const pending = doc.serialize();
  doc.apply('Walk', [], model => setAnimationActualSpeed(model, 1, 200));
  doc.markSaved(pending, 'speed.mdx'); assert.equal(doc.dirty, true);
  doc.undo(); assert.equal(doc.dirty, false); doc.redo(); assert.equal(doc.dirty, true);
});
