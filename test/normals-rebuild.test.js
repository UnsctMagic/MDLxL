import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyzeNormals, planNormalRebuild, applyNormalRebuild, previewNormalRebuild, remapVertexState, rebuildNormals } from '../src/normals-rebuild.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';

const at = (array, id, size = 3) => Array.from(array.subarray(id * size, id * size + size));
const near = (actual, expected, epsilon = 1e-5) => assert.ok(actual.every((v, i) => Math.abs(v - expected[i]) < epsilon), JSON.stringify({ actual, expected }));
const unit = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const faceNormal = (g, f) => {
  const [a, b, c] = at(g.Faces, f).map(id => at(g.Vertices, id));
  const u = b.map((v, i) => v - a[i]), w = c.map((v, i) => v - a[i]);
  return unit([u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]);
};
function geoset(positions, faces, extra = {}) {
  const count = positions.length / 3;
  return { Vertices: Float32Array.from(positions), Normals: new Float32Array(count * 3), Faces: Uint16Array.from(faces),
    TVertices: [Float32Array.from({ length: count * 2 }, (_, i) => i / (count * 2))], VertexGroup: new Uint8Array(count), Groups: [[0]], MaterialID: 0, ...extra };
}
const model = (...geosets) => ({ Geosets: geosets, Materials: [{ Layers: [{ Shading: 0 }] }] });
// A unit cube, wound outward; corner index = x + 2y + 4z.
const CUBE_POINTS = Array.from({ length: 8 }, (_, i) => [i & 1, (i >> 1) & 1, (i >> 2) & 1].map(v => v * 10)).flat();
const CUBE_FACES = [0,2,3, 0,3,1, 4,5,7, 4,7,6, 0,1,5, 0,5,4, 2,6,7, 2,7,3, 0,4,6, 0,6,2, 1,3,7, 1,7,5];
const insideOut = faces => faces.flatMap((_, i) => i % 3 ? [] : [faces[i], faces[i + 2], faces[i + 1]]);
const shifted = x => CUBE_POINTS.map((v, i) => i % 3 ? v : v + x);
const outward = (g, c = [5, 5, 5]) => { for (let f = 0; f < g.Faces.length / 3; f++) { const p = at(g.Vertices, g.Faces[f * 3]), n = faceNormal(g, f); assert.ok(n.reduce((s, v, i) => s + v * (p[i] - c[i]), 0) > 0, 'triangle ' + f + ' faces inward'); } };
const darkCorners = g => { let dark = 0; for (let f = 0; f < g.Faces.length / 3; f++) { const n = faceNormal(g, f); for (let k = 0; k < 3; k++) if (at(g.Normals, g.Faces[f * 3 + k]).reduce((s, v, i) => s + v * n[i], 0) < 0) dark++; } return dark; };

test('an inside-out closed cube is turned outward and keeps its hard corners', () => {
  const m = model(geoset(CUBE_POINTS, insideOut(CUBE_FACES)));
  const plan = rebuildNormals(m);
  const g = m.Geosets[0];
  assert.equal(plan.stats.trianglesFlipped, 12); assert.equal(plan.stats.piecesNeedLook, 0);
  outward(g);
  // 90° corners are sharper than the default 85° smoothing angle: 3 normals per corner.
  assert.equal(g.Vertices.length / 3, 24); assert.equal(plan.stats.verticesSplit, 16);
  for (let f = 0; f < 12; f++) for (let k = 0; k < 3; k++) near(at(g.Normals, g.Faces[f * 3 + k]), faceNormal(g, f));
  assert.equal(darkCorners(g), 0);
});

test('a correct cube is left facing the same way and above 90° it is smoothed', () => {
  const m = model(geoset(CUBE_POINTS, CUBE_FACES)), before = m.Geosets[0].Faces.slice();
  const plan = rebuildNormals(m, { smoothingAngle: 120 });
  assert.equal(plan.stats.trianglesFlipped, 0); assert.deepEqual(m.Geosets[0].Faces, before);
  assert.equal(m.Geosets[0].Vertices.length / 3, 8);
  near(at(m.Geosets[0].Normals, 7), unit([1, 1, 1]));
});

