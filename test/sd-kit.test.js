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

test('SD Kit maps native parts onto game texture regions beside painted parts', () => {
  const doc = blank();
  let result;
  const iron = { sheet: 'Textures\\InfernalCannon.blp', uv: [0.375, 0.5625, 0.4922, 0.7813], size: [256, 256] };
  const wood = { sheet: 'UI\\Glues\\SinglePlayer\\HumanCampaign3D\\HumanCampaignwoodmetaltrim.blp', uv: [0.2031, 0.3281, 0.7344, 0.4844] };
  const skull = { sheet: 'Units\\Critters\\Marine\\SpaceMarine.blp', uv: [0.875, 0.0313, 0.9453, 0.1016], tint: [0.569, 1, 0.255], team: true };
  doc.apply('Forge axe', ['Geosets', 'Materials', 'Textures', 'Bones', 'PivotPoints', 'GeosetAnims', 'Info'], model => {
    const b = kit.builder();
    b.extrude({ outline: kit.shapes.shield(24, 20), depth: 3, at: [0, 0, 60], rotate: [90, 0, 0], native: iron });
    b.lathe({ profile: [[2.4, 0], [2.4, 70]], segments: 5, native: wood });
    b.emblem({ shape: 'skull', width: 6, height: 7, radius: 2, z: 60, native: skull });
    b.sphere({ radius: 2, at: [0, 0, 72], material: 'gold' });
    result = b.commit(model, { name: 'Axe' });
  });
  const model = doc.model;
  // One painted geoset plus one geoset per native sheet and colour.
  assert.equal(model.Geosets.length, 4);
  assert.deepEqual(result.native.textures, [iron.sheet, wood.sheet, skull.sheet]);
  for (const [i, region] of [iron, wood, skull].entries()) {
    const g = model.Geosets[result.native.geosets[i]], uv = [...g.TVertices[0]];
    for (let k = 0; k < uv.length; k += 2) {
      assert.ok(uv[k] >= region.uv[0] && uv[k] <= region.uv[2], `u inside ${region.sheet}`);
      assert.ok(uv[k + 1] >= region.uv[1] && uv[k + 1] <= region.uv[3], `v inside ${region.sheet}`);
    }
    assert.equal(model.Textures[model.Materials[g.MaterialID].Layers.at(-1).TextureID].Image, region.sheet);
  }
  // The long haft island lies along the long wood strip.
  const haft = [...model.Geosets[result.native.geosets[1]].TVertices[0]], us = haft.filter((_, k) => k % 2 === 0), vs = haft.filter((_, k) => k % 2);
  assert.ok(Math.max(...us) - Math.min(...us) > Math.max(...vs) - Math.min(...vs));
  // Tint and team colour come from the region, the way the owner's Nurgle skulls get their green.
  const skullGeoset = result.native.geosets[2], anim = model.GeosetAnims.find(a => a.GeosetId === skullGeoset);
  assert.ok(anim && anim.Flags & 2);
  assert.deepEqual([...anim.Color].map(v => Math.round(v * 1000) / 1000), skull.tint);
  const layers = model.Materials[model.Geosets[skullGeoset].MaterialID].Layers;
  assert.equal(layers.length, 2);
  assert.equal(model.Textures[layers[0].TextureID].ReplaceableId, 1);
  assert.equal(model.Materials[model.Geosets[result.native.geosets[0]].MaterialID].Layers[0].FilterMode, 0);
  assert.equal(result.assets.length, 1, 'only the painted part needs a new texture');
  for (const format of ['mdx', 'mdl']) {
    const reopened = openDocument(doc.serialize(format), 'Axe.' + format);
    assert.equal(reopened.model.Geosets.length, 4);
    assert.ok(reopened.model.Textures.some(t => t.Image === iron.sheet));
  }
});

test('SD Kit native parts alone add no painted texture', () => {
  const doc = blank();
  let result;
  doc.apply('Forge blade', ['Geosets', 'Materials', 'Textures', 'Bones', 'PivotPoints', 'GeosetAnims', 'Info'], model => {
    result = kit.builder().blade({ length: 60, width: 9, native: { sheet: 'Textures\\Footman.blp', uv: [0.1, 0.1, 0.2, 0.5] } }).commit(model);
  });
  assert.equal(result.assets.length, 0);
  assert.equal(result.texture, 'Textures\\Footman.blp');
  assert.equal(doc.model.Geosets.length, 1);
  assert.throws(() => kit.builder().blade({ length: 60, native: { sheet: 'x.blp', uv: [0.5, 0.5, 0.2, 0.9] } }), /u1 > u0/);
  assert.throws(() => kit.builder().blade({ length: 60, native: { uv: [0, 0, 1, 1] } }), /sheet/);
});

test('SD Kit refuses unclear parts with a plain message', () => {
  const b = kit.builder();
  assert.throws(() => b.lathe({ profile: [[1, 0]], material: 'iron' }), /at least two/);
  assert.throws(() => b.extrude({ outline: [[0, 0], [1, 1]], material: 'iron' }), /three/);
  assert.throws(() => b.lathe({ profile: [[1, 0], [1, 2]], material: 'unobtainium' }).commit({ Textures: [] }), /Unknown SD material/);
  assert.throws(() => b.lathe({ profile: [[1, 0], [1, 2]] }), /material/);
  assert.throws(() => kit.builder().commit({}), /at least one part/);
});

// Share of triangles whose three vertex normals all match the face (the SD-STYLES flat-shading measure).
const flatShare = part => part.tris.filter(([a, b, c]) => {
  const e1 = part.p[b].map((v, i) => v - part.p[a][i]), e2 = part.p[c].map((v, i) => v - part.p[a][i]);
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(...n);
  return [a, b, c].every(k => Math.abs(n.reduce((s, x, i) => s + x * part.n[k][i], 0)) / l > 0.995);
}).length / part.tris.length;

