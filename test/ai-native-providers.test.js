import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {AI_TOOLS} from '../src/ai-tools.js';
const {runCodex,runClaude,CodexProcess}=createRequire(import.meta.url)('../electron/ai-providers.cjs');
const {AiService}=createRequire(import.meta.url)('../electron/ai-service.cjs');
const {AiAwareness}=createRequire(import.meta.url)('../electron/ai-awareness.cjs');

test('editor shutdown aborts a pending external tool and its sandbox signal',async()=>{
 const sent=[],win={isDestroyed:()=>false,webContents:{send:(...args)=>sent.push(args)}};
 const service=new AiService({root:'.',profile:'.',electron:{},getWindow:()=>win});service.ready=true;
 const pending=service.call('mdlxl_script',{code:'wait'}),rejected=assert.rejects(pending,/Editor closed/);
 const request=[...service.pending.values()][0];assert.equal(request.signal.aborted,false);
 const closing=service.close();assert.equal(service.close(),closing);await closing;await rejected;
 assert.equal(request.signal.aborted,true);assert.equal(service.pending.size,0);assert.equal(sent.at(-1)[0],'ai:toolCancel');
});

test('separate streamed assistant messages retain paragraph boundaries',()=>{
 const events=[],client=new CodexProcess({},{event:event=>events.push(event)});
 for(const [itemId,delta] of [['first','Inspecting '],['first','the selection.'],['second','**Done.**']])client.receive({method:'item/agentMessage/delta',params:{itemId,delta}});
 assert.equal(events.map(event=>event.text).join(''),'Inspecting the selection.\n\n**Done.**');
});

// A real child-process fixture verifies framing, MCP wiring and native adapter
// lifecycle without borrowing a user's credentials or making paid requests.
const fixture=String.raw`
const fs=require('node:fs');const args=process.argv.slice(2),codex=args[0]==='app-server';
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
async function tool(url,authorization){const response=await fetch(url,{method:'POST',headers:{authorization,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'mdlxl_read',arguments:{path:'/Info'}}})});const result=await response.json();if(!result.result?.content[0]?.text.includes('fixture'))throw Error('MCP failed');}
if(codex){
 require('node:readline').createInterface({input:process.stdin}).on('line',async line=>{const m=JSON.parse(line);if(m.id===undefined)return;
 fs.appendFileSync('fixture-calls.jsonl',JSON.stringify({method:m.method})+'\n');
 if(m.method==='initialize')return send({id:m.id,result:{userAgent:'fixture'}});
 if(m.method==='account/read'){if(m.params.refreshToken!==true)process.exit(7);return send({id:m.id,result:{account:fs.existsSync('signed-out')?null:{type:'chatgpt',planType:'plus'},requiresOpenaiAuth:true}});}
 if(m.method==='account/login/start'){send({id:m.id,result:{type:'chatgpt',loginId:'fixture',authUrl:'https://auth.openai.com/fixture'}});setTimeout(()=>{const failure=fs.existsSync('login-fails');if(!failure&&fs.existsSync('signed-out'))fs.unlinkSync('signed-out');send({method:'account/login/completed',params:{success:!failure,error:failure?'Login declined':null}});},25);return;}
 if(m.method==='thread/start'||m.method==='thread/resume'){if(m.params.sandbox!=='read-only'||m.params.approvalPolicy!=='never')process.exit(4);return send({id:m.id,result:{thread:{id:'codex-fixture'}}});}
 if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'turn-fixture'}}});const setting=args.find(a=>a.startsWith('mcp_servers.mdlxl.url='));await tool(JSON.parse(setting.split('=').slice(1).join('=')),'Bearer '+process.env.MDLXL_AI_TOKEN);send({method:'item/agentMessage/delta',params:{delta:'Native Codex response'}});send({method:'turn/completed',params:{turn:{status:'completed'}}});return;}
 send({id:m.id,result:{}});
 });
}else{
 if(args[args.indexOf('--tools')+1]!==''||args[args.indexOf('--allowedTools')+1]!=='mcp__mdlxl__*'||!args.includes('--strict-mcp-config')||args.includes('--dangerously-skip-permissions'))process.exit(5);
 let input='';process.stdin.on('data',chunk=>input+=chunk);process.stdin.on('end',async()=>{const message=JSON.parse(input);if(message.message.content[0].text!=='test prompt')process.exit(6);const config=JSON.parse(fs.readFileSync(args[args.indexOf('--mcp-config')+1],'utf8')).mcpServers.mdlxl;await tool(config.url,config.headers.Authorization);send({type:'stream_event',session_id:'claude-fixture',event:{type:'content_block_delta',delta:{type:'text_delta',text:'Native Claude response'}}});send({type:'result',session_id:'claude-fixture',is_error:false,result:'Native Claude response'});});
}
`;
async function executable(t){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'mdlxl-ai-native-'));
 t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const script=path.join(directory,'agent.js');await fs.writeFile(script,fixture);
 const file=path.join(directory,process.platform==='win32'?'agent.cmd':'agent');
 if(process.platform==='win32')await fs.writeFile(file,'@"%dp0%\\agent.js" %*\r\n');
 else{await fs.writeFile(file,'#!'+process.execPath+'\n'+fixture);await fs.chmod(file,0o700);}
 return {directory,executable:file};
}
for(const [name,run] of [['Codex',runCodex],['Claude',runClaude]])test(name+' native adapter drives its own MCP client and preserves conversation',async t=>{
 const config=await executable(t),calls=[],events=[],conversation={};
 await run({settings:{executable:config.executable},directory:config.directory,tools:AI_TOOLS,call:async(name,args)=>{calls.push({name,args});return {name:'fixture'};},system:'MDLxL tools only',prompt:'test prompt',images:[],conversation,signal:new AbortController().signal,event:e=>events.push(e)});
 assert.equal(calls.length,1);assert.equal(calls[0].name,'mdlxl_read');assert.equal(conversation.threadId,name.toLowerCase()+'-fixture');assert.equal(events.filter(e=>e.type==='text').map(e=>e.text).join(''),'Native '+name+' response');
 assert.equal((await fs.readdir(config.directory)).some(n=>n.startsWith('claude-run-')),false);
});