test('opposite-winding twins never smooth together, even with shared indices', () => {
  // One quad with both sides drawn using the same four vertex indices.
  const quad = [0,1,2, 0,2,3];
  const m = model(geoset([0,0,0, 10,0,0, 10,10,0, 0,10,0], [...quad, ...insideOut(quad)]));
  const plan = rebuildNormals(m, { smoothingAngle: 160 }), g = m.Geosets[0];
  assert.equal(plan.stats.trianglesFlipped, 0);
  assert.equal(g.Vertices.length / 3, 8, 'each side gets its own vertices');
  for (let f = 0; f < 4; f++) for (let k = 0; k < 3; k++) near(at(g.Normals, g.Faces[f * 3 + k]), faceNormal(g, f));
  near(faceNormal(g, 0), [0, 0, 1]); near(faceNormal(g, 2), [0, 0, -1]);
});

test('a double-sided sheet with separate vertices keeps both sides lit', () => {
  const front = [0,0,0, 10,0,0, 10,10,0, 0,10,0];
  const m = model(geoset([...front, ...front], [0,1,2, 0,2,3, 4,6,5, 4,7,6]));
  rebuildNormals(m); const g = m.Geosets[0];
  for (const id of [0, 1, 2, 3]) near(at(g.Normals, id), [0, 0, 1]);
  for (const id of [4, 5, 6, 7]) near(at(g.Normals, id), [0, 0, -1]);
  assert.deepEqual(Array.from(g.Faces), [0,1,2, 0,2,3, 4,6,5, 4,7,6]);
});

// Two triangles meeting at the X axis with a shallow fold of `degrees`.
function fold(degrees, { split = 'uv', geosets = 1 } = {}) {
  const r = degrees * Math.PI / 180, far = [0, -10 * Math.cos(r), -10 * Math.sin(r)];
  const a = [0,0,0, 10,0,0, 5,10,0], b = [0,0,0, 10,0,0, 5, ...far.slice(1)];
  if (geosets === 2) return model(geoset(a, [0,1,2]), geoset(b, [1,0,2]));
  const g = geoset([...a, ...b], [0,1,2, 4,3,5]);
  if (split === 'uv') g.TVertices[0].set([.9, .9, .8, .8], 6);
  return model(g);
}
test('lighting is smooth across a UV seam inside one geoset', () => {
  const m = fold(20); rebuildNormals(m); const g = m.Geosets[0];
  near(at(g.Normals, 0), at(g.Normals, 3)); near(at(g.Normals, 1), at(g.Normals, 4));
  near(at(g.Normals, 0), [0, -Math.sin(10 * Math.PI / 180), Math.cos(10 * Math.PI / 180)]);
  assert.deepEqual(at(g.TVertices[0], 3, 2).map(v => +v.toFixed(2)), [.9, .9], 'UVs untouched');
});
test('lighting is smooth across separate geosets', () => {
  const m = fold(20, { geosets: 2 }); rebuildNormals(m);
  near(at(m.Geosets[0].Normals, 0), at(m.Geosets[1].Normals, 1)); near(at(m.Geosets[0].Normals, 1), at(m.Geosets[1].Normals, 0));
  assert.equal(m.Geosets[1].Vertices.length / 3, 3, 'no vertices are moved between geosets');
});
test('a crease sharper than the smoothing angle stays crisp', () => {
  const m = fold(80); rebuildNormals(m, { smoothingAngle: 70 }); const g = m.Geosets[0];
  near(at(g.Normals, 0), [0, 0, 1]); near(at(g.Normals, 3), faceNormal(g, 1));
  const softer = fold(80); rebuildNormals(softer, { smoothingAngle: 90 });
  near(at(softer.Geosets[0].Normals, 0), at(softer.Geosets[0].Normals, 3));
});

