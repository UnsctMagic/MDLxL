// Transplant (XFER stage 3): the open model's mesh on the donor's skeleton with the donor's
// animations. Contract: docs/agent-tasks/xfer-both-ways.md, "Stage 3: transplant ... Engine
// contract". Real models from the private test-model collection; each test skips with the reason
// when its model is not on this machine.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Quaternion, Vector3 } from 'three';
import { parseCompatibleMdx, generateCompatibleMdx } from '../src/mdx-compatibility.js';
import { allNodes, nodePivot, sampleNodeMatrices, sampleTrack, skinGeoset } from '../src/animation.js';
import { vertexBones } from '../src/part-bones.js';
import { nodeIndex } from '../src/node-hierarchy.js';
import { validateModel } from '../src/editor-document.js';
import { clearTransferCache, transferRig } from '../src/anim-transfer.js';
import { poseLimbStart } from '../src/pose-recognition.js';
import { standSequenceIndex } from '../src/sequence-editor.js';
import { mirrorModel, transplantReading, transplantSkeleton } from '../src/skeleton-transplant.js';

const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const missing = (...keys) => { const absent = keys.filter(key => { const file = fixturePath(key); return !file || !fs.existsSync(file); }); return absent.length ? `private test model not on this machine: ${absent.join(', ')}` : false; };
const load = key => { const b = fs.readFileSync(fixturePath(key)); return parseCompatibleMdx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const results = new Map();
/** One transplant per pair and options, read once: { own, donor, model, report }. */
const transplant = (ownKey, donorKey, options = {}) => {
  const key = JSON.stringify([ownKey, donorKey, options]);
  if (!results.has(key)) { const own = load(ownKey), donor = load(donorKey); results.set(key, { own, donor, ...transplantSkeleton(own, donor, options) }); }
  return results.get(key);
};
const byId = model => new Map(allNodes(model).map(node => [node.ObjectId, node]));
const at = (model, nodes, matrices, id) => new Vector3().fromArray(nodePivot(model, nodes.get(id), id)).applyMatrix4(matrices.get(id));

/** A limb's two role stretches as node ids: [first joint of the limb itself, next], [next, end]. */
function roles(model, part) {
  const nodes = byId(model), top = Math.max(0, part.joints.indexOf(part.line[0]));
  const s = poseLimbStart(part.joints.map(id => new Vector3(...nodePivot(model, nodes.get(id), id))), part.joints.map(id => nodes.get(id).Name), top, part.joints.length - 1, part.limbKind);
  const end = part.marker !== part.joints[s + 1] ? part.marker : null;
  return end == null ? null : [[part.joints[s], part.joints[s + 1]], [part.joints[s + 1], end]];
}
/** Worst angle (degrees) of each limb part of the result against the donor's part of the same role, through
 * every donor animation but decay and portrait. A transplanted limb is the donor's own joints in the result;
 * a converted one is the open model's joints, read by role on the open model. */
function limbAngles({ own, model, report }, donor, samples = 8) {
  clearTransferCache(own); clearTransferCache(donor);
  const rigD = transferRig(donor, { sequence: standSequenceIndex(donor) }), rigO = transferRig(own, { sequence: standSequenceIndex(own) });
  const nM = byId(model), nD = byId(donor), worst = {};
  const pairs = Object.keys(rigO.parts).filter(key => /^(arm|leg)/.test(key) && rigD.parts[key]).map(key => {
    const theirs = roles(donor, rigD.parts[key]), converted = report.converted.includes(key), mine = converted ? roles(own, rigO.parts[key]) : theirs;
    const map = converted ? report.ownNodes : report.donorNodes;
    return theirs && mine ? { key, kind: converted ? 'converted' : 'transplanted', theirs, mine: mine.map(pair => pair.map(id => map[id])) } : null;
  }).filter(Boolean);
  for (const pair of pairs) worst[pair.key] = { kind: pair.kind, upper: 0, lower: 0 };
  model.Sequences.forEach((sequence, index) => {
    if (/decay|portrait/i.test(sequence.Name)) return;
    const [a, b] = sequence.Interval;
    for (let i = 0; i <= samples; i++) {
      const frame = Math.round(a + (b - a) * i / samples), mm = sampleNodeMatrices(model, frame, index), md = sampleNodeMatrices(donor, frame, index);
      for (const { key, theirs, mine } of pairs) ['upper', 'lower'].forEach((role, r) => {
        const u = at(model, nM, mm, mine[r][1]).sub(at(model, nM, mm, mine[r][0])), v = at(donor, nD, md, theirs[r][1]).sub(at(donor, nD, md, theirs[r][0]));
        worst[key][role] = Math.max(worst[key][role], u.angleTo(v) * 180 / Math.PI);
      });
    }
  });
  return worst;
}
/** The checks every transplant must pass: it validates, survives a save and a reopen, has exactly the
 * donor's animations, binds every vertex to a node that exists, and keeps no own body bone unless its
 * limb is converted or it was kept. */
function structural({ own, donor, model, report }, keep = []) {
  const errors = validateModel(model).filter(d => d.severity === 'error');
  assert.deepEqual(errors.map(e => `${e.code}: ${e.message}`), [], 'the result validates');
  const bytes = generateCompatibleMdx(model), back = parseCompatibleMdx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const plain = sequences => sequences.map(s => [s.Name, Array.from(s.Interval)]);
  assert.deepEqual(plain(back.Sequences), plain(donor.Sequences), 'saved and reopened, the animations are exactly the donor\'s names and intervals');
  assert.equal(allNodes(back).length, allNodes(model).length, 'every node survives a save and a reopen');
  const ownOnly = own.Sequences.map(s => s.Name).filter(name => !donor.Sequences.some(s => s.Name === name));
  assert.deepEqual(model.Sequences.map(s => s.Name).filter(name => ownOnly.includes(name)), [], 'none of the model\'s own animations is left');
  const ids = new Set(allNodes(model).map(n => n.ObjectId));
  model.Geosets.forEach((geoset, g) => { for (let v = 0; v < geoset.VertexGroup.length; v++) { const group = geoset.Groups[geoset.VertexGroup[v]]; assert.ok(group?.length && group.every(id => ids.has(id)), `geoset ${g} vertex ${v} is bound to nodes that exist`); } });
  const rig = transferRig(own, { sequence: standSequenceIndex(own) });
  for (const part of Object.values(rig.parts)) for (const id of part.joints) {
    if (report.ownNodes[id] == null) continue;
    assert.ok(report.converted.includes(part.key) || keep.includes(id), `${own.Nodes[id].Name} (${part.key}) is still in the result although its part was not converted`);
  }
}

// ------------------------------------------------------------------ (a) the easy pair: Footman on the Grunt
test('T1 Footman on the Grunt: a valid model with exactly the Grunt\'s animations, every vertex on a node that exists', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  const result = transplant('transfer-footman', 'transfer-grunt');
  structural(result);
  assert.equal(result.report.fit, 'good', result.report.reasons.join(' '));
  assert.deepEqual(result.model.Attachments.map(a => a.Name).sort(), result.donor.Attachments.map(a => a.Name).sort(), 'the attachment points are the donor\'s');
});

test('T2 Footman on the Grunt: every transplanted arm and leg part points as the Grunt\'s does through every animation', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  const result = transplant('transfer-footman', 'transfer-grunt'), worst = limbAngles(result, result.donor);
  const transplanted = Object.entries(worst).filter(([, v]) => v.kind === 'transplanted');
  assert.ok(transplanted.length >= 3, `three or more limbs are transplanted (${Object.keys(worst)})`);
  for (const [key, v] of transplanted) for (const role of ['upper', 'lower']) assert.ok(v[role] < 10, `${key}: the ${role} part is up to ${v[role].toFixed(1)} degrees from the Grunt's`);
  // v2 item 4: no limb is converted. The Footman's right arm ends at an attachment, where the Grunt has a hand
  // joint: the Grunt's forearm sits inside the Footman's arm and takes the skin past its plane (P7).
  assert.deepEqual(result.report.converted, []);
});

test('P7 Footman on the Grunt: the shield arm\'s 20 vertices past the Grunt\'s forearm plane are on the Grunt\'s forearm bone', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  const { donor, model, report } = transplant('transfer-footman', 'transfer-grunt');
  const rigG = transferRig(donor, { sequence: standSequenceIndex(donor) }), forearm = rigG.parts.armR.joints[1];
  const carrier = donor.Bones.find(bone => bone.Parent === forearm && !rigG.parts.armR.joints.includes(bone.ObjectId)), there = report.donorNodes[carrier.ObjectId];
  let on = 0;
  for (const geoset of model.Geosets) for (let v = 0; v < geoset.VertexGroup.length; v++) if (geoset.Groups[geoset.VertexGroup[v]].includes(there)) on++;
  assert.equal(on, 20, `${on} vertices on ${carrier.Name}`);
  assert.equal(report.counts.skin.moved, 20);
});

test('P9 Footman on the Grunt: the hand mesh stays on the hand, only the weapon pieces ride the Grunt\'s weapon bone', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  const { own, donor, model, report } = transplant('transfer-footman', 'transfer-grunt');
  // The Footman's hand mesh: the still skinned bone right under its weapon hand that carries the sword's bones.
  const rig = transferRig(own, { sequence: standSequenceIndex(own) }), hand = Object.values(rig.parts).find(part => part.weapon).marker;
  const mesh = own.Bones.find(bone => bone.Parent === hand && own.Bones.some(child => child.Parent === bone.ObjectId));
  // The sword: the bone the Footman's Weapon Ref hangs from (it moves by itself) and the bones under it.
  const top = donorWeaponBone(own), under = id => { for (let at = id; at != null && at !== -1; at = own.Nodes[at]?.Parent ?? null) if (at === top) return true; return false; };
  const sword = own.Bones.map(bone => bone.ObjectId).filter(under);
  const weaponBone = report.donorNodes[donorWeaponBone(donor)];
  assert.equal(report.weapon?.rides, true);
  assert.equal(report.weapon.bone, weaponBone);
  let meshVertices = 0, swordVertices = 0;
  own.Geosets.forEach((geoset, g) => { for (let v = 0; v < geoset.VertexGroup.length; v++) {
    const bones = Array.from(geoset.Groups[geoset.VertexGroup[v]]), result = Array.from(model.Geosets[g].Groups[model.Geosets[g].VertexGroup[v]]);
    if (bones.length === 1 && bones[0] === mesh.ObjectId) { meshVertices++; assert.ok(!result.includes(weaponBone), `hand mesh vertex ${v} is not on the weapon bone`); }
    if (bones.length && bones.every(id => sword.includes(id))) { swordVertices++; assert.deepEqual(result, [weaponBone], `sword vertex ${v} rides the weapon bone`); }
  } });
  assert.ok(meshVertices >= 10 && swordVertices >= 10, `hand mesh ${meshVertices}, sword ${swordVertices} vertices`);
});

// ------------------------------------------------------------------ (b) the owner's pair: the Kurgan on the Tauren
// v2 item 4 (contract docs/agent-tasks/xfer-transplant-v2-skin.md): T4 and T5 are replaced by P1 to P6.
/** Every donor animation but decay and portrait, at `samples + 1` moments: [index, frame]. */
const moments = (model, samples = 8, skip = /decay|portrait/i) => model.Sequences.flatMap((sequence, index) => skip.test(sequence.Name) ? [] : Array.from({ length: samples + 1 }, (_, i) => [index, Math.round(sequence.Interval[0] + (sequence.Interval[1] - sequence.Interval[0]) * i / samples)]));
const turn = matrix => { const q = new Quaternion(); matrix.decompose(new Vector3(), q, new Vector3()); return q; };
const degrees = (q1, q2) => q1.angleTo(q2) * 180 / Math.PI;

test('P1 Kurgan on the Tauren: nothing converted, the Tauren\'s own leg bones, every vertex on a bone of the result, none on the Kurgan\'s body', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  const result = transplant('transfer-kurgan', 'transfer-tauren'), { own, donor, model, report } = result;
  structural(result);
  assert.equal(report.fit, 'good', report.reasons.join(' '));
  assert.deepEqual(report.converted, [], 'no limb keeps its own joints');
  const rig = transferRig(own, { sequence: standSequenceIndex(own) });
  for (const key of ['legL', 'legR']) for (const id of rig.parts[key].joints) assert.equal(report.ownNodes[id], undefined, `${own.Nodes[id].Name} is not in the result`);
  const bones = new Set(model.Bones.map(n => n.ObjectId)), ownIds = new Map(Object.entries(report.ownNodes).map(([o, r]) => [r, Number(o)]));
  const bodyJoint = id => { for (let at = id; at != null && at !== -1; at = own.Nodes[at]?.Parent ?? null) if (Object.values(rig.parts).some(part => part.joints.includes(at))) return true; return false; };
  for (const geoset of model.Geosets) for (let v = 0; v < geoset.VertexGroup.length; v++) for (const id of geoset.Groups[geoset.VertexGroup[v]]) {
    assert.ok(bones.has(id), `${model.Nodes[id].Name} carries skin and is a bone`);
    if (ownIds.has(id)) assert.ok(!bodyJoint(ownIds.get(id)), `${model.Nodes[id].Name} is the Kurgan's own and carries skin`);
  }
  const worst = limbAngles(result, donor);
  // Straight shins (owner's pick): the legs' lower part follows the Tauren's knee-to-foot chord, checked in P10.
  for (const [key, roles] of [['armL', ['upper', 'lower']], ['armR', ['upper', 'lower']], ['legL', ['upper']], ['legR', ['upper']]]) for (const role of roles) assert.ok(worst[key][role] < 10, `${key}: the ${role} part is up to ${worst[key][role].toFixed(1)} degrees from the Tauren's`);
});

test('P2 Kurgan on the Tauren: the skin lands on the Tauren\'s skin bones (neck 1, lower shins 10 each; 21 moved, 2 blended)', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  const { donor, model, report } = transplant('transfer-kurgan', 'transfer-tauren');
  const count = new Map();
  for (const geoset of model.Geosets) for (let v = 0; v < geoset.VertexGroup.length; v++) for (const id of geoset.Groups[geoset.VertexGroup[v]]) count.set(model.Nodes[id].Name, (count.get(model.Nodes[id].Name) || 0) + 1);
  // Posture (19 Nov 2026): the neck inside the chest takes only skin near its line, not the collar ring (was 14, 34 moved,
  // 1 blended): the neck now turns into the Tauren's at rest. The trunk's own split is counted apart (	runk).
  assert.deepEqual(['Geo_Neck', 'Geo_lowershinL', 'Geo_lowershinR'].map(name => count.get(name) || 0), [1, 10, 10]);
  assert.equal(report.counts.skin.moved, 21); assert.equal(report.counts.skin.blended, 2);
  const geo = donor.Bones.filter(n => /^Geo_/.test(n.Name)).map(n => n.Name).filter(name => count.get(name) > 0);
  assert.equal(geo.length, 18, `Geo_ bones with skin: ${geo.join(', ')}`);
  assert.ok(model.Geosets.every(geoset => geoset.Groups.length <= 14), `groups per geoset ${model.Geosets.map(g => g.Groups.length)}`);
});

