import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildForgeMesh, commitForge } from '../src/forge.js';
import { buildForgePrimitive } from '../src/forge-primitives.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { addClayPreviewMaterials, clayColors, FORGE_ITEM_KEY, forgeSaveBlock, NO_MATERIAL, unfinishedForgeItems } from '../src/forge-clay.js';
import { applyUVPreviews, getUVPreviewSelection } from '../src/uv-preview.js';

const source = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const forge = (doc, mesh, name) => doc.apply('Forge item', [], model => commitForge(model, mesh, { name }));

test('Forge items add geometry only: no texture, no material and no trim colour', () => {
  const doc = createDemoDocument(), before = structuredClone(doc.model);
  const mesh = buildForgeMesh({ width: 16, height: 16, mask: new Uint8Array(256).fill(1), detail: 35, thickness: 1, trim: true });
  const result = forge(doc, mesh, 'Shield');
  assert.equal(result.textureId, null);
  assert.deepEqual(doc.model.Textures, before.Textures);
  assert.deepEqual(doc.model.Materials, before.Materials);
  assert.equal(doc.model.GeosetAnims.length, before.GeosetAnims.length, 'the trim gets no colour track of its own');
  assert.deepEqual(result.geosetIndices.map(i => [doc.model.Geosets[i].MaterialID, doc.model.Geosets[i][FORGE_ITEM_KEY]]), [[NO_MATERIAL, 'Shield'], [NO_MATERIAL, 'Shield trim']]);
  doc.undo(); assert.deepEqual(doc.model, before);
});

test('several clay items show different colours without changing the model', () => {
  const doc = createDemoDocument();
  for (const name of ['Cube', 'Torus', 'ThumperXL']) forge(doc, buildForgePrimitive({ shape: name }), name);
  const before = structuredClone(doc.model), colors = clayColors(doc.model);
  assert.equal(colors.size, 3);
  assert.equal(new Set(colors.values()).size, 3, 'each item is told apart by its colour');
  assert.deepEqual(doc.model, before, 'the clay look is display only');
  // The game preview gets a one-colour material on its private copy only.
  const clone = structuredClone(doc.model), pixels = addClayPreviewMaterials(clone);
  assert.equal(pixels.size, 3);
  for (const index of colors.keys()) assert.ok(clone.Materials[clone.Geosets[index].MaterialID], 'the preview copy can render the item');
  assert.deepEqual(doc.model, before);
});

test('the preview copy of a weighted (HD) model gets complete HD clay materials', () => {
  const model = { Version: 1000, Textures: [], Materials: [], Geosets: [{ MaterialID: NO_MATERIAL, SkinWeights: new Uint8Array(8) }] };
  addClayPreviewMaterials(model);
  const material = model.Materials[model.Geosets[0].MaterialID];
  assert.equal(material.Shader, 'Shader_HD_DefaultUnit');
  assert.equal(material.Layers.length, 4);
  assert.ok(material.Layers.every(layer => model.Textures[layer.TextureID]));
});

test('saving waits, naming the items, until each Forge item has a material and texture', () => {
  const doc = createDemoDocument();
  assert.equal(forgeSaveBlock(doc.model), '');
  const [cube] = forge(doc, buildForgePrimitive({ shape: 'Cube' }), 'Cube').geosetIndices;
  const [torus] = forge(doc, buildForgePrimitive({ shape: 'Torus' }), 'Torus').geosetIndices;
  assert.equal(forgeSaveBlock(doc.model), `Give these Forge items a material and texture before saving: Cube (geoset ${cube + 1}), Torus (geoset ${torus + 1}).`);
  // The Geoset inspector's Material list assigns an existing material.
  doc.apply('Assign material', ['Geosets'], model => { model.Geosets[cube].MaterialID = 0; });
  assert.deepEqual(unfinishedForgeItems(doc.model).map(item => item.name), ['Torus']);
  assert.match(forgeSaveBlock(doc.model), /^Give this Forge item .*Torus/);
  // The Texture library's Preview Texture in Editor, then Save, gives one too.
  assert.equal(getUVPreviewSelection(doc.model, [torus]).enabled, true);
  doc.apply('Save UV texture previews', ['Geosets', 'Textures', 'Materials'], model => applyUVPreviews(model, { [torus]: { geosetIndex: torus, asset: { name: 'Textures\\white.blp', bytes: new Uint8Array(1) } } }));
  assert.equal(forgeSaveBlock(doc.model), '');
  const material = doc.model.Materials[doc.model.Geosets[torus].MaterialID];
  assert.equal(material.Layers.length, 1);
  assert.equal(doc.model.Textures[material.Layers[0].TextureID].Image, 'Textures\\white.blp');
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format));
    assert.equal(reopened.diagnostics.filter(d => d.severity === 'error').length, 0);
    assert.ok(reopened.model.Geosets.every(g => !(FORGE_ITEM_KEY in g)), 'the Forge marker is editor-only');
  }
});

test('only Forge items may preview a texture without a material', () => {
  const doc = createDemoDocument();
  doc.model.Geosets[0].MaterialID = 99;
  assert.equal(getUVPreviewSelection(doc.model, [0]).enabled, false);
});

test('Forge windows and the app add no textures and gate saving', () => {
  const forgeWindow = source('../app/Forge.jsx'), shapes = source('../app/ForgeShapes.jsx'), app = source('../app/App.jsx');
  assert.doesNotMatch(forgeWindow, /encodeForgeTga|MDLxL_Forge|texturePath/);
  assert.doesNotMatch(shapes, /BTNTemp|PRIMITIVE_TEXTURE|THUMPER_TEXTURE|thumperImage|encodeForgeTga/);
  assert.doesNotMatch(source('../src/forge-primitives.js'), /BTNTemp/);
  assert.doesNotMatch(source('../src/forge-thumper.js'), /thumperxl-v1|THUMPER_TEXTURE/);
  const forgeItem = app.slice(app.indexOf('async function forgeItem'), app.indexOf('function applyGeosetDensity'));
  assert.doesNotMatch(forgeItem, /white\.blp|loadTextures|texturePath/);
  const save = app.slice(app.indexOf('async function save('));
  assert.ok(save.indexOf('forgeSaveBlock(staged.model)') > 0 && save.indexOf('forgeSaveBlock(staged.model)') < save.indexOf('prepareModelSaveAsync('), 'the save stops before anything is written');
  assert.match(source('../app/Viewport.jsx'), /clayColors\(model\)/);
  assert.match(source('../app/GamePreview.jsx'), /addClayPreviewMaterials\(ownedModel\)/);
});
