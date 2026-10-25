import test from 'node:test';
import assert from 'node:assert/strict';
import { createNode, openDocument } from '../src/editor-document.js';
import { bindVertices } from '../src/editor-commands.js';
import { prepareAiEdit } from '../src/ai-model.js';
import * as kit from '../src/sd-kit.js';
import * as bash from '../src/sd-kitbash.js';

const blank = (version = 800) =>
  openDocument(new TextEncoder().encode(`Version { FormatVersion ${version}, }\nModel "Unit" { BlendTime 150, }\n`), 'Unit.mdl');
const all = (model, g) => Array.from({ length: model.Geosets[g].Vertices.length / 3 }, (_, v) => v);
const bone = (model, name, pivot) => { const node = createNode(model, 'Bone'); node.Name = name; model.PivotPoints[node.ObjectId] = new Float32Array(pivot); node.PivotPoint = model.PivotPoints[node.ObjectId]; return node.ObjectId; };

// A little unit: a body box on a chest bone and, in the same geoset, a head box and a horn on a head
// bone; a second geoset holds a sword on a hand bone. Native paint, so no texture bytes are needed.
function unit({ headSize = 12, headAt = [0, 0, 60], pivot = [0, 0, 55] } = {}) {
  const doc = blank();
  doc.apply('Unit', [], model => {
    const paint = { sheet: 'Textures\\Footman.blp', uv: [0.1, 0.1, 0.4, 0.4] };
    const b = kit.builder();
    b.box({ size: [20, 30, 40], at: [0, 0, 25], native: paint });
    b.box({ size: [headSize, headSize, headSize], at: headAt, native: paint });
    b.spike({ from: [0, 4, headAt[2] + 4], to: [0, 9, headAt[2] + 16], radius: 1.5, native: paint });
    b.commit(model);
    const sword = kit.builder();
    sword.blade({ length: 50, width: 8, at: [8, 20, 20], native: { sheet: 'Textures\\Knight.blp', uv: [0.5, 0.5, 0.6, 0.9] } });
    sword.commit(model);
    const chest = bone(model, 'Bone_Chest', [0, 0, 30]), head = bone(model, 'Bone_Head', pivot), hand = bone(model, 'Hand_R', [8, 20, 20]);
    const pieces = bash.pieces(model, { geoset: 0, order: 'file', withVertices: true });
    bindVertices(model, model.Geosets[0], pieces[0].vertices, chest);
    bindVertices(model, model.Geosets[0], [...pieces[1].vertices, ...pieces[2].vertices], head);
    bindVertices(model, model.Geosets[1], all(model, 1), hand);
  });
  return doc;
}

test('Kitbash numbers pieces the way the SD research did and selects them back', () => {
  const model = unit().model;
  const list = bash.pieces(model, { order: 'file', limit: 99 });
  assert.deepEqual(list.map(p => [p.geoset, p.piece]), [[0, 0], [0, 1], [0, 2], [1, 0]]);
  // Faces that share an edge are one piece even when their vertices are split for UVs and normals.
  assert.equal(list[0].triangles, 12, 'a box is one piece, not six faces');
  assert.equal(list[1].bone, 'Bone_Head');
  assert.deepEqual(bash.pieces(model, { bone: 'hand' }).map(p => p.geoset), [1]);
  const head = bash.select(model, { geoset: 0, piece: 1, triangles: 12 });
  assert.deepEqual(Object.keys(head), ['0']);
  assert.equal(head[0].length, list[1].vertexCount);
  // A renumbered model is matched by triangles and place; a wrong entry is refused plainly.
  const moved = bash.select(model, { geoset: 0, piece: 7, triangles: 12, center: list[1].center });
  assert.deepEqual(moved, head);
  assert.throws(() => bash.select(model, { geoset: 0, piece: 9, triangles: 999 }), /pieces\(model\)/);
});

