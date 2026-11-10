import test from 'node:test';
import assert from 'node:assert/strict';
import { poseBodyDriverMotion } from '../src/pose-body-drivers.js';

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
