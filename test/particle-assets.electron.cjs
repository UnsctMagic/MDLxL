const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {ParticleLibrary}=require('../electron/particle-library.cjs');
(async()=>{
 const root=process.cwd(),out=path.join(root,'out','particle-prototype','collision-ui-'+Date.now()),profile=path.join(out,'profile');
 await fs.mkdir(profile,{recursive:true});
 const {createDemoDocument,openDocument}=await import('../src/editor-document.js');
 const {createStarterRecipe,starterTextureAsset,STARTER_TEXTURE}=await import('../src/particle-starters.js');
 const {stringifyParticleData}=await import('../src/particle-data.js');
 const fixture=path.join(out,'collision-target.mdx'),source=createDemoDocument(),incoming=starterTextureAsset(),existing=starterTextureAsset();existing.bytes[20]=123;
 source.model.Textures[0]={Image:STARTER_TEXTURE,ReplaceableId:0,Flags:0};const fixtureBytes=Buffer.from(source.serialize('mdx'));await fs.writeFile(fixture,fixtureBytes);
 const originalPicture=path.join(out,...STARTER_TEXTURE.split('\\'));await fs.mkdir(path.dirname(originalPicture),{recursive:true});await fs.writeFile(originalPicture,existing.bytes);
 const store=new ParticleLibrary({directory:path.join(profile,'particles'),discover:async()=>({cascFolders:[]})});
 const saved=await store.save({data:stringifyParticleData(createStarterRecipe()),name:'Collision sparks'});
 const revision=(await store.thumbnails([saved.id]))[saved.id].revision;
 await store.thumbnail({id:saved.id,revision,url:'data:image/png;base64,'+(await fs.readFile('public/classic/btn-mana-flare.png')).toString('base64')});await store.close();
 let app;const errors=[];
 try{
  app=await _electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',root,fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile},timeout:60000});
  const page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setSize(1400,920);w.setPosition(-3000,0);w.showInactive();});
  await page.getByRole('button',{name:'Emitter Editor',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Particle Editor',exact:true});
  await page.getByRole('button',{name:'My presets',exact:true}).click();await page.locator('.pe-effect-card').filter({hasText:'Collision sparks'}).click();await page.locator('.pe-library').waitFor({state:'hidden'});
  const read=()=>page.evaluate(()=>{const el=document.querySelector('.pe-window');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)if(f.memoizedProps?.doc?.model){const {doc,textureAssets}=f.memoizedProps;return {model:JSON.parse(JSON.stringify(doc.model)),assets:[...textureAssets].map(([key,a])=>({key,name:a.name,bytes:Array.from(a.bytes||[])}))};}throw Error('Model missing');});
  const before=await read();assert.deepEqual(before.assets.find(a=>a.key===STARTER_TEXTURE.toLowerCase()).bytes,Array.from(existing.bytes));
  const add=async()=>{
   await dialog.getByRole('button',{name:'Add to model',exact:true}).click();
   await page.getByLabel('Effect start',{exact:true}).fill('100');await page.getByLabel('Effect end',{exact:true}).fill('900');
   await page.getByRole('button',{name:'Pause ghost',exact:true}).click();
   const ghost=await page.locator('.pe-preview .game-preview-root').evaluate(el=>{let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return){const m=f.memoizedProps?.model;if(m?.ParticleEmitters2?.length)return m.Textures[m.ParticleEmitters2.at(-1).TextureID].Image;}throw Error('Ghost missing');});
   assert.match(ghost,/^MDLxL_Forge\\Particle_[a-f0-9]{32}\.tga$/);
   await page.getByRole('button',{name:'Confirm placement',exact:true}).click();await page.getByText('Effect added. Undo restores the model.',{exact:true}).waitFor();return ghost;
  };
  const name=await add(),placed=await read();assert.equal(placed.model.ParticleEmitters2.length,1);assert.equal(placed.model.Textures[placed.model.ParticleEmitters2[0].TextureID].Image,name);
  assert.deepEqual(placed.model.Textures[0],before.model.Textures[0]);assert.deepEqual(placed.model.Geosets,before.model.Geosets);
  assert.deepEqual(placed.assets.find(a=>a.key===STARTER_TEXTURE.toLowerCase()).bytes,Array.from(existing.bytes));assert.deepEqual(placed.assets.find(a=>a.key===name.toLowerCase()).bytes,Array.from(incoming.bytes));
  await page.screenshot({path:path.join(out,'inserted.png')});
  await dialog.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).model,before.model);
  await dialog.getByRole('button',{name:'Redo',exact:true}).click();assert.equal((await read()).model.ParticleEmitters2.length,1);
  await page.getByLabel('Particle context',{exact:true}).selectOption('Lab');assert.equal(await add(),name);assert.equal((await read()).model.ParticleEmitters2.length,2);
  await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.keyboard.press('Control+s');
  await page.waitForFunction(()=>document.querySelector('.classic-status')?.textContent.includes('Saved collision-target.mdx'));
  const reopened=openDocument(await fs.readFile(fixture),'saved.mdx');assert.equal(reopened.model.ParticleEmitters2.length,2);
  assert.deepEqual(new Uint8Array(await fs.readFile(path.join(out,...name.split('\\')))),incoming.bytes);assert.deepEqual(new Uint8Array(await fs.readFile(originalPicture)),existing.bytes);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({out,name,emitters:2,ghost:true,picturesPreserved:true,undoRedo:true,savedAndReopened:true}));
 }catch(error){if(app){const page=await app.firstWindow();console.error((await page.locator('body').innerText()).slice(-1600));await page.screenshot({path:path.join(out,'failure.png')});}throw error;}
 finally{if(app)await app.close().catch(()=>{});}
})().catch(error=>{console.error(error);process.exit(1);});
