import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { createStarterDocument } from '../src/starter-model.js';
import { openDocument, createNode } from '../src/editor-document.js';
import { addHeroGlow, findHeroGlow, glowLayout, glowStart, glowUp, hasHeroGlow, heroGlowFaults, originGlowSize, repairHeroGlow, weaponCandidates, weaponChoices, weaponLine } from '../src/glow-up.js';
import { bindVertices } from '../src/editor-commands.js';
import { sampleGeosetAnimation, sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { samplePreviewMatrices } from '../app/preview-pose.js';

const near = (a, b, tolerance = 1e-3) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < tolerance, `${a} != ${b}`));
const quadCenters = g => Array.from({ length: g.Vertices.length / 12 }, (_, q) => [0, 1, 2].map(a => [0, 1, 2, 3].reduce((sum, k) => sum + g.Vertices[(q * 4 + k) * 3 + a], 0) / 4));

/** A hero-like test model: a 64 cube body, a right hand and a sword (or two). */
function hero({ swords = ['Sword'], sequences = ['Stand', 'Death', 'Decay Flesh'] } = {}) {
  const doc = createStarterDocument();
  doc.apply('Rig', [], m => {
    m.Sequences = sequences.map((Name, i) => ({ Name, Interval: new Uint32Array([i * 1000, i * 1000 + 900]), MoveSpeed: 0, NonLooping: false, Rarity: 0, MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array(3), BoundsRadius: 0 }));
    swords.forEach((name, s) => {
      const y = s ? 40 : -40;
      const hand = createNode(m, 'Bone'); hand.Name = s ? 'Bone_Hand_L' : 'Bone_Hand_R'; hand.PivotPoint.set([10, y, 20]); hand.Parent = m.Bones[0].ObjectId;
      const sword = createNode(m, 'Bone'); sword.Name = name; sword.PivotPoint.set([10, y, 20]); sword.Parent = hand.ObjectId;
      // A sword along +X: a short pommel behind the grip, a long blade ahead.
      const vertices = [];
      for (const x of [2, 6, 14, 30, 46, 62, 78]) for (const [dy, dz] of [[-2, -1], [2, -1], [2, 1], [-2, 1]]) vertices.push(x, y + dy, 20 + dz);
      const count = vertices.length / 3, faces = [];
      for (let k = 0; k + 4 < count; k += 4) faces.push(k, k + 1, k + 5, k, k + 5, k + 4);
      m.Geosets.push({ Vertices: new Float32Array(vertices), Normals: new Float32Array(vertices.length).fill(0).map((_, i) => i % 3 === 2 ? 1 : 0), TVertices: [new Float32Array(count * 2)], Faces: new Uint16Array(faces), VertexGroup: new Uint8Array(count), Groups: [[sword.ObjectId]], TotalGroupsCount: 1, MaterialID: 0, SelectionGroup: 0, Unselectable: false, MinimumExtent: new Float32Array([2, y - 2, 19]), MaximumExtent: new Float32Array([78, y + 2, 21]), BoundsRadius: 40, Anims: [] });
    });
  });
  return doc;
}

test('origin glow is three pulsing team-glow ground planes at the feet', () => {
  const doc = hero(), before = structuredClone(doc.model), size = originGlowSize(doc.model);
  const result = doc.apply('Glow Up', [], m => addHeroGlow(m, { origin: true, brightness: .6 }));
  const m = doc.model, g = m.Geosets[result.geosetIndices[0]], layer = m.Materials[g.MaterialID].Layers[0];
  assert.equal(layer.FilterMode, 3); assert.equal(layer.Shading, 17); assert.equal(layer.Alpha, .6);
  assert.equal(m.Textures[layer.TextureID].ReplaceableId, 2);
  assert.equal(g.Groups.length, 3);
  const bones = g.Groups.map(([id]) => m.Nodes[id]);
  for (const [k, bone] of bones.entries()) {
    assert.equal(bone.Parent, null); assert.equal(bone.Flags, 256);
    assert.equal(bone.Scaling.LineType, 2); assert.ok(m.GlobalSequences[bone.Scaling.GlobalSeqId] > 1000);
    const quad = Array.from(g.Vertices.slice(k * 12, k * 12 + 12));
    // Flat, centred on the origin, pivot in the plane's middle.
    assert.ok([2, 5, 8, 11].every(i => quad[i] === quad[2]));
    near(quadCenters({ Vertices: quad }).flat(), Array.from(bone.PivotPoint));
    near(bone.PivotPoint.slice(0, 2), [0, 0]);
  }
  // Paladin template: widths 0.89 / 1 / 0.75 of the fitted size, rising 7 → 26.
  const widths = bones.map((_, k) => g.Vertices[k * 12 + 3] - g.Vertices[k * 12]);
  near(widths, [.887 * size, size, .745 * size], .01);
  assert.ok(bones[0].PivotPoint[2] < bones[1].PivotPoint[2] && bones[1].PivotPoint[2] < bones[2].PivotPoint[2]);
  assert.equal(new Set(bones.map(b => b.Scaling.GlobalSeqId)).size, 3);
  assert.deepEqual(m.Geosets.slice(0, before.Geosets.length), before.Geosets);
  assert.deepEqual(m.Bones.slice(0, before.Bones.length), before.Bones);
  assert.equal(hasHeroGlow(before), false); assert.equal(hasHeroGlow(m), true);
  doc.undo(); assert.deepEqual(doc.model, before);
});

