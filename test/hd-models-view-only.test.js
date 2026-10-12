import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStarterDocument } from '../src/starter-model.js';
import { createDemoDocument, openDocument, EditorDocument } from '../src/editor-document.js';
import { hdContentIssues, hdContentKind, HD_VIEW_ONLY_MESSAGE, HD_CONVERT_NOTICE } from '../src/model-version.js';
import { captureMeshSelection } from '../src/mesh-clipboard.js';
import { prepareClipboardPaste } from '../src/clipboard-paste.js';
import { createStarterRecipe } from '../src/particle-starters.js';
import { placeParticleRecipe } from '../src/particle-recipes.js';

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

// Owner decision: only a shader name or HD lighting values is "borderline" and
// may be converted to SD; HD textures or skin weights stay view-only.
test('borderline HD is split from real HD textures and skin weights', () => {
  const sd = openDocument(createStarterDocument(1000).serialize('mdx'), 'sd.mdx').model;
  assert.equal(hdContentKind(sd), null);
  const variant = change => { const copy = structuredClone(sd); change(copy); return hdContentKind(copy); };
  assert.equal(variant(shader), 'borderline');
  assert.equal(variant(model => { model.Materials[0].Layers[0].EmissiveGain = 0.5; }), 'borderline');
  assert.equal(variant(model => { model.Materials[0].Layers[0].ShaderTypeId = 1; }), 'borderline');
  // Before 1100, a Shader_HD material carries its normal/ORM/emissive maps as extra layers.
  assert.equal(variant(model => { shader(model); model.Materials[0].Layers.push(structuredClone(model.Materials[0].Layers[0])); }), 'hd');
  assert.equal(variant(model => { model.Materials[0].Layers[0].NormalTextureID = 0; }), 'hd');
  assert.equal(variant(skin), 'hd');
  for (const format of ['mdx', 'mdl']) {
    assert.equal(openDocument(hdBytes(shader, format), `b.${format}`).hdBorderline, true);
    const real = openDocument(hdBytes(skin, format), `s.${format}`);
    assert.equal(real.hdBorderline, false); assert.throws(() => real.convertToSD(), error => error.message === MESSAGE);
  }
  assert.equal(openDocument(slotModel(1), 'slot.mdl').hdBorderline, false);
});

test('borderline view-only keeps the file exact; Convert to SD gives an editable SD model that saves', () => {
  const lighting = model => { shader(model); Object.assign(model.Materials[0].Layers[0], { EmissiveGain: 0.4, FresnelOpacity: 0.5, FresnelColor: new Float32Array([1, 0, 0]) }); };
  for (const format of ['mdx', 'mdl']) {
    const bytes = hdBytes(lighting, format), doc = openDocument(bytes, `b.${format}`), before = structuredClone(doc.model);
    assertViewOnly(doc);
    assert.deepEqual(Buffer.from(doc.originalBytes), Buffer.from(bytes));
    const converted = doc.convertToSD();
    assert.deepEqual(doc.model, before, 'choosing view-only or converting never changes the open view-only document');
    assert.equal(converted.readOnly, false); assert.equal(converted.hdViewOnly, false); assert.equal(converted.dirty, true);
    assert.deepEqual(hdContentIssues(converted.model), []);
    assert.equal(converted.canUndo, false, 'the conversion is the starting point, not an undoable edit');
    // The save worker restores a snapshot first; the converted model must stay editable there.
    const worker = EditorDocument.restoreRecoveryState(converted.captureRecoveryState({ includeHistory: false }));
    for (const saved of [converted.serialize(format), worker.serialize(format)]) {
      const reopened = openDocument(saved, `sd.${format}`);
      assert.equal(reopened.readOnly, false); assert.deepEqual(hdContentIssues(reopened.model), []);
      assert.deepEqual(reopened.model.Geosets[0].Vertices, before.Geosets[0].Vertices);
    }
  }
});

