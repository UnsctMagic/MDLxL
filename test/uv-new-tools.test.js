// UV Wrapper Box Projection, Cylinder Projection, Straighten, Mirror Copy, Unwrap and Relax
// (docs/agent-tasks/uv-new-tools.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { combineUVGeosets, projectUVFromView, straightenUVCoordinates, mirrorCopyUVCoordinates, relaxUVCoordinates, NO_MIRROR_POINTS_ERROR, RELAX_EDGE_ERROR } from '../src/uv-tools.js';
import { boxProjectUVCorners, cylinderProjectUVCorners, unwrapUVCorners, planUVCorners, splitUVCorners, uvCornerCopies, wholeSelectedTriangles, POINT_LIMIT_ERROR, WHOLE_TRIANGLE_ERROR } from '../src/uv-unwrap.js';
import { uvToolState } from '../src/uv-tool-state.js';
import { readFileSync } from 'node:fs';
import { translate } from '../src/localization.js';

// ---- views ----------------------------------------------------------------------------------
const normalize = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const crossV = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dotV = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** A camera looking from `direction` (toward the viewer) with `up`, as Three's matrixWorldInverse. */
function lookFrom(direction, up = [0, 0, 1], eye = direction.map(x => x * 50)) {
  const b = normalize(direction), r = normalize(crossV(up, b)), u = crossV(b, r), m = new Array(16).fill(0);
  [r, u, b].forEach((axis, row) => { m[row] = axis[0]; m[4 + row] = axis[1]; m[8 + row] = axis[2]; m[12 + row] = -dotV(axis, eye); });
  m[15] = 1;
  return m;
}
function ortho(width = 10, height = 8, near = .1, far = 200) {
  const m = new Array(16).fill(0);
  m[0] = 2 / width; m[5] = 2 / height; m[10] = -2 / (far - near); m[14] = -(far + near) / (far - near); m[15] = 1;
  return m;
}
const PROJECTION = ortho(), SU = PROJECTION[0] / 2, SV = PROJECTION[5] / 2;
const FRONT = lookFrom([1, 0, 0]), ANGLED = lookFrom([1, 1, 1]);

// ---- meshes ---------------------------------------------------------------------------------
function geosetOf(points, faces, uv) {
  const count = points.length;
  return {
    Vertices: new Float32Array(points.flat()), Normals: new Float32Array(count * 3).fill(1), VertexGroup: new Uint8Array(count),
    TVertices: [new Float32Array(uv ? uv.flat() : points.flatMap(([x, y]) => [x / 10 + .5, y / 10 + .5]))], Faces: new Uint16Array(faces),
  };
}
function cube() {
  const points = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  const faces = [4,5,6, 4,6,7, 0,2,1, 0,3,2, 1,2,6, 1,6,5, 0,4,7, 0,7,3, 3,7,6, 3,6,2, 0,1,5, 0,5,4];
  return geosetOf(points, faces);
}
/** Which cube side a corner of cube() belongs to (two triangles, six corners per side). */
const cubeFace = corner => ['+z', '-z', '+x', '-x', '+y', '-y'][Math.floor(corner / 6)];
function tube(radius = 2, height = 4, segments = 16) {
  const points = [], faces = [];
  for (const z of [0, height]) for (let i = 0; i < segments; i++) { const a = 2 * Math.PI * i / segments; points.push([radius * Math.cos(a), radius * Math.sin(a), z]); }
  for (let i = 0; i < segments; i++) { const j = (i + 1) % segments; faces.push(i, j, segments + j, i, segments + j, segments + i); }
  return geosetOf(points, faces);
}
const all = geoset => Array.from({ length: geoset.Vertices.length / 3 }, (_, i) => i);
const at = (geoset, i) => [geoset.Vertices[i * 3], geoset.Vertices[i * 3 + 1], geoset.Vertices[i * 3 + 2]];
const outward = (geoset, centre = [0, 0, 0]) => {
  for (let c = 0; c < geoset.Faces.length; c += 3) {
    const [a, b, d] = [0, 1, 2].map(k => at(geoset, geoset.Faces[c + k])), n = crossV(b.map((x, i) => x - a[i]), d.map((x, i) => x - a[i]));
    const middle = [0, 1, 2].map(i => (a[i] + b[i] + d[i]) / 3 - centre[i]);
    assert.ok(dotV(n, middle) > 0, 'test mesh is wound outward');
  }
};
const area2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const cornerTriangles = (geoset, corners) => { const list = []; for (let c = 0; c < geoset.Faces.length; c += 3) if (corners.has(c)) list.push([corners.get(c), corners.get(c + 1), corners.get(c + 2)]); return list; };
/** Interiors of two UV triangles overlap (shared edges and corners are allowed). */
function overlap(t1, t2) {
  const eps = 1e-9, axes = [];
  for (const t of [t1, t2]) for (let k = 0; k < 3; k++) { const a = t[k], b = t[(k + 1) % 3]; axes.push([a[1] - b[1], b[0] - a[0]]); }
  for (const [x, y] of axes) {
    const range = t => { const values = t.map(p => p[0] * x + p[1] * y); return [Math.min(...values), Math.max(...values)]; };
    const [a0, a1] = range(t1), [b0, b1] = range(t2), scale = Math.hypot(x, y) || 1;
    if (a1 <= b0 + eps * scale || b1 <= a0 + eps * scale) return false;
  }
  return true;
}
function assertNoOverlap(triangles, label) {
  for (let i = 0; i < triangles.length; i++) for (let j = i + 1; j < triangles.length; j++)
    assert.equal(overlap(triangles[i], triangles[j]), false, `${label}: triangles ${i} and ${j} overlap ${JSON.stringify([triangles[i], triangles[j]])}`);
}
const meanOf = (values, points) => [0, 1].map(axis => points.reduce((sum, i) => sum + values[i * 2 + axis], 0) / points.length);
/** Commit corner UVs to a copy of one geoset the way the app does. */
function commit(geoset, corners) {
  const copy = structuredClone(geoset), before = structuredClone(geoset), combined = combineUVGeosets({ Geosets: [copy] }, [0], { 0: all(copy) }, { 0: all(copy) });
  const [plan] = planUVCorners(combined, corners), result = splitUVCorners(copy, plan.uvSet, plan.corners);
  for (let c = 0; c < before.Faces.length; c++) assert.deepEqual(at(copy, copy.Faces[c]), at(before, before.Faces[c]), 'every corner keeps its 3D position');
  return { geoset: copy, result };
}

