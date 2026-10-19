import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createDemoDocument, openDocument, validateModel } from '../src/editor-document.js';
import { sortMyMessInventory, applySortMyMess, decisionChanges, describeSortMyMessChanges, verifySortMyMess, visibilityFacts, visibilityText, visibilitySummary, visibilitySummaryText, unionVisibilityOverrides, rgbFacts, materialFacts } from '../src/sort-my-mess.js';

const layer = (TextureID, FilterMode = 0, Shading = 16) => ({ TextureID, FilterMode, Shading, Alpha: 1, CoordId: 0, TVertexAnimId: null });
const material = (...layers) => ({ PriorityPlane: 0, RenderMode: 0, Layers: layers });
const steps = (...pairs) => ({ LineType: 0, GlobalSeqId: null, Keys: pairs.map(([Frame, value]) => ({ Frame, Vector: new Float32Array([value]) })) });
const anim = (GeosetId, extra = {}) => ({ GeosetId, Alpha: 1, Flags: 0, Color: new Float32Array([1, 1, 1]), ...extra });
const tris = geoset => geoset.Faces.length / 3;

// Five demo prisms with Stand, Death and Portrait. Every part uses Tinker.blp
// unless a test reassigns materials.
function fixture() {
  const model = structuredClone(createDemoDocument().model), extent = model.Sequences[0];
  model.Sequences = [['Stand', 0, 1000], ['Death', 1100, 2000], ['Portrait', 2100, 3000]].map(([Name, start, end]) => ({ ...structuredClone(extent), Name, Interval: new Uint32Array([start, end]) }));
  for (const geoset of model.Geosets) geoset.Anims = model.Sequences.map(() => structuredClone(geoset.Anims[0]));
  model.Textures = [{ Image: 'Units\\Human\\Tinker\\Tinker.blp', ReplaceableId: 0, Flags: 0 }];
  model.Materials = model.Geosets.map(() => material(layer(0)));
  model.Geosets.forEach((geoset, i) => { geoset.MaterialID = i; });
  model.GeosetAnims = model.Geosets.map((_, i) => anim(i));
  model.RibbonEmitters = []; model.ParticleEmitters2 = [];
  return model;
}
const groupNamed = (model, name) => sortMyMessInventory(model).groups.find(group => group.name === name);
const decide = (group, decision) => ({ geosets: group.geosets, actions: {}, results: {}, ...decision });

test('groups by recognizable texture name across repeated imports; mixed and team-color layers are told apart', () => {
  const model = fixture();
  model.Textures.push({ Image: 'units/human/tinker/TINKER.blp', ReplaceableId: 0, Flags: 0 }, { Image: 'TerrainArt\\Felwood\\Felwood_Poison.blp', ReplaceableId: 0, Flags: 0 }, { Image: '', ReplaceableId: 1, Flags: 0 });
  model.Materials[1] = material(layer(1));
  model.Materials[3] = material(layer(0), layer(2, 3, 0));
  model.Materials[4] = material(layer(3, 0, 16), layer(0, 2));
  const inventory = sortMyMessInventory(model);
  assert.deepEqual(inventory.groups.map(group => [group.name, group.geosets, group.mixed]), [['Felwood_Poison + Tinker', [3], true], ['Tinker', [0, 1, 2, 4], false]]);
  const tinker = inventory.groups[1];
  assert.deepEqual(tinker.textures[0].ids, [0, 1]);
  assert.deepEqual(tinker.records, [{ type: 'texture', name: 'Tinker', textures: [0, 1], identical: false }, { type: 'materials', materials: [0, 2] }]);
  assert.deepEqual(inventory.counts, { geosets: 5, materials: 5, textures: 4 });
  assert.equal(materialFacts(model, 4).label, 'Team color + Blend, two-sided');
});

