import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {AI_TOOLS} from '../src/ai-tools.js';
const require=createRequire(import.meta.url);
const {AiAwareness,CONTEXT_URI}=require('../electron/ai-awareness.cjs');
const {startMcpServer,toolContent}=require('../electron/ai-mcp.cjs');

test('continuous awareness is opt-in, forgets its snapshot on disable, and stops publishing',()=>{
  const feed=new AiAwareness(),events=[];const remove=feed.subscribe(value=>events.push(value));
  feed.update({selection:{0:[1]}});assert.equal(events.length,0);assert.equal(feed.snapshot().context,null);
  feed.setEnabled(true);feed.update({selection:{0:[1,2]}});assert.deepEqual(events.at(-1).context.selection,{0:[1,2]});
  feed.setEnabled(false);const count=events.length;feed.update({selection:{0:[3]}});assert.equal(events.length,count);assert.equal(feed.snapshot().context,null);
  remove();feed.setEnabled(true);assert.equal(events.length,count);
});
test('MCP clients receive live resource updates only for their authenticated subscription',async t=>{
  const awareness=new AiAwareness(),server=await startMcpServer({tools:AI_TOOLS,call:()=>({}),awareness});t.after(()=>server.close());
  const headers={Authorization:'Bearer '+server.token,'content-type':'application/json'};
  const rpc=async(method,params={})=>fetch(server.url,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const initialized=await rpc('initialize',{protocolVersion:'2025-11-25'});headers['Mcp-Session-Id']=initialized.headers.get('mcp-session-id');
  assert.equal((await initialized.json()).result.capabilities.resources.subscribe,true);
  assert.equal((await fetch(server.url,{headers:{Accept:'text/event-stream'}})).status,401);
  assert.equal((await (await rpc('resources/read',{uri:CONTEXT_URI})).json()).result.contents[0].text.includes('"enabled":false'),true);
  const abort=new AbortController();t.after(()=>abort.abort());
  const response=await fetch(server.url,{headers:{...headers,Accept:'text/event-stream'},signal:abort.signal}),reader=response.body.getReader();
  await reader.read();await (await rpc('resources/subscribe',{uri:CONTEXT_URI})).json();
  awareness.setEnabled(true);awareness.update({revision:3,selection:{0:[4,5]},frame:500});
  const event=new TextDecoder().decode((await reader.read()).value);assert.match(event,/notifications\/resources\/updated/);
  const resource=(await (await rpc('resources/read',{uri:CONTEXT_URI})).json()).result.contents[0];assert.deepEqual(JSON.parse(resource.text).context.selection,{0:[4,5]});
  awareness.setEnabled(false);assert.equal(JSON.parse((await (await rpc('resources/read',{uri:CONTEXT_URI})).json()).result.contents[0].text).context,null);
  await (await rpc('resources/unsubscribe',{uri:CONTEXT_URI})).json();abort.abort();
});
test('verification reports keep measured checks alongside real image content',()=>{
  const result=toolContent({review:{passed:false,checks:[{name:'height',passed:false}]},images:[{label:'before',image:'data:image/png;base64,YQ=='},{label:'after',image:'data:image/png;base64,Yg=='}]});
  assert.equal(JSON.parse(result[0].text).review.passed,false);assert.deepEqual(result.filter(x=>x.type==='image').map(x=>x.data),['YQ==','Yg==']);
});
