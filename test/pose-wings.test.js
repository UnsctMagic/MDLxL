import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { allNodes } from '../src/animation.js';
import { suggestPoseRig, poseRole, poseChainIds } from '../src/pose-ik.js';

// Clues add, none removes: a weapon word excludes only what is held, a mirrored
// partner may hang from the mirrored shoulder, a sheet of skin is a wing, and in a
// row of same-named hand joints the one that moves and carries the attachment is the end.
const swing = angle => ({ LineType: 1, GlobalSeqId: null, Keys: [0, 50, 100].map((Frame, i) => ({ Frame, Vector: new Float32Array(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), i === 1 ? angle : 0).toArray()) })) });
function builder() {
  const bones = [], helpers = [], attachments = [], all = [], skins = [];
  const find = Name => all.find(n => n.Name === Name);
  const add = (Name, Parent, PivotPoint, { helper = false, moving = true } = {}) => {
    const node = { ObjectId: all.length, Name, Parent: Parent == null ? null : find(Parent).ObjectId, PivotPoint, Flags: 256, ...(moving ? { Rotation: swing(.3) } : {}) };
    all.push(node); (helper ? helpers : bones).push(node);
  };
  const attach = (Name, Parent, PivotPoint) => { const node = { ObjectId: all.length, Name, Parent: find(Parent).ObjectId, PivotPoint, Flags: 0 }; all.push(node); attachments.push(node); };
  // Vertices around a joint's pivot: a flat sheet (x by y) or a thick tube (x by y by z).
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
    chains: rig.chains.map(c => `${c.label || c.kind}:${poseChainIds(c).map(name).join('>')}`).sort(),
    nodes: rig.nodes.map(id => `${name(id)}=${poseRole(model, rig, id, nodes)}`).sort(),
    body: rig.body == null ? null : name(rig.body),
    roles: Object.fromEntries(Object.entries(rig.roles).map(([id, role]) => [name(Number(id)), role]))
  };
};
const without = (result, ...tags) => result.chains.filter(c => !tags.some(tag => c.includes(tag)));

// A body with two arms and two legs; the arms hang from shoulders under the chest.
function body(b, { arms = true, toes = false } = {}) {
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Chest', 'Root', [0, 0, 80]); b.add('Neck', 'Chest', [0, 0, 90]); b.add('Head', 'Neck', [0, 0, 95]);
  b.add('Pelvis', 'Root', [0, 0, 58]);
  for (const [side, y] of [['R', -1], ['L', 1]]) {
    b.add(`Should_${side}`, 'Chest', [0, 10 * y, 85]);
    if (arms) { b.add(`Elbow_${side}`, `Should_${side}`, [0, 20 * y, 75]); b.add(`Wrist_${side}`, `Elbow_${side}`, [4, 28 * y, 66]); }
    b.add(`Leg1_${side}`, 'Pelvis', [0, 6 * y, 56]); b.add(`Leg2_${side}`, `Leg1_${side}`, [3, 7 * y, 48]); b.add(`Foot_${side}`, `Leg2_${side}`, [0, 7 * y, 40]);
  }
  if (toes) for (const [side, y] of [['R', -1], ['L', 1]]) { b.add(`Toe_${side}`, `Foot_${side}`, [4, 7 * y, 38]); b.attach(`Foot ${side === 'R' ? 'Right' : 'Left'} Ref`, `Toe_${side}`, [5, 7 * y, 37]); }
  for (const joint of ['Chest', 'Neck', 'Head', 'Pelvis', 'Should_R', 'Should_L', 'Leg1_R', 'Leg2_R', 'Foot_R', 'Leg1_L', 'Leg2_L', 'Foot_L']) b.skin(joint, true);
}
// A three-joint branch under each shoulder, mirrored, skinned.
function winged({ thick = false, names = ['B_W_1', 'B_W_2', 'B_W_3', 'B_W_4', 'B_W_5', 'B_W_6'], sides = ['R', 'L'] } = {}) {
  const b = builder(); body(b);
  sides.forEach((side, s) => {
    const y = side === 'R' ? -1 : 1;
    names.slice(3 * s, 3 * s + 3).forEach((name, i) => {
      b.add(name, i ? names[3 * s + i - 1] : `Should_${side}`, [-6, 20 * (i + 1) * y, 90]);
      b.skin(name, thick);
    });
  });
  return b.model();
}

test('a moving, skinned, mirrored sheet under each shoulder is a pair of wing chains; nothing else changes', () => {
  const plain = summary(winged({ sides: [] })), result = summary(winged());
  assert.deepEqual(result.chains.filter(c => c.startsWith('Wing:')), ['Wing:B_W_1>B_W_2>B_W_3', 'Wing:B_W_4>B_W_5>B_W_6']);
  assert.deepEqual(without(result, 'Wing:'), plain.chains, 'every other chain is the same as without wings');
  assert.deepEqual(result.nodes, plain.nodes, 'part handles are the same');
  assert.equal(result.body, plain.body);
});

test('the same branches with a thick, tube-like skin are plain arm chains without a label', () => {
  const result = summary(winged({ thick: true }));
  assert.deepEqual(result.chains.filter(c => /B_W_/.test(c)), ['arm:B_W_1>B_W_2>B_W_3', 'arm:B_W_4>B_W_5>B_W_6']);
});

