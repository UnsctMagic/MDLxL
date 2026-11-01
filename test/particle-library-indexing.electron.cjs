const { launchApp, closeApp, settle } = require('./helpers/app.cjs');
// Packaged regression with a disposable copy of a real, incomplete Warcraft index.
// Set MDLXL_REAL_PROFILE; optional MDLXL_REAL_MODEL / MDLXL_REAL_RECIPE. The runner selects the app.

const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {ParticleLibrary}=require('../electron/particle-library.cjs');
(async()=>{
 const source=process.env.MDLXL_REAL_PROFILE;
 assert.ok(source,'Provide a real profile for the indexing regression');
 const out=path.resolve(process.env.MDLXL_REAL_TEST_OUT||'out/particle-library-indexing'),profile=path.join(out,'profile'),directory=path.join(profile,'particles');
 await fs.mkdir(profile,{recursive:true});await fs.cp(path.join(source,'particles'),directory,{recursive:true,preserveTimestamps:true});
 const settings=JSON.parse(await fs.readFile(path.join(source,'settings.json')));settings.preferences={...settings.preferences,checkUpdatesOnStartup:false};await fs.writeFile(path.join(profile,'settings.json'),JSON.stringify(settings));
 // File copies can round timestamp precision; retain the copied PNGs under their copied revisions.
 const store=new ParticleLibrary({directory,discover:async()=>({cascFolders:[]})}),thumbRoot=path.join(directory,'thumbnails','native-4.0.1-authoring-5');
 for(const file of await fs.readdir(thumbRoot)){if(!file.endsWith('.json'))continue;const entry=JSON.parse(await fs.readFile(path.join(thumbRoot,file)));entry.revision=await store.thumbnailRevision(file.slice(0,-5));await fs.writeFile(path.join(thumbRoot,file),JSON.stringify(entry));}
 const current=JSON.parse(await fs.readFile(path.join(directory,'current.json'))),manifestFile=path.join(directory,current.sourceKey,'manifest.json');
 // The copy changes NTFS timestamps. Preserve a verified partial browse snapshot
 // exactly as the thumbnail revisions above preserve the copied images.
 const {browseRevision}=require('../electron/particle-review.cjs'),original=path.join(source,'particles',current.sourceKey),copied=path.dirname(manifestFile);
 const snapshot=await fs.readFile(path.join(original,'browse.json'),'utf8').then(JSON.parse,error=>{if(error.code!=='ENOENT')throw error;});
 if(snapshot?.revision===browseRevision(await fs.stat(path.join(original,'catalog.json'),{bigint:true}))){
   snapshot.revision=browseRevision(await fs.stat(path.join(copied,'catalog.json'),{bigint:true}));
   await fs.writeFile(path.join(copied,'browse.json'),JSON.stringify(snapshot));
 }
 assert.equal(JSON.parse(await fs.readFile(manifestFile)).extractionComplete,false,'The fixture must resume an incomplete index');
 let app;const errors=[],samples=[],returns=[],started=Date.now();
 try{
  const launched = await launchApp({ out, fixture: process.env.MDLXL_REAL_MODEL, profile, errors, timeout: 60000, bounds: { x: -3000, y: 0, width: 1500, height: 1000 }, show: 'inactive', pageTimeout: 15000 }); app = launched.app;
  app.process().stdout?.on('data',data=>fs.appendFile(path.join(out,'main.log'),data));app.process().stderr?.on('data',data=>fs.appendFile(path.join(out,'main.log'),data));
  const page=launched.page;

  await page.getByRole('button',{name:'Emitter Editor',exact:true}).click();await page.locator('.pe-library').waitFor();
  await page.getByRole('button',{name:'World Editor',exact:true}).click();
  await page.getByRole('treeitem',{name:'Other effects',exact:true}).click({timeout:60000});
  assert.ok(await page.locator('.pe-effect-card').count()>0,'Partial origin links are browsable');
  assert.match(await page.locator('.pe-library').innerText(),/Indexing/);
  await page.getByRole('button',{name:'By type',exact:true}).click();
  // Hidden Chromium delays Playwright's mouse-stability frames by ~2 s per click.
  // Time the app handlers and wait for every newly visible page of cards.
  const expand=async()=>{
   await page.locator('.pe-effect-card').nth(35).waitFor({state:'visible'});
   for(let n=2;n<=4;n++){
    await page.getByRole('button',{name:'Show more',exact:true}).dispatchEvent('click');
    await page.locator('.pe-effect-card').nth(36*n-1).waitFor({state:'visible'});
   }
  };
  await expand();
  const find=()=>page.evaluate(requested=>{
   let f=document.querySelector('.pe-library');
   { const value = findFiberState(f, value => value?.items?.length); if (value) {
    const items=[...value.items].sort((a,b)=>Number(!!a.blocked)-Number(!!b.blocked)||Number(['reviewed','user-reviewed'].includes(b.naming?.state))-Number(['reviewed','user-reviewed'].includes(a.naming?.state))).filter(i=>i.collection==='Warcraft');
    const index=items.findIndex(i=>requested?i.id===requested:!i.blocked&&!i.unsupported?.length);return {index,id:items[index]?.id,status:value.status};
   } }throw Error('Library state unavailable');
  },process.env.MDLXL_REAL_RECIPE);
  for(let n=0;n<10;n++){
   const found=await find();assert.ok(found.index>=0&&found.index<144,'The chosen effect must be visible in the fixture');
   await page.locator('[data-effect-id="'+found.id+'"] .pe-effect-card').click();await page.locator('.pe-library').waitFor({state:'hidden'});await settle(page, 1000);
   const begin=Date.now();await page.getByRole('dialog',{name:'Particle Editor',exact:true}).getByRole('button',{name:'Library',exact:true}).dispatchEvent('click');await expand();returns.push(Date.now()-begin);
   console.log('Reopen and expand to 144 cards (ms)',returns.at(-1));
   assert.ok(returns.at(-1)<3000,'Returning to the library must remain responsive during indexing');await settle(page, 1000);
   samples.push(await app.evaluate(({app})=>app.getAppMetrics().map(m=>({type:m.type,name:m.name,cpu:m.cpu.percentCPUUsage,workingSetKB:m.memory.workingSetSize}))));
  }
  assert.ok(samples.flat().some(m=>m.type==='Utility'&&m.name==='Warcraft asset indexing'),'Indexing must run in its separate process');
  let manifest;
  for(let n=0;n<90;n++){manifest=JSON.parse(await fs.readFile(manifestFile));if(manifest.extractionComplete)break;const status=(await find()).status;if(n%10===0)console.log(JSON.stringify({phase:'index-progress',processed:manifest.processed.length,status}));if(status.error)throw Error(status.error);await settle(page, 1000);}
  assert.equal(manifest.extractionComplete,true,'The automatic scan must finish');assert.equal(manifest.processed.length,manifest.candidateAssets);
  await page.waitForFunction(()=>{
   const cards=[...document.querySelectorAll('.pe-effect-card')];
   return cards.length===144 && cards.every(card=>card.querySelector('img')||card.querySelector('small')) &&
     cards.filter(card=>card.querySelector('img')).length>36;
  },null,{timeout:60000}).catch(async error=>{
   console.log('Final cards',await page.locator('.pe-effect-card').count(),'pictures',await page.locator('.pe-effect-thumb img').count(),
     'labels',await page.locator('.pe-effect-card small').allTextContents());throw error;
  });
  assert.ok(await page.locator('.pe-effect-thumb img').count()>36,'Previews beyond the initial page must load');
  assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,'library.png')});
  const result={passed:true,ms:Date.now()-started,processed:manifest.processed.length,recipes:manifest.recipeCount,previews:await page.locator('.pe-effect-thumb img').count(),returns,samples};await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{if(app)await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
