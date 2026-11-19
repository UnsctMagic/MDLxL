// Transplant (XFER stage 3): the open model's mesh on the donor's skeleton with the donor's
// animations. Contract: docs/agent-tasks/xfer-both-ways.md, "Stage 3: transplant ... Engine
// contract". Real models from the private test-model collection; each test skips with the reason
// when its model is not on this machine.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Vector3 } from 'three';
import { parseCompatibleMdx, generateCompatibleMdx } from '../src/mdx-compatibility.js';
import { allNodes, nodePivot, sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { validateModel } from '../src/editor-document.js';
import { clearTransferCache, transferRig } from '../src/anim-transfer.js';
import { poseLimbStart } from '../src/pose-recognition.js';
import { standSequenceIndex } from '../src/sequence-editor.js';
import { mirrorModel, transplantSkeleton } from '../src/skeleton-transplant.js';

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
  // The Footman's right arm ends at an attachment, where the Grunt has a hand joint: it is converted.
  assert.deepEqual(result.report.converted, ['armR']);
});

// ------------------------------------------------------------------ (b) the owner's pair: the Kurgan on the Tauren
test('T4 Kurgan on the Tauren: a valid model with exactly the Tauren\'s animations; arms and legs are the Tauren\'s own bones and point as its do', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  const result = transplant('transfer-kurgan', 'transfer-tauren');
  structural(result);
  assert.equal(result.report.fit, 'good', result.report.reasons.join(' '));
  // v2 (owner, 19 Nov 2026): a transplant is 100% the donor's skeleton. The legs are no longer converted.
  assert.deepEqual(result.report.converted, [], 'no limb keeps its own joints');
  const worst = limbAngles(result, result.donor);
  for (const key of ['armL', 'armR', 'legL', 'legR']) {
    assert.equal(worst[key]?.kind, 'transplanted', `${key} is transplanted`);
    for (const role of ['upper', 'lower']) assert.ok(worst[key][role] < 10, `${key}: the ${role} part is up to ${worst[key][role].toFixed(1)} degrees from the Tauren's`);
  }
  // Every joint of the Tauren's legs, the hock included, is in the result and carries the Kurgan's leg skin.
  const rigT = transferRig(result.donor, { sequence: standSequenceIndex(result.donor) }), carried = new Set();
  for (const geoset of result.model.Geosets) for (const group of geoset.Groups) for (const id of group) carried.add(id);
  for (const key of ['legL', 'legR']) for (const id of rigT.parts[key].joints) {
    const there = result.report.donorNodes[id];
    assert.ok(there != null, `${result.donor.Nodes[id].Name} is in the result`);
    assert.ok(carried.has(there), `${result.donor.Nodes[id].Name} carries skin`);
  }
});

test('T5 Kurgan on the Tauren: the Tauren\'s feet stand on the Kurgan\'s ground in the Stand; in Walk a foot stays near it', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  // v2: the legs are the Tauren's bones with its motion, so nothing plants the feet (v1's converted legs did).
  // The ground is settled in the result's reference moment; in Walk the lower foot is measured as in R13 and
  // must stay within a fifth of hip height (measured 7.7 of 42 on 19 Nov 2026: the Kurgan's legs, bent at the
  // Tauren's angles, reach less far). A plain regression guard, not a feet-kept-down claim.
  const { own, donor, model, report } = transplant('transfer-kurgan', 'transfer-tauren');
  const rig = transferRig(own, { sequence: standSequenceIndex(own) }), rigT = transferRig(donor, { sequence: standSequenceIndex(donor) });
  const walk = model.Sequences.findIndex(s => /^walk$/i.test(s.Name)), stand = standSequenceIndex(model), nM = byId(model);
  const feet = ['legL', 'legR'].map(key => report.donorNodes[rigT.parts[key].marker]);
  assert.ok(feet.every(id => id != null), 'the Tauren\'s feet are in the result');
  const lower = (sequence, frame) => { const mm = sampleNodeMatrices(model, frame, sequence); return Math.min(...feet.map(id => at(model, nM, mm, id).z)) - rig.ground; };
  const standing = lower(stand, model.Sequences[stand].Interval[0]);
  assert.ok(Math.abs(standing) < 0.05 * rig.hipHeight, `in the Stand the lower foot is ${standing.toFixed(1)} from the Kurgan's standing height`);
  const [a, b] = model.Sequences[walk].Interval;
  let worst = -Infinity;
  for (let i = 0; i <= 40; i++) worst = Math.max(worst, lower(walk, Math.round(a + (b - a) * i / 40)));
  assert.ok(worst < 0.2 * rig.hipHeight, `in Walk the lower foot gets ${worst.toFixed(1)} above its standing height (hip height ${rig.hipHeight.toFixed(0)})`);
  assert.ok(worst > -0.1 * rig.hipHeight, `in Walk the lower foot sinks ${(-worst).toFixed(1)} below its standing height`);
});

