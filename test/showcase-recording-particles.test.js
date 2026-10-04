import test from 'node:test';
import assert from 'node:assert/strict';
import {createShowcaseDirector} from '../app/showcase-director.js';
import {advanceShowcaseModel} from '../app/showcase-playback.js';

test('slow export captures keep particles alive between scheduled frames', () => {
  const model = {Sequences:[{Interval:[0,1000]}]};
  const director = createShowcaseDirector(() => ({model,playlist:[{sequence:0,seconds:1,speed:1}],length:1,playing:true}));
  const emitter = {props:{ObjectId:0},particles:[],emission:0};
  const native = {rendererData:{globalSequencesFrames:[]},particlesController:{emitters:[emitter]},setSequence(){},update(delta){if(delta>0)emitter.particles.push({});}};
  director.begin();
  let previous = advanceShowcaseModel(native,model,director.sample(),null);
  director.seekRecording(100);
  previous = advanceShowcaseModel(native,model,director.sample(),previous);
  const count = emitter.particles.length;
  assert.ok(count>0);
  // The regular preview still renders while readback/encoding takes longer
  // than the 30 FPS capture interval. It must hold the last requested time.
  previous = advanceShowcaseModel(native,model,director.sample(80),previous);
  assert.equal(previous.globalTime,100);
  director.seekRecording(100+1000/30);
  previous = advanceShowcaseModel(native,model,director.sample(),previous);
  assert.ok(emitter.particles.length>count,'the next captured frame ages particles instead of clearing them');
  director.end();
  assert.ok(director.sample(80).globalTime>previous.globalTime,'live preview resumes advancing');
});
