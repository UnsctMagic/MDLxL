import test from 'node:test';
import assert from 'node:assert/strict';
import { poseBodyDriverMotion } from '../src/pose-body-drivers.js';
import { realAnatomyCases, loadAnatomyCase, challengeCase, nameVariants } from './helpers/pose-anatomy-fixtures.mjs';

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

test('static native structure supplies neutral evidence rather than being rejected', () => {
  const model={Bones:[{ObjectId:0,Parent:null,PivotPoint:[0,0,0]}],Sequences:[{Interval:[0,100]}]};
  const result=poseBodyDriverMotion(model,[0]);
  assert.equal(result.get(0).score,0);
  assert.equal(result.size,1);
});

test('native global-loop ownership uses the same validity rule as playback', () => {
  const motion = {LineType:1, Keys:[{Frame:0,Vector:[0,0,0]},{Frame:100,Vector:[10,0,0]}]};
  const model = {Bones:[{ObjectId:0,Parent:null,PivotPoint:[0,0,0],Translation:motion}],Sequences:[{Interval:[0,100]}],GlobalSequences:[100]};
  assert.equal(poseBodyDriverMotion(model,[0]).get(0).translation,10);
  motion.GlobalSeqId=-1;
  assert.equal(poseBodyDriverMotion(model,[0]).get(0).translation,10,'native no-global sentinel remains local');
  motion.GlobalSeqId=0;
  assert.equal(poseBodyDriverMotion(model,[0]).get(0).translation,0,'valid shared loop is not local articulation');
});
