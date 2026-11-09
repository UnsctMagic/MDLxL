import test from 'node:test';
import assert from 'node:assert/strict';
import { poseAssemblyEvidence } from '../src/pose-assemblies.js';

const simple = points => ({
  Bones: points.map(([Parent, ...PivotPoint], ObjectId) => ({ ObjectId, Name: 'item', Parent, PivotPoint, Flags: 256 })),
  Helpers: [], Geosets: [], Sequences: [], GlobalSequences: [], PivotPoints: points.map(([, ...point]) => point),
});

test('two nearby independent bodies on the same ground do not become a rider and carrier', () => {
  const model = simple([[null,0,0,40],[0,0,0,0],[null,5,0,42],[2,5,0,0]]);
  const actors = [
    { body: 0, limbs: [{kind:'leg', ids:[0,1]}], span:80 },
    { body: 2, limbs: [{kind:'leg', ids:[2,3]}], span:84 },
  ];
  const result = poseAssemblyEvidence(model, actors);
  assert.deepEqual(result.carriers, {});
  assert.deepEqual(result.followers, {});
});

test('a coincident native driver carries only the elevated independent assembly', () => {
  const model = simple([[null,0,0,30],[0,0,0,0],[null,0,0,30],[2,0,0,60],[3,0,0,45]]);
  const actors = [
    { body:0, limbs:[{kind:'leg',ids:[0,1]}], span:100 },
    { body:3, limbs:[{kind:'leg',ids:[3,4]}], span:50 },
  ];
  const result = poseAssemblyEvidence(model, actors);
  assert.deepEqual(result.followers, {0:[2]});
  assert.deepEqual(result.carriers, {});
  assert.deepEqual(poseAssemblyEvidence(model, [...actors].reverse()).followers, result.followers);
});
