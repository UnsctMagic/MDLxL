import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Quaternion, Vector3 } from 'three';
import { openDocument } from '../src/editor-document.js';
import { allNodes } from '../src/animation.js';
import { suggestPoseRig, poseRole } from '../src/pose-ik.js';

// Body parts follow the bodies POSE finds from their limbs, never a bone name
// alone: a part must hang from a found body (or the moving trunk it rides on).
const swing = angle => ({ LineType: 1, GlobalSeqId: null, Keys: [0, 50, 100].map((Frame, i) => ({ Frame, Vector: new Float32Array(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), i === 1 ? angle : 0).toArray()) })) });
function fixture() {
  const bones = [];
  const add = (Name, Parent, PivotPoint, moving = true) => { const ObjectId = bones.length; bones.push({ ObjectId, Name, Parent: Parent == null ? null : bones.find(b => b.Name === Parent).ObjectId, PivotPoint, Flags: 256, ...(moving ? { Rotation: swing(.3) } : {}) }); };
  // A mount (moving root, own head, no recognised limbs) carrying a rider.
  add('Mount Root', null, [0, 0, 40]); add('Mount Neck Link', 'Mount Root', [30, 0, 45]); add('Bone Mount Head', 'Mount Neck Link', [45, 0, 50]);
  add('Bone_Root', 'Mount Root', [0, 0, 60]); add('Bone_Pelvis', 'Bone_Root', [0, 0, 58]); add('Bone_Chest', 'Bone_Root', [0, 0, 80]);
  add('Bone_Head', 'Bone_Chest', [0, 0, 95]); add('Bone_Head Flap', 'Bone_Head', [0, 4, 100]);
  for (const [side, y] of [['R', -1], ['L', 1]]) {
    add(`Bone_Arm1_${side}`, 'Bone_Chest', [0, 10 * y, 85]); add(`Bone_Arm2_${side}`, `Bone_Arm1_${side}`, [0, 20 * y, 75]); add(`Bone_Hand_${side}`, `Bone_Arm2_${side}`, [4, 28 * y, 66]);
    add(`Bone_Leg1_${side}`, 'Bone_Pelvis', [0, 6 * y, 56]); add(`Bone_Leg2_${side}`, `Bone_Leg1_${side}`, [3, 7 * y, 48]); add(`Bone_Foot_${side}`, `Bone_Leg2_${side}`, [0, 7 * y, 40]);
  }
  add('Wrench Head', 'Bone_Hand_R', [12, -30, 66], false); // a rigid prop in the hand
  add('Bone_Wing_L', 'Bone_Hand_L', [6, 34, 70]); // a wing growing from the hand
  // A flail on its own skeleton: its root and ball swing, but carry no body.
  add('Flail_Root', null, [10, -28, 66]); add('Flail_Link', 'Flail_Root', [20, -28, 60]); add('Flail_Head', 'Flail_Link', [30, -28, 54]);
  return { Bones: bones, Helpers: [], Attachments: [], PivotPoints: bones.map(b => b.PivotPoint), GlobalSequences: [], Sequences: [{ Name: 'Stand', Interval: [0, 100], MoveSpeed: 0, NonLooping: false, Rarity: 0 }], Geosets: [] };
}
const named = (model, rig) => { const nodes = allNodes(model); return name => poseRole(model, rig, nodes.find(n => n.Name === name).ObjectId, nodes); };

test('a weapon skeleton, a held prop and head pieces are no second head or body; a mount keeps its head', () => {
  const model = fixture(), rig = suggestPoseRig(model, 0, 0), role = named(model, rig), nodes = allNodes(model), name = id => nodes.find(n => n.ObjectId === id).Name;
  assert.equal(rig.chains.filter(c => c.kind === 'arm').length, 2); assert.equal(rig.chains.filter(c => c.kind === 'leg').length, 2);
  assert.equal(role('Bone_Head'), 'Head');
  assert.equal(role('Bone Mount Head'), 'Head', 'the moving trunk the rider sits on is a body with its own head');
  assert.notEqual(role('Flail_Head'), 'Head', 'a separate weapon skeleton is no head');
  assert.notEqual(role('Flail_Root'), 'Body', 'a separate weapon skeleton is no body');
  assert.equal(role('Bone_Head Flap'), 'Head', 'a piece of a head still belongs to the head');
  assert.notEqual(role('Wrench Head'), 'Head', 'a rigid prop in a hand is no head');
  assert.equal(role('Bone_Wing_L'), 'Wing', 'a wing may grow from a hand');
  assert.equal(role('Flail_Head'), 'Object'); assert.equal(role('Wrench Head'), 'Object');
  const heads = rig.nodes.filter(id => poseRole(model, rig, id, nodes) === 'Head').map(name).sort();
  assert.deepEqual(heads, ['Bone Mount Head', 'Bone_Head'], 'one head handle per body; the flap has none of its own');
  assert.ok(!rig.nodes.map(name).some(n => /^Flail/.test(n)), 'no flail handle');
});