test('differences name RGB, stored defaults, per-animation visibility with exact timing, materials and copies', () => {
  const model = fixture();
  model.GeosetAnims[1] = anim(1, { Flags: 2, Color: new Float32Array([200 / 255, 1, 55 / 255]) });
  model.GeosetAnims[2] = anim(2, { Flags: 2, Color: { LineType: 1, GlobalSeqId: null, Keys: [0, 1000].map((Frame, i) => ({ Frame, Vector: new Float32Array(i ? [1, 0, 0] : [1, 1, 1]) })) }, _MdxDefaults: { Color: new Float32Array([1, 1, 1]) } });
  model.GeosetAnims[3] = anim(3, { Alpha: steps([0, 1], [1100, 1], [2000, 0], [2100, 0]) });
  model.Materials[4] = material(layer(0, 2, 0));
  model.Geosets[4] = structuredClone(model.Geosets[0]); model.Geosets[4].MaterialID = 4;
  const group = sortMyMessInventory(model).groups[0], kinds = Object.fromEntries(group.differences.map(item => [item.kind, item.lines]));
  assert.deepEqual(kinds.rgb[0].entries.map(entry => [entry.value, entry.ids]), [['none', [0, 3, 4]], ['200,255,55', [1]], ['animated 255,255,255 → 255,0,0', [2]]]);
  assert.deepEqual(kinds.stored[0].entries.map(entry => [entry.value, entry.ids]), [[null, [0, 1, 3, 4]], [{ kind: 'default', value: '255,255,255' }, [2]]]);
  const death = kinds.visibility.find(line => line.sequences.includes('Death'));
  assert.deepEqual(death.entries.map(entry => [visibilityText(entry.visibility), entry.ids]), [['shown', [0, 1, 2, 4]], ['shown → hidden at 2000 (final frame)', [3]]]);
  assert.deepEqual(kinds.visibility.find(line => line.sequences.includes('Portrait')).entries.map(entry => [entry.visibility.state, entry.ids]), [['shown', [0, 1, 2, 4]], ['hidden', [3]]]);
  assert.ok(!kinds.visibility.some(line => line.sequences.includes('Stand')));
  const opacity = kinds.material.find(line => line.property === 'Opacity'), sides = kinds.material.find(line => line.property === 'Two-sided');
  assert.deepEqual(opacity.entries.map(entry => [entry.value, entry.ids]), [['Opaque', [0, 1, 2, 3]], ['Blend', [4]]]);
  assert.deepEqual(sides.entries.map(entry => [entry.value, entry.ids]), [['yes', [0, 1, 2, 3]], ['no', [4]]]);
  assert.deepEqual(kinds.shape[0].entries, [{ value: 'exact copies', ids: [0, 4] }]);
  const summary = visibilitySummary(visibilityFacts(model, 3));
  assert.deepEqual(summary, { kind: 'only', names: [{ name: 'Stand', timed: false }, { name: 'Death', timed: true }] });
  assert.equal(visibilitySummaryText(summary), 'only Stand, Death*');
  assert.equal(visibilitySummaryText(visibilitySummary(visibilityFacts(model, 0))), 'all animations');
});

test('identical parts are proposed for merging, exact copies for deletion, and the rest stay open', () => {
  const model = fixture();
  model.Geosets[3] = structuredClone(model.Geosets[1]); model.Geosets[3].MaterialID = 3;
  model.GeosetAnims[4] = anim(4, { Flags: 2, Color: new Float32Array([1, 0, 0]) });
  model.GeosetAnims[2] = anim(2, { Alpha: steps([2100, 0]) });
  const group = sortMyMessInventory(model).groups[0];
  assert.deepEqual(group.proposal.steps, [{ type: 'delete', id: 3, copyOf: 1 }, { type: 'merge', ids: [0, 1], target: 0 }, { type: 'share' }]);
  assert.deepEqual(group.proposal.actions, { 0: 'keep', 1: 0, 2: 'keep', 3: 'delete', 4: 'keep' });
  assert.deepEqual(group.open, [2, 4]);
  assert.equal(decisionChanges({ actions: { 0: 'keep' }, results: {} }), false);
  assert.equal(decisionChanges({ leave: true, actions: { 1: 0 } }), false);
  assert.equal(decisionChanges({ actions: {}, results: { 0: { overrides: { 2: 1 } } } }), true);
});

