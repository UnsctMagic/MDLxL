import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import * as statue from '../src/sd-statue.js';
import { adopt } from '../src/sd-kitbash.js';

// A small winged creature: body (with a team-colour layer), head, two wings, two legs and a tail, each
// a box on its own bone. Stand keeps the bind pose, Spell raises the wings and lifts the head, Walk
// folds the wings down.
const q = (axis, deg) => { const a = (deg * Math.PI) / 360, s = Math.sin(a); return new Float32Array(axis === 'x' ? [s, 0, 0, Math.cos(a)] : [0, s, 0, Math.cos(a)]); };
function creature() {
  const doc = openDocument(new TextEncoder().encode('Version { FormatVersion 800, }\nModel "Wyrm" { BlendTime 150, }\n'), 'Wyrm.mdl'), m = doc.model;
  m.Textures = [{ Image: 'Textures\\Wyrm.blp', ReplaceableId: 0, Flags: 0 }, { Image: '', ReplaceableId: 1, Flags: 0 }];
  const layer = (TextureID, FilterMode) => ({ FilterMode, Shading: 0, TextureID, TVertexAnimId: null, CoordId: 0, Alpha: 1 });
  m.Materials = [{ PriorityPlane: 0, RenderMode: 0, Layers: [layer(0, 0)] }, { PriorityPlane: 0, RenderMode: 0, Layers: [layer(1, 0), layer(0, 2)] }];
  const bones = [['Body', null, [0, 0, 40]], ['Head', 0, [30, 0, 50]], ['WingL', 0, [0, 8, 50]], ['WingR', 0, [0, -8, 50]], ['LegL', 0, [0, 6, 30]], ['LegR', 0, [0, -6, 30]], ['Tail', 0, [-25, 0, 40]]];
  m.Bones = bones.map(([Name, Parent, p], ObjectId) => ({ Name, ObjectId, Parent, PivotPoint: new Float32Array(p), Flags: 256, GeosetId: null, GeosetAnimId: null }));
  m.Nodes = [...m.Bones]; m.PivotPoints = m.Bones.map(b => b.PivotPoint);
  const box = (lo, hi, bone, material = 0) => {
    const V = [], N = [], U = [], F = [];
    const sides = [[[0, 0, -1], [0, 2, 3, 1]], [[0, 0, 1], [4, 5, 7, 6]], [[0, -1, 0], [0, 1, 5, 4]], [[0, 1, 0], [2, 6, 7, 3]], [[-1, 0, 0], [0, 4, 6, 2]], [[1, 0, 0], [1, 3, 7, 5]]];
    // Every box uses the same small area of the sheet, as game models share paint.
    sides.forEach(([n, quad], k) => { const base = V.length / 3; quad.forEach((c, j) => { V.push(c & 1 ? hi[0] : lo[0], c & 2 ? hi[1] : lo[1], c & 4 ? hi[2] : lo[2]); N.push(...n); U.push((k % 3) / 3 + (j === 1 || j === 2 ? 0.3 : 0), Math.floor(k / 3) / 2 + (j >= 2 ? 0.45 : 0)); }); F.push(base, base + 1, base + 2, base, base + 2, base + 3); });
    m.Geosets.push({ Vertices: new Float32Array(V), Normals: new Float32Array(N), TVertices: [new Float32Array(U)], VertexGroup: new Uint8Array(V.length / 3), Groups: [[bone]], TotalGroupsCount: 1, Faces: new Uint16Array(F), MaterialID: material, SelectionGroup: 0, Unselectable: false, MinimumExtent: new Float32Array(lo), MaximumExtent: new Float32Array(hi), BoundsRadius: 50, Anims: [] });
  };
  box([-25, -8, 30], [25, 8, 50], 0, 1); box([25, -5, 45], [42, 5, 58], 1); box([-8, 8, 48], [8, 60, 51], 2); box([-8, -60, 48], [8, -8, 51], 3);
  box([-4, 3, 0], [4, 9, 32], 4); box([-4, -9, 0], [4, -3, 32], 5); box([-60, -3, 36], [-25, 3, 42], 6);
  m.Sequences = [['Stand', [0, 1000]], ['Spell', [2000, 3000]], ['Walk', [4000, 5000]]].map(([Name, i]) => ({ Name, Interval: new Uint32Array(i), NonLooping: false, MoveSpeed: 0, Rarity: 0, MinimumExtent: new Float32Array([-60, -60, 0]), MaximumExtent: new Float32Array([60, 60, 60]), BoundsRadius: 80 }));
  const track = keys => ({ LineType: 1, GlobalSeqId: null, Keys: keys.map(([Frame, Vector]) => ({ Frame, Vector })) });
  m.Bones[2].Rotation = track([[0, q('x', 0)], [1000, q('x', 0)], [2000, q('x', 0)], [2500, q('x', 55)], [3000, q('x', 0)], [4000, q('x', -50)], [5000, q('x', -50)]]);
  m.Bones[3].Rotation = track([[0, q('x', 0)], [1000, q('x', 0)], [2000, q('x', 0)], [2500, q('x', -55)], [3000, q('x', 0)], [4000, q('x', 50)], [5000, q('x', 50)]]);
  m.Bones[1].Rotation = track([[2000, q('y', 0)], [2500, q('y', -30)], [3000, q('y', 0)]]);
  return doc;
}
const tgaPixel = (tga, u, v) => { const w = tga[12] | (tga[13] << 8), h = tga[14] | (tga[15] << 8), x = Math.min(w - 1, Math.floor(u * w)), y = Math.min(h - 1, Math.floor(v * h)), i = 18 + (y * w + x) * 4; return [tga[i + 2], tga[i + 1], tga[i]]; };
const lum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
const zRange = model => { let lo = Infinity, hi = -Infinity; for (const g of model.Geosets) for (let i = 2; i < g.Vertices.length; i += 3) { lo = Math.min(lo, g.Vertices[i]); hi = Math.max(hi, g.Vertices[i]); } return [lo, hi]; };

