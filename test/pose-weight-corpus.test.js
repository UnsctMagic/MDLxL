import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { allNodes } from '../src/animation.js';
import { openDocument } from '../src/editor-document.js';
import { suggestPoseRig } from '../src/pose-ik.js';
import { assertModelEquivalent } from '../src/save-equivalence.js';
import { applyPoseWeight, buildPoseWeight, preparePoseWeight } from '../src/pose-weight.js';

const manifestPath = process.env.MDLXL_POSE_CORPUS || 'out/pose-corpus-fixtures/manifest.json';
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath)) : null;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const stripMotion = model => {
  const copy = structuredClone(model);
  for (const node of allNodes(copy)) for (const property of ['Rotation', 'Translation', 'Scaling']) delete node[property];
  return copy;
};
const report = [];
test('Weight corpus fixtures are optional and never redistributed', { skip: !!manifest }, () => {});
for (const item of manifest?.models || []) test(`Weight native round-trip: ${item.entry}`, () => {
  const bytes = fs.readFileSync(item.path), doc = openDocument(bytes), model = doc.model, before = structuredClone(model);
  assert.equal(hash(bytes), item.sha256);
  const sequence = model.Sequences.findIndex(s => /^attack/i.test(s.Name));
  if (sequence < 0) return;
  const range = Array.from(model.Sequences[sequence].Interval);
  const rig = { ...suggestPoseRig(model, range[0], sequence), pins: [] };
  const nodes = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  const inside = (id, root) => {
    const seen = new Set();
    while (nodes.has(id) && !seen.has(id)) { if (id === root) return true; seen.add(id); id = nodes.get(id).Parent; }
    return false;
  };
  for (const chain of rig.chains.filter(c => c.kind === 'arm' && !c.label).slice(0, 2)) {
    const selection = {};
    for (const root of [chain.end, chain.middle]) {
      for (const [g, geo] of model.Geosets.entries()) {
        const ids = Array.from(geo.VertexGroup || []).flatMap((group, vertex) => geo.Groups[group]?.length && geo.Groups[group].every(id => inside(id, root)) ? [vertex] : []);
        if (ids.length) selection[g] = ids;
      }
      if (Object.keys(selection).length) break;
    }
    const analysis = preparePoseWeight(model, rig, { kind: 'endpoint', key: chain.key }, sequence, range, selection);
    for (const mode of ['strike']) {
      const result = buildPoseWeight(analysis, mode, 55);
      assert.ok(result.tracks.length, 'ordinary bone tracks are authored');
      assert.deepEqual(doc.model, before, 'preview never changes the document');
      for (const { id, property, track } of result.tracks) {
        assert.ok(['Rotation', 'Translation'].includes(property));
        const prior = nodes.get(id)[property];
        assert.deepEqual(track.Keys.filter(k => k.Frame < range[0] || k.Frame > range[1]), prior?.Keys?.filter(k => k.Frame < range[0] || k.Frame > range[1]) || [], 'other animations retain exact keys and tangents');
        for (const key of track.Keys) {
          assert.ok(Array.from(key.Vector).every(Number.isFinite));
          const old = prior?.Keys?.find(k => k.Frame === key.Frame);
          // Boundary keys can copy a clamped, quantized SD quaternion exactly.
          // Normalizing that authored value would change the preserved pose.
          if (property === 'Rotation' && key.Frame > range[0] && key.Frame < range[1] && (!old || key.Vector.some((v, i) => v !== old.Vector[i]))) assert.ok(Math.abs(Math.hypot(...key.Vector) - 1) < .0001, 'new interior rotations are normalized');
        }
      }
      const depth = doc.historyStats.undoSteps;
      doc.apply('Weight', ['Nodes'], current => applyPoseWeight(current, result));
      assert.equal(doc.historyStats.undoSteps, depth + 1);
      assertModelEquivalent(stripMotion(before), stripMotion(doc.model));
      assertModelEquivalent(doc.model, openDocument(doc.serialize('mdx')).model);
      assert.ok(doc.undo()); assert.deepEqual(doc.model, before);
      report.push({ name: item.entry, chain: chain.key, mode, keys: result.keyCount, tracks: result.tracks.length, mass: analysis.massCount });
    }
  }
  assert.equal(hash(fs.readFileSync(item.path)), item.sha256);
});
test('record the exercised Weight corpus', { skip: !manifest }, () => {
  assert.ok(report.length > 0); fs.mkdirSync('out', { recursive: true });
  fs.writeFileSync('out/pose-weight-corpus-tested.json', JSON.stringify(report, null, 2));
});