test('P3 Kurgan on the Tauren: at least 44 of the Tauren\'s 50 bones and helpers are in the result', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  const { donor, model } = transplant('transfer-kurgan', 'transfer-tauren');
  const names = new Set([...model.Bones, ...model.Helpers].map(n => n.Name)), theirs = [...donor.Bones, ...donor.Helpers].map(n => n.Name);
  assert.ok(theirs.filter(name => names.has(name)).length >= 44, `${theirs.filter(name => names.has(name)).length}; missing ${theirs.filter(name => !names.has(name))}`);
});

test('P4 Kurgan on the Tauren: every limb stretch but the shin points as the Tauren\'s, every trunk stretch keeps a constant angle, trunk joints turn as the Tauren\'s', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  const { donor, model, report } = transplant('transfer-kurgan', 'transfer-tauren'), nD = byId(donor), nM = byId(model);
  const rigT = transferRig(donor, { sequence: standSequenceIndex(donor) }), map = report.donorNodes;
  const limbs = [], trunk = [], turning = [];
  const partJoints = new Set(Object.values(rigT.parts).flatMap(part => part.joints));
  for (const part of Object.values(rigT.parts)) {
    // Every limb stretch but the two inside a leg's shin (knee > hock > foot: straight, P10).
    if (part.kind === 'limb' && part.limbKind !== 'tail') part.joints.forEach((id, i) => { if (i + 1 < part.joints.length && !(part.limbKind === 'leg' && i >= part.joints.length - 3)) limbs.push([id, part.joints[i + 1]]); });
    if (part.kind === 'trunk') for (const id of part.joints) {
      turning.push(id);
      for (const child of donor.Bones.filter(b => b.Parent === id && !partJoints.has(b.ObjectId)).map(b => b.ObjectId)) if (map[child] != null) turning.push(child);
      for (const child of [...donor.Bones, ...donor.Helpers].filter(n => n.Parent === id && partJoints.has(n.ObjectId)).map(n => n.ObjectId)) trunk.push([id, child]);
    }
  }
  const spread = new Map(trunk.map(pair => [pair.join(), [Infinity, -Infinity]]));
  let limbWorst = { d: 0 }, turnWorst = { d: 0 };
  for (const [index, frame] of moments(model)) {
    const mm = sampleNodeMatrices(model, frame, index), md = sampleNodeMatrices(donor, frame, index);
    const stretch = (pair, m, nodes, model_, ids) => at(model_, nodes, m, ids(pair[1])).sub(at(model_, nodes, m, ids(pair[0])));
    for (const pair of limbs) { const d = stretch(pair, mm, nM, model, id => map[id]).angleTo(stretch(pair, md, nD, donor, id => id)) * 180 / Math.PI; if (d > limbWorst.d) limbWorst = { d, pair }; }
    for (const pair of trunk) { const d = stretch(pair, mm, nM, model, id => map[id]).angleTo(stretch(pair, md, nD, donor, id => id)) * 180 / Math.PI, range = spread.get(pair.join()); range[0] = Math.min(range[0], d); range[1] = Math.max(range[1], d); }
    for (const id of turning) { const d = degrees(turn(mm.get(map[id])), turn(md.get(id))); if (d > turnWorst.d) turnWorst = { d, id }; }
  }
  assert.ok(limbWorst.d < 1, `limb stretch ${limbWorst.pair?.map(id => donor.Nodes[id].Name).join(' > ')} is up to ${limbWorst.d.toFixed(2)} degrees from the Tauren's`);
  for (const [key, [lo, hi]] of spread) assert.ok(hi - lo <= 1, `trunk stretch ${key.split(',').map(id => donor.Nodes[id].Name).join(' > ')} varies by ${(hi - lo).toFixed(2)} degrees (${lo.toFixed(0)} to ${hi.toFixed(0)})`);
  assert.ok(turnWorst.d < 0.5, `${turnWorst.id != null ? donor.Nodes[turnWorst.id].Name : ''} turns up to ${turnWorst.d.toFixed(2)} degrees off the Tauren's`);
});

test('P5 Kurgan on the Tauren: the feet turn as the Tauren\'s and stay on the ground (within 0.06 hip heights) in every animation but Death', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  const { own, donor, model, report } = transplant('transfer-kurgan', 'transfer-tauren'), nM = byId(model);
  const rig = transferRig(own, { sequence: standSequenceIndex(own) }), rigT = transferRig(donor, { sequence: standSequenceIndex(donor) });
  const theirs = ['legL', 'legR'].map(key => rigT.parts[key].marker), feet = theirs.map(id => report.donorNodes[id]);
  assert.ok(feet.every(id => id != null), 'the Tauren\'s feet are in the result');
  let worstTurn = 0;
  const range = new Map();
  for (const [index, frame] of moments(model, 40, /decay|portrait/i)) {
    const mm = sampleNodeMatrices(model, frame, index), md = sampleNodeMatrices(donor, frame, index);
    feet.forEach((id, i) => { worstTurn = Math.max(worstTurn, degrees(turn(mm.get(id)), turn(md.get(theirs[i])))); });
    const h = Math.min(...feet.map(id => at(model, nM, mm, id).z)) - rig.ground, name = model.Sequences[index].Name;
    const r = range.get(name) || [Infinity, -Infinity]; range.set(name, [Math.min(r[0], h), Math.max(r[1], h)]);
  }
  assert.ok(worstTurn < 0.5, `a foot turns up to ${worstTurn.toFixed(2)} degrees off the Tauren's`);
  // Feet down (owner's pick, TEST TRANSPLANT 09): the body moves so the lower foot is as high as the Tauren's.
  for (const [name, [lo, hi]] of range) if (!/death/i.test(name)) assert.ok(Math.max(-lo, hi) < 0.06 * rig.hipHeight, `${name}: the lower foot goes ${lo.toFixed(1)} to ${hi.toFixed(1)} from its standing height (hip height ${rig.hipHeight.toFixed(0)})`);
});

test('P6 Kurgan on the Tauren and Footman on the Grunt: vertices in one place with the same bones get the same bones; none over four', { skip: missing('transfer-kurgan', 'transfer-tauren', 'transfer-footman', 'transfer-grunt') }, () => {
  for (const [a, b] of [['transfer-kurgan', 'transfer-tauren'], ['transfer-footman', 'transfer-grunt']]) {
    const { own, model } = transplant(a, b), seen = new Map();
    own.Geosets.forEach((geoset, g) => { for (let v = 0; v < geoset.VertexGroup.length; v++) {
      const group = Array.from(model.Geosets[g].Groups[model.Geosets[g].VertexGroup[v]]);
      assert.ok(group.length <= 4, `${a}: vertex ${v} has ${group.length} bones`);
      const key = `${g}|${Array.from(geoset.Vertices.subarray(v * 3, v * 3 + 3)).map(x => x.toFixed(4))}|${Array.from(geoset.Groups[geoset.VertexGroup[v]]).sort()}`;
      if (seen.has(key)) assert.deepEqual(group, seen.get(key), `${a}: coincident vertex ${v}`); else seen.set(key, group);
    } });
  }
});

test('P10 Kurgan on the Tauren: the shin stays straight (owner\'s pick) and follows the Tauren\'s knee-to-foot chord; folded is an option', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  const shins = ({ model, report, donor }) => {
    const rigT = transferRig(donor, { sequence: standSequenceIndex(donor) }), nM = byId(model), nD = byId(donor), bends = [], chords = [];
    const stand = standSequenceIndex(model), ref = sampleNodeMatrices(model, model.Sequences[stand].Interval[0], stand);
    let rest = 0;
    for (const key of ['legL', 'legR']) {
      const [, knee, hock, foot] = rigT.parts[key].joints, [k, h, f] = [knee, hock, foot].map(id => report.donorNodes[id]);
      const bend = m => at(model, nM, m, h).sub(at(model, nM, m, k)).angleTo(at(model, nM, m, f).sub(at(model, nM, m, h))) * 180 / Math.PI;
      rest = Math.max(rest, bend(ref));
      for (const [index, frame] of moments(model, 8, /decay|portrait|death/i)) {
        const mm = sampleNodeMatrices(model, frame, index), md = sampleNodeMatrices(donor, frame, index);
        bends.push(bend(mm));
        chords.push(at(model, nM, mm, f).sub(at(model, nM, mm, k)).angleTo(at(donor, nD, md, foot).sub(at(donor, nD, md, knee))) * 180 / Math.PI);
      }
    }
    const median = list => [...list].sort((x, y) => x - y)[list.length >> 1];
    return { rest, bend: median(bends), chord: median(chords) };
  };
  const straight = shins(transplant('transfer-kurgan', 'transfer-tauren'));
  assert.ok(straight.rest < 5, `at the reference moment the shin bends ${straight.rest.toFixed(1)} degrees`);
  assert.ok(straight.bend < 20, `the shin bends ${straight.bend.toFixed(1)} degrees (median)`);
  assert.ok(straight.chord < 3, `the knee-to-foot line is ${straight.chord.toFixed(1)} degrees off the Tauren's (median)`);
  const folded = shins(transplant('transfer-kurgan', 'transfer-tauren', { legs: 'folded', extents: false }));
  assert.ok(folded.rest > 60, `legs: 'folded' bends the shin at the hock (${folded.rest.toFixed(0)} degrees)`);
});

test('P11 feet down moves the body and the totem root together: the totem and the hammer move against the body exactly as with feet free', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  const down = transplant('transfer-kurgan', 'transfer-tauren'), free = transplant('transfer-kurgan', 'transfer-tauren', { feet: 'free' });
  const named = (model, name) => allNodes(model).find(n => n.Name.trim() === name).ObjectId;
  const { g, list } = hammerVertices(down);
  const centre = (model, m) => { const v = skinGeoset(model.Geosets[g], m), c = new Vector3(); for (const i of list) c.add(new Vector3(v[i * 3], v[i * 3 + 1], v[i * 3 + 2])); return c.divideScalar(list.length); };
  let apart = 0, hammer = 0, moved = 0;
  for (const [index, frame] of moments(down.model, 24)) {
    const md = sampleNodeMatrices(down.model, frame, index), mf = sampleNodeMatrices(free.model, frame, index), nd = byId(down.model), nf = byId(free.model);
    const rel = (model, nodes, m, a, b) => at(model, nodes, m, named(model, a)).sub(at(model, nodes, m, named(model, b)));
    apart = Math.max(apart, rel(down.model, nd, md, 'Bone_Totum', 'Root').distanceTo(rel(free.model, nf, mf, 'Bone_Totum', 'Root')));
    const hd = centre(down.model, md).sub(at(down.model, nd, md, named(down.model, 'Bone_HandR'))), hf = centre(free.model, mf).sub(at(free.model, nf, mf, named(free.model, 'Bone_HandR')));
    hammer = Math.max(hammer, hd.distanceTo(hf));
    moved = Math.max(moved, Math.abs(at(down.model, nd, md, named(down.model, 'Root')).z - at(free.model, nf, mf, named(free.model, 'Root')).z));
  }
  assert.ok(moved > 2, `feet down moves the body (up to ${moved.toFixed(1)})`);
  assert.ok(apart < 0.01, `the totem root against the body differs by up to ${apart.toFixed(3)}`);
  assert.ok(hammer < 0.01, `the hammer against the hand differs by up to ${hammer.toFixed(3)}`);
});

/** Largest distance, through three moments of every animation, between where the hammer's vertices sit
 * against the hand that holds them in the result and where they sit against the Kurgan's own hand in
 * its own reference pose. The hammer is the largest extra; the result's hand the donor joint placed at
 * the Kurgan's hand. */
function gripDrift(result) {
  const { own, model, report } = result, { rig, hand, result: resultId, carry } = weaponHands(result), resultHand = { ObjectId: resultId };
  const hammer = [...report.extras].sort((a, b) => b.vertices - a.vertices)[0], nO = byId(own);
  const below = id => { for (let at = id; at != null && at !== -1; at = nO.get(at)?.Parent ?? null) if (at === hammer.id) return true; return false; };
  const under = new Set(allNodes(own).map(n => n.ObjectId).filter(below));
  const g = own.Geosets.findIndex(geoset => geoset.Groups.some(group => group.some(id => under.has(id))));
  const ownRef = sampleNodeMatrices(own, rig.reference.frame, rig.reference.sequence), mine = skinGeoset(own.Geosets[g], ownRef), toHand = ownRef.get(hand).clone().invert();
  let drift = 0;
  model.Sequences.forEach((sequence, index) => [0, 0.5, 1].forEach(share => {
    const frame = Math.round(sequence.Interval[0] + share * (sequence.Interval[1] - sequence.Interval[0])), m = sampleNodeMatrices(model, frame, index);
    const theirs = skinGeoset(model.Geosets[g], m), toResult = m.get(resultHand.ObjectId).clone().invert();
    for (let v = 0; v < own.Geosets[g].VertexGroup.length; v++) {
      if (!own.Geosets[g].Groups[own.Geosets[g].VertexGroup[v]].every(id => under.has(id))) continue;
      const a = carry(new Vector3(mine[v * 3], mine[v * 3 + 1], mine[v * 3 + 2]).applyMatrix4(toHand)), b = new Vector3(theirs[v * 3], theirs[v * 3 + 1], theirs[v * 3 + 2]).applyMatrix4(toResult);
      drift = Math.max(drift, a.distanceTo(b));
    }
  }));
  return { drift, hammer };
}
/** The donor's weapon bone, read from the file: the joint its weapon attachment hangs from. */
const donorWeaponBone = donor => donor.Attachments.find(a => /weapon/i.test(a.Name)).Parent;
/** The hammer's vertices: the largest extra, its geoset and the vertices carried only by bones under it. */
function hammerVertices({ own, report }) {
  const hammer = [...report.extras].sort((a, b) => b.vertices - a.vertices)[0], nO = byId(own);
  const below = id => { for (let at = id; at != null && at !== -1; at = nO.get(at)?.Parent ?? null) if (at === hammer.id) return true; return false; };
  const under = new Set(allNodes(own).map(n => n.ObjectId).filter(below));
  const g = own.Geosets.findIndex(geoset => geoset.Groups.some(group => group.some(id => under.has(id))));
  const list = []; for (let v = 0; v < own.Geosets[g].VertexGroup.length; v++) if (own.Geosets[g].Groups[own.Geosets[g].VertexGroup[v]].every(id => under.has(id))) list.push(v);
  return { hammer, g, list };
}
/** The Kurgan's weapon hand, the result's joint that took it (the donor's hand of the same arm), and `carry`: where a
 * point of the open model's bind space at that hand sits in the result's bind space. The result's bind pose is the
 * donor's rest posture (posture, 19 Nov 2026): the hand's skin turned by `report.repose` about the hand's new place.
 * (Before the posture change the result's hand sat exactly on the Kurgan's pivot and `carry` was the identity.) */
