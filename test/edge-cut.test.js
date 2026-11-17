import test from 'node:test';
import assert from 'node:assert/strict';
import { cutTargets, cutTriangles } from '../src/edge-cut.js';

// A tip triangle on a connector quad, as in a tapered spike on a neck:
// tip 0, base 1-2, connector 1-2-4-3 (triangles 2-1-3 and 2-3-4).
const spike = (extra = {}) => ({
  Vertices: new Float32Array([5, 20, 0, 0, 10, 0, 10, 10, 0, 0, 0, 0, 10, 0, 0]),
  Normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
  TVertices: [new Float32Array([.5, 0, 0, .5, 1, .5, 0, 1, 1, 1])],
  VertexGroup: new Uint8Array([0, 0, 1, 0, 1]), Groups: [[0], [1]],
  Faces: new Uint16Array([0, 1, 2, 2, 1, 3, 2, 3, 4]),
  ...extra,
});
// Each triangle starting at its lowest index, so the same winding always reads the same.
const faces = g => Array.from({ length: g.Faces.length / 3 }, (_, f) => { const face = Array.from(g.Faces.subarray(f * 3, f * 3 + 3)), first = face.indexOf(Math.min(...face)); return [...face.slice(first), ...face.slice(0, first)]; });
const facing = (g, [a, b, c]) => { const p = i => Array.from(g.Vertices.subarray(i * 3, i * 3 + 3)), u = p(b).map((v, k) => v - p(a)[k]), w = p(c).map((v, k) => v - p(a)[k]); return Math.sign(u[0] * w[1] - u[1] * w[0]); };

test('targets: the far line of each touching triangle and the far corner of the quad it starts', () => {
  const g = spike(), targets = cutTargets(g.Faces, g.Vertices, 0);
  assert.deepEqual([...targets.start], [0]);
  assert.deepEqual(targets.edges, [[1, 2]]);
  assert.deepEqual([...targets.corners], [[3, [1, 2]]]);
});

test('cutting the base splits the tip triangle and the connector behind it at one new point', () => {
  const model = { Geosets: [spike()] }, g = model.Geosets[0];
  const result = cutTriangles(model, { geosetIndex: 0, start: 0, a: 1, b: 2, t: .25 });
  assert.deepEqual(result, { selection: [5], split: 2 });
  assert.deepEqual(Array.from(g.Vertices.subarray(15)), [2.5, 10, 0]);
  assert.deepEqual(Array.from(g.TVertices[0].subarray(10)), [.25, .5]);
  assert.deepEqual(Array.from(g.Normals.subarray(15)), [0, 0, 1]);
  assert.equal(g.VertexGroup[5], 0, 'the nearer end binds the new point');
  // The tip gets its line to the new point; the connector gets a line from its corner to it.
  assert.deepEqual(faces(g), [[0, 1, 5], [0, 5, 2], [2, 5, 3], [1, 3, 5], [2, 3, 4]]);
  for (const face of faces(g)) assert.equal(facing(g, face), facing(spike(), [0, 1, 2]), 'winding kept');
});

test('copies on the same spot are cut too, each keeping its own texture position', () => {
  // The connector uses its own copies 5 and 6 of the base (a texture seam).
  const g = spike({
    Vertices: new Float32Array([5, 20, 0, 0, 10, 0, 10, 10, 0, 0, 0, 0, 10, 0, 0, 0, 10, 0, 10, 10, 0]),
    Normals: new Float32Array(21).map((_, i) => i % 3 === 2 ? 1 : 0),
    TVertices: [new Float32Array([.5, 0, 0, .5, 1, .5, 0, 1, 1, 1, 0, .8, 1, .8])],
    VertexGroup: new Uint8Array([0, 0, 1, 0, 1, 0, 1]),
    Faces: new Uint16Array([0, 1, 2, 6, 5, 3, 6, 3, 4]),
  });
  const other = spike({ Faces: new Uint16Array([2, 1, 3]) }), far = spike({ Vertices: new Float32Array(15).fill(50), Faces: new Uint16Array([2, 1, 3]) });
  const model = { Geosets: [g, other, far] };
  const result = cutTriangles(model, { geosetIndex: 0, start: 0, a: 2, b: 1, t: .5 });
  assert.equal(result.split, 3, 'two here, one in the other geoset');
  assert.equal(g.Vertices.length / 3, 9);
  assert.deepEqual(faces(g), [[0, 1, 7], [0, 7, 2], [3, 6, 8], [3, 8, 5], [3, 4, 6]]);
  assert.deepEqual(Array.from(g.TVertices[0].subarray(14)), [.5, .5, .5, Math.fround(.8)]);
  assert.deepEqual(result.selection, [7, 8]);
  // A line on the same spot in another geoset splits as well; a geoset elsewhere is untouched.
  assert.deepEqual(faces(other), [[2, 5, 3], [1, 3, 5]]);
  assert.deepEqual(faces(far), [[1, 3, 2]]);
  assert.equal(far.Vertices.length, 15);
});

test('clicking the far corner turns the quad\'s middle line to it, without new points', () => {
  const model = { Geosets: [spike({ Faces: new Uint16Array([1, 2, 3, 3, 2, 4]) })] }, g = model.Geosets[0];
  assert.deepEqual([...cutTargets(g.Faces, g.Vertices, 1).corners.keys()], [4]);
  assert.deepEqual(cutTriangles(model, { geosetIndex: 0, start: 1, vertex: 4 }), { selection: [], turned: 1 });
  assert.equal(g.Vertices.length, 15);
  assert.deepEqual(faces(g), [[1, 2, 4], [1, 4, 3]]);
  for (const face of faces(g)) assert.equal(facing(g, face), facing(g, [1, 2, 3]));
});

test('a line that does not face the first point is refused and nothing changes', () => {
  const model = { Geosets: [spike()] }, before = Array.from(model.Geosets[0].Faces);
  assert.throws(() => cutTriangles(model, { geosetIndex: 0, start: 0, a: 3, b: 4, t: .5 }), /not on a triangle touching the first point/);
  assert.throws(() => cutTriangles(model, { geosetIndex: 0, start: 0, a: 1, b: 2, t: 1 }), /between the two ends/);
  assert.deepEqual(Array.from(model.Geosets[0].Faces), before);
});
