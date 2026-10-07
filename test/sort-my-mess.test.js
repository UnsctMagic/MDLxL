import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, openDocument, validateModel } from '../src/editor-document.js';
import { condenseExactResources, sortMyMessProposals, applySortMyMessProposal, commitSortMyMessModel } from '../src/sort-my-mess.js';
import { applyMaterialPreset, materialPreset } from '../src/material-presets.js';

const material = (TextureID = 0, FilterMode = 0, Alpha = 1) => ({ PriorityPlane: 0, RenderMode: 0, Layers: [{ TextureID, FilterMode, Alpha, Shading: 0, CoordId: 0, TVertexAnimId: null }] });
function fixture(count = 3) {
  const model = structuredClone(createDemoDocument().model), geo = model.Geosets[0];
  model.Textures = [{ Image: 'Skin.blp', ReplaceableId: 0, Flags: 0 }];
  model.Materials = Array.from({ length: count }, () => material());
  model.Geosets = Array.from({ length: count }, (_, i) => ({ ...structuredClone(geo), MaterialID: i }));
  model.GeosetAnims = [];
  model.RibbonEmitters = []; model.ParticleEmitters2 = [];
  return model;
}
const track = (values, LineType = 0) => ({ LineType, GlobalSeqId: null, Keys: values.map((value, i) => ({ Frame: i * 100, Vector: new Uint32Array([value]) })) });

test('exact resources collapse and every classic, animated, HD, emitter and ribbon reference resolves', () => {
  const model = fixture(2);
  model.Textures.push(structuredClone(model.Textures[0]), { Image: 'Other.blp', ReplaceableId: 0, Flags: 3 });
  for (const mat of model.Materials) Object.assign(mat.Layers[0], { TextureID: track([1, 2]), NormalTextureID: 1, ORMTextureID: 2, EmissiveTextureID: 1, TeamColorTextureID: 1, ReflectionsTextureID: 1, _MdxDefaults: { TextureID: 1 } });
  model.RibbonEmitters = [{ MaterialID: 0, Alpha: 1 }, { MaterialID: 1, Alpha: 1 }];
  model.ParticleEmitters2 = [{ TextureID: 1, _MdxDefaults: { TextureID: 2 } }];
  const geometry = structuredClone(model.Geosets.map(g => g.Vertices));
  assert.deepEqual(condenseExactResources(model), { textures: 1, materials: 1, textureIdsProtected: false });
  assert.deepEqual(model.Materials[0].Layers[0].TextureID.Keys.map(k => k.Vector[0]), [0, 1]);
  assert.equal(model.Materials[0].Layers[0]._MdxDefaults.TextureID, 0);
  assert.equal(model.Materials[0].Layers[0].NormalTextureID, 0);
  assert.equal(model.Materials[0].Layers[0].ORMTextureID, 1);
  assert.deepEqual(model.RibbonEmitters.map(n => n.MaterialID), [0, 0]);
  assert.equal(model.ParticleEmitters2[0].TextureID, 0);
  assert.equal(model.ParticleEmitters2[0]._MdxDefaults.TextureID, 1);
  assert.deepEqual(model.Geosets.map(g => g.Vertices), geometry);
  assert.deepEqual(condenseExactResources(model), { textures: 0, materials: 0, textureIdsProtected: false });
});

test('texture wrapping, layer order, repeated passes and unused records are preserved', () => {
  const model = fixture(3);
  model.Textures.push({ ...model.Textures[0], Flags: 3 });
  model.Materials[1].Layers[0].TextureID = 1;
  model.Materials[2].Layers.push(structuredClone(model.Materials[2].Layers[0]));
  const before = structuredClone(model);
  condenseExactResources(model);
  assert.deepEqual(model.Textures, before.Textures);
  assert.deepEqual(model.Materials, before.Materials);
  assert.equal(model.Materials[2].Layers.length, 2);
});

test('interpolated texture IDs retain their index domain', () => {
  const model = fixture(2); model.Textures.push(structuredClone(model.Textures[0]));
  model.Materials[0].Layers[0].TextureID = track([0, 1], 1);
  const before = structuredClone(model.Textures);
  assert.equal(condenseExactResources(model).textureIdsProtected, true);
  assert.deepEqual(model.Textures, before);
  assert.deepEqual(model.Materials[0].Layers[0].TextureID.Keys.map(k => k.Vector[0]), [0, 1]);
});

test('different alpha, alpha tracks, defaults and geoset visibility stay unique', () => {
  for (const change of [
    model => { model.Materials[1].Layers[0].Alpha = .5; },
    model => { model.Materials[1].Layers[0].Alpha = track([1, 0]); },
    model => { model.Materials[1].Layers[0]._MdxDefaults = { Alpha: .5 }; },
    model => { model.GeosetAnims = [{ GeosetId: 1, Flags: 0, Alpha: .5 }]; },
    model => { model.GeosetAnims = [{ GeosetId: 1, Flags: 0, Alpha: track([1, 0]), _MdxDefaults: { Alpha: 0 } }]; },
  ]) {
    const model = fixture(2); change(model); const before = structuredClone(model);
    assert.equal(condenseExactResources(model).materials, 0);
    assert.deepEqual(sortMyMessProposals(model), []);
    assert.deepEqual(model.Materials, before.Materials); assert.deepEqual(model.GeosetAnims, before.GeosetAnims);
  }
});