function weaponHands({ own, donor, model, report }) {
  const rig = transferRig(own, { sequence: standSequenceIndex(own) }), part = Object.values(rig.parts).find(p => p.weapon), hand = part.marker;
  const theirs = transplantReading(transferRig(donor, { sequence: standSequenceIndex(donor) }), donor).parts[part.key].marker, result = report.donorNodes[theirs];
  const pivotOwn = new Vector3(...nodePivot(own, byId(own).get(hand), hand)), pivotResult = new Vector3(...nodePivot(model, byId(model).get(result), result));
  const turn = new Quaternion(...(report.repose?.[result] || [0, 0, 0, 1]));
  const carry = p => p.clone().sub(pivotOwn).applyQuaternion(turn).add(pivotResult);
  return { rig, hand, result, carry };
}
test('T6 Kurgan on the Tauren: the hammer rides the Tauren\'s weapon bone from where the Kurgan holds it, and leaves the hand with it', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  const result = transplant('transfer-kurgan', 'transfer-tauren'), { own, donor, model, report } = result, { hammer, g, list } = hammerVertices(result);
  assert.ok(hammer.vertices > 600 && !hammer.kept, `the hammer is the largest extra (${hammer.name}, ${hammer.vertices} vertices), not kept`);
  assert.equal(report.ownNodes[hammer.id], undefined, 'the hammer\'s own bone is gone');
  const totem = donorWeaponBone(donor), carrier = report.donorNodes[totem];
  assert.ok(carrier != null, `the Tauren's weapon bone (${donor.Nodes[totem].Name}) is in the result`);
  assert.equal(report.weapon?.rides, true, 'the weapon rides the donor\'s weapon bone');
  assert.equal(report.weapon.bone, carrier);
  for (const v of list) assert.deepEqual(Array.from(model.Geosets[g].Groups[model.Geosets[g].VertexGroup[v]]), [carrier], `hammer vertex ${v} rides only the weapon bone`);
  // At the result's reference moment (first frame of its Stand) the hammer sits where the Kurgan holds it.
  const { rig, hand, result: resultHand, carry } = weaponHands(result), nD = byId(donor), nM = byId(model);
  const ownRef = sampleNodeMatrices(own, rig.reference.frame, rig.reference.sequence), mine = skinGeoset(own.Geosets[g], ownRef), toHand = ownRef.get(hand).clone().invert();
  const stand = standSequenceIndex(model), ref = sampleNodeMatrices(model, model.Sequences[stand].Interval[0], stand), theirs = skinGeoset(model.Geosets[g], ref), toResult = ref.get(resultHand).clone().invert();
  let grip = 0;
  for (const v of list) grip = Math.max(grip, carry(new Vector3(mine[v * 3], mine[v * 3 + 1], mine[v * 3 + 2]).applyMatrix4(toHand)).distanceTo(new Vector3(theirs[v * 3], theirs[v * 3 + 1], theirs[v * 3 + 2]).applyMatrix4(toResult)));
  assert.ok(grip < 0.05, `at the reference moment the hammer is ${grip.toFixed(2)} from the Kurgan's own grip`);
  // Where the Tauren's weapon leaves its hand the most, the hammer leaves the result's hand too.
  const donorHand = Number(Object.keys(report.donorNodes).find(id => report.donorNodes[id] === resultHand));
  const gap = (m, nodes, matrices, a, b) => at(m, nodes, matrices, a).distanceTo(at(m, nodes, matrices, b));
  const centre = (m, matrices) => { const s = skinGeoset(m.Geosets[g], matrices), c = new Vector3(); for (const v of list) c.add(new Vector3(s[v * 3], s[v * 3 + 1], s[v * 3 + 2])); return c.divideScalar(list.length); };
  const d0 = gap(donor, nD, sampleNodeMatrices(donor, donor.Sequences[stand].Interval[0], stand), totem, donorHand), r0 = centre(model, ref).distanceTo(at(model, nM, ref, resultHand));
  let most = { change: 0 };
  donor.Sequences.forEach((sequence, index) => {
    if (/decay|portrait/i.test(sequence.Name)) return;
    for (let i = 0; i <= 12; i++) { const frame = Math.round(sequence.Interval[0] + (sequence.Interval[1] - sequence.Interval[0]) * i / 12), change = Math.abs(gap(donor, nD, sampleNodeMatrices(donor, frame, index), totem, donorHand) - d0); if (change > most.change) most = { change, frame, index }; }
  });
  const mm = sampleNodeMatrices(model, most.frame, most.index), moved = Math.abs(centre(model, mm).distanceTo(at(model, nM, mm, resultHand)) - r0);
  assert.ok(most.change > 20, `the Tauren lets go of its weapon (${most.change.toFixed(0)})`);
  assert.ok(moved > 0.5 * report.counts.sizeRatio * most.change, `in ${model.Sequences[most.index].Name} the hammer leaves the hand by ${moved.toFixed(1)}, the Tauren's weapon by ${most.change.toFixed(1)} (size ratio ${report.counts.sizeRatio.toFixed(2)})`);
});

test('T11 Kurgan on the Tauren: the Weapon Ref hangs from the bone that carries the hammer, where the Kurgan\'s sits on it', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  const result = transplant('transfer-kurgan', 'transfer-tauren'), { own, model, report } = result;
  const point = model.Attachments.find(a => /weapon/i.test(a.Name)), mine = own.Attachments.find(a => /weapon/i.test(a.Name));
  assert.equal(point.Parent, report.weapon?.bone, 'the Weapon Ref hangs from the weapon bone');
  // Against the hand: in the result at its reference moment, in the Kurgan at its own.
  const { rig, hand, result: resultHand, carry } = weaponHands(result), nO = byId(own), nM = byId(model);
  const ownRef = sampleNodeMatrices(own, rig.reference.frame, rig.reference.sequence), stand = standSequenceIndex(model), ref = sampleNodeMatrices(model, model.Sequences[stand].Interval[0], stand);
  const a = carry(at(own, nO, ownRef, mine.ObjectId).applyMatrix4(ownRef.get(hand).clone().invert())), b = at(model, nM, ref, point.ObjectId).applyMatrix4(ref.get(resultHand).clone().invert());
  assert.ok(a.distanceTo(b) < 0.05, `the Weapon Ref is ${a.distanceTo(b).toFixed(2)} from where the Kurgan's sits against the hand`);
});

test('T12 weapon side: on a donor whose weapon bone is on the other arm the hammer stays in the hand; mirrored, it rides that bone', { skip: missing('transfer-kurgan', 'transfer-grunt') }, () => {
  const plain = transplant('transfer-kurgan', 'transfer-grunt', { extents: false });
  assert.equal(plain.report.weapon?.rides, false, 'unmirrored, the Grunt\'s weapon bone is on the other arm');
  assert.match(plain.report.weapon.note, /other arm/);
  const mirrored = transplant('transfer-kurgan', 'transfer-grunt', { mirror: true, extents: false }), axe = donorWeaponBone(mirrored.donor);
  assert.equal(mirrored.report.weapon.rides, true);
  assert.equal(mirrored.report.weapon.bone, mirrored.report.donorNodes[axe], `mirrored, the hammer rides the Grunt's weapon bone (${mirrored.donor.Nodes[axe].Name})`);
  const { g, list } = hammerVertices(mirrored);
  for (const v of list) assert.deepEqual(Array.from(mirrored.model.Geosets[g].Groups[mirrored.model.Geosets[g].VertexGroup[v]]), [mirrored.report.weapon.bone]);
});

// ------------------------------------------------------------------ (c) keep, sounds and effects, mirror, poor fit
test('T7 keep: with the hammer\'s bone in keep, that bone survives, still and in the hand', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  const plain = transplant('transfer-kurgan', 'transfer-tauren'), hammer = [...plain.report.extras].sort((a, b) => b.vertices - a.vertices)[0];
  const result = transplant('transfer-kurgan', 'transfer-tauren', { keep: [hammer.id], extents: false });
  structural(result, [hammer.id]);
  const kept = result.report.ownNodes[hammer.id];
  assert.ok(kept != null, 'the hammer\'s bone is in the result');
  assert.equal(result.report.extras.find(e => e.id === hammer.id).kept, true);
  assert.ok(result.model.Geosets.some(geoset => geoset.Groups.some(group => group.includes(kept))), 'the hammer\'s vertices ride its own bone');
  assert.equal(result.model.Attachments.find(a => /weapon/i.test(a.Name)).Parent, kept, 'the Weapon Ref hangs from the kept hammer bone');
  const { drift } = gripDrift(result);
  assert.ok(drift < 0.05, `kept, the hammer drifts up to ${drift.toFixed(2)} from the Kurgan's own grip`);
});

test('T8 sounds and effects: the donor\'s by default, the model\'s own sounds when unticked, the donor\'s particles when ticked', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  const names = list => (list || []).map(n => n.Name).sort();
  const plain = transplant('transfer-kurgan', 'transfer-tauren');
  assert.deepEqual(names(plain.model.EventObjects), names(plain.donor.EventObjects), 'by default the sounds and footprints are the donor\'s');
  assert.equal((plain.model.ParticleEmitters2 || []).length, 0, 'by default no donor particle effect');
  const own = transplant('transfer-kurgan', 'transfer-tauren', { events: false, extents: false });
  assert.deepEqual(names(own.model.EventObjects), names(own.own.EventObjects), 'unticked, the model\'s own sounds stay');
  // The Kurgan sounds its hit in each of its attacks: the Tauren's attacks get it.
  const hit = own.model.EventObjects.find(e => e.EventTrack.length >= 2), frames = Array.from(hit?.EventTrack || []);
  assert.ok(hit && frames.every(f => own.model.Sequences.some(s => /attack/i.test(s.Name) && f >= s.Interval[0] && f <= s.Interval[1])), `${hit?.Name} sounds inside the Tauren's attacks (${frames})`);
  const fx = transplant('transfer-kurgan', 'transfer-tauren', { emitters: true, extents: false });
  structural(fx);
  assert.equal(fx.model.ParticleEmitters2.length, fx.donor.ParticleEmitters2.length, 'ticked, the donor\'s particle effects come');
  for (const emitter of fx.model.ParticleEmitters2) assert.equal(fx.model.Textures[emitter.TextureID].Image, fx.donor.Textures[fx.donor.ParticleEmitters2.find(e => e.Name === emitter.Name).TextureID].Image, `${emitter.Name} uses the donor's texture`);
});

test('T9 mirror: offered when the donor holds its weapon in the other hand; taken, the arms follow the donor reflected', { skip: missing('transfer-kurgan', 'transfer-grunt', 'transfer-tauren') }, () => {
  const plain = transplant('transfer-kurgan', 'transfer-grunt', { extents: false });
  assert.equal(plain.report.mirrorOffer, true, 'the Kurgan holds the hammer in one hand, the Grunt its axe in the other');
  const mirrored = transplant('transfer-kurgan', 'transfer-grunt', { mirror: true, extents: false });
  structural(mirrored);
  const reflected = limbAngles(mirrored, mirrorModel(mirrored.donor)), straight = limbAngles(mirrored, mirrored.donor);
  for (const key of ['armL', 'armR']) for (const role of ['upper', 'lower']) assert.ok(reflected[key][role] < 10, `${key}: the ${role} part is up to ${reflected[key][role].toFixed(1)} degrees from the Grunt's, reflected`);
  assert.ok(Math.max(...['armL', 'armR'].map(key => straight[key].upper)) > 20, 'mirrored, the arms no longer follow the Grunt unreflected');
  assert.equal(transplant('transfer-kurgan', 'transfer-tauren').report.mirrorOffer, false, 'the Tauren\'s weapon side is not read: nothing to offer');
});

test('T10 poor fit: a four-legged donor is named a poor fit with the reason, and the transplant is still made', { skip: missing('transfer-kurgan', 'transfer-magnataur', 'transfer-tauren') }, () => {
  const result = transplant('transfer-kurgan', 'transfer-magnataur', { extents: false });
  assert.equal(result.report.fit, 'poor');
  assert.ok(result.report.reasons.some(reason => /legs/.test(reason)), result.report.reasons.join(' | '));
  structural(result);
  assert.equal(transplant('transfer-kurgan', 'transfer-tauren').report.fit, 'good', 'the owner\'s pair is not called poor');
});