test('a weapon-named branch below a hand is held and gives no chain', () => {
  const b = builder(); body(b);
  for (const [side, y] of [['R', -1], ['L', 1]]) for (let i = 1; i <= 3; i++) {
    b.add(`Weapon_${side}_${i}`, i === 1 ? `Wrist_${side}` : `Weapon_${side}_${i - 1}`, [4, (30 + 10 * i) * y, 66]); b.skin(`Weapon_${side}_${i}`, true);
  }
  assert.deepEqual(summary(b.model()).chains.filter(c => /Weapon/.test(c)), []);
});

test('a single such branch with no partner anywhere gives no chain', () => {
  const b = builder(); body(b);
  ['B_W_1', 'B_W_2', 'B_W_3'].forEach((name, i) => { b.add(name, i ? `B_W_${i}` : 'Should_R', [-6, -20 * (i + 1), 90]); b.skin(name, false); });
  assert.deepEqual(summary(b.model()).chains.filter(c => /B_W_/.test(c)), []);
});

test('in a row of moving hand joints, the one with the hand attachment is the end', () => {
  const b = builder(); body(b, { arms: false });
  for (const [side, y] of [['R', -1], ['L', 1]]) {
    b.add(`Hand_1_${side}`, `Should_${side}`, [0, 20 * y, 75]); b.add(`Hand_2_${side}`, `Hand_1_${side}`, [2, 24 * y, 70]); b.add(`Hand_3_${side}`, `Hand_2_${side}`, [4, 28 * y, 66]);
    b.attach(`Hand ${side === 'R' ? 'Right' : 'Left'} Ref`, `Hand_3_${side}`, [4, 30 * y, 64]);
  }
  assert.deepEqual(summary(b.model()).chains.filter(c => c.startsWith('arm')), ['arm:Hand_1_L>Hand_2_L>Hand_3_L', 'arm:Hand_1_R>Hand_2_R>Hand_3_R']);
});

// The hand bone moves; the mesh joint that carries the attachment does not.
test('a moving hand bone with a still mesh joint keeps the bone as the end', () => {
  const b = builder(); body(b, { arms: false });
  for (const [side, y] of [['R', -1], ['L', 1]]) {
    b.add(`Elbow_${side}`, `Should_${side}`, [0, 20 * y, 75]); b.add(`Bone_Hand_${side}`, `Elbow_${side}`, [4, 28 * y, 66]);
    b.add(`HandMesh_${side}`, `Bone_Hand_${side}`, [4, 30 * y, 64], { moving: false });
    b.attach(`Hand ${side === 'R' ? 'Right' : 'Left'} Ref`, `HandMesh_${side}`, [4, 31 * y, 63]);
  }
  assert.deepEqual(summary(b.model()), BASELINE_MESH_HAND);
});

// A foot with legs above it is already the limb end; a toe below it with the attachment does not take over.
function toeRig() { const b = builder(); body(b, { toes: true }); return b.model(); }
test('a moving toe below a foot, with the foot attachment, leaves the foot as the end', () => {
  assert.deepEqual(summary(toeRig()), BASELINE_TOE);
});

// Wing joints already named Wing have Wing part handles; the new pathway adds nothing.
test('wing joints named by name get no extra chains', () => {
  assert.deepEqual(summary(winged({ names: ['Wing R 1', 'Wing R 2', 'Wing R 3', 'Wing L 1', 'Wing L 2', 'Wing L 3'] })), BASELINE_NAMED_WINGS);
});

// Recorded from the code before the hand-row rule existed.
const BASELINE_TOE = {"chains":["arm:Should_L>Elbow_L>Wrist_L","arm:Should_R>Elbow_R>Wrist_R","leg:Leg1_L>Leg2_L>Foot_L","leg:Leg1_R>Leg2_R>Foot_R"],"nodes":["Chest=Chest","Head=Head","Neck=Neck","Pelvis=Pelvis"],"body":"Root","roles":{"Root":"Body","Chest":"Chest"}};
const BASELINE_NAMED_WINGS = {"chains":["arm:Should_L>Elbow_L>Wrist_L","arm:Should_R>Elbow_R>Wrist_R","leg:Leg1_L>Leg2_L>Foot_L","leg:Leg1_R>Leg2_R>Foot_R"],"nodes":["Chest=Chest","Head=Head","Neck=Neck","Pelvis=Pelvis","Wing L 1=Wing","Wing L 2=Wing","Wing R 1=Wing","Wing R 2=Wing"],"body":"Root","roles":{"Root":"Body","Chest":"Chest"}};
const BASELINE_MESH_HAND = {"chains":["arm:Should_L>Elbow_L>Bone_Hand_L","arm:Should_R>Elbow_R>Bone_Hand_R","leg:Leg1_L>Leg2_L>Foot_L","leg:Leg1_R>Leg2_R>Foot_R"],"nodes":["Chest=Chest","Head=Head","Neck=Neck","Pelvis=Pelvis"],"body":"Root","roles":{"Root":"Body","Chest":"Chest"}};
