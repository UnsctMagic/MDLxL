// Bone Namer acceptance tests. Written BEFORE src/bone-namer.js, against the fixed API and rules in
// docs/agent-tasks/bone-namer.md (naming scheme, Recognition, Engine). Every expectation is derived from that
// contract and from the model data, never from the implementation.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { planBoneNames, nameBones, applyBoneNames, BONE_PARTS } from '../src/bone-namer.js';
import { parseCompatibleMdx } from '../src/mdx-compatibility.js';
import { suggestPoseRig, poseChainIds } from '../src/pose-ik.js';
import { standSequenceIndex } from '../src/sequence-editor.js';
import { nameTokens } from '../src/rig-names.js';
import { emptyModel, addBiped, addQuadruped, addNode, startGeoset, allBones, idOf, standardName, messyName } from './helpers/bone-namer-rigs.js';

const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const loadMdx = file => { assert.ok(file && fs.existsSync(file), `fixture missing: ${file}`); const b = fs.readFileSync(file); return parseCompatibleMdx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };

const rowsById = plan => new Map(plan.rows.map(row => [row.id, row]));
const nameIn = (plan, id) => rowsById(plan).get(id)?.name;
// Everything in a model except node names (typed arrays flattened), to prove only Name changed.
const snapshot = model => JSON.stringify(model, function (key, value) { if (key === 'Name' && this && 'ObjectId' in this) return undefined; return ArrayBuffer.isView(value) ? Array.from(value) : value; });
const names = model => model.Nodes.map(node => node.Name);

// Rules every plan must obey, whatever the model.
function assertGoodPlan(model, plan, label = '') {
  const isRig = id => model.Bones.includes(model.Nodes[id]) || model.Helpers.includes(model.Nodes[id]);
  const seen = new Set();
  for (const row of plan.rows) {
    assert.ok(isRig(row.id), `${label} only Bones and Helpers get rows (${model.Nodes[row.id].Name})`);
    assert.ok(!seen.has(row.id), `${label} one row per bone`); seen.add(row.id);
    assert.equal(row.current, model.Nodes[row.id].Name, `${label} row.current is the bone's name`);
    assert.ok(BONE_PARTS.includes(row.part), `${label} part ${row.part} is a known part`);
    assert.ok(new TextEncoder().encode(row.name).length <= 79, `${label} ${row.name} fits 79 bytes`);
    assert.ok(!/^(?:bone|helper)[ _-]*\d+$/i.test(row.name) || row.name === row.current, `${label} never a name like Bone_1: ${row.name}`);
    assert.ok(!nameTokens(row.name).some(token => token === 'w' || token === 'wep') || row.name === row.current, `${label} no lone W / Wep token: ${row.name}`);
    if (row.part === 'keep') assert.equal(row.name, row.current, `${label} keep rows keep their name`);
    if (['root', 'pelvis', 'spine', 'chest', 'neck', 'head', 'tail', 'keep'].includes(row.part)) assert.equal(row.side, null, `${label} ${row.part} has no side (${row.current})`);
  }
  // Every proposed new name is unique against every other node's final name.
  const changed = plan.rows.filter(row => row.name !== row.current), final = new Map(model.Nodes.map(node => [node.ObjectId, node.Name]));
  for (const row of changed) final.set(row.id, row.name);
  const counts = new Map(); for (const name of final.values()) counts.set(name, (counts.get(name) || 0) + 1);
  for (const row of changed) assert.equal(counts.get(row.name), 1, `${label} "${row.name}" is used once`);
}

// Check { currentName: newName } against a plan by exact current name.
function assertNames(model, plan, expected, label = '') {
  for (const [current, name] of Object.entries(expected)) {
    const id = idOf(model, current);
    assert.notEqual(id, undefined, `${label} model has "${current}"`);
    assert.equal(nameIn(plan, id), name, `${label} ${JSON.stringify(current)}`);
  }
}
const assertKept = (model, plan, currents, label = '') => { for (const current of currents) { const id = idOf(model, current); assert.notEqual(id, undefined, `${label} model has "${current}"`); assert.equal(nameIn(plan, id), current, `${label} ${current} keeps its name`); } };

test('the part list is the contract list, Keep name last', () => {
  assert.deepEqual([...BONE_PARTS], ['root', 'pelvis', 'spine', 'chest', 'neck', 'head', 'arm', 'hand', 'leg', 'foot', 'hoof', 'tail', 'wing', 'keep']);
});

// ---------------------------------------------------------------- made-up biped

test('a biped with junk names: every identified bone gets its scheme name', () => {
  const model = emptyModel(), id = addBiped(model, { name: messyName }), plan = planBoneNames(model);
  assert.equal(plan.error ?? null, null);
  assertGoodPlan(model, plan);
  const expected = { root: 'Bone_Root', pelvis: 'Bone_Pelvis', chest: 'Bone_Chest', head: 'Bone_Head', arm1L: 'Bone_Arm1_L', arm2L: 'Bone_Arm2_L', handL: 'Bone_Hand_L', arm1R: 'Bone_Arm1_R', arm2R: 'Bone_Arm2_R', handR: 'Bone_Hand_R', leg1L: 'Bone_Leg1_L', leg2L: 'Bone_Leg2_L', footL: 'Bone_Foot_L', leg1R: 'Bone_Leg1_R', leg2R: 'Bone_Leg2_R', footR: 'Bone_Foot_R' };
  for (const [key, name] of Object.entries(expected)) assert.equal(nameIn(plan, id[key]), name, key);
  assert.deepEqual(plan.actors.map(actor => actor.kind), ['main']);
  assert.equal(plan.actors[0].prefix ?? '', '');
  assert.equal(plan.actors[0].suffix ?? '', '');
});

test('part, side and position fields describe each row', () => {
  const model = emptyModel(), id = addBiped(model, { name: messyName }), rows = rowsById(planBoneNames(model));
  assert.deepEqual([rows.get(id.handL).part, rows.get(id.handL).side, rows.get(id.handL).position], ['hand', 'L', null]);
  assert.deepEqual([rows.get(id.leg2R).part, rows.get(id.leg2R).side, rows.get(id.leg2R).position], ['leg', 'R', null]);
  assert.deepEqual([rows.get(id.footR).part, rows.get(id.footR).side], ['foot', 'R']);
  assert.deepEqual([rows.get(id.chest).part, rows.get(id.chest).side], ['chest', null]);
  assert.deepEqual([rows.get(id.root).part, rows.get(id.pelvis).part, rows.get(id.head).part], ['root', 'pelvis', 'head']);
  assert.equal(rows.get(id.handL).name, 'Bone_Hand_L');
});

test('planning twice gives the same answer and never touches the model', () => {
  const model = emptyModel(); addBiped(model, { name: messyName });
  const before = JSON.stringify(model, (k, v) => ArrayBuffer.isView(v) ? Array.from(v) : v);
  const first = planBoneNames(model), second = planBoneNames(model);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(model, (k, v) => ArrayBuffer.isView(v) ? Array.from(v) : v), before);
});

