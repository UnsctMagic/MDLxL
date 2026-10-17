import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyzeNormals, planNormalRebuild, planFacingFix, applyNormalRebuild, previewNormalRebuild, rebuildNormals, fixFacing, DEFAULT_SMOOTHING_ANGLE } from '../src/normals-rebuild.js';
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
// Every stream except Normals (and, for Fix facing, the corner order) must stay as it was.
const shape = m => m.Geosets.map(g => ({ vertices: Array.from(g.Vertices), uv: g.TVertices.map(t => Array.from(t)), groups: Array.from(g.VertexGroup), faces: g.Faces.length }));
function rebuilt(m, options) { const before = shape(m), plan = rebuildNormals(m, options); assert.deepEqual(shape(m), before, 'no vertex is added, removed or moved'); return plan; }

// A unit cube, wound outward; corner index = x + 2y + 4z.
const CUBE_POINTS = Array.from({ length: 8 }, (_, i) => [i & 1, (i >> 1) & 1, (i >> 2) & 1].map(v => v * 10)).flat();
const CUBE_FACES = [0,2,3, 0,3,1, 4,5,7, 4,7,6, 0,1,5, 0,5,4, 2,6,7, 2,7,3, 0,4,6, 0,6,2, 1,3,7, 1,7,5];
const insideOut = faces => faces.flatMap((_, i) => i % 3 ? [] : [faces[i], faces[i + 2], faces[i + 1]]);
// The same cube with its own four vertices per side (authored hard edges).
function splitCube() {
  const points = [], faces = [];
  for (let f = 0; f < 12; f += 2) {
    const ids = [...new Set(CUBE_FACES.slice(f * 3, f * 3 + 6))], base = points.length / 3;
    for (const id of ids) points.push(...CUBE_POINTS.slice(id * 3, id * 3 + 3));
    for (const id of CUBE_FACES.slice(f * 3, f * 3 + 6)) faces.push(base + ids.indexOf(id));
  }
  return geoset(points, faces);
}
const outward = (g, c = [5, 5, 5]) => { for (let f = 0; f < g.Faces.length / 3; f++) { const p = at(g.Vertices, g.Faces[f * 3]), n = faceNormal(g, f); assert.ok(n.reduce((s, v, i) => s + v * (p[i] - c[i]), 0) > 0, 'triangle ' + f + ' faces inward'); } };
const darkCorners = g => { let dark = 0; for (let f = 0; f < g.Faces.length / 3; f++) { const n = faceNormal(g, f); for (let k = 0; k < 3; k++) if (at(g.Normals, g.Faces[f * 3 + k]).reduce((s, v, i) => s + v * n[i], 0) < 0) dark++; } return dark; };
// Two triangles meeting at the X axis with a shallow fold of `degrees`.
function fold(degrees, { geosets = 1 } = {}) {
  const r = degrees * Math.PI / 180, far = [0, -10 * Math.cos(r), -10 * Math.sin(r)];
  const a = [0,0,0, 10,0,0, 5,10,0], b = [0,0,0, 10,0,0, 5, ...far.slice(1)];
  if (geosets === 2) return model(geoset(a, [0,1,2]), geoset(b, [1,0,2]));
  const g = geoset([...a, ...b], [0,1,2, 4,3,5]);
  g.TVertices[0].set([.9, .9, .8, .8], 6); // a UV seam along the fold
  return model(g);
}
// A closed smooth sphere (UV sphere with shared vertices at each pole).
function sphere(rings = 10, sides = 16) {
  const points = [0, 0, 10], faces = [];
  for (let r = 1; r < rings; r++) for (let s = 0; s < sides; s++) { const t = Math.PI * r / rings, p = 2 * Math.PI * s / sides; points.push(10 * Math.sin(t) * Math.cos(p), 10 * Math.sin(t) * Math.sin(p), 10 * Math.cos(t)); }
  points.push(0, 0, -10);
  const id = (r, s) => 1 + (r - 1) * sides + (s % sides), south = points.length / 3 - 1;
  for (let s = 0; s < sides; s++) faces.push(0, id(1, s), id(1, s + 1));
  for (let r = 1; r < rings - 1; r++) for (let s = 0; s < sides; s++) faces.push(id(r, s), id(r + 1, s), id(r + 1, s + 1), id(r, s), id(r + 1, s + 1), id(r, s + 1));
  for (let s = 0; s < sides; s++) faces.push(south, id(rings - 1, s + 1), id(rings - 1, s));
  return geoset(points, faces);
}

