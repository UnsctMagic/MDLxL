import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { createResourceImporter } from '../src/model-import.js';
import { omitEmptyMdxNodeTracks } from '../src/mdx-compatibility.js';
import { createDemoDocument, createNode, openDocument, importGeosets } from '../src/editor-document.js';
import { captureNodeSelection, pasteNodesToDummy } from '../src/node-clipboard.js';
import { commitPart } from '../src/bits-and-parts.js';
import { extractParticleRecipe, copyEffectGraph, placeParticleRecipe } from '../src/particle-recipes.js';
import { CascReader } from '../electron/casc.cjs';
import { tempDir, gameFolder } from './helpers/fixtures.cjs';
import { importGeosets as beforeGeosets } from './fixtures/model-import-baseline/editor-document.js';
import { pasteNodesToDummy as beforeNodes } from './fixtures/model-import-baseline/node-clipboard.js';
import { commitPart as beforePart } from './fixtures/model-import-baseline/bits-and-parts.js';
import { extractParticleRecipe as beforeExtract, copyEffectGraph as beforeGraph, placeParticleRecipe as beforeParticle } from './fixtures/model-import-baseline/particle-recipes.js';

const roundTrips = { mdx: 0, mdl: 0 };
const clone = value => structuredClone(value), v = (...values) => new Float32Array(values);
const track = (values, GlobalSeqId = null) => ({ LineType: 3, GlobalSeqId, Keys: [0, 1000].map(Frame => ({ Frame, Vector: v(...values), InTan: v(...values), OutTan: v(...values) })) });

// Add the same dependency graph to both real inputs: a parent chain, emitter,
// ribbon, all texture-ID key fields/defaults, UV animation and repeated globals.
// Raw inputs are also tested for geoset, node and part imports.
function withResources(input) {
  const model = clone(input), root = createNode(model, 'Helper'), child = createNode(model, 'Helper');
  root.Name = 'Import root'; child.Name = 'Import child'; child.Parent = root.ObjectId;
  model.GlobalSequences.push(1000, 1000);
  const global = model.GlobalSequences.length - 1;
  root.Translation = track([0, 0, 2], global);
  child.Translation = track([1, 0, 0]);
  root.Rotation = { LineType: 1, GlobalSeqId: null, Keys: [] };
  child.Scaling = { LineType: 1, GlobalSeqId: null, Keys: [] };
  const textureId = model.Textures.push({ Image: 'Textures/Importer.blp', ReplaceableId: 0, Flags: 3 }) - 1;
  model.Textures.push({ Flags: 3, Image: 'textures\\importer.BLP', ReplaceableId: 0 });
  const animationId = model.TextureAnims.push({ Translation: track([0, 0, 0], global), Scaling: track([1, 1, 1]) }) - 1;
  const layer = { FilterMode: 0, Shading: 16, CoordId: 0, Alpha: track([1], global), TextureID: track([textureId]), TVertexAnimId: animationId, _MdxDefaults: { TextureID: textureId } };
  const materialId = model.Materials.push({ PriorityPlane: 0, RenderMode: 0, Layers: [layer] }) - 1;
  model.Geosets[0].MaterialID = materialId;
  const emitter = createNode(model, 'ParticleEmitter2'); emitter.Parent = child.ObjectId; emitter.TextureID = textureId;
  emitter.EmissionRate = track([10], global);
  const ribbon = createNode(model, 'RibbonEmitter'); ribbon.Parent = child.ObjectId; ribbon.MaterialID = materialId; ribbon.HeightAbove = track([4]);
  model.Geosets[0].Groups = [[child.ObjectId]];
  model.Geosets[0].VertexGroup.fill(0); model.Geosets[0].TotalGroupsCount = 1;
  return model;
}

