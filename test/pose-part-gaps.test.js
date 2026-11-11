import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { allNodes } from '../src/animation.js';
import { suggestPoseRig, poseRole, poseChainIds } from '../src/pose-ik.js';

// Clues add, none removes: a pelvis is where two legs join, a neck is a moving
// joint between a head and the trunk, even when no name says so.
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
const arms = b => { for (const [side, y] of [['R', -1], ['L', 1]]) { b.add(`Should_${side}`, 'Chest', [0, 10 * y, 85]); b.add(`Elbow_${side}`, `Should_${side}`, [0, 20 * y, 75]); b.add(`Wrist_${side}`, `Elbow_${side}`, [4, 28 * y, 66]); } };
const legs = (b, parent, z = 56) => { for (const [side, y] of [['R', -1], ['L', 1]]) { b.add(`Leg1_${side}`, parent, [0, 6 * y, z]); b.add(`Leg2_${side}`, `Leg1_${side}`, [3, 7 * y, z - 8]); b.add(`Foot_${side}`, `Leg2_${side}`, [0, 7 * y, z - 16]); } };

// (a) the legs hang from an unnamed joint under the body.
function unnamedWaist(parent = 'Root') {
  const b = builder();
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Chest', 'Root', [0, 0, 80]); b.add('Neck', 'Chest', [0, 0, 90]); b.add('Head', 'Neck', [0, 0, 95]);
  arms(b);
  if (parent !== 'Root') b.add(parent, 'Root', [0, 0, 59]);
  b.add('Joint07', parent, [0, 0, 58]);
  legs(b, 'Joint07');
  return b.model();
}
// (c) four legs: rear and front junctions are unnamed, the head lies beyond the front one.
function fourLegged() {
  const b = builder();
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Joint_Rear', 'Root', [-20, 0, 58]); b.add('Joint_Front', 'Root', [20, 0, 60]);
  for (const [tag, parent, x] of [['B', 'Joint_Rear', -20], ['F', 'Joint_Front', 20]]) for (const [side, y] of [['R', -1], ['L', 1]]) {
    b.add(`Leg1_${tag}${side}`, parent, [x, 6 * y, 56]); b.add(`Leg2_${tag}${side}`, `Leg1_${tag}${side}`, [x + 3, 7 * y, 48]); b.add(`Foot_${tag}${side}`, `Leg2_${tag}${side}`, [x, 7 * y, 40]);
  }
  b.add('Head', 'Joint_Front', [35, 0, 70]);
  return b.model();
}
// (d) an unnamed joint between the chest and the head.
function unnamedNeck(moving) {
  const b = builder();
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Chest', 'Root', [0, 0, 80]); b.add('Joint09', 'Chest', [0, 0, 90], { moving }); b.add('Head', 'Joint09', [0, 0, 95]);
  arms(b);
  b.add('Pelvis', 'Root', [0, 0, 58]);
  legs(b, 'Pelvis');
  return b.model();
}
// (f) a head piece nested below the head, with an unnamed moving joint between them.
function headPiece() {
  const b = builder();
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Chest', 'Root', [0, 0, 80]); b.add('Neck', 'Chest', [0, 0, 90]); b.add('Head', 'Neck', [0, 0, 95]);
  b.add('Joint11', 'Head', [0, 0, 97]); b.add('Head_Piece', 'Joint11', [0, 0, 99]);
  arms(b);
  b.add('Pelvis', 'Root', [0, 0, 58]);
  legs(b, 'Pelvis');
  return b.model();
}
// (g) centaur: the front junction also carries a chest with arms and a head.
function centaur() {
  const b = builder();
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Joint_Rear', 'Root', [-20, 0, 58]); b.add('Joint_Front', 'Root', [20, 0, 60]);
  for (const [tag, parent, x] of [['B', 'Joint_Rear', -20], ['F', 'Joint_Front', 20]]) for (const [side, y] of [['R', -1], ['L', 1]]) {
    b.add(`Leg1_${tag}${side}`, parent, [x, 6 * y, 56]); b.add(`Leg2_${tag}${side}`, `Leg1_${tag}${side}`, [x + 3, 7 * y, 48]); b.add(`Foot_${tag}${side}`, `Leg2_${tag}${side}`, [x, 7 * y, 40]);
  }
  b.add('Chest', 'Joint_Front', [30, 0, 80]); b.add('Head', 'Chest', [30, 0, 95]);
  arms(b);
  return b.model();
}
// (h) a camera joint and a plain joint on the path between chest and head.
function cameraPath() {
  const b = builder();
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Chest', 'Root', [0, 0, 80]); b.add('Bone_HeadCamera', 'Chest', [0, 0, 88]); b.add('Bone12', 'Bone_HeadCamera', [0, 0, 92]); b.add('Head', 'Bone12', [0, 0, 95]);
  arms(b);
  b.add('Pelvis', 'Root', [0, 0, 58]);
  legs(b, 'Pelvis');
  return b.model();
}
// (e) the legs hang straight from the body joint.
function legsOnBody() {
  const b = builder();
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Chest', 'Root', [0, 0, 80]); b.add('Neck', 'Chest', [0, 0, 90]); b.add('Head', 'Neck', [0, 0, 95]);
  arms(b);
  legs(b, 'Root', 58);
  return b.model();
}

