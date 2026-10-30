import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {tempDir} from './helpers/fixtures.cjs';
const require=createRequire(import.meta.url);
const {AiService}=require('../electron/ai-service.cjs');
const {AiSteering}=require('../electron/ai-offload.cjs');

test('a failed native steering delivery resets the context cursor before the late follow-up',async t=>{
  const profile=tempDir('ai-context-native-'),events=[];
  const service=new AiService({root:path.resolve('.'),profile,electron:{},getWindow:()=>null});
  t.after(async()=>{await service.close();await fs.rm(profile,{recursive:true,force:true});});
  await fs.mkdir(path.join(service.directory,'bin'),{recursive:true});
  await fs.writeFile(path.join(service.directory,'package.json'),'{"type":"commonjs"}');
  const agent=path.join(service.directory,'agent.js');
  await fs.copyFile(new URL('./fixtures/ai-context-agent.cjs',import.meta.url),agent);
  const executable=path.join(service.directory,'bin',process.platform==='win32'?'codex.cmd':'codex');
  if(process.platform==='win32')await fs.writeFile(executable,'@"%dp0%\\..\\agent.js" %*\r\n');
  else {await fs.writeFile(executable,'#!'+process.execPath+'\n'+await fs.readFile(agent,'utf8'));await fs.chmod(executable,0o700);}
  await service.configure({provider:'codex',model:'fixture',executable});
  const ready=Promise.withResolvers(),initialDelivery=Promise.withResolvers(),deliveryFailed=Promise.withResolvers();
  const take=AiSteering.prototype.take;
  t.mock.method(AiSteering.prototype,'take',function(){
    const message=take.call(this);
    initialDelivery.resolve();
    return message;
  });
  let resets=0;
  service.emit=e=>{events.push(e);if(e.type==='text'&&e.text==='READY')ready.resolve();};
  const meter=service.measureUsage.bind(service);
  service.measureUsage=(conversation,recorder,role)=>{
    const emit=meter(conversation,recorder,role);
    return e=>{if(e.type==='context-reset'){resets++;conversation.task.context.revision=2;}emit(e);if(e.type==='context-reset')deliveryFailed.resolve();};
  };
  const pending=service.send({id:'native-context',text:'Inspect the current selection',context:{target:'selected',documentId:'model',revision:1,selection:{0:[1,2]},nodes:[{id:42,name:'Selected joint'}]}});
  // READY can arrive before turn/start resumes and drains the initial queue.
  // Queue steering only after that drain, so it has one delivery attempt.
  await Promise.all([ready.promise,initialDelivery.promise]);
  await service.steer({id:'native-context',text:'New instruction: keep the marked shape'});
  await deliveryFailed.promise;
  const result=await pending;
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(resets,1);
  assert.ok(events.some(e=>e.type==='text'&&e.text.includes('Fresh context received.')));
  assert.equal(events.some(e=>e.type==='context-reset'),false,'cursor bookkeeping stays out of the visible transcript');
});