test('UV-seam duplicates are smoothed together and nothing else in the geoset changes', () => {
  const m = fold(20), uv = Array.from(m.Geosets[0].TVertices[0]);
  const plan = rebuilt(m); const g = m.Geosets[0];
  near(at(g.Normals, 0), at(g.Normals, 3)); near(at(g.Normals, 1), at(g.Normals, 4));
  near(at(g.Normals, 0), [0, -Math.sin(10 * Math.PI / 180), Math.cos(10 * Math.PI / 180)]);
  assert.deepEqual(Array.from(g.TVertices[0]), uv); assert.equal(plan.stats.trianglesFlipped, 0);
  // Across geosets too, when skinning and visibility match.
  const two = fold(20, { geosets: 2 }); rebuilt(two);
  near(at(two.Geosets[0].Normals, 0), at(two.Geosets[1].Normals, 1));
});

test('an authored hard edge made of duplicated vertices stays crisp', () => {
  const m = model(splitCube()); rebuilt(m); const g = m.Geosets[0];
  assert.equal(g.Vertices.length / 3, 24);
  for (let f = 0; f < 12; f++) for (let k = 0; k < 3; k++) near(at(g.Normals, g.Faces[f * 3 + k]), faceNormal(g, f));
  // A fold sharper than the smoothing angle stays crisp at a UV seam as well.
  const sharp = fold(80); rebuilt(sharp, { smoothingAngle: 70 });
  near(at(sharp.Geosets[0].Normals, 0), [0, 0, 1]); near(at(sharp.Geosets[0].Normals, 3), faceNormal(sharp.Geosets[0], 1));
});

test('a cube with shared corner vertices gets averaged corners at the default angle, as Model Studio does', () => {
  assert.equal(DEFAULT_SMOOTHING_ANGLE, 90);
  const m = model(geoset(CUBE_POINTS, CUBE_FACES)); rebuilt(m); const g = m.Geosets[0];
  assert.equal(g.Vertices.length / 3, 8);
  // The sum of the unit normals of the corner's triangles (a side split into
  // two triangles at that corner counts twice), facing out of all three sides.
  for (let v = 0; v < 8; v++) {
    const sum = [0, 0, 0];
    for (let f = 0; f < 12; f++) if (at(g.Faces, f).includes(v)) faceNormal(g, f).forEach((x, i) => sum[i] += x);
    near(at(g.Normals, v), unit(sum));
    at(g.Normals, v).forEach((x, i) => assert.ok(x * (g.Vertices[v * 3 + i] - 5) > .3));
  }
  assert.equal(darkCorners(g), 0);
});

test('a patch of neighbouring wrong normals comes out exactly as if it had never been wrong', () => {
  // A quarter of a smooth sphere: inverted, scrambled and zero normals next to each other.
  const clean = model(sphere()), broken = model(sphere());
  rebuildNormals(clean);
  const g = broken.Geosets[0], count = g.Vertices.length / 3;
  for (let v = 0; v < count; v++) {
    const [x, y] = at(g.Vertices, v); if (!(x >= 0 && y >= 0)) continue;
    g.Normals.set(v % 3 === 0 ? [0, 0, 0] : v % 3 === 1 ? at(clean.Geosets[0].Normals, v).map(n => -n) : unit([Math.sin(v), Math.cos(3 * v), .3]), v * 3);
  }
  rebuildNormals(broken);
  assert.deepEqual(Array.from(g.Normals), Array.from(clean.Geosets[0].Normals));
  assert.equal(darkCorners(g), 0);
});

test('different skinning or visibility is never combined', () => {
  const split = fold(20, { geosets: 2 }); split.Geosets[1].Groups = [[7]]; rebuilt(split);
  near(at(split.Geosets[0].Normals, 0), [0, 0, 1]); near(at(split.Geosets[1].Normals, 1), faceNormal(split.Geosets[1], 0));
  const reordered = fold(20, { geosets: 2 }); reordered.Geosets[0].Groups = [[0, 3]]; reordered.Geosets[1].Groups = [[3, 0]]; rebuilt(reordered);
  near(at(reordered.Geosets[0].Normals, 0), at(reordered.Geosets[1].Normals, 1));
  const hd = fold(20, { geosets: 2 });
  hd.Geosets[0].SkinWeights = Uint8Array.from({ length: 24 }, (_, i) => [0, 3, 0, 0, 128, 127, 0, 0][i % 8]);
  hd.Geosets[1].SkinWeights = Uint8Array.from({ length: 24 }, (_, i) => [0, 3, 0, 0, 200, 55, 0, 0][i % 8]);
  rebuilt(hd); near(at(hd.Geosets[0].Normals, 0), [0, 0, 1]);
  const swap = fold(20, { geosets: 2 });
  swap.GeosetAnims = [{ GeosetId: 1, Alpha: { LineType: 0, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: Float32Array.of(0) }] } }];
  rebuilt(swap); near(at(swap.Geosets[0].Normals, 0), [0, 0, 1]);
});

