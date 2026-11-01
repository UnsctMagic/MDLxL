const { launchApp, closeApp } = require('./helpers/app.cjs');
// Packaged regression with a disposable copy of a real, incomplete Warcraft index.
// Set MDLXL_REAL_PROFILE; optional MDLXL_REAL_MODEL / MDLXL_REAL_RECIPE. The runner selects the app.

const {click,type}=require('./helpers/library-browser.cjs');
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
 // The owner may already have completed the index. Make only this disposable
 // manifest partial; the recipe bytes and cached World Editor links stay intact.
 const partial=JSON.parse(await fs.readFile(manifestFile));
 partial.processed=partial.processed.slice(0,Math.floor(partial.processed.length/2));partial.extractionComplete=false;
 await fs.writeFile(manifestFile,JSON.stringify(partial));
 // A cancelled resume must leave the saved partial catalogue and its links on
 // the same revision, including when copying this fixture rounded its timestamps.
 const {scanParticleLibrary}=await import('../electron/particle-library-worker.mjs');
 await scanParticleLibrary({folder:current.folder,directory,shouldCancel:()=>true});
 const {browseRevision}=require('../electron/particle-review.cjs'),copied=path.dirname(manifestFile);
 const snapshot=JSON.parse(await fs.readFile(path.join(copied,'browse.json')));
 assert.ok(snapshot.objects.length);assert.equal(snapshot.revision,browseRevision(await fs.stat(path.join(copied,'catalog.json'),{bigint:true})));
 assert.equal(JSON.parse(await fs.readFile(manifestFile)).extractionComplete,false,'The fixture must resume an incomplete index');
 let app;const errors=[],samples=[],returns=[],started=Date.now();
 try{
  const launched = await launchApp({ out, fixture: process.env.MDLXL_REAL_MODEL, profile, errors, timeout: 60000, bounds: { x: -3000, y: 0, width: 1500, height: 1000 }, show: 'inactive', pageTimeout: 15000 }); app = launched.app;
  app.process().stdout?.on('data',data=>fs.appendFile(path.join(out,'main.log'),data));app.process().stderr?.on('data',data=>fs.appendFile(path.join(out,'main.log'),data));
  const page=launched.page;

  const library=page.locator('.pe-library'),button=name=>page.getByRole('button',{name,exact:true}),row=name=>library.getByRole('treeitem',{name,exact:true});
  await click(page,button('Emitter Editor'));await library.waitFor();
  assert.equal(await library.locator('.gf-tree').count(),1,'Scanning uses the shared Library browser');
  await button('Cancel scan').waitFor({timeout:60000});
  const metrics=await app.evaluate(({app})=>app.getAppMetrics().map(m=>({type:m.type,name:m.name})));assert.ok(metrics.some(m=>m.type==='Utility'&&m.name==='Warcraft asset indexing'));
  await click(page,button('Cancel scan'));await button('Index Warcraft assets').waitFor();
  const cancelled=JSON.parse(await fs.readFile(path.join(copied,'browse.json')));assert.ok(cancelled.objects.length,'Cancel retains World Editor links');
  await click(page,button('World Editor Style'));await click(page,row('Other effects'));assert.ok(await library.locator('[data-effect-id]').count()>0,'Partial effects remain browsable');
  await click(page,button('Index Warcraft assets'));await button('Cancel scan').waitFor();
  await click(page,button('Standard'));await click(page,row('Fire'));
  for(let n=0;n<10;n++){
    const effect=library.locator('[data-effect-id]').first();await effect.waitFor();await click(page,effect,{clickCount:2});await library.waitFor({state:'hidden'});
    const begin=Date.now();await click(page,page.getByRole('dialog',{name:'Particle Editor',exact:true}).getByRole('button',{name:'Library',exact:true}));await click(page,row('Fire'));await library.locator('[data-effect-id]').first().waitFor();returns.push(Date.now()-begin);
    assert.ok(returns.at(-1)<3000,'Returning to the library remains responsive during indexing');
    samples.push(await app.evaluate(({app})=>app.getAppMetrics().map(m=>({type:m.type,name:m.name,cpu:m.cpu.percentCPUUsage,workingSetKB:m.memory.workingSetSize}))));
  }
  await button('Index Warcraft assets').waitFor({timeout:90000});
  const manifest=JSON.parse(await fs.readFile(manifestFile));assert.equal(manifest.extractionComplete,true,'The resumed scan finishes');assert.equal(manifest.processed.length,manifest.candidateAssets);
  await click(page,button('World Editor Style'));await click(page,row('Other effects'));
  const seen=new Set(),pictures=new Set(),tree=library.locator('.gf-tree');
  for(let n=0;n<30&&seen.size<144;n++){
    await page.waitForFunction(()=>[...document.querySelectorAll('.pe-library [data-effect-id]')].every(row=>row.querySelector('img')||row.querySelector('small')),null,{timeout:60000});
    for(const value of await library.locator('[data-effect-id]').evaluateAll(rows=>rows.map(row=>({id:row.dataset.effectId,picture:!!row.querySelector('img')})))){seen.add(value.id);if(value.picture)pictures.add(value.id);}
    const top=await tree.evaluate(el=>el.scrollTop),box=await tree.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,240);await page.waitForFunction(top=>document.querySelector('.pe-library .gf-tree').scrollTop>top,top);
  }
  assert.ok(seen.size>=144,'Virtual scrolling reaches at least 144 effects');assert.ok(pictures.size>36,'Thumbnails beyond the initial service snapshot load');
  assert.deepEqual(errors,[]);
  const result={passed:true,ms:Date.now()-started,processed:manifest.processed.length,recipes:manifest.recipeCount,previews:pictures.size,returns,samples};await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{if(app)await closeApp(app);await store.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