// Exact rigs recorded from the code before the gap rule existed.
const BASE_WAIST = {"chains":["arm:Should_L>Elbow_L>Wrist_L","arm:Should_R>Elbow_R>Wrist_R","leg:Leg1_L>Leg2_L>Foot_L","leg:Leg1_R>Leg2_R>Foot_R"],"nodes":["Chest=Chest","Head=Head","Neck=Neck"],"body":"Root","roles":{"Root":"Body","Chest":"Chest"}};
const BASE_PELVIS_ABOVE = {"chains":["arm:Should_L>Elbow_L>Wrist_L","arm:Should_R>Elbow_R>Wrist_R","leg:Leg1_L>Leg2_L>Foot_L","leg:Leg1_R>Leg2_R>Foot_R"],"nodes":["Chest=Chest","Head=Head","Neck=Neck","Pelvis=Pelvis"],"body":"Root","roles":{"Root":"Body","Chest":"Chest"}};
const BASE_FOUR = {"chains":["leg:Leg1_BL>Leg2_BL>Foot_BL","leg:Leg1_BR>Leg2_BR>Foot_BR","leg:Leg1_FL>Leg2_FL>Foot_FL","leg:Leg1_FR>Leg2_FR>Foot_FR"],"nodes":["Head=Head"],"body":"Root","roles":{"Root":"Body"}};
const BASE_NECK = {"chains":["arm:Should_L>Elbow_L>Wrist_L","arm:Should_R>Elbow_R>Wrist_R","leg:Leg1_L>Leg2_L>Foot_L","leg:Leg1_R>Leg2_R>Foot_R"],"nodes":["Chest=Chest","Head=Head","Pelvis=Pelvis"],"body":"Root","roles":{"Root":"Body","Chest":"Chest"}};
const BASE_STILL = {"chains":["arm:Should_L>Elbow_L>Wrist_L","arm:Should_R>Elbow_R>Wrist_R","leg:Leg1_L>Leg2_L>Foot_L","leg:Leg1_R>Leg2_R>Foot_R"],"nodes":["Chest=Chest","Head=Head","Pelvis=Pelvis"],"body":"Root","roles":{"Root":"Body","Chest":"Chest"}};
const BASE_ON_BODY = {"chains":["arm:Should_L>Elbow_L>Wrist_L","arm:Should_R>Elbow_R>Wrist_R","leg:Leg1_L>Leg2_L>Foot_L","leg:Leg1_R>Leg2_R>Foot_R"],"nodes":["Chest=Chest","Head=Head","Neck=Neck"],"body":"Root","roles":{"Root":"Body","Chest":"Chest"}};