// ------------------------------------------------------------------ (d) engine fixes from the failure sweep (19 Nov 2026)
// out/transfer-probe/failure-sweep/analysis.txt: classes 2, 3, 4, 5 and 8. A poor fit still gives a usable model.
/** Every track of the result's nodes and timed parts: [where, track]. */
function tracksOf(model) {
  const found = [];
  for (const key of ['Bones', 'Helpers', 'Attachments', 'EventObjects', 'CollisionShapes', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters', 'Lights', 'GeosetAnims', 'Materials', 'TextureAnims', 'Cameras']) {
    (model[key] || []).forEach((owner, i) => {
      for (const [property, value] of Object.entries(owner)) {
        if (Array.isArray(value?.Keys)) found.push([`${key}[${i}] ${owner.Name || ''}.${property}`, value]);
        else if (Array.isArray(value)) value.forEach((layer, j) => { for (const [p, t] of Object.entries(layer || {})) if (Array.isArray(t?.Keys)) found.push([`${key}[${i}].${property}[${j}].${p}`, t]); });
      }
    });
  }
  return found;
}
/** Non-finite numbers anywhere the renderer reads: bind vertices, normals, pivots, keys. */
function nonFinite(model) {
  const bad = [], finite = v => v == null || (typeof v === 'number' ? Number.isFinite(v) : Array.from(v).every(Number.isFinite));
  model.Geosets.forEach((geoset, g) => { for (const name of ['Vertices', 'Normals']) if (geoset[name] && !finite(geoset[name])) bad.push(`geoset ${g} ${name}`); });
  for (const node of allNodes(model)) if (!finite(node.PivotPoint)) bad.push(`pivot of ${node.Name}`);
  for (const [where, track] of tracksOf(model)) if (!track.Keys.every(key => [key.Vector, key.InTan, key.OutTan].every(finite))) bad.push(where);
  return bad;
}
const det3 = m => { const e = m.elements; return e[0] * (e[5] * e[10] - e[9] * e[6]) - e[4] * (e[1] * e[10] - e[9] * e[2]) + e[8] * (e[1] * e[6] - e[5] * e[2]); };
/** Moments where the weapon bone of the result is collapsed (scaled to nothing) while the joint it hangs from is not. */
function weaponHiddenAlone({ model, report }, samples = 12) {
  const bone = report.weapon?.bone, found = [];
  if (bone == null) return found;
  const parent = model.Nodes[bone].Parent;
  for (const [index, frame] of moments(model, samples, /portrait/i)) {
    const m = sampleNodeMatrices(model, frame, index), w = Math.abs(det3(m.get(bone))), h = parent != null && parent !== -1 ? Math.abs(det3(m.get(parent))) : 1;
    if (w < 1e-9 && h > 1e-9) found.push(`${model.Sequences[index].Name} @${frame}`);
  }
  return found;
}

test('C2 Tauren on the Grunt: none of the Tauren\'s own effect tracks is left without keys (the preview reads its first key)', { skip: missing('transfer-tauren', 'transfer-grunt') }, () => {
  const result = transplant('transfer-tauren', 'transfer-grunt');
  assert.deepEqual(tracksOf(result.model).filter(([, track]) => !track.Keys.length).map(([where]) => where), []);
  structural(result);
  // The Tauren's dust effects are keyed only in its own Attack Slam, which the Grunt has no animation of: they stay off.
  for (const emitter of result.model.ParticleEmitters2 || []) if (emitter.EmissionRate?.Keys) assert.ok(emitter.EmissionRate.Keys.every(key => key.Vector[0] === 0), `${emitter.Name} stays off`);
});

test('C3 Kurgan on the Khorne knight, mirrored: the knight\'s Axe bone is scaled to nothing, so the hammer stays in the hand; every number is finite', { skip: missing('transfer-kurgan', 'transfer-khorne-knight') }, () => {
  const result = transplant('transfer-kurgan', 'transfer-khorne-knight', { mirror: true });
  assert.deepEqual(nonFinite(result.model), []);
  const axe = donorWeaponBone(result.donor);
  assert.notEqual(result.report.weapon.bone, result.report.donorNodes[axe], 'the hidden Axe bone is not the weapon bone');
  assert.match(result.report.weapon.note || '', /hides/i);
  assert.deepEqual(weaponHiddenAlone(result), []);
  structural(result);
});

test('C4 Dryad on the Hermit Crab: a joint that hangs from an attachment is placed (the crab\'s root hangs from Origin Ref)', { skip: missing('transfer-dryad', 'transfer-hermit-crab') }, () => {
  const result = transplant('transfer-dryad', 'transfer-hermit-crab', { extents: false });
  assert.deepEqual(nonFinite(result.model), []);
  const root = [...result.donor.Bones, ...result.donor.Helpers].find(bone => result.donor.Attachments.some(a => a.ObjectId === bone.Parent));
  assert.ok(root && result.report.donorNodes[root.ObjectId] != null, 'the crab\'s root is in the result');
  structural(result);
});

test('C5 weapon bone scaled to nothing in one animation: the weapon stays with the hand there and moves as before elsewhere', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  const own = load('transfer-footman'), donor = load('transfer-grunt'), axe = donorWeaponBone(donor), node = donor.Nodes[axe];
  const death = donor.Sequences.find(s => /^death/i.test(s.Name)), [a, z] = death.Interval;
  const keys = (node.Scaling?.Keys || []).filter(key => key.Frame < a || key.Frame > z);
  keys.push({ Frame: a, Vector: new Float32Array([1, 1, 1]) }, { Frame: Math.round(a + (z - a) / 3), Vector: new Float32Array([0, 0, 0]) }, { Frame: z, Vector: new Float32Array([0, 0, 0]) });
  node.Scaling = { LineType: 1, GlobalSeqId: null, Keys: keys.sort((x, y) => x.Frame - y.Frame) };
  const result = { own, donor, ...transplantSkeleton(own, donor, { extents: false }) };
  assert.equal(result.report.weapon.bone, result.report.donorNodes[axe], 'the axe bone still carries the sword');
  assert.deepEqual(weaponHiddenAlone(result), []);
  // Outside Death the sword moves exactly as without the change.
  const plain = transplant('transfer-footman', 'transfer-grunt', { extents: false }), bone = result.report.weapon.bone;
  for (const [index, frame] of moments(result.model, 6)) {
    if (result.model.Sequences[index].Name === death.Name) continue;
    const m1 = sampleNodeMatrices(result.model, frame, index).get(bone), m2 = sampleNodeMatrices(plain.model, frame, index).get(plain.report.weapon.bone);
    assert.ok(m1.elements.every((x, i) => Math.abs(x - m2.elements[i]) < 1e-4), `${result.model.Sequences[index].Name} @${frame}: the sword moves as before`);
  }
});

test('C5 Footman on the Red Dragon: the weapon goes only where the whole dragon goes (its root scales to nothing in Death)', { skip: missing('transfer-footman', 'transfer-red-dragon') }, () => {
  assert.deepEqual(weaponHiddenAlone(transplant('transfer-footman', 'transfer-red-dragon', { extents: false })), []);
});

test('C8 Villager on the HD Footman: keys in time order, none two on one frame, though two animations share an interval and the list is out of time order', { skip: missing('transfer-villager', 'forge-hd-footman') }, () => {
  const result = transplant('transfer-villager', 'forge-hd-footman', { extents: false });
  const bad = tracksOf(result.model).filter(([, track]) => track.Keys.some((key, i) => i && !(key.Frame > track.Keys[i - 1].Frame))).map(([where]) => where);
  assert.deepEqual(bad, []);
  assert.deepEqual(validateModel(result.model).filter(d => d.code === 'KEYFRAME_ORDER').map(d => d.message), []);
});

test('C9 safety net: a donor key that is not a number never reaches the result; the report says what was held', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  const own = load('transfer-footman'), donor = load('transfer-grunt');
  const nodes = allNodes(donor), bone = nodes.find(b => b.Rotation?.Keys?.length > 2 && nodes.some(c => c.Parent === b.ObjectId));
  bone.Rotation.Keys[1].Vector = new Float32Array([NaN, 0, 0, 1]);
  const { model, report } = transplantSkeleton(own, donor, { extents: false });
  assert.deepEqual(nonFinite(model), []);
  assert.ok(report.reasons.some(reason => /not a number/i.test(reason)), report.reasons.join(' | '));
});

// ------------------------------------------------------------------ package D: the body is moved once
test('D1 a body joint under another joint is moved once: Footman on the Gargoyle, the lower foot as high as the Gargoyle\'s times travel (within 0.06 hip heights) in every animation but death and decay', { skip: missing('transfer-footman', 'transfer-gargoyle') }, () => {
  const { own, donor, model, report } = transplant('transfer-footman', 'transfer-gargoyle');
  [own, donor, model].forEach(clearTransferCache);
  const rigO = transferRig(own, { sequence: standSequenceIndex(own) }), rigD = transferRig(donor, { sequence: standSequenceIndex(donor) }), rigM = transferRig(model, { sequence: standSequenceIndex(model) });
  const legEnds = rig => Object.values(rig.parts).filter(part => part.limbKind === 'leg').map(part => part.marker);
  const feetM = legEnds(rigM), feetD = legEnds(rigD), nM = byId(model), nD = byId(donor), travel = report.counts.travel;
  assert.ok(feetM.length && feetD.length, 'both stand on legs');
  let worst = 0, where = '';
  for (const [index, frame] of moments(model, 12, /decay|portrait|death/i)) {
    const mm = sampleNodeMatrices(model, frame, index), md = sampleNodeMatrices(donor, frame, index);
    const mine = Math.min(...feetM.map(id => at(model, nM, mm, id).z)) - rigO.ground;
    const theirs = (Math.min(...feetD.map(id => at(donor, nD, md, id).z)) - rigD.ground) * travel;
    const off = Math.abs(mine - theirs) / rigO.hipHeight;
    if (off > worst) { worst = off; where = `${model.Sequences[index].Name} at ${frame}: ${mine.toFixed(1)} against ${theirs.toFixed(1)}`; }
  }
  assert.ok(worst < 0.06, `the lower foot is up to ${worst.toFixed(3)} hip heights off the Gargoyle's (${where})`);
});

test('D2 one joint carries the height: Footman on the Gargoyle, feet down changes Dummy01\'s position keys and leaves Bone_Root\'s as with feet free', { skip: missing('transfer-footman', 'transfer-gargoyle') }, () => {
  const down = transplant('transfer-footman', 'transfer-gargoyle').model, free = transplant('transfer-footman', 'transfer-gargoyle', { feet: 'free' }).model;
  const keys = (model, name) => JSON.stringify(allNodes(model).find(n => n.Name.trim() === name)?.Translation?.Keys ?? null, (key, value) => ArrayBuffer.isView(value) ? Array.from(value) : value);
  assert.notEqual(keys(down, 'Dummy01'), keys(free, 'Dummy01'), 'feet down moves Dummy01');
  assert.equal(keys(down, 'Bone_Root'), keys(free, 'Bone_Root'), 'Bone_Root, under Dummy01, is not moved again');
});

// ------------------------------------------------------------------ package B: size from the bodies, Poor fit
// docs/agent-tasks/xfer-transplant-fixes.md, "Package B".
/** Box of the skinned mesh at one moment (or the bind pose without `index`): { size: [x, y, z] }. */
function skinnedBox(model, index = null, frame = 0) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const matrices = index == null ? null : sampleNodeMatrices(model, frame, index);
  for (const geoset of model.Geosets) {
    const points = matrices ? skinGeoset(geoset, matrices) : geoset.Vertices;
    for (let i = 0; i + 2 < points.length; i += 3) for (let a = 0; a < 3; a++) if (Number.isFinite(points[i + a])) { lo[a] = Math.min(lo[a], points[i + a]); hi[a] = Math.max(hi[a], points[i + a]); }
  }
  return { size: hi.map((x, a) => x - lo[a]) };
}
const plainStand = model => { const index = model.Sequences.findIndex(s => /^stand$/i.test(String(s.Name).trim())); return index >= 0 ? index : standSequenceIndex(model); };
const momentsOf = (model, index, samples = 12) => { const [a, b] = model.Sequences[index].Interval; return Array.from({ length: samples + 1 }, (_, i) => Math.round(a + (b - a) * i / samples)); };

test('Z1 Kurgan on the Naga: a sane size, finite numbers, a mesh no bigger than twice its own', { skip: missing('transfer-kurgan', 'transfer-naga') }, () => {
  const { own, model, report } = transplant('transfer-kurgan', 'transfer-naga');
  assert.ok(report.counts.sizeRatio > 0.5 && report.counts.sizeRatio < 0.7, `size ${report.counts.sizeRatio} (was 42,222)`);
  for (const node of allNodes(model)) assert.ok(Array.from(node.PivotPoint).every(x => Number.isFinite(x) && Math.abs(x) < 1e4), `pivot of ${node.Name}`);
  for (const node of allNodes(model)) for (const p of ['Translation', 'Rotation', 'Scaling']) for (const key of node[p]?.Keys || []) assert.ok(Array.from(key.Vector).every(x => Number.isFinite(x) && Math.abs(x) < 1e4), `${node.Name}.${p} at ${key.Frame}`);
  const bind = skinnedBox(own).size, stand = plainStand(model);
  for (const frame of momentsOf(model, stand)) { const box = skinnedBox(model, stand, frame).size; box.forEach((x, a) => assert.ok(x <= 2 * bind[a], `Stand at ${frame}: axis ${a} ${x.toFixed(0)} against the Kurgan's ${bind[a].toFixed(0)}`)); }
});
test('Z2 Naga on the Footman: a sane size, the mesh does not collapse', { skip: missing('transfer-naga', 'transfer-footman') }, () => {
  const { own, model, report } = transplant('transfer-naga', 'transfer-footman');
  assert.ok(report.counts.sizeRatio > 1.7 && report.counts.sizeRatio < 2.2, `size ${report.counts.sizeRatio} (was 0.00002)`);
  const bind = skinnedBox(own).size, longest = bind.indexOf(Math.max(...bind)), stand = plainStand(model);
  for (const frame of momentsOf(model, stand)) assert.ok(skinnedBox(model, stand, frame).size[longest] >= 0.5 * bind[longest], `Stand at ${frame}`);
});
test('Z3 Footman on the Spider and on the Felhound: sizes from the bodies', { skip: missing('transfer-footman', 'transfer-spider', 'transfer-felhound') }, () => {
  const spider = transplant('transfer-footman', 'transfer-spider').report.counts.sizeRatio, felhound = transplant('transfer-footman', 'transfer-felhound').report.counts.sizeRatio;
  assert.ok(spider > 0.4 && spider < 0.8, `Spider ${spider} (was 29.1)`);
  assert.ok(felhound > 0.9 && felhound < 1.4, `Felhound ${felhound} (was 41,382)`);
});
test('Z4 Kurgan on the Tauren and Footman on the Grunt are untouched: size and travel as before', { skip: missing('transfer-kurgan', 'transfer-tauren', 'transfer-footman', 'transfer-grunt') }, () => {
  // Values from the parent commit 595082ae.
  for (const [a, b, size, travel] of [['transfer-kurgan', 'transfer-tauren', 0.8168622801719114, 0.7236860984815916], ['transfer-footman', 'transfer-grunt', 0.8781792505979258, 0.9126946621011351]]) {
    const { counts } = transplant(a, b).report;
    assert.ok(Math.abs(counts.sizeRatio - size) < 1e-12 && Math.abs(counts.travel - travel) < 1e-12, `${a} on ${b}: ${counts.sizeRatio}, ${counts.travel}`);
  }
});
test('F1 Kurgan on the Tauren and Footman on the Grunt are good fits', { skip: missing('transfer-kurgan', 'transfer-tauren', 'transfer-footman', 'transfer-grunt') }, () => {
  for (const [a, b] of [['transfer-kurgan', 'transfer-tauren'], ['transfer-footman', 'transfer-grunt']]) {
    const { report } = transplant(a, b);
    assert.equal(report.fit, 'good', report.reasons.join(' | '));
    assert.ok(report.follows >= 0.99, `${a}: ${report.follows}`);
    assert.deepEqual(report.still, []);
  }
});
test('F2 the share is the skin on paired parts: Kurgan on the Naga, hips and legs ride still', { skip: missing('transfer-kurgan', 'transfer-naga') }, () => {
  const { own, report } = transplant('transfer-kurgan', 'transfer-naga');
  for (const key of ['hips', 'legL', 'legR']) assert.ok(report.still.includes(key), `${key} rides still: ${report.still}`);
  assert.equal(report.fit, 'poor');
  // The share computed here: each vertex's bones in equal shares, by the part their nearest part joint belongs to.
  clearTransferCache(own);
  const rig = transferRig(own, { sequence: standSequenceIndex(own) }), partOf = new Map(), nodes = byId(own);
  for (const part of Object.values(rig.parts)) for (const id of part.joints) partOf.set(id, part.key);
  const partAbove = id => { for (let at = id; at != null && at !== -1; at = nodes.get(at)?.Parent) if (partOf.has(at)) return partOf.get(at); return null; };
  let body = 0, still = 0;
  for (const geoset of own.Geosets) for (let v = 0; v < geoset.Vertices.length / 3; v++) {
    const group = Array.from(geoset.Groups[geoset.VertexGroup[v]] || []);
    for (const id of group) { const key = partAbove(id); if (key == null) continue; body += 1 / group.length; if (report.still.includes(key)) still += 1 / group.length; }
  }
  assert.ok(Math.abs(report.follows - (1 - still / body)) < 0.01, `follows ${report.follows}, by the parts ${1 - still / body}`);
});
test('F3 one share line, one sentence per cause: Kurgan on the Magnataur', { skip: missing('transfer-kurgan', 'transfer-magnataur') }, () => {
  const { report } = transplant('transfer-kurgan', 'transfer-magnataur', { extents: false });
  assert.equal(report.fit, 'poor');
  assert.match(report.reasons[0], /^\d+% of the body follows the donor\.$/);
  assert.equal(report.reasons.filter(reason => reason.startsWith('The two models stand on a different number of legs')).length, 1, report.reasons.join(' | '));
  assert.ok(!report.reasons.some(reason => reason.includes('to give this model\'s')), report.reasons.join(' | '));
  assert.ok(report.reasons.length <= 4, report.reasons.join(' | '));
});
test('F4 bind poses alone are a note, not a poor fit: a Footman with a bind pose on the Grunt', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  const own = load('transfer-footman');
  own.BindPoses = [{ Matrices: [new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])] }];
  const { report } = transplantSkeleton(own, load('transfer-grunt'), { extents: false });
  assert.equal(report.fit, 'good', report.reasons.join(' | '));
  assert.ok(report.notes.includes('The open model has bind poses (Reforged skinning); they are left out of the result.'), report.notes.join(' | '));
});
test('F5 a tail alone is not a poor fit: Tauren on the Footman', { skip: missing('transfer-tauren', 'transfer-footman') }, () => {
  const { report } = transplant('transfer-tauren', 'transfer-footman');
  assert.deepEqual(report.still, ['tail']);
  assert.equal(report.fit, 'good', report.reasons.join(' | '));
  assert.ok(report.follows < 1, `follows ${report.follows}`);
});
test('F6 under half: Footman on the Wisp is a poor fit and is still made', { skip: missing('transfer-footman', 'transfer-wisp') }, () => {
  const result = transplant('transfer-footman', 'transfer-wisp');
  assert.ok(result.report.follows < 0.5, `follows ${result.report.follows}`);
  assert.equal(result.report.fit, 'poor');
  structural(result);
});

