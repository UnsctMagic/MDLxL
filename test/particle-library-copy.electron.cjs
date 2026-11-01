const { launchApp, closeApp, stubDialogs } = require('./helpers/app.cjs');

const {click,type,waitFile}=require('./helpers/library-browser.cjs');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {ParticleLibrary}=require('../electron/particle-library.cjs');
(async()=>{
 const root=process.cwd(),out=path.join(root,'out','particle-prototype','library-copy-'+Date.now()),profile=path.join(out,'profile'),directory=path.join(profile,'particles');
 const {createStarterRecipe}=await import('../src/particle-starters.js'),{particleRecipeDocument}=await import('../src/particle-recipes.js'),{stringifyParticleData,parseParticleData}=await import('../src/particle-data.js');
 const recipe=createStarterRecipe();recipe.id='wc3-'+'1'.repeat(24);recipe.name='Stock sparks';
 const {starterTextureAsset}=await import('./starter-picture.js'),image='copy-fixture.tga';
 recipe.native.Textures[0].Image=image;recipe.dependencies[0].path=image;
 recipe.embeddedAssets=[{path:image,data:Buffer.from(starterTextureAsset(image).bytes).toString('base64')}];
 const folder=path.join(out,'installation');await fs.mkdir(path.join(folder,'Data'),{recursive:true});await fs.writeFile(path.join(folder,'.build.info'),'copy-test');
 const {installKey}=require('../electron/casc.cjs'),{browseRevision}=require('../electron/particle-review.cjs');
 const sourceKey=installKey(folder,'copy-test'),cache=path.join(directory,sourceKey);await fs.mkdir(cache,{recursive:true});
 const stockData=stringifyParticleData(recipe),stockFile=path.join(cache,recipe.id+'.json');await fs.writeFile(stockFile,stockData);
 await fs.writeFile(path.join(directory,'current.json'),JSON.stringify({sourceKey,folder}));
 await fs.writeFile(path.join(cache,'catalog.json'),JSON.stringify([{id:recipe.id,name:recipe.name,collection:'Warcraft',categories:['Sparks'],tags:[]}]));
 await fs.writeFile(path.join(cache,'manifest.json'),JSON.stringify({sourceKey,processed:[],failures:[],missingDependencies:[],unsupported:[],recipeCount:1,extractionComplete:true}));
 await fs.writeFile(path.join(cache,'browse.json'),JSON.stringify({revision:browseRevision(await fs.stat(path.join(cache,'catalog.json'),{bigint:true})),objects:[],other:[recipe.id],buckets:[],metadata:{}}));
 await fs.writeFile(path.join(profile,'settings.json'),JSON.stringify({gameData:folder,preferences:{checkUpdatesOnStartup:false}}));
 const store=new ParticleLibrary({directory,discover:async()=>({cascFolders:[]})});
 // Reproduce a legacy working edit linked to the default's ID.
 const legacy=particleRecipeDocument(recipe);legacy.apply('Legacy edit',['Nodes'],m=>{m.ParticleEmitters2[0].ParticleScaling.fill(177);});
 await store.workingCopy({id:recipe.id,data:stringifyParticleData({schema:'mdlxl-particle-draft',version:1,key:recipe.id,state:legacy.captureRecoveryState(),recipe})});
 const {createDemoDocument}=await import('../src/editor-document.js'),fixture=path.join(out,'target.mdx'),fixtureBytes=Buffer.from(createDemoDocument().serialize('mdx'));await fs.writeFile(fixture,fixtureBytes);
 let app;const errors=[];
 const launch=async()=>{
  const launched = await launchApp({ out, fixture, profile, errors, timeout: 60000, bounds: { x: -3000, y: 0, width: 1400, height: 920 }, show: 'inactive', pageTimeout: 20000 }); app = launched.app;
  const page=launched.page;

  await page.waitForFunction(()=>mdlxlProbe('.game-preview-root').session?.doc?.name==='target.mdx',null,{polling:100});await click(page,page.getByRole('button',{name:'Emitter Editor',exact:true}));
  await page.getByRole('dialog',{name:'Particle Editor',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('.pe-library')?.getAttribute('aria-busy')==='false');return page;
 };
 const lab=page=>page.evaluate(()=>{let f=document.querySelector('.pe-window');{ const v = findFiberState(f, v => v?.doc?.model&&v?.recipe); if (v) return {key:v.key,undo:v.doc.historyStats.undoSteps,scaling:Array.from(v.doc.model.ParticleEmitters2[0].ParticleScaling)}; }throw Error('Lab missing');});
 try{
  const page=await launch(),dialog=page.getByRole('dialog',{name:'Particle Editor',exact:true}),size=page.getByRole('spinbutton',{name:'Halfway size',exact:true});
  const library=page.locator('.pe-library'),row=name=>library.getByRole('treeitem',{name,exact:true});
  assert.equal(await library.locator('.gf-tree').count(),1,'Personal collections use the shared Library tree');
  const openStock=async()=>{await click(page,row('Sparks'));await click(page,row('Stock sparks'));await page.keyboard.press('Enter');await library.waitFor({state:'hidden'});};
  const openPreset=async()=>{await click(page,row('My presets'));await click(page,row('My changed sparks'),{clickCount:2});await library.waitFor({state:'hidden'});};
  await openStock();const original=await lab(page);assert.match(original.key,/^lab-/);assert.deepEqual(original.scaling,Array.from(recipe.native.ParticleEmitters2[0].ParticleScaling),'Legacy default-linked edits must be ignored');
  await type(page,size,String(Number(await size.inputValue())+25));await page.keyboard.press('Enter');const edited=await lab(page);assert.ok(edited.undo>0);assert.notDeepEqual(edited.scaling,original.scaling);
  await click(page,dialog.getByRole('button',{name:'Save preset',exact:true}));await type(page,page.getByLabel('Preset name',{exact:true}),'My changed sparks');await click(page,page.getByRole('button',{name:'Save to My presets',exact:true}));await page.getByText('Saved My changed sparks',{exact:true}).waitFor();
  await click(page,dialog.getByRole('button',{name:'Library',exact:true}));await openStock();const fresh=await lab(page);assert.notEqual(fresh.key,edited.key);assert.equal(fresh.undo,0);assert.deepEqual(fresh.scaling,original.scaling);
  await click(page,dialog.getByRole('button',{name:'Library',exact:true}));await openPreset();assert.deepEqual((await lab(page)).scaling,edited.scaling);
  await type(page,size,'0');await page.keyboard.press('Enter');await click(page,dialog.getByRole('button',{name:'Library',exact:true}));await openPreset();assert.deepEqual((await lab(page)).scaling,edited.scaling,'Saved presets also start from saved values');
  const presets=(await store.catalog()).items.filter(i=>i.collection==='My presets');assert.equal(presets.length,1);assert.deepEqual(Array.from(parseParticleData(await store.read(presets[0].id)).native.ParticleEmitters2[0].ParticleScaling),edited.scaling);
  assert.equal(await fs.readFile(stockFile,'utf8'),stockData);assert.deepEqual(await fs.readFile(fixture),fixtureBytes);
  await click(page,dialog.getByRole('button',{name:'Library',exact:true}));await click(page,row('My presets'));await click(page,row('My changed sparks'));
  await type(page,page.getByLabel('Effect display name'),'Renamed sparks');await page.keyboard.press('Tab');await row('Renamed sparks').waitFor();
  await type(page,page.getByLabel('Effect tags'),'warm, test');await page.keyboard.press('Tab');
  await page.waitForFunction(()=>findFiberState(document.querySelector('.pe-library'),v=>v?.items)?.items.some(i=>i.name==='Renamed sparks'&&i.tags?.includes('warm')));
  const selectedId=await library.locator('.gf-row.selected').getAttribute('data-effect-id');
  await click(page,library.getByRole('button',{name:'Duplicate',exact:true}));
  await page.waitForFunction(()=>findFiberState(document.querySelector('.pe-library'),v=>v?.items)?.items.filter(i=>i.collection==='My presets').length===2);
  const exported=path.join(out,'exported.mdlxl-particle');await stubDialogs(app,{save:exported});await click(page,library.getByRole('button',{name:'Export preset',exact:true}));
  assert.equal(parseParticleData(await waitFile(exported)).name,'Renamed sparks');
  await click(page,library.getByRole('button',{name:'Delete',exact:true}));await library.locator('[data-effect-id="'+selectedId+'"]').waitFor({state:'hidden'});
  await click(page,row('My presets'));await click(page,row('My work'));
  const work=library.locator('[data-effect-id^="work-"]').first();await click(page,work);
  assert.equal(await library.getByRole('button',{name:'Delete',exact:true}).count(),0,'Only My presets can be deleted');
  await type(page,page.getByLabel('Effect display name'),'Renamed working sparks');await page.keyboard.press('Tab');await row('Renamed working sparks').waitFor();
  const workExport=path.join(out,'working-export.mdlxl-particle');await stubDialogs(app,{save:workExport});await click(page,library.getByRole('button',{name:'Export preset',exact:true}));assert.equal(parseParticleData(await waitFile(workExport)).name,'Renamed working sparks');
  await click(page,library.getByRole('button',{name:'Duplicate',exact:true}));
  await page.waitForFunction(()=>findFiberState(document.querySelector('.pe-library'),v=>v?.items)?.items.filter(i=>i.collection==='My presets').length===2);
  await click(page,row('Renamed working sparks'));await page.keyboard.press('Enter');await library.waitFor({state:'hidden'});
  const resumed=await lab(page);assert.ok(resumed.key);
  await page.screenshot({path:path.join(out,'library-copy.png')});
  await click(page,dialog.getByRole('button',{name:'Close Particle Editor',exact:true}));await dialog.waitFor({state:'hidden'});
  await closeApp(app, { keepProfile: true });app=null;
  const restarted=await launch();assert.deepEqual((await lab(restarted)).scaling,resumed.scaling,'Current draft survives restart independently');
  assert.deepEqual(errors,[]);console.log('Default-linked legacy edits ignored; independent default copies, save preset, immutable saved presets, draft restart and unchanged model file passed.');
 }finally{if(app)await closeApp(app);await store.close();}
})().catch(error=>{console.error(error);process.exit(1);});
