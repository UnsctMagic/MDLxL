import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { poseLimbRootEvidence } from '../src/pose-limb-roots.js';

test('root evidence is unchanged by coordinate rotation, translation or uniform scale', () => {
  const positions = [[0,0,0],[0,2,1],[0,4,1],[0,5,-2],[1,5,-6]].map(p=>new Vector3(...p));
  const context = points => ({origin:0,pivot:id=>points[id],jointSurface:()=>null});
  const before = poseLimbRootEvidence([1,2,3,4],context(positions));
  const axis = new Vector3(2,3,4).normalize();
  const moved = positions.map(p=>p.clone().applyAxisAngle(axis,.82).multiplyScalar(83).add(new Vector3(100,-300,71)));
  const after = poseLimbRootEvidence([1,2,3,4],context(moved));
  assert.deepEqual(after.map(row=>row.id),before.map(row=>row.id));
  after.forEach((row,i)=>assert.ok(Math.abs(row.score-before[i].score)<1e-12));
});