test('Kitbash swaps a part so it follows the old part bones, and adds parts to a part or a bone', () => {
  const base = unit(), donor = unit({ headSize: 18, headAt: [3, 0, 92], pivot: [0, 0, 84] }).model, model = base.model;
  const oldHead = bash.select(model, { geoset: 0, piece: 1 }, { geoset: 0, piece: 2 });
  const part = bash.take(donor, bash.select(donor, { geoset: 0, piece: 1 }));
  assert.deepEqual(part.Sequences, [], 'a taken part brings no animations');
  // Fitted by the shared neck joint: the donor head keeps its size and moves by the pivot difference.
  const fitted = bash.fit(part, model, oldHead, { from: donor, bone: 'Bone_Head' });
  const placed = bash.measure(fitted, { 0: all(fitted, 0) });
  assert.deepEqual(placed.center.map(Math.round), [3, 0, 92 - 84 + 55]);
  assert.equal(Math.round(placed.size[2]), 18);
  let swap;
  base.apply('Swap head', [], m => { swap = bash.replace(m, bash.select(m, { geoset: 0, piece: 1 }, { geoset: 0, piece: 2 }), fitted); });
  const headBone = model.Bones.find(b => b.Name === 'Bone_Head').ObjectId, g = model.Geosets[Object.keys(swap.selection)[0]];
  assert.ok(g.Groups.every(group => group.includes(headBone)), 'the new head follows the head bone');
  assert.equal(model.Geosets[0].Faces.length / 3, 12, 'the old head and horn are gone');
  // A helmet attached to the new head takes its bones; a sword pommel added to a bone takes that bone.
  let helm, pommel;
  base.apply('Helmet', [], m => {
    helm = bash.add(m, bash.fit(bash.take(donor, bash.select(donor, { geoset: 0, piece: 1 })), m, swap.selection, { scale: 0.8, lift: 10 }), { attach: swap.selection });
    pommel = bash.add(m, bash.take(donor, bash.select(donor, { geoset: 1, piece: 0 })), { bone: 'hand' });
  });
  assert.ok(model.Geosets[Object.keys(helm.selection)[0]].Groups.every(group => group.includes(headBone)));
  assert.deepEqual(model.Geosets[Object.keys(pommel.selection)[0]].Groups, [[model.Bones.find(b => b.Name === 'Hand_R').ObjectId]]);
  assert.ok(!model.Bones.some(b => b.Name === 'DummyBone' && !model.Geosets.some(x => x.Groups.some(gr => gr.includes(b.ObjectId)))), 'no unused import anchor is left');
  for (const format of ['mdx', 'mdl']) assert.equal(openDocument(base.serialize(format), 'Unit.' + format).model.Geosets.length, model.Geosets.length);
});

test('Kitbash turns a part onto a direction, mirrors it, places it at a point and lights a glow card', () => {
  const base = unit(), donor = unit().model, model = base.model;
  // The horn (piece 2) runs mostly along Z; turned onto +Y it lies along Y.
  const horn = bash.take(donor, bash.select(donor, { geoset: 0, piece: 2 }));
  const along = p => { const m = bash.measure(p, { 0: all(p, 0) }); return m.size.indexOf(Math.max(...m.size)); };
  assert.equal(along(horn), 2);
  const lying = bash.align(horn, [0, 5, 12], [0, 1, 0]);
  assert.equal(along(lying), 1);
  // Mirrored left/right: same size, the other side of its centre, triangles still facing out.
  const left = bash.mirror(horn), a = bash.measure(horn, { 0: all(horn, 0) }), b = bash.measure(left, { 0: all(left, 0) });
  assert.deepEqual(b.size.map(Math.round), a.size.map(Math.round));
  assert.deepEqual(Array.from(left.Geosets[0].Faces.slice(0, 3)), [horn.Geosets[0].Faces[0], horn.Geosets[0].Faces[2], horn.Geosets[0].Faces[1]]);
  // Placed with its bottom on a point, half size.
  const placed = bash.measure(bash.place(horn, { at: [5, 6, 70], scale: 0.5, anchor: 'bottom' }), { 0: all(horn, 0) });
  assert.deepEqual([placed.center[0], placed.center[1], placed.min[2]].map(Math.round), [5, 6, 70]);
  assert.equal(Math.round(placed.size[2] * 2), Math.round(a.size[2]));
  // A glow card on the head bone: additive, unshaded, two-sided, on that bone, and it survives a save.
  let card;
  base.apply('Eye glow', [], m => { card = bash.glow(m, { at: [7, 2, 62], size: 3, bone: 'Bone_Head' }); });
  const g = model.Geosets[card.geosetIndices[0]], layer = model.Materials[g.MaterialID].Layers[0];
  assert.equal(layer.FilterMode, 3);
  assert.equal(layer.Shading & 1 && layer.Shading & 16, 16);
  assert.match(model.Textures[layer.TextureID].Image, /purple_glow/);
  assert.deepEqual(g.Groups, [[model.Bones.find(x => x.Name === 'Bone_Head').ObjectId]]);
  for (const format of ['mdx', 'mdl']) assert.equal(openDocument(base.serialize(format), 'Unit.' + format).model.Geosets.length, model.Geosets.length);
  assert.throws(() => bash.glow(model, { at: [0, 0, 0] }), /bone/);
});