test('signed-out Codex cannot create a turn or call an editor tool',async t=>{
 const config=await executable(t),calls=[];
 await fs.writeFile(path.join(config.directory,'signed-out'),'');
 await assert.rejects(runCodex({settings:{executable:config.executable},directory:config.directory,tools:AI_TOOLS,call:async()=>calls.push('edit'),system:'MDLxL tools only',prompt:'turn this into a circle',images:[],conversation:{},signal:new AbortController().signal,event:()=>{}}),error=>error.code==='AI_AUTH_REQUIRED');
 assert.equal(calls.length,0);
 const requests=(await fs.readFile(path.join(config.directory,'fixture-calls.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line).method);
 assert.deepEqual(requests,['initialize','account/read']);
});

test('native Codex receives enabled live context during a running turn without another user turn',async t=>{
 const config=await executable(t),events=[],awareness=new AiAwareness();awareness.setEnabled(true);
 await runCodex({settings:{executable:config.executable},directory:config.directory,tools:AI_TOOLS,call:async()=>{awareness.update({frame:321,selection:{0:[2,4]}});await new Promise(resolve=>setTimeout(resolve,30));return {name:'fixture'};},system:'MDLxL tools only',prompt:'test prompt',images:[],conversation:{},signal:new AbortController().signal,event:event=>events.push(event),awareness});
 const requests=(await fs.readFile(path.join(config.directory,'fixture-calls.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line).method);
 assert.ok(requests.includes('thread/inject_items'));assert.equal(requests.filter(method=>method==='turn/start').length,1);assert.equal(events.filter(event=>event.type==='awareness-delivered').length,1);
});

test('service preserves an unauthenticated prompt outside chat history, verifies login, and reads it after a process restart',async t=>{
 const config=await executable(t),opened=[];
 const service=new AiService({root:path.resolve('.'),profile:config.directory,electron:{shell:{openExternal:async url=>opened.push(url)}},getWindow:()=>null});
 t.after(()=>service.close());
 await service.configure({provider:'codex',executable:config.executable});
 await fs.writeFile(path.join(service.directory,'signed-out'),'');
 const result=await service.send({id:'signin-test',text:'turn this into a circle',context:{target:'unchanged-selection'}});
 assert.equal(result.authRequired,true);assert.equal(service.conversations.size,0);assert.equal(service.active,null);
 await fs.writeFile(path.join(service.directory,'login-fails'),'');
 await assert.rejects(service.auth('login'),/Login declined/);
 assert.equal((await service.auth('status')).loggedIn,false);
 await fs.unlink(path.join(service.directory,'login-fails'));
 assert.equal((await service.auth('login')).loggedIn,true);
 assert.equal(opened.length,2);assert.equal(opened[0],'https://auth.openai.com/fixture');
 assert.equal((await service.auth('status')).loggedIn,true);
});
