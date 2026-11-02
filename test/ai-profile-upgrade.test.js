import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import legacy from './fixtures/ai-legacy-profile.json' with {type:'json'};
import { tempDir } from './helpers/fixtures.cjs';
const {AiService}=createRequire(import.meta.url)('../electron/ai-service.cjs');
const root=path.resolve(import.meta.dirname,'..');

test('legacy profile upgrades without losing chats, settings or personal files, refuses delegated Resume and cleans old sessions',async t=>{
  const profile=tempDir('mdlxl-ai-upgrade-'),ai=path.join(profile,'ai');
  t.after(()=>fs.rm(profile,{recursive:true,force:true}));await fs.mkdir(ai,{recursive:true});
  const write=async(file,data)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof data==='string'?data:JSON.stringify(data));};
  await write(path.join(ai,'connections.json'),legacy.connections);await write(path.join(ai,'organisers.json'),legacy.registry);
  for(const [id,chat] of Object.entries(legacy.chats)){await write(path.join(ai,'chat-'+id+'.json'),chat);await write(path.join(ai,'chat-'+id+'.json.tmp'),chat);}
  const sentinels={'settings.json':'personal settings','Addons/personal.txt':'personal addon','ai/codex/auth.json':'personal auth','ai/claude/projects/user/unrelated-thread-123456.jsonl':'unrelated session'};
  for(const [file,text] of Object.entries(sentinels))await write(path.join(profile,file),text);
  await write(path.join(ai,'codex/sessions/rollout-crow-thread-123456.jsonl'),'old crow session');
  await write(path.join(ai,'claude/projects/model/raven-thread-123456.jsonl'),'old raven session');
  const service=new AiService({root,profile,electron:{},getWindow:()=>null});t.after(()=>service.close());
  const originalRegistry=await fs.readFile(path.join(ai,'organisers.json'),'utf8');
  const config=await service.configuration();
  assert.equal('offload' in config,false);assert.equal('routing' in config,false);
  for(const provider of Object.values(config.providers)){assert.equal('allowLighter' in provider,false);assert.equal('lightModel' in provider,false);}
  const wanted=structuredClone(legacy.connections);delete wanted.offload;delete wanted.routing;
  for(const provider of Object.values(wanted.providers)){delete provider.allowLighter;delete provider.lightModel;}
  assert.deepEqual(config,wanted);
  await service.configure({provider:'compatible',model:'chosen',baseUrl:'http://127.0.0.1:9/v1',effort:'high'});
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(ai,'connections.json'),'utf8')),wanted);
  assert.equal(await fs.readFile(path.join(ai,'organisers.json'),'utf8'),originalRegistry);
  const current=await service.organiser({modelKey:'file:legacy'});
  assert.equal(current.id,'legacy');assert.deepEqual(current.earlier,['earlier']);assert.equal('workers' in current,false);
  const chat=await service.readConversation('legacy');
  assert.equal(chat.transcript[1].parts[0].report,'Shoulders preserved.');assert.equal(chat.transcript[1].parts[0].status,'stopped');
  assert.equal((await service.readConversation('legacy-crow')).transcript[0].from,'organiser');
  assert.equal((await service.readConversation('earlier')).transcript[0].text,'Earlier request');
  assert.equal((await service.taskInfo('legacy')).canResume,false);
  let editorCalls=0;service.call=()=>{editorCalls++;throw Error('A legacy resume must not call the editor');};
  for(const task of [{workerId:'legacy-crow'},{regionJobs:[{job:'old split'}]}]){
    chat.task={status:'interrupted',steps:[],...task};
    await assert.rejects(service.send({id:'legacy',context:{target:'current',documentId:'legacy'},resume:true}),/cannot resume/);
  }
  assert.equal(editorCalls,0);
  const found=await service.chatsOf(await service.registry.model('file:legacy'));
  assert.deepEqual(found.ids,['legacy','legacy-crow','earlier','earlier-raven']);
  assert.deepEqual(found.threads,['crow-thread-123456','raven-thread-123456']);
  const cleared=await service.cleanup({modelKey:'file:legacy',mode:'wipe'});assert.equal(cleared.removedChats,4);assert.equal(cleared.providerFiles,2);
  for(const id of found.ids)for(const suffix of ['', '.tmp'])await assert.rejects(fs.stat(service.chatFile(id)+suffix),{code:'ENOENT'});
  for(const [file,text] of Object.entries(sentinels))assert.equal(await fs.readFile(path.join(profile,file),'utf8'),text);
});

test('saved delegated reports render as plain read-only text without bird controls',async()=>{
  const {build}=await import('esbuild');const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
  const result=await build({entryPoints:[path.join(root,'app/AiParts.jsx')],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',logLevel:'silent'});
  const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
  const html=renderToStaticMarkup(React.createElement(module.exports.AssistantMessage,{message:legacy.chats.legacy.transcript[1],live:false}));
  assert.match(html,/Keep shoulders/);assert.match(html,/Shoulders preserved/);
  assert.doesNotMatch(html,/<button|--bird|ai-worker|Handing the job/);
});
