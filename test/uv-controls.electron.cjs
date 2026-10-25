// Run against the rebuilt bundle: node test/uv-controls.electron.cjs
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx');
const profile = path.join(root, 'out', `uv-controls-profile-${Date.now()}`);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const freePort = () => new Promise(resolve => { const s=net.createServer(); s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));}); });
const getJson = (port, route) => new Promise((resolve,reject) => http.get(`http://127.0.0.1:${port}${route}`,response=>{let data='';response.on('data',chunk=>data+=chunk);response.on('end',()=>{try{resolve(JSON.parse(data));}catch(error){reject(error);}});}).on('error',reject));
async function target(port,match) { for(let i=0;i<150;i++){try{const item=(await getJson(port,'/json')).find(match);if(item)return item;}catch{}await delay(100);}const seen=(await getJson(port,'/json')).map(item=>({type:item.type,title:item.title,url:item.url}));throw Error('Electron target unavailable: '+JSON.stringify(seen)); }
async function connect(url) {
  const socket=new WebSocket(url),pending=new Map();let sequence=0;
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(!message.id||!pending.has(message.id))return;const {resolve,reject}=pending.get(message.id);pending.delete(message.id);message.error?reject(Error(message.error.message)):resolve(message.result);});
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  return {send(method,params={}){const id=++sequence;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});},close(){socket.close();}};
}
async function evaluate(cdp,expression){const result=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
async function waitFor(cdp,expression){for(let i=0;i<150;i++){const value=await evaluate(cdp,expression);if(value)return value;await delay(100);}throw Error('Timed out: '+expression);}
async function click(cdp,selector){return evaluate(cdp,`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)throw Error('Missing '+${JSON.stringify(selector)}); e.click(); return true; })()`);}
async function chord(cdp,key,code,virtualKey){const data={key,code,windowsVirtualKeyCode:virtualKey,nativeVirtualKeyCode:virtualKey,modifiers:2};await cdp.send('Input.dispatchKeyEvent',{...data,type:'rawKeyDown'});await cdp.send('Input.dispatchKeyEvent',{...data,type:'keyUp'});}
(async()=>{
  const original=fs.readFileSync(fixture),port=await freePort();
  const electron=spawn(path.join(root,'node_modules/electron/dist/electron.exe'),['--disable-gpu',`--remote-debugging-port=${port}`,root,fixture],{cwd:root,env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile},stdio:'ignore'});
  let main,uv;
  try{
    main=await connect((await target(port,item=>item.type==='page'&&item.url.includes('/dist/index.html'))).webSocketDebuggerUrl);
    await waitFor(main,`!!document.querySelector('[aria-label="Select geoset 3"]')`);
    await click(main,'[data-hotkey="geosetsClear"]');
    await click(main,'[aria-label="Select geoset 3"]');
    await waitFor(main,`!!document.querySelector('[aria-label="3D model viewport"]')`);
    await evaluate(main,`document.querySelector('[aria-label="3D model viewport"]').focus()`);
    await chord(main,'a','KeyA',65);
    await waitFor(main,`!document.querySelector('[data-hotkey="uv"]').disabled`);
    await click(main,'[data-hotkey="uv"]');
    uv=main; // the UV Wrapper is an in-app dialog of the main window since f7316110
    await waitFor(uv,`!!document.querySelector('.uv-tab-window .uv-preview-footer [aria-label="Selected Only"]')`);
    await waitFor(uv,`!!document.querySelector('.uv-tab-window .game-preview-root')`);
    const buttons=await evaluate(uv,`[...document.querySelectorAll('.uv-tab-window .uv-preview-footer>button,.uv-tab-window .uv-preview-footer>*>button[aria-label="Live Select"]')].map(e=>e.textContent.trim())`);
    assert.deepEqual(buttons,['Live Select','Selected Only','Hide RGB']); // Select New was removed in 3e35aca8; Live Select sits in a group with its options arrow
    const state=`(() => { const e=document.querySelector('.uv-tab-window .game-preview-root'); let f=e[Object.keys(e).find(k=>k.startsWith('__reactFiber'))],top=f; while(top.return)top=top.return; if(top.stateNode.current!==top)f=f.alternate||f; for(;f;f=f.return)if(f.memoizedProps?.uvOnlySelected!==undefined){const p=f.memoizedProps;return {only:p.uvOnlySelected,hidden:p.hiddenGeosets?[...p.hiddenGeosets]:null,rgb:p.hideRgbGeoset,model:p.model.GeosetAnims[3]?.Color};}throw Error('Preview props unavailable'); })()`;
    const before=await evaluate(uv,state);
    assert.equal(before.only,false);assert.equal(before.hidden,null);assert.equal(before.rgb,null);
    await click(uv,'.uv-tab-window [aria-label="Selected Only"]');
    const isolated=await waitFor(uv,`(${state}).only && (${state}).hidden?.length===47 && !(${state}).hidden.includes(3)`);
    assert.equal(isolated,true);
    await click(uv,'.uv-tab-window .uv-preview-footer>button:last-child');
    assert.equal(await waitFor(uv,`(${state}).rgb===3`),true);
    await click(uv,'.uv-tab-window [aria-label="Selected Only"]');
    assert.equal(await waitFor(uv,`!(${state}).only && (${state}).hidden===null && (${state}).rgb===3`),true);
    await click(uv,'.uv-tab-window .uv-preview-footer>button:last-child');
    assert.equal(await waitFor(uv,`(${state}).rgb===null`),true);
    const after=await evaluate(uv,state);
    assert.deepEqual(after.model,before.model);
    assert.ok(fs.readFileSync(fixture).equals(original));
    console.log('PASS hidden Electron UV: controls, selected-only isolation, per-geoset RGB toggle independent of visibility, original model unchanged');
  }finally{main?.close();electron.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