function compare(before, after, source, target, invoke, label, roundTrip = true) {
  const original = clone(source), left = clone(target), right = clone(target);
  const leftSource = clone(source), rightSource = clone(source);
  const oldResult = invoke(before, left, leftSource), newResult = invoke(after, right, rightSource);
  assert.deepStrictEqual(clone(right), clone(left), `${label}: entire model`);
  assert.deepStrictEqual(clone(newResult), clone(oldResult), `${label}: returned maps/IDs`);
  assert.deepStrictEqual(leftSource, original, `${label}: baseline source unchanged`);
  assert.deepStrictEqual(rightSource, original, `${label}: source unchanged`);
  if (!roundTrip) return;
  const saveDocument = model => {
    const doc = openDocument(`Version { FormatVersion ${model.Version}, }\nModel \"Identity\" { BlendTime 150, }`, 'identity.mdl');
    doc.apply('Import', Object.keys(model), target => Object.assign(target, clone(model)));
    return doc;
  };
  for (const format of ['mdx', 'mdl']) {
    const a = saveDocument(left), b = saveDocument(right);
    const oldBytes = a.serialize(format), newBytes = b.serialize(format);
    if (format === 'mdx') assert.deepStrictEqual(omitEmptyMdxNodeTracks(Buffer.from(newBytes)), Buffer.from(newBytes), `${label}: no empty MDX node tracks`);
    roundTrips[format]++;
    assert.deepStrictEqual(newBytes, oldBytes, `${label}: ${format} bytes`);
    assert.deepStrictEqual(clone(openDocument(newBytes, `after.${format}`).model), clone(openDocument(oldBytes, `before.${format}`).model), `${label}: ${format} reopened model`);
  }
}

async function callerTests(t, input) {
  await t.test('importGeosets', () => {
    for (const source of [input, withResources(input)]) {
      const options = [{}, { sameModel: true }, { rigidNode: source.Bones[0].ObjectId }, { flattenGeosetAnimations: true }, { sameModel: true, newGeosets: true }];
      for (const option of options) compare(beforeGeosets, importGeosets, source, source, (fn, target, donor) => fn(target, donor, [0], null, option), JSON.stringify(option), Object.keys(option).length === 0);
      compare(beforeGeosets, importGeosets, source, source, (fn, target, donor) => { fn(target, donor); return fn(target, donor); }, 'repeat all geosets', false);
    }
  });
  await t.test('node clipboard paste', () => {
    for (const source of [input, withResources(input)]) compare(beforeNodes, pasteNodesToDummy, source, source, (fn, target, donor) => {
      const ids = donor.Nodes.filter(Boolean).map(node => node.ObjectId).reverse();
      const clipboard = captureNodeSelection(donor, ids);
      fn(target, clipboard); return fn(target, clipboard);
    }, 'reversed selection, repeated paste');
  });
  await t.test('bits-and-parts import', () => {
    for (const source of [input, withResources(input)]) {
      for (const options of [{}, { replacement: { 0: [0, 1, 2] } }, { rgbSequence: 0 }, { animations: [{ sequenceIndex: 0, name: 'Imported stand' }] }]) {
        compare(beforePart, commitPart, source, source, (fn, target, donor) => { fn(target, donor, options); return fn(target, donor, options); }, JSON.stringify(options), Object.keys(options).length === 0);
      }
    }
  });
  await t.test('particle recipe placement', () => {
    const source = withResources(input), ids = [source.RibbonEmitters.at(-1).ObjectId, source.ParticleEmitters2.at(-1).ObjectId];
    const recipe = beforeExtract(source, ids, { id: 'import-identity', name: 'Import identity' });
    assert.deepStrictEqual(extractParticleRecipe(source, ids, { id: 'import-identity', name: 'Import identity' }), recipe, 'extraction also preserves its dependency graph');
    for (const options of [{}, { directAttachment: true, parent: source.Bones[0].ObjectId }, { sourceInterval: [0, 1000], targetInterval: [3000, 5000], fit: true }, { motion: 'target', position: [1, 2, 3] }]) {
      compare(beforeParticle, placeParticleRecipe, recipe, source, (fn, target, donor) => { fn(target, donor, options); return fn(target, donor, options); }, JSON.stringify(options));
    }
  });
}

test('WP-3.3 origin/main identity: demo model', async t => callerTests(t, createDemoDocument().model));

