import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { decodeDds } from '../src/dds.js';
const require=createRequire(import.meta.url), {CascTextures}=require('../electron/casc.cjs'), {GameDataDiscovery}=require('../electron/game-data.cjs');
async function scratch(t) {
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'mdlvis-casc-'));
 t.after(async()=>{if(path.dirname(base)!==path.resolve(os.tmpdir())||!path.basename(base).startsWith('mdlvis-casc-'))throw Error('Invalid cleanup path');await fs.rm(base,{recursive:true,force:true});});
 return base;
}
test('native byte cache survives restart and invalidates on Warcraft build changes',async t=>{
 const base=await scratch(t),game=path.join(base,'Warcraft III'),cacheDirectory=path.join(base,'cache');await fs.mkdir(game);await fs.writeFile(path.join(game,'.build.info'),'build1');
 let opens=0;const openReader=()=>{opens++;return {read:async()=>Buffer.from('texture'+opens),close(){}};};
 const first=new CascTextures({cacheDirectory,openReader});assert.equal((await first.read('Units\\Peon.blp',[game])).toString(),'texture1');await first.close();
 const second=new CascTextures({cacheDirectory,openReader});assert.equal((await second.read('Units\\Peon.blp',[game])).toString(),'texture1');assert.equal(opens,1);
 await fs.writeFile(path.join(game,'.build.info'),'build2');assert.equal((await second.read('Units\\Peon.blp',[game])).toString(),'texture2');await second.close();
});
test('cached missing texture falls through to the next installation',async t=>{
 const base=await scratch(t),a=path.join(base,'a'),b=path.join(base,'b');for(const folder of [a,b]){await fs.mkdir(folder);await fs.writeFile(path.join(folder,'.build.info'),'build');}
 const options={cacheDirectory:path.join(base,'cache'),openReader:folder=>({read:async()=>folder===a?null:Buffer.from('found'),close(){}})};
 const first=new CascTextures(options);assert.equal((await first.read('a.blp',[a,b])).toString(),'found');await first.close();
 const next=new CascTextures({...options,openReader:()=>{throw Error('Cache should satisfy both lookups');}});assert.equal((await next.read('a.blp',[a,b])).toString(),'found');await next.close();
});
test('CASC discovery cache avoids registry and directory scans until build metadata changes',async t=>{
 const base=await scratch(t),game=path.join(base,'Warcraft III'),cacheFile=path.join(base,'cache.json');await fs.mkdir(path.join(game,'Data'),{recursive:true});await fs.writeFile(path.join(game,'.build.info'),'build1');
 const options={cacheFile,env:{},registry:async()=>[game],drives:async()=>[]};
 assert.deepEqual((await new GameDataDiscovery(options).discover()).cascFolders,[game]);
 const restart=new GameDataDiscovery({...options,registry:()=>{throw Error('Unexpected registry scan');},readdir:()=>{throw Error('Unexpected directory scan');}});
 assert.equal((await restart.discover()).fromCache,true);
 await fs.writeFile(path.join(game,'.build.info'),'new-build2');
 assert.notEqual((await new GameDataDiscovery(options).discover()).fromCache,true);
});
test('native DDS top mip decodes BC1 colors and rejects truncated or unsupported data',()=>{
 const source=new Uint8Array(136),v=new DataView(source.buffer);v.setUint32(0,0x20534444,true);v.setUint32(4,124,true);v.setUint32(12,4,true);v.setUint32(16,4,true);v.setUint32(84,0x31545844,true);v.setUint16(128,0xf800,true);
 const decoded=decodeDds(source);assert.equal(decoded.width,4);assert.equal(decoded.height,4);assert.deepEqual(Array.from(decoded.data.slice(0,4)),[255,0,0,255]);
 assert.throws(()=>decodeDds(source.subarray(0,135)),/truncated/);v.setUint32(84,0x30315844,true);assert.throws(()=>decodeDds(source),/Unsupported/);
});

test('native BC5 normal maps decode both endpoint modes and cross-byte indices',()=>{
 const source=new Uint8Array(144),v=new DataView(source.buffer);
 for(const [offset,value] of [[0,0x20534444],[4,124],[12,3],[16,3],[84,0x32495441]])v.setUint32(offset,value,true);
 source.set([240,30],128);source.set([40,200],136);
 // The third pixel's three-bit index straddles bytes; the seventh uses the
 // explicit 0/255 endpoints in the green channel's six-value mode.
 const indices=[0,1,2,3,4,5,6,7,0,1,2,3,4,5,6,7];
 for(const start of [130,138])for(let i=0;i<16;i++) {
   const bit=i*3,byte=bit>>>3;source[start+byte]|=indices[i]<<(bit&7);
   if(byte<5)source[start+byte+1]|=indices[i]>>>(8-(bit&7));
 }
 const image=decodeDds(source);assert.deepEqual([image.width,image.height,image.data.length],[3,3,36]);
 const red=[240,30,210,180,150,120,90,60],green=[40,200,72,104,136,168,0,255];
 for(let y=0;y<3;y++)for(let x=0;x<3;x++) {
   const index=indices[y*4+x],offset=(y*3+x)*4,r=red[index],g=green[index];
   assert.deepEqual(Array.from(image.data.slice(offset,offset+2)),[r,g]);
   assert.equal(image.data[offset+2],Math.round((Math.sqrt(Math.max(0,1-(r/127.5-1)**2-(g/127.5-1)**2))+1)*127.5));
   assert.equal(image.data[offset+3],255);
 }
 assert.throws(()=>decodeDds(source.subarray(0,143)),/truncated/);
 v.setUint32(16,0,true);assert.throws(()=>decodeDds(source),/dimensions/);
});