test('left and right come from position (+Y is left), not from the old name', () => {
  const model = emptyModel(), id = addBiped(model, { name: standardName, swapSides: true }), plan = planBoneNames(model);
  assert.equal(model.Nodes[id.handL].Name, 'Bone_Hand_R', 'setup: the +Y hand is named R');
  assertGoodPlan(model, plan);
  for (const [key, name] of Object.entries({ arm1L: 'Bone_Arm1_L', arm2L: 'Bone_Arm2_L', handL: 'Bone_Hand_L', leg1L: 'Bone_Leg1_L', leg2L: 'Bone_Leg2_L', footL: 'Bone_Foot_L', arm1R: 'Bone_Arm1_R', handR: 'Bone_Hand_R', footR: 'Bone_Foot_R' })) assert.equal(nameIn(plan, id[key]), name, key);
});

test('a left hand named ..._R becomes Bone_Hand_L, and one named Right does too', () => {
  const model = emptyModel(), id = addBiped(model, { name: standardName, swapSides: true });
  assert.equal(model.Nodes[id.handL].Name, 'Bone_Hand_R');
  assert.equal(nameIn(planBoneNames(model), id.handL), 'Bone_Hand_L');
  const named = emptyModel(), ids = addBiped(named, { name: part => { const [key, side] = part.split('.'); return key === 'hand' ? `Hand_${side === 'L' ? 'Left' : 'Right'}` : standardName(part); }, swapSides: true });
  assert.equal(named.Nodes[ids.handL].Name, 'Hand_Right', 'setup: the +Y hand is named Right');
  const plan = planBoneNames(named);
  assert.equal(nameIn(plan, ids.handL), 'Bone_Hand_L');
  assert.equal(nameIn(plan, ids.handR), 'Bone_Hand_R');
});

test('Stand-pose positions decide the side, not the bind pivots', () => {
  const model = emptyModel(), id = addBiped(model, { name: messyName });
  const track = value => ({ LineType: 1, GlobalSeqId: null, Keys: [0, 1000].map(Frame => ({ Frame, Vector: new Float32Array(value) })) });
  model.Nodes[id.arm1L].Translation = track([0, -60, 0]); // in Stand the +Y arm stands at y -45...-35
  model.Nodes[id.arm1R].Translation = track([0, 60, 0]);
  const plan = planBoneNames(model);
  assert.equal(nameIn(plan, id.handL), 'Bone_Hand_R', 'the arm that stands on -Y in Stand is the right arm');
  assert.equal(nameIn(plan, id.arm1L), 'Bone_Arm1_R');
  assert.equal(nameIn(plan, id.handR), 'Bone_Hand_L');
  assert.equal(nameIn(plan, id.leg2L), 'Bone_Leg2_L', 'untouched legs keep their sides');
});

test('arm and leg bones are numbered from the body outward; the end is Hand / Foot', () => {
  const model = emptyModel(), id = addBiped(model, { name: messyName }), plan = planBoneNames(model);
  const depthOrder = chain => chain.map(key => nameIn(plan, id[key]));
  assert.deepEqual(depthOrder(['arm1L', 'arm2L', 'handL']), ['Bone_Arm1_L', 'Bone_Arm2_L', 'Bone_Hand_L']);
  assert.deepEqual(depthOrder(['leg1R', 'leg2R', 'footR']), ['Bone_Leg1_R', 'Bone_Leg2_R', 'Bone_Foot_R']);
});

test('Spine and Neck are numbered only when there are two or more', () => {
  const two = emptyModel(), a = addBiped(two, { name: messyName, spineLinks: 2, neckLinks: 2 }), planTwo = planBoneNames(two);
  assertGoodPlan(two, planTwo, 'two');
  const link = (model, text) => idOf(model, text);
  assert.equal(nameIn(planTwo, link(two, 'Link_spine_0')), 'Bone_Spine1', 'nearest the pelvis is Spine1');
  assert.equal(nameIn(planTwo, link(two, 'Link_spine_1')), 'Bone_Spine2');
  assert.equal(nameIn(planTwo, link(two, 'Link_neck_0')), 'Bone_Neck1', 'nearest the chest is Neck1');
  assert.equal(nameIn(planTwo, link(two, 'Link_neck_1')), 'Bone_Neck2');
  assert.equal(nameIn(planTwo, a.chest), 'Bone_Chest');
  const one = emptyModel(); addBiped(one, { name: messyName, spineLinks: 1, neckLinks: 1 });
  const planOne = planBoneNames(one);
  assert.equal(nameIn(planOne, idOf(one, 'Link_spine_0')), 'Bone_Spine');
  assert.equal(nameIn(planOne, idOf(one, 'Link_neck_0')), 'Bone_Neck');
});

test('trunk parts never get a side', () => {
  const model = emptyModel(); addBiped(model, { name: messyName, spineLinks: 2, neckLinks: 1 });
  for (const row of planBoneNames(model).rows) if (['root', 'pelvis', 'spine', 'chest', 'neck', 'head'].includes(row.part)) { assert.equal(row.side, null, row.current); assert.ok(!/_[LR]$/.test(row.name), row.name); }
});

// ---------------------------------------------------------------- quadrupeds

test('two leg pairs: Front / Rear before the side, hooves named Hoof', () => {
  const model = emptyModel(), id = addQuadruped(model), plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  const expected = { leg1_0L: 'Bone_Leg1_Front_L', leg2_0L: 'Bone_Leg2_Front_L', leg3_0L: 'Bone_Leg3_Front_L', hoof_0L: 'Bone_Hoof_Front_L', hoof_0R: 'Bone_Hoof_Front_R', leg1_1R: 'Bone_Leg1_Rear_R', leg3_1L: 'Bone_Leg3_Rear_L', hoof_1L: 'Bone_Hoof_Rear_L', hoof_1R: 'Bone_Hoof_Rear_R', root: 'Bone_Root', pelvis: 'Bone_Pelvis', chest: 'Bone_Chest', neck: 'Bone_Neck', head: 'Bone_Head' };
  for (const [key, name] of Object.entries(expected)) assert.equal(nameIn(plan, id[key]), name, key);
  const row = rowsById(plan).get(id.hoof_0L);
  assert.deepEqual([row.part, row.side, row.position], ['hoof', 'L', 'Front']);
  assert.equal(rowsById(plan).get(id.hoof_1R).position, 'Rear');
});

test('three leg pairs: Front, Middle, Rear', () => {
  const model = emptyModel(), id = addQuadruped(model, { pairs: [30, 2, -25] }), plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  assert.equal(nameIn(plan, id.hoof_0L), 'Bone_Hoof_Front_L');
  assert.equal(nameIn(plan, id.leg2_1R), 'Bone_Leg2_Middle_R');
  assert.equal(nameIn(plan, id.hoof_1L), 'Bone_Hoof_Middle_L');
  assert.equal(nameIn(plan, id.leg1_2L), 'Bone_Leg1_Rear_L');
});

test('four leg pairs: Front, Middle1, Middle2, Rear', () => {
  const model = emptyModel(), id = addQuadruped(model, { pairs: [40, 15, -10, -35] }), plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  assert.equal(nameIn(plan, id.hoof_0R), 'Bone_Hoof_Front_R');
  assert.equal(nameIn(plan, id.hoof_1L), 'Bone_Hoof_Middle1_L');
  assert.equal(nameIn(plan, id.hoof_2L), 'Bone_Hoof_Middle2_L');
  assert.equal(nameIn(plan, id.hoof_3R), 'Bone_Hoof_Rear_R');
});

