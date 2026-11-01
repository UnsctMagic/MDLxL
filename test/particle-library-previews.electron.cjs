const { launchApp, closeApp } = require('./helpers/app.cjs');

const {click,type,orbit}=require('./helpers/library-browser.cjs');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {ParticleLibrary}=require('../electron/particle-library.cjs');
const {particleSourceState}=require('../electron/particle-source.cjs');
(async()=>{
 const root=process.cwd(),out=path.resolve(process.env.MDLXL_PREVIEW_TEST_OUT||'out/particle-library-previews'),profile=path.join(out,'profile'),directory=path.join(profile,'particles');
 const folder=path.join(out,'installation');await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,'.build.info'),'preview-test');await fs.mkdir(path.join(folder,'Data'),{recursive:true});
 const sourceKey=(await particleSourceState(async()=>({cascFolders:[folder]}))).sourceKey,cache=path.join(directory,sourceKey);await fs.mkdir(cache,{recursive:true});
 await fs.writeFile(path.join(profile,'settings.json'),JSON.stringify({gameData:folder,preferences:{checkUpdatesOnStartup:false}}));
 const {createStarterRecipe}=await import('../src/particle-starters.js'),{stringifyParticleData}=await import('../src/particle-data.js'),recipe=createStarterRecipe(),items=[];
 // The installation above is a synthetic catalog identity, not a readable CASC.
 // Keep the preview self-contained with a valid 1x1 TGA carried by the preset.
 const picture='preview-fixture.tga',bytes=Buffer.alloc(22,255);bytes.fill(0,0,18);bytes[2]=2;bytes.writeUInt16LE(1,12);bytes.writeUInt16LE(1,14);bytes[16]=32;bytes[17]=0x28;
 recipe.native.Textures[0].Image=picture;recipe.dependencies=recipe.dependencies.map(dep=>({...dep,path:picture}));
 recipe.embeddedAssets=[{path:picture,data:bytes.toString('base64')}];
 for(let n=1;n<=72;n++){const id='wc3-'+n.toString(16).padStart(24,'0');await fs.writeFile(path.join(cache,id+'.json'),stringifyParticleData({...recipe,id,name:'Cached effect '+n}));items.push({id,name:'Cached effect '+n,collection:'Warcraft',categories:['Sparks'],tags:[],unsupported:[]});}
 await fs.writeFile(path.join(directory,'current.json'),JSON.stringify({sourceKey,folder}));await fs.writeFile(path.join(cache,'catalog.json'),JSON.stringify(items));await fs.writeFile(path.join(cache,'manifest.json'),JSON.stringify({schema:3,sourceKey,processed:[],failures:[],missingDependencies:[],unsupported:[],recipeCount:72,extractionComplete:true}));
 const {browseRevision}=require('../electron/particle-review.cjs');
 await fs.writeFile(path.join(cache,'browse.json'),JSON.stringify({revision:browseRevision(await fs.stat(path.join(cache,'catalog.json'),{bigint:true})),
   metadata:{},objects:[{id:'test',name:'Localized object',folders:[['Units','Naga','Normal']],count:1,groups:[{title:'Localized ability · Missile',refs:[0]}]}],buckets:[[items[0].id]],other:items.slice(1).map(item=>item.id)}));
 const store=new ParticleLibrary({directory,discover:async()=>({cascFolders:[folder]})}),png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
 await store.save({data:stringifyParticleData(recipe),name:'Offline personal sparks'});
 const {particleRecipeDocument}=await import('../src/particle-recipes.js'),workingRecipe={...recipe,name:'Offline working sparks'},workingDoc=particleRecipeDocument(workingRecipe);
 await store.workingCopy({id:'lab-offline',data:stringifyParticleData({schema:'mdlxl-particle-draft',version:1,key:'lab-offline',state:workingDoc.captureRecoveryState(),recipe:workingRecipe})});
 const workId=(await store.catalog()).items.find(item=>item.collection==='My work').id;
 for(const item of items.slice(0,process.env.MDLXL_PREVIEW_COLD?'36':72)){const revision=(await store.thumbnails([item.id]))[item.id].revision;await store.thumbnail({id:item.id,url:png,revision});}
 let app;const errors=[];try{
 const launched = await launchApp({ out, profile, errors, timeout: 60000, bounds: { x: -3000, y: 0, width: 1400, height: 920 }, show: 'inactive', pageTimeout: 20000 }); app = launched.app;
 const page=launched.page;
 const library=page.locator('.pe-library'),button=name=>page.getByRole('button',{name,exact:true}),row=name=>library.getByRole('treeitem',{name,exact:true}),search=page.getByLabel('Find an effect');
 await click(page,button('Emitter Editor'));await library.waitFor();
 assert.equal(await library.locator('.gf-tree').count(),1,'Previews use the shared virtual tree');
 await click(page,button('World Editor Style'));
 await type(page,search,'Localized ability');await row('Localized object').waitFor();
 assert.equal(await library.locator('[data-effect-id]').getAttribute('data-effect-id'),items[0].id);
 await type(page,search,'');await click(page,button('Standard'));await click(page,row('Sparks'));
 const thumbnails=new Set(),tree=library.locator('.gf-tree');
 const collect=async()=>{
   await page.waitForFunction(()=>[...document.querySelectorAll('.pe-library [data-effect-id]')].every(row=>row.querySelector('img')));
   for(const id of await library.locator('[data-effect-id]').evaluateAll(rows=>rows.filter(row=>row.querySelector('img')).map(row=>row.dataset.effectId)))thumbnails.add(id);
 };
 for(let n=0;n<10;n++){
   await collect();const state=await tree.evaluate(el=>({top:el.scrollTop,max:el.scrollHeight-el.clientHeight}));if(state.top>=state.max)break;
   const box=await tree.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,240);
   await page.waitForFunction(top=>document.querySelector('.pe-library .gf-tree').scrollTop>top,state.top);
 }
 assert.equal(thumbnails.size,72,'All 72 cached thumbnails stay reachable through virtual scrolling');
 await app.evaluate(({ipcMain})=>{const handler=ipcMain._invokeHandlers.get('particles:catalog');global.__catalogCalls=0;ipcMain.removeHandler('particles:catalog');ipcMain.handle('particles:catalog',async(...args)=>{global.__catalogCalls++;const cat=await handler(...args);if(global.__eventVersion)cat.status={...cat.status,processed:global.__eventVersion};return cat;});});
 await page.evaluate(()=>{window.__lostThumb=false;window.__thumbObserver=new MutationObserver(()=>{if([...document.querySelectorAll('.pe-library [data-effect-id]')].some(row=>!row.querySelector('img')))window.__lostThumb=true;});window.__thumbObserver.observe(document.querySelector('.pe-library'),{childList:true,subtree:true});});
 await app.evaluate(({BrowserWindow})=>{global.__eventVersion=100;for(let n=0;n<100;n++)BrowserWindow.getAllWindows()[0].webContents.send('particles:progress',{running:true,processed:n,total:100});BrowserWindow.getAllWindows()[0].webContents.send('particles:progress',{running:false,processed:100,total:100});});
 await page.waitForFunction(()=>findFiberState(document.querySelector('.pe-library'),v=>v?.items)?.status?.processed===100);
 await collect();const refreshes=await app.evaluate(()=>global.__catalogCalls);assert.ok(refreshes<=2,'Index events are coalesced');
 assert.equal(await page.evaluate(()=>{window.__thumbObserver.disconnect();return window.__lostThumb;}),false,'Progress preserves thumbnails beyond the first page');
 await type(page,search,'Cached effect 1');await click(page,row('Cached effect 1'));await orbit(page,library.locator('.gf-stage'));
 await page.keyboard.press('Tab');await click(page,button('Open in Lab'));await library.waitFor({state:'hidden'});await orbit(page,page.locator('.pe-preview'));
 const samples=[];
 for(let n=0;n<5;n++){
   await click(page,page.getByRole('dialog',{name:'Particle Editor',exact:true}).getByRole('button',{name:'Library',exact:true}));
   await click(page,row('Sparks'));await click(page,row('Cached effect 1'));await page.keyboard.press('Enter');await library.waitFor({state:'hidden'});
   samples.push(await app.evaluate(({app})=>app.getAppMetrics().map(m=>({type:m.type,cpu:m.cpu.percentCPUUsage,workingSetKB:m.memory.workingSetSize}))));
 }
 // Fixture-only source availability changes; every browse/favorite/open is real input.
 await app.evaluate(({ipcMain})=>{
   const handler=ipcMain._invokeHandlers.get('particles:catalog');ipcMain.removeHandler('particles:catalog');
   ipcMain.handle('particles:catalog',async(...args)=>{const cat=await handler(...args);cat.items[0].blocked={reason:'Fixture dependency unavailable'};cat.items[1].unsupported=['Fixture dependency'];cat.browse.objects[0].groups[0].refs=[0,1];cat.browse.buckets[1]=[cat.items[1].id];if(global.__offline)cat.sourceStatus=global.__offline;if(global.__noBrowse)cat.browse=null;return cat;});
 });
 await click(page,page.getByRole('dialog',{name:'Particle Editor',exact:true}).getByRole('button',{name:'Library',exact:true}));
 await type(page,search,'Cached effect 1');await library.getByText('Unavailable',{exact:true}).waitFor();
 await type(page,search,'Cached effect 2');await library.getByText('Incomplete preview',{exact:true}).waitFor();
 await click(page,button('World Editor Style'));await type(page,search,'Localized object');
 await library.getByText('Unavailable',{exact:true}).waitFor();await library.getByText('Incomplete preview',{exact:true}).waitFor();
 for(const [state,message] of [['missing','Connect your Warcraft III installation in Settings.'],['changed','The Warcraft source or build changed. Index Warcraft assets again before opening its effects.']]){
   await app.evaluate(({BrowserWindow},sourceStatus)=>{global.__offline=sourceStatus;BrowserWindow.getAllWindows()[0].webContents.send('particles:progress',{running:false});},{state,message});
   await library.getByText(message,{exact:true}).waitFor();assert.equal(await library.locator('[data-effect-id]').count(),2,'Disconnected or changed World Editor keeps cached effects');
 }
 await click(page,row('Cached effect 1'));await click(page,library.getByRole('button',{name:/^Favorite /}));
 const favoriteIds=[items[0].id,workId];
 for(const name of ['Offline personal sparks','Offline working sparks']){await type(page,search,name);await click(page,row(name));const id=await library.locator('.gf-row.selected').getAttribute('data-effect-id');if(name==='Offline personal sparks')favoriteIds.push(id);await click(page,library.getByRole('button',{name:/^Favorite /}));}
 const checkFavorites=async()=>{await type(page,search,'');await click(page,row('Warcraft'));await click(page,row('Favorites'));assert.deepEqual((await library.locator('[data-effect-id]').evaluateAll(rows=>rows.map(row=>row.dataset.effectId))).sort(),[...favoriteIds].sort(),'Stock, preset and work favorites remain reachable');};
 await checkFavorites();await click(page,button('Standard'));await click(page,row('Warcraft'));await click(page,row('Favorites'));assert.deepEqual((await library.locator('[data-effect-id]').evaluateAll(rows=>rows.map(row=>row.dataset.effectId))).sort(),[...favoriteIds].sort());
 await app.evaluate(({BrowserWindow})=>{global.__noBrowse=true;BrowserWindow.getAllWindows()[0].webContents.send('particles:progress',{running:false});});
 await click(page,button('World Editor Style'));await type(page,search,'Cached effect 72');await row('Cached effect 72').waitFor();
 await checkFavorites();
 await type(page,search,'Offline personal sparks');await click(page,row('Offline personal sparks').first(),{clickCount:2});await library.waitFor({state:'hidden'});
 await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('texture:resolve');ipcMain.handle('texture:resolve',async()=>[]);});
 const editor=page.getByRole('dialog',{name:'Particle Editor',exact:true});await click(page,editor.getByRole('button',{name:'New',exact:true}));await click(page,editor.getByRole('button',{name:'Soft smoke',exact:true}));
 await page.waitForFunction(name=>findFiberState(document.querySelector('.pe-window'),v=>v?.recipe&&v?.doc)?.recipe.name===name,createStarterRecipe('smoke').name);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks:'72 virtual row thumbnails, five round trips, library/Lab orbit, coalesced refresh, missing/changed/no-sidecar favorites',refreshes,samples}));
 await closeApp(app);app=null;
 // A fresh, never-indexed profile must keep the short connect message in Warcraft.
 // Seed the normal discovery cache with no install; do not alter real game data.
 const fresh=path.join(out,'never-connected');await fs.mkdir(fresh,{recursive:true});
 const stampFile=path.join(fresh,'discovery-stamp');await fs.writeFile(stampFile,'no connected game');const stamp=await fs.stat(stampFile);
 await fs.writeFile(path.join(fresh,'game-data-discovery.json'),JSON.stringify({version:2,selectedKey:null,folders:[],stamps:[{file:stampFile,size:stamp.size,mtimeMs:stamp.mtimeMs}],result:{folders:[],archives:[],cascFolders:[]}}));
 const freshStore=new ParticleLibrary({directory:path.join(fresh,'particles'),discover:async()=>({cascFolders:[]})});
 await freshStore.save({data:stringifyParticleData(recipe),name:'Never-connected preset'});await freshStore.close();
 const never=await launchApp({out,profile:fresh,settings:{gameData:null,preferences:{checkUpdatesOnStartup:false}},show:'hide',errors});app=never.app;
 const freshPage=never.page,freshLibrary=freshPage.locator('.pe-library');await click(freshPage,freshPage.getByRole('button',{name:'Emitter Editor',exact:true}));
 await freshLibrary.getByText('Connect your Warcraft III installation in Settings.',{exact:true}).waitFor();
 await click(freshPage,freshPage.getByRole('button',{name:'World Editor Style',exact:true}));
 assert.equal(await freshLibrary.locator('[data-effect-id]').count(),0);assert.equal(await freshLibrary.getByRole('status').count(),1);assert.doesNotMatch(await freshLibrary.innerText(),/Finding World Editor effects/);
 await click(freshPage,freshPage.getByRole('treeitem',{name:'My presets',exact:true}));await click(freshPage,freshPage.getByRole('treeitem',{name:'Never-connected preset',exact:true}));await click(freshPage,freshLibrary.getByRole('button',{name:'Favorite Never-connected preset',exact:true}));
 await click(freshPage,freshPage.getByRole('treeitem',{name:'My presets',exact:true}));await click(freshPage,freshPage.getByRole('treeitem',{name:'Favorites',exact:true}));
 assert.equal(await freshLibrary.locator('[data-effect-id]').getAttribute('aria-label'),'Never-connected preset');assert.deepEqual(errors,[]);
 await click(freshPage,freshPage.getByRole('treeitem',{name:'Never-connected preset',exact:true}));await click(freshPage,freshLibrary.getByRole('button',{name:'Delete',exact:true}));
 await freshPage.waitForFunction(()=>document.querySelectorAll('.pe-library .gf-row').length===0);
 assert.doesNotMatch(await freshLibrary.innerText(),/Loading effects/,'An empty offline tree retains the connect status instead of claiming it is loading');
 console.log('PASS never-connected message and personal favorite without a game index');
 }finally{if(app)await closeApp(app);await store.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