test('with a selection only selected vertices change, using every triangle at their position', () => {
  const m = fold(20, { geosets: 2 }); m.Geosets[0].Normals.fill(.5); m.Geosets[1].Normals.fill(.5);
  const before = structuredClone(m.Geosets[1]);
  const plan = rebuilt(m, { selection: { 0: [0] } });
  assert.deepEqual(m.Geosets[1], before);
  near(at(m.Geosets[0].Normals, 0), [0, -Math.sin(10 * Math.PI / 180), Math.cos(10 * Math.PI / 180)]);
  near(at(m.Geosets[0].Normals, 1), [.5, .5, .5]);
  assert.equal(plan.stats.normalsChanged, 1);
});

test('unshaded geosets are skipped; a vertex used only by a collapsed triangle takes the shading at its position', () => {
  const m = model(geoset(CUBE_POINTS, CUBE_FACES), geoset([0,0,0, 10,0,0, 10,10,0, 0,0,0], [0,1,2, 0,3,1]));
  m.Materials = [{ Layers: [{ Shading: 1 }] }, { Layers: [{ Shading: 0 }] }]; m.Geosets[1].MaterialID = 1;
  rebuilt(m);
  assert.deepEqual(Array.from(m.Geosets[0].Normals), new Array(24).fill(0));
  near(at(m.Geosets[1].Normals, 0), [0, 0, 1]); near(at(m.Geosets[1].Normals, 3), [0, 0, 1]);
});

test('Fix facing flips a minority triangle and turns an inside-out closed cube, without new vertices', () => {
  const sheet = model(geoset([0,0,0, 10,0,0, 10,10,0, 0,10,0, 20,0,0], [0,1,2, 0,2,3, 1,2,4]));
  assert.equal(fixFacing(sheet).stats.trianglesFlipped, 1);
  for (let f = 0; f < 3; f++) near(faceNormal(sheet.Geosets[0], f), [0, 0, 1]);
  for (const g of [geoset(CUBE_POINTS, insideOut(CUBE_FACES)), splitCube()]) {
    if (g.Vertices.length === 72) g.Faces = Uint16Array.from(insideOut(Array.from(g.Faces)));
    const m = model(g), count = g.Vertices.length;
    const plan = fixFacing(m);
    assert.equal(plan.stats.trianglesFlipped, 12); assert.equal(m.Geosets[0].Vertices.length, count);
    outward(m.Geosets[0]); assert.equal(darkCorners(m.Geosets[0]), 0, 'normals follow the new facing');
    assert.equal(fixFacing(m).stats.changed, false);
  }
  // An open flat sheet whose outside cannot be known is left as it is.
  assert.equal(fixFacing(model(geoset([0,0,0, 10,0,0, 10,10,0, 0,10,0], [0,2,1, 0,3,2]))).stats.trianglesFlipped, 0);
});

test('Fix facing turns back a whole patch of neighbouring flipped triangles', () => {
  const clean = model(sphere()), broken = model(sphere()), g = broken.Geosets[0], T = g.Faces.length / 3;
  // About a fifth of the sphere, all connected, around one pole.
  let flipped = 0;
  for (let f = 0; f < T; f++) if (at(g.Faces, f).every(id => g.Vertices[id * 3 + 2] > 5)) { const s = g.Faces[f * 3 + 1]; g.Faces[f * 3 + 1] = g.Faces[f * 3 + 2]; g.Faces[f * 3 + 2] = s; flipped++; }
  assert.ok(flipped > T * .15 && flipped < T * .3, String(flipped / T));
  assert.equal(fixFacing(broken).stats.trianglesFlipped, flipped);
  assert.deepEqual(Array.from(g.Faces), Array.from(clean.Geosets[0].Faces));
  rebuildNormals(clean); rebuildNormals(broken);
  assert.deepEqual(Array.from(g.Normals), Array.from(clean.Geosets[0].Normals));
});

