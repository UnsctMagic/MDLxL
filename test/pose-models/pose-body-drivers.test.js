import test from 'node:test';
import assert from 'node:assert/strict';
import { poseBodyDriverMotion } from '../../src/pose-body-drivers.js';
import { realAnatomyCases, loadAnatomyCase, challengeCase, nameVariants } from '../helpers/pose-anatomy-fixtures.mjs';

test('ordinary native body articulation outranks occasional framework motion regardless of names or IDs', () => {
  for (const [key, pairs, scale] of [['vampire-dragon',[[82,50],[182,181],[182,180]],150],['kurgan',[[0,23],[0,21]],100],['footman',[[25,26]],100]]) {
    const input=loadAnatomyCase(realAnatomyCases.find(spec=>spec.key===key)).model;
    for (const mode of nameVariants) {
      const {model,expected}=challengeCase(input,{limbs:[],heads:[],central:pairs.flat()},mode);
      const motion=poseBodyDriverMotion(model,expected.central,{scale});
      for(let at=0;at<expected.central.length;at+=2) assert.ok(motion.get(expected.central[at]).score>motion.get(expected.central[at+1]).score+1e-6,key+'/'+mode);
    }
  }
});
