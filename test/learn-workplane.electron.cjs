// Learn's real capture-phase click must leave every Workplane checkbox usable.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {launchApp,closeApp,appTarget,sha256File}=require('./helpers/app.cjs');
const {fixturePath}=require('./helpers/fixtures.cjs');
(async()=>{
 const out=path.resolve('out/learn-workplane'),fixture=fixturePath('footman'),hash=sha256File(fixture),checks=[];
 const saved=process.env.MDLXL_MOUSE_PROFILE?JSON.parse(fs.readFileSync(path.join(process.env.MDLXL_MOUSE_PROFILE,'settings.json'),'utf8')).preferences:{};
 const {app,page,errors}=await launchApp({fixture,out,settings:{preferences:{...saved,language:'en',learn:{...saved.learn,enabled:true}}},show:'hide'});
 try{
  await page.getByLabel('3D model viewport',{exact:true}).waitFor();
  const toggle=async(scope,name)=>{
   const check=scope.getByRole('checkbox',{name:'Workplane Constraints',exact:true});
   await check.uncheck();assert.equal(await check.isChecked(),false);await check.check();assert.equal(await check.isChecked(),true);
   checks.push(`${name}: unchecked and checked by real clicks`);console.log('PASS '+checks.at(-1));
  };
  for(const enabled of [true,false]){
   if(!enabled){await page.getByRole('button',{name:'Learn',exact:true}).click();await page.getByRole('menuitemcheckbox',{name:'Learn mode',exact:true}).click();await page.locator('.learn-keycap').waitFor({state:'hidden'});}
   assert.equal(await page.getByRole('button',{name:'Learn',exact:true}).getAttribute('aria-pressed'),String(enabled));
   await page.getByRole('button',{name:'Vertices',exact:true}).click();await toggle(page.locator('.classic-sidebar'),'Vertices Learn '+enabled);
   if(enabled)await page.locator('.learn-keycap').waitFor({state:'visible'});
   await page.getByRole('button',{name:'Forge',exact:true}).click();const forge=page.getByRole('dialog',{name:'Forge',exact:true});await forge.getByRole('button',{name:'Cube',exact:true}).click();await toggle(forge,'Forge Learn '+enabled);await forge.getByRole('button',{name:'Cancel',exact:true}).click();
   await page.getByRole('button',{name:'Movement',exact:true}).click();await page.getByLabel('Movement current sequence').selectOption('0');await toggle(page.locator('.movement-controller'),'Movement Learn '+enabled);
   await page.getByRole('button',{name:'POSE',exact:true}).click();await toggle(page.locator('.movement-controller'),'POSE Learn '+enabled);
   await page.getByRole('button',{name:'Bones',exact:true}).click();await toggle(page.locator('.movement-controller'),'Bones Learn '+enabled);
  }
  assert.deepEqual(errors,[]);assert.equal(sha256File(fixture),hash);
 }finally{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors,fixtureHash:hash,packaged:appTarget().packaged},null,2));await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
