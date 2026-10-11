import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { samplePoseChain } from '../src/pose-ik.js';
import { preparePoseMotionStep, samplePoseMotionStep } from '../src/pose-motion-step.js';
import { stepFixture } from './fixtures/pose-motion-step.js';

const prepare = (fixture, options = {}) => preparePoseMotionStep({ model: fixture.model, sequence: 0, anchors: fixture.anchors, chains: fixture.config.chains.map(chain => ({ chain, poses: fixture.anchors.map(frame => samplePoseChain(fixture.model, chain, frame, 0)) })), ...options });
const settings = { index: 0, u: .5, timing: .8, follow: .8, body: .8, contacts: true };

test('sparse Step separates a return arch from a planted supporting foot', () => {
  const prepared = prepare(stepFixture()), result = samplePoseMotionStep(prepared, settings);
  assert.equal(prepared.available, true);
  const swing = result.feet.filter(foot => foot.swing), support = result.feet.filter(foot => foot.support);
  assert.equal(swing.length, 1); assert.equal(support.length, 1);
  assert.ok(swing[0].position.z - swing[0].soleOffset > 2);
  assert.ok(Math.abs(support[0].position.z - support[0].soleOffset) < 1e-8);
  assert.ok(result.displacement.z < -.1);
});

test('every selected pose stays exact, including elevated feet', () => {
  const prepared = prepare(stepFixture());
  for (const index of [0, 1]) for (const u of [0, 1]) {
    const result = samplePoseMotionStep(prepared, { ...settings, index, u });
    assert.deepEqual(result.displacement.toArray(), [0, 0, 0]);
    result.feet.forEach((foot, i) => {
      const original = prepared.legs[i].poses[index + u];
      assert.ok(foot.position.distanceTo(original.end) < 1e-9);
      assert.ok(new Quaternion().fromArray(foot.orientation).angleTo(original.rotations.at(-1)) < 1e-7);
    });
  }
});

test('ground height moves contacts but Contacts off retains return-foot lift', () => {
  const prepared = prepare(stepFixture(), { groundHeight: 3 });
  const result = samplePoseMotionStep(prepared, settings);
  const support = result.feet.find(foot => foot.support);
  assert.ok(Math.abs(support.position.z - support.soleOffset - 3) < 1e-8);
  const withoutContacts = samplePoseMotionStep(prepared, { ...settings, contacts: false });
  const unchanged = samplePoseMotionStep(prepared, { ...settings, contacts: false, follow: 0, body: 0 });
  const i = result.feet.findIndex(foot => foot.swing);
  assert.ok(withoutContacts.feet[i].position.z > unchanged.feet[i].position.z + 1);
  assert.ok(Math.abs(withoutContacts.feet[1 - i].position.z - unchanged.feet[1 - i].position.z) < 1e-8);
});

test('stride inference rotates with the skeleton instead of relying on a world axis', () => {
  const fixture = stepFixture(), first = prepare(fixture);
  const turn = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 1.2);
  fixture.model.Bones[0].Rotation = turn.toArray();
  const turned = prepare(fixture);
  assert.equal(turned.available, true);
  assert.ok(first.forward.clone().applyQuaternion(turn).distanceTo(turned.forward) < 1e-7);
});

test('four coherent mapped legs receive individual support and return targets', () => {
  const prepared = prepare(stepFixture({ legCount: 4 }));
  assert.equal(prepared.available, true);
  const result = samplePoseMotionStep(prepared, settings);
  assert.equal(result.feet.length, 4);
  assert.equal(result.feet.filter(foot => foot.support).length, 2);
  assert.equal(result.feet.filter(foot => foot.swing).length, 2);
});

test('detailed paths remain intact when lift and contacts are disabled', () => {
  const fixture = stepFixture({ dense: true }), prepared = prepare(fixture, { preservePath: true });
  const poses = new Map(fixture.config.chains.map(chain => [chain.key, samplePoseChain(fixture.model, chain, 183, 0)]));
  const result = samplePoseMotionStep(prepared, { index: 0, u: .366, follow: 0, body: 0, contacts: false, poses });
  result.feet.forEach(foot => assert.ok(foot.position.distanceTo(poses.get(foot.chain.key).end) < 1e-10));
  assert.throws(() => samplePoseMotionStep(prepared, { index: 0, u: .366 }), /current foot paths/);
});

test('missing geometry and absent strides return explicit reasons', () => {
  const absent = stepFixture(); absent.model.Geosets = [];
  assert.match(prepare(absent).reason, /geometry/);
  const held = stepFixture(); held.model.Bones.forEach(node => { if (node.Rotation) node.Rotation = [0, 0, 0, 1]; });
  assert.match(prepare(held).reason, /forward and backward stride/);
});

test('detailed gait phases do not require an invented forward direction', () => {
  const fixture = stepFixture({ legCount: 4, dense: true });
  const chains = fixture.config.chains.map(chain => ({ chain, poses: fixture.anchors.map(frame => samplePoseChain(fixture.model, chain, frame, 0)) }));
  // Opposed front/hind knee evidence is deliberately cancelled; detailed foot
  // paths still contain measured low and lifted phases.
  for (const item of chains) for (const pose of item.poses) pose.middle.copy(pose.root).lerp(pose.end, .5);
  const prepared = preparePoseMotionStep({ model: fixture.model, chains, anchors: fixture.anchors, sequence: 0, preservePath: true });
  assert.equal(prepared.available, true);
  assert.equal(prepared.directionSource, 'authored foot clearance');
  const poses = new Map(fixture.config.chains.map(chain => [chain.key, samplePoseChain(fixture.model, chain, 250, 0)]));
  const result = samplePoseMotionStep(prepared, { ...settings, poses });
  assert.equal(result.feet.length, 4);
  assert.ok(result.feet.every(foot => foot.position.toArray().every(Number.isFinite)));
});

test('detailed landing response stays continuous when support transfers or leaves the ground', () => {
  for (const legCount of [2, 4]) {
    const fixture = stepFixture({ legCount, dense: true });
    fixture.model.Bones[0].Translation = { LineType: 1, GlobalSeqId: null, Keys: [0, 250, 500, 750, 1000].map(Frame => ({ Frame, Vector: new Float32Array([0, 0, Frame % 500 ? 4 : 0]) })) };
    const prepared = prepare(fixture, { preservePath: true });
    let previous = 0, largest = 0;
    for (let frame = 0; frame <= 1000; frame++) {
      const index = frame < 500 ? 0 : 1, u = (frame - index * 500) / 500;
      const poses = new Map(fixture.config.chains.map(chain => [chain.key, samplePoseChain(fixture.model, chain, frame, 0)]));
      const result = samplePoseMotionStep(prepared, { ...settings, index, u, poses });
      largest = Math.max(largest, Math.abs(result.displacement.z - previous));
      previous = result.displacement.z;
    }
    assert.ok(largest < prepared.length * .001, `body target changes ${largest} units in one millisecond`);
  }
});