// ------------------------------------------------------------------ the weapon bone must be a hand (or below one)
test('W1 a weapon point on the donor\'s head is no weapon bone: Footman on the Gargoyle keeps the sword in the hand', { skip: missing('transfer-footman', 'transfer-gargoyle') }, () => {
  const { own, donor, model, report } = transplant('transfer-footman', 'transfer-gargoyle');
  const point = donorWeaponBone(donor);
  assert.equal(String(byId(donor).get(point).Name).trim(), 'Bone_Head', 'the Gargoyle\'s Weapon Ref hangs from its head');
  const head = report.donorNodes[point];
  assert.equal(report.weapon.rides, false, report.weapon.note);
  assert.equal(report.weapon.bone, null);
  // The sword (the bone the Footman's Weapon Ref hangs from and the bones under it) goes where the hand mesh goes.
  const rig = transferRig(own, { sequence: standSequenceIndex(own) }), hand = Object.values(rig.parts).find(part => part.weapon).marker;
  const mesh = own.Bones.find(bone => bone.Parent === hand && own.Bones.some(child => child.Parent === bone.ObjectId));
  const top = donorWeaponBone(own), under = id => { for (let at = id; at != null && at !== -1; at = own.Nodes[at]?.Parent ?? null) if (at === top) return true; return false; };
  const sword = own.Bones.map(bone => bone.ObjectId).filter(under), handNodes = new Set();
  own.Geosets.forEach((geoset, g) => { for (let v = 0; v < geoset.VertexGroup.length; v++) { const bones = Array.from(geoset.Groups[geoset.VertexGroup[v]]); if (bones.length === 1 && bones[0] === mesh.ObjectId) for (const id of model.Geosets[g].Groups[model.Geosets[g].VertexGroup[v]]) handNodes.add(id); } });
  let swordVertices = 0;
  own.Geosets.forEach((geoset, g) => { for (let v = 0; v < geoset.VertexGroup.length; v++) {
    const bones = Array.from(geoset.Groups[geoset.VertexGroup[v]]), result = Array.from(model.Geosets[g].Groups[model.Geosets[g].VertexGroup[v]]);
    if (!bones.length || !bones.every(id => sword.includes(id))) continue;
    swordVertices++;
    assert.ok(!result.includes(head), `sword vertex ${v} is not on the Gargoyle's head`);
    assert.ok(result.every(id => handNodes.has(id)), `sword vertex ${v} is on the hand's bones (${result} against ${[...handNodes]})`);
  } });
  assert.ok(swordVertices >= 10, `sword ${swordVertices} vertices`);
  structural({ own, donor, model, report });
});

// ------------------------------------------------------------------ twin chains and how he dies (xfer-both-ways.md, "Twin chains and how he dies")
const bonesOfVertex = (geoset, v) => geoset.SkinWeights?.length >= (v + 1) * 8 ? [0, 1, 2, 3].filter(i => geoset.SkinWeights[v * 8 + 4 + i] > 0).map(i => geoset.SkinWeights[v * 8 + i]) : Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []);
/** Own vertices ([geoset, vertex]) whose bones all pass `test`. */
const verticesOn = (own, test) => own.Geosets.flatMap((geoset, g) => Array.from({ length: geoset.Vertices.length / 3 }, (_, v) => [g, v]).filter(([, v]) => { const bones = bonesOfVertex(geoset, v); return bones.length && bones.every(test); }));
/** Centroid of result vertices at a frame of animation `index`. */
const centroidAt = (model, list, index, frame) => {
  const matrices = sampleNodeMatrices(model, frame, index), cache = new Map(), p = new Vector3();
  for (const [g, v] of list) { if (!cache.has(g)) cache.set(g, skinGeoset(model.Geosets[g], matrices)); const q = cache.get(g); p.x += q[v * 3]; p.y += q[v * 3 + 1]; p.z += q[v * 3 + 2]; }
  return p.divideScalar(list.length);
};
const geosetShown = (model, g, index, frame) => {
  const alpha = (model.GeosetAnims || []).find(anim => anim.GeosetId === g)?.Alpha;
  if (!alpha?.Keys?.length) return true;
  const sequence = model.Sequences[index];
  return sampleTrack(alpha, frame, { interval: sequence.Interval, globalSequences: model.GlobalSequences, fallback: 1 }) > 0.001;
};

test('G1 a twin chain moves with its twin: Ogre on the Tauren, the off-hand weapon on the second left arm keeps its place against the left hand in every animation but decay', { skip: missing('transfer-ogre-twin', 'transfer-tauren') }, () => {
  const result = transplant('transfer-ogre-twin', 'transfer-tauren'), { own, model, report } = result, nodes = byId(own);
  const named = name => allNodes(own).filter(node => String(node.Name).trim() === name).map(node => node.ObjectId);
  const [weapon] = named('Cylinder03'), hands = named('Bone_Hand_L');
  assert.equal(hands.length, 2, 'the Ogre has two left hands');
  const second = hands.find(id => nodes.get(weapon).Parent === id), realHand = hands.find(id => id !== second);
  assert.ok(second != null, 'the weapon hangs from one of them');
  const hand = verticesOn(own, id => id === realHand || nodes.get(id)?.Parent === realHand), blade = verticesOn(own, id => id === weapon);
  assert.ok(blade.length > 200 && hand.length > 0, `${blade.length} weapon and ${hand.length} hand vertices`);
  const hip = transferRig(own, { sequence: standSequenceIndex(own) }).hipHeight;
  model.Sequences.forEach((sequence, index) => {
    if (/decay|portrait/i.test(sequence.Name)) return;
    const [a, b] = sequence.Interval, d = [];
    for (let k = 0; k <= 8; k++) { const f = Math.round(a + (b - a) * k / 8); d.push(centroidAt(model, blade, index, f).distanceTo(centroidAt(model, hand, index, f))); }
    const spread = (Math.max(...d) - Math.min(...d)) / hip;
    assert.ok(spread <= 0.02, `${sequence.Name}: the weapon against the hand varies by ${spread.toFixed(3)} hip heights`);
  });
  structural(result);
});

test('G2 a corpse skeleton is no twin: Ghoul on the Grunt, his corpse joints are not paired', { skip: missing('transfer-ghoul', 'transfer-grunt') }, () => {
  const { report } = transplant('transfer-ghoul', 'transfer-grunt');
  assert.equal(report.twins, 0);
});

/** Geosets shown in the own Stand (living) and those shown only in Death (corpse). */
function swapBodies(own) {
  const stand = standSequenceIndex(own), death = own.Sequences.findIndex(s => /^death$/i.test(String(s.Name).trim()));
  const living = [], corpse = [], s = own.Sequences[stand].Interval, d = own.Sequences[death].Interval;
  own.Geosets.forEach((_, g) => { if (geosetShown(own, g, stand, (s[0] + s[1]) >> 1)) living.push(g); else if ([0.25, 0.5, 0.75, 1].some(t => geosetShown(own, g, death, Math.round(d[0] + t * (d[1] - d[0]))))) corpse.push(g); });
  return { living, corpse };
}
const deathMoments = model => model.Sequences.map((s, i) => [s, i]).filter(([s]) => /death/i.test(s.Name)).flatMap(([s, i]) => [0.25, 0.5, 0.75, 1].map(t => [i, Math.round(s.Interval[0] + t * (s.Interval[1] - s.Interval[0]))]));

test('G3 the living body dies (owner, 19 Nov 2026): Ghoul on the Grunt shows his living body and hides his corpse through the Grunt\'s Death', { skip: missing('transfer-ghoul', 'transfer-grunt') }, () => {
  const result = transplant('transfer-ghoul', 'transfer-grunt'), { own, model } = result;
  const { living, corpse } = swapBodies(own);
  assert.ok(living.length && corpse.length, `${living.length} living, ${corpse.length} corpse geosets`);
  for (const [i, f] of deathMoments(model)) {
    for (const g of living) assert.ok(geosetShown(model, g, i, f), `living geoset ${g} shown at ${f}`);
    for (const g of corpse) assert.ok(!geosetShown(model, g, i, f), `corpse geoset ${g} hidden at ${f}`);
  }
  structural(result);
});

test('G4 the living body dies: Skeleton Warrior on the Grunt shows his body through the Grunt\'s Death, his corpse never', { skip: missing('transfer-skeleton', 'transfer-grunt') }, () => {
  const result = transplant('transfer-skeleton', 'transfer-grunt'), { own, model } = result;
  const { living, corpse } = swapBodies(own);
  assert.ok(living.length && corpse.length, `${living.length} living, ${corpse.length} corpse geosets`);
  for (const [i, f] of deathMoments(model)) {
    for (const g of living) assert.ok(geosetShown(model, g, i, f), `living geoset ${g} shown at ${f}`);
    for (const g of corpse) assert.ok(!geosetShown(model, g, i, f), `corpse geoset ${g} hidden at ${f}`);
  }
});

test('G5 the body goes where the donor hides its own: Ghoul on the Grunt shows nothing of him in the Grunt\'s Decay Bone (its body is hidden there, its bones lie on other joints)', { skip: missing('transfer-ghoul', 'transfer-grunt') }, () => {
  const { model } = transplant('transfer-ghoul', 'transfer-grunt'), index = model.Sequences.findIndex(s => /decay bone/i.test(s.Name)), [a, b] = model.Sequences[index].Interval;
  for (const t of [0.1, 0.5, 0.9]) { const f = Math.round(a + t * (b - a)); assert.deepEqual(model.Geosets.map((_, g) => g).filter(g => geosetShown(model, g, index, f)), [], `nothing shown at ${f}`); }
  const decay = model.Sequences.findIndex(s => /decay flesh/i.test(s.Name)), mid = (model.Sequences[decay].Interval[0] + model.Sequences[decay].Interval[1]) >> 1;
  assert.ok(model.Geosets.some((_, g) => geosetShown(model, g, decay, mid)), 'his body still shows in Decay Flesh');
});

