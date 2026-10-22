import test from 'node:test';
import assert from 'node:assert/strict';
import { planAttachments, applyAttachmentPlan, attachmentKey, nameSide, attachematorStandSequence } from '../src/attachemator.js';

// A small standing humanoid: named Blizzard-style bones, each with a little
// box of skinned vertices, and a sword mesh held in the right hand.
function humanoid({ mirroredNames = false } = {}) {
  const model = { Version: 800, Bones: [], Helpers: [], Attachments: [], Nodes: [], Geosets: [], GeosetAnims: [], GlobalSequences: [], Sequences: [{ Name: 'Stand - 2', Interval: [0, 1000] }, { Name: 'Stand', Interval: [1100, 2000] }], PivotPoints: [], Info: {} };
  const vertices = [], groups = [], group = [];
  let id = 0;
  const box = (bone, center, size = 3) => {
    const index = groups.length; groups.push([bone]);
    for (const dx of [-size, size]) for (const dy of [-size, size]) for (const dz of [-size, size]) { vertices.push(center[0] + dx, center[1] + dy, center[2] + dz); group.push(index); }
  };
  const add = (Name, Parent, PivotPoint, mesh) => {
    const node = { Name, ObjectId: id++, Parent, PivotPoint: new Float32Array(PivotPoint), Flags: 256, GeosetId: null, GeosetAnimId: null };
    model.Bones.push(node); model.Nodes[node.ObjectId] = node; model.PivotPoints[node.ObjectId] = node.PivotPoint;
    if (mesh) box(node.ObjectId, mesh.center, mesh.size);
    return node.ObjectId;
  };
  const root = add('Bone_Root', null, [0, 0, 40], { center: [0, 0, 42], size: 7 });
  const chest = add('Bone_Chest', root, [0, 0, 60], { center: [0, 0, 66], size: 8 });
  add('Bone_Head', chest, [0, 0, 80], { center: [2, 0, 88], size: 6 });
  for (const [side, sign] of [['L', 1], ['R', -1]]) {
    const named = mirroredNames ? (side === 'L' ? 'R' : 'L') : side;
    const arm1 = add(`Bone_Arm1_${named}`, chest, [0, 15 * sign, 62], { center: [0, 18 * sign, 55], size: 3 });
    const arm2 = add(`Bone_Arm2_${named}`, arm1, [0, 22 * sign, 48], { center: [0, 23 * sign, 42], size: 3 });
    const hand = add(`Bone_Hand_${named}`, arm2, [0, 25 * sign, 36], { center: [2, 25 * sign, 32], size: 3 });
    if (side === 'R') {
      const sword = add('Cylinder01', hand, [0, -25, 32]);
      for (let x = 4; x <= 52; x += 4) box(sword, [x, -25, 32], 1);
    }
    const leg1 = add(`Bone_Leg1_${named}`, root, [0, 8 * sign, 38], { center: [0, 8 * sign, 30], size: 3 });
    const leg2 = add(`Bone_Leg2_${named}`, leg1, [0, 9 * sign, 20], { center: [0, 9 * sign, 13], size: 3 });
    add(`Bone_Foot_${named}`, leg2, [2, 9 * sign, 5], { center: [5, 9 * sign, 3], size: 3 });
  }
  model.Geosets.push({ Vertices: new Float32Array(vertices), Normals: new Float32Array(vertices.length), VertexGroup: new Uint8Array(group), Groups: groups, Faces: new Uint16Array([0, 1, 2]), TVertices: [new Float32Array(vertices.length / 3 * 2)], MaterialID: 0, SelectionGroup: 0, Unselectable: false, MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array(3), BoundsRadius: 0, Anims: [] });
  return model;
}
const byName = model => name => [...model.Bones, ...model.Helpers].find(node => node.Name === name)?.ObjectId;
const row = (plan, key) => plan.rows.find(item => item.key === key);

test('standard point names match however Blizzard spaced or cased them', () => {
  assert.equal(attachmentKey('OverHead Ref '), 'overhead');
  assert.equal(attachmentKey('Head - Ref'), 'head');
  assert.equal(attachmentKey('Foot Right  Ref'), 'foot right');
  assert.equal(attachmentKey('Foot Left Rear Ref'), 'foot left rear');
  assert.notEqual(attachmentKey('Hand Right Ref 01'), 'hand right');
  assert.notEqual(attachmentKey('Chest Ref01'), 'chest');
  assert.equal(nameSide('Bone_Hand_R'), 'right');
  assert.equal(nameSide('HandLeft'), 'left');
  assert.equal(nameSide('Bone FrontL Toe'), 'left');
  assert.equal(nameSide('Bone_Root'), null);
});

test('measures the plain Stand animation', () => {
  assert.equal(attachematorStandSequence(humanoid()), 1);
});

test('a bare humanoid gets every standard point on the bone Blizzard uses', () => {
  const model = humanoid(), id = byName(model), plan = planAttachments(model);
  assert.deepEqual(plan.rows.map(item => item.key), ['origin', 'overhead', 'head', 'chest', 'hand left', 'hand right', 'foot left', 'foot right', 'weapon']);
  assert.ok(plan.rows.every(item => item.state === 'new'));
  assert.equal(row(plan, 'origin').parent, null); assert.deepEqual(row(plan, 'origin').pivot, [0, 0, 0]);
  assert.equal(row(plan, 'overhead').parent, null); assert.ok(row(plan, 'overhead').pivot[2] > 94, 'overhead sits above the top of the head');
  assert.equal(row(plan, 'head').parent, id('Bone_Head'));
  assert.equal(row(plan, 'chest').parent, id('Bone_Chest'));
  assert.equal(row(plan, 'hand left').parent, id('Bone_Hand_L')); assert.ok(row(plan, 'hand left').pivot[1] > 20, 'left is +Y, as in Blizzard models');
  assert.equal(row(plan, 'hand right').parent, id('Bone_Hand_R')); assert.ok(row(plan, 'hand right').pivot[1] < -20);
  assert.equal(row(plan, 'foot left').parent, id('Bone_Foot_L'));
  assert.ok(Math.abs(row(plan, 'foot left').pivot[2]) < .01, 'feet sit on the ground');
  assert.equal(row(plan, 'weapon').parent, id('Cylinder01'));
  assert.ok(row(plan, 'weapon').pivot[0] > 20, 'weapon sits out on the blade, not in the fist');
});

