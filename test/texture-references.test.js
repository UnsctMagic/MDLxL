import test from 'node:test';
import assert from 'node:assert/strict';
import { TEXTURE_SLOTS } from '../src/mdx-compatibility.js';
import { layerTextureIds, isTeamColorLayer, isTeamGlowLayer, visitTextureReferences } from '../src/texture-references.js';

const model = { Textures: [{ ReplaceableId: 0 }, { ReplaceableId: 1 }, { ReplaceableId: 2 }] };
const track = (ArrayType = Int32Array) => ({ LineType: 3, Keys: [{ Frame: 0, Vector: ArrayType.from([2]), InTan: ArrayType.from([1]), OutTan: ArrayType.from([0]) }] });
test('layer predicates resolve static and deduplicated track values, excluding tangents/defaults', () => {
  const layer = { TextureID: track(), _MdxDefaults: { TextureID: 1 } };
  layer.TextureID.Keys.push({ Frame: 10, Vector: Int32Array.of(2) });
  assert.deepEqual(layerTextureIds(model, layer), [2]);
  assert.equal(isTeamGlowLayer(model, layer), true);
  assert.equal(isTeamColorLayer(model, layer), false);
  layer.TextureID.Keys.push({ Frame: 20, Vector: Int32Array.of(1) });
  assert.deepEqual(layerTextureIds(model, layer), [2, 1]);
  assert.equal(isTeamColorLayer(model, layer), true);
  assert.equal(isTeamColorLayer(model, { TextureID: 1 }), true);
  assert.equal(isTeamGlowLayer(model, { TextureID: 0 }), false);
  for (const layer of [{}, { TextureID: -1 }, { TextureID: 99 }, { TextureID: { Keys: [] } }]) {
    assert.equal(isTeamColorLayer(model, layer), false); assert.equal(isTeamGlowLayer(model, layer), false);
  }
});

test('walker owns every texture slot, defaults, vectors, both tangents and PE2 references', () => {
  const layer = { _MdxDefaults: {} };
  for (const slot of TEXTURE_SLOTS) { layer[slot] = track(Float32Array); layer._MdxDefaults[slot] = 9; }
  const emitter = { TextureID: track(Float32Array), _MdxDefaults: { TextureID: 9 } };
  const input = { Materials: [{ Layers: [layer] }], ParticleEmitters2: [emitter] };
  const seen = [];
  visitTextureReferences(input, (id, set, owner) => { seen.push([id, owner]); set(id + 10); });
  assert.deepEqual(seen.slice(0, 4).map(([id]) => id), [2, 1, 0, 9], 'active keys precede defaults to preserve allocation order');
  assert.equal(seen.length, (TEXTURE_SLOTS.length + 1) * 4);
  for (const owner of [layer, emitter]) for (const slot of owner === layer ? TEXTURE_SLOTS : ['TextureID']) {
    const key = owner[slot].Keys[0];
    assert.ok(key.Vector instanceof Float32Array);
    assert.deepEqual([key.Vector[0], key.InTan[0], key.OutTan[0], owner._MdxDefaults[slot]], [12, 11, 10, 19]);
  }
});

test('walker preserves caller array rebuilds and visits original values before conversion', () => {
  for (const arrayType of [Array, Int32Array]) {
    const input = { Materials: [{ Layers: [{ TextureID: track(Float32Array) }] }] };
    const record = { texture: 'glow' }, seen = [];
    input.Materials[0].Layers[0].TextureID.Keys[0].Vector[0] = 2.5;
    visitTextureReferences(input, (id, set) => { seen.push(id); set(arrayType === Array ? record : id + 10); }, { arrayType });
    const key = input.Materials[0].Layers[0].TextureID.Keys[0];
    assert.deepEqual(seen, [2.5, 1, 0]);
    assert.equal(key.Vector.constructor, arrayType);
    assert.deepEqual(Array.from(key.Vector), [arrayType === Array ? record : 12]);
  }
});

test('walker retains both importer default-allocation orders', () => {
  for (const defaultsAfterSlots of [false, true]) {
    const layer = { TextureID: 3, NormalTextureID: 4, _MdxDefaults: { TextureID: 5, NormalTextureID: 6 } };
    const seen = [];
    visitTextureReferences({ Materials: [{ Layers: [layer] }] }, id => seen.push(id), { defaultsAfterSlots });
    assert.deepEqual(seen, defaultsAfterSlots ? [3, 4, 5, 6] : [3, 5, 4, 6]);
  }
});
