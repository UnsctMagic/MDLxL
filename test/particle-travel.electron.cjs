// Existing Warcraft asset, production bundle, isolated hidden profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=process.env.MDLXL_TRAVEL_OUT||path.join(root,'out/particle-travel');
(async()=>{
fs.mkdirSync(path.join(out,'profile'),{recursive:true});
fs.writeFileSync(path.join(out,'profile/settings.json'),JSON.stringify({preferences:{graphics:{pauseWhenHidden:false},theme:'dark'}}));
const exe=process.env.MDLXL_ELECTRON_PATH||path.join(root,'node_modules/electron/dist/electron.exe');
const app=await _electron.launch({executablePath:exe,args:[...(process.env.MDLXL_ELECTRON_PATH?[]:[root]),'--disable-renderer-backgrounding','--disable-background-timer-throttling'],env:{...process.env,MDLXL_PROFILE:path.join(out,'profile'),MDLVIS_HEADLESS:'1',MDLVIS_GAME_DATA:process.env.MDLVIS_GAME_DATA||'D:/Warcraft III'},timeout:60000});
const checks=[];
try{
const page=await app.firstWindow();page.setDefaultTimeout(25000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setSize(1360,900);w.webContents.setBackgroundThrottling(false);});
const capture=async(name)=>{const r=await app.evaluate(async({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return {visible:w.isVisible(),data:(await w.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64')};});assert.equal(r.visible,false);if(name)fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));};
const pump=async(count=8)=>{for(let i=0;i<count;i++){await page.waitForTimeout(100);await capture();}};
await page.evaluate(()=>{window.getTravelRuntime=()=>{const host=[...document.querySelectorAll('.game-preview-root')].find(e=>e.getBoundingClientRect().width>0);for(let f=host?.[Object.keys(host).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const r=h.memoizedState?.current;if(r?.native&&r?.controls)return r;}throw Error('Preview not ready');};});
const observe=async()=>{await capture();await page.evaluate(()=>{const n=getTravelRuntime().native,c=n.particlesController;window.travelSamples=[];if(c.travelProbe)return;c.travelProbe=true;const update=c.updateParticle;c.updateParticle=function(p,dt){const x=p.pos[0],vx=p.speed[0],speed=Number(n.model.Sequences[n.getSequence()]?.MoveSpeed)||0;const result=update.call(this,p,dt);if(dt>0&&p.lifeSpan>0&&!(p.emitter.props.Flags&524288)&&travelSamples.length<20000)travelSamples.push({actual:p.pos[0]-x-vx*dt/1000,expected:-speed*dt/1000,speed,dt});return result;};});};
const checkTrail=async(label,moving)=>{await observe();await pump();const samples=await page.evaluate(()=>travelSamples);assert(samples.length>10,label+': live particles');if(moving)assert(samples.some(s=>s.speed>0),label+': authored MoveSpeed');else assert(samples.every(s=>s.speed===0),label+': stationary sequence');assert(samples.every(s=>Math.abs(s.actual-s.expected)<.004),label+': particle travel matches MoveSpeed');checks.push(label);console.log('PASS',label,samples.length);};
const play=async()=>{const b=page.getByRole('button',{name:'Play',exact:true});if(await b.count())await b.dispatchEvent('click');};
await page.locator('[data-hotkey="textureLibrary"]').dispatchEvent('click');await page.getByRole('tab',{name:'Models',exact:true}).dispatchEvent('click');await page.getByLabel('Game version',{exact:true}).selectOption('classic');await page.getByRole('searchbox',{name:'Search game files'}).fill('firelord');
await page.locator('.gf-row').filter({has:page.locator('.gf-name',{hasText:/^Firelord/})}).first().dispatchEvent('click');
const librarySequence=page.getByLabel('Model animation',{exact:true});await librarySequence.waitFor();
const options=await librarySequence.locator('option').evaluateAll(items=>items.map(i=>({value:i.value,name:i.textContent})));const walk=options.find(i=>/^Walk/.test(i.name)),stand=options.find(i=>/^Stand$/.test(i.name));assert(walk&&stand);
await librarySequence.selectOption(walk.value);await play();await checkTrail('Library Walk',true);
await librarySequence.selectOption(stand.value);await play();await checkTrail('Library Stand',false);
await page.getByRole('button',{name:'Open in editor',exact:true}).dispatchEvent('click');
let documentBefore;
for(const [name,tab,select]of [['Movement','animation','Movement current sequence'],['Animations','animations','Choose animation sequence']]){
 await page.locator(`[data-hotkey="${tab}"]`).first().dispatchEvent('click');await page.getByLabel(select,{exact:true}).selectOption({label:'Walk'});
 await page.getByLabel('View direction',{exact:true}).selectOption('perspective');
 if(name==='Movement')await page.getByLabel('Movement bone or node').selectOption('');
 const emitters=page.getByRole('checkbox',{name:'Emitters',exact:true});if(!await emitters.isChecked())await emitters.evaluate(e=>e.click());
 await play();await checkTrail(name+' Walk',true);
 if(!documentBefore)documentBefore=await page.evaluate(()=>{const host=document.querySelector('.game-preview-root');for(let f=host?.[Object.keys(host).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next)if(h.memoizedState?.doc?.model&&h.memoizedState.assets)return JSON.stringify(h.memoizedState.doc.model);throw Error('Editing document missing');});
 await page.getByRole('button',{name:'Stop',exact:true}).dispatchEvent('click');await capture();await page.evaluate(()=>travelSamples=[]);await pump(3);assert.equal((await page.evaluate(()=>travelSamples)).length,0,name+' pause does not drift');
 // Movement's Work mode owns unmodified drags; Alt is its existing camera gesture.
 const before=await page.evaluate(()=>getTravelRuntime().controls.object.position.toArray()),box=await page.locator('[data-clean-model-canvas]').boundingBox();await page.keyboard.down('Alt');await page.mouse.move(box.x+40,box.y+70);await page.mouse.down();await page.mouse.move(box.x+115,box.y+85,{steps:10});await page.mouse.up();await page.keyboard.up('Alt');await capture();assert.notDeepEqual(await page.evaluate(()=>getTravelRuntime().controls.object.position.toArray()),before,name+' mouse rotation');
 await page.getByLabel(select,{exact:true}).selectOption({label:'Stand'});await play();await checkTrail(name+' Stand',false);
}
const after=await page.evaluate(()=>{const host=document.querySelector('.game-preview-root');for(let f=host?.[Object.keys(host).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next)if(h.memoizedState?.doc?.model&&h.memoizedState.assets)return JSON.stringify(h.memoizedState.doc.model);});assert.equal(after,documentBefore);
assert(!/treadmill/i.test(await page.locator('body').innerText()));assert.deepEqual(errors,[]);
await capture('animations-particles');fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checks,paused:true,mouseRotation:true,documentUnchanged:true,noTreadmill:true,hidden:true,errors},null,2));
}finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