test('WP-3.3 origin/main identity: CASC Footman', async t => {
  const game = await gameFolder();
  if (!fs.existsSync(path.join(game, '.build.info'))) { t.skip('Requires a local Warcraft III CASC installation'); return; }
  const directory = tempDir('model-import-casc-'), reader = new CascReader(game, directory);
  try {
    const bytes = await reader.read('war3.w3mod:units\\human\\footman\\footman.mdx');
    assert.ok(bytes, 'CASC must contain Footman');
    t.diagnostic(`CASC Footman SHA256 ${createHash('sha256').update(bytes).digest('hex')}`);
    await callerTests(t, openDocument(bytes, 'Footman.mdx').model);
  } finally {
    if (reader.process.exitCode === null && reader.process.signalCode === null) {
      const exited = once(reader.process, 'exit'); reader.close(); await exited;
    }
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
// Compare both failures and partial mutation: these paths intentionally disagree
// about duration validity and even about whether a non-integer ID is global.
const callers = [
  ['geosets', beforeGeosets, importGeosets, (fn, target, source) => fn(target, source, [0])],
  ['nodes', beforeNodes, pasteNodesToDummy, (fn, target, source) => fn(target, captureNodeSelection(source, source.Nodes.filter(Boolean).map(node => node.ObjectId)))],
  ['parts', beforePart, commitPart, (fn, target, source) => fn(target, source)],
  ['particles', beforeGraph, copyEffectGraph, (fn, target, source) => fn(target, source, [source.RibbonEmitters.at(-1).ObjectId, source.ParticleEmitters2.at(-1).ObjectId])],
];
for (const [name, before, after, invoke] of callers) test(`WP-3.3 ${name}: global validity, resource errors and hierarchy policies match main`, () => {
  const base = withResources(createDemoDocument().model);
  const compareOutcome = (source, label) => {
    const run = fn => {
      const target = createDemoDocument().model;
      try { return { result: invoke(fn, target, clone(source)), target }; }
      catch (error) { return { error: { name: error.name, message: error.message }, target }; }
    };
    assert.deepStrictEqual(clone(run(after)), clone(run(before)), label);
  };
  for (const id of [0, 1, -2, -1, null, undefined, 0.5, '0', NaN]) for (const duration of [1000, 0, -1, 2.5, undefined, NaN, Infinity]) {
    const source = clone(base), old = source.GlobalSequences.length - 1;
    const visit = value => {
      if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return;
      if (value.GlobalSeqId === old) value.GlobalSeqId = id;
      for (const child of Object.values(value)) visit(child);
    };
    visit(source); source.GlobalSequences = [duration];
    compareOutcome(source, `id=${String(id)}, duration=${String(duration)}`);
  }
  for (const missing of ['Textures', 'Materials', 'TextureAnims']) { const source = clone(base); source[missing] = []; compareOutcome(source, missing); }
  const cycle = clone(base), root = cycle.Helpers.at(-2), child = cycle.Helpers.at(-1); root.Parent = child.ObjectId;
  compareOutcome(cycle, 'cycle');
  const missingParent = clone(base); missingParent.Helpers.at(-2).Parent = 999999; compareOutcome(missingParent, 'missing parent');
});

test.after(() => {
  console.log('WP-3.3 successful save/reopen comparisons:', roundTrips);
});

test('resource importer preserves or converts texture-ID array constructors as requested', () => {
  for (const keyArrayType of ['keep', 'int32']) {
    const source = {
      Textures: [{ Image: 'a.blp' }, { Image: 'b.blp' }],
      Materials: [{ Layers: [{ TextureID: { Keys: [{ Vector: new Float32Array([0]), InTan: new Uint32Array([1]), OutTan: [0] }] } }] }],
    }, target = { Textures: [{ Image: 'existing.blp' }], Materials: [], TextureAnims: [], GlobalSequences: [] };
    createResourceImporter(source, target, { reuseTextures: 'never', reuseGlobals: false, keyArrayType }).materialRef(0);
    const key = target.Materials[0].Layers[0].TextureID.Keys[0];
    assert.deepStrictEqual(Array.from(key.Vector), [1]);
    assert.deepStrictEqual(Array.from(key.InTan), [2]);
    assert.deepStrictEqual(Array.from(key.OutTan), [1]);
    assert.equal(key.Vector.constructor, keyArrayType === 'keep' ? Float32Array : Int32Array);
    assert.equal(key.InTan.constructor, keyArrayType === 'keep' ? Uint32Array : Int32Array);
    assert.equal(key.OutTan.constructor, keyArrayType === 'keep' ? Array : Int32Array);
  }
});
