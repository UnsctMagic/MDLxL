import test from 'node:test';
import assert from 'node:assert/strict';
import { openDocument } from '../src/editor-document.js';
import * as kit from '../src/sd-kit.js';

const blank = () =>
  openDocument(
    new TextEncoder().encode('Version { FormatVersion 800, }\nModel "Untitled" { BlendTime 150, MinimumExtent { 0, 0, 0 }, MaximumExtent { 0, 0, 0 }, BoundsRadius 0, }\n'),
    'Untitled.mdl',
  );

test('SD Kit builds one painted, solid prop that saves and reopens as MDX and MDL', () => {
  const doc = blank();
  let result;
  doc.apply('Forge chalice', ['Geosets', 'Materials', 'Textures', 'Bones', 'PivotPoints', 'GeosetAnims', 'Info'], model => {
    const b = kit.builder();
    b.lathe({ profile: [[12, 0], [4, 8], [3, 24], [14, 46], [12, 46], [0, 34]], material: 'blackIron', pattern: 'runes', patternMaterial: 'fire', patternAt: [36, 42] });
    for (const a of kit.angles(6)) b.spike({ from: kit.around(13, a, 44), to: kit.around(16, a, 54), radius: 1.6, material: 'blackIron' });
    b.ring({ radius: 3.6, thickness: 1, at: [0, 0, 14], material: 'bronze', pattern: 'rivets' });
    b.extrude({ outline: kit.shapes.almond(8, 4), depth: 2, bevel: 0.5, at: kit.around(12, 0, 38), rotate: [90, 0, 90], material: 'fire', pattern: 'slitEye' });
    b.sphere({ radius: 1.5, at: [0, 0, 0.5], material: 'ruby', pattern: 'gem' });
    result = b.commit(model, { name: 'Chalice' });
  });
  const model = doc.model, geoset = model.Geosets[result.geoset];
  assert.equal(model.Geosets.length, 1);
  assert.ok(result.triangles > 100 && result.triangles < 900, String(result.triangles));
  assert.equal(result.texture, 'MDLxL_Forge\\SD_Chalice.tga');
  assert.equal(model.Textures[0].Image, result.texture);
  // One opaque painted texture, every UV inside it, every vertex bound.
  assert.equal(model.Materials[geoset.MaterialID].Layers[0].FilterMode, 0);
  assert.ok([...geoset.TVertices[0]].every(v => v >= 0 && v <= 1));
  assert.equal(geoset.VertexGroup.length, geoset.Vertices.length / 3);
  // The TGA is 256x256 RGBA and actually painted: dark iron, bright edges and fire.
  const tga = result.assets[0].bytes, view = new DataView(tga.buffer, tga.byteOffset);
  assert.equal(view.getUint16(12, true), 256);
  assert.equal(view.getUint16(14, true), 256);
  const lum = [];
  for (let i = 18; i < tga.length; i += 4 * 37) lum.push(0.3 * tga[i + 2] + 0.59 * tga[i + 1] + 0.11 * tga[i]);
  assert.ok(Math.min(...lum) < 40 && Math.max(...lum) > 180, 'painted light and dark');
  const fire = [];
  for (let i = 18; i < tga.length; i += 4) if (tga[i + 2] > 200 && tga[i + 1] > 60 && tga[i] < 80) fire.push(i);
  assert.ok(fire.length > 50, 'the fire accent is painted');
  // Saves and reopens through the normal codecs.
  for (const format of ['mdx', 'mdl']) {
    const reopened = openDocument(doc.serialize(format), 'Chalice.' + format);
    assert.equal(reopened.model.Geosets[0].Faces.length, geoset.Faces.length);
  }
});

test('SD Kit refuses unclear parts with a plain message', () => {
  const b = kit.builder();
  assert.throws(() => b.lathe({ profile: [[1, 0]], material: 'iron' }), /at least two/);
  assert.throws(() => b.extrude({ outline: [[0, 0], [1, 1]], material: 'iron' }), /three/);
  assert.throws(() => b.lathe({ profile: [[1, 0], [1, 2]], material: 'unobtainium' }).commit({ Textures: [] }), /Unknown SD material/);
  assert.throws(() => b.lathe({ profile: [[1, 0], [1, 2]] }), /material/);
  assert.throws(() => kit.builder().commit({}), /at least one part/);
});