test('RGB recommendation keeps an existing central RGB and changes only approved geosets', () => {
  const model = fixture(4), rgb = [[1, 0, 0], [.8, .1, .1], [.7, .15, .15], [0, 0, 1]];
  model.Materials[3].Layers[0].Alpha = .5;
  model.GeosetAnims = rgb.map((Color, GeosetId) => ({ GeosetId, Alpha: 1, Flags: 2, Color: new Float32Array(Color) }));
  condenseExactResources(model);
  const proposal = sortMyMessProposals(model).find(item => item.kind === 'rgb');
  assert.deepEqual(proposal.geosetIds, [0, 1, 2]);
  assert.deepEqual(proposal.options[0].tint.Color, new Float32Array(rgb[1]));
  const untouched = structuredClone(model.GeosetAnims[3]);
  applySortMyMessProposal(model, proposal, 'closest');
  for (let i = 0; i < 3; i++) assert.deepEqual(model.GeosetAnims[i].Color, new Float32Array(rgb[1]));
  assert.deepEqual(model.GeosetAnims[3], untouched);
  assert.equal(sortMyMessProposals(model).some(item => item.kind === 'rgb'), false);
  assert.throws(() => applySortMyMessProposal(model, proposal, 'closest'), /changed/);
});

test('animated RGB carries its entire chosen track and static base, preserving alpha', () => {
  const model = fixture(2);
  const color = value => ({ LineType: 1, GlobalSeqId: 0, Keys: [0, 100].map(Frame => ({ Frame, Vector: new Float32Array(value) })) });
  model.GlobalSequences = [200];
  model.GeosetAnims = [0, 1].map(GeosetId => ({ GeosetId, Alpha: .7, Flags: 2, Color: color(GeosetId ? [.2, .3, .4] : [.8, .7, .6]), _MdxDefaults: { Alpha: .7, Color: new Float32Array([.1, .2, .3]) } }));
  const proposal = sortMyMessProposals(model).find(item => item.kind === 'rgb');
  const chosen = proposal.options[0].tint;
  applySortMyMessProposal(model, proposal, 'closest');
  for (const anim of model.GeosetAnims) { assert.deepEqual(anim.Color, chosen.Color); assert.deepEqual(anim._MdxDefaults.Color, chosen.base); assert.equal(anim.Alpha, .7); assert.equal(anim._MdxDefaults.Alpha, .7); }
});

test('team colour has both directions, uses existing layer order, and leaves team glow alone', () => {
  for (const choice of ['add', 'remove']) {
    const model = fixture(2); model.Textures.push({ Image: '', ReplaceableId: 1, Flags: 0 });
    model.Materials[1].Layers = [{ ...material(1).Layers[0], Shading: 1 }, material(0, 2).Layers[0]];
    const target = structuredClone(model.Materials[choice === 'add' ? 1 : 0]);
    const proposal = sortMyMessProposals(model).find(item => item.kind === 'team');
    assert.deepEqual(proposal.options.map(o => o.id), ['add', 'remove']);
    applySortMyMessProposal(model, proposal, choice);
    assert.equal(model.Materials.length, 1); assert.deepEqual(model.Materials[0], target);
    assert.deepEqual(model.Geosets.map(g => g.MaterialID), [0, 0]);
    assert.equal(sortMyMessProposals(model).length, 0);
  }
  const glow = fixture(2); glow.Textures.push({ Image: '', ReplaceableId: 2, Flags: 0 }); glow.Materials[1].Layers.unshift(material(1).Layers[0]);
  assert.equal(sortMyMessProposals(glow).some(p => p.kind === 'team'), false);
});

test('Blend/Modulate merge in either direction, preserving visibility and unrelated materials', () => {
  for (const targetId of [0, 1]) {
    const model = fixture(3); model.Materials[0].Layers[0].FilterMode = 2; model.Materials[1].Layers[0].FilterMode = 5; model.Materials[2].Layers[0].Alpha = .5;
    const target = structuredClone(model.Materials[targetId]), untouched = structuredClone(model.Materials[2]);
    const proposal = sortMyMessProposals(model).find(item => item.kind === 'render');
    assert.deepEqual(proposal.geosetIds, [0, 1]);
    applySortMyMessProposal(model, proposal, String(targetId));
    assert.equal(model.Materials.length, 2); assert.deepEqual(model.Materials[0], target); assert.deepEqual(model.Materials[1], untouched);
    assert.equal(sortMyMessProposals(model).length, 0);
  }
});

