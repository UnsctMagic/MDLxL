const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launchApp,closeApp,bundleHashes}=require('./helpers/app.cjs');
const {fixturePath,gameFolder}=require('./helpers/fixtures.cjs');
(async()=>{
 const out=path.resolve('out/library-textures-review'),checks=[];
 fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
 const options={out,show:'hide',fixture:fixturePath('citadel-footman'),settings:{preferences:{checkUpdatesOnStartup:false,graphics:{pauseWhenHidden:false}}},env:{MDLVIS_GAME_DATA:await gameFolder()},args:['--disable-gpu-vsync','--disable-frame-rate-limit'],bounds:{x:-3000,y:0,width:1440,height:980},pageTimeout:45000};
 const setup=await launchApp(options);
 const {click,type}=require('./helpers/library-browser.cjs');
 try{
  await click(setup.page,setup.page.locator('[data-hotkey="textureLibrary"]'));
  const worldEditor=setup.page.getByRole('button',{name:'World Editor Style',exact:true});
  await click(setup.page,worldEditor);
  assert.equal(await worldEditor.getAttribute('aria-pressed'),'true');
  await click(setup.page,setup.page.getByRole('button',{name:'Close texture library',exact:true}));
 }finally{await closeApp(setup.app,{keepProfile:true});}
 // Cold renderer, with the World Editor layout explicitly chosen in the profile.
 const {app,page}=await launchApp({...options,profile:setup.profile});
 const searchWorkers=[];page.on('worker',worker=>{if(worker.url().includes('texture-library-worker'))searchWorkers.push(worker.url());});
  const capture=async name=>{const png=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(png,'base64'));};
 try{
  // Observe IPC, and hold only the real catalogue reply to exercise a naturally
  // selectable tree while texture matching data is still on its way.
  await app.evaluate(({ipcMain})=>{
   let release,start;const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>start=resolve);
   global.__libraryReview={preview:0,catalog:0,release,started};
   for(const [channel,key] of [['texture:library','catalog'],['texture:libraryPreview','preview']]){
    const handler=ipcMain._invokeHandlers.get(channel);ipcMain.removeHandler(channel);
    ipcMain.handle(channel,async(...args)=>{global.__libraryReview[key]++;if(key==='catalog')start();const data=await handler(...args);if(key==='catalog')await gate;return data;});
   }
  });
  const select=async(locator,value)=>{const index=await locator.locator('option').evaluateAll((options,value)=>options.findIndex(option=>option.value===value),value);assert.ok(index>=0);await click(page,locator);await page.keyboard.press('Home');for(let i=0;i<index;i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');};
  // Passive platform observation only; app code still owns every worker message.
  await page.evaluate(()=>{window.__libraryWorkerInits=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(data,...args){if(data?.type==='init'&&Array.isArray(data.items)&&data.signature)window.__libraryWorkerInits.push({layout:document.querySelector('.gf-style button[aria-pressed="true"]')?.textContent,signature:data.signature});return post.call(this,data,...args);};});
  await page.locator('[data-hotkey="textureLibrary"]').click();
  await page.getByRole('dialog',{name:'Warcraft III Library',exact:true}).waitFor();
  await app.evaluate(()=>global.__libraryReview.started);
  const row=name=>page.locator('.gf-row').filter({has:page.locator('.gf-name',{hasText:new RegExp('^'+name+'$')})}).first();
  await row('Human').click();await row('Units').click();await row('Normal').click();await row('Footman').click();
  const loading=await page.locator('.tl-result-status').innerText();
  const initial=await app.evaluate(()=>({preview:global.__libraryReview.preview,catalog:global.__libraryReview.catalog}));
  await capture('loading-entry');
  await app.evaluate(()=>global.__libraryReview.release());
  await page.waitForFunction(()=>document.querySelectorAll('.tl-grid button').length>0&&!document.querySelector('.tl-grid .tl-tile:not(button)'));
  await page.waitForFunction(()=>[...document.querySelectorAll('.tl-grid button')].every(tile=>tile.querySelector('img')?.naturalWidth>0));
  // Continue normal browsing before Standard so any mistakenly scheduled worker
  // indexing is observable, rather than checking before its timer has run.
  await select(page.getByLabel('Texture source',{exact:true}),'reforged');
  await row('Human').click();await row('Units').click();await row('Normal').click();await row('Footman').click();
  await page.waitForFunction(()=>document.querySelectorAll('.tl-grid button').length>3&&!document.querySelector('.tl-grid .tl-tile:not(button)'));
  await page.waitForFunction(()=>[...document.querySelectorAll('.tl-grid button')].slice(0,4).every(tile=>tile.querySelector('img')?.naturalWidth>0));
  const earlyInits=await page.evaluate(()=>window.__libraryWorkerInits);
  console.log('OBSERVED',JSON.stringify({initial,loading,earlyInits,searchWorkers:searchWorkers.length}));
  assert.equal(initial.preview,0,'A1 World Editor open must not request the Standard preview');assert.ok(initial.catalog>0,'A1 catalogue starts directly');checks.push('A1 fresh World Editor open starts catalogue directly, without Standard preview');
  assert.equal(loading,'Loading texture library…','A4 selected entry must report loading before catalogue arrival');checks.push('A4 entry selected before catalogue arrival shows Loading texture library…, never 0 textures');
  assert.deepEqual(earlyInits,[],'A2 no search-worker init while World Editor is shown');assert.equal(searchWorkers.length,0,'A2 no Standard search worker starts in World Editor');
  await select(page.getByLabel('Texture source',{exact:true}),'classic');
  const start=Date.now();await page.getByRole('button',{name:'Standard',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.tl-grid button').length>0);const standardMs=Date.now()-start;
  await type(page,page.getByRole('searchbox',{name:'Search textures'}),'painting');
  await page.waitForFunction(()=>window.__libraryWorkerInits.length===1&&document.querySelectorAll('.tl-tile').length>=20&&!/Searching/.test(document.querySelector('.tl-result-status')?.textContent||'')&&[...document.querySelectorAll('.tl-tile')].every(tile=>/loading|keyart|campaignselect|concept|scorescreen|backgrounds|victoryscreen|timeindicator|day-indicator|splash|blizzcon|homescreen|definitive|sketch/i.test(tile.title)));
  assert.ok(await page.getByLabel('Texture kind',{exact:true}).isVisible());assert.ok(await page.getByText('Vibe search',{exact:true}).isVisible());
  const inits=await page.evaluate(()=>window.__libraryWorkerInits);assert.equal(inits.length,1,'A2 worker initializes once after switching to Standard');assert.equal(inits[0].layout,'Standard');assert.equal(searchWorkers.length,1);
  checks.push(`A2 Standard results (${standardMs} ms), painting/vibe/kinds work; worker first initialized in Standard`);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checks,initial,loading,inits,standardMs,bundle:bundleHashes()},null,2));
  console.log('PASS:\n- '+checks.join('\n- '));
 }catch(error){await capture('failure').catch(()=>{});throw error;}
 finally{await app.evaluate(()=>global.__libraryReview?.release()).catch(()=>{});await closeApp(app).catch(()=>{});}
})().catch(error=>{console.error(error);process.exitCode=1;});