// ---- Box Projection -------------------------------------------------------------------------
test('Box Projection lays a cube out as an unfolded cross with shared edges touching', () => {
  const geoset = cube(); outward(geoset);
  const corners = boxProjectUVCorners(geoset, all(geoset), FRONT, PROJECTION);
  assert.equal(corners.size, 36);
  // FRONT looks along -X with Z up: view right is +Y, so the cube's +X face is the front.
  const box = name => { const us = [], vs = []; for (let c = 0; c < 36; c++) if (cubeFace(c) === name) { const [u, v] = corners.get(c); us.push(u); vs.push(v); } return [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)]; };
  const front = box('+x'), w = 2 * SU, h = 2 * SV, close = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-9, `${label}: ${a} vs ${b}`);
  close(front[1] - front[0], w, 'front width at the Project from Current View scale'); close(front[3] - front[2], h, 'front height');
  const expect = { '+y': [1, 0], '-x': [2, 0], '-y': [-1, 0], '+z': [0, -1], '-z': [0, 1] }; // view right +Y, back -X, left -Y, top +Z
  for (const [name, [dx, dy]] of Object.entries(expect)) {
    const side = box(name);
    close(side[0], front[0] + dx * w, name + ' left'); close(side[1], front[1] + dx * w, name + ' right');
    close(side[2], front[2] + dy * h, name + ' top'); close(side[3], front[3] + dy * h, name + ' bottom');
  }
  const triangles = cornerTriangles(geoset, corners);
  for (const t of triangles) assert.ok(area2(...t) < 0, 'no flipped triangle: every side keeps the front-face orientation');
  assertNoOverlap(triangles, 'Box');
  // The front face projects exactly like Project from Current View, apart from where the layout is anchored.
  const projected = projectUVFromView(geoset, all(geoset), FRONT, PROJECTION);
  const offsets = new Set();
  for (let c = 12; c < 18; c++) { const p = geoset.Faces[c], [u, v] = corners.get(c); offsets.add([(u - projected[p * 2]).toFixed(6), (v - projected[p * 2 + 1]).toFixed(6)].join()); }
  assert.equal(offsets.size, 1, 'front side = Project from Current View shifted');
  // Shared box edges touch: the front/right edge needs no copy, the cube needs only the cut edges' copies.
  const { geoset: done, result } = commit(geoset, corners);
  assert.equal(result.added, uvCornerCopies(geoset, planUVCorners(combineUVGeosets({ Geosets: [geoset] }, [0], { 0: all(geoset) }, { 0: all(geoset) }), corners)[0].corners));
  assert.ok(result.added > 0 && result.added < 16, 'points are copied only where two sides meet without touching: ' + result.added);
  const spots = new Set(); for (let p = 0; p < done.Vertices.length / 3; p++) spots.add(done.TVertices[0][p * 2].toFixed(6) + ',' + done.TVertices[0][p * 2 + 1].toFixed(6) + ',' + at(done, p).join());
  assert.equal(spots.size, done.Vertices.length / 3, 'no two points share both their UV spot and position');
  assert.deepEqual(meanOf(done.TVertices[0], all(done)).map(x => +x.toFixed(5)), meanOf(geoset.TVertices[0], all(geoset)).map(x => +x.toFixed(5)), 'anchored on the current UV centre');
});

