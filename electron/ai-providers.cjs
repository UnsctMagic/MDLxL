const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnAgent,stopAgent,lines,providerEnvironment}=require('./ai-process.cjs');
const {startMcpServer,callEditorTool}=require('./ai-mcp.cjs');
const {awarenessText}=require('./ai-awareness.cjs');

function endpoint(value) {
  const url=new URL(value);
  if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw Error('Use an HTTPS API base URL, or HTTP on localhost.');
  return url.href.replace(/\/$/,'');
}
async function requestJson(url,body,key,signal,headers={}) {
  const response=await fetch(url,{method:body?'POST':'GET',signal,redirect:'error',headers:{'content-type':'application/json',...(key?{Authorization:'Bearer '+key}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok) {
    let detail;try{detail=await response.json();}catch{}
    throw Error(`AI provider returned HTTP ${response.status}: ${String(detail?.error?.message||detail?.message||response.statusText).slice(0,1500)}`);
  }
  return response;
}
async function* sseEvents(response) {
  const decoder=new TextDecoder();let buffer='';
  for await(const chunk of response.body) {
    buffer=(buffer+decoder.decode(chunk,{stream:true})).replace(/\r\n/g,'\n');
    let end;
    while((end=buffer.indexOf('\n\n'))>=0) {
      const event=buffer.slice(0,end);buffer=buffer.slice(end+2);
      const data=event.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
      if(data&&data!=='[DONE]')yield JSON.parse(data);
    }
  }
}
function imageParts(images=[],kind='openai') {
  return images.map(image=>{
    const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image);
    if(!match)throw Error('Attach PNG, JPEG or WebP images.');
    return kind==='anthropic'?{type:'image',source:{type:'base64',media_type:match[1],data:match[2]}}:{type:'image_url',image_url:{url:image}};
  });
}
function authenticationRequired() {
  return Object.assign(Error('Sign in to connect your AI. Your prompt has been kept.'),{code:'AI_AUTH_REQUIRED'});
}
async function runApi({settings,key,tools,call,prompt,images,system,conversation,signal,event,awareness}) {
  const anthropic=settings.provider==='anthropic';
  const base=endpoint(settings.baseUrl||(anthropic?'https://api.anthropic.com/v1':'https://api.openai.com/v1'));
  if(!settings.model?.trim())throw Error('Choose a model in AI connection settings.');
  const history=conversation.messages||[];
  history.push({role:'user',content:[{type:'text',text:prompt},...imageParts(images,anthropic?'anthropic':'openai')]});
  conversation.messages=history;
  let awarenessVersion=awareness?.version;
  for(let step=0;step<64;step++) {
    if(signal.aborted)throw Error('AI request cancelled.');
    if(awareness?.enabled&&awareness.version!==awarenessVersion){history.push({role:'user',content:[{type:'text',text:awarenessText(awareness.snapshot())}]});awarenessVersion=awareness.version;}
    if(anthropic) {
      const response=await requestJson(base+'/messages',{model:settings.model,max_tokens:16384,system,messages:history,tools:tools.map(t=>({name:t.name,description:t.description,input_schema:t.inputSchema})),stream:true},key,signal,{'anthropic-version':'2023-06-01'});
      const content=[];let stopReason=null;
      for await(const data of sseEvents(response)) {
        if(data.type==='error')throw Error(data.error?.message||'Claude stream failed.');
        if(data.type==='content_block_start')content[data.index]={...data.content_block,_json:''};
        if(data.type==='content_block_delta') {
          const block=content[data.index];if(!block)continue;
          if(data.delta.type==='text_delta'){block.text=(block.text||'')+data.delta.text;event({type:'text',text:data.delta.text});}
          if(data.delta.type==='input_json_delta')block._json+=data.delta.partial_json;
          if(data.delta.type==='thinking_delta')block.thinking=(block.thinking||'')+data.delta.thinking;
          if(data.delta.type==='signature_delta')block.signature=(block.signature||'')+data.delta.signature;
        }
        if(data.type==='message_delta')stopReason=data.delta?.stop_reason;
      }
      if(!stopReason)throw Error('The provider stream ended before completion.');
      for(const block of content){if(block.type==='tool_use'&&block._json)block.input=JSON.parse(block._json);delete block._json;}
      history.push({role:'assistant',content});
      const calls=content.filter(b=>b.type==='tool_use');
      if(!calls.length){if(stopReason==='max_tokens')throw Error('The provider reached its output limit. Continue the conversation to finish.');return;}
      const results=[];
      for(const block of calls) {
        event({type:'tool',name:block.name});
        let result;try{result=await callEditorTool(tools,call,block.name,block.input,signal,awareness);}catch(error){result={isError:true,content:[{type:'text',text:error.message}]};}
        results.push({type:'tool_result',tool_use_id:block.id,is_error:!!result.isError,content:result.content.map(c=>c.type==='image'?{type:'image',source:{type:'base64',media_type:c.mimeType,data:c.data}}:c)});
        event({type:'tool-result',name:block.name,error:!!result.isError,summary:result.content.find(c=>c.type==='text')?.text?.slice(0,300)});
      }
      history.push({role:'user',content:results});
    } else {
      const response=await requestJson(base+'/chat/completions',{model:settings.model,messages:[{role:'system',content:system},...history],tools:tools.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.inputSchema}})),stream:true},key,signal);
      const calls=new Map();let text='',finishReason;
      for await(const data of sseEvents(response)) {
        if(data.error)throw Error(data.error.message||'AI stream failed.');
        const choice=data.choices?.[0];if(!choice)continue;
        finishReason=choice.finish_reason||finishReason;
        if(choice.delta?.content){text+=choice.delta.content;event({type:'text',text:choice.delta.content});}
        for(const delta of choice.delta?.tool_calls||[]) {
          let call=calls.get(delta.index);if(!call){call={id:'',type:'function',function:{name:'',arguments:''}};calls.set(delta.index,call);}
          if(delta.id)call.id=delta.id;
          if(delta.function?.name)call.function.name+=delta.function.name;
          if(delta.function?.arguments)call.function.arguments+=delta.function.arguments;
        }
      }
      if(!finishReason)throw Error('The provider stream ended before completion.');
      const toolCalls=[...calls.values()];history.push({role:'assistant',content:text||null,...(toolCalls.length?{tool_calls:toolCalls}:{})});
      if(!toolCalls.length){if(finishReason==='length')throw Error('The provider reached its output limit. Continue the conversation to finish.');return;}
      const imageMessages=[];
      for(const toolCall of toolCalls) {
        event({type:'tool',name:toolCall.function.name});
        let result;try{result=await callEditorTool(tools,call,toolCall.function.name,JSON.parse(toolCall.function.arguments),signal,awareness);}catch(error){result={isError:true,content:[{type:'text',text:error.message}]};}
        const textContent=result.content.filter(c=>c.type==='text').map(c=>c.text).join('\n');
        history.push({role:'tool',tool_call_id:toolCall.id,content:textContent||'Viewport image follows.'});
        for(const image of result.content.filter(c=>c.type==='image'))imageMessages.push({type:'image_url',image_url:{url:`data:${image.mimeType};base64,${image.data}`}});
        event({type:'tool-result',name:toolCall.function.name,error:!!result.isError,summary:textContent.slice(0,300)});
      }
      if(imageMessages.length)history.push({role:'user',content:[{type:'text',text:'Requested MDLxL viewport captures:'},...imageMessages]});
    }
  }
  throw Error('The AI used 64 tool rounds. Progress is retained; send another prompt to continue.');
}

