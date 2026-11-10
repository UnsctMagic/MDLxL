import test from 'node:test';
import assert from 'node:assert/strict';
import { poseGeometryEvidence } from '../src/pose-geometry.js';

const near = (actual, expected, tolerance = 1e-11) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const vectorNear = (actual, expected, tolerance) => actual.forEach((value, index) => near(value, expected[index], tolerance));
const triangle = (id = 1, vertices = [0, 0, 0, 1, 0, 0, 0, 1, 0]) => ({ Vertices: Float64Array.from(vertices), Faces: Uint16Array.from([0, 1, 2]), VertexGroup: Uint8Array.from([0, 0, 0]), Groups: [[id]] });
const model = geosets => ({ Bones: [{ ObjectId: 0, Name: 'opaque', Parent: null, PivotPoint: [0, 0, 0] }, { ObjectId: 1, Name: 'opaque', Parent: 0, PivotPoint: [0, 0, 0] }], Helpers: [], Geosets: geosets });

// Independent surface integrals, not expectations copied from the implementation.
test('triangle area, centroid and inertia are the uniform surface integrals', () => {
  const geometry = poseGeometryEvidence(model([triangle()])), shape = geometry.profiles.get(1);
  near(shape.area, .5); vectorNear(shape.center.toArray(), [1 / 3, 1 / 3, 0]);
  vectorNear(shape.covariance, [1 / 18, -1 / 36, 0, -1 / 36, 1 / 18, 0, 0, 0, 0]);
  vectorNear(shape.eigenvalues, [1 / 12, 1 / 36, 0]);
  vectorNear(geometry.subtree.get(0).center.toArray(), shape.center.toArray());
  vectorNear(geometry.measure([1, 1]).covariance, shape.covariance);
});

test('subdivision and node names do not alter a surface region', () => {
  const coarse = model([triangle()]), refined = model([{
    Vertices: Float64Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0, .5, 0, 0, .5, .5, 0, 0, .5, 0]),
    Faces: Uint16Array.from([0, 3, 5, 3, 1, 4, 5, 4, 2, 3, 4, 5]), VertexGroup: new Uint8Array(6), Groups: [[1]],
  }]);
  refined.Bones.reverse(); refined.Bones.forEach((node, index) => { node.Name = ['Hair_Weapon_Head', 'Hip_R'][index]; });
  const a = poseGeometryEvidence(coarse).profiles.get(1), b = poseGeometryEvidence(refined).profiles.get(1);
  near(a.area, b.area); vectorNear(a.center.toArray(), b.center.toArray()); vectorNear(a.covariance, b.covariance); vectorNear(a.eigenvalues, b.eigenvalues);
});

test('SD and HD weights contribute their measured shares of the same surface', () => {
  const sd = triangle(); sd.Groups = [[0, 1]];
  const hd = triangle(); hd.SkinWeights = Uint8Array.from(Array.from({ length: 3 }, () => [0, 1, 0, 0, 85, 170, 0, 0]).flat());
  for (const [geo, shares] of [[sd, [.5, .5]], [hd, [1 / 3, 2 / 3]]]) {
    const before = structuredClone(geo), geometry = poseGeometryEvidence(model([geo]));
    for (let id = 0; id < 2; id++) { const shape = geometry.profiles.get(id); near(shape.area, .5 * shares[id]); vectorNear(shape.center.toArray(), [1 / 3, 1 / 3, 0]); }
    near(geometry.measure([0, 1]).area, .5); assert.ok(geometry.surfaceLinks.get(0).get(1) > 0); assert.deepEqual(geo, before);
  }
  const variable = triangle(); variable.Groups = [[1], [0]]; variable.VertexGroup = Uint8Array.from([0, 1, 1]);
  const weighted = poseGeometryEvidence(model([variable])).profiles.get(1);
  near(weighted.area, 1 / 6); vectorNear(weighted.center.toArray(), [.25, .25, 0]); near(weighted.covariance[0], 3 / 80); near(weighted.covariance[1], -1 / 80);
});

test('a material seam retains surface continuity between separate geosets', () => {
  const first = triangle(0), second = triangle(1, [1, 0, 0, 1, 1, 0, 0, 1, 0]); first.MaterialID = 0; second.MaterialID = 1;
  const input = model([first, second]), before = structuredClone(input), geometry = poseGeometryEvidence(input);
  assert.ok(geometry.surfaceLinks.get(0).get(1) > 0); near(geometry.measure([0, 1]).area, 1);
  vectorNear(geometry.measure([0, 1]).center.toArray(), [.5, .5, 0]); assert.deepEqual(input, before);
});

