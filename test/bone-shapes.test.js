import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { boneShapePositions, boneShapeTails, chainHighlightColors, rigMarkerGeometry } from '../app/rig-markers-gl.js';

const bone = (ObjectId, Parent, world, extra = {}) => ({ visible: true, overlayKind: 'bones', node: { ObjectId, Parent }, world: new Vector3(...world), rotation: new Quaternion(), unitsPerPixel: .1, ...extra });

test('a double-clicked chain is highlighted and the rest stay normal markers', () => {
  const nodes = [bone(0, null, [0, 0, 0]), bone(1, 0, [0, 0, 10]), bone(2, 1, [0, 0, 20]), bone(3, 0, [5, 0, 0])];
  const colors = chainHighlightColors(nodes, [0, 1, 2], [1]);
  assert.deepEqual([...colors], [[0, '#ffff00'], [1, '#ff0000'], [2, '#ffff00'], [3, null]]);
});

test('each highlighted bone reaches from its pivot to its highlighted child, the last one gets a stub', () => {
  const nodes = [bone(0, null, [0, 0, 0]), bone(1, 0, [0, 0, 10]), bone(2, 1, [0, 0, 20]), bone(3, 0, [5, 0, 0])];
  const tails = boneShapeTails(nodes, chainHighlightColors(nodes, [0, 1, 2], []));
  assert.deepEqual([...tails.keys()], [0, 1, 2], 'bones outside the chain keep their squares');
  assert.equal(tails.get(0).childId, 1); assert.deepEqual(tails.get(0).tail.toArray(), [0, 0, 10]);
  assert.equal(tails.get(2).childId, null);
  assert.equal(boneShapeTails(nodes, chainHighlightColors(nodes, [0], [])).get(0).childId, 1, 'without a highlighted child it points at its own child');
  assert.deepEqual(tails.get(2).tail.toArray().map(v => Math.round(v * 1000) / 1000), [0, 0, 26], 'stub continues the parent direction');
});

test('the bone shape starts at the pivot, ends at the tail and turns with the bone', () => {
  const still = boneShapePositions(bone(0, null, [0, 0, 0]), new Vector3(0, 0, 10), .5);
  assert.deepEqual(still[0].toArray(), [0, 0, 0]); assert.deepEqual(still[1].toArray(), [0, 0, 10]);
  const rolled = boneShapePositions(bone(0, null, [0, 0, 0], { rotation: new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2) }), new Vector3(0, 0, 10), .5);
  assert.ok(rolled[2].distanceTo(still[2]) > .5, 'the light side moves when the bone rolls');
});

test('shaped bones draw eight faces with one light quarter', () => {
  const nodes = [bone(0, null, [0, 0, 0]), bone(1, 0, [0, 0, 10])], highlights = chainHighlightColors(nodes, [0, 1], []);
  const geometry = rigMarkerGeometry(nodes, [], { bones: false, focusedBoneMarkers: true, boneHighlights: highlights, boneShapeTails: boneShapeTails(nodes, highlights) });
  assert.equal(geometry.triangles.length, 2 * 8 * 3 * 6);
  const colors = new Set(); for (let i = 3; i < 8 * 3 * 6; i += 6) colors.add(geometry.triangles.slice(i, i + 3).join(','));
  assert.equal(colors.size, 2);
});