test('one leg pair has no position word', () => {
  const model = emptyModel(), id = addQuadruped(model, { pairs: [10] }), plan = planBoneNames(model);
  assert.equal(nameIn(plan, id.hoof_0L), 'Bone_Hoof_L');
  assert.equal(nameIn(plan, id.leg1_0R), 'Bone_Leg1_R');
});

// ---------------------------------------------------------------- several actors

function riderOnMount({ copy = false } = {}) {
  const model = emptyModel();
  const mount = addQuadruped(model, { scale: 1.5 });
  const rider = addBiped(model, { name: messyName, oz: 60, ox: 10 });
  let twin = null;
  if (copy) { startGeoset(model, { hidden: true }); twin = addBiped(model, { name: part => standardName(part) + '2', ox: 400, oz: 60 }); }
  return { model, mount, rider, twin };
}

test('rider plain, larger mount prefixed Mount_', () => {
  const { model, mount, rider } = riderOnMount(), plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  assert.equal(nameIn(plan, rider.handL), 'Bone_Hand_L');
  assert.equal(nameIn(plan, rider.root), 'Bone_Root');
  assert.equal(nameIn(plan, rider.footR), 'Bone_Foot_R');
  assert.equal(nameIn(plan, mount.root), 'Bone_Mount_Root');
  assert.equal(nameIn(plan, mount.head), 'Bone_Mount_Head');
  assert.equal(nameIn(plan, mount.hoof_0L), 'Bone_Mount_Hoof_Front_L');
  assert.equal(nameIn(plan, mount.leg2_1R), 'Bone_Mount_Leg2_Rear_R');
  assert.deepEqual(plan.actors.map(actor => actor.kind), ['main', 'mount']);
  const mountActor = plan.actors[1];
  assert.equal(mountActor.body, mount.root);
  assert.equal(plan.actors[0].body, rider.root);
  assert.equal(rowsById(plan).get(mount.hoof_0L).actor, mount.root);
  assert.equal(rowsById(plan).get(rider.handL).actor, rider.root);
});

test('an identical-name actor hidden in Stand is a Copy with _Copy added to the main names', () => {
  const model = emptyModel(), main = addBiped(model, { name: messyName });
  startGeoset(model, { hidden: true });
  const twin = addBiped(model, { name: part => standardName(part) + '2', ox: 400 });
  const plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  assert.equal(nameIn(plan, main.handL), 'Bone_Hand_L', 'the visible rig is Main');
  assert.equal(nameIn(plan, twin.handL), 'Bone_Hand_L_Copy');
  assert.equal(nameIn(plan, twin.handR), 'Bone_Hand_R_Copy');
  assert.equal(nameIn(plan, twin.root), 'Bone_Root_Copy');
  assert.equal(nameIn(plan, twin.leg2L), 'Bone_Leg2_L_Copy');
  assert.deepEqual(plan.actors.map(actor => actor.kind), ['main', 'copy']);
  assert.equal(plan.actors[1].suffix, '_Copy');
  assert.equal(plan.actors[1].copyOf, main.root);
});

test('a further copy of the same kind adds a number: _Copy2', () => {
  const model = emptyModel(); addBiped(model, { name: messyName });
  startGeoset(model, { hidden: true }); const one = addBiped(model, { name: part => standardName(part) + '2', ox: 400 });
  startGeoset(model, { hidden: true }); const two = addBiped(model, { name: part => standardName(part) + '3', ox: 800 });
  const plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  assert.equal(nameIn(plan, one.handL), 'Bone_Hand_L_Copy');
  assert.equal(nameIn(plan, two.handL), 'Bone_Hand_L_Copy2');
});

test('a mount with its own hidden copy: the copy takes the Mount_ names plus _Copy', () => {
  const model = emptyModel(); const mount = addQuadruped(model, { scale: 1.5 }); addBiped(model, { name: messyName, oz: 60, ox: 10 });
  startGeoset(model, { hidden: true }); const twin = addQuadruped(model, { scale: 1.5, ox: 600, prefix: 'Bone Horse Spare ' });
  const plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  assert.equal(nameIn(plan, mount.hoof_0L), 'Bone_Mount_Hoof_Front_L');
  assert.equal(nameIn(plan, twin.hoof_0L), 'Bone_Mount_Hoof_Front_L_Copy');
});

test('a different, not larger actor is Extra_', () => {
  const model = emptyModel(), main = addBiped(model, { name: messyName });
  const small = addBiped(model, { name: part => standardName(part) + 'x', ox: 300, scale: .5, noPelvis: true });
  const plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  assert.equal(nameIn(plan, main.handL), 'Bone_Hand_L');
  assert.equal(nameIn(plan, small.handL), 'Bone_Extra_Hand_L');
  assert.deepEqual(plan.actors.map(actor => actor.kind), ['main', 'extra']);
});

// ---------------------------------------------------------------- corrections (never typed names)

test('overrides never mutate the model, the plan or the inputs', () => {
  const { model, rider } = riderOnMount(), plan = planBoneNames(model);
  const before = JSON.stringify([model, plan], (k, v) => ArrayBuffer.isView(v) ? Array.from(v) : v), parts = { [rider.handL]: 'foot' };
  const partsBefore = JSON.stringify(parts);
  nameBones(model, plan, { parts });
  assert.equal(JSON.stringify([model, plan], (k, v) => ArrayBuffer.isView(v) ? Array.from(v) : v), before);
  assert.equal(JSON.stringify(parts), partsBefore);
});

test('with no overrides nameBones gives the plan\'s own names', () => {
  const { model } = riderOnMount(), plan = planBoneNames(model);
  assert.deepEqual(nameBones(model, plan).map(row => [row.id, row.name]), plan.rows.map(row => [row.id, row.name]));
});

test('a wrongly included first leg joint set to Pelvis renumbers the thigh to Leg1 and the knee to Leg2', () => {
  const model = emptyModel(), id = addBiped(model, { name: standardName, leftLeg: 'extra', noPelvis: true }), plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  assert.deepEqual([id.extraL, id.leg1L, id.leg2L, id.footL].map(i => nameIn(plan, i)), ['Bone_Leg1_L', 'Bone_Leg2_L', 'Bone_Leg3_L', 'Bone_Foot_L'], 'POSE walks Bone01 into the leg, so it is Leg1 at first');
  assert.deepEqual([id.leg1R, id.leg2R, id.footR].map(i => nameIn(plan, i)), ['Bone_Leg1_R', 'Bone_Leg2_R', 'Bone_Foot_R']);
  const rows = nameBones(model, plan, { parts: { [id.extraL]: 'pelvis' } }), name = i => rows.find(row => row.id === i).name;
  assert.equal(name(id.extraL), 'Bone_Pelvis');
  assert.equal(name(id.leg1L), 'Bone_Leg1_L');
  assert.equal(name(id.leg2L), 'Bone_Leg2_L');
  assert.equal(name(id.footL), 'Bone_Foot_L');
  assert.equal(name(id.leg1R), 'Bone_Leg1_R', 'the other leg is untouched');
  assert.equal(rows.find(row => row.id === id.extraL).part, 'pelvis');
});