test('large translations retain local shape instead of cancelling its covariance', () => {
  const local = triangle(), displacement = [1e9, -2e9, 3e9], shifted = triangle(1, Array.from(local.Vertices, (value, index) => value + displacement[index % 3]));
  const a = poseGeometryEvidence(model([local])).profiles.get(1), b = poseGeometryEvidence(model([shifted])).profiles.get(1);
  vectorNear(a.covariance, b.covariance); vectorNear(a.eigenvalues, b.eigenvalues);
  vectorNear(b.center.toArray(), a.center.toArray().map((value, axis) => value + displacement[axis]), 1e-7);
  const angle = Math.PI / 5, transformed = triangle(1, Array.from(local.Vertices).map((value, index, vertices) => index % 3 === 2 ? value : index % 3 === 0 ? value * Math.cos(angle) - vertices[index + 1] * Math.sin(angle) : vertices[index - 1] * Math.sin(angle) + value * Math.cos(angle)));
  vectorNear(poseGeometryEvidence(model([transformed])).profiles.get(1).eigenvalues, a.eigenvalues);
});

test('empty and degenerate surfaces return finite evidence without creating support', () => {
  const geometry = poseGeometryEvidence(model([]));
  for (const shape of [...geometry.profiles.values(), geometry.measure([])]) {
    assert.equal(shape.supported, false); assert.equal(shape.center, null); assert.equal(shape.min, null); assert.equal(shape.max, null);
    assert.ok([...shape.covariance, ...shape.eigenvalues, shape.area, shape.radius, shape.linear, shape.planar, shape.volumetric].every(Number.isFinite));
  }
  const line = triangle(1, [0, 0, 0, 1, 0, 0, 2, 0, 0]), before = structuredClone(line), shape = poseGeometryEvidence(model([line])).profiles.get(1);
  assert.equal(shape.area, 0); assert.equal(shape.pointWeight, 3); assert.equal(shape.supported, true);
  vectorNear(shape.center.toArray(), [1, 0, 0]); vectorNear(shape.eigenvalues, [2 / 3, 0, 0]); near(shape.linear, 1); assert.deepEqual(line, before);
});

test('point-only support is retained alongside meshed support in a combined region', () => {
  const input = model([triangle(0), { Vertices: Float64Array.from([5, 0, 0]), VertexGroup: Uint8Array.from([0]), Groups: [[1]], Faces: [] }]);
  const geometry = poseGeometryEvidence(input), point = geometry.profiles.get(1), joint = geometry.measure([0, 1]);
  assert.equal(point.area, 0); assert.ok(point.mass > 0); near(joint.area, .5); near(joint.mass, .5 + point.mass);
  near(joint.center.x, (.5 / 3 + point.mass * 5) / joint.mass); near(joint.center.y, (.5 / 3) / joint.mass);
});


test('local attachment surface clips area and interpolated skin weights, independent of subdivision or distant cloth', () => {
  const coarse = triangle(1,[0,0,0,2,0,0,0,2,0]); coarse.Groups=[[1],[0]]; coarse.VertexGroup=Uint8Array.from([0,1,1]);
  const refined = {Vertices:Float64Array.from([0,0,0,2,0,0,0,2,0,1,0,0,1,1,0,0,1,0]),Faces:Uint16Array.from([0,3,5,3,1,4,5,4,2,3,4,5]),VertexGroup:Uint8Array.from([0,1,1,2,1,2]),Groups:[[1],[0],[0,1]]};
  const cloth=triangle(1,[20,20,0,120,20,0,20,120,0]);
  for(const geosets of [[coarse],[refined],[coarse,cloth]]) {
    const before=structuredClone(geosets),shape=poseGeometryEvidence(model(geosets)).measureNear([1],[.5,.5,0],.5);
    near(shape.area,.5);vectorNear(shape.center.toArray(),[5/12,5/12,0]);
    vectorNear(shape.covariance,[11/144,-1/144,0,-1/144,11/144,0,0,0,0]);
    assert.deepEqual(geosets,before,'local measurement does not alter the model');
  }
});

test('local attachment measurements scale with the model and retain point-only evidence', () => {
  const source=triangle(),offset=[1e8,-2e8,3e8],scale=7;
  const shifted=triangle(1,Array.from(source.Vertices,(v,i)=>v*scale+offset[i%3]));
  const a=poseGeometryEvidence(model([source])).measureNear([1],[.25,.25,0],.25);
  const b=poseGeometryEvidence(model([shifted])).measureNear([1],offset.map((v,i)=>v+(i<2?.25:0)*scale),.25*scale);
  near(b.area,a.area*scale*scale);vectorNear(b.covariance,a.covariance.map(v=>v*scale*scale),1e-7);
  vectorNear(b.center.toArray(),a.center.toArray().map((v,i)=>v*scale+offset[i]),1e-7);
  const points={Vertices:Float64Array.from([0,0,0,10,0,0]),VertexGroup:[0,0],Groups:[[1]],Faces:[]};
  const evidence=poseGeometryEvidence(model([points])).measureNear([1],[0,0,0],1);
  near(evidence.pointWeight,1);near(evidence.mass,1);vectorNear(evidence.center.toArray(),[0,0,0]);
});
