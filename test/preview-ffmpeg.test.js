import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { PreviewRecordingStore, timeline, bitmap, gifSizeLimit, GIF_LEVELS } = require('../electron/preview-ffmpeg.cjs');
const { validateGIFFile, MAX_CAPTURE_BYTES } = require('../electron/preview-capture.cjs');

function inspectGIF(bytes) {
  assert.equal(bytes.subarray(0,6).toString(), 'GIF89a');
  let offset = 13 + (bytes[10] & 128 ? 3 * (1 << ((bytes[10] & 7) + 1)) : 0);
  let delay = 0, frames = 0, loop = null;
  const subblocks = () => { while (bytes[offset]) offset += bytes[offset] + 1; offset++; };
  while (offset < bytes.length) {
    const type = bytes[offset++];
    if (type === 0x3b) return { delay, frames, loop };
    if (type === 0x21) {
      const label = bytes[offset++];
      if (label === 0xf9) delay += bytes.readUInt16LE(offset + 2) * 10;
      if (label === 0xff && bytes.subarray(offset + 1, offset + 12).toString() === 'NETSCAPE2.0') loop = bytes.readUInt16LE(offset + 14);
      subblocks();
    } else if (type === 0x2c) {
      frames++; const packed = bytes[offset + 8]; offset += 9;
      if (packed & 128) offset += 3 * (1 << ((packed & 7) + 1));
      offset++; subblocks();
    } else assert.fail(`Unknown GIF block ${type} at ${offset}`);
  }
  assert.fail('GIF trailer missing');
}
function frame(index, width = 16, height = 8) {
  const bytes = new Uint8Array(width * height * 4);
  for (let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const p=(y*width+x)*4; bytes[p]=(x*16+index*47)%256; bytes[p+1]=y*30; bytes[p+2]=(index*23)%256; bytes[p+3]=255;
  }
  return bytes;
}
// FFmpeg is fetched, not committed. A fresh worktree without it borrows the
// pinned copy from the main checkout; encoding tests skip only if neither has one.
function findFFmpeg() {
  const own = path.resolve('electron/ffmpeg/ffmpeg.exe');
  if (existsSync(own)) return own;
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8', windowsHide: true }).trim();
    const main = path.join(path.dirname(common), 'electron', 'ffmpeg', 'ffmpeg.exe');
    if (existsSync(main)) return main;
  } catch {}
  return null;
}
const ffmpeg = findFFmpeg();
const encodes = process.platform !== 'win32' || (!ffmpeg && 'FFmpeg not fetched; run pnpm run fetch-ffmpeg');
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlxl-gif-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return new PreviewRecordingStore({ temporaryRoot: path.join(root,'frames'), destination: path.join(root,'Screenshots'), ...(ffmpeg && { executable: ffmpeg }), ...options });
}

