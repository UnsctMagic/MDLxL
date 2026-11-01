const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {root,launchApp,closeApp,stubDialogs}=require('./helpers/app.cjs');
const {fixturePath}=require('./helpers/fixtures.cjs');

const nativeEffects=[
 {name:'Fire wisps',source:'units\\creeps\\heroflamelord\\heroflamelord.mdx',objectId:101},
 {name:'Water droplets',source:'units\\human\\waterelemental\\waterelemental.mdx',objectId:61},
];

// Use the scanner's real entries, recipe bytes and source identity. The two tiny
// copies let the test edit its own library metadata without touching the index.
async function seedLibrary(profile){
 const index=fixturePath('particle-index');
 const current=JSON.parse(await fs.readFile(path.join(index,'current.json'),'utf8'));
 const source=path.join(index,current.sourceKey),directory=path.join(profile,'particles');
 const cache=path.join(directory,current.sourceKey);
 await fs.mkdir(cache,{recursive:true});
 const catalog=JSON.parse(await fs.readFile(path.join(source,'catalog.json'),'utf8'));
 const rows=nativeEffects.map(effect=>{
  const row=catalog.find(item=>!item.blocked&&item.sources.some(s=>s.logicalPath.toLowerCase()===effect.source&&s.emitterId===effect.objectId));
  assert.ok(row,'Scanner entry for '+effect.name);return row;
 });
 for(const row of rows)await fs.copyFile(path.join(source,row.id+'.json'),path.join(cache,row.id+'.json'));
 await fs.copyFile(path.join(source,'manifest.json'),path.join(cache,'manifest.json'));
 await fs.copyFile(path.join(index,'current.json'),path.join(directory,'current.json'));
 await fs.writeFile(path.join(cache,'catalog.json'),JSON.stringify(rows));
}
async function drag(page,handle,dx,dy){
 const box=await handle.locator('circle').boundingBox();
 assert.ok(box,'Visible stage handle');
 const x=box.x+box.width/2,y=box.y+box.height/2;
 await page.mouse.move(x,y);await page.mouse.down();
 await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up();
}
(async()=>{
 const out=path.join(root,'out','particle-native-placement'),profile=path.join(out,'profile-'+Date.now());
 await seedLibrary(profile);
 const {page,app,errors}=await launchApp({out,profile,fixture:fixturePath('footman'),bounds:{x:-3000,y:0,width:1440,height:1000}});
 const saved=[];
 const live=()=>page.evaluate(()=>JSON.stringify(mdlxlProbe().session.doc.model));
 const lab=()=>page.evaluate(()=>{
  const state=findFiberState(document.querySelector('.pe-window'),v=>v?.doc?.model&&v?.recipe);
  const node=state.doc.model.ParticleEmitters2[0];return {size:Array.from(node.ParticleScaling),position:JSON.stringify(node.Translation)};
 });
 try{
  await page.getByText('Opened Footman.mdx',{exact:true}).waitFor();
  for(const effect of nativeEffects){
   const before=await live(),original=JSON.parse(before);
   await page.getByRole('button',{name:'Emitter Editor',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'Particle Editor',exact:true});
   await dialog.locator('.pe-toolbar').waitFor();
   if(!await dialog.locator('.pe-library').count())await dialog.getByRole('button',{name:'Library',exact:true}).click();
   await dialog.getByLabel('Find an effect',{exact:true}).fill(effect.name);
   const card=dialog.locator('.pe-effect-card').filter({hasText:effect.name});await card.click();
   await dialog.locator('.pe-library').waitFor({state:'hidden'});
   const pause=dialog.getByRole('button',{name:'Pause',exact:true});if(await pause.count())await pause.click();
   const beforeDrag=await lab();
   await drag(page,dialog.getByRole('slider',{name:'Move emitter',exact:true}),30,-12);
   assert.notEqual((await lab()).position,beforeDrag.position,'Move handle changes the emitter position');
   await drag(page,dialog.getByRole('slider',{name:'Resize particle',exact:true}),25,18);
   const edited=await lab();assert.notDeepEqual(edited.size,beforeDrag.size,'Size handle changes the particle');
   await dialog.getByRole('button',{name:'Add to model',exact:true}).click();
   const end=dialog.getByLabel('Effect end',{exact:true});
   const start=Number(await dialog.getByLabel('Effect start',{exact:true}).inputValue());
   await end.fill(String(Math.min(Number(await end.getAttribute('max'))||start+300,start+300)));
   await dialog.getByRole('button',{name:'Confirm placement',exact:true}).click();
   await page.getByText('Effect added. Undo restores the model.',{exact:true}).waitFor();
   await dialog.getByRole('button',{name:'Close Particle Editor',exact:true}).click();
   await dialog.waitFor({state:'hidden'});
   const placed=JSON.parse(await live());
   assert.equal(placed.ParticleEmitters2.length,original.ParticleEmitters2.length+1);
   assert.deepEqual(Object.values(placed.ParticleEmitters2.at(-1).ParticleScaling),edited.size);
   const file=path.join(out,effect.name+'.mdx');await stubDialogs(app,{save:file});
   await page.keyboard.press('F12');await page.getByRole('button',{name:'Save MDX…',exact:true}).click();
   await page.getByRole('dialog',{name:'Save as',exact:true}).waitFor({state:'hidden'});
   await page.waitForFunction(name=>mdlxlProbe().session.path?.endsWith(name),effect.name+'.mdx');
   await page.keyboard.press('Control+z');
   await page.waitForFunction(n=>mdlxlProbe().session.doc.model.ParticleEmitters2.length===n,original.ParticleEmitters2.length);
   assert.deepEqual(JSON.parse(await live()),original,'One Undo restores the entire model');
   saved.push({file,count:placed.ParticleEmitters2.length,size:edited.size});
   console.log(effect.name+' found, moved, resized, placed, saved and undone');
  }
  assert.deepEqual(errors,[]);
 }catch(error){console.error((await page.locator('body').innerText()).slice(-1900));await page.screenshot({path:path.join(out,'failure.png')});throw error;}
 finally{await closeApp(app);}
 for(const {file,count,size} of saved){
  const second=await launchApp({out,fixture:file});
  try{
   await second.page.getByText('Opened '+path.basename(file),{exact:true}).waitFor();
   const check=await second.page.evaluate(()=>{const nodes=mdlxlProbe().session.doc.model.ParticleEmitters2;return {count:nodes.length,size:Array.from(nodes.at(-1).ParticleScaling)};});
   assert.deepEqual(check,{count,size});assert.deepEqual(second.errors,[]);console.log('Reopened '+path.basename(file));
  }finally{await closeApp(second.app);}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