test('glow hides in Death, Decay and Dissipate and ignores unkeyable sequences', () => {
  const doc = hero({ sequences: ['Stand', 'Death', 'Stand Ready', 'Decay Bone', 'Dissipate', 'Walk'] });
  doc.apply('Glow Up', [], m => addHeroGlow(m, { origin: true }));
  const anim = doc.model.GeosetAnims.at(-1);
  assert.deepEqual(anim.Alpha.Keys.map(k => [k.Frame, k.Vector[0]]), [[0, 1], [1000, 0], [2000, 1], [3000, 0], [4000, 0], [5000, 1]]);
  const stray = hero({ sequences: ['Stand'] });
  // Blizzard's Far Seer opens with a stray sequence at an unsigned -167; a shared start stays visible.
  const m = structuredClone(stray.model);
  m.Sequences.unshift({ ...structuredClone(m.Sequences[0]), Name: 'nothing', Interval: new Uint32Array([4294967129, 0]) });
  m.Sequences.push({ ...structuredClone(m.Sequences[1]), Name: 'Death', Interval: new Uint32Array([0, 500]) });
  addHeroGlow(m, { origin: true });
  assert.deepEqual(m.GeosetAnims.at(-1).Alpha.Keys.map(k => [k.Frame, k.Vector[0]]), [[0, 1]]);
  const plain = hero({ sequences: ['Stand'] });
  plain.apply('Glow Up', [], m => addHeroGlow(m, { origin: true }));
  assert.equal(plain.model.GeosetAnims.at(-1).Alpha, 1);
});

test('the sword is found by name and glows from past the grip to the tip', () => {
  const doc = hero(), m = doc.model, sword = m.Bones.find(b => b.Name === 'Sword');
  const [best] = weaponChoices(m);
  assert.deepEqual(best.ids, [sword.ObjectId]); assert.equal(best.sure, true);
  const line = weaponLine(m, { weaponId: sword.ObjectId });
  assert.ok(line.start[0] > 20 && line.end[0] > line.start[0] && Math.abs(line.end[0] - 78) < .5, JSON.stringify(line));
  const result = doc.apply('Glow Up', [], model => addHeroGlow(model, { origin: false, weapon: true, weaponIds: best.ids }));
  const g = doc.model.Geosets[result.geosetIndices[0]], centers = quadCenters(g);
  assert.ok(centers.length >= 3);
  centers.forEach((c, k) => {
    const bone = doc.model.Nodes[g.Groups[k][0]];
    assert.equal(bone.Flags, 256 | 8); assert.equal(bone.Parent, sword.ObjectId);
    near(c, Array.from(bone.PivotPoint));
    // Camera-facing quads are authored in YZ, facing +X.
    assert.ok([0, 3, 6, 9].every(i => Math.abs(g.Vertices[k * 12 + i] - c[0]) < 1e-4));
    if (k) assert.ok(c[0] > centers[k - 1][0]);
  });
  const width = k => g.Vertices[k * 12 + 4] - g.Vertices[k * 12 + 1];
  assert.ok(width(centers.length - 1) < width(Math.floor(centers.length / 2)), 'the tip tapers');
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format)).model, saved = reopened.Geosets[result.geosetIndices[0]];
    assert.deepEqual(saved.Vertices, g.Vertices);
    assert.ok(saved.Groups.every(([id]) => reopened.Nodes[id].Flags === 264 && reopened.Nodes[reopened.Nodes[id].Parent].Name === 'Sword'));
  }
});

