// Transplant (XFER stage 3): the open model's own pieces outside its read body (owner, 19 Nov 2026: "A TRANSPLANT IS
// 100% A TRANSPLANT"; overnight classes E1 and K1, out/transfer-probe/overnight/analysis/classes.md). An extra (hair, a
// cape, claws, a jaw) rides the donor's matching chain when the donor has one, else its part joint; skin on a joint outside
// the body (a staff, the Corrupted Ent's whole body) rides the part joint it follows in the model's own animations, never
// staying still in the world. Real models from the private test-model collection; each test skips when its model is absent.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Vector3 } from 'three';
import { parseCompatibleMdx } from '../src/mdx-compatibility.js';
import { allNodes, sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { validateModel } from '../src/editor-document.js';
import { transferRig } from '../src/anim-transfer.js';
import { standSequenceIndex } from '../src/sequence-editor.js';
import { transplantSkeleton } from '../src/skeleton-transplant.js';

const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const missing = (...keys) => { const absent = keys.filter(key => { const file = fixturePath(key); return !file || !fs.existsSync(file); }); return absent.length ? `private test model not on this machine: ${absent.join(', ')}` : false; };
const load = key => { const b = fs.readFileSync(fixturePath(key)); return parseCompatibleMdx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const results = new Map();
const transplant = (ownKey, donorKey, options = { mirror: false }) => {
  const key = JSON.stringify([ownKey, donorKey, options]);
  if (!results.has(key)) { const own = load(ownKey), donor = load(donorKey); results.set(key, { own, donor, ...transplantSkeleton(own, donor, options) }); }
  return results.get(key);
};
const EVERYDAY = sequence => !/death|decay|dissipate|portrait/i.test(String(sequence.Name));
const bonesOf = (geoset, v) => geoset.SkinWeights?.length >= (v + 1) * 8 ? [0, 1, 2, 3].filter(i => geoset.SkinWeights[v * 8 + 4 + i] > 0).map(i => geoset.SkinWeights[v * 8 + i]) : Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []);
/** Own vertices ([geoset, vertex]) whose bones all pass `test`. */
const verticesOn = (own, test) => own.Geosets.flatMap((geoset, g) => Array.from({ length: geoset.Vertices.length / 3 }, (_, v) => [g, v]).filter(([, v]) => { const bones = bonesOf(geoset, v); return bones.length && bones.every(test); }));
/** Joints at and under `top`. */
const under = (model, top) => { const ids = new Set([top]); for (let grew = true; grew;) { grew = false; for (const n of allNodes(model)) if (!ids.has(n.ObjectId) && ids.has(n.Parent)) { ids.add(n.ObjectId); grew = true; } } return ids; };
const hipOf = own => transferRig(own, { sequence: standSequenceIndex(own) }).hipHeight;
/** World positions of `list` at a frame of animation `index`. */
const positions = (model, list, index, frame) => {
  const matrices = sampleNodeMatrices(model, frame, index), cache = new Map();
  return list.map(([g, v]) => { if (!cache.has(g)) cache.set(g, skinGeoset(model.Geosets[g], matrices)); const q = cache.get(g); return new Vector3(q[v * 3], q[v * 3 + 1], q[v * 3 + 2]); });
};
const centroid = points => points.reduce((s, p) => s.add(p), new Vector3()).divideScalar(points.length);
const moments = sequence => Array.from({ length: 9 }, (_, k) => Math.round(sequence.Interval[0] + k / 8 * (sequence.Interval[1] - sequence.Interval[0])));
/** Worst distance (hip heights) between the model's own placing of `list` and the result's, through every animation `which`
 * passes, nine moments each (a transplant onto itself: the same animations). */
function worstAgainstOwn({ own, model }, list, which = EVERYDAY) {
  const hip = hipOf(own);
  let worst = { d: 0 };
  model.Sequences.forEach((sequence, index) => {
    if (!which(sequence)) return;
    const mine = own.Sequences.findIndex(s => s.Name === sequence.Name);
    for (const frame of moments(sequence)) {
      const a = positions(own, list, mine, frame), b = positions(model, list, index, frame);
      a.forEach((p, i) => { const d = p.distanceTo(b[i]) / hip; if (d > worst.d) worst = { d, at: `${sequence.Name} @${frame}` }; });
    }
  });
  return worst;
}
/** The result validates (errors the open model has itself, a Blizzard global sequence of no length, are its own). */
const valid = (model, own) => { const errors = m => validateModel(m).filter(d => d.severity === 'error').map(e => `${e.code}: ${e.message}`); assert.deepEqual(errors(model), errors(own), 'the result validates'); };

test('X1 Ghoul on the Ghoul: its claws, face, jaw and tongue (extras) move exactly as its own in every everyday animation', { skip: missing('transfer-ghoul') }, () => {
  const result = transplant('transfer-ghoul', 'transfer-ghoul'), { own, report } = result;
  const named = name => allNodes(own).find(n => String(n.Name).trim() === name)?.ObjectId;
  const pieces = ['Box01', 'Hand1', 'Face', 'Tounge'].map(named);
  assert.ok(pieces.every(id => id != null), 'the Ghoul has its claw, face and tongue extras');
  const bones = new Set(pieces.flatMap(id => [...under(own, id)]));
  const list = verticesOn(own, id => bones.has(id));
  assert.ok(list.length > 200, `${list.length} vertices on them`);
  const worst = worstAgainstOwn(result, list);
  assert.ok(worst.d <= 0.005, `an extra's vertex is ${worst.d.toFixed(3)} hip heights from where the Ghoul puts it (${worst.at})`);
  for (const id of pieces) assert.ok(report.extras.find(extra => extra.id === id)?.follows, `${own.Nodes[id].Name} follows the donor's chain`);
  valid(result.model, own);
});

test('X2 Demon Hunter on himself: his hair (an extra) and his demon form (a second skeleton outside the body) move as his own', { skip: missing('transfer-demon-hunter') }, () => {
  const result = transplant('transfer-demon-hunter', 'transfer-demon-hunter'), { own } = result;
  const hair = allNodes(own).find(n => String(n.Name).trim() === 'hairbase')?.ObjectId;
  assert.ok(hair != null, 'the Demon Hunter has hair');
  const hairBones = under(own, hair), demon = new Set(allNodes(own).filter(n => /alternate$/i.test(String(n.Name).trim())).map(n => n.ObjectId));
  const hairList = verticesOn(own, id => hairBones.has(id)), demonList = verticesOn(own, id => demon.has(id));
  assert.ok(hairList.length >= 15 && demonList.length >= 200, `${hairList.length} hair and ${demonList.length} demon form vertices`);
  const worstHair = worstAgainstOwn(result, hairList), worstDemon = worstAgainstOwn(result, demonList);
  assert.ok(worstHair.d <= 0.005, `hair ${worstHair.d.toFixed(3)} hip heights from his own (${worstHair.at})`);
  assert.ok(worstDemon.d <= 0.005, `demon form ${worstDemon.d.toFixed(3)} hip heights from his own (${worstDemon.at})`);
  valid(result.model, own);
});

test('X3 Orc Warlock on the Grunt: the staff (skin on a joint outside the body) keeps its place against the forearm it is held in (its skin bone ArmLow_Left), not still in the world', { skip: missing('transfer-orc-warlock', 'transfer-grunt') }, () => {
  const result = transplant('transfer-orc-warlock', 'transfer-grunt'), { own, model } = result;
  const named = name => allNodes(own).find(n => String(n.Name).trim() === name)?.ObjectId;
  const staffBones = under(own, named('Staff')), forearm = named('ArmLow_Left');
  const staff = verticesOn(own, id => staffBones.has(id)), arm = verticesOn(own, id => id === forearm);
  assert.ok(staff.length >= 50 && arm.length >= 5, `${staff.length} staff and ${arm.length} forearm vertices`);
  const hip = hipOf(own);
  let travelled = 0;
  model.Sequences.forEach((sequence, index) => {
    if (!EVERYDAY(sequence)) return;
    const gaps = [], places = [];
    for (const frame of moments(sequence)) { const s = centroid(positions(model, staff, index, frame)); places.push(s); gaps.push(s.distanceTo(centroid(positions(model, arm, index, frame)))); }
    const spread = (Math.max(...gaps) - Math.min(...gaps)) / hip;
    assert.ok(spread <= 0.05, `${sequence.Name}: the staff against the forearm varies by ${spread.toFixed(3)} hip heights`);
    travelled = Math.max(travelled, ...places.map(p => p.distanceTo(places[0]) / hip));
  });
  assert.ok(travelled >= 0.2, `the staff moves with the body (${travelled.toFixed(3)} hip heights at most)`);
  valid(model, own);
});

test("X4 Corrupted Ent on the Grunt: his body (skin on joints outside the read body) moves with the Grunt's; his head keeps its place on the Grunt's head", { skip: missing('transfer-corrupted-ent', 'transfer-grunt') }, () => {
  const result = transplant('transfer-corrupted-ent', 'transfer-grunt'), { own, donor, model, report } = result;
  const hip = hipOf(own), head = new Set(allNodes(own).filter(n => /^fake (head|mouth|lip)$/i.test(String(n.Name).trim())).map(n => n.ObjectId));
  const list = verticesOn(own, id => head.has(id));
  assert.ok(list.length >= 50, `${list.length} head vertices`);
  const gruntHead = report.donorNodes[transferRig(donor, { sequence: standSequenceIndex(donor) }).parts.head.marker];
  assert.ok(gruntHead != null, "the Grunt's head joint is in the result");
  model.Sequences.forEach((sequence, index) => {
    if (!EVERYDAY(sequence)) return;
    const local = moments(sequence).map(frame => centroid(positions(model, list, index, frame)).applyMatrix4(sampleNodeMatrices(model, frame, index).get(gruntHead).clone().invert()));
    const drift = Math.max(...local.map(p => p.distanceTo(local[0]))) / hip;
    assert.ok(drift <= 0.02, `${sequence.Name}: his head moves ${drift.toFixed(3)} hip heights against the Grunt's head`);
  });
  valid(model, own);
});
