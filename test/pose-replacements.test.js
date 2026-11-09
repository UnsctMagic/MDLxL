import test from 'node:test';
import assert from 'node:assert/strict';
import { poseGeometryEvidence } from '../src/pose-geometry.js';
import { inferPoseReplacements } from '../src/pose-heads.js';

function fixture(swapped = true) {
  const model = { Bones: [], Helpers: [], Geosets: [], GeosetAnims: [], GlobalSequences: [], Sequences: [{ Name: 'a', Interval: [0, 10] }, { Name: 'b', Interval: [20, 30] }] };
  for (let id = 0; id < 3; id++) {
    model.Bones.push({ ObjectId: id, Parent: null, Name: 'unrelated_' + id, PivotPoint: [id * 20, 0, 0] });
    const tetra = [[0, 0, 0], [3, 0, 0], [0, 4, 0], [0, 0, 5]].flatMap(point => [point[0] + id * 20, point[1], point[2]]);
    model.Geosets.push({ Vertices: Float32Array.from(tetra), Faces: Uint16Array.from([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]), Groups: [[id]], VertexGroup: new Uint8Array(4) });
    const values = !swapped || id === 2 ? [1, 1] : id === 0 ? [1, 0] : [0, 1];
    model.GeosetAnims.push({ GeosetId: id, Alpha: { LineType: 0, Keys: [0, 10, 20, 30].map((Frame, index) => ({ Frame, Vector: [values[index < 2 ? 0 : 1]] })) } });
  }
  return model;
}

test('opposite visibility plus surface correspondence finds the replacement and rejects an identical always-visible prop', () => {
  const model = fixture(), before = structuredClone(model);
  const result = inferPoseReplacements(model, { geometry: poseGeometryEvidence(model), roles: { 0: 'Head' } });
  assert.deepEqual(result.map(pair => [pair.source, pair.target]), [[0, 1]]);
  assert.equal(result[0].evidence.swapped, 1);
  assert.ok(result[0].evidence.surfaceDistance < 1e-12);
  assert.deepEqual(model, before);
});

test('visibility and spelling cannot invent a source anatomical role', () => {
  const model = fixture();
  model.Bones.forEach(node => { node.Name = 'Head'; });
  assert.deepEqual(inferPoseReplacements(model, { geometry: poseGeometryEvidence(model), roles: {} }), []);
  const visible = fixture(false);
  assert.deepEqual(inferPoseReplacements(visible, { geometry: poseGeometryEvidence(visible), roles: { 0: 'Head' } }), []);
});