test('mirrored weapons are offered together, and marked polygons come first', () => {
  const doc = hero({ swords: ['Mesh sword_R', 'Mesh sword_L'] }), m = doc.model;
  const [pair] = weaponChoices(m);
  assert.equal(pair.ids.length, 2); assert.equal(pair.sure, true);
  const result = doc.apply('Glow Up', [], model => addHeroGlow(model, { origin: true, weapon: true, weaponIds: pair.ids }));
  const parents = new Set(doc.model.Geosets[result.geosetIndices[1]].Groups.map(([id]) => doc.model.Nodes[doc.model.Nodes[id].Parent].Name));
  assert.deepEqual([...parents].sort(), ['Mesh sword_L', 'Mesh sword_R']);
  const marked = { 1: Array.from({ length: 28 }, (_, i) => i) }, [first] = weaponChoices(m, marked);
  assert.equal(first.key, 'marked');
  const copy = structuredClone(m); addHeroGlow(copy, { origin: false, weapon: true, marked });
  assert.ok(copy.Geosets.at(-1).Groups.every(([id]) => copy.Nodes[copy.Nodes[id].Parent].Name === 'Mesh sword_R'));
});

test('a model without a named weapon starts with weapon glow off', () => {
  const doc = createStarterDocument();
  assert.ok(weaponChoices(doc.model).every(c => !c.sure));
  assert.throws(() => addHeroGlow(structuredClone(doc.model), { origin: false, weapon: true }), /weapon/);
  assert.throws(() => addHeroGlow(structuredClone(doc.model), { origin: false, weapon: false }), /origin glow, weapon glow, or both/);
});

test('origin size follows body height, with big bodies relatively smaller', () => {
  const small = createStarterDocument().model, tall = structuredClone(small);
  tall.Geosets[0].Vertices = tall.Geosets[0].Vertices.map((v, i) => i % 3 === 2 ? v * 4 + 96 : v);
  const a = originGlowSize(small), b = originGlowSize(tall);
  assert.ok(b > a && b / a < 4, `${a} ${b}`);
  assert.ok(a >= 150 && b <= 600);
});

test('weapon glow follows the sword and keeps facing the camera', () => {
  const doc = hero(), m = doc.model, sword = m.Bones.find(b => b.Name === 'Sword');
  m.Sequences = [{ Name: 'Swing', Interval: new Uint32Array([0, 1000]) }];
  sword.Translation = { LineType: 1, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: new Float32Array([0, 0, 0]) }, { Frame: 1000, Vector: new Float32Array([30, 20, 10]) }] };
  const result = addHeroGlow(m, { origin: false, weapon: true, weaponIds: [sword.ObjectId] });
  const g = m.Geosets[result.geosetIndices[0]];
  for (let k = 0; k < g.Groups.length; k++) {
    const bone = m.Nodes[g.Groups[k][0]], expected = new Vector3().fromArray(bone.PivotPoint).applyMatrix4(sampleNodeMatrices(m, 1000, 0).get(bone.Parent));
    for (const position of [[200, 0, 0], [-130, 90, 150], [0, 200, 40]]) {
      const camera = new PerspectiveCamera(); camera.up.set(0, 0, 1); camera.position.set(...position); camera.lookAt(expected); camera.updateMatrixWorld();
      const points = skinGeoset(g, samplePreviewMatrices(m, 1000, 0, 1000, camera)), quad = Array.from(points.slice(k * 12, k * 12 + 12));
      near(quadCenters({ Vertices: quad })[0], expected.toArray(), 1e-2);
      const normal = new Vector3().fromArray(quad, 3).sub(new Vector3().fromArray(quad, 0)).cross(new Vector3().fromArray(quad, 9).sub(new Vector3().fromArray(quad, 0))).normalize();
      assert.ok(Math.abs(normal.dot(camera.position.clone().sub(expected).normalize())) > .99, 'faces the camera');
    }
  }
});

