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
// The Bone Namer's full default rename of the zergling, holder of the pair included.
const zerglingFull = {'Bone Center':'Bone_Root',Object01:'Bone_Chest','Bone Wolf Neck':'Bone_Neck',Mesh15:'Bone_Arm1_L',Mesh14:'Bone_Arm2_L',Mesh13:'Bone_Arm3_L',Mesh12:'Bone_Hand_L',Object18:'Bone_Arm1_R',Object17:'Bone_Arm2_R',Object16:'Bone_Arm3_R',Object15:'Bone_Hand_R','Bone Front L Leg':'Bone_Leg1_Front_L','Bone Front L Shin':'Bone_Leg2_Front_L','Bone FrontL Toe':'Bone_Foot_Front_L','Bone Back L Leg':'Bone_Leg1_Rear_L','Bone Back L Shin':'Bone_Leg2_Rear_L','Bone Object67':'Bone_Foot_Rear_L','Bone Back R Leg':'Bone_Leg1_Rear_R','Bone Back R Shin':'Bone_Leg2_Rear_R','Bone Back R Toe':'Bone_Foot_Rear_R','Bone Wolf Waist':'Bone_Tail1','Bone Tail 1':'Bone_Tail2','Bone Tail 2':'Bone_Tail3','Bone Tail 03':'Bone_Tail4'};
const cases = [
  // Named hands below a mirrored "Root" pair: the pair keeps its Body handles.
  ['corpus-sd/critters__zergling.mdx', { Mesh12: 'Bone_Hand_L', Object15: 'Bone_Hand_R' }, 'hands'],
  ['corpus-sd800/critters__zergling.mdx', { Mesh12: 'Bone_Hand_L', Object15: 'Bone_Hand_R' }, 'hands'],
  ['corpus-sd/critters__zergling.mdx', zerglingFull, 'full'],
  ['corpus-sd800/critters__zergling.mdx', zerglingFull, 'full'],
];
for (const [rel, renames, kind] of cases) {
  const file = testModel(rel);
  test(`renamed bones keep the POSE handles (${kind}): ${rel}`, () => {
    assert.ok(fs.existsSync(file), `test model missing: ${file}`);
    const model = openDocument(fs.readFileSync(file)).model, before = handles(model);
    let renamed = 0;
    for (const node of allNodes(model)) if (renames[node.Name]) { node.Name = renames[node.Name]; renamed++; }
    assert.equal(renamed, Object.keys(renames).length, 'every rename applied');
    assert.deepEqual(handles(model), before);
  });
}
