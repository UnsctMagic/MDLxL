import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { allNodes } from '../src/animation.js';
import { suggestPoseRig, poseRole, poseChainIds } from '../src/pose-ik.js';

// A name is a strong clue, never a veto: a mirrored pair that carries limbs is
// no central pelvis, and a trunk part under a head is no trunk part.
const swing = angle => ({ LineType: 1, GlobalSeqId: null, Keys: [0, 50, 100].map((Frame, i) => ({ Frame, Vector: new Float32Array(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), i === 1 ? angle : 0).toArray()) })) });
function builder() {
  const bones = [], helpers = [], all = [];
  const add = (Name, Parent, PivotPoint, { helper = false, moving = true } = {}) => {
    const node = { ObjectId: all.length, Name, Parent: Parent == null ? null : all.find(n => n.Name === Parent).ObjectId, PivotPoint, Flags: 256, ...(moving ? { Rotation: swing(.3) } : {}) };
    all.push(node); (helper ? helpers : bones).push(node);
  };
  const model = () => ({ Bones: bones, Helpers: helpers, Attachments: [], PivotPoints: all.map(b => b.PivotPoint), GlobalSequences: [], Sequences: [{ Name: 'Stand', Interval: [0, 100], MoveSpeed: 0, NonLooping: false, Rarity: 0 }], Geosets: [] });
  return { add, model };
}
const summary = model => {
  const rig = suggestPoseRig(model, 0, 0), nodes = allNodes(model), name = id => nodes.find(n => n.ObjectId === id).Name;
  return {
    chains: rig.chains.map(c => `${c.kind}:${poseChainIds(c).map(name).join('>')}`).sort(),
    nodes: rig.nodes.map(id => `${name(id)}=${poseRole(model, rig, id, nodes)}`).sort(),
    body: rig.body == null ? null : name(rig.body),
    roles: Object.fromEntries(Object.entries(rig.roles).map(([id, role]) => [name(Number(id)), role]))
  };
};
// Arms hang from the chest; the legs hang from a waist through two mirrored
// "Hip" bones that a name reads as a pelvis.
function vampire() {
  const b = builder();
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Chest', 'Root', [0, 0, 80]); b.add('Neck', 'Chest', [0, 0, 90]); b.add('Head', 'Neck', [0, 0, 95]); b.add('Hair_Rear_Root', 'Head', [-4, 0, 97]);
  b.add('Waist', 'Root', [0, 0, 58]);
  for (const [side, y] of [['R', -1], ['L', 1]]) {
    b.add(`Should_${side}`, 'Chest', [0, 10 * y, 85]); b.add(`Elbow_${side}`, `Should_${side}`, [0, 20 * y, 75]); b.add(`Wrist_${side}`, `Elbow_${side}`, [4, 28 * y, 66]);
    b.add(`Hip_${side}`, 'Waist', [0, 6 * y, 56]); b.add(`Knee_${side}`, `Hip_${side}`, [3, 7 * y, 48]); b.add(`Ankle_${side}`, `Knee_${side}`, [0, 7 * y, 40]);
  }
  return b.model();
}

test('mirrored Hip bones under a waist are legs; the waist is the pelvis, hair under the head is no body', () => {
  const model = vampire(), result = summary(model);
  assert.deepEqual(result.chains.filter(c => c.startsWith('arm')), ['arm:Should_L>Elbow_L>Wrist_L', 'arm:Should_R>Elbow_R>Wrist_R']);
  assert.deepEqual(result.chains.filter(c => c.startsWith('leg')), ['leg:Hip_L>Knee_L>Ankle_L', 'leg:Hip_R>Knee_R>Ankle_R'], 'both legs');
  assert.ok(result.nodes.includes('Waist=Pelvis'), 'the waist is the pelvis handle');
  assert.ok(!result.nodes.some(n => /^Hip_/.test(n)), 'the thighs are no part handles');
  assert.ok(!result.nodes.some(n => /^Hair_Rear_Root=/.test(n)), 'hair under the head has no handle');
  assert.notEqual(poseRole(model, suggestPoseRig(model, 0, 0), model.Helpers.concat(model.Bones).find(n => n.Name === 'Hair_Rear_Root').ObjectId, allNodes(model)), 'Body');
  assert.equal(result.body, 'Root');
});