test('Fix facing never touches back-to-back twins or a ground decal under a unit', () => {
  const quad = [0,1,2, 0,2,3];
  const twins = model(geoset([0,0,0, 10,0,0, 10,10,0, 0,10,0], [...quad, ...insideOut(quad)]));
  assert.equal(fixFacing(twins).stats.trianglesFlipped, 0);
  const body = CUBE_POINTS.map((v, i) => i % 3 === 2 ? v * 20 + 1 : v * 3 - 10);
  const decal = model(geoset(body, CUBE_FACES), geoset([-8,-8,0.5, 8,-8,0.5, 8,8,0.5, -8,8,0.5], quad));
  assert.equal(fixFacing(decal).stats.trianglesFlipped, 0);
  assert.deepEqual(Array.from(decal.Geosets[1].Faces), quad);
  // An open strip half one way, half the other: no clear majority, left alone.
  const strip = model(geoset([0,0,0, 10,0,0, 20,0,0, 0,10,0, 10,10,0, 20,10,0], [0,1,4, 0,4,3, 1,5,2, 1,4,5]));
  assert.equal(fixFacing(strip).stats.trianglesFlipped, 0);
  // A Möbius strip cannot be wound consistently: left alone.
  const points = Array.from({ length: 5 }, (_, i) => [10 * Math.cos(i * 1.2566), 10 * Math.sin(i * 1.2566), i % 2 ? 3 : -3]).flat();
  assert.equal(fixFacing(model(geoset(points, Array.from({ length: 5 }, (_, i) => [i, (i + 1) % 5, (i + 2) % 5]).flat()))).stats.trianglesFlipped, 0);
});

// Demo document with the first geoset replaced by an inside-out cube.
function cubeDocument() {
  const doc = createDemoDocument();
  doc.apply('Cube fixture', ['Geosets'], m => {
    Object.assign(m.Geosets[0], { Vertices: Float32Array.from(CUBE_POINTS), Normals: new Float32Array(24), Faces: Uint16Array.from(insideOut(CUBE_FACES)),
      TVertices: [Float32Array.from({ length: 16 }, (_, i) => i / 16)], VertexGroup: new Uint8Array(8) });
  });
  return doc;
}
test('preview and Cancel leave the document byte-identical', () => {
  const doc = cubeDocument(), bytes = doc.serialize('mdx'), snapshot = structuredClone(doc.model), history = doc.history.length;
  const A = analyzeNormals(doc.model), plan = planNormalRebuild(A, {}), facing = planFacingFix(A, {});
  const preview = previewNormalRebuild(doc.model, plan);
  assert.notEqual(preview.Geosets[0], doc.model.Geosets[0]); assert.equal(preview.Geosets[0].Vertices, doc.model.Geosets[0].Vertices);
  previewNormalRebuild(doc.model, facing); planNormalRebuild(A, { smoothingAngle: 30 });
  assert.deepEqual(doc.model, snapshot); assert.equal(doc.history.length, history);
  assert.ok(Buffer.from(doc.serialize('mdx')).equals(Buffer.from(bytes)));
});
test('Apply and Fix facing are one undo step each and round-trip through MDX and MDL', () => {
  const doc = cubeDocument(), bytes = Buffer.from(doc.serialize('mdx')), original = structuredClone(doc.model.Geosets), revision = doc.revision;
  doc.apply('NormalsXL · Fix facing', ['Geosets'], m => applyNormalRebuild(m, planFacingFix(analyzeNormals(m), {})));
  doc.apply('NormalsXL', ['Geosets'], m => applyNormalRebuild(m, planNormalRebuild(analyzeNormals(m), {})));
  assert.equal(doc.revision, revision + 2);
  const applied = structuredClone(doc.model.Geosets), saved = Buffer.from(doc.serialize('mdx'));
  outward(applied[0]); assert.equal(darkCorners(applied[0]), 0);
  assert.equal(saved.length, bytes.length, 'the file keeps its size');
  doc.undo(); doc.undo(); assert.deepEqual(doc.model.Geosets, original);
  assert.ok(Buffer.from(doc.serialize('mdx')).equals(bytes));
  doc.redo(); doc.redo(); assert.deepEqual(doc.model.Geosets, applied);
  for (const format of ['mdx', 'mdl']) {
    const reopened = openDocument(doc.serialize(format), 'saved.' + format).model.Geosets;
    for (const [i, g] of applied.entries()) {
      assert.deepEqual(Array.from(reopened[i].Faces), Array.from(g.Faces), format);
      assert.equal(reopened[i].Vertices.length, g.Vertices.length, format);
      near(Array.from(reopened[i].Normals), Array.from(g.Normals), 1e-5);
    }
  }
});