test('recording uses the destination drive even when the system temporary drive is full', { skip: encodes }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlxl-gif-drive-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const destination = path.join(root, 'Showcase Recordings');
  const store = new PreviewRecordingStore({ destination, executable: ffmpeg });
  const diskChecks = [];
  t.mock.method(fs, 'statfs', async directory => {
    diskChecks.push(directory);
    return { bavail: directory.startsWith(destination + path.sep) ? 32 * 1024 ** 3 : 0, bsize: 1 };
  });
  const { jobId, storageBudget } = await store.begin(1, { width: 16, height: 8, level:'high', loop: true });
  const job = store.get(1, jobId), directory = job.directory;
  assert.equal(storageBudget, store.maxTempBytes);
  assert.ok(directory.startsWith(destination + path.sep));
  for (let i = 0; i < 30; i++) {
    const result = await store.frame(1, { jobId, width: 16, height: 8, time: i * 1000 / 30, buffer: frame(i) });
    assert.equal(result.accepted, true);
  }
  await store.finish(1, { jobId, time: 1000 });
  const saved = await store.save(1, jobId);
  assert.deepEqual(inspectGIF(await fs.readFile(saved.path)), { delay: 1000, frames: 30, loop: 0 });
  assert.ok(diskChecks.length > 30);
  assert.ok(diskChecks.every(directory => directory.startsWith(destination + path.sep)));
  await assert.rejects(fs.access(directory));
});
test('GIF timing rounds cumulatively at every supported capture FPS and preserves holds', () => {
  for (const fps of [10,15,20,24,25,30,50]) {
    const frames = Array.from({length:fps},(_,i)=>({file:String(i),time:i*1000/fps}));
    const result = timeline(frames,1000);
    assert.equal(result.entries.reduce((sum,item)=>sum+item.ticks,0),100);
    assert.equal(result.entries.length,fps);
  }
  assert.equal(timeline([{file:'one',time:0}], 1).duration,20);
  const held=timeline([{file:'a',time:0},{file:'b',time:93},{file:'c',time:417}],1234);
  assert.deepEqual(held.entries.map(x=>x.ticks),[9,33,81]);
  assert.deepEqual(timeline([{file:'a',time:0}],700000).entries.map(x=>x.ticks),[65535,4465]);
  assert.throws(()=>timeline([{file:'a',time:100}],99));
});
test('lossless BMP writes correct red/blue order and top-down dimensions', () => {
  const result=bitmap(new Uint8Array([255,17,3,255]),1,1);
  assert.deepEqual([...result.subarray(54)],[3,17,255,255]);
  assert.equal(result.readInt32LE(22),-1);
});
test('real bundled FFmpeg: 24/30 FPS, irregular frames, one-frame capture, loops, save/retry', { skip: encodes }, async t => {
  const store=await fixture(t);
  for (const [fps,loop,level] of [[24,true,'medium'],[30,false,'high'],[1,false,'low']]) {
    const {jobId}=await store.begin(1,{width:16,height:8,level,loop});
    const count=fps===1?1:fps;
    for(let i=0;i<count;i++)await store.frame(1,{jobId,width:16,height:8,time:i*1000/fps,buffer:frame(i)});
    const output=await store.finish(1,{jobId,time:fps===1?1234:1000});
    const job=store.get(1,jobId), decoded=inspectGIF(await fs.readFile(job.output));
    assert.equal(decoded.delay, fps===1?1230:1000);
    assert.equal(decoded.loop, loop?0:null);
    assert.equal(decoded.frames,count);
    assert.equal(output.duration,decoded.delay);
    const oldDestination=store.destination;
    if(fps===24){
      const blocked=path.join(path.dirname(oldDestination),'blocked'); await fs.writeFile(blocked,'file'); store.destination=path.join(blocked,'Screenshots');
      await assert.rejects(store.save(1,jobId)); assert.equal(store.get(1,jobId).phase,'ready'); await fs.access(job.output); store.destination=oldDestination;
    }
    const saved=await store.save(1,jobId); await validateGIFFile(saved.path);
    assert.equal(store.jobs.size,0); await assert.rejects(fs.access(job.directory));
  }
  const {jobId}=await store.begin(1,{width:16,height:8,level:'medium',loop:true});
  for(const [i,time] of [0,93,417].entries())await store.frame(1,{jobId,width:16,height:8,time,buffer:frame(i)});
  await store.finish(1,{jobId,time:1234});
  assert.equal(inspectGIF(await fs.readFile(store.get(1,jobId).output)).delay,1230);
  await store.save(1,jobId);
});
test('native boundary rejects malformed/stale/foreign frames, handles storage budget and missing binary', async t => {
  // Frame checks never run FFmpeg, so any existing file stands in for it.
  const store=await fixture(t,{maxTempBytes:16*8*4+54+512,executable:process.execPath});
  const {jobId}=await store.begin(1,{width:16,height:8,level:'low',loop:false});
  assert.throws(()=>store.frame(2,{jobId}));
  assert.throws(()=>store.frame(1,{jobId,width:16,height:8,time:0,buffer:new Uint8Array(1)}));
  await store.frame(1,{jobId,width:16,height:8,time:0,buffer:frame(0)});
  store.get(1,jobId).budget=store.get(1,jobId).bytes;
  assert.equal((await store.frame(1,{jobId,width:16,height:8,time:40,buffer:frame(1)})).limit,true);
  await store.discard(1,jobId);
  assert.throws(()=>store.get(1,jobId));
  const missing=await fixture(t,{executable:path.join(os.tmpdir(),'no-such-ffmpeg-mdlxl.exe')});
  await assert.rejects(missing.begin(1,{width:16,height:8,level:'medium',loop:false}),/missing/);
});
test('large invalid GIF is rejected by its contents without a renderer buffer', async t => {
  const store=await fixture(t); await fs.mkdir(store.temporaryRoot,{recursive:true});
  const file=path.join(store.temporaryRoot,'large.gif');
  const handle=await fs.open(file,'w'); await handle.truncate(MAX_CAPTURE_BYTES+1); await handle.close();
  await assert.rejects(validateGIFFile(file),/complete GIF/);
});