// The same name on a single central bone keeps its meaning.
function central() {
  const b = builder();
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Chest', 'Root', [0, 0, 80]); b.add('Neck', 'Chest', [0, 0, 90]); b.add('Head', 'Neck', [0, 0, 95]);
  b.add('Pelvis', 'Root', [0, 0, 58]);
  for (const [side, y] of [['R', -1], ['L', 1]]) {
    b.add(`Should_${side}`, 'Chest', [0, 10 * y, 85]); b.add(`Elbow_${side}`, `Should_${side}`, [0, 20 * y, 75]); b.add(`Wrist_${side}`, `Elbow_${side}`, [4, 28 * y, 66]);
    b.add(`Leg1_${side}`, 'Pelvis', [0, 6 * y, 56]); b.add(`Leg2_${side}`, `Leg1_${side}`, [3, 7 * y, 48]); b.add(`Foot_${side}`, `Leg2_${side}`, [0, 7 * y, 40]);
  }
  return b.model();
}
test('a single central Pelvis bone keeps today\'s behaviour', () => {
  assert.deepEqual(summary(central()), BASELINE_CENTRAL);
});

// Two Pelvis-named siblings that are not mirrored, or carry no limb.
function unmirrored() {
  const b = builder();
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Chest', 'Root', [0, 0, 80]); b.add('Neck', 'Chest', [0, 0, 90]); b.add('Head', 'Neck', [0, 0, 95]);
  b.add('Waist', 'Root', [0, 0, 58]);
  for (const [side, y] of [['R', -1], ['L', 1]]) {
    b.add(`Should_${side}`, 'Chest', [0, 10 * y, 85]); b.add(`Elbow_${side}`, `Should_${side}`, [0, 20 * y, 75]); b.add(`Wrist_${side}`, `Elbow_${side}`, [4, 28 * y, 66]);
  }
  // Same side of the waist, so not mirrored.
  b.add('Hip_A', 'Waist', [0, 6, 56]); b.add('Knee_A', 'Hip_A', [3, 7, 48]); b.add('Ankle_A', 'Knee_A', [0, 7, 40]);
  b.add('Hip_B', 'Waist', [0, 9, 56]); b.add('Knee_B', 'Hip_B', [3, 10, 48]); b.add('Ankle_B', 'Knee_B', [0, 10, 40]);
  return b.model();
}
function limbless() {
  const b = builder();
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Chest', 'Root', [0, 0, 80]); b.add('Neck', 'Chest', [0, 0, 90]); b.add('Head', 'Neck', [0, 0, 95]);
  b.add('Waist', 'Root', [0, 0, 58]);
  for (const [side, y] of [['R', -1], ['L', 1]]) {
    b.add(`Should_${side}`, 'Chest', [0, 10 * y, 85]); b.add(`Elbow_${side}`, `Should_${side}`, [0, 20 * y, 75]); b.add(`Wrist_${side}`, `Elbow_${side}`, [4, 28 * y, 66]);
    b.add(`Hip_${side}`, 'Waist', [0, 6 * y, 56]); b.add(`Skirt_${side}`, `Hip_${side}`, [3, 7 * y, 48]);
  }
  return b.model();
}
test('same-named siblings that are not mirrored are untouched', () => {
  assert.deepEqual(summary(unmirrored()), BASELINE_UNMIRRORED);
});
test('same-named mirrored siblings without a limb are untouched', () => {
  assert.deepEqual(summary(limbless()), BASELINE_LIMBLESS);
});

// Exact rigs recorded from the code before the name-conflict rule existed.
const BASELINE_CENTRAL = {"chains":["arm:Should_L>Elbow_L>Wrist_L","arm:Should_R>Elbow_R>Wrist_R","leg:Leg1_L>Leg2_L>Foot_L","leg:Leg1_R>Leg2_R>Foot_R"],"nodes":["Chest=Chest","Head=Head","Neck=Neck","Pelvis=Pelvis"],"body":"Root","roles":{"Root":"Body","Chest":"Chest"}};
const BASELINE_UNMIRRORED = {"chains":["arm:Should_L>Elbow_L>Wrist_L","arm:Should_R>Elbow_R>Wrist_R"],"nodes":["Chest=Chest","Head=Head","Hip_A=Pelvis","Hip_B=Pelvis","Neck=Neck"],"body":"Root","roles":{"Root":"Body","Chest":"Chest"}};
const BASELINE_LIMBLESS = {"chains":["arm:Should_L>Elbow_L>Wrist_L","arm:Should_R>Elbow_R>Wrist_R"],"nodes":["Chest=Chest","Head=Head","Hip_L=Pelvis","Hip_R=Pelvis","Neck=Neck"],"body":"Root","roles":{"Root":"Body","Chest":"Chest"}};
