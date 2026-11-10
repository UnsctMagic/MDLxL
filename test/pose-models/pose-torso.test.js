import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { realAnatomyCases, loadAnatomyCase, challengeCase, nameVariants } from '../helpers/pose-anatomy-fixtures.mjs';
const source = process.env.MDLXL_POSE_SOURCE ? pathToFileURL(path.resolve(process.env.MDLXL_POSE_SOURCE, 'pose-ik.js')) : new URL('../../src/pose-ik.js', import.meta.url);
const { suggestPoseRig, poseRole } = await import(source);

// Complete bodies must carry every native skinned branch, including robes;
// the chest and a partial spine are not interchangeable with that driver.
for (const [key, body, file] of [['footman',25],['necrarch',92],['kurgan',0],['vampire-dragon',182],['corpse-dragon',0,'corpse-fixtures/VampireDragon_Corpse_FlyingDeath.mdx']]) test(`complete ${key} body survives absent or misleading names and changed IDs`, () => {
  const input = loadAnatomyCase(file ? {file} : realAnatomyCases.find(spec=>spec.key===key)).model;
  for (const mode of nameVariants) {
    const { model, expected } = challengeCase(input, {limbs:[],heads:[],exactBody:body}, mode);
    assert.equal(suggestPoseRig(model,0,0).body, expected.exactBody, key+'/'+mode);
  }
});

test('each mounted body owns its complete front and rear legs without creating extra torso actors', () => {
  const input = loadAnatomyCase(realAnatomyCases.find(spec=>spec.key==='rider')).model;
  for (const mode of nameVariants) {
    const {model,expected}=challengeCase(input,{limbs:[],heads:[],central:[117,150,139,172]},mode);
    const rig=suggestPoseRig(model,0,0),bodies=[rig.body,...rig.nodes.filter(id=>poseRole(model,rig,id)==='Body')];
    assert.deepEqual([...new Set(bodies)].sort((a,b)=>a-b), expected.central.slice().sort((a,b)=>a-b),mode);
  }
});

test('a head-bearing front trunk and separate hind pelvis retain their own stations', () => {
  const input = loadAnatomyCase({file:'pose/CentaurKhan.mdx'}).model;
  for (const mode of nameVariants) {
    const {model,expected}=challengeCase(input,{limbs:[],heads:[],central:[34,52]},mode);
    const rig=suggestPoseRig(model,0,0);
    assert.equal(poseRole(model,rig,expected.central[0]),'Chest',mode+' front trunk');
    assert.equal(poseRole(model,rig,expected.central[1]),'Pelvis',mode+' hind trunk');
  }
});
