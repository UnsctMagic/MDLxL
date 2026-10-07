import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createDemoDocument, deleteNode, openDocument, validateModel } from '../src/editor-document.js';
import { buildForgeMesh, commitForge } from '../src/forge.js';
import { commitPart, partTextureIndices, partTextureKey, previewPart } from '../src/bits-and-parts.js';
import { retainedForgeAssets } from '../src/forge-assets.js';
const require = createRequire(import.meta.url), { BitsAndPartsLibrary } = require('../electron/bits-and-parts.cjs'), { saveForgeAssets } = require('../electron/forge-assets.cjs');

const sword = () => structuredClone(createDemoDocument().model);
test('repeated imports reuse equivalent dependencies and the Forge anchor without changing earlier parts', () => {
  const doc = createDemoDocument(), source = sword(), counts = [doc.model.Textures.length, doc.model.Materials.length];
  const first = doc.apply('First part', [], model => commitPart(model, source));
  const earlier = structuredClone(doc.model.Geosets[first.geosetIndices[0]]);
  const second = doc.apply('Second part', [], model => commitPart(model, source));
  assert.deepEqual([doc.model.Textures.length, doc.model.Materials.length], counts);
  assert.equal(first.boneId, second.boneId); assert.equal(doc.model.Bones.filter(bone => bone.Name === 'DummyBone').length, 1);
  const after = structuredClone(doc.model.Geosets[first.geosetIndices[0]]);
  assert.deepEqual(after.Anims.slice(0, earlier.Anims.length), earlier.Anims);
  after.Anims = earlier.Anims; assert.deepEqual(after, earlier);
  const mesh = buildForgeMesh({ mask: new Uint8Array(4).fill(1), width: 2, height: 2 });
  const forged = doc.apply('Forge', [], model => commitForge(model, mesh, { texturePath: 'Textures\\White.blp' }));
  assert.equal(forged.boneId, first.boneId);
  assert.deepEqual(validateModel(doc.model).filter(issue => issue.severity === 'error'), []);
});
test('reassignment/deletion retains older bindings; preview does not create a destination bone', () => {
  const doc = createDemoDocument(), source = sword();
  const first = doc.apply('Part', [], model => commitPart(model, source));
  assert.throws(() => doc.apply('Delete bound bone', [], model => deleteNode(model, first.boneId)), /Reassign/);
  doc.apply('Reassign then delete', [], model => { for (const gi of first.geosetIndices) model.Geosets[gi].Groups = [[0]]; deleteNode(model, first.boneId); });
  previewPart(source); assert.equal(doc.model.Bones.filter(bone => bone.Name === 'DummyBone').length, 0);
  const replacement = doc.apply('Replacement', [], model => commitPart(model, source));
  assert.equal(replacement.boneId, first.boneId);
  assert.deepEqual(doc.model.Geosets[first.geosetIndices[0]].Groups, [[0]]);
});
test('texture animations and global references remap without changing the source', () => {
  const source = sword(), target = createDemoDocument().model;
  source.GlobalSequences = [1000]; source.TextureAnims = [{ Translation: { LineType: 1, GlobalSeqId: 0, Keys: [{ Frame: 0, Vector: new Float32Array([0, 0, 0]) }] } }];
  source.Materials[0].Layers[0].TVertexAnimId = 0;
  const before = structuredClone(source); commitPart(target, source);
  const counts = [target.Materials.length, target.TextureAnims.length, target.GlobalSequences.length];
  commitPart(target, source); assert.deepEqual([target.Materials.length, target.TextureAnims.length, target.GlobalSequences.length], counts);
  assert.deepEqual(source, before);
  assert.equal(partTextureKey({ Image: 'Textures/White.blp' }), partTextureKey({ Image: 'textures\\white.BLP', Flags: 0, ReplaceableId: 0 }));
  assert.ok(partTextureIndices(source).length);
});
test('library shows only MDL/MDX content in its original folders, filters asset-only folders, and prevents escaping', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlxl-parts-')); t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const library = new BitsAndPartsLibrary(path.join(directory, 'BitsAndParts'));
  assert.deepEqual((await library.list()).children, []);
  await fs.mkdir(path.join(library.directory, 'helms', 'horns'), { recursive: true });
  const bytes = createDemoDocument().serialize();
  for (const name of ['sword.MDL', 'root.mdx', 'helms/helm.mdx', 'helms/horns/horn.mdl']) await fs.writeFile(path.join(library.directory, name), bytes);
  await fs.writeFile(path.join(library.directory, 'notes.txt'), 'ignore');
  for (const folder of ['Textures/Collected UI Bit', 'UI/Glues/SinglePlayer/HumanCampaign3D', 'Units/Creeps/SkeletonOrc', 'helms/Textures']) {
    await fs.mkdir(path.join(library.directory, folder), { recursive: true });
    await fs.writeFile(path.join(library.directory, folder, 'skin.blp'), 'texture');
  }
  await fs.mkdir(path.join(library.directory, 'empty'), { recursive: true });
  const bank = await library.list(); assert.equal(bank.name, 'BitsAndParts'); assert.equal(bank.children.length, 3);
  assert.deepEqual(bank.children.map(entry => entry.name), ['helms', 'root.mdx', 'sword.MDL']);
  assert.deepEqual(bank.children[0].children.map(entry => entry.name), ['horns', 'helm.mdx']);
  assert.equal(bank.children[0].children[0].children[0].id, 'helms/horns/horn.mdl');
  assert.equal(await fs.readFile(path.join(library.directory, 'Textures/Collected UI Bit/skin.blp'), 'utf8'), 'texture');
  assert.equal((await library.read('sword.MDL')).name, 'sword.MDL');
  await assert.rejects(library.read('../outside.mdl'), /inside/); await assert.rejects(library.read('notes.txt'), /MDL or MDX/);
  assert.equal((await library.list()).children.length, 3);
});
test('original part textures participate in existing save and recovery retention without changing names or bytes', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlxl-parts-save-')); t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const asset = { name: 'Textures/My Bit/Original Skin.PNG', bytes: new Uint8Array([1, 2, 3]), source: 'parts' }, model = { Textures: [{ Image: asset.name }] };
  const assets = new Map([[asset.name.toLowerCase().replaceAll('/', '\\'), asset]]);
  assert.deepEqual(retainedForgeAssets(assets, model), [asset]);
  assert.deepEqual(retainedForgeAssets(assets), [asset]);
  await saveForgeAssets(path.join(directory, 'model.mdl'), retainedForgeAssets(assets, model)); assert.deepEqual(new Uint8Array(await fs.readFile(path.join(directory, asset.name))), asset.bytes);
  await assert.rejects(saveForgeAssets(path.join(directory, 'model.mdl'), [{ ...asset, bytes: new Uint8Array([4]) }]), /different texture/);
  await assert.rejects(saveForgeAssets(path.join(directory, 'model.mdl'), [{ ...asset, name: 'MDLxL_Parts\\..\\outside.tga' }]), /supported filename/);
});
