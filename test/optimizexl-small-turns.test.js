import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openDocument } from '../src/editor-document.js';
import { sanityProposals, runOptimizeStage } from '../src/optimizexl.js';
import { sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { nodeIndex } from '../src/node-hierarchy.js';
import { vertexBones } from '../src/part-bones.js';
import { testModel } from './helpers/fixtures.cjs';
import { sanityTest } from './helpers/hive.mjs';
import { flattenHiveFindings } from '../app/optimizexl-hive.js';

// Owner rule, 15 Nov 2026: Hive-similar small turns on local linear node tracks
// go when every skinned vertex the node moves stays within 0.25% of that part.
const lahmian = testModel('optimizexl-lahmian-unused/WH_VC_LahmianVampire01.mdx');
const accepted = testModel('optimizexl-lahmian-unused/WH_VC_LahmianVampire01_accepted.mdx');
const statue = testModel('corpus-sd800/undead__obsidianstatue.mdx');
const needs = file => ({ skip: !fs.existsSync(file) && `${file} is not in the test models` });
const open = file => openDocument(fs.readFileSync(file), 'x.mdx').model;
const redundant = model => sanityProposals(model).filter(f => f.kind === 'redundantTracks');
const at = (model, path) => path.reduce((v, p) => v[p], model);
// The owner-accepted Lahmian edit (study of 1,069 models, before-after-candidates.json).
const ACCEPTED = [['Bones.12.Rotation', 'Attack', 8033], ['Bones.34.Rotation', 'Stand Channel', 20517], ['Bones.104.Rotation', 'Portrait 2', 31409],
  ['Bones.105.Rotation', 'Portrait 2', 31409], ['Bones.105.Rotation', 'Portrait Talk 2', 35934]];
const small = (model, fixes) => fixes.flatMap(f => (f.smallTurns || []).map(frame => [f.path.join('.'), model.Sequences[f.sequence].Name, frame]));
const unusedSimilar = bytes => flattenHiveFindings(sanityTest(bytes).nodes).filter(f => f.type === 'unused' && /has (roughly|exactly) the same value/.test(f.message)).length;

// Independent of the rule's own code: whole-model playback through the shared
// node maths, every millisecond between the kept neighbours, every geoset.
function worstShare(before, after, path, sequence, frame) {
  const node = at(before, path.slice(0, -1)), tree = nodeIndex(before), id = node.ObjectId;
  const interval = before.Sequences[sequence].Interval, keys = at(before, path).Keys.filter(k => k.Frame >= interval[0] && k.Frame <= interval[1]);
  const kept = at(after, path).Keys.filter(k => k.Frame >= interval[0] && k.Frame <= interval[1]).map(k => k.Frame);
  const from = Math.max(...kept.filter(f => f < frame)), to = Math.min(...kept.filter(f => f > frame));
  assert.ok(keys.some(k => k.Frame === frame) && !kept.includes(frame));
  const influenced = before.Geosets.map(g => Array.from({ length: g.Vertices.length / 3 }, (_, v) => vertexBones(g, v).some(b => tree.isAncestor(b, id))));
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  before.Geosets.forEach((g, gi) => influenced[gi].forEach((yes, v) => { if (yes) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], g.Vertices[v * 3 + i]); hi[i] = Math.max(hi[i], g.Vertices[v * 3 + i]); } }));
  // A single-point part has no box: its size is its lever from the node's pivot.
  let size = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  if (!(size > 1e-6)) size = Math.hypot(...lo.map((v, i) => v - node.PivotPoint[i]));
  let worst = 0;
  for (let f = from; f <= to; f++) {
    const a = sampleNodeMatrices(before, f, sequence), b = sampleNodeMatrices(after, f, sequence);
    before.Geosets.forEach((g, gi) => {
      const pa = skinGeoset(g, a, new Float64Array(g.Vertices.length)), pb = skinGeoset(after.Geosets[gi], b, new Float64Array(g.Vertices.length));
      influenced[gi].forEach((yes, v) => { if (yes) worst = Math.max(worst, Math.hypot(pa[v * 3] - pb[v * 3], pa[v * 3 + 1] - pb[v * 3 + 1], pa[v * 3 + 2] - pb[v * 3 + 2])); });
    });
  }
  return { worst, size, share: worst / size };
}