test('SD Statue picks a strong pose, not Stand: wings raised, head up, standing on its feet', () => {
  const model = creature().model, poses = statue.choosePose(model);
  assert.equal(poses[0].name, 'Spell');
  assert.ok(poses[0].at > 0.3 && poses[0].at < 0.7, `the moment the wings are up, got ${poses[0].at}`);
  assert.ok(poses[0].measures.wingsUp > 0.15 && poses[0].measures.headUp > 0, JSON.stringify(poses[0].measures));
  assert.ok(poses.every(p => p.name !== 'Stand'), 'Stand and the bind pose are never offered');
  assert.equal(statue.choosePose(model, { sequences: ['Walk'] })[0].name, 'Walk');
  assert.throws(() => statue.bakePose(model, { sequence: 'Fly' }), /No animation named like Fly/);
});

test('SD Statue bakes the pose onto one bone with one Stand, adds a pedestal and paints one stone texture; saves as MDX and MDL', () => {
  const doc = creature();
  let pose, baked, pedestal, paint, report;
  doc.apply('Statue', [], model => {
    pose = statue.choosePose(model)[0];
    const posedTip = Math.max(...statue.posedMesh(model, pose).geosets.find(g => g.index === 2).positions.filter((_, i) => i % 3 === 2));
    baked = statue.bakePose(model, { ...pose, name: 'WyrmStatue' });
    // Frozen in the pose: the left wing stays raised as at that frame (the feet were already on z = 0).
    assert.ok(Math.abs(Math.max(...model.Geosets[2].Vertices.filter((_, i) => i % 3 === 2)) - posedTip) < 1e-3 && posedTip > 70, 'the wing stays up');
    assert.equal(model.Version, 800);
    assert.deepEqual(model.Bones.map(b => b.Name), ['WyrmStatue']);
    assert.deepEqual(model.Sequences.map(s => s.Name), ['Stand']);
    for (const key of ['Helpers', 'Attachments', 'ParticleEmitters2', 'EventObjects', 'CollisionShapes', 'GeosetAnims']) assert.equal((model[key] || []).length, 0, key);
    assert.ok(model.Geosets.every(g => g.Groups.length === 1 && g.Groups[0][0] === model.Bones[0].ObjectId));
    assert.ok(!model.Textures.some(t => t.ReplaceableId), 'no team colour on a statue');
    assert.ok(Math.abs(zRange(model)[0]) < 1e-3, 'stands on the ground');
    pedestal = statue.addPedestal(model, { shape: 'octagon' });
    paint = statue.paintStatueTexture(model, { size: 256, name: 'WyrmStatue', material: 'stone' });
    report = statue.statueReport(model);
  });
  const model = doc.model;
  assert.equal(baked.triangles, 84);
  // The statue stands on the pedestal: its feet sink a little into the top, nothing floats below it.
  assert.ok(pedestal.height > 10 && pedestal.triangles > 30);
  assert.ok(Math.abs(zRange(model)[0]) < 1e-3);
  // One texture, opaque, painted for the model's own islands: every UV inside the sheet, light from above.
  assert.equal(model.Textures.length, 1);
  assert.equal(model.Textures[0].Image, 'MDLxL_Forge\\SD_WyrmStatue.tga');
  assert.equal(paint.assets[0].name, model.Textures[0].Image);
  assert.ok(model.Materials.every(m => m.Layers.length === 1 && m.Layers[0].TextureID === 0 && m.Layers[0].FilterMode === 0));
  const tga = paint.assets[0].bytes;
  assert.equal(tga[12] | (tga[13] << 8), 256);
  const ups = [], downs = [];
  for (const g of model.Geosets.slice(0, 7)) {
    const uv = g.TVertices[0];
    assert.ok([...uv].every(v => v >= 0 && v <= 1));
    for (let f = 0; f < g.Faces.length; f += 3) {
      const t = [g.Faces[f], g.Faces[f + 1], g.Faces[f + 2]], nz = t.reduce((s, v) => s + g.Normals[v * 3 + 2], 0) / 3;
      const c = tgaPixel(tga, t.reduce((s, v) => s + uv[v * 2], 0) / 3, t.reduce((s, v) => s + uv[v * 2 + 1], 0) / 3);
      if (nz > 0.9) ups.push(lum(c)); else if (nz < -0.9) downs.push(lum(c));
    }
  }
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  assert.ok(mean(ups) > mean(downs) + 30, `tops ${mean(ups)} brighter than undersides ${mean(downs)}`);
  // Islands that shared paint (all boxes used one area) now each have their own texels.
  const owner = new Int32Array(256 * 256).fill(-1);
  let shared = 0, id = 0;
  for (const g of model.Geosets) {
    const uv = g.TVertices[0];
    for (let f = 0; f < g.Faces.length; f += 3, id++) {
      const P = [0, 1, 2].map(k => [uv[g.Faces[f + k] * 2] * 256, uv[g.Faces[f + k] * 2 + 1] * 256]);
      const det = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
      if (Math.abs(det) < 1e-9) continue;
      for (let y = Math.floor(Math.min(...P.map(p => p[1]))); y <= Math.ceil(Math.max(...P.map(p => p[1]))); y++) for (let x = Math.floor(Math.min(...P.map(p => p[0]))); x <= Math.ceil(Math.max(...P.map(p => p[0]))); x++) {
        const qx = x + 0.5, qy = y + 0.5, l1 = ((P[1][0] - qx) * (P[2][1] - qy) - (P[2][0] - qx) * (P[1][1] - qy)) / det, l2 = ((P[2][0] - qx) * (P[0][1] - qy) - (P[0][0] - qx) * (P[2][1] - qy)) / det;
        if (l1 < 0.05 || l2 < 0.05 || 1 - l1 - l2 < 0.05) continue;
        if (owner[y * 256 + x] >= 0 && owner[y * 256 + x] !== id) shared++;
        owner[y * 256 + x] = id;
      }
    }
  }
  assert.equal(shared, 0, 'no two triangles paint the same texels');
  assert.ok(report.passed, JSON.stringify(report.checks));
  assert.deepEqual(report.sequences, ['Stand']);
  for (const format of ['mdx', 'mdl']) {
    const reopened = openDocument(doc.serialize(format), 'WyrmStatue.' + format).model;
    assert.equal(reopened.Version, 800);
    assert.equal(reopened.Bones.length, 1);
    assert.equal(reopened.Geosets.reduce((n, g) => n + g.Faces.length / 3, 0), report.triangles);
    assert.equal(reopened.Textures[0].Image, 'MDLxL_Forge\\SD_WyrmStatue.tga');
  }
});