// A Death that swaps the living head for a severed one on its own skeleton:
// the piece stands in for the head; the flail beside it stays Object.
function deathSwap(swap) {
  const model = fixture(), bones = model.Bones, id = name => bones.find(b => b.Name === name).ObjectId;
  model.Sequences.push({ Name: 'Death', Interval: [200, 300], MoveSpeed: 0, NonLooping: true, Rarity: 0 });
  for (const [Name, Parent, PivotPoint] of [['Loose Chest', null, [40, 0, 5]], ['Loose Head', 'Loose Chest', [50, 0, 5]]]) bones.push({ ObjectId: bones.length, Name, Parent: Parent && id(Parent), PivotPoint, Flags: 256, Rotation: swing(.3) });
  model.PivotPoints = bones.map(b => b.PivotPoint);
  const alpha = keys => ({ LineType: 0, GlobalSeqId: null, Keys: keys.map(([Frame, a]) => ({ Frame, Vector: new Float32Array([a]) })) });
  const shown = [[0, 1], [100, 1], [200, 1], [300, 1]], living = swap ? [[0, 1], [100, 1], [200, 1], [300, 0]] : shown, severed = swap ? [[0, 0], [100, 0], [200, 0], [300, 1]] : shown;
  for (const [bone, keys] of [['Bone_Head', living], ['Loose Head', severed], ['Flail_Head', shown]]) {
    const at = bones[id(bone)].PivotPoint;
    model.Geosets.push({ Vertices: new Float32Array([...at, at[0] + 1, at[1], at[2], at[0], at[1] + 1, at[2]]), Normals: new Float32Array(9), VertexGroup: new Uint8Array(3), Groups: [[id(bone)]], Faces: new Uint16Array([0, 1, 2]), MaterialID: 0 });
    (model.GeosetAnims ||= []).push({ GeosetId: model.Geosets.length - 1, Alpha: alpha(keys), Flags: 0 });
  }
  return model;
}

test('a severed head shown while the living head is hidden stands in for it; a flail does not', () => {
  for (const [swap, expected] of [[true, 'Head'], [false, 'Object']]) {
    const model = deathSwap(swap);
    for (const [frame, sequence] of [[0, 0], [300, 1]]) {
      const rig = suggestPoseRig(model, frame, sequence), role = named(model, rig);
      assert.equal(role('Bone_Head'), 'Head');
      assert.equal(role('Loose Head'), expected, `swap=${swap}, clip ${sequence}`);
      assert.equal(role('Flail_Head'), 'Object');
    }
  }
});

const ratlings = ['ratling_unit.mdx', 'ratling_hero.mdx'].map(name => path.join(process.env.MDLXL_RATLING_DIR || 'D:/Claude/LowPolyWorks/dist/models/gluma/313020', name)).filter(file => fs.existsSync(file));
test('the owner\'s ratlings keep their Death head and chest', { skip: !ratlings.length && 'ratling models not present' }, () => {
  for (const file of ratlings) {
    const model = openDocument(fs.readFileSync(file)).model, death = model.Sequences.findIndex(s => /^death/i.test(s.Name)), rig = suggestPoseRig(model, model.Sequences[death].Interval[1], death), role = named(model, rig);
    assert.equal(role('gore_head'), 'Head', path.basename(file)); assert.equal(role('gore_chest1'), 'Chest', path.basename(file)); assert.equal(role('K_head'), 'Head', path.basename(file));
  }
});

test('a static container root is no trunk: a weapon branch beside the body has no head', () => {
  const model = fixture(), bones = model.Bones, mount = bones.find(b => b.Name === 'Mount Root');
  // Remove the mount's motion and skin evidence: it only groups a body and a weapon.
  delete mount.Rotation; for (const name of ['Mount Neck Link', 'Bone Mount Head']) bones.find(b => b.Name === name).Name = name.replace('Mount', 'Weapon');
  const rig = suggestPoseRig(model, 0, 0), role = named(model, rig);
  assert.equal(role('Bone_Head'), 'Head');
  assert.notEqual(role('Bone Weapon Head'), 'Head');
});

