import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMDL } from 'war3-model';
import { createDemoDocument, openDocument, EditorDocument, createNode } from '../src/editor-document.js';
import { createSequenceFromCurrent, deleteSequence } from '../src/sequence-editor.js';
import { parseCompatibleMdx } from '../src/mdx-compatibility.js';
import { parseMdx } from '../src/mdx-container.js';
import { assertModelEquivalent } from '../src/save-equivalence.js';
import { ANIMATION_SPEED_KEY, ANIMATION_SPEED_FRAME, ANIMATION_SPEED_EVENTS, ANIMATION_SPEED_TAG, ANIMATION_SPEED_CHUNK, animationSpeedData, animationSpeed, animationSpeedChecked, animationMasterSpeed, setAnimationActualSpeed, setAnimationSpeedChecked } from '../src/animation-speed.js';

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
  test(`${format}: another document restores 100 after speed edits, conversion, and repeated save/reopen`, () => {
    let doc = fixture(); const baseline = native(doc.model);
    doc.apply('137%', [], model => setAnimationActualSpeed(model, 0, 137));
    doc.apply('Exclude Walk', [], model => setAnimationSpeedChecked(model, 1, false));
    doc.apply('Master 259%', [], model => setAnimationActualSpeed(model, null, 259));
    const data = animationSpeedData(doc.model), bytes = doc.serialize(format);
    assert.equal(Buffer.from(bytes).toString('utf8').split(ANIMATION_SPEED_TAG).length, 2);
    if (format === 'mdx') assert.equal(parseMdx(bytes).chunks.filter(chunk => chunk.tag === ANIMATION_SPEED_CHUNK).length, 1);
    const plain = format === 'mdl' ? parseMDL(Buffer.from(bytes).toString('utf8')) : parseCompatibleMdx(bytes);
    assert.deepEqual(intervals(plain), intervals(doc.model));
    assert.deepEqual(plain.Bones[0].Translation.Keys.map(key => key.Frame), doc.model.Bones[0].Translation.Keys.map(key => key.Frame));
    doc = openDocument(bytes, `different-person.${format}`);
    assert.equal(doc.readOnly, false); assert.deepEqual(animationSpeedData(doc.model), data);
    assert.equal(animationMasterSpeed(doc.model), 259); assert.equal(animationSpeedChecked(doc.model.Sequences[1]), false);
    assert.deepEqual(doc.serialize(), bytes);
    doc.apply('73%', [], model => setAnimationActualSpeed(model, 0, 73));
    const opposite = format === 'mdl' ? 'mdx' : 'mdl';
    doc = openDocument(doc.serialize(opposite), `other-format.${opposite}`);
    doc.apply('Original', [], model => setAnimationActualSpeed(model, 0, 100));
    assertModelEquivalent({ Sequences: baseline.Sequences }, { Sequences: doc.model.Sequences }, { keys: ['Sequences'] });
    assert.deepEqual(doc.model.Bones[0].Translation.Keys.map(key => key.Frame), baseline.Bones[0].Translation.Keys.map(key => key.Frame));
    assert.deepEqual(Array.from(doc.model.EventObjects[0].EventTrack), baseline.EventObjects[0].EventTrack);
  });
}

test('master only changes checked speeds, per-animation settings remain independent, and undo/recovery retain the baseline', () => {
  const doc = fixture(); const before = native(doc.model);
  doc.apply('Exclude', [], model => setAnimationSpeedChecked(model, 1, false));
  assert.equal(doc.dirty, true);
  doc.apply('Master', [], model => setAnimationActualSpeed(model, null, 50));
  assert.equal(animationSpeed(doc.model.Sequences[0]), 50); assert.equal(animationSpeed(doc.model.Sequences[1]), 100);
  assert.equal(doc.model.Sequences[1].Interval[1] - doc.model.Sequences[1].Interval[0], 2000);
  const copy = EditorDocument.restoreRecoveryState(doc.captureRecoveryState({ compact: true }));
  assert.deepEqual(animationSpeedData(copy.model), animationSpeedData(doc.model));
  copy.undo(); assert.deepEqual(native(copy.model), before); copy.redo();
  copy.apply('Walk speed', [], model => setAnimationActualSpeed(model, 1, 200));
  assert.equal(animationSpeed(copy.model.Sequences[0]), 50); assert.equal(animationSpeed(copy.model.Sequences[1]), 200);
  copy.apply('Restore all', [], model => { setAnimationActualSpeed(model, 0, 100); setAnimationActualSpeed(model, 1, 100); });
  assert.deepEqual(native(copy.model), before);
});