test('From and To put a small glow on just the tip', () => {
  const doc = hero(), m = doc.model, sword = m.Bones.find(b => b.Name === 'Sword');
  const full = weaponLine(m, { weaponId: sword.ObjectId });
  assert.ok(full.from > 0 && full.from < 1 && full.to === 1);
  const tip = weaponLine(m, { weaponId: sword.ObjectId, from: .85, to: 1 });
  near(tip.end, full.end); assert.ok(tip.start[0] > 60, JSON.stringify(tip));
  assert.deepEqual(weaponLine(m, { weaponId: sword.ObjectId, from: 1, to: .85 }), tip, 'reversed sliders mean the same stretch');
  const all = addHeroGlow(structuredClone(m), { origin: false, weapon: true, weaponIds: [sword.ObjectId] }).geosetIndices;
  const copy = structuredClone(m), small = addHeroGlow(copy, { origin: false, weapon: true, weaponIds: [sword.ObjectId], weaponFrom: .85, weaponTo: 1, weaponSize: .3 });
  const g = copy.Geosets[small.geosetIndices[0]], centers = quadCenters(g);
  assert.ok(centers.length >= 1 && centers.length <= 3 && all.length === 1);
  assert.ok(centers.every(c => c[0] > 60), 'all squares sit on the tip');
  const single = structuredClone(m); addHeroGlow(single, { origin: false, weapon: true, weaponIds: [sword.ObjectId], weaponFrom: .97, weaponTo: .97 });
  assert.equal(single.Geosets.at(-1).Groups.length, 1);
});

test('handle layout matches what Create builds, and Move shifts the ground glow', () => {
  const doc = hero(), m = doc.model, sword = m.Bones.find(b => b.Name === 'Sword');
  const options = { origin: true, originSize: 1.3, originOffset: [12, -7], weapon: true, weaponIds: [sword.ObjectId], weaponFrom: .5, weaponTo: .9, weaponSize: .8 };
  const layout = glowLayout(m, options), copy = structuredClone(m), result = addHeroGlow(copy, options);
  const origin = copy.Geosets[result.geosetIndices[0]], plane = Array.from(origin.Vertices.slice(12, 24));
  near(layout.origin.center, quadCenters({ Vertices: plane })[0]);
  near([layout.origin.half * 2], [plane[3] - plane[0]]);
  const bones = origin.Groups.map(([id]) => copy.Nodes[id]);
  assert.ok(bones.every(b => Math.abs(b.PivotPoint[0] - 12) < 1e-4 && Math.abs(b.PivotPoint[1] + 7) < 1e-4));
  const [w] = layout.weapons, centers = quadCenters(copy.Geosets[result.geosetIndices[1]]);
  near(w.start, centers[0]); near(w.end, centers.at(-1)); assert.equal(w.parentId, sword.ObjectId);
  assert.ok(w.butt[0] < w.start[0] && w.tip[0] >= w.end[0]);
  assert.throws(() => addHeroGlow(structuredClone(m), { origin: true, originOffset: [NaN, 0] }), /position/);
});

test('weapon glow ends leave the weapon line and run past the tip', () => {
  const doc = hero(), m = doc.model, sword = m.Bones.find(b => b.Name === 'Sword');
  const straight = weaponLine(m, { weaponId: sword.ObjectId, from: .5, to: 1 });
  const bent = weaponLine(m, { weaponId: sword.ObjectId, from: .5, to: [1.2, .3, 0] }), { along, side, size } = bent.frame;
  near(bent.start, straight.start);
  const offset = bent.end.map((v, a) => v - straight.end[a]);
  near([offset.reduce((s, v, a) => s + v * along[a], 0) / size, offset.reduce((s, v, a) => s + v * side[a], 0) / size], [.2, .3], 1e-4);
  assert.deepEqual(weaponLine(m, { weaponId: sword.ObjectId, to: [9, 9, 9] }).to, [1.5, 1, 1], 'ends stay near the weapon');
  const copy = structuredClone(m), result = addHeroGlow(copy, { origin: false, weapon: true, weaponIds: [sword.ObjectId], weaponFrom: .5, weaponTo: [1.2, .3, 0] });
  near(quadCenters(copy.Geosets[result.geosetIndices[0]]).at(-1), bent.end);
});