test('Box Projection only uses whole selected triangles', () => {
  const geoset = cube();
  assert.throws(() => boxProjectUVCorners(geoset, [4, 5], FRONT, PROJECTION), { message: WHOLE_TRIANGLE_ERROR });
  const corners = boxProjectUVCorners(geoset, [4, 5, 6, 7, 0], FRONT, PROJECTION);
  assert.deepEqual([...corners.keys()].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 18, 19, 20, 33, 34, 35], 'the +Z face, then one -X and one -Y triangle: those with all three corners selected');
  assert.throws(() => boxProjectUVCorners(geoset, all(geoset), null, PROJECTION), { message: 'Rotate the live preview before projecting.' });
});

// ---- Cylinder Projection --------------------------------------------------------------------
test('Cylinder Projection wraps a tube with its seam at the back and keeps its proportions', () => {
  const segments = 16, radius = 2, height = 4, geoset = tube(radius, height, segments); outward(geoset, [0, 0, 2]);
  const corners = cylinderProjectUVCorners(geoset, all(geoset), FRONT, PROJECTION), triangles = cornerTriangles(geoset, corners);
  const us = [...corners.values()].map(([u]) => u), vs = [...corners.values()].map(([, v]) => v);
  const close = (a, b, label, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${label}: ${a} vs ${b}`);
  close(Math.max(...us) - Math.min(...us), 2 * Math.PI * radius * SU, 'U span is the circumference at the projection scale');
  close(Math.max(...vs) - Math.min(...vs), height * SV, 'V span is the height at the projection scale');
  const step = 2 * Math.PI * radius * SU / segments;
  for (const t of triangles) {
    assert.ok(Math.max(...t.map(p => p[0])) - Math.min(...t.map(p => p[0])) < step * 1.0001, 'no triangle spans the seam');
    assert.ok(area2(...t) < 0, 'no flipped triangle');
  }
  assertNoOverlap(triangles, 'Cylinder');
  // Front (+X, facing the viewer) sits in the middle; both ends of the strip are behind the axis.
  const uOf = point => [...corners].filter(([c]) => geoset.Faces[c] === point).map(([, uv]) => uv[0]);
  const middle = (Math.max(...us) + Math.min(...us)) / 2;
  assert.ok(Math.abs(uOf(0)[0] - middle) <= step + 1e-9, 'front point in the middle (the seam triangles sit on one side)');
  const ends = [...corners].filter(([, [u]]) => Math.abs(u - Math.min(...us)) < 1e-9 || Math.abs(u - Math.max(...us)) < 1e-9).map(([c]) => at(geoset, geoset.Faces[c]));
  assert.ok(ends.length && ends.every(([x]) => x < 0), 'the seam is behind, away from the viewer');
  assert.ok(corners.get(0)[1] > corners.get(2)[1], 'up on screen is up on the texture (smaller V at the top)');
  const { result } = commit(geoset, corners);
  assert.equal(result.added, 2, 'copies only for the seam column (one per ring)');
});

// ---- Straighten -----------------------------------------------------------------------------
test('Straighten makes a row when wider than tall and a column otherwise', () => {
  const values = new Float32Array([0, .1, 1, .3, 2, .2, 3, .4, 9, 9]);
  const row = straightenUVCoordinates(values, [0, 1, 2, 3]);
  assert.deepEqual([...row], [0, .25, 1, .25, 2, .25, 3, .25, 9, 9].map(Math.fround));
  const tall = new Float32Array([.1, 0, .3, 1, .2, 2, 5, 5]);
  assert.deepEqual([...straightenUVCoordinates(tall, [0, 1, 2])], [.2, 0, .2, 1, .2, 2, 5, 5].map(Math.fround));
  // A seam duplicate (same UV spot and position) counts once and moves with its twin.
  const geoset = { Vertices: new Float32Array([0,0,0, 1,0,0, 2,0,0, 3,0,0, 0,0,0]) };
  const seam = straightenUVCoordinates(new Float32Array([0, .1, 1, .3, 2, .2, 3, .4, 0, .1]), [0, 1, 2, 3, 4], geoset);
  assert.deepEqual([...seam], [0, .25, 1, .25, 2, .25, 3, .25, 0, .25].map(Math.fround));
});

// ---- Mirror Copy ----------------------------------------------------------------------------
function mirrorStrip() {
  // A strip of five columns (x = -3, -1.2, 0, 1.2, 3; id takes the column -2..2) over y = 0..1. The
  // right half point in column 1 at y = 0 also has a seam twin (index 10) used by one extra triangle
  // that mirrors nothing on the left. Uneven columns: the strip has one symmetry plane only.
  const points = [], uv = [], X = [-3, -1.2, 0, 1.2, 3];
  for (const y of [0, 1]) for (const x of [-2, -1, 0, 1, 2]) { points.push([X[x + 2], y, 0]); uv.push([x < 0 ? .1 + .1 * (x + 2) : .6 + .1 * x, .2 + .3 * y]); }
  const id = (x, y) => y * 5 + x + 2, faces = [];
  for (let x = -2; x < 2; x++) faces.push(id(x, 0), id(x + 1, 0), id(x + 1, 1), id(x, 0), id(x + 1, 1), id(x, 1));
  points.push([1.2, 0, 0], [1.6, -1, 0], [2.4, -1, 0]); uv.push([.9, .9], [.95, .95], [.99, .99]);
  faces.push(10, 11, 12);
  return { geoset: geosetOf(points, faces, uv), id };
}

test('Mirror Copy copies the selected half onto its mirror points', () => {
  const { geoset, id } = mirrorStrip(), values = geoset.TVertices[0], all13 = all(geoset);
  const selected = [id(-2, 0), id(-1, 0), id(0, 0), id(-2, 1), id(-1, 1), id(0, 1)];
  const next = mirrorCopyUVCoordinates(geoset, selected, all13);
  const uv = i => [next[i * 2], next[i * 2 + 1]], was = i => [values[i * 2], values[i * 2 + 1]];
  for (const y of [0, 1]) {
    assert.deepEqual(uv(id(2, y)), was(id(-2, y)), 'x = 2 takes x = -2');
    assert.deepEqual(uv(id(1, y)), was(id(-1, y)), 'x = 1 takes x = -1');
    assert.deepEqual(uv(id(0, y)), was(id(0, y)), 'points on the plane stay');
    for (const x of [-2, -1]) assert.deepEqual(uv(id(x, y)), was(id(x, y)), 'the selected source keeps its UV');
  }
  assert.deepEqual(uv(10), was(10), 'the seam twin whose triangle mirrors nothing keeps its UV');
  assert.deepEqual([uv(11), uv(12)], [was(11), was(12)], 'unmatched points stay');
  assert.throws(() => mirrorCopyUVCoordinates(geoset, [11], all13), { message: NO_MIRROR_POINTS_ERROR });
});

test('Mirror Copy finds the symmetry plane when a posed part pulls the points off centre', () => {
  // Like the Footman's sword arm: an extra unselected part far on +X moves the middle of the points to x = 3.
  const { geoset, id } = mirrorStrip(), count = geoset.Vertices.length / 3;
  const points = [...Array(count)].map((_, i) => at(geoset, i)).concat([[7, 3, 0], [8, 3, 0], [8, 4, 0]]);
  const uv = [...Array(count)].map((_, i) => [geoset.TVertices[0][i * 2], geoset.TVertices[0][i * 2 + 1]]).concat([[0, 0], [1, 0], [1, 1]]);
  const g = geosetOf(points, [...geoset.Faces, count, count + 1, count + 2], uv), values = g.TVertices[0];
  const next = mirrorCopyUVCoordinates(g, [id(-2, 0), id(-1, 0), id(0, 0), id(-2, 1), id(-1, 1), id(0, 1)], all(g));
  for (const y of [0, 1]) for (const x of [1, 2]) assert.deepEqual([next[id(x, y) * 2], next[id(x, y) * 2 + 1]], [values[id(-x, y) * 2], values[id(-x, y) * 2 + 1]]);
  for (const i of [count, count + 1, count + 2]) assert.deepEqual([next[i * 2], next[i * 2 + 1]], [values[i * 2], values[i * 2 + 1]], 'the posed part stays');
});

test('Mirror Copy moves target seam duplicates with the same UV spot together', () => {
  const { geoset, id } = mirrorStrip();
  // Give (2, 0) a twin with the same UV spot and position; both must take the source UV.
  const twin = geoset.Vertices.length / 3, points = [...Array(twin)].map((_, i) => at(geoset, i)).concat([at(geoset, id(2, 0))]);
  const uv = [...Array(twin)].map((_, i) => [geoset.TVertices[0][i * 2], geoset.TVertices[0][i * 2 + 1]]).concat([[geoset.TVertices[0][id(2, 0) * 2], geoset.TVertices[0][id(2, 0) * 2 + 1]]]);
  const faces = [...geoset.Faces]; faces[faces.indexOf(id(2, 0))] = twin;
  const g = geosetOf(points, faces, uv), next = mirrorCopyUVCoordinates(g, [id(-2, 0), id(-1, 0), id(-2, 1), id(-1, 1)], all(g));
  assert.deepEqual([next[twin * 2], next[twin * 2 + 1]], [next[id(2, 0) * 2], next[id(2, 0) * 2 + 1]]);
  assert.deepEqual([next[twin * 2], next[twin * 2 + 1]], [g.TVertices[0][id(-2, 0) * 2], g.TVertices[0][id(-2, 0) * 2 + 1]]);
});

// ---- Unwrap ---------------------------------------------------------------------------------
function curvedStrip({ split = false } = {}) {
  // Points on an arc of 120 degrees around Z (radius 3) at three heights, facing +X. With `split` the
  // middle column has seam twins: the right half uses its own points at the same positions.
  const columns = 9, points = [], uv = [], index = new Map(), faces = [];
  for (let c = 0; c < columns; c++) for (const z of [0, 1, 2]) {
    const a = (-60 + 120 * c / (columns - 1)) * Math.PI / 180;
    index.set(c + ',' + z, points.length); points.push([3 * Math.cos(a), 3 * Math.sin(a), z]); uv.push([c / 8 * .3 + .1, .7 - z * .2]);
    if (split && c === 4) { index.set('twin,' + z, points.length); points.push([3 * Math.cos(a), 3 * Math.sin(a), z]); uv.push([.9, .1 * z]); }
  }
  const id = (c, z, right) => index.get(split && right && c === 4 ? 'twin,' + z : c + ',' + z);
  for (let c = 0; c + 1 < columns; c++) for (const z of [0, 1]) {
    const right = c >= 4;
    faces.push(id(c, z, right), id(c + 1, z, right), id(c + 1, z + 1, right), id(c, z, right), id(c + 1, z + 1, right), id(c, z + 1, right));
  }
  return { geoset: geosetOf(points, faces, uv), id };
}
const uvArea = triangles => triangles.reduce((sum, t) => sum + Math.abs(area2(...t)) / 2, 0);
function meshArea(geoset) {
  let sum = 0;
  for (let c = 0; c < geoset.Faces.length; c += 3) { const [a, b, d] = [0, 1, 2].map(k => at(geoset, geoset.Faces[c + k])); sum += Math.hypot(...crossV(b.map((x, i) => x - a[i]), d.map((x, i) => x - a[i]))) / 2; }
  return sum;
}

test('Unwrap lays a curved open strip flat, upright and at the projection scale', () => {
  for (const split of [false, true]) {
    const { geoset, id } = curvedStrip({ split }); outward(geoset, [0, 0, 1]);
    const corners = unwrapUVCorners(geoset, all(geoset), FRONT, PROJECTION), triangles = cornerTriangles(geoset, corners);
    for (const t of triangles) assert.ok(area2(...t) < 0, 'no flipped triangle (same orientation as the view projection)');
    assertNoOverlap(triangles, 'strip');
    const area = uvArea(triangles), expected = meshArea(geoset) * SU * SV;
    assert.ok(Math.abs(area - expected) / expected < 1e-6, `UV area equals 3D area at the projection scale: ${area} vs ${expected}`);
    const { geoset: done, result } = commit(geoset, corners), uv = (c, z, right) => [done.TVertices[0][id(c, z, right) * 2], done.TVertices[0][id(c, z, right) * 2 + 1]];
    assert.equal(result.added, 0, 'an open piece needs no copies');
    // The arc (eight chords of 15 degrees on radius 3) unrolls to its length along screen right; up stays up.
    const width = uv(8, 0)[0] - uv(0, 0)[0], chords = 8 * 2 * 3 * Math.sin(7.5 * Math.PI / 180) * SU;
    assert.ok(Math.abs(width - chords) < 1e-4 * chords, `unrolled length ${width} vs ${chords}`);
    for (let c = 0; c < 8; c++) assert.ok(uv(c + 1, 1)[0] > uv(c, 1)[0], 'screen right stays right');
    for (let c = 0; c < 9; c++) assert.ok(uv(c, 2)[1] < uv(c, 0)[1], 'up on screen is up on the texture');
    if (split) for (const z of [0, 1, 2]) assert.deepEqual(uv(4, z, true), uv(4, z, false), 'points at one 3D position get one UV: the old UV split does not cut');
    const source = meanOf(geoset.TVertices[0], all(geoset)), mean = meanOf(done.TVertices[0], all(done));
    assert.ok(Math.hypot(source[0] - mean[0], source[1] - mean[1]) < 1e-6, 'anchored on the current UV centre');
  }
});

test('Unwrap cuts a closed cube along its outline from the live preview', () => {
  const geoset = cube(); outward(geoset);
  const corners = unwrapUVCorners(geoset, all(geoset), ANGLED, PROJECTION), triangles = cornerTriangles(geoset, corners);
  for (const t of triangles) assert.ok(area2(...t) < 0, 'no flipped triangle');
  assertNoOverlap(triangles, 'cube');
  const area = uvArea(triangles), expected = 24 * SU * SV;
  assert.ok(Math.abs(area - expected) / expected < 1e-6, `UV area at the projection scale: ${area} vs ${expected}`);
  // Seen from (1, 1, 1) the +X, +Y and +Z faces face the viewer; the other three are laid to their right.
  const facing = c => ['+x', '+y', '+z'].includes(cubeFace(c)), uOf = test => [...corners].filter(([c]) => test(c)).map(([, [u]]) => u);
  const front = uOf(facing), back = uOf(c => !facing(c)), frontWidth = Math.max(...front) - Math.min(...front);
  assert.ok(Math.abs(Math.min(...back) - (Math.max(...front) + frontWidth * .05)) < 1e-9, 'back piece to the right with a 5% gap');
  // Up on screen is up on the texture: the front piece's V follows the projection's V.
  const projected = projectUVFromView(geoset, all(geoset), ANGLED, PROJECTION), pairs = [...corners].filter(([c]) => facing(c)).map(([c, [u, v]]) => [v, projected[geoset.Faces[c] * 2 + 1], u, projected[geoset.Faces[c] * 2]]);
  const correlation = (a, b) => { const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length; let ab = 0, aa = 0, bb = 0; a.forEach((x, i) => { ab += (x - ma) * (b[i] - mb); aa += (x - ma) ** 2; bb += (b[i] - mb) ** 2; }); return ab / Math.sqrt(aa * bb); };
  assert.ok(correlation(pairs.map(p => p[0]), pairs.map(p => p[1])) > .9, 'V matches the view projection');
  assert.ok(correlation(pairs.map(p => p[2]), pairs.map(p => p[3])) > .9, 'U matches the view projection');
  // Copies only along the cut: six of the eight corners lie on the outline.
  const { geoset: done, result } = commit(geoset, corners);
  assert.equal(result.added, 6);
  const copied = result.created.map(i => at(done, i).join()).sort();
  assert.deepEqual(copied, ['-1,-1,1', '-1,1,-1', '-1,1,1', '1,-1,-1', '1,-1,1', '1,1,-1'].sort());
});

// ---- Relax ----------------------------------------------------------------------------------
function grid(size = 7) {
  const points = [], uv = [], faces = [], id = (x, y) => y * size + x;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { points.push([x, y, 0]); uv.push([.1 + .8 * x / (size - 1), .1 + .8 * y / (size - 1)]); }
  for (let y = 0; y + 1 < size; y++) for (let x = 0; x + 1 < size; x++) faces.push(id(x, y), id(x + 1, y), id(x + 1, y + 1), id(x, y), id(x + 1, y + 1), id(x, y + 1));
  return { geoset: geosetOf(points, faces, uv), id, size };
}

test('Relax untangles a scrambled grid inside its fixed border', () => {
  const { geoset, id, size } = grid(), straight = new Float32Array(geoset.TVertices[0]);
  let seed = 7; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const scrambled = new Float32Array(straight);
  for (let y = 1; y + 1 < size; y++) for (let x = 1; x + 1 < size; x++) { scrambled[id(x, y) * 2] = .1 + .8 * random(); scrambled[id(x, y) * 2 + 1] = .1 + .8 * random(); }
  geoset.TVertices[0] = scrambled;
  const triangles = values => { const list = []; for (let c = 0; c < geoset.Faces.length; c += 3) list.push([0, 1, 2].map(k => [values[geoset.Faces[c + k] * 2], values[geoset.Faces[c + k] * 2 + 1]])); return list; };
  assert.ok(triangles(scrambled).some(t => area2(...t) < 0), 'the scrambled grid starts with flipped triangles');
  const next = relaxUVCoordinates(geoset, all(geoset), all(geoset));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = id(x, y), border = x === 0 || y === 0 || x === size - 1 || y === size - 1;
    if (border) assert.deepEqual([next[i * 2], next[i * 2 + 1]], [scrambled[i * 2], scrambled[i * 2 + 1]], 'the border stays');
    else assert.ok(Math.abs(next[i * 2] - straight[i * 2]) < 1e-5 && Math.abs(next[i * 2 + 1] - straight[i * 2 + 1]) < 1e-5, 'a flat grid relaxes back to even spacing');
  }
  for (const t of triangles(next)) assert.ok(area2(...t) > 0, 'no flipped triangle afterwards');
});

test('Relax keeps unselected points and the selection edge, and moves seam twins together', () => {
  const { geoset, id } = grid(5);
  // A twin of the centre point (same UV spot and position) used by two of its triangles.
  const centre = id(2, 2), twin = geoset.Vertices.length / 3;
  const points = [...Array(twin)].map((_, i) => at(geoset, i)).concat([at(geoset, centre)]);
  const uv = [...Array(twin)].map((_, i) => [geoset.TVertices[0][i * 2], geoset.TVertices[0][i * 2 + 1]]).concat([[.6, .4]]);
  uv[centre] = [.6, .4];
  const faces = [...geoset.Faces]; let swapped = 0;
  for (let c = 0; c < faces.length && swapped < 2; c++) if (faces[c] === centre) { faces[c] = twin; swapped++; }
  const g = geosetOf(points, faces, uv), inner = [1, 2, 3].flatMap(y => [1, 2, 3].map(x => id(x, y)));
  const selection = [...inner, twin, id(0, 0)];
  const next = relaxUVCoordinates(g, selection, all(g));
  assert.deepEqual([next[twin * 2], next[twin * 2 + 1]], [next[centre * 2], next[centre * 2 + 1]], 'seam twins move together');
  assert.ok(Math.abs(next[centre * 2] - .5) < 1e-5 && Math.abs(next[centre * 2 + 1] - .5) < 1e-5, 'the free centre relaxes');
  for (const i of all(g)) if (i !== centre && i !== twin) assert.deepEqual([next[i * 2], next[i * 2 + 1]], [g.TVertices[0][i * 2], g.TVertices[0][i * 2 + 1]], 'every other point stays: unselected or on the selection edge');
  assert.throws(() => relaxUVCoordinates(g, [id(0, 0), id(1, 0), id(1, 1)], all(g)), { message: RELAX_EDGE_ERROR });
});

// ---- point copies ---------------------------------------------------------------------------
test('splitUVCorners copies only the points that need two UV spots, with every attribute', () => {
  const geoset = {
    Vertices: new Float32Array([0,0,0, 1,0,0, 1,1,0, 0,1,0]), Normals: new Float32Array([0,0,1, 0,1,0, 1,0,0, 0,0,-1]), VertexGroup: new Uint8Array([0, 1, 2, 3]),
    TVertices: [new Float32Array([0,0, 1,0, 1,1, 0,1]), new Float32Array([.5,.5, .6,.6, .7,.7, .8,.8])], Faces: new Uint16Array([0,1,2, 0,2,3]),
    Tangents: new Float32Array(16).map((_, i) => i), SkinWeights: new Uint8Array(32).map((_, i) => i),
  };
  const before = structuredClone(geoset);
  // The second triangle is moved away; its points 0 and 2 also belong to the first triangle.
  const corners = [[0, 0, .1, .1], [1, 1, .2, .1], [2, 2, .2, .2], [3, 0, .5, .5], [4, 2, .6, .6], [5, 3, .5, .6]];
  assert.equal(uvCornerCopies(geoset, corners), 2);
  const result = splitUVCorners(geoset, 0, corners);
  assert.deepEqual(result, { added: 2, created: [4, 5] });
  assert.ok(geoset.Faces instanceof Uint16Array);
  assert.deepEqual([...geoset.Faces], [0, 1, 2, 4, 5, 3]);
  assert.deepEqual([...geoset.TVertices[0]].map(x => +x.toFixed(6)), [.1,.1, .2,.1, .2,.2, .5,.6, .5,.5, .6,.6]);
  for (const [copy, source] of [[4, 0], [5, 2]]) {
    assert.deepEqual([...geoset.Vertices.slice(copy * 3, copy * 3 + 3)], [...before.Vertices.slice(source * 3, source * 3 + 3)]);
    assert.deepEqual([...geoset.Normals.slice(copy * 3, copy * 3 + 3)], [...before.Normals.slice(source * 3, source * 3 + 3)]);
    assert.equal(geoset.VertexGroup[copy], before.VertexGroup[source]);
    assert.deepEqual([...geoset.TVertices[1].slice(copy * 2, copy * 2 + 2)], [...before.TVertices[1].slice(source * 2, source * 2 + 2)], 'other UV sets are copied unchanged');
    assert.deepEqual([...geoset.Tangents.slice(copy * 4, copy * 4 + 4)], [...before.Tangents.slice(source * 4, source * 4 + 4)]);
    assert.deepEqual([...geoset.SkinWeights.slice(copy * 8, copy * 8 + 8)], [...before.SkinWeights.slice(source * 8, source * 8 + 8)]);
  }
  for (let c = 0; c < 6; c++) assert.deepEqual(at(geoset, geoset.Faces[c]), at(before, before.Faces[c]), '3D unchanged');
  // Matching spots need no copy.
  const plain = structuredClone(before);
  assert.deepEqual(splitUVCorners(plain, 0, [[0, 0, .3, .3], [3, 0, .3, .3]]), { added: 0, created: [] });
  assert.deepEqual([...plain.TVertices[0].slice(0, 2)].map(x => +x.toFixed(6)), [.3, .3]);
  assert.equal(plain.Vertices.length, 12);
  assert.throws(() => splitUVCorners(structuredClone(before), 0, [[0, 1, 0, 0]]), { message: 'The UV map changed structure before the edit could be applied.' });
  // The 65,536-point limit uses Uncouple's error.
  const big = { Vertices: new Float32Array(65535 * 3), TVertices: [new Float32Array(65535 * 2)], Faces: new Uint16Array([0, 1, 2, 0, 2, 3, 0, 3, 4]) };
  assert.throws(() => splitUVCorners(big, 0, [[0, 0, 0, 0], [3, 0, 1, 1], [6, 0, 2, 2]]), { message: POINT_LIMIT_ERROR });
});

test('corner results map back to each geoset of the combined canvas', () => {
  const a = cube(), b = cube(); b.Vertices = b.Vertices.map((x, i) => i % 3 === 0 ? x + 5 : x);
  const model = { Geosets: [a, b] }, combined = combineUVGeosets(model, [0, 1], { 0: all(a), 1: all(b) }, { 0: all(a), 1: [4, 5, 6, 7] });
  assert.deepEqual(combined.faceStarts, { 0: 0, 1: 36 });
  const corners = boxProjectUVCorners(combined.geoset, combined.selectedVertices, FRONT, PROJECTION, combined.geoset.TVertices[0]);
  const plans = planUVCorners(combined, corners);
  assert.deepEqual(plans.map(plan => [plan.geosetIndex, plan.uvSet, plan.corners.length]), [[0, 0, 36], [1, 0, 6]]);
  assert.deepEqual(plans[1].corners.map(([corner, point]) => [corner, point]), [[0, 4], [1, 5], [2, 6], [3, 4], [4, 6], [5, 7]]);
  assert.deepEqual(wholeSelectedTriangles(combined.geoset.Faces, combined.selectedVertices).length, 12 + 2);
});

// ---- button rules ---------------------------------------------------------------------------
test('the new tools follow their selection rules', () => {
  const state = uvToolState({ selectionCount: 3, eligibleCount: 10, triangleCount: 1 });
  assert.deepEqual([state.boxProjection, state.cylinderProjection, state.unwrap, state.straighten, state.mirrorCopy, state.relax], [true, true, true, true, true, true]);
  assert.deepEqual(Object.values(uvToolState({ selectionCount: 3, eligibleCount: 10, triangleCount: 0 })).slice(6), [false, false, false, true, true, false, false], 'whole triangles needed for Box, Cylinder, Unwrap, Relax and Fit');
  assert.equal(uvToolState({ selectionCount: 1, eligibleCount: 10, triangleCount: 0 }).straighten, false, 'Straighten needs two points');
  assert.equal(uvToolState({ selectionCount: 10, eligibleCount: 10, triangleCount: 4 }).mirrorCopy, false, 'Mirror Copy needs unselected points to copy onto');
  const draft = uvToolState({ selectionCount: 3, eligibleCount: 10, triangleCount: 1, draftCount: 1 });
  assert.deepEqual([draft.boxProjection, draft.cylinderProjection, draft.unwrap, draft.straighten, draft.mirrorCopy, draft.relax, draft.fit], [false, false, false, true, true, true, true], 'point-adding tools wait for the test texture, like Uncouple; Fit only moves points');
  const locked = uvToolState({ readOnly: true, selectionCount: 3, eligibleCount: 10, triangleCount: 1 });
  assert.ok(Object.values(locked).every(value => value === false));
});

// ---- labels and tooltips ----------------------------------------------------------------------
test('every new label, tooltip and message is translated in all five languages', () => {
  const ui = readFileSync(new URL('../app/UVWorkspace.jsx', import.meta.url), 'utf8');
  const texts = [...ui.matchAll(/(?:title|description)="((?:Projects each|Wraps the|Straighten:|Mirror Copy:|Unwrap:|Relax:)[^"]*)"/g)].map(match => match[1]);
  assert.equal(texts.length, 6, 'six tooltips found in the UV Wrapper');
  for (const label of ['Box Projection', 'Cylinder Projection', 'Straighten', 'Mirror Copy', 'Unwrap', 'Relax']) assert.match(ui, new RegExp('data-hotkey-label="' + label + '"'));
  for (const locale of ['de', 'es', 'fr', 'ru', 'zh']) for (const text of ['Box Projection', 'Cylinder Projection', 'Straighten', 'Mirror Copy', 'Unwrap', 'Relax', ...texts, NO_MIRROR_POINTS_ERROR, RELAX_EDGE_ERROR, POINT_LIMIT_ERROR])
    assert.notEqual(translate(text, locale), text, locale + ': ' + text);
});
