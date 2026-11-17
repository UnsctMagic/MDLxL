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