test('origin and weapon glow have their own brightness', () => {
  const doc = hero(), m = doc.model, sword = m.Bones.find(b => b.Name === 'Sword'), materials = m.Materials.length;
  const apart = structuredClone(m), split = addHeroGlow(apart, { weapon: true, weaponIds: [sword.ObjectId], originBrightness: .4, weaponBrightness: 1 });
  assert.equal(apart.Materials.length, materials + 2);
  assert.deepEqual(split.geosetIndices.map(i => apart.Materials[apart.Geosets[i].MaterialID].Layers[0].Alpha), [.4, 1]);
  const same = structuredClone(m); addHeroGlow(same, { weapon: true, weaponIds: [sword.ObjectId], brightness: .6 });
  assert.equal(same.Materials.length, materials + 1, 'equal brightness shares one material');
  const only = structuredClone(m); addHeroGlow(only, { origin: false, weapon: true, weaponIds: [sword.ObjectId], originBrightness: .2, weaponBrightness: .9 });
  assert.equal(only.Materials.at(-1).Layers[0].Alpha, .9);
});

test('a glow across a hammer head keeps its dragged ends apart', () => {
  const doc = hero(), m = doc.model, sword = m.Bones.find(b => b.Name === 'Sword');
  // Both ends near the tip, one on each side: the start is further along than the end.
  const across = weaponLine(m, { weaponId: sword.ObjectId, from: [1.02, -.3, 0], to: [1, .3, 0] }), { side } = across.frame;
  assert.ok(across.start.reduce((s, v, a) => s + (v - across.end[a]) * side[a], 0) < 0, 'the start stays on its own side');
  assert.deepEqual(across.from, [1.02, -.3, 0]);
  assert.ok(weaponCandidates({ ...m, Bones: m.Bones.map(b => b === sword ? { ...b, Name: 'Wep' } : b) })[0].score >= 4, 'Wep is a weapon name');
});


test('glow visibility classifies Death, Decay and Dissipate by their first word', () => {
  const names = ['Undeath', 'Stand - Death', 'Stand Decay', 'Stand Dissipate', 'Death Alternate', 'Decay Flesh', 'Dissipate'];
  const doc = hero({ sequences: names });
  const result = addHeroGlow(doc.model, { origin: true });
  for (const id of result.geosetIndices) for (const [index, sequence] of doc.model.Sequences.entries()) {
    assert.equal(sampleGeosetAnimation(doc.model, id, sequence.Interval[0], index).alpha, index < 4 ? 1 : 0, sequence.Name);
  }
});

test('TextureID tracks count as hero glow while each glow filter rule stays local', () => {
  const model = hero().model, size = originGlowSize(model);
  const result = addHeroGlow(model, { origin: true });
  const geoset = model.Geosets[result.geosetIndices[0]], layer = model.Materials[geoset.MaterialID].Layers[0];
  const textureId = layer.TextureID;
  layer.TextureID = { LineType: 0, GlobalSeqId: null, Keys: [0, 1000].map((Frame, i) => ({ Frame, Vector: Int32Array.of(i ? textureId : 0) })) };
  geoset.Vertices = geoset.Vertices.map((v, i) => i % 3 === 2 ? 10000 : v);
  assert.equal(hasHeroGlow(model), true);
  assert.equal(originGlowSize(model), size, 'some team-glow key excludes the geoset from body sizing');
  layer.FilterMode = 0;
  assert.equal(hasHeroGlow(model), false, 'visible hero glow still requires additive filtering');
  assert.equal(originGlowSize(model), size, 'body sizing still ignores glow regardless of filter');
});

// A model that already glows: Glow Up adjusts its glow and offers repairs (docs/GLOW_UP.md).
const glowed = (options = {}) => {
  const doc = hero(), m = doc.model, sword = m.Bones.find(b => b.Name === 'Sword');
  addHeroGlow(m, { origin: true, weapon: true, weaponIds: [sword.ObjectId], weaponFrom: .5, weaponTo: .9, ...options });
  return { m, sword };
};
const counts = m => [m.Geosets.length, m.Bones.length, m.Materials.length, m.GeosetAnims.length];
const ownOptions = (m, change = {}) => ({ ...glowStart(m), ...change });