test('commit adds the points as attachments that follow their bones', () => {
  const model = humanoid(), plan = planAttachments(model);
  const result = applyAttachmentPlan(model, plan.rows);
  assert.equal(result.changed, 9);
  assert.equal(model.Attachments.length, 9);
  assert.deepEqual(model.Attachments.map(node => node.Name), ['Origin Ref', 'OverHead Ref', 'Head Ref', 'Chest Ref', 'Hand Left Ref', 'Hand Right Ref', 'Foot Left Ref', 'Foot Right Ref', 'Weapon Ref']);
  assert.equal(new Set(model.Attachments.map(node => node.AttachmentID)).size, 9);
  for (const node of model.Attachments) {
    assert.equal(model.PivotPoints[node.ObjectId], node.PivotPoint);
    assert.equal(model.Nodes[node.ObjectId], node);
    assert.equal(result.ids[attachmentKey(node.Name)], node.ObjectId);
  }
  // A second pass finds nothing left to do.
  assert.ok(planAttachments(model).rows.every(item => item.state === 'right'));
});

test('existing points are sorted out, and a vetoed point is left exactly as it was', () => {
  const model = humanoid(), id = byName(model);
  applyAttachmentPlan(model, planAttachments(model).rows);
  const hand = model.Attachments.find(node => node.Name === 'Hand Left Ref'), head = model.Attachments.find(node => node.Name === 'Head Ref');
  hand.Parent = id('Bone_Root'); hand.PivotPoint = model.PivotPoints[hand.ObjectId] = new Float32Array([30, 30, 30]);
  head.Parent = null; head.PivotPoint = model.PivotPoints[head.ObjectId] = new Float32Array([0, 0, 0]);
  const plan = planAttachments(model);
  assert.equal(row(plan, 'hand left').state, 'change'); assert.ok(row(plan, 'hand left').reparent);
  assert.equal(row(plan, 'head').state, 'change');
  assert.equal(row(plan, 'chest').state, 'right');
  const chosen = new Set(['hand left']);
  applyAttachmentPlan(model, plan.rows, { chosen });
  assert.equal(hand.Parent, id('Bone_Hand_L'));
  assert.equal(head.Parent, null, 'vetoed head keeps its parent');
  assert.deepEqual(Array.from(head.PivotPoint), [0, 0, 0], 'vetoed head keeps its spot');
  assert.equal(model.Attachments.length, 9, 'matching points are reused, never duplicated');
});

test('an adjusted spot is what gets committed', () => {
  const model = humanoid(), plan = planAttachments(model);
  applyAttachmentPlan(model, plan.rows, { chosen: new Set(['head']), pivots: { head: [1, 2, 3] } });
  assert.equal(model.Attachments.length, 1);
  assert.deepEqual(Array.from(model.Attachments[0].PivotPoint), [1, 2, 3]);
});

test('when a model names its sides the other way round, the names win like in Blizzard models', () => {
  const model = humanoid({ mirroredNames: true }), id = byName(model), plan = planAttachments(model);
  assert.equal(row(plan, 'hand left').parent, id('Bone_Hand_L'));
  assert.equal(row(plan, 'foot right').parent, id('Bone_Foot_R'));
});

test('Reforged rigs use their named attachment joints, even with twist joints POSE cannot bend', () => {
  const model = humanoid(), id = byName(model);
  const rename = (from, to) => { model.Bones.find(node => node.Name === from).Name = to; };
  rename('Bone_Hand_L', 'bone_hand_left'); rename('Bone_Hand_R', 'bone_hand_right');
  rename('Bone_Foot_L', 'bone_leg_left'); rename('Bone_Foot_R', 'bone_leg_right');
  rename('Bone_Head', 'bone_head'); rename('Bone_Chest', 'bone_chest');
  // A twist joint sharing the hand's pivot, as in Reforged arms.
  for (const name of ['bone_hand_left', 'bone_hand_right']) {
    const hand = model.Bones.find(node => node.Name === name);
    const twist = { Name: name + '_twist', ObjectId: model.Bones.length + 100, Parent: hand.Parent, PivotPoint: new Float32Array(hand.PivotPoint), Flags: 256 };
    model.Bones.push(twist); model.Nodes[twist.ObjectId] = twist; model.PivotPoints[twist.ObjectId] = twist.PivotPoint; hand.Parent = twist.ObjectId;
  }
  const plan = planAttachments(model);
  assert.equal(row(plan, 'hand left').parent, id('bone_hand_left'));
  assert.equal(row(plan, 'hand right').parent, id('bone_hand_right'));
  assert.equal(row(plan, 'foot left').parent, id('bone_leg_left'));
  assert.equal(row(plan, 'foot right').parent, id('bone_leg_right'));
  assert.equal(row(plan, 'head').parent, id('bone_head'));
  assert.equal(row(plan, 'chest').parent, id('bone_chest'));
});
