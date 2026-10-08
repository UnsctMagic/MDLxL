import test from 'node:test';
import assert from 'node:assert/strict';
import {ShowcaseHistory} from '../app/showcase-history.js';

test('Showcase restores immutable takes and media, and branches after undo',()=>{
  const history=new ShowcaseHistory(),blob=new Blob(['signature']),model={name:'Model'},take={model,blob};
  const before={color:'gray',takes:[take],layers:[{blob}],view:{angle:0}};
  history.observe(before);history.observe({...before,takes:[]});
  assert.equal(history.travel().takes[0],take);
  assert.equal(history.travel(true).takes.length,0);
  history.travel();history.observe({...before,color:'black'});
  assert.equal(history.travel(true),null);
  assert.equal(history.travel(),before);
  assert.equal(before.layers[0].blob,blob);
});

test('continuous camera and layer drags undo in one step; equal camera samples add none',()=>{
  const history=new ShowcaseHistory();history.observe({view:{angle:0},layer:0});
  assert.equal(history.observe({view:{angle:0},layer:0}),false);
  history.begin('camera');
  for(let angle=1;angle<=20;angle++)history.observe({view:{angle},layer:0});
  history.end();history.begin('layer');
  for(let layer=1;layer<=10;layer++)history.observe({view:{angle:20},layer});
  history.end();assert.equal(history.undo.length,2);
  assert.deepEqual(history.travel(),{view:{angle:20},layer:0});
  assert.deepEqual(history.travel(),{view:{angle:0},layer:0});
  assert.deepEqual(history.travel(true),{view:{angle:20},layer:0});
  assert.deepEqual(history.travel(true),{view:{angle:20},layer:10});
});

test('asynchronous timing refreshes with identical playlist contents do not hide the model-load undo step',()=>{
  const history=new ShowcaseHistory(),first={name:'First'},second={name:'Second'},rows=[{sequence:0,seconds:2,durationLoops:1}];
  history.observe({source:first,sequencePlaylist:rows});
  history.observe({source:second,sequencePlaylist:structuredClone(rows)});
  assert.equal(history.observe({source:second,sequencePlaylist:structuredClone(rows)}),false);
  assert.equal(history.undo.length,1);assert.equal(history.travel().source,first);
});