test('assigning a kept shin to Leg renumbers the bones below it', () => {
  const model = emptyModel(), id = addBiped(model, { name: standardName, leftLeg: 'missed', noPelvis: true }), plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  assert.equal(rowsById(plan).get(id.upperL).part, 'keep', 'POSE leaves the joint above its leg chain out');
  assert.equal(nameIn(plan, id.upperL), 'Upper_L');
  assert.deepEqual([id.linkL, id.leg2L, id.footL].map(i => nameIn(plan, i)), ['Bone_Leg1_L', 'Bone_Leg2_L', 'Bone_Foot_L']);
  const rows = nameBones(model, plan, { parts: { [id.upperL]: 'leg' } }), name = i => rows.find(row => row.id === i).name;
  assert.equal(name(id.upperL), 'Bone_Leg1_L', 'its side comes from where it stands (+Y)');
  assert.equal(name(id.linkL), 'Bone_Leg2_L');
  assert.equal(name(id.leg2L), 'Bone_Leg3_L');
  assert.equal(name(id.footL), 'Bone_Foot_L');
  assert.equal(name(id.leg1R), 'Bone_Leg1_R');
});

test('choosing Keep name for a recognised bone gives it its own name back', () => {
  const model = emptyModel(), id = addBiped(model, { name: messyName }), plan = planBoneNames(model);
  const rows = nameBones(model, plan, { parts: { [id.head]: 'keep' } }), head = rows.find(row => row.id === id.head);
  assert.equal(head.part, 'keep');
  assert.equal(head.name, model.Nodes[id.head].Name);
  assert.equal(rows.find(row => row.id === id.chest).name, 'Bone_Chest');
});

test('a side override flips _L and _R', () => {
  const model = emptyModel(), id = addBiped(model, { name: messyName }), plan = planBoneNames(model);
  const sides = {};
  for (const key of ['arm1L', 'arm2L', 'handL']) sides[id[key]] = { side: 'R', position: null };
  for (const key of ['arm1R', 'arm2R', 'handR']) sides[id[key]] = { side: 'L', position: null };
  const rows = nameBones(model, plan, { sides }), name = i => rows.find(row => row.id === i).name;
  assert.deepEqual(['arm1L', 'arm2L', 'handL'].map(k => name(id[k])), ['Bone_Arm1_R', 'Bone_Arm2_R', 'Bone_Hand_R']);
  assert.deepEqual(['arm1R', 'arm2R', 'handR'].map(k => name(id[k])), ['Bone_Arm1_L', 'Bone_Arm2_L', 'Bone_Hand_L']);
  assert.equal(name(id.footL), 'Bone_Foot_L', 'other limbs are untouched');
  assert.equal(rows.find(row => row.id === id.handL).side, 'R');
});

test('a position override moves a leg pair from Front to Rear', () => {
  const model = emptyModel(), id = addQuadruped(model), plan = planBoneNames(model), sides = {};
  for (const side of ['L', 'R']) for (const leg of ['leg1', 'leg2', 'leg3', 'hoof']) sides[id[`${leg}_0${side}`]] = { side, position: 'Rear' };
  for (const side of ['L', 'R']) for (const leg of ['leg1', 'leg2', 'leg3', 'hoof']) sides[id[`${leg}_1${side}`]] = { side, position: 'Front' };
  const rows = nameBones(model, plan, { sides }), name = i => rows.find(row => row.id === i).name;
  assert.equal(name(id.hoof_0L), 'Bone_Hoof_Rear_L');
  assert.equal(name(id.leg1_1R), 'Bone_Leg1_Front_R');
});

test('an actor override making the mount Main swaps the prefixes', () => {
  const { model, mount, rider } = riderOnMount(), plan = planBoneNames(model);
  const rows = nameBones(model, plan, { actors: { [mount.root]: 'main' } }), name = i => rows.find(row => row.id === i).name;
  assert.equal(name(mount.hoof_0L), 'Bone_Hoof_Front_L');
  assert.equal(name(mount.root), 'Bone_Root');
  assert.equal(name(rider.handL), 'Bone_Mount_Hand_L');
  assert.equal(name(rider.root), 'Bone_Mount_Root');
});

test('an actor override can make the mount an Extra_', () => {
  const { model, mount } = riderOnMount(), plan = planBoneNames(model);
  const rows = nameBones(model, plan, { actors: { [mount.root]: 'extra' } });
  assert.equal(rows.find(row => row.id === mount.hoof_0L).name, 'Bone_Extra_Hoof_Front_L');
});

// ---------------------------------------------------------------- what is never renamed

test('bones POSE does not identify keep their name; attachments and emitters are never renamed', () => {
  const model = emptyModel(), id = addBiped(model, { name: messyName });
  const cape = addNode(model, 'Cape_01', id.chest, [-5, 0, 58]);
  const sword = addNode(model, 'Sword_Blade', id.handR, [0, -25, 30]);
  const ref = addNode(model, 'Hand Left Ref', id.handL, [0, 25, 36], { list: 'Attachments' });
  const emitter = addNode(model, 'Dust Emitter', id.footL, [2, 9, 0], { list: 'ParticleEmitters2' });
  const plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  for (const kept of [cape, sword]) { assert.equal(rowsById(plan).get(kept).part, 'keep'); assert.equal(nameIn(plan, kept), model.Nodes[kept].Name); }
  for (const other of [ref, emitter]) assert.equal(rowsById(plan).get(other), undefined, `${model.Nodes[other].Name} has no row`);
  assert.equal(nameIn(plan, id.handL), 'Bone_Hand_L');
});

test('chain-like and cloth bones keep their names', () => {
  const model = emptyModel(), id = addBiped(model, { name: messyName });
  const extras = ['Rein_Left', 'Chain_01', 'Cloth_Front', 'Beard_01'].map((name, i) => addNode(model, name, id.chest, [i, 0, 55]));
  const plan = planBoneNames(model);
  for (const extra of extras) assert.equal(nameIn(plan, extra), model.Nodes[extra].Name);
});

// ---------------------------------------------------------------- uniqueness and name hygiene

test('a new name already used by another bone gets a unique variant and the other keeps its name', () => {
  const model = emptyModel(), id = addBiped(model, { name: messyName });
  const taken = addNode(model, 'Bone_Arm1_L', id.chest, [-5, 0, 50]);
  const plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  assert.equal(nameIn(plan, taken), 'Bone_Arm1_L', 'the existing holder is not touched');
  const shoulder = nameIn(plan, id.arm1L);
  assert.notEqual(shoulder, 'Bone_Arm1_L');
  assert.ok(shoulder.startsWith('Bone_Arm1_L'), shoulder);
});

test('a new name already used by a non-bone node is also avoided', () => {
  const model = emptyModel(), id = addBiped(model, { name: messyName });
  addNode(model, 'Bone_Head', id.head, [0, 0, 82], { list: 'Attachments' });
  const plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  assert.notEqual(nameIn(plan, id.head), 'Bone_Head');
  assert.ok(nameIn(plan, id.head).startsWith('Bone_Head'));
});

