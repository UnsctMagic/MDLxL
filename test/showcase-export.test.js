import test from 'node:test';
import assert from 'node:assert/strict';
import {showcaseExportPreferences} from '../app/showcase-export.js';
import {flushRecordingQueue,queueRecording,recordingQueueSnapshot,retryRecordingSaves} from '../app/preview-recording-queue.js';

test('Low Size retains its FPS and quality settings',()=>{
  assert.deepEqual(showcaseExportPreferences({capture:{fps:10,recordingQuality:'low'}},'low-size').capture,{fps:30,recordingQuality:'low'});
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
