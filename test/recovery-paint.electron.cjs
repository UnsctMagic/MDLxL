const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {launchApp,closeApp,bundleHashes}=require('./helpers/app.cjs');
const {fixturePath}=require('./helpers/fixtures.cjs');
const {RecoveryStore}=require('../electron/recovery.cjs');
(async()=>{
 const out=path.resolve(process.env.MDLXL_PAINT_RECOVERY_OUT||'out/recovery-paint');fs.mkdirSync(out,{recursive:true});
 const profile=path.join(out,'profile'),store=new RecoveryStore(path.join(profile,'recovery')),checks=[],errors=[];
 const {app,page}=await launchApp({fixture:fixturePath('citadel-footman'),out,profile,errors,settings:{preferences:{checkUpdatesOnStartup:false,modelLookAnswered:true}},bounds:{x:0,y:0,width:1280,height:1000}});
 const hash=bytes=>crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
 const state=()=>page.evaluate(()=>{const s=window.__mdlxl.session();return {id:s.id,checkpoint:s.checkpoint,revision:s.paintProject?.revision,steps:s.paintProject?.history.undo.length,raster:Array.from(s.paintProject?.targets[0].coats[0].raster.data||[])};});
 const waitSaved=async expected=>{const until=Date.now()+15000;for(;;){const saved=await store.read(expected.id).catch(()=>null);if(saved?.paintProject?.revision===expected.revision&&saved.paintProject.history.undo.length===expected.steps)return saved;if(Date.now()>until)throw Error('Completed paint-only edits did not reach recovery');await new Promise(resolve=>setTimeout(resolve,40));}};
 try{
  await page.locator('.classic-app').waitFor();await page.locator('[data-hotkey="paint"]').click();await page.getByRole('button',{name:'Begin painting',exact:true}).click();await page.locator('.paint-texture-image').waitFor();
  await page.getByLabel('Paint color',{exact:true}).fill('#248be1');await page.getByRole('spinbutton',{name:'Brush size value',exact:true}).fill('24');
  const box=await page.locator('.paint-texture-image').boundingBox(),at=(u,v)=>[box.x+box.width*u,box.y+box.height*v];
  await page.mouse.click(...at(.69,.54));await page.waitForFunction(()=>window.__mdlxl.session().paintProject.history.undo.length>0);
  const first=await state(),saved=await waitSaved(first);assert.equal(hash(saved.paintProject.targets[0].coats[0].raster.data),hash(first.raster));checks.push('Paint-only edits autosave their complete raster and undo history');
  // Start a second stroke while the first edit's debounce is pending. Continue
  // real pointer moves across that window, then release to commit one transaction.
  await page.mouse.click(...at(.6,.45));
  await page.mouse.move(...at(.65,.52));await page.mouse.down();
  const heldBefore=await state(),diskBefore=(await store.metadata(first.id)).version;
  for(let i=0;i<16;i++){await page.mouse.move(...at(.65+i*.004,.52+i*.002),{steps:2});await page.evaluate(()=>new Promise(requestAnimationFrame));}
  // The finite hold is the behavior under test, not a readiness wait.
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,450)));
  assert.equal((await store.metadata(first.id)).version,diskBefore,'An in-flight raster must not publish a mixed checkpoint');
  await page.mouse.up();await page.waitForFunction(n=>window.__mdlxl.session().paintProject.history.undo.length>n,heldBefore.steps);
  const final=await state(),complete=await waitSaved(final);assert.equal(hash(complete.paintProject.targets[0].coats[0].raster.data),hash(final.raster));checks.push('Autosave waits for mouse release and preserves the committed stroke exactly');
  await page.getByRole('button',{name:'Undo paint',exact:true}).click();await page.waitForFunction(n=>window.__mdlxl.session().paintProject.history.undo.length===n-1,final.steps);
  const undo=await state(),restored=await waitSaved(undo);assert.equal(hash(restored.paintProject.targets[0].coats[0].raster.data),hash(undo.raster));checks.push('Undo paint persists the reverted pixels and history');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors}));
 }catch(error){console.error(error);throw error;}finally{await closeApp(app);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({bundle:bundleHashes(),checks,errors},null,2));}
})().catch(error=>{console.error(error);process.exitCode=1;});