test('every proposed name fits 79 UTF-8 bytes even beside long, multi-byte names', () => {
  const model = emptyModel(), id = addBiped(model, { name: part => messyName(part) });
  addNode(model, 'é'.repeat(39), id.chest, [3, 0, 50]);
  const plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  assert.equal(plan.rows.find(row => row.current === 'é'.repeat(39)).name, 'é'.repeat(39));
});

test('no proposed name is a lone W / Wep token or a bare Bone_1', () => {
  for (const build of [() => { const m = emptyModel(); addBiped(m, { name: messyName, spineLinks: 2, neckLinks: 2 }); return m; }, () => { const m = emptyModel(); addQuadruped(m, { pairs: [40, 15, -10, -35] }); return m; }]) {
    const model = build(), plan = planBoneNames(model);
    assertGoodPlan(model, plan);
    for (const row of plan.rows) assert.ok(!/^(?:bone|helper)[ _-]*\d+$/i.test(row.name), row.name);
  }
});

// ---------------------------------------------------------------- applyBoneNames

test('commit renames exactly the chosen rows and changes only Name', () => {
  const model = emptyModel(), id = addBiped(model, { name: messyName });
  addNode(model, 'Hand Left Ref', id.handL, [0, 25, 36], { list: 'Attachments' });
  const plan = planBoneNames(model), before = snapshot(model), originalNames = names(model);
  const chosen = new Set(plan.rows.filter(row => row.name !== row.current).map(row => row.id));
  assert.ok(chosen.size >= 12);
  const result = applyBoneNames(model, plan.rows, chosen);
  assert.equal(result.changed, chosen.size);
  assert.equal(snapshot(model), before, 'nothing but node names changed (hierarchy, pivots, geosets, tracks)');
  model.Nodes.forEach((node, i) => assert.equal(node.Name, chosen.has(i) ? nameIn(plan, i) : originalNames[i], `node ${i}`));
  assert.equal(model.Nodes[id.handL].Name, 'Bone_Hand_L');
  assert.equal(model.Attachments[0].Name, 'Hand Left Ref');
});

test('commit leaves unchosen rows alone', () => {
  const model = emptyModel(), id = addBiped(model, { name: messyName }), plan = planBoneNames(model);
  const result = applyBoneNames(model, plan.rows, new Set([id.handL, id.footR]));
  assert.equal(result.changed, 2);
  assert.equal(model.Nodes[id.handL].Name, 'Bone_Hand_L');
  assert.equal(model.Nodes[id.footR].Name, 'Bone_Foot_R');
  assert.equal(model.Nodes[id.handR].Name, messyName('hand.R'));
  assert.equal(model.Nodes[id.root].Name, messyName('root'));
});

test('after a full commit planning again changes nothing', () => {
  const model = emptyModel(); addBiped(model, { name: messyName, spineLinks: 2 });
  const plan = planBoneNames(model);
  applyBoneNames(model, plan.rows, new Set(plan.rows.filter(row => row.name !== row.current).map(row => row.id)));
  const again = planBoneNames(model);
  assert.equal(again.rows.filter(row => row.name !== row.current).length, 0);
  assert.equal(nameIn(again, idOf(model, 'Bone_Hand_L')), 'Bone_Hand_L');
});

test('commit is all or nothing when one row is invalid', () => {
  for (const bad of ['', '   ', 'x'.repeat(80), 'é'.repeat(40)]) {
    const model = emptyModel(); addBiped(model, { name: messyName });
    const plan = planBoneNames(model), changing = plan.rows.filter(row => row.name !== row.current);
    const rows = plan.rows.map(row => ({ ...row })); rows.find(row => row.id === changing.at(-1).id).name = bad;
    const before = names(model);
    assert.throws(() => applyBoneNames(model, rows, new Set(changing.map(row => row.id))), undefined, JSON.stringify(bad));
    assert.deepEqual(names(model), before, `no bone renamed after the failure for ${JSON.stringify(bad)}`);
  }
});

// ---------------------------------------------------------------- fix round 1 engine rules

// Commits every changed default row on a scratch model, then plans again: nothing may want to change.
function assertStable(model, label) {
  const plan = planBoneNames(model), chosen = new Set(plan.rows.filter(row => row.name !== row.current).map(row => row.id));
  applyBoneNames(model, plan.rows, chosen);
  const again = planBoneNames(model), moving = again.rows.filter(row => row.name !== row.current).map(row => `${row.current} -> ${row.name}`);
  assert.deepEqual(moving, [], `${label}: planning a model Bone Namer already renamed proposes nothing`);
}

test('rule 1: a hub joint above both legs keeps its name and the legs number from the thigh', () => {
  const model = emptyModel(), id = addBiped(model, { name: standardName, hub: true }), plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  assert.equal(model.Nodes[id.hub].Name, 'Bone01');
  assert.equal(rowsById(plan).get(id.hub).part, 'keep', 'POSE runs both legs through Bone01; it is a hub');
  assert.equal(nameIn(plan, id.hub), 'Bone01');
  assert.deepEqual(['leg1L', 'leg2L', 'footL', 'leg1R', 'leg2R', 'footR'].map(key => nameIn(plan, id[key])), ['Bone_Leg1_L', 'Bone_Leg2_L', 'Bone_Foot_L', 'Bone_Leg1_R', 'Bone_Leg2_R', 'Bone_Foot_R']);
});

test('rule 3: the body that carries a follower is never Main, even when only it is visible in Stand', () => {
  const model = emptyModel(), mount = addQuadruped(model, { scale: 1.5 });
  const carrier = addNode(model, 'Bone Horse Carrier Body', null, [...model.Nodes[mount.root].PivotPoint], { mesh: false });
  startGeoset(model, { hidden: true });
  const rider = addBiped(model, { name: messyName, parent: carrier, oz: 60, ox: 10 });
  const plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  assert.equal(nameIn(plan, mount.hoof_0L), 'Bone_Mount_Hoof_Front_L', 'the mount (a rig.followers key) is not Main');
  assert.equal(nameIn(plan, rider.handL), 'Bone_Hand_L', 'the rider is Main although hidden in Stand');
  assert.deepEqual(plan.actors.map(actor => actor.kind), ['main', 'mount']);
  assert.equal(plan.actors[0].body, rider.root);
});

test('rule 4: a Body-named bone inside one creature (no limbs of its own) is not an actor and keeps its name', () => {
  const model = emptyModel(), id = addBiped(model, { name: messyName, abdomen: true }), plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  assert.equal(plan.actors.length, 1, 'one creature, one actor');
  assert.equal(rowsById(plan).get(id.abdomen).part, 'keep');
  assert.equal(nameIn(plan, id.abdomen), 'Bone_Abdomen');
  assert.equal(nameIn(plan, id.root), 'Bone_Root');
  assert.equal(nameIn(plan, id.chest), 'Bone_Chest');
  assert.equal(nameIn(plan, id.handL), 'Bone_Hand_L');
  assert.ok(plan.rows.every(row => !/^Bone_(?:Extra|Mount)/.test(row.name)), 'no row is pushed into an Extra / Mount actor');
});