test('Lahmian: the five accepted small turns join the redundant-key plan and move the mesh at most 0.25% of the part', needs(lahmian), t => {
  const bytes = fs.readFileSync(lahmian), model = open(lahmian), fixes = redundant(model);
  assert.deepEqual(small(model, fixes), ACCEPTED);
  for (const [path, name, frame] of ACCEPTED) {
    const f = fixes.find(f => f.path.join('.') === path && model.Sequences[f.sequence].Name === name);
    assert.ok(f.frames.includes(frame) && !f.remaining.includes(frame) && !f.preservedTurns.includes(frame) && !f.inspectionOnly, `${path} ${name}`);
  }
  const chosen = fixes.filter(f => f.smallTurns), after = runOptimizeStage(bytes, 'sanity', {}, { kind: 'batch', stage: 'sanity', entries: chosen.map(fix => ({ fix })) }).bytes;
  const result = openDocument(after, 'x.mdx').model;
  for (const f of chosen) for (const frame of f.smallTurns) {
    const { worst, size, share } = worstShare(model, result, f.path, f.sequence, frame);
    t.diagnostic(`${f.path.join('.')} ${frame}: ${worst.toFixed(4)} units, ${(share * 100).toFixed(3)}% of ${size.toFixed(2)}`);
    assert.ok(share <= .0025, `${f.path.join('.')} ${frame}: ${worst} units of ${size} (${share * 100}%)`);
  }
  // Same keys as the owner's accepted file, nothing else changed on those tracks.
  if (fs.existsSync(accepted)) {
    const reference = open(accepted);
    for (const f of chosen) assert.deepEqual(at(result, f.path).Keys, at(reference, f.path).Keys, f.path.join('.'));
  }
  // The checker's similar-value notices for those keys are gone.
  assert.equal(unusedSimilar(after), unusedSimilar(bytes) - ACCEPTED.length);
});

test('Lahmian: rescanning after approval proposes nothing for the removed keys, and single and batch approval agree', needs(lahmian), () => {
  const bytes = fs.readFileSync(lahmian), model = open(lahmian), chosen = redundant(model).filter(f => f.smallTurns), ids = chosen.map(f => f.id);
  const batch = runOptimizeStage(bytes, 'sanity', {}, { kind: 'batch', stage: 'sanity', entries: chosen.map(fix => ({ fix })) }).bytes;
  const again = redundant(openDocument(batch, 'x.mdx').model).filter(f => ids.includes(f.id));
  assert.deepEqual(again.flatMap(f => [...f.noticed, ...f.frames, ...(f.smallTurns || [])]), []);
  // One at a time, both orders; each approval uses a fresh scan, like the review.
  for (const order of [ids, [...ids].reverse()]) {
    let current = bytes;
    for (const id of order) { const fix = redundant(openDocument(current, 'x.mdx').model).find(f => f.id === id); current = runOptimizeStage(current, 'sanity', {}, fix).bytes; }
    assert.deepEqual(Buffer.from(current), Buffer.from(batch));
  }
});

test('Lahmian copy: a longer lever makes the same linear deletion exceed 0.25% of the part, so the turn stays', needs(lahmian), () => {
  const model = open(lahmian), node = model.Bones[12], pivot = Array.from(node.PivotPoint);
  assert.ok(small(model, redundant(model)).some(([path, , frame]) => path === 'Bones.12.Rotation' && frame === 8033));
  // Same part and bind size; only the pivot it turns about moves 2000 units away.
  node.PivotPoint = new Float32Array([pivot[0] + 2000, pivot[1], pivot[2]]);
  const f = redundant(model).find(f => f.path.join('.') === 'Bones.12.Rotation' && model.Sequences[f.sequence].Name === 'Attack');
  assert.ok(f.preservedTurns.includes(8033) && f.remaining.includes(8033) && !f.frames.includes(8033) && !f.smallTurns);
});

test('Lahmian copy: a billboarded node, or one under a billboarded parent, keeps its small turn', needs(lahmian), () => {
  for (const which of ['node', 'parent']) {
    const model = open(lahmian), node = model.Bones[12], target = which === 'node' ? node : [...model.Bones, ...model.Helpers].find(n => n.ObjectId === node.Parent);
    assert.ok(small(model, redundant(model)).some(([path, , frame]) => path === 'Bones.12.Rotation' && frame === 8033));
    target.Flags |= 8;
    const f = redundant(model).find(f => f.path.join('.') === 'Bones.12.Rotation' && model.Sequences[f.sequence].Name === 'Attack');
    assert.ok(f.preservedTurns.includes(8033) && !f.frames.includes(8033) && !f.smallTurns, which);
  }
});

test('Obsidian Statue: a small turn on a cubic track stays protected', needs(statue), () => {
  const model = open(statue), track = model.Helpers[18].Rotation;
  assert.ok(track.LineType >= 2);
  const f = redundant(model).find(f => f.path.join('.') === 'Helpers.18.Rotation' && model.Sequences[f.sequence].Name === 'Morph');
  assert.ok(f.preservedTurns.includes(25000) && f.remaining.includes(25000) && !f.frames.includes(25000) && !f.smallTurns);
});
