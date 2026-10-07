const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {ParticleLibrary}=require('../electron/particle-library.cjs');
(async()=>{
 const root=process.cwd(),out=path.join(root,'out','particle-prototype','library-copy-'+Date.now()),profile=path.join(out,'profile'),directory=path.join(profile,'particles');
 const {createStarterRecipe}=await import('../src/particle-starters.js'),{particleRecipeDocument}=await import('../src/particle-recipes.js'),{stringifyParticleData,parseParticleData}=await import('../src/particle-data.js');
 const recipe=createStarterRecipe();recipe.id='wc3-'+'1'.repeat(24);recipe.name='Stock sparks';
 const sourceKey='a'.repeat(64),cache=path.join(directory,sourceKey);await fs.mkdir(cache,{recursive:true});
 const stockData=stringifyParticleData(recipe),stockFile=path.join(cache,recipe.id+'.json');await fs.writeFile(stockFile,stockData);
 await fs.writeFile(path.join(directory,'current.json'),JSON.stringify({sourceKey}));
 await fs.writeFile(path.join(cache,'catalog.json'),JSON.stringify([{id:recipe.id,name:recipe.name,collection:'Warcraft',categories:['Sparks'],tags:[]}]));
 await fs.writeFile(path.join(cache,'manifest.json'),JSON.stringify({sourceKey,processed:[],failures:[],missingDependencies:[],unsupported:[],recipeCount:1}));
 const store=new ParticleLibrary({directory,discover:async()=>({cascFolders:[]})});
 // Reproduce a legacy working edit linked to the default's ID.
 const legacy=particleRecipeDocument(recipe);legacy.apply('Legacy edit',['Nodes'],m=>{m.ParticleEmitters2[0].ParticleScaling.fill(177);});
 await store.workingCopy({id:recipe.id,data:stringifyParticleData({schema:'mdlxl-particle-draft',version:1,key:recipe.id,state:legacy.captureRecoveryState(),recipe})});
 const {createDemoDocument}=await import('../src/editor-document.js'),fixture=path.join(out,'target.mdx'),fixtureBytes=Buffer.from(createDemoDocument().serialize('mdx'));await fs.writeFile(fixture,fixtureBytes);
 let app;const errors=[];
 const launch=async()=>{
  app=await _electron.launch({executablePath:process.env.MDLXL_ELECTRON_PATH||path.resolve('node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',root,fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile},timeout:60000});
  const page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setSize(1400,920);w.setPosition(-3000,0);w.showInactive();});
  await page.getByText('Opened target.mdx',{exact:true}).waitFor();await page.getByRole('button',{name:'Emitter Editor',exact:true}).click();
  await page.getByRole('dialog',{name:'Particle Editor',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('.pe-library')?.getAttribute('aria-busy')==='false');return page;
 };
 const lab=page=>page.evaluate(()=>{let f=document.querySelector('.pe-window');f=f[Object.keys(f).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const v=h.memoizedState;if(v?.doc?.model&&v?.recipe)return {key:v.key,undo:v.doc.historyStats.undoSteps,scaling:Array.from(v.doc.model.ParticleEmitters2[0].ParticleScaling)};}throw Error('Lab missing');});
 try{
  const page=await launch(),dialog=page.getByRole('dialog',{name:'Particle Editor',exact:true}),size=page.getByRole('slider',{name:'Size',exact:true});
  const openStock=async()=>{await page.getByRole('button',{name:'Warcraft',exact:true}).click();await page.locator('.pe-effect-card').filter({hasText:'Stock sparks'}).click();await page.locator('.pe-library').waitFor({state:'hidden'});};
  await openStock();const original=await lab(page);assert.match(original.key,/^lab-/);assert.deepEqual(original.scaling,Array.from(recipe.native.ParticleEmitters2[0].ParticleScaling),'Legacy default-linked edits must be ignored');
  await size.press('End');const edited=await lab(page);assert.ok(edited.undo>0);assert.notDeepEqual(edited.scaling,original.scaling);
  await dialog.getByRole('button',{name:'Save preset',exact:true}).click();await page.getByLabel('Preset name',{exact:true}).fill('My changed sparks');await page.getByRole('button',{name:'Save to My presets',exact:true}).click();await page.getByText('Saved My changed sparks',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Library',exact:true}).click();await openStock();const fresh=await lab(page);assert.notEqual(fresh.key,edited.key);assert.equal(fresh.undo,0);assert.deepEqual(fresh.scaling,original.scaling);
  await dialog.getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('button',{name:'My presets',exact:true}).click();await page.locator('.pe-effect-card').filter({hasText:'My changed sparks'}).click();await page.locator('.pe-library').waitFor({state:'hidden'});assert.deepEqual((await lab(page)).scaling,edited.scaling);
  await size.press('Home');await dialog.getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('button',{name:'My presets',exact:true}).click();await page.locator('.pe-effect-card').filter({hasText:'My changed sparks'}).click();await page.locator('.pe-library').waitFor({state:'hidden'});assert.deepEqual((await lab(page)).scaling,edited.scaling,'Saved presets also start from saved values');
  const presets=(await store.catalog()).items.filter(i=>i.collection==='My presets');assert.equal(presets.length,1);assert.deepEqual(Array.from(parseParticleData(await store.read(presets[0].id)).native.ParticleEmitters2[0].ParticleScaling),edited.scaling);
  assert.equal(await fs.readFile(stockFile,'utf8'),stockData);assert.deepEqual(await fs.readFile(fixture),fixtureBytes);
  await page.screenshot({path:path.join(out,'library-copy.png')});
  await dialog.getByRole('button',{name:'Close Particle Editor',exact:true}).click();await dialog.waitFor({state:'hidden'});
  await app.evaluate(({app})=>app.exit(0));app=null;
  const restarted=await launch();assert.deepEqual((await lab(restarted)).scaling,edited.scaling,'Current draft survives restart independently');
  assert.deepEqual(errors,[]);console.log('Default-linked legacy edits ignored; independent default copies, save preset, immutable saved presets, draft restart and unchanged model file passed.');
 }finally{if(app)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await store.close();}
})().catch(error=>{console.error(error);process.exit(1);});