test('an open flat sheet is not flipped when its outside cannot be decided', () => {
  const m = model(geoset([0,0,0, 10,0,0, 10,10,0, 0,10,0], [0,2,1, 0,3,2]));
  const plan = rebuildNormals(m);
  assert.equal(plan.stats.trianglesFlipped, 0); assert.deepEqual(Array.from(m.Geosets[0].Faces), [0,2,1, 0,3,2]);
  near(at(m.Geosets[0].Normals, 0), [0, 0, -1]);
});
test('a minority triangle on an open sheet is flipped to match its neighbours', () => {
  const m = model(geoset([0,0,0, 10,0,0, 10,10,0, 0,10,0, 20,0,0], [0,1,2, 0,2,3, 1,2,4]));
  const plan = rebuildNormals(m);
  assert.equal(plan.stats.trianglesFlipped, 1);
  for (let f = 0; f < 3; f++) near(faceNormal(m.Geosets[0], f), [0, 0, 1]);
});
test('an inside-out open box is turned outward when visibility is decisive', () => {
  const box = CUBE_FACES.slice(0, 6 * 3).concat(CUBE_FACES.slice(8 * 3)); // no +y lid
  const m = model(geoset(CUBE_POINTS, insideOut(box)));
  const plan = rebuildNormals(m);
  assert.equal(plan.stats.trianglesFlipped, 10); outward(m.Geosets[0]);
});

test('split vertices keep position, every UV set, bone group, skin weights and get tangents', () => {
  const g = geoset(CUBE_POINTS, CUBE_FACES, { Groups: [[0], [1]], VertexGroup: Uint8Array.from({ length: 8 }, (_, i) => i & 1) });
  g.TVertices.push(Float32Array.from({ length: 16 }, (_, i) => 1 - i / 16));
  g.SkinWeights = Uint8Array.from({ length: 64 }, (_, i) => i % 8 === 0 ? i / 8 : i % 8 === 4 ? 255 : 0);
  g.Tangents = Float32Array.from({ length: 32 }, (_, i) => i % 4 === 0 || i % 4 === 3 ? 1 : 0);
  const source = structuredClone(g), m = model(g);
  const plan = rebuildNormals(m), out = m.Geosets[0], { sourceOf } = plan.geosets[0];
  assert.equal(out.Vertices.length / 3, 24);
  for (let v = 0; v < 24; v++) {
    const s = sourceOf[v];
    assert.deepEqual(at(out.Vertices, v), at(source.Vertices, s));
    for (const uv of [0, 1]) assert.deepEqual(at(out.TVertices[uv], v, 2), at(source.TVertices[uv], s, 2));
    assert.equal(out.VertexGroup[v], source.VertexGroup[s]);
    assert.deepEqual(at(out.SkinWeights, v, 8), at(source.SkinWeights, s, 8));
    const t = at(out.Tangents, v, 4);
    assert.ok(Math.abs(Math.hypot(t[0], t[1], t[2]) - 1) < 1e-4 && Math.abs(t[3]) === 1);
    assert.ok(Math.abs(t.slice(0, 3).reduce((sum, x, i) => sum + x * out.Normals[v * 3 + i], 0)) < 1e-4, 'tangent is perpendicular to the normal');
  }
  assert.deepEqual(out.Groups, source.Groups);
});

test('vertices that become identical are merged', () => {
  // A flat quad whose two triangles use separate copies of the diagonal.
  const m = model(geoset([0,0,0, 10,0,0, 10,10,0, 0,0,0, 10,10,0, 0,10,0], [0,1,2, 3,4,5]));
  m.Geosets[0].TVertices[0].set([0,0, 1,0, 1,1, 0,0, 1,1, 0,1]);
  const plan = rebuildNormals(m);
  assert.equal(plan.stats.verticesSplit, 0); assert.equal(m.Geosets[0].Vertices.length / 3, 4);
  assert.deepEqual(Array.from(m.Geosets[0].Faces), [0,1,2, 0,2,3]);
});