test('the existing Color Tint and Team Color Overlay presets condense through RGB and team choices', () => {
  const model = fixture(3);
  applyMaterialPreset(model, 0, 'Color Tint', 0); applyMaterialPreset(model, 1, 'Color Tint', 1); applyMaterialPreset(model, 2, 'Color Tint', 2);
  const rgb = sortMyMessProposals(model).find(item => item.kind === 'rgb');
  assert.deepEqual(rgb.geosetIds, [0, 1, 2]);
  const target = structuredClone(model.Materials[rgb.options[0].materialId]);
  applySortMyMessProposal(model, rgb, 'closest'); assert.equal(model.Materials.length, 1); assert.deepEqual(model.Materials[0], target);
  for (const choice of ['add', 'remove']) {
    const pair = fixture(2); applyMaterialPreset(pair, 0, 'Color Tint', 0); applyMaterialPreset(pair, 1, 'Team Color Overlay');
    const proposal = sortMyMessProposals(pair).find(item => item.kind === 'team');
    assert.ok(proposal); applySortMyMessProposal(pair, proposal, choice);
    assert.equal(pair.Materials.length, 1); assert.equal(materialPreset(pair, 0).preset, choice === 'add' ? 'Team Color Overlay' : 'Color Tint');
    assert.equal(pair.Materials[0].Layers[1].Alpha, .05);
  }
});

test('RGB approval saves and reopens in MDX and MDL with one undoable change', () => {
  const doc = createDemoDocument();
  doc.apply('prepare RGB', ['GeosetAnims'], model => { model.GeosetAnims.forEach((anim, i) => { if (i < 3) { anim.Alpha = 1; anim.Flags = 2; anim.Color = new Float32Array([[1,0,0],[.8,.1,.1],[.7,.15,.15]][i]); } }); });
  const before = doc.serialize('mdx'), working = structuredClone(doc.model); condenseExactResources(working);
  const rgb = sortMyMessProposals(working).find(item => item.kind === 'rgb'); assert.ok(rgb);
  applySortMyMessProposal(working, rgb, 'closest');
  doc.apply('Sort My Mess', ['GeosetAnims','Materials','Geosets'], model => { for (const section of ['GeosetAnims','Materials','Geosets']) model[section] = structuredClone(working[section]); });
  for (const format of ['mdx', 'mdl']) {
    const reopened = openDocument(doc.serialize(format), `sorted.${format}`);
    for (const id of rgb.geosetIds) assert.deepEqual(reopened.model.GeosetAnims.find(anim => anim.GeosetId === id).Color, rgb.options[0].tint.Color);
  }
  doc.undo(); assert.deepEqual(doc.serialize('mdx'), before); doc.redo();
  assert.deepEqual(doc.model.GeosetAnims[0].Color, rgb.options[0].tint.Color);
});

test('one document edit saves/reopens and undo/redo restores every resource and tint', () => {
  const doc = createDemoDocument();
  doc.apply('fixture', ['Materials', 'Textures', 'Geosets', 'GeosetAnims'], model => {
    const prepared = fixture(2); model.Materials = prepared.Materials; model.Textures = prepared.Textures; model.Geosets = prepared.Geosets; model.GeosetAnims = [];
    model.Textures.push(structuredClone(model.Textures[0])); model.Materials[1].Layers[0].TextureID = 1;
  });
  const before = doc.serialize('mdx');
  doc.apply('Sort My Mess', ['Materials', 'Textures', 'Geosets'], model => condenseExactResources(model));
  const after = doc.serialize('mdx'), reopened = openDocument(after, 'sorted.mdx');
  assert.equal(reopened.model.Materials.length, 1); assert.equal(reopened.model.Textures.length, 1);
  assert.equal(validateModel(reopened.model).filter(d => d.severity === 'error').length, 0);
  doc.undo(); assert.deepEqual(doc.serialize('mdx'), before);
  doc.redo(); assert.deepEqual(doc.serialize('mdx'), after);
});

test('commit preserves live node aliases, geometry and unrelated emitter defaults', () => {
  const model = fixture(2); model.Textures.push(structuredClone(model.Textures[0])); model.Materials[1].Layers[0].TextureID = 1;
  const emitter = { ObjectId: 10, TextureID: 1, Name: 'Dust', Alpha: .3, _MdxDefaults: { TextureID: 1, Visibility: .7 } }, ribbon = { ObjectId: 11, MaterialID: 1, Alpha: 1, Name: 'Trail' };
  model.ParticleEmitters2 = [emitter]; model.RibbonEmitters = [ribbon]; model.Nodes[10] = emitter; model.Nodes[11] = ribbon;
  const geometry = model.Geosets[0].Vertices, before = structuredClone(model), draft = structuredClone(model); condenseExactResources(draft); commitSortMyMessModel(model, draft);
  assert.equal(model.ParticleEmitters2[0], emitter); assert.equal(model.Nodes[10], emitter); assert.equal(model.RibbonEmitters[0], ribbon); assert.equal(model.Nodes[11], ribbon);
  assert.equal(model.Geosets[0].Vertices, geometry); assert.deepEqual(geometry, before.Geosets[0].Vertices);
  assert.equal(emitter.TextureID, 0); assert.equal(emitter._MdxDefaults.TextureID, 0); assert.equal(emitter._MdxDefaults.Visibility, .7); assert.equal(emitter.Alpha, .3); assert.equal(emitter.Name, 'Dust');
});
