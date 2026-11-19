// Transplant v2 item 4, the skin rules on hand-made inputs (no model files). Contract:
// docs/agent-tasks/xfer-transplant-v2-skin.md, section 5 (U1 to U7).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { nodeIndex } from '../src/node-hierarchy.js';
import { donorSkinCarriers, legTravelRatio, splitJoints, transplantRuns } from '../src/transplant-skin.js';

const v = (...xyz) => new Vector3(...xyz);
/** Donor chain a(1) > u(2) > q(3) with pivots at z 10, 4, 0 (path 6 + 4); own host h(11) > q'(12) on (0,0,0)..(0,0,10). */
function chain() {
  const donor = [{ ObjectId: 1, Parent: null }, { ObjectId: 2, Parent: 1 }, { ObjectId: 3, Parent: 2 }];
  const own = [{ ObjectId: 11, Parent: null }, { ObjectId: 12, Parent: 11 }];
  const pivotsA = { 1: v(0, 0, 10), 2: v(0, 0, 4), 3: v(0, 0, 0) }, pivotsB = { 11: v(0, 0, 0), 12: v(0, 0, 10) };
  return {
    donorPartJoints: new Set([1, 2, 3]), ownPartJoints: new Set([11, 12]), pairedOwn: new Map([[1, 11], [3, 12]]), isDonorJoint: () => true,
    treeA: nodeIndex({}, donor), treeB: nodeIndex({}, own), pA: id => pivotsA[id].clone(), pB: id => pivotsB[id].clone(),
  };
}

test('U1 a run: the donor joint the model lacks, its share of the donor path, the own host', () => {
  const runs = transplantRuns(chain());
  assert.equal(runs.length, 1);
  assert.deepEqual({ a: runs[0].a, q: runs[0].q, joints: runs[0].joints, seq: runs[0].seq, host: runs[0].host }, { a: 1, q: 3, joints: [2], seq: [1, 2], host: 11 });
  assert.deepEqual(runs[0].bounds.map(b => Math.round(b * 1000) / 1000), [0, 0.6, 1]);
});

test('U2 split along the run: before the plane the default joint, at it both, past it the run joint (band 0.4)', () => {
  const runs = transplantRuns(chain()), T = 'T';
  assert.deepEqual(splitJoints(v(0, 0, 2), T, runs), [T]);
  assert.deepEqual(splitJoints(v(0, 0, 5.9), T, runs), [T, 2]);
  assert.deepEqual(splitJoints(v(0, 0, 6.3), T, runs), [T, 2]);
  assert.deepEqual(splitJoints(v(0, 0, 9), T, runs), [2]);
});

test('U3 two runs from one host: a point past both planes takes the nearer line', () => {
  const up = { a: 1, q: 3, joints: [2], seq: [1, 2], bounds: [0, 0.5, 1], host: 11, start: v(0, 0, 0), end: v(0, 0, 10) };
  const side = { a: 1, q: 5, joints: [4], seq: [1, 4], bounds: [0, 0.5, 1], host: 11, start: v(0, 0, 0), end: v(10, 0, 0) };
  assert.deepEqual(splitJoints(v(1, 0, 8), 'T', [up, side]), [2]);
  assert.deepEqual(splitJoints(v(8, 0, 1), 'T', [up, side]), [4]);
});

test('U4 a point not past any plane keeps the default joint', () => {
  const runs = transplantRuns(chain());
  assert.deepEqual(splitJoints(v(0, 0, -3), 'T', runs), ['T']);
  assert.deepEqual(splitJoints(v(0, 0, 1), 'T', []), ['T']);
});

test('U5 carriers: one still skinned bone under a joint carries it; a keyed one does not; of two, the one with more vertices', () => {
  const donor = {
    Helpers: [{ ObjectId: 1, Parent: null }, { ObjectId: 2, Parent: null }, { ObjectId: 3, Parent: null }],
    Bones: [
      { ObjectId: 10, Parent: 1 },
      { ObjectId: 11, Parent: 2, Rotation: { Keys: [{ Frame: 0, Vector: [0, 0, 0, 1] }] } },
      { ObjectId: 12, Parent: 3 }, { ObjectId: 13, Parent: 3 },
    ],
  };
  const treeA = nodeIndex(donor, [...donor.Helpers, ...donor.Bones]);
  const carriers = donorSkinCarriers({ donor, donorPartJoints: new Set([1, 2, 3]), treeA, skinCount: new Map([[10, 5], [11, 5], [12, 3], [13, 7]]) });
  assert.equal(carriers.get(1), 10);
  assert.equal(carriers.get(2), 2);
  assert.equal(carriers.get(3), 13);
});

test('U6 travel ratio: the Kurgan\'s fitted stretches on the Tauren\'s left leg give 0.56; a leg with no drop gives the fallback', () => {
  const pivots = [v(1.5, 9.2, 68.7), v(6.1, 24.3, 42.3), v(-11.7, 19.3, 27.2), v(7.6, 25.7, 11.8)];
  const donor = pivots.slice(1).map((p, i) => p.clone().sub(pivots[i])), own = [20.2, 11.2, 11.8].map((length, i) => donor[i].clone().setLength(length));
  assert.ok(Math.abs(legTravelRatio([{ own, donor }], 0.82) - 0.56) < 0.01, `${legTravelRatio([{ own, donor }], 0.82)}`);
  assert.equal(legTravelRatio([{ own: [v(1, 0, 0)], donor: [v(5, 0, 0)] }], 0.82), 0.82);
  assert.equal(legTravelRatio([], 0.82), 0.82);
});

test('U7 band: false gives one joint at the plane', () => {
  const runs = transplantRuns(chain());
  assert.deepEqual(splitJoints(v(0, 0, 5.9), 'T', runs, { band: false }), ['T']);
  assert.deepEqual(splitJoints(v(0, 0, 6.1), 'T', runs, { band: false }), [2]);
});