test('collapsed triangles stay in the mesh and their vertices get a usable normal', () => {
  const m = model(geoset([0,0,0, 10,0,0, 10,10,0, 0,0,0], [0,1,2, 0,3,1]));
  rebuildNormals(m); const g = m.Geosets[0];
  assert.equal(g.Faces.length, 6); near(at(g.Normals, 3), [0, 0, 1]);
});

test('with a selection only the triangles touching it change', () => {
  const m = model(geoset(CUBE_POINTS, insideOut(CUBE_FACES)), geoset(shifted(20), insideOut(CUBE_FACES)));
  m.Geosets[1].Normals.fill(.5);
  const before = structuredClone(m.Geosets[1]);
  const plan = rebuildNormals(m, { selection: { 0: [0, 1, 2, 3, 4, 5, 6, 7] } });
  assert.deepEqual(m.Geosets[1], before);
  assert.equal(plan.stats.trianglesFlipped, 12); outward(m.Geosets[0]);
  assert.deepEqual(remapVertexState({ 0: [0], 1: [3] }, plan)[1], [3]);
  assert.equal(remapVertexState({ 0: [0] }, plan)[0].length, 3, 'a selected corner stays selected in every copy');
});

test('Fix facing only flips triangles without touching other normals', () => {
  const m = model(geoset(CUBE_POINTS, CUBE_FACES), geoset(shifted(20), insideOut(CUBE_FACES)));
  m.Geosets[0].Normals.fill(.25);
  const before = structuredClone(m.Geosets[0]);
  const plan = rebuildNormals(m, { facingOnly: true });
  assert.equal(plan.stats.trianglesFlipped, 12); assert.deepEqual(m.Geosets[0], before);
  outward(m.Geosets[1], [25, 5, 5]); assert.equal(darkCorners(m.Geosets[1]), 0);
  assert.equal(rebuildNormals(m, { facingOnly: true }).stats.changed, false);
});

test('a geoset that would exceed 65,535 vertices is refused', () => {
  const extra = 65535 - 8 - 4, points = [...CUBE_POINTS];
  for (let i = 0; i < extra; i++) points.push(100, 100, 100);
  const m = model(geoset(points, insideOut(CUBE_FACES)));
  assert.throws(() => rebuildNormals(m), /65,535/);
});

// Demo document with the first geoset replaced by an inside-out cube.
function cubeDocument() {
  const doc = createDemoDocument();
  doc.apply('Cube fixture', ['Geosets'], m => {
    const g = m.Geosets[0];
    Object.assign(g, { Vertices: Float32Array.from(CUBE_POINTS), Normals: new Float32Array(24).fill(0), Faces: Uint16Array.from(insideOut(CUBE_FACES)),
      TVertices: [Float32Array.from({ length: 16 }, (_, i) => i / 16)], VertexGroup: new Uint8Array(8) });
  });
  return doc;
}
test('preview and Cancel leave the document byte-identical', () => {
  const doc = cubeDocument(), bytes = doc.serialize('mdx'), model = structuredClone(doc.model), history = doc.history.length;
  const plan = planNormalRebuild(analyzeNormals(doc.model), {});
  const preview = previewNormalRebuild(doc.model, plan);
  assert.notEqual(preview.Geosets[0], doc.model.Geosets[0]); assert.equal(preview.Geosets[0].Vertices.length / 3, 24);
  planNormalRebuild(analyzeNormals(doc.model), { smoothingAngle: 30, fixFacing: false });
  assert.deepEqual(doc.model, model); assert.equal(doc.history.length, history);
  assert.ok(Buffer.from(doc.serialize('mdx')).equals(Buffer.from(bytes)));
});
test('Apply is one undo step and round-trips through MDX and MDL', () => {
  const doc = cubeDocument(), original = structuredClone(doc.model.Geosets), revision = doc.revision;
  const plan = planNormalRebuild(analyzeNormals(doc.model), {});
  doc.apply('NormalsXL', ['Geosets'], m => applyNormalRebuild(m, plan));
  assert.equal(doc.revision, revision + 1);
  const applied = structuredClone(doc.model.Geosets);
  assert.equal(applied[0].Vertices.length / 3, 24); assert.equal(darkCorners(applied[0]), 0);
  doc.undo(); assert.deepEqual(doc.model.Geosets, original);
  doc.redo(); assert.deepEqual(doc.model.Geosets, applied);
  for (const format of ['mdx', 'mdl']) {
    const reopened = openDocument(doc.serialize(format), 'saved.' + format).model.Geosets;
    for (const [i, g] of applied.entries()) {
      assert.deepEqual(Array.from(reopened[i].Faces), Array.from(g.Faces), format);
      assert.equal(reopened[i].Vertices.length, g.Vertices.length, format);
      near(Array.from(reopened[i].Normals), Array.from(g.Normals), 1e-5);
    }
  }
});

