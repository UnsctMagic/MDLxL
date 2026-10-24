const http=require('node:http');
const crypto=require('node:crypto');

function validateArguments(schema,value,path='arguments') {
  if(schema.enum&&!schema.enum.includes(value))throw Error(path+' has an unsupported value.');
  if(schema.type) {
    const accepted=Array.isArray(schema.type)?schema.type:[schema.type];
    const actual=value===null?'null':Array.isArray(value)?'array':typeof value;
    if(!accepted.includes(actual)&&!(accepted.includes('integer')&&Number.isSafeInteger(value)))throw Error(path+' has the wrong type.');
  }
  if(typeof value==='number'&&(!Number.isFinite(value)||schema.minimum!==undefined&&value<schema.minimum||schema.maximum!==undefined&&value>schema.maximum))throw Error(path+' is out of range.');
  if(Array.isArray(value)) {
    if(schema.minItems!==undefined&&value.length<schema.minItems||schema.maxItems!==undefined&&value.length>schema.maxItems)throw Error(path+' has the wrong number of items.');
    if(schema.items)value.forEach((v,i)=>validateArguments(schema.items,v,path+'['+i+']'));
  } else if(value&&typeof value==='object') {
    for(const key of schema.required||[])if(!Object.hasOwn(value,key))throw Error(path+'.'+key+' is required.');
    for(const [key,child] of Object.entries(value)) {
      if(['__proto__','constructor','prototype'].includes(key))throw Error('Unsafe argument name.');
      const sub=schema.properties?.[key];
      if(sub)validateArguments(sub,child,path+'.'+key);
      else if(schema.additionalProperties===false)throw Error('Unknown argument: '+key);
      else if(schema.additionalProperties&&typeof schema.additionalProperties==='object')validateArguments(schema.additionalProperties,child,path+'.'+key);
    }
  }
}
function toolContent(value) {
  if(value?.images){
    if(!Array.isArray(value.images)||!value.images.length||value.images.length>12)throw Error('Invalid viewport capture batch.');
    return value.images.flatMap((item,index)=>[{type:'text',text:`Image ${index+1}: ${String(item.label||'Viewport')}`},...toolContent({image:item.image})]);
  }
  if(value?.image) {
    const match=/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s.exec(value.image);
    if(!match)throw Error('Invalid viewport capture.');
    return [{type:'image',mimeType:match[1],data:match[2]}];
  }
  return [{type:'text',text:JSON.stringify(value??null)}];
}
async function callEditorTool(tools,call,name,args,signal) {
  const tool=tools.find(t=>t.name===name);if(!tool)throw Error('Unknown tool: '+name);
  validateArguments(tool.inputSchema,args);
  if(signal?.aborted)throw Error('Request cancelled.');
  try {return {content:toolContent(await call(name,args,signal))};}
  catch(error){return {isError:true,content:[{type:'text',text:String(error.message||error)}]};}
}
async function startMcpServer({tools,call,port=0,token=crypto.randomBytes(32).toString('hex'),name='MDLxL',onCall=()=>{}}) {
  const controllers=new Set();let actualPort;
  const server=http.createServer(async(req,res)=>{
    const send=(status,value)=>{if(res.destroyed||res.writableEnded)return;res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(value===undefined?'':JSON.stringify(value));};
    if(req.headers.origin||![`127.0.0.1:${actualPort}`,`localhost:${actualPort}`].includes(req.headers.host))return send(403,{error:'Local clients only.'});
    const bearer=Buffer.from(req.headers.authorization||''), expected=Buffer.from('Bearer '+token);
    if(bearer.length!==expected.length||!crypto.timingSafeEqual(bearer,expected))return send(401,{error:'Invalid connection token.'});
    if(req.url!=='/mcp')return send(404,{error:'Not found.'});
    if(req.method==='DELETE')return send(200,{});
    if(req.method!=='POST')return send(405,{error:'Use MCP Streamable HTTP POST.'});
    if(!req.headers['content-type']?.includes('application/json'))return send(415,{error:'Use application/json.'});
    const controller=new AbortController();controllers.add(controller);res.on('close',()=>{if(!res.writableEnded)controller.abort();});
    let message;
    try {
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>20*1024*1024){send(413,{error:'Request too large.'});return;}chunks.push(chunk);}
      try{message=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,{jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON.'}});}
      if(Array.isArray(message)||!message||message.jsonrpc!=='2.0'||typeof message.method!=='string')return send(400,{jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid JSON-RPC request.'}});
      if(message.id===undefined)return send(202);
      const params=message.params||{};let result;
      switch(message.method) {
        case 'initialize': result={protocolVersion:['2025-03-26','2025-06-18','2025-11-25'].includes(params.protocolVersion)?params.protocolVersion:'2025-11-25',capabilities:{tools:{listChanged:false}},serverInfo:{name,version:'1.0.0'},instructions:'Control the live MDLxL editor. Start with mdlxl_context. Preserve unrelated model data and use the captured target token for every action.'};break;
        case 'ping':result={};break;
        case 'tools/list':result={tools};break;
        case 'tools/call':onCall(params.name);result=await callEditorTool(tools,call,params.name,params.arguments||{},controller.signal);break;
        default:return send(200,{jsonrpc:'2.0',id:message.id,error:{code:-32601,message:'Method not found.'}});
      }
      send(200,{jsonrpc:'2.0',id:message.id,result});
    }catch(error){send(200,{jsonrpc:'2.0',id:message?.id??null,error:{code:-32602,message:String(error.message||error)}});}
    finally{controllers.delete(controller);}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});actualPort=server.address().port;
  const url=`http://127.0.0.1:${actualPort}/mcp`;
  return {url,port:actualPort,token,toolNames:tools.map(tool=>tool.name),config:{mcpServers:{mdlxl:{type:'http',url,headers:{Authorization:'Bearer '+token}}}},close:async()=>{for(const c of controllers)c.abort();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
module.exports={startMcpServer,callEditorTool,toolContent,validateArguments};
