import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticalRig, challengeNames } from './helpers/pose-anatomy-fixtures.mjs';
import { analyzePoseAnatomy } from '../src/pose-anatomy.js';
import { poseNodeRole, poseChainBetween, samplePoseChain, solvePoseLimb, suggestPoseRig } from '../src/pose-ik.js';
import { applyMovementPose } from '../src/movement.js';

// Additional adversarial evidence checks are reported separately from the 155
// fixture/name variants. Every expected head is authored in the analytical rig;
// the recognizer is never given that expectation.
function recognizedHeads(model) {
  const before = structuredClone(model);
  const anatomy = analyzePoseAnatomy(model, { nameRole: poseNodeRole });
  assert.deepEqual(model, before, 'Analysis preserves every authored field');
  return anatomy.nodes.filter(id => anatomy.roles[id] === 'Head').sort((a, b) => a - b);
}

test('partial skin cannot veto a head supported by the same anonymous skeleton', () => {
  const skeleton = challengeNames(analyticalRig({ animated: false }).model, 'anonymous');
  skeleton.Geosets = [];
  assert.deepEqual(recognizedHeads(skeleton), [4], 'Unskinned skeleton has one authored head');
  const partial = structuredClone(skeleton);
  // Add only the closed torso surface, bound to the root. No head, neck, joint
  // positions, hierarchy, names or animation change.
  partial.Geosets = analyticalRig({ animated: false }).model.Geosets.slice(0, 1)
    .map(geoset => ({ ...geoset, Groups: [[0]] }));
  assert.deepEqual(recognizedHeads(partial), [4], 'Adding torso skin must retain the skeletal head');
});

test('a remote locator cannot let a misleading name remove a geometrically supported head', () => {
  const base = analyticalRig({ heads: 3, animated: false }).model;
  const locator = { ObjectId: 100, Name: 'RemoteLocator', Parent: null, PivotPoint: Float32Array.from([100000, 0, 0]) };
  base.Helpers.push(locator);
  base.PivotPoints[locator.ObjectId] = locator.PivotPoint;
  assert.deepEqual(recognizedHeads(base), [4, 6, 8], 'All three independently skinned heads are recognized');
  for (const label of ['', 'Foot']) {
    const model = structuredClone(base);
    model.Bones.find(node => node.ObjectId === 4).Name = label;
    assert.deepEqual(recognizedHeads(model), [4, 6, 8], 'Changing only a supported head label retains every head');
  }
});


test('a skinned torso neck and head do not require a limb peer to recognize the head', () => {
  const model = challengeNames(analyticalRig({ animated: false }).model, 'anonymous');
  model.Bones = model.Bones.filter(node => node.ObjectId <= 4);
  model.PivotPoints = model.PivotPoints.slice(0, 5);
  model.Geosets = model.Geosets.slice(0, 4);
  delete model.Nodes;
  assert.deepEqual(recognizedHeads(model), [4], 'A fully skinned limbless body still has its authored head');
});


test('an identity helper at a coincident pivot does not hide its anatomical descendants', () => {
  const model = challengeNames(analyticalRig({ animated: false }).model, 'anonymous');
  const upper = model.Bones.find(node => node.ObjectId === 5);
  const elbow = model.Bones.find(node => node.ObjectId === 6);
  const helper = { ObjectId: 100, Name: '', Parent: 5, PivotPoint: upper.PivotPoint.slice() };
  model.Helpers.push(helper);
  model.PivotPoints[100] = helper.PivotPoint;
  elbow.Parent = 100;
  delete model.Nodes;
  const before = structuredClone(model);
  // Existing POSE API already supports excluding this unused bend while its
  // native parent transform remains in the model and continues to inherit.
  const explicit = poseChainBetween(model, 5, 7, [100]);
  assert.deepEqual(explicit.joints, [5, 6, 7]);
  const start = samplePoseChain(model, explicit, 0, 0), target = start.end.clone();
  target.x += 1; target.z += 2;
  const result = solvePoseLimb(model, explicit, 0, 0, target);
  assert.deepEqual(model, before, 'Preview solver changes no hierarchy, skin or keys');
  assert.ok(result.changes.every(change => change.id !== 100), 'Identity helper needs no authored keys');
  const preview = structuredClone(model);
  applyMovementPose(preview, result.changes, 0, 0);
  assert.ok(samplePoseChain(preview, explicit, 0, 0).end.distanceTo(target) < 1e-4, 'Existing solver reaches target through the native helper');
  const anatomy = analyzePoseAnatomy(model, { nameRole: poseNodeRole });
  assert.ok(anatomy.chains.some(chain => chain.kind === 'arm' && chain.ids[0] === 5 && chain.ids.at(-1) === 7), 'Anatomical traversal reaches the wrist below the identity helper');
  assert.deepEqual(anatomy.chains.map(chain => chain.ids.at(-1)).sort((a,b) => a-b), [7, 10, 13, 16], 'Both arms and legs remain recognized');
  const rig = suggestPoseRig(model, 0, 0), inferred = rig.chains.find(chain => chain.end === 7);
  assert.ok(inferred, 'Automatic setup retains the executable wrist handle');
  assert.doesNotThrow(() => samplePoseChain(model, inferred, 0, 0), 'Automatic setup uses the existing nonzero bend API');
  assert.deepEqual(model, before, 'Automatic setup preserves the native helper and all model data');
});