test('Kitbash reshapes without touching UVs, repaints from a palette area and tints', () => {
  const doc = unit(), model = doc.model;
  const head = bash.select(model, { geoset: 0, piece: 1 });
  const uvBefore = Array.from(model.Geosets[0].TVertices[0]), before = bash.measure(model, head);
  let size, paint;
  doc.apply('Reshape', [], m => { size = bash.reshape(m, bash.select(m, { geoset: 0, piece: 1 }), { scale: [1.5, 1, 0.5], pivot: 'bottom', taper: 0.5 }).size; });
  assert.deepEqual(Array.from(model.Geosets[0].TVertices[0]), uvBefore, 'reshaping keeps the paint where it was');
  assert.ok(size[2] < before.size[2] * 0.6 && size[0] > before.size[0] * 1.2);
  const region = { sheet: 'Textures\\InfernalCannon.blp', uv: [0.487, 0.008, 0.737, 0.168], size: [256, 256] };
  doc.apply('Repaint', [], m => { paint = bash.repaint(m, bash.select(m, { geoset: 0, piece: 1 }), region, { tint: [1, 0.8, 0.6] }); });
  const g = model.Geosets[paint.geoset], uv = Array.from(g.TVertices[0]);
  assert.notEqual(paint.geoset, 0, 'the part moved into a geoset of its own');
  assert.equal(g.Faces.length / 3, 12);
  for (let k = 0; k < uv.length; k += 2) assert.ok(uv[k] >= 0.487 && uv[k] <= 0.737 && uv[k + 1] >= 0.008 && uv[k + 1] <= 0.168);
  assert.equal(model.Textures[model.Materials[g.MaterialID].Layers[0].TextureID].Image, region.sheet);
  assert.deepEqual(Array.from(model.GeosetAnims.find(a => a.GeosetId === paint.geoset).Color).map(v => Math.round(v * 10) / 10), [1, 0.8, 0.6]);
  assert.throws(() => bash.setTint(model, 0, [2, 0, 0]), /0 to 1/);
});

test('Kitbash adopts a base in the open model format and builds new pieces onto a part', () => {
  const ref = unit().model;
  ref.Version = 1000;
  const doc = blank(), model = doc.model;
  doc.apply('Base', [], m => bash.adopt(m, ref));
  assert.equal(model.Version, 800);
  assert.equal(model.Geosets.length, 2);
  assert.ok(model.Geosets.every(g => !g.SkinWeights?.length));
  assert.ok(bash.BASE_SCOPE.includes('/Geosets') && bash.BASE_SCOPE.every(p => p.startsWith('/') && p !== '/Nodes'));
  // An AI script that adopts a base passes the editor's edit scope check with BASE_SCOPE.
  assert.ok(prepareAiEdit(blank().model, structuredClone(model), { scope: bash.BASE_SCOPE }).changeCount > 0);
  // The sword's frame: from its hilt end, along the blade. A new hilt built in that frame lands at the hilt
  // and moves with the hand bone.
  const sword = bash.select(model, { geoset: 1, piece: 0 }), frame = bash.anchor(model, sword);
  assert.ok(Math.abs(frame.axis[2]) > 0.99 && frame.axis[2] > 0, 'axis runs up the blade');
  assert.ok(Math.abs(frame.origin[2] - 20) < 1 && Math.round(frame.length) === 50);
  let result;
  doc.apply('Hilt', [], m => {
    const b = kit.builder({ frame });
    b.lathe({ profile: [[2, -12], [2.4, 0]], segments: 5, material: 'leather' });
    result = b.commit(m, { name: 'Hilt', attach: sword });
  });
  const hilt = model.Geosets[result.geosets[0]], zs = Array.from(hilt.Vertices).filter((_, k) => k % 3 === 2);
  assert.ok(Math.max(...zs) <= 20.5 && Math.min(...zs) >= 7.5, 'the hilt hangs below the blade');
  assert.deepEqual(hilt.Groups, [[model.Bones.find(b => b.Name === 'Hand_R').ObjectId]]);
  assert.deepEqual(bash.pivot(model, 'Bone_Head'), [0, 0, 55]);
  assert.throws(() => bash.boneId(model, 'tail'), /No bone named like tail/);
});