/** Largest distance, through three moments of every animation, between where the hammer's vertices sit
 * against the hand that holds them in the result and where they sit against the Kurgan's own hand in
 * its own reference pose. The hammer is the largest extra; the result's hand the donor joint placed at
 * the Kurgan's hand. */
function gripDrift({ own, model, report }) {
  const rig = transferRig(own, { sequence: standSequenceIndex(own) }), hand = Object.values(rig.parts).find(part => part.weapon).marker;
  const hammer = [...report.extras].sort((a, b) => b.vertices - a.vertices)[0], nO = byId(own);
  const below = id => { for (let at = id; at != null && at !== -1; at = nO.get(at)?.Parent ?? null) if (at === hammer.id) return true; return false; };
  const under = new Set(allNodes(own).map(n => n.ObjectId).filter(below));
  const g = own.Geosets.findIndex(geoset => geoset.Groups.some(group => group.some(id => under.has(id))));
  const pivot = new Vector3(...nodePivot(own, nO.get(hand), hand));
  const resultHand = [...model.Bones, ...model.Helpers].find(n => new Vector3(...n.PivotPoint).distanceTo(pivot) < 1e-4 && !Object.values(report.ownNodes).includes(n.ObjectId));
  const ownRef = sampleNodeMatrices(own, rig.reference.frame, rig.reference.sequence), mine = skinGeoset(own.Geosets[g], ownRef), toHand = ownRef.get(hand).clone().invert();
  let drift = 0;
  model.Sequences.forEach((sequence, index) => [0, 0.5, 1].forEach(share => {
    const frame = Math.round(sequence.Interval[0] + share * (sequence.Interval[1] - sequence.Interval[0])), m = sampleNodeMatrices(model, frame, index);
    const theirs = skinGeoset(model.Geosets[g], m), toResult = m.get(resultHand.ObjectId).clone().invert();
    for (let v = 0; v < own.Geosets[g].VertexGroup.length; v++) {
      if (!own.Geosets[g].Groups[own.Geosets[g].VertexGroup[v]].every(id => under.has(id))) continue;
      const a = new Vector3(mine[v * 3], mine[v * 3 + 1], mine[v * 3 + 2]).applyMatrix4(toHand), b = new Vector3(theirs[v * 3], theirs[v * 3 + 1], theirs[v * 3 + 2]).applyMatrix4(toResult);
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
/** The Kurgan's weapon hand and the result's joint placed on it. */
function weaponHands({ own, model, report }) {
  const rig = transferRig(own, { sequence: standSequenceIndex(own) }), hand = Object.values(rig.parts).find(part => part.weapon).marker;
  const pivot = new Vector3(...nodePivot(own, byId(own).get(hand), hand));
  const result = [...model.Bones, ...model.Helpers].find(n => new Vector3(...n.PivotPoint).distanceTo(pivot) < 1e-4 && !Object.values(report.ownNodes).includes(n.ObjectId)).ObjectId;
  return { rig, hand, result };
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
  const { rig, hand, result: resultHand } = weaponHands(result), nD = byId(donor), nM = byId(model);
  const ownRef = sampleNodeMatrices(own, rig.reference.frame, rig.reference.sequence), mine = skinGeoset(own.Geosets[g], ownRef), toHand = ownRef.get(hand).clone().invert();
  const stand = standSequenceIndex(model), ref = sampleNodeMatrices(model, model.Sequences[stand].Interval[0], stand), theirs = skinGeoset(model.Geosets[g], ref), toResult = ref.get(resultHand).clone().invert();
  let grip = 0;
  for (const v of list) grip = Math.max(grip, new Vector3(mine[v * 3], mine[v * 3 + 1], mine[v * 3 + 2]).applyMatrix4(toHand).distanceTo(new Vector3(theirs[v * 3], theirs[v * 3 + 1], theirs[v * 3 + 2]).applyMatrix4(toResult)));
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
  const { rig, hand, result: resultHand } = weaponHands(result), nO = byId(own), nM = byId(model);
  const ownRef = sampleNodeMatrices(own, rig.reference.frame, rig.reference.sequence), stand = standSequenceIndex(model), ref = sampleNodeMatrices(model, model.Sequences[stand].Interval[0], stand);
  const a = at(own, nO, ownRef, mine.ObjectId).applyMatrix4(ownRef.get(hand).clone().invert()), b = at(model, nM, ref, point.ObjectId).applyMatrix4(ref.get(resultHand).clone().invert());
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
  assert.equal(transplant('transfer-kurgan', 'transfer-tauren').report.reasons.length, 0, 'the owner\'s pair has no reason to be called poor');
});
