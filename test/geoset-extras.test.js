import test from 'node:test';
import assert from 'node:assert/strict';
import { corpseAndBackgroundGeosets, geosetsHiddenByExtras } from '../src/geoset-extras.js';

const key = (Frame, value) => ({ Frame, Vector: new Float32Array([value]) });
const alpha = keys => ({ LineType: 0, GlobalSeqId: null, Keys: keys.map(([frame, value]) => key(frame, value)) });
const model = (anims, sequences = [['Stand', 0, 100], ['Death', 200, 300], ['Decay Bone', 400, 500], ['Portrait', 600, 700]]) => ({
  Geosets: [{}, {}, {}, {}, {}],
  Sequences: sequences.map(([Name, a, b]) => ({ Name, Interval: new Uint32Array([a, b]) })),
  GlobalSequences: [],
  GeosetAnims: anims,
});

test('corpse and portrait-background geosets are extras; body, death-only-hidden and unanimated geosets stay', () => {
  const m = model([
    { GeosetId: 1, Alpha: alpha([[0, 0], [100, 0], [200, 0], [300, 0], [400, 1], [500, 1], [600, 0], [700, 0]]) }, // decay bones
    { GeosetId: 2, Alpha: alpha([[0, 0], [100, 0], [600, 1], [700, 1]]) }, // portrait background
    { GeosetId: 3, Alpha: alpha([[0, 1], [100, 1], [400, 0], [500, 0]]) }, // body hidden in decay
    { GeosetId: 4, Alpha: alpha([[0, 0], [50, 1], [100, 0]]) }, // briefly shown in Stand
  ]);
  assert.deepEqual([...corpseAndBackgroundGeosets(m)].sort(), [1, 2]);
});

test('global-sequence visibility, models without everyday sequences, and all-extra models hide nothing', () => {
  assert.equal(corpseAndBackgroundGeosets(model([{ GeosetId: 1, Alpha: { ...alpha([[0, 0]]), GlobalSeqId: 0 } }])).size, 0);
  assert.equal(corpseAndBackgroundGeosets(model([{ GeosetId: 1, Alpha: alpha([[0, 0]]) }], [['Decay Flesh', 0, 100]])).size, 0);
  assert.equal(corpseAndBackgroundGeosets(model([0, 1, 2, 3, 4].map(GeosetId => ({ GeosetId, Alpha: alpha([[0, 0], [100, 0]]) })))).size, 0);
});

test('Hide extras also takes hero glow and part-time effects, and keeps gear and always-on effects', () => {
  const m = model([
    { GeosetId: 1, Alpha: alpha([[0, 1], [100, 1], [400, 0], [500, 0]]) }, // hero glow, on throughout Stand
    { GeosetId: 2, Alpha: alpha([[0, 0], [100, 0], [1000, 1], [1100, 1]]) }, // whirlwind, on in one attack only
    { GeosetId: 3, Alpha: alpha([[0, 0], [100, 0], [1000, 1], [1100, 1]]) }, // a solid weapon, on in the same attack only
  ], [['Stand', 0, 100], ['Death', 200, 300], ['Decay Bone', 400, 500], ['Portrait', 600, 700], ['Attack Spin', 1000, 1100]]);
  m.Textures = [{ ReplaceableId: 0, Image: 'Body.blp' }, { ReplaceableId: 2, Image: '' }, { ReplaceableId: 0, Image: 'Tornado.blp' }];
  const material = (TextureID, FilterMode) => ({ Layers: [{ TextureID, FilterMode }] });
  m.Materials = [material(0, 1), material(1, 3), material(2, 4), material(0, 1), material(2, 3)];
  [0, 1, 2, 3, 4].forEach(index => { m.Geosets[index] = { MaterialID: index, Vertices: [] }; });
  assert.deepEqual([...geosetsHiddenByExtras(m)].sort(), [1, 2], 'geoset 4 is an effect with no alpha track: it never switches off, so it stays');
  assert.equal(corpseAndBackgroundGeosets(m).size, 0, 'the corpse and background rule itself is unchanged');
});

test('Hide extras never empties the work area', () => {
  const m = model([{ GeosetId: 0, Alpha: alpha([[0, 0], [100, 1]]) }], [['Stand', 0, 100], ['Attack', 200, 300]]);
  m.Geosets = [{ MaterialID: 0, Vertices: [] }];
  m.Textures = [{ ReplaceableId: 2, Image: '' }];
  m.Materials = [{ Layers: [{ TextureID: 0, FilterMode: 3 }] }];
  assert.equal(geosetsHiddenByExtras(m).size, 0);
});