test('merge 2 into 5 using 5’s settings and keep 3 separate; numbers map old to new', () => {
  const model = fixture();
  model.Materials[4] = material(layer(0, 1));
  model.GeosetAnims[4] = anim(4, { Flags: 2, Color: new Float32Array([.5, .5, .5]), Alpha: steps([2100, 0]) });
  model.Bones[0].GeosetId = 1; model.Bones[0].GeosetAnimId = 1; model.Bones[1].GeosetId = 2; model.Bones[1].GeosetAnimId = 4;
  model.Gliders = [{ GeosetId: 1 }, { GeosetId: 3 }];
  const before = structuredClone(model), group = sortMyMessInventory(model).groups[0];
  const report = applySortMyMess(model, [decide(group, { actions: { 1: 4 } })]);
  assert.deepEqual(report.oldToNew, [0, 3, 1, 2, 3]);
  assert.deepEqual(report.merged, [[1, 4]]);
  assert.equal(model.Geosets.length, 4);
  const merged = model.Geosets[3];
  assert.equal(tris(merged), tris(before.Geosets[4]) + tris(before.Geosets[1]));
  assert.deepEqual(Array.from(merged.Vertices.subarray(0, before.Geosets[4].Vertices.length)), Array.from(before.Geosets[4].Vertices));
  assert.deepEqual(merged.PrimitiveCounts, Uint32Array.of(merged.Faces.length));
  assert.deepEqual(materialFacts(model, merged.MaterialID).label, 'Transparent, two-sided');
  assert.deepEqual(model.GeosetAnims.find(item => item.GeosetId === 3), { ...before.GeosetAnims[4], GeosetId: 3 });
  assert.deepEqual([model.Bones[0].GeosetId, model.Bones[0].GeosetAnimId, model.Bones[1].GeosetId, model.Bones[1].GeosetAnimId], [3, 3, 1, 3]);
  assert.deepEqual(model.Gliders, [{ GeosetId: 3 }, { GeosetId: 2 }]);
  assert.equal(model.Materials.length, 4, 'the material only geoset 2 used is removed');
  const check = verifySortMyMess(before, model, report.oldToNew, group.geosets.filter(id => id === 1 || id === 4));
  assert.deepEqual(check, { unchanged: 3, differing: [], trianglesBefore: before.Geosets.reduce((sum, g) => sum + tris(g), 0), trianglesAfter: model.Geosets.reduce((sum, g) => sum + tris(g), 0) });
  assert.equal(check.trianglesBefore, check.trianglesAfter);
  const changes = describeSortMyMessChanges(before, model, report, [1, 4]);
  assert.deepEqual(changes.lines.map(line => [line.type, line.ids]), [['merged', [1]], ['rgb', [1]], ['material', [1]], ['visibility', [1]]]);
  assert.deepEqual(changes.sequences, [2]);
  assert.equal(validateModel(model).filter(item => item.severity === 'error').length, 0);
});

test('a part can merge into another texture’s part and takes that part’s settings', () => {
  const model = fixture();
  model.Textures.push({ Image: 'Textures\\DemonGate.blp', ReplaceableId: 0, Flags: 0 });
  model.Materials[1] = material(layer(1));
  model.GeosetAnims[1] = anim(1, { Flags: 2, Color: new Float32Array([1, 0, 0]) });
  const before = structuredClone(model), gate = groupNamed(model, 'DemonGate'), tinker = groupNamed(model, 'Tinker');
  const report = applySortMyMess(model, [decide(gate, { actions: { 1: 4 } })]);
  assert.deepEqual(report.oldToNew, [0, 3, 1, 2, 3]);
  assert.equal(model.Geosets[3].MaterialID, 3); assert.equal(model.Textures.length, 1, 'the orphaned DemonGate texture is removed');
  assert.deepEqual(rgbFacts(model.GeosetAnims.find(item => item.GeosetId === 3)).value, 'none');
  const lines = describeSortMyMessChanges(before, model, report, [1]).lines;
  assert.deepEqual(lines.find(line => line.type === 'material'), { type: 'material', from: 'DemonGate · Opaque, two-sided', to: 'Tinker · Opaque, two-sided', ids: [1] });
  assert.throws(() => applySortMyMess(structuredClone(before), [decide(gate, { actions: { 1: 4 } }), decide(tinker, { actions: { 4: 'delete' } })]), /merge into a part that is kept/);
});

test('use X’s color and Y’s visibility, then show the result in portraits and hide it in chosen animations', () => {
  const model = fixture();
  model.GeosetAnims[1] = anim(1, { Flags: 2, Color: new Float32Array([200 / 255, 1, 55 / 255]), Alpha: steps([2100, 0]) });
  model.GeosetAnims[2] = anim(2, { Alpha: steps([0, 1], [1100, 1], [2000, 0], [2100, 0]), _MdxDefaults: { Alpha: 1 } });
  const group = sortMyMessInventory(model).groups[0];
  applySortMyMess(model, [decide(group, { actions: { 1: 0, 2: 0 }, results: { 0: { color: 1, visibility: 2, overrides: { 2: 1, 0: 0 } } } })]);
  const result = model.GeosetAnims.find(item => item.GeosetId === 0);
  assert.deepEqual(rgbFacts(result).value, '200,255,55');
  assert.deepEqual(visibilityFacts(model, 0).map(visibilityText), ['hidden', 'shown → hidden at 2000 (final frame)', 'shown']);
  assert.equal(model.Geosets.length, 3);
});

