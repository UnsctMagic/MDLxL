import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMDL, parseMDX } from 'war3-model';
import { createDemoDocument, openDocument, EditorDocument, deleteGeoset } from '../src/editor-document.js';
import { parseMdx } from '../src/mdx-container.js';
import { GEOSET_TABS_TAG, GEOSET_TABS_CHUNK, GEOSET_TABS_KEY, GEOSET_TAB_KEY, createGeosetTab, assignGeosetTab, deleteGeosetTab, geosetTabsData, geosetsInTab } from '../src/geoset-tabs.js';
import { nuclearSeparateGeosets } from '../src/geoset-operations.js';

const nativeChunks = bytes => parseMdx(bytes).chunks.filter(chunk => chunk.tag !== GEOSET_TABS_CHUNK)
  .map(chunk => Buffer.from(bytes).subarray(chunk.offset, chunk.payloadOffset + chunk.declaredSize));
const tabs = doc => geosetTabsData(doc.model);
const group = (doc, name = 'Armor', indices = [0]) => doc.apply('Create tab', [GEOSET_TABS_KEY, 'Geosets'], model => createGeosetTab(model, name, indices));

for (const format of ['mdl', 'mdx']) {
  test(`${format}: tab-only save preserves native model bytes and an independent parser accepts it`, () => {
    const original = createDemoDocument().serialize(format), doc = openDocument(original, `demo.${format}`);
    const originalAnimations = structuredClone(doc.model.GeosetAnims), id = group(doc, 'Armor "Русский" 简体中文 // */', [0]);
    assert.equal(doc.dirty, true);
    assert.deepEqual(doc.saveImpact().changedSections, []);
    const saved = doc.serialize(), reopened = openDocument(saved, `saved.${format}`);
    assert.equal(reopened.readOnly, false);
    assert.deepEqual(tabs(reopened), tabs(doc));
    assert.equal(reopened.model.Geosets[0][GEOSET_TAB_KEY], id);
    assert.deepEqual(doc.model.GeosetAnims, originalAnimations);
    if (format === 'mdx') {
      assert.deepEqual(nativeChunks(saved), nativeChunks(original));
      assert.equal(parseMdx(saved).chunks.at(-1).tag, GEOSET_TABS_CHUNK);
      assert.equal(parseMDX(saved.buffer).Geosets.length, doc.model.Geosets.length);
    } else {
      assert.ok(Buffer.from(saved).subarray(Buffer.from(saved).indexOf(10) + 1).equals(Buffer.from(original)));
      assert.equal(parseMDL(Buffer.from(saved).toString('utf8')).Geosets.length, doc.model.Geosets.length);
    }
    doc.markSaved(saved); assert.equal(doc.dirty, false);
    assert.deepEqual(doc.serialize(), saved);
    doc.apply('Hide tab', [GEOSET_TABS_KEY], model => { model[GEOSET_TABS_KEY][0].visible = false; });
    const hiddenSave = doc.serialize(), hidden = openDocument(hiddenSave, `saved.${format}`);
    assert.equal(hidden.model[GEOSET_TABS_KEY][0].visible, false);
    assert.deepEqual(hidden.model.GeosetAnims, originalAnimations);
    assert.equal(Buffer.from(hiddenSave).toString('utf8').split(GEOSET_TABS_TAG).length, 2);
    assert.deepEqual(hidden.serialize(), hiddenSave);
  });

  test(`${format}: geometry edits, deletion, undo and conversion retain tab ownership`, () => {
    const doc = openDocument(createDemoDocument().serialize(format), `demo.${format}`);
    const id = group(doc, 'Weapon', [1]);
    doc.apply('Move mesh', ['Geosets'], model => { model.Geosets[1].Vertices[0] += 1; });
    assert.deepEqual(tabs(openDocument(doc.serialize(), `saved.${format}`)), tabs(doc));
    doc.apply('Delete preceding geoset', ['Geosets'], model => deleteGeoset(model, 0));
    assert.equal(doc.model.Geosets[0][GEOSET_TAB_KEY], id);
    assert.deepEqual(tabs(openDocument(doc.serialize(), `saved.${format}`)), tabs(doc));
    doc.undo(); assert.equal(doc.model.Geosets[1][GEOSET_TAB_KEY], id);
    const opposite = format === 'mdl' ? 'mdx' : 'mdl';
    assert.equal(doc.saveImpact(opposite).canSave, true);
    assert.deepEqual(tabs(openDocument(doc.serialize(opposite), `saved.${opposite}`)), tabs(doc));
  });
}

