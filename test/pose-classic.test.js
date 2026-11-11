import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { allNodes } from '../src/animation.js';
import { suggestPoseRig, poseRole, poseChainIds } from '../src/pose-ik.js';

// { clues: false } is the rig as the code before the added clues computed it (Auto Corpse,
// Attachemator and AnimXL read it); the default adds the clues (POSE handles in Movement).
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
function plainBuilder() {
  const bones = [], helpers = [], all = [];
  const add = (Name, Parent, PivotPoint, { helper = false, moving = true } = {}) => {
    const node = { ObjectId: all.length, Name, Parent: Parent == null ? null : all.find(n => n.Name === Parent).ObjectId, PivotPoint, Flags: 256, ...(moving ? { Rotation: swing(.3) } : {}) };
    all.push(node); (helper ? helpers : bones).push(node);
  };
  const model = () => ({ Bones: bones, Helpers: helpers, Attachments: [], PivotPoints: all.map(b => b.PivotPoint), GlobalSequences: [], Sequences: [{ Name: 'Stand', Interval: [0, 100], MoveSpeed: 0, NonLooping: false, Rarity: 0 }], Geosets: [] });
  return { add, model };
}
const summary = (model, options) => {
  const rig = suggestPoseRig(model, 0, 0, options), nodes = allNodes(model), name = id => nodes.find(n => n.ObjectId === id).Name;
  return {
    chains: rig.chains.map(c => `${c.label || c.kind}:${poseChainIds(c).map(name).join('>')}`).sort(),
    nodes: rig.nodes.map(id => `${name(id)}=${poseRole(model, rig, id, nodes)}`).sort(),
    body: rig.body == null ? null : name(rig.body),
    roles: Object.fromEntries(Object.entries(rig.roles).map(([id, role]) => [name(Number(id)), role]))
  };
};
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

function vampire() {
  const b = plainBuilder();
  b.add('Root', null, [0, 0, 60], { helper: true });
  b.add('Chest', 'Root', [0, 0, 80]); b.add('Neck', 'Chest', [0, 0, 90]); b.add('Head', 'Neck', [0, 0, 95]); b.add('Hair_Rear_Root', 'Head', [-4, 0, 97]);
  b.add('Waist', 'Root', [0, 0, 58]);
  for (const [side, y] of [['R', -1], ['L', 1]]) {
    b.add(`Should_${side}`, 'Chest', [0, 10 * y, 85]); b.add(`Elbow_${side}`, `Should_${side}`, [0, 20 * y, 75]); b.add(`Wrist_${side}`, `Elbow_${side}`, [4, 28 * y, 66]);
    b.add(`Hip_${side}`, 'Waist', [0, 6 * y, 56]); b.add(`Knee_${side}`, `Hip_${side}`, [3, 7 * y, 48]); b.add(`Ankle_${side}`, `Knee_${side}`, [0, 7 * y, 40]);
  }
  return b.model();
}

export const rigs = { winged, vampire };
const CLASSIC_WINGED = {"chains":["arm:Should_L>Elbow_L>Wrist_L","arm:Should_R>Elbow_R>Wrist_R","leg:Leg1_L>Leg2_L>Foot_L","leg:Leg1_R>Leg2_R>Foot_R"],"nodes":["Chest=Chest","Head=Head","Neck=Neck","Pelvis=Pelvis"],"body":"Root","roles":{"Root":"Body","Chest":"Chest"}};
const CLASSIC_VAMPIRE = {"chains":["arm:Should_L>Elbow_L>Wrist_L","arm:Should_R>Elbow_R>Wrist_R"],"nodes":["Chest=Chest","Hair_Rear_Root=Body","Head=Head","Hip_L=Pelvis","Hip_R=Pelvis","Neck=Neck"],"body":"Root","roles":{"Root":"Body","Chest":"Chest"}};
test('without the added clues, the winged rig has no wing chains as before; the default finds them', () => {
  assert.deepEqual(summary(winged(), { clues: false }), CLASSIC_WINGED);
  assert.ok(summary(winged()).chains.some(c => c.startsWith('Wing:')));
});
test('without the added clues, mirrored Hip bones keep the classic reading; the default makes the waist the pelvis', () => {
  assert.deepEqual(summary(vampire(), { clues: false }), CLASSIC_VAMPIRE);
  assert.ok(summary(vampire()).nodes.includes('Waist=Pelvis'));
});
