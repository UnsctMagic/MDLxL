import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStarterDocument } from '../src/starter-model.js';
import { createDemoDocument, openDocument, EditorDocument } from '../src/editor-document.js';
import { hdContentIssues, HD_VIEW_ONLY_MESSAGE } from '../src/model-version.js';

const MESSAGE = "HD models aren't supported yet. This model is open view-only; saving is disabled.";
// An SD 1000 starter that gains HD content. Save verification checks decoding
// only, so these are the same bytes an HD model from another tool would have.
function hdBytes(change, format = 'mdx') {
  const doc = createStarterDocument(1000);
  doc.apply('Add HD content', [], change);
  return doc.serialize(format);
}
const shader = model => { model.Materials[0].Shader = 'Shader_HD_DefaultUnit'; };
const skin = model => {
  const geoset = model.Geosets[0], root = model.Bones[0].ObjectId;
  geoset.SkinWeights = new Uint8Array(geoset.Vertices.length / 3 * 8);
  for (let vertex = 0; vertex < geoset.Vertices.length / 3; vertex++) geoset.SkinWeights.set([root, 0, 0, 0, 255, 0, 0, 0], vertex * 8);
};
const slotModel = slot => `Version { FormatVersion 1100, }
Model "slots" { BlendTime 150, }
Textures 2 { Bitmap { Image "Textures\\\\a.blp", } Bitmap { Image "Textures\\\\b.blp", } }
Materials 1 { Material { Layer { FilterMode None, static TextureID 0,${slot ? ` static TextureID 1 <= ${slot},` : ''} } } }`;

function assertViewOnly(doc) {
  assert.equal(doc.readOnly, true); assert.equal(doc.hdViewOnly, true);
  assert.ok(doc.diagnostics.some(item => item.code === 'HD_VIEW_ONLY' && item.message === MESSAGE));
  assert.throws(() => doc.apply('Edit', ['Info'], model => { model.Info.Name = 'changed'; }), /read-only/);
  assert.equal(doc.saveImpact().canSave, false);
  for (const format of ['mdx', 'mdl']) assert.throws(() => doc.serialize(format), error => error.message === MESSAGE);
  // Save goes through a recovery snapshot in a worker; that path stays blocked too.
  assert.throws(() => EditorDocument.restoreRecoveryState(doc.captureRecoveryState({ includeHistory: false })).serialize(), error => error.message === MESSAGE);
}

test('the view-only message is the user-facing text', () => assert.equal(HD_VIEW_ONLY_MESSAGE, MESSAGE));

test('an HD shader material opens view-only with its model still decoded for viewing', () => {
  for (const format of ['mdx', 'mdl']) {
    const doc = openDocument(hdBytes(shader, format), `hd.${format}`);
    assertViewOnly(doc);
    assert.equal(doc.model.Materials[0].Shader, 'Shader_HD_DefaultUnit');
    assert.ok(doc.model.Geosets[0].Vertices.length > 0);
  }
});

test('an HD texture slot opens view-only regardless of shader', () => {
  assert.equal(openDocument(slotModel(0), 'sd.mdl').readOnly, false);
  for (const [slot, key] of [[1, 'NormalTextureID'], [2, 'ORMTextureID'], [3, 'EmissiveTextureID'], [4, 'TeamColorTextureID'], [5, 'ReflectionsTextureID']]) {
    const doc = openDocument(slotModel(slot), 'hd.mdl');
    assertViewOnly(doc);
    assert.equal(doc.model.Materials[0].Layers[0][key], 1);
  }
});

test('weighted skin opens view-only', () => {
  for (const format of ['mdx', 'mdl']) {
    const doc = openDocument(hdBytes(skin, format), `skin.${format}`);
    assertViewOnly(doc);
    assert.equal(doc.model.Geosets[0].SkinWeights.length, doc.model.Geosets[0].Vertices.length / 3 * 8);
  }
});

test('HD detection follows the Reforged-only content that blocks downgrade', () => {
  // A reopened SD 1000 file carries default lighting values and an empty shader.
  const model = openDocument(createStarterDocument(1000).serialize('mdx'), 'sd.mdx').model;
  assert.equal(model.Materials[0].Shader, ''); assert.equal(model.Materials[0].Layers[0].EmissiveGain, 1);
  assert.deepEqual(hdContentIssues(model), []);
  for (const [key, value] of [['ShaderTypeId', 1], ['EmissiveGain', 0.5], ['FresnelOpacity', 1], ['FresnelColor', new Float32Array([1, 0, 0])]]) {
    const copy = structuredClone(model); copy.Materials[0].Layers[0][key] = value;
    assert.notDeepEqual(hdContentIssues(copy), [], key);
  }
});

test('SD 800 and SD 1000 models stay editable and round-trip exactly as before', () => {
  for (const version of [800, 1000]) for (const format of ['mdx', 'mdl']) {
    const doc = openDocument(createStarterDocument(version).serialize(format), `sd.${format}`);
    assert.equal(doc.readOnly, false); assert.equal(doc.hdViewOnly, false);
    assert.equal(doc.diagnostics.some(item => item.code === 'HD_VIEW_ONLY'), false);
    assert.deepEqual(Buffer.from(doc.serialize(format)), Buffer.from(doc.originalBytes));
    doc.apply('Rename', ['Info'], model => { model.Info.Name = 'Edited'; });
    const reopened = openDocument(doc.serialize(format), `edited.${format}`);
    assert.equal(reopened.readOnly, false); assert.equal(reopened.version, version); assert.equal(reopened.model.Info.Name, 'Edited');
  }
});

test('built-in demo, starter and converted models are never HD', () => {
  const converted = createDemoDocument(); converted.convertVersion(1000);
  for (const doc of [createDemoDocument(), createStarterDocument(800), createStarterDocument(1000), converted]) {
    assert.deepEqual(hdContentIssues(doc.model), []);
    for (const format of ['mdx', 'mdl']) assert.equal(openDocument(doc.serialize(format), `x.${format}`).readOnly, false);
  }
  for (const name of ['demo.mdx', 'demo.mdl']) assert.equal(openDocument(readFileSync(new URL(`../fixtures/${name}`, import.meta.url)), name).readOnly, false);
});