test('paste and special paste from an HD model give an SD model the SD version of the content', () => {
  const sourceDoc = openDocument(hdBytes(model => { shader(model); skin(model); }), 'hd.mdx', { allowHD: true });
  for (const special of [false, true]) {
    const target = createStarterDocument(1000), clipboard = captureMeshSelection(sourceDoc.model, {}, new Set([0]));
    const plan = prepareClipboardPaste(target.model, clipboard, { special });
    assert.ok(plan.repairs.includes(HD_CONVERT_NOTICE), plan.repairs.join('\n'));
    target.apply('Fix and paste', [], model => { Object.assign(model, plan.model); return plan.result; });
    assert.deepEqual(hdContentIssues(target.model), []);
    for (const format of ['mdx', 'mdl']) assert.equal(openDocument(target.serialize(format), `pasted.${format}`).readOnly, false);
  }
  // Material-only HD content is converted too.
  const materialOnly = openDocument(hdBytes(shader), 'shader.mdx', { allowHD: true }), target = createStarterDocument(1000);
  const plan = prepareClipboardPaste(target.model, captureMeshSelection(materialOnly.model, {}, new Set([0])));
  assert.ok(plan.repairs.includes(HD_CONVERT_NOTICE)); assert.deepEqual(hdContentIssues(plan.model), []);
  // SD into SD is unchanged: no HD repair.
  assert.equal(prepareClipboardPaste(target.model, captureMeshSelection(createStarterDocument(1000).model, {}, new Set([0]))).repairs.includes(HD_CONVERT_NOTICE), false);
});

test('placing a particle preset with an HD material into an SD model places an SD copy', () => {
  const recipe = createStarterRecipe('ribbon');
  recipe.native.Version = 1000; recipe.native.Materials[0].Shader = 'Shader_HD_DefaultUnit'; recipe.native.Materials[0].Layers[0].EmissiveGain = 0.4;
  const target = createStarterDocument(1000);
  let result;
  target.apply('Add effect', ['Nodes', 'Textures', 'Materials', 'TextureAnims', 'GlobalSequences', 'PivotPoints'], model => { result = placeParticleRecipe(model, recipe, { position: [0, 0, 0], convertHD: true }); });
  assert.equal(result.convertedHD, true); assert.deepEqual(hdContentIssues(target.model), []);
  assert.equal(target.model.RibbonEmitters.length, 1);
  for (const format of ['mdx', 'mdl']) assert.equal(openDocument(target.serialize(format), `effect.${format}`).readOnly, false);
  // Without the option (Particle Lab, inspection), the preset is placed unchanged.
  const lab = structuredClone(createStarterDocument(1000).model);
  assert.equal(placeParticleRecipe(lab, recipe, { position: [0, 0, 0] }).convertedHD, false);
  assert.equal(lab.Materials.at(-1).Shader, 'Shader_HD_DefaultUnit');
});

// App popups are checked at source level, like the other App.jsx tests: mounting
// the editor needs WebGL. The popup reuses the app's in-app Dialog.
test('HD popups reuse the in-app dialog on open and on save, with view-only and Convert to SD choices', () => {
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const inspector = readFileSync(new URL('../app/Inspectors.jsx', import.meta.url), 'utf8');
  assert.match(app, /\{notice && <Dialog title="HD models"[^\n]*>Open view-only<\/button>[^\n]*>Convert to SD<\/button>[^\n]*>OK<\/button>/);
  assert.match(app, /function install\([\s\S]*?if \(next\.doc\.hdViewOnly\) setNotice\(next\.doc\.hdBorderline \? \{ message: HD_BORDERLINE_MESSAGE, convert: next \} : \{ message: HD_VIEW_ONLY_MESSAGE \}\);/);
  assert.doesNotMatch(app.match(/function activateSession\([\s\S]*?\n  \}/)[0], /setNotice/, 'switching tabs does not repeat the popup');
  assert.match(app, /async function save\([^\n]*\n[^\n]*\n    if \(target\.doc\.hdViewOnly\) \{ say\(HD_VIEW_ONLY_MESSAGE, true\); setNotice\(\{ message: HD_VIEW_ONLY_MESSAGE \}\); return false; \}/);
  assert.match(app, /saveAs: \(\) => mode==='paint'\?savePaintProject\(\):doc\.hdViewOnly\?save\(true\)/);
  assert.match(inspector, /onChange=\{v=>setShader\(mat,v\)\}/);
  assert.match(inspector, /detail:HD_SHADER_MESSAGE/);
});
