import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { ModelRenderer } from 'war3-model';
import { allNodes } from '../src/animation.js';
import { openDocument } from '../src/editor-document.js';
import { suggestPoseRig } from '../src/pose-ik.js';
import { assertModelEquivalent } from '../src/save-equivalence.js';
import { preparePoseMotion, buildPoseMotion, applyPoseMotion } from '../src/pose-motion.js';

const manifest = process.env.MDLXL_MOTION_CORPUS;
const fixtures = manifest && fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest)) : [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const plain = value => JSON.parse(JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item) ? Array.from(item) : item));
const withoutMotion = model => {
  const copy = structuredClone(model);
  for (const node of allNodes(copy)) for (const property of ['Rotation', 'Translation']) delete node[property];
  return copy;
};
const nativeRenderer = model => new ModelRenderer({ ...model, Nodes: allNodes(model), Geosets: [], GeosetAnims: [], Materials: [], ParticleEmitters2: [], RibbonEmitters: [] });

test('local Motion fixtures are optional and never redistributed', { skip: fixtures.length > 0 }, () => {});
for (const fixture of fixtures) test(`Motion native corpus: ${fixture.name}`, () => {
  const bytes = fs.readFileSync(fixture.file), originalHash = hash(bytes), doc = openDocument(bytes), before = structuredClone(doc.model);
  const sequence = fixture.sequence, range = Array.from(doc.model.Sequences[sequence].Interval);
  const config = { ...suggestPoseRig(doc.model, range[0], sequence), pins: [] };
  const analysis = preparePoseMotion(doc.model, config, sequence, range);
  const settings = { style: fixture.style || 'swing', timing: 70, follow: 45, body: 35, contacts: true, ...(fixture.hit == null ? {} : { hit: fixture.hit }) };
  const result = buildPoseMotion(analysis, settings);
  assert.ok(result.tracks.length > 0, 'a nonzero setting produces a real native edit');
  assert.deepEqual(doc.model, before, 'preparation and generation never mutate the source');
  const originalNodes = new Map(allNodes(before).map(node => [node.ObjectId, node]));
  for (const item of result.tracks) {
    const prior = originalNodes.get(item.id)[item.property];
    assert.deepEqual(plain(item.track.Keys.filter(key => key.Frame < range[0] || key.Frame > range[1])), plain(prior?.Keys?.filter(key => key.Frame < range[0] || key.Frame > range[1]) || []), 'other animations retain exact keys and tangents');
    assert.ok(['Rotation', 'Translation'].includes(item.property));
    assert.ok(item.track.Keys.every(key => Array.from(key.Vector).every(Number.isFinite)));
  }
  const undo = doc.historyStats.undoSteps;
  doc.apply('Motion', ['Nodes'], model => applyPoseMotion(model, result));
  assert.equal(doc.historyStats.undoSteps, undo + 1);
  assertModelEquivalent(withoutMotion(before), withoutMotion(doc.model));
  const after = structuredClone(doc.model), saved = doc.serialize('mdx');
  const reopened = openDocument(saved).model;
  assertModelEquivalent(after, reopened);
  const sourceRenderer = nativeRenderer(before), outputRenderer = nativeRenderer(reopened);
  try {
    for (const renderer of [sourceRenderer, outputRenderer]) renderer.setSequence(sequence);
    for (const frame of result.anchors) {
      for (const renderer of [sourceRenderer, outputRenderer]) { renderer.setFrame(frame); renderer.update(0); }
      sourceRenderer.rendererData.nodes.forEach((node, id) => {
        if (!node) return;
        const actual = outputRenderer.rendererData.nodes[id].matrix;
        node.matrix.forEach((value, i) => assert.ok(Math.abs(value - actual[i]) < 2e-5, `native kept pose ${frame}, bone ${id}, matrix ${i}: ${value} vs ${actual[i]}`));
      });
    }
  } finally { sourceRenderer.destroy(); outputRenderer.destroy(); }
  assert.ok(doc.undo()); assert.deepEqual(doc.model, before);
  assert.ok(doc.redo()); assert.deepEqual(doc.model, after);
  assert.equal(hash(fs.readFileSync(fixture.file)), originalHash, 'source file bytes stay untouched');
});