test('SD Kit shades smoothly inside a piece; hard breaks stay for separate pieces', () => {
  const b = kit.builder();
  b.extrude({ outline: kit.shapes.pointedBlade(14, 60), depth: 4, material: 'steel' });
  b.blade({ length: 60, width: 9, material: 'steel' });
  b.extrude({ outline: kit.shapes.rect(10, 10), depth: 2, material: 'iron', smooth: 0 });
  const [slab, blade, flat] = b.parts;
  assert.equal(flatShare(slab), 0, 'a slab body is lit smoothly, not one flat face per side (the failed sword was 100% flat)');
  assert.ok(flatShare(blade) < 0.2);
  assert.equal(flatShare(flat), 1, 'smooth: 0 keeps facets');
  // The builder's own hard edges are kept for the painter's creases.
  assert.ok(slab.n0 && slab.n0.length === slab.n.length);
});

test('SD Kit edged blade: a slab body with a separate thin edge piece in another paint', () => {
  const doc = blank(), body = { sheet: 'Textures\\UndeadAirBarge.blp', uv: [0.79, 0.21, 0.94, 0.39] }, edge = { sheet: 'Textures\\AxeBladeBlueSteel.blp', uv: [0.03, 0.79, 0.9, 0.98], size: [64, 64] };
  const outline = kit.shapes.pointedBlade(20, 84, { tip: 0.27, flare: 0.22, hook: 0.3, teeth: 3, toothDepth: 5 });
  // Points and slants only: the tip and the teeth are points, no square steps anywhere (the base narrows into the guard).
  const corners = kit.corners(outline);
  assert.equal(corners.square + corners.reflexSquare, 0, JSON.stringify(corners.angles));
  assert.ok(corners.angles.some(a => a < 60), 'a real point');
  assert.equal(kit.corners(kit.shapes.rect(4, 4)).square, 4);
  let result;
  doc.apply('Blade', [], model => {
    const b = kit.builder();
    b.edged({ outline, depth: 4, native: body, edge: { native: edge, width: 3 } });
    const [slab, band] = b.parts;
    // The edge thins to a line: thickness at its outside over its middle, inside the owner's 0.05-0.43.
    const outer = Math.max(...band.p.filter((p, i) => band.island[i] === 0 && band.uv[i][1] === 0).map(p => Math.abs(p[2]))), inner = Math.max(...band.p.map(p => Math.abs(p[2])));
    const sharp = (2 * outer) / (outer + inner);
    assert.ok(sharp >= 0.05 && sharp <= 0.43, String(sharp));
    assert.ok(Math.max(...slab.p.map(p => p[2])) * 2 === 4, 'the body stays a slab');
    // The body plus the edge keeps the outline: the band's outer line is the outline itself.
    const xs = band.p.map(p => p[0]);
    assert.ok(Math.abs(Math.max(...xs) - Math.max(...outline.map(p => p[0]))) < 1e-6);
    result = b.commit(model, { name: 'Brutal' });
  });
  assert.deepEqual(result.native.textures, [body.sheet, edge.sheet]);
  assert.throws(() => kit.builder().edged({ outline, native: body }), /edge its own paint/);
  assert.throws(() => kit.builder().edged({ outline, native: body, edge: {} }), /edge its own paint/);
});

test('SD Kit layered trims, saw points and parts sharing one sheet keep their own areas', () => {
  const guard = [[-17, 2.5], [-11, -0.5], [-5, -3], [0, -8], [5, -3], [11, -0.5], [17, 2.5], [10, 4.5], [3, 3.6], [0, 6.5], [-3, 3.6], [-10, 4.5]];
  const b = kit.builder();
  b.extrude({ outline: guard, depth: 6, material: 'blackIron' });
  b.trim({ outline: guard, width: 1.6, depth: 7.2, material: 'gold' });
  const [plate, trim] = b.parts, zt = trim.p.map(p => p[2]), zp = plate.p.map(p => p[2]);
  assert.ok(Math.max(...zt) > Math.max(...zp) && Math.min(...zt) < Math.min(...zp), 'the trim stands proud of both faces');
  const saw = kit.serrate(kit.shapes.rect(10, 40), 1, 2, { teeth: 4, depth: 6 });
  assert.equal(saw.length, 4 + 7);
  const sawCorners = kit.corners(saw);
  assert.ok(sawCorners.acute >= 4 && sawCorners.angles.slice(2, 9).every(a => a < 80 || a > 280), 'raked teeth are points, not square steps');
  // Two native parts on one sheet share a geoset, each in its own area of it.
  const doc = blank(), a = { sheet: 'Textures\\InfernalCannon.blp', uv: [0.1, 0.1, 0.2, 0.2] }, c = { sheet: 'Textures\\InfernalCannon.blp', uv: [0.6, 0.6, 0.9, 0.9] };
  let result;
  doc.apply('Two areas', [], model => {
    const k = kit.builder();
    k.box({ size: [4, 4, 4], native: a });
    k.box({ size: [4, 4, 4], at: [10, 0, 0], native: c });
    result = k.commit(model);
  });
  const g = doc.model.Geosets[result.native.geosets[0]], uv = Array.from(g.TVertices[0]), half = uv.length / 2;
  for (let k = 0; k < uv.length; k += 2) {
    const r = k < half ? a.uv : c.uv;
    assert.ok(uv[k] >= r[0] && uv[k] <= r[2] && uv[k + 1] >= r[1] && uv[k + 1] <= r[3], 'each part in its own area');
  }
});