test('rule 4: a rider with its own limbs stays its own actor', () => {
  const { model, rider } = riderOnMount(), plan = planBoneNames(model);
  assert.deepEqual(plan.actors.map(actor => actor.body).sort(), [rider.root, ...[plan.actors.find(actor => actor.kind === 'mount').body]].sort());
  assert.equal(plan.actors.length, 2);
});

test('rule 5: a limb ending at an attachment keeps Arm numbers on its bones; the attachment is untouched', () => {
  const model = emptyModel(), id = addBiped(model, { name: messyName, attachArms: true }), plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  assert.equal(nameIn(plan, id.arm1R), 'Bone_Arm1_R');
  assert.equal(nameIn(plan, id.arm2R), 'Bone_Arm2_R', 'Forearm_R has no Hand role, so it takes the next Arm number');
  assert.equal(nameIn(plan, id.handL), 'Bone_Hand_L');
  assert.equal(rowsById(plan).get(id.refR), undefined);
  assert.equal(model.Nodes[id.refR].Name, 'Hand Right Ref');
});

test('rule 6: Arm numbers restart for each limb; a second left arm is Arm1, Arm2, Hand, never Arm3 / Arm4', () => {
  const model = emptyModel(), id = addBiped(model, { name: messyName, extraArm: true }), plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  for (const row of plan.rows) assert.ok(!/Arm[34]/.test(row.name), `${row.current} -> ${row.name}`);
  const first = nameIn(plan, id.arm1L), second = nameIn(plan, id.xarm1);
  assert.ok(first.startsWith('Bone_Arm1_L') && second.startsWith('Bone_Arm1_L') && first !== second, `${first} / ${second}`);
  assert.ok(nameIn(plan, id.arm2L).startsWith('Bone_Arm2_L') && nameIn(plan, id.xarm2).startsWith('Bone_Arm2_L'));
  assert.ok(nameIn(plan, id.handL).startsWith('Bone_Hand_L') && nameIn(plan, id.xhand).startsWith('Bone_Hand_L'));
  assert.equal(nameIn(plan, id.arm1R), 'Bone_Arm1_R', 'the right arm is untouched');
});

test('rule 7: made-up rigs are stable - committing the defaults and planning again proposes nothing', () => {
  const builds = {
    'junk biped': () => { const m = emptyModel(); addBiped(m, { name: messyName }); return m; },
    'swapped sides with spine and neck': () => { const m = emptyModel(); addBiped(m, { name: standardName, swapSides: true, spineLinks: 2, neckLinks: 2 }); return m; },
    quadruped, 'three pairs': () => { const m = emptyModel(); addQuadruped(m, { pairs: [30, 2, -25] }); return m; },
    'rider on mount': () => riderOnMount().model,
    'rig copy': () => riderOnMount({ copy: true }).model,
    'extra leg joint': () => { const m = emptyModel(); addBiped(m, { name: standardName, leftLeg: 'extra', noPelvis: true }); return m; },
    'hub': () => { const m = emptyModel(); addBiped(m, { name: standardName, hub: true }); return m; },
    'abdomen': () => { const m = emptyModel(); addBiped(m, { name: messyName, abdomen: true }); return m; },
    'two left arms': () => { const m = emptyModel(); addBiped(m, { name: messyName, extraArm: true }); return m; },
    'attachment arm': () => { const m = emptyModel(); addBiped(m, { name: messyName, attachArms: true }); return m; },
  };
  function quadruped() { const m = emptyModel(); addQuadruped(m); return m; }
  for (const [label, build] of Object.entries(builds)) assertStable(build(), label);
});

// ---------------------------------------------------------------- real models

test('native Footman: the left hand named Bone_Hand_R becomes Bone_Hand_L; the right arm ends at an attachment', () => {
  const model = loadMdx(fixturePath('footman')), plan = planBoneNames(model);
  assert.equal(plan.error ?? null, null);
  assertGoodPlan(model, plan, 'footman');
  const hand = idOf(model, 'Bone_Hand_R');
  assert.equal(model.Nodes[model.Nodes[hand].Parent].Name, 'Bone_Arm2_L', 'setup: this hand is on the left arm');
  assertNames(model, plan, { Bone_Hand_R: 'Bone_Hand_L', Bone_Root: 'Bone_Root', Bone_Pelvis: 'Bone_Pelvis', Bone_Chest: 'Bone_Chest', Bone_Head: 'Bone_Head', Bone_Arm1_L: 'Bone_Arm1_L', Bone_Arm2_L: 'Bone_Arm2_L', Bone_Arm1_R: 'Bone_Arm1_R', Bone_Arm2_R: 'Bone_Arm2_R', Bone_Leg1_L: 'Bone_Leg1_L', Bone_Leg2_L: 'Bone_Leg2_L', Bone_Foot_L: 'Bone_Foot_L', Bone_Leg1_R: 'Bone_Leg1_R', Bone_Leg2_R: 'Bone_Leg2_R', Bone_Foot_R: 'Bone_Foot_R' }, 'footman');
  assert.ok(model.Attachments.some(node => node.Name.trim() === 'Hand Right Ref'), 'setup: the attachment exists');
  for (const node of model.Attachments) assert.equal(rowsById(plan).get(node.ObjectId), undefined, `${node.Name} is not renamed`);
  assertKept(model, plan, ['Box04', 'handle', 'Mesh02', 'Cantine', 'Cone11', 'Object04'], 'footman');
  assert.deepEqual(plan.actors.map(actor => actor.kind), ['main']);
  // Only the one hand actually changes name.
  assert.deepEqual(plan.rows.filter(row => row.name !== row.current).map(row => [row.current, row.name]), [['Bone_Hand_R', 'Bone_Hand_L']]);
});

test('native Footman: committing changes one name and nothing else', () => {
  const model = loadMdx(fixturePath('footman')), plan = planBoneNames(model), before = snapshot(model);
  const result = applyBoneNames(model, plan.rows, new Set(plan.rows.filter(row => row.name !== row.current).map(row => row.id)));
  assert.equal(result.changed, 1);
  assert.equal(snapshot(model), before);
  assert.ok(allBones(model).some(node => node.Name === 'Bone_Hand_L'));
  assert.ok(!allBones(model).some(node => node.Name === 'Bone_Hand_R'), 'the old left-hand name is gone');
});