// A real classic SD model.
const knight = () => openDocument(fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx', import.meta.url)), 'knight.mdx');
const corners = m => m.Geosets.reduce((sum, g) => sum + darkCorners(g), 0);
test('a real SD model: fewer dark corners, same file size, nothing left to do on a second run', () => {
  const doc = knight(), size = doc.serialize('mdx').length, vertices = doc.model.Geosets.map(g => g.Vertices.length), before = corners(doc.model);
  const started = performance.now(), plan = planNormalRebuild(analyzeNormals(doc.model), {}), elapsed = performance.now() - started;
  doc.apply('NormalsXL', ['Geosets'], m => applyNormalRebuild(m, plan));
  assert.ok(plan.stats.normalsChanged > 100 && corners(doc.model) < before * .7, JSON.stringify({ before, after: corners(doc.model) }));
  assert.ok(elapsed < 5000, 'rebuild took ' + elapsed + ' ms');
  assert.deepEqual(doc.model.Geosets.map(g => g.Vertices.length), vertices);
  assert.equal(doc.serialize('mdx').length, size);
  assert.equal(planNormalRebuild(analyzeNormals(doc.model), {}).stats.changed, false);
  assert.ok(!doc.diagnostics.some(d => d.severity === 'error'));
});

// The triangles reachable from `seed` across shared edges, up to `limit`.
function patch(g, seed, limit) {
  const T = g.Faces.length / 3, edges = new Map(), key = (a, b) => a < b ? a + ',' + b : b + ',' + a;
  for (let f = 0; f < T; f++) for (let k = 0; k < 3; k++) { const e = key(g.Faces[f * 3 + k], g.Faces[f * 3 + (k + 1) % 3]); if (!edges.has(e)) edges.set(e, []); edges.get(e).push(f); }
  const seen = new Set([seed]), list = [seed];
  for (let i = 0; i < list.length && list.length < limit; i++) for (let k = 0; k < 3; k++)
    for (const f of edges.get(key(g.Faces[list[i] * 3 + k], g.Faces[list[i] * 3 + (k + 1) % 3]))) if (!seen.has(f) && list.length < limit) { seen.add(f); list.push(f); }
  return list;
}
const largest = m => m.Geosets.reduce((best, g, i) => g.Faces.length > m.Geosets[best].Faces.length ? i : best, 0);
test('a real SD model: a scrambled patch of neighbouring normals is rebuilt identically', () => {
  const clean = knight(), broken = knight(), gi = largest(broken.model), g = broken.model.Geosets[gi];
  const ids = new Set(patch(g, 0, g.Faces.length / 15).flatMap(f => at(g.Faces, f)));
  assert.ok(ids.size > 20);
  let i = 0;
  for (const v of ids) g.Normals.set(i++ % 2 ? at(g.Normals, v).map(n => -n) : [Math.sin(v), 0, Math.cos(2 * v)], v * 3);
  for (const doc of [clean, broken]) doc.apply('NormalsXL', ['Geosets'], m => applyNormalRebuild(m, planNormalRebuild(analyzeNormals(m), {})));
  assert.deepEqual(broken.model.Geosets.map(g => Array.from(g.Normals)), clean.model.Geosets.map(g => Array.from(g.Normals)));
});
test('a real SD model: Fix facing turns back a patch of a fifth of a piece', () => {
  const clean = knight(), broken = knight();
  for (const doc of [clean, broken]) doc.apply('Fix facing', ['Geosets'], m => applyNormalRebuild(m, planFacingFix(analyzeNormals(m), {})));
  const gi = largest(broken.model), g = broken.model.Geosets[gi], piece = patch(g, 0, Infinity);
  const area = f => Math.hypot(...faceNormal(g, f)) > 0 && at(g.Faces, f).length === 3;
  const flipped = patch(g, 0, piece.length / 5).filter(area);
  assert.ok(flipped.length >= 10, String(flipped.length));
  broken.apply('Break', ['Geosets'], m => { const F = m.Geosets[gi].Faces; for (const f of flipped) { const s = F[f * 3 + 1]; F[f * 3 + 1] = F[f * 3 + 2]; F[f * 3 + 2] = s; } });
  const plan = planFacingFix(analyzeNormals(broken.model), {});
  assert.equal(plan.stats.trianglesFlipped, flipped.length);
  broken.apply('Fix facing', ['Geosets'], m => applyNormalRebuild(m, plan));
  assert.deepEqual(Array.from(broken.model.Geosets[gi].Faces), Array.from(clean.model.Geosets[gi].Faces));
});
