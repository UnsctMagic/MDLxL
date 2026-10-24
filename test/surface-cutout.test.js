import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openDocument, createDemoDocument } from '../src/editor-document.js';
import { planSurfaceCutout, applySurfaceCutoutPlan, previewSurfaceCutout, surfaceCutoutContours } from '../src/surface-cutout.js';
import { cross, signedArea } from '../src/forge-geometry.js';
import { updateBounds } from '../src/mesh-tools.js';

const octagon = (n = 8, center = [.3, .3], radius = .08) => Array.from({ length: n }, (_, i) => [center[0] + radius * Math.cos(i * 2 * Math.PI / n), center[1] + radius * Math.sin(i * 2 * Math.PI / n)]);
function fixture(points = [[0, 0], [1, 0], [0, 1]], faces = [0, 1, 2]) {
  const geoset = { Vertices: new Float32Array(points.flatMap(([u, v]) => [u * 10, v * 10, 0])), Normals: new Float32Array(points.flatMap(() => [0, 0, 1])), TVertices: [new Float32Array(points.flat())], VertexGroup: new Uint8Array(points.length), Groups: [[0]], Faces: new Uint16Array(faces), MaterialID: 0, Anims: [] };
  return { Version: 800, Geosets: [geoset], GeosetAnims: [], Info: {}, Materials: [{ Layers: [{ CoordId: 0 }] }] };
}
const request = (contour = octagon(), target = {}, rest = {}) => ({ contour, targets: [{ geosetIndex: 0, triangleIndices: [0], ...target }], outline: { pinned: true }, ...rest });
function trianglePoints(g) {
  return Array.from({ length: g.Faces.length / 3 }, (_, i) => Array.from(g.Faces.subarray(i * 3, i * 3 + 3), id => Array.from(g.TVertices[0].subarray(id * 2, id * 2 + 2))));
}
// Independent floating-point convex clipping, not the planner's integer booleans.
function intersectionArea(subject, clip) {
  let output = subject;
  const sign = Math.sign(signedArea(clip));
  for (let k = 0; k < clip.length; k++) {
    const a = clip[k], b = clip[(k + 1) % clip.length], input = output; output = [];
    for (let i = 0; i < input.length; i++) {
      const p = input[i], q = input[(i + 1) % input.length], dp = cross(a, b, p) * sign, dq = cross(a, b, q) * sign;
      if (dp >= 0) output.push(p);
      if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); output.push(p.map((v, axis) => v + t * (q[axis] - v))); }
    }
  }
  return Math.abs(signedArea(output));
}
function checkPartition(before, source, piece, contour, contourParts = [contour]) {
  const original = trianglePoints(before), inside = trianglePoints(piece), outside = trianglePoints(source), all = [...inside, ...outside];
  const expected = original.reduce((sum, triangle) => sum + Math.abs(signedArea(triangle)), 0);
  assert.ok(Math.abs(all.reduce((sum, triangle) => sum + Math.abs(signedArea(triangle)), 0) - expected) < 1e-7);
  for (let i = 0; i < all.length; i++) {
    assert.ok(Math.abs(signedArea(all[i])) > 1e-12);
    for (let j = i + 1; j < all.length; j++) assert.ok(intersectionArea(all[i], all[j]) < 1e-9, 'no interior overlap');
  }
  for (const triangle of outside) assert.ok(contourParts.reduce((sum, part) => sum + intersectionArea(triangle, part), 0) < 1e-7, 'source has a real hole');
  for (const triangle of inside) assert.ok(Math.abs(contourParts.reduce((sum, part) => sum + intersectionArea(triangle, part), 0) - Math.abs(signedArea(triangle))) < 1e-7);
}
for (const n of [4, 6, 8, 10]) test('interior ' + n + '-gon: minimal inside and true source hole', () => {
  const model = fixture(), original = structuredClone(model), contour = octagon(n);
  const plan = planSurfaceCutout(model, request(contour));
  assert.deepEqual(model, original, 'planning is immutable');
  const preview = previewSurfaceCutout(model, plan);
  assert.equal(plan.statistics.extractedTriangles, n - 2); assert.equal(plan.statistics.netTriangleIncrease, n * 2);
  assert.equal(preview.Geosets[0].Faces.length / 3, n + 3); assert.equal(preview.Geosets[1].Vertices.length / 3, n);
  assert.equal(preview.Geosets[0].Vertices.length / 3, n + 3);
  checkPartition(original.Geosets[0], preview.Geosets[0], preview.Geosets[1], contour);
  for (const pair of plan.edits[0].seamPairs) for (const field of ['Vertices', 'Normals', 'TVertices', 'VertexGroup']) {
    const stride = field === 'Vertices' || field === 'Normals' ? 3 : field === 'TVertices' ? 2 : 1;
    const a = field === 'TVertices' ? preview.Geosets[0][field][0] : preview.Geosets[0][field];
    const b = field === 'TVertices' ? preview.Geosets[1][field][0] : preview.Geosets[1][field];
    assert.deepEqual(a.slice(pair.sourceIndex * stride, (pair.sourceIndex + 1) * stride), b.slice(pair.pieceIndex * stride, (pair.pieceIndex + 1) * stride));
  }
});
test('shared edge intersections, crease and piecewise UV mapping remain conforming', () => {
  const model = fixture([[0, 0], [1, 0], [0, 1], [1, 1]], [0, 1, 2, 1, 3, 2]); model.Geosets[0].Vertices[11] = 5;
  const contour = octagon(8, [.5, .5], .2), plan = planSurfaceCutout(model, request(contour, { triangleIndices: [0, 1] }));
  const preview = previewSurfaceCutout(model, plan);
  checkPartition(model.Geosets[0], preview.Geosets[0], preview.Geosets[1], contour);
  assert.equal(plan.edits[0].affectedTriangles.length, 2);
  assert.ok(preview.Geosets[1].Vertices.some((v, i) => i % 3 === 2 && v > 0), 'crease retained');
});
test('unselected conformity neighbor is split, protected neighbor blocks', () => {
  const model = fixture([[0, 0], [1, 0], [0, 1], [1, 1]], [0, 1, 2, 1, 3, 2]), contour = octagon(8, [.5, .5], .2);
  const plan = planSurfaceCutout(model, request(contour));
  assert.deepEqual(plan.edits[0].affectedTriangles, [0, 1]);
  assert.throws(() => planSurfaceCutout(model, request(contour, { eligibleTriangleIndices: [0] })), /protected neighbor/);
});
test('concavity stays concave', () => {
  const contour = [[.1, .1], [.5, .1], [.5, .2], [.2, .2], [.2, .5], [.1, .5]], model = fixture();
  const result = previewSurfaceCutout(model, planSurfaceCutout(model, request(contour)));
  checkPartition(model.Geosets[0], result.Geosets[0], result.Geosets[1], contour, [
    [[.1, .1], [.5, .1], [.5, .2], [.1, .2]], [[.1, .2], [.2, .2], [.2, .5], [.1, .5]],
  ]);
});
test('no-op, full selection, malformed loop, degenerate UV and stale/tampered plans', () => {
  const model = fixture(), plan = planSurfaceCutout(model, request(octagon(8, [2, 2])));
  assert.equal(plan.status, 'empty'); assert.equal(applySurfaceCutoutPlan(model, plan), false);
  assert.throws(() => planSurfaceCutout(model, request([[0, 0], [1, 0], [0, 1]])), /empty the source/);
  assert.throws(() => planSurfaceCutout(model, request([[.1, .1], [.4, .4], [.1, .4], [.4, .1]])), /closed outline|crosses itself/);
  const degenerate = fixture([[0, 0], [1, 0], [2, 0]]);
  assert.throws(() => planSurfaceCutout(degenerate, request([[.1, -.1], [.6, -.1], [.4, .1]])), /degenerate/);
  const valid = planSurfaceCutout(model, request()); model.Geosets[0].Vertices[0] = 7;
  assert.throws(() => applySurfaceCutoutPlan(model, valid), /changed/);
});
test('overlapping shell requires a seed; identity never follows position alone', () => {
  const model = fixture([[0, 0], [1, 0], [0, 1], [0, 0], [1, 0], [0, 1]], [0, 1, 2, 3, 4, 5]);
  assert.throws(() => planSurfaceCutout(model, request(octagon(), { triangleIndices: undefined })), /Overlapping UV instances/);
  const plan = planSurfaceCutout(model, request(octagon(), { triangleIndices: undefined, seedTriangle: 0 }));
  assert.deepEqual(plan.edits[0].affectedTriangles, [0]); assert.deepEqual(plan.edits[0].replacement.Faces.slice(-3), Uint16Array.of(3, 4, 5));
});
test('mixed classic binding is explicit, duplicate bone multiplicity is significant', () => {
  const model = fixture(); model.Geosets[0].Groups = [[0, 0, 1], [0, 1]]; model.Geosets[0].VertexGroup[1] = 1;
  assert.throws(() => planSurfaceCutout(model, request()), /Mixed bone bindings/);
  const plan = planSurfaceCutout(model, request(octagon(), {}, { rigPolicy: 'approximate' }));
  assert.ok(plan.needsApproximation); assert.ok(plan.motion.schedule.length);
  assert.throws(() => applySurfaceCutoutPlan(model, plan), /accept Approximate/);
  applySurfaceCutoutPlan(model, plan, { acceptApproximation: true }); assert.equal(model.Geosets.length, 2);
});
test('hundreds of lasso samples simplify deterministically within a bounded tolerance', () => {
  const input = octagon(256), options = { textureSize: [256, 512], tolerance: .5 };
  const candidates = surfaceCutoutContours(input, options);
  assert.ok(candidates.length); assert.ok(Math.min(...candidates.map(c => c.points.length)) <= 32);
  assert.deepEqual(surfaceCutoutContours(input, options), candidates);
  assert.throws(() => surfaceCutoutContours(input, { ...options, maximumCorners: 3 }), /budget/);
});
test('native tiled UV and non-square texture precision', () => {
  const model = fixture([[1000, -700], [1001, -700], [1000, -699]]);
  const contour = octagon(8, [1000.3, -699.7]);
  const plan = planSurfaceCutout(model, request(contour, {}, { textureSize: [512, 128] }));
  assert.equal(plan.statistics.extractedTriangles, 6);
});
test('all streams, independent alpha/RGB records, gliders, references and opaque fields', () => {
  const model = fixture(), g = model.Geosets[0];
  g.TVertices.push(new Float32Array([.2, .3, .6, .8, .1, .9])); g.Tangents = new Float32Array([1, 0, 0, -1, 1, 0, 0, -1, 1, 0, 0, -1]); g.Custom = { preserve: [7] };
  const alpha = { LineType: 2, GlobalSeqId: 0, Keys: [{ Frame: 0, Vector: new Float32Array([0]), InTan: new Float32Array([0]), OutTan: new Float32Array([0]) }] };
  model.GeosetAnims = [{ GeosetId: 0, Flags: 3, Color: new Float32Array([.2, .4, .7]), Alpha: alpha, _MdxDefaults: { Color: new Float32Array([.1, .3, .8]) } }];
  model.Gliders = [{ GeosetId: 0, opaque: 8 }]; model.Bones = [{ GeosetId: 0, ObjectId: 0 }];
  const original = structuredClone(model), plan = planSurfaceCutout(model, request(octagon(), {}, { rgb: 'untinted' }));
  applySurfaceCutoutPlan(model, plan);
  assert.deepEqual(model.GeosetAnims[0], original.GeosetAnims[0]); assert.deepEqual(model.GeosetAnims[1].Alpha, alpha);
  assert.notEqual(model.GeosetAnims[1].Alpha, model.GeosetAnims[0].Alpha);
  assert.equal(model.GeosetAnims[1].Flags, 1); assert.deepEqual(model.GeosetAnims[1].Color, Float32Array.of(1, 1, 1));
  assert.deepEqual(model.Geosets[1].Custom, g.Custom); assert.equal(model.Geosets[1].TVertices.length, 2); assert.equal(model.Geosets[1].Tangents.length, 32);
  assert.deepEqual(model.Gliders[1], { GeosetId: 1, opaque: 8 }); assert.equal(model.Bones[0].GeosetId, null);
});
for (const scale of [.001, 1, 1000]) for (const reversed of [false, true]) test('scale ' + scale + ' and winding ' + reversed + ' preserve the minimal partition', () => {
  const model = fixture([[0, 0], [scale, 0], [0, scale]], reversed ? [2, 1, 0] : [0, 1, 2]);
  const contour = octagon().map(p => p.map(v => v * scale));
  const plan = planSurfaceCutout(model, request(reversed ? contour.reverse() : contour));
  assert.equal(plan.statistics.extractedTriangles, 6); assert.equal(plan.statistics.netTriangleIncrease, 16);
  const expectedSign = reversed ? -1 : 1;
  for (const g of [plan.edits[0].replacement, plan.edits[0].piece]) for (const triangle of trianglePoints(g)) assert.equal(Math.sign(signedArea(triangle)), expectedSign);
});
test('exact endpoint and collinear contour edges reuse original records', () => {
  const model = fixture(), contour = [[0, 0], [.4, 0], [0, .4]], plan = planSurfaceCutout(model, request(contour));
  assert.equal(plan.edits[0].piece.Vertices.length / 3, 3);
  assert.equal(plan.edits[0].replacement.Vertices.length / 3, 5);
  assert.equal(plan.statistics.extractedTriangles, 1);
  checkPartition(model.Geosets[0], plan.edits[0].replacement, plan.edits[0].piece, contour);
});
test('equivalent effective classic distributions may keep their original raw groups', () => {
  const model = fixture(), g = model.Geosets[0]; g.Groups = [[0, 0, 1, 1], [1, 0]]; g.VertexGroup[1] = 1;
  const plan = planSurfaceCutout(model, request()); assert.equal(plan.needsApproximation, false);
  assert.deepEqual(plan.edits[0].replacement.Groups, g.Groups);
  assert.deepEqual(plan.edits[0].replacement.VertexGroup.slice(0, 3), g.VertexGroup);
});
test('approximation measures original rendered-triangle motion, not just matching seam copies', () => {
  const model = fixture(), g = model.Geosets[0]; g.Groups = [[0], [1]]; g.VertexGroup[1] = 1;
  model.Sequences = [{ Interval: Uint32Array.of(0, 1000) }];
  model.Bones = [{ ObjectId: 0 }, { ObjectId: 1, Translation: { LineType: 1, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: Float32Array.of(0, 0, 0) }, { Frame: 1000, Vector: Float32Array.of(0, 0, 10) }] } }];
  const snapshot = structuredClone(model), plan = planSurfaceCutout(model, request(octagon(), {}, { rigPolicy: 'approximate' }));
  assert.ok(plan.motion.maximumError > 3); assert.ok(plan.motion.schedule.some(s => s.frame === 500));
  assert.ok(Math.abs(plan.motion.maximumError - 3.8) < 1e-5);
  assert.deepEqual(model, snapshot);
});
test('plans are deterministic and cannot be tampered with', () => {
  const model = fixture(), a = planSurfaceCutout(model, request()), b = planSurfaceCutout(model, request());
  assert.equal(a.planFingerprint, b.planFingerprint); assert.deepEqual(a.edits, b.edits);
  a.edits[0].piece.Vertices[0] += 1;
  assert.throws(() => applySurfaceCutoutPlan(model, a), /preview changed/);
});
test('Auto minimizes the combined edit, including a higher-corner outline aligned with original edges', () => {
  const points = [], faces = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) points.push([x / 4, y / 4]);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const a = y * 5 + x; faces.push(a, a + 1, a + 6, a, a + 6, a + 5); }
  const model = fixture(points, faces), contour = [[.25, .25], [.75, .25], [.75, .5], [.5, .5], [.5, .75], [.25, .75]];
  const options = { textureSize: [16, 16], outline: { tolerance: 3.5 }, targets: [{ geosetIndex: 0 }] };
  const candidates = surfaceCutoutContours(contour, { textureSize: options.textureSize, tolerance: 3.5 });
  const costs = candidates.map(c => ({ corners: c.points.length, plan: planSurfaceCutout(model, { ...options, contour: c.points, outline: { pinned: true } }) }));
  const chosen = planSurfaceCutout(model, { ...options, contour });
  assert.equal(chosen.statistics.netTriangleIncrease, Math.min(...costs.map(c => c.plan.statistics.netTriangleIncrease)));
  assert.ok(costs.some(c => c.corners < chosen.statistics.contourCorners && c.plan.statistics.netTriangleIncrease > chosen.statistics.netTriangleIncrease));
});
test('hard-normal seam copies are distinct records even at identical positions', () => {
  const model = fixture([[0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]], [0, 1, 2, 3, 4, 5]);
  for (let i = 3; i < 6; i++) model.Geosets[0].Normals.set([0, 1, 0], i * 3);
  const contour = octagon(8, [.5, .5], .2), plan = planSurfaceCutout(model, request(contour, { triangleIndices: [0, 1] }));
  const piece = plan.edits[0].piece;
  const records = new Map(); let seam = false;
  for (let i = 0; i < piece.Vertices.length / 3; i++) {
    const key = Array.from(piece.Vertices.slice(i * 3, i * 3 + 3)).join(','), normal = Array.from(piece.Normals.slice(i * 3, i * 3 + 3)).join(',');
    if (records.has(key) && records.get(key) !== normal) seam = true;
    records.set(key, normal);
  }
  assert.ok(seam); checkPartition(model.Geosets[0], plan.edits[0].replacement, piece, contour);
});
test('repeat cut is empty and cannot stack a second surface', () => {
  const model = fixture(), options = request(octagon(), { triangleIndices: undefined });
  applySurfaceCutoutPlan(model, planSurfaceCutout(model, options));
  const repeated = planSurfaceCutout(model, options);
  assert.equal(repeated.status, 'empty'); assert.equal(applySurfaceCutoutPlan(model, repeated), false); assert.equal(model.Geosets.length, 2);
});
test('format limits and HD read-only policy reject before mutation', () => {
  const model = fixture(), g = model.Geosets[0], original = structuredClone(g);
  for (const [field, stride] of [['Vertices', 3], ['Normals', 3], ['VertexGroup', 1]]) { const values = new g[field].constructor(65536 * stride); values.set(g[field]); g[field] = values; }
  g.TVertices = [new Float32Array(65536 * 2)]; g.TVertices[0].set(original.TVertices[0]);
  assert.throws(() => planSurfaceCutout(model, request()), /65536-vertex/);
  assert.equal(g.Vertices.length / 3, 65536);
  const hd = fixture(); hd.Geosets[0].SkinWeights = new Uint8Array(24);
  assert.throws(() => planSurfaceCutout(hd, request()), /HD skinning/);
});
test('empty Apply has no history entry; a throwing transaction retains redo', () => {
  const doc = createDemoDocument(), revision = doc.revision;
  const empty = planSurfaceCutout(doc.model, request(octagon(8, [100, 100])));
  assert.equal(doc.apply('Empty cut', ['Geosets'], model => applySurfaceCutoutPlan(model, empty)), false);
  assert.equal(doc.revision, revision);
  doc.apply('Cuttable rollback fixture', ['Geosets'], model => {
    const triangle = fixture().Geosets[0]; delete triangle.Anims;
    Object.assign(model.Geosets[0], triangle); updateBounds(model.Geosets[0]);
  });
  doc.apply('Prior edit', ['Geosets'], model => { model.Geosets[0].Vertices[0] += 1; }); doc.undo();
  const before = structuredClone(doc.model), plan = planSurfaceCutout(doc.model, request());
  assert.equal(plan.status, 'ready');
  assert.throws(() => doc.apply('Throwing cut', ['Geosets', 'GeosetAnims', 'Bones', 'Info'], model => { applySurfaceCutoutPlan(model, plan); throw Error('commit probe'); }), /commit probe/);
  assert.deepEqual(doc.model, before); assert.equal(doc.redo(), true);
});
const privateDirectory = process.env.MDLXL_CUTOUT_FIXTURE_DIR;
test('private Shmoopie upper surface targeting, mixed policy and protected lower pieces', { skip: !privateDirectory }, () => {
  const bytes = readFileSync(join(privateDirectory, 'before_upper_cutout.mdx')), spec = JSON.parse(readFileSync(join(privateDirectory, 'request-example.json'), 'utf8'));
  const doc = openDocument(bytes, 'private-cutout.mdx'), before = structuredClone(doc.model);
  const options = { contour: spec.contour.uv_points, targets: [{ geosetIndex: 11, uvSet: 0, triangleIndices: [111, 123] }], outline: { pinned: true } };
  assert.throws(() => planSurfaceCutout(doc.model, options), /Mixed bone bindings/);
  const rigid = planSurfaceCutout(doc.model, { ...options, targets: [{ ...options.targets[0], triangleIndices: [111] }] });
  assert.equal(rigid.statistics.extractedTriangles, 6); assert.equal(rigid.needsApproximation, false);
  assert.throws(() => planSurfaceCutout(doc.model, { ...options, targets: [{ geosetIndex: 11 }] }), /Overlapping UV instances/);
  const plan = planSurfaceCutout(doc.model, { ...options, rigPolicy: 'approximate' });
  assert.equal(plan.statistics.netTriangleIncrease, 32); assert.equal(plan.statistics.extractedTriangles, 12);
  let result;
  doc.apply('Cut & Separate', ['Geosets', 'GeosetAnims', 'Bones', 'Info'], model => { result = applySurfaceCutoutPlan(model, plan, { acceptApproximation: true }); });
  assert.equal(doc.model.Geosets[11].Vertices.length / 3, 128); assert.equal(doc.model.Geosets[11].Faces.length / 3, 152);
  assert.equal(doc.model.Geosets[24].Vertices.length / 3, 16); assert.deepEqual(result.addedGeosetIndices, [24]);
  for (let i = 0; i < 24; i++) if (i !== 11) assert.deepEqual(doc.model.Geosets[i], before.Geosets[i]);
  for (const ext of ['mdx', 'mdl']) {
    const saved = doc.serialize(ext), reopened = openDocument(saved, 'reopened.' + ext);
    assert.equal(reopened.model.Geosets[24].Faces.length / 3, 12);
    const mdx = reopened.serialize('mdx'), second = openDocument(mdx, 'second.mdx'); assert.equal(second.model.Geosets[11].Faces.length / 3, 152);
  }
  doc.undo(); assert.deepEqual(doc.model, before); doc.redo(); assert.equal(doc.model.Geosets.length, 25);
});