test('SD Statue: a destructible statue sinks into the ground on Death, like the game\'s statues', () => {
  const doc = creature();
  doc.apply('Statue', [], model => {
    statue.bakePose(model, { sequence: 'Spell', at: 0.5, death: true, rear: 10 });
    statue.addPedestal(model, { shape: 'square', height: 12 });
    statue.paintStatueTexture(model, { size: 128, material: 'bronze' });
  });
  const reopened = openDocument(doc.serialize('mdx'), 'x.mdx').model, root = reopened.Bones[0];
  assert.deepEqual(reopened.Sequences.map(s => [s.Name, s.NonLooping]), [['Stand', false], ['Death', true]]);
  const keys = root.Translation.Keys, height = zRange(reopened)[1];
  assert.equal(keys[0].Vector[2], 0);
  assert.ok(keys.at(-1).Vector[2] < -height, 'sinks below the ground');
  assert.ok(reopened.Sequences[1].MinimumExtent[2] < -height);
});

// The real thing: a dragon from the installed game, as in out/sd-statue/make-statue.mjs.
const game = 'D:/Warcraft III', bridge = new URL('../electron/casc/CascBridge-0.9.0.exe', import.meta.url);
test('SD Statue makes a clean dragon statue doodad from the game\'s Red Dragon', { skip: !(fs.existsSync(game) && fs.existsSync(bridge)) && 'needs the installed game' }, async () => {
  const { CascReader } = createRequire(import.meta.url)('../electron/casc.cjs');
  const casc = new CascReader(game, new URL('../electron', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
  let bytes;
  try { await casc.ready; bytes = await casc.read('war3.w3mod:units\\creeps\\reddragon\\reddragon.mdx'); } finally { casc.process.kill(); }
  // As SD Brain works: the dragon adopted into the open (empty, MDX 800) model.
  const dragon = openDocument(bytes, 'reddragon.mdx').model;
  const doc = openDocument(new TextEncoder().encode('Version { FormatVersion 800, }\nModel "DragonStatue" { BlendTime 150, }\n'), 'DragonStatue.mdl');
  let pose, paint, report;
  doc.apply('Dragon statue', [], model => {
    adopt(model, dragon);
    pose = statue.choosePose(model)[0];
    statue.bakePose(model, { ...pose, name: 'DragonStatue' });
    statue.addPedestal(model);
    paint = statue.paintStatueTexture(model, { size: 512, name: 'DragonStatue' });
    report = statue.statueReport(model);
  });
  assert.ok(!/stand/i.test(pose.name), `not the Stand pose: ${pose.name}`);
  assert.ok(pose.measures.wingSpan > 0.4 && pose.measures.wingsUp > 0, JSON.stringify(pose.measures));
  assert.ok(report.passed, JSON.stringify(report.checks));
  assert.ok(report.triangles >= 400 && report.triangles <= 900, String(report.triangles));
  assert.ok(report.size[2] > 150 && report.size[2] < 320, `height ${report.size[2]} beside a 98-unit Footman`);
  assert.deepEqual(paint.size, [512, 512]);
  const mdx = doc.serialize('mdx');
  assert.ok(mdx.byteLength < 60 * 1024, `${mdx.byteLength} bytes`);
  const reopened = openDocument(new Uint8Array(mdx), 'DragonStatue.mdx').model;
  assert.equal(reopened.Version, 800);
  assert.deepEqual(reopened.Textures.map(t => t.Image), ['MDLxL_Forge\\SD_DragonStatue.tga']);
  assert.equal(openDocument(doc.serialize('mdl'), 'DragonStatue.mdl').model.Geosets.reduce((n, g) => n + g.Faces.length / 3, 0), report.triangles);
});
