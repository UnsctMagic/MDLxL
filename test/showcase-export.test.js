import test from 'node:test';
import assert from 'node:assert/strict';
import {SHOWCASE_GIF_LEVELS,gifCaptureSize,gifLevel,legacyGifLevel} from '../app/showcase-export.js';
import {flushRecordingQueue,queueRecording,recordingQueueSnapshot,retryRecordingSaves} from '../app/preview-recording-queue.js';

test('quality levels capture above their GIF size and older setups keep their look',()=>{
  for(const id of Object.keys(SHOWCASE_GIF_LEVELS))assert.ok(gifCaptureSize(id)>=SHOWCASE_GIF_LEVELS[id].longEdge&&gifCaptureSize(id)<=1920);
  assert.equal(gifLevel('nonsense'),'medium');
  assert.equal(legacyGifLevel({gifLevel:'best'},'low-size'),'best');
  assert.equal(legacyGifLevel({quality:'high'},'low-size'),'medium','old Low Size sets become Medium');
  assert.equal(legacyGifLevel({quality:'low'}),'high','old local 864 px GIFs become High');
});

test('background export queue retains failed saves for retry',async()=>{
  let fail=true,saves=0;
  globalThis.window={desktop:{
    finishPreviewRecording:async()=>({width:16,height:8}),
    savePreviewRecording:async()=>{saves++;if(fail)throw Error('Disk busy');return {path:'/local/kept.gif',size:100};}
  }};
  queueRecording({jobId:'retry',time:1});
  await assert.rejects(flushRecordingQueue(),/could not be saved/);
  assert.equal(recordingQueueSnapshot().retry,1);
  fail=false;await retryRecordingSaves();
  assert.equal(recordingQueueSnapshot().retry,0);
  assert.ok(saves>=2);
  delete globalThis.window;
});
