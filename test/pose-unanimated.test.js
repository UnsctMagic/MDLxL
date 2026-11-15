import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { allNodes } from '../src/animation.js';
import { suggestPoseRig, poseRole, poseChainIds } from '../src/pose-ik.js';

// Motion in existing animations is a clue, never a veto: a unit without any
// animation is recognised like the same unit with one.
const swing = angle => ({ LineType: 1, GlobalSeqId: null, Keys: [0, 50, 100].map((Frame, i) => ({ Frame, Vector: new Float32Array(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), i === 1 ? angle : 0).toArray()) })) });
function builder() {
  const bones = [], helpers = [], attachments = [], all = [], skins = [];
  const find = Name => all.find(n => n.Name === Name);
  const add = (Name, Parent, PivotPoint, { helper = false, moving = true } = {}) => {
    const node = { ObjectId: all.length, Name, Parent: Parent == null ? null : find(Parent).ObjectId, PivotPoint, Flags: 256, ...(moving ? { Rotation: swing(.3) } : {}) };
    all.push(node); (helper ? helpers : bones).push(node);
  };
  const attach = (Name, Parent, PivotPoint) => { const node = { ObjectId: all.length, Name, Parent: find(Parent).ObjectId, PivotPoint, Flags: 0 }; all.push(node); attachments.push(node); };
  const skin = (Name, thick) => skins.push({ id: find(Name).ObjectId, pivot: find(Name).PivotPoint, thick });
  const model = () => {
    const vertices = [], group = [], groups = [];
    skins.forEach(({ id, pivot, thick }, g) => {
      groups.push([id]);
      for (const dx of [-6, 0, 6]) for (const dy of [-6, 0, 6]) for (const dz of thick ? [-6, 0, 6] : [0]) { vertices.push(pivot[0] + dx, pivot[1] + dy, pivot[2] + dz); group.push(g); }
    });
    const n = vertices.length / 3;
    return { Bones: bones, Helpers: helpers, Attachments: attachments, PivotPoints: all.map(b => b.PivotPoint), GlobalSequences: [], Sequences: [{ Name: 'Stand', Interval: [0, 100], MoveSpeed: 0, NonLooping: false, Rarity: 0 }],
      Geosets: n ? [{ Vertices: new Float32Array(vertices), Normals: new Float32Array(vertices.length), VertexGroup: new Uint8Array(group), Groups: groups, Faces: new Uint16Array(0) }] : [] };
  };
  return { add, attach, skin, model };
}
const summary = model => {
  const rig = suggestPoseRig(model, 0, 0), nodes = allNodes(model), name = id => nodes.find(n => n.ObjectId === id).Name;
  return {
    chains: rig.chains.map(c => `${c.kind}:${c.label || ''}:${poseChainIds(c).map(name).join('>')}`).sort(),
    nodes: rig.nodes.map(id => `${name(id)}=${poseRole(model, rig, id, nodes)}`).sort(),
    body: rig.body == null ? null : name(rig.body),
    roles: Object.fromEntries(Object.entries(rig.roles).map(([id, role]) => [name(Number(id)), role]))
  };
};
const stripped = model => { for (const node of allNodes(model)) { delete node.Translation; delete node.Rotation; delete node.Scaling; } return model; };
const same = make => {
  const animated = summary(make()), still = summary(stripped(make()));
  assert.ok(animated.chains.length, 'the animated rig has chains');
  assert.deepEqual(still.chains, animated.chains, 'same chains');
  assert.deepEqual(still.nodes, animated.nodes, 'same part handles');
  assert.equal(still.body, animated.body, 'same body handle');
  assert.deepEqual(still.roles, animated.roles, 'same roles');
};