test('on a model that glows, Glow Up starts from its own glow and an unchanged Apply changes nothing', () => {
  const { m } = glowed({ originOffset: [10, 5], originSize: 1.2, brightness: .6 }), found = findHeroGlow(m), start = glowStart(m);
  assert.equal(found.origin.pieces.length, 3); assert.ok(found.weapon.pieces.length > 1); assert.equal(m.Bones.find(b => b.ObjectId === found.weapon.anchor).Name, 'Sword');
  assert.deepEqual([start.origin, start.weapon, start.originBrightness, start.weaponBrightness], [true, true, .6, .6]);
  near(start.originOffset, [10, 5]);
  const layout = glowLayout(m, start), widest = found.origin.pieces.reduce((a, b) => b.width > a.width ? b : a);
  near(layout.origin.center, widest.center); near([layout.origin.half * 2], [widest.width]);
  near(layout.weapons[0].start, found.weapon.start); near(layout.weapons[0].end, found.weapon.end);
  const before = structuredClone(m);
  glowUp(m, start);
  assert.deepEqual(m, before, 'adjusting nothing leaves the model alone');
  assert.deepEqual(heroGlowFaults(m), [], 'Glow Up’s own glow is built like Blizzard’s');
});

test('Glow Up moves, resizes and brightens the model’s own glow without adding any', () => {
  const { m, sword } = glowed(), found = findHeroGlow(m), was = counts(m), start = glowStart(m);
  const plane = found.origin.pieces[1], bone = m.Nodes[plane.bones[0]], width = plane.width;
  glowUp(m, { ...start, originOffset: [start.originOffset[0] + 20, start.originOffset[1] - 8], originSize: start.originSize * 1.5, weaponSize: .5, weaponTo: [.95, 0, 0], originBrightness: .4, weaponBrightness: .4 });
  assert.deepEqual(counts(m), was, 'no new geosets, bones, materials or geoset animations');
  const moved = findHeroGlow(m), after = moved.origin.pieces.find(p => p.bones[0] === bone.ObjectId);
  near([after.width], [width * 1.5]); near(after.center.slice(0, 2), [plane.center[0] + 20, plane.center[1] - 8]);
  near(Array.from(bone.PivotPoint), after.center, 1e-3);
  assert.ok(moved.weapon.half < found.weapon.half * .6, 'weapon squares shrink about their centres');
  near(moved.weapon.end, weaponLine(m, { weaponId: sword.ObjectId, from: found.weapon.from, to: [.95, 0, 0] }).end);
  near(moved.weapon.start, found.weapon.start);
  assert.equal(m.Materials[m.Geosets[plane.geoset].MaterialID].Layers[0].Alpha, .4);
});

test('a brightness change on a shared glow material splits it, reusing an identical material', () => {
  const { m } = glowed(), was = m.Materials.length, found = findHeroGlow(m), [origin, weapon] = [found.origin.pieces[0], found.weapon.pieces[0]].map(p => m.Geosets[p.geoset]);
  assert.equal(origin.MaterialID, weapon.MaterialID);
  const apart = structuredClone(m); glowUp(apart, ownOptions(apart, { originBrightness: .5 }));
  assert.equal(apart.Materials.length, was + 1); assert.equal(apart.Materials[apart.Geosets.at(-2).MaterialID].Layers[0].Alpha, .5); assert.equal(apart.Materials[apart.Geosets.at(-1).MaterialID].Layers[0].Alpha, .75);
  const reuse = structuredClone(m), copy = structuredClone(reuse.Materials[origin.MaterialID]); copy.Layers[0].Alpha = .5; reuse.Materials.push(copy);
  glowUp(reuse, ownOptions(reuse, { originBrightness: .5 }));
  assert.equal(reuse.Materials.length, was + 1, 'the identical material already in the model is used');
});

test('a glow kind the model lacks is added only when ticked, on the same team-glow material', () => {
  const doc = hero(), m = doc.model, sword = m.Bones.find(b => b.Name === 'Sword');
  addHeroGlow(m, { origin: true });
  const start = glowStart(m), materials = m.Materials.length, geosets = m.Geosets.length;
  assert.deepEqual([start.origin, start.weapon], [true, false]);
  glowUp(m, start); assert.equal(m.Geosets.length, geosets);
  glowUp(m, { ...start, weapon: true, weaponIds: [sword.ObjectId] });
  assert.equal(m.Geosets.length, geosets + 1); assert.equal(m.Materials.length, materials, 'identical team-glow material reused');
  assert.equal(findHeroGlow(m).origin.pieces.length, 3, 'the ground glow is not added twice');
});