test('“shown where any part shows” keeps exact timing from the part that shows', () => {
  const model = fixture();
  model.GeosetAnims[0] = anim(0, { Alpha: steps([0, 1], [1100, 0], [2100, 0]) });
  model.GeosetAnims[1] = anim(1, { Alpha: steps([0, 0], [1100, 1], [2000, 0], [2100, 1]) });
  const overrides = unionVisibilityOverrides(model, [0, 1]);
  assert.deepEqual(overrides, { 0: 1, 1: { from: 1 }, 2: 1 });
  const group = sortMyMessInventory(model).groups[0];
  applySortMyMess(model, [decide(group, { actions: { 1: 0 }, results: { 0: { overrides } } })]);
  assert.deepEqual(visibilityFacts(model, 0).map(visibilityText), ['shown', 'shown → hidden at 2000 (final frame)', 'shown']);
});

test('opaque and two-sided without merging; a material shared with a ribbon is copied first', () => {
  const model = fixture();
  for (const item of model.Materials) item.Layers = [layer(0, 2, 0)];
  model.RibbonEmitters = [{ MaterialID: 2 }];
  const ribbon = structuredClone(model.Materials[2]), geometry = structuredClone(model.Geosets.map(g => g.Vertices));
  const group = sortMyMessInventory(model).groups[0];
  const report = applySortMyMess(model, [decide(group, { opaque: true, twoSided: true })]);
  assert.deepEqual(report.oldToNew, [0, 1, 2, 3, 4]);
  assert.equal(model.Geosets.length, 5);
  for (const geoset of model.Geosets) assert.equal(materialFacts(model, geoset.MaterialID).label, 'Opaque, two-sided');
  assert.equal(model.RibbonEmitters[0].MaterialID, 2); assert.deepEqual(model.Materials[2], ribbon);
  assert.equal(model.Geosets[2].MaterialID, 5);
  assert.deepEqual(model.Geosets.map(g => g.Vertices), geometry);
});

test('delete duplicate parts and leave untouched groups byte-identical', () => {
  const model = fixture();
  model.Textures.push({ Image: 'Textures\\Other.blp', ReplaceableId: 0, Flags: 0 });
  model.Materials[4] = material(layer(1));
  model.Bones[0].GeosetId = 3; model.Bones[0].GeosetAnimId = 3;
  const before = structuredClone(model), tinker = groupNamed(model, 'Tinker');
  const report = applySortMyMess(model, [decide(tinker, { actions: { 3: 'delete' } })]);
  assert.deepEqual(report.oldToNew, [0, 1, 2, null, 3]);
  assert.deepEqual(report.deleted, [3]);
  assert.deepEqual([model.Bones[0].GeosetId, model.Bones[0].GeosetAnimId], [null, null]);
  assert.deepEqual(verifySortMyMess(before, model, report.oldToNew, tinker.geosets).differing, []);
  assert.equal(verifySortMyMess(before, model, report.oldToNew, tinker.geosets).unchanged, 1);
  assert.deepEqual(model.Textures, before.Textures);
});

test('sharing identical records removes only copies this choice left unused', () => {
  const model = fixture();
  model.Textures.push(structuredClone(model.Textures[0]), structuredClone(model.Textures[0]));
  model.Materials[1].Layers[0].TextureID = 1; model.Materials[2].Layers[0].TextureID = 2;
  model.ParticleEmitters2 = [{ TextureID: 2 }];
  model.Materials.push(material(layer(0, 3))); // an unused older record stays
  const group = sortMyMessInventory(model).groups[0];
  assert.equal(group.duplicateRecords, true);
  const report = applySortMyMess(model, [decide(group, { share: true })]);
  assert.deepEqual(model.Geosets.map(g => g.MaterialID), [0, 0, 0, 0, 0]);
  assert.equal(report.materials, 4); assert.equal(model.Materials.length, 2);
  assert.equal(report.textures, 1); assert.equal(model.Textures.length, 2);
  assert.equal(model.ParticleEmitters2[0].TextureID, 1, 'the emitter still owns its texture');
});

test('interpolated texture-ID tracks keep their texture index domain', () => {
  const model = fixture();
  model.Textures.push(structuredClone(model.Textures[0]));
  model.Materials[0].Layers[0].TextureID = { LineType: 1, GlobalSeqId: null, Keys: [0, 1000].map((Frame, i) => ({ Frame, Vector: new Uint32Array([i]) })) };
  const textures = structuredClone(model.Textures), group = sortMyMessInventory(model).groups[0];
  applySortMyMess(model, [decide(group, { share: true, actions: { 4: 3 } })]);
  assert.deepEqual(model.Textures, textures);
});

