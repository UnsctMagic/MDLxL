import test from 'node:test';
import assert from 'node:assert/strict';
import { corpseAndBackgroundGeosets } from '../src/geoset-extras.js';

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
