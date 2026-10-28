import test from 'node:test';
import assert from 'node:assert/strict';
import { findMotionPivots, pivotsAtFrame } from '../src/pivot-finder.js';

const key = (Frame, Vector) => ({ Frame, Vector });
const track = Keys => ({ Keys, LineType: 1 });
const near = (a, b, epsilon = 1e-4) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const tilt = (degrees) => { const half = degrees * Math.PI / 360; return [Math.sin(half), 0, 0, Math.cos(half)]; };

// A rider: Root -> Hips (sways) -> Chest (keyed but never changes); one vertex
// on the chest. A second sequence also bobs the Root.
function rider() {
  return {
    Sequences: [{ Name: 'Stand', Interval: [0, 1000] }, { Name: 'Walk', Interval: [2000, 3000] }],
    Bones: [
      { Name: 'Root', ObjectId: 0, PivotPoint: [0, 0, 0], Translation: track([key(2000, [0, 0, 0]), key(2500, [0, 0, 6]), key(3000, [0, 0, 0])]) },
      { Name: 'Hips', ObjectId: 1, Parent: 0, PivotPoint: [0, 0, 10], Rotation: track([key(0, tilt(0)), key(500, tilt(20)), key(1000, tilt(0)), key(2000, tilt(0)), key(2500, tilt(20)), key(3000, tilt(0))]) },
      { Name: 'Chest', ObjectId: 2, Parent: 1, PivotPoint: [0, 0, 20], Rotation: track([key(0, tilt(0)), key(1000, tilt(0)), key(2000, tilt(0)), key(3000, tilt(0))]) },
    ],
    Geosets: [{ Vertices: new Float32Array([0, 0, 25, 0, 0, 0]), VertexGroup: [0, 1], Groups: [[2], [0]] }],
  };
}

test('the bone the spot swings from is the pivot, at its own pivot point', () => {
  const model = rider(), result = findMotionPivots(model, 0, 0, 0);
  assert.deepEqual(result.pivots.map(p => p.name), ['Hips']);
  const placed = pivotsAtFrame(model, 0, result, 500);
  placed.pivots[0].world.forEach((value, i) => near(value, [0, 0, 10][i]));
  near(placed.spot[2], 10 + 15 * Math.cos(20 * Math.PI / 180));
  near(result.pivots[0].share, 1);
  assert.equal(result.trail.length, 49);
});

test('keys that never change are not a cause', () => {
  const model = rider(), result = findMotionPivots(model, 0, 0, 0);
  assert.ok(!result.pivots.some(p => p.name === 'Chest'));
  assert.equal(pivotsAtFrame(model, 0, result, 500).current, 24);
});

test('two movers are both found, strongest first', () => {
  const result = findMotionPivots(rider(), 1, 0, 0);
  assert.deepEqual(result.pivots.map(p => p.name).sort(), ['Hips', 'Root']);
  assert.ok(result.pivots[0].share >= result.pivots[1].share);
});

test('a spot that does not move has no pivots', () => {
  assert.deepEqual(findMotionPivots(rider(), 0, 0, 1).pivots, []);
});

test('no animation or a bad vertex gives nothing', () => {
  assert.equal(findMotionPivots(rider(), -1, 0, 0), null);
  assert.equal(findMotionPivots(rider(), 0, 0, 9), null);
});
