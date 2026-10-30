// Records the body parts POSE recognises, per model: the handles it exposes
// (name:role) and every bone or helper whose resolved role is a trunk part.
// Compare two runs to list exactly which models a recognition change touches.
//   node scripts/pose-head-census.mjs <out.json> <folder-or-model>...
import fs from 'node:fs';
import path from 'node:path';
import { openDocument } from '../src/editor-document.js';
import { allNodes } from '../src/animation.js';
import { suggestPoseRig, poseRole } from '../src/pose-ik.js';

const trunkParts = ['Head', 'Neck', 'Chest', 'Spine', 'Pelvis', 'Body', 'Tail', 'Wing'];
const [out, ...inputs] = process.argv.slice(2);
const files = inputs.flatMap(input => fs.statSync(input).isDirectory()
  ? fs.readdirSync(input).filter(name => /\.mdx$/i.test(name)).sort().map(name => path.join(input, name)) : [input]);
const result = {};
for (const file of files) {
  try {
    const model = openDocument(fs.readFileSync(file)).model;
    const sequence = Math.max(0, model.Sequences.findIndex(s => /^stand(?:\s|$)/i.test(s.Name))), frame = model.Sequences[sequence]?.Interval[0] || 0;
    const rig = suggestPoseRig(model, frame, sequence), nodes = allNodes(model), byId = new Map(nodes.map(node => [node.ObjectId, node]));
    const role = id => poseRole(model, rig, id, nodes);
    result[path.basename(file)] = {
      body: byId.get(rig.body)?.Name ?? null,
      handles: rig.nodes.map(id => `${byId.get(id).Name}:${role(id)}`),
      parts: [...(model.Bones || []), ...(model.Helpers || [])].filter(node => trunkParts.includes(role(node.ObjectId))).map(node => `${node.Name}:${role(node.ObjectId)}`),
    };
  } catch (error) { result[path.basename(file)] = { error: error.message }; }
}
fs.writeFileSync(out, JSON.stringify(result, null, 1));
console.log(`${Object.keys(result).length} models`);