function body(b, { arms = true } = {}) {
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Chest', 'Root', [0, 0, 80]); b.add('Neck', 'Chest', [0, 0, 90]); b.add('Head', 'Neck', [0, 0, 95]);
  b.add('Pelvis', 'Root', [0, 0, 58]);
  for (const [side, y] of [['R', -1], ['L', 1]]) {
    b.add(`Should_${side}`, 'Chest', [0, 10 * y, 85]);
    if (arms) { b.add(`Elbow_${side}`, `Should_${side}`, [0, 20 * y, 75]); b.add(`Wrist_${side}`, `Elbow_${side}`, [4, 28 * y, 66]); }
    b.add(`Leg1_${side}`, 'Pelvis', [0, 6 * y, 56]); b.add(`Leg2_${side}`, `Leg1_${side}`, [3, 7 * y, 48]); b.add(`Foot_${side}`, `Leg2_${side}`, [0, 7 * y, 40]);
  }
  for (const joint of ['Chest', 'Neck', 'Head', 'Pelvis', 'Should_R', 'Should_L', 'Leg1_R', 'Leg2_R', 'Foot_R', 'Leg1_L', 'Leg2_L', 'Foot_L']) b.skin(joint, true);
}
function winged(all = ['B_W_1', 'B_W_2', 'B_W_3', 'B_W_4', 'B_W_5', 'B_W_6']) {
  const b = builder(); body(b);
  ['R', 'L'].forEach((side, s) => {
    const y = side === 'R' ? -1 : 1, names = all.slice(3 * s, 3 * s + 3);
    names.forEach((name, i) => { b.add(name, i ? names[i - 1] : `Should_${side}`, [-6, 20 * (i + 1) * y, 90]); b.skin(name, false); });
  });
  return b.model();
}
function handRow() {
  const b = builder(); body(b, { arms: false });
  for (const [side, y] of [['R', -1], ['L', 1]]) {
    b.add(`Hand_1_${side}`, `Should_${side}`, [0, 20 * y, 75]); b.add(`Hand_2_${side}`, `Hand_1_${side}`, [2, 24 * y, 70]); b.add(`Hand_3_${side}`, `Hand_2_${side}`, [4, 28 * y, 66]);
    b.attach(`Hand ${side === 'R' ? 'Right' : 'Left'} Ref`, `Hand_3_${side}`, [4, 30 * y, 64]);
  }
  return b.model();
}
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
function unnamedNeck() {
  const b = builder();
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Chest', 'Root', [0, 0, 80]); b.add('Joint09', 'Chest', [0, 0, 90]); b.add('Head', 'Joint09', [0, 0, 95]);
  for (const [side, y] of [['R', -1], ['L', 1]]) { b.add(`Should_${side}`, 'Chest', [0, 10 * y, 85]); b.add(`Elbow_${side}`, `Should_${side}`, [0, 20 * y, 75]); b.add(`Wrist_${side}`, `Elbow_${side}`, [4, 28 * y, 66]); }
  b.add('Pelvis', 'Root', [0, 0, 58]);
  for (const [side, y] of [['R', -1], ['L', 1]]) { b.add(`Leg1_${side}`, 'Pelvis', [0, 6 * y, 56]); b.add(`Leg2_${side}`, `Leg1_${side}`, [3, 7 * y, 48]); b.add(`Foot_${side}`, `Leg2_${side}`, [0, 7 * y, 40]); }
  return b.model();
}

test('unnamed branches still need motion: without animation the unnamed wing chains are absent, everything else is identical', () => {
  const animated = summary(winged()), still = summary(stripped(winged()));
  assert.equal(animated.chains.filter(c => c.includes('B_W_')).length, 2, 'the animated rig has both unnamed wing chains');
  assert.deepEqual(still.chains.filter(c => c.includes('B_W_')), [], 'no unnamed wing chain without motion');
  assert.deepEqual(still.chains, animated.chains.filter(c => !c.includes('B_W_')), 'every other chain is identical');
  assert.deepEqual(still.nodes, animated.nodes);
  assert.equal(still.body, animated.body);
  assert.deepEqual(still.roles, animated.roles);
});
test('named wing joints keep their Wing part handles without animation', () => {
  const make = () => winged(['Wing R 1', 'Wing R 2', 'Wing R 3', 'Wing L 1', 'Wing L 2', 'Wing L 3']);
  assert.ok(summary(make()).nodes.some(n => n.endsWith('=Wing')), 'the animated rig has Wing handles');
  same(make);
});
test('hand row rig: no animation gives the same chains and handles', () => same(handRow));
test('Hip-under-waist rig: no animation gives the same chains and handles', () => same(vampire));
test('unnamed neck rig: no animation gives the same chains and handles', () => same(unnamedNeck));
