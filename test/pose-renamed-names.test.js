import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openDocument } from '../src/editor-document.js';
import { allNodes } from '../src/animation.js';
import { suggestPoseRig, poseRole } from '../src/pose-ik.js';
import { createRequire } from 'node:module';
const { testModel } = createRequire(import.meta.url)('./helpers/fixtures.cjs');

// The Bone Namer renames bones to standard names. POSE must then find the same
// handles: the same body, the same limb ends with the same kind and label, and
// the same part handles with the same roles. Renames are applied in memory only.
const handles = model => {
  const nodes = allNodes(model), sequence = Math.max(0, model.Sequences.findIndex(s => /^stand(?:\s|$)/i.test(s.Name)));
  const rig = suggestPoseRig(model, model.Sequences[sequence]?.Interval[0] || 0, sequence);
  return {
    body: rig.body,
    limbs: rig.chains.map(chain => `${chain.end}=${chain.label || chain.kind}`).sort(),
    parts: rig.nodes.map(id => `${id}=${poseRole(model, rig, id, nodes)}`).sort(),
  };
};
const cases = [
  // Named hands below a mirrored "Root" pair: the pair keeps its Body handles.
  ['corpus-sd/critters__zergling.mdx', { Mesh12: 'Bone_Hand_L', Object15: 'Bone_Hand_R' }],
  ['corpus-sd800/critters__zergling.mdx', { Mesh12: 'Bone_Hand_L', Object15: 'Bone_Hand_R' }],
];
for (const [rel, renames] of cases) {
  const file = testModel(rel);
  test(`renamed bones keep the POSE handles: ${rel}`, () => {
    assert.ok(fs.existsSync(file), `test model missing: ${file}`);
    const model = openDocument(fs.readFileSync(file)).model, before = handles(model);
    let renamed = 0;
    for (const node of allNodes(model)) if (renames[node.Name]) { node.Name = renames[node.Name]; renamed++; }
    assert.equal(renamed, Object.keys(renames).length, 'every rename applied');
    assert.deepEqual(handles(model), before);
  });
}