test('each quality level has one file-size budget; the fixed main picture has none', () => {
  assert.deepEqual(Object.keys(GIF_LEVELS),['low','medium','high','best']);
  assert.deepEqual(Object.keys(GIF_LEVELS).map(level=>gifSizeLimit(level,false)),[2_000_000,5_000_000,20_000_000,50_000_000]);
  for(const level of Object.keys(GIF_LEVELS))assert.equal(gifSizeLimit(level,true),Infinity);
  const levels=Object.values(GIF_LEVELS);
  for(let i=1;i<levels.length;i++)assert.ok(levels[i].longEdge>levels[i-1].longEdge&&levels[i].maxBytes>levels[i-1].maxBytes,'levels rise in size and budget');
});


test('export profiles cap dimensions and preserve frame timing beyond five seconds', { skip: encodes }, async t => {
  const store=await fixture(t);
  for(const [level,width,height] of [['medium',800,800],['high',1000,500],['low',500,1000],['best',1600,900],['low',300,200]]){
    const {jobId}=await store.begin(1,{width,height,level,loop:true});
    for(let i=0;i<3;i++)await store.frame(1,{jobId,width,height,time:i*1000/30,buffer:frame(i,width,height)});
    await store.finish(1,{jobId,time:100});
    const bytes=await fs.readFile(store.get(1,jobId).output);
    const w=bytes.readUInt16LE(6),h=bytes.readUInt16LE(8),decoded=inspectGIF(bytes);
    assert.equal(Math.max(w,h),Math.min(GIF_LEVELS[level].longEdge,Math.max(width,height)));
    assert.ok(Math.abs(w/h-width/height)<.005);
    assert.ok(bytes.length<=GIF_LEVELS[level].maxBytes);
    assert.equal(decoded.frames,3);assert.equal(decoded.delay,100);
    await store.save(1,jobId);
  }
  for(const mainPicture of [false,true]){
    const {jobId}=await store.begin(1,{width:16,height:8,level:'low',loop:true,mainPicture});
    await store.frame(1,{jobId,width:16,height:8,time:0,buffer:frame(0)});
    await store.frame(1,{jobId,width:16,height:8,time:6000,buffer:frame(1)});
    await store.finish(1,{jobId,time:7010});
    const saved=await store.save(1,jobId);
    assert.deepEqual(inspectGIF(await fs.readFile(saved.path)),{delay:7010,frames:2,loop:0});
    assert.equal(store.jobs.has(jobId),false);
  }
});

test('complex local GIF fits 20 MiB while keeping every frame, duration and loop', { skip: encodes }, async t => {
  const store=await fixture(t),width=864,height=864,count=40;
  const {jobId}=await store.begin(1,{width,height,level:'high',loop:true});
  for(let index=0;index<count;index++){
    const pixels=new Uint8Array(width*height*4);let seed=index+1;
    for(let p=0;p<pixels.length;p+=4){
      seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
      pixels[p]=seed&255;pixels[p+1]=(seed>>>8)&255;pixels[p+2]=(seed>>>16)&255;pixels[p+3]=255;
    }
    await store.frame(1,{jobId,width,height,time:index*1000/30,buffer:pixels});
  }
  const output=await store.finish(1,{jobId,time:count*1000/30});
  const saved=await store.save(1,jobId),bytes=await fs.readFile(saved.path),decoded=inspectGIF(bytes);
  assert.ok(bytes.length<=20*1024*1024);
  assert.ok(output.width<width&&output.height<height,'Complex frames must exercise the size-budget shrink');
  assert.equal(output.outputBytes,bytes.length);
  assert.equal(decoded.frames,count);assert.equal(decoded.delay,1330);assert.equal(decoded.loop,0);
  t.diagnostic(`Saved complex GIF: ${bytes.length} bytes, ${output.width}x${output.height}, ${decoded.frames} frames, ${decoded.delay} ms`);
});
