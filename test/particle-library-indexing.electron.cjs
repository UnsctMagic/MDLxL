// Packaged regression with a disposable copy of a real, incomplete Warcraft index.
// Set MDLXL_REAL_PROFILE and MDLXL_ELECTRON_PATH; optional MDLXL_REAL_MODEL / MDLXL_REAL_RECIPE.
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {ParticleLibrary}=require('../electron/particle-library.cjs');
(async()=>{
 const source=process.env.MDLXL_REAL_PROFILE,executablePath=process.env.MDLXL_ELECTRON_PATH;
 assert.ok(source&&executablePath,'Provide a real profile and packaged executable for the indexing regression');
 const out=path.resolve(process.env.MDLXL_REAL_TEST_OUT||'out/particle-library-indexing'),profile=path.join(out,'profile'),directory=path.join(profile,'particles');
 await fs.mkdir(profile,{recursive:true});await fs.cp(path.join(source,'particles'),directory,{recursive:true,preserveTimestamps:true});
 const settings=JSON.parse(await fs.readFile(path.join(source,'settings.json')));settings.preferences={...settings.preferences,checkUpdatesOnStartup:false};await fs.writeFile(path.join(profile,'settings.json'),JSON.stringify(settings));
 // File copies can round timestamp precision; retain the copied PNGs under their copied revisions.
 const store=new ParticleLibrary({directory,discover:async()=>({cascFolders:[]})}),thumbRoot=path.join(directory,'thumbnails','native-4.0.1-authoring-5');
 for(const file of await fs.readdir(thumbRoot)){if(!file.endsWith('.json'))continue;const entry=JSON.parse(await fs.readFile(path.join(thumbRoot,file)));entry.revision=await store.thumbnailRevision(file.slice(0,-5));await fs.writeFile(path.join(thumbRoot,file),JSON.stringify(entry));}
 const current=JSON.parse(await fs.readFile(path.join(directory,'current.json'))),manifestFile=path.join(directory,current.sourceKey,'manifest.json');
 assert.equal(JSON.parse(await fs.readFile(manifestFile)).extractionComplete,false,'The fixture must resume an incomplete index');
 let app,mainPid;const errors=[],samples=[],returns=[],started=Date.now();
 try{
  app=await _electron.launch({executablePath,args:['--disable-backgrounding-occluded-windows',...[process.env.MDLXL_REAL_MODEL].filter(Boolean)],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile},timeout:60000});
  app.process().stdout?.on('data',data=>fs.appendFile(path.join(out,'main.log'),data));app.process().stderr?.on('data',data=>fs.appendFile(path.join(out,'main.log'),data));
  mainPid=await app.evaluate(()=>process.pid);const page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setSize(1500,1000);w.setPosition(-3000,0);w.showInactive();});
  await page.getByRole('button',{name:'Emitter Editor',exact:true}).click();await page.locator('.pe-library').waitFor();
  const expand=async()=>{for(let n=0;n<3;n++)await page.getByRole('button',{name:'Show more',exact:true}).click();};
  await expand();
  const find=()=>page.evaluate(requested=>{
   let f=document.querySelector('.pe-library');f=f[Object.keys(f).find(k=>k.startsWith('__reactFiber'))];
   for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const value=h.memoizedState;if(value?.items?.length){
    const items=[...value.items].sort((a,b)=>Number(!!a.blocked)-Number(!!b.blocked)||Number(['reviewed','user-reviewed'].includes(b.naming?.state))-Number(['reviewed','user-reviewed'].includes(a.naming?.state))).filter(i=>i.collection==='Warcraft');
    return {index:items.findIndex(i=>requested?i.id===requested:!i.blocked&&!i.unsupported?.length),status:value.status};
   }}throw Error('Library state unavailable');
  },process.env.MDLXL_REAL_RECIPE);
  for(let n=0;n<10;n++){
   const found=await find();assert.ok(found.index>=0&&found.index<144,'The chosen effect must be visible in the fixture');
   await page.locator('.pe-effect-card').nth(found.index).click();await page.locator('.pe-library').waitFor({state:'hidden'});await page.waitForTimeout(1000);
   const begin=Date.now();await page.getByRole('dialog',{name:'Particle Editor',exact:true}).getByRole('button',{name:'Library',exact:true}).click();await expand();returns.push(Date.now()-begin);
   assert.ok(returns.at(-1)<3000,'Returning to the library must remain responsive during indexing');await page.waitForTimeout(1000);
   samples.push(await app.evaluate(({app})=>app.getAppMetrics().map(m=>({type:m.type,name:m.name,cpu:m.cpu.percentCPUUsage,workingSetKB:m.memory.workingSetSize}))));
  }
  assert.ok(samples.flat().some(m=>m.type==='Utility'&&m.name==='Warcraft asset indexing'),'Indexing must run in its separate process');
  let manifest;
  for(let n=0;n<90;n++){manifest=JSON.parse(await fs.readFile(manifestFile));if(manifest.extractionComplete)break;const status=(await find()).status;if(n%10===0)console.log(JSON.stringify({phase:'index-progress',processed:manifest.processed.length,status}));if(status.error)throw Error(status.error);await page.waitForTimeout(1000);}
  assert.equal(manifest.extractionComplete,true,'The automatic scan must finish');assert.equal(manifest.processed.length,manifest.candidateAssets);
  await page.waitForFunction(()=>[...document.querySelectorAll('.pe-effect-card')].every(card=>card.querySelector('img')||card.querySelector('small')),null,{timeout:60000});
  assert.ok(await page.locator('.pe-effect-thumb img').count()>36,'Previews beyond the initial page must load');
  assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,'library.png')});
  const result={passed:true,ms:Date.now()-started,processed:manifest.processed.length,recipes:manifest.recipeCount,previews:await page.locator('.pe-effect-thumb img').count(),returns,samples};await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{
  // Playwright's launcher can exit before the app's scan finishes. Reap this test tree explicitly.
  if(mainPid)try{require('node:child_process').execFileSync('taskkill',['/PID',String(mainPid),'/T','/F'],{windowsHide:true,stdio:'pipe'});}catch{}
  app?.process().kill();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
