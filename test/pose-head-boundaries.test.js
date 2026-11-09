import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadAnatomyCase, challengeCase, nameVariants } from './helpers/pose-anatomy-fixtures.mjs';
const source = process.env.MDLXL_POSE_SOURCE ? pathToFileURL(path.resolve(process.env.MDLXL_POSE_SOURCE, 'pose-ik.js')) : new URL('../src/pose-ik.js', import.meta.url);
const { suggestPoseRig, poseRole } = await import(source);

// Independent native anatomy from the existing SD consumer expectations.
// The same control must survive every label and object-id transformation.
const cases = [
  ['bat rider', 'corpus-sd/orc__battroll.mdx', [57,73]],
  ['articulated skull and jaw', 'corpus-sd/creeps__sludgemonster.mdx', [64]],
  ['forward low head', 'corpus-sd/creeps__quillbeast.mdx', [52]],
  ['small skull on broad chest', 'corpus-sd/creeps__voidwalker.mdx', [45]],
  ['winged mount and rider', 'corpus-sd/human__gryphonrider.mdx', [83,108]],
  ['continuous centaur torso', 'pose/CentaurKhan.mdx', [51]],
];
for (const [label,file,heads] of cases) for (const mode of nameVariants) test(`${label}: heads survive ${mode}`, () => {
  const input = loadAnatomyCase({file}).model;
  const {model,expected} = challengeCase(input,{limbs:[],heads},mode);
  const rig = suggestPoseRig(model,0,0);
  const actual = rig.nodes.filter(id => poseRole(model,rig,id) === 'Head');
  assert.deepEqual(actual.sort((a,b)=>a-b),expected.heads.slice().sort((a,b)=>a-b));
});