test('invalid choices are refused before anything changes', () => {
  const model = fixture(), group = sortMyMessInventory(model).groups[0];
  assert.throws(() => applySortMyMess(structuredClone(model), [decide(group, { actions: { 1: 2, 2: 'delete' } })]), /merge into a part that is kept/);
  assert.throws(() => applySortMyMess(structuredClone(model), [decide(group, { actions: Object.fromEntries(group.geosets.map(id => [id, 'delete'])) })]), /Keep at least one/);
  const uv = structuredClone(model); uv.Geosets[1].TVertices.push(uv.Geosets[1].TVertices[0].slice());
  assert.throws(() => applySortMyMess(uv, [decide(group, { actions: { 1: 0 } })]), /cannot merge/);
  assert.throws(() => applySortMyMess(structuredClone(model), [decide(group, { actions: { 1: 0 } }), decide(group, { actions: { 2: 0 } })]), /part of two choices/);
});

test('one undoable edit saves and reopens in MDX and MDL', () => {
  const doc = createDemoDocument();
  doc.apply('fixture', ['Sequences', 'Textures', 'Materials', 'Geosets', 'GeosetAnims'], current => {
    const prepared = fixture();
    for (const field of ['Sequences', 'Textures', 'Materials', 'Geosets', 'GeosetAnims']) current[field] = prepared[field];
  });
  const before = doc.serialize('mdx'), group = sortMyMessInventory(doc.model).groups[0];
  const report = doc.apply('Sort My Mess', ['Geosets'], current => applySortMyMess(current, [decide(group, { actions: { 1: 0, 3: 'delete' }, results: { 0: { overrides: { 2: 0 } } }, twoSided: true })]));
  assert.deepEqual(report.oldToNew, [0, 0, 1, null, 2]);
  const after = doc.serialize('mdx');
  for (const format of ['mdx', 'mdl']) {
    const reopened = openDocument(doc.serialize(format), `sorted.${format}`);
    assert.equal(reopened.model.Geosets.length, 3);
    assert.equal(validateModel(reopened.model).filter(item => item.severity === 'error').length, 0);
    assert.deepEqual(visibilityFacts(reopened.model, 0).map(visibilityText), ['shown', 'shown', 'hidden']);
  }
  doc.undo(); assert.deepEqual(doc.serialize('mdx'), before);
  doc.redo(); assert.deepEqual(doc.serialize('mdx'), after);
});

// The source chats' accepted Nurgle result. Point MDLXL_SORT_NURGLE at the
// 52-geoset Visibility_NoTeamColor model and MDLXL_SORT_NURGLE_RESULT at
// Tinker_BrownMerged to replay the Tinker and Brown Magnataur choices.
test('replays the accepted Tinker and Brown Magnataur choices on the real model', { skip: !process.env.MDLXL_SORT_NURGLE }, () => {
  const doc = openDocument(fs.readFileSync(process.env.MDLXL_SORT_NURGLE), 'nurgle.mdx'), model = doc.model, before = structuredClone(model);
  const inventory = sortMyMessInventory(model), named = name => inventory.groups.find(group => group.name === name);
  assert.deepEqual(named('Mannoroth').proposal.steps.find(step => step.type === 'merge').ids, [2, 22, 25]);
  assert.equal(named('Felwood_Poison + HeroTinkerTank').mixed, true);
  const decayFlesh = model.Sequences.findIndex(sequence => sequence.Name === 'Decay Flesh');
  const report = applySortMyMess(model, [
    decide(named('BrownMagnataur'), { actions: { 4: 'delete', 49: 'delete', 5: 50, 37: 50 }, results: { 50: { visibility: 5, overrides: { [decayFlesh]: 0 } } } }),
    decide(named('HeroTinkerTank'), { actions: { 10: 23, 26: 23, 28: 23, 35: 23 } }),
  ]);
  assert.equal(model.Geosets.length, 44);
  assert.deepEqual(verifySortMyMess(before, model, report.oldToNew, [...named('BrownMagnataur').geosets, ...named('HeroTinkerTank').geosets]).differing, []);
  if (!process.env.MDLXL_SORT_NURGLE_RESULT) return;
  const accepted = openDocument(fs.readFileSync(process.env.MDLXL_SORT_NURGLE_RESULT), 'accepted.mdx').model;
  const look = (source, id) => [source.Geosets[id].Faces.length, rgbFacts(source.GeosetAnims.find(item => item.GeosetId === id)).text, visibilityFacts(source, id).map(visibilityText).join('|'), materialFacts(source, source.Geosets[id].MaterialID).label].join(' / ');
  assert.deepEqual(model.Geosets.map((_, id) => look(model, id)).sort(), accepted.Geosets.map((_, id) => look(accepted, id)).sort());
});