test('assignment, tab removal, undo, recovery and edits during saving preserve metadata history', () => {
  const doc = createDemoDocument(), id = group(doc);
  const saved = doc.serialize('mdx');
  doc.apply('Move to tab', ['Geosets'], model => assignGeosetTab(model, [1], id));
  doc.markSaved(saved, 'tabs.mdx'); assert.equal(doc.dirty, true);
  const recovered = EditorDocument.restoreRecoveryState(doc.captureRecoveryState({ compact: true }));
  assert.deepEqual(tabs(recovered), tabs(doc));
  doc.undo(); assert.equal(doc.dirty, false);
  doc.undo(); assert.equal(doc.model[GEOSET_TABS_KEY], undefined);
  doc.redo(); assert.equal(doc.model.Geosets[0][GEOSET_TAB_KEY], id);
  doc.apply('Delete tab', [GEOSET_TABS_KEY, 'Geosets'], model => deleteGeosetTab(model, id));
  assert.equal(doc.model[GEOSET_TABS_KEY], undefined);
  assert.equal(doc.model.Geosets.some(geoset => geoset[GEOSET_TAB_KEY]), false);
  assert.equal(parseMdx(doc.serialize('mdx')).chunks.some(chunk => chunk.tag === GEOSET_TABS_CHUNK), false);
  doc.undo(); assert.equal(doc.model.Geosets[0][GEOSET_TAB_KEY], id);
});

test('visibility and the active tab restrict the work area without changing native alpha', () => {
  const doc = createDemoDocument(), before = structuredClone(doc.model.GeosetAnims), first = group(doc, 'First', [0]), second = group(doc, 'Second', [1]);
  doc.apply('Hide first', [GEOSET_TABS_KEY], model => { model[GEOSET_TABS_KEY][0].visible = false; });
  assert.deepEqual([...geosetsInTab(doc.model, first)], [0]);
  assert.deepEqual([...geosetsInTab(doc.model, first, { visible: true })], []);
  assert.deepEqual([...geosetsInTab(doc.model, second, { visible: true })], [1]);
  assert.equal(geosetsInTab(doc.model, 'all', { visible: true }).has(0), false);
  assert.equal(geosetsInTab(doc.model, 'all', { visible: true }).has(1), true);
  assert.deepEqual(doc.model.GeosetAnims, before);
});

test('splitting a grouped geoset gives every resulting part the same tab', () => {
  const doc = createDemoDocument(), id = group(doc);
  doc.apply('Disconnected triangle', ['Geosets'], model => {
    const g = model.Geosets[0], n = g.Vertices.length / 3;
    g.Vertices = new Float32Array([...g.Vertices, 100, 0, 0, 110, 0, 0, 100, 10, 0]);
    g.Normals = new Float32Array([...g.Normals, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
    g.TVertices = g.TVertices.map(uv => new Float32Array([...uv, 0, 0, 1, 0, 0, 1]));
    g.VertexGroup = new Uint8Array([...g.VertexGroup, 0, 0, 0]);
    g.Faces = new Uint16Array([...g.Faces, n, n + 1, n + 2]);
  });
  const count = doc.model.Geosets.length;
  doc.apply('Split', ['Geosets'], model => nuclearSeparateGeosets(model, { 0: Array.from({ length: model.Geosets[0].Vertices.length / 3 }, (_, i) => i) }));
  assert.ok(doc.model.Geosets.length > count);
  assert.equal(doc.model.Geosets.at(-1)[GEOSET_TAB_KEY], id);
  assert.deepEqual(tabs(openDocument(doc.serialize('mdx'), 'split.mdx')), tabs(doc));
});

test('a malformed annotation warns without making the model read-only; foreign comments are untouched', () => {
  const original = Buffer.from(createDemoDocument().serialize('mdl'));
  const bytes = Buffer.concat([original, Buffer.from(`\n// ${GEOSET_TABS_TAG} invalid\n// another-tool {"tabs":[]}\n`)]);
  const doc = openDocument(bytes, 'comment.mdl');
  assert.equal(doc.readOnly, false);
  assert.ok(doc.diagnostics.some(item => item.code === 'GEOSET_TABS_METADATA'));
  assert.ok(Buffer.from(doc.serialize()).equals(bytes));
  doc.apply('Rename model', ['Info'], model => { model.Info.Name = 'Renamed'; });
  assert.ok(Buffer.from(doc.serialize()).toString('utf8').includes(`// ${GEOSET_TABS_TAG} invalid`));
});

test('tab comments retain an MDL BOM and every original CRLF source byte', () => {
  const original = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(Buffer.from(createDemoDocument().serialize('mdl')).toString('utf8').replace(/\r?\n/g, '\r\n'))]);
  const doc = openDocument(original, 'bom.mdl'); group(doc);
  const saved = Buffer.from(doc.serialize());
  assert.ok(saved.subarray(0, 3).equals(original.subarray(0, 3)));
  assert.ok(saved.subarray(saved.indexOf(10) + 1).equals(original.subarray(3)));
  assert.deepEqual(tabs(openDocument(saved, 'bom.mdl')), tabs(doc));
});

test('native model fixture stays byte-identical except for the tab annotation', () => {
  const original = readFileSync(new URL('../test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx', import.meta.url));
  const doc = openDocument(original, 'fixture.mdx');
  assert.equal(doc.readOnly, false);
  group(doc, 'Work', [0, doc.model.Geosets.length - 1]);
  const saved = doc.serialize();
  assert.deepEqual(nativeChunks(saved), nativeChunks(original));
  assert.deepEqual(tabs(openDocument(saved, 'fixture.mdx')), tabs(doc));
});