test('legs from an unnamed joint make it a pelvis; nothing else moves', () => {
  const result = summary(unnamedWaist());
  assert.ok(result.nodes.includes('Joint07=Pelvis'), 'the leg junction is a pelvis handle');
  assert.deepEqual(result.chains, BASE_WAIST.chains);
  assert.equal(result.body, BASE_WAIST.body);
  assert.deepEqual(result.nodes.filter(n => !n.startsWith('Joint07=')), BASE_WAIST.nodes);
  assert.deepEqual(Object.fromEntries(Object.entries(result.roles).filter(([k]) => k !== 'Joint07')), BASE_WAIST.roles);
});
test('a named pelvis above the leg junction: nothing is added', () => {
  assert.deepEqual(summary(unnamedWaist('Pelvis')), BASE_PELVIS_ABOVE);
});
test('four legs: the rear junction is a pelvis, the front junction that leads to the head is not', () => {
  const result = summary(fourLegged());
  assert.ok(result.nodes.includes('Joint_Rear=Pelvis'), 'rear junction is a pelvis');
  assert.ok(!result.nodes.some(n => n.startsWith('Joint_Front=')), 'front junction carries limbs: no handle of any kind');
  assert.deepEqual(result.chains, BASE_FOUR.chains);
  assert.deepEqual(result.nodes.filter(n => !/^Joint_(Rear|Front)=/.test(n)), BASE_FOUR.nodes);
});
test('an unnamed moving joint between chest and head is a neck; a still one is not', () => {
  const result = summary(unnamedNeck(true));
  assert.ok(result.nodes.includes('Joint09=Neck'), 'the joint is a neck handle');
  assert.deepEqual(result.chains, BASE_NECK.chains);
  assert.equal(result.body, BASE_NECK.body);
  assert.deepEqual(result.nodes.filter(n => !n.startsWith('Joint09=')), BASE_NECK.nodes);
  assert.deepEqual(Object.fromEntries(Object.entries(result.roles).filter(([k]) => k !== 'Joint09')), BASE_NECK.roles);
  assert.deepEqual(summary(unnamedNeck(false)), BASE_STILL);
});
test('a head piece below the head adds no neck', () => {
  const result = summary(headPiece());
  assert.ok(!result.nodes.some(n => n.startsWith('Joint11=')), 'no handle on the joint under the head');
});
test('centaur: only the leg-only junction is a pelvis', () => {
  const result = summary(centaur());
  assert.ok(result.nodes.includes('Joint_Rear=Pelvis'), 'rear junction is a pelvis');
  assert.ok(!result.nodes.some(n => n.startsWith('Joint_Front=')), 'front junction with chest and head is no pelvis');
});
test('a name the reader rules out as non-anatomy gets no neck; its neighbour does', () => {
  const result = summary(cameraPath());
  assert.ok(!result.nodes.some(n => n.startsWith('Bone_HeadCamera=')), 'a camera joint is no neck');
  assert.ok(result.nodes.includes('Bone12=Neck'), 'the plain joint is a neck');
});
test('legs hanging from the body joint add nothing', () => {
  assert.deepEqual(summary(legsOnBody()), BASE_ON_BODY);
});

test('rig.inferred lists exactly the roles the gap rules added', () => {
  for (const [model, expected] of [[unnamedWaist(), { Joint07: 'Pelvis' }], [unnamedNeck(true), { Joint09: 'Neck' }], [legsOnBody(), {}]]) {
    const rig = suggestPoseRig(model, 0, 0), nodes = allNodes(model), name = id => nodes.find(n => n.ObjectId === Number(id)).Name;
    assert.deepEqual(Object.fromEntries(Object.entries(rig.inferred).map(([id, role]) => [name(id), role])), expected);
    for (const id of Object.keys(rig.inferred)) assert.equal(rig.roles[id], rig.inferred[id]);
  }
});