class CodexProcess {
  constructor(settings,{directory,event=()=>{},mcp,signal}={}) {this.settings=settings;this.directory=directory;this.event=event;this.mcp=mcp;this.signal=signal;this.pending=new Map();this.nextId=1;}
  async start() {
    await fs.mkdir(this.directory,{recursive:true});
    const args=['app-server','-c','features.shell_tool=false','-c','web_search="disabled"'];
    const env=providerEnvironment(this.directory,'codex');
    await fs.mkdir(env.TEMP,{recursive:true});await fs.mkdir(env.CODEX_HOME,{recursive:true});
    if(this.mcp){env.MDLXL_AI_TOKEN=this.mcp.token;args.push('-c',`mcp_servers.mdlxl.url=${JSON.stringify(this.mcp.url)}`,'-c','mcp_servers.mdlxl.bearer_token_env_var="MDLXL_AI_TOKEN"','-c','mcp_servers.mdlxl.required=true','-c','mcp_servers.mdlxl.tool_timeout_sec=180');
      // Sending a prompt authorizes MDLxL's own editor tools, as in the Claude
      // allowlist. This is private to this child; shell/filesystem access stays restricted.
      for(const name of this.mcp.toolNames||[])args.push('-c',`mcp_servers.mdlxl.tools.${name}.approval_mode="approve"`);
    }
    this.child=spawnAgent(this.settings.executable||'codex',args,{cwd:this.directory,env});
    this.exited=new Promise(resolve=>this.child.once('close',resolve));
    this.child.on('error',error=>this.fail(error));this.child.on('exit',(code,signal)=>this.fail(Error(`Codex process exited (${code??signal}).`)));
    this.child.stdin.on('error',error=>this.fail(error));
    lines(this.child.stdout,line=>{let message;try{message=JSON.parse(line);}catch{return;}this.receive(message);},error=>this.fail(error));
    this.child.stderr.on('data',()=>{});
    this.abort=()=>{this.fail(Error('AI request cancelled.'));this.close();};this.signal?.addEventListener('abort',this.abort,{once:true});
    if(this.signal?.aborted){this.abort();throw Error('AI request cancelled.');}
    await this.request('initialize',{clientInfo:{name:'mdlxl',title:'MDLxL',version:'1.0.0'}});
    this.write({method:'initialized',params:{}});return this;
  }
  write(value){this.child.stdin.write(JSON.stringify(value)+'\n');}
  request(method,params={}) {
    const id=this.nextId++;
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Codex request timed out: '+method));},60000);this.pending.set(id,{resolve,reject,timer});this.write({id,method,params});});
  }
  receive(message) {
    if(message.id!==undefined&&message.method) {
      // The editor grants model tools, not terminal or arbitrary filesystem access.
      const decision=message.method.includes('requestApproval')?{decision:'decline'}:null;
      this.write(decision?{id:message.id,result:decision}:{id:message.id,error:{code:-32601,message:'Ask the user in the conversation; this client supports MDLxL tools.'}});
      this.event({type:'notice',text:'Codex requested an operation outside the editor tools: '+message.method});return;
    }
    if(message.id!==undefined) {
      const pending=this.pending.get(message.id);if(!pending)return;clearTimeout(pending.timer);this.pending.delete(message.id);message.error?pending.reject(Error(message.error.message)):pending.resolve(message.result);return;
    }
    const p=message.params||{};
    if(message.method==='item/agentMessage/delta'){
      if(p.itemId&&this.messageId&&p.itemId!==this.messageId)this.event({type:'text',text:'\n\n'});
      this.messageId=p.itemId||this.messageId;this.event({type:'text',text:p.delta});
    }
    if(message.method==='item/started'&&p.item?.type==='mcpToolCall')this.event({type:'tool',name:p.item.tool});
    if(message.method==='item/completed'&&p.item?.type==='mcpToolCall')this.event({type:'tool-result',name:p.item.tool,error:p.item.status==='failed'});
    if(message.method==='account/login/completed')this.login?.(p);
    if(message.method==='turn/completed')this.turn?.(p.turn);
    if(message.method==='error')this.event({type:'notice',text:p.error?.message||'Codex reported an error.'});
  }
  fail(error){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();this.turnError?.(error);this.loginError?.(error);}
  async account(){return this.request('account/read',{refreshToken:true});}
  async close(){this.signal?.removeEventListener('abort',this.abort);stopAgent(this.child);if(this.exited)await this.exited;}
}
async function runCodex(options) {
  const {settings,directory,event,tools,call,system,prompt,images,conversation,signal,awareness}=options;
  const mcp=await startMcpServer({tools,call,awareness});
  const client=new CodexProcess(settings,{directory,event,mcp,signal});
  let unsubscribe,updates=Promise.resolve(),pendingContext,delivering=false;
  try {
    await client.start();
    const account=await client.account();
    if(!account.account&&account.requiresOpenaiAuth!==false)throw authenticationRequired();
    const params={cwd:directory,approvalPolicy:'never',sandbox:'read-only',...(settings.model?{model:settings.model}:{}),developerInstructions:system};
    const result=conversation.threadId?await client.request('thread/resume',{...params,threadId:conversation.threadId}):await client.request('thread/start',params);
    conversation.threadId=result.thread.id;
    unsubscribe=awareness?.subscribe(value=>{
      if(signal.aborted)return;pendingContext=value;if(delivering)return;delivering=true;
      updates=(async()=>{while(pendingContext&&!signal.aborted){const latest=pendingContext;pendingContext=null;await client.request('thread/inject_items',{threadId:conversation.threadId,items:[{type:'message',role:'user',content:[{type:'input_text',text:awarenessText(latest)}]}]});event({type:'awareness-delivered',version:latest.version});}})().catch(error=>event({type:'notice',text:'Live context delivery failed: '+error.message})).finally(()=>{delivering=false;});
    });
    const completed=new Promise((resolve,reject)=>{client.turn=turn=>turn.status==='completed'?resolve():reject(Error(turn.error?.message||'Codex turn '+turn.status));client.turnError=reject;});
    // Install the completion listener first: short turns can finish before turn/start replies.
    completed.catch(()=>{});
    await client.request('turn/start',{threadId:conversation.threadId,input:[{type:'text',text:prompt},...(images||[]).map(url=>({type:'image',url}))]});
    await completed;
  }finally{unsubscribe?.();await updates;await client.close();await mcp.close();}
}
async function runClaude({settings,directory,event,tools,call,system,prompt,images,conversation,signal,awareness}) {
  await fs.mkdir(directory,{recursive:true});const mcp=await startMcpServer({tools,call,awareness});
  const runDirectory=await fs.mkdtemp(path.join(directory,'claude-run-'));
  let child;
  try {
    const config=path.join(runDirectory,'mcp.json'),instructions=path.join(runDirectory,'instructions.txt');
    await fs.writeFile(config,JSON.stringify(mcp.config),{mode:0o600});await fs.writeFile(instructions,system);
    const args=['-p','--input-format','stream-json','--output-format','stream-json','--verbose','--include-partial-messages','--tools','','--allowedTools','mcp__mdlxl__*','--strict-mcp-config','--mcp-config',config,'--setting-sources','','--system-prompt-file',instructions];
    if(settings.model)args.push('--model',settings.model);if(conversation.threadId)args.push('--resume',conversation.threadId);
    const env=providerEnvironment(directory,'claude');
    await fs.mkdir(env.TEMP,{recursive:true});await fs.mkdir(env.CLAUDE_CONFIG_DIR,{recursive:true});
    child=spawnAgent(settings.executable||'claude',args,{cwd:directory,env});
    let finalResult=null,streamed=false;const abort=()=>stopAgent(child);signal.addEventListener('abort',abort,{once:true});
    try {
      await new Promise((resolve,reject)=>{
        child.on('error',reject);child.once('close',code=>signal.aborted?reject(Error('AI request cancelled.')):!finalResult||finalResult.is_error||code!==0?reject(Error(finalResult?.result||finalResult?.errors?.join('\n')||'Claude ended without a completed result.')):resolve());
        child.stdin.on('error',reject);
        lines(child.stdout,line=>{let data;try{data=JSON.parse(line);}catch{return;}
          if(data.session_id)conversation.threadId=data.session_id;
          if(data.type==='stream_event'&&data.event?.type==='content_block_delta'&&data.event.delta?.text){streamed=true;event({type:'text',text:data.event.delta.text});}
          if(data.type==='assistant')for(const block of data.message?.content||[])if(block.type==='tool_use')event({type:'tool',name:block.name});
          if(data.type==='result'){finalResult=data;if(!streamed&&data.result)event({type:'text',text:data.result});}
        },reject);
        child.stderr.on('data',()=>{});
        if(signal.aborted){abort();return;}
        child.stdin.end(JSON.stringify({type:'user',message:{role:'user',content:[{type:'text',text:prompt},...imageParts(images,'anthropic')]}})+'\n');
      });
    }finally{signal.removeEventListener('abort',abort);}
  }finally{stopAgent(child);await mcp.close();await fs.rm(runDirectory,{recursive:true,force:true});}
}
async function providerModels(settings,key,signal) {
  if(settings.provider==='codex'||settings.provider==='claude')return [];
  const anthropic=settings.provider==='anthropic',base=endpoint(settings.baseUrl||(anthropic?'https://api.anthropic.com/v1':'https://api.openai.com/v1'));
  const response=await requestJson(base+'/models',null,key,signal,anthropic?{'anthropic-version':'2023-06-01'}:{});const data=await response.json();
  return (data.data||data.models||[]).map(item=>({id:item.id||item.name,name:item.display_name||item.id||item.name}));
}
module.exports={endpoint,sseEvents,runApi,runCodex,runClaude,providerModels,CodexProcess,authenticationRequired};