const flails = [process.env.MDLXL_FLAIL_MODEL, 'D:/Claude/research/fx-optimization-2026-10-30/fable-success/Fx_optimization_research/01_original/Fx_original.mdx', 'C:/Users/PC/Downloads/Fx_v4_clipfix_1.mdx'].filter(file => file && fs.existsSync(file));
test('the owner\'s flail model has one head and one body', { skip: !flails.length && 'flail model not present' }, () => {
  for (const file of flails) {
    const model = openDocument(fs.readFileSync(file)).model, sequence = Math.max(0, model.Sequences.findIndex(s => /^stand(?:\s|$)/i.test(s.Name))), rig = suggestPoseRig(model, model.Sequences[sequence].Interval[0], sequence), nodes = allNodes(model);
    const handles = rig.nodes.map(id => [nodes.find(n => n.ObjectId === id).Name, poseRole(model, rig, id, nodes)]);
    assert.deepEqual(handles.filter(([, r]) => r === 'Head').map(([n]) => n), ['Bone_Head'], path.basename(file));
    assert.ok(!handles.some(([n, r]) => r === 'Body' && /flail/i.test(n)), path.basename(file));
    assert.notEqual(poseRole(model, rig, nodes.find(n => n.Name === 'Flail_Head').ObjectId, nodes), 'Head');
  }
});

// Blizzard SD references (extracted from the game; absent in CI). Legitimate
// several-head structures keep every head handle; pieces of a head get none;
// bones that belong to no body become Object.
const corpus = process.env.MDLXL_SD_CORPUS || 'out/corpus-sd';
const expected = {
  'creeps__ogre.mdx': { keep: ['Bone_Head', 'Bone_Head01'] },
  'creeps__hydra.mdx': { keep: ['HeadL', 'HeadM', 'HeadR'] },
  'human__knight.mdx': { keep: ['Bone HorseBONE_HEAD', 'Bone_Head', 'Bone HorseBONE_HEAD01', 'Bone_T-Bone_Head'] },
  'orc__battroll.mdx': { keep: ['Bone_head', 'Bone_Head Rider'] },
  'human__mortarteam.mdx': { keep: ['Bone_Head', 'Bone_Head01'] },
  'nightelf__chimaera.mdx': { keep: ['Bone_Head', 'Bone_Head01'] },
  'creeps__sludgemonster.mdx': { keep: ['BONEBASE06'] },
  'creeps__quillbeast.mdx': { keep: ['Bone_head'] },
  'creeps__satyr.mdx': { keep: ['Bone_Head'] },
  'human__gryphonrider.mdx': { keep: ['Bone Griffon Head', 'Bone_Head'], drop: ['PonyTail C'] },
  'creeps__herotinkerrobot.mdx': { keep: [], drop: ['Bone_WrechHead'] },
  'creeps__razormane.mdx': { keep: ['Bone_Head'], drop: ['Geo_Weapon_head'] },
  'creeps__voidwalker.mdx': { keep: ['Bone_Head'], drop: ['Head Mesh02'] },
  'undead__herolich.mdx': { drop: ['Dummy01root'] },
};
test('Blizzard SD units keep real heads and bodies and lose false ones', { skip: !fs.existsSync(corpus) && 'SD corpus not present' }, () => {
  for (const [file, { keep = [], drop = [] }] of Object.entries(expected)) {
    const model = openDocument(fs.readFileSync(path.join(corpus, file))).model, sequence = Math.max(0, model.Sequences.findIndex(s => /^stand(?:\s|$)/i.test(s.Name)));
    const rig = suggestPoseRig(model, model.Sequences[sequence].Interval[0], sequence), nodes = allNodes(model), role = name => poseRole(model, rig, nodes.find(n => n.Name === name).ObjectId, nodes);
    const heads = rig.nodes.filter(id => poseRole(model, rig, id, nodes) === 'Head').map(id => nodes.find(n => n.ObjectId === id).Name);
    if (keep.length || file === 'creeps__herotinkerrobot.mdx') assert.deepEqual(heads.sort(), [...keep].sort(), file);
    for (const name of drop) assert.equal(role(name), 'Object', `${file}: ${name}`);
  }
  // Wing tips past a wing's end stay wings (dragons carry Hand refs there).
  const dragon = openDocument(fs.readFileSync(path.join(corpus, 'creeps__reddragon.mdx'))).model, rig = suggestPoseRig(dragon, dragon.Sequences[0].Interval[0], 0), nodes = allNodes(dragon);
  for (const name of ['WingR_05', 'WingR_07']) assert.equal(poseRole(dragon, rig, nodes.find(n => n.Name === name).ObjectId, nodes), 'Wing', name);
});
