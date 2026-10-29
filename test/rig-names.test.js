import test from 'node:test';
import assert from 'node:assert/strict';
import { nameTokens, WEAPON_WORDS, isWeaponName, nameSide, nameRegion } from '../src/rig-names.js';
import { nameSide as attachmentSide, planAttachments } from '../src/attachemator.js';
import { weaponCandidates, weaponChoices } from '../src/glow-up.js';

test('rig words split punctuation, spaces, digits, camelCase and acronyms', () => {
  assert.deepEqual(nameTokens('Bone_LeftHand_R02 SwordBlade'), ['bone', 'left', 'hand', 'r', 'sword', 'blade']);
  assert.deepEqual(nameTokens('XMLWeapon/Hand.R-2'), ['xml', 'weapon', 'hand', 'r']);
  assert.deepEqual(nameTokens('Grunt2_15AxeFree'), ['grunt', 'axe', 'free']);
  assert.deepEqual(nameTokens(null), []);
  assert.deepEqual(nameTokens('123__'), []);
});

test('weapons match complete rig words, never Elbow, Balance or Begun', () => {
  for (const name of ['Bone_Elbow_R', 'Bone_Balance', 'Bone_Begun', 'elbow', 'balance', 'begun', 'Bowl', 'Axel']) assert.equal(isWeaponName(name), false, name);
  for (const name of ['Bone_Sword_L', 'Weapon', 'Bow', 'Lance', 'Gun', 'Axe', 'Hammer', 'Shield', 'Staff', 'Grunt2_08Axe', 'SwordBlade']) assert.equal(isWeaponName(name), true, name);
  for (const word of WEAPON_WORDS) assert.equal(isWeaponName('Bone_' + word + '_01'), true, word);
  assert.equal(new Set(WEAPON_WORDS).size, WEAPON_WORDS.length);
  assert.equal(isWeaponName('ThrowArm', ['throw', 'arm']), true);
  assert.equal(isWeaponName('ThrowArm'), false);
  assert.equal(isWeaponName('Charm', ['arm']), false);
});

test('one side rule: full words, then initials, then compact rig sides', () => {
  for (const name of ['Bone_Hand_L', 'HandLeft', 'Left Hand', 'Bone FrontL Toe', 'handl', 'lhand']) assert.equal(nameSide(name), 'left', name);
  for (const name of ['Bone_Hand_R', 'HandRight', 'Right Hand', 'handr', 'handr02', 'rhand']) assert.equal(nameSide(name), 'right', name);
  assert.equal(nameSide('Bone_L_Right'), 'right');
  assert.equal(nameSide('Bone_R_Left'), 'left');
  for (const name of ['Bone_Root', 'Bright', 'Leftover', '', null]) assert.equal(nameSide(name), null, name);
  assert.equal(attachmentSide, nameSide);
});

test('regions share POSE roles and retain list and AnimXL body words', () => {
  for (const [name, region] of [['Bone_Chest','chest'], ['Torso','chest'], ['UpperBody','chest'], ['Spine02','chest'], ['Bone_Elbow_R','arm'], ['HandRight','arm'], ['handr','arm'], ['leftshin','leg'], ['Bone_Hoof','leg'], ['Face','head'], ['Neck','head'], ['Pelvis','pelvis'], ['Belly','pelvis'], ['Mesh01','other']]) assert.equal(nameRegion(name), region, name);
  for (const [name, role] of [['Chest','Chest'], ['Torso','Chest'], ['Spine','Spine'], ['Back','Spine'], ['Abdomen','Spine'], ['Neck','Neck'], ['Head','Head'], ['Body','Pelvis'], ['Foot','Foot'], ['Feet','Foot'], ['Hoof','Foot']]) assert.equal(nameRegion(name, { detailed: true }), role, name);
  assert.equal(nameRegion('Unclassified'), null);
  assert.equal(nameRegion('Sword', { detailed: true }), null);
});

function weaponFixture(names) {
  const Bones = names.map((Name, ObjectId) => ({ Name, ObjectId, Parent: null, PivotPoint: [0,0,0] }));
  const Geosets = Bones.map(bone => ({ Vertices: new Float32Array([0,-1,-1, 0,1,1, 60,-1,1, 60,1,-1]), VertexGroup: new Uint8Array(4), Groups: [[bone.ObjectId]], MaterialID: 0 }));
  return { Bones, Nodes: Bones, Geosets, Materials: [{ Layers: [{ FilterMode: 0 }] }] };
}

test('Glow Up keeps geometric candidates but gives no weapon-name bonus to false positives', () => {
  const candidates = weaponCandidates(weaponFixture(['Bone_Elbow_R', 'Bone_Balance', 'Bone_Begun', 'Bone_Sword_L']));
  assert.equal(candidates[0].name, 'Bone_Sword_L');
  for (const candidate of candidates.slice(1)) assert.equal(candidates[0].score - candidate.score, 4, candidate.name);
});

test('Glow Up pairs shared side spellings without merging numbered copies', () => {
  assert.ok(weaponChoices(weaponFixture(['SwordLeft', 'SwordRight']))[0].key.startsWith('pair-'));
  assert.ok(weaponChoices(weaponFixture(['Sword_L', 'Sword_R']))[0].key.startsWith('pair-'));
  assert.ok(!weaponChoices(weaponFixture(['Sword01_L', 'Sword02_R']))[0].key.startsWith('pair-'));
});

test('Attachemator chooses the sword over a larger Balance or Begun mesh', () => {
  for (const falseName of ['Bone_Balance', 'Bone_Begun', 'Bone_Elbow_R']) {
    const model = weaponFixture([falseName, 'Bone_Sword_L']);
    model.Geosets[0].Vertices = new Float32Array([0,-1,-1, 0,1,1, 120,-1,1, 120,1,-1]);
    const weapon = planAttachments(model).rows.find(row => row.key === 'weapon');
    assert.equal(weapon.parent, 1, falseName);
  }
});
