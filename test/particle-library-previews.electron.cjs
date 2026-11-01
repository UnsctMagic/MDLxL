const { launchApp, closeApp, settle } = require('./helpers/app.cjs');

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
 for(const item of items.slice(0,process.env.MDLXL_PREVIEW_COLD?'36':72)){const revision=(await store.thumbnails([item.id]))[item.id].revision;await store.thumbnail({id:item.id,url:png,revision});}
 let app;const errors=[];try{
 const launched = await launchApp({ out, profile, errors, timeout: 60000, bounds: { x: -3000, y: 0, width: 1400, height: 920 }, show: 'inactive', pageTimeout: 20000 }); app = launched.app;
 const page=launched.page;
 await page.getByRole('button',{name:'Emitter Editor',exact:true}).click();await page.locator('.pe-library').waitFor();
 await page.getByRole('button',{name:'World Editor',exact:true}).click();
 await page.getByRole('treeitem',{name:'Other effects',exact:true}).click();assert.equal(await page.locator('.pe-effect-card').count(),36);
 await page.getByLabel('Find an effect').fill('Localized ability');await page.getByRole('treeitem',{name:'Localized object',exact:true}).click();
 assert.equal(await page.locator('article').getAttribute('data-effect-id'),items[0].id);
 await page.getByLabel('Find an effect').fill('');await page.getByRole('button',{name:'By type',exact:true}).click();
 await page.getByRole('button',{name:'Show more',exact:true}).click();
 try{await page.waitForFunction(()=>document.querySelectorAll('.pe-effect-thumb img').length===72,null,{timeout:10000});}catch(e){console.log(JSON.stringify({phase:'cached-pagination',images:await page.locator('.pe-effect-thumb img').count(),cards:await page.locator('.pe-effect-card').count()}));throw e;}
 await app.evaluate(({ipcMain})=>{const handler=ipcMain._invokeHandlers.get('particles:catalog');global.__catalogCalls=0;ipcMain.removeHandler('particles:catalog');ipcMain.handle('particles:catalog',(...args)=>{global.__catalogCalls++;return handler(...args);});});
 await app.evaluate(({BrowserWindow})=>{for(let n=0;n<100;n++)BrowserWindow.getAllWindows()[0].webContents.send('particles:progress',{running:true,processed:n,total:100});});
 await settle(page, 1300);const refreshes=await app.evaluate(()=>global.__catalogCalls);assert.ok(refreshes<=2,'A burst of index progress must not reload the full catalog for every event');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('particles:progress',{running:false,processed:100,total:100}));await page.waitForFunction(()=>document.querySelectorAll('.pe-effect-thumb img').length===72);
 await page.locator('.pe-effect-card').filter({hasText:'Cached effect 1'}).first().click();await page.locator('.pe-library').waitFor({state:'hidden'});
 await page.waitForFunction(()=>!document.querySelector('.pe-window .re-status')?.textContent.includes('Updating effect'));const canvas=page.locator('.pe-preview .game-preview-root canvas').first(),box=await canvas.boundingBox();
 const camera=()=>page.evaluate(()=>{let f=document.querySelector('.pe-preview .game-preview-root');{ const v = mdlxlProbe(f).runtime; if (v) return v.controls.object.position.toArray(); }}),before=await camera();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+70,box.y+box.height/2+35,{steps:8});await page.mouse.up();assert.notDeepEqual(await camera(),before);
 const samples=[];for(let n=0;n<5;n++){await page.getByRole('dialog',{name:'Particle Editor',exact:true}).getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('button',{name:'Show more',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.pe-effect-thumb img').length===72);samples.push(await app.evaluate(({app})=>app.getAppMetrics().map(m=>({type:m.type,cpu:m.cpu.percentCPUUsage,workingSetKB:m.memory.workingSetSize}))));await page.locator('.pe-effect-card').filter({hasText:'Cached effect 1'}).first().click();await page.locator('.pe-library').waitFor({state:'hidden'});}
 // Exercise the same availability cards in both views, then disconnect the synthetic source.
 await app.evaluate(({ipcMain})=>{
   const handler=ipcMain._invokeHandlers.get('particles:catalog');ipcMain.removeHandler('particles:catalog');
   ipcMain.handle('particles:catalog',async(...args)=>{
     const cat=await handler(...args);
     cat.items[0].blocked={reason:'Fixture dependency unavailable'};
     cat.items[1].unsupported=['Fixture dependency'];
     cat.browse.objects[0].groups[0].refs=[0,1];cat.browse.buckets[1]=[cat.items[1].id];
     if(global.__offline)cat.sourceStatus={state:'missing',message:'Connect your Warcraft III installation in Settings.'};
     return cat;
   });
 });
 await page.getByRole('dialog',{name:'Particle Editor',exact:true}).getByRole('button',{name:'Library',exact:true}).click();
 const library=page.locator('.pe-library');
 await library.getByRole('button',{name:'Show more',exact:true}).click();
 await library.getByText('Unavailable',{exact:true}).waitFor();await library.getByText('Incomplete preview',{exact:true}).waitFor();
 await page.getByRole('button',{name:'World Editor',exact:true}).click();
 await page.getByLabel('Find an effect').fill('Localized object');await page.getByRole('treeitem',{name:'Localized object',exact:true}).click();
 await library.getByText('Unavailable',{exact:true}).waitFor();await library.getByText('Incomplete preview',{exact:true}).waitFor();
 await app.evaluate(({BrowserWindow})=>{global.__offline=true;BrowserWindow.getAllWindows()[0].webContents.send('particles:progress',{running:false});});
 await library.getByText('Connect your Warcraft III installation in Settings.',{exact:true}).waitFor();
 assert.equal(await library.locator('.pe-effect-card').count(),0);assert.equal(await library.getByRole('status').count(),1);
 await page.getByRole('button',{name:'My presets',exact:true}).click();assert.equal(await library.getByRole('button',{name:'Import preset…',exact:true}).count(),1);
 assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,'preview.png')});console.log(JSON.stringify({passed:true,checks:'72 cached thumbnails, five library/effect round trips, native mouse rotation, 100 index events coalesced',refreshes,samples}));
 }finally{if(app)await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