test('native Knight: rider plain, horse Mount_ with Front / Rear hooves, hidden rig copies get _Copy', () => {
  const model = loadMdx(fixturePath('hoofprint')), plan = planBoneNames(model);
  assert.equal(plan.error ?? null, null);
  assertGoodPlan(model, plan, 'knight');
  // The rider (two hands, skin shown in Stand) is Main; its trailing-space names are cleaned.
  assertNames(model, plan, { Bone_Root: 'Bone_Root', Bone_Chest: 'Bone_Chest', Bone_Head: 'Bone_Head', 'Bone_Arm1_R ': 'Bone_Arm1_R', Bone_Arm2_R: 'Bone_Arm2_R', 'Bone_Hand_R ': 'Bone_Hand_R', Bone_Arm1_L: 'Bone_Arm1_L', Bone_Arm2_L: 'Bone_Arm2_L', 'Bone_Hand_R 01': 'Bone_Hand_L', Object11: 'Bone_Leg1_R', Bone_Leg2_R: 'Bone_Leg2_R', Object13: 'Bone_Foot_R', Object14: 'Bone_Leg1_L', Bone_Leg2_L: 'Bone_Leg2_L', Object16: 'Bone_Foot_L' }, 'rider');
  // The horse: larger, no hands -> Mount_.
  assertNames(model, plan, {
    'Bone HorseBONE_ABDOMEN': 'Bone_Mount_Root', 'Bone HorseBONE_PELVIS': 'Bone_Mount_Pelvis', 'Bone HorseBONE_CHEST': 'Bone_Mount_Chest', 'Bone HorseBONE_NECK': 'Bone_Mount_Neck', 'Bone HorseBONE_HEAD': 'Bone_Mount_Head', 'Bone HorseBONE_TAIL1': 'Bone_Mount_Tail1',
    'Bone HorseBone_Leg1_Front_R': 'Bone_Mount_Leg1_Front_R', 'Bone HorseBone_Leg2_Front_R': 'Bone_Mount_Leg2_Front_R', 'Bone HorseBone_Leg3_Front_R': 'Bone_Mount_Leg3_Front_R', 'Bone HorseBone_Hoof_Front_R': 'Bone_Mount_Hoof_Front_R',
    'Bone HorseBone_Leg1_Front_L': 'Bone_Mount_Leg1_Front_L', 'Bone HorseBone_Leg3_Front_L\\': 'Bone_Mount_Leg3_Front_L', 'Bone HorseBone_Hoof_Front_L': 'Bone_Mount_Hoof_Front_L',
    'Bone HorseBone_Leg1_Rear_R': 'Bone_Mount_Leg1_Rear_R', 'Bone HorseBone_Hoof_Rear_R': 'Bone_Mount_Hoof_Rear_R', 'Bone HorseBone_Leg2_Rear_L': 'Bone_Mount_Leg2_Rear_L', 'Bone HorseBone_Hoof_Rear_L': 'Bone_Mount_Hoof_Rear_L',
  }, 'horse');
  // The hidden copies take the Main / Mount names plus _Copy.
  assertNames(model, plan, {
    'Bone_T-Bone_Root': 'Bone_Root_Copy', 'Bone_T-Bone_Chest': 'Bone_Chest_Copy', 'Bone_T-Bone_Head': 'Bone_Head_Copy', 'Bone_T-Bone_Arm1_R': 'Bone_Arm1_R_Copy', 'Bone_T-Bone_Hand_R ': 'Bone_Hand_R_Copy', 'Bone_T-Bone_Hand_R 01': 'Bone_Hand_L_Copy', 'T-Object11': 'Bone_Leg1_R_Copy', 'T-Object13': 'Bone_Foot_R_Copy',
    'Bone HorseBONE_ABDOMEN01': 'Bone_Mount_Root_Copy', 'Bone HorseBone_Hoof_Front_L01': 'Bone_Mount_Hoof_Front_L_Copy', 'Bone HorseBone_Leg2_Rear_R01': 'Bone_Mount_Leg2_Rear_R_Copy', 'Bone HorseBONE_TAIL02': 'Bone_Mount_Tail1_Copy',
  }, 'copies');
  assertKept(model, plan, ['gutz00', 'Portrait Head', 'Mustache', 'Death Portrait', 'T_Object11'], 'knight');
  const kinds = plan.actors.map(actor => actor.kind);
  assert.deepEqual(kinds.slice(0, 2), ['main', 'mount']);
  assert.equal(kinds.filter(kind => kind === 'copy').length, 2);
  assert.equal(kinds.length, 4);
});

test('owner\'s Slaanesh Champion: rider under the Death root is Main, horse is Mount_, the Death root keeps its name', () => {
  const model = loadMdx(fixturePath('slaanesh-champion')), plan = planBoneNames(model);
  assert.equal(plan.error ?? null, null);
  assertGoodPlan(model, plan, 'champion');
  assertNames(model, plan, { Bone_Root: 'Bone_Root', Bone_Chest: 'Bone_Chest', Bone_Head: 'Bone_Head', Bone_Arm1_L: 'Bone_Arm1_L', Bone_Arm2_L: 'Bone_Arm2_L', Bone_Hand_L: 'Bone_Hand_L', 'Bone_Arm1_R ': 'Bone_Arm1_R', Bone_Arm2_R: 'Bone_Arm2_R', 'Bone_Hand_R ': 'Bone_Hand_R', Object11: 'Bone_Leg1_R', Object13: 'Bone_Foot_R', Object14: 'Bone_Leg1_L', Object16: 'Bone_Foot_L', Bone_Leg2_R: 'Bone_Leg2_R', Bone_Leg2_L: 'Bone_Leg2_L' }, 'rider');
  assertNames(model, plan, { 'Bone HorseBONE_ABDOMEN': 'Bone_Mount_Root', 'Bone HorseBONE_PELVIS': 'Bone_Mount_Pelvis', 'Bone HorseBONE_CHEST': 'Bone_Mount_Chest', 'Bone HorseBONE_NECK': 'Bone_Mount_Neck', 'Bone HorseBONE_HEAD': 'Bone_Mount_Head', 'Bone HorseBONE_TAIL1': 'Bone_Mount_Tail1', 'Bone HorseBone_Hoof_Front_R': 'Bone_Mount_Hoof_Front_R', 'Bone HorseBone_Hoof_Front_L': 'Bone_Mount_Hoof_Front_L', 'Bone HorseBone_Hoof_Rear_R': 'Bone_Mount_Hoof_Rear_R', 'Bone HorseBone_Hoof_Rear_L': 'Bone_Mount_Hoof_Rear_L', 'Bone HorseBone_Leg1_Front_L': 'Bone_Mount_Leg1_Front_L', 'Bone HorseBone_Leg3_Rear_R': 'Bone_Mount_Leg3_Rear_R' }, 'horse');
  assertKept(model, plan, ['Bone HorseBONE_ABDOMEN_Death', 'Cape', 'Axe', 'Dummy02', 'Portrait Head', 'Plane04'], 'champion');
  assert.deepEqual(plan.actors.map(actor => actor.kind), ['main', 'mount']);
});

test('Lahmian: the visible Root rig is Main with standard names; cloth, spear, face and sway root keep theirs', () => {
  const model = loadMdx(fixturePath('lahmian')), plan = planBoneNames(model);
  assert.equal(plan.error ?? null, null);
  assertGoodPlan(model, plan, 'lahmian');
  assertNames(model, plan, { Root: 'Bone_Root', Chest: 'Bone_Chest', Neck: 'Bone_Neck', Head: 'Bone_Head', Should_R: 'Bone_Arm1_R', Elbow_R: 'Bone_Arm2_R', Wrist_R: 'Bone_Hand_R', Should_L: 'Bone_Arm1_L', Elbow_L: 'Bone_Arm2_L', Wrist_L: 'Bone_Hand_L' }, 'lahmian');
  assertKept(model, plan, ['Root sway', 'Spear', 'Jaw', 'Eye_L', 'Smile_R', 'HairBack_1', 'ArmCloth_R_1', 'ClothCurve_R_04', 'ClothCurve_L_07', 'Waist', 'Flaps', 'Hero1', 'DummyBone'], 'lahmian');
  assert.equal(plan.actors[0].kind, 'main');
  assert.equal(plan.actors[0].body, idOf(model, 'Root'), 'Root is the Main actor: its skin shows in Stand, the Caspette rig is hidden there');
  for (const name of ['Casp_hand_R', 'Casp_Hand_L', 'Casp_Chest', 'Casp_head']) assert.match(nameIn(plan, idOf(model, name)), /^Bone_(?:Mount|Extra)\d*_|_Copy\d*$/, `${name} belongs to a second actor, never the unprefixed Main`);
  assert.ok(plan.actors.length >= 2);
});