// ------------------------------------------------------------------ (f) posture: a transplant is 100% a transplant
// Owner, 19 Nov 2026: "A TRANSPLANT IS 100% A TRANSPLANT". The result takes the donor's posture as well as its motion:
// at every moment each paired stretch points as the donor's (relative to the body; both face the same way), the trunk
// and neck included (the Ghoul's hunch), with this model's own lengths. The trunk is read between landmarks (hip centre =
// first leg joints, shoulder centre = first arm joints) because riggers put trunk pivots anywhere. A leg's shin is straight
// along the donor's knee-to-foot line (owner's pick, P10) and is left out here. The donor is read as the transplant reads
// it (transplantReading: the Ghoul's arm ends at its moving hand, not at the still forearm skin bone named Wrist1).
const POSE_KINDS = [['Stand', /^stand(\s*-?\s*\d+)?$/i], ['Walk', /^walk$/i], ['Attack', /^attack/i], ['Death', /^death$/i]];
function posture({ donor, model, report }, moments = 9) {
  const rigA = transplantReading(transferRig(donor, { sequence: standSequenceIndex(donor) }), donor), map = report.donorNodes;
  const nD = byId(donor), nM = byId(model), inR = id => id != null && map[id] != null;
  const lines = [];
  for (const part of Object.values(rigA.parts)) {
    if (part.kind !== 'limb' || !part.joints.every(inR)) continue;
    const j = part.joints, last = part.limbKind === 'leg' && j.length > 3 ? 1 : j.length - 1;
    for (let i = 0; i < last; i++) lines.push({ kind: part.limbKind, name: `${nD.get(j[i]).Name} > ${nD.get(j[i + 1]).Name}`, from: [j[i]], to: [j[i + 1]] });
  }
  const roots = kind => Object.values(rigA.parts).filter(p => p.limbKind === kind && inR(p.joints[0])).map(p => p.joints[0]);
  const legs = roots('leg'), arms = roots('arm'), head = rigA.parts.head?.marker, neck = rigA.parts.head?.joints?.[0];
  if (legs.length && arms.length) lines.push({ kind: 'spine', name: 'hips > shoulders', from: legs, to: arms });
  if (inR(neck) && neck !== head && inR(head)) lines.push({ kind: 'neck', name: `${nD.get(neck).Name} > ${nD.get(head).Name}`, from: [neck], to: [head] });
  const armParts = Object.values(rigA.parts).filter(p => p.limbKind === 'arm' && p.joints.every(inR));
  const out = { worst: new Map(), corpse: new Set(), armLength: Infinity, armReach: Infinity, handsInside: [] };
  // Where the donor hides its living body and shows its corpse copy (the Ghoul's Death: joints named as the living ones
  // with 01), the donor's visible body is the corpse: the result follows that (donor corpse swap, xfer-overnight.md).
  const byName = new Map([...nD.values()].map(n => [n.Name, n.ObjectId])), stand = donor.Sequences[standSequenceIndex(donor)];
  const bodyGeoset = donor.Geosets.map((g, i) => [i, g.Vertices.length]).filter(([i]) => geosetShown(donor, i, donor.Sequences.indexOf(stand), stand.Interval[0])).sort((x, y) => y[1] - x[1])[0][0];
  let corpse = false;
  const visible = id => corpse && byName.has(`${nD.get(id).Name}01`) ? byName.get(`${nD.get(id).Name}01`) : id;
  const posD = m => id => at(donor, nD, m, visible(id)), posM = m => id => at(model, nM, m, map[id]);
  const mean = (pos, ids) => ids.map(pos).reduce((a, b) => a.add(b), new Vector3()).divideScalar(ids.length);
  const sum = (pos, part) => part.joints.slice(1).reduce((s, id, i) => s + pos(id).distanceTo(pos(part.joints[i])), 0);
  // Reach from where the arm's own line starts (the shoulder, not a collar): straight distance to the hand over the stretches.
  const reach = (pos, part) => { const s = Math.max(0, part.joints.indexOf(part.line?.find(id => part.joints.includes(id)))), arm = { joints: part.joints.slice(s) }; return pos(arm.joints[0]).distanceTo(pos(arm.joints.at(-1))) / sum(pos, arm); };
  const restM = id => new Vector3(...nodePivot(model, nM.get(map[id]), map[id]));
  const spine = [rigA.body, rigA.parts.chest?.marker, head].filter(inR);
  const toSpine = (pos, p) => Math.min(...spine.slice(1).map((id, i) => { const a = pos(spine[i]), ab = pos(id).sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-12))); return p.distanceTo(a.addScaledVector(ab, t)); }));
  const half = pos => armParts.length >= 2 ? pos(armParts[0].joints[0]).distanceTo(pos(armParts[1].joints[0])) / 2 : null;
  for (const [label, re] of POSE_KINDS) {
    const index = donor.Sequences.findIndex(s => re.test(String(s.Name).trim()));
    if (index < 0) continue;
    const [a, b] = donor.Sequences[index].Interval;
    for (let k = 0; k < moments; k++) {
      const frame = Math.round(a + (b - a) * k / (moments - 1));
      corpse = !geosetShown(donor, bodyGeoset, index, frame);
      const pd = posD(sampleNodeMatrices(donor, frame, index)), pm = posM(sampleNodeMatrices(model, frame, index));
      for (const line of lines) {
        const d = mean(pd, line.to).sub(mean(pd, line.from)), r = mean(pm, line.to).sub(mean(pm, line.from)), key = `${label}: ${line.kind} ${line.name}`;
        out.worst.set(key, Math.max(out.worst.get(key) ?? 0, d.angleTo(r) * 180 / Math.PI));
        if (corpse) out.corpse.add(key);
      }
      for (const part of armParts) {
        out.armLength = Math.min(out.armLength, sum(pm, part) / sum(restM, part));
        out.armReach = Math.min(out.armReach, reach(pm, part) / reach(pd, part));
        if (spine.length >= 2 && half(restM) && half(id => new Vector3(...nodePivot(donor, nD.get(id), id)))) {
          const h = part.joints.at(-1), inD = toSpine(pd, pd(h)) / half(id => new Vector3(...nodePivot(donor, nD.get(id), id))), inM = toSpine(pm, pm(h)) / half(restM);
          if (inM < 0.6 && inD >= 0.6) out.handsInside.push(`${label} ${frame} ${part.key}`);
        }
      }
    }
  }
  return out;
}
function assertPosture(result, label) {
  const p = posture(result), kinds = new Set([...p.worst.keys()].map(key => key.split(' ')[1]));
  assert.ok(kinds.has('spine') && kinds.has('arm') && kinds.has('leg'), `${label}: the trunk, arms and legs are measured (${[...kinds]})`);
  // On a corpse twin skeleton (the Ghoul's Death) the trunk line may be off up to 6 degrees: the corpse's waist is a root of
  // its own, so the result's waist (under its root, on this model's pivots) turns about another place (Footman 5.4).
  for (const [key, worst] of p.worst) assert.ok(worst < (p.corpse.has(key) && / spine /.test(key) ? 6 : 3), `${label}, ${key}: up to ${worst.toFixed(1)} degrees from the donor's`);
  assert.ok(p.armLength >= 0.8, `${label}: an arm is ${(p.armLength * 100).toFixed(0)}% of its rest length`);
  assert.ok(p.armReach >= 0.8, `${label}: an arm reaches ${(p.armReach * 100).toFixed(0)}% as far as the donor's`);
  assert.deepEqual(p.handsInside, [], `${label}: a hand inside the torso where the donor's is not`);
}

test('Q1 Berserker on the Ghoul: hunched like the Ghoul, arms hanging at its sides: every stretch, the trunk and the neck point as the Ghoul\'s in Stand, Walk, Attack and Death', { skip: missing('transfer-berserker', 'transfer-ghoul') }, () => {
  const result = transplant('transfer-berserker', 'transfer-ghoul');
  structural(result);
  assertPosture(result, 'Berserker on the Ghoul');
  // The hunch is real: the trunk turned forward by far more than a little.
  assert.ok(result.report.counts.posture.spine > 30, `the trunk turned ${result.report.counts.posture.spine?.toFixed(0)} degrees into the Ghoul's posture`);
});

test('Q2 Kurgan on the Tauren: the Tauren\'s posture: every stretch, the trunk and the neck point as the Tauren\'s in Stand, Walk, Attack and Death', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  assertPosture(transplant('transfer-kurgan', 'transfer-tauren'), 'Kurgan on the Tauren');
});

test('Q3 the donor\'s keys are the donor\'s: no rotation key of a donor joint carries a correction (the posture is in the bind pose)', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  const { donor, model, report } = transplant('transfer-kurgan', 'transfer-tauren'), nM = byId(model);
  let checked = 0;
  for (const node of [...donor.Bones, ...donor.Helpers]) {
    const id = report.donorNodes[node.ObjectId], copy = id != null ? nM.get(id) : null;
    if (!copy || !node.Rotation?.Keys?.length) continue;
    assert.equal(copy.Rotation?.Keys?.length, node.Rotation.Keys.length, `${node.Name}: as many rotation keys`);
    node.Rotation.Keys.forEach((key, i) => assert.ok(Array.from(key.Vector).every((v, c) => Math.abs(v - copy.Rotation.Keys[i].Vector[c]) < 1e-6), `${node.Name} key ${i} is the Tauren's`));
    checked++;
  }
  assert.ok(checked > 20, `${checked} turning joints checked`);
});

test('Q4 Footman on the Ghoul: the arm ends at the Ghoul\'s moving hand, not at its still forearm skin bone (Wrist1)', { skip: missing('transfer-footman', 'transfer-ghoul') }, () => {
  const result = transplant('transfer-footman', 'transfer-ghoul'), { donor } = result;
  const raw = transferRig(donor, { sequence: standSequenceIndex(donor) }), read = transplantReading(raw, donor);
  for (const key of ['armL', 'armR']) {
    // R2: the shared reading ends the arm at the hand (anim-transfer endAtMovingJoints); the transplant reads it as it is.
    assert.match(donor.Nodes[raw.parts[key].marker].Name, /^Bone_Hand_/, `the shared reading ends ${key} at the hand`);
    assert.match(donor.Nodes[read.parts[key].marker].Name, /^Bone_Hand_/, `the transplant reads ${key} to the hand`);
  }
  assert.equal(read, raw, 'the transplant reads the shared reading as it is');
  assertPosture(result, 'Footman on the Ghoul');
});
test('Q5 Grunt on the Ghoul: the feet stay on the Ghoul\'s ground in every animation but Death (the result\'s legs are read as the donor\'s, not from the re-posed result, which reads the Ghoul\'s corpse skeleton)', { skip: missing('transfer-grunt', 'transfer-ghoul') }, () => {
  const { own, donor, model, report } = transplant('transfer-grunt', 'transfer-ghoul'), nM = byId(model), nD = byId(donor);
  const rigG = transferRig(donor, { sequence: standSequenceIndex(donor) }), rigO = transferRig(own, { sequence: standSequenceIndex(own) });
  const feetD = Object.values(rigG.parts).filter(p => p.limbKind === 'leg').map(p => p.marker), feetM = feetD.map(id => report.donorNodes[id]);
  let worst = { d: 0 };
  for (const [index, frame] of moments(model, 12, /death|decay|portrait/i)) {
    const md = sampleNodeMatrices(donor, frame, index), mm = sampleNodeMatrices(model, frame, index);
    const target = (Math.min(...feetD.map(id => at(donor, nD, md, id).z)) - rigG.ground) * report.counts.travel, got = Math.min(...feetM.map(id => at(model, nM, mm, id).z)) - rigO.ground;
    if (Math.abs(got - target) > worst.d) worst = { d: Math.abs(got - target), name: model.Sequences[index].Name, frame };
  }
  assert.ok(worst.d < 0.06 * rigO.hipHeight, `${worst.name} ${worst.frame}: the lower foot is ${worst.d.toFixed(1)} off the Ghoul's (hip height ${rigO.hipHeight.toFixed(0)})`);
});

// ------------------------------------------------------------------ hidden geosets stay hidden (xfer-overnight.md: identity sweep, geoset class)
/** Whether geoset `g` shows anywhere in animation `index` (its ends, middle and every key inside). */
const shownIn = (model, g, index) => {
  const alpha = (model.GeosetAnims || []).find(anim => anim.GeosetId === g)?.Alpha, [a, b] = model.Sequences[index].Interval;
  return [a, (a + b) >> 1, b, ...(alpha?.Keys || []).map(key => key.Frame).filter(f => f >= a && f <= b)].some(f => geosetShown(model, g, index, f));
};
/** Every geoset of a model transplanted onto itself shows in every animation but death and decay exactly where its own does. */
function sameShowing(key) {
  const result = transplant(key, key, { mirror: false }), { own, model } = result, wrong = [];
  own.Sequences.forEach((sequence, index) => {
    if (/death|decay|dissipate/i.test(sequence.Name)) return;
    own.Geosets.forEach((_, g) => { if (shownIn(model, g, index) !== shownIn(own, g, index)) wrong.push(`${sequence.Name}: geoset ${g} ${shownIn(own, g, index) ? 'hidden' : 'shown'}`); });
  });
  assert.deepEqual(wrong, [], 'every geoset shows as in its own animation');
  return result;
}

test('H1 Penguin on itself: its corpse and portrait geosets stay hidden where its own animations hide them (they showed in Stand: 58% of its vertices)', { skip: missing('transfer-penguin') }, () => {
  const { own, model } = sameShowing('transfer-penguin'), stand = standSequenceIndex(own);
  const hidden = own.Geosets.map((_, g) => g).filter(g => !shownIn(own, g, stand));
  assert.ok(hidden.length >= 3, `${hidden.length} geosets hidden in its Stand`);
  for (const g of hidden) assert.ok(!shownIn(model, g, stand), `geoset ${g} hidden in Stand`);
});

test('H2 LowPolyWorks Ogre on itself: every geoset shows as in its own animations', { skip: missing('transfer-ogre-twin') }, () => {
  sameShowing('transfer-ogre-twin');
});

test('H3 Ghoul on the Grunt: in the Grunt\'s living animations he shows exactly what his own Stand shows (his corpse never)', { skip: missing('transfer-ghoul', 'transfer-grunt') }, () => {
  const { own, model } = transplant('transfer-ghoul', 'transfer-grunt'), stand = standSequenceIndex(own);
  const living = own.Geosets.map((_, g) => g).filter(g => shownIn(own, g, stand));
  model.Sequences.forEach((sequence, index) => {
    if (/death|decay|dissipate|portrait/i.test(sequence.Name)) return;
    const shown = model.Geosets.map((_, g) => g).filter(g => shownIn(model, g, index));
    assert.deepEqual(shown, living, `${sequence.Name}: the geosets of his own Stand`);
  });
});

// ------------------------------------------------------------------ G1 soles down where the legs do not pair (xfer-overnight.md)
// The donor's legs carry none of this model's skin, so its feet cannot be put down: this model's own sole goes down as
// the donor stands (legged donor) or rises and falls with the donor's body (legless, hovering donor).
/** The lowest point of the geosets `living` (skinned) at a moment. */
const lowestOf = (model, living, index, frame) => {
  const m = sampleNodeMatrices(model, frame, index);
  let low = Infinity;
  for (const g of living) { const p = skinGeoset(model.Geosets[g], m); for (let i = 2; i < p.length; i += 3) low = Math.min(low, p[i]); }
  return low;
};
const heightOf = model => { let lo = Infinity, hi = -Infinity; for (const g of model.Geosets) for (let i = 2; i < g.Vertices.length; i += 3) { lo = Math.min(lo, g.Vertices[i]); hi = Math.max(hi, g.Vertices[i]); } return hi - lo; };
const standLiving = model => { const stand = standSequenceIndex(model); return model.Geosets.map((_, g) => g).filter(g => geosetShown(model, g, stand, model.Sequences[stand].Interval[0])); };
const everydayMoments = (model, each) => model.Sequences.forEach((sequence, index) => {
  if (/death|decay|dissipate|portrait|birth|morph/i.test(sequence.Name)) return;
  const [a, b] = sequence.Interval;
  for (const t of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]) each(sequence, index, Math.round(a + t * (b - a)));
});

