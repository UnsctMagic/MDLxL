// Packaged regression: reproduce Plane -> Extrude -> side-face Bevel through mouse/keyboard.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=process.env.MDLXL_TEST_OUT||path.join(root,'out/bevel-side-check');
const source=fs.readFileSync(path.join(root,'test/forge-face-editing.electron.cjs'),'utf8');
let helper=source.slice(source.indexOf('function readView'),source.indexOf('(async()=>{'));
helper=helper.replace('return {surfaceColors:',"return {moldHandles:(p.editHandles?.points||[]).map(h=>{const v=camera.position.clone().fromArray(h.position).project(camera);return {...h,x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2,axes:[0,1,2].map(a=>{const q=camera.position.clone().fromArray(h.position);q.setComponent(a,q.getComponent(a)+1);q.project(camera);return [(q.x-v.x)*r.width/2,(v.y-q.y)*r.height/2];})};}),surfaceColors:");
eval(helper);
const cuts=fs.readFileSync(path.join(root,'test/forge-cuts.electron.cjs'),'utf8');
eval(cuts.slice(cuts.indexOf('function readDraft'),cuts.indexOf('(async()=>{',cuts.indexOf('function readDraft'))));
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const {forgeFaceNormal}=await import('../src/forge-shape-editing.js'),{forgeMoldState}=await import('../src/forge-molding.js');
 const app=await _electron.launch({executablePath:process.env.MDLXL_TEST_EXE,args:['--disable-backgrounding-occluded-windows'],env:{...process.env,MDLVIS_HEADLESS:'0',MDLXL_PROFILE:path.join(out,'profile')},timeout:60000});
 let page;const errors=[],checks=[];
 const capture=async name=>{await page.waitForTimeout(250);const data=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.capturePage().then(i=>i.toPNG().toString('base64')));fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data,'base64'));};
 try{
  page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'Forge',exact:true}).click();const d=page.getByRole('dialog',{name:'Forge',exact:true});
  const click=async name=>{await d.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(150);},view=async()=>{await page.waitForTimeout(150);return page.evaluate(readView);},doc=()=>page.evaluate(readDraft);
  const drag=async(p,dx,dy)=>{await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+dx,p.y+dy,{steps:8});await page.mouse.up();await page.waitForTimeout(180);};
  await d.getByLabel('Width',{exact:true}).fill('240');await d.getByLabel('Height',{exact:true}).fill('80');await d.getByLabel('Depth',{exact:true}).fill('60');await click('Plane');
  const plane=await doc();let v=await view(),p=pointForFace(v,plane.shapes[0],plane.shapes[0].faces[0]);
  await page.mouse.dblclick(p.x,p.y,{delay:90});await page.keyboard.press('e');await drag(p,0,-100);
  const extruded=await doc(),shape=extruded.shapes[0];assert.equal(shape.faces.length,5);checks.push('Plane extrudes through E-drag into five faces with an open underside');
  v=await view();const sides=shape.faces.filter(f=>{const n=forgeFaceNormal(shape,f);return Math.abs(n[2])<.01&&n.reduce((sum,x,i)=>sum+x*(v.camera[i]-v.target[i]),0)>0;});assert.equal(sides.length,2);
  for(const [index,face]of sides.entries()){
   v=await view();p=pointForFace(v,shape,face);await page.mouse.dblclick(p.x,p.y,{delay:90});await page.waitForTimeout(150);
   const selected=await doc();assert.equal(selected.mode,'Faces');assert.deepEqual(selected.selection[shape.id],[face.id]);const beforeView=await view();
   await page.keyboard.press('b');v=await view();const h=v.moldHandles.find(h=>h.id==='amount'),state=forgeMoldState(selected,'Bevel'),[x,y]=h.axes[state.direction],length=Math.hypot(x,y);
   await drag(h,x/length*30,y/length*30);
   const status=await d.locator('.forge-editor-status').innerText();assert.doesNotMatch(status,/could not|Select a solid/,'side '+index+': '+status);
   assert.notDeepEqual((await view()).model.Geosets,beforeView.model.Geosets);assert.deepEqual(await doc(),selected);assert.ok(await d.getByRole('button',{name:'Keep shaping',exact:true}).isEnabled());
   await click('Angled');const rounded=await view();assert.ok(rounded.model.Geosets[0].Faces.length>beforeView.model.Geosets[0].Faces.length);assert.doesNotMatch(await d.locator('.forge-editor-status').innerText(),/could not/);
   if(index===0)await capture('side-bevel-preview');await click('Keep shaping');const applied=await doc();assert.notDeepEqual(applied.shapes,selected.shapes);
   await page.keyboard.press('Control+z');await page.waitForTimeout(150);assert.deepEqual(await doc(),selected);
   await page.keyboard.press('Control+y');await page.waitForTimeout(150);assert.deepEqual(await doc(),applied);
   await page.keyboard.press('Control+z');await page.waitForTimeout(150);
   checks.push('Visible side '+index+': angled and rounded Bevel preview without error; commit and Undo/Redo restore exact geometry');
  }
  await page.keyboard.press('b');v=await view();await page.keyboard.down('Alt');await drag({x:v.rect.x+v.rect.width*.6,y:v.rect.y+v.rect.height*.5},45,20);await page.keyboard.up('Alt');assert.notDeepEqual((await view()).quaternion,v.quaternion);await page.keyboard.press('Escape');assert.deepEqual((await doc()).shapes,extruded.shapes);checks.push('Normal Alt-drag camera rotation and Escape cancellation remain available');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,checks,rendererErrors:errors},null,2));console.log(JSON.stringify({pass:true,checks},null,2));
 }catch(e){if(page)await capture('failure');fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:false,error:e.message,checks,rendererErrors:errors},null,2));throw e;}finally{await app.evaluate(({app})=>app.exit(0));}
})().catch(e=>{console.error(e);process.exitCode=1;});