test('ground glow without a global animation gets the Paladin pulse on its own bones', () => {
  const { m } = glowed(), bones = findHeroGlow(m).origin.pieces.map(p => m.Nodes[p.bones[0]]), count = m.Bones.length;
  for (const bone of bones) delete bone.Scaling;
  assert.deepEqual(heroGlowFaults(m).map(f => [f.key, f.count]), [['pulse', 3]]);
  assert.equal(repairHeroGlow(m), 3);
  assert.equal(m.Bones.length, count, 'the planes’ own bones are reused');
  for (const bone of bones) assert.ok(m.GlobalSequences[bone.Scaling.GlobalSeqId] > 1000);
  assert.deepEqual(heroGlowFaults(m), []);
});

test('ground glow on the body’s bone or on no bone gets bones of its own', () => {
  for (const fault of ['ground-bone', 'unbound']) {
    const { m } = glowed(), found = findHeroGlow(m), g = m.Geosets[found.origin.pieces[0].geoset], body = m.Bones.find(b => b.Name === 'Bone_Root');
    if (fault === 'unbound') g.Groups = g.Groups.map(() => [999]);
    else bindVertices(m, g, found.origin.pieces.flatMap(p => p.vertices), body.ObjectId);
    assert.deepEqual(heroGlowFaults(m).map(f => [f.key, f.count]), [[fault, 3]], fault);
    repairHeroGlow(m);
    const fixed = findHeroGlow(m).origin.pieces.map(p => m.Nodes[p.bones[0]]);
    assert.ok(fixed.every(b => b.Parent === null && b.Scaling.GlobalSeqId != null && /^Glow Origin \d+$/.test(b.Name)), fault);
    assert.deepEqual(heroGlowFaults(m), [], fault);
  }
});

test('glow squares that are not billboarded, not on own bones or not facing +X are repaired to face the camera', () => {
  // Not billboarded: the squares' own bones are reused.
  const flat = glowed().m, squares = findHeroGlow(flat).weapon.pieces, count = flat.Bones.length;
  for (const p of squares) flat.Nodes[p.bones[0]].Flags = 256;
  assert.deepEqual(heroGlowFaults(flat).map(f => f.key), ['billboard']);
  repairHeroGlow(flat);
  assert.equal(flat.Bones.length, count); assert.ok(squares.every(p => flat.Nodes[p.bones[0]].Flags & 8));
  // On the sword's own bone, laid along XZ: each square gets a Billboarded bone under the sword and is laid in YZ.
  const { m, sword } = glowed(), weapon = findHeroGlow(m).weapon, g = m.Geosets[weapon.pieces[0].geoset];
  for (const p of weapon.pieces) for (const v of p.vertices) { const [x, y, z] = [0, 1, 2].map(a => g.Vertices[v * 3 + a]); g.Vertices.set([p.center[0] + (y - p.center[1]), p.center[1], z], v * 3); }
  bindVertices(m, g, weapon.pieces.flatMap(p => p.vertices), sword.ObjectId);
  assert.deepEqual(heroGlowFaults(m).map(f => [f.key, f.count]), [['billboard', weapon.pieces.length]]);
  repairHeroGlow(m);
  const fixed = findHeroGlow(m).weapon;
  assert.equal(fixed.anchor, sword.ObjectId, 'the squares still follow the sword');
  for (const p of fixed.pieces) {
    const bone = m.Nodes[p.bones[0]];
    assert.ok(bone.Flags & 8 && bone.Parent === sword.ObjectId && /^Glow Weapon \d+$/.test(bone.Name));
    near(Array.from(bone.PivotPoint), p.center); assert.ok(Math.abs(p.normal[0]) > .99, 'built facing +X');
  }
  assert.deepEqual(heroGlowFaults(m), []);
  m.Sequences = [{ Name: 'Stand', Interval: new Uint32Array([0, 1000]) }];
  const p = fixed.pieces[0], expected = new Vector3().fromArray(m.Nodes[p.bones[0]].PivotPoint), camera = new PerspectiveCamera();
  camera.up.set(0, 0, 1); camera.position.set(-130, 90, 150); camera.lookAt(expected); camera.updateMatrixWorld();
  const points = skinGeoset(m.Geosets[p.geoset], samplePreviewMatrices(m, 0, 0, 1000, camera)), [a, b, c] = p.vertices.slice(0, 3).map(v => new Vector3().fromArray(points, v * 3));
  assert.ok(Math.abs(b.clone().sub(a).cross(c.clone().sub(a)).normalize().dot(camera.position.clone().sub(expected).normalize())) > .99, 'faces the camera');
});