test('new keys, edited key values, removed events, copied and deleted sequences survive subsequent save and restore', () => {
  let doc = fixture();
  doc.apply('Speed', [], model => setAnimationActualSpeed(model, 0, 50));
  doc.apply('Edit motion', [], model => {
    model.Bones[0].Translation.Keys[1].Vector[0] = 99;
    model.Bones[0].Translation.Keys.splice(2, 0, { Frame: 1600, Vector: new Float32Array([3, 4, 5]) });
    model.EventObjects[0].EventTrack = new Uint32Array(Array.from(model.EventObjects[0].EventTrack).filter(frame => frame !== 1554));
    createSequenceFromCurrent(model, 0);
  });
  doc = openDocument(doc.serialize('mdx'), 'copy.mdx');
  assert.equal(doc.readOnly, false);
  doc.apply('Copy original speed', [], model => setAnimationActualSpeed(model, 2, 100));
  assert.equal(doc.model.Sequences[2].Interval[1] - doc.model.Sequences[2].Interval[0], 2000);
  doc.apply('Delete Walk', [], model => deleteSequence(model, 1));
  doc = openDocument(doc.serialize('mdl'), 'edited.mdl');
  doc.apply('Original', [], model => setAnimationActualSpeed(model, 0, 100));
  assert.equal(doc.model.Bones[0].Translation.Keys.find(key => key.Frame === 777).Vector[0], 99);
  assert.ok(doc.model.Bones[0].Translation.Keys.some(key => key.Frame === 800));
  assert.ok(!Array.from(doc.model.EventObjects[0].EventTrack).includes(777));
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

test('malformed comments are reported and preserved, and metadata-only saves preserve native bytes', () => {
  const original = createDemoDocument().serialize('mdl');
  const malformed = Buffer.concat([Buffer.from(`// ${ANIMATION_SPEED_TAG} {"tracks":[null]}\n`), original]);
  const doc = openDocument(malformed, 'invalid.mdl');
  assert.equal(doc.readOnly, false); assert.ok(doc.diagnostics.some(item => item.code === 'ANIMATION_SPEED_METADATA'));
  assert.deepEqual(Buffer.from(doc.serialize()), malformed);
  doc.apply('Uncheck', [], model => setAnimationSpeedChecked(model, 0, false));
  const bytes = Buffer.from(doc.serialize());
  assert.ok(bytes.includes(malformed));
  // Choosing master participants alone must not write a timing baseline.
  assert.deepEqual(bytes, malformed);
  assert.equal(animationSpeedData(openDocument(bytes, 'saved.mdl').model), null);
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
  doc.apply('Speed', [], model => setAnimationActualSpeed(model, 0, 200));
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format), `signed.${format}`);
    assert.equal(reopened.readOnly, false);
    assert.equal(reopened.model.EventObjects[0].EventTrack[0], -10);
    reopened.apply('Original', [], model => setAnimationActualSpeed(model, 0, 100));
    assert.deepEqual(reopened.model.Bones[0].Translation.Keys.map(key => ({ Frame: key.Frame, Vector: key.Vector, InTan: key.InTan, OutTan: key.OutTan })), before.Keys);
  }
});

test('saved baselines, edits during disk writing, and valid JSON with malformed records preserve history and comments', () => {
  const doc = fixture();
  doc.apply('Speed', [], model => setAnimationActualSpeed(model, 0, 50));
  const saved = doc.serialize('mdx'); doc.markSaved(saved, 'speed.mdx'); assert.equal(doc.dirty, false);
  assert.deepEqual(doc.serialize(), saved);
  doc.apply('Master', [], model => setAnimationActualSpeed(model, null, 137));
  const pending = doc.serialize();
  doc.apply('Exclude', [], model => setAnimationSpeedChecked(model, 1, false));
  doc.markSaved(pending, 'speed.mdx'); assert.equal(doc.dirty, true);
  doc.undo(); assert.equal(doc.dirty, false); doc.redo(); assert.equal(doc.dirty, true);
  const invalid = Buffer.from(`// ${ANIMATION_SPEED_TAG} {"master":100,"sequences":[],"tracks":[null],"events":[]}\n`);
  const reopened = openDocument(Buffer.concat([invalid, createDemoDocument().serialize('mdl')]), 'malformed.mdl');
  assert.equal(reopened.readOnly, false); assert.ok(reopened.diagnostics.some(item => item.code === 'ANIMATION_SPEED_METADATA'));
});