test('S1 Rat on the Dire Wolf: where the wolf stands on its feet the rat stands on the ground as in its own Stand (it floated half its height)', { skip: missing('transfer-rat', 'transfer-direwolf') }, () => {
  const { own, donor, model, report } = transplant('transfer-rat', 'transfer-direwolf');
  // Since R1 the rat reads its four two-joint legs and the wolf its fourth leg: the legs pair, but the rat's legs end at
  // the shin (no foot joint), so its soles go down. Measured on the rat's legs (its long tail follows the wolf's tail).
  assert.equal(report.counts.ground, 'soles');
  const living = standLiving(own), stand = standSequenceIndex(own), H = heightOf(own);
  const rigD = transferRig(donor, { sequence: standSequenceIndex(donor) }), nD = byId(donor), feet = Object.values(rigD.parts).filter(part => part.limbKind === 'leg').map(part => part.marker);
  const rigO = transferRig(own, { sequence: stand }), legsOf = rig => Object.values(rig.parts).filter(part => part.limbKind === 'leg').flatMap(part => part.joints);
  const ownLegs = new Set(legsOf(rigO)), resultLegs = new Set(legsOf(rigD).map(id => report.donorNodes[id]).filter(id => id != null));
  // Skin (any weight) on the leg joints or on the skin bones that hang from them.
  const lowestOn = (m, joints, index, frame) => { const tree = nodeIndex(m), onLeg = id => [...joints].some(joint => tree.isAncestor(id, joint)), mats = sampleNodeMatrices(m, frame, index); let low = Infinity; for (const g of living) { const geoset = m.Geosets[g], p = skinGeoset(geoset, mats); for (let v = 0; v < p.length / 3; v++) if (vertexBones(geoset, v).some(onLeg)) low = Math.min(low, p[v * 3 + 2]); } return low; };
  const rest = lowestOn(own, ownLegs, stand, own.Sequences[stand].Interval[0]);
  assert.ok(Number.isFinite(rest), 'the rat has leg skin');
  let worst = { d: 0 }, checked = 0;
  everydayMoments(model, (sequence, index, frame) => {
    const md = sampleNodeMatrices(donor, frame, index);
    if (Math.min(...feet.map(id => at(donor, nD, md, id).z)) - rigD.ground > 0.05 * rigD.hipHeight) return; // the wolf's feet are off the ground
    checked++;
    const d = Math.abs(lowestOn(model, resultLegs, index, frame) - rest);
    if (d > worst.d) worst = { d, name: sequence.Name, frame };
  });
  assert.ok(checked > 20, `${checked} moments with the wolf on its feet`);
  assert.ok(worst.d < 0.1 * H, `${worst.name} ${worst.frame}: the rat's lowest foot is ${(worst.d / H).toFixed(2)} of its height off its own Stand's`);
});

test('S2 Footman on the Banshee (no legs, hovers): the Footman rises and falls with the Banshee\'s body from his own ground (he floated nearly his height)', { skip: missing('transfer-footman', 'transfer-banshee') }, () => {
  const { own, donor, model, report } = transplant('transfer-footman', 'transfer-banshee');
  assert.equal(report.counts.ground, 'hover');
  const living = standLiving(own), stand = standSequenceIndex(own), rest = lowestOf(own, living, stand, own.Sequences[stand].Interval[0]), H = heightOf(own);
  const rigD = transferRig(donor, { sequence: standSequenceIndex(donor) }), nD = byId(donor), dStand = standSequenceIndex(donor);
  const bodyRest = at(donor, nD, sampleNodeMatrices(donor, donor.Sequences[dStand].Interval[0], dStand), rigD.body).z;
  let worst = { d: 0 };
  everydayMoments(model, (sequence, index, frame) => {
    const rise = (at(donor, nD, sampleNodeMatrices(donor, frame, index), rigD.body).z - bodyRest) * report.counts.travel;
    const d = Math.abs(lowestOf(model, living, index, frame) - rest - rise);
    if (d > worst.d) worst = { d, name: sequence.Name, frame };
  });
  assert.ok(worst.d < 0.1 * H, `${worst.name} ${worst.frame}: the Footman's lowest point is ${(worst.d / H).toFixed(2)} of his height off his own ground plus the Banshee's rise`);
});

// ------------------------------------------------------------------ donor corpse swap (xfer-overnight.md, 20 Nov 2026)
// The Ghoul hides its living body in its Death and shows a corpse copy on a twin skeleton (joints named as the living ones
// with 01). The model on the Ghoul stays visible all through the Death (it vanished: the owner's Berserker/Kurgan on the
// Ghoul) and falls as the corpse does: its root > head line is as close to the corpse's as it is to the living Ghoul's
// in Stand, Walk and Attack (this model's own proportions make that line differ a little everywhere).
for (const [label, ownKey] of [['Berserker', 'transfer-berserker'], ['Kurgan', 'transfer-kurgan'], ['Footman', 'transfer-footman']]) {
  test(`C1 ${label} on the Ghoul: visible all through the Ghoul's Death and falls as its corpse does`, { skip: missing(ownKey, 'transfer-ghoul') }, () => {
    const { own, donor, model, report } = transplant(ownKey, 'transfer-ghoul');
    const living = standLiving(own), total = living.reduce((n, g) => n + own.Geosets[g].Vertices.length, 0);
    const nD = byId(donor), nM = byId(model), named = new Map([...nD.values()].map(n => [n.Name, n.ObjectId]));
    const rigD = transferRig(donor, { sequence: standSequenceIndex(donor) }), root = rigD.body, head = rigD.parts.head?.marker;
    const lineOff = (index, twin) => {
      const [a, b] = model.Sequences[index].Interval;
      let worst = 0;
      for (let k = 0; k <= 8; k++) {
        const frame = Math.round(a + (b - a) * k / 8), md = sampleNodeMatrices(donor, frame, index), mm = sampleNodeMatrices(model, frame, index);
        const d = at(donor, nD, md, twin(head)).sub(at(donor, nD, md, twin(root))), r = at(model, nM, mm, report.donorNodes[head]).sub(at(model, nM, mm, report.donorNodes[root]));
        worst = Math.max(worst, d.angleTo(r) * 180 / Math.PI);
      }
      return worst;
    };
    const everyday = Math.max(...model.Sequences.map((s, i) => /^(stand|walk|attack)/i.test(s.Name) ? lineOff(i, id => id) : 0));
    const index = model.Sequences.findIndex(s => /^death$/i.test(String(s.Name).trim())), [a, b] = model.Sequences[index].Interval;
    for (let k = 0; k <= 8; k++) {
      const frame = Math.round(a + (b - a) * k / 8), shown = living.filter(g => geosetShown(model, g, index, frame)).reduce((n, g) => n + own.Geosets[g].Vertices.length, 0);
      assert.ok(shown >= 0.95 * total, `${frame}: ${(shown / total * 100).toFixed(0)}% of his living body shows`);
    }
    const death = lineOff(index, id => named.get(`${nD.get(id).Name}01`));
    assert.ok(death <= everyday + 3, `Death: the root > head line is up to ${death.toFixed(1)} degrees off the corpse's (${everyday.toFixed(1)} off the living Ghoul's in Stand, Walk and Attack)`);
    assert.ok(report.deathSwap.some(swap => /^death$/i.test(swap.sequence) && swap.twin), 'the swap is reported');
  });
}

// ------------------------------------------------------------------ T1 no skeleton (xfer-overnight.md: 6.8% of the sweep threw)
test('N1 a model or donor with no bone or helper (Plague Cloud) is refused in plain words, not "Geoset 0 references missing node NaN"', { skip: missing('transfer-footman', 'transfer-plague-cloud') }, () => {
  assert.throws(() => transplantSkeleton(load('transfer-footman'), load('transfer-plague-cloud')), { message: /^The donor has no skeleton to transplant onto/ });
  assert.throws(() => transplantSkeleton(load('transfer-plague-cloud'), load('transfer-footman')), { message: /^This model has no skeleton to transplant/ });
});

// ------------------------------------------------------------------ G1b and the sweep-v2 throws (out/transfer-probe/overnight/analysis-v2/classes.md, rows 6 and 8)
/** Error codes of the result that neither the open model nor the donor has itself. */
const newErrors = ({ own, donor, model }) => { const codes = m => new Set(validateModel(m).filter(d => d.severity === 'error').map(d => d.code)), known = new Set([...codes(own), ...codes(donor)]); return [...codes(model)].filter(code => !known.has(code)); };
const finite = model => model.Geosets.every(g => Array.from(g.Vertices).every(Number.isFinite)) && allNodes(model).every(n => Array.from(n.PivotPoint || [0, 0, 0]).every(Number.isFinite));
const centreAgainst = (model, m, joint) => { const c = new Vector3(); let n = 0; for (const g of model.Geosets) { const p = skinGeoset(g, m); for (let i = 0; i < p.length; i += 3) { c.x += p[i]; c.y += p[i + 1]; c.z += p[i + 2]; n++; } } return c.divideScalar(n).sub(at(model, byId(model), m, joint)); };

test('S3 Faerie Dragon on the Footman (legs do not pair): where the Footman stands on its feet, its sole is where it usually is in its own Stand, not where it is at the Stand\'s first frame (its dangling legs swing 1.3 hip heights)', { skip: missing('transfer-faerie-dragon', 'transfer-footman') }, () => {
  const { own, donor, model, report } = transplant('transfer-faerie-dragon', 'transfer-footman');
  assert.equal(report.counts.ground, 'soles');
  const stand = standSequenceIndex(own), rigB = transplantReading(transferRig(own, { sequence: stand }), own), hip = rigB.hipHeight;
  const legJoints = new Set(Object.values(rigB.parts).filter(part => part.limbKind === 'leg').flatMap(part => part.joints)), nB = byId(own);
  const onLeg = id => { for (let x = id; x != null && x !== -1; x = nB.get(x)?.Parent) if (legJoints.has(x)) return true; return false; };
  const sole = [];
  for (const g of standLiving(own)) { const geoset = own.Geosets[g]; for (let v = 0; v < geoset.Vertices.length / 3; v++) if (Array.from(geoset.Groups[geoset.VertexGroup[v]] || []).some(onLeg)) sole.push([g, v]); }
  assert.ok(sole.length > 10, `${sole.length} vertices on its legs`);
  const soleAt = (target, index, frame) => { const m = sampleNodeMatrices(target, frame, index), cache = new Map(); let low = Infinity; for (const [g, v] of sole) { if (!cache.has(g)) cache.set(g, skinGeoset(target.Geosets[g], m)); low = Math.min(low, cache.get(g)[v * 3 + 2]); } return low; };
  const [a, b] = own.Sequences[stand].Interval, standSoles = Array.from({ length: 12 }, (_, k) => soleAt(own, stand, Math.round(a + k / 11 * (b - a)))).sort((x, y) => x - y);
  const usual = (standSoles[5] + standSoles[6]) / 2;
  assert.ok(Math.abs(soleAt(own, stand, a) - usual) > 0.3 * hip, 'its first frame is not its usual sole (else this test proves nothing)');
  const rigD = transferRig(donor, { sequence: standSequenceIndex(donor) }), nD = byId(donor), feet = Object.values(rigD.parts).filter(part => part.limbKind === 'leg').map(part => part.marker);
  let worst = { d: 0 }, checked = 0;
  everydayMoments(model, (sequence, index, frame) => {
    const md = sampleNodeMatrices(donor, frame, index);
    if (Math.min(...feet.map(id => at(donor, nD, md, id).z)) - rigD.ground > 0.05 * rigD.hipHeight) return; // the Footman's feet are off the ground
    checked++;
    const d = Math.abs(soleAt(model, index, frame) - usual);
    if (d > worst.d) worst = { d, name: sequence.Name, frame };
  });
  assert.ok(checked > 20, `${checked} moments with the Footman on his feet`);
  assert.ok(worst.d < 0.1 * hip, `${worst.name} ${worst.frame}: the dragon's sole is ${(worst.d / hip).toFixed(2)} hip heights off its usual Stand sole`);
});

test('V1 Undead Car on the Footman is made (it threw "Maximum call stack size exceeded": its skinned master root follows its hips, whose anchor it is)', { skip: missing('transfer-undead-car', 'transfer-footman') }, () => {
  const result = transplant('transfer-undead-car', 'transfer-footman', { mirror: false }), { own, donor, model, report } = result;
  assert.deepEqual(newErrors(result), [], 'no error the car or the Footman does not have itself');
  assert.ok(finite(model), 'finite vertices and pivots');
  assert.ok(report.riders.some(rider => rider.name === 'Bone_MasterRoot'), 'the car body rides its hips');
  // Its body moves with the Footman's body joint: through the Walk its centre keeps one place against that joint.
  const body = report.donorNodes[transferRig(donor, { sequence: standSequenceIndex(donor) }).body], hip = transferRig(own, { sequence: standSequenceIndex(own) }).hipHeight;
  const index = model.Sequences.findIndex(s => /^walk/i.test(s.Name)), [a, b] = model.Sequences[index].Interval;
  const offsets = Array.from({ length: 9 }, (_, k) => centreAgainst(model, sampleNodeMatrices(model, Math.round(a + k / 8 * (b - a)), index), body));
  for (const o of offsets) assert.ok(o.distanceTo(offsets[0]) < 0.5 * hip, `the car's centre drifts ${(o.distanceTo(offsets[0]) / hip).toFixed(2)} hip heights against the Footman's body in Walk`);
});

