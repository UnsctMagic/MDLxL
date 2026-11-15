import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { allNodes } from '../src/animation.js';
import { suggestPoseRig, poseRole, poseChainIds } from '../src/pose-ik.js';

// A Head attachment names its own neck's joint the head, even when another body
// in the same model (a rider) has a named head; it adds no second head to a neck
// that already has one on its own line.
const swing = angle => ({ LineType: 1, GlobalSeqId: null, Keys: [0, 50, 100].map((Frame, i) => ({ Frame, Vector: new Float32Array(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), i === 1 ? angle : 0).toArray()) })) });
function builder() {
  const bones = [], helpers = [], all = [], attachments = [];
  const add = (Name, Parent, PivotPoint, { helper = false } = {}) => {
    const node = { ObjectId: all.length, Name, Parent: Parent == null ? null : all.find(n => n.Name === Parent).ObjectId, PivotPoint, Flags: 256, Rotation: swing(.3) };
    all.push(node); (helper ? helpers : bones).push(node);
  };
  const attach = (Name, Parent, PivotPoint) => {
    const node = { ObjectId: 1000 + attachments.length, Name, Parent: all.find(n => n.Name === Parent).ObjectId, PivotPoint, Flags: 0 };
    attachments.push(node);
  };
  const model = () => ({ Bones: bones, Helpers: helpers, Attachments: attachments, PivotPoints: all.map(b => b.PivotPoint), GlobalSequences: [], Sequences: [{ Name: 'Stand', Interval: [0, 100], MoveSpeed: 0, NonLooping: false, Rarity: 0 }], Geosets: [] });
  return { add, attach, model };
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
const arms = b => { for (const [side, y] of [['R', -1], ['L', 1]]) { b.add(`Should_${side}`, 'Chest', [0, 10 * y, 85]); b.add(`Elbow_${side}`, `Should_${side}`, [0, 20 * y, 75]); b.add(`Wrist_${side}`, `Elbow_${side}`, [4, 28 * y, 66]); } };
const legs = (b, parent, z = 56) => { for (const [side, y] of [['R', -1], ['L', 1]]) { b.add(`Leg1_${side}`, parent, [0, 6 * y, z]); b.add(`Leg2_${side}`, `Leg1_${side}`, [3, 7 * y, z - 8]); b.add(`Foot_${side}`, `Leg2_${side}`, [0, 7 * y, z - 16]); } };
const body = headName => {
  const b = builder();
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Chest', 'Root', [0, 0, 80]); b.add('Neck', 'Chest', [0, 0, 90]);
  if (headName) b.add(headName, 'Neck', [0, 0, 95]);
  arms(b);
  b.add('Pelvis', 'Root', [0, 0, 58]);
  legs(b, 'Pelvis');
  return b;
};

// (a) generically named mount carrying a rider with a named head.
function mountWithRider() {
  const b = builder();
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Object01', 'Root', [0, 0, 80]);
  for (const [side, y] of [['R', -1], ['L', 1]]) { b.add(`Limb1_${side}`, 'Object01', [0, 12 * y, 78]); b.add(`Limb2_${side}`, `Limb1_${side}`, [4, 24 * y, 70]); b.add(`Limb3_${side}`, `Limb2_${side}`, [8, 36 * y, 60]); }
  b.add('Object18', 'Object01', [20, 0, 90]); b.add('Object17', 'Object18', [35, 0, 100]); b.add('Object12', 'Object17', [50, 0, 108]);
  b.attach('Head Ref', 'Object12', [52, 0, 110]);
  b.add('G_SaddleBase', 'Root', [0, 0, 95]); b.add('Rider_Chest', 'G_SaddleBase', [0, 0, 110]); b.add('Rider_Neck', 'Rider_Chest', [0, 0, 120]); b.add('Rider_Head', 'Rider_Neck', [0, 0, 125]);
  for (const [side, y] of [['R', -1], ['L', 1]]) { b.add(`Rider_Should_${side}`, 'Rider_Chest', [0, 10 * y, 115]); b.add(`Rider_Elbow_${side}`, `Rider_Should_${side}`, [0, 20 * y, 105]); b.add(`Rider_Wrist_${side}`, `Rider_Elbow_${side}`, [4, 28 * y, 96]); }
  for (const [side, y] of [['R', -1], ['L', 1]]) { b.add(`Rider_Leg1_${side}`, 'G_SaddleBase', [0, 6 * y, 90]); b.add(`Rider_Leg2_${side}`, `Rider_Leg1_${side}`, [3, 7 * y, 82]); b.add(`Rider_Foot_${side}`, `Rider_Leg2_${side}`, [0, 7 * y, 74]); }
  return b.model();
}
// (b) Head Ref on a sibling helper joint under the same neck as the named head.
const siblingRef = () => { const b = body('Head'); b.add('Helper_Top', 'Neck', [0, 0, 96]); b.attach('Head Ref', 'Helper_Top', [0, 0, 97]); return b.model(); };
// (c) Head Ref on the neck joint above the named head.
const neckRef = () => { const b = body('Head'); b.attach('Head Ref', 'Neck', [0, 0, 92]); return b.model(); };
// (d) Head Ref on an unnamed child of the named head.
const childRef = () => { const b = body('Head'); b.add('Joint33', 'Head', [0, 0, 97]); b.attach('Head Ref', 'Joint33', [0, 0, 98]); return b.model(); };

// (e) a rider with a named chest carries a named head and a sibling collar chain with a second head attachment.
const collarRef = () => {
  const b = builder();
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Rider_Chest', 'Root', [0, 0, 80]); b.add('Rider_Head', 'Rider_Chest', [0, 0, 95]);
  b.add('Collar_1', 'Rider_Chest', [0, 5, 88]); b.add('Collar_2', 'Collar_1', [0, 6, 92]);
  b.attach('Head Ref', 'Collar_2', [0, 6, 94]);
  for (const [side, y] of [['R', -1], ['L', 1]]) { b.add(`Should_${side}`, 'Rider_Chest', [0, 10 * y, 85]); b.add(`Elbow_${side}`, `Should_${side}`, [0, 20 * y, 75]); b.add(`Wrist_${side}`, `Elbow_${side}`, [4, 28 * y, 66]); }
  b.add('Pelvis', 'Root', [0, 0, 58]); legs(b, 'Pelvis');
  return b.model();
};
// (f) no named trunk part at all: a named head and a head attachment on another unnamed branch.
const noTrunkRef = () => {
  const b = builder();
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Joint01', 'Root', [0, 0, 80]); b.add('Head', 'Joint01', [0, 0, 95]);
  b.add('Joint02', 'Root', [10, 0, 80]); b.add('Joint03', 'Joint02', [10, 0, 90]);
  b.attach('Head Ref', 'Joint03', [10, 0, 92]);
  return b.model();
};
if (process.env.RECORD) { for (const [k, f] of Object.entries({ mountWithRider, siblingRef, neckRef, childRef, collarRef, noTrunkRef })) console.log(k, JSON.stringify(summary(f()))); }

const heads = result => result.nodes.filter(n => n.endsWith('=Head'));

test('a mount keeps its head clue although a rider in the same model has a named head', () => {
  const result = summary(mountWithRider());
  assert.deepEqual(heads(result), ['Object12=Head', 'Rider_Head=Head']);
});

// Exact rigs recorded from the code before this rule changed.
const BASE_SIBLING = {"chains":["arm:Should_L>Elbow_L>Wrist_L","arm:Should_R>Elbow_R>Wrist_R","leg:Leg1_L>Leg2_L>Foot_L","leg:Leg1_R>Leg2_R>Foot_R"],"nodes":["Chest=Chest","Head=Head","Neck=Neck","Pelvis=Pelvis"],"body":"Root","roles":{"Root":"Body","Chest":"Chest"}};
const BASE_CHILD = {"chains":["arm:Should_L>Elbow_L>Wrist_L","arm:Should_R>Elbow_R>Wrist_R","leg:Leg1_L>Leg2_L>Foot_L","leg:Leg1_R>Leg2_R>Foot_R"],"nodes":["Chest=Chest","Head=Head","Neck=Neck","Pelvis=Pelvis"],"body":"Root","roles":{"Root":"Body","Chest":"Chest"}};

const EXPECTED_NECK = {"chains":["arm:Should_L>Elbow_L>Wrist_L","arm:Should_R>Elbow_R>Wrist_R","leg:Leg1_L>Leg2_L>Foot_L","leg:Leg1_R>Leg2_R>Foot_R"],"nodes":["Chest=Chest","Head=Head","Neck=Neck","Pelvis=Pelvis"],"body":"Root","roles":{"Root":"Body","Chest":"Chest"}};
test('a Head Ref on a sibling helper under the same neck adds no second head', () => {
  const result = summary(siblingRef());
  assert.deepEqual(heads(result), ['Head=Head']);
  assert.deepEqual(result, BASE_SIBLING);
});
test('a Head Ref on the neck above the named head adds no second head', () => {
  const result = summary(neckRef());
  assert.deepEqual(heads(result), ['Head=Head']);
  assert.deepEqual(result, EXPECTED_NECK);
});
test('a Head Ref on an unnamed child of the named head adds no second head', () => {
  const result = summary(childRef());
  assert.deepEqual(heads(result), ['Head=Head']);
  assert.deepEqual(result, BASE_CHILD);
});
const BASE_COLLAR = {"chains":["arm:Should_L>Elbow_L>Wrist_L","arm:Should_R>Elbow_R>Wrist_R","leg:Leg1_L>Leg2_L>Foot_L","leg:Leg1_R>Leg2_R>Foot_R"],"nodes":["Pelvis=Pelvis","Rider_Chest=Chest","Rider_Head=Head"],"body":"Root","roles":{"Root":"Body","Rider_Chest":"Chest"}};
const BASE_NOTRUNK = {"chains":[],"nodes":["Head=Head","Joint01=Neck"],"body":"Root","roles":{"Joint01":"Neck"}};
test('a second head attachment on a chain under the same named chest adds no second head', () => {
  const result = summary(collarRef());
  assert.deepEqual(result.nodes.filter(n => n.endsWith('=Head')), ['Rider_Head=Head']);
  assert.deepEqual(result, BASE_COLLAR);
});
test('a body without named trunk parts keeps its old head result', () => {
  assert.deepEqual(summary(noTrunkRef()), BASE_NOTRUNK);
});