test('real models: committing the default plan changes only names and uses each new name once', () => {
  for (const key of ['hoofprint', 'slaanesh-champion', 'lahmian']) {
    const model = loadMdx(fixturePath(key)), plan = planBoneNames(model), before = snapshot(model);
    const chosen = new Set(plan.rows.filter(row => row.name !== row.current).map(row => row.id));
    const result = applyBoneNames(model, plan.rows, chosen);
    assert.equal(result.changed, chosen.size, key);
    assert.equal(snapshot(model), before, `${key}: only names changed`);
    for (const row of plan.rows.filter(row => chosen.has(row.id))) assert.equal(model.Nodes[row.id].Name, row.name, key);
  }
});

test('rule 7: real models are stable - committing the defaults and planning again proposes nothing', () => {
  for (const key of ['footman', 'hoofprint', 'slaanesh-champion', 'lahmian']) assertStable(loadMdx(fixturePath(key)), key);
});

test('rule 7: SD sheep is stable - a second run no longer renames Bone_Foot_L to Bone_Leg2_L', () => {
  assertStable(loadMdx(fixturePath('sd800-sheep')), 'sheep');
});

test('rule 5: Archnathid - both arms end in Bone_Hand_*, although the right arm ends at the attachment Hand Right Ref', () => {
  const model = loadMdx(fixturePath('sd800-archnathid')), plan = planBoneNames(model);
  assertGoodPlan(model, plan, 'archnathid');
  assert.ok(model.Attachments.some(node => node.Name.trim() === 'Hand Right Ref'), 'setup: the attachment exists');
  for (const node of model.Attachments) assert.equal(rowsById(plan).get(node.ObjectId), undefined, node.Name);
  assertNames(model, plan, { 'Bone CLAW L': 'Bone_Hand_L', 'Bone CLAW R': 'Bone_Hand_R', 'Bone Arm L': 'Bone_Arm1_L', 'Bone Arm R': 'Bone_Arm1_R' }, 'archnathid');
  assertKept(model, plan, ['Bone_Box23'], 'archnathid (hub above the right arm)');
});

test('rule 12: a limb end POSE grips by its skin is named Mesh_…, and POSE still grips that end after commit', () => {
  const model = loadMdx(fixturePath('sd-bandit')), end = idOf(model, 'HandRight');
  const gripped = m => { const s = standSequenceIndex(m), rig = suggestPoseRig(m, m.Sequences[s].Interval[0], s); return rig.chains.filter(chain => chain.grip).map(chain => chain.end); };
  assert.deepEqual(gripped(model), [end], 'setup: POSE grips HandRight (a mesh node) and nothing else');
  const plan = planBoneNames(model);
  assertGoodPlan(model, plan, 'bandit');
  assert.equal(nameIn(plan, end), 'Mesh_Hand_L', 'the gripped end sits on +Y and keeps the Mesh_ word, not Bone_');
  assertNames(model, plan, { Bone_Arm1_R: 'Bone_Arm1_L', Bone_Arm2_R: 'Bone_Arm2_L', Bone_Arm1_L: 'Bone_Arm1_R', Bone_Arm2_L: 'Bone_Arm2_R', Bone_Hand_R: 'Bone_Hand_R', Bone_Leg1_R: 'Bone_Leg1_L', Bone_Foot_R: 'Bone_Foot_L', Bone_Leg1_L: 'Bone_Leg1_R', Bone_Foot_L: 'Bone_Foot_R' }, 'bandit');
  // Blizzard's Bandit names its legs from the viewer's side as well as its arms: in Stand
  // Bone_Leg1_R/Bone_Foot_R sit on +Y (y 7.7 / 15.6) and Bone_Leg1_L/Bone_Foot_L on -Y (-3.0 / -14.5).
  applyBoneNames(model, plan.rows, new Set(plan.rows.filter(row => row.name !== row.current).map(row => row.id)));
  assert.equal(model.Nodes[end].Name, 'Mesh_Hand_L');
  assert.deepEqual(gripped(model), [end], 'after the rename POSE still grips the same end by its skin');
});

// Round 3: a limb POSE labels Wing from shape alone (three sibling pivots at the end) while its joints are anonymous.
function wingRig(names, { ref = false } = {}) {
  const model = emptyModel(), id = addBiped(model, { name: messyName });
  [id.arm1L, id.arm2L, id.handL].forEach((bone, i) => { model.Nodes[bone].Name = names[i]; });
  const pivot = [...model.Nodes[id.handL].PivotPoint];
  addNode(model, 'Feather_1', id.arm2L, pivot); addNode(model, 'Feather_2', id.arm2L, pivot);
  if (ref) addNode(model, 'Hand Left Ref', id.handL, pivot, { list: 'Attachments' });
  return { model, id };
}

test('round 3 (a): a Wing chain found from shape with anonymous joints keeps every joint name', () => {
  const { model, id } = wingRig(['Shoulder_L', 'Elbow_L', 'Hand_L']);
  const rig = suggestPoseRig(model, 0, 0);
  assert.ok(rig.chains.some(chain => chain.label === 'Wing' && chain.end === id.handL), 'setup: POSE labels the left limb Wing');
  const plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  for (const bone of [id.arm1L, id.arm2L, id.handL]) { assert.equal(rowsById(plan).get(bone).part, 'keep'); assert.equal(nameIn(plan, bone), model.Nodes[bone].Name); }
  assert.equal(nameIn(plan, id.handR), 'Bone_Hand_R', 'the ordinary right arm is renamed as usual');
  assert.equal(nameIn(plan, id.arm1R), 'Bone_Arm1_R');
});

test('round 3 (b): a Wing chain whose joints already read Wing is still renamed Bone_Wing#_L', () => {
  const { model, id } = wingRig(['Bone_Wing_Left1', 'Bone_Wing_Left2', 'Bone_Wing_Left3'], { ref: true });
  const rig = suggestPoseRig(model, 0, 0);
  assert.ok(rig.chains.some(chain => chain.label === 'Wing' && chain.end === id.handL), 'setup: POSE labels the named limb Wing');
  const plan = planBoneNames(model);
  assertGoodPlan(model, plan);
  assert.deepEqual([id.arm1L, id.arm2L, id.handL].map(bone => nameIn(plan, bone)), ['Bone_Wing1_L', 'Bone_Wing2_L', 'Bone_Wing3_L']);
  assert.equal(rowsById(plan).get(id.arm1L).part, 'wing');
});