test('V2 Revenant on the Skink High Priest is made with the weapon on the staff bone (it threw "reading elements of undefined": the hand Wrist1 went, all its skin on the weapon)', { skip: missing('transfer-revenant', 'transfer-skink-priest') }, () => {
  const result = transplant('transfer-revenant', 'transfer-skink-priest', { mirror: false }), { own, donor, model, report } = result;
  assert.deepEqual(newErrors(result), [], 'no error the Revenant or the Skink does not have itself');
  assert.ok(finite(model), 'finite vertices and pivots');
  assert.ok(report.weapon.rides && report.weapon.vertices > 0, 'the weapon rides the staff bone');
  assert.equal(byId(model).get(report.weapon.bone)?.Name, 'bone_staff');
  // Held in the hand: at the first frame of the Stand the weapon's nearest vertex is at the Skink's hand.
  const wrist = allNodes(donor).find(n => n.Name === 'Wrist1').ObjectId, hand = report.donorNodes[wrist];
  assert.ok(hand != null, 'the hand the weapon was baked onto is kept');
  const stand = standSequenceIndex(model), m = sampleNodeMatrices(model, model.Sequences[stand].Interval[0], stand), handAt = at(model, byId(model), m, hand);
  let near = Infinity;
  for (const g of model.Geosets) { const p = skinGeoset(g, m); for (let v = 0; v < g.Vertices.length / 3; v++) if (Array.from(g.Groups[g.VertexGroup[v]] || []).includes(report.weapon.bone)) near = Math.min(near, handAt.distanceTo(new Vector3(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]))); }
  const hip = transferRig(own, { sequence: standSequenceIndex(own) }).hipHeight;
  assert.ok(near < 0.3 * hip, `the weapon's nearest vertex is ${(near / hip).toFixed(2)} hip heights from the hand`);
});

test('V3 White Wolf on the Far Seer: every key is on a signed 32-bit frame in time order (the Far Seer\'s animation "nothing" runs from 4294967129 to 0: KEYFRAME_ORDER)', { skip: missing('transfer-white-wolf', 'transfer-far-seer') }, () => {
  const result = transplant('transfer-white-wolf', 'transfer-far-seer', { mirror: false });
  assert.deepEqual(newErrors(result), [], 'no error the wolf or the Far Seer does not have itself');
  assert.ok(result.model.Sequences.some(s => s.Name === 'nothing'), "the donor's animation list is kept as it is");
});

test('R10 the two legs pair alike: on the Lord of Change the Footman\'s and the Bandit\'s donor legs mirror each other joint by joint', { skip: missing('transfer-footman', 'sd-bandit', 'transfer-lord-of-change') }, () => {
  // XFER row 10: scored leg by leg, a near tie put one knee on the donor's knee and the other on its hock.
  for (const key of ['transfer-footman', 'sd-bandit']) {
    const own = load(key), donor = load('transfer-lord-of-change');
    const { model, report } = transplantSkeleton(own, donor);
    const hip = transferRig(own).hipHeight, at = name => { const d = allNodes(donor).find(n => n.Name === name); const r = model.Nodes[report.donorNodes[d.ObjectId]]; return new Vector3(...nodePivot(model, r, r.ObjectId)); };
    // Each joint from its own leg's top (the Bandit stands off the middle line), the right side mirrored.
    for (const joint of ['B_Leg_2_', 'B_Leg_3_', 'B_Foot_']) {
      const left = at(joint + 'L').sub(at('B_Leg_1_L')), right = at(joint + 'R').sub(at('B_Leg_1_R')).multiply(new Vector3(1, -1, 1));
      assert.ok(left.distanceTo(right) < 0.05 * hip, `${key}: ${joint}L and ${joint}R are ${(left.distanceTo(right) / hip).toFixed(2)} hip heights from mirrored`);
    }
  }
});

test('S4 Footman on the Rat (short legs, no foot joint): through the rat\'s hopping Walk his soles rise and land as its paws do (they followed its shin joints, 0.2 hip heights off)', { skip: missing('transfer-footman', 'transfer-rat') }, () => {
  const { own, donor, model, report } = transplant('transfer-footman', 'transfer-rat');
  assert.equal(report.counts.ground, 'soles');
  /** The vertices a model's legs carry in its Stand, their lowest height at a moment, and where it usually is in its Stand. */
  const soleOf = m => {
    const stand = standSequenceIndex(m), rig = transplantReading(transferRig(m, { sequence: stand }), m), n = byId(m);
    const legJoints = new Set(Object.values(rig.parts).filter(part => part.limbKind === 'leg').flatMap(part => part.joints));
    const onLeg = id => { for (let x = id; x != null && x !== -1; x = n.get(x)?.Parent) if (legJoints.has(x)) return true; return false; };
    const list = [];
    for (const g of standLiving(m)) { const geoset = m.Geosets[g]; for (let v = 0; v < geoset.Vertices.length / 3; v++) if (vertexBones(geoset, v).some(onLeg)) list.push([g, v]); }
    const at = (target, index, frame) => { const mats = sampleNodeMatrices(target, frame, index), cache = new Map(); let low = Infinity; for (const [g, v] of list) { if (!cache.has(g)) cache.set(g, skinGeoset(target.Geosets[g], mats)); low = Math.min(low, cache.get(g)[v * 3 + 2]); } return low; };
    const [a, b] = m.Sequences[stand].Interval, soles = Array.from({ length: 12 }, (_, k) => at(m, stand, Math.round(a + k / 11 * (b - a)))).sort((x, y) => x - y);
    return { list, at, usual: (soles[5] + soles[6]) / 2, hip: rig.hipHeight };
  };
  const mine = soleOf(own), rat = soleOf(donor);
  assert.ok(mine.list.length > 10 && rat.list.length > 10, 'both have leg skin');
  const index = model.Sequences.findIndex(s => /^walk/i.test(s.Name)), [a, b] = model.Sequences[index].Interval;
  const offs = Array.from({ length: 13 }, (_, k) => { const frame = Math.round(a + k / 12 * (b - a)); return Math.abs((mine.at(model, index, frame) - mine.usual) - (rat.at(donor, index, frame) - rat.usual) * report.counts.travel) / mine.hip; }).sort((x, y) => x - y);
  assert.ok(offs[6] < 0.1, `Walk: his sole is a median ${offs[6].toFixed(2)} hip heights off the rat's paws (worst ${offs.at(-1).toFixed(2)})`);
});

test('T2 Ghoul on the Satyr: it bows as deep as the Satyr in Stand - 3 (the hips-to-shoulders line within 8 deg of the Satyr\'s at every moment; it bowed 24 instead of 61 deg: the Satyr\'s trunk skin is all on one joint, so its chest joint stayed at the Ghoul\'s own chest, half way up, instead of at hip height where the Satyr bends)', { skip: missing('transfer-ghoul', 'transfer-satyr') }, () => {
  const { donor, model, report } = transplant('transfer-ghoul', 'transfer-satyr');
  const rig = transferRig(donor, { sequence: standSequenceIndex(donor) });
  const roots = kind => Object.values(rig.parts).filter(part => part.limbKind === kind).map(part => part.joints[0]);
  const legs = roots('leg'), arms = roots('arm');
  assert.equal(legs.length, 2); assert.equal(arms.length, 2);
  /** The angle of the line from the hip centre (first leg joints) to the shoulder centre (first arm joints) from straight up. */
  const pitch = (m, index, frame, idOf) => {
    const mats = sampleNodeMatrices(m, frame, index);
    const centre = ids => ids.map(id => { const r = idOf(id); return new Vector3(...nodePivot(m, m.Nodes[r], r)).applyMatrix4(mats.get(r)); }).reduce((s, p) => s.add(p), new Vector3()).divideScalar(ids.length);
    const line = centre(arms).sub(centre(legs));
    return Math.atan2(Math.hypot(line.x, line.y), line.z) * 180 / Math.PI;
  };
  const iD = donor.Sequences.findIndex(s => s.Name === 'Stand - 3'), iM = model.Sequences.findIndex(s => s.Name === 'Stand - 3');
  const [a, b] = donor.Sequences[iD].Interval, [c, d] = model.Sequences[iM].Interval;
  let worst = 0, deepest = 0;
  for (let k = 0; k <= 12; k++) {
    const theirs = pitch(donor, iD, Math.round(a + k / 12 * (b - a)), id => id), mine = pitch(model, iM, Math.round(c + k / 12 * (d - c)), id => report.donorNodes[id]);
    worst = Math.max(worst, Math.abs(mine - theirs)); deepest = Math.max(deepest, theirs);
  }
  assert.ok(deepest > 45, `the Satyr bows ${deepest.toFixed(0)} deg in Stand - 3`);
  assert.ok(worst < 8, `the Ghoul's trunk line is up to ${worst.toFixed(1)} deg off the Satyr's in Stand - 3`);
});

test('T3 Forest Troll Trapper on the Kobold: its shoulders swing as the Kobold\'s do (the shoulder line within 6 deg of the Kobold\'s through Attack - 2; it was 36 deg off: the Kobold moves its shoulders by position keys, and those were scaled by the whole-body travel ratio, 2.5, far over this trunk\'s own length and width ratios)', { skip: missing('transfer-troll-trapper', 'transfer-kobold') }, () => {
  const { donor, model, report } = transplant('transfer-troll-trapper', 'transfer-kobold');
  const rig = transferRig(donor, { sequence: standSequenceIndex(donor) });
  const left = rig.parts.armL.joints[0], right = rig.parts.armR.joints[0];
  const line = (m, index, frame, idOf) => { const mats = sampleNodeMatrices(m, frame, index), at = id => { const r = idOf(id); return new Vector3(...nodePivot(m, m.Nodes[r], r)).applyMatrix4(mats.get(r)); }; return at(left).sub(at(right)).normalize(); };
  const iD = donor.Sequences.findIndex(s => s.Name === 'Attack - 2'), iM = model.Sequences.findIndex(s => s.Name === 'Attack - 2');
  const [a, b] = donor.Sequences[iD].Interval, [c, d] = model.Sequences[iM].Interval;
  let worst = 0;
  for (let k = 0; k <= 12; k++) worst = Math.max(worst, line(donor, iD, Math.round(a + k / 12 * (b - a)), id => id).angleTo(line(model, iM, Math.round(c + k / 12 * (d - c)), id => report.donorNodes[id])) * 180 / Math.PI);
  assert.ok(worst < 6, `the shoulder line is up to ${worst.toFixed(1)} deg off the Kobold's in Attack - 2`);
});

test('H4 Dread Lord on the Aspiring Hero: in the donor\'s Cinematic Walk he shows what his Walk shows, never his corpse (the same-kind rule took his only Cinematic animation, "Cinematic death", and showed its corpse: 37% of his vertices)', { skip: missing('transfer-dreadlord', 'transfer-aspiring-hero') }, () => {
  const { own, model } = transplant('transfer-dreadlord', 'transfer-aspiring-hero');
  const index = model.Sequences.findIndex(s => s.Name === 'Cinematic Walk'), walk = own.Sequences.findIndex(s => s.Name === 'Walk');
  assert.ok(index >= 0 && walk >= 0);
  const [a, b] = model.Sequences[index].Interval, [c, d] = own.Sequences[walk].Interval;
  const shown = (m, i, from, to) => new Set(m.Geosets.map((_, g) => g).filter(g => [0.25, 0.5, 0.75].some(t => geosetShown(m, g, i, Math.round(from + t * (to - from))))));
  const mine = shown(model, index, a, b), walking = shown(own, walk, c, d);
  const extra = [...mine].filter(g => !walking.has(g));
  assert.deepEqual(extra, [], `geosets shown in Cinematic Walk but not in his Walk: ${extra.join(', ')}`);
});

test('H5 Eredar Warlock on the Chaos Blademaster: through the Blademaster\'s Dissipate its ground ring stays on the ground where its own Stand holds it (the ring\'s three roots only scale, by keys of their own; it rode the body, stood up and flew 6 heights into the sky with it)', { skip: missing('transfer-eredar-warlock', 'transfer-chaos-blademaster') }, () => {
  const { own, model, report } = transplant('transfer-eredar-warlock', 'transfer-chaos-blademaster');
  const nodes = byId(own), still = id => { const n = nodes.get(id); return n && (n.Parent == null || n.Parent < 0) && !n.Translation?.Keys?.length && !n.Rotation?.Keys?.length; };
  const ring = verticesOn(own, still);
  assert.ok(ring.length >= 8, `${ring.length} ring vertices`);
  const H = Math.max(...own.Geosets.flatMap(g => Array.from({ length: g.Vertices.length / 3 }, (_, v) => g.Vertices[v * 3 + 2])));
  const bind = ring.reduce((p, [g, v]) => p.add(new Vector3(...own.Geosets[g].Vertices.slice(v * 3, v * 3 + 3))), new Vector3()).divideScalar(ring.length);
  const index = model.Sequences.findIndex(s => s.Name === 'Dissipate');
  assert.ok(index >= 0);
  const [a, b] = model.Sequences[index].Interval;
  let worst = 0;
  for (let k = 0; k <= 12; k++) worst = Math.max(worst, centroidAt(model, ring, index, Math.round(a + k / 12 * (b - a))).distanceTo(bind) / H);
  assert.ok(worst < 0.1, `the ring's centre is up to ${worst.toFixed(2)} heights from where it lies (riders: ${JSON.stringify(report.riders.map(r => r.name + '>' + r.joint))})`);
});

test('H6 armored Ogre on Kil\'jaeden (cinematic): through his Attack - 1 the Ogre\'s lower foot stands as high above the ground as Kil\'jaeden\'s, times the travel ratio (his body joint bobs by position keys on a global sequence, which take no height keys: the height was never set and the feet stood 0.1 hip heights too high)', { skip: missing('transfer-ogre-armored', 'transfer-kiljaeden-cin') }, () => {
  const { own, donor, model, report } = transplant('transfer-ogre-armored', 'transfer-kiljaeden-cin');
  assert.equal(report.counts.ground, 'feet');
  const read = m => transplantReading(transferRig(m, { sequence: standSequenceIndex(m) }), m);
  const rigB = read(own), rigA = read(donor), travel = report.counts.travel;
  const feet = rig => Object.values(rig.parts).filter(p => p.limbKind === 'leg').map(p => p.marker);
  const nM = byId(model), nD = byId(donor);
  const lowest = (m, nodes, index, frame, ids) => { const mats = sampleNodeMatrices(m, frame, index); return Math.min(...ids.map(id => at(m, nodes, mats, id).z)); };
  const iM = model.Sequences.findIndex(s => s.Name === 'Attack - 1'), iD = donor.Sequences.findIndex(s => s.Name === 'Attack - 1');
  const [a, b] = model.Sequences[iM].Interval, [c, d] = donor.Sequences[iD].Interval;
  let worst = 0;
  for (let k = 0; k <= 12; k++) {
    const mine = lowest(model, nM, iM, Math.round(a + k / 12 * (b - a)), feet(rigA).map(id => report.donorNodes[id])) - rigB.ground;
    const theirs = (lowest(donor, nD, iD, Math.round(c + k / 12 * (d - c)), feet(rigA)) - rigA.ground) * travel;
    worst = Math.max(worst, Math.abs(mine - theirs) / rigB.hipHeight);
  }
  assert.ok(worst < 0.03, `the lower foot is up to ${worst.toFixed(3)} hip heights off Kil'jaeden's`);
});