// Corpus-style regression on a real classic SD model.
function quality(m) {
  const A = analyzeNormals(m), N = new Float64Array(A.N * 3);
  for (const s of A.slots) N.set(s.g.Normals, s.base * 3);
  const dot = (p, t) => N[p * 3] * A.normal[t * 3] + N[p * 3 + 1] * A.normal[t * 3 + 1] + N[p * 3 + 2] * A.normal[t * 3 + 2];
  let dark = 0, seams = 0;
  for (let t = 0; t < A.T; t++) if (!A.degenerate[t]) for (let k = 0; k < 3; k++) if (dot(A.tv[t * 3 + k], t) < 0) dark++;
  for (const list of A.edges.values()) {
    if (list.length !== 2) continue;
    const [a, b] = list.map(c => (c / 3) | 0); if (A.twin[a] || A.twin[b]) continue;
    const sign = A.tw[a * 3 + list[0] % 3] === A.tw[b * 3 + list[1] % 3] ? -1 : 1;
    if ((A.normal[a * 3] * A.normal[b * 3] + A.normal[a * 3 + 1] * A.normal[b * 3 + 1] + A.normal[a * 3 + 2] * A.normal[b * 3 + 2]) * sign < Math.cos(Math.PI / 6)) continue;
    let worst = 1;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (A.tw[a * 3 + i] === A.tw[b * 3 + j]) {
      const p = A.tv[a * 3 + i], q = A.tv[b * 3 + j];
      worst = Math.min(worst, (N[p * 3] * N[q * 3] + N[p * 3 + 1] * N[q * 3 + 1] + N[p * 3 + 2] * N[q * 3 + 2]) * sign / (Math.hypot(N[p * 3], N[p * 3 + 1], N[p * 3 + 2]) * Math.hypot(N[q * 3], N[q * 3 + 1], N[q * 3 + 2]) || 1));
    }
    if (worst < Math.cos(Math.PI / 18)) seams++;
  }
  return { dark, seams };
}
test('a real SD model loses its dark corners and lighting seams', () => {
  const doc = openDocument(fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx', import.meta.url)), 'knight.mdx');
  const before = quality(doc.model);
  assert.ok(before.dark > 200 && before.seams > 30, JSON.stringify(before));
  const started = performance.now(), plan = planNormalRebuild(analyzeNormals(doc.model), {}), elapsed = performance.now() - started;
  doc.apply('NormalsXL', ['Geosets'], m => applyNormalRebuild(m, plan));
  const after = quality(doc.model);
  assert.ok(after.dark <= 10 && after.seams <= 3, JSON.stringify(after));
  assert.ok(elapsed < 5000, 'rebuild took ' + elapsed + ' ms');
  assert.ok(!doc.diagnostics.some(d => d.severity === 'error'));
  const reopened = openDocument(doc.serialize('mdx'), 'knight.mdx');
  assert.deepEqual(quality(reopened.model), after);
});

test('coincident vertices bound to different bones never share a normal', () => {
  // The same fold as above, but the second triangle is a separate part on another bone.
  const same = fold(20, { geosets: 2 }), split = fold(20, { geosets: 2 });
  split.Geosets[1].Groups = [[7]];
  rebuildNormals(same); rebuildNormals(split);
  near(at(same.Geosets[0].Normals, 0), at(same.Geosets[1].Normals, 1));
  near(at(split.Geosets[0].Normals, 0), [0, 0, 1]); near(at(split.Geosets[1].Normals, 1), faceNormal(split.Geosets[1], 0));
  // The same bone set in a different order is the same skinning.
  const reordered = fold(20, { geosets: 2 });
  reordered.Geosets[0].Groups = [[0, 3]]; reordered.Geosets[1].Groups = [[3, 0]];
  rebuildNormals(reordered); near(at(reordered.Geosets[0].Normals, 0), at(reordered.Geosets[1].Normals, 1));
  // HD: matching bones with different weights stay separate.
  const hd = fold(20, { geosets: 2 });
  hd.Geosets[0].SkinWeights = Uint8Array.from({ length: 24 }, (_, i) => [0, 3, 0, 0, 128, 127, 0, 0][i % 8]);
  hd.Geosets[1].SkinWeights = Uint8Array.from({ length: 24 }, (_, i) => [0, 3, 0, 0, 200, 55, 0, 0][i % 8]);
  rebuildNormals(hd); near(at(hd.Geosets[0].Normals, 0), [0, 0, 1]);
});

test('an open piece whose stored normals agree with its winding is not flipped', () => {
  // An inside-out open box: visibility says flip, but the authored normals agree.
  const box = CUBE_FACES.slice(0, 6 * 3).concat(CUBE_FACES.slice(8 * 3));
  // Give the inside-out box stored normals that agree with its winding.
  const authored = model(geoset(CUBE_POINTS, insideOut(box)));
  rebuildNormals(authored, { fixFacing: false });
  assert.equal(darkCorners(authored.Geosets[0]), 0);
  assert.equal(rebuildNormals(authored).stats.trianglesFlipped, 0);
});

test('one- or two-triangle cards in two-sided materials are never flipped', () => {
  // A two-triangle card facing into a closed box would be flipped if one-sided.
  const card = [2,2,5, 8,2,5, 8,8,5, 2,8,5], faces = [...CUBE_FACES, 8,10,9, 8,11,10];
  const twoSided = model(geoset([...CUBE_POINTS, ...card], faces));
  twoSided.Materials = [{ Layers: [{ Shading: 16 }] }];
  assert.equal(planNormalRebuild(analyzeNormals(twoSided), {}).stats.trianglesFlipped, 0);
});

test('pieces that need a look are returned as a vertex selection', () => {
  // The minimal Möbius strip (triangles i, i+1, i+2 mod 5) cannot be wound consistently.
  const points = Array.from({ length: 5 }, (_, i) => [10 * Math.cos(i * 1.2566), 10 * Math.sin(i * 1.2566), i % 2 ? 3 : -3]).flat();
  const faces = Array.from({ length: 5 }, (_, i) => [i, (i + 1) % 5, (i + 2) % 5]).flat();
  const m = model(geoset(points, faces));
  const plan = rebuildNormals(m);
  assert.equal(plan.stats.piecesNeedLook, 1);
  assert.deepEqual(plan.lookSelection, { 0: [0, 1, 2, 3, 4] });
  assert.equal(plan.stats.trianglesFlipped, 0, 'its triangles are left alone');
  // Collapsed-only pieces are not reported.
  const flat = model(geoset([0,0,0, 1,0,0, 2,0,0, 0,0,0, 10,0,0, 0,10,0], [0,1,2, 3,4,5]));
  assert.equal(rebuildNormals(flat).stats.piecesNeedLook, 0);
});

test('a one-sided ground decal under a unit keeps facing up', () => {
  // A tall body (the unit) standing on a small flat decal that faces +Z, as
  // gutz.blp blood is placed: from below the decal sees open sky and from above
  // it sees the body, but its stored normals agree with its winding.
  const body = CUBE_POINTS.map((v, i) => i % 3 === 2 ? v * 20 + 1 : v * 3 - 10);
  const decal = [-8,-8,0.5, 8,-8,0.5, 8,8,0.5, -8,8,0.5];
  const m = model(geoset(body, CUBE_FACES), geoset(decal, [0,1,2, 0,2,3]));
  m.Geosets[1].Normals.set([0,0,1, 0,0,1, 0,0,1, 0,0,1]);
  const plan = rebuildNormals(m);
  assert.equal(plan.stats.trianglesFlipped, 0);
  assert.deepEqual(Array.from(m.Geosets[1].Faces), [0,1,2, 0,2,3]);
  for (let v = 0; v < 4; v++) near(at(m.Geosets[1].Normals, v), [0, 0, 1]);
});

test('selecting one vertex of an inside-out piece repairs the whole piece', () => {
  const m = model(geoset(CUBE_POINTS, insideOut(CUBE_FACES)));
  const plan = rebuildNormals(m, { selection: { 0: [0] } });
  assert.equal(plan.stats.trianglesFlipped, 12); outward(m.Geosets[0]);
  assert.equal(darkCorners(m.Geosets[0]), 0);
  // A correct piece touching the selection only changes near the selection.
  const ok = model(geoset(CUBE_POINTS, CUBE_FACES));
  assert.equal(rebuildNormals(ok, { selection: { 0: [0] } }).stats.trianglesFlipped, 0);
});

test('geosets that show and hide differently do not smooth together', () => {
  const m = fold(20, { geosets: 2 });
  m.GeosetAnims = [{ GeosetId: 1, Alpha: { LineType: 0, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: Float32Array.of(0) }] } }];
  rebuildNormals(m);
  near(at(m.Geosets[0].Normals, 0), [0, 0, 1]); near(at(m.Geosets[1].Normals, 1), faceNormal(m.Geosets[1], 0));
  // A static alpha of 1 is the same as having no visibility track.
  const same = fold(20, { geosets: 2 }); same.GeosetAnims = [{ GeosetId: 1, Alpha: 1 }];
  rebuildNormals(same); near(at(same.Geosets[0].Normals, 0), at(same.Geosets[1].Normals, 1));
});

test('at the default angle hexagonal and pentagonal limbs are smooth and a cube keeps hard edges', () => {
  for (const sides of [5, 6]) {
    const points = [], faces = [];
    for (const z of [0, 40]) for (let i = 0; i < sides; i++) points.push(10 * Math.cos(2 * Math.PI * i / sides), 10 * Math.sin(2 * Math.PI * i / sides), z);
    for (let i = 0; i < sides; i++) { const j = (i + 1) % sides; faces.push(i, j, j + sides, i, j + sides, i + sides); }
    const m = model(geoset(points, faces)), plan = rebuildNormals(m), g = m.Geosets[0];
    assert.equal(plan.stats.verticesSplit, 0, sides + ' sides');
    for (let i = 0; i < sides; i++) near(at(g.Normals, i), [Math.cos(2 * Math.PI * i / sides), Math.sin(2 * Math.PI * i / sides), 0], 1e-4);
  }
  const cube = model(geoset(CUBE_POINTS, CUBE_FACES)); rebuildNormals(cube);
  assert.equal(cube.Geosets[0].Vertices.length / 3, 24);
});
