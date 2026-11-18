import test from 'node:test';
import assert from 'node:assert/strict';
import { modelDigest, describeDigestChanges } from '../src/ai-model-digest.js';

const track = keys => ({ LineType: 1, Keys: keys.map(([Frame, Vector]) => ({ Frame, Vector: new Float32Array(Vector) })) });
const model = () => {
  const arm = { Name: 'Arm_L', ObjectId: 0, Parent: -1, PivotPoint: new Float32Array([0, 0, 50]), Rotation: track([[0, [0, 0, 0, 1]], [500, [0, 0.38, 0, 0.92]]]) };
  const hand = { Name: 'Hand_L', ObjectId: 1, Parent: 0, PivotPoint: new Float32Array([0, 20, 50]) };
  return {
    Geosets: [
      { Vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), Normals: new Float32Array(9), TVertices: [new Float32Array([0, 0, 1, 0, 0, 1])], Faces: new Uint16Array([0, 1, 2]), VertexGroup: new Uint8Array(3), Groups: [[0]], MaterialID: 0 },
      { Vertices: new Float32Array([5, 5, 5]), Normals: new Float32Array(3), TVertices: [new Float32Array(2)], Faces: new Uint16Array(0), VertexGroup: new Uint8Array(1), Groups: [[1]], MaterialID: 0 },
    ],
    GeosetAnims: [{ GeosetId: 1, Alpha: 1 }],
    Nodes: [arm, hand],
    Sequences: [{ Name: 'Attack', Interval: new Uint32Array([0, 1000]) }],
    Materials: [{ Layers: [{ TextureID: 0 }] }],
    Textures: [{ Image: 'Textures\\Footman.blp' }],
  };
};

test('an unchanged model has no hand edits, and editor bookkeeping is ignored', () => {
  const a = model(), b = model();
  b.Geosets[0]._MdxDefaults = { Color: 1 };
  assert.deepEqual(describeDigestChanges(modelDigest(a), modelDigest(b)), []);
  assert.deepEqual(describeDigestChanges(null, modelDigest(b)), [], 'no earlier delivery, nothing to report');
});

test('hand edits are named by the parts and data the owner sees', () => {
  const before = modelDigest(model());
  const edited = model();
  edited.Geosets[0].Vertices[3] = 2; // moved a vertex
  edited.Geosets[1].TVertices[0][0] = 0.5; // UV change on geoset 2
  edited.Nodes[0].Rotation.Keys[1].Vector[1] = 0.5; // turned the arm
  edited.Nodes[1].Parent = -1; // re-parented the hand
  edited.Sequences.push({ Name: 'Spell', Interval: new Uint32Array([1000, 2000]) });
  edited.GeosetAnims[0].Alpha = 0.5;
  const lines = describeDigestChanges(before, modelDigest(edited));
  assert.deepEqual(lines.sort(), [
    'animation Spell: added',
    'geoset 1: vertex positions',
    'geoset 2: UVs, colour or visibility',
    'node Arm_L: rotation keys',
    'node Hand_L: parent',
  ]);
});

test('the digest stays small and the list is capped', () => {
  const big = model();
  for (let i = 0; i < 40; i++) big.Nodes.push({ Name: 'Bone' + i, ObjectId: i + 2, Parent: 0, PivotPoint: new Float32Array(3) });
  const before = modelDigest(big);
  assert.ok(JSON.stringify(before).length / Object.keys(before).length < 50, 'about 50 characters per part');
  for (const node of big.Nodes) node.PivotPoint[0] += 1;
  const lines = describeDigestChanges(before, modelDigest(big));
  assert.equal(lines.length, 21);
  assert.equal(lines.at(-1), 'and 22 more parts');
});
